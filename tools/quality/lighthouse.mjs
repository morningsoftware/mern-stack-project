import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { startFlow } from 'lighthouse';
import desktop from 'lighthouse/core/config/desktop-config.js';
import { ReportGenerator } from 'lighthouse/report/generator/report-generator.js';

const origin = process.env.CHECKPOINT_AUDIT_ORIGIN || 'http://127.0.0.1:4002';
const output = path.resolve(fileURLToPath(new URL('./', import.meta.url)), process.env.CHECKPOINT_AUDIT_OUTPUT || '../../artifacts/lighthouse');
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname) && !process.env.CHECKPOINT_AUDIT_PASSWORD)
  throw new Error('Remote audits require an explicit dedicated audit account.');
const authResponse = await fetch(origin + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: process.env.CHECKPOINT_AUDIT_USER || 'demo', password: process.env.CHECKPOINT_AUDIT_PASSWORD || 'checkpoint-demo' }),
});
if (!authResponse.ok) throw new Error(`Audit sign-in failed: ${authResponse.status}`);
const { token } = await authResponse.json();
async function get(endpoint) {
  const response = await fetch(origin + endpoint, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Audit fixture ${endpoint}: ${response.status}`);
  return response.json();
}
const teams = await get('/api/teams');
const projects = await get('/api/projects');
const project = projects.find(p => p.name === (process.env.CHECKPOINT_AUDIT_PROJECT || 'Starfall'));
if (!project) throw new Error('Choose a populated project with CHECKPOINT_AUDIT_PROJECT.');
const team = teams.find(t => t._id === project.teamId);
const views = ['tasks', 'my-work', 'overview', 'milestones', 'bugs', 'builds', 'feedback', 'sessions', 'activity', 'notifications', 'github'];
const cases = [ ['sign-in', '/'], ['teams', '/#/teams'], ['team', `/#/teams/${team._id}`],
  ...views.map(view => [view, `/#/teams/${team._id}/projects/${project._id}/${view}`]) ];
const selected = process.env.CHECKPOINT_AUDIT_PAGES?.split(',');
await fs.mkdir(output, { recursive: true });
const results = [];
for (const mode of (process.env.CHECKPOINT_AUDIT_MODES || 'desktop,mobile').split(',')) {
  const browser = await puppeteer.launch({ headless: 'shell', pipe: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await page.goto(origin);
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    for (const [name, route] of cases.filter(([name]) => !selected || selected.includes(name))) {
      await page.goto(origin + '/?audit-reset=' + Date.now());
      await page.evaluate((value) => value ? sessionStorage.setItem('mern_token', value) : sessionStorage.removeItem('mern_token'), name === 'sign-in' ? null : token);
      // A separate document navigation measures each authenticated hash route from startup.
      const flow = await startFlow(page, {
        name: `checkpoint ${mode}: ${name}`,
        config: mode === 'desktop' ? desktop : undefined,
        flags: { disableStorageReset: true, onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] },
      });
      await flow.navigate(origin + '/?audit-page=' + name + route.slice(1), { name });
      await page.waitForSelector('main');
      await page.waitForFunction(() => !/Restoring|Loading workspace|Opening workspace/.test(document.querySelector('main')?.textContent || ''));
      const currentHash = await page.evaluate(() => location.hash);
      if (route.includes('#') && currentHash !== route.slice(route.indexOf('#'))) throw new Error(`${name}: unexpected route ${currentHash}`);
      if (name !== 'sign-in' && await page.$('input[name="password"]')) throw new Error(`${name}: audit reached sign-in instead of the requested view`);
      if (await page.$('[role="alert"]')) {
        const messages = await page.$$eval('[role="alert"]', els => els.map(el => el.textContent));
        if (messages.some(m => /Internal server|Unauthorized|Request failed/.test(m))) throw new Error(`${name}: ${messages.join('; ')}`);
      }
      const screens = [{ name, mode: 'navigation' }];
      if (name === 'sign-in') {
        const buttons = await page.$$('button');
        for (const button of buttons) if ((await button.evaluate(el => el.textContent)).trim() === 'Create account') { await button.click(); break; }
        await page.waitForSelector('input[name="email"]');
        await flow.snapshot({ name: 'register', onlyCategories: ['accessibility', 'best-practices', 'seo'] });
        screens.push({ name: 'register', mode: 'snapshot' });
      }
      if (name === 'github') {
        for (const tab of ['branches', 'commits', 'events', 'pulls']) {
          await page.click(`#github-tab-${tab}`);
          await page.waitForNetworkIdle({ idleTime: 300 });
          await flow.snapshot({ name: `github-${tab}`, onlyCategories: ['accessibility', 'best-practices', 'seo'] });
          screens.push({ name: `github-${tab}`, mode: 'snapshot' });
        }
      }
      if (['tasks', 'bugs', 'milestones'].includes(name)) {
        const opened = await page.evaluate(name => {
          const match = [...document.querySelectorAll('button')].find(el => el.getBoundingClientRect().width > 0 && (name === 'milestones' ? el.textContent.trim() === 'Edit milestone' : el.classList.contains(name === 'tasks' ? 'card-title' : 'item-title')));
          match?.click(); return !!match;
        }, name);
        if (!opened) throw new Error(`${name}: populated detail fixture missing`);
        await page.waitForSelector('dialog[open]');
        await page.waitForNetworkIdle({ idleTime: 300 });
        await flow.snapshot({ name: name + '-detail', onlyCategories: ['accessibility', 'best-practices', 'seo'] });
        screens.push({ name: name + '-detail', mode: 'snapshot' });
      }
      const flowResult = await flow.createFlowResult();
      for (let i = 0; i < flowResult.steps.length; i++) {
        const lhr = flowResult.steps[i].lhr;
        if (lhr.runtimeError) throw new Error(`${name}: ${lhr.runtimeError.message}`);
        const label = screens[i];
        const id = `${mode}-${label.name}`;
        const scores = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, v.score === null ? null : Math.round(v.score * 100)]));
        const failures = Object.values(lhr.audits).filter(a => a.score !== null && a.score < 1 && ['binary', 'numeric'].includes(a.scoreDisplayMode)).map(a => ({ id: a.id, title: a.title, score: a.score, description: a.description, details: a.details }));
        await fs.writeFile(path.join(output, id + '.json'), JSON.stringify(lhr));
        await fs.writeFile(path.join(output, id + '.html'), ReportGenerator.generateReport(lhr, 'html'));
        results.push({ page: label.name, profile: mode, mode: label.mode, scores, failures, warnings: lhr.runWarnings, lighthouseVersion: lhr.lighthouseVersion });
        console.log(id, JSON.stringify(scores));
      }
      await page.screenshot({ path: path.join(output, `${mode}-${name}.png`), fullPage: true });
      if (errors.length) throw new Error(`Browser errors: ${errors.splice(0).join('; ')}`);
      await fs.writeFile(path.join(output, 'summary.json'), JSON.stringify({ origin, collectedAt: new Date().toISOString(), scope: 'Local production build with isolated populated MongoDB; GitHub provider not configured. Navigation includes Performance; register is a snapshot and has no navigation Performance score.', results }, null, 2));
    }
  } finally { await browser.close(); }
}
console.log(`Saved ${results.length} reports to ${output}`);

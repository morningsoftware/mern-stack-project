import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer';

const origin = process.env.CHECKPOINT_SMOKE_API || 'http://127.0.0.1:4002';
const mobile = process.env.CHECKPOINT_SMOKE_MOBILE || 'http://127.0.0.1:8083';
if (![origin, mobile].every(value => ['127.0.0.1', 'localhost'].includes(new URL(value).hostname))) throw new Error('This smoke creates sample reports. Run only against the isolated local demo.');
const output = path.resolve('../../artifacts/mobile-smoke');
await fs.mkdir(output, { recursive: true });
const results = [];
async function request(endpoint, body, token, method = body ? 'POST' : 'GET') {
  const response = await fetch(origin + endpoint, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert(response.ok, `${method} ${endpoint}: ${response.status}`);
  return response.status === 204 ? null : response.json();
}
const tester = await request('/api/auth/login', { username: 'tester', password: 'checkpoint-demo' });
const developer = await request('/api/auth/login', { username: 'demo', password: 'checkpoint-demo' });
const project = (await request('/api/projects', null, tester.token)).find(p => p.name === 'Starfall');
const session = (await request(`/api/playtest-sessions?projectId=${project._id}`, null, tester.token))[0];
const browser = await puppeteer.launch({ headless: 'shell', pipe: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const errors = []; page.on('pageerror', err => errors.push(err.message));
page.on('requestfailed', req => console.error('REQUEST FAILED', req.url(), req.failure()?.errorText));
page.on('console', message => { if (message.type() === 'error') console.error('BROWSER', message.text()); });
const button = title => `[role="button"][aria-label=${JSON.stringify(title)}]`;
async function visible(selector) {
  await page.waitForFunction(selector => [...document.querySelectorAll(selector)].some(el => el.checkVisibility() && !el.closest('[aria-hidden="true"]')), {}, selector);
  for (const element of await page.$$(selector)) if (await element.evaluate(el => el.checkVisibility() && !el.closest('[aria-hidden="true"]'))) return element;
  throw new Error('No active element: ' + selector);
}
async function click(title) { await (await visible(button(title))).click(); }
async function type(label, value) { await (await visible(`[aria-label=${JSON.stringify(label)}]`)).type(value); }
async function text(value) { await page.waitForFunction(value => document.body.textContent.includes(value), {}, value); }
async function shot(name) { await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true }); }
try {
  await page.goto(mobile, { waitUntil: 'networkidle0' });
  await type('Username', 'tester'); await type('Password', 'wrong-password'); await click('Sign in'); await text('Invalid username or password');
  const password = '[aria-label="Password"]'; await page.locator(password).fill('checkpoint-demo'); await click('Sign in');
  await text('Choose a playtest project'); await click('Open Starfall'); await text('Available builds');
  results.push('Invalid credentials show an error; valid existing account loads real projects/builds/sessions.');
  await shot('project');
  await click('Give feedback: Movement playtest'); await type('What worked, and what needs attention?', 'Mobile smoke: movement is responsive, but the ledge needs attention.'); await click('5'); await click('Send feedback'); await text('Feedback sent.');
  const notes = await request(`/api/playtest-feedback?projectId=${project._id}`, null, developer.token);
  assert(notes.some(note => note.comments.startsWith('Mobile smoke:') && note.rating === 5 && note.sessionId === session._id));
  results.push('Session feedback persists with the chosen rating, author, build and session.');
  await click('Back to project'); await click('Bug in 0.5.0');
  await click('Submit bug report'); await text('Add a short bug title.');
  const title = `Mobile smoke ledge ${Date.now()}`;
  await type('Bug title', title); await type('Steps to reproduce', 'Open level one and jump at the left ledge.'); await type('Expected result', 'Land on the platform.'); await type('Actual result', 'Player catches on the edge.'); await click('high');
  // One deliberate failed write verifies drafts survive an API error; the retry uses the real API.
  await page.setRequestInterception(true); let failOnce = true;
  page.on('request', req => {
    if (failOnce && req.method() === 'POST' && new URL(req.url()).pathname === '/api/bug-reports') { failOnce = false; void req.respond({ status: 503, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"error":"Temporary test failure; retry your report."}' }); }
    else void req.continue();
  });
  await click('Submit bug report'); await text('Temporary test failure; retry your report.');
  assert.equal(await page.$eval('[aria-label="Bug title"]', el => el.value), title);
  await click('Submit bug report'); await text('Bug report saved.'); await text(title);
  let bugs = await request(`/api/bug-reports?projectId=${project._id}`, null, developer.token);
  const saved = bugs.filter(b => b.title === title); assert.equal(saved.length, 1); const bug = saved[0];
  assert.equal(bug.reportedBy, tester.user._id); assert.equal(bug.severity, 'high'); assert(bug.buildId); assert.equal(bug.actualResult, 'Player catches on the edge.');
  results.push('Structured bug validation, failed-write draft retention, retry and exactly one persisted report.');
  await shot('bug-saved');
  const fixture = path.join(output, 'attachment.png');
  await fs.writeFile(fixture, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1kAAAAASUVORK5CYII=', 'base64'));
  const chooser = page.waitForFileChooser(); await click('Choose screenshot'); await (await chooser).accept([fixture]);
  await click('Attach screenshot'); await text('Screenshot attached.');
  const images = await request(`/api/bug-reports/${bug._id}/screenshots`, null, tester.token); assert.equal(images.length, 1); assert.equal(images[0].contentType, 'image/png');
  const imageResponse = await fetch(origin + `/api/bug-reports/${bug._id}/screenshots/${images[0]._id}`, { headers: { Authorization: `Bearer ${tester.token}` } }); assert.equal(imageResponse.status, 200);
  await click('Remove attachment 1'); await text('Screenshot removed.'); assert.equal((await request(`/api/bug-reports/${bug._id}/screenshots`, null, tester.token)).length, 0);
  results.push('Real image picker upload, authenticated retrieval and removal persist through the screenshot API.');
  await request(`/api/bug-reports/${bug._id}`, { status: 'resolved' }, developer.token, 'PATCH');
  await click('My bug reports'); await text(title); await text('Status: resolved'); await shot('my-reports');
  results.push('Developer triage is reflected in the mobile My reports view.');
  await page.reload({ waitUntil: 'networkidle0' }); await text(title); assert.equal(await page.$('[aria-label="Password"]'), null);
  results.push('Reload restores the saved session and requested route.');
  await page.goto(mobile + `/project/${project._id}`, { waitUntil: 'networkidle0' });
  await click('Give feedback: Movement playtest'); await type('What worked, and what needs attention?', 'Retain this draft when the session closes.');
  await request(`/api/playtest-sessions/${session._id}`, { status: 'closed' }, developer.token, 'PATCH');
  await click('Send feedback'); await text('This session is closed or its deadline has passed.');
  assert.equal(await page.$eval('[aria-label="What worked, and what needs attention?"]', el => el.value), 'Retain this draft when the session closes.');
  await request(`/api/playtest-sessions/${session._id}`, { status: 'open' }, developer.token, 'PATCH');
  results.push('A session closed after opening the form rejects feedback and retains the draft.');
  await page.goto(mobile + '/projects', { waitUntil: 'networkidle0' }); await click('Sign out'); await text('Playtest, then report.');
  await page.reload({ waitUntil: 'networkidle0' }); await text('Playtest, then report.');
  results.push('Sign-out clears the web validation session and stays signed out after reload.');
  await click('Create an account');
  const username = `mobile-${Date.now()}`;
  await type('Username', username); await type('Display name', 'Mobile smoke tester'); await type('Email', username + '@example.test'); await type('Password', 'mobile-smoke-password');
  await click('Create playtester account'); await text('Choose a playtest project');
  const newAccount = await request('/api/auth/login', { username, password: 'mobile-smoke-password' });
  assert.equal(newAccount.user.role, 'playtester');
  await page.evaluate(origin => sessionStorage.setItem('checkpoint.session.v1', JSON.stringify({ origin, token: 'invalid-token-for-expiry-test' })), origin);
  await page.reload({ waitUntil: 'networkidle0' }); await text('Playtest, then report.');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('checkpoint.session.v1')), null);
  results.push('Registration creates a playtester account; an invalid saved token clears and returns to sign-in.');
  const desktop = await browser.newPage(); await desktop.goto(origin); await desktop.evaluate(token => sessionStorage.setItem('mern_token', token), developer.token);
  await desktop.goto(origin + `/#/teams/${project.teamId}/projects/${project._id}/bugs`); await desktop.waitForFunction(title => document.body.textContent.includes(title), {}, title);
  await desktop.screenshot({ path: path.join(output, 'desktop-shared-report.png'), fullPage: true });
  results.push('The desktop bug view displays the report created by the separate React Native client.');
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ collectedAt: new Date().toISOString(), environment: 'React Native Web validation at 390×844 → real local Express API → isolated MongoDB. Native iOS/Android bundles exported separately; no physical-device execution claimed.', results }, null, 2));
  console.log('PASS', results.length, 'mobile end-to-end scenarios');
} catch (err) {
  await shot('failure'); console.error('PAGE:', (await page.$eval('body', el => el.textContent)).slice(-4500)); throw err;
} finally { await browser.close(); }

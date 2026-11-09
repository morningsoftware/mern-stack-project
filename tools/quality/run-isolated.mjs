import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const mode = process.argv[2] || 'lighthouse';
if (!['lighthouse', 'mobile-smoke'].includes(mode)) throw new Error('Choose lighthouse or mobile-smoke.');
async function run(command, args, extra = {}) {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', ...extra });
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  if (code !== 0) throw new Error(`${command} ${args.join(' ')} exited ${code}`);
}
await run(npm, ['run', 'build', '--prefix', 'client']);
if (mode === 'mobile-smoke') await run(npm, ['run', 'export:web', '--prefix', 'mobile'], { env: { ...process.env, EXPO_PUBLIC_API_URL: 'http://127.0.0.1:4002' } });
const server = spawn(process.execPath, ['--import', 'tsx', 'server/scripts/demo.js'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CHECKPOINT_DEMO_PORT: '4002', CHECKPOINT_DEMO_HOST: '127.0.0.1' } });
let preview;
const stop = () => { server.kill(); preview?.kill(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Demo seed did not become ready within 60 seconds.')), 60000);
    let output = '';
    server.stdout.on('data', chunk => { process.stdout.write(chunk); output += chunk; if (output.includes('Checkpoint real API demo ready:')) { clearTimeout(timeout); resolve(); } });
    server.stderr.on('data', chunk => process.stderr.write(chunk));
    server.on('error', error => { clearTimeout(timeout); reject(error); });
    server.on('exit', code => { clearTimeout(timeout); reject(new Error(`Demo API exited ${code}`)); });
  });
  if (mode === 'mobile-smoke') {
    preview = spawn(process.execPath, ['tools/quality/static-mobile.mjs'], { cwd: root, stdio: 'inherit' });
    for (let i = 0; i < 40; i++) { try { const response = await fetch('http://127.0.0.1:8083'); if (response.ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  await run(process.execPath, [mode === 'lighthouse' ? 'lighthouse.mjs' : 'smoke.mjs'], { cwd: fileURLToPath(new URL('./', import.meta.url)) });
  if (mode === 'lighthouse') await run(process.execPath, ['summarize.mjs'], { cwd: fileURLToPath(new URL('./', import.meta.url)) });
} finally { stop(); }

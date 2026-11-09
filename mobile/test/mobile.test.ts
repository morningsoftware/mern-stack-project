import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient, ApiError, validateOrigin } from '../src/lib/api.ts';
import { bugPayload, ownBugs, sessionOpen } from '../src/lib/models.ts';
import type { Bug, Session } from '../src/lib/models.ts';

test('production requires an HTTPS origin; local development can use a LAN address', () => {
  assert.equal(validateOrigin('https://checkpoint.morning.codes/'), 'https://checkpoint.morning.codes');
  assert.equal(validateOrigin('http://127.0.0.1:4002'), 'http://127.0.0.1:4002');
  assert.equal(validateOrigin('http://192.168.1.4:4002', true), 'http://192.168.1.4:4002');
  for (const value of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/api', 'https://example.com?secret=1', 'https://example.com#token']) assert.throws(() => validateOrigin(value));
});
test('bug submission preserves structured data and rejects incomplete reports', () => {
  const form = { title: ' Jump stuck ', severity: 'high', reproductionSteps: ' Jump left ', expectedResult: ' Land ', actualResult: ' Stuck ', buildId: 'build-1', environment: ' iOS ' };
  assert.deepEqual(bugPayload(form, 'project-1'), { title: 'Jump stuck', projectId: 'project-1', severity: 'high', reproductionSteps: 'Jump left', expectedResult: 'Land', actualResult: 'Stuck', buildId: 'build-1', description: '', environment: 'iOS' });
  for (const key of ['title', 'reproductionSteps', 'expectedResult', 'actualResult', 'severity']) assert.throws(() => bugPayload({ ...form, [key]: '' }, 'project-1'));
  assert.equal('buildId' in bugPayload({ ...form, buildId: '' }, 'project-1'), false);
});
test('session deadline is strict, including the exact boundary and invalid timestamps', () => {
  const session = { status: 'open', deadline: '2026-11-10T12:00:00.000Z' } as Session;
  const at = Date.parse(session.deadline);
  assert.equal(sessionOpen(session, at - 1), true);
  assert.equal(sessionOpen(session, at), false);
  assert.equal(sessionOpen({ ...session, status: 'closed' }, at - 1), false);
  assert.equal(sessionOpen({ ...session, deadline: 'invalid' }, at - 1), false);
});
test('My reports filters by reporter, not creator or team role', () => {
  const mine = { _id: '1', reportedBy: 'me' } as Bug;
  assert.deepEqual(ownBugs([mine, { _id: '2', reportedBy: 'other' } as Bug], 'me'), [mine]);
});
test('API attaches a bearer token and handles JSON writes and empty deletion responses', async () => {
  const requests: { url: string; options: RequestInit }[] = [];
  const api = new ApiClient('https://api.test', async (url, options) => { requests.push({ url: String(url), options: options! }); return options?.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json({ _id: 'saved' }); });
  api.setToken('test-token');
  assert.deepEqual(await api.request('/api/bug-reports', { method: 'POST', body: '{"title":"bug"}' }), { _id: 'saved' });
  assert.equal(new Headers(requests[0].options.headers).get('Authorization'), 'Bearer test-token');
  assert.equal(new Headers(requests[0].options.headers).get('Content-Type'), 'application/json');
  assert.equal(await api.request('/api/bug-reports/1/screenshots/1', { method: 'DELETE' }), null);
  await assert.rejects(api.request('https://evil.test/api/users'));
});
test('raw image upload retains its binary body and image content type', async () => {
  const image = new Blob(['image'], { type: 'image/png' });
  const api = new ApiClient('https://api.test', async (_url, options) => {
    assert.equal(options?.body, image);
    assert.equal(new Headers(options?.headers).get('Content-Type'), 'image/png');
    return Response.json({ _id: 'screenshot' }, { status: 201 });
  });
  await api.request('/api/bug-reports/1/screenshots', { method: 'POST', body: image, headers: { 'Content-Type': 'image/png' } });
});
test('expired sessions clear authentication; rejected sign-in does not invoke logout', async () => {
  let logout = 0;
  const api = new ApiClient('https://api.test', async () => Response.json({ error: 'Session expired' }, { status: 401 }));
  api.onUnauthorized = () => logout++;
  await assert.rejects(api.request('/api/auth/login'), (err: unknown) => err instanceof ApiError && err.status === 401);
  assert.equal(logout, 0);
  api.setToken('old-token');
  await assert.rejects(api.request('/api/projects'), /Session expired/);
  assert.equal(logout, 1);
});
test('a stale request cannot log out a newly signed-in account', async () => {
  let finish!: (response: Response) => void;
  const api = new ApiClient('https://api.test', () => new Promise(resolve => { finish = resolve; }));
  let logout = 0; api.onUnauthorized = () => logout++;
  api.setToken('old'); const request = api.request('/api/projects');
  api.setToken('new'); finish(Response.json({}, { status: 401 }));
  await assert.rejects(request); assert.equal(logout, 0);
});
test('connection errors produce a useful message without leaking transport details', async () => {
  const api = new ApiClient('https://api.test', async () => { throw new Error('internal transport credentials'); });
  await assert.rejects(api.request('/api/projects'), /Could not reach checkpoint/);
});
test('fetch receives the global receiver required by browser transports', async () => {
  const api = new ApiClient('https://api.test', async function (this: typeof globalThis) {
    assert.equal(this, globalThis);
    return Response.json({ ok: true });
  });
  assert.deepEqual(await api.request('/api/health'), { ok: true });
});
test('a misconfigured server returning HTML cannot be treated as a successful write', async () => {
  const api = new ApiClient('https://api.test', async () => new Response('<html>Wrong server</html>', { status: 200 }));
  await assert.rejects(api.request('/api/bug-reports', { method: 'POST', body: '{}' }), /did not return JSON/);
});

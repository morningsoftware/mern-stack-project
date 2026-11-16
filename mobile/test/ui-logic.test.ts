import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient } from '../src/lib/api.ts';
import { deviceSummary, formatBytes, formatPlatform, formatStatus, initials, relativeTime, safeBuildUrl } from '../src/lib/format.ts';
import { MAX_IMAGE_BYTES, checkImage, mimeFromUri } from '../src/lib/images.ts';
import { browseProjects, bugErrors, bugPayload, countBugsByStatus, feedbackPayload, filterBugs, sessionState, severities } from '../src/lib/models.ts';
import type { Bug, Project, Session } from '../src/lib/models.ts';

const bug = (status: string, id = status): Bug => ({ _id: id, status, reportedBy: 'me' }) as Bug;

test('severities match the server enum, so a report is never rejected for a value the app offered', () => {
  assert.deepEqual([...severities], ['low', 'medium', 'high']);
  const form = { title: 'x', reproductionSteps: 'x', expectedResult: 'x', actualResult: 'x' };
  assert.throws(() => bugPayload({ ...form, severity: 'critical' }, 'p'), /valid severity/);
});

test('bug form errors list every missing field so the form can mark them all', () => {
  assert.deepEqual(Object.keys(bugErrors({ severity: 'low' })).sort(), ['actualResult', 'expectedResult', 'reproductionSteps', 'title']);
  assert.deepEqual(bugErrors({ title: 'a', reproductionSteps: 'b', expectedResult: 'c', actualResult: 'd', severity: 'high' }), {});
});

test('feedback needs an explicit rating and a comment, and omits empty references', () => {
  assert.throws(() => feedbackPayload({ projectId: 'p', rating: null, comments: 'ok' }), /rating/);
  assert.throws(() => feedbackPayload({ projectId: 'p', rating: 6, comments: 'ok' }), /rating/);
  assert.throws(() => feedbackPayload({ projectId: 'p', rating: 4, comments: '  ' }), /description/);
  assert.deepEqual(feedbackPayload({ projectId: 'p', buildId: '', sessionId: undefined, rating: 4, comments: ' fun ' }), { projectId: 'p', rating: 4, comments: 'fun' });
  assert.deepEqual(feedbackPayload({ projectId: 'p', buildId: 'b', sessionId: 's', rating: 1, comments: 'x' }), { projectId: 'p', buildId: 'b', sessionId: 's', rating: 1, comments: 'x' });
});

test('report filters and counts follow the server statuses', () => {
  const bugs = [bug('open', '1'), bug('in_progress', '2'), bug('open', '3'), bug('resolved', '4')];
  assert.deepEqual(countBugsByStatus(bugs), { all: 4, open: 2, in_progress: 1, resolved: 1 });
  assert.deepEqual(filterBugs(bugs, 'open').map(item => item._id), ['1', '3']);
  assert.equal(filterBugs(bugs, 'all').length, 4);
});

test('projects are searchable and list active work first', () => {
  const projects = [
    { _id: '1', name: 'Zed', status: 'archived' }, { _id: '2', name: 'Beta Quest', status: 'active', description: 'A platformer' }, { _id: '3', name: 'Alpha', status: 'active' },
  ] as Project[];
  assert.deepEqual(browseProjects(projects, '').map(project => project._id), ['3', '2', '1']);
  assert.deepEqual(browseProjects(projects, ' platform ').map(project => project._id), ['2']);
});

test('session state distinguishes closed from a passed deadline', () => {
  const session = { status: 'open', deadline: '2026-11-10T12:00:00.000Z' } as Session;
  const at = Date.parse(session.deadline);
  assert.equal(sessionState(session, at - 1), 'open');
  assert.equal(sessionState(session, at), 'passed');
  assert.equal(sessionState({ ...session, status: 'closed' }, at - 1), 'closed');
});

test('labels read like the website', () => {
  assert.equal(formatStatus('in_progress'), 'In progress');
  assert.equal(formatStatus('resolved'), 'Resolved');
  assert.equal(formatStatus('needs_info'), 'Needs info');
  assert.equal(formatPlatform('macos'), 'macOS');
  assert.equal(deviceSummary('ios', '18.1'), 'iOS 18.1');
  assert.equal(deviceSummary('web'), 'Web');
  assert.equal(initials('Kayla Pagan'), 'KP');
  assert.equal(initials('  '), '?');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2 KB');
  assert.equal(formatBytes(1.5 * 1024 * 1024), '1.5 MB');
});

test('relative time rounds down and falls back to a date for old or future values', () => {
  const now = Date.parse('2026-11-14T12:00:00Z');
  assert.equal(relativeTime('2026-11-14T11:59:40Z', now), 'Just now');
  assert.equal(relativeTime('2026-11-14T11:30:00Z', now), '30 min ago');
  assert.equal(relativeTime('2026-11-14T09:00:00Z', now), '3 h ago');
  assert.equal(relativeTime('2026-11-12T12:00:00Z', now), '2 d ago');
  assert.equal(relativeTime('2026-10-01T12:00:00Z', now), 'Oct 1, 2026');
  assert.equal(relativeTime('not a date', now), '');
});

test('build links must be HTTPS without embedded credentials', () => {
  assert.equal(safeBuildUrl('https://games.example/build.zip'), 'https://games.example/build.zip');
  for (const value of ['http://games.example', 'javascript:alert(1)', 'https://user:pw@games.example', 'nonsense']) assert.throws(() => safeBuildUrl(value));
});

test('screenshots accept PNG, JPEG and WebP up to 2 MB and explain every rejection', () => {
  assert.deepEqual(checkImage({ uri: 'file:///a/shot.png', mimeType: 'image/png', fileSize: 1000 }), { ok: true, mimeType: 'image/png' });
  assert.deepEqual(checkImage({ uri: 'file:///a/shot.JPG' }), { ok: true, mimeType: 'image/jpeg' });
  assert.equal(mimeFromUri('file:///a/shot.webp?x=1'), 'image/webp');
  const heic = checkImage({ uri: 'file:///a/IMG_1.HEIC' });
  assert.equal(heic.ok, false);
  assert.match(heic.ok ? '' : heic.error, /PNG, JPEG or WebP/);
  const big = checkImage({ uri: 'file:///a/shot.png', mimeType: 'image/png', fileSize: MAX_IMAGE_BYTES + 1 });
  assert.match(big.ok ? '' : big.error, /2 MB/);
  assert.equal(checkImage({ uri: 'file:///a/shot.png', mimeType: 'image/png', fileSize: MAX_IMAGE_BYTES }).ok, true);
});

test('authenticated image requests use the API origin and the current token only', () => {
  const api = new ApiClient('https://api.test', async () => Response.json({}));
  assert.deepEqual(api.authHeaders(), {});
  api.setToken('abc');
  assert.deepEqual(api.authHeaders(), { Authorization: 'Bearer abc' });
  assert.equal(api.url('/api/bug-reports/1/screenshots/2'), 'https://api.test/api/bug-reports/1/screenshots/2');
  assert.throws(() => api.url('https://evil.test/api/x'));
  assert.throws(() => api.url('/other'));
});

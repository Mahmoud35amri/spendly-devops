// Integration tests for the sync API: the real Express app on a random port, SQLite in memory.
process.env.DB_PATH = ':memory:';
process.env.LOG_LEVEL ??= 'silent';
process.env.TRUST_PROXY = '1'; // as in production, behind one reverse proxy
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../server/app');

let server;
let base;
before(() => new Promise((resolve) => {
  server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); });
}));
after(() => server.close());

const keyOf = (c) => c.repeat(32);
const post = (body, key = keyOf('a')) => fetch(`${base}/api/sync`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const pull = async (key, since = 0) => (await post({ since, changes: [] }, key)).json();
const expense = (id, updatedAt, data = { amount: 4.5 }) => ({ kind: 'expense', id, updatedAt, data });

test('health reports the database', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, db: true, version: 'dev' });
});

test('rejects a missing or malformed sync key', async () => {
  assert.equal((await post({}, '')).status, 401);
  assert.equal((await post({}, 'short')).status, 401);
  assert.equal((await post({}, 'x'.repeat(31) + '!')).status, 401);
});

test('push and pull: newest edit wins and deletes propagate', async () => {
  const key = keyOf('b');
  const first = await (await post({ since: 0, changes: [expense('e1', 100), expense('e2', 100)] }, key)).json();
  assert.equal(first.records.length, 2);
  assert.equal(first.more, false);

  await post({ since: first.cursor, changes: [expense('e1', 50, { amount: 999 })] }, key); // older edit
  const all = await pull(key);
  assert.equal(all.records.find((r) => r.id === 'e1').data.amount, 4.5);

  const del = await (await post({ since: first.cursor, changes: [{ kind: 'expense', id: 'e2', updatedAt: 200, deleted: true }] }, key)).json();
  assert.deepEqual(del.records.map((r) => [r.id, r.deleted, r.data]), [['e2', true, null]]);
});

test('each sync key is its own private vault', async () => {
  await post({ since: 0, changes: [expense('secret', 1)] }, keyOf('c'));
  assert.equal((await pull(keyOf('d'))).records.length, 0);
});

test('pages through large pulls with the cursor', async () => {
  const key = keyOf('e');
  for (let batch = 0; batch < 3; batch++) {
    const changes = Array.from({ length: 500 }, (_, i) => expense(`p${batch}-${i}`, 1));
    assert.equal((await post({ since: 0, changes }, key)).status, 200);
  }
  const page1 = await pull(key);
  assert.equal(page1.records.length, 1000);
  assert.equal(page1.more, true);
  const page2 = await pull(key, page1.cursor);
  assert.equal(page2.records.length, 500);
  assert.equal(page2.more, false);
  assert.equal(page2.cursor, 1500);
  assert.equal((await pull(key, 999999)).records.length, 1000); // cursor from another database: start over
});

test('validates the payload', async () => {
  const bad = async (body) => { const r = await post(body); return [r.status, (await r.json()).error]; };
  assert.deepEqual(await bad({ changes: [{ kind: 'nope', id: 'x', updatedAt: 1 }] }), [400, 'invalid change']);
  assert.deepEqual(await bad({ changes: [expense('', 1)] }), [400, 'invalid change']);
  assert.deepEqual(await bad({ changes: Array.from({ length: 501 }, (_, i) => expense(`x${i}`, 1)) }), [413, 'too many changes']);
  assert.deepEqual(await bad({ changes: [expense('big', 1, 'x'.repeat(5000))] }), [413, 'record too large']);
  assert.deepEqual(await bad('{not json'), [400, 'invalid JSON']);
});

test('CORS only for the allowed origins', async () => {
  const preflight = (origin) => fetch(`${base}/api/sync`, { method: 'OPTIONS', headers: { Origin: origin } });
  const ok = await preflight('http://localhost:5173');
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal((await preflight('https://evil.example')).headers.get('access-control-allow-origin'), null);
});

test('serves the PWA but never the server files or the database', async () => {
  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type'), /text\/html/);
  assert.equal((await fetch(`${base}/app.js`)).status, 200);
  assert.equal((await fetch(`${base}/icons/icon.svg`)).status, 200);
  for (const p of ['/server/app.js', '/package.json', '/schema.sql', '/data/spendly.db', '/.git/config', '/..%2fpackage.json']) {
    assert.equal((await fetch(base + p)).status, 404, p);
  }
});

test('exposes Prometheus metrics labelled by route template', async () => {
  const text = await (await fetch(`${base}/metrics`)).text();
  assert.match(text, /http_requests_total\{method="POST",route="\/api\/sync",status="200"\} \d+/);
  assert.match(text, /http_requests_total\{method="POST",route="\/api\/sync",status="401"\} \d+/);
  assert.match(text, /http_request_duration_seconds_bucket\{le="0.05",method="GET",route="\/api\/health"/);
  assert.match(text, /spendly_sync_records_total\{direction="push"\} \d+/);
  assert.match(text, /process_resident_memory_bytes/);
  assert.doesNotMatch(text, /route="\/api\/sync\/[^"]/); // no raw URLs as labels
});

test('sends security headers', async () => {
  const res = await fetch(`${base}/`);
  assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-powered-by'), null);
});

// Last on purpose: it uses up this IP's rate limit.
test('rate limit covers every route except probes and scrapes', async () => {
  for (let i = 0; i < 130; i++) assert.equal((await fetch(`${base}/api/health`)).status, 200);
  const statuses = [];
  for (let i = 0; i < 130; i++) statuses.push((await fetch(`${base}/index.html`)).status);
  assert.ok(statuses.includes(429), 'static files are rate limited');
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  assert.equal((await fetch(`${base}/metrics`)).status, 200);
  // Behind the proxy, each client keeps its own budget: the limit follows the forwarded client IP.
  assert.equal((await fetch(`${base}/index.html`, { headers: { 'X-Forwarded-For': '203.0.113.7' } })).status, 200);
});

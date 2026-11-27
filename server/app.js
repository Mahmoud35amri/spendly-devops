const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { db, sync, healthy } = require('./db');
const { logger, httpLogger, metricsMiddleware, metricsHandler, syncRecords, traced } = require('./observability');

const ROOT = path.join(__dirname, '..');
const PWA_FILES = ['index.html', 'styles.css', 'app.js', 'icons.js', 'sw.js', 'manifest.webmanifest'];
const ORIGINS = /^(https:\/\/mahmoud35amri\.github\.io|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
const CORS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400', Vary: 'Origin',
};
const KEY_RE = /^[A-Za-z0-9_-]{32,128}$/;
const KINDS = new Set(['expense', 'category', 'settings', 'entry']);
const MAX_CHANGES = 500;
const MAX_DATA = 4000;

// Same validation as the original Cloudflare function; returns { changes } or { status, error }.
function parseChanges(body) {
  const input = Array.isArray(body?.changes) ? body.changes : [];
  if (input.length > MAX_CHANGES) return { status: 413, error: 'too many changes' };
  const changes = [];
  for (const c of input) {
    const updatedAt = Number(c?.updatedAt);
    if (!c || !KINDS.has(c.kind) || typeof c.id !== 'string' || !c.id || c.id.length > 64 || !Number.isFinite(updatedAt) || updatedAt < 0) {
      return { status: 400, error: 'invalid change' };
    }
    const data = c.deleted ? null : JSON.stringify(c.data === undefined ? null : c.data);
    if (data && data.length > MAX_DATA) return { status: 413, error: 'record too large' };
    changes.push({ kind: c.kind, id: c.id, data, deleted: c.deleted ? 1 : 0, updatedAt: Math.floor(updatedAt) });
  }
  return { changes };
}

const app = express();
app.use(httpLogger, metricsMiddleware);
// Per-IP limit on every route except probes and scrapes: with a NodePort they come from the node IP, like client
// traffic, and a 429 on a probe would take the pod out of service.
app.use(rateLimit({
  windowMs: 60_000, limit: Number(process.env.RATE_LIMIT_PER_MIN ?? 120),
  skip: (req) => req.path === '/api/health' || req.path === '/metrics',
}));
app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
app.get('/metrics', metricsHandler);

// Serve only the PWA files: the repo root also holds the server code and the SQLite file.
app.get('/', (_req, res) => res.sendFile('index.html', { root: ROOT }));
for (const file of PWA_FILES) app.get(`/${file}`, (_req, res) => res.sendFile(file, { root: ROOT }));
app.use('/icons', express.static(path.join(ROOT, 'icons')));

const api = express.Router();
api.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin && ORIGINS.test(origin)) res.set({ 'Access-Control-Allow-Origin': origin, ...CORS });
  res.set('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') res.status(204).end(); else next();
});
api.get('/health', (_req, res) => res.json({ ok: true, db: healthy() }));
// The key is checked before the body is parsed, so anonymous clients cannot make the server read 3 MB.
api.post('/sync', (req, res, next) => {
  const auth = req.get('Authorization') ?? '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!KEY_RE.test(key)) return res.status(401).json({ error: 'unauthorized' });
  res.locals.vault = crypto.createHash('sha256').update(key).digest('hex'); // the key itself is never stored
  next();
}, express.json({ type: () => true, limit: '3mb' }), (req, res) => {
  const { changes, status, error } = parseChanges(req.body);
  if (error) return res.status(status).json({ error });
  const since = Number.isInteger(req.body?.since) && req.body.since >= 0 ? req.body.since : 0;
  const result = traced('sync.transaction', (span) => {
    span.setAttributes({ 'spendly.changes.pushed': changes.length, 'spendly.since': since });
    return sync(res.locals.vault, changes, since);
  });
  syncRecords.inc({ direction: 'push' }, changes.length);
  syncRecords.inc({ direction: 'pull' }, result.records.length);
  res.json(result);
});
app.use('/api', api);

app.use((_req, res) => res.status(404).json({ error: 'not found' }));
app.use((err, _req, res, _next) => {
  // Body-parser errors (bad JSON, body too large) carry a 4xx status; anything else is a server fault.
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) res.err = err; // pino-http then logs the request at error level with the stack trace
  res.status(status).json({ error: status === 500 ? 'internal error' : err.type === 'entity.parse.failed' ? 'invalid JSON' : err.message });
});

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  const server = app.listen(port, () => logger.info({ port }, 'spendly listening'));
  // Kubernetes sends SIGTERM before stopping a pod: finish in-flight requests, then close SQLite cleanly.
  const stop = () => server.close(() => { db.close(); process.exit(0); });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

module.exports = { app, parseChanges };

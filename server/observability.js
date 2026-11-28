const pino = require('pino');
const pinoHttp = require('pino-http');
const client = require('prom-client');
const { trace, SpanStatusCode } = require('@opentelemetry/api');

// Structured JSON logs on stdout. Request fields are an allowlist, so headers (and the sync key in
// Authorization) never reach the logs.
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const httpLogger = pinoHttp({
  logger,
  serializers: {
    // raw.ip is Express' req.ip: the client's address, also behind a trusted proxy (TRUST_PROXY).
    req: (req) => ({ id: req.id, method: req.method, url: req.url, ip: req.raw.ip ?? req.remoteAddress, userAgent: req.headers['user-agent'] }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
  autoLogging: { ignore: (req) => req.url === '/metrics' || req.url === '/api/health' },
  customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
});

client.collectDefaultMetrics();
const labelNames = ['method', 'route', 'status'];
const requests = new client.Counter({ name: 'http_requests_total', help: 'HTTP requests handled', labelNames });
const duration = new client.Histogram({
  name: 'http_request_duration_seconds', help: 'HTTP request duration in seconds', labelNames,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
});
const syncRecords = new client.Counter({
  name: 'spendly_sync_records_total', help: 'Records pushed to or pulled from the sync API', labelNames: ['direction'],
});

function metricsMiddleware(req, res, next) {
  const stop = duration.startTimer();
  res.on('finish', () => {
    // Label by route template, never the raw URL, so the number of time series stays bounded.
    const labels = { method: req.method, route: req.route ? req.baseUrl + req.route.path : 'unmatched', status: res.statusCode };
    requests.inc(labels);
    stop(labels);
  });
  next();
}
const metricsHandler = async (_req, res) => res.type(client.register.contentType).send(await client.register.metrics());

// Runs fn inside a child span of the current request; a failure is recorded on the span before it propagates.
const tracer = trace.getTracer('spendly');
const traced = (name, fn) => tracer.startActiveSpan(name, (span) => {
  try { return fn(span); } catch (err) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw err;
  } finally { span.end(); }
});

module.exports = { logger, httpLogger, metricsMiddleware, metricsHandler, syncRecords, traced };

// Preloaded with `node --require ./server/tracing.js`, so http, express and pino are patched before the app loads them.
// Configured by the standard OTEL_* variables: spans go to OTEL_EXPORTER_OTLP_ENDPOINT (Jaeger), OTEL_SDK_DISABLED=true turns it off.
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { PinoInstrumentation } = require('@opentelemetry/instrumentation-pino');

const NOISE = ['/metrics', '/api/health']; // Prometheus scrapes and Kubernetes probes, every few seconds

new NodeSDK({
  instrumentations: [
    new HttpInstrumentation({ ignoreIncomingRequestHook: (req) => NOISE.includes(req.url) }),
    new ExpressInstrumentation(),
    new PinoInstrumentation(), // adds trace_id and span_id to every log line
  ],
}).start();

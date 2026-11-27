# Security scan results

Both scans run in the pipeline ([.github/workflows/ci.yml](../../.github/workflows/ci.yml)) on every pull request and every push to `main`. The latest results are on each run page (job summaries) and in the artifacts `codeql-sarif` and `zap-report`.

## SAST: CodeQL

| | |
|---|---|
| Tool | GitHub CodeQL, language `javascript-typescript`, query suite **security-extended** |
| Scope | the whole repository (server, PWA, widget, scripts, tests) on **every** run, pull requests included (`CODEQL_ACTION_DIFF_INFORMED_QUERIES=false`) |
| Gate | any result fails the job (`SAST (CodeQL)` → *Fail on any finding*) |
| Results | [Security → Code scanning](https://github.com/Mahmoud35amri/spendly-devops/security/code-scanning) |

### First run (PR #20): 3 findings, all fixed

| Rule | Location | Problem | Fix |
|---|---|---|---|
| `js/missing-rate-limiting` | `server/app.js:44` | the route serving `index.html` reads the file system without a rate limit | one per-IP limiter on every route (`RATE_LIMIT_PER_MIN`, default 120/min), skipping only `/api/health` and `/metrics` |
| `js/missing-rate-limiting` | `server/app.js:45` | same for the other PWA files | same fix |
| `js/incomplete-url-substring-sanitization` | `app.js:900` (PWA) | `location.hostname.endsWith('github.io')` also matches `evilgithub.io` | `endsWith('.github.io')` |

Why the limiter skips two routes: with a NodePort, kube-proxy rewrites the client's source IP to the node's IP, the same IP the kubelet probes from. If probes counted against the limit, busy traffic (or the DAST scan) would answer them with 429, Kubernetes would mark the pod unready and remove it from the Service. A test (`rate limit covers every route except probes and scrapes`) checks both sides.

The first version of the gate missed these results because it only counted results with `level: "error"`, and CodeQL leaves `level` unset for most rules. The gate now counts every result.

### Full scan on `main` (after #20): stored XSS in the PWA, fixed in PR #23

The pipeline on `main` turned red at SAST although every PR had been green. For pull requests, CodeQL reports only results on **changed lines** (diff-informed analysis); the push to `main` scans everything and found code from the original app:

| Rule | Location | Problem | Fix |
|---|---|---|---|
| `js/xss-through-dom` | `app.js:206`, `:207`, `:208` (`view.innerHTML = renderToday()/renderMonth()/renderBudget()`) | the **currency** typed in Settings is stored, synced to every device with the same key, and inserted into `innerHTML` by `money()`. `<img src=x onerror=…>` as a currency would run on all those devices | `cur()` drops `& < > " ' \``: one place covers every sink, and values arriving by sync from older devices. (Escaping in `money()` would double-escape the toasts, which already escape their text.) |
| `js/xss-through-dom` | `app.js:209` via `app.js:690` | synced `tierBudgets` values were written into `value="…"` unescaped; the server does not inspect record data, so a crafted value could close the attribute | `esc()` like the other fields |

The SAST job now disables diff-informed analysis, so a PR is gated on exactly the same full analysis as `main`.

### Current state: 0 findings (full scan)

## DAST: OWASP ZAP API scan

| | |
|---|---|
| Tool | OWASP ZAP (`ghcr.io/zaproxy/zaproxy:stable`), `zap-api-scan.py` |
| Target | the service **deployed in the kind cluster** of the same pipeline run, through its NodePort (`http://localhost:30080`) |
| Input | [openapi.yaml](../../openapi.yaml); requests are authenticated with a random sync key (`ZAP_AUTH_HEADER_VALUE`) |
| What it does | spiders the API from the spec, passive scan of every response, then an active scan (SQL/NoSQL/command/template injection, path traversal, XSS, SSRF, …) |
| Gate | any **High** risk alert fails the job; the alert list goes to the job summary |
| Note | the rate limit is raised for the scan (`kubectl set env … RATE_LIMIT_PER_MIN=100000`) so attack requests reach the handlers instead of stopping at 429 |

### Results: 0 High, 0 Medium, 1 Low, 2 Informational (119 rules passed)

| Risk | Alert | Where | Assessment |
|---|---|---|---|
| Low | Unexpected Content-Type was returned (100001) | `GET /` | Expected: the root serves the PWA (`text/html`), while an API scan expects JSON everywhere. Accepted. |
| Informational | A Client Error response code was returned (100000) | ZAP's probes of unknown paths and invalid payloads | Expected: invalid input gets 400/401/404/413, never 500. This is the validation working. |
| Informational | Non-Storable Content (10049) | `/api/health`, `/api/sync` | Intended: API responses send `Cache-Control: no-store` so sync data never lands in a shared cache. |

No 5xx was produced by any attack payload. Full reports: [zap-report.html](zap-report.html) (open in a browser), [zap-report.md](zap-report.md).

## Dependency audit

`npm audit --omit=dev --audit-level=high` in the *Build & test* job: **0 vulnerabilities** in production dependencies.

## Reproduce locally

```sh
# SAST: open the Security tab, or download the codeql-sarif artifact of a run.

# DAST against the kind deployment (see README, "Kubernetes"):
kubectl --context kind-spendly -n spendly set env deploy/spendly RATE_LIMIT_PER_MIN=100000
mkdir -p zap && cp openapi.yaml zap/
docker run --rm -v "$PWD/zap:/zap/wrk:rw" -e ZAP_AUTH_HEADER_VALUE="Bearer $(openssl rand -hex 20)" \
  ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py -t openapi.yaml -f openapi \
  -O http://host.docker.internal:30080 -r zap-report.html -J zap-report.json -w zap-report.md -I
# Linux: use --network host and -O http://localhost:30080 instead of host.docker.internal
```

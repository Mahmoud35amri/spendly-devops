# Presentation plan (~10 minutes + Q&A)

Goal: show that the whole chain works (code → pipeline → image → cluster → observability → security) and explain the decisions behind it. Keep the slides light and spend the time on the demo.

## Before you present

```sh
# 10 minutes before: start everything so nothing downloads on stage
docker compose up -d --build                           # app :3000, Grafana :3001, Prometheus :9090, Jaeger :16686
kind create cluster --config k8s/kind-config.yaml      # skip if the cluster already exists
docker build -t ghcr.io/mahmoud35amri/spendly-devops:latest .
kind load docker-image ghcr.io/mahmoud35amri/spendly-devops:latest --name spendly
kubectl --context kind-spendly apply -k k8s
node scripts/traffic.js http://localhost:3000 600 &    # keeps the dashboard alive
```

Open these tabs: the GitHub repo (Issues, Pull requests, Actions), the latest CI run, Grafana `http://localhost:3001`, Jaeger `http://localhost:16686`, the app `http://localhost:30080`, and the ZAP report from the run artifacts.

## Timeline

| Time | Slide / screen | What to say |
|---|---|---|
| 0:00 | **Title**: Spendly, DevOps end to end | One sentence: an offline-first expense tracker whose sync API I ported to Node, then built, tested, scanned, containerized, deployed and observed automatically. |
| 0:45 | **The app and the API** | PWA on the phone, changes queue offline, `POST /api/sync` pushes and pulls with a cursor, newest edit wins. 123 lines of API code (CI enforces < 150). Ported from Cloudflare Pages Functions because that runtime cannot run in Docker/K8s or expose metrics. |
| 1:45 | **Architecture diagram** (from the README) | Device → Service (NodePort) → pod (Express + SQLite on a PVC) → Jaeger; Prometheus scrapes `/metrics`; Grafana reads Prometheus. |
| 2:30 | **GitHub workflow**: Issues tab, then a PR | One issue per task (#8–#14), one PR per issue with *Closes #n*, CI must be green before merge, peer review on PR #… |
| 3:30 | **Pipeline**: Actions run graph | `Build & test` ∥ `SAST` → `Docker image` → `Deploy to kind` + `DAST`. Show the job summary: size guard, CodeQL count, ZAP alert list, published image tag. |
| 4:30 | **Demo: Kubernetes** | `kubectl --context kind-spendly -n spendly get pods,svc,pvc`; open the app on `:30080`, add an expense; `kubectl delete pod -l app=spendly` and show the data survives (PVC). |
| 6:00 | **Demo: observability** | Grafana dashboard (rate, p95, errors, records synced). `docker compose logs app \| tail -3`: copy a `trace_id`, paste it in Jaeger, show the span tree down to `sync.transaction`. |
| 7:30 | **Security** | CodeQL (Security tab, gate on error-level). ZAP API scan of the deployed service (gate on High). App controls: key checked before parsing, validation, helmet/CSP, rate limit, log allowlist. Pod: restricted, non-root, read-only FS. |
| 8:45 | **Lessons learned** | 3 points from the report (rate limit vs. probes, Jaeger v2 API change, SQLite = 1 replica). |
| 9:30 | **What I would do next** | Postgres to scale out, Helm/Argo CD to a cloud cluster, Prometheus Operator + alerts, image signing (cosign) and digest pinning. |

## Q&A preparation

**Why port the API instead of keeping Cloudflare?**
Workers/Pages Functions run on Cloudflare's own runtime: no container image, no Kubernetes, no Prometheus endpoint. The port keeps the contract (same routes, JSON, status codes), so the PWA and the widget did not change. The SQL is unchanged because D1 is SQLite.

**Why SQLite and only one replica?**
It was the database of the original (D1). One file means one writer, and the PVC is ReadWriteOnce, hence `replicas: 1` and `strategy: Recreate`. Scaling out needs a client-server database (Postgres). The sync SQL is standard upsert, so the move is small.

**How does sync stay consistent?**
In one transaction: reserve n revision numbers (`INSERT … ON CONFLICT … RETURNING rev`), upsert every change with its own revision, but only replace a record if the incoming `updatedAt` is newer (last write wins). Clients pull everything with `rev > cursor`, 1000 at a time.

**How is the sync key protected?**
Only its SHA-256 hash is stored (the vault id). It is checked before the body is parsed. Logs use an allowlist of fields, so the `Authorization` header is never written. A test checks the key format; CORS only allows known origins.

**Difference between liveness and readiness probes? Why the same endpoint?**
Readiness removes the pod from the Service; liveness restarts it. Both use `/api/health`, which also queries SQLite: if the database file is unusable, restarting is the right fix. Liveness has an initial delay and 3 failures before restart.

**Why did you move the rate limit?**
With a NodePort, kube-proxy rewrites the source IP to the node's address, the same address the kubelet probes from. A busy client (or the DAST scan) would push the probes into 429s and the pod would leave the Service. The limiter covers every route but skips `/api/health` and `/metrics`, and a test checks both sides. (CodeQL also flagged the first version, where the PWA file routes had no limit at all.)

**What do the metrics tell you, and why label by route template?**
Request rate, errors and latency (the RED method) per route and status, plus records synced. Labelling by `req.url` would create one time series per id or query string and blow up Prometheus memory; the route template keeps it bounded.

**How do logs and traces connect?**
The OpenTelemetry pino instrumentation adds `trace_id`/`span_id` to every log line. Search the trace id in Jaeger to see the request's spans; the manual `sync.transaction` span shows time spent in SQLite.

**What does SAST find vs DAST?**
SAST (CodeQL) reads the code without running it: injection, path traversal, unsafe regex, missing rate limit… DAST (ZAP) attacks the running service through its OpenAPI spec: missing headers, error leaks, injection by fuzzing. They catch different classes of bugs, which is why the pipeline runs both.

**Why is the pipeline allowed to fail on High DAST alerts only?**
Medium/Low alerts on an HTTP-only local deployment are often informational (e.g. no HTTPS). They are listed in the job summary and reviewed; High risk blocks the merge.

**How do you make sure the cluster runs the tested image?**
The image job saves the exact image it built; the deploy job loads it into kind and pins the kustomization to `sha-<commit>`. On `main` the same tag is pushed to GHCR.

**What would change for a cloud deployment?**
A managed cluster (GKE/EKS/AKS), an Ingress with TLS, the image pulled from GHCR by digest, secrets from the cloud secret manager, a managed Postgres, and a GitOps tool (Argo CD) applying the manifests.

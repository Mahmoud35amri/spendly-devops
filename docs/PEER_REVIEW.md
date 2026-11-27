# Peer review guide

The project requires at least one **peer review exchange** with a classmate: you review one of their pull requests, and they review one of yours. The grade looks at **the feedback you give**, so a good review matters more than a quick "LGTM".

## 1. Set up the exchange

**Ask for a review on your PR**

1. Add your classmate as a collaborator: *Settings → Collaborators → Add people* (they can comment without it, but they need it to appear in the *Reviewers* list).
2. Open a PR (or pick an open one) and click *Reviewers → ⚙ → your classmate*. From the terminal:
   ```sh
   gh pr edit <number> --add-reviewer <classmate-username>
   ```
3. Reply to every comment. Push a fix or explain why you keep the code as it is. Resolve the thread once it is settled.

**Review their PR**

1. Open the PR → *Files changed*.
2. Comment on lines (click the `+` next to a line). Use *Add single comment* for small notes, or *Start a review* to group several.
3. Finish with *Review changes* and pick one: *Comment*, *Approve* or *Request changes*, plus a summary.

## 2. What to look at

| Area | Questions |
|---|---|
| Correctness | Does it do what the issue asks? Edge cases: empty input, wrong types, huge payloads, concurrent requests? |
| Tests | Is the new behaviour tested? Would the tests fail if the code were broken? |
| Security | Input validated at the boundary? Secrets out of code, logs and images? Errors that leak internals? |
| DevOps | Does CI cover the change? Does the Dockerfile copy only what it needs? Do probes, limits and image tags make sense? |
| Observability | Are failures visible in logs and metrics? Are metric labels bounded (no ids or raw URLs)? |
| Readability | Clear names? Comments that explain *why*? Dead code? |
| Docs | README and API docs updated? |

## 3. How to write a comment

A useful comment names a **specific location**, the **issue**, **why it matters**, and a **suggestion**. Label it so the author knows how much weight to give it:

- **blocking**: must be fixed before merge (bug, security hole, broken build)
- **suggestion**: would improve the code, author decides
- **question**: you want to understand a choice
- **nit**: tiny style point
- **praise**: something done well (say it, it is feedback too)

### Examples

> **blocking**: `server/app.js` L58: the sync key is hashed before the body is parsed, good. But the `Authorization` header is also logged by `pino-http` by default, so every sync key would end up in the logs. Could you log an allowlist of request fields instead? (`serializers.req`)

> **suggestion**: `Dockerfile` L1: `node:24-alpine` follows the latest 24.x. Pinning the digest (`node:24-alpine@sha256:...`) would make builds reproducible, and Dependabot can keep it updated.

> **question**: `k8s/app.yaml`: why `strategy: Recreate` instead of the default rolling update? (Answer I'd expect: SQLite on a ReadWriteOnce volume, so two pods cannot run at the same time. Worth a comment in the manifest.)

> **nit**: `scripts/traffic.js` L30: `700` is a magic number; a named constant like `PAUSE_MS` would explain the rate-limit reasoning.

> **praise**: Labelling metrics with the route template instead of `req.url` keeps cardinality bounded. Nice catch.

### Avoid

- "This is wrong." → say what is wrong and why.
- "Why didn't you use X?" → "Would X work here? It would give us Y."
- Rewriting their design in comments. Focus on problems, not taste.
- Commenting only on style while missing a bug.

## 4. Summary comment template

```markdown
Thanks! I reviewed <scope>, ran it locally with `<command>` and it works.

**Must fix**
- ...

**Suggestions**
- ...

**Questions**
- ...

**What I liked**
- ...
```

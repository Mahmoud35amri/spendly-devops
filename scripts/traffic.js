// Generates realistic traffic for the dashboard, logs and traces: two devices sharing one vault,
// plus a few rejected requests (bad key, invalid change) so errors show up too.
// Usage: node scripts/traffic.js [baseUrl=http://localhost:3000] [seconds=60]
const crypto = require('node:crypto');

const base = process.argv[2] ?? 'http://localhost:3000';
const seconds = Number(process.argv[3] ?? 60);
const key = crypto.randomBytes(24).toString('base64url');
const post = (body, k = key) => fetch(`${base}/api/sync`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k}` },
  body: JSON.stringify(body),
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const cursors = [0, 0];
  const statuses = {};
  const count = (res) => { statuses[res.status] = (statuses[res.status] ?? 0) + 1; return res; };
  const end = Date.now() + seconds * 1000;
  for (let round = 0; Date.now() < end; round++) {
    const device = round % 2;
    const changes = Array.from({ length: 1 + (round % 4) }, (_, i) => ({
      kind: 'expense', id: `e${round}-${i}`, updatedAt: Date.now(),
      data: { amount: Number((Math.random() * 40).toFixed(3)), cat: ['coffee', 'groceries', 'fuel'][i % 3] },
    }));
    const res = count(await post({ since: cursors[device], changes }));
    if (res.ok) cursors[device] = (await res.json()).cursor;
    if (round % 10 === 0) count(await post({}, 'not-a-valid-key'));
    if (round % 15 === 0) count(await post({ changes: [{ kind: 'unknown', id: 'x', updatedAt: 1 }] }));
    if (round % 5 === 0) count(await fetch(`${base}/`));
    await sleep(700); // stays under the 120 requests/minute rate limit
  }
  console.log(`traffic to ${base} done, responses by status:`, statuses);
}

main().catch((err) => { console.error(err.message); process.exit(1); });

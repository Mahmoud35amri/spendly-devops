const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PAGE = 1000;
const file = process.env.DB_PATH ?? path.join(__dirname, '..', 'data', 'spendly.db');
if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new DatabaseSync(file);
db.exec(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));

// Creates the vault on first use and reserves n revision numbers; returns the new head revision.
const reserve = db.prepare(`INSERT INTO vaults (vault, rev, created_at) VALUES (?1, ?2, ?3)
  ON CONFLICT (vault) DO UPDATE SET rev = rev + ?2 RETURNING rev`);
// Gives each change its own revision; an existing record is only replaced by a newer edit (last write wins).
const upsert = db.prepare(`INSERT INTO records (vault, kind, id, data, deleted, updated_at, rev)
  SELECT ?1, json_extract(value, '$.kind'), json_extract(value, '$.id'), json_extract(value, '$.data'),
         json_extract(value, '$.deleted'), json_extract(value, '$.updatedAt'), ?3 - (?4 - 1 - key)
  FROM json_each(?2) WHERE true
  ON CONFLICT (vault, kind, id) DO UPDATE SET
    data = excluded.data, deleted = excluded.deleted, updated_at = excluded.updated_at, rev = excluded.rev
  WHERE excluded.updated_at > records.updated_at`);
const pull = db.prepare('SELECT kind, id, data, deleted, updated_at, rev FROM records WHERE vault = ? AND rev > ? ORDER BY rev LIMIT ?');

// Same algorithm as the original D1 function, in one transaction: reserve, upsert, read what changed after `since`.
function sync(vault, changes, since) {
  let head, rows;
  db.exec('BEGIN IMMEDIATE');
  try {
    head = reserve.get(vault, changes.length, Date.now()).rev;
    if (changes.length) upsert.run(vault, JSON.stringify(changes), head, changes.length);
    rows = pull.all(vault, since > head ? 0 : since, PAGE + 1); // cursor from an older database: resend all
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  const page = rows.slice(0, PAGE);
  return {
    cursor: rows.length > PAGE ? page[page.length - 1].rev : head,
    more: rows.length > PAGE,
    records: page.map((r) => ({
      kind: r.kind, id: r.id, deleted: !!r.deleted, updatedAt: r.updated_at, rev: r.rev,
      data: r.data ? JSON.parse(r.data) : null,
    })),
  };
}

const known = (vault) => db.prepare('SELECT 1 FROM vaults WHERE vault = ?').get(vault) !== undefined;
const healthy = () => { try { db.prepare('SELECT 1 FROM vaults LIMIT 1').all(); return true; } catch { return false; } };

module.exports = { db, sync, known, healthy };

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../src/db/database');
const { applyMigrations } = require('../src/db/migrations');

function temporaryDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'linkedin-sqlite-'));
  return {
    directory,
    file: path.join(directory, 'jobs.db'),
  };
}

test('creates the schema and SQLite settings in an empty database', (t) => {
  const temporary = temporaryDatabase();
  const db = createDatabase(temporary.file);
  t.after(() => db.close());
  t.after(() => fs.rmSync(temporary.directory, { recursive: true, force: true }));

  assert.equal(db.pragma('user_version', { simple: true }), 1);
  assert.equal(db.pragma('journal_mode', { simple: true }), 'wal');
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
  assert.equal(db.pragma('busy_timeout', { simple: true }), 5000);

  const columns = db.prepare('PRAGMA table_info(jobs)').all();
  assert.deepEqual(
    columns.map((column) => column.name),
    [
      'job_id',
      'title',
      'company',
      'query_location',
      'job_location',
      'description',
      'application_type',
      'application_type_raw',
      'url',
      'external_url',
      'first_seen_at',
      'last_seen_at',
      'extracted_at',
    ]
  );
});

test('migration re-execution is idempotent', (t) => {
  const temporary = temporaryDatabase();
  const db = createDatabase(temporary.file);
  t.after(() => db.close());
  t.after(() => fs.rmSync(temporary.directory, { recursive: true, force: true }));

  assert.equal(applyMigrations(db), 1);
  assert.equal(
    db
      .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'jobs'")
      .get().count,
    1
  );
  assert.equal(db.pragma('user_version', { simple: true }), 1);
});

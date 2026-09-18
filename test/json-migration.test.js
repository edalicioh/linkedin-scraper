const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../src/db/database');
const { createJobRepository } = require('../src/repositories/jobRepository');
const { migrateJson } = require('../scripts/migrate-json');

function record(jobId, overrides = {}) {
  return {
    jobId,
    title: `Job ${jobId}`,
    company: 'Example',
    description: 'Description',
    type: 'Easy Apply',
    url: `https://www.linkedin.com/jobs/view/${jobId}`,
    extractionDate: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('imports all historical paths, reports invalid records, creates backups, and is repeatable', (t) => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'linkedin-json-'));
  const dbPath = path.join(projectRoot, 'storage', 'jobs.db');
  fs.mkdirSync(path.join(projectRoot, 'storage'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'src', 'storage'), { recursive: true });

  const rootFile = path.join(projectRoot, 'vagas.json');
  const storageFile = path.join(projectRoot, 'storage', 'vagas.json');
  const oldStorageFile = path.join(projectRoot, 'src', 'storage', 'vagas.json');
  const rootData = [record('1'), record('invalid', { url: null })];
  const storageData = [record('1', { title: 'Updated title' }), record('2')];
  fs.writeFileSync(rootFile, JSON.stringify(rootData));
  fs.writeFileSync(storageFile, JSON.stringify(storageData));
  fs.writeFileSync(oldStorageFile, '{not valid json');
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));

  const firstReport = migrateJson({ projectRoot, dbPath });
  assert.equal(firstReport.imported, 3);
  assert.equal(firstReport.duplicates, 1);
  assert.equal(firstReport.rejected.length, 2);
  assert.equal(firstReport.files.length, 3);
  assert.equal(fs.existsSync(`${rootFile}.bak`), true);
  assert.equal(fs.existsSync(`${storageFile}.bak`), true);
  assert.equal(fs.existsSync(`${oldStorageFile}.bak`), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(rootFile, 'utf8')), rootData);

  const db = createDatabase(dbPath);
  const repository = createJobRepository(db);
  assert.equal(repository.listAll().length, 2);
  assert.equal(repository.getById('1').title, 'Updated title');
  db.close();

  const secondReport = migrateJson({ projectRoot, dbPath });
  assert.equal(secondReport.imported, 3);
  assert.equal(secondReport.duplicates, 3);
});

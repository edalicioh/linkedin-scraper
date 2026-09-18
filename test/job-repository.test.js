const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../src/db/database');
const { createJobRepository } = require('../src/repositories/jobRepository');

function repositoryFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'linkedin-repository-'));
  const db = createDatabase(path.join(directory, 'jobs.db'));
  t.after(() => {
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return createJobRepository(db);
}

function job(overrides = {}) {
  return {
    jobId: '100',
    title: 'Backend developer',
    company: 'Example',
    description: 'Build things',
    type: 'Easy Apply',
    url: 'https://www.linkedin.com/jobs/view/100',
    externalUrl: null,
    extractionDate: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

test('upsert preserves first_seen_at and updates mutable fields', (t) => {
  const repository = repositoryFixture(t);

  repository.upsert(job({ firstSeenAt: '2025-01-01T00:00:00.000Z' }));
  const updated = repository.upsert(job({
    title: 'Senior backend developer',
    company: 'Updated Example',
    description: 'Updated description',
    extractionDate: '2026-02-01T00:00:00.000Z'
  }));

  assert.equal(repository.listAll().length, 1);
  assert.equal(updated.title, 'Senior backend developer');
  assert.equal(updated.company, 'Updated Example');
  assert.equal(updated.firstSeenAt, '2025-01-01T00:00:00.000Z');
  assert.equal(updated.lastSeenAt, '2026-02-01T00:00:00.000Z');
  assert.equal(updated.description, 'Updated description');
});

test('findExistingIds, getById and duplicate upserts use job_id identity', (t) => {
  const repository = repositoryFixture(t);
  repository.upsert(job());
  repository.upsert(job({ title: 'Same job again' }));
  repository.upsert(job({ jobId: '200', url: 'https://www.linkedin.com/jobs/view/200' }));

  assert.deepEqual(repository.findExistingIds(['100', '200', 'missing']), new Set(['100', '200']));
  assert.equal(repository.getById('100').title, 'Same job again');
  assert.equal(repository.listAll().length, 2);
});

test('upsertMany rolls back the complete batch after a validation failure', (t) => {
  const repository = repositoryFixture(t);

  assert.throws(() => repository.upsertMany([
    job({ jobId: 'valid' }),
    job({ jobId: 'invalid', url: null })
  ]), /must have a url/);
  assert.deepEqual(repository.listAll(), []);
});

test('missing values become NULL instead of creating new N/A values', (t) => {
  const repository = repositoryFixture(t);
  const saved = repository.upsert(job({ company: 'N/A', description: '', type: 'N/A' }));

  assert.equal(saved.company, null);
  assert.equal(saved.description, null);
  assert.equal(saved.type, null);
  assert.equal(saved.applicationTypeRaw, null);
});

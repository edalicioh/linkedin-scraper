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
    jobLocation: 'São Paulo, SP',
    description: 'Build things',
    type: 'Easy Apply',
    url: 'https://www.linkedin.com/jobs/view/100',
    externalUrl: null,
    aiIsPj: true,
    aiIsRemote: true,
    aiScore: 80,
    extractionDate: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('upsert preserves first_seen_at and updates mutable fields', (t) => {
  const repository = repositoryFixture(t);

  repository.upsert(job({ firstSeenAt: '2025-01-01T00:00:00.000Z' }));
  const updated = repository.upsert(
    job({
      title: 'Senior backend developer',
      company: 'Updated Example',
      description: 'Updated description',
      extractionDate: '2026-02-01T00:00:00.000Z',
    })
  );

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

test('findIncompleteIds identifies jobs missing title or description', (t) => {
  const repository = repositoryFixture(t);
  repository.upsert(job({ jobId: 'complete' }));
  repository.upsert(job({ jobId: 'missing-title', title: null }));
  repository.upsert(job({ jobId: 'missing-description', description: null }));

  assert.deepEqual(
    repository.findIncompleteIds(['complete', 'missing-title', 'missing-description']),
    new Set(['missing-title', 'missing-description'])
  );
});

test('upsertMany rolls back the complete batch after a validation failure', (t) => {
  const repository = repositoryFixture(t);

  assert.throws(
    () => repository.upsertMany([job({ jobId: 'valid' }), job({ jobId: 'invalid', url: null })]),
    /must have a url/
  );
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

test('persiste a classificação e a pontuação da IA', (t) => {
  const repository = repositoryFixture(t);
  const saved = repository.upsert(
    job({
      aiIsPj: true,
      aiIsRemote: true,
      aiScore: 88,
      aiSummary: 'Boa aderência',
      aiEvidence: { pj: 'PJ', remote: 'Remoto' },
      aiCriteria: { technicalFit: { score: 90 } },
      aiModel: 'local-model',
      aiProfileVersion: 'v1',
      aiScoredAt: '2026-01-01T00:00:00.000Z',
    })
  );

  assert.equal(saved.ai.score, 88);
  assert.equal(saved.ai.isPJ, true);
  assert.equal(saved.ai.isRemote, true);
  assert.deepEqual(saved.ai.evidence, { pj: 'PJ', remote: 'Remoto' });
});

test('queryJobs ordena por ai_score decrescente por padrão e coloca vagas sem score por último', (t) => {
  const repository = repositoryFixture(t);
  repository.upsert(job({ jobId: 'j1', aiScore: 50, extractionDate: '2026-01-01T00:00:00.000Z' }));
  repository.upsert(job({ jobId: 'j2', aiScore: 90, extractionDate: '2026-01-02T00:00:00.000Z' }));
  repository.upsert(job({ jobId: 'j3', aiScore: null, extractionDate: '2026-01-03T00:00:00.000Z' }));
  repository.upsert(job({ jobId: 'j4', aiScore: 75, extractionDate: '2026-01-04T00:00:00.000Z' }));

  const defaultResult = repository.queryJobs();
  assert.deepEqual(
    defaultResult.items.map((item) => item.jobId),
    ['j2', 'j4', 'j1', 'j3']
  );

  const dateResult = repository.queryJobs({ sort: 'date' });
  assert.deepEqual(
    dateResult.items.map((item) => item.jobId),
    ['j4', 'j3', 'j2', 'j1']
  );

  const minScoreResult = repository.queryJobs({ minScore: 70 });
  assert.deepEqual(
    minScoreResult.items.map((item) => item.jobId),
    ['j2', 'j4']
  );
});


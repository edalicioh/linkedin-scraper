const assert = require('node:assert/strict');
const fs = require('node:fs').promises;
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  JobQueryValidationError,
  createJobQueryService,
  parseJobQuery,
} = require('../src/services/jobQueryService');
const { createJsonJobQueryProvider } = require('../src/repositories/jsonJobQueryProvider');

test('parses defaults, trims filters, and delegates normalized values', async () => {
  const received = [];
  const service = createJobQueryService({
    async queryJobs(query) {
      received.push(query);
      return { items: [{ jobId: '1' }], total: 1 };
    },
  });

  const result = await service({ search: ' engineer ', company: ' Acme ' });

  assert.deepEqual(received, [{
    page: DEFAULT_PAGE,
    limit: DEFAULT_LIMIT,
    search: 'engineer',
    type: undefined,
    company: 'Acme',
    location: undefined,
  }]);
  assert.deepEqual(result, {
    items: [{ jobId: '1' }],
    page: DEFAULT_PAGE,
    limit: DEFAULT_LIMIT,
    total: 1,
  });
});

test('rejects invalid and excessive pagination values', () => {
  assert.deepEqual(parseJobQuery({ page: '2', limit: String(MAX_LIMIT) }).page, 2);
  assert.throws(() => parseJobQuery({ page: '0' }), JobQueryValidationError);
  assert.throws(() => parseJobQuery({ page: '1.5' }), JobQueryValidationError);
  assert.throws(() => parseJobQuery({ limit: String(MAX_LIMIT + 1) }), JobQueryValidationError);
});

test('filters combined JSON jobs and sorts deterministically before pagination', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'job-query-'));
  const filePath = path.join(directory, 'vagas.json');
  const jobs = [
    {
      jobId: '2',
      title: 'Senior Engineer',
      company: 'Acme Labs',
      type: 'Full-time',
      location: 'Sao Paulo',
      extractionDate: '2026-01-01T00:00:00.000Z',
    },
    {
      jobId: '10',
      title: 'Senior Engineer',
      company: 'Acme Labs',
      type: 'Full-time',
      location: 'Sao Paulo',
      extractionDate: '2026-01-01T00:00:00.000Z',
    },
    {
      jobId: '3',
      title: 'Senior Engineer',
      company: 'Acme Labs',
      type: 'Full-time',
      location: 'Sao Paulo',
      extractionDate: '2026-02-01T00:00:00.000Z',
    },
    {
      jobId: '4',
      title: 'Senior Engineer',
      company: 'Other Company',
      type: 'Full-time',
      location: 'Sao Paulo',
      extractionDate: '2026-03-01T00:00:00.000Z',
    },
    {
      jobId: '5',
      title: 'Designer',
      company: 'Acme Labs',
      type: 'Contract',
      location: 'Rio de Janeiro',
    },
  ];

  await fs.writeFile(filePath, JSON.stringify(jobs));

  try {
    const service = createJobQueryService(createJsonJobQueryProvider({ filePath }));
    const firstPage = await service({
      page: '1',
      limit: '2',
      search: 'ENGINEER',
      type: 'full-time',
      company: 'acme',
      location: 'sao',
    });
    const secondPage = await service({
      page: '2',
      limit: '2',
      search: 'engineer',
      type: 'FULL-TIME',
      company: 'ACME',
      location: 'SAO',
    });

    assert.deepEqual(firstPage.items.map(job => job.jobId), ['3', '10']);
    assert.deepEqual(secondPage.items.map(job => job.jobId), ['2']);
    assert.equal(firstPage.total, 3);
    assert.equal(secondPage.total, 3);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('returns an empty page for a missing JSON source', async () => {
  const service = createJobQueryService(createJsonJobQueryProvider({
    filePath: path.join(os.tmpdir(), 'jobs-file-that-does-not-exist.json'),
  }));

  assert.deepEqual(await service({}), {
    items: [],
    page: 1,
    limit: DEFAULT_LIMIT,
    total: 0,
  });
});

test('returns an empty page for an empty JSON source', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'empty-job-query-'));
  const filePath = path.join(directory, 'vagas.json');
  await fs.writeFile(filePath, '  \n');

  try {
    const service = createJobQueryService(createJsonJobQueryProvider(filePath));
    assert.deepEqual(await service({}), {
      items: [],
      page: 1,
      limit: DEFAULT_LIMIT,
      total: 0,
    });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

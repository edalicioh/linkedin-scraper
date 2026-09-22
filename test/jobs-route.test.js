const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const test = require('node:test');

const { createJobRouter } = require('../src/routes/jobRoutes');

async function request(router, path, options = {}) {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, options);
    return {
      status: response.status,
      body: await response.json(),
    };
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

test('GET /api/jobs returns the paginated provider contract', async () => {
  const calls = [];
  const response = await request(
    createJobRouter({
      provider: {
        async queryJobs(query) {
          calls.push(query);
          return { items: [{ jobId: 'job-2' }], total: 3 };
        },
      },
    }),
    '/api/jobs?page=2&limit=10&search=engineer&company=Acme'
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    items: [{ jobId: 'job-2' }],
    page: 2,
    limit: 10,
    total: 3,
  });
  assert.deepEqual(calls, [
    {
      page: 2,
      limit: 10,
      search: 'engineer',
      type: undefined,
      company: 'Acme',
      location: undefined,
    },
  ]);
});

test('GET /api/jobs returns a JSON 400 for invalid query parameters', async () => {
  let called = false;
  const response = await request(
    createJobRouter({
      provider: {
        async queryJobs() {
          called = true;
          return { items: [], total: 0 };
        },
      },
    }),
    '/api/jobs?limit=101'
  );

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_QUERY');
  assert.equal(called, false);
});

test('GET /api/jobs returns a JSON 500 when the provider cannot read', async () => {
  const response = await request(
    createJobRouter({
      provider: {
        async queryJobs() {
          throw new Error('disk failure');
        },
      },
    }),
    '/api/jobs'
  );

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    error: {
      code: 'JOBS_READ_FAILED',
      message: 'Falha ao consultar os jobs.',
    },
  });
});

test('PATCH /api/jobs/:jobId/status updates a job status', async () => {
  const response = await request(
    createJobRouter({
      provider: {
        async queryJobs() {
          return { items: [], total: 0 };
        },
      },
      jobMutationProvider: {
        async updateReviewStatus(jobId, reviewStatus) {
          return { jobId, reviewStatus };
        },
      },
    }),
    '/api/jobs/job-1/status',
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reviewStatus: 'applied' }),
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { jobId: 'job-1', reviewStatus: 'applied' });
});

test('PATCH /api/jobs/:jobId/status validates the status', async () => {
  const response = await request(
    createJobRouter({
      provider: {
        async queryJobs() {
          return { items: [], total: 0 };
        },
      },
      jobMutationProvider: {
        async updateReviewStatus() {
          throw new Error('should not be called');
        },
      },
    }),
    '/api/jobs/job-1/status',
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reviewStatus: 'unknown' }),
    }
  );

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_REVIEW_STATUS');
});

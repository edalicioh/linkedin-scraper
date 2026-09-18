const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const { createJobController } = require('../src/controllers/jobController');
const { createJobRoutes } = require('../src/routes/jobRoutes');

function startTestServer(controller) {
  const app = express();
  app.use(express.json());
  app.use('/api', createJobRoutes(controller));
  const server = http.createServer(app);

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

test('POST returns a task id immediately and GET exposes its status', async t => {
  let release;
  const controller = createJobController({
    runner: () => new Promise(resolve => {
      release = resolve;
    }),
  });
  const { server, baseUrl } = await startTestServer(controller);
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/scrape`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ keywords: '  node.js  ', location: '  Brasil ' }),
  });
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.match(body.taskId, /^[0-9a-f-]{36}$/);
  assert.equal(body.statusUrl, `/api/scrape/${body.taskId}`);
  assert.equal(body.keywords, 'node.js');
  assert.equal(body.location, 'Brasil');

  const statusResponse = await fetch(`${baseUrl}${body.statusUrl}`);
  const status = await statusResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(status.id, body.taskId);
  assert.equal(status.input.keywords, 'node.js');
  assert.equal(status.status, 'RUNNING');

  release();
  await controller.queue.waitForIdle();
  const completedResponse = await fetch(`${baseUrl}${body.statusUrl}`);
  const completed = await completedResponse.json();
  assert.equal(completed.status, 'COMPLETED');
});

test('returns 429 for a full queue and 404 for an unknown task', async t => {
  let release;
  const controller = createJobController({
    maxBacklog: 1,
    runner: () => new Promise(resolve => {
      release = resolve;
    }),
  });
  const { server, baseUrl } = await startTestServer(controller);
  t.after(() => server.close());

  const request = () => fetch(`${baseUrl}/api/scrape`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ keywords: 'node', location: 'Brasil' }),
  });

  const first = await request();
  const second = await request();
  const unknown = await fetch(`${baseUrl}/api/scrape/not-a-task`);

  assert.equal(first.status, 202);
  assert.equal(second.status, 429);
  assert.equal(unknown.status, 404);

  release();
  await controller.queue.waitForIdle();
});

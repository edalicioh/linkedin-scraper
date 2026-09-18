const assert = require('node:assert/strict');
const test = require('node:test');

const { createApp } = require('../src/app');

async function withServer(callback) {
  const server = createApp().listen(0);
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await callback(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('GET / returns the API health message', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      message: 'API do Scraper do LinkedIn está rodando!',
    });
  });
});

test('POST /api/scrape validates required fields', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/scrape`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keywords: 'node.js' }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'Parâmetros "keywords" e "location" são obrigatórios.',
    });
  });
});

test('GET /api/jobs returns an empty paginated result without scraping', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/jobs`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      items: [],
      page: 1,
      limit: 25,
      total: 0,
    });
  });
});

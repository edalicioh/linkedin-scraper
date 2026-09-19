const assert = require('node:assert/strict');
const test = require('node:test');

const { createApp } = require('../src/app');
const { createJobRouter } = require('../src/routes/jobRoutes');

async function withServer(callback, dependencies) {
  const server = createApp(dependencies).listen(0);
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
  const jobRoutes = createJobRouter({
    provider: {
      async queryJobs() {
        return { items: [], total: 0 };
      },
    },
  });

  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/jobs`);

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        items: [],
        page: 1,
        limit: 25,
        total: 0,
      });
    },
    { jobRoutes }
  );
});

test('GET /index.html and /app serve the web interface', async () => {
  await withServer(async (baseUrl) => {
    const indexRes = await fetch(`${baseUrl}/index.html`);
    assert.equal(indexRes.status, 200);
    const indexText = await indexRes.text();
    assert.match(indexText, /<title>LinkedIn Jobs - Visualizador de Vagas<\/title>/);

    const appRes = await fetch(`${baseUrl}/app`);
    assert.equal(appRes.status, 200);
    const appText = await appRes.text();
    assert.match(appText, /<title>LinkedIn Jobs - Visualizador de Vagas<\/title>/);
  });
});

test('OPTIONS request returns CORS headers', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/jobs`, {
      method: 'OPTIONS',
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
  });
});

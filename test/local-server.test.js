const assert = require('node:assert/strict');
const test = require('node:test');

const { assertLocalUrl, createLocalServer } = require('./helpers/local-server');

test('servidor de fixtures escuta somente em 127.0.0.1', async () => {
  const server = createLocalServer((_request, response) => {
    response.end('fixture');
  });

  const baseUrl = await server.start();
  try {
    assert.equal(assertLocalUrl(baseUrl).hostname, '127.0.0.1');
    const response = await fetch(`${baseUrl}/login`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'fixture');
    assert.throws(() => assertLocalUrl('https://www.linkedin.com/login'), /URL externa bloqueada/);
  } finally {
    await server.close();
  }
});

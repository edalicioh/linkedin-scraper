const http = require('node:http');

function assertLocalUrl(value) {
  const url = new URL(value);
  if (url.hostname !== '127.0.0.1') {
    throw new Error(`URL externa bloqueada nos testes: ${url.hostname}`);
  }
  return url;
}

function createLocalServer(
  handler = (_request, response) => {
    response.statusCode = 404;
    response.end();
  }
) {
  let server;

  return {
    async start() {
      if (server) return `http://127.0.0.1:${server.address().port}`;

      server = http.createServer(handler);
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      return `http://127.0.0.1:${server.address().port}`;
    },
    async close() {
      if (!server) return;
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      server = null;
    },
  };
}

module.exports = { assertLocalUrl, createLocalServer };

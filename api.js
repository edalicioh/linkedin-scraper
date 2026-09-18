const { createApp } = require('./src/app');
const { closeBrowser } = require('./src/core/browser');

const PORT = process.env.PORT || 3000;

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function createShutdown(server, close = closeBrowser) {
  let shutdownPromise;

  return function shutdown() {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      try {
        await closeServer(server);
      } finally {
        await close();
      }
    })();

    return shutdownPromise;
  };
}

function startServer({
  app = createApp(),
  port = PORT,
  close = closeBrowser,
  processRef = process,
} = {}) {
  const server = app.listen(port, () => {
    console.log(`Servidor API rodando na porta ${port}`);
  });
  const shutdown = createShutdown(server, close);

  processRef.once('SIGINT', shutdown);
  processRef.once('SIGTERM', shutdown);

  return { server, shutdown };
}

if (require.main === module) {
  startServer();
}

module.exports = {
  closeServer,
  createApp,
  createShutdown,
  startServer,
};

const express = require('express');
const { closeBrowser } = require('./src/core/browser');
const jobRoutes = require('./src/routes/jobRoutes');

const PORT = process.env.PORT || 3000;

function createApp() {
  const app = express();

  app.use(express.json());
  app.get('/', (req, res) => {
    res.json({ message: 'API do Scraper do LinkedIn está rodando!' });
  });
  app.use('/api', jobRoutes);

  return app;
}

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
  close: closeBrowserFn = closeBrowser,
  processRef = process
} = {}) {
  const server = app.listen(port, () => {
    console.log(`Servidor API rodando na porta ${port}`);
  });
  const shutdown = createShutdown(server, closeBrowserFn);

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
  startServer
};

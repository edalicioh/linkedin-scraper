const { createApp } = require('./src/app');
const { createJobController } = require('./src/controllers/jobController');
const { createJobRouter } = require('./src/routes/jobRoutes');
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

function createShutdown(server, close = closeBrowser, queue, options = {}) {
  let shutdownPromise;
  const timeoutMs = options.shutdownTimeoutMs ?? 10000;

  return function shutdown() {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      try {
        await closeServer(server);
        if (queue && typeof queue.waitForIdle === 'function') {
          let timeout;
          await Promise.race([
            queue.waitForIdle(),
            new Promise((resolve) => {
              timeout = setTimeout(() => {
                console.error('Tempo limite aguardando a fila no shutdown.');
                resolve();
              }, timeoutMs);
            }),
          ]).finally(() => clearTimeout(timeout));
        }
      } finally {
        await close();
      }
    })();

    return shutdownPromise;
  };
}

function startServer({
  app,
  controller,
  port = PORT,
  close = closeBrowser,
  processRef = process,
  shutdownTimeoutMs = 10000,
} = {}) {
  const runtimeController = controller || createJobController();
  const runtimeApp =
    app ||
    createApp({
      jobRoutes: createJobRouter({ controller: runtimeController }),
    });
  const server = runtimeApp.listen(port, () => {
    console.log(`Servidor API rodando na porta ${port}`);
  });
  const shutdown = createShutdown(server, close, runtimeController.queue, { shutdownTimeoutMs });

  processRef.once('SIGINT', shutdown);
  processRef.once('SIGTERM', shutdown);

  return { server, shutdown, controller: runtimeController, queue: runtimeController.queue };
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

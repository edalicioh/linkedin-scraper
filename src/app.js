const express = require('express');
const defaultJobRoutes = require('./routes/jobRoutes');

/**
 * Creates the HTTP application without opening a listening socket.
 * @param {object} [dependencies] - Optional application dependencies.
 * @param {import('express').Router} [dependencies.jobRoutes] - API routes.
 * @returns {import('express').Express} The configured Express application.
 */
function createApp(dependencies = {}) {
  const app = express();
  const jobRoutes = dependencies.jobRoutes || defaultJobRoutes;

  app.use(express.json());

  app.get('/', (req, res) => {
    res.json({ message: 'API do Scraper do LinkedIn está rodando!' });
  });

  app.use('/api', jobRoutes);

  return app;
}

module.exports = { createApp };

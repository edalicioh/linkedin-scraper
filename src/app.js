const path = require('node:path');
const express = require('express');
const defaultJobRoutes = require('./routes/jobRoutes');

const PUBLIC_DIR = path.join(__dirname, '../public');

/**
 * Creates the HTTP application without opening a listening socket.
 * @param {object} [dependencies] - Optional application dependencies.
 * @param {import('express').Router} [dependencies.jobRoutes] - API routes.
 * @returns {import('express').Express} The configured Express application.
 */
function createApp(dependencies = {}) {
  const app = express();
  const jobRoutes = dependencies.jobRoutes || defaultJobRoutes;

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(express.json());

  app.get('/', (req, res) => {
    res.json({ message: 'API do Scraper do LinkedIn está rodando!' });
  });

  app.get('/app', (req, res) => {
    res.sendFile('index.html', { root: PUBLIC_DIR });
  });

  app.use(express.static(PUBLIC_DIR, { index: false }));

  app.use('/api', jobRoutes);

  return app;
}

module.exports = { createApp };

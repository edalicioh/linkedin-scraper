const { createJobQueryService, JobQueryValidationError } = require('../services/jobQueryService');
const { createJsonJobQueryProvider } = require('../repositories/jsonJobQueryProvider');

function defaultRunScraper(keywords, location) {
  // Load scraper configuration only when the scrape endpoint is called.
  return require('../../scraper').runScraper(keywords, location);
}

function createJobController({ provider, jobQueryProvider, runScraper = defaultRunScraper } = {}) {
  const queryJobs = createJobQueryService(jobQueryProvider || provider || createJsonJobQueryProvider());

  async function startScraping(req, res) {
    const { keywords, location } = req.body || {};

    if (!keywords || !location) {
      return res.status(400).json({ error: 'Parâmetros "keywords" e "location" são obrigatórios.' });
    }

    try {
      // Keep scraping asynchronous so this endpoint continues to return 202.
      runScraper(keywords, location);
      res.status(202).json({ message: 'Processo de scraping iniciado.', keywords, location });
    } catch (error) {
      console.error('Erro ao iniciar o scraping:', error);
      res.status(500).json({ error: 'Falha ao iniciar o processo de scraping.' });
    }
  }

  async function getJobs(req, res) {
    try {
      res.json(await queryJobs(req.query));
    } catch (error) {
      if (error instanceof JobQueryValidationError) {
        return res.status(400).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }

      console.error('Erro ao consultar os jobs:', error);
      return res.status(500).json({
        error: {
          code: 'JOBS_READ_FAILED',
          message: 'Falha ao consultar os jobs.',
        },
      });
    }
  }

  return { startScraping, getJobs };
}

const defaultController = createJobController();

module.exports = {
  ...defaultController,
  createJobController,
};

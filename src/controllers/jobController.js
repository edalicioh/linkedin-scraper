<<<<<<< HEAD
const { createDatabase } = require('../db/database');
const { createJobRepository } = require('../repositories/jobRepository');
const { ScrapeQueue, QueueFullError } = require('../services/scrapeQueue');
const { MemoryTaskStore, normalizeInput } = require('../services/memoryTaskStore');
const { createJobQueryService, JobQueryValidationError } = require('../services/jobQueryService');

function defaultRunner({ keywords, location }) {
  const { runScraper } = require('../../scraper');
  return runScraper(keywords, location);
}

function createSqliteJobQueryProvider(dbPath) {
  return {
    queryJobs(query) {
      const db = createDatabase(dbPath);
      try {
        return createJobRepository(db).queryJobs(query);
      } finally {
        db.close();
      }
    },
  };
}

function createJobController({ queue, store, runner, maxBacklog, provider, jobQueryProvider } = {}) {
  const taskStore = store || (queue && queue.store) || new MemoryTaskStore();
  const scrapeQueue = queue || new ScrapeQueue({
    runner: runner || defaultRunner,
    store: taskStore,
    maxBacklog,
  });
  const queryJobs = createJobQueryService(jobQueryProvider || provider || createSqliteJobQueryProvider());

  async function startScraping(req, res) {
    let input;
    try {
      input = normalizeInput(req.body);
    } catch (error) {
=======
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
>>>>>>> melhoria/fase-06-api-jobs
      return res.status(400).json({ error: 'Parâmetros "keywords" e "location" são obrigatórios.' });
    }

    try {
<<<<<<< HEAD
      const task = scrapeQueue.enqueue(input);
      return res.status(202).json({
        message: 'Processo de scraping enfileirado.',
        taskId: task.id,
        status: task.status,
        statusUrl: `/api/scrape/${task.id}`,
        keywords: task.input.keywords,
        location: task.input.location,
      });
    } catch (error) {
      if (error instanceof QueueFullError || error.code === 'QUEUE_FULL') {
        return res.status(429).json({ error: 'A fila de scraping está cheia.' });
      }

      console.error('Erro ao enfileirar o scraping:', error);
      return res.status(500).json({ error: 'Falha ao iniciar o processo de scraping.' });
    }
  }

  async function getScrapeStatus(req, res) {
    const task = taskStore.get(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Tarefa de scraping não encontrada.' });
    }

    return res.json(task);
  }

  async function getJobs(req, res) {
    try {
      res.json(await queryJobs(req.query));
    } catch (error) {
      if (error instanceof JobQueryValidationError) {
        return res.status(400).json({
          error: { code: error.code, message: error.message },
        });
      }

      console.error('Erro ao consultar os jobs:', error);
      return res.status(500).json({
        error: { code: 'JOBS_READ_FAILED', message: 'Falha ao consultar os jobs.' },
      });
    }
  }

  return { startScraping, getScrapeStatus, getJobs, queue: scrapeQueue, store: taskStore };
=======
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
>>>>>>> melhoria/fase-06-api-jobs
}

const defaultController = createJobController();

module.exports = {
  ...defaultController,
  createJobController,
};

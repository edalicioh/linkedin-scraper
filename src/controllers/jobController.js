const { createDatabase } = require('../db/database');
const { createJobRepository } = require('../repositories/jobRepository');
const { isReviewStatus } = require('../repositories/jobRepository');
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

function createSqliteJobMutationProvider(dbPath) {
  return {
    updateReviewStatus(jobId, reviewStatus) {
      const db = createDatabase(dbPath);
      try {
        return createJobRepository(db).updateReviewStatus(jobId, reviewStatus);
      } finally {
        db.close();
      }
    },
  };
}

function createJobController({
  queue,
  store,
  runner,
  maxBacklog,
  provider,
  jobQueryProvider,
  jobMutationProvider,
} = {}) {
  const taskStore = store || (queue && queue.store) || new MemoryTaskStore();
  const scrapeQueue =
    queue ||
    new ScrapeQueue({
      runner: runner || defaultRunner,
      store: taskStore,
      maxBacklog,
    });
  const queryJobs = createJobQueryService(
    jobQueryProvider || provider || createSqliteJobQueryProvider()
  );
  const mutationProvider = jobMutationProvider || createSqliteJobMutationProvider();
  const updateReviewStatus =
    typeof mutationProvider === 'function'
      ? mutationProvider
      : mutationProvider.updateReviewStatus;

  if (typeof updateReviewStatus !== 'function') {
    throw new TypeError('A job mutation provider is required.');
  }

  async function startScraping(req, res) {
    let input;
    try {
      input = normalizeInput(req.body);
    } catch (error) {
      return res
        .status(400)
        .json({ error: 'Parâmetros "keywords" e "location" são obrigatórios.' });
    }

    try {
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

  async function updateJobStatus(req, res) {
    const reviewStatus = req.body && req.body.reviewStatus;
    if (typeof reviewStatus !== 'string' || !isReviewStatus(reviewStatus)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REVIEW_STATUS',
          message: 'O campo "reviewStatus" deve ser new, seen, applied ou not_for_me.',
        },
      });
    }

    try {
      const job = await updateReviewStatus(req.params.jobId, reviewStatus);
      if (!job) {
        return res.status(404).json({
          error: { code: 'JOB_NOT_FOUND', message: 'Vaga não encontrada.' },
        });
      }
      return res.json(job);
    } catch (error) {
      console.error('Erro ao atualizar o status do job:', error);
      return res.status(500).json({
        error: {
          code: 'JOB_STATUS_UPDATE_FAILED',
          message: 'Falha ao atualizar o status da vaga.',
        },
      });
    }
  }

  return {
    startScraping,
    getScrapeStatus,
    getJobs,
    updateJobStatus,
    queue: scrapeQueue,
    store: taskStore,
  };
}

const defaultController = createJobController();

module.exports = {
  ...defaultController,
  createJobController,
};

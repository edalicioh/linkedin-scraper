const { createDatabase } = require('../db/database');
const { createJobRepository } = require('../repositories/jobRepository');
const { ScrapeQueue, QueueFullError } = require('../services/scrapeQueue');
const { MemoryTaskStore, normalizeInput } = require('../services/memoryTaskStore');

function defaultRunner({ keywords, location }) {
  const { runScraper } = require('../../scraper');
  return runScraper(keywords, location);
}

function createJobController({ queue, store, runner, maxBacklog } = {}) {
  const taskStore = store || (queue && queue.store) || new MemoryTaskStore();
  const scrapeQueue = queue || new ScrapeQueue({
    runner: runner || defaultRunner,
    store: taskStore,
    maxBacklog,
  });

  async function startScraping(req, res) {
    let input;
    try {
      input = normalizeInput(req.body);
    } catch (error) {
      return res.status(400).json({ error: 'Parâmetros "keywords" e "location" são obrigatórios.' });
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
    const db = createDatabase();
    try {
      const repository = createJobRepository(db);
      res.json(repository.listAll());
    } catch (error) {
      console.error('Erro ao consultar os jobs:', error);
      res.status(500).json({ error: 'Falha ao buscar os jobs.' });
    } finally {
      db.close();
    }
  }

  return { startScraping, getScrapeStatus, getJobs, queue: scrapeQueue, store: taskStore };
}

const defaultController = createJobController();

module.exports = {
  ...defaultController,
  createJobController,
};

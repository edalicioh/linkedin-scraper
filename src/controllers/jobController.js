const fs = require('fs').promises;
const path = require('path');
const { ScrapeQueue, QueueFullError } = require('../services/scrapeQueue');
const { MemoryTaskStore, normalizeInput } = require('../services/memoryTaskStore');

function defaultRunner({ keywords, location }) {
    // Load the scraper only when a task is actually consumed by the queue.
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

/**
 * Inicia o processo de scraping com base em keywords e location.
 * @param {Object} req - Objeto de requisição Express.
 * @param {Object} res - Objeto de resposta Express.
 */
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

/**
 * Retorna a lista de jobs coletados.
 * @param {Object} req - Objeto de requisição Express.
 * @param {Object} res - Objeto de resposta Express.
 */
    async function getJobs(req, res) {
        try {
            const vagasPath = path.join(__dirname, '../../storage/vagas.json');
            const data = await fs.readFile(vagasPath, 'utf8');

            // Se o arquivo estiver vazio, retorna um array vazio
            if (!data.trim()) {
                return res.json([]);
            }

            const jobs = JSON.parse(data);
            res.json(jobs);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Arquivo não encontrado
                return res.status(404).json({ message: 'Arquivo de jobs não encontrado. Execute o scraper primeiro.' });
            }

            console.error('Erro ao ler o arquivo de jobs:', error);
            res.status(500).json({ error: 'Falha ao buscar os jobs.' });
        }
    }

    return { startScraping, getScrapeStatus, getJobs, queue: scrapeQueue, store: taskStore };
}

const defaultController = createJobController();

module.exports = {
    ...defaultController,
    createJobController,
};

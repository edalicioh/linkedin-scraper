const { createDatabase } = require('../db/database');
const { createJobRepository } = require('../repositories/jobRepository');

/**
 * Controller para operações relacionadas a jobs.
 */

/**
 * Inicia o processo de scraping com base em keywords e location.
 * @param {Object} req - Objeto de requisição Express.
 * @param {Object} res - Objeto de resposta Express.
 */
async function startScraping(req, res) {
    const { keywords, location } = req.body;

    // Validação básica dos parâmetros
    if (!keywords || !location) {
        return res.status(400).json({ error: 'Parâmetros "keywords" e "location" são obrigatórios.' });
    }

    try {
        // Importa sob demanda para que consultas de jobs não dependam de credenciais.
        const { runScraper } = require('../../scraper');
        // Inicia o scraping em background (não aguarda conclusão)
        void runScraper(keywords, location).catch((error) => {
            console.error('Erro no processo de scraping:', error);
        });
        res.status(202).json({ message: 'Processo de scraping iniciado.', keywords, location });
    } catch (error) {
        console.error('Erro ao iniciar o scraping:', error);
        res.status(500).json({ error: 'Falha ao iniciar o processo de scraping.' });
    }
}

/**
 * Retorna a lista de jobs coletados.
 * @param {Object} req - Objeto de requisição Express.
 * @param {Object} res - Objeto de resposta Express.
 */
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

module.exports = {
    startScraping,
    getJobs
};

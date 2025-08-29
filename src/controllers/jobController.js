const fs = require('fs').promises;
const path = require('path');
const { runScraper } = require('../../scraper'); // Importa a função refatorada

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
        // Inicia o scraping em background (não aguarda conclusão)
        runScraper(keywords, location);
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
    try {
        const vagasPath = path.join(__dirname, '../../vagas.json');
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

module.exports = {
    startScraping,
    getJobs
};
const { createDatabase } = require('../db/database');
const { createJobRepository } = require('../repositories/jobRepository');
const { runScraper } = require('../../scraper');

async function startScraping(req, res) {
  const { keywords, location } = req.body;

  if (!keywords || !location) {
    return res.status(400).json({ error: 'Parâmetros "keywords" e "location" são obrigatórios.' });
  }

  try {
    void runScraper(keywords, location).catch((error) => {
      console.error('Erro durante o scraping em background:', error);
    });
    res.status(202).json({ message: 'Processo de scraping iniciado.', keywords, location });
  } catch (error) {
    console.error('Erro ao iniciar o scraping:', error);
    res.status(500).json({ error: 'Falha ao iniciar o processo de scraping.' });
  }
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

module.exports = {
  startScraping,
  getJobs,
};

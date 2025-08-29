const express = require('express');
const router = express.Router();
const { startScraping, getJobs } = require('../controllers/jobController');

// Rota para iniciar o scraping
router.post('/scrape', startScraping);

// Rota para obter os jobs
router.get('/jobs', getJobs);

module.exports = router;
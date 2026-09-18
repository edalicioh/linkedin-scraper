const express = require('express');
const controller = require('../controllers/jobController');

function createJobRoutes(handlers = controller) {
    const router = express.Router();

    // Rota para enfileirar um scraping
    router.post('/scrape', handlers.startScraping);

    // Rota para acompanhar uma tarefa
    router.get('/scrape/:taskId', handlers.getScrapeStatus);

    // Rota para obter os jobs
    router.get('/jobs', handlers.getJobs);

    return router;
}

const router = createJobRoutes();
module.exports = router;
module.exports.createJobRoutes = createJobRoutes;

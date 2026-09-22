const express = require('express');
const { createJobController } = require('../controllers/jobController');

function createJobRouter(dependencies) {
  const router = express.Router();
  const controller = dependencies && dependencies.controller
    ? dependencies.controller
    : createJobController(dependencies);

  router.post('/scrape', controller.startScraping);
  if (controller.getScrapeStatus) {
    router.get('/scrape/:taskId', controller.getScrapeStatus);
  }
  router.get('/jobs', controller.getJobs);
  if (controller.updateJobStatus) {
    router.patch('/jobs/:jobId/status', controller.updateJobStatus);
  }
  return router;
}

const router = createJobRouter();
router.createJobRouter = createJobRouter;
router.createJobRoutes = createJobRouter;

module.exports = router;

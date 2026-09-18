const express = require('express');
const { createJobController } = require('../controllers/jobController');

function createJobRouter(dependencies) {
  const router = express.Router();
  const controller = dependencies && dependencies.controller
    ? dependencies.controller
    : createJobController(dependencies);

  router.post('/scrape', controller.startScraping);
  router.get('/jobs', controller.getJobs);
  return router;
}

const router = createJobRouter();
router.createJobRouter = createJobRouter;

module.exports = router;

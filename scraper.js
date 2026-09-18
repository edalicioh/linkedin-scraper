const { startBrowser, closeBrowser } = require('./src/core/browser');
const { ensureLoggedIn, scrapeJobLinks, scrapeJobDetails } = require('./src/scraper/linkedin');
const { appendAsJson, readJsonArray } = require('./src/services/file-saver');
const { parseSearchUrl, generatePaginationUrls, TIME_PERIODS } = require('./src/services/url-generator');
const config = require('./src/core/config');

async function runScraper(keywords = 'php', location = 'Brasil', options = {}) {
  config.validateCredentials();
  const limit = config.validateScrapeLimit(options.limit);
  const storageDir = options.storageDir || config.STORAGE_DIR;
  const overrides = { ...options, ...(options.dependencies || {}) };
  const dependencies = {
    startBrowser,
    ensureLoggedIn,
    scrapeJobLinks,
    scrapeJobDetails,
    appendAsJson,
    readJsonArray,
    ...overrides,
  };
  const pageLimit = options.maxPages || config.maxPages;
  const pageSize = options.jobsPerPage || config.jobsPerPage;
  const selectedTimePeriod = options.timePeriod || config.timePeriod;
  const browserHeadless = overrides.browserHeadless ?? config.headless;

  console.log(`Iniciando o scraper de vagas do LinkedIn para "${keywords}" em "${location}"...`);

  const encodedKeywords = encodeURIComponent(keywords);
  const encodedLocation = encodeURIComponent(location);
  const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodedKeywords}&location=${encodedLocation}`;

  let page;
  try {
    const browser = await dependencies.startBrowser({ headless: browserHeadless });
    page = await browser.newPage();
    await dependencies.ensureLoggedIn(page);

    const baseComponents = parseSearchUrl(searchUrl);
    if (selectedTimePeriod && TIME_PERIODS[selectedTimePeriod]) {
      baseComponents.timePeriod = TIME_PERIODS[selectedTimePeriod];
    }

    const searchUrls = generatePaginationUrls(baseComponents, pageLimit, pageSize);
    console.log(`Geradas ${searchUrls.length} URLs para busca com paginação.`);

    let allJobLinks = [];
    let totalResultsCount = null;
    for (const [index, url] of searchUrls.entries()) {
      console.log(`Processando página ${index + 1}/${searchUrls.length}: ${url}`);
      const { jobLinks, resultsCount } = await dependencies.scrapeJobLinks(page, url);
      allJobLinks = allJobLinks.concat(jobLinks);
      if (index === 0 && resultsCount !== null) {
        totalResultsCount = resultsCount;
        console.log(`Total de resultados encontrados: ${totalResultsCount}`);
      }
    }

    const existingVagas = await dependencies.readJsonArray('vagas.json', { storageDir });
    const existingJobIds = new Set(existingVagas.map((vaga) => vaga.jobId).filter(Boolean));
    console.log(`Encontrados ${existingJobIds.size} jobId's já coletados.`);

    const filteredJobs = allJobLinks.filter((job) => {
      if (!job || !job.jobId || existingJobIds.has(job.jobId)) {
        return false;
      }
      existingJobIds.add(job.jobId);
      return true;
    });
    console.log(`Total de vagas encontradas: ${allJobLinks.length}. Vagas novas após filtragem: ${filteredJobs.length}`);

    const linksToScrape = filteredJobs.slice(0, limit);
    console.log(`Iniciando extração de detalhes para ${linksToScrape.length} vagas...`);

    const jobs = [];
    const extractionDate = new Date().toISOString();
    for (const job of linksToScrape) {
      const jobData = await dependencies.scrapeJobDetails(page, job.url);
      jobData.jobId = job.jobId;
      jobData.extractionDate = extractionDate;
      jobs.push(jobData);
    }

    if (jobs.length > 0) {
      await dependencies.appendAsJson('vagas.json', jobs, { storageDir });
    } else {
      console.log('Nenhuma vaga nova foi extraída.');
    }

    return {
      found: allJobLinks.length,
      ignored: allJobLinks.length - filteredJobs.length,
      processed: jobs.length,
      saved: jobs.length,
      totalResults: totalResultsCount,
    };
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (error) {
        console.error('Erro ao fechar a página do scraper:', error);
      }
    }
    console.log('Scraper finalizado.');
  }
}

async function main(dependencies = {}) {
  try {
    await (dependencies.runScraper || runScraper)('php', 'Brasil');
  } finally {
    await (dependencies.closeBrowser || closeBrowser)();
  }
}

module.exports = { runScraper, main };

if (require.main === module) {
  main().catch((error) => {
    console.error('Erro ao finalizar o scraper:', error);
    process.exitCode = 1;
  });
}

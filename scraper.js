const { startBrowser, closeBrowser } = require('./src/core/browser');
const { ensureLoggedIn, scrapeJobLinks, scrapeJobDetails } = require('./src/scraper/linkedin');
const { loadSession, saveSession } = require('./src/services/session-manager');
const { parseSearchUrl, generatePaginationUrls, TIME_PERIODS } = require('./src/services/url-generator');
const config = require('./src/core/config');
const { createDatabase } = require('./src/db/database');
const { createJobRepository } = require('./src/repositories/jobRepository');

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function nonNegativeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function runScraper(keywords = 'php', location = 'Brasil', options = {}) {
  config.validateCredentials();
  const limit = config.validateScrapeLimit(options.limit);
  const overrides = { ...options, ...(options.dependencies || {}) };
  const dependencies = {
    startBrowser,
    createContext: (browser, contextOptions) => browser.newContext(contextOptions),
    createPage: context => context.newPage(),
    loadSession,
    saveSession,
    ensureLoggedIn,
    scrapeJobLinks,
    scrapeJobDetails,
    jobDelayMinMs: 2000,
    jobDelayMaxMs: 5000,
    jobDelayRandom: Math.random,
    waitBetweenJobs: wait,
    ...overrides,
  };
  const database = options.database || createDatabase(options.dbPath);
  const repository = options.repository || createJobRepository(database);
  const ownsDatabase = !options.database;
  const pageLimit = options.maxPages || config.maxPages;
  const pageSize = options.jobsPerPage || config.jobsPerPage;
  const selectedTimePeriod = options.timePeriod || config.timePeriod;
  const browserHeadless = overrides.browserHeadless ?? config.headless;

  console.log(`Iniciando o scraper de vagas do LinkedIn para "${keywords}" em "${location}"...`);

  const encodedKeywords = encodeURIComponent(keywords);
  const encodedLocation = encodeURIComponent(location);
  const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodedKeywords}&location=${encodedLocation}`;

  let context;
  let page;
  try {
    const browser = await dependencies.startBrowser({ headless: browserHeadless });
    context = options.context || await dependencies.createContext(browser, options.contextOptions);
    page = options.page || await dependencies.createPage(context);
    await dependencies.ensureLoggedIn(page, {
      context,
      loadSession: (_page, filePath) => dependencies.loadSession(context, filePath),
      saveSession: (_page, filePath) => dependencies.saveSession(context, filePath),
      sessionFilePath: options.sessionFilePath,
    });

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

    const jobIds = allJobLinks.map((job) => job && job.jobId);
    const existingJobIds = repository.findExistingIds(jobIds);
    const incompleteJobIds = typeof repository.findIncompleteIds === 'function'
      ? repository.findIncompleteIds(jobIds)
      : new Set();
    console.log(`Encontrados ${existingJobIds.size} jobId's já coletados.`);

    const filteredJobs = allJobLinks.filter((job) => {
      if (!job || !job.jobId) {
        return false;
      }

      if (existingJobIds.has(job.jobId)) {
        if (!incompleteJobIds.has(job.jobId)) return false;
        incompleteJobIds.delete(job.jobId);
      }

      existingJobIds.add(job.jobId);
      return true;
    });
    console.log(`Total de vagas encontradas: ${allJobLinks.length}. Vagas novas após filtragem: ${filteredJobs.length}`);

    const linksToScrape = filteredJobs.slice(0, limit);
    console.log(`Iniciando extração de detalhes para ${linksToScrape.length} vagas...`);

    const jobs = [];
    const extractionDate = new Date().toISOString();
    const minimumDelay = nonNegativeNumber(dependencies.jobDelayMinMs, 2000);
    const maximumDelay = Math.max(
      minimumDelay,
      nonNegativeNumber(dependencies.jobDelayMaxMs, 5000)
    );
    for (const [index, job] of linksToScrape.entries()) {
      if (index > 0) {
        const randomValue = Math.min(1, Math.max(0, Number(dependencies.jobDelayRandom())));
        const delay = Math.round(minimumDelay + randomValue * (maximumDelay - minimumDelay));
        console.log(`Aguardando ${delay}ms antes da próxima vaga...`);
        await dependencies.waitBetweenJobs(delay);
      }

      const jobData = await dependencies.scrapeJobDetails(page, job.url);
      jobData.jobId = job.jobId;
      jobData.extractionDate = extractionDate;
      jobData.queryLocation = location;
      jobs.push(jobData);
    }

    if (jobs.length > 0) {
      repository.upsertMany(jobs);
      console.log(`Dados salvos com sucesso. Total de vagas gravadas: ${jobs.length}`);
    } else {
      console.log('Nenhuma vaga nova foi extraída.');
    }

    return {
      found: allJobLinks.length,
      ignored: allJobLinks.length - filteredJobs.length,
      processed: jobs.length,
      saved: jobs.length,
      totalResults: totalResultsCount,
      counts: {
        results: totalResultsCount,
        links: allJobLinks.length,
        jobs: jobs.length,
        found: allJobLinks.length,
        ignored: allJobLinks.length - filteredJobs.length,
        processed: jobs.length,
        saved: jobs.length,
      },
    };
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (error) {
        console.error('Erro ao fechar a página do scraper:', error);
      }
    }
    if (context) {
      try {
        await context.close();
      } catch (error) {
        console.error('Erro ao fechar o contexto do scraper:', error);
      }
    }
    if (ownsDatabase) {
      database.close();
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

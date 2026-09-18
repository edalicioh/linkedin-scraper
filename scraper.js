const { startBrowser } = require('./src/core/browser');
const { ensureLoggedIn, scrapeJobLinks, scrapeJobDetails } = require('./src/scraper/linkedin');
const { appendAsJson, readJsonArray } = require('./src/services/file-saver');
const { parseSearchUrl, generatePaginationUrls, TIME_PERIODS } = require('./src/services/url-generator');
const config = require('./src/core/config');

/**
 * Função que orquestra o processo de scraping com base em keywords e location.
 * @param {string} keywords - Palavras-chave para a busca.
 * @param {string} location - Localização para a busca.
 * @param {object} [options] - Opções e dublês para execução local.
 */
async function runScraper(keywords = 'php', location = 'Brasil', options = {}) {
  config.validateCredentials();
  const limit = config.validateScrapeLimit(options.limit);
  const storageDir = options.storageDir || config.STORAGE_DIR;
  const dependencies = {
    startBrowser,
    ensureLoggedIn,
    scrapeJobLinks,
    scrapeJobDetails,
    appendAsJson,
    readJsonArray,
    ...options.dependencies,
  };
  const pageLimit = options.maxPages || config.maxPages;
  const pageSize = options.jobsPerPage || config.jobsPerPage;
  const selectedTimePeriod = options.timePeriod || config.timePeriod;

  console.log(`Iniciando o scraper de vagas do LinkedIn para "${keywords}" em "${location}"...`);

  // Gerar URL de busca dinamicamente
  const encodedKeywords = encodeURIComponent(keywords);
  const encodedLocation = encodeURIComponent(location);
  const SEARCH_URL = `https://www.linkedin.com/jobs/search/?keywords=${encodedKeywords}&location=${encodedLocation}`;

  try {
    const browser = await dependencies.startBrowser();
    const page = await browser.newPage();

    // 1. Garantir que o usuário está logado (com sessão ou login manual)
    await dependencies.ensureLoggedIn(page);

    // 2. Gerar URLs de múltiplas páginas
    const baseComponents = parseSearchUrl(SEARCH_URL);
    
    // Adicionar filtro de período se especificado
    if (selectedTimePeriod && TIME_PERIODS[selectedTimePeriod]) {
      baseComponents.timePeriod = TIME_PERIODS[selectedTimePeriod];
    }
    
    const searchUrls = generatePaginationUrls(baseComponents, pageLimit, pageSize);
    console.log(`Geradas ${searchUrls.length} URLs para busca com paginação.`);

    // 3. Extrair links das vagas de todas as páginas
    let allJobLinks = [];
    let totalResultsCount = null;
    for (const [index, url] of searchUrls.entries()) {
      console.log(`Processando página ${index + 1}/${searchUrls.length}: ${url}`);
      const { jobLinks, resultsCount } = await dependencies.scrapeJobLinks(page, url);
      allJobLinks = allJobLinks.concat(jobLinks);
      
      // Usa a contagem de resultados da primeira página
      if (index === 0 && resultsCount !== null) {
        totalResultsCount = resultsCount;
        console.log(`Total de resultados encontrados: ${totalResultsCount}`);
      }
    }
    
    // 3. Criar um índice de jobId's já coletados.
    const existingVagas = await dependencies.readJsonArray(
      'vagas.json',
      { storageDir },
    );
    const existingJobIds = new Set(existingVagas.map((vaga) => vaga.jobId).filter(Boolean));
    console.log(`Encontrados ${existingJobIds.size} jobId's já coletados.`);
    
    // 4. Filtrar vagas que já foram coletadas
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

    // 5. Extrair detalhes de cada vaga
    const jobs = [];
    const extractionDate = new Date().toISOString(); // Data e hora da extração
    for (const job of linksToScrape) {
      const jobData = await dependencies.scrapeJobDetails(page, job.url);
      // Adiciona o jobId e a data de extração aos dados da vaga
      jobData.jobId = job.jobId;
      jobData.extractionDate = extractionDate;
      jobs.push(jobData);
    }

    // 6. Adicionar os dados ao banco de dados (vagas.json)
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
    console.log('Scraper finalizado.');
  }
}

/**
 * Função principal para execução direta via CLI (mantém compatibilidade).
 */
async function main() {
  // Valores padrão podem ser obtidos do .env ou definidos aqui
  const defaultKeywords = 'php'; // Pode ser substituído por um valor do .env se desejado
  const defaultLocation = 'Brasil'; // Pode ser substituído por um valor do .env se desejado

 await runScraper(defaultKeywords, defaultLocation);
}

// Exporta a função para uso em outros módulos (como a API)
module.exports = { runScraper };

// Executa o scraper se este arquivo for chamado diretamente
if (require.main === module) {
  main();
}

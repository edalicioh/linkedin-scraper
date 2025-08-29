const { startBrowser, closeBrowser } = require('./src/browser');
const { ensureLoggedIn, scrapeJobLinks, scrapeJobDetails } = require('./src/linkedin');
const { appendAsJson } = require('./src/file-saver');
const { parseSearchUrl, generatePaginationUrls, TIME_PERIODS } = require('./src/url-generator');
const { linkedinEmail, linkedinPassword, maxPages, jobsPerPage, timePeriod } = require('./src/config');
const fse = require('fs-extra');
const path = require('path');

/**
 * Função que orquestra o processo de scraping com base em keywords e location.
 * @param {string} keywords - Palavras-chave para a busca.
 * @param {string} location - Localização para a busca.
 */
async function runScraper(keywords = 'php', location = 'Brasil') {
 console.log(`Iniciando o scraper de vagas do LinkedIn para "${keywords}" em "${location}"...`);

  // Gerar URL de busca dinamicamente
  const encodedKeywords = encodeURIComponent(keywords);
  const encodedLocation = encodeURIComponent(location);
  const SEARCH_URL = `https://www.linkedin.com/jobs/search/?keywords=${encodedKeywords}&location=${encodedLocation}`;

  try {
    const browser = await startBrowser();
    const page = await browser.newPage();

    // 1. Garantir que o usuário está logado (com sessão ou login manual)
    await ensureLoggedIn(page);

    // 2. Gerar URLs de múltiplas páginas
    const baseComponents = parseSearchUrl(SEARCH_URL);
    
    // Adicionar filtro de período se especificado
    if (timePeriod && TIME_PERIODS[timePeriod]) {
      baseComponents.timePeriod = TIME_PERIODS[timePeriod];
    }
    
    const searchUrls = generatePaginationUrls(baseComponents, maxPages, jobsPerPage);
    console.log(`Geradas ${searchUrls.length} URLs para busca com paginação.`);

    // 3. Extrair links das vagas de todas as páginas
    let allJobLinks = [];
    let totalResultsCount = null;
    for (const [index, url] of searchUrls.entries()) {
      console.log(`Processando página ${index + 1}/${searchUrls.length}: ${url}`);
      const { jobLinks, resultsCount } = await scrapeJobLinks(page, url);
      allJobLinks = allJobLinks.concat(jobLinks);
      
      // Usa a contagem de resultados da primeira página
      if (index === 0 && resultsCount !== null) {
        totalResultsCount = resultsCount;
        console.log(`Total de resultados encontrados: ${totalResultsCount}`);
      }
    }
    
    // 3. Criar um índice de jobId's já coletados
    let existingJobIds = new Set();
    try {
      const vagasPath = path.join(__dirname, 'vagas.json');
      const existingVagas = await fse.readJson(vagasPath);
      if (Array.isArray(existingVagas)) {
        existingJobIds = new Set(existingVagas.map(vaga => vaga.jobId).filter(id => id));
        console.log(`Encontrados ${existingJobIds.size} jobId's já coletados.`);
      }
    } catch (err) {
      console.log('Nenhum arquivo vagas.json encontrado ou arquivo corrompido. Iniciando do zero.');
    }
    
    // 4. Filtrar vagas que já foram coletadas
    const filteredJobs = allJobLinks.filter(job => !existingJobIds.has(job.jobId));
    console.log(`Total de vagas encontradas: ${allJobLinks.length}. Vagas novas após filtragem: ${filteredJobs.length}`);
    
    // Limita a 5 vagas para teste, para não sobrecarregar
    const linksToScrape = filteredJobs.slice(0, 5);
    console.log(`Iniciando extração de detalhes para ${linksToScrape.length} vagas...`);

    // 5. Extrair detalhes de cada vaga
    const jobs = [];
    const extractionDate = new Date().toISOString(); // Data e hora da extração
    for (const job of linksToScrape) {
      const jobData = await scrapeJobDetails(page, job.url);
      // Adiciona o jobId e a data de extração aos dados da vaga
      jobData.jobId = job.jobId;
      jobData.extractionDate = extractionDate;
      jobs.push(jobData);
    }

    // 6. Adicionar os dados ao banco de dados (vagas.json)
    if (jobs.length > 0) {
      await appendAsJson('vagas.json', jobs);
    } else {
      console.log('Nenhuma vaga nova foi extraída.');
    }

  } catch (error) {
    console.error('Ocorreu um erro no processo principal do scraper:', error);
  } finally {
    // 7. Fechar o navegador
    //await closeBrowser();
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
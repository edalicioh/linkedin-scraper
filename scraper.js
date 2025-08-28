const { startBrowser, closeBrowser } = require('./src/browser');
const { ensureLoggedIn, scrapeJobLinks, scrapeJobDetails } = require('./src/linkedin');
const { appendAsJson } = require('./src/file-saver');
const fse = require('fs-extra');
const path = require('path');

// URL de busca de vagas (pode ser ajustada conforme necessário)
const SEARCH_URL = 'https://www.linkedin.com/jobs/search/?currentJobId=4286302776&distance=25.0&f_WT=2&geoId=106057199&keywords=php&origin=JOB_SEARCH_PAGE_KEYWORD_AUTOCOMPLETE&refresh=true';

/**
 * Função principal que orquestra o processo de scraping.
 */
async function main() {
  console.log('Iniciando o scraper de vagas do LinkedIn...');

  try {
    const browser = await startBrowser();
    const page = await browser.newPage();

    // 1. Garantir que o usuário está logado (com sessão ou login manual)
    await ensureLoggedIn(page);

    // 2. Extrair links das vagas
    const jobLinks = await scrapeJobLinks(page, SEARCH_URL);
    
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
    const filteredJobs = jobLinks.filter(job => !existingJobIds.has(job.jobId));
    console.log(`Total de vagas encontradas: ${jobLinks.length}. Vagas novas após filtragem: ${filteredJobs.length}`);
    
    // Limita a 5 vagas para teste, para não sobrecarregar
    const linksToScrape = filteredJobs.slice(0, 5);
    console.log(`Iniciando extração de detalhes para ${linksToScrape.length} vagas...`);

    // 5. Extrair detalhes de cada vaga
    const jobs = [];
    for (const job of linksToScrape) {
      const jobData = await scrapeJobDetails(page, job.url);
      // Adiciona o jobId aos dados da vaga
      jobData.jobId = job.jobId;
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
    // await closeBrowser();
    console.log('Scraper finalizado.');
  }
}

// Executa o scraper
main();
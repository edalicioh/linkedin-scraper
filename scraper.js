const { startBrowser, closeBrowser } = require('./src/browser');
const { ensureLoggedIn, scrapeJobLinks, scrapeJobDetails } = require('./src/linkedin');
const { saveAsJson } = require('./src/file-saver');

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

    // Limita a 5 vagas para teste, para não sobrecarregar
    const linksToScrape = jobLinks.slice(0, 5);
    console.log(`Iniciando extração de detalhes para ${linksToScrape.length} vagas...`);

    // 3. Extrair detalhes de cada vaga
    const jobs = [];
    for (const link of linksToScrape) {
      const jobData = await scrapeJobDetails(page, link);
      jobs.push(jobData);
    }

    // 4. Salvar os dados
    if (jobs.length > 0) {
      await saveAsJson('vagas.json', jobs);
    } else {
      console.log('Nenhuma vaga foi extraída. O arquivo não foi salvo.');
    }

  } catch (error) {
    console.error('Ocorreu um erro no processo principal do scraper:', error);
  } finally {
    // 5. Fechar o navegador
    await closeBrowser();
    console.log('Scraper finalizado.');
  }
}

// Executa o scraper
main();
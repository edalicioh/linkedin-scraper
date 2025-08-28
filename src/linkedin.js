const { linkedinEmail, linkedinPassword } = require('./config');
const { loadSession, saveSession } = require('./session-manager');

/**
 * Garante que o usuário esteja logado no LinkedIn, utilizando uma sessão salva se possível.
 * @param {import('puppeteer').Page} page - A página do Puppeteer.
 */
async function ensureLoggedIn(page) {
  // 1. Tentar carregar a sessão salva
  const isSessionLoaded = await loadSession(page);
  if (isSessionLoaded) {
    // 2. Verificar se a sessão é válida
    console.log('Verificando validade da sessão carregada...');
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
    
    try {
      // Espera por um elemento que só aparece quando o usuário está logado
      await page.waitForSelector('#global-nav', { timeout: 10000 });
      console.log('Sessão válida carregada. Pulando login.');
      return; // Sessão válida, não precisa fazer login
    } catch (err) {
      console.log('Sessão carregada é inválida ou expirou. Prosseguindo com o login manual.');
    }
  }

  // 3. Se não houver sessão válida, fazer login normal
  console.log('Navegando para a página de login do LinkedIn...');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' });

  console.log('Preenchendo credenciais...');
  await page.type('#username', linkedinEmail);
  await page.type('#password', linkedinPassword);

  console.log('Realizando login...');
  await page.click('.login__form_action_container button');

  try {
    console.log('Aguardando confirmação de login...');
    // Espera por um elemento que só aparece após o login bem-sucedido
    await page.waitForSelector('#global-nav', { timeout: 30000 });
    console.log('Login bem-sucedido!');
    // 4. Salvar a nova sessão após login bem-sucedido
    await saveSession(page);
  } catch (error) {
    console.error('Erro durante a navegação após o login:', error);
    console.error('Falha na navegação após o login. Verifique se há um CAPTCHA ou erro de credenciais.');
    await page.screenshot({ path: 'login-error.png' });
    console.log('Screenshot salvo como "login-error.png" para depuração.');
    // Relança o erro para interromper a execução do script
    throw error;
  }
}

/**
 * Extrai os links das vagas de uma página de busca.
 * @param {import('puppeteer').Page} page - A página do Puppeteer.
 * @param {string} searchUrl - A URL da busca de vagas.
 * @returns {Promise<string[]>} Uma lista de URLs de vagas.
 */
async function scrapeJobLinks(page, searchUrl) {
  console.log('Navegando para a página de busca de vagas...');
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  // Espera adicional para garantir que os cards de vaga sejam carregados
 await page.waitForSelector('a.job-card-container__link', { timeout: 10000 }).catch(() => {
    console.log('Aviso: Elementos de vaga não foram encontrados dentro do timeout esperado.');
  });

  console.log('Extraindo links das vagas...');
  const jobLinks = await page.evaluate(() => {
    const links = [];
    const jobElements = document.querySelectorAll('a.job-card-container__link');
    console.log(`Total de elementos encontrados pelo seletor: ${jobElements.length}`);
    
    jobElements.forEach((element, index) => {
      console.log(`Elemento ${index}: href = ${element.href}`);
      if (element.href && element.href.includes('/jobs/view/')) {
        links.push(element.href);
        console.log(`  -> Link adicionado: ${element.href}`);
      } else {
        console.log(`  -> Link ignorado: ${element.href}`);
      }
    });
    return links;
  });

  console.log(`Encontrados ${jobLinks.length} links de vagas.`);
  return jobLinks;
}

/**
 * Extrai os detalhes de uma única vaga.
 * @param {import('puppeteer').Page} page - A página do Puppeteer.
 * @param {string} jobUrl - A URL da vaga.
 * @returns {Promise<object>} Os dados da vaga.
 */
async function scrapeJobDetails(page, jobUrl) {
  console.log(`Acessando vaga: ${jobUrl}`);
  await page.goto(jobUrl, { waitUntil: 'domcontentloaded' });

  // Espera adicional para garantir que os elementos da vaga sejam carregados
  try {
    await page.waitForSelector('.t-24.job-details-jobs-unified-top-card__job-title', { timeout: 10000 });
    console.log('Elemento de título encontrado.');
  } catch (err) {
    console.log('Aviso: Elemento de título não encontrado dentro do timeout.');
 }

  const jobData = await page.evaluate(() => {
    // Logs de depuração para ver o que está sendo encontrado
    console.log('Iniciando extração de dados da vaga...');
    
    const tituloElement = document.querySelector('.t-24.job-details-jobs-unified-top-card__job-title');
    console.log('Título element:', tituloElement);
    console.log('Título innerText:', tituloElement?.innerText);

    const empresaElement = document.querySelector('div.job-details-jobs-unified-top-card__company-name a');
    console.log('Empresa element:', empresaElement);
    console.log('Empresa innerText:', empresaElement?.innerText);

    const descricaoElement = document.querySelector('#job-details .mt4');
    console.log('Descrição element:', descricaoElement);
    console.log('Descrição innerText:', descricaoElement?.innerText);

    return {
      title: tituloElement?.innerText?.trim() || 'N/A',
      company: empresaElement?.innerText?.trim() || 'N/A',
      description: descricaoElement?.innerText?.trim() || 'N/A',
      url: window.location.href
    };
  });

  return jobData;
}

module.exports = {
  ensureLoggedIn,
  scrapeJobLinks,
  scrapeJobDetails,
};
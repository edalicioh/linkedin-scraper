const puppeteer = require('puppeteer');

let browserInstance;

/**
 * Inicia uma instância do navegador Puppeteer.
 * @param {object} options - Opções de inicialização do Puppeteer.
 * @returns {Promise<import('puppeteer').Browser>} A instância do navegador.
 */
async function startBrowser(options = { headless: false }) {
  if (!browserInstance) {
    console.log('Iniciando o navegador...');
    browserInstance = await puppeteer.launch(options);
  }
  return browserInstance;
}

/**
 * Fecha a instância do navegador Puppeteer.
 */
async function closeBrowser() {
  if (browserInstance) {
    console.log('Fechando o navegador...');
    await browserInstance.close();
    browserInstance = null;
  }
}

module.exports = {
  startBrowser,
  closeBrowser,
};
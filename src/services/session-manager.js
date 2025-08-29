const fs = require('fs').promises;
const path = require('path');

const COOKIES_FILE_PATH = path.join(__dirname, '..', 'storage', 'cookies.json');

/**
 * Salva os cookies da sessão atual em um arquivo.
 * @param {import('puppeteer').Page} page - A página do Puppeteer.
 */
async function saveSession(page) {
  try {
    const cookies = await page.cookies();
    await fs.writeFile(COOKIES_FILE_PATH, JSON.stringify(cookies, null, 2));
    console.log('Sessão salva com sucesso.');
  } catch (error) {
    console.error('Erro ao salvar a sessão:', error);
  }
}

/**
 * Carrega os cookies de um arquivo e os injeta no navegador.
 * @param {import('puppeteer').Page} page - A página do Puppeteer.
 * @returns {Promise<boolean>} true se os cookies foram carregados, false caso contrário.
 */
async function loadSession(page) {
  try {
    const cookiesString = await fs.readFile(COOKIES_FILE_PATH, 'utf8');
    const cookies = JSON.parse(cookiesString);
    if (Array.isArray(cookies) && cookies.length > 0) {
      await page.setCookie(...cookies);
      console.log('Sessão carregada a partir dos cookies.');
      return true;
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('Arquivo de cookies não encontrado. Prosseguindo com o login.');
    } else {
      console.error('Erro ao carregar a sessão:', error);
    }
  }
 return false;
}

module.exports = {
  saveSession,
  loadSession,
};
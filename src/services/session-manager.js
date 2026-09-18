const fs = require('fs').promises;
const path = require('path');
const { COOKIES_FILE_PATH } = require('../core/config');

/**
 * Salva os cookies da sessão atual em um arquivo.
 * @param {import('puppeteer').Page} page - A página do Puppeteer.
 */
async function saveSession(page, filePath = COOKIES_FILE_PATH) {
  const cookies = await page.cookies();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(cookies, null, 2)}\n`);
  console.log('Sessão salva com sucesso.');
}

/**
 * Carrega os cookies de um arquivo e os injeta no navegador.
 * @param {import('puppeteer').Page} page - A página do Puppeteer.
 * @returns {Promise<boolean>} true se os cookies foram carregados, false caso contrário.
 */
async function loadSession(page, filePath = COOKIES_FILE_PATH) {
  try {
    const cookiesString = await fs.readFile(filePath, 'utf8');
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
      throw error;
    }
  }
 return false;
}

module.exports = {
  saveSession,
  loadSession,
};

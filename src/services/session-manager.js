const fs = require('fs').promises;
const path = require('path');
const { COOKIES_FILE_PATH } = require('../core/config');

const COOKIE_FIELDS = [
  'name',
  'value',
  'domain',
  'path',
  'expires',
  'httpOnly',
  'secure',
  'sameSite',
];

function normalizeCookie(cookie) {
  const normalized = Object.fromEntries(
    COOKIE_FIELDS
      .filter(field => cookie[field] !== undefined)
      .map(field => [field, cookie[field]])
  );

  if (normalized.sameSite !== undefined) {
    const sameSite = String(normalized.sameSite).toLowerCase();
    const sameSiteValues = {
      strict: 'Strict',
      lax: 'Lax',
      none: 'None',
      no_restriction: 'None',
    };
    if (sameSiteValues[sameSite]) normalized.sameSite = sameSiteValues[sameSite];
    else delete normalized.sameSite;
  }

  return normalized;
}

/**
 * Salva os cookies da sessão atual em um arquivo.
 * @param {import('playwright').BrowserContext} context - O contexto do Playwright.
 */
async function saveSession(context, filePath = COOKIES_FILE_PATH) {
  const cookies = await context.cookies();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(cookies, null, 2)}\n`);
  console.log('Sessão salva com sucesso.');
}

/**
 * Carrega os cookies de um arquivo e os injeta no navegador.
 * @param {import('playwright').BrowserContext} context - O contexto do Playwright.
 * @returns {Promise<boolean>} true se os cookies foram carregados, false caso contrário.
 */
async function loadSession(context, filePath = COOKIES_FILE_PATH) {
  try {
    const cookiesString = await fs.readFile(filePath, 'utf8');
    const cookies = JSON.parse(cookiesString);
    if (Array.isArray(cookies) && cookies.length > 0) {
      await context.addCookies(cookies.map(normalizeCookie));
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

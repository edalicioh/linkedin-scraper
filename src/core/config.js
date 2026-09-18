const path = require('path');
require('dotenv').config();

const STORAGE_DIR = path.resolve(__dirname, '..', '..', 'storage');
const JOBS_FILE_PATH = path.join(STORAGE_DIR, 'vagas.json');
const COOKIES_FILE_PATH = path.join(STORAGE_DIR, 'cookies.json');

function parsePositiveInteger(value, fallback, name) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} deve ser um inteiro positivo.`);
  }

  return parsed;
}

function parseConfig(env = process.env) {
  return {
    linkedinEmail: env.LINKEDIN_EMAIL,
    linkedinPassword: env.LINKEDIN_PASSWORD,
    maxPages: parsePositiveInteger(env.MAX_PAGES, 3, 'MAX_PAGES'),
    jobsPerPage: parsePositiveInteger(env.JOBS_PER_PAGE, 25, 'JOBS_PER_PAGE'),
    scrapeLimit: parsePositiveInteger(env.SCRAPE_LIMIT, 5, 'SCRAPE_LIMIT'),
    timePeriod: env.TIME_PERIOD || 'any',
    headless: env.HEADLESS === 'true',
    storageDir: STORAGE_DIR,
    jobsFilePath: JOBS_FILE_PATH,
    cookiesFilePath: COOKIES_FILE_PATH,
  };
}

function validateCredentials(currentConfig = config) {
  if (!currentConfig.linkedinEmail || !currentConfig.linkedinPassword) {
    throw new Error('Credenciais do LinkedIn não encontradas. Verifique o arquivo .env.');
  }

  return true;
}

function validateScrapeLimit(value) {
  return parsePositiveInteger(value, config.scrapeLimit, 'SCRAPE_LIMIT');
}

const config = parseConfig();

module.exports = {
  ...config,
  STORAGE_DIR,
  JOBS_FILE_PATH,
  COOKIES_FILE_PATH,
  parseConfig,
  validateCredentials,
  validateScrapeLimit,
};

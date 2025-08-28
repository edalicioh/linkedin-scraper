/**
 * Módulo para geração de URLs de busca no LinkedIn com paginação e filtros de período
 */

/**
 * Mapeamento de períodos de tempo para os valores usados pelo LinkedIn
 */
const TIME_PERIODS = {
  '24h': 'r86400',    // Últimas 24 horas (86400 segundos)
  '7d': 'r604800',    // Últimos 7 dias (604800 segundos)
  '30d': 'r2592000',  // Últimos 30 dias (2592000 segundos)
  'any': 'r0',        // Qualquer data
};

/**
 * Analisa uma URL de busca do LinkedIn e extrai seus componentes
 * @param {string} url - A URL de busca do LinkedIn
 * @returns {object} Objeto com os componentes da URL
 */
function parseSearchUrl(url) {
  const urlObj = new URL(url);
  const params = new URLSearchParams(urlObj.search);
  
  return {
    baseUrl: `${urlObj.origin}${urlObj.pathname}`,
    currentJobId: params.get('currentJobId'),
    timePeriod: params.get('f_TPR'),
    keywords: params.get('keywords'),
    origin: params.get('origin'),
    start: parseInt(params.get('start')) || 0,
  };
}

/**
 * Gera uma URL de busca do LinkedIn com os parâmetros especificados
 * @param {object} components - Componentes da URL
 * @param {string} components.baseUrl - URL base (ex: 'https://www.linkedin.com/jobs/search/')
 * @param {string} [components.currentJobId] - ID da vaga atual
 * @param {string} [components.timePeriod] - Período de tempo (usar valores do TIME_PERIODS)
 * @param {string} [components.keywords] - Palavras-chave de busca
 * @param {string} [components.origin] - Origem da busca
 * @param {number} [components.start=0] - Ponto de início para paginação
 * @returns {string} URL de busca gerada
 */
function generateSearchUrl(components) {
  const {
    baseUrl = 'https://www.linkedin.com/jobs/search/',
    currentJobId,
    timePeriod,
    keywords,
    origin,
    start = 0
  } = components;
  
  const params = new URLSearchParams();
  
  if (currentJobId) params.set('currentJobId', currentJobId);
  if (timePeriod) params.set('f_TPR', timePeriod);
  if (keywords) params.set('keywords', keywords);
  if (origin) params.set('origin', origin);
  if (start > 0) params.set('start', start.toString());
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Gera URLs para múltiplas páginas de resultados
 * @param {object} baseComponents - Componentes base da URL
 * @param {number} totalPages - Número de páginas a gerar
 * @param {number} jobsPerPage - Número de vagas por página (padrão: 25)
 * @returns {string[]} Array de URLs geradas
 */
function generatePaginationUrls(baseComponents, totalPages, jobsPerPage = 25) {
  const urls = [];
  
  for (let page = 0; page < totalPages; page++) {
    const components = { ...baseComponents };
    components.start = page * jobsPerPage;
    urls.push(generateSearchUrl(components));
  }
  
  return urls;
}

/**
 * Gera URLs para diferentes períodos de tempo
 * @param {object} baseComponents - Componentes base da URL
 * @param {string[]} periods - Array de períodos para gerar URLs (ex: ['24h', '7d', '30d'])
 * @returns {object} Objeto com URLs agrupadas por período
 */
function generateTimePeriodUrls(baseComponents, periods) {
  const urlsByPeriod = {};
  
  for (const period of periods) {
    if (TIME_PERIODS[period]) {
      const components = { ...baseComponents };
      components.timePeriod = TIME_PERIODS[period];
      urlsByPeriod[period] = generateSearchUrl(components);
    }
  }
  
  return urlsByPeriod;
}

module.exports = {
  TIME_PERIODS,
  parseSearchUrl,
  generateSearchUrl,
  generatePaginationUrls,
  generateTimePeriodUrls
};
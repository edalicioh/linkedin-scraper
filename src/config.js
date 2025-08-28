// Importa a biblioteca dotenv para carregar variáveis de ambiente
require('dotenv').config();

// Exporta as variáveis de ambiente necessárias para o projeto
const config = {
  linkedinEmail: process.env.LINKEDIN_EMAIL,
  linkedinPassword: process.env.LINKEDIN_PASSWORD,
  maxPages: parseInt(process.env.MAX_PAGES) || 3,
  jobsPerPage: parseInt(process.env.JOBS_PER_PAGE) || 25,
  timePeriod: process.env.TIME_PERIOD || 'any'
};

// Validação para garantir que as credenciais foram carregadas
if (!config.linkedinEmail || !config.linkedinPassword) {
  console.error('Erro: Credenciais do LinkedIn não encontradas. Verifique o arquivo .env');
  process.exit(1); // Encerra a execução se as credenciais estiverem ausentes
}

module.exports = config;
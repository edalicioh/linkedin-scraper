const cron = require('node-cron');

const DEFAULT_SCHEDULE = '0 6-18 * * *';
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
const DEFAULT_API_URL = 'http://app:3000/api/scrape';

async function enqueueScrape({
  fetchImpl = fetch,
  apiUrl = process.env.SCRAPER_API_URL || DEFAULT_API_URL,
  keywords = process.env.SCRAPE_KEYWORDS || 'php',
  location = process.env.SCRAPE_LOCATION || 'Brasil',
} = {}) {
  const response = await fetchImpl(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keywords, location }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`A API rejeitou o agendamento (${response.status}): ${body}`);
  }

  console.log(`Extracao agendada para "${keywords}" em "${location}".`);
  return body;
}

function startScheduler({
  cronClient = cron,
  fetchImpl = fetch,
  schedule = process.env.SCRAPE_CRON || DEFAULT_SCHEDULE,
  timezone = process.env.CRON_TIMEZONE || DEFAULT_TIMEZONE,
} = {}) {
  if (!cronClient.validate(schedule)) {
    throw new Error(`Expressao cron invalida: ${schedule}`);
  }

  const task = cronClient.schedule(
    schedule,
    () => {
      enqueueScrape({ fetchImpl }).catch((error) => {
        console.error('Falha ao agendar extracao:', error.message);
      });
    },
    { timezone }
  );

  console.log(`Scheduler ativo: "${schedule}" (${timezone}).`);
  return task;
}

function main() {
  const task = startScheduler();
  const stop = () => {
    task.stop();
    task.destroy();
  };

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_API_URL,
  DEFAULT_SCHEDULE,
  DEFAULT_TIMEZONE,
  enqueueScrape,
  startScheduler,
};

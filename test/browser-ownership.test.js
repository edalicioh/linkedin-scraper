const assert = require('node:assert/strict');
const test = require('node:test');

process.env.LINKEDIN_EMAIL ||= 'test@example.com';
process.env.LINKEDIN_PASSWORD ||= 'test-password';

const { main } = require('../scraper');
const { createShutdown } = require('../api');

function createPage() {
  return {
    closeCalls: 0,
    close: async function close() {
      this.closeCalls += 1;
    },
  };
}

test('runScraper fecha apenas a pagina que criou quando o scraping falha', async () => {
  const page = createPage();
  const browser = {
    newPage: async () => page,
  };

  await assert.rejects(
    require('../scraper').runScraper('php', 'Brasil', {
      startBrowser: async () => browser,
      ensureLoggedIn: async () => {
        throw new Error('falha de scraping');
      },
    }),
    /falha de scraping/
  );

  assert.equal(page.closeCalls, 1);
});

test('main fecha o browser ao terminar a execucao CLI', async () => {
  let closeCalls = 0;
  await main({
    runScraper: async () => {},
    closeBrowser: async () => {
      closeCalls += 1;
    },
  });

  assert.equal(closeCalls, 1);
});

test('shutdown da API fecha o browser uma vez e nao por tarefa', async () => {
  let closeCalls = 0;
  let serverCloseCalls = 0;
  const shutdown = createShutdown(
    {
      close(callback) {
        serverCloseCalls += 1;
        callback();
      },
    },
    async () => {
      closeCalls += 1;
    }
  );

  await Promise.all([shutdown(), shutdown()]);
  assert.equal(serverCloseCalls, 1);
  assert.equal(closeCalls, 1);
});

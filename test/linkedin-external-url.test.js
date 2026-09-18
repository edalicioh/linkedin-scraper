const assert = require('node:assert/strict');
const test = require('node:test');

const { captureExternalUrl } = require('../src/scraper/linkedin');

test('captura popup associado ao clique e o fecha', async () => {
  let resolvePopup;
  let closed = false;
  const popup = {
    url: () => 'https://company.example/apply',
    isClosed: () => closed,
    close: async () => {
      closed = true;
    },
  };
  const page = {
    url: () => 'https://www.linkedin.com/jobs/view/1',
    waitForEvent: async (event) => {
      assert.equal(event, 'popup');
      return new Promise((resolve) => {
        resolvePopup = () => resolve(popup);
      });
    },
    async click() {
      resolvePopup();
    },
    locator: () => ({
      first: () => ({
        waitFor: async () => {
          throw new Error('modal ausente');
        },
      }),
    }),
  };

  assert.equal(
    await captureExternalUrl(page, { timeoutMs: 500, wait: async () => {} }),
    'https://company.example/apply'
  );
  assert.equal(closed, true);
});

test('captura navegacao externa na mesma aba sem popup', async () => {
  let currentUrl = 'https://www.linkedin.com/jobs/view/2';
  const page = {
    url: () => currentUrl,
    waitForEvent: async () => new Promise(() => {}),
    async click() {
      currentUrl = 'https://company.example/apply';
    },
  };

  assert.equal(
    await captureExternalUrl(page, { timeoutMs: 50, wait: async () => {} }),
    'https://company.example/apply'
  );
});

test('retorna null quando nenhuma URL externa e aberta', async () => {
  const page = {
    url: () => 'https://www.linkedin.com/jobs/view/3',
    waitForEvent: async () => new Promise(() => {}),
    async click() {},
  };

  assert.equal(await captureExternalUrl(page, { timeoutMs: 5, wait: async () => {} }), null);
});

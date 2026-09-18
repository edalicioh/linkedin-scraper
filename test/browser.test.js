const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const { createBrowserManager } = require('../src/core/browser');

function createFakeBrowser() {
  const browser = new EventEmitter();
  browser.connected = true;
  browser.closeCalls = 0;
  browser.isConnected = () => browser.connected;
  browser.close = async () => {
    browser.closeCalls += 1;
    browser.connected = false;
  };
  return browser;
}

test('compartilha um launch entre inicializacoes concorrentes', async () => {
  const browser = createFakeBrowser();
  let resolveLaunch;
  let launchCalls = 0;
  let receivedOptions;
  const playwright = {
    launch: (options) => {
      launchCalls += 1;
      receivedOptions = options;
      return new Promise((resolve) => {
        resolveLaunch = () => resolve(browser);
      });
    },
  };
  const manager = createBrowserManager(playwright);

  const first = manager.startBrowser();
  const second = manager.startBrowser({ headless: true });
  assert.equal(launchCalls, 1);
  resolveLaunch();

  assert.equal(await first, browser);
  assert.equal(await second, browser);
  assert.equal(launchCalls, 1);
  assert.deepEqual(receivedOptions, { headless: false });
});

test('limpa falha de launch e permite nova tentativa', async () => {
  const browser = createFakeBrowser();
  let launchCalls = 0;
  const playwright = {
    launch: async () => {
      launchCalls += 1;
      if (launchCalls === 1) {
        throw new Error('falha simulada');
      }
      return browser;
    },
  };
  const manager = createBrowserManager(playwright);

  await assert.rejects(manager.startBrowser(), /falha simulada/);
  assert.equal(await manager.startBrowser(), browser);
  assert.equal(launchCalls, 2);
});

test('nao reutiliza browser desconectado e limpa a referencia no evento', async () => {
  const firstBrowser = createFakeBrowser();
  const secondBrowser = createFakeBrowser();
  let launchCalls = 0;
  const playwright = {
    launch: async () => {
      launchCalls += 1;
      return launchCalls === 1 ? firstBrowser : secondBrowser;
    },
  };
  const manager = createBrowserManager(playwright);

  assert.equal(await manager.startBrowser(), firstBrowser);
  firstBrowser.connected = false;
  firstBrowser.emit('disconnected');

  assert.equal(await manager.startBrowser(), secondBrowser);
  assert.equal(launchCalls, 2);
});

test('closeBrowser e idempotente e fecha o browser uma vez', async () => {
  const browser = createFakeBrowser();
  const manager = createBrowserManager({ launch: async () => browser });

  await manager.startBrowser();
  await Promise.all([manager.closeBrowser(), manager.closeBrowser()]);
  await manager.closeBrowser();

  assert.equal(browser.closeCalls, 1);
});

test('closeBrowser aguarda launch pendente antes de fechar', async () => {
  const browser = createFakeBrowser();
  let resolveLaunch;
  const manager = createBrowserManager({
    launch: () =>
      new Promise((resolve) => {
        resolveLaunch = () => resolve(browser);
      }),
  });

  const start = manager.startBrowser();
  const close = manager.closeBrowser();
  resolveLaunch();

  assert.equal(await start, browser);
  await close;
  assert.equal(browser.closeCalls, 1);
});

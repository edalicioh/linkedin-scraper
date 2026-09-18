const assert = require('node:assert/strict');
const test = require('node:test');

const { chromium } = require('playwright');
const { createBrowserManager } = require('../src/core/browser');
const { assertLocalUrl, createLocalServer } = require('./helpers/local-server');

test('abre Chromium e navega ate uma pagina local', async () => {
  const server = createLocalServer((_request, response) => {
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end('<!doctype html><title>Playwright smoke</title><main>local fixture</main>');
  });
  const manager = createBrowserManager(chromium);
  let page;

  const baseUrl = await server.start();
  try {
    const browser = await manager.startBrowser({ headless: true });
    page = await browser.newPage();
    const localUrl = assertLocalUrl(`${baseUrl}/smoke`);
    await page.goto(localUrl.toString(), { waitUntil: 'domcontentloaded' });

    assert.equal(await page.title(), 'Playwright smoke');
    assert.equal(await page.locator('main').textContent(), 'local fixture');
  } finally {
    if (page) await page.close();
    await manager.closeBrowser();
    await server.close();
  }
});

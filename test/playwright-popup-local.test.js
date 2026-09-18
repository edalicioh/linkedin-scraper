const assert = require('node:assert/strict');
const test = require('node:test');

const { chromium } = require('playwright');
const { captureExternalUrl } = require('../src/scraper/linkedin');
const { assertLocalUrl, createLocalServer } = require('./helpers/local-server');

test('captura popup e navegacao na mesma aba em paginas locais', async () => {
  const server = createLocalServer((request, response) => {
    response.setHeader('content-type', 'text/html; charset=utf-8');
    if (request.url === '/popup') {
      response.end(
        '<button class="jobs-apply-button--top-card" onclick="window.open(\'/external\')">Apply</button>'
      );
      return;
    }
    if (request.url === '/same-tab') {
      response.end(
        '<button class="jobs-apply-button--top-card" onclick="location.href=\'/external\'">Apply</button>'
      );
      return;
    }
    response.end('<main>external fixture</main>');
  });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const baseUrl = await server.start();

  try {
    await page.goto(assertLocalUrl(`${baseUrl}/popup`).toString());
    const popupUrl = await captureExternalUrl(page, { timeoutMs: 2000 });
    assert.equal(popupUrl, `${baseUrl}/external`);

    await page.goto(assertLocalUrl(`${baseUrl}/same-tab`).toString());
    const sameTabUrl = await captureExternalUrl(page, { timeoutMs: 2000 });
    assert.equal(sameTabUrl, `${baseUrl}/external`);
  } finally {
    await context.close();
    await browser.close();
    await server.close();
  }
});

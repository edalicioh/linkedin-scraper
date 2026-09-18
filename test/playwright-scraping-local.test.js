const assert = require('node:assert/strict');
const fs = require('node:fs').promises;
const path = require('node:path');
const test = require('node:test');

const { chromium } = require('playwright');
const { scrapeJobDetails, scrapeJobLinks } = require('../src/scraper/linkedin');
const { assertLocalUrl, createLocalServer } = require('./helpers/local-server');

const SEARCH_FIXTURE = path.join(__dirname, 'fixtures', 'linkedin', 'search-portuguese.html');

test('executa busca e detalhes em Chromium contra servidor local', async () => {
  const searchFixture = await fs.readFile(SEARCH_FIXTURE, 'utf8');
  const server = createLocalServer((request, response) => {
    response.setHeader('content-type', 'text/html; charset=utf-8');
    if (request.url === '/search') {
      response.end(searchFixture);
      return;
    }
    response.end(`
      <!doctype html>
      <html><body>
        <h1 class="t-24 job-details-jobs-unified-top-card__job-title">Engenheiro Node</h1>
        <div class="job-details-jobs-unified-top-card__company-name"><a>Empresa Local</a></div>
        <div id="job-details"><div class="mt4">Descricao local</div></div>
        <button class="jobs-apply-button--top-card"><span class="artdeco-button__text">Easy Apply</span></button>
      </body></html>
    `);
  });

  const baseUrl = await server.start();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const searchUrl = assertLocalUrl(`${baseUrl}/search`).toString();
    const linksResult = await scrapeJobLinks(page, searchUrl, {
      scroll: { timeoutMs: 1000, waitMs: 0 },
    });

    assert.equal(linksResult.resultsCount, 4204);
    assert.deepEqual(
      linksResult.jobLinks.map((job) => job.jobId),
      ['2001', '2002']
    );

    const details = await scrapeJobDetails(
      page,
      assertLocalUrl(`${baseUrl}/jobs/view/2001`).toString()
    );
    assert.deepEqual(
      {
        title: details.title,
        company: details.company,
        description: details.description,
        type: details.type,
        externalUrl: details.externalUrl,
      },
      {
        title: 'Engenheiro Node',
        company: 'Empresa Local',
        description: 'Descricao local',
        type: 'Easy Apply',
        externalUrl: null,
      }
    );
  } finally {
    await context.close();
    await browser.close();
    await server.close();
  }
});

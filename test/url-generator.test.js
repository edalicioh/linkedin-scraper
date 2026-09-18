const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseSearchUrl,
  generateSearchUrl,
  generatePaginationUrls,
} = require('../src/services/url-generator');

test('preserva location no round-trip da URL de busca', () => {
  const original =
    'https://www.linkedin.com/jobs/search/?keywords=node.js&location=S%C3%A3o%20Paulo&f_TPR=r604800&origin=JOB_SEARCH_PAGE&start=25';
  const parsed = parseSearchUrl(original);
  const generated = new URL(generateSearchUrl(parsed));

  assert.equal(parsed.location, 'São Paulo');
  assert.equal(generated.searchParams.get('keywords'), 'node.js');
  assert.equal(generated.searchParams.get('location'), 'São Paulo');
  assert.equal(generated.searchParams.get('f_TPR'), 'r604800');
  assert.equal(generated.searchParams.get('origin'), 'JOB_SEARCH_PAGE');
  assert.equal(generated.searchParams.get('start'), '25');
});

test('todas as páginas mantêm keywords, location e período', () => {
  const urls = generatePaginationUrls(
    {
      baseUrl: 'https://www.linkedin.com/jobs/search/',
      keywords: 'backend',
      location: 'Brasil',
      timePeriod: 'r86400',
    },
    2,
    25
  );

  assert.equal(urls.length, 2);
  for (const [index, value] of urls.entries()) {
    const url = new URL(value);
    assert.equal(url.searchParams.get('keywords'), 'backend');
    assert.equal(url.searchParams.get('location'), 'Brasil');
    assert.equal(url.searchParams.get('f_TPR'), 'r86400');
    assert.equal(url.searchParams.get('start'), index === 0 ? null : '25');
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeResultsCount,
  parseApplicationType,
  normalizeApplicationType,
} = require('../src/scraper/linkedin-parsers');

test('normalizes localized result counts', () => {
  assert.equal(normalizeResultsCount('4,204 results'), 4204);
  assert.equal(normalizeResultsCount('4.204 resultados'), 4204);
  assert.equal(normalizeResultsCount('4 204 resultados'), 4204);
  assert.equal(normalizeResultsCount('1,2 mil vagas'), 1200);
  assert.equal(normalizeResultsCount('not a count'), null);
});

test('normalizes application types while preserving raw text', () => {
  assert.equal(normalizeApplicationType('Easy Apply'), 'Easy Apply');
  assert.equal(
    normalizeApplicationType('Candidatar-se no site da empresa'),
    'Apply on company website'
  );
  assert.deepEqual(parseApplicationType('Candidatar-se no site da empresa'), {
    raw: 'Candidatar-se no site da empresa',
    normalized: 'Apply on company website',
  });
  assert.deepEqual(parseApplicationType(null), { raw: null, normalized: null });
});

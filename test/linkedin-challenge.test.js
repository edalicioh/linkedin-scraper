const assert = require('node:assert/strict');
const fs = require('node:fs').promises;
const path = require('node:path');
const test = require('node:test');

const browser = require('../src/core/browser');
const scraper = require('../scraper');
const {
  AuthenticationChallengeError,
  assertNoAuthenticationChallenge,
  detectAuthenticationChallenge,
} = require('../src/scraper/linkedin');

const CHALLENGE_FIXTURE = path.join(__dirname, 'fixtures', 'linkedin', 'challenge.html');

test('preserva os exports publicos para as fases seguintes', () => {
  assert.equal(typeof browser.createBrowserManager, 'function');
  assert.equal(typeof browser.startBrowser, 'function');
  assert.equal(typeof browser.closeBrowser, 'function');
  assert.equal(typeof scraper.runScraper, 'function');
  assert.equal(typeof scraper.main, 'function');
  assert.equal(typeof assertNoAuthenticationChallenge, 'function');
});

test('detecta desafio de autenticacao pela URL', async () => {
  const page = {
    url: () => 'https://www.linkedin.com/checkpoint/challenge',
  };

  assert.deepEqual(await detectAuthenticationChallenge(page), {
    challenge: 'checkpoint',
    url: 'https://www.linkedin.com/checkpoint/challenge',
  });
  await assert.rejects(
    assertNoAuthenticationChallenge(page),
    (error) =>
      error instanceof AuthenticationChallengeError &&
      error.code === 'LINKEDIN_AUTH_CHALLENGE' &&
      error.challenge === 'checkpoint' &&
      error.url.endsWith('/checkpoint/challenge')
  );
});

test('detecta desafio de autenticacao por elemento do DOM', async () => {
  const fixture = await fs.readFile(CHALLENGE_FIXTURE, 'utf8');
  assert.match(fixture, /id="checkpoint"/);
  assert.match(fixture, /Verify your identity/);

  const page = {
    url: () => 'https://www.linkedin.com/login',
    evaluate: async () => ({ text: '', hasChallengeElement: true }),
  };

  assert.deepEqual(await detectAuthenticationChallenge(page), {
    challenge: 'challenge element',
    url: 'https://www.linkedin.com/login',
  });
});

test('detecta desafio de autenticacao pelo texto da pagina', async () => {
  const page = {
    url: () => 'https://www.linkedin.com/login',
    evaluate: async () => ({
      text: 'Security verification: verify your identity',
      hasChallengeElement: false,
    }),
  };

  assert.deepEqual(await detectAuthenticationChallenge(page), {
    challenge: 'security verification',
    url: 'https://www.linkedin.com/login',
  });
});

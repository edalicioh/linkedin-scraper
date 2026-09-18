const assert = require('node:assert/strict');
const fs = require('node:fs').promises;
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { loadSession, saveSession } = require('../src/services/session-manager');

async function withTempDirectory(callback) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'linkedin-session-'));
  try {
    return await callback(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test('salva e carrega cookies legados como array', () =>
  withTempDirectory(async (directory) => {
    const filePath = path.join(directory, 'nested', 'cookies.json');
    const cookies = [{ name: 'li_at', value: 'session', domain: '.linkedin.com' }];
    const received = [];
    const page = {
      cookies: async () => cookies,
      setCookie: async (...loadedCookies) => received.push(...loadedCookies),
    };

    await saveSession(page, filePath);
    assert.deepEqual(JSON.parse(await fs.readFile(filePath, 'utf8')), cookies);
    assert.equal(await loadSession(page, filePath), true);
    assert.deepEqual(received, cookies);
  }));

test('trata arquivo de cookies ausente ou array vazio como sessao inexistente', () =>
  withTempDirectory(async (directory) => {
    const page = { setCookie: async () => assert.fail('nao deveria carregar cookies') };
    assert.equal(await loadSession(page, path.join(directory, 'missing.json')), false);

    const emptyPath = path.join(directory, 'empty.json');
    await fs.writeFile(emptyPath, '[]');
    assert.equal(await loadSession(page, emptyPath), false);
  }));

test('propaga JSON de cookies corrompido', () =>
  withTempDirectory(async (directory) => {
    const filePath = path.join(directory, 'corrupt.json');
    await fs.writeFile(filePath, '{not-json');

    await assert.rejects(loadSession({ setCookie: async () => {} }, filePath), SyntaxError);
  }));

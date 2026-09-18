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
    const context = {
      cookies: async () => cookies,
      addCookies: async (loadedCookies) => received.push(...loadedCookies),
    };

    await saveSession(context, filePath);
    assert.deepEqual(JSON.parse(await fs.readFile(filePath, 'utf8')), cookies);
    assert.equal(await loadSession(context, filePath), true);
    assert.deepEqual(received, cookies);
  }));

test('trata arquivo de cookies ausente ou array vazio como sessao inexistente', () =>
  withTempDirectory(async (directory) => {
    const context = { addCookies: async () => assert.fail('nao deveria carregar cookies') };
    assert.equal(await loadSession(context, path.join(directory, 'missing.json')), false);

    const emptyPath = path.join(directory, 'empty.json');
    await fs.writeFile(emptyPath, '[]');
    assert.equal(await loadSession(context, emptyPath), false);
  }));

test('propaga JSON de cookies corrompido', () =>
  withTempDirectory(async (directory) => {
    const filePath = path.join(directory, 'corrupt.json');
    await fs.writeFile(filePath, '{not-json');

    await assert.rejects(loadSession({ addCookies: async () => {} }, filePath), SyntaxError);
  }));

test('normaliza cookies legados e ignora campos extras', () =>
  withTempDirectory(async (directory) => {
    const filePath = path.join(directory, 'cookies.json');
    await fs.writeFile(
      filePath,
      JSON.stringify([
        {
          name: 'li_at',
          value: 'session',
          domain: '.linkedin.com',
          sameSite: 'lax',
          expirationDate: 123,
          hostOnly: false,
        },
      ])
    );
    const received = [];

    assert.equal(
      await loadSession({ addCookies: async (cookies) => received.push(...cookies) }, filePath),
      true
    );
    assert.deepEqual(received, [
      {
        name: 'li_at',
        value: 'session',
        domain: '.linkedin.com',
        sameSite: 'Lax',
      },
    ]);
  }));

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const config = require('../src/core/config');

test('importar a configuração sem credenciais não encerra o processo', () => {
  const output = execFileSync(
    process.execPath,
    ['-e', "require('./src/core/config'); process.stdout.write('import-ok')"],
    {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, LINKEDIN_EMAIL: '', LINKEDIN_PASSWORD: '' },
      encoding: 'utf8',
    }
  );

  assert.equal(output, 'import-ok');
});

test('configuração centraliza os caminhos e valida credenciais e limite', () => {
  assert.match(config.STORAGE_DIR, /storage$/);
  assert.equal(config.JOBS_FILE_PATH, path.join(config.STORAGE_DIR, 'vagas.json'));
  assert.equal(config.COOKIES_FILE_PATH, path.join(config.STORAGE_DIR, 'cookies.json'));
  assert.throws(() => config.validateCredentials(config.parseConfig({})), /Credenciais/);
  assert.equal(config.validateScrapeLimit(3), 3);
  assert.throws(() => config.validateScrapeLimit(0), /inteiro positivo/);
});

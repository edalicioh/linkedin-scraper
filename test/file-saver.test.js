const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs').promises;
const os = require('node:os');
const path = require('node:path');

const { saveAsJson, appendAsJson, readJsonArray } = require('../src/services/file-saver');

async function withTempDirectory(callback) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'linkedin-scraper-'));
  try {
    return await callback(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test('cria storage e grava JSON por substituição atômica', () =>
  withTempDirectory(async (directory) => {
    const storageDir = path.join(directory, 'nested', 'storage');
    await saveAsJson('vagas.json', [{ jobId: '1' }], { storageDir });

    const filePath = path.join(storageDir, 'vagas.json');
    assert.deepEqual(JSON.parse(await fs.readFile(filePath, 'utf8')), [{ jobId: '1' }]);
    assert.deepEqual(await readJsonArray('vagas.json', { storageDir }), [{ jobId: '1' }]);
    assert.deepEqual(await readJsonArray('missing.json', { storageDir }), []);
    assert.deepEqual(await fs.readdir(storageDir), ['vagas.json']);
  }));

test('append propaga JSON corrompido e não sobrescreve o arquivo', () =>
  withTempDirectory(async (directory) => {
    const storageDir = path.join(directory, 'storage');
    await fs.mkdir(storageDir, { recursive: true });
    const filePath = path.join(storageDir, 'vagas.json');
    await fs.writeFile(filePath, '{corrompido', 'utf8');

    await assert.rejects(
      appendAsJson('vagas.json', [{ jobId: '2' }], { storageDir }),
      /JSON inválido/
    );
    assert.equal(await fs.readFile(filePath, 'utf8'), '{corrompido');
  }));

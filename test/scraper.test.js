process.env.LINKEDIN_EMAIL = process.env.LINKEDIN_EMAIL || 'test@example.com';
process.env.LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD || 'test-password';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs').promises;
const os = require('node:os');
const path = require('node:path');

const { runScraper } = require('../scraper');
const { saveAsJson } = require('../src/services/file-saver');

async function withTempDirectory(callback) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'linkedin-scraper-'));
  try {
    return await callback(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test('deduplica vagas existentes e repetidas na execução e retorna resumo', () => withTempDirectory(async (storageDir) => {
  await saveAsJson('vagas.json', [{ jobId: 'existing' }], { storageDir });
  const visitedUrls = [];
  const details = [];

  const result = await runScraper('node', 'São Paulo', {
    limit: 2,
    maxPages: 2,
    storageDir,
    dependencies: {
      startBrowser: async () => ({ newPage: async () => ({}) }),
      ensureLoggedIn: async () => {},
      scrapeJobLinks: async (_page, url) => {
        visitedUrls.push(url);
        const page = visitedUrls.length;
        return {
          resultsCount: page === 1 ? 4 : null,
          jobLinks: page === 1
            ? [
              { jobId: 'existing', url: 'https://jobs/existing' },
              { jobId: 'new-1', url: 'https://jobs/new-1' },
              { jobId: 'new-1', url: 'https://jobs/new-1-duplicate' },
            ]
            : [
              { jobId: 'new-2', url: 'https://jobs/new-2' },
              { jobId: 'new-3', url: 'https://jobs/new-3' },
            ],
        };
      },
      scrapeJobDetails: async (_page, url) => {
        details.push(url);
        return { title: url };
      },
    },
  });

  assert.equal(result.found, 5);
  assert.equal(result.ignored, 2);
  assert.equal(result.processed, 2);
  assert.equal(result.saved, 2);
  assert.equal(result.totalResults, 4);
  assert.equal(visitedUrls.length, 2);
  assert.ok(visitedUrls.every((url) => url.includes('location=S%C3%A3o+Paulo')));
  assert.deepEqual(details, ['https://jobs/new-1', 'https://jobs/new-2']);

  const saved = JSON.parse(await fs.readFile(path.join(storageDir, 'vagas.json'), 'utf8'));
  assert.deepEqual(saved.map((job) => job.jobId), ['existing', 'new-1', 'new-2']);
}));

test('relança falhas fatais do scraper', async () => {
  await assert.rejects(
    runScraper('node', 'Brasil', {
      dependencies: {
        startBrowser: async () => ({ newPage: async () => ({}) }),
        ensureLoggedIn: async () => {},
        scrapeJobLinks: async () => {
          throw new Error('falha de navegação');
        },
      },
    }),
    /falha de navegação/,
  );
});

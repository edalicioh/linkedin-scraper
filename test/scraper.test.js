process.env.LINKEDIN_EMAIL = process.env.LINKEDIN_EMAIL || 'test@example.com';
process.env.LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD || 'test-password';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs').promises;
const os = require('node:os');
const path = require('node:path');

const { runScraper } = require('../scraper');
const { createDatabase } = require('../src/db/database');
const { createJobRepository } = require('../src/repositories/jobRepository');

async function withTempDirectory(callback) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'linkedin-scraper-'));
  try {
    return await callback(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test('deduplica vagas existentes e repetidas na execução e retorna resumo', () =>
  withTempDirectory(async (storageDir) => {
    const dbPath = path.join(storageDir, 'jobs.db');
    const seedDb = createDatabase(dbPath);
    createJobRepository(seedDb).upsert({
      jobId: 'existing',
      title: 'Existing job',
      description: 'Existing description',
      jobLocation: 'São Paulo, SP',
      url: 'https://jobs/existing',
      aiIsPj: true,
      aiIsRemote: true,
      aiScore: 80,
    });
    seedDb.close();

    const visitedUrls = [];
    const details = [];
    const jobDelays = [];
    const context = {
      closeCalls: 0,
      newPage: async () => ({ close: async () => {} }),
      close: async function close() {
        this.closeCalls += 1;
      },
    };
    const result = await runScraper('node', 'São Paulo', {
      limit: 2,
      maxPages: 2,
      dbPath,
      dependencies: {
        startBrowser: async () => ({ newContext: async () => context }),
        ensureLoggedIn: async () => {},
        jobDelayMinMs: 1000,
        jobDelayMaxMs: 2000,
        jobDelayRandom: () => 0.5,
        waitBetweenJobs: async (delay) => jobDelays.push(delay),
        scrapeJobLinks: async (_page, url) => {
          visitedUrls.push(url);
          const page = visitedUrls.length;
          return {
            resultsCount: page === 1 ? 4 : null,
            jobLinks:
              page === 1
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
          return { title: url, jobLocation: 'São Paulo, SP', url };
        },
        rankJob: async () => ({
          eligible: true,
          isPJ: true,
          isRemote: true,
          score: 90,
          summary: 'Compatível',
          evidence: {},
          criteria: {},
          model: 'test-model',
          profileVersion: 'test',
          scoredAt: '2026-01-01T00:00:00.000Z',
        }),
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
    assert.deepEqual(jobDelays, [1500]);

    const readDb = createDatabase(dbPath);
    const saved = createJobRepository(readDb).listAll();
    readDb.close();
    assert.deepEqual(
      saved.map((job) => job.jobId),
      ['existing', 'new-1', 'new-2']
    );
    assert.equal(saved.find((job) => job.jobId === 'new-1').jobLocation, 'São Paulo, SP');
    assert.equal(context.closeCalls, 1);
  }));

test('relança falhas fatais do scraper', () =>
  withTempDirectory(async (storageDir) => {
    await assert.rejects(
      runScraper('node', 'Brasil', {
        dbPath: path.join(storageDir, 'jobs.db'),
        dependencies: {
          startBrowser: async () => ({
            newContext: async () => ({
              newPage: async () => ({ close: async () => {} }),
              close: async () => {},
            }),
          }),
          ensureLoggedIn: async () => {},
          scrapeJobLinks: async () => {
            throw new Error('falha de navegação');
          },
        },
      }),
      /falha de navegação/
    );
  }));

test('limita detalhes e chamadas da IA ao limite da sessão', () =>
  withTempDirectory(async (storageDir) => {
    const details = [];
    const ranked = [];
    const context = {
      newPage: async () => ({ close: async () => {} }),
      close: async () => {},
    };
    const result = await runScraper('node', 'Brasil', {
      limit: 2,
      dbPath: path.join(storageDir, 'jobs.db'),
      dependencies: {
        startBrowser: async () => ({ newContext: async () => context }),
        ensureLoggedIn: async () => {},
        scrapeJobLinks: async () => ({
          resultsCount: 3,
          jobLinks: [
            { jobId: 'reject', url: 'https://jobs/reject' },
            { jobId: 'accept', url: 'https://jobs/accept' },
            { jobId: 'never-reached', url: 'https://jobs/never-reached' },
          ],
        }),
        scrapeJobDetails: async (_page, url) => {
          details.push(url);
          return { title: url, description: 'description', url };
        },
        rankJob: async (job) => {
          ranked.push(job.jobId);
          return {
            eligible: job.jobId === 'accept',
            isPJ: job.jobId === 'accept',
            isRemote: job.jobId === 'accept',
            score: job.jobId === 'accept' ? 91 : 20,
            summary: '',
            evidence: {},
            criteria: {},
            model: 'test-model',
            profileVersion: 'test',
            scoredAt: '2026-01-01T00:00:00.000Z',
          };
        },
      },
    });

    assert.equal(result.processed, 2);
    assert.equal(result.rejected, 1);
    assert.deepEqual(details, ['https://jobs/reject', 'https://jobs/accept']);
    assert.deepEqual(ranked, ['reject', 'accept']);

    const readDb = createDatabase(path.join(storageDir, 'jobs.db'));
    const saved = createJobRepository(readDb).listAll();
    readDb.close();
    assert.deepEqual(new Set(saved.map((job) => job.jobId)), new Set(['reject', 'accept']));
    assert.equal(saved.find((job) => job.jobId === 'reject').ai.eligible, false);
  }));

test('salva os metadados quando a IA falha', () =>
  withTempDirectory(async (storageDir) => {
    const context = {
      newPage: async () => ({ close: async () => {} }),
      close: async () => {},
    };
    const result = await runScraper('node', 'Brasil', {
      limit: 1,
      dbPath: path.join(storageDir, 'jobs.db'),
      dependencies: {
        startBrowser: async () => ({ newContext: async () => context }),
        ensureLoggedIn: async () => {},
        scrapeJobLinks: async () => ({
          resultsCount: 1,
          jobLinks: [{ jobId: 'ai-failure', url: 'https://jobs/ai-failure' }],
        }),
        scrapeJobDetails: async (_page, url) => ({
          title: 'Vaga sem classificação',
          description: 'Metadados preservados',
          url,
        }),
        rankJob: async () => {
          throw new Error('IA indisponível');
        },
      },
    });

    assert.equal(result.saved, 1);
    assert.equal(result.aiFailed, 1);

    const readDb = createDatabase(path.join(storageDir, 'jobs.db'));
    const saved = createJobRepository(readDb).listAll();
    readDb.close();
    assert.equal(saved[0].title, 'Vaga sem classificação');
    assert.equal(saved[0].ai, null);
  }));

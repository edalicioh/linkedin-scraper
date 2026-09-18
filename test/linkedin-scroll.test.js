const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs').promises;
const os = require('node:os');
const path = require('node:path');
const {
  AuthenticationChallengeError,
  assertNoAuthenticationChallenge,
  collectJobLinks,
  detectAuthenticationChallenge,
  saveFailureScreenshot,
  typeWithDelay
} = require('../src/scraper/linkedin');

test('accumulates cards removed by a virtualized list', async () => {
  const visible = [
    [
      { jobId: '1', url: 'https://www.linkedin.com/jobs/view/1' },
      { jobId: '2', url: 'https://www.linkedin.com/jobs/view/2' }
    ],
    [
      { jobId: '2', url: 'https://www.linkedin.com/jobs/view/2' },
      { jobId: '3', url: 'https://www.linkedin.com/jobs/view/3' }
    ],
    [{ jobId: '3', url: 'https://www.linkedin.com/jobs/view/3' }]
  ];
  let evaluateCalls = 0;
  let scrolls = 0;
  const page = {
    async evaluate(callback) {
      evaluateCalls += 1;
      if (evaluateCalls % 2 === 1) return visible[Math.min(scrolls, visible.length - 1)];
      scrolls += 1;
      return scrolls < visible.length;
    }
  };

  const links = await collectJobLinks(page, { waitMs: 0, timeoutMs: 1000, maxIterations: 10 });
  assert.deepEqual(links, [
    { jobId: '1', url: 'https://www.linkedin.com/jobs/view/1' },
    { jobId: '2', url: 'https://www.linkedin.com/jobs/view/2' },
    { jobId: '3', url: 'https://www.linkedin.com/jobs/view/3' }
  ]);
});

test('typing delay uses the injected random function', async () => {
  let received;
  const page = {
    async type(selector, value, options) {
      received = { selector, value, options };
    }
  };

  await typeWithDelay(page, '#username', 'user', { min: 10, max: 20, random: () => 0.5 });
  assert.deepEqual(received, {
    selector: '#username',
    value: 'user',
    options: { delay: 15 }
  });
});

test('detects authentication challenges from URL and keeps a unique screenshot', async () => {
  const page = {
    url: () => 'https://www.linkedin.com/checkpoint/challenge',
    async screenshot({ path: screenshotPath }) {
      await fs.writeFile(screenshotPath, 'fixture');
    }
  };
  const challenge = await detectAuthenticationChallenge(page);
  assert.equal(challenge.challenge, 'checkpoint');
  await assert.rejects(() => assertNoAuthenticationChallenge(page), AuthenticationChallengeError);

  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'linkedin-screenshot-'));
  const screenshotPath = await saveFailureScreenshot(page, { directory, prefix: 'failure' });
  assert.match(path.basename(screenshotPath), /^failure-\d+-[0-9a-f-]+\.png$/);
  assert.deepEqual(await fs.readdir(directory), [path.basename(screenshotPath)]);
  await fs.rm(directory, { recursive: true, force: true });
});

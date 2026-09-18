const test = require('node:test');
const assert = require('node:assert/strict');

const { MemoryTaskStore } = require('../src/services/memoryTaskStore');
const { QueueFullError, ScrapeQueue } = require('../src/services/scrapeQueue');

const tick = () => new Promise(resolve => setImmediate(resolve));

test('runs tasks FIFO with only one runner active', async () => {
  const store = new MemoryTaskStore();
  const releases = [];
  const started = [];
  let active = 0;
  let maxActive = 0;

  const queue = new ScrapeQueue({
    store,
    maxBacklog: 10,
    runner: async input => {
      started.push(input.keywords);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => releases.push(resolve));
      active -= 1;
    },
  });

  for (let index = 0; index < 10; index += 1) {
    queue.enqueue({ keywords: `job-${index}`, location: 'Brasil' });
  }

  await tick();
  assert.deepEqual(started, ['job-0']);
  assert.equal(maxActive, 1);

  const idle = queue.waitForIdle();
  for (let index = 0; index < 10; index += 1) {
    assert.equal(releases.length, 1);
    releases.shift()();
    await tick();
  }
  await idle;

  assert.deepEqual(started, Array.from({ length: 10 }, (_, index) => `job-${index}`));
  assert.equal(maxActive, 1);
  assert.equal(queue.size(), 0);
});

test('marks failures safely and continues with the next task', async () => {
  const store = new MemoryTaskStore();
  let calls = 0;
  const queue = new ScrapeQueue({
    store,
    runner: async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('password=super-secret');
      }
      return { status: 'PARTIAL', counts: { jobs: 2 } };
    },
  });

  const failed = queue.enqueue({ keywords: 'first', location: 'Brasil' });
  const partial = queue.enqueue({ keywords: 'second', location: 'Brasil' });
  await queue.waitForIdle();

  const failedTask = store.get(failed.id);
  const partialTask = store.get(partial.id);
  assert.equal(failedTask.status, 'FAILED');
  assert.deepEqual(failedTask.error, { message: 'password=[redacted]' });
  assert.equal(Object.hasOwn(failedTask.error, 'stack'), false);
  assert.equal(partialTask.status, 'PARTIAL');
  assert.deepEqual(partialTask.counts, { jobs: 2 });
});

test('rejects work when the backlog is full without creating a task', async () => {
  let release;
  let calls = 0;
  const queue = new ScrapeQueue({
    store: new MemoryTaskStore(),
    maxBacklog: 2,
    runner: () => {
      calls += 1;
      if (calls === 1) {
        return new Promise(resolve => {
          release = resolve;
        });
      }
      return Promise.resolve();
    },
  });

  queue.enqueue({ keywords: 'first', location: 'Brasil' });
  queue.enqueue({ keywords: 'second', location: 'Brasil' });
  assert.throws(
    () => queue.enqueue({ keywords: 'third', location: 'Brasil' }),
    error => error instanceof QueueFullError && error.code === 'QUEUE_FULL',
  );
  assert.equal(queue.store.size(), 2);

  release();
  await queue.waitForIdle();
});

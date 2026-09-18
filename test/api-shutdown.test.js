const assert = require('node:assert/strict');
const test = require('node:test');

const { createShutdown } = require('../api');

function createServer() {
  return {
    close(callback) {
      callback();
    },
  };
}

test('shutdown aguarda tarefa ativa antes de fechar o browser', async () => {
  let release;
  let closeCalls = 0;
  const queue = {
    waitForIdle: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  };
  const shutdown = createShutdown(
    createServer(),
    async () => {
      closeCalls += 1;
    },
    queue,
    { shutdownTimeoutMs: 1000 }
  );

  const pending = shutdown();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(closeCalls, 0);
  release();
  await pending;
  assert.equal(closeCalls, 1);
});

test('shutdown fecha imediatamente com fila vazia e e idempotente', async () => {
  let closeCalls = 0;
  const queue = { waitForIdle: async () => {} };
  const shutdown = createShutdown(
    createServer(),
    async () => {
      closeCalls += 1;
    },
    queue
  );

  const first = shutdown();
  const second = shutdown();
  assert.equal(first, second);
  await first;
  assert.equal(closeCalls, 1);
});

test('shutdown fecha browser apos timeout da fila', async () => {
  let closeCalls = 0;
  const queue = { waitForIdle: () => new Promise(() => {}) };
  const shutdown = createShutdown(
    createServer(),
    async () => {
      closeCalls += 1;
    },
    queue,
    { shutdownTimeoutMs: 5 }
  );

  await shutdown();
  assert.equal(closeCalls, 1);
});

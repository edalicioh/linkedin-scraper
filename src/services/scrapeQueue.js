const { MemoryTaskStore, TASK_STATES } = require('./memoryTaskStore');

const DEFAULT_MAX_BACKLOG = 10;

class QueueFullError extends Error {
  constructor(maxBacklog) {
    super('The scrape queue is full.');
    this.name = 'QueueFullError';
    this.code = 'QUEUE_FULL';
    this.maxBacklog = maxBacklog;
  }
}

function sanitizeError(error) {
  const rawMessage = error && typeof error.message === 'string'
    ? error.message
    : String(error || 'Scrape task failed.');
  const message = rawMessage
    .replace(/(password|passwd|token|secret|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .slice(0, 500);

  return { message: message || 'Scrape task failed.' };
}

function getResultCounts(result) {
  if (!result || typeof result !== 'object' || !result.counts || typeof result.counts !== 'object') {
    return {};
  }

  return { ...result.counts };
}

class ScrapeQueue {
  constructor({ runner, store = new MemoryTaskStore(), maxBacklog = DEFAULT_MAX_BACKLOG } = {}) {
    if (typeof runner !== 'function') {
      throw new TypeError('A scrape queue runner is required.');
    }
    if (!Number.isInteger(maxBacklog) || maxBacklog < 1) {
      throw new TypeError('maxBacklog must be a positive integer.');
    }

    this.runner = runner;
    this.store = store;
    this.maxBacklog = maxBacklog;
    this.pending = [];
    this.running = false;
    this.idleWaiters = [];
  }

  enqueue(input) {
    if (this.pending.length + (this.running ? 1 : 0) >= this.maxBacklog) {
      throw new QueueFullError(this.maxBacklog);
    }

    const task = this.store.create(input);
    this.pending.push({ taskId: task.id, input: task.input });
    this.pump();
    return task;
  }

  size() {
    return this.pending.length + (this.running ? 1 : 0);
  }

  waitForIdle() {
    if (!this.running && this.pending.length === 0) {
      return Promise.resolve();
    }

    return new Promise(resolve => this.idleWaiters.push(resolve));
  }

  pump() {
    if (this.running || this.pending.length === 0) {
      return;
    }

    const item = this.pending.shift();
    this.running = true;
    void this.process(item);
  }

  async process(item) {
    try {
      this.store.update(item.taskId, {
        status: TASK_STATES.RUNNING,
        startedAt: new Date().toISOString(),
      });

      try {
        const result = await this.runner(item.input);
        const status = result && result.status === TASK_STATES.PARTIAL
          ? TASK_STATES.PARTIAL
          : TASK_STATES.COMPLETED;
        this.store.update(item.taskId, {
          status,
          counts: getResultCounts(result),
          completedAt: new Date().toISOString(),
        });
      } catch (error) {
        this.store.update(item.taskId, {
          status: TASK_STATES.FAILED,
          error: sanitizeError(error),
          completedAt: new Date().toISOString(),
        });
      }
    } finally {
      this.running = false;
      this.pump();
      if (!this.running && this.pending.length === 0) {
        const waiters = this.idleWaiters.splice(0);
        waiters.forEach(resolve => resolve());
      }
    }
  }
}

module.exports = {
  DEFAULT_MAX_BACKLOG,
  QueueFullError,
  ScrapeQueue,
  sanitizeError,
};

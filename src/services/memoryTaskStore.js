const { randomUUID } = require('crypto');

const TASK_STATES = Object.freeze({
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
});

function normalizeInput(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('A scrape task must have an input object.');
  }

  const keywords = typeof input.keywords === 'string' ? input.keywords.trim() : '';
  const location = typeof input.location === 'string' ? input.location.trim() : '';

  if (!keywords || !location) {
    throw new TypeError('A scrape task requires keywords and location.');
  }

  return { keywords, location };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class MemoryTaskStore {
  constructor({ idGenerator = randomUUID, clock = () => new Date() } = {}) {
    this.idGenerator = idGenerator;
    this.clock = clock;
    this.tasks = new Map();
  }

  create(input) {
    const now = this.clock().toISOString();
    const task = {
      id: this.idGenerator(),
      input: normalizeInput(input),
      status: TASK_STATES.PENDING,
      counts: {},
      error: null,
      createdAt: now,
      startedAt: null,
      completedAt: null,
    };

    this.tasks.set(task.id, task);
    return clone(task);
  }

  get(taskId) {
    const task = this.tasks.get(taskId);
    return task ? clone(task) : null;
  }

  update(taskId, changes) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }

    const { counts, ...otherChanges } = changes;
    Object.assign(task, otherChanges);
    if (counts) {
      task.counts = { ...task.counts, ...counts };
    }
    return clone(task);
  }

  size() {
    return this.tasks.size;
  }
}

module.exports = {
  MemoryTaskStore,
  TASK_STATES,
  normalizeInput,
};

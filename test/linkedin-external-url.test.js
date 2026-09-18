const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { captureExternalUrl } = require('../src/scraper/linkedin');

class FakeBrowser extends EventEmitter {}

test('captures only a popup opened by the current page and closes it', async () => {
  const browser = new FakeBrowser();
  const sourceTarget = {};
  const unrelatedTarget = {
    opener: () => ({}),
    page: async () => ({ url: () => 'https://unrelated.example/app' })
  };
  let closed = false;
  const popup = {
    url: () => 'https://company.example/apply',
    isClosed: () => closed,
    close: async () => { closed = true; }
  };
  const currentTarget = {
    opener: () => sourceTarget,
    page: async () => popup
  };
  const page = {
    target: () => sourceTarget,
    browser: () => browser,
    url: () => 'https://www.linkedin.com/jobs/view/1',
    async click() {
      browser.emit('targetcreated', unrelatedTarget);
      browser.emit('targetcreated', currentTarget);
    },
    async $(selector) {
      assert.equal(selector, '.artdeco-modal');
      return null;
    }
  };

  assert.equal(await captureExternalUrl(page, { timeoutMs: 500, wait: async () => {} }), 'https://company.example/apply');
  assert.equal(closed, true);
  assert.equal(browser.listenerCount('targetcreated'), 0);
});

test('returns null when no external URL is opened', async () => {
  const browser = new FakeBrowser();
  const sourceTarget = {};
  const page = {
    target: () => sourceTarget,
    browser: () => browser,
    url: () => 'https://www.linkedin.com/jobs/view/2',
    async click() {},
    async $() { return null; }
  };

  assert.equal(await captureExternalUrl(page, { timeoutMs: 5, wait: async () => {} }), null);
  assert.equal(browser.listenerCount('targetcreated'), 0);
});

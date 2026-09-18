const assert = require('node:assert/strict');
const fs = require('node:fs').promises;
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { ensureLoggedIn } = require('../src/scraper/linkedin');

const LOGIN_FIXTURE = path.join(__dirname, 'fixtures', 'linkedin', 'login.html');

function createLoginPage({ sessionExpired = false } = {}) {
  let currentUrl = 'about:blank';
  let loggedIn = false;
  const calls = {
    goto: [],
    types: [],
    clicks: [],
  };

  const page = {
    calls,
    url: () => currentUrl,
    goto: async (url) => {
      const parsedUrl = new URL(url);
      assert.equal(parsedUrl.hostname, 'www.linkedin.com');
      currentUrl = url;
      calls.goto.push(url);
    },
    evaluate: async () => ({ text: '', hasChallengeElement: false }),
    waitForSelector: async (selector) => {
      if (selector === '#global-nav') {
        if (currentUrl.includes('/feed/') && sessionExpired) {
          throw new Error('sessao expirada');
        }
        if (loggedIn || currentUrl.includes('/feed/')) return;
      }

      if (currentUrl.includes('/login')) {
        const loginSelectors = new Set(['#username', '#password', 'button[data-id*="sign-in" i]']);
        if (loginSelectors.has(selector)) return;
      }

      throw new Error(`seletor ausente: ${selector}`);
    },
    type: async (selector, value, options) => {
      calls.types.push({ selector, value, options });
    },
    click: async (selector) => {
      calls.clicks.push(selector);
      loggedIn = true;
    },
  };

  return page;
}

function loginOptions(overrides = {}) {
  return {
    credentials: {
      linkedinEmail: 'fixture@example.test',
      linkedinPassword: 'fixture-password',
    },
    typing: { min: 0, max: 0, random: () => 0 },
    ...overrides,
  };
}

test('a fixture de login cobre campos e submit alternativos', async () => {
  const fixture = await fs.readFile(LOGIN_FIXTURE, 'utf8');
  assert.match(fixture, /id="username"/);
  assert.match(fixture, /id="password"/);
  assert.match(fixture, /data-id="sign-in-submit"/);

  const page = createLoginPage();
  const savedPages = [];
  await ensureLoggedIn(
    page,
    loginOptions({
      loadSession: async () => false,
      saveSession: async (receivedPage) => savedPages.push(receivedPage),
    })
  );

  assert.deepEqual(page.calls.types, [
    { selector: '#username', value: 'fixture@example.test', options: { delay: 0 } },
    { selector: '#password', value: 'fixture-password', options: { delay: 0 } },
  ]);
  assert.deepEqual(page.calls.clicks, ['button[data-id*="sign-in" i]']);
  assert.equal(savedPages.length, 1);
  assert.deepEqual(page.calls.goto, ['https://www.linkedin.com/login']);
});

test('pula login quando a sessao carregada esta valida', async () => {
  const page = createLoginPage();
  let saveCalls = 0;

  await ensureLoggedIn(
    page,
    loginOptions({
      loadSession: async () => true,
      saveSession: async () => {
        saveCalls += 1;
      },
    })
  );

  assert.deepEqual(page.calls.goto, ['https://www.linkedin.com/feed/']);
  assert.equal(page.calls.types.length, 0);
  assert.equal(saveCalls, 0);
});

test('descarta sessao expirada e refaz o login local', async () => {
  const page = createLoginPage({ sessionExpired: true });
  let loadCalls = 0;
  let saveCalls = 0;

  await ensureLoggedIn(
    page,
    loginOptions({
      loadSession: async () => {
        loadCalls += 1;
        return true;
      },
      saveSession: async () => {
        saveCalls += 1;
      },
    })
  );

  assert.equal(loadCalls, 1);
  assert.equal(saveCalls, 1);
  assert.deepEqual(page.calls.goto, [
    'https://www.linkedin.com/feed/',
    'https://www.linkedin.com/login',
  ]);
});

test('nao mascara erro original quando screenshot de login falha', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'linkedin-login-failure-'));
  const originalError = new Error('falha local de login');
  const page = {
    url: () => 'about:blank',
    goto: async () => {
      throw originalError;
    },
    evaluate: async () => ({ text: '', hasChallengeElement: false }),
    screenshot: async () => {
      throw new Error('falha ao salvar screenshot');
    },
  };

  try {
    await assert.rejects(
      ensureLoggedIn(
        page,
        loginOptions({
          loadSession: async () => false,
          screenshot: { directory },
        })
      ),
      (error) => error === originalError
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

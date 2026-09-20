const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { loadSession, saveSession } = require('../services/session-manager');
const {
  normalizeResultsCount,
  parseApplicationType,
  APPLICATION_TYPES
} = require('./linkedin-parsers');

const SCREENSHOT_DIRECTORY = path.join(__dirname, '..', '..', 'storage', 'screenshots');
const DEFAULT_SCROLL_OPTIONS = {
  maxIterations: 30,
  timeoutMs: 15000,
  noProgressRounds: 2,
  step: 700,
  waitMs: 100
};
const JOB_DETAIL_SELECTORS = {
  title: [
    '.job-details-jobs-unified-top-card__job-title',
    '[class*="job-details-jobs-unified-top-card__job-title"]',
    '.top-card-layout__title',
    '.topcard__title',
    '.sub-nav-cta__header',
    'h1[class*="job-title" i]',
    'h1'
  ],
  company: [
    'div.job-details-jobs-unified-top-card__company-name a',
    '.job-details-jobs-unified-top-card__company-name',
    '[class*="job-details"][class*="company-name"] a',
    'a[href*="/company/"]'
  ],
  location: [
    '.job-details-jobs-unified-top-card__primary-description-container a',
    '.job-details-jobs-unified-top-card__primary-description-container .tvm__text',
    '.top-card-layout__first-subline a',
    '.top-card-layout__second-subline',
    '.topcard__flavor',
    '[class*="job-location"]'
  ],
  description: [
    '[id^="JobDetails_AboutTheJob_"] [data-testid="expandable-text-box"]',
    '[data-sdui-component$=".aboutTheJob"] [data-testid="expandable-text-box"]',
    '[id^="JobDetails_AboutTheJob_"]',
    '#job-details .mt4',
    '#job-details .jobs-description-content__text',
    '.jobs-description-content__text',
    '.jobs-description__content',
    '.jobs-box__html-content',
    '[data-test-job-details-description]',
    '[class*="jobs-description"]',
    '.description__text .show-more-less-html__markup',
    '.show-more-less-html__markup',
    '.description__text'
  ],
  applyButton: [
    '.jobs-apply-button--top-card',
    'button.jobs-apply-button',
    'button[aria-label*="apply" i]',
    'button[aria-label*="candidatar" i]'
  ]
};

class AuthenticationChallengeError extends Error {
  constructor(challenge, url) {
    super(`LinkedIn requires human authentication: ${challenge}`);
    this.name = 'AuthenticationChallengeError';
    this.code = 'LINKEDIN_AUTH_CHALLENGE';
    this.challenge = challenge;
    this.url = url || null;
  }
}

class ScraperTimeoutError extends Error {
  constructor(operation) {
    super(`Timed out while ${operation}`);
    this.name = 'ScraperTimeoutError';
    this.code = 'LINKEDIN_SCRAPER_TIMEOUT';
  }
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function getPageUrl(page) {
  try {
    return typeof page.url === 'function' ? page.url() : '';
  } catch (_error) {
    return '';
  }
}

function isAuthenticatedPage(page) {
  return /linkedin\.com\/(?:feed|in|jobs)(?:[/?#]|$)/i.test(getPageUrl(page));
}

function isExternalUrl(value) {
  if (!value || typeof value !== 'string') return false;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? !/(^|\.)linkedin\.com$/i.test(url.hostname)
      : false;
  } catch (_error) {
    return false;
  }
}

/**
 * Reads challenge signals without relying on a specific LinkedIn selector.
 * @param {import('playwright').Page} page
 * @returns {Promise<{challenge: string, url: string}|null>}
 */
async function detectAuthenticationChallenge(page) {
  const url = getPageUrl(page);
  const urlSignal = url.match(/(?:checkpoint|challenge|captcha|two-factor|2fa|verify)/i);
  if (urlSignal) {
    return { challenge: urlSignal[0].toLowerCase(), url };
  }

  if (typeof page.evaluate !== 'function') return null;

  const signals = await page.evaluate(() => {
    const body = document.body?.innerText || '';
    const title = document.title || '';
    const selectors = [
      '[id*="captcha" i]',
      '[class*="captcha" i]',
      '[id*="checkpoint" i]',
      '[class*="checkpoint" i]',
      '[id*="challenge" i]',
      '[class*="challenge" i]',
      'input[name*="pin" i]',
      'input[name*="verification" i]'
    ];
    return {
      text: `${title}\n${body}`.slice(0, 10000),
      hasChallengeElement: selectors.some(selector => document.querySelector(selector))
    };
  });

  if (signals?.hasChallengeElement) {
    return { challenge: 'challenge element', url };
  }

  const textSignal = String(signals?.text || '').match(
    /captcha|checkpoint|security verification|verify your identity|two-factor|2fa|verification code|confirm it's you|verificação de segurança|código de verificação/i
  );
  return textSignal ? { challenge: textSignal[0].toLowerCase(), url } : null;
}

async function assertNoAuthenticationChallenge(page) {
  const challenge = await detectAuthenticationChallenge(page);
  if (challenge) throw new AuthenticationChallengeError(challenge.challenge, challenge.url);
  return true;
}

/**
 * Saves a unique diagnostic screenshot. A screenshot failure never hides the
 * original login or scraping error.
 */
async function saveFailureScreenshot(page, options = {}) {
  const directory = options.directory || SCREENSHOT_DIRECTORY;
  const prefix = options.prefix || 'linkedin-failure';
  const filename = `${prefix}-${Date.now()}-${crypto.randomUUID()}.png`;
  const screenshotPath = path.join(directory, filename);

  try {
    await fs.mkdir(directory, { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  } catch (error) {
    console.error('Não foi possível salvar screenshot de falha:', error.message);
    return null;
  }
}

function randomDelay(min, max, random) {
  const randomValue = Math.min(1, Math.max(0, Number(random())));
  return Math.round(min + randomValue * (max - min));
}

async function waitForVisibleSelector(page, selector, timeout = 10000) {
  if (typeof page.locator === 'function') {
    const baseLocator = page.locator(selector);
    // LinkedIn can keep duplicate hidden inputs in the DOM. Select the first
    // visible match instead of waiting on the first DOM match indefinitely.
    const locator = typeof baseLocator.all === 'function'
      ? page.locator(`${selector}:visible`).first()
      : baseLocator.first();
    await locator.waitFor({ state: 'visible', timeout });
    return locator;
  }

  await page.waitForSelector(selector, { visible: true, timeout });
  return selector;
}

/**
 * Types credentials with a deterministic injectable delay in tests.
 */
async function typeWithDelay(page, selector, value, options = {}) {
  const min = options.min ?? options.minDelay ?? 35;
  const max = options.max ?? options.maxDelay ?? 120;
  const random = options.random || Math.random;
  const delay = randomDelay(min, Math.max(min, max), random);
  if (selector && typeof selector.pressSequentially === 'function') {
    return selector.pressSequentially(value, { delay });
  }
  if (typeof page.locator === 'function') {
    return page.locator(selector).first().pressSequentially(value, { delay });
  }
  return page.type(selector, value, { delay });
}

async function findFirstSelector(page, selectors, timeout = 10000) {
  const deadline = Date.now() + timeout;
  let lastError;

  for (const selector of selectors) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    try {
      return await waitForVisibleSelector(page, selector, Math.min(1500, remaining));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Nenhum seletor encontrado: ${selectors.join(', ')}`);
}

async function waitForNonEmptyText(page, selectors, timeout = 10000) {
  if (typeof page.waitForFunction !== 'function') {
    return findFirstSelector(page, selectors, timeout);
  }

  await page.waitForFunction(
    candidates => candidates.some(selector => Array.from(document.querySelectorAll(selector))
      .some(element => (element.innerText || element.textContent || '').trim())),
    selectors,
    { timeout }
  );
}

async function findLoginSubmit(page, timeout = 10000) {
  const deadline = Date.now() + timeout;

  if (typeof page.getByRole === 'function') {
    for (const name of ['Entrar', 'Sign in']) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;

      try {
        const locator = page.getByRole('button', { name, exact: true }).first();
        await locator.waitFor({ state: 'visible', timeout: Math.min(1500, remaining) });
        return locator;
      } catch (_error) {
        // Continue with the next accessible name or CSS fallback.
      }
    }
  }

  return findFirstSelector(page, [
    'button[type="submit"]',
    'button:has-text("Entrar"):not(:has-text("Microsoft")):not(:has-text("Apple"))',
    'button:has-text("Sign in")',
    'button[aria-label*="entrar" i]',
    'button[aria-label*="sign in" i]',
    'form:has(input[type="password"]) button:last-of-type',
    '.login__form_action_container button',
    'button[data-id*="sign-in" i]',
  ], Math.max(1, deadline - Date.now()));
}

async function waitForAuthenticatedPage(page, timeout = 30000) {
  return findFirstSelector(page, [
    '#global-nav',
    'input[placeholder*="Pesquisar" i]',
    'input[placeholder*="Search" i]',
    '[role="navigation"]',
    'header nav',
  ], timeout);
}

async function getVisibleJobLinks(page) {
  if (typeof page.evaluate !== 'function') return [];

  const jobs = await page.evaluate(() => Array.from(document.querySelectorAll('div[data-job-id]'))
    .map(container => {
      const jobId = container.getAttribute('data-job-id');
      const link = container.querySelector('a.job-card-container__link, a[href*="/jobs/view/"]');
      return { jobId, url: link?.href || null };
    })
    .filter(job => job.jobId && job.url && job.url.includes('/jobs/view/')));

  return Array.isArray(jobs) ? jobs : [];
}

async function scrollVisibleJobList(page, step) {
  if (typeof page.evaluate !== 'function') return false;

  return Boolean(await page.evaluate(scrollStep => {
    const candidates = [
      document.querySelector('.jobs-search-results-list'),
      document.querySelector('.jobs-search-results-list__list'),
      document.scrollingElement
    ].filter(Boolean);
    const container = candidates.find(element => element.scrollHeight > element.clientHeight) || candidates[0];
    if (!container) return false;

    const before = container.scrollTop;
    container.scrollBy?.({ top: scrollStep, behavior: 'auto' });
    if (typeof container.scrollBy !== 'function') container.scrollTop += scrollStep;
    return container.scrollTop > before;
  }, step));
}

/**
 * Collects cards across a virtualized result list. Cards may disappear from
 * the DOM after scrolling, so only the accumulated map is returned.
 */
async function collectJobLinks(page, options = {}) {
  const settings = { ...DEFAULT_SCROLL_OPTIONS, ...options };
  const deadline = Date.now() + settings.timeoutMs;
  const jobsById = new Map();
  let noProgressRounds = 0;
  let iterations = 0;

  while (iterations < settings.maxIterations && Date.now() < deadline) {
    iterations += 1;
    const visibleJobs = await getVisibleJobLinks(page);
    const sizeBefore = jobsById.size;
    for (const job of visibleJobs) {
      if (!jobsById.has(job.jobId)) jobsById.set(job.jobId, { jobId: job.jobId, url: job.url });
    }

    if (jobsById.size === sizeBefore) noProgressRounds += 1;
    else noProgressRounds = 0;
    if (noProgressRounds >= settings.noProgressRounds) break;

    const didScroll = await scrollVisibleJobList(page, settings.step);
    if (!didScroll) break;

    const remaining = Math.max(0, deadline - Date.now());
    if (remaining === 0) break;
    if (settings.waitMs > 0) await (settings.wait || sleep)(Math.min(settings.waitMs, remaining));
  }

  return [...jobsById.values()];
}

async function waitForModal(page, timeoutMs, wait) {
  const deadline = Date.now() + timeoutMs;
  let iterations = 0;
  while (Date.now() < deadline && iterations < 20) {
    iterations += 1;
    if (typeof page.locator === 'function') {
      try {
        await page.locator('.artdeco-modal').first().waitFor({ state: 'visible', timeout: 50 });
        return true;
      } catch (_error) {
        // Continue polling until the modal timeout.
      }
    } else if (typeof page.$ === 'function' && await page.$('.artdeco-modal')) {
      return true;
    }
    await wait(Math.max(0, Math.min(50, deadline - Date.now())));
  }
  return false;
}

/**
 * Clicks an external application action and captures only a popup opened by
 * the supplied page. The popup waiter is installed before the click and every
 * page created by this helper is closed in finally.
 */
async function captureExternalUrl(page, options = {}) {
  const timeoutMs = options.timeoutMs ?? 5000;
  const wait = options.wait || sleep;
  const originalUrl = getPageUrl(page);
  const popups = new Set();
  let popup;
  let popupPromise;

  try {
    if (typeof page.waitForEvent === 'function') {
      popupPromise = page
        .waitForEvent('popup', { timeout: timeoutMs })
        .then(candidate => {
          popup = candidate;
          popups.add(candidate);
          return candidate;
        })
        .catch(() => null);
    }

    await page.click('.jobs-apply-button--top-card');
    const modalFound = popup ? false : await waitForModal(page, Math.min(timeoutMs, 1000), wait);
    if (modalFound && typeof page.click === 'function') {
      await page.click('.artdeco-modal .jobs-apply-button');
    }

    const deadline = Date.now() + timeoutMs;
    let iterations = 0;
    while (Date.now() < deadline && iterations < 100) {
      iterations += 1;
      if (popup) {
        const popupUrl = getPageUrl(popup);
        if (isExternalUrl(popupUrl)) return popupUrl;
      }

      const currentUrl = getPageUrl(page);
      if (currentUrl !== originalUrl && isExternalUrl(currentUrl)) return currentUrl;
      await wait(Math.max(0, Math.min(50, deadline - Date.now())));
    }

    return null;
  } catch (error) {
    console.error('Erro ao tentar obter URL externa:', error.message);
    return null;
  } finally {
    for (const candidate of popups) {
      try {
        if (typeof candidate.isClosed !== 'function' || !candidate.isClosed()) await candidate.close();
      } catch (_error) {
        // Cleanup must not mask the scrape result.
      }
    }
  }
}

/**
 * Ensures a valid LinkedIn session and reports human-intervention challenges
 * separately from ordinary navigation failures.
 */
async function ensureLoggedIn(page, options = {}) {
  const { linkedinEmail, linkedinPassword } = require('../core/config');
  const loadSessionFn = options.loadSession || loadSession;
  const saveSessionFn = options.saveSession || saveSession;
  const credentials = options.credentials || {};
  const screenshotOptions = { prefix: 'linkedin-login-failure', ...options.screenshot };

  try {
    const isSessionLoaded = await loadSessionFn(page, options.sessionFilePath);
    if (isSessionLoaded) {
      console.log('Verificando validade da sessão carregada...');
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
      await assertNoAuthenticationChallenge(page);
      try {
        await waitForAuthenticatedPage(page, 10000);
        console.log('Sessão válida carregada. Pulando login.');
        return;
      } catch (_error) {
        console.log('Sessão carregada é inválida ou expirou. Prosseguindo com o login manual.');
      }
    }

    console.log('Navegando para a página de login do LinkedIn...');
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
    await assertNoAuthenticationChallenge(page);

    console.log('Preenchendo credenciais...');
    const usernameSelector = await findFirstSelector(page, [
      'input[name="session_key"]',
      'input[autocomplete="username"]',
      '#username',
      'input[type="email"]',
      'input[type="text"]',
      'form input:not([type="hidden"]):not([type="password"])',
      'input:not([type="hidden"]):not([type="password"])',
      'input[aria-label*="email" i]',
      'input[placeholder*="email" i]',
    ]);
    const passwordSelector = await findFirstSelector(page, [
      'input[name="session_password"]',
      'input[autocomplete="current-password"]',
      '#password',
      'input[type="password"]',
      'form input[placeholder*="password" i]',
      'form input[placeholder*="senha" i]',
    ]);
    await typeWithDelay(
      page,
      usernameSelector,
      credentials.linkedinEmail ?? linkedinEmail,
      options.typing
    );
    await typeWithDelay(
      page,
      passwordSelector,
      credentials.linkedinPassword ?? linkedinPassword,
      options.typing
    );
    let submitSelector;
    try {
      submitSelector = await findLoginSubmit(page);
    } catch (error) {
      if (!isAuthenticatedPage(page)) throw error;
      console.log('Login concluído durante a localização do botão de envio.');
    }
    if (submitSelector && typeof submitSelector.click === 'function') {
      await submitSelector.click();
    } else if (submitSelector) {
      await page.click(submitSelector);
    }
    await assertNoAuthenticationChallenge(page);

    console.log('Aguardando confirmação de login...');
    await waitForAuthenticatedPage(page, 30000);
    console.log('Login bem-sucedido!');
    await saveSessionFn(page, options.sessionFilePath);
  } catch (error) {
    const challenge = error instanceof AuthenticationChallengeError
      ? error
      : await detectAuthenticationChallenge(page).catch(() => null);
    if (challenge && !(error instanceof AuthenticationChallengeError)) {
      error = new AuthenticationChallengeError(challenge.challenge, challenge.url);
    }
    const screenshotPath = await saveFailureScreenshot(page, screenshotOptions);
    if (screenshotPath) error.screenshotPath = screenshotPath;
    throw error;
  }
}

async function scrapeJobLinks(page, searchUrl, options = {}) {
  console.log('Navegando para a página de busca de vagas...');
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await assertNoAuthenticationChallenge(page);

  await waitForVisibleSelector(page, 'a.job-card-container__link', options.selectorTimeoutMs ?? 10000)
    .catch(() => console.log('Aviso: Elementos de vaga não foram encontrados dentro do timeout esperado.'));

  const resultsCount = await scrapeResultsCount(page);
  const jobLinks = await collectJobLinks(page, options.scroll);
  console.log(`Encontradas ${jobLinks.length} vagas.`);
  return { jobLinks, resultsCount };
}

async function scrapeResultsCount(page) {
  try {
    await waitForVisibleSelector(
      page,
      '.jobs-search-results-list__text .jobs-search-results-list__subtitle span',
      5000
    );
    const countText = await page.evaluate(() => {
      const element = document.querySelector('.jobs-search-results-list__text .jobs-search-results-list__subtitle span');
      return element ? element.textContent.trim() : null;
    });
    return normalizeResultsCount(countText);
  } catch (error) {
    console.error('Erro ao extrair a quantidade de resultados:', error.message);
    return null;
  }
}

async function scrapeJobDetails(page, jobUrl, options = {}) {
  console.log(`Acessando vaga: ${jobUrl}`);
  await page.goto(jobUrl, { waitUntil: 'domcontentloaded' });
  await assertNoAuthenticationChallenge(page);

  await waitForNonEmptyText(page, JOB_DETAIL_SELECTORS.description, options.selectorTimeoutMs ?? 10000)
    .catch(() => console.log('Aviso: Descrição da vaga não encontrada dentro do timeout.'));

  const jobData = await page.evaluate((selectors) => {
    const getText = element => (element?.innerText || element?.textContent || '').trim();
    const findElement = (candidates) => candidates
      .flatMap(selector => Array.from(document.querySelectorAll(selector)))
      .find(element => getText(element));
    const getDescriptionText = element => {
      if (!element) return '';
      if (element.matches('[data-testid="expandable-text-box"]')) {
        const blocks = Array.from(element.querySelectorAll('p, li'))
          .map(getText)
          .filter(Boolean);
        if (blocks.length > 0) return blocks.join('\n');
      }
      return getText(element);
    };
    const title = findElement(selectors.title);
    const company = findElement(selectors.company);
    const location = findElement(selectors.location);
    const description = findElement(selectors.description);
    const button = findElement(selectors.applyButton);
    const isSduiJobPage = Boolean(document.querySelector('[id^="JobDetails_AboutTheJob_"]'));
    const pageTitleParts = document.title.split(' | ').map(part => part.trim());
    const rawType = button?.querySelector('.artdeco-button__text')?.innerText?.trim()
      || button?.innerText?.trim()
      || null;
    const locationText = getText(location)
      .split(/\s*[·•]\s*/)[0]
      .trim();
    return {
      title: getText(title) || (isSduiJobPage ? pageTitleParts[0] : '') || 'N/A',
      company: getText(company) || (isSduiJobPage ? pageTitleParts[1] : '') || 'N/A',
      jobLocation: locationText || null,
      description: getDescriptionText(description) || 'N/A',
      url: window.location.href,
      typeRaw: rawType
    };
  }, JOB_DETAIL_SELECTORS);

  const application = parseApplicationType(jobData.typeRaw);
  jobData.type = application.normalized || 'N/A';
  jobData.applicationType = application.normalized;
  jobData.applicationTypeRaw = application.raw;

  if (jobData.type === APPLICATION_TYPES.EXTERNAL) {
    jobData.externalUrl = await captureExternalUrl(page, options.externalUrl);
  } else {
    jobData.externalUrl = null;
  }

  return jobData;
}

module.exports = {
  AuthenticationChallengeError,
  ScraperTimeoutError,
  assertNoAuthenticationChallenge,
  captureExternalUrl,
  collectJobLinks,
  collectVisibleJobLinks: getVisibleJobLinks,
  detectAuthenticationChallenge,
  ensureLoggedIn,
  findFirstSelector,
  getExternalUrl: captureExternalUrl,
  normalizeResultsCount,
  saveFailureScreenshot,
  scrapeJobDetails,
  scrapeJobLinks,
  scrapeResultsCount,
  scrollAndCollectJobLinks: collectJobLinks,
  typeWithDelay
};

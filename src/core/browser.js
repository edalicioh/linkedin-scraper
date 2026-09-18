const puppeteer = require('puppeteer');

/**
 * Cria um gerenciador de ciclo de vida do browser.
 * A fábrica permite testar o ciclo sem iniciar um Chromium real.
 *
 * @param {object} [puppeteerClient=puppeteer] Cliente com o método launch.
 * @returns {{startBrowser: Function, closeBrowser: Function}}
 */
function createBrowserManager(puppeteerClient = puppeteer) {
  let browserInstance = null;
  let browserLaunchPromise = null;
  let browserClosePromise = null;

  /**
   * Inicia uma instância conectada, compartilhando launches concorrentes.
   * @param {object} options - Opções de inicialização do Puppeteer.
   * @returns {Promise<import('puppeteer').Browser>} A instância do navegador.
   */
  async function startBrowser(options = {}) {
    if (browserClosePromise) {
      await browserClosePromise;
    }

    if (browserInstance) {
      if (browserInstance.isConnected()) {
        return browserInstance;
      }
      browserInstance = null;
    }

    if (browserLaunchPromise) {
      return browserLaunchPromise;
    }

    console.log('Iniciando o navegador...');
    const launchOptions = { headless: false, ...options };
    browserLaunchPromise = puppeteerClient.launch(launchOptions)
      .then((browser) => {
        if (!browser || typeof browser.isConnected !== 'function' || !browser.isConnected()) {
          throw new Error('O Puppeteer retornou um browser desconectado.');
        }

        browserInstance = browser;
        browser.on('disconnected', () => {
          if (browserInstance === browser) {
            browserInstance = null;
          }
        });
        return browser;
      })
      .finally(() => {
        browserLaunchPromise = null;
      });

    return browserLaunchPromise;
  }

  /**
   * Fecha o browser atual uma única vez e tolera chamadas repetidas.
   */
  async function closeBrowser() {
    if (browserClosePromise) {
      return browserClosePromise;
    }

    browserClosePromise = (async () => {
      if (browserLaunchPromise) {
        try {
          await browserLaunchPromise;
        } catch (error) {
          return;
        }
      }

      const browser = browserInstance;
      browserInstance = null;
      if (!browser) {
        return;
      }

      console.log('Fechando o navegador...');
      await browser.close();
    })().finally(() => {
      browserClosePromise = null;
    });

    return browserClosePromise;
  }

  return { startBrowser, closeBrowser };
}

const defaultBrowserManager = createBrowserManager();

module.exports = {
  createBrowserManager,
  startBrowser: defaultBrowserManager.startBrowser,
  closeBrowser: defaultBrowserManager.closeBrowser,
};

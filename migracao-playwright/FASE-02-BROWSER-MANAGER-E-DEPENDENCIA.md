# Fase 02: Browser Manager e Dependencia

## Missao

Substituir o pacote Puppeteer pelo Playwright no gerenciador do browser sem migrar ainda contexto, sessao ou scraping.

**Depende de:** Fase 01 aprovada.

## Resultado

`src/core/browser.js` usa `playwright.chromium`, preservando os exports e o ciclo de vida observavel pelo restante da aplicacao.

## Escopo

- Adicionar `playwright` como dependencia.
- Remover `puppeteer` como dependencia direta.
- Atualizar `package-lock.json` por instalacao limpa.
- Usar `chromium.launch()`.
- Manter `headless: false` como padrao.
- Preservar launch compartilhado, reconexao e close idempotente.
- Preservar injecao do launcher para testes.
- Adicionar smoke test local com Chromium real.

## Fora do escopo

- Criar `BrowserContext` por tarefa.
- Migrar cookies.
- Alterar login, seletores ou popup.
- Adicionar `@playwright/test`.
- Adicionar stealth.

## Arquivos esperados

- `package.json`
- `package-lock.json`
- `src/core/browser.js`
- `test/browser.test.js`
- `test/playwright-browser-smoke.test.js`

## Contratos

- `createBrowserManager(launcher)` continua aceitando um objeto com `launch()`.
- `startBrowser(options)` retorna browser conectado ou rejeita.
- Chamadas concorrentes compartilham o mesmo launch em andamento.
- Falha de launch limpa o estado para nova tentativa.
- `closeBrowser()` permanece idempotente.
- O primeiro launch continua definindo as opcoes da instancia compartilhada.

## Implementacao

1. Trocar o import padrao por `const { chromium } = require('playwright')`.
2. Preservar a maquina de estados atual do browser manager.
3. Atualizar JSDoc de Puppeteer para Playwright.
4. Adaptar os fakes apenas onde a API Playwright for diferente.
5. Criar smoke test contra pagina servida em `127.0.0.1`.
6. Documentar temporariamente `npx playwright install chromium` no plano de entrega.

## Testes obrigatorios

```powershell
npm ci
npx playwright install chromium
node --test test/browser.test.js test/playwright-browser-smoke.test.js
node --check src/core/browser.js
npm run lint
```

## Criterios de aceite

- Nenhum import de `puppeteer` permanece no codigo de producao.
- Chromium abre com sucesso contra pagina local.
- Browser visivel permanece o padrao.
- Testes de concorrencia e retry continuam passando.
- A suite nao acessa o LinkedIn.

## Nota para a fase seguinte

O browser ainda pode ser consumido pelo adaptador atual. A Fase 03 estabelece `BrowserContext` como unidade de isolamento de cada execucao.

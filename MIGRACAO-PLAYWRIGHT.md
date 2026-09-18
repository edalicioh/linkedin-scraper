# Orquestracao da Migracao para Playwright

Este arquivo coordena a substituicao do Puppeteer pelo Playwright sem alterar os contratos publicos da CLI, da API, da fila ou da persistencia SQLite. As fases sao sequenciais: cada fase parte da integracao aprovada da fase anterior.

## Objetivo

Ao final da migracao, o projeto deve usar `playwright` com Chromium, manter o navegador visivel por padrao, preservar a sessao existente sempre que possivel e continuar executando todos os testes obrigatorios sem acessar o LinkedIn.

## Decisoes fixadas

| Tema              | Decisao                                                     |
| ----------------- | ----------------------------------------------------------- |
| Engine            | Playwright com Chromium                                     |
| Pacote            | `playwright`, sem `@playwright/test`                        |
| Modulos           | CommonJS                                                    |
| Navegador         | Visivel e assistido por padrao                              |
| Headless          | Somente com `HEADLESS=true`                                 |
| Stealth           | Fora do escopo                                              |
| Browser           | Compartilhado pelo processo da API                          |
| Contexto          | Um `BrowserContext` por execucao do scraper                 |
| Fila              | FIFO em memoria, concorrencia 1                             |
| Sessao            | Compatibilidade de leitura com `storage/cookies.json` atual |
| Testes            | `node:test`, paginas locais e sem LinkedIn                  |
| Validacao ao vivo | Manual e opcional                                           |

## Contratos que nao podem regredir

1. `runScraper(keywords, location, options)` continua exportado e retorna o resumo atual.
2. `createBrowserManager()`, `startBrowser()` e `closeBrowser()` continuam exportados.
3. A CLI fecha o browser ao terminar; uma tarefa da API fecha somente seu contexto e suas paginas.
4. A API continua iniciando sem credenciais e fecha o browser no shutdown.
5. `POST /api/scrape`, `GET /api/scrape/:taskId` e `GET /api/jobs` nao mudam de contrato.
6. `AuthenticationChallengeError` continua usando o codigo `LINKEDIN_AUTH_CHALLENGE`.
7. URL externa ausente continua sendo `null`.
8. O banco SQLite e o repositorio de jobs nao mudam de formato por causa da migracao.
9. Nenhum teste obrigatorio exige credenciais, internet ou acesso ao LinkedIn.

## Fases

| Fase | Branch                               | Depende de | Plano                                                                                                                          |
| ---- | ------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 01   | `playwright/fase-01-caracterizacao`  | Base       | [`migracao-playwright/FASE-01-CARACTERIZACAO-E-CONTRATOS.md`](migracao-playwright/FASE-01-CARACTERIZACAO-E-CONTRATOS.md)       |
| 02   | `playwright/fase-02-browser`         | 01         | [`migracao-playwright/FASE-02-BROWSER-MANAGER-E-DEPENDENCIA.md`](migracao-playwright/FASE-02-BROWSER-MANAGER-E-DEPENDENCIA.md) |
| 03   | `playwright/fase-03-contexto-sessao` | 02         | [`migracao-playwright/FASE-03-CONTEXTO-E-SESSAO.md`](migracao-playwright/FASE-03-CONTEXTO-E-SESSAO.md)                         |
| 04   | `playwright/fase-04-login`           | 03         | [`migracao-playwright/FASE-04-LOGIN-E-NAVEGACAO.md`](migracao-playwright/FASE-04-LOGIN-E-NAVEGACAO.md)                         |
| 05   | `playwright/fase-05-extracao`        | 04         | [`migracao-playwright/FASE-05-BUSCA-E-EXTRACAO.md`](migracao-playwright/FASE-05-BUSCA-E-EXTRACAO.md)                           |
| 06   | `playwright/fase-06-popup`           | 05         | [`migracao-playwright/FASE-06-POPUP-E-CANDIDATURA.md`](migracao-playwright/FASE-06-POPUP-E-CANDIDATURA.md)                     |
| 07   | `playwright/fase-07-shutdown`        | 06         | [`migracao-playwright/FASE-07-SHUTDOWN-E-FILA.md`](migracao-playwright/FASE-07-SHUTDOWN-E-FILA.md)                             |
| 08   | `playwright/fase-08-finalizacao`     | 07         | [`migracao-playwright/FASE-08-DOCUMENTACAO-E-LIMPEZA.md`](migracao-playwright/FASE-08-DOCUMENTACAO-E-LIMPEZA.md)               |

## Modelo de execucao

As fases nao devem ser criadas todas a partir do mesmo commit. O branch de integracao avanca apos cada aprovacao, e a proxima fase nasce desse novo ponto.

```powershell
$BASE_COMMIT = git rev-parse HEAD
git worktree add "..\linkedin-scraper-playwright-integracao" -b "integracao/playwright" $BASE_COMMIT

# Exemplo para a Fase 01
git worktree add "..\linkedin-scraper-playwright-fase-01" -b "playwright/fase-01-caracterizacao" $BASE_COMMIT
```

Depois da validacao da fase:

```powershell
# Na worktree de integracao
git merge --no-ff playwright/fase-01-caracterizacao

# A proxima fase parte da integracao aprovada
$NEXT_BASE = git rev-parse HEAD
git worktree add "..\linkedin-scraper-playwright-fase-02" -b "playwright/fase-02-browser" $NEXT_BASE
```

Repetir o processo ate a Fase 08. Nao iniciar uma fase enquanto sua dependencia ainda nao estiver aprovada na branch `integracao/playwright`.

## Contrato de entrega por fase

Cada fase deve informar:

- Hashes dos commits produzidos.
- Arquivos criados, alterados e removidos.
- Testes executados e resultados.
- Testes nao executados e motivo.
- Mudancas de contrato interno ou publico.
- Riscos ou adaptacoes para a fase seguinte.
- Confirmacao de que nao acessou o LinkedIn nos testes obrigatorios.

Uma fase nao esta pronta se depende de arquivos nao commitados, credenciais reais, browser instalado manualmente fora do procedimento documentado ou mudancas ainda nao integradas da fase anterior.

## Pontos de conflito e ownership

| Arquivo                              | Fases          | Regra                                                             |
| ------------------------------------ | -------------- | ----------------------------------------------------------------- |
| `package.json` e `package-lock.json` | 02, 08         | Adicionar Playwright na 02 e remover vestigios do Puppeteer na 08 |
| `src/core/browser.js`                | 02, 03         | Preservar singleton do browser; contexto pertence a execucao      |
| `scraper.js`                         | 03, 07         | Fechar contexto por tarefa e browser somente pela CLI/API         |
| `src/services/session-manager.js`    | 01, 03         | Manter compatibilidade com cookies legados                        |
| `src/scraper/linkedin.js`            | 01, 04, 05, 06 | Migrar em etapas sem reescrever todos os seletores de uma vez     |
| `api.js`                             | 07, 08         | Shutdown deve aguardar a fila e continuar testavel                |
| `README.md` e `.env.example`         | 08             | Documentar instalacao, browser, `HEADLESS` e `SCRAPE_LIMIT`       |

## Regras de seguranca

1. Nao versionar `.env`, cookies, banco, screenshots ou dados coletados.
2. Nao executar login real como parte da suite automatizada.
3. Testes com Chromium real devem usar somente servidor local em `127.0.0.1`.
4. Nao adicionar stealth, rotacao de User-Agent, proxy ou automacao de CAPTCHA.
5. Desafio de autenticacao deve solicitar intervencao humana ou falhar com erro identificavel.
6. Nao usar `git reset --hard` ou descartar implementacoes silenciosamente durante a integracao.

## Validacao integrada

```powershell
npm ci
npx playwright install chromium
npm test
npm run lint
npm run format:check
```

Tambem devem ser verificados:

- Importacao e start da API sem credenciais.
- Browser visivel por padrao e headless somente quando configurado.
- Compatibilidade com cookies legados.
- Um contexto por tarefa e ausencia de vazamentos.
- Fila com concorrencia 1.
- Shutdown durante tarefa ativa.
- Popup, modal e navegacao na mesma aba contra paginas locais.
- Ausencia de `puppeteer`, `puppeteer-core`, `@puppeteer/browsers` e imports relacionados no lockfile e no codigo.

A validacao ao vivo no LinkedIn permanece manual e opcional. Ela deve registrar apenas o resultado, nunca credenciais, cookies, screenshots sensiveis ou dados coletados.

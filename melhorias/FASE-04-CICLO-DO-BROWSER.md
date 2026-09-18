# Fase 04: Ciclo de Vida do Browser

## Missao

Eliminar corridas, referencias mortas e vazamentos de paginas, estabelecendo ownership claro do Chromium em CLI e API.

**Depende de:** nenhuma outra fase.

## Resultado isolado

Aplicada ao `BASE_COMMIT`, esta fase garante uma unica inicializacao concorrente, recuperacao apos desconexao, fechamento das paginas por execucao e encerramento gracioso do browser.

## Escopo

- Compartilhar a Promise de `puppeteer.launch()` entre chamadas concorrentes.
- Validar `browser.isConnected()` antes de reutilizar a instancia.
- Limpar referencias no evento `disconnected`.
- Tornar `closeBrowser()` idempotente.
- Fazer cada execucao fechar sua pagina em `finally`.
- Fazer a CLI fechar o browser ao terminar.
- Fazer a API manter o browser compartilhado e fecha-lo em `SIGINT` e `SIGTERM`.
- Tornar o modo headless configuravel, mantendo `false` como padrao.

## Fora do escopo

- Fila HTTP.
- SQLite.
- Mudancas de seletores, scroll ou login.
- Captura robusta de popup externo, tratada na Fase 05.
- Stealth.

## Arquivos esperados

- `src/core/browser.js`
- `src/core/config.js`
- `scraper.js`
- `api.js`
- `test/browser.test.js`
- `test/browser-ownership.test.js`

## Contratos

- `startBrowser(options)` sempre retorna uma instancia conectada ou rejeita.
- Chamadas simultaneas compartilham o mesmo launch em andamento.
- Rejeicao no launch limpa o estado e permite nova tentativa.
- `runScraper()` possui e fecha somente a pagina criada por ele.
- A CLI possui o browser e o fecha ao terminar.
- A API possui o browser compartilhado e o fecha somente no shutdown.

## Implementacao

1. Separar `browserInstance` e `browserLaunchPromise`.
2. Registrar listener de desconexao uma unica vez por instancia.
3. Proteger fechamento concorrente e limpar estado em `finally`.
4. Envolver a pagina principal de `runScraper()` em `try/finally`.
5. Mover o fechamento da CLI para o `main()`.
6. Registrar handlers de sinal que parem o servidor e fechem o browser.

## Testes obrigatorios

```powershell
node --test test/browser.test.js test/browser-ownership.test.js
node --check src/core/browser.js
node --check scraper.js
node --check api.js
```

Puppeteer deve ser injetado ou mockado. Os testes obrigatorios nao lancam Chromium real.

## Criterios de aceite

- Duas inicializacoes concorrentes chamam `launch()` uma vez.
- Browser desconectado nao e devolvido novamente.
- Falha de scraping fecha a pagina principal.
- Execucao CLI fecha o browser.
- Execucao pela API nao fecha o browser ao terminar uma tarefa.
- Shutdown repetido nao lanca erro.
- Os testes passam apenas com esta branch aplicada ao `BASE_COMMIT`.

## Nota de integracao

Ao combinar com a fila, o browser continua pertencendo ao processo da API, enquanto cada item da fila possui apenas sua pagina. Nao restaurar `closeBrowser()` dentro de `runScraper()`.

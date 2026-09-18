# Fase 03: Contexto e Sessao

## Missao

Adotar um `BrowserContext` por execucao e migrar cookies para a API do Playwright sem invalidar sessoes existentes.

**Depende de:** Fase 02 aprovada.

## Resultado

Cada tarefa cria e fecha seu proprio contexto, enquanto o browser permanece compartilhado. O arquivo atual de cookies continua legivel.

## Escopo

- Criar contexto com `browser.newContext()` por `runScraper()`.
- Criar pagina com `context.newPage()`.
- Fechar pagina e contexto em `finally`.
- Migrar `page.cookies()` para `context.cookies()`.
- Migrar `page.setCookie()` para `context.addCookies()`.
- Normalizar cookies legados antes de adiciona-los ao contexto.
- Preservar caminho e formato de leitura atual.
- Permitir injecao de contexto, pagina e session manager nos testes.

## Fora do escopo

- Trocar o arquivo para `storageState` completo.
- Alterar login ou seletores.
- Alterar fila ou shutdown.
- Remover compatibilidade com cookies antigos.

## Arquivos esperados

- `scraper.js`
- `src/services/session-manager.js`
- `test/session-manager.test.js`
- `test/browser-ownership.test.js`
- `test/scraper.test.js`

## Contratos

- Browser pertence ao processo da CLI ou API.
- Contexto e paginas pertencem a uma execucao.
- Fechar uma tarefa nao afeta tarefas futuras.
- Cookies continuam em `storage/cookies.json`.
- Campos extras de cookies legados sao ignorados, nao propagados ao Playwright.
- Falha ao fechar contexto nao mascara a falha principal do scraper.

## Implementacao

1. Criar contexto depois de obter o browser.
2. Passar contexto ou pagina ao session manager sem acoplamento global.
3. Mapear somente campos aceitos: `name`, `value`, `domain`, `path`, `expires`, `httpOnly`, `secure` e `sameSite`.
4. Normalizar valores de `sameSite` quando necessario.
5. Fechar pagina e contexto de forma defensiva e idempotente.
6. Cobrir sucesso e falha antes e depois da criacao da pagina.

## Testes obrigatorios

```powershell
node --test test/session-manager.test.js test/browser-ownership.test.js test/scraper.test.js
node --check scraper.js
node --check src/services/session-manager.js
npm test
```

## Criterios de aceite

- Cada execucao cria exatamente um contexto.
- Contexto fecha em sucesso e erro.
- Browser nao fecha ao terminar tarefa da API.
- Cookie legado valido pode ser carregado por Playwright.
- JSON corrompido continua produzindo erro explicito.

## Nota para a fase seguinte

A Fase 04 deve operar apenas sobre a pagina recebida e nao criar contextos adicionais durante login ou tratamento de desafios.

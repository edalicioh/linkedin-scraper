# Fase 01: Caracterizacao e Contratos

## Missao

Fixar por testes o comportamento atual antes de trocar o engine de browser.

**Depende de:** nenhuma fase da migracao.

## Resultado

Os contratos de browser, ownership, sessao, login, desafios e popup ficam documentados por testes que ainda executam sobre Puppeteer.

## Escopo

- Adicionar testes de `saveSession()` e `loadSession()`.
- Cobrir arquivo de cookies ausente, valido e corrompido.
- Cobrir `ensureLoggedIn()` com sessao valida, sessao expirada e login local.
- Cobrir seletores alternativos de usuario, senha e submit.
- Cobrir desafio por URL, DOM e texto.
- Cobrir screenshot de falha sem mascarar o erro original.
- Cobrir os exports publicos de browser, scraper e modulo LinkedIn.
- Reaproveitar fixtures HTML locais.
- Garantir que testes falhem se tentarem acessar hosts externos.

## Fora do escopo

- Instalar Playwright.
- Alterar implementacao de producao para Playwright.
- Alterar seletores de vagas sem teste de caracterizacao.
- Acessar LinkedIn.

## Arquivos esperados

- `test/session-manager.test.js`
- `test/linkedin-login.test.js`
- `test/linkedin-challenge.test.js`
- `test/fixtures/linkedin/login.html`
- `test/fixtures/linkedin/challenge.html`
- Ajustes pequenos nos testes existentes, se necessarios para injecao.

## Contratos

- `storage/cookies.json` continua sendo aceito como array de cookies.
- Arquivo ausente representa sessao inexistente.
- JSON corrompido continua sendo erro explicito.
- `AuthenticationChallengeError` mantem nome, codigo, desafio e URL.
- Screenshot e diagnostico nao alteram o erro principal.
- `runScraper()` preserva assinatura e resumo.

## Implementacao

1. Criar fixtures locais representando login, sessao valida e desafio.
2. Criar fakes de pagina e contexto somente para contratos unitarios.
3. Adicionar um helper de servidor local para testes de browser posteriores.
4. Bloquear navegacoes fora de `127.0.0.1` nos testes de integracao local.
5. Registrar em testes os exports e formatos que as fases seguintes devem preservar.

## Testes obrigatorios

```powershell
node --test test/session-manager.test.js test/linkedin-login.test.js test/linkedin-challenge.test.js
npm test
npm run lint
npm run format:check
```

## Criterios de aceite

- Nenhum teste acessa rede externa.
- Cookies validos, ausentes e corrompidos possuem comportamento coberto.
- Login e desafios possuem cobertura independente do DOM real do LinkedIn.
- Todos os contratos publicos relevantes estao exercitados.
- A suite completa continua passando antes da troca do engine.

## Nota para a fase seguinte

A Fase 02 pode alterar apenas o browser manager e a dependencia. Falhas em testes de login ou sessao devem ser tratadas nas fases especificas, nao mascaradas por adaptadores no browser manager.

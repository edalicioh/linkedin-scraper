# Fase 04: Login e Navegacao

## Missao

Migrar login, waits e deteccao de desafios para APIs nativas do Playwright, mantendo o fluxo visivel e assistido.

**Depende de:** Fase 03 aprovada.

## Resultado

O login usa locators e sinais explicitos de pagina, sem opcoes exclusivas do Puppeteer e sem depender de `networkidle2`.

## Escopo

- Substituir `networkidle2` por `domcontentloaded` e sinais de DOM/URL.
- Substituir `{ visible: true }` por locators ou `state: 'visible'`.
- Migrar `page.type()` para locator com digitacao sequencial e delay.
- Priorizar `name`, `autocomplete`, label e role antes de CSS estrutural.
- Preservar fallbacks atuais de usuario, senha e submit.
- Detectar desafio apos navegacao e apos submit.
- Distinguir timeout de login de CAPTCHA/2FA.
- Preservar screenshot unico de diagnostico.

## Fora do escopo

- Automatizar CAPTCHA ou 2FA.
- Introduzir stealth.
- Migrar seletores de vagas.
- Reescrever popup externo.

## Arquivos esperados

- `src/scraper/linkedin.js`
- `test/linkedin-login.test.js`
- `test/linkedin-challenge.test.js`
- Fixtures de login e desafio.

## Contratos

- `ensureLoggedIn(page, options)` continua exportado.
- Sessao valida continua pulando o formulario.
- `AuthenticationChallengeError` preserva codigo e metadados.
- Delays continuam injetaveis e deterministicos em testes.
- Falha de screenshot nao mascara o erro de login.
- Modo headed permite intervencao humana, mas nao espera indefinidamente.

## Implementacao

1. Encapsular a resolucao de locators de usuario, senha e submit.
2. Usar `locator.waitFor({ state: 'visible' })` com timeout global limitado.
3. Usar `locator.pressSequentially()` ou equivalente preservando delay.
4. Aguardar resultado por corrida controlada entre navegacao, feed, desafio e timeout.
5. Executar detector de desafio antes de converter falha em timeout generico.
6. Manter mensagens sem credenciais ou dados sensiveis.

## Testes obrigatorios

```powershell
node --test test/linkedin-login.test.js test/linkedin-challenge.test.js
node --check src/scraper/linkedin.js
npm test
npm run lint
```

## Criterios de aceite

- Login local funciona com markup atual e legado das fixtures.
- Delays sao deterministicos em testes.
- CAPTCHA e 2FA geram `LINKEDIN_AUTH_CHALLENGE`.
- Todos os waits possuem timeout.
- Nenhum teste acessa o LinkedIn.

## Nota para a fase seguinte

As funcoes de navegacao e challenge detection desta fase devem ser reutilizadas na busca e nos detalhes, evitando implementacoes paralelas.

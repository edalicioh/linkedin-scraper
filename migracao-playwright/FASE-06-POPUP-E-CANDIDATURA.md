# Fase 06: Popup e Candidatura Externa

## Missao

Substituir a captura baseada em `Target` do Puppeteer pelos eventos de popup e navegacao do Playwright.

**Depende de:** Fase 05 aprovada.

## Resultado

A URL externa e capturada pelo opener correto, com suporte a modal intermediario, popup tardio e navegacao na mesma aba.

## Escopo

- Remover `page.browser()`, `page.target()` e `Target.opener()`.
- Remover listener `targetcreated`.
- Registrar espera de popup antes do clique.
- Aguardar URL final quando o popup iniciar em `about:blank`.
- Preservar suporte a modal intermediario.
- Preservar suporte a navegacao externa na mesma aba.
- Fechar popups e remover listeners em `finally`.
- Preservar retorno `null` em ausencia ou falha controlada.

## Fora do escopo

- Alterar o tipo de candidatura normalizado.
- Automatizar formulario externo.
- Interagir com sites externos nos testes.
- Manter compatibilidade interna com objetos `Target` do Puppeteer.

## Arquivos esperados

- `src/scraper/linkedin.js`
- `test/linkedin-external-url.test.js`
- `test/playwright-popup-local.test.js`
- Fixtures ou paginas locais para popup, modal e mesma aba.

## Contratos

- `captureExternalUrl(page, options)` continua exportado.
- Popup deve ser associado a pagina que realizou o clique.
- URL LinkedIn nao e considerada externa.
- URL ausente ou timeout retorna `null`.
- Popup criado pelo helper e fechado pelo helper.
- A pagina principal pertence ao orquestrador e nao e fechada aqui.

## Implementacao

1. Preparar `page.waitForEvent('popup')` antes do clique.
2. Preparar observacao de mudanca da URL principal no mesmo intervalo.
3. Usar corrida controlada com timeout e cancelamento logico dos ramos restantes.
4. Se houver modal, clicar somente depois de sua confirmacao local.
5. Esperar popup sair de `about:blank` antes de classificar a URL.
6. Fechar todas as paginas secundarias conhecidas em `finally`.

## Testes obrigatorios

```powershell
node --test test/linkedin-external-url.test.js test/playwright-popup-local.test.js
node --check src/scraper/linkedin.js
npm test
npm run lint
```

## Criterios de aceite

- Popup correto e capturado mesmo quando abre com atraso.
- Popup de outra pagina nao e confundido com o atual.
- Modal e navegacao na mesma aba funcionam em testes locais.
- Timeout nao deixa pagina, listener ou Promise rejeitada sem tratamento.
- Nenhum teste navega para host externo.

## Nota para a fase seguinte

Depois desta fase, todo o scraping deve usar Playwright. A Fase 07 trata apenas coordenacao entre fila, servidor e fechamento do browser.

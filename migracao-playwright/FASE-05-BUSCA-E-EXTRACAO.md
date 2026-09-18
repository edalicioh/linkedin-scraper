# Fase 05: Busca e Extracao

## Missao

Migrar busca, scroll virtualizado, contagem e detalhes de vagas para Playwright sem alterar os dados persistidos.

**Depende de:** Fase 04 aprovada.

## Resultado

O fluxo principal de coleta usa Playwright e continua deduplicando cards mesmo quando o DOM virtualizado remove elementos antigos.

## Escopo

- Migrar waits da lista de resultados.
- Migrar leitura incremental de cards.
- Migrar scroll da lista virtualizada.
- Migrar contagem localizada de resultados.
- Migrar seletores e extracao dos detalhes.
- Preservar limites de iteracao, timeout e rodadas sem progresso.
- Preservar parsers puros e formato enviado ao repositorio SQLite.
- Usar fixtures e servidor local para smoke test real.

## Fora do escopo

- Popup ou URL externa de candidatura.
- Alterar esquema SQLite.
- Alterar limite, deduplicacao ou resumo de `runScraper()`.
- Validar seletores no LinkedIn automaticamente.

## Arquivos esperados

- `src/scraper/linkedin.js`
- `src/scraper/linkedin-parsers.js`, somente se um contrato puro precisar ser corrigido.
- `test/linkedin-scroll.test.js`
- `test/linkedin-parsers.test.js`
- `test/playwright-scraping-local.test.js`
- `test/fixtures/linkedin/`

## Contratos

- `scrapeJobLinks(page, searchUrl, options)` retorna `{ jobLinks, resultsCount }`.
- Links usam `{ jobId, url }` e sao deduplicados.
- Cards removidos do DOM continuam no resultado acumulado.
- `scrapeJobDetails()` continua retornando campos aceitos pelo repositorio.
- Valor ausente permanece `null`, nao `"N/A"` novo.
- Todos os loops possuem timeout e limite de iteracoes.

## Implementacao

1. Preferir locators para waits e colecoes simples.
2. Manter `page.evaluate()` somente quando necessario para scroll e snapshot atomico do DOM.
3. Evitar locator strict em seletores que legitimamente retornam muitos cards.
4. Esperar sinais de conteudo, nao estado global de rede.
5. Preservar acumulador por `jobId` fora do DOM.
6. Executar smoke test contra HTML local que substitui cards durante o scroll.

## Testes obrigatorios

```powershell
node --test test/linkedin-parsers.test.js test/linkedin-scroll.test.js test/playwright-scraping-local.test.js
node --check src/scraper/linkedin.js
npm test
npm run lint
```

## Criterios de aceite

- DOM virtualizado nao perde vagas ja observadas.
- Scroll termina por falta de progresso, limite ou timeout.
- Contagens localizadas continuam corretas.
- Detalhes mantem formato compativel com SQLite.
- Chromium real acessa apenas servidor local nos testes.

## Nota para a fase seguinte

O clique de candidatura e a captura de URL externa permanecem isolados para a Fase 06. Esta fase nao deve introduzir listeners globais de popup.

# Fase 05: Scraping Robusto

## Missao

Melhorar a coleta no LinkedIn com scroll de DOM virtual, deteccao de desafios, atrasos configuraveis e captura segura de URL externa.

**Depende de:** nenhuma outra fase.

## Resultado isolado

Aplicada ao `BASE_COMMIT`, esta fase fortalece somente a implementacao especifica do LinkedIn e pode ser testada contra fixtures e paginas locais.

## Escopo

- Detectar checkpoint, CAPTCHA e 2FA por URL e sinais de DOM.
- Produzir erro operacional distinto para intervencao humana.
- Salvar screenshot de falha com nome unico em diretorio ignorado.
- Adicionar delay de digitacao configuravel e injetavel.
- Rolar a lista de resultados com limites de tempo e iteracoes.
- Acumular vagas a cada iteracao para suportar DOM virtualizado.
- Encerrar scroll apos rodadas sem IDs novos.
- Normalizar contagem de resultados em formatos localizados.
- Preservar texto bruto e normalizar tipo de candidatura.
- Capturar popup pelo opener correto e listener registrado antes do clique.
- Tratar modal intermediaria, popup atrasado e navegacao na mesma aba.
- Fechar popup em `finally`.

## Fora do escopo

- `puppeteer-extra-plugin-stealth`.
- Rotacao de User-Agent ou proxy.
- Fila, SQLite e endpoints HTTP.
- Garantia de compatibilidade permanente com o DOM real do LinkedIn.

## Arquivos esperados

- `src/scraper/linkedin.js`
- `src/scraper/linkedin-parsers.js`
- `test/linkedin-parsers.test.js`
- `test/linkedin-scroll.test.js`
- `test/linkedin-external-url.test.js`
- `test/fixtures/linkedin/`
- `.gitignore`

## Contratos

- Parsers puros recebem texto ou dados simples e nao dependem de uma pagina real.
- Scroll retorna um array deduplicado de `{ jobId, url }`.
- Todos os loops possuem timeout e numero maximo de iteracoes.
- Delays recebem uma funcao aleatoria injetavel em testes.
- Desafio de autenticacao lanca erro identificavel pelo chamador.
- URL externa ausente e `null`; falha nao e representada como string `"N/A"`.

## Implementacao

1. Extrair normalizadores de contagem e candidatura para modulo puro.
2. Criar detector de desafio executado apos navegacoes de login.
3. Criar coletor incremental para a lista virtualizada.
4. Substituir esperas fixas por eventos e waits com timeout.
5. Associar novos targets ao target de origem.
6. Garantir cleanup de popup, listeners e timers.
7. Criar fixtures para ingles e portugues.

## Testes obrigatorios

```powershell
node --test test/linkedin-parsers.test.js test/linkedin-scroll.test.js test/linkedin-external-url.test.js
node --check src/scraper/linkedin.js
node --check src/scraper/linkedin-parsers.js
```

Pode existir um teste opcional com Chromium contra servidor localhost. Nenhum teste obrigatorio acessa LinkedIn.

## Criterios de aceite

- Cards removidos do DOM durante scroll continuam presentes no resultado acumulado.
- Scroll termina quando nao ha progresso ou quando atinge o limite.
- `4,204`, `4.204` e textos equivalentes sao interpretados corretamente.
- Popup de outra pagina nao e confundido com o popup da vaga atual.
- Timeout fecha recursos e retorna resultado controlado.
- CAPTCHA e 2FA nao aparecem como timeout generico de seletor.
- Os testes passam apenas com esta branch aplicada ao `BASE_COMMIT`.

## Nota de integracao

A Fase 04 tambem trata fechamento de paginas. Na integracao, a pagina principal segue pertencendo ao orquestrador e somente popups criados nesta fase sao fechados pelo helper de URL externa.

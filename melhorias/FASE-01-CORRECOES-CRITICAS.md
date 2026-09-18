# Fase 01: Correcoes Criticas

## Missao

Corrigir falhas de configuracao, caminhos, URL, deduplicacao e propagacao de erros sem depender de SQLite, fila, mudancas no browser ou melhorias de scraping.

**Depende de:** nenhuma outra fase.

## Resultado isolado

A branch desta fase continua usando JSON, mas passa a usar exclusivamente `storage/vagas.json`, preserva a localizacao nas URLs paginadas, valida a configuracao no momento correto e informa falhas ao chamador.

## Escopo

- Centralizar `STORAGE_DIR`, `JOBS_FILE_PATH` e `COOKIES_FILE_PATH` em `src/core/config.js`.
- Remover `process.exit(1)` durante o carregamento do modulo.
- Expor uma funcao de validacao de credenciais chamada somente ao iniciar o scraping.
- Preservar `location` em `parseSearchUrl()` e `generateSearchUrl()`.
- Substituir o limite fixo de cinco vagas por `SCRAPE_LIMIT` validado.
- Deduplicar `jobId` tanto contra o arquivo existente quanto dentro da execucao atual.
- Fazer `runScraper()` retornar um resumo e relancar erros fatais.
- Fazer os servicos de arquivo propagarem falhas de leitura e escrita relevantes.
- Garantir a existencia de `storage/` antes da escrita.
- Gravar JSON por arquivo temporario seguido de rename atomico.
- Capturar explicitamente a Promise iniciada pelo controller.

## Fora do escopo

- SQLite.
- Fila e endpoint de status.
- Reestruturacao do singleton do browser.
- Alteracoes de seletores ou comportamento anti-bot.
- Paginacao do `GET /api/jobs`.

## Arquivos esperados

- `src/core/config.js`
- `src/services/url-generator.js`
- `src/services/file-saver.js`
- `src/services/session-manager.js`
- `src/controllers/jobController.js`
- `scraper.js`
- `.gitignore`
- `test/config.test.js`
- `test/url-generator.test.js`
- `test/file-saver.test.js`
- `test/scraper.test.js`

## Contratos

- `runScraper(keywords, location, options)` continua exportado.
- `options.limit` pode sobrescrever `SCRAPE_LIMIT` apos validacao.
- Uma execucao bem-sucedida retorna contagens de encontrados, ignorados, processados e salvos.
- Erro fatal rejeita a Promise; nao e convertido em sucesso com log.
- Arquivo ausente significa conjunto vazio; JSON corrompido e erro explicito e nao deve ser sobrescrito.

## Implementacao

1. Transformar o parsing de ambiente em funcoes testaveis e sem efeitos fatais no import.
2. Corrigir o round-trip de todos os parametros de URL, incluindo `location`.
3. Criar um unico caminho de storage na raiz e remover calculos locais divergentes.
4. Implementar escrita atomica no adaptador JSON.
5. Atualizar a deduplicacao para adicionar IDs ao `Set` durante o filtro.
6. Retornar resultado estruturado e preservar rejeicoes.
7. Adicionar `.catch()` na execucao em background enquanto nao existe fila.

## Testes obrigatorios

```powershell
node --test test/config.test.js test/url-generator.test.js test/file-saver.test.js test/scraper.test.js
node --check scraper.js
node --check src/core/config.js
node --check src/services/url-generator.js
node --check src/services/file-saver.js
```

Os testes devem usar diretorios temporarios e dublês do scraper. Nenhum teste obrigatorio acessa LinkedIn ou exige credenciais.

## Criterios de aceite

- Importar a API sem credenciais nao encerra o processo.
- URLs de todas as paginas preservam `keywords`, `location` e periodo.
- Nenhum consumidor usa `src/storage` ou `vagas.json` na raiz.
- IDs repetidos em paginas diferentes sao processados uma vez.
- Falha de persistencia rejeita a operacao.
- Os testes da fase passam apenas com esta branch aplicada ao `BASE_COMMIT`.

## Nota de integracao

Na composicao final, o adaptador JSON sera substituido pelo repositorio SQLite da Fase 02. Devem ser preservados os contratos de erro, deduplicacao e resultado estruturado desta fase.

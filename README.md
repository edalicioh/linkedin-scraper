# LinkedIn Job Scraper

Aplicacao Node.js que usa Puppeteer para consultar vagas do LinkedIn e expoe uma
API HTTP opcional para enfileirar scrapes e consultar os resultados.

Use este projeto somente com autorizacao. O LinkedIn pode bloquear automacao,
exigir CAPTCHA ou 2FA e alterar a estrutura das paginas.

## Requisitos

- Node.js `>=20.18.1`
- npm
- Credenciais de uma conta do LinkedIn para executar o scraper
- Chromium compativel com a instalacao do Puppeteer

Os testes automatizados nao precisam de credenciais, navegador ou rede externa.

## Instalacao

```bash
npm ci
```

Copie `.env.example` para `.env` e substitua os valores ficticios. O navegador
permanece visivel por padrao; use `HEADLESS=true` somente quando apropriado.

## Executar

```bash
npm start
npm run start:api
```

A execucao direta usa `php` e `Brasil` como valores padrao. A API escuta em
`http://localhost:3000` por padrao e aceita outra porta via `PORT`.

## API

`GET /` retorna o estado da API.

`POST /api/scrape` valida `keywords` e `location`, coloca o trabalho na fila FIFO
em memoria e retorna `202` com `taskId` e `statusUrl`:

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"keywords":"desenvolvedor javascript","location":"Sao Paulo"}'
```

`GET /api/scrape/:taskId` retorna o estado da tarefa. A fila possui concorrencia
1 e retorna `429` quando o backlog esta cheio.

`GET /api/jobs` retorna `{ "items": [], "page": 1, "limit": 25, "total": 0 }`.
Aceita `page`, `limit` (maximo 100), `search`, `type`, `company` e `location`.
Filtros podem ser combinados; parametros invalidos retornam `400`.

## Persistencia

As vagas sao armazenadas em `storage/jobs.db` usando SQLite. O banco e criado
com WAL, foreign keys, `busy_timeout` e migracoes idempotentes. Para importar
JSONs historicos sem remover as origens:

```bash
node scripts/migrate-json.js
```

O banco, seus arquivos WAL/SHM, credenciais, cookies, resultados e screenshots
de erro sao ignorados por Git.

## Qualidade

```bash
npm test
npm run lint
npm run format:check
```

Os testes usam `node:test` e nao acessam o LinkedIn. O teste ao vivo exige
credenciais reais, rede, Puppeteer e pode parar em CAPTCHA ou 2FA; os seletores
dependem do DOM atual e nao sao declarados permanentemente validados.

## Estrutura

```text
api.js                         Entry point da API e shutdown gracioso
scraper.js                     Orquestracao do scraping
src/app.js                     Factory da aplicacao Express
src/core/                      Configuracao e ciclo de vida do navegador
src/db/                        Banco e migracoes SQLite
src/repositories/              Repositorios de jobs
src/routes/                    Rotas HTTP
src/scraper/                   Login, seletores e extracao LinkedIn
src/services/                  Fila, consulta, sessao e URLs
test/                          Testes locais
storage/                       Dados locais nao versionados
```

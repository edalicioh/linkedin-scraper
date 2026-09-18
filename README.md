# LinkedIn Job Scraper

Aplicacao Node.js que usa Puppeteer para consultar vagas do LinkedIn e expoe uma
API HTTP opcional para iniciar o scraper e consultar o arquivo de resultados.

> Aviso: use este projeto somente com autorizacao. O LinkedIn pode bloquear
> automacao, exigir CAPTCHA ou 2FA e alterar a estrutura das paginas. A API
> oficial do LinkedIn deve ser preferida quando estiver disponivel.

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

Copie `.env.example` para `.env` e substitua os valores ficticios:

```env
LINKEDIN_EMAIL=seu_email@example.com
LINKEDIN_PASSWORD=sua_senha
MAX_PAGES=3
JOBS_PER_PAGE=25
TIME_PERIOD=any
PORT=3000
```

Os valores aceitos para `TIME_PERIOD` sao `24h`, `7d`, `30d` e `any`.

## Executar o scraper

```bash
npm start
# ou
node scraper.js
```

A execucao direta usa `php` e `Brasil` como palavras-chave e local padrao.
O fluxo abre um navegador visivel, tenta reutilizar cookies e acessa o LinkedIn
para extrair as vagas.

## Executar a API

```bash
npm run start:api
# ou
node api.js
```

Por padrao, a API escuta em `http://localhost:3000`. A porta pode ser alterada
com `PORT`. A aplicacao pode ser importada por testes via `createApp()` sem
abrir uma porta; `api.js` somente chama `listen()` quando executado diretamente.

### Rotas

`GET /` retorna uma mensagem simples de saude da API.

`POST /api/scrape` valida `keywords` e `location`, retorna `202` imediatamente
e inicia o scraper em background:

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"keywords":"desenvolvedor javascript","location":"Sao Paulo"}'
```

`GET /api/jobs` le `storage/vagas.json`. Se o arquivo nao existir, retorna
`404`; se existir, retorna seu JSON.

## Armazenamento atual

O diretorio `storage/` e versionado apenas com `.gitkeep`. O controller da API
le `storage/vagas.json`, enquanto o saver e o gerenciador de sessao do baseline
resolvem seus arquivos em `src/storage/`. Essa divergencia e uma limitacao
conhecida deste baseline e nao e corrigida nesta fase.

Arquivos de credenciais, cookies, resultados e screenshots de erro sao ignorados
por Git. Nunca versione esses artefatos.

## Qualidade

```bash
npm test
npm run lint
npm run format:check
```

`npm test` usa exclusivamente `node:test` e cobre smoke tests locais da
aplicacao e das rotas existentes. `npm run format` aplica Prettier.

## Teste ao vivo

O teste contra o LinkedIn nao faz parte da suite automatizada. Ele exige
credenciais reais, rede, um navegador Puppeteer e pode parar em CAPTCHA ou
2FA. Os seletores em `src/scraper/linkedin.js` dependem do DOM atual do
LinkedIn e nao sao declarados validados por esta suite.

## Estrutura

```text
api.js                    Entry point da API
scraper.js                Entry point do scraper e orquestracao
src/app.js                Factory da aplicacao Express
src/controllers/          Controllers HTTP
src/core/                 Configuracao e navegador
src/routes/               Rotas HTTP
src/scraper/              Seletores e extracao do LinkedIn
src/services/             Persistencia, sessao e URLs
test/app.test.js          Smoke tests locais
storage/                  Diretorio de dados versionado vazio
```

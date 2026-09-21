# API HTTP

## Visao geral

A API e executada por:

```bash
npm run start:api
```

Com Docker:

```bash
docker compose up --build -d
```

Por padrao, a API fica disponivel em `http://localhost:3000`.

A API nao possui autenticacao HTTP. Proteja a porta publicada com firewall,
proxy reverso ou rede privada quando for executada fora da maquina local.

## Estado da API

### `GET /`

Retorna uma mensagem simples para verificar se o servidor esta respondendo.

Resposta `200 OK`:

```json
{
  "message": "API do Scraper do LinkedIn está rodando!"
}
```

Exemplo:

```bash
curl http://localhost:3000/
```

### `GET /app` ou `GET /index.html`

Interface web simples servida estaticamente para visualizacao e filtragem de vagas salvas e acompanhamento de tarefas de scraping em tempo real no navegador.

## Iniciar scraping

### `POST /api/scrape`

Coloca uma extracao na fila FIFO. A fila executa uma tarefa por vez e o
processamento ocorre em segundo plano.

Cabecalho:

```text
Content-Type: application/json
```

Corpo obrigatorio:

| Campo      | Tipo   | Descricao               |
| ---------- | ------ | ----------------------- |
| `keywords` | string | Termos usados na busca. |
| `location` | string | Local da busca.         |

Exemplo:

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"keywords":"desenvolvedor javascript","location":"Sao Paulo"}'
```

Resposta `202 Accepted`:

```json
{
  "message": "Processo de scraping enfileirado.",
  "taskId": "8d8d1d4e-1c9c-4d91-99df-8c1e9f8c1f58",
  "status": "PENDING",
  "statusUrl": "/api/scrape/8d8d1d4e-1c9c-4d91-99df-8c1e9f8c1f58",
  "keywords": "desenvolvedor javascript",
  "location": "Sao Paulo"
}
```

Respostas de erro:

| Status | Situacao                                             | Corpo                                                  |
| ------ | ---------------------------------------------------- | ------------------------------------------------------ |
| `400`  | `keywords` ou `location` ausente, vazio ou invalido. | `{"error":"Parâmetros ... são obrigatórios."}`         |
| `429`  | A fila atingiu o limite de tarefas.                  | `{"error":"A fila de scraping está cheia."}`           |
| `500`  | Falha interna ao enfileirar a tarefa.                | `{"error":"Falha ao iniciar o processo de scraping."}` |

## Consultar tarefa

### `GET /api/scrape/:taskId`

Consulta o estado de uma tarefa criada por `POST /api/scrape`.

Exemplo:

```bash
curl http://localhost:3000/api/scrape/8d8d1d4e-1c9c-4d91-99df-8c1e9f8c1f58
```

Resposta:

```json
{
  "id": "8d8d1d4e-1c9c-4d91-99df-8c1e9f8c1f58",
  "input": {
    "keywords": "desenvolvedor javascript",
    "location": "Sao Paulo"
  },
  "status": "COMPLETED",
  "counts": {
    "results": 120,
    "links": 25,
    "jobs": 5,
    "found": 25,
    "ignored": 20,
    "processed": 5,
    "saved": 5
  },
  "error": null,
  "createdAt": "2026-09-18T14:00:00.000Z",
  "startedAt": "2026-09-18T14:00:01.000Z",
  "completedAt": "2026-09-18T14:03:10.000Z"
}
```

Estados possiveis:

| Estado      | Significado                                |
| ----------- | ------------------------------------------ |
| `PENDING`   | A tarefa aguarda na fila.                  |
| `RUNNING`   | A extracao esta em andamento.              |
| `COMPLETED` | A extracao terminou normalmente.           |
| `PARTIAL`   | A extracao terminou com resultado parcial. |
| `FAILED`    | A extracao falhou; consulte `error`.       |

Quando a tarefa falha, `error` possui esta estrutura:

```json
{
  "message": "Mensagem do erro"
}
```

Resposta para uma tarefa inexistente: `404 Not Found`.

```json
{
  "error": "Tarefa de scraping não encontrada."
}
```

## Consultar vagas

### `GET /api/jobs`

Retorna as vagas salvas no SQLite com paginacao e filtros opcionais.

Parametros:

| Parametro    | Tipo                   | Padrao  | Regras                                                |
| ------------ | ---------------------- | ------- | ----------------------------------------------------- |
| `page`       | inteiro positivo       | `1`     | Numero da pagina.                                     |
| `limit`      | inteiro de `1` a `100` | `25`    | Itens por pagina.                                     |
| `search`     | string                 | nenhum  | Busca textual.                                        |
| `type`       | string                 | nenhum  | Filtra pelo tipo da vaga.                             |
| `company`    | string                 | nenhum  | Filtra pela empresa.                                  |
| `location`   | string                 | nenhum  | Filtra pela localizacao.                              |
| `sort`       | string                 | `score` | Ordena por `score` (padrao) ou `date` (data extracao). |
| `order`      | string                 | `desc`  | Direcao `desc` ou `asc`.                              |
| `minScore`   | inteiro de `0` a `100` | nenhum  | Filtra vagas com score maior ou igual ao informado.   |
| `pjOnly`     | booleano               | `false` | Filtra vagas identificadas como PJ.                   |
| `remoteOnly` | booleano               | `false` | Filtra vagas identificadas como Remoto.               |

Os filtros podem ser combinados.

Exemplo:

```bash
curl "http://localhost:3000/api/jobs?page=1&limit=10&search=javascript&location=Sao%20Paulo"
```

Resposta `200 OK`:

```json
{
  "items": [
    {
      "jobId": "4456258553",
      "title": "Desenvolvedor JavaScript",
      "company": "Empresa Exemplo",
      "queryLocation": "Sao Paulo",
      "jobLocation": "Sao Paulo, SP",
      "description": "Descricao da vaga",
      "type": "Tempo integral",
      "applicationTypeRaw": "Candidatura simplificada",
      "url": "https://www.linkedin.com/jobs/view/4456258553/",
      "externalUrl": null,
      "ai": {
        "eligible": true,
        "isPJ": true,
        "isRemote": true,
        "score": 88,
        "summary": "Boa aderência ao perfil.",
        "evidence": { "pj": "Contrato PJ", "remote": "100% remoto" },
        "criteria": {},
        "model": "modelo-local",
        "profileVersion": "v1",
        "scoredAt": "2026-09-18T14:03:10.000Z"
      },
      "extractionDate": "2026-09-18T14:03:10.000Z",
      "firstSeenAt": "2026-09-18T14:03:10.000Z",
      "lastSeenAt": "2026-09-18T14:03:10.000Z"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 1
}
```

Respostas de erro:

| Status | Situacao                                                                                 |
| ------ | ---------------------------------------------------------------------------------------- |
| `400`  | Parametro invalido, pagina menor que `1`, `limit` maior que `100` ou parametro repetido. |
| `500`  | Falha ao ler o banco SQLite.                                                             |

Erro de validacao `400`:

```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "Query parameter \"limit\" cannot exceed 100."
  }
}
```

## Scheduler Docker

O `docker compose up` inicia o servico `scheduler`, que envia uma requisicao
para `POST /api/scrape` no inicio de cada hora entre `06:00` e `18:00`,
inclusive, no fuso `America/Sao_Paulo`.

Variaveis configuraveis no `.env`:

```env
SCRAPE_KEYWORDS=php
SCRAPE_LOCATION=Brasil
SCRAPE_CRON=0 6-18 * * *
CRON_TIMEZONE=America/Sao_Paulo
```

Logs do scheduler:

```bash
docker compose logs -f scheduler
```

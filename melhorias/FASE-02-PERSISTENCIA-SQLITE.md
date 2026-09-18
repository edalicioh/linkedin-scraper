# Fase 02: Persistencia SQLite

## Missao

Substituir a persistencia de vagas em JSON por SQLite, com migracao idempotente dos dados existentes e consultas por repositorio.

**Depende de:** nenhuma outra fase.

## Resultado isolado

Aplicada diretamente ao `BASE_COMMIT`, esta fase cria e inicializa `storage/jobs.db`, importa os JSONs historicos e usa SQLite para deduplicacao, gravacao e leitura de vagas.

## Escopo

- Adicionar `better-sqlite3`.
- Criar inicializacao e migracoes versionadas do banco.
- Criar repositorio de jobs com `findExistingIds`, `upsert`, `getById` e `listAll`.
- Alterar o scraper para deduplicar e persistir pelo repositorio.
- Alterar `GET /api/jobs` para ler pelo repositorio sem mudar ainda o formato de array.
- Importar dados dos tres caminhos historicos de `vagas.json`.
- Habilitar WAL, foreign keys e `busy_timeout`.
- Ignorar banco, arquivos WAL/SHM e backups no Git.

## Fora do escopo

- Fila de scraping e status de tarefas.
- Filtros e paginacao HTTP.
- Mudancas no ciclo de vida do browser.
- Mudancas em seletores LinkedIn.
- Exclusao automatica dos JSONs importados.

## Arquivos esperados

- `package.json`
- `package-lock.json`
- `src/db/database.js`
- `src/db/migrations.js`
- `src/repositories/jobRepository.js`
- `scripts/migrate-json.js`
- `scraper.js`
- `src/controllers/jobController.js`
- `.gitignore`
- `test/database.test.js`
- `test/job-repository.test.js`
- `test/json-migration.test.js`

## Esquema minimo

```sql
CREATE TABLE jobs (
  job_id TEXT PRIMARY KEY,
  title TEXT,
  company TEXT,
  query_location TEXT,
  job_location TEXT,
  description TEXT,
  application_type TEXT,
  application_type_raw TEXT,
  url TEXT NOT NULL,
  external_url TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  extracted_at TEXT NOT NULL
);
```

As migracoes devem usar `PRAGMA user_version` ou tabela equivalente e executar dentro de transacao.

## Contratos

- `job_id` permanece texto e e a identidade da vaga.
- Ausencia de valor e armazenada como `NULL`, nunca como `"N/A"` novo.
- UPSERT preserva `first_seen_at` e atualiza campos mutaveis e `last_seen_at`.
- O repositorio recebe a conexao por parametro para permitir banco temporario em testes.
- A importacao aceita registros parcialmente validos, relata rejeitados e nunca remove a origem.

## Implementacao

1. Instalar e validar `better-sqlite3` na versao de Node suportada.
2. Criar uma fabrica de conexao que aceite caminho explicito.
3. Implementar migracoes repetiveis com seguranca.
4. Implementar statements preparados e transacoes em lote.
5. Adaptar o scraper e o controller ao repositorio.
6. Criar importador para os caminhos historicos, com backup e relatorio.
7. Garantir fechamento da conexao no encerramento do processo ou do teste.

## Testes obrigatorios

```powershell
node --test test/database.test.js test/job-repository.test.js test/json-migration.test.js
node --check src/db/database.js
node --check src/db/migrations.js
node --check src/repositories/jobRepository.js
node --check scripts/migrate-json.js
```

Os testes devem criar um banco temporario por caso e cobrir migracao vazia, reexecucao, UPSERT, rollback, duplicatas e JSON corrompido.

## Criterios de aceite

- O schema nasce corretamente em banco vazio.
- Reexecutar migracoes e importacao nao duplica vagas.
- Falha em uma transacao nao deixa lote parcial.
- A API e o scraper nao leem nem escrevem `vagas.json` apos a migracao.
- Os arquivos JSON de origem permanecem intactos.
- Os testes passam apenas com esta branch aplicada ao `BASE_COMMIT`.

## Nota de integracao

A Fase 06 entrega paginacao sobre um provedor JSON para permanecer independente. Na integracao, seu contrato de consulta deve ser implementado por `jobRepository`, sem restaurar leitura direta de JSON.

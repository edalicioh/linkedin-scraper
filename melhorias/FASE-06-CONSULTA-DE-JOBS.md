# Fase 06: Consulta de Jobs

## Missao

Adicionar validacao, filtros e paginacao ao `GET /api/jobs` sem depender da migracao SQLite.

**Depende de:** nenhuma outra fase.

## Resultado isolado

Aplicada ao `BASE_COMMIT`, esta fase consulta o JSON existente por meio de um provedor abstrato e responde no contrato paginado definitivo.

## Escopo

- Criar servico de consulta desacoplado do formato de armazenamento.
- Fornecer adaptador JSON local para funcionamento isolado.
- Validar `page`, `limit`, `search`, `type`, `company` e `location`.
- Aplicar limite maximo por pagina.
- Ordenar de forma estavel por data de extracao e `jobId`.
- Responder `{ items, page, limit, total }`.
- Padronizar erros JSON para query invalida e falha de leitura.

## Fora do escopo

- SQLite e migracao de dados.
- Escrita de vagas.
- Fila e status de scraping.
- Autenticacao e rate limiting para acesso externo.
- Alteracoes no Puppeteer.

## Arquivos esperados

- `src/services/jobQueryService.js`
- `src/repositories/jsonJobQueryProvider.js`
- `src/controllers/jobController.js`
- `src/routes/jobRoutes.js`
- `test/job-query-service.test.js`
- `test/jobs-route.test.js`

## Contrato do provedor

```javascript
async function queryJobs({ page, limit, search, type, company, location }) {
  return { items, total };
}
```

O controller nao conhece JSON, SQLite ou caminhos de arquivo. O provider recebe os filtros normalizados.

## Contratos HTTP

- `page` inicia em 1.
- `limit` possui padrao e maximo documentados.
- Busca textual e case-insensitive sobre titulo e empresa.
- Parametro invalido retorna `400` com erro JSON.
- Fonte vazia ou arquivo ausente retorna lista vazia, nao `404`.
- Ordenacao e deterministica quando datas sao iguais ou ausentes.

## Implementacao

1. Criar parser puro de query parameters.
2. Criar servico que delega ao provider e monta metadados.
3. Implementar provider JSON apenas para independencia da fase.
4. Adaptar o controller sem alterar o POST de scraping.
5. Cobrir busca combinada, paginas vazias e limites.

## Testes obrigatorios

```powershell
node --test test/job-query-service.test.js test/jobs-route.test.js
node --check src/services/jobQueryService.js
node --check src/repositories/jsonJobQueryProvider.js
node --check src/controllers/jobController.js
```

Os testes devem injetar o provider ou usar um JSON temporario. Nenhum teste exige browser ou credenciais.

## Criterios de aceite

- Resposta sempre segue `{ items, page, limit, total }` em sucesso.
- Filtros podem ser combinados.
- Paginacao nao carrega nem retorna itens fora da pagina solicitada na interface do servico.
- Parametros negativos, fracionarios ou excessivos sao rejeitados ou normalizados conforme contrato documentado.
- Resultado permanece estavel entre chamadas identicas.
- Os testes passam apenas com esta branch aplicada ao `BASE_COMMIT`.

## Nota de integracao

O provider JSON desta fase e descartavel. Depois da incorporacao da Fase 02, `jobRepository` deve implementar `queryJobs` com SQL, mantendo inalterados o controller, o servico e o contrato HTTP.

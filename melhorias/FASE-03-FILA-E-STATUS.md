# Fase 03: Fila e Status

## Missao

Serializar requisicoes de scraping e expor acompanhamento de tarefas sem depender de SQLite ou de qualquer outra fase.

**Depende de:** nenhuma outra fase.

## Resultado isolado

Aplicada ao `BASE_COMMIT`, esta fase fornece uma fila FIFO em memoria, concorrencia 1, limite de backlog e endpoint de status. Reiniciar o processo descarta o historico, comportamento aceito para a implantacao local escolhida.

## Escopo

- Criar fila com runner injetavel.
- Criar armazenamento de tarefas em memoria.
- Gerar IDs com `crypto.randomUUID()`.
- Retornar `202`, `taskId` e URL de status no POST.
- Adicionar `GET /api/scrape/:taskId`.
- Limitar backlog e retornar `429` quando cheio.
- Garantir que falhas assincronas atualizem a tarefa e nao gerem rejeicao nao tratada.
- Fazer a correcao minima em `runScraper()` necessaria para que erros sejam observaveis.

## Fora do escopo

- Persistencia de tarefas apos restart.
- Redis, BullMQ ou multiplas replicas.
- Cancelamento de tarefas.
- Mudancas na persistencia de vagas.
- Mudancas em Puppeteer e seletores.

## Arquivos esperados

- `src/services/scrapeQueue.js`
- `src/services/memoryTaskStore.js`
- `src/controllers/jobController.js`
- `src/routes/jobRoutes.js`
- `scraper.js`
- `test/scrape-queue.test.js`
- `test/task-routes.test.js`

## Estados

- `PENDING`
- `RUNNING`
- `COMPLETED`
- `PARTIAL`
- `FAILED`

Cada tarefa contem ID, entrada normalizada, estado, contagens disponiveis, erro sanitizado e timestamps.

## Contratos

- A fila aceita `enqueue(payload)` e retorna imediatamente a tarefa criada.
- Apenas um runner pode estar ativo.
- Falha de uma tarefa nao impede a proxima.
- O store e o runner sao injetados para testes.
- Detalhes internos, stack traces e credenciais nao aparecem na resposta HTTP.
- `GET /api/scrape/:taskId` retorna `404` para ID desconhecido.

## Implementacao

1. Implementar store em memoria sem acoplamento ao Express.
2. Implementar fila com pump unico e protecao contra chamadas concorrentes.
3. Adaptar o controller para validar, criar e enfileirar a tarefa.
4. Implementar consulta de status.
5. Fazer `runScraper()` rejeitar erro fatal e retornar resumo quando possivel.
6. Cobrir fila cheia, erro, sucesso parcial e continuidade apos falha.

## Testes obrigatorios

```powershell
node --test test/scrape-queue.test.js test/task-routes.test.js
node --check src/services/scrapeQueue.js
node --check src/services/memoryTaskStore.js
node --check src/controllers/jobController.js
```

Os testes usam runner falso controlado por Promises e nao iniciam navegador.

## Criterios de aceite

- Dez tarefas simultaneas nunca executam mais de um runner por vez.
- Ordem FIFO e preservada.
- Erro de uma tarefa produz `FAILED` e a seguinte executa.
- Backlog acima do limite retorna `429` sem criar trabalho oculto.
- POST retorna antes da conclusao do scraping.
- Os testes passam apenas com esta branch aplicada ao `BASE_COMMIT`.

## Nota de integracao

Se futuramente for necessario historico duravel, `memoryTaskStore` pode ser substituido por um adaptador SQLite sem alterar a fila. Nesta entrega, nao se deve introduzir dependencia da Fase 02.

# Fase 07: Shutdown e Fila

## Missao

Garantir que o encerramento da API coordene servidor, fila, contextos ativos e browser Playwright sem interromper silenciosamente uma tarefa.

**Depende de:** Fase 06 aprovada.

## Resultado

`SIGINT` e `SIGTERM` param novas requisicoes, aguardam a fila dentro de um prazo definido e fecham o browser de forma idempotente.

## Escopo

- Expor a fila usada pela aplicacao ao runtime da API por injecao explicita.
- Parar de aceitar novas requisicoes antes de fechar o browser.
- Aguardar `queue.waitForIdle()` com timeout configuravel.
- Fechar browser depois da fila ou do timeout.
- Registrar timeout de shutdown sem expor dados sensiveis.
- Manter shutdown idempotente e testavel.
- Cobrir tarefa ativa, fila vazia e chamadas repetidas.

## Fora do escopo

- Persistir tarefas apos restart.
- Cancelamento HTTP de tarefa.
- Multiplos processos ou replicas.
- Redis, BullMQ ou workers externos.

## Arquivos esperados

- `api.js`
- `src/app.js`
- `src/controllers/jobController.js`
- `src/routes/jobRoutes.js`, somente se necessario para injecao.
- `src/services/scrapeQueue.js`
- `test/api-shutdown.test.js`
- `test/task-routes.test.js`

## Contratos

- `createApp(dependencies)` nao abre porta.
- `startServer(options)` continua retornando servidor e shutdown.
- Apenas um runner executa por vez.
- Falha de tarefa nao impede a proxima.
- Shutdown repetido retorna a mesma Promise ou resultado equivalente.
- Browser nao fecha antes do encerramento controlado da fila.

## Implementacao

1. Criar composicao de runtime que compartilhe controller, store e queue.
2. Passar a fila ao `createShutdown()` ou a um coordenador dedicado.
3. Encerrar o servidor HTTP para bloquear novas requisicoes.
4. Aguardar fila ociosa com timeout explicito.
5. Fechar browser em `finally`.
6. Remover handlers de sinal em testes ou permitir `processRef` injetavel.

## Testes obrigatorios

```powershell
node --test test/api-shutdown.test.js test/task-routes.test.js test/scrape-queue.test.js
node --check api.js
node --check src/app.js
npm test
npm run lint
```

## Criterios de aceite

- Tarefa ativa pode concluir antes do fechamento do browser.
- Timeout de shutdown encerra recursos de forma controlada.
- Fila vazia fecha imediatamente.
- Duas chamadas de shutdown fecham servidor e browser uma vez.
- API continua importavel sem credenciais.

## Nota para a fase seguinte

A Fase 08 nao deve alterar esse fluxo, apenas documentar, limpar dependencias antigas e executar a validacao final.

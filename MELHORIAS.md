# Orquestracao das Melhorias

Este arquivo coordena a execucao paralela das melhorias do LinkedIn Scraper. Cada fase possui um plano proprio, pode ser desenvolvida e validada sem aguardar qualquer outra fase e deve usar uma worktree exclusiva.

## Regras de independencia

1. Todas as fases partem do mesmo `BASE_COMMIT` imutavel.
2. Nenhuma branch de fase pode incorporar outra branch de fase durante o desenvolvimento.
3. Nenhuma fase pode importar um modulo que exista somente no plano de outra fase.
4. Se uma fase precisar de uma abstracao ainda inexistente, ela deve fornecer um adaptador local minimo.
5. Cada fase deve executar e passar seus proprios testes sobre `BASE_COMMIT + branch da fase`.
6. Conflitos entre solucoes paralelas sao tratados apenas na worktree de integracao.
7. Uma fase concluida entrega commits pequenos, uma lista de arquivos alterados e os comandos de verificacao executados.

Independencia significa que o desenvolvimento e a validacao de uma fase nao bloqueiam as demais. A composicao de todas as fases continua sendo uma atividade separada de integracao.

## Decisoes fixadas

| Tema | Decisao |
| --- | --- |
| Implantacao | Um processo local |
| Fila | FIFO em memoria, concorrencia 1 |
| Persistencia de vagas | SQLite com `better-sqlite3` |
| Resposta de jobs | `{ items, page, limit, total }` |
| Navegador | Visivel e assistido |
| Stealth | Adiado, fora destas fases |
| Testes | `node:test`, com integracao local sem LinkedIn |

## Planos independentes

| Fase | Branch | Worktree sugerida | Plano |
| --- | --- | --- | --- |
| 01 | `melhoria/fase-01-correcoes` | `../linkedin-scraper-fase-01` | [`melhorias/FASE-01-CORRECOES-CRITICAS.md`](melhorias/FASE-01-CORRECOES-CRITICAS.md) |
| 02 | `melhoria/fase-02-sqlite` | `../linkedin-scraper-fase-02` | [`melhorias/FASE-02-PERSISTENCIA-SQLITE.md`](melhorias/FASE-02-PERSISTENCIA-SQLITE.md) |
| 03 | `melhoria/fase-03-fila` | `../linkedin-scraper-fase-03` | [`melhorias/FASE-03-FILA-E-STATUS.md`](melhorias/FASE-03-FILA-E-STATUS.md) |
| 04 | `melhoria/fase-04-browser` | `../linkedin-scraper-fase-04` | [`melhorias/FASE-04-CICLO-DO-BROWSER.md`](melhorias/FASE-04-CICLO-DO-BROWSER.md) |
| 05 | `melhoria/fase-05-scraping` | `../linkedin-scraper-fase-05` | [`melhorias/FASE-05-SCRAPING-ROBUSTO.md`](melhorias/FASE-05-SCRAPING-ROBUSTO.md) |
| 06 | `melhoria/fase-06-api-jobs` | `../linkedin-scraper-fase-06` | [`melhorias/FASE-06-CONSULTA-DE-JOBS.md`](melhorias/FASE-06-CONSULTA-DE-JOBS.md) |
| 07 | `melhoria/fase-07-qualidade` | `../linkedin-scraper-fase-07` | [`melhorias/FASE-07-QUALIDADE-E-DOCUMENTACAO.md`](melhorias/FASE-07-QUALIDADE-E-DOCUMENTACAO.md) |

## Criacao das worktrees

Antes de executar os comandos, estes planos devem estar presentes no commit escolhido como base e `git status --short` nao deve conter segredos ou artefatos de execucao.

```powershell
$BASE_COMMIT = git rev-parse HEAD

git worktree add "..\linkedin-scraper-fase-01" -b "melhoria/fase-01-correcoes" $BASE_COMMIT
git worktree add "..\linkedin-scraper-fase-02" -b "melhoria/fase-02-sqlite" $BASE_COMMIT
git worktree add "..\linkedin-scraper-fase-03" -b "melhoria/fase-03-fila" $BASE_COMMIT
git worktree add "..\linkedin-scraper-fase-04" -b "melhoria/fase-04-browser" $BASE_COMMIT
git worktree add "..\linkedin-scraper-fase-05" -b "melhoria/fase-05-scraping" $BASE_COMMIT
git worktree add "..\linkedin-scraper-fase-06" -b "melhoria/fase-06-api-jobs" $BASE_COMMIT
git worktree add "..\linkedin-scraper-fase-07" -b "melhoria/fase-07-qualidade" $BASE_COMMIT
git worktree add "..\linkedin-scraper-integracao" -b "integracao/melhorias" $BASE_COMMIT
```

Cada agente deve receber somente o caminho de sua worktree, o arquivo de sua fase e o valor de `BASE_COMMIT`.

## Contrato de entrega por fase

Cada branch deve informar no encerramento:

- Hashes dos commits produzidos.
- Arquivos criados, alterados e removidos.
- Testes executados e seus resultados.
- Testes nao executados e o motivo.
- Mudancas de contrato publico.
- Pontos que exigem adaptacao na integracao.

Uma fase nao esta pronta se depende de arquivos nao commitados, de outra branch ou de credenciais reais para executar seus testes obrigatorios.

## Arquivos com conflito previsto

| Arquivo | Fases provaveis | Regra para integracao |
| --- | --- | --- |
| `package.json` | 02, 07 | Preservar dependencias da 02 e scripts/ferramentas da 07 |
| `package-lock.json` | 02, 07 | Regenerar uma unica vez com `npm install` na integracao |
| `scraper.js` | 01, 02, 03, 04 | Manter propagacao de erros, repositorio SQLite, fila e ownership correto do browser |
| `api.js` | 03, 04, 07 | Usar app factory da 07, rotas da 03 e shutdown da 04 |
| `jobController.js` | 01, 02, 03, 06 | Compor validacao, enfileiramento e consultas paginadas |
| `config.js` | 01, 04 | Manter validacao tardia e opcoes do navegador |
| `.gitignore` | 01, 02, 05, 07 | Unir todos os artefatos ignorados |

## Worktree de integracao

A worktree `integracao/melhorias` nao desenvolve uma fase. Ela recebe apenas branches ja aprovadas e resolve a composicao entre elas.

Ordem sugerida de incorporacao, que nao representa dependencia de desenvolvimento:

1. Fase 07, para estabelecer testes e app factory.
2. Fase 01, para corrigir contratos basicos.
3. Fase 04, para corrigir o ciclo de vida do browser.
4. Fase 05, para fortalecer o scraping.
5. Fase 02, para trocar JSON por SQLite.
6. Fase 03, para adicionar fila e status.
7. Fase 06, para finalizar a consulta paginada sobre o repositorio integrado.

Na integracao, usar `git merge --no-ff <branch>` para preservar a origem dos trabalhos. Nao usar `git reset --hard`, `git checkout -- <arquivo>` ou resolucao que descarte silenciosamente uma das implementacoes.

## Validacao integrada

Depois de todas as incorporacoes:

```powershell
npm ci
npm test
npm run lint
npm run format:check
```

Tambem devem ser verificados o start da API sem credenciais, as migracoes em banco temporario, a fila com concorrencia 1, o encerramento gracioso e o fluxo Puppeteer contra paginas locais. A validacao ao vivo no LinkedIn permanece manual e opcional por exigir credenciais, rede e possivel intervencao em CAPTCHA ou 2FA.

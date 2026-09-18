# Fase 07: Qualidade e Documentacao

## Missao

Estabelecer testes, lint, formatacao, app factory e documentacao correta sem depender das funcionalidades das outras fases.

**Depende de:** nenhuma outra fase.

## Resultado isolado

Aplicada ao `BASE_COMMIT`, esta fase torna a API importavel em testes, adiciona comandos de qualidade e corrige a documentacao para refletir o comportamento existente no baseline.

## Escopo

- Declarar Node.js `>=20.18.1`.
- Configurar `node:test` como runner oficial.
- Configurar ESLint para CommonJS e Node.
- Configurar Prettier e verificacao sem escrita.
- Extrair `createApp()` para que importar a aplicacao nao abra porta.
- Manter `api.js` como entrypoint de inicializacao.
- Adicionar testes de smoke para app e rotas existentes.
- Criar `.env.example` sem segredos.
- Corrigir rotas, caminhos, comandos e limitacoes no README.
- Atualizar `.gitignore` para artefatos conhecidos.
- Remover `cheerio` se continuar sem uso.

## Fora do escopo

- Implementar SQLite, fila, paginacao ou novos seletores.
- Alterar o contrato funcional das rotas existentes.
- Realizar scraping ao vivo.
- Introduzir framework de testes adicional.

## Arquivos esperados

- `package.json`
- `package-lock.json`
- `eslint.config.js`
- `.prettierrc.json`
- `.prettierignore`
- `.env.example`
- `.gitignore`
- `src/app.js`
- `api.js`
- `README.md`
- `test/app.test.js`

## Scripts esperados

```json
{
  "test": "node --test",
  "lint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

## Contratos

- `createApp(dependencies)` retorna a aplicacao sem chamar `listen()`.
- `api.js` continua iniciando o servidor quando executado diretamente.
- Testes nao dependem de `.env`, browser ou rede externa.
- README nao afirma que seletores ao vivo foram validados.
- `.env.example` contem apenas nomes e valores ficticios.

## Implementacao

1. Separar composicao da aplicacao e inicializacao do processo.
2. Configurar scripts e dependencias de desenvolvimento.
3. Adicionar smoke tests com servidor em porta efemera.
4. Aplicar lint e formatacao somente nos arquivos pertencentes a esta fase.
5. Corrigir README, incluindo `POST /api/scrape` e Node suportado.
6. Documentar explicitamente requisitos de um teste ao vivo.

## Testes obrigatorios

```powershell
npm test
npm run lint
npm run format:check
node --check api.js
node --check src/app.js
```

## Criterios de aceite

- `require('./src/app')` nao abre porta e nao encerra o processo.
- `npm test` nao possui placeholder de falha intencional.
- Lint e format check passam no escopo da branch.
- README usa somente rotas e caminhos reais do baseline.
- Nenhum segredo ou dado coletado e versionado.
- Os testes passam apenas com esta branch aplicada ao `BASE_COMMIT`.

## Nota de integracao

As outras fases adicionarao arquivos e dependencias depois desta branch. Na worktree de integracao, regenerar o lockfile, executar formatacao uma vez e ampliar os testes sem enfraquecer as regras aqui definidas.

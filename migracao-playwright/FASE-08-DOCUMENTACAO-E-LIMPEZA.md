# Fase 08: Documentacao e Limpeza

## Missao

Remover vestigios do Puppeteer, consolidar a documentacao e validar a migracao completa em instalacao limpa.

**Depende de:** Fase 07 aprovada.

## Resultado

O repositorio declara e usa somente Playwright para automacao do browser, com procedimento de instalacao e validacao reproduzivel.

## Escopo

- Remover referencias a Puppeteer do codigo, JSDoc, README e lockfile.
- Confirmar ausencia de `puppeteer-core` e `@puppeteer/browsers` transitivos inesperados.
- Documentar `npx playwright install chromium`.
- Documentar browser headed, `HEADLESS` e `SCRAPE_LIMIT`.
- Atualizar `.env.example` sem segredos.
- Atualizar limites e requisitos de validacao ao vivo.
- Revisar `.prettierignore` para que arquivos relevantes sejam verificados.
- Executar instalacao e validacao final em ambiente limpo.

## Fora do escopo

- Adicionar novos endpoints.
- Alterar banco ou fila.
- Validar permanentemente o DOM real do LinkedIn.
- Automatizar CAPTCHA ou 2FA.
- Adicionar CI remoto, salvo solicitacao separada.

## Arquivos esperados

- `README.md`
- `.env.example`
- `.prettierignore`
- `AGENTS.md`
- `package.json`
- `package-lock.json`
- JSDoc dos arquivos migrados.

## Contratos

- Instalacao parte de `npm ci` e instalacao explicita do Chromium.
- Nenhum segredo ou artefato local e versionado.
- Testes locais nao exigem LinkedIn.
- Validacao ao vivo e manual e opcional.
- Rotas, respostas HTTP e formatos SQLite permanecem inalterados.

## Implementacao

1. Buscar por `puppeteer`, `Puppeteer`, `Target` e APIs removidas.
2. Regenerar lockfile somente se houver dependencia antiga residual.
3. Corrigir README e guia do repositorio com comandos reais.
4. Adicionar `HEADLESS=false` e `SCRAPE_LIMIT=5` ao exemplo de ambiente.
5. Garantir que Prettier cubra codigo e testes da migracao.
6. Fazer instalacao limpa e executar toda a validacao integrada.

## Testes obrigatorios

```powershell
npm ci
npx playwright install chromium
npm test
npm run lint
npm run format:check
node --check api.js
node --check scraper.js
node --check src/core/browser.js
node --check src/scraper/linkedin.js
```

Tambem executar uma busca no repositorio por referencias antigas e revisar manualmente qualquer ocorrencia documental historica.

## Criterios de aceite

- `package.json` nao contem Puppeteer.
- Lockfile nao contem pacotes Puppeteer, salvo dependencia transitiva justificada e documentada.
- Codigo de producao nao usa APIs `Target` ou opcoes exclusivas do Puppeteer.
- Todos os testes, lint e format check passam em instalacao limpa.
- Chromium local executa smoke tests sem rede externa.
- README descreve corretamente o comportamento final.

## Encerramento

Depois da aprovacao, mesclar `integracao/playwright` no branch principal com `--no-ff`. Remover worktrees e branches temporarias somente apos confirmar que o branch principal esta limpo e passou pela mesma validacao.

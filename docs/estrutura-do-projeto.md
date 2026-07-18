# Estrutura do projeto

## Estrutura que vale para código novo

```text
app/          páginas, layouts, componentes locais e rotas HTTP
lib/          regras, permissões, servidor, integrações e código compartilhado
data/         seeds, mocks, fixtures e dados locais de desenvolvimento
prisma/       schema e migrações
public/       arquivos públicos
tests/        testes Jest
tests-e2e/    testes Playwright
tools/functions/  funções de UI, API, banco de dados e infraestrutura
docs/         documentação
```

Não serão criadas pastas vazias como `lib/modules`, `lib/server` ou `lib/integrations`. Elas só devem existir quando uma responsabilidade real justificar a separação.

## Auditoria das pastas da raiz

| Item | Classificação | Decisão |
| --- | --- | --- |
| `.git/` | infraestrutura local | manter |
| `.github/` | automação oficial | manter |
| `.next/` | build/cache | ignorado; pode ser apagado e recriado |
| `.pytest_cache/` | cache | ignorado; pode ser apagado |
| `.scannerwork/` | relatório/cache do Sonar | ignorado; pode ser apagado |
| `.tmp/` | temporário legado | ignorado; há um PID antigo rastreado que deve ser retirado em revisão separada |
| `.vscode/` | configuração de editor | ignorado para novos arquivos; `launch.json` e `tasks.json` já rastreados ficam para decisão da equipe |
| `__tests__/` | testes Jest legados | migrar aos poucos para `tests/` |
| `app/` | código oficial | manter; é a raiz do App Router |
| `coverage/` | relatório gerado | ignorado; pode ser apagado |
| `data/` | área mista/legada | manter por compatibilidade; direcionar código executável para `lib/` gradualmente |
| `docs/` | documentação oficial | manter |
| `lib/` | código oficial compartilhado | manter |
| `node_modules/` | dependências geradas | ignorado; pode ser recriado |
| `packages/` | contratos compartilhados | manter |
| `playwright-report/` | relatório gerado | ignorado; pode ser apagado |
| `prisma/` | banco oficial | manter |
| `public/` | estáticos oficiais | manter |
| `tools/functions/` | automações e funções oficiais organizadas por área | manter |
| `specs/` | planos de teste em Markdown | manter por enquanto; avaliar futura união com `docs/` |
| `src/` | área pequena já existente | manter sem expandir; contém design system e menu lateral |
| `test-results/` | resultado gerado | ignorado; pode ser apagado |
| `tests/` | testes Jest oficiais | manter |
| `tests-e2e/` | testes Playwright oficiais | manter |
| `tmp/` | código e amostras legadas | ignorado para novos temporários; conteúdo rastreado exige triagem antes de mover ou excluir |
| `types/` | declarações TypeScript globais | manter |

## Auditoria dos arquivos da raiz

| Grupo | Itens | Decisão |
| --- | --- | --- |
| Configuração oficial | `.env.example`, `.gitattributes`, `.gitignore`, `.hintrc`, `.npmrc`, `Dockerfile`, `eslint.config.mjs`, `jest.config.ts`, `next.config.ts`, `package.json`, `package-lock.json`, `playwright*.ts`, `postcss.config.mjs`, `prisma.config.ts`, `proxy.ts`, `render.yaml`, `seccomp_profile.json`, `sonar-project.properties`, `tailwind.config.ts`, `tsconfig.json` | manter |
| Documentação atual | `README*.md`, `ARCHITECTURE.md`, `INSTALL*.md`, `QUICK_START*.md` | manter; consolidar somente quando o conteúdo for revisado |
| Diagnóstico legado | `tools/functions/banco-de-dados/diagnosticos/test-pg.js`, `test-pg2.js` | manter isolado em diagnósticos de banco |
| Inventário legado | `estrutura-repo.txt` | candidato a remoção; a documentação em `docs/` passa a ser a referência |
| Ambiente local | `.env`, `.env.local` | ignorados; nunca versionar segredos |
| Gerados/temporários | `.dev.pid`, `.tmp-*`, `__localstore_snapshot.tmp`, `next-env.d.ts`, `tsconfig.tsbuildinfo`, `*.log` | ignorados; podem ser recriados ou apagados |

## Por que existe src

`src/` possui poucos arquivos rastreados, concentrados em:

- `src/design-system/`;
- `src/features/menu-lateral/`.

Isso não torna `src/` a raiz oficial do projeto. `app/` e `lib/` concentram quase todo o sistema e não serão movidos. Novas features devem seguir a estrutura simples já usada; os arquivos atuais de `src/` serão tratados apenas quando houver trabalho funcional nessas áreas.

## Pendências sem remoção automática

1. Verificar se `_test_pg.js` e `_test_pg2.js` ainda são usados.
2. Triar o conteúdo rastreado de `tmp/` e `.tmp/`.
3. Migrar stores e regras de `data/` para `lib/` por módulo.
4. Unificar os testes Jest conforme `docs/plano-unificacao-testes.md`.
5. Avaliar se os planos em `specs/` devem virar `docs/specs/`.

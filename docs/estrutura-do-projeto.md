# Estrutura do projeto

> Reescrito na branch `refactor/estrutura-de-pastas` (2026-07-18) para
> refletir a reorganização física concluída nessa branch. A versão anterior
> deste documento descrevia um plano (manter `lib/`, `data/`, `prisma/`,
> `packages/`, `types/`, dividir testes em `tests/`+`tests-e2e/`) que foi
> **substituído** pela reorganização abaixo, não seguido à risca — não
> confie em cópias antigas deste arquivo.

## Estrutura atual

```text
app/            páginas, layouts e rotas HTTP (App Router do Next.js — o nome
                da pasta é a URL, por isso não foi renomeado)
backend/        regras de negócio, permissões, autenticação, integrações
                (era lib/; lib/core/{auth,session,permissions,company,project}
                foi fundido de volta às pastas correspondentes, sem duplicar)
database/       tudo que é "banco de dados": repositories/ (era data/ +
                app/data/, fundidos), prisma/ (schema + migrations, era
                prisma/ na raiz) e o cimento do Prisma (prismaClient.ts,
                databaseUrl.ts, persistenceMode.ts etc., que eram soltos em
                lib/)
shared/         código compartilhado entre front e back: contracts/ (era
                packages/contracts) e types/ (era types/ na raiz + app/types/)
src/            design system (src/design-system/) e menu lateral
                (src/features/menu-lateral/) — área pequena, não expandir
tests/          toda a suíte de testes: Jest (**/*.test.ts(x)) e Playwright
                (**/*.spec.ts) no mesmo lugar, distinguidos só pela extensão
                (era testes/ na raiz)
tools/          scripts e ferramentas de desenvolvimento/infraestrutura (era
                support/ — cuidado: "support" também é uma feature de
                negócio dentro de app/, não confundir os dois)
docs/           documentação, incluindo docs/specs/ (planos de teste em
                Markdown, era specs/ na raiz)
public/         arquivos estáticos públicos
```

Os aliases correspondentes (`tsconfig.json` `compilerOptions.paths` e
`jest.config.ts` `moduleNameMapper`, que precisam ser mantidos em sincronia
manualmente — são dois sistemas independentes):

| Alias | Aponta para |
| --- | --- |
| `@/backend/*` | `./backend/*` |
| `@/database/*` | `./database/*` |
| `@/data/*` | `./database/repositories/*` |
| `@/shared/*` | `./shared/*` |
| `@/contracts/*` | `./shared/contracts/src/*` |
| `@/types/*` | `./shared/types/*` |
| `@/features/*` | `./src/features/*` |
| `@/design-system/*` | `./src/design-system/*` |
| `@/*` (padrão) | `./app/*` |

Pastas que **não existem mais** na raiz (conteúdo movido, não há mais nada
lá): `lib/`, `data/`, `prisma/`, `packages/`, `types/`, `specs/`, `testes/`,
`support/`, `tests-e2e/`, `__tests__/`.

## Por que essa reorganização

Pedido original: as pastas devem dizer sozinhas o que são — API, backend,
banco de dados, front — com o mesmo nome de conceito repetido em
backend/API/banco de dados, para facilitar manutenção. Antes da
reorganização, `lib/` tinha 348 arquivos (127 soltos direto nela, sem
subpasta), havia duas tentativas paralelas e incompletas de organização
(`lib/` vs `lib/core/`, `data/` vs `app/data/`), e `src/backend`/`src/shared`
já existiam como alias configurados mas vazios — sinal de que essa mesma
reorganização já tinha começado a ser planejada antes.

## O que ficou fora desta reorganização (decisão de produto, não de pasta)

`app/` tem uma quantidade grande de nomes duplicados em inglês/português
(user/users/usuarios, company/companies/empresas, support/suportes/
chamados/tickets, releases em 4 variantes, docs/documentacao/documentos,
kanban, assistant/assistente, admin/permissions/permissoes, casos-de-teste/
test-cases). Investigação completa de cada um, incluindo 3 vazamentos de
segredo corrigidos e um arquivo morto removido, está em
[`docs/architecture/duplicacoes-app-encontradas.md`](architecture/duplicacoes-app-encontradas.md).
Não foram unificados nesta branch porque a maioria exige decidir qual API/
página vira a oficial (permissão, auditoria, efeitos colaterais divergentes
entre as variantes) — risco de produto, não simples renomeação.

## src/ continua pequeno de propósito

`src/design-system/` e `src/features/menu-lateral/` são as únicas áreas
ativas em `src/`. Novas features seguem a estrutura acima (`app/`,
`backend/`, `database/`, `shared/`); `src/` não é a raiz do projeto e não
deve crescer além dessas duas áreas sem necessidade concreta.

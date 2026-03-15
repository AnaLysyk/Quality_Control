# origin/e2e/stabilize-tests

- base: `origin/main`
- head: `8ea3a9e`
- unique commits: 35
- compare: https://github.com/AnaLysyk/Quality_Control/compare/main...e2e/stabilize-tests

## Hotspots

- app/api: 113 arquivos
- app/components: 45 arquivos
- src: 26 arquivos
- data/versions: 24 arquivos
- scripts: 24 arquivos
- app/admin: 20 arquivos
- data/company-documents-files: 18 arquivos
- ai_applying: 9 arquivos
- app/empresas: 9 arquivos
- lib/rbac: 8 arquivos

## Top Files

- app/admin/users/permissions/page.tsx (2185 linhas alteradas)
- app/settings/profile/page.tsx (1445 linhas alteradas)
- app/admin/home/page.tsx (1407 linhas alteradas)
- app/globals.css (1290 linhas alteradas)
- package-lock.json (1159 linhas alteradas)
- app/admin/users/page.tsx (951 linhas alteradas)
- app/admin/access-requests/page.tsx (824 linhas alteradas)
- app/admin/access-requests/AccessRequestsClient.tsx (730 linhas alteradas)
- data/company-documents-history.json (532 linhas alteradas)
- data/audit-logs.json (479 linhas alteradas)
- data/company-documents-store.json (461 linhas alteradas)
- app/components/ProfileButton.tsx (446 linhas alteradas)
- lib/reporting/releaseExport.ts (444 linhas alteradas)
- app/clients/components/CreateClientModal.tsx (393 linhas alteradas)
- data/access-requests.json (356 linhas alteradas)

## Commits

- `8ea3a9e` 2026-02-16 Ana: fix: css hygiene, unify .logoEnergyPremium, clean media queries
- `c18e924` 2026-02-16 Ana: fix: css syntax error, authLog privacy, rate limit, RBAC helpers
- `17d4c40` 2026-02-16 Ana: fix(api): usa apenas docsUrl (remove docsLink) na criação de company
- `a1aaf20` 2026-02-16 Ana: fix(login): usa src string '/logo.svg' no next/image para compatibilidade build
- `1cad4f1` 2026-02-16 Ana: fix(login): corrige import do logo.svg para caminho público Next.js
- `9b1a76c` 2026-02-16 Ana: chore: adiciona logo.svg placeholder para corrigir build
- `348d979` 2026-02-16 Ana: fix: ordem dos prefixos CSS e adiciona config Codex
- `f6201d0` 2026-02-14 Ana: feat(login): restore animated blue background with bubbles
- `e6f7279` 2026-02-14 Ana: chore: fix AuthUser export and resolve build errors
- `a15d88f` 2026-02-14 Ana: chore: force rebuild - remove prisma type import (Vercel fix)
- `f065e62` 2026-02-14 Ana: chore(deps): update deprecated and vulnerable packages (whatwg-encoding, inflight, glob)
- `0d15152` 2026-02-14 Ana: fix: avoid PrismaClient type import error in no-prisma environments (Vercel build fix)
- `d6f799a` 2026-02-14 Ana: fix(e2e): robustly remove sidebar overlays to stabilize pointer events in Playwright tests; all previously failing E2E tests now pass
- `0ccbed4` 2026-02-14 Ana: fix: garantir alinhamento de tipagem e schema (camelCase) em clients API e dependências
- `32dce15` 2026-02-14 Ana: fix: normalize all client API input property names to camelCase (companyName, taxId, logoUrl, docsLink, docsUrl, addressDetail, etc.) for type safety and build stability
- `cb69c13` 2026-02-14 Ana: fix: tipagem Capability[] em RequireCapability.tsx
- `c1e740f` 2026-02-14 Ana: fix: corrigir importação de hasCapability para client-safe
- `a5261ec` 2026-02-14 Ana: fix: mover 'use client' e remover imports inexistentes
- `f325688` 2026-02-14 Ana: ajuste tipagem e doc access-requests.spec.ts
- `3b633d0` 2026-02-14 Ana: ajustes e2e, helpers, robustez e padronização
- `da51602` 2026-02-14 Ana: Highlight admin alerts
- `7d773a7` 2026-02-13 Ana: Allow nullable logo resolver inputs
- `bca4840` 2026-02-13 Ana: Improve admin client logos
- `a2a5d72` 2026-02-13 Ana: Sync data fixtures
- `2a66234` 2026-02-13 Ana: Limit prod smoke to main pushes
- `b3896f4` 2026-02-13 Ana: Adjust company access for dev roles
- `0c67329` 2026-02-13 Ana: Update files
- `df85343` 2026-02-13 Ana: ajuste
- `f0c583e` 2026-02-13 Ana: ajusta playwright secrets guard
- `8afebdf` 2026-02-13 Ana: ajustes
- `c5d6bd6` 2026-02-13 Ana: chore(e2e): log company select and accept button disabled state for debugging
- `18f38f7` 2026-02-13 Ana: chore(e2e): always write accept debug log (prisma + JSON)
- `d4b406e` 2026-02-13 Ana: chore(e2e): write debug log on access-request accept to data/access-requests-debug.log
- `516359e` 2026-02-13 Ana: chore(e2e): add Playwright CI workflow; instrument access-requests logs; traduzir documentos page para pt-BR
- `427d5d1` 2026-02-13 Ana: test(e2e): increase timeout for access-requests accept/reject assertions


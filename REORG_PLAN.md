REORGANIZATION PLAN — painel-qa

Objetivo
- Reduzir duplicação de pastas, consolidar componentes e dar uma estrutura previsível para facilitar manutenção.

Resumo das ações propostas (mudanças que requiriam atualização de imports):

1) Consolidar componentes
- Mover `components/*` (raiz) para `app/components/`.
- Depois de mover, atualizar imports que usam `../components/...` para `app/components/...` ou usar caminhos relativos a partir dos arquivos.
- Alternativa: manter `components/` como `app/components/` e criar `tsconfig.paths` para `@components/*` (recomendado em alteração maior).

2) Corrigir pastas de dashboard duplicadas
- Há `dashboard/`, `daskboard/`, `deskboard/` — revisar e consolidar todo conteúdo para `dashboard/`.
- Remover pastas vazias/duplicadas e corrigir imports.

3) Tests / Jest
- Escolher entre `jest.config.js` e `jest.config.ts`. Recomendo manter `jest.config.js` e remover `jest.config.ts` (ou o oposto se CI exigir TS). Ajustar scripts se necessário.

4) Data e utilitários
- Manter `data/` no root (contém `requestsStore.ts` e JSONs). Confirmar que imports usam `data/` path relativos.
- Manter `lib/` para clientes/SDKs (ex.: `lib/qaseSdk.ts`, `lib/supabaseServer.ts`).

5) Backend
- Deixar `backend/` intacto; não mover arquivos entre frontend/backend.

6) Pequenas limpezas
- Remover arquivos/repositórios duplicados ou sem uso após validação (ex.: arquivos de README obsoletos).

Validação pós-mudança
- Executar `npm run lint` e `npm run test`.
- Executar `npm run test:e2e` se houver alterações em rotas/fluxos E2E.

Notas sobre execução automática
- Posso aplicar as mudanças automaticamente: criar/editar arquivos, atualizar imports via regex/codemods e rodar lint/tests.
- Recomendo executar em um branch separado e rodar a suíte de testes completa.

Confirme se devo aplicar essas mudanças agora. Se aprovar, informarei os passos exatos e começarei aplicando: (1) mover `components/` → `app/components/`, (2) consolidar `dashboard/*`, (3) remover/renomear arquivos redundantes, (4) rodar `npm run lint` e `npm test` e reportar erros a ajustar.

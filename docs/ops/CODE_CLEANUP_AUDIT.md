# CODE_CLEANUP_AUDIT — Painel QA

## Objetivo

Este documento controla a limpeza do código para evitar apagar arquivos úteis, duplicar funcionalidades ou quebrar fluxo existente.

Nenhum arquivo deve ser removido sem passar por este inventário.

---

## Regra principal

Antes de apagar, mover ou refatorar qualquer arquivo:

1. Verificar se é importado.
2. Verificar se é usado por rota, tela, script ou teste.
3. Verificar se afeta autenticação/permissão.
4. Verificar se afeta fluxo manual.
5. Verificar se afeta Brian.
6. Rodar validação mínima depois.

Se não houver certeza, marcar como `analisar mais`.

Nenhum arquivo deve ser apagado, movido ou arquivado sem:

- caminho
- motivo
- evidência de uso ou não uso
- risco
- ação recomendada
- comando de validação

---

## Prioridade de limpeza

### Fase 0 — Segurança

- [x] Verificar `demo/.env`
- [ ] Revogar qualquer chave exposta
- [x] Remover ou ignorar `demo/`
- [x] Atualizar `.gitignore`

Resultado inicial:

- `demo/` não existe no workspace atual (`Test-Path demo = False`).
- `demo/` já está no `.gitignore`.
- `docs/ops/REORG_PLAN.md` registra risco histórico de chave em `demo/.env`; revogação não pode ser confirmada localmente.

### Fase 1 — Inventário estrutural

- [x] Verificar uso de `src/`
- [x] Verificar uso de `src/design-system`
- [x] Verificar `components/` top-level
- [x] Verificar `hooks/` top-level
- [ ] Verificar duplicidade entre `data/` e `app/data/`
- [x] Verificar `data/backups/`
- [x] Verificar `data/versions/`
- [x] Verificar `demo/`
- [x] Verificar `debug/`
- [x] Verificar scripts diagnósticos
- [x] Verificar markdowns temporários da raiz

Resultado inicial:

- `src/` contém apenas `src/design-system`.
- `src/design-system` está em uso ativo via alias `@/design-system/*`.
- O alias existe em `tsconfig.json` e `jest.config.ts`.
- `app/components/theme/TcPrimitives.tsx` reexporta primitivas de `@/design-system/components/primitives`.
- `TcPrimitives` é usado por telas/componentes como `app/components/KanbanClient.tsx`, `app/components/DefectList.tsx` e `app/components/ReleaseManualList.tsx`.
- `components/` top-level não existe no workspace atual.
- `hooks/` top-level não existe no workspace atual; `app/hooks/` está ativo e recebe imports via alias `@/hooks/*`.
- `data/backups/` e `data/versions/` não existem no workspace atual e já estão no `.gitignore`.
- `debug/` não existe no workspace atual e já está no `.gitignore`; há logs/artefatos de runtime ignorados na raiz.
- O `REORG_PLAN.md` contém itens históricos que já parecem resolvidos no workspace atual.

Decisão inicial:

- Não remover `src/` agora.
- Não alterar o alias `@/design-system/*` agora.
- Se houver consolidação futura, migrar o design system de forma explícita antes de remover `src/`.
- Não tentar remover `components/`, `hooks/`, `demo/`, `debug/`, `data/backups/` ou `data/versions/` agora porque essas pastas não existem no workspace atual.
- Tratar scripts diagnósticos e markdowns de raiz como inventário/backlog, não remoção imediata.

### Fase 2 — Fluxo manual

Endpoints encontrados:

- `app/api/test-plans/route.ts`
- `app/api/test-plans/cases/route.ts`
- `app/api/test-plans/[id]/test-cases/route.ts`

Decisão inicial:

- `app/api/test-plans/route.ts` será o endpoint principal para CRUD de planos.
- `app/api/test-plans/[id]/test-cases/route.ts` será o endpoint principal para vínculo/desvínculo de casos.
- `app/api/test-plans/cases/route.ts` será analisado antes de manter ou remover.

Nada será removido agora.

### Fase 3 — Arquivos candidatos a remoção

Inventário inicial. Nada abaixo autoriza remoção imediata.

| Arquivo/Pasta | O que parece ser | Usado? | Evidência | Risco de remover | Ação recomendada | Comando de validação | Status |
|---|---|---|---|---|---|---|---|
| `src/` | contém design system ativo | sim | `TcPrimitives` importa `@/design-system/components/primitives` | alto | manter | `npm run build` | ativo |
| `src/design-system` | tokens e primitivas visuais | sim | alias em `tsconfig.json` e `jest.config.ts` | alto | manter | `npm run build` | ativo |
| `components/` top-level | duplicidade citada no plano antigo | não existe | `Test-Path components = False` | nenhum agora | manter sem ação | `git status` | resolvido no workspace |
| `hooks/` top-level | duplicidade citada no plano antigo | não existe | `Test-Path hooks = False`; `app/hooks/` existe e é usado por `@/hooks/*` | nenhum agora | manter sem ação | `npm run build` se alias mudar no futuro | resolvido no workspace |
| `data/backups/` | backups locais citados no plano antigo | não existe | `Test-Path data/backups = False`; `.gitignore` contém `data/backups/` | nenhum agora | manter ignorado | `git status --ignored data/backups` se reaparecer | resolvido no workspace |
| `data/versions/` | versões locais citadas no plano antigo | não existe | `Test-Path data/versions = False`; `.gitignore` contém `data/versions/` | nenhum agora | manter ignorado | `git status --ignored data/versions` se reaparecer | resolvido no workspace |
| `demo/` | possível demo local e risco histórico de `.env` | não existe | `Test-Path demo = False`; `.gitignore` contém `demo/`; `REORG_PLAN.md` registra risco histórico | segurança histórica | confirmar revogação fora do repo; manter ignorado | `git status --ignored demo` se reaparecer | resolvido localmente |
| `debug/` | artefatos temporários citados no plano antigo | não existe | `Test-Path debug = False`; `.gitignore` contém `debug/`; `scripts/diagnose-browser-login.mjs` escreve em `debug/diagnose-browser-login` | baixo no workspace atual | manter ignorado; não criar em commit | `git status --ignored debug` se reaparecer | resolvido no workspace |
| scripts diagnósticos | scripts one-shot ou manutenção antiga | sim | existem `check-thiago.mjs`, `dump-bytes.js`, `check-mobile-menu-browser-login.mjs`, `debug-login-dom.mjs`, `inspect-login-headers.mjs`, `diagnose-browser-login.mjs`; `package.json` só referencia `clean:logs` | baixo/médio | analisar mais antes de remover | `rg -n "check-thiago|dump-bytes|check-mobile-menu-browser-login|debug-login-dom|inspect-login-headers|diagnose-browser-login" package.json app lib tests tests-e2e` | pendente |
| markdowns temporários da raiz | documentação raiz | sim | raiz tem `ARCHITECTURE.md`, `INSTALLATION_GUIDE.md`, `INSTALL_BRAIN.md`, `QUICK_START.md`, `QUICK_START_BRAIN.md`, `README.md`, `README.tech.md`, `README_FASE1.md`; todos aparecem em `git ls-files *.md` | médio | manter por ora; classificar depois | `git ls-files *.md` | pendente |
| logs e artefatos runtime na raiz | arquivos locais ignorados | sim, mas ignorados | `build-output.log`, `debug.log`, `dev*.log`, `e2e-run.log`, `*.tmp`, `_test_pg*.js`; `.gitignore` cobre logs/tmp | baixo para commit | não adicionar; limpar só se solicitado | `git status --ignored --short` | local ignorado |

### Fase 4 — Endpoints de planos e casos

Nada será removido agora.

| Endpoint | O que parece ser | Usado? | Evidência | Risco de remover | Ação recomendada | Comando de validação | Status |
|---|---|---|---|---|---|---|---|
| `app/api/test-plans/route.ts` | CRUD principal de planos | sim | usado por `app/empresas/[slug]/planos-de-teste/page.tsx`, `ManualReleaseActions`, `CreateManualReleaseButton` e `PlaywrightStudio` | alto | manter como canônico para planos | `npm run build` | ativo |
| `app/api/test-plans/[id]/test-cases/route.ts` | vínculo/desvínculo de casos em plano | sim | usado por `app/empresas/[slug]/planos-de-teste/page.tsx` e `app/automacoes/playwright/PlaywrightStudio.tsx` | alto | manter como canônico para vínculos | `npm run build` | ativo |
| `app/api/test-plans/cases/route.ts` | busca/listagem de casos de plano com lógica manual/Qase | sim | usado por `app/empresas/[slug]/planos-de-teste/page.tsx` em fetch para `/api/test-plans/cases` | médio/alto | manter por ora; analisar antes de deprecar | `rg -n "test-plans/cases|/api/test-plans/cases" app tests tests-e2e` | ativo com ressalvas |

### Próximo menor patch seguro

1. Não alterar código ainda.
2. Revisar scripts diagnósticos candidatos no `REORG_PLAN.md`.
3. Classificar markdowns de raiz entre documentação canônica, documentação movível e documentação obsoleta.
4. Só depois propor um patch de limpeza documental ou de scripts, com validação mínima por `git status` e busca de referências.

---

## Segunda rodada de análise — agentes

Data da rodada: 2026-05-19.

Escopo permitido: inventário em `docs/ops/CODE_CLEANUP_AUDIT.md`.

Resumo dos agentes:

- Product Flow Guardian: aprovado com ressalvas; nada abaixo deve virar tela, rota ou módulo novo sem encaixar no fluxo oficial.
- Code Cleanup Guardian: aprovado com ressalvas; há candidatos claros de limpeza, mas sem remoção nesta rodada.
- RBAC Guardian: bloqueado para rotas de plano/caso e defeito que não evidenciam autenticação/permissão.
- Manual QA Flow Guardian: aprovado com ressalvas; não consolidar endpoints antes de mapear plano, caso, execução e resultado.
- Brian Guardian: aprovado com ressalvas; rotas que emitem eventos ou expõem contexto devem preservar `companyId`, `refType` e permissão.
- UI Screen Guardian: não aplicável nesta rodada.
- Build Safety Guardian: aprovado somente para documentação; validação mínima é `git status --short`.

### Scripts diagnósticos

Nada será removido agora.

| Caminho | O que parece ser | Usado? | Evidência | Risco de remover | Ação recomendada | Comando de validação | Status |
|---|---|---|---|---|---|---|---|
| `scripts/check-thiago.mjs` | diagnóstico direto em banco de produção | não referenciado por script npm | `rg` só encontrou o próprio arquivo e `REORG_PLAN.md`; continha credencial de banco hardcoded, removida do código em patch de segurança | crítico por segurança; médio para remoção sem confirmar histórico | não executar; rotacionar/revogar credencial fora do repo; usar somente `CHECK_THIAGO_DATABASE_URL` se o diagnóstico ainda for necessário | `rg -n "postgresql://|token|secret|password|key" scripts/check-thiago.mjs` | segredo removido do código; rotação pendente |
| `scripts/dump-bytes.js` | utilitário genérico para inspecionar bytes de arquivo | não referenciado por script npm | `rg` só encontrou o próprio arquivo e `REORG_PLAN.md`; não toca app nem banco | baixo | candidato a manter ou arquivar em utilitário dev; não remover sem decisão | `rg -n "dump-bytes" package.json app lib tests tests-e2e scripts docs/ops/REORG_PLAN.md` | analisar mais |
| `scripts/check-mobile-menu-browser-login.mjs` | diagnóstico Playwright manual de login/menu mobile | não referenciado por script npm | usa Playwright, credenciais demo e portas locais; citado como candidato no `REORG_PLAN.md` | baixo/médio; pode ajudar debug manual, mas contém credenciais demo | arquivar/remover depois de confirmar que testes E2E cobrem o caso | `rg -n "check-mobile-menu-browser-login" package.json app lib tests tests-e2e scripts docs/ops/REORG_PLAN.md` | analisar mais |
| `scripts/debug-login-dom.mjs` | captura HTML de debug do login/admin home | não referenciado por script npm | escreve `debug-admin-home.html`; citado como candidato no `REORG_PLAN.md` | baixo; risco de gerar artefato local | candidato a remover depois de confirmar sem uso | `rg -n "debug-login-dom" package.json app lib tests tests-e2e scripts docs/ops/REORG_PLAN.md` | analisar mais |
| `scripts/inspect-login-headers.mjs` | diagnóstico de headers/cookies de login | não referenciado por script npm | usa fetch local e credencial demo; citado como candidato no `REORG_PLAN.md` | baixo/médio; pode expor headers em log | candidato a remover ou substituir por teste seguro | `rg -n "inspect-login-headers" package.json app lib tests tests-e2e scripts docs/ops/REORG_PLAN.md` | analisar mais |
| `scripts/diagnose-browser-login.mjs` | diagnóstico Playwright com logs de console/rede | não referenciado por script npm | escreve em `debug/diagnose-browser-login`; `debug/` está no `.gitignore`; citado no `REORG_PLAN.md` | baixo/médio; gera artefatos sensíveis de rede | candidato a remover ou documentar como ferramenta local ignorada | `rg -n "diagnose-browser-login" package.json app lib tests tests-e2e scripts docs/ops/REORG_PLAN.md` | analisar mais |

Bloqueio imediato:

- Não executar `scripts/check-thiago.mjs`.
- Não commitar credenciais ou saídas desses diagnósticos.
- Rotacionar qualquer credencial exposta antes de qualquer limpeza que possa mascarar o problema.

### Markdowns temporários da raiz

Nada será movido ou removido agora.

| Caminho | O que parece ser | Usado? | Evidência | Risco de remover | Ação recomendada | Comando de validação | Status |
|---|---|---|---|---|---|---|---|
| `README.md` | documentação principal do projeto | sim | arquivo rastreado por `git ls-files *.md`; título `Quality Control` | alto | manter como canônico | `git ls-files README.md` | ativo |
| `README.tech.md` | guia técnico | sim/provável | arquivo rastreado; descreve setup, arquitetura, testes e deploy | médio | manter por ora; pode ser consolidado depois | `git ls-files README.tech.md` | ativo |
| `ARCHITECTURE.md` | documentação de arquitetura | sim/provável | arquivo rastreado; título `Arquitetura` | médio | manter por ora; comparar depois com `docs/architecture/QA_PLATFORM_CONTRACT.md` | `git ls-files ARCHITECTURE.md` | ativo com ressalvas |
| `INSTALLATION_GUIDE.md` | guia antigo de instalação Brain fase 1 | incerto | arquivo rastreado; conteúdo parece instrução de integração Brain antiga | médio | analisar mais; possível mover para `docs/brian/` ou arquivar depois | `rg -n "INSTALLATION_GUIDE|BRAIN - FASE 1" README.md docs app lib` | analisar mais |
| `INSTALL_BRAIN.md` | guia antigo de instalação Brain | incerto | arquivo rastreado; conteúdo de pré-requisitos Brain | médio | analisar mais; possível mover para `docs/brian/` ou arquivar depois | `rg -n "INSTALL_BRAIN|Brain Foundation" README.md docs app lib` | analisar mais |
| `QUICK_START.md` | quick start antigo Brain/schema | incerto | arquivo rastreado; instrução para integrar schema Brain | médio/alto se estiver obsoleto e induzir schema manual | analisar mais; não usar como guia sem validar com Prisma atual | `rg -n "QUICK_START|schema-brain" README.md docs app lib prisma` | analisar mais |
| `QUICK_START_BRAIN.md` | quick start antigo Brain | incerto | arquivo rastreado; conteúdo parece gerado/antigo e com mojibake | médio | analisar mais; possível arquivar em `docs/brian/legacy` depois | `rg -n "QUICK_START_BRAIN|cérebro funcional" README.md docs app lib` | analisar mais |
| `README_FASE1.md` | resumo antigo Brain fase 1 | incerto | arquivo rastreado; conteúdo com mojibake e promessa de arquivos gerados | médio | analisar mais; possível arquivar depois | `rg -n "README_FASE1|BRAIN FASE 1" README.md docs app lib` | analisar mais |

Conclusão:

- Não existem markdowns temporários novos não rastreados na raiz nesta rodada.
- Os markdowns da raiz são rastreados; alguns parecem canônicos, outros parecem documentação Brain antiga.
- Próximo patch seguro deve classificar documentação Brain antiga, não remover diretamente.

### Rota `app/api/test-plans/cases/route.ts`

Nada será removido agora.

| Caminho | O que parece ser | Usado? | Evidência | Risco de remover | Ação recomendada | Comando de validação | Status |
|---|---|---|---|---|---|---|---|
| `app/api/test-plans/cases/route.ts` | endpoint de detalhe/hidratação de caso em plano, com caminho manual e Qase | sim | chamado por `app/empresas/[slug]/planos-de-teste/page.tsx` ao buscar `/api/test-plans/cases`; lê `companySlug`, `planId`, `caseId`, `source` | alto; quebra detalhe de caso em plano | manter por ora; antes de consolidar, adicionar análise RBAC porque não evidenciou `authenticateRequest` | `rg -n "test-plans/cases|/api/test-plans/cases" app tests tests-e2e` | ativo com bloqueio RBAC |
| `app/api/test-plans/route.ts` | CRUD/listagem de planos manual e Qase | sim | chamado por tela de planos, componentes de release manual e PlaywrightStudio | alto; rota central | manter como canônica para CRUD, mas abrir análise RBAC porque não evidenciou `authenticateRequest` | `rg -n "authenticateRequest|canAccess|permission|companySlug" app/api/test-plans/route.ts` | ativo com bloqueio RBAC |
| `app/api/test-plans/[id]/test-cases/route.ts` | vínculo/desvínculo de casos em plano | sim | contém `authenticateRequest`, `canAccessTestCaseRecord` e `canCreateTestCaseForCompany` | alto; rota mais segura para vínculo | manter como canônica para vínculo | `rg -n "authenticateRequest|canAccessTestCaseRecord|canCreateTestCaseForCompany" app/api/test-plans/[id]/test-cases/route.ts` | ativo |

Decisão provisória:

- Não deprecar `/api/test-plans/cases` ainda.
- Antes de qualquer refatoração, criar inventário RBAC específico para `app/api/test-plans/route.ts` e `app/api/test-plans/cases/route.ts`.
- Não criar endpoint novo para resolver isso.

### Possíveis duplicidades — planos, casos, execuções e defeitos

Nada será consolidado agora.

| Área | Caminhos relacionados | O que parece ser | Evidência | Risco | Ação recomendada | Comando de validação | Status |
|---|---|---|---|---|---|---|---|
| Casos de Teste | `app/api/test-cases/**` e `app/api/v1/cases/**` | duas famílias: repositório local/manual e integração/API v1 Qase | `TestCaseRepositoryClient` usa `/api/test-cases`; rotas `v1/cases` usam Qase e RBAC de runs/company | médio/alto se misturar contratos | manter separadas; documentar fronteira local/manual vs Qase/v1 | `rg -n "/api/test-cases|/api/v1/cases" app tests tests-e2e lib` | ativo com ressalvas |
| Execuções/Runs | `app/api/test-runs/**`, `app/api/v1/runs/**`, `app/api/runs/kanban/route.ts` | execução manual/Prisma e visão integrada/Qase/kanban | `app/api/test-runs/route.ts` emite `test_run.created`; telas de empresa usam `/api/v1/runs` | alto se unificar sem modelar Resultado/Histórico | analisar mais; definir canônico de Execução manual antes de mudar | `rg -n "/api/test-runs|/api/v1/runs|/api/runs/kanban" app tests tests-e2e lib` | analisar mais |
| Defeitos | `app/api/company-defects/**`, `app/api/empresas/[slug]/defeitos/route.ts`, `app/api/admin/defeitos/route.ts`, `app/api/v1/defects/route.ts`, `app/api/defect/route.ts` | múltiplas fontes: manual, company view, admin, Qase/v1 e rota legada | `company-defects` autentica e valida acesso; `empresas/[slug]/defeitos` autentica; `api/defect` recebeu `authenticateRequest` + `assertCompanyAccess` em patch RBAC | médio; ainda existe duplicidade conceitual de rotas de defeitos | manter sem consolidar; próximo passo é mapear rota canônica e testes | `rg -n "authenticateRequest|assertCompanyAccess|companyId" app/api/defect/route.ts` | mitigado com ressalvas |
| Planos de Teste | `app/api/test-plans/route.ts`, `app/api/test-plans/cases/route.ts`, `app/api/test-plans/[id]/test-cases/route.ts` | CRUD, detalhe/hidratação de caso e vínculo/desvínculo | três rotas ativas; só a rota `[id]/test-cases` evidenciou autenticação/permissão | alto | manter; abrir patch específico de RBAC antes de reorganizar | `rg -n "/api/test-plans" app tests tests-e2e lib` | bloqueado por RBAC |

### Próximo menor patch seguro recomendado

1. Não alterar código funcional ainda.
2. Tratar segurança dos scripts: bloquear execução de `scripts/check-thiago.mjs`, rotacionar credencial exposta e só então decidir remoção.
3. Fazer análise RBAC focada em:
   - `app/api/test-plans/route.ts`
   - `app/api/test-plans/cases/route.ts`
   - `app/api/defect/route.ts`
4. Depois disso, escolher um único patch pequeno:
   - ou remover/neutralizar script com segredo,
   - ou adicionar autenticação/permissão na rota legada de defeitos,
   - ou documentar fronteira entre endpoints manuais e Qase.

---

## Terceira rodada — incidente de segurança em script

Data da rodada: 2026-05-19.

Escopo permitido:

- `scripts/check-thiago.mjs`
- `docs/ops/CODE_CLEANUP_AUDIT.md`

Resumo dos agentes:

- Product Flow Guardian: não aplicável; não altera tela nem conceito funcional.
- Code Cleanup Guardian: aprovado; menor patch seguro no arquivo existente.
- RBAC Guardian: aprovado com ressalva; segredo removido do script, mas credencial exposta precisa ser revogada fora do repo.
- Manual QA Flow Guardian: não aplicável.
- Brian Guardian: não aplicável.
- UI Screen Guardian: não aplicável.
- Build Safety Guardian: aprovado com validação estática; o script não foi executado.

Decisão:

- `scripts/check-thiago.mjs` não foi executado.
- O segredo hardcoded foi removido do código.
- O script agora exige `CHECK_THIAGO_DATABASE_URL`.
- Se `CHECK_THIAGO_DATABASE_URL` não existir, o script encerra com mensagem segura e sem expor valor sensível.
- Remover o segredo do arquivo não invalida a credencial já exposta.
- A credencial antiga deve ser revogada/rotacionada imediatamente fora do repositório.

Validação estática:

```bash
rg -n "postgresql://|token|secret|password|key" scripts/check-thiago.mjs
rg -n "CHECK_THIAGO_DATABASE_URL" scripts/check-thiago.mjs
```

Status:

- Código: segredo removido.
- Operação externa: rotação/revogação pendente.
- Próximo bloqueio: RBAC nas rotas `app/api/defect/route.ts`, `app/api/test-plans/route.ts` e `app/api/test-plans/cases/route.ts`.

---

## Quarta rodada — RBAC em rota legada de defeitos

Data da rodada: 2026-05-19.

Escopo permitido:

- `app/api/defect/route.ts`
- `docs/ops/CODE_CLEANUP_AUDIT.md`

Resumo dos agentes:

- Product Flow Guardian: aprovado com ressalvas; a rota continua ligada ao conceito Defeito, sem criar tela ou endpoint novo.
- Code Cleanup Guardian: aprovado; patch local e sem reorganizar estrutura.
- RBAC Guardian: aprovado com ressalvas; `GET` e `POST` agora exigem autenticação e acesso à empresa.
- Manual QA Flow Guardian: aprovado com ressalvas; não altera fluxo manual nem vínculo com release manual.
- Brian Guardian: aprovado com ressalvas; criação continua chamando `brainOnDefectCreated`, agora após checagem de empresa.
- UI Screen Guardian: não aplicável.
- Build Safety Guardian: aprovado mediante validação estática e build.

Análise:

- Métodos exportados: `GET` e `POST`.
- Antes do patch, ambos aceitavam `companyId` vindo de query/body e não evidenciavam autenticação backend.
- Rota protegida comparada: `app/api/company-defects/route.ts` usa `authenticateRequest` e valida acesso à empresa.
- Helper usado no patch: `authenticateRequest`, `hasGlobalCompanyVisibility` e `assertCompanyAccess`.
- `GET` continua filtrando por `companyId` e `releaseManualId`.
- `POST` continua criando defeito para `companyId` e `releaseManualId` informados, mas agora só depois de autenticação e validação de acesso.

Risco residual:

- A rota segue legada e ainda coexiste com `app/api/company-defects/**`, `app/api/empresas/[slug]/defeitos/route.ts` e `app/api/v1/defects/route.ts`.
- Não foi adicionada permissão granular completa de criar/editar defeito porque a rota legada usa `companyId`, enquanto os helpers canônicos de defeitos trabalham melhor com `companySlug`.
- `POST` bloqueia suporte técnico com visibilidade global ampla, a menos que também tenha perfil de líder/global; isso evita operar qualidade em nome da empresa cliente sem autorização explícita.
- A consolidação funcional deve ficar para patch separado, depois de inventário de telas/chamadores.

Validação:

```bash
rg -n "authenticateRequest|requireAuth|getCurrentUser|companyId" app/api/defect/route.ts # OK
rg -n "app/api/defect|/api/defect|api/defect" app tests tests-e2e # OK
npm run build # OK, com warnings Turbopack/NFT existentes
npm test -- --runInBand # OK
```

Status:

- `app/api/defect/route.ts`: bloqueio RBAC mitigado com ressalvas.
- Próximos bloqueios RBAC:
  - `app/api/test-plans/route.ts`
  - `app/api/test-plans/cases/route.ts`

---

## Quinta rodada — revisão do patch RBAC de defeitos

Data da rodada: 2026-05-19.

Escopo permitido:

- `app/api/defect/route.ts`
- `docs/ops/CODE_CLEANUP_AUDIT.md`

Resumo dos agentes:

- Product Flow Guardian: aprovado; segue no conceito Defeito e não cria tela/rota nova.
- Code Cleanup Guardian: aprovado; não havia duplicação de arquivo e o patch permaneceu local.
- RBAC Guardian: aprovado com ressalvas reduzidas; `GET` usa visibilidade global para leitura, `POST` exige líder/global ou acesso explícito à empresa.
- Manual QA Flow Guardian: aprovado; não altera fluxo manual.
- Brian Guardian: aprovado; `brainOnDefectCreated` continua após criação real e agora após RBAC.
- UI Screen Guardian: não aplicável.
- Build Safety Guardian: aprovado; `npm run build` passou com warnings Turbopack/NFT existentes.

Verificação de duplicação:

- `import { NextRequest, NextResponse } from "next/server"` aparece uma vez.
- `export async function POST(req: NextRequest)` aparece uma vez.
- `export async function GET(req: NextRequest)` aparece uma vez.
- `requireDefectCompanyAccess` aparece uma vez como função e duas vezes como chamada esperada.

Ajuste RBAC adicional:

- A primeira versão permitia `hasGlobalCompanyVisibility(user)` para leitura e escrita.
- Como `hasGlobalCompanyVisibility` inclui suporte técnico, isso ficou amplo demais para criação operacional de defeitos.
- O patch agora diferencia `mode: "read" | "write"`.
- `GET` permite perfis com visibilidade global.
- `POST` permite apenas líder/global via `hasGlobalDefectWriteAccess` ou usuários com acesso explícito à empresa via `assertCompanyAccess`.
- Suporte técnico global sem perfil de líder/global recebe `403` no `POST`.

Validação:

```bash
rg -n "export async function GET|export async function POST|authenticateRequest|assertCompanyAccess|hasGlobalCompanyVisibility|companyId" app/api/defect/route.ts # OK
npm run build # OK, com warnings Turbopack/NFT existentes
```

Status:

- Duplicação: não encontrada.
- RBAC de `app/api/defect/route.ts`: mitigado com ressalva residual de rota legada.
- Próximos bloqueios RBAC:
  - `app/api/test-plans/route.ts`
  - `app/api/test-plans/cases/route.ts`

---

## Sexta rodada - RBAC em rota principal de planos de teste

Data da rodada: 2026-05-19.

Escopo permitido:

- `app/api/test-plans/route.ts`
- `docs/ops/CODE_CLEANUP_AUDIT.md`

Resumo dos agentes:

- Product Flow Guardian: aprovado; a rota segue como endpoint canonico de CRUD/listagem de Planos de Teste.
- Code Cleanup Guardian: aprovado; patch local, sem criar endpoint, pasta ou tela nova.
- RBAC Guardian: aprovado com ressalvas; `GET`, `POST`, `PATCH` e `DELETE` agora exigem autenticacao e validacao de empresa.
- Manual QA Flow Guardian: aprovado; Planos continuam vinculando Casos sem misturar fluxo manual com automacao nova.
- Brian Guardian: nao aplicavel nesta rota; nenhum no, relacao ou snapshot do Brian foi alterado.
- UI Screen Guardian: nao aplicavel; nenhuma tela ou componente foi alterado.
- Build Safety Guardian: aprovado; `npm run build` passou com warnings Turbopack/NFT existentes.

Analise:

- Metodos exportados: `GET`, `POST`, `PATCH` e `DELETE`.
- Antes do patch, a rota aceitava `companySlug` por query/body e nao evidenciava `authenticateRequest`.
- A rota mistura planos manuais e Qase, por isso nao foi refatorada nesta rodada.
- Helper comparado: `app/api/test-projects/route.ts`, que usa `authenticateRequest`, `resolveNormalizedCompanySlugs` e `hasGlobalCompanyVisibility`.
- Helper adicional usado para casos: `canAccessTestCaseRecord`.
- `GET` permite leitura para usuario da empresa ou perfil com visibilidade global.
- `POST`, `PATCH` e `DELETE` exigem usuario da empresa ou perfil lider/global para escrita.
- `companySlug` vindo do cliente nao e aceito cegamente: ele passa por autenticacao e validacao contra as empresas do usuario antes de consultar, criar, alterar ou remover.
- Casos centrais vinculados ao plano sao validados por permissao e por empresa antes de hidratar ou salvar detalhes.
- Quando o usuario nao pode ver um caso ja vinculado, a hidratacao retorna somente identificador/automacao existente, sem expor titulo, descricao ou steps.

Risco residual:

- `app/api/test-plans/route.ts` ainda mistura CRUD manual, listagem Qase e operacoes Qase. Consolidacao fica para patch separado.
- `app/api/test-plans/cases/route.ts` continua pendente de RBAC.
- `app/api/test-plans/[id]/test-cases/route.ts` ja possui autenticacao, mas deve ser revisado depois para alinhar a politica de escrita com esta rota.
- Operacoes Qase seguem baseadas no `companySlug` autorizado e nas configuracoes Qase da empresa; nao houve mudanca no contrato externo.

Validacao:

```bash
rg -n "export async function|authenticateRequest|assertCompanyAccess|companyId|testPlan|plan" app/api/test-plans/route.ts
rg -n "app/api/test-plans|/api/test-plans|api/test-plans" app tests tests-e2e
npm run build
```

Status:

- `app/api/test-plans/route.ts`: bloqueio RBAC mitigado com ressalvas.
- Proximo bloqueio RBAC:
  - `app/api/test-plans/cases/route.ts`

---

## Setima rodada - RBAC em detalhe de casos de planos

Data da rodada: 2026-05-19.

Escopo permitido:

- `app/api/test-plans/cases/route.ts`
- `docs/ops/CODE_CLEANUP_AUDIT.md`

Resumo dos agentes:

- Product Flow Guardian: aprovado; a rota continua ligada a Planos de Teste e Casos de Teste.
- Code Cleanup Guardian: aprovado; patch local, sem criar endpoint, tela, pasta ou helper global novo.
- RBAC Guardian: aprovado com ressalvas; `GET` agora exige autenticacao e valida acesso ao `companySlug`.
- Manual QA Flow Guardian: aprovado; a consulta de caso manual continua partindo de plano existente e caso vinculado.
- Brian Guardian: nao aplicavel; nenhum dado do Brian foi alterado.
- UI Screen Guardian: nao aplicavel; nenhuma tela foi alterada.
- Build Safety Guardian: aprovado; `npm run build` passou com warnings Turbopack/NFT existentes.

Analise:

- Metodo exportado: `GET`.
- Antes do patch, a rota aceitava `companySlug`, `planId`, `caseId` e `source` sem evidenciar autenticacao backend.
- A rota atende dois caminhos: detalhe de caso manual em plano e detalhe de caso Qase.
- Helper usado: `authenticateRequest`, `resolveNormalizedCompanySlugs`, `hasGlobalCompanyVisibility` e `canAccessTestCaseRecord`.
- Para `source=manual`, o plano ainda e buscado por `companySlug` e `planId`, mas agora o usuario precisa pertencer a empresa ou ter visibilidade global.
- Para caso central encontrado, a rota valida permissao e empresa antes de retornar titulo, descricao e steps.
- Para `source=qase`, a consulta usa somente configuracao Qase da empresa autorizada.

Risco residual:

- A rota ainda mistura detalhe manual e Qase; consolidacao fica para patch separado.
- Se um plano antigo tiver caso salvo sem registro central, a rota ainda retorna o caso vinculado ao plano autorizado para preservar comportamento.
- `app/api/test-plans/[id]/test-cases/route.ts` deve ser revisado depois para alinhar a mesma politica de empresa/perfil usada no CRUD de planos.

Validacao:

```bash
rg -n "export async function|authenticateRequest|assertCompanyAccess|companyId|companySlug|testPlan|case" app/api/test-plans/cases/route.ts
rg -n "app/api/test-plans/cases|/api/test-plans/cases|api/test-plans/cases" app tests tests-e2e
npm run build
git diff --check
```

Status:

- `app/api/test-plans/cases/route.ts`: bloqueio RBAC mitigado com ressalvas.
- Chamado operacional: #31 pode ser fechado pelos criterios locais de codigo/build.

---

## Oitava rodada - CI/CD minimo antes do front

Data da rodada: 2026-05-19.

Escopo permitido:

- `.github/workflows/*`
- `docs/ops/CODE_CLEANUP_AUDIT.md`

Resumo dos agentes:

- Product Flow Guardian: aprovado; nao altera tela nem conceito funcional.
- Code Cleanup Guardian: aprovado com ressalva; ajusta workflow existente em vez de criar pipeline paralelo.
- RBAC Guardian: nao aplicavel diretamente; depende dos patches RBAC ja aplicados.
- Manual QA Flow Guardian: aprovado; nao inicia front nem automacao nova.
- Brian Guardian: nao aplicavel.
- UI Screen Guardian: nao aplicavel; nenhuma tela foi alterada.
- Build Safety Guardian: bloqueado por segredo versionado encontrado em script, embora build e testes locais tenham passado.

Alteracao aplicada:

- `.github/workflows/ci.yml` recebeu `permissions: contents: read`.
- O job `build-test` passou a declarar envs seguras para CI: `SKIP_PRISMA_MIGRATE`, `E2E_USE_JSON`, `AUTH_STORE=json`, `USE_JSON_STORE=true` e `NEXT_DISABLE_FONT_DOWNLOAD`.
- O build/test do CI monta um `DATABASE_URL` dummy em runtime, sem depender de segredo de producao.
- O workflow ganhou uma checagem de alto sinal para URL de banco versionada em `.github`, `scripts`, `app` e `lib`.
- Warnings Turbopack/NFT continuam visiveis; nada foi mascarado.

Validacao:

```bash
git status --short # OK
git diff --check # OK
npm run build # OK, com warnings Turbopack/NFT existentes
npm run test # OK, com warnings/console logs esperados dos testes existentes
rg -n "postgresql://|DATABASE_URL=.*://|token|secret|password" .github scripts app lib docs --glob '!node_modules' # BLOQUEADO: encontrou candidatos; saida deve ser redigida
```

Bloqueio encontrado:

- A checagem de alto sinal confirmou URL de banco hardcoded em `scripts/test-db-connection.js`.
- A varredura ampla tambem retorna muitos falsos positivos por nomes de campos, placeholders, textos de UI e usos de `secrets.*` em workflows.
- Nada em `scripts/` foi alterado nesta rodada porque o escopo do #32 permite apenas workflow e documentacao operacional.

Retomada apos #34:

```bash
git status --short # OK
git diff --check # OK
npm run build # OK, com warnings Turbopack/NFT existentes
npm run test # OK, com warnings/console logs esperados dos testes existentes
rg -n "postgres(ql)?://[^[:space:]]+@[^[:space:]]+" .github scripts app lib --glob '!node_modules' # OK, sem resultados
```

Status:

- Workflow minimo: ajustado e revalidado apos remocao do segredo em `scripts/test-db-connection.js`.
- #32: pode ser fechado pelos criterios locais de CI/CD minimo.
- Front/#33: liberado para iniciar inventario, desde que a credencial exposta seja revogada/rotacionada fora do repositorio antes de qualquer merge.

---

## Nona rodada - incidente de seguranca em test-db-connection

Data da rodada: 2026-05-19.

Escopo permitido:

- `scripts/test-db-connection.js`
- `docs/ops/CODE_CLEANUP_AUDIT.md`

Resumo dos agentes:

- Product Flow Guardian: nao aplicavel; nao altera tela nem conceito funcional.
- Code Cleanup Guardian: aprovado; menor patch seguro no script existente, sem mover ou apagar arquivo.
- RBAC Guardian: aprovado com ressalva; segredo removido do codigo, mas credencial exposta precisa ser revogada fora do repo.
- Manual QA Flow Guardian: nao aplicavel.
- Brian Guardian: nao aplicavel.
- UI Screen Guardian: nao aplicavel.
- Build Safety Guardian: aprovado; `npm run build`, `npm run test` e `git diff --check` passaram.

Decisao:

- `scripts/test-db-connection.js` nao foi executado.
- A URL hardcoded de banco foi removida do codigo.
- O script agora exige `DB_CHECK_DATABASE_URL`.
- Se `DB_CHECK_DATABASE_URL` nao existir, o script encerra com mensagem segura e sem expor valor sensivel.
- Remover o segredo do arquivo nao invalida a credencial ja exposta.
- A credencial antiga deve ser revogada/rotacionada imediatamente fora do repositorio.

Validacao:

```bash
rg -n "postgres(ql)?://|DATABASE_URL=.*://|token|secret|password" scripts/test-db-connection.js
rg -n "test-db-connection" package.json scripts docs app lib
npm run build
npm run test
git diff --check
```

Status:

- `scripts/test-db-connection.js`: segredo removido do codigo.
- #34: pode ser fechado pelos criterios locais de seguranca/build/test.
- #32: pode voltar a rodar.
- Front/#33: ainda bloqueado ate #32 fechar.

---

## Comandos de validação

Executar conforme a fase:

```bash
git status
npm run lint
npm run build
npm test
```

Se mexer em fluxo manual:

```bash
npm run test:e2e:cases
npm run test:e2e:runs
```

Se mexer no Brian:

```bash
npm run brain:test
npm run test:brain:contracts
```

---

## Decima rodada - fechamento acumulado da rodada atual

Data da rodada: 2026-05-20.

Agente lider:

- Build Safety Guardian

Agentes de apoio:

- Code Cleanup Guardian
- RBAC Guardian
- Product Flow Guardian

Objetivo:

- Validar o estado acumulado antes de iniciar nova rodada de backend ou front.
- Nao implementar funcionalidade nova.
- Nao alterar backend, front, schema, Prisma ou `package.json` nesta validacao.
- Nao executar `git add` nem commit.

Arquivos alterados acumulados no workspace:

- `.github/copilot-instructions.md`
- `.github/workflows/ci.yml`
- `app/api/defect/route.ts`
- `app/api/test-plans/route.ts`
- `app/api/test-plans/cases/route.ts`
- `app/empresas/[slug]/planos-de-teste/page.tsx`
- `scripts/check-thiago.mjs`
- `scripts/test-db-connection.js`
- `docs/agents/QA_AGENTS.md`
- `docs/architecture/QA_PLATFORM_CONTRACT.md`
- `docs/ops/CODE_CLEANUP_AUDIT.md`
- `docs/product/QA_SCREEN_FLOW.md`
- `docs/product/QA_FRONT_INVENTORY.md`

Resumo dos agentes:

- Build Safety Guardian: aprovado com ressalvas; testes e build em modo CI seguro passaram, mas o build local comum falhou por indisponibilidade do banco externo durante `prisma migrate deploy`.
- Code Cleanup Guardian: aprovado; nao houve `git add`, commit, move ou exclusao de arquivos.
- RBAC Guardian: aprovado com ressalvas; patches RBAC aplicados em defeitos e planos continuam presentes, mas ainda ha endpoints a inventariar na proxima rodada.
- Product Flow Guardian: aprovado; o primeiro ajuste visual de Planos de Teste respeitou a tela canonica e nao criou rota nova.

Validacoes executadas:

```bash
git status --short
git diff --check
rg -n -l "postgres(ql)?://[^[:space:]]+@[^[:space:]]+" .github scripts app lib --glob '!node_modules'
npm run test
npm run build
SKIP_PRISMA_MIGRATE=1 E2E_USE_JSON=1 AUTH_STORE=json USE_JSON_STORE=true NEXT_DISABLE_FONT_DOWNLOAD=1 npm run build
```

Resultado:

- `git diff --check`: OK.
- Busca de URL de banco com credencial hardcoded em `.github`, `scripts`, `app` e `lib`: OK, zero arquivos candidatos. A busca foi feita com saida por arquivo para evitar imprimir valor sensivel.
- `npm run test`: OK. Resultado local: 58 suites passaram, 19 suites foram ignoradas; 444 testes passaram, 217 foram ignorados.
- `npm run build`: bloqueado por infraestrutura externa. A etapa de `prisma migrate deploy` retornou `P1001` por indisponibilidade do banco antes da compilacao Next.
- Build em modo CI seguro com migration pulada e store JSON: OK. Compilou e gerou paginas, mantendo warnings Turbopack/NFT ja conhecidos.

Pendencias antes de merge:

- Revogar/rotacionar fora do repositorio todas as credenciais que ja foram expostas antes da remocao do codigo.
- Reexecutar build comum quando o banco externo estiver acessivel, ou validar em ambiente CI configurado para nao depender de migration contra banco remoto.
- Manter warnings Turbopack/NFT documentados; nao foram mascarados.
- Fechar manualmente o chamado #35 no GitHub se o conector continuar bloqueando a acao.

Status:

- Rodada atual: fechada localmente com ressalvas de infraestrutura.
- Proxima rodada liberada: inventario backend liderado por RBAC Guardian.
- Nao liberar merge ate a rotacao/revogacao externa de credenciais e uma validacao final de build no ambiente esperado.

---

## Decima primeira rodada - RBAC em vinculo de casos ao plano

Data da rodada: 2026-05-20.

Endpoint alvo:

- `app/api/test-plans/[id]/test-cases/route.ts`

Agente lider:

- RBAC Guardian

Agentes de apoio:

- Manual QA Flow Guardian
- Build Safety Guardian
- Code Cleanup Guardian

Resumo dos agentes:

- RBAC Guardian: aprovado; `POST` e `DELETE` agora validam autenticacao e acesso a `companySlug` antes de buscar ou mutar o plano.
- Manual QA Flow Guardian: aprovado; a rota continua servindo apenas vinculo/desvinculo de casos em Plano de Teste.
- Build Safety Guardian: aprovado com ressalvas; testes e build em modo CI seguro passaram, com warnings Turbopack/NFT existentes.
- Code Cleanup Guardian: aprovado; patch local no endpoint existente, sem criar rota, schema, helper global, front ou estrutura paralela.

Analise:

- Metodos exportados: `POST` e `DELETE`.
- Antes do patch, a rota autenticava usuario, mas aceitava `companySlug` vindo do body sem validar acesso explicito a empresa.
- `DELETE` era o maior risco, pois um usuario autenticado poderia tentar remover casos de um plano de outra empresa se conhecesse `companySlug`, `planId` e ids dos casos.
- `POST` tambem precisava impedir vinculo de caso de outra empresa ao plano.

Alteracao aplicada:

- Adicionado helper local `requireTestPlanMutationAccess`.
- A rota agora retorna `401` para usuario nao autenticado.
- A rota agora retorna `403` para usuario autenticado sem acesso a empresa do plano.
- `companySlug` vindo do cliente nao e aceito cegamente; ele precisa pertencer ao usuario ou o usuario precisa ter papel global de escrita em plano.
- Escrita global em plano foi limitada a `isGlobalAdmin` ou papel `leader_tc`, alinhada ao CRUD de planos.
- `POST` valida que cada caso pode ser acessado pelo usuario e que pertence a empresa do plano quando o caso possui empresa vinculada.
- `DELETE` valida acesso a empresa antes de mutar o plano.

Risco residual:

- A rota continua usando store manual (`getManualTestPlan`/`updateManualTestPlan`) e nao cobre planos Qase.
- Casos antigos sem empresa vinculada ainda podem ser vinculados por usuario com permissao global, preservando compatibilidade com comportamento existente.
- Ainda falta inventariar endpoints de execucoes/runs, defeitos duplicados/legados, Brian e Assistente.

Validacoes:

```bash
rg -n "export async function|authenticateRequest|companyId|companySlug|assertCompanyAccess|canAccessTestCaseRecord|canCreateTestCaseForCompany|resolveNormalizedCompanySlugs|hasGlobalTestPlanWriteAccess" app/api/test-plans/[id]/test-cases/route.ts
git diff --check
npm run test
SKIP_PRISMA_MIGRATE=1 E2E_USE_JSON=1 AUTH_STORE=json USE_JSON_STORE=true NEXT_DISABLE_FONT_DOWNLOAD=1 npm run build
```

Resultado:

- `rg`: OK; evidenciou `authenticateRequest`, `resolveNormalizedCompanySlugs`, `canAccessTestCaseRecord`, `canCreateTestCaseForCompany`, `companySlug`, `POST` e `DELETE`.
- `git diff --check`: OK.
- `npm run test`: OK. Resultado local: 58 suites passaram, 19 suites foram ignoradas; 444 testes passaram, 217 foram ignorados.
- Build em modo CI seguro: OK, com warnings Turbopack/NFT existentes.

Status:

- `app/api/test-plans/[id]/test-cases/route.ts`: bloqueio RBAC mitigado com ressalvas.
- Proximo backend recomendado: inventariar endpoints de execucoes/runs antes de novo patch.

---

## Decima segunda rodada - inventario RBAC de execucoes e runs

Data da rodada: 2026-05-20.

Agente lider:

- RBAC Guardian

Agentes de apoio:

- Manual QA Flow Guardian
- Brian Guardian
- Code Cleanup Guardian
- Build Safety Guardian

Objetivo:

- Inventariar endpoints relacionados a execucoes, runs, resultados, defeitos vinculados, historico de caso e Brian.
- Nao implementar patch funcional nesta rodada.
- Nao alterar front, schema, Prisma, `package.json`, rotas ou componentes.
- Registrar riscos antes de escolher o proximo menor patch backend.

Comandos de inventario executados:

```bash
rg -n "run|runs|execution|executions|execucao|execucoes|resultado|result|defect|brain|autoSync|companyId|companySlug|authenticateRequest" app/api
rg -n "export async function" app/api
rg -n "brainOn|autoSync|addAuditLogSafe|history|resultado|result" app lib data
rg --files app/api | rg -i "(runs|run|results|result|execu|execution|defect|defeito|brain)"
rg -n "export async function|authenticateRequest|companyId|companySlug|clientSlug|brainOn|autoSync|emitBrainEvent|appendDefectHistory|syncReleaseManualToBrain" app/api/test-runs app/api/releases-manual app/api/v1 app/api/company-defects app/api/brain app/api/playwright app/api/runs app/api/admin/defeitos app/api/empresas/[slug]/defeitos
```

Resumo por agente:

- RBAC Guardian: bloqueado para endpoints Qase v1 de runs/results; autenticacao existe, mas `projectCode` da URL nao e validado contra a empresa autorizada antes de ler ou mutar dados no Qase.
- Manual QA Flow Guardian: bloqueado para `app/api/releases-manual/[slug]/cases/route.ts`; a rota altera casos de uma execucao manual apenas pelo slug, sem validar a empresa do release/run.
- Brian Guardian: aprovado com ressalvas; rotas principais do Brain usam `resolveBrainAccess` ou admin global, mas analytics/workbench aceitam `companySlug` do cliente e devem ser revisados em rodada propria.
- Code Cleanup Guardian: aprovado; nenhum arquivo foi movido, apagado ou refatorado.
- Build Safety Guardian: aprovado com ressalvas; `git diff --check`, `npm run test` e build em modo CI seguro passaram, mantendo warnings Turbopack/NFT conhecidos.

### Endpoints inventariados

| Caminho | Metodos | O que faz | Evidencia RBAC | Risco | Acao recomendada | Status |
|---|---:|---|---|---|---|---|
| `app/api/v1/runs/route.ts` | GET, POST | Lista e cria runs no Qase. | Usa `authenticateRequest`, `resolveRunRole`, `isCompanyUser`, `hasGlobalCompanyVisibility` e `getClientQaseSettings`. | Medio/alto: GET permite suporte global escolher `companySlug`; POST usa `auth.companySlug`, mas ainda nao prova que `project_code` do body pertence a empresa antes de criar no Qase. | Revisar depois dos endpoints destrutivos; validar `projectCode` contra configuracao/aplicacoes da empresa. | analisar mais |
| `app/api/v1/runs/[code]/[id]/route.ts` | PATCH, DELETE | Edita ou remove run Qase por `projectCode` e `runId`. | Usa `authenticateRequest`, `resolveRunRole`, `canEditRun`, `canDeleteRun` e `getClientQaseSettings`. | Critico: mutacao destrutiva usa `projectCode` da URL sem provar que pertence a empresa do usuario; pode cair em token global Qase. | Primeiro patch recomendado; bloquear `projectCode` nao autorizado antes de instanciar cliente Qase. | bloqueado |
| `app/api/v1/runs/[code]/[id]/complete/route.ts` | POST | Finaliza run Qase. | Usa autenticacao e role de run. | Alto: finaliza run por `projectCode`/`runId` sem validacao de empresa/projeto. | Patch depois de `runs/[code]/[id]`. | bloqueado |
| `app/api/v1/runs/[code]/[id]/public/route.ts` | PATCH | Alterna visibilidade publica da run Qase. | Usa autenticacao e role de run. | Alto: altera publicidade por `projectCode`/`runId` sem validar projeto da empresa. | Patch depois de `runs/[code]/[id]`. | bloqueado |
| `app/api/v1/results/[code]/route.ts` | GET | Lista resultados Qase por projeto. | Usa `authenticateRequest` e `getClientQaseSettings`. | Alto: leitura por `projectCode` sem prova de empresa; fallback global de token amplia impacto. | Validar projeto contra empresa antes de listar. | bloqueado |
| `app/api/v1/results/[code]/[id]/route.ts` | POST | Cria resultado em run Qase. | Usa `authenticateRequest`, role de run e `getClientQaseSettings`. | Alto: cria resultado em `projectCode`/`runId` sem validar escopo da empresa. | Patch apos endpoints de run. | bloqueado |
| `app/api/v1/results/[code]/[id]/bulk/route.ts` | POST | Cria resultados em lote em run Qase. | Usa `authenticateRequest`, role de run e `getClientQaseSettings`. | Alto: bulk write em projeto/run sem validacao de escopo. | Patch junto ou logo apos resultado unitario. | bloqueado |
| `app/api/v1/results/[code]/[id]/[hash]/route.ts` | GET, PATCH, DELETE | Le, edita e remove resultado Qase. | Usa `authenticateRequest`, role de run e `getClientQaseSettings`. | Alto: leitura e mutacao por `projectCode`/`runId`/`hash` sem validar projeto da empresa. | Patch apos endpoints de run. | bloqueado |
| `app/api/v1/defects/route.ts` | GET | Lista defeitos Qase por empresa/projeto. | Usa `authenticateRequest`, `isCompanyUser`, `companySlugs` e `getClientQaseSettings`. | Medio: valida `companySlug`, mas permite `project=...` direto e usa projetos fallback se configuracao da empresa estiver vazia. | Revisar filtro `project` contra projetos configurados da empresa. | analisar mais |
| `app/api/admin/defeitos/route.ts` | GET | Agrega defeitos Qase para admin. | Usa `requireGlobalAdminWithStatus`. | Baixo no RBAC de empresa; escopo e global por design. | Manter; documentar como rota admin. | manter |
| `app/api/test-runs/route.ts` | GET, POST, PATCH | Lista, cria e atualiza `testRun` local e emite eventos Brain. | Usa `authenticateRequest`. | Critico: aceita `companyId`/`companySlug` do query/body, lista sem filtro quando ausente e nao valida empresa do usuario antes de criar/atualizar. | Patch prioritario apos Qase destrutivo ou antes se foco for run manual local. | bloqueado |
| `app/api/test-runs/[id]/route.ts` | GET, PATCH | Le e atualiza run local por id. | Usa `authenticateRequest` e `checkPermission`. | Alto: permissao existe, mas a run e buscada por id sem validar `companyId` contra escopo do usuario. | Adicionar validacao de empresa do registro antes de retornar ou mutar. | bloqueado |
| `app/api/releases-manual/route.ts` | GET, POST | Lista/cria releases manuais, runs manuais e defeitos manuais; sincroniza Brian e historico. | Usa `authenticateRequest`, `resolveNormalizedCompanySlugs`, role de defeito e valida `clientSlug`. | Medio: fluxo principal valida empresa, mas permite itens sem `clientSlug` para nao global. | Manter com ressalva; avaliar regra para item sem empresa em rodada posterior. | analisar mais |
| `app/api/releases-manual/[slug]/route.ts` | GET, PATCH, DELETE | Le/edita/remove release manual ou defeito manual; registra historico e notificacoes. | Busca release pelo slug e valida `clientSlug` contra empresas permitidas antes de mutar. | Baixo/medio: melhor protegido que rotas filhas; manter monitorado. | Manter por enquanto. | manter |
| `app/api/releases-manual/[slug]/cases/route.ts` | GET, POST, PATCH, PUT, DELETE | Le e altera casos vinculados a release/run manual. | Usa apenas `authenticateRequest`. | Critico: usa o slug direto no store de casos sem buscar o release nem validar `clientSlug`/empresa. | Patch prioritario para fluxo manual; reutilizar validacao de `releases-manual/[slug]`. | bloqueado |
| `app/api/releases-manual/[slug]/history/route.ts` | GET | Le historico de defeito manual. | Busca release e valida `clientSlug` antes de ler historico. | Baixo. | Manter. | manter |
| `app/api/company-defects/route.ts` | GET | Lista defeitos consolidados por empresa. | Usa `authenticateRequest`, `canAccessCompanyDefects` e `resolveDefectRole`. | Baixo. | Manter. | manter |
| `app/api/company-defects/[slug]/activity/route.ts` | GET | Le timeline/comentarios de defeito. | Usa `authenticateRequest`, `canAccessCompanyDefects` e `resolveAccessibleCompanyDefect`. | Baixo. | Manter. | manter |
| `app/api/company-defects/[slug]/assignee/route.ts` | PATCH | Atribui responsavel local a defeito integrado. | Usa `authenticateRequest`, `canAccessCompanyDefects`, role de defeito e valida responsavel da empresa. | Baixo. | Manter. | manter |
| `app/api/company-defects/[slug]/comments/route.ts` | POST | Comenta defeito. | Usa `authenticateRequest`, `canAccessCompanyDefects` e `resolveAccessibleCompanyDefect`. | Baixo. | Manter. | manter |
| `app/api/empresas/[slug]/defeitos/route.ts` | GET | Lista defeitos por slug de empresa. | Usa `authenticateRequest`, `hasGlobalCompanyVisibility` e compara slug permitido. | Baixo. | Manter. | manter |
| `app/api/playwright/run/route.ts` | GET, POST | Lista/cria execucoes Playwright. | Usa `authenticateRequest`, `resolveAutomationAllowedCompanySlugs` e `resolveAutomationAccess`. | Baixo/medio: valida `companySlug`, mas pertence a automacao fora do foco manual atual. | Manter fora da rodada manual; revisar quando automacao entrar. | manter |
| `app/api/playwright/run/[runId]/route.ts` | GET | Le run Playwright e resultados. | Busca run no banco e valida `company_slug` contra acesso. | Baixo. | Manter. | manter |
| `app/api/playwright/run/[runId]/events/route.ts` | GET | Stream de eventos Playwright. | Busca run no banco e valida `company_slug` contra acesso. | Baixo. | Manter. | manter |
| `app/api/runs/kanban/route.ts` | GET | Carrega kanban integrado de run Qase. | Usa `authenticateRequest` e valida `companySlug` permitido, mas chama Qase por `project`/`runId`. | Medio/alto: precisa confirmar se `project` pertence ao `companySlug` efetivo antes de chamar Qase. | Analisar junto dos endpoints Qase v1. | analisar mais |
| `app/api/brain/graph/route.ts` | GET | Le grafo Brain. | Usa `resolveBrainAccess` e `filterBrainGraphByAccess`. | Baixo. | Manter. | manter |
| `app/api/brain/graph/ingest/route.ts` | POST | Ingestao de evento/no/aresta/memoria Brain. | Usa `resolveBrainAccess({ requireManage: true })`. | Medio: requer manage/global, mas aceita `companySlug` do body para metadado; adequado para admin, revisar se manage ampliar. | Manter com ressalva. | analisar mais |
| `app/api/brain/graph/analytics/route.ts` | GET, POST | Analytics e recalculo de score do Brain. | Usa `resolveBrainAccess`; POST exige manage. | Medio: GET aceita `companySlug` query sem checar se esta nos slugs permitidos; depende do servico filtrar corretamente. | Revisar em rodada Brain. | analisar mais |
| `app/api/brain/nodes/route.ts` | GET, POST | Lista/cria nos Brain. | Usa `requireGlobalAdminWithStatus`. | Baixo no RBAC de empresa. | Manter. | manter |
| `app/api/brain/edges/route.ts` | GET, POST | Lista/cria arestas Brain. | Usa `requireGlobalAdminWithStatus`. | Baixo no RBAC de empresa. | Manter. | manter |
| `app/api/brain/ask/route.ts` | POST | Assistente/Brian. | Usa `requireGlobalAdminWithStatus`. | Baixo para vazamento entre empresas no estado atual; e restrito a admin global. | Manter; revisar quando Assistente for liberado a clientes. | manter |
| `app/api/brain/workbench/route.ts` | GET, POST, PATCH | Workspaces do Brain por usuario. | Usa `resolveBrainAccess` e filtra por `userId`. | Medio: POST aceita `companySlug` do body, mas workspace fica isolado por usuario; precisa validar slug se virar compartilhado. | Analisar mais antes de recurso compartilhado. | analisar mais |

Risco mais critico encontrado:

- Os endpoints Qase v1 de runs/results autenticam e checam papeis, mas ainda nao fazem uma prova explicita de que `projectCode` da URL pertence a empresa autorizada antes de chamar o Qase.
- O risco e maior nos endpoints destrutivos:
  - `app/api/v1/runs/[code]/[id]/route.ts`
  - `app/api/v1/runs/[code]/[id]/complete/route.ts`
  - `app/api/v1/runs/[code]/[id]/public/route.ts`
  - `app/api/v1/results/[code]/[id]/[hash]/route.ts`
- Tambem ha risco critico local em `app/api/releases-manual/[slug]/cases/route.ts`, pois ele altera casos de release/run manual sem validar empresa do release.

Primeiro endpoint recomendado para patch:

- `app/api/v1/runs/[code]/[id]/route.ts`

Motivo:

- Contem `PATCH` e `DELETE`, logo e destrutivo.
- Ja possui autenticacao e roles, entao o menor patch seguro e adicionar validacao de escopo do `projectCode` antes da mutacao.
- Corrigir este endpoint cria o padrao para aplicar depois em `complete`, `public` e `results`.

Prompt do proximo patch backend:

```txt
Implementar somente o proximo patch backend indicado pelo inventario de Execucoes/Runs.

Agente lider:
- RBAC Guardian

Agentes de apoio:
- Manual QA Flow Guardian
- Build Safety Guardian
- Code Cleanup Guardian

Endpoint alvo:
app/api/v1/runs/[code]/[id]/route.ts

Regras:
- Primeiro analisar o endpoint alvo.
- Depois implementar o menor patch seguro.
- Nao alterar front.
- Nao alterar schema.
- Nao alterar Prisma.
- Nao alterar package.json.
- Nao criar rota nova.
- Nao mover arquivo.
- Nao apagar arquivo.
- Nao fazer git add.
- Nao fazer commit.

Objetivo:
Garantir que PATCH e DELETE de run Qase respeitem autenticacao, papel autorizado e empresa/projeto autorizado.

Validar:
- usuario nao autenticado recebe 401
- usuario sem papel de edicao/remocao recebe 403
- projectCode da URL nao e aceito cegamente
- projectCode precisa pertencer a configuracao/aplicacoes da empresa autorizada
- fallback para token global Qase nao pode permitir mutacao cross-company por usuario de empresa
- comportamento atual de usuario autorizado e preservado

Atualizar:
- docs/ops/CODE_CLEANUP_AUDIT.md

Validacoes:
- rg -n "export async function|authenticateRequest|companySlug|projectCode|getClientQaseSettings|listApplications|canEditRun|canDeleteRun" app/api/v1/runs/[code]/[id]/route.ts
- git diff --check
- npm run test
- SKIP_PRISMA_MIGRATE=1 E2E_USE_JSON=1 AUTH_STORE=json USE_JSON_STORE=true NEXT_DISABLE_FONT_DOWNLOAD=1 npm run build
```

Ressalvas:

- Nao rodar `npm run build` comum enquanto ele depender de infraestrutura externa indisponivel para `prisma migrate deploy`; manter a ressalva `P1001` documentada.
- Credenciais ja expostas continuam exigindo revogacao/rotacao fora do repositorio antes de qualquer merge.

Validacoes:

```bash
git diff --check
npm run test
SKIP_PRISMA_MIGRATE=1 E2E_USE_JSON=1 AUTH_STORE=json USE_JSON_STORE=true NEXT_DISABLE_FONT_DOWNLOAD=1 npm run build
```

Resultado:

- `git diff --check`: OK.
- `npm run test`: OK. Resultado local: 58 suites passaram, 19 suites foram ignoradas; 444 testes passaram, 217 foram ignorados.
- Build em modo CI seguro: OK, com warnings Turbopack/NFT existentes.
- `npm run build` comum nao foi repetido nesta rodada porque o bloqueio `P1001` de infraestrutura externa ja estava documentado.

Status:

- Inventario de execucoes/runs: concluido e validado localmente.
- Proximo patch recomendado: `app/api/v1/runs/[code]/[id]/route.ts`.

# origin/feat/chamados-fixes

- base: `origin/main`
- head: `b870166`
- unique commits: 58
- compare: https://github.com/AnaLysyk/Quality_Control/compare/main...feat/chamados-fixes

## Hotspots

- app/api: 79 arquivos
- data/companies: 73 arquivos
- app/components: 32 arquivos
- data/backups: 30 arquivos
- data/versions: 20 arquivos
- scripts: 16 arquivos
- data/company-documents-files: 13 arquivos
- app/admin: 11 arquivos
- tests: 8 arquivos
- docs/branch-inventory: 7 arquivos

## Top Files

- data/user-notifications.json (15788 linhas alteradas)
- data/audit-logs.json (2981 linhas alteradas)
- data/support-tickets.json (2498 linhas alteradas)
- data/backups/support-tickets.bak-20260219-132947.json (2479 linhas alteradas)
- data/backups/support-tickets.bak-20260219-133047.json (2479 linhas alteradas)
- data/backups/support-tickets.bak-20260219-133147.json (2479 linhas alteradas)
- data/backups/support-tickets.bak-20260219-133247.json (2479 linhas alteradas)
- data/backups/support-tickets.bak-20260219-133347.json (2479 linhas alteradas)
- data/backups/support-tickets.bak-20260219-133447.json (2479 linhas alteradas)
- data/backups/support-tickets.bak-20260219-133547.json (2479 linhas alteradas)
- data/backups/support-tickets.bak-20260219-133647.json (2479 linhas alteradas)
- data/backups/support-tickets.bak-20260219-133747.json (2479 linhas alteradas)
- data/backups/support-tickets.bak-20260219-133847.json (2479 linhas alteradas)
- data/backups/support-tickets.bak-20260219-133947.json (2479 linhas alteradas)
- data/backups/support-tickets.bak-20260219-134047.json (2479 linhas alteradas)

## Commits

- `b870166` 2026-02-19 Ana: fix(kanban-it): mensagem clara para erro 401 e credentials: include no fetch
- `b5c2222` 2026-02-19 Ana: fix(kanban-it): endpoint correto, validação de content-type e erro limpo no loadTickets
- `b486bcb` 2026-02-19 Ana: fix: remove patch code, build clean for meus-chamados/page.tsx
- `7f420a8` 2026-02-19 Ana: fix: patches finais compatibilidade suporte, dedupe, notificationService, kanban, modal, imports
- `1aa6116` 2026-02-19 Ana: Fix async compatibility for appendSuporteEvent and event logging in suporteEventsStore.ts
- `4b39072` 2026-02-19 Ana: fix: compatibilidade máxima notificationService e patches de build
- `35a807f` 2026-02-19 Ana: fix: ajuste de compatibilidade, dedupeKey e aliases pós-refatoração suporte
- `566c9a2` 2026-02-19 Ana: fix(suporte): compatibilidade total com refatoração suporte, imports e aliases
- `4e9b6b5` 2026-02-19 Ana: fix(suporte): prop modal volta para ticket para compatibilidade tipada
- `053287e` 2026-02-19 Ana: fix(suporte): renomeia prop modal para suporte
- `1973d36` 2026-02-19 Ana: fix(suporte): ajusta props, tailwind canonical e compatibilidade modal
- `abd10f6` 2026-02-19 Ana: refactor(suporte): padroniza nomenclatura e corrige aliases KanbanSuportes
- `45fe571` 2026-02-19 Ana: fix(kanban): usa endpoint correto e aumenta largura das colunas
- `ebc555c` 2026-02-19 Ana: fix(ticket): loga valores recebidos e melhora debug de validação de título/descrição
- `bca9bc7` 2026-02-19 Ana: fix(playwright): remove duplicidade da propriedade projects na config
- `b40461d` 2026-02-19 Ana: fix(ticket-modal): adiciona props canEditStatus, statusOptions e onTicketUpdated para compatibilidade
- `8b5f90d` 2026-02-19 Ana: fix(ticket-modal): restaura esqueleto funcional do componente para corrigir build
- `2cdf81b` 2026-02-19 Ana: fix(kanban-link): permite companySlug ser string|null|undefined para compatibilidade total
- `6d8e433` 2026-02-19 Ana: fix(kanban-link): aceita role como string|null|undefined para compatibilidade com AuthUser real
- `cd1cdc2` 2026-02-19 Ana: fix(api/status): tipa parâmetro do some como any para eliminar erro TS
- `dc612b1` 2026-02-19 Ana: fix(api/user): compatibiliza assinatura do handler PATCH com Next.js e corrige erro de build
- `51612c9` 2026-02-19 Ana: fix(api/insights): compatibiliza assinatura do handler GET com Next.js e corrige erro de build
- `dd90d3b` 2026-02-19 Ana: fix(kanban-link): remove import duplicado e garante tipo local AuthUser
- `6903594` 2026-02-19 Ana: fix(ticket-modal): remove duplicidade e corrige build do modal de chamado
- `4a74e28` 2026-02-19 Ana: fix(kanban-link): define tipo mínimo AuthUser para build
- `33f6a85` 2026-02-19 Ana: fix(ticket-modal): ajustes finais, handlers stubs e lint sem inline style
- `b08cb9f` 2026-02-19 Ana: feat(ticket-modal): integra bloco de insights, remove inline style e corrige erros de tipos e handlers
- `a096666` 2026-02-18 Ana: chore: atualiza backups de support-tickets
- `4622cb8` 2026-02-18 Ana: chore: sync arquivos pendentes para restaurar sistema estável
- `7c52aad` 2026-02-18 Ana: feat: autenticação E2E via JSON, perfis fixos e utilitário Playwright ajustado
- `5ca4f46` 2026-02-18 Ana: chore: sync últimos backups removidos e novos
- `1ec222d` 2026-02-18 Ana: chore: sync final backups e ajustes
- `bb34379` 2026-02-18 Ana: chore: backups removidos e novos arquivos adicionados
- `40f3c6e` 2026-02-17 Ana: fix: ajustes finais e backups removidos
- `9452699` 2026-02-17 Ana: fix: corrigido import relativo de AuthUser para build Vercel
- `8ce7535` 2026-02-17 Ana: chore: backup removido e novos arquivos não rastreados adicionados
- `3dba762` 2026-02-17 Ana: feat: melhorias de visibilidade, permissão e automação nos chamados, perfil e kanban
- `06fc3d6` 2026-02-17 Ana: fix(UserProfileMenu): add missing import for CreateSupportTicketButton
- `99362e1` 2026-02-17 Ana: fix(component): remove invalid text from CriarAplicacao.tsx
- `456ee43` 2026-02-17 Ana: fix(api/tickets): remove actorRole property from ticket event creation
- `1329979` 2026-02-17 Ana: fix(api/tickets): remove createdByRole property to match TicketRecord type
- `0dd7a2a` 2026-02-17 Ana: feat: ajustes em meus-chamados e melhorias gerais
- `f06613f` 2026-02-17 Ana: fix: remove botão flutuante duplicado de 'Novo chamado' no Kanban e ajustes gerais de chamados
- `cba02f4` 2026-02-17 Ana: chamados: fix create flow, ensure companyId, atomic writes, unique title, FAB visibility
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


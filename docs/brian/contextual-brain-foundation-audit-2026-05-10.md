# Auditoria técnica — Brian como cérebro contextual

Data: 2026-05-10

## Diagnóstico

O repositório já tem uma base relevante para evoluir o Brian sem recriar a UI:

- `prisma/schema.prisma`: existem `BrainNode`, `BrainEdge`, `BrainMemory`, `BrainAuditLog`, `BrainSuggestion`, workspaces e modelos operacionais como `Company`, `Application`, `Ticket`, `TicketEvent`, `TicketComment`, `Defect`, `DefectHistoryEvent`, `Release`, `ReleaseManual`, `TestRun`, `AuditLog`, `AssistantAuditLog`, documentos, comentários e permissões.
- `lib/brain.ts`: já contém operações de grafo, busca, subgrafo, impacto, timeline, auditoria e métricas.
- `lib/brain/ontology.ts`: já existe uma ontologia inicial para tipos oficiais de nós/arestas, mas ainda orientada a grafo legado.
- `lib/brain-sync.ts`: já faz backfill/sync para empresas, aplicações, usuários, tickets, defeitos, releases, notas, integrações e mapa do sistema.
- `lib/brain-system-map.ts`: já mapeia rotas, endpoints, imports, chamadas de API, modelos Prisma, permissões e módulos funcionais.
- `lib/brain/internalEngine.ts`: o assistente já busca nós, memórias, subgrafos, métricas, auditoria e snapshot real do sistema.
- `lib/brain/sdk.ts` e `lib/brain/publicApi.ts`: já existem entradas para emitir eventos via `BrainAuditLog`, mas ainda sem envelope semântico padronizado.
- `lib/brain/mcpPolicy.ts`, `lib/auth/*`, `lib/core/session/*`, `lib/permissions/*`, `lib/rbac/*`: há material para RBAC, permissões, empresa atual, vínculo e perfil.
- Endpoints `POST`, `PATCH`, `PUT` e `DELETE` em `app/api/**/route.ts`: há muitos pontos de captura para impulsos futuros, especialmente defeitos, tickets, testes, runs, automações, releases, comentários, anexos, permissões e acessos.

## Fontes de contexto existentes

| Fonte | Arquivos principais | Pode alimentar |
| --- | --- | --- |
| Rotas/telas | `app/**/page.tsx`, `app/api/**/route.ts`, `lib/brain-system-map.ts` | `pathname`, empresa, módulo, tela, endpoint, ação |
| Usuário/sessão | `lib/jwtAuth.ts`, `lib/auth/sessionBuilder.ts`, `lib/auth/normalizeAuthenticatedUser.ts`, `lib/core/session/session.store.ts` | ator, papel, empresas, permissões |
| Empresas/aplicações | `Company`, `Application`, `CompanyIntegration`, `lib/brain-sync.ts` | neurônios de empresa, app, integração |
| Tickets/suporte | `Ticket`, `TicketEvent`, `TicketComment`, `lib/ticketsStore.ts`, `lib/ticketEventsStore.ts` | impulsos de criação, reabertura, comentário, status |
| Defeitos | `Defect`, `DefectHistoryEvent`, `lib/companyDefects.ts`, `lib/manualDefectHistoryStore.ts` | falhas, histórico, comentários, impacto |
| Releases/runs/testes | `Release`, `ReleaseManual`, `TestRun`, `StoredTestCase`, `app/api/test-cases/**` | regressão, execução, aprovação, bloqueio |
| Automação | `app/api/automations/**`, `AutomationDocument`, `AutomationAssetUsage` | geração/execução de automação |
| Auditoria | `AuditLog`, `BrainAuditLog`, `AssistantAuditLog`, `data/auditLogRepository.ts` | proveniência, histórico e evidência |
| Chat/assistente | `lib/assistant/**`, `lib/brain/internalEngine.ts`, `app/components/Chat.tsx` | contexto operacional e respostas GraphRAG futuras |

## Eventos capturáveis agora

- `defect.created`, `defect.updated`, `defect.status_changed`
- `ticket.created`, `ticket.updated`, `ticket.reopened`, `comment.added`
- `test_case.created`, `test_case.updated`, `test_run.started`, `test_run.failed`
- `automation.generated`
- `release.approved`, `release.blocked`
- `file.attached`, `permission.granted`
- `neuron.feedback_created`

## Lacunas

- Ainda não há tabelas dedicadas `brian_impulses`, `brian_neurons`, `brian_synapses`, `brian_evidence` e `brian_context_snapshots`.
- As sinapses atuais usam `BrainEdge.metadata`, mas não exigem evidência formal.
- A UI do grafo ainda consome principalmente `BrainNode`/`BrainEdge`, não projeções de neurônios ativados.
- O chat usa grafo e snapshots reais, mas ainda não monta contexto por `BrianContextSnapshot` com evidências e ativações.
- Contexto de navegação ainda não é propagado em todos os POST/PATCH com `traceId`, `sessionId`, `pathname`, empresa, módulo e permissões.

## Implementação incremental aplicada

- Criada fundação em `lib/brain/contextual/*` com contratos oficiais de impulso, neurônio, sinapse, evidência, contexto, ativação, projeção e snapshot.
- Criado pipeline `Impulse → Evidence → Neuron → Synapse → Activation → Projection → Snapshot`.
- Criado `BrianRBACFilter` backend-side para impedir ativação fora do escopo.
- Criado publisher em modo shadow via `publishBrianImpulse`, persistindo em `BrainAuditLog` sem exigir migração imediata.
- Criados testes unitários para normalização, evidência, sinapse e RBAC.

## Próximos passos seguros

1. Ligar `publishBrianImpulse` em um endpoint de baixo risco, preferencialmente criação de ticket ou comentário, com `shadowMode: true`.
2. Criar endpoint interno `GET /api/brain/context` que retorne snapshot filtrado por RBAC a partir de impulsos já processados.
3. Projetar neurônios para `BrainNode` apenas quando `projectToLegacyBrain: true` estiver validado em ambiente de teste.
4. Criar Brian Health com métricas: impulsos, neurônios, sinapses, evidências, órfãos, duplicados, bloqueios por permissão e narrativas vazias.
5. Só depois adaptar a UI para mostrar “Por que estou vendo isso?” usando `projection.explanation`.

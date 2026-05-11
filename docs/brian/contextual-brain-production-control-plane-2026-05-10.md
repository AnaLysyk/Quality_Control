# Brian Production Control Plane

## Decisão incremental

Esta etapa adiciona governança e runtime em código, mas não aplica migration automaticamente. O `npm run build` executa `prisma-migrate-safe.js` contra o banco configurado; por isso o DDL de produção ficou em `docs/brian/brian-production-ddl.sql` até o rollout ser aprovado.

## Camadas adicionadas

- **Contract Registry**: schemas versionados para impulsos como `defect.created.v1`, `ticket.created.v1`, `test_run.failed.v1`, `automation.generated.v1` e `release.approved.v1`.
- **Domain Map**: separa domínios como `company`, `defects`, `support`, `test_repository`, `automation`, `release` e `brian`.
- **Capability Registry**: registra capacidades como `summarize_screen`, `explain_node`, `create_defect`, `generate_automation` e `replay_context`.
- **Policy Engine**: decide capacidade, visibilidade, tenant boundary, confirmação e aprovação.
- **Prompt/Data Firewall**: mascara/redige/bloqueia campos sensíveis antes de entrar no cérebro contextual.
- **Workflow Runtime**: executa atividades rastreáveis: sanitização, validação, processamento, quality gate e resumo de contexto.
- **Quality Gates**: bloqueia projeções de neurônios abaixo do score mínimo antes de chegar na UI.
- **Outbox Contract**: cria idempotency key e formato de outbox/DLQ para futura persistência transacional.

## Regras de produção preservadas

- Impulso precisa ter `specversion`, `schemaVersion`, `type`, `source`, `subject`, `actor`, `context` e `data`.
- Payload sensível é tratado como dado, nunca como instrução.
- Capacidade sensível exige permissão, confirmação e/ou aprovação conforme risco.
- Tenant/company boundary é validado no backend antes de contexto ser considerado autorizado.
- Neurônio sem qualidade mínima não deve virar projeção confiável.
- DDL de outbox/DLQ existe, mas ainda não foi aplicado em produção.

## Próximo encaixe seguro

1. Aprovar DDL e aplicar migration em janela controlada.
2. Gravar `brian_outbox` na mesma transação de um endpoint piloto, preferencialmente `ticket.created`.
3. Criar worker para processar outbox com `runBrianWorkflow`.
4. Persistir snapshots/traces após RBAC e quality gate.
5. Expor Brian Health com pendentes, erros, DLQ, redactions e quality gates.

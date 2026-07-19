# testes/api/geral

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/api/geral
```

## Arquivos e casos de teste

### `active-identity.test.ts` (unit/integracao (jest))

**Describe:** active identity

- prioritizes institutional company context over user permission role
- keeps personal identity for company-scoped user accounts
- keeps user identity and company tag for common users linked to a company
- does not turn global admin navigation into company identity

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/active-identity.test.ts
```

### `adminClientAccess.test.ts` (unit/integracao (jest))

**Describe:** admin client access

- allows leader TC and technical support roles to see client admin tools
- keeps company-only roles out of the admin toolbar
- honors any privileged role even when another field is more restrictive

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/adminClientAccess.test.ts
```

### `automation-cases.test.ts` (unit/integracao (jest))

**Describe:** automation cases catalog

- includes the new Testing Company automation coverage cases
- keeps the new automation cases scoped to Testing Company

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/automation-cases.test.ts
```

### `automation-catalog-griaule.test.ts` (unit/integracao (jest))

**Describe:** Griaule automation catalog

- defaults Griaule users to the homologation API host
- ships the Griaule homologation environments with non-secret defaults
- exposes executable SMART presets and tools
- documents the operational handoff without embedding shared passwords

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/automation-catalog-griaule.test.ts
```

### `biometrics-fingerprint-processor.test.ts` (unit/integracao (jest))

**Describe:** fingerprintProcessor, fingerprintProcessor com fixtures locais

- converte buffer para base64
- estima tamanho base64 corretamente
- calcula bytes máximos para um limite base64
- detecta WSQ pelo magic number
- preserva imagem já dentro do limite
- reduz imagem acima do limite
- falha quando o limite é impossível
- preserva WSQ dentro do limite
- rejeita WSQ acima do limite
- rejeita input inválido
- infla imagem para cenário above
- sem fixtures locais disponíveis

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/biometrics-fingerprint-processor.test.ts
```

### `brain-commands-confirmation.test.ts` (unit/integracao (jest))

**Describe:** brain commands confirmation contract

- returns confirmation request for high-risk command before execution
- executes command after explicit confirmation

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/brain-commands-confirmation.test.ts
```

### `brain-ingest-contract.test.ts` (unit/integracao (jest))

**Describe:** brain ingest contract

- rejects event type outside allowed contract
- accepts custom event and ingests node, edge and memory

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/brain-ingest-contract.test.ts
```

### `brian-contextual-foundation.test.ts` (unit/integracao (jest))

**Describe:** Brian contextual foundation

- normalizes market/system aliases into canonical Brian contracts
- turns a real movement into neurons, evidence-backed synapses and projections
- keeps RBAC on backend-side neuron visibility
- redacts sensitive payload data and flags prompt-injection-like text as evidence only
- keeps idempotency stable and avoids duplicate canonical neurons for the same impulse
- requires policy-approved capabilities before sensitive Brian actions
- runs the production workflow with activities, telemetry and quality gates
- sends invalid contracted impulses to dead letter instead of silently processing

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/brian-contextual-foundation.test.ts
```

### `chamados-suporte.test.ts` (unit/integracao (jest))

- cria chamado básico com título e descrição
- cria chamado do tipo bug com prioridade high
- cria chamado do tipo melhoria com tags
- cria chamado vinculado a empresa e com assignee
- retorna null ao criar chamado sem título e sem descrição
- gera código SP-XXXXXX automaticamente
- status padrão do chamado criado é backlog
- criador edita título e descrição do próprio chamado
- admin edita tipo e prioridade do chamado
- edita as tags do chamado
- atribui assignee ao chamado
- altera status do chamado: backlog → doing → review → done
- retorna null ao editar chamado com id inexistente
- updateSuporteForUser não permite editar chamado de outro usuário
- lista apenas os chamados do usuário criador

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/chamados-suporte.test.ts
```

### `chatContacts.test.ts` (unit/integracao (jest))

**Describe:** chatContacts

- non privileged users see contacts from linked companies only
- search spans name, email and company metadata
- privileged users can see every contact except themselves
- global admin via globalRole can see every contact except themselves

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/chatContacts.test.ts
```

### `chatStore.test.ts` (unit/integracao (jest))

**Describe:** chatStore

- creates a single thread for both message directions
- persists attachment-only messages and builds a preview from the attachment
- clearChatStore removes persisted conversations

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/chatStore.test.ts
```

### `CreateUserFlow.test.ts` (unit/integracao (jest))

**Describe:** User Creation Flow - All Profiles

- criar usuário com perfil ${profile.name}
- validar rejeição de password para perfis que não requerem
- validar rejeição de email inválido
- validar normalizacao de email duplicado

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/CreateUserFlow.test.ts
```

### `defect-activity.test.ts` (unit/integracao (jest))

**Describe:** defectActivity

- extracts comments and latest assignee from history
- falls back when assignee note is plain text

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/defect-activity.test.ts
```

### `edit-company.test.ts` (unit/integracao (jest))

- edita o nome da empresa e persiste no banco
- altera status active → inactive → active
- edita phone, address, website e cep
- edita o tax_id (CNPJ) da empresa
- edita short_description e notes
- edita campos de integração (jira, qase_project_code)
- limpa campos opcionais definindo como null
- retorna null ao tentar editar empresa com id inexistente
- edita linkedin_url da empresa
- edita múltiplos campos em uma única operação

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/edit-company.test.ts
```

### `fluxo-solicitacao-acesso.test.ts` (unit/integracao (jest))

- 1. solicitante abre pedido de acesso com e-mail e mensagem
- 2. solicitante pode abrir mais de uma solicitação (sem trava de duplicata)
- 3. solicitante consulta sua solicitação por id
- 4. solicitante adiciona comentário explicando o motivo
- 5. solicitante responde comentário do admin (segunda rodada)
- 6. admin visualiza todas as solicitações abertas
- 7. admin lê a mensagem e os comentários do solicitante
- 8. admin adiciona comentário pedindo mais informações
- 9. admin aceita a solicitação e vincula ao usuário criado
- 10. admin rejeita outra solicitação com justificativa no comentário
- 11. solicitante abre → admin comenta → solicitante responde → admin aceita
- 12. após aceite: status é closed, user_id vinculado, histórico completo
- 13. solicitante abre → admin pede justificativa → solicitante responde → admin rejeita
- 14. após recusa: comentários de ambos os lados gravados em ordem
- 15. comentários de uma solicitação não aparecem em outra
- 16. solicitações de e-mails diferentes não se misturam na listagem

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/fluxo-solicitacao-acesso.test.ts
```

### `normalizeAuthenticatedUser.test.ts` (unit/integracao (jest))

**Describe:** normalizeAuthenticatedUser, resolveCompanyRouteAccessInput, resolveCompanyAccess

- normaliza clientSlugs, roles e permissions vindos em formatos antigos
- normaliza um clientSlug unico e empresas retornadas pela API
- extrai empresas aninhadas e lida com payload vazio
- normaliza payload legado com companySlug unico
- normaliza campos snake_case, primary/default e activeClientSlug
- extrai empresas de permissoes quando o vinculo vem aninhado
- resolve o input de rota a partir do usuario normalizado
- retorna loading enquanto a autenticacao ainda nao terminou
- permite acesso quando a rota bate com o slug normalizado
- permite acesso com companies contendo griaule
- permite acesso com clients contendo griaule
- permite acesso quando companies vem vazio mas defaultCompanySlug esta preenchido
- permite acesso para usuario privilegiado mesmo sem match direto
- permite acesso para suporte tecnico sem vinculo direto
- retorna denied quando o usuario nao tem vinculo com a empresa
- retorna erro tratado quando a sessao falha
- retorna unauthenticated quando nao existe usuario
- retorna not_found quando a rota nao informa slug

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/normalizeAuthenticatedUser.test.ts
```

### `operationsWorkspace.test.ts` (unit/integracao (jest))

**Describe:** operationsWorkspace helpers

- normalizes module aliases to canonical keys
- matches applications by slug, name and project code
- aggregates run stats and pass rate with qase style fields
- classifies run statuses with the same buckets used by the workspace

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/operationsWorkspace.test.ts
```

### `sc-integration-collection.test.ts` (unit/integracao (jest))

**Describe:** SC Integration API v2 collection

- keeps the collection grouped and counted

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/sc-integration-collection.test.ts
```

### `solicitacoes-acesso.test.ts` (unit/integracao (jest))

- 1. cria solicitação com status padrão open
- 2. cria solicitação com status explícito in_progress
- 3. cria solicitação com ip_address, user_agent e user_id
- 4. permite múltiplas solicitações para o mesmo e-mail
- 5. listAccessRequests retorna as solicitações criadas
- 6. listAccessRequests retorna ordenado por createdAt desc
- 7. getAccessRequestById retorna registro existente
- 8. getAccessRequestById retorna null para id inexistente
- 9. campos opcionais são preservados após criação
- 10. altera status para in_progress
- 11. fecha a solicitação (closed)
- 12. rejeita solicitação
- 13. atualiza o e-mail da solicitação
- 14. atualiza a mensagem da solicitação
- 15. vincula user_id a uma solicitação existente

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/solicitacoes-acesso.test.ts
```

### `solicitar-acesso-lifecycle.test.ts` (unit/integracao (jest))

- 1. solicitação é criada com status open
- 2. mensagem contém marcador ACCESS_REQUEST_V1
- 3. parseAccessRequestMessage extrai campos corretamente
- 4. usuário é criado com campos corretos
- 5. membership vincula usuário à empresa
- 6. solicitação aceita tem status closed e user_id
- 7. solicitação rejeitada tem status rejected
- 8. solicitação rejeitada não possui user_id

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/solicitar-acesso-lifecycle.test.ts
```

### `system-map.test.ts` (unit/integracao (jest))

**Describe:** mapa do sistema

- mantem ids unicos e rotas ligadas a modulos existentes
- aponta somente para arquivos existentes
- mantem toda page.tsx autenticada mapeada ou explicitamente excluida da matriz
- mantem todos os itens do menu ligados a rotas mapeadas
- mantem toda rota visual com permissao minima cadastrada na matriz

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/system-map.test.ts
```

### `system-roles.test.ts` (unit/integracao (jest))

**Describe:** system role contract

- exposes only the canonical profile roles
- keeps permission defaults keyed only by canonical roles
- keeps access-request review capacity on leader TC, not support
- keeps access-request review queue gated by capability

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/system-roles.test.ts
```

### `test-case-repository-contract.test.ts` (unit/integracao (jest))

**Describe:** test case repository contracts

- rejects steps without expected result
- rejects invalid enum patch values
- blocks duplicate automation link by same spec/tag without confirmation
- allows duplicate automation link when explicitly confirmed

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/test-case-repository-contract.test.ts
```

### `vinculo-empresa-visibilidade.test.ts` (unit/integracao (jest))

- 1. Vincular usuário como viewer → membership retornada
- 2. Vincular usuário como company_admin → role normalizado
- 3. Vincular usuário como it_dev → role it_dev confirmado
- 4. resolveUserCompanies retorna empresa vinculada com dados completos
- 5. Usuário sem vínculo → resolveUserCompanies vazio (visibilidade zero)
- 6. Desvincular usuário → links vazios, empresa some da visibilidade
- 7. listLocalLinksForCompany lista todos os membros da empresa
- 8. Dois usuários vinculados à mesma empresa → ambos visualizam a empresa
- 9. Atualizar role via upsert (viewer → company_admin)
- 10. Vínculo com capabilities personalizadas → capabilities persistidas
- 11. Usuário vinculado a múltiplas empresas → resolveUserCompanies retorna todas
- 12. Remover vínculo de uma empresa mantém vínculo nas demais

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/geral/vinculo-empresa-visibilidade.test.ts
```

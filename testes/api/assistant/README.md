# testes/api/assistant

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/api/assistant
```

## Arquivos e casos de teste

### `assistant-ask-route.test.ts` (unit/integracao (jest))

**Describe:** authentication, standard assistant flow, brain-first flow, buildMessagesFromHistory

- returns 401 when unauthenticated
- returns 403 when ai.view is denied
- returns 403 when ai.use is denied
- delegates to runAssistantRequest
- passes message and history to runAssistantRequest
- passes context, actor, and action to runAssistantRequest
- response always includes tool, reply, and context keys
- still succeeds when history is empty
- returns 500 when runAssistantRequest throws
- uses Brain when brainContext.source is 'brain'
- uses Brain when brainContext.nodeId is set
- uses Brain when brainContext.agentMode is set
- returns 400 when brainContext is set but message is empty
- returns error reply on Brain error event
- calls logAgentExecution with success:true after brain reply
- does NOT call runAssistantRequest for brain-first requests
- meta.durationMs is a non-negative number
- converts history + message into [user, user] for Brain
- prefers direct messages array over history + message
- skips empty-content turns from history
- maps from=assistant to role=assistant

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/assistant/assistant-ask-route.test.ts
```

### `assistant-continuation.test.ts` (unit/integracao (jest))

**Describe:** InternalBrainEngine human continuation

- continues previous topic naturally for 'sim'
- learns previous topic from conversation and explains in humanized flow

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/assistant/assistant-continuation.test.ts
```

### `assistant-conversation.test.ts` (unit/integracao (jest))

**Describe:** InternalBrainEngine conversational mode

- responds casually to greeting without technical blocks
- responds naturally to thanks
- asks for objective input on generic help

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/assistant/assistant-conversation.test.ts
```

### `assistant-messages-humanized.test.ts` (unit/integracao (jest))

**Describe:** assistant fallback messages humanization

- clarify reply uses humanized conversational wording
- repeated reply for brain keeps continuity language

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/assistant/assistant-messages-humanized.test.ts
```

### `createComment.test.ts` (unit/integracao (jest))

**Describe:** buildCommentCreationAction, executeCreateComment

- returns error when ticket is not found
- returns error when user cannot comment
- generates a technical draft for generic comment request
- prepares a comment with the user's own text
- rejects duplicate comment
- returns validation issues for empty body
- rejects missing ticketId
- rejects invalid body
- rejects when ticket not found
- rejects when user can't view ticket
- rejects when user can't comment
- rejects duplicate comment
- creates comment successfully
- returns failure when store returns null

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/assistant/createComment.test.ts
```

### `createTestCase.test.ts` (unit/integracao (jest))

**Describe:** executeCreateTestCase

- rejects users outside the company scope
- rejects invalid drafts before persisting
- blocks exact duplicate titles in the same company
- creates a valid test case record

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/assistant/createTestCase.test.ts
```

### `createTicket.test.ts` (unit/integracao (jest))

**Describe:** buildTicketCreationAction, executeCreateTicket

- rejects user without permission
- asks for content on generic prompt
- returns pending issues for incomplete structured draft
- prepares a valid structured draft with create action
- rejects structured draft with instruction-only title
- asks for more content when narrative is too short
- builds a draft from a narrative with enough content
- rejects user without permission
- rejects invalid draft data
- creates ticket successfully
- returns failure when store returns null

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/assistant/createTicket.test.ts
```

### `getScreenContext.test.ts` (unit/integracao (jest))

**Describe:** toolGetScreenContext

- returns an action-oriented reply without exposing login details
- uses the current company scope and keeps the intro line non-duplicated

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/assistant/getScreenContext.test.ts
```

### `helpers.test.ts` (unit/integracao (jest))

**Describe:** stripAccents, normalizeSearch, normalizeText, normalizePromptText, compactMultiline, formatDateTime, normalizeCommentForComparison, formatValidationIssues, sanitizeRoute

- removes accents from Portuguese text
- leaves ASCII text unchanged
- lowercases and strips accents
- strips accents
- trims whitespace
- returns empty string for non-string input
- trims and collapses whitespace
- truncates to max length
- returns empty string for non-string input
- normalizes lines preserving structure
- converts CRLF to LF
- trims trailing spaces on each line
- trims leading/trailing blank lines
- returns 'sem data' for null/undefined
- returns the raw value for invalid dates
- formats a valid ISO date in pt-BR
- removes accents, punctuation and extra spaces
- lowercases text
- numbers issues starting from 1
- returns empty string for empty array
- prepends / if missing
- keeps a valid route as-is
- returns / for null/undefined
- trims whitespace

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/assistant/helpers.test.ts
```

### `parsing.test.ts` (unit/integracao (jest))

**Describe:** extractTicketReference

- parses SP code references
- parses UUID references
- parses bare numeric references
- returns null when there is no ticket reference

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/assistant/parsing.test.ts
```

### `router.test.ts` (unit/integracao (jest))

**Describe:** chooseTool, isAwaitingTicketPayload, isAwaitingTestCasePayload

- routes empty message to get_screen_context
- routes 'oi' to get_screen_context
- routes 'bom dia' to get_screen_context
- routes 'meu perfil' to summarize_entity
- routes 'resumir meus dados' to summarize_entity
- routes 'explicar meu escopo de acesso' to explain_permission
- routes 'por que não vejo tal tela' to explain_permission
- routes 'ações disponíveis' to list_available_actions
- routes 'o que posso fazer' to list_available_actions
- routes 'gerar caso de teste' to draft_test_case
- routes 'caso de teste montar com base em bug' to draft_test_case
- routes 'comentar no ticket SP-123' to create_comment
- routes 'publicar comentário no chamado 456' to create_comment
- routes 'criar chamado' to create_ticket
- routes 'transformar nota em ticket' to create_ticket
- routes 'abrir suporte' to create_ticket
- routes 'modelo de chamado' to create_ticket
- routes 'buscar chamado' to search_internal_records
- routes 'localizar ticket' to search_internal_records
- routes SP-XXX reference to search_internal_records
- routes 'próximo passo' to suggest_next_step
- falls back to suggest_next_step for unrecognized input
- support module favors search for ambiguous messages
- returns false with empty history
- returns false if last assistant turn is not create_ticket
- returns true when last assistant turn is create_ticket with awaiting text
- returns true for 'complete o modelo' variant
- returns false when last create_ticket turn has no awaiting phrase
- returns false with empty history
- returns true when last turn is draft_test_case awaiting payload
- returns false when tool is not draft_test_case

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/assistant/router.test.ts
```

### `screenContext.test.ts` (unit/integracao (jest))

**Describe:** resolveAssistantScreenContext

- matches /admin/support as support module
- matches /kanban-it as support module
- matches /admin/support/anything nested
- matches /meus-chamados as support module
- matches /admin/users/permissions as permissions module
- matches /empresas/acme/planos-de-teste as test_plans module
- matches /empresas/acme as company module
- matches /admin as dashboard module
- falls back to general for unknown routes
- handles empty string as root
- always returns suggested prompts
- keeps support above dashboard for /admin/support
- keeps permissions above dashboard for /admin/users/permissions
- keeps test_plans above company for /empresas/acme/planos-de-teste

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/assistant/screenContext.test.ts
```

### `service.test.ts` (unit/integracao (jest))

**Describe:** routing, low-signal detection, repeat guard, tool action dispatch, audit logging, reply structure

- routes empty message as low-signal (clarify)
- routes short greeting as low-signal (clarify)
- routes 'mostrar contexto atual' to get_screen_context
- routes 'criar chamado' to create_ticket
- routes 'buscar chamado SP-123' to search_internal_records
- routes 'explicar meu escopo de acesso' to explain_permission
- routes 'gerar caso de teste' to draft_test_case
- resolves context from route correctly
- returns clarify reply for very short ambiguous input
- returns clarify reply for single digit
- does NOT clarify when awaiting ticket payload
- short-circuits exact repeated prompt to same tool
- does NOT short-circuit when message differs
- dispatches create_ticket action to executor
- returns error for unsupported tool action
- logs every request to audit
- logs tool actions with actionType 'tool'
- does not crash when audit fails
- always includes tool, reply, and context
- context reflects the resolved route
- sanitizes missing route to /
- prioritizes authenticated user company context over route slug
- uses actor company context when user has no bound company

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/assistant/service.test.ts
```

### `ticketHelpers.test.ts` (unit/integracao (jest))

**Describe:** parseStructuredTicketDraft, inferTicketType, inferTicketPriority, buildTicketTitle, buildTicketDescription, buildStructuredTicketDescription, extractNarrativePayload, extractTicketNarrativeSource, isTicketTemplateRequest, isGenericTicketPrompt

- returns null for plain text without named fields
- parses a complete structured draft
- parses with accented field names (Título, Descrição)
- parses priority 'media' as medium
- parses priority 'baixa' as low
- parses type 'melhoria'
- parses type 'tarefa'
- handles multiline description
- returns null type/priority when not provided
- detects 'bug' keyword → bug
- detects 'erro' keyword → bug
- detects 'falha' keyword → bug
- detects 'melhoria' keyword → melhoria
- detects 'sugestão' → melhoria
- defaults to tarefa for test_plans module
- defaults to tarefa for unrecognized text
- detects 'urgente' → high
- detects 'critico' → high
- detects 'bloqueia' → high
- detects 'não abre' → high
- detects 'baixa' → low
- detects 'simples' → low
- defaults to medium
- strips action verbs and ticket keywords
- takes only the first sentence
- falls back to context label when message is empty after cleaning
- truncates to 110 chars
- includes screen label and route
- includes the user message
- truncates to 1900 chars max
- includes description, impact, and behavior fields
- handles missing optional fields
- extracts payload from 'converter esta nota ... em chamado'
- extracts payload from 'nota: ...' pattern
- returns empty string when no pattern matches
- strips action verbs and noise words
- preserves actual content
- returns true for 'modelo de chamado'
- returns true for 'modelo de ticket'
- returns true for structured field reference
- returns false for regular text
- returns true for exact generic phrases
- returns false for text with actual content
- is case-insensitive via normalizeSearch

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/assistant/ticketHelpers.test.ts
```

### `validations.test.ts` (unit/integracao (jest))

**Describe:** normalizeTicketTypeInput, normalizeTicketPriorityInput, looksLikeInstructionOnly, validateAssistantTicketDraft, validateAssistantCommentBody, validateAssistantTestCaseDraft

- returns null for unknown type
- returns null for empty string
- returns null for unknown priority
- returns true for empty string
- returns true for exact instruction strings
- returns true for partial instruction patterns
- returns false for real content
- returns false for descriptive text
- accepts a valid draft
- rejects missing title
- rejects title that is too short
- rejects missing description
- rejects instruction-only title
- rejects invalid type
- rejects invalid priority
- defaults type to tarefa when omitted
- defaults priority to medium when omitted
- accepts valid comment body
- rejects empty comment
- rejects instruction-only comment
- normalizes non-string input
- accepts a valid test case draft
- rejects missing sourceTitle
- rejects short objective
- rejects missing reproductionBase
- rejects instruction-only sourceTitle

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/assistant/validations.test.ts
```

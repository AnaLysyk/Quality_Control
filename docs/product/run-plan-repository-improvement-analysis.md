# Análise — Repositório, Plano de Teste e Run

## Diagnóstico direto

O Quality Control já tem a regra conceitual correta:

```txt
Empresa -> Projeto -> Repositório de Casos -> Plano de Teste -> Run -> Run Item -> Resultado/Evidência/Defeito
```

O problema é que a Run ainda está descrita em nível mínimo e a implementação atual tende a funcionar como integração/listagem de Qase, não como motor operacional próprio.

A Run precisa virar uma entidade forte, auditável, executável, filtrável, mensurável e integrável.

## O que já está certo hoje

### Repositório de Casos

O modelo já define que o repositório é a fonte oficial dos casos do projeto.

Regras já corretas:

- Caso pertence a um projeto.
- Plano só usa casos do mesmo projeto.
- Caso automatizado precisa manter vínculo com script ou suíte técnica.
- Caso tem status de automação.

### Plano de Teste

O modelo já define que o plano seleciona casos do repositório para release, ciclo, regressão ou validação.

Regras já corretas:

- Plano só aceita casos do mesmo projeto.
- Plano precisa guardar snapshot/versionamento dos casos selecionados.
- Run só pode nascer a partir de um plano.

### Run / Execução

O modelo já define que:

- Run sem plano deve ser bloqueada.
- Cada caso do plano vira um item de run.
- Cada item registra responsável, status, início, fim, duração e evidência quando houver falha.

## Lacuna principal

A Run ainda precisa deixar de ser apenas:

```txt
Título + descrição + plan_id + retorno do Qase
```

E passar a ser:

```txt
Execução operacional controlada
  -> com escopo congelado
  -> responsáveis
  -> ciclo de vida
  -> itens executáveis
  -> tentativas
  -> evidência
  -> defeito
  -> auditoria
  -> integração Qase opcional
  -> métricas por projeto/plano/pessoa
```

## Fluxo recomendado de produto

### 1. Repositório de Casos

O repositório é onde o caso vive.

Campos fortes do caso:

```txt
caseId
companyId
projectId
repositoryId
suiteId / folderId
key
version
status
priority
severity
risk
type
source
automationStatus
automationScriptId
qaseCaseId
lastExecutionStatus
lastExecutedAt
createdBy
updatedBy
createdAt
updatedAt
```

Campos fortes de passo:

```txt
stepId
caseId
order
action
expectedResult
testData
notes
attachments
```

Melhorias necessárias:

- Tree de suíte/pasta/módulo.
- Versionamento real do caso.
- Histórico de alteração do caso.
- Flag de impacto quando caso muda depois de entrar em plano.
- Estado de automação integrado com script.
- Campo de origem externa: manual, Qase, importação, automação, Brian.

### 2. Plano de Teste

Plano não é execução. Plano é intenção/escopo.

Campos fortes do plano:

```txt
planId
companyId
projectId
title
description
releaseId
milestoneId
cycleType: regression | smoke | acceptance | exploratory | release | hotfix | custom
status: draft | ready | approved | archived
ownerId
startTargetDate
endTargetDate
environment
buildVersion
scopeSummary
outOfScope
entryCriteria
exitCriteria
riskNotes
createdBy
approvedBy
createdAt
updatedAt
```

Campos fortes de item do plano:

```txt
planCaseId
planId
caseId
caseVersion
suitePath
priority
executionOrder
assignedRole
estimatedMinutes
isRequired
source: manual | filter | tag | qase | brian
```

Melhorias necessárias:

- Criar plano por seleção manual, filtro, tag, suite, risco ou sugestão do Brian.
- Snapshot dos casos selecionados.
- Ordenação dos casos.
- Estimativa de tempo por caso/plano.
- Cobertura do plano versus repositório.
- Critério de entrada e saída.
- Aprovação do plano antes de iniciar run crítica.

### 3. Run / Execução

Run é uma instância executável de um plano.

Campos fortes da Run:

```txt
runId
companyId
projectId
planId
planSnapshotId
title
description
runType: manual | automated | hybrid | assisted_by_brian
status: draft | scheduled | in_progress | paused | completed | cancelled | aborted
source: local | qase | playwright | brian | import
qaseRunId
qaseProjectCode
releaseId
milestoneId
environment
buildVersion
browser
platform
device
startedAt
finishedAt
durationSeconds
createdBy
runOwnerId
closedBy
cancelReason
summary
```

Campos calculados da Run:

```txt
totalItems
notRunCount
passedCount
failedCount
blockedCount
skippedCount
retestCount
passRate
failRate
blockedRate
progressPercent
defectsOpened
defectsLinked
evidenceCount
estimatedMinutes
actualMinutes
varianceMinutes
```

Ações obrigatórias da Run:

```txt
Criar a partir de plano
Gerar itens a partir do snapshot do plano
Atribuir responsável geral
Atribuir responsáveis por item
Iniciar run
Pausar run
Retomar run
Finalizar run
Cancelar run
Reabrir run com justificativa
Exportar relatório
Sincronizar com Qase quando habilitado
```

### 4. Run Item

Run Item é o coração da execução.

Campos fortes:

```txt
runItemId
companyId
projectId
planId
runId
caseId
caseVersion
caseKey
caseTitle
suitePath
assigneeId
executorId
executionType: manual | automated | assisted_by_brian
status: not_run | in_progress | passed | failed | blocked | skipped | retest
previousStatus
startedAt
finishedAt
durationSeconds
estimatedMinutes
attemptNumber
lastAttemptId
blockedReason
skipReason
failureReason
actualResult
expectedResultSnapshot
notes
defectId
evidenceIds
automationScriptId
automationRunId
qaseResultId
qaseCaseId
qaseRunId
updatedBy
updatedAt
```

Ações obrigatórias do Run Item:

```txt
Atribuir executor
Iniciar execução do item
Marcar passed
Marcar failed
Marcar blocked
Marcar skipped
Enviar para reteste
Adicionar evidência
Adicionar nota
Criar defeito a partir do item
Vincular defeito existente
Executar automação vinculada
Sincronizar resultado no Qase
```

Regras importantes:

- `failed` deve exigir motivo, resultado atual ou evidência.
- `blocked` deve exigir motivo de bloqueio.
- `skipped` deve exigir motivo quando o caso for obrigatório.
- `passed` pode aceitar evidência opcional.
- Toda mudança de status cria histórico.
- Não pode finalizar Run com item obrigatório `not_run`, salvo com exceção justificada.

### 5. Tentativa / Histórico de execução

Sem tentativa, a run perde auditoria.

Campos de tentativa:

```txt
attemptId
runItemId
attemptNumber
status
executorId
startedAt
finishedAt
durationSeconds
actualResult
failureReason
blockedReason
attachments
evidenceIds
defectIds
automationOutput
createdAt
```

Uso:

- Primeira execução falhou.
- Depois corrigiu bug.
- Reteste passou.
- O run item atual fica `passed`, mas o histórico mostra tentativa 1 failed e tentativa 2 passed.

### 6. Evidência

Evidência deve ser entidade própria.

Campos:

```txt
evidenceId
companyId
projectId
runId
runItemId
caseId
defectId
type: image | video | log | file | link | text | api_response | console | trace
name
url
storageKey
contentPreview
createdBy
createdAt
```

A evidência precisa ser reutilizável:

```txt
run item -> defeito -> relatório -> Brian -> Qase
```

### 7. Defeito vindo da Run

Defeito criado da Run já deve nascer preenchido.

Campos herdados:

```txt
companyId
projectId
runId
runItemId
caseId
caseTitle
planId
environment
buildVersion
actualResult
expectedResultSnapshot
evidenceIds
executorId
```

Ação esperada:

```txt
Criar defeito a partir de falha
  -> já leva título sugerido
  -> descrição
  -> passos do caso
  -> esperado
  -> atual
  -> evidências
  -> vínculo com run item
```

### 8. Integração com Qase

Se a empresa escolher `sendEverythingToQase`, a Run precisa sincronizar:

```txt
Plano -> plan_id Qase quando existir
Run -> Qase Run
Run Items -> Qase Results
Defeitos -> Qase defects / external issue
Evidências -> attachments / links
Automação -> is_autotest / status
```

A integração Qase deve funcionar nos dois sentidos:

```txt
Importar do Qase
  -> projetos
  -> suites
  -> casos
  -> planos/runs
  -> responsáveis

Enviar para Qase
  -> runs criadas localmente
  -> resultados
  -> defeitos/evidências quando habilitado
```

## Comparativo com produtos maduros

### Qase

Pontos que devemos copiar/melhorar:

- Run pertence a um projeto Qase.
- Run pode ter `plan_id`.
- Run pode incluir todos os casos ou uma lista de casos.
- Run pode ter ambiente, milestone, tags, configurações e custom fields.
- Consulta de runs permite filtrar por status, milestone, environment, período e incluir casos/defeitos/external issue.

### TestLink

Pontos que devemos copiar/melhorar:

- Test Project é unidade organizacional.
- Test Specification organiza suites e casos.
- Test Plan é a unidade base para executar testes.
- Test Plan tem builds, milestones, responsáveis e resultados.
- Plano precisa descrever escopo, fora de escopo, ambiente, critérios, riscos e referências.

### Documentação padrão de teste

Pontos que devemos copiar/melhorar:

- Test log precisa registrar quais casos foram executados, por quem, em que ordem e se passaram ou falharam.
- Anomaly/defect report precisa ter esperado, atual, momento da falha, evidência e impacto.
- Relatório final precisa resumir resultado, avaliação e qualidade da execução.

## Melhorias prioritárias

### P0 — Modelo correto

- Criar entidade local `TestRun`.
- Criar entidade local `TestRunItem`.
- Criar entidade local `RunItemAttempt`.
- Criar entidade local `Evidence`.
- Criar entidade local `TestPlanSnapshot`.

### P0 — Bloqueios de regra

- API não cria run sem `planId`.
- UI não mostra botão `Criar run` fora do plano.
- Run gera item para cada caso do snapshot do plano.
- Failed/blocked exigem nota/evidência/motivo.
- Run só finaliza se todos obrigatórios estiverem executados ou justificados.

### P1 — UX de Run

Tela da Run precisa ter:

```txt
Cabeçalho
  Nome da run
  Plano origem
  Projeto
  Ambiente
  Build
  Responsável
  Status
  Progresso
  Tempo estimado x real

Cards de resumo
  Total
  Passou
  Falhou
  Bloqueado
  Não executado
  Skipped
  Reteste
  Defeitos
  Evidências

Tabela de itens
  Ordem
  Caso
  Suite/módulo
  Prioridade
  Responsável
  Status
  Tempo
  Defeito
  Evidência
  Ações

Painel lateral do item
  Passos do caso
  Esperado
  Resultado atual
  Evidências
  Histórico de tentativas
  Defeitos vinculados
  Comentários
```

### P1 — Filtros de Run

Filtros obrigatórios:

```txt
status
responsável
suite/módulo
prioridade
falhou
bloqueado
sem evidência
com defeito
sem defeito
automatizado/manual
not_run
reteste
```

### P1 — Brian

Comandos que o Brian deve operar:

```txt
Criar run do plano X
Atribuir run para pessoa Y
Marcar caso X como passed
Marcar caso X como failed com motivo Y
Criar defeito da falha X
Adicionar evidência ao item X
Resumo da run
O que falta executar?
Quais bloqueados?
Quais falhas sem defeito?
Quais casos demoraram mais?
Finalizar run se estiver tudo ok
```

### P1 — Qase completo

Se `qaseSyncMode = everything`:

- Criar run local e Qase run.
- Guardar `qaseRunId`.
- Enviar resultado do run item ao Qase.
- Guardar `qaseResultId`.
- Enviar/linkar defeitos e evidências conforme suporte da API.
- Mostrar status de sincronização por item.

Campos de sync por item:

```txt
qaseSyncStatus: pending | synced | failed | skipped
qaseSyncError
qaseSyncedAt
qaseResultId
```

## Tela ideal da Run

### Aba 1 — Visão geral

- Progresso da execução.
- Taxa de aprovação.
- Tempo estimado x real.
- Falhas por severidade.
- Bloqueios por motivo.
- Top responsáveis por execução.
- Risco da release.

### Aba 2 — Itens da execução

- Tabela principal.
- Execução inline.
- Bulk action.
- Filtro rápido.
- Painel lateral.

### Aba 3 — Evidências

- Galeria por item.
- Logs e vídeos.
- API responses.
- Traces Playwright.

### Aba 4 — Defeitos

- Defeitos gerados pela run.
- Status dos defeitos.
- Falhas sem defeito.
- Defeitos sem evidência.

### Aba 5 — Histórico

- Timeline da run.
- Quem iniciou.
- Quem alterou status.
- Quem anexou evidência.
- Quem reabriu/finalizou.

### Aba 6 — Qase

- Qase project.
- Qase run id.
- Sync mode.
- Sync status geral.
- Itens pendentes de sync.
- Erros de envio.
- Botão reenviar falhas.

## Resultado esperado

A Run deve responder sozinha:

```txt
O que foi planejado?
O que foi executado?
Quem executou?
Quando executou?
Quanto tempo levou?
O que passou?
O que falhou?
O que bloqueou?
Qual evidência prova?
Qual defeito nasceu?
O que foi enviado ao Qase?
O que falta para finalizar?
Qual risco para release?
```

## Próximo corte de implementação

1. Criar `data/runOperationModel.ts` com tipos e regras da Run.
2. Criar endpoint local `/api/quality/runs`.
3. Criar endpoint `/api/quality/runs/[id]/items/[itemId]/result`.
4. Criar tela `/runs/[id]` com visão de execução.
5. Alterar `/api/v1/runs` para virar adaptador Qase, não fonte única.
6. Criar sync Qase por item.
7. Brian usar o endpoint local primeiro e Qase como integração externa.

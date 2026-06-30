# Modelo de notificacoes

## Base do desenho

Sistemas de notificacao precisam separar evento, preferencia e entrega.

```txt
Evento
  -> registra o que aconteceu

Preferencia
  -> define se empresa, perfil ou usuario quer receber

Entrega
  -> cria recebimento em in-app, email, push, chat ou Brain
```

## Regra principal

```txt
Tudo deve gerar evento.
Nem tudo precisa ser entregue ao usuario.
```

Se a empresa desativou recebimento, o evento continua registrado. A entrega pode ser suprimida e o Brain continua com contexto operacional.

Se o perfil ou usuario desativou recebimento, o evento tambem continua registrado. A auditoria deve guardar quem seria notificado e por qual motivo nao recebeu.

Se o evento e critico, empresa, perfil e usuario nao bloqueiam.

## Ordem de decisao

```txt
1. Padrao do evento
2. Preferencia da empresa
3. Preferencia do perfil
4. Preferencia do usuario
5. Regra obrigatoria para evento critico
```

## Canais

```txt
in_app
email
push
chat
brain
```

## Eventos iniciais

```txt
RUN_CREATED
TEST_FAILED
DEFECT_ASSIGNED
CHAT_MENTION
BRAIN_MEMORY_CANDIDATE
RELEASE_CALENDAR_CRITICAL
RELEASE_CALENDAR_RISK
RELEASE_CALENDAR_BLOCKED
USER_ACCESS_UPDATED
PASSWORD_RESET_REQUEST
```

## Motivos de decisao

```txt
delivered
suppressed_by_company
suppressed_by_profile
suppressed_by_user
mandatory_override
```

## Arquitetura recomendada

```txt
NotificationEvent
  id
  eventType
  category
  criticality
  mandatory
  companyId/companySlug
  projectId/projectSlug
  actorId
  sourceType/sourceId
  payload
  createdAt

NotificationDelivery
  id
  eventId
  userId
  channel
  status
  decision
  decisionReason
  createdAt
  deliveredAt
  readAt

NotificationPreference
  target: company | profile | user
  targetId
  workflowId
  channel
  decision: enabled | disabled
  updatedBy
  updatedAt
```

## Ligacao com agenda de release

```txt
Criar evento critico na agenda
  -> RELEASE_CALENDAR_CRITICAL
  -> gera NotificationEvent
  -> cria NotificationDelivery para ator e Brain

Mudar evento para at_risk
  -> RELEASE_CALENDAR_RISK
  -> gera NotificationEvent
  -> calcula delivered/suppressed por canal
  -> Brain recebe contexto

Mudar evento para blocked
  -> RELEASE_CALENDAR_BLOCKED
  -> gera NotificationEvent obrigatorio
  -> Brain recebe contexto
```

## Implementado nesta camada

```txt
data/notificationOperationModel.ts
lib/notificationPreferencesStore.ts
lib/notificationEventsStore.ts
app/api/notification-model/route.ts
app/notificacoes/page.tsx
app/notificacoes/_components/NotificationOperationPanel.tsx
```

## O que ja funciona

```txt
Catalogo de workflows de notificacao
Preferencias por empresa, perfil e usuario
Resolver delivered/suppressed por canal
Criar NotificationEvent auditavel
Criar NotificationDelivery por destinatario/canal
Expor eventos e entregas no GET /api/notification-model
Agenda de release gerando evento critico, risco e bloqueio
UI /notificacoes exibindo eventos reais e entregas por canal
Resumo de delivered/suppressed na central de notificacoes
UI /notificacoes permite ativar/desativar canal por empresa, perfil ou usuario
UI /notificacoes lista preferencias cadastradas
```

## Proxima implementacao tecnica

1. Adaptar createUserNotification para passar por resolveNotificationDeliveryDecision.
2. Fazer Brain responder por que alguem recebeu ou nao recebeu.
3. Integrar eventos de conversa, run, caso, defeito e acesso.
4. Persistir NotificationEvent e NotificationDelivery no banco real.
5. Criar filtros avancados na central de notificacoes.

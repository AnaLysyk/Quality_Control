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

## Implementado nesta camada

```txt
data/notificationOperationModel.ts
lib/notificationPreferencesStore.ts
app/api/notification-model/route.ts
app/notificacoes/page.tsx
app/notificacoes/_components/NotificationOperationPanel.tsx
```

## Proxima implementacao tecnica

1. Criar NotificationEvent real no Prisma ou store persistente.
2. Criar NotificationDelivery real por destinatario/canal.
3. Adaptar createUserNotification para passar por resolveNotificationDeliveryDecision.
4. Criar UI para empresa desligar recebimento por categoria/canal.
5. Criar UI para perfil/usuario desligar recebimento nao critico.
6. Fazer Brain responder por que alguem recebeu ou nao recebeu.
7. Integrar eventos de conversa, run, caso, defeito e acesso.

# Agenda operacional de release

## Objetivo

A agenda nao deve ser apenas um calendario visual. Ela deve ser o ponto unico para controlar entrega de release, janela de QA, freeze, homologacao, riscos, responsaveis, notificacoes e memoria do Brain.

## Regra principal

```txt
Toda release precisa ter uma linha do tempo operacional.
Toda linha do tempo precisa ter eventos claros.
Todo evento pode gerar notificacao e contexto para o Brain.
```

## Eventos da agenda

```txt
discovery
scope_cut
dev_freeze
qa_window
bug_bash
uat
release_candidate
release
post_release
```

## Status

```txt
planned
at_risk
blocked
done
cancelled
```

## Modelo recomendado

```txt
ReleaseCalendarEvent
  id
  title
  type
  status
  criticality
  companyId/companySlug/companyName
  projectId/projectSlug
  releaseId/releaseName
  startAt/endAt
  ownerId/ownerName
  description
  checklist
  notificationRules
  brianRules
```

## Fluxo ideal

```txt
Empresa
  -> Projeto
    -> Release
      -> Agenda
        -> Corte de escopo
        -> Freeze
        -> Janela de QA
        -> Homologacao
        -> Entrega
        -> Pos-release
```

## Ligacao com notificacoes

A agenda deve conversar com o modelo de notificacoes:

```txt
Evento da agenda criado
  -> gera NotificationEvent
  -> resolve entrega por empresa/perfil/usuario
  -> cria NotificationDelivery quando aplicavel
  -> registra supressao quando a entrega foi bloqueada
  -> envia contexto para o Brain
```

## Ligacao com Brain

O Brain precisa conseguir responder:

```txt
O que entrega esta semana?
Qual release esta em risco?
O que falta para liberar a release?
Quais bugs bloqueiam a janela de QA?
Quem precisa ser avisado?
Por que a release atrasou?
Qual foi a decisao de go/no-go?
```

## Ligacao com operacao QA

A agenda tambem precisa se conectar com:

```txt
Plano de teste
Run
Run items
Casos reprovados
Defeitos
Chamados
Evidencias
Metricas
```

## Implementado nesta camada

```txt
data/releaseCalendarModel.ts
lib/releaseCalendarStore.ts
app/api/release-calendar/route.ts
app/agenda/page.tsx
app/agenda/_components/ReleaseCalendarPanel.tsx
```

## Proxima implementacao tecnica

1. Persistir ReleaseCalendarEvent em banco real.
2. Criar formulario para cadastrar release/evento.
3. Conectar evento da agenda com NotificationEvent real.
4. Criar filtros por empresa, projeto, release e status.
5. Conectar janela de QA com plano e runs.
6. Fazer Brain gerar resumo semanal de entregas.
7. Fazer Brain alertar release em risco.

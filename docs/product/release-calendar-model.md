# Agenda operacional de release

## Objetivo

A agenda nao deve ser apenas um calendario visual. Ela deve ser o ponto unico para controlar entrega de release, janela de QA, freeze, homologacao, riscos, responsaveis, notificacoes e memoria do Brain.

A mesma agenda tambem atende Lider TC e Suporte Tecnico, com uma visao consolidada por empresa, projeto, usuario, contexto e perfil. A ideia e enxergar horarios e marcacoes de todos sem transformar o calendario em uma montoeira de informacao.

## Regra principal

```txt
Toda release precisa ter uma linha do tempo operacional.
Toda linha do tempo precisa ter eventos claros.
Todo evento pode gerar notificacao e contexto para o Brain.
Lider TC e Suporte Tecnico podem filtrar a agenda sem trocar manualmente de empresa.
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

## Contextos de marcacao

```txt
company   -> marcacao da empresa
project   -> marcacao do projeto
user      -> marcacao ligada a usuario/responsavel
TC        -> contexto interno da Testing Company
support   -> contexto de suporte tecnico
release   -> contexto geral da release
delivery  -> entrega/publicacao
```

## Publico-alvo da marcacao

```txt
all
empresa
company_user
testing_company_user
leader_tc
technical_support
release_actor
brain
```

## Modelo recomendado

```txt
ReleaseCalendarEvent
  id
  title
  type
  status
  criticality
  context
  markerLabel
  audienceProfiles
  companyId/companySlug/companyName
  projectId/projectSlug
  releaseId/releaseName
  startAt/endAt
  ownerId/ownerName
  participantNames
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

## Visao Lider TC e Suporte Tecnico

```txt
Calendario consolidado
  -> filtros por empresa, projeto, usuario, release, contexto, perfil e status
  -> atalhos de visao Lider TC e Suporte Tecnico
  -> cards compactos por dia com ate 3 marcacoes visiveis
  -> contador de marcacoes excedentes
  -> clique no dia abre detalhes das marcacoes
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

## O que ja funciona na tela

```txt
Visualizar calendario compacto por dia
Clicar no dia para abrir marcacoes
Filtrar por empresa, projeto, usuario, release, contexto, perfil e status
Usar atalho de visao Lider TC
Usar atalho de visao Suporte Tecnico
Cadastrar marcacao de calendario pela UI
Salvar evento via POST /api/release-calendar
Atualizar timeline apos cadastro
Alterar status pela UI via PATCH /api/release-calendar
Mostrar checklist, notificacoes e regras do Brain por evento
```

## Proxima implementacao tecnica

1. Persistir ReleaseCalendarEvent em banco real.
2. Conectar evento da agenda com NotificationEvent real.
3. Gerar notificacao automatica ao criar evento critico.
4. Conectar janela de QA com plano e runs.
5. Fazer Brain gerar resumo semanal de entregas.
6. Fazer Brain alertar release em risco.

# Conversas unificadas por empresa, perfil e Brain

## Objetivo

Todas as conversas da plataforma devem funcionar por um unico lugar, sem criar chats paralelos por modulo. A conversa pode ser entre usuarios, empresa, suporte, QA, lideranca ou perfis internos, mas sempre deve carregar contexto suficiente para alimentar o Brain.

## Regra principal

```txt
Usuario conversa em /chat
  -> mensagem salva no store unico de chat
  -> mensagem carrega contexto de empresa/projeto/perfil quando disponivel
  -> mensagem relevante vira candidato de memoria do Brain
  -> /conversas mostra o hub e o feed do Brain
```

## Perfis e visibilidade

```txt
Leader TC / Admin / Suporte tecnico
  -> ve todos os contatos e conversas permitidas globalmente

Empresa / Company user
  -> ve usuarios da empresa vinculada

Testing Company user
  -> ve conforme empresa/projeto ativo e permissao
```

## Contexto minimo da mensagem

```txt
messageId
threadKey
senderId
recipientId
companyId
companySlug
companyName
projectId
projectSlug
profileKind
text
createdAt
sourceType: chat_message
```

## Como conversa alimenta o Brain

A mensagem vira candidata de memoria quando tiver sinal de:

```txt
combinado
decisao
regra
lembrar
pendencia
bloqueio
bug
defeito
caso de teste
plano
run
automacao
reprovar/aprovar
```

Tambem pode ser forçada pelo front/API usando:

```json
{
  "remember": true
}
```

ou

```json
{
  "feedBrain": true
}
```

## Rotas implementadas

```txt
/conversas
/chat
/api/chat/messages
/api/chat/brain-feed
```

## Arquivos implementados

```txt
data/unifiedConversationModel.ts
lib/conversationBrainFeed.ts
app/api/chat/brain-feed/route.ts
app/conversas/_components/UnifiedConversationsHub.tsx
app/conversas/page.tsx
app/api/chat/messages/route.ts
```

## Proximo passo

1. Adicionar botao "Brian, lembrar" em cada mensagem do chat.
2. Permitir aprovar/ignorar candidato de memoria.
3. Converter candidato aprovado em `BrainMemory` real.
4. Criar filtros por empresa/projeto na UI.
5. Vincular conversa a chamado, defeito, caso, plano ou run.

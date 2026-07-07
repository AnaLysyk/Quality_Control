# Mudança de lógica de contexto

## Antes
O contexto de perfil, empresa e projeto estava distribuído entre hooks, rotas e stores.

## Depois
A entrega passa a consolidar o contrato operacional para backend-first: empresa ativa, projeto ativo, permissões efetivas, chat, tickets, dashboards e Brain devem sempre respeitar o mesmo escopo.

## Motivação
Fechar as regras #176, #177, #178, #179, #180 e #181.

## Perfis afetados
Líder TC, Suporte Técnico, Usuário TC, Empresa e Usuário empresarial.

## Telas afetadas
Projetos, Aplicações, Tickets, Chat, Dashboard, Brain e Gestão de usuários.

## Riscos
Regressão de menu, API aberta fora do escopo, cache respondendo dados de outro contexto e rotas legadas divergindo do contrato.

## Testes
Validar com `npm run test`, `npm run test:e2e:access` e `npm run test:e2e:dashboards`.

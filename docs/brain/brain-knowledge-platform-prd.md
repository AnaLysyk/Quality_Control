# Brain - Plataforma de Inteligencia e Conhecimento

## Objetivo

Separar o Brain em dois produtos complementares:

- Brain Assistente: copiloto lateral que conversa, explica telas, navega e executa acoes.
- Brain Graph: Knowledge Graph visual em `/brain`, inspirado no Obsidian, usando React Flow.

Os dois produtos devem compartilhar a mesma base de conhecimento, memoria, contexto e RBAC.

## Escopo Do Brain Graph

Tudo que representa uma entidade do sistema pode virar no:

- Empresa, usuario, perfil, permissao, grupo, projeto e cliente.
- Solicitacao, workflow, tela, menu, componente, botao e campo.
- API, endpoint, banco, tabela, coluna e modelo Prisma.
- Documento, manual, repositorio, branch, commit, PR, release e deploy.
- Teste manual, teste automatizado, caso de teste, bug, defeito, sprint e melhoria.
- Dashboard, indicador, auditoria, log, notificacao, evento, integracao, automacao, script, ambiente, fila e webhook.

Cada linha do grafo deve representar um relacionamento real, como `BELONGS_TO`, `MEMBER_OF`, `HAS_PROFILE`, `GRANTS_ACTION`, `CALLS_API`, `USES_MODEL` ou `DOCUMENTED_BY`.

## Comportamento Esperado

- Busca global por nome, email, empresa, endpoint, bug, caso de teste, documento, workflow, API, repositorio, release, deploy, permissao e perfil.
- Filtros por tipo de entidade, com agrupamento por negocio, identidade, acesso, qualidade, sistema, entrega, conhecimento e operacao.
- Zoom, pan, mini mapa, foco, centralizacao, expansao progressiva e recolhimento de contexto.
- Painel lateral com resumo, propriedades, relacionamentos, historico, permissoes, links rapidos, acoes disponiveis e documentacao relacionada.
- Memoria de ultimos nos visitados, pesquisas, filtros, empresas, usuarios e bugs.

## Fluxo Assistente + Graph

1. Usuario pergunta ao Brain Assistente.
2. Assistente interpreta a intencao.
3. Assistente le contexto da tela atual.
4. Assistente consulta o Brain Graph via RAG.
5. Assistente consulta documentacao e permissoes.
6. Assistente monta resposta com evidencias.
7. Assistente executa acao quando permitido e pede confirmacao para acoes sensiveis.

## Contexto De Permissao

O grafo deve permitir responder perguntas como:

- Quem pode aprovar solicitacoes?
- Qual perfil concede acesso a empresas?
- Quais usuarios perderiam acesso se uma permissao fosse removida?
- Quais telas e endpoints dependem de uma permissao?

Modelo inicial:

- `Usuario -> HAS_PROFILE -> Perfil`
- `Perfil -> GRANTS_MODULE_ACCESS -> Modulo de permissao`
- `Perfil -> GRANTS_ACTION -> Acao de permissao`
- `Modulo funcional -> GOVERNS_ACCESS -> Modulo de permissao`

## Fases De Implementacao

1. Consolidar taxonomia oficial de nos, arestas e filtros do Graph.
2. Ligar usuarios, perfis e permissoes no sync do Brain.
3. Enriquecer painel lateral com secoes contextuais por tipo de no.
4. Criar busca global com centralizacao automatica no grafo.
5. Adicionar memoria local do Graph para pesquisas e nos recentes.
6. Criar adapters de conhecimento para documentos, OpenAPI, repositorios e auditoria.
7. Fazer o Assistente consultar o Graph como fonte primaria antes de responder.
8. Adicionar testes de contrato para sincronizacao e RBAC do Knowledge Graph.


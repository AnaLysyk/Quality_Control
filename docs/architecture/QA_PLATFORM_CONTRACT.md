# QA Platform Contract — Painel QA

## Objetivo

Este documento define o contrato funcional e técnico da plataforma Painel QA.

Nenhuma IA, pessoa ou automação deve implementar, remover ou reorganizar partes do sistema sem respeitar este contrato.

O foco atual é fazer a operação manual de QA funcionar de forma limpa, segura e integrada ao Brian.

Fluxo funcional prioritário:

Flow → Caso de Teste → Step → Data Element → Plano de Teste → Execução → Resultado → Defeito → Brian → Assistente

---

## Prioridade atual

A prioridade da plataforma agora é:

1. Empresas conseguirem criar e gerenciar usuários próprios.
2. Empresas conseguirem criar casos de teste manuais.
3. Empresas conseguirem criar planos de teste.
4. Empresas conseguirem vincular casos de teste aos planos.
5. Empresas conseguirem executar planos de teste.
6. Resultados de execução refletirem no histórico dos casos.
7. Brian enxergar empresas, usuários, casos, planos, execuções, defeitos e tickets.
8. Assistente IA responder usando o Brian, sempre respeitando permissões.

Fora de escopo por enquanto:

- Playwright renderizado dentro da plataforma.
- Novas automações complexas.
- Redesenho visual completo.
- Recriação de telas já existentes.
- Refatoração grande sem inventário prévio.

---

## Papéis oficiais

### Suporte Técnico Testing Company

Cuida da saúde técnica do sistema.

Pode visualizar logs, falhas, integrações, status de serviços e dados necessários para suporte técnico.

Não deve operar qualidade em nome da empresa cliente, exceto quando autorizado.

### Líder TC

É o gestor operacional da Testing Company.

Pode criar usuários TC, criar empresas, vincular instituições, entidades e configurar acessos globais.

Pode administrar permissões macro da plataforma.

### Admin da Empresa Cliente

É usuário da empresa cliente.

Pode criar usuários dentro da própria empresa.

Pode gerenciar operação de QA da própria empresa, conforme permissões.

Não pertence ao núcleo da Testing Company.

### Usuário QA da Empresa Cliente

Pode criar, editar e executar casos de teste, planos de teste, execuções, defeitos e evidências conforme permissões atribuídas.

### Viewer ou Auditor da Empresa Cliente

Pode visualizar informações autorizadas da própria empresa.

Não pode alterar dados operacionais, salvo permissão explícita.

---

## Regra de escopo

Todo dado operacional deve pertencer a uma empresa.

Entidades operacionais devem ter vínculo claro com:

- companyId
- createdByUserId
- updatedByUserId quando aplicável
- visibilityScope quando aplicável
- status
- histórico/auditoria quando aplicável

Nenhum usuário de uma empresa pode visualizar dados de outra empresa sem permissão explícita.

Nenhum assistente IA pode ignorar permissões.

Nenhum endpoint pode confiar apenas na tela para proteger dados.

A proteção precisa existir no backend.

## Separação entre Testing Company e empresa cliente

Testing Company administra a plataforma, suporte, operação técnica, integrações globais e governança macro.

A empresa cliente administra seus próprios usuários, casos, planos, execuções, defeitos, evidências e dados operacionais.

Usuários da Testing Company não devem operar qualidade em nome da empresa cliente sem autorização explícita.

Usuários da empresa cliente não devem acessar dados de outra empresa cliente.

Toda regra sensível precisa ser validada no backend, não apenas na tela.

---

## Fluxo manual oficial

O fluxo manual principal é:

Flow → Caso de Teste → Step → Data Element → Plano de Teste → Execução → Resultado → Defeito → Brian → Assistente

### Flow

Um Flow representa um fluxo de negócio ou fluxo de teste.

Um Flow pertence a uma empresa quando for operacional.

Um Flow pode agrupar vários casos de teste.

### Caso de Teste

Um caso de teste pertence a uma empresa.

Pode conter:

- título
- descrição
- pré-condições
- passos
- resultado esperado
- prioridade
- tipo
- status
- tags
- histórico
- evidências
- defeitos vinculados

### Step

Um Step representa um passo do caso de teste.

Cada Step deve manter:

- ordem
- ação
- resultado esperado
- Data Element vinculado quando aplicável

### Data Element

Um Data Element representa dado reutilizável em testes.

Ele deve respeitar empresa, sensibilidade e permissão.

Dados sensíveis não devem ser expostos ao Brian ou Assistente sem controle explícito.

### Plano de Teste

Um plano de teste pertence a uma empresa.

Pode conter vários casos de teste.

Um caso pode estar em vários planos.

### Vínculo Plano-Caso

O vínculo entre plano e caso deve guardar:

- testPlanId
- testCaseId
- ordem
- obrigatoriedade
- configuração específica do plano quando necessário

### Execução

Uma execução nasce a partir de um plano de teste.

Ela deve gerar uma visão executável dos casos vinculados ao plano.

A execução registra resultado por caso:

- passed
- failed
- blocked
- skipped
- not_run

### Resultado de Execução

O resultado de execução deve registrar:

- execução
- caso executado
- usuário executor
- status
- comentário
- evidência
- defeito vinculado quando houver
- data/hora

O resultado deve refletir no histórico do caso, sem destruir o conteúdo original do caso.

### Defeito

Um defeito representa problema encontrado no fluxo de QA.

Ele pode nascer de falha em execução ou ser criado manualmente.

Quando nascer de execução, deve manter vínculo com execução, caso, resultado e evidência quando houver.

---

## Brian

O Brian é o cérebro visual e contextual da plataforma.

Ele deve representar relações entre informações do sistema.

O Brian não deve inventar dados.

O Brian deve indexar dados reais do sistema.

Brian é grafo contextual. Brian não é fonte primária dos dados.

Tipos principais de nós:

- empresa
- usuário
- perfil
- permissão
- caso de teste
- plano de teste
- execução
- resultado de execução
- defeito
- ticket
- documento
- integração
- rota
- endpoint
- evento de auditoria

Tipos principais de relações:

- empresa possui usuário
- usuário criou caso
- caso pertence ao plano
- plano gerou execução
- execução executou caso
- execução falhou caso
- falha gerou defeito
- defeito abriu ticket
- usuário possui permissão
- permissão permite módulo
- rota usa endpoint
- endpoint altera entidade

Todo nó do Brian deve ter referência clara:

- refType
- refId
- companyId quando aplicável
- label
- metadata
- createdAt
- updatedAt

Toda relação deve ter evidência ou origem.

O Brian deve respeitar RBAC, empresa, usuário, perfil e permissão antes de exibir nó, relação ou metadado.

---

## Assistente IA

O Assistente é a voz do Brian.

Ele deve responder com base em:

- empresa atual
- usuário atual
- perfil atual
- permissões atuais
- tela atual quando disponível
- entidade atual quando disponível
- contexto autorizado do Brian

O Assistente não pode:

- mostrar dados de outra empresa
- consultar dados ignorando permissão
- criar estrutura nova sem plano
- apagar arquivos
- alterar schema sem justificativa
- implementar automação fora do escopo atual

O Assistente deve explicar de onde veio a resposta quando usar dados do Brian.

---

## Regras para IA no projeto

Antes de qualquer alteração, a IA deve responder:

1. O que já existe?
2. Qual arquivo será alterado?
3. Por que esse arquivo?
4. Isso duplica algo?
5. Isso respeita permissões?
6. Isso afeta banco de dados?
7. Isso afeta Brian?
8. Como testar?

A IA não pode:

- criar pasta nova sem justificar
- criar componente duplicado
- criar rota duplicada
- apagar arquivo sem inventário
- alterar schema sem migration
- misturar automação com manual nesta fase
- alterar Playwright nesta fase
- mudar autenticação/permissão sem teste
- fazer build grande sem checklist

---

## Checklist obrigatório antes de merge

Toda alteração deve passar por:

- npm install quando necessário
- npm run lint quando existir
- npm run typecheck quando existir
- npm run build quando possível
- testes do fluxo alterado
- validação de permissão
- validação de empresa/escopo
- validação do Brian quando afetado

---

## Escopo congelado da fase atual

Nesta fase, só vamos trabalhar em:

- organização do projeto
- fluxo manual
- casos de teste
- planos de teste
- vinculação de casos e planos
- execuções
- resultados
- histórico do caso
- Brian
- assistente com permissão

Qualquer coisa fora disso precisa ser registrada como backlog, não implementada agora.

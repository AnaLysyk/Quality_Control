# QA Screen Flow — Painel QA

## Objetivo

Organizar a plataforma por telas simples, bonitas e fáceis de entender.

A plataforma não deve ser organizada por arquivos soltos ou módulos criados aleatoriamente.

A experiência principal deve seguir o fluxo natural de QA:

Flow → Caso de Teste → Step → Data Element → Plano de Teste → Execução → Resultado → Defeito → Brian → Assistente

---

## Menu principal de Qualidade

A área de qualidade deve conter:

- Casos de Teste
- Flows
- Data Elements
- Planos de Teste
- Execuções
- Defeitos
- Brian
- Assistente

---

## Conceitos oficiais

### Flow

Um Flow representa um fluxo de negócio ou fluxo de teste.

Exemplos:

- Login
- Cadastro
- Compra
- Abertura de ticket
- Biometria
- Integração Qase

Um Flow pode possuir vários casos de teste.

---

### Caso de Teste

Um Caso de Teste representa uma validação específica.

Exemplo:

- Validar login com usuário ativo
- Validar cadastro com CPF inválido
- Validar criação de ticket sem anexo

Um Caso de Teste pertence a uma empresa.

Um Caso de Teste pode estar vinculado a um Flow.

Um Caso de Teste pode estar em vários Planos de Teste.

---

### Step

Um Step representa um passo do Caso de Teste.

Cada Step deve conter:

- ordem
- ação
- resultado esperado
- data element vinculado quando necessário

---

### Data Element

Um Data Element representa um dado reutilizável no teste.

Exemplos:

- email válido
- senha válida
- CPF inválido
- usuário admin
- token
- arquivo PDF
- imagem
- CNPJ

Um Data Element pode ser usado por vários Steps.

---

### Plano de Teste

Um Plano de Teste agrupa vários Casos de Teste.

Exemplos:

- Regressão Sprint 10
- Smoke Produção
- Validação Biometria
- Homologação Cliente X

---

### Execução

Uma Execução representa a execução real de um Plano de Teste.

Cada execução possui resultado por caso:

- passed
- failed
- blocked
- skipped
- not_run

---

### Resultado

Um Resultado representa o estado de um Caso de Teste dentro de uma Execução.

Exemplos:

- passed
- failed
- blocked
- skipped
- not_run

Um Resultado deve manter vínculo com:

- execução
- caso de teste
- usuário executor
- evidência quando houver
- defeito quando houver

---

### Defeito

Um Defeito representa um problema encontrado durante criação, revisão ou execução de teste.

Um Defeito pode nascer de uma falha em execução.

Um Defeito deve manter vínculo com empresa, caso, execução ou evidência quando aplicável.

---

### Brian

Brian representa visualmente os dados reais e as relações do Painel QA.

Brian deve mostrar conexões entre empresas, usuários, casos, planos, execuções, resultados, defeitos, tickets e permissões.

Brian não deve inventar dados.

---

### Assistente

O Assistente é a voz do Brian para o usuário.

Ele deve responder usando apenas dados autorizados, respeitando empresa, usuário, perfil e permissão.

---

## Telas oficiais

### 1. Casos de Teste

Rota sugerida:

`/quality/test-cases`

Objetivo:

Listar, filtrar e criar casos de teste.

Colunas principais:

- título
- flow
- prioridade
- status
- última execução
- defeitos
- atualizado em

Ações:

- novo caso
- editar
- duplicar
- vincular a plano
- visualizar no Brian

---

### 2. Criar ou Editar Caso de Teste

Rota sugerida:

`/quality/test-cases/[id]`

Abas:

- Informações
- Steps
- Data Elements
- Planos vinculados
- Execuções
- Defeitos
- Histórico
- Brian

Campos de Informações:

- título
- descrição
- flow
- tipo
- prioridade
- status
- pré-condições
- resultado esperado geral

---

### 3. Flows

Rota sugerida:

`/quality/flows`

Objetivo:

Agrupar casos de teste por fluxo de negócio.

Colunas:

- nome
- descrição
- quantidade de casos
- última execução
- defeitos abertos

Abas sugeridas:

- Informações
- Casos vinculados
- Execuções
- Defeitos
- Brian

---

### 4. Data Elements

Rota sugerida:

`/quality/data-elements`

Objetivo:

Gerenciar dados reutilizáveis de teste.

Colunas:

- nome
- tipo
- descrição
- usado em quantos steps
- seguro/sensível

Tipos sugeridos:

- texto
- número
- usuário
- credencial
- documento
- arquivo
- token
- ambiente

Abas sugeridas:

- Informações
- Uso em Steps
- Histórico
- Brian

---

### 5. Planos de Teste

Rota sugerida:

`/quality/test-plans`

Objetivo:

Criar planos e vincular casos de teste.

Abas dentro do plano:

- Informações
- Casos vinculados
- Execuções
- Histórico
- Brian

---

### 6. Execuções

Rota sugerida:

`/quality/executions`

Objetivo:

Executar planos de teste e registrar resultado.

Colunas:

- plano
- aplicação
- status
- passed
- failed
- blocked
- not_run
- executor
- data

Dentro da execução:

- casos a executar
- resultado por caso
- evidências
- defeitos criados
- resumo
- Brian

Abas sugeridas:

- Informações
- Casos
- Resultados
- Evidências
- Defeitos
- Resumo
- Brian

---

### 7. Defeitos

Rota sugerida:

`/quality/defects`

Objetivo:

Registrar e acompanhar problemas encontrados durante o fluxo de QA.

Colunas:

- título
- severidade
- status
- caso vinculado
- execução vinculada
- responsável
- atualizado em

Abas sugeridas:

- Informações
- Evidências
- Casos vinculados
- Execuções
- Histórico
- Brian

---

### 8. Brian

Rota sugerida:

`/quality/brian`

Objetivo:

Visualizar o grafo contextual da qualidade com dados reais e permissões aplicadas.

Blocos sugeridos:

- grafo
- filtros
- detalhes do nó
- relações
- evidências

---

### 9. Assistente

Rota sugerida:

`/quality/assistant`

Objetivo:

Conversar com o Assistente usando o contexto autorizado do Brian.

Blocos sugeridos:

- conversa
- contexto atual
- referências usadas
- ações sugeridas

---

## Regra de organização

Toda nova funcionalidade de QA deve se encaixar em uma dessas telas.

Se não couber em nenhuma tela, deve ser discutida antes de criar novo módulo.

Nenhuma IA deve criar pasta, rota ou tela nova sem primeiro responder:

1. Em qual tela isso entra?
2. Qual conceito isso representa?
3. Isso é Flow, Caso, Step, Data Element, Plano, Execução, Resultado, Defeito, Brian ou Assistente?
4. Isso já existe?
5. Isso respeita empresa e permissões?
6. Isso precisa aparecer no Brian?

Se não houver resposta clara, a mudança deve ser bloqueada e virar inventário ou backlog.

---

## Regra visual

As telas devem ser simples, claras e organizadas por abas.

Evitar telas com informação misturada.

Evitar nomes técnicos para o usuário final.

Usar nomes visíveis como:

- Casos de Teste
- Flows
- Data Elements
- Planos de Teste
- Execuções
- Defeitos
- Histórico
- Brian
- Assistente

---

## Fora de escopo agora

Não implementar agora:

- Playwright visual
- automações avançadas
- nova engine de IA
- refatoração grande
- telas duplicadas
- novo dashboard sem necessidade

Primeiro o fluxo manual precisa funcionar.

# Modelo operacional de QA

Este documento organiza o conceito de operacao do Quality Control para que o produto funcione como ferramenta de trabalho de QA e como base para operacao terceirizada da Testing Company.

## Hierarquia obrigatoria

```txt
Empresa
  -> Projeto
    -> Repositorio de Casos
      -> Casos de Teste
        -> Manual / Candidato a automacao / Automatizado / Desatualizado / Quarentena
        -> Script vinculado quando automatizado
    -> Plano de Teste
      -> Casos selecionados do repositorio
    -> Run / Execucao
      -> Sempre nasce de um plano
      -> Cada item aponta para um caso
      -> Cada item registra responsavel, status, tempo, nota e evidencia
    -> Metricas
      -> Projeto, pessoa, plano, run, automacao, defeito e notas
    -> Brian
      -> Consulta e executa acoes com auditoria
```

## Regras de produto

1. Projeto novo deve criar estrutura operacional vazia.
2. Repositorio de casos pertence ao projeto.
3. Plano de teste so pode puxar casos do repositorio do mesmo projeto.
4. Run nao pode existir sem plano.
5. Cada caso do plano vira um item da run.
6. Run item precisa ter responsavel, status, inicio, fim, duracao e evidencia quando falhar ou bloquear.
7. Caso pode ser manual, candidato a automacao, automatizado, automacao desatualizada ou quarentena.
8. Caso candidato ou automatizado aparece na area de automacao.
9. Script automatizado precisa manter vinculo com caso.
10. Metricas devem ser calculadas a partir dos registros, nunca preenchidas manualmente.
11. Notas devem virar dado operacional vinculavel a caso, run, defeito, projeto ou evidencia.
12. Brian deve conseguir fazer por comando tudo que o usuario consegue fazer manualmente, com contexto e auditoria.

## Campos minimos por run item

```txt
runItemId
companyId
projectId
planId
runId
caseId
assigneeId
executorId
executionType: manual | automated | assisted_by_brian
status: not_run | passed | failed | blocked | skipped
startedAt
finishedAt
durationSeconds
defectId
evidenceIds
notes
automationScriptId
attemptNumber
```

## Status de automacao do caso

```txt
manual
automation_candidate
automated
automation_outdated
quarantined
```

## Metricas principais

### Projeto

- Total de casos ativos.
- Cobertura por plano.
- Cobertura automatizada.
- Runs abertas.
- Runs concluidas.
- Taxa de aprovacao.
- Taxa de reprovacao.
- Taxa de bloqueio.
- Defeitos abertos.
- Tempo total executado.
- Health Score.

### Pessoa

- Casos atribuidos.
- Casos executados.
- Tempo total executado.
- Tempo medio por caso.
- Casos aprovados.
- Casos reprovados.
- Casos bloqueados.
- Defeitos encontrados.
- Execucoes atrasadas.

### Automacao

- Casos candidatos.
- Casos automatizados.
- Scripts vinculados.
- Scripts sem caso.
- Casos sem script.
- Testes flaky.
- Automacoes desatualizadas.
- Ultima execucao.

## Brian operacional

O Brian deve operar com este fluxo:

```txt
Usuario faz pedido
  -> Brian identifica projeto
  -> Brian identifica entidade
  -> Brian valida contexto obrigatorio
  -> Brian pergunta quando houver ambiguidade
  -> Brian executa ou prepara a acao
  -> Brian registra auditoria
  -> Brian atualiza a entidade
  -> Brian explica impacto nas metricas
```

Exemplo:

```txt
Usuario: Brian, reprova o teste de login da regressao.
Brian: Encontrei 3 casos de login. Qual deles?
Usuario: O de senha invalida.
Brian: Encontrei esse caso na RUN-45 do plano Regressao Login. Qual motivo da falha?
Usuario: Retornou erro 500.
Brian: Feito. Marquei como failed, vinculei ao seu usuario, registrei a nota e sugeri abertura de defeito.
```

## Primeira fila de implementacao

1. Criar estrutura operacional vazia ao criar projeto.
2. Garantir repositorio de casos por projeto.
3. Adicionar status de automacao no caso.
4. Plano puxar apenas casos do repositorio do projeto.
5. Bloquear run sem plano.
6. Criar run items com responsavel, status e tempo.
7. Gerar metricas por projeto e pessoa.
8. Transformar notas em informacao operacional.
9. Permitir Brian operar casos, planos e runs por comando.

## Arquivos implementados nesta rodada

- `data/qaOperationModel.ts`
- `app/api/quality/operation-model/route.ts`
- `app/operacao-qa/_components/QaOperationModelPanel.tsx`
- `app/modelo-qualidade/page.tsx`
- `data/brainQaRegistry.ts`

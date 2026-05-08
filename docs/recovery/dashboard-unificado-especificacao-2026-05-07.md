# Dashboard unificado - especificacao detalhada

## Objetivo

Criar um unico dashboard para todos os perfis, com filtros encadeados e leitura por escopo de permissao.

Perfis alvo:
- leader_tc
- technical_support
- testing_company_user
- empresa
- company_user

Principio:
- Mesmo assunto, mesma tela base, mudando apenas escopo e permissao.
- Nao manter dashboard paralelo por perfil.

## Regras de visao por perfil

1. `leader_tc` e `technical_support`
- Acesso a todos os modulos.
- Podem filtrar por uma, varias ou todas as empresas.
- Sem filtro selecionado: comportamento padrao deve ser "todas as empresas visiveis".

2. `empresa` e `company_user`
- Mesmo contexto visual da empresa dona da conta.
- `company_user` nao pode ver dados de outra empresa.
- Se existir seletor de empresa, ele deve vir travado em uma unica empresa.

3. `testing_company_user`
- Visao estilo admin, mas restrita as empresas do proprio vinculo.
- Pode filtrar apenas dentro das empresas permitidas para esse usuario.
- Nao pode elevar escopo para empresa fora da relacao de memberships.

## Filtros encadeados (ordem obrigatoria)

Ordem:
1. Empresa(s)
2. Modulo
3. Produto/Projeto
4. Periodo
5. Status
6. Responsavel (opcional)

Comportamento:
- Filtro anterior alimenta opcoes do seguinte.
- Se trocar Empresa, resetar automaticamente filtros dependentes (Modulo, Produto/Projeto, Status, Responsavel).
- Sempre permitir estado "sem selecao" para analise ampla.
- Sempre permitir "selecionar todos" para filtros multi-select.

## Blocos do dashboard

1. Resumo executivo (cards)
- Total de runs
- Taxa de aprovacao
- Defeitos abertos
- SLA medio
- Tendencia vs periodo anterior

2. Qualidade por modulo
- Grafico comparativo por modulo
- Ordenacao por maior risco ou pior tendencia

3. Qualidade por empresa
- Ranking por KPI principal
- Modo tabela e modo grafico

4. Operacao
- Fila de itens criticos
- Itens vencendo SLA
- Alertas priorizados

5. Auditoria de mudancas
- Ultimas alteracoes relevantes em permissao, users e fluxos de acesso

## Regras de dados

API unica de consulta agregada:
- Endpoint sugerido: `/api/dashboard/summary`
- Parametros principais:
  - `companyIds[]`
  - `modules[]`
  - `projectIds[]`
  - `periodStart`
  - `periodEnd`
  - `status[]`

Regras:
- A API recebe filtro pedido no frontend, mas aplica corte final pelo escopo do usuario autenticado.
- Se usuario pedir empresa sem permissao, endpoint responde erro de autorizacao ou ignora filtro invalido e registra audit.
- Todo resultado de dashboard deve carregar metadado `scopeApplied` para transparencia.

## UX obrigatoria

- Estado vazio com mensagem clara quando nao houver dados.
- Skeleton durante carregamento.
- Persistencia de filtros por usuario (localStorage ou backend).
- Botao "limpar filtros".
- Deep link com query params para compartilhar visao.

## Telemetria e audit

Eventos minimos:
- `dashboard_filter_changed`
- `dashboard_scope_denied`
- `dashboard_export_requested`

Campos:
- userId
- role
- companyScope
- activeFilters
- timestamp

## Criterios de aceite

1. Mesmo componente base de dashboard para todos os perfis.
2. Permissao por escopo validada no backend.
3. Filtros encadeados funcionando com reset consistente.
4. Multi-empresa funcionando para leader_tc, technical_support e testing_company_user (dentro do limite).
5. empresa e company_user com contexto equivalente da empresa.
6. Sem regressao de performance (p95 < 2s para carga inicial com cache quente).
7. Testes E2E cobrindo no minimo:
- troca de empresa
- troca de modulo
- sem filtro
- multi-filtro
- tentativa de acesso fora do escopo

## Plano de entrega

Fase 1 - arquitetura e contrato
- consolidar contrato da API
- definir tipagem unica de filtros

Fase 2 - frontend
- padronizar seletor encadeado
- unificar cards e blocos

Fase 3 - autorizacao e auditoria
- validar escopo no backend
- registrar eventos

Fase 4 - validacao
- testes E2E por perfil
- benchmark basico de performance
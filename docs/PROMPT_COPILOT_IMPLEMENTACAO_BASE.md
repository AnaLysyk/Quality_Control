# Prompt para Copilot implementar a base funcional do Quality Control

Use este prompt no GitHub Copilot Chat, Copilot Workspace ou agente equivalente.

---

## PROMPT

Voce vai atuar como engenheiro full-stack senior especializado em Next.js, TypeScript, Playwright e arquitetura de produto SaaS de QA.

Estou trabalhando no repositorio `Quality_Control`.

Antes de alterar qualquer coisa, leia e respeite estes arquivos como fonte principal:

- `docs/BASE_FUNCIONAL_QUALITY_CONTROL.md`
- `README.md`
- `README.tech.md`
- `package.json`
- `playwright.config.ts`
- `tests-e2e/smoke.spec.ts`
- `tests-e2e/case-repository-profile-cycle.spec.ts`
- `tests-e2e/fixtures/test.ts`
- `tests-e2e/utils/auth.ts`

## Objetivo

Implementar e estabilizar a base funcional do produto Quality Control, mantendo somente o que faz sentido para a plataforma de gestao de QA.

O produto precisa ter como nucleo inicial:

1. Login
2. Perfis e permissoes
3. Empresa
4. Usuarios
5. Repositorio de Casos
6. Plano de Teste
7. Runs / Execucoes
8. Dashboard

## Perfis obrigatorios

O sistema deve trabalhar com estes perfis:

- Empresa
- Usuario da Empresa
- Usuario TC
- Lider TC
- Suporte Tecnico

No codigo, preserve/organize os papeis ja existentes quando fizer sentido:

- `empresa`
- `company_user`
- `testing_company_user`
- `leader_tc`
- `technical_support`

## Regras principais de permissao

Implementar as permissoes de forma simples, clara e centralizada.

### Empresa

Pode:

- Fazer login
- Ver dados da propria empresa
- Ver usuarios vinculados a propria empresa
- Ver dashboard da propria empresa
- Ver planos, casos e runs da propria empresa

Nao pode:

- Ver outras empresas
- Criar caso tecnico global
- Alterar permissoes internas TC

### Usuario da Empresa

Pode:

- Fazer login
- Ver dashboard da propria empresa
- Ver casos, planos e runs da propria empresa

Nao pode:

- Criar empresa
- Ver outras empresas
- Administrar usuarios TC
- Alterar regras globais

### Usuario TC

Pode:

- Fazer login
- Criar e editar casos de teste
- Criar evidencia em runs
- Executar casos dentro de uma run
- Registrar resultado: APROVADO, FALHA, BLOQUEADO, NAO_EXECUTADO

Nao pode:

- Criar empresa
- Alterar permissoes
- Ver dados de empresa fora do seu contexto autorizado

### Lider TC

Pode:

- Fazer login
- Criar e editar casos
- Criar planos de teste
- Vincular casos ao plano
- Criar runs a partir de planos
- Ver dashboard consolidado
- Acompanhar execucoes por empresa

Nao pode:

- Quebrar isolamento de dados sensiveis
- Expor senha/token

### Suporte Tecnico

Pode:

- Fazer login
- Ver empresas para suporte
- Ver logs/contexto tecnico quando existir
- Ajudar investigacao de erro
- Ver dashboard tecnico

Nao pode:

- Alterar resultado de teste sem rastreabilidade
- Apagar dados sem confirmacao

## Fluxo funcional minimo esperado

O fluxo principal precisa funcionar assim:

1. Usuario acessa o sistema
2. Usuario faz login
3. Sistema identifica perfil e empresa ativa
4. Sistema libera apenas menus permitidos
5. Usuario acessa o Repositorio de Casos
6. Usuario autorizado cria um caso de teste
7. Lider TC cria um Plano de Teste
8. Lider TC vincula casos ao plano
9. Usuario autorizado cria uma Run a partir do plano
10. Usuario executa/atualiza status dos casos da Run
11. Dashboard mostra os resultados consolidados

## Modulo: Login

Garantir que o login funcione de forma estavel em ambiente E2E.

Validar:

- Login admin/mockado usado pelo smoke
- Criacao de sessao
- Cookies de autenticacao
- Redirecionamento correto por perfil
- Bloqueio de acesso sem sessao

Nao quebrar:

- `tests-e2e/smoke.spec.ts`
- `tests-e2e/utils/auth.ts`

## Modulo: Perfis e permissoes

Criar ou organizar uma camada central para permissoes.

Sugestao:

```txt
lib/permissions.ts
lib/roles.ts
```

A regra de acesso deve ser testavel e nao espalhada em varios componentes.

Evitar duplicacao de regra em tela.

## Modulo: Empresa

Garantir que empresa seja o contexto principal dos dados.

Cada caso, plano e run deve pertencer a uma empresa ou estar vinculado a um contexto claro.

Rotas esperadas ja aparecem nos testes:

```txt
/empresas/{companySlug}/planos-de-teste
/empresas/{companySlug}/runs
```

Preservar esse padrao.

## Modulo: Repositorio de Casos

Manter e estabilizar a rota:

```txt
/casos-de-teste
```

A tela precisa permitir:

- Listar casos
- Criar caso manual
- Abrir detalhe do caso
- Ver titulo, descricao, pre-condicoes, passos e resultado esperado
- Respeitar contexto de perfil/empresa

Elementos usados pelos testes devem ser mantidos:

```txt
test-case-repository
test-case-context-chip
test-case-company-filter
test-case-new-button
test-case-new-manual
test-case-create-modal
test-case-title-input
test-case-description-input
test-case-preconditions-input
test-case-add-step-button
test-case-step-action-input
test-case-step-expected-input
test-case-save-button
test-case-list
test-case-card
test-case-detail
test-case-detail-title
test-case-key
```

Nao remover esses `data-testid` sem atualizar os testes.

## Modulo: Plano de Teste

Manter e estabilizar:

```txt
/empresas/{companySlug}/planos-de-teste
```

A tela precisa permitir:

- Listar planos
- Criar plano
- Informar titulo e descricao
- Vincular caso existente ao plano
- Abrir detalhe do plano
- Exibir casos vinculados

Elementos usados pelos testes devem ser mantidos:

```txt
test-plan-repository
test-plan-context-chip
test-plan-new-button
test-plan-create-modal
test-plan-title-input
test-plan-description-input
test-plan-save-button
test-plan-list
test-plan-card
test-plan-detail
test-plan-key
```

## Modulo: Runs / Execucoes

Manter e estabilizar:

```txt
/empresas/{companySlug}/runs
```

A tela precisa permitir:

- Listar runs
- Criar run
- Selecionar plano
- Aplicar plano
- Salvar run
- Abrir detalhe da run
- Exibir caso vinculado
- Atualizar status de execucao quando aplicavel

Elementos usados pelos testes devem ser mantidos:

```txt
test-run-repository
test-run-context-chip
test-run-new-button
test-run-create-modal
test-run-title-input
test-run-plan-search-input
test-run-save-button
test-run-list
test-run-card
test-run-detail
test-run-linked-case
test-run-key
```

## Modulo: Dashboard

O Dashboard deve mostrar dados vindos de Runs.

Indicadores minimos:

- Total de casos
- Total de planos
- Total de runs
- Aprovados
- Falhas
- Bloqueados
- Nao executados
- Percentual de sucesso

O Dashboard nao deve ter numeros soltos/fake sem relacao com os dados do sistema.

Se ainda nao houver banco/servico real, usar store JSON/mockado de forma clara e consistente com o E2E.

## Playwright e E2E

Preservar a estrutura atual:

```txt
tests-e2e/
playwright.config.ts
```

Garantir que estes comandos continuem funcionando:

```bash
npm run test:e2e:smoke
npm run test:e2e:access
npm run test:e2e:cases
npm run test:e2e:runs
npm run test:e2e:dashboards
npm run test:e2e
```

O projeto ja usa `E2E_USE_JSON=1`. Mantenha esse modo para testes locais previsiveis.

## Sincronizacao automatica de resultado

Preservar a logica existente em:

```txt
tests-e2e/fixtures/test.ts
```

Ela ja faz algo importante:

- Le tags `@case=...`
- Cria/atualiza run interna
- Converte status do Playwright para status interno

Status interno esperado:

```txt
APROVADO
FALHA
BLOQUEADO
NAO_EXECUTADO
```

Nao remover essa funcionalidade.

## O que NAO fazer

Nao trazer para esta base agora:

- Booking API
- Via Expressa
- Segunda Via
- SMART
- payloads grandes de outro projeto
- dados sensiveis
- tokens reais
- CPF real
- automacoes antigas que nao pertencem ao Quality Control

Esses assuntos podem virar casos de teste cadastrados no futuro, mas nao devem virar base estrutural do produto.

## Padrao de implementacao

Ao implementar:

1. Fazer mudancas pequenas e rastreaveis
2. Evitar refatoracao gigante sem necessidade
3. Nao quebrar os `data-testid` existentes
4. Nao remover testes E2E existentes
5. Criar testes novos quando adicionar regra nova
6. Centralizar regras de perfil/permissao
7. Manter isolamento por empresa
8. Manter compatibilidade com `E2E_USE_JSON=1`
9. Nao expor segredo no codigo
10. Atualizar documentacao quando mudar fluxo

## Entrega esperada

Entregar uma implementacao incremental com:

- Login funcional
- Perfis reconhecidos
- Permissoes aplicadas
- Repositorio de Casos funcional
- Plano de Teste funcional
- Runs funcionais
- Dashboard baseado em resultados
- Testes E2E passando
- Documentacao atualizada

## Validacao final obrigatoria

Depois de implementar, rodar:

```bash
npm run lint
npm run test
npm run test:e2e:smoke
npm run test:e2e:cases
npm run test:e2e:runs
npm run test:e2e:dashboards
```

Se algum comando falhar, corrigir ou documentar claramente o motivo.

## Resumo da prioridade

Prioridade maxima:

```txt
Login + Perfis + Empresa + Casos + Planos + Runs + Dashboard
```

Qualquer coisa fora disso deve ficar para depois.

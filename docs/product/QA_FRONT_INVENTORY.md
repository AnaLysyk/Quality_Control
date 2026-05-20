# QA Front Inventory - Painel QA

## Objetivo

Inventariar as telas atuais antes de qualquer ajuste visual.

Este documento responde ao chamado #33 e deve ser usado para abrir chamados pequenos de front, sem criar tela, rota ou componente novo sem justificativa.

Fluxo oficial:

`Flow -> Caso de Teste -> Step -> Data Element -> Plano de Teste -> Execucao -> Resultado -> Defeito -> Brian -> Assistente`

Telas oficiais:

- Casos de Teste
- Flows
- Data Elements
- Planos de Teste
- Execucoes
- Defeitos
- Brian
- Assistente

## Regra da rodada

- Nenhuma UI foi implementada nesta rodada.
- Nenhum backend foi alterado nesta rodada.
- Nenhum schema, Prisma, rota ou componente foi alterado nesta rodada.
- A pasta top-level `components/` nao existe no workspace atual; os componentes encontrados estao em `app/components/` e foram cobertos pela analise de `app`.

## Resumo por agente

- Product Flow Guardian: aprovado com ressalvas; as telas oficiais existem parcialmente, mas algumas estao espalhadas entre qualidade, automacao, admin e chat.
- UI Screen Guardian: aprovado com ressalvas; o primeiro ajuste visual deve reaproveitar telas existentes e reduzir duplicidade de linguagem.
- Manual QA Flow Guardian: aprovado com ressalvas; Planos, Casos, Execucoes e Defeitos existem, mas Flow e Data Elements ainda nao aparecem como telas manuais canonicas.
- RBAC Guardian: aprovado com ressalvas; o front envia `companySlug`/`companyId` em varias telas e deve continuar dependendo da validacao backend.
- Build Safety Guardian: aprovado; `npm run build` e `git diff --check` passaram nesta rodada, mantendo warnings Turbopack/NFT existentes.

## Inventario das telas oficiais

### Casos de Teste

Tela oficial correspondente:

- Casos de Teste

Rotas/telas encontradas:

- `app/casos-de-teste/page.tsx`
- `app/casos-de-teste/TestCaseRepositoryClient.tsx`
- `app/automacoes/casos/page.tsx`
- `app/automacoes/AutomationCasesBoard.tsx`

Componentes principais:

- `TestCaseRepositoryClient`
- `AutomationCasesBoard`

APIs consumidas:

- `/api/test-projects`
- `/api/test-cases`
- `/api/test-cases/:id`
- `/api/test-cases/:id/automation`
- `/api/test-cases/:id/automation/drafts`
- `/api/test-cases/:id/ai/runs`
- `/api/test-cases/:id/ai/generate-playwright`
- `/api/test-cases/:id/ai/review-automation`
- `/api/test-cases/:id/ai/heal-failure`

Lacunas de UX:

- A tela oficial de Casos de Teste tambem carrega muita automacao e IA no mesmo fluxo.
- A tela de automacao tem outra entrada para casos automatizados, o que pode confundir o usuario sobre onde criar ou editar um caso manual.
- As abas reais incluem caso, steps, automation, runs e history, mas ainda nao alinham completamente com Informacoes, Steps, Data Elements, Planos, Execucoes, Defeitos, Historico e Brian.

Riscos RBAC/front:

- O front usa filtro `companySlug` e modo `all`; o backend precisa continuar sendo a fonte final de permissao.
- O campo visivel "Empresa / companySlug" no formulario pode induzir edicao manual indevida se o backend nao validar.

Primeiro patch visual recomendado:

- Nao criar rota nova. Primeiro separar visualmente o modo manual do modo automacao dentro da tela existente, usando labels oficiais e mantendo APIs atuais.

### Flows

Tela oficial correspondente:

- Flows

Rotas/telas encontradas:

- `app/automacoes/fluxos/page.tsx`
- `app/automacoes/AutomationStudio.tsx`

Componentes principais:

- `AutomationStudio`

APIs consumidas:

- Nao foi encontrado CRUD manual canonico de Flow nesta tela.
- A tela usa fluxo local de automacao com `localStorage` por `companySlug`.
- O studio referencia webhook em `/api/automations/webhook`.

Lacunas de UX:

- A tela encontrada representa fluxos automatizados, nao Flow manual de negocio/teste.
- Nao ha rota canonica para `/quality/flows`.
- O conceito de Flow oficial ainda nao aparece ligado claramente aos Casos de Teste manuais.

Riscos RBAC/front:

- `AutomationStudio` persiste drafts e custom flows no navegador por `companySlug`; isso deve ser revisado antes de promover como tela oficial de Flow manual.

Primeiro patch visual recomendado:

- Nao criar tela nova agora. Documentar que `app/automacoes/fluxos` nao e a tela oficial de Flow manual e abrir chamado separado para definir se Flow manual deve nascer dentro de Casos de Teste ou como tela propria.

### Data Elements

Tela oficial correspondente:

- Data Elements

Rotas/telas encontradas:

- Nenhuma tela canonica de Data Elements foi encontrada.
- Existem APIs e uso tecnico para ativos de dados de teste:
  - `app/api/test-data-assets/route.ts`
  - `app/api/test-data-assets/[id]/route.ts`
  - `app/api/test-data-assets/[id]/content/route.ts`
  - `app/api/test-data-assets/resolve/route.ts`
  - `app/api/test-data-packs/resolve/route.ts`

Componentes principais:

- Nao ha componente oficial de Data Elements.
- Usos relacionados aparecem em automacao, fixtures e biblioteca de arquivos.

APIs consumidas:

- Nao foi encontrado consumo de UI canonico para Data Elements manuais.

Lacunas de UX:

- O usuario de QA ainda nao tem uma tela clara para criar, revisar e reutilizar Data Elements.
- O conceito aparece mais como asset/fixture tecnico do que como dado reutilizavel de teste manual.

Riscos RBAC/front:

- As APIs de test data lidam com sensibilidade e conteudo; qualquer futura tela deve esconder valores sensiveis por padrao.
- Criar UI sem revisar permissao de leitura/download pode expor dado entre empresas.

Primeiro patch visual recomendado:

- Bloquear implementacao visual ate existir decisao de produto: Data Element manual sera CRUD proprio ou parte da aba do Caso de Teste.

### Planos de Teste

Tela oficial correspondente:

- Planos de Teste

Rotas/telas encontradas:

- `app/empresas/[slug]/planos-de-teste/page.tsx`

Componentes principais:

- `TestPlansPage`
- `AppShellCoverSlot`

APIs consumidas:

- `/api/applications?companySlug=...`
- `/api/test-plans`
- `/api/test-plans?companySlug=...`
- `/api/test-plans/:id/test-cases`
- `/api/test-plans/cases`

Lacunas de UX:

- A tela mistura plano manual, local, automacao e Qase.
- A edicao de plano concentra muitas responsabilidades no mesmo arquivo.
- A tela ja chama o Assistente, mas ainda nao mostra Brian como aba propria do plano.

Riscos RBAC/front:

- A tela envia `companySlug` no query/body; os patches recentes de RBAC no backend devem continuar sendo a garantia principal.
- A rota `/api/test-plans/cases` segue como endpoint suspeito de consolidacao, embora agora tenha mitigacao RBAC.

Primeiro patch visual recomendado:

- Este e o melhor primeiro chamado de front: organizar somente a tela existente de Planos de Teste em blocos/abas oficiais, sem alterar API.

### Execucoes

Tela oficial correspondente:

- Execucoes

Rotas/telas encontradas:

- `app/empresas/[slug]/runs/page.tsx`
- `app/empresas/[slug]/runs/CompanyRunsPageClient.tsx`
- `app/runs/page.tsx`
- `app/runs/OperationsWorkspaceClient.tsx`
- `app/automacoes/execucoes/page.tsx`
- `app/automacoes/execucoes/AutomationExecutionsDashboard.tsx`

Componentes principais:

- `CompanyRunsPage`
- `CompanyRunsPageClient`
- `OperationsWorkspaceClient`
- `AutomationExecutionsDashboard`
- `BiometricAutomationRunner`

APIs consumidas:

- `/api/releases-manual`
- `/api/v1/runs`
- `/api/applications`
- `/api/releases`
- `/api/operacao/summary`
- `/api/automations/audit`

Lacunas de UX:

- Execucoes aparecem como Runs, operacao e automacao em rotas diferentes.
- A rota `app/automacoes/execucoes/page.tsx` carrega runner biometrico, enquanto existe um dashboard de execucoes automatizadas separado.
- O usuario pode nao entender qual tela representa a execucao manual de plano.

Riscos RBAC/front:

- Algumas consultas globais aparecem sem `companySlug` quando o usuario tem visibilidade ampla; manter validacao backend obrigatoria.
- O front faz merge de fontes manuais e integradas; erro de escopo visual pode misturar empresas se backend falhar.

Primeiro patch visual recomendado:

- Nao redesenhar agora. Primeiro definir nomenclatura: usar "Execucoes" para usuario final e manter "Runs" somente como detalhe tecnico ou legado.

### Defeitos

Tela oficial correspondente:

- Defeitos

Rotas/telas encontradas:

- `app/defeitos/page.tsx`
- `app/admin/defeitos/page.tsx`
- `app/empresas/[slug]/defeitos/page.tsx`
- `app/empresas/[slug]/defeitos/kanban/page.tsx`
- `app/components/DefectList.tsx`

Componentes principais:

- `AdminDefeitosPage`
- `CompanyDefectsPage`
- `Kanban`
- `DefectList`

APIs consumidas:

- `/api/clients`
- `/api/admin/defeitos`
- `/api/company-defects`
- `/api/company-defects/:slug/activity`
- `/api/company-defects/:slug/assignee`
- `/api/company-defects/:slug/comments`
- `/api/releases-manual`
- `/api/releases-manual/:slug`
- `/api/v1/runs`
- `/api/s3/upload`
- `/api/s3/object`
- `/api/defect`

Lacunas de UX:

- Ha uma tela rica por empresa e uma tela admin global, mas tambem existe `DefectList` usando endpoint legado `/api/defect`.
- O kanban de defeitos fica em rota separada e pode parecer outro produto.

Riscos RBAC/front:

- `DefectList` recebe `companyId` por prop e chama `/api/defect`; apesar do patch RBAC recente, ele deve ser tratado como legado ate inventario de uso.
- Admin e empresa precisam manter diferenca visual clara para evitar acao no escopo errado.

Primeiro patch visual recomendado:

- Nao alterar visual de defeitos antes de confirmar se `DefectList` ainda e usado por alguma tela oficial.

### Brian

Tela oficial correspondente:

- Brian

Rotas/telas encontradas:

- `app/brain/page.tsx`
- `app/admin/brain/page.tsx`
- `app/admin/brain/BrainPageClient.tsx`
- `app/admin/brain/BrainReactFlowView.tsx`
- `app/admin/brain/BrainGraphView.tsx`
- `app/brain/perguntar/page.tsx`

Componentes principais:

- `BrainPageClient`
- `BrainReactFlowView`
- `BrainGraphView`

APIs consumidas:

- `/api/brain/graph`
- `/api/brain/graph/node/:id`
- `/api/brain/graph/node/:id/position`
- `/api/brain/graph/node/:id/neighborhood`
- `/api/brain/graph/analytics`
- `/api/brain/pending`
- `/api/brain/replay`
- `/api/brain/commands`

Lacunas de UX:

- `/brain` reaproveita a pagina admin do Brain.
- `/brain/perguntar` redireciona para `/chat`, entao a fronteira entre Brian e Assistente nao esta clara para usuario.

Riscos RBAC/front:

- Brian chama dados graficos e comandos; a autorizacao deve permanecer no backend e no contexto do Assistente.
- A tela dispara `assistant:open` com contexto do grafo; nao pode expor contexto sem permissao.

Primeiro patch visual recomendado:

- Nao mexer no grafo agora. Primeiro padronizar copy/navegacao entre "Brain" e "Perguntar ao assistente" depois que Planos de Teste estiver organizado.

### Assistente

Tela oficial correspondente:

- Assistente

Rotas/telas encontradas:

- `app/chat/page.tsx`
- `app/components/Chat.tsx`
- `app/components/ChatWorkspace.tsx`
- `app/components/ChatButton.tsx`
- `app/brain/perguntar/page.tsx`

Componentes principais:

- `Chat`
- `ChatWorkspace`
- `ChatButton`

APIs consumidas:

- `/api/chat/contacts`
- `/api/chat/messages`
- `/api/assistant/ask`

Lacunas de UX:

- Existem duas experiencias: chat/conversas e assistente contextual flutuante.
- A rota `/brain/perguntar` redireciona para `/chat`, mas o Assistente oficial de Brian vive principalmente em `ChatButton`.

Riscos RBAC/front:

- `ChatButton` envia contexto, `companySlug` e `companySlugs`; backend precisa validar escopo e permissoes em toda resposta.
- Qualquer acao de ferramenta do Assistente deve exigir confirmacao e RBAC backend.

Primeiro patch visual recomendado:

- Nao alterar agora. Depois do inventario, decidir se Assistente e tela propria, overlay contextual ou ambos com nomes diferentes.

## Navegacao atual

Arquivo principal:

- `lib/navigation/navigationCatalog.ts`

Modulo de qualidade atual:

- Label: `Repositorio de Testes`
- Itens:
  - `Casos de Teste` -> `/casos-de-teste`
  - `Planos de Teste` -> company route `planos-de-teste`
  - `Runs` -> company route `runs`
  - `Defeitos` -> company route `defeitos`

Ausencias no menu de Qualidade:

- Flows
- Data Elements
- Brian
- Assistente

Observacao:

- Brian e Chat/Assistente existem como modulos separados no catalogo.
- Automation tem Fluxos automatizados, Casos automatizados e Execucoes, mas isso nao substitui o fluxo manual oficial.

## Primeiro menor patch visual recomendado

Abrir um chamado pequeno para `app/empresas/[slug]/planos-de-teste/page.tsx`.

Escopo recomendado:

- Nao criar rota nova.
- Nao alterar API.
- Nao alterar backend.
- Nao alterar schema.
- Reorganizar a tela existente usando nomes oficiais:
  - Informacoes
  - Casos vinculados
  - Execucoes
  - Historico
  - Brian
- Manter comportamento atual para Qase/manual/local/automation.
- Validar com build e captura visual depois do patch.

Motivo:

- A tela ja e canonica para Planos de Teste.
- O backend/RBAC dessa area acabou de ser tratado.
- O ajuste melhora o fluxo manual sem abrir conceito novo.

## Itens bloqueados para outro chamado

- Criar tela de Data Elements.
- Criar tela de Flows manual.
- Unificar Runs/Execucoes.
- Remover ou depreciar `DefectList`.
- Alterar Brain/Assistente.
- Mover itens de navegacao.

## Validacoes da rodada

Comandos executados:

```bash
rg -n "test-plans|defect|defects|executions|runs|Brian|assistant|companySlug|companyId" app src
git diff --check
npm run build
```

Nota:

- Como a pasta top-level `components/` nao existe, a validacao equivalente deve rodar em `app` e `src`, cobrindo `app/components`.
- A busca retornou resultados esperados de inventario e nao indicou erro de execucao.
- `npm run build` passou com warnings Turbopack/NFT ja conhecidos.
- `git diff --check` passou sem problemas de whitespace.

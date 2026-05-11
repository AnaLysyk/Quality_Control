# Varredura tecnica de recuperacao - 2026-05-10

## Escopo e guardrails

- Objetivo: identificar arquivos, telas, estilos, componentes e logicas perdidas, sobrescritas ou soltas apos trocas/merges de branch, sem restaurar nada cegamente.
- Estado do workspace: havia alteracoes locais nao commitadas antes desta varredura em workflows, APIs de brain/assistant, politicas de permissao e muitos testes. Essas alteracoes foram preservadas.
- Guardrails aplicados: nenhuma alteracao em autenticacao, cookies, middleware, RBAC ou rotas funcionais; nenhuma remocao em massa; nenhuma restauracao ampla de branch antiga.
- Observacao de seguranca: qualquer chave de API exposta fora de cofre/secret manager deve ser rotacionada e nunca versionada.

## Historico Git analisado

Branches locais/remotas relevantes:

- `main` / `origin/main`
- `pr1/estabilizacao` / `origin/pr1/estabilizacao`
- `rescue/antes-code-quebrar` / `origin/rescue/antes-code-quebrar`

Commits recentes com impacto provavel:

- `b8e8d11` - Refatora menu lateral e melhora fluxo de solicitacoes.
- `910d874` - Conecta assistente flutuante ao grafo como agente de automacao.
- `246235c` - Nova sidebar modular com collapse, tema claro/escuro e assistente expandido.
- `b367b4a` - Ajuste de dropdown/layering no Brain.
- `324debd`, `66b087b`, `f385f49` - Evolucao de contexto/autenticacao/comportamento do assistant/brain.
- `7537e70` - Chat workspace.
- `a5388fc` - Refinamento de UI do assistente e textos de auditoria.

## Arquivos deletados recentemente

### Nao restaurar como codigo ativo

- `data/access-requests.json`, `data/audit-logs.json`, `data/releases-store.json`, `data/user-settings.json`, `data/platform-docs.json` e similares: removidos na migracao de persistencia runtime para Postgres/Redis/memoria. Restaurar esses arquivos como fonte ativa reintroduziria divergencia de dados.
- `ai_applying/**`, `UTF8`, relatorios temporarios de deploy e artefatos `__pycache__`: limpeza de subprojeto/debug legado. Sem evidencia de uso atual.
- `app/release/*/page.tsx` de releases estaticas: removidas em favor de rota dinamica e estrutura atual de releases.
- `app/middleware.ts` antigo e `app/components/RequireGlobalDeveloper.tsx`: remocoes sensiveis a auth/RBAC. Nao restaurar sem auditoria especifica de seguranca.
- `tmp/biometric-source/**` e `tmp/profiles-multiple-enrolls/**`: fixtures/artefatos temporarios, nao componentes da plataforma.

### Candidatos a recuperacao documental

- `docs/api/Quality_Control_API_RBAC.postman_collection.json` e environments Postman: podem ser recriados/atualizados como documentacao se ainda forem uteis para QA/API, mas nao devem voltar como dependencia runtime.
- `data/company-docs-griaule.json`, `data/manual-test-plans.json`, `data/platform-docs.json`: se continham conteudo editorial/documental, o caminho seguro e migrar conteudo para store atual ou docs versionadas, nao restaurar JSON runtime solto.

### Candidato a investigacao futura

- `app/admin/operacao/page.tsx`: deletado durante migracao de stores. Precisa ser comparado com a navegacao atual antes de qualquer restauracao, pois pode ter sido substituido por dashboards/areas operacionais mais recentes.

## Brain / Assistente

### Estado atual

- `app/admin/brain/BrainPageClient.tsx` carrega `BrainReactFlowView`.
- `app/admin/brain/BrainReactFlowView.tsx` e a tela funcional atual: React Flow, filtros, lista, tabela, arvore, comunidades, pendencias, replay e comandos.
- A tela atual preserva funcionalidades recentes e nao deve ser substituida pela versao antiga sem perder recursos.

### UI antiga encontrada

- `app/admin/brain/BrainGraphView.tsx` ainda existe, mas nao e importado por rota ativa.
- `app/admin/brain/Brain.module.css` pertence a essa versao antiga e tem tratamento visual mais elaborado: gradientes, paineis, canvas, metricas e hierarquia visual.
- Risco: a versao antiga tem textos/emoji com encoding degradado e nao contem todos os modos atuais do Brain. Portanto, e reaproveitavel como referencia visual, nao como restauracao direta.

### Painel de agentes encontrado

- `app/admin/brain/AgentView.tsx` e `app/admin/brain/AgentView.module.css` existem, tem `data-testid` esperados pela suite e conversam com `/api/brain/ask`.
- Antes da recuperacao segura, esse painel estava desconectado da tela ativa.
- Recomendacao: reconectar como aba adicional dentro do `BrainReactFlowView`, preservando a tela atual e sem trocar rota.

## Orfaos e duplicidades confirmados

### Orfaos ou quase orfaos

- `app/admin/brain/BrainGraphView.tsx`: sem importacao ativa. Classificacao: reaproveitavel como referencia visual, nao restaurar diretamente.
- `app/admin/brain/Brain.module.css`: acoplado ao `BrainGraphView`. Classificacao: referencia visual para extrair tokens/padroes.
- `app/admin/brain/AgentView.tsx`: componente funcional desconectado. Classificacao: reaproveitavel com baixo risco.
- `app/admin/brain/AgentView.module.css`: fica ativo se `AgentView` for reconectado.
- `app/components/theme/ThemeProvider.tsx`: sem uso direto encontrado. Classificacao: candidato a consolidacao futura, sem remover agora.

### Duplicidade visual

- `app/components/theme/TcPrimitives.tsx` ja funciona como inicio de Design System, mas esta em pasta de tema/componente e nao como camada central.
- `app/globals.css` concentra muitos tokens `--tc-*`, porem tambem acumula classes globais e tokens legados.
- Varios componentes e paginas ainda usam Tailwind/hex/rgba diretamente, o que dificulta customizacao pela Tech Company.

## Auditoria de estilos e tokens

Pontos positivos:

- `app/globals.css` ja possui tokens claros/escuros para marca, superficies, texto, bordas, status e shell.
- `app/components/theme/TcPrimitives.tsx` ja oferece primitives reutilizaveis (`TcButton`, `TcInput`, `TcCard`, `TcBadge`, etc.).
- Tema claro/escuro ja existe por `:root` e `:root.dark`.

Riscos atuais:

- Foram encontrados aproximadamente `4602` usos de cores, gradientes, sombras ou valores visuais hardcoded em `app`/`lib` fora de `app/globals.css`.
- Exemplos de concentracao: `app/admin/brain/BrainReactFlowView.tsx`, `app/admin/brain/AgentView.tsx`, `app/settings/profile/page.tsx`, `app/components/ChatButton.tsx`, `app/utils/statusColors.ts`.
- Isso nao deve ser corrigido em uma passada ampla; o caminho seguro e migracao incremental por componente base e pagina.

## Regressoes visuais provaveis

- Brain atual e funcionalmente mais completo, mas visualmente menos consistente que a UI antiga em profundidade, atmosfera e composicao.
- O painel antigo do Brain parece ter melhor acabamento visual, mas nao acompanha as capacidades atuais de analytics/replay/comandos.
- O assistente/agents tinha expectativa de teste e fluxo, mas estava solto da rota ativa.
- A sidebar e shell recentes estao mais modernos, mas ainda dependem de tokens espalhados em `globals.css` e classes hardcoded.

## Recomendacao de restauracao

Restaurar/adaptar agora:

- Conectar `AgentView` como aba "Agentes" dentro do `BrainReactFlowView`.
- Criar fundacao de Design System em `src/design-system`.
- Manter compatibilidade de `TcPrimitives` por re-export para evitar quebrar imports existentes.

Nao restaurar agora:

- `BrainGraphView` como rota principal.
- JSON stores removidos na migracao de persistencia.
- Middleware/auth/RBAC antigos.
- Subprojeto `ai_applying` e artefatos temporarios.

Reaproveitar depois:

- Extrair paleta, atmosferas, paineis e linguagem visual do `Brain.module.css` para tokens/variants do Design System.
- Migrar `BrainReactFlowView` para tokens e primitives sem remover seus modos funcionais.
- Migrar `ChatButton` e `Profile` para os tokens centrais.

## Plano seguro de aplicacao

1. Reconectar `AgentView` como aba isolada, sem alterar rota nem remover modos atuais do Brain.
2. Criar `src/design-system` com tokens, primitives e documentacao de uso.
3. Reexportar primitives existentes a partir do novo Design System, preservando imports atuais.
4. Adicionar alias TypeScript para `@/design-system/*`.
5. Remover apenas o `middleware.ts` stub quando o build confirmar conflito com `proxy.ts`; manter a logica funcional em `proxy.ts`.
6. Validar TypeScript/build focado.
7. Migrar visualmente pagina por pagina em PRs menores, sempre corrigindo origem no Design System quando for padrao global.

## Status desta etapa

- Diagnostico gerado antes da recuperacao segura.
- Implementacao aplicada nesta rodada: aba de agentes do Brain, base inicial do Design System e remocao do `middleware.ts` stub que bloqueava Next 16 por coexistir com `proxy.ts`.
- Itens sensiveis permanecem preservados: autenticacao, cookies, RBAC e rotas principais continuam centralizados no fluxo atual; `proxy.ts` nao foi alterado.
- Validacao: `npx tsc --noEmit --pretty false`, `npm run build` e `npm run test -- --runInBand` passaram.
- Playwright focado: `brain-agents.spec.ts` passou em Chromium; `access-governance-v2.e2e.spec.ts` e `auth-menu.spec.ts` ainda exigem ajuste separado para modo JSON/E2E e expectativas de navegacao/menu.

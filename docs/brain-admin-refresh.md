# Brain Admin Refresh

## Objetivo

Dar ao Brain uma leitura mais proxima de um mapa neural real: fundo contido, arestas discretas, poucos pontos de destaque e uma lateral que ajuda a interpretar o grafo sem poluir a tela.

## O que foi aplicado

- `app/admin/brain/BrainGraphView.tsx`
  - Reestruturado para uma navegacao orientada por contexto.
  - Busca agora serve para localizar e focar nos, sem filtrar o grafo inteiro apos a selecao.
  - A simulacao do canvas foi estabilizada com colecoes memoizadas para evitar reinicios desnecessarios.
  - O painel lateral usa `stats`, `graphMetrics`, `topConnectedNodes`, `alerts`, `suggestions`, `similarNodes`, `relatedMemories`, `ancestors`, `descendants` e `impact`.
- `app/admin/brain/Brain.module.css`
  - Novo layout com topbar em camadas, HUD flutuante, legenda compacta e painel lateral com blocos modulares.
  - Visual dark-first inspirado na referencia anexada, mas com fallback consistente para tema claro.
  - `-webkit-backdrop-filter` aplicado nos elementos com blur para manter compatibilidade com Safari.
- `app/api/brain/stats/route.ts`
  - Strings de alerta normalizadas para o painel nao exibir texto quebrado.

## Linguagem visual

- Hub forte: ponto claro com maior peso visual.
- Foco atual: verde, com halo sutil.
- Periferia: cinza reduzido para nao disputar atencao.
- Arestas: discretas por padrao, reforcadas quando tocam foco, raiz ou impacto.
- Painel: primeiro mostra panorama do Brain; ao selecionar um no, troca para leitura operacional desse contexto.

## Contratos de dados usados na tela

- `useBrainGraph(rootNodeId, depth)`
- `useBrainStats()`
- `useBrainNodeContext(selectedNodeId, depth)`
- `useBrainSearch(query, type, 8)`

## Regras para manter

- Nao voltar a usar a busca como filtro estrutural do grafo; ela deve ser navegacao.
- Se surgirem novos `node.type` ou `memoryType`, atualizar os mapas de cor em `BrainGraphView.tsx`.
- Se o painel crescer, manter o principio atual: panorama sem selecao, detalhe profundo com selecao.
- Qualquer bloco novo no painel deve entrar como secao modular, sem reintroduzir cards redundantes no topo.

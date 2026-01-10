# Testing Metric — Wireframe Lógico

Visão rápida do layout e componentes do painel Testing Metric (desktop-first).

## Hierarquia de telas

- Visão Geral (dashboard principal)
  - Top cards (Sinais imediatos)
  - Mapa de Governança (constelação de empresas)
  - Ranking de Atenção (fila de ação)
  - Tendência de Qualidade (linha do tempo)
  - Consumo do Serviço (valor percebido)
  - Política de Qualidade (regras)

## Componentes principais (nível de tela)

1. Header
   - Título, subtítulo e ações globais (`Atualizar`, `Exportar`, filtros de período)

2. Top Cards
   - Props: `label`, `value`, `icon`, `severity` (none/low/medium/high)
   - Comportamento: clicável; micro-pulse para `high`, soft-oscillate para `medium`.

3. CompanyMap (constelação)
   - Exibe nó por empresa (grid responsivo)
   - Nó mostra: `logo | nome | passRate | riskBadge | trend` e quick-stats
   - Clique no nó abre painel lateral com detalhes (últimas releases, runs, defeitos)

4. AttentionRanking
   - Lista ordenada por `riskScore`
   - Item: `logo`, `nome`, `score`, 3 sinais principais (passRate, runsOpen, criticals)
   - Auto-reordena com transição suave

5. TrendLine
   - Gráfico de linha que se desenha (pass rate ao longo do tempo)
   - Tooltips simples e mensagem limpa quando sem dados

6. ConsumptionList
   - Mini-cards por empresa mostrando `execuções`, `defeitos`, `releases`, `retrabalho` estimado

7. QualityPolicyCard
   - Texto simples com regras (pass rate mínimo, máximos, mínimos)

8. DetailDrawer
   - Painel lateral com métricas por empresa, timeline por release e ações recomendadas

## Interações e fluxos

- Ao clicar em card/topo: filtro aplicado no painel (ex.: clicar `Empresas em Risco` filtra mapa e ranking)
- Ao clicar em nó de empresa: abrir `DetailDrawer` com histórico, recomendações e links para tickets
- Ranking: opção rápida para `Criar ação` ou `Assign` (integração futura com tarefas)

## Micro-motion (regras)

- Pulse lento para risco alto: `transform: scale(1.02)` + sombra + 2.6s ease
- Leve oscilação para atenção: `translateY(-2px)` alternado em 3.6s
- Contadores: animação numérica ao carregar (0 → valor)
- Reordenação: `transform` + `opacity` easing 300ms
- Linha de tendência: desenhar com stroke-dashoffset easing

## Tokens visuais (inicial)

- Vermelho risco: `#ef4444`
- Amarelo atenção: `#f59e0b`
- Verde saudável: `#10b981`
- Azul base: `#2563eb`
- Fundo executivo: `#0f1626`

## Breakpoints

- Desktop principal: ≥ 1024px
- Tablet: 768–1023px (grid reduzido)
- Mobile: <768px (colapsar mapa para lista)

## Notas técnicas

- Preferir CSS transitions + small svg animations; evitar heavy canvas for perf reasons
- Componente `TrendLine` pode usar `recharts` ou `sparkline` custom
- Estado local para interações; centro de dados via hooks que consomem API

---
Arquivo gerado automaticamente para servir como referência de implementação inicial.

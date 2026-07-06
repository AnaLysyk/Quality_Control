# Ajuste da Home Brain

A Home Brain mantém o visual atual e melhora a experiência de resposta.

## Comportamento esperado

- Responder de forma curta, humana e operacional.
- Usar Brain/RAG/banco como contexto principal.
- Usar permissões, ações e rotas para sugerir próximo passo seguro.
- Usar APIs externas gratuitas configuradas apenas como apoio.
- Usar bom humor leve quando fizer sentido, sem atrapalhar momentos sérios.
- Não despejar JSON, IDs técnicos, logs crus ou textos repetitivos.
- Manter contexto completo disponível no painel lateral.

## Clima e localização

- A Home solicita localização pelo navegador quando disponível.
- Se a pessoa permitir, consulta `/api/brain/weather` com latitude e longitude.
- O Brain comenta o tempo da região uma vez por dia na Home.
- Se a pessoa perguntar sobre clima/tempo, a API usa o contexto já capturado.
- Se a localização for negada, a Home continua funcionando normalmente.

## Validação manual

1. Abrir `/admin/home`.
2. Permitir localização no navegador.
3. Confirmar que o Brain comenta o clima da região.
4. Perguntar “como está o tempo?” e validar resposta com o contexto capturado.
5. Negar localização e confirmar que a Home não quebra.

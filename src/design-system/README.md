# Quality Control Design System

Este diretorio e a origem unica para tokens, temas e primitives visuais da plataforma.

## Regra de uso

- Antes de ajustar visual em uma tela, verifique se ja existe token ou componente aqui.
- Se o padrao for global, ajuste o Design System e reaproveite nas telas.
- Evite cores, sombras, radius e gradientes hardcoded em paginas.
- Migracoes devem ser incrementais: componente base primeiro, pagina depois.

## Estrutura inicial

- `tokens.ts`: contrato TypeScript dos tokens visuais.
- `components/primitives.tsx`: primitives base compativeis com as classes globais atuais.
- `index.ts`: ponto de entrada publico.

## Proximas migracoes recomendadas

1. Extrair tokens CSS `--tc-*` de `app/globals.css` para uma camada dedicada de temas.
2. Migrar `BrainReactFlowView`, `ChatButton` e `Profile` para tokens do Design System.
3. Consolidar variantes de `Button`, `Input`, `Card`, `Badge`, `Table`, `Modal`, `Sidebar` e `PageShell`.

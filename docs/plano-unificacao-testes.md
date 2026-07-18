# Unificação dos testes — concluída

> Reescrito na branch `refactor/estrutura-de-pastas` (2026-07-18). Este
> documento descrevia um plano (destino final: `tests/` para Jest e
> `tests-e2e/` separado para Playwright, migração incremental de
> `__tests__/`). O plano foi **concluído e superado**: hoje existe uma única
> pasta de testes. Não confie em cópias antigas deste arquivo.

## Situação atual

Toda a suíte de testes vive em `tests/`, um nível acima do que o plano
original previa — não há mais divisão entre `tests/` (Jest) e `tests-e2e/`
(Playwright); os dois frameworks compartilham a mesma árvore, distinguidos
só pela extensão do arquivo:

- Jest: `tests/**/*.test.ts` e `tests/**/*.test.tsx` (`jest.config.ts`,
  `testMatch`).
- Playwright: `tests/**/*.spec.ts` (`playwright.config.ts`/
  `playwright.prod.config.ts`, `testDir: "tests"`).

`__tests__/` e `tests-e2e/` não existem mais no repositório — não há
referência ativa a nenhum dos dois em nenhum script ou config.

`docs/specs/` (era `specs/` na raiz) continua guardando planos de teste em
Markdown, não testes executáveis — não faz parte desta unificação.

## Convenções

- Jest: `tests/<dominio>-<comportamento>.test.ts` ou `.test.tsx`.
- Playwright: `tests/<área>/<fluxo>.spec.ts`.
- Fixtures/dados de teste: `tools/functions/` (era `support/`), nunca
  `database/` (que é só código de produção de acesso a dados).

## Se aparecer uma referência antiga

Se algum script, doc ou comentário ainda apontar para `tests-e2e/` ou
`__tests__/`, é resíduo de antes desta unificação — corrigir para `tests/`
ao encontrar, não recriar as pastas antigas.

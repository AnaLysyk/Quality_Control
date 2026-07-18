# Plano de unificação dos testes

## Destinos oficiais

- `tests/`: testes unitários, de contrato e de integração executados pelo Jest.
- `tests-e2e/`: fluxos de interface e APIs executados pelo Playwright.

`types/` não contém testes; ele guarda declarações TypeScript globais. `docs/specs/` contém planos de teste em Markdown, não testes executáveis.

## Situação atual

O comando `npm run test` usa `**/tests/**/*.test.ts?(x)`. Portanto, `tests/` é o conjunto Jest padrão.

`__tests__/` é legado e não entra no comando padrão. A exceção conhecida é `npm run brain:test`, que chama `__tests__/brain.test.ts` diretamente.

Mover tudo de uma vez poderia esconder duplicidades, quebrar imports e alterar cobertura. A unificação será incremental.

## Etapas

1. Inventariar arquivos de `__tests__/` e identificar duplicados em `tests/`.
2. Migrar primeiro testes ativos de regras críticas.
3. Atualizar scripts específicos antes de mover o arquivo correspondente.
4. Executar o teste migrado isoladamente e depois `npm run test`.
5. Remover `__tests__/` apenas quando não houver referência em scripts, CI ou documentação.

## Convenções

- Jest: `tests/<dominio>-<comportamento>.test.ts` ou `.test.tsx`.
- Playwright: `tests-e2e/<fluxo>.spec.ts`.
- Utilitários E2E: `tests-e2e/utils/`.
- Planos manuais: manter em `docs/specs/` por enquanto.
- Fixtures compartilhadas: usar `data/` somente quando forem dados de teste, sem regra de negócio.

## Critério de conclusão

A unificação termina quando:

- `npm run test` executa todos os testes Jest ativos;
- nenhum script aponta para `__tests__/`;
- `__tests__/` pode ser removido sem perda de cobertura;
- `tests-e2e/` continua separado por ser uma suíte de natureza diferente.

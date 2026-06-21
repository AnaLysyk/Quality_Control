# Resultado da run - Regressão Quality Control

- Run Qase: Run - Regressão Quality Control - Alinhamento Repositório x Qase - 2026-06-21 (#1)
- Cases adicionados à run: 579
- Entradas `--list` usadas apenas como inventário: 526
- Quantidade executada de verdade nesta etapa: 4
- Passed: 4
- Failed: 0
- Blocked: 0
- Skipped: 0
- Untested: 575

## Comandos executados

| Bloco | Comando | Exit code | Cases relacionados | Status registrado | Duração ms | Headed | Evidência/resumo |
|---|---|---:|---:|---|---:|---|---|
| Playwright API - Esqueci Senha endpoint | npx playwright test testes/api/login/esqueci-senha/esqueci-senha.endpoint.api.spec.ts --project=chromium --workers=1 --reporter=list | 0 | 1 | passed | 110814 | Não | [e2e] JSON mode enabled: skipping prisma db push and seed.<br>[e2e] warmup /admin/clients -> 200<br>[e2e] warmup /admin/access-requests -> 200<br>[e2e] warmup /admin/users -> 200<br>[e2e] warmup /api/health -> 200<br>[e2e] warmup /api/support/access-request -> 401<br>[e2e] warmup /api/admin/access-requests -> 401<br>[e2e] warmup /api/admin/users -> 401<br>[e2e] warmup /api/auth/login -> 405<br><br>Running 1 test using 1 worker<br><br>  ✓  1 [chromium] › testes\api\login\esqueci-senha\esqueci-senha.endpoint.api.spec.ts:8:5 › endpoint nao revela se um email desconhecido esta cadastrado (2.9s)<br><br>  1 passed (1.7m)<br> |
| Playwright UI headed - Validações públicas de Esqueci Senha | npx playwright test testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts --project=chromium --headed --workers=1 --reporter=list | 0 | 3 | passed | 141466 | Sim | [e2e] JSON mode enabled: skipping prisma db push and seed.<br>[e2e] warmup /admin/clients -> 200<br>[e2e] warmup /admin/access-requests -> 200<br>[e2e] warmup /admin/users -> 200<br>[e2e] warmup /api/health -> 200<br>[e2e] warmup /api/support/access-request -> 401<br>[e2e] warmup /api/admin/access-requests -> 401<br>[e2e] warmup /api/admin/users -> 401<br>[e2e] warmup /api/auth/login -> 405<br><br>Running 3 tests using 1 worker<br><br>  ✓  1 [chromium] › testes\ui\login\esqueci-senha\fluxos\validacoes-publicas.ui.spec.ts:8:7 › Esqueci senha - validacoes publicas › tela publica abre sem login (15.0s)<br>  ✓  2 [chromium] › testes\ui\login\esqueci-senha\fluxos\validacoes-publicas.ui.spec.ts:15:7 › Esqueci senha - validacoes publicas › resposta nao permite enumerar e-mail cadastrado (4.7s)<br>  ✓  3 [chromium] › testes\ui\login\esqueci-senha\fluxos\validacoes-publicas.ui.spec.ts:19:7 › Esqueci senha - validacoes publicas › token invalido nao pode ser validado nem consumido (5.9s)<br><br>  3 passed (2.3m)<br> |
| Jest técnico - System roles | npm test -- --runInBand testes/api/geral/system-roles.test.ts | 0 | 0 | passed | 14407 | Não | <br>> quality-control@0.1.0 test<br>> jest --config jest.config.ts --passWithNoTests --testMatch "**/testes/**/*.test.ts?(x)" --runInBand testes/api/geral/system-roles.test.ts<br><br> |

## Regra aplicada

Nenhum case foi marcado como Passed por existir no código ou por aparecer no `--list`. Apenas os cases cobertos pelos comandos reais acima receberam resultado na run. Todos os demais permanecem sem resultado real nesta execução.

## Complemento 2026-06-21 - Run Empresa Solicitações

- Run Qase: Run - Complemento Empresa Solicitações - 2026-06-21 (#2)
- Plano Qase relacionado: #2
- Cases no run complementar: 581
- Passed: 14
- Failed: 0
- Blocked: 0
- Skipped: 0
- Untested: 567

Cases marcados como Passed no run #2:

- #160, #161, #162, #163, #164, #168, #169, #171, #172, #173, #174, #565, #631 e #632.

Comandos executados em modo headed:

| Bloco | Comando | Exit code | Resultado |
|---|---|---:|---|
| Escopo Empresa por empresa | `npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --headed --workers=1 --reporter=list` | 0 | 2 passed em 4.1m |
| Empresa aceita solicitação própria | `npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/empresa/empresa-aceita-solicitacao-propria.ui.spec.ts --headed --workers=1 --reporter=list` | 0 | 2 passed em 2.9m |
| Permissão de acesso ao módulo | `npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/permissao/acessar-modulo.ui.spec.ts --headed --workers=1 --reporter=list` | 0 | 14 passed em 5.0m |

Observações:

- O case de e-mail #174 foi marcado Passed porque a captura estava configurada e o e-mail de aceite foi validado no fluxo positivo.
- E-mails de alteração/recusa por Empresa não foram tratados como Passed isolado nesta rodada.
- Cases #165, #166 e #167 permaneceram Untested no run #2 porque ajuste próprio, recusa própria e comentário próprio não foram executados.

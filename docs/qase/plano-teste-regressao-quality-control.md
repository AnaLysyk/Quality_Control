# Plano de teste - Regressão Quality Control

- Nome do plano: Regressão Quality Control - Completa por Tela e Automação
- Plano Qase: #2 (created)
- Run criada: Run - Regressão Quality Control - Alinhamento Repositório x Qase - 2026-06-21 (#1)
- Objetivo: manter Qase como documentação navegável e viva da pasta `testes/`.
- Escopo: todos os arquivos `.spec.ts`, `.test.ts` e `.test.tsx` dentro de `testes/`.
- Quantidade de cases do inventário técnico: 458
- Quantidade total de cases no Qase após sincronização: 581
- Run complementar: Run - Complemento Empresa Solicitações - 2026-06-21 (#2)

## Quantidade por camada

- API: 209
- BD: 31
- UI: 216

## Quantidade por perfil

- Admin: 36
- Admin, Usuário: 6
- Empresa: 67
- Empresa, Admin: 14
- Empresa, Admin, Usuário: 4
- Empresa, Usuário: 8
- Empresa, Usuário Empresa: 11
- Empresa, Usuário Empresa, Admin: 2
- Empresa, Usuário Empresa, Usuário: 3
- Empresa, Usuário Empresa, Usuário TC, Admin, Usuário: 1
- Empresa, Usuário Empresa, Usuário TC, Usuário: 3
- Empresa, Usuário TC: 1
- Empresa, Usuário TC, Admin: 1
- Líder TC: 24
- Líder TC, Admin: 6
- Líder TC, Empresa: 1
- Líder TC, Empresa, Admin: 1
- Líder TC, Empresa, Usuário Empresa: 1
- Líder TC, Suporte Técnico: 4
- Líder TC, Usuário TC: 1
- Não específico: 179
- Suporte Técnico: 34
- Suporte Técnico, Admin: 5
- Suporte Técnico, Empresa: 2
- Suporte Técnico, Empresa, Admin: 1
- Suporte Técnico, Empresa, Usuário Empresa: 1
- Suporte Técnico, Usuário: 1
- Suporte Técnico, Usuário TC: 1
- Usuário: 31
- Usuário TC: 5
- Usuário TC, Admin: 1

## Suites

- Regressão > Documentação viva testes > API > defeitos: 1
- Regressão > Documentação viva testes > API > geral: 76
- Regressão > Documentação viva testes > API > permissoes: 50
- Regressão > Documentação viva testes > API > rotas: 2
- Regressão > Documentação viva testes > API > runs: 2
- Regressão > Documentação viva testes > API > solicitacoes: 20
- Regressão > Documentação viva testes > API > solicitar-acesso: 37
- Regressão > Documentação viva testes > API > usuarios: 19
- Regressão > Documentação viva testes > BD > persistencia: 19
- Regressão > Documentação viva testes > BD > solicitar-acesso: 4
- Regressão > Documentação viva testes > UI > alertas: 1
- Regressão > Documentação viva testes > UI > automacoes: 12
- Regressão > Documentação viva testes > UI > brain: 5
- Regressão > Documentação viva testes > UI > casos-de-teste: 5
- Regressão > Documentação viva testes > UI > clientes: 2
- Regressão > Documentação viva testes > UI > dashboard: 16
- Regressão > Documentação viva testes > UI > defeitos: 13
- Regressão > Documentação viva testes > UI > documentos: 2
- Regressão > Documentação viva testes > UI > empresas: 5
- Regressão > Documentação viva testes > UI > geral: 30
- Regressão > Documentação viva testes > UI > repositorio-casos: 5
- Regressão > Documentação viva testes > UI > runs: 11
- Regressão > Documentação viva testes > UI > sistema: 23
- Regressão > Documentação viva testes > UI > smoke: 6
- Regressão > Documentação viva testes > UI > usuarios: 13
- Regressão > Login > Acesso: 8
- Regressão > Login > Esqueci Senha: 22
- Regressão > Login > Solicitar Acesso — Usuário Público: 47

## Critérios de entrada

- Ambiente local disponível.
- Dependências instaladas.
- Seeds, banco, outbox e usuários preparados conforme cada teste.
- Para UI, navegador disponível; quando o objetivo for validação visual, usar `--headed`.

## Critérios de saída

- Todos os testes da pasta `testes/` inventariados.
- Todos os testes com case Qase vinculado por `AUTO_DOC_ID`.
- Plano e run criados/atualizados.
- Resultados reais registrados apenas para comandos executados de verdade.
- Testes não executados permanecem Untested na run.

## Ordem de execução recomendada

1. Typecheck.
2. Smoke/UI básico com navegador aberto.
3. Login, Esqueci Senha e Solicitar Acesso.
4. API e contratos.
5. BD e persistência.
6. Demais telas por pasta.

## Estratégia manual

Cada case possui passos manuais equivalentes. O QA deve usar o case Qase como roteiro, anexar evidências e não depender da automação para decidir aprovação manual.

## Estratégia automatizada

Rodar o comando registrado no case. `--list` é inventário, não execução. Só registrar Passed quando o comando real do teste for executado e passar.

## Complemento 2026-06-21 - Empresa em Solicitações

Regra oficial aplicada: Empresa possui acesso restrito à tela Solicitações e pode executar o fluxo completo de análise apenas para solicitações vinculadas à própria empresa. Solicitações de outras empresas não devem ser exibidas nem acessíveis por URL direta ou API.

- Qase atualizado de 579 para 581 cases.
- Cases manuais #160 a #174 atualizados com a regra oficial.
- Cases técnicos criados: #631 `[AUTO] Empresa deve aceitar solicitacao vinculada a propria empresa` e #632 `[AUTO] Empresa deve acessar somente a tela Solicitações dentro do admin`.
- Plano Qase #2 atualizado para conter 581 cases.
- Run complementar #2 vinculada ao plano completo: 581 cases no run, 14 resultados Passed e 567 Untested. Cases com Passed: #160, #161, #162, #163, #164, #168, #169, #171, #172, #173, #174, #565, #631 e #632.
- Cases #165, #166 e #167 permanecem sem Passed neste complemento porque ajuste, recusa e comentário próprios não foram executados nos comandos headed desta rodada.

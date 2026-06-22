# Ajuste local da estrutura de regressao Qase

Data: 2026-06-21

## 1. Estrutura encontrada antes

- Os documentos locais ja apontavam `Regressão` como raiz, mas ainda havia classificacoes antigas em parte do material.
- Casos de consulta publica estavam misturados diretamente em `Regressão > Login > Solicitar Acesso — Usuário Público`, sem a suite filha `Consulta Pública`.
- Havia rastros de sincronizacao/execucao anterior em arquivos locais de apoio, incluindo referencias a run e contagem de passed.
- Nao foi encontrado arquivo local separado de export do Qase para comparacao; a validacao estrutural foi feita sobre os artefatos locais em `docs/qase/`, especialmente o CSV `qase-import-regressao-login-solicitacoes.csv`.

## 2. Estrutura correta aplicada

- `Regressão > Login > Acesso`
- `Regressão > Login > Esqueci Senha`
- `Regressão > Login > Solicitar Acesso — Usuário Público`
- `Regressão > Login > Solicitar Acesso — Usuário Público > Consulta Pública`
- `Regressão > Solicitações > Líder TC`
- `Regressão > Solicitações > Suporte Técnico`
- `Regressão > Solicitações > Empresa`

## 3. Quantidade de cases por suite apos ajuste local

Base: `docs/qase/qase-import-regressao-login-solicitacoes.csv`

- `Regressão > Login > Acesso`: 8
- `Regressão > Login > Esqueci Senha`: 22
- `Regressão > Login > Solicitar Acesso — Usuário Público`: 25
- `Regressão > Login > Solicitar Acesso — Usuário Público > Consulta Pública`: 10
- `Regressão > Solicitações > Líder TC`: 2
- `Regressão > Solicitações > Suporte Técnico`: 7
- `Regressão > Solicitações > Empresa`: 3

## 4. Suites renomeadas

- Padrao final aplicado: `Login` como bloco principal de autenticacao.
- Nao restou ocorrencia final da suite antiga de login nos arquivos revisados.
- Normalizacao textual aplicada em referencias locais de perfil: `Suporte Técnico`.

## 5. Suites movidas/reclassificadas

- `Consulta Pública` foi consolidada como suite filha de `Solicitar Acesso — Usuário Público`.
- `Solicitações` permaneceu como bloco irmao de `Login` dentro de `Regressão`.
- `Líder TC`, `Suporte Técnico` e `Empresa` permaneceram classificadas dentro de `Solicitações`.

## 6. Cases que mudaram de suite

Foram reclassificados 10 cases automatizados de consulta publica no CSV e nos documentos de apoio:

- `VISUAL - Consulta de status da solicitação por perfil` para os perfis Empresa, Líder TC, Suporte Técnico, Usuário da empresa e Usuário Testing Company.
- `Solicitações de acesso - consulta/status UI`:
  - `deve consultar status e mostrar em análise com datas`
  - `deve consultar manualmente por e-mail e token`
  - `deve mostrar aprovado quando solicitação for aprovada`
  - `deve mostrar recusado quando solicitação for recusada`
  - `deve mostrar campos de correção quando houver ajuste`

Tambem foram corrigidos os registros de rastreabilidade:

- `QC-REG-LS-041`
- `QC-REG-LS-048`
- `QC-REG-LS-055`
- `QC-REG-LS-062`
- `QC-REG-LS-069`

Todos agora apontam para `Regressão > Login > Solicitar Acesso — Usuário Público > Consulta Pública`.

## 7. Cases duplicados encontrados

Foram encontrados titulos repetidos no CSV, sem duplicacao de suite criada por este ajuste:

- 3x `[AUTO] recupera senha, invalida token e preserva vinculo de empresa`
- 2x `[AUTO] deve criar solicitação, validar e-mail recebido e consultar status pendente`
- 2x `[AUTO] recupera senha, invalida token e mantem perfil administrativo`

Observacao: as repeticoes ocorrem por perfis/cenarios distintos; nao foi criada nova duplicacao nesta etapa.

## 8. Cases sem suite correta

- Nenhum caso de `testes/ui/login/esqueci-senha` ou `testes/ui/login/solicitar-acesso` ficou fora das suites-alvo verificadas nesta etapa.
- Nenhuma ocorrencia final da suite antiga de login permaneceu nos arquivos revisados.

## 9. Testes internos listados por comando

### `npx playwright test testes/ui/login/esqueci-senha --project=chromium --list`

- Resultado: 14 testes em 8 arquivos.
- Cobertura listada: acessibilidade, fluxos por perfil, validacoes publicas e cenarios dedicados para Empresa, Usuario da Empresa, Usuario TC, Lider TC e Suporte Tecnico.

### `npx playwright test testes/ui/login/solicitar-acesso --project=chromium --list`

- Resultado: 49 testes em 16 arquivos.
- Cobertura listada: formulario publico, consulta/status, consulta publica por perfil, fluxos de ajustes/recusa, acessibilidade e modulo administrativo de solicitacoes.

### `npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes --project=chromium --list`

- Resultado: 21 testes em 9 arquivos.
- Cobertura listada: acessibilidade, aprovacao, email, escopo por empresa, fluxo completo, endpoints e permissoes do modulo `Solicitações`.

## 10. Resultado do typecheck

Comando executado:

```bash
npm run typecheck -- --pretty false
```

Resultado:

- Sucesso.
- Sem erros de TypeScript reportados pelo comando.

## 11. Resultado dos comandos `--list`

Todos os comandos terminaram com sucesso:

- `esqueci-senha`: ok
- `solicitar-acesso`: ok
- `gestao-solicitacoes`: ok

Totais:

- 14 testes
- 49 testes
- 21 testes

## 12. Pendencias para quando o token Qase estiver disponivel

- Validar a estrutura final diretamente no projeto Qase `qc`.
- Restaurar ou confirmar o script de sincronizacao local, pois `docs/qase/sincronizar-documentacao-viva.mjs` nao foi encontrado no workspace durante esta etapa.
- Executar a sincronizacao somente apos revisar o CSV ajustado e confirmar a hierarquia final no Qase.
- Revisar no Qase os titulos repetidos ja existentes para decidir se representam parametrizacao legitima ou necessidade de consolidacao manual.

## 13. Comando de sincronizacao futura com Qase

Nao executado nesta etapa.

Comando sugerido, condicionado a restauracao/confirmacao do script local:

```bash
node docs/qase/sincronizar-documentacao-viva.mjs
```

## Arquivos locais ajustados

- `docs/qase/regressao-login-solicitacoes-plano-manual.md`
- `docs/qase/matriz-rastreabilidade-login-solicitacoes.md`
- `docs/qase/matriz-qase-vs-repositorio.md`
- `docs/qase/plano-teste-regressao-quality-control.md`
- `docs/qase/qase-import-regressao-login-solicitacoes.csv`
- `docs/qase/cobertura-automacao-login-solicitacoes.md`
- `docs/qase/mapa-fluxos-por-perfil.md`
- `docs/qase/qase-sync-resultado.md`
- `docs/qase/resultado-run-regressao-quality-control.md`
- `docs/qase/lacunas-repositorio-qase.md`
- `docs/qase/inventario-testes-repositorio.md`

## Estado do git

`git status --short` ao final desta etapa mostrou somente alteracoes em `docs/qase/`.

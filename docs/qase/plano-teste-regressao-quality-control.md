# Plano de teste - Regressao Quality Control
- Objetivo local desta etapa: ajustar a estrutura da documentacao Qase da regressao sem usar token, sem chamar API do Qase e sem executar sincronizacao.
- Escopo desta etapa: arquivos em docs/qase/ e o CSV docs/qase/qase-import-regressao-login-solicitacoes.csv.
- Status da etapa: preparacao local concluida para sincronizacao futura.
- Estrutura alvo da regressao:
`	ex
Regressao
  Login
    Acesso
    Esqueci Senha
    Solicitar Acesso - Usuario Publico
      Consulta Publica
  Solicitacoes
    Lider TC
    Suporte Tecnico
    Empresa

## Regras desta preparacao local
- Nao usar QASE_API_TOKEN.
- Nao chamar API do Qase.
- Nao criar run.
- Nao criar plano novo.
- Nao marcar cases como executados.
- Nao alterar regra de negocio.
- Nao alterar codigo funcional.
- Nao alterar testes nesta etapa.
## Criterios locais de consistencia
- A suite final da autenticacao deve ser Login.
- Acesso, Esqueci Senha e Solicitar Acesso - Usuario Publico devem ficar dentro de Regressao > Login.
- Consulta Publica deve ficar dentro de Regressao > Login > Solicitar Acesso - Usuario Publico.
- Lider TC, Suporte Tecnico e Empresa devem ficar dentro de Regressao > Solicitacoes.
- O CSV e os documentos locais devem refletir a mesma estrutura.
- Nenhum teste mapeado deve ficar sem suite coerente na regressao.
## Execucao local desta etapa
- Validacao estrutural por revisao de documentos e CSV.
-
pm run typecheck -- --pretty false.
-
px playwright test testes/ui/login/esqueci-senha --project=chromium --list.
-
px playwright test testes/ui/login/solicitar-acesso --project=chromium --list.
-
px playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes --project=chromium --list.
## Proximo passo
A sincronizacao com o Qase fica pendente para quando houver token e um script local de sync definido ou confirmado.

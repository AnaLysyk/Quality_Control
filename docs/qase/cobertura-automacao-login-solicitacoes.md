# Cobertura de automaÃ§Ã£o - Login e SolicitaÃ§Ãµes

## VisÃ£o geral

- Total de casos manuais planejados: 123
- Automatizados UI: 25
- Automatizados API: 26
- Automatizados BD: 1
- Automatizados E2E: 22
- Parcialmente automatizados: 30
- Candidatos Ã  automaÃ§Ã£o: 18
- Precisa anÃ¡lise: 1

## Casos jÃ¡ automatizados

- QC-REG-LS-010 - Perfil autenticado deve visualizar somente menus permitidos (Automatizado UI)
  - Arquivo: testes/ui/login/login/menu-autenticado.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-013 - Tela pÃºblica de Esqueci Senha deve abrir sem login (Automatizado UI)
  - Arquivo: testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-015 - Esqueci Senha com e-mail ou usuÃ¡rio invÃ¡lido nÃ£o deve permitir enumeraÃ§Ã£o (Automatizado UI)
  - Arquivo: testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts; testes/api/login/esqueci-senha/esqueci-senha.endpoint.api.spec.ts
  - Comando: npx playwright test testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/login/esqueci-senha/esqueci-senha.endpoint.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-016 - Redefinir senha com token ou chave invÃ¡lida deve ser bloqueado (Automatizado UI)
  - Arquivo: testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-019 - Tela de Esqueci Senha deve atender acessibilidade crÃ­tica (Automatizado UI)
  - Arquivo: testes/ui/login/esqueci-senha/acessibilidade/esqueci-senha.acessibilidade.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/esqueci-senha/acessibilidade/esqueci-senha.acessibilidade.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-020 - GeraÃ§Ã£o de senha temporÃ¡ria deve respeitar complexidade e caracteres proibidos (Automatizado BD)
  - Arquivo: testes/bd/login/senha-temporaria/temp-password-generation.test.ts
  - Comando: npm test -- testes/bd/login/senha-temporaria/temp-password-generation.test.ts --runInBand
- QC-REG-LS-021 - Empresa deve recuperar senha, invalidar senha antiga e preservar permissÃµes (Automatizado E2E)
  - Arquivo: testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts; testes/ui/login/esqueci-senha/empresa/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/empresa/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-023 - UsuÃ¡rio Empresa deve recuperar senha, invalidar senha antiga e preservar permissÃµes (Automatizado E2E)
  - Arquivo: testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts; testes/ui/login/esqueci-senha/usuario-empresa/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/usuario-empresa/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-025 - UsuÃ¡rio TC deve recuperar senha, invalidar senha antiga e preservar permissÃµes (Automatizado E2E)
  - Arquivo: testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts; testes/ui/login/esqueci-senha/usuario-tc/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/usuario-tc/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-027 - LÃ­der TC deve recuperar senha, invalidar senha antiga e preservar permissÃµes (Automatizado E2E)
  - Arquivo: testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts; testes/ui/login/esqueci-senha/lider-tc/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/lider-tc/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-029 - Suporte TÃ©cnico deve recuperar senha, invalidar senha antiga e preservar permissÃµes (Automatizado E2E)
  - Arquivo: testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts; testes/ui/login/esqueci-senha/suporte-tecnico/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/suporte-tecnico/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-031 - Tela pÃºblica de Solicitar Acesso deve abrir e adaptar campos conforme perfil (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-035 - SolicitaÃ§Ã£o duplicada deve ser bloqueada sem gerar novo e-mail (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/gestao-solicitacoes/email/capturar-e-reenviar-email-solicitacao.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/email/capturar-e-reenviar-email-solicitacao.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-036 - SolicitaÃ§Ã£o pÃºblica criada deve aparecer na tela interna de SolicitaÃ§Ãµes (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-037 - FormulÃ¡rio pÃºblico de Solicitar Acesso deve atender acessibilidade crÃ­tica (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/formulario-publico/acessibilidade/formulario.acessibilidade.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/acessibilidade/formulario.acessibilidade.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-038 - Campos de Empresa devem validar CNPJ, CEP e vÃ­nculo quando o perfil exigir dados empresariais (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-039 - UsuÃ¡rio pÃºblico deve solicitar acesso como Empresa, receber e-mail inicial e acompanhar status (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-041 - Consulta pÃºblica inicial de Empresa deve exibir status aguardando anÃ¡lise e dados essenciais (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-042 - E-mail de aceite para Empresa deve liberar login e preservar permissÃµes (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-043 - E-mail de alteraÃ§Ã£o para Empresa deve orientar correÃ§Ã£o e devolver solicitaÃ§Ã£o para anÃ¡lise (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-044 - E-mail de recusa para Empresa deve informar justificativa e bloquear login (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-045 - Empresa deve passar por ajustes, conversa, aprovaÃ§Ã£o final e login (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-046 - UsuÃ¡rio pÃºblico deve solicitar acesso como UsuÃ¡rio Empresa, receber e-mail inicial e acompanhar status (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-048 - Consulta pÃºblica inicial de UsuÃ¡rio Empresa deve exibir status aguardando anÃ¡lise e dados essenciais (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-049 - E-mail de aceite para UsuÃ¡rio Empresa deve liberar login e preservar permissÃµes (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-050 - E-mail de alteraÃ§Ã£o para UsuÃ¡rio Empresa deve orientar correÃ§Ã£o e devolver solicitaÃ§Ã£o para anÃ¡lise (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-051 - E-mail de recusa para UsuÃ¡rio Empresa deve informar justificativa e bloquear login (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-052 - UsuÃ¡rio Empresa deve passar por ajustes, conversa, aprovaÃ§Ã£o final e login (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-053 - UsuÃ¡rio pÃºblico deve solicitar acesso como UsuÃ¡rio TC, receber e-mail inicial e acompanhar status (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-055 - Consulta pÃºblica inicial de UsuÃ¡rio TC deve exibir status aguardando anÃ¡lise e dados essenciais (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-056 - E-mail de aceite para UsuÃ¡rio TC deve liberar login e preservar permissÃµes (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-057 - E-mail de alteraÃ§Ã£o para UsuÃ¡rio TC deve orientar correÃ§Ã£o e devolver solicitaÃ§Ã£o para anÃ¡lise (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-058 - E-mail de recusa para UsuÃ¡rio TC deve informar justificativa e bloquear login (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-059 - UsuÃ¡rio TC deve passar por ajustes, conversa, aprovaÃ§Ã£o final e login (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-060 - UsuÃ¡rio pÃºblico deve solicitar acesso como LÃ­der TC, receber e-mail inicial e acompanhar status (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-062 - Consulta pÃºblica inicial de LÃ­der TC deve exibir status aguardando anÃ¡lise e dados essenciais (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-063 - E-mail de aceite para LÃ­der TC deve liberar login e preservar permissÃµes (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-064 - E-mail de alteraÃ§Ã£o para LÃ­der TC deve orientar correÃ§Ã£o e devolver solicitaÃ§Ã£o para anÃ¡lise (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-065 - E-mail de recusa para LÃ­der TC deve informar justificativa e bloquear login (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-066 - LÃ­der TC deve passar por ajustes, conversa, aprovaÃ§Ã£o final e login (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-067 - UsuÃ¡rio pÃºblico deve solicitar acesso como Suporte TÃ©cnico, receber e-mail inicial e acompanhar status (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-069 - Consulta pÃºblica inicial de Suporte TÃ©cnico deve exibir status aguardando anÃ¡lise e dados essenciais (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-070 - E-mail de aceite para Suporte TÃ©cnico deve liberar login e preservar permissÃµes (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-071 - E-mail de alteraÃ§Ã£o para Suporte TÃ©cnico deve orientar correÃ§Ã£o e devolver solicitaÃ§Ã£o para anÃ¡lise (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-072 - E-mail de recusa para Suporte TÃ©cnico deve informar justificativa e bloquear login (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-073 - Suporte TÃ©cnico deve passar por ajustes, conversa, aprovaÃ§Ã£o final e login (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-074 - Consulta pÃºblica pelo link recebido no e-mail deve abrir a solicitaÃ§Ã£o correta (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts; testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-075 - Consulta manual por e-mail e token deve retornar status sem expor chave em resposta pÃºblica (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-076 - Consulta com status aguardando anÃ¡lise deve exibir datas e mensagem de acompanhamento (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts; testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-077 - Consulta apÃ³s solicitaÃ§Ã£o de alteraÃ§Ã£o deve exibir campos e comentÃ¡rios de correÃ§Ã£o (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-078 - Consulta apÃ³s correÃ§Ã£o enviada deve retornar solicitaÃ§Ã£o para anÃ¡lise (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-079 - Consulta apÃ³s aprovaÃ§Ã£o deve exibir status aprovado e orientaÃ§Ã£o de acesso (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts; testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-080 - Consulta apÃ³s recusa ou rejeiÃ§Ã£o deve exibir status final e justificativa (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts; testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-081 - Consulta com link ou chave invÃ¡lida nÃ£o deve expor erro interno (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts; testes/api/solicitar-acesso/endpoints/endpoints-publicos.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/endpoints/endpoints-publicos.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-084 - Consulta deve aceitar somente campos solicitados para correÃ§Ã£o (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-085 - Consulta nÃ£o deve permitir nova correÃ§Ã£o apÃ³s retorno para anÃ¡lise (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-086 - Reenvio de cÃ³digo de consulta deve enviar e-mail sem revelar accessKey na resposta (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-087 - LÃ­der TC acessa tela de SolicitaÃ§Ãµes e visualiza fila de anÃ¡lise (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-090 - LÃ­der TC aceita solicitaÃ§Ã£o e libera login do usuÃ¡rio (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-091 - LÃ­der TC solicita alteraÃ§Ã£o com comentÃ¡rio e campos especÃ­ficos (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-092 - UsuÃ¡rio pÃºblico corrige dados e LÃ­der TC aprova apÃ³s correÃ§Ã£o (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/fluxo-completo/solicitacao-ajuste-aprovacao.ui.spec.ts; testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/fluxo-completo/solicitacao-ajuste-aprovacao.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-093 - LÃ­der TC recusa solicitaÃ§Ã£o com justificativa obrigatÃ³ria (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-094 - LÃ­der TC comenta solicitaÃ§Ã£o e histÃ³rico deve preservar conversa (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-095 - AÃ§Ãµes do LÃ­der TC devem enviar e-mails corretos de aceite, alteraÃ§Ã£o e recusa (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-097 - Rota antiga /admin/requests nÃ£o deve existir como fluxo vÃ¡lido (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-098 - Tela de SolicitaÃ§Ãµes para LÃ­der TC deve atender acessibilidade crÃ­tica (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/acessibilidade/validar-acessibilidade-tela-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/acessibilidade/validar-acessibilidade-tela-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-099 - Suporte TÃ©cnico acessa tela de SolicitaÃ§Ãµes quando autorizado (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-102 - Suporte TÃ©cnico aceita solicitaÃ§Ã£o permitida e libera login (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-103 - Suporte TÃ©cnico solicita alteraÃ§Ã£o e recebe dados corrigidos (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-104 - Suporte TÃ©cnico recusa solicitaÃ§Ã£o com motivo e e-mail (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-108 - PermissÃµes do Suporte TÃ©cnico devem ser respeitadas na navegaÃ§Ã£o base (Automatizado API)
  - Arquivo: testes/api/navegacao/perfil-suporte-navegacao-base.test.ts
  - Comando: npm test -- testes/api/navegacao/perfil-suporte-navegacao-base.test.ts --runInBand
- QC-REG-LS-110 - Empresa visualiza somente solicitaÃ§Ãµes vinculadas Ã  prÃ³pria empresa (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-111 - Empresa nÃ£o visualiza solicitaÃ§Ã£o de outra empresa na busca ou listagem (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-122 - Fluxo de escopo da Empresa deve usar pelo menos duas empresas distintas (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list


## Casos parcialmente automatizados

- QC-REG-LS-001 - Login com perfil LÃ­der TC deve autenticar e exibir mÃ³dulos administrativos permitidos (Parcialmente automatizado)
  - Arquivo: testes/ui/login/login/login-real.ui.spec.ts; testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/login/login-real.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-002 - Login com perfil Suporte TÃ©cnico deve autenticar e exibir apenas mÃ³dulos permitidos (Parcialmente automatizado)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts; testes/api/navegacao/perfil-suporte-navegacao-base.test.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
npm test -- testes/api/navegacao/perfil-suporte-navegacao-base.test.ts --runInBand
- QC-REG-LS-003 - Login com perfil Empresa deve autenticar no escopo da prÃ³pria empresa (Parcialmente automatizado)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts; testes/ui/login/login/menu-autenticado.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-004 - Login com UsuÃ¡rio Empresa deve autenticar em contexto empresarial e bloquear admin global (Parcialmente automatizado)
  - Arquivo: testes/ui/login/login/menu-autenticado.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
  - Comando: npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-005 - Login com UsuÃ¡rio TC deve autenticar preservando perfil e permissÃµes internas (Parcialmente automatizado)
  - Arquivo: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-009 - Rota protegida sem login deve bloquear acesso e redirecionar para Login (Parcialmente automatizado)
  - Arquivo: testes/ui/login/login/login-real.ui.spec.ts; testes/ui/login/login/menu-autenticado.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/login/login-real.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-011 - Perfil autenticado nÃ£o deve acessar rota fora da permissÃ£o via URL direta (Parcialmente automatizado)
  - Arquivo: testes/ui/login/login/menu-autenticado.ui.spec.ts; testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-022 - E-mail de recuperaÃ§Ã£o para Empresa deve orientar redefiniÃ§Ã£o sem expor dados indevidos (Parcialmente automatizado)
  - Arquivo: testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts; testes/ui/login/esqueci-senha/empresa/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/empresa/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-024 - E-mail de recuperaÃ§Ã£o para UsuÃ¡rio Empresa deve orientar redefiniÃ§Ã£o sem expor dados indevidos (Parcialmente automatizado)
  - Arquivo: testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts; testes/ui/login/esqueci-senha/usuario-empresa/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/usuario-empresa/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-026 - E-mail de recuperaÃ§Ã£o para UsuÃ¡rio TC deve orientar redefiniÃ§Ã£o sem expor dados indevidos (Parcialmente automatizado)
  - Arquivo: testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts; testes/ui/login/esqueci-senha/usuario-tc/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/usuario-tc/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-028 - E-mail de recuperaÃ§Ã£o para LÃ­der TC deve orientar redefiniÃ§Ã£o sem expor dados indevidos (Parcialmente automatizado)
  - Arquivo: testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts; testes/ui/login/esqueci-senha/lider-tc/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/lider-tc/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-030 - E-mail de recuperaÃ§Ã£o para Suporte TÃ©cnico deve orientar redefiniÃ§Ã£o sem expor dados indevidos (Parcialmente automatizado)
  - Arquivo: testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts; testes/ui/login/esqueci-senha/suporte-tecnico/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/suporte-tecnico/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-040 - E-mail de solicitaÃ§Ã£o recebida para Empresa deve conter dados e link de consulta (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-047 - E-mail de solicitaÃ§Ã£o recebida para UsuÃ¡rio Empresa deve conter dados e link de consulta (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-054 - E-mail de solicitaÃ§Ã£o recebida para UsuÃ¡rio TC deve conter dados e link de consulta (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-061 - E-mail de solicitaÃ§Ã£o recebida para LÃ­der TC deve conter dados e link de consulta (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-068 - E-mail de solicitaÃ§Ã£o recebida para Suporte TÃ©cnico deve conter dados e link de consulta (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-082 - Consulta de solicitaÃ§Ã£o inexistente deve orientar usuÃ¡rio sem enumerar dados (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/endpoints/endpoints-publicos.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/endpoints/endpoints-publicos.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-083 - Consulta pÃºblica nÃ£o deve expor senha, dados administrativos ou campos nÃ£o necessÃ¡rios (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-088 - LÃ­der TC visualiza solicitaÃ§Ãµes de todos os perfis permitidos (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/listar-solicitacoes.positivo.api.spec.ts; testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/listar-solicitacoes.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-089 - LÃ­der TC abre detalhes da solicitaÃ§Ã£o e visualiza dados do solicitante (Parcialmente automatizado)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/endpoints/validar-endpoints-tela-solicitacoes.ui.spec.ts; testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/endpoints/validar-endpoints-tela-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-096 - SolicitaÃ§Ã£o finalizada por LÃ­der TC nÃ£o deve permitir alteraÃ§Ã£o indevida (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-100 - Suporte TÃ©cnico visualiza solicitaÃ§Ãµes permitidas sem acessar itens proibidos (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/listar-solicitacoes.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/listar-solicitacoes.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-101 - Suporte TÃ©cnico abre detalhes da solicitaÃ§Ã£o permitida (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-106 - Suporte TÃ©cnico nÃ£o deve visualizar aÃ§Ãµes administrativas indevidas (Parcialmente automatizado)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts; testes/api/suporte/support-access.test.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
npm test -- testes/api/suporte/support-access.test.ts --runInBand
- QC-REG-LS-107 - Suporte TÃ©cnico comenta solicitaÃ§Ã£o quando permitido (Parcialmente automatizado)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-109 - Empresa acessa tela de SolicitaÃ§Ãµes com escopo da prÃ³pria empresa (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-118 - Empresa nÃ£o acessa admin inteiro fora do escopo permitido (Automatizado UI)
  - Arquivo: testes/ui/login/login/menu-autenticado.ui.spec.ts; testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-119 - Empresa nÃ£o visualiza dados administrativos fora do escopo (Parcialmente automatizado)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts; testes/ui/login/login/menu-autenticado.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-121 - UsuÃ¡rio aprovado por Empresa deve entrar com escopo correto da empresa (Automatizado E2E)
  - Arquivo: testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts; testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list


## Casos somente manuais ou candidatos Ã  automaÃ§Ã£o

- QC-REG-LS-006 - Login com credenciais invÃ¡lidas deve falhar sem criar sessÃ£o (Candidato Ã  automaÃ§Ã£o)
  - Arquivo: NÃ£o localizado
  - Comando: NÃ£o aplicÃ¡vel
- QC-REG-LS-007 - Login sem preencher campos obrigatÃ³rios deve orientar o usuÃ¡rio e impedir envio (Candidato Ã  automaÃ§Ã£o)
  - Arquivo: NÃ£o localizado
  - Comando: NÃ£o aplicÃ¡vel
- QC-REG-LS-008 - Logout deve encerrar sessÃ£o e impedir reutilizaÃ§Ã£o da Ã¡rea autenticada (Candidato Ã  automaÃ§Ã£o)
  - Arquivo: NÃ£o localizado
  - Comando: NÃ£o aplicÃ¡vel
- QC-REG-LS-012 - SessÃ£o expirada deve redirecionar para Login sem manter dados sensÃ­veis em tela (Candidato Ã  automaÃ§Ã£o)
  - Arquivo: NÃ£o localizado
  - Comando: NÃ£o aplicÃ¡vel
- QC-REG-LS-014 - Esqueci Senha deve validar campos obrigatÃ³rios antes de solicitar recuperaÃ§Ã£o (Candidato Ã  automaÃ§Ã£o)
  - Arquivo: NÃ£o localizado
  - Comando: NÃ£o aplicÃ¡vel
- QC-REG-LS-017 - RedefiniÃ§Ã£o deve rejeitar senha fora do padrÃ£o de seguranÃ§a (Candidato Ã  automaÃ§Ã£o)
  - Arquivo: NÃ£o localizado
  - Comando: NÃ£o aplicÃ¡vel
- QC-REG-LS-018 - RedefiniÃ§Ã£o deve rejeitar confirmaÃ§Ã£o de senha divergente (Candidato Ã  automaÃ§Ã£o)
  - Arquivo: NÃ£o localizado
  - Comando: NÃ£o aplicÃ¡vel
- QC-REG-LS-032 - Solicitar Acesso deve validar campos obrigatÃ³rios antes de criar solicitaÃ§Ã£o (Candidato Ã  automaÃ§Ã£o)
  - Arquivo: NÃ£o localizado
  - Comando: NÃ£o aplicÃ¡vel
- QC-REG-LS-033 - Solicitar Acesso deve rejeitar e-mail invÃ¡lido com mensagem compreensÃ­vel (Candidato Ã  automaÃ§Ã£o)
  - Arquivo: NÃ£o localizado
  - Comando: NÃ£o aplicÃ¡vel
- QC-REG-LS-034 - Solicitar Acesso deve validar senha obrigatÃ³ria e padrÃ£o de senha (Candidato Ã  automaÃ§Ã£o)
  - Arquivo: NÃ£o localizado
  - Comando: NÃ£o aplicÃ¡vel
- QC-REG-LS-105 - Suporte TÃ©cnico nÃ£o deve aprovar perfil fora da sua regra de atuaÃ§Ã£o (Precisa anÃ¡lise)
  - Arquivo: NÃ£o localizado
  - Comando: NÃ£o aplicÃ¡vel
- QC-REG-LS-112 - Empresa nÃ£o acessa solicitaÃ§Ã£o de outra empresa por URL direta (Automatizado UI/API)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --headed --workers=1 --reporter=list
- QC-REG-LS-113 - Empresa aceita solicitaÃ§Ã£o da prÃ³pria empresa quando a regra permitir (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/empresa/empresa-aceita-solicitacao-propria.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/empresa/empresa-aceita-solicitacao-propria.ui.spec.ts --headed --workers=1 --reporter=list
- QC-REG-LS-114 - Empresa solicita alteraÃ§Ã£o em solicitaÃ§Ã£o da prÃ³pria empresa (Candidato Ã  automaÃ§Ã£o)
  - Arquivo: NÃ£o localizado
  - Comando: NÃ£o aplicÃ¡vel
- QC-REG-LS-115 - Empresa recusa solicitaÃ§Ã£o da prÃ³pria empresa com justificativa (Candidato Ã  automaÃ§Ã£o)
  - Arquivo: NÃ£o localizado
  - Comando: NÃ£o aplicÃ¡vel
- QC-REG-LS-116 - Empresa comenta solicitaÃ§Ã£o da prÃ³pria empresa quando permitido (Candidato Ã  automaÃ§Ã£o)
  - Arquivo: NÃ£o localizado
  - Comando: NÃ£o aplicÃ¡vel
- QC-REG-LS-117 - Empresa nÃ£o comenta nem altera solicitaÃ§Ã£o de outra empresa (Automatizado UI/API)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --headed --workers=1 --reporter=list
- QC-REG-LS-120 - SolicitaÃ§Ã£o aprovada pela Empresa deve manter vÃ­nculo correto com a empresa (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/empresa/empresa-aceita-solicitacao-propria.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/empresa/empresa-aceita-solicitacao-propria.ui.spec.ts --headed --workers=1 --reporter=list
- QC-REG-LS-123 - E-mails de aceite, alteraÃ§Ã£o e recusa por aÃ§Ã£o da Empresa devem refletir status correto (Parcialmente automatizado)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/empresa/empresa-aceita-solicitacao-propria.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/empresa/empresa-aceita-solicitacao-propria.ui.spec.ts --headed --workers=1 --reporter=list


## Testes automatizados sem case manual correspondente direto

- testes/api/solicitar-acesso/emails/galeria/emails-galeria-visual-perfis.api.spec.ts
- testes/api/geral/solicitacoes-acesso.test.ts
- testes/api/geral/fluxo-solicitacao-acesso.test.ts
- testes/api/geral/solicitar-acesso-lifecycle.test.ts
- testes/api/geral/vinculo-empresa-visibilidade.test.ts

Esses testes cobrem contratos, legado, galeria visual de e-mails ou fundaÃ§Ãµes de domÃ­nio que apoiam a regressÃ£o, mas nÃ£o foram transformados em casos manuais diretos porque a suÃ­te Qase desta etapa foca execuÃ§Ã£o de fluxo por tela, perfil e regra de negÃ³cio.

## Duplicidades aparentes

- HÃ¡ specs de Esqueci Senha por perfil e uma spec agregadora por perfil. A matriz usa ambas como evidÃªncia quando o caso Ã© por perfil.
- HÃ¡ testes antigos em `testes/api/geral/*solicitacoes*` e testes novos em `testes/api/solicitar-acesso/*`. A cobertura Qase prioriza a estrutura nova.
- A regra de Empresa em SolicitaÃ§Ãµes foi oficializada neste complemento: Empresa acessa SolicitaÃ§Ãµes com escopo restrito Ã  prÃ³pria empresa e nÃ£o acessa solicitaÃ§Ãµes de outras empresas por lista, URL direta ou API.

## Riscos de ambiente

- E-mail pode ser real, outbox, mock, log ou arquivo JSONL. A evidÃªncia deve indicar o mecanismo usado.
- Testes E2E dependem de servidor local na porta 3100 ou `PLAYWRIGHT_BASE_URL`.
- `playwright.config.ts` forÃ§a `workers: 1`, JSON store e captura de e-mail em arquivo para estabilidade.
- Massa de solicitaÃ§Ãµes duplicadas pode bloquear novos fluxos se nÃ£o houver limpeza entre execuÃ§Ãµes.
- AÃ§Ãµes de aprovaÃ§Ã£o criam usuÃ¡rios e podem exigir limpeza posterior dependendo do ambiente.

## DependÃªncias especÃ­ficas

- E-mail/outbox: `test-results/emails/outbox.jsonl`.
- Banco/seed: scripts em `support/functions/banco-de-dados/solicitar-acesso`.
- SessÃ£o/permissÃ£o: helpers em `support/functions/api/solicitar-acesso/autenticacao`.
- Consulta pÃºblica: `accessKey` emitido no e-mail ou retornado pela API nos testes.

## RecomendaÃ§Ãµes de automaÃ§Ã£o futura

1. Criar specs negativas de campos obrigatÃ³rios e formatos invÃ¡lidos para Login, Esqueci Senha e Solicitar Acesso.
2. Expandir cobertura dedicada para aÃ§Ãµes prÃ³prias da Empresa ainda nÃ£o executadas nesta rodada: solicitar alteraÃ§Ã£o, recusar e comentar dentro do prÃ³prio escopo.
3. Manter o teste de URL direta/API para Empresa tentando abrir ou atuar em solicitaÃ§Ã£o de outra empresa como regressÃ£o obrigatÃ³ria.
4. Criar teste de sessÃ£o expirada/logout.
5. Separar recusa e rejeiÃ§Ã£o se o produto expuser aÃ§Ãµes diferentes.

## Casos que podem ser vinculados ao Qase agora

- QC-REG-LS-001 - Login com perfil LÃ­der TC deve autenticar e exibir mÃ³dulos administrativos permitidos
- QC-REG-LS-002 - Login com perfil Suporte TÃ©cnico deve autenticar e exibir apenas mÃ³dulos permitidos
- QC-REG-LS-003 - Login com perfil Empresa deve autenticar no escopo da prÃ³pria empresa
- QC-REG-LS-004 - Login com UsuÃ¡rio Empresa deve autenticar em contexto empresarial e bloquear admin global
- QC-REG-LS-005 - Login com UsuÃ¡rio TC deve autenticar preservando perfil e permissÃµes internas
- QC-REG-LS-009 - Rota protegida sem login deve bloquear acesso e redirecionar para Login
- QC-REG-LS-010 - Perfil autenticado deve visualizar somente menus permitidos
- QC-REG-LS-011 - Perfil autenticado nÃ£o deve acessar rota fora da permissÃ£o via URL direta
- QC-REG-LS-013 - Tela pÃºblica de Esqueci Senha deve abrir sem login
- QC-REG-LS-015 - Esqueci Senha com e-mail ou usuÃ¡rio invÃ¡lido nÃ£o deve permitir enumeraÃ§Ã£o
- QC-REG-LS-016 - Redefinir senha com token ou chave invÃ¡lida deve ser bloqueado
- QC-REG-LS-019 - Tela de Esqueci Senha deve atender acessibilidade crÃ­tica
- QC-REG-LS-020 - GeraÃ§Ã£o de senha temporÃ¡ria deve respeitar complexidade e caracteres proibidos
- QC-REG-LS-021 - Empresa deve recuperar senha, invalidar senha antiga e preservar permissÃµes
- QC-REG-LS-022 - E-mail de recuperaÃ§Ã£o para Empresa deve orientar redefiniÃ§Ã£o sem expor dados indevidos
- QC-REG-LS-023 - UsuÃ¡rio Empresa deve recuperar senha, invalidar senha antiga e preservar permissÃµes
- QC-REG-LS-024 - E-mail de recuperaÃ§Ã£o para UsuÃ¡rio Empresa deve orientar redefiniÃ§Ã£o sem expor dados indevidos
- QC-REG-LS-025 - UsuÃ¡rio TC deve recuperar senha, invalidar senha antiga e preservar permissÃµes
- QC-REG-LS-026 - E-mail de recuperaÃ§Ã£o para UsuÃ¡rio TC deve orientar redefiniÃ§Ã£o sem expor dados indevidos
- QC-REG-LS-027 - LÃ­der TC deve recuperar senha, invalidar senha antiga e preservar permissÃµes
- QC-REG-LS-028 - E-mail de recuperaÃ§Ã£o para LÃ­der TC deve orientar redefiniÃ§Ã£o sem expor dados indevidos
- QC-REG-LS-029 - Suporte TÃ©cnico deve recuperar senha, invalidar senha antiga e preservar permissÃµes
- QC-REG-LS-030 - E-mail de recuperaÃ§Ã£o para Suporte TÃ©cnico deve orientar redefiniÃ§Ã£o sem expor dados indevidos
- QC-REG-LS-031 - Tela pÃºblica de Solicitar Acesso deve abrir e adaptar campos conforme perfil
- QC-REG-LS-035 - SolicitaÃ§Ã£o duplicada deve ser bloqueada sem gerar novo e-mail
- QC-REG-LS-036 - SolicitaÃ§Ã£o pÃºblica criada deve aparecer na tela interna de SolicitaÃ§Ãµes
- QC-REG-LS-037 - FormulÃ¡rio pÃºblico de Solicitar Acesso deve atender acessibilidade crÃ­tica
- QC-REG-LS-038 - Campos de Empresa devem validar CNPJ, CEP e vÃ­nculo quando o perfil exigir dados empresariais
- QC-REG-LS-039 - UsuÃ¡rio pÃºblico deve solicitar acesso como Empresa, receber e-mail inicial e acompanhar status
- QC-REG-LS-040 - E-mail de solicitaÃ§Ã£o recebida para Empresa deve conter dados e link de consulta
- QC-REG-LS-041 - Consulta pÃºblica inicial de Empresa deve exibir status aguardando anÃ¡lise e dados essenciais
- QC-REG-LS-042 - E-mail de aceite para Empresa deve liberar login e preservar permissÃµes
- QC-REG-LS-043 - E-mail de alteraÃ§Ã£o para Empresa deve orientar correÃ§Ã£o e devolver solicitaÃ§Ã£o para anÃ¡lise
- QC-REG-LS-044 - E-mail de recusa para Empresa deve informar justificativa e bloquear login
- QC-REG-LS-045 - Empresa deve passar por ajustes, conversa, aprovaÃ§Ã£o final e login
- QC-REG-LS-046 - UsuÃ¡rio pÃºblico deve solicitar acesso como UsuÃ¡rio Empresa, receber e-mail inicial e acompanhar status
- QC-REG-LS-047 - E-mail de solicitaÃ§Ã£o recebida para UsuÃ¡rio Empresa deve conter dados e link de consulta
- QC-REG-LS-048 - Consulta pÃºblica inicial de UsuÃ¡rio Empresa deve exibir status aguardando anÃ¡lise e dados essenciais
- QC-REG-LS-049 - E-mail de aceite para UsuÃ¡rio Empresa deve liberar login e preservar permissÃµes
- QC-REG-LS-050 - E-mail de alteraÃ§Ã£o para UsuÃ¡rio Empresa deve orientar correÃ§Ã£o e devolver solicitaÃ§Ã£o para anÃ¡lise
- QC-REG-LS-051 - E-mail de recusa para UsuÃ¡rio Empresa deve informar justificativa e bloquear login
- QC-REG-LS-052 - UsuÃ¡rio Empresa deve passar por ajustes, conversa, aprovaÃ§Ã£o final e login
- QC-REG-LS-053 - UsuÃ¡rio pÃºblico deve solicitar acesso como UsuÃ¡rio TC, receber e-mail inicial e acompanhar status
- QC-REG-LS-054 - E-mail de solicitaÃ§Ã£o recebida para UsuÃ¡rio TC deve conter dados e link de consulta
- QC-REG-LS-055 - Consulta pÃºblica inicial de UsuÃ¡rio TC deve exibir status aguardando anÃ¡lise e dados essenciais
- QC-REG-LS-056 - E-mail de aceite para UsuÃ¡rio TC deve liberar login e preservar permissÃµes
- QC-REG-LS-057 - E-mail de alteraÃ§Ã£o para UsuÃ¡rio TC deve orientar correÃ§Ã£o e devolver solicitaÃ§Ã£o para anÃ¡lise
- QC-REG-LS-058 - E-mail de recusa para UsuÃ¡rio TC deve informar justificativa e bloquear login
- QC-REG-LS-059 - UsuÃ¡rio TC deve passar por ajustes, conversa, aprovaÃ§Ã£o final e login
- QC-REG-LS-060 - UsuÃ¡rio pÃºblico deve solicitar acesso como LÃ­der TC, receber e-mail inicial e acompanhar status
- QC-REG-LS-061 - E-mail de solicitaÃ§Ã£o recebida para LÃ­der TC deve conter dados e link de consulta
- QC-REG-LS-062 - Consulta pÃºblica inicial de LÃ­der TC deve exibir status aguardando anÃ¡lise e dados essenciais
- QC-REG-LS-063 - E-mail de aceite para LÃ­der TC deve liberar login e preservar permissÃµes
- QC-REG-LS-064 - E-mail de alteraÃ§Ã£o para LÃ­der TC deve orientar correÃ§Ã£o e devolver solicitaÃ§Ã£o para anÃ¡lise
- QC-REG-LS-065 - E-mail de recusa para LÃ­der TC deve informar justificativa e bloquear login
- QC-REG-LS-066 - LÃ­der TC deve passar por ajustes, conversa, aprovaÃ§Ã£o final e login
- QC-REG-LS-067 - UsuÃ¡rio pÃºblico deve solicitar acesso como Suporte TÃ©cnico, receber e-mail inicial e acompanhar status
- QC-REG-LS-068 - E-mail de solicitaÃ§Ã£o recebida para Suporte TÃ©cnico deve conter dados e link de consulta
- QC-REG-LS-069 - Consulta pÃºblica inicial de Suporte TÃ©cnico deve exibir status aguardando anÃ¡lise e dados essenciais
- QC-REG-LS-070 - E-mail de aceite para Suporte TÃ©cnico deve liberar login e preservar permissÃµes
- QC-REG-LS-071 - E-mail de alteraÃ§Ã£o para Suporte TÃ©cnico deve orientar correÃ§Ã£o e devolver solicitaÃ§Ã£o para anÃ¡lise
- QC-REG-LS-072 - E-mail de recusa para Suporte TÃ©cnico deve informar justificativa e bloquear login
- QC-REG-LS-073 - Suporte TÃ©cnico deve passar por ajustes, conversa, aprovaÃ§Ã£o final e login
- QC-REG-LS-074 - Consulta pÃºblica pelo link recebido no e-mail deve abrir a solicitaÃ§Ã£o correta
- QC-REG-LS-075 - Consulta manual por e-mail e token deve retornar status sem expor chave em resposta pÃºblica
- QC-REG-LS-076 - Consulta com status aguardando anÃ¡lise deve exibir datas e mensagem de acompanhamento
- QC-REG-LS-077 - Consulta apÃ³s solicitaÃ§Ã£o de alteraÃ§Ã£o deve exibir campos e comentÃ¡rios de correÃ§Ã£o
- QC-REG-LS-078 - Consulta apÃ³s correÃ§Ã£o enviada deve retornar solicitaÃ§Ã£o para anÃ¡lise
- QC-REG-LS-079 - Consulta apÃ³s aprovaÃ§Ã£o deve exibir status aprovado e orientaÃ§Ã£o de acesso
- QC-REG-LS-080 - Consulta apÃ³s recusa ou rejeiÃ§Ã£o deve exibir status final e justificativa
- QC-REG-LS-081 - Consulta com link ou chave invÃ¡lida nÃ£o deve expor erro interno
- QC-REG-LS-082 - Consulta de solicitaÃ§Ã£o inexistente deve orientar usuÃ¡rio sem enumerar dados
- QC-REG-LS-083 - Consulta pÃºblica nÃ£o deve expor senha, dados administrativos ou campos nÃ£o necessÃ¡rios
- QC-REG-LS-084 - Consulta deve aceitar somente campos solicitados para correÃ§Ã£o
- QC-REG-LS-085 - Consulta nÃ£o deve permitir nova correÃ§Ã£o apÃ³s retorno para anÃ¡lise
- QC-REG-LS-086 - Reenvio de cÃ³digo de consulta deve enviar e-mail sem revelar accessKey na resposta
- QC-REG-LS-087 - LÃ­der TC acessa tela de SolicitaÃ§Ãµes e visualiza fila de anÃ¡lise
- QC-REG-LS-088 - LÃ­der TC visualiza solicitaÃ§Ãµes de todos os perfis permitidos
- QC-REG-LS-089 - LÃ­der TC abre detalhes da solicitaÃ§Ã£o e visualiza dados do solicitante
- QC-REG-LS-090 - LÃ­der TC aceita solicitaÃ§Ã£o e libera login do usuÃ¡rio
- QC-REG-LS-091 - LÃ­der TC solicita alteraÃ§Ã£o com comentÃ¡rio e campos especÃ­ficos
- QC-REG-LS-092 - UsuÃ¡rio pÃºblico corrige dados e LÃ­der TC aprova apÃ³s correÃ§Ã£o
- QC-REG-LS-093 - LÃ­der TC recusa solicitaÃ§Ã£o com justificativa obrigatÃ³ria
- QC-REG-LS-094 - LÃ­der TC comenta solicitaÃ§Ã£o e histÃ³rico deve preservar conversa
- QC-REG-LS-095 - AÃ§Ãµes do LÃ­der TC devem enviar e-mails corretos de aceite, alteraÃ§Ã£o e recusa
- QC-REG-LS-096 - SolicitaÃ§Ã£o finalizada por LÃ­der TC nÃ£o deve permitir alteraÃ§Ã£o indevida
- QC-REG-LS-097 - Rota antiga /admin/requests nÃ£o deve existir como fluxo vÃ¡lido
- QC-REG-LS-098 - Tela de SolicitaÃ§Ãµes para LÃ­der TC deve atender acessibilidade crÃ­tica
- QC-REG-LS-109 - Empresa acessa tela de SolicitaÃ§Ãµes com escopo da prÃ³pria empresa
- QC-REG-LS-118 - Empresa nÃ£o acessa admin inteiro fora do escopo permitido
- QC-REG-LS-119 - Empresa nÃ£o visualiza dados administrativos fora do escopo
- QC-REG-LS-121 - UsuÃ¡rio aprovado por Empresa deve entrar com escopo correto da empresa

## Casos que nÃ£o devem ser vinculados ainda

- QC-REG-LS-006 - Login com credenciais invÃ¡lidas deve falhar sem criar sessÃ£o (Candidato Ã  automaÃ§Ã£o)
- QC-REG-LS-007 - Login sem preencher campos obrigatÃ³rios deve orientar o usuÃ¡rio e impedir envio (Candidato Ã  automaÃ§Ã£o)
- QC-REG-LS-008 - Logout deve encerrar sessÃ£o e impedir reutilizaÃ§Ã£o da Ã¡rea autenticada (Candidato Ã  automaÃ§Ã£o)
- QC-REG-LS-012 - SessÃ£o expirada deve redirecionar para Login sem manter dados sensÃ­veis em tela (Candidato Ã  automaÃ§Ã£o)
- QC-REG-LS-014 - Esqueci Senha deve validar campos obrigatÃ³rios antes de solicitar recuperaÃ§Ã£o (Candidato Ã  automaÃ§Ã£o)
- QC-REG-LS-017 - RedefiniÃ§Ã£o deve rejeitar senha fora do padrÃ£o de seguranÃ§a (Candidato Ã  automaÃ§Ã£o)
- QC-REG-LS-018 - RedefiniÃ§Ã£o deve rejeitar confirmaÃ§Ã£o de senha divergente (Candidato Ã  automaÃ§Ã£o)
- QC-REG-LS-032 - Solicitar Acesso deve validar campos obrigatÃ³rios antes de criar solicitaÃ§Ã£o (Candidato Ã  automaÃ§Ã£o)
- QC-REG-LS-033 - Solicitar Acesso deve rejeitar e-mail invÃ¡lido com mensagem compreensÃ­vel (Candidato Ã  automaÃ§Ã£o)
- QC-REG-LS-034 - Solicitar Acesso deve validar senha obrigatÃ³ria e padrÃ£o de senha (Candidato Ã  automaÃ§Ã£o)
- QC-REG-LS-099 - Suporte TÃ©cnico acessa tela de SolicitaÃ§Ãµes quando autorizado (Automatizado UI)
- QC-REG-LS-100 - Suporte TÃ©cnico visualiza solicitaÃ§Ãµes permitidas sem acessar itens proibidos (Parcialmente automatizado)
- QC-REG-LS-101 - Suporte TÃ©cnico abre detalhes da solicitaÃ§Ã£o permitida (Parcialmente automatizado)
- QC-REG-LS-102 - Suporte TÃ©cnico aceita solicitaÃ§Ã£o permitida e libera login (Automatizado API)
- QC-REG-LS-103 - Suporte TÃ©cnico solicita alteraÃ§Ã£o e recebe dados corrigidos (Automatizado API)
- QC-REG-LS-104 - Suporte TÃ©cnico recusa solicitaÃ§Ã£o com motivo e e-mail (Automatizado API)
- QC-REG-LS-105 - Suporte TÃ©cnico nÃ£o deve aprovar perfil fora da sua regra de atuaÃ§Ã£o (Precisa anÃ¡lise)
- QC-REG-LS-106 - Suporte TÃ©cnico nÃ£o deve visualizar aÃ§Ãµes administrativas indevidas (Parcialmente automatizado)
- QC-REG-LS-107 - Suporte TÃ©cnico comenta solicitaÃ§Ã£o quando permitido (Parcialmente automatizado)
- QC-REG-LS-108 - PermissÃµes do Suporte TÃ©cnico devem ser respeitadas na navegaÃ§Ã£o base (Automatizado API)
- QC-REG-LS-110 - Empresa visualiza somente solicitaÃ§Ãµes vinculadas Ã  prÃ³pria empresa (Automatizado UI)
- QC-REG-LS-111 - Empresa nÃ£o visualiza solicitaÃ§Ã£o de outra empresa na busca ou listagem (Automatizado UI)
- QC-REG-LS-112 - Empresa nÃ£o acessa solicitaÃ§Ã£o de outra empresa por URL direta (Automatizado UI/API)
- QC-REG-LS-113 - Empresa aceita solicitaÃ§Ã£o da prÃ³pria empresa quando a regra permitir (Automatizado E2E)
- QC-REG-LS-114 - Empresa solicita alteraÃ§Ã£o em solicitaÃ§Ã£o da prÃ³pria empresa (Candidato Ã  automaÃ§Ã£o)
- QC-REG-LS-115 - Empresa recusa solicitaÃ§Ã£o da prÃ³pria empresa com justificativa (Candidato Ã  automaÃ§Ã£o)
- QC-REG-LS-116 - Empresa comenta solicitaÃ§Ã£o da prÃ³pria empresa quando permitido (Candidato Ã  automaÃ§Ã£o)
- QC-REG-LS-117 - Empresa nÃ£o comenta nem altera solicitaÃ§Ã£o de outra empresa (Automatizado UI/API)
- QC-REG-LS-120 - SolicitaÃ§Ã£o aprovada pela Empresa deve manter vÃ­nculo correto com a empresa (Automatizado E2E)
- QC-REG-LS-122 - Fluxo de escopo da Empresa deve usar pelo menos duas empresas distintas (Automatizado UI)
- QC-REG-LS-123 - E-mails de aceite, alteraÃ§Ã£o e recusa por aÃ§Ã£o da Empresa devem refletir status correto (Parcialmente automatizado)

## Complemento - DocumentaÃ§Ã£o viva da pasta testes/

A sincronizaÃ§Ã£o completa desta etapa adicionou a regra de que o Qase Ã© a documentaÃ§Ã£o viva da pasta `testes/`.

- DefiniÃ§Ãµes de teste inventariadas: 456

Detalhes completos:

- `docs/qase/inventario-testes-repositorio.md`
- `docs/qase/matriz-qase-vs-repositorio.md`
- `docs/qase/plano-teste-regressao-quality-control.md`
- `docs/qase/resultado-run-regressao-quality-control.md`
- `docs/qase/lacunas-repositorio-qase.md`

## Complemento 2026-06-21 - Empresa em SolicitaÃ§Ãµes

Regra oficial aplicada: Empresa possui acesso restrito Ã  tela SolicitaÃ§Ãµes e pode executar o fluxo completo de anÃ¡lise apenas para solicitaÃ§Ãµes vinculadas Ã  prÃ³pria empresa. SolicitaÃ§Ãµes de outras empresas nÃ£o devem ser exibidas nem acessÃ­veis por URL direta ou API.

AtualizaÃ§Ã£o de cobertura:

- QC-REG-LS-109, #160: Empresa acessa a tela SolicitaÃ§Ãµes com escopo da prÃ³pria empresa. Validado no spec de permissÃ£o e no spec de escopo.
- QC-REG-LS-110, #161: Empresa visualiza somente solicitaÃ§Ãµes da prÃ³pria empresa. Validado em headed.
- QC-REG-LS-111, #162: Empresa nÃ£o visualiza solicitaÃ§Ã£o de outra empresa na listagem/busca/API. Validado em headed.
- QC-REG-LS-112, #163: Empresa nÃ£o acessa nem atua em solicitaÃ§Ã£o de outra empresa por URL direta/API. Validado em headed.
- QC-REG-LS-113, #164: Empresa aceita/aprova solicitaÃ§Ã£o da prÃ³pria empresa. Validado em headed.
- QC-REG-LS-117, #168: Empresa nÃ£o comenta nem altera solicitaÃ§Ã£o de outra empresa. Validado por endpoints diretos bloqueados.
- QC-REG-LS-118, #169: Empresa nÃ£o acessa admin inteiro fora de `/admin/access-requests`. Validado em headed.
- QC-REG-LS-120, #171: SolicitaÃ§Ã£o aprovada pela Empresa mantÃ©m vÃ­nculo correto com a empresa. Validado em headed.
- QC-REG-LS-121, #172: UsuÃ¡rio aprovado por Empresa entra com escopo correto da empresa. Validado em headed.
- QC-REG-LS-122, #173: Fluxo usa duas empresas distintas. Validado no spec de escopo.
- QC-REG-LS-123, #174: E-mail de aceite foi validado porque a captura estava configurada; e-mails de alteraÃ§Ã£o/recusa por Empresa seguem pendentes.

Cases automÃ¡ticos novos:

- #631 `[AUTO] Empresa deve aceitar solicitacao vinculada a propria empresa`.
- #632 `[AUTO] Empresa deve acessar somente a tela SolicitaÃ§Ãµes dentro do admin`.

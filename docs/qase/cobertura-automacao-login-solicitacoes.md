# Cobertura de automação - Login e Solicitações

## Visão geral

- Total de casos manuais planejados: 123
- Automatizados UI: 25
- Automatizados API: 26
- Automatizados BD: 1
- Automatizados E2E: 22
- Parcialmente automatizados: 30
- Candidatos à automação: 18
- Precisa análise: 1

## Casos já automatizados

- QC-REG-LS-010 - Perfil autenticado deve visualizar somente menus permitidos (Automatizado UI)
  - Arquivo: testes/ui/login/login/menu-autenticado.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-013 - Tela pública de Esqueci Senha deve abrir sem login (Automatizado UI)
  - Arquivo: testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-015 - Esqueci Senha com e-mail ou usuário inválido não deve permitir enumeração (Automatizado UI)
  - Arquivo: testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts; testes/api/login/esqueci-senha/esqueci-senha.endpoint.api.spec.ts
  - Comando: npx playwright test testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/login/esqueci-senha/esqueci-senha.endpoint.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-016 - Redefinir senha com token ou chave inválida deve ser bloqueado (Automatizado UI)
  - Arquivo: testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-019 - Tela de Esqueci Senha deve atender acessibilidade crítica (Automatizado UI)
  - Arquivo: testes/ui/login/esqueci-senha/acessibilidade/esqueci-senha.acessibilidade.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/esqueci-senha/acessibilidade/esqueci-senha.acessibilidade.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-020 - Geração de senha temporária deve respeitar complexidade e caracteres proibidos (Automatizado BD)
  - Arquivo: testes/bd/login/senha-temporaria/temp-password-generation.test.ts
  - Comando: npm test -- testes/bd/login/senha-temporaria/temp-password-generation.test.ts --runInBand
- QC-REG-LS-021 - Empresa deve recuperar senha, invalidar senha antiga e preservar permissões (Automatizado E2E)
  - Arquivo: testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts; testes/ui/login/esqueci-senha/empresa/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/empresa/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-023 - Usuário Empresa deve recuperar senha, invalidar senha antiga e preservar permissões (Automatizado E2E)
  - Arquivo: testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts; testes/ui/login/esqueci-senha/usuario-empresa/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/usuario-empresa/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-025 - Usuário TC deve recuperar senha, invalidar senha antiga e preservar permissões (Automatizado E2E)
  - Arquivo: testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts; testes/ui/login/esqueci-senha/usuario-tc/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/usuario-tc/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-027 - Líder TC deve recuperar senha, invalidar senha antiga e preservar permissões (Automatizado E2E)
  - Arquivo: testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts; testes/ui/login/esqueci-senha/lider-tc/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/lider-tc/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-029 - Suporte Técnico deve recuperar senha, invalidar senha antiga e preservar permissões (Automatizado E2E)
  - Arquivo: testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts; testes/ui/login/esqueci-senha/suporte-tecnico/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/suporte-tecnico/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-031 - Tela pública de Solicitar Acesso deve abrir e adaptar campos conforme perfil (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-035 - Solicitação duplicada deve ser bloqueada sem gerar novo e-mail (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/gestao-solicitacoes/email/capturar-e-reenviar-email-solicitacao.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/email/capturar-e-reenviar-email-solicitacao.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-036 - Solicitação pública criada deve aparecer na tela interna de Solicitações (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-037 - Formulário público de Solicitar Acesso deve atender acessibilidade crítica (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/formulario-publico/acessibilidade/formulario.acessibilidade.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/acessibilidade/formulario.acessibilidade.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-038 - Campos de Empresa devem validar CNPJ, CEP e vínculo quando o perfil exigir dados empresariais (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-039 - Usuário público deve solicitar acesso como Empresa, receber e-mail inicial e acompanhar status (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-041 - Consulta pública inicial de Empresa deve exibir status aguardando análise e dados essenciais (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-042 - E-mail de aceite para Empresa deve liberar login e preservar permissões (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-043 - E-mail de alteração para Empresa deve orientar correção e devolver solicitação para análise (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-044 - E-mail de recusa para Empresa deve informar justificativa e bloquear login (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-045 - Empresa deve passar por ajustes, conversa, aprovação final e login (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-046 - Usuário público deve solicitar acesso como Usuário Empresa, receber e-mail inicial e acompanhar status (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-048 - Consulta pública inicial de Usuário Empresa deve exibir status aguardando análise e dados essenciais (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-049 - E-mail de aceite para Usuário Empresa deve liberar login e preservar permissões (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-050 - E-mail de alteração para Usuário Empresa deve orientar correção e devolver solicitação para análise (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-051 - E-mail de recusa para Usuário Empresa deve informar justificativa e bloquear login (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-052 - Usuário Empresa deve passar por ajustes, conversa, aprovação final e login (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-053 - Usuário público deve solicitar acesso como Usuário TC, receber e-mail inicial e acompanhar status (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-055 - Consulta pública inicial de Usuário TC deve exibir status aguardando análise e dados essenciais (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-056 - E-mail de aceite para Usuário TC deve liberar login e preservar permissões (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-057 - E-mail de alteração para Usuário TC deve orientar correção e devolver solicitação para análise (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-058 - E-mail de recusa para Usuário TC deve informar justificativa e bloquear login (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-059 - Usuário TC deve passar por ajustes, conversa, aprovação final e login (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-060 - Usuário público deve solicitar acesso como Líder TC, receber e-mail inicial e acompanhar status (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-062 - Consulta pública inicial de Líder TC deve exibir status aguardando análise e dados essenciais (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-063 - E-mail de aceite para Líder TC deve liberar login e preservar permissões (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-064 - E-mail de alteração para Líder TC deve orientar correção e devolver solicitação para análise (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-065 - E-mail de recusa para Líder TC deve informar justificativa e bloquear login (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-066 - Líder TC deve passar por ajustes, conversa, aprovação final e login (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-067 - Usuário público deve solicitar acesso como Suporte Técnico, receber e-mail inicial e acompanhar status (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-069 - Consulta pública inicial de Suporte Técnico deve exibir status aguardando análise e dados essenciais (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-070 - E-mail de aceite para Suporte Técnico deve liberar login e preservar permissões (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-071 - E-mail de alteração para Suporte Técnico deve orientar correção e devolver solicitação para análise (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-072 - E-mail de recusa para Suporte Técnico deve informar justificativa e bloquear login (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-073 - Suporte Técnico deve passar por ajustes, conversa, aprovação final e login (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-074 - Consulta pública pelo link recebido no e-mail deve abrir a solicitação correta (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts; testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-075 - Consulta manual por e-mail e token deve retornar status sem expor chave em resposta pública (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-076 - Consulta com status aguardando análise deve exibir datas e mensagem de acompanhamento (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts; testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-077 - Consulta após solicitação de alteração deve exibir campos e comentários de correção (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-078 - Consulta após correção enviada deve retornar solicitação para análise (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-079 - Consulta após aprovação deve exibir status aprovado e orientação de acesso (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts; testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-080 - Consulta após recusa ou rejeição deve exibir status final e justificativa (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts; testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-081 - Consulta com link ou chave inválida não deve expor erro interno (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts; testes/api/solicitar-acesso/endpoints/endpoints-publicos.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/endpoints/endpoints-publicos.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-084 - Consulta deve aceitar somente campos solicitados para correção (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-085 - Consulta não deve permitir nova correção após retorno para análise (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-086 - Reenvio de código de consulta deve enviar e-mail sem revelar accessKey na resposta (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-087 - Líder TC acessa tela de Solicitações e visualiza fila de análise (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-090 - Líder TC aceita solicitação e libera login do usuário (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-091 - Líder TC solicita alteração com comentário e campos específicos (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-092 - Usuário público corrige dados e Líder TC aprova após correção (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/fluxo-completo/solicitacao-ajuste-aprovacao.ui.spec.ts; testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/fluxo-completo/solicitacao-ajuste-aprovacao.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-093 - Líder TC recusa solicitação com justificativa obrigatória (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-094 - Líder TC comenta solicitação e histórico deve preservar conversa (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-095 - Ações do Líder TC devem enviar e-mails corretos de aceite, alteração e recusa (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-097 - Rota antiga /admin/requests não deve existir como fluxo válido (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-098 - Tela de Solicitações para Líder TC deve atender acessibilidade crítica (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/acessibilidade/validar-acessibilidade-tela-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/acessibilidade/validar-acessibilidade-tela-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-099 - Suporte Técnico acessa tela de Solicitações quando autorizado (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-102 - Suporte Técnico aceita solicitação permitida e libera login (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-103 - Suporte Técnico solicita alteração e recebe dados corrigidos (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-104 - Suporte Técnico recusa solicitação com motivo e e-mail (Automatizado API)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-108 - Permissões do Suporte Técnico devem ser respeitadas na navegação base (Automatizado API)
  - Arquivo: testes/api/navegacao/perfil-suporte-navegacao-base.test.ts
  - Comando: npm test -- testes/api/navegacao/perfil-suporte-navegacao-base.test.ts --runInBand
- QC-REG-LS-110 - Empresa visualiza somente solicitações vinculadas à própria empresa (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-111 - Empresa não visualiza solicitação de outra empresa na busca ou listagem (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-122 - Fluxo de escopo da Empresa deve usar pelo menos duas empresas distintas (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list


## Casos parcialmente automatizados

- QC-REG-LS-001 - Login com perfil Líder TC deve autenticar e exibir módulos administrativos permitidos (Parcialmente automatizado)
  - Arquivo: testes/ui/login/login/login-real.ui.spec.ts; testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/login/login-real.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-002 - Login com perfil Suporte Técnico deve autenticar e exibir apenas módulos permitidos (Parcialmente automatizado)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts; testes/api/navegacao/perfil-suporte-navegacao-base.test.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
npm test -- testes/api/navegacao/perfil-suporte-navegacao-base.test.ts --runInBand
- QC-REG-LS-003 - Login com perfil Empresa deve autenticar no escopo da própria empresa (Parcialmente automatizado)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts; testes/ui/login/login/menu-autenticado.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-004 - Login com Usuário Empresa deve autenticar em contexto empresarial e bloquear admin global (Parcialmente automatizado)
  - Arquivo: testes/ui/login/login/menu-autenticado.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
  - Comando: npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-005 - Login com Usuário TC deve autenticar preservando perfil e permissões internas (Parcialmente automatizado)
  - Arquivo: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-009 - Rota protegida sem login deve bloquear acesso e redirecionar para Login (Parcialmente automatizado)
  - Arquivo: testes/ui/login/login/login-real.ui.spec.ts; testes/ui/login/login/menu-autenticado.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/login/login-real.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-011 - Perfil autenticado não deve acessar rota fora da permissão via URL direta (Parcialmente automatizado)
  - Arquivo: testes/ui/login/login/menu-autenticado.ui.spec.ts; testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-022 - E-mail de recuperação para Empresa deve orientar redefinição sem expor dados indevidos (Parcialmente automatizado)
  - Arquivo: testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts; testes/ui/login/esqueci-senha/empresa/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/empresa/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-024 - E-mail de recuperação para Usuário Empresa deve orientar redefinição sem expor dados indevidos (Parcialmente automatizado)
  - Arquivo: testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts; testes/ui/login/esqueci-senha/usuario-empresa/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/usuario-empresa/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-026 - E-mail de recuperação para Usuário TC deve orientar redefinição sem expor dados indevidos (Parcialmente automatizado)
  - Arquivo: testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts; testes/ui/login/esqueci-senha/usuario-tc/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/usuario-tc/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-028 - E-mail de recuperação para Líder TC deve orientar redefinição sem expor dados indevidos (Parcialmente automatizado)
  - Arquivo: testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts; testes/ui/login/esqueci-senha/lider-tc/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/lider-tc/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-030 - E-mail de recuperação para Suporte Técnico deve orientar redefinição sem expor dados indevidos (Parcialmente automatizado)
  - Arquivo: testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts; testes/ui/login/esqueci-senha/suporte-tecnico/recuperar-senha.ui.spec.ts
  - Comando: npx playwright test testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/suporte-tecnico/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-040 - E-mail de solicitação recebida para Empresa deve conter dados e link de consulta (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-047 - E-mail de solicitação recebida para Usuário Empresa deve conter dados e link de consulta (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-054 - E-mail de solicitação recebida para Usuário TC deve conter dados e link de consulta (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-061 - E-mail de solicitação recebida para Líder TC deve conter dados e link de consulta (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-068 - E-mail de solicitação recebida para Suporte Técnico deve conter dados e link de consulta (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-082 - Consulta de solicitação inexistente deve orientar usuário sem enumerar dados (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/endpoints/endpoints-publicos.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/endpoints/endpoints-publicos.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-083 - Consulta pública não deve expor senha, dados administrativos ou campos não necessários (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-088 - Líder TC visualiza solicitações de todos os perfis permitidos (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/listar-solicitacoes.positivo.api.spec.ts; testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/listar-solicitacoes.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-089 - Líder TC abre detalhes da solicitação e visualiza dados do solicitante (Parcialmente automatizado)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/endpoints/validar-endpoints-tela-solicitacoes.ui.spec.ts; testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/endpoints/validar-endpoints-tela-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-096 - Solicitação finalizada por Líder TC não deve permitir alteração indevida (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-100 - Suporte Técnico visualiza solicitações permitidas sem acessar itens proibidos (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/listar-solicitacoes.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/listar-solicitacoes.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-101 - Suporte Técnico abre detalhes da solicitação permitida (Parcialmente automatizado)
  - Arquivo: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
  - Comando: npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-106 - Suporte Técnico não deve visualizar ações administrativas indevidas (Parcialmente automatizado)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts; testes/api/suporte/support-access.test.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
npm test -- testes/api/suporte/support-access.test.ts --runInBand
- QC-REG-LS-107 - Suporte Técnico comenta solicitação quando permitido (Parcialmente automatizado)
  - Arquivo: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-109 - Empresa acessa tela de Solicitações com escopo da própria empresa (Automatizado UI)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-118 - Empresa não acessa admin inteiro fora do escopo permitido (Automatizado UI)
  - Arquivo: testes/ui/login/login/menu-autenticado.ui.spec.ts; testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-119 - Empresa não visualiza dados administrativos fora do escopo (Parcialmente automatizado)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts; testes/ui/login/login/menu-autenticado.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
- QC-REG-LS-121 - Usuário aprovado por Empresa deve entrar com escopo correto da empresa (Automatizado E2E)
  - Arquivo: testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts; testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list


## Casos somente manuais ou candidatos à automação

- QC-REG-LS-006 - Login com credenciais inválidas deve falhar sem criar sessão (Candidato à automação)
  - Arquivo: Não localizado
  - Comando: Não aplicável
- QC-REG-LS-007 - Login sem preencher campos obrigatórios deve orientar o usuário e impedir envio (Candidato à automação)
  - Arquivo: Não localizado
  - Comando: Não aplicável
- QC-REG-LS-008 - Logout deve encerrar sessão e impedir reutilização da área autenticada (Candidato à automação)
  - Arquivo: Não localizado
  - Comando: Não aplicável
- QC-REG-LS-012 - Sessão expirada deve redirecionar para Login sem manter dados sensíveis em tela (Candidato à automação)
  - Arquivo: Não localizado
  - Comando: Não aplicável
- QC-REG-LS-014 - Esqueci Senha deve validar campos obrigatórios antes de solicitar recuperação (Candidato à automação)
  - Arquivo: Não localizado
  - Comando: Não aplicável
- QC-REG-LS-017 - Redefinição deve rejeitar senha fora do padrão de segurança (Candidato à automação)
  - Arquivo: Não localizado
  - Comando: Não aplicável
- QC-REG-LS-018 - Redefinição deve rejeitar confirmação de senha divergente (Candidato à automação)
  - Arquivo: Não localizado
  - Comando: Não aplicável
- QC-REG-LS-032 - Solicitar Acesso deve validar campos obrigatórios antes de criar solicitação (Candidato à automação)
  - Arquivo: Não localizado
  - Comando: Não aplicável
- QC-REG-LS-033 - Solicitar Acesso deve rejeitar e-mail inválido com mensagem compreensível (Candidato à automação)
  - Arquivo: Não localizado
  - Comando: Não aplicável
- QC-REG-LS-034 - Solicitar Acesso deve validar senha obrigatória e padrão de senha (Candidato à automação)
  - Arquivo: Não localizado
  - Comando: Não aplicável
- QC-REG-LS-105 - Suporte Técnico não deve aprovar perfil fora da sua regra de atuação (Precisa análise)
  - Arquivo: Não localizado
  - Comando: Não aplicável
- QC-REG-LS-112 - Empresa não acessa solicitação de outra empresa por URL direta (Automatizado UI/API)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --headed --workers=1 --reporter=list
- QC-REG-LS-113 - Empresa aceita solicitação da própria empresa quando a regra permitir (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/empresa/empresa-aceita-solicitacao-propria.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/empresa/empresa-aceita-solicitacao-propria.ui.spec.ts --headed --workers=1 --reporter=list
- QC-REG-LS-114 - Empresa solicita alteração em solicitação da própria empresa (Candidato à automação)
  - Arquivo: Não localizado
  - Comando: Não aplicável
- QC-REG-LS-115 - Empresa recusa solicitação da própria empresa com justificativa (Candidato à automação)
  - Arquivo: Não localizado
  - Comando: Não aplicável
- QC-REG-LS-116 - Empresa comenta solicitação da própria empresa quando permitido (Candidato à automação)
  - Arquivo: Não localizado
  - Comando: Não aplicável
- QC-REG-LS-117 - Empresa não comenta nem altera solicitação de outra empresa (Automatizado UI/API)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --headed --workers=1 --reporter=list
- QC-REG-LS-120 - Solicitação aprovada pela Empresa deve manter vínculo correto com a empresa (Automatizado E2E)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/empresa/empresa-aceita-solicitacao-propria.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/empresa/empresa-aceita-solicitacao-propria.ui.spec.ts --headed --workers=1 --reporter=list
- QC-REG-LS-123 - E-mails de aceite, alteração e recusa por ação da Empresa devem refletir status correto (Parcialmente automatizado)
  - Arquivo: testes/ui/login/solicitar-acesso/gestao-solicitacoes/empresa/empresa-aceita-solicitacao-propria.ui.spec.ts
  - Comando: npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/empresa/empresa-aceita-solicitacao-propria.ui.spec.ts --headed --workers=1 --reporter=list


## Testes automatizados sem case manual correspondente direto

- testes/api/solicitar-acesso/emails/galeria/emails-galeria-visual-perfis.api.spec.ts
- testes/api/geral/solicitacoes-acesso.test.ts
- testes/api/geral/fluxo-solicitacao-acesso.test.ts
- testes/api/geral/solicitar-acesso-lifecycle.test.ts
- testes/api/geral/vinculo-empresa-visibilidade.test.ts

Esses testes cobrem contratos, legado, galeria visual de e-mails ou fundações de domínio que apoiam a regressão, mas não foram transformados em casos manuais diretos porque a suíte Qase desta etapa foca execução de fluxo por tela, perfil e regra de negócio.

## Duplicidades aparentes

- Há specs de Esqueci Senha por perfil e uma spec agregadora por perfil. A matriz usa ambas como evidência quando o caso é por perfil.
- Há testes antigos em `testes/api/geral/*solicitacoes*` e testes novos em `testes/api/solicitar-acesso/*`. A cobertura Qase prioriza a estrutura nova.
- A regra de Empresa em Solicitações foi oficializada neste complemento: Empresa acessa Solicitações com escopo restrito à própria empresa e não acessa solicitações de outras empresas por lista, URL direta ou API.

## Riscos de ambiente

- E-mail pode ser real, outbox, mock, log ou arquivo JSONL. A evidência deve indicar o mecanismo usado.
- Testes E2E dependem de servidor local na porta 3100 ou `PLAYWRIGHT_BASE_URL`.
- `playwright.config.ts` força `workers: 1`, JSON store e captura de e-mail em arquivo para estabilidade.
- Massa de solicitações duplicadas pode bloquear novos fluxos se não houver limpeza entre execuções.
- Ações de aprovação criam usuários e podem exigir limpeza posterior dependendo do ambiente.

## Dependências específicas

- E-mail/outbox: `test-results/emails/outbox.jsonl`.
- Banco/seed: scripts em `support/functions/banco-de-dados/solicitar-acesso`.
- Sessão/permissão: helpers em `support/functions/api/solicitar-acesso/autenticacao`.
- Consulta pública: `accessKey` emitido no e-mail ou retornado pela API nos testes.

## Recomendações de automação futura

1. Criar specs negativas de campos obrigatórios e formatos inválidos para Login, Esqueci Senha e Solicitar Acesso.
2. Expandir cobertura dedicada para ações próprias da Empresa ainda não executadas nesta rodada: solicitar alteração, recusar e comentar dentro do próprio escopo.
3. Manter o teste de URL direta/API para Empresa tentando abrir ou atuar em solicitação de outra empresa como regressão obrigatória.
4. Criar teste de sessão expirada/logout.
5. Separar recusa e rejeição se o produto expuser ações diferentes.

## Casos que podem ser vinculados ao Qase agora

- QC-REG-LS-001 - Login com perfil Líder TC deve autenticar e exibir módulos administrativos permitidos
- QC-REG-LS-002 - Login com perfil Suporte Técnico deve autenticar e exibir apenas módulos permitidos
- QC-REG-LS-003 - Login com perfil Empresa deve autenticar no escopo da própria empresa
- QC-REG-LS-004 - Login com Usuário Empresa deve autenticar em contexto empresarial e bloquear admin global
- QC-REG-LS-005 - Login com Usuário TC deve autenticar preservando perfil e permissões internas
- QC-REG-LS-009 - Rota protegida sem login deve bloquear acesso e redirecionar para Login
- QC-REG-LS-010 - Perfil autenticado deve visualizar somente menus permitidos
- QC-REG-LS-011 - Perfil autenticado não deve acessar rota fora da permissão via URL direta
- QC-REG-LS-013 - Tela pública de Esqueci Senha deve abrir sem login
- QC-REG-LS-015 - Esqueci Senha com e-mail ou usuário inválido não deve permitir enumeração
- QC-REG-LS-016 - Redefinir senha com token ou chave inválida deve ser bloqueado
- QC-REG-LS-019 - Tela de Esqueci Senha deve atender acessibilidade crítica
- QC-REG-LS-020 - Geração de senha temporária deve respeitar complexidade e caracteres proibidos
- QC-REG-LS-021 - Empresa deve recuperar senha, invalidar senha antiga e preservar permissões
- QC-REG-LS-022 - E-mail de recuperação para Empresa deve orientar redefinição sem expor dados indevidos
- QC-REG-LS-023 - Usuário Empresa deve recuperar senha, invalidar senha antiga e preservar permissões
- QC-REG-LS-024 - E-mail de recuperação para Usuário Empresa deve orientar redefinição sem expor dados indevidos
- QC-REG-LS-025 - Usuário TC deve recuperar senha, invalidar senha antiga e preservar permissões
- QC-REG-LS-026 - E-mail de recuperação para Usuário TC deve orientar redefinição sem expor dados indevidos
- QC-REG-LS-027 - Líder TC deve recuperar senha, invalidar senha antiga e preservar permissões
- QC-REG-LS-028 - E-mail de recuperação para Líder TC deve orientar redefinição sem expor dados indevidos
- QC-REG-LS-029 - Suporte Técnico deve recuperar senha, invalidar senha antiga e preservar permissões
- QC-REG-LS-030 - E-mail de recuperação para Suporte Técnico deve orientar redefinição sem expor dados indevidos
- QC-REG-LS-031 - Tela pública de Solicitar Acesso deve abrir e adaptar campos conforme perfil
- QC-REG-LS-035 - Solicitação duplicada deve ser bloqueada sem gerar novo e-mail
- QC-REG-LS-036 - Solicitação pública criada deve aparecer na tela interna de Solicitações
- QC-REG-LS-037 - Formulário público de Solicitar Acesso deve atender acessibilidade crítica
- QC-REG-LS-038 - Campos de Empresa devem validar CNPJ, CEP e vínculo quando o perfil exigir dados empresariais
- QC-REG-LS-039 - Usuário público deve solicitar acesso como Empresa, receber e-mail inicial e acompanhar status
- QC-REG-LS-040 - E-mail de solicitação recebida para Empresa deve conter dados e link de consulta
- QC-REG-LS-041 - Consulta pública inicial de Empresa deve exibir status aguardando análise e dados essenciais
- QC-REG-LS-042 - E-mail de aceite para Empresa deve liberar login e preservar permissões
- QC-REG-LS-043 - E-mail de alteração para Empresa deve orientar correção e devolver solicitação para análise
- QC-REG-LS-044 - E-mail de recusa para Empresa deve informar justificativa e bloquear login
- QC-REG-LS-045 - Empresa deve passar por ajustes, conversa, aprovação final e login
- QC-REG-LS-046 - Usuário público deve solicitar acesso como Usuário Empresa, receber e-mail inicial e acompanhar status
- QC-REG-LS-047 - E-mail de solicitação recebida para Usuário Empresa deve conter dados e link de consulta
- QC-REG-LS-048 - Consulta pública inicial de Usuário Empresa deve exibir status aguardando análise e dados essenciais
- QC-REG-LS-049 - E-mail de aceite para Usuário Empresa deve liberar login e preservar permissões
- QC-REG-LS-050 - E-mail de alteração para Usuário Empresa deve orientar correção e devolver solicitação para análise
- QC-REG-LS-051 - E-mail de recusa para Usuário Empresa deve informar justificativa e bloquear login
- QC-REG-LS-052 - Usuário Empresa deve passar por ajustes, conversa, aprovação final e login
- QC-REG-LS-053 - Usuário público deve solicitar acesso como Usuário TC, receber e-mail inicial e acompanhar status
- QC-REG-LS-054 - E-mail de solicitação recebida para Usuário TC deve conter dados e link de consulta
- QC-REG-LS-055 - Consulta pública inicial de Usuário TC deve exibir status aguardando análise e dados essenciais
- QC-REG-LS-056 - E-mail de aceite para Usuário TC deve liberar login e preservar permissões
- QC-REG-LS-057 - E-mail de alteração para Usuário TC deve orientar correção e devolver solicitação para análise
- QC-REG-LS-058 - E-mail de recusa para Usuário TC deve informar justificativa e bloquear login
- QC-REG-LS-059 - Usuário TC deve passar por ajustes, conversa, aprovação final e login
- QC-REG-LS-060 - Usuário público deve solicitar acesso como Líder TC, receber e-mail inicial e acompanhar status
- QC-REG-LS-061 - E-mail de solicitação recebida para Líder TC deve conter dados e link de consulta
- QC-REG-LS-062 - Consulta pública inicial de Líder TC deve exibir status aguardando análise e dados essenciais
- QC-REG-LS-063 - E-mail de aceite para Líder TC deve liberar login e preservar permissões
- QC-REG-LS-064 - E-mail de alteração para Líder TC deve orientar correção e devolver solicitação para análise
- QC-REG-LS-065 - E-mail de recusa para Líder TC deve informar justificativa e bloquear login
- QC-REG-LS-066 - Líder TC deve passar por ajustes, conversa, aprovação final e login
- QC-REG-LS-067 - Usuário público deve solicitar acesso como Suporte Técnico, receber e-mail inicial e acompanhar status
- QC-REG-LS-068 - E-mail de solicitação recebida para Suporte Técnico deve conter dados e link de consulta
- QC-REG-LS-069 - Consulta pública inicial de Suporte Técnico deve exibir status aguardando análise e dados essenciais
- QC-REG-LS-070 - E-mail de aceite para Suporte Técnico deve liberar login e preservar permissões
- QC-REG-LS-071 - E-mail de alteração para Suporte Técnico deve orientar correção e devolver solicitação para análise
- QC-REG-LS-072 - E-mail de recusa para Suporte Técnico deve informar justificativa e bloquear login
- QC-REG-LS-073 - Suporte Técnico deve passar por ajustes, conversa, aprovação final e login
- QC-REG-LS-074 - Consulta pública pelo link recebido no e-mail deve abrir a solicitação correta
- QC-REG-LS-075 - Consulta manual por e-mail e token deve retornar status sem expor chave em resposta pública
- QC-REG-LS-076 - Consulta com status aguardando análise deve exibir datas e mensagem de acompanhamento
- QC-REG-LS-077 - Consulta após solicitação de alteração deve exibir campos e comentários de correção
- QC-REG-LS-078 - Consulta após correção enviada deve retornar solicitação para análise
- QC-REG-LS-079 - Consulta após aprovação deve exibir status aprovado e orientação de acesso
- QC-REG-LS-080 - Consulta após recusa ou rejeição deve exibir status final e justificativa
- QC-REG-LS-081 - Consulta com link ou chave inválida não deve expor erro interno
- QC-REG-LS-082 - Consulta de solicitação inexistente deve orientar usuário sem enumerar dados
- QC-REG-LS-083 - Consulta pública não deve expor senha, dados administrativos ou campos não necessários
- QC-REG-LS-084 - Consulta deve aceitar somente campos solicitados para correção
- QC-REG-LS-085 - Consulta não deve permitir nova correção após retorno para análise
- QC-REG-LS-086 - Reenvio de código de consulta deve enviar e-mail sem revelar accessKey na resposta
- QC-REG-LS-087 - Líder TC acessa tela de Solicitações e visualiza fila de análise
- QC-REG-LS-088 - Líder TC visualiza solicitações de todos os perfis permitidos
- QC-REG-LS-089 - Líder TC abre detalhes da solicitação e visualiza dados do solicitante
- QC-REG-LS-090 - Líder TC aceita solicitação e libera login do usuário
- QC-REG-LS-091 - Líder TC solicita alteração com comentário e campos específicos
- QC-REG-LS-092 - Usuário público corrige dados e Líder TC aprova após correção
- QC-REG-LS-093 - Líder TC recusa solicitação com justificativa obrigatória
- QC-REG-LS-094 - Líder TC comenta solicitação e histórico deve preservar conversa
- QC-REG-LS-095 - Ações do Líder TC devem enviar e-mails corretos de aceite, alteração e recusa
- QC-REG-LS-096 - Solicitação finalizada por Líder TC não deve permitir alteração indevida
- QC-REG-LS-097 - Rota antiga /admin/requests não deve existir como fluxo válido
- QC-REG-LS-098 - Tela de Solicitações para Líder TC deve atender acessibilidade crítica
- QC-REG-LS-109 - Empresa acessa tela de Solicitações com escopo da própria empresa
- QC-REG-LS-118 - Empresa não acessa admin inteiro fora do escopo permitido
- QC-REG-LS-119 - Empresa não visualiza dados administrativos fora do escopo
- QC-REG-LS-121 - Usuário aprovado por Empresa deve entrar com escopo correto da empresa

## Casos que não devem ser vinculados ainda

- QC-REG-LS-006 - Login com credenciais inválidas deve falhar sem criar sessão (Candidato à automação)
- QC-REG-LS-007 - Login sem preencher campos obrigatórios deve orientar o usuário e impedir envio (Candidato à automação)
- QC-REG-LS-008 - Logout deve encerrar sessão e impedir reutilização da área autenticada (Candidato à automação)
- QC-REG-LS-012 - Sessão expirada deve redirecionar para Login sem manter dados sensíveis em tela (Candidato à automação)
- QC-REG-LS-014 - Esqueci Senha deve validar campos obrigatórios antes de solicitar recuperação (Candidato à automação)
- QC-REG-LS-017 - Redefinição deve rejeitar senha fora do padrão de segurança (Candidato à automação)
- QC-REG-LS-018 - Redefinição deve rejeitar confirmação de senha divergente (Candidato à automação)
- QC-REG-LS-032 - Solicitar Acesso deve validar campos obrigatórios antes de criar solicitação (Candidato à automação)
- QC-REG-LS-033 - Solicitar Acesso deve rejeitar e-mail inválido com mensagem compreensível (Candidato à automação)
- QC-REG-LS-034 - Solicitar Acesso deve validar senha obrigatória e padrão de senha (Candidato à automação)
- QC-REG-LS-099 - Suporte Técnico acessa tela de Solicitações quando autorizado (Automatizado UI)
- QC-REG-LS-100 - Suporte Técnico visualiza solicitações permitidas sem acessar itens proibidos (Parcialmente automatizado)
- QC-REG-LS-101 - Suporte Técnico abre detalhes da solicitação permitida (Parcialmente automatizado)
- QC-REG-LS-102 - Suporte Técnico aceita solicitação permitida e libera login (Automatizado API)
- QC-REG-LS-103 - Suporte Técnico solicita alteração e recebe dados corrigidos (Automatizado API)
- QC-REG-LS-104 - Suporte Técnico recusa solicitação com motivo e e-mail (Automatizado API)
- QC-REG-LS-105 - Suporte Técnico não deve aprovar perfil fora da sua regra de atuação (Precisa análise)
- QC-REG-LS-106 - Suporte Técnico não deve visualizar ações administrativas indevidas (Parcialmente automatizado)
- QC-REG-LS-107 - Suporte Técnico comenta solicitação quando permitido (Parcialmente automatizado)
- QC-REG-LS-108 - Permissões do Suporte Técnico devem ser respeitadas na navegação base (Automatizado API)
- QC-REG-LS-110 - Empresa visualiza somente solicitações vinculadas à própria empresa (Automatizado UI)
- QC-REG-LS-111 - Empresa não visualiza solicitação de outra empresa na busca ou listagem (Automatizado UI)
- QC-REG-LS-112 - Empresa não acessa solicitação de outra empresa por URL direta (Automatizado UI/API)
- QC-REG-LS-113 - Empresa aceita solicitação da própria empresa quando a regra permitir (Automatizado E2E)
- QC-REG-LS-114 - Empresa solicita alteração em solicitação da própria empresa (Candidato à automação)
- QC-REG-LS-115 - Empresa recusa solicitação da própria empresa com justificativa (Candidato à automação)
- QC-REG-LS-116 - Empresa comenta solicitação da própria empresa quando permitido (Candidato à automação)
- QC-REG-LS-117 - Empresa não comenta nem altera solicitação de outra empresa (Automatizado UI/API)
- QC-REG-LS-120 - Solicitação aprovada pela Empresa deve manter vínculo correto com a empresa (Automatizado E2E)
- QC-REG-LS-122 - Fluxo de escopo da Empresa deve usar pelo menos duas empresas distintas (Automatizado UI)
- QC-REG-LS-123 - E-mails de aceite, alteração e recusa por ação da Empresa devem refletir status correto (Parcialmente automatizado)

## Complemento - Documentação viva da pasta testes/

A sincronização completa desta etapa adicionou a regra de que o Qase é a documentação viva da pasta `testes/`.

- Definições de teste inventariadas: 456

Detalhes completos:

- `docs/qase/inventario-testes-repositorio.md`
- `docs/qase/matriz-qase-vs-repositorio.md`
- `docs/qase/plano-teste-regressao-quality-control.md`
- `docs/qase/resultado-run-regressao-quality-control.md`
- `docs/qase/lacunas-repositorio-qase.md`

## Complemento 2026-06-21 - Empresa em Solicitações

Regra oficial aplicada: Empresa possui acesso restrito à tela Solicitações e pode executar o fluxo completo de análise apenas para solicitações vinculadas à própria empresa. Solicitações de outras empresas não devem ser exibidas nem acessíveis por URL direta ou API.

Atualização de cobertura:

- QC-REG-LS-109, #160: Empresa acessa a tela Solicitações com escopo da própria empresa. Validado no spec de permissão e no spec de escopo.
- QC-REG-LS-110, #161: Empresa visualiza somente solicitações da própria empresa. Validado em headed.
- QC-REG-LS-111, #162: Empresa não visualiza solicitação de outra empresa na listagem/busca/API. Validado em headed.
- QC-REG-LS-112, #163: Empresa não acessa nem atua em solicitação de outra empresa por URL direta/API. Validado em headed.
- QC-REG-LS-113, #164: Empresa aceita/aprova solicitação da própria empresa. Validado em headed.
- QC-REG-LS-117, #168: Empresa não comenta nem altera solicitação de outra empresa. Validado por endpoints diretos bloqueados.
- QC-REG-LS-118, #169: Empresa não acessa admin inteiro fora de `/admin/access-requests`. Validado em headed.
- QC-REG-LS-120, #171: Solicitação aprovada pela Empresa mantém vínculo correto com a empresa. Validado em headed.
- QC-REG-LS-121, #172: Usuário aprovado por Empresa entra com escopo correto da empresa. Validado em headed.
- QC-REG-LS-122, #173: Fluxo usa duas empresas distintas. Validado no spec de escopo.
- QC-REG-LS-123, #174: E-mail de aceite foi validado porque a captura estava configurada; e-mails de alteração/recusa por Empresa seguem pendentes.

Cases automáticos novos:

- #631 `[AUTO] Empresa deve aceitar solicitacao vinculada a propria empresa`.
- #632 `[AUTO] Empresa deve acessar somente a tela Solicitações dentro do admin`.

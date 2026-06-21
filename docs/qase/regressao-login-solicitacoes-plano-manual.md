# Plano de testes manual para Qase - Regressão Login e Solicitações

## Contexto

Projeto: Quality Control.

Este plano cria a primeira suíte de regressão manual no Qase para validar Login, Acesso, Esqueci Senha, Solicitar Acesso por usuário público e a tela interna de Solicitações. A análise foi feita sem refatorar código, sem alterar Playwright, package, imports ou helpers, e usando apenas documentação nova em `docs/qase/`.

O projeto Qase informado pelo link `https://app.qase.io/project/qc` foi lido via API como código `qc`. No momento da leitura inicial ele estava vazio, com 0 suites e 0 casos.

## Objetivo

Criar casos manuais ricos, rastreáveis e executáveis no Qase, mapeando a automação Playwright/API/BD já existente e destacando lacunas para automação futura.

## Escopo

- Login / Acesso por perfil.
- Login / Esqueci Senha por perfil, incluindo e-mails, token, senha antiga/nova e preservação de perfil.
- Login / Solicitar Acesso — Usuário Público, incluindo criação, e-mails, consulta pública, aprovação, ajuste, recusa/rejeição e login pós-aprovação.
- Solicitações para Líder TC, Suporte Técnico e Empresa.
- Escopo da Empresa com duas empresas distintas.

## Fora de escopo

- Refatoração de testes.
- Alteração de configuração Playwright, package.json, imports ou helpers.
- Criação de dependência obrigatória com Qase no repositório.
- Inserção de token Qase em código ou documentação.
- Correção de testes quebrados.
- Criação de campos customizados via API.

## Estrutura Qase

```text
Regressão
  Login
    Acesso
    Esqueci Senha
    Solicitar Acesso — Usuário Público
      Consulta Pública
  Solicitações
    Líder TC
    Suporte Técnico
    Empresa
```

## Estratégia de execução

1. Executar primeiro os casos críticos de autenticação, escopo e aprovação.
2. Executar os fluxos públicos com outbox JSONL quando e-mail real não estiver habilitado.
3. Executar os casos de e-mail por perfil validando destinatário, assunto, conteúdo, link e ausência de dados sensíveis.
4. Executar casos da Empresa sempre com pelo menos duas empresas distintas.
5. Usar a automação existente como apoio de evidência, sem impedir execução manual quando a automação falhar.

## Critério de entrada

- Ambiente local ou de homologação acessível.
- Playwright consegue subir webServer ou usar servidor existente.
- Seeds de usuários revisores disponíveis.
- Outbox configurado quando e-mail real estiver desabilitado.
- Massa de empresas disponível para cenários Empresa/Usuário Empresa.

## Critério de saída

- Casos críticos de Login, Esqueci Senha, Solicitar Acesso e Solicitações executados.
- Evidências anexadas aos casos Qase.
- Lacunas de automação classificadas.
- Riscos de regra e ambiente registrados.

## Riscos

- O fluxo de e-mail depende de outbox, mock, arquivo JSONL ou SMTP real; a evidência deve deixar claro qual mecanismo foi usado.
- Regra oficial de Empresa em Solicitações já aplicada: Empresa acessa apenas a tela Solicitações e atua somente em solicitações vinculadas à própria empresa; outra empresa é bloqueada por listagem, URL direta e API.
- Fluxos com aprovação e login dependem de massa limpa, senha `E2E_PROFILE_PASSWORD`, criação de usuários e isolamento de solicitações duplicadas.
- Consulta pública depende de `accessKey` recebido por e-mail ou de consulta manual por e-mail/token quando disponível.
- Rejeição e recusa aparecem como conceitos próximos na implementação; manter a diferença como ponto de análise quando a UI expuser ações separadas.

## Dependências

- `playwright.config.ts` define `EMAIL_CAPTURE_MODE=file`, `EMAIL_CAPTURE_FILE=test-results/emails/outbox.jsonl`, `AUTH_STORE=json` e `TICKETS_STORE=json` para E2E.
- Seeds em `support/functions/banco-de-dados/solicitar-acesso/usuarios/criar-usuarios-teste.ts`.
- Helpers de Solicitar Acesso em `support/functions/api/solicitar-acesso` e `support/functions/ui/login/solicitar-acesso`.
- Helpers de Esqueci Senha em `support/functions/ui/login/esqueci-senha`.

## Massa de dados

- Perfis: Empresa, Usuário Empresa, Usuário TC, Líder TC e Suporte Técnico.
- Revisor principal: Líder TC.
- Revisor alternativo: Suporte Técnico quando autorizado.
- Empresas: pelo menos duas empresas distintas para escopo.
- E-mails: usar e-mails únicos por execução, preferencialmente `quality-control.test` ou helper `criarEmailTeste`.
- Senhas: usar senha do ambiente quando disponível e evitar registrar segredos reais em evidências.

## Resumo quantitativo

- Total de casos manuais gerados: 123
- Casos com automação mapeada ou parcial: 104
- Casos candidatos à automação: 18
- Casos somente manuais ou que precisam análise: 1
- Casos de e-mail: 39
- Casos de consulta pública: 38
- Casos que podem ser vinculados ao Qase agora: 92

### Status de automação

- Parcialmente automatizado: 30
- Candidato à automação: 18
- Automatizado UI: 25
- Automatizado BD: 1
- Automatizado E2E: 22
- Automatizado API: 26
- Precisa análise: 1

## Campos customizados recomendados para Qase

- Tela
- Fluxo
- Perfil executor
- Perfil afetado
- Camada
- Status de automação
- Arquivo automatizado
- Comando de execução
- Dependência de e-mail
- Dependência de banco
- Dependência de seed
- Tipo de evidência
- Risco
- Pode vincular automação agora?

## Comandos de execução documentados

```bash
npm run typecheck -- --pretty false
```

```bash
npx playwright test testes/ui/login/esqueci-senha --project=chromium --list
```

```bash
npx playwright test testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

```bash
npx playwright test testes/ui/login/solicitar-acesso --project=chromium --list
```

```bash
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

```bash
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/fluxo-completo/solicitacao-ajuste-aprovacao.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

## Casos de teste detalhados

### QC-REG-LS-001 - Login com perfil Líder TC deve autenticar e exibir módulos administrativos permitidos

- Suite Qase: Regressão > Login > Acesso
- Objetivo: Validar que o Líder TC consegue autenticar e acessar os módulos administrativos esperados.
- Descrição detalhada: Validar que o Líder TC consegue autenticar e acessar os módulos administrativos esperados. A validação protege o fluxo de entrada do Quality Control e reduz risco de exposição indevida de módulos após autenticação.
- Regra de negócio validada: Líder TC é perfil administrativo autorizado para revisar solicitações e acessar módulos globais permitidos.
- Perfil executor: QA / Líder TC
- Perfil afetado: Líder TC
- Tipo de teste: Funcional
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Usuário autenticado ou bloqueado conforme regra do caso, sem vazamento de menu, rota ou dados fora do escopo.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, login, acesso, lider-tc, permissao
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/ui/login/login/login-real.ui.spec.ts; testes/ui/login/solicitar-acesso/solicitacoes-admin/permissao/acessar-modulo.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/login/login-real.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/permissao/acessar-modulo.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para login do perfil Líder TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA / Líder TC acessa a tela ou endpoint necessário para iniciar login do perfil Líder TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Informar credenciais válidas de Líder TC, submeter o login e acessar a navegação administrativa.

Resultado esperado:
A sessão deve ser criada, `/api/me` deve retornar o perfil correto e o módulo Solicitações deve estar disponível quando a regra permitir.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
O acesso final deve respeitar a identidade autenticada, a sessão criada e os menus/rotas permitidos para o perfil.

### QC-REG-LS-002 - Login com perfil Suporte Técnico deve autenticar e exibir apenas módulos permitidos

- Suite Qase: Regressão > Login > Acesso
- Objetivo: Validar que Suporte Técnico autentica e enxerga somente o conjunto de menus previsto para operação técnica.
- Descrição detalhada: Validar que Suporte Técnico autentica e enxerga somente o conjunto de menus previsto para operação técnica. A validação protege o fluxo de entrada do Quality Control e reduz risco de exposição indevida de módulos após autenticação.
- Regra de negócio validada: Suporte Técnico pode atuar em solicitações permitidas, mas não deve receber privilégios globais de Líder TC.
- Perfil executor: QA / Suporte Técnico
- Perfil afetado: Suporte Técnico
- Tipo de teste: Funcional
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Usuário autenticado ou bloqueado conforme regra do caso, sem vazamento de menu, rota ou dados fora do escopo.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, login, acesso, suporte-tecnico, permissao
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/solicitacoes-admin/permissao/acessar-modulo.ui.spec.ts; testes/api/navegacao/perfil-suporte-navegacao-base.test.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/permissao/acessar-modulo.ui.spec.ts --project=chromium --workers=1 --reporter=list
npm test -- testes/api/navegacao/perfil-suporte-navegacao-base.test.ts --runInBand
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para login do perfil Suporte Técnico, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA / Suporte Técnico acessa a tela ou endpoint necessário para iniciar login do perfil Suporte Técnico, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Informar credenciais válidas de Suporte Técnico e abrir a área autenticada.

Resultado esperado:
O menu deve refletir o inventário autorizado e qualquer rota fora do escopo deve ser bloqueada ou ocultada.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
O acesso final deve respeitar a identidade autenticada, a sessão criada e os menus/rotas permitidos para o perfil.

### QC-REG-LS-003 - Login com perfil Empresa deve autenticar no escopo da própria empresa

- Suite Qase: Regressão > Login > Acesso
- Objetivo: Validar que o perfil Empresa entra no contexto empresarial correto e não recebe escopo de outra empresa.
- Descrição detalhada: Validar que o perfil Empresa entra no contexto empresarial correto e não recebe escopo de outra empresa. A validação protege o fluxo de entrada do Quality Control e reduz risco de exposição indevida de módulos após autenticação.
- Regra de negócio validada: Empresa opera apenas dados vinculados à própria empresa.
- Perfil executor: QA / Empresa
- Perfil afetado: Empresa
- Tipo de teste: Funcional
- Camada: UI
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Usuário autenticado ou bloqueado conforme regra do caso, sem vazamento de menu, rota ou dados fora do escopo.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, login, acesso, empresa, escopo, seguranca
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/solicitacoes-admin/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts; testes/ui/login/login/menu-autenticado.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para login do perfil Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA / Empresa acessa a tela ou endpoint necessário para iniciar login do perfil Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar uma empresa aprovada e informar o `companySlug` quando o ambiente exigir contexto ativo.

Resultado esperado:
A sessão deve apontar para `clientId` e `clientSlug` da empresa autenticada, sem acesso ao admin global.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
O acesso final deve respeitar a identidade autenticada, a sessão criada e os menus/rotas permitidos para o perfil.

### QC-REG-LS-004 - Login com Usuário Empresa deve autenticar em contexto empresarial e bloquear admin global

- Suite Qase: Regressão > Login > Acesso
- Objetivo: Validar que Usuário Empresa acessa o workspace da empresa vinculada sem herdar permissões administrativas globais.
- Descrição detalhada: Validar que Usuário Empresa acessa o workspace da empresa vinculada sem herdar permissões administrativas globais. A validação protege o fluxo de entrada do Quality Control e reduz risco de exposição indevida de módulos após autenticação.
- Regra de negócio validada: Usuário Empresa deve permanecer limitado ao contexto da empresa associada.
- Perfil executor: QA / Usuário Empresa
- Perfil afetado: Usuário Empresa
- Tipo de teste: Funcional
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Usuário autenticado ou bloqueado conforme regra do caso, sem vazamento de menu, rota ou dados fora do escopo.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, login, acesso, usuario-empresa, escopo, permissao
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/ui/login/login/menu-autenticado.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para login do perfil Usuário Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA / Usuário Empresa acessa a tela ou endpoint necessário para iniciar login do perfil Usuário Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Informar credenciais de Usuário Empresa vinculado e acessar a aplicação.

Resultado esperado:
O usuário deve cair no dashboard da empresa e uma tentativa de `/admin/clients` deve ser negada ou redirecionada.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
O acesso final deve respeitar a identidade autenticada, a sessão criada e os menus/rotas permitidos para o perfil.

### QC-REG-LS-005 - Login com Usuário TC deve autenticar preservando perfil e permissões internas

- Suite Qase: Regressão > Login > Acesso
- Objetivo: Validar que Usuário TC entra com a identidade correta e mantém o conjunto de permissões internas esperadas.
- Descrição detalhada: Validar que Usuário TC entra com a identidade correta e mantém o conjunto de permissões internas esperadas. A validação protege o fluxo de entrada do Quality Control e reduz risco de exposição indevida de módulos após autenticação.
- Regra de negócio validada: Usuário TC não deve ser confundido com Usuário Empresa nem com perfis revisores.
- Perfil executor: QA / Usuário TC
- Perfil afetado: Usuário TC
- Tipo de teste: Funcional
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Usuário autenticado ou bloqueado conforme regra do caso, sem vazamento de menu, rota ou dados fora do escopo.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, login, acesso, usuario-tc, permissao
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para login do perfil Usuário TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA / Usuário TC acessa a tela ou endpoint necessário para iniciar login do perfil Usuário TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar Usuário TC aprovado ou criado pela massa de teste.

Resultado esperado:
O retorno de sessão deve preservar e-mail, perfil e ausência de escopo empresarial indevido.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
O acesso final deve respeitar a identidade autenticada, a sessão criada e os menus/rotas permitidos para o perfil.

### QC-REG-LS-006 - Login com credenciais inválidas deve falhar sem criar sessão

- Suite Qase: Regressão > Login > Acesso
- Objetivo: Validar que e-mail, usuário ou senha inválidos não autenticam nem deixam cookies de sessão válidos.
- Descrição detalhada: Validar que e-mail, usuário ou senha inválidos não autenticam nem deixam cookies de sessão válidos. A validação protege o fluxo de entrada do Quality Control e reduz risco de exposição indevida de módulos após autenticação.
- Regra de negócio validada: Credenciais inválidas devem ser rejeitadas de forma segura.
- Perfil executor: QA
- Perfil afetado: Todos os perfis
- Tipo de teste: Segurança/Escopo
- Camada: Manual
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Usuário autenticado ou bloqueado conforme regra do caso, sem vazamento de menu, rota ou dados fora do escopo.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, login, acesso, seguranca, validacao-campos
- Status de automação: Candidato à automação
- Arquivo automatizado relacionado: Não localizado
- Comando de execução:

```bash
Não aplicável
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para login do perfil Todos os perfis, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar login do perfil Todos os perfis, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Tentar login com usuário inexistente, senha incorreta e combinações inválidas conhecidas.

Resultado esperado:
A aplicação deve exibir mensagem segura, sem enumerar usuário e sem retornar sessão válida.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
O acesso final deve respeitar a identidade autenticada, a sessão criada e os menus/rotas permitidos para o perfil.

### QC-REG-LS-007 - Login sem preencher campos obrigatórios deve orientar o usuário e impedir envio

- Suite Qase: Regressão > Login > Acesso
- Objetivo: Validar obrigatoriedade dos campos de usuário/e-mail e senha na tela de Login.
- Descrição detalhada: Validar obrigatoriedade dos campos de usuário/e-mail e senha na tela de Login. A validação protege o fluxo de entrada do Quality Control e reduz risco de exposição indevida de módulos após autenticação.
- Regra de negócio validada: Campos obrigatórios devem ser validados antes de autenticar.
- Perfil executor: QA
- Perfil afetado: Todos os perfis
- Tipo de teste: Validação de campos
- Camada: Manual
- Prioridade: Média
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Usuário autenticado ou bloqueado conforme regra do caso, sem vazamento de menu, rota ou dados fora do escopo.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, login, acesso, validacao-campos
- Status de automação: Candidato à automação
- Arquivo automatizado relacionado: Não localizado
- Comando de execução:

```bash
Não aplicável
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para login do perfil Todos os perfis, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar login do perfil Todos os perfis, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Abrir a tela de Login, tentar enviar sem preencher campos e repetir com apenas um campo preenchido.

Resultado esperado:
O botão ou submit deve ser bloqueado ou mensagens de validação devem indicar os campos pendentes.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
O acesso final deve respeitar a identidade autenticada, a sessão criada e os menus/rotas permitidos para o perfil.

### QC-REG-LS-008 - Logout deve encerrar sessão e impedir reutilização da área autenticada

- Suite Qase: Regressão > Login > Acesso
- Objetivo: Validar que logout remove a sessão ativa e força nova autenticação para rotas protegidas.
- Descrição detalhada: Validar que logout remove a sessão ativa e força nova autenticação para rotas protegidas. A validação protege o fluxo de entrada do Quality Control e reduz risco de exposição indevida de módulos após autenticação.
- Regra de negócio validada: Encerramento de sessão deve invalidar cookies/tokens locais.
- Perfil executor: QA
- Perfil afetado: Todos os perfis
- Tipo de teste: Segurança/Escopo
- Camada: Manual
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Usuário autenticado ou bloqueado conforme regra do caso, sem vazamento de menu, rota ou dados fora do escopo.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, login, acesso, sessao, seguranca
- Status de automação: Candidato à automação
- Arquivo automatizado relacionado: Não localizado
- Comando de execução:

```bash
Não aplicável
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para login do perfil Todos os perfis, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar login do perfil Todos os perfis, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar um usuário válido, acionar logout e tentar voltar para a URL autenticada anterior.

Resultado esperado:
A aplicação deve redirecionar para Login ou retornar 401/403, sem preservar ações autenticadas.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
O acesso final deve respeitar a identidade autenticada, a sessão criada e os menus/rotas permitidos para o perfil.

### QC-REG-LS-009 - Rota protegida sem login deve bloquear acesso e redirecionar para Login

- Suite Qase: Regressão > Login > Acesso
- Objetivo: Validar que rotas internas não podem ser abertas sem sessão.
- Descrição detalhada: Validar que rotas internas não podem ser abertas sem sessão. A validação protege o fluxo de entrada do Quality Control e reduz risco de exposição indevida de módulos após autenticação.
- Regra de negócio validada: Rotas protegidas exigem autenticação válida.
- Perfil executor: QA
- Perfil afetado: Usuário não autenticado
- Tipo de teste: Segurança/Escopo
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Usuário autenticado ou bloqueado conforme regra do caso, sem vazamento de menu, rota ou dados fora do escopo.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, login, acesso, seguranca, permissao
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/ui/login/login/login-real.ui.spec.ts; testes/ui/login/login/menu-autenticado.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/login/login-real.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para login do perfil Usuário não autenticado, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar login do perfil Usuário não autenticado, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Abrir `/api/me`, `/admin/clients` e uma rota de empresa sem cookies de sessão.

Resultado esperado:
A API deve retornar 401 e a UI deve negar acesso ou redirecionar para a tela pública de Login.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
O acesso final deve respeitar a identidade autenticada, a sessão criada e os menus/rotas permitidos para o perfil.

### QC-REG-LS-010 - Perfil autenticado deve visualizar somente menus permitidos

- Suite Qase: Regressão > Login > Acesso
- Objetivo: Validar que a navegação lateral é filtrada pelo perfil e contexto ativo.
- Descrição detalhada: Validar que a navegação lateral é filtrada pelo perfil e contexto ativo. A validação protege o fluxo de entrada do Quality Control e reduz risco de exposição indevida de módulos após autenticação.
- Regra de negócio validada: Menus devem refletir permissões efetivas do usuário autenticado.
- Perfil executor: QA
- Perfil afetado: Todos os perfis
- Tipo de teste: Permissão
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Usuário autenticado ou bloqueado conforme regra do caso, sem vazamento de menu, rota ou dados fora do escopo.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, login, acesso, permissao, escopo
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/login/menu-autenticado.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para login do perfil Todos os perfis, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar login do perfil Todos os perfis, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar perfis simulados e comparar menus globais e de empresa.

Resultado esperado:
Links administrativos, módulos de empresa e opções operacionais devem aparecer ou sumir conforme o perfil.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
O acesso final deve respeitar a identidade autenticada, a sessão criada e os menus/rotas permitidos para o perfil.

### QC-REG-LS-011 - Perfil autenticado não deve acessar rota fora da permissão via URL direta

- Suite Qase: Regressão > Login > Acesso
- Objetivo: Validar bloqueio de acesso direto para rotas fora do escopo do perfil.
- Descrição detalhada: Validar bloqueio de acesso direto para rotas fora do escopo do perfil. A validação protege o fluxo de entrada do Quality Control e reduz risco de exposição indevida de módulos após autenticação.
- Regra de negócio validada: Permissão deve ser aplicada no backend e na navegação, não apenas por ocultação de menu.
- Perfil executor: QA
- Perfil afetado: Todos os perfis
- Tipo de teste: Segurança/Escopo
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Usuário autenticado ou bloqueado conforme regra do caso, sem vazamento de menu, rota ou dados fora do escopo.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, login, acesso, permissao, seguranca
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/ui/login/login/menu-autenticado.ui.spec.ts; testes/ui/login/solicitar-acesso/solicitacoes-admin/permissao/acessar-modulo.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/permissao/acessar-modulo.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para login do perfil Todos os perfis, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar login do perfil Todos os perfis, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar usuário sem permissão e acessar diretamente rotas administrativas ou módulo Solicitações.

Resultado esperado:
A aplicação deve negar acesso, retornar 401/403 ou redirecionar para uma página permitida.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
O acesso final deve respeitar a identidade autenticada, a sessão criada e os menus/rotas permitidos para o perfil.

### QC-REG-LS-012 - Sessão expirada deve redirecionar para Login sem manter dados sensíveis em tela

- Suite Qase: Regressão > Login > Acesso
- Objetivo: Validar comportamento quando cookies ou tokens deixam de ser válidos durante a navegação.
- Descrição detalhada: Validar comportamento quando cookies ou tokens deixam de ser válidos durante a navegação. A validação protege o fluxo de entrada do Quality Control e reduz risco de exposição indevida de módulos após autenticação.
- Regra de negócio validada: Sessão expirada não deve permitir ações autenticadas nem expor dados cacheados.
- Perfil executor: QA
- Perfil afetado: Todos os perfis
- Tipo de teste: Segurança/Escopo
- Camada: Manual
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Usuário autenticado ou bloqueado conforme regra do caso, sem vazamento de menu, rota ou dados fora do escopo.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, login, acesso, sessao, seguranca
- Status de automação: Candidato à automação
- Arquivo automatizado relacionado: Não localizado
- Comando de execução:

```bash
Não aplicável
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para login do perfil Todos os perfis, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar login do perfil Todos os perfis, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Simular expiração removendo cookie/token ou usando sessão inválida e tentar executar ação autenticada.

Resultado esperado:
A aplicação deve limpar estado sensível, bloquear a ação e redirecionar para Login.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
O acesso final deve respeitar a identidade autenticada, a sessão criada e os menus/rotas permitidos para o perfil.

### QC-REG-LS-013 - Tela pública de Esqueci Senha deve abrir sem login

- Suite Qase: Regressão > Login > Esqueci Senha
- Objetivo: Garantir que o usuário consiga iniciar recuperação pela tela pública.
- Descrição detalhada: A tela de Esqueci Senha precisa ser acessível antes da autenticação para permitir recuperação de acesso.
- Regra de negócio validada: Fluxo público iniciado pela tela de Login não exige sessão.
- Perfil executor: Usuário público
- Perfil afetado: Todos os perfis
- Tipo de teste: Funcional
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Tela pública exibida com formulário de recuperação e sem erro de autenticação.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, esqueci-senha, login, usuario-publico
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para abertura pública de Esqueci Senha, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar abertura pública de Esqueci Senha, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Acessar `/login/forgot-password` diretamente e pela opção pública da tela de Login.

Resultado esperado:
O formulário deve aparecer com campo de e-mail/usuário e sem redirecionar para uma área autenticada.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
A recuperação pode ser iniciada sem sessão ativa.

### QC-REG-LS-014 - Esqueci Senha deve validar campos obrigatórios antes de solicitar recuperação

- Suite Qase: Regressão > Login > Esqueci Senha
- Objetivo: Validar mensagens ou bloqueio de envio quando usuário/e-mail não é informado.
- Descrição detalhada: O fluxo deve orientar o usuário antes de acionar API ou gerar solicitação incompleta.
- Regra de negócio validada: Campo de identificação é obrigatório para recuperação.
- Perfil executor: Usuário público
- Perfil afetado: Todos os perfis
- Tipo de teste: Validação de campos
- Camada: Manual
- Prioridade: Média
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Usuário recebe orientação de preenchimento e a API não processa solicitação vazia.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, esqueci-senha, login, validacao-campos, usuario-publico, candidato-automacao
- Status de automação: Candidato à automação
- Arquivo automatizado relacionado: Não localizado
- Comando de execução:

```bash
Não aplicável
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para validação obrigatória de Esqueci Senha, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar validação obrigatória de Esqueci Senha, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Tentar enviar o formulário vazio e repetir com espaços em branco no campo de identificação.

Resultado esperado:
A interface deve impedir o envio ou exibir orientação clara sobre o preenchimento obrigatório.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Nenhuma solicitação incompleta deve ser criada.

### QC-REG-LS-015 - Esqueci Senha com e-mail ou usuário inválido não deve permitir enumeração

- Suite Qase: Regressão > Login > Esqueci Senha
- Objetivo: Validar que a resposta é neutra quando o identificador não existe.
- Descrição detalhada: A mensagem pública não deve indicar se o e-mail está cadastrado, reduzindo risco de enumeração de usuários.
- Regra de negócio validada: Fluxos públicos de segurança devem responder sem revelar existência de conta.
- Perfil executor: Usuário público
- Perfil afetado: Todos os perfis
- Tipo de teste: Segurança/Escopo
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Resposta neutra e segura para identificadores inválidos.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, esqueci-senha, login, seguranca, usuario-publico, api
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts; testes/api/login/esqueci-senha/esqueci-senha.endpoint.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/login/esqueci-senha/esqueci-senha.endpoint.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para resposta neutra de Esqueci Senha, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar resposta neutra de Esqueci Senha, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Solicitar recuperação com e-mail desconhecido e comparar a mensagem com um cenário de e-mail válido.

Resultado esperado:
A resposta pública deve ser genérica e não indicar cadastro, perfil ou estado da conta.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Nenhuma informação sensível sobre existência de usuário deve ser exposta.

### QC-REG-LS-016 - Redefinir senha com token ou chave inválida deve ser bloqueado

- Suite Qase: Regressão > Login > Esqueci Senha
- Objetivo: Validar que token inválido não permite validar ou consumir redefinição de senha.
- Descrição detalhada: A recuperação só pode seguir quando o token ou chave foi emitido pelo fluxo correto e ainda está válido.
- Regra de negócio validada: Token inválido, expirado ou já consumido não pode redefinir senha.
- Perfil executor: Usuário público
- Perfil afetado: Todos os perfis
- Tipo de teste: Segurança/Escopo
- Camada: UI
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Token inválido rejeitado sem alteração de senha.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, esqueci-senha, login, seguranca, token
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para token inválido de redefinição, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar token inválido de redefinição, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Abrir a rota de redefinição com token inexistente, inválido ou adulterado e tentar consumir a redefinição.

Resultado esperado:
O fluxo deve exibir erro seguro e impedir alteração de senha.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Nenhuma credencial é alterada por token inválido.

### QC-REG-LS-017 - Redefinição deve rejeitar senha fora do padrão de segurança

- Suite Qase: Regressão > Login > Esqueci Senha
- Objetivo: Validar política de senha na etapa de redefinição.
- Descrição detalhada: Senha fraca ou fora do padrão não deve substituir a credencial atual.
- Regra de negócio validada: Nova senha deve cumprir política mínima configurada.
- Perfil executor: Usuário público
- Perfil afetado: Todos os perfis
- Tipo de teste: Validação de campos
- Camada: Manual
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Senha fora do padrão bloqueada com mensagem clara.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, esqueci-senha, login, validacao-campos, seguranca, candidato-automacao
- Status de automação: Candidato à automação
- Arquivo automatizado relacionado: Não localizado
- Comando de execução:

```bash
Não aplicável
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para política de senha no reset, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar política de senha no reset, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Usar um token válido e tentar definir senha curta, sem complexidade ou fora do padrão aceito.

Resultado esperado:
A interface/API deve rejeitar a senha e manter a credencial anterior válida.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
A senha só é alterada quando atende ao padrão.

### QC-REG-LS-018 - Redefinição deve rejeitar confirmação de senha divergente

- Suite Qase: Regressão > Login > Esqueci Senha
- Objetivo: Validar consistência entre nova senha e confirmação.
- Descrição detalhada: O usuário deve ser impedido de concluir reset quando os campos de senha não conferem.
- Regra de negócio validada: Confirmação de senha deve ser idêntica à nova senha.
- Perfil executor: Usuário público
- Perfil afetado: Todos os perfis
- Tipo de teste: Validação de campos
- Camada: Manual
- Prioridade: Média
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Reset bloqueado até que senha e confirmação coincidam.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, esqueci-senha, login, validacao-campos, candidato-automacao
- Status de automação: Candidato à automação
- Arquivo automatizado relacionado: Não localizado
- Comando de execução:

```bash
Não aplicável
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para confirmação divergente no reset, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar confirmação divergente no reset, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Usar token válido, preencher nova senha e confirmação com valores diferentes e tentar concluir.

Resultado esperado:
O fluxo deve apontar divergência e impedir o envio ou retorno de sucesso.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Nenhuma alteração de senha ocorre com confirmação divergente.

### QC-REG-LS-019 - Tela de Esqueci Senha deve atender acessibilidade crítica

- Suite Qase: Regressão > Login > Esqueci Senha
- Objetivo: Validar que o formulário público não possui violações graves de acessibilidade.
- Descrição detalhada: Usuários que precisam recuperar acesso devem conseguir navegar no fluxo com padrões básicos de acessibilidade.
- Regra de negócio validada: Tela pública de recuperação deve ser operável e compreensível.
- Perfil executor: QA
- Perfil afetado: Usuário público
- Tipo de teste: Acessibilidade
- Camada: UI
- Prioridade: Média
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Sem violações graves de acessibilidade na tela.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, esqueci-senha, login, acessibilidade, usuario-publico
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/esqueci-senha/acessibilidade/esqueci-senha.acessibilidade.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/esqueci-senha/acessibilidade/esqueci-senha.acessibilidade.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para acessibilidade de Esqueci Senha, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar acessibilidade de Esqueci Senha, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Abrir a tela pública, executar auditoria de acessibilidade e validar rótulos, foco e mensagens.

Resultado esperado:
Não devem existir violações graves para o formulário e seus controles principais.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Tela apta para execução manual e navegação assistiva básica.

### QC-REG-LS-020 - Geração de senha temporária deve respeitar complexidade e caracteres proibidos

- Suite Qase: Regressão > Login > Esqueci Senha
- Objetivo: Validar a função de geração de senha temporária usada por fluxos de recuperação.
- Descrição detalhada: Quando o fluxo usa senha temporária, a senha gerada precisa ser segura e não conter caracteres proibidos.
- Regra de negócio validada: Senha temporária deve cumprir complexidade e não quebrar canais de e-mail ou formulário.
- Perfil executor: QA
- Perfil afetado: Todos os perfis
- Tipo de teste: Banco de dados
- Camada: BD
- Prioridade: Média
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Senha temporária válida e segura conforme regras implementadas.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, esqueci-senha, login, bd, senha-temporaria
- Status de automação: Automatizado BD
- Arquivo automatizado relacionado: testes/bd/login/senha-temporaria/temp-password-generation.test.ts
- Comando de execução:

```bash
npm test -- testes/bd/login/senha-temporaria/temp-password-generation.test.ts --runInBand
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para geração de senha temporária, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Teste automatizado acessa a tela ou endpoint necessário para iniciar geração de senha temporária, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Executar a suíte unitária/BD que gera senhas temporárias repetidamente.

Resultado esperado:
As senhas devem respeitar o padrão esperado e evitar caracteres proibidos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Senhas temporárias permanecem compatíveis com recuperação e autenticação.

### QC-REG-LS-021 - Empresa deve recuperar senha, invalidar senha antiga e preservar permissões

- Suite Qase: Regressão > Login > Esqueci Senha
- Objetivo: Validar o fluxo completo de recuperação de senha para Empresa.
- Descrição detalhada: O caso cobre solicitação, aprovação/redefinição, tentativa de login com senha antiga, login com nova senha e preservação do perfil Empresa.
- Regra de negócio validada: Recuperação de senha não pode alterar perfil, vínculo de empresa ou permissões do usuário.
- Perfil executor: Usuário público / QA
- Perfil afetado: Empresa
- Tipo de teste: Fluxo completo
- Camada: E2E
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Senha antiga inválida, nova senha válida e perfil preservado após recuperação.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, esqueci-senha, login, empresa, e2e, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts; testes/ui/login/esqueci-senha/empresa/recuperar-senha.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/empresa/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para recuperação de senha do perfil Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar recuperação de senha do perfil Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Criar ou localizar usuário do perfil, solicitar recuperação, concluir a alteração com nova senha e tentar login com senha antiga e senha nova.

Resultado esperado:
Senha antiga deve falhar, senha nova deve autenticar e `/api/me` deve retornar e-mail, perfil e escopo originais.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar print da solicitação, e-mail/outbox de recuperação, retorno de login antigo, login novo e `/api/me`.

Resultado esperado:
O perfil Empresa recupera acesso sem perder vínculo ou permissões.

### QC-REG-LS-022 - E-mail de recuperação para Empresa deve orientar redefinição sem expor dados indevidos

- Suite Qase: Regressão > Login > Esqueci Senha
- Objetivo: Validar o conteúdo do e-mail de recuperação enviado para Empresa.
- Descrição detalhada: O e-mail deve chegar ao destinatário correto, conter orientação clara, link ou token válido e não expor senha ou dados sensíveis indevidos.
- Regra de negócio validada: Comunicação de recuperação deve ser segura, rastreável e coerente com o perfil solicitado.
- Perfil executor: QA
- Perfil afetado: Empresa
- Tipo de teste: Integração
- Camada: Misto
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail correto para o perfil, com link funcional e sem dados sensíveis indevidos.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, esqueci-senha, login, empresa, email, api, automacao-existente
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts; testes/ui/login/esqueci-senha/empresa/recuperar-senha.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/empresa/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para e-mail de recuperação para Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar e-mail de recuperação para Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Solicitar recuperação para usuário válido, localizar e-mail no outbox ou provedor real e abrir o link/botão de redefinição.

Resultado esperado:
Destinatário, assunto, identificação, instrução, validade do link e ausência de dados sensíveis devem estar corretos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Salvar print ou HTML do e-mail, link mascarado quando necessário e resultado da validação do token.

Resultado esperado:
E-mail permite seguir o fluxo de redefinição com segurança.

### QC-REG-LS-023 - Usuário Empresa deve recuperar senha, invalidar senha antiga e preservar permissões

- Suite Qase: Regressão > Login > Esqueci Senha
- Objetivo: Validar o fluxo completo de recuperação de senha para Usuário Empresa.
- Descrição detalhada: O caso cobre solicitação, aprovação/redefinição, tentativa de login com senha antiga, login com nova senha e preservação do perfil Usuário Empresa.
- Regra de negócio validada: Recuperação de senha não pode alterar perfil, vínculo de empresa ou permissões do usuário.
- Perfil executor: Usuário público / QA
- Perfil afetado: Usuário Empresa
- Tipo de teste: Fluxo completo
- Camada: E2E
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Senha antiga inválida, nova senha válida e perfil preservado após recuperação.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, esqueci-senha, login, usuario-empresa, e2e, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts; testes/ui/login/esqueci-senha/usuario-empresa/recuperar-senha.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/usuario-empresa/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para recuperação de senha do perfil Usuário Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar recuperação de senha do perfil Usuário Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Criar ou localizar usuário do perfil, solicitar recuperação, concluir a alteração com nova senha e tentar login com senha antiga e senha nova.

Resultado esperado:
Senha antiga deve falhar, senha nova deve autenticar e `/api/me` deve retornar e-mail, perfil e escopo originais.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar print da solicitação, e-mail/outbox de recuperação, retorno de login antigo, login novo e `/api/me`.

Resultado esperado:
O perfil Usuário Empresa recupera acesso sem perder vínculo ou permissões.

### QC-REG-LS-024 - E-mail de recuperação para Usuário Empresa deve orientar redefinição sem expor dados indevidos

- Suite Qase: Regressão > Login > Esqueci Senha
- Objetivo: Validar o conteúdo do e-mail de recuperação enviado para Usuário Empresa.
- Descrição detalhada: O e-mail deve chegar ao destinatário correto, conter orientação clara, link ou token válido e não expor senha ou dados sensíveis indevidos.
- Regra de negócio validada: Comunicação de recuperação deve ser segura, rastreável e coerente com o perfil solicitado.
- Perfil executor: QA
- Perfil afetado: Usuário Empresa
- Tipo de teste: Integração
- Camada: Misto
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail correto para o perfil, com link funcional e sem dados sensíveis indevidos.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, esqueci-senha, login, usuario-empresa, email, api, automacao-existente
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts; testes/ui/login/esqueci-senha/usuario-empresa/recuperar-senha.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/usuario-empresa/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para e-mail de recuperação para Usuário Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar e-mail de recuperação para Usuário Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Solicitar recuperação para usuário válido, localizar e-mail no outbox ou provedor real e abrir o link/botão de redefinição.

Resultado esperado:
Destinatário, assunto, identificação, instrução, validade do link e ausência de dados sensíveis devem estar corretos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Salvar print ou HTML do e-mail, link mascarado quando necessário e resultado da validação do token.

Resultado esperado:
E-mail permite seguir o fluxo de redefinição com segurança.

### QC-REG-LS-025 - Usuário TC deve recuperar senha, invalidar senha antiga e preservar permissões

- Suite Qase: Regressão > Login > Esqueci Senha
- Objetivo: Validar o fluxo completo de recuperação de senha para Usuário TC.
- Descrição detalhada: O caso cobre solicitação, aprovação/redefinição, tentativa de login com senha antiga, login com nova senha e preservação do perfil Usuário TC.
- Regra de negócio validada: Recuperação de senha não pode alterar perfil, vínculo de empresa ou permissões do usuário.
- Perfil executor: Usuário público / QA
- Perfil afetado: Usuário TC
- Tipo de teste: Fluxo completo
- Camada: E2E
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Senha antiga inválida, nova senha válida e perfil preservado após recuperação.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, esqueci-senha, login, usuario-tc, e2e, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts; testes/ui/login/esqueci-senha/usuario-tc/recuperar-senha.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/usuario-tc/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para recuperação de senha do perfil Usuário TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar recuperação de senha do perfil Usuário TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Criar ou localizar usuário do perfil, solicitar recuperação, concluir a alteração com nova senha e tentar login com senha antiga e senha nova.

Resultado esperado:
Senha antiga deve falhar, senha nova deve autenticar e `/api/me` deve retornar e-mail, perfil e escopo originais.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar print da solicitação, e-mail/outbox de recuperação, retorno de login antigo, login novo e `/api/me`.

Resultado esperado:
O perfil Usuário TC recupera acesso sem perder vínculo ou permissões.

### QC-REG-LS-026 - E-mail de recuperação para Usuário TC deve orientar redefinição sem expor dados indevidos

- Suite Qase: Regressão > Login > Esqueci Senha
- Objetivo: Validar o conteúdo do e-mail de recuperação enviado para Usuário TC.
- Descrição detalhada: O e-mail deve chegar ao destinatário correto, conter orientação clara, link ou token válido e não expor senha ou dados sensíveis indevidos.
- Regra de negócio validada: Comunicação de recuperação deve ser segura, rastreável e coerente com o perfil solicitado.
- Perfil executor: QA
- Perfil afetado: Usuário TC
- Tipo de teste: Integração
- Camada: Misto
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail correto para o perfil, com link funcional e sem dados sensíveis indevidos.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, esqueci-senha, login, usuario-tc, email, api, automacao-existente
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts; testes/ui/login/esqueci-senha/usuario-tc/recuperar-senha.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/usuario-tc/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para e-mail de recuperação para Usuário TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar e-mail de recuperação para Usuário TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Solicitar recuperação para usuário válido, localizar e-mail no outbox ou provedor real e abrir o link/botão de redefinição.

Resultado esperado:
Destinatário, assunto, identificação, instrução, validade do link e ausência de dados sensíveis devem estar corretos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Salvar print ou HTML do e-mail, link mascarado quando necessário e resultado da validação do token.

Resultado esperado:
E-mail permite seguir o fluxo de redefinição com segurança.

### QC-REG-LS-027 - Líder TC deve recuperar senha, invalidar senha antiga e preservar permissões

- Suite Qase: Regressão > Login > Esqueci Senha
- Objetivo: Validar o fluxo completo de recuperação de senha para Líder TC.
- Descrição detalhada: O caso cobre solicitação, aprovação/redefinição, tentativa de login com senha antiga, login com nova senha e preservação do perfil Líder TC.
- Regra de negócio validada: Recuperação de senha não pode alterar perfil, vínculo de empresa ou permissões do usuário.
- Perfil executor: Usuário público / QA
- Perfil afetado: Líder TC
- Tipo de teste: Fluxo completo
- Camada: E2E
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Senha antiga inválida, nova senha válida e perfil preservado após recuperação.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, esqueci-senha, login, lider-tc, e2e, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts; testes/ui/login/esqueci-senha/lider-tc/recuperar-senha.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/lider-tc/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para recuperação de senha do perfil Líder TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar recuperação de senha do perfil Líder TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Criar ou localizar usuário do perfil, solicitar recuperação, concluir a alteração com nova senha e tentar login com senha antiga e senha nova.

Resultado esperado:
Senha antiga deve falhar, senha nova deve autenticar e `/api/me` deve retornar e-mail, perfil e escopo originais.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar print da solicitação, e-mail/outbox de recuperação, retorno de login antigo, login novo e `/api/me`.

Resultado esperado:
O perfil Líder TC recupera acesso sem perder vínculo ou permissões.

### QC-REG-LS-028 - E-mail de recuperação para Líder TC deve orientar redefinição sem expor dados indevidos

- Suite Qase: Regressão > Login > Esqueci Senha
- Objetivo: Validar o conteúdo do e-mail de recuperação enviado para Líder TC.
- Descrição detalhada: O e-mail deve chegar ao destinatário correto, conter orientação clara, link ou token válido e não expor senha ou dados sensíveis indevidos.
- Regra de negócio validada: Comunicação de recuperação deve ser segura, rastreável e coerente com o perfil solicitado.
- Perfil executor: QA
- Perfil afetado: Líder TC
- Tipo de teste: Integração
- Camada: Misto
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail correto para o perfil, com link funcional e sem dados sensíveis indevidos.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, esqueci-senha, login, lider-tc, email, api, automacao-existente
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts; testes/ui/login/esqueci-senha/lider-tc/recuperar-senha.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/lider-tc/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para e-mail de recuperação para Líder TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar e-mail de recuperação para Líder TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Solicitar recuperação para usuário válido, localizar e-mail no outbox ou provedor real e abrir o link/botão de redefinição.

Resultado esperado:
Destinatário, assunto, identificação, instrução, validade do link e ausência de dados sensíveis devem estar corretos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Salvar print ou HTML do e-mail, link mascarado quando necessário e resultado da validação do token.

Resultado esperado:
E-mail permite seguir o fluxo de redefinição com segurança.

### QC-REG-LS-029 - Suporte Técnico deve recuperar senha, invalidar senha antiga e preservar permissões

- Suite Qase: Regressão > Login > Esqueci Senha
- Objetivo: Validar o fluxo completo de recuperação de senha para Suporte Técnico.
- Descrição detalhada: O caso cobre solicitação, aprovação/redefinição, tentativa de login com senha antiga, login com nova senha e preservação do perfil Suporte Técnico.
- Regra de negócio validada: Recuperação de senha não pode alterar perfil, vínculo de empresa ou permissões do usuário.
- Perfil executor: Usuário público / QA
- Perfil afetado: Suporte Técnico
- Tipo de teste: Fluxo completo
- Camada: E2E
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Senha antiga inválida, nova senha válida e perfil preservado após recuperação.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, esqueci-senha, login, suporte-tecnico, e2e, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts; testes/ui/login/esqueci-senha/suporte-tecnico/recuperar-senha.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/suporte-tecnico/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para recuperação de senha do perfil Suporte Técnico, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar recuperação de senha do perfil Suporte Técnico, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Criar ou localizar usuário do perfil, solicitar recuperação, concluir a alteração com nova senha e tentar login com senha antiga e senha nova.

Resultado esperado:
Senha antiga deve falhar, senha nova deve autenticar e `/api/me` deve retornar e-mail, perfil e escopo originais.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar print da solicitação, e-mail/outbox de recuperação, retorno de login antigo, login novo e `/api/me`.

Resultado esperado:
O perfil Suporte Técnico recupera acesso sem perder vínculo ou permissões.

### QC-REG-LS-030 - E-mail de recuperação para Suporte Técnico deve orientar redefinição sem expor dados indevidos

- Suite Qase: Regressão > Login > Esqueci Senha
- Objetivo: Validar o conteúdo do e-mail de recuperação enviado para Suporte Técnico.
- Descrição detalhada: O e-mail deve chegar ao destinatário correto, conter orientação clara, link ou token válido e não expor senha ou dados sensíveis indevidos.
- Regra de negócio validada: Comunicação de recuperação deve ser segura, rastreável e coerente com o perfil solicitado.
- Perfil executor: QA
- Perfil afetado: Suporte Técnico
- Tipo de teste: Integração
- Camada: Misto
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail correto para o perfil, com link funcional e sem dados sensíveis indevidos.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, ui, esqueci-senha, login, suporte-tecnico, email, api, automacao-existente
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts; testes/ui/login/esqueci-senha/suporte-tecnico/recuperar-senha.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/esqueci-senha/suporte-tecnico/recuperar-senha.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para e-mail de recuperação para Suporte Técnico, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar e-mail de recuperação para Suporte Técnico, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Solicitar recuperação para usuário válido, localizar e-mail no outbox ou provedor real e abrir o link/botão de redefinição.

Resultado esperado:
Destinatário, assunto, identificação, instrução, validade do link e ausência de dados sensíveis devem estar corretos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Salvar print ou HTML do e-mail, link mascarado quando necessário e resultado da validação do token.

Resultado esperado:
E-mail permite seguir o fluxo de redefinição com segurança.

### QC-REG-LS-031 - Tela pública de Solicitar Acesso deve abrir e adaptar campos conforme perfil

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar abertura do formulário público e exibição dinâmica de campos por perfil solicitado.
- Descrição detalhada: O formulário deve orientar o usuário público e exibir campos de empresa, usuário ou vínculo apenas quando a regra do perfil exigir.
- Regra de negócio validada: Perfis solicitáveis possuem campos específicos: Empresa exige dados da empresa; Usuário Empresa exige empresa vinculada; Suporte Técnico exige usuário/login.
- Perfil executor: Usuário público
- Perfil afetado: Todos os perfis solicitáveis
- Tipo de teste: Funcional
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Campos exibidos corretamente para Empresa, Usuário Empresa, Usuário TC, Líder TC e Suporte Técnico.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, ui, empresa, usuario-empresa, usuario-tc, lider-tc, suporte-tecnico
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para formulário público por perfil, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar formulário público por perfil, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Acessar `/login/access-request`, selecionar cada perfil solicitável e observar os campos exibidos.

Resultado esperado:
Campos obrigatórios e condicionais devem corresponder ao perfil selecionado.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Formulário preparado para criar solicitações válidas por perfil.

### QC-REG-LS-032 - Solicitar Acesso deve validar campos obrigatórios antes de criar solicitação

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Garantir que o formulário público não aceite envio incompleto.
- Descrição detalhada: Dados obrigatórios incompletos geram solicitações sem rastreabilidade suficiente e podem travar a análise interna.
- Regra de negócio validada: Campos obrigatórios do perfil selecionado devem ser preenchidos antes da criação.
- Perfil executor: Usuário público
- Perfil afetado: Todos os perfis solicitáveis
- Tipo de teste: Validação de campos
- Camada: Manual
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Envio incompleto bloqueado com orientação clara.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, validacao-campos, candidato-automacao
- Status de automação: Candidato à automação
- Arquivo automatizado relacionado: Não localizado
- Comando de execução:

```bash
Não aplicável
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para validação de obrigatórios em Solicitar Acesso, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar validação de obrigatórios em Solicitar Acesso, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Selecionar cada perfil, omitir campos obrigatórios e tentar enviar o formulário.

Resultado esperado:
A UI deve indicar os campos pendentes e a API não deve criar solicitação inválida.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Solicitações só são criadas com dados mínimos suficientes para análise.

### QC-REG-LS-033 - Solicitar Acesso deve rejeitar e-mail inválido com mensagem compreensível

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar formato do e-mail informado pelo usuário público.
- Descrição detalhada: E-mail inválido impede comunicação de status, consulta pública e envio de aceite, ajuste ou recusa.
- Regra de negócio validada: Solicitação depende de e-mail válido para acompanhamento.
- Perfil executor: Usuário público
- Perfil afetado: Todos os perfis solicitáveis
- Tipo de teste: Validação de campos
- Camada: Manual
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail inválido rejeitado antes da criação.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, validacao-campos, email, candidato-automacao
- Status de automação: Candidato à automação
- Arquivo automatizado relacionado: Não localizado
- Comando de execução:

```bash
Não aplicável
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para e-mail inválido em Solicitar Acesso, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar e-mail inválido em Solicitar Acesso, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Preencher formulário válido, trocar e-mail por formato inválido e tentar enviar.

Resultado esperado:
A aplicação deve bloquear envio ou retornar erro de validação sem criar solicitação.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Solicitação só segue com e-mail válido.

### QC-REG-LS-034 - Solicitar Acesso deve validar senha obrigatória e padrão de senha

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Garantir que senha cadastrada no fluxo público é obrigatória e compatível com login após aprovação.
- Descrição detalhada: A senha definida na solicitação será usada ou referenciada após aprovação; por isso deve ser segura e persistida corretamente.
- Regra de negócio validada: Senha obrigatória deve cumprir o padrão vigente para todos os perfis aplicáveis.
- Perfil executor: Usuário público
- Perfil afetado: Todos os perfis solicitáveis
- Tipo de teste: Validação de campos
- Camada: Manual
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Senha obrigatória e segura validada no fluxo público.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, validacao-campos, seguranca, candidato-automacao
- Status de automação: Candidato à automação
- Arquivo automatizado relacionado: Não localizado
- Comando de execução:

```bash
Não aplicável
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para senha em Solicitar Acesso, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar senha em Solicitar Acesso, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Enviar formulário sem senha, com senha fraca e com senha válida.

Resultado esperado:
Somente senha válida deve permitir criação da solicitação.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
A senha aprovada deve permitir login quando a solicitação for aceita.

### QC-REG-LS-035 - Solicitação duplicada deve ser bloqueada sem gerar novo e-mail

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar bloqueio de duplicidade para solicitação pública pendente.
- Descrição detalhada: Duplicidades poluem a fila de Solicitações e podem gerar múltiplos e-mails para o mesmo acompanhamento.
- Regra de negócio validada: Solicitação pendente equivalente não deve ser duplicada.
- Perfil executor: Usuário público
- Perfil afetado: Todos os perfis solicitáveis
- Tipo de teste: Regressão
- Camada: Misto
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Duplicidade bloqueada e outbox sem novo e-mail indevido.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, api, email, consulta, automacao-existente
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/solicitacoes-admin/email/captura-e-reenvio.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/email/captura-e-reenvio.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para bloqueio de solicitação duplicada, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar bloqueio de solicitação duplicada, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Criar uma solicitação válida e repetir o envio com a mesma massa enquanto ela ainda está pendente.

Resultado esperado:
A segunda tentativa deve ser tratada sem criar nova solicitação e sem gerar novo e-mail inicial.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
A fila mantém uma única solicitação rastreável para o usuário.

### QC-REG-LS-036 - Solicitação pública criada deve aparecer na tela interna de Solicitações

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar que a criação pública entra na fila administrativa para revisão.
- Descrição detalhada: Sem entrada na fila interna, Líder TC, Suporte Técnico ou Empresa não conseguem atuar na solicitação.
- Regra de negócio validada: Toda solicitação pública válida deve ficar disponível para perfil revisor autorizado.
- Perfil executor: Usuário público / Revisor
- Perfil afetado: Perfis revisores
- Tipo de teste: Integração
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Solicitação visível para revisão autorizada.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, api, solicitacoes, automacao-existente
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para entrada da solicitação na fila interna, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público e Revisor acessa a tela ou endpoint necessário para iniciar entrada da solicitação na fila interna, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Criar solicitação pública, autenticar revisor e listar `/api/admin/access-requests` ou abrir a tela interna.

Resultado esperado:
A solicitação deve aparecer com e-mail, perfil, status inicial e dados submetidos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Fila interna recebe a solicitação pronta para análise.

### QC-REG-LS-037 - Formulário público de Solicitar Acesso deve atender acessibilidade crítica

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar que o formulário público não possui violações graves de acessibilidade.
- Descrição detalhada: O usuário público precisa conseguir solicitar acesso sem depender de interação inacessível.
- Regra de negócio validada: Tela pública deve ser operável e compreensível.
- Perfil executor: QA
- Perfil afetado: Usuário público
- Tipo de teste: Acessibilidade
- Camada: UI
- Prioridade: Média
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Formulário público sem violações graves.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, acessibilidade, ui, automacao-existente
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/formulario-publico/acessibilidade/formulario.acessibilidade.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/acessibilidade/formulario.acessibilidade.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para acessibilidade de Solicitar Acesso, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar acessibilidade de Solicitar Acesso, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Abrir o formulário, executar auditoria de acessibilidade e validar rótulos/foco dos campos principais.

Resultado esperado:
Não devem existir violações graves no formulário público.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Tela apta para execução assistiva básica.

### QC-REG-LS-038 - Campos de Empresa devem validar CNPJ, CEP e vínculo quando o perfil exigir dados empresariais

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar comportamento de campos de empresa no fluxo público.
- Descrição detalhada: Empresa e Usuário Empresa dependem de dados ou vínculo empresarial corretos para preservar escopo após aprovação.
- Regra de negócio validada: Dados empresariais devem alimentar corretamente a solicitação e o vínculo posterior.
- Perfil executor: Usuário público
- Perfil afetado: Empresa / Usuário Empresa
- Tipo de teste: Integração
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Dados empresariais corretos no formulário, status e fila interna.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, empresa, usuario-empresa, consulta, automacao-existente
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para campos empresariais no formulário público, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar campos empresariais no formulário público, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Selecionar Empresa e Usuário Empresa, preencher CNPJ/CEP ou empresa cadastrada e submeter massa válida.

Resultado esperado:
Campos empresariais devem ser exibidos, preenchidos por lookup/mock e refletidos na solicitação.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Solicitação preserva empresa solicitada ou empresa vinculada.

### QC-REG-LS-039 - Usuário público deve solicitar acesso como Empresa, receber e-mail inicial e acompanhar status

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar criação pública da solicitação para Empresa com e-mail de recebimento e consulta inicial.
- Descrição detalhada: O fluxo completo inicial garante que Empresa entra na fila, recebe orientação e consegue acompanhar a solicitação sem login.
- Regra de negócio validada: Solicitação pública válida nasce como aguardando análise e deve possuir chave de acompanhamento.
- Perfil executor: Usuário público
- Perfil afetado: Empresa
- Tipo de teste: Fluxo completo
- Camada: E2E
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Solicitação criada, e-mail enviado, consulta pública aberta e fila interna atualizada.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, empresa, email, consulta, e2e, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para solicitação pública para Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar solicitação pública para Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Preencher o formulário do perfil, enviar, capturar e-mail de recebimento e abrir a consulta pública pela chave/link.

Resultado esperado:
Status inicial deve ser Aguardando análise, e-mail deve conter dados do solicitante/perfil e a fila interna deve listar a solicitação.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar print do formulário, mensagem de sucesso, e-mail inicial, consulta pública e fila interna.

Resultado esperado:
Empresa possui solicitação rastreável e pronta para revisão.

### QC-REG-LS-040 - E-mail de solicitação recebida para Empresa deve conter dados e link de consulta

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar e-mail inicial enviado ao solicitar acesso como Empresa.
- Descrição detalhada: O e-mail inicial é a principal referência do usuário público para acompanhar a solicitação.
- Regra de negócio validada: E-mail de recebimento deve informar perfil solicitado, solicitante, status inicial e caminho de consulta.
- Perfil executor: QA
- Perfil afetado: Empresa
- Tipo de teste: Integração
- Camada: API
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail inicial completo, sem dados sensíveis indevidos, e consulta funcional.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, empresa, email, api, consulta
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para e-mail inicial de Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar e-mail inicial de Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Criar solicitação do perfil, localizar o e-mail inicial no outbox e abrir o link/botão de consulta.

Resultado esperado:
Destinatário, assunto, perfil, nome, empresa quando aplicável, link e status inicial devem estar corretos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Salvar HTML/texto do e-mail, link de consulta e print da consulta inicial.

Resultado esperado:
Usuário consegue acompanhar a solicitação pelo e-mail recebido.

### QC-REG-LS-041 - Consulta pública inicial de Empresa deve exibir status aguardando análise e dados essenciais

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar tela pública de acompanhamento após solicitação de Empresa.
- Descrição detalhada: A consulta pública precisa informar o estado atual sem expor dados além do necessário.
- Regra de negócio validada: Solicitação recém-criada deve aparecer como aguardando análise ou em análise.
- Perfil executor: Usuário público
- Perfil afetado: Empresa
- Tipo de teste: Funcional
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Status inicial e dados mínimos exibidos corretamente.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, empresa, consulta, ui, automacao-existente
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para consulta inicial para Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar consulta inicial para Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Abrir a consulta pública pelo link do e-mail ou pela chave recebida.

Resultado esperado:
A tela deve mostrar status inicial, e-mail do solicitante, perfil solicitado e data de criação/atualização.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Consulta pública confirma o acompanhamento da solicitação.

### QC-REG-LS-042 - E-mail de aceite para Empresa deve liberar login e preservar permissões

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar e-mail de aprovação e login após aceite de Empresa.
- Descrição detalhada: A aprovação deve comunicar o usuário e permitir entrada no sistema com o perfil aprovado.
- Regra de negócio validada: Acesso aprovado cria usuário/login com perfil e escopo corretos.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Empresa
- Tipo de teste: Integração
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail de aprovação correto e login funcional após aceite.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, empresa, aprovacao, email, login, automacao-existente
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para aprovação de Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor autorizado acessa a tela ou endpoint necessário para iniciar aprovação de Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Aprovar a solicitação do perfil, capturar o e-mail de aceite e realizar login com as credenciais liberadas.

Resultado esperado:
E-mail deve conter mensagem de aprovação, instrução de acesso e o login deve retornar usuário/perfil corretos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar e-mail de aceite, status aprovado, resposta de login e `/api/me`.

Resultado esperado:
Empresa aprovado consegue autenticar com permissões corretas.

### QC-REG-LS-043 - E-mail de alteração para Empresa deve orientar correção e devolver solicitação para análise

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar pedido de alteração, e-mail de ajuste e correção do usuário para Empresa.
- Descrição detalhada: Quando o revisor solicita alteração, o usuário público precisa receber instruções, corrigir somente campos permitidos e devolver a solicitação.
- Regra de negócio validada: Ajustes devem registrar campos solicitados, comentário do revisor, correção e retorno para análise.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Empresa
- Tipo de teste: Fluxo completo
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail de ajuste correto, correção aplicada e solicitação devolvida para análise.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, empresa, ajuste, email, consulta, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para ajuste de solicitação para Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor autorizado e usuário público acessa a tela ou endpoint necessário para iniciar ajuste de solicitação para Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Solicitar alteração com campos/comentário, capturar e-mail de ajuste, abrir consulta pública, corrigir dados e reenviar.

Resultado esperado:
Status deve ir para ajuste necessário, campos solicitados devem aparecer, e após correção deve retornar para análise.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar e-mail de ajuste, consulta com campos de correção, payload de correção e status under_review.

Resultado esperado:
Solicitação corrigida fica disponível para nova avaliação.

### QC-REG-LS-044 - E-mail de recusa para Empresa deve informar justificativa e bloquear login

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar recusa/rejeição da solicitação de Empresa.
- Descrição detalhada: Recusa deve finalizar o fluxo de forma clara, preservar justificativa e impedir criação de acesso.
- Regra de negócio validada: Solicitação recusada/rejeitada não pode liberar login nem ser aprovada posteriormente sem nova regra explícita.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Empresa
- Tipo de teste: Segurança/Escopo
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Recusa comunicada e acesso bloqueado.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, empresa, recusa, email, seguranca, automacao-existente
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para recusa da solicitação de Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor autorizado acessa a tela ou endpoint necessário para iniciar recusa da solicitação de Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Recusar a solicitação com justificativa, capturar e-mail de recusa e tentar autenticar o solicitante.

Resultado esperado:
Status deve ser recusado/rejeitado, e-mail deve conter justificativa e login deve falhar.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar e-mail de recusa, status final, justificativa e tentativa de login bloqueada.

Resultado esperado:
Solicitação finalizada sem liberar acesso.

### QC-REG-LS-045 - Empresa deve passar por ajustes, conversa, aprovação final e login

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar fluxo robusto de múltiplos ajustes, conversa e aprovação para Empresa.
- Descrição detalhada: Esse caso cobre o caminho mais completo de colaboração entre revisor e solicitante antes da aprovação.
- Regra de negócio validada: Histórico de ajustes e comentários deve ser preservado até a aprovação.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Empresa
- Tipo de teste: Fluxo completo
- Camada: E2E
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Ajustes preservados, aprovação final concluída e login liberado.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, empresa, ajuste, comentario, aprovacao, login, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para fluxo completo com ajustes para Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor e usuário público acessa a tela ou endpoint necessário para iniciar fluxo completo com ajustes para Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Executar três rodadas de ajuste com comentários, corrigir cada rodada, aprovar ao final e validar login.

Resultado esperado:
Cada rodada deve atualizar status/campos/conversa, e a aprovação final deve liberar login do perfil correto.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar histórico de conversa, e-mails de ajuste, status de cada rodada, e-mail de aprovação e login final.

Resultado esperado:
Fluxo completo mantém histórico e libera acesso apenas após aprovação.

### QC-REG-LS-046 - Usuário público deve solicitar acesso como Usuário Empresa, receber e-mail inicial e acompanhar status

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar criação pública da solicitação para Usuário Empresa com e-mail de recebimento e consulta inicial.
- Descrição detalhada: O fluxo completo inicial garante que Usuário Empresa entra na fila, recebe orientação e consegue acompanhar a solicitação sem login.
- Regra de negócio validada: Solicitação pública válida nasce como aguardando análise e deve possuir chave de acompanhamento.
- Perfil executor: Usuário público
- Perfil afetado: Usuário Empresa
- Tipo de teste: Fluxo completo
- Camada: E2E
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Solicitação criada, e-mail enviado, consulta pública aberta e fila interna atualizada.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, usuario-empresa, email, consulta, e2e, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para solicitação pública para Usuário Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar solicitação pública para Usuário Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Preencher o formulário do perfil, enviar, capturar e-mail de recebimento e abrir a consulta pública pela chave/link.

Resultado esperado:
Status inicial deve ser Aguardando análise, e-mail deve conter dados do solicitante/perfil e a fila interna deve listar a solicitação.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar print do formulário, mensagem de sucesso, e-mail inicial, consulta pública e fila interna.

Resultado esperado:
Usuário Empresa possui solicitação rastreável e pronta para revisão.

### QC-REG-LS-047 - E-mail de solicitação recebida para Usuário Empresa deve conter dados e link de consulta

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar e-mail inicial enviado ao solicitar acesso como Usuário Empresa.
- Descrição detalhada: O e-mail inicial é a principal referência do usuário público para acompanhar a solicitação.
- Regra de negócio validada: E-mail de recebimento deve informar perfil solicitado, solicitante, status inicial e caminho de consulta.
- Perfil executor: QA
- Perfil afetado: Usuário Empresa
- Tipo de teste: Integração
- Camada: API
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail inicial completo, sem dados sensíveis indevidos, e consulta funcional.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, usuario-empresa, email, api, consulta
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para e-mail inicial de Usuário Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar e-mail inicial de Usuário Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Criar solicitação do perfil, localizar o e-mail inicial no outbox e abrir o link/botão de consulta.

Resultado esperado:
Destinatário, assunto, perfil, nome, empresa quando aplicável, link e status inicial devem estar corretos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Salvar HTML/texto do e-mail, link de consulta e print da consulta inicial.

Resultado esperado:
Usuário consegue acompanhar a solicitação pelo e-mail recebido.

### QC-REG-LS-048 - Consulta pública inicial de Usuário Empresa deve exibir status aguardando análise e dados essenciais

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar tela pública de acompanhamento após solicitação de Usuário Empresa.
- Descrição detalhada: A consulta pública precisa informar o estado atual sem expor dados além do necessário.
- Regra de negócio validada: Solicitação recém-criada deve aparecer como aguardando análise ou em análise.
- Perfil executor: Usuário público
- Perfil afetado: Usuário Empresa
- Tipo de teste: Funcional
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Status inicial e dados mínimos exibidos corretamente.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, usuario-empresa, consulta, ui, automacao-existente
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para consulta inicial para Usuário Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar consulta inicial para Usuário Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Abrir a consulta pública pelo link do e-mail ou pela chave recebida.

Resultado esperado:
A tela deve mostrar status inicial, e-mail do solicitante, perfil solicitado e data de criação/atualização.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Consulta pública confirma o acompanhamento da solicitação.

### QC-REG-LS-049 - E-mail de aceite para Usuário Empresa deve liberar login e preservar permissões

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar e-mail de aprovação e login após aceite de Usuário Empresa.
- Descrição detalhada: A aprovação deve comunicar o usuário e permitir entrada no sistema com o perfil aprovado.
- Regra de negócio validada: Acesso aprovado cria usuário/login com perfil e escopo corretos.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Usuário Empresa
- Tipo de teste: Integração
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail de aprovação correto e login funcional após aceite.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, usuario-empresa, aprovacao, email, login, automacao-existente
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para aprovação de Usuário Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor autorizado acessa a tela ou endpoint necessário para iniciar aprovação de Usuário Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Aprovar a solicitação do perfil, capturar o e-mail de aceite e realizar login com as credenciais liberadas.

Resultado esperado:
E-mail deve conter mensagem de aprovação, instrução de acesso e o login deve retornar usuário/perfil corretos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar e-mail de aceite, status aprovado, resposta de login e `/api/me`.

Resultado esperado:
Usuário Empresa aprovado consegue autenticar com permissões corretas.

### QC-REG-LS-050 - E-mail de alteração para Usuário Empresa deve orientar correção e devolver solicitação para análise

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar pedido de alteração, e-mail de ajuste e correção do usuário para Usuário Empresa.
- Descrição detalhada: Quando o revisor solicita alteração, o usuário público precisa receber instruções, corrigir somente campos permitidos e devolver a solicitação.
- Regra de negócio validada: Ajustes devem registrar campos solicitados, comentário do revisor, correção e retorno para análise.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Usuário Empresa
- Tipo de teste: Fluxo completo
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail de ajuste correto, correção aplicada e solicitação devolvida para análise.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, usuario-empresa, ajuste, email, consulta, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para ajuste de solicitação para Usuário Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor autorizado e usuário público acessa a tela ou endpoint necessário para iniciar ajuste de solicitação para Usuário Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Solicitar alteração com campos/comentário, capturar e-mail de ajuste, abrir consulta pública, corrigir dados e reenviar.

Resultado esperado:
Status deve ir para ajuste necessário, campos solicitados devem aparecer, e após correção deve retornar para análise.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar e-mail de ajuste, consulta com campos de correção, payload de correção e status under_review.

Resultado esperado:
Solicitação corrigida fica disponível para nova avaliação.

### QC-REG-LS-051 - E-mail de recusa para Usuário Empresa deve informar justificativa e bloquear login

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar recusa/rejeição da solicitação de Usuário Empresa.
- Descrição detalhada: Recusa deve finalizar o fluxo de forma clara, preservar justificativa e impedir criação de acesso.
- Regra de negócio validada: Solicitação recusada/rejeitada não pode liberar login nem ser aprovada posteriormente sem nova regra explícita.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Usuário Empresa
- Tipo de teste: Segurança/Escopo
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Recusa comunicada e acesso bloqueado.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, usuario-empresa, recusa, email, seguranca, automacao-existente
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para recusa da solicitação de Usuário Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor autorizado acessa a tela ou endpoint necessário para iniciar recusa da solicitação de Usuário Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Recusar a solicitação com justificativa, capturar e-mail de recusa e tentar autenticar o solicitante.

Resultado esperado:
Status deve ser recusado/rejeitado, e-mail deve conter justificativa e login deve falhar.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar e-mail de recusa, status final, justificativa e tentativa de login bloqueada.

Resultado esperado:
Solicitação finalizada sem liberar acesso.

### QC-REG-LS-052 - Usuário Empresa deve passar por ajustes, conversa, aprovação final e login

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar fluxo robusto de múltiplos ajustes, conversa e aprovação para Usuário Empresa.
- Descrição detalhada: Esse caso cobre o caminho mais completo de colaboração entre revisor e solicitante antes da aprovação.
- Regra de negócio validada: Histórico de ajustes e comentários deve ser preservado até a aprovação.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Usuário Empresa
- Tipo de teste: Fluxo completo
- Camada: E2E
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Ajustes preservados, aprovação final concluída e login liberado.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, usuario-empresa, ajuste, comentario, aprovacao, login, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para fluxo completo com ajustes para Usuário Empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor e usuário público acessa a tela ou endpoint necessário para iniciar fluxo completo com ajustes para Usuário Empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Executar três rodadas de ajuste com comentários, corrigir cada rodada, aprovar ao final e validar login.

Resultado esperado:
Cada rodada deve atualizar status/campos/conversa, e a aprovação final deve liberar login do perfil correto.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar histórico de conversa, e-mails de ajuste, status de cada rodada, e-mail de aprovação e login final.

Resultado esperado:
Fluxo completo mantém histórico e libera acesso apenas após aprovação.

### QC-REG-LS-053 - Usuário público deve solicitar acesso como Usuário TC, receber e-mail inicial e acompanhar status

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar criação pública da solicitação para Usuário TC com e-mail de recebimento e consulta inicial.
- Descrição detalhada: O fluxo completo inicial garante que Usuário TC entra na fila, recebe orientação e consegue acompanhar a solicitação sem login.
- Regra de negócio validada: Solicitação pública válida nasce como aguardando análise e deve possuir chave de acompanhamento.
- Perfil executor: Usuário público
- Perfil afetado: Usuário TC
- Tipo de teste: Fluxo completo
- Camada: E2E
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Solicitação criada, e-mail enviado, consulta pública aberta e fila interna atualizada.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, usuario-tc, email, consulta, e2e, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para solicitação pública para Usuário TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar solicitação pública para Usuário TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Preencher o formulário do perfil, enviar, capturar e-mail de recebimento e abrir a consulta pública pela chave/link.

Resultado esperado:
Status inicial deve ser Aguardando análise, e-mail deve conter dados do solicitante/perfil e a fila interna deve listar a solicitação.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar print do formulário, mensagem de sucesso, e-mail inicial, consulta pública e fila interna.

Resultado esperado:
Usuário TC possui solicitação rastreável e pronta para revisão.

### QC-REG-LS-054 - E-mail de solicitação recebida para Usuário TC deve conter dados e link de consulta

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar e-mail inicial enviado ao solicitar acesso como Usuário TC.
- Descrição detalhada: O e-mail inicial é a principal referência do usuário público para acompanhar a solicitação.
- Regra de negócio validada: E-mail de recebimento deve informar perfil solicitado, solicitante, status inicial e caminho de consulta.
- Perfil executor: QA
- Perfil afetado: Usuário TC
- Tipo de teste: Integração
- Camada: API
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail inicial completo, sem dados sensíveis indevidos, e consulta funcional.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, usuario-tc, email, api, consulta
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para e-mail inicial de Usuário TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar e-mail inicial de Usuário TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Criar solicitação do perfil, localizar o e-mail inicial no outbox e abrir o link/botão de consulta.

Resultado esperado:
Destinatário, assunto, perfil, nome, empresa quando aplicável, link e status inicial devem estar corretos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Salvar HTML/texto do e-mail, link de consulta e print da consulta inicial.

Resultado esperado:
Usuário consegue acompanhar a solicitação pelo e-mail recebido.

### QC-REG-LS-055 - Consulta pública inicial de Usuário TC deve exibir status aguardando análise e dados essenciais

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar tela pública de acompanhamento após solicitação de Usuário TC.
- Descrição detalhada: A consulta pública precisa informar o estado atual sem expor dados além do necessário.
- Regra de negócio validada: Solicitação recém-criada deve aparecer como aguardando análise ou em análise.
- Perfil executor: Usuário público
- Perfil afetado: Usuário TC
- Tipo de teste: Funcional
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Status inicial e dados mínimos exibidos corretamente.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, usuario-tc, consulta, ui, automacao-existente
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para consulta inicial para Usuário TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar consulta inicial para Usuário TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Abrir a consulta pública pelo link do e-mail ou pela chave recebida.

Resultado esperado:
A tela deve mostrar status inicial, e-mail do solicitante, perfil solicitado e data de criação/atualização.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Consulta pública confirma o acompanhamento da solicitação.

### QC-REG-LS-056 - E-mail de aceite para Usuário TC deve liberar login e preservar permissões

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar e-mail de aprovação e login após aceite de Usuário TC.
- Descrição detalhada: A aprovação deve comunicar o usuário e permitir entrada no sistema com o perfil aprovado.
- Regra de negócio validada: Acesso aprovado cria usuário/login com perfil e escopo corretos.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Usuário TC
- Tipo de teste: Integração
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail de aprovação correto e login funcional após aceite.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, usuario-tc, aprovacao, email, login, automacao-existente
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para aprovação de Usuário TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor autorizado acessa a tela ou endpoint necessário para iniciar aprovação de Usuário TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Aprovar a solicitação do perfil, capturar o e-mail de aceite e realizar login com as credenciais liberadas.

Resultado esperado:
E-mail deve conter mensagem de aprovação, instrução de acesso e o login deve retornar usuário/perfil corretos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar e-mail de aceite, status aprovado, resposta de login e `/api/me`.

Resultado esperado:
Usuário TC aprovado consegue autenticar com permissões corretas.

### QC-REG-LS-057 - E-mail de alteração para Usuário TC deve orientar correção e devolver solicitação para análise

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar pedido de alteração, e-mail de ajuste e correção do usuário para Usuário TC.
- Descrição detalhada: Quando o revisor solicita alteração, o usuário público precisa receber instruções, corrigir somente campos permitidos e devolver a solicitação.
- Regra de negócio validada: Ajustes devem registrar campos solicitados, comentário do revisor, correção e retorno para análise.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Usuário TC
- Tipo de teste: Fluxo completo
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail de ajuste correto, correção aplicada e solicitação devolvida para análise.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, usuario-tc, ajuste, email, consulta, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para ajuste de solicitação para Usuário TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor autorizado e usuário público acessa a tela ou endpoint necessário para iniciar ajuste de solicitação para Usuário TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Solicitar alteração com campos/comentário, capturar e-mail de ajuste, abrir consulta pública, corrigir dados e reenviar.

Resultado esperado:
Status deve ir para ajuste necessário, campos solicitados devem aparecer, e após correção deve retornar para análise.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar e-mail de ajuste, consulta com campos de correção, payload de correção e status under_review.

Resultado esperado:
Solicitação corrigida fica disponível para nova avaliação.

### QC-REG-LS-058 - E-mail de recusa para Usuário TC deve informar justificativa e bloquear login

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar recusa/rejeição da solicitação de Usuário TC.
- Descrição detalhada: Recusa deve finalizar o fluxo de forma clara, preservar justificativa e impedir criação de acesso.
- Regra de negócio validada: Solicitação recusada/rejeitada não pode liberar login nem ser aprovada posteriormente sem nova regra explícita.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Usuário TC
- Tipo de teste: Segurança/Escopo
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Recusa comunicada e acesso bloqueado.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, usuario-tc, recusa, email, seguranca, automacao-existente
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para recusa da solicitação de Usuário TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor autorizado acessa a tela ou endpoint necessário para iniciar recusa da solicitação de Usuário TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Recusar a solicitação com justificativa, capturar e-mail de recusa e tentar autenticar o solicitante.

Resultado esperado:
Status deve ser recusado/rejeitado, e-mail deve conter justificativa e login deve falhar.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar e-mail de recusa, status final, justificativa e tentativa de login bloqueada.

Resultado esperado:
Solicitação finalizada sem liberar acesso.

### QC-REG-LS-059 - Usuário TC deve passar por ajustes, conversa, aprovação final e login

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar fluxo robusto de múltiplos ajustes, conversa e aprovação para Usuário TC.
- Descrição detalhada: Esse caso cobre o caminho mais completo de colaboração entre revisor e solicitante antes da aprovação.
- Regra de negócio validada: Histórico de ajustes e comentários deve ser preservado até a aprovação.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Usuário TC
- Tipo de teste: Fluxo completo
- Camada: E2E
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Ajustes preservados, aprovação final concluída e login liberado.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, usuario-tc, ajuste, comentario, aprovacao, login, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para fluxo completo com ajustes para Usuário TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor e usuário público acessa a tela ou endpoint necessário para iniciar fluxo completo com ajustes para Usuário TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Executar três rodadas de ajuste com comentários, corrigir cada rodada, aprovar ao final e validar login.

Resultado esperado:
Cada rodada deve atualizar status/campos/conversa, e a aprovação final deve liberar login do perfil correto.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar histórico de conversa, e-mails de ajuste, status de cada rodada, e-mail de aprovação e login final.

Resultado esperado:
Fluxo completo mantém histórico e libera acesso apenas após aprovação.

### QC-REG-LS-060 - Usuário público deve solicitar acesso como Líder TC, receber e-mail inicial e acompanhar status

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar criação pública da solicitação para Líder TC com e-mail de recebimento e consulta inicial.
- Descrição detalhada: O fluxo completo inicial garante que Líder TC entra na fila, recebe orientação e consegue acompanhar a solicitação sem login.
- Regra de negócio validada: Solicitação pública válida nasce como aguardando análise e deve possuir chave de acompanhamento.
- Perfil executor: Usuário público
- Perfil afetado: Líder TC
- Tipo de teste: Fluxo completo
- Camada: E2E
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Solicitação criada, e-mail enviado, consulta pública aberta e fila interna atualizada.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, lider-tc, email, consulta, e2e, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para solicitação pública para Líder TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar solicitação pública para Líder TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Preencher o formulário do perfil, enviar, capturar e-mail de recebimento e abrir a consulta pública pela chave/link.

Resultado esperado:
Status inicial deve ser Aguardando análise, e-mail deve conter dados do solicitante/perfil e a fila interna deve listar a solicitação.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar print do formulário, mensagem de sucesso, e-mail inicial, consulta pública e fila interna.

Resultado esperado:
Líder TC possui solicitação rastreável e pronta para revisão.

### QC-REG-LS-061 - E-mail de solicitação recebida para Líder TC deve conter dados e link de consulta

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar e-mail inicial enviado ao solicitar acesso como Líder TC.
- Descrição detalhada: O e-mail inicial é a principal referência do usuário público para acompanhar a solicitação.
- Regra de negócio validada: E-mail de recebimento deve informar perfil solicitado, solicitante, status inicial e caminho de consulta.
- Perfil executor: QA
- Perfil afetado: Líder TC
- Tipo de teste: Integração
- Camada: API
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail inicial completo, sem dados sensíveis indevidos, e consulta funcional.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, lider-tc, email, api, consulta
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para e-mail inicial de Líder TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar e-mail inicial de Líder TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Criar solicitação do perfil, localizar o e-mail inicial no outbox e abrir o link/botão de consulta.

Resultado esperado:
Destinatário, assunto, perfil, nome, empresa quando aplicável, link e status inicial devem estar corretos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Salvar HTML/texto do e-mail, link de consulta e print da consulta inicial.

Resultado esperado:
Usuário consegue acompanhar a solicitação pelo e-mail recebido.

### QC-REG-LS-062 - Consulta pública inicial de Líder TC deve exibir status aguardando análise e dados essenciais

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar tela pública de acompanhamento após solicitação de Líder TC.
- Descrição detalhada: A consulta pública precisa informar o estado atual sem expor dados além do necessário.
- Regra de negócio validada: Solicitação recém-criada deve aparecer como aguardando análise ou em análise.
- Perfil executor: Usuário público
- Perfil afetado: Líder TC
- Tipo de teste: Funcional
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Status inicial e dados mínimos exibidos corretamente.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, lider-tc, consulta, ui, automacao-existente
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para consulta inicial para Líder TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar consulta inicial para Líder TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Abrir a consulta pública pelo link do e-mail ou pela chave recebida.

Resultado esperado:
A tela deve mostrar status inicial, e-mail do solicitante, perfil solicitado e data de criação/atualização.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Consulta pública confirma o acompanhamento da solicitação.

### QC-REG-LS-063 - E-mail de aceite para Líder TC deve liberar login e preservar permissões

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar e-mail de aprovação e login após aceite de Líder TC.
- Descrição detalhada: A aprovação deve comunicar o usuário e permitir entrada no sistema com o perfil aprovado.
- Regra de negócio validada: Acesso aprovado cria usuário/login com perfil e escopo corretos.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Líder TC
- Tipo de teste: Integração
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail de aprovação correto e login funcional após aceite.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, lider-tc, aprovacao, email, login, automacao-existente
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para aprovação de Líder TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor autorizado acessa a tela ou endpoint necessário para iniciar aprovação de Líder TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Aprovar a solicitação do perfil, capturar o e-mail de aceite e realizar login com as credenciais liberadas.

Resultado esperado:
E-mail deve conter mensagem de aprovação, instrução de acesso e o login deve retornar usuário/perfil corretos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar e-mail de aceite, status aprovado, resposta de login e `/api/me`.

Resultado esperado:
Líder TC aprovado consegue autenticar com permissões corretas.

### QC-REG-LS-064 - E-mail de alteração para Líder TC deve orientar correção e devolver solicitação para análise

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar pedido de alteração, e-mail de ajuste e correção do usuário para Líder TC.
- Descrição detalhada: Quando o revisor solicita alteração, o usuário público precisa receber instruções, corrigir somente campos permitidos e devolver a solicitação.
- Regra de negócio validada: Ajustes devem registrar campos solicitados, comentário do revisor, correção e retorno para análise.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Líder TC
- Tipo de teste: Fluxo completo
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail de ajuste correto, correção aplicada e solicitação devolvida para análise.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, lider-tc, ajuste, email, consulta, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para ajuste de solicitação para Líder TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor autorizado e usuário público acessa a tela ou endpoint necessário para iniciar ajuste de solicitação para Líder TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Solicitar alteração com campos/comentário, capturar e-mail de ajuste, abrir consulta pública, corrigir dados e reenviar.

Resultado esperado:
Status deve ir para ajuste necessário, campos solicitados devem aparecer, e após correção deve retornar para análise.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar e-mail de ajuste, consulta com campos de correção, payload de correção e status under_review.

Resultado esperado:
Solicitação corrigida fica disponível para nova avaliação.

### QC-REG-LS-065 - E-mail de recusa para Líder TC deve informar justificativa e bloquear login

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar recusa/rejeição da solicitação de Líder TC.
- Descrição detalhada: Recusa deve finalizar o fluxo de forma clara, preservar justificativa e impedir criação de acesso.
- Regra de negócio validada: Solicitação recusada/rejeitada não pode liberar login nem ser aprovada posteriormente sem nova regra explícita.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Líder TC
- Tipo de teste: Segurança/Escopo
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Recusa comunicada e acesso bloqueado.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, lider-tc, recusa, email, seguranca, automacao-existente
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para recusa da solicitação de Líder TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor autorizado acessa a tela ou endpoint necessário para iniciar recusa da solicitação de Líder TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Recusar a solicitação com justificativa, capturar e-mail de recusa e tentar autenticar o solicitante.

Resultado esperado:
Status deve ser recusado/rejeitado, e-mail deve conter justificativa e login deve falhar.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar e-mail de recusa, status final, justificativa e tentativa de login bloqueada.

Resultado esperado:
Solicitação finalizada sem liberar acesso.

### QC-REG-LS-066 - Líder TC deve passar por ajustes, conversa, aprovação final e login

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar fluxo robusto de múltiplos ajustes, conversa e aprovação para Líder TC.
- Descrição detalhada: Esse caso cobre o caminho mais completo de colaboração entre revisor e solicitante antes da aprovação.
- Regra de negócio validada: Histórico de ajustes e comentários deve ser preservado até a aprovação.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Líder TC
- Tipo de teste: Fluxo completo
- Camada: E2E
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Ajustes preservados, aprovação final concluída e login liberado.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, lider-tc, ajuste, comentario, aprovacao, login, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para fluxo completo com ajustes para Líder TC, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor e usuário público acessa a tela ou endpoint necessário para iniciar fluxo completo com ajustes para Líder TC, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Executar três rodadas de ajuste com comentários, corrigir cada rodada, aprovar ao final e validar login.

Resultado esperado:
Cada rodada deve atualizar status/campos/conversa, e a aprovação final deve liberar login do perfil correto.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar histórico de conversa, e-mails de ajuste, status de cada rodada, e-mail de aprovação e login final.

Resultado esperado:
Fluxo completo mantém histórico e libera acesso apenas após aprovação.

### QC-REG-LS-067 - Usuário público deve solicitar acesso como Suporte Técnico, receber e-mail inicial e acompanhar status

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar criação pública da solicitação para Suporte Técnico com e-mail de recebimento e consulta inicial.
- Descrição detalhada: O fluxo completo inicial garante que Suporte Técnico entra na fila, recebe orientação e consegue acompanhar a solicitação sem login.
- Regra de negócio validada: Solicitação pública válida nasce como aguardando análise e deve possuir chave de acompanhamento.
- Perfil executor: Usuário público
- Perfil afetado: Suporte Técnico
- Tipo de teste: Fluxo completo
- Camada: E2E
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Solicitação criada, e-mail enviado, consulta pública aberta e fila interna atualizada.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, suporte-tecnico, email, consulta, e2e, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para solicitação pública para Suporte Técnico, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar solicitação pública para Suporte Técnico, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Preencher o formulário do perfil, enviar, capturar e-mail de recebimento e abrir a consulta pública pela chave/link.

Resultado esperado:
Status inicial deve ser Aguardando análise, e-mail deve conter dados do solicitante/perfil e a fila interna deve listar a solicitação.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar print do formulário, mensagem de sucesso, e-mail inicial, consulta pública e fila interna.

Resultado esperado:
Suporte Técnico possui solicitação rastreável e pronta para revisão.

### QC-REG-LS-068 - E-mail de solicitação recebida para Suporte Técnico deve conter dados e link de consulta

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar e-mail inicial enviado ao solicitar acesso como Suporte Técnico.
- Descrição detalhada: O e-mail inicial é a principal referência do usuário público para acompanhar a solicitação.
- Regra de negócio validada: E-mail de recebimento deve informar perfil solicitado, solicitante, status inicial e caminho de consulta.
- Perfil executor: QA
- Perfil afetado: Suporte Técnico
- Tipo de teste: Integração
- Camada: API
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail inicial completo, sem dados sensíveis indevidos, e consulta funcional.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, suporte-tecnico, email, api, consulta
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para e-mail inicial de Suporte Técnico, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar e-mail inicial de Suporte Técnico, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Criar solicitação do perfil, localizar o e-mail inicial no outbox e abrir o link/botão de consulta.

Resultado esperado:
Destinatário, assunto, perfil, nome, empresa quando aplicável, link e status inicial devem estar corretos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Salvar HTML/texto do e-mail, link de consulta e print da consulta inicial.

Resultado esperado:
Usuário consegue acompanhar a solicitação pelo e-mail recebido.

### QC-REG-LS-069 - Consulta pública inicial de Suporte Técnico deve exibir status aguardando análise e dados essenciais

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar tela pública de acompanhamento após solicitação de Suporte Técnico.
- Descrição detalhada: A consulta pública precisa informar o estado atual sem expor dados além do necessário.
- Regra de negócio validada: Solicitação recém-criada deve aparecer como aguardando análise ou em análise.
- Perfil executor: Usuário público
- Perfil afetado: Suporte Técnico
- Tipo de teste: Funcional
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Status inicial e dados mínimos exibidos corretamente.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, suporte-tecnico, consulta, ui, automacao-existente
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para consulta inicial para Suporte Técnico, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Usuário público acessa a tela ou endpoint necessário para iniciar consulta inicial para Suporte Técnico, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Abrir a consulta pública pelo link do e-mail ou pela chave recebida.

Resultado esperado:
A tela deve mostrar status inicial, e-mail do solicitante, perfil solicitado e data de criação/atualização.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Consulta pública confirma o acompanhamento da solicitação.

### QC-REG-LS-070 - E-mail de aceite para Suporte Técnico deve liberar login e preservar permissões

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar e-mail de aprovação e login após aceite de Suporte Técnico.
- Descrição detalhada: A aprovação deve comunicar o usuário e permitir entrada no sistema com o perfil aprovado.
- Regra de negócio validada: Acesso aprovado cria usuário/login com perfil e escopo corretos.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Suporte Técnico
- Tipo de teste: Integração
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail de aprovação correto e login funcional após aceite.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, suporte-tecnico, aprovacao, email, login, automacao-existente
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts; testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/formulario-publico/perfis/criar-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para aprovação de Suporte Técnico, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor autorizado acessa a tela ou endpoint necessário para iniciar aprovação de Suporte Técnico, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Aprovar a solicitação do perfil, capturar o e-mail de aceite e realizar login com as credenciais liberadas.

Resultado esperado:
E-mail deve conter mensagem de aprovação, instrução de acesso e o login deve retornar usuário/perfil corretos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar e-mail de aceite, status aprovado, resposta de login e `/api/me`.

Resultado esperado:
Suporte Técnico aprovado consegue autenticar com permissões corretas.

### QC-REG-LS-071 - E-mail de alteração para Suporte Técnico deve orientar correção e devolver solicitação para análise

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar pedido de alteração, e-mail de ajuste e correção do usuário para Suporte Técnico.
- Descrição detalhada: Quando o revisor solicita alteração, o usuário público precisa receber instruções, corrigir somente campos permitidos e devolver a solicitação.
- Regra de negócio validada: Ajustes devem registrar campos solicitados, comentário do revisor, correção e retorno para análise.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Suporte Técnico
- Tipo de teste: Fluxo completo
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: E-mail de ajuste correto, correção aplicada e solicitação devolvida para análise.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, suporte-tecnico, ajuste, email, consulta, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para ajuste de solicitação para Suporte Técnico, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor autorizado e usuário público acessa a tela ou endpoint necessário para iniciar ajuste de solicitação para Suporte Técnico, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Solicitar alteração com campos/comentário, capturar e-mail de ajuste, abrir consulta pública, corrigir dados e reenviar.

Resultado esperado:
Status deve ir para ajuste necessário, campos solicitados devem aparecer, e após correção deve retornar para análise.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar e-mail de ajuste, consulta com campos de correção, payload de correção e status under_review.

Resultado esperado:
Solicitação corrigida fica disponível para nova avaliação.

### QC-REG-LS-072 - E-mail de recusa para Suporte Técnico deve informar justificativa e bloquear login

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar recusa/rejeição da solicitação de Suporte Técnico.
- Descrição detalhada: Recusa deve finalizar o fluxo de forma clara, preservar justificativa e impedir criação de acesso.
- Regra de negócio validada: Solicitação recusada/rejeitada não pode liberar login nem ser aprovada posteriormente sem nova regra explícita.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Suporte Técnico
- Tipo de teste: Segurança/Escopo
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Recusa comunicada e acesso bloqueado.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, suporte-tecnico, recusa, email, seguranca, automacao-existente
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para recusa da solicitação de Suporte Técnico, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor autorizado acessa a tela ou endpoint necessário para iniciar recusa da solicitação de Suporte Técnico, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Recusar a solicitação com justificativa, capturar e-mail de recusa e tentar autenticar o solicitante.

Resultado esperado:
Status deve ser recusado/rejeitado, e-mail deve conter justificativa e login deve falhar.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar e-mail de recusa, status final, justificativa e tentativa de login bloqueada.

Resultado esperado:
Solicitação finalizada sem liberar acesso.

### QC-REG-LS-073 - Suporte Técnico deve passar por ajustes, conversa, aprovação final e login

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público
- Objetivo: Validar fluxo robusto de múltiplos ajustes, conversa e aprovação para Suporte Técnico.
- Descrição detalhada: Esse caso cobre o caminho mais completo de colaboração entre revisor e solicitante antes da aprovação.
- Regra de negócio validada: Histórico de ajustes e comentários deve ser preservado até a aprovação.
- Perfil executor: Revisor autorizado / Usuário público
- Perfil afetado: Suporte Técnico
- Tipo de teste: Fluxo completo
- Camada: E2E
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Ajustes preservados, aprovação final concluída e login liberado.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, suporte-tecnico, ajuste, comentario, aprovacao, login, automacao-existente
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para fluxo completo com ajustes para Suporte Técnico, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Revisor e usuário público acessa a tela ou endpoint necessário para iniciar fluxo completo com ajustes para Suporte Técnico, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Executar três rodadas de ajuste com comentários, corrigir cada rodada, aprovar ao final e validar login.

Resultado esperado:
Cada rodada deve atualizar status/campos/conversa, e a aprovação final deve liberar login do perfil correto.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Coletar histórico de conversa, e-mails de ajuste, status de cada rodada, e-mail de aprovação e login final.

Resultado esperado:
Fluxo completo mantém histórico e libera acesso apenas após aprovação.

### QC-REG-LS-074 - Consulta pública pelo link recebido no e-mail deve abrir a solicitação correta

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público > Consulta Pública
- Objetivo: Validar que o link/botão do e-mail leva à consulta da solicitação correspondente.
- Descrição detalhada: Validar que o link/botão do e-mail leva à consulta da solicitação correspondente. Esse caso garante que o acompanhamento público seja útil para o usuário e seguro para a aplicação.
- Regra de negócio validada: Acompanhamento público depende de accessKey válido enviado por e-mail.
- Perfil executor: Usuário público / QA
- Perfil afetado: Solicitação pública
- Tipo de teste: Funcional
- Camada: API
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: A tela/API deve retornar a solicitação associada à chave, sem misturar dados de outro solicitante.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, consulta, email, access-key
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts; testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Consulta pública pelo link recebido no e-mail deve abrir a solicitação correta, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar Consulta pública pelo link recebido no e-mail deve abrir a solicitação correta, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Abrir o link de consulta capturado no e-mail inicial ou de ajuste.

Resultado esperado:
A tela/API deve retornar a solicitação associada à chave, sem misturar dados de outro solicitante.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Consulta pública apresenta o estado correto e preserva segurança dos dados.

### QC-REG-LS-075 - Consulta manual por e-mail e token deve retornar status sem expor chave em resposta pública

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público > Consulta Pública
- Objetivo: Validar consulta manual quando disponível na tela pública.
- Descrição detalhada: Validar consulta manual quando disponível na tela pública. Esse caso garante que o acompanhamento público seja útil para o usuário e seguro para a aplicação.
- Regra de negócio validada: Consulta manual deve funcionar de modo neutro e não expor a chave diretamente.
- Perfil executor: Usuário público / QA
- Perfil afetado: Solicitação pública
- Tipo de teste: Funcional
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: O resultado deve exibir a solicitação correta e manter informações sensíveis protegidas.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, consulta, ui, email
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Consulta manual por e-mail e token deve retornar status sem expor chave em resposta pública, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar Consulta manual por e-mail e token deve retornar status sem expor chave em resposta pública, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Informar e-mail e token/chave no formulário de consulta manual.

Resultado esperado:
O resultado deve exibir a solicitação correta e manter informações sensíveis protegidas.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Consulta pública apresenta o estado correto e preserva segurança dos dados.

### QC-REG-LS-076 - Consulta com status aguardando análise deve exibir datas e mensagem de acompanhamento

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público > Consulta Pública
- Objetivo: Validar estado inicial da consulta após criação da solicitação.
- Descrição detalhada: Validar estado inicial da consulta após criação da solicitação. Esse caso garante que o acompanhamento público seja útil para o usuário e seguro para a aplicação.
- Regra de negócio validada: Solicitação recém-criada inicia aguardando análise ou em análise.
- Perfil executor: Usuário público / QA
- Perfil afetado: Solicitação pública
- Tipo de teste: Funcional
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Status, createdAt, updatedAt, e-mail e mensagem de acompanhamento devem ser exibidos.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, consulta, ui, api
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts; testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Consulta com status aguardando análise deve exibir datas e mensagem de acompanhamento, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar Consulta com status aguardando análise deve exibir datas e mensagem de acompanhamento, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Criar solicitação e abrir consulta pública antes de qualquer ação do revisor.

Resultado esperado:
Status, createdAt, updatedAt, e-mail e mensagem de acompanhamento devem ser exibidos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Consulta pública apresenta o estado correto e preserva segurança dos dados.

### QC-REG-LS-077 - Consulta após solicitação de alteração deve exibir campos e comentários de correção

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público > Consulta Pública
- Objetivo: Validar orientação ao solicitante quando revisor pede ajuste.
- Descrição detalhada: Validar orientação ao solicitante quando revisor pede ajuste. Esse caso garante que o acompanhamento público seja útil para o usuário e seguro para a aplicação.
- Regra de negócio validada: Somente campos solicitados devem ficar disponíveis para correção.
- Perfil executor: Usuário público / QA
- Perfil afetado: Solicitação pública
- Tipo de teste: Funcional
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: A tela deve mostrar status de ajuste, campos solicitados e comentário/orientação do revisor.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, consulta, ajuste, comentario
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Consulta após solicitação de alteração deve exibir campos e comentários de correção, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar Consulta após solicitação de alteração deve exibir campos e comentários de correção, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Solicitar ajuste administrativo e abrir consulta pública com a chave da solicitação.

Resultado esperado:
A tela deve mostrar status de ajuste, campos solicitados e comentário/orientação do revisor.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Consulta pública apresenta o estado correto e preserva segurança dos dados.

### QC-REG-LS-078 - Consulta após correção enviada deve retornar solicitação para análise

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público > Consulta Pública
- Objetivo: Validar transição de ajuste necessário para em análise após correção.
- Descrição detalhada: Validar transição de ajuste necessário para em análise após correção. Esse caso garante que o acompanhamento público seja útil para o usuário e seguro para a aplicação.
- Regra de negócio validada: Correção do solicitante devolve a solicitação para o revisor.
- Perfil executor: Usuário público / QA
- Perfil afetado: Solicitação pública
- Tipo de teste: Funcional
- Camada: API
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Status deve ser under_review e histórico/diff deve registrar os campos corrigidos.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, consulta, ajuste, api
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Consulta após correção enviada deve retornar solicitação para análise, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar Consulta após correção enviada deve retornar solicitação para análise, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Enviar correção pública para campos solicitados e consultar novamente a chave.

Resultado esperado:
Status deve ser under_review e histórico/diff deve registrar os campos corrigidos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Consulta pública apresenta o estado correto e preserva segurança dos dados.

### QC-REG-LS-079 - Consulta após aprovação deve exibir status aprovado e orientação de acesso

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público > Consulta Pública
- Objetivo: Validar feedback público depois do aceite da solicitação.
- Descrição detalhada: Validar feedback público depois do aceite da solicitação. Esse caso garante que o acompanhamento público seja útil para o usuário e seguro para a aplicação.
- Regra de negócio validada: Aprovação deve refletir na consulta pública.
- Perfil executor: Usuário público / QA
- Perfil afetado: Solicitação pública
- Tipo de teste: Funcional
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Status aprovado e mensagem de acesso aprovado devem ser exibidos.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, consulta, aprovacao, ui
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts; testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Consulta após aprovação deve exibir status aprovado e orientação de acesso, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar Consulta após aprovação deve exibir status aprovado e orientação de acesso, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Aprovar solicitação e abrir consulta pública.

Resultado esperado:
Status aprovado e mensagem de acesso aprovado devem ser exibidos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Consulta pública apresenta o estado correto e preserva segurança dos dados.

### QC-REG-LS-080 - Consulta após recusa ou rejeição deve exibir status final e justificativa

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público > Consulta Pública
- Objetivo: Validar feedback público depois de recusa/rejeição.
- Descrição detalhada: Validar feedback público depois de recusa/rejeição. Esse caso garante que o acompanhamento público seja útil para o usuário e seguro para a aplicação.
- Regra de negócio validada: Recusa final deve apresentar justificativa sem liberar ações indevidas.
- Perfil executor: Usuário público / QA
- Perfil afetado: Solicitação pública
- Tipo de teste: Funcional
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Status recusado/rejeitado e justificativa devem aparecer, sem permitir login.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, consulta, recusa, rejeicao, ui
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts; testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Consulta após recusa ou rejeição deve exibir status final e justificativa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar Consulta após recusa ou rejeição deve exibir status final e justificativa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Recusar solicitação com motivo e abrir consulta pública.

Resultado esperado:
Status recusado/rejeitado e justificativa devem aparecer, sem permitir login.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Consulta pública apresenta o estado correto e preserva segurança dos dados.

### QC-REG-LS-081 - Consulta com link ou chave inválida não deve expor erro interno

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público > Consulta Pública
- Objetivo: Validar segurança da consulta pública com chave inexistente.
- Descrição detalhada: Validar segurança da consulta pública com chave inexistente. Esse caso garante que o acompanhamento público seja útil para o usuário e seguro para a aplicação.
- Regra de negócio validada: AccessKey inválido deve retornar erro controlado.
- Perfil executor: Usuário público / QA
- Perfil afetado: Solicitação pública
- Tipo de teste: Segurança/Escopo
- Camada: API
- Prioridade: Crítica
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: A resposta deve ser controlada, sem stack trace, dados internos ou status enganoso.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, consulta, seguranca, api
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts; testes/api/solicitar-acesso/endpoints/endpoints-publicos.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/endpoints/endpoints-publicos.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Consulta com link ou chave inválida não deve expor erro interno, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar Consulta com link ou chave inválida não deve expor erro interno, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Abrir consulta com chave inexistente, vazia ou adulterada.

Resultado esperado:
A resposta deve ser controlada, sem stack trace, dados internos ou status enganoso.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Consulta pública apresenta o estado correto e preserva segurança dos dados.

### QC-REG-LS-082 - Consulta de solicitação inexistente deve orientar usuário sem enumerar dados

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público > Consulta Pública
- Objetivo: Validar resposta neutra para combinações que não localizam solicitação.
- Descrição detalhada: Validar resposta neutra para combinações que não localizam solicitação. Esse caso garante que o acompanhamento público seja útil para o usuário e seguro para a aplicação.
- Regra de negócio validada: Consulta pública não deve permitir enumeração de solicitações.
- Perfil executor: Usuário público / QA
- Perfil afetado: Solicitação pública
- Tipo de teste: Funcional
- Camada: Misto
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Mensagem deve ser neutra e sem detalhes internos.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, consulta, seguranca
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/endpoints/endpoints-publicos.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/endpoints/endpoints-publicos.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Consulta de solicitação inexistente deve orientar usuário sem enumerar dados, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar Consulta de solicitação inexistente deve orientar usuário sem enumerar dados, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Consultar dados inexistentes e comparar mensagem pública com cenário válido.

Resultado esperado:
Mensagem deve ser neutra e sem detalhes internos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Consulta pública apresenta o estado correto e preserva segurança dos dados.

### QC-REG-LS-083 - Consulta pública não deve expor senha, dados administrativos ou campos não necessários

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público > Consulta Pública
- Objetivo: Validar minimização de dados na consulta pública e e-mails associados.
- Descrição detalhada: Validar minimização de dados na consulta pública e e-mails associados. Esse caso garante que o acompanhamento público seja útil para o usuário e seguro para a aplicação.
- Regra de negócio validada: Usuário público só deve ver dados necessários para acompanhar e corrigir sua solicitação.
- Perfil executor: Usuário público / QA
- Perfil afetado: Solicitação pública
- Tipo de teste: Segurança/Escopo
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Senha não deve aparecer em e-mails de recusa/ajuste e dados administrativos não devem ser expostos.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, consulta, seguranca, email
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Consulta pública não deve expor senha, dados administrativos ou campos não necessários, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar Consulta pública não deve expor senha, dados administrativos ou campos não necessários, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Inspecionar consulta pública e e-mails de aceite, ajuste e recusa.

Resultado esperado:
Senha não deve aparecer em e-mails de recusa/ajuste e dados administrativos não devem ser expostos.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Consulta pública apresenta o estado correto e preserva segurança dos dados.

### QC-REG-LS-084 - Consulta deve aceitar somente campos solicitados para correção

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público > Consulta Pública
- Objetivo: Validar que o solicitante não altera campos fora do pedido de ajuste.
- Descrição detalhada: Validar que o solicitante não altera campos fora do pedido de ajuste. Esse caso garante que o acompanhamento público seja útil para o usuário e seguro para a aplicação.
- Regra de negócio validada: Correção pública deve respeitar lista de campos autorizados pelo revisor.
- Perfil executor: Usuário público / QA
- Perfil afetado: Solicitação pública
- Tipo de teste: Funcional
- Camada: API
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Apenas campos solicitados devem mudar; campo extra deve ser ignorado ou rejeitado.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, consulta, ajuste, seguranca, api
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Consulta deve aceitar somente campos solicitados para correção, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar Consulta deve aceitar somente campos solicitados para correção, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Enviar patch com campos solicitados e campo extra não autorizado.

Resultado esperado:
Apenas campos solicitados devem mudar; campo extra deve ser ignorado ou rejeitado.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Consulta pública apresenta o estado correto e preserva segurança dos dados.

### QC-REG-LS-085 - Consulta não deve permitir nova correção após retorno para análise

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público > Consulta Pública
- Objetivo: Validar bloqueio de correção repetida fora do status permitido.
- Descrição detalhada: Validar bloqueio de correção repetida fora do status permitido. Esse caso garante que o acompanhamento público seja útil para o usuário e seguro para a aplicação.
- Regra de negócio validada: Após reenviar correção, nova alteração pública deve ser bloqueada até novo pedido de ajuste.
- Perfil executor: Usuário público / QA
- Perfil afetado: Solicitação pública
- Tipo de teste: Segurança/Escopo
- Camada: API
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Segunda correção deve retornar conflito ou bloqueio equivalente.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, consulta, ajuste, seguranca, api
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Consulta não deve permitir nova correção após retorno para análise, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar Consulta não deve permitir nova correção após retorno para análise, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Corrigir solicitação em ajuste e repetir patch sem novo pedido do revisor.

Resultado esperado:
Segunda correção deve retornar conflito ou bloqueio equivalente.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Consulta pública apresenta o estado correto e preserva segurança dos dados.

### QC-REG-LS-086 - Reenvio de código de consulta deve enviar e-mail sem revelar accessKey na resposta

- Suite Qase: Regressão > Login > Solicitar Acesso — Usuário Público > Consulta Pública
- Objetivo: Validar fluxo de recuperação do link/código de acompanhamento.
- Descrição detalhada: Validar fluxo de recuperação do link/código de acompanhamento. Esse caso garante que o acompanhamento público seja útil para o usuário e seguro para a aplicação.
- Regra de negócio validada: Usuário depende do e-mail para recuperar a consulta, sem expor chave diretamente pela resposta pública.
- Perfil executor: Usuário público / QA
- Perfil afetado: Solicitação pública
- Tipo de teste: Funcional
- Camada: API
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Solicitação existente deve gerar novo e-mail com chave; resposta da API não deve devolver a chave e inexistente deve responder de forma neutra.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitar-acesso, usuario-publico, consulta, email, seguranca
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Reenvio de código de consulta deve enviar e-mail sem revelar accessKey na resposta, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
QA acessa a tela ou endpoint necessário para iniciar Reenvio de código de consulta deve enviar e-mail sem revelar accessKey na resposta, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Solicitar reenvio por nome e e-mail de uma solicitação existente e de uma inexistente.

Resultado esperado:
Solicitação existente deve gerar novo e-mail com chave; resposta da API não deve devolver a chave e inexistente deve responder de forma neutra.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Consulta pública apresenta o estado correto e preserva segurança dos dados.

### QC-REG-LS-087 - Líder TC acessa tela de Solicitações e visualiza fila de análise

- Suite Qase: Regressão > Solicitações > Líder TC
- Objetivo: Validar acesso do Líder TC à tela interna.
- Descrição detalhada: Validar acesso do Líder TC à tela interna. O caso reduz risco de bloqueio da fila de entrada e garante rastreabilidade das decisões.
- Regra de negócio validada: Líder TC é revisor autorizado.
- Perfil executor: Líder TC
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Permissão
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Ação do Líder TC respeita permissões, atualiza status e gera evidências esperadas.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, lider-tc, permissao
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/solicitacoes-admin/permissao/acessar-modulo.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/permissao/acessar-modulo.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Líder TC acessa tela de Solicitações e visualiza fila de análise, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Líder TC acessa a tela ou endpoint necessário para iniciar Líder TC acessa tela de Solicitações e visualiza fila de análise, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Líder TC, acessar a tela ou API de Solicitações e executar a ação descrita no caso.

Resultado esperado:
A tela/API deve permitir a ação autorizada, registrar estado/histórico e refletir o resultado para o solicitante.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Solicitação fica no status correto e com auditoria suficiente para rastreabilidade.

### QC-REG-LS-088 - Líder TC visualiza solicitações de todos os perfis permitidos

- Suite Qase: Regressão > Solicitações > Líder TC
- Objetivo: Validar abrangência da fila para Líder TC.
- Descrição detalhada: Validar abrangência da fila para Líder TC. O caso reduz risco de bloqueio da fila de entrada e garante rastreabilidade das decisões.
- Regra de negócio validada: Líder TC pode revisar perfis permitidos pela regra atual.
- Perfil executor: Líder TC
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Funcional
- Camada: Misto
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Ação do Líder TC respeita permissões, atualiza status e gera evidências esperadas.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, lider-tc, consulta
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/solicitacoes/listar-solicitacoes.positivo.api.spec.ts; testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/solicitacoes/listar-solicitacoes.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Líder TC visualiza solicitações de todos os perfis permitidos, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Líder TC acessa a tela ou endpoint necessário para iniciar Líder TC visualiza solicitações de todos os perfis permitidos, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Líder TC, acessar a tela ou API de Solicitações e executar a ação descrita no caso.

Resultado esperado:
A tela/API deve permitir a ação autorizada, registrar estado/histórico e refletir o resultado para o solicitante.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Solicitação fica no status correto e com auditoria suficiente para rastreabilidade.

### QC-REG-LS-089 - Líder TC abre detalhes da solicitação e visualiza dados do solicitante

- Suite Qase: Regressão > Solicitações > Líder TC
- Objetivo: Validar abertura de detalhe antes da decisão.
- Descrição detalhada: Validar abertura de detalhe antes da decisão. O caso reduz risco de bloqueio da fila de entrada e garante rastreabilidade das decisões.
- Regra de negócio validada: Revisor deve avaliar dados necessários para aprovar ou recusar.
- Perfil executor: Líder TC
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Funcional
- Camada: Misto
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Ação do Líder TC respeita permissões, atualiza status e gera evidências esperadas.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, lider-tc, consulta
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/solicitacoes-admin/endpoints/endpoints-da-tela.ui.spec.ts; testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/endpoints/endpoints-da-tela.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Líder TC abre detalhes da solicitação e visualiza dados do solicitante, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Líder TC acessa a tela ou endpoint necessário para iniciar Líder TC abre detalhes da solicitação e visualiza dados do solicitante, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Líder TC, acessar a tela ou API de Solicitações e executar a ação descrita no caso.

Resultado esperado:
A tela/API deve permitir a ação autorizada, registrar estado/histórico e refletir o resultado para o solicitante.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Solicitação fica no status correto e com auditoria suficiente para rastreabilidade.

### QC-REG-LS-090 - Líder TC aceita solicitação e libera login do usuário

- Suite Qase: Regressão > Solicitações > Líder TC
- Objetivo: Validar aceite com criação/liberação de acesso.
- Descrição detalhada: Validar aceite com criação/liberação de acesso. O caso reduz risco de bloqueio da fila de entrada e garante rastreabilidade das decisões.
- Regra de negócio validada: Aceite deve fechar solicitação e liberar login.
- Perfil executor: Líder TC
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Funcional
- Camada: API
- Prioridade: Crítica
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Ação do Líder TC respeita permissões, atualiza status e gera evidências esperadas.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, lider-tc, aprovacao, login
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Líder TC aceita solicitação e libera login do usuário, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Líder TC acessa a tela ou endpoint necessário para iniciar Líder TC aceita solicitação e libera login do usuário, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Líder TC, acessar a tela ou API de Solicitações e executar a ação descrita no caso.

Resultado esperado:
A tela/API deve permitir a ação autorizada, registrar estado/histórico e refletir o resultado para o solicitante.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Solicitação fica no status correto e com auditoria suficiente para rastreabilidade.

### QC-REG-LS-091 - Líder TC solicita alteração com comentário e campos específicos

- Suite Qase: Regressão > Solicitações > Líder TC
- Objetivo: Validar devolução da solicitação para correção.
- Descrição detalhada: Validar devolução da solicitação para correção. O caso reduz risco de bloqueio da fila de entrada e garante rastreabilidade das decisões.
- Regra de negócio validada: Ajuste deve informar campos e comentário.
- Perfil executor: Líder TC
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Funcional
- Camada: API
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Ação do Líder TC respeita permissões, atualiza status e gera evidências esperadas.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, lider-tc, ajuste, comentario
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts; testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Líder TC solicita alteração com comentário e campos específicos, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Líder TC acessa a tela ou endpoint necessário para iniciar Líder TC solicita alteração com comentário e campos específicos, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Líder TC, acessar a tela ou API de Solicitações e executar a ação descrita no caso.

Resultado esperado:
A tela/API deve permitir a ação autorizada, registrar estado/histórico e refletir o resultado para o solicitante.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Solicitação fica no status correto e com auditoria suficiente para rastreabilidade.

### QC-REG-LS-092 - Usuário público corrige dados e Líder TC aprova após correção

- Suite Qase: Regressão > Solicitações > Líder TC
- Objetivo: Validar ciclo ajuste-correção-aprovação.
- Descrição detalhada: Validar ciclo ajuste-correção-aprovação. O caso reduz risco de bloqueio da fila de entrada e garante rastreabilidade das decisões.
- Regra de negócio validada: Correção devolvida deve permitir nova decisão do revisor.
- Perfil executor: Líder TC
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Funcional
- Camada: E2E
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Ação do Líder TC respeita permissões, atualiza status e gera evidências esperadas.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, lider-tc, ajuste, aprovacao
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/solicitacoes-admin/fluxo-completo/solicitacao-ajuste-aprovacao.ui.spec.ts; testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/fluxo-completo/solicitacao-ajuste-aprovacao.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Usuário público corrige dados e Líder TC aprova após correção, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Líder TC acessa a tela ou endpoint necessário para iniciar Usuário público corrige dados e Líder TC aprova após correção, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Líder TC, acessar a tela ou API de Solicitações e executar a ação descrita no caso.

Resultado esperado:
A tela/API deve permitir a ação autorizada, registrar estado/histórico e refletir o resultado para o solicitante.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Solicitação fica no status correto e com auditoria suficiente para rastreabilidade.

### QC-REG-LS-093 - Líder TC recusa solicitação com justificativa obrigatória

- Suite Qase: Regressão > Solicitações > Líder TC
- Objetivo: Validar recusa com motivo rastreável.
- Descrição detalhada: Validar recusa com motivo rastreável. O caso reduz risco de bloqueio da fila de entrada e garante rastreabilidade das decisões.
- Regra de negócio validada: Recusa deve exigir justificativa e finalizar fluxo.
- Perfil executor: Líder TC
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Funcional
- Camada: API
- Prioridade: Crítica
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Ação do Líder TC respeita permissões, atualiza status e gera evidências esperadas.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, lider-tc, recusa
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Líder TC recusa solicitação com justificativa obrigatória, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Líder TC acessa a tela ou endpoint necessário para iniciar Líder TC recusa solicitação com justificativa obrigatória, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Líder TC, acessar a tela ou API de Solicitações e executar a ação descrita no caso.

Resultado esperado:
A tela/API deve permitir a ação autorizada, registrar estado/histórico e refletir o resultado para o solicitante.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Solicitação fica no status correto e com auditoria suficiente para rastreabilidade.

### QC-REG-LS-094 - Líder TC comenta solicitação e histórico deve preservar conversa

- Suite Qase: Regressão > Solicitações > Líder TC
- Objetivo: Validar comentários e histórico durante análise.
- Descrição detalhada: Validar comentários e histórico durante análise. O caso reduz risco de bloqueio da fila de entrada e garante rastreabilidade das decisões.
- Regra de negócio validada: Comentários devem ser auditáveis e aparecer no histórico.
- Perfil executor: Líder TC
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Funcional
- Camada: E2E
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Ação do Líder TC respeita permissões, atualiza status e gera evidências esperadas.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, lider-tc, comentario
- Status de automação: Automatizado E2E
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Líder TC comenta solicitação e histórico deve preservar conversa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Líder TC acessa a tela ou endpoint necessário para iniciar Líder TC comenta solicitação e histórico deve preservar conversa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Líder TC, acessar a tela ou API de Solicitações e executar a ação descrita no caso.

Resultado esperado:
A tela/API deve permitir a ação autorizada, registrar estado/histórico e refletir o resultado para o solicitante.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Solicitação fica no status correto e com auditoria suficiente para rastreabilidade.

### QC-REG-LS-095 - Ações do Líder TC devem enviar e-mails corretos de aceite, alteração e recusa

- Suite Qase: Regressão > Solicitações > Líder TC
- Objetivo: Validar comunicação gerada por decisões do Líder TC.
- Descrição detalhada: Validar comunicação gerada por decisões do Líder TC. O caso reduz risco de bloqueio da fila de entrada e garante rastreabilidade das decisões.
- Regra de negócio validada: Cada ação administrativa deve notificar o solicitante.
- Perfil executor: Líder TC
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Integração
- Camada: API
- Prioridade: Crítica
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Ação do Líder TC respeita permissões, atualiza status e gera evidências esperadas.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, lider-tc, email
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts; testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts; testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Ações do Líder TC devem enviar e-mails corretos de aceite, alteração e recusa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Líder TC acessa a tela ou endpoint necessário para iniciar Ações do Líder TC devem enviar e-mails corretos de aceite, alteração e recusa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Líder TC, acessar a tela ou API de Solicitações e executar a ação descrita no caso.

Resultado esperado:
A tela/API deve permitir a ação autorizada, registrar estado/histórico e refletir o resultado para o solicitante.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Solicitação fica no status correto e com auditoria suficiente para rastreabilidade.

### QC-REG-LS-096 - Solicitação finalizada por Líder TC não deve permitir alteração indevida

- Suite Qase: Regressão > Solicitações > Líder TC
- Objetivo: Validar imutabilidade de solicitação finalizada.
- Descrição detalhada: Validar imutabilidade de solicitação finalizada. O caso reduz risco de bloqueio da fila de entrada e garante rastreabilidade das decisões.
- Regra de negócio validada: Status final não deve aceitar nova alteração sem regra explícita.
- Perfil executor: Líder TC
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Funcional
- Camada: Misto
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Ação do Líder TC respeita permissões, atualiza status e gera evidências esperadas.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, lider-tc, seguranca
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Solicitação finalizada por Líder TC não deve permitir alteração indevida, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Líder TC acessa a tela ou endpoint necessário para iniciar Solicitação finalizada por Líder TC não deve permitir alteração indevida, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Líder TC, acessar a tela ou API de Solicitações e executar a ação descrita no caso.

Resultado esperado:
A tela/API deve permitir a ação autorizada, registrar estado/histórico e refletir o resultado para o solicitante.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Solicitação fica no status correto e com auditoria suficiente para rastreabilidade.

### QC-REG-LS-097 - Rota antiga /admin/requests não deve existir como fluxo válido

- Suite Qase: Regressão > Solicitações > Líder TC
- Objetivo: Validar remoção do fluxo legado de solicitações.
- Descrição detalhada: Validar remoção do fluxo legado de solicitações. O caso reduz risco de bloqueio da fila de entrada e garante rastreabilidade das decisões.
- Regra de negócio validada: Rota vigente é `/admin/access-requests`.
- Perfil executor: Líder TC
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Funcional
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Ação do Líder TC respeita permissões, atualiza status e gera evidências esperadas.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, lider-tc
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/solicitacoes-admin/permissao/acessar-modulo.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/permissao/acessar-modulo.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Rota antiga /admin/requests não deve existir como fluxo válido, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Líder TC acessa a tela ou endpoint necessário para iniciar Rota antiga /admin/requests não deve existir como fluxo válido, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Líder TC, acessar a tela ou API de Solicitações e executar a ação descrita no caso.

Resultado esperado:
A tela/API deve permitir a ação autorizada, registrar estado/histórico e refletir o resultado para o solicitante.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Solicitação fica no status correto e com auditoria suficiente para rastreabilidade.

### QC-REG-LS-098 - Tela de Solicitações para Líder TC deve atender acessibilidade crítica

- Suite Qase: Regressão > Solicitações > Líder TC
- Objetivo: Validar acessibilidade da tela administrativa.
- Descrição detalhada: Validar acessibilidade da tela administrativa. O caso reduz risco de bloqueio da fila de entrada e garante rastreabilidade das decisões.
- Regra de negócio validada: Revisores precisam operar a fila sem violações graves.
- Perfil executor: Líder TC
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Acessibilidade
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Ação do Líder TC respeita permissões, atualiza status e gera evidências esperadas.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, lider-tc, acessibilidade
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/solicitacoes-admin/acessibilidade/solicitacoes.acessibilidade.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/acessibilidade/solicitacoes.acessibilidade.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Tela de Solicitações para Líder TC deve atender acessibilidade crítica, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Líder TC acessa a tela ou endpoint necessário para iniciar Tela de Solicitações para Líder TC deve atender acessibilidade crítica, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Líder TC, acessar a tela ou API de Solicitações e executar a ação descrita no caso.

Resultado esperado:
A tela/API deve permitir a ação autorizada, registrar estado/histórico e refletir o resultado para o solicitante.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Solicitação fica no status correto e com auditoria suficiente para rastreabilidade.

### QC-REG-LS-099 - Suporte Técnico acessa tela de Solicitações quando autorizado

- Suite Qase: Regressão > Solicitações > Suporte Técnico
- Objetivo: Validar acesso do Suporte Técnico ao módulo.
- Descrição detalhada: Validar acesso do Suporte Técnico ao módulo. O caso ajuda a separar responsabilidades de suporte e administração global.
- Regra de negócio validada: Suporte Técnico está listado como perfil autorizado para a fila.
- Perfil executor: Suporte Técnico
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Permissão
- Camada: UI
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Suporte Técnico atua somente dentro da regra permitida.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, suporte-tecnico, permissao
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/solicitacoes-admin/permissao/acessar-modulo.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/permissao/acessar-modulo.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Suporte Técnico acessa tela de Solicitações quando autorizado, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Suporte Técnico acessa a tela ou endpoint necessário para iniciar Suporte Técnico acessa tela de Solicitações quando autorizado, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Suporte Técnico, acessar a fila ou API e executar a validação descrita no caso.

Resultado esperado:
A permissão efetiva deve permitir apenas ações autorizadas e bloquear qualquer ação fora do escopo.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Atuação do suporte permanece limitada e rastreável.

### QC-REG-LS-100 - Suporte Técnico visualiza solicitações permitidas sem acessar itens proibidos

- Suite Qase: Regressão > Solicitações > Suporte Técnico
- Objetivo: Validar escopo de visualização do suporte.
- Descrição detalhada: Validar escopo de visualização do suporte. O caso ajuda a separar responsabilidades de suporte e administração global.
- Regra de negócio validada: Suporte Técnico só deve ver solicitações permitidas pela regra atual.
- Perfil executor: Suporte Técnico
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Funcional
- Camada: Misto
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Suporte Técnico atua somente dentro da regra permitida.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, suporte-tecnico, escopo
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/solicitacoes/listar-solicitacoes.positivo.api.spec.ts; testes/ui/login/solicitar-acesso/solicitacoes-admin/permissao/acessar-modulo.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/solicitacoes/listar-solicitacoes.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/permissao/acessar-modulo.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Suporte Técnico visualiza solicitações permitidas sem acessar itens proibidos, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Suporte Técnico acessa a tela ou endpoint necessário para iniciar Suporte Técnico visualiza solicitações permitidas sem acessar itens proibidos, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Suporte Técnico, acessar a fila ou API e executar a validação descrita no caso.

Resultado esperado:
A permissão efetiva deve permitir apenas ações autorizadas e bloquear qualquer ação fora do escopo.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Atuação do suporte permanece limitada e rastreável.

### QC-REG-LS-101 - Suporte Técnico abre detalhes da solicitação permitida

- Suite Qase: Regressão > Solicitações > Suporte Técnico
- Objetivo: Validar leitura de detalhes antes da decisão.
- Descrição detalhada: Validar leitura de detalhes antes da decisão. O caso ajuda a separar responsabilidades de suporte e administração global.
- Regra de negócio validada: Detalhes necessários devem estar disponíveis ao revisor autorizado.
- Perfil executor: Suporte Técnico
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Funcional
- Camada: Misto
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Suporte Técnico atua somente dentro da regra permitida.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, suporte-tecnico, consulta
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Suporte Técnico abre detalhes da solicitação permitida, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Suporte Técnico acessa a tela ou endpoint necessário para iniciar Suporte Técnico abre detalhes da solicitação permitida, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Suporte Técnico, acessar a fila ou API e executar a validação descrita no caso.

Resultado esperado:
A permissão efetiva deve permitir apenas ações autorizadas e bloquear qualquer ação fora do escopo.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Atuação do suporte permanece limitada e rastreável.

### QC-REG-LS-102 - Suporte Técnico aceita solicitação permitida e libera login

- Suite Qase: Regressão > Solicitações > Suporte Técnico
- Objetivo: Validar aprovação pelo perfil de suporte.
- Descrição detalhada: Validar aprovação pelo perfil de suporte. O caso ajuda a separar responsabilidades de suporte e administração global.
- Regra de negócio validada: Suporte Técnico pode aprovar solicitações dentro da regra implementada.
- Perfil executor: Suporte Técnico
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Funcional
- Camada: API
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Suporte Técnico atua somente dentro da regra permitida.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, suporte-tecnico, aprovacao, login
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Suporte Técnico aceita solicitação permitida e libera login, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Suporte Técnico acessa a tela ou endpoint necessário para iniciar Suporte Técnico aceita solicitação permitida e libera login, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Suporte Técnico, acessar a fila ou API e executar a validação descrita no caso.

Resultado esperado:
A permissão efetiva deve permitir apenas ações autorizadas e bloquear qualquer ação fora do escopo.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Atuação do suporte permanece limitada e rastreável.

### QC-REG-LS-103 - Suporte Técnico solicita alteração e recebe dados corrigidos

- Suite Qase: Regressão > Solicitações > Suporte Técnico
- Objetivo: Validar ciclo de ajuste pelo suporte.
- Descrição detalhada: Validar ciclo de ajuste pelo suporte. O caso ajuda a separar responsabilidades de suporte e administração global.
- Regra de negócio validada: Suporte Técnico pode pedir correção quando autorizado.
- Perfil executor: Suporte Técnico
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Funcional
- Camada: API
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Suporte Técnico atua somente dentro da regra permitida.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, suporte-tecnico, ajuste
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Suporte Técnico solicita alteração e recebe dados corrigidos, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Suporte Técnico acessa a tela ou endpoint necessário para iniciar Suporte Técnico solicita alteração e recebe dados corrigidos, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Suporte Técnico, acessar a fila ou API e executar a validação descrita no caso.

Resultado esperado:
A permissão efetiva deve permitir apenas ações autorizadas e bloquear qualquer ação fora do escopo.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Atuação do suporte permanece limitada e rastreável.

### QC-REG-LS-104 - Suporte Técnico recusa solicitação com motivo e e-mail

- Suite Qase: Regressão > Solicitações > Suporte Técnico
- Objetivo: Validar recusa pelo suporte.
- Descrição detalhada: Validar recusa pelo suporte. O caso ajuda a separar responsabilidades de suporte e administração global.
- Regra de negócio validada: Recusa deve preservar motivo e notificar solicitante.
- Perfil executor: Suporte Técnico
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Integração
- Camada: API
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Suporte Técnico atua somente dentro da regra permitida.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, suporte-tecnico, recusa, email
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
- Comando de execução:

```bash
npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Suporte Técnico recusa solicitação com motivo e e-mail, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Suporte Técnico acessa a tela ou endpoint necessário para iniciar Suporte Técnico recusa solicitação com motivo e e-mail, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Suporte Técnico, acessar a fila ou API e executar a validação descrita no caso.

Resultado esperado:
A permissão efetiva deve permitir apenas ações autorizadas e bloquear qualquer ação fora do escopo.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Atuação do suporte permanece limitada e rastreável.

### QC-REG-LS-105 - Suporte Técnico não deve aprovar perfil fora da sua regra de atuação

- Suite Qase: Regressão > Solicitações > Suporte Técnico
- Objetivo: Validar bloqueio de decisões fora do escopo.
- Descrição detalhada: Validar bloqueio de decisões fora do escopo. O caso ajuda a separar responsabilidades de suporte e administração global.
- Regra de negócio validada: Permissões do suporte precisam limitar decisões por perfil quando houver restrição.
- Perfil executor: Suporte Técnico
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Permissão
- Camada: Manual
- Prioridade: Crítica
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Suporte Técnico atua somente dentro da regra permitida.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, suporte-tecnico, permissao, seguranca
- Status de automação: Precisa análise
- Arquivo automatizado relacionado: Não localizado
- Comando de execução:

```bash
Não aplicável
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Suporte Técnico não deve aprovar perfil fora da sua regra de atuação, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Suporte Técnico acessa a tela ou endpoint necessário para iniciar Suporte Técnico não deve aprovar perfil fora da sua regra de atuação, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Suporte Técnico, acessar a fila ou API e executar a validação descrita no caso.

Resultado esperado:
A permissão efetiva deve permitir apenas ações autorizadas e bloquear qualquer ação fora do escopo.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Atuação do suporte permanece limitada e rastreável.

### QC-REG-LS-106 - Suporte Técnico não deve visualizar ações administrativas indevidas

- Suite Qase: Regressão > Solicitações > Suporte Técnico
- Objetivo: Validar ocultação/bloqueio de ações fora do papel.
- Descrição detalhada: Validar ocultação/bloqueio de ações fora do papel. O caso ajuda a separar responsabilidades de suporte e administração global.
- Regra de negócio validada: UI e API devem impedir ações não permitidas.
- Perfil executor: Suporte Técnico
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Permissão
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Suporte Técnico atua somente dentro da regra permitida.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, suporte-tecnico, seguranca
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/solicitacoes-admin/permissao/acessar-modulo.ui.spec.ts; testes/api/suporte/support-access.test.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/permissao/acessar-modulo.ui.spec.ts --project=chromium --workers=1 --reporter=list
npm test -- testes/api/suporte/support-access.test.ts --runInBand
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Suporte Técnico não deve visualizar ações administrativas indevidas, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Suporte Técnico acessa a tela ou endpoint necessário para iniciar Suporte Técnico não deve visualizar ações administrativas indevidas, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Suporte Técnico, acessar a fila ou API e executar a validação descrita no caso.

Resultado esperado:
A permissão efetiva deve permitir apenas ações autorizadas e bloquear qualquer ação fora do escopo.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Atuação do suporte permanece limitada e rastreável.

### QC-REG-LS-107 - Suporte Técnico comenta solicitação quando permitido

- Suite Qase: Regressão > Solicitações > Suporte Técnico
- Objetivo: Validar conversa do suporte com solicitante.
- Descrição detalhada: Validar conversa do suporte com solicitante. O caso ajuda a separar responsabilidades de suporte e administração global.
- Regra de negócio validada: Comentários devem ser salvos no histórico quando a ação existir para o perfil.
- Perfil executor: Suporte Técnico
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Funcional
- Camada: Misto
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Suporte Técnico atua somente dentro da regra permitida.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, suporte-tecnico, comentario
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Suporte Técnico comenta solicitação quando permitido, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Suporte Técnico acessa a tela ou endpoint necessário para iniciar Suporte Técnico comenta solicitação quando permitido, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Suporte Técnico, acessar a fila ou API e executar a validação descrita no caso.

Resultado esperado:
A permissão efetiva deve permitir apenas ações autorizadas e bloquear qualquer ação fora do escopo.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Atuação do suporte permanece limitada e rastreável.

### QC-REG-LS-108 - Permissões do Suporte Técnico devem ser respeitadas na navegação base

- Suite Qase: Regressão > Solicitações > Suporte Técnico
- Objetivo: Validar inventário de rotas e navegação do suporte.
- Descrição detalhada: Validar inventário de rotas e navegação do suporte. O caso ajuda a separar responsabilidades de suporte e administração global.
- Regra de negócio validada: Suporte Técnico não deve herdar menus de administrador global.
- Perfil executor: Suporte Técnico
- Perfil afetado: Solicitações de acesso
- Tipo de teste: Permissão
- Camada: API
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Suporte Técnico atua somente dentro da regra permitida.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, suporte-tecnico, permissao
- Status de automação: Automatizado API
- Arquivo automatizado relacionado: testes/api/navegacao/perfil-suporte-navegacao-base.test.ts
- Comando de execução:

```bash
npm test -- testes/api/navegacao/perfil-suporte-navegacao-base.test.ts --runInBand
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Depende de seed, autenticação, estado de sessão, outbox de e-mail e estabilidade do servidor local usado pelo Playwright.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Permissões do Suporte Técnico devem ser respeitadas na navegação base, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Suporte Técnico acessa a tela ou endpoint necessário para iniciar Permissões do Suporte Técnico devem ser respeitadas na navegação base, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Suporte Técnico, acessar a fila ou API e executar a validação descrita no caso.

Resultado esperado:
A permissão efetiva deve permitir apenas ações autorizadas e bloquear qualquer ação fora do escopo.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Atuação do suporte permanece limitada e rastreável.

### QC-REG-LS-109 - Empresa acessa tela de Solicitações com escopo da própria empresa

- Suite Qase: Regressão > Solicitações > Empresa
- Objetivo: Validar acesso empresarial à fila com escopo company.
- Descrição detalhada: Validar acesso empresarial à fila com escopo company. Esse ponto é crítico porque o perfil Empresa tem escopo restrito e não pode virar administrador global por acidente.
- Regra de negócio validada: Empresa deve atuar somente nas solicitações da própria empresa conforme regra atual desejada.
- Perfil executor: Empresa
- Perfil afetado: Solicitações da própria empresa
- Tipo de teste: Segurança/Escopo
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Empresa opera apenas solicitações da própria empresa.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, empresa, escopo
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/solicitacoes-admin/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: Há inconsistência observada: `permissao/acessar-modulo.ui.spec.ts` classifica Empresa como perfil negado ao módulo, enquanto `escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts` valida acesso com escopo company. Regra precisa ser confirmada antes de vincular todos os casos.
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Empresa acessa tela de Solicitações com escopo da própria empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Empresa acessa a tela ou endpoint necessário para iniciar Empresa acessa tela de Solicitações com escopo da própria empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Empresa, selecionar contexto empresarial correto e executar a validação descrita no caso.

Resultado esperado:
A Empresa deve enxergar e atuar somente no próprio escopo, com bloqueio para qualquer dado de outra empresa.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Escopo empresarial permanece isolado e auditável.

### QC-REG-LS-110 - Empresa visualiza somente solicitações vinculadas à própria empresa

- Suite Qase: Regressão > Solicitações > Empresa
- Objetivo: Validar filtro de escopo da Empresa.
- Descrição detalhada: Validar filtro de escopo da Empresa. Esse ponto é crítico porque o perfil Empresa tem escopo restrito e não pode virar administrador global por acidente.
- Regra de negócio validada: Empresa não pode ver solicitações de outras empresas.
- Perfil executor: Empresa
- Perfil afetado: Solicitações da própria empresa
- Tipo de teste: Segurança/Escopo
- Camada: UI
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Empresa opera apenas solicitações da própria empresa.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, empresa, escopo, seguranca
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/solicitacoes-admin/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: undefined
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Empresa visualiza somente solicitações vinculadas à própria empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Empresa acessa a tela ou endpoint necessário para iniciar Empresa visualiza somente solicitações vinculadas à própria empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Empresa, selecionar contexto empresarial correto e executar a validação descrita no caso.

Resultado esperado:
A Empresa deve enxergar e atuar somente no próprio escopo, com bloqueio para qualquer dado de outra empresa.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Escopo empresarial permanece isolado e auditável.

### QC-REG-LS-111 - Empresa não visualiza solicitação de outra empresa na busca ou listagem

- Suite Qase: Regressão > Solicitações > Empresa
- Objetivo: Validar isolamento entre duas empresas.
- Descrição detalhada: Validar isolamento entre duas empresas. Esse ponto é crítico porque o perfil Empresa tem escopo restrito e não pode virar administrador global por acidente.
- Regra de negócio validada: Escopo empresarial exige isolamento por `clientId`/`clientSlug`.
- Perfil executor: Empresa
- Perfil afetado: Solicitações da própria empresa
- Tipo de teste: Segurança/Escopo
- Camada: UI
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Empresa opera apenas solicitações da própria empresa.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, empresa, escopo, seguranca
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/solicitacoes-admin/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: undefined
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Empresa não visualiza solicitação de outra empresa na busca ou listagem, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Empresa acessa a tela ou endpoint necessário para iniciar Empresa não visualiza solicitação de outra empresa na busca ou listagem, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Empresa, selecionar contexto empresarial correto e executar a validação descrita no caso.

Resultado esperado:
A Empresa deve enxergar e atuar somente no próprio escopo, com bloqueio para qualquer dado de outra empresa.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Escopo empresarial permanece isolado e auditável.

### QC-REG-LS-112 - Empresa não acessa solicitação de outra empresa por URL direta

- Suite Qase: Regressão > Solicitações > Empresa
- Objetivo: Validar bloqueio backend para acesso direto.
- Descrição detalhada: Validar bloqueio backend para acesso direto. Esse ponto é crítico porque o perfil Empresa tem escopo restrito e não pode virar administrador global por acidente.
- Regra de negócio validada: Bloqueio deve existir além do filtro visual.
- Perfil executor: Empresa
- Perfil afetado: Solicitações da própria empresa
- Tipo de teste: Segurança/Escopo
- Camada: Manual
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Empresa opera apenas solicitações da própria empresa.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, empresa, escopo, seguranca
- Status de automação: Candidato à automação
- Arquivo automatizado relacionado: Não localizado
- Comando de execução:

```bash
Não aplicável
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: undefined
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Empresa não acessa solicitação de outra empresa por URL direta, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Empresa acessa a tela ou endpoint necessário para iniciar Empresa não acessa solicitação de outra empresa por URL direta, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Empresa, selecionar contexto empresarial correto e executar a validação descrita no caso.

Resultado esperado:
A Empresa deve enxergar e atuar somente no próprio escopo, com bloqueio para qualquer dado de outra empresa.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Escopo empresarial permanece isolado e auditável.

### QC-REG-LS-113 - Empresa aceita solicitação da própria empresa quando a regra permitir

- Suite Qase: Regressão > Solicitações > Empresa
- Objetivo: Validar aceite empresarial dentro do próprio escopo.
- Descrição detalhada: Validar aceite empresarial dentro do próprio escopo. Esse ponto é crítico porque o perfil Empresa tem escopo restrito e não pode virar administrador global por acidente.
- Regra de negócio validada: Empresa pode aceitar solicitações relacionadas à própria empresa conforme regra atual desejada.
- Perfil executor: Empresa
- Perfil afetado: Solicitações da própria empresa
- Tipo de teste: Funcional
- Camada: Manual
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Empresa opera apenas solicitações da própria empresa.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, empresa, aprovacao
- Status de automação: Candidato à automação
- Arquivo automatizado relacionado: Não localizado
- Comando de execução:

```bash
Não aplicável
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: undefined
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Empresa aceita solicitação da própria empresa quando a regra permitir, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Empresa acessa a tela ou endpoint necessário para iniciar Empresa aceita solicitação da própria empresa quando a regra permitir, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Empresa, selecionar contexto empresarial correto e executar a validação descrita no caso.

Resultado esperado:
A Empresa deve enxergar e atuar somente no próprio escopo, com bloqueio para qualquer dado de outra empresa.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Escopo empresarial permanece isolado e auditável.

### QC-REG-LS-114 - Empresa solicita alteração em solicitação da própria empresa

- Suite Qase: Regressão > Solicitações > Empresa
- Objetivo: Validar ajuste empresarial para dados de seu escopo.
- Descrição detalhada: Validar ajuste empresarial para dados de seu escopo. Esse ponto é crítico porque o perfil Empresa tem escopo restrito e não pode virar administrador global por acidente.
- Regra de negócio validada: Empresa pode pedir correção em solicitações da própria empresa conforme regra atual desejada.
- Perfil executor: Empresa
- Perfil afetado: Solicitações da própria empresa
- Tipo de teste: Funcional
- Camada: Manual
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Empresa opera apenas solicitações da própria empresa.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, empresa, ajuste
- Status de automação: Candidato à automação
- Arquivo automatizado relacionado: Não localizado
- Comando de execução:

```bash
Não aplicável
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: undefined
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Empresa solicita alteração em solicitação da própria empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Empresa acessa a tela ou endpoint necessário para iniciar Empresa solicita alteração em solicitação da própria empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Empresa, selecionar contexto empresarial correto e executar a validação descrita no caso.

Resultado esperado:
A Empresa deve enxergar e atuar somente no próprio escopo, com bloqueio para qualquer dado de outra empresa.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Escopo empresarial permanece isolado e auditável.

### QC-REG-LS-115 - Empresa recusa solicitação da própria empresa com justificativa

- Suite Qase: Regressão > Solicitações > Empresa
- Objetivo: Validar recusa empresarial dentro do escopo.
- Descrição detalhada: Validar recusa empresarial dentro do escopo. Esse ponto é crítico porque o perfil Empresa tem escopo restrito e não pode virar administrador global por acidente.
- Regra de negócio validada: Empresa pode recusar solicitações da própria empresa conforme regra atual desejada.
- Perfil executor: Empresa
- Perfil afetado: Solicitações da própria empresa
- Tipo de teste: Funcional
- Camada: Manual
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Empresa opera apenas solicitações da própria empresa.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, empresa, recusa
- Status de automação: Candidato à automação
- Arquivo automatizado relacionado: Não localizado
- Comando de execução:

```bash
Não aplicável
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: undefined
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Empresa recusa solicitação da própria empresa com justificativa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Empresa acessa a tela ou endpoint necessário para iniciar Empresa recusa solicitação da própria empresa com justificativa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Empresa, selecionar contexto empresarial correto e executar a validação descrita no caso.

Resultado esperado:
A Empresa deve enxergar e atuar somente no próprio escopo, com bloqueio para qualquer dado de outra empresa.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Escopo empresarial permanece isolado e auditável.

### QC-REG-LS-116 - Empresa comenta solicitação da própria empresa quando permitido

- Suite Qase: Regressão > Solicitações > Empresa
- Objetivo: Validar comentário empresarial limitado ao próprio escopo.
- Descrição detalhada: Validar comentário empresarial limitado ao próprio escopo. Esse ponto é crítico porque o perfil Empresa tem escopo restrito e não pode virar administrador global por acidente.
- Regra de negócio validada: Comentário de Empresa não deve vazar para solicitações de outra empresa.
- Perfil executor: Empresa
- Perfil afetado: Solicitações da própria empresa
- Tipo de teste: Funcional
- Camada: Manual
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Empresa opera apenas solicitações da própria empresa.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, empresa, comentario
- Status de automação: Candidato à automação
- Arquivo automatizado relacionado: Não localizado
- Comando de execução:

```bash
Não aplicável
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: undefined
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Empresa comenta solicitação da própria empresa quando permitido, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Empresa acessa a tela ou endpoint necessário para iniciar Empresa comenta solicitação da própria empresa quando permitido, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Empresa, selecionar contexto empresarial correto e executar a validação descrita no caso.

Resultado esperado:
A Empresa deve enxergar e atuar somente no próprio escopo, com bloqueio para qualquer dado de outra empresa.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Escopo empresarial permanece isolado e auditável.

### QC-REG-LS-117 - Empresa não comenta nem altera solicitação de outra empresa

- Suite Qase: Regressão > Solicitações > Empresa
- Objetivo: Validar bloqueio de ações cruzadas.
- Descrição detalhada: Validar bloqueio de ações cruzadas. Esse ponto é crítico porque o perfil Empresa tem escopo restrito e não pode virar administrador global por acidente.
- Regra de negócio validada: Empresa não pode atuar em dados fora do escopo.
- Perfil executor: Empresa
- Perfil afetado: Solicitações da própria empresa
- Tipo de teste: Segurança/Escopo
- Camada: Manual
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Empresa opera apenas solicitações da própria empresa.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, empresa, seguranca, escopo
- Status de automação: Candidato à automação
- Arquivo automatizado relacionado: Não localizado
- Comando de execução:

```bash
Não aplicável
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: undefined
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Empresa não comenta nem altera solicitação de outra empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Empresa acessa a tela ou endpoint necessário para iniciar Empresa não comenta nem altera solicitação de outra empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Empresa, selecionar contexto empresarial correto e executar a validação descrita no caso.

Resultado esperado:
A Empresa deve enxergar e atuar somente no próprio escopo, com bloqueio para qualquer dado de outra empresa.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Escopo empresarial permanece isolado e auditável.

### QC-REG-LS-118 - Empresa não acessa admin inteiro fora do escopo permitido

- Suite Qase: Regressão > Solicitações > Empresa
- Objetivo: Validar limitação de rotas administrativas para Empresa.
- Descrição detalhada: Validar limitação de rotas administrativas para Empresa. Esse ponto é crítico porque o perfil Empresa tem escopo restrito e não pode virar administrador global por acidente.
- Regra de negócio validada: Empresa não deve receber admin global.
- Perfil executor: Empresa
- Perfil afetado: Solicitações da própria empresa
- Tipo de teste: Segurança/Escopo
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Empresa opera apenas solicitações da própria empresa.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, empresa, permissao, seguranca
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/ui/login/login/menu-autenticado.ui.spec.ts; testes/ui/login/solicitar-acesso/solicitacoes-admin/permissao/acessar-modulo.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/permissao/acessar-modulo.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: undefined
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Empresa não acessa admin inteiro fora do escopo permitido, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Empresa acessa a tela ou endpoint necessário para iniciar Empresa não acessa admin inteiro fora do escopo permitido, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Empresa, selecionar contexto empresarial correto e executar a validação descrita no caso.

Resultado esperado:
A Empresa deve enxergar e atuar somente no próprio escopo, com bloqueio para qualquer dado de outra empresa.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Escopo empresarial permanece isolado e auditável.

### QC-REG-LS-119 - Empresa não visualiza dados administrativos fora do escopo

- Suite Qase: Regressão > Solicitações > Empresa
- Objetivo: Validar minimização de dados administrativos.
- Descrição detalhada: Validar minimização de dados administrativos. Esse ponto é crítico porque o perfil Empresa tem escopo restrito e não pode virar administrador global por acidente.
- Regra de negócio validada: Dados globais devem permanecer ocultos para Empresa.
- Perfil executor: Empresa
- Perfil afetado: Solicitações da própria empresa
- Tipo de teste: Segurança/Escopo
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Empresa opera apenas solicitações da própria empresa.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, empresa, seguranca
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/solicitacoes-admin/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts; testes/ui/login/login/menu-autenticado.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: undefined
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Empresa não visualiza dados administrativos fora do escopo, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Empresa acessa a tela ou endpoint necessário para iniciar Empresa não visualiza dados administrativos fora do escopo, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Empresa, selecionar contexto empresarial correto e executar a validação descrita no caso.

Resultado esperado:
A Empresa deve enxergar e atuar somente no próprio escopo, com bloqueio para qualquer dado de outra empresa.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Escopo empresarial permanece isolado e auditável.

### QC-REG-LS-120 - Solicitação aprovada pela Empresa deve manter vínculo correto com a empresa

- Suite Qase: Regressão > Solicitações > Empresa
- Objetivo: Validar vínculo empresarial após aprovação feita por Empresa.
- Descrição detalhada: Validar vínculo empresarial após aprovação feita por Empresa. Esse ponto é crítico porque o perfil Empresa tem escopo restrito e não pode virar administrador global por acidente.
- Regra de negócio validada: Usuário aprovado deve nascer vinculado à empresa correta.
- Perfil executor: Empresa
- Perfil afetado: Solicitações da própria empresa
- Tipo de teste: Funcional
- Camada: Manual
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Empresa opera apenas solicitações da própria empresa.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, empresa, aprovacao, usuario-empresa
- Status de automação: Candidato à automação
- Arquivo automatizado relacionado: Não localizado
- Comando de execução:

```bash
Não aplicável
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: undefined
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Solicitação aprovada pela Empresa deve manter vínculo correto com a empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Empresa acessa a tela ou endpoint necessário para iniciar Solicitação aprovada pela Empresa deve manter vínculo correto com a empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Empresa, selecionar contexto empresarial correto e executar a validação descrita no caso.

Resultado esperado:
A Empresa deve enxergar e atuar somente no próprio escopo, com bloqueio para qualquer dado de outra empresa.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Escopo empresarial permanece isolado e auditável.

### QC-REG-LS-121 - Usuário aprovado por Empresa deve entrar com escopo correto da empresa

- Suite Qase: Regressão > Solicitações > Empresa
- Objetivo: Validar login e escopo após aprovação empresarial.
- Descrição detalhada: Validar login e escopo após aprovação empresarial. Esse ponto é crítico porque o perfil Empresa tem escopo restrito e não pode virar administrador global por acidente.
- Regra de negócio validada: Login do usuário aprovado deve resolver a empresa correta.
- Perfil executor: Empresa
- Perfil afetado: Solicitações da própria empresa
- Tipo de teste: Segurança/Escopo
- Camada: Misto
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Empresa opera apenas solicitações da própria empresa.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, empresa, login, escopo
- Status de automação: Parcialmente automatizado
- Arquivo automatizado relacionado: testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts; testes/ui/login/solicitar-acesso/solicitacoes-admin/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/bd/solicitar-acesso/perfil-criado-igual-cadastro.bd.spec.ts --project=chromium --workers=1 --reporter=list
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: undefined
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Usuário aprovado por Empresa deve entrar com escopo correto da empresa, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Empresa acessa a tela ou endpoint necessário para iniciar Usuário aprovado por Empresa deve entrar com escopo correto da empresa, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Empresa, selecionar contexto empresarial correto e executar a validação descrita no caso.

Resultado esperado:
A Empresa deve enxergar e atuar somente no próprio escopo, com bloqueio para qualquer dado de outra empresa.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Escopo empresarial permanece isolado e auditável.

### QC-REG-LS-122 - Fluxo de escopo da Empresa deve usar pelo menos duas empresas distintas

- Suite Qase: Regressão > Solicitações > Empresa
- Objetivo: Validar isolamento com massa A/B.
- Descrição detalhada: Validar isolamento com massa A/B. Esse ponto é crítico porque o perfil Empresa tem escopo restrito e não pode virar administrador global por acidente.
- Regra de negócio validada: Teste de escopo exige duas empresas para provar ausência de vazamento.
- Perfil executor: Empresa
- Perfil afetado: Solicitações da própria empresa
- Tipo de teste: Segurança/Escopo
- Camada: UI
- Prioridade: Crítica
- Severidade/Risco: Alto
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Empresa opera apenas solicitações da própria empresa.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, empresa, escopo, seguranca
- Status de automação: Automatizado UI
- Arquivo automatizado relacionado: testes/ui/login/solicitar-acesso/solicitacoes-admin/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts
- Comando de execução:

```bash
npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --project=chromium --workers=1 --reporter=list
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: undefined
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para Fluxo de escopo da Empresa deve usar pelo menos duas empresas distintas, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Empresa acessa a tela ou endpoint necessário para iniciar Fluxo de escopo da Empresa deve usar pelo menos duas empresas distintas, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Empresa, selecionar contexto empresarial correto e executar a validação descrita no caso.

Resultado esperado:
A Empresa deve enxergar e atuar somente no próprio escopo, com bloqueio para qualquer dado de outra empresa.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Escopo empresarial permanece isolado e auditável.

### QC-REG-LS-123 - E-mails de aceite, alteração e recusa por ação da Empresa devem refletir status correto

- Suite Qase: Regressão > Solicitações > Empresa
- Objetivo: Validar comunicação quando Empresa atua como revisora.
- Descrição detalhada: Validar comunicação quando Empresa atua como revisora. Esse ponto é crítico porque o perfil Empresa tem escopo restrito e não pode virar administrador global por acidente.
- Regra de negócio validada: Ações empresariais devem notificar usuário público com status correto.
- Perfil executor: Empresa
- Perfil afetado: Solicitações da própria empresa
- Tipo de teste: Integração
- Camada: Manual
- Prioridade: Alta
- Severidade/Risco: Médio
- Pré-condições: Ambiente de testes disponível, servidor Playwright inicializado quando aplicável e massa de dados isolada para regressão.
- Massa de dados necessária: Usuários e solicitações de teste criados por seed, API ou formulário público; e-mails capturados em outbox JSONL quando o ambiente não usa e-mail real.
- Pós-condições: Massa criada durante o teste deve permanecer rastreável para auditoria ou ser descartável conforme rotina de limpeza do ambiente.
- Resultado esperado final: Empresa opera apenas solicitações da própria empresa.
- Evidências recomendadas: Print da tela validada, payload/resposta de API, outbox de e-mail e registro do status final quando aplicável.
- Tags: regressao, manual, solicitacoes, empresa, email, aprovacao, recusa, ajuste
- Status de automação: Candidato à automação
- Arquivo automatizado relacionado: Não localizado
- Comando de execução:

```bash
Não aplicável
```

- Observações técnicas: Caso manual preparado para execução no Qase; automação relacionada deve ser usada como evidência de cobertura, não como pré-requisito obrigatório.
- Riscos ou dependências de ambiente: undefined
- Critério de aceite: O caso é aceito quando todos os passos passam, o resultado final corresponde à regra de negócio e as evidências permitem reexecutar ou auditar o fluxo.

#### Passos detalhados

Passo 1:
Ação:
Preparar o ambiente e a massa de dados para E-mails de aceite, alteração e recusa por ação da Empresa devem refletir status correto, garantindo que o perfil executor esteja disponível e que não exista solicitação pendente conflitante.

Resultado esperado:
O ambiente deve estar acessível, a massa deve estar identificada e o QA deve conhecer o estado inicial antes de iniciar o fluxo.

Passo 2:
Ação:
Empresa acessa a tela ou endpoint necessário para iniciar E-mails de aceite, alteração e recusa por ação da Empresa devem refletir status correto, aguardando o carregamento completo e validando que está no fluxo correto.

Resultado esperado:
A interface ou API deve responder sem erro técnico e exibir os campos, ações ou contrato esperados para o perfil em execução.

Passo 3:
Ação:
Autenticar como Empresa, selecionar contexto empresarial correto e executar a validação descrita no caso.

Resultado esperado:
A Empresa deve enxergar e atuar somente no próprio escopo, com bloqueio para qualquer dado de outra empresa.

Passo 4:
Ação:
Consultar o estado resultante na tela, API, e-mail capturado, outbox ou banco, conforme a camada do teste.

Resultado esperado:
O status, as mensagens, os dados persistidos e as permissões devem refletir a regra de negócio prevista para o caso.

Passo 5:
Ação:
Registrar evidências da tela, resposta ou e-mail validado.

Resultado esperado:
Escopo empresarial permanece isolado e auditável.


## Mapeamento de automação

O mapeamento completo está detalhado na matriz e no relatório de cobertura. Em resumo, a automação atual cobre melhor:

- Esqueci Senha por perfil.
- Criação pública de Solicitar Acesso por perfil.
- Consulta pública por status.
- E-mails de solicitação recebida, aprovação e rejeição/recusa.
- Fluxo de ajustes com conversa, aprovação e login.
- Escopo da Empresa para visualização de solicitações da própria empresa.

## Recomendações para próximos passos

1. Confirmar a regra final do perfil Empresa na tela Solicitações, pois há automação indicando acesso negado ao módulo e outra validando acesso com escopo company.
2. Automatizar validações negativas de campos obrigatórios, e-mail inválido, senha fora do padrão e sessão expirada.
3. Separar explicitamente recusa e rejeição se a regra de produto tratar como ações diferentes.
4. Criar campos customizados no Qase antes de exigir filtros avançados por Perfil, Camada e Status de automação.
5. Vincular IDs Qase aos testes Playwright apenas após estabilizar o catálogo manual e decidir o padrão de anotação.

## Complemento - Documentação viva da pasta testes/

A sincronização completa desta etapa adicionou a regra de que o Qase é a documentação viva da pasta `testes/`.

- Definições de teste inventariadas: 456
- Cases técnicos criados/atualizados por `AUTO_DOC_ID`: 456
- Total de cases no Qase após sincronização: 579
- Run criada: Run - Regressão Quality Control - Alinhamento Repositório x Qase - 2026-06-21 (#1)
- Executados de verdade nesta etapa: 4
- Passed: 4
- Failed: 0
- Untested: 575

Detalhes completos:

- `docs/qase/inventario-testes-repositorio.md`
- `docs/qase/matriz-qase-vs-repositorio.md`
- `docs/qase/plano-teste-regressao-quality-control.md`
- `docs/qase/resultado-run-regressao-quality-control.md`
- `docs/qase/lacunas-repositorio-qase.md`

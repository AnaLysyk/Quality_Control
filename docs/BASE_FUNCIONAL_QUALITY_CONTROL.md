# Base funcional reaproveitavel do Quality Control

Este documento separa o que ja existe no repositorio e deve ser mantido como base inicial do produto.

A ideia aqui e evitar recomecar copiando tudo sem criterio. O projeto ja possui partes funcionando e alinhadas com o objetivo principal:

- Login
- Perfis
- Empresa
- Usuario da empresa
- Usuario TC
- Lider TC
- Suporte tecnico
- Repositorio de casos
- Plano de teste
- Runs / execucoes
- Dashboard

## 1. O que deve ser mantido

### 1.1 Estrutura principal do projeto

O repositorio `Quality_Control` ja esta montado como uma aplicacao Next.js com testes E2E em Playwright.

Manter:

```txt
package.json
playwright.config.ts
tests-e2e/
README.md
README.tech.md
docs/
```

Nao recomecar o projeto do zero sem antes preservar essa base.

## 2. Scripts que ja fazem sentido

O `package.json` ja contem comandos importantes para o fluxo de QA.

Manter principalmente:

```json
{
  "dev": "node scripts/dev-start.js --webpack",
  "dev:ci": "cross-env NEXT_DISABLE_FONT_DOWNLOAD=1 next dev --webpack -p 3100 -H 127.0.0.1",
  "test:e2e": "cross-env E2E_USE_JSON=1 playwright test",
  "test:e2e:smoke": "cross-env E2E_USE_JSON=1 playwright test --project=quality-smoke",
  "test:e2e:access": "cross-env E2E_USE_JSON=1 playwright test --project=quality-access",
  "test:e2e:cases": "cross-env E2E_USE_JSON=1 playwright test --project=quality-test-cases",
  "test:e2e:runs": "cross-env E2E_USE_JSON=1 playwright test --project=quality-runs",
  "test:e2e:dashboards": "cross-env E2E_USE_JSON=1 playwright test --project=quality-dashboards"
}
```

Esses comandos ja separam as partes principais do produto e combinam com a organizacao desejada.

## 3. Playwright ja configurado

O arquivo `playwright.config.ts` ja esta preparado para rodar os testes dentro de `tests-e2e`.

Ele tambem ja sobe o servidor local para teste usando:

```txt
npm run dev:ci:clean
```

E usa por padrao:

```txt
http://127.0.0.1:3100
```

Isso e bom porque deixa o E2E mais controlado e evita depender do ambiente aberto manualmente.

## 4. Login que ja funciona como base

O teste smoke ja valida login e carregamento da area administrativa.

Arquivo principal:

```txt
tests-e2e/smoke.spec.ts
```

Fluxo validado:

```txt
1. Define usuario mockado como admin
2. Faz login com admin@demo.test
3. Verifica redirecionamento para /admin/clients
4. Verifica tela de Gestao unificada
5. Verifica Lista de empresas
6. Consulta API /api/clients
```

Esse teste deve ser mantido como primeiro smoke do sistema.

## 5. Helper de autenticacao que deve ser mantido

Arquivo:

```txt
tests-e2e/utils/auth.ts
```

Ele ja centraliza login e criacao de sessao para os testes.

Responsabilidades importantes:

- Ler `PLAYWRIGHT_BASE_URL`
- Usar credenciais padrao de admin e usuario
- Chamar `/api/auth/login`
- Capturar cookies de sessao
- Adicionar cookies no contexto do Playwright
- Navegar para a pagina correta apos login

Esse arquivo deve ser mantido e simplificado aos poucos, se necessario.

## 6. Perfis que ja aparecem no ciclo de testes

Arquivo:

```txt
tests-e2e/case-repository-profile-cycle.spec.ts
```

Perfis ja mapeados:

```txt
Empresa
Suporte Tecnico
Lider TC
Usuario TC
Usuario da Empresa
```

No codigo, eles aparecem como:

```txt
empresa
technical_support
leader_tc
testing_company_user
company_user
```

Esse arquivo e muito importante porque ja representa exatamente a regra que queremos validar: cada perfil cria caso, plano e run dentro do seu contexto.

## 7. Repositorio de casos que ja existe no fluxo

O ciclo E2E ja acessa:

```txt
/casos-de-teste
```

E valida elementos como:

```txt
test-case-repository
test-case-new-button
test-case-create-modal
test-case-title-input
test-case-description-input
test-case-preconditions-input
test-case-add-step-button
test-case-save-button
test-case-list
test-case-detail
```

Isso mostra que o Repositorio de Casos ja existe como fluxo testavel.

## 8. Plano de teste que ja existe no fluxo

O ciclo E2E tambem acessa:

```txt
/empresas/{empresa}/planos-de-teste
```

E valida elementos como:

```txt
test-plan-repository
test-plan-new-button
test-plan-create-modal
test-plan-title-input
test-plan-description-input
test-plan-save-button
test-plan-list
test-plan-card
test-plan-detail
```

Isso deve ser mantido como base do modulo Plano de Teste.

## 9. Runs que ja existem no fluxo

O ciclo E2E acessa:

```txt
/empresas/{empresa}/runs
```

E valida elementos como:

```txt
test-run-repository
test-run-new-button
test-run-create-modal
test-run-title-input
test-run-plan-search-input
test-run-save-button
test-run-list
test-run-card
test-run-detail
test-run-linked-case
```

Isso deve ser mantido como base do modulo Runs / Execucoes.

## 10. Sincronizacao automatica de resultado de teste

A fixture de Playwright em:

```txt
tests-e2e/fixtures/test.ts
```

ja possui uma logica importante para transformar resultado do Playwright em resultado interno de run.

Ela identifica casos por tags como:

```txt
@case=TC-ALGUMA-COISA
```

E converte status do Playwright para status interno:

```txt
passed -> APROVADO
failed -> FALHA
interrupted -> BLOQUEADO
skipped/outros -> NAO_EXECUTADO
```

Essa parte e uma das mais valiosas do projeto, porque conecta automacao com gestao de teste.

## 11. Dashboard

O `package.json` ja possui comando especifico para dashboard:

```txt
npm run test:e2e:dashboards
```

Isso indica que o modulo Dashboard ja existe como recorte de teste.

A regra recomendada e:

- Dashboard nao deve nascer isolado
- Dashboard deve ler resultado de runs
- Runs devem nascer de planos
- Planos devem conter casos
- Casos devem pertencer a uma empresa/perfil

## 12. Ordem correta para continuar

A ordem segura para evoluir o projeto e:

```txt
1. Login
2. Perfis e permissoes
3. Empresa
4. Usuarios
5. Repositorio de casos
6. Plano de teste
7. Runs
8. Dashboard
```

## 13. O que nao trazer do projeto antigo

Nao trazer para esta base inicial:

```txt
Booking API
Via Expressa
Segunda Via
SMART
payloads grandes
massa sensivel
scripts antigos de Griaule
fluxos mutaveis sem necessidade
```

Esses fluxos podem virar conteudo futuro dentro do Repositorio de Casos, mas nao devem entrar como base estrutural do Quality Control.

## 14. Base final que fica

A base boa do projeto hoje e:

```txt
Next.js + Playwright
Login mockado/controlado
Perfis definidos
Empresa/contexto por slug
Repositorio de casos
Plano de teste
Runs
Dashboard
Sincronizacao de resultado do Playwright com run interna
Scripts E2E separados por modulo
```

Essa e a parte que deve ser preservada e organizada antes de qualquer nova feature.

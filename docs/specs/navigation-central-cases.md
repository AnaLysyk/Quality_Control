# Plano de Teste - Navegação Central de Casos

## Application Overview

Validar que os pontos de entrada "Casos" no módulo de automações direcionam para a rota canônica /casos-de-teste, sem regressão para a rota legada /automacoes/casos. Estado inicial sempre limpo (nova sessão), com autenticação simulada via helpers existentes do projeto.

## Test Scenarios

### 1. Navegação para Repositório Central de Casos

**Seed:** `tests-e2e/seed.spec.ts`

#### 1.1. Sidebar "Casos" navega para /casos-de-teste

**File:** `tests-e2e/navigation/sidebar-casos-central.spec.ts`

**Steps:**
  1. Setup: usar `test` de tests-e2e/fixtures/test.ts e autenticar usuário com acesso ao módulo usando simularAutenticacao de tests-e2e/helpers/simularAutenticacao.ts; abrir /automacoes/ui-studio (ou outra tela que renderize a sidebar do módulo).
    - expect: Sessão autenticada com sucesso.
    - expect: Sidebar do módulo de automações visível na tela.
    - expect: Link de texto "Casos" disponível na navegação lateral.
  2. Ação: clicar no item "Casos" da sidebar.
    - expect: Navegação concluída para a rota canônica /casos-de-teste.
    - expect: URL atual contém /casos-de-teste.
    - expect: URL atual não contém /automacoes/casos.
    - expect: Elemento raiz do repositório central de casos está visível (preferencialmente por data-testid já existente no repositório).
  3. Estratégia de seletores estáveis (guidance): priorizar localizadores por papel e nome acessível, com escopo da sidebar.
    - expect: Preferir: localizar `navigation` da sidebar e então `getByRole('link', { name: /^Casos$/ })` dentro desse escopo.
    - expect: Fallback textual: usar referência estável do bloco da sidebar (ex.: texto "QA IDE") para delimitar o container antes de clicar em "Casos".
    - expect: Evitar seletores por classe CSS/Tailwind e evitar nth-child.
    - expect: Se houver ambiguidade recorrente, recomendar adicionar data-testid no container da sidebar e no link "Casos".

#### 1.2. Atalho "Casos" do UI Studio navega para /casos-de-teste

**File:** `tests-e2e/navigation/ui-studio-casos-shortcut-central.spec.ts`

**Steps:**
  1. Setup: usar `test` de tests-e2e/fixtures/test.ts e autenticar com simularAutenticacao; abrir /automacoes/ui-studio em estado limpo.
    - expect: Página do UI Studio carregada com sucesso.
    - expect: Grupo de atalhos superior visível contendo "Casos", "Fluxo" e "Script".
  2. Ação: clicar no atalho "Casos" do UI Studio.
    - expect: Navegação concluída para /casos-de-teste.
    - expect: URL final confirma rota canônica.
    - expect: Garantir assertiva negativa: não navegar para /automacoes/casos.
    - expect: Tela do repositório central carregada e interativa.
  3. Estratégia de seletores estáveis (guidance): escopar o clique no bloco de atalhos do UI Studio para evitar colisão com o "Casos" da sidebar.
    - expect: Preferir localizar o container de atalhos pelo contexto (presença conjunta de links "Fluxo" e "Script") e clicar em `link[name="Casos"]` dentro dele.
    - expect: Quando disponível, priorizar data-testid dedicado no bloco de atalhos e no link "Casos".
    - expect: Evitar selecionar apenas por texto global sem escopo.
    - expect: Manter asserts de URL com `toHaveURL` para rota canônica e `not.toHaveURL` para rota legada.

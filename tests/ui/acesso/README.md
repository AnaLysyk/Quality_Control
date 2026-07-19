# Acesso relacional — E2E

Testes de navegador para validar a relação entre usuário, empresa e projeto no menu lateral do Quality Control.

## Casos cobertos

- Usuário TC multiempresa visualiza somente o projeto pertencente à empresa ativa.
- Ao trocar de empresa, o projeto anterior é removido e o projeto da nova empresa é carregado.
- Uma resposta atrasada da empresa anterior não sobrescreve o contexto atual.

## Executar isoladamente com navegador visível

```powershell
$env:E2E_USE_JSON="1"
$env:PLAYWRIGHT_HEADED="1"
npx playwright test testes/ui/acesso/relational-company-project-context.spec.ts --project=quality-access --headed
```

## Executar sem abrir o navegador

```powershell
$env:E2E_USE_JSON="1"
npx playwright test testes/ui/acesso/relational-company-project-context.spec.ts --project=quality-access
```

A massa é criada automaticamente pelo `globalSetup` e utiliza o usuário `e2e-relational-user@testingcompany.local`, vinculado às empresas `testing-company` e `empresa-e2e`.

# testes/api/solicitar-acesso/solicitacoes

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/api/solicitar-acesso/solicitacoes
```

## Arquivos e casos de teste

### `acoes-solicitacao.positivo.api.spec.ts` (e2e (playwright))

**Describe:** Solicitacoes de acesso - ciclos por perfil revisor

- ${reviewer.label} deve aprovar, enviar e-mail e liberar login
- ${reviewer.label} deve solicitar ajuste e receber dados corrigidos
- ${reviewer.label} deve recusar com motivo e enviar e-mail

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/api/solicitar-acesso/solicitacoes/acoes-solicitacao.positivo.api.spec.ts
```

### `listar-solicitacoes.positivo.api.spec.ts` (e2e (playwright))

**Describe:** Solicitacoes - permissao por perfil na API

- usuario nao autenticado deve receber 401
- ${perfil.label} deve acessar a API
- ${perfil.label} deve receber 403 na API

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/api/solicitar-acesso/solicitacoes/listar-solicitacoes.positivo.api.spec.ts
```

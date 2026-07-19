# testes/api/login/esqueci-senha

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/api/login/esqueci-senha
```

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/api/login/esqueci-senha
```

## Arquivos e casos de teste

### `esqueci-senha.endpoint.api.spec.ts` (e2e (playwright))

- endpoint nao revela se um email desconhecido esta cadastrado

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/api/login/esqueci-senha/esqueci-senha.endpoint.api.spec.ts
```

### `password-reset-token-expiration.test.ts` (unit/integracao (jest))

**Describe:** codigo de redefinicao enviado por e-mail

- expira apos 15 minutos

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/login/esqueci-senha/password-reset-token-expiration.test.ts
```

### `redefinir-senha-email.positivo.api.spec.ts` (e2e (playwright))

**Describe:** Redefinição de senha - identidade e fluxo real

- deve enviar e-mail com identidade, validar token, redefinir e preservar o perfil

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/api/login/esqueci-senha/redefinir-senha-email.positivo.api.spec.ts
```

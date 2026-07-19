# testes/ui/login/solicitar-acesso/perfis

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/ui/login/solicitar-acesso/perfis
```

## Arquivos e casos de teste

### `fluxo-ajustes-recusa.ui.spec.ts` (e2e (playwright))

**Describe:** Solicitacao de acesso - ajustes, conversa, aprovacao e recusa por perfil

- ${perfil.label} deve passar por 3 ajustes, conversa, aprovacao e login
- ${perfil.label} deve recusar solicitacao, enviar e-mail e bloquear login

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts
```

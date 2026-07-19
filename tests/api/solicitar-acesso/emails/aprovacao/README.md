# testes/api/solicitar-acesso/emails/aprovacao

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/api/solicitar-acesso/emails/aprovacao
```

## Arquivos e casos de teste

### `emails-aprovacao-perfis.api.spec.ts` (e2e (playwright))

**Describe:** E-mails de aprovação por perfil solicitado

- deve enviar e-mail aprovado para ${perfil.label}

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/api/solicitar-acesso/emails/aprovacao/emails-aprovacao-perfis.api.spec.ts
```

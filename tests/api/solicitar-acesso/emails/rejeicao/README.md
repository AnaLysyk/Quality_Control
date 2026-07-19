# testes/api/solicitar-acesso/emails/rejeicao

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/api/solicitar-acesso/emails/rejeicao
```

## Arquivos e casos de teste

### `emails-rejeicao-perfis.api.spec.ts` (e2e (playwright))

**Describe:** E-mails de rejeição por perfil solicitado

- deve enviar e-mail rejeitado para ${perfil.label}

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/api/solicitar-acesso/emails/rejeicao/emails-rejeicao-perfis.api.spec.ts
```

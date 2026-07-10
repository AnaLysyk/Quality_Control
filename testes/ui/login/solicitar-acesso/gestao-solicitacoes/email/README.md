# testes/ui/login/solicitar-acesso/gestao-solicitacoes/email

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/email
```

## Arquivos e casos de teste

### `capturar-e-reenviar-email-solicitacao.ui.spec.ts` (e2e (playwright))

**Describe:** Solicitações de acesso - ciclo de e-mail UI

- deve criar solicitação a partir da tela pública e capturar e-mail com detalhes
- deve bloquear duplicidade a partir da tela pública e não gerar novo e-mail
- deve solicitar reenvio do código por nome e e-mail

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/email/capturar-e-reenviar-email-solicitacao.ui.spec.ts
```

### `enviar-email-real.manual.ui.spec.ts` (e2e (playwright))

**Describe:** Solicitação pública de acesso com envio real de e-mail

- deve solicitar acesso real para ${profile.label}

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/email/enviar-email-real.manual.ui.spec.ts
```

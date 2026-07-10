# testes/api/solicitar-acesso/emails/solicitacao

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/api/solicitar-acesso/emails/solicitacao
```

## Arquivos e casos de teste

### `email-solicitacao.positivo.api.spec.ts` (e2e (playwright))

**Describe:** Solicitações de acesso - ciclo de e-mail API

- deve criar solicitação pública e capturar e-mail de recebimento com detalhes
- deve concluir o envio do e-mail inicial para Líder TC
- deve identificar pessoa e empresa sem exibir o rótulo genérico ao usuário empresarial
- não deve criar nova solicitação duplicada nem gerar novo e-mail
- deve reenviar o mesmo código somente por e-mail e responder de forma neutra

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/api/solicitar-acesso/emails/solicitacao/email-solicitacao.positivo.api.spec.ts
```

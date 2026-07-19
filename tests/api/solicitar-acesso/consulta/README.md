# testes/api/solicitar-acesso/consulta

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/api/solicitar-acesso/consulta
```

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/api/solicitar-acesso/consulta
```

## Arquivos e casos de teste

### `access-request-lookup-code-expiration.test.ts` (unit/integracao (jest))

**Describe:** codigo de consulta da solicitacao de acesso

- usa 15 minutos como tempo padrao de expiracao
- permite alterar o tempo de expiracao por variavel de ambiente
- identifica codigo expirado pelo horario configurado

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/solicitar-acesso/consulta/access-request-lookup-code-expiration.test.ts
```

### `access-request-lookup.test.ts` (unit/integracao (jest))

**Describe:** accessRequestLookup

- normalizes case and accents
- matches current triage values
- matches original requester values after triage changed the current data

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/solicitar-acesso/consulta/access-request-lookup.test.ts
```

### `consultar-status.positivo.api.spec.ts` (e2e (playwright))

**Describe:** Solicitações de acesso - consulta/status API

- deve consultar solicitação por accessKey e validar status, data e e-mail
- deve retornar erro para token inválido
- deve aprovar solicitação e consultar status aprovado
- deve recusar solicitação e consultar status recusado
- deve solicitar ajuste e consultar status ajuste necessário
- deve aceitar somente os campos solicitados e registrar o retorno para análise

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/api/solicitar-acesso/consulta/consultar-status.positivo.api.spec.ts
```

### `correcao-dados-email-consulta-fluxo.api.spec.ts` (e2e (playwright))

**Describe:** Solicitar acesso - correção de dados via e-mail

- deve enviar e-mail de ajuste, abrir consulta por chave e salvar dados corrigidos

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/api/solicitar-acesso/consulta/correcao-dados-email-consulta-fluxo.api.spec.ts
```

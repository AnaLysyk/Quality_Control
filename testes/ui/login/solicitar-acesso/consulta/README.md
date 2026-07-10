# testes/ui/login/solicitar-acesso/consulta

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/ui/login/solicitar-acesso/consulta
```

## Arquivos e casos de teste

### `consultar-status.ui.spec.ts` (e2e (playwright))

**Describe:** Solicitações de acesso - consulta/status UI

- deve consultar status e mostrar em análise com datas
- deve consultar manualmente por e-mail e token
- deve mostrar aprovado quando solicitação for aprovada
- deve mostrar recusado quando solicitação for recusada
- deve mostrar campos de correção quando houver ajuste

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts
```

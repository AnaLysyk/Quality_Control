# testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao
```

## Arquivos e casos de teste

### `validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts` (e2e (playwright))

**Describe:** Solicitações - acesso por perfil - UI

- ${perfil.label} deve fazer login e visualizar o módulo Solicitações
- ${perfil.label} deve fazer login sem acessar o módulo Solicitações
- Empresa deve acessar somente a tela Solicitações dentro do admin
- rota antiga /admin/requests deve redirecionar para Solicitações

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts
```

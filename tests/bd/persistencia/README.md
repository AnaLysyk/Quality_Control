# testes/bd/persistencia

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/bd/persistencia
```

## Arquivos e casos de teste

### `company-creation-persist.test.ts` (unit/integracao (jest))

- cria a empresa e persiste no PostgreSQL
- confirma que a empresa está no banco via SELECT independente
- confirma que a empresa aparece na listagem geral do banco

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/bd/persistencia/company-creation-persist.test.ts
```

### `company-record.test.ts` (unit/integracao (jest))

**Describe:** companyRecord persistence helpers

- preserves saved integrations from the integrations array when saving unrelated company details
- clears both current and legacy integration fields when all integrations are removed
- maps a legacy Qase project into qase_project_codes for older company records
- persists notifications_fanout_enabled when explicitly changed
- defaults notifications_fanout_enabled to true when missing

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/bd/persistencia/company-record.test.ts
```

### `permissoes-banco.test.ts` (unit/integracao (jest))

- 1. Criar override allow → persistido no banco
- 2. Criar override deny → persistido no banco
- 3. Atualizar override via upsert → sem duplicação de linha
- 4. Deletar override → linha removida do banco
- 5. Usuário sem override → getUserOverride retorna null
- 6. listUserOverrides retorna todos os overrides cadastrados
- 7. Allow + Deny na mesma linha → effectivePermissions aplica ambos
- 8. updatedBy gravado corretamente na tabela
- 9. Override mantém isolamento — outro usuário não é afetado
- 10. Após deletar override, usuário volta às permissões padrão do perfil

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/bd/persistencia/permissoes-banco.test.ts
```

### `seed-testing-company.test.ts` (unit/integracao (jest))

- cria ou reutiliza a empresa Testing Company
- cria Usuário Empresa vinculado como viewer
- cria Usuário Testing Company vinculado como viewer
- cria Líder TC vinculado como company_admin
- cria Suporte Técnico com role it_dev e global_admin
- confirma todos os registros no banco

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/bd/persistencia/seed-testing-company.test.ts
```

### `user-creation-profiles.test.ts` (unit/integracao (jest))

**Describe:** Perfil: Usuário Regular, Perfil: IT Developer (Desenvolvedor Global), Perfil: Admin Global, Perfil: Viewer (vinculado a empresa), Perfil: Administrador de Empresa (Company Admin), Perfil: Usuário Convidado (status=invited), Restrição: e-mail duplicado, Restricao: usuario duplicado

- cria o usuário com role=user e persiste no banco
- cria o usuário com role=it_dev, is_global_admin=true e persiste no banco
- cria o usuário com is_global_admin=true, globalRole=global_admin e persiste no banco
- cria o usuário, vincula como viewer e persiste no banco e na membership
- cria o usuário, vincula como company_admin e persiste no banco e na membership
- cria usuário com status=invited e persiste no banco
- lança DUPLICATE_EMAIL ao tentar criar dois usuários com o mesmo e-mail
- lanca DUPLICATE_USER ao tentar criar dois usuarios com o mesmo login
- lanca DUPLICATE_USER quando o login usa o e-mail de outro usuario

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/bd/persistencia/user-creation-profiles.test.ts
```

### `user-profiles-persist.test.ts` (unit/integracao (jest))

**Describe:** Perfil: Usuário Regular, Perfil: IT Developer, Perfil: Admin Global, Perfil: Viewer, Perfil: Company Admin, Perfil: Convidado (invited), Restrição: e-mail duplicado

- cria e persiste no banco (sem remoção)
- cria e persiste no banco (sem remoção)
- cria e persiste no banco (sem remoção)
- cria usuário + empresa + membership viewer, tudo persiste no banco
- cria usuário + empresa + membership company_admin, tudo persiste no banco
- cria e persiste no banco com status=invited (sem remoção)
- lança DUPLICATE_EMAIL ao tentar criar dois usuários com o mesmo e-mail

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/bd/persistencia/user-profiles-persist.test.ts
```

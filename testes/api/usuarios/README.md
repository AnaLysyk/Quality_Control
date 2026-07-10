# testes/api/usuarios

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/api/usuarios
```

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/api/usuarios
```

## Arquivos e casos de teste

### `admin-user-profiles-classification.test.ts` (unit/integracao (jest))

**Describe:** admin user profile classification

- classifies the institutional company account as Empresa
- classifies company-created users as Usuario da empresa
- keeps linked Testing Company users separated from company-created users
- preserves Lider TC as its own permission/profile kind
- preserves Suporte Tecnico as its own permission/profile kind
- gives global admin precedence over the technical support role

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/usuarios/admin-user-profiles-classification.test.ts
```

### `admin-users-id-route-permissions.test.ts` (unit/integracao (jest))

**Describe:** admin users [id] API permissions

- permite GET direto quando a matriz efetiva tem users:view
- bloqueia GET direto sem users:view
- permite promover perfil privilegiado quando a matriz tem users:edit e permissions:edit
- permite DELETE direto para perfil nao privilegiado quando a matriz tem users:delete

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/usuarios/admin-users-id-route-permissions.test.ts
```

### `dados-alterados-combo-campos.api.spec.ts` (e2e (playwright))

**Describe:** Dados Alterados - combo de campos do usuário

- deve criar, alterar e validar todos os campos editáveis do usuário

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/api/usuarios/dados-alterados-combo-campos.api.spec.ts
```

### `edit-user-profiles.test.ts` (unit/integracao (jest))

- Regular: edita nome, email e telefone
- IT Dev: edita job_title e linkedin_url
- Admin Global: rebaixa para usuário normal (is_global_admin=false)
- Viewer: promove membership de viewer para company_admin
- CompAdmin: desativa conta (active=false, status=blocked)
- Convidado: ativa conta mudando status de invited para active
- Regular: promove role de user para it_dev com is_global_admin
- rejeita edição com e-mail já cadastrado para outro usuário
- retorna null ao tentar editar usuário com id inexistente
- edita múltiplos campos do usuário em uma única operação
- rejeita edicao com usuario ja cadastrado para outro usuario

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/usuarios/edit-user-profiles.test.ts
```

### `notas-usuario.test.ts` (unit/integracao (jest))

- cria nota 1 — rascunho, prioridade baixa
- cria nota 2 — em andamento, prioridade alta, com tags
- cria nota 3 — urgente, cor sky
- confirma que as 3 notas foram criadas para o usuário
- deleta a nota 2
- confirma que nota 1 e nota 3 permanecem após deletar nota 2
- edita nota 1 — altera título, conteúdo, status e prioridade
- confirma que a edição da nota 1 foi persistida no banco

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/usuarios/notas-usuario.test.ts
```

### `user-delete-profiles.test.ts` (unit/integracao (jest))

**Describe:** Perfil: Usuário Regular, Perfil: IT Developer (Desenvolvedor Global), Perfil: Admin Global, Perfil: Viewer (vinculado a empresa), Perfil: Administrador de Empresa, Perfil: Convidado (status=invited), Empresa Instituição

- cria 2, deleta o primeiro, verifica que o segundo permanece ativo
- cria 2, deleta o primeiro, verifica que o segundo permanece ativo
- cria 2, deleta o primeiro, verifica que o segundo permanece ativo
- cria 2 viewers, deleta o primeiro, verifica que o segundo e a membership permanecem
- cria 2 company_admins, deleta o primeiro, verifica que o segundo e a membership permanecem
- cria 2 convidados, deleta o primeiro, verifica que o segundo permanece invited
- verifica que a instituição foi criada e persiste no banco
- cria 2 usuários vinculados como viewer, deleta o primeiro, o segundo permanece ativo
- cria 2 admins da instituição, deleta o primeiro, o segundo permanece como company_admin
- usuário deletado da instituição não aparece como ativo (simulação de listagem)

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/usuarios/user-delete-profiles.test.ts
```

### `user-scope-policy.test.ts` (unit/integracao (jest))

**Describe:** user scope policy

- keeps company scope isolated without replacing permission matrix
- normalizes legacy role aliases into scoped profiles
- allows user TC to manage users only inside linked companies
- keeps technical support global for maintenance without creation rights
- keeps leader TC global for institutional administration
- keeps technical support global for maintenance without creation rights
- keeps leader TC global for institutional administration

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/usuarios/user-scope-policy.test.ts
```

### `usuarios-access.test.ts` (unit/integracao (jest))

**Describe:** acesso da feature de usuarios

- permite gestao completa para Lider TC
- permite gestao completa para Suporte Tecnico conforme matriz central
- respeita uma matriz explicita de permissoes
- nega acesso quando nao existe usuario autenticado

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/usuarios/usuarios-access.test.ts
```

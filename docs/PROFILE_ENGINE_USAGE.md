# Profile Engine — Guia de Uso

## Introdução

A Profile Engine é um sistema unificado para editar perfis (usuários, empresas, etc.) com permissões granulares, auditoria e reutilização de componentes.

**Ideia Principal**: Uma única tela de perfil, múltiplas rotas, contexto dinâmico.

## Como Usar

### 1. Acessar um Perfil

```typescript
// Meu perfil (usuário)
/profile?type=user&id=self

// Perfil de outro usuário
/profile?type=user&id=abc123

// Perfil de empresa
/profile?type=company&id=acme-corp
```

### 2. Criar um Componente que usa ProfileContext

```typescript
"use client";

import { useProfileContext, useProfileAction } from "@/lib/profile";

export function MyProfileComponent() {
  const context = useProfileContext();
  const canEdit = useProfileAction("edit");

  // Se não tiver permissão, não renderiza
  if (!canEdit) {
    return <p>Sem permissão para editar</p>;
  }

  return (
    <div>
      {/* Renderizar baseado em context.mode */}
      {context.mode === "edit" && <button>Salvar</button>}
    </div>
  );
}
```

### 3. Renderizar Seções Condicionalmente

```typescript
import { useProfileContext } from "@/lib/profile";

export function CompanyUsers() {
  const { visibleTabs } = useProfileContext();

  // Renderizar apenas se "users" estiver em visibleTabs
  if (!visibleTabs.includes("users")) {
    return null;
  }

  return <div>Lista de usuários...</div>;
}
```

### 4. Criar um Formulário que Respeita Permissões

```typescript
import { COMPANY_PROFILE_FIELDS } from "@/lib/profile/fieldPermissions";
import { isFieldEditable, isFieldVisible } from "@/lib/profile/fieldPermissions";
import { useProfileContext } from "@/lib/profile";

export function CompanyProfileForm() {
  const context = useProfileContext();

  return (
    <form>
      {COMPANY_PROFILE_FIELDS.map((field) => {
        // Pular campos não visíveis nesse modo
        if (!isFieldVisible(field, context.mode, COMPANY_PROFILE_FIELDS)) {
          return null;
        }

        // Marcar campo como readonly se não editable
        const editable = isFieldEditable(
          field,
          context.mode,
          COMPANY_PROFILE_FIELDS,
          context.permissions,
        );

        return (
          <input
            key={field.name}
            type={field.inputType}
            disabled={!editable}
            required={field.required && context.mode !== "view"}
          />
        );
      })}
    </form>
  );
}
```

## Conceitos Principais

### ProfileRuntimeContext

Estrutura que decide tudo:

```typescript
{
  entityType: "user" | "company",        // O que está sendo editado
  entityId: string,                       // ID da entidade
  mode: "self" | "view" | "edit" | "admin-edit" | "create",
  viewer: AuthUser,                       // Quem está vendo
  target: AuthUser | Company,             // O que está sendo visto
  permissions: ProfilePermissions,        // Flags de permissão
  visibleTabs: ProfileTab[],              // Abas que aparecem
  scope: {
    allowedCompanyIds: string[],
    isSelfProfile: boolean,
    isSameCompany: boolean,
  },
}
```

### ProfilePermissions

18 flags booleanas que indicam se o viewer pode fazer algo:

```typescript
{
  canView: boolean,
  canEdit: boolean,
  canDelete: boolean,
  canManagePermissions: boolean,
  canManageCompanyLinks: boolean,
  canManageIntegrations: boolean,
  canViewAudit: boolean,
  canImpersonatePreview: boolean,
  canBlockUnblock: boolean,
  canResetPassword: boolean,
  canResendInvite: boolean,
  canDeactivate: boolean,
  canArchive: boolean,
  canManageApplications: boolean,
  canManageUsers: boolean,
  canEditByField: Record<string, boolean>, // por campo
}
```

### Modes

- **"self"**: Usuário editando sua própria conta
- **"view"**: Visualizando perfil (read-only)
- **"edit"**: Editando perfil com permissões normais
- **"admin-edit"**: Editando com poderes de admin (campos extras)
- **"create"**: Criando novo usuário/empresa

## API Endpoints

Todos retornam `{ ...entity, context: ProfileRuntimeContext }`

### GET /api/profile/users/[userId]
```bash
curl http://localhost:3000/api/profile/users/abc123
# Retorna: { id, name, email, avatar, context }
```

### PATCH /api/profile/users/[userId]
```bash
curl -X PATCH http://localhost:3000/api/profile/users/abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@example.com",
    "reason": "Atualização de dados"
  }'
# Retorna: { id, name, email, context, audit }
```

### GET /api/profile/companies/[companyId]
```bash
curl http://localhost:3000/api/profile/companies/acme-corp
# Retorna: { id, name, slug, taxId, context }
```

### PATCH /api/profile/companies/[companyId]
```bash
curl -X PATCH http://localhost:3000/api/profile/companies/acme-corp \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "taxId": "12.345.678/0001-90"
  }'
# Retorna: { id, name, slug, context, audit }
```

## Hooks Disponíveis

### useProfileContext()
```typescript
const context = useProfileContext();
// Retorna ProfileRuntimeContext ou throw se fora de <ProfileProvider>
```

### useProfileAction(action: string)
```typescript
const canEdit = useProfileAction("edit");
const canDelete = useProfileAction("delete");
// Retorna boolean baseado em context.permissions
```

### useProfileTabs()
```typescript
const visibleTabs = useProfileTabs();
// Retorna ProfileTab[] filtrada por permissão
```

### useDangerZone()
```typescript
const showDangerZone = useDangerZone();
// Retorna boolean se deve mostrar botões perigosos
```

### useProfileMode()
```typescript
const mode = useProfileMode();
// Retorna "self" | "view" | "edit" | "admin-edit" | "create"
```

## Checklist: Adicionar Nova Tela/Seção

- [ ] Renderizar dentro de `<ProfileProvider context={...}>`
- [ ] Usar `useProfileContext()` para tomar decisões
- [ ] Verificar `visibleTabs` antes de renderizar seção
- [ ] Respeitar `isFieldEditable()` para cada campo
- [ ] Logar auditoria em PATCH/DELETE
- [ ] Validar com Zod antes de enviar
- [ ] Mostrar status de carregamento
- [ ] Capturar erros e mostrar ao usuário

## Exemplo Completo: Componente com Formulário

```typescript
"use client";

import { useProfileContext, useProfileAction } from "@/lib/profile";
import { COMPANY_PROFILE_FIELDS, isFieldEditable } from "@/lib/profile/fieldPermissions";

export function CompanyProfileSection() {
  const context = useProfileContext();
  const canEdit = useProfileAction("edit");

  if (!context.visibleTabs.includes("profile")) {
    return null;
  }

  return (
    <div className="rounded-lg border p-6">
      <h2 className="text-xl font-bold mb-4">Dados da Empresa</h2>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);

          const response = await fetch(
            `/api/profile/companies/${context.entityId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(Object.fromEntries(formData)),
            },
          );

          if (response.ok) {
            alert("Salvo!");
          } else {
            alert("Erro ao salvar");
          }
        }}
      >
        {COMPANY_PROFILE_FIELDS.map((field) => {
          const editable = isFieldEditable(
            field,
            context.mode,
            COMPANY_PROFILE_FIELDS,
            context.permissions,
          );

          return (
            <div key={field.name} className="mb-4">
              <label className="block text-sm font-semibold mb-2">
                {field.label}
                {field.required && <span className="text-red-500">*</span>}
              </label>
              <input
                name={field.name}
                type={field.inputType}
                disabled={!editable}
                required={field.required && editable}
                className="w-full rounded border p-2 disabled:bg-gray-100"
              />
            </div>
          );
        })}

        {canEdit && (
          <button
            type="submit"
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            Salvar
          </button>
        )}
      </form>
    </div>
  );
}
```

## Troubleshooting

**"useProfileContext() called outside <ProfileProvider>"**
- Verificar que o componente está dentro de `<ProfileProvider>`

**Permissões não funcionando**
- Verificar `ProfilePermissions` estão corretas em `contextBuilder.ts`
- Testar em browser: `context.permissions` deve ter `canEdit: true|false`

**Abas não aparecem**
- Verificar `visibleTabs` em context
- Pode ser que a permissão de `view` está bloqueada

**Campos não aparecem**
- Verificar `COMPANY_PROFILE_FIELDS` ou `USER_PROFILE_FIELDS`
- Campo pode estar setado com `visibleIn: ["admin-edit"]` mas mode é `"view"`

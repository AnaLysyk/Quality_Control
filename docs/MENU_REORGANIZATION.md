# Menu Reorganization — Implementation Guide

## Overview
This guide describes how to implement the menu reorganization changes, including permission checks, query parameter actions, and test data.

## 1. Query Parameter Actions

### 1.1 Focus Search Action
**Used by**: Empresas > Buscar, Chat > Buscar Conversa

**URL Pattern**: `/path?focus=search`

**Implementation**:
```typescript
"use client";

import { useEffect } from "react";

export default function SearchPage() {
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("focus") === "search") {
      // Find the search input element
      const searchInput = document.querySelector('[data-testid="company-search-input"]');
      if (searchInput && searchInput instanceof HTMLInputElement) {
        searchInput.focus();
      }
    }
  }, []);

  return (
    // Your search page content
  );
}
```

### 1.2 Open Create Modal Action
**Used by**: Empresas > Criar, Suporte > Abrir chamado, Usuários > Criar *

**URL Pattern**: `/path?modal=create&role=<role_type>`

**Implementation**:
```typescript
"use client";

import { useEffect, useState } from "react";

export default function ListingPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("modal") === "create") {
      setShowCreateModal(true);
    }
  }, []);

  const handleCloseModal = () => {
    setShowCreateModal(false);
    // Clean up query param
    window.history.replaceState({}, "", window.location.pathname);
  };

  return (
    <>
      {/* Listing content */}
      {showCreateModal && (
        <CreateModal onClose={handleCloseModal} rolePreset={searchParams.get("role")} />
      )}
    </>
  );
}
```

## 2. Backend Permission Guards

### 2.1 API Route Guard
All API routes must check permissions before responding. Use the permission check pattern:

```typescript
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { canAccessResource } from "@/lib/navigation/navigationPermissions";

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Check resource-level permission
  if (!canAccessResource(user.role, "empresas")) {
    return new Response("Forbidden", { status: 403 });
  }

  // Return data
}
```

### 2.2 Page-level Guard
Wrap sensitive pages with permission checks:

```typescript
import { RequireCapability } from "@/app/components/RequireCapability";

export default function AdminPage() {
  return (
    <RequireCapability capability="admin">
      {/* Admin content */}
    </RequireCapability>
  );
}
```

## 3. Menu Item Visibility

The visibility is controlled at two levels:

### 3.1 Frontend (Navigation Catalog)
- Defined in `lib/navigation/navigationCatalog.ts`
- `allowedRoles` field on each NavModuleDef and NavItemDef
- Filtered by `navigationPermissions.ts` when rendering

### 3.2 Backend (API Routes)
- Each API must independently verify permissions
- Never trust frontend-only role hiding
- Return 403 Forbidden if user lacks permission

## 4. Data TestIds

All menu items have testIds for E2E testing:
- **Format**: `nav-{module}-{item}` (e.g., `nav-companies-list`)
- **Usage**: Used in Playwright tests to verify visibility and navigation

Example test:
```typescript
test("líder TC should see Empresas menu", async ({ page }) => {
  // Login as líder TC
  await login(page, "leader_tc_user");
  
  // Check that Empresas is visible
  const empresasMenu = page.getByTestId("nav-companies");
  await expect(empresasMenu).toBeVisible();
  
  // Click and verify submenu
  await empresasMenu.click();
  const empresasLista = page.getByTestId("nav-companies-list");
  await expect(empresasLista).toBeVisible();
});
```

## 5. Role Matrix Summary

### 5.1 System Users (SYSTEM_USERS)
- `leader_tc` — Full access to all modules
- `technical_support` — Access to operations, admin, support
- `testing_company_user` — Access to test repos, automation, quality

### 5.2 Institutional Users (INSTITUTIONAL_USERS)
- `empresa` — Access to own institutional context (company admin)
- `company_user` — Access to own institutional context (regular user)

### 5.3 Access Rules
| Module | leader_tc | tech_support | user_tc | empresa | company_user |
|--------|:---------:|:------------:|:-------:|:-------:|:------------:|
| Empresas | ✅ | ✅ | ✅ | ❌ | ❌ |
| Operações | ✅ | ✅ | ✅ | ✅ | ✅ |
| Op. Buscar | ✅ | ✅ | ❌ | ❌ | ❌ |
| Repositório | ✅ | ✅ | ✅ | ✅ | ✅ |
| Automação | ✅ | ✅ | ✅ | ❌ | ❌ |
| Suporte | ✅ | ✅ | ✅ | ✅ | ✅ |
| Chat | ✅ | ✅ | ✅ | ✅ | ✅ |
| Brain | ✅ | ✅ | ✅ | ✅ | ✅ |
| Documentos | ✅ | ✅ | ✅ | ✅ | ✅ |
| Usuários | ✅ | ✅ | ❌ | ❌ | ❌ |
| Admin | ✅ | ✅ | ❌ | ❌ | ❌ |

## 6. Removed Items

The following items were removed from the menu as they created duplicate contexts:

### From Quality/Test Repository
- Releases
- Cobertura (Coverage)
- Evidências (Evidence)

### From Support
- Meus chamados (My Tickets)
- Chamados (All Tickets — replaced by Andamento)
- Solicitações de acesso (Access Requests)
- Solicitações de perfil (Profile Requests)
- Base de conhecimento (Knowledge Base)

### From Brain/IA
- Assistente da empresa (Company Assistant)
- Brain Admin
- Memórias (Memories)
- Contexto atual (Current Context)

### From Documents
- Documentos da empresa (Company Documents)
- Documentação técnica (Technical Docs)
- Evidências (Evidence)
- Exportações (Exports)

These items will be consolidated into existing modules or removed entirely based on future requirements.

## 7. Files Changed

1. **lib/navigation/navigationCatalog.ts** — Restructured menu, added testIds and actions
2. **app/components/navigation/SidebarSection.tsx** — Use catalog testIds
3. **app/components/navigation/SidebarFlyout.tsx** — Use catalog testIds
4. **middleware.ts** — NEW: Basic route permission checking
5. **app/operacoes/dashboard/page.tsx** — NEW: Redirect wrapper
6. **app/operacoes/metricas/page.tsx** — NEW: Redirect wrapper
7. **app/operacoes/buscar/page.tsx** — NEW: Redirect wrapper
8. **app/suporte/page.tsx** — NEW: Redirect wrapper
9. **app/suporte/kanban/page.tsx** — NEW: Redirect wrapper
10. **app/brain/perguntar/page.tsx** — NEW: Redirect wrapper
11. **app/documentos/repositorio/page.tsx** — NEW: Redirect wrapper
12. **app/admin/permissoes/page.tsx** — NEW: Redirect wrapper

## 8. Next Steps

1. ✅ Update navigationCatalog.ts with new structure
2. ✅ Add data-testids to all menu items
3. ✅ Create route wrappers and redirects
4. ⏳ Implement focusSearch action in search pages
5. ⏳ Implement openCreateModal action in listing pages
6. ⏳ Add backend permission guards to all APIs
7. ⏳ Create E2E test suite for menu visibility and permissions
8. ⏳ Test with all 5 user roles
9. ⏳ Verify no unauthorized access via direct URL manipulation

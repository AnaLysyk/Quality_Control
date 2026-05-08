# Layout Especificação — Quality Control

## 📐 Arquitetura Visual

### Desktop (≥1024px)
```
┌─────────────────────────────────────────────────────┐
│ AppShell                                            │
├──────┬───────────────────────────────────────────────┤
│      │                                               │
│ Side │  Main Content Area                            │
│ bar  │  (página renderiza aqui)                      │
│      │                                               │
│ 72px │                                               │
│ or   │  - Responde ao zoom (rem-based)               │
│ 288px│  - Margin/padding proporcional                │
│      │  - Scroll independente se necessário          │
│      │                                               │
└──────┴───────────────────────────────────────────────┘
```

**Componentes:**
- `<Sidebar />` → flex-shrink-0, width: 72px (collapsed) ou 288px (expanded)
- `<main>` → flex-1, overflow-y-auto, responde a zoom
- Transição suave: `transition-all duration-300`

### Mobile/Tablet (<1024px)
```
┌─────────────────────────────────────┐
│ Header com menu icon                │
├─────────────────────────────────────┤
│                                     │
│ Main Content Area                   │
│ (full width)                        │
│                                     │
├─────────────────────────────────────┤
│ Sidebar → modal overlay quando abrir│
│ (position: fixed, z-50)             │
└─────────────────────────────────────┘
```

## 🎯 Menu Lateral (Sidebar)

### Estado Expandido (288px)
- **Header:** Logo + "Testing Company / Quality Control" + collapse button
- **Favorites:** Seção "Favoritos" com lista de bookmarks (removível)
- **Navigation:** Módulos acordeão
  - Cada módulo tem: ícone + label + chevron
  - Click no módulo → abre/fecha submenu
  - Submenu indentado com `ml-4 border-l border-white/10 pl-3`
- **Mobile:** Header com close button

### Estado Colapsado (72px)
- **Header:** Apenas logo icon + chevron
- **Favorites:** Bookmark icon, hover → flyout com lista
- **Navigation:** Icon buttons, hover → flyout panel
  - Flyout position: fixed, left: 76px, top: calculado
  - Auto-close em 150ms após mouseleave
- **Mobile:** Não afeta (desktop só)

## 🗂️ Estrutura de Módulos

### Home
- `/home` → Home pessoal
- `/admin/home` → Home admin (LEADER_TC, TECHNICAL_SUPPORT)

### Empresas (ALL_INTERNAL)
- `/admin/clients` → Lista de empresas
- `/empresas` → Listar empresas do usuário
- `/empresas/[slug]/home` → Home da empresa
- `/empresas/[slug]/dashboard` → Dashboard empresa
- `/empresas/[slug]/aplicacoes` → Apps
- `/empresas/[slug]/planos-de-teste` → Planos de teste
- `/empresas/[slug]/runs` → Runs da empresa
- `/empresas/[slug]/defeitos` → Defeitos
- `/empresas/[slug]/chamados` → Suporte/chamados
- `/empresas/[slug]/releases` → Releases

### Operações (ALL_INTERNAL)
- `/admin/dashboard` → Dashboard operacional
- `/admin/runs` → Todas runs
- `/admin/test-metric` → Métricas
- `/kanban-it` → Kanban IT
- `/admin/audit-logs` → Audit logs (PRIVILEGED)

### Qualidade
- `/automacoes/casos` → Casos de teste
- `/runs` → Meus runs / runs da empresa
- `/admin/releases` → Releases globais

### Automações (ALL_INTERNAL)
**Submódulos:**
- `/automacoes/casos` → Casos de teste
- `/automacoes/execucoes` → Execuções
- `/automacoes/fluxos` → Fluxos
- `/automacoes/scripts` → Scripts
- `/automacoes/tools` → Ferramentas
- `/automacoes/playwright` → Playwright
- `/automacoes/ui-studio` → UI Studio
- `/automacoes/logs` → Logs

### Suporte
- `/meus-chamados` → Meus chamados
- `/chamados` ou `/empresas/[slug]/chamados` → Chamados da empresa
- `/admin/access-requests` → Solicitações de acesso (TODOS)
- `/admin/docs` → Documentação

### Brain / IA
- `/chat` → Chat assistente (TODOS têm acesso)
- `/admin/brain` → Brain admin (PRIVILEGED)

### Admin (LEADER_ONLY)
- `/admin/users/permissions` → Gerenciar usuários e permissões
- `/admin/audit-logs` → Audit logs
- `/integrations` → Integrações
- `/settings` → Configurações

## 👥 Perfis & Permissões

| Perfil | Home | Empresas | Operações | Automações | Suporte | Brain | Admin |
|--------|------|----------|-----------|-----------|---------|-------|-------|
| **EMPRESA** | Home | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ |
| **COMPANY_USER** | Home | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ |
| **TESTING_COMPANY_USER** | Home + Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| **TECHNICAL_SUPPORT** | Home + Admin | ✓ | ✓ | ✓ | ✓ | ✓ | Parcial |
| **LEADER_TC** | Home + Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**Chat:** Todos têm acesso (sem restrição)

## 📱 Responsividade

### Breakpoints (Tailwind)
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px (Sidebar muda para desktop)
- `xl`: 1280px
- `2xl`: 1536px

### Sidebar
- `<lg` → Hidden, modal overlay ao clicar menu icon
- `≥lg` → Fixed sidebar à esquerda

### Main Content
- Padding: `p-4 sm:p-6 md:p-8`
- Max-width: não restringir (full width flexível)
- Font sizes: `rem-based` (responde ao zoom)

## 🎨 Cores & Tokens

- **Sidebar:** `bg-[linear-gradient(180deg,#011848_0%,#082457_42%,#3a1530_72%,#ef0001_100%)]`
- **Text:** `text-white`, `text-white/85` (hover), `text-white/35` (labels)
- **Hover:** `hover:bg-white/10`, `hover:text-white`
- **Active:** `bg-white/16`
- **Borders:** `border-white/10`

## 🔄 Transições

- Sidebar collapse/expand: `transition-[width] duration-300`
- Menu item hover: `transition-colors duration-150`
- Flyout menu: `transition-opacity duration-150`

## ⚙️ Implementação

### Componentes
1. `<AppShell>` → layout container + mobile header
2. `<Sidebar>` → lateral navigation (colapsível)
3. `<SidebarHeader>` → logo + toggle
4. `<SidebarFavorites>` → favoritos secção
5. `<SidebarSection>` (expanded) → acordeão de módulos
6. `<SidebarFlyout>` (collapsed) → hover flyout
7. `<SidebarItem>` → link individual

### Hooks
- `useSidebarState()` → collapsed, toggleCollapsed, openSections, toggleSection
- `useNavigationItems()` → modules filtered by role
- `useActiveNavigation()` → activeModule, isItemActive
- `useFavorites()` → favorites, addFavorite, removeFavorite

### LocalStorage
- `qc:sidebar:collapsed` → boolean
- `qc:sidebar:sections` → Set<string> (open modules)
- `qc:favorites` → FavoriteItem[] (fallback)

## 🚀 User Flows

### Flow 1: Líder TC navega módulos
1. Click em Operações → abre submenu
2. Click em Dashboard → navegra a `/admin/dashboard`
3. Página carrega ao lado do menu
4. Líder colapsável o menu → view amplo do content
5. Click em Metrics → accordion se fecha, Dashboard item deseleciona
6. Navegra a `/admin/test-metric`

### Flow 2: Usuário empresa acessa suporte
1. Usuário na empresa ACME
2. Menu mostra: Home, Empresas (com ACME expandido), Suporte, Brain
3. Click em Suporte → abre submenu
4. Click em Chamados → navega `/empresas/acme/chamados`
5. View mostra chamados da empresa

### Flow 3: Assistente global
1. Qualquer usuário → Chat (no menu Brain)
2. Click em "Assistente (Global)" → `/chat`
3. Sem restrição, todos conversam


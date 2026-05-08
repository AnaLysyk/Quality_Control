# 🧪 Guia de Testes — Navegação & Menu

## ✅ Checklist de Testes

### 1. **Sidebar Renderização**
- [ ] Menu aparece à esquerda (288px expandido)
- [ ] Logo TC com texto "Testing Company / Quality Control" visível
- [ ] Ícones de módulos carregam corretamente
- [ ] Chevron de collapse está presente

### 2. **Estados do Sidebar**
- [ ] Click no chevron → sidebar collapsa (72px)
- [ ] Click novamente → expande (288px)
- [ ] Transição suave 300ms
- [ ] Width muda com suavidade

### 3. **Módulos Acordeão**
- [ ] Click em "Empresas" → submenu abre/fecha
- [ ] Chevron gira 180° ao abrir
- [ ] Itens aparecem indentados com border esquerdo
- [ ] Múltiplos módulos podem estar abertos

### 4. **Navegação de Rotas**
Para cada módulo + item abaixo, testar:

**HOME**
- [ ] "Início" → `/home` (todos veem)
- [ ] "Dashboard Admin" → `/admin/home` (TC only)

**EMPRESAS**
- [ ] "Listar empresas" → `/admin/clients` (TC only)
- [ ] "Empresa ativa" → `/empresas/[slug]/home` (com slug dinâmico)
- [ ] "Aplicações" → `/empresas/[slug]/aplicacoes`
- [ ] "Planos de teste" → `/empresas/[slug]/planos-de-teste`
- [ ] "Runs" → `/empresas/[slug]/runs`
- [ ] "Defeitos" → `/empresas/[slug]/defeitos`

**OPERAÇÕES**
- [ ] "Dashboard" → `/admin/dashboard` (TC only)
- [ ] "Runs" → `/admin/runs` (TC only)
- [ ] "Métricas" → `/admin/test-metric` (TC only)
- [ ] "Kanban" → `/kanban-it` (TC only)
- [ ] "Audit Logs" → `/admin/audit-logs` (TECHNICAL_SUPPORT + LEADER_TC)

**AUTOMAÇÕES**
- [ ] "Casos de Teste" → `/automacoes/casos` (TC only)
- [ ] "Execuções" → `/automacoes/execucoes` (TC only)
- [ ] "Fluxos" → `/automacoes/fluxos` (TC only)
- [ ] "Scripts" → `/automacoes/scripts` (TC only)
- [ ] "Ferramentas" → `/automacoes/tools` (TC only)
- [ ] "Playwright" → `/automacoes/playwright` (TC only)
- [ ] "UI Studio" → `/automacoes/ui-studio` (TC only)
- [ ] "Logs" → `/automacoes/logs` (TC only)

**SUPORTE**
- [ ] "Meus chamados" → `/meus-chamados` (todos)
- [ ] "Chamados" → `/chamados` (todos)
- [ ] "Solicitações de acesso" → `/admin/access-requests` (todos)
- [ ] "Base de conhecimento" → `/admin/docs` (todos)

**BRAIN**
- [ ] "Assistente (Global)" → `/chat` (TODOS incluindo empresa)
- [ ] "Assistente (Empresa)" → `/empresas/[slug]/chat` (com slug)
- [ ] "Brain Admin" → `/admin/brain` (TECHNICAL_SUPPORT + LEADER_TC)

**ADMIN**
- [ ] Módulo aparece para: TECHNICAL_SUPPORT + LEADER_TC
- [ ] "Gerenciar Usuários" → `/admin/users` (ambos veem)
- [ ] "Permissões" → `/admin/users/permissions` (LEADER_TC only)
- [ ] "Audit Logs" → `/admin/audit-logs` (ambos)
- [ ] "Integrações" → `/integrations` (LEADER_TC only)
- [ ] "Configurações" → `/settings` (LEADER_TC only)

**DOCUMENTOS**
- [ ] "Central de documentos" → `/documentos` (todos)
- [ ] "Documentos da empresa" → `/empresas/[slug]/documentos` (todos)
- [ ] "Documentação técnica" → `/documentacao` (todos)

### 5. **Permissões por Perfil**

**Logar como EMPRESA**
- [ ] Menu mostra: Home, Empresas, Suporte, Brain, Documentos
- [ ] Operações/Automações/Admin escondidos
- [ ] "/chat" acessível

**Logar como COMPANY_USER**
- [ ] Mesmo que EMPRESA

**Logar como TESTING_COMPANY_USER**
- [ ] Menu mostra: TUDO (home, empresas, ops, auto, suporte, brain, docs, admin)
- [ ] Admin mostra: "Gerenciar Usuários" + "Audit Logs" (sem Permissões/Integrações/Settings)
- [ ] "/chat" acessível

**Logar como TECHNICAL_SUPPORT**
- [ ] Menu mostra: TUDO (home, empresas, ops, auto, suporte, brain, docs, admin)
- [ ] Admin mostra: "Gerenciar Usuários" + "Audit Logs" (sem Permissões/Integrações/Settings)
- [ ] "/chat" acessível

**Logar como LEADER_TC**
- [ ] Menu mostra: TUDO
- [ ] Admin mostra: TUDO (Gerenciar Usuários, Permissões, Audit Logs, Integrações, Settings)
- [ ] "/chat" acessível

### 6. **Responsividade**

**Desktop (≥1024px)**
- [ ] Sidebar visível à esquerda
- [ ] Main content ao lado (flex-1)
- [ ] Collapsa/expande com transição

**Tablet (768px - 1023px)**
- [ ] Sidebar ainda visível
- [ ] Main content responsive
- [ ] Menu adaptado ao espaço

**Mobile (<768px)**
- [ ] Sidebar escondida
- [ ] Header mostra hamburger icon (☰)
- [ ] Click hamburger → sidebar modal overlay (fixed, z-50)
- [ ] Click no main content → fecha modal
- [ ] Click no item → navega + fecha modal

### 7. **Zoom Responsividade**
Browser zoom (Ctrl+Plus / Ctrl+Minus):
- [ ] 75% zoom → tudo ainda legível
- [ ] 100% zoom (default) → normal
- [ ] 125% zoom → tudo reescalado proporcionalmente
- [ ] 150% zoom → sem overflow horizontal (texto não sai da tela)
- [ ] Fonts, padding, icons todos escalados com zoom

### 8. **Chat Acessibilidade**
- [ ] EMPRESA vê "Assistente (Global)" → `/chat`
- [ ] EMPRESA vê "Assistente (Empresa)" → `/empresas/[slug]/chat` (se tiver empresa)
- [ ] TC_USER vê ambos
- [ ] TECHNICAL_SUPPORT vê ambos
- [ ] LEADER_TC vê ambos + "Brain Admin"
- [ ] Clicando em "Assistente" → chat carrega normalmente

### 9. **Favoritos**
- [ ] Seção "Favoritos" aparece após primeiro favorito adicionado
- [ ] Click ⭐ em item → adiciona favorito
- [ ] Favorito persiste em localStorage
- [ ] Click X no favorito → remove
- [ ] Sem favoritos → seção não aparece

### 10. **Active State**
- [ ] Item ativo destacado com `bg-white/16`
- [ ] Módulo de item ativo também abre
- [ ] Ao navegar para nova rota → active item muda
- [ ] Reload de página → item correto ativo

---

## 🧑‍💻 Teste Manual Rápido

### Setup
```bash
cd "c:\Users\Testing Company\painel-qa"
npm run dev
# Esperar por "Ready in XXXms"
# Abrir http://localhost:3000
```

### Passos
1. Login com `ana.paula.lysyk@techcompany.com` (TECHNICAL_SUPPORT)
2. Verificar sidebar tem 9 módulos
3. Click "Operações" → ver 5 itens
4. Click "/admin/dashboard" → página carrega ao lado
5. Click chevron left → sidebar collapsa
6. Hover em módulo → flyout panel abre com itens
7. Click item no flyout → navega
8. Open DevTools → F12
9. Testar mobile: Ctrl+Shift+M (device emulation)
10. Verificar drawer modal ao clicar hamburger

### Validação de Build
```bash
npm run build
# Deve completar com "✓ Compiled successfully"
# TypeScript: "0 errors"
```

---

## 🐛 Se Algo Falhar

**Erro: "Module not found"**
- [ ] Verificar `lib/navigation/navigationCatalog.ts` syntax
- [ ] Rodar `npm run lint`
- [ ] Rodar `npm run build` novamente

**Erro: "Route not found (404)"**
- [ ] Verificar se página realmente existe em `app/`
- [ ] Checar rota no `navigationCatalog.ts`
- [ ] Testar rota diretamente: `http://localhost:3000/admin/dashboard`

**Sidebar não collapsa**
- [ ] DevTools → Console → verificar erros
- [ ] Checar `useSidebarState` hook
- [ ] Verificar `app/components/Sidebar.tsx` imports

**Menu item não redireciona**
- [ ] Click → verificar URL muda
- [ ] Verificar `companyRoute` vs `href` no catalog
- [ ] Testar rota em novo browser tab

**Chat não acessível**
- [ ] Logout → login com EMPRESA
- [ ] Verificar `/chat` aparece no menu Brain
- [ ] Checar se acesso é permitido (sem `allowedRoles` = todos)

---

## ✨ QA Checklist Final

- [ ] Build passa (0 errors)
- [ ] Menu renderiza 9 módulos
- [ ] Todos 40+ itens navegam para rotas corretas
- [ ] Permissões filtradas por role
- [ ] Chat acessível a todos
- [ ] Responsive mobile/desktop/tablet
- [ ] Zoom 75% - 150% funciona
- [ ] Favoritos funcionam
- [ ] Active state correto
- [ ] Sem console errors
- [ ] Performance: sidebar transição <400ms
- [ ] Acessibilidade: navegável por teclado


# Mockup Visual — Quality Control Layout

## 📱 Desktop View (≥1024px)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Quality Control — Admin Dashboard                                                    │
├──────────────┬──────────────────────────────────────────────────────────────────────┤
│              │                                                                       │
│  [TC LOGO]   │  📊 OPERAÇÕES                                                        │
│              │                                                                       │
│  ✓ Favoritos │  Dashboard Operacional                                              │
│  ★ Home      │                                                                       │
│  ★ Operations│  ┌──────────────────────────────────────────────────────────────┐  │
│  ★ Automação │  │                                                              │  │
│              │  │  Estatísticas Operacionais                                    │  │
│              │  │                                                              │  │
│              │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │  │
│ ═════════════│  │ │ Runs Total  │ │ Taxa Sucesso│ │ Tempo Médio │            │  │
│              │  │ │    2.847    │ │   94.2%     │ │   12m 34s   │            │  │
│ [🏠] Home    │  │ │ (↑ 12%)     │ │ (↑ 2.3%)    │ │ (↓ 1m 12s)  │            │  │
│   Início     │  │ └─────────────┘ └─────────────┘ └─────────────┘            │  │
│   Dashboard  │  │                                                              │  │
│              │  │  Últimas Execuções                                           │  │
│ [👥] Empresas│  │  ┌──────────┬──────────┬───────────┬──────────┐            │  │
│   Listar...  │  │  │ Run ID   │ Empresa  │ Status    │ Tempo    │            │  │
│   Empresa    │  │  ├──────────┼──────────┼───────────┼──────────┤            │  │
│   Apps       │  │  │ #12847   │ ACME Inc │ ✓ Sucesso │ 14m 32s  │            │  │
│   Planos...  │  │  │ #12846   │ TechCorp │ ✓ Sucesso │ 11m 15s  │            │  │
│   Runs       │  │  │ #12845   │ DataFlow │ ⚠ Aviso  │ 18m 45s  │            │  │
│   Defeitos   │  │  │ #12844   │ ACME Inc │ ✓ Sucesso │ 12m 08s  │            │  │
│              │  │  └──────────┴──────────┴───────────┴──────────┘            │  │
│ [⚡] Automação │  └──────────────────────────────────────────────────────────────┘  │
│   Casos      │                                                                       │
│   Execução   │                                                                       │
│   Fluxos     │                                                                       │
│   Scripts    │                                                                       │
│   ...        │                                                                       │
│              │                                                                       │
│ [💬] Brain   │                                                                       │
│   Chat Gobal │                                                                       │
│   Chat Emp.  │                                                                       │
│   Admin      │                                                                       │
│              │                                                                       │
│ [🎯] Suporte │                                                                       │
│   ...        │                                                                       │
│              │                                                                       │
│ [📄] Docs    │                                                                       │
│   ...        │                                                                       │
│              │                                                                       │
│ [⚙️] Admin    │                                                                       │
│   Usuários   │                                                                       │
│   Perms...   │                                                                       │
│   Logs       │                                                                       │
│              │                                                                       │
└──────────────┴──────────────────────────────────────────────────────────────────────┘
  288px         (flex-1, responde ao zoom)
  (collapsed:
   72px com
   icon buttons
   + flyout)
```

## 📱 Mobile View (<1024px)

```
┌────────────────────────────────────┐
│ ☰  Quality Control          [👤]   │  ← Header with menu + profile
├────────────────────────────────────┤
│                                    │
│  📊 OPERAÇÕES                      │
│                                    │
│  Dashboard Operacional             │
│                                    │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │  Estatísticas              │   │
│  │                             │   │
│  │  ┌─────────┐ ┌─────────┐   │   │
│  │  │ Runs    │ │ Taxa    │   │   │
│  │  │ 2.847   │ │ 94.2%   │   │   │
│  │  └─────────┘ └─────────┘   │   │
│  │                             │   │
│  │  Últimas Execuções         │   │
│  │                             │   │
│  │  #12847 ACME Inc ✓ 14m 32s │   │
│  │  #12846 TechCorp ✓ 11m 15s │   │
│  │  #12845 DataFlow ⚠ 18m 45s │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                    │
│                                    │
│                                    │
└────────────────────────────────────┘

[Sidebar as overlay modal when menu clicked]
┌────────────────────────────────────┐
│ ◀ Menu                             │
├────────────────────────────────────┤
│ [TC LOGO]                          │
│                                    │
│ [🏠] Home                          │
│ [👥] Empresas                      │
│ [📊] Operações                     │
│ [⚡] Automações                    │
│ [💬] Brain                         │
│ [🎯] Suporte                       │
│ [📄] Docs                          │
│ [⚙️] Admin                         │
│                                    │
└────────────────────────────────────┘
```

## 🎯 Sidebar Estados

### Expandido (288px)
```
┌────────────────────────────────────────┐
│                                        │
│  [🏢 Logo]      Testing Company        │
│                 Quality Control        │
│                              [◀◀]     │  ← Collapse button
│                                        │
├────────────────────────────────────────┤
│ ⭐ FAVORITOS                            │
│                                        │
│  ★ Dashboard Operacional              │
│  ★ Runs Ativas                        │
│                                    [✕] │
├────────────────────────────────────────┤
│ 🧭 NAVEGAÇÃO                           │
│                                        │
│  [🏠] Home                             │
│     └─ Início                          │
│     └─ Dashboard Admin                 │
│                                        │
│  [👥] Empresas                         │
│     └─ Listar empresas                 │
│     └─ Empresa ativa                   │
│     └─ Aplicações                      │
│     └─ Planos de teste                 │
│     └─ Runs                            │
│     └─ Defeitos                        │
│     └─ Integrações                     │
│                                        │
│  [📊] Operações                        │
│     └─ Dashboard                       │
│     └─ Runs                            │
│     └─ Métricas                        │
│     └─ Kanban                          │
│     └─ Audit Logs                      │
│                                        │
│  [⚡] Automações                       │
│     └─ Casos de Teste                  │
│     └─ Execuções                       │
│     └─ Fluxos                          │
│     └─ Scripts                         │
│     └─ Ferramentas                     │
│     └─ Playwright                      │
│     └─ UI Studio                       │
│     └─ Logs                            │
│                                        │
│  [💬] Brain / IA                       │
│     └─ Assistente (Global)            │
│     └─ Assistente (Empresa)           │
│     └─ Brain Admin                     │
│                                        │
│  [🎯] Suporte                          │
│     └─ Meus chamados                   │
│     └─ Chamados                        │
│     └─ Solicitações de acesso          │
│     └─ Base de conhecimento            │
│                                        │
│  [📄] Documentos                       │
│     └─ Central                         │
│     └─ Documentos da empresa           │
│     └─ Documentação técnica            │
│                                        │
│  [⚙️] Admin                            │
│     └─ Gerenciar Usuários             │
│     └─ Permissões                      │
│     └─ Audit Logs                      │
│     └─ Integrações                     │
│     └─ Configurações                   │
│                                        │
└────────────────────────────────────────┘
```

### Colapsado (72px) + Flyout Hover
```
┌───────┐
│ [TC]  │    ← Logo + collapse button
├───────┤
│ [⭐]  │ ◄──► ┌─────────────────────┐
│       │     │ FAVORITOS            │
│       │     │                      │
│ [🏠]  │     │ ★ Dashboard Operacional
│ [👥]  │     │ ★ Runs Ativas        │
│ [📊]  │ ◄──► ┌─────────────────────┐
│ [⚡]  │     │ OPERAÇÕES            │
│ [💬]  │     │                      │
│ [🎯]  │     │ • Dashboard          │
│ [📄]  │     │ • Runs               │
│ [⚙️]  │     │ • Métricas           │
│       │     │ • Kanban             │
│       │     │ • Audit Logs         │
│       │     │                      │
│       │     │ Click para ir →       │
│       │     └─────────────────────┘
│       │
└───────┘
 Auto-close
 150ms after
 mouse leave
```

## 🎨 Cores & Espaçamento

**Sidebar Gradient:**
```css
background: linear-gradient(
  180deg,
  #011848 0%,     /* Azul escuro */
  #082457 42%,    /* Azul médio */
  #3a1530 72%,    /* Roxo escuro */
  #ef0001 100%    /* Vermelho logo TC */
);
```

**Text Colors:**
- Primary: `text-white` (labels)
- Secondary: `text-white/85` (hover)
- Tertiary: `text-white/35` (section titles)
- Muted: `text-white/50` (disabled)

**Hover States:**
- Background: `hover:bg-white/10`
- Text: `hover:text-white`
- Active: `bg-white/16` (selected module/item)

**Borders:**
- All: `border-white/10`
- Hover: `hover:border-white/20`

**Transições:**
- Sidebar width: `transition-[width] duration-300`
- Menu items: `transition-colors duration-150`
- Flyout: `transition-opacity duration-150`

## ✅ Checklist Visual

- ✅ Logo centralizado + branding
- ✅ Favoritos destacados com ⭐
- ✅ Módulos com ícones distintos
- ✅ Submenu indentado com visual claro
- ✅ Hover states bem definidos
- ✅ Active module destacado
- ✅ Responsivo em mobile
- ✅ Zoom aware (rem-based)
- ✅ Contraste acessível (WCAG)
- ✅ Transições suaves


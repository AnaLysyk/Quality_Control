# testes/ui/automacoes

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/ui/automacoes
```

## Arquivos e casos de teste

### `automation-studio.spec.ts` (e2e (playwright))

**Describe:** Tela de Automacao

- @smoke @case=TC-AUTO-001 admin acessa /automacoes/tools e ve a area Tools
- @case=TC-AUTO-002 admin ve o runner biometrico na pagina de execucoes
- @case=TC-AUTO-003 admin ve lista de casos em /automacoes/casos
- @case=TC-AUTO-004 seletores da pagina de execucoes nao quebram
- @case=TC-AUTO-005 API Lab abre em /automacoes/api-lab sem erros
- @case=TC-AUTO-006 catalogo importado aparece no workbench
- @case=TC-AUTO-007 Base64 abre em /automacoes/base64 sem erros
- @case=TC-AUTO-008 Arquivos abre em /automacoes/arquivos sem erros
- @case=TC-AUTO-009 Logs abre em /automacoes/logs sem erros
- @case=TC-AUTO-010 Scripts abre em /automacoes/scripts sem erros
- @case=TC-AUTO-011 Fluxos abre em /automacoes/fluxos sem erros
- @case=TC-AUTO-012 ambiente exige URL base e token no Studio

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/automacoes/automation-studio.spec.ts
```

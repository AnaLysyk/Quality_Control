# testes/ui/usuarios

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/ui/usuarios
```

## Arquivos e casos de teste

### `criar-usuarios-por-perfil.ui.spec.ts` (e2e (playwright))

**Describe:** Suporte Técnico — criação de perfis, Líder TC — criação de perfis

- Ana suporte TC cria, edita, recebe e-mail e acessa Meu Perfil: ${profile.label}
- Líder TC cria perfil: ${profile.label}
- Usuário TC não acessa /admin e não vê empresas de outros clientes

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/usuarios/criar-usuarios-por-perfil.ui.spec.ts
```

### `dados-alterados-formulario-combo.spec.ts` (e2e (playwright))

**Describe:** Dados Alterados - formulário assistido

- deve alterar todos os campos editáveis pela tela e capturar o PATCH correto

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/usuarios/dados-alterados-formulario-combo.spec.ts
```

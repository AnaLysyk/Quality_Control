# testes/api/navegacao

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/api/navegacao
```

## Arquivos e casos de teste

### `navigation-permissions.test.ts` (unit/integracao (jest))

**Describe:** navigation permission filtering

- hides QA and privileged support links from company users without permissions
- shows manual QA links to company admins with QA read permissions
- uses permission matrix to expose user permissions without create-user shortcuts for support users

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/navegacao/navigation-permissions.test.ts
```

### `operacoes-bloqueadas.test.ts` (unit/integracao (jest))

**Describe:** bloqueio do modulo operacional

- nao mostra operations para perfis fixos
- bloqueia rotas operacionais para perfis fixos

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/navegacao/operacoes-bloqueadas.test.ts
```

### `perfil-suporte-inventario-rotas.test.ts` (unit/integracao (jest))

**Describe:** perfil suporte - inventario de rotas

- todos os hrefs visiveis para suporte tecnico apontam para paginas existentes
- mantem inventario minimo de rotas criticas do suporte tecnico

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/navegacao/perfil-suporte-inventario-rotas.test.ts
```

### `perfil-suporte-navegacao-base.test.ts` (unit/integracao (jest))

**Describe:** perfil suporte - navegacao base

- exibe os modulos principais do suporte tecnico
- exibe atalhos operacionais permitidos para suporte tecnico
- nao exibe atalhos de criacao de perfis privilegiados

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/navegacao/perfil-suporte-navegacao-base.test.ts
```

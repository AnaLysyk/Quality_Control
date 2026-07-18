# Arquitetura

## Objetivos
- Manter a UI rapida e focada; manter regras de dominio no backend.
- Deixar limites explicitos para evitar duplicacao conforme o time cresce.
- Tornar o desenvolvimento local e o CI previsiveis.

## Mapa do sistema
- Next.js app (app/): UI e BFF.
- app/api: endpoints usados pela UI.
- PostgreSQL + Prisma: fonte de dados e schema oficial.
- Redis (opcional): sessoes e caches leves.
- Qase: dados externos de gestao de testes.

## Dominios canonicos
- O nome tecnico canonico de cada funcionalidade esta em `backend/architecture/domainCatalog.ts`.
- A tela `/admin/sistema/mapa` mostra onde cada dominio vive no frontend, API, backend e banco.
- URLs publicas em portugues podem ser mantidas como aliases de compatibilidade.
- Regras de negocio nao devem ser duplicadas em aliases: a rota apenas adapta entrada/saida e delega ao dominio canonico.
- O schema Prisma em `database/prisma/schema.prisma` continua sendo a unica autoridade do banco.
- Execute `npm run architecture:check` para validar caminhos, modelos, paginas mapeadas e protecao basica de APIs sensiveis.

Exemplo de rastreabilidade:

```text
companies
  frontend: app/clients, app/admin/clients, app/empresas
  api:      app/api/clients, app/api/companies, app/api/empresas
  backend:  backend/company*.ts
  banco:    Company, CompanyIntegration, UserCompanyLink
```

`clients`, `empresas` e `company` sao nomes publicos/legados do mesmo dominio
`companies`; eles nao representam implementacoes independentes.

## Limites
app/api (BFF):
- API voltada para a UI, cookies/sessao, helpers de SSR.
- Compor e preparar dados para as telas.
- Responsavel por auth/sessao e resolucao de tenant.

Banco (Postgres/Prisma):
- Fonte de verdade para usuarios, empresas e relacionamentos.
- Prisma e a unica autoridade de schema.

## Fluxo de autenticacao
1. UI -> POST /api/auth/login -> Prisma valida credenciais.
2. Sessao armazenada no Redis + cookie JWT emitido.
3. UI -> GET /api/me para resolver usuario atual + empresas.

## Estrategia de contratos
- Tipos compartilhados via packages/contracts (Zod + TS).
- Contratos de API documentados na pasta docs.

## Estrategia de testes
- E2E smoke no CI (login + paginas principais).
- E2E completo local quando necessario.

## Modos de execucao
- Prisma + JWT apenas.

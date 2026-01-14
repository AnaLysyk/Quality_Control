# Kanban Manual — Banco + Importação/Exportação

## Objetivo
O Kanban manual permite registrar o status dos casos (PASS/FAIL/BLOCKED/NOT_RUN), com campos opcionais (bug/link), **persistindo no banco** (Supabase Postgres) e com suporte a **importação** e **exportação**.

## Tabela no banco (Supabase)
A migration está em:

- `scripts/11_kanban_manual.sql`

Ela cria a tabela:

- `public.kanban_cards`

Campos principais:

- `client_slug` (empresa)
- `project` (ex.: `SFQ`)
- `run_id` (inteiro)
- `case_id` (inteiro opcional)
- `title` (título do card)
- `status` (`PASS|FAIL|BLOCKED|NOT_RUN`)
- `bug`, `link` (opcionais)
- `created_at`, `created_by`

### Como aplicar
No Supabase (SQL Editor), execute o conteúdo de `scripts/11_kanban_manual.sql`.

> Em produção, sempre prefira criar as tabelas antes de habilitar o uso nas telas.

## Autenticação e segurança
As rotas do Kanban exigem autenticação.

- Header: `Authorization: Bearer <token>`
- Ou cookies: `sb-access-token` / `auth_token`

A API usa o client server-side (`getSupabaseServer()`), então o controle de acesso é aplicado **na própria API**:

- Usuário **não-admin** só acessa a empresa vinculada (`users.cliente`).
- Admin global pode filtrar por `slug` ou consultar sem `slug`.

## Endpoints

### Listar cards
`GET /api/kanban?project=SFQ&runId=99&slug=minha-empresa`

Retorno:

```json
{ "items": [ { "id": 1, "project": "SFQ", "run_id": 99, "title": "...", "status": "NOT_RUN" } ] }
```

### Criar card
`POST /api/kanban`

Body JSON:

```json
{
  "project": "SFQ",
  "runId": 99,
  "slug": "minha-empresa",
  "title": "Caso 123 - login",
  "status": "FAIL",
  "case_id": 123,
  "bug": "BUG-10",
  "link": "https://..."
}
```

### Atualizar card
`PATCH /api/kanban/:id`

Body JSON (parcial):

```json
{ "status": "PASS", "bug": "BUG-10", "link": "https://..." }
```

### Remover card
`DELETE /api/kanban/:id`

## Exportação
`GET /api/kanban/export?project=SFQ&runId=99&slug=minha-empresa&format=csv`

- `format=csv` (padrão): baixa arquivo CSV
- `format=json`: retorna `{ items: [...] }`

CSV inclui header:

- `id,client_slug,project,run_id,case_id,title,status,bug,link,created_at`

## Importação
### Importar via JSON
`POST /api/kanban/import?project=SFQ&runId=99&slug=minha-empresa`

Body:

```json
{
  "items": [
    { "title": "Caso 1", "status": "PASS", "case_id": 1 },
    { "title": "Caso 2", "status": "FAIL", "case_id": 2, "bug": "BUG-22" }
  ]
}
```

### Importar via CSV
`POST /api/kanban/import?project=SFQ&runId=99&slug=minha-empresa`

Headers:

- `Content-Type: text/csv`

CSV (exemplo):

```csv
title,status,case_id,bug,link
Caso 1,PASS,1,,
Caso 2,FAIL,2,BUG-22,https://example.com
```

Regras:
- `title` e `status` são obrigatórios.
- `status` aceita variações (`passed`, `failed`, `not run`, etc.).
- Itens inválidos são ignorados; se nenhum item for válido, a API responde 400.

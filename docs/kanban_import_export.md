# Kanban Manual — Importação/Exportação

## Objetivo
O Kanban manual permite registrar o status dos casos (PASS/FAIL/BLOCKED/NOT_RUN), com campos opcionais (bug/link), e suporta **importação** e **exportação**.

> Observação: atualmente os cards são armazenados em memória durante o processo (dev/local). Se precisar de persistência, crie uma tabela dedicada no Postgres e atualize as rotas.

## Autenticação e segurança
As rotas do Kanban exigem autenticação via cookies (`session_id` / `auth_token`) e validam o acesso por empresa.

- Usuário não-admin só acessa a empresa vinculada.
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

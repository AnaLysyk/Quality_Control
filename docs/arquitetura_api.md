# Arquitetura — API (app/api)

## Onde ficam as APIs
No App Router, as rotas de API ficam em `app/api/**/route.ts`.

Exemplos típicos no projeto:
- Autenticação/login
- `/api/me` (dados do usuário logado)
- Integrações (ex.: Qase)
- Recursos por empresa (ex.: defeitos, documentos)

## Autenticação
Padrão atual:

- O cookie `auth_token` é usado para identificar o usuário.
- Em modo mock (`SUPABASE_MOCK=true`), algumas rotas aceitam cookies `mock_role` e `mock_client_slug`.

Boas práticas:
- Nunca expor tokens/chaves no client.
- Validar acesso por empresa (empresa do usuário) e permitir bypass apenas para admin global.

## Padrão de respostas
Sugestão de contrato consistente:

- Sucesso: `{ ok: true, ... }` ou `{ items: [...] }`
- Erro: `{ error: "mensagem" }` com status HTTP adequado (401/403/400/500)

## Integração com Qase
- Usa endpoints v1.
- Header esperado: `Token: <API_TOKEN>`.

Pontos comuns de falha (quando “não aparece nada”):
- Empresa sem `projectCode` configurado
- Token ausente/inválido
- Problemas de mapeamento empresa → projeto

## Integração com Supabase
- Server-side via `lib/supabaseServer.ts`.
- Para Storage, usar bucket dedicado (ex.: `company-documents`) e URLs assinadas.

## Documentos por empresa (privacidade)
A rota `/api/company-documents` implementa:

- `GET /api/company-documents?slug=<empresa>`: lista itens (links e arquivos)
- `GET /api/company-documents?slug=<empresa>&id=<id>&download=1`: download/visualização autenticada do arquivo
- `POST /api/company-documents`:
  - JSON para criar `link`
  - `multipart/form-data` para upload de arquivo
- `DELETE /api/company-documents?slug=<empresa>&id=<id>`: remove

Regra de acesso:
- Admin global: vê tudo.
- Usuário comum: vê apenas a própria empresa.

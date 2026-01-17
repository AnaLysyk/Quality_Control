# Arquitetura – API (app/api)

## Estrutura das rotas de API
No App Router, todas as APIs vivem em `app/api/**/route.ts`.

Alguns exemplos presentes no projeto:
- Autenticação/login
- `/api/me` (dados do usuário autenticado)
- Integrações externas (ex.: Qase)
- Recursos específicos por empresa (como defeitos e documentos)

## Autenticação
Padrão adotado:

- O cookie `auth_token` identifica o usuário em cada requisição.
- Em modo mock (`SUPABASE_MOCK=true`), algumas rotas aceitam os cookies `mock_role` e `mock_client_slug`.

Boas práticas recomendadas:

- Nunca expor tokens ou chaves no cliente.
- Validar o acesso por empresa (verificando se ela pertence ao usuário) e liberar o bypass apenas para administradores globais.

## Contrato de respostas
Sugestão de resposta consistente para o front:

- Sucesso: `{ ok: true, ... }` ou `{ items: [...] }`
- Erro: `{ error: "mensagem" }` com o status HTTP apropriado (401, 403, 400, 500 etc.)

## Integração com a Qase

- A comunicação usa os endpoints da versão v1.
- O cabeçalho esperado é `Token: <API_TOKEN>`.

Quando nada aparece, os motivos mais comuns são:

- Empresa sem `projectCode` cadastrado
- Token ausente ou inválido
- Mapeamento incorreto entre empresa e projeto Qase

## Integração com Supabase

- O acesso é feito pelo servidor via `lib/supabaseServer.ts`.
- Para Storage, use um bucket dedicado (ex.: `company-documents`) e URLs assinadas para downloads.

## Documentos por empresa (privacidade)
A rota `/api/company-documents` oferece:

- `GET /api/company-documents?slug=<empresa>`: lista links e arquivos
- `GET /api/company-documents?slug=<empresa>&id=<id>&download=1`: download ou visualização autenticada
- `POST /api/company-documents`: aceita JSON para criar um link ou `multipart/form-data` para upload
- `DELETE /api/company-documents?slug=<empresa>&id=<id>`: remove o registro

Controle de acesso:

- Admin global: vê tudo
- Usuário comum: só vê os dados da própria empresa

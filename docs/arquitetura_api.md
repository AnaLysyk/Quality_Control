# Arquitetura – API (app/api)

## Estrutura das rotas de API
No App Router, todas as APIs residem em `app/api/**/route.ts`.

Exemplos presentes no projeto:
- Autenticação/login
- `/api/me` (dados do usuário autenticado)
- Integrações externas (ex.: Qase)
- Recursos específicos por empresa (defeitos, documentos, etc.)

## Autenticação
Padrão adotado:
- Sessões armazenadas via Redis (`session_id`)
- JWT opcional via cookie `auth_token`

Boas práticas:
- Nunca expor tokens ou chaves no cliente
- Validar acesso por empresa; liberar bypass apenas para administradores globais

## Contrato de respostas
Sugestão de resposta consistente para o frontend:
- Sucesso: `{ ok: true, ... }` ou `{ items: [...] }`
- Erro: `{ error: "mensagem" }` com status HTTP apropriado (401, 403, 400, 500, etc.)

## Integração com a Qase
- Comunicação usa endpoints da versão v1
- Cabeçalho esperado: `Token: <API_TOKEN>`

Principais motivos para falha:
- Empresa sem `projectCode` configurado
- Token ausente ou inválido
- Mapeamento incorreto entre empresa e projeto Qase

## Documentos por empresa (privacidade)
A rota `/api/company-documents` oferece:
- `GET /api/company-documents?slug=<empresa>`: lista links e arquivos
- `GET /api/company-documents?slug=<empresa>&id=<id>&download=1`: download ou visualização autenticada
- `POST /api/company-documents`: aceita JSON para criar link ou `multipart/form-data` para upload
- `DELETE /api/company-documents?slug=<empresa>&id=<id>`: remove o registro

Controle de acesso:
- Admin global: vê tudo
- Usuário comum: vê apenas dados da própria empresa

# Access Requests Admin

Esta pasta concentra somente o front da tela administrativa de solicitações de acesso.

## Organização

- `page.tsx`: monta a página, controla estado principal e conecta os componentes.
- `_components`: componentes visuais da tela.
- `_components/workspace`: área principal de análise da solicitação.
- `_types`: contratos TypeScript usados pela tela.
- `_utils`: funções puras de formatação, status e comparação.
- `_api`: chamadas client-side consumidas pela tela.
- `_docs`: documentação técnica da organização da feature.

## Fora desta pasta

- `app/api/admin/access-requests`: rotas HTTP da feature.
- `lib/accessRequestsV2`: regra de negócio, domínio e serviços.
- `prisma`: schema e migrations de banco.

Regra: componente visual não deve importar service de banco, Prisma ou regra de API diretamente.

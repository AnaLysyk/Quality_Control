# Arquitetura do Quality Control

## Regra principal

O projeto continua com uma estrutura simples. Cada arquivo deve deixar claro se pertence a uma tela/rota, a uma regra compartilhada, a dados de desenvolvimento ou a testes.

## Estrutura oficial

- `app/`: páginas, layouts, componentes próximos das páginas e rotas HTTP do Next.js.
- `lib/`: regras, permissões, serviços de servidor, integrações e utilitários compartilhados.
- `data/`: destino apenas para seeds, mocks, fixtures e dados locais de desenvolvimento.
- `prisma/`: schema e migrações do banco.
- `public/`: arquivos estáticos públicos.
- `tests/`: testes Jest.
- `tests-e2e/`: testes Playwright.
- `scripts/`: comandos de manutenção, migração e diagnóstico.
- `docs/`: documentação técnica.

Pastas internas em `lib/` devem surgir apenas quando houver código real. Não serão criadas árvores vazias para antecipar uma arquitetura.

## App e lib

`app/` permanece no lugar. Não existe plano de mover o App Router para `src/app`.

Uma rota em `app/api/` deve validar entrada e acesso, chamar regras de `lib/` e montar a resposta. A migração dessa lógica será incremental, sem reescrever rotas estáveis.

Permissões compartilhadas ficam em `lib/permissions/`. Componentes usados apenas por uma área ficam próximos dessa área em `app/`.

## Situação de src

`src/` já existia antes desta revisão e contém somente o design system e a feature de menu lateral. Ele é uma área limitada e não é o destino padrão para novas features.

Não moveremos `app/` ou `lib/` para `src/`. Os arquivos atuais de `src/` serão avaliados quando essas áreas forem alteradas, evitando uma migração sem benefício funcional.

## Situação de data

O objetivo é que `data/` tenha apenas seeds, mocks, fixtures e arquivos locais de desenvolvimento. Hoje existem stores e regras TypeScript nessa pasta. Esse conteúdo é legado e deve migrar para `lib/` somente quando o módulo correspondente for trabalhado.

## Permissões

- A interface pode esconder ou desabilitar ações, mas a API continua sendo a proteção final.
- Leitura e escrita devem validar ações distintas.
- A regra de acesso deve ser testável fora do componente.
- Estados de carregamento e acesso negado devem ser explícitos.

O piloto de usuários segue essa regra em `lib/permissions/` e `app/admin/users/`.

# Plano de refatoração incremental

## Princípios

1. Trabalhar uma feature por vez.
2. Manter URLs, rotas e contratos públicos.
3. Usar `app/` para telas e rotas e `lib/` para regras compartilhadas.
4. Não criar pastas vazias nem mover arquivos só para completar uma árvore.
5. Adicionar testes antes de alterar regras sensíveis.
6. Validar lint, testes e build ao final de cada etapa.

## Etapa 1 - Raiz e convenções

Status: concluída nesta revisão.

- Documentar a função das pastas atuais.
- Ignorar caches, builds, relatórios e temporários.
- Registrar conteúdo legado rastreado sem removê-lo automaticamente.
- Definir `tests/` e `tests-e2e/` como destinos oficiais.

## Etapa 2 - Usuários e permissões

Status: piloto iniciado.

- Centralizar a decisão de acesso em `lib/permissions/`.
- Exibir carregamento e acesso negado de forma explícita.
- Manter suporte técnico em modo somente leitura conforme a matriz.
- Validar novamente as ações nos endpoints.
- Não fragmentar as páginas grandes antes de existir necessidade funcional.

## Etapa 3 - Rotas de usuários

- Extrair, aos poucos, os casos de listar, criar e atualizar.
- Separar persistência, auditoria e envio de e-mail.
- Adicionar testes de autorização das APIs.

## Etapa 4 - Perfil e empresas

- Dividir telas por seções reais.
- Consolidar escopo de empresa e permissões.
- Migrar stores de `data/` para `lib/` quando forem tocados.

## Etapa 5 - Qualidade e automação

- Tratar casos, planos, runs, releases, defeitos e automações por domínio.
- Preservar contratos de API e URLs.
- Isolar integrações externas somente durante mudanças funcionais.

## Validação

```powershell
npm run lint
npm run test
$env:SKIP_PRISMA_MIGRATE='true'; npm run build
npm run test:e2e:smoke
npm run test:brain:contracts
```

O build local usa `SKIP_PRISMA_MIGRATE=true` quando não há acesso ao banco remoto. O Sonar pode ser executado depois da cobertura com `npm run sonar:scan`.

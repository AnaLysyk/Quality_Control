# Plano de reorganização estrutural — Quality Control

## Objetivo

Reorganizar o projeto para deixar o código mais fácil de entender, manter e testar.

A estrutura deve seguir uma leitura por domínio/fluxo, parecida com um projeto de automação bem organizado: nomes claros, responsabilidades separadas e funções em locais previsíveis.

Documento visual guia: [ARVORE_VISUAL_QUALITY_CONTROL.md](./ARVORE_VISUAL_QUALITY_CONTROL.md).

## Problema atual

Hoje o projeto concentra muitas responsabilidades dentro de app/ e lib/.

Foram identificadas rotas, componentes, hooks, contextos, tipos, dados e utilitários misturados diretamente em app/.

Também existem regras importantes em lib/, como autenticação, permissões, navegação, perfil, dashboard, RBAC e integrações.

## Direção da organização

A reorganização será feita aos poucos, sem alterar regra de negócio no primeiro momento.

Estrutura alvo:

src/
  features/
    autenticacao/
    dashboard/
    usuarios/
    empresas/
    perfis/
    permissoes/
    suporte/
    documentos/
    defeitos/
    automacoes/
    releases/
    brain/

  shared/
    components/
    hooks/
    services/
    utils/
    types/

  config/
    routes.ts
    navigation.ts

## Regra principal

Tudo que pertence a um fluxo específico deve ficar dentro da feature daquele fluxo.

Exemplos:

- regras de usuários ficam em src/features/usuarios
- regras de empresas ficam em src/features/empresas
- regras de suporte ficam em src/features/suporte
- regras de permissões ficam em src/features/permissoes
- componentes realmente reutilizáveis ficam em src/shared/components

## O que não fazer agora

- Não mover tudo de uma vez.
- Não alterar comportamento funcional.
- Não corrigir todos os itens do Sonar neste PR.
- Não misturar reorganização estrutural com nova regra de negócio.
- Não apagar arquivos sem mapear uso/importação.

## Primeira etapa

Criar a estrutura base e documentar o padrão.

Depois disso, moveremos os fluxos um por vez.

Ordem sugerida:

1. permissões
2. rotas e navegação
3. autenticação
4. dashboard
5. usuários
6. empresas
7. suporte
8. defeitos
9. automações
10. documentação/brain

## Critério de aceite

- Estrutura base criada.
- Documento de reorganização criado.
- Nenhuma regra de negócio alterada.
- Projeto continua compilando.
- Git diff pequeno e fácil de revisar.

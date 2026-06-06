# Menu lateral

O menu lateral e a referencia visual principal do front-end.

Esta feature centraliza a leitura humana do menu sem apagar os arquivos existentes. Nesta primeira etapa, ela cria uma camada organizada sobre o codigo real:

- catalogo: fonte da verdade do menu;
- acessos: filtro por perfil e permissao;
- hooks: consumo do menu pelo shell;
- componentes: pontos de entrada para Sidebar e itens.

Arquivos atuais que continuam sendo a base:

- `lib/navigation/navigationCatalog.ts`
- `lib/navigation/navigationPermissions.ts`
- `app/hooks/navigation/useNavigationItems.ts`
- `app/components/Sidebar.tsx`
- `app/components/navigation/SidebarItem.tsx`

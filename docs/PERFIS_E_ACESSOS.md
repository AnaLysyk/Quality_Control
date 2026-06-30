# Perfis e acessos

Este documento define o comportamento oficial dos perfis no Quality Control.

A plataforma não deve depender de uma tela livre de matriz de permissões para definir acesso do usuário. O acesso é definido pelo perfil e pelo vínculo com empresa/projeto.

## Regra geral

1. O usuário sempre trabalha dentro de um contexto de empresa.
2. Depois de selecionar a empresa, o sistema carrega os projetos daquela empresa.
3. Os módulos operacionais seguem o contexto selecionado de empresa e projeto.
4. Brain é contextual por empresa.
5. Solicitações públicas seguem escopo do tipo de solicitação e do destinatário.
6. Usuário da empresa é direcionado diretamente para a empresa vinculada.

## Perfis

### Usuário TC

Pode acessar apenas empresas em que possui vínculo.

Depois de selecionar uma empresa, pode acessar os projetos vinculados à empresa e os módulos operacionais permitidos:

- Defeitos
- Repositório de casos de teste
- Planos de teste
- Runs
- Documentação
- Automação
- Brain da empresa
- Suporte
- Notas
- Chat
- Meu perfil

Não pode acessar:

- Solicitações públicas
- Criação de empresa
- Criação de líder TC
- Criação de suporte técnico
- Administração global de permissões

### Líder TC

Pode acessar todas as empresas e todos os projetos.

Pode acessar:

- Visão geral da liderança
- Empresas
- Projetos
- Defeitos
- Repositório de casos de teste
- Planos de teste
- Runs
- Documentação
- Automação
- Brain
- Suporte
- Notas
- Chat
- Meu perfil
- Solicitações públicas
- Gestão de usuários da Testing Company
- Gestão de usuários de empresas

Nas solicitações públicas, pode aprovar, recusar ou solicitar ajuste para solicitações destinadas à Testing Company, Quality ou empresa, conforme o tipo da solicitação.

### Suporte Técnico

Pode acessar todas as empresas e todos os projetos.

Pode acessar:

- Visão geral da liderança/suporte
- Empresas
- Projetos
- Defeitos
- Repositório de casos de teste
- Planos de teste
- Runs
- Documentação
- Automação
- Brain
- Suporte
- Notas
- Chat
- Meu perfil
- Solicitações públicas
- Gestão operacional de usuários permitida ao suporte

Nas solicitações públicas, pode aprovar, recusar ou solicitar ajuste para solicitações destinadas à Testing Company, Quality ou empresa, conforme o tipo da solicitação.

### Empresa

Pode acessar apenas a própria empresa e os próprios projetos.

Pode acessar:

- Dashboard da empresa
- Defeitos
- Repositório de casos de teste
- Planos de teste
- Runs
- Documentação
- Automação
- Brain da empresa
- Suporte
- Notas
- Chat
- Meu perfil
- Criar usuário da instituição
- Solicitações públicas destinadas à própria empresa

Nas solicitações públicas, pode aprovar, recusar ou solicitar ajuste apenas quando a solicitação for destinada à empresa.

### Usuário da Empresa

É direcionado diretamente para a empresa vinculada.

Pode acessar apenas a própria empresa e os próprios projetos.

Pode acessar:

- Dashboard da empresa
- Defeitos
- Repositório de casos de teste
- Planos de teste
- Runs
- Documentação
- Automação
- Brain da empresa
- Suporte
- Notas
- Chat
- Meu perfil

Não pode acessar:

- Solicitações públicas
- Criar usuário da instituição
- Criar empresa
- Gestão de usuários
- Administração global de permissões

## Criação de usuário da empresa

Usuário da empresa criado pelo menu administrativo ou pelo menu da empresa deve seguir o fluxo padrão de criação de usuário:

- recebe e-mail;
- recebe senha temporária;
- não passa pelo fluxo de solicitação pública.

O fluxo de solicitação pública é apenas para quem usa a área pública de solicitar acesso.

## Decisão de produto

A tela livre de permissões deve ser removida ou desativada para evitar divergência entre a regra oficial de perfis e configurações manuais. O comportamento do sistema passa a ser definido por perfil, empresa vinculada e projeto selecionado.

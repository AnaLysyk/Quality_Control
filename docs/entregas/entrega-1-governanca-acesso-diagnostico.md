# Entrega 1 — Diagnóstico de governança de acesso e vínculos

## Status

**Concluída como etapa de diagnóstico.**

Esta entrega foi executada somente em leitura. Não houve implementação de correções funcionais nesta etapa.

- Repositório: `AnaLysyk/Quality_Control`
- Branch utilizada: `fix/entrega-1-governanca-acesso-multicontexto`
- Base original: `main`
- Commit-base: `436577fd6dd4ca3a86929b936eddf798c6067055`
- Origem do commit-base: merge da PR `#193` — Gestão de Vínculos

## Objetivo da etapa

Mapear o funcionamento atual de:

- autenticação;
- sessão;
- perfis;
- permissões efetivas;
- empresas permitidas;
- projetos permitidos;
- vínculos multiempresa e multiprojeto;
- menu e guards de tela;
- APIs protegidas;
- módulos de casos de teste, automação, planos, execuções e documentação;
- testes E2E com navegador visível.

A etapa foi intencionalmente limitada ao diagnóstico para evitar uma alteração ampla e insegura em várias áreas ao mesmo tempo.

## Resultado principal

O banco passou a guardar vínculos reais por meio de `ProjectTeamAssignment`, preservando:

- `userId`;
- `companyId`;
- `projectId`;
- `role`;
- `status`.

Entretanto, partes do sistema ainda transformam esses vínculos em listas independentes:

- `companySlugs[]`;
- `allowedProjectIds[]`.

Essa transformação perde a relação entre empresa e projeto e pode permitir combinações cruzadas indevidas.

Exemplo de vínculos válidos:

- Empresa A + Projeto A1;
- Empresa B + Projeto B1.

Combinações que devem ser bloqueadas:

- Empresa A + Projeto B1;
- Empresa B + Projeto A1.

## Achados críticos confirmados

### 1. Fallback inseguro de autenticação

`authenticateRequest` possui fluxos alternativos capazes de resolver identidade por:

- parâmetro `?user=<id ou e-mail>`;
- conteúdo de Bearer inválido reinterpretado como identificador local.

Esse comportamento precisa ser removido do runtime normal. Uma identidade deve ser aceita somente por sessão ou token criptograficamente válido.

### 2. `/api/companies` sem proteção adequada

O estado identificado foi:

- `GET` lista empresas sem autenticação;
- `POST` cria empresas sem autenticação;
- `DELETE` possui proteção administrativa;
- a listagem pode serializar campos além do necessário, inclusive configurações de integração.

A API deve ser protegida por permissão efetiva e escopo de empresa, com DTO seguro sem segredos.

### 3. Validação separada de empresa e projeto

`operationalContext` valida empresa e projeto em etapas independentes. A validação oficial futura precisa tratar empresa + projeto como uma combinação inseparável.

### 4. Deny individual ignorado em fluxos alternativos

A precedência oficial identificada é:

1. deny individual;
2. allow individual;
3. configuração do perfil;
4. defaults do sistema.

Porém, alguns fluxos ainda autorizam apenas por:

- role textual;
- capabilities;
- defaults do perfil;
- helpers legados.

Esses fluxos podem ignorar deny individual.

### 5. Semântica ambígua entre `null` e `[]`

Foi confirmada a diferença:

- `[]` pode representar nenhum projeto em alguns fluxos de `ProjectTeamAssignment`;
- `null` representa ausência de restrição em vários helpers;
- no ramo baseado em `Membership`, um array vazio pode ser convertido em `null` por teste de `.length`.

O contrato futuro deve representar explicitamente:

- `unrestricted`;
- `restricted`;
- `none`.

### 6. Líder TC não deve ser global automaticamente

Líder TC e Usuário TC podem ter:

- várias empresas;
- vários projetos na mesma empresa;
- projetos em empresas diferentes;
- várias combinações válidas de empresa e projeto.

Nenhum desses perfis deve receber acesso global apenas pelo nome do papel.

### 7. Home e Visão Geral compartilham controle

Home e Visão Geral utilizam o mesmo controle de permissão em partes do sistema. Isso impede desativar somente a Visão Geral e manter a Home ativa.

Essa correção ficou fora da implementação desta etapa e será tratada depois da fundação server-side.

## Correção importante sobre líder único

A migration da PR #193 já contém uma restrição única parcial para impedir dois Líderes TC ativos no mesmo projeto:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS
"project_team_assignments_active_leader_key"
ON "project_team_assignments"("projectId")
WHERE "role" = 'leader_tc' AND "status" = 'active';
```

Portanto, o risco não é ausência da restrição no código.

O risco real é a migration não ter sido aplicada em algum banco. A próxima etapa deve confirmar a aplicação física por meio de `_prisma_migrations` e `pg_indexes`.

## Fluxos recomendados como oficiais

### Identidade e escopo

Manter como base oficial:

- `getSessionPayload`;
- `getAccessContext`.

### Autorização

Manter e ampliar:

- `serverPermissionAccess`;
- `requirePermission`.

### Contexto operacional

`resolveOperationalContext` pode permanecer, mas deverá:

- receber a matriz efetiva;
- respeitar deny individual;
- validar relações empresa + projeto;
- abandonar validação baseada apenas em arrays achatados.

### Fluxos a restringir ou remover

- `resolveLocalAuthUser` como fallback de produção;
- `resolveRequestIdentifier` por query parameter;
- Bearer inválido reinterpretado como usuário;
- `mock_role` sem gate E2E explícito;
- `x-test-admin` em produção;
- helpers que tratam qualquer Líder TC como global.

## Estado dos testes e CI

Nesta etapa:

- nenhum teste novo foi criado;
- nenhum teste foi executado localmente pelo agente;
- nenhum código funcional foi alterado;
- o typecheck não foi executado no ambiente do agente por ausência de checkout completo;
- o estado anterior da PR #193 apresentava checks com falha;
- essas falhas não foram corrigidas durante o diagnóstico.

Isso deve permanecer registrado como linha de base, sem atribuir automaticamente qualquer falha futura a esta entrega.

## O que não foi executado na Etapa 1

Não foram realizadas:

- remoção do fallback `?user=`;
- proteção de `/api/companies`;
- criação do novo contrato relacional;
- migração de `/api/me` e `/api/auth/me`;
- correção do `operationalContext`;
- separação entre Home e Visão Geral;
- correção de Gestão de Perfis;
- correção de Gestão de Usuários;
- migração das APIs inventariadas;
- criação de testes automatizados;
- execução E2E headed;
- cadastro de casos no Repositório de Testes;
- vínculo de scripts na tela de Automação;
- criação de plano ou execução;
- publicação de documentação dentro da interface do sistema.

## Próxima etapa — Bloco 2

O próximo responsável deverá continuar a partir da `main` atual e criar uma branch nova ou continuar a branch definida pela coordenação.

Ordem obrigatória:

1. confirmar a migration e o índice de líder único nos bancos utilizados;
2. remover `?user=` do runtime normal;
3. impedir Bearer inválido de virar identificador local;
4. isolar mocks de E2E de forma fail-closed;
5. proteger `/api/companies`;
6. aplicar DTO seguro sem tokens e secrets;
7. criar o contrato oficial de acesso relacional;
8. representar `projectScope` como `unrestricted`, `restricted` ou `none`;
9. preservar pares empresa + projeto;
10. unificar `/api/me` e `/api/auth/me`;
11. fazer `operationalContext` consumir a matriz efetiva;
12. criar testes unitários, de integração e E2E headed;
13. registrar casos, automações, plano, execução e documentação no próprio Quality Control.

## Escopo inicial do Bloco 2

O Bloco 2 não deve migrar todas as APIs do sistema.

Aplicar inicialmente em:

- `lib/jwtAuth.ts`;
- `app/api/companies/route.ts`;
- `lib/core/session/session.store.ts`;
- `lib/auth/sessionBuilder.ts`;
- `lib/context/operationalContext.ts`;
- `lib/serverPermissionAccess.ts`;
- `/api/me`;
- `/api/auth/me`;
- `/api/projects`;
- helpers centrais necessários.

## Critérios mínimos de aceite do Bloco 2

- `?user=vítima` sem sessão retorna `401`;
- Bearer inválido retorna `401`;
- mocks E2E não funcionam em produção;
- `/api/companies` sem sessão retorna `401`;
- usuário sem permissão recebe `403`;
- deny individual prevalece;
- listagem de empresas não expõe tokens;
- usuário multiempresa recebe todas e somente as empresas vinculadas;
- Empresa A + Projeto A1 é permitido;
- Empresa B + Projeto B1 é permitido;
- Empresa A + Projeto B1 é bloqueado;
- Empresa B + Projeto A1 é bloqueado;
- `/api/me` e `/api/auth/me` usam a mesma fonte;
- `projectScope=none` não vira acesso irrestrito;
- testes E2E finais abrem navegador visível;
- casos e automações ficam registrados no próprio sistema.

## Handoff para o próximo responsável

Antes de implementar, ler este documento e revisar os arquivos centrais citados.

Não começar pela interface.

A sequência segura é:

1. autenticação;
2. autorização;
3. escopo relacional;
4. contrato das APIs de contexto;
5. seletores;
6. telas;
7. migração gradual das demais APIs.

A Etapa 1 termina neste diagnóstico. Qualquer correção funcional posterior pertence ao Bloco 2 ou aos blocos seguintes.

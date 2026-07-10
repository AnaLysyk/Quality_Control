# testes/ui/componentes

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/ui/componentes
```

## Arquivos e casos de teste

### `chat-button-routing.test.tsx` (unit/integracao (jest))

**Describe:** ChatButton API routing

- does not render when chat screen permission is disabled
- uses /api/assistente/ask when no brain context is active
- uses /api/assistente/ask after assistant:open with brain context

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/ui/componentes/chat-button-routing.test.tsx
```

### `CreateClientModal.test.tsx` (unit/integracao (jest))

**Describe:** CreateClientModal

- preenche o nome da empresa a partir do CNPJ usando a BrasilAPI
- nao sobrescreve um nome digitado manualmente enquanto a consulta esta em andamento

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/ui/componentes/CreateClientModal.test.tsx
```

### `CreateCompanyForm.test.tsx` (unit/integracao (jest))

**Describe:** CreateCompanyForm

- usa apenas a resposta mais recente da BrasilAPI e ignora retorno antigo
- nao sobrescreve um nome digitado enquanto a consulta esta em andamento

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/ui/componentes/CreateCompanyForm.test.tsx
```

### `createUserModal.test.tsx` (unit/integracao (jest))

**Describe:** CreateUserModal

- auto-selects the single client and enables submit when required fields are filled

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/ui/componentes/createUserModal.test.tsx
```

### `frontend-multitenant.test.tsx` (unit/integracao (jest))

**Describe:** ReleaseManualList e DefectList

- Renderiza lista de releases manuais para a empresa correta
- Renderiza lista de defeitos para a empresa correta

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/ui/componentes/frontend-multitenant.test.tsx
```

### `RequireClient.test.tsx` (unit/integracao (jest))

**Describe:** RequireClient

- mostra o estado de validacao enquanto a sessao carrega
- libera o conteudo quando o usuario tem acesso normalizado
- libera o conteudo quando o payload legado vem com companySlug
- libera o conteudo para suporte tecnico sem vinculo direto
- mostra acesso negado quando o usuario nao possui vinculo com a empresa
- mostra erro tratado e permite nova tentativa
- mostra estado tratado quando o slug da rota nao existe
- sai do loading infinito por timeout e permite tentar novamente
- redireciona para login quando nao existe usuario autenticado

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/ui/componentes/RequireClient.test.tsx
```

### `UserProfileMenu.test.tsx` (unit/integracao (jest))

**Describe:** UserProfileMenu - Componente de Frontend e Fluxo Auth, Roteamento Universal Seguro, Rede de Exibição via Perfis, Comportamento do Menu Dropdown

- deve re-rotear para /login rigidamente se a loading false devolver user null
- NÃƒO deve rotear pra fora caso esteja apenas carregando
- deve renderizar fallback e ocultar credenciais se as keys do usuário estiverem corrompidas no JWT
- deve exibir e-mail e Role com tag uppercase quando presente
- deve fechar dropdown ao clicar logout e executar a cadeia de limpeza JWT
- deve ocultar admin links para company users mortais

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/ui/componentes/UserProfileMenu.test.tsx
```

# testes/api/solicitacoes

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/api/solicitacoes
```

## Arquivos e casos de teste

### `solicitacoes-usuario.test.ts` (unit/integracao (jest))

- 1. cria solicitação EMAIL_CHANGE com status PENDING
- 2. cria solicitação COMPANY_CHANGE com companyId e companyName
- 3. cria solicitação PASSWORD_RESET
- 4. cria solicitação PROFILE_DELETION com motivo no payload
- 5. bloqueia duplicata PENDING do mesmo usuário+tipo
- 6. listUserRequests retorna apenas solicitações do usuário
- 7. listUserRequests filtra por status PENDING
- 8. listUserRequests filtra por tipo PASSWORD_RESET
- 9. listAllRequests retorna solicitações de múltiplos usuários
- 10. listAllRequests filtra por status PENDING
- 11. listAllRequests filtra por companyId
- 12. listAllRequests ordenação createdAt_asc
- 13. getRequestById retorna solicitação existente
- 14. getRequestById retorna null para id inexistente
- 15. aprova solicitação PENDING
- 16. rejeita solicitação PENDING de userB
- 17. registra reviewedBy, reviewNote e reviewedAt
- 18. não altera solicitação já revisada
- 19. retorna null para id inexistente
- 20. dois usuários com o mesmo tipo não conflitam (duplicate check é por userId)

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/solicitacoes/solicitacoes-usuario.test.ts
```

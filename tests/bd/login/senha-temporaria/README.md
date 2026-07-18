# testes/bd/login/senha-temporaria

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/bd/login/senha-temporaria
```

## Arquivos e casos de teste

### `temp-password-generation.test.ts` (unit/integracao (jest))

**Describe:** generateTempPassword()

- retorna string com comprimento correto
- contém apenas caracteres permitidos (sem 0, O, 1, l, I)
- gera senhas únicas a cada chamada
- tem ao menos 8 caracteres (valida requisito mínimo do sistema)
- armazena hash correto e permite verificar a senha plain-text posteriormente
- hash de senha diferente não autentica com a senha temporária

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/bd/login/senha-temporaria/temp-password-generation.test.ts
```

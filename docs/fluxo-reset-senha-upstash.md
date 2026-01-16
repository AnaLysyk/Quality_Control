# Fluxo de Reset de Senha com Upstash Redis

## Visão Geral
O endpoint `/api/auth/reset-via-token` permite que um usuário redefina sua senha utilizando um token temporário armazenado no Upstash Redis. O fluxo é seguro, rápido e não depende mais do Supabase.

## Como funciona
1. **Recebe POST** com `{ token, newPassword }`.
2. **Validações:**
   - Ambos os campos são obrigatórios.
   - A senha deve ter pelo menos 8 caracteres.
3. **Busca o userId** associado ao token no Redis (`reset:{token}`).
4. **Se o token for válido:**
   - Gera o hash da nova senha.
   - Atualiza a senha do usuário no banco (Prisma).
   - Remove o token do Redis para evitar reuso.
   - Retorna `{ ok: true }`.
5. **Se o token for inválido/expirado:**
   - Retorna erro 400.
6. **Se ocorrer erro interno:**
   - Retorna erro 500.

## Testando manualmente
- Envie um POST para `/api/auth/reset-via-token` com um token válido e uma nova senha.
- Exemplo de payload:
  ```json
  {
    "token": "TOKEN_VALIDO",
    "newPassword": "senhaNova123"
  }
  ```
- Resposta esperada: `{ ok: true }`.
- Se o token for inválido ou expirado: `{ error: "Token inválido ou expirado" }`.
- Se a senha for curta: `{ error: "A senha deve ter pelo menos 8 caracteres" }`.

## Observações
- O token é gerado e enviado por e-mail em outro endpoint (reset-request).
- O Upstash Redis é usado para armazenar tokens temporários de reset.
- O Prisma faz a atualização da senha no banco de dados.

## Variáveis de ambiente necessárias
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Referências
- Código: `app/api/auth/reset-via-token/route.ts`
- Helper Redis: `lib/redis.ts`
- Hash de senha: `lib/passwordHash.ts`

---
Dúvidas? Consulte o time de backend ou revise os testes automatizados para exemplos de uso.
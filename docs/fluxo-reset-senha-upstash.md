# Fluxo de redefinição de senha com Upstash Redis

## Visão geral
O endpoint `/api/auth/reset-via-token` permite que o usuário redefina a senha usando um token temporário armazenado no Upstash Redis. O fluxo é seguro, rápido e não depende de provedores externos de autenticação.

## Passo a passo
1. Recebe um POST com `{ token, newPassword }`.
2. Validações:
   - Ambos os campos são obrigatórios.
   - A senha deve ter no mínimo 8 caracteres.
3. Procura o `userId` associado ao token no Redis (`reset:{token}`).
4. Se o token for válido:
   - Gera o hash da nova senha.
   - Atualiza a senha do usuário no banco (Prisma).
   - Remove o token do Redis para evitar reutilização.
   - Retorna `{ ok: true }`.
5. Se o token for inválido ou expirado, retorna erro 400.
6. Em caso de erro interno, retorna erro 500.

## Testes manuais
- Faça um POST para `/api/auth/reset-via-token` com um token válido e uma senha nova.
- Exemplo de payload:
  ```json
  {
    "token": "TOKEN_VALIDO",
    "newPassword": "senhaNova123"
  }
  ```
- Resposta esperada: `{ ok: true }`.
- Se o token for inválido ou expirado: `{ error: "Token inválido ou expirado" }`.
- Se a senha for muito curta: `{ error: "A senha deve ter no mínimo 8 caracteres" }`.

## Observações
- O token é gerado e enviado por e-mail em outro endpoint (`reset-request`).
- O Upstash Redis armazena os tokens temporários de reset.
- O Prisma é responsável por atualizar a senha no banco de dados.

## Variáveis de ambiente necessárias
- `REDIS_PING_SECRET` (se usar testes sem autenticação)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

# Fluxo de redefinição de senha com Upstash Redis

## Visão geral
O endpoint `/api/auth/reset-via-token` permite redefinir a senha usando um token temporário armazenado no Upstash Redis. O fluxo é seguro, rápido e não depende de provedores externos de autenticação.

## Passo a passo
1. Recebe um POST com `{ token, newPassword }`
2. Validações:
   - Ambos os campos obrigatórios
   - Senha com no mínimo 8 caracteres
3. Busca o `userId` associado ao token no Redis (`reset:{token}`)
4. Se o token for válido:
   - Gera hash da nova senha
   - Atualiza a senha do usuário no banco (Prisma)
   - Remove o token do Redis para evitar reutilização
   - Retorna `{ ok: true }`
5. Se o token for inválido ou expirado: erro 400
6. Em caso de erro interno: erro 500

## Testes manuais
- POST para `/api/auth/reset-via-token` com token válido e senha nova
- Payload exemplo:
  ```json
  {
    "token": "TOKEN_VALIDO",
    "newPassword": "senhaNova123"
  }
  ```
- Resposta esperada: `{ ok: true }`
- Token inválido/expirado: `{ error: "Token inválido ou expirado" }`
- Senha curta: `{ error: "A senha deve ter no mínimo 8 caracteres" }`

## Observações
- Token gerado e enviado por e-mail em outro endpoint (`reset-request`)
- Upstash Redis armazena tokens temporários de reset
- Prisma atualiza a senha no banco de dados

## Variáveis de ambiente necessárias
- `REDIS_PING_SECRET` (para testes sem autenticação)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

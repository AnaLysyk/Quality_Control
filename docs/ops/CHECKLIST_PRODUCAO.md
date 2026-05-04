# Checklist de Producao: Quality Control

## Variaveis obrigatorias

```env
DATABASE_URL=postgresql://usuario:senha@host:5432/banco
JWT_SECRET=uma_chave_forte_e_aleatoria
NEXT_PUBLIC_SITE_URL=https://quality-control-qwqs.onrender.com
AUTH_COOKIE_SECURE=true
```

## Variaveis recomendadas para sessao estavel no Render

Use uma das duplas abaixo:

```env
UPSTASH_REDIS_REST_URL=https://<seu-endpoint>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<seu-token>
```

ou

```env
KV_REST_API_URL=https://<seu-endpoint>.upstash.io
KV_REST_API_TOKEN=<seu-token>
```

## Variaveis opcionais

```env
QASE_API_TOKEN=token_qase
QASE_PROJECT_MAP=griaule:GRIAULE
REDIS_PING_SECRET=um_segredo_para_testar_/api/public/redis/ping
```

## Render

1. Abra `controle de qualidade` na Render.
2. Entre em `Environment`.
3. Cadastre as variaveis acima.
4. Salve e faça `Manual Deploy` ou `Redeploy`.
5. Se quiser usar Blueprint, o projeto agora tem `render.yaml` na raiz.

## Validacao depois do deploy

1. Abra `/login` e faça login.
2. Confirme que `/admin/home` abre sem voltar para `/login`.
3. Se definir `REDIS_PING_SECRET`, valide:
   `GET /api/public/redis/ping?secret=<REDIS_PING_SECRET>`
4. Confirme que a resposta nao e `REDIS_NOT_CONFIGURED`.

## Sintoma quando Redis falta

Sem Redis no Render, a sessao pode funcionar em uma API e falhar em outra rota server-side, porque o fallback em memoria nao e confiavel em ambiente distribuido. O sintoma tipico e:

- `/api/me` retorna `200`
- `/admin/home` redireciona para `/login`

Se precisar de script de validacao ou seed de dados, solicite.

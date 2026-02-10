# Arquitetura

## Premissa
Este repo e uma ferramenta interna (QA). Prioridade:

- funcionar
- setup minimo
- testabilidade diaria

Nao estamos otimizando para SaaS/publico, compliance ou "seguranca bancaria".

## Mapa do sistema
- Next.js (App Router): UI + BFF (`app/` + `app/api/**`).
- Auth local (usuarios/empresas/vinculos): JSON em `data/local-auth-store.sample.json` (seed) e `data/local-auth-store.json` (opcional).
  - Para rodar sem escrita em disco: `LOCAL_AUTH_IN_MEMORY=true`.
- Sessao:
  - Preferencial: cookie `access_token` (JWT) quando `JWT_SECRET` existe.
  - Fallback: `session_id` salvo no Redis; Upstash e opcional e, se nao configurado, cai em memoria (nao persistente).
- Stores locais (JSON):
  - defeitos: `data/defects.json`
  - notas do usuario: `data/user-notes.json`
  - solicitacoes de acesso/suporte: `data/support-requests.json`
- Integracoes externas (quando configuradas): Qase, etc.

## Limites e responsabilidades
- `app/api/**`: endpoints orientados a UI, com cookies/sessao e resolucao de tenant.
- `src/core/**` e `data/**`: stores e helpers server-only.
- Frontend consome dados via rotas internas (`/api/me`, `/api/clients`, etc).

## Variaveis de ambiente (essenciais/uteis)
- `JWT_SECRET`: recomendado (habilita JWT em cookie e reduz dependencia de sessao server-side).
- `LOCAL_AUTH_IN_MEMORY=true`: opcional (nao grava `data/local-auth-store.json`).
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`: opcional (se ausente, Redis em memoria).
- `QASE_API_TOKEN` / `QASE_TOKEN`: opcional (sem token, algumas telas retornam warning/erro controlado).


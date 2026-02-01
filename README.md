# painel-qa

Next.js (App Router) + TypeScript. Front-end em `app/`, utilitários restritos ao servidor em `lib/`, dados auxiliares em `data/` e testes em `tests-e2e/`.

## Executar localmente (Windows)

1) Instalar dependências:

```bash
npm install
```

2) Criar e ajustar variáveis de ambiente:

- Copie `.env.local.example` para `.env.local`.
- Preencha:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - (opcional) tokens do Qase (`QASE_API_TOKEN`, `QASE_PROJECT_MAP`)
  - (opcional) Redis Upstash (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)

3) Subir o servidor:

```bash
npm run dev
```

Abra http://localhost:3000 no navegador.

## Verificações recomendadas

```bash
npm run lint
npm run build
npm run test:e2e:smoke
```

## Notas sobre Qase

- A integração envia o header `Token: <API_TOKEN>` (conforme a documentação da Qase).
- Sem o token, as telas/rotas dependentes da Qase retornam dados vazios, mas o app continua operacional.

# PR: chore: remove prisma; add BackendClient, test and httpx

## Resumo
Remoção dos artefatos gerados do Prisma e migrações; adição de um cliente Python leve para chamadas a serviços de IA e testes automatizados.

## Mudanças principais
- Removido: arquivos gerados do Prisma (migrations, `generated/`, `lib/prisma-*`, `prisma/`).
- Adicionado: `ai_applying/backend_client.py` (cliente HTTP), `ai_applying/test_backend_client.py` (script), `tests/test_backend_client_unit.py` (unit test com `respx`).
- Atualizado: `requirements.txt` (+ `httpx`, `pytest`, `respx`) e `.github/workflows/ci.yml` (rodar testes Python).

## Motivo
O projeto não usa mais SQL/Prisma; simplificamos o repositório e adicionamos um cliente de IA com cobertura básica de testes.

## Como testar localmente
```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pytest tests/test_backend_client_unit.py -q
```

## Sugestões
- Revisores: AnaLysyk, team-backend, team-qa
- Labels: chore, tests, ci

## Comando `gh` (local)
Execute localmente onde `gh` estiver configurado:

```bash
gh pr create \
  --title "chore: remove prisma; add BackendClient, test and httpx" \
  --body-file PR_BODY.md \
  --base main \
  --head chore/remove-prisma-backendclient \
  --reviewer AnaLysyk \
  --reviewer team-backend \
  --label chore \
  ````markdown
  # PR: chore: remover Prisma; adicionar BackendClient, teste e httpx

  ## Resumo
  Remoção dos artefatos gerados do Prisma e das migrações; adição de um cliente Python leve para chamadas a serviços de IA e cobertura básica de testes automatizados.

  ## Mudanças principais
  - Removido: arquivos gerados do Prisma (migrations, `generated/`, `lib/prisma-*`, `prisma/`).
  - Adicionado: `ai_applying/backend_client.py` (cliente HTTP), `ai_applying/test_backend_client.py` (script de verificação), `tests/test_backend_client_unit.py` (teste unitário com `respx`).
  - Atualizado: `requirements.txt` (adicione `httpx`, `pytest`, `respx`) e `.github/workflows/ci.yml` (rodar testes Python).

  ## Motivo
  O projeto não usa mais SQL/Prisma; simplificamos o repositório e acrescentamos um cliente de IA com testes básicos para facilitar integração contínua.

  ## Como testar localmente
  ```bash
  python -m pip install --upgrade pip
  python -m pip install -r requirements.txt
  python -m pytest tests/test_backend_client_unit.py -q
  ```

  ## Sugestões
  - Revisores: AnaLysyk, team-backend, team-qa
  - Labels: `chore`, `tests`, `ci`

  ## Comando `gh` (local)
  Execute localmente onde o `gh` estiver configurado:

  ```bash
  gh pr create \
    --title "chore: remover Prisma; adicionar BackendClient, teste e httpx" \
    --body-file PR_BODY.md \
    --base main \
    --head i18n/translate-to-pt \
    --reviewer AnaLysyk \
    --reviewer team-backend \
    --label chore \
    --label tests \
    --label ci
  ```

  Ou abra no navegador (preenchido):
  https://github.com/AnaLysyk/Quality_Control/pull/new/i18n/translate-to-pt?title=chore%3A%20remover%20Prisma%3B%20adicionar%20BackendClient%2C%20teste%20e%20httpx

  ````

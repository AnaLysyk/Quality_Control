# Migração: adicionar `qase_project_codes` e habilitar múltiplos projetos Qase por empresa

Resumo

- Objetivo: persistir corretamente múltiplos códigos de projeto Qase por `Company` e manter compatibilidade com o campo legado `qase_project_code` (primeiro item).
- Alterações principais: adicionamos `qase_project_codes` no Prisma schema, atualizamos `pgStore.ts` para ler/gravar arrays, ajustamos rotas para enviar/retornar `qase_project_codes`, e protegemos o `syncCompanyApplications` contra duplicados (usa `upsert`).

Passos para executar localmente (dev/staging):

1. Atualizar schema e gerar client (dev):

```bash
npx prisma migrate dev --name add_qase_project_codes
npx prisma generate
```

Em ambientes de deploy (staging/prod):

```bash
npx prisma migrate deploy
# depois (se necessário)
npx prisma generate
```

2. Backfill (preparar e executar em staging antes de prod):
- Há scripts de backfill em `scripts/backfill/` e `scripts/migrate-legacy-integrations.ts`.
- Rodar com `--dry-run` (quando disponível) e revisar logs, depois rodar sem `--dry-run`.

3. Rotação de tokens (crítico):
- Se tokens reais foram expostos, revogar e rotacionar os `qase_token`, `jira_api_token`, e quaisquer access/refresh tokens usados.
- Atualize segredos/vars nos ambientes (Render/Vercel/GitHub Actions) e no DB quando aplicável.

4. Execução do sync e verificação:
- O endpoint `POST /api/clients` agora aceita `qase_project_codes` (array) e cria/atualiza `applications` via `syncCompanyApplications`.
- Valide que para cada `qase_project_code` existe uma `Application` (slug único por empresa).

Notas de compatibilidade

- `qase_project_code` permanece no schema como compatibilidade legada, e é populado como o primeiro item de `qase_project_codes` quando apropriado.
- Frontend deve enviar ambos: `qase_project_codes` (array) e `qase_project_code` (primeiro item) para garantir compatibilidade com integrações/consumidores legados.

Teste local

- Rode a suíte de testes completa:

```bash
npm test
```

- Teste de integração específico do Qase:

```bash
npm test -- tests/integration/qase-persistence.test.ts -t "creates applications when client is created with qase project codes" --runInBand
```

Checklist PR

- [ ] Documentar no PR o resumo da migração e riscos
- [ ] Instruções de rollback (manter backups antes de migrar em prod)
- [ ] Confirmar rotação de tokens/segredos expostos
- [ ] Rodar backfill em staging e validar apps criadas

Contato

Se preferir, eu posso executar os comandos de migração/PR aqui (push + abrir PR) — confirme que o repositório remoto está correto e que posso criar um branch e um PR.
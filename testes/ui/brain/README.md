# testes/ui/brain

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/ui/brain
```

## Arquivos e casos de teste

### `brain-agents.spec.ts` (e2e (playwright))

- brain agents tab renders agent selectors
- brain agents tab switches agent modes
- brain agent sends message and receives streaming response
- brain agent input disabled while loading and send button inactive when empty
- brain agents tab messages area starts empty with quick prompts

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/brain/brain-agents.spec.ts
```

Vercel Support Ticket Draft

Project: qualitycontrol/painel-qa
Deployment URL: https://painel-6mwmyn367-qualitycontrol.vercel.app
Deployment ID: dpl_HU6mZ5A1mo7qrBJSsTvYdXBwvx4u
Created: Tue Feb 03 2026 11:44:34 GMT-0300 (BRT)
Status: Error (build shows [0ms], no logs available via CLI)

Issue summary:
The deployment above failed immediately with status "Error" and the Builds section reports a duration of "[0ms]". The Vercel CLI `logs` command returns "Deployment not ready. Currently: ● Error" and `vercel inspect` shows no build logs. Local builds succeed and recent commits only add unit tests and a small types fix.

What I already checked:
- Ran `npx vercel inspect` on the deployment (attached below).
- Attempted `npx vercel logs <deployment-url>`; logs are not retrievable for the failed deployment.
- Confirmed local `npm run build` completes successfully.
- Attached the repo diff for the recent commits pushed before the failed deployment.

Attached files:
- DEPLOYMENT_REPORT_dpl_HU6mZ5A1mo7qrBJSsTvYdXBwvx4u.md (includes `vercel inspect` output and git diff)

Suggested questions for Vercel support (please include in reply):
1. Why did the build not start/expose logs for this deployment id? Is there a worker provisioning or orchestration failure on your side?
2. Are there platform-side rate/quotas or environment issues that could cause the builder to fail immediately with no logs?
3. Can you provide any internal logs or a trace for `dpl_HU6mZ5A1mo7qrBJSsTvYdXBwvx4u` (timestamp included above)?
4. If needed, we can re-trigger a new deploy; advise if any special flags or environment toggles are helpful for debugging.

Inspect output (excerpt):
  General
    id          dpl_HU6mZ5A1mo7qrBJSsTvYdXBwvx4u
    name        painel-qa
    target      production
    status      ● Error
    url         https://painel-6mwmyn367-qualitycontrol.vercel.app
    created     Tue Feb 03 2026 11:44:34 GMT-0300 (BRT)

  Builds
    ```markdown
    Rascunho de chamado para suporte Vercel

    Projeto: qualitycontrol/painel-qa
    URL do deploy: https://painel-6mwmyn367-qualitycontrol.vercel.app
    ID do deploy: dpl_HU6mZ5A1mo7qrBJSsTvYdXBwvx4u
    Criado em: Tue Feb 03 2026 11:44:34 GMT-0300 (BRT)
    Status: Error (build mostra [0ms], sem logs acessíveis via CLI)

    Resumo do problema:
    O deploy acima falhou imediatamente com status "Error" e a seção de Builds indica duração "[0ms]". O comando `vercel logs` retorna "Deployment not ready. Currently: ● Error" e o `vercel inspect` não apresenta logs de build. Builds locais funcionam corretamente e os commits recentes adicionaram apenas testes unitários e uma pequena correção de tipos.

    O que já verificamos:
    - Rodei `npx vercel inspect` no deployment (saída anexada abaixo).
    - Tentei `npx vercel logs <deployment-url>`; os logs do deployment não estão disponíveis.
    - Confirmei que `npm run build` roda localmente sem erros.
    - Anexei o diff do repositório referente aos commits recentes anteriores ao deploy.

    Arquivos anexados:
    - `DEPLOYMENT_REPORT_dpl_HU6mZ5A1mo7qrBJSsTvYdXBwvx4u.md` (inclui `vercel inspect` e diff git)

    Perguntas sugeridas para o suporte Vercel (por favor incluir na resposta):
    1. Por que o build não iniciou/exibiu logs para este deployment id? Há falha na provisão de workers ou na orquestração?
    2. Existem limites/rate quotas ou problemas de ambiente na plataforma que poderiam causar uma falha imediata sem logs?
    3. Podem fornecer logs internos ou um trace para `dpl_HU6mZ5A1mo7qrBJSsTvYdXBwvx4u` (inclua timestamp acima)?
    4. Se necessário, podemos re-disparar um novo deploy; indiquem flags ou variáveis de ambiente úteis para depuração.

    Trecho do `inspect` (resumo):
      Geral
        id          dpl_HU6mZ5A1mo7qrBJSsTvYdXBwvx4u
        name        painel-qa
        target      production
        status      ● Error
        url         https://painel-6mwmyn367-qualitycontrol.vercel.app
        created     Tue Feb 03 2026 11:44:34 GMT-0300 (BRT)

      Builds
        ╶ .        [0ms]

    Diff Git (recente):
    - src/types/user.ts : remoção de export duplicado
    - tests/mocks/server-only.js : adição de mock para jest
    - tests/session/session.store.test.ts : adição de testes unitários para session store

    Por favor orientem próximos passos ou solicitem artefatos adicionais que eu anexo.

    ``` 

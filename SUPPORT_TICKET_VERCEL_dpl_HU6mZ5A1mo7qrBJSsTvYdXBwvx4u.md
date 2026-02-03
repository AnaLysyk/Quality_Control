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
    ╶ .        [0ms]

Git diff (recent):
- src/types/user.ts : remove duplicate export line
- tests/mocks/server-only.js : add jest mock
- tests/session/session.store.test.ts : add unit tests for session store

Please advise next steps or request additional artifacts and I will attach them.

GitHub Issue Draft: Production deployment failing on Vercel

Title: Production deploy failing on Vercel (dpl_HU6mZ5A1mo7qrBJSsTvYdXBwvx4u)

Summary:
A recent deployment to production on Vercel failed immediately with status "Error" and no build logs were produced. Local `npm run build` completes successfully. The failure appears to be an infra/platform issue on Vercel rather than a code compilation problem.

Deployment info:
- URL: https://painel-6mwmyn367-qualitycontrol.vercel.app
- Deployment ID: dpl_HU6mZ5A1mo7qrBJSsTvYdXBwvx4u
- Created: Tue Feb 03 2026 11:44:34 GMT-0300 (BRT)
- Vercel inspect shows Builds: `.` [0ms]

Recent commits included in this deployment (HEAD~3..HEAD):
- Remove duplicate export in `src/types/user.ts`
- Add `tests/mocks/server-only.js` (jest mock)
- Add `tests/session/session.store.test.ts` (unit tests)

Steps we've taken:
- Ran `npx vercel inspect <url>` and `npx vercel logs <url>`; CLI could not retrieve build logs for the failed deployment.
- Verified local `npm run build` succeeds.
- Created report file `DEPLOYMENT_REPORT_dpl_HU6mZ5A1mo7qrBJSsTvYdXBwvx4u.md` and attached to this issue (repo).

Request:
- Can infra/devops check the Vercel dashboard logs for this deployment id and share the build output? If the dashboard shows no logs, please escalate to Vercel support and attach any internal traces.

Suggested next actions (for infra):
- Inspect Vercel Dashboard for the deployment and copy the full build output.
- If dashboard logs are missing, open Vercel support ticket with the deployment id and timestamp.
- Optionally re-trigger a deployment (no-op commit) and capture logs immediately via Vercel dashboard.

Attachments:
- DEPLOYMENT_REPORT_dpl_HU6mZ5A1mo7qrBJSsTvYdXBwvx4u.md

Tagging: @infra @devops @qa

Please let me know if you want me to open the support ticket (draft prepared) or to re-trigger a fresh deployment and stream logs.

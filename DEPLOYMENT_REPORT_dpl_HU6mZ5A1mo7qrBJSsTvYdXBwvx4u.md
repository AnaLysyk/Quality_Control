Vercel Deployment Report

Deployment: https://painel-6mwmyn367-qualitycontrol.vercel.app
Deployment ID: dpl_HU6mZ5A1mo7qrBJSsTvYdXBwvx4u
Status: Error
Created: Tue Feb 03 2026 11:44:34 GMT-0300 (Horário Padrão de Brasília)

Inspect output (builds):
  .        [0ms]

Interpretation:
- The build step shows [0ms] and there are no build logs available via the CLI for this deployment. This typically indicates the build did not start on Vercel or crashed before producing logs (provisioning/worker problem), or the Vercel platform failed to execute the builder.

Collected git diff (HEAD~3..HEAD):

--- begin diff ---

diff --git a/src/types/user.ts b/src/types/user.ts
index be64689..b3614b2 100644
--- a/src/types/user.ts
+++ b/src/types/user.ts
@@ -1,2 +1 @@
 export type { AppUser, AppCompany } from "../../app/types/User";
-export type { AppUser, AppCompany } from "../../app/types/User";
diff --git a/tests/mocks/server-only.js b/tests/mocks/server-only.js
new file mode 100644
index 0000000..6e440e8
--- /dev/null
+++ b/tests/mocks/server-only.js
@@ -0,0 +1,2 @@
+// Mock for `server-only` package used in server modules
+module.exports = {};
diff --git a/tests/session/session.store.test.ts b/tests/session/session.store.test.ts
new file mode 100644
index 0000000..20ce062
--- /dev/null
+++ b/tests/session/session.store.test.ts
@@ -0,0 +1,95 @@
+(...tests content omitted here, included in repository file...)

--- end diff ---

Suggested next steps for infra/CI team:
- Check the Vercel Dashboard build logs for deployment ID above (dashboard often has more info when CLI shows no logs).
- Verify Vercel builder workers and quota for the team (sometimes deployments fail at orchestration time).
- If dashboard shows no logs either, open a Vercel support ticket including the `dpl_HU6mZ5A1mo7qrBJSsTvYdXBwvx4u` id and timestamp, and attach this report.

I can open a Vercel support ticket draft or prepare a message to send to infra; tell me which you prefer.

Prisma migration: add `qase_token` to `Company`

This branch adds the `qase_token` field to the Prisma schema and updates the PG store code to persist it.

Important: the database must be migrated before running the app in PostgreSQL mode (i.e. when `DATABASE_URL` is set and `AUTH_STORE` is not `json`/`redis`). Without the DB migration, the server will error because the Prisma client expects the `qase_token` column to exist.

Recommended steps to apply the migration locally or in a non-production environment:

1. Ensure you have a recent backup of the target database. Do not run migrations directly on production without approval.

2. Switch to the branch with these changes:

```bash
git fetch origin
git checkout feat/persist-qase-token
```

3. (Optional) If you previously generated the Prisma client, regenerate it after the migration step below. The `migrate` command will run `prisma generate` automatically in many flows, but you can also run it manually.

4. Create and apply the migration (development):

```bash
# interactive dev migration (creates migration and applies it)
npx prisma migrate dev --name add-qase-token
```

This will:
- Create a new migration under `prisma/migrations/` with the SQL to add the `qase_token` column.
- Apply the migration to the database.
- Regenerate the Prisma client.

5. For production or CI (deploy), prefer `prisma migrate deploy` after publishing the migration files, or use your CI to run:

```bash
npx prisma migrate deploy
npx prisma generate
```

6. Verify the column exists and the app works:

- Start the app: `npm run dev` or `npm run build && npm start` depending on environment.
- Create or update a company with a `qase_token` and confirm the token is returned by the API and visible in the admin UI.

Notes & safe checklist:
- If using Render/Heroku/Vercel with preview/prod DBs, coordinate with the ops admin.
- If you cannot run the migration now, you can still review the schema/code changes in the branch; but the running app will fail when it attempts DB queries that reference `qase_token`.

If you'd like, I can:
- Create the PR for you (title + description) and push it (branch already pushed).
- Attempt to run the migration against a configured dev DB here (requires DATABASE_URL and permission).
- Generate the SQL diff and include it in the PR so your DB admin can apply it manually.
Tell me which option you prefer.

Render outbound IPs
--------------------
If you're deploying to Render, please note the outbound IP ranges that you may need to whitelist in external services (database firewalls, APIs, etc.). Add these to your ops checklist before deploying the new service.

- 74.220.48.0/24
- 74.220.56.0/244  # verify mask — common value is /24

I can add these to a dedicated file in the repo or include them in the PR description.
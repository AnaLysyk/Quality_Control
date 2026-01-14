import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tryLoadDotenv = (envFilePath) => {
  try {
    if (!fs.existsSync(envFilePath)) return false;
    const raw = fs.readFileSync(envFilePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
    return true;
  } catch {
    return false;
  }
};

const repoRoot = path.resolve(__dirname, '..');
tryLoadDotenv(path.join(repoRoot, '.env.local'));
tryLoadDotenv(path.join(repoRoot, '.env'));

let baseUrl = process.env.CRON_SNAPSHOTS_API_URL;
let accessToken = process.env.ACCESS_TOKEN;
const limit = Number.parseInt(process.env.LIMIT || '50', 10);
const jobid = process.env.JOBID;

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!baseUrl && supabaseUrl) {
  baseUrl = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/cron-snapshots-api`;
}

const promptMissing = async () => {
  if (baseUrl && accessToken) return;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (!baseUrl) {
      const entered = (await rl.question(
        'CRON_SNAPSHOTS_API_URL not set. Paste full URL (Enter to abort): '
      )).trim();
      if (!entered) process.exit(2);
      baseUrl = entered;
    }

    if (!accessToken) {
      const entered = (await rl.question(
        'ACCESS_TOKEN (JWT) optional. Paste to test authenticated flow, or press Enter to continue unauthenticated: '
      )).trim();
      if (entered) accessToken = entered;
    }
  } finally {
    rl.close();
  }
};

await promptMissing();

if (!baseUrl) {
  console.error('Missing CRON_SNAPSHOTS_API_URL.');
  console.error(
    'Set one of these options:\n' +
      '  1) CRON_SNAPSHOTS_API_URL=https://<project-ref>.supabase.co/functions/v1/cron-snapshots-api\n' +
      '  2) NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co (script derives the functions URL)\n'
  );
  process.exit(2);
}

const makeUrl = () => {
  const u = new URL(baseUrl);
  if (jobid) {
    u.pathname = u.pathname.replace(/\/+$/, '') + '/' + encodeURIComponent(String(jobid));
  }
  u.searchParams.set('limit', String(limit));
  return u;
};

const run = async () => {
  const url = makeUrl();
  const headers = {
    Accept: 'application/json',
  };

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(url, { method: 'GET', headers });
  const text = await res.text();

  console.log('GET', url.toString());
  console.log('Status:', res.status);
  console.log('Body:', text);

  if (!res.ok) {
    console.log('\nTroubleshooting hints:');
    console.log('- If you get 401: token is invalid/expired or missing when required.');
    console.log('- If you get 403: RLS/policies are blocking this role (expected for non-admin).');
    console.log('- If you get 404: check the function name/path.');
    process.exit(1);
  }
};

run().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});

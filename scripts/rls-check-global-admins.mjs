import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

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

// Load env from repo root if present (Windows-friendly, avoids manual $env:... setup).
const repoRoot = path.resolve(__dirname, '..');
tryLoadDotenv(path.join(repoRoot, '.env.local'));
tryLoadDotenv(path.join(repoRoot, '.env'));

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let accessToken = process.env.ACCESS_TOKEN;
let email = process.env.TEST_EMAIL;
let password = process.env.TEST_PASSWORD;

if (!url || !anonKey) {
  const missing = [];
  if (!url) missing.push('SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)');
  if (!anonKey) missing.push('SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  console.error('Missing env vars:', missing.join(', '));
  console.error(
    'Set these in .env.local (recommended) or in your environment. Example:\n' +
      '  NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co\n' +
      '  NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>\n'
  );
  process.exit(2);
}
const viewName = process.env.VIEW_NAME || 'global_admins_view';
const limit = Number.parseInt(process.env.LIMIT || '10', 10);

const makeClient = () =>
  createClient(url, anonKey, {
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

const run = async () => {
  if (!accessToken && (!email || !password)) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const mode = (await rl.question('Auth mode: (1) ACCESS_TOKEN (JWT) or (2) email+password? [1/2]: ')).trim();
      if (mode === '1' || mode.toLowerCase() === 'jwt' || mode.toLowerCase() === 'token') {
        accessToken = (await rl.question('Paste ACCESS_TOKEN (JWT): ')).trim();
      } else {
        email = (await rl.question('TEST_EMAIL: ')).trim();
        password = (await rl.question('TEST_PASSWORD: ')).trim();
      }
    } finally {
      rl.close();
    }
  }

  const supabase = makeClient();

  if (!accessToken) {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error('Auth sign-in failed:', authError.message);
      process.exit(1);
    }

    const userId = authData?.user?.id;
    console.log('Signed in as user:', userId);
  } else {
    console.log('Using ACCESS_TOKEN (JWT)');
  }

  const { data, error } = await supabase.from(viewName).select('*').limit(limit);

  if (error) {
    console.error(`Query failed for view ${viewName}:`, error.message);
    console.error('Hint: if you see permission denied, you likely need GRANTs on the view and underlying tables.');
    process.exit(1);
  }

  console.log(`Rows returned from ${viewName}:`, Array.isArray(data) ? data.length : 0);
  console.log(JSON.stringify(data, null, 2));
};

run().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});

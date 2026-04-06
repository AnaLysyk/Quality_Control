const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const repoRoot = path.resolve(__dirname, '..');

for (const envFile of ['.env.local', '.env']) {
  const envPath = path.join(repoRoot, envFile);
  if (!fs.existsSync(envPath)) continue;
  dotenv.config({ path: envPath, processEnv: process.env, quiet: true });
}

process.env.AUTH_STORE = 'postgres';
process.env.TICKETS_STORE = 'postgres';

const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const repoRoot = path.resolve(__dirname, "..");
const envLocalPath = path.join(repoRoot, ".env.local");
const envPath = path.join(repoRoot, ".env");

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

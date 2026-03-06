// Usage: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars, then run:
//   node tmp/migrate_to_upstash.js

const fs = require('fs');
const path = require('path');

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!URL || !TOKEN) {
  console.error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
  console.error('Set the env vars and try again.');
  process.exit(1);
}

async function upstashSet(key, value) {
  const endpoint = `${URL}/set/${encodeURIComponent(key)}`;
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const res = await fetch(endpoint, { method: 'POST', headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'text/plain' }, body: serialized });
  if (!res.ok) {
    const txt = await res.text().catch(()=>null);
    throw new Error('Upstash set failed: ' + res.status + ' ' + txt);
  }
  return res.json();
}

(async ()=>{
  try{
    const dataDir = path.resolve(process.cwd(), 'data');
    if(!fs.existsSync(dataDir)) { console.error('No data/ folder found'); process.exit(1); }
    const files = fs.readdirSync(dataDir).filter(f=>f.endsWith('.json'));
    console.log('Found', files.length, 'files in data/ to migrate');
    for(const f of files){
      const full = path.join(dataDir, f);
      const key = f.replace(/\.json$/,'');
      const txt = fs.readFileSync(full,'utf8');
      let parsed;
      try{ parsed = JSON.parse(txt); } catch(e){ parsed = txt; }
      console.log('Migrating', key);
      await upstashSet(key, parsed);
      console.log('-> migrated', key);
    }
    console.log('Migration complete');
  }catch(e){
    console.error('Migration error', e);
    process.exit(1);
  }
})();

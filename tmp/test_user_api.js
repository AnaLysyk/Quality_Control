(async ()=>{
  try{
    const base='http://localhost:3001';
    const fetch = globalThis.fetch;
    if(!fetch) throw new Error('fetch not available in this Node');

    // login as admin
    const loginRes = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: 'admin@griaule.test', password: 'Griaule@123' }),
    });
    if (!loginRes.ok) {
      console.log('LOGIN FAILED', loginRes.status);
    }
    const raw = loginRes.headers.get('set-cookie') || '';
    const cookie = raw.split(/, (?=[^;]+=)/).map(s=>s.split(';')[0]).join('; ');

    const create = await fetch(base + '/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({ name: 'Test User AI', email: 'test.user+ai@griaule.test', role: 'user', client_id: 'c_testing' })
    });
    console.log('CREATE STATUS', create.status);
    const j = await create.json().catch(()=>null);
    console.log('CREATE BODY', JSON.stringify(j));
    // API returns { ok: true } for creation; fetch the users list to find the new user
    const listRes = await fetch(base + '/api/admin/users?q=' + encodeURIComponent('test.user+ai@griaule.test'), { headers: { Cookie: cookie }});
    const listJson = await listRes.json().catch(()=>null);
    const id = listJson?.items?.[0]?.id;
    if(!id){ console.error('no id found after create', JSON.stringify(listJson)); process.exit(1); }

    const patch = await fetch(base + '/api/admin/users/' + id + '/permissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({ allow: { tickets: ['view','create'] }, deny: {} })
    });
    console.log('PATCH STATUS', patch.status);
    const pj = await patch.json().catch(()=>null);
    console.log('PATCH BODY', JSON.stringify(pj));

    const fs = require('fs');
    try{
      const usersFs = fs.readFileSync('data/users.json', 'utf8');
      console.log('DATA users.json (start):', usersFs.slice(0,2000));
    }catch(e){ console.log('READ users.json ERROR', String(e)); }

    try{
      const overridesFs = fs.readFileSync('data/permissionOverrides.json', 'utf8');
      console.log('DATA permissionOverrides.json (start):', overridesFs.slice(0,2000));
    }catch(e){ console.log('READ permissionOverrides.json ERROR', String(e)); }

  }catch(e){ console.error('ERROR', e); process.exit(1); }
})();

(async () => {
  try {
    const base = 'http://localhost:3005';
    const loginRes = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: 'admin@griaule.test', password: 'Griaule@123' }),
    });
    console.log('LOGIN STATUS', loginRes.status);
    const setCookie = loginRes.headers.get('set-cookie');
    console.log('SET-COOKIE:', setCookie);

    const cookies = [];
    // collect all set-cookie headers if present
    const raw = loginRes.headers.get('set-cookie');
    if (raw) cookies.push(raw.split(/, (?=[^;]+=)/).map(s=>s.split(';')[0]).join('; '));

    if (!cookies.length) {
      // try to read multiple headers fallback
      const all = [];
      for (const [k,v] of loginRes.headers) {
        if (k.toLowerCase() === 'set-cookie') all.push(v);
      }
      if (all.length) cookies.push(all.join('; '));
    }

    const cookieHeader = cookies[0] ?? '';
    console.log('COOKIE-HEADER:', cookieHeader);

    const suportes = await fetch(base + '/api/suportes?companySlug=test-company&scope=all', {
      headers: { Cookie: cookieHeader },
    });
    console.log('SUPORTES STATUS', suportes.status);
    const json = await suportes.text();
    console.log('SUPORTES BODY:', json.slice(0, 2000));
  } catch (err) {
    console.error('ERROR', err);
  }
})();

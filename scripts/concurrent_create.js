(async () => {
  try {
    const base = 'http://localhost:3005';
    const loginRes = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: 'admin@griaule.test', password: 'Griaule@123' }),
    });
    console.log('LOGIN STATUS', loginRes.status);
    const raw = loginRes.headers.get('set-cookie') || '';
    const cookies = [];
    if (raw) cookies.push(raw.split(/, (?=[^;]+=)/).map((s) => s.split(';')[0]).join('; '));
    const cookieHeader = cookies[0] ?? '';
    console.log('COOKIE-HEADER', cookieHeader.slice(0, 80));

    const posts = Array.from({ length: 5 }).map((_, i) =>
      fetch(base + '/api/chamados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
        body: JSON.stringify({ title: 'Concurrent test ' + (i + 1), description: 'concurrent create', companySlug: 'test-company' }),
      })
        .then(async (res) => ({ status: res.status, body: await res.text().catch(() => '') }))
        .catch((e) => ({ error: String(e) })),
    );

    const results = await Promise.all(posts);
    console.log('POST RESULTS', JSON.stringify(results, null, 2));

    const suportes = await fetch(base + '/api/suportes?companySlug=test-company&scope=all', {
      headers: { Cookie: cookieHeader },
    });
    console.log('SUPORTES STATUS', suportes.status);
    const body = await suportes.text();
    console.log('SUPORTES BODY', body.slice(0, 8000));
  } catch (err) {
    console.error('ERROR', err);
  }
})();

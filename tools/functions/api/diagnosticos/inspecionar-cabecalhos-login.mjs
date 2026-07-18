const ports = [3000,3001];
const payload = { user: 'admin@griaule.test', password: (process.env.E2E_ADMIN_PASSWORD || process.env.E2E_PROFILE_PASSWORD || "Demo@123") };

function cookieNames(value) {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,=]+=[^;,]+)/).map((cookie) => cookie.split("=", 1)[0].trim());
}

(async () => {
  for (const port of ports) {
    try {
      const base = `http://localhost:${port}`;
      console.log('\nTrying', base);
      const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      console.log('status', res.status);
      const sc = res.headers.get('set-cookie');
      console.log('cookies recebidos:', cookieNames(sc));
      for (const k of res.headers.keys()) {
        if (["set-cookie", "authorization", "cookie"].includes(k.toLowerCase())) continue;
        console.log('header:', k, res.headers.get(k));
      }
    } catch (e) {
      console.error('error', e.message || e);
    }
  }
})();

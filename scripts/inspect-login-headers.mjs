const ports = [3000,3001];
const payload = { user: 'admin@griaule.test', password: 'Griaule@123' };

(async () => {
  for (const port of ports) {
    try {
      const base = `http://localhost:${port}`;
      console.log('\nTrying', base);
      const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      console.log('status', res.status);
      const sc = res.headers.get('set-cookie');
      console.log('set-cookie (single):', sc);
      // some servers return multiple set-cookie; try to read raw headers via res.headers
      for (const k of res.headers.keys()) {
        console.log('header:', k, res.headers.get(k));
      }
    } catch (e) {
      console.error('error', e.message || e);
    }
  }
})();

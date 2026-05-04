const { Client } = require("pg");
const dns = require("dns");

const host = "dpg-d6r33ohj16oc73f058g0.oregon-postgres.render.com";

// Check DNS
dns.lookup(host, (err, addr) => {
  console.log("DNS:", err ? err.message : addr);
});

// Test with SSL true (default verification)
const connExt = `postgresql://quality_control_db_gepu_user:IcFolaph4EJDkMRFjBR7ZjCL4yb9WlPj@${host}/quality_control_db_gepu`;

async function testConnection(label, sslOpt) {
  const c = new Client({
    connectionString: connExt,
    ssl: sslOpt,
    connectionTimeoutMillis: 15000,
  });
  c.on("error", (e) => console.log(`  [${label}] client error event:`, e.message));
  try {
    await c.connect();
    const r = await c.query("SELECT 1 AS ok");
    console.log(`  [${label}] OK:`, r.rows);
    await c.end();
  } catch (e) {
    console.error(`  [${label}] FAIL:`, e.message);
    c.end().catch(() => {});
  }
}

(async () => {
  console.log("Test 1: ssl = true");
  await testConnection("ssl-true", true);
  console.log("Test 2: ssl = { rejectUnauthorized: false }");
  await testConnection("ssl-reject-false", { rejectUnauthorized: false });
  console.log("Test 3: ssl = false");
  await testConnection("ssl-false", false);
})();

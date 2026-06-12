const { Client } = require("pg");

const c = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

c.connect()
  .then(() => c.query("SELECT 1 AS ok"))
  .then((r) => { console.log("DB OK:", r.rows); return c.end(); })
  .catch((e) => { console.error("DB ERROR:", e.message); c.end().catch(() => {}); });

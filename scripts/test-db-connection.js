// Script de teste de conexão com PostgreSQL usando node-postgres
// Uso: node scripts/test-db-connection.js

const { Client } = require('pg');

const connectionString = process.env.DB_CHECK_DATABASE_URL?.trim();

if (!connectionString) {
  console.error('DB_CHECK_DATABASE_URL nao configurada. Configure a variavel para executar este diagnostico.');
  process.exit(1);
}

const client = new Client({
  connectionString,
});

(async () => {
  try {
    await client.connect();
    const res = await client.query('SELECT NOW() as now');
    console.log('Conexão bem-sucedida! Horário do banco:', res.rows[0].now);
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('Erro ao conectar no banco:', err.message);
    process.exit(1);
  }
})();

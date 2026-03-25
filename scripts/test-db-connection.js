// Script de teste de conexão com PostgreSQL usando node-postgres
// Uso: node scripts/test-db-connection.js

const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://quality_control_db_gepu_user:IcFolaph4EJDkMRFjBR7ZjCL4yb9WlPj@dpg-d6r33ohj16oc73f058g0-a.oregon-postgres.render.com/quality_control_db_gepu?sslmode=require';

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

// Prisma 7+ config in JS to avoid TS build errors
require('dotenv/config');
const { defineConfig } = require('prisma/config');

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
  client: {
    adapter: 'pg',
    url: process.env.DATABASE_URL,
  },
});

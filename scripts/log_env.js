// scripts/log_env.js
// Roda: node scripts/log_env.js

require('dotenv').config({ path: '.env.local' });

console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('POSTGRES_PRISMA_URL:', process.env.POSTGRES_PRISMA_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);

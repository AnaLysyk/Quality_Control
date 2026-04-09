// prisma/prisma.config.ts — Prisma 7.x datasource config
import { defineDatasource } from '@prisma/define-datasource';

export default defineDatasource({
  db: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL!,
  },
});

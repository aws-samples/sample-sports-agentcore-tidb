import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config();

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    host: process.env.TIDB_HOST!,
    port: parseInt(process.env.TIDB_PORT || '4000'),
    user: process.env.TIDB_USERNAME!,
    password: process.env.TIDB_PASSWORD!,
    database: process.env.TIDB_DATABASE || 'test',
    ssl: 'require'
  },
});

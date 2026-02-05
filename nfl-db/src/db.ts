import { drizzle, MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import * as schema from './schema';

// Load .env for local development
config();

interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

let dbConfig: DbConfig | null = null;
let poolConnection: mysql.Pool | null = null;
let dbInstance: MySql2Database<typeof schema> | null = null;

async function loadConfig(): Promise<DbConfig> {
  // If SECRETS_ARN is set, fetch from Secrets Manager (production)
  if (process.env.SECRETS_ARN) {
    console.log('Loading config from Secrets Manager...');
    const client = new SecretsManagerClient({});
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: process.env.SECRETS_ARN })
    );
    const secrets = JSON.parse(response.SecretString!);
    return {
      host: secrets.TIDB_HOST,
      port: parseInt(secrets.TIDB_PORT || '4000'),
      user: secrets.TIDB_USERNAME,
      password: secrets.TIDB_PASSWORD,
      database: secrets.TIDB_DATABASE || 'test',
    };
  }

  // Otherwise use environment variables (local development)
  console.log('Loading config from environment variables...');
  return {
    host: process.env.TIDB_HOST!,
    port: parseInt(process.env.TIDB_PORT || '4000'),
    user: process.env.TIDB_USERNAME!,
    password: process.env.TIDB_PASSWORD!,
    database: process.env.TIDB_DATABASE || 'test',
  };
}

export async function initDb() {
  if (dbInstance) return dbInstance;

  dbConfig = await loadConfig();

  poolConnection = mysql.createPool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
    waitForConnections: true,
    connectionLimit: 10,
  });

  dbInstance = drizzle(poolConnection, { schema, mode: 'default' });
  console.log('Database connection initialized');
  return dbInstance;
}

// For scripts that need raw SQL (vector operations)
export async function createRawConnection() {
  if (!dbConfig) {
    dbConfig = await loadConfig();
  }

  return mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
  });
}

// Lazy getter for db - throws if not initialized
export function getDb() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbInstance;
}

export { schema };
export * from './schema';

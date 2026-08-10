import { Pool } from 'pg';

/**
 * Singleton Postgres connection pool. Next.js API routes are stateless
 * functions but they share module scope in the same process, so this
 * pool is created once and reused across requests.
 *
 * In production, set DATABASE_URL to your managed Postgres URL.
 * In development, it points to the Docker Compose Postgres container.
 */
let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL environment variable is required. ' +
        'Copy .env.example to .env and fill in the value.',
      );
    }

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Maximum number of clients in the pool. Keep low for serverless-style
      // deployments where many short-lived processes might share a DB.
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }

  return pool;
}
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Applies all SQL migration files to the database.
 * Run with: npm run migrate
 *
 * Requires DATABASE_URL to be set in your .env file.
 * Make sure Postgres is running first: docker compose up postgres
 */
async function migrate(): Promise<void> {
  const connectionString =
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/code_review_platform';

  const pool = new Pool({ connectionString });

  try {
    console.log('Running migrations...');

    const sql = readFileSync(
      join(process.cwd(), 'migrations/001_create_reviews.sql'),
      'utf8',
    );

    await pool.query(sql);
    console.log('✓ Migration 001_create_reviews applied');
  } catch (err) {
    console.error('✗ Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
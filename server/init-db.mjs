// server/init-db.mjs
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const sql = `
    CREATE TABLE IF NOT EXISTS opportunities (
      id          SERIAL PRIMARY KEY,
      data        JSONB NOT NULL,
      scraped_at  TIMESTAMPTZ DEFAULT now()
    );
  `;
  console.log('Creating opportunities table if not exists...');
  await pool.query(sql);
  console.log('Done.');
  await pool.end();
}

main().catch(err => {
  console.error('Error creating table:', err);
  process.exit(1);
});

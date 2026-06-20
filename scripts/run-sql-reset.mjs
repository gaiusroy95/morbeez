#!/usr/bin/env node
/**
 * Execute a SQL reset script against Supabase Postgres.
 *
 * Requires DATABASE_URL in backend/.env (Supabase → Project Settings → Database → URI).
 *   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 *
 * Usage:
 *   npm run db:reset-retest -- --confirm
 *   node scripts/run-sql-reset.mjs scripts/sql/reset-transactional-keep-products.sql --confirm
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv() {
  const path = join(root, 'backend', '.env');
  if (!existsSync(path)) {
    console.error('Missing backend/.env');
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(path, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[t.slice(0, eq).trim()] = val;
  }
  return env;
}

async function main() {
  const args = process.argv.slice(2);
  const sqlFile =
    args.find((a) => a.endsWith('.sql')) ??
    join(root, 'scripts', 'sql', 'reset-transactional-keep-products.sql');

  if (!args.includes('--confirm')) {
    console.error(
      'This runs a destructive SQL reset (keeps product catalog).\n' +
        `File: ${sqlFile}\n` +
        'Re-run with: npm run db:reset-retest -- --confirm'
    );
    process.exit(1);
  }

  const env = loadEnv();
  const databaseUrl =
    env.DATABASE_URL ||
    env.SUPABASE_DB_URL ||
    env.POSTGRES_URL ||
    env.SUPABASE_DATABASE_URL;
  if (!databaseUrl) {
    const dbKeys = Object.keys(env).filter((k) => /DATABASE|DB_URL|POSTGRES/i.test(k));
    console.error(
      'DATABASE_URL is missing or empty in backend/.env.\n' +
        (env.SUPABASE_URL
          ? 'Note: SUPABASE_URL is the REST API URL — SQL reset needs a separate Postgres URI (DATABASE_URL).\n'
          : '') +
        (dbKeys.length ? `Found related keys (empty or wrong name?): ${dbKeys.join(', ')}\n` : '') +
        'Add to backend/.env (Supabase → Project Settings → Database → Connection string → URI, pooler port 6543):\n' +
        '  DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres\n' +
        'Alternatively paste the SQL file into Supabase Dashboard → SQL Editor:\n' +
        `  ${sqlFile}`
    );
    process.exit(1);
  }

  let pg;
  try {
    pg = await import('pg');
  } catch {
    console.error(
      'Install pg to run SQL from CLI: npm install pg --save-dev\n' +
        'Or paste scripts/sql/reset-transactional-keep-products.sql into Supabase SQL Editor.'
    );
    process.exit(1);
  }

  const sql = readFileSync(sqlFile, 'utf8');
  const client = new pg.default.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

  console.log(`⚠️  Running SQL reset: ${sqlFile}\n`);
  await client.connect();
  try {
    await client.query(sql);
    console.log('Reset complete. Employee database and product/inventory catalog preserved.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

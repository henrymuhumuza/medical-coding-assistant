import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'] });

async function main() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (!url || !authToken) {
    throw new Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN first.');
  }

  console.log(`[TursoCheck] URL: ${url}`);
  console.log(`[TursoCheck] Token present: ${authToken.length} characters`);

  const client = createClient({ url, authToken });

  console.log('[TursoCheck] Running SELECT 1...');
  const selectResult = await client.execute('SELECT 1 AS ok');
  console.log('[TursoCheck] SELECT result:', selectResult.rows);

  console.log('[TursoCheck] Creating tiny diagnostic table...');
  await client.execute('CREATE TABLE IF NOT EXISTS turso_connection_check (id INTEGER PRIMARY KEY, created_at TEXT)');
  console.log('[TursoCheck] CREATE TABLE worked.');

  console.log('[TursoCheck] Inserting diagnostic row...');
  await client.execute({
    sql: 'INSERT INTO turso_connection_check (created_at) VALUES (?)',
    args: [new Date().toISOString()],
  });
  console.log('[TursoCheck] INSERT worked.');
}

main().catch((error) => {
  console.error('[TursoCheck] Failed:', error);
  process.exit(1);
});

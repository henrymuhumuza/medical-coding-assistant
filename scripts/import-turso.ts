import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'] });

type CodeType = 'ICD10' | 'CPT' | 'HCPCS';

interface CodeRow {
  code: string;
  type: CodeType;
  description: string;
  category: string;
  search_text: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else current += char;
  }

  result.push(current);
  return result.map(s => s.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
}

function parseCSV(content: string, isCpt = false): Array<{ code: string; description: string }> {
  const lines = content.split(/\r?\n/);
  const header = parseCSVLine(lines[0] || '').map(h => h.toLowerCase());
  const codeIdx = Math.max(0, header.findIndex(h => h === 'code' || h === 'hcpcs' || (isCpt && h.includes('hcpcs'))));
  const descIdx = Math.max(1, header.findIndex(h => h === 'description'));

  return lines.slice(1).flatMap((line) => {
    if (!line.trim()) return [];
    const cols = parseCSVLine(line);
    const code = cols[codeIdx]?.trim();
    const description = cols[descIdx]?.trim();
    return code && description ? [{ code, description }] : [];
  });
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function makeSearchText(row: Omit<CodeRow, 'search_text'>) {
  return normalize(`${row.code} ${row.description} ${row.category}`);
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (!url || !authToken) {
    throw new Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before running this script.');
  }

  const client = createClient({ url, authToken });
  const dataDir = path.resolve(process.cwd(), 'data');
  const rowsByKey = new Map<string, CodeRow>();

  function addRow(row: CodeRow) {
    rowsByKey.set(`${row.type}:${row.code}`, row);
  }

  const icdPath = path.join(dataDir, 'icd_10_cm.csv');
  if (fs.existsSync(icdPath)) {
    for (const row of parseCSV(fs.readFileSync(icdPath, 'utf8'))) {
      const codeRow = {
        code: row.code,
        type: 'ICD10' as CodeType,
        description: row.description,
        category: 'Diagnoses',
      };
      addRow({ ...codeRow, search_text: makeSearchText(codeRow) });
    }
  }

  const cptPath = path.join(dataDir, 'cpt.csv');
  if (fs.existsSync(cptPath)) {
    for (const row of parseCSV(fs.readFileSync(cptPath, 'utf8'), true)) {
      const type: CodeType = /^[A-Za-z]/.test(row.code) ? 'HCPCS' : 'CPT';
      const codeRow = {
        code: row.code,
        type,
        description: row.description,
        category: type === 'HCPCS' ? 'HCPCS' : 'CPT',
      };
      addRow({ ...codeRow, search_text: makeSearchText(codeRow) });
    }
  }

  const rows = Array.from(rowsByKey.values());
  console.log(`[TursoImport] Preparing to import ${rows.length} codes...`);

  async function executeStep(label: string, sql: string) {
    try {
      console.log(`[TursoImport] ${label}...`);
      await client.execute(sql);
    } catch (error) {
      console.error(`[TursoImport] Failed during: ${label}`);
      throw error;
    }
  }

  await executeStep(
    'Creating codes table',
    'CREATE TABLE IF NOT EXISTS codes (code TEXT NOT NULL, type TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, search_text TEXT NOT NULL, PRIMARY KEY (code, type))'
  );
  await executeStep('Creating type index', 'CREATE INDEX IF NOT EXISTS idx_codes_type ON codes(type)');
  await executeStep('Clearing old rows', 'DELETE FROM codes');

  const batchSize = 150;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await client.batch(
      batch.map(row => ({
        sql: `
          INSERT OR REPLACE INTO codes (code, type, description, category, search_text)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: [row.code, row.type, row.description, row.category, row.search_text],
      })),
      'write'
    );
    console.log(`[TursoImport] Imported ${Math.min(i + batch.length, rows.length)} / ${rows.length}`);
  }

  console.log('[TursoImport] Complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

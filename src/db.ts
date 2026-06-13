/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { CodeType, Code } from './types.ts';

// In-Memory Database store representing the seeded standard clinic codes
const CODES_DATABASE: Code[] = [
  // ICD-10-CM Codes (Diagnoses)
  { id: 1, code: 'E11.9', type: CodeType.ICD10, description: 'Type 2 diabetes mellitus without complications', category: 'Endocrine, nutritional and metabolic diseases' },
  { id: 2, code: 'E11.65', type: CodeType.ICD10, description: 'Type 2 diabetes mellitus with hyperglycemia', category: 'Endocrine, nutritional and metabolic diseases' },
  { id: 3, code: 'I10', type: CodeType.ICD10, description: 'Essential (primary) hypertension', category: 'Diseases of the circulatory system' },
  { id: 4, code: 'I25.10', type: CodeType.ICD10, description: 'Atherosclerotic heart disease of native coronary artery without angina pectoris', category: 'Diseases of the circulatory system' },
  { id: 5, code: 'J45.909', type: CodeType.ICD10, description: 'Unspecified asthma, uncomplicated', category: 'Diseases of the respiratory system' },
  { id: 6, code: 'M54.50', type: CodeType.ICD10, description: 'Low back pain, unspecified', category: 'Diseases of the musculoskeletal system and connective tissue' },
  { id: 7, code: 'K52.9', type: CodeType.ICD10, description: 'Noninfective gastroenteritis and colitis, unspecified', category: 'Diseases of the digestive system' },
  { id: 8, code: 'G43.909', type: CodeType.ICD10, description: 'Migraine, unspecified, not intractable, without status migrainosus', category: 'Diseases of the nervous system' },
  { id: 9, code: 'R07.9', type: CodeType.ICD10, description: 'Chest pain, unspecified', category: 'Symptoms, signs and abnormal clinical and laboratory findings' },
  { id: 10, code: 'F41.1', type: CodeType.ICD10, description: 'Generalized anxiety disorder', category: 'Mental, Behavioral and Neurodevelopmental disorders' },
  { id: 11, code: 'F32.9', type: CodeType.ICD10, description: 'Major depressive disorder, single episode, unspecified', category: 'Mental, Behavioral and Neurodevelopmental disorders' },
  { id: 12, code: 'Z00.00', type: CodeType.ICD10, description: 'Encounter for general adult medical examination without abnormal findings', category: 'Factors influencing health status and contact with health services' },
  { id: 13, code: 'N39.0', type: CodeType.ICD10, description: 'Urinary tract infection, site not specified', category: 'Diseases of the genitourinary system' },
  { id: 14, code: 'J06.9', type: CodeType.ICD10, description: 'Acute upper respiratory infection, unspecified', category: 'Diseases of the respiratory system' },
  { id: 15, code: 'L20.9', type: CodeType.ICD10, description: 'Atopic dermatitis, unspecified', category: 'Diseases of the skin and subcutaneous tissue' },

  // CPT Codes (Procedures)
  { id: 16, code: '99213', type: CodeType.CPT, description: 'Office or other outpatient visit for the evaluation and management of an established patient, low complexity, 20-29 minutes', category: 'Evaluation and Management Services' },
  { id: 17, code: '99214', type: CodeType.CPT, description: 'Office or other outpatient visit for the evaluation and management of an established patient, moderate complexity, 30-39 minutes', category: 'Evaluation and Management Services' },
  { id: 18, code: '99212', type: CodeType.CPT, description: 'Office or other outpatient visit for the evaluation and management of an established patient, minor complexity, 10-19 minutes', category: 'Evaluation and Management Services' },
  { id: 19, code: '99203', type: CodeType.CPT, description: 'Office or other outpatient visit for the evaluation and management of a new patient, low-moderate complexity, 30-44 minutes', category: 'Evaluation and Management Services' },
  { id: 20, code: '83036', type: CodeType.CPT, description: 'Hemoglobin; glycosylated (A1c) lab monitoring', category: 'Pathology and Laboratory Procedures' },
  { id: 21, code: '80061', type: CodeType.CPT, description: 'Lipid panel (including total cholesterol, HDL, and triglycerides)', category: 'Pathology and Laboratory Procedures' },
  { id: 22, code: '93000', type: CodeType.CPT, description: 'Electrocardiogram, routine ECG with at least 12 leads; with interpretation and report', category: 'Medicine Services and Procedures' },
  { id: 23, code: '36415', type: CodeType.CPT, description: 'Collection of venous blood by venipuncture', category: 'Surgery / Cardiovascular' },
  { id: 24, code: '90686', type: CodeType.CPT, description: 'Influenza virus vaccine, quadrivalent, split virus, preservative free, for intramuscular use', category: 'Medicine Services and Procedures / Vaccines' },
  { id: 25, code: '90471', type: CodeType.CPT, description: 'Immunization administration (single/combination vaccine)', category: 'Medicine Services and Procedures / Immunizations' },
  { id: 26, code: '99395', type: CodeType.CPT, description: 'Periodic preventive medicine re-evaluation and management of an individual, established patient, ages 18-39 years', category: 'Evaluation and Management Services / Preventive' },
  { id: 27, code: '81001', type: CodeType.CPT, description: 'Urinalysis, by dip stick or tablet reagent for bilirubin, glucose, hemoglobin, ketones, leukocytes, nitrite, pH, protein, specific gravity, urobilinogen, any number of these constituents; automated, with microscopy', category: 'Pathology and Laboratory Procedures / Urinalysis' },
  { id: 28, code: '99215', type: CodeType.CPT, description: 'Office or other outpatient visit for the evaluation and management of an established patient, high complexity, 40-54 minutes', category: 'Evaluation and Management Services' },

  // HCPCS Level II Codes
  { id: 29, code: 'A0427', type: CodeType.HCPCS, description: 'Ambulance service, advanced life support, emergency transport, level 1 (ALS 1/Emergency)', category: 'Transportation Services Including Ambulance' },
  { id: 30, code: 'J7307', type: CodeType.HCPCS, description: 'Etonogestrel (contraceptive) implant system, including implants and supplies', category: 'Enteral and Parenteral Therapy / Medical Supplies' },
  { id: 31, code: 'J1885', type: CodeType.HCPCS, description: 'Injection, ketorolac tromethamine (Toradol), up to 15 mg', category: 'Drugs Administered Other Than Oral Method' },
  { id: 32, code: 'J0696', type: CodeType.HCPCS, description: 'Injection, ceftriaxone sodium (Rocephin), per 250 mg', category: 'Drugs Administered Other Than Oral Method' },
  { id: 33, code: 'G0439', type: CodeType.HCPCS, description: 'Annual wellness visit, subsequent visit', category: 'Special Temporary Codes (G codes)' },
  { id: 34, code: 'G0438', type: CodeType.HCPCS, description: 'Annual wellness visit, initial visit', category: 'Special Temporary Codes (G codes)' },
  { id: 35, code: 'E1390', type: CodeType.HCPCS, description: 'Oxygen concentrator, single delivery port, capable of delivering 85 percent or greater oxygen concentration at the prescribed flow rate', category: 'Durable Medical Equipment' },
  { id: 36, code: 'J3490', type: CodeType.HCPCS, description: 'Unclassified drugs (often used for medication injections in the clinic)', category: 'Drugs Administered Other Than Oral Method' },
];

let memoryCodes: Code[] = [...CODES_DATABASE];

export interface DbInterface {
  all: (sql: string, params?: any[]) => Promise<any[]>;
  get: (sql: string, params?: any[]) => Promise<any>;
}

// Emulate simple DB queries on top of typescript arrays to avoid binary node-sqlite dependencies
const memoryDb: DbInterface = {
  async all(sql: string, params?: any[]): Promise<any[]> {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql.includes('SELECT type, COUNT(*) as count FROM codes GROUP BY type')) {
      const counts = new Map<string, number>();
      for (const code of memoryCodes) {
        counts.set(code.type, (counts.get(code.type) || 0) + 1);
      }
      return Array.from(counts.entries()).map(([type, count]) => ({ type, count }));
    }

    if (normalizedSql.includes('SELECT * FROM codes ORDER BY')) {
      return [...memoryCodes]
        .sort((a, b) => `${a.type}:${a.code}`.localeCompare(`${b.type}:${b.code}`))
        .slice(0, 150);
    }
    
    if (normalizedSql.includes('SELECT * FROM codes WHERE')) {
      if (!params || params.length === 0) return [...memoryCodes];
      // Get all clean search values
      const searchVals = params.map(p => typeof p === 'string' ? p.replace(/%/g, '').toLowerCase() : '').filter(Boolean);
      if (searchVals.length === 0) return [...memoryCodes];

      // Match items that contain ANY of the search values
      const matches = memoryCodes.filter(c =>
        searchVals.some(val => 
          c.code.toLowerCase().includes(val) || 
          c.description.toLowerCase().includes(val) || 
          c.category.toLowerCase().includes(val)
        )
      );
      const limitMatch = normalizedSql.match(/LIMIT\s+(\d+)/i);
      const limit = limitMatch ? Number(limitMatch[1]) : matches.length;
      return matches.slice(0, limit);
    }

    if (normalizedSql.includes('SELECT * FROM codes LIMIT')) {
      const limitMatch = normalizedSql.match(/LIMIT\s+(\d+)/i);
      const limit = limitMatch ? Number(limitMatch[1]) : memoryCodes.length;
      return memoryCodes.slice(0, limit);
    }

    return [...memoryCodes];
  },

  async get(sql: string, params?: any[]): Promise<any> {
    if (sql.includes('COUNT(*)')) {
      return { count: memoryCodes.length };
    }
    return null;
  }
};

let activeDb: DbInterface = memoryDb;

/**
 * Parses a single CSV line, respecting double quotes.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result.map(s => {
    let clean = s.trim();
    if (clean.startsWith('"') && clean.endsWith('"')) {
      clean = clean.substring(1, clean.length - 1);
    }
    return clean.replace(/""/g, '"').trim();
  });
}

/**
 * Parses CSV content into structured rows.
 */
function parseCSV(content: string, isCpt = false): { code: string; description: string }[] {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0) return [];

  // Parse header row
  const header = parseCSVLine(lines[0]);
  let codeIdx = 0;
  let descIdx = 1;

  if (header.length >= 2) {
    const normHeader = header.map(h => h.toLowerCase().trim());
    
    // Look for code / hcpcs column
    const foundCodeIdx = normHeader.findIndex(h => h === 'code' || h === 'hcpcs');
    if (foundCodeIdx !== -1) {
      codeIdx = foundCodeIdx;
    } else if (isCpt) {
      // For CPT files, the column might be 'hcpcs'
      const hcpcsIdx = normHeader.findIndex(h => h.includes('hcpcs'));
      if (hcpcsIdx !== -1) codeIdx = hcpcsIdx;
    }

    // Look for description column
    const foundDescIdx = normHeader.findIndex(h => h === 'description');
    if (foundDescIdx !== -1) {
      descIdx = foundDescIdx;
    }
  }

  const results: { code: string; description: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const cols = parseCSVLine(line);
    if (cols.length > Math.max(codeIdx, descIdx)) {
      const code = cols[codeIdx]?.trim();
      const description = cols[descIdx]?.trim();
      if (code && description) {
        results.push({ code, description });
      }
    }
  }
  return results;
}

export async function getDb(): Promise<DbInterface> {
  return activeDb;
}

function loadCsvCatalogIntoMemory(dataDir: string) {
  const merged = new Map<string, Code>();
  for (const item of CODES_DATABASE) {
    merged.set(`${item.type}:${item.code}`, item);
  }

  const icdPath = path.join(dataDir, 'icd_10_cm.csv');
  if (fs.existsSync(icdPath)) {
    const parsed = parseCSV(fs.readFileSync(icdPath, 'utf8'), false);
    parsed.forEach((row, index) => {
      merged.set(`${CodeType.ICD10}:${row.code}`, {
        id: 100000 + index,
        code: row.code,
        type: CodeType.ICD10,
        description: row.description,
        category: 'Diagnoses',
      });
    });
    console.log(`[MemoryDB] Loaded ${parsed.length} ICD-10-CM codes from CSV.`);
  }

  const cptPath = path.join(dataDir, 'cpt.csv');
  if (fs.existsSync(cptPath)) {
    const parsed = parseCSV(fs.readFileSync(cptPath, 'utf8'), true);
    parsed.forEach((row, index) => {
      const isHcpcs = /^[A-Za-z]/.test(row.code);
      const type = isHcpcs ? CodeType.HCPCS : CodeType.CPT;
      merged.set(`${type}:${row.code}`, {
        id: 200000 + index,
        code: row.code,
        type,
        description: row.description,
        category: isHcpcs ? 'Drugs Administered Other Than Oral Method' : 'Evaluation and Management Services',
      });
    });
    console.log(`[MemoryDB] Loaded ${parsed.length} CPT/HCPCS codes from CSV.`);
  }

  memoryCodes = Array.from(merged.values());
  activeDb = memoryDb;
  console.log(`[MemoryDB] Fully operational in-memory catalog initialized with ${memoryCodes.length} codes.`);
}

export async function initDb() {
  const bundledDbFile = path.resolve(process.cwd(), 'clinical_coding.db');
  const isVercelRuntime = process.env.VERCEL === '1';
  const dbFile = isVercelRuntime ? path.join(os.tmpdir(), 'clinical_coding.db') : bundledDbFile;
  let usingBundledDbCopy = false;
  
  try {
    if (isVercelRuntime) {
      loadCsvCatalogIntoMemory(path.resolve(process.cwd(), 'data'));
      return;
    }

    if (isVercelRuntime && fs.existsSync(bundledDbFile)) {
      if (!fs.existsSync(dbFile)) {
        fs.copyFileSync(bundledDbFile, dbFile);
      }
      usingBundledDbCopy = true;
    }

    const sqlite = await import('sqlite');
    const sqlite3Module = await import('sqlite3');
    const sqlite3Driver = (sqlite3Module as any).default || sqlite3Module;

    // Open SQLite database
    const db = await sqlite.open({
      filename: dbFile,
      driver: sqlite3Driver.Database
    });

    // Create table schema
    await db.exec(`
      CREATE TABLE IF NOT EXISTS codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        type TEXT,
        description TEXT,
        category TEXT
      );
    `);

    // Check count of current table
    const dbCount = await db.get('SELECT COUNT(*) as count FROM codes');
    if (dbCount.count === 0) {
      console.log('[SQLiteDB] Seeding baseline diagnostic codes into SQLite...');
      await db.run('BEGIN TRANSACTION');
      for (const item of CODES_DATABASE) {
        await db.run(
          'INSERT INTO codes (code, type, description, category) VALUES (?, ?, ?, ?)',
          [item.code, item.type, item.description, item.category]
        );
      }
      await db.run('COMMIT');
    }

    const shouldImportCsv = !(isVercelRuntime && usingBundledDbCopy && dbCount.count > 0);

    // Verify and scan custom data directory
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!isVercelRuntime && !fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Look for icd_10_cm.csv
    const icdPath = path.join(dataDir, 'icd_10_cm.csv');
    if (shouldImportCsv && fs.existsSync(icdPath)) {
      console.log('[SQLiteDB] Custom icd_10_cm.csv detected. Parsing and importing...');
      const content = fs.readFileSync(icdPath, 'utf8');
      const parsed = parseCSV(content, false);
      let importCount = 0;
      await db.run('BEGIN TRANSACTION');
      try {
        for (const row of parsed) {
          await db.run(
            'INSERT OR REPLACE INTO codes (code, type, description, category) VALUES (?, ?, ?, ?)',
            [row.code, CodeType.ICD10, row.description, 'Diagnoses']
          );
          importCount++;
        }
        await db.run('COMMIT');
      } catch (err) {
        await db.run('ROLLBACK');
        throw err;
      }
      console.log(`[SQLiteDB] Loaded ${importCount} ICD-10-CM codes.`);
    }

    // Look for cpt.csv
    const cptPath = path.join(dataDir, 'cpt.csv');
    if (shouldImportCsv && fs.existsSync(cptPath)) {
      console.log('[SQLiteDB] Custom cpt.csv detected. Parsing and importing...');
      const content = fs.readFileSync(cptPath, 'utf8');
      const parsed = parseCSV(content, true);
      let importCount = 0;
      await db.run('BEGIN TRANSACTION');
      try {
        for (const row of parsed) {
          // If code starts with letter (e.g. J1885), it's HCPCS, else CPT
          const isHcpcs = /^[A-Za-z]/.test(row.code);
          const type = isHcpcs ? CodeType.HCPCS : CodeType.CPT;
          const category = isHcpcs ? 'Drugs Administered Other Than Oral Method' : 'Evaluation and Management Services';
          await db.run(
            'INSERT OR REPLACE INTO codes (code, type, description, category) VALUES (?, ?, ?, ?)',
            [row.code, type, row.description, category]
          );
          importCount++;
        }
        await db.run('COMMIT');
      } catch (err) {
        await db.run('ROLLBACK');
        throw err;
      }
      console.log(`[SQLiteDB] Loaded ${importCount} CPT/HCPCS codes.`);
    }

    activeDb = db;
    console.log('[SQLiteDB] Fully operational SQLite client initialized.');
  } catch (err: any) {
    console.warn(`[SQLiteDB] Failed to connect to SQLite3 file database: ${err.message}. Falling back to standard in-memory client.`);
    activeDb = memoryDb;
  }
}

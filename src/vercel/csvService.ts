import fs from 'fs';
import path from 'path';

type CodeType = 'ICD10' | 'CPT' | 'HCPCS';

interface CodeRecord {
  code: string;
  type: CodeType;
  description: string;
  category: string;
  score?: number;
}

let catalog: CodeRecord[] | null = null;

const fallbackCatalog: CodeRecord[] = [
  { code: 'E11.65', type: 'ICD10', description: 'Type 2 diabetes mellitus with hyperglycemia', category: 'Diagnoses' },
  { code: 'E11.9', type: 'ICD10', description: 'Type 2 diabetes mellitus without complications', category: 'Diagnoses' },
  { code: 'I10', type: 'ICD10', description: 'Essential hypertension', category: 'Diagnoses' },
  { code: 'N39.0', type: 'ICD10', description: 'Urinary tract infection, site not specified', category: 'Diagnoses' },
  { code: 'R07.9', type: 'ICD10', description: 'Chest pain, unspecified', category: 'Diagnoses' },
  { code: 'E78.00', type: 'ICD10', description: 'Pure hypercholesterolemia, unspecified', category: 'Diagnoses' },
  { code: 'B54', type: 'ICD10', description: 'Unspecified malaria', category: 'Diagnoses' },
  { code: '81001', type: 'CPT', description: 'Urinalysis, automated, with microscopy', category: 'Laboratory' },
  { code: '81002', type: 'CPT', description: 'Urinalysis, non-automated, without microscopy', category: 'Laboratory' },
  { code: '93000', type: 'CPT', description: 'Electrocardiogram, routine ECG with interpretation and report', category: 'Medicine' },
  { code: '80061', type: 'CPT', description: 'Lipid panel', category: 'Laboratory' },
  { code: '83036', type: 'CPT', description: 'Hemoglobin A1c lab monitoring', category: 'Laboratory' },
  { code: 'J1885', type: 'HCPCS', description: 'Injection, ketorolac tromethamine, up to 15 mg', category: 'Drugs' },
];

const aliases: Record<string, string[]> = {
  'blood sugar': ['diabetes', 'hyperglycemia', 'a1c'],
  'high blood sugar': ['type 2 diabetes', 'hyperglycemia', 'a1c'],
  'sugar disease': ['diabetes', 'hyperglycemia'],
  'urine test': ['urinalysis'],
  'urine infection': ['urinary tract infection', 'uti'],
  uti: ['urinary tract infection', 'urinalysis'],
  ekg: ['ecg', 'electrocardiogram'],
  ecg: ['ekg', 'electrocardiogram'],
  'high blood pressure': ['hypertension'],
  cholesterol: ['hypercholesterolemia', 'hyperlipidemia', 'lipid disorder', 'lipid panel'],
  'high cholesterol': ['hypercholesterolemia', 'pure hypercholesterolemia', 'hyperlipidemia', 'lipid disorder', 'lipid panel'],
  lipids: ['lipid panel', 'hyperlipidemia', 'cholesterol'],
  malaria: ['plasmodium', 'malarial', 'falciparum', 'vivax', 'malaria'],
  flu: ['influenza', 'vaccine'],
};

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

function loadCatalog(): CodeRecord[] {
  if (catalog) return catalog;

  try {
    const dataDir = path.join(process.cwd(), 'data');
    const rows = new Map<string, CodeRecord>();

    for (const item of fallbackCatalog) rows.set(`${item.type}:${item.code}`, item);

    const icdPath = path.join(dataDir, 'icd_10_cm.csv');
    if (fs.existsSync(icdPath)) {
      for (const row of parseCSV(fs.readFileSync(icdPath, 'utf8'))) {
        rows.set(`ICD10:${row.code}`, {
          code: row.code,
          type: 'ICD10',
          description: row.description,
          category: 'Diagnoses',
        });
      }
    }

    const cptPath = path.join(dataDir, 'cpt.csv');
    if (fs.existsSync(cptPath)) {
      for (const row of parseCSV(fs.readFileSync(cptPath, 'utf8'), true)) {
        const type = /^[A-Za-z]/.test(row.code) ? 'HCPCS' : 'CPT';
        rows.set(`${type}:${row.code}`, {
          code: row.code,
          type,
          description: row.description,
          category: type === 'HCPCS' ? 'HCPCS' : 'CPT',
        });
      }
    }

    catalog = Array.from(rows.values());
  } catch (error) {
    console.error('[VercelCSV] Falling back to baseline catalog:', error);
    catalog = fallbackCatalog;
  }

  return catalog;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function expandQuery(query: string) {
  const normalized = normalize(query);
  const terms = new Set(normalized.split(' ').filter(Boolean));
  terms.add(normalized);

  for (const [phrase, extras] of Object.entries(aliases)) {
    if (normalized.includes(phrase)) {
      terms.add(phrase);
      extras.forEach(extra => {
        terms.add(extra);
        normalize(extra).split(' ').forEach(token => terms.add(token));
      });
    }
  }

  return { normalized, terms: Array.from(terms).filter(t => t.length >= 2) };
}

function scoreRecord(record: CodeRecord, query: string) {
  const { normalized, terms } = expandQuery(query);
  const code = normalize(record.code);
  const description = normalize(record.description);
  const category = normalize(record.category);
  const haystack = `${code} ${description} ${category}`;
  const compactQuery = normalized.replace(/[^a-z0-9]/g, '');
  const compactCode = code.replace(/[^a-z0-9]/g, '');

  if (compactQuery && compactCode === compactQuery) return 1;
  if (compactQuery.length >= 2 && compactCode.startsWith(compactQuery)) return 0.96;
  if (description.includes(normalized)) return 0.9;

  let score = 0;
  for (const term of terms) {
    if (description.includes(term)) score += term.includes(' ') ? 0.22 : 0.1;
    else if (haystack.includes(term)) score += 0.05;
  }

  if (normalized.includes('high blood sugar') && description.includes('type 2 diabetes') && description.includes('hyperglycemia')) {
    score += 0.5;
  }
  if (normalized.includes('urine test') && description.includes('urinalysis')) {
    score += 0.5;
  }
  if ((normalized.includes('high cholesterol') || normalized.includes('cholesterol') || normalized.includes('lipid')) &&
    (description.includes('hypercholesterolemia') || description.includes('hyperlipidemia') || description.includes('lipid'))) {
    score += 0.65;
  }
  if (normalized.includes('malaria') && (description.includes('malaria') || description.includes('malarial') || description.includes('plasmodium'))) {
    score += 0.75;
  }

  return Math.min(1, score);
}

export function searchCatalog(query: string) {
  const scored = loadCatalog()
    .map(record => ({ ...record, score: scoreRecord(record, query) }))
    .filter(record => (record.score || 0) > 0)
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  return {
    icd: scored.filter(r => r.type === 'ICD10').slice(0, 100),
    cpt: scored.filter(r => r.type === 'CPT').slice(0, 100),
    hcpcs: scored.filter(r => r.type === 'HCPCS').slice(0, 100),
  };
}

export function analyzeCatalog(note: string) {
  const results = searchCatalog(note);
  const diagnoses = results.icd.slice(0, 25).map(r => ({
    code: r.code,
    description: r.description,
    confidence: Math.max(0.28, r.score || 0.28),
    matchedText: note,
  }));
  const procedures = [...results.cpt, ...results.hcpcs].slice(0, 25).map(r => ({
    code: r.code,
    description: r.description,
    confidence: Math.max(0.28, r.score || 0.28),
    matchedText: note,
  }));

  return {
    diagnoses,
    procedures,
    explanation: 'Vercel search checked the local code catalog and returned the closest ICD-10, CPT, and HCPCS matches.',
  };
}

export function getCatalogInventory() {
  const codes = loadCatalog();
  return {
    codes: codes.slice(0, 150),
    counts: {
      icd: codes.filter(c => c.type === 'ICD10').length,
      cpt: codes.filter(c => c.type === 'CPT').length,
      hcpcs: codes.filter(c => c.type === 'HCPCS').length,
    },
  };
}

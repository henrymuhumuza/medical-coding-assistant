type CodeType = 'ICD10' | 'CPT' | 'HCPCS';

export interface CodeRecord {
  code: string;
  type: CodeType;
  description: string;
  category: string;
  score?: number;
}

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

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function expandQuery(query: string) {
  const normalized = normalize(query);
  const terms = new Set(normalized.split(' ').filter(token => token.length >= 2));
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

  return {
    normalized,
    terms: Array.from(terms).filter(term => term.length >= 2).slice(0, 32),
  };
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
  if (compactQuery.length >= 2 && compactCode.startsWith(compactQuery)) return 0.98;
  if (description === normalized) return 0.96;
  if (description.includes(normalized)) return 0.9;

  let score = 0;
  for (const term of terms) {
    if (description.includes(term)) score += term.includes(' ') ? 0.24 : 0.12;
    else if (haystack.includes(term)) score += 0.05;
  }

  if (normalized.includes('high blood sugar') && description.includes('type 2 diabetes') && description.includes('hyperglycemia')) score += 0.6;
  if (normalized.includes('urine test') && description.includes('urinalysis')) score += 0.55;
  if ((normalized.includes('high cholesterol') || normalized.includes('cholesterol') || normalized.includes('lipid')) &&
    (description.includes('hypercholesterolemia') || description.includes('hyperlipidemia') || description.includes('lipid'))) score += 0.65;
  if (normalized.includes('malaria') && (description.includes('malaria') || description.includes('malarial') || description.includes('plasmodium'))) score += 0.75;
  if (normalized.includes('high blood sugar') && description.includes('hypertension')) score -= 0.5;

  return Math.min(1, Math.max(0.08, score));
}

async function fetchRows(query: string): Promise<CodeRecord[]> {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!url || !authToken) throw new Error('Turso environment variables are missing.');

  const { createClient } = await import('@libsql/client');
  const client = createClient({ url, authToken });
  const { normalized, terms } = expandQuery(query);
  const clauses: string[] = [];
  const args: string[] = [];

  for (const term of terms) {
    clauses.push('(search_text LIKE ? OR description LIKE ? OR code LIKE ?)');
    args.push(`%${term}%`, `%${term}%`, `%${term.replace(/[^a-z0-9]/g, '')}%`);
  }

  if (clauses.length === 0) return [];

  let result = await client.execute({
    sql: `
      SELECT code, type, description, category
      FROM codes
      WHERE ${clauses.join(' OR ')}
      LIMIT 1000
    `,
    args,
  });

  if (result.rows.length === 0) {
    result = await client.execute({
      sql: `
        SELECT code, type, description, category
        FROM codes
        WHERE search_text LIKE ? OR description LIKE ? OR code LIKE ?
        LIMIT 1000
      `,
      args: [`%${normalized}%`, `%${query}%`, `%${query}%`],
    });
  }

  return result.rows.map((row: any) => ({
    code: String(row.code),
    type: String(row.type) as CodeType,
    description: String(row.description),
    category: String(row.category || ''),
  }));
}

export async function runDirectTursoSearch(query: string) {
  const scored = (await fetchRows(query))
    .map(record => ({ ...record, score: scoreRecord(record, query) }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  return {
    icd: scored.filter(r => r.type === 'ICD10').slice(0, 100),
    cpt: scored.filter(r => r.type === 'CPT').slice(0, 100),
    hcpcs: scored.filter(r => r.type === 'HCPCS').slice(0, 100),
  };
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { pipeline } from '@xenova/transformers';
import { getDb, initDb } from '../db.ts';
import { AnalyzeResponse, Code, CodeType, SearchResponse } from '../types.ts';

let dbReady: Promise<void> | null = null;
let embedder: any = null;

export async function ensureDbReady() {
  if (!dbReady) {
    dbReady = initDb().then(() => {
      console.log('[SQLite] clinical_coding.db seeded and connected.');
    });
  }
  return dbReady;
}

export async function getCodesInventory() {
  await ensureDbReady();
  const db = await getDb();

  const counts = { icd: 0, cpt: 0, hcpcs: 0 };
  try {
    const countsRows = await db.all('SELECT type, COUNT(*) as count FROM codes GROUP BY type');
    countsRows.forEach((r: any) => {
      if (r.type === CodeType.ICD10) counts.icd = r.count;
      else if (r.type === CodeType.CPT) counts.cpt = r.count;
      else if (r.type === CodeType.HCPCS) counts.hcpcs = r.count;
    });
  } catch (e) {
    console.error('Failed to query code counts:', e);
  }

  const codes = await db.all('SELECT * FROM codes ORDER BY type, code LIMIT 150');
  return { codes, counts };
}

export async function searchCodesByQuery(query: string): Promise<SearchResponse> {
  await ensureDbReady();

  const cleanQuery = query.trim().toLowerCase();
  if (cleanQuery.length === 0) {
    return { icd: [], cpt: [], hcpcs: [] };
  }

  const db = await getDb();
  const sql = `
    SELECT * FROM codes
    WHERE LOWER(code) LIKE ?
       OR LOWER(description) LIKE ?
       OR LOWER(category) LIKE ?
    LIMIT 500
  `;
  const searchPattern = `%${cleanQuery}%`;
  const rows: Code[] = await db.all(sql, [searchPattern, searchPattern, searchPattern]);

  const scoredRows = rows.map((row) => {
    let score = 0.5;
    const codeLower = row.code.toLowerCase();
    const descLower = row.description.toLowerCase();
    const catLower = row.category.toLowerCase();

    if (codeLower === cleanQuery) {
      score = 1.0;
    } else if (codeLower.startsWith(cleanQuery)) {
      score = 0.9;
    } else if (descLower.includes(cleanQuery)) {
      score = 0.8;
    } else if (catLower.includes(cleanQuery)) {
      score = 0.7;
    } else {
      const queryWords = cleanQuery.split(/\s+/);
      const matchCount = queryWords.filter((w) => descLower.includes(w) || codeLower.includes(w)).length;
      score = 0.5 + (matchCount / queryWords.length) * 0.2;
    }

    return { ...row, score: Math.min(score, 1.0) };
  });

  scoredRows.sort((a, b) => (b.score || 0) - (a.score || 0));

  return {
    icd: scoredRows.filter((r) => r.type === CodeType.ICD10).slice(0, 100),
    cpt: scoredRows.filter((r) => r.type === CodeType.CPT).slice(0, 100),
    hcpcs: scoredRows.filter((r) => r.type === CodeType.HCPCS).slice(0, 100),
  };
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have',
  'in', 'into', 'is', 'it', 'of', 'on', 'or', 'patient', 'pt', 'the', 'to',
  'with', 'without'
]);

const PHRASE_ALIASES: Record<string, string[]> = {
  'blood sugar': ['diabetes mellitus', 'type 2 diabetes mellitus with hyperglycemia', 'hyperglycemia', 'a1c'],
  'high blood sugar': ['type 2 diabetes mellitus with hyperglycemia', 'type 2 diabetes mellitus', 'hyperglycemia'],
  'sugar disease': ['diabetes mellitus', 'type 2 diabetes'],
  'high blood pressure': ['hypertension', 'essential hypertension'],
  'heart attack': ['myocardial infarction', 'acute coronary syndrome'],
  'heart disease': ['coronary artery disease', 'atherosclerotic heart disease'],
  'chest pain': ['angina', 'precordial pain', 'chest pain'],
  'urine infection': ['urinary tract infection', 'uti'],
  'urine test': ['urinalysis', 'urine microscopy'],
  'kidney disease': ['renal disease', 'chronic kidney disease'],
  'shortness of breath': ['dyspnea', 'respiratory distress'],
  'breathing problem': ['dyspnea', 'asthma', 'copd'],
  'annual physical': ['preventive medicine', 'general adult medical examination'],
  'well visit': ['preventive medicine', 'wellness visit'],
  'flu shot': ['influenza vaccine', 'immunization administration'],
  'ekg': ['ecg', 'electrocardiogram'],
  'ecg': ['ekg', 'electrocardiogram'],
  'a1c': ['hemoglobin a1c', 'glycosylated hemoglobin', 'diabetes monitoring'],
  'uti': ['urinary tract infection', 'urinalysis'],
};

const SYNONYM_MAP: Record<string, string[]> = {
  abdomen: ['abdominal', 'stomach', 'gastrointestinal'],
  abdominal: ['abdomen', 'stomach', 'gastrointestinal'],
  anxiety: ['panic', 'nervousness', 'worry'],
  asthma: ['wheezing', 'bronchospasm', 'respiratory'],
  bronchitis: ['cough', 'respiratory', 'bronchial'],
  sugar: ['diabetes', 'diabetic', 'hyperglycemia', 'metabolic', 'a1c'],
  diabetes: ['dm', 't2dm', 'diabetic', 'hyperglycemia', 'metabolic', 'a1c'],
  diabetic: ['diabetes', 'dm', 'hyperglycemia', 'a1c'],
  pressure: ['hypertension', 'blood pressure', 'htn'],
  hypertension: ['bp', 'htn', 'blood pressure'],
  htn: ['hypertension', 'blood pressure'],
  heart: ['cardiac', 'myocardial', 'coronary', 'electrocardiogram', 'ecg', 'ekg', 'cardio'],
  cardiac: ['heart', 'myocardial', 'coronary', 'electrocardiogram', 'ecg', 'ekg'],
  coronary: ['cardiac', 'heart', 'atherosclerotic'],
  chest: ['angina', 'cardiac', 'myocardial', 'thoracic'],
  pain: ['algia', 'discomfort', 'ache'],
  urine: ['urinalysis', 'urinary', 'uti', 'microscopy', 'nitrite', 'dysuria'],
  urinary: ['uti', 'urinalysis', 'dysuria'],
  uti: ['urinary', 'urinalysis', 'dysuria'],
  lung: ['pulmonary', 'respiratory', 'asthma', 'copd', 'bronchi', 'dyspnea'],
  breath: ['dyspnea', 'respiratory', 'pulmonary'],
  breathing: ['dyspnea', 'respiratory', 'pulmonary'],
  kidney: ['renal', 'nephrology', 'dialysis'],
  renal: ['kidney', 'nephrology'],
  blood: ['venous', 'blood pressure', 'hematology', 'hemoglobin', 'a1c'],
  lab: ['laboratory', 'pathology', 'panel', 'test'],
  labs: ['laboratory', 'pathology', 'panel', 'test'],
  test: ['laboratory', 'screening', 'panel'],
  shot: ['injection', 'immunization', 'vaccine', 'intramuscular', 'im'],
  injection: ['im', 'intramuscular', 'iv', 'intravenous', 'toradol', 'ketorolac'],
  wellness: ['preventive', 'wellness', 'examination', 'general adult'],
  physical: ['preventive', 'examination', 'general adult'],
  flu: ['influenza', 'vaccine', 'immunization'],
  headache: ['migraine', 'intracranial'],
  migraine: ['headache'],
  back: ['lumbar', 'spine', 'musculoskeletal'],
  spine: ['lumbar', 'cervical', 'thoracic', 'spinal'],
  infection: ['infective', 'colitis', 'uti', 'upper respiratory'],
  depression: ['depressive', 'mood'],
  rash: ['dermatitis', 'skin', 'eruption'],
  skin: ['dermatitis', 'cutaneous'],
  stomach: ['abdominal', 'gastroenteritis', 'colitis'],
  vomiting: ['emesis', 'gastroenteritis', 'nausea'],
  nausea: ['vomiting', 'emesis', 'gastroenteritis']
};

async function getEmbedder() {
  if (!embedder) {
    console.log('[Embedder] Initializing local all-MiniLM-L6-v2 model...');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('[Embedder] Local all-MiniLM-L6-v2 model initialized successfully.');
  }
  return embedder;
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripCode(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .map((word) => word.endsWith('s') && word.length > 4 ? word.slice(0, -1) : word)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
}

function uniqueValues(values: string[], limit = 80): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function buildSearchContext(note: string) {
  const normalizedQuery = normalizeText(note);
  const baseTokens = tokenize(note);
  const phrases: string[] = [normalizedQuery];

  for (const [phrase, aliases] of Object.entries(PHRASE_ALIASES)) {
    if (normalizedQuery.includes(phrase)) {
      phrases.push(phrase, ...aliases);
    }
  }

  for (let size = 4; size >= 2; size--) {
    for (let i = 0; i <= baseTokens.length - size; i++) {
      phrases.push(baseTokens.slice(i, i + size).join(' '));
    }
  }

  const expandedTerms = new Set<string>(baseTokens);
  for (const token of baseTokens) {
    const aliases = SYNONYM_MAP[token] || [];
    for (const alias of aliases) {
      expandedTerms.add(alias);
      tokenize(alias).forEach((aliasToken) => expandedTerms.add(aliasToken));
    }
  }
  phrases.forEach((phrase) => tokenize(phrase).forEach((token) => expandedTerms.add(token)));

  const exactCodeLike = normalizedQuery.match(/\b[a-z]?\d{2,5}(?:\.\d{1,4})?\b/gi) || [];

  return {
    normalizedQuery,
    baseTokens,
    phrases: uniqueValues(phrases, 50),
    terms: uniqueValues([...expandedTerms], 90),
    exactCodeLike: uniqueValues(exactCodeLike, 12),
  };
}

function calculateLexicalScore(code: Code, context: ReturnType<typeof buildSearchContext>): number {
  const codeText = normalizeText(code.code);
  const compactCode = stripCode(code.code);
  const desc = normalizeText(code.description);
  const category = normalizeText(code.category);
  const searchable = `${codeText} ${desc} ${category}`;
  const compactQuery = stripCode(context.normalizedQuery);

  if (context.exactCodeLike.some((candidate) => stripCode(candidate) === compactCode) || compactQuery === compactCode) {
    return 1;
  }
  if (compactCode.startsWith(compactQuery) && compactQuery.length >= 2) {
    return 0.96;
  }

  let score = 0;
  for (const phrase of context.phrases) {
    if (phrase.length < 3) continue;
    if (desc === phrase) score = Math.max(score, 0.94);
    else if (desc.includes(phrase)) score = Math.max(score, phrase.includes(' ') ? 0.88 : 0.64);
    else if (category.includes(phrase)) score = Math.max(score, 0.52);
  }

  const matchedTokens = context.baseTokens.filter((token) => searchable.includes(token));
  const coverage = context.baseTokens.length ? matchedTokens.length / context.baseTokens.length : 0;
  if (coverage === 1 && context.baseTokens.length >= 2) score = Math.max(score, 0.82);
  else if (coverage > 0) score = Math.max(score, 0.35 + coverage * 0.36);

  const expandedMatches = context.terms.filter((term) => term.length >= 3 && searchable.includes(term)).length;
  const phraseMatches = context.phrases.filter((phrase) => phrase.length >= 3 && desc.includes(phrase)).length;
  const expandedCoverage = context.terms.length ? expandedMatches / Math.min(context.terms.length, 16) : 0;
  score = Math.max(score, Math.min(0.72, 0.24 + expandedCoverage * 0.5));
  score += Math.min(0.22, phraseMatches * 0.045) + Math.min(0.14, expandedMatches * 0.012);

  if (codeText.startsWith(context.normalizedQuery) && context.normalizedQuery.length >= 2) {
    score = Math.max(score, 0.93);
  }

  const query = context.normalizedQuery;
  const hasDiabetesIntent = context.terms.some((term) => ['diabetes', 'diabetic', 'hyperglycemia', 'a1c'].includes(term));
  if (hasDiabetesIntent && desc.includes('hyperglycemia')) score += 0.08;
  if (hasDiabetesIntent && desc.includes('type 2 diabetes') && !query.includes('type 1')) score += 0.04;

  const unsupportedSpecifics: Array<[string, string[]]> = [
    ['due to underlying condition', ['underlying']],
    ['drug or chemical', ['drug', 'chemical', 'medication induced']],
    ['pregnancy', ['pregnancy', 'pregnant', 'trimester']],
    ['puerperium', ['puerperium', 'postpartum']],
    ['pre existing', ['pre existing', 'preexisting']],
    ['type 1', ['type 1', 't1dm']],
  ];

  for (const [specificPhrase, supportingTerms] of unsupportedSpecifics) {
    if (desc.includes(specificPhrase) && !supportingTerms.some((term) => query.includes(term))) {
      score -= specificPhrase === 'due to underlying condition' ? 0.16 : 0.1;
    }
  }

  return Math.min(score, 1);
}

function bestMatchedText(code: Code, context: ReturnType<typeof buildSearchContext>, originalNote: string): string {
  const searchable = normalizeText(`${code.code} ${code.description} ${code.category}`);
  const bestPhrase = context.phrases
    .filter((phrase) => phrase.length >= 3 && searchable.includes(phrase))
    .sort((a, b) => b.length - a.length)[0];

  if (bestPhrase) return bestPhrase;

  const bestToken = context.terms
    .filter((term) => term.length >= 3 && searchable.includes(term))
    .sort((a, b) => b.length - a.length)[0];

  return bestToken || originalNote.slice(0, 120);
}

function buildLexicalAnalyzeResponse(
  rankedCandidates: Array<Code & { score?: number }>,
  context: ReturnType<typeof buildSearchContext>,
  note: string,
  candidateCount: number,
  reason = 'Embeddings were unavailable, so local keyword ranking was used.'
): AnalyzeResponse {
  const toMatch = (c: Code & { score?: number }) => ({
    code: c.code,
    description: c.description,
    type: c.type,
    category: c.category,
    confidence: Math.min(1, Math.max(0.28, c.score || 0.28)),
    matchedText: bestMatchedText(c, context, note),
  });

  const diagnoses = rankedCandidates
    .filter(c => c.type === CodeType.ICD10)
    .slice(0, 25)
    .map(toMatch);

  const procedures = rankedCandidates
    .filter(c => c.type === CodeType.CPT || c.type === CodeType.HCPCS)
    .slice(0, 25)
    .map(toMatch);

  return {
    diagnoses,
    procedures,
    explanation: `Local AI search checked ${candidateCount} matching code records and returned the closest ICD-10, CPT, and HCPCS matches. ${reason}`,
  };
}

export async function analyzeClinicalText(note: string): Promise<AnalyzeResponse> {
  await ensureDbReady();

  const db = await getDb();
  const searchContext = buildSearchContext(note);

  if (searchContext.baseTokens.length === 0 && searchContext.exactCodeLike.length === 0) {
    return { diagnoses: [], procedures: [], explanation: 'Please enter a search query.' };
  }

  const termsArray = uniqueValues([
    ...searchContext.exactCodeLike,
    ...searchContext.phrases,
    ...searchContext.terms,
  ], 90);
  let candidates: Code[] = [];

  if (termsArray.length > 0) {
    try {
      const candidateMap = new Map<string, Code>();

      for (const term of termsArray) {
        const limit = term.includes(' ') ? 160 : 80;
        const termRows: Code[] = await db.all(
          `SELECT * FROM codes
           WHERE LOWER(description) LIKE ?
              OR LOWER(code) LIKE ?
              OR LOWER(category) LIKE ?
           LIMIT ${limit}`,
          [`%${term}%`, `%${term}%`, `%${term}%`]
        );

        for (const row of termRows) {
          candidateMap.set(`${row.type}:${row.code}`, row);
        }

        if (candidateMap.size >= 2800) break;
      }

      candidates = Array.from(candidateMap.values());
    } catch (e) {
      console.error('[SQLite] Candidate lookup failed:', e);
    }
  }

  if (candidates.length === 0) {
    try {
      candidates = await db.all('SELECT * FROM codes LIMIT 800');
    } catch (e) {
      console.error('[SQLite] Fallback catalog load failed:', e);
    }
  }

  const lexicalRankedCandidates = candidates
    .map((candidate) => ({
      ...candidate,
      score: calculateLexicalScore(candidate, searchContext),
    }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  const slicedCandidates = lexicalRankedCandidates.slice(0, 500);
  if (slicedCandidates.length === 0) {
    return { diagnoses: [], procedures: [], explanation: 'No matching code records were found for that search.' };
  }

  let pipelineInstance: any;
  try {
    pipelineInstance = await getEmbedder();
  } catch (error) {
    console.error('[Embedder] Model initialization failed; using lexical fallback:', error);
    return buildLexicalAnalyzeResponse(lexicalRankedCandidates, searchContext, note, candidates.length);
  }

  const expandedQueryText = uniqueValues([
    note,
    searchContext.normalizedQuery,
    ...searchContext.phrases,
    ...searchContext.terms.slice(0, 35),
  ], 45).join('. ');
  let queryVector: number[];
  let tensorData: any;
  let hiddenDim: number;

  try {
    const queryTensor = await pipelineInstance(expandedQueryText, { pooling: 'mean', normalize: true });
    queryVector = Array.from(queryTensor.data) as number[];

    const candidateTexts = slicedCandidates.map(c => {
      const typeLabel = c.type === CodeType.ICD10 ? 'ICD-10 diagnosis' : c.type === CodeType.HCPCS ? 'HCPCS service or supply' : 'CPT procedure';
      return `${c.code}. ${typeLabel}. ${c.description}. Category: ${c.category}.`;
    });
    const candidatesTensor = await pipelineInstance(candidateTexts, { pooling: 'mean', normalize: true });

    tensorData = candidatesTensor.data;
    hiddenDim = candidatesTensor.dims[1];
  } catch (error) {
    console.error('[Embedder] Embedding run failed; using lexical fallback:', error);
    return buildLexicalAnalyzeResponse(lexicalRankedCandidates, searchContext, note, candidates.length);
  }

  const scoredCandidates = slicedCandidates.map((c, i) => {
    const start = i * hiddenDim;
    const end = start + hiddenDim;
    const vector = Array.from(tensorData.subarray(start, end)) as number[];
    const semanticScore = Math.max(0, cosineSimilarity(queryVector, vector));
    const lexicalScore = c.score || 0;
    const score = Math.min(1, (semanticScore * 0.64) + (lexicalScore * 0.42));

    return {
      code: c.code,
      description: c.description,
      type: c.type,
      category: c.category,
      confidence: score,
      matchedText: bestMatchedText(c, searchContext, note)
    };
  });

  scoredCandidates.sort((a, b) => b.confidence - a.confidence);

  const relevanceThreshold = 0.26;
  let diagnoses = scoredCandidates.filter(c => c.type === CodeType.ICD10 && c.confidence >= relevanceThreshold);
  let procedures = scoredCandidates.filter(c => (c.type === CodeType.CPT || c.type === CodeType.HCPCS) && c.confidence >= relevanceThreshold);

  diagnoses = diagnoses.length === 0
    ? scoredCandidates.filter(c => c.type === CodeType.ICD10).slice(0, 15)
    : diagnoses.slice(0, 40);

  procedures = procedures.length === 0
    ? scoredCandidates.filter(c => c.type === CodeType.CPT || c.type === CodeType.HCPCS).slice(0, 15)
    : procedures.slice(0, 40);

  return {
    diagnoses,
    procedures,
    explanation: `Local AI search checked ${candidates.length} matching code records and ranked the closest ICD-10, CPT, and HCPCS matches.`,
  };
}

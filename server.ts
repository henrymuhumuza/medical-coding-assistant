/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { pipeline } from '@xenova/transformers';
import { getDb, initDb } from './src/db.ts';
import { CodeType, Code, SearchResponse, AnalyzeResponse } from './src/types.ts';

// Load environmental variables
dotenv.config({ path: ['.env.local', '.env'] });

const app = express();
const PORT = 3000;

// Enable JSON bodies & CORS cross-origin access
app.use(express.json());
app.use(cors());

// REST API Endpoints

/**
 * GET /api/codes
 * Retrieve all clinical codes in the database (for clinical inventory overview).
 */
app.get('/api/codes', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const db = await getDb();
    
    // Fetch total counts by type
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

    // Fetch first 150 codes to prevent memory/DOM freeze
    const codes = await db.all('SELECT * FROM codes ORDER BY type, code LIMIT 150');
    res.json({ codes, counts });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/search
 * Search the database for relevant diagnostic and procedural codes using SQL keyword lookups
 * with a priority-scoring heuristic.
 */
app.post('/api/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Search query string is required.' });
      return;
    }

    const cleanQuery = query.trim().toLowerCase();
    if (cleanQuery.length === 0) {
      res.json({ icd: [], cpt: [], hcpcs: [] });
      return;
    }

    const db = await getDb();
    
    // Find codes by pattern matching (fuzzy SQL LIKE) - Limit to 500 to keep queries extremely fast
    const sql = `
      SELECT * FROM codes 
      WHERE LOWER(code) LIKE ? 
         OR LOWER(description) LIKE ? 
         OR LOWER(category) LIKE ?
      LIMIT 500
    `;
    const searchPattern = `%${cleanQuery}%`;
    const rows: Code[] = await db.all(sql, [searchPattern, searchPattern, searchPattern]);

    // Score search matches based on query alignment
    const scoredRows = rows.map((row) => {
      let score = 0.5; // Baseline
      const codeLower = row.code.toLowerCase();
      const descLower = row.description.toLowerCase();
      const catLower = row.category.toLowerCase();

      if (codeLower === cleanQuery) {
        score = 1.0; // Perfect match on code literal
      } else if (codeLower.startsWith(cleanQuery)) {
        score = 0.9; // Prefix match on code
      } else if (descLower.includes(cleanQuery)) {
        // Description exact phrase match
        score = 0.8;
      } else if (catLower.includes(cleanQuery)) {
        score = 0.7;
      } else {
        // Simple word matches
        const queryWords = cleanQuery.split(/\s+/);
        const matchCount = queryWords.filter((w) => descLower.includes(w) || codeLower.includes(w)).length;
        score = 0.5 + (matchCount / queryWords.length) * 0.2;
      }

      return {
        ...row,
        score: Math.min(score, 1.0),
      };
    });

    // Sort by descending score
    scoredRows.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Segregate and slice to top 100 per type to prevent frontend rendering lag
    const result: SearchResponse = {
      icd: scoredRows.filter((r) => r.type === CodeType.ICD10).slice(0, 100),
      cpt: scoredRows.filter((r) => r.type === CodeType.CPT).slice(0, 100),
      hcpcs: scoredRows.filter((r) => r.type === CodeType.HCPCS).slice(0, 100),
    };

    res.json(result);
  } catch (error) {
    next(error);
  }
});

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

// Custom medical synonyms and aliases mapping for broad SQLite query expansion
const SYNONYM_MAP: Record<string, string[]> = {
  'abdomen': ['abdominal', 'stomach', 'gastrointestinal'],
  'abdominal': ['abdomen', 'stomach', 'gastrointestinal'],
  'anxiety': ['panic', 'nervousness', 'worry'],
  'asthma': ['wheezing', 'bronchospasm', 'respiratory'],
  'bronchitis': ['cough', 'respiratory', 'bronchial'],
  'sugar': ['diabetes', 'diabetic', 'hyperglycemia', 'metabolic', 'a1c'],
  'diabetes': ['dm', 't2dm', 'diabetic', 'hyperglycemia', 'metabolic', 'a1c'],
  'diabetic': ['diabetes', 'dm', 'hyperglycemia', 'a1c'],
  'pressure': ['hypertension', 'blood pressure', 'htn'],
  'hypertension': ['bp', 'htn', 'blood pressure'],
  'htn': ['hypertension', 'blood pressure'],
  'heart': ['cardiac', 'myocardial', 'coronary', 'electrocardiogram', 'ecg', 'ekg', 'cardio'],
  'cardiac': ['heart', 'myocardial', 'coronary', 'electrocardiogram', 'ecg', 'ekg'],
  'coronary': ['cardiac', 'heart', 'atherosclerotic'],
  'chest': ['angina', 'cardiac', 'myocardial', 'thoracic'],
  'pain': ['algia', 'discomfort', 'ache'],
  'urine': ['urinalysis', 'urinary', 'uti', 'microscopy', 'nitrite', 'dysuria'],
  'urinary': ['uti', 'urinalysis', 'dysuria'],
  'uti': ['urinary', 'urinalysis', 'dysuria'],
  'lung': ['pulmonary', 'respiratory', 'asthma', 'copd', 'bronchi', 'dyspnea'],
  'breath': ['dyspnea', 'respiratory', 'pulmonary'],
  'breathing': ['dyspnea', 'respiratory', 'pulmonary'],
  'kidney': ['renal', 'nephrology', 'dialysis'],
  'renal': ['kidney', 'nephrology'],
  'blood': ['venous', 'blood pressure', 'hematology', 'hemoglobin', 'a1c'],
  'lab': ['laboratory', 'pathology', 'panel', 'test'],
  'labs': ['laboratory', 'pathology', 'panel', 'test'],
  'test': ['laboratory', 'screening', 'panel'],
  'shot': ['injection', 'immunization', 'vaccine', 'intramuscular', 'im'],
  'injection': ['im', 'intramuscular', 'iv', 'intravenous', 'toradol', 'ketorolac'],
  'wellness': ['preventive', 'wellness', 'examination', 'general adult'],
  'physical': ['preventive', 'examination', 'general adult'],
  'flu': ['influenza', 'vaccine', 'immunization'],
  'headache': ['migraine', 'intracranial'],
  'migraine': ['headache'],
  'back': ['lumbar', 'spine', 'musculoskeletal'],
  'spine': ['lumbar', 'cervical', 'thoracic', 'spinal'],
  'infection': ['infective', 'colitis', 'uti', 'upper respiratory'],
  'depression': ['depressive', 'mood'],
  'rash': ['dermatitis', 'skin', 'eruption'],
  'skin': ['dermatitis', 'cutaneous'],
  'stomach': ['abdominal', 'gastroenteritis', 'colitis'],
  'vomiting': ['emesis', 'gastroenteritis', 'nausea'],
  'nausea': ['vomiting', 'emesis', 'gastroenteritis']
};

let embedder: any = null;

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

/**
 * POST /api/analyze
 * Analyzes clinical text notes or queries using local embeddings (Xenova/all-MiniLM-L6-v2) 
 * to extract diagnostic and procedural matches.
 */
app.post('/api/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { note } = req.body;
    if (!note || typeof note !== 'string') {
      res.status(400).json({ error: 'Clinical note or query string is required.' });
      return;
    }

    const db = await getDb();
    
    const searchContext = buildSearchContext(note);

    if (searchContext.baseTokens.length === 0 && searchContext.exactCodeLike.length === 0) {
      res.json({ diagnoses: [], procedures: [], explanation: 'Please enter a search query.' });
      return;
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

    // Fallback if no candidate codes matched (ensure we always have candidates)
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

    // Keep the pool deep enough for semantic recall while avoiding slow local embedding runs.
    const maxCandidates = 500;
    const slicedCandidates = lexicalRankedCandidates.slice(0, maxCandidates);

    // Calculate local embeddings using all-MiniLM-L6-v2 pipeline
    const pipelineInstance = await getEmbedder();
    
    // Get query embedding vector
    const expandedQueryText = uniqueValues([
      note,
      searchContext.normalizedQuery,
      ...searchContext.phrases,
      ...searchContext.terms.slice(0, 35),
    ], 45).join('. ');
    const queryTensor = await pipelineInstance(expandedQueryText, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(queryTensor.data) as number[];

    // Batch embed candidate definitions
    const candidateTexts = slicedCandidates.map(c => {
      const typeLabel = c.type === CodeType.ICD10 ? 'ICD-10 diagnosis' : c.type === CodeType.HCPCS ? 'HCPCS service or supply' : 'CPT procedure';
      return `${c.code}. ${typeLabel}. ${c.description}. Category: ${c.category}.`;
    });
    const candidatesTensor = await pipelineInstance(candidateTexts, { pooling: 'mean', normalize: true });
    
    const tensorData = candidatesTensor.data;
    const dims = candidatesTensor.dims;
    const hiddenDim = dims[1];

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

    // Sort scored codes descending
    scoredCandidates.sort((a, b) => b.confidence - a.confidence);

    // Filter relevant codes based on blended semantic and lexical relevance.
    const relevanceThreshold = 0.26;
    let diagnoses = scoredCandidates.filter(c => c.type === CodeType.ICD10 && c.confidence >= relevanceThreshold);
    let procedures = scoredCandidates.filter(c => (c.type === CodeType.CPT || c.type === CodeType.HCPCS) && c.confidence >= relevanceThreshold);

    // Fallbacks to return best matches if strict threshold is empty
    if (diagnoses.length === 0) {
      diagnoses = scoredCandidates.filter(c => c.type === CodeType.ICD10).slice(0, 15);
    } else {
      diagnoses = diagnoses.slice(0, 40);
    }

    if (procedures.length === 0) {
      procedures = scoredCandidates.filter(c => c.type === CodeType.CPT || c.type === CodeType.HCPCS).slice(0, 15);
    } else {
      procedures = procedures.slice(0, 40);
    }

    const explanation = `Local AI search checked ${candidates.length} matching code records and ranked the closest ICD-10, CPT, and HCPCS matches.`;

    res.json({
      diagnoses,
      procedures,
      explanation
    });
  } catch (error: any) {
    console.error('[Embedder] Semantic search failed:', error);
    res.status(500).json({
      error: 'AI Analysis Error',
      message: error?.message || 'Failed to complete semantic search. Please try again.',
    });
  }
});

/**
 * Boilerplate / static server / SPA mounting with Vite middleware
 */
async function startServer() {
  // Initialize and seed SQLite database
  try {
    await initDb();
    console.log('[SQLite] clinical_coding.db seeded and connected.');
  } catch (err) {
    console.error('[SQLite] Database bootstrapping failed:', err);
  }

  // Vite middleware in dev; static build directory in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Explicitly handle all non-API paths to serve transformed index.html under Vite middlewareMode
    app.get('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const fs = await import('fs');
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Full-Stack] Server booting on port ${PORT}`);
    console.log(`[Full-Stack] Direct address access: http://localhost:${PORT}`);
  });
}

// Global Exception handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected operational failure happened.',
  });
});

startServer();

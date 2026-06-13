import { CodeRecord, runDirectTursoSearch } from './directTursoSearch.ts';

interface DeepSeekExtraction {
  diagnosisTerms: string[];
  procedureTerms: string[];
  searchTerms: string[];
  summary?: string;
}

interface MatchResult {
  code: string;
  description: string;
  confidence: number;
  matchedText: string;
}

function uniqueValues(values: string[], limit = 12) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = value.replace(/\s+/g, ' ').trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || cleaned.length < 2 || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= limit) break;
  }

  return result;
}

function extractJsonObject(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeExtraction(value: any, note: string): DeepSeekExtraction {
  const diagnosisTerms = Array.isArray(value?.diagnosisTerms) ? value.diagnosisTerms : [];
  const procedureTerms = Array.isArray(value?.procedureTerms) ? value.procedureTerms : [];
  const searchTerms = Array.isArray(value?.searchTerms) ? value.searchTerms : [];

  return {
    diagnosisTerms: uniqueValues(diagnosisTerms.map(String), 8),
    procedureTerms: uniqueValues(procedureTerms.map(String), 8),
    searchTerms: uniqueValues([...searchTerms.map(String), note], 10),
    summary: typeof value?.summary === 'string' ? value.summary : undefined,
  };
}

async function extractMedicalSearchTerms(note: string): Promise<DeepSeekExtraction> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is missing. Add it to Vercel environment variables and .env.local.');
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content:
            'Extract medical coding search terms from user text. Return only JSON with keys diagnosisTerms, procedureTerms, searchTerms, summary. Use standard ICD-10/CPT wording. Do not assign codes.',
        },
        {
          role: 'user',
          content: note,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`DeepSeek request failed (${response.status}): ${errorText.slice(0, 180)}`);
  }

  const payload: any = await response.json();
  const content = payload?.choices?.[0]?.message?.content || '';
  const parsed = extractJsonObject(content);
  if (!parsed) {
    throw new Error('DeepSeek returned a response that could not be parsed.');
  }

  return normalizeExtraction(parsed, note);
}

function addRecords(
  target: Map<string, CodeRecord & { matchedText: string; score: number }>,
  records: CodeRecord[],
  matchedText: string,
  boost: number
) {
  for (const record of records) {
    const key = `${record.type}:${record.code}`;
    const score = Math.min(1, (record.score || 0.25) + boost);
    const existing = target.get(key);
    if (!existing || score > existing.score) {
      target.set(key, { ...record, matchedText, score });
    }
  }
}

function toMatches(records: Array<CodeRecord & { matchedText: string; score: number }>): MatchResult[] {
  return records
    .sort((a, b) => b.score - a.score)
    .slice(0, 25)
    .map(record => ({
      code: record.code,
      description: record.description,
      confidence: Math.max(0.3, Math.min(1, record.score)),
      matchedText: record.matchedText,
    }));
}

export async function runDeepSeekCodeSearch(note: string) {
  const extraction = await extractMedicalSearchTerms(note);
  const diagnosisMap = new Map<string, CodeRecord & { matchedText: string; score: number }>();
  const procedureMap = new Map<string, CodeRecord & { matchedText: string; score: number }>();

  const diagnosisTerms = uniqueValues([...extraction.diagnosisTerms, ...extraction.searchTerms], 10);
  const procedureTerms = uniqueValues([...extraction.procedureTerms, ...extraction.searchTerms], 10);

  for (const term of diagnosisTerms) {
    const results = await runDirectTursoSearch(term);
    addRecords(diagnosisMap, results.icd, term, extraction.diagnosisTerms.includes(term) ? 0.18 : 0.08);
  }

  for (const term of procedureTerms) {
    const results = await runDirectTursoSearch(term);
    addRecords(procedureMap, [...results.cpt, ...results.hcpcs], term, extraction.procedureTerms.includes(term) ? 0.18 : 0.08);
  }

  return {
    diagnoses: toMatches(Array.from(diagnosisMap.values())),
    procedures: toMatches(Array.from(procedureMap.values())),
    explanation: extraction.summary || 'DeepSeek extracted the medical search terms, then Turso matched them to ICD-10, CPT, and HCPCS codes.',
  };
}

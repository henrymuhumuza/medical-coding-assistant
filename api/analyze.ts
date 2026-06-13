function readBody(req: any) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body || {};
}

const diagnosisCodes = [
  { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia', terms: ['high blood sugar', 'blood sugar', 'diabetes', 'hyperglycemia', 'a1c'] },
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', terms: ['diabetes', 'type 2 diabetes', 'sugar disease'] },
  { code: 'I10', description: 'Essential (primary) hypertension', terms: ['hypertension', 'high blood pressure', 'htn'] },
  { code: 'N39.0', description: 'Urinary tract infection, site not specified', terms: ['uti', 'urinary tract infection', 'urine infection', 'dysuria'] },
  { code: 'R07.9', description: 'Chest pain, unspecified', terms: ['chest pain', 'chest discomfort'] },
  { code: 'J45.909', description: 'Unspecified asthma, uncomplicated', terms: ['asthma', 'wheezing', 'shortness of breath'] },
  { code: 'M54.50', description: 'Low back pain, unspecified', terms: ['low back pain', 'back pain', 'lumbar pain'] },
  { code: 'G43.909', description: 'Migraine, unspecified, not intractable, without status migrainosus', terms: ['migraine', 'headache'] },
];

const procedureCodes = [
  { code: '81001', description: 'Urinalysis, automated, with microscopy', terms: ['urinalysis', 'urine test', 'urine microscopy'] },
  { code: '81002', description: 'Urinalysis, non-automated, without microscopy', terms: ['urinalysis', 'urine test'] },
  { code: '83036', description: 'Hemoglobin; glycosylated (A1c) lab monitoring', terms: ['a1c', 'hemoglobin a1c', 'diabetes monitoring'] },
  { code: '93000', description: 'Electrocardiogram, routine ECG with interpretation and report', terms: ['ecg', 'ekg', 'electrocardiogram'] },
  { code: '36415', description: 'Collection of venous blood by venipuncture', terms: ['blood draw', 'venipuncture', 'blood collection'] },
  { code: 'J1885', description: 'Injection, ketorolac tromethamine (Toradol), up to 15 mg', terms: ['toradol', 'ketorolac', 'pain injection'] },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreTerms(note: string, terms: string[]) {
  const normalized = normalize(note);
  let score = 0;

  for (const term of terms) {
    if (normalized.includes(term)) {
      score = Math.max(score, term.includes(' ') ? 0.95 : 0.75);
    } else {
      const tokens = term.split(' ');
      const matched = tokens.filter(token => normalized.includes(token)).length;
      if (matched > 0) score = Math.max(score, 0.35 + (matched / tokens.length) * 0.35);
    }
  }

  return score;
}

function toMatch(item: { code: string; description: string; terms: string[] }, confidence: number, note: string) {
  return {
    code: item.code,
    description: item.description,
    confidence,
    matchedText: note.slice(0, 120),
  };
}

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { note } = readBody(req);
  if (!note || typeof note !== 'string') {
    return res.status(400).json({ error: 'Clinical note or query string is required.' });
  }

  const diagnoses = diagnosisCodes
    .map(item => ({ item, confidence: scoreTerms(note, item.terms) }))
    .filter(result => result.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10)
    .map(result => toMatch(result.item, result.confidence, note));

  const procedures = procedureCodes
    .map(item => ({ item, confidence: scoreTerms(note, item.terms) }))
    .filter(result => result.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10)
    .map(result => toMatch(result.item, result.confidence, note));

  return res.status(200).json({
    diagnoses,
    procedures,
    explanation: 'Vercel fallback search is running without external imports. This confirms the API route can execute on Vercel.',
  });
}

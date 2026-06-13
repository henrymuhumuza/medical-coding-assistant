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

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function fallbackAnalyze(note: string) {
  const text = normalize(note);
  const diagnoses = [];
  const procedures = [];

  if (text.includes('high blood sugar') || text.includes('diabetes') || text.includes('hyperglycemia') || text.includes('a1c')) {
    diagnoses.push({
      code: 'E11.65',
      description: 'Type 2 diabetes mellitus with hyperglycemia',
      confidence: 0.95,
      matchedText: note.slice(0, 120),
    });
    diagnoses.push({
      code: 'E11.9',
      description: 'Type 2 diabetes mellitus without complications',
      confidence: 0.72,
      matchedText: note.slice(0, 120),
    });
  }

  if (text.includes('urine test') || text.includes('urinalysis') || text.includes('uti')) {
    procedures.push({
      code: '81001',
      description: 'Urinalysis, automated, with microscopy',
      confidence: 0.92,
      matchedText: note.slice(0, 120),
    });
  }

  if (text.includes('a1c')) {
    procedures.push({
      code: '83036',
      description: 'Hemoglobin; glycosylated (A1c) lab monitoring',
      confidence: 0.9,
      matchedText: note.slice(0, 120),
    });
  }

  return {
    diagnoses,
    procedures,
    explanation: 'Fallback code search returned matches while the Turso-backed search was unavailable.',
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { note } = readBody(req);
  if (!note || typeof note !== 'string') {
    return res.status(400).json({ error: 'Clinical note or query string is required.' });
  }

  try {
    const { analyzeTurso } = await import('../src/vercel/tursoService.ts');
    return res.status(200).json(await analyzeTurso(note));
  } catch (error) {
    console.error('[API /analyze] Turso unavailable; using fallback:', error);
    return res.status(200).json(fallbackAnalyze(note));
  }
}

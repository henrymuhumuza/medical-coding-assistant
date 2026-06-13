import { runDirectTursoSearch } from '../src/vercel/directTursoSearch.ts';

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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const { note } = readBody(req);
    if (!note || typeof note !== 'string') {
      return res.status(400).json({ error: 'Clinical note or query string is required.' });
    }

    const results = await runDirectTursoSearch(note);
    const diagnoses = results.icd.slice(0, 25).map(r => ({
      code: r.code,
      description: r.description,
      confidence: Math.max(0.28, r.score || 0.28),
      matchedText: note.slice(0, 120),
    }));
    const procedures = [...results.cpt, ...results.hcpcs].slice(0, 25).map(r => ({
      code: r.code,
      description: r.description,
      confidence: Math.max(0.28, r.score || 0.28),
      matchedText: note.slice(0, 120),
    }));

    return res.status(200).json({
      diagnoses,
      procedures,
      explanation: 'Turso-backed search returned the closest ICD-10, CPT, and HCPCS matches.',
    });
  } catch (error: any) {
    console.error('[API /analyze] Failed:', error);
    return res.status(500).json({
      error: 'AI Analysis Error',
      message: error?.message || 'Failed to complete code search. Please try again.',
    });
  }
}

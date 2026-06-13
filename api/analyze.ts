import { analyzeCatalog } from '../src/vercel/csvService.ts';

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

    return res.status(200).json(analyzeCatalog(note));
  } catch (error: any) {
    console.error('[API /analyze] Semantic search failed:', error);
    return res.status(500).json({
      error: 'AI Analysis Error',
      message: error?.message || 'Failed to complete semantic search. Please try again.',
    });
  }
}

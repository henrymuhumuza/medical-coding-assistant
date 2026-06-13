import { runDirectTursoSearch } from '../src/vercel/directTursoSearch.ts';
import { searchCatalog } from '../src/vercel/csvService.ts';

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
    const { query } = readBody(req);
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query string is required.' });
    }

    try {
      return res.status(200).json(await runDirectTursoSearch(query));
    } catch (error) {
      console.error('[API /search] Turso unavailable; using local catalog:', error);
      return res.status(200).json(searchCatalog(query));
    }
  } catch (error: any) {
    console.error('[API /search] Failed:', error);
    return res.status(500).json({
      error: 'Search failed',
      message: error?.message || 'Failed to search medical codes.',
    });
  }
}

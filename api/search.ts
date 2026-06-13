import { searchTurso } from '../src/vercel/tursoService.ts';

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

  const { query } = readBody(req);
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Search query string is required.' });
  }

  return res.status(200).json(await searchTurso(query));
}

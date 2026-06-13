import { getCatalogInventory } from '../src/vercel/csvService.ts';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const { getTursoInventory } = await import('../src/vercel/tursoService.ts');
    return res.status(200).json(await getTursoInventory());
  } catch (error) {
    console.error('[API /codes] Turso unavailable; using fallback:', error);
    return res.status(200).json(getCatalogInventory());
  }
}

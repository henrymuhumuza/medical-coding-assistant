import { getCodesInventory } from '../src/backend/codingService.ts';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    return res.status(200).json(await getCodesInventory());
  } catch (error: any) {
    console.error('[API /codes] Failed:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error?.message || 'Failed to retrieve code inventory.',
    });
  }
}

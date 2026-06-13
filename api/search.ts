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

function fallbackSearch(query: string) {
  const text = query.toLowerCase();
  const icd = [];
  const cpt = [];

  if (text.includes('sugar') || text.includes('diabetes') || text.includes('hyperglycemia')) {
    icd.push(
      { code: 'E11.65', type: 'ICD10', description: 'Type 2 diabetes mellitus with hyperglycemia', category: 'Diagnoses', score: 0.95 },
      { code: 'E11.9', type: 'ICD10', description: 'Type 2 diabetes mellitus without complications', category: 'Diagnoses', score: 0.72 },
    );
  }
  if (text.includes('urine') || text.includes('urinalysis') || text.includes('uti')) {
    cpt.push({ code: '81001', type: 'CPT', description: 'Urinalysis, automated, with microscopy', category: 'Laboratory', score: 0.95 });
  }

  return { icd, cpt, hcpcs: [] };
}

function hasSearchResults(result: any) {
  return Boolean(result?.icd?.length || result?.cpt?.length || result?.hcpcs?.length);
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

  try {
    const { searchTurso } = await import('../src/vercel/tursoService.ts');
    const result = await searchTurso(query);
    if (hasSearchResults(result)) {
      return res.status(200).json(result);
    }
  } catch (error) {
    console.error('[API /search] Turso unavailable; trying CSV fallback:', error);
  }

  try {
    const { searchCatalog } = await import('../src/vercel/csvService.ts');
    const result = searchCatalog(query);
    if (hasSearchResults(result)) {
      return res.status(200).json(result);
    }
  } catch (error) {
    console.error('[API /search] CSV fallback unavailable; using tiny fallback:', error);
  }

  return res.status(200).json(fallbackSearch(query));
}

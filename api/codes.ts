const fallbackCodes = [
  { code: 'E11.65', type: 'ICD10', description: 'Type 2 diabetes mellitus with hyperglycemia', category: 'Diagnoses' },
  { code: 'E11.9', type: 'ICD10', description: 'Type 2 diabetes mellitus without complications', category: 'Diagnoses' },
  { code: 'I10', type: 'ICD10', description: 'Essential hypertension', category: 'Diagnoses' },
  { code: '81001', type: 'CPT', description: 'Urinalysis, automated, with microscopy', category: 'Laboratory' },
  { code: '83036', type: 'CPT', description: 'Hemoglobin A1c lab monitoring', category: 'Laboratory' },
];

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
    return res.status(200).json({
      codes: fallbackCodes,
      counts: { icd: 3, cpt: 2, hcpcs: 0 },
    });
  }
}

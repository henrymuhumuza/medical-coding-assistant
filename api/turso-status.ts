export default async function handler(_req: any, res: any) {
  const hasUrl = Boolean(process.env.TURSO_DATABASE_URL?.trim());
  const hasToken = Boolean(process.env.TURSO_AUTH_TOKEN?.trim());

  if (!hasUrl || !hasToken) {
    return res.status(200).json({
      ok: false,
      hasUrl,
      hasToken,
      message: 'Turso environment variables are missing in this deployment.',
    });
  }

  try {
    const { createClient } = await import('@libsql/client');
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!.trim(),
      authToken: process.env.TURSO_AUTH_TOKEN!.trim(),
    });

    const countResult = await client.execute('SELECT COUNT(*) as count FROM codes');
    const sampleResult = await client.execute('SELECT code, type, description FROM codes LIMIT 5');

    return res.status(200).json({
      ok: true,
      hasUrl,
      hasToken,
      count: Number((countResult.rows[0] as any)?.count || 0),
      sample: sampleResult.rows,
    });
  } catch (error: any) {
    return res.status(200).json({
      ok: false,
      hasUrl,
      hasToken,
      message: error?.message || 'Failed to query Turso.',
    });
  }
}

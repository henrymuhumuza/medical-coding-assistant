export default function handler(_req: any, res: any) {
  return res.status(200).json({
    ok: true,
    service: 'medical-coding-assistant',
    runtime: 'vercel',
    timestamp: new Date().toISOString(),
  });
}

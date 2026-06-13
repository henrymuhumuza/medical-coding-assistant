/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  analyzeClinicalText,
  ensureDbReady,
  getCodesInventory,
  searchCodesByQuery,
} from './src/backend/codingService.ts';
import { runDeepSeekCodeSearch } from './src/vercel/deepseekAnalyzer.ts';
import { runDirectTursoSearch } from './src/vercel/directTursoSearch.ts';

dotenv.config({ path: ['.env.local', '.env'] });

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(cors());

app.get('/api/codes', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getCodesInventory());
  } catch (error) {
    next(error);
  }
});

app.post('/api/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Search query string is required.' });
      return;
    }

    try {
      res.json(await runDirectTursoSearch(query));
    } catch (error) {
      console.error('[Turso] Local search failed; using SQLite fallback:', error);
      res.json(await searchCodesByQuery(query));
    }
  } catch (error) {
    next(error);
  }
});

app.post('/api/analyze', async (req: Request, res: Response) => {
  try {
    const { note } = req.body;
    if (!note || typeof note !== 'string') {
      res.status(400).json({ error: 'Clinical note or query string is required.' });
      return;
    }

    try {
      res.json(await runDeepSeekCodeSearch(note));
    } catch (error) {
      console.error('[DeepSeek] AI search failed; using SQLite fallback:', error);
      res.json(await analyzeClinicalText(note));
    }
  } catch (error: any) {
    console.error('[AI] Search fallback failed:', error);
    res.status(500).json({
      error: 'AI Analysis Error',
      message: error?.message || 'Failed to complete code search. Please try again.',
    });
  }
});

async function startServer() {
  try {
    await ensureDbReady();
  } catch (err) {
    console.error('[SQLite] Database bootstrapping failed:', err);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const fs = await import('fs');
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Full-Stack] Server booting on port ${PORT}`);
    console.log(`[Full-Stack] Direct address access: http://localhost:${PORT}`);
  });
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected operational failure happened.',
  });
});

startServer();

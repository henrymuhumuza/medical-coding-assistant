# Medical Coding Assistant

Offline-first medical code search for ICD-10-CM, CPT, and HCPCS codes using local SQLite data and local text embeddings.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Start the local Express/Vite server:
   `npm run dev`
3. Open:
   `http://localhost:3000`

## Build

Run:

`npm run build`

The Vite frontend builds to `dist/`. The Node server bundle is also written to `dist/server.cjs` for normal Node hosting.

## Vercel Deployment

This project includes Vercel API functions in `api/`:

- `api/codes.ts`
- `api/search.ts`
- `api/analyze.ts`

Vercel uses `vercel.json` to build the frontend with `vite build` and serve the API functions at `/api/*`.

Important: `clinical_coding.db` should be committed so Vercel can bundle the prebuilt SQLite database with the functions. The server copies it to the runtime temp directory before opening it.

Deploy steps:

1. Push the repo to GitHub.
2. Import the GitHub repo in Vercel.
3. Keep the project settings from `vercel.json`.
4. Deploy.

The local embedding model can be slow on Vercel cold starts. If `/api/analyze` times out on the free plan, increase function resources or use normal Node hosting such as Render/Railway.

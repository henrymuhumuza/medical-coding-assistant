/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SearchResponse, AnalyzeResponse, Code } from '../types.ts';

async function readApiError(response: Response, fallback: string) {
  const text = await response.text().catch(() => '');
  if (!text) return `${fallback} (${response.status})`;

  try {
    const parsed = JSON.parse(text);
    return parsed.message || parsed.error || `${fallback} (${response.status})`;
  } catch {
    return `${fallback} (${response.status}): ${text.slice(0, 240)}`;
  }
}

/**
 * Handles communication with the Express backend
 */
export async function searchCodes(query: string): Promise<SearchResponse> {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to search medical codes.'));
  }
  return response.json();
}

export async function analyzeNote(note: string): Promise<AnalyzeResponse> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Medical note analysis failed.'));
  }
  return response.json();
}

export async function getInventory(): Promise<{ codes: Code[] }> {
  const response = await fetch('/api/codes');
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to retrieve medical codes database inventory.'));
  }
  return response.json();
}

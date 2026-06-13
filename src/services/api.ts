/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SearchResponse, AnalyzeResponse, Code } from '../types.ts';

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
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to search medical codes.');
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
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Medical note analysis failed.');
  }
  return response.json();
}

export async function getInventory(): Promise<{ codes: Code[] }> {
  const response = await fetch('/api/codes');
  if (!response.ok) {
    throw new Error('Failed to retrieve medical codes database inventory.');
  }
  return response.json();
}

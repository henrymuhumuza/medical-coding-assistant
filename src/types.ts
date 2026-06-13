/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum CodeType {
  ICD10 = 'ICD10',
  CPT = 'CPT',
  HCPCS = 'HCPCS',
}

export interface Code {
  id?: number;
  code: string;
  type: CodeType;
  description: string;
  category: string;
  score?: number; // Calculated search relevance score
}

export interface CodeLink {
  id?: number;
  icd_code: string;
  procedure_code: string;
  strength: number;
}

export interface SearchRequest {
  query: string;
}

export interface SearchResponse {
  icd: Code[];
  cpt: Code[];
  hcpcs: Code[];
}

export interface MatchResult {
  code: string;
  description: string;
  confidence: number;
  matchedText: string;
}

export interface AnalyzeRequest {
  note: string;
}

export interface AnalyzeResponse {
  diagnoses: MatchResult[];
  procedures: MatchResult[];
  explanation: string;
}

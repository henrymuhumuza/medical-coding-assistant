/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MatchResult, AnalyzeResponse } from '../types.ts';
import { ShieldCheck, ClipboardCopy, FileText, Check, Cpu } from 'lucide-react';

interface AnalysisResultsProps {
  results: AnalyzeResponse | null;
  isLoading: boolean;
  onCopyAll: () => void;
  copiedState: boolean;
}

export default function AnalysisResults({
  results,
  isLoading,
  onCopyAll,
  copiedState,
}: AnalysisResultsProps) {
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (isLoading) {
    return (
      <div id="results-skeleton-wrapper" className="bg-white/90 border border-[#cbcbbf] rounded p-6 flex flex-col items-center justify-center space-y-4 min-h-[440px]">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-[#1a1a18]/10 border-t-[#1a1a18] animate-spin" />
          <Cpu className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-[#1a1a18]" />
        </div>
        <div className="text-center space-y-1.5 max-w-xs">
          <h4 className="font-heading font-bold text-sm text-[#1a1a18]">Searching Codes</h4>
          <p className="text-xs text-[#78786a] leading-relaxed">
            Matching your text to the closest ICD-10, CPT, and HCPCS codes...
          </p>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div id="no-results-placeholder" className="bg-white/90 border border-[#cbcbbf] rounded p-12 text-center flex flex-col items-center justify-center min-h-[440px] space-y-4">
        <div className="w-12 h-12 bg-[#eaeae4]/60 rounded-full flex items-center justify-center border border-[#eaeae4]">
          <FileText className="w-5.5 h-5.5 text-[#78786a] stroke-[1.5]" />
        </div>
        <div className="space-y-1 max-w-sm">
          <h3 className="font-heading text-sm font-bold text-[#1a1a18]">No Active Assessment Rendered</h3>
          <p className="text-xs text-[#78786a] leading-relaxed">
            Enter or preset a patient documentation chart on the left, then run <strong>Search with AI</strong> to populate matches.
          </p>
        </div>
      </div>
    );
  }

  // Formatting helpers for copying matches
  const totalDiagnoses = results.diagnoses.length;
  const totalProcedures = results.procedures.length;

  return (
    <div id="active-results-wrap" className="space-y-4">
      {/* Matched Content Grid */}
      <div className="bg-white/90 border border-[#cbcbbf] rounded p-4 space-y-4 relative">
        {/* Header toolbar */}
        <div className="flex items-start justify-between border-b border-[#cbcbbf] pb-3" id="results-meta-header">
          <div className="space-y-0.5">
            <span className="font-mono text-[9px] text-[#78786a] font-semibold uppercase tracking-wider block">
              AI Semantic Search Results
            </span>
            <h2 className="font-heading text-lg font-bold text-[#1a1a18] flex items-center gap-1.5">
              <ShieldCheck className="w-5.5 h-5.5 text-[#1a1a18] stroke-[1.5]" />
              Chart Analysis Summary
            </h2>
          </div>
          {(totalDiagnoses > 0 || totalProcedures > 0) && (
            <button
              onClick={onCopyAll}
              id="copy-summary-bill-btn"
              className="p-1.5 px-3 border border-[#1a1a18] hover:bg-[#1a1a18] hover:text-white rounded transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              {copiedState ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Summary Copied</span>
                </>
              ) : (
                <>
                  <ClipboardCopy className="w-3.5 h-3.5" />
                  <span>Copy Matched Codes</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Section 1: Diagnoses (ICD-10-CM) */}
        <div className="space-y-3" id="diagnoses-results-panel">
          <div className="flex items-center gap-1.5 border-b border-[#eaeae4] pb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-[#1a1a18]">
              Primary Diagnoses (ICD-10-CM)
            </h3>
            <span className="text-[10px] text-[#78786a] font-mono leading-none">
              ({totalDiagnoses} MATCHED)
            </span>
          </div>

          {results.diagnoses.length === 0 ? (
            <p className="text-xs text-[#78786a] italic py-2">No diagnostic indicators verified in clinical document.</p>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[300px] pr-1.5">
              {results.diagnoses.map((match) => (
                <div
                  key={match.code}
                  id={`match-icd-${match.code}`}
                  className="bg-[#fdfdfc] border border-[#eaeae4] p-3 rounded space-y-1.5 hover:border-[#cbcbbf] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-[#1a1a18] text-white px-1.5 py-0.5 rounded leading-none">
                        {match.code}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopyCode(match.code)}
                      title="Copy code"
                      className="flex items-center gap-1 text-[10px] font-mono text-[#78786a] hover:text-[#1a1a18] transition-colors cursor-pointer"
                    >
                      {copiedCode === match.code ? (
                        <><Check className="w-3 h-3" /><span>Copied</span></>
                      ) : (
                        <><ClipboardCopy className="w-3 h-3" /><span>Copy</span></>
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-[#1a1a18] leading-snug">
                    {match.description}
                  </p>
                  
                  {/* Matched document reference */}
                  <div className="flex items-baseline gap-1 text-[11px] text-[#78786a]">
                    <span className="italic font-sans">Matched medical text:</span>
                    <span className="font-mono bg-[#eaeae4]/40 px-1.5 py-0.5 rounded text-[#1a1a18] line-clamp-1">
                      &ldquo;{match.matchedText}&rdquo;
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Procedures & Services (CPT / HCPCS) */}
        <div className="space-y-3" id="procedures-results-panel">
          <div className="flex items-center gap-1.5 border-b border-[#eaeae4] pb-1">
            <span className="w-2 h-2 rounded-full bg-sky-600" />
            <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-[#1a1a18]">
              Procedures & Services (CPT / HCPCS)
            </h3>
            <span className="text-[10px] text-[#78786a] font-mono leading-none">
              ({totalProcedures} MATCHED)
            </span>
          </div>

          {results.procedures.length === 0 ? (
            <p className="text-xs text-[#78786a] italic py-2">No procedure codes or service claims extracted.</p>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[300px] pr-1.5">
              {results.procedures.map((match) => {
                const isHcpcs = /^[A-Z]/.test(match.code);
                return (
                  <div
                    key={match.code}
                    id={`match-cpt-${match.code}`}
                    className="bg-[#fdfdfc] border border-[#eaeae4] p-3 rounded space-y-1.5 hover:border-[#cbcbbf] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold bg-[#1a1a18] text-white px-1.5 py-0.5 rounded leading-none">
                          {match.code}
                        </span>
                        <span className={`text-[9px] font-semibold tracking-wider font-mono px-1 rounded rounded-none border border-[#cbcbbf] ${
                          isHcpcs ? 'text-amber-800 bg-amber-50' : 'text-sky-800 bg-sky-50'
                        }`}>
                          {isHcpcs ? 'HCPCS Level II' : 'CPT Procedure'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyCode(match.code)}
                        title="Copy code"
                        className="flex items-center gap-1 text-[10px] font-mono text-[#78786a] hover:text-[#1a1a18] transition-colors cursor-pointer"
                      >
                        {copiedCode === match.code ? (
                          <><Check className="w-3 h-3" /><span>Copied</span></>
                        ) : (
                          <><ClipboardCopy className="w-3 h-3" /><span>Copy</span></>
                        )}
                      </button>
                    </div>
                    <p className="text-xs font-semibold text-[#1a1a18] leading-snug">
                      {match.description}
                    </p>

                    {/* Segment link pointer */}
                    <div className="flex items-baseline gap-1 text-[11px] text-[#78786a]">
                      <span className="italic font-sans">Matched medical text:</span>
                      <span className="font-mono bg-[#eaeae4]/40 px-1.5 py-0.5 rounded text-[#1a1a18] line-clamp-1">
                        &ldquo;{match.matchedText}&rdquo;
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

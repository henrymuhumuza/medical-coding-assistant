/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sparkles, Database } from 'lucide-react';
import NoteAnalyzer from './components/NoteAnalyzer.tsx';
import TemplateNotes from './components/TemplateNotes.tsx';
import AnalysisResults from './components/AnalysisResults.tsx';
import DbExplorer from './components/DbExplorer.tsx';
import { analyzeNote } from './services/api.ts';
import { AnalyzeResponse } from './types.ts';

export default function App() {
  const [noteText, setNoteText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<AnalyzeResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'AI' | 'DB'>('AI');
  const [copiedState, setCopiedState] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleClear = () => {
    setNoteText('');
    setResults(null);
    setErrorText(null);
  };

  const handleAnalyze = async () => {
    if (noteText.trim().length < 10) return;

    setIsLoading(true);
    setErrorText(null);
    // Explicitly focus Scenarios/AI tab first to let users see the loading progress
    setActiveTab('AI');

    try {
      const data = await analyzeNote(noteText);
      setResults(data);
    } catch (err: any) {
      console.error('Extraction error:', err);
      setErrorText(err.message || 'An error occurred during semantic search.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePresetSelect = async (content: string) => {
    setNoteText(content);
    setIsLoading(true);
    setErrorText(null);
    setActiveTab('AI');

    try {
      const data = await analyzeNote(content);
      setResults(data);
    } catch (err: any) {
      console.error('Preset extraction error:', err);
      setErrorText(err.message || 'An error occurred during semantic search.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyAllCodes = () => {
    if (!results) return;

    let textToCopy = `=== CLINICAL CODING MATCH REPORT ===\n\n`;
    textToCopy += `DIAGNOSES (ICD-10-CM):\n`;
    if (results.diagnoses.length === 0) {
      textToCopy += `- None detected\n`;
    } else {
      results.diagnoses.forEach(d => {
        textToCopy += `- [${d.code}] ${d.description} (Matched term: "${d.matchedText}" | Confidence: ${(d.confidence * 100).toFixed(0)}%)\n`;
      });
    }

    textToCopy += `\nPROCEDURES & SERVICES (CPT/HCPCS):\n`;
    if (results.procedures.length === 0) {
      textToCopy += `- None detected\n`;
    } else {
      results.procedures.forEach(p => {
        textToCopy += `- [${p.code}] ${p.description} (Matched term: "${p.matchedText}" | Confidence: ${(p.confidence * 100).toFixed(0)}%)\n`;
      });
    }

    textToCopy += `Generated via Medical Coding Assistant.`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f4f4f0] text-[#1a1a18] selection:bg-[#eaeae4] selection:text-[#1a1a18] flex flex-col font-sans" id="applet-primary-view">

      {/* Editorial Header Section */}
      <header className="border-b border-[#cbcbbf] bg-white p-5 sticky top-0 z-10" id="editorial-header">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          {/* Logo & Headline */}
          <div className="flex items-center gap-3">
            <img
              src="/medical-coding-icon.svg"
              alt=""
              aria-hidden="true"
              className="w-11 h-11 rounded-2xl border border-[#cbcbbf] shadow-sm"
            />
            <div className="space-y-0.5">
            <h1 className="font-heading text-xl lg:text-2xl font-extrabold tracking-tight text-[#1a1a18] leading-none">
              Medical Coding Assistant
            </h1>
            <p className="font-mono text-[10px] text-[#78786a] uppercase tracking-wider">
              ICD-10 | CPT | HCPCS | AI Semantic Search
            </p>
            </div>
          </div>

        </div>
      </header>

      {/* Primary Grid Layout */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6" id="dashboard-layout-grid">

        {/* Left Column: Prominent Note Entry intake */}
        <section className="space-y-4" id="left-column-analyzer">
          <div className="bg-white/90 rounded border border-[#cbcbbf] p-4 flex flex-col space-y-3 shadow-sm">
            <div className="border-b border-[#cbcbbf] pb-2">
              <h2 className="font-heading text-base font-bold text-[#1a1a18]">
                Analyze Clinical Documentation
              </h2>
              <p className="text-xs text-[#78786a]">
                Type or paste raw medical charts and physician reports to instantly extract diagnostic codes.
              </p>
            </div>

            {/* Note Intake form box */}
            <NoteAnalyzer
              noteText={noteText}
              setNoteText={setNoteText}
              onSubmit={handleAnalyze}
              isLoading={isLoading}
              onClear={handleClear}
            />

            {errorText && (
              <div className="p-3 bg-red-50 border border-red-300 text-red-800 rounded text-xs space-y-1" id="analysis-error-banner">
                <p className="font-semibold">Extraction execution interrupted</p>
                <p className="text-[11px] opacity-90">{errorText}</p>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Tabbed controls for practice scenarios/results, local database explorer, and association maps */}
        <section className="flex flex-col h-full space-y-4" id="right-column-results">

          {/* Header tabs selector */}
          <div className="flex border border-[#cbcbbf] bg-white rounded overflow-hidden shadow-sm" id="dashboard-tabs">
            <button
              onClick={() => setActiveTab('AI')}
              id="tab-btn-ai"
              className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 transition-all leading-none ${activeTab === 'AI'
                  ? 'bg-[#1a1a18] text-white'
                  : 'bg-white hover:bg-[#eaeae4]/30 text-[#78786a] border-r border-[#cbcbbf]'
                }`}
            >
              <Sparkles className="w-4.5 h-4.5 stroke-[1.5]" />
              AI SEARCH
            </button>
            <button
              onClick={() => setActiveTab('DB')}
              id="tab-btn-db"
              className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 transition-all leading-none ${activeTab === 'DB'
                  ? 'bg-[#1a1a18] text-white'
                  : 'bg-white hover:bg-[#eaeae4]/30 text-[#78786a]'
                }`}
            >
              <Database className="w-4.5 h-4.5 stroke-[1.5]" />
              LOCAL SEARCH
            </button>
          </div>

          {/* Active Tab View Rendering */}
          <div className="flex-grow min-h-[460px] h-full" id="tab-viewport">
            {activeTab === 'AI' && (
              isLoading || results ? (
                <div className="space-y-3">
                  {/* Sub-header inside tab to allow returning to the presets list */}
                  <div className="flex justify-between items-center bg-white p-3 rounded border border-[#cbcbbf] shadow-sm">
                    <button
                      onClick={() => setResults(null)}
                      className="text-xs font-bold text-[#1a1a18] hover:underline transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      ← Back to Practice Scenarios
                    </button>
                    <span className="font-mono text-[9px] text-[#78786a] uppercase">
                      {isLoading ? 'Running Analysis...' : 'Extraction Report'}
                    </span>
                  </div>

                  <AnalysisResults
                    results={results}
                    isLoading={isLoading}
                    onCopyAll={handleCopyAllCodes}
                    copiedState={copiedState}
                  />
                </div>
              ) : (
                <div className="bg-white/90 border border-[#cbcbbf] rounded p-4 shadow-sm">
                  <TemplateNotes onSelect={handlePresetSelect} />
                </div>
              )
            )}
            {activeTab === 'DB' && (
              <DbExplorer />
            )}
          </div>

        </section>

      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-[#cbcbbf] bg-white py-4 px-6 mt-12" id="editorial-footer">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] font-mono text-[#78786a]">
          <div>
            MEDICAL CODING ASSISTANT
          </div>
          <div className="flex items-center gap-3">
            <span>Local Semantic Search · ICD-10 · CPT · HCPCS</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

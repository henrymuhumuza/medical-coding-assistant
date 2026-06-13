/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sparkles, Trash2, ShieldAlert, Cpu } from 'lucide-react';

interface NoteAnalyzerProps {
  noteText: string;
  setNoteText: (text: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  onClear: () => void;
}

export default function NoteAnalyzer({
  noteText,
  setNoteText,
  onSubmit,
  isLoading,
  onClear,
}: NoteAnalyzerProps) {
  const [characterCount, setCharacterCount] = useState(noteText.length);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setNoteText(text);
    setCharacterCount(text.length);
  };

  const isFormValid = noteText.trim().length >= 10;

  return (
    <div id="note-analyzer-wrapper" className="space-y-4">
      
      {/* Primary Clinical Note Intake Sheet */}
      <div id="intake-sheet" className="p-5 rounded border border-[#cbcbbf] bg-white shadow-sm space-y-4 relative overflow-hidden">
        
        <div className="flex items-center justify-between border-b border-[#cbcbbf] pb-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4.5 h-4.5 stroke-[1.5] text-[#1a1a18]" />
            <span className="font-heading text-sm font-bold text-[#1a1a18]">
              Clinical Code Search
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[9px] text-[#78786a] bg-[#eaeae4]/60 px-1.5 py-0.5 rounded">
              {characterCount} CHARACTERS
            </span>
            {noteText && (
              <button
                type="button"
                id="clear-note-clipboard-btn"
                onClick={() => {
                  onClear();
                  setCharacterCount(0);
                }}
                className="text-[#78786a] hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition-colors flex items-center gap-1 text-[10px] font-mono leading-none border border-transparent hover:border-red-200"
                title="Clear input text"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>CLEAR</span>
              </button>
            )}
          </div>
        </div>

        {/* Text Intake Component - Height reduced to feel like a search field */}
        <textarea
          id="clinical-note-textarea"
          value={noteText}
          onChange={handleTextChange}
          placeholder="Search by keywords, symptoms, medical concepts or raw notes (e.g. 'sugar disease and urine test', 'chest pain and electrocardiogram')..."
          className="w-full h-[160px] border border-[#cbcbbf] hover:border-[#1a1a18] bg-[#fdfdfc] text-sm text-[#1a1a18] placeholder-[#a9a996] rounded p-4 focus:outline-none focus:ring-1 focus:ring-[#1a1a18] focus:border-[#1a1a18] leading-relaxed resize-none transition-all shadow-inner"
        />

        <div className="flex items-center justify-between gap-4 pt-1 flex-wrap">
          {/* Note Requirements Alert */}
          <div className="flex items-center gap-1.5 text-[10.5px] text-[#78786a] leading-none" id="note-character-requirement">
            <Cpu className="w-3.5 h-3.5 stroke-[1.5] text-[#1a1a18]" />
            <span>Search symptoms, phrases, codes, or full notes.</span>
          </div>

          <button
            type="button"
            id="analyze-note-submit-btn"
            onClick={onSubmit}
            disabled={isLoading || !isFormValid}
            className="bg-[#1a1a18] hover:bg-[#343431] text-white text-xs font-semibold px-5 py-2.5 rounded transition-all flex items-center justify-center gap-2 disabled:bg-[#cbcbbf]/60 disabled:text-[#78786a] disabled:cursor-not-allowed cursor-pointer shadow-sm hover:shadow w-auto max-w-[180px]"
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Search Codes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Simplified, Minimalist HIPAA privacy note */}
      <div className="border border-[#cbcbbf]/30 bg-[#eaeae4]/10 p-2.5 rounded flex items-center gap-2 text-[10.5px] text-[#78786a]" id="clinic-privacy-warning">
        <ShieldAlert className="w-4 h-4 text-[#78786a] shrink-0" />
        <p>
          <strong>HIPAA Compliance:</strong> Ensure all clinical entries are de-identified before processing.
        </p>
      </div>
    </div>
  );
}

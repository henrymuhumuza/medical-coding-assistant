/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Copy, Check, Search, Database, Layers, Info } from 'lucide-react';
import { Code, CodeType } from '../types.ts';
import { getInventory, searchCodes } from '../services/api.ts';

export default function DbExplorer() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | CodeType>('ALL');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [dbCounts, setDbCounts] = useState({ icd: 0, cpt: 0, hcpcs: 0 });

  // Load baseline directory inventory and total counts on mount
  useEffect(() => {
    async function loadCodes() {
      setIsLoading(true);
      try {
        const data = await getInventory();
        setCodes(data.codes);
        if ((data as any).counts) {
          setDbCounts((data as any).counts);
        } else {
          // Fallback if counts is missing (e.g. mock memory db)
          const icd = data.codes.filter(c => c.type === CodeType.ICD10).length;
          const cpt = data.codes.filter(c => c.type === CodeType.CPT).length;
          const hcpcs = data.codes.filter(c => c.type === CodeType.HCPCS).length;
          setDbCounts({ icd, cpt, hcpcs });
        }
      } catch (err) {
        console.error('Error fetching inventory codes:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadCodes();
  }, []);

  // Trigger fuzzy scoring SQL search when query updates (debounced / on submit)
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setActiveFilter('ALL');
    try {
      if (searchQuery.trim() === '') {
        const data = await getInventory();
        setCodes(data.codes);
      } else {
        const data = await searchCodes(searchQuery);
        // Concatenate categorized codes into a unified flat list
        setCodes([...data.icd, ...data.cpt, ...data.hcpcs].sort((a, b) => (b.score || 0) - (a.score || 0)));
      }
    } catch (err) {
      console.error('Search query failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  // Live filter active codes based on selection
  const filteredCodes = activeFilter === 'ALL' 
    ? codes 
    : codes.filter(c => c.type === activeFilter);

  // Dynamic filter stats counts for display labels
  const loadedIcdCount = codes.filter(c => c.type === CodeType.ICD10).length;
  const loadedCptCount = codes.filter(c => c.type === CodeType.CPT).length;
  const loadedHcpcsCount = codes.filter(c => c.type === CodeType.HCPCS).length;

  const totalDbSize = dbCounts.icd + dbCounts.cpt + dbCounts.hcpcs;

  return (
    <div id="db-explorer-panel" className="bg-white/90 rounded border border-[#cbcbbf] p-4 flex flex-col h-full space-y-4">
      
      {/* Editorial Title & Overview */}
      <div className="flex items-start justify-between border-b border-[#cbcbbf] pb-3">
        <div className="space-y-1">
          <h2 className="font-heading text-lg font-bold text-[#1a1a18] flex items-center gap-2">
            <Database className="w-5 h-5 stroke-[1.5]" />
            Clinical Code Database Inventory
          </h2>
          <p className="text-xs text-[#78786a] leading-relaxed">
            Search the medical code database directly.
          </p>
        </div>
      </div>

      {/* Modern Search Row */}
      <form onSubmit={handleSearch} className="flex gap-2" id="search-codes-form">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78786a] pointer-events-none" />
          <input
            type="text"
            id="search-codes-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search code literals or key terms (e.g., 'E11.9', 'diabetes', 'lipid')..."
            className="w-full pl-9 pr-4 py-2 border border-[#cbcbbf] rounded bg-[#fcfcf9] text-sm text-[#1a1a18] placeholder-[#a9a996] focus:outline-none focus:ring-1 focus:ring-[#1a1a18] focus:border-[#1a1a18] transition-all"
          />
        </div>
        <button
          type="submit"
          id="search-codes-submit-btn"
          disabled={isLoading}
          className="bg-[#1a1a18] hover:bg-[#343431] text-white text-xs font-semibold px-4 rounded transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : 'Search Database'}
        </button>
      </form>

      {/* Unified Filters Row */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[#eaeae4]" id="type-tabs">
        <button
          onClick={() => setActiveFilter('ALL')}
          id="tab-all-codes"
          className={`px-3 py-1.5 text-xs font-semibold transition-colors rounded leading-none whitespace-nowrap ${
            activeFilter === 'ALL'
              ? 'bg-[#eaeae4] text-[#1a1a18] border border-[#1a1a18]'
              : 'text-[#78786a] hover:bg-[#eaeae4]/40 border border-transparent'
          }`}
        >
          All Loaded ({codes.length})
        </button>
        <button
          onClick={() => setActiveFilter(CodeType.ICD10)}
          id="tab-icd10-codes"
          className={`px-3 py-1.5 text-xs font-semibold transition-colors rounded leading-none flex items-center gap-1.5 whitespace-nowrap ${
            activeFilter === CodeType.ICD10
              ? 'bg-[#eaeae4] text-[#1a1a18] border border-[#1a1a18]'
              : 'text-[#78786a] hover:bg-[#eaeae4]/40 border border-transparent'
          }`}
        >
          <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
          ICD-10 ({loadedIcdCount})
        </button>
        <button
          onClick={() => setActiveFilter(CodeType.CPT)}
          id="tab-cpt-codes"
          className={`px-3 py-1.5 text-xs font-semibold transition-colors rounded leading-none flex items-center gap-1.5 whitespace-nowrap ${
            activeFilter === CodeType.CPT
              ? 'bg-[#eaeae4] text-[#1a1a18] border border-[#1a1a18]'
              : 'text-[#78786a] hover:bg-[#eaeae4]/40 border border-transparent'
          }`}
        >
          <span className="w-1.5 h-1.5 bg-sky-600 rounded-full" />
          CPT ({loadedCptCount})
        </button>
        <button
          onClick={() => setActiveFilter(CodeType.HCPCS)}
          id="tab-hcpcs-codes"
          className={`px-3 py-1.5 text-xs font-semibold transition-colors rounded leading-none flex items-center gap-1.5 whitespace-nowrap ${
            activeFilter === CodeType.HCPCS
              ? 'bg-[#eaeae4] text-[#1a1a18] border border-[#1a1a18]'
              : 'text-[#78786a] hover:bg-[#eaeae4]/40 border border-transparent'
          }`}
        >
          <span className="w-1.5 h-1.5 bg-amber-600 rounded-full" />
          HCPCS ({loadedHcpcsCount})
        </button>
      </div>

      {/* Info Notice for large databases */}
      <div className="flex items-center gap-2 bg-[#eaeae4]/30 p-2.5 rounded border border-[#eaeae4] text-[11px] text-[#78786a]">
        <Info className="w-3.5 h-3.5 text-[#1a1a18] shrink-0" />
        {searchQuery ? (
          <p>Showing top {filteredCodes.length} matching search results.</p>
        ) : (
          <p>Showing first {filteredCodes.length} codes. Use search above to locate specific entries in the database.</p>
        )}
      </div>

      {/* Dynamic Results Grid */}
      <div className="flex-grow overflow-y-auto max-h-[380px] pr-1 space-y-2 border border-[#eaeae4] bg-[#fdfdfc] rounded p-2" id="codes-items-scroll">
        {isLoading && codes.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <span className="w-6 h-6 border-2 border-black/10 border-t-black rounded-full animate-spin" />
            <span className="text-xs text-[#78786a] font-mono">Querying SQLite dictionary...</span>
          </div>
        ) : filteredCodes.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-2 border border-dashed border-[#cbcbbf] rounded bg-[#fcfcf9]">
            <Layers className="w-8 h-8 text-[#cbcbbf] stroke-[1]" />
            <p className="text-xs font-semibold text-[#1a1a18]">No matching codes detected</p>
            <p className="text-[11px] text-[#78786a] max-w-xs px-4">
              Try a different keyword or search for standard diagnostic abbreviations.
            </p>
          </div>
        ) : (
          filteredCodes.map((item) => (
            <div
              key={item.id || item.code}
              id={`code-card-${item.code}`}
              className="group flex items-start justify-between p-3 border border-[#eaeae4] hover:border-[#cbcbbf] rounded bg-white transition-all hover:shadow-[0_2px_4px_rgba(26,26,24,0.03)]"
            >
              <div className="space-y-1 pr-4">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-xs font-bold text-white bg-[#1a1a18] px-1.5 py-0.5 rounded leading-none tracking-wide">
                    {item.code}
                  </span>
                  <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded leading-none ${
                    item.type === CodeType.ICD10
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : item.type === CodeType.CPT
                      ? 'bg-sky-50 text-sky-800 border border-sky-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {item.type}
                  </span>
                  <span className="text-[10px] text-[#78786a] font-mono">
                    {item.category.split(' / ')[0]}
                  </span>
                </div>
                <p className="text-xs font-semibold text-[#1a1a18] leading-normal font-sans">
                  {item.description}
                </p>
              </div>

              {/* Copy action helper */}
              <button
                onClick={() => handleCopy(item.code)}
                id={`copy-code-btn-${item.code}`}
                title="Copy code to clipboard"
                className="p-1 px-1.5 border border-[#eaeae4] hover:border-[#1a1a18] rounded transition-all text-[#78786a] hover:text-[#1a1a18] bg-[#fcfcf9] hover:bg-[#eaeae4]/30 flex items-center justify-center gap-1 self-start"
              >
                {copiedCode === item.code ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="text-[9px] font-mono text-emerald-700">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-mono">Copy</span>
                  </>
                )}
              </button>
            </div>
          ))
        )}
      </div>
      <div className="flex justify-between items-center bg-[#eaeae4]/40 p-2.5 rounded border border-[#eaeae4]" id="total-inventory-stats">
        <span className="text-[10px] font-mono text-[#78786a] flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-[#1a1a18]" />
          TOTAL DATABASE INVENTORY SIZES
        </span>
        <span className="text-[10px] font-mono font-semibold text-[#1a1a18]">
          {dbCounts.icd} Diagnoses · {dbCounts.cpt} Procedures · {dbCounts.hcpcs} Drugs (Total: {totalDbSize})
        </span>
      </div>
    </div>
  );
}

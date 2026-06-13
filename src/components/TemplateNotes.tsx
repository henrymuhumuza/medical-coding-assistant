/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Activity, Flame, ShieldAlert, HeartPulse } from 'lucide-react';

export interface NotePreset {
  id: string;
  title: string;
  description: string;
  content: string;
  icon: React.ReactNode;
  iconBg: string;
}

export const PRESETS: NotePreset[] = [
  {
    id: 'diabetes',
    title: 'Metabolic Diabetes Check',
    description: 'Routine Type 2 Diabetes status checkup and glycosylated hemoglobin lab processing.',
    content: 'Patient with type 2 diabetes mellitus seen for routine follow-up. Blood pressure remains marginally elevated but vital signs are otherwise stable. A blood sample was collected by venous blood venipuncture to process a glycosylated HbA1c test to evaluate metabolic status. Counseling on nutritional guidelines was reinforced.',
    icon: <Flame className="w-4 h-4 text-emerald-700" />,
    iconBg: 'bg-emerald-50 border-emerald-200'
  },
  {
    id: 'cardio',
    title: 'Cardiology Assessment',
    description: 'Male consultation for unspecified chest pain with immediate in-office electrocardiography.',
    content: '62-year-old male with historical essential primary hypertension presented with sudden brief chest pain. Conducted a routine 12-lead electrocardiogram (ECG) with interpretation in the clinic. Advised patient on pain monitoring.',
    icon: <HeartPulse className="w-4 h-4 text-sky-700" />,
    iconBg: 'bg-sky-50 border-sky-200'
  },
  {
    id: 'preventive',
    title: 'Preventive Wellness',
    description: 'Adult physical evaluation with influenza immunization management.',
    content: 'Healthy 34-year-old female seen for her annual preventive medicine re-evaluation and physical wellness visit. Recommended and successfully administered her annual preservative-free quadrivalent split virus influenza vaccine via intramuscular injection.',
    icon: <Activity className="w-4 h-4 text-purple-700" />,
    iconBg: 'bg-purple-50 border-purple-200'
  },
  {
    id: 'acute-uti',
    title: 'Acute Infection & Injection',
    description: 'Urinary tract infection review with automated urinalysis and clinic injection of Toradol.',
    content: 'Patient presented with acute dysuria indicating a suspected urinary tract infection. Collected blood and urine for automated urinalysis with microscopy. For severe acute flank discomfort, administered a curative therapeutic intramuscular injection of Toradol (ketorolac, 15 mg) in the clinic.',
    icon: <ShieldAlert className="w-4 h-4 text-amber-700" />,
    iconBg: 'bg-amber-50 border-amber-200'
  },
];

interface TemplateNotesProps {
  onSelect: (content: string) => void;
  selectedId?: string;
}

export default function TemplateNotes({ onSelect, selectedId }: TemplateNotesProps) {
  return (
    <div className="space-y-4" id="template-notes-container">
      <div className="space-y-1.5 border-b border-[#cbcbbf] pb-3">
        <h3 className="font-heading text-base font-bold text-[#1a1a18]">
          Practice Scenarios
        </h3>
        <p className="text-xs text-[#78786a] leading-relaxed">
          Select one of the standard clinic cases below to see how the local search matches notes to ICD-10, CPT, and HCPCS codes.
        </p>
      </div>
      
      <div className="grid grid-cols-1 gap-3" id="preset-list">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            id={`preset-btn-${preset.id}`}
            onClick={() => onSelect(preset.content)}
            className={`text-left p-4 rounded border transition-all flex gap-3.5 items-start cursor-pointer group ${
              selectedId === preset.id
                ? 'bg-[#eaeae4] border-[#1a1a18] shadow-[0_2px_8px_rgba(26,26,24,0.05)]'
                : 'bg-[#fdfdfc] border-[#eaeae4] hover:bg-white hover:border-[#cbcbbf] hover:shadow-[0_2px_6px_rgba(26,26,24,0.03)]'
            }`}
          >
            <div className={`p-2 rounded border shrink-0 ${preset.iconBg}`}>
              {preset.icon}
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] text-[#78786a] uppercase tracking-wider">
                  Scenario #{preset.id.toUpperCase()}
                </span>
                {selectedId === preset.id && (
                  <span className="font-mono text-[8px] font-bold text-white bg-emerald-600 px-1 py-0.2 rounded leading-none uppercase">
                    Loaded
                  </span>
                )}
              </div>
              <h4 className="font-heading text-xs font-bold text-[#1a1a18] group-hover:underline">
                {preset.title}
              </h4>
              <p className="text-[11px] text-[#78786a] leading-relaxed">
                {preset.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

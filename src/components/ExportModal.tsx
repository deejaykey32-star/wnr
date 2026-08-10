import React, { useState } from 'react';
import { FileDown, FileText, Download, X, Shield, BookOpen, Layers, Sparkles, CheckCircle2 } from 'lucide-react';
import rhzData from '../../RHZ365_pierwszy_cykl_175_dni.json';
import { generateCustomScopePdf } from '../utils/pdfGenerator';
import { generateEpubBook } from '../utils/epubGenerator';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  dayOfCycle: number;
  isAuthorized: boolean;
  userEmail: string;
  prayers: Record<string, { title: string; text: string }>;
  blogEntries: Record<string, { title: string; text: string; dayIndex: number }>;
  theme?: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  dayOfCycle,
  isAuthorized,
  userEmail,
  prayers,
  blogEntries,
  theme = 'dark'
}) => {
  const isLight = theme === 'light';

  // Export Settings State
  const [exportFormat, setExportFormat] = useState<'pdf' | 'epub'>('pdf');
  const [exportScope, setExportScope] = useState<'rhz365' | 'wnr365' | 'both'>('both');
  const [exportRange, setExportRange] = useState<'single' | 'full'>('single');
  const [includeCover, setIncludeCover] = useState<boolean>(true);

  // Status & Progress
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  // Admin JSON Backup
  const [jsonRhz, setJsonRhz] = useState<boolean>(true);
  const [jsonWnr, setJsonWnr] = useState<boolean>(true);
  const [isExportingJson, setIsExportingJson] = useState<boolean>(false);
  const [jsonExportSuccess, setJsonExportSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleBookExport = async () => {
    setIsGenerating(true);
    setProgressMsg('Przygotowywanie pliku publikacji...');
    try {
      if (exportFormat === 'pdf') {
        await generateCustomScopePdf({
          scope: exportScope,
          range: exportRange,
          includeCover,
          selectedDate,
          dayOfCycle,
          prayers,
          blogEntries
        }, (msg) => setProgressMsg(msg));
      } else {
        await generateEpubBook({
          scope: exportScope,
          range: exportRange,
          includeCover,
          selectedDate,
          dayOfCycle,
          prayers,
          blogEntries
        }, (msg) => setProgressMsg(msg));
      }
    } catch (err) {
      console.error('Błąd eksportu publikacji:', err);
      alert('Wystąpił błąd podczas generowania pliku. Proszę spróbować ponownie.');
    } finally {
      setIsGenerating(false);
      setProgressMsg('');
    }
  };

  const handleJsonExport = () => {
    if (!isAuthorized) {
      alert('Odmowa dostępu: Wymagane uprawnienia administratora.');
      return;
    }

    if (!jsonRhz && !jsonWnr) {
      alert('Wybierz co najmniej jedną sekcję do eksportu JSON.');
      return;
    }

    setIsExportingJson(true);
    try {
      const exportObject: any = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        exportedBy: userEmail || 'Administrator',
        sections: []
      };

      if (jsonRhz) {
        exportObject.sections.push('RHZ365');
        exportObject.rhz365 = rhzData.map(item => {
          const dayNum = item.dayNumber;
          const decIdx = ((dayNum - 1) % 5) + 1;
          const firestoreKey = `day_${dayNum}_decade_rgba_${decIdx}`;
          const custom = prayers[firestoreKey];
          return {
            ...item,
            title: custom?.title || item.title,
            text: custom?.text || item.text,
            updatedBy: custom?.updatedBy,
            updatedAt: custom?.updatedAt
          };
        });
      }

      if (jsonWnr) {
        exportObject.sections.push('WnR365');
        exportObject.wnr365 = blogEntries;
      }

      const jsonStr = JSON.stringify(exportObject, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `widokinaraj-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setJsonExportSuccess(true);
      setTimeout(() => setJsonExportSuccess(false), 4000);
    } catch (err) {
      console.error('Błąd eksportu JSON:', err);
      alert('Wystąpił błąd podczas generowania pliku JSON.');
    } finally {
      setIsExportingJson(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className={`w-full max-w-full sm:max-w-xl rounded-2xl border shadow-2xl overflow-hidden text-left relative my-auto transition-all ${
        isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-slate-100'
      }`}>
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 bg-indigo-950/60 border border-indigo-800/60 rounded-xl text-indigo-400">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                Eksport Publikacji (PDF & EPUB)
              </h3>
              <p className="text-xs text-slate-400">Pobierz gotowe wydanie zwarte lub e-booka na czytnik</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg transition"
            aria-label="Zamknij"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* SECTION 1: FORMAT SELECTION */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              1. Format Docelowy Publikacji:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExportFormat('pdf')}
                className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 min-h-[50px] ${
                  exportFormat === 'pdf'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-950/40'
                    : isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>PDF (Druk Poligraficzny)</span>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('epub')}
                className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 min-h-[50px] ${
                  exportFormat === 'epub'
                    ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-950/40'
                    : isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>EPUB (E-czytniki E-book)</span>
              </button>
            </div>
          </div>

          {/* SECTION 2: SCOPE SELECTION */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              2. Zakres Zawartości:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setExportScope('rhz365')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[44px] ${
                  exportScope === 'rhz365'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                    : isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                RHZ365 (Różaniec)
              </button>
              <button
                type="button"
                onClick={() => setExportScope('wnr365')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[44px] ${
                  exportScope === 'wnr365'
                    ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                    : isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                WnR365 (Widoki na Raj)
              </button>
              <button
                type="button"
                onClick={() => setExportScope('both')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[44px] ${
                  exportScope === 'both'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                RHZ365 + WnR365
              </button>
            </div>
          </div>

          {/* SECTION 3: RANGE SELECTION */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              3. Wybór Przedziału Dni:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExportRange('single')}
                className={`p-3 rounded-xl border text-xs font-bold transition text-left flex items-start gap-2.5 min-h-[50px] ${
                  exportRange === 'single'
                    ? 'bg-indigo-950/80 text-indigo-200 border-indigo-600 ring-1 ring-indigo-500'
                    : isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                <Layers className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="block font-bold">Aktualny Dzień</span>
                  <span className="text-[11px] opacity-80 font-normal">Dzień {dayOfCycle} z 365</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExportRange('full')}
                className={`p-3 rounded-xl border text-xs font-bold transition text-left flex items-start gap-2.5 min-h-[50px] ${
                  exportRange === 'full'
                    ? 'bg-amber-950/80 text-amber-200 border-amber-600 ring-1 ring-amber-500'
                    : isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="block font-bold">Całość (Wszystkie dni)</span>
                  <span className="text-[11px] opacity-80 font-normal">Pełna księga 365 dni</span>
                </div>
              </button>
            </div>
          </div>

          {/* SECTION 4: COVER OPTION */}
          <label className="flex items-center gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800/80 cursor-pointer">
            <input
              type="checkbox"
              checked={includeCover}
              onChange={(e) => setIncludeCover(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer shrink-0"
            />
            <span className="text-xs font-semibold text-slate-300">
              Dołącz stronę okładkową ("Widoki na Raj - Misja barw i kolorów...")
            </span>
          </label>

          {/* Progress Message Box */}
          {progressMsg && (
            <div className="p-3 bg-indigo-950/60 border border-indigo-800/80 text-indigo-300 rounded-xl text-xs font-mono animate-pulse flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{progressMsg}</span>
            </div>
          )}

          {/* DOWNLOAD BUTTON */}
          <button
            type="button"
            onClick={handleBookExport}
            disabled={isGenerating}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            {isGenerating 
              ? 'Generowanie Publikacji...' 
              : `Generuj i Pobierz Plik ${exportFormat.toUpperCase()} (${exportRange === 'single' ? `Dzień ${dayOfCycle}` : 'Całość 365 Dni'})`}
          </button>

          {/* ADMIN BACKUP SECTION */}
          {isAuthorized && (
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Kopia Zapasowa JSON (Administrator)
                  </h4>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={jsonRhz}
                    onChange={(e) => setJsonRhz(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-300">RHZ365</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={jsonWnr}
                    onChange={(e) => setJsonWnr(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-300">WnR365</span>
                </label>
              </div>

              {jsonExportSuccess && (
                <div className="p-3 bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 rounded-xl text-xs font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Plik JSON został pomyślnie wygenerowany.</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleJsonExport}
                disabled={isExportingJson}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>📦 Eksportuj Kopię Zapasową (.json)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

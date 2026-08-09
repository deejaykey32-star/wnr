import React, { useState } from 'react';
import { FileDown, FileText, Download, X, Shield, CheckSquare, Square, FileSpreadsheet } from 'lucide-react';
import rhzData from '../../RHZ365_pierwszy_cykl_175_dni.json';
import { generateCustomScopePdf } from '../utils/pdfGenerator';

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

  // PDF Export States
  const [pdfScope, setPdfScope] = useState<'rhz365' | 'wnr365' | 'both'>('both');
  const [pdfIncludeCover, setPdfIncludeCover] = useState<boolean>(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfProgressMsg, setPdfProgressMsg] = useState<string>('');

  // Admin JSON Export States
  const [jsonRhz, setJsonRhz] = useState<boolean>(true);
  const [jsonWnr, setJsonWnr] = useState<boolean>(true);
  const [isExportingJson, setIsExportingJson] = useState<boolean>(false);
  const [jsonExportSuccess, setJsonExportSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handlePdfExport = async () => {
    setIsGeneratingPdf(true);
    setPdfProgressMsg('Przygotowywanie dokumentu PDF...');
    try {
      await generateCustomScopePdf({
        scope: pdfScope,
        includeCover: pdfIncludeCover,
        selectedDate,
        dayOfCycle,
        prayers,
        blogEntries
      }, (msg) => setPdfProgressMsg(msg));
    } catch (err) {
      console.error('Błąd eksportu PDF:', err);
      alert('Wystąpił błąd podczas generowania dokumentu PDF.');
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgressMsg('');
    }
  };

  const handleJsonExport = () => {
    if (!isAuthorized) {
      alert('Odmowa dostępu: Wymagane uprawnienia administratora (kuta.dominik@gmail.com / aleksandrasabasz@gmail.com).');
      return;
    }

    if (!jsonRhz && !jsonWnr) {
      alert('Wybierz co najmniej jedną sekcję do eksportu JSON (RHZ365 lub WnR365).');
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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden text-left relative transition-all ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
      }`}>
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-950/60 border border-indigo-800/60 rounded-xl text-indigo-400">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Eksport i Kopia Zapasowa (PDF & JSON)
              </h3>
              <p className="text-xs text-slate-400">Generowanie ksiąg PDF oraz eksport bazy dla Administratora</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* SECTION 1: PDF EXPORT */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <h4 className={`text-sm font-bold uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                1. Eksport Dokumentu PDF (Dzień {dayOfCycle})
              </h4>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-400">Wybierz zakres dokumentu:</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPdfScope('rhz365')}
                  className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                    pdfScope === 'rhz365'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-950/40'
                      : isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  RHZ365 (Różaniec)
                </button>
                <button
                  type="button"
                  onClick={() => setPdfScope('wnr365')}
                  className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                    pdfScope === 'wnr365'
                      ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-950/40'
                      : isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  WnR365 (Widoki na Raj)
                </button>
                <button
                  type="button"
                  onClick={() => setPdfScope('both')}
                  className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                    pdfScope === 'both'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/40'
                      : isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  RHZ365 + WnR365
                </button>
              </div>

              {/* Cover Option */}
              <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdfIncludeCover}
                  onChange={(e) => setPdfIncludeCover(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <span className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  Dołącz stronę okładkową ("Różaniec Historii Zbawienia" / "Widoki na Raj")
                </span>
              </label>

              {pdfProgressMsg && (
                <div className="p-3 bg-indigo-950/50 border border-indigo-800/60 text-indigo-300 rounded-xl text-xs font-mono animate-pulse">
                  {pdfProgressMsg}
                </div>
              )}

              <button
                type="button"
                onClick={handlePdfExport}
                disabled={isGeneratingPdf}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                {isGeneratingPdf ? 'Generowanie PDF...' : 'Generuj i Pobierz Plik PDF'}
              </button>
            </div>
          </div>

          {/* SECTION 2: ADMIN JSON EXPORT */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <h4 className={`text-sm font-bold uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                  2. Eksport Danych JSON (Tylko Administrator)
                </h4>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                isAuthorized ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {isAuthorized ? 'UPRAWNIENIA POTWIERDZONE' : 'BRAK UPRAWNIEŃ'}
              </span>
            </div>

            {!isAuthorized ? (
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                <p className="font-bold text-slate-300">Dostęp zastrzeżony dla administratorów serwisu</p>
                <p>Eksport bazy JSON jest widoczny wyłącznie dla zalogowanych kont: <strong>kuta.dominik@gmail.com</strong> oraz <strong>aleksandrasabasz@gmail.com</strong>.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-400">Wybierz sekcje do dołączenia w pliku .json:</label>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={jsonRhz}
                      onChange={(e) => setJsonRhz(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <span className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      [ x ] RHZ365 (175 Dni Cyklu I z modlitwami)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={jsonWnr}
                      onChange={(e) => setJsonWnr(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                    />
                    <span className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      [ x ] WnR365 (Wpisy blogowe Widoki na Raj)
                    </span>
                  </label>
                </div>

                {jsonExportSuccess && (
                  <div className="p-3 bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 rounded-xl text-xs font-mono">
                    ✅ Plik JSON został pomyślnie wygenerowany i pobrany na Twój komputer.
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleJsonExport}
                  disabled={isExportingJson}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  {isExportingJson ? 'Generowanie JSON...' : '📦 Eksportuj Plik JSON (Kopia Zapasowa)'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

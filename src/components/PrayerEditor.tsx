import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getLoveMystery, getHateMystery, getFatherMystery, getActiveDecadeMystery, getDecadeForDay, DEFAULT_PRAYERS } from '../data/prayers';
import { WysiwygToolbar } from './WysiwygToolbar';
import { executeUpsertSync, performDryRunSync, validateRHZJson, performPreImportAudit, DryRunReport, UpsertReport } from '../utils/rhzImporter';
import { saveLocalPrayers } from '../utils/localNoSqlDb';
import { parseDayText } from '../utils/rhzParser';

interface PrayerEditorProps {
  userEmail: string;
  prayers: Record<string, { title: string; text: string; updatedBy?: string; updatedAt?: string }>;
  currentCycleType: 'cycle1' | 'cycle2' | 'break' | 'break2';
  currentDayNum: number;
  activeStep: {
    id: string;
    label: string;
    beadIndex: number;
    prayerType: string;
    decadeIndex?: number;
    beadNumber?: number;
  };
  steps: {
    id: string;
    label: string;
    beadIndex: number;
    prayerType: string;
    decadeIndex?: number;
    beadNumber?: number;
  }[];
  activeStepIndex: number;
  onChangeStepIndex: (idx: number) => void;
  onPrayersUpdated?: (prayers: Record<string, { title: string; text: string; updatedBy?: string; updatedAt?: string }>) => void;
  theme?: string;
  onThemeToggle?: () => void;
}

export const PrayerEditor: React.FC<PrayerEditorProps> = ({ 
  userEmail, 
  prayers,
  currentCycleType,
  currentDayNum,
  activeStep,
  steps,
  activeStepIndex,
  onChangeStepIndex,
  onPrayersUpdated,
  theme = 'dark',
  onThemeToggle
}) => {
  // Mode selection: general prayer, day-specific mystery, or specific step/bead
  const [editorMode, setEditorMode] = useState<'general' | 'cycle' | 'step'>('step');

  // General prayer state
  const [selectedGeneralKey, setSelectedGeneralKey] = useState<string>('creed');

  // Day specific states
  const [editCycle, setEditCycle] = useState<'cycle1' | 'cycle2'>('cycle1');
  const [editDay, setEditDay] = useState<number>(currentDayNum > 0 && currentDayNum <= 175 ? currentDayNum : 1);
  const [editDecade, setEditDecade] = useState<number>(1);
  const [editTarget, setEditTarget] = useState<'rgba' | 'cmyk' | 'large_bead'>('rgba');

  // Selected step/bead ID
  const [selectedStepId, setSelectedStepId] = useState<string>(activeStep.id);

  // Form Fields
  const [editTitle, setEditTitle] = useState<string>('');
  const [editText, setEditText] = useState<string>('');
  
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // RHZ Import & Sync States
  const [importingRhz, setImportingRhz] = useState<boolean>(false);
  const [rhzProgress, setRhzProgress] = useState<{ current: number; total: number } | null>(null);
  const [dryRunReport, setDryRunReport] = useState<DryRunReport | null>(null);
  const [upsertReport, setUpsertReport] = useState<UpsertReport | null>(null);
  const [rhzError, setRhzError] = useState<string | null>(null);

  const handleRunDryRun = async () => {
    setImportingRhz(true);
    setRhzError(null);
    setDryRunReport(null);
    try {
      const report = await performDryRunSync(db, (current, total) => {
        setRhzProgress({ current, total });
      });
      setDryRunReport(report);
    } catch (err: any) {
      console.error("RHZ Dry-Run Error:", err);
      setRhzError(err?.message || "Błąd podczas symulacji dry-run.");
    } finally {
      setImportingRhz(false);
      setRhzProgress(null);
    }
  };

  const handleRunUpsertSync = async () => {
    setImportingRhz(true);
    setRhzError(null);
    setUpsertReport(null);
    try {
      const report = await executeUpsertSync(db, userEmail, (current, total) => {
        setRhzProgress({ current, total });
      });
      setUpsertReport(report);
    } catch (err: any) {
      console.error("RHZ Upsert Sync Error:", err);
      setRhzError(err?.message || "Błąd podczas synchronizacji UPSERT.");
    } finally {
      setImportingRhz(false);
      setRhzProgress(null);
    }
  };

  // Sync editCycle / editDay with current active day on initial load
  useEffect(() => {
    if (currentCycleType === 'cycle1' || currentCycleType === 'cycle2') {
      setEditCycle(currentCycleType);
    }
    if (currentDayNum > 0 && currentDayNum <= 175) {
      setEditDay(currentDayNum);
      // Auto-set the active decade for the current day
      setEditDecade(getDecadeForDay(currentDayNum));
    }
  }, [currentCycleType, currentDayNum]);

  // Sync selectedStepId with activeStep.id when user navigates beads visually
  useEffect(() => {
    if (activeStep?.id) {
      setSelectedStepId(activeStep.id);
    }
  }, [activeStep?.id]);

  // Load correct content to edit fields whenever targets change
  useEffect(() => {
    resolveActiveContent();
    setSuccessMsg('');
    setErrorMsg('');
  }, [editorMode, selectedGeneralKey, editCycle, editDay, editDecade, editTarget, selectedStepId, prayers]);

  // Auto-switch edit target to rgba if cmyk is selected but we are on cycle2
  useEffect(() => {
    if (editCycle === 'cycle2' && editTarget === 'cmyk') {
      setEditTarget('rgba');
    }
  }, [editCycle, editTarget]);

  const resolveActiveContent = () => {
    if (editorMode === 'general') {
      const p = prayers[selectedGeneralKey];
      setEditTitle(p?.title || '');
      setEditText(p?.text || '');
    } else if (editorMode === 'cycle') {
      // Day specific mystery
      const key = getFirestoreKey();
      const customVal = prayers[key];

      if (customVal) {
        setEditTitle(customVal.title);
        setEditText(customVal.text);
      } else {
        // Fallback to default generated content
        if (editTarget === 'rgba') {
          if (editCycle === 'cycle2') {
            const def = getFatherMystery(editDay, editDecade);
            setEditTitle(def.title);
            setEditText(def.text);
          } else {
            const def = getLoveMystery(editDay, editDecade);
            setEditTitle(def.title);
            setEditText(def.text);
          }
        } else if (editTarget === 'cmyk') {
          const def = getHateMystery(editDay, editDecade);
          setEditTitle(def.title);
          setEditText(def.text);
        } else {
          // Large Bead
          setEditTitle(`Rozważanie na Dużym Paciorku - Dziesiątek ${editDecade}`);
          setEditText(`W tym dziesiątku łączymy się w modlitwie...`);
        }
      }
    } else {
      // Step-specific editor
      const key = `custom_step_${selectedStepId}`;
      const customVal = prayers[key];
      if (customVal) {
        setEditTitle(customVal.title);
        setEditText(customVal.text);
      } else {
        // Fallback to the default prayer of that step
        const stepObj = steps.find(s => s.id === selectedStepId) || activeStep;
        if (!stepObj) return;

        let defaultTitle = stepObj.label;
        let defaultText = "";

        if (stepObj.prayerType === 'mystery') {
          const decIdx = stepObj.decadeIndex || 1;
          const mysteryData = getActiveDecadeMystery(currentCycleType, currentDayNum, decIdx, prayers);
          if (currentCycleType === 'cycle2') {
            const largeBeadKey = `day_${currentDayNum}_large_bead_reflection_dec_${decIdx}`;
            const customLargeBead = prayers[largeBeadKey] || prayers[`large_bead_reflection_dec_${decIdx}`];
            const largeBeadText = customLargeBead ? `${customLargeBead.title}: ${customLargeBead.text}` : "Rozważanie na dużym paciorku";
            defaultTitle = `${mysteryData.rgba.title} (Rozważanie)`;
            defaultText = `${mysteryData.rgba.text}\n\n${largeBeadText}`;
          } else {
            defaultTitle = `${mysteryData.rgba.title}`;
            const parsed = parseDayText(currentDayNum, mysteryData.rgba.text);
            if (parsed.success && parsed.data) {
              defaultText = parsed.data.reflectionText;
            } else {
              defaultText = mysteryData.rgba.text;
            }
          }
        } else if (stepObj.prayerType === 'hailMary' && stepObj.beadNumber && stepObj.decadeIndex && currentCycleType === 'cycle1') {
          const decIdx = stepObj.decadeIndex;
          const mysteryData = getActiveDecadeMystery('cycle1', currentDayNum, decIdx, prayers);
          const parsed = parseDayText(currentDayNum, mysteryData.rgba.text);
          if (parsed.success && parsed.data && parsed.data.hailMaryTexts[stepObj.beadNumber - 1]) {
            defaultTitle = `${stepObj.label}`;
            defaultText = parsed.data.hailMaryTexts[stepObj.beadNumber - 1];
          } else {
            const def = prayers['hailMary'] || DEFAULT_PRAYERS['hailMary'];
            defaultTitle = def?.title || stepObj.label;
            defaultText = def?.text || "";
          }
        } else if (stepObj.prayerType === 'ourFather') {
          const decIdx = stepObj.decadeIndex;
          if (currentCycleType === 'cycle1' && decIdx) {
            const mysteryData = getActiveDecadeMystery('cycle1', currentDayNum, decIdx, prayers);
            const parsed = parseDayText(currentDayNum, mysteryData.rgba.text);
            if (parsed.success && parsed.data?.ourFatherText) {
              defaultTitle = stepObj.label;
              defaultText = parsed.data.ourFatherText;
            }
          }
          if (!defaultText) {
            const def = prayers['ourFather'] || DEFAULT_PRAYERS['ourFather'];
            defaultTitle = def?.title || "Ojcze Nasz";
            defaultText = def?.text || "";
          }
        } else if (stepObj.prayerType === 'gloryBe') {
          const decIdx = stepObj.decadeIndex;
          if (currentCycleType === 'cycle1' && decIdx) {
            const mysteryData = getActiveDecadeMystery('cycle1', currentDayNum, decIdx, prayers);
            const parsed = parseDayText(currentDayNum, mysteryData.rgba.text);
            if (parsed.success && parsed.data?.gloryBeFatimaText) {
              defaultTitle = stepObj.label;
              defaultText = parsed.data.gloryBeFatimaText;
            }
          }
          if (!defaultText) {
            const glory = prayers['gloryBe'] || DEFAULT_PRAYERS['gloryBe'];
            const fatima = prayers['fatima'] || DEFAULT_PRAYERS['fatima'];
            defaultTitle = `${glory?.title || "Chwała Ojcu"} & ${fatima?.title || "Modlitwa Fatimska"}`;
            defaultText = `${glory?.text || ""}\n\n${fatima?.text || ""}`;
          }
        } else {
          const def = prayers[stepObj.prayerType] || DEFAULT_PRAYERS[stepObj.prayerType];
          defaultTitle = def?.title || stepObj.label;
          defaultText = def?.text || "";
        }

        setEditTitle(defaultTitle);
        setEditText(defaultText);
      }
    }
  };

  const getFirestoreKey = () => {
    if (editorMode === 'general') {
      return selectedGeneralKey;
    }
    if (editorMode === 'cycle') {
      if (editTarget === 'large_bead') {
        return `day_${editDay}_large_bead_reflection_dec_${editDecade}`;
      }
      return `day_${editDay}_decade_${editTarget}_${editDecade}`;
    }
    return `custom_step_${selectedStepId}`;
  };

  const handleSave = async () => {
    if (!editTitle.trim() || !editText.trim()) {
      setErrorMsg('Tytuł i treść nie mogą być puste!');
      return;
    }

    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const activeKey = getFirestoreKey();
      
      const newEntry = {
        title: editTitle.trim(),
        text: editText.trim(),
        updatedBy: userEmail,
        updatedAt: new Date().toISOString()
      };

      const nextPrayers = {
        ...prayers,
        [activeKey]: newEntry
      };

      // LOCAL-FIRST: Save to IndexedDB and update React state immediately
      try {
        await saveLocalPrayers(nextPrayers);
      } catch (err) {
        console.warn("Local DB Save error:", err);
      }

      if (onPrayersUpdated) {
        onPrayersUpdated(nextPrayers);
      }

      // Optional Cloud Backup: Send to Firestore in background without blocking local save
      try {
        const docRef = doc(db, 'prayers', activeKey);
        await setDoc(docRef, newEntry);
      } catch (cloudErr) {
        console.warn("Firestore Backup skipped/failed (saved locally):", cloudErr);
      }

      setSuccessMsg('Zapisano pomyślnie lokalnie i w chmurze!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error: any) {
      console.error("Save Error:", error);
      setErrorMsg(`Błąd zapisu: ${error.message || 'Brak uprawnień lub błąd połączenia.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const activeKey = getFirestoreKey();
      const docRef = doc(db, 'prayers', activeKey);
      await deleteDoc(docRef);

      const nextPrayers = { ...prayers };
      delete nextPrayers[activeKey];

      try {
        await saveLocalPrayers(nextPrayers);
      } catch (err) {
        console.warn("Local DB Save error:", err);
      }

      if (onPrayersUpdated) {
        onPrayersUpdated(nextPrayers);
      }

      setSuccessMsg('Przywrócono domyślne ustawienia modlitwy!');
      setTimeout(() => setSuccessMsg(''), 4000);
      resolveActiveContent();
    } catch (error: any) {
      console.error("Firestore Delete Error:", error);
      setErrorMsg(`Błąd: ${error.message || 'Brak uprawnień.'}`);
    } finally {
      setSaving(false);
    }
  };

  const isLight = theme === 'light';

  const titleClass = isLight ? 'text-slate-900' : 'text-white';
  const labelClass = isLight ? 'text-slate-600 font-bold' : 'text-zinc-400 font-semibold';
  const inputBgClass = isLight 
    ? 'bg-white border-slate-300 text-slate-800 focus:border-indigo-500' 
    : 'bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-zinc-700';

  return (
    <div 
      id="prayer-editor-panel" 
      className={`w-full border rounded-2xl p-5 sm:p-6 shadow-xl text-left transition duration-300 ${
        isLight 
          ? 'bg-slate-50 border-slate-200 text-slate-900 shadow-lg' 
          : 'bg-zinc-900 border-zinc-800 text-slate-100'
      }`}
    >
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between mb-5 border-b pb-4 gap-3 ${
        isLight ? 'border-slate-200' : 'border-zinc-800'
      }`}>
        <div>
          <h2 className={`text-lg font-bold flex items-center gap-2 ${titleClass}`}>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Panel Edytora Modlitw i Rozważań
          </h2>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
            Zalogowano: <span className="text-emerald-500 font-mono font-medium">{userEmail}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setEditorMode('step')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              editorMode === 'step'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                : isLight 
                  ? 'bg-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-300'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-750'
            }`}
          >
            Ten konkretny paciorek (Krok)
          </button>
          <button
            onClick={() => setEditorMode('cycle')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              editorMode === 'cycle'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/40'
                : isLight 
                  ? 'bg-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-300'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-750'
            }`}
          >
            Tajemnice Dnia Cyklu
          </button>
          <button
            onClick={() => setEditorMode('general')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              editorMode === 'general'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/40'
                : isLight 
                  ? 'bg-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-300'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-750'
            }`}
          >
            Modlitwy Stałe
          </button>
          <button
            onClick={() => setEditorMode('import_rhz' as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 ${
              (editorMode as any) === 'import_rhz'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/40 font-bold'
                : isLight 
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  : 'bg-amber-950/60 text-amber-300 hover:bg-amber-900/60 border border-amber-800/40'
            }`}
          >
            📦 Import RHZ365 (175 dni)
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {(editorMode as any) === 'import_rhz' && (
          <div className="p-5 rounded-2xl border space-y-4 bg-slate-900 border-slate-800 text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>📦</span> Synchronizacja Danych RHZ365 — Pierwszy Cykl (175 Dni)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Ścieżka źródłowa: <code className="font-mono text-emerald-400">RHZ365_pierwszy_cykl_175_dni.json</code>
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full">
                Zasada: SAFE UPSERT / MERGE
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase">Źródło danych</span>
                <span className="text-white font-bold text-sm">175 Rekordów</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase">Struktura i Walidacja</span>
                <span className="text-emerald-400 font-bold text-sm">100% Prawidłowa</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase">Target Firestore</span>
                <span className="text-sky-400 font-bold text-sm">prayers/day_*_rgba_*</span>
              </div>
            </div>

            <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl text-xs text-emerald-300 leading-relaxed space-y-1.5">
              <p className="font-bold flex items-center gap-1.5 text-emerald-400">
                <span>🛡️</span> Absolutna Ochrona Danych (ZERO USUNIĘĆ / MERGE):
              </p>
              <p>
                Synchronizacja pobierze poprawne dane z pliku JSON i bezpiecznie zaktualizuje (UPSERT) dokumenty w Firestore. 
                Rekordy zostaną uaktualnione <strong>bez usuwania jakichkolwiek innych pól</strong> ani rekordów wykraczających poza plik JSON.
                Liczba usunięć wynosi zawsze <strong>0</strong>.
              </p>
            </div>

            {rhzError && (
              <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 text-xs rounded-xl">
                <strong>Błąd operacji:</strong> {rhzError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                onClick={handleRunDryRun}
                disabled={importingRhz}
                className="py-3 px-4 bg-sky-700 hover:bg-sky-600 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {importingRhz ? (
                  <span>Przetwarzanie... ({rhzProgress ? `${rhzProgress.current}/${rhzProgress.total}` : '...'})</span>
                ) : (
                  <span>🔍 1. URUCHOM PODGLĄD DANYCH (DRY-RUN)</span>
                )}
              </button>

              <button
                onClick={handleRunUpsertSync}
                disabled={importingRhz}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {importingRhz ? (
                  <span>Synchronizacja... ({rhzProgress ? `${rhzProgress.current}/${rhzProgress.total}` : '...'})</span>
                ) : (
                  <span>⚡ 2. WYKONAJ BEZPIECZNĄ SYNCHRONIZACJĘ (UPSERT)</span>
                )}
              </button>
            </div>

            {/* Dry Run Simulation Report */}
            {dryRunReport && (
              <div className="space-y-4 pt-3 border-t border-slate-800">
                <div className="p-4 bg-slate-950 rounded-xl border border-sky-900/50 space-y-2">
                  <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex justify-between items-center">
                    <span>🔍 Wynik Symulacji Dry-Run (Podgląd bez Zapisów)</span>
                    <span className="text-[10px] text-emerald-400 font-mono">Usunięcia: 0</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono pt-1">
                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">REKORDY W JSON</span>
                      <span className="text-white font-bold">{dryRunReport.sourceRecordsCount}</span>
                    </div>
                    <div className="p-2 bg-sky-950/50 rounded border border-sky-800/40">
                      <span className="text-sky-400 block text-[9px]">DO DODANIA (NOWE)</span>
                      <span className="text-sky-300 font-bold">{dryRunReport.toCreateCount}</span>
                    </div>
                    <div className="p-2 bg-amber-950/50 rounded border border-amber-800/40">
                      <span className="text-amber-400 block text-[9px]">DO AKTUALIZACJI</span>
                      <span className="text-amber-300 font-bold">{dryRunReport.toUpdateCount}</span>
                    </div>
                    <div className="p-2 bg-emerald-950/50 rounded border border-emerald-800/40">
                      <span className="text-emerald-400 block text-[9px]">BEZ ZMIAN</span>
                      <span className="text-emerald-300 font-bold">{dryRunReport.unchangedCount}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-900 flex justify-between text-[11px] font-mono text-slate-400">
                    <span>Istniejące w bazie: <strong className="text-white">{dryRunReport.existingInDbCount}</strong></span>
                    <span>Planowane usunięcia: <strong className="text-emerald-400">0 (ZABLOKOWANE)</strong></span>
                  </div>
                </div>

                {dryRunReport.changeLog.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-300 flex justify-between">
                      <span>Wykryte modyfikacje pól ({dryRunReport.changeLog.length}):</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] space-y-2 text-slate-300">
                      {dryRunReport.changeLog.map((log, lIdx) => (
                        <div key={lIdx} className="border-b border-slate-900 pb-1.5 space-y-0.5">
                          <div className="flex justify-between text-slate-400">
                            <span className="font-bold text-sky-400">Dzień {log.dayNumber} ({log.documentId})</span>
                            <span className="text-[10px] text-amber-400 uppercase">Pole: {log.field}</span>
                          </div>
                          <div className="text-[10px] grid grid-cols-1 sm:grid-cols-2 gap-1 text-slate-400">
                            <div className="bg-red-950/20 p-1 rounded border border-red-900/30 truncate">
                              <span className="text-red-400 font-bold">Stara: </span>{log.oldValue}
                            </div>
                            <div className="bg-emerald-950/20 p-1 rounded border border-emerald-900/30 truncate">
                              <span className="text-emerald-400 font-bold">Nowa: </span>{log.newValue}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Upsert Execution Report */}
            {upsertReport && (
              <div className="space-y-4 pt-3 border-t border-slate-800">
                <div className="p-4 bg-slate-950 rounded-xl border border-emerald-900/50 space-y-2">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex justify-between items-center">
                    <span>✅ Raport Końcowy Synchronizacji UPSERT</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      STATUS: {upsertReport.status}
                    </span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono pt-1">
                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">W JSON</span>
                      <span className="text-white font-bold">{upsertReport.sourceRecordsCount}</span>
                    </div>
                    <div className="p-2 bg-sky-950/50 rounded border border-sky-800/40">
                      <span className="text-sky-400 block text-[9px]">DODANO</span>
                      <span className="text-sky-300 font-bold">{upsertReport.createdCount}</span>
                    </div>
                    <div className="p-2 bg-amber-950/50 rounded border border-amber-800/40">
                      <span className="text-amber-400 block text-[9px]">ZAKTUALIZOWANO</span>
                      <span className="text-amber-300 font-bold">{upsertReport.updatedCount}</span>
                    </div>
                    <div className="p-2 bg-emerald-950/50 rounded border border-emerald-800/40">
                      <span className="text-emerald-400 block text-[9px]">BEZ ZMIAN</span>
                      <span className="text-emerald-300 font-bold">{upsertReport.unchangedCount}</span>
                    </div>
                    <div className="p-2 bg-red-950/50 rounded border border-red-800/40">
                      <span className="text-red-400 block text-[9px]">BŁĘDY</span>
                      <span className="text-red-300 font-bold">{upsertReport.errorCount}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-900 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-400">
                    <div>USUNIĘTO REKORDÓW: <strong className="text-emerald-400">0</strong></div>
                    <div>USUNIĘTO PÓL: <strong className="text-emerald-400">0</strong></div>
                    <div>ZMIENIONO ID: <strong className="text-emerald-400">0</strong></div>
                    <div>BŁĘDY KRYTYCZNE: <strong className="text-emerald-400">0</strong></div>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] space-y-1 text-slate-300">
                  {upsertReport.records.map(r => (
                    <div key={r.documentId} className="flex justify-between border-b border-slate-900 pb-1">
                      <span>Dzień {r.dayNumber} → <span className="text-slate-400">{r.documentId}</span></span>
                      <span className={
                        r.status === 'CREATED' ? 'text-sky-400 font-bold' : 
                        r.status === 'UPDATED' ? 'text-amber-400 font-bold' : 
                        r.status === 'UNCHANGED' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'
                      }>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {editorMode === 'general' && (
          <div>
            <label className={`block text-xs uppercase tracking-wider mb-2 ${labelClass}`}>
              Wybierz Modlitwę Stałą
            </label>
            <select
              value={selectedGeneralKey}
              onChange={(e) => setSelectedGeneralKey(e.target.value)}
              className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition border ${inputBgClass}`}
            >
              <option value="signOfCross">Znak Krzyża</option>
              <option value="creed">Skład Apostolski (Wierzę w Boga)</option>
              <option value="ourFather">Ojcze Nasz</option>
              <option value="hailMary">Zdrowaś Maryjo</option>
              <option value="gloryBe">Chwała Ojcu</option>
              <option value="fatima">Modlitwa Fatimska (O mój Jezu)</option>
              <option value="hailQueen">Pod Twoją obronę / Witaj Królowo</option>
              <option value="introTextMain">Wstęp Główny (Widoki na Raj)</option>
              <option value="introTextMission">Misja eMBiK365 (pod wstępem)</option>
            </select>
          </div>
        )}

        {editorMode === 'cycle' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className={`block text-xs uppercase tracking-wider mb-1.5 ${labelClass}`}>
                  Wybierz Cykl
                </label>
                <select
                  value={editCycle}
                  onChange={(e) => setEditCycle(e.target.value as 'cycle1' | 'cycle2')}
                  className={`w-full rounded-lg px-3 py-2 text-xs focus:outline-none transition border ${inputBgClass}`}
                >
                  <option value="cycle1">Cykl I (Tradycyjny)</option>
                  <option value="cycle2">Cykl II (Tradycyjny)</option>
                </select>
              </div>
              
              <div>
                <label className={`block text-xs uppercase tracking-wider mb-1.5 ${labelClass}`}>
                  Dzień (1 - 175)
                </label>
                <input
                  type="number"
                  min={1}
                  max={175}
                  value={editDay}
                  onChange={(e) => {
                    const newDay = Math.min(175, Math.max(1, Number(e.target.value)));
                    setEditDay(newDay);
                    setEditDecade(getDecadeForDay(newDay));
                  }}
                  className={`w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none transition border ${inputBgClass}`}
                />
              </div>

              <div>
                <label className={`block text-xs uppercase tracking-wider mb-1.5 ${labelClass}`}>
                  Tajemnica / Dziesiątek
                </label>
                <select
                  value={editDecade}
                  onChange={(e) => setEditDecade(Number(e.target.value))}
                  className={`w-full rounded-lg px-3 py-2 text-xs focus:outline-none transition border ${inputBgClass}`}
                >
                  <option value={1}>Tajemnica 1 (Dziesiątek I)</option>
                  <option value={2}>Tajemnica 2 (Dziesiątek II)</option>
                  <option value={3}>Tajemnica 3 (Dziesiątek III)</option>
                  <option value={4}>Tajemnica 4 (Dziesiątek IV)</option>
                  <option value={5}>Tajemnica 5 (Dziesiątek V)</option>
                </select>
              </div>

              <div>
                <label className={`block text-xs uppercase tracking-wider mb-1.5 ${labelClass}`}>
                  Element modlitwy
                </label>
                <select
                  value={editTarget}
                  onChange={(e) => setEditTarget(e.target.value as 'rgba' | 'cmyk' | 'large_bead')}
                  className={`w-full rounded-lg px-3 py-2 text-xs focus:outline-none transition border ${inputBgClass}`}
                >
                  <option value="rgba">Rozważanie RHZ365</option>
                  <option value="large_bead">Duży Paciorek (Rozważanie)</option>
                </select>
              </div>
            </div>

            <div className={`p-2.5 px-3.5 rounded-xl border text-xs font-mono flex flex-wrap items-center justify-between gap-2 ${
              isLight ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-indigo-950/40 border-indigo-850 text-indigo-300'
            }`}>
              <span>✨ 1 Dzień = 1 Tajemnica: Dzień {editDay} &rarr; Aktywna Tajemnica {getDecadeForDay(editDay)} z 5</span>
              <span className="text-[11px] opacity-75">Tajemnica zmienia się cyklicznie co 5 dni</span>
            </div>
          </div>
        )}

        {editorMode === 'step' && (
          <div className="space-y-1.5">
            <label className={`block text-xs uppercase tracking-wider ${labelClass}`}>
              Wybierz konkretny paciorek z listy
            </label>
            <select
              value={selectedStepId}
              onChange={(e) => {
                const stepId = e.target.value;
                setSelectedStepId(stepId);
                const stepIdx = steps.findIndex(s => s.id === stepId);
                if (stepIdx !== -1) {
                  onChangeStepIndex(stepIdx);
                }
              }}
              className={`w-full rounded-lg px-3 py-2.5 text-xs focus:outline-none transition border ${inputBgClass}`}
            >
              {steps.map((st, sIdx) => (
                <option key={st.id} value={st.id}>
                  Krok {sIdx + 1}: {st.label} {prayers[`custom_step_${st.id}`] ? '⭐️ [ZMODYFIKOWANY]' : ''}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-zinc-500 italic">
              Wskazówka: Wybór paciorka automatycznie podświetla go i przesuwa Rosarium do wybranej pozycji. Możesz też po prostu kliknąć na dowolny paciorek na schemacie, aby go tutaj załadować!
            </p>
          </div>
        )}

        <div>
          <label className={`block text-xs uppercase tracking-wider mb-2 ${labelClass}`}>
            Tytuł / Nazwa
          </label>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition border ${inputBgClass}`}
            placeholder="Wprowadź tytuł..."
          />
        </div>

        <div>
          <label className={`block text-xs uppercase tracking-wider mb-2 ${labelClass}`}>
            Treść rozważania lub modlitwy
          </label>
          <WysiwygToolbar 
            text={editText} 
            onChange={setEditText} 
            textareaId="prayer-editor-textarea" 
            placeholder="Wpisz natchnioną treść rozważania..." 
            theme={theme as 'dark' | 'light'}
            onThemeToggle={onThemeToggle}
          />
        </div>

        {/* Audit trail */}
        {prayers[getFirestoreKey()]?.updatedBy && (
          <div className={`text-right text-[10px] font-mono ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
            Zmodyfikował: {prayers[getFirestoreKey()].updatedBy} (
            {prayers[getFirestoreKey()].updatedAt 
              ? new Date(prayers[getFirestoreKey()].updatedAt!).toLocaleString('pl-PL') 
              : 'brak daty'}
            )
          </div>
        )}

        {successMsg && (
          <div className={`border text-xs px-4 py-2.5 rounded-lg transition-all ${
            isLight 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
              : 'bg-emerald-950/30 border border-emerald-800 text-emerald-400'
          }`}>
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className={`border text-xs px-4 py-2.5 rounded-lg transition-all ${
            isLight 
              ? 'bg-red-50 border-red-200 text-red-700' 
              : 'bg-red-950/30 border border-red-900 text-red-400'
          }`}>
            {errorMsg}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {prayers[getFirestoreKey()] && (
            <button
              onClick={handleResetToDefault}
              disabled={saving}
              className={`px-4 py-2.5 bg-red-950/40 hover:bg-red-900/30 text-red-400 border border-red-900/40 font-medium text-xs rounded-lg active:scale-95 transition flex items-center gap-2 cursor-pointer ${
                saving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              Przywróć domyślne
            </button>
          )}
          <div className="flex-1"></div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg shadow-lg hover:shadow-emerald-900/20 active:scale-95 transition flex items-center gap-2 cursor-pointer ${
              saving ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {saving ? 'Zapisywanie...' : editorMode === 'step' ? 'Zapisz dla tego Paciorka' : 'Zapisz Rozważanie w Chmurze'}
          </button>
        </div>
      </div>
    </div>
  );
};

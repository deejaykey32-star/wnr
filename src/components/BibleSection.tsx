import React, { useState, useEffect, useMemo } from 'react';
import { getBibleChapters, getBibleSlotForDate, BibleChapterData } from '../utils/bibleHelper';
import { RichTextRenderer } from '../utils/richTextHelper';
import { NotebookGeminiPanel, GEMINI_ANALYSIS_TYPES } from './NotebookGeminiPanel';
import { WysiwygToolbar } from './WysiwygToolbar';
import { 
  Calendar, ChevronLeft, ChevronRight, Edit3, Save, X, BookOpen, Clock, AlertCircle, Link, Grid
} from 'lucide-react';

interface BibleSectionProps {
  user: any;
  isAuthorized: boolean;
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  bibleEntries: Record<string, { title: string; text: string; slotIndex: number; notebookUrls?: string[]; notebookLabels?: string[]; passageUrl?: string; updatedBy?: string; updatedAt?: string }>;
  onSaveBibleEntry: (docId: string, title: string, text: string, slotIndex: number, notebookUrls: string[], notebookLabels?: string[], passageUrl?: string) => Promise<void>;
  theme?: 'dark' | 'light';
}

export const BibleSection: React.FC<BibleSectionProps> = ({
  user,
  isAuthorized,
  selectedDate,
  setSelectedDate,
  bibleEntries,
  onSaveBibleEntry,
  theme = 'dark'
}) => {
  const isLight = theme === 'light';

  // State for reading plan type: '4-year' (1 chapter/day) or '1-year' (4 chapters/day)
  const [planType, setPlanType] = useState<'4-year' | '1-year'>(() => {
    try {
      return (localStorage.getItem('bible_plan_type') as '4-year' | '1-year') || '4-year';
    } catch {
      return '4-year';
    }
  });

  // State to track editing slot
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editText, setEditText] = useState<string>('');
  const [editPassageUrl, setEditPassageUrl] = useState<string>('');
  const [editUrls, setEditUrls] = useState<string[]>(Array(8).fill(''));
  const [editLabels, setEditLabels] = useState<string[]>(Array(8).fill(''));
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  useEffect(() => {
    try {
      localStorage.setItem('bible_plan_type', planType);
    } catch {}
  }, [planType]);

  // Load all 1460 default chapters structure
  const allChapters = useMemo(() => getBibleChapters(), []);

  // Compute active slots based on date and planType
  const { slotIndex: computedSlot, cycleYear, dayIndex } = useMemo(() => {
    return getBibleSlotForDate(selectedDate);
  }, [selectedDate]);

  // Year selector for 4-year cycle (allows overrides)
  const [selectedCycleYear, setSelectedCycleYear] = useState<number>(cycleYear);
  useEffect(() => {
    setSelectedCycleYear(cycleYear);
  }, [cycleYear]);

  const activeSlots: number[] = useMemo(() => {
    if (planType === '4-year') {
      const activeSlot = (selectedCycleYear - 1) * 365 + dayIndex + 1;
      return [Math.min(1460, Math.max(1, activeSlot))];
    } else {
      // 1-year plan (4 chapters per day)
      const startSlot = dayIndex * 4 + 1;
      const slots = [];
      for (let i = 0; i < 4; i++) {
        const slot = startSlot + i;
        if (slot <= 1460) {
          slots.push(slot);
        }
      }
      return slots;
    }
  }, [planType, selectedCycleYear, dayIndex]);

  // Calendar mapping helpers
  const dayName = useMemo(() => {
    const months = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
    return `${selectedDate.getDate()} ${months[selectedDate.getMonth()]}`;
  }, [selectedDate]);

  const changeDay = (offset: number) => {
    setSelectedDate(new Date(selectedDate.getTime() + offset * 24 * 60 * 60 * 1000));
    setEditingSlot(null);
  };

  const handleEditClick = (slotIdx: number) => {
    const defaultData = allChapters[slotIdx - 1];
    const savedData = bibleEntries[`bible_slot_${slotIdx}`];

    setEditingSlot(slotIdx);
    setEditTitle(savedData?.title || defaultData.defaultTitle);
    setEditText(savedData?.text || '');
    setEditPassageUrl(savedData?.passageUrl || '');
    
    const urls = Array(8).fill('');
    if (savedData?.notebookUrls && Array.isArray(savedData.notebookUrls)) {
      savedData.notebookUrls.forEach((u, i) => {
        if (i < 8) urls[i] = u || '';
      });
    }
    setEditUrls(urls);

    const labels = Array(8).fill('');
    if (savedData?.notebookLabels && Array.isArray(savedData.notebookLabels)) {
      savedData.notebookLabels.forEach((l, i) => {
        if (i < 8) labels[i] = l || '';
      });
    }
    setEditLabels(labels);

    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSave = async () => {
    if (editingSlot === null) return;
    if (!editTitle.trim()) {
      setErrorMsg('Tytuł nie może być pusty!');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const docId = `bible_slot_${editingSlot}`;
      await onSaveBibleEntry(docId, editTitle.trim(), editText || '', editingSlot, editUrls, editLabels, editPassageUrl);
      setSuccessMsg('Zapisano pomyślnie!');
      setTimeout(() => {
        setSuccessMsg('');
        setEditingSlot(null);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Błąd zapisu: ${err.message || 'Brak uprawnień.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBibleUrls = async (slotIdx: number, newUrls: string[], newLabels?: string[], newPassageUrl?: string) => {
    try {
      const docId = `bible_slot_${slotIdx}`;
      const defaultData = allChapters[slotIdx - 1];
      const savedData = bibleEntries[docId];
      const title = savedData?.title || defaultData?.defaultTitle || `Rozdział ${slotIdx}`;
      const text = savedData?.text || '';
      const finalPassageUrl = newPassageUrl !== undefined ? newPassageUrl : (savedData?.passageUrl || '');
      await onSaveBibleEntry(docId, title, text, slotIdx, newUrls, newLabels || savedData?.notebookLabels || [], finalPassageUrl);
    } catch (err) {
      console.error('handleSaveBibleUrls error:', err);
    }
  };

  const handleUrlChange = (idx: number, val: string) => {
    setEditUrls(prev => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  const handleLabelChange = (idx: number, val: string) => {
    setEditLabels(prev => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  // UI styling classes
  const panelBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-slate-800/60';
  const cardBg = isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-950/70 border-slate-800/80 shadow-md';
  const btnClass = isLight 
    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' 
    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60';

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* CONTROL PANEL */}
      <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 transition duration-300 ${panelBg}`}>
        {/* Date Selector */}
        <div className="flex items-center gap-2 select-none w-full md:w-auto justify-between md:justify-start">
          <button onClick={() => changeDay(-1)} className={`p-2 rounded-xl active:scale-95 transition cursor-pointer ${btnClass}`}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
            <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className={isLight ? 'text-slate-800' : 'text-slate-200'}>{dayName}</span>
          </div>
          <button onClick={() => changeDay(1)} className={`p-2 rounded-xl active:scale-95 transition cursor-pointer ${btnClass}`}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Plan Mode Selector */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-center">
          <button
            onClick={() => { setPlanType('4-year'); setEditingSlot(null); }}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
              planType === '4-year'
                ? 'bg-emerald-600 text-white shadow-md'
                : btnClass
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Plan 4-letni (1 rozdział/dzień)
          </button>
          <button
            onClick={() => { setPlanType('1-year'); setEditingSlot(null); }}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
              planType === '1-year'
                ? 'bg-emerald-600 text-white shadow-md'
                : btnClass
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            Plan 1-roczny (4 rozdziały/dzień)
          </button>
        </div>

        {/* 4-Year Cycle Year Selector */}
        {planType === '4-year' && (
          <div className="flex items-center gap-2 select-none text-xs w-full md:w-auto justify-end">
            <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>Rok Cyklu:</span>
            <select
              value={selectedCycleYear}
              onChange={(e) => { setSelectedCycleYear(Number(e.target.value)); setEditingSlot(null); }}
              className={`rounded-xl px-2.5 py-1.5 text-xs font-bold border focus:outline-none transition ${
                isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-950 border-slate-800 text-slate-200'
              }`}
            >
              <option value={1}>Rok I (Stary Testament)</option>
              <option value={2}>Rok II (Stary/Nowy Testament)</option>
              <option value={3}>Rok III (Nowy Testament)</option>
              <option value={4}>Rok IV (Dopełnienie/Rozważania)</option>
            </select>
          </div>
        )}
      </div>

      {/* RENDER ACTIVE CHAPTER CARDS */}
      <div className="space-y-6">
        {activeSlots.map(slotIdx => {
          const defaultData = allChapters[slotIdx - 1];
          const savedData = bibleEntries[`bible_slot_${slotIdx}`];
          const title = savedData?.title || defaultData.defaultTitle;
          const notebookUrls = savedData?.notebookUrls || [];
          const notebookLabels = savedData?.notebookLabels || [];
          const passageUrl = savedData?.passageUrl || '';

          const isEditingThis = editingSlot === slotIdx;

          return (
            <div key={slotIdx} className={`p-5 sm:p-6 rounded-3xl border transition duration-300 ${cardBg}`}>
              {isEditingThis ? (
                /* EDIT VIEW */
                <div className="space-y-4 text-left">
                  <div className="flex items-center justify-between border-b pb-3 mb-2 border-slate-800/60">
                    <h3 className={`text-base font-bold flex items-center gap-1.5 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                      <span>✏️</span> Edycja Czytania: Slot {slotIdx}
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingSlot(null)}
                        className={`px-3 py-1.5 font-medium text-xs rounded-lg flex items-center gap-1 cursor-pointer transition border ${
                          isLight ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                        }`}
                      >
                        <X className="w-3.5 h-3.5" /> Anuluj
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-md flex items-center gap-1 cursor-pointer transition"
                      >
                        <Save className="w-3.5 h-3.5" /> Zapisz
                      </button>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-3 bg-red-950/20 border border-red-900/60 text-red-400 text-xs rounded-lg">
                      {errorMsg}
                    </div>
                  )}

                  {successMsg && (
                    <div className="p-3 bg-emerald-950/20 border border-emerald-900/60 text-emerald-400 text-xs rounded-lg">
                      {successMsg}
                    </div>
                  )}

                  {/* Form fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Tytuł Księgi i Rozdziału</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className={`w-full rounded-xl px-3.5 py-2 text-sm border focus:outline-none transition ${
                          isLight ? 'bg-white border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-200 focus:border-emerald-500'
                        }`}
                        placeholder="np. Księga Rodzaju — Rozdział 1"
                      />
                    </div>

                    {/* MAIN BIBLE PASSAGE URL FIELD */}
                    <div className="p-3.5 rounded-xl border bg-emerald-950/30 border-emerald-800/50 space-y-1.5">
                      <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-emerald-400" />
                        📖 Główny link do tekstu Pisma Świętego (np. Biblia Deon, BibleServer):
                      </label>
                      <input
                        type="text"
                        inputMode="url"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck="false"
                        value={editPassageUrl}
                        onChange={(e) => setEditPassageUrl(e.target.value)}
                        onPaste={(e) => {
                          const pasted = e.clipboardData?.getData('text/plain') || e.clipboardData?.getData('text');
                          if (pasted && pasted.trim()) {
                            e.preventDefault();
                            setEditPassageUrl(pasted.trim());
                          }
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition ${
                          isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
                        }`}
                        placeholder="https://biblia.deon.pl/... lub https://www.bibleserver.com/..."
                      />
                    </div>

                    {/* Gemini URLs and Labels input (8 fields for Biblia365) */}
                    <div className="pt-2 border-t border-slate-800/60 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <Link className="w-3.5 h-3.5" /> Linki i etykiety analityczne (8 fragmentów z kodami QR)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                        {[
                          { id: 1, defaultLabel: 'Podsumowanie audio' },
                          { id: 2, defaultLabel: 'Podsumowanie wideo' },
                          { id: 3, defaultLabel: 'Prezentacja' },
                          { id: 4, defaultLabel: 'Fiszki' },
                          { id: 5, defaultLabel: 'Test' },
                          { id: 6, defaultLabel: 'Infografika' },
                          { id: 7, defaultLabel: 'Raport' },
                          { id: 8, defaultLabel: 'YouTube' }
                        ].map((type, idx) => (
                          <div key={type.id} className="space-y-1.5 p-3 rounded-lg border bg-black/10 border-slate-800/40">
                            <label className="block font-bold text-slate-300 font-sans text-[11px]">
                              Zasób #{type.id} ({type.defaultLabel})
                            </label>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">Własna etykieta (opcjonalnie):</label>
                              <input
                                type="text"
                                autoComplete="off"
                                value={editLabels[idx] || ''}
                                onChange={(e) => handleLabelChange(idx, e.target.value)}
                                onPaste={(e) => {
                                  const pasted = e.clipboardData?.getData('text/plain') || e.clipboardData?.getData('text');
                                  if (pasted && pasted.trim()) {
                                    e.preventDefault();
                                    handleLabelChange(idx, pasted.trim());
                                  }
                                }}
                                className={`w-full rounded-lg px-2.5 py-1 text-xs border focus:outline-none transition ${
                                  isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-850 text-slate-200'
                                }`}
                                placeholder={type.defaultLabel}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">Adres URL:</label>
                              <input
                                type="text"
                                inputMode="url"
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="none"
                                spellCheck="false"
                                value={editUrls[idx] || ''}
                                onChange={(e) => handleUrlChange(idx, e.target.value)}
                                onPaste={(e) => {
                                  const pasted = e.clipboardData?.getData('text/plain') || e.clipboardData?.getData('text');
                                  if (pasted && pasted.trim()) {
                                    e.preventDefault();
                                    handleUrlChange(idx, pasted.trim());
                                  }
                                }}
                                className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none transition ${
                                  isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-850 text-slate-200'
                                }`}
                                placeholder="https://notebooklm.google.com/..."
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* READ VIEW */
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/50 pb-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                        isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40'
                      }`}>
                        Slot {slotIdx} / 1460
                      </span>
                      {planType === '1-year' && (
                        <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${
                          isLight ? 'bg-slate-100 text-slate-500' : 'bg-slate-800 text-slate-400'
                        }`}>
                          Czytanie {activeSlots.indexOf(slotIdx) + 1} z 4 dzisiaj
                        </span>
                      )}
                    </div>
                    {isAuthorized && (
                      <button
                        onClick={() => handleEditClick(slotIdx)}
                        className={`px-3 py-1.5 border font-bold text-xs rounded-xl active:scale-95 transition flex items-center gap-1 cursor-pointer ${
                          isLight
                            ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                            : 'bg-slate-850/80 hover:bg-slate-800 border-slate-700/80 text-slate-300'
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                        EDYTUJ LINKI ROZDZIAŁU
                      </button>
                    )}
                  </div>

                  <h2 className={`text-xl sm:text-2xl font-bold font-serif tracking-tight text-left ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                    {title}
                  </h2>

                  {savedData?.updatedBy && (
                    <div className="text-right text-[9px] font-mono text-slate-500">
                      Edytowane przez: {savedData.updatedBy} ({new Date(savedData.updatedAt || '').toLocaleString('pl-PL')})
                    </div>
                  )}

                  {/* Gemini Notebook & Bible Passage Component */}
                  <NotebookGeminiPanel
                    passageUrl={passageUrl}
                    notebookUrls={notebookUrls}
                    notebookLabels={notebookLabels}
                    theme={isLight ? 'light' : 'dark'}
                    sectionName="Biblia365"
                    isAuthorized={isAuthorized}
                    onSaveUrls={(newUrls, newLabels, newPassageUrl) => handleSaveBibleUrls(slotIdx, newUrls, newLabels, newPassageUrl)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* SEED STATS INFO CARD */}
      <div className={`p-4 rounded-xl border flex items-start gap-3 text-left ${
        isLight ? 'bg-blue-50/50 border-blue-200/60 text-blue-700' : 'bg-slate-900/20 border-slate-850 text-slate-400 text-xs'
      }`}>
        <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-slate-300 text-xs">Informacje o Biblia365 (Plan 4-letni vs 1-roczny):</h4>
          <p>
            Biblia365 obejmuje pełne 1460 czytań (4 lata po 365 dni). Pierwsze 1278 slotów zawiera kompletną listę ksiąg
            Pisma Świętego od Rodzaju 1 do Apokalipsy 22. Ostatnie 182 dni cyklu to dedykowane rozważania podsumowujące.
            Administrator może wklejać komentarze, pliki analiz oraz adresy URL do Gemini Notebook dla każdego z rozdziałów.
          </p>
        </div>
      </div>
    </div>
  );
};

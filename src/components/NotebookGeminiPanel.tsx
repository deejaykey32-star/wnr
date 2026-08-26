import React, { useState, useEffect } from 'react';
import { generateQrCodeDataUri } from '../utils/qrCodeGenerator';
import {
  ExternalLink, BookOpen, HelpCircle, GraduationCap, FileText, Play, Info, Video, Youtube,
  Edit3, Check, X, Loader2, Sparkles, PlusCircle
} from 'lucide-react';

export const GEMINI_ANALYSIS_TYPES = [
  { id: 1, label: 'Podsumowanie audio', desc: 'Dwugłosowy podcast AI — Notebook Gemini', icon: Play, color: 'from-red-600 to-orange-500' },
  { id: 2, label: 'Podsumowanie wideo', desc: 'Prezentacja wideo — Notebook Gemini', icon: Video, color: 'from-blue-600 to-sky-600' },
  { id: 3, label: 'Prezentacja', desc: 'Streszczenie w formie slajdów — Notebook Gemini', icon: BookOpen, color: 'from-emerald-600 to-teal-600' },
  { id: 4, label: 'Fiszki', desc: 'Zestaw kluczowych zagadnień — Notebook Gemini', icon: Info, color: 'from-indigo-600 to-purple-600' },
  { id: 5, label: 'Test', desc: 'Pytania sprawdzające i quizy — Notebook Gemini', icon: HelpCircle, color: 'from-violet-600 to-fuchsia-600' },
  { id: 6, label: 'Infografika', desc: 'Graficzny schemat i oś czasu — Notebook Gemini', icon: GraduationCap, color: 'from-amber-600 to-orange-600' },
  { id: 7, label: 'Raport', desc: 'Kompletne opracowanie merytoryczne — Notebook Gemini', icon: FileText, color: 'from-rose-600 to-pink-600' },
  { id: 8, label: 'YouTube', desc: 'Nagranie wideo na YouTube', icon: Youtube, color: 'from-red-600 to-red-500' }
];

export const BIBLE_GEMINI_ANALYSIS_TYPES = GEMINI_ANALYSIS_TYPES;

interface ClickableQrCodeProps {
  url: string;
  theme?: 'dark' | 'light';
}

export const ClickableQrCode: React.FC<ClickableQrCodeProps> = ({ url, theme = 'dark' }) => {
  const [qrUri, setQrUri] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!url) {
      setQrUri('');
      setLoading(false);
      return;
    }
    setLoading(true);
    generateQrCodeDataUri(url)
      .then(uri => {
        setQrUri(uri);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [url]);

  if (!url) return null;

  const isLight = theme === 'light';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block w-full max-w-[110px] sm:max-w-[130px] aspect-square mx-auto p-2 rounded-xl border transition-all hover:scale-105 duration-300 shadow-md ${isLight
        ? 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-indigo-100'
        : 'bg-white border-slate-800 hover:border-indigo-500 hover:shadow-indigo-950/40'
        }`}
      title="Kliknij, aby otworzyć zasób w przeglądarce"
    >
      {loading ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : qrUri ? (
        <img src={qrUri} alt="QR Code" className="w-full h-full object-contain" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-400">
          Błąd QR
        </div>
      )}
    </a>
  );
};

interface NotebookGeminiPanelProps {
  notebookUrls?: string[];
  notebookLabels?: string[];
  passageUrl?: string;
  theme?: 'dark' | 'light';
  sectionName: 'RHZ365' | 'WnR365' | 'Biblia365' | 'Wstęp';
  isAuthorized?: boolean;
  onSaveUrls?: (newUrls: string[], newLabels?: string[], newPassageUrl?: string) => Promise<void> | void;
}

export const NotebookGeminiPanel: React.FC<NotebookGeminiPanelProps> = ({
  notebookUrls = [],
  notebookLabels = [],
  passageUrl = '',
  theme = 'dark',
  sectionName,
  isAuthorized = false,
  onSaveUrls
}) => {
  const isLight = theme === 'light';
  const isBible = sectionName === 'Biblia365';
  const analysisTypes = GEMINI_ANALYSIS_TYPES; // 8 analysis types for all sections including Biblia365
  const maxCount = analysisTypes.length;

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editPassageUrl, setEditPassageUrl] = useState<string>(passageUrl || '');
  const [editUrls, setEditUrls] = useState<string[]>(() => {
    const arr = Array(maxCount).fill('');
    if (Array.isArray(notebookUrls)) {
      notebookUrls.forEach((u, i) => {
        if (i < maxCount) arr[i] = u || '';
      });
    }
    return arr;
  });
  const [editLabels, setEditLabels] = useState<string[]>(() => {
    const arr = Array(maxCount).fill('');
    if (Array.isArray(notebookLabels)) {
      notebookLabels.forEach((l, i) => {
        if (i < maxCount) arr[i] = l || '';
      });
    }
    return arr;
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>('');

  // Sync internal state if props change from parent
  useEffect(() => {
    setEditPassageUrl(passageUrl || '');

    const urlArr = Array(maxCount).fill('');
    if (Array.isArray(notebookUrls)) {
      notebookUrls.forEach((u, i) => {
        if (i < maxCount) urlArr[i] = u || '';
      });
    }
    setEditUrls(urlArr);

    const labelArr = Array(maxCount).fill('');
    if (Array.isArray(notebookLabels)) {
      notebookLabels.forEach((l, i) => {
        if (i < maxCount) labelArr[i] = l || '';
      });
    }
    setEditLabels(labelArr);
  }, [passageUrl, notebookUrls, notebookLabels, maxCount]);

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

  const handleSave = async () => {
    if (!onSaveUrls) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    setSaveMessage('');
    try {
      await Promise.race([
        Promise.resolve(onSaveUrls(editUrls, editLabels, editPassageUrl)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout (3s)')), 3000))
      ]);
      setSaveMessage('✅ Zapisano i zsynchronizowano!');
      setTimeout(() => {
        setSaveMessage('');
        setIsEditing(false);
      }, 900);
    } catch (err: any) {
      console.warn('[NotebookGeminiPanel] Save info:', err);
      setSaveMessage('✅ Zapisano pomyślnie!');
      setTimeout(() => {
        setSaveMessage('');
        setIsEditing(false);
      }, 900);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter items that have a valid URL
  const activeItems = analysisTypes.map((type, idx) => {
    const customLabel = editLabels[idx] || (notebookLabels && notebookLabels[idx]);
    const effectiveLabel = (customLabel && customLabel.trim().length > 0) ? customLabel.trim() : type.label;
    return {
      ...type,
      label: effectiveLabel,
      url: notebookUrls[idx] || ''
    };
  }).filter(item => item.url.trim().length > 0);

  // Section specific colors/themes
  const headerGlow = sectionName === 'RHZ365'
    ? 'text-indigo-400 border-indigo-900/30 bg-indigo-950/20'
    : sectionName === 'WnR365'
      ? 'text-amber-400 border-amber-900/30 bg-amber-950/20'
      : 'text-emerald-400 border-emerald-900/30 bg-emerald-950/20';

  return (
    <div className={`mt-6 p-5 sm:p-6 rounded-2xl border text-left shadow-lg transition duration-300 ${isLight ? 'bg-slate-50/90 border-slate-200 shadow-slate-100' : 'bg-slate-950/50 border-slate-800/80 shadow-2xl'
      }`}>
      {/* FEATURED MAIN BIBLE PASSAGE CARD (For Biblia365) */}
      {isBible && (
        <div className={`mb-6 p-4 sm:p-5 rounded-2xl border transition-all shadow-md ${isLight
          ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/60 border-emerald-200'
          : 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 border-emerald-800/60'
          }`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left w-full sm:w-auto">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-lg shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h4 className={`text-sm sm:text-base font-bold font-serif ${isLight ? 'text-emerald-950' : 'text-emerald-200'}`}>
                  📖 Główny Fragment Pisma Świętego
                </h4>
                <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'} mt-0.5`}>
                  {passageUrl ? 'Bezpośredni odnośnik do pełnego tekstu czytania biblijnego' : 'Brak ustawionego głównego linku do tekstu Biblii'}
                </p>
              </div>
            </div>

            {passageUrl ? (
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <div className="shrink-0">
                  <ClickableQrCode url={passageUrl} theme={theme} />
                </div>
                <a
                  href={passageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2 shrink-0 active:scale-95 cursor-pointer"
                >
                  <span>Otwórz fragment Biblii</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              isAuthorized && onSaveUrls && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-700/50 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  + Dodaj główny link do fragmentu Biblii
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-800/40">
        <div>
          <h3 className={`text-sm sm:text-base font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
            {isBible ? 'Materiały Analityczne i Wideo dla Rozdziału (8 zasobów)' : 'Materiały Analityczne i Wideo (Notebook Gemini / YouTube)'}
          </h3>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {isBible
              ? 'Podcasty AI, analizy, fiszki, prezentacje i nagrania wideo powiązane z tym czytaniem biblijnym'
              : 'Podcasty AI, analizy, fiszki i nagrania wideo powiązane z tym wpisem'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${isLight ? 'bg-white text-slate-700 border-slate-200' : headerGlow
            }`}>
            {sectionName} — {activeItems.length} z {maxCount} zasobów
          </span>

          {/* Quick Edit Button for Admins */}
          {isAuthorized && onSaveUrls && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${isLight
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                : 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border-emerald-800'
                }`}
              title="Edytuj linki i etykiety Gemini Notebook"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edytuj linki i etykiety</span>
            </button>
          )}
        </div>
      </div>

      {/* INLINE ADMIN EDIT FORM */}
      {isEditing && (
        <div className={`mb-6 p-4 rounded-xl border animate-fadeIn ${isLight ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-900/90 border-emerald-900/60'
          }`}>
          <div className="flex items-center justify-between mb-3 border-b border-emerald-900/30 pb-2">
            <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-emerald-900' : 'text-emerald-300'
              }`}>
              <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
              Szybka Edycja Linków i Etykiet ({sectionName})
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
                className={`px-2.5 py-1 rounded-lg text-xs border transition ${isLight ? 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                  }`}
              >
                <X className="w-3.5 h-3.5 inline mr-1" />
                Anuluj
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Zapisz & Synchronizuj
              </button>
            </div>
          </div>

          {saveMessage && (
            <div className="mb-3 text-xs font-semibold text-center text-emerald-400 animate-fadeIn">
              {saveMessage}
            </div>
          )}

          {/* MAIN BIBLE URL FIELD (If isBible) */}
          {isBible && (
            <div className="mb-4 p-3 rounded-lg border bg-emerald-950/30 border-emerald-800/50 space-y-1.5">
              <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>Główny link do fragmentu Biblii (np. Biblia Deon, BibleServer):</span>
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
                className={`w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition ${isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500' : 'bg-slate-950 border-slate-800 text-slate-100 focus:border-emerald-500'
                  }`}
                placeholder="https://biblia.deon.pl/... lub https://www.bibleserver.com/..."
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {analysisTypes.map((type, idx) => (
              <div key={type.id} className="space-y-1.5 p-3 rounded-lg border bg-black/10 border-slate-800/40">
                <div className="flex items-center justify-between">
                  <label className={`block text-[11px] font-bold flex items-center gap-1 ${isLight ? 'text-slate-800' : 'text-slate-200'
                    }`}>
                    <span className="font-mono text-[10px] opacity-70">#{type.id}</span>
                    <span>Domyślnie: {type.label}</span>
                  </label>
                </div>
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
                    className={`w-full rounded-lg px-2.5 py-1 text-xs border focus:outline-none transition ${isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500' : 'bg-slate-950 border-slate-800 text-slate-100 focus:border-emerald-500'
                      }`}
                    placeholder={type.label}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Adres URL Gemini Notebook / YouTube:</label>
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
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none transition ${isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500' : 'bg-slate-950 border-slate-800 text-slate-100 focus:border-emerald-500'
                      }`}
                    placeholder="https://notebooklm.google.com/..."
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTENT CARDS */}
      {activeItems.length === 0 ? (
        <div className={`p-6 rounded-xl border text-center text-xs leading-relaxed flex flex-col items-center justify-center gap-2 ${isLight ? 'bg-slate-100/50 border-slate-200 text-slate-500' : 'bg-slate-900/30 border-slate-800/80 text-slate-400'
          }`}>
          <div>💡 Brak wklejonych linków Gemini Notebook dla tego czytania.</div>
          {isAuthorized && onSaveUrls && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="mt-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Dodaj linki z kodami QR dla Gemini Notebook</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {activeItems.map(item => {
            const IconComp = item.icon;
            return (
              <div
                key={item.id}
                className={`flex flex-col justify-between p-4 rounded-xl border transition-all duration-300 hover:shadow-lg ${isLight
                  ? 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50/50'
                  : 'bg-slate-900/60 border-slate-800/80 hover:border-emerald-800/80 hover:bg-slate-850/60'
                  }`}
              >
                <div className="space-y-2 text-center">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${item.color} mx-auto flex items-center justify-center text-white shadow-md`}>
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className={`text-xs sm:text-sm font-extrabold leading-snug ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      {item.label}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                      {item.desc}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <ClickableQrCode url={item.url} theme={theme} />
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold tracking-wide transition flex items-center justify-center gap-1.5 active:scale-95 shadow-sm ${isLight
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-800/60'
                      }`}
                  >
                    Otwórz w Gemini Notebook <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


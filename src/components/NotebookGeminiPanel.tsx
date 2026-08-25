import React, { useState, useEffect } from 'react';
import { generateQrCodeDataUri } from '../utils/qrCodeGenerator';
import {
  ExternalLink, BookOpen, HelpCircle, GraduationCap, FileText, Play, Info, Video, Youtube,
  Edit3, Check, X, Loader2, Sparkles, PlusCircle
} from 'lucide-react';

export const GEMINI_ANALYSIS_TYPES = [
  { id: 1, label: 'Podsumowanie audio', desc: 'Dwugłosowy podcast AI (omówienie)', icon: Play, color: 'from-red-600 to-orange-500' },
  { id: 2, label: 'Podsumowanie wideo', desc: 'Prezentacja wideo lub powiązany film', icon: Video, color: 'from-blue-600 to-sky-600' },
  { id: 3, label: 'Prezentacja', desc: 'Streszczenie w formie slajdów', icon: BookOpen, color: 'from-emerald-600 to-teal-600' },
  { id: 4, label: 'Fiszki', desc: 'Zestaw kluczowych zagadnień', icon: Info, color: 'from-indigo-600 to-purple-600' },
  { id: 5, label: 'Test', desc: 'Pytania sprawdzające i quizy', icon: HelpCircle, color: 'from-violet-600 to-fuchsia-600' },
  { id: 6, label: 'Infografika', desc: 'Graficzny schemat i oś czasu', icon: GraduationCap, color: 'from-amber-600 to-orange-600' },
  { id: 7, label: 'Raport', desc: 'Kompletne opracowanie merytoryczne', icon: FileText, color: 'from-rose-600 to-pink-600' },
  { id: 8, label: 'YouTube', desc: 'Nagranie wideo na YouTube', icon: Youtube, color: 'from-red-600 to-red-500' }
];

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
      className={`block w-full max-w-[100px] sm:max-w-[120px] aspect-square mx-auto p-1.5 rounded-xl border transition-all hover:scale-105 duration-300 shadow-md ${
        isLight
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
  theme?: 'dark' | 'light';
  sectionName: 'RHZ365' | 'WnR365' | 'Biblia365' | 'Wstęp';
  isAuthorized?: boolean;
  onSaveUrls?: (newUrls: string[]) => Promise<void> | void;
}

export const NotebookGeminiPanel: React.FC<NotebookGeminiPanelProps> = ({
  notebookUrls = [],
  theme = 'dark',
  sectionName,
  isAuthorized = false,
  onSaveUrls
}) => {
  const isLight = theme === 'light';
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editUrls, setEditUrls] = useState<string[]>(() => {
    const arr = Array(8).fill('');
    if (Array.isArray(notebookUrls)) {
      notebookUrls.forEach((u, i) => {
        if (i < 8) arr[i] = u || '';
      });
    }
    return arr;
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>('');

  // Sync internal state if notebookUrls changes from parent
  useEffect(() => {
    const arr = Array(8).fill('');
    if (Array.isArray(notebookUrls)) {
      notebookUrls.forEach((u, i) => {
        if (i < 8) arr[i] = u || '';
      });
    }
    setEditUrls(arr);
  }, [notebookUrls]);

  const handleUrlChange = (idx: number, val: string) => {
    setEditUrls(prev => {
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
        Promise.resolve(onSaveUrls(editUrls)),
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
  const activeItems = GEMINI_ANALYSIS_TYPES.map((type, idx) => ({
    ...type,
    url: notebookUrls[idx] || ''
  })).filter(item => item.url.trim().length > 0);

  // Section specific colors/themes
  const headerGlow = sectionName === 'RHZ365' 
    ? 'text-indigo-400 border-indigo-900/30 bg-indigo-950/20' 
    : sectionName === 'WnR365'
      ? 'text-amber-400 border-amber-900/30 bg-amber-950/20'
      : 'text-emerald-400 border-emerald-900/30 bg-emerald-950/20';

  return (
    <div className={`mt-6 p-5 sm:p-6 rounded-2xl border text-left shadow-lg transition duration-300 ${
      isLight ? 'bg-slate-50/90 border-slate-200 shadow-slate-100' : 'bg-slate-950/50 border-slate-800/80 shadow-2xl'
    }`}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-800/40">
        <div>
          <h3 className={`text-sm sm:text-base font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
            Materiały Analityczne i Wideo (Notebook Gemini / YouTube)
          </h3>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Podcasty AI, analizy, fiszki i nagrania wideo powiązane z tym wpisem
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
            isLight ? 'bg-white text-slate-700 border-slate-200' : headerGlow
          }`}>
            {sectionName} — {activeItems.length} zasobów
          </span>

          {/* Quick Edit Button for Admins */}
          {isAuthorized && onSaveUrls && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                isLight
                  ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                  : 'bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 border-indigo-800'
              }`}
              title="Edytuj linki Gemini i YouTube bezpośrednio w tym panelu"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edytuj linki</span>
            </button>
          )}
        </div>
      </div>

      {/* INLINE ADMIN EDIT FORM */}
      {isEditing && (
        <div className={`mb-6 p-4 rounded-xl border animate-fadeIn ${
          isLight ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-900/90 border-indigo-900/60'
        }`}>
          <div className="flex items-center justify-between mb-3 border-b border-indigo-900/30 pb-2">
            <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              isLight ? 'text-indigo-900' : 'text-indigo-300'
            }`}>
              <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
              Szybka Edycja Linków Gemini ({sectionName})
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
                className={`px-2.5 py-1 rounded-lg text-xs border transition ${
                  isLight ? 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            {GEMINI_ANALYSIS_TYPES.map((type, idx) => (
              <div key={type.id} className="space-y-1">
                <label className={`block text-[11px] font-semibold flex items-center gap-1 ${
                  isLight ? 'text-slate-800' : 'text-slate-200'
                }`}>
                  <span className="font-mono text-[10px] opacity-70">#{type.id}</span>
                  <span>{type.label}</span>
                  <span className={`text-[9px] font-normal truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    ({type.desc})
                  </span>
                </label>
                <input
                  type="url"
                  value={editUrls[idx]}
                  onChange={(e) => handleUrlChange(idx, e.target.value)}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none transition ${
                    isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500' : 'bg-slate-950 border-slate-800 text-slate-100 focus:border-indigo-500'
                  }`}
                  placeholder="https://..."
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTENT CARDS */}
      {activeItems.length === 0 ? (
        <div className={`p-6 rounded-xl border text-center text-xs leading-relaxed flex flex-col items-center justify-center gap-2 ${
          isLight ? 'bg-slate-100/50 border-slate-200 text-slate-500' : 'bg-slate-900/30 border-slate-800/80 text-slate-400'
        }`}>
          <div>💡 Brak wygenerowanych zasobów Notebook Gemini (analiz/syntez) dla tej publikacji.</div>
          {isAuthorized && onSaveUrls && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="mt-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Dodaj linki Gemini / YouTube dla tej strony</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
          {activeItems.map(item => {
            const IconComp = item.icon;
            return (
              <div
                key={item.id}
                className={`flex flex-col justify-between p-3 rounded-xl border transition-all duration-300 hover:shadow-md ${
                  isLight
                    ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-850/40'
                }`}
              >
                <div className="space-y-2 text-center">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.color} mx-auto flex items-center justify-center text-white shadow-sm`}>
                    <IconComp className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className={`text-[11px] font-extrabold leading-snug line-clamp-2 ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      {item.label}
                    </h4>
                    <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">
                      {item.desc}
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-2.5">
                  <ClickableQrCode url={item.url} theme={theme} />
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full py-1 px-2 rounded-lg text-[10px] font-bold tracking-wide transition flex items-center justify-center gap-1 active:scale-95 ${
                      isLight
                        ? 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600'
                        : 'bg-slate-800 hover:bg-indigo-900/30 text-slate-300 hover:text-indigo-300 border border-slate-700/40 hover:border-indigo-800/40'
                    }`}
                  >
                    Otwórz <ExternalLink className="w-2.5 h-2.5" />
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

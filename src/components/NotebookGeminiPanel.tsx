import React, { useState, useEffect } from 'react';
import { generateQrCodeDataUri } from '../utils/qrCodeGenerator';
import {
  ExternalLink, BookOpen, HelpCircle, GraduationCap, FileText, Play, Info, Video, Youtube,
  Sparkles
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
  sectionName
}) => {
  const isLight = theme === 'light';
  const analysisTypes = GEMINI_ANALYSIS_TYPES;
  const maxCount = analysisTypes.length;

  // Filter items that have a valid URL
  const activeItems = analysisTypes.map((type, idx) => {
    const customLabel = notebookLabels && notebookLabels[idx];
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

  if (activeItems.length === 0 && !passageUrl) {
    return null;
  }

  return (
    <div className={`mt-6 p-5 sm:p-6 rounded-2xl border text-left shadow-lg transition duration-300 ${isLight ? 'bg-slate-50/90 border-slate-200 shadow-slate-100' : 'bg-slate-950/50 border-slate-800/80 shadow-2xl'
      }`}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-800/40">
        <div>
          <h3 className={`text-sm sm:text-base font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
            Materiały Analityczne i Wideo (Notebook Gemini / YouTube)
          </h3>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Podcasty AI, analizy, fiszki i nagrania wideo powiązane z tym wpisem
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${isLight ? 'bg-white text-slate-700 border-slate-200' : headerGlow
            }`}>
            {sectionName} — {activeItems.length} z {maxCount} zasobów
          </span>
        </div>
      </div>

      {/* CONTENT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 font-sans">
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
    </div>
  );
};



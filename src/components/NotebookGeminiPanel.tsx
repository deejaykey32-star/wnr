import React, { useState, useEffect } from 'react';
import { generateQrCodeDataUri } from '../utils/qrCodeGenerator';
import { ExternalLink, BookOpen, HelpCircle, GraduationCap, History, FileText, Play, Info, Video } from 'lucide-react';

export const GEMINI_ANALYSIS_TYPES = [
  { id: 1, label: 'Podsumowanie audio', desc: 'Dwugłosowy podcast AI (omówienie)', icon: Play, color: 'from-red-600 to-orange-500' },
  { id: 2, label: 'Podsumowanie wideo', desc: 'Prezentacja wideo lub powiązany film', icon: Video, color: 'from-blue-600 to-sky-600' },
  { id: 3, label: 'Prezentacja', desc: 'Streszczenie w formie slajdów', icon: BookOpen, color: 'from-emerald-600 to-teal-600' },
  { id: 4, label: 'Fiszki', desc: 'Zestaw kluczowych zagadnień', icon: Info, color: 'from-indigo-600 to-purple-600' },
  { id: 5, label: 'Test', desc: 'Pytania sprawdzające i quizy', icon: HelpCircle, color: 'from-violet-600 to-fuchsia-600' },
  { id: 6, label: 'Infografika', desc: 'Graficzny schemat i oś czasu', icon: GraduationCap, color: 'from-amber-600 to-orange-600' },
  { id: 7, label: 'Raport', desc: 'Kompletne opracowanie merytoryczne', icon: FileText, color: 'from-rose-600 to-pink-600' }
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
  sectionName: 'RHZ365' | 'WnR365' | 'Biblia365';
}

export const NotebookGeminiPanel: React.FC<NotebookGeminiPanelProps> = ({
  notebookUrls = [],
  theme = 'dark',
  sectionName
}) => {
  const isLight = theme === 'light';

  // Filter items that have a valid URL
  const activeItems = GEMINI_ANALYSIS_TYPES.map((type, idx) => ({
    ...type,
    url: notebookUrls[idx] || ''
  })).filter(item => item.url.trim().length > 0);

  if (activeItems.length === 0) {
    return (
      <div className={`mt-6 p-5 rounded-2xl border text-center text-xs leading-relaxed ${
        isLight ? 'bg-slate-100/50 border-slate-200 text-slate-500' : 'bg-slate-900/30 border-slate-800/80 text-slate-400'
      }`}>
        <span className="mr-1.5">💡</span> Brak wygenerowanych zasobów Notebook Gemini (analiz/syntez) dla tej publikacji.
      </div>
    );
  }

  // Section specific colors/themes
  const headerGlow = sectionName === 'RHZ365' 
    ? 'text-indigo-400 border-indigo-900/30 bg-indigo-950/20' 
    : sectionName === 'WnR365'
      ? 'text-amber-400 border-amber-900/30 bg-amber-950/20'
      : 'text-emerald-400 border-emerald-900/30 bg-emerald-950/20';

  return (
    <div className={`mt-8 p-6 rounded-2xl border text-left shadow-lg transition duration-300 ${
      isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950/40 border-slate-800/70'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800/50">
        <div>
          <h3 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
            Materiały Analityczne (Notebook Gemini)
          </h3>
          <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Komentarze, streszczenia i syntezy wygenerowane dla tego wpisu
          </p>
        </div>
        <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
          isLight ? 'bg-white text-slate-700 border-slate-200' : headerGlow
        }`}>
          {sectionName} — {activeItems.length} zasobów
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
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
    </div>
  );
};

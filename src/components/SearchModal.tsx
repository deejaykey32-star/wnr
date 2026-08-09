import React, { useState, useMemo } from 'react';
import { Search, X, BookOpen, Calendar, ArrowRight } from 'lucide-react';
import rhzData from '../../RHZ365_pierwszy_cykl_175_dni.json';
import { parseDayText } from '../utils/rhzParser';

export interface SearchResultItem {
  id: string;
  section: 'RHZ365' | 'WnR365';
  dayNumber: number;
  dateStr: string;
  title: string;
  matchedField: string;
  snippet: string;
  targetDate: Date;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult: (section: 'RHZ365' | 'WnR365', dayNumber: number, targetDate: Date) => void;
  prayers: Record<string, { title: string; text: string }>;
  blogEntries: Record<string, { title: string; text: string; dayIndex: number }>;
  theme?: string;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectResult,
  prayers,
  blogEntries,
  theme = 'dark'
}) => {
  const isLight = theme === 'light';
  const [query, setQuery] = useState('');

  // Helper to map dayNumber (1..175) of Cykl I to a calendar Date starting Dec 25
  const getDateForDayNumber = (dayNumber: number): Date => {
    const cycleStart = new Date(2025, 11, 25, 12, 0, 0, 0); // Dec 25 2025
    return new Date(cycleStart.getTime() + (dayNumber - 1) * 86400000);
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const searchHits: SearchResultItem[] = [];
    const maxResults = 40;

    // 1. Search RHZ365
    for (let i = 0; i < rhzData.length; i++) {
      if (searchHits.length >= maxResults) break;
      const item = rhzData[i];
      const dayNum = item.dayNumber;
      const decIdx = ((dayNum - 1) % 5) + 1;
      const firestoreKey = `day_${dayNum}_decade_rgba_${decIdx}`;
      
      const customVal = prayers[firestoreKey];
      const title = customVal?.title || item.title || `Dzień ${dayNum}`;
      const fullText = customVal?.text || item.text || '';

      const targetDate = getDateForDayNumber(dayNum);
      const dateStr = `${item.dayMonth || ''} (Cykl I - Dzień ${dayNum})`;

      const lowerTitle = title.toLowerCase();
      const lowerText = fullText.toLowerCase();
      const dayStr = `dzień ${dayNum}`;

      if (lowerTitle.includes(q) || dayStr.includes(q) || q === String(dayNum)) {
        searchHits.push({
          id: `rhz-title-${dayNum}`,
          section: 'RHZ365',
          dayNumber: dayNum,
          dateStr,
          title,
          matchedField: 'Tytuł wpisu',
          snippet: title,
          targetDate
        });
        continue;
      }

      // Check stage/part/mystery search queries
      const stageStr = `etap ${item.stage}`;
      const partStr = `część ${item.part}`;
      const mysteryStr = `tajemnica ${item.mystery}`;

      if (stageStr.includes(q) || partStr.includes(q) || mysteryStr.includes(q)) {
        searchHits.push({
          id: `rhz-meta-${dayNum}`,
          section: 'RHZ365',
          dayNumber: dayNum,
          dateStr,
          title,
          matchedField: 'Etap / Część / Tajemnica',
          snippet: `Etap ${item.stage} • Część ${item.part} • Tajemnica ${item.mystery}`,
          targetDate
        });
        continue;
      }

      // Check inside text (reflections + 10 Hail Marys "dla którego...")
      const qIdx = lowerText.indexOf(q);
      if (qIdx !== -1) {
        const start = Math.max(0, qIdx - 40);
        const end = Math.min(fullText.length, qIdx + q.length + 60);
        const snippetText = (start > 0 ? '...' : '') + fullText.substring(start, end).replace(/\n+/g, ' ') + (end < fullText.length ? '...' : '');

        // Determine if match is inside a specific Hail Mary
        let matchedLabel = 'Rozważanie / Treść modlitwy';
        const parsed = parseDayText(dayNum, fullText);
        if (parsed.success && parsed.data) {
          parsed.data.hailMaryTexts.forEach((hm, hmIdx) => {
            if (hm.toLowerCase().includes(q)) {
              matchedLabel = `Zdrowaś Maryjo #${hmIdx + 1} (dla którego...)`;
            }
          });
        }

        searchHits.push({
          id: `rhz-text-${dayNum}`,
          section: 'RHZ365',
          dayNumber: dayNum,
          dateStr,
          title,
          matchedField: matchedLabel,
          snippet: snippetText,
          targetDate
        });
      }
    }

    // 2. Search WnR365 (Blog entries)
    Object.entries(blogEntries).forEach(([docId, entry]: [string, any]) => {
      if (searchHits.length >= maxResults) return;
      const dayIndex = entry.dayIndex ?? 0;
      const dayNum = (dayIndex % 175) + 1;
      const targetDate = getDateForDayNumber(dayNum);
      const title = entry.title || `Widoki na Raj — Dzień ${dayNum}`;
      const text = entry.text || '';
      const lowerTitle = title.toLowerCase();
      const lowerText = text.toLowerCase();

      if (lowerTitle.includes(q) || lowerText.includes(q)) {
        let snippetText = title;
        if (lowerText.includes(q)) {
          const idx = lowerText.indexOf(q);
          const start = Math.max(0, idx - 40);
          const end = Math.min(text.length, idx + q.length + 60);
          snippetText = (start > 0 ? '...' : '') + text.substring(start, end).replace(/\n+/g, ' ') + (end < text.length ? '...' : '');
        }

        searchHits.push({
          id: `wnr-${docId}`,
          section: 'WnR365',
          dayNumber: dayNum,
          dateStr: `Widoki na Raj (Dzień ${dayNum})`,
          title,
          matchedField: 'Rozważanie Słowa WnR365',
          snippet: snippetText,
          targetDate
        });
      }
    });

    return searchHits;
  }, [query, prayers, blogEntries]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-start justify-center p-4 pt-12 sm:pt-20 overflow-y-auto">
      <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden transition-all text-left ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
      }`}>
        {/* Search Input Header */}
        <div className={`p-4 border-b flex items-center gap-3 ${
          isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-950/60'
        }`}>
          <Search className="w-5 h-5 text-indigo-500 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Wyszukaj dzień, tytuł, frazę, 'dla którego' lub Słowo..."
            autoFocus
            className={`w-full bg-transparent text-base sm:text-lg focus:outline-none ${
              isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-zinc-500'
            }`}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              isLight ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 border-slate-300' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700'
            }`}
          >
            Zamknij
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
          {!query.trim() ? (
            <div className="py-12 text-center text-sm text-slate-400 space-y-2">
              <Search className="w-8 h-8 mx-auto text-indigo-400 opacity-60" />
              <p className="font-medium text-slate-300">Wpisz szukaną frazę w polu powyżej</p>
              <p className="text-xs text-slate-500">
                Możesz wpisać numer dnia (np. <strong>45</strong>), tajemnicę, fragment rozważania lub dopowiedzenie <strong>"dla którego..."</strong>.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-sm text-amber-400 space-y-1">
              <p className="font-bold text-base">Nie znaleziono wyników.</p>
              <p className="text-xs text-slate-400">Spróbuj wpisać inny numer dnia lub słowo kluczowe.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-slate-400 font-mono px-1 flex justify-between">
                <span>Wyniki wyszukiwania ({results.length}):</span>
                <span>Kliknij, aby otworzyć wpis</span>
              </div>
              {results.map((res) => (
                <div
                  key={res.id}
                  onClick={() => {
                    onSelectResult(res.section, res.dayNumber, res.targetDate);
                    onClose();
                  }}
                  className={`p-4 rounded-xl border transition cursor-pointer flex flex-col gap-1.5 ${
                    isLight 
                      ? 'bg-slate-50 border-slate-200 hover:bg-indigo-50/50 hover:border-indigo-300' 
                      : 'bg-slate-950/50 border-slate-800 hover:bg-indigo-950/40 hover:border-indigo-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${
                        res.section === 'RHZ365'
                          ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                          : 'bg-amber-950 text-amber-300 border-amber-800'
                      }`}>
                        {res.section}
                      </span>
                      <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        Dzień {res.dayNumber}
                      </span>
                    </div>
                    <span className="text-[10px] text-indigo-400 font-mono flex items-center gap-1">
                      Otwórz wpis <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>

                  <h4 className={`text-base font-bold font-serif ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {res.title}
                  </h4>

                  <div className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                    <span className="text-emerald-400 font-semibold">{res.matchedField}:</span>
                  </div>

                  <p className={`text-xs sm:text-sm leading-relaxed line-clamp-2 italic ${
                    isLight ? 'text-slate-600' : 'text-slate-300'
                  }`}>
                    "{res.snippet}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  isLight: boolean;
}

const FLAG_MAP: Record<string, string> = {
  pl: '🇵🇱', en: '🇬🇧', de: '🇩🇪', es: '🇪🇸', fr: '🇫🇷', it: '🇮🇹',
  uk: '🇺🇦', lt: '🇱🇹', ru: '🇷🇺', pt: '🇵🇹', nl: '🇳🇱', cs: '🇨🇿',
  sk: '🇸🇰', hu: '🇭🇺', sv: '🇸🇪', no: '🇳🇴', fi: '🇫🇮', da: '🇩🇰',
  tr: '🇹🇷', el: '🇬🇷', zh: '🇨🇳', 'zh-cn': '🇨🇳', 'zh-tw': '🇹🇼',
  ja: '🇯🇵', ko: '🇰🇷', ar: '🇸🇦', hi: '🇮🇳',
};

interface LangOption {
  code: string;
  name: string;
  flag: string | React.ReactNode;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ isLight }) => {
  const [isOpen, setIsOpen] = useState(false);
  const defaultLang = { code: 'pl', name: 'Polski (Oryginał)', flag: '🇵🇱' };
  const [languages, setLanguages] = useState<LangOption[]>([defaultLang]);
  const [currentLang, setCurrentLang] = useState<LangOption>(defaultLang);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Sprawdzaj co 1 sekundę czy Google Translate załadowało opcje języków
    const interval = setInterval(() => {
      const selectElement = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
      if (selectElement && selectElement.options.length > 1) {
        clearInterval(interval);
        
        const newLangs: LangOption[] = [defaultLang];
        Array.from(selectElement.options).forEach(opt => {
          if (opt.value && opt.value !== '') {
            const code = opt.value.toLowerCase();
            const flag = FLAG_MAP[code] || <Globe className="w-3.5 h-3.5" />;
            newLangs.push({ code: opt.value, name: opt.text, flag });
          }
        });
        
        setLanguages(newLangs);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (lang: LangOption) => {
    setCurrentLang(lang);
    setIsOpen(false);

    const selectElement = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
    
    if (selectElement) {
      if (lang.code === 'pl') {
        // Powrót do języka polskiego (oryginału) - wybieramy pustą opcję Google Translate
        selectElement.value = '';
      } else {
        selectElement.value = lang.code;
      }
      
      // Wywołanie zdarzenia zmiany, aby skrypt Google przetłumaczył stronę
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));
      
      // W niektórych przeglądarkach potrzebne jest również zdarzenie "click" lub utworzenie własnego Eventu
      const event = document.createEvent('HTMLEvents');
      event.initEvent('change', true, false);
      selectElement.dispatchEvent(event);
    } else {
      console.warn("Nie znaleziono widgetu Google Translate.");
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Zmień język (Translate)"
        className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-colors cursor-pointer text-[11px] sm:text-xs font-semibold ${
          isLight
            ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 shadow-sm'
            : 'bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-slate-700'
        }`}
      >
        <span className="text-sm flex items-center justify-center leading-none">
          {typeof currentLang.flag === 'string' ? currentLang.flag : <Globe className="w-4 h-4" />}
        </span>
        <span className="uppercase">{currentLang.code.slice(0, 2)}</span>
      </button>

      {isOpen && (
        <div className={`absolute top-full right-0 sm:left-auto mt-2 w-48 max-h-64 overflow-y-auto rounded-xl border shadow-xl z-[100] custom-scrollbar ${
          isLight ? 'bg-white border-slate-200 shadow-slate-200/50' : 'bg-slate-900 border-slate-700 shadow-black/50'
        }`}>
          <div className="flex flex-col py-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang)}
                className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-colors ${
                  currentLang.code === lang.code
                    ? (isLight ? 'bg-indigo-50 text-indigo-700 font-bold' : 'bg-indigo-900/40 text-indigo-300 font-bold')
                    : (isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-800')
                }`}
              >
                <span className="text-base flex items-center justify-center w-5 h-5 leading-none">{lang.flag}</span>
                <span className="truncate">{lang.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

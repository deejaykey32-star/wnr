import React, { useState, useEffect } from 'react';
import { Volume2, Loader2 } from 'lucide-react';
import { getVoicesForLang, isMaleVoiceName } from '../utils/tts';
import { SUPPORTED_LANGUAGES } from '../utils/translator';

interface TtsVoiceToolbarProps {
  targetLanguage: string;
  setTargetLanguage: (lang: string) => void;
  selectedGender: 'female' | 'male';
  setSelectedGender: (gender: 'female' | 'male') => void;
  selectedVoiceUri: string;
  setSelectedVoiceUri: (uri: string) => void;
  theme?: string;
  isTranslating?: boolean;
  onOptionChange?: () => void;
}

export const TtsVoiceToolbar: React.FC<TtsVoiceToolbarProps> = ({
  targetLanguage,
  setTargetLanguage,
  selectedGender,
  setSelectedGender,
  selectedVoiceUri,
  setSelectedVoiceUri,
  theme = 'dark',
  isTranslating = false,
  onOptionChange
}) => {
  const isDark = theme === 'dark';
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const updateVoices = () => {
      const vList = getVoicesForLang(targetLanguage);
      setAvailableVoices(vList);
    };
    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, [targetLanguage]);

  const hasMaleVoice = availableVoices.some(v => isMaleVoiceName(v.name));
  const isVoiceSpecific = Boolean(selectedVoiceUri);
  const activeLangObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage) || SUPPORTED_LANGUAGES[0];

  return (
    <div className={`p-3 rounded-2xl backdrop-blur-md shadow-md border flex flex-wrap items-center justify-between gap-3 mb-4 transition-all ${
      isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'
    }`}>
      <div className="flex items-center gap-2">
        <Volume2 className="w-5 h-5 text-amber-500 shrink-0" />
        <span className={`text-xs sm:text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
          Głos AI Lektora:
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Gender Switcher (Głos Żeński / Męski) */}
        <div className={`flex items-center rounded-xl p-1 border text-xs ${
          isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-200 border-slate-300'
        }`}>
          <button
            type="button"
            onClick={() => {
              setSelectedGender('female');
              setSelectedVoiceUri('');
              if (onOptionChange) onOptionChange();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              !isVoiceSpecific && selectedGender === 'female'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Czysty głos żeński (np. Paulina / Zofia / Google)"
          >
            👩 <span>Głos żeński</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedGender('male');
              setSelectedVoiceUri('');
              if (onOptionChange) onOptionChange();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              !isVoiceSpecific && selectedGender === 'male'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title={hasMaleVoice ? 'Głos męski (np. Jacek)' : 'Brak głosu męskiego w systemie — zostanie użyty neutralny'}
          >
            👨 <span>Głos Męski{!hasMaleVoice && availableVoices.length > 0 ? ' ⚠️' : ''}</span>
          </button>
        </div>

        {/* Dynamic Voice Selector matching current target language */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 hidden sm:inline">
            {targetLanguage === 'pl' ? 'Głos polski:' : `Głos (${activeLangObj.name}):`}
          </span>
          <select
            value={selectedVoiceUri}
            onChange={(e) => {
              const newUri = e.target.value;
              setSelectedVoiceUri(newUri);
              if (onOptionChange) onOptionChange();
            }}
            className={`text-xs p-2 rounded-xl border font-semibold max-w-[200px] cursor-pointer transition-all ${
              isDark 
                ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700' 
                : 'bg-slate-100 border-slate-300 text-amber-700 hover:bg-slate-200'
            } ${isVoiceSpecific ? 'ring-2 ring-amber-500' : ''}`}
            title={`Wybierz głos dla języka ${activeLangObj.name}`}
          >
            <option value="">
              ★ Auto ({targetLanguage === 'pl' ? (selectedGender === 'female' ? 'Żeński PL' : 'Męski PL') : activeLangObj.name})
            </option>
            {availableVoices.length === 0 && (
              <option disabled value="__none__">
                Brak głosów [{targetLanguage}] w systemie
              </option>
            )}
            {availableVoices.map((v, idx) => {
              const voiceId = (v.voiceURI && v.voiceURI.trim() !== '') ? v.voiceURI : v.name;
              return (
                <option key={`v-${voiceId}-${idx}`} value={voiceId}>
                  {v.name} [{v.lang}]
                </option>
              );
            })}
          </select>
        </div>

        {/* Live Translation Language Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 hidden sm:inline">🌐 Tłumacz w locie:</span>
          <select
            value={targetLanguage}
            onChange={(e) => {
              const newLang = e.target.value;
              setTargetLanguage(newLang);
              setSelectedVoiceUri(''); // Reset voice selection for new language
              if (onOptionChange) onOptionChange();
            }}
            className={`text-xs p-2 rounded-xl border font-semibold cursor-pointer transition-all ${
              isDark 
                ? 'bg-slate-800 border-slate-700 text-sky-400 hover:bg-slate-700' 
                : 'bg-slate-100 border-slate-300 text-sky-700 hover:bg-slate-200'
            } ${targetLanguage !== 'pl' ? 'ring-2 ring-sky-500 font-bold' : ''}`}
            title="Automatyczne tłumaczenie treści w locie i odczyt lektorem w wybranym języku"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.name} {lang.code !== 'pl' ? ' (Tłumaczenie AI)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Warning when no male voice exists */}
        {selectedGender === 'male' && !hasMaleVoice && !isVoiceSpecific && availableVoices.length > 0 && (
          <span className="text-xs text-amber-400 italic">⚠️ Brak głosu męskiego w systemie</span>
        )}
      </div>

      {/* Active Live Translation Indicator Banner */}
      {targetLanguage !== 'pl' && (
        <div className="w-full mt-1 pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs text-sky-400 bg-sky-500/10 px-3 py-1.5 rounded-xl">
          <span className="flex items-center gap-1.5 font-medium">
            🌐 Tłumaczenie w locie aktywne: {activeLangObj.flag} {activeLangObj.name}
            {isTranslating && <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400 inline ml-1" />}
          </span>
          <span className="text-[11px] text-slate-400 italic hidden sm:inline">
            Lektor odczytuje przetłumaczoną treść w tym języku
          </span>
        </div>
      )}
    </div>
  );
};

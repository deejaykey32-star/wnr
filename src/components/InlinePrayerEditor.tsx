import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { saveLocalPrayers } from '../utils/localNoSqlDb';
import { WysiwygToolbar } from './WysiwygToolbar';
import { Check, X, Loader2 } from 'lucide-react';
import { GEMINI_ANALYSIS_TYPES } from './NotebookGeminiPanel';

interface InlinePrayerEditorProps {
  prayerKey: string;
  initialTitle: string;
  initialText: string;
  userEmail: string;
  isLight: boolean;
  theme: 'dark' | 'light';
  onThemeToggle?: () => void;
  prayers: Record<string, { title: string; text: string; notebookUrls?: string[]; notebookLabels?: string[]; updatedBy?: string; updatedAt?: string }>;
  onPrayersUpdated: (prayers: Record<string, { title: string; text: string; notebookUrls?: string[]; notebookLabels?: string[]; updatedBy?: string; updatedAt?: string }>) => void;
  onCancel: () => void;
}

export const InlinePrayerEditor: React.FC<InlinePrayerEditorProps> = ({
  prayerKey,
  initialTitle,
  initialText,
  userEmail,
  isLight,
  theme,
  onThemeToggle,
  prayers,
  onPrayersUpdated,
  onCancel
}) => {
  const [editText, setEditText] = useState(initialText);
  const [editUrls, setEditUrls] = useState<string[]>(() => {
    const existing = prayers[prayerKey]?.notebookUrls;
    const arr = Array(8).fill('');
    if (Array.isArray(existing)) {
      existing.forEach((u, i) => {
        if (i < 8) arr[i] = u || '';
      });
    }
    return arr;
  });
  const [editLabels, setEditLabels] = useState<string[]>(() => {
    const existing = prayers[prayerKey]?.notebookLabels;
    const arr = Array(8).fill('');
    if (Array.isArray(existing)) {
      existing.forEach((l, i) => {
        if (i < 8) arr[i] = l || '';
      });
    }
    return arr;
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
    if (!editText.trim()) {
      setErrorMsg('Treść nie może być pusta!');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const newEntry = {
        title: initialTitle,
        text: editText.trim(),
        notebookUrls: editUrls,
        notebookLabels: editLabels,
        updatedBy: userEmail,
        updatedAt: new Date().toISOString()
      };

      const nextPrayers = {
        ...prayers,
        [prayerKey]: newEntry
      };

      // LOCAL-FIRST: Save to IndexedDB and update React state immediately
      try {
        await saveLocalPrayers(nextPrayers);
      } catch (err) {
        console.warn("Local DB Save error:", err);
      }

      onPrayersUpdated(nextPrayers);

      // Optional Cloud Backup: Send to Firestore in background without failing local save
      try {
        const docRef = doc(db, 'prayers', prayerKey);
        await setDoc(docRef, newEntry);
      } catch (cloudErr) {
        console.warn("Firestore Backup skipped/failed (saved locally):", cloudErr);
      }

      onCancel(); // Close editor after successful local save
    } catch (error: any) {
      console.error("Save Error:", error);
      setErrorMsg(`Błąd zapisu: ${error.message || 'Brak uprawnień lub błąd połączenia.'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`mt-4 p-4 rounded-xl border ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-900 border-slate-700'}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>Edytujesz: {initialTitle}</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isLight ? 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50' : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'
            }`}
          >
            <X className="w-3.5 h-3.5" /> Anuluj
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors shadow-md ${
              saving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Zapisz
          </button>
        </div>
      </div>
      
      {errorMsg && (
        <div className={`mb-3 p-2 rounded border text-xs ${isLight ? 'bg-red-50 text-red-700 border-red-200' : 'bg-red-950/50 text-red-400 border-red-900/50'}`}>
          {errorMsg}
        </div>
      )}

      <div className="bg-white dark:bg-slate-950 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 mb-4">
        <WysiwygToolbar 
          text={editText} 
          onChange={setEditText} 
          textareaId={`inline-editor-${prayerKey}`} 
          theme={theme}
          onThemeToggle={onThemeToggle}
        />
      </div>

      {/* Gemini & YouTube URLs and Labels input (8 fields) */}
      <div className="pt-3 border-t border-slate-800/40 space-y-2">
        <h5 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}>
          Materiały, Etykiety i Linki Gemini Notebook / YouTube (8 pól)
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          {GEMINI_ANALYSIS_TYPES.map((type, idx) => (
            <div key={type.id} className="space-y-1 p-2.5 rounded-lg border bg-black/10 border-slate-800/40">
              <label className={`block text-[11px] font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                #{type.id} Domyślnie: {type.label}
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
                    isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-950 border-slate-800 text-slate-200'
                  }`}
                  placeholder={type.label}
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
                  className={`w-full rounded-lg px-2.5 py-1 text-xs border focus:outline-none transition ${
                    isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-950 border-slate-800 text-slate-200'
                  }`}
                  placeholder="https://..."
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

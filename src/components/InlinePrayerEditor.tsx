import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { saveLocalPrayers } from '../utils/localNoSqlDb';
import { WysiwygToolbar } from './WysiwygToolbar';
import { Check, X, Loader2 } from 'lucide-react';

interface InlinePrayerEditorProps {
  prayerKey: string;
  initialTitle: string;
  initialText: string;
  userEmail: string;
  isLight: boolean;
  theme: 'dark' | 'light';
  onThemeToggle?: () => void;
  prayers: Record<string, { title: string; text: string; updatedBy?: string; updatedAt?: string }>;
  onPrayersUpdated: (prayers: Record<string, { title: string; text: string; updatedBy?: string; updatedAt?: string }>) => void;
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
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSave = async () => {
    if (!editText.trim()) {
      setErrorMsg('Treść nie może być pusta!');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const docRef = doc(db, 'prayers', prayerKey);
      
      const newEntry = {
        title: initialTitle,
        text: editText.trim(),
        updatedBy: userEmail,
        updatedAt: new Date().toISOString()
      };

      await setDoc(docRef, newEntry);

      const nextPrayers = {
        ...prayers,
        [prayerKey]: newEntry
      };

      try {
        await saveLocalPrayers(nextPrayers);
      } catch (err) {
        console.warn("Local DB Save error:", err);
      }

      onPrayersUpdated(nextPrayers);
      onCancel(); // zamknij edytor po udanym zapisie
    } catch (error: any) {
      console.error("Firestore Save Error:", error);
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

      <div className="bg-white dark:bg-slate-950 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
        <WysiwygToolbar 
          text={editText} 
          onChange={setEditText} 
          textareaId={`inline-editor-${prayerKey}`} 
          theme={theme}
          onThemeToggle={onThemeToggle}
        />
      </div>
    </div>
  );
};

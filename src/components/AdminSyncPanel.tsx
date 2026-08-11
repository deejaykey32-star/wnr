import React, { useState } from 'react';
import { db } from '../firebase';
import {
  collection, doc, setDoc, getDocs
} from 'firebase/firestore';
import {
  Cloud, CloudDownload, CloudUpload, RefreshCw, X,
  CheckCircle, AlertCircle, Loader, Database, RotateCcw
} from 'lucide-react';
import { getAllLocalBlogEntries, saveLocalBlogEntry, resetLocalToSeedData, saveLocalPrayers, getLocalPrayers } from '../utils/localNoSqlDb';
import { DEFAULT_PRAYERS } from '../data/prayers';

interface AdminSyncPanelProps {
  onClose: () => void;
  theme: 'dark' | 'light';
  blogEntries: Record<string, { title: string; text: string; dayIndex: number; updatedBy?: string; updatedAt?: string }>;
  prayers: Record<string, { title: string; text: string; updatedBy?: string; updatedAt?: string }>;
  onBlogEntriesUpdated: (entries: Record<string, { title: string; text: string; dayIndex: number; updatedBy?: string; updatedAt?: string }>) => void;
  onPrayersUpdated: (prayers: Record<string, { title: string; text: string; updatedBy?: string; updatedAt?: string }>) => void;
}

type SyncStatus = {
  type: 'idle' | 'loading' | 'success' | 'error';
  message: string;
};

export const AdminSyncPanel: React.FC<AdminSyncPanelProps> = ({
  onClose,
  theme,
  blogEntries,
  prayers,
  onBlogEntriesUpdated,
  onPrayersUpdated
}) => {
  const [blogStatus, setBlogStatus] = useState<SyncStatus>({ type: 'idle', message: '' });
  const [prayerStatus, setPrayerStatus] = useState<SyncStatus>({ type: 'idle', message: '' });

  const isDark = theme === 'dark';
  const bg = isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200';
  const text = isDark ? 'text-slate-100' : 'text-slate-900';
  const subText = isDark ? 'text-slate-400' : 'text-slate-500';
  const cardBg = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200';

  // ── BLOG ENTRIES ─────────────────────────────────────────────────────────────

  const pushBlogToFirestore = async () => {
    setBlogStatus({ type: 'loading', message: 'Wysyłam wpisy do Firestore...' });
    try {
      const local = await getAllLocalBlogEntries();
      const entries = Object.entries(local);
      let count = 0;

      for (const [docId, entry] of entries) {
        await setDoc(doc(db, 'blog_entries', docId), {
          title: entry.title,
          text: entry.text,
          dayIndex: entry.dayIndex,
          updatedBy: entry.updatedBy || 'Admin Sync',
          updatedAt: entry.updatedAt || new Date().toISOString()
        });
        count++;
        if (count % 50 === 0) {
          setBlogStatus({ type: 'loading', message: `Wysyłam... ${count}/${entries.length}` });
        }
      }

      setBlogStatus({ type: 'success', message: `✅ Wysłano ${count} wpisów do Firestore (kopia zapasowa)` });
    } catch (err) {
      setBlogStatus({ type: 'error', message: `❌ Błąd: ${err instanceof Error ? err.message : 'Nieznany błąd'}` });
    }
  };

  const pullBlogFromFirestore = async () => {
    if (!window.confirm('Czy na pewno pobrać wpisy z Firestore? Nadpisze lokalne edycje.')) return;
    setBlogStatus({ type: 'loading', message: 'Pobieram wpisy z Firestore...' });
    try {
      const snapshot = await getDocs(collection(db, 'blog_entries'));
      const updated: Record<string, { title: string; text: string; dayIndex: number; updatedBy?: string; updatedAt?: string }> = { ...blogEntries };
      let count = 0;

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data && data.title && data.text) {
          const isGeneric = data.text.includes('Chwała Jezusowi w Bogu Ojcu!') ||
                            data.text.includes('To jest Twój wpis blogowy');
          if (!isGeneric) {
            const entry = {
              title: data.title,
              text: data.text,
              dayIndex: data.dayIndex ?? 0,
              updatedBy: data.updatedBy,
              updatedAt: data.updatedAt
            };
            updated[docSnap.id] = entry;
            // Save to local IndexedDB too
            await saveLocalBlogEntry(docSnap.id, entry);
            count++;
          }
        }
      }

      onBlogEntriesUpdated(updated);
      setBlogStatus({ type: 'success', message: `✅ Pobrano ${count} wpisów z Firestore do lokalnej bazy` });
    } catch (err) {
      setBlogStatus({ type: 'error', message: `❌ Błąd: ${err instanceof Error ? err.message : 'Brak dostępu do Firestore'}` });
    }
  };

  const resetBlogToSeed = async () => {
    if (!window.confirm('Czy na pewno zresetować wszystkie wpisy do bazowych danych z PDF? Straci lokalne edycje.')) return;
    setBlogStatus({ type: 'loading', message: 'Resetuję do danych z PDF...' });
    try {
      await resetLocalToSeedData();
      const fresh = await getAllLocalBlogEntries();
      onBlogEntriesUpdated(fresh);
      setBlogStatus({ type: 'success', message: `✅ Zresetowano ${Object.keys(fresh).length} wpisów do danych z PDF` });
    } catch (err) {
      setBlogStatus({ type: 'error', message: `❌ Błąd resetowania: ${err instanceof Error ? err.message : ''}` });
    }
  };

  // ── PRAYERS ──────────────────────────────────────────────────────────────────

  const pushPrayersToFirestore = async () => {
    setPrayerStatus({ type: 'loading', message: 'Wysyłam modlitwy do Firestore...' });
    try {
      const entries = Object.entries(prayers);
      let count = 0;
      for (const [prayerId, prayer] of entries) {
        const typedPrayer = prayer as { title?: string; text?: string; updatedBy?: string; updatedAt?: string };
        if (typedPrayer && typedPrayer.text && typedPrayer.title) {
          await setDoc(doc(db, 'prayers', prayerId), {
            title: typedPrayer.title,
            text: typedPrayer.text,
            updatedBy: typedPrayer.updatedBy || 'Admin Sync',
            updatedAt: typedPrayer.updatedAt || new Date().toISOString()
          });
          count++;
        }
      }
      // Also persist locally
      await saveLocalPrayers(prayers);
      setPrayerStatus({ type: 'success', message: `✅ Wysłano ${count} modlitw do Firestore (kopia zapasowa)` });
    } catch (err) {
      setPrayerStatus({ type: 'error', message: `❌ Błąd: ${err instanceof Error ? err.message : 'Nieznany błąd'}` });
    }
  };

  const pullPrayersFromFirestore = async () => {
    if (!window.confirm('Czy na pewno pobrać modlitwy z Firestore? Nadpisze lokalne edycje.')) return;
    setPrayerStatus({ type: 'loading', message: 'Pobieram modlitwy z Firestore...' });
    try {
      const snapshot = await getDocs(collection(db, 'prayers'));
      const updated: Record<string, { title: string; text: string; updatedBy?: string; updatedAt?: string }> = { ...DEFAULT_PRAYERS };
      let count = 0;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.title && data.text) {
          updated[docSnap.id] = {
            title: data.title,
            text: data.text,
            updatedBy: data.updatedBy,
            updatedAt: data.updatedAt
          };
          count++;
        }
      });

      // Save locally
      await saveLocalPrayers(updated);
      onPrayersUpdated(updated);
      setPrayerStatus({ type: 'success', message: `✅ Pobrano ${count} modlitw z Firestore do lokalnej bazy` });
    } catch (err) {
      setPrayerStatus({ type: 'error', message: `❌ Błąd: ${err instanceof Error ? err.message : 'Brak dostępu do Firestore'}` });
    }
  };

  const StatusBar: React.FC<{ status: SyncStatus }> = ({ status }) => {
    if (status.type === 'idle') return null;
    const icon = status.type === 'loading' ? <Loader size={14} className="animate-spin inline mr-1" /> :
                 status.type === 'success' ? <CheckCircle size={14} className="inline mr-1 text-emerald-400" /> :
                 <AlertCircle size={14} className="inline mr-1 text-rose-400" />;
    const color = status.type === 'loading' ? 'text-amber-400' :
                  status.type === 'success' ? 'text-emerald-400' : 'text-rose-400';
    return (
      <div className={`mt-2 text-xs font-mono ${color} flex items-center gap-1 px-1`}>
        {icon}{status.message}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className={`relative w-full max-w-xl rounded-2xl border shadow-2xl ${bg} ${text} overflow-hidden`} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
              <Cloud size={18} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Synchronizacja Danych</h2>
              <p className={`text-xs ${subText}`}>Panel administracyjny — Firestore ↔ Lokalny NoSQL</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Info banner */}
        <div className={`mx-5 mt-4 px-4 py-3 rounded-xl text-xs border ${isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
          <Database size={13} className="inline mr-1.5" />
          <strong>Architektura:</strong> Użytkownicy widzą dane z lokalnego NoSQL (plik JSON z GitHub/Cloudflare).
          Firestore jest tylko kopią zapasową — nigdy nie jest automatycznie pobierany.
        </div>

        <div className="p-5 space-y-4">

          {/* Blog Entries Section */}
          <div className={`rounded-xl border p-4 ${cardBg}`}>
            <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
              <Database size={15} className="text-indigo-400" />
              Wpisy WnR365 (365 wpisów)
            </h3>
            <p className={`text-xs mb-3 ${subText}`}>
              Źródło: <code className="text-indigo-400">wnr365_pdf_entries.json</code> + IndexedDB (lokalne edycje)
            </p>

            <div className="grid grid-cols-1 gap-2">
              {/* Push to Firestore */}
              <button
                onClick={pushBlogToFirestore}
                disabled={blogStatus.type === 'loading'}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                  isDark
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 disabled:opacity-50'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50'
                }`}
              >
                <CloudUpload size={15} />
                Wyślij wszystkie wpisy do Firestore (backup)
                {blogStatus.type === 'loading' && <Loader size={13} className="animate-spin ml-auto" />}
              </button>

              {/* Pull from Firestore */}
              <button
                onClick={pullBlogFromFirestore}
                disabled={blogStatus.type === 'loading'}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                  isDark
                    ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50'
                }`}
              >
                <CloudDownload size={15} />
                Pobierz wpisy z Firestore (nadpisz lokalne)
              </button>

              {/* Reset to seed */}
              <button
                onClick={resetBlogToSeed}
                disabled={blogStatus.type === 'loading'}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                  isDark
                    ? 'bg-rose-600/20 border-rose-500/40 text-rose-300 hover:bg-rose-600/30 disabled:opacity-50'
                    : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 disabled:opacity-50'
                }`}
              >
                <RotateCcw size={15} />
                Resetuj do danych z PDF (usuń edycje lokalne)
              </button>
            </div>

            <StatusBar status={blogStatus} />
          </div>

          {/* Prayers Section */}
          <div className={`rounded-xl border p-4 ${cardBg}`}>
            <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
              <RefreshCw size={15} className="text-violet-400" />
              Modlitwy RHZ365
            </h3>
            <p className={`text-xs mb-3 ${subText}`}>
              Źródło: lokalne wartości domyślne + IndexedDB (edycje admina)
            </p>

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={pushPrayersToFirestore}
                disabled={prayerStatus.type === 'loading'}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                  isDark
                    ? 'bg-violet-600/20 border-violet-500/40 text-violet-300 hover:bg-violet-600/30 disabled:opacity-50'
                    : 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100 disabled:opacity-50'
                }`}
              >
                <CloudUpload size={15} />
                Wyślij modlitwy do Firestore (backup)
              </button>

              <button
                onClick={pullPrayersFromFirestore}
                disabled={prayerStatus.type === 'loading'}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                  isDark
                    ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50'
                }`}
              >
                <CloudDownload size={15} />
                Pobierz modlitwy z Firestore (nadpisz lokalne)
              </button>
            </div>

            <StatusBar status={prayerStatus} />
          </div>

        </div>

        {/* Footer */}
        <div className={`px-5 py-3 border-t text-xs ${subText} ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          🔒 Ten panel jest dostępny tylko dla zalogowanych administratorów.
          Dane użytkowników zawsze ładowane z lokalnego pliku JSON (Cloudflare CDN).
        </div>
      </div>
    </div>
  );
};

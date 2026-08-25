import React, { useState, useRef } from 'react';
import { db } from '../firebase';
import {
  collection, doc, setDoc, getDocs
} from 'firebase/firestore';
import {
  Cloud, CloudDownload, X,
  CheckCircle, AlertCircle, Loader, Database, FileText,
  Upload, Sparkles, HardDrive, ShieldCheck, Zap
} from 'lucide-react';
import {
  createNoSqlSnapshot,
  importFullNoSqlSnapshot, FullNoSqlSnapshot
} from '../utils/localNoSqlDb';

interface AdminSyncPanelProps {
  onClose: () => void;
  theme: 'dark' | 'light';
  prayers: Record<string, { title: string; text: string; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }>;
  bibleEntries: Record<string, { title: string; text: string; slotIndex: number; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }>;
  onBlogEntriesUpdated: (entries: Record<string, { title: string; text: string; dayIndex: number; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }>) => void;
  onPrayersUpdated: (prayers: Record<string, { title: string; text: string; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }>) => void;
  onBibleEntriesUpdated: (entries: Record<string, { title: string; text: string; slotIndex: number; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }>) => void;
  blogEntries: Record<string, { title: string; text: string; dayIndex: number; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }>;
}

type SyncStatus = {
  type: 'idle' | 'loading' | 'success' | 'error';
  message: string;
};

type ProgressState = {
  active: boolean;
  percent: number;
  step: string;
  itemCounter?: string;
};

export const AdminSyncPanel: React.FC<AdminSyncPanelProps> = ({
  onClose,
  theme,
  blogEntries,
  prayers,
  bibleEntries,
  onBlogEntriesUpdated,
  onPrayersUpdated,
  onBibleEntriesUpdated
}) => {
  const [masterStatus, setMasterStatus] = useState<SyncStatus>({ type: 'idle', message: '' });
  const [syncProgress, setSyncProgress] = useState<ProgressState>({
    active: false,
    percent: 0,
    step: '',
    itemCounter: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDark = theme === 'dark';
  const bg = isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200';
  const text = isDark ? 'text-slate-100' : 'text-slate-900';
  const subText = isDark ? 'text-slate-400' : 'text-slate-500';

  // Timeout wrapper to prevent hanging spinners on slow/blocked connections
  const withTimeout = <T,>(promise: Promise<T>, timeoutMs = 15000, errorMsg = 'Przekroczono limit czasu połączenia z Firestore (15s).'): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), timeoutMs))
    ]);
  };

  // ── 1-CLICK ALL-IN-ONE SMART SYNC WITH LIVE PROGRESS BAR ──────────────────
  const runFullSmartSync = async () => {
    setMasterStatus({
      type: 'loading',
      message: '🚀 Rozpoczynanie synchronizacji w chmurze...'
    });

    setSyncProgress({
      active: true,
      percent: 5,
      step: 'Inicjalizacja połączenia z Firestore...',
      itemCounter: 'Start'
    });

    try {
      // A. Push Blog to Firestore (0% - 35%)
      const totalBlogs = Object.keys(blogEntries).length || 365;
      let blogPushed = 0;
      for (const [docId, entry] of Object.entries(blogEntries)) {
        if (entry && entry.title && entry.text) {
          await setDoc(doc(db, 'blog_entries', docId), entry, { merge: true });
          blogPushed++;
          if (blogPushed % 20 === 0 || blogPushed === totalBlogs) {
            const pct = Math.round((blogPushed / totalBlogs) * 35);
            setSyncProgress({
              active: true,
              percent: Math.max(5, pct),
              step: '1/4. Synchronizacja wpisów WnR365 i linków Gemini...',
              itemCounter: `${blogPushed} / ${totalBlogs} wpisów`
            });
          }
        }
      }

      // B. Push Prayers & Intro to Firestore (35% - 70%)
      const totalPrayers = Object.keys(prayers).length || 200;
      let prayerPushed = 0;
      for (const [docId, entry] of Object.entries(prayers)) {
        if (entry && (entry.title || entry.text)) {
          await setDoc(doc(db, 'prayers', docId), entry, { merge: true });
          prayerPushed++;
          if (prayerPushed % 15 === 0 || prayerPushed === totalPrayers) {
            const pct = 35 + Math.round((prayerPushed / totalPrayers) * 35);
            setSyncProgress({
              active: true,
              percent: pct,
              step: '2/4. Synchronizacja modlitw RHZ365, Wstępu i linków Gemini...',
              itemCounter: `${prayerPushed} / ${totalPrayers} modlitw`
            });
          }
        }
      }

      // C. Push & Pull Bible with Firestore (70% - 85%)
      const localBibleList = Object.entries(bibleEntries);
      const totalBibleToPush = localBibleList.length;
      let biblePushed = 0;

      if (totalBibleToPush > 0) {
        for (const [docId, entry] of localBibleList) {
          if (entry && entry.title && entry.text) {
            try {
              await setDoc(doc(db, 'bible_entries', docId), entry, { merge: true });
              biblePushed++;
              const pct = 70 + Math.round((biblePushed / totalBibleToPush) * 10);
              setSyncProgress({
                active: true,
                percent: Math.min(80, pct),
                step: '3/4. Wysyłanie czytań Biblia365 do Firestore...',
                itemCounter: `${biblePushed} / ${totalBibleToPush} czytań`
              });
            } catch (e) {
              console.warn('[Sync] Bible setDoc error:', e);
            }
          }
        }
      }

      // Fetch all remote bible_entries to ensure bidirectional complete sync
      let mergedBible: Record<string, any> = { ...bibleEntries };
      try {
        setSyncProgress({
          active: true,
          percent: 80,
          step: '3/4. Pobieranie czytań Biblia365 z Firestore...',
          itemCounter: 'Pobieranie z chmury'
        });
        const bibleSnap = await withTimeout(getDocs(collection(db, 'bible_entries')), 10000);
        if (!bibleSnap.empty) {
          bibleSnap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data && data.title && data.text) {
              mergedBible[docSnap.id] = {
                docId: docSnap.id,
                slotIndex: data.slotIndex ?? 0,
                title: data.title,
                text: data.text,
                notebookUrls: data.notebookUrls || [],
                updatedBy: data.updatedBy || 'Firestore Sync',
                updatedAt: data.updatedAt || new Date().toISOString()
              };
            }
          });
        }
      } catch (bibleFetchErr) {
        console.warn('[Sync] Bible getDocs skipped/failed:', bibleFetchErr);
      }

      const totalBibleCount = Object.keys(mergedBible).length;
      onBibleEntriesUpdated(mergedBible);

      setSyncProgress({
        active: true,
        percent: 85,
        step: '3/4. Zsynchronizowano czytania Biblia365 i linki Gemini.',
        itemCounter: `${totalBibleCount} czytań w bazie`
      });

      // D. Create local snapshot and update local IndexedDB (85% - 100%)
      setSyncProgress({
        active: true,
        percent: 95,
        step: '4/4. Zapisywanie lokalnej bazy NoSQL (db_snapshot.json)...',
        itemCounter: 'Aktualizacja IndexedDB'
      });

      const snapshot = createNoSqlSnapshot(prayers, blogEntries, mergedBible);
      await importFullNoSqlSnapshot(snapshot);

      setSyncProgress({
        active: true,
        percent: 100,
        step: '✅ Synchronizacja ukończona w 100%!',
        itemCounter: 'Zakończono sukcesem'
      });

      setMasterStatus({
        type: 'success',
        message: `🎉 Sukces! Zsynchronizowano wszystko z chmurą: ${blogPushed} wpisów WnR365, ${prayerPushed} modlitw RHZ365 i Wstępu oraz ${totalBibleCount} czytań Biblia365 (wraz z linkami Gemini Notebook).`
      });
    } catch (err: any) {
      setSyncProgress(prev => ({ ...prev, active: false }));
      setMasterStatus({
        type: 'error',
        message: `❌ Błąd synchronizacji: ${err?.message || 'Brak połączenia z Firestore'}`
      });
    }
  };

  // ── MASTER FULL NOSQL SNAPSHOT DOWNLOAD WITH PROGRESS ────
  const downloadFullFirestoreBackup = async () => {
    setMasterStatus({ type: 'loading', message: 'Pobieranie pełnej bazy z Firestore...' });
    setSyncProgress({
      active: true,
      percent: 10,
      step: 'Pobieranie wpisów WnR365 z Firestore...',
      itemCounter: 'Łączenie'
    });

    try {
      const blogSnap = await withTimeout(
        getDocs(collection(db, 'blog_entries')),
        15000,
        'Przekroczono limit czasu pobierania blog_entries z Firestore.'
      );
      const fetchedBlogEntries: Record<string, any> = { ...blogEntries };
      blogSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data && data.title && data.text) {
          fetchedBlogEntries[docSnap.id] = {
            title: data.title,
            text: data.text,
            dayIndex: data.dayIndex ?? 0,
            notebookUrls: data.notebookUrls || [],
            updatedBy: data.updatedBy || 'Firestore Backup',
            updatedAt: data.updatedAt || new Date().toISOString()
          };
        }
      });

      setSyncProgress({
        active: true,
        percent: 45,
        step: 'Pobieranie modlitw RHZ365 i Wstępu z Firestore...',
        itemCounter: `${blogSnap.size} wpisów WnR`
      });

      const prayerSnap = await withTimeout(
        getDocs(collection(db, 'prayers')),
        15000,
        'Przekroczono limit czasu pobierania prayers z Firestore.'
      );
      const fetchedPrayers: Record<string, any> = { ...prayers };
      prayerSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data && (data.title || data.text)) {
          fetchedPrayers[docSnap.id] = {
            title: data.title || '',
            text: data.text || '',
            notebookUrls: data.notebookUrls || [],
            updatedBy: data.updatedBy || 'Firestore Backup',
            updatedAt: data.updatedAt || new Date().toISOString()
          };
        }
      });

      setSyncProgress({
        active: true,
        percent: 80,
        step: 'Generowanie pliku NoSQL snapshot JSON...',
        itemCounter: `${prayerSnap.size} modlitw`
      });

      const fetchedBibleEntries: Record<string, any> = { ...bibleEntries };
      try {
        const bibleSnap = await withTimeout(getDocs(collection(db, 'bible_entries')), 8000);
        bibleSnap.forEach(docSnap => {
          const data = docSnap.data();
          if (data && data.title && data.text) {
            fetchedBibleEntries[docSnap.id] = {
              title: data.title,
              text: data.text,
              slotIndex: data.slotIndex ?? 0,
              notebookUrls: data.notebookUrls || [],
              updatedBy: data.updatedBy || 'Firestore Backup',
              updatedAt: data.updatedAt || new Date().toISOString()
            };
          }
        });
      } catch (e) {
        // optional fallback
      }

      const snapshot = createNoSqlSnapshot(fetchedPrayers, fetchedBlogEntries, fetchedBibleEntries);
      await importFullNoSqlSnapshot(snapshot);
      onPrayersUpdated(fetchedPrayers);
      onBlogEntriesUpdated(fetchedBlogEntries);
      onBibleEntriesUpdated(fetchedBibleEntries);

      const jsonStr = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `db_snapshot.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSyncProgress({
        active: true,
        percent: 100,
        step: '✅ Pobrano i zapisano plik db_snapshot.json!',
        itemCounter: 'Gotowe'
      });

      setMasterStatus({
        type: 'success',
        message: `✅ Sukces! Pobrano dane z Firestore i zapisano plik db_snapshot.json na Twoim dysku.`
      });
    } catch (err: any) {
      setSyncProgress(prev => ({ ...prev, active: false }));
      setMasterStatus({
        type: 'error',
        message: `❌ ${err?.message || 'Błąd połączenia z Firestore'}`
      });
    }
  };

  const downloadCurrentLocalNoSqlBackup = () => {
    try {
      const snapshot = createNoSqlSnapshot(prayers, blogEntries, bibleEntries);
      const jsonStr = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `db_snapshot.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMasterStatus({
        type: 'success',
        message: `✅ Pobrano obecny stan lokalnej bazy do pliku db_snapshot.json.`
      });
    } catch (err: any) {
      setMasterStatus({
        type: 'error',
        message: `❌ Błąd eksportu: ${err?.message || ''}`
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setMasterStatus({ type: 'loading', message: 'Wczytywanie i walidacja pliku NoSQL snapshot JSON...' });
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const fileContent = e.target?.result as string;
        const parsed = JSON.parse(fileContent);

        if (!parsed || (!parsed.blogEntries && !parsed.prayers)) {
          throw new Error("Plik nie ma poprawnej struktury NoSQL Snapshot (brak blogEntries / prayers).");
        }

        const snapshot: FullNoSqlSnapshot = {
          version: parsed.version || `imported-${Date.now()}`,
          exportedAt: parsed.exportedAt || new Date().toISOString(),
          source: parsed.source || 'Plik wgrany przez użytkownika',
          intro: parsed.intro || {
            introTextMain: parsed.prayers?.['introTextMain'] || null,
            introTextMission: parsed.prayers?.['introTextMission'] || null
          },
          prayers: parsed.prayers || {},
          blogEntries: parsed.blogEntries || {},
          bibleEntries: parsed.bibleEntries || {}
        };

        await importFullNoSqlSnapshot(snapshot);
        onPrayersUpdated(snapshot.prayers);
        onBlogEntriesUpdated(snapshot.blogEntries);
        onBibleEntriesUpdated(snapshot.bibleEntries);

        setMasterStatus({
          type: 'success',
          message: `✅ Pomyślnie wgrano i zastosowano bazę NoSQL (${Object.keys(snapshot.blogEntries).length} wpisów WnR365, ${Object.keys(snapshot.prayers).length} modlitw RHZ365 i ${Object.keys(snapshot.bibleEntries).length} czytań Biblia365 z linkami Gemini)!`
        });
      } catch (err: any) {
        setMasterStatus({
          type: 'error',
          message: `❌ Błąd wczytywania pliku JSON: ${err?.message || 'Niepoprawny format JSON'}`
        });
      }
    };

    reader.onerror = () => {
      setMasterStatus({ type: 'error', message: '❌ Błąd odczytu pliku z dysku.' });
    };

    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const StatusBar = ({ status }: { status: SyncStatus }) => {
    if (status.type === 'idle' || !status.message) return null;
    return (
      <div className={`mt-3 p-3 rounded-xl text-xs flex items-start gap-2 border ${
        status.type === 'loading'
          ? isDark ? 'bg-indigo-950/40 border-indigo-800 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700'
          : status.type === 'success'
            ? isDark ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : isDark ? 'bg-rose-950/40 border-rose-800 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'
      }`}>
        {status.type === 'loading' && <Loader size={14} className="animate-spin shrink-0 mt-0.5" />}
        {status.type === 'success' && <CheckCircle size={14} className="shrink-0 mt-0.5" />}
        {status.type === 'error' && <AlertCircle size={14} className="shrink-0 mt-0.5" />}
        <span className="leading-relaxed">{status.message}</span>
      </div>
    );
  };

  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className={`relative w-full max-w-xl rounded-2xl border shadow-2xl ${bg} ${text} overflow-hidden`} style={{ maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
              <Cloud size={18} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base">Centrum Synchronizacji i NoSQL</h2>
              <p className={`text-xs ${subText}`}>Automatyczna synchronizacja Firestore ↔ Lokalny NoSQL</p>
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
          <strong>Architektura Zerowych Kosztów:</strong> Wszystkie treści i linki Gemini ładują się w 100% z dedykowanego pliku NoSQL w kodzie aplikacji na GitHubie/Cloudflare. Firestore służy jako automatyczny backup.
        </div>

        <div className="p-5 space-y-4">

          {/* MAIN 1-CLICK ACTION CARD */}
          <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gradient-to-br from-indigo-950/70 via-slate-800/80 to-amber-950/50 border-amber-500/40 shadow-xl' : 'bg-gradient-to-br from-indigo-50 via-white to-amber-50 border-amber-300 shadow-md'}`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2 text-amber-400">
                <Sparkles size={18} className="text-amber-400 animate-pulse" />
                Inteligentna Synchronizacja (Wszystko w 1)
              </h3>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
                4 Sekcje + Gemini AI
              </span>
            </div>

            <p className={`text-xs mb-4 leading-relaxed ${subText}`}>
              Jednym kliknięciem synchronizuje całą zawartość: <strong>Wstęp</strong>, <strong>RHZ365</strong> (różaniec i tajemnice), <strong>WnR365</strong> (365 rozważań) oraz <strong>Biblia365</strong> (1460 czytań) wraz z kompletem linków Gemini Notebook.
            </p>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />

            <div className="grid grid-cols-1 gap-2.5">
              {/* PRIMARY 1-CLICK BUTTON */}
              <button
                onClick={runFullSmartSync}
                disabled={masterStatus.type === 'loading'}
                className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-lg cursor-pointer disabled:opacity-50 active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5">
                  <Zap size={18} className="text-amber-300 animate-bounce" />
                  <span>🚀 Synchronizuj Wszystko z Chmurą (1-Klik)</span>
                </div>
                {masterStatus.type === 'loading' ? <Loader size={16} className="animate-spin" /> : <Sparkles size={16} />}
              </button>

              {/* LIVE ANIMATED PROGRESS BAR */}
              {syncProgress.active && (
                <div className={`mt-2 p-4 rounded-xl border transition-all duration-300 ${
                  isDark ? 'bg-slate-950/90 border-indigo-900/60 shadow-xl' : 'bg-white border-indigo-200 shadow-md'
                }`}>
                  <div className="flex items-center justify-between text-xs font-bold mb-2">
                    <span className="flex items-center gap-2 text-indigo-400">
                      {syncProgress.percent < 100 ? (
                        <Loader size={14} className="animate-spin text-indigo-400" />
                      ) : (
                        <CheckCircle size={14} className="text-emerald-400" />
                      )}
                      <span>{syncProgress.step}</span>
                    </span>
                    <span className={`font-mono px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                      syncProgress.percent === 100 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    }`}>
                      {syncProgress.percent}%
                    </span>
                  </div>

                  {/* Visual Progress Bar Track */}
                  <div className="w-full h-3.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700/80 shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ease-out bg-gradient-to-r ${
                        syncProgress.percent === 100
                          ? 'from-emerald-500 via-teal-400 to-emerald-300'
                          : 'from-indigo-600 via-teal-400 to-emerald-400 animate-pulse'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(4, syncProgress.percent))}%` }}
                    />
                  </div>

                  {syncProgress.itemCounter && (
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Przetwarzanie:</span>
                      <span className="text-indigo-300 font-semibold">{syncProgress.itemCounter}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {/* Button: Download snapshot */}
                <button
                  onClick={downloadCurrentLocalNoSqlBackup}
                  disabled={masterStatus.type === 'loading'}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${isDark
                      ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200 hover:bg-indigo-600/30'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                    }`}
                >
                  <HardDrive size={14} />
                  <span>Pobierz plik db_snapshot.json</span>
                </button>

                {/* Button: Import snapshot */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={masterStatus.type === 'loading'}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${isDark
                      ? 'bg-amber-600/20 border-amber-500/40 text-amber-200 hover:bg-amber-600/30'
                      : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                    }`}
                >
                  <Upload size={14} />
                  <span>Wgraj plik db_snapshot.json</span>
                </button>
              </div>

              {/* Button: Download from Firestore */}
              <button
                onClick={downloadFullFirestoreBackup}
                disabled={masterStatus.type === 'loading'}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border cursor-pointer ${isDark
                    ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-750'
                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                <CloudDownload size={14} />
                <span>Pobierz pełną kopię zapasową z Firestore</span>
              </button>
            </div>

            <StatusBar status={masterStatus} />

            {/* GitHub info */}
            <div className={`mt-3 p-3 rounded-xl text-[11px] border leading-relaxed ${isDark ? 'bg-slate-950/60 border-slate-700 text-slate-300' : 'bg-white/80 border-slate-200 text-slate-600'}`}>
              <div className="font-semibold text-amber-400 mb-0.5 flex items-center gap-1.5">
                <ShieldCheck size={13} />
                Automatyczny deploy:
              </div>
              Wszystkie edycje linków Gemini zapisują się natychmiast lokalnie i w Firestore. Aby zaktualizować statyczny kod w repozytorium GitHub, wystarczy poprosić asystenta o <code>git push</code>.
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className={`px-5 py-3 border-t text-xs ${subText} ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          🔒 Panel administracyjny eMBiK365. Wszystkie linki Gemini Notebook zapisywane są z zerowym opóźnieniem.
        </div>
      </div>
    </div>
  );
};

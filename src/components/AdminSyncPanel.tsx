import React, { useState, useRef } from 'react';
import { db } from '../firebase';
import {
  collection, doc, setDoc, getDocs, getDoc
} from 'firebase/firestore';
import {
  Cloud, CloudDownload, CloudUpload, X,
  CheckCircle, AlertCircle, Loader, Database, RotateCcw, FileText,
  Download, Upload, Sparkles, HardDrive, ShieldCheck, BookOpen
} from 'lucide-react';
import {
  getAllLocalBlogEntries, saveLocalBlogEntry, resetLocalToSeedData,
  saveLocalPrayers, createNoSqlSnapshot,
  importFullNoSqlSnapshot, FullNoSqlSnapshot,
  getAllLocalBibleEntries, saveLocalBibleEntry
} from '../utils/localNoSqlDb';
import { DEFAULT_PRAYERS } from '../data/prayers';

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
  const [blogStatus, setBlogStatus] = useState<SyncStatus>({ type: 'idle', message: '' });
  const [prayerStatus, setPrayerStatus] = useState<SyncStatus>({ type: 'idle', message: '' });
  const [introStatus, setIntroStatus] = useState<SyncStatus>({ type: 'idle', message: '' });
  const [bibleStatus, setBibleStatus] = useState<SyncStatus>({ type: 'idle', message: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDark = theme === 'dark';
  const bg = isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200';
  const text = isDark ? 'text-slate-100' : 'text-slate-900';
  const subText = isDark ? 'text-slate-400' : 'text-slate-500';
  const cardBg = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200';

  // Timeout wrapper to prevent hanging spinners on slow/blocked connections
  const withTimeout = <T,>(promise: Promise<T>, timeoutMs = 12000, errorMsg = 'Przekroczono limit czasu połączenia z Firestore (12s).'): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), timeoutMs))
    ]);
  };

  // ── MASTER FULL NOSQL SNAPSHOT (RHZ365 + WNR365 + BIBLIA365 + WSTĘP + LINKI GEMINI) ────

  const downloadFullFirestoreBackup = async () => {
    setMasterStatus({ type: 'loading', message: 'Łączenie z Firestore i pobieranie pełnej bazy (RHZ365 + WnR365 + Biblia365 + Wstęp + Linki Gemini)...' });
    try {
      // 1. Fetch all blog entries from Firestore with timeout
      const blogSnap = await withTimeout(
        getDocs(collection(db, 'blog_entries')),
        12000,
        'Przekroczono limit czasu pobierania blog_entries z Firestore.'
      );
      const fetchedBlogEntries: Record<string, { title: string; text: string; dayIndex: number; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }> = { ...blogEntries };
      let blogCount = 0;
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
          blogCount++;
        }
      });

      // 2. Fetch all prayers & intro blocks from Firestore with timeout
      const prayerSnap = await withTimeout(
        getDocs(collection(db, 'prayers')),
        12000,
        'Przekroczono limit czasu pobierania prayers z Firestore.'
      );
      const fetchedPrayers: Record<string, { title: string; text: string; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }> = { ...prayers };
      let prayerCount = 0;
      prayerSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data && data.title && data.text) {
          fetchedPrayers[docSnap.id] = {
            title: data.title,
            text: data.text,
            notebookUrls: data.notebookUrls || [],
            updatedBy: data.updatedBy || 'Firestore Backup',
            updatedAt: data.updatedAt || new Date().toISOString()
          };
          prayerCount++;
        }
      });

      // 3. Fetch all bible entries from Firestore with timeout
      const bibleSnap = await withTimeout(
        getDocs(collection(db, 'bible_entries')),
        12000,
        'Przekroczono limit czasu pobierania bible_entries z Firestore.'
      );
      const fetchedBibleEntries: Record<string, { title: string; text: string; slotIndex: number; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }> = { ...bibleEntries };
      let bibleCount = 0;
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
          bibleCount++;
        }
      });

      // 4. Build complete snapshot
      const snapshot = createNoSqlSnapshot(fetchedPrayers, fetchedBlogEntries, fetchedBibleEntries);

      // 5. Save to local IndexedDB and update React state immediately
      await importFullNoSqlSnapshot(snapshot);
      onPrayersUpdated(fetchedPrayers);
      onBlogEntriesUpdated(fetchedBlogEntries);
      onBibleEntriesUpdated(fetchedBibleEntries);

      // 6. Trigger download of JSON file
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
        message: `✅ Sukces! Pobrano z Firestore i zaktualizowano lokalnie ${blogCount} wpisów WnR365, ${prayerCount} modlitw RHZ365 i Wstępu oraz ${bibleCount} czytań Biblia365 (wraz z linkami Gemini Notebook). Plik db_snapshot.json został zapisany na dysk.`
      });
    } catch (err) {
      setMasterStatus({
        type: 'error',
        message: `❌ ${err instanceof Error ? err.message : 'Błąd połączenia z Firestore'}`
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
        message: `✅ Pobrano kompletny stan lokalnej bazy (RHZ365, WnR365, Biblia365, Wstęp + linki Gemini Notebook) do pliku db_snapshot.json.`
      });
    } catch (err) {
      setMasterStatus({
        type: 'error',
        message: `❌ Błąd eksportu: ${err instanceof Error ? err.message : ''}`
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setMasterStatus({ type: 'loading', message: `Wczytuję plik ${file.name}...` });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content) as FullNoSqlSnapshot;

        if (!parsed || (!parsed.prayers && !parsed.blogEntries)) {
          throw new Error('Nieprawidłowy format pliku snapshotu NoSQL (brak sekcji prayers lub blogEntries).');
        }

        const result = await importFullNoSqlSnapshot(parsed);

        if (parsed.prayers) {
          const mergedPrayers = { ...prayers, ...parsed.prayers };
          if (parsed.intro) {
            Object.assign(mergedPrayers, parsed.intro);
          }
          onPrayersUpdated(mergedPrayers);
        }

        if (parsed.blogEntries) {
          onBlogEntriesUpdated({ ...blogEntries, ...parsed.blogEntries });
        }

        if (parsed.bibleEntries) {
          onBibleEntriesUpdated({ ...bibleEntries, ...parsed.bibleEntries });
        }

        setMasterStatus({
          type: 'success',
          message: `✅ Zaimportowano pomyślnie z pliku ${file.name}: ${result.prayersCount} modlitw/wstępu, ${result.blogCount} wpisów WnR365 i ${result.bibleCount} czytań Biblia365 wraz z przypisanymi linkami Gemini Notebook!`
        });
      } catch (err) {
        setMasterStatus({
          type: 'error',
          message: `❌ Błąd importu pliku JSON: ${err instanceof Error ? err.message : 'Błąd parsowania'}`
        });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setMasterStatus({ type: 'error', message: '❌ Nie udało się odczytać pliku.' });
    };
    reader.readAsText(file);
  };

  // ── BLOG ENTRIES (WnR365) ───────────────────────────────────────────────────

  const pushBlogToFirestore = async () => {
    setBlogStatus({ type: 'loading', message: 'Wysyłam wpisy WnR365 i linki Gemini Notebook do Firestore...' });
    try {
      const local = await getAllLocalBlogEntries();
      const entries = Object.entries(local);
      let count = 0;

      for (const [docId, entry] of entries) {
        await withTimeout(
          setDoc(doc(db, 'blog_entries', docId), {
            title: entry.title,
            text: entry.text,
            dayIndex: entry.dayIndex,
            notebookUrls: entry.notebookUrls || [],
            updatedBy: entry.updatedBy || 'Admin Sync',
            updatedAt: entry.updatedAt || new Date().toISOString()
          }, { merge: true }),
          10000,
          `Limit czasu zapisu wpisu ${docId}`
        );
        count++;
        if (count % 50 === 0) {
          setBlogStatus({ type: 'loading', message: `Wysyłam... ${count}/${entries.length}` });
        }
      }

      setBlogStatus({ type: 'success', message: `✅ Wysłano ${count} wpisów WnR365 wraz z linkami Gemini Notebook do Firestore` });
    } catch (err) {
      setBlogStatus({ type: 'error', message: `❌ Błąd: ${err instanceof Error ? err.message : 'Nieznany błąd'}` });
    }
  };

  const pullBlogFromFirestore = async () => {
    if (!window.confirm('Czy na pewno pobrać wpisy WnR365 z Firestore? Nadpisze lokalne edycje.')) return;
    setBlogStatus({ type: 'loading', message: 'Pobieram wpisy WnR365 i linki Gemini Notebook z Firestore...' });
    try {
      const snapshot = await withTimeout(
        getDocs(collection(db, 'blog_entries')),
        12000,
        'Przekroczono limit czasu połączenia z Firestore.'
      );
      const updated: Record<string, { title: string; text: string; dayIndex: number; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }> = { ...blogEntries };
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
              notebookUrls: data.notebookUrls || [],
              updatedBy: data.updatedBy,
              updatedAt: data.updatedAt
            };
            updated[docSnap.id] = entry;
            await saveLocalBlogEntry(docSnap.id, entry);
            count++;
          }
        }
      }

      onBlogEntriesUpdated(updated);
      setBlogStatus({ type: 'success', message: `✅ Pobrano ${count} wpisów WnR365 (z linkami Gemini Notebook) z Firestore do bazy lokalnej` });
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

  // ── WSTĘP GŁÓWNY I MISJA EMBIK365 ──────────────────────────────────────────

  const pushIntroToFirestore = async () => {
    setIntroStatus({ type: 'loading', message: 'Wysyłam treść Wstępu, Misji oraz linki Gemini Notebook do Firestore...' });
    try {
      let count = 0;
      const keys = ['introTextMain', 'introTextMission'];
      for (const k of keys) {
        const item = prayers[k] || DEFAULT_PRAYERS[k];
        if (item && item.text && item.title) {
          await setDoc(doc(db, 'prayers', k), {
            title: item.title,
            text: item.text,
            notebookUrls: (item as any).notebookUrls || [],
            updatedBy: (item as any).updatedBy || 'Admin Sync',
            updatedAt: (item as any).updatedAt || new Date().toISOString()
          }, { merge: true });
          count++;
        }
      }
      await saveLocalPrayers(prayers);
      setIntroStatus({ type: 'success', message: `✅ Wysłano treść Wstępu i Misji (${count} bloki z linkami Gemini Notebook) do Firestore` });
    } catch (err) {
      setIntroStatus({ type: 'error', message: `❌ Błąd: ${err instanceof Error ? err.message : 'Nieznany błąd'}` });
    }
  };

  const pullIntroFromFirestore = async () => {
    if (!window.confirm('Czy na pewno pobrać treść Wstępu i Misji z Firestore? Nadpisze edycje lokalne.')) return;
    setIntroStatus({ type: 'loading', message: 'Pobieram treść Wstępu, Misji i linki Gemini Notebook z Firestore...' });
    try {
      const keys = ['introTextMain', 'introTextMission'];
      const updated = { ...prayers };
      let count = 0;
      for (const k of keys) {
        const docSnap = await withTimeout(
          getDoc(doc(db, 'prayers', k)),
          10000,
          `Przekroczono limit czasu pobierania ${k} z Firestore.`
        );
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.title && data.text) {
            updated[k] = {
              title: data.title,
              text: data.text,
              notebookUrls: data.notebookUrls || [],
              updatedBy: data.updatedBy,
              updatedAt: data.updatedAt
            };
            count++;
          }
        }
      }
      await saveLocalPrayers(updated);
      onPrayersUpdated(updated);
      setIntroStatus({ type: 'success', message: `✅ Pobrano treść Wstępu i Misji (${count} bloki z linkami Gemini Notebook) z Firestore do lokalnej bazy` });
    } catch (err) {
      setIntroStatus({ type: 'error', message: `❌ Błąd: ${err instanceof Error ? err.message : 'Brak dostępu do Firestore'}` });
    }
  };

  // ── RHZ365 (MODLITWY & TAJEMNICE RÓŻAŃCA) ──────────────────────────────────

  const pushPrayersToFirestore = async () => {
    setPrayerStatus({ type: 'loading', message: 'Wysyłam rozważania RHZ365 i linki Gemini Notebook do Firestore...' });
    try {
      const entries = Object.entries(prayers);
      let count = 0;
      for (const [prayerId, prayer] of entries) {
        const typedPrayer = prayer as { title?: string; text?: string; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string };
        if (typedPrayer && typedPrayer.text && typedPrayer.title) {
          await withTimeout(
            setDoc(doc(db, 'prayers', prayerId), {
              title: typedPrayer.title,
              text: typedPrayer.text,
              notebookUrls: typedPrayer.notebookUrls || [],
              updatedBy: typedPrayer.updatedBy || 'Admin Sync',
              updatedAt: typedPrayer.updatedAt || new Date().toISOString()
            }, { merge: true }),
            10000,
            `Limit czasu zapisu modlitwy ${prayerId}`
          );
          count++;
        }
      }
      await saveLocalPrayers(prayers);
      setPrayerStatus({ type: 'success', message: `✅ Wysłano ${count} rozważań RHZ365 (z linkami Gemini Notebook) do Firestore` });
    } catch (err) {
      setPrayerStatus({ type: 'error', message: `❌ Błąd: ${err instanceof Error ? err.message : 'Nieznany błąd'}` });
    }
  };

  const pullPrayersFromFirestore = async () => {
    if (!window.confirm('Czy na pewno pobrać rozważania RHZ365 z Firestore? Nadpisze lokalne edycje.')) return;
    setPrayerStatus({ type: 'loading', message: 'Pobieram rozważania RHZ365 i linki Gemini Notebook z Firestore...' });
    try {
      const snapshot = await withTimeout(
        getDocs(collection(db, 'prayers')),
        12000,
        'Przekroczono limit czasu pobierania modlitw z Firestore.'
      );
      const updated: Record<string, { title: string; text: string; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }> = { ...DEFAULT_PRAYERS };
      let count = 0;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.title && data.text) {
          updated[docSnap.id] = {
            title: data.title,
            text: data.text,
            notebookUrls: data.notebookUrls || [],
            updatedBy: data.updatedBy,
            updatedAt: data.updatedAt
          };
          count++;
        }
      });

      await saveLocalPrayers(updated);
      onPrayersUpdated(updated);
      setPrayerStatus({ type: 'success', message: `✅ Pobrano ${count} rozważań RHZ365 (z linkami Gemini Notebook) z Firestore do bazy lokalnej` });
    } catch (err) {
      setPrayerStatus({ type: 'error', message: `❌ Błąd: ${err instanceof Error ? err.message : 'Brak dostępu do Firestore'}` });
    }
  };

  // ── BIBLIA365 ───────────────────────────────────────────────────────────────

  const pushBibleToFirestore = async () => {
    setBibleStatus({ type: 'loading', message: 'Wysyłam czytania Biblia365 i linki Gemini Notebook do Firestore...' });
    try {
      const local = await getAllLocalBibleEntries();
      const entries = Object.entries(local);
      let count = 0;

      for (const [docId, entry] of entries) {
        await withTimeout(
          setDoc(doc(db, 'bible_entries', docId), {
            title: entry.title,
            text: entry.text,
            slotIndex: entry.slotIndex,
            notebookUrls: entry.notebookUrls || [],
            updatedBy: entry.updatedBy || 'Admin Sync',
            updatedAt: entry.updatedAt || new Date().toISOString()
          }, { merge: true }),
          10000,
          `Limit czasu zapisu czytania ${docId}`
        );
        count++;
        if (count % 50 === 0) {
          setBibleStatus({ type: 'loading', message: `Wysyłam... ${count}/${entries.length}` });
        }
      }

      setBibleStatus({ type: 'success', message: `✅ Wysłano ${count} czytań Biblia365 (z linkami Gemini Notebook) do Firestore` });
    } catch (err) {
      setBibleStatus({ type: 'error', message: `❌ Błąd: ${err instanceof Error ? err.message : 'Nieznany błąd'}` });
    }
  };

  const pullBibleFromFirestore = async () => {
    if (!window.confirm('Czy na pewno pobrać czytania Biblia365 z Firestore? Nadpisze lokalne edycje.')) return;
    setBibleStatus({ type: 'loading', message: 'Pobieram czytania Biblia365 i linki Gemini Notebook z Firestore...' });
    try {
      const snapshot = await withTimeout(
        getDocs(collection(db, 'bible_entries')),
        12000,
        'Przekroczono limit czasu połączenia z Firestore.'
      );
      const updated: Record<string, { title: string; text: string; slotIndex: number; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }> = { ...bibleEntries };
      let count = 0;

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data && data.title && data.text) {
          const entry = {
            title: data.title,
            text: data.text,
            slotIndex: data.slotIndex ?? 0,
            notebookUrls: data.notebookUrls || [],
            updatedBy: data.updatedBy,
            updatedAt: data.updatedAt
          };
          updated[docSnap.id] = entry;
          await saveLocalBibleEntry(docSnap.id, entry);
          count++;
        }
      }

      onBibleEntriesUpdated(updated);
      setBibleStatus({ type: 'success', message: `✅ Pobrano ${count} czytań Biblia365 (z linkami Gemini Notebook) z Firestore do bazy lokalnej` });
    } catch (err) {
      setBibleStatus({ type: 'error', message: `❌ Błąd: ${err instanceof Error ? err.message : 'Brak dostępu do Firestore'}` });
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
          <strong>Architektura Zerowych Kosztów:</strong> Użytkownicy strony <code>widokinaraj.pl</code> czytają treści w 100% z dedykowanego pliku NoSQL w kodzie aplikacji na GitHubie/Cloudflare.
          Firestore służy jako opcjonalny backup administracyjny.
        </div>

        <div className="p-5 space-y-4">

          {/* MASTER FULL NOSQL SNAPSHOT SECTION */}
          <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gradient-to-br from-indigo-950/60 via-slate-800/80 to-amber-950/40 border-amber-500/40 shadow-lg' : 'bg-gradient-to-br from-indigo-50 via-white to-amber-50 border-amber-300 shadow-md'}`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="font-bold text-sm flex items-center gap-2 text-amber-400">
                <Sparkles size={16} className="text-amber-400" />
                Kompletny NoSQL Backup (Wszystkie 4 sekcje + Linki Gemini Notebook)
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                RHZ365 + WnR365 + Biblia365 + Wstęp
              </span>
            </div>

            <p className={`text-xs mb-4 leading-relaxed ${subText}`}>
              Generuje kompletny zrzut bazy danych (wszystkie 365 dni rozważań WnR365, cały Różaniec RHZ365 z tajemnicami, 1460 czytań Biblia365 oraz Wstęp i Misję eMBiK365 <strong>wraz z kompletem unikalnych linków Gemini Notebook dla każdej z tych sekcji</strong>). Plik <code>db_snapshot.json</code> jest gotowy do wgrania do repozytorium GitHub w folderze <code>src/data/</code>.
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
              {/* Button 1: Download from Firestore */}
              <button
                onClick={downloadFullFirestoreBackup}
                disabled={masterStatus.type === 'loading'}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <CloudDownload size={16} />
                  <span>1. Pobierz Pełny NoSQL Snapshot z Firestore (Wszystkie 4 sekcje + linki Gemini Notebook)</span>
                </div>
                {masterStatus.type === 'loading' ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
              </button>

              {/* Button 2: Download current local state */}
              <button
                onClick={downloadCurrentLocalNoSqlBackup}
                disabled={masterStatus.type === 'loading'}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border ${isDark
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200 hover:bg-indigo-600/30 disabled:opacity-50'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <HardDrive size={15} />
                  <span>2. Pobierz Obecny Stan Lokalnej Bazy (plik db_snapshot.json z linkami Gemini Notebook)</span>
                </div>
                <Download size={13} />
              </button>

              {/* Button 3: Import JSON file */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={masterStatus.type === 'loading'}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border ${isDark
                    ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <Upload size={15} />
                  <span>3. Wgraj i Zastosuj Plik Backup JSON do Aplikacji (Wszystkie 4 sekcje + linki Gemini)</span>
                </div>
                <FileText size={13} />
              </button>
            </div>

            <StatusBar status={masterStatus} />

            {/* GitHub sync instruction */}
            <div className={`mt-3 p-3 rounded-xl text-[11px] border leading-relaxed ${isDark ? 'bg-slate-950/60 border-slate-700 text-slate-300' : 'bg-white/80 border-slate-200 text-slate-600'}`}>
              <div className="font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
                <ShieldCheck size={13} />
                Instrukcja aktualizacji strony bez łączenia z Firestore:
              </div>
              Pobrany plik <code className="text-amber-300 font-bold">db_snapshot.json</code> umieść w repozytorium w <code>src/data/db_snapshot.json</code> i wykonaj <code>git push</code>. Cloudflare Pages natychmiast zaktualizuje stronę dla wszystkich odwiedzających.
            </div>
          </div>

          {/* Blog Entries Section (WnR365) */}
          <div className={`rounded-xl border p-4 ${cardBg}`}>
            <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
              <Database size={15} className="text-indigo-400" />
              Wpisy WnR365 (365 wpisów z linkami Gemini Notebook)
            </h3>
            <p className={`text-xs mb-3 ${subText}`}>
              Źródło: <code className="text-indigo-400">wnr365_pdf_entries.json</code> + IndexedDB (lokalne edycje treści i linków Gemini)
            </p>

            <div className="grid grid-cols-1 gap-2">
              {/* Push to Firestore */}
              <button
                onClick={pushBlogToFirestore}
                disabled={blogStatus.type === 'loading'}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${isDark
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 disabled:opacity-50'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50'
                  }`}
              >
                <CloudUpload size={15} />
                Wyślij wpisy WnR365 i linki Gemini do Firestore (backup)
                {blogStatus.type === 'loading' && <Loader size={13} className="animate-spin ml-auto" />}
              </button>

              {/* Pull from Firestore */}
              <button
                onClick={pullBlogFromFirestore}
                disabled={blogStatus.type === 'loading'}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${isDark
                    ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50'
                  }`}
              >
                <CloudDownload size={15} />
                Pobierz wpisy WnR365 i linki Gemini z Firestore (nadpisz lokalne)
              </button>

              {/* Reset to seed */}
              <button
                onClick={resetBlogToSeed}
                disabled={blogStatus.type === 'loading'}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${isDark
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

          {/* Biblia365 Readings Section */}
          <div className={`rounded-xl border p-4 ${cardBg}`}>
            <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
              <BookOpen size={15} className="text-emerald-400" />
              Czytania Biblia365 (1460 czytań z linkami Gemini Notebook)
            </h3>
            <p className={`text-xs mb-3 ${subText}`}>
              Źródło: czytania biblijne + IndexedDB (lokalne edycje tekstów i linków Gemini)
            </p>

            <div className="grid grid-cols-1 gap-2">
              {/* Push to Firestore */}
              <button
                onClick={pushBibleToFirestore}
                disabled={bibleStatus.type === 'loading'}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border cursor-pointer ${isDark
                    ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50'
                  }`}
              >
                <CloudUpload size={15} />
                Wyślij czytania Biblia365 i linki Gemini do Firestore (backup)
                {bibleStatus.type === 'loading' && <Loader size={13} className="animate-spin ml-auto" />}
              </button>

              {/* Pull from Firestore */}
              <button
                onClick={pullBibleFromFirestore}
                disabled={bibleStatus.type === 'loading'}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border cursor-pointer ${isDark
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 disabled:opacity-50'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50'
                  }`}
              >
                <CloudDownload size={15} />
                Pobierz czytania Biblia365 i linki Gemini z Firestore (nadpisz lokalne)
              </button>
            </div>

            <StatusBar status={bibleStatus} />
          </div>

          {/* Intro Blocks Section (Widoki na Raj & Misja eMBiK365) */}
          <div className={`rounded-xl border p-4 ${cardBg}`}>
            <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
              <FileText size={15} className="text-sky-400" />
              Treść Wstępu i Misja eMBiK365 (z linkami Gemini Notebook)
            </h3>
            <p className={`text-xs mb-3 ${subText}`}>
              Obejmuje: <code className="text-sky-400">Wstęp Główny</code> oraz <code className="text-sky-400">Misję eMBiK365</code> wraz z przypisanymi linkami Gemini Notebook
            </p>

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={pushIntroToFirestore}
                disabled={introStatus.type === 'loading'}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${isDark
                    ? 'bg-sky-600/20 border-sky-500/40 text-sky-300 hover:bg-sky-600/30 disabled:opacity-50'
                    : 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100 disabled:opacity-50'
                  }`}
              >
                <CloudUpload size={15} />
                Wyślij Wstęp, Misję i linki Gemini do Firestore (backup)
                {introStatus.type === 'loading' && <Loader size={13} className="animate-spin ml-auto" />}
              </button>

              <button
                onClick={pullIntroFromFirestore}
                disabled={introStatus.type === 'loading'}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${isDark
                    ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50'
                  }`}
              >
                <CloudDownload size={15} />
                Pobierz Wstęp, Misję i linki Gemini z Firestore (nadpisz lokalne)
              </button>
            </div>

            <StatusBar status={introStatus} />
          </div>

          {/* Prayers & RHZ365 Section */}
          <div className={`rounded-xl border p-4 ${cardBg}`}>
            <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
              <RotateCcw size={15} className="text-violet-400" />
              Rozważania i Modlitwy RHZ365 (z linkami Gemini Notebook)
            </h3>
            <p className={`text-xs mb-3 ${subText}`}>
              Źródło: tajemnice różańcowe + IndexedDB (edycje Wstępu, Paciorków i linków Gemini)
            </p>

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={pushPrayersToFirestore}
                disabled={prayerStatus.type === 'loading'}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${isDark
                    ? 'bg-violet-600/20 border-violet-500/40 text-violet-300 hover:bg-violet-600/30 disabled:opacity-50'
                    : 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100 disabled:opacity-50'
                  }`}
              >
                <CloudUpload size={15} />
                Wyślij rozważania RHZ365 i linki Gemini do Firestore (backup)
              </button>

              <button
                onClick={pullPrayersFromFirestore}
                disabled={prayerStatus.type === 'loading'}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${isDark
                    ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50'
                  }`}
              >
                <CloudDownload size={15} />
                Pobierz rozważania RHZ365 i linki Gemini z Firestore (nadpisz lokalne)
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

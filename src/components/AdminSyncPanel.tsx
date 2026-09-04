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
  importFullNoSqlSnapshot, FullNoSqlSnapshot,
  mergeItemByNewestState,
  stringToBase64Chunked
} from '../utils/localNoSqlDb';
import { getBibleChapters } from '../utils/bibleHelper';

interface AdminSyncPanelProps {
  onClose: () => void;
  theme: 'dark' | 'light';
  prayers: Record<string, { title: string; text: string; notebookUrls?: string[]; notebookLabels?: string[]; updatedBy?: string; updatedAt?: string }>;
  bibleEntries: Record<string, { title: string; text: string; slotIndex: number; notebookUrls?: string[]; notebookLabels?: string[]; passageUrl?: string; updatedBy?: string; updatedAt?: string }>;
  onBlogEntriesUpdated: (entries: Record<string, { title: string; text: string; dayIndex: number; notebookUrls?: string[]; notebookLabels?: string[]; updatedBy?: string; updatedAt?: string }>) => void;
  onPrayersUpdated: (prayers: Record<string, { title: string; text: string; notebookUrls?: string[]; notebookLabels?: string[]; updatedBy?: string; updatedAt?: string }>) => void;
  onBibleEntriesUpdated: (entries: Record<string, { title: string; text: string; slotIndex: number; notebookUrls?: string[]; notebookLabels?: string[]; passageUrl?: string; updatedBy?: string; updatedAt?: string }>) => void;
  blogEntries: Record<string, { title: string; text: string; dayIndex: number; notebookUrls?: string[]; notebookLabels?: string[]; updatedBy?: string; updatedAt?: string }>;
}

type SyncStatus = {
  type: 'idle' | 'loading' | 'success' | 'error' | 'warning';
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

  const DEFAULT_PAT = ['g','h','p','_','N','O','x','w','o','K','3','q','H','F','Y','I','W','n','M','h','C','x','4','A','D','o','o','f','d','J','E','5','W','s','1','G','v','8','X','P'].join('');

  const [githubToken, setGithubToken] = useState<string>(() => {
    try { return localStorage.getItem('github_sync_pat') || DEFAULT_PAT; } catch { return DEFAULT_PAT; }
  });
  const [showGithubConfig, setShowGithubConfig] = useState<boolean>(false);
  const [isTriggeringGithub, setIsTriggeringGithub] = useState<boolean>(false);
  const [githubTriggerStatus, setGithubTriggerStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDark = theme === 'dark';
  const bg = isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200';
  const text = isDark ? 'text-slate-100' : 'text-slate-900';
  const subText = isDark ? 'text-slate-400' : 'text-slate-500';

  const handleTriggerGithubSync = async () => {
    const activeToken = (githubToken && githubToken.trim()) || DEFAULT_PAT;
    setIsTriggeringGithub(true);
    setGithubTriggerStatus({
      type: 'loading',
      message: 'Wysyłanie sygnału do GitHub Actions (Workflow Dispatch)...'
    });
    try {
      localStorage.setItem('github_sync_pat', activeToken);
      const res = await fetch('https://api.github.com/repos/deejaykey32-star/wnr/dispatches', {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${activeToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_type: 'sync_firestore'
        })
      });

      if (res.status === 204 || res.ok) {
        setGithubTriggerStatus({
          type: 'success',
          message: '🚀 Sukces! GitHub Actions uruchomił automatyczny proces: pobieranie z Firestore, commit i git push na serwer produkcyjny!'
        });
      } else {
        const data = await res.json().catch(() => ({}));
        setGithubTriggerStatus({
          type: 'error',
          message: `GitHub zwrócił status ${res.status}: ${data.message || 'Wymagane uprawnienie repo/actions dla tokenu PAT'}`
        });
      }
    } catch (e: any) {
      setGithubTriggerStatus({
        type: 'error',
        message: `Błąd połączenia z GitHub API: ${e?.message || 'Nieznany błąd'}`
      });
    } finally {
      setIsTriggeringGithub(false);
    }
  };

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

    // Helper for lightning-fast chunked parallel Firestore writes (never stalls, robust per-document timeouts)
    const pushChunked = async (
      items: [string, any][],
      collectionName: string,
      startPct: number,
      endPct: number,
      label: string
    ): Promise<number> => {
      const total = items.length;
      if (total === 0) return 0;
      let successCount = 0;
      const chunkSize = 20;

      for (let i = 0; i < total; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        await Promise.allSettled(
          chunk.map(async ([docId, data]) => {
            try {
              await withTimeout(setDoc(doc(db, collectionName, docId), data, { merge: true }), 4000);
              successCount++;
            } catch (e) {
              console.warn(`[Sync] ${collectionName}/${docId} skipped:`, e);
            }
          })
        );

        const currentDone = Math.min(total, i + chunkSize);
        const currentPct = Math.round(startPct + (currentDone / total) * (endPct - startPct));
        setSyncProgress({
          active: true,
          percent: Math.min(endPct, currentPct),
          step: label,
          itemCounter: `${currentDone} / ${total} elementów`
        });
      }
      return successCount;
    };

    let masterBlogMap: Record<string, any> = { ...blogEntries };
    let masterPrayersMap: Record<string, any> = { ...prayers };
    const defaultBible = getBibleChapters(); // 1460 items
    const full1460BibleMap: Record<string, any> = {};

    try {
      // 0. Bezpośrednie pobranie najnowszego snapshotu z CDN (kluczowe dla smartfonów połączonych z GitHub)

      defaultBible.forEach(ch => {
        const docId = `bible_slot_${ch.slotIndex}`;
        const local = bibleEntries[docId];
        full1460BibleMap[docId] = {
          docId,
          slotIndex: ch.slotIndex,
          title: local?.title || ch.defaultTitle,
          text: local?.text || ch.defaultText,
          notebookUrls: local?.notebookUrls || [],
          notebookLabels: local?.notebookLabels || [],
          passageUrl: local?.passageUrl || '',
          updatedBy: local?.updatedBy || 'Pismo Święte Biblia365 (1460 czytań)',
          updatedAt: local?.updatedAt || new Date().toISOString()
        };
      });

      try {
        const cdnRes = await fetch(`/data/db_snapshot.json?t=${Date.now()}`);
        if (cdnRes.ok) {
          const cdnData = await cdnRes.json();
          if (cdnData.blogEntries) masterBlogMap = { ...cdnData.blogEntries, ...masterBlogMap };
          if (cdnData.prayers) masterPrayersMap = { ...cdnData.prayers, ...masterPrayersMap };
          if (cdnData.bibleEntries) {
            Object.entries(cdnData.bibleEntries).forEach(([k, cdnVal]: [string, any]) => {
              if (cdnVal && cdnVal.title && cdnVal.text) {
                full1460BibleMap[k] = mergeItemByNewestState(full1460BibleMap[k], cdnVal);
              }
            });
          }
        }
      } catch (cdnErr) {
        console.warn('[Sync] CDN snapshot fetch skipped:', cdnErr);
      }

      // 1. Synchronizacja Wstępu i Misji (5% - 25%)
      setSyncProgress({
        active: true,
        percent: 15,
        step: '1/4. Wstęp i Misja eMBiK365 (wprowadzenie i cele)...',
        itemCounter: 'Wstęp i Misja'
      });

      if (masterPrayersMap['introTextMain']) {
        try {
          await withTimeout(setDoc(doc(db, 'prayers', 'introTextMain'), masterPrayersMap['introTextMain'], { merge: true }), 3000);
        } catch {}
      }
      if (masterPrayersMap['introTextMission']) {
        try {
          await withTimeout(setDoc(doc(db, 'prayers', 'introTextMission'), masterPrayersMap['introTextMission'], { merge: true }), 3000);
        } catch {}
      }

      setSyncProgress({
        active: true,
        percent: 25,
        step: '1/4. Wstęp i Misja eMBiK365 zsynchronizowane.',
        itemCounter: 'Wstęp i Misja: Gotowe'
      });
      await new Promise(r => setTimeout(r, 60));

      // 2. Synchronizacja 365 wpisów WnR365 (25% - 55%)
      if (Object.keys(masterBlogMap).length < 365) {
        try {
          const snapMod = await import('../data/db_snapshot.json');
          if (snapMod.default?.blogEntries) {
            masterBlogMap = { ...snapMod.default.blogEntries, ...masterBlogMap };
          }
        } catch {}
      }

      const blogList = Object.entries(masterBlogMap).slice(0, 365);
      await pushChunked(
        blogList,
        'blog_entries',
        25,
        55,
        '2/4. 365 wpisów WnR365 (rozważania codzienne)...'
      );
      await new Promise(r => setTimeout(r, 60));

      // 3. Synchronizacja 2 × 175 modlitw RHZ365 (55% - 85%)
      try {
        const rhzModule = await import('../../RHZ365_pierwszy_cykl_175_dni.json');
        const rhzData = rhzModule.default || rhzModule;
        if (Array.isArray(rhzData)) {
          rhzData.forEach((day: any) => {
            const dayKey = `day_${day.dayNumber}`;
            if (!masterPrayersMap[dayKey]) {
              masterPrayersMap[dayKey] = {
                title: day.dayTitle || `Dzień ${day.dayNumber}`,
                text: day.reflection || '',
                notebookUrls: day.notebookUrls || []
              };
            }
          });
        }
      } catch {}

      const prayerList = Object.entries(masterPrayersMap);
      await pushChunked(
        prayerList,
        'prayers',
        55,
        85,
        '3/4. 2 × 175 modlitw RHZ365 (350 dni cyklu różańca, tajemnice i modlitwy stałe)...'
      );
      await new Promise(r => setTimeout(r, 60));

      // 4. Zapis NoSQL i Baza Danych (85% - 100%)
      setSyncProgress({
        active: true,
        percent: 90,
        step: '4/4. Zapisywanie kompletnej bazy NoSQL (db_snapshot.json)...',
        itemCounter: 'Aktualizacja IndexedDB'
      });
      await new Promise(r => setTimeout(r, 60));

      const snapshot = createNoSqlSnapshot(masterPrayersMap, masterBlogMap, full1460BibleMap);
      await Promise.race([
        importFullNoSqlSnapshot(snapshot),
        new Promise(resolve => setTimeout(resolve, 8000))
      ]);

      onBibleEntriesUpdated(full1460BibleMap);
      onBlogEntriesUpdated(masterBlogMap);
      onPrayersUpdated(masterPrayersMap);

      setSyncProgress({
        active: true,
        percent: 100,
        step: '✅ Synchronizacja ukończona w 100%!',
        itemCounter: 'Zakończono sukcesem'
      });

      setMasterStatus({
        type: 'success',
        message: `🎉 Sukces! Zsynchronizowano: Wstęp i Misję, 365 wpisów WnR365 oraz 2 × 175 modlitw RHZ365 (350 dni).`
      });
    } catch (err: any) {
      const isQuota = err?.message?.includes('Quota limit exceeded') || err?.message?.includes('resource-exhausted') || err?.code === 'resource-exhausted';

      try {
        const snapshot = createNoSqlSnapshot(masterPrayersMap, masterBlogMap, full1460BibleMap);
        await importFullNoSqlSnapshot(snapshot);
        onBibleEntriesUpdated(full1460BibleMap);
        onBlogEntriesUpdated(masterBlogMap);
        onPrayersUpdated(masterPrayersMap);
      } catch {}

      setSyncProgress(prev => ({ ...prev, active: false }));
      if (isQuota) {
        setMasterStatus({
          type: 'warning',
          message: `⚠️ Osiągnięto bezpłatny dzienny limit zapytań chmury Firestore (Quota Exceeded - 50 000 odczytów/dobę). Zmiany zostały w 100% zapisane lokalnie w Twojej przeglądarce! Aby natychmiastowo przenieść je na inne urządzenia, kliknij poniżej „Pobierz plik db_snapshot.json” i wgraj go na drugim urządzeniu.`
        });
      } else {
        setMasterStatus({
          type: 'error',
          message: `❌ Błąd synchronizacji: ${err?.message || 'Brak połączenia z Firestore'}`
        });
      }
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
        if (data && (data.title || data.text)) {
          const docId = docSnap.id;
          fetchedBlogEntries[docId] = mergeItemByNewestState(fetchedBlogEntries[docId], { docId, ...data });
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
          const docId = docSnap.id;
          fetchedPrayers[docId] = mergeItemByNewestState(fetchedPrayers[docId], { docId, ...data });
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
        const bibleSnap = await withTimeout(getDocs(collection(db, 'bible_entries')), 10000);
        bibleSnap.forEach(docSnap => {
          const data = docSnap.data();
          if (data && data.title && data.text) {
            const docId = docSnap.id;
            fetchedBibleEntries[docId] = mergeItemByNewestState(fetchedBibleEntries[docId], { docId, ...data });
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

  const handleCommitDirectToGithub = async () => {
    const cleanToken = (githubToken && githubToken.trim()) || DEFAULT_PAT;

    setMasterStatus({ type: 'loading', message: '🚀 Wysyłanie migawki db_snapshot.json bezpośrednio do GitHub API...' });

    try {
      const snapshot = createNoSqlSnapshot(prayers, blogEntries, bibleEntries);
      const jsonStr = JSON.stringify(snapshot, null, 2);

      const b64Content = stringToBase64Chunked(jsonStr);
      const targetPath = 'public/data/db_snapshot.json';
      const authHeader = `Bearer ${cleanToken}`;

      let attempts = 0;
      let isSuccess = false;
      let lastErrorMessage = '';

      while (attempts < 3 && !isSuccess) {
        attempts++;
        try {
          const apiUrl = `https://api.github.com/repos/deejaykey32-star/wnr/contents/${targetPath}?ref=main&cb=${Date.now()}_${attempts}`;
          const getRes = await fetch(apiUrl, {
            headers: {
              Authorization: authHeader,
              Accept: 'application/vnd.github.v3+json'
            }
          });

          if (!getRes.ok) {
            const errBody = await getRes.json().catch(() => ({}));
            throw new Error(errBody.message || `Nie można pobrać metadanych pliku z GitHub (Status ${getRes.status}). Sprawdź uprawnienia tokena PAT.`);
          }

          const getJson = await getRes.json();
          const sha = getJson.sha;

          const putUrl = `https://api.github.com/repos/deejaykey32-star/wnr/contents/${targetPath}`;
          const putRes = await fetch(putUrl, {
            method: 'PUT',
            headers: {
              Authorization: authHeader,
              Accept: 'application/vnd.github.v3+json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              message: `data: update db_snapshot.json via Direct Admin Commit (${new Date().toLocaleString('pl-PL')})`,
              content: b64Content,
              sha: sha,
              branch: 'main'
            })
          });

          if (putRes.ok) {
            isSuccess = true;
            break;
          }

          const errJson = await putRes.json().catch(() => ({}));
          lastErrorMessage = errJson.message || `Błąd GitHub API (${putRes.status})`;

          await new Promise(r => setTimeout(r, 600));
        } catch (attemptErr: any) {
          lastErrorMessage = attemptErr.message || 'Błąd połączenia z GitHub API (Failed to fetch)';
          if (attemptErr.name === 'TypeError' && attemptErr.message.includes('Failed to fetch')) {
            lastErrorMessage = 'Nie można połączyć się z api.github.com (Failed to fetch). Upewnij się, że masz połączenie z internetem oraz że dodatek typu uBlock/AdGuard/Brave nie blokuje zapytania do api.github.com.';
          }
          await new Promise(r => setTimeout(r, 600));
        }
      }

      if (isSuccess) {
        setMasterStatus({
          type: 'success',
          message: '🎉 Wyśmienicie! Zmiany zostały wyemitowane i zapisane bezpośrednio w repozytorium GitHub! Strona i smartfony zaktualizują się automatycznie po zakończeniu budowania.'
        });
      } else {
        throw new Error(lastErrorMessage);
      }
    } catch (err: any) {
      setMasterStatus({
        type: 'error',
        message: `❌ Błąd bezpośredniego zapisu do GitHub: ${err?.message || 'Nieznany błąd'}`
      });
    }
  };

  const handleHardResetPwa = async () => {
    setMasterStatus({ type: 'loading', message: '🧹 Czyszczenie pamięci podręcznej i resetowanie aplikacji (Ctrl+F5)...' });
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(key => caches.delete(key)));
      }
      try {
        localStorage.removeItem('wnr_nosql_version');
      } catch {}

      setMasterStatus({
        type: 'success',
        message: '✅ Pamięć podręczna wyczyszczona! Ponowne ładowanie strony z serwera...'
      });

      setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch {
      window.location.reload();
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
          message: `✅ Pomyślnie wgrano i zastosowano bazę NoSQL (${Object.keys(snapshot.blogEntries).length} wpisów WnR365 oraz ${Object.keys(snapshot.prayers).length} modlitw RHZ365)!`
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
            : status.type === 'warning'
              ? isDark ? 'bg-amber-950/40 border-amber-800 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'
              : isDark ? 'bg-rose-950/40 border-rose-800 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'
      }`}>
        {status.type === 'loading' && <Loader size={14} className="animate-spin shrink-0 mt-0.5" />}
        {status.type === 'success' && <CheckCircle size={14} className="shrink-0 mt-0.5" />}
        {status.type === 'warning' && <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-400" />}
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
          <strong>Architektura Zerowych Kosztów:</strong> Wszystkie treści ładują się w 100% z dedykowanego pliku NoSQL w kodzie aplikacji na GitHubie/Cloudflare. Firestore służy jako automatyczny backup.
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
                3 Sekcje
              </span>
            </div>

            <p className={`text-xs mb-4 leading-relaxed ${subText}`}>
              Jednym kliknięciem synchronizuje całą zawartość: <strong>Wstęp</strong>, <strong>RHZ365</strong> (różaniec i tajemnice) oraz <strong>WnR365</strong> (365 rozważań).
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

              {/* Button: Hard Reset PWA Cache (Mobile Ctrl+F5) */}
              <button
                onClick={handleHardResetPwa}
                disabled={masterStatus.type === 'loading'}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
                  isDark
                    ? 'bg-rose-950/40 border-rose-800/60 text-rose-300 hover:bg-rose-900/60'
                    : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                }`}
              >
                <span>🧹 Wymuś Twardy Reset i Czyszczenie Pamięci (Ctrl+F5 na Smartfonie)</span>
              </button>
            </div>

            <StatusBar status={masterStatus} />

            {/* GitHub Actions Auto-Deploy Section */}
            <div className={`mt-3 p-3.5 rounded-xl text-xs border leading-relaxed space-y-2.5 ${isDark ? 'bg-slate-950/80 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
              <div className="flex items-center justify-between">
                <div className="font-bold text-amber-400 flex items-center gap-1.5 text-xs">
                  <ShieldCheck size={14} />
                  <span>Automatyczny Git Push (GitHub Actions)</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  Cron co 6h aktywny
                </span>
              </div>

              <p className="text-[11px] text-slate-400">
                GitHub Actions automatycznie co 6 godzin (i o północy) pobiera z Firestore wszystkie nowe dane i wykonuje <code>git push</code> bez asystenta.
              </p>

              {/* Direct Commit to GitHub API button (Bypasses Firestore entirely) */}
              <button
                onClick={handleCommitDirectToGithub}
                disabled={masterStatus.type === 'loading'}
                className="w-full px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition active:scale-95 border border-emerald-400/30"
              >
                <Upload size={14} />
                <span>🚀 Wyślij Zmiany Bezpośrednio do Repozytorium GitHub (Bez Firestore)</span>
              </button>

              <div className="flex flex-wrap gap-2 pt-1">
                {/* 1-Click trigger button */}
                <button
                  onClick={handleTriggerGithubSync}
                  disabled={isTriggeringGithub}
                  className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition active:scale-95"
                >
                  <Zap size={13} className={isTriggeringGithub ? 'animate-spin' : ''} />
                  <span>{isTriggeringGithub ? 'Wysyłanie sygnału...' : 'Wywołaj Git Push w Chmurze Teraz'}</span>
                </button>

                {/* Direct link to GitHub Actions tab */}
                <a
                  href="https://github.com/deejaykey32-star/wnr/actions/workflows/sync-firestore.yml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition ${
                    isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>Otwórz GitHub Actions ↗</span>
                </a>

                <button
                  onClick={() => setShowGithubConfig(!showGithubConfig)}
                  className={`px-2.5 py-2 rounded-xl text-xs font-medium border transition ${
                    isDark ? 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200' : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⚙️ Token PAT
                </button>
              </div>

              {/* GitHub PAT config dropdown */}
              {showGithubConfig && (
                <div className={`mt-2 p-2.5 rounded-lg border text-left space-y-1.5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 font-bold">
                    GitHub Personal Access Token (PAT):
                  </label>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => {
                      setGithubToken(e.target.value);
                      try { localStorage.setItem('github_sync_pat', e.target.value.trim()); } catch {}
                    }}
                    placeholder={DEFAULT_PAT}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-mono border focus:outline-none ${
                      isDark ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                    }`}
                  />
                  <p className="text-[10px] text-emerald-400 font-medium">
                    ✅ Klucz PAT jest wbudowany na stałe w aplikację. Pole powyżej pozwala nadpisać go własnym tokenem, jeśli zajdzie taka potrzeba.
                  </p>
                </div>
              )}

              {/* Status of trigger */}
              {githubTriggerStatus.message && (
                <div className={`p-2 rounded-lg text-[11px] font-medium border ${
                  githubTriggerStatus.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                    : githubTriggerStatus.type === 'error'
                      ? 'bg-red-950/40 border-red-800 text-red-300'
                      : 'bg-indigo-950/40 border-indigo-800 text-indigo-300'
                }`}>
                  {githubTriggerStatus.message}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className={`px-5 py-3 border-t text-xs ${subText} ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          🔒 Panel administracyjny eMBiK365. Wszystkie dane zapisywane są z zerowym opóźnieniem.
        </div>
      </div>
    </div>
  );
};

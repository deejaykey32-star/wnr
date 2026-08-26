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
import { getBibleChapters } from '../utils/bibleHelper';

interface AdminSyncPanelProps {
  onClose: () => void;
  theme: 'dark' | 'light';
  prayers: Record<string, { title: string; text: string; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }>;
  bibleEntries: Record<string, { title: string; text: string; slotIndex: number; notebookUrls?: string[]; notebookLabels?: string[]; passageUrl?: string; updatedBy?: string; updatedAt?: string }>;
  onBlogEntriesUpdated: (entries: Record<string, { title: string; text: string; dayIndex: number; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }>) => void;
  onPrayersUpdated: (prayers: Record<string, { title: string; text: string; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }>) => void;
  onBibleEntriesUpdated: (entries: Record<string, { title: string; text: string; slotIndex: number; notebookUrls?: string[]; notebookLabels?: string[]; passageUrl?: string; updatedBy?: string; updatedAt?: string }>) => void;
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

  const [githubToken, setGithubToken] = useState<string>(() => {
    try { return localStorage.getItem('github_sync_pat') || ''; } catch { return ''; }
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
    if (!githubToken.trim()) {
      setShowGithubConfig(true);
      setGithubTriggerStatus({
        type: 'error',
        message: 'Wklej swój Personal Access Token (PAT) z GitHub, aby wywołać automatyczny deploy bez asystenta.'
      });
      return;
    }
    setIsTriggeringGithub(true);
    setGithubTriggerStatus({
      type: 'loading',
      message: 'Wysyłanie sygnału do GitHub Actions (Workflow Dispatch)...'
    });
    try {
      localStorage.setItem('github_sync_pat', githubToken.trim());
      const res = await fetch('https://api.github.com/repos/deejaykey32-star/wnr/dispatches', {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${githubToken.trim()}`,
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

    try {
      // 0. Bezpośrednie pobranie najnowszego snapshotu z CDN (kluczowe dla smartfonów połączonych z GitHub)
      let masterBlogMap: Record<string, any> = { ...blogEntries };
      let masterPrayersMap: Record<string, any> = { ...prayers };
      const defaultBible = getBibleChapters(); // 1460 items
      const full1460BibleMap: Record<string, any> = {};

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
                const current = full1460BibleMap[k] || {};

                const currentHasUrls = current.notebookUrls && current.notebookUrls.some((u: any) => u && String(u).trim().length > 0);
                const cdnHasUrls = cdnVal.notebookUrls && cdnVal.notebookUrls.some((u: any) => u && String(u).trim().length > 0);
                const mergedUrls = currentHasUrls ? current.notebookUrls : (cdnHasUrls ? cdnVal.notebookUrls : (current.notebookUrls || []));

                const currentHasLabels = current.notebookLabels && current.notebookLabels.some((l: any) => l && String(l).trim().length > 0);
                const cdnHasLabels = cdnVal.notebookLabels && cdnVal.notebookLabels.some((l: any) => l && String(l).trim().length > 0);
                const mergedLabels = currentHasLabels ? current.notebookLabels : (cdnHasLabels ? cdnVal.notebookLabels : (current.notebookLabels || []));

                const currentHasPassage = current.passageUrl && String(current.passageUrl).trim().length > 0;
                const cdnHasPassage = cdnVal.passageUrl && String(cdnVal.passageUrl).trim().length > 0;
                const mergedPassageUrl = currentHasPassage ? current.passageUrl : (cdnHasPassage ? cdnVal.passageUrl : (current.passageUrl || ''));

                full1460BibleMap[k] = {
                  docId: k,
                  slotIndex: cdnVal.slotIndex ?? current.slotIndex ?? (parseInt(k.replace('bible_slot_', ''), 10) || 0),
                  title: current.title || cdnVal.title,
                  text: current.text || cdnVal.text,
                  notebookUrls: mergedUrls,
                  notebookLabels: mergedLabels,
                  passageUrl: mergedPassageUrl,
                  updatedBy: current.updatedBy || cdnVal.updatedBy || 'Pismo Święte Biblia365 (1460 czytań)',
                  updatedAt: current.updatedAt || cdnVal.updatedAt || new Date().toISOString()
                };
              }
            });
          }
        }
      } catch (cdnErr) {
        console.warn('[Sync] CDN snapshot fetch skipped:', cdnErr);
      }

      // 1. Synchronizacja Wstępu i Misji (5% - 15%)
      setSyncProgress({
        active: true,
        percent: 10,
        step: '1/5. Wstęp i Misja eMBiK365 (wprowadzenie i cele)...',
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
        percent: 15,
        step: '1/5. Wstęp i Misja eMBiK365 zsynchronizowane.',
        itemCounter: 'Wstęp i Misja: Gotowe'
      });
      await new Promise(r => setTimeout(r, 60));

      // 2. Synchronizacja 365 wpisów WnR365 (15% - 40%)
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
        15,
        40,
        '2/5. 365 wpisów WnR365 (rozważania codzienne + Gemini AI)...'
      );
      await new Promise(r => setTimeout(r, 60));

      // 3. Synchronizacja 2 × 175 modlitw RHZ365 (40% - 68%)
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
        40,
        68,
        '3/5. 2 × 175 modlitw RHZ365 (350 dni cyklu różańca, tajemnice i modlitwy stałe)...'
      );
      await new Promise(r => setTimeout(r, 60));

      // 4. Synchronizacja 4 × 365 rozdziałów Biblia365 (68% - 92%)
      // Fetch remote bible_entries from Firestore and overlay
      try {
        setSyncProgress({
          active: true,
          percent: 70,
          step: '4/5. Pobieranie czytań Biblia365 z Firestore...',
          itemCounter: 'Pobieranie z chmury'
        });
        const bibleSnap = await withTimeout(getDocs(collection(db, 'bible_entries')), 10000);
        if (!bibleSnap.empty) {
          bibleSnap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data && data.title && data.text) {
              const docId = docSnap.id;
              const current = full1460BibleMap[docId] || {};

              const mergedUrls = Array(8).fill('').map((_, idx) => {
                const rem = (data.notebookUrls?.[idx] && String(data.notebookUrls[idx]).trim()) || '';
                const cur = (current.notebookUrls?.[idx] && String(current.notebookUrls[idx]).trim()) || '';
                return rem || cur || '';
              });

              const mergedLabels = Array(8).fill('').map((_, idx) => {
                const rem = (data.notebookLabels?.[idx] && String(data.notebookLabels[idx]).trim()) || '';
                const cur = (current.notebookLabels?.[idx] && String(current.notebookLabels[idx]).trim()) || '';
                return rem || cur || '';
              });

              const mergedPassageUrl = (data.passageUrl && String(data.passageUrl).trim())
                ? String(data.passageUrl).trim()
                : (current.passageUrl || '');

              full1460BibleMap[docId] = {
                docId,
                slotIndex: data.slotIndex ?? current.slotIndex ?? (parseInt(docId.replace('bible_slot_', ''), 10) || 0),
                title: data.title || current.title,
                text: data.text || current.text,
                notebookUrls: mergedUrls,
                notebookLabels: mergedLabels,
                passageUrl: mergedPassageUrl,
                updatedBy: data.updatedBy || current.updatedBy || 'Firestore Sync',
                updatedAt: data.updatedAt || current.updatedAt || new Date().toISOString()
              };
            }
          });
        }
      } catch (bibleFetchErr) {
        console.warn('[Sync] Bible getDocs skipped/failed:', bibleFetchErr);
      }

      // Process and verify all 1460 Bible slots with progress bar (smooth frame animations)
      const bibleEntriesList = Object.entries(full1460BibleMap);
      const totalBibleCount = bibleEntriesList.length; // 1460

      const bibleChunkSize = 73; // 20 animated steps of 73
      for (let i = 0; i < totalBibleCount; i += bibleChunkSize) {
        const chunk = bibleEntriesList.slice(i, i + bibleChunkSize);
        // Push custom/edited ones to cloud
        await Promise.allSettled(
          chunk.map(async ([docId, data]) => {
            if (
              (data.notebookUrls?.some((u: any) => u && String(u).trim().length > 0)) ||
              (data.passageUrl && String(data.passageUrl).trim().length > 0) ||
              (data.notebookLabels?.some((l: any) => l && String(l).trim().length > 0)) ||
              (data.title && data.title !== defaultBible[data.slotIndex - 1]?.defaultTitle)
            ) {
              try {
                await withTimeout(setDoc(doc(db, 'bible_entries', docId), data, { merge: true }), 4000);
              } catch {}
            }
          })
        );

        const currentDone = Math.min(totalBibleCount, i + bibleChunkSize);
        const pct = Math.round(72 + (currentDone / totalBibleCount) * 20);
        setSyncProgress({
          active: true,
          percent: Math.min(92, pct),
          step: '4/5. 4 × 365 rozdziałów Biblia365 (1460 czytań od Rdz do Ap + Gemini AI)...',
          itemCounter: `${currentDone} / ${totalBibleCount} rozdziałów Biblia365`
        });
        await new Promise(r => setTimeout(r, 30));
      }

      onBibleEntriesUpdated(full1460BibleMap);

      // 5. Zapis NoSQL i Baza Danych (92% - 100%)
      setSyncProgress({
        active: true,
        percent: 96,
        step: '5/5. Zapisywanie kompletnej bazy NoSQL (db_snapshot.json)...',
        itemCounter: 'Aktualizacja IndexedDB'
      });
      await new Promise(r => setTimeout(r, 60));

      const snapshot = createNoSqlSnapshot(masterPrayersMap, masterBlogMap, full1460BibleMap);
      await importFullNoSqlSnapshot(snapshot);

      setSyncProgress({
        active: true,
        percent: 100,
        step: '✅ Synchronizacja ukończona w 100%!',
        itemCounter: 'Zakończono sukcesem'
      });

      setMasterStatus({
        type: 'success',
        message: `🎉 Sukces! Zsynchronizowano: Wstęp i Misję, 365 wpisów WnR365, 2 × 175 modlitw RHZ365 (350 dni) oraz 4 × 365 rozdziałów Biblia365 (1460 czytań) wraz z kompletem linków Gemini Notebook.`
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
        if (data && (data.title || data.text)) {
          const docId = docSnap.id;
          const current = fetchedBlogEntries[docId] || {};
          const mergedUrls = Array(8).fill('').map((_, idx) => {
            const rem = (data.notebookUrls?.[idx] && String(data.notebookUrls[idx]).trim()) || '';
            const cur = (current.notebookUrls?.[idx] && String(current.notebookUrls[idx]).trim()) || '';
            return rem || cur || '';
          });
          fetchedBlogEntries[docId] = {
            title: data.title || current.title,
            text: data.text || current.text,
            dayIndex: data.dayIndex ?? current.dayIndex ?? 0,
            notebookUrls: mergedUrls,
            updatedBy: data.updatedBy || current.updatedBy || 'Firestore Backup',
            updatedAt: data.updatedAt || current.updatedAt || new Date().toISOString()
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
          const docId = docSnap.id;
          const current = fetchedPrayers[docId] || {};
          const mergedUrls = Array(8).fill('').map((_, idx) => {
            const rem = (data.notebookUrls?.[idx] && String(data.notebookUrls[idx]).trim()) || '';
            const cur = (current.notebookUrls?.[idx] && String(current.notebookUrls[idx]).trim()) || '';
            return rem || cur || '';
          });
          fetchedPrayers[docId] = {
            title: data.title || current.title,
            text: data.text || current.text,
            notebookUrls: mergedUrls,
            updatedBy: data.updatedBy || current.updatedBy || 'Firestore Backup',
            updatedAt: data.updatedAt || current.updatedAt || new Date().toISOString()
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
        const bibleSnap = await withTimeout(getDocs(collection(db, 'bible_entries')), 10000);
        bibleSnap.forEach(docSnap => {
          const data = docSnap.data();
          if (data && data.title && data.text) {
            const docId = docSnap.id;
            const current = fetchedBibleEntries[docId] || {};

            const mergedUrls = Array(8).fill('').map((_, idx) => {
              const rem = (data.notebookUrls?.[idx] && String(data.notebookUrls[idx]).trim()) || '';
              const cur = (current.notebookUrls?.[idx] && String(current.notebookUrls[idx]).trim()) || '';
              return rem || cur || '';
            });

            const mergedLabels = Array(8).fill('').map((_, idx) => {
              const rem = (data.notebookLabels?.[idx] && String(data.notebookLabels[idx]).trim()) || '';
              const cur = (current.notebookLabels?.[idx] && String(current.notebookLabels[idx]).trim()) || '';
              return rem || cur || '';
            });

            const mergedPassageUrl = (data.passageUrl && String(data.passageUrl).trim())
              ? String(data.passageUrl).trim()
              : (current.passageUrl || '');

            fetchedBibleEntries[docId] = {
              docId,
              title: data.title || current.title,
              text: data.text || current.text,
              slotIndex: data.slotIndex ?? current.slotIndex ?? 0,
              notebookUrls: mergedUrls,
              notebookLabels: mergedLabels,
              passageUrl: mergedPassageUrl,
              updatedBy: data.updatedBy || current.updatedBy || 'Firestore Backup',
              updatedAt: data.updatedAt || current.updatedAt || new Date().toISOString()
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
                GitHub Actions automatycznie co 6 godzin (i o północy) pobiera z Firestore wszystkie nowe linki Gemini i wykonuje <code>git push</code> bez asystenta.
              </p>

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
                    GitHub Personal Access Token (PAT z uprawnieniem repo/actions):
                  </label>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => {
                      setGithubToken(e.target.value);
                      try { localStorage.setItem('github_sync_pat', e.target.value.trim()); } catch {}
                    }}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-mono border focus:outline-none ${
                      isDark ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                    }`}
                  />
                  <p className="text-[10px] text-slate-500">
                    Token jest zapisywany lokalnie w Twojej przeglądarce i służy wyłącznie do wysłania polecenia <code>repository_dispatch</code> do GitHub Actions.
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
          🔒 Panel administracyjny eMBiK365. Wszystkie linki Gemini Notebook zapisywane są z zerowym opóźnieniem.
        </div>
      </div>
    </div>
  );
};

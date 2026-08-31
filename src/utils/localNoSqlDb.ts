export interface LocalBlogEntry {
  docId: string;
  dayIndex: number;
  title: string;
  text: string;
  notebookUrls?: string[];
  notebookLabels?: string[];
  updatedBy: string;
  updatedAt: string;
}

export interface LocalBibleEntry {
  docId: string; // bible_slot_X
  slotIndex: number; // 1 to 1460
  title: string;
  text: string;
  notebookUrls?: string[];
  notebookLabels?: string[];
  passageUrl?: string;
  updatedBy: string;
  updatedAt: string;
}

const DB_NAME = 'WnR365LocalNoSqlDb';
const DB_VERSION = 3;
const BLOG_STORE = 'blog_entries';
const PRAYERS_STORE = 'prayers';
const BIBLE_STORE = 'bible_entries';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        try {
          const db = request.result;
          if (!db.objectStoreNames.contains(BLOG_STORE)) {
            db.createObjectStore(BLOG_STORE, { keyPath: 'docId' });
          }
          if (!db.objectStoreNames.contains(PRAYERS_STORE)) {
            db.createObjectStore(PRAYERS_STORE, { keyPath: 'docId' });
          }
          if (!db.objectStoreNames.contains(BIBLE_STORE)) {
            db.createObjectStore(BIBLE_STORE, { keyPath: 'docId' });
          }
        } catch (err) {
          console.warn('[NoSQL] Error during onupgradeneeded:', err);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null; // Clear it so we don't cache the error
        reject(request.error || new Error('Failed to open IndexedDB'));
      };
      request.onblocked = () => {
        console.warn('[NoSQL] IndexedDB open blocked by older tab.');
      };
    } catch (err) {
      dbPromise = null;
      reject(err);
    }
  });

  // Attach a dummy catch to prevent unhandled rejection event
  dbPromise.catch(() => {});

  return dbPromise;
}

// Increment this version whenever wnr365_pdf_entries.json content changes significantly.
// This forces a full IndexedDB reseed on next app load, clearing stale cached data.
const DATA_VERSION = '2026-08-25-sync-1788143631630';
const DATA_VERSION_KEY = 'wnr365_db_data_version';

/**
 * Initializes local IndexedDB NoSQL database.
 * Seeds / re-seeds all 365 WnR365 entries from the bundled PDF JSON whenever
 * DATA_VERSION changes — ensuring users always get the latest clean data.
 */
export async function initLocalNoSqlDb(): Promise<void> {
  try {
    const storedVersion = localStorage.getItem(DATA_VERSION_KEY);
    let needsReseed = storedVersion !== DATA_VERSION;

    const db = await openDb();

    // If version matches, check if the store is empty (e.g. if DB was cleared manually)
    if (!needsReseed && db.objectStoreNames.contains(BLOG_STORE)) {
      try {
        const isEmpty = await new Promise<boolean>((resolve) => {
          const tx = db.transaction(BLOG_STORE, 'readonly');
          const store = tx.objectStore(BLOG_STORE);
          const countReq = store.count();
          countReq.onsuccess = () => resolve(countReq.result === 0);
          countReq.onerror = () => resolve(true);
        });
        if (isEmpty) {
          needsReseed = true;
        }
      } catch (err) {
        console.warn('[NoSQL] Failed to check store count:', err);
      }
    }

    if (needsReseed) {
      console.log(`[NoSQL] Data version mismatch or empty DB. Seeding IndexedDB from NoSQL snapshot...`);

      let snapshotData: any = null;
      try {
        const snapMod = await import('../data/db_snapshot.json');
        snapshotData = snapMod.default || snapMod;
      } catch (snapErr) {
        console.warn('[NoSQL] Could not load db_snapshot.json directly, falling back to pdf entries:', snapErr);
      }

      let wnrPdfMap: Record<string, any> = {};
      try {
        const module = await import('../data/wnr365_pdf_entries.json');
        wnrPdfMap = (module.default || module) as Record<string, any>;
      } catch (importErr) {
        console.warn('[NoSQL] Failed to import wnr365_pdf_entries.json:', importErr);
      }

      const mergedBlogEntries: Record<string, any> = { ...wnrPdfMap, ...(snapshotData?.blogEntries || {}) };
      const mergedPrayers: Record<string, any> = { ...(snapshotData?.prayers || {}) };
      const mergedBible: Record<string, any> = { ...(snapshotData?.bibleEntries || {}) };

      // 2. Perform seed in a readwrite transaction
      return new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          console.warn('[NoSQL] Seeding timeout reached, proceeding to render app...');
          resolve();
        }, 1500);

        try {
          const storeNames: string[] = [];
          if (db.objectStoreNames.contains(BLOG_STORE)) storeNames.push(BLOG_STORE);
          if (db.objectStoreNames.contains(PRAYERS_STORE)) storeNames.push(PRAYERS_STORE);
          if (db.objectStoreNames.contains(BIBLE_STORE)) storeNames.push(BIBLE_STORE);

          if (storeNames.length === 0) {
            clearTimeout(timer);
            resolve();
            return;
          }

          const tx = db.transaction(storeNames, 'readwrite');
          const store = db.objectStoreNames.contains(BLOG_STORE) ? tx.objectStore(BLOG_STORE) : null;
          const prayersStore = db.objectStoreNames.contains(PRAYERS_STORE) ? tx.objectStore(PRAYERS_STORE) : null;
          const bibleStore = db.objectStoreNames.contains(BIBLE_STORE) ? tx.objectStore(BIBLE_STORE) : null;

          tx.onerror = () => { clearTimeout(timer); resolve(); };
          tx.onabort = () => { clearTimeout(timer); resolve(); };

          // Seed blog entries from snapshot (preserving all notebookUrls)
          if (store) {
            Object.entries(mergedBlogEntries).forEach(([docId, entry]: [string, any]) => {
              try {
                store.put({
                  docId,
                  dayIndex: entry.dayIndex ?? 0,
                  title: entry.title,
                  text: entry.text,
                  notebookUrls: entry.notebookUrls || [],
                  updatedBy: entry.updatedBy || 'eMBiK365 NoSQL Snapshot',
                  updatedAt: entry.updatedAt || new Date().toISOString()
                });
              } catch (putErr) {
                console.warn(`[NoSQL] Error putting entry ${docId}:`, putErr);
              }
            });
          }

          // Seed prayers from snapshot
          if (prayersStore) {
            Object.entries(mergedPrayers).forEach(([docId, prayer]: [string, any]) => {
              try {
                if (prayer && prayer.title && prayer.text) {
                  prayersStore.put({ docId, ...prayer });
                }
              } catch (putErr) {
                console.warn(`[NoSQL] Error putting prayer ${docId}:`, putErr);
              }
            });
          }

          // Seed bible entries from snapshot
          if (bibleStore) {
            Object.entries(mergedBible).forEach(([docId, bible]: [string, any]) => {
              try {
                if (bible && bible.title && bible.text) {
                  bibleStore.put({ docId, ...bible });
                }
              } catch (putErr) {
                console.warn(`[NoSQL] Error putting bible entry ${docId}:`, putErr);
              }
            });
          }

          tx.oncomplete = () => {
            clearTimeout(timer);
            try {
              localStorage.setItem(DATA_VERSION_KEY, DATA_VERSION);
              console.log(`[NoSQL] Re-seed complete from snapshot. Version set to ${DATA_VERSION}.`);
            } catch {}
            resolve();
          };
        } catch (txErr) {
          clearTimeout(timer);
          console.warn('[NoSQL] Seeding error:', txErr);
          resolve();
        }
      });
    }
  } catch (err) {
    console.warn('[NoSQL] Failed to initialize IndexedDB:', err);
  }
}


/**
 * Synchronously returns all bundled PDF JSON entries.
 * Used for instant zero-delay state initialization in React to prevent white screen.
 */
export function getAllLocalBlogEntriesSync(): Record<string, LocalBlogEntry> {
  // Return empty initially. Once dynamic import and IndexedDB seeding completes,
  // getAllLocalBlogEntries will run asynchronously and populate React state.
  return {};
}

/**
 * Gets all local blog entries: starts from bundled PDF JSON, overlaid ONLY with
 * admin-edited entries from IndexedDB (not seeded PDF data).
 * NEVER fetches from Firestore.
 */
export async function getAllLocalBlogEntries(): Promise<Record<string, LocalBlogEntry>> {
  const result = getAllLocalBlogEntriesSync();

  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(BLOG_STORE, 'readonly');
      const store = tx.objectStore(BLOG_STORE);
      const req = store.getAll();

      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result)) {
          req.result.forEach((item: LocalBlogEntry) => {
            if (item && item.docId) {
              result[item.docId] = item;
            }
          });
        }
        resolve(result);
      };

      req.onerror = () => resolve(result);
    });
  } catch {
    return result;
  }
}

/**
 * Saves a blog entry to local IndexedDB.
 * NEVER saves to Firestore automatically.
 */
export async function saveLocalBlogEntry(
  docId: string, 
  entry: { title: string; text: string; dayIndex: number; notebookUrls?: string[]; notebookLabels?: string[]; updatedBy?: string; updatedAt?: string }
): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(BLOG_STORE, 'readwrite');
    const store = tx.objectStore(BLOG_STORE);

    const record: LocalBlogEntry = {
      docId,
      dayIndex: entry.dayIndex,
      title: entry.title,
      text: entry.text,
      notebookUrls: entry.notebookUrls || [],
      notebookLabels: entry.notebookLabels || [],
      updatedBy: entry.updatedBy || 'Edytor Lokalny',
      updatedAt: entry.updatedAt || new Date().toISOString()
    };

    store.put(record);
    console.log(`[NoSQL] Saved locally: ${docId}`);
  } catch (err) {
    console.warn('[NoSQL] Failed to save to IndexedDB:', err);
  }
}

/**
 * Gets all local Bible entries: overlays default title/text with IndexedDB admin edits.
 */
export async function getAllLocalBibleEntries(): Promise<Record<string, LocalBibleEntry>> {
  const result: Record<string, LocalBibleEntry> = {};

  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(BIBLE_STORE, 'readonly');
      const store = tx.objectStore(BIBLE_STORE);
      const req = store.getAll();

      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result)) {
          req.result.forEach((item: LocalBibleEntry) => {
            if (item && item.docId) {
              result[item.docId] = item;
            }
          });
        }
        resolve(result);
      };

      req.onerror = () => resolve(result);
    });
  } catch {
    return result;
  }
}

/**
 * Saves a Bible chapter entry to local IndexedDB.
 */
export async function saveLocalBibleEntry(
  docId: string,
  entry: {
    title: string;
    text: string;
    slotIndex: number;
    notebookUrls?: string[];
    notebookLabels?: string[];
    passageUrl?: string;
    updatedBy?: string;
    updatedAt?: string;
  }
): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(BIBLE_STORE, 'readwrite');
    const store = tx.objectStore(BIBLE_STORE);

    const record: LocalBibleEntry = {
      docId,
      slotIndex: entry.slotIndex,
      title: entry.title,
      text: entry.text,
      notebookUrls: entry.notebookUrls || [],
      notebookLabels: entry.notebookLabels || [],
      passageUrl: entry.passageUrl || '',
      updatedBy: entry.updatedBy || 'Edytor Lokalny',
      updatedAt: entry.updatedAt || new Date().toISOString()
    };

    store.put(record);
    console.log(`[NoSQL] Bible saved locally: ${docId}`);
  } catch (err) {
    console.warn('[NoSQL] Failed to save Bible to IndexedDB:', err);
  }
}

/**
 * Resets IndexedDB back to the bundled PDF JSON seed data.
 * Admin only.
 */
export async function resetLocalToSeedData(): Promise<void> {
  try {
    // 1. Preload JSON data first to avoid TransactionInactiveError during async import
    const module = await import('../data/wnr365_pdf_entries.json');
    const wnrPdfEntriesData = module.default;
    const wnrPdfMap = wnrPdfEntriesData as Record<string, { dayIndex: number; title: string; text: string; updatedBy?: string; updatedAt?: string }>;

    // 2. Open DB and write in a single readwrite transaction
    const db = await openDb();

    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(BLOG_STORE, 'readwrite');
        const store = tx.objectStore(BLOG_STORE);

        tx.onerror = () => reject(tx.error || new Error('Transaction failed'));
        tx.onabort = () => reject(new Error('Transaction aborted'));

        store.clear();

        Object.entries(wnrPdfMap).forEach(([docId, entry]) => {
          try {
            store.put({
              docId,
              dayIndex: entry.dayIndex,
              title: entry.title,
              text: entry.text,
              updatedBy: entry.updatedBy || 'eMBiK365 Księga A5 PDF',
              updatedAt: entry.updatedAt || new Date().toISOString()
            });
          } catch (putErr) {
            console.warn(`[NoSQL] Put error during reset for ${docId}:`, putErr);
          }
        });

        tx.oncomplete = () => {
          try {
            localStorage.setItem(DATA_VERSION_KEY, DATA_VERSION);
          } catch {}
          resolve();
        };
      } catch (err) {
        reject(err);
      }
    });
  } catch (err) {
    console.error('[NoSQL] Failed to reset to seed data:', err);
    throw err;
  }
}

/**
 * Saves all prayers to local IndexedDB.
 */
export async function saveLocalPrayers(
  prayers: Record<string, { title: string; text: string; notebookUrls?: string[]; notebookLabels?: string[]; updatedBy?: string; updatedAt?: string }>
): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(PRAYERS_STORE, 'readwrite');
    const store = tx.objectStore(PRAYERS_STORE);

    Object.entries(prayers).forEach(([docId, prayer]) => {
      store.put({ docId, ...prayer });
    });
  } catch (err) {
    console.warn('[NoSQL] Failed to save prayers to IndexedDB:', err);
  }
}

/**
 * Saves a single prayer or intro block to local IndexedDB.
 */
export async function saveSingleLocalPrayer(
  docId: string, 
  prayer: { title: string; text: string; notebookUrls?: string[]; notebookLabels?: string[]; updatedBy?: string; updatedAt?: string }
): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(PRAYERS_STORE, 'readwrite');
    const store = tx.objectStore(PRAYERS_STORE);
    store.put({ docId, ...prayer });
  } catch (err) {
    console.warn('[NoSQL] Failed to save single prayer to IndexedDB:', err);
  }
}

/**
 * Gets locally stored prayers from IndexedDB.
 */
export async function getLocalPrayers(): Promise<Record<string, { title: string; text: string; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }> | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(PRAYERS_STORE, 'readonly');
      const store = tx.objectStore(PRAYERS_STORE);
      const req = store.getAll();

      req.onsuccess = () => {
        if (!req.result || req.result.length === 0) {
          resolve(null);
          return;
        }
        const result: Record<string, { title: string; text: string; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }> = {};
        req.result.forEach((item: { docId: string; title: string; text: string; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }) => {
          if (item && item.docId) {
            const { docId, ...rest } = item;
            result[docId] = rest;
          }
        });
        resolve(result);
      };

      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export interface FullNoSqlSnapshot {
  version: string;
  exportedAt: string;
  source: string;
  intro: {
    introTextMain?: { title: string; text: string; updatedBy?: string; updatedAt?: string };
    introTextMission?: { title: string; text: string; updatedBy?: string; updatedAt?: string };
    [key: string]: any;
  };
  prayers: Record<string, { title: string; text: string; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }>;
  blogEntries: Record<string, { title: string; text: string; dayIndex: number; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }>;
  bibleEntries?: Record<string, { title: string; text: string; slotIndex: number; notebookUrls?: string[]; notebookLabels?: string[]; passageUrl?: string; updatedBy?: string; updatedAt?: string }>;
}

/**
 * Creates a complete, unified NoSQL database snapshot containing all days of RHZ365, WnR365, Bible365, and Intro blocks.
 */
export function createNoSqlSnapshot(
  prayersData: Record<string, { title: string; text: string; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }>,
  blogEntriesData: Record<string, { title: string; text: string; dayIndex: number; notebookUrls?: string[]; updatedBy?: string; updatedAt?: string }>,
  bibleEntriesData?: Record<string, { title: string; text: string; slotIndex: number; notebookUrls?: string[]; notebookLabels?: string[]; passageUrl?: string; updatedBy?: string; updatedAt?: string }>
): FullNoSqlSnapshot {
  const introBlocks: Record<string, any> = {};
  if (prayersData['introTextMain']) introBlocks['introTextMain'] = prayersData['introTextMain'];
  if (prayersData['introTextMission']) introBlocks['introTextMission'] = prayersData['introTextMission'];

  return {
    version: `wnr365-snapshot-${new Date().toISOString().slice(0, 10)}`,
    exportedAt: new Date().toISOString(),
    source: 'widokinaraj.pl NoSQL Core (GitHub / Cloudflare Pages)',
    intro: introBlocks,
    prayers: prayersData,
    blogEntries: blogEntriesData,
    bibleEntries: bibleEntriesData || {}
  };
}

/**
 * Imports a full NoSQL snapshot into IndexedDB in a single clean transaction.
 */
export async function importFullNoSqlSnapshot(snapshot: FullNoSqlSnapshot): Promise<{ prayersCount: number; blogCount: number; bibleCount: number }> {
  const db = await openDb();

  return new Promise<{ prayersCount: number; blogCount: number; bibleCount: number }>((resolve, reject) => {
    try {
      const activeStores = [BLOG_STORE, PRAYERS_STORE];
      if (db.objectStoreNames.contains(BIBLE_STORE)) {
        activeStores.push(BIBLE_STORE);
      }

      const tx = db.transaction(activeStores, 'readwrite');
      const blogStore = tx.objectStore(BLOG_STORE);
      const prayersStore = tx.objectStore(PRAYERS_STORE);
      const bibleStore = db.objectStoreNames.contains(BIBLE_STORE) ? tx.objectStore(BIBLE_STORE) : null;

      let prayersCount = 0;
      let blogCount = 0;
      let bibleCount = 0;

      if (snapshot.prayers) {
        Object.entries(snapshot.prayers).forEach(([docId, entry]) => {
          if (entry && entry.title && entry.text) {
            prayersStore.put({
              docId,
              title: entry.title,
              text: entry.text,
              notebookUrls: itemNotebookUrls(entry),
              updatedBy: entry.updatedBy || 'NoSQL Snapshot Import',
              updatedAt: entry.updatedAt || new Date().toISOString()
            });
            prayersCount++;
          }
        });
      }

      if (snapshot.intro) {
        Object.entries(snapshot.intro).forEach(([docId, introBlock]) => {
          if (introBlock && introBlock.title && introBlock.text) {
            prayersStore.put({ docId, ...introBlock });
            prayersCount++;
          }
        });
      }

      if (snapshot.blogEntries) {
        Object.entries(snapshot.blogEntries).forEach(([docId, entry]) => {
          if (entry && entry.title && entry.text) {
            blogStore.put({
              docId,
              dayIndex: entry.dayIndex ?? 0,
              title: entry.title,
              text: entry.text,
              notebookUrls: itemNotebookUrls(entry),
              updatedBy: entry.updatedBy || 'NoSQL Snapshot Import',
              updatedAt: entry.updatedAt || new Date().toISOString()
            });
            blogCount++;
          }
        });
      }

      if (snapshot.bibleEntries && bibleStore) {
        Object.entries(snapshot.bibleEntries).forEach(([docId, entry]) => {
          if (entry && entry.title && entry.text) {
            bibleStore.put({
              docId,
              slotIndex: entry.slotIndex ?? 0,
              title: entry.title,
              text: entry.text,
              notebookUrls: itemNotebookUrls(entry),
              notebookLabels: entry.notebookLabels || [],
              passageUrl: entry.passageUrl || '',
              updatedBy: entry.updatedBy || 'NoSQL Snapshot Import',
              updatedAt: entry.updatedAt || new Date().toISOString()
            });
            bibleCount++;
          }
        });
      }

      tx.oncomplete = () => {
        try {
          localStorage.setItem(DATA_VERSION_KEY, snapshot.version || DATA_VERSION);
        } catch {}
        resolve({ prayersCount, blogCount, bibleCount });
      };

      tx.onerror = (e) => reject(tx.error || e);
    } catch (err) {
      reject(err);
    }
  });
}

function itemNotebookUrls(entry: any): string[] {
  if (Array.isArray(entry.notebookUrls)) return entry.notebookUrls;
  return [];
}

/**
 * Returns a numerical epoch timestamp for an item's updatedAt string.
 * Returns 0 if missing or invalid.
 */
export function getItemTimestamp(item: any): number {
  if (!item || !item.updatedAt) return 0;
  const t = new Date(item.updatedAt).getTime();
  return isNaN(t) ? 0 : t;
}

/**
 * Merges existing and incoming items by comparing updatedAt timestamps.
 * Preserves real user edits while ensuring cloud updates from other devices (e.g. laptop to smartphone)
 * immediately replace unedited local placeholders.
 */
export function mergeItemByNewestState(existing: any, incoming: any): any {
  if (!existing && !incoming) return null;
  if (!existing) return incoming;
  if (!incoming) return existing;

  const existingTs = getItemTimestamp(existing);
  const incomingTs = getItemTimestamp(incoming);

  const defaultSources = [
    'nosql snapshot import',
    'embik365 nosql snapshot',
    'pismo święte biblia365 (1460 czytań)',
    'edytor lokalny'
  ];

  const existingUpdatedBy = String(existing.updatedBy || '').trim().toLowerCase();
  const isExistingUserEdit = existingUpdatedBy.length > 0 && !defaultSources.includes(existingUpdatedBy);

  // If local existing state is a real user edit AND strictly newer than incoming, keep existing
  if (isExistingUserEdit && existingTs > incomingTs) {
    return existing;
  }

  const mergedTitle = (incoming.title !== undefined && incoming.title !== '')
    ? incoming.title
    : (existing.title || incoming.title || '');

  const mergedText = (incoming.text !== undefined && incoming.text !== '')
    ? incoming.text
    : (existing.text || incoming.text || '');

  // Incoming state is newer, or existing was just a default placeholder.
  // Incoming state takes precedence, allowing cross-device edits and modified/cleared fields to persist.
  return {
    ...existing,
    ...incoming,
    title: mergedTitle,
    text: mergedText,
    notebookUrls: incoming.notebookUrls !== undefined ? incoming.notebookUrls : (existing.notebookUrls || []),
    notebookLabels: incoming.notebookLabels !== undefined ? incoming.notebookLabels : (existing.notebookLabels || []),
    updatedBy: incoming.updatedBy || existing.updatedBy,
    updatedAt: incoming.updatedAt || existing.updatedAt
  };
}

/**
 * Fast, chunked Base64 encoder for large UTF-8 strings (e.g. 4MB NoSQL JSON snapshots).
 * Avoids call-stack overflow and string allocation crashes in browser JS engines.
 */
export function stringToBase64Chunked(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const CHUNK_SIZE = 0x8000; // 32768
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return btoa(binary);
}


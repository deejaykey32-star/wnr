import wnrPdfEntriesData from '../data/wnr365_pdf_entries.json';

export interface LocalBlogEntry {
  docId: string;
  dayIndex: number;
  title: string;
  text: string;
  updatedBy: string;
  updatedAt: string;
}

const DB_NAME = 'WnR365LocalNoSqlDb';
const DB_VERSION = 1;
const BLOG_STORE = 'blog_entries';
const PRAYERS_STORE = 'prayers';

const wnrPdfMap = wnrPdfEntriesData as Record<string, { dayIndex: number; title: string; text: string; updatedBy?: string; updatedAt?: string }>;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BLOG_STORE)) {
        db.createObjectStore(BLOG_STORE, { keyPath: 'docId' });
      }
      if (!db.objectStoreNames.contains(PRAYERS_STORE)) {
        db.createObjectStore(PRAYERS_STORE, { keyPath: 'docId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// Increment this version whenever wnr365_pdf_entries.json content changes significantly.
// This forces a full IndexedDB reseed on next app load, clearing stale cached data.
const DATA_VERSION = '2026-08-11-v3';
const DATA_VERSION_KEY = 'wnr365_db_data_version';

/**
 * Initializes local IndexedDB NoSQL database.
 * Seeds / re-seeds all 365 WnR365 entries from the bundled PDF JSON whenever
 * DATA_VERSION changes — ensuring users always get the latest clean data.
 */
export async function initLocalNoSqlDb(): Promise<void> {
  try {
    const storedVersion = localStorage.getItem(DATA_VERSION_KEY);
    const needsReseed = storedVersion !== DATA_VERSION;

    const db = await openDb();
    const tx = db.transaction(BLOG_STORE, 'readwrite');
    const store = tx.objectStore(BLOG_STORE);

    if (needsReseed) {
      console.log(`[NoSQL] Data version changed (${storedVersion} → ${DATA_VERSION}). Re-seeding IndexedDB with fresh PDF data...`);
      // Clear old data so stale entries don't persist
      store.clear();
      Object.entries(wnrPdfMap).forEach(([docId, entry]) => {
        store.put({
          docId,
          dayIndex: entry.dayIndex,
          title: entry.title,
          text: entry.text,
          updatedBy: entry.updatedBy || 'eMBiK365 Księga A5 PDF',
          updatedAt: entry.updatedAt || new Date().toISOString()
        });
      });
      // Wait for transaction to complete before saving version
      tx.oncomplete = () => {
        localStorage.setItem(DATA_VERSION_KEY, DATA_VERSION);
        console.log(`[NoSQL] Re-seed complete. Version set to ${DATA_VERSION}.`);
      };
    } else {
      const countReq = store.count();
      countReq.onsuccess = () => {
        if (countReq.result === 0) {
          console.log('[NoSQL] Empty IndexedDB — seeding with PDF JSON...');
          Object.entries(wnrPdfMap).forEach(([docId, entry]) => {
            store.put({
              docId,
              dayIndex: entry.dayIndex,
              title: entry.title,
              text: entry.text,
              updatedBy: entry.updatedBy || 'eMBiK365 Księga A5 PDF',
              updatedAt: entry.updatedAt || new Date().toISOString()
            });
          });
        }
      };
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
  const result: Record<string, LocalBlogEntry> = {};
  Object.entries(wnrPdfMap).forEach(([docId, entry]) => {
    result[docId] = {
      docId,
      dayIndex: entry.dayIndex,
      title: entry.title,
      text: entry.text,
      updatedBy: entry.updatedBy || 'eMBiK365 Księga A5 PDF',
      updatedAt: entry.updatedAt || '2026-08-11T00:00:00.000Z'
    };
  });
  return result;
}

/**
 * Gets all local blog entries: starts from bundled PDF JSON, overlaid ONLY with
 * admin-edited entries from IndexedDB (not seeded PDF data).
 * NEVER fetches from Firestore.
 */
export async function getAllLocalBlogEntries(): Promise<Record<string, LocalBlogEntry>> {
  const result = getAllLocalBlogEntriesSync();

  // Overlay with IndexedDB entries ONLY if they were admin-edited (not seed data)
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(BLOG_STORE, 'readonly');
      const store = tx.objectStore(BLOG_STORE);
      const req = store.getAll();

      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result)) {
          req.result.forEach((item: LocalBlogEntry) => {
            // Only overlay entries that were genuinely admin-edited, not seeded entries
            if (item && item.docId && item.updatedBy && item.updatedBy !== 'eMBiK365 Księga A5 PDF') {
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
export async function saveLocalBlogEntry(docId: string, entry: { title: string; text: string; dayIndex: number; updatedBy?: string }): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(BLOG_STORE, 'readwrite');
    const store = tx.objectStore(BLOG_STORE);

    const record: LocalBlogEntry = {
      docId,
      dayIndex: entry.dayIndex,
      title: entry.title,
      text: entry.text,
      updatedBy: entry.updatedBy || 'Edytor Lokalny',
      updatedAt: new Date().toISOString()
    };

    store.put(record);
    console.log(`[NoSQL] Saved locally: ${docId}`);
  } catch (err) {
    console.warn('[NoSQL] Failed to save to IndexedDB:', err);
  }
}

/**
 * Resets IndexedDB back to the bundled PDF JSON seed data.
 * Admin only.
 */
export async function resetLocalToSeedData(): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(BLOG_STORE, 'readwrite');
    const store = tx.objectStore(BLOG_STORE);
    store.clear();

    Object.entries(wnrPdfMap).forEach(([docId, entry]) => {
      store.put({
        docId,
        dayIndex: entry.dayIndex,
        title: entry.title,
        text: entry.text,
        updatedBy: entry.updatedBy || 'eMBiK365 Księga A5 PDF',
        updatedAt: entry.updatedAt || new Date().toISOString()
      });
    });

    console.log('[NoSQL] Reset to PDF seed data complete.');
  } catch (err) {
    console.warn('[NoSQL] Failed to reset IndexedDB:', err);
    throw err;
  }
}

/**
 * Saves all prayers to local IndexedDB.
 */
export async function saveLocalPrayers(prayers: Record<string, { title: string; text: string; updatedBy?: string; updatedAt?: string }>): Promise<void> {
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
 * Gets locally stored prayers from IndexedDB.
 */
export async function getLocalPrayers(): Promise<Record<string, { title: string; text: string; updatedBy?: string; updatedAt?: string }> | null> {
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
        const result: Record<string, { title: string; text: string; updatedBy?: string; updatedAt?: string }> = {};
        req.result.forEach((item: { docId: string; title: string; text: string; updatedBy?: string; updatedAt?: string }) => {
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

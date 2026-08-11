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

/**
 * Initializes local IndexedDB NoSQL database and seeds all 365 WnR365 entries from PDF JSON if empty.
 */
export async function initLocalNoSqlDb(): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(BLOG_STORE, 'readwrite');
    const store = tx.objectStore(BLOG_STORE);

    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result === 0) {
        console.log('[NoSQL] Seeding IndexedDB with 365 entries from PDF JSON...');
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
  } catch (err) {
    console.warn('[NoSQL] Failed to initialize IndexedDB:', err);
  }
}

/**
 * Gets all local blog entries: starts from PDF JSON seed, overlaid with IndexedDB user edits.
 * NEVER fetches from Firestore.
 */
export async function getAllLocalBlogEntries(): Promise<Record<string, LocalBlogEntry>> {
  // Start from the bundled PDF JSON (always available)
  const result: Record<string, LocalBlogEntry> = {};
  Object.entries(wnrPdfMap).forEach(([docId, entry]) => {
    result[docId] = {
      docId,
      dayIndex: entry.dayIndex,
      title: entry.title,
      text: entry.text,
      updatedBy: entry.updatedBy || 'eMBiK365 Księga A5 PDF',
      updatedAt: entry.updatedAt || '2026-08-10T00:00:00.000Z'
    };
  });

  // Overlay with IndexedDB user edits (if any)
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

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

    request.onupgradeneeded = (event) => {
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
 * Initializes local IndexedDB NoSQL database and seeds all 365 WnR365 entries
 * extracted from eMBiK365_RHZ365_WnR365_Calosc_Ksiega_A5 (1).pdf if empty.
 */
export async function initLocalNoSqlDb(): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(BLOG_STORE, 'readwrite');
    const store = tx.objectStore(BLOG_STORE);

    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result === 0) {
        console.log('Seeding local NoSQL database (IndexedDB) with 365 entries from PDF...');
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
    console.warn('Failed to initialize local IndexedDB NoSQL database:', err);
  }
}

/**
 * Gets all local blog entries from IndexedDB NoSQL store, falling back to PDF entries dataset.
 */
export async function getAllLocalBlogEntries(): Promise<Record<string, LocalBlogEntry>> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(BLOG_STORE, 'readonly');
      const store = tx.objectStore(BLOG_STORE);
      const req = store.getAll();

      req.onsuccess = () => {
        const result: Record<string, LocalBlogEntry> = {};
        
        // Populate from seed PDF entries first
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

        // Overlay user modifications from IndexedDB
        if (req.result && Array.isArray(req.result)) {
          req.result.forEach((item: LocalBlogEntry) => {
            if (item && item.docId) {
              result[item.docId] = item;
            }
          });
        }

        resolve(result);
      };

      req.onerror = () => {
        resolve(getFallbackPdfEntries());
      };
    });
  } catch {
    return getFallbackPdfEntries();
  }
}

/**
 * Saves a blog entry to local NoSQL IndexedDB store.
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
  } catch (err) {
    console.warn('Failed to save to local IndexedDB NoSQL store:', err);
  }
}

function getFallbackPdfEntries(): Record<string, LocalBlogEntry> {
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
  return result;
}

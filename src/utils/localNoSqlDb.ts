export interface LocalBlogEntry {
  docId: string;
  dayIndex: number;
  title: string;
  text: string;
  updatedBy: string;
  updatedAt: string;
}

const DB_NAME = 'WnR365LocalNoSqlDb';
const DB_VERSION = 2;
const BLOG_STORE = 'blog_entries';
const PRAYERS_STORE = 'prayers';

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
const DATA_VERSION = '2026-08-23-sync-1787535789798';
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
      console.log(`[NoSQL] Data version mismatch or empty DB. Seeding IndexedDB...`);

      // 1. Preload JSON data dynamically BEFORE starting the transaction
      // to avoid TransactionInactiveError while awaiting imports.
      let wnrPdfMap: Record<string, any> = {};
      let prayersMap: Record<string, any> = {};

      try {
        const snapshotModule = await import('../data/db_snapshot.json');
        const snapshotData = snapshotModule.default;
        if (snapshotData) {
          if (snapshotData.blogEntries) wnrPdfMap = snapshotData.blogEntries;
          if (snapshotData.prayers) prayersMap = { ...snapshotData.prayers };
          if (snapshotData.intro) {
            Object.assign(prayersMap, snapshotData.intro);
          }
        }
      } catch (snapErr) {
        console.warn('[NoSQL] db_snapshot.json dynamic import fallback:', snapErr);
      }

      if (Object.keys(wnrPdfMap).length === 0) {
        const module = await import('../data/wnr365_pdf_entries.json');
        wnrPdfMap = module.default as Record<string, any>;
      }

      // 2. Perform clear and seed in a readwrite transaction
      await new Promise<void>((resolve) => {
        try {
          const storeNames: string[] = [];
          if (db.objectStoreNames.contains(BLOG_STORE)) storeNames.push(BLOG_STORE);
          if (db.objectStoreNames.contains(PRAYERS_STORE)) storeNames.push(PRAYERS_STORE);

          if (storeNames.length === 0) {
            resolve();
            return;
          }

          const tx = db.transaction(storeNames, 'readwrite');
          const store = db.objectStoreNames.contains(BLOG_STORE) ? tx.objectStore(BLOG_STORE) : null;
          const prayersStore = db.objectStoreNames.contains(PRAYERS_STORE) ? tx.objectStore(PRAYERS_STORE) : null;

          tx.onerror = (e) => {
            console.warn('[NoSQL] Seeding transaction error:', e);
            resolve();
          };
          tx.onabort = (e) => {
            console.warn('[NoSQL] Seeding transaction aborted:', e);
            resolve();
          };

          // Clear old data so stale entries don't persist
          if (store) store.clear();
          if (prayersStore) prayersStore.clear();

          // Seed prayers
          if (prayersStore) {
            Object.entries(prayersMap).forEach(([docId, p]: [string, any]) => {
              if (p && p.text) {
                prayersStore.put({ docId, ...p });
              }
            });
          }

          // Seed blog entries
          if (store) {
            Object.entries(wnrPdfMap).forEach(([docId, entry]: [string, any]) => {
              try {
                store.put({
                  docId,
                  dayIndex: entry.dayIndex ?? 0,
                  title: entry.title,
                  text: entry.text,
                  updatedBy: entry.updatedBy || 'NoSQL Snapshot (GitHub / Cloudflare)',
                  updatedAt: entry.updatedAt || new Date().toISOString()
                });
              } catch (putErr) {
                console.warn(`[NoSQL] Error putting entry ${docId}:`, putErr);
              }
            });
          }

          tx.oncomplete = () => {
            try {
              localStorage.setItem(DATA_VERSION_KEY, DATA_VERSION);
              console.log(`[NoSQL] Re-seed complete. Version set to ${DATA_VERSION}.`);
            } catch {}
            resolve();
          };
        } catch (txErr) {
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
          console.log('[NoSQL] Reset to PDF seed data complete.');
          resolve();
        };
      } catch (txErr) {
        reject(txErr);
      }
    });
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
 * Saves a single prayer or intro block to local IndexedDB.
 */
export async function saveSingleLocalPrayer(docId: string, prayer: { title: string; text: string; updatedBy?: string; updatedAt?: string }): Promise<void> {
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

export interface FullNoSqlSnapshot {
  version: string;
  exportedAt: string;
  source: string;
  intro: {
    introTextMain?: { title: string; text: string; updatedBy?: string; updatedAt?: string };
    introTextMission?: { title: string; text: string; updatedBy?: string; updatedAt?: string };
    [key: string]: any;
  };
  prayers: Record<string, { title: string; text: string; updatedBy?: string; updatedAt?: string }>;
  blogEntries: Record<string, { title: string; text: string; dayIndex: number; updatedBy?: string; updatedAt?: string }>;
}

/**
 * Creates a complete, unified NoSQL database snapshot containing all days of RHZ365, WnR365, and Intro blocks.
 */
export function createNoSqlSnapshot(
  prayersData: Record<string, { title: string; text: string; updatedBy?: string; updatedAt?: string }>,
  blogEntriesData: Record<string, { title: string; text: string; dayIndex: number; updatedBy?: string; updatedAt?: string }>
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
    blogEntries: blogEntriesData
  };
}

/**
 * Imports a full NoSQL snapshot into IndexedDB in a single clean transaction.
 */
export async function importFullNoSqlSnapshot(snapshot: FullNoSqlSnapshot): Promise<{ prayersCount: number; blogCount: number }> {
  const db = await openDb();

  return new Promise<{ prayersCount: number; blogCount: number }>((resolve, reject) => {
    try {
      const tx = db.transaction([BLOG_STORE, PRAYERS_STORE], 'readwrite');
      const blogStore = tx.objectStore(BLOG_STORE);
      const prayersStore = tx.objectStore(PRAYERS_STORE);

      let prayersCount = 0;
      let blogCount = 0;

      if (snapshot.prayers) {
        Object.entries(snapshot.prayers).forEach(([docId, prayer]) => {
          if (prayer && prayer.title && prayer.text) {
            prayersStore.put({ docId, ...prayer });
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
              updatedBy: entry.updatedBy || 'NoSQL Snapshot Import',
              updatedAt: entry.updatedAt || new Date().toISOString()
            });
            blogCount++;
          }
        });
      }

      tx.oncomplete = () => {
        try {
          localStorage.setItem(DATA_VERSION_KEY, snapshot.version || DATA_VERSION);
        } catch {}
        resolve({ prayersCount, blogCount });
      };

      tx.onerror = (e) => reject(tx.error || e);
    } catch (err) {
      reject(err);
    }
  });
}

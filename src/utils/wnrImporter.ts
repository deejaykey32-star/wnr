import { doc, setDoc, Firestore } from 'firebase/firestore';
import { getAllWnrDefaultBlogEntries, WnrBlogEntry } from './wnrBlogDefaults';

export interface WnrRestoreReport {
  totalEntries: number; // 366
  restoredCount: number;
  errorCount: number;
  errors: string[];
}

/**
 * Batch-restores and upserts all 366 WnR365 blog entries into Firestore collection `blog_entries`,
 * ensuring exact alignment with RHZ365 JSON data and any user corrections in Firestore.
 */
export async function restoreAllWnrBlogEntries(
  db: Firestore,
  updatedBy: string = 'Dominik',
  prayers: Record<string, any> = {},
  blogEntries: Record<string, any> = {},
  onProgress?: (current: number, total: number) => void
): Promise<WnrRestoreReport> {
  const allDefaults = getAllWnrDefaultBlogEntries(prayers, blogEntries);
  const entriesList = Object.entries(allDefaults); // Array of [docId, entry]
  
  let restoredCount = 0;
  let errorCount = 0;
  const errors: string[] = [];
  const nowStr = new Date().toISOString();

  for (let i = 0; i < entriesList.length; i++) {
    const [docId, entry] = entriesList[i];
    
    if (onProgress) {
      onProgress(i + 1, entriesList.length);
    }

    try {
      const blogDocRef = doc(db, 'blog_entries', docId);
      await setDoc(blogDocRef, {
        title: entry.title,
        text: entry.text,
        dayIndex: entry.dayIndex,
        updatedBy: updatedBy || 'Dominik',
        updatedAt: nowStr
      }, { merge: true });

      restoredCount++;
    } catch (err: any) {
      errorCount++;
      const msg = `Błąd zapisu wpisu ${docId}: ${err?.message || 'Nieznany błąd'}`;
      console.error(msg, err);
      errors.push(msg);
    }
  }

  return {
    totalEntries: entriesList.length,
    restoredCount,
    errorCount,
    errors
  };
}

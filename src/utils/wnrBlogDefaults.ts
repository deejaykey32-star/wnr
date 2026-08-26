export interface WnrBlogEntry {
  title: string;
  text: string;
  dayIndex: number;
  notebookUrls?: string[];
  notebookLabels?: string[];
  updatedBy?: string;
  updatedAt?: string;
}

interface RHZItem {
  dayNumber: number;
  dayMonth: string;
  cycle: number;
  stage: number;
  part: number;
  mystery: number;
  title: string;
  text: string;
}

let loadedWnrPdfMap: Record<string, { dayIndex: number; title: string; text: string; notebookUrls?: string[]; notebookLabels?: string[]; updatedBy?: string; updatedAt?: string }> | null = null;
let loadedRhzList: RHZItem[] | null = null;

export async function loadWnrBlogDefaultsData(): Promise<void> {
  if (loadedWnrPdfMap && loadedRhzList) return;
  const [wnrData, rhzData] = await Promise.all([
    import('../data/wnr365_pdf_entries.json'),
    import('../../RHZ365_pierwszy_cykl_175_dni.json')
  ]);
  loadedWnrPdfMap = wnrData.default;
  loadedRhzList = rhzData.default as RHZItem[];
}

function getWnrPdfMap() {
  return loadedWnrPdfMap || {};
}

function getRhzList() {
  return loadedRhzList || [];
}

/**
 * Helper to check if a blog text is a legacy generic placeholder/preamble
 */
export function isGenericBlogText(text?: string): boolean {
  if (!text || text.trim().length === 0) return true;
  return text.includes("Chwała Jezusowi w Bogu Ojcu!") ||
         text.includes("To jest Twój wpis blogowy Widoki na Raj") ||
         text.includes("Kliknij przycisk „Edytuj Wpis” powyżej") ||
         text.includes("elektronicznej Misji Barw i Kolorów");
}

/**
 * FORCES authentic WnR365 entry extracted directly from eMBiK365 Księga A5 PDF
 * for ALL days, discarding any legacy dummy data.
 */
export function getWnrDefaultBlogEntry(
  dayIndex: number, 
  prayers: Record<string, any> = {},
  blogEntries: Record<string, any> = {}
): WnrBlogEntry {
  const safeDayIndex = Math.max(0, Math.min(365, dayIndex));
  const blogKey = `blog_day_${safeDayIndex}`;

  // 1. Primary Source of Truth: Extracted Entry from eMBiK365_RHZ365_WnR365_Calosc_Ksiega_A5 (1).pdf
  const pdfMap = getWnrPdfMap();
  const pdfEntry = pdfMap[blogKey];

  // 2. Check if there is an explicit user edit in blogEntries saved recently by an editor
  const customBlog = blogEntries[blogKey];
  if (customBlog && customBlog.text && customBlog.title) {
    if (!isGenericBlogText(customBlog.text) && 
        customBlog.updatedBy && 
        customBlog.updatedBy !== 'eMBiK365 Księga A5 PDF' && 
        customBlog.updatedBy !== 'System RHZ365' &&
        customBlog.text.trim().length > 20) {
      return {
        dayIndex: safeDayIndex,
        title: customBlog.title.trim(),
        text: customBlog.text.trim(),
        notebookUrls: customBlog.notebookUrls || [],
        updatedBy: customBlog.updatedBy,
        updatedAt: customBlog.updatedAt || new Date().toISOString()
      };
    }
  }

  // 3. Return authentic PDF entry extracted from eMBiK365_RHZ365_WnR365_Calosc_Ksiega_A5 (1).pdf
  if (pdfEntry && pdfEntry.text && pdfEntry.text.trim().length > 0) {
    return {
      dayIndex: safeDayIndex,
      title: pdfEntry.title.trim(),
      text: pdfEntry.text.trim(),
      notebookUrls: customBlog?.notebookUrls || pdfEntry.notebookUrls || [],
      updatedBy: pdfEntry.updatedBy || 'eMBiK365 Księga A5 PDF',
      updatedAt: pdfEntry.updatedAt || '2026-08-10T00:00:00.000Z'
    };
  }

  // 4. Fallback to RHZ item if PDF entry not found
  let dayOfCycle = safeDayIndex + 1;
  if (safeDayIndex >= 175 && safeDayIndex < 182) {
    dayOfCycle = safeDayIndex - 174;
  } else if (safeDayIndex >= 182 && safeDayIndex < 357) {
    dayOfCycle = safeDayIndex - 181;
  } else if (safeDayIndex >= 357) {
    dayOfCycle = safeDayIndex - 356;
  }

  const rhzList = getRhzList();
  const jsonRecord = rhzList.find(r => r.dayNumber === dayOfCycle) || (rhzList.length > 0 ? rhzList[0] : null);

  return {
    dayIndex: safeDayIndex,
    title: jsonRecord ? jsonRecord.title.trim() : `WnR365 — Dzień ${safeDayIndex + 1}`,
    text: jsonRecord ? jsonRecord.text.trim() : `Rozważanie dnia ${safeDayIndex + 1}.`,
    notebookUrls: [],
    updatedBy: 'System RHZ365',
    updatedAt: '2026-08-10T00:00:00.000Z'
  };
}

export function getAllWnrDefaultBlogEntries(
  prayers: Record<string, any> = {},
  blogEntries: Record<string, any> = {}
): Record<string, WnrBlogEntry> {
  const result: Record<string, WnrBlogEntry> = {};
  for (let i = 0; i <= 365; i++) {
    const docId = `blog_day_${i}`;
    result[docId] = getWnrDefaultBlogEntry(i, prayers, blogEntries);
  }
  return result;
}

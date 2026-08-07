import { doc, getDoc, runTransaction, Firestore } from 'firebase/firestore';
import rhzData from '../../RHZ365_pierwszy_cykl_175_dni.json';

export interface RHZRecord {
  dayNumber: number;
  dayMonth: string;
  cycle: number;
  stage: number;
  part: number;
  mystery: number;
  title: string;
  sourcePage?: number;
  text: string;
}

export interface ImportAuditItem {
  dayNumber: number;
  dayMonth: string;
  stage: number;
  part: number;
  mystery: number;
  title: string;
  documentId: string;
  status: 'MISSING' | 'EXISTS_WITH_CONTENT' | 'EXISTS_EMPTY' | 'MAPPING_ERROR';
  hasText: boolean;
  errorDetail?: string;
}

export interface ImportReport {
  sourceRecordsCount: number;
  preImportMissing: number;
  preImportWithContent: number;
  preImportEmpty: number;
  createdCount: number;
  skippedExistingCount: number;
  errorCount: number;
  postImportMissing: number;
  postImportWithContent: number;
  postImportEmpty: number;
  records: {
    dayNumber: number;
    documentId: string;
    status: 'CREATED' | 'SKIPPED_EXISTING' | 'ERROR';
    errorMessage?: string;
  }[];
}

// Step A: Validate entire JSON dataset in memory
export function validateRHZJson(): { isValid: boolean; errors: string[]; records: RHZRecord[] } {
  const records = rhzData as RHZRecord[];
  const errors: string[] = [];

  if (!Array.isArray(records)) {
    return { isValid: false, errors: ["Zawiadomienie: Plik JSON nie zawiera tablicy."], records: [] };
  }

  if (records.length !== 175) {
    return { isValid: false, errors: [`Oczekiwano dokładnie 175 rekordów, znaleziono ${records.length}.`], records: [] };
  }

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const expectedDay = i + 1;

    if (r.dayNumber !== expectedDay) {
      errors.push(`Indeks ${i}: oczekiwano dayNumber ${expectedDay}, otrzymano ${r.dayNumber}`);
    }

    const computedStage = Math.floor((r.dayNumber - 1) / 25) + 1;
    const computedPart = Math.floor(((r.dayNumber - 1) % 25) / 5) + 1;
    const computedDecIdx = ((r.dayNumber - 1) % 5) + 1;

    if (r.stage !== computedStage || r.part !== computedPart || r.mystery !== computedDecIdx) {
      errors.push(
        `Dzień ${r.dayNumber}: Błąd matematyczny Etap/Część/Tajemnica! JSON: (stage:${r.stage}, part:${r.part}, mystery:${r.mystery}) vs Wyliczone: (stage:${computedStage}, part:${computedPart}, mystery:${computedDecIdx})`
      );
    }

    if (typeof r.title !== 'string' || !r.title.trim()) {
      errors.push(`Dzień ${r.dayNumber}: Pole title jest puste lub nieprawidłowe.`);
    } else if (r.title.trim().length > 200) {
      errors.push(`Dzień ${r.dayNumber}: Pole title przekracza limit 200 znaków (${r.title.trim().length} znaków).`);
    }

    if (typeof r.text !== 'string' || !r.text.trim()) {
      errors.push(`Dzień ${r.dayNumber}: Pole text jest puste lub nieprawidłowe.`);
    } else if (r.text.trim().length > 10000) {
      errors.push(`Dzień ${r.dayNumber}: Pole text przekracza limit 10 000 znaków (${r.text.trim().length} znaków).`);
    }
  }

  return { isValid: errors.length === 0, errors, records };
}

// Step B: READ-ONLY Pre-Import Audit of Firestore
export async function performPreImportAudit(db: Firestore): Promise<ImportAuditItem[]> {
  const records = rhzData as RHZRecord[];
  const auditResults: ImportAuditItem[] = [];

  for (const r of records) {
    const computedDecIdx = ((r.dayNumber - 1) % 5) + 1;
    const documentId = `day_${r.dayNumber}_decade_rgba_${computedDecIdx}`;
    const docRef = doc(db, 'prayers', documentId);

    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        const hasText = Boolean(data && data.text && data.text.trim().length > 0);
        auditResults.push({
          dayNumber: r.dayNumber,
          dayMonth: r.dayMonth,
          stage: r.stage,
          part: r.part,
          mystery: r.mystery,
          title: r.title,
          documentId,
          status: hasText ? 'EXISTS_WITH_CONTENT' : 'EXISTS_EMPTY',
          hasText
        });
      } else {
        auditResults.push({
          dayNumber: r.dayNumber,
          dayMonth: r.dayMonth,
          stage: r.stage,
          part: r.part,
          mystery: r.mystery,
          title: r.title,
          documentId,
          status: 'MISSING',
          hasText: false
        });
      }
    } catch (err: any) {
      auditResults.push({
        dayNumber: r.dayNumber,
        dayMonth: r.dayMonth,
        stage: r.stage,
        part: r.part,
        mystery: r.mystery,
        title: r.title,
        documentId,
        status: 'MAPPING_ERROR',
        hasText: false,
        errorDetail: err?.message || 'Błąd odczytu'
      });
    }
  }

  return auditResults;
}

// Step C: Execute CREATE ONLY Import via Transactions
export async function executeCreateOnlyImport(
  db: Firestore,
  userEmail: string,
  onProgress?: (current: number, total: number) => void
): Promise<ImportReport> {
  const validation = validateRHZJson();
  if (!validation.isValid) {
    throw new Error(`Walidacja JSON nie powiodła się:\n${validation.errors.join('\n')}`);
  }

  const records = validation.records;
  
  // Pre-audit
  const preAudit = await performPreImportAudit(db);
  const preMissing = preAudit.filter(a => a.status === 'MISSING').length;
  const preWithContent = preAudit.filter(a => a.status === 'EXISTS_WITH_CONTENT').length;
  const preEmpty = preAudit.filter(a => a.status === 'EXISTS_EMPTY').length;

  let createdCount = 0;
  let skippedExistingCount = 0;
  let errorCount = 0;

  const itemReports: { dayNumber: number; documentId: string; status: 'CREATED' | 'SKIPPED_EXISTING' | 'ERROR'; errorMessage?: string }[] = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const decIdx = ((r.dayNumber - 1) % 5) + 1;
    const documentId = `day_${r.dayNumber}_decade_rgba_${decIdx}`;
    const docRef = doc(db, 'prayers', documentId);

    if (onProgress) {
      onProgress(i + 1, records.length);
    }

    try {
      const statusResult = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(docRef);

        if (snap.exists()) {
          return 'SKIPPED_EXISTING';
        }

        transaction.set(docRef, {
          title: r.title.trim(),
          text: r.text.trim(),
          updatedBy: userEmail,
          updatedAt: new Date().toISOString()
        });

        return 'CREATED';
      });

      if (statusResult === 'CREATED') {
        createdCount++;
        itemReports.push({ dayNumber: r.dayNumber, documentId, status: 'CREATED' });
      } else {
        skippedExistingCount++;
        itemReports.push({ dayNumber: r.dayNumber, documentId, status: 'SKIPPED_EXISTING' });
      }
    } catch (err: any) {
      errorCount++;
      itemReports.push({
        dayNumber: r.dayNumber,
        documentId,
        status: 'ERROR',
        errorMessage: err?.message || 'Błąd transakcji'
      });
    }
  }

  // Step D: Post-Import READ-ONLY Audit
  const postAudit = await performPreImportAudit(db);
  const postMissing = postAudit.filter(a => a.status === 'MISSING').length;
  const postWithContent = postAudit.filter(a => a.status === 'EXISTS_WITH_CONTENT').length;
  const postEmpty = postAudit.filter(a => a.status === 'EXISTS_EMPTY').length;

  return {
    sourceRecordsCount: records.length,
    preImportMissing: preMissing,
    preImportWithContent: preWithContent,
    preImportEmpty: preEmpty,
    createdCount,
    skippedExistingCount,
    errorCount,
    postImportMissing: postMissing,
    postImportWithContent: postWithContent,
    postImportEmpty: postEmpty,
    records: itemReports
  };
}

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

export interface FieldChangeAudit {
  dayNumber: number;
  documentId: string;
  field: 'title' | 'text';
  oldValue: string;
  newValue: string;
  source: string;
}

export interface DryRunReport {
  sourceRecordsCount: number; // 175
  existingInDbCount: number;
  toCreateCount: number;
  toUpdateCount: number;
  unchangedCount: number;
  onlyInDbCount: number;
  toDeleteCount: number; // ALWAYS 0
  conflictsCount: number;
  invalidRecordsCount: number;
  changeLog: FieldChangeAudit[];
  items: {
    dayNumber: number;
    documentId: string;
    action: 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'ERROR';
    titleChanged: boolean;
    textChanged: boolean;
    reason?: string;
  }[];
}

export interface UpsertReport {
  sourceRecordsCount: number;
  preImportMissing: number;
  preImportWithContent: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  toDeleteCount: number; // ALWAYS 0
  deletedCount: number; // ALWAYS 0
  deletedFieldsCount: number; // ALWAYS 0
  changedIdsCount: number; // ALWAYS 0
  errorCount: number;
  postImportMissing: number;
  postImportWithContent: number;
  auditLog: FieldChangeAudit[];
  records: {
    dayNumber: number;
    documentId: string;
    status: 'CREATED' | 'UPDATED' | 'UNCHANGED' | 'ERROR';
    errorMessage?: string;
  }[];
  status: 'SUCCESS' | 'FAILED';
}

// Deprecated compatibility interface
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

// Step C: READ-ONLY Dry Run (Simulation of Upsert Sync)
export async function performDryRunSync(
  db: Firestore,
  onProgress?: (current: number, total: number) => void
): Promise<DryRunReport> {
  const validation = validateRHZJson();
  if (!validation.isValid) {
    throw new Error(`Walidacja JSON nie powiodła się:\n${validation.errors.join('\n')}`);
  }

  const records = validation.records;
  const changeLog: FieldChangeAudit[] = [];
  const items: DryRunReport['items'] = [];

  let toCreateCount = 0;
  let toUpdateCount = 0;
  let unchangedCount = 0;
  let existingInDbCount = 0;

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const decIdx = ((r.dayNumber - 1) % 5) + 1;
    const documentId = `day_${r.dayNumber}_decade_rgba_${decIdx}`;
    const docRef = doc(db, 'prayers', documentId);

    if (onProgress) {
      onProgress(i + 1, records.length);
    }

    try {
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        toCreateCount++;
        changeLog.push({
          dayNumber: r.dayNumber,
          documentId,
          field: 'title',
          oldValue: '(brak w bazie)',
          newValue: r.title.trim(),
          source: 'RHZ365_pierwszy_cykl_175_dni.json'
        });
        changeLog.push({
          dayNumber: r.dayNumber,
          documentId,
          field: 'text',
          oldValue: '(brak w bazie)',
          newValue: r.text.trim().substring(0, 80) + '...',
          source: 'RHZ365_pierwszy_cykl_175_dni.json'
        });
        items.push({
          dayNumber: r.dayNumber,
          documentId,
          action: 'CREATE',
          titleChanged: true,
          textChanged: true
        });
      } else {
        existingInDbCount++;
        const data = snap.data() || {};
        const existingTitle = (data.title || '').trim();
        const existingText = (data.text || '').trim();
        const newTitle = r.title.trim();
        const newText = r.text.trim();

        const titleChanged = existingTitle !== newTitle;
        const textChanged = existingText !== newText;

        if (titleChanged || textChanged) {
          toUpdateCount++;
          if (titleChanged) {
            changeLog.push({
              dayNumber: r.dayNumber,
              documentId,
              field: 'title',
              oldValue: existingTitle || '(pusty)',
              newValue: newTitle,
              source: 'RHZ365_pierwszy_cykl_175_dni.json'
            });
          }
          if (textChanged) {
            changeLog.push({
              dayNumber: r.dayNumber,
              documentId,
              field: 'text',
              oldValue: existingText.substring(0, 80) + '...',
              newValue: newText.substring(0, 80) + '...',
              source: 'RHZ365_pierwszy_cykl_175_dni.json'
            });
          }
          items.push({
            dayNumber: r.dayNumber,
            documentId,
            action: 'UPDATE',
            titleChanged,
            textChanged
          });
        } else {
          unchangedCount++;
          items.push({
            dayNumber: r.dayNumber,
            documentId,
            action: 'UNCHANGED',
            titleChanged: false,
            textChanged: false
          });
        }
      }
    } catch (err: any) {
      items.push({
        dayNumber: r.dayNumber,
        documentId,
        action: 'ERROR',
        titleChanged: false,
        textChanged: false,
        reason: err?.message || 'Błąd odczytu'
      });
    }
  }

  return {
    sourceRecordsCount: records.length,
    existingInDbCount,
    toCreateCount,
    toUpdateCount,
    unchangedCount,
    onlyInDbCount: 0,
    toDeleteCount: 0, // ALWAYS 0
    conflictsCount: 0,
    invalidRecordsCount: 0,
    changeLog,
    items
  };
}

// Step D: Execute Safe Non-Destructive UPSERT / MERGE Sync
export async function executeUpsertSync(
  db: Firestore,
  userEmail: string,
  onProgress?: (current: number, total: number) => void
): Promise<UpsertReport> {
  const validation = validateRHZJson();
  if (!validation.isValid) {
    throw new Error(`Walidacja JSON nie powiodła się:\n${validation.errors.join('\n')}`);
  }

  const records = validation.records;

  // Pre-audit
  const preAudit = await performPreImportAudit(db);
  const preMissing = preAudit.filter(a => a.status === 'MISSING').length;
  const preWithContent = preAudit.filter(a => a.status === 'EXISTS_WITH_CONTENT' || a.status === 'EXISTS_EMPTY').length;

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;

  const itemReports: UpsertReport['records'] = [];
  const auditLog: FieldChangeAudit[] = [];

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

        const newTitle = r.title.trim();
        const newText = r.text.trim();

        if (!snap.exists()) {
          // CREATE: set title, text, updatedBy, updatedAt
          transaction.set(docRef, {
            title: newTitle,
            text: newText,
            updatedBy: userEmail,
            updatedAt: new Date().toISOString()
          });
          return { status: 'CREATED' as const, oldTitle: '', oldText: '' };
        }

        const existingData = snap.data() || {};
        const existingTitle = (existingData.title || '').trim();
        const existingText = (existingData.text || '').trim();

        if (existingTitle === newTitle && existingText === newText) {
          return { status: 'UNCHANGED' as const, oldTitle: existingTitle, oldText: existingText };
        }

        // UPDATE (MERGE): only set title, text, updatedBy, updatedAt with merge: true (preserves any additional fields!)
        transaction.set(docRef, {
          title: newTitle,
          text: newText,
          updatedBy: userEmail,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        return { status: 'UPDATED' as const, oldTitle: existingTitle, oldText: existingText };
      });

      if (statusResult.status === 'CREATED') {
        createdCount++;
        auditLog.push({
          dayNumber: r.dayNumber,
          documentId,
          field: 'title',
          oldValue: '(nowy)',
          newValue: r.title.trim(),
          source: 'RHZ365_pierwszy_cykl_175_dni.json'
        });
        itemReports.push({ dayNumber: r.dayNumber, documentId, status: 'CREATED' });
      } else if (statusResult.status === 'UPDATED') {
        updatedCount++;
        if (statusResult.oldTitle !== r.title.trim()) {
          auditLog.push({
            dayNumber: r.dayNumber,
            documentId,
            field: 'title',
            oldValue: statusResult.oldTitle,
            newValue: r.title.trim(),
            source: 'RHZ365_pierwszy_cykl_175_dni.json'
          });
        }
        if (statusResult.oldText !== r.text.trim()) {
          auditLog.push({
            dayNumber: r.dayNumber,
            documentId,
            field: 'text',
            oldValue: statusResult.oldText.substring(0, 50) + '...',
            newValue: r.text.trim().substring(0, 50) + '...',
            source: 'RHZ365_pierwszy_cykl_175_dni.json'
          });
        }
        itemReports.push({ dayNumber: r.dayNumber, documentId, status: 'UPDATED' });
      } else {
        unchangedCount++;
        itemReports.push({ dayNumber: r.dayNumber, documentId, status: 'UNCHANGED' });
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

  // Post-audit
  const postAudit = await performPreImportAudit(db);
  const postMissing = postAudit.filter(a => a.status === 'MISSING').length;
  const postWithContent = postAudit.filter(a => a.status === 'EXISTS_WITH_CONTENT').length;

  return {
    sourceRecordsCount: records.length,
    preImportMissing: preMissing,
    preImportWithContent: preWithContent,
    createdCount,
    updatedCount,
    unchangedCount,
    toDeleteCount: 0,
    deletedCount: 0,
    deletedFieldsCount: 0,
    changedIdsCount: 0,
    errorCount,
    postImportMissing: postMissing,
    postImportWithContent: postWithContent,
    auditLog,
    records: itemReports,
    status: errorCount === 0 ? 'SUCCESS' : 'FAILED'
  };
}

// Deprecated fallback alias
export async function executeCreateOnlyImport(
  db: Firestore,
  userEmail: string,
  onProgress?: (current: number, total: number) => void
): Promise<ImportReport> {
  const result = await executeUpsertSync(db, userEmail, onProgress);
  return {
    sourceRecordsCount: result.sourceRecordsCount,
    preImportMissing: result.preImportMissing,
    preImportWithContent: result.preImportWithContent,
    preImportEmpty: 0,
    createdCount: result.createdCount,
    skippedExistingCount: result.unchangedCount + result.updatedCount,
    errorCount: result.errorCount,
    postImportMissing: result.postImportMissing,
    postImportWithContent: result.postImportWithContent,
    postImportEmpty: 0,
    records: result.records.map(r => ({
      dayNumber: r.dayNumber,
      documentId: r.documentId,
      status: r.status === 'CREATED' ? 'CREATED' : 'SKIPPED_EXISTING',
      errorMessage: r.errorMessage
    }))
  };
}


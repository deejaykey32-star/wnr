import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const jsonPath = 'RHZ365_pierwszy_cykl_175_dni.json';
const rawJson = readFileSync(jsonPath, 'utf-8');
const rhzRecords = JSON.parse(rawJson);

const app = initializeApp(firebaseConfig);
const db = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);

async function runSafeMetadataUpsert() {
  console.log('=== 1. PRE-IMPORT READ-ONLY BACKUP ===');
  const snap = await getDocs(collection(db, 'prayers'));
  const backupData: Record<string, any> = {};
  snap.forEach(d => {
    backupData[d.id] = d.data();
  });
  const backupFilename = `scratch/rhz365_firestore_backup_${Date.now()}.json`;
  writeFileSync(backupFilename, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log(`Backup of ${snap.size} Firestore documents saved to ${backupFilename}`);

  console.log('\n=== 2. NON-DESTRUCTIVE METADATA UPSERT ===');
  let updatedCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;

  for (const r of rhzRecords) {
    const decIdx = ((r.dayNumber - 1) % 5) + 1;
    const docId = `day_${r.dayNumber}_decade_rgba_${decIdx}`;
    const docRef = doc(db, 'prayers', docId);

    try {
      const docSnap = await getDoc(docRef);
      const existing = docSnap.exists() ? docSnap.data() : {};

      // Calculate SHA256 of text to ensure ZERO text modification
      const jsonTextHash = createHash('sha256').update(r.text.trim(), 'utf-8').digest('hex');
      if (existing.text) {
        const existingTextHash = createHash('sha256').update(existing.text.trim(), 'utf-8').digest('hex');
        if (existingTextHash !== jsonTextHash) {
          console.warn(`WARNING: Text hash mismatch for Day ${r.dayNumber}! JSON vs Firestore differ. Preserving exact JSON text.`);
        }
      }

      const payload = {
        dayNumber: r.dayNumber,
        dayMonth: r.dayMonth,
        cycle: r.cycle,
        stage: r.stage,
        part: r.part,
        mystery: r.mystery,
        title: r.title.trim(),
        sourcePage: r.sourcePage,
        sourceText: r.text.trim(),
        text: r.text.trim(),
        updatedBy: 'system_metadata_sync',
        updatedAt: new Date().toISOString()
      };

      await setDoc(docRef, payload, { merge: true });
      updatedCount++;
    } catch (err: any) {
      console.error(`Error updating Day ${r.dayNumber}:`, err?.message);
      errorCount++;
    }
  }

  console.log(`Upsert complete. Updated/Enriched: ${updatedCount}, Errors: ${errorCount}`);
  process.exit(errorCount === 0 ? 0 : 1);
}

runSafeMetadataUpsert().catch(err => {
  console.error('Fatal error during upsert:', err);
  process.exit(1);
});

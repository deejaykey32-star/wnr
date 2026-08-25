import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// 1. Read config
const configPath = resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

// 2. Init Firebase
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

async function syncAllToFirestore() {
  console.log('🚀 Starting full backup/sync from local files to Firestore...');
  let totalCount = 0;

  // ── A. BACKUP BLOG ENTRIES (WnR365) ──────────────────────────────────────
  const wnrJsonPath = resolve(process.cwd(), 'src/data/wnr365_pdf_entries.json');
  try {
    const wnrData: Record<string, any> = JSON.parse(readFileSync(wnrJsonPath, 'utf-8'));
    console.log(`📤 Syncing ${Object.keys(wnrData).length} WnR365 blog entries to Firestore collection 'blog_entries'...`);
    
    for (const [docId, entry] of Object.entries(wnrData)) {
      if (entry && entry.title && entry.text) {
        await setDoc(doc(db, 'blog_entries', docId), {
          dayIndex: entry.dayIndex ?? 0,
          title: entry.title,
          text: entry.text,
          notebookUrls: entry.notebookUrls || [],
          updatedBy: entry.updatedBy || 'GitHub Repository Backup',
          updatedAt: entry.updatedAt || new Date().toISOString()
        }, { merge: true });
        totalCount++;
      }
    }
    console.log(`✅ Completed WnR365 blog entries sync.`);
  } catch (e) {
    console.error('❌ Error syncing WnR365 blog entries:', e);
  }

  // ── B. BACKUP RHZ365 & PRAYERS ───────────────────────────────────────────
  const rhzJsonPath = resolve(process.cwd(), 'RHZ365_pierwszy_cykl_175_dni.json');
  try {
    const rhzRecords: any[] = JSON.parse(readFileSync(rhzJsonPath, 'utf-8'));
    console.log(`📤 Syncing ${rhzRecords.length} RHZ365 day records to Firestore collection 'prayers'...`);
    
    for (const record of rhzRecords) {
      if (record && record.dayNumber) {
        const docId = `day_${record.dayNumber}`;
        await setDoc(doc(db, 'prayers', docId), {
          title: record.title,
          text: record.text,
          dayNumber: record.dayNumber,
          cycle: record.cycle,
          stage: record.stage,
          part: record.part,
          mystery: record.mystery,
          notebookUrls: record.notebookUrls || [],
          updatedBy: 'GitHub Repository Backup',
          updatedAt: new Date().toISOString()
        }, { merge: true });
        totalCount++;
      }
    }
    console.log(`✅ Completed RHZ365 day records sync.`);
  } catch (e) {
    console.error('❌ Error syncing RHZ365 records:', e);
  }

  // ── C. BACKUP DB SNAPSHOT (Bible & Intro Texts) ──────────────────────────
  const snapshotJsonPath = resolve(process.cwd(), 'src/data/db_snapshot.json');
  try {
    const snapshot = JSON.parse(readFileSync(snapshotJsonPath, 'utf-8'));
    if (snapshot.prayers) {
      console.log(`📤 Syncing additional prayers/intro texts from db_snapshot.json...`);
      for (const [docId, prayer] of Object.entries(snapshot.prayers as Record<string, any>)) {
        if (prayer && prayer.text) {
          await setDoc(doc(db, 'prayers', docId), {
            title: prayer.title || '',
            text: prayer.text,
            notebookUrls: prayer.notebookUrls || [],
            updatedBy: prayer.updatedBy || 'GitHub Repository Backup',
            updatedAt: prayer.updatedAt || new Date().toISOString()
          }, { merge: true });
          totalCount++;
        }
      }
    }
    if (snapshot.bibleEntries) {
      console.log(`📤 Syncing ${Object.keys(snapshot.bibleEntries).length} Biblia365 entries to Firestore collection 'bible_entries'...`);
      for (const [docId, entry] of Object.entries(snapshot.bibleEntries as Record<string, any>)) {
        if (entry && entry.title && entry.text) {
          await setDoc(doc(db, 'bible_entries', docId), {
            slotIndex: entry.slotIndex ?? 0,
            title: entry.title,
            text: entry.text,
            notebookUrls: entry.notebookUrls || [],
            updatedBy: entry.updatedBy || 'GitHub Repository Backup',
            updatedAt: entry.updatedAt || new Date().toISOString()
          }, { merge: true });
          totalCount++;
        }
      }
    }
  } catch (e) {
    console.info('ℹ️ db_snapshot.json read skipped or not present:', e);
  }

  console.log(`\n🎉 Full Backup to Firestore completed successfully! Total documents synced: ${totalCount}`);
  process.exit(0);
}

syncAllToFirestore().catch(err => {
  console.error('❌ Backup to Firestore failed:', err);
  process.exit(1);
});

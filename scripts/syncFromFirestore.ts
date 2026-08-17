import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// 1. Read config
const configPath = resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

// 2. Init Firebase
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

async function syncAllFromFirestore() {
  console.log('🔄 Starting full sync from Firestore to local JSON files...');
  let changesCount = 0;

  // ── A. SYNC BLOG ENTRIES ──────────────────────────────────────────────────
  const wnrJsonPath = resolve(process.cwd(), 'src/data/wnr365_pdf_entries.json');
  let wnrData: Record<string, any> = {};
  try {
    wnrData = JSON.parse(readFileSync(wnrJsonPath, 'utf-8'));
  } catch (e) {
    console.warn('Could not load existing wnr365_pdf_entries.json, starting empty');
  }

  console.log('📥 Fetching blog_entries from Firestore...');
  const blogSnap = await getDocs(collection(db, 'blog_entries'));
  let updatedBlogs = 0;

  blogSnap.forEach(docSnap => {
    const id = docSnap.id;
    const data = docSnap.data();

    if (data && data.title && data.text) {
      const existing = wnrData[id];
      if (
        !existing ||
        existing.title !== data.title ||
        existing.text !== data.text ||
        existing.dayIndex !== data.dayIndex
      ) {
        wnrData[id] = {
          dayIndex: data.dayIndex ?? 0,
          title: data.title,
          text: data.text,
          updatedBy: data.updatedBy || 'Firestore Sync',
          updatedAt: data.updatedAt || new Date().toISOString()
        };
        updatedBlogs++;
        changesCount++;
      }
    }
  });

  if (updatedBlogs > 0) {
    writeFileSync(wnrJsonPath, JSON.stringify(wnrData, null, 2), 'utf-8');
    console.log(`✅ Updated ${updatedBlogs} blog entries in src/data/wnr365_pdf_entries.json`);
  } else {
    console.log(`ℹ️ All ${blogSnap.size} blog entries in Firestore are already in sync.`);
  }

  // ── B. SYNC PRAYERS & RHZ365 ──────────────────────────────────────────────
  const rhzJsonPath = resolve(process.cwd(), 'RHZ365_pierwszy_cykl_175_dni.json');
  let rhzRecords: any[] = [];
  try {
    rhzRecords = JSON.parse(readFileSync(rhzJsonPath, 'utf-8'));
  } catch (e) {
    console.warn('Could not load RHZ365_pierwszy_cykl_175_dni.json');
  }

  console.log('📥 Fetching prayers from Firestore...');
  const prayersSnap = await getDocs(collection(db, 'prayers'));
  let updatedRhzDays = 0;
  let updatedPrayersTs = 0;

  const prayersTsPath = resolve(process.cwd(), 'src/data/prayers.ts');
  let prayersTsContent = readFileSync(prayersTsPath, 'utf-8');

  prayersSnap.forEach(docSnap => {
    const id = docSnap.id;
    const data = docSnap.data();

    if (!data || !data.text) return;

    // 1) Day decade overrides: day_X_decade_rgba_Y or day_X
    const dayMatch = id.match(/^day_(\d+)/);
    if (dayMatch && rhzRecords.length > 0) {
      const dayNum = parseInt(dayMatch[1], 10);
      const recordIndex = rhzRecords.findIndex((r: any) => r.dayNumber === dayNum);
      if (recordIndex !== -1) {
        const currentRec = rhzRecords[recordIndex];
        if (data.title && currentRec.title !== data.title) {
          currentRec.title = data.title;
          updatedRhzDays++;
          changesCount++;
        }
        if (data.text && currentRec.text !== data.text) {
          currentRec.text = data.text;
          updatedRhzDays++;
          changesCount++;
        }
      }
    }

    // 2) Intro texts in prayers.ts (e.g. introTextMain, introTextMission)
    if (id === 'introTextMain' || id === 'introTextMission' || id.startsWith('custom_step_')) {
      const textEscaped = JSON.stringify(data.text);
      const titleEscaped = JSON.stringify(data.title);
      
      // Look for key block in DEFAULT_PRAYERS
      const keyPattern = new RegExp(`"${id}":\\s*\\{[\\s\\S]*?\\}`);
      if (keyPattern.test(prayersTsContent)) {
        const replacement = `"${id}": {\n    "title": ${titleEscaped},\n    "text": ${textEscaped}\n  }`;
        if (!prayersTsContent.includes(replacement)) {
          prayersTsContent = prayersTsContent.replace(keyPattern, replacement);
          updatedPrayersTs++;
          changesCount++;
        }
      }
    }
  });

  if (updatedRhzDays > 0) {
    writeFileSync(rhzJsonPath, JSON.stringify(rhzRecords, null, 2), 'utf-8');
    console.log(`✅ Updated ${updatedRhzDays} day records in RHZ365_pierwszy_cykl_175_dni.json`);
  } else {
    console.log(`ℹ️ All ${rhzRecords.length} RHZ365 day records are already in sync.`);
  }

  if (updatedPrayersTs > 0) {
    writeFileSync(prayersTsPath, prayersTsContent, 'utf-8');
    console.log(`✅ Updated ${updatedPrayersTs} prayer blocks in src/data/prayers.ts`);
  }

  // ── C. UPDATE DATA VERSION IF CHANGES MADE ──────────────────────────────
  const localNoSqlPath = resolve(process.cwd(), 'src/utils/localNoSqlDb.ts');
  let localNoSqlContent = readFileSync(localNoSqlPath, 'utf-8');

  const newVersion = `2026-08-17-sync-${Date.now()}`;
  if (changesCount > 0) {
    localNoSqlContent = localNoSqlContent.replace(
      /const DATA_VERSION = '[^']+';/,
      `const DATA_VERSION = '${newVersion}';`
    );
    writeFileSync(localNoSqlPath, localNoSqlContent, 'utf-8');
    console.log(`🚀 Updated DATA_VERSION in localNoSqlDb.ts to '${newVersion}' to force browser cache refresh.`);
  } else {
    console.log('✨ No changes detected between Firestore and local JSON files.');
  }

  console.log(`\n🎉 Sync finished successfully! Total changes synced: ${changesCount}`);
  process.exit(0);
}

syncAllFromFirestore().catch(err => {
  console.error('❌ Sync failed with error:', err);
  process.exit(1);
});

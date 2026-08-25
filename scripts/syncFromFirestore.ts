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
  console.log('🔄 Starting full sync from Firestore to local JSON files (WnR365, RHZ365, Biblia365 + Gemini notebookUrls)...');
  let changesCount = 0;

  // ── A. SYNC BLOG ENTRIES (WnR365) ──────────────────────────────────────────
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
      const remoteUrls = Array.isArray(data.notebookUrls) ? data.notebookUrls : [];
      const localUrls = Array.isArray(existing?.notebookUrls) ? existing.notebookUrls : [];
      const finalUrls = remoteUrls.some((u: any) => u && String(u).trim().length > 0) ? remoteUrls : localUrls;

      const hasUrlChange = JSON.stringify(localUrls) !== JSON.stringify(finalUrls);

      if (
        !existing ||
        existing.title !== data.title ||
        existing.text !== data.text ||
        existing.dayIndex !== data.dayIndex ||
        hasUrlChange
      ) {
        wnrData[id] = {
          dayIndex: data.dayIndex ?? 0,
          title: data.title,
          text: data.text,
          notebookUrls: finalUrls,
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
        let changed = false;
        if (data.title && currentRec.title !== data.title) {
          currentRec.title = data.title;
          changed = true;
        }
        if (data.text && currentRec.text !== data.text) {
          currentRec.text = data.text;
          changed = true;
        }
        if (Array.isArray(data.notebookUrls) && data.notebookUrls.some((u: any) => u && String(u).trim().length > 0)) {
          if (JSON.stringify(currentRec.notebookUrls || []) !== JSON.stringify(data.notebookUrls)) {
            currentRec.notebookUrls = data.notebookUrls;
            changed = true;
          }
        }
        if (changed) {
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
        const urlsEscaped = data.notebookUrls ? `,\n    "notebookUrls": ${JSON.stringify(data.notebookUrls)}` : '';
        const replacement = `"${id}": {\n    "title": ${titleEscaped},\n    "text": ${textEscaped}${urlsEscaped}\n  }`;
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

  // ── C. SYNC BIBLIA365 (1460 czytań = 4 x 365) ─────────────────────────────
  console.log('📥 Initializing full 1460 chapters for Biblia365 (4 years × 365 days)...');
  const { getBibleChapters } = await import('../src/utils/bibleHelper');
  const allBibleDefaults = getBibleChapters();
  const bibleEntriesMap: Record<string, any> = {};

  allBibleDefaults.forEach(ch => {
    const docId = `bible_slot_${ch.slotIndex}`;
    bibleEntriesMap[docId] = {
      docId,
      slotIndex: ch.slotIndex,
      title: ch.defaultTitle,
      text: ch.defaultText,
      notebookUrls: [],
      updatedBy: 'Pismo Święte Biblia365 (1460 czytań)',
      updatedAt: new Date().toISOString()
    };
  });

  try {
    const bibleSnap = await getDocs(collection(db, 'bible_entries'));
    bibleSnap.forEach(docSnap => {
      const id = docSnap.id;
      const data = docSnap.data();
      if (data && data.title && data.text) {
        bibleEntriesMap[id] = {
          docId: id,
          slotIndex: data.slotIndex ?? (parseInt(id.replace('bible_slot_', ''), 10) || 0),
          title: data.title,
          text: data.text,
          notebookUrls: data.notebookUrls || [],
          updatedBy: data.updatedBy || 'Firestore Sync',
          updatedAt: data.updatedAt || new Date().toISOString()
        };
      }
    });
    console.log(`✅ Synced ${Object.keys(bibleEntriesMap).length} / 1460 Biblia365 entries.`);
  } catch (bibleErr) {
    console.warn('⚠️ Note: Using local seed for unauthenticated Firestore bible_entries.', (bibleErr as any)?.message);
  }

  // ── D. GENERATE src/data/db_snapshot.json ─────────────────────────────────
  const snapshotJsonPath = resolve(process.cwd(), 'src/data/db_snapshot.json');
  const publicSnapshotPath = resolve(process.cwd(), 'public/data/db_snapshot.json');

  const allPrayersMap: Record<string, any> = {};
  prayersSnap.forEach(docSnap => {
    const data = docSnap.data();
    if (data && data.text) {
      allPrayersMap[docSnap.id] = {
        title: data.title || '',
        text: data.text || '',
        notebookUrls: data.notebookUrls || [],
        updatedBy: data.updatedBy || 'Firestore Sync',
        updatedAt: data.updatedAt || new Date().toISOString()
      };
    }
  });

  const fullSnapshot = {
    version: `wnr365-snapshot-${new Date().toISOString().slice(0, 10)}`,
    exportedAt: new Date().toISOString(),
    source: 'widokinaraj.pl NoSQL Core (GitHub / Cloudflare Pages)',
    intro: {
      introTextMain: allPrayersMap['introTextMain'] || null,
      introTextMission: allPrayersMap['introTextMission'] || null
    },
    prayers: allPrayersMap,
    blogEntries: wnrData,
    bibleEntries: bibleEntriesMap
  };

  writeFileSync(snapshotJsonPath, JSON.stringify(fullSnapshot, null, 2), 'utf-8');
  console.log(`📦 Generated standalone NoSQL snapshot in src/data/db_snapshot.json (${Object.keys(allPrayersMap).length} prayers, ${Object.keys(wnrData).length} blog entries, ${Object.keys(bibleEntriesMap).length} bible entries)`);

  try {
    const publicDataDir = resolve(process.cwd(), 'public/data');
    const fs = await import('fs');
    if (!fs.existsSync(publicDataDir)) fs.mkdirSync(publicDataDir, { recursive: true });
    writeFileSync(publicSnapshotPath, JSON.stringify(fullSnapshot, null, 2), 'utf-8');
    console.log(`📦 Copied snapshot to public/data/db_snapshot.json for direct CDN access.`);
  } catch (e) {
    // optional
  }

  // ── E. UPDATE DATA VERSION IF CHANGES MADE ──────────────────────────────
  const localNoSqlPath = resolve(process.cwd(), 'src/utils/localNoSqlDb.ts');
  let localNoSqlContent = readFileSync(localNoSqlPath, 'utf-8');

  const newVersion = `2026-08-25-sync-${Date.now()}`;
  localNoSqlContent = localNoSqlContent.replace(
    /const DATA_VERSION = '[^']+';/,
    `const DATA_VERSION = '${newVersion}';`
  );
  writeFileSync(localNoSqlPath, localNoSqlContent, 'utf-8');
  console.log(`🚀 Updated DATA_VERSION in localNoSqlDb.ts to '${newVersion}' to force browser cache refresh.`);

  console.log(`\n🎉 Full NoSQL Sync finished successfully! Total changes synced: ${changesCount}`);
  process.exit(0);
}

syncAllFromFirestore().catch(err => {
  console.error('❌ Sync failed with error:', err);
  process.exit(1);
});

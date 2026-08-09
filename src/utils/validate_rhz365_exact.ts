import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { parseDayText } from './rhzParser';
import { getCycleDayInfo } from '../data/prayers';

const jsonPath = 'RHZ365_pierwszy_cykl_175_dni.json';
const rawJson = readFileSync(jsonPath, 'utf-8');
const rhzRecords = JSON.parse(rawJson);

const app = initializeApp(firebaseConfig);
const db = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);

export interface ValidationSummary {
  total: number;
  exactMatches: number;
  hashMatches: number;
  metadataPass: number;
  routingPass: number;
  silentOverridesCount: number;
  missingInDb: number;
  hashMismatches: number;
  hailMaryCountPass: number;
  clauseCountPass: number;
  errors: string[];
}

export async function validateRHZ365Exact(): Promise<ValidationSummary> {
  console.log('============================================================');
  console.log('RHZ365 COMPLETE 1–175 EXACT VALIDATOR & ROUTING AUDIT');
  console.log('============================================================\n');

  const requiredFields = ['dayNumber', 'dayMonth', 'cycle', 'stage', 'part', 'mystery', 'title', 'sourcePage', 'text', 'sourceText'];
  
  let exactMatches = 0;
  let hashMatches = 0;
  let metadataPass = 0;
  let routingPass = 0;
  let silentOverridesCount = 0;
  let missingInDb = 0;
  let hashMismatches = 0;
  let hailMaryCountPass = 0;
  let clauseCountPass = 0;
  const errors: string[] = [];

  const cycleStart = new Date(2025, 11, 25, 12, 0, 0, 0);

  for (let d = 1; d <= 175; d++) {
    const jsonRec = rhzRecords.find((r: any) => r.dayNumber === d);
    if (!jsonRec) {
      errors.push(`Brak rekordu dayNumber=${d} w pliku JSON!`);
      continue;
    }

    // 1. ROUTING VALIDATION FOR DAY d
    const targetDate = new Date(cycleStart.getTime() + (d - 1) * 86400000);
    const info = getCycleDayInfo(targetDate, { isExplicitRhzRoute: true });
    
    if (info.dayOfCycle === d && info.cycleType === 'cycle1') {
      routingPass++;
    } else {
      errors.push(`Routing FAIL for day ${d}: otrzymano cycleType '${info.cycleType}', dayOfCycle ${info.dayOfCycle}`);
    }

    if (info.cycleType === 'silent_contemplation') {
      silentOverridesCount++;
    }

    // 2. FIRESTORE DOCUMENT & FIELD VALIDATION FOR DAY d
    const decIdx = ((d - 1) % 5) + 1;
    const docId = `day_${d}_decade_rgba_${decIdx}`;
    const docRef = doc(db, 'prayers', docId);

    try {
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        missingInDb++;
        errors.push(`Dzień ${d}: Brak dokumentu w Firestore (${docId})`);
        continue;
      }

      const dbData = docSnap.data();

      // Field presence and exact value check
      let docMetadataValid = true;
      for (const f of requiredFields) {
        if (dbData[f] === undefined || dbData[f] === null) {
          docMetadataValid = false;
          errors.push(`Dzień ${d} (${docId}): Brak pola '${f}' w Firestore`);
        }
      }

      if (docMetadataValid) {
        if (
          dbData.dayNumber === jsonRec.dayNumber &&
          dbData.dayMonth === jsonRec.dayMonth &&
          dbData.cycle === jsonRec.cycle &&
          dbData.stage === jsonRec.stage &&
          dbData.part === jsonRec.part &&
          dbData.mystery === jsonRec.mystery &&
          dbData.title.trim() === jsonRec.title.trim() &&
          dbData.sourcePage === jsonRec.sourcePage
        ) {
          metadataPass++;
        } else {
          errors.push(`Dzień ${d}: Niezgodność wartości pól metadanych JSON vs Firestore`);
        }
      }

      // SHA-256 Hash check on full text
      const jsonText = jsonRec.text.trim();
      const dbText = (dbData.text || '').trim();

      const jsonHash = createHash('sha256').update(jsonText, 'utf-8').digest('hex');
      const dbHash = createHash('sha256').update(dbText, 'utf-8').digest('hex');

      if (jsonHash === dbHash) {
        hashMatches++;
      } else {
        hashMismatches++;
        errors.push(`Dzień ${d}: Niezgodność SHA-256 tekstu! JSON length=${jsonText.length}, DB length=${dbText.length}`);
      }

      // Parser and 10 Hail Mary + clause check
      const parsed = parseDayText(d, dbText);
      if (parsed.success && parsed.data) {
        if (parsed.data.hailMaryTexts.length === 10) {
          hailMaryCountPass++;
        } else {
          errors.push(`Dzień ${d}: Znaleziono ${parsed.data.hailMaryTexts.length} Zdrowaś Maryjo zamiast 10`);
        }

        let clausesOk = true;
        parsed.data.hailMaryTexts.forEach((hm, idx) => {
          if (!/dla któreg/i.test(hm) && !/dla której/i.test(hm)) {
            clausesOk = false;
            errors.push(`Dzień ${d}, Zdrowaś Maryjo #${idx + 1}: Brak dopowiedzenia 'dla którego/której'`);
          }
        });
        if (clausesOk) clauseCountPass++;
      } else {
        errors.push(`Dzień ${d}: Błąd parseDayText po imporcie: ${parsed.error}`);
      }

      if (docMetadataValid && jsonHash === dbHash) {
        exactMatches++;
      }
    } catch (err: any) {
      errors.push(`Dzień ${d}: Błąd odczytu z Firestore: ${err?.message}`);
    }
  }

  const total = rhzRecords.length;
  console.log(`JSON RECORDS            : ${total}`);
  console.log(`FIRESTORE RECORDS       : ${total - missingInDb}`);
  console.log(`DAYS PASS               : ${exactMatches} / ${total}`);
  console.log(`DAYS FAIL               : ${total - exactMatches} / ${total}`);
  console.log(`EXACT FIELD COMPARISON  : ${exactMatches} / ${total} PASS`);
  console.log(`TEXT SHA256 HASH MATCH  : ${hashMatches} / ${total} PASS`);
  console.log(`METADATA SCHEMA PASS    : ${metadataPass} / ${total} PASS`);
  console.log(`ROUTING PASS (1–175)    : ${routingPass} / ${total} PASS`);
  console.log(`SILENT CONTEMPLATION OVERRIDES : ${silentOverridesCount} / ${total}`);
  console.log(`10 HAIL MARYS PASS (10/10)    : ${hailMaryCountPass} / ${total} PASS`);
  console.log(`DLA KTÓREGO CLAUSE PASS (10/10): ${clauseCountPass} / ${total} PASS`);
  console.log(`TOTAL ERRORS COUNT      : ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n--- BŁĘDY / RÓŻNICE ---');
    errors.forEach(e => console.log(` - ${e}`));
  } else {
    console.log('\n✅ SUKCES: 100% ZGODNOŚĆ CAŁEGO RHZ365 (DNI 1–175) W FIRESTORE I ROUTINGU Z PLIEM JSON!');
  }

  return {
    total,
    exactMatches,
    hashMatches,
    metadataPass,
    routingPass,
    silentOverridesCount,
    missingInDb,
    hashMismatches,
    hailMaryCountPass,
    clauseCountPass,
    errors
  };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('validate_rhz365_exact.ts')) {
  validateRHZ365Exact().then(res => {
    process.exit(res.errors.length === 0 ? 0 : 1);
  }).catch(err => {
    console.error('Validation script failed:', err);
    process.exit(1);
  });
}

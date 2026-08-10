import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { parseDayText } from '../src/utils/rhzParser';

const jsonPath = 'RHZ365_pierwszy_cykl_175_dni.json';
const rawJson = readFileSync(jsonPath, 'utf-8');
const rhzRecords = JSON.parse(rawJson);

console.log('=== 1. JSON AUDIT ===');
console.log('Total JSON Records:', rhzRecords.length);
console.log('Raw JSON byte length:', Buffer.byteLength(rawJson, 'utf-8'));

let parseFailures: { dayNumber: number; error: string }[] = [];
let missingFields: { dayNumber: number; fields: string[] }[] = [];
let textHashesJson: Record<number, string> = {};

const requiredFields = ['dayNumber', 'dayMonth', 'cycle', 'stage', 'part', 'mystery', 'title', 'sourcePage', 'text'];

rhzRecords.forEach((r: any, idx: number) => {
  const missing = requiredFields.filter(f => r[f] === undefined || r[f] === null);
  if (missing.length > 0) {
    missingFields.push({ dayNumber: r.dayNumber || idx + 1, fields: missing });
  }

  const hash = createHash('sha256').update(r.text || '', 'utf-8').digest('hex');
  textHashesJson[r.dayNumber] = hash;

  const parsed = parseDayText(r.dayNumber, r.text);
  if (!parsed.success) {
    parseFailures.push({ dayNumber: r.dayNumber, error: parsed.error || 'Unknown error' });
  }
});

console.log('DayNumber range:', rhzRecords[0]?.dayNumber, 'to', rhzRecords[rhzRecords.length - 1]?.dayNumber);
console.log('Missing fields in JSON records:', missingFields.length);

console.log('parseDayText Failures on JSON:', parseFailures.length);
if (parseFailures.length > 0) {
  console.log('Sample parser errors on JSON:', parseFailures.slice(0, 10));
}

// Initialize Firestore
const app = initializeApp(firebaseConfig);
const db = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);

async function auditFirestore() {
  console.log('\n=== 2. FIRESTORE AUDIT ===');
  const snap = await getDocs(collection(db, 'prayers'));
  console.log('Total documents in "prayers" collection:', snap.size);

  let rhzDocCount = 0;
  let hashMatches = 0;
  let hashMismatches: any[] = [];
  let missingInDb: number[] = [];
  let dbFieldErrors: any[] = [];

  for (let d = 1; d <= 175; d++) {
    const decIdx = ((d - 1) % 5) + 1;
    const docId = `day_${d}_decade_rgba_${decIdx}`;
    const docRef = doc(db, 'prayers', docId);
    const docSnap = await getDoc(docRef);

    const jsonRec = rhzRecords.find((r: any) => r.dayNumber === d);

    if (!docSnap.exists()) {
      missingInDb.push(d);
    } else {
      rhzDocCount++;
      const data = docSnap.data();

      // Check fields in Firestore vs JSON
      for (const field of requiredFields) {
        if (data[field] === undefined) {
          dbFieldErrors.push({ dayNumber: d, docId, missingField: field });
        }
      }

      const dbText = data.text || '';
      const dbHash = createHash('sha256').update(dbText, 'utf-8').digest('hex');
      const jsonHash = textHashesJson[d];

      if (dbHash === jsonHash) {
        hashMatches++;
      } else {
        hashMismatches.push({
          dayNumber: d,
          docId,
          jsonLength: jsonRec?.text?.length,
          dbLength: dbText.length,
          jsonHash,
          dbHash,
          jsonStart: jsonRec?.text?.substring(0, 40),
          dbStart: dbText.substring(0, 40),
          jsonEnd: jsonRec?.text?.substring(jsonRec.text.length - 40),
          dbEnd: dbText.substring(dbText.length - 40)
        });
      }
    }
  }

  console.log('RHZ docs in Firestore (out of 175):', rhzDocCount);
  console.log('Missing in DB:', missingInDb.length);
  console.log('Firestore Field Errors (missing schema fields count across 175 docs):', dbFieldErrors.length);
  if (dbFieldErrors.length > 0) {
    console.log('Sample missing fields in Firestore:', dbFieldErrors.slice(0, 10));
  }
  console.log('SHA256 Hash Matches (JSON vs Firestore):', hashMatches, '/ 175');
  console.log('SHA256 Hash Mismatches:', hashMismatches.length);
  if (hashMismatches.length > 0) {
    console.log('Sample Hash Mismatches:', hashMismatches.slice(0, 5));
  }

  process.exit(0);
}

auditFirestore().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

// Helper to strip HTML tags if present
function cleanHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function exportAllToMarkdown() {
  console.log('📝 Exporting all 365 days to Markdown for NotebookLM...');

  // 1. Read source files
  const wnrPath = resolve(process.cwd(), 'src/data/wnr365_pdf_entries.json');
  const rhzPath = resolve(process.cwd(), 'RHZ365_pierwszy_cykl_175_dni.json');
  const snapshotPath = resolve(process.cwd(), 'src/data/db_snapshot.json');

  let wnrData: Record<string, any> = {};
  try {
    wnrData = JSON.parse(readFileSync(wnrPath, 'utf-8'));
  } catch (e) {
    console.warn('Could not read wnr365_pdf_entries.json');
  }

  let rhzList: any[] = [];
  try {
    rhzList = JSON.parse(readFileSync(rhzPath, 'utf-8'));
  } catch (e) {
    console.warn('Could not read RHZ365_pierwszy_cykl_175_dni.json');
  }

  let snapshotData: any = {};
  try {
    snapshotData = JSON.parse(readFileSync(snapshotPath, 'utf-8'));
  } catch (e) {
    // optional
  }

  // Create export output directories
  const exportDir = resolve(process.cwd(), 'export-md');
  const publicExportDir = resolve(process.cwd(), 'public/export-md');
  if (!existsSync(exportDir)) mkdirSync(exportDir, { recursive: true });
  if (!existsSync(publicExportDir)) mkdirSync(publicExportDir, { recursive: true });

  const monthlyEntries: Record<number, string[]> = {};
  for (let m = 1; m <= 12; m++) {
    monthlyEntries[m] = [];
  }

  const rhzEntriesMd: string[] = [];
  const wnrEntriesMd: string[] = [];
  const bibliaEntriesMd: string[] = [];
  const allDaysMd: string[] = [];

  // Map 365 days
  for (let day = 1; day <= 365; day++) {
    const dayIndex = day - 1;

    // --- A. WSTĘP ---
    const introText = `Wstęp modlitewny dnia ${day}. Korona 12 Gwiazd Niewiasty z Apokalipsy (Ap 12,1) w elektronicznej Misji Barw i Kolorów (eMBiK365).`;

    // --- B. RHZ365 ---
    let rhzDayNum = day;
    if (day > 175 && day <= 181) rhzDayNum = day - 174;
    else if (day > 181 && day <= 356) rhzDayNum = day - 181;
    else if (day > 356) rhzDayNum = day - 356;

    const rhzRecord = rhzList.find(r => r.dayNumber === rhzDayNum) || rhzList[0];
    const rhzTitle = rhzRecord ? rhzRecord.title : `RHZ365 — Dzień ${day}`;
    const rhzContent = rhzRecord ? cleanHtml(rhzRecord.text) : `Rozważanie różańcowe dla dnia ${day}.`;

    // --- C. WnR365 ---
    const blogKey = `blog_day_${dayIndex}`;
    const blogEntry = wnrData[blogKey] || snapshotData.blogEntries?.[blogKey];
    const wnrTitle = blogEntry?.title || `WnR365 — Dzień ${day}`;
    const wnrContent = blogEntry?.text ? cleanHtml(blogEntry.text) : `Rozważanie blogowe dla dnia ${day}.`;

    // --- D. BIBLIA365 ---
    const bibleKey = `bible_day_${dayIndex}`;
    const bibleEntry = snapshotData.bibleEntries?.[bibleKey];
    const bibliaTitle = bibleEntry?.title || `Biblia365 — Czytanie Dnia ${day}`;
    const bibliaContent = bibleEntry?.text ? cleanHtml(bibleEntry.text) : `Rozważanie Pisma Świętego dla dnia ${day}.`;

    // Build entry block
    const dayMarkdown = `# Dzień ${day} — ${wnrTitle}

## Wstęp
${introText}

## RHZ365
### ${rhzTitle}
${rhzContent}

## WnR365
### ${wnrTitle}
${wnrContent}

## Biblia365
### ${bibliaTitle}
${bibliaContent}
`;

    allDaysMd.push(dayMarkdown);

    // Save into section lists
    rhzEntriesMd.push(`# Dzień ${day} — RHZ365: ${rhzTitle}\n\n${rhzContent}`);
    wnrEntriesMd.push(`# Dzień ${day} — WnR365: ${wnrTitle}\n\n${wnrContent}`);
    bibliaEntriesMd.push(`# Dzień ${day} — Biblia365: ${bibliaTitle}\n\n${bibliaContent}`);

    // Map to month (approximate 30/31 day split across 12 months)
    const monthNumber = Math.min(12, Math.floor(dayIndex / 30.5) + 1);
    monthlyEntries[monthNumber].push(dayMarkdown);
  }

  // Write 12 Monthly files
  for (let m = 1; m <= 12; m++) {
    const monthStr = m.toString().padStart(2, '0');
    const content = `# Widoki na Raj — Miesiąc ${monthStr} (365 Dni Modlitwy)\n\n` + monthlyEntries[m].join('\n\n---\n\n');
    
    const fileName = `miesiac-${monthStr}.md`;
    writeFileSync(resolve(exportDir, fileName), content, 'utf-8');
    writeFileSync(resolve(publicExportDir, fileName), content, 'utf-8');
  }
  console.log(`✅ Exported 12 monthly Markdown files (miesiac-01.md to miesiac-12.md).`);

  // Write 3 Section files
  writeFileSync(resolve(exportDir, 'rhz365.md'), `# Różaniec Historii Zbawienia (RHZ365) — 365 Dni\n\n` + rhzEntriesMd.join('\n\n---\n\n'), 'utf-8');
  writeFileSync(resolve(publicExportDir, 'rhz365.md'), `# Różaniec Historii Zbawienia (RHZ365) — 365 Dni\n\n` + rhzEntriesMd.join('\n\n---\n\n'), 'utf-8');

  writeFileSync(resolve(exportDir, 'wnr365.md'), `# Widoki na Raj Blog (WnR365) — 365 Dni\n\n` + wnrEntriesMd.join('\n\n---\n\n'), 'utf-8');
  writeFileSync(resolve(publicExportDir, 'wnr365.md'), `# Widoki na Raj Blog (WnR365) — 365 Dni\n\n` + wnrEntriesMd.join('\n\n---\n\n'), 'utf-8');

  writeFileSync(resolve(exportDir, 'biblia365.md'), `# Biblia365 Rozważania — 365 Dni\n\n` + bibliaEntriesMd.join('\n\n---\n\n'), 'utf-8');
  writeFileSync(resolve(publicExportDir, 'biblia365.md'), `# Biblia365 Rozważania — 365 Dni\n\n` + bibliaEntriesMd.join('\n\n---\n\n'), 'utf-8');
  console.log(`✅ Exported 3 section Markdown files (rhz365.md, wnr365.md, biblia365.md).`);

  // Write Master file
  const fullContent = `# Widoki na Raj (widokinaraj.pl) — Kompletna Baza 365 Dni\n\n` + allDaysMd.join('\n\n---\n\n');
  writeFileSync(resolve(exportDir, 'pelne_365_dni.md'), fullContent, 'utf-8');
  writeFileSync(resolve(publicExportDir, 'pelne_365_dni.md'), fullContent, 'utf-8');
  console.log(`✅ Exported master file pelne_365_dni.md.`);

  console.log(`\n🎉 Markdown Export for NotebookLM completed successfully! Files saved in /export-md/ and /public/export-md/`);
  process.exit(0);
}

exportAllToMarkdown().catch(err => {
  console.error('❌ Markdown export failed:', err);
  process.exit(1);
});

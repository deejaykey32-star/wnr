export interface RHZParsedDay {
  dayNumber: number;
  title: string;
  reflectionText: string;
  ourFatherText: string;
  hailMaryTexts: string[]; // Length 10
  gloryBeFatimaText: string;
}

export function parseDayText(dayNumber: number, fullText: string): { success: boolean; data?: RHZParsedDay; error?: string } {
  if (!fullText) {
    return { success: false, error: `Dzień ${dayNumber}: Brak tekstu` };
  }

  // Normalize line endings
  const clean = fullText.replace(/\r\n/g, '\n').trim();

  // Find "Ojcze nasz"
  const fatherIdx = clean.search(/(?:^|\n)\s*Ojcze nasz/i);
  if (fatherIdx === -1) {
    return { success: false, error: `Dzień ${dayNumber}: Brak fragmentu 'Ojcze nasz'` };
  }

  const reflectionText = clean.substring(0, fatherIdx).trim();
  const remainderAfterReflection = clean.substring(fatherIdx);

  // Find "Zdrowaś Maryjo" occurrences at line start
  const hailMaryRegex = /(?:^|\n)\s*Zdrowaś Maryjo/gi;
  let matches: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = hailMaryRegex.exec(remainderAfterReflection)) !== null) {
    const matchedStart = match.index;
    const lineSnippet = remainderAfterReflection.substring(matchedStart, matchedStart + 35);
    if (/Dziesięć Zdrowaś Maryjo/i.test(lineSnippet) || /Modlitwy/i.test(lineSnippet)) {
      continue; // Skip section header
    }
    matches.push(matchedStart);
  }

  if (matches.length !== 10) {
    return { success: false, error: `Dzień ${dayNumber}: Znaleziono ${matches.length} wystąpień 'Zdrowaś Maryjo' na początku wiersza (oczekiwano 10)` };
  }

  const ourFatherText = remainderAfterReflection.substring(0, matches[0]).trim();

  // Find "Chwała Ojcu" at line start after the 10th Zdrowaś Maryjo
  const lastHailMarySegment = remainderAfterReflection.substring(matches[9]);
  const gloryIdxInLast = lastHailMarySegment.search(/(?:^|\n)\s*Chwała Ojcu/i);
  if (gloryIdxInLast === -1) {
    return { success: false, error: `Dzień ${dayNumber}: Brak 'Chwała Ojcu' po 10. Zdrowaś Maryjo` };
  }

  const hailMaryTexts: string[] = [];
  for (let i = 0; i < 9; i++) {
    const textPart = remainderAfterReflection.substring(matches[i], matches[i + 1]).trim();
    hailMaryTexts.push(textPart);
  }

  // 10th Hail Mary
  const tenthHailMaryText = lastHailMarySegment.substring(0, gloryIdxInLast).trim();
  hailMaryTexts.push(tenthHailMaryText);

  // Glory Be & Fatima
  const gloryBeFatimaText = lastHailMarySegment.substring(gloryIdxInLast).trim();

  // Re-check reconstruction to guarantee 100% text integrity (0 lost/added characters)
  const reconstructed = `${reflectionText}\n${ourFatherText}\n${hailMaryTexts.join('\n')}\n${gloryBeFatimaText}`;
  const normOriginal = clean.replace(/\s+/g, ' ');
  const normReconstructed = reconstructed.replace(/\s+/g, ' ');

  if (normOriginal !== normReconstructed) {
    return { success: false, error: `Dzień ${dayNumber}: Niezgodność tekstu po rekonstrukcji (CONTENT_MISMATCH)` };
  }

  return {
    success: true,
    data: {
      dayNumber,
      title: '',
      reflectionText,
      ourFatherText,
      hailMaryTexts,
      gloryBeFatimaText
    }
  };
}

import { jsPDF } from 'jspdf';
import { COVER_IMAGE_BASE64 } from '../assets/coverBase64';
import { generateQrCodeDataUri } from './qrCodeGenerator';
import { getRhzList } from '../data/prayers';
import { parseDayText } from './rhzParser';
import { getWnrDefaultBlogEntry } from './wnrBlogDefaults';
import { normalizeTextParagraphs } from './richTextHelper';

import { ROBOTO_REGULAR_BASE64, ROBOTO_BOLD_BASE64 } from '../assets/robotoBase64';

// Pre-bundled Font Loader supporting Polish Characters (100% offline & instant)
const loadRobotoFonts = (doc: jsPDF): boolean => {
  try {
    doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

    doc.addFileToVFS('Roboto-Medium.ttf', ROBOTO_BOLD_BASE64);
    doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold');

    return true;
  } catch (error) {
    console.warn("Could not load bundled Unicode Roboto font. Falling back to Helvetica.", error);
    return false;
  }
};

const MONTH_NAMES_GENITIVE = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia"
];

const getDateFromDayIndex = (dayIndex: number): Date => {
  if (dayIndex < 7) {
    return new Date(2025, 11, 25 + dayIndex, 12, 0, 0, 0);
  } else {
    return new Date(2026, 0, 1 + (dayIndex - 7), 12, 0, 0, 0);
  }
};

const extractUrlsFromText = (text: string): string[] => {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s<>"'\(\)]+)/gi;
  const matches = text.match(urlRegex) || [];
  return Array.from(new Set(matches));
};

export interface CustomPdfOptions {
  scope: 'rhz365' | 'wnr365' | 'both';
  range: 'single' | 'full';
  includeCover: boolean;
  selectedDate: Date;
  dayOfCycle: number;
  prayers: Record<string, { title: string; text: string }>;
  blogEntries: Record<string, { title: string; text: string; dayIndex: number }>;
}

export const generateCustomScopePdf = async (
  options: CustomPdfOptions,
  onProgress?: (msg: string, percent?: number) => void
): Promise<void> => {
  const { scope, range, includeCover, dayOfCycle, prayers, blogEntries } = options;

  if (onProgress) onProgress("Inicjalizacja generatora PDF A5 (czcionka Unicode 12pt)...", 0);

  // Format A5: 148 mm x 210 mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5'
  });

  const hasCustomFont = loadRobotoFonts(doc);
  const fontName = hasCustomFont ? 'Roboto' : 'Helvetica';

  const pageWidth = 148;
  const pageHeight = 210;
  const margin = 12; // 12mm left/right margin
  const contentWidth = pageWidth - (margin * 2); // 124mm printable width

  // 12pt font size with 1.5 line height spacing = 6.35 mm per line
  const lineSpacing15 = 6.35;

  const drawHeaderFooter = (pageNum: number, titleText: string) => {
    // Top running header line
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.3);
    doc.line(margin, margin - 2, pageWidth - margin, margin - 2);

    doc.setFont(fontName, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    const safeHeaderTitle = doc.splitTextToSize(titleText, contentWidth)[0] || titleText;
    doc.text(safeHeaderTitle, margin, margin - 4);

    // Bottom running footer line
    doc.line(margin, pageHeight - margin + 2, pageWidth - margin, pageHeight - margin + 2);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("eMBiK365 — widokinaraj.pl", margin, pageHeight - margin + 6);
    doc.text(`str. ${pageNum}`, pageWidth - margin, pageHeight - margin + 6, { align: 'right' });
  };

  let currentPage = 1;
  const tocMap: { dayNum: number; title: string; pageNum: number }[] = [];

  // ==========================================
  // PAGE 1: COVER PAGE
  // ==========================================
  if (includeCover) {
    if (onProgress) onProgress("Dodawanie okładki książkowej...");
    
    try {
      doc.addImage(COVER_IMAGE_BASE64, 'PNG', 0, 0, pageWidth, pageHeight);
    } catch (err) {
      console.error("Błąd rysowania okładki:", err);
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setFont(fontName, 'bold');
      doc.setFontSize(22);
      doc.setTextColor(248, 250, 252);
      doc.text("Widoki na Raj", pageWidth / 2, 50, { align: 'center' });
      
      doc.setFontSize(11);
      doc.setTextColor(245, 158, 11);
      doc.text("Misja barw i kolorów", pageWidth / 2, 62, { align: 'center' });
      doc.text("Duchowa pielgrzymka przez 365 dni w roku", pageWidth / 2, 70, { align: 'center' });

      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.text("Dominik Jan Kuta", pageWidth / 2, 100, { align: 'center' });
      doc.text("pod redakcją dr Aleksandry Sabasz-Kuta", pageWidth / 2, 108, { align: 'center' });

      doc.setFont(fontName, 'bold');
      doc.setFontSize(14);
      doc.setTextColor(224, 231, 255);
      doc.text("eMBiK", pageWidth / 2, 170, { align: 'center' });
    }

    doc.addPage();
    currentPage++;
  }

  // Determine start & end days
  const startDay = range === 'single' ? dayOfCycle : 1;
  const endDay = range === 'single' ? dayOfCycle : 365;

  const headerTitle = scope === 'rhz365' 
    ? "Różaniec Historii Zbawienia — RHZ365" 
    : scope === 'wnr365' 
      ? "Widoki na Raj — WnR365" 
      : "eMBiK365 — RHZ365 & WnR365";

  let y = margin + 5;
  drawHeaderFooter(currentPage, headerTitle);

  const checkAndBreakPage = (requiredSpace: number = 10, fontState?: { style?: 'normal' | 'bold'; size?: number; color?: [number, number, number] }) => {
    if (y > pageHeight - margin - requiredSpace) {
      doc.addPage();
      currentPage++;
      drawHeaderFooter(currentPage, headerTitle);
      y = margin + 5;
      if (fontState) {
        if (fontState.style) doc.setFont(fontName, fontState.style);
        if (fontState.size) doc.setFontSize(fontState.size);
        if (fontState.color) doc.setTextColor(fontState.color[0], fontState.color[1], fontState.color[2]);
      }
      return true;
    }
    return false;
  };

  const stripQrTags = (str: string): string => {
    if (!str) return '';
    return str
      .replace(/\[qr:[^\]]+\]/gi, '')
      .replace(/\[caption:[^\]]+\]/gi, '')
      .trim();
  };

  // Helper to split raw text into clean continuous paragraphs (merging soft linebreaks within paragraphs)
  const splitIntoCleanParagraphs = (rawText: string): string[] => {
    if (!rawText) return [];
    const cleaned = stripQrTags(rawText);
    const normalized = normalizeTextParagraphs(cleaned);
    const blocks = normalized.split(/\n\s*\n+/);
    return blocks
      .map(block => block.replace(/^###\s*/, '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  };

  // Custom Typography Engine for 100% Guaranteed Book Justification (both left and right margins aligned)
  const renderJustifiedParagraph = (
    text: string, 
    xMargin: number = margin, 
    width: number = contentWidth, 
    fontStyle: 'normal' | 'bold' = 'normal', 
    fontSize: number = 12, 
    color: [number, number, number] = [51, 65, 85]
  ) => {
    if (!text || !text.trim()) return;

    doc.setFont(fontName, fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);

    const paragraphs = splitIntoCleanParagraphs(text);

    for (const para of paragraphs) {
      // Split continuous paragraph into lines fitting contentWidth
      const lines: string[] = doc.splitTextToSize(para, width);
      if (lines.length === 0) continue;

      for (let l = 0; l < lines.length; l++) {
        checkAndBreakPage(lineSpacing15 + 2, { style: fontStyle, size: fontSize, color });
        const isLastLineOfPara = (l === lines.length - 1);
        doc.text(lines[l], xMargin, y, { 
          align: isLastLineOfPara ? 'left' : 'justify', 
          maxWidth: width 
        });
        y += lineSpacing15;
      }
      y += 2; // Spacing after paragraph
    }
  };

  interface QrTagMatch {
    url: string;
    caption: string;
    fullMatch: string;
    index: number;
  }

  const findQrTagsInText = (text: string): QrTagMatch[] => {
    if (!text) return [];
    const matches: QrTagMatch[] = [];

    // Pattern 1: [qr: URL][caption: CAPTION]
    const p1 = /\[qr:\s*([^\]]+)\]\s*\[caption:\s*([^\]]+)\]/gi;
    let m: RegExpExecArray | null;
    while ((m = p1.exec(text)) !== null) {
      matches.push({
        url: m[1].trim(),
        caption: m[2].trim(),
        fullMatch: m[0],
        index: m.index
      });
    }

    // Pattern 2: [qr: URL | CAPTION]
    const p2 = /\[qr:\s*([^|\]]+)\|\s*([^\]]+)\]/gi;
    while ((m = p2.exec(text)) !== null) {
      if (!matches.some(existing => existing.index === m!.index || existing.fullMatch.includes(m![0]))) {
        matches.push({
          url: m[1].trim(),
          caption: m[2].trim(),
          fullMatch: m[0],
          index: m.index
        });
      }
    }

    // Pattern 3: Standalone [qr: URL]
    const p3 = /\[qr:\s*([^\]]+)\]/gi;
    while ((m = p3.exec(text)) !== null) {
      if (!matches.some(existing => existing.index <= m!.index && m!.index < existing.index + existing.fullMatch.length)) {
        matches.push({
          url: m[1].trim(),
          caption: 'Kod QR / Odnośnik',
          fullMatch: m[0],
          index: m.index
        });
      }
    }

    return matches.sort((a, b) => a.index - b.index);
  };

  const renderRichContentWithEmbeddedQr = async (
    text: string,
    xMargin: number = margin,
    width: number = contentWidth,
    fontStyle: 'normal' | 'bold' = 'normal',
    fontSize: number = 12,
    color: [number, number, number] = [51, 65, 85]
  ) => {
    if (!text || !text.trim()) return;

    const qrMatches = findQrTagsInText(text);

    if (qrMatches.length === 0) {
      renderJustifiedParagraph(text, xMargin, width, fontStyle, fontSize, color);
      return;
    }

    let currentIndex = 0;
    for (const qr of qrMatches) {
      const textBefore = text.substring(currentIndex, qr.index);
      if (textBefore.trim()) {
        renderJustifiedParagraph(textBefore, xMargin, width, fontStyle, fontSize, color);
      }
      currentIndex = qr.index + qr.fullMatch.length;

      // Render Inline Styled QR Box in PDF
      checkAndBreakPage(30);
      try {
        const qrDataUri = await generateQrCodeDataUri(qr.url);
        const boxHeight = 22;
        const qrSize = 16;
        const qrX = xMargin + width - qrSize - 3;
        const qrY = y + 3;
        const maxTextWidth = width - qrSize - 10;

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.rect(xMargin, y, width, boxHeight, 'FD');

        doc.addImage(qrDataUri, 'PNG', qrX, qrY, qrSize, qrSize);

        doc.setFont(fontName, 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(79, 70, 229); // indigo-600
        const displayCaption = qr.caption.replace(/^caption:\s*/i, '').trim();
        doc.text(displayCaption || "Kod QR Odnośnika", xMargin + 4, y + 6);

        doc.setFont(fontName, 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(37, 99, 235); // blue-600

        const splitUrl = doc.splitTextToSize(qr.url, maxTextWidth);
        doc.text(splitUrl, xMargin + 4, y + 11);

        doc.link(xMargin + 3, y + 3, maxTextWidth, boxHeight - 6, { url: qr.url });

        y += boxHeight + 5;
      } catch (err) {
        console.warn("Błąd rysowania osadzonego kodu QR:", err);
      }
    }

    const remainingText = text.substring(currentIndex);
    if (remainingText.trim()) {
      renderJustifiedParagraph(remainingText, xMargin, width, fontStyle, fontSize, color);
    }
  };

  // Render Intro & Mission Statement if generating full range or if single range day 1
  if (range === 'full') {
    const mainText = prayers['introTextMain']?.text;
    const missionText = prayers['introTextMission']?.text;
    if (mainText || missionText) {
      doc.setFont(fontName, 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("Wstęp i Misja eMBiK365", margin, y);
      y += 8;

      if (mainText) {
        renderJustifiedParagraph(mainText, margin, contentWidth, 'normal', 11, [30, 41, 59]);
        y += 4;
      }

      if (missionText) {
        doc.setFillColor(243, 244, 246);
        doc.setDrawColor(209, 213, 219);
        doc.rect(margin, y, contentWidth, 14, 'FD');
        doc.setFont(fontName, 'bold');
        doc.setFontSize(9);
        doc.setTextColor(79, 70, 229);
        doc.text("Misja eMBiK365:", margin + 3, y + 5);
        doc.setFont(fontName, 'normal');
        doc.setTextColor(51, 65, 85);
        const splitMission = doc.splitTextToSize(missionText, contentWidth - 6);
        doc.text(splitMission, margin + 3, y + 9.5);
        y += 18;
      }

      doc.addPage();
      currentPage++;
      drawHeaderFooter(currentPage, headerTitle);
      y = margin + 5;
    }
  }

  for (let currentDayNum = startDay; currentDayNum <= endDay; currentDayNum++) {
    const progressCount = currentDayNum - startDay + 1;
    const totalCount = endDay - startDay + 1;
    const pct = Math.round((progressCount / totalCount) * 95);

    if (onProgress) {
      onProgress(`Składanie pliku PDF: Dzień ${currentDayNum} (${progressCount}/${totalCount})...`, pct);
    }

    // Yield control to browser main loop so UI progress bar updates smoothly without freezing
    await new Promise((r) => setTimeout(r, 0));

    const dayIdx = currentDayNum - 1;
    const date = getDateFromDayIndex(dayIdx);
    const dayLabel = `${date.getDate()} ${MONTH_NAMES_GENITIVE[date.getMonth()]}`;

    let cycleName = "";
    if (dayIdx >= 0 && dayIdx < 175) {
      cycleName = `Cykl I (Różaniec Tradycyjny) — Dzień ${dayIdx + 1}`;
    } else if (dayIdx >= 175 && dayIdx < 182) {
      cycleName = `7 Dni Przerwy — Dzień ${dayIdx - 174}`;
    } else if (dayIdx >= 182 && dayIdx < 357) {
      cycleName = `Cykl II (Różaniec do Boga Ojca) — Dzień ${dayIdx - 181}`;
    } else {
      cycleName = `Okres Przygotowania — Dzień ${dayIdx - 356}`;
    }

    // Continuous flow check
    checkAndBreakPage(35);

    // Register TOC item
    tocMap.push({
      dayNum: currentDayNum,
      title: `Dzień ${currentDayNum}: ${dayLabel} (${cycleName})`,
      pageNum: currentPage
    });

    // Day Header Box with two clear separate rows (no text overlap!)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 12, 'FD');

    doc.setFont(fontName, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`DZIEŃ ${currentDayNum} — ${dayLabel.toUpperCase()}`, margin + 3, y + 4.5);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(79, 70, 229);
    doc.text(cycleName, margin + 3, y + 9.5);

    y += 16;

    // Direct entry URL QR Code
    const baseUrl = (typeof window !== 'undefined' && window.location?.origin)
      ? window.location.origin
      : 'https://widokinaraj.pages.dev';
    const dayUrl = scope === 'wnr365' 
      ? `${baseUrl}/#/wnr365-day-${currentDayNum}` 
      : `${baseUrl}/#/rhz365-day-${currentDayNum}`;
    
    // Fetch RHZ and WnR content to scan for additional embedded URLs
    const rhzDayNum = ((currentDayNum - 1) % 175) + 1;
    const decIdx = ((rhzDayNum - 1) % 5) + 1;
    const firestoreKey = `day_${rhzDayNum}_decade_rgba_${decIdx}`;
    const rhzDoc = prayers[firestoreKey];
    
    const jsonRecord = (getRhzList() as any[]).find(r => r.dayNumber === rhzDayNum) || getRhzList()[rhzDayNum - 1];

    let rawRhzText = rhzDoc?.text || jsonRecord?.text || '';
    let rhzTitle = rhzDoc?.title || jsonRecord?.title || `Dzień ${rhzDayNum}`;

    let parsedRHZ = parseDayText(rhzDayNum, rawRhzText);

    // Fallback to bundled rhzData if custom text lacks full 10x Hail Mary prayer structure
    if (!parsedRHZ.success && jsonRecord?.text) {
      const fallbackParsed = parseDayText(rhzDayNum, jsonRecord.text);
      if (fallbackParsed.success) {
        parsedRHZ = fallbackParsed;
        rawRhzText = jsonRecord.text;
        if (jsonRecord.title) rhzTitle = jsonRecord.title;
      }
    }

    const wnrKey = `blog_day_${dayIdx}`;
    const wnrDoc = getWnrDefaultBlogEntry(dayIdx, prayers, blogEntries);

    // Top-of-day Portal QR Code Box
    checkAndBreakPage(26);
    try {
      const qrDataUri = await generateQrCodeDataUri(dayUrl);
      const qrSize = 16;
      const qrX = margin + contentWidth - qrSize - 3;
      const qrY = y + 2;
      const maxTextWidth = contentWidth - qrSize - 8;

      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, qrSize + 4, 'FD');

      doc.addImage(qrDataUri, 'PNG', qrX, qrY, qrSize, qrSize);

      doc.setFont(fontName, 'bold');
      doc.setFontSize(8);
      doc.setTextColor(37, 99, 235);
      doc.text("Portal Widoki na Raj — Dzień " + currentDayNum, margin + 3, y + 4.5);

      doc.setFont(fontName, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);

      const splitUrl = doc.splitTextToSize(dayUrl, maxTextWidth);
      doc.text(splitUrl, margin + 3, y + 9.5);

      doc.link(margin + 3, y + 3, maxTextWidth, 14, { url: dayUrl });

      y += qrSize + 7;
    } catch (e) {
      console.warn("Błąd generowania głowicowego QR:", e);
    }

    // 1. RHZ365 Section
    if (scope === 'rhz365' || scope === 'both') {
      checkAndBreakPage(25);

      doc.setFont(fontName, 'bold');
      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229);
      const rhzSectionTitle = `RHZ365 — Dzień ${currentDayNum}: ${rhzTitle}`;
      const splitRhzTitle = doc.splitTextToSize(rhzSectionTitle, contentWidth);
      for (let l = 0; l < splitRhzTitle.length; l++) {
        checkAndBreakPage(10, { style: 'bold', size: 11, color: [79, 70, 229] });
        doc.text(splitRhzTitle[l], margin, y);
        y += 5.5;
      }
      y += 1;

      if (parsedRHZ.success && parsedRHZ.data) {
        // Reflection (12pt font, 1.5 line spacing, 100% justified with embedded QR)
        doc.setFont(fontName, 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text("Rozważanie Tajemnicy:", margin, y);
        y += 5;

        await renderRichContentWithEmbeddedQr(parsedRHZ.data.reflectionText, margin, contentWidth, 'normal', 12, [51, 65, 85]);
        y += 2;

        // Our Father
        checkAndBreakPage(15);
        doc.setFont(fontName, 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text("Modlitwa Pańska (Ojcze Nasz):", margin, y);
        y += 5;

        renderJustifiedParagraph(parsedRHZ.data.ourFatherText, margin, contentWidth, 'normal', 12, [51, 65, 85]);
        y += 3;

        // 10 Hail Marys
        checkAndBreakPage(15);
        doc.setFont(fontName, 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text("10 Osobnych Modlitw Zdrowaś Maryjo (z dopowiedzeniami):", margin, y);
        y += 5;

        for (let idx = 0; idx < parsedRHZ.data.hailMaryTexts.length; idx++) {
          const hmText = parsedRHZ.data.hailMaryTexts[idx];
          checkAndBreakPage(15);

          doc.setFont(fontName, 'bold');
          doc.setFontSize(9);
          doc.setTextColor(79, 70, 229);
          doc.text(`Zdrowaś Maryjo #${idx + 1}:`, margin, y);
          y += 4.5;

          renderJustifiedParagraph(hmText, margin + 3, contentWidth - 3, 'normal', 12, [30, 41, 59]);
          y += 2;
        }

        // Glory Be & Fatima Prayer (O mój Jezu)
        checkAndBreakPage(20);

        const gloryFatimaText = parsedRHZ.data.gloryBeFatimaText || '';
        const fatimaMatch = gloryFatimaText.search(/(?:^|\n)\s*O mój Jezu/i);

        let gloryTextPart = gloryFatimaText;
        let fatimaTextPart = '';

        if (fatimaMatch !== -1) {
          gloryTextPart = gloryFatimaText.substring(0, fatimaMatch).trim();
          fatimaTextPart = gloryFatimaText.substring(fatimaMatch).trim();
        }

        doc.setFont(fontName, 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text("Modlitwa Uwielbienia (Chwała Ojcu):", margin, y);
        y += 5;

        renderJustifiedParagraph(gloryTextPart, margin, contentWidth, 'normal', 12, [51, 65, 85]);
        y += 3;

        if (fatimaTextPart) {
          checkAndBreakPage(20);
          doc.setFont(fontName, 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(15, 23, 42);
          doc.text("Modlitwa Fatimska (O mój Jezu):", margin, y);
          y += 5;

          renderJustifiedParagraph(fatimaTextPart, margin, contentWidth, 'normal', 12, [51, 65, 85]);
          y += 4;
        }
      } else {
        await renderRichContentWithEmbeddedQr(rawRhzText, margin, contentWidth, 'normal', 12, [51, 65, 85]);
        y += 4;
      }
    }

    // 2. WnR365 Section
    if (scope === 'wnr365' || scope === 'both') {
      checkAndBreakPage(25);

      doc.setFont(fontName, 'bold');
      doc.setFontSize(11);
      doc.setTextColor(217, 119, 6);
      
      const wnrTitleFull = `WnR365 — ${wnrDoc.title || `Widoki na Raj (Dzień ${currentDayNum})`}`;
      const splitWnrTitle = doc.splitTextToSize(wnrTitleFull, contentWidth);
      for (let l = 0; l < splitWnrTitle.length; l++) {
        checkAndBreakPage(10, { style: 'bold', size: 11, color: [217, 119, 6] });
        doc.text(splitWnrTitle[l], margin, y);
        y += 5.5;
      }
      y += 1.5;

      await renderRichContentWithEmbeddedQr(wnrDoc.text || '', margin, contentWidth, 'normal', 12, [51, 65, 85]);
      y += 6;
    }
  }

  // ==========================================
  // FINAL PAGES: TABLE OF CONTENTS (SPIS TREŚCI)
  // ==========================================
  if (onProgress) onProgress("Generowanie aktywnego Spisu Treści na końcu pliku A5...");

  if (y > pageHeight - margin - 30) {
    doc.addPage();
    currentPage++;
    drawHeaderFooter(currentPage, "Spis Treści — Interaktywne Odsyłacze");
    y = margin + 5;
  }

  doc.setFont(fontName, 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("Spis Treści", margin, y);
  y += 6.5;

  doc.setFont(fontName, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Kliknij w podświetlony odsyłacz, aby natychmiast przejść do strony danego dnia:", margin, y);
  y += 7.5;

  for (let t = 0; t < tocMap.length; t++) {
    const item = tocMap[t];

    if (y > pageHeight - margin - 10) {
      doc.addPage();
      currentPage++;
      drawHeaderFooter(currentPage, "Spis Treści — Interaktywne Odsyłacze");
      y = margin + 5;
    }

    if (t % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 3, contentWidth, 5.5, 'F');
    }

    doc.setFont(fontName, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(79, 70, 229);
    doc.text(item.title, margin + 1.5, y);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`str. ${item.pageNum}`, margin + contentWidth - 1.5, y, { align: 'right' });

    doc.setDrawColor(199, 210, 254);
    doc.setLineWidth(0.2);
    doc.line(margin + 1.5, y + 1, margin + contentWidth - 1.5, y + 1);

    doc.link(margin, y - 3, contentWidth, 5.5, { pageNumber: item.pageNum });

    y += 5.5;
  }

  if (onProgress) onProgress("Zapisywanie pliku PDF A5...");

  const fileNameScope = scope === 'rhz365' ? 'RHZ365' : scope === 'wnr365' ? 'WnR365' : 'eMBiK365_RHZ365_WnR365';
  const fileNameRange = range === 'single' ? `Dzien_${dayOfCycle}` : 'Calosc_Ksiega';
  const pdfFilename = `${fileNameScope}_${fileNameRange}_A5.pdf`;

  doc.save(pdfFilename);

  if (onProgress) onProgress("Pobieranie pliku PDF A5 zakończone pomyślnie!", 100);
};

export const generateEmbikPdf = async (data: any, onProgress?: (msg: string, percent?: number) => void) => {
  return generateCustomScopePdf({
    scope: 'both',
    range: 'single',
    includeCover: true,
    selectedDate: data.selectedDate || new Date(),
    dayOfCycle: data.dayOfCycle || 1,
    prayers: data.prayers || {},
    blogEntries: {}
  }, onProgress);
};

export const generateYearlyEmbikPdf = async (
  prayers: Record<string, { title: string; text: string }>,
  blogEntries: Record<string, { title: string; text: string; dayIndex: number }>,
  onProgress?: (msg: string, percent?: number) => void
) => {
  return generateCustomScopePdf({
    scope: 'both',
    range: 'full',
    includeCover: true,
    selectedDate: new Date(),
    dayOfCycle: 1,
    prayers,
    blogEntries
  }, onProgress);
};

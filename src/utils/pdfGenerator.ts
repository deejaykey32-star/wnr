import { jsPDF } from 'jspdf';
import { COVER_IMAGE_BASE64 } from '../assets/coverBase64';
import { generateQrCodeDataUri } from './qrCodeGenerator';
import rhzData from '../../RHZ365_pierwszy_cykl_175_dni.json';
import { parseDayText } from './rhzParser';
import { getWnrDefaultBlogEntry } from './wnrBlogDefaults';

// Dynamic Font Fetcher supporting Polish Characters
const loadRobotoFonts = async (doc: jsPDF): Promise<boolean> => {
  try {
    const fontUrlRegular = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
    const fontUrlBold = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf';

    const [resReg, resBold] = await Promise.all([
      fetch(fontUrlRegular),
      fetch(fontUrlBold)
    ]);

    if (!resReg.ok || !resBold.ok) {
      throw new Error("Failed to fetch Roboto fonts from CDN");
    }

    const [bufReg, bufBold] = await Promise.all([
      resReg.arrayBuffer(),
      resBold.arrayBuffer()
    ]);

    const base64Reg = btoa(
      new Uint8Array(bufReg)
        .reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
    const base64Bold = btoa(
      new Uint8Array(bufBold)
        .reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    doc.addFileToVFS('Roboto-Regular.ttf', base64Reg);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

    doc.addFileToVFS('Roboto-Medium.ttf', base64Bold);
    doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold');

    return true;
  } catch (error) {
    console.warn("Could not load Unicode Roboto font dynamically. Falling back to Helvetica.", error);
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
  onProgress?: (msg: string) => void
): Promise<void> => {
  const { scope, range, includeCover, dayOfCycle, prayers, blogEntries } = options;

  if (onProgress) onProgress("Inicjalizacja generatora PDF A5 (czcionka Unicode 12pt)...");

  // Format A5: 148 mm x 210 mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5'
  });

  const hasCustomFont = await loadRobotoFonts(doc);
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

    const lines: string[] = doc.splitTextToSize(text.trim(), width);

    for (let l = 0; l < lines.length; l++) {
      checkAndBreakPage(10, { style: fontStyle, size: fontSize, color });
      const lineStr = lines[l].trim();
      const isLastLine = (l === lines.length - 1);

      if (isLastLine) {
        doc.text(lineStr, xMargin, y);
      } else {
        const words = lineStr.split(/\s+/).filter(Boolean);
        if (words.length <= 1) {
          doc.text(lineStr, xMargin, y);
        } else {
          // Calculate exact spacing between words so line fills width from left margin to right margin
          let totalWordsWidth = 0;
          for (const w of words) {
            totalWordsWidth += doc.getTextWidth(w);
          }
          const spaceWidth = (width - totalWordsWidth) / (words.length - 1);
          
          let curX = xMargin;
          for (let wIdx = 0; wIdx < words.length; wIdx++) {
            doc.text(words[wIdx], curX, y);
            curX += doc.getTextWidth(words[wIdx]) + spaceWidth;
          }
        }
      }
      y += lineSpacing15;
    }
  };

  for (let currentDayNum = startDay; currentDayNum <= endDay; currentDayNum++) {
    if (onProgress) {
      const progressCount = currentDayNum - startDay + 1;
      const totalCount = endDay - startDay + 1;
      onProgress(`Składanie Dnia ${currentDayNum} (${progressCount}/${totalCount}) z czcionką 12pt...`);
    }

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
    const dayUrl = `https://widokinaraj.pl/day/${currentDayNum}`;
    
    // Fetch RHZ and WnR content to scan for additional embedded URLs
    const decIdx = ((currentDayNum - 1) % 5) + 1;
    const firestoreKey = `day_${currentDayNum}_decade_rgba_${decIdx}`;
    const rhzDoc = prayers[firestoreKey];
    const rawRhzText = rhzDoc?.text || rhzData[Math.min(currentDayNum - 1, rhzData.length - 1)]?.text || '';
    const rhzTitle = rhzDoc?.title || rhzData[Math.min(currentDayNum - 1, rhzData.length - 1)]?.title || `Dzień ${currentDayNum}`;

    const parsedRHZ = parseDayText(currentDayNum, rawRhzText);

    const wnrKey = `blog_day_${dayIdx}`;
    const wnrDoc = getWnrDefaultBlogEntry(dayIdx, prayers, blogEntries);

    // Extract all embedded URLs in content text
    const embeddedUrls = extractUrlsFromText(`${rawRhzText} ${wnrDoc.text || ''}`);
    const allUrls = Array.from(new Set([dayUrl, ...embeddedUrls]));

    // Render QR Codes and URLs below them inside a tidy box
    for (const urlItem of allUrls) {
      checkAndBreakPage(32);

      try {
        const qrDataUri = await generateQrCodeDataUri(urlItem);
        const qrSize = 16; // 16mm x 16mm
        const qrX = margin + contentWidth - qrSize - 3;
        const qrY = y + 2;

        const maxTextWidth = contentWidth - qrSize - 8;

        doc.setFillColor(250, 250, 250);
        doc.setDrawColor(226, 232, 240);
        doc.rect(margin, y, contentWidth, qrSize + 4, 'FD');

        doc.addImage(qrDataUri, 'PNG', qrX, qrY, qrSize, qrSize);

        doc.setFont(fontName, 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(37, 99, 235);
        doc.text("Kod QR odnośnika:", margin + 3, y + 4.5);

        doc.setFont(fontName, 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);

        const splitUrl = doc.splitTextToSize(urlItem, maxTextWidth);
        doc.text(splitUrl, margin + 3, y + 9);

        doc.link(margin + 3, y + 5, maxTextWidth, splitUrl.length * 4 + 2, { url: urlItem });

        y += qrSize + 7;
      } catch (e) {
        console.warn("Błąd generowania QR:", e);
      }
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
        // Reflection (12pt font, 1.5 line spacing, 100% justified)
        doc.setFont(fontName, 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text("Rozważanie Tajemnicy:", margin, y);
        y += 5;

        const reflParagraphs = parsedRHZ.data.reflectionText.split('\n').filter(p => p.trim());
        for (const para of reflParagraphs) {
          renderJustifiedParagraph(para, margin, contentWidth, 'normal', 12, [51, 65, 85]);
          y += 2;
        }
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

        parsedRHZ.data.hailMaryTexts.forEach((hmText, idx) => {
          checkAndBreakPage(15);

          doc.setFont(fontName, 'bold');
          doc.setFontSize(9);
          doc.setTextColor(79, 70, 229);
          doc.text(`Zdrowaś Maryjo #${idx + 1}:`, margin, y);
          y += 4.5;

          renderJustifiedParagraph(hmText, margin + 3, contentWidth - 3, 'normal', 12, [30, 41, 59]);
          y += 2;
        });

        // Glory Be
        checkAndBreakPage(20);

        doc.setFont(fontName, 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text("Chwała Ojcu & O mój Jezu:", margin, y);
        y += 5;

        renderJustifiedParagraph(parsedRHZ.data.gloryBeFatimaText, margin, contentWidth, 'normal', 12, [51, 65, 85]);
        y += 4;
      } else {
        const rawParagraphs = rawRhzText.split('\n').filter(p => p.trim());
        for (const para of rawParagraphs) {
          renderJustifiedParagraph(para, margin, contentWidth, 'normal', 12, [51, 65, 85]);
          y += 2;
        }
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

      // Split into paragraphs for proper justified paragraph rendering
      const wnrParagraphs = (wnrDoc.text || '').split('\n').filter(p => p.trim());
      for (const para of wnrParagraphs) {
        renderJustifiedParagraph(para, margin, contentWidth, 'normal', 12, [51, 65, 85]);
        y += 2; // Extra spacing between paragraphs
      }
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

  if (onProgress) onProgress("Pobieranie pliku PDF A5 zakończone pomyślnie!");
};

export const generateEmbikPdf = async (data: any, onProgress?: (msg: string) => void) => {
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
  onProgress?: (msg: string) => void
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

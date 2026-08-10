import { jsPDF } from 'jspdf';
import { COVER_IMAGE_BASE64 } from '../assets/coverBase64';
import { generateQrCodeDataUri } from './qrCodeGenerator';
import rhzData from '../../RHZ365_pierwszy_cykl_175_dni.json';
import { parseDayText } from './rhzParser';

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

  if (onProgress) onProgress("Inicjalizacja generatora PDF i pobieranie czcionek...");

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const hasCustomFont = await loadRobotoFonts(doc);
  const fontName = hasCustomFont ? 'Roboto' : 'Helvetica';

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const contentWidth = pageWidth - (margin * 2);

  const drawHeaderFooter = (pageNum: number, titleText: string) => {
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.rect(margin - 4, margin - 4, pageWidth - (margin * 2) + 8, pageHeight - (margin * 2) + 8);

    doc.setFont(fontName, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(titleText, margin, margin - 8);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(8);
    doc.text(`Strona ${pageNum}`, pageWidth - margin - 15, pageHeight - margin + 8);
    doc.text("eMBiK365 — widokinaraj.pl", margin, pageHeight - margin + 8);
  };

  let currentPage = 1;
  const tocMap: { dayNum: number; title: string; pageNum: number }[] = [];

  // ==========================================
  // PAGE 1: COVER PAGE
  // ==========================================
  if (includeCover) {
    if (onProgress) onProgress("Dodawanie okładki książkowej...");
    
    try {
      // Draw cover image full size on page 1
      doc.addImage(COVER_IMAGE_BASE64, 'PNG', 0, 0, pageWidth, pageHeight);
    } catch (err) {
      console.error("Błąd rysowania okładki z obrazka, generowanie ramki tekstu...", err);
      // Fallback elegant cover
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setFont(fontName, 'bold');
      doc.setFontSize(28);
      doc.setTextColor(248, 250, 252);
      doc.text("Widoki na Raj", pageWidth / 2, 70, { align: 'center' });
      
      doc.setFontSize(14);
      doc.setTextColor(245, 158, 11);
      doc.text("Misja barw i kolorów", pageWidth / 2, 85, { align: 'center' });
      doc.text("Duchowa pielgrzymka przez 365 dni w roku", pageWidth / 2, 95, { align: 'center' });

      doc.setFontSize(12);
      doc.setTextColor(148, 163, 184);
      doc.text("Dominik Jan Kuta", pageWidth / 2, 130, { align: 'center' });
      doc.text("pod redakcją dr Aleksandry Sabasz-Kuta", pageWidth / 2, 140, { align: 'center' });

      doc.setFont(fontName, 'bold');
      doc.setFontSize(16);
      doc.setTextColor(224, 231, 255);
      doc.text("eMBiK", pageWidth / 2, 230, { align: 'center' });
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

  for (let currentDayNum = startDay; currentDayNum <= endDay; currentDayNum++) {
    if (onProgress) {
      const progressCount = currentDayNum - startDay + 1;
      const totalCount = endDay - startDay + 1;
      onProgress(`Generowanie treści Dnia ${currentDayNum} (${progressCount}/${totalCount})...`);
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

    if (currentDayNum > startDay) {
      doc.addPage();
      currentPage++;
    }

    // Register TOC item
    tocMap.push({
      dayNum: currentDayNum,
      title: `Dzień ${currentDayNum}: ${dayLabel} (${cycleName})`,
      pageNum: currentPage
    });

    drawHeaderFooter(currentPage, headerTitle);
    let y = margin + 5;

    // Day Header Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.rect(margin, y, contentWidth, 12, 'FD');

    doc.setFont(fontName, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`DZIEŃ ${currentDayNum} — ${dayLabel.toUpperCase()}`, margin + 4, y + 8);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(79, 70, 229);
    doc.text(cycleName, margin + contentWidth - 4, y + 8, { align: 'right' });

    y += 18;

    // QR Code & URL Section
    const dayUrl = `https://widokinaraj.pl/day/${currentDayNum}`;
    try {
      const qrDataUri = await generateQrCodeDataUri(dayUrl);
      const qrSize = 22; // 22mm x 22mm
      const qrX = margin + contentWidth - qrSize;
      const qrY = y;

      doc.addImage(qrDataUri, 'PNG', qrX, qrY, qrSize, qrSize);

      doc.setFont(fontName, 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(37, 99, 235); // blue-600
      doc.text("Zeskanuj lub kliknij poniższy URL:", margin, y + 5);

      doc.setFont(fontName, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(dayUrl, margin, y + 11);

      // Make URL text clickable
      doc.link(margin, y + 7, 70, 6, { url: dayUrl });

      y += 26;
    } catch (e) {
      console.warn("Nie udało się dodać kodu QR:", e);
    }

    // 1. RHZ365 Section
    if (scope === 'rhz365' || scope === 'both') {
      const decIdx = ((currentDayNum - 1) % 5) + 1;
      const firestoreKey = `day_${currentDayNum}_decade_rgba_${decIdx}`;
      const rhzDoc = prayers[firestoreKey];
      const rawRhzText = rhzDoc?.text || rhzData[Math.min(currentDayNum - 1, rhzData.length - 1)]?.text || '';
      const rhzTitle = rhzDoc?.title || rhzData[Math.min(currentDayNum - 1, rhzData.length - 1)]?.title || `Dzień ${currentDayNum}`;

      const parsedRHZ = parseDayText(currentDayNum, rawRhzText);

      doc.setFont(fontName, 'bold');
      doc.setFontSize(14);
      doc.setTextColor(79, 70, 229);
      doc.text(`RHZ365 — Dzień ${currentDayNum}: ${rhzTitle}`, margin, y);
      y += 8;

      if (parsedRHZ.success && parsedRHZ.data) {
        // Reflection
        doc.setFont(fontName, 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text("Rozważanie Tajemnicy:", margin, y);
        y += 5;

        doc.setFont(fontName, 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        const splitRefl = doc.splitTextToSize(parsedRHZ.data.reflectionText, contentWidth);
        doc.text(splitRefl, margin, y);
        y += (splitRefl.length * 4) + 6;

        // Our Father
        doc.setFont(fontName, 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text("Modlitwa Pańska (Ojcze Nasz):", margin, y);
        y += 5;

        doc.setFont(fontName, 'normal');
        doc.setFontSize(8.5);
        const splitFather = doc.splitTextToSize(parsedRHZ.data.ourFatherText, contentWidth);
        doc.text(splitFather, margin, y);
        y += (splitFather.length * 4) + 6;

        // 10 Hail Marys
        doc.setFont(fontName, 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text("10 Osobnych Modlitw Zdrowaś Maryjo (z dopowiedzeniami):", margin, y);
        y += 5;

        parsedRHZ.data.hailMaryTexts.forEach((hmText, idx) => {
          if (y > pageHeight - margin - 15) {
            doc.addPage();
            currentPage++;
            drawHeaderFooter(currentPage, headerTitle);
            y = margin + 5;
          }

          doc.setFont(fontName, 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(79, 70, 229);
          doc.text(`Zdrowaś Maryjo #${idx + 1}:`, margin, y);
          y += 4;

          doc.setFont(fontName, 'normal');
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);
          const splitHm = doc.splitTextToSize(hmText, contentWidth - 4);
          doc.text(splitHm, margin + 4, y);
          y += (splitHm.length * 3.8) + 3.5;
        });

        // Glory Be
        if (y > pageHeight - margin - 20) {
          doc.addPage();
          currentPage++;
          drawHeaderFooter(currentPage, headerTitle);
          y = margin + 5;
        }

        doc.setFont(fontName, 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text("Chwała Ojcu & O mój Jezu:", margin, y);
        y += 5;

        doc.setFont(fontName, 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        const splitGlory = doc.splitTextToSize(parsedRHZ.data.gloryBeFatimaText, contentWidth);
        doc.text(splitGlory, margin, y);
        y += (splitGlory.length * 4) + 8;
      } else {
        doc.setFont(fontName, 'normal');
        doc.setFontSize(8.5);
        const splitRaw = doc.splitTextToSize(rawRhzText, contentWidth);
        doc.text(splitRaw, margin, y);
        y += (splitRaw.length * 4) + 8;
      }
    }

    // 2. WnR365 Section
    if (scope === 'wnr365' || scope === 'both') {
      const wnrKey = `blog_day_${dayIdx}`;
      const wnrDoc = blogEntries[wnrKey] || {
        title: `Widoki na Raj — Dzień ${currentDayNum}`,
        text: "Rozważanie Słowa Bożego i natchnienia modlitewne w Duchu Świętym."
      };

      if (y > pageHeight - margin - 35 || scope === 'both') {
        doc.addPage();
        currentPage++;
        drawHeaderFooter(currentPage, headerTitle);
        y = margin + 5;
      }

      doc.setFont(fontName, 'bold');
      doc.setFontSize(14);
      doc.setTextColor(217, 119, 6); // amber-600
      doc.text(`WnR365 — ${wnrDoc.title || `Widoki na Raj (Dzień ${currentDayNum})`}`, margin, y);
      y += 8;

      doc.setFont(fontName, 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      const splitWnr = doc.splitTextToSize(wnrDoc.text || '', contentWidth);
      
      // Print lines with auto page break if long
      for (let l = 0; l < splitWnr.length; l++) {
        if (y > pageHeight - margin - 12) {
          doc.addPage();
          currentPage++;
          drawHeaderFooter(currentPage, headerTitle);
          y = margin + 5;
        }
        doc.text(splitWnr[l], margin, y);
        y += 4.2;
      }
    }
  }

  // ==========================================
  // FINAL PAGES: TABLE OF CONTENTS (SPIS TREŚCI)
  // ==========================================
  if (onProgress) onProgress("Generowanie aktywnego Spisu Treści na końcu pliku...");

  doc.addPage();
  currentPage++;
  drawHeaderFooter(currentPage, "Spis Treści — Interaktywne Odsyłacze");

  let tocY = margin + 5;

  doc.setFont(fontName, 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text("Spis Treści", margin, tocY);
  tocY += 8;

  doc.setFont(fontName, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Kliknij w podświetlony odsyłacz, aby natychmiast przejść do strony danego dnia:", margin, tocY);
  tocY += 10;

  for (let t = 0; t < tocMap.length; t++) {
    const item = tocMap[t];

    if (tocY > pageHeight - margin - 12) {
      doc.addPage();
      currentPage++;
      drawHeaderFooter(currentPage, "Spis Treści — Interaktywne Odsyłacze");
      tocY = margin + 5;
    }

    // Zebra background
    if (t % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, tocY - 3.5, contentWidth, 6, 'F');
    }

    // Title text (Highlighted link style)
    doc.setFont(fontName, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text(item.title, margin + 2, tocY);

    // Page Number
    doc.setFont(fontName, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`str. ${item.pageNum}`, margin + contentWidth - 2, tocY, { align: 'right' });

    // Underline effect
    doc.setDrawColor(199, 210, 254);
    doc.setLineWidth(0.2);
    doc.line(margin + 2, tocY + 1, margin + contentWidth - 2, tocY + 1);

    // Create interactive internal PDF page link
    doc.link(margin, tocY - 3.5, contentWidth, 6, { pageNumber: item.pageNum });

    tocY += 6.5;
  }

  if (onProgress) onProgress("Zapisywanie pliku PDF...");

  const fileNameScope = scope === 'rhz365' ? 'RHZ365' : scope === 'wnr365' ? 'WnR365' : 'eMBiK365_RHZ365_WnR365';
  const fileNameRange = range === 'single' ? `Dzien_${dayOfCycle}` : 'Calosc_Ksiega';
  const pdfFilename = `${fileNameScope}_${fileNameRange}.pdf`;

  doc.save(pdfFilename);

  if (onProgress) onProgress("Pobieranie pliku PDF zakończone pomyślnie!");
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


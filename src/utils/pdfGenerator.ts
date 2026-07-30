import { jsPDF } from 'jspdf';

// Dynamic Font Fetcher supporting Polish Characters
const loadRobotoFonts = async (doc: jsPDF): Promise<boolean> => {
  try {
    // We fetch Roboto-Regular and Roboto-Medium from cdnjs
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

    // Convert regular font to Base64
    const base64Reg = btoa(
      new Uint8Array(bufReg)
        .reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
    // Convert bold font to Base64
    const base64Bold = btoa(
      new Uint8Array(bufBold)
        .reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // Register font family in jsPDF virtual file system
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

interface PdfExportData {
  selectedDate: Date;
  cycleName: string;
  cycleType: string;
  dayOfCycle: number;
  activeStepLabel: string;
  currentMysteryTitle: string;
  currentMysteryText: string;
  blogTitle: string;
  blogText: string;
  prayers: Record<string, { title: string; text: string }>;
}

export const generateEmbikPdf = async (data: PdfExportData, onProgress?: (msg: string) => void) => {
  if (onProgress) onProgress("Inicjalizacja generatora PDF i pobieranie czcionek...");
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const hasCustomFont = await loadRobotoFonts(doc);
  const fontName = hasCustomFont ? 'Roboto' : 'Helvetica';
  
  // PDF layout specifications (A4: 210 x 297 mm)
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  // Helper for drawing elegant page borders, headers and footers
  const drawPageBorder = (pageNum: number) => {
    // Subtle background tone border
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.rect(margin - 5, margin - 5, pageWidth - (margin * 2) + 10, pageHeight - (margin * 2) + 10);
    
    // Header
    doc.setFont(fontName, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text("eMBiK365 — Różaniec Historii Zbawienia & Widoki na Raj", margin, margin - 10);
    
    // Footer
    doc.setFont(fontName, 'normal');
    doc.text(`Strona ${pageNum}`, pageWidth - margin - 15, pageHeight - margin + 10);
    doc.text("Pielgrzymowanie Duchowe w Duchu Świętym", margin, pageHeight - margin + 10);
  };

  // Helper to draw horizontal dividers
  const drawDivider = (y: number, color: [number, number, number] = [226, 232, 240]) => {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageWidth - margin, y);
  };

  // ==========================================
  // PAGE 1: COVER & MISSION INTRODUCTION
  // ==========================================
  if (onProgress) onProgress("Generowanie strony tytułowej...");
  
  // Custom cover frame
  doc.setDrawColor(14, 165, 233); // sky-500
  doc.setLineWidth(1.5);
  doc.line(margin, 30, pageWidth - margin, 30);

  doc.setDrawColor(245, 158, 11); // amber-500
  doc.setLineWidth(1.5);
  doc.line(margin, 32, pageWidth - margin, 32);

  // Title
  doc.setFont(fontName, 'bold');
  doc.setFontSize(36);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("eMBiK365", margin, 52);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text("ELEKTRONICZNA MISJA BARW I KOLORÓW", margin, 60);

  doc.setFont(fontName, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(79, 70, 229); // indigo-600
  doc.text("Różaniec Historii Zbawienia (RHZ365) & Widoki na Raj (WnR365)", margin, 70);

  drawDivider(76, [14, 165, 233]);

  // Date of Export Info Box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.rect(margin, 82, contentWidth, 24, 'FD');

  doc.setFont(fontName, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("DOKUMENT GENEROWANY DLA DNIA LITURGICZNEGO:", margin + 5, 89);
  
  doc.setFont(fontName, 'normal');
  doc.setFontSize(12);
  doc.setTextColor(217, 119, 6); // amber-600
  doc.text(data.cycleName, margin + 5, 96);
  
  doc.setFont(fontName, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Data kalendarzowa: ${data.selectedDate.toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, margin + 5, 102);

  // Welcome Introduction Header
  doc.setFont(fontName, 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("1. Wstęp i Misja eMBiK365", margin, 120);
  
  const introText = 
    "Element eMBiK365 (elektronicznej Misji Barw i Kolorów) stanowi innowacyjną syntezę współczesnej myśli wizualnej i głębokiego zakorzenienia w tradycyjnej duchowości chrześcijańskiej. Naszym celem jest ułatwienie i ubogacenie codziennego, duchowego pielgrzymowania przez Jezusa Chrystusa w Duchu Świętym dzięki Bogu Ojcu i pod macierzyńskim okiem Maryi zawsze dziewicy.\n\n" +
    "Aplikacja w unikalny sposób łączy dwie fundamentalne przestrzenie:\n" +
    "1. Różaniec Historii Zbawienia (RHZ365) – oparty na dualnej reprezentacji barwnej: systemie RGBA (addytywnej syntezie światła, symbolizującej Boski blask, dary charyzmatyczne i zmartwychwstanie) oraz CMYK (subtraktywnej syntezy barw pigmentowych, oznaczającej pokorne ludzkie rzemiosło, trud ziemskiego życia, skruchę i maryjną czystość).\n" +
    "2. Widoki na Raj (WnR365) – codzienne natchnienia i wpisy blogowe prowadzące przez 175-dniowe cykle refleksji, dopasowane do okresów liturgicznych oraz okresu przygotowania i wyciszenia.\n\n" +
    "Niniejszy przewodnik został przygotowany tak, aby umożliwić Państwu swobodne korzystanie ze schematów modlitewnych w każdych warunkach – zarówno online, jak i w formie fizycznego wydruku podczas osobistych rekolekcji.";

  doc.setFont(fontName, 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85); // slate-700
  const splitIntro = doc.splitTextToSize(introText, contentWidth);
  doc.text(splitIntro, margin, 128);

  drawPageBorder(1);

  // ==========================================
  // PAGE 2: INSTRUCTIONS FOR USE
  // ==========================================
  if (onProgress) onProgress("Generowanie instrukcji korzystania...");
  doc.addPage();
  drawPageBorder(2);

  doc.setFont(fontName, 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("2. Instrukcja Korzystania z Systemu", margin, 32);
  drawDivider(36, [79, 70, 229]);

  const instrContent = [
    {
      title: "Różaniec Historii Zbawienia (RHZ365)",
      desc: "Medytacja różańcowa jest uporządkowana w inteligentny, cykliczny sposób. Codziennie odmawiany jest jeden pełny różaniec złożony z 5 dziesiątków. Do dyspozycji wiernego oddane są dwa niezależne, ale wzajemnie uzupełniające się ciągi paciorków: addytywny RGBA (światło) oraz pigmentowy CMYK (ziemia). Podczas odmawiania kolejnych Zdrowaś Maryjo na interaktywnym schemacie, system automatycznie synchronizuje natchnienia z Lektorem AI i dzwonkami harmonizującymi modlitwę."
    },
    {
      title: "Praktykowanie z Blogiem Widoki na Raj (WnR365)",
      desc: "Każdy dzień roku posiada przypisany autorski wpis i rozważanie. Wpisy podzielone są na dwa 175-dniowe cykle natchnień rozdzielone tygodniowym czasem wyciszenia, co w sumie tworzy pełny, 365-dniowy rytm duchowego wzrostu. Zaleca się odczytanie wpisu przed lub zaraz po odmówieniu Różańca RHZ365, pozwalając na głębokie przenikanie Słowa do serca."
    },
    {
      title: "Wersja Minimalistyczna (Tryb Kontemplacyjny)",
      desc: "Dla osób pragnących nagrywać własne rozważania, przygotowywać materiały wideo na platformę YouTube lub medytować w maksymalnym skupieniu, przygotowano Wersję Minimalistyczną. Ukrywa ona rozpraszające elementy interfejsu, pozostawiając jedynie centralny tekst modlitwy przesuwany za pomocą telepromptera (karaoke) oraz pionowe pasy barwne RGBA i CMYK odzwierciedlające aktualny paciorek."
    },
    {
      title: "Sposób Pracy z Dokumentem PDF",
      desc: "Ten plik PDF to Państwa osobisty modlitewnik. Mogą go Państwo wydrukować dwustronnie. Trzecia strona zawiera uniwersalny, wieczny schemat kolorów paciorków, z którego można korzystać przy tradycyjnym różańcu w dłoni. Czwarta strona zawiera aktualne rozważanie oraz sekcję przeznaczoną na odręczne zapisywanie natchnień z danego dnia."
    }
  ];

  let currentY = 42;
  instrContent.forEach((item) => {
    doc.setFont(fontName, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(item.title, margin, currentY);
    currentY += 5;

    doc.setFont(fontName, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const splitDesc = doc.splitTextToSize(item.desc, contentWidth);
    doc.text(splitDesc, margin, currentY);
    
    // Calculate space occupied
    currentY += (splitDesc.length * 4) + 8;
  });

  // ==========================================
  // PAGE 3: ROSARY SCHEMA & COLOR THEORY
  // ==========================================
  if (onProgress) onProgress("Generowanie schematu paciorków...");
  doc.addPage();
  drawPageBorder(3);

  doc.setFont(fontName, 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("3. Schemat Różańca RHZ365 i Teoria Barw", margin, 32);
  drawDivider(36, [217, 119, 6]);

  const schemaIntro = "Poniższa struktura przedstawia rozkład dziesiątków oraz unikalne przyporządkowanie kolorystyczne paciorków w systemie eMBiK365. Dualizm światła i materii obrazuje zjednoczenie porządku nadprzyrodzonego i przyrodzonego.";
  doc.setFont(fontName, 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  const splitSchemaIntro = doc.splitTextToSize(schemaIntro, contentWidth);
  doc.text(splitSchemaIntro, margin, 42);

  // Table header
  let tableY = 56;
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(margin, tableY, contentWidth, 8, 'F');
  
  doc.setFont(fontName, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("Dziesiątek / Część", margin + 3, tableY + 5);
  doc.text("Ciąg RGBA (Światło)", margin + 45, tableY + 5);
  doc.text("Ciąg CMYK (Pigment)", margin + 95, tableY + 5);
  doc.text("Główna Symbolika", margin + 140, tableY + 5);

  const tableRows = [
    {
      dec: "Wprowadzenie",
      rgba: "Krzyż, Czarny, Czerwony, Zielony, Niebieski, Biały",
      cmyk: "Krzyż, Biały, Cyan, Magenta, Yellow, Czarny Key",
      desc: "Budowanie cnót Boskich i fundamentu wiary"
    },
    {
      dec: "I Dziesiątek",
      rgba: "10x Czerń (Alpha)",
      cmyk: "10x Biel",
      desc: "Nicość grzechu vs Skrucha pokutnika"
    },
    {
      dec: "II Dziesiątek",
      rgba: "10x Czerwień",
      cmyk: "10x Cyan (Błękit)",
      desc: "Miłość Serca Pana vs Maryjne oddanie"
    },
    {
      dec: "III Dziesiątek",
      rgba: "10x Zieleń",
      cmyk: "10x Magenta (Purpura)",
      desc: "Życie w Duchu vs Godność Królewska"
    },
    {
      dec: "IV Dziesiątek",
      rgba: "10x Niebieski",
      cmyk: "10x Żółty (Złoto)",
      desc: "Głębia kontemplacji vs Chwała Niebios"
    },
    {
      dec: "V Dziesiątek",
      rgba: "10x Biel",
      cmyk: "10x Czerń (Key)",
      desc: "Pełnia Zmartwychwstania vs Śmierć dla świata"
    }
  ];

  tableRows.forEach((row, idx) => {
    const rowY = tableY + 8 + (idx * 11);
    
    // Zebra striping
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, rowY, contentWidth, 11, 'F');
    }
    
    // Borders
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, rowY + 11, margin + contentWidth, rowY + 11);

    doc.setFont(fontName, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(row.dec, margin + 3, rowY + 7);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    
    const splitRgba = doc.splitTextToSize(row.rgba, 46);
    const splitCmyk = doc.splitTextToSize(row.cmyk, 42);
    const splitDesc = doc.splitTextToSize(row.desc, 32);

    doc.text(splitRgba, margin + 45, rowY + 4.5);
    doc.text(splitCmyk, margin + 95, rowY + 4.5);
    doc.text(splitDesc, margin + 140, rowY + 4.5);
  });

  // Interpretacja Kolorów Mini-Box
  const colorsY = tableY + 82;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, colorsY, contentWidth, 34, 'FD');

  doc.setFont(fontName, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("MEDYTACYJNY SŁOWNIK KOLORÓW eMBiK365:", margin + 4, colorsY + 6);

  const colorsText = 
    "• CZERŃ: Przejście ze stanu grzechu do oczyszczenia, głęboka cisza wewnętrzna przed aktem stworzenia.\n" +
    "• BIEL: Światło chwały, triumf życia nad śmiercią, czystość serca Maryi i nieskalane intencje.\n" +
    "• CZERWIEŃ: Krew Przymierza, gorejący ogień miłości Serca Jezusowego, zapał apostolski.\n" +
    "• ZIELEŃ & CYAN: Nadzieja odnowy duchowej, ożywcze tchnienie Ducha Świętego, oceaniczny spokój zawierzenia.\n" +
    "• MAGENTA & ŻÓŁTY: Królewski majestat Chrystusa, złoto wiecznej chwały Boga Ojca, blask niebieskiego Jeruzalem.";

  doc.setFont(fontName, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const splitColors = doc.splitTextToSize(colorsText, contentWidth - 8);
  doc.text(splitColors, margin + 4, colorsY + 11);

  // ==========================================
  // PAGE 4: DAILY REFLECTION & BLOG ENTRY
  // ==========================================
  if (onProgress) onProgress("Generowanie wpisu rozważania dziennego...");
  doc.addPage();
  drawPageBorder(4);

  doc.setFont(fontName, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text("4. Dzisiejsze Rozważanie i Wpis WnR365", margin, 32);
  
  doc.setFont(fontName, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(217, 119, 6);
  doc.text(data.cycleName.toUpperCase(), margin, 38);
  drawDivider(41, [245, 158, 11]);

  // Section A: Active Mystery rozważanie
  doc.setFont(fontName, 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`A. Rozważanie Różańcowe: ${data.activeStepLabel}`, margin, 48);

  doc.setFont(fontName, 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(79, 70, 229);
  doc.text(data.currentMysteryTitle, margin + 3, 54);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const splitMystText = doc.splitTextToSize(data.currentMysteryText, contentWidth - 6);
  doc.text(splitMystText, margin + 3, 59);

  const mystHeight = (splitMystText.length * 4) + 16;
  let blogSectionY = 48 + mystHeight;

  // Section B: Blog WnR365
  doc.setFont(fontName, 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text("B. Rozważanie Słowa: Widoki na Raj (WnR365)", margin, blogSectionY);

  doc.setFont(fontName, 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(217, 119, 6);
  const blogTitleClean = data.blogTitle || "Natchnienie na dziś (Brak wpisu)";
  doc.text(blogTitleClean, margin + 3, blogSectionY + 6);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const blogTextClean = data.blogText || "Dzisiejszy dzień upływa w skupieniu i cichej modlitwie serca. Możesz zapisać tutaj własne natchnienia i owoce kontemplacji płynące ze Słowa Bożego.";
  const splitBlogText = doc.splitTextToSize(blogTextClean, contentWidth - 6);
  
  // We limit the blog text length printed or let it flow nicely
  // If too long, print up to 25 lines, then trailing indicator
  const maxLines = 32;
  const linesToPrint = splitBlogText.slice(0, maxLines);
  doc.text(linesToPrint, margin + 3, blogSectionY + 11);
  
  if (splitBlogText.length > maxLines) {
    doc.setFont(fontName, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("[...] Ciąg dalszy wpisu dostępny jest w aplikacji interaktywnej eMBiK365.", margin + 3, blogSectionY + 11 + (maxLines * 4.2) + 3);
  }

  // Spiritual Notes Section for printing
  const notesY = Math.min(blogSectionY + 11 + (linesToPrint.length * 4.2) + 12, 238);
  
  doc.setFont(fontName, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("C. Owoce Modlitwy i Notatki Osobiste", margin, notesY);
  
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.3);
  
  // Draw journaling ruled lines
  let lineY = notesY + 6;
  while (lineY < pageHeight - margin - 4) {
    doc.line(margin, lineY, pageWidth - margin, lineY);
    lineY += 6.5;
  }

  if (onProgress) onProgress("Zapisywanie pliku PDF...");
  
  // Clean string filename
  const filenameDate = data.selectedDate.toISOString().split('T')[0];
  const safeFilename = `eMBiK365_Przewodnik_${filenameDate}.pdf`;
  
  doc.save(safeFilename);
  if (onProgress) onProgress("Pobieranie zakończone pomyślnie!");
};

export const generateYearlyEmbikPdf = async (
  prayers: Record<string, { title: string; text: string }>,
  blogEntries: Record<string, { title: string; text: string; dayIndex: number }>,
  onProgress?: (msg: string) => void
) => {
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
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  const contentHeight = pageHeight - (margin * 2);

  const drawPageBorderAndFooter = (pageNum: number) => {
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.rect(margin - 3, margin - 3, pageWidth - (margin * 2) + 6, pageHeight - (margin * 2) + 6);
    
    // Header
    doc.setFont(fontName, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text("eMBiK365 — Całoroczna Księga Rozważań i Wpisów Blogowych", margin, margin - 6);
    
    // Footer
    doc.setFont(fontName, 'normal');
    doc.text(`Strona ${pageNum}`, pageWidth - margin - 15, pageHeight - margin + 6);
    doc.text("Pielgrzymowanie Duchowe przez Maryję do Boga Ojca w Duchu Świętym", margin, pageHeight - margin + 6);
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

  // ==========================================
  // PAGE 1: COVER PAGE
  // ==========================================
  if (onProgress) onProgress("Generowanie okładki Księgi Całorocznej...");
  
  doc.setDrawColor(79, 70, 229); // indigo-600
  doc.setLineWidth(2.0);
  doc.line(margin, 40, pageWidth - margin, 40);

  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.setLineWidth(2.0);
  doc.line(margin, 42.5, pageWidth - margin, 42.5);

  doc.setFont(fontName, 'bold');
  doc.setFontSize(38);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("eMBiK365", margin, 65);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text("ELEKTRONICZNA MISJA BARW I KOLORÓW", margin, 73);

  doc.setFont(fontName, 'bold');
  doc.setFontSize(18);
  doc.setTextColor(79, 70, 229);
  doc.text("Księga Rozważań i Wpisów Blogowych", margin, 88);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text("Pełny Przewodnik Liturgiczny: 25 grudnia — 24 grudnia", margin, 96);

  // Decorative text box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.rect(margin, 110, contentWidth, 36, 'FD');

  doc.setFont(fontName, 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("DOKUMENT ZAWIERA:", margin + 5, 117);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text("• Kompletny Różaniec Historii Zbawienia (RHZ365) na każdy dzień w roku.", margin + 5, 123);
  doc.text("• 365 wpisów kontemplacji duchowych Widoki na Raj (WnR365) zsynchronizowanych z cyklami.", margin + 5, 128);
  doc.text("• Dualny układ paciorków: addytywny RGBA (światło) oraz pigmentowy CMYK (skrucha).", margin + 5, 133);
  doc.text("• Uniwersalny przewodnik duchowy, zredagowany w formie niezależnej od konkretnego roku.", margin + 5, 138);

  // Footer notes of cover
  doc.setFont(fontName, 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Chwała Jezusowi Chrystusowi w Bogu Ojcu i Duchu Świętym!", margin, 170);
  doc.text("Aplikacja eMBiK365 — Elektronika, Kolor, Wiara i Modlitwa.", margin, 176);

  drawPageBorderAndFooter(1);

  // ==========================================
  // PAGE 2: INTRODUCTION & EXPLANATION
  // ==========================================
  if (onProgress) onProgress("Generowanie wprowadzenia...");
  doc.addPage();
  drawPageBorderAndFooter(2);

  doc.setFont(fontName, 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("Wprowadzenie Teologiczne i Rytm Roku", margin, 30);
  
  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(0.4);
  doc.line(margin, 34, pageWidth - margin, 34);

  const introText = 
    "Księga eMBiK365 to owoc głębokiego pragnienia usystematyzowania codziennego życia modlitewnego w oparciu o uniwersalny liturgiczny rok, rozpoczynający się 25 grudnia w Uroczystość Narodzenia Pańskiego, a kończący 24 grudnia w Wigilię kolejnego roku. Pominięcie dnia 29 lutego gwarantuje stabilny, wieczny 365-dniowy rytm, w pełni niezależny od lat przestępnych.\n\n" +
    "Struktura Roku Liturgicznego podzielona jest na cztery główne okresy:\n\n" +
    "1. CYKL I — RÓŻANIEC TRADYCYJNY (Dni 1 do 175):\n" +
    "Koncentruje się wokół walki duchowej: Miłości Boga Ojca (RGBA - addytywna synteza światła) oraz pokuty za grzechy i zadośćuczynienia za nienawiść (CMYK - subtraktywne barwy pigmentowe). Każdy dzień przynosi parę tajemnic rozważanych na poszczególnych dziesiątkach różańca tradycyjnego.\n\n" +
    "2. CZAS WYCISZENIA I PRZERWY (Dni 176 do 182):\n" +
    "7-dniowy czas głębokiej ciszy przed kolejnym wielkim cyklem natchnień.\n\n" +
    "3. CYKL II — RÓŻANIEC DO BOGA OJCA (Dni 183 do 357):\n" +
    "Czas medytacji nad Ojcowską Miłością i Opatrznością na dużych paciorkach (Zdrowaś Maryjo) oraz uwielbieniem i odpustem na małych paciorkach (Ojcze Nasz). To unikalna droga powrotu do Ojca.\n\n" +
    "4. OKRES PRZYGOTOWANIA (Dni 358 do 365):\n" +
    "Czas wyciszenia i przygotowania na Narodzenie Pańskie i kolejny cykl modlitewny.\n\n" +
    "Używaj tej księgi jako codziennego modlitewnika, przewodnika lektury lub formy osobistych, całorocznych rekolekcji.";

  doc.setFont(fontName, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const splitIntro = doc.splitTextToSize(introText, contentWidth);
  doc.text(splitIntro, margin, 42);

  // ==========================================
  // PAGES 3+: THE 365 DAYS (3 days per page)
  // ==========================================
  let pageNum = 3;
  let itemsOnPage = 0;
  let blockHeight = 82;
  let blockGap = 4;
  let startY = 24; // starting Y for items on page

  const { getActiveDecadeMystery } = await import('../data/prayers');

  for (let i = 0; i < 365; i++) {
    if (i % 3 === 0) {
      if (i > 0) {
        pageNum++;
      }
      if (onProgress) {
        const percent = Math.floor((i / 365) * 100);
        onProgress(`Generowanie dni ${i + 1} - ${Math.min(365, i + 3)} z 365 (${percent}%)...`);
      }
      doc.addPage();
      drawPageBorderAndFooter(pageNum);
      itemsOnPage = 0;
    }

    const dayOfCycleIdx = i; // 0 to 364
    const date = getDateFromDayIndex(dayOfCycleIdx);
    const dayLabel = `${date.getDate()} ${MONTH_NAMES_GENITIVE[date.getMonth()]}`;

    // Get cycle details
    let cycleType: 'cycle1' | 'cycle2' | 'break' | 'break2' = 'cycle1';
    let dayOfCycle = 1;
    let cycleNameCompact = "";
    
    if (dayOfCycleIdx >= 0 && dayOfCycleIdx < 175) {
      cycleType = 'cycle1';
      dayOfCycle = dayOfCycleIdx + 1;
      cycleNameCompact = `Cykl I — Dzień ${dayOfCycle} (Różaniec Tradycyjny)`;
    } else if (dayOfCycleIdx >= 175 && dayOfCycleIdx < 182) {
      cycleType = 'break';
      dayOfCycle = dayOfCycleIdx - 174;
      cycleNameCompact = `7 Dni Przerwy — Dzień ${dayOfCycle}`;
    } else if (dayOfCycleIdx >= 182 && dayOfCycleIdx < 357) {
      cycleType = 'cycle2';
      dayOfCycle = dayOfCycleIdx - 181;
      cycleNameCompact = `Cykl II — Dzień ${dayOfCycle} (Różaniec do Boga Ojca)`;
    } else {
      cycleType = 'break2';
      dayOfCycle = dayOfCycleIdx - 356;
      cycleNameCompact = `Okres Przygotowania — Dzień ${dayOfCycle}`;
    }

    const y = startY + (itemsOnPage * (blockHeight + blockGap));

    // 1. Draw header background box for this day
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 7, 'FD');

    // Title text inside header
    doc.setFont(fontName, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`DZIEŃ ${dayOfCycleIdx + 1} — ${dayLabel.toUpperCase()}`, margin + 3, y + 4.8);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(79, 70, 229);
    doc.text(cycleNameCompact, margin + contentWidth - 3, y + 4.8, { align: 'right' });

    // 2. Fetch and draw mysteries titles (compact)
    doc.setFont(fontName, 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("ROZWAŻANIA RÓŻAŃCOWE (RGBA / CMYK):", margin + 3, y + 11.5);

    let mysteriesLine1 = "";
    let mysteriesLine2 = "";

    try {
      if (cycleType === 'cycle1' || cycleType === 'cycle2') {
        const m1 = getActiveDecadeMystery(cycleType, dayOfCycle, 1, prayers);
        const m2 = getActiveDecadeMystery(cycleType, dayOfCycle, 2, prayers);
        const m3 = getActiveDecadeMystery(cycleType, dayOfCycle, 3, prayers);
        const m4 = getActiveDecadeMystery(cycleType, dayOfCycle, 4, prayers);
        const m5 = getActiveDecadeMystery(cycleType, dayOfCycle, 5, prayers);

        mysteriesLine1 = `Dz. I: ${m1.rgba.title.split(' (')[0]} | Dz. II: ${m2.rgba.title.split(' (')[0]} | Dz. III: ${m3.rgba.title.split(' (')[0]}`;
        mysteriesLine2 = `Dz. IV: ${m4.rgba.title.split(' (')[0]} | Dz. V: ${m5.rgba.title.split(' (')[0]}`;
        
        if (cycleType === 'cycle1') {
          mysteriesLine2 += ` | Pokuta CMYK: ${m1.cmyk.title.split(' (')[0]}`;
        }
      } else {
        mysteriesLine1 = "Dzień wyciszenia modlitewnego i przygotowania wewnętrznego. Rozważania skupiają się wokół kontemplacji ciszy.";
        mysteriesLine2 = "";
      }
    } catch (e) {
      mysteriesLine1 = "Brak szczegółowego rozważania w bazie.";
      mysteriesLine2 = "";
    }

    doc.setFont(fontName, 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    doc.text(mysteriesLine1, margin + 3, y + 15);
    if (mysteriesLine2) {
      doc.text(mysteriesLine2, margin + 3, y + 18.2);
    }

    // Divider line
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(margin + 3, y + 20, margin + contentWidth - 3, y + 20);

    // 3. Blog post title and text
    const docId = `blog_day_${dayOfCycleIdx}`;
    const entry = blogEntries[docId] || {
      title: `Widoki na Raj - Dzień ${dayOfCycle} (${cycleNameCompact})`,
      text: "Chwała Jezusowi w Bogu Ojcu!\nTo jest Twój wpis blogowy Widoki na Raj (WnR365) pisany pod natchnieniem Ducha Świętego, stanowiący element eMBiK365 (elektronicznej Misji Barw i Kolorów)."
    };

    doc.setFont(fontName, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(217, 119, 6); // amber-600
    doc.text(`BLOG WnR365: ${entry.title || 'Rozważanie Słowa'}`, margin + 3, y + 24.5);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105); // slate-600
    
    const cleanBodyText = entry.text.replace(/[\[\]]/g, '').trim();
    const splitBlog = doc.splitTextToSize(cleanBodyText, contentWidth - 6);
    
    // We can print up to 11 lines safely inside the block budget
    const maxBlogLines = 11;
    const blogLinesToPrint = splitBlog.slice(0, maxBlogLines);
    doc.text(blogLinesToPrint, margin + 3, y + 28.5);

    if (splitBlog.length > maxBlogLines) {
      doc.setFont(fontName, 'bold');
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text("[...] Pełna treść rozważania jest dostępna w aplikacji eMBiK365.", margin + 3, y + 28.5 + (maxBlogLines * 3.1) + 2);
    }

    itemsOnPage++;
  }

  if (onProgress) onProgress("Zapisywanie całorocznej księgi PDF...");
  
  const safeFilename = `eMBiK365_Ksiega_Caloroczna_Rozwazan.pdf`;
  doc.save(safeFilename);
  
  if (onProgress) onProgress("Pobieranie zakończone pomyślnie!");
};

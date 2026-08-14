import JSZip from 'jszip';
import { COVER_IMAGE_BASE64 } from '../assets/coverBase64';
import { generateQrCodeDataUri } from './qrCodeGenerator';
import rhzData from '../../RHZ365_pierwszy_cykl_175_dni.json';
import { parseDayText } from './rhzParser';
import { getWnrDefaultBlogEntry } from './wnrBlogDefaults';

export interface EpubExportOptions {
  scope: 'rhz365' | 'wnr365' | 'both';
  range: 'single' | 'full';
  includeCover: boolean;
  selectedDate: Date;
  dayOfCycle: number;
  prayers: Record<string, { title: string; text: string }>;
  blogEntries: Record<string, { title: string; text: string; dayIndex: number }>;
}

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

const escapeXml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const extractUrlsFromText = (text: string): string[] => {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s<>"'\(\)]+)/gi;
  const matches = text.match(urlRegex) || [];
  return Array.from(new Set(matches));
};

export const generateEpubBook = async (
  options: EpubExportOptions,
  onProgress?: (msg: string, percent?: number) => void
): Promise<void> => {
  const { scope, range, includeCover, dayOfCycle, prayers, blogEntries } = options;

  if (onProgress) onProgress("Inicjalizacja generatora EPUB (skład e-book 12pt)...", 0);

  const zip = new JSZip();

  // 1. mimetype
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  // 2. META-INF/container.xml
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  zip.file("META-INF/container.xml", containerXml);

  // 3. OEBPS/style.css
  const styleCss = `
body {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 12pt;
  line-height: 1.5;
  margin: 5% 4%;
  padding: 0;
  color: #1e293b;
  background-color: #ffffff;
  box-sizing: border-box;
  word-break: break-word;
  overflow-wrap: break-word;
}
img, iframe, table, div, pre, p, blockquote {
  max-width: 100% !important;
  box-sizing: border-box;
  word-break: break-word;
  overflow-wrap: break-word;
}
h1, h2, h3, h4 {
  font-family: sans-serif;
  color: #0f172a;
  text-align: center;
  margin-top: 1.2em;
  margin-bottom: 0.4em;
  line-height: 1.3;
  word-break: break-word;
}
h1 { font-size: 1.6em; border-bottom: 2px solid #4f46e5; padding-bottom: 0.3em; }
h2 { font-size: 1.3em; color: #4f46e5; }
h3 { font-size: 1.1em; color: #d97706; }
p {
  font-size: 12pt;
  line-height: 1.5;
  margin-bottom: 0.8em;
  text-align: justify;
}
.cover-img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}
.box {
  background-color: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 12px;
  margin: 14px 0;
  max-width: 100%;
  box-sizing: border-box;
}
.qr-container {
  text-align: center;
  margin: 16px 0;
  padding: 10px;
  border: 1px dashed #cbd5e1;
  background: #fafafa;
  max-width: 100%;
  box-sizing: border-box;
}
.qr-img {
  width: 150px;
  height: 150px;
  margin: 0 auto 6px auto;
  display: block;
}
.qr-url {
  font-family: monospace;
  font-size: 0.85em;
  color: #2563eb;
  word-break: break-all;
  text-decoration: underline;
}
.toc-list {
  list-style-type: none;
  padding-left: 0;
}
.toc-item {
  margin-bottom: 8px;
  padding: 6px;
  border-bottom: 1px solid #e2e8f0;
}
.toc-link {
  color: #4f46e5;
  font-weight: bold;
  text-decoration: underline;
}
`;
  zip.file("OEBPS/style.css", styleCss);

  // Cover Handling
  const coverBase64Data = COVER_IMAGE_BASE64.replace(/^data:image\/png;base64,/, '');
  if (includeCover) {
    zip.file("OEBPS/cover.png", coverBase64Data, { base64: true });
    
    const coverXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Okładka - Widoki na Raj</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body style="margin:0; padding:0; text-align:center;">
  <div>
    <img src="cover.png" alt="Okładka e-booka" class="cover-img" />
  </div>
</body>
</html>`;
    zip.file("OEBPS/cover.xhtml", coverXhtml);
  }

  // Days to include
  const startDayIdx = range === 'single' ? dayOfCycle - 1 : 0;
  const endDayIdx = range === 'single' ? dayOfCycle : 365;

  const manifestItems: string[] = [
    `<item id="css" href="style.css" media-type="text/css"/>`,
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`
  ];
  if (includeCover) {
    manifestItems.push(`<item id="cover-img" href="cover.png" media-type="image/png" properties="cover-image"/>`);
    manifestItems.push(`<item id="cover-xhtml" href="cover.xhtml" media-type="application/xhtml+xml"/>`);
  }

  const spineRefs: string[] = [];
  if (includeCover) {
    spineRefs.push(`<itemref idref="cover-xhtml" linear="yes"/>`);
  }

  const tocEntries: { id: string; title: string; href: string }[] = [];

  // Add Intro & Mission Chapter for full EPUB book
  if (range === 'full') {
    const mainText = prayers['introTextMain']?.text;
    const missionText = prayers['introTextMission']?.text;
    if (mainText || missionText) {
      const introId = 'intro_chapter';
      const introHref = 'intro.xhtml';
      const introTitle = 'Wstęp i Misja eMBiK365';

      tocEntries.push({ id: introId, title: introTitle, href: introHref });
      manifestItems.push(`<item id="${introId}" href="${introHref}" media-type="application/xhtml+xml"/>`);
      spineRefs.push(`<itemref idref="${introId}"/>`);

      const mainParas = (mainText || '').split(/\n\s*\n+/).map(p => `<p>${escapeXml(p.trim())}</p>`).join('');
      const missionPara = missionText ? `<div className="box"><h3>Misja eMBiK365</h3><p><strong>${escapeXml(missionText.trim())}</strong></p></div>` : '';

      const introHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeXml(introTitle)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>${escapeXml(introTitle)}</h1>
  ${mainParas}
  ${missionPara}
</body>
</html>`;

      zip.file(`OEBPS/${introHref}`, introHtml);
    }
  }

  for (let i = startDayIdx; i < endDayIdx; i++) {
    const dayNum = i + 1;
    const current = i - startDayIdx + 1;
    const total = endDayIdx - startDayIdx;
    const pct = Math.round((current / total) * 85);

    if (onProgress) {
      onProgress(`Generowanie rozdziałów EPUB: Dzień ${dayNum} (${current}/${total})...`, pct);
    }

    // Yield control to browser main loop so progress bar updates smoothly without UI lag
    await new Promise((r) => setTimeout(r, 0));

    const date = getDateFromDayIndex(i);
    const dayLabel = `${date.getDate()} ${MONTH_NAMES_GENITIVE[date.getMonth()]}`;

    let cycleName = "";
    if (i >= 0 && i < 175) {
      cycleName = `Cykl I (Różaniec Tradycyjny) — Dzień ${i + 1}`;
    } else if (i >= 175 && i < 182) {
      cycleName = `7 Dni Przerwy — Dzień ${i - 174}`;
    } else if (i >= 182 && i < 357) {
      cycleName = `Cykl II (Różaniec do Boga Ojca) — Dzień ${i - 181}`;
    } else {
      cycleName = `Okres Przygotowania — Dzień ${i - 356}`;
    }

    const chapterId = `day_${dayNum}`;
    const chapterHref = `${chapterId}.xhtml`;
    const chapterTitle = `Dzień ${dayNum} — ${dayLabel} (${cycleName})`;

    tocEntries.push({ id: chapterId, title: chapterTitle, href: chapterHref });
    manifestItems.push(`<item id="${chapterId}" href="${chapterHref}" media-type="application/xhtml+xml"/>`);
    spineRefs.push(`<itemref idref="${chapterId}"/>`);

    // Fetch RHZ and WnR content
    const decIdx = ((dayNum - 1) % 5) + 1;
    const firestoreKey = `day_${dayNum}_decade_rgba_${decIdx}`;
    const rhzDoc = prayers[firestoreKey];
    const rawRhzText = rhzDoc?.text || rhzData[Math.min(dayNum - 1, rhzData.length - 1)]?.text || '';
    const rhzTitle = rhzDoc?.title || rhzData[Math.min(dayNum - 1, rhzData.length - 1)]?.title || `Dzień ${dayNum}`;

    const parsedRHZ = parseDayText(dayNum, rawRhzText);

    const wnrKey = `blog_day_${i}`;
    const wnrDoc = getWnrDefaultBlogEntry(i, prayers, blogEntries);

    // Extract all URLs
    const dayUrl = `https://widokinaraj.pl/day/${dayNum}`;
    const embeddedUrls = extractUrlsFromText(`${rawRhzText} ${wnrDoc.text || ''}`);
    const allUrls = Array.from(new Set([dayUrl, ...embeddedUrls]));

    let chapterHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeXml(chapterTitle)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>Dzień ${dayNum} — ${escapeXml(dayLabel.toUpperCase())}</h1>
  <h3>${escapeXml(cycleName)}</h3>
`;

    for (const urlItem of allUrls) {
      const qrDataBase64 = await generateQrCodeDataUri(urlItem);
      chapterHtml += `  <div class="qr-container">
    <img src="${qrDataBase64}" class="qr-img" alt="Kod QR" />
    <br/>
    <a href="${escapeXml(urlItem)}" class="qr-url" target="_blank">${escapeXml(urlItem)}</a>
  </div>\n`;
    }

const stripQrTags = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/\[qr:[^\]]+\]/gi, '')
    .replace(/\[caption:[^\]]+\]/gi, '')
    .trim();
};

const formatParagraphsHtml = (rawText: string): string => {
  if (!rawText) return '';
  const cleaned = stripQrTags(rawText);
  const normalized = cleaned.replace(/\r\n/g, '\n').trim();
  const blocks = normalized.split(/\n\s*\n+/);
  return blocks
    .map(block => {
      const paraText = block.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
      return paraText ? `<p>${escapeXml(paraText)}</p>` : '';
    })
    .filter(Boolean)
    .join('\n');
};

    if (scope === 'rhz365' || scope === 'both') {
      chapterHtml += `<h2>Różaniec Historii Zbawienia (RHZ365)</h2>`;
      chapterHtml += `<h3>${escapeXml(rhzTitle)}</h3>`;

      if (parsedRHZ.success && parsedRHZ.data) {
        chapterHtml += `<div class="box"><h4>Rozważanie Tajemnicy</h4>${formatParagraphsHtml(parsedRHZ.data.reflectionText)}</div>`;
        chapterHtml += `<div class="box"><h4>Modlitwa Pańska (Ojcze Nasz)</h4>${formatParagraphsHtml(parsedRHZ.data.ourFatherText)}</div>`;

        chapterHtml += `<h4>10 Osobnych Modlitw Zdrowaś Maryjo:</h4><ol>`;
        parsedRHZ.data.hailMaryTexts.forEach((hmText) => {
          chapterHtml += `<li>${formatParagraphsHtml(hmText)}</li>`;
        });
        chapterHtml += `</ol>`;

        chapterHtml += `<div class="box"><h4>Chwała Ojcu &amp; O mój Jezu</h4>${formatParagraphsHtml(parsedRHZ.data.gloryBeFatimaText)}</div>`;
      } else {
        chapterHtml += formatParagraphsHtml(rawRhzText);
      }
    }

    if (scope === 'wnr365' || scope === 'both') {
      chapterHtml += `<h2>Widoki na Raj (WnR365)</h2>`;
      chapterHtml += `<h3>${escapeXml(wnrDoc.title || `Rozważanie Słowa - Dzień ${dayNum}`)}</h3>`;
      chapterHtml += formatParagraphsHtml(wnrDoc.text || '');
    }

    chapterHtml += `</body>\n</html>`;
    zip.file(`OEBPS/${chapterHref}`, chapterHtml);
  }

  // Table of Contents chapter
  const tocId = "toc_end";
  const tocHref = "toc.xhtml";
  manifestItems.push(`<item id="${tocId}" href="${tocHref}" media-type="application/xhtml+xml"/>`);
  spineRefs.push(`<itemref idref="${tocId}"/>`);

  let tocXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Spis Treści - eMBiK365</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>Spis Treści</h1>
  <p>Kliknij w wybrany odsyłacz, aby przejść do danego dnia rozważań:</p>
  <ul class="toc-list">
`;
  tocEntries.forEach((entry) => {
    tocXhtml += `    <li class="toc-item"><a href="${entry.href}" class="toc-link">${escapeXml(entry.title)}</a></li>\n`;
  });
  tocXhtml += `  </ul>\n</body>\n</html>`;
  zip.file(`OEBPS/${tocHref}`, tocXhtml);

  // 4. OEBPS/toc.ncx
  let ncxContent = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:embik365-ebook-${new Date().getTime()}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>Widoki na Raj &amp; Różaniec Historii Zbawienia</text>
  </docTitle>
  <navMap>
`;

  let navPointIdx = 1;
  if (includeCover) {
    ncxContent += `    <navPoint id="navPoint-${navPointIdx}" playOrder="${navPointIdx}">
      <navLabel><text>Okładka</text></navLabel>
      <content src="cover.xhtml"/>
    </navPoint>\n`;
    navPointIdx++;
  }

  tocEntries.forEach((entry) => {
    ncxContent += `    <navPoint id="navPoint-${navPointIdx}" playOrder="${navPointIdx}">
      <navLabel><text>${escapeXml(entry.title)}</text></navLabel>
      <content src="${entry.href}"/>
    </navPoint>\n`;
    navPointIdx++;
  });

  ncxContent += `    <navPoint id="navPoint-${navPointIdx}" playOrder="${navPointIdx}">
      <navLabel><text>Spis Treści</text></navLabel>
      <content src="toc.xhtml"/>
    </navPoint>\n`;

  ncxContent += `  </navMap>\n</ncx>`;
  zip.file("OEBPS/toc.ncx", ncxContent);

  // 5. OEBPS/content.opf
  const bookTitle = scope === 'rhz365' ? "Różaniec Historii Zbawienia (RHZ365)" : scope === 'wnr365' ? "Widoki na Raj (WnR365)" : "Widoki na Raj & RHZ365 — eMBiK365";
  const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:embik365-ebook-${new Date().getTime()}</dc:identifier>
    <dc:title>${escapeXml(bookTitle)}</dc:title>
    <dc:creator>Dominik Jan Kuta pod redakcją dr Aleksandry Sabasz-Kuta</dc:creator>
    <dc:publisher>eMBiK</dc:publisher>
    <dc:language>pl</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineRefs.join('\n    ')}
  </spine>
</package>`;
  zip.file("OEBPS/content.opf", opfContent);

  if (onProgress) onProgress("Pakowanie archiwum EPUB...", 90);

  const blob = await zip.generateAsync(
    { type: "blob", mimeType: "application/epub+zip" },
    (metadata) => {
      if (onProgress) {
        const zipPct = 90 + Math.round((metadata.percent / 100) * 10);
        onProgress(`Pakowanie archiwum EPUB (${Math.round(metadata.percent)}%)...`, Math.min(99, zipPct));
      }
    }
  );

  const fileNameScope = scope === 'rhz365' ? 'RHZ365' : scope === 'wnr365' ? 'WnR365' : 'eMBiK365_RHZ365_WnR365';
  const fileNameRange = range === 'single' ? `Dzien_${dayOfCycle}` : 'Calosc_Ksiega';
  const downloadFilename = `${fileNameScope}_${fileNameRange}.epub`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if (onProgress) onProgress("Pobieranie pliku EPUB zakończone pomyślnie!", 100);
};

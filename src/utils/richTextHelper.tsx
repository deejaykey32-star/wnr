import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, Maximize2 } from 'lucide-react';

/**
 * Normalizes Windows file paths (e.g. C:\proj\wnr1\covers.png or C:/proj/wnr1/covers.png),
 * file:/// paths, and relative paths to browser-usable asset paths (/covers.png).
 */
export const normalizeImagePath = (pathStr: string): string => {
  if (!pathStr) return '';
  let trimmed = pathStr.trim();
  // Strip enclosing quotes if any
  trimmed = trimmed.replace(/^["']|["']$/g, '');

  // If absolute Windows path (e.g., C:\proj\wnr1\covers.png) or file protocol URL
  if (/^[a-zA-Z]:[\\/]/i.test(trimmed) || trimmed.startsWith('file:///')) {
    const parts = trimmed.split(/[\\/]/);
    const fileName = parts[parts.length - 1];
    return fileName ? `/${fileName}` : trimmed;
  }

  // If relative path without leading slash (e.g. covers.png)
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:') && !trimmed.startsWith('/')) {
    return `/${trimmed}`;
  }

  return trimmed;
};

export const normalizeTextParagraphs = (rawText: string): string => {
  if (!rawText) return '';
  const text = rawText.replace(/\r\n/g, '\n').trim();

  // Split into blocks by double newlines or single newlines to preserve user formatting
  const rawBlocks = text.split(/\n\s*\n/);
  const finalBlocks: string[] = [];

  for (const block of rawBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Check if lines within the block have explicit Markdown headers or section tags
    const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
    let currentPara: string[] = [];

    const flushCurrent = () => {
      if (currentPara.length > 0) {
        finalBlocks.push(currentPara.join(' '));
        currentPara = [];
      }
    };

    for (const line of lines) {
      if (
        line.startsWith('#') || 
        line.startsWith('[qr:') || 
        line.startsWith('[image:') ||
        line.startsWith('![') ||
        line.startsWith('```') ||
        line.startsWith('<') ||
        line.startsWith('Etap ') ||
        line.startsWith('Część ') ||
        line.startsWith('Tajemnica ') ||
        line.startsWith('Rozdział ') ||
        line.startsWith('Wstęp ') ||
        line.startsWith('Zakończenie') ||
        line.startsWith('Dodatek') ||
        line.startsWith('Modlitwa') ||
        line.startsWith('Dzień ')
      ) {
        flushCurrent();
        finalBlocks.push(
          line.startsWith('#') || line.startsWith('[') || line.startsWith('<') || line.startsWith('```') 
            ? line 
            : `### ${line}`
        );
      } else {
        currentPara.push(line);
      }
    }
    flushCurrent();
  }

  return finalBlocks.join('\n\n');
};

/**
 * Interactive Code Block Component with language badge & copy-to-clipboard functionality
 */
const CodeBlockContainer: React.FC<{ code: string; language: string; theme: string }> = ({ code, language, theme }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayLang = language.toUpperCase() || 'CODE';

  return (
    <div className="my-5 border border-slate-700/80 rounded-xl overflow-hidden shadow-2xl bg-slate-950 font-mono text-xs text-left">
      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900 border-b border-slate-800 text-slate-400 select-none">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/80"></span>
          <span className="ml-2 font-bold text-[10px] tracking-wider text-emerald-400 uppercase font-mono">{displayLang}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="text-[10px] font-sans px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1 cursor-pointer border border-slate-700"
        >
          {copied ? '✓ Skopiowano!' : '📋 Kopiuj kod'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-emerald-300 leading-relaxed font-mono text-xs whitespace-pre select-text">
        <code>{code}</code>
      </pre>
    </div>
  );
};

/**
 * Embedded JavaScript Script execution container for live preview
 */
const ScriptBlockContainer: React.FC<{ scriptCode: string }> = ({ scriptCode }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !scriptCode.trim()) return;
    try {
      const scriptEl = document.createElement('script');
      scriptEl.type = 'text/javascript';
      scriptEl.text = scriptCode;
      containerRef.current.appendChild(scriptEl);

      return () => {
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      };
    } catch (err) {
      console.warn("Błąd podczas wykonywania skryptu JS:", err);
    }
  }, [scriptCode]);

  return <div ref={containerRef} className="my-2 text-xs font-mono" />;
};

/**
 * A robust, safe lightweight helper to format plain text / Markdown / HTML tags
 * into structured React elements with Tailwind CSS styling and Full-Screen Image Lightbox.
 */
export const RichTextRenderer: React.FC<{ text: string; theme?: 'dark' | 'light' }> = ({ text, theme = 'dark' }) => {
  const [activeLightboxImg, setActiveLightboxImg] = useState<{ src: string; alt: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close full screen modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveLightboxImg(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Delegation click handler for inline or custom HTML <img> elements inside text (excluding QR codes)
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target && 
      target.tagName === 'IMG' && 
      !target.classList.contains('qr-code-img') &&
      !target.closest('.qr-code-container')
    ) {
      const img = target as HTMLImageElement;
      if (img.src) {
        setActiveLightboxImg({
          src: img.src,
          alt: img.alt || 'Powiększona grafika'
        });
      }
    }
  };

  if (!text) return null;

  const normalizedText = normalizeTextParagraphs(text);
  const lines = normalizedText.split('\n');
  const elements: React.ReactNode[] = [];
  
  let keyIndex = 0;
  let inList = false;
  let listItems: string[] = [];
  let currentAlignment: 'left' | 'center' | 'right' | 'justify' | null = null;
  let currentFont: string | null = null;
  let currentColor: string | null = null;
  let currentBg: string | null = null;
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const combined = paragraphBuffer.join(' ');
    paragraphBuffer = [];
    const pClass = theme === 'light' ? 'light-mode-text' : 'text-slate-200';
    const ac = currentAlignment === 'center' ? 'text-center [text-align-last:center]' :
               currentAlignment === 'right' ? 'text-right [text-align-last:right]' :
               currentAlignment === 'justify' ? 'text-justify [text-align-last:left]' :
               currentAlignment === 'left' ? 'text-left [text-align-last:left]' : 'text-justify [text-align-last:left]';
    elements.push(
      <p
        key={`p-${keyIndex++}`}
        style={theme === 'light' ? { color: '#000000' } : undefined}
        className={`text-sm sm:text-base leading-relaxed mb-5 tracking-normal ${pClass} ${ac}`}
        dangerouslySetInnerHTML={{ __html: parseInlineStyles(combined, theme, { font: currentFont, color: currentColor, bg: currentBg }) }}
      />
    );
  };

  const flushList = () => {
    if (listItems.length > 0) {
      const listColorClass = theme === 'light' ? 'light-mode-text' : 'text-slate-300';
      elements.push(
        <ul key={`list-${keyIndex++}`} style={theme === 'light' ? { color: '#000000' } : undefined} className={`list-disc pl-5 my-3 space-y-1 ${listColorClass} text-sm`}>
          {listItems.map((item, idx) => (
            <li key={`li-${idx}`} style={theme === 'light' ? { color: '#000000' } : undefined} dangerouslySetInnerHTML={{ __html: parseInlineStyles(item, theme, { font: currentFont, color: currentColor, bg: currentBg }) }} />
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Alignment Tags detection
    if (line.includes('[align:left]')) {
      currentAlignment = 'left';
      line = line.replace('[align:left]', '');
    } else if (line.includes('[align:center]')) {
      currentAlignment = 'center';
      line = line.replace('[align:center]', '');
    } else if (line.includes('[align:right]')) {
      currentAlignment = 'right';
      line = line.replace('[align:right]', '');
    } else if (line.includes('[align:justify]')) {
      currentAlignment = 'justify';
      line = line.replace('[align:justify]', '');
    }

    if (line.includes('<div align="left">') || line.includes('<p align="left">')) {
      currentAlignment = 'left';
      line = line.replace(/<div align="left">|<p align="left">/g, '');
    } else if (line.includes('<div align="center">') || line.includes('<p align="center">') || line.includes('<center>')) {
      currentAlignment = 'center';
      line = line.replace(/<div align="center">|<p align="center">|<center>/g, '');
    } else if (line.includes('<div align="right">') || line.includes('<p align="right">')) {
      currentAlignment = 'right';
      line = line.replace(/<div align="right">|<p align="right">/g, '');
    } else if (line.includes('<div align="justify">') || line.includes('<p align="justify">')) {
      currentAlignment = 'justify';
      line = line.replace(/<div align="justify">|<p align="justify">/g, '');
    }

    let closedAlignmentThisLine = false;
    if (line.includes('[/align]')) {
      closedAlignmentThisLine = true;
      line = line.replace('[/align]', '');
    }
    if (line.includes('</div>') || line.includes('</p>') || line.includes('</center>')) {
      closedAlignmentThisLine = true;
      line = line.replace(/<\/div>|<\/p>|<\/center>/g, '');
    }

    // Font, Color, and Background Tag State Tracking
    const fontMatch = line.match(/\[font:([^\]]+)\]/);
    if (fontMatch) currentFont = fontMatch[1];
    
    const colorMatch = line.match(/\[color:([^\]]+)\]/);
    if (colorMatch) currentColor = colorMatch[1];

    const bgMatch = line.match(/\[bg:([^\]]+)\]/);
    if (bgMatch) currentBg = bgMatch[1];

    let closedFontThisLine = line.includes('[/font]');
    let closedColorThisLine = line.includes('[/color]');
    let closedBgThisLine = line.includes('[/bg]');

    const alignClass = currentAlignment === 'center' ? 'text-center [text-align-last:center]' :
                       currentAlignment === 'right' ? 'text-right [text-align-last:right]' :
                       currentAlignment === 'justify' ? 'text-justify [text-align-last:left]' :
                       currentAlignment === 'left' ? 'text-left [text-align-last:left]' : 'text-justify [text-align-last:left]';

    // 0. Detect Multi-line Code Block
    if (line.startsWith('```')) {
      flushParagraph();
      flushList();
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <CodeBlockContainer 
          key={`code-${keyIndex++}`}
          code={codeLines.join('\n')}
          language={lang || 'text'}
          theme={theme}
        />
      );
      continue;
    }

    // 0b. Detect Inline or Tag Script Blocks (<script>...</script>)
    if (line.includes('<script')) {
      flushParagraph();
      flushList();
      let scriptCode = '';
      if (line.includes('</script>')) {
        scriptCode = line.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
      } else {
        const scriptLines: string[] = [];
        let curr = line.replace(/<script[^>]*>/i, '');
        if (curr) scriptLines.push(curr);
        i++;
        while (i < lines.length && !lines[i].includes('</script>')) {
          scriptLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          scriptLines.push(lines[i].replace(/<\/script>/i, ''));
        }
        scriptCode = scriptLines.join('\n').trim();
      }

      elements.push(
        <ScriptBlockContainer key={`script-${keyIndex++}`} scriptCode={scriptCode} />
      );
      continue;
    }

    // 1. Detect QR code block
    if (line.includes('qr-block') || line.includes('api.qrserver.com') || line.includes('[qr:')) {
      flushParagraph();
      flushList();
      
      let url = '';
      let caption = '';

      if (line.includes('[qr:')) {
        const fullMatch = line.match(/\[qr:\s*([^|\]]+)\](?:\[caption:\s*([^\]]+)\])?/i) || line.match(/\[qr:\s*([^|\]]+)\|\s*([^\]]+)\]/i);
        if (fullMatch) {
          url = fullMatch[1].trim();
          caption = fullMatch[2] ? fullMatch[2].trim() : '';
        }
        if (!caption) {
          const capMatch = line.match(/\[caption:\s*([^\]]+)\]/i);
          if (capMatch) caption = capMatch[1].trim();
        }
      } else {
        const srcMatch = lines[i].match(/src=["']([^"']+)["']/) || (lines[i+1] && lines[i+1].match(/src=["']([^"']+)["']/));
        const altMatch = lines[i].match(/alt=["']([^"']+)["']/) || (lines[i+1] && lines[i+1].match(/alt=["']([^"']+)["']/));
        
        let captionText = '';
        for (let j = i; j < Math.min(i + 6, lines.length); j++) {
          if (lines[j].includes('text-slate-400') || lines[j].includes('caption')) {
            captionText = lines[j].replace(/<[^>]*>/g, '').trim();
            break;
          }
        }

        if (srcMatch) {
          const queryParams = new URLSearchParams(srcMatch[1].split('?')[1] || '');
          url = queryParams.get('data') || srcMatch[1];
        }
        caption = captionText || (altMatch ? altMatch[1] : 'Kod QR');
      }

      if (url) {
        let normalizedUrl = url;
        if (normalizedUrl.includes('widokinaraj') && !normalizedUrl.includes('#')) {
          normalizedUrl = normalizedUrl
            .replace('/wnr365-day', '/#/wnr365-day')
            .replace('/rhz365-day', '/#/rhz365-day')
            .replace('/day', '/#/day');
        }

        let targetHref = normalizedUrl;
        if (!targetHref.startsWith('http://') && !targetHref.startsWith('https://') && !targetHref.startsWith('/') && !targetHref.startsWith('#')) {
          targetHref = `https://${targetHref}`;
        }

        const isInternalRoute = targetHref.startsWith('/#/') || targetHref.startsWith('#/') || targetHref.startsWith('/r/') || targetHref.startsWith('/s/');

        const qrUrl = normalizedUrl.startsWith('http') 
          ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(normalizedUrl)}`
          : `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent('https://' + normalizedUrl)}`;

        const handleQrClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (isInternalRoute) {
            e.preventDefault();
            const hashPart = targetHref.replace(/^[^#]*#\/?/, '').replace(/^\//, '');
            if (hashPart) {
              window.location.hash = hashPart;
            }
          } else if (targetHref.startsWith('http://') || targetHref.startsWith('https://')) {
            window.open(targetHref, '_blank', 'noopener,noreferrer');
          }
        };

        const isLight = theme === 'light';

        elements.push(
          <a 
            key={`qr-${keyIndex++}`}
            href={targetHref}
            target={isInternalRoute ? "_self" : "_blank"}
            rel="noopener noreferrer"
            onClick={handleQrClick}
            title={`Kliknij, aby otworzyć stronę docelową: ${targetHref}`}
            className={`my-6 p-5 rounded-2xl flex flex-col items-center justify-center text-center max-w-xs mx-auto shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] block cursor-pointer group qr-code-container ${
              isLight 
                ? 'bg-white border border-slate-200 hover:border-indigo-500 hover:bg-slate-100/50' 
                : 'bg-slate-950/95 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900'
            }`}
          >
            <div className="p-2 bg-white rounded-xl shadow-inner transition-transform duration-300 group-hover:scale-105">
              <img 
                src={qrUrl} 
                alt={caption || "Kod QR"} 
                className="w-32 h-32 object-contain qr-code-img"
                referrerPolicy="no-referrer"
              />
            </div>
            {caption && (
              <p className={`text-xs mt-2.5 font-bold tracking-wide transition-colors duration-300 ${
                isLight ? 'text-slate-800 group-hover:text-indigo-600' : 'text-amber-300 group-hover:text-amber-200'
              }`}>
                {caption}
              </p>
            )}
            <span className="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex items-center gap-1 font-sans font-semibold">
              🔗 Otwórz stronę docelową
            </span>
          </a>
        );

        if (!line.includes('[qr:')) {
          while (i < lines.length && !lines[i].includes('</div>')) {
            i++;
          }
        }
        if (closedAlignmentThisLine) currentAlignment = null;
        if (closedFontThisLine) currentFont = null;
        if (closedColorThisLine) currentColor = null;
        if (closedBgThisLine) currentBg = null;
        continue;
      }
    }

    // 2. Detect Image block (supports [image:...], Markdown ![alt](src), or HTML <img src="...">)
    if (line.includes('<img') || line.startsWith('![') || line.includes('image-block') || line.includes('[image:')) {
      flushParagraph();
      flushList();

      let imgSrc = '';
      let imgAlt = '';

      if (line.includes('[image:')) {
        const matchCap = line.match(/\[image:\s*([^|\]]+)\](?:\[caption:\s*([^\]]+)\])?/i) || line.match(/\[image:\s*([^|\]]+)(?:\|\s*([^\]]+))?\]/i);
        if (matchCap) {
          imgSrc = matchCap[1].trim();
          imgAlt = matchCap[2] ? matchCap[2].trim() : '';
        }
      } else if (line.startsWith('![')) {
        const match = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
        if (match) {
          imgAlt = match[1];
          imgSrc = match[2];
        }
      } else {
        const srcMatch = line.match(/src=["']([^"']+)["']/) || (lines[i+1] && lines[i+1].match(/src=["']([^"']+)["']/));
        const altMatch = line.match(/alt=["']([^"']+)["']/) || (lines[i+1] && lines[i+1].match(/alt=["']([^"']+)["']/));
        if (srcMatch) imgSrc = srcMatch[1];
        if (altMatch) imgAlt = altMatch[1];

        let captionText = '';
        for (let j = i; j < Math.min(i + 6, lines.length); j++) {
          if (lines[j].includes('text-slate-400') || lines[j].includes('caption') || lines[j].includes('<figcaption>')) {
            captionText = lines[j].replace(/<[^>]*>/g, '').trim();
            break;
          }
        }
        if (captionText) imgAlt = captionText;
      }

      if (imgSrc) {
        const resolvedSrc = normalizeImagePath(imgSrc);
        const isLight = theme === 'light';

        elements.push(
          <div 
            key={`img-${keyIndex++}`}
            onClick={() => setActiveLightboxImg({ src: resolvedSrc, alt: imgAlt })}
            title="Kliknij myszą, aby powiększyć obraz na pełny ekran"
            className={`my-6 border rounded-2xl overflow-hidden shadow-2xl p-3 max-w-xl mx-auto flex flex-col items-center group transition duration-300 cursor-pointer relative ${
              isLight 
                ? 'bg-white border-slate-200 hover:border-emerald-500 hover:shadow-emerald-500/20' 
                : 'bg-slate-950/90 border-slate-800 hover:border-emerald-500/60 hover:shadow-emerald-500/20'
            }`}
          >
            {/* Zoom Overlay Hint */}
            <div className="absolute top-5 right-5 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/80 text-emerald-400 p-2 rounded-full border border-emerald-500/40 backdrop-blur-md shadow-lg flex items-center gap-1.5 text-[10px] font-bold">
              <ZoomIn className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Powiększ na pełny ekran</span>
            </div>

            <img 
              src={resolvedSrc} 
              alt={imgAlt || "Grafika"} 
              className="max-h-96 w-auto rounded-xl object-contain group-hover:scale-[1.02] transition duration-300 shadow-md"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.dataset.triedFallback) {
                  target.dataset.triedFallback = 'true';
                  const parts = imgSrc.split(/[\\/]/);
                  const fileName = parts[parts.length - 1];
                  if (fileName && !target.src.endsWith('/' + fileName)) {
                    target.src = '/' + fileName;
                  }
                }
              }}
            />
            {imgAlt && (
              <p className={`text-xs text-center mt-2.5 font-serif italic px-2 ${isLight ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                {imgAlt}
              </p>
            )}
          </div>
        );

        if (line.includes('image-block') || line.includes('<div') || line.includes('<figure')) {
          while (i < lines.length && !lines[i].includes('</div>') && !lines[i].includes('</figure>')) {
            i++;
          }
        }
        if (closedAlignmentThisLine) currentAlignment = null;
        if (closedFontThisLine) currentFont = null;
        if (closedColorThisLine) currentColor = null;
        if (closedBgThisLine) currentBg = null;
        continue;
      }
    }

    // 3. Headings (Markdown & HTML)
    if (line.startsWith('###') || line.startsWith('<h3>')) {
      flushParagraph();
      flushList();
      const content = line.startsWith('###') ? line.slice(3).trim() : line.replace(/<\/?h3[^>]*>/g, '').trim();
      const h3Class = theme === 'light' ? 'light-mode-text font-bold' : 'text-amber-400 font-bold';
      elements.push(
        <h3 key={`h3-${keyIndex++}`} style={theme === 'light' ? { color: '#000000' } : undefined} className={`text-base font-serif mt-5 mb-2 tracking-tight ${h3Class} ${alignClass}`}>
          {content}
        </h3>
      );
      if (closedAlignmentThisLine) currentAlignment = null;
      if (closedFontThisLine) currentFont = null;
      if (closedColorThisLine) currentColor = null;
      if (closedBgThisLine) currentBg = null;
      continue;
    }
    if (line.startsWith('##') || line.startsWith('<h2>')) {
      flushParagraph();
      flushList();
      const content = line.startsWith('##') ? line.slice(2).trim() : line.replace(/<\/?h2[^>]*>/g, '').trim();
      const h2Class = theme === 'light'
        ? 'light-mode-text border-slate-200'
        : 'text-white border-slate-850';
      elements.push(
        <h2 key={`h2-${keyIndex++}`} style={theme === 'light' ? { color: '#000000' } : undefined} className={`text-lg font-serif font-bold mt-6 mb-3 tracking-tight border-b pb-1 ${h2Class} ${alignClass}`}>
          {content}
        </h2>
      );
      if (closedAlignmentThisLine) currentAlignment = null;
      if (closedFontThisLine) currentFont = null;
      if (closedColorThisLine) currentColor = null;
      if (closedBgThisLine) currentBg = null;
      continue;
    }

    // 4. Blockquotes
    if (line.startsWith('>') || line.startsWith('<blockquote>')) {
      flushParagraph();
      flushList();
      const content = line.startsWith('>') ? line.slice(1).trim() : line.replace(/<\/?blockquote[^>]*>/g, '').trim();
      const quoteClass = theme === 'light'
        ? 'border-l-4 border-indigo-500 pl-4 my-4 italic light-mode-text bg-slate-100 py-1.5 pr-2 rounded-r text-sm leading-relaxed'
        : 'border-l-4 border-indigo-500 pl-4 my-4 italic text-slate-300 text-sm leading-relaxed';
      elements.push(
        <blockquote key={`quote-${keyIndex++}`} style={theme === 'light' ? { color: '#000000' } : undefined} className={`${quoteClass} ${alignClass}`}>
          {content}
        </blockquote>
      );
      if (closedAlignmentThisLine) currentAlignment = null;
      if (closedFontThisLine) currentFont = null;
      if (closedColorThisLine) currentColor = null;
      if (closedBgThisLine) currentBg = null;
      continue;
    }

    // 5. Bullet Lists
    if (line.startsWith('-') || line.startsWith('* ') || line.startsWith('<li>')) {
      flushParagraph();
      const content = line.replace(/^[-*]\s*/, '').replace(/<\/?li[^>]*>/g, '').trim();
      inList = true;
      listItems.push(content);
      if (closedAlignmentThisLine) currentAlignment = null;
      if (closedFontThisLine) currentFont = null;
      if (closedColorThisLine) currentColor = null;
      if (closedBgThisLine) currentBg = null;
      continue;
    } else {
      if (inList) {
        flushList();
      }
    }

    // 6. Generic HTML Element blocks
    if (line.startsWith('<iframe') || line.startsWith('<table') || line.startsWith('<svg') || line.startsWith('<style') || line.startsWith('<div')) {
      flushParagraph();
      flushList();
      elements.push(
        <div 
          key={`html-block-${keyIndex++}`} 
          className="my-4 overflow-x-auto" 
          dangerouslySetInnerHTML={{ __html: line }} 
        />
      );
      if (closedAlignmentThisLine) currentAlignment = null;
      if (closedFontThisLine) currentFont = null;
      if (closedColorThisLine) currentColor = null;
      if (closedBgThisLine) currentBg = null;
      continue;
    }

    // 7. Normal line / paragraph
    if (line === '') {
      if (paragraphBuffer.length > 0) {
        const combined = paragraphBuffer.join(' ');
        const pClass = theme === 'light' ? 'light-mode-text' : 'text-slate-200';
        elements.push(
          <p
            key={`p-${keyIndex++}`}
            style={theme === 'light' ? { color: '#000000' } : undefined}
            className={`text-sm sm:text-base leading-relaxed mb-5 tracking-normal ${pClass} ${alignClass}`}
            dangerouslySetInnerHTML={{ __html: parseInlineStyles(combined, theme, { font: currentFont, color: currentColor, bg: currentBg }) }}
          />
        );
        paragraphBuffer = [];
      } else {
        elements.push(<div key={`space-${keyIndex++}`} className="h-2" />);
      }
    } else {
      paragraphBuffer.push(line);
    }

    if (closedAlignmentThisLine) currentAlignment = null;
    if (closedFontThisLine) currentFont = null;
    if (closedColorThisLine) currentColor = null;
    if (closedBgThisLine) currentBg = null;
  }

  flushParagraph();
  flushList();

  return (
    <div 
      ref={containerRef}
      onClick={handleContainerClick}
      className={`space-y-0 ${theme === 'light' ? 'light-mode-text' : ''}`} 
      style={theme === 'light' ? { color: '#000000' } : undefined}
    >
      {elements}

      {/* FULL-SCREEN IMAGE LIGHTBOX MODAL OVERLAY */}
      {activeLightboxImg && (
        <div 
          className="fixed inset-0 z-[99999] bg-slate-950/95 backdrop-blur-lg flex flex-col items-center justify-center p-4 select-none animate-fadeIn cursor-zoom-out"
          onClick={() => setActiveLightboxImg(null)}
          title="Kliknij tło lub naciśnij Esc, aby zamknąć podgląd"
        >
          {/* Top toolbar */}
          <div className="absolute top-4 right-4 flex items-center gap-3 z-50">
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">[ESC] Zamknij podgląd</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveLightboxImg(null);
              }}
              className="p-2.5 rounded-full bg-slate-900/90 hover:bg-rose-600 text-white border border-slate-700 hover:border-rose-500 transition-all shadow-2xl cursor-pointer"
              title="Zamknij podgląd na pełnym ekranie (Esc)"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Fullscreen Image Container */}
          <div 
            className="relative max-w-6xl max-h-[88vh] flex flex-col items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={activeLightboxImg.src} 
              alt={activeLightboxImg.alt} 
              className="max-h-[82vh] max-w-full w-auto object-contain rounded-2xl shadow-2xl border border-slate-700/80 transition-transform duration-300 hover:scale-[1.01]"
            />
            {activeLightboxImg.alt && (
              <p className="mt-3.5 text-xs sm:text-sm text-slate-200 font-serif italic text-center max-w-2xl bg-slate-900/90 px-4 py-2 rounded-xl border border-slate-800 shadow-xl">
                {activeLightboxImg.alt}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Parses simple inline formatting tags
 */
const parseInlineStyles = (
  html: string, 
  theme: string = 'dark',
  activeState?: { font?: string | null; color?: string | null; bg?: string | null }
): string => {
  let text = html;
  
  // Custom Image Tags inline: [image:src][caption:cap] or [image:src]
  text = text.replace(/\[image:\s*([^|\]]+)\](?:\[caption:\s*([^\]]+)\])?/gi, (match, src, cap) => {
    const norm = normalizeImagePath(src);
    const captionHtml = cap ? `<figcaption style="font-size: 11px; text-align: center; font-style: italic; margin-top: 4px; opacity: 0.8;">${cap}</figcaption>` : '';
    return `<figure style="margin: 16px auto; text-align: center; cursor: pointer;" title="Kliknij myszą, aby powiększyć na pełny ekran"><img src="${norm}" alt="${cap || 'Grafika'}" style="max-height: 350px; max-width: 100%; border-radius: 12px; display: inline-block; box-shadow: 0 10px 25px rgba(0,0,0,0.4);" />${captionHtml}</figure>`;
  });

  // Custom Color Tags: [color:#hex]text[/color]
  // Custom Background Tags: [bg:#hex]text[/bg]
  // Custom Font Tags: [font:FontName]text[/font]
  for (let i = 0; i < 3; i++) {
    text = text.replace(/\[font:([^\]]+)\](.*?)\[\/font\]/g, (match, fontName, content) => {
      return `<span style="font-family: '${fontName}', sans-serif;">${content}</span>`;
    });
    
    text = text.replace(/\[color:([^\]]+)\](.*?)\[\/color\]/g, (match, colorValue, content) => {
      return `<span style="color: ${colorValue};">${content}</span>`;
    });
    
    text = text.replace(/\[bg:([^\]]+)\](.*?)\[\/bg\]/g, (match, bgValue, content) => {
      return `<span style="background-color: ${bgValue}; padding: 1px 4px; border-radius: 3px; display: inline;">${content}</span>`;
    });
  }

  // Unclosed active tags
  text = text.replace(/\[font:([^\]]+)\](.*)$/g, (match, fontName, content) => {
    return `<span style="font-family: '${fontName}', sans-serif;">${content}</span>`;
  });
  text = text.replace(/\[color:([^\]]+)\](.*)$/g, (match, colorValue, content) => {
    return `<span style="color: ${colorValue};">${content}</span>`;
  });
  text = text.replace(/\[bg:([^\]]+)\](.*)$/g, (match, bgValue, content) => {
    return `<span style="background-color: ${bgValue}; padding: 1px 4px; border-radius: 3px; display: inline;">${content}</span>`;
  });

  text = text.replace(/\[\/font\]|\[\/color\]|\[\/bg\]/g, '');
  
  // Bold **text**
  const boldClass = theme === 'light' ? 'light-mode-text font-bold' : 'text-white font-semibold';
  text = text.replace(/\*\*([^*]+)\*\*/g, `<strong class="${boldClass}">$1</strong>`);
  
  // Italic *text*
  const italicClass = theme === 'light' ? 'light-mode-text italic' : 'text-slate-200 italic';
  text = text.replace(/\*([^*]+)\*/g, `<em class="${italicClass}">$1</em>`);

  text = text.replace(/<b>(.*?)<\/b>/g, `<strong class="${boldClass}">$1</strong>`);
  text = text.replace(/<i>(.*?)<\/i>/g, `<em class="${italicClass}">$1</em>`);

  const underlineClass = theme === 'light' ? 'underline text-indigo-700' : 'underline text-indigo-200';
  text = text.replace(/<u>(.*?)<\/u>/g, `<span class="${underlineClass}">$1</span>`);

  if (activeState && (activeState.font || activeState.color || activeState.bg)) {
    let styles = '';
    if (activeState.font && !html.includes('[font:')) styles += `font-family: '${activeState.font}', sans-serif; `;
    if (activeState.color && !html.includes('[color:')) styles += `color: ${activeState.color}; `;
    if (activeState.bg && !html.includes('[bg:')) styles += `background-color: ${activeState.bg}; padding: 1px 4px; border-radius: 3px; `;
    
    if (styles) {
      text = `<span style="${styles}">${text}</span>`;
    }
  }

  return text;
};

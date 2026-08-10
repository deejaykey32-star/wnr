import React from 'react';

/**
 * A robust, safe lightweight helper to format plain text / Markdown / HTML tags
 * into structured React elements with Tailwind CSS styling.
 * This avoids security risks of raw dangerouslySetInnerHTML while displaying rich layouts.
 */
export const RichTextRenderer: React.FC<{ text: string; theme?: 'dark' | 'light' }> = ({ text, theme = 'dark' }) => {
  if (!text) return null;

  // Split text by lines to parse blocks
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  let keyIndex = 0;
  let inList = false;
  let listItems: string[] = [];
  let currentAlignment: 'left' | 'center' | 'right' | 'justify' | null = null;
  let currentFont: string | null = null;
  let currentColor: string | null = null;
  let currentBg: string | null = null;
  // Buffer for accumulating lines into a single justified paragraph
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const combined = paragraphBuffer.join(' ');
    paragraphBuffer = [];
    const pClass = theme === 'light' ? 'text-slate-800' : 'text-slate-200';
    const ac = currentAlignment === 'center' ? 'text-center [text-align-last:center]' :
               currentAlignment === 'right' ? 'text-right [text-align-last:right]' :
               currentAlignment === 'justify' ? 'text-justify [text-align-last:left]' :
               currentAlignment === 'left' ? 'text-left [text-align-last:left]' : 'text-justify [text-align-last:left]';
    elements.push(
      <p
        key={`p-${keyIndex++}`}
        className={`text-sm sm:text-base leading-relaxed mb-5 tracking-normal ${pClass} ${ac}`}
        dangerouslySetInnerHTML={{ __html: parseInlineStyles(combined, theme, { font: currentFont, color: currentColor, bg: currentBg }) }}
      />
    );
  };

  const flushList = () => {
    if (listItems.length > 0) {
      const listColorClass = theme === 'light' ? 'text-slate-800' : 'text-slate-300';
      elements.push(
        <ul key={`list-${keyIndex++}`} className={`list-disc pl-5 my-3 space-y-1 ${listColorClass} text-sm`}>
          {listItems.map((item, idx) => (
            <li key={`li-${idx}`} dangerouslySetInnerHTML={{ __html: parseInlineStyles(item, theme, { font: currentFont, color: currentColor, bg: currentBg }) }} />
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

    // Also support standard HTML alignments in case someone copies/pastes HTML
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

    // Persistent Font, Color, and Background Tag State Tracking
    const fontMatch = line.match(/\[font:([^\]]+)\]/);
    if (fontMatch) currentFont = fontMatch[1];
    
    const colorMatch = line.match(/\[color:([^\]]+)\]/);
    if (colorMatch) currentColor = colorMatch[1];

    const bgMatch = line.match(/\[bg:([^\]]+)\]/);
    if (bgMatch) currentBg = bgMatch[1];

    let closedFontThisLine = false;
    if (line.includes('[/font]')) {
      closedFontThisLine = true;
    }

    let closedColorThisLine = false;
    if (line.includes('[/color]')) {
      closedColorThisLine = true;
    }

    let closedBgThisLine = false;
    if (line.includes('[/bg]')) {
      closedBgThisLine = true;
    }

    const alignClass = currentAlignment === 'center' ? 'text-center [text-align-last:center]' :
                       currentAlignment === 'right' ? 'text-right [text-align-last:right]' :
                       currentAlignment === 'justify' ? 'text-justify [text-align-last:left]' :
                       currentAlignment === 'left' ? 'text-left [text-align-last:left]' : 'text-justify [text-align-last:left]';

    // 1. Detect QR code block (custom HTML or clean markup)
    // Looking for qr-block patterns or specialized tags
    if (line.includes('qr-block') || line.includes('api.qrserver.com') || line.includes('[qr:')) {
      flushParagraph();
      flushList();
      
      // Attempt to extract URL and Caption
      let url = '';
      let caption = '';

      if (line.includes('[qr:')) {
        // Syntax: [qr: URL | Caption]
        const match = line.match(/\[qr:\s*([^|\]]+)(?:\|\s*([^\]]+))?\]/);
        if (match) {
          url = match[1].trim();
          caption = match[2] ? match[2].trim() : '';
        }
      } else {
        // HTML extract or generic fallback
        const srcMatch = lines[i].match(/src=["']([^"']+)["']/) || (lines[i+1] && lines[i+1].match(/src=["']([^"']+)["']/));
        const altMatch = lines[i].match(/alt=["']([^"']+)["']/) || (lines[i+1] && lines[i+1].match(/alt=["']([^"']+)["']/));
        
        // Find text caption inside next few lines
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
        const qrUrl = url.startsWith('http') 
          ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`
          : `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent('https://' + url)}`;

        const isExternalLink = url.startsWith('http') || url.startsWith('www.') || url.includes('.');
        const clickUrl = (url.startsWith('http') || url.startsWith('https')) ? url : `https://${url}`;
        const ContainerTag = isExternalLink ? 'a' : 'div';
        const extraProps = isExternalLink ? {
          href: clickUrl,
          target: "_blank",
          rel: "noopener noreferrer",
          title: `Kliknij, aby otworzyć: ${clickUrl}`
        } : {};

        const isLight = theme === 'light';

        elements.push(
          <ContainerTag 
            key={`qr-${keyIndex++}`}
            className={`my-6 p-5 rounded-2xl flex flex-col items-center justify-center text-center max-w-xs mx-auto shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] block cursor-pointer group ${
              isLight 
                ? 'bg-white border border-slate-200 hover:border-indigo-500 hover:bg-slate-100/50' 
                : 'bg-slate-950/95 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900'
            }`}
            {...extraProps}
          >
            <div className="p-2 bg-white rounded-xl shadow-inner transition-transform duration-300 group-hover:scale-105">
              <img 
                src={qrUrl} 
                alt={caption || "Kod QR"} 
                className="w-32 h-32 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            {caption && (
              <p className={`text-xs mt-2 font-mono font-semibold tracking-wide uppercase transition-colors duration-300 ${
                isLight ? 'text-slate-600 group-hover:text-indigo-600' : 'text-slate-400 group-hover:text-indigo-300'
              }`}>
                {caption}
              </p>
            )}
            {isExternalLink && (
              <span 
                className={`text-[10px] mt-1 font-mono break-all max-w-[200px] ${
                  isLight ? 'text-indigo-600 group-hover:text-indigo-700 group-hover:underline' : 'text-indigo-400 group-hover:text-indigo-300 group-hover:underline'
                }`}
              >
                {clickUrl}
              </span>
            )}
          </ContainerTag>
        );

        // Skip to end of HTML block if we parsed multi-line HTML
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

    // 2. Detect Image block (custom HTML or Markdown syntax)
    if (line.includes('<img') || line.startsWith('![') || line.includes('image-block')) {
      flushParagraph();
      flushList();

      let imgSrc = '';
      let imgAlt = '';

      if (line.startsWith('![')) {
        // Markdown: ![alt](src)
        const match = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
        if (match) {
          imgAlt = match[1];
          imgSrc = match[2];
        }
      } else {
        // HTML extract
        const srcMatch = line.match(/src=["']([^"']+)["']/) || (lines[i+1] && lines[i+1].match(/src=["']([^"']+)["']/));
        const altMatch = line.match(/alt=["']([^"']+)["']/) || (lines[i+1] && lines[i+1].match(/alt=["']([^"']+)["']/));
        if (srcMatch) imgSrc = srcMatch[1];
        if (altMatch) imgAlt = altMatch[1];

        // Find caption text
        let captionText = '';
        for (let j = i; j < Math.min(i + 6, lines.length); j++) {
          if (lines[j].includes('text-slate-400') || lines[j].includes('caption')) {
            captionText = lines[j].replace(/<[^>]*>/g, '').trim();
            break;
          }
        }
        if (captionText) imgAlt = captionText;
      }

      if (imgSrc) {
        elements.push(
          <div 
            key={`img-${keyIndex++}`}
            className="my-6 bg-slate-950/40 border border-slate-850 rounded-2xl overflow-hidden shadow-2xl p-2.5 max-w-md mx-auto flex flex-col items-center"
          >
            <img 
              src={imgSrc} 
              alt={imgAlt || "Grafika"} 
              className="max-h-80 w-auto rounded-xl object-cover hover:scale-[1.02] transition duration-300"
              referrerPolicy="no-referrer"
            />
            {imgAlt && (
              <p className="text-xs text-slate-400 text-center mt-2 font-serif italic">
                {imgAlt}
              </p>
            )}
          </div>
        );

        // Skip end of HTML block if relevant
        if (line.includes('image-block') || line.includes('<div')) {
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

    // 3. Headings (Markdown & HTML)
    if (line.startsWith('###') || line.startsWith('<h3>')) {
      flushParagraph();
      flushList();
      const content = line.startsWith('###') ? line.slice(3).trim() : line.replace(/<\/?h3[^>]*>/g, '').trim();
      const h3Class = theme === 'light' ? 'text-indigo-600 font-bold' : 'text-amber-400 font-bold';
      elements.push(
        <h3 key={`h3-${keyIndex++}`} className={`text-base font-serif mt-5 mb-2 tracking-tight ${h3Class} ${alignClass}`}>
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
        ? 'text-slate-900 border-slate-200'
        : 'text-white border-slate-850';
      elements.push(
        <h2 key={`h2-${keyIndex++}`} className={`text-lg font-serif font-bold mt-6 mb-3 tracking-tight border-b pb-1 ${h2Class} ${alignClass}`}>
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
        ? 'border-l-4 border-indigo-500 pl-4 my-4 italic text-slate-700 bg-slate-100 py-1.5 pr-2 rounded-r text-sm leading-relaxed'
        : 'border-l-4 border-indigo-500 pl-4 my-4 italic text-slate-300 text-sm leading-relaxed';
      elements.push(
        <blockquote key={`quote-${keyIndex++}`} className={`${quoteClass} ${alignClass}`}>
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
      // If was in list and line is empty/different, flush list
      if (inList) {
        flushList();
      }
    }


    // 6. Normal line / paragraph
    // Lines are accumulated into paragraphs — empty line = paragraph boundary
    if (line === '') {
      // Flush any accumulated paragraph text
      if (paragraphBuffer.length > 0) {
        const combined = paragraphBuffer.join(' ');
        const pClass = theme === 'light' ? 'text-slate-800' : 'text-slate-200';
        elements.push(
          <p
            key={`p-${keyIndex++}`}
            className={`text-sm sm:text-base leading-relaxed mb-5 tracking-normal ${pClass} ${alignClass}`}
            dangerouslySetInnerHTML={{ __html: parseInlineStyles(combined, theme, { font: currentFont, color: currentColor, bg: currentBg }) }}
          />
        );
        paragraphBuffer = [];
      } else {
        // Extra spacing between paragraphs
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

  // Flush remaining buffer and lists at the end
  flushParagraph();
  flushList();

  return <div className="space-y-0">{elements}</div>;
};

/**
 * Parses simple inline formatting tags:
 * **bold** -> <strong>bold</strong>
 * *italic* -> <em>italic</em>
 * <u>underline</u> -> <span class="underline">underline</span>
 */
const parseInlineStyles = (
  html: string, 
  theme: string = 'dark',
  activeState?: { font?: string | null; color?: string | null; bg?: string | null }
): string => {
  let text = html;
  
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

  // Unclosed or single-line active tag handling
  text = text.replace(/\[font:([^\]]+)\](.*)$/g, (match, fontName, content) => {
    return `<span style="font-family: '${fontName}', sans-serif;">${content}</span>`;
  });
  text = text.replace(/\[color:([^\]]+)\](.*)$/g, (match, colorValue, content) => {
    return `<span style="color: ${colorValue};">${content}</span>`;
  });
  text = text.replace(/\[bg:([^\]]+)\](.*)$/g, (match, bgValue, content) => {
    return `<span style="background-color: ${bgValue}; padding: 1px 4px; border-radius: 3px; display: inline;">${content}</span>`;
  });

  // Strip standalone closing tags if leftover
  text = text.replace(/\[\/font\]|\[\/color\]|\[\/bg\]/g, '');
  
  // Bold **text**
  const boldClass = theme === 'light' ? 'text-slate-950 font-bold' : 'text-white font-semibold';
  text = text.replace(/\*\*([^*]+)\*\*/g, `<strong class="${boldClass}">$1</strong>`);
  
  // Italic *text*
  const italicClass = theme === 'light' ? 'text-slate-700 italic' : 'text-slate-200 italic';
  text = text.replace(/\*([^*]+)\*/g, `<em class="${italicClass}">$1</em>`);

  // Handle standard inline HTML bold / italic for copy-pasted or WYSIWYG generated markup
  text = text.replace(/<b>(.*?)<\/b>/g, `<strong class="${boldClass}">$1</strong>`);
  text = text.replace(/<i>(.*?)<\/i>/g, `<em class="${italicClass}">$1</em>`);

  const underlineClass = theme === 'light' ? 'underline text-indigo-700' : 'underline text-indigo-200';
  text = text.replace(/<u>(.*?)<\/u>/g, `<span class="${underlineClass}">$1</span>`);

  // Wrap in activeState styles if present and not already styled
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
};;

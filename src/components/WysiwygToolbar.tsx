import React, { useState, useEffect, useRef } from 'react';
import { 
  Bold, Italic, Underline, Heading3, Heading2, 
  Quote, List, Image, QrCode, Eye, Check, X,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Sun, Moon, Type, Palette, Highlighter,
  Code, FileCode, Terminal, Sparkles, FolderOpen
} from 'lucide-react';
import { RichTextRenderer, normalizeImagePath } from '../utils/richTextHelper';

interface WysiwygToolbarProps {
  text: string;
  onChange: (newText: string) => void;
  placeholder?: string;
  textareaId: string;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}

export type ViewMode = 'traditional' | 'html' | 'preview';

/**
 * Bi-directional converter: WYSIWYG tags -> HTML
 */
export const convertWysiwygToHtml = (rawText: string): string => {
  if (!rawText) return '';
  let html = rawText;

  // Images: [image:src][caption:cap] or [image:src|cap] or [image:src]
  html = html.replace(/\[image:\s*([^|\]]+)\](?:\[caption:\s*([^\]]+)\])?/gi, (match, src, cap) => {
    const norm = normalizeImagePath(src);
    const captionHtml = cap ? `\n  <figcaption>${cap.trim()}</figcaption>` : '';
    return `<figure>\n  <img src="${norm}" alt="${(cap || 'Grafika').trim()}" />${captionHtml}\n</figure>`;
  });

  // QR Codes: [qr:url][caption:cap] or [qr:url|cap]
  html = html.replace(/\[qr:\s*([^|\]]+)(?:\[caption:\s*([^\]]+)\]|\|\s*([^\]]+))?\]/gi, (match, url, cap1, cap2) => {
    const caption = (cap1 || cap2 || '').trim();
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url.trim())}`;
    return `<div class="qr-block" data-url="${url.trim()}">\n  <a href="${url.trim()}" target="_blank" rel="noopener noreferrer">\n    <img src="${qrImg}" alt="${caption || 'Kod QR'}" />\n  </a>\n  ${caption ? `<p>${caption}</p>` : ''}\n</div>`;
  });

  // Fonts: [font:FontName]text[/font]
  html = html.replace(/\[font:([^\]]+)\](.*?)\[\/font\]/gi, `<span style="font-family: '$1', sans-serif;">$2</span>`);

  // Text Colors: [color:#hex]text[/color]
  html = html.replace(/\[color:([^\]]+)\](.*?)\[\/color\]/gi, `<span style="color: $1;">$2</span>`);

  // Background Highlights: [bg:#hex]text[/bg]
  html = html.replace(/\[bg:([^\]]+)\](.*?)\[\/bg\]/gi, `<span style="background-color: $1; padding: 2px 4px; border-radius: 4px;">$2</span>`);

  // Alignments: [align:center]text[/align]
  html = html.replace(/\[align:(left|center|right|justify)\](.*?)\[\/align\]/gi, `<div style="text-align: $1;">$2</div>`);

  // Bold: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, `<strong>$1</strong>`);

  // Italic: *text*
  html = html.replace(/\*([^*]+)\*/g, `<em>$1</em>`);

  // Headings
  html = html.replace(/^### (.*$)/gim, `<h3>$1</h3>`);
  html = html.replace(/^## (.*$)/gim, `<h2>$1</h2>`);

  // Blockquotes
  html = html.replace(/^> (.*$)/gim, `blockquote>$1</blockquote>`);

  return html;
};

/**
 * Bi-directional converter: HTML -> WYSIWYG tags
 */
export const convertHtmlToWysiwyg = (rawHtml: string): string => {
  if (!rawHtml) return '';
  let text = rawHtml;

  // Convert figures with img back to [image:]
  text = text.replace(/<figure[^>]*>\s*<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>\s*(?:<figcaption>(.*?)<\/figcaption>)?\s*<\/figure>/gi, 
    (match, src, alt, cap) => {
      const caption = cap || alt || '';
      return `[image:${src}]${caption ? `[caption:${caption}]` : ''}`;
    }
  );

  text = text.replace(/<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, (match, src, alt) => {
    return `[image:${src}]${alt ? `[caption:${alt}]` : ''}`;
  });

  // Convert <strong> / <b>
  text = text.replace(/<\/?(strong|b)>/gi, '**');

  // Convert <em> / <i>
  text = text.replace(/<\/?(em|i)>/gi, '*');

  // Convert headings
  text = text.replace(/<h2>(.*?)<\/h2>/gi, '## $1');
  text = text.replace(/<h3>(.*?)<\/h3>/gi, '### $1');

  // Convert blockquotes
  text = text.replace(/<blockquote>(.*?)<\/blockquote>/gi, '> $1');

  return text;
};

export const WysiwygToolbar: React.FC<WysiwygToolbarProps> = ({ 
  text, 
  onChange, 
  placeholder = "Wpisz treść w edytorze WYSIWYG lub kodzie HTML...", 
  textareaId,
  theme,
  onThemeToggle
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('traditional');

  // Popover States
  const [showImagePopover, setShowImagePopover] = useState<boolean>(false);
  const [showQrPopover, setShowQrPopover] = useState<boolean>(false);
  const [showHtmlPopover, setShowHtmlPopover] = useState<boolean>(false);
  const [showFontDropdown, setShowFontDropdown] = useState<boolean>(false);
  const [showTextColorDropdown, setShowTextColorDropdown] = useState<boolean>(false);
  const [showBgColorDropdown, setShowBgColorDropdown] = useState<boolean>(false);

  // Popover State: Image
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageCaption, setImageCaption] = useState<string>('');
  const [imageFormat, setImageFormat] = useState<'tag' | 'html'>('tag');

  // Popover State: QR Code
  const [qrUrl, setQrUrl] = useState<string>('');
  const [qrCaption, setQrCaption] = useState<string>('');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current = document.getElementById(textareaId) as HTMLTextAreaElement;
  }, [textareaId, viewMode]);

  const handleFormat = (before: string, after: string = '') => {
    const textarea = textareaRef.current || (document.getElementById(textareaId) as HTMLTextAreaElement);
    if (!textarea) {
      onChange(text + before + after);
      return;
    }

    textarea.focus();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = text.substring(start, end);

    const replacement = before + (selection || '') + after;
    const newText = text.substring(0, start) + replacement + text.substring(end);
    onChange(newText);

    setTimeout(() => {
      textarea.selectionStart = start + before.length;
      textarea.selectionEnd = start + before.length + (selection ? selection.length : 0);
      textarea.focus();
    }, 50);
  };

  const handleInsertImage = () => {
    if (!imageUrl.trim()) return;
    const rawPath = imageUrl.trim();
    const normalized = normalizeImagePath(rawPath);
    const captionText = imageCaption.trim();

    let formatted = '';
    if (viewMode === 'html' || imageFormat === 'html') {
      formatted = `\n<figure class="my-4 text-center">\n  <img src="${normalized}" alt="${captionText || 'Grafika'}" class="max-h-96 rounded-xl mx-auto shadow-lg" />\n  ${captionText ? `<figcaption class="text-xs italic text-slate-400 mt-2">${captionText}</figcaption>` : ''}\n</figure>\n`;
    } else {
      formatted = `\n[image:${rawPath}]${captionText ? `[caption:${captionText}]` : ''}\n`;
    }

    handleFormat(formatted);
    setImageUrl('');
    setImageCaption('');
    setShowImagePopover(false);
  };

  const handleInsertQr = () => {
    if (!qrUrl.trim()) return;
    let finalQrUrl = qrUrl.trim();
    if (finalQrUrl.includes('widokinaraj') && !finalQrUrl.includes('#')) {
      finalQrUrl = finalQrUrl
        .replace('/wnr365-day', '/#/wnr365-day')
        .replace('/rhz365-day', '/#/rhz365-day')
        .replace('/day', '/#/day');
    }
    
    let formatted = '';
    if (viewMode === 'html') {
      const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(finalQrUrl)}`;
      formatted = `\n<div class="qr-block text-center my-6">\n  <a href="${finalQrUrl}" target="_blank" rel="noopener noreferrer">\n    <img src="${qrImg}" alt="${qrCaption.trim() || 'Kod QR'}" class="w-32 h-32 mx-auto" />\n  </a>\n  ${qrCaption.trim() ? `<p class="text-xs font-mono font-bold mt-2">${qrCaption.trim()}</p>` : ''}\n</div>\n`;
    } else {
      formatted = `\n[qr:${finalQrUrl}]${qrCaption.trim() ? `[caption:${qrCaption.trim()}]` : ''}\n`;
    }

    handleFormat(formatted);
    setQrUrl('');
    setQrCaption('');
    setShowQrPopover(false);
  };

  const closeAllPopovers = () => {
    setShowImagePopover(false);
    setShowQrPopover(false);
    setShowHtmlPopover(false);
    setShowFontDropdown(false);
    setShowTextColorDropdown(false);
    setShowBgColorDropdown(false);
  };

  const handleModeSwitch = (newMode: ViewMode) => {
    if (newMode === viewMode) return;

    if (viewMode === 'traditional' && newMode === 'html') {
      // Auto convert WYSIWYG tags to clean HTML
      const converted = convertWysiwygToHtml(text);
      onChange(converted);
    } else if (viewMode === 'html' && newMode === 'traditional') {
      // Optionally convert clean HTML back to Wysiwyg tags
      const converted = convertHtmlToWysiwyg(text);
      onChange(converted);
    }

    setViewMode(newMode);
    closeAllPopovers();
  };

  const liveQrCodeSrc = qrUrl.trim() 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl.trim())}` 
    : '';

  const isLight = theme === 'light';

  const containerClass = isLight 
    ? 'w-full flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white shadow-md' 
    : 'w-full flex flex-col border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60 shadow-xl';

  const headerClass = isLight
    ? 'flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-2 border-b border-slate-200 select-none'
    : 'flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-2 border-b border-slate-800 select-none';

  const btnClass = isLight
    ? 'p-1.5 hover:bg-slate-200 text-slate-700 rounded transition duration-200'
    : 'p-1.5 hover:bg-slate-800 text-slate-300 rounded transition duration-200';

  const separatorClass = isLight
    ? 'w-px h-5 bg-slate-200 mx-1 shrink-0'
    : 'w-px h-5 bg-slate-800 mx-1 shrink-0';

  const popoverBgClass = isLight
    ? 'absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-xl p-4 shadow-2xl z-50 text-left space-y-3 text-slate-800'
    : 'absolute top-full left-0 mt-2 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-2xl z-50 text-left space-y-3 text-white';

  const inputClass = isLight
    ? 'w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-sans'
    : 'w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-sans';

  const textareaClass = isLight
    ? 'w-full h-[280px] bg-slate-50 p-4 text-sm text-slate-850 font-sans leading-relaxed focus:outline-none focus:ring-0 resize-none border-0'
    : 'w-full h-[280px] bg-slate-950 p-4 text-sm text-slate-200 font-sans leading-relaxed focus:outline-none focus:ring-0 resize-none border-0';

  const htmlTextareaClass = isLight
    ? 'w-full h-[280px] bg-slate-900 p-4 text-xs text-emerald-400 font-mono leading-relaxed focus:outline-none focus:ring-0 resize-none border-0'
    : 'w-full h-[280px] bg-slate-950 p-4 text-xs text-emerald-300 font-mono leading-relaxed focus:outline-none focus:ring-0 resize-none border-0';

  const previewClass = isLight
    ? 'p-4 sm:p-5 w-full h-[280px] overflow-y-auto select-text bg-slate-50 light-mode-text'
    : 'p-4 sm:p-5 w-full h-[280px] overflow-y-auto select-text bg-slate-950 text-slate-100';

  const footerClass = isLight
    ? 'flex justify-between items-center bg-slate-100 px-4 py-1.5 border-t border-slate-200 text-[10px] font-mono text-slate-500'
    : 'flex justify-between items-center bg-slate-950 px-4 py-1.5 border-t border-slate-900 text-[10px] font-mono text-slate-500';

  const popularFonts = [
    { name: 'Outfit', css: 'Outfit' },
    { name: 'Inter', css: 'Inter' },
    { name: 'Poppins', css: 'Poppins' },
    { name: 'Montserrat', css: 'Montserrat' },
    { name: 'Playfair Display', css: 'Playfair Display' },
    { name: 'EB Garamond', css: 'EB Garamond' },
    { name: 'Lora', css: 'Lora' },
    { name: 'Merriweather', css: 'Merriweather' },
    { name: 'Cinzel', css: 'Cinzel' },
    { name: 'Dancing Script', css: 'Dancing Script' },
    { name: 'Caveat', css: 'Caveat' },
    { name: 'JetBrains Mono', css: 'JetBrains Mono' }
  ];

  const textColors = [
    { value: '#000000', name: 'Czarny' },
    { value: '#FFFFFF', name: 'Biały' },
    { value: '#334155', name: 'Ciemnoszary' },
    { value: '#94A3B8', name: 'Szary' },
    { value: '#EF4444', name: 'Czerwony' },
    { value: '#F97316', name: 'Pomarańczowy' },
    { value: '#FBBF24', name: 'Złoty' },
    { value: '#10B981', name: 'Zielony' },
    { value: '#0EA5E9', name: 'Błękitny' },
    { value: '#6366F1', name: 'Indygo' },
    { value: '#A855F7', name: 'Fioletowy' },
    { value: '#EC4899', name: 'Różowy' }
  ];

  const bgColors = [
    { value: 'transparent', name: 'Brak tła' },
    { value: '#FEF08A', name: 'Żółty jaskrawy' },
    { value: '#713F12', name: 'Złoty ciemny' },
    { value: '#A7F3D0', name: 'Jasnozielony' },
    { value: '#064E3B', name: 'Ciemnozielony' },
    { value: '#BAE6FD', name: 'Błękitny jasny' },
    { value: '#0C4A6E', name: 'Błękitny ciemny' },
    { value: '#C7D2FE', name: 'Indygo jasny' },
    { value: '#31108F', name: 'Indygo ciemny' },
    { value: '#E9D5FF', name: 'Fioletowy jasny' },
    { value: '#581C87', name: 'Fioletowy ciemny' },
    { value: '#FECACA', name: 'Czerwony jasny' }
  ];

  return (
    <div className={containerClass}>
      {/* WYSIWYG & HTML Toolbar Header */}
      <div className={headerClass}>
        <div className="flex flex-wrap items-center gap-1.5">
          
          {/* Formatting Buttons (available in Traditional & HTML modes) */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => handleFormat(viewMode === 'html' ? '<strong>' : '**', viewMode === 'html' ? '</strong>' : '**')}
              className={btnClass}
              title="Pogrubienie (Bold)"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleFormat(viewMode === 'html' ? '<em>' : '*', viewMode === 'html' ? '</em>' : '*')}
              className={btnClass}
              title="Kursywa (Italic)"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleFormat('<u>', '</u>')}
              className={btnClass}
              title="Podkreślenie (Underline)"
            >
              <Underline className="w-4 h-4" />
            </button>
          </div>

          <span className={separatorClass}></span>

          {/* Font Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                const prev = showFontDropdown;
                closeAllPopovers();
                setShowFontDropdown(!prev);
              }}
              className={`${btnClass} flex items-center gap-1 text-xs`}
              title="Wybierz krój czcionki"
            >
              <Type className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline font-medium">Czcionka</span>
            </button>

            {showFontDropdown && (
              <div className={`${popoverBgClass} w-52 overflow-hidden !p-1 max-h-64 overflow-y-auto`}>
                <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 mb-1">
                  Krój pisma / Czcionka
                </div>
                {popularFonts.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => {
                      if (viewMode === 'html') {
                        handleFormat(`<span style="font-family: '${f.css}', sans-serif;">`, `</span>`);
                      } else {
                        handleFormat(`[font:${f.name}]`, `[/font]`);
                      }
                      setShowFontDropdown(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition rounded flex items-center justify-between"
                    style={{ fontFamily: `'${f.css}', sans-serif` }}
                  >
                    <span>{f.name}</span>
                    <span className="text-[9px] text-slate-400 italic">AaBb</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Color Picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                const prev = showTextColorDropdown;
                closeAllPopovers();
                setShowTextColorDropdown(!prev);
              }}
              className={`${btnClass} flex items-center gap-1 text-xs`}
              title="Zmień kolor tekstu"
            >
              <Palette className="w-4 h-4 text-rose-400" />
              <span className="hidden sm:inline font-medium">Kolor</span>
            </button>

            {showTextColorDropdown && (
              <div className={`${popoverBgClass} w-60 p-3`}>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Kolor Czcionki</span>
                  <button onClick={() => setShowTextColorDropdown(false)} className="text-slate-400 hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {textColors.map((tc) => (
                    <button
                      key={tc.value}
                      type="button"
                      onClick={() => {
                        if (viewMode === 'html') {
                          handleFormat(`<span style="color: ${tc.value};">`, `</span>`);
                        } else {
                          handleFormat(`[color:${tc.value}]`, `[/color]`);
                        }
                        setShowTextColorDropdown(false);
                      }}
                      title={tc.name}
                      className="group flex flex-col items-center justify-center p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <span 
                        className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 shadow-sm"
                        style={{ backgroundColor: tc.value }}
                      />
                      <span className="text-[8px] mt-0.5 truncate max-w-full text-slate-400 scale-90">{tc.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Background / Highlighter */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                const prev = showBgColorDropdown;
                closeAllPopovers();
                setShowBgColorDropdown(!prev);
              }}
              className={`${btnClass} flex items-center gap-1 text-xs`}
              title="Zakreśl tekst tłem (Highlighter)"
            >
              <Highlighter className="w-4 h-4 text-yellow-400" />
              <span className="hidden sm:inline font-medium">Zakreślacz</span>
            </button>

            {showBgColorDropdown && (
              <div className={`${popoverBgClass} w-60 p-3`}>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tło tekstu</span>
                  <button onClick={() => setShowBgColorDropdown(false)} className="text-slate-400 hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {bgColors.map((bg) => (
                    <button
                      key={bg.value}
                      type="button"
                      onClick={() => {
                        if (viewMode === 'html') {
                          handleFormat(`<span style="background-color: ${bg.value}; padding: 2px 4px; border-radius: 4px;">`, `</span>`);
                        } else {
                          handleFormat(`[bg:${bg.value}]`, `[/bg]`);
                        }
                        setShowBgColorDropdown(false);
                      }}
                      title={bg.name}
                      className="group flex flex-col items-center justify-center p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <span 
                        className="w-6 h-4 rounded border border-slate-300 dark:border-slate-700 shadow-sm flex items-center justify-center text-[7px]"
                        style={{ backgroundColor: bg.value === 'transparent' ? undefined : bg.value }}
                      >
                        {bg.value === 'transparent' ? 'X' : 'abc'}
                      </span>
                      <span className="text-[8px] mt-0.5 truncate max-w-full text-slate-400 scale-90">{bg.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <span className={separatorClass}></span>

          {/* Alignment */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => handleFormat(viewMode === 'html' ? '<div style="text-align: left;">' : '[align:left]', viewMode === 'html' ? '</div>' : '[/align]')}
              className={btnClass}
              title="Wyrównaj do lewej"
            >
              <AlignLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleFormat(viewMode === 'html' ? '<div style="text-align: center;">' : '[align:center]', viewMode === 'html' ? '</div>' : '[/align]')}
              className={btnClass}
              title="Wyśrodkuj"
            >
              <AlignCenter className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleFormat(viewMode === 'html' ? '<div style="text-align: right;">' : '[align:right]', viewMode === 'html' ? '</div>' : '[/align]')}
              className={btnClass}
              title="Wyrównaj do prawej"
            >
              <AlignRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleFormat(viewMode === 'html' ? '<div style="text-align: justify;">' : '[align:justify]', viewMode === 'html' ? '</div>' : '[/align]')}
              className={btnClass}
              title="Pełne wyjustowanie"
            >
              <AlignJustify className="w-4 h-4" />
            </button>
          </div>

          <span className={separatorClass}></span>

          {/* Headings */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => handleFormat(viewMode === 'html' ? '<h2>' : '## ', viewMode === 'html' ? '</h2>' : '')}
              className={btnClass}
              title="Nagłówek H2"
            >
              <Heading2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleFormat(viewMode === 'html' ? '<h3>' : '### ', viewMode === 'html' ? '</h3>' : '')}
              className={btnClass}
              title="Nagłówek H3"
            >
              <Heading3 className="w-4 h-4" />
            </button>
          </div>

          <span className={separatorClass}></span>

          {/* List and Quotes */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => handleFormat(viewMode === 'html' ? '<blockquote>' : '> ', viewMode === 'html' ? '</blockquote>' : '')}
              className={btnClass}
              title="Cytat blockquote"
            >
              <Quote className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleFormat(viewMode === 'html' ? '<ul>\n  <li>' : '- ', viewMode === 'html' ? '</li>\n</ul>' : '')}
              className={btnClass}
              title="Lista punktowana"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <span className={separatorClass}></span>

          {/* Medias: Image Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                const prev = showImagePopover;
                closeAllPopovers();
                setShowImagePopover(!prev);
              }}
              className={`p-1.5 rounded transition flex items-center gap-1 text-xs font-semibold ${
                showImagePopover 
                  ? 'bg-emerald-600 text-white' 
                  : isLight ? 'hover:bg-slate-200 text-emerald-600' : 'hover:bg-slate-800 text-emerald-400'
              }`}
              title="Wstaw grafikę (link www lub ścieżka lokalna C:\proj\wnr1\covers.png)"
            >
              <Image className="w-4 h-4" />
              <span className="hidden sm:inline">Grafika</span>
            </button>

            {showImagePopover && (
              <div className={`${popoverBgClass} w-80`}>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-emerald-500">
                    <Image className="w-4 h-4" />
                    Wstaw Grafikę / Obraz
                  </span>
                  <button onClick={() => setShowImagePopover(false)} className="text-slate-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">
                    Adres URL lub ścieżka pliku
                  </label>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData('text');
                      if (pasted) {
                        e.preventDefault();
                        setImageUrl(pasted.trim());
                      }
                    }}
                    placeholder="https://... lub C:\proj\wnr1\covers.png"
                    className={inputClass}
                  />
                  <p className="text-[9px] text-slate-500 mt-1">
                    Możesz podać link HTTP(S) lub ścieżkę lokalną np. <code className="text-emerald-400">covers.png</code>
                  </p>
                </div>

                {/* Fast Presets for local covers.png */}
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Szybkie wklejanie ścieżki:</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setImageUrl('covers.png')}
                      className="px-2 py-1 text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded border border-slate-700 transition flex items-center gap-1"
                    >
                      <FolderOpen className="w-3 h-3 text-emerald-400" />
                      covers.png
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageUrl('C:\\proj\\wnr1\\covers.png')}
                      className="px-2 py-1 text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded border border-slate-700 transition flex items-center gap-1"
                    >
                      <FolderOpen className="w-3 h-3 text-emerald-400" />
                      C:\proj\wnr1\covers.png
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Podpis pod grafiką (opcjonalny)</label>
                  <input
                    type="text"
                    value={imageCaption}
                    onChange={(e) => setImageCaption(e.target.value)}
                    placeholder="np. Okładka tomu WnR365"
                    className={inputClass}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleInsertImage}
                  disabled={!imageUrl.trim()}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition shadow-md"
                >
                  <Check className="w-4 h-4" />
                  Wstaw grafikę do treści
                </button>
              </div>
            )}
          </div>

          {/* HTML & Script Popover Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                const prev = showHtmlPopover;
                closeAllPopovers();
                setShowHtmlPopover(!prev);
              }}
              className={`p-1.5 rounded transition flex items-center gap-1 text-xs font-semibold ${
                showHtmlPopover 
                  ? 'bg-indigo-600 text-white' 
                  : isLight ? 'hover:bg-slate-200 text-indigo-600' : 'hover:bg-slate-800 text-indigo-400'
              }`}
              title="Wstaw kod HTML lub skrypt (JS, iFrame, Code block, CSS)"
            >
              <Code className="w-4 h-4" />
              <span className="hidden sm:inline">HTML & Skrypt</span>
            </button>

            {showHtmlPopover && (
              <div className={`${popoverBgClass} w-80 space-y-2.5`}>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-indigo-400 font-mono">
                    <Code className="w-4 h-4 text-indigo-400" />
                    Wstaw Kod HTML / Skrypt
                  </span>
                  <button onClick={() => setShowHtmlPopover(false)} className="text-slate-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {/* Option 1: Inline JS <script> */}
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = `\n<script>\n  // Wpisz kod skryptu JavaScript\n  console.log("WnR365 skrypt aktywny!");\n</script>\n`;
                      handleFormat(snippet);
                      setShowHtmlPopover(false);
                    }}
                    className="w-full text-left p-2 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 transition flex items-center gap-2.5 text-xs text-emerald-400 group"
                  >
                    <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-bold text-white font-mono text-[11px] group-hover:text-emerald-300">Skrypt JS (&lt;script&gt;)</div>
                      <div className="text-[9px] text-slate-400">Wykonuje aktywny kod JavaScript w podglądzie</div>
                    </div>
                  </button>

                  {/* Option 2: <iframe> embed */}
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = `\n<iframe src="https://example.com" width="100%" height="320" style="border:none; border-radius:12px; shadow:0 10px 25px rgba(0,0,0,0.5);" title="Wbudowany zasób"></iframe>\n`;
                      handleFormat(snippet);
                      setShowHtmlPopover(false);
                    }}
                    className="w-full text-left p-2 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 transition flex items-center gap-2.5 text-xs text-indigo-400 group"
                  >
                    <FileCode className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <div className="font-bold text-white font-mono text-[11px] group-hover:text-indigo-300">Ramka iframe (&lt;iframe&gt;)</div>
                      <div className="text-[9px] text-slate-400">Osadza strony www, wideo, aplikacje</div>
                    </div>
                  </button>

                  {/* Option 3: Syntax highlighted Code Block */}
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = `\n\`\`\`javascript\n// Przykładowy skrypt w JavaScript\nfunction showInsight() {\n  return "Widoki Na Raj 365";\n}\n\`\`\`\n`;
                      handleFormat(snippet);
                      setShowHtmlPopover(false);
                    }}
                    className="w-full text-left p-2 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 transition flex items-center gap-2.5 text-xs text-amber-400 group"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-bold text-white font-mono text-[11px] group-hover:text-amber-300">Blok kodu (JS / Py / PHP / HTML)</div>
                      <div className="text-[9px] text-slate-400">Wyświetla kod z przyciskiem do kopiowania</div>
                    </div>
                  </button>

                  {/* Option 4: Custom Styled HTML Div */}
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = `\n<div style="padding: 16px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 12px; margin: 16px 0;">\n  <h3 style="color: #6366f1; margin-bottom: 8px;">Tytuł sekcji HTML</h3>\n  <p style="color: #e2e8f0;">Treść sekcji z dowolnym kodem HTML...</p>\n</div>\n`;
                      handleFormat(snippet);
                      setShowHtmlPopover(false);
                    }}
                    className="w-full text-left p-2 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 transition flex items-center gap-2.5 text-xs text-rose-400 group"
                  >
                    <Code className="w-4 h-4 text-rose-400 shrink-0" />
                    <div>
                      <div className="font-bold text-white font-mono text-[11px] group-hover:text-rose-300">Kontener HTML (&lt;div style="..."&gt;)</div>
                      <div className="text-[9px] text-slate-400">Dowolny blok HTML ze stylami nadrzędnymi</div>
                    </div>
                  </button>

                </div>
              </div>
            )}
          </div>

          {/* QR Code */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                const prev = showQrPopover;
                closeAllPopovers();
                setShowQrPopover(!prev);
              }}
              className={`p-1.5 rounded transition flex items-center gap-1 text-xs font-semibold ${
                showQrPopover 
                  ? 'bg-amber-600 text-white' 
                  : isLight ? 'hover:bg-slate-200 text-amber-600' : 'hover:bg-slate-800 text-amber-400'
              }`}
              title="Generuj i dodaj automatyczny Kod QR"
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">Kod QR</span>
            </button>

            {showQrPopover && (
              <div className={`${popoverBgClass} w-80`}>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 text-amber-500">
                    <QrCode className="w-4 h-4" />
                    Automatyczny Kod QR
                  </span>
                  <button onClick={() => setShowQrPopover(false)} className="text-slate-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Adres URL dla kodu QR</label>
                  <input
                    type="text"
                    value={qrUrl}
                    onChange={(e) => setQrUrl(e.target.value)}
                    placeholder="https://widokinaraj.pl/#/wnr365-day-1"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Podpis pod kodem QR</label>
                  <input
                    type="text"
                    value={qrCaption}
                    onChange={(e) => setQrCaption(e.target.value)}
                    placeholder="np. Zeskanuj aby otworzyć stronę"
                    className={inputClass}
                  />
                </div>

                {liveQrCodeSrc && (
                  <div className="flex items-center gap-3 p-2 bg-slate-950 rounded-lg border border-slate-800">
                    <img src={liveQrCodeSrc} alt="Podgląd kodu QR" className="w-14 h-14 bg-white p-1 rounded shrink-0" />
                    <div className="truncate">
                      <span className="text-[9px] font-bold text-amber-400 font-mono uppercase">PODGLĄD QR</span>
                      <p className="text-[10px] text-slate-300 truncate">{qrUrl}</p>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleInsertQr}
                  disabled={!qrUrl.trim()}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  Wstaw Kod QR
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Right side: 3-Way Mode Switcher & Theme Switcher */}
        <div className="flex items-center gap-1.5 mt-2 sm:mt-0">
          
          {/* Light/Dark mode switcher */}
          <button
            type="button"
            onClick={onThemeToggle}
            className={`${btnClass} !p-2 flex items-center justify-center bg-transparent`}
            title={isLight ? "Przełącz na Ciemny Motyw" : "Przełącz na Jasny Motyw"}
          >
            {isLight ? (
              <Moon className="w-4 h-4 text-indigo-600" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>

          <span className={separatorClass}></span>

          {/* 3-Way Segmented View Mode Switcher */}
          <div className="flex items-center p-1 bg-slate-200 dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-800 font-sans text-xs">
            
            {/* Mode 1: Traditional Editor */}
            <button
              type="button"
              onClick={() => handleModeSwitch('traditional')}
              className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 cursor-pointer select-none ${
                viewMode === 'traditional'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Edytor tekstowy z tagami WYSIWYG"
            >
              ✍️ <span className="hidden md:inline">Tradycyjny</span>
            </button>

            {/* Mode 2: HTML Source Code */}
            <button
              type="button"
              onClick={() => handleModeSwitch('html')}
              className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 cursor-pointer select-none ${
                viewMode === 'html'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Edycja czystego kodu HTML & skryptów"
            >
              💻 <span className="hidden md:inline">Kod HTML</span>
            </button>

            {/* Mode 3: Live Visual Preview */}
            <button
              type="button"
              onClick={() => handleModeSwitch('preview')}
              className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 cursor-pointer select-none ${
                viewMode === 'preview'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Podgląd wyrenderowanej treści na żywo"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Podgląd</span>
            </button>

          </div>

        </div>
      </div>

      {/* Editor Content Area based on active viewMode */}
      <div className="relative w-full min-h-[250px]">
        {viewMode === 'preview' ? (
          <div className={previewClass}>
            {text.trim() ? (
              <div className={`text-base sm:text-lg leading-relaxed font-sans text-justify ${isLight ? 'light-mode-text' : 'text-slate-100'}`} style={isLight ? { color: '#000000' } : undefined}>
                <RichTextRenderer text={text} theme={theme} />
              </div>
            ) : (
              <span className="text-xs text-slate-500 italic">Podgląd jest pusty. Wpisz treść w edytorze tradycyjnym lub kodzie HTML...</span>
            )}
          </div>
        ) : viewMode === 'html' ? (
          <textarea
            id={textareaId}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            rows={12}
            className={htmlTextareaClass}
            placeholder="<!-- Wpisz lub wklej dowolny kod HTML, iframe lub <script> -->"
            spellCheck={false}
          />
        ) : (
          <textarea
            id={textareaId}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            rows={12}
            className={textareaClass}
            placeholder={placeholder}
          />
        )}
      </div>

      {/* Status Footer */}
      <div className={footerClass}>
        <span>
          Tryb edycji: <b className="uppercase text-emerald-400 font-mono">
            {viewMode === 'traditional' ? '✍️ Tradycyjny (WYSIWYG)' : viewMode === 'html' ? '💻 Kod źródłowy HTML & Skrypt' : '👁️ Podgląd Na Żywo'}
          </b>
        </span>
        <span className="flex items-center gap-2">
          <span>Motyw: <b className="uppercase">{theme === 'light' ? 'Jasny (Light)' : 'Ciemny (Dark)'}</b></span>
          <span>|</span>
          <span>Długość: <b>{text.length}</b> znaków</span>
        </span>
      </div>
    </div>
  );
};

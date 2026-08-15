import React, { useState, useEffect, useRef } from 'react';
import { 
  Bold, Italic, Underline, Heading3, Heading2, 
  Quote, List, Image, QrCode, Eye, EyeOff, Check, X,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Sun, Moon, Type, Palette, Highlighter
} from 'lucide-react';
import { RichTextRenderer } from '../utils/richTextHelper';

interface WysiwygToolbarProps {
  text: string;
  onChange: (newText: string) => void;
  placeholder?: string;
  textareaId: string;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}

export const WysiwygToolbar: React.FC<WysiwygToolbarProps> = ({ 
  text, 
  onChange, 
  placeholder = "Wpisz natchnioną treść...", 
  textareaId,
  theme,
  onThemeToggle
}) => {
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [showImagePopover, setShowImagePopover] = useState<boolean>(false);
  const [showQrPopover, setShowQrPopover] = useState<boolean>(false);
  
  // Custom states for styling popovers
  const [showFontDropdown, setShowFontDropdown] = useState<boolean>(false);
  const [showTextColorDropdown, setShowTextColorDropdown] = useState<boolean>(false);
  const [showBgColorDropdown, setShowBgColorDropdown] = useState<boolean>(false);

  // Popover State: Image
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageCaption, setImageCaption] = useState<string>('');

  // Popover State: QR Code
  const [qrUrl, setQrUrl] = useState<string>('');
  const [qrCaption, setQrCaption] = useState<string>('');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Focus textarea helper
  useEffect(() => {
    textareaRef.current = document.getElementById(textareaId) as HTMLTextAreaElement;
  }, [textareaId]);

  const handleFormat = (before: string, after: string = '') => {
    const textarea = textareaRef.current || (document.getElementById(textareaId) as HTMLTextAreaElement);
    if (!textarea) return;

    textarea.focus();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = text.substring(start, end);

    const replacement = before + (selection || '') + after;
    const newText = text.substring(0, start) + replacement + text.substring(end);
    onChange(newText);

    // Reset cursor position
    setTimeout(() => {
      textarea.selectionStart = start + before.length;
      textarea.selectionEnd = start + before.length + (selection ? selection.length : 0);
      textarea.focus();
    }, 50);
  };

  const handleInsertImage = () => {
    if (!imageUrl.trim()) return;
    const formatted = `\n[image:${imageUrl.trim()}]${imageCaption.trim() ? `[caption:${imageCaption.trim()}]` : ''}\n`;
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
    const formatted = `\n[qr:${finalQrUrl}]${qrCaption.trim() ? `[caption:${qrCaption.trim()}]` : ''}\n`;
    handleFormat(formatted);
    setQrUrl('');
    setQrCaption('');
    setShowQrPopover(false);
  };

  const closeAllPopovers = () => {
    setShowImagePopover(false);
    setShowQrPopover(false);
    setShowFontDropdown(false);
    setShowTextColorDropdown(false);
    setShowBgColorDropdown(false);
  };

  // Live QR Code preview image source using dynamic web service (goqr.me)
  const liveQrCodeSrc = qrUrl.trim() 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl.trim())}` 
    : '';

  // Theme-aware dynamic style classes
  const isLight = theme === 'light';

  const containerClass = isLight 
    ? 'w-full flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white shadow-md' 
    : 'w-full flex flex-col border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60 shadow-xl';

  const headerClass = isLight
    ? 'flex flex-wrap items-center justify-between gap-1 bg-slate-100 p-2 border-b border-slate-200 select-none'
    : 'flex flex-wrap items-center justify-between gap-1 bg-slate-950 p-2 border-b border-slate-800 select-none';

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
    ? 'w-full h-[250px] bg-slate-50 p-4 text-sm text-slate-850 font-sans leading-relaxed focus:outline-none focus:ring-0 resize-none border-0'
    : 'w-full h-[250px] bg-slate-950 p-4 text-sm text-slate-200 font-sans leading-relaxed focus:outline-none focus:ring-0 resize-none border-0';

  const previewClass = isLight
    ? 'p-4 sm:p-5 w-full h-[250px] overflow-y-auto select-text bg-slate-50 light-mode-text'
    : 'p-4 sm:p-5 w-full h-[250px] overflow-y-auto select-text bg-slate-950 text-slate-100';

  const footerClass = isLight
    ? 'flex justify-between items-center bg-slate-100 px-4 py-1.5 border-t border-slate-200 text-[10px] font-mono text-slate-500'
    : 'flex justify-between items-center bg-slate-950 px-4 py-1.5 border-t border-slate-900 text-[10px] font-mono text-slate-500';

  // 12 Popular Fonts
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

  // Swatches text colors (for both light/dark context)
  const textColors = [
    { value: '#000000', name: 'Czarny' },
    { value: '#FFFFFF', name: 'Biały' },
    { value: '#334155', name: 'Ciemnoszary' },
    { value: '#94A3B8', name: 'Srebrny / Szary' },
    { value: '#EF4444', name: 'Czerwony' },
    { value: '#F97316', name: 'Pomarańczowy' },
    { value: '#FBBF24', name: 'Złoty' },
    { value: '#10B981', name: 'Zielony' },
    { value: '#0EA5E9', name: 'Błękitny' },
    { value: '#6366F1', name: 'Indygo' },
    { value: '#A855F7', name: 'Fioletowy' },
    { value: '#EC4899', name: 'Różowy' }
  ];

  // Swatches background/highlight colors
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
      {/* WYSIWYG Toolbar Header */}
      <div className={headerClass}>
        <div className="flex flex-wrap items-center gap-1.5">
          
          {/* Text Basic Formatting */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => handleFormat('**', '**')}
              className={btnClass}
              title="Pogrubienie (Bold)"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleFormat('*', '*')}
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

          {/* ADVANCED: Font Selection Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                const prev = showFontDropdown;
                closeAllPopovers();
                setShowFontDropdown(!prev);
              }}
              className={`${btnClass} flex items-center gap-1 text-xs`}
              title="Wybierz czcionkę z kilkunastu najpopularniejszych"
            >
              <Type className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline font-medium">Czcionka</span>
            </button>

            {showFontDropdown && (
              <div className={`${popoverBgClass} w-52 overflow-hidden !p-1 max-h-64 overflow-y-auto`}>
                <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-250 dark:border-slate-800 mb-1">
                  Krój pisma / Czcionka
                </div>
                {popularFonts.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => {
                      handleFormat(`[font:${f.name}]`, `[/font]`);
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

          {/* ADVANCED: Color Picker Selector */}
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
                        handleFormat(`[color:${tc.value}]`, `[/color]`);
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

          {/* ADVANCED: Background / Highlighter Picker */}
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
                        handleFormat(`[bg:${bg.value}]`, `[/bg]`);
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
              onClick={() => handleFormat('[align:left]', '[/align]')}
              className={btnClass}
              title="Wyrównaj do lewej"
            >
              <AlignLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleFormat('[align:center]', '[/align]')}
              className={btnClass}
              title="Wyśrodkuj"
            >
              <AlignCenter className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleFormat('[align:right]', '[/align]')}
              className={btnClass}
              title="Wyrównaj do prawej"
            >
              <AlignRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleFormat('[align:justify]', '[/align]')}
              className={btnClass}
              title="Pełne wyjustowanie obustronne"
            >
              <AlignJustify className="w-4 h-4" />
            </button>
          </div>

          <span className={separatorClass}></span>

          {/* Headings */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => handleFormat('## ')}
              className={btnClass}
              title="Nagłówek H2"
            >
              <Heading2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleFormat('### ')}
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
              onClick={() => handleFormat('> ')}
              className={btnClass}
              title="Cytat blockquote"
            >
              <Quote className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleFormat('- ')}
              className={btnClass}
              title="Lista punktowana"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <span className={separatorClass}></span>

          {/* Advanced Medias: Image */}
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
                  ? 'bg-indigo-600 text-white' 
                  : isLight ? 'hover:bg-slate-200 text-emerald-600' : 'hover:bg-slate-800 text-emerald-400'
              }`}
              title="Dodaj grafikę/obraz z podpisem"
            >
              <Image className="w-4 h-4" />
              <span className="hidden sm:inline">Grafika</span>
            </button>

            {showImagePopover && (
              <div className={`${popoverBgClass} w-72`}>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                    <Image className="w-3.5 h-3.5 text-emerald-500" />
                    Wstaw Grafikę
                  </span>
                  <button onClick={() => setShowImagePopover(false)} className="text-slate-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Adres URL grafiki</label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/zdjecie.jpg"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Podpis pod grafiką</label>
                  <input
                    type="text"
                    value={imageCaption}
                    onChange={(e) => setImageCaption(e.target.value)}
                    placeholder="np. Maryja Królowa Polski"
                    className={inputClass}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleInsertImage}
                  disabled={!imageUrl.trim()}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  Wstaw do treści
                </button>
              </div>
            )}
          </div>

          {/* Advanced Medias: QR Code */}
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
                  ? 'bg-indigo-600 text-white' 
                  : isLight ? 'hover:bg-slate-200 text-amber-600' : 'hover:bg-slate-800 text-amber-400'
              }`}
              title="Generuj i dodaj automatyczny, aktywny Kod QR z podpisem"
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">Kod QR</span>
            </button>

            {showQrPopover && (
              <div className={`${popoverBgClass} w-80`}>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                    <QrCode className="w-3.5 h-3.5 text-amber-500" />
                    Automatyczny Kod QR
                  </span>
                  <button onClick={() => setShowQrPopover(false)} className="text-slate-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Adres URL dla kodu QR</label>
                  <input
                    type="url"
                    value={qrUrl}
                    onChange={(e) => setQrUrl(e.target.value)}
                    placeholder="https://widokinaraj.pl/#/wnr365-day-1"
                    className={inputClass}
                  />
                  <p className="text-[9px] text-slate-500 mt-0.5">Przekieruje użytkownika po kliknięciu lub zeskanowaniu</p>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Podpis pod kodem QR</label>
                  <input
                    type="text"
                    value={qrCaption}
                    onChange={(e) => setQrCaption(e.target.value)}
                    placeholder="np. Kliknij, aby przejść na stronę"
                    className={inputClass}
                  />
                </div>

                {/* Auto Generated QR Code Live Preview */}
                {liveQrCodeSrc && (
                  <a 
                    href={qrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Testuj link: ${qrUrl}`}
                    className="flex items-center gap-3 p-2 bg-slate-100 dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 transition-all duration-300 block cursor-pointer group"
                  >
                    <div className="p-1 bg-white rounded-md shrink-0 transition-transform duration-300 group-hover:scale-105">
                      <img src={liveQrCodeSrc} alt="Podgląd kodu QR" className="w-16 h-16" referrerPolicy="no-referrer" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-amber-500 dark:text-amber-400 uppercase font-mono tracking-wide">AUTO PODGLĄD QR</span>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 max-w-[150px] truncate group-hover:underline">{qrUrl}</p>
                      <p className="text-[10px] text-slate-500 italic truncate max-w-[150px]">"{qrCaption || 'Brak podpisu'}"</p>
                    </div>
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleInsertQr}
                  disabled={!qrUrl.trim()}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  Wstaw Kod QR z podpisem
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Right side: Light/Dark Mode Switcher & Preview Mode */}
        <div className="flex items-center gap-1.5 mt-2 sm:mt-0">
          
          {/* Light/Dark mode switcher button */}
          <button
            type="button"
            onClick={onThemeToggle}
            className={`${btnClass} !p-2 flex items-center justify-center bg-transparent`}
            title={isLight ? "Przełącz na Ciemny Motyw (Dark Mode)" : "Przełącz na Jasny Motyw (Light Mode)"}
          >
            {isLight ? (
              <Moon className="w-4 h-4 text-indigo-600 animate-pulse" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400 animate-pulse" />
            )}
          </button>

          <span className={separatorClass}></span>

          {/* Live Preview Toggle */}
          <button
            type="button"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer transition select-none ${
              isPreviewMode 
                ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' 
                : isLight 
                  ? 'bg-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-300 border border-slate-300'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            {isPreviewMode ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                Edytor tekstowy
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                PODGLĄD NA ŻYWO (WYSIWYG)
              </>
            )}
          </button>

        </div>
      </div>

      {/* Editor Content Area */}
      <div className="relative w-full min-h-[220px]">
        {isPreviewMode ? (
          <div className={previewClass}>
            {text.trim() ? (
              <div className={`text-base sm:text-lg leading-relaxed font-sans text-justify ${isLight ? 'light-mode-text' : 'text-slate-100'}`} style={isLight ? { color: '#000000' } : undefined}>
                <RichTextRenderer text={text} theme={theme} />
              </div>
            ) : (
              <span className="text-xs text-slate-500 italic">Podgląd jest pusty. Wpisz coś w edytorze tekstowym...</span>
            )}
          </div>
        ) : (
          <textarea
            id={textareaId}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            rows={10}
            className={textareaClass}
            placeholder={placeholder}
          />
        )}
      </div>

      {/* Status Footer */}
      <div className={footerClass}>
        <span>Tryb: {isPreviewMode ? "Podgląd wizualny (WYSIWYG)" : "Kodowanie / Tekst"}</span>
        <span className="flex items-center gap-2">
          <span>Motyw: <b className="uppercase">{theme === 'light' ? 'Jasny (Light)' : 'Ciemny (Dark)'}</b></span>
          <span>|</span>
          <span>Długość: <b>{text.length}</b> znaków</span>
        </span>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Volume2, 
  BookOpen, Maximize2, Minimize2, Sparkles, Sliders, FileText, 
  ZoomIn, ZoomOut, Check, ArrowRight, Loader2
} from 'lucide-react';
import { speakText, stopSpeech, pauseSpeech, resumeSpeech, isSpeechSpeaking, isSpeechPaused, isTtsSupported, getPolishVoice, getPolishVoices } from '../utils/tts';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

interface EbookSectionProps {
  theme: 'dark' | 'light';
}

export const EbookSection: React.FC<EbookSectionProps> = ({ theme }) => {
  // PDF document state
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(true);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Rendered page images cache (pageNum -> dataUrl)
  const [pageImages, setPageImages] = useState<Record<string, string>>({});

  // View settings
  const [viewMode, setViewMode] = useState<'single' | 'double'>('double');
  const [scale, setScale] = useState<number>(1.0);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev'>('next');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // TTS State
  const [isReading, setIsReading] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [autoTurn, setAutoTurn] = useState<boolean>(true);
  const [readingSpeed, setReadingSpeed] = useState<number>(1.0);
  const [extractedTexts, setExtractedTexts] = useState<Record<number, string>>({});
  const [isExtractingText, setIsExtractingText] = useState<boolean>(false);

  // TTS Voice Selection State
  const [selectedGender, setSelectedGender] = useState<'female' | 'male'>('female');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>('');

  const isDark = theme === 'dark';

  // Warm-up and fetch all available Polish/system voices
  useEffect(() => {
    const updateVoices = () => {
      const vList = getPolishVoices();
      if (vList.length > 0) {
        setAvailableVoices(vList);
      }
    };
    updateVoices();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Check if a credible male Polish voice exists
  const hasMaleVoice = availableVoices.some((v) => {
    const fn = v.name.toLowerCase();
    return (
      fn.includes('jacek') || fn.includes('jan') || fn.includes('marek') ||
      fn.includes('adam') || fn.includes('male') || fn.includes('mężczyzna') ||
      fn.includes('tomasz') || fn.includes('pawel') || fn.includes('paweł')
    );
  });

  // Derived: whether the dropdown has a specific voice selected (not Auto)
  const isVoiceSpecific = selectedVoiceUri !== '';

  // Responsive default view mode
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setViewMode('single');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load PDF document
  useEffect(() => {
    let isMounted = true;
    setIsLoadingPdf(true);
    setPdfError(null);

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ url: '/WnR365.pdf' });
        const pdf = await loadingTask.promise;
        if (isMounted) {
          setPdfDocument(pdf);
          setNumPages(pdf.numPages);
          setIsLoadingPdf(false);
        }
      } catch (err: any) {
        console.error("Błąd podczas ładowania WnR365.pdf:", err);
        if (isMounted) {
          setPdfError("Nie udało się załadować pliku prezentacji WnR365.pdf. Upewnij się, że plik znajduje się na serwerze.");
          setIsLoadingPdf(false);
        }
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
      stopSpeech();
    };
  }, []);

  // Render a specific page to Data URL with resolution scaling
  const renderPageToDataUrl = useCallback(async (pageNum: number, currentScale: number) => {
    if (!pdfDocument || pageNum < 1 || pageNum > numPages) return null;

    const cacheKey = `${pageNum}_${currentScale}`;
    if (pageImages[cacheKey]) return pageImages[cacheKey];

    try {
      const page = await pdfDocument.getPage(pageNum);
      const pixelRatio = Math.max(window.devicePixelRatio || 1, 1.5);
      const viewport = page.getViewport({ scale: currentScale * pixelRatio });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) return null;

      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/png');

      setPageImages(prev => ({ ...prev, [cacheKey]: dataUrl }));
      return dataUrl;
    } catch (err) {
      console.warn(`Błąd generowania obrazu dla strony ${pageNum}:`, err);
      return null;
    }
  }, [pdfDocument, numPages, pageImages]);

  // Active pages calculation
  const leftPageNum = viewMode === 'double' ? (currentPage % 2 === 0 ? currentPage - 1 : currentPage) : currentPage;
  const rightPageNum = viewMode === 'double' ? leftPageNum + 1 : null;

  // Trigger page rendering
  useEffect(() => {
    if (!pdfDocument || numPages === 0) return;

    renderPageToDataUrl(leftPageNum, scale);
    if (rightPageNum && rightPageNum <= numPages) {
      renderPageToDataUrl(rightPageNum, scale);
    }

    // Pre-render next pages
    const nextLeft = viewMode === 'double' ? leftPageNum + 2 : leftPageNum + 1;
    if (nextLeft <= numPages) {
      renderPageToDataUrl(nextLeft, scale);
      if (viewMode === 'double' && nextLeft + 1 <= numPages) {
        renderPageToDataUrl(nextLeft + 1, scale);
      }
    }
  }, [pdfDocument, numPages, leftPageNum, rightPageNum, viewMode, scale, renderPageToDataUrl]);

  // Helper to extract text of a page (filtering out ALL headers, footers, titles, dates, citations, and acronyms)
  const getPageText = useCallback(async (pageNum: number): Promise<string> => {
    if (!pdfDocument || pageNum < 1 || pageNum > numPages) return "";

    try {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items: any[] = textContent.items || [];

      if (items.length === 0) return "";

      // 1. Filter items by vertical coordinates (y: 35-545) and body font height (h >= 12)
      const bodyItems = items.filter((item: any) => {
        const str = (item.str || '').trim();
        if (!str) return false;

        const y = item.transform ? Math.round(item.transform[5]) : 0;
        const h = Math.round(item.height);

        // Top running header (y >= 545) or Bottom running footer (y <= 35)
        if (y >= 545 || y <= 35) return false;

        // Day headers & section titles in WnR365.pdf are font height < 12 (h:8, h:10, h:11)
        if (h < 12) return false;

        // Known title & branding patterns
        if (/^(Widoki na Raj|RHZ365|WnR365|Biblia365|Cykl|DZIEŃ|eMBiK365|Historii Zbawienia|str\.)/i.test(str)) return false;
        if (/^\(\s*Cykl/i.test(str) || /^\[\d{2}\.\d{2}\.\d{4}\]/i.test(str)) return false;

        return true;
      });

      const targetItems = bodyItems.length > 0 ? bodyItems : items;
      let text = targetItems
        .map((item: any) => item.str)
        .join(' ')
        // Remove scripture citations e.g. (Mt 10,8), (J 10,34)
        .replace(/\([A-Za-z0-9\s,\.\-–—]+\)/g, (match) => {
          if (/\b(Mt|Marek|Łk|Łukasz|J|Jan|Dz|Apostolskie|Rzym|Kor|Gal|Efez|Filip|Kol|Tes|Tim|Tyt|Filem|Hbr|Jk|Piotr|Juda|Ap|Rdz|Wj|Kpł|Lb|Pwt|Joz|Sędziowie|Rut|Sam|Krl|Krn|Ezd|Ne|Tob|Jdt|Est|Mach|Hiob|Ps|Prz|Kohelet|Pieśń|Mdr|Syr|Iz|Jer|Lm|Bar|Ez|Dn|Oz|Joel|Am|Obad|Jonasz|Mich|Nah|Hab|Sof|Ag|Zach|Mal)\b/i.test(match)) {
            return '';
          }
          if (/Cykl|Dzień|Różaniec|Historii/i.test(match)) {
            return '';
          }
          return match;
        })
        // Remove dates, brand names, page numbers, titles and acronyms
        .replace(/\[\d{2}\.\d{2}\.\d{4}\]/g, '')
        .replace(/Widoki na Raj\s*[-—–]\s*WnR365/gi, '')
        .replace(/eMBiK365\s*[-—–]\s*widokinaraj\.pl/gi, '')
        .replace(/DZIEŃ\s+\d+\s*[-—–]\s*[^\s]+/gi, '')
        .replace(/Cykl\s+[I|V|X\d]+\s*\([^\)]*\)\s*[-—–]\s*Dzień\s*\d+/gi, '')
        .replace(/WnR365\s*[-—–]\s*Widoki na Raj\s*[-—–]?\s*\([^\)]*\)\s*[-—–]?\s*\[[^\]]*\]/gi, '')
        .replace(/str\.\s*\d+/gi, '')
        .replace(/\b(eMBiK365|WnR365|RHZ365|Biblia365|widokinaraj\.pl)\b/gi, '')
        .replace(/\b(np|itd|itp|tzn|tzw|wg)\b\.?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      return text;
    } catch (err) {
      console.warn(`Błąd wyciągania tekstu ze strony ${pageNum}:`, err);
      return "";
    }
  }, [pdfDocument, numPages]);

  // Navigation step
  const step = viewMode === 'double' ? 2 : 1;

  const goToNextPage = useCallback(() => {
    if (currentPage + step <= numPages + (viewMode === 'double' ? 1 : 0)) {
      setFlipDirection('next');
      const nextP = Math.min(numPages, currentPage + step);
      setCurrentPage(nextP);
      return nextP;
    }
    return null;
  }, [currentPage, step, numPages, viewMode]);

  const goToPrevPage = useCallback(() => {
    if (currentPage - step >= 1) {
      setFlipDirection('prev');
      const prevP = Math.max(1, currentPage - step);
      setCurrentPage(prevP);
      return prevP;
    }
    return null;
  }, [currentPage, step, viewMode]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        goToNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        goToPrevPage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextPage, goToPrevPage]);

  // Read page with AI TTS
  const startReadingPage = useCallback(async (
    targetPage: number,
    overrideGender?: 'female' | 'male',
    overrideVoiceUri?: string
  ) => {
    if (!isTtsSupported()) {
      alert("Twoja przeglądarka nie wspiera funkcji Lektora AI (SpeechSynthesis).");
      return;
    }

    const activeGender = overrideGender !== undefined ? overrideGender : selectedGender;
    const activeVoiceUri = overrideVoiceUri !== undefined ? overrideVoiceUri : selectedVoiceUri;

    setIsExtractingText(true);

    let textToRead = "";

    if (viewMode === 'double') {
      const p1 = targetPage % 2 === 0 ? targetPage - 1 : targetPage;
      const p2 = p1 + 1;
      const t1 = await getPageText(p1);
      const t2 = p2 <= numPages ? await getPageText(p2) : "";
      textToRead = `${t1} ${t2}`.trim();
    } else {
      textToRead = await getPageText(targetPage);
    }

    setIsExtractingText(false);

    if (!textToRead) {
      if (autoTurn && targetPage < numPages) {
        setTimeout(() => {
          const nextP = goToNextPage();
          if (nextP) {
            startReadingPage(nextP, activeGender, activeVoiceUri);
          }
        }, 1500);
      } else {
        setIsReading(false);
        setIsPaused(false);
      }
      return;
    }

    setIsReading(true);
    setIsPaused(false);

    speakText(textToRead, {
      rate: readingSpeed,
      gender: activeGender,
      voiceURI: activeVoiceUri || undefined,
      onStart: () => {
        setIsReading(true);
        setIsPaused(false);
      },
      onEnd: () => {
        if (autoTurn) {
          const nextP = viewMode === 'double' ? (targetPage % 2 === 0 ? targetPage + 1 : targetPage + 2) : targetPage + 1;
          if (nextP <= numPages) {
            setFlipDirection('next');
            setCurrentPage(nextP);
            setTimeout(() => {
              startReadingPage(nextP, activeGender, activeVoiceUri);
            }, 600);
          } else {
            setIsReading(false);
            setIsPaused(false);
            stopSpeech();
          }
        } else {
          setIsReading(false);
          setIsPaused(false);
        }
      },
      onError: (err) => {
        console.error("Błąd lektora TTS:", err);
        setIsReading(false);
        setIsPaused(false);
      }
    });
  }, [viewMode, getPageText, numPages, autoTurn, readingSpeed, selectedGender, selectedVoiceUri, goToNextPage]);

  const handleTogglePlay = () => {
    if (!isReading) {
      startReadingPage(currentPage);
    } else if (isPaused) {
      resumeSpeech();
      setIsPaused(false);
    } else {
      pauseSpeech();
      setIsPaused(true);
    }
  };

  const handleStopReading = () => {
    stopSpeech();
    setIsReading(false);
    setIsPaused(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  const leftKey = `${leftPageNum}_${scale}`;
  const rightKey = rightPageNum ? `${rightPageNum}_${scale}` : '';

  const leftImg = pageImages[leftKey];
  const rightImg = rightKey ? pageImages[rightKey] : null;

  return (
    <div 
      ref={containerRef}
      className={`min-h-[85vh] flex flex-col justify-between p-3 sm:p-6 transition-colors duration-300 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-800'
      }`}
    >
      {/* Header Toolbar */}
      <div className={`flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl backdrop-blur-md shadow-lg border transition-all mb-3 ${
        isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/90 border-slate-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-md">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-lg sm:text-xl tracking-tight flex items-center gap-2">
              Książka E-Book <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-semibold border border-amber-500/30">WnR365.pdf</span>
            </h2>
            <p className="text-xs text-slate-400">
              {numPages > 0 ? `Strona ${currentPage} z ${numPages}` : 'Ładowanie dokumentu PDF...'}
            </p>
          </div>
        </div>

        {/* View Mode & Zoom Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Zoom controls (Active Scaling) */}
          <div className={`flex items-center rounded-xl p-1 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-200 border-slate-300'}`}>
            <button
              onClick={() => setScale(s => Math.max(0.6, parseFloat((s - 0.25).toFixed(2))))}
              className="p-1.5 rounded-lg hover:bg-amber-500/20 hover:text-amber-500 transition-colors"
              title="Pomniejsz (-25%)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setScale(1.0)}
              className="text-xs font-mono px-2 py-0.5 hover:text-amber-400 font-bold transition-colors"
              title="Resetuj przybliżenie (100%)"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={() => setScale(s => Math.min(3.0, parseFloat((s + 0.25).toFixed(2))))}
              className="p-1.5 rounded-lg hover:bg-amber-500/20 hover:text-amber-500 transition-colors"
              title="Powiększ (+25%)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Single / Double Page Toggle */}
          <div className={`flex items-center rounded-xl p-1 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-200 border-slate-300'}`}>
            <button
              onClick={() => setViewMode('single')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'single'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1 Strona
            </button>
            <button
              onClick={() => setViewMode('double')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'double'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              2 Strony
            </button>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className={`p-2.5 rounded-xl border transition-colors ${
              isDark 
                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' 
                : 'bg-slate-200 border-slate-300 text-slate-700 hover:bg-slate-300'
            }`}
            title="Pełny ekran"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* DEDICATED AI VOICE SELECTOR TOOLBAR */}
      <div className={`p-3 rounded-2xl backdrop-blur-md shadow-md border flex flex-wrap items-center justify-between gap-3 mb-4 transition-all ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'
      }`}>
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-amber-500" />
          <span className="text-xs sm:text-sm font-bold text-slate-200">Głos AI Lektora:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Gender Switcher (Głos Żeński / Męski) */}
          <div className={`flex items-center rounded-xl p-1 border text-xs ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-200 border-slate-300'}`}>

            <button
              onClick={() => {
                setSelectedGender('female');
                setSelectedVoiceUri('');
                if (isReading) startReadingPage(currentPage, 'female', '');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                !isVoiceSpecific && selectedGender === 'female'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Czysty głos żeński (np. Paulina / Zofia / Google)"
            >
              👩 <span>Głos żeński</span>
            </button>
            <button
              onClick={() => {
                setSelectedGender('male');
                setSelectedVoiceUri('');
                if (isReading) startReadingPage(currentPage, 'male', '');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                !isVoiceSpecific && selectedGender === 'male'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={hasMaleVoice ? 'Głos męski (np. Jacek)' : 'Brak głosu męskiego w systemie — zostanie użyty neutralny'}
            >
              👨 <span>Głos Męski{!hasMaleVoice && availableVoices.length > 0 ? ' ⚠️' : ''}</span>
            </button>
          </div>

          {/* Voice Dropdown Selector */}

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:inline">Głos systemowy:</span>
            <select
              value={selectedVoiceUri}
              onChange={(e) => {
                const newUri = e.target.value;
                setSelectedVoiceUri(newUri);
                if (isReading) startReadingPage(currentPage, selectedGender, newUri);
              }}
              className={`text-xs p-2 rounded-xl border font-semibold max-w-[220px] cursor-pointer transition-all ${
                isDark ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-amber-700 hover:bg-slate-200'
              } ${isVoiceSpecific ? 'ring-2 ring-amber-500' : ''}`}
              title="Wybierz konkretny głos systemowy lub pozostaw Auto"
            >
              <option value="">
                ★ Auto ({selectedGender === 'female' ? 'Żeński PL' : 'Męski PL'})
              </option>
              {availableVoices.length === 0 && (
                <option disabled value="__none__">Brak głosów polskich w systemie</option>
              )}
              {availableVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} [{v.lang}]
                </option>
              ))}
            </select>
          </div>
          {/* Warning when no male voice exists */}
          {selectedGender === 'male' && !hasMaleVoice && !isVoiceSpecific && availableVoices.length > 0 && (
            <span className="text-xs text-amber-400 italic">⚠️ Brak głosu męskiego w systemie</span>
          )}
        </div>
      </div>

      {/* Main Book Display Container (Scrollable on Zoom) */}
      <div className="relative flex-1 my-2 flex items-center justify-center overflow-auto min-h-[500px] w-full p-2 sm:p-4">
        {isLoadingPdf ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-amber-500 mb-4" />
            <p className="font-semibold text-lg">Ładowanie prezentacji WnR365.pdf...</p>
            <p className="text-sm text-slate-400 mt-1">Przygotowywanie widoku książki i lektora AI</p>
          </div>
        ) : pdfError ? (
          <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 max-w-md text-center">
            <p className="font-semibold mb-2">{pdfError}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-rose-500 text-white rounded-xl font-medium text-sm hover:bg-rose-600 transition-colors"
            >
              Spróbuj ponownie
            </button>
          </div>
        ) : (
          <div className="relative flex items-center justify-center max-w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentPage}_${viewMode}`}
                initial={{ 
                  rotateY: flipDirection === 'next' ? 25 : -25, 
                  opacity: 0.8,
                  scale: 0.98
                }}
                animate={{ 
                  rotateY: 0, 
                  opacity: 1,
                  scale: 1
                }}
                exit={{ 
                  rotateY: flipDirection === 'next' ? -25 : 25, 
                  opacity: 0.4,
                  scale: 0.98
                }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                style={{ perspective: 1400 }}
                className={`relative flex items-center justify-center rounded-2xl shadow-2xl overflow-hidden border p-3 sm:p-5 transition-all ${
                  isDark ? 'bg-slate-900 border-slate-800 shadow-amber-500/5' : 'bg-amber-50/80 border-amber-200 shadow-slate-300'
                }`}
              >
                {/* Book Spine shadow in double view */}
                {viewMode === 'double' && (
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6 bg-gradient-to-r from-black/15 via-black/35 to-black/15 z-10 pointer-events-none" />
                )}

                {/* Left Page Image with Dynamic Zoom Scaling */}
                <div className="relative flex flex-col items-center min-w-[280px] min-h-[380px] justify-center">
                  {leftImg ? (
                    <img 
                      src={leftImg} 
                      alt={`Strona ${leftPageNum}`}
                      style={{
                        maxHeight: `${Math.round(72 * scale)}vh`,
                        maxWidth: scale > 1.2 ? 'none' : '100%',
                        transition: 'max-height 0.25s ease-out',
                      }}
                      className="w-auto h-auto rounded-lg shadow-md object-contain transition-opacity duration-300" 
                    />
                  ) : (
                    <div className="w-[300px] h-[400px] flex flex-col items-center justify-center gap-3 text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                      <span className="text-xs font-mono">Renderowanie strony {leftPageNum}...</span>
                    </div>
                  )}
                  <span className="text-[10px] font-mono text-slate-400 mt-2">
                    Strona {leftPageNum}
                  </span>
                </div>

                {/* Right Page Image (Double view) */}
                {viewMode === 'double' && (
                  <div className="relative flex flex-col items-center border-l border-slate-700/30 pl-3 sm:pl-5 min-w-[280px] min-h-[380px] justify-center">
                    {rightPageNum && rightPageNum <= numPages ? (
                      rightImg ? (
                        <>
                          <img 
                            src={rightImg} 
                            alt={`Strona ${rightPageNum}`}
                            style={{
                              maxHeight: `${Math.round(72 * scale)}vh`,
                              maxWidth: scale > 1.2 ? 'none' : '100%',
                              transition: 'max-height 0.25s ease-out',
                            }}
                            className="w-auto h-auto rounded-lg shadow-md object-contain transition-opacity duration-300" 
                          />
                          <span className="text-[10px] font-mono text-slate-400 mt-2">
                            Strona {rightPageNum}
                          </span>
                        </>
                      ) : (
                        <div className="w-[300px] h-[400px] flex flex-col items-center justify-center gap-3 text-slate-400">
                          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                          <span className="text-xs font-mono">Renderowanie strony {rightPageNum}...</span>
                        </div>
                      )
                    ) : (
                      <div className="w-[300px] h-[400px] flex items-center justify-center text-slate-500 text-sm border-2 border-dashed border-slate-800 rounded-lg">
                        Koniec książki
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Quick Navigation Side Buttons */}
            <button
              onClick={goToPrevPage}
              disabled={currentPage <= 1}
              className={`absolute left-[-15px] sm:left-[-30px] top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full shadow-2xl border transition-all z-20 ${
                currentPage <= 1
                  ? 'opacity-30 cursor-not-allowed bg-slate-800/40 text-slate-500'
                  : isDark 
                    ? 'bg-slate-900/90 border-slate-700 text-amber-400 hover:bg-amber-500 hover:text-slate-950 hover:scale-110' 
                    : 'bg-white/90 border-slate-300 text-amber-600 hover:bg-amber-500 hover:text-white hover:scale-110'
              }`}
              title="Poprzednia strona"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              onClick={goToNextPage}
              disabled={currentPage >= numPages}
              className={`absolute right-[-15px] sm:right-[-30px] top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full shadow-2xl border transition-all z-20 ${
                currentPage >= numPages
                  ? 'opacity-30 cursor-not-allowed bg-slate-800/40 text-slate-500'
                  : isDark 
                    ? 'bg-slate-900/90 border-slate-700 text-amber-400 hover:bg-amber-500 hover:text-slate-950 hover:scale-110' 
                    : 'bg-white/90 border-slate-300 text-amber-600 hover:bg-amber-500 hover:text-white hover:scale-110'
              }`}
              title="Następna strona"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>

      {/* Floating Bottom AI TTS & Navigation Bar */}
      <div className={`p-4 rounded-2xl backdrop-blur-lg shadow-xl border flex flex-col md:flex-row items-center justify-between gap-4 transition-all ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/95 border-slate-200'
      }`}>
        {/* Page Jump slider & controls */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <button
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            className="p-2 rounded-xl border border-slate-700/50 hover:bg-amber-500/20 disabled:opacity-40"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Strona</span>
            <input
              type="number"
              min={1}
              max={numPages || 1}
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (val >= 1 && val <= numPages) {
                  setCurrentPage(val);
                }
              }}
              className={`w-14 text-center text-sm font-bold rounded-lg p-1 border font-mono ${
                isDark ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-slate-100 border-slate-300 text-amber-600'
              }`}
            />
            <span className="text-xs text-slate-400">z {numPages}</span>
          </div>

          <button
            onClick={goToNextPage}
            disabled={currentPage >= numPages}
            className="p-2 rounded-xl border border-slate-700/50 hover:bg-amber-500/20 disabled:opacity-40"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* AI TTS Narrator Player Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-center">
          {/* Main TTS Play / Pause Button */}
          <button
            onClick={handleTogglePlay}
            disabled={isLoadingPdf || isExtractingText}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold shadow-lg transition-all transform active:scale-95 ${
              isReading && !isPaused
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-amber-500/20 ring-2 ring-amber-400/50'
                : 'bg-gradient-to-r from-amber-600 to-amber-500 text-white hover:from-amber-500 hover:to-amber-400'
            }`}
          >
            {isExtractingText ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isReading && !isPaused ? (
              <>
                <Pause className="w-5 h-5 fill-current" />
                <span>Pauza Lektora</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>{isPaused ? 'Wznów Czytanie' : 'Czytaj AI Lektorem'}</span>
              </>
            )}
          </button>

          {/* Stop Speech Button */}
          {isReading && (
            <button
              onClick={handleStopReading}
              className="p-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
              title="Zatrzymaj lektora"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          )}

          {/* Auto-turn Toggle Switch */}
          <button
            onClick={() => setAutoTurn(prev => !prev)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
              autoTurn
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : 'bg-slate-800/40 border-slate-700 text-slate-400'
            }`}
            title="Automatycznie przewracaj strony po przeczytaniu"
          >
            <Sparkles className={`w-4 h-4 ${autoTurn ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <span>Auto-Przewracanie {autoTurn ? 'WŁ' : 'WYŁ'}</span>
          </button>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-slate-800/60 p-1 rounded-xl border border-slate-700/60 text-xs">
            {[0.8, 1.0, 1.25, 1.5].map((spd) => (
              <button
                key={spd}
                onClick={() => {
                  setReadingSpeed(spd);
                  if (isReading) {
                    startReadingPage(currentPage);
                  }
                }}
                className={`px-2 py-1 rounded-lg font-mono transition-all ${
                  readingSpeed === spd
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

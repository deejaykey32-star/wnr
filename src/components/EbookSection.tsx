import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Volume2, 
  BookOpen, Maximize2, Minimize2, Sparkles, Sliders, FileText, 
  ZoomIn, ZoomOut, Check, ArrowRight, Loader2
} from 'lucide-react';
import { speakText, stopSpeech, pauseSpeech, resumeSpeech, isSpeechSpeaking, isSpeechPaused, isTtsSupported, getPolishVoice, getPolishVoices, getVoicesForLang } from '../utils/tts';
import { SUPPORTED_LANGUAGES, getLanguageOption, translateTextFromPolish } from '../utils/translator';
import { TtsVoiceToolbar } from './TtsVoiceToolbar';
import wnrPdfEntries from '../data/wnr365_pdf_entries.json';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

interface EbookSectionProps {
  theme: 'dark' | 'light';
  targetLanguage?: string;
  setTargetLanguage?: (lang: string) => void;
  selectedGender?: 'female' | 'male';
  setSelectedGender?: (g: 'female' | 'male') => void;
  selectedVoiceUri?: string;
  setSelectedVoiceUri?: (u: string) => void;
  isTranslating?: boolean;
  onOpenExportModal?: () => void;
}

export const EbookSection: React.FC<EbookSectionProps> = ({
  theme,
  targetLanguage: propsTargetLanguage,
  setTargetLanguage: propsSetTargetLanguage,
  selectedGender: propsSelectedGender,
  setSelectedGender: propsSetSelectedGender,
  selectedVoiceUri: propsSelectedVoiceUri,
  setSelectedVoiceUri: propsSetSelectedVoiceUri,
  isTranslating: propsIsTranslating,
  onOpenExportModal
}) => {
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
  const [pdfPageTexts, setPdfPageTexts] = useState<Record<number, string>>({});
  const [isExtractingText, setIsExtractingText] = useState<boolean>(false);

  // TTS Voice & Live Translation Selection State
  const [internalSelectedGender, setInternalSelectedGender] = useState<'female' | 'male'>('female');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [internalSelectedVoiceUri, setInternalSelectedVoiceUri] = useState<string>('');
  const [internalTargetLanguage, setInternalTargetLanguage] = useState<string>('pl');
  const [internalIsTranslating, setInternalIsTranslating] = useState<boolean>(false);
  const [liveTranslatedText, setLiveTranslatedText] = useState<string>('');
  const [leftTranslatedText, setLeftTranslatedText] = useState<string>('');
  const [rightTranslatedText, setRightTranslatedText] = useState<string>('');
  const [isTranslatingLeft, setIsTranslatingLeft] = useState<boolean>(false);
  const [isTranslatingRight, setIsTranslatingRight] = useState<boolean>(false);

  const targetLanguage = propsTargetLanguage ?? internalTargetLanguage;
  const setTargetLanguage = propsSetTargetLanguage ?? setInternalTargetLanguage;
  const selectedGender = propsSelectedGender ?? internalSelectedGender;
  const setSelectedGender = propsSetSelectedGender ?? setInternalSelectedGender;
  const selectedVoiceUri = propsSelectedVoiceUri ?? internalSelectedVoiceUri;
  const setSelectedVoiceUri = propsSetSelectedVoiceUri ?? setInternalSelectedVoiceUri;
  const isTranslating = internalIsTranslating;
  const setIsTranslating = setInternalIsTranslating;

  const isDark = theme === 'dark';

  // Warm-up and fetch available voices matching selected target language
  useEffect(() => {
    const updateVoices = () => {
      const vList = getVoicesForLang(targetLanguage);
      setAvailableVoices(vList);
    };

    updateVoices();
    const timer1 = setTimeout(updateVoices, 300);
    const timer2 = setTimeout(updateVoices, 1200);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
      }
    };
  }, [targetLanguage]);

  const pageTextCacheRef = useRef<Record<number, string>>({});

  // Helper to extract text of a single page with caching
  const getPageText = useCallback(async (pageNum: number): Promise<string> => {
    if (pageNum < 1) return "";
    const cached = pageTextCacheRef.current[pageNum];
    if (cached && cached.length > 20 && !cached.includes("Brak treści")) {
      return cached;
    }

    // 1. Instant static lookup from wnr365_pdf_entries.json (blog_day_{pageNum-1})
    const entryKey = `blog_day_${pageNum - 1}`;
    const entry = (wnrPdfEntries as any)[entryKey];
    if (entry && (entry.title || entry.text)) {
      const entryText = `${entry.title || ''}\n\n${entry.text || ''}`.trim();
      if (entryText && entryText.length > 10) {
        pageTextCacheRef.current[pageNum] = entryText;
        return entryText;
      }
    }

    // 2. Try extracting text from PDF document if loaded
    if (pdfDocument && pageNum <= numPages) {
      try {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const items: any[] = textContent.items || [];
        const extractedText = items
          .map((item: any) => item.str || '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (extractedText && extractedText.length > 10) {
          pageTextCacheRef.current[pageNum] = extractedText;
          return extractedText;
        }
      } catch (err) {
        console.warn(`PDF text extract error page ${pageNum}:`, err);
      }
    }

    // 3. Fallback title text (do NOT cache fallback permanently)
    return `Widoki na Raj (WnR365) — Strona ${pageNum}`;
  }, [pdfDocument, numPages]);

  // Active page numbers calculation
  const leftPageNum = viewMode === 'double' ? (currentPage % 2 === 0 ? currentPage - 1 : currentPage) : currentPage;
  const rightPageNum = viewMode === 'double' ? leftPageNum + 1 : null;

  // Live on-screen page text translation (strictly translates left and right pages for 1-page or 2-page eBook spreads)
  useEffect(() => {
    if (targetLanguage === 'pl') {
      setLiveTranslatedText('');
      setLeftTranslatedText('');
      setRightTranslatedText('');
      setIsTranslating(false);
      setIsTranslatingLeft(false);
      setIsTranslatingRight(false);
      return;
    }
    let isSubscribed = true;
    setIsTranslating(true);
    setIsTranslatingLeft(true);

    if (viewMode === 'double' && rightPageNum && rightPageNum <= numPages) {
      setIsTranslatingRight(true);
    } else {
      setIsTranslatingRight(false);
    }

    // Translate Left Page
    getPageText(leftPageNum)
      .then(async (rawText) => {
        if (!isSubscribed) return;
        const textToTranslate = rawText && rawText.trim()
          ? rawText
          : `Widoki na Raj (WnR365) — Strona ${leftPageNum}`;

        const translated = await translateTextFromPolish(textToTranslate, targetLanguage);
        if (isSubscribed) {
          setLeftTranslatedText(translated || textToTranslate);
          setLiveTranslatedText(translated || textToTranslate);
        }
      })
      .catch((err) => {
        console.warn("Left page translation error:", err);
        if (isSubscribed) {
          setLeftTranslatedText(`Widoki na Raj (WnR365) — Strona ${leftPageNum}`);
        }
      })
      .finally(() => {
        if (isSubscribed) setIsTranslatingLeft(false);
      });

    // Translate Right Page in double view mode
    if (viewMode === 'double' && rightPageNum && rightPageNum <= numPages) {
      getPageText(rightPageNum)
        .then(async (rawText) => {
          if (!isSubscribed) return;
          const textToTranslate = rawText && rawText.trim()
            ? rawText
            : `Widoki na Raj (WnR365) — Strona ${rightPageNum}`;

          const translated = await translateTextFromPolish(textToTranslate, targetLanguage);
          if (isSubscribed) {
            setRightTranslatedText(translated || textToTranslate);
          }
        })
        .catch((err) => {
          console.warn("Right page translation error:", err);
          if (isSubscribed) {
            setRightTranslatedText(`Widoki na Raj (WnR365) — Strona ${rightPageNum}`);
          }
        })
        .finally(() => {
          if (isSubscribed) setIsTranslatingRight(false);
        });
    } else {
      setRightTranslatedText('');
    }

    return () => {
      isSubscribed = false;
    };
  }, [leftPageNum, rightPageNum, viewMode, targetLanguage, getPageText, numPages]);

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
        const loadingTask = pdfjsLib.getDocument({ url: `/WnR365.pdf?v=${Date.now()}` });
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
    overrideVoiceUri?: string,
    overrideLang?: string
  ) => {
    if (!isTtsSupported()) {
      alert("Twoja przeglądarka nie wspiera funkcji Lektora AI (SpeechSynthesis).");
      return;
    }

    const activeGender = overrideGender !== undefined ? overrideGender : selectedGender;
    const activeVoiceUri = overrideVoiceUri !== undefined ? overrideVoiceUri : selectedVoiceUri;
    const activeLang = overrideLang !== undefined ? overrideLang : targetLanguage;

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
            startReadingPage(nextP, activeGender, activeVoiceUri, activeLang);
          }
        }, 1500);
      } else {
        setIsReading(false);
        setIsPaused(false);
      }
      return;
    }

    // Live Translation if non-Polish target language is selected
    if (activeLang !== 'pl') {
      setIsTranslating(true);
      try {
        const translated = await translateTextFromPolish(textToRead, activeLang);
        if (translated) {
          textToRead = translated;
          setLiveTranslatedText(translated);
        }
      } catch (err) {
        console.warn("Live translation error:", err);
      } finally {
        setIsTranslating(false);
      }
    } else {
      setLiveTranslatedText('');
    }

    setIsReading(true);
    setIsPaused(false);

    speakText(textToRead, {
      rate: readingSpeed,
      gender: activeGender,
      voiceURI: activeVoiceUri || undefined,
      lang: activeLang,
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
              startReadingPage(nextP, activeGender, activeVoiceUri, activeLang);
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
  }, [viewMode, getPageText, numPages, autoTurn, readingSpeed, selectedGender, selectedVoiceUri, targetLanguage, goToNextPage]);

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

        {/* View Mode, Language Selector, Export & Zoom Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Target Language Dropdown Selector */}
          <div className={`flex items-center gap-1.5 rounded-xl p-1 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-200 border-slate-300'}`}>
            <span className="text-xs px-2 text-slate-400 font-semibold hidden sm:inline">Język:</span>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className={`text-xs font-bold rounded-lg px-2.5 py-1.5 border-0 transition-colors cursor-pointer ${
                isDark ? 'bg-slate-900 text-amber-400' : 'bg-white text-slate-800'
              }`}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Export PDF / EPUB Buttons in Header */}
          {onOpenExportModal && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenExportModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-xs font-bold shadow-md hover:from-indigo-500 hover:to-indigo-400 transition-all cursor-pointer"
                title={`Eksportuj publikację PDF/EPUB (${getLanguageOption(targetLanguage).name})`}
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Eksportuj PDF ({getLanguageOption(targetLanguage).flag})</span>
              </button>
            </div>
          )}

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
            {targetLanguage === 'pl' ? (
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
            ) : (
              /* Interactive Translated eBook Spread Container (Single or Double Page) */
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${currentPage}_${viewMode}_${targetLanguage}`}
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
                    isDark ? 'bg-slate-900 border-slate-800 shadow-amber-500/5' : 'bg-[#fbf9f5] border-amber-200/80 shadow-slate-300'
                  }`}
                >
                  {/* Book Spine shadow in double view */}
                  {viewMode === 'double' && (
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6 bg-gradient-to-r from-black/15 via-black/35 to-black/15 z-10 pointer-events-none" />
                  )}

                  {/* Left Page (Translated eBook Page) */}
                  <div 
                    style={{ fontSize: `${Math.max(12, Math.round(14 * scale))}px` }}
                    className={`relative flex flex-col justify-between min-w-[280px] max-w-[480px] w-full min-h-[440px] p-6 sm:p-8 rounded-lg shadow-sm border ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-[#fcfaf7] border-amber-100 text-slate-800'
                    }`}
                  >
                    <div className="border-b pb-2 mb-3 border-amber-500/20 flex items-center justify-between text-[11px] font-semibold text-amber-500 uppercase tracking-wider font-sans">
                      <span>Widoki na Raj (WnR365)</span>
                      <span>{getLanguageOption(targetLanguage).flag} {getLanguageOption(targetLanguage).name}</span>
                    </div>

                    {isTranslatingLeft ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-3 text-amber-500 font-sans">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="text-xs font-mono">Tłumaczenie strony {leftPageNum}...</span>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto leading-relaxed text-justify whitespace-pre-line font-serif pr-1">
                        {leftTranslatedText}
                      </div>
                    )}

                    <div className="border-t pt-2 mt-4 border-amber-500/20 text-center text-xs font-mono text-slate-400 font-sans">
                      — Strona {leftPageNum} z {numPages} —
                    </div>
                  </div>

                  {/* Right Page (Double View Translated eBook Page) */}
                  {viewMode === 'double' && (
                    <div 
                      style={{ fontSize: `${Math.max(12, Math.round(14 * scale))}px` }}
                      className={`relative flex flex-col justify-between min-w-[280px] max-w-[480px] w-full min-h-[440px] p-6 sm:p-8 rounded-lg shadow-sm border ml-3 sm:ml-5 ${
                        rightPageNum && rightPageNum <= numPages
                          ? isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-[#fcfaf7] border-amber-100 text-slate-800'
                          : isDark ? 'bg-slate-900/50 border-slate-800 text-slate-500' : 'bg-amber-50/40 border-amber-200/50 text-slate-400'
                      }`}
                    >
                      {rightPageNum && rightPageNum <= numPages ? (
                        <>
                          <div className="border-b pb-2 mb-3 border-amber-500/20 flex items-center justify-between text-[11px] font-semibold text-amber-500 uppercase tracking-wider font-sans">
                            <span>Widoki na Raj (WnR365)</span>
                            <span>{getLanguageOption(targetLanguage).flag} {getLanguageOption(targetLanguage).name}</span>
                          </div>

                          {isTranslatingRight ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3 text-amber-500 font-sans">
                              <Loader2 className="w-8 h-8 animate-spin" />
                              <span className="text-xs font-mono">Tłumaczenie strony {rightPageNum}...</span>
                            </div>
                          ) : (
                            <div className="flex-1 overflow-y-auto leading-relaxed text-justify whitespace-pre-line font-serif pr-1">
                              {rightTranslatedText}
                            </div>
                          )}

                          <div className="border-t pt-2 mt-4 border-amber-500/20 text-center text-xs font-mono text-slate-400 font-sans">
                            — Strona {rightPageNum} z {numPages} —
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-500 text-sm font-mono border-2 border-dashed border-slate-800/40 rounded-lg">
                          Koniec Książki
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}

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

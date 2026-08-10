import { useEffect, useState, useRef, useMemo } from 'react';
import { db, auth, loginWithGoogle, logout, onAuthStateChanged, handleRedirectLogin, User } from './firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { 
  DEFAULT_PRAYERS, getRGBABeads, getCMYKBeads, getPrayerSteps, 
  getCycleDayInfo, getActiveDecadeMystery, getDecadeForDay 
} from './data/prayers';
import { getAllWnrDefaultBlogEntries, getWnrDefaultBlogEntry } from './utils/wnrBlogDefaults';
import { initLocalNoSqlDb, getAllLocalBlogEntries, saveLocalBlogEntry } from './utils/localNoSqlDb';
import { RosaryRenderer } from './components/RosaryRenderer';
import { PrayerEditor } from './components/PrayerEditor';
import { BlogSection } from './components/BlogSection';
import { RichTextRenderer } from './utils/richTextHelper';
import { parseDayText } from './utils/rhzParser';
import { playBeadChime } from './utils/audio';
import { speakText, stopSpeech, pauseSpeech, resumeSpeech, isSpeechPaused, isSpeechSpeaking, isTtsSupported } from './utils/tts';
import { SearchModal } from './components/SearchModal';
import { ExportModal } from './components/ExportModal';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { 
  Play, Pause, ChevronLeft, ChevronRight, RotateCcw, 
  LogIn, LogOut, Video, Edit3, Sliders, Volume2, Info, BookOpen, Mic, MicOff, Calendar, FileDown,
  Sun, Moon, ShieldAlert, Key, X, ExternalLink, Search, Share2, Check, Smartphone
} from 'lucide-react';

export default function App() {
  // Theme state (global)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      localStorage.setItem('prayer-editor-theme', next);
      return next;
    });
  };

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [localAuth, setLocalAuth] = useState<boolean>(() => {
    return localStorage.getItem('local_editor_auth') === 'true';
  });
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authErrorMsg, setAuthErrorMsg] = useState<string | null>(null);
  const AUTHORIZED_EMAILS = ["aleksandrasabasz@gmail.com", "kuta.dominik@gmail.com"];

  const isAuthorized = useMemo(() => {
    if (user && user.email && AUTHORIZED_EMAILS.includes(user.email.toLowerCase())) {
      return true;
    }
    return localAuth;
  }, [user, localAuth]);

  const userEmail = user?.email || (localAuth ? 'kuta.dominik@gmail.com (Edytor)' : '');

  // Main UI tab ('rosary' | 'blog')
  const [activeTab, setActiveTab] = useState<'rosary' | 'blog'>('rosary');

  // Prayers state (synced with Firestore or fallback to defaults)
  const [prayers, setPrayers] = useState<Record<string, { title: string; text: string; updatedBy?: string; updatedAt?: string }>>(DEFAULT_PRAYERS);

  const POLISH_MONTHS = useMemo(() => [
    { value: 0, label: "Styczeń" },
    { value: 1, label: "Luty" },
    { value: 2, label: "Marzec" },
    { value: 3, label: "Kwiecień" },
    { value: 4, label: "Maj" },
    { value: 5, label: "Czerwiec" },
    { value: 6, label: "Lipiec" },
    { value: 7, label: "Sierpień" },
    { value: 8, label: "Wrzesień" },
    { value: 9, label: "Październik" },
    { value: 10, label: "Listopad" },
    { value: 11, label: "Grudzień" }
  ], []);

  const getDaysInMonth = (monthIndex: number) => {
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return days[monthIndex] || 31;
  };

  const getInitialUniversalDate = () => {
    const today = new Date();
    let month = today.getMonth();
    let day = today.getDate();
    if (month === 1 && day === 29) {
      day = 28; // Skip Feb 29
    }
    let year = 2026;
    if (month === 11 && day >= 25) {
      year = 2025;
    }
    return new Date(year, month, day, 12, 0, 0, 0);
  };

  // Liturgical calendar date selection (default to today)
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    return getInitialUniversalDate();
  });

  const updateUniversalDate = (day: number, monthIndex: number) => {
    let year = 2026;
    if (monthIndex === 11 && day >= 25) {
      year = 2025;
    }
    const newDate = new Date(year, monthIndex, day, 12, 0, 0, 0);
    setSelectedDate(newDate);
  };

  const handleMonthChange = (monthIdx: number) => {
    const currentDay = selectedDate.getDate();
    const maxDays = getDaysInMonth(monthIdx);
    const targetDay = Math.min(currentDay, maxDays);
    updateUniversalDate(targetDay, monthIdx);
  };

  const handleDayChange = (dayNum: number) => {
    updateUniversalDate(dayNum, selectedDate.getMonth());
  };

  // Calculate cycle info
  const cycleInfo = useMemo(() => {
    return getCycleDayInfo(selectedDate, { isExplicitRhzRoute: activeTab === 'rosary' });
  }, [selectedDate, activeTab]);

  // Rosary structure (static definitions)
  const rgbaBeads = getRGBABeads();
  const cmykBeads = getCMYKBeads();

  // Dynamic steps based on selected calendar date
  const steps = useMemo(() => {
    return getPrayerSteps(cycleInfo.cycleType, cycleInfo.dayOfCycle, prayers);
  }, [cycleInfo.cycleType, cycleInfo.dayOfCycle, prayers]);

  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);

  // Settings and Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isYoutubeMode, setIsYoutubeMode] = useState<boolean>(false);
  const [showEditor, setShowEditor] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);

  // Blog entries synced from Firestore (pre-populated with complete authentic 365 defaults)
  const [blogEntries, setBlogEntries] = useState<Record<string, { title: string; text: string; dayIndex: number; updatedBy?: string; updatedAt?: string }>>(() => getAllWnrDefaultBlogEntries());
  
  // PDF Exporting States
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<string>('');
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // Search & Custom Export & Share Modals
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [showCustomExportModal, setShowCustomExportModal] = useState<boolean>(false);
  const [showPwaPromptModal, setShowPwaPromptModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Register PWA Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'development') {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service Worker registration failed:', err);
      });
    }
  }, []);

  // Helper to map activeTab and date to 1-365 sequential URL slug
  const getSlugForTabAndDate = (tab: 'rosary' | 'blog', date: Date) => {
    const cycleStart = new Date(2025, 11, 25, 12, 0, 0, 0); // Dec 25, 2025
    const diffMs = date.getTime() - cycleStart.getTime();
    const dayIndex = Math.max(0, Math.min(364, Math.floor(diffMs / 86400000)));
    const totalDayNum = dayIndex + 1; // 1 to 365
    const prefix = tab === 'rosary' ? 'rhz365-day' : 'wnr365-day';
    return `/${prefix}-${totalDayNum}`;
  };

  // URL Initialization on Page Load and Browser Back/Forward navigation
  useEffect(() => {
    const handleUrlRoute = () => {
      const path = window.location.pathname;
      if (!path || path === '/' || path === '/index.html') {
        const today = getInitialUniversalDate();
        setSelectedDate(today);
        return;
      }

      // Supports /wnr365-day-X, /rhz365-day-X, /day-X, /day/X (from 1 to 365)
      const match = path.match(/^\/(rhz365-day|wnr365-day|day)[-\/]?(\d+)/i);
      if (match) {
        const routeType = match[1].toLowerCase();
        const totalDayNum = parseInt(match[2], 10);
        if (totalDayNum >= 1 && totalDayNum <= 365) {
          const dayIndex = totalDayNum - 1; // 0 to 364
          const cycleStart = new Date(2025, 11, 25, 12, 0, 0, 0);
          const targetDate = new Date(cycleStart.getTime() + dayIndex * 86400000);
          setSelectedDate(targetDate);
          setActiveTab(routeType === 'rhz365-day' ? 'rosary' : 'blog');
        }
      }
    };

    handleUrlRoute();
    window.addEventListener('popstate', handleUrlRoute);
    return () => window.removeEventListener('popstate', handleUrlRoute);
  }, []);

  // Sync browser URL slug when activeTab or selectedDate changes
  useEffect(() => {
    const newSlug = getSlugForTabAndDate(activeTab, selectedDate);
    if (window.location.pathname !== newSlug) {
      window.history.pushState(null, '', newSlug);
    }
  }, [activeTab, selectedDate]);

  // Share entry URL handler
  const handleShare = async () => {
    const slug = getSlugForTabAndDate(activeTab, selectedDate);
    const shareUrl = `${window.location.origin}${slug}`;
    const shareTitle = activeTab === 'rosary' 
      ? `RHZ365 — Dzień ${cycleInfo.dayOfCycle}: ${cycleInfo.cycleName}`
      : `WnR365 — Dzień ${cycleInfo.dayOfCycle}: Widoki na Raj`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `Zobacz rozważanie na widokinaraj.pl: ${shareTitle}`,
          url: shareUrl
        });
        return;
      } catch (e) {
        // Fallback to clipboard copy
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch (err) {
      console.error("Błąd kopiowania linku:", err);
    }
  };

  const activeStep = steps[activeStepIndex] || steps[0] || {
    id: 'empty',
    label: 'Brak modlitwy',
    beadIndex: 0,
    prayerType: 'signOfCross',
    rgbaBeadId: '',
    cmykBeadId: ''
  };

  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sentenceRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  const autoAdvanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef<boolean>(isPlaying);

  // Keep isPlayingRef updated to avoid stale closure issues in callbacks
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Sync Auth
  useEffect(() => {
    handleRedirectLogin().catch(console.error);

    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsub();
  }, []);

  // Sync Prayers and Blog Entries in Realtime from Firestore
  useEffect(() => {
    const unsubPrayers = onSnapshot(collection(db, 'prayers'), (snapshot) => {
      const updatedPrayers: Record<string, { title: string; text: string; updatedBy?: string; updatedAt?: string }> = { ...DEFAULT_PRAYERS };
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data && data.title && data.text) {
          updatedPrayers[doc.id] = {
            title: data.title,
            text: data.text,
            updatedBy: data.updatedBy,
            updatedAt: data.updatedAt
          };
        }
      });
      setPrayers(updatedPrayers);
    }, (error) => {
      console.warn("Firestore listener failed or permissions missing. Using local defaults:", error);
    });

    const unsubBlog = onSnapshot(collection(db, 'blog_entries'), (snapshot) => {
      const updated: Record<string, any> = getAllWnrDefaultBlogEntries(prayers);
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data && data.title && data.text) {
          const isGeneric = data.text.includes("Chwała Jezusowi w Bogu Ojcu!") || 
                            data.text.includes("To jest Twój wpis blogowy Widoki na Raj") ||
                            data.text.includes("Kliknij przycisk „Edytuj Wpis” powyżej");
          if (!isGeneric) {
            updated[doc.id] = {
              title: data.title,
              text: data.text,
              dayIndex: data.dayIndex ?? 0,
              updatedBy: data.updatedBy,
              updatedAt: data.updatedAt
            };
          }
        }
      });
      setBlogEntries(updated);
    }, (error) => {
      console.warn("Firestore blog entries listener failed (Quota/Offline). Using local NoSQL store (IndexedDB):", error);
      getAllLocalBlogEntries().then(localEntries => {
        setBlogEntries(localEntries);
      });
    });

    // Seed & load local NoSQL store (IndexedDB)
    initLocalNoSqlDb().then(() => {
      getAllLocalBlogEntries().then(localEntries => {
        setBlogEntries(prev => ({ ...localEntries, ...prev }));
      });
    });

    return () => {
      unsubPrayers();
      unsubBlog();
    };
  }, [prayers]);

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    setPdfProgress("Pobieranie rozważań i przygotowywanie dokumentu...");
    try {
      const docId = `blog_day_${cycleInfo.dayIndex}`;
      const activeEntry = blogEntries[docId] || getWnrDefaultBlogEntry(cycleInfo.dayIndex);

      const decIdx = activeStep.decadeIndex || 1;
      const mysteryData = getActiveDecadeMystery(cycleInfo.cycleType, cycleInfo.dayOfCycle, decIdx, prayers);

      let stepLabel = activeStep.label;
      let mystTitle = mysteryData.rgba.title;
      let mystText = mysteryData.rgba.text;

      if (cycleInfo.cycleType === 'cycle2') {
        const largeBeadKey = `day_${cycleInfo.dayOfCycle}_large_bead_reflection_dec_${decIdx}`;
        const customLargeBead = prayers[largeBeadKey] || prayers[`large_bead_reflection_dec_${decIdx}`];
        const largeBeadText = customLargeBead ? `${customLargeBead.title}. ${customLargeBead.text}` : "";
        mystText = `${mystText}. ${largeBeadText}`;
      }

      const { generateEmbikPdf } = await import('./utils/pdfGenerator');
      await generateEmbikPdf({
        selectedDate,
        cycleName: cycleInfo.cycleName,
        cycleType: cycleInfo.cycleType,
        dayOfCycle: cycleInfo.dayOfCycle,
        activeStepLabel: stepLabel,
        currentMysteryTitle: mystTitle,
        currentMysteryText: mystText,
        blogTitle: activeEntry.title,
        blogText: activeEntry.text,
        prayers: prayers as any
      }, (msg) => setPdfProgress(msg));
    } catch (err) {
      console.error("PDF Export Error: ", err);
      alert("Wystąpił błąd podczas generowania pliku PDF. Spróbuj ponownie.");
    } finally {
      setIsExportingPdf(false);
      setPdfProgress('');
    }
  };

  const handleExportYearlyPdf = async () => {
    setIsExportingPdf(true);
    setPdfProgress("Pobieranie rozważań i przygotowywanie księgi całorocznej...");
    try {
      const { generateYearlyEmbikPdf } = await import('./utils/pdfGenerator');
      await generateYearlyEmbikPdf(
        prayers,
        blogEntries,
        (msg) => setPdfProgress(msg)
      );
    } catch (err) {
      console.error("Yearly PDF Export Error: ", err);
      alert("Wystąpił błąd podczas generowania całorocznego pliku PDF. Spróbuj ponownie.");
    } finally {
      setIsExportingPdf(false);
      setPdfProgress('');
    }
  };

  // Reset step index to 0 whenever date changes and steps refresh
  useEffect(() => {
    setActiveStepIndex(0);
    setIsPlaying(false);
  }, [selectedDate, cycleInfo.cycleType]);

  // Reset active segment index on step change
  useEffect(() => {
    setActiveSegmentIndex(0);
  }, [activeStepIndex]);

  // Smoothly scroll the active sentence into center of container
  useEffect(() => {
    const currentRef = sentenceRefs.current[activeSegmentIndex];
    if (currentRef && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const topOffset = currentRef.offsetTop - container.offsetTop - (container.clientHeight / 2) + (currentRef.clientHeight / 2);
      container.scrollTo({
        top: topOffset,
        behavior: 'smooth'
      });
    }
  }, [activeSegmentIndex]);

  // Play sound when step changes
  useEffect(() => {
    if (!soundEnabled || !activeStep) return;

    // Map prayerType to chime sound characteristics
    if (activeStep.prayerType === 'signOfCross' || activeStep.prayerType === 'creed') {
      playBeadChime('cross');
    } else if (activeStep.prayerType === 'ourFather' || activeStep.prayerType === 'mystery') {
      playBeadChime('father');
    } else if (activeStep.prayerType === 'gloryBe') {
      playBeadChime('decade');
    } else {
      playBeadChime('hail');
    }
  }, [activeStepIndex, soundEnabled, activeStep.id]);

  // Calculate text of the prayer to read
  const textToRead = useMemo(() => {
    if (!activeStep) return "";

    const stepOverrideKey = `custom_step_${activeStep.id}`;
    const stepOverride = prayers[stepOverrideKey];

    if (stepOverride) {
      // Read ONLY the custom prayer text without naming the prayer
      return stepOverride.text;
    } else if (activeStep.prayerType === 'mystery') {
      const decIdx = activeStep.decadeIndex || 1;
      const mysteryData = getActiveDecadeMystery(cycleInfo.cycleType, cycleInfo.dayOfCycle, decIdx, prayers);
      
      if (cycleInfo.cycleType === 'cycle1') {
        const parsed = parseDayText(cycleInfo.dayOfCycle, mysteryData.rgba.text);
        if (parsed.success && parsed.data) {
          return `${mysteryData.rgba.title}. ${parsed.data.reflectionText}.`;
        }
        return `${mysteryData.rgba.title}. ${mysteryData.rgba.text}.`;
      } else if (cycleInfo.cycleType === 'cycle2') {
        const largeBeadKey = `day_${cycleInfo.dayOfCycle}_large_bead_reflection_dec_${decIdx}`;
        const customLargeBead = prayers[largeBeadKey] || prayers[`large_bead_reflection_dec_${decIdx}`];
        const largeBeadText = customLargeBead ? `${customLargeBead.title}. ${customLargeBead.text}` : "";
        return `${mysteryData.rgba.title}. ${mysteryData.rgba.text}. ${largeBeadText}`;
      } else {
        return `${mysteryData.rgba.title}. ${mysteryData.rgba.text}.`;
      }
    } else if (activeStep.prayerType === 'ourFather') {
      const decIdx = activeStep.decadeIndex;
      if (cycleInfo.cycleType === 'cycle1' && decIdx) {
        const mysteryData = getActiveDecadeMystery('cycle1', cycleInfo.dayOfCycle, decIdx, prayers);
        const parsed = parseDayText(cycleInfo.dayOfCycle, mysteryData.rgba.text);
        if (parsed.success && parsed.data) {
          return parsed.data.ourFatherText;
        }
      }
      let extraText = "";
      if (decIdx) {
        const largeBeadKey = `day_${cycleInfo.dayOfCycle}_large_bead_reflection_dec_${decIdx}`;
        const customLargeBead = prayers[largeBeadKey] || prayers[`large_bead_reflection_dec_${decIdx}`];
        if (customLargeBead) {
          extraText = `${customLargeBead.text}. `;
        }
      }
      const ourFather = prayers['ourFather'] || DEFAULT_PRAYERS['ourFather'];
      return `${extraText}${ourFather.text}`;
    } else if (activeStep.prayerType === 'gloryBe') {
      const decIdx = activeStep.decadeIndex;
      if (cycleInfo.cycleType === 'cycle1' && decIdx) {
        const mysteryData = getActiveDecadeMystery('cycle1', cycleInfo.dayOfCycle, decIdx, prayers);
        const parsed = parseDayText(cycleInfo.dayOfCycle, mysteryData.rgba.text);
        if (parsed.success && parsed.data) {
          return parsed.data.gloryBeFatimaText;
        }
      }
      const glory = prayers['gloryBe'] || DEFAULT_PRAYERS['gloryBe'];
      const fatima = prayers['fatima'] || DEFAULT_PRAYERS['fatima'];
      return `${glory.text}. ${fatima.text}.`;
    } else if (activeStep.prayerType === 'hailMary' && activeStep.beadNumber && activeStep.decadeIndex && cycleInfo.cycleType === 'cycle1') {
      const decIdx = activeStep.decadeIndex;
      const mysteryData = getActiveDecadeMystery('cycle1', cycleInfo.dayOfCycle, decIdx, prayers);
      const parsed = parseDayText(cycleInfo.dayOfCycle, mysteryData.rgba.text);
      if (parsed.success && parsed.data && parsed.data.hailMaryTexts[activeStep.beadNumber - 1]) {
        return parsed.data.hailMaryTexts[activeStep.beadNumber - 1];
      }
      const currentPrayer = prayers[activeStep.prayerType] || DEFAULT_PRAYERS[activeStep.prayerType];
      return `${currentPrayer?.text || ''}.`;
    } else {
      const currentPrayer = prayers[activeStep.prayerType] || DEFAULT_PRAYERS[activeStep.prayerType];
      return `${currentPrayer?.text || ''}.`;
    }
  }, [activeStep, prayers, cycleInfo.cycleType, cycleInfo.dayOfCycle]);

  // AI TTS Narration when step changes or content is edited
  useEffect(() => {
    if (!ttsEnabled || !activeStep || !textToRead) {
      stopSpeech();
      return;
    }

    // Add a small delay (e.g. 500ms) to let the bead sound finish playing
    const timer = setTimeout(() => {
      speakText(textToRead, {
        rate: 0.95, // solemn calm pace
        pitch: 1.0,
        onSegmentStart: (index) => {
          setActiveSegmentIndex(index);
        },
        onEnd: () => {
          if (isPlayingRef.current) {
            autoAdvanceTimeoutRef.current = setTimeout(() => {
              handleNext();
            }, 1500); // 1.5 seconds gap between prayers
          }
        }
      });
    }, 500);

    return () => {
      clearTimeout(timer);
      if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
      stopSpeech();
    };
  }, [activeStepIndex, textToRead, ttsEnabled]);

  // Sync isPlaying with TTS play/pause state
  useEffect(() => {
    if (!isPlaying) {
      pauseSpeech();
    } else {
      if (isSpeechPaused()) {
        resumeSpeech();
      } else if (!isSpeechSpeaking() && ttsEnabled && textToRead) {
        // If it's not speaking (idle), trigger the reading!
        speakText(textToRead, {
          rate: 0.95,
          pitch: 1.0,
          onSegmentStart: (index) => {
            setActiveSegmentIndex(index);
          },
          onEnd: () => {
            if (isPlayingRef.current) {
              autoAdvanceTimeoutRef.current = setTimeout(() => {
                handleNext();
              }, 1500); // 1.5 seconds gap between prayers
            }
          }
        });
      }
    }
  }, [isPlaying, textToRead, ttsEnabled]);

  // If TTS is disabled, we auto-advance on a simple fallback interval
  useEffect(() => {
    if (isPlaying && !ttsEnabled) {
      const fallbackTimer = setInterval(() => {
        handleNext();
      }, 8000); // 8 seconds per bead when silent/no-TTS
      return () => clearInterval(fallbackTimer);
    }
  }, [isPlaying, ttsEnabled, activeStepIndex]);

  const handleNext = () => {
    setActiveStepIndex((prev) => (prev < steps.length - 1 ? prev + 1 : 0));
  };

  const handlePrev = () => {
    setActiveStepIndex((prev) => (prev > 0 ? prev - 1 : steps.length - 1));
  };

  const handleReset = () => {
    setActiveStepIndex(0);
    setIsPlaying(false);
  };

  const handleBeadClick = (beadId: string) => {
    const stepIdx = steps.findIndex(s => s.rgbaBeadId === beadId || s.cmykBeadId === beadId);
    if (stepIdx !== -1) {
      setActiveStepIndex(stepIdx);
      setIsPlaying(false);
    }
  };

  const handleLogin = async () => {
    setAuthErrorMsg(null);
    try {
      const resUser = await loginWithGoogle();
      if (resUser) {
        setShowAuthModal(false);
      }
    } catch (err: any) {
      if (err?.code === 'auth/unauthorized-domain') {
        setAuthErrorMsg(`Błąd autoryzacji domeny (auth/unauthorized-domain). Domena "${window.location.hostname}" nie jest jeszcze dodana w Firebase Console -> Authentication -> Settings -> Authorized Domains.`);
      } else if (err?.code === 'auth/popup-closed-by-user') {
        // user closed popup
      } else {
        setAuthErrorMsg(`Błąd logowania przez Google: ${err?.message || 'Nieznany błąd.'}`);
      }
      setShowAuthModal(true);
    }
  };

  const handleEnableLocalAuth = () => {
    localStorage.setItem('local_editor_auth', 'true');
    setLocalAuth(true);
    setShowAuthModal(false);
    setAuthErrorMsg(null);
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('local_editor_auth');
      setLocalAuth(false);
      await logout();
      setShowEditor(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Helper to determine active bead description and colors
  const getActiveBeadDetails = () => {
    const rgbaBead = rgbaBeads.find(b => b.id === activeStep.rgbaBeadId);
    const cmykBead = cmykBeads.find(b => b.id === activeStep.cmykBeadId);
    return { rgbaBead, cmykBead };
  };

  const { rgbaBead, cmykBead } = getActiveBeadDetails();

  // Helper to get active prayer text display
  const renderPrayerContent = () => {
    const isLight = theme === 'light';
    const stepOverrideKey = `custom_step_${activeStep.id}`;
    const stepOverride = prayers[stepOverrideKey];

    if (stepOverride) {
      return (
        <div className="space-y-4 text-justify">
          <div className={`p-4 sm:p-5 rounded-2xl border shadow-inner ${isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-950/20 border-emerald-800/40'}`}>
            <span className={`inline-flex items-center gap-1.5 text-xs border px-2.5 py-1 rounded-full font-bold uppercase tracking-wider font-mono ${isLight ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-emerald-950 text-emerald-400 border-emerald-800/60'}`}>
              ⭐️ Własna modlitwa dla tego paciorka
            </span>
            <h4 className={`text-lg sm:text-xl font-bold mt-3 font-sans tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {stepOverride.title}
            </h4>
            <div className={`text-base sm:text-lg leading-relaxed mt-3 font-sans text-justify ${isLight ? 'text-slate-700' : 'text-slate-100'}`}>
              <RichTextRenderer text={stepOverride.text} />
            </div>
          </div>
        </div>
      );
    }

    if (activeStep.prayerType === 'mystery') {
      const decIdx = activeStep.decadeIndex || 1;
      const mysteryData = getActiveDecadeMystery(cycleInfo.cycleType, cycleInfo.dayOfCycle, decIdx, prayers);

      if (cycleInfo.cycleType === 'cycle2') {
        const hailMaryText = prayers['hailMary'] || DEFAULT_PRAYERS['hailMary'];
        const gloryText = prayers['gloryBe'] || DEFAULT_PRAYERS['gloryBe'];
        const fatimaText = prayers['fatima'] || DEFAULT_PRAYERS['fatima'];
        
        // Large bead reflection
        const largeBeadKey = `day_${cycleInfo.dayOfCycle}_large_bead_reflection_dec_${decIdx}`;
        const customLargeBead = prayers[largeBeadKey] || prayers[`large_bead_reflection_dec_${decIdx}`];
        const largeBeadRefl = customLargeBead || {
          title: `Rozważanie na Dużym Paciorku - Dziesiątek ${decIdx}`,
          text: `Wznosimy nasze serca ku Ojcu Niebieskiemu, wielbiąc Jego niezmierzoną Opatrzność i prosząc o łaski w tym dziesiątku.`
        };

        return (
          <div className="space-y-4 mt-3">
            <div className={`p-4 sm:p-5 rounded-2xl border shadow-sm ${isLight ? 'bg-indigo-50 border-indigo-200' : 'bg-indigo-950/25 border-indigo-900/40'}`}>
              <span className={`text-xs border px-2.5 py-1 rounded-full font-semibold font-mono uppercase tracking-wide ${isLight ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-indigo-950 text-indigo-400 border-indigo-800/60'}`}>
                Rozważanie Cyklu II - Boga Ojca
              </span>
              <h4 className={`text-lg sm:text-xl font-bold mt-3 ${isLight ? 'text-slate-900' : 'text-white'}`}>{mysteryData.rgba.title}</h4>
              <div className={`text-sm sm:text-base mt-2.5 leading-relaxed text-justify ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                <RichTextRenderer text={mysteryData.rgba.text} />
              </div>
            </div>
            
            <div className={`p-4 sm:p-5 rounded-2xl border shadow-sm ${isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-950/20 border-emerald-900/30'}`}>
              <span className={`text-xs border px-2.5 py-1 rounded-full font-semibold font-mono uppercase tracking-wide ${isLight ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-emerald-950 text-emerald-400 border-emerald-800/60'}`}>
                Rozważanie na Dużym Paciorku
              </span>
              <h4 className={`text-base sm:text-lg font-bold mt-3 ${isLight ? 'text-slate-900' : 'text-white'}`}>{largeBeadRefl.title}</h4>
              <div className={`text-sm sm:text-base mt-2 leading-relaxed text-justify ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                <RichTextRenderer text={largeBeadRefl.text} />
              </div>
            </div>

            <div className={`p-4 sm:p-5 rounded-2xl border space-y-4 shadow-sm ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
              <span className={`text-xs uppercase font-mono tracking-wider block border-b pb-2 ${isLight ? 'text-slate-500 border-slate-200' : 'text-zinc-400 border-slate-800'}`}>Modlitwy na Dużym Paciorku:</span>
              <div>
                <h5 className={`text-sm sm:text-base font-bold ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>{hailMaryText.title}</h5>
                <div className={`text-sm sm:text-base leading-relaxed mt-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  <RichTextRenderer text={hailMaryText.text} />
                </div>
              </div>
              <div className={`border-t pt-3 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                <h5 className={`text-sm sm:text-base font-bold ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>Pozostałe Modlitwy ({gloryText.title} & {fatimaText.title})</h5>
                <div className={`text-sm sm:text-base leading-relaxed mt-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  <RichTextRenderer text={`${gloryText.text}\n\n${fatimaText.text}`} />
                </div>
              </div>
            </div>
          </div>
        );
      }

      // Cykl I: Traditional RHZ365 Prayer Presentation (22-step structured view)
      if (activeStep.decadeIndex) {
        const parsed = parseDayText(cycleInfo.dayOfCycle, mysteryData.rgba.text);
        if (parsed.success && parsed.data) {
          return (
            <div className="mt-3 space-y-4">
              <div className={`p-5 sm:p-6 rounded-2xl border shadow-md transition-all duration-300 ${
                isLight ? 'bg-white border-slate-200' : 'bg-slate-900/70 border-slate-800'
              }`}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className={`text-xs border px-3 py-1 rounded-full font-bold uppercase tracking-wider font-mono ${
                    isLight ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60'
                  }`}>
                    Rozważanie Tajemnicy (Dzień {cycleInfo.dayOfCycle})
                  </span>
                </div>
                <h4 className={`text-xl sm:text-2xl font-bold font-serif tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {mysteryData.rgba.title}
                </h4>
                <div className={`text-base sm:text-lg leading-relaxed mt-4 font-serif text-justify ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                  <RichTextRenderer text={parsed.data.reflectionText} />
                </div>
                <details className={`mt-6 pt-4 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                  <summary className={`cursor-pointer text-xs font-bold uppercase font-mono tracking-wider ${isLight ? 'text-slate-500 hover:text-indigo-600' : 'text-slate-400 hover:text-indigo-400'}`}>
                    Pokaż pełny tekst źródłowy wpisu z RHZ365 (Dzień {cycleInfo.dayOfCycle})
                  </summary>
                  <div className={`text-sm sm:text-base leading-relaxed mt-3 font-serif text-justify ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    <RichTextRenderer text={mysteryData.rgba.text} />
                  </div>
                </details>
              </div>
            </div>
          );
        }
      }

      return (
        <div className="mt-3">
          <div className={`p-5 sm:p-6 rounded-2xl border shadow-md transition-all duration-300 ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900/70 border-slate-800'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs border px-3 py-1 rounded-full font-bold uppercase tracking-wider font-mono ${
                isLight ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60'
              }`}>
                Rozważanie
              </span>
            </div>
            <h4 className={`text-xl sm:text-2xl font-bold font-serif tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {mysteryData.rgba.title}
            </h4>
            <div className={`text-base sm:text-lg leading-relaxed mt-4 font-serif text-justify ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
              <RichTextRenderer text={mysteryData.rgba.text} />
            </div>
          </div>
        </div>
      );
    }

    if (activeStep.prayerType === 'ourFather') {
      const ourFather = prayers['ourFather'] || DEFAULT_PRAYERS['ourFather'];
      const decIdx = activeStep.decadeIndex;
      
      let largeBeadRefl = null;
      if (decIdx) {
        const largeBeadKey = `day_${cycleInfo.dayOfCycle}_large_bead_reflection_dec_${decIdx}`;
        const customLargeBead = prayers[largeBeadKey] || prayers[`large_bead_reflection_dec_${decIdx}`];
        if (customLargeBead) {
          largeBeadRefl = customLargeBead;
        }
      }

      let textToDisplay = ourFather.text;
      if (cycleInfo.cycleType === 'cycle1' && decIdx) {
        const mysteryData = getActiveDecadeMystery('cycle1', cycleInfo.dayOfCycle, decIdx, prayers);
        const parsed = parseDayText(cycleInfo.dayOfCycle, mysteryData.rgba.text);
        if (parsed.success && parsed.data) {
          textToDisplay = parsed.data.ourFatherText;
        }
      }

      return (
        <div className="space-y-4 mt-3">
          {largeBeadRefl && (
            <div className={`p-4 sm:p-5 rounded-2xl border shadow-sm ${isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-950/20 border-emerald-900/30'}`}>
              <span className={`text-xs border px-2.5 py-1 rounded-full font-semibold font-mono uppercase tracking-wide ${isLight ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-emerald-950 text-emerald-400 border-emerald-800/60'}`}>
                Rozważanie na Dużym Paciorku
              </span>
              <h4 className={`text-base sm:text-lg font-bold mt-3 ${isLight ? 'text-slate-900' : 'text-white'}`}>{largeBeadRefl.title}</h4>
              <div className={`text-sm sm:text-base mt-2 leading-relaxed text-justify ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                <RichTextRenderer text={largeBeadRefl.text} />
              </div>
            </div>
          )}
          <div className={`p-4 sm:p-5 rounded-2xl border shadow-sm ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-slate-800/50'}`}>
            <h4 className={`text-xs sm:text-sm font-semibold uppercase tracking-wider mb-2 border-b pb-1.5 ${isLight ? 'text-slate-600 border-slate-200' : 'text-slate-400 border-slate-800'}`}>
              {ourFather.title}
            </h4>
            <div className={`text-base sm:text-lg leading-relaxed font-sans text-justify ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>
              <RichTextRenderer text={textToDisplay} />
            </div>
          </div>
        </div>
      );
    }

    if (activeStep.prayerType === 'gloryBe') {
      const glory = prayers['gloryBe'] || DEFAULT_PRAYERS['gloryBe'];
      const fatima = prayers['fatima'] || DEFAULT_PRAYERS['fatima'];
      const decIdx = activeStep.decadeIndex;

      let textToDisplay = `${glory.text}\n\n${fatima.text}`;
      if (cycleInfo.cycleType === 'cycle1' && decIdx) {
        const mysteryData = getActiveDecadeMystery('cycle1', cycleInfo.dayOfCycle, decIdx, prayers);
        const parsed = parseDayText(cycleInfo.dayOfCycle, mysteryData.rgba.text);
        if (parsed.success && parsed.data) {
          textToDisplay = parsed.data.gloryBeFatimaText;
        }
      }

      return (
        <div className="space-y-4 mt-3">
          <div className={`p-4 sm:p-5 rounded-2xl border shadow-sm ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-slate-800/50'}`}>
            <h4 className={`text-xs sm:text-sm font-semibold uppercase tracking-wider mb-2 border-b pb-1.5 ${isLight ? 'text-slate-600 border-slate-200' : 'text-slate-400 border-slate-800'}`}>{glory.title} & {fatima.title}</h4>
            <div className={`text-base sm:text-lg leading-relaxed text-justify ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>
              <RichTextRenderer text={textToDisplay} />
            </div>
          </div>
        </div>
      );
    }

    if (activeStep.prayerType === 'hailMary' && activeStep.beadNumber && activeStep.decadeIndex && cycleInfo.cycleType === 'cycle1') {
      const decIdx = activeStep.decadeIndex;
      const mysteryData = getActiveDecadeMystery('cycle1', cycleInfo.dayOfCycle, decIdx, prayers);
      const parsed = parseDayText(cycleInfo.dayOfCycle, mysteryData.rgba.text);

      if (parsed.success && parsed.data && parsed.data.hailMaryTexts[activeStep.beadNumber - 1]) {
        const specificHailText = parsed.data.hailMaryTexts[activeStep.beadNumber - 1];
        return (
          <div className={`mt-3 p-4 sm:p-5 rounded-2xl border shadow-sm ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-slate-800/50'}`}>
            <div className="flex items-center justify-between border-b pb-2 mb-3">
              <h4 className={`text-xs sm:text-sm font-semibold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Zdrowaś Maryjo ({activeStep.beadNumber} z 10)
              </h4>
              <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full ${isLight ? 'bg-indigo-100 text-indigo-800' : 'bg-indigo-950 text-indigo-300'}`}>
                Zdrowaś Maryjo #{activeStep.beadNumber}
              </span>
            </div>
            <div className={`text-base sm:text-lg leading-relaxed font-serif text-justify ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>
              <RichTextRenderer text={specificHailText} />
            </div>
          </div>
        );
      }
    }

    const currentPrayer = prayers[activeStep.prayerType] || DEFAULT_PRAYERS[activeStep.prayerType];
    return (
      <div className={`mt-3 p-4 sm:p-5 rounded-2xl border shadow-sm ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-slate-800/50'}`}>
        <h4 className={`text-xs sm:text-sm font-semibold uppercase tracking-wider mb-2 border-b pb-1.5 ${isLight ? 'text-slate-600 border-slate-200' : 'text-slate-400 border-slate-800'}`}>
          {currentPrayer?.title}
        </h4>
        <div className={`text-base sm:text-lg leading-relaxed font-sans text-justify ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>
          <RichTextRenderer text={currentPrayer?.text || ''} />
        </div>
      </div>
    );
  };

  // Helper to determine letter on a large separator bead
  const getSeparatorLetter = (id: string) => {
    if (id.includes('rgba-sep1')) return 'L/R';
    if (id.includes('rgba-sep2')) return 'O/G';
    if (id.includes('rgba-sep3')) return 'V/B';
    if (id.includes('rgba-sep4')) return 'E/A';
    if (id.includes('cmyk-sep1')) return 'H/C';
    if (id.includes('cmyk-sep2')) return 'A/M';
    if (id.includes('cmyk-sep3')) return 'T/Y';
    if (id.includes('cmyk-sep4')) return 'E/K';
    return null;
  };

  const getBeadWindow = (beadsList: any[], activeId: string) => {
    const activeIndex = beadsList.findIndex(b => b.id === activeId);
    return [-2, -1, 0, 1, 2].map(offset => {
      const idx = activeIndex + offset;
      if (activeIndex === -1 || idx < 0 || idx >= beadsList.length) {
        return null;
      }
      return beadsList[idx];
    });
  };

  const rgbaBeadWindow = getBeadWindow(rgbaBeads, activeStep.rgbaBeadId);
  const cmykBeadWindow = getBeadWindow(cmykBeads, activeStep.cmykBeadId);

  // Split active prayer text into sentences for teleprompter/karaoke scrolling
  const prayerSegments = useMemo(() => {
    if (!textToRead) return [];
    const cleanText = textToRead.replace(/[\[\]]/g, '').trim();
    if (!cleanText) return [];
    const sentenceRegex = /[^.!?;\n]+[.!?;\n]*/g;
    return (cleanText.match(sentenceRegex) || [cleanText])
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }, [textToRead]);

  const renderStripBead = (bead: any | null, isActive: boolean, isRgba: boolean) => {
    if (bead && bead.type === 'connector') {
      return null;
    }

    if (!bead) {
      return (
        <div className="w-12 h-12 rounded-full border border-dashed border-slate-800 flex items-center justify-center opacity-25 select-none">
          <span className="text-[10px] text-slate-600 font-mono">-</span>
        </div>
      );
    }

    const colorStyles: Record<string, string> = {
      white: "from-white via-slate-100 to-slate-300 border-slate-200 text-slate-800",
      black: "from-slate-700 via-zinc-800 to-zinc-950 border-zinc-700 text-slate-300",
      red: "from-red-400 via-red-600 to-red-900 border-red-500 text-white",
      green: "from-emerald-400 via-emerald-600 to-emerald-900 border-emerald-500 text-white",
      blue: "from-blue-400 via-blue-600 to-blue-900 border-blue-500 text-white",
      cyan: "from-cyan-400 via-cyan-600 to-cyan-900 border-cyan-500 text-white",
      magenta: "from-fuchsia-400 via-fuchsia-600 to-fuchsia-900 border-fuchsia-500 text-white",
      yellow: "from-amber-300 via-amber-500 to-amber-700 border-amber-400 text-slate-900",
    };

    const isSeparator = bead.type === 'decade-separator';
    let bgClass = bead.colorType === 'transparent'
      ? (isRgba ? "bg-sky-500/10 border-sky-400 text-sky-400" : "bg-amber-500/10 border-amber-400 text-amber-400")
      : `bg-gradient-to-br ${colorStyles[bead.colorType] || 'from-slate-500 to-slate-700'}`;

    let sizeClass = isActive ? "w-16 h-16 text-sm" : "w-11 h-11 text-xs";
    let activeBorderClass = isActive 
      ? (isRgba ? "border-4 border-sky-400 ring-4 ring-sky-500/35 scale-110" : "border-4 border-amber-400 ring-4 ring-amber-500/35 scale-110")
      : "border border-slate-700 hover:border-slate-500";

    const letter = getSeparatorLetter(bead.id);
    const isCross = bead.type === 'cross';
    const isConnector = bead.type === 'connector';

    let innerContent = null;
    if (isCross) {
      innerContent = <span className="font-bold font-serif text-lg">†</span>;
      bgClass = isRgba 
        ? "bg-gradient-to-br from-slate-200 via-slate-400 to-slate-500 border-slate-300 text-slate-900"
        : "bg-gradient-to-br from-slate-700 via-zinc-800 to-zinc-950 border-zinc-700 text-slate-200";
    } else if (isConnector) {
      innerContent = <span className="text-[10px] font-black">IHS</span>;
      bgClass = isRgba
        ? "bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 border-slate-300 text-slate-800"
        : "bg-gradient-to-br from-amber-300 via-amber-500 to-amber-600 border-amber-400 text-amber-950";
    } else if (letter) {
      innerContent = <span className="font-mono font-black text-[11px] tracking-tighter">{letter}</span>;
    } else if (isSeparator) {
      innerContent = <span className="text-[8px] font-semibold opacity-80">SEP</span>;
    }

    return (
      <div className="relative flex flex-col items-center">
        {isActive && (
          <div className={`absolute inset-0 rounded-full blur-md opacity-70 animate-pulse ${
            isRgba ? 'bg-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.8)]' : 'bg-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.8)]'
          }`} />
        )}
        
        <div className={`rounded-full flex items-center justify-center shadow-lg transition-all duration-300 relative z-10 select-none ${sizeClass} ${bgClass} ${activeBorderClass}`}>
          {innerContent}
        </div>

        {isActive && (
          <span className={`absolute top-full mt-1.5 text-[8px] font-mono font-bold tracking-wider uppercase bg-slate-900 border px-1 rounded z-20 ${
            isRgba ? 'text-sky-400 border-sky-500/30' : 'text-amber-400 border-amber-500/30'
          }`}>
            {isCross ? 'Krzyż' : isConnector ? 'Kielich' : isSeparator ? 'Separator' : `Paciorek`}
          </span>
        )}
      </div>
    );
  };

  const isLight = theme === 'light';

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-300 w-full max-w-full overflow-x-hidden ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'
    }`}>
      {/* HEADER BAR (Hidden in strict YouTube Record Mode) */}
      {!isYoutubeMode && (
        <header id="main-header" className={`border-b backdrop-blur-md sticky top-0 z-50 py-2.5 px-2.5 sm:px-6 w-full max-w-full overflow-hidden shrink-0 transition-colors duration-300 ${
          isLight ? 'border-slate-200 bg-white/95 text-slate-900 shadow-sm' : 'border-slate-800 bg-slate-950/90 text-white'
        }`}>
          {/* LINE 0: LOGOTYP Z NAZWĄ STRONY NA SAMEJ GÓRZE */}
          <div className="flex items-center justify-center sm:justify-between w-full border-b pb-2 mb-2 border-slate-200/50 dark:border-slate-800/50">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-sky-400 via-indigo-500 to-amber-400 flex items-center justify-center font-black text-xs text-slate-950 shrink-0 shadow-md">
                M
              </div>
              <div className="min-w-0 truncate">
                <h1 className={`text-sm sm:text-lg font-bold tracking-tight flex items-center gap-1.5 sm:gap-2 truncate ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}>
                  <span className="bg-gradient-to-r from-sky-400 via-indigo-500 to-amber-500 bg-clip-text text-transparent font-black tracking-wide">eMBiK365</span>
                  <span className={`${isLight ? 'text-slate-300' : 'text-slate-600'} text-xs`}>•</span>
                  <span className={`text-xs sm:text-sm font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>RHZ365 & WnR365</span>
                  <span className={`text-[10px] font-normal hidden xs:inline ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>v2.5</span>
                </h1>
              </div>
            </div>
          </div>

          {/* NAWIGACJA W DWÓCH LINIACH DLA MOBILNYCH (ZARAZ POD LOGOTYPEM) */}
          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-1.5 sm:gap-2 w-full max-w-full">
            
            {/* LINIA 1 NAWIGACJI: Wyszukaj, Udostępnij, Eksport */}
            <div className="grid grid-cols-3 sm:flex items-center justify-center gap-1.5 w-full sm:w-auto max-w-full">
              {/* Search Button (Lupa) */}
              <button
                onClick={() => setShowSearchModal(true)}
                title="Wyszukaj w RHZ365 & WnR365"
                className={`px-2 py-1.5 rounded-full border transition cursor-pointer flex items-center justify-center gap-1 text-[11px] sm:text-xs font-semibold w-full sm:w-auto min-w-0 ${
                  isLight 
                    ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 shadow-sm' 
                    : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60 hover:bg-indigo-900/60'
                }`}
              >
                <Search className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">Szukaj</span>
              </button>

              {/* Share Button */}
              <button
                onClick={handleShare}
                title="Udostępnij bezpośredni link do tego wpisu"
                className={`px-2 py-1.5 rounded-full border transition cursor-pointer flex items-center justify-center gap-1 text-[11px] sm:text-xs font-semibold w-full sm:w-auto min-w-0 ${
                  copiedLink
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                    : isLight
                      ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-white shrink-0" /> : <Share2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                <span className="truncate">{copiedLink ? 'OK' : 'Link'}</span>
              </button>

              {/* Export PDF/JSON Button */}
              <button
                onClick={() => setShowCustomExportModal(true)}
                title="Eksport PDF & JSON"
                className={`px-2 py-1.5 rounded-full border transition cursor-pointer flex items-center justify-center gap-1 text-[11px] sm:text-xs font-semibold w-full sm:w-auto min-w-0 ${
                  isLight
                    ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    : 'bg-slate-800/80 text-amber-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <FileDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">Eksport</span>
              </button>
            </div>

            {/* LINIA 2 NAWIGACJI: PWA App, Motyw, Logowanie Google / Edytor */}
            <div className="grid grid-cols-3 sm:flex items-center justify-center gap-1.5 w-full sm:w-auto max-w-full">
              {/* PWA Install Trigger Button */}
              <button
                onClick={() => setShowPwaPromptModal(true)}
                title="Zainstaluj aplikację eMBiK365 na telefonie lub komputerze (PWA)"
                className={`px-2 py-1.5 rounded-full border transition cursor-pointer flex items-center justify-center gap-1 text-[11px] sm:text-xs font-semibold w-full sm:w-auto min-w-0 ${
                  isLight
                    ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                    : 'bg-sky-950/60 text-sky-300 border-sky-800/60 hover:bg-sky-900/60'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate">PWA</span>
              </button>

              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                title={isLight ? "Przełącz na tryb ciemny" : "Przełącz na tryb jasny"}
                className={`px-2 py-1.5 rounded-full border transition cursor-pointer flex items-center justify-center gap-1 text-[11px] sm:text-xs font-semibold w-full sm:w-auto min-w-0 ${
                  isLight 
                    ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' 
                    : 'bg-slate-800/80 text-yellow-400 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {isLight ? <Moon className="w-3.5 h-3.5 shrink-0" /> : <Sun className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">{isLight ? 'Ciemny' : 'Jasny'}</span>
              </button>

              {isAuthorized ? (
                <div className={`flex items-center justify-center gap-1 p-1 px-1.5 rounded-full border transition-colors w-full sm:w-auto min-w-0 ${
                  isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-slate-800/50 border-slate-700 text-slate-300'
                }`}>
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className={`w-4 h-4 rounded-full border shrink-0 ${isLight ? 'border-slate-300' : 'border-slate-600'}`} referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                      {(userEmail || 'E').charAt(0).toUpperCase()}
                    </div>
                  )}
                  {isAuthorized && (
                    <button
                      onClick={() => setShowEditor(!showEditor)}
                      className={`px-1.5 py-0.5 rounded-full transition flex items-center justify-center gap-0.5 text-[10px] font-semibold cursor-pointer shrink-0 ${
                        showEditor 
                          ? 'bg-emerald-600/80 text-white hover:bg-emerald-500/90' 
                          : isLight
                            ? 'bg-slate-200 text-slate-700 hover:bg-slate-350 border border-slate-300'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600'
                      }`}
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                      <span>{showEditor ? 'Podgląd' : 'Edytor'}</span>
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    title="Wyloguj się"
                    className="p-0.5 bg-indigo-600/10 text-indigo-500 hover:bg-indigo-600/20 rounded transition-colors cursor-pointer shrink-0"
                  >
                    <LogOut className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  className={`px-2 py-1.5 border text-[11px] sm:text-xs font-semibold rounded-full transition active:scale-95 cursor-pointer flex items-center justify-center gap-1 w-full sm:w-auto min-w-0 ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700 shadow-sm'
                      : 'bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">Zaloguj</span>
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* DETAILED CONTENT AREA */}
      <main className={`flex-1 flex flex-col items-center justify-center p-3 sm:p-6 w-full max-w-full overflow-x-hidden transition-colors duration-300 ${
        isLight ? 'bg-slate-50' : 'bg-slate-950'
      }`}>

        {/* Introductory Section — Wstęp */}
        {!isYoutubeMode && (
          <div className={`w-full max-w-7xl mb-5 rounded-2xl overflow-hidden border transition-all duration-300 shadow-lg ${
            isLight
              ? 'bg-white border-slate-200 shadow-slate-100'
              : 'bg-slate-900/50 border-slate-800'
          }`}>
            {/* Decorative top gradient bar */}
            <div className="h-1 w-full bg-gradient-to-r from-sky-400 via-indigo-500 to-amber-400" />
            <div className="p-5 sm:p-6 relative overflow-hidden">
              {/* Background subtle cross motif */}
              <div className="absolute inset-0 pointer-events-none select-none flex items-center justify-end pr-6 opacity-[0.04]">
                <span className="font-serif text-[120px] leading-none">†</span>
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className={`text-[10px] font-mono uppercase tracking-widest font-bold px-2.5 py-0.5 rounded-full border ${
                    isLight
                      ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                      : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/50'
                  }`}>Wstęp</span>
                </div>
                <p className={`text-sm sm:text-base leading-relaxed font-serif transition-colors duration-300 ${
                  isLight ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  <span className={`font-bold not-italic ${isLight ? 'text-slate-900' : 'text-white'}`}>„Widoki na Raj"</span> to owoc duchowej pielgrzymki i codziennego poszukiwania Jezusa w tajemnicach Boga, prowadzonej zgodnie z{' '}
                  <span className={`font-semibold ${isLight ? 'text-indigo-700' : 'text-indigo-300'}`}>Misją Barw i Kolorów</span>. Nie jestem teologiem, osobą duchowną ani autorytetem w sprawach wiary. Jestem jedynie pielgrzymem, który dzieli się własnym doświadczeniem, przemyśleniami i modlitwą.
                </p>
                <p className={`text-sm sm:text-base leading-relaxed font-serif mt-3 transition-colors duration-300 ${
                  isLight ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  <strong className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-400 font-extrabold font-sans not-italic">WnR365</strong>{' '}
                  <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>oznacza „Widoki na Raj" – rozważania na każdy dzień roku,</span>{' '}
                  <strong className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-indigo-500 font-extrabold font-sans not-italic">RHZ365</strong>{' '}
                  <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>to „Różaniec Historii Zbawienia" obejmujący 365 dni modlitwy, natomiast</span>{' '}
                  <strong className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 via-indigo-500 to-amber-500 font-extrabold font-sans not-italic">eMBiK365</strong>{' '}
                  <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>jest wspólnym dziełem moim i mojej żony.</span>
                </p>
                <p className={`text-sm sm:text-base leading-relaxed font-serif mt-3 transition-colors duration-300 ${
                  isLight ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  Pragniemy razem wzrastać w wierze, trwając w jedności z{' '}
                  <span className={`font-semibold ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>Bogiem Ojcem</span>, przez{' '}
                  <span className={`font-semibold ${isLight ? 'text-sky-600' : 'text-sky-300'}`}>Ducha Świętego</span>, w Osobie{' '}
                  <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Jezusa Chrystusa, Pana naszego</span>. Amen.
                </p>
              </div>
            </div>
            {/* Decorative bottom gradient bar */}
            <div className="h-0.5 w-full bg-gradient-to-r from-amber-400 via-indigo-500 to-sky-400 opacity-40" />
          </div>
        )}

        {/* eMBiK Mission Statement Banner */}
        {!isYoutubeMode && (
          <div className={`w-full max-w-7xl mb-6 p-4.5 rounded-2xl shadow-md text-center relative overflow-hidden border transition-all duration-300 ${
            isLight 
              ? 'bg-white border-slate-200/80 shadow-slate-100' 
              : 'bg-slate-900/40 border-slate-800/80'
          }`}>
            <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 via-transparent to-amber-500/5 pointer-events-none" />
            <p className={`text-xs sm:text-sm leading-relaxed font-serif transition-colors duration-300 ${
              isLight ? 'text-slate-700' : 'text-slate-300'
            }`}>
              <strong className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 via-indigo-500 to-amber-500 font-extrabold font-sans not-italic">eMBiK365</strong> (elektronicznej Misji Barw i Kolorów) poprzez duchowe pielgrzymowanie przez <span className={`${isLight ? 'text-slate-900' : 'text-white'} font-bold`}>Jezusa Chrystusa</span> w <span className={`${isLight ? 'text-sky-600' : 'text-sky-300'} font-semibold`}>Duchu Świętym</span> dzięki <span className={`${isLight ? 'text-amber-600' : 'text-amber-300'} font-semibold`}>Bogu Ojcu</span> i <span className={`${isLight ? 'text-rose-600' : 'text-rose-300'} font-semibold`}>Maryi zawsze dziewicy</span>.
            </p>
          </div>
        )}

        {/* aledom.widokinaraj.pl Banner */}
        {!isYoutubeMode && (
          <a
            href="https://aledom.widokinaraj.pl"
            target="_blank"
            rel="noopener noreferrer"
            className={`w-full max-w-7xl mb-6 group block rounded-2xl overflow-hidden shadow-lg border transition-all duration-300 hover:scale-[1.015] hover:shadow-xl ${
              isLight
                ? 'border-sky-200 shadow-sky-100'
                : 'border-sky-800/60 shadow-sky-950'
            }`}
            style={{ textDecoration: 'none' }}
          >
            {/* Top gradient accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-sky-400 to-indigo-500" />
            <div className={`relative flex flex-col sm:flex-row items-center gap-4 px-5 py-4 sm:py-5 transition-colors duration-300 ${
              isLight
                ? 'bg-gradient-to-r from-sky-50 via-white to-indigo-50'
                : 'bg-gradient-to-r from-sky-950/50 via-slate-900/60 to-indigo-950/50'
            }`}>
              {/* Decorative glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 via-transparent to-indigo-500/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              {/* Icon / Logo area */}
              <div className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner border ${
                isLight
                  ? 'bg-sky-100 border-sky-200 text-sky-600'
                  : 'bg-sky-900/50 border-sky-700/50 text-sky-300'
              }`}>
                🏠
              </div>
              {/* Text content */}
              <div className="flex-1 text-center sm:text-left relative z-10">
                <p className={`text-[10px] sm:text-xs font-mono uppercase tracking-widest font-bold mb-0.5 ${
                  isLight ? 'text-sky-500' : 'text-sky-400'
                }`}>Widoki na Raj — Portal</p>
                <p className={`text-base sm:text-lg font-extrabold font-sans tracking-tight ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}>
                  aledom.widokinaraj.pl
                </p>
                <p className={`text-xs sm:text-sm mt-0.5 font-serif ${
                  isLight ? 'text-slate-600' : 'text-slate-400'
                }`}>
                  Ale Dom! – duchowe treści, rozważania i modlitwy na każdy dzień roku
                </p>
              </div>
              {/* CTA arrow */}
              <div className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-200 group-hover:gap-2.5 ${
                isLight
                  ? 'bg-sky-600 text-white shadow-sm group-hover:bg-sky-700'
                  : 'bg-sky-600/80 text-white shadow-sm group-hover:bg-sky-500'
              }`}>
                Odwiedź
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </div>
            {/* Bottom accent bar */}
            <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 via-sky-400 to-amber-400 opacity-50" />
          </a>
        )}

        {/* TAB SWITCHER (Only in standard mode) */}
        {!isYoutubeMode && (
          <div id="app-tab-navigation" className={`w-full max-w-7xl mb-6 p-1 sm:p-1.5 rounded-2xl flex flex-col sm:flex-row gap-1.5 sm:gap-2 border transition-all duration-300 w-full max-w-full overflow-hidden ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/40 border-slate-800/60'
          }`}>
            <button
              id="tab-rosary-trigger"
              onClick={() => setActiveTab('rosary')}
              className={`flex-1 py-2.5 sm:py-3 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 min-w-0 w-full max-w-full ${
                activeTab === 'rosary'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg font-black'
                  : isLight 
                    ? 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Volume2 className="w-4 h-4 shrink-0 text-sky-500" />
              <span className="hidden sm:inline">RHZ365 — RÓŻANIEC HISTORII ZBAWIENIA (365 DNI)</span>
              <span className="inline sm:hidden truncate">RHZ365 RÓŻANIEC</span>
            </button>
            <button
              id="tab-blog-trigger"
              onClick={() => setActiveTab('blog')}
              className={`flex-1 py-2.5 sm:py-3 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 min-w-0 w-full max-w-full ${
                activeTab === 'blog'
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg font-black'
                  : isLight 
                    ? 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0 text-amber-500" />
              <span className="hidden sm:inline">WnR365 — BLOG WIDOKI NA RAJ</span>
              <span className="inline sm:hidden truncate">WnR365 BLOG</span>
            </button>
          </div>
        )}

        {activeTab === 'rosary' ? (
          /* WERSJA MINIMALISTYCZNA FRAME */
          isYoutubeMode ? (
          <div id="youtube-frame" className="w-full max-w-5xl min-h-[480px] sm:min-h-0 sm:aspect-video bg-slate-950 border-2 sm:border-4 border-slate-800 rounded-2xl shadow-2xl relative flex flex-col justify-between overflow-hidden mx-auto">
            {/* Top status bar of minimalist view */}
            <div className="bg-slate-900/90 backdrop-blur-md px-3 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row items-center justify-between border-b border-slate-800 gap-2 w-full max-w-full overflow-hidden text-center sm:text-left">
              <div className="flex items-center justify-center gap-2 min-w-0 max-w-full">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse shrink-0"></span>
                <span className="text-[10px] sm:text-xs font-mono tracking-widest text-slate-300 uppercase truncate">
                  {cycleInfo.cycleName}
                </span>
              </div>
              <div className="text-[10px] sm:text-xs font-bold text-slate-300 bg-slate-800 px-3 py-1 rounded-full font-mono truncate max-w-full">
                {activeStep.label}
              </div>
              <button
                onClick={() => setIsYoutubeMode(false)}
                className="text-[9px] sm:text-[10px] bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800 px-2.5 py-1 rounded font-mono transition cursor-pointer shrink-0"
              >
                WYJDŹ Z WERSJI MINIMALISTYCZNEJ (ESC)
              </button>
            </div>

            {/* Inner row containing the unrolled bead strips and centered scrolling prayer text */}
            <div className="flex-1 grid grid-cols-12 items-stretch px-2 sm:px-6 relative bg-slate-950 h-full overflow-hidden">
              {/* LEFT COLUMN: RGBA Vertical Strip (Hidden on mobile < 640px) */}
              <div className="hidden sm:flex col-span-2 flex-col items-center justify-center relative py-6 border-r border-slate-900/40">
                <div className="absolute top-2 text-[8px] font-mono font-bold tracking-widest text-sky-400">
                  RGBA
                </div>
                {/* Vertical line acting as the rosary thread */}
                <div className="absolute top-8 bottom-8 w-[1.5px] bg-gradient-to-b from-transparent via-sky-500/20 to-transparent z-0 border-r border-dashed border-sky-400/20" />
                
                {/* Bead list */}
                <div className="flex flex-col items-center justify-between h-[80%] max-h-[300px] relative z-10 w-full">
                  {rgbaBeadWindow.map((bead, index) => (
                    <div key={index} className="transition-all duration-300">
                      {renderStripBead(bead, index === 2, true)}
                    </div>
                  ))}
                </div>
              </div>

              {/* MIDDLE COLUMN: Auto-scrolling Prayer Text */}
              <div className="col-span-12 sm:col-span-8 flex flex-col justify-center px-2 sm:px-6 py-4 h-full text-center relative overflow-hidden">
                {/* Active step details / header */}
                <div className="mb-2 text-center shrink-0">
                  <span className="text-[9px] text-indigo-400 uppercase tracking-widest font-mono font-black mb-0.5 block">
                    {activeStep.label}
                  </span>
                  <h3 className="text-base sm:text-xl font-serif text-white tracking-tight leading-tight">
                    {activeStep.prayerType === 'mystery' 
                      ? `TAJEMNICA ${activeStep.decadeIndex}`
                      : prayers[activeStep.prayerType]?.title || DEFAULT_PRAYERS[activeStep.prayerType]?.title}
                  </h3>
                </div>

                {/* Auto-scrolling text container */}
                <div 
                  ref={scrollContainerRef}
                  className="flex-1 overflow-y-auto max-h-[190px] pr-2 custom-scrollbar flex flex-col items-center gap-3 scroll-smooth py-16"
                  style={{ maskImage: 'linear-gradient(to bottom, transparent, white 20%, white 80%, transparent)' }}
                >
                  {prayerSegments.map((seg, sIdx) => {
                    const isCurrent = sIdx === activeSegmentIndex;
                    return (
                      <p
                        key={sIdx}
                        ref={el => { sentenceRefs.current[sIdx] = el; }}
                        className={`text-sm sm:text-base transition-all duration-500 text-center leading-relaxed font-sans max-w-2xl px-2 ${
                          isCurrent 
                            ? "text-yellow-400 font-bold scale-105 drop-shadow-[0_2px_6px_rgba(234,179,8,0.4)]" 
                            : "text-slate-400 opacity-30 hover:opacity-50"
                        }`}
                      >
                        {seg}
                      </p>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT COLUMN: CMYK Vertical Strip (Hidden on mobile < 640px) */}
              <div className="hidden sm:flex col-span-2 flex-col items-center justify-center relative py-6 border-l border-slate-900/40">
                <div className="absolute top-2 text-[8px] font-mono font-bold tracking-widest text-amber-400">
                  CMYK
                </div>
                {/* Vertical line acting as the rosary thread */}
                <div className="absolute top-8 bottom-8 w-[1.5px] bg-gradient-to-b from-transparent via-amber-500/20 to-transparent z-0 border-r border-dashed border-amber-400/20" />
                
                {/* Bead list */}
                <div className="flex flex-col items-center justify-between h-[80%] max-h-[300px] relative z-10 w-full">
                  {cmykBeadWindow.map((bead, index) => (
                    <div key={index} className="transition-all duration-300">
                      {renderStripBead(bead, index === 2, false)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom playback control bar of YouTube Frame */}
            <div className="bg-slate-900/80 backdrop-blur-md px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-center justify-between border-t border-slate-800 gap-3 w-full max-w-full overflow-hidden">
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={handlePrev}
                  className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition active:scale-90 cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-2 sm:p-2.5 bg-indigo-600 text-white hover:bg-indigo-500 rounded-full transition active:scale-95 shadow-md flex items-center justify-center cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                </button>
                <button
                  onClick={handleNext}
                  className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition active:scale-90 cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setTtsEnabled(!ttsEnabled)}
                  title={ttsEnabled ? "Wyłącz lektora AI TTS" : "Włącz lektora AI TTS"}
                  className={`p-1.5 sm:p-2 rounded-full border transition cursor-pointer flex items-center justify-center ml-2 ${
                    ttsEnabled 
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50 hover:bg-emerald-900/30' 
                      : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-400'
                  }`}
                >
                  {ttsEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
              </div>

              {/* Delay and Progress Indicators */}
              <div className="flex items-center justify-center gap-3 w-full sm:w-auto">
                <div className="h-2 flex-1 sm:w-32 bg-slate-800 rounded-full overflow-hidden min-w-[80px]">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${((activeStepIndex + 1) / steps.length) * 100}%` }}
                  ></div>
                </div>
                <span className="text-xs font-mono text-slate-400 shrink-0">
                  {activeStepIndex + 1} / {steps.length}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* STANDARD FULL WORKSPACE LAYOUT */
          <div className="w-full max-w-7xl flex flex-col gap-8">
            
            {/* LITURGICAL CYCLE & DATE PICKER */}
            <div className={`border rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl transition-all duration-300 ${
              isLight 
                ? 'bg-white border-slate-200 shadow-slate-100' 
                : 'bg-slate-900/40 border-slate-800/60'
            }`}>
              <div className="flex items-center gap-4 text-left w-full md:w-auto">
                <div className={`p-3 rounded-xl shrink-0 border ${
                  isLight 
                    ? 'bg-indigo-50 border-indigo-100 text-indigo-600' 
                    : 'bg-indigo-950/50 border-indigo-900/50 text-indigo-400'
                }`}>
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <span className={`text-[10px] font-mono tracking-widest uppercase block ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}>AKTUALNY DZIEŃ LITURGICZNY</span>
                  <h2 className={`text-base sm:text-lg font-serif font-bold leading-tight ${isLight ? 'text-slate-950' : 'text-white'}`}>
                    {cycleInfo.cycleName}
                  </h2>
                  <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {(cycleInfo.cycleType === 'cycle1' || cycleInfo.cycleType === 'cycle2') && (
                      <>Tajemnica dnia: <strong>{getDecadeForDay(cycleInfo.dayOfCycle)}</strong> z 5 &nbsp;•&nbsp; </>
                    )}
                    Okres uniwersalny: od 25 grudnia do 24 grudnia (niezależny od roku)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-end flex-wrap sm:flex-nowrap">
                <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                <span className={`text-xs font-mono ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>WYBÓR DNIA:</span>
                
                {/* Day selector dropdown */}
                <select
                  value={selectedDate.getDate()}
                  onChange={(e) => handleDayChange(Number(e.target.value))}
                  className={`border text-xs px-2.5 py-2 rounded-xl focus:outline-none cursor-pointer transition ${
                    isLight 
                      ? 'bg-white border-slate-300 text-slate-800 hover:border-slate-400 shadow-sm' 
                      : 'bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-200'
                  }`}
                >
                  {Array.from({ length: getDaysInMonth(selectedDate.getMonth()) }, (_, idx) => idx + 1).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                {/* Month selector dropdown */}
                <select
                  value={selectedDate.getMonth()}
                  onChange={(e) => handleMonthChange(Number(e.target.value))}
                  className={`border text-xs px-2.5 py-2 rounded-xl focus:outline-none cursor-pointer transition ${
                    isLight 
                      ? 'bg-white border-slate-300 text-slate-800 hover:border-slate-400 shadow-sm' 
                      : 'bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-200'
                  }`}
                >
                  {POLISH_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    setSelectedDate(getInitialUniversalDate());
                  }}
                  className={`px-3 py-2 text-xs rounded-xl font-semibold transition cursor-pointer border ${
                    isLight 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' 
                      : 'bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border-indigo-800/40'
                  }`}
                >
                  Dzisiaj
                </button>
                <button
                  onClick={() => setShowCustomExportModal(true)}
                  disabled={isExportingPdf}
                  className={`px-3 py-2 border text-xs rounded-xl font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    isExportingPdf
                      ? isLight
                        ? 'bg-amber-50 text-amber-500 border-amber-200 cursor-not-allowed'
                        : 'bg-amber-900/20 text-amber-500 border-amber-900/30 cursor-not-allowed'
                      : isLight
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border-emerald-800/40'
                  }`}
                  title="Eksportuj rozważania i schemat eMBiK365 do pliku PDF lub EPUB"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Eksport PDF & EPUB</span>
                </button>
              </div>
            </div>

            <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* COLUMN 1: INTERACTIVE ROSARY DISPLAY */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className={`border rounded-2xl p-4 shadow-xl transition-all duration-300 ${
                  isLight ? 'bg-white border-slate-200 shadow-slate-100' : 'bg-slate-900/40 border-slate-800/50'
                }`}>
                  <RosaryRenderer
                    rgbaBeads={rgbaBeads}
                    cmykBeads={cmykBeads}
                    activeRgbaId={activeStep.rgbaBeadId}
                    activeCmykId={activeStep.cmykBeadId}
                    onBeadClick={handleBeadClick}
                    theme={theme}
                  />
                </div>

                {/* Color Details Card */}
                <div className={`border rounded-2xl p-5 shadow-lg transition-colors duration-300 ${
                  isLight ? 'bg-white border-slate-200 shadow-slate-100 text-slate-900' : 'bg-slate-900/30 border-slate-800/40 text-slate-100'
                }`}>
                  <h3 className={`text-sm font-bold flex items-center gap-2 mb-3 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    <Sliders className="w-4 h-4 text-indigo-500" />
                    Specyfikacja Paciorka i Reprezentacja Barwna
                  </h3>
                  <div className="text-xs">
                    <div className={`p-4 rounded-xl border transition-colors duration-300 ${
                      isLight ? 'bg-slate-50 border-slate-200/80 text-slate-800' : 'bg-slate-950/60 border-slate-800/60 text-slate-200'
                    }`}>
                      <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase block mb-1">RÓŻANIEC — SYMBOLIKA PACIORKA</span>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`w-3.5 h-3.5 rounded-full border ${isLight ? 'border-slate-300' : 'border-slate-700'}`} style={{
                          backgroundColor: rgbaBead?.colorType === 'transparent' ? 'transparent' : rgbaBead?.colorType,
                          boxShadow: rgbaBead?.colorType !== 'transparent' && rgbaBead?.colorType !== 'black' ? `0 0 8px ${rgbaBead?.colorType}` : 'none'
                        }}></span>
                        <span className={`font-semibold capitalize ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                          {rgbaBead?.colorType === 'transparent' ? 'Przezroczysty (Separator)' : `Kolor: ${rgbaBead?.colorType}`}
                        </span>
                      </div>
                      <p className={`mt-2 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        {rgbaBead?.colorType === 'black' && "Czerń: Reprezentuje nicość, pokorę i stan przed stworzeniem światła."}
                        {rgbaBead?.colorType === 'red' && "Czerwień: Pasja, miłość oraz ofiara Chrystusa."}
                        {rgbaBead?.colorType === 'green' && "Zieleń: Światło kreacji, wzrost duchowy i życiodajna nadzieja."}
                        {rgbaBead?.colorType === 'blue' && "Niebieski: Głębia boska, pokój Maryi, niebiosa i kontemplacja."}
                        {rgbaBead?.colorType === 'white' && "Biel: Czystość, zmartwychwstanie i chwała Boża."}
                        {rgbaBead?.colorType === 'transparent' && "Przezroczysty: Czas ciszy i skupienia między dziesiątkami."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMN 2: PRAYER PANEL & CONTROLS */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                
                {/* Active Prayer Card */}
                <div className={`border rounded-2xl p-6 shadow-xl relative overflow-hidden transition-all duration-300 ${
                  isLight ? 'bg-white border-slate-200 shadow-slate-100 text-slate-900' : 'bg-slate-900/40 border-slate-800/50 text-slate-100'
                }`}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full pointer-events-none"></div>
                  
                  <div className={`flex items-center justify-between border-b pb-3 mb-4 ${
                    isLight ? 'border-slate-100' : 'border-slate-800'
                  }`}>
                    <span className="text-[10px] text-indigo-400 font-mono font-bold tracking-wider uppercase">
                      AKTYWNA MODLITWA RÓŻAŃCOWA
                    </span>
                    <div className="flex items-center gap-2">
                      {isAuthorized && (
                        <button
                          onClick={() => {
                            setShowEditor(true);
                            setTimeout(() => {
                              document.getElementById('prayer-editor-panel')?.scrollIntoView({ behavior: 'smooth' });
                            }, 100);
                          }}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                            isLight
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                              : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
                          }`}
                        >
                          <Edit3 className="w-3 h-3 text-emerald-400" />
                          <span>Edytuj modlitwę</span>
                        </button>
                      )}
                      <span className={`text-[10px] border px-2 py-1 rounded-md font-mono ${
                        isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-850'
                      }`}>
                        Krok {activeStepIndex + 1} / {steps.length}
                      </span>
                    </div>
                  </div>

                  <h2 className={`text-xl font-serif tracking-tight leading-snug ${isLight ? 'text-slate-900 font-bold' : 'text-white'}`}>
                    {activeStep.label}
                  </h2>

                  <div className="min-h-[160px] flex flex-col justify-center font-sans">
                    {renderPrayerContent()}
                  </div>

                  {/* Subtitle helper badge */}
                  {activeStep.beadNumber && (
                    <div className={`mt-4 flex items-center justify-between text-xs p-2 px-3 rounded-lg border transition-colors ${
                      isLight ? 'bg-slate-50/80 border-slate-200 text-slate-700' : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                    }`}>
                      <span className={`${isLight ? 'text-slate-500' : 'text-slate-500'} font-mono`}>Postęp dziesiątka:</span>
                      <span className="font-mono text-indigo-600 font-bold">{activeStep.beadNumber} / 10</span>
                    </div>
                  )}
                </div>

                {/* Playback & Interaction Controls */}
                <div className={`border rounded-2xl p-5 shadow-xl transition-all duration-300 ${
                  isLight ? 'bg-white border-slate-200 shadow-slate-100' : 'bg-slate-900/40 border-slate-800/50'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 w-full max-w-full overflow-hidden">
                    <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
                      <h3 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        Nawigacja i Autoodtwarzanie
                      </h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setSoundEnabled(!soundEnabled)}
                          title={soundEnabled ? "Wyłącz dźwięk dzwonka" : "Włącz dźwięk dzwonka"}
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            soundEnabled 
                              ? isLight
                                ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100/60'
                                : 'bg-indigo-950/40 text-indigo-400 border-indigo-850/50 hover:bg-indigo-900/30' 
                              : isLight
                                ? 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
                                : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-400'
                          }`}
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setTtsEnabled(!ttsEnabled)}
                          title={ttsEnabled ? "Wyłącz lektora AI TTS" : "Włącz lektora AI TTS"}
                          className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 text-xs font-semibold ${
                            ttsEnabled 
                              ? isLight
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/60'
                                : 'bg-emerald-950/40 text-emerald-400 border-emerald-850/50 hover:bg-emerald-900/30' 
                              : isLight
                                ? 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
                                : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-400'
                          }`}
                        >
                          {ttsEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                          <span>Lektor AI</span>
                        </button>
                      </div>
                    </div>

                    {/* PRZYCISK WERSJI MINIMALISTYCZNEJ 16:9 W DEDYKOWANEJ NOWEJ LINII NA SMARTFONIE */}
                    <button
                      onClick={() => setIsYoutubeMode(true)}
                      className={`w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border shadow-sm ${
                        isLight
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                          : 'bg-indigo-950/40 hover:bg-indigo-900/30 text-indigo-400 border border-indigo-800/50'
                      }`}
                      title="Uruchom wersję minimalistyczną w formacie 16:9"
                    >
                      <Video className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>Wersja Minimalistyczna 16:9</span>
                    </button>
                  </div>

                  {/* Main buttons */}
                  <div className="grid grid-cols-4 gap-2 sm:gap-3">
                    <button
                      onClick={handleReset}
                      className={`col-span-1 border p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-[11px] sm:text-xs font-black tracking-wider transition active:scale-90 cursor-pointer ${
                        isLight
                          ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                          : 'bg-slate-900/60 hover:bg-slate-850 border border-slate-800 text-slate-300'
                      }`}
                    >
                      <RotateCcw className="w-4.5 h-4.5 text-slate-400" />
                      RESET
                    </button>
                    <button
                      onClick={handlePrev}
                      className={`col-span-1 border p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-[11px] sm:text-xs font-black tracking-wider transition active:scale-90 cursor-pointer ${
                        isLight
                          ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                          : 'bg-slate-900/60 hover:bg-slate-850 border border-slate-800 text-slate-300'
                      }`}
                    >
                      <ChevronLeft className="w-4.5 h-4.5 text-slate-400" />
                      WSTECZ
                    </button>
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className={`col-span-1 p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-[11px] sm:text-xs font-black tracking-wider transition active:scale-90 cursor-pointer ${
                        isPlaying 
                          ? 'bg-amber-600 text-white hover:bg-amber-500 shadow-lg shadow-amber-900/20' 
                          : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/20'
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-4.5 h-4.5 text-white fill-current" />
                          PAUZA
                        </>
                      ) : (
                        <>
                          <Play className="w-4.5 h-4.5 text-white fill-current ml-0.5" />
                          START
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleNext}
                      className={`col-span-1 border p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-[11px] sm:text-xs font-black tracking-wider transition active:scale-90 cursor-pointer ${
                        isLight
                          ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                          : 'bg-slate-900/60 hover:bg-slate-850 border border-slate-800 text-slate-300'
                      }`}
                    >
                      <ChevronRight className="w-4.5 h-4.5 text-slate-400" />
                      DALEJ
                    </button>
                  </div>

                  {/* Jump to Mystery Section */}
                  <div className={`mt-4 pt-3 border-t text-xs ${
                    isLight ? 'border-slate-100' : 'border-slate-800/40'
                  }`}>
                    <div>
                      <label className={`block mb-1 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Aktywna tajemnica dnia:</label>
                      <div className={`w-full rounded-lg px-2.5 py-1.5 border font-semibold ${
                        isLight
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                          : 'bg-indigo-950/30 border-indigo-800/40 text-indigo-300'
                      }`}>
                        {(cycleInfo.cycleType === 'cycle1' || cycleInfo.cycleType === 'cycle2')
                          ? `Tajemnica ${getDecadeForDay(cycleInfo.dayOfCycle)} — Dzień ${cycleInfo.dayOfCycle} z 175`
                          : cycleInfo.cycleName
                        }
                      </div>
                    </div>
                  </div>
                </div>

                {/* Show edit panel directly below if authorized & toggled */}
                {isAuthorized && showEditor && (
                  <div className="mt-2 transition-all duration-300">
                    <PrayerEditor
                      userEmail={userEmail}
                      prayers={prayers}
                      currentCycleType={cycleInfo.cycleType === 'cycle1' || cycleInfo.cycleType === 'cycle2' ? cycleInfo.cycleType : 'cycle1'}
                      currentDayNum={cycleInfo.dayOfCycle}
                      activeStep={activeStep}
                      steps={steps}
                      activeStepIndex={activeStepIndex}
                      onChangeStepIndex={setActiveStepIndex}
                      theme={theme}
                      onThemeToggle={toggleTheme}
                    />
                  </div>
                )}



              </div>
            </div>
          </div>
        )) : (
          <BlogSection 
            user={user} 
            isAuthorized={isAuthorized} 
            selectedDate={selectedDate} 
            setSelectedDate={setSelectedDate}
            blogEntries={blogEntries}
            prayers={prayers}
            theme={theme}
            onOpenExportModal={() => setShowCustomExportModal(true)}
          />
        )}
      </main>

      {/* FOOTER STATUS BAR (Hidden in strict YouTube Record Mode) */}
      {!isYoutubeMode && (
        <footer className="h-10 border-t border-slate-800 bg-black flex items-center px-6 justify-between shrink-0">
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              eMBiK: Aktywny
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-sky-500"></div>
              Pielgrzymowanie Duchowe
            </div>
            <div className="hidden sm:flex items-center gap-1.5 opacity-60">
              © 2026 eMBiK — Różaniec Historii Zbawienia (RHZ365) & Widoki na Raj (WnR365)
            </div>
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            4K • 60FPS • AAC 320kbps
          </div>
        </footer>
      )}

      {isExportingPdf && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full text-center shadow-2xl flex flex-col items-center gap-4">
            <div className="relative flex items-center justify-center w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
              <FileDown className="w-5 h-5 text-emerald-400 animate-bounce" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Generowanie Przewodnika PDF</h3>
              <p className="text-xs text-slate-400 mt-1.5 min-h-[32px] flex items-center justify-center leading-relaxed">
                {pdfProgress || 'Przygotowywanie...'}
              </p>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-sky-500 h-full w-2/3 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* Modern PDF Selection Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl flex flex-col gap-5 text-left">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-serif font-bold text-white text-base flex items-center gap-2">
                <FileDown className="w-5 h-5 text-emerald-400" />
                Eksport eMBiK365 do PDF
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-mono p-1 bg-slate-950 hover:bg-slate-800 rounded-lg transition"
              >
                ZAMKNIJ
              </button>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Wybierz format eksportu dokumentu liturgicznego eMBiK365 dostosowany do Twoich potrzeb:
            </p>

            <div className="flex flex-col gap-3">
              {/* Option 1: Daily Guide */}
              <button
                onClick={async () => {
                  setShowExportModal(false);
                  await handleExportPdf();
                }}
                className="p-4 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/50 rounded-xl text-left transition flex items-start gap-3 group cursor-pointer"
              >
                <div className="p-2.5 bg-indigo-950/50 border border-indigo-900/30 rounded-lg text-indigo-400 group-hover:text-indigo-300">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Rozważanie na dziś</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Pobierz 4-stronicowy, osobisty przewodnik modlitewny na wybrany dzień liturgiczny z miejscem na własne notatki.
                  </p>
                </div>
              </button>

              {/* Option 2: Full Year */}
              <button
                onClick={async () => {
                  setShowExportModal(false);
                  await handleExportYearlyPdf();
                }}
                className="p-4 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/50 rounded-xl text-left transition flex items-start gap-3 group cursor-pointer"
              >
                <div className="p-2.5 bg-emerald-950/50 border border-emerald-900/30 rounded-lg text-emerald-400 group-hover:text-emerald-300">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Księga Całego Roku (365 dni)</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Eksportuj cały Różaniec Historii Zbawienia oraz wszystkie 365 wpisów bloga z przedziału od 25 grudnia do 24 grudnia następnego roku.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal / Help Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-left relative">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-950/60 border border-indigo-800/50 rounded-xl text-indigo-400">
                <LogIn className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Logowanie Edytora (RHZ365 / eMBiK)</h3>
                <p className="text-xs text-slate-400">Panel zarządzania i edycji treści modlitw oraz bloga</p>
              </div>
            </div>

            {authErrorMsg && (
              <div className="bg-amber-950/30 border border-amber-800/50 text-amber-300 p-4 rounded-xl text-xs leading-relaxed space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-400">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Komunikat Firebase Auth:</span>
                </div>
                <p>{authErrorMsg}</p>
                <div className="pt-2 border-t border-amber-800/40 text-[11px] text-amber-200/80">
                  <strong>Jak dodać domenę w Firebase:</strong> Przejdź do konsoli Firebase &gt; Authentication &gt; Settings &gt; Authorized domains &gt; Dodaj <strong>localhost</strong> oraz domeny produkcyjne.
                </div>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                onClick={handleLogin}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                Zaloguj przez Google (Konto Google)
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-3 text-[10px] text-slate-500 uppercase font-mono tracking-wider">lub tryb lokalny</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <button
                onClick={handleEnableLocalAuth}
                className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-emerald-400 border border-slate-700 hover:border-emerald-500/40 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Key className="w-4 h-4" />
                Aktywuj Tryb Edytora (Lokalny / Testowy)
              </button>
              <p className="text-[10px] text-slate-500 text-center italic">
                Tryb lokalny umożliwia natychmiastową pełną edycję modlitw i wpisów na tym komputerze.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search Modal (Requirement 6 & 7) */}
      <SearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectResult={(section, dayNum, targetDate) => {
          setSelectedDate(targetDate);
          setActiveTab(section === 'WnR365' ? 'blog' : 'rosary');
        }}
        prayers={prayers}
        blogEntries={blogEntries}
        theme={theme}
      />

      {/* Custom Export Modal (Requirement 11, 12, 13, 14, 15) */}
      <ExportModal
        isOpen={showCustomExportModal}
        onClose={() => setShowCustomExportModal(false)}
        selectedDate={selectedDate}
        dayOfCycle={cycleInfo.dayOfCycle}
        isAuthorized={isAuthorized}
        userEmail={userEmail}
        prayers={prayers}
        blogEntries={blogEntries}
        theme={theme}
      />

      {/* PWA Install Prompt Banner */}
      <PwaInstallPrompt
        isOpenForce={showPwaPromptModal}
        onCloseForce={() => setShowPwaPromptModal(false)}
        theme={theme}
      />
    </div>
  );
}

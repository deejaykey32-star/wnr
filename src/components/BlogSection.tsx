import React, { useState, useEffect, useMemo, useRef } from 'react';
// Firestore is no longer auto-synced. Use AdminSyncPanel for manual Firestore operations.
// import { db } from '../firebase';
// import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { getRGBABeads, getCMYKBeads } from '../data/prayers';
import { playBeadChime } from '../utils/audio';
import { speakText, stopSpeech, pauseSpeech, resumeSpeech, isSpeechPaused, isSpeechSpeaking, getPrayerSegments } from '../utils/tts';
import { 
  getCompletedWnrDays, toggleWnrDayCompleted, markWnrDayCompleted, isWnrDayCompleted 
} from '../utils/completedDays';
import { 
  Play, Pause, ChevronLeft, ChevronRight, RotateCcw, 
  Edit3, Volume2, Mic, MicOff, Calendar, Save, BookOpen, AlertCircle, Sparkles, FileDown, Video, RefreshCw,
  Bookmark, Repeat, Film, Download
} from 'lucide-react';
import { generateVideoClientSide } from '../utils/videoGenerator';
import { RichTextRenderer } from '../utils/richTextHelper';
import { WysiwygToolbar } from './WysiwygToolbar';
import { getWnrDefaultBlogEntry } from '../utils/wnrBlogDefaults';
// restoreAllWnrBlogEntries removed — use AdminSyncPanel for Firestore operations
import { saveLocalBlogEntry } from '../utils/localNoSqlDb';

interface BlogSectionProps {
  user: any;
  isAuthorized: boolean;
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  blogEntries: Record<string, { title: string; text: string; dayIndex: number; updatedBy?: string; updatedAt?: string }>;
  prayers?: Record<string, any>;
  theme?: string;
  onOpenExportModal?: () => void;
}

export const BlogSection: React.FC<BlogSectionProps> = ({ 
  user, 
  isAuthorized, 
  selectedDate, 
  setSelectedDate, 
  blogEntries,
  prayers = {},
  theme = 'dark',
  onOpenExportModal
}) => {
  const isLight = theme === 'light';
  const [editing, setEditing] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editText, setEditText] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [restoringCloud, setRestoringCloud] = useState<boolean>(false); // kept for UI compat
  const [restoreProgress, setRestoreProgress] = useState<string>(''); // kept for UI compat

  // Reader / Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [isYoutubeMode, setIsYoutubeMode] = useState<boolean>(false);

  // Local Video Generation State
  const [localGenerating, setLocalGenerating] = useState<boolean>(false);
  const [localProgress, setLocalProgress] = useState<number>(0);
  const [localStatusMsg, setLocalStatusMsg] = useState<string>('');
  const [localDownloadReady, setLocalDownloadReady] = useState<boolean>(false);
  const [clientVideoUrl, setClientVideoUrl] = useState<string | null>(null);
  const [localShowPanel, setLocalShowPanel] = useState<boolean>(false);
  const [apiServerUrl, setApiServerUrl] = useState<string>(() => {
    try { return localStorage.getItem('apiServerUrl') || 'http://localhost:3333'; } 
    catch { return 'http://localhost:3333'; }
  });
  // Continuous playback & completed days state (WnR365)
  const [completedWnrDays, setCompletedWnrDays] = useState<Record<number, boolean>>(() => getCompletedWnrDays());
  const [isContinuousPlayback, setIsContinuousPlayback] = useState<boolean>(false);
  const isContinuousPlaybackRef = useRef<boolean>(isContinuousPlayback);
  useEffect(() => {
    isContinuousPlaybackRef.current = isContinuousPlayback;
  }, [isContinuousPlayback]);

  // Refs for scrolling and auto advance
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sentenceRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const autoAdvanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Calculate day index and cycle details relative to Dec 25
  const cycleInfo = useMemo(() => {
    const d = new Date(selectedDate);
    d.setHours(12, 0, 0, 0);
    const year = d.getFullYear();
    
    let startYear = year;
    const currentDec25 = new Date(year, 11, 25, 12, 0, 0, 0);
    
    if (d < currentDec25) {
      startYear = year - 1;
    }
    
    const cycleStart = new Date(startYear, 11, 25, 12, 0, 0, 0);
    const diffTime = d.getTime() - cycleStart.getTime();
    const dayIndex = Math.round(diffTime / (1000 * 60 * 60 * 24)); // 0 to 365 — Math.round avoids DST hour-shift errors
    
    let cycleType: 'cycle1' | 'cycle2' | 'break' | 'break2' = 'cycle1';
    let dayOfCycle = 1;
    let cycleName = "";
    
    if (dayIndex >= 0 && dayIndex < 175) {
      cycleType = 'cycle1';
      dayOfCycle = dayIndex + 1;
      cycleName = `Cykl I - Dzień ${dayOfCycle} z 175`;
    } else if (dayIndex >= 175 && dayIndex < 182) {
      cycleType = 'break';
      dayOfCycle = dayIndex - 174;
      cycleName = `7 Dni Przerwy - Dzień ${dayOfCycle} z 7`;
    } else if (dayIndex >= 182 && dayIndex < 357) {
      cycleType = 'cycle2';
      dayOfCycle = dayIndex - 181;
      cycleName = `Cykl II - Dzień ${dayOfCycle} z 175`;
    } else {
      cycleType = 'break2';
      dayOfCycle = dayIndex - 356;
      cycleName = `Okres Przygotowania - Dzień ${dayOfCycle}`;
    }
    
    return {
      dayIndex,
      dayOfCycle,
      cycleType,
      cycleName,
      startYear,
      endYear: startYear + 1
    };
  }, [selectedDate]);

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

  const updateUniversalDate = (day: number, monthIndex: number) => {
    let year = 2026;
    if (monthIndex === 11 && day >= 25) {
      year = 2025;
    }
    const newDate = new Date(year, monthIndex, day, 12, 0, 0, 0);
    setSelectedDate(newDate);
  };

  const handleDayChange = (dayNum: number) => {
    updateUniversalDate(dayNum, selectedDate.getMonth());
  };

  const handleMonthChange = (monthIndex: number) => {
    const maxDays = getDaysInMonth(monthIndex);
    const newDay = Math.min(selectedDate.getDate(), maxDays);
    updateUniversalDate(newDay, monthIndex);
  };

  const docId = `blog_day_${cycleInfo.dayIndex}`;
  const activeEntry = useMemo(() => {
    return getWnrDefaultBlogEntry(cycleInfo.dayIndex, prayers, blogEntries);
  }, [blogEntries, docId, cycleInfo, prayers]);

  // Sync edit form fields when active entry changes
  useEffect(() => {
    setEditTitle(activeEntry.title);
    setEditText(activeEntry.text);
    setEditing(false);
    if (!isContinuousPlaybackRef.current) {
      setIsPlaying(false);
    }
    setActiveSegmentIndex(0);
  }, [activeEntry]);

  const toggleContinuousPlayback = () => {
    setIsContinuousPlayback(prev => {
      const next = !prev;
      if (next) {
        setTtsEnabled(true);
        setIsPlaying(true);
      }
      return next;
    });
  };

  // Polish date formatting (WITHOUT year component for universal form)
  const formattedPolishDate = useMemo(() => {
    const months = [
      "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
      "lipca", "sierpnia", "września", "października", "listopada", "grudnia"
    ];
    return `${selectedDate.getDate()} ${months[selectedDate.getMonth()]}`;
  }, [selectedDate]);

  // Split blog text into segments for teleprompter/scrolling reader
  const blogSegments = useMemo(() => {
    const titleText = activeEntry.title || "Wpis bez tytułu";
    const bodyText = activeEntry.text || "";
    
    // Clean square brackets and format paragraphs
    const cleanBody = bodyText.replace(/[\[\]]/g, '').trim();
    if (!cleanBody) return [titleText];

    return [titleText, ...getPrayerSegments(cleanBody)];
  }, [activeEntry]);

  const handleGenerateLocalMp4 = async () => {
    setLocalGenerating(true);
    setLocalStatusMsg("Wysyłanie zlecenia wygenerowania MP4 (Fish.audio)...");
    setLocalDownloadReady(false);
    
    try {
      const response = await fetch(`${apiServerUrl}/api/generate-mp4`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: activeEntry.text,
          voiceSampleUrl: '/VID-20260727-WA0000.mp3',
          outputFilename: `wnr365_blog_${cycleInfo.dayIndex}.mp4`
        })
      });

      if (!response.ok) {
        throw new Error(`Błąd serwera: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setLocalStatusMsg(`Generowanie rozpoczęte: ${data.message || 'W toku'}. Serwer montuje MP4...`);
      setLocalDownloadReady(true);
    } catch (err: any) {
      console.error(err);
      setLocalStatusMsg(`❌ Błąd połączenia z lokalnym serwerem MP4: ${err.message}`);
    } finally {
      setLocalGenerating(false);
    }
  };

  const handleGenerateClientVideo = async () => {
    setLocalGenerating(true);
    setLocalProgress(5);
    setLocalStatusMsg("Przygotowywanie generowania w przeglądarce...");
    setLocalDownloadReady(false);
    setClientVideoUrl(null);

    try {
      const fullText = activeEntry.text || activeEntry.title;
      const videoUrl = await generateVideoClientSide(
        fullText,
        "", // fishApiKey - empty to force Google TTS fallback
        "/VID-20260727-WA0000.mp3",
        (state) => {
          setLocalProgress(state.progress);
          setLocalStatusMsg(state.message);
        },
        undefined, // stepsData
        undefined, // rgbaBeads
        undefined, // cmykBeads
        "Widoki na Raj" // titleFallback
      );

      setClientVideoUrl(videoUrl);
      setLocalDownloadReady(true);
      setLocalStatusMsg("Gotowe! Wideo WebM zostało zmontowane.");
    } catch (err: any) {
      console.error(err);
      setLocalStatusMsg(`❌ Błąd generowania: ${err.message || err}`);
    } finally {
      setLocalGenerating(false);
    }
  };

  // Static beads definition
  const rgbaBeads = getRGBABeads();
  const cmykBeads = getCMYKBeads();

  // Map active segment index to a specific bead in the 61-bead cycle
  const currentBeadIndex = useMemo(() => {
    if (blogSegments.length <= 1) return 0;
    // Map current segment index (0 to segments.length - 1) linearly to rosary beads (0 to 60)
    return Math.min(60, Math.floor((activeSegmentIndex / (blogSegments.length - 1)) * 60));
  }, [activeSegmentIndex, blogSegments.length]);

  const activeRgbaId = rgbaBeads[currentBeadIndex]?.id || '';
  const activeCmykId = cmykBeads[currentBeadIndex]?.id || '';

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

  const rgbaBeadWindow = getBeadWindow(rgbaBeads, activeRgbaId);
  const cmykBeadWindow = getBeadWindow(cmykBeads, activeCmykId);

  // Smooth scroll active sentence into center
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

  // Play chime and speak when index changes
  useEffect(() => {
    if (!isPlaying) return;
    
    // Play subtle chime on index change (every 5 segments)
    if (soundEnabled && activeSegmentIndex % 5 === 0) {
      playBeadChime(activeSegmentIndex === 0 ? 'cross' : 'hail');
    }

    if (ttsEnabled) {
      stopSpeech();
      const textToSpeak = blogSegments[activeSegmentIndex];
      if (textToSpeak) {
        speakText(textToSpeak, {
          rate: 0.95, // serene pace
          pitch: 1.0,
          onEnd: () => {
            if (isPlayingRef.current) {
              autoAdvanceTimeoutRef.current = setTimeout(() => {
                if (activeSegmentIndex < blogSegments.length - 1) {
                  setActiveSegmentIndex(prev => prev + 1);
                } else {
                  // Reached end of current WnR365 blog entry!
                  markWnrDayCompleted(cycleInfo.dayIndex);
                  setCompletedWnrDays(getCompletedWnrDays());
                  if (isContinuousPlaybackRef.current) {
                    handleNextDay();
                    setActiveSegmentIndex(0);
                  } else {
                    setIsPlaying(false);
                  }
                }
              }, 1200); // peaceful delay
            }
          },
          onError: () => {
            setIsPlaying(false);
          }
        });
      }
    } else {
      // Auto-advance without TTS
      autoAdvanceTimeoutRef.current = setTimeout(() => {
        if (activeSegmentIndex < blogSegments.length - 1) {
          setActiveSegmentIndex(prev => prev + 1);
        } else {
          markWnrDayCompleted(cycleInfo.dayIndex);
          setCompletedWnrDays(getCompletedWnrDays());
          if (isContinuousPlaybackRef.current) {
            handleNextDay();
            setActiveSegmentIndex(0);
          } else {
            setIsPlaying(false);
          }
        }
      }, 5000); // 5 seconds reading time
    }

    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
  }, [activeSegmentIndex, isPlaying, ttsEnabled, soundEnabled, blogSegments]);

  // Handle play toggle
  const handlePlayToggle = () => {
    if (isPlaying) {
      setIsPlaying(false);
      stopSpeech();
      if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
    } else {
      setIsPlaying(true);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    stopSpeech();
    setActiveSegmentIndex(0);
    if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
  };

  const handlePrev = () => {
    if (activeSegmentIndex > 0) {
      setActiveSegmentIndex(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (activeSegmentIndex < blogSegments.length - 1) {
      setActiveSegmentIndex(prev => prev + 1);
    }
  };

  const handlePrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    if (prev.getMonth() === 1 && prev.getDate() === 29) {
      prev.setDate(28); // Skip Feb 29
    }
    const minDate = new Date(2025, 11, 25, 12, 0, 0, 0);
    if (prev < minDate) {
      prev.setTime(new Date(2026, 11, 24, 12, 0, 0, 0).getTime());
    }
    setSelectedDate(prev);
  };

  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    if (next.getMonth() === 1 && next.getDate() === 29) {
      next.setDate(1);
      next.setMonth(2); // March 1st (skip Feb 29)
    }
    const maxDate = new Date(2026, 11, 24, 12, 0, 0, 0);
    if (next > maxDate) {
      next.setTime(new Date(2025, 11, 25, 12, 0, 0, 0).getTime());
    }
    setSelectedDate(next);
  };

  // Keyboard navigation for esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isYoutubeMode) {
        setIsYoutubeMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isYoutubeMode]);

  // Save changes to LOCAL IndexedDB only. Use AdminSyncPanel to push to Firestore.
  const handleSave = async () => {
    if (!editTitle.trim() || !editText.trim()) {
      setSaveStatus({ success: false, message: "Tytuł i treść nie mogą być puste!" });
      return;
    }

    setSaving(true);
    setSaveStatus(null);

    try {
      // Save to local IndexedDB NoSQL store (primary source)
      await saveLocalBlogEntry(docId, {
        title: editTitle.trim(),
        text: editText.trim(),
        dayIndex: cycleInfo.dayIndex,
        updatedBy: user?.email || 'Edytor'
      });
      setSaveStatus({ success: true, message: "Wpis zapisany w lokalnej bazie NoSQL! Aby wysłać do Firestore, użyj panelu synchronizacji." });
      setEditing(false);
      setTimeout(() => setSaveStatus(null), 5000);
    } catch (err: any) {
      console.error("Failed to save locally:", err);
      setSaveStatus({ success: false, message: `Błąd zapisu lokalnego: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // Restore all 366 WnR365 blog entries into Cloud Firestore based on JSON and corrections
  // handleRestoreAllCloudEntries removed — use AdminSyncPanel (sync icon in header) for Firestore push/pull operations.

  // Quick cycle navigation helper
  const navigateToCycleDay = (cycleType: 'cycle1' | 'break' | 'cycle2' | 'break2', day: number) => {
    let targetDaysOffset = 0;
    
    if (cycleType === 'cycle1') {
      const dayNum = Math.max(1, Math.min(175, day));
      targetDaysOffset = dayNum - 1;
    } else if (cycleType === 'break') {
      const dayNum = Math.max(1, Math.min(7, day));
      targetDaysOffset = 175 + (dayNum - 1);
    } else if (cycleType === 'cycle2') {
      const dayNum = Math.max(1, Math.min(175, day));
      targetDaysOffset = 182 + (dayNum - 1);
    } else if (cycleType === 'break2') {
      const dayNum = Math.max(1, Math.min(8, day));
      targetDaysOffset = 357 + (dayNum - 1);
    }
    
    const targetDate = new Date(2025, 11, 25, 12, 0, 0, 0);
    targetDate.setDate(targetDate.getDate() + targetDaysOffset);
    targetDate.setHours(12, 0, 0, 0);
    setSelectedDate(targetDate);
  };

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

  const renderStripBead = (bead: any | null, isActive: boolean, isRgba: boolean) => {
    if (bead && bead.type === 'connector') {
      return null;
    }

    if (!bead) {
      return (
        <div className="w-10 h-10 rounded-full border border-dashed border-slate-800 flex items-center justify-center opacity-25 select-none">
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

    let sizeClass = isActive ? "w-14 h-14 text-xs" : "w-10 h-10 text-[10px]";
    let activeBorderClass = isActive 
      ? (isRgba ? "border-4 border-sky-400 ring-4 ring-sky-500/35 scale-110" : "border-4 border-amber-400 ring-4 ring-amber-500/35 scale-110")
      : "border border-slate-800 hover:border-slate-700";

    const letter = getSeparatorLetter(bead.id);
    const isCross = bead.type === 'cross';
    const isConnector = bead.type === 'connector';

    let innerContent = null;
    if (isCross) {
      innerContent = <span className="font-bold font-serif text-base">†</span>;
      bgClass = isRgba 
        ? "bg-gradient-to-br from-slate-200 via-slate-400 to-slate-500 border-slate-300 text-slate-900"
        : "bg-gradient-to-br from-slate-700 via-zinc-800 to-zinc-950 border-zinc-700 text-slate-200";
    } else if (isConnector) {
      innerContent = <span className="text-[9px] font-black">IHS</span>;
      bgClass = isRgba
        ? "bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 border-slate-300 text-slate-800"
        : "bg-gradient-to-br from-amber-300 via-amber-500 to-amber-600 border-amber-400 text-amber-950";
    } else if (letter) {
      innerContent = <span className="font-mono font-black text-[10px] tracking-tighter">{letter}</span>;
    } else if (isSeparator) {
      innerContent = <span className="text-[7px] font-semibold opacity-70">SEP</span>;
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
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-8">
      {/* WERSJA MINIMALISTYCZNA FRAME VIEW */}
      {isYoutubeMode ? (
        <div id="youtube-frame-blog" className="w-full max-w-5xl min-h-[480px] sm:min-h-0 sm:aspect-video bg-slate-950 border-2 sm:border-4 border-slate-800 rounded-2xl shadow-2xl relative flex flex-col justify-between overflow-hidden mx-auto">
          {/* Top Header */}
          <div className="bg-slate-900/90 backdrop-blur-md px-3 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row items-center justify-between border-b border-slate-800 gap-2 w-full max-w-full overflow-hidden text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 min-w-0 max-w-full">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse shrink-0"></span>
              <span className="text-[10px] sm:text-xs font-mono tracking-widest text-slate-300 uppercase truncate">
                {formattedPolishDate} • {cycleInfo.cycleName}
              </span>
            </div>
            <div className="text-[10px] sm:text-xs font-serif font-black text-amber-400 px-3 py-1 rounded bg-slate-950 border border-amber-500/20 truncate max-w-full">
              Widoki na Raj — WnR365
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLocalShowPanel(!localShowPanel)}
                className={`text-[9px] sm:text-[10px] px-2.5 py-1 rounded font-mono font-bold transition cursor-pointer flex items-center gap-1 border ${
                  localShowPanel
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                    : 'bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border-indigo-700/60'
                }`}
                title="Generowanie wideo MP4 z podkładem lektora"
              >
                <Film className="w-3 h-3 shrink-0" />
                <span>Generuj Wideo {localShowPanel ? '▲' : '▼'}</span>
              </button>
              <button
                onClick={() => setIsYoutubeMode(false)}
                className="text-[9px] sm:text-[10px] bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-850 px-2.5 py-1 rounded font-mono transition cursor-pointer shrink-0"
              >
                WYJDŹ (ESC)
              </button>
            </div>
          </div>

          {/* COLLAPSIBLE LOCAL MP4/WEBM GENERATOR PANEL */}
          {localShowPanel && (
            <div className="bg-slate-900 border-b border-indigo-900/60 p-4 sm:p-6 flex flex-col gap-5 text-left animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h4 className="text-sm font-bold font-mono uppercase tracking-wider text-amber-400">
                    Zaawansowany Generator Wideo (MP4 / WebM)
                  </h4>
                </div>
                <span className="text-[10px] font-mono bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800">
                  Opcje Renderowania WnR365
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* METODA A: SERWER MP4 */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-indigo-950 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                      <h5 className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wide">
                        Metoda A: Serwer (MP4)
                      </h5>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Wysyła tekst do lokalnego serwera API (Python), by wygenerować wideo MP4 (Fish.audio klonowanie głosu).
                    </p>

                    <div className="flex flex-col gap-1.5 pt-2">
                      <label className="text-[10px] font-mono text-slate-400">🔗 Adres API serwera generującego:</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={apiServerUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setApiServerUrl(val);
                            try { localStorage.setItem('apiServerUrl', val); } catch (err) {}
                          }}
                          placeholder="http://localhost:3333"
                          className="flex-1 bg-slate-900 border border-slate-800 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono focus:outline-none focus:border-amber-500"
                        />
                        <button
                          onClick={() => {
                            setApiServerUrl('http://localhost:3333');
                            try { localStorage.setItem('apiServerUrl', 'http://localhost:3333'); } catch (err) {}
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      onClick={handleGenerateLocalMp4}
                      disabled={localGenerating}
                      className="w-full px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow"
                    >
                      <Film className="w-3.5 h-3.5 shrink-0" />
                      <span>Generuj MP4 na Serwerze</span>
                    </button>

                    {localDownloadReady && (
                      <a
                        href={`${apiServerUrl}/api/generate-mp4/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer text-center animate-pulse"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span>Pobierz wideo MP4</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* METODA B: BROWSER WEBM */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-indigo-950 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                      <h5 className="text-xs font-bold font-mono text-indigo-400 uppercase tracking-wide">
                        Metoda B: Przeglądarka (WebM)
                      </h5>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Generuje wideo lokalnie w oknie przeglądarki. Wykorzystuje Google Translate TTS. <b>Nie zmieniaj karty podczas generowania!</b>
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      onClick={handleGenerateClientVideo}
                      disabled={localGenerating}
                      className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow"
                    >
                      <Film className="w-3.5 h-3.5 shrink-0" />
                      <span>Generuj WebM w Przeglądarce</span>
                    </button>

                    {localDownloadReady && clientVideoUrl && (
                      <a
                        href={clientVideoUrl}
                        download={`wnr365_blog_${cycleInfo.dayIndex}.webm`}
                        className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer text-center animate-pulse"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span>Pobierz wideo WebM</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress bar i status */}
              {localGenerating && (
                <div className="flex flex-col gap-1.5 bg-slate-950 p-3 rounded-xl border border-slate-850 mt-2">
                  <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-850">
                    <div className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-amber-400 transition-all duration-300" style={{ width: `${localProgress}%` }}></div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{localStatusMsg} ({localProgress}%)</span>
                </div>
              )}
              {localStatusMsg && !localGenerating && (
                <p className="text-[11px] font-mono text-amber-300 bg-slate-950 p-3 rounded-xl border border-slate-800 mt-2">{localStatusMsg}</p>
              )}
            </div>
          )}

          {/* YT Content Row (Unrolled Beads + Auto scrolling text) */}
          <div className="flex-1 grid grid-cols-12 items-stretch px-2 sm:px-6 relative bg-slate-950 h-full overflow-hidden">
            {/* RGBA Bead Strip (Hidden on mobile < 640px) */}
            <div className="hidden sm:flex col-span-2 flex-col items-center justify-center relative py-6 border-r border-slate-900/40">
              <div className="absolute top-2 text-[8px] font-mono font-bold tracking-widest text-sky-400">RGBA</div>
              <div className="absolute top-8 bottom-8 w-[1.5px] bg-gradient-to-b from-transparent via-sky-500/20 to-transparent z-0 border-r border-dashed border-sky-400/20" />
              <div className="flex flex-col items-center justify-between h-[80%] max-h-[300px] relative z-10 w-full">
                {rgbaBeadWindow.map((bead, idx) => (
                  <div key={idx} className="transition-all duration-300">
                    {renderStripBead(bead, idx === 2, true)}
                  </div>
                ))}
              </div>
            </div>

            {/* Central Scrolling Blog Segments */}
            <div className="col-span-12 sm:col-span-8 flex flex-col justify-center px-2 sm:px-6 py-4 h-full text-center relative overflow-hidden">
              <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto max-h-[190px] pr-2 custom-scrollbar flex flex-col items-center gap-4 scroll-smooth py-16"
                style={{ maskImage: 'linear-gradient(to bottom, transparent, white 20%, white 80%, transparent)' }}
              >
                {blogSegments.map((seg, sIdx) => {
                  const isCurrent = sIdx === activeSegmentIndex;
                  return (
                    <p
                      key={sIdx}
                      ref={el => { sentenceRefs.current[sIdx] = el; }}
                      className={`text-sm sm:text-base transition-all duration-500 text-center leading-relaxed font-sans max-w-2xl px-2 ${
                        isCurrent 
                          ? "text-yellow-400 font-bold scale-105 drop-shadow-[0_2px_6px_rgba(234,179,8,0.4)]" 
                          : "text-slate-400 opacity-25 hover:opacity-50"
                      }`}
                    >
                      {seg}
                    </p>
                  );
                })}
              </div>
            </div>

            {/* CMYK Bead Strip (Hidden on mobile < 640px) */}
            <div className="hidden sm:flex col-span-2 flex-col items-center justify-center relative py-6 border-l border-slate-900/40">
              <div className="absolute top-2 text-[8px] font-mono font-bold tracking-widest text-amber-400">CMYK</div>
              <div className="absolute top-8 bottom-8 w-[1.5px] bg-gradient-to-b from-transparent via-amber-500/20 to-transparent z-0 border-r border-dashed border-amber-400/20" />
              <div className="flex flex-col items-center justify-between h-[80%] max-h-[300px] relative z-10 w-full">
                {cmykBeadWindow.map((bead, idx) => (
                  <div key={idx} className="transition-all duration-300">
                    {renderStripBead(bead, idx === 2, false)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* YT Player Controls Bar */}
          <div className="bg-slate-900/80 backdrop-blur-md px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-center justify-between border-t border-slate-800 gap-3 w-full max-w-full overflow-hidden">
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={handlePrev}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition active:scale-90 cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handlePlayToggle}
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
                title={ttsEnabled ? "Wyłącz lektora AI" : "Włącz lektora AI"}
                className={`p-1.5 sm:p-2 rounded-full border transition cursor-pointer flex items-center justify-center ml-2 ${
                  ttsEnabled 
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50 hover:bg-emerald-900/30' 
                    : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-400'
                }`}
              >
                {ttsEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-center gap-3 w-full sm:w-auto">
              <div className="h-2 flex-1 sm:w-32 bg-slate-800 rounded-full overflow-hidden min-w-[80px]">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${((activeSegmentIndex + 1) / blogSegments.length) * 100}%` }}
                ></div>
              </div>
              <span className="text-xs font-mono text-slate-400 shrink-0">
                Segment {activeSegmentIndex + 1} / {blogSegments.length}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* STANDARD WORKSPACE LAYOUT FOR BLOG */
        <>
          {/* Liturgical Day Selector & Cycle Information */}
          <div className={`border rounded-2xl p-3.5 sm:p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-xl text-left transition-all duration-300 w-full max-w-full overflow-hidden ${
            isLight ? 'bg-white border-slate-200 shadow-slate-100' : 'bg-slate-900/40 border-slate-800/60'
          }`}>
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 flex items-center justify-center border ${
                isLight ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-indigo-950/50 border-indigo-900/50 text-indigo-400'
              }`}>
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 truncate">
                <span className="text-[10px] text-indigo-400 font-mono tracking-widest uppercase block truncate">CYKL LITURGICZNY BLOGA WIDOKI NA RAJ (WnR365)</span>
                <h2 className={`text-base sm:text-lg font-serif font-bold leading-tight mt-0.5 truncate ${
                  isLight ? 'light-mode-text' : 'text-white'
                }`}>
                  {cycleInfo.cycleName}
                </h2>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Okres powszechny: od 25 grudnia do 24 grudnia
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 justify-end w-full lg:w-auto max-w-full">
              <div className="flex items-center gap-1.5 flex-wrap xs:flex-nowrap w-full sm:w-auto">
                <div className="flex items-center gap-1 shrink-0">
                  <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className={`text-[11px] sm:text-xs font-mono ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>WYBÓR:</span>
                </div>
                
                {/* Day selector dropdown with ribbon indicators */}
                <select
                  value={selectedDate.getDate()}
                  onChange={(e) => handleDayChange(Number(e.target.value))}
                  className={`flex-1 sm:flex-initial border text-xs px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-xl focus:outline-none cursor-pointer transition min-w-0 ${
                    isLight 
                      ? 'bg-white border-slate-300 text-slate-800 hover:border-slate-400 shadow-sm' 
                      : 'bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-200'
                  }`}
                >
                  {Array.from({ length: getDaysInMonth(selectedDate.getMonth()) }, (_, idx) => idx + 1).map((d) => {
                    const checkDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), d, 12, 0, 0, 0);
                    let startYear = checkDate.getFullYear();
                    const currentDec25 = new Date(startYear, 11, 25, 12, 0, 0, 0);
                    if (checkDate < currentDec25) startYear = startYear - 1;
                    const diffTime = checkDate.getTime() - new Date(startYear, 11, 25, 12, 0, 0, 0).getTime();
                    const dIdx = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    const isCompleted = completedWnrDays[dIdx];
                    return (
                      <option key={d} value={d}>
                        {d} {isCompleted ? '🎗️ (odmówiony)' : ''}
                      </option>
                    );
                  })}
                </select>

                {/* Month selector dropdown */}
                <select
                  value={selectedDate.getMonth()}
                  onChange={(e) => handleMonthChange(Number(e.target.value))}
                  className={`flex-1 sm:flex-initial border text-xs px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-xl focus:outline-none cursor-pointer transition min-w-0 ${
                    isLight 
                      ? 'bg-white border-slate-300 text-slate-800 hover:border-slate-400 shadow-sm' 
                      : 'bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-200'
                  }`}
                >
                  {POLISH_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <button
                  onClick={() => {
                    const today = new Date();
                    let month = today.getMonth();
                    let day = today.getDate();
                    if (month === 1 && day === 29) day = 28;
                    let year = 2026;
                    if (month === 11 && day >= 25) year = 2025;
                    setSelectedDate(new Date(year, month, day, 12, 0, 0, 0));
                  }}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 sm:py-2 border text-xs rounded-xl font-semibold transition cursor-pointer text-center ${
                    isLight
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100'
                      : 'bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-800/40'
                  }`}
                >
                  Dzisiaj
                </button>

                {/* Manual Ribbon Toggle Button */}
                <button
                  onClick={() => {
                    toggleWnrDayCompleted(cycleInfo.dayIndex);
                    setCompletedWnrDays(getCompletedWnrDays());
                  }}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 sm:py-2 border text-xs rounded-xl font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    completedWnrDays[cycleInfo.dayIndex]
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-sm'
                      : isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                  title="Oznacz ten dzień WnR365 wstążką jako odmówiony / odznacz"
                >
                  <Bookmark className={`w-4 h-4 ${completedWnrDays[cycleInfo.dayIndex] ? 'fill-amber-400 text-amber-400' : ''}`} />
                  <span className="hidden xs:inline">{completedWnrDays[cycleInfo.dayIndex] ? 'Odmówiono 🎗️' : 'Wstążka WnR'}</span>
                </button>

                {/* Continuous Playback Toggle */}
                <button
                  onClick={toggleContinuousPlayback}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 sm:py-2 border text-xs rounded-xl font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    isContinuousPlayback
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                      : isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                  title="Włącz odtwarzanie całości WnR365 jednym ciągiem z automatycznym przełączaniem kolejnych dni oraz uruchom lektora"
                >
                  <Repeat className="w-4 h-4" />
                  <span>{isContinuousPlayback ? 'Ciągłe WnR: WŁ' : 'Odtwarzaj ciągiem'}</span>
                </button>

                {onOpenExportModal && (
                  <button
                    onClick={onOpenExportModal}
                    className={`flex-1 sm:flex-initial px-3 py-1.5 sm:py-2 border text-xs rounded-xl font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      isLight
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-800/40'
                    }`}
                    title="Eksportuj rozważania i schemat eMBiK365 do pliku PDF lub EPUB"
                  >
                    <FileDown className="w-4 h-4 shrink-0" />
                    <span>Eksport</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Core Layout: Reader and Details */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Col: Blog Reading and Unrolled Bead Window */}
            <div className="lg:col-span-7 flex flex-col gap-6 text-left">
              
              {/* Blog Entry Card */}
              <div className={`border rounded-2xl p-6 shadow-xl relative overflow-hidden transition-all duration-300 ${
                isLight ? 'bg-white border-slate-200 shadow-slate-100' : 'bg-slate-900/40 border-slate-800/50'
              }`}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/5 to-transparent rounded-bl-full pointer-events-none"></div>
                
                <div className={`flex items-center justify-between border-b pb-3 mb-5 ${
                  isLight ? 'border-slate-100' : 'border-slate-800'
                }`}>
                  <div className="flex items-center gap-1.5 text-xs text-amber-500 font-mono font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>WPIS WIDOKI NA RAJ (WnR365)</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Dzień {cycleInfo.dayOfCycle} ({cycleInfo.cycleName.split(' - ')[0]})
                  </span>
                </div>

                <div className="mb-4">
                  <span className={`text-xs border px-2.5 py-1 rounded-md inline-block font-mono mb-2 ${
                    isLight ? 'text-slate-600 bg-slate-50 border-slate-200' : 'text-slate-400 bg-slate-950 border-slate-850'
                  }`}>
                    {formattedPolishDate} ({cycleInfo.cycleName})
                  </span>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className={`text-2xl font-serif tracking-tight leading-tight mt-1 ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}>
                      {activeEntry.title}
                    </h1>
                    {completedWnrDays[cycleInfo.dayIndex] && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0 shadow-sm mt-1">
                        <Bookmark className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        Odmówiono 🎗️
                      </span>
                    )}
                  </div>
                </div>

                {editing ? (
                  // Edit Fields
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                        Tytuł wpisu
                      </label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition border ${
                          isLight 
                            ? 'bg-white border-slate-300 text-slate-800' 
                            : 'bg-slate-950 border-slate-800 text-zinc-100'
                        }`}
                        placeholder="Podaj natchniony tytuł..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                        Treść wpisu (natchniona przez Ducha Świętego)
                      </label>
                      <WysiwygToolbar 
                        text={editText} 
                        onChange={setEditText} 
                        textareaId="blog-editor-textarea" 
                        placeholder="Zapisz natchnioną treść dla chwały Jezusa w Bogu Ojcu..." 
                        theme={theme}
                      />
                    </div>

                    {saveStatus && (
                      <div className={`text-xs p-3 rounded-lg border ${
                        saveStatus.success 
                          ? 'bg-emerald-950/20 border-emerald-800 text-emerald-400' 
                          : 'bg-red-950/20 border-red-900 text-red-400'
                      }`}>
                        {saveStatus.message}
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => setEditing(false)}
                        className={`px-4 py-2 font-medium text-xs rounded-lg active:scale-95 transition cursor-pointer border ${
                          isLight
                            ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                            : 'bg-slate-800 hover:bg-slate-750 text-slate-300'
                        }`}
                      >
                        Anuluj
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg shadow-lg active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {saving ? 'Zapisywanie...' : 'Zapisz Wpis'}
                      </button>
                    </div>
                  </div>
                ) : (
                  // Read Content View
                  <div className={`max-w-none ${isLight ? 'light-mode-text' : 'prose prose-invert'}`}>
                    <div style={isLight ? { color: '#000000' } : undefined} className={`text-sm leading-relaxed font-sans pt-1 min-h-[160px] border-l-2 pl-4 text-justify ${
                      isLight ? 'light-mode-text border-slate-300' : 'text-slate-300 border-amber-500/20'
                    }`}>
                      <RichTextRenderer text={activeEntry.text} theme={theme} />
                    </div>

                    {activeEntry.updatedBy && (
                      <div className="mt-6 pt-4 border-t border-slate-900 text-right text-[10px] text-slate-500 font-mono">
                        Edytowane przez: {activeEntry.updatedBy} (
                        {activeEntry.updatedAt ? new Date(activeEntry.updatedAt).toLocaleString('pl-PL') : 'brak daty'}
                        )
                      </div>
                    )}

                    <div className="mt-8 pt-6 border-t border-slate-850 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {isAuthorized ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => setEditing(true)}
                            className={`px-4 py-2.5 border font-bold text-xs rounded-xl active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              isLight
                                ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                                : 'bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 text-slate-300'
                            }`}
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                            EDYTUJ WPIS
                          </button>
                          <div className={`px-3 py-2 rounded-xl border text-xs flex items-center gap-1.5 ${
                            isLight ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-amber-950/30 border-amber-800/40 text-amber-400'
                          }`}>
                            <RefreshCw className="w-3 h-3" />
                            Synchronizacja z Firestore: użyj ikony ⟳ w nagłówku
                          </div>
                        </div>
                      ) : (
                        <div />
                      )}

                      {/* Czytnik - Day navigation and play/pause controls in the same form as rosary */}
                      <div className={`flex items-center gap-2 p-1.5 border rounded-2xl shadow-inner transition-all duration-300 ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
                      }`}>
                        <span className="text-[10px] text-slate-500 font-bold font-mono px-3 uppercase hidden lg:inline">CZYTNIK:</span>
                        <button
                          onClick={handlePrevDay}
                          className={`px-4 py-2.5 border rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-black tracking-wider transition active:scale-90 cursor-pointer ${
                            isLight
                              ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                              : 'bg-slate-900 hover:bg-slate-850 border border-slate-800/80 text-slate-300'
                          }`}
                          title="Poprzedni dzień"
                        >
                          <ChevronLeft className="w-4 h-4 text-slate-400" />
                          <span>POPRZEDNI DZIEŃ</span>
                        </button>

                        <button
                          onClick={handlePlayToggle}
                          className={`px-5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-black tracking-wider transition active:scale-90 cursor-pointer shadow-md ${
                            isPlaying 
                              ? 'bg-amber-600 text-white hover:bg-amber-500 shadow-amber-900/10' 
                              : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/10'
                          }`}
                        >
                          {isPlaying ? (
                            <>
                              <Pause className="w-4 h-4 text-white fill-current" />
                              PAUZA
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                              PLAY
                            </>
                          )}
                        </button>

                        <button
                          onClick={handleNextDay}
                          className={`px-4 py-2.5 border rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-black tracking-wider transition active:scale-90 cursor-pointer ${
                            isLight
                              ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                              : 'bg-slate-900 hover:bg-slate-850 border border-slate-800/80 text-slate-300'
                          }`}
                          title="Następny dzień"
                        >
                          <span>NASTĘPNY DZIEŃ</span>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Explanatory Note on the WnR365 Blog */}
              <div className={`border rounded-2xl p-5 text-xs flex gap-4 items-start shadow-md transition-all duration-300 ${
                isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-900/20 border-slate-800/30 text-slate-400'
              }`}>
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className={`font-bold ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>Idea Bloga Widoki na Raj (WnR365)</h4>
                  <p className="leading-relaxed">
                    Każdy dzień w roku (od 25 grudnia do 24 grudnia następnego roku) to kolejny wpis blogowy <strong>Widoki na Raj (WnR365)</strong>, zorganizowany w zsynchronizowane cykle. Jest on kluczowym elementem <strong>eMBiK</strong> (elektronicznej Misji Barw i Kolorów). Możesz nagrywać odczyt wpisów z syntezatorem lektora AI i tworzyć profesjonalne materiały wideo na YouTube w formacie panoramicznym 16:9.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Col: Bead Progress Strips and Teleprompter Player Controls */}
            <div className="lg:col-span-5 flex flex-col gap-6 text-left">
              
              {/* Teleprompter Playback & Progress Module */}
              <div className={`border rounded-2xl p-6 shadow-xl relative overflow-hidden transition-all duration-300 ${
                isLight ? 'bg-white border-slate-200 shadow-slate-100' : 'bg-slate-900/40 border-slate-800/50'
              }`}>
                <h3 className={`text-xs font-bold uppercase tracking-wider border-b pb-3 mb-4 ${
                  isLight ? 'text-slate-500 border-slate-100' : 'text-slate-400 border-slate-800'
                }`}>
                  Odtwarzacz i Pasek Postępu
                </h3>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 w-full max-w-full overflow-hidden">
                  <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
                    <span className="text-[10px] sm:text-xs text-slate-500 font-bold font-mono uppercase">ODTWARZACZ BLOGA</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        title={soundEnabled ? "Wyłącz dzwonek" : "Włącz dzwonek"}
                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                          soundEnabled 
                            ? isLight
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100/60'
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
                        title={ttsEnabled ? "Wyłącz lektora AI" : "Włącz lektora AI"}
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

                  {/* PRZYCISK WERSJI MINIMALISTYCZNEJ 16:9 (DOSTĘPNY TYLKO DLA ADMINISTRATORA) */}
                  {isAuthorized && (
                    <button
                      onClick={() => setIsYoutubeMode(true)}
                      className={`w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border shadow-sm ${
                        isLight
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                          : 'bg-indigo-950/40 hover:bg-indigo-900/30 text-indigo-400 border border-indigo-800/50'
                      }`}
                      title="Generowanie wideo YouTube 16:9 (Administrator)"
                    >
                      <Video className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>Wersja Minimalistyczna 16:9 (Admin)</span>
                    </button>
                  )}
                </div>

                {/* Main player navigation controls */}
                <div className="grid grid-cols-4 gap-3">
                  <button
                    onClick={handleReset}
                    className={`col-span-1 border p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-bold tracking-wider transition active:scale-95 cursor-pointer ${
                      isLight
                        ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                        : 'bg-slate-900/50 hover:bg-slate-850 border border-slate-800 text-slate-300'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                    RESET
                  </button>
                  <button
                    onClick={handlePrev}
                    className={`col-span-1 border p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-bold tracking-wider transition active:scale-95 cursor-pointer ${
                      isLight
                        ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                        : 'bg-slate-900/50 hover:bg-slate-850 border border-slate-800 text-slate-300'
                    }`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                    WSTECZ
                  </button>
                  <button
                    onClick={handlePlayToggle}
                    className={`col-span-1 p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-bold tracking-wider transition active:scale-95 cursor-pointer ${
                      isPlaying 
                        ? 'bg-amber-600 text-white hover:bg-amber-500' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-500'
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5 text-white fill-current" />
                        PAUZA
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-white fill-current ml-0.5" />
                        START
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleNext}
                    className={`col-span-1 border p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-bold tracking-wider transition active:scale-95 cursor-pointer ${
                      isLight
                        ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                        : 'bg-slate-900/50 hover:bg-slate-850 border border-slate-800 text-slate-300'
                    }`}
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    DALEJ
                  </button>
                </div>

                <div className={`mt-5 p-3 rounded-xl flex items-center justify-between text-xs font-mono border transition-all duration-300 ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-950/60 border-slate-850 text-slate-400'
                }`}>
                  <span>Aktywna linia:</span>
                  <span className="font-bold text-amber-500">{activeSegmentIndex + 1} / {blogSegments.length}</span>
                </div>
              </div>

              {/* Liturgical Quick Jump Navigator */}
              <div className={`border rounded-2xl p-6 shadow-xl transition-all duration-300 ${
                isLight ? 'bg-white border-slate-200 shadow-slate-100' : 'bg-slate-900/40 border-slate-800/50'
              }`}>
                <h3 className={`text-xs font-bold uppercase tracking-wider border-b pb-3 mb-4 ${
                  isLight ? 'text-slate-500 border-slate-100' : 'text-slate-400 border-slate-800'
                }`}>
                  Szybki wybór Dnia w Cyklu
                </h3>
                
                <div className="space-y-4">
                  {/* Cykl I */}
                  <div>
                    <label className="block text-[11px] text-slate-500 font-medium mb-1.5">Cykl I - Tradycyjny (Dni 1 - 175)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        max={175}
                        defaultValue={1}
                        id="jump-cycle1-input"
                        className={`border rounded-lg px-2.5 py-1 text-xs focus:outline-none w-20 ${
                          isLight 
                            ? 'bg-white border-slate-300 text-slate-800 focus:border-indigo-400' 
                            : 'bg-slate-950 border-slate-800 text-slate-200'
                        }`}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById('jump-cycle1-input') as HTMLInputElement;
                          if (input) navigateToCycleDay('cycle1', Number(input.value));
                        }}
                        className={`px-3 py-1 border rounded-lg text-xs font-semibold cursor-pointer ${
                          isLight
                            ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                            : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30'
                        }`}
                      >
                        Przejdź
                      </button>
                      <button
                        onClick={() => navigateToCycleDay('cycle1', 1)}
                        className={`px-2 py-1 border rounded-lg text-[10px] ${
                          isLight
                            ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-250'
                            : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-850'
                        }`}
                      >
                        Początek (Dzień 1)
                      </button>
                    </div>
                  </div>

                  {/* Przerwa */}
                  <div>
                    <label className="block text-[11px] text-slate-500 font-medium mb-1.5">7 Dni Przerwy (Dni 1 - 7)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        max={7}
                        defaultValue={1}
                        id="jump-break-input"
                        className={`border rounded-lg px-2.5 py-1 text-xs focus:outline-none w-20 ${
                          isLight 
                            ? 'bg-white border-slate-300 text-slate-800 focus:border-indigo-400' 
                            : 'bg-slate-950 border-slate-800 text-slate-200'
                        }`}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById('jump-break-input') as HTMLInputElement;
                          if (input) navigateToCycleDay('break', Number(input.value));
                        }}
                        className={`px-3 py-1 border rounded-lg text-xs font-semibold cursor-pointer ${
                          isLight
                            ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                            : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30'
                        }`}
                      >
                        Przejdź
                      </button>
                    </div>
                  </div>

                  {/* Cykl II */}
                  <div>
                    <label className="block text-[11px] text-slate-500 font-medium mb-1.5">Cykl II (Dni 1 - 175)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        max={175}
                        defaultValue={1}
                        id="jump-cycle2-input"
                        className={`border rounded-lg px-2.5 py-1 text-xs focus:outline-none w-20 ${
                          isLight 
                            ? 'bg-white border-slate-300 text-slate-800 focus:border-indigo-400' 
                            : 'bg-slate-950 border-slate-800 text-slate-200'
                        }`}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById('jump-cycle2-input') as HTMLInputElement;
                          if (input) navigateToCycleDay('cycle2', Number(input.value));
                        }}
                        className={`px-3 py-1 border rounded-lg text-xs font-semibold cursor-pointer ${
                          isLight
                            ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                            : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30'
                        }`}
                      >
                        Przejdź
                      </button>
                      <button
                        onClick={() => navigateToCycleDay('cycle2', 1)}
                        className={`px-2 py-1 border rounded-lg text-[10px] ${
                          isLight
                            ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-250'
                            : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-850'
                        }`}
                      >
                        Początek (Dzień 1)
                      </button>
                    </div>
                  </div>

                  {/* Okres Przygotowania */}
                  <div>
                    <label className="block text-[11px] text-slate-500 font-medium mb-1.5">Okres Przygotowania (Dni 1 - 8)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        max={8}
                        defaultValue={1}
                        id="jump-break2-input"
                        className={`border rounded-lg px-2.5 py-1 text-xs focus:outline-none w-20 ${
                          isLight 
                            ? 'bg-white border-slate-300 text-slate-800 focus:border-indigo-400' 
                            : 'bg-slate-950 border-slate-800 text-slate-200'
                        }`}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById('jump-break2-input') as HTMLInputElement;
                          if (input) navigateToCycleDay('break2', Number(input.value));
                        }}
                        className={`px-3 py-1 border rounded-lg text-xs font-semibold cursor-pointer ${
                          isLight
                            ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                            : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30'
                        }`}
                      >
                        Przejdź
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/**
 * Text-to-Speech (TTS) Narrator Utility for Polish Rosary
 * Uses Web Speech API (SpeechSynthesis) to read the prayer texts dynamically.
 */

// Set to hold active utterances to prevent garbage collection in Chrome
const activeUtterances = new Set<SpeechSynthesisUtterance>();

export const isTtsSupported = (): boolean => {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
};

// Session ID to discard stale callbacks from canceled utterances
let currentSessionId = 0;

// State for chunked reading
let utteranceQueue: string[] = [];
let queueIndex = 0;
let queueOptions: any = {};
let isQueueActive = false;
let isQueuePaused = false;
let isUtteranceSpeaking = false;

/**
 * Splits extremely long segments into smaller ones to prevent TTS engine freezes.
 */
const splitLongSegment = (text: string, maxLength: number = 180): string[] => {
  if (text.length <= maxLength) return [text];
  
  // Try splitting by comma first
  const parts = text.split(',');
  const result: string[] = [];
  let current = "";
  
  for (const part of parts) {
    const trimmedPart = part.trim();
    if (!trimmedPart) continue;
    
    const candidate = current ? `${current}, ${trimmedPart}` : trimmedPart;
    if (candidate.length > maxLength) {
      if (current) {
        result.push(current + ",");
        current = trimmedPart;
      } else {
        // Fallback: split by space if single comma segment is too long
        const words = trimmedPart.split(' ');
        for (const word of words) {
          const wordCandidate = current ? `${current} ${word}` : word;
          if (wordCandidate.length > maxLength) {
            if (current) {
              result.push(current);
              current = word;
            } else {
              result.push(word);
              current = "";
            }
          } else {
            current = wordCandidate;
          }
        }
      }
    } else {
      current = candidate;
    }
  }
  
  if (current) {
    result.push(current);
  }
  
  return result;
};

/**
 * Stop any active voice narration immediately
 */
export const stopSpeech = () => {
  currentSessionId++;
  isQueueActive = false;
  isQueuePaused = false;
  isUtteranceSpeaking = false;
  utteranceQueue = [];
  queueIndex = 0;
  
  // Nullify event handlers on active utterances to prevent ghost callbacks
  activeUtterances.forEach(u => {
    u.onstart = null;
    u.onend = null;
    u.onerror = null;
  });
  activeUtterances.clear();
  
  if (isTtsSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch (err) {
      console.warn("Failed to cancel speech synthesis:", err);
    }
  }
};

/**
 * Pause any active voice narration (queue-level cancel, preserving queueIndex)
 */
export const pauseSpeech = () => {
  isQueuePaused = true;
  isUtteranceSpeaking = false;
  activeUtterances.forEach(u => {
    u.onstart = null;
    u.onend = null;
    u.onerror = null;
  });
  activeUtterances.clear();
  if (isTtsSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch (err) {
      console.warn("Failed to pause speech synthesis via cancel:", err);
    }
  }
};

/**
 * Resume paused voice narration (re-read the current segment)
 */
export const resumeSpeech = () => {
  isQueuePaused = false;
  if (isQueueActive && !isUtteranceSpeaking) {
    speakNextSegment();
  }
};

/**
 * Check if voice narration is paused
 */
export const isSpeechPaused = (): boolean => {
  return isQueuePaused;
};

/**
 * Check if voice narration is active (speaking or paused)
 */
export const isSpeechSpeaking = (): boolean => {
  return isQueueActive && !isQueuePaused;
};

/**
 * Get all available Polish voices
 */
export const getPolishVoices = (): SpeechSynthesisVoice[] => {
  if (!isTtsSupported()) return [];
  try {
    const voices = window.speechSynthesis.getVoices();
    return voices.filter(v => v.lang.toLowerCase().includes('pl'));
  } catch {
    return [];
  }
};

/**
 * Find the best available Polish voice (defaults to cleanest female voice)
 */
export const getPolishVoice = (preference?: { voiceURI?: string; gender?: 'female' | 'male' }): SpeechSynthesisVoice | null => {
  if (!isTtsSupported()) return null;

  try {
    const voices = window.speechSynthesis.getVoices();
    const polishVoices = voices.filter(v => v.lang.toLowerCase().includes('pl'));

    if (polishVoices.length === 0) {
      return voices[0] || null;
    }

    // 1. Specific voiceURI matching
    if (preference?.voiceURI) {
      const match = polishVoices.find(v => v.voiceURI === preference.voiceURI || v.name === preference.voiceURI);
      if (match) return match;
    }

    // 2. Gender matching
    if (preference?.gender === 'female') {
      const femaleNames = ['paulina', 'zofia', 'ewa', 'agnieszka', 'maja', 'zira', 'kobieta', 'female'];
      const femaleVoice = polishVoices.find(v => femaleNames.some(n => v.name.toLowerCase().includes(n)));
      if (femaleVoice) return femaleVoice;
      const googleFemale = polishVoices.find(v => v.name.toLowerCase().includes('google'));
      if (googleFemale) return googleFemale;
    } else if (preference?.gender === 'male') {
      const maleNames = ['jacek', 'jan', 'marek', 'adam', 'male', 'mężczyzna'];
      const maleVoice = polishVoices.find(v => maleNames.some(n => v.name.toLowerCase().includes(n)));
      if (maleVoice) return maleVoice;
    }

    // Default priority for cleanest Polish voice: Paulina / Zofia / Google / Microsoft
    const defaultFemale = polishVoices.find(v => 
      v.name.toLowerCase().includes('paulina') || 
      v.name.toLowerCase().includes('zofia') || 
      v.name.toLowerCase().includes('ewa')
    );
    const googleVoice = polishVoices.find(v => v.name.toLowerCase().includes('google'));
    const microsoftVoice = polishVoices.find(v => v.name.toLowerCase().includes('microsoft'));

    return defaultFemale || googleVoice || microsoftVoice || polishVoices[0];
  } catch (err) {
    console.warn("Failed to get voices:", err);
  }

  return null;
};

const speakNextSegment = () => {
  if (!isTtsSupported() || !isQueueActive || isQueuePaused) {
    isUtteranceSpeaking = false;
    return;
  }

  if (queueIndex >= utteranceQueue.length) {
    // Finished the entire queue!
    isQueueActive = false;
    isUtteranceSpeaking = false;
    activeUtterances.clear();
    if (queueOptions.onEnd) {
      queueOptions.onEnd();
    }
    return;
  }

  const segmentText = utteranceQueue[queueIndex].trim();
  if (!segmentText) {
    // Skip empty segments
    queueIndex++;
    speakNextSegment();
    return;
  }

  const thisSessionId = currentSessionId;

  try {
    const utterance = new SpeechSynthesisUtterance(segmentText);
    
    const plVoice = getPolishVoice({ 
      voiceURI: queueOptions.voiceURI, 
      gender: queueOptions.gender 
    });
    if (plVoice) {
      utterance.voice = plVoice;
    }
    
    utterance.lang = 'pl-PL';
    utterance.rate = queueOptions.rate !== undefined ? queueOptions.rate : 0.95;
    utterance.pitch = queueOptions.pitch !== undefined ? queueOptions.pitch : 1.0;
    utterance.volume = queueOptions.volume !== undefined ? queueOptions.volume : 1.0;

    utterance.onstart = () => {
      if (thisSessionId !== currentSessionId) return;
      isUtteranceSpeaking = true;
      // Only fire onStart on the very first segment
      if (queueIndex === 0 && queueOptions.onStart) {
        queueOptions.onStart();
      }
      if (queueOptions.onSegmentStart) {
        queueOptions.onSegmentStart(queueIndex);
      }
    };

    utterance.onend = () => {
      activeUtterances.delete(utterance);
      if (thisSessionId !== currentSessionId) return;
      isUtteranceSpeaking = false;
      if (!isQueueActive || isQueuePaused) return; // Queue was cancelled or paused
      
      // Move to next segment
      queueIndex++;
      // Small break between sentences to make it sound natural (e.g., 300ms)
      setTimeout(() => {
        if (thisSessionId === currentSessionId && isQueueActive && !isQueuePaused) {
          speakNextSegment();
        }
      }, 300);
    };

    utterance.onerror = (e) => {
      activeUtterances.delete(utterance);
      if (thisSessionId !== currentSessionId) return;
      isUtteranceSpeaking = false;
      console.warn("Utterance error during segment play:", e);
      if (!isQueueActive || isQueuePaused) return;
      
      // On error, try to proceed to next segment
      queueIndex++;
      setTimeout(() => {
        if (thisSessionId === currentSessionId && isQueueActive && !isQueuePaused) {
          speakNextSegment();
        }
      }, 300);
    };

    activeUtterances.add(utterance);
    isUtteranceSpeaking = true;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    isUtteranceSpeaking = false;
    console.error("Error speaking segment:", err);
    if (queueOptions.onError) {
      queueOptions.onError(err);
    }
  }
};

/**
 * Cleans text for Polish TTS engine to ensure smooth, continuous reading.
 * Strips quotes ("cudzysłów"), dashes ("kreska / pauza / myślnik"), brackets ("nawias"),
 * and other disruptive symbols while preserving natural sentence pauses.
 */
export const sanitizeTextForTts = (text: string): string => {
  if (!text) return "";

  return text
    // 0. Remove QR codes, captions, dates, cycle info, and headers
    .replace(/\[qr:[^\]]+\]/gi, '')
    .replace(/\[caption:[^\]]+\]/gi, '')
    .replace(/\[\d{2}\.\d{2}\.\d{4}\]/g, '')
    .replace(/Widoki na Raj\s*-\s*Dzień\s*\d+(\s*\(Cykl\s+[^\)]+\))?(\s*-\s*\[[^\]]+\])?(\s*-\s*)?/gi, '')
    .replace(/^(RHZ365|WnR365|Biblia365)\s*[-–—]?\s*/gi, '')

    // 1. Remove quotes (cudzysłowy) of all types
    .replace(/[„”"«»‘’'`]/g, '')

    // 2. Replace ellipses (... or …) with a natural pause (comma)
    .replace(/(\.\.\.|…)/g, ', ')

    // 3. Replace hyphens / dashes / pauzy with a comma or space to create natural pauses without reading character names
    // Spaced dashes / em-dashes / en-dashes / horizontal bars -> comma pause
    .replace(/[—–―]/g, ', ')
    .replace(/\s+-\s+/g, ', ')
    // Hyphenated compound words (e.g. Bet-Peor -> Bet Peor)
    .replace(/(\w+)-(\w+)/g, '$1 $2')
    // Remaining standalone hyphens -> space
    .replace(/-/g, ' ')

    // 4. Remove parentheses and brackets (nawiasy)
    .replace(/[()\[\]{}]/g, ' ')

    // 5. Replace colons and semicolons with commas to avoid saying "dwukropek"/"średnik"
    .replace(/[:;]/g, ', ')

    // 6. Remove slashes, backslashes, markdown symbols, bullets, hashes, etc.
    .replace(/[\/\\*#_~>•·°|]/g, ' ')

    // 7. Clean up multiple commas, spaces, and punctuation formatting
    .replace(/,\s*,+/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/\s+\./g, '.')
    .replace(/^\s*,+\s*/, '')
    .trim();
};

/**
 * Splits prayer or blog text into exact segments used by both TTS engine and UI renderer.
 * Ensures 1:1 segment index matching for yellow highlighting.
 */
export const getPrayerSegments = (text: string): string[] => {
  if (!text) return [];
  const cleanBody = text.replace(/[\[\]]/g, '').trim();
  if (!cleanBody) return [];

  // Split by sentence/clause boundaries while preserving them
  const sentenceRegex = /[^.!?;\n]+[.!?;\n]*/g;
  const segments = cleanBody.match(sentenceRegex) || [cleanBody];

  const rawSegments = segments
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const result: string[] = [];
  for (const seg of rawSegments) {
    result.push(...splitLongSegment(seg, 180));
  }
  return result;
};

/**
 * Read the specified text aloud
 */
export const speakText = (
  text: string, 
  options: { 
    rate?: number; 
    pitch?: number; 
    volume?: number;
    voiceURI?: string;
    gender?: 'female' | 'male';
    onStart?: () => void;
    onSegmentStart?: (index: number) => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  } = {}
) => {
  if (!isTtsSupported()) {
    if (options.onError) options.onError("TTS is not supported in this browser.");
    return;
  }

  // Stop previous speech or queue
  stopSpeech();

  // New session ID for this request
  const newSessionId = currentSessionId;

  // Clean and sanitize text for smooth Polish TTS reading (strip quotes, dashes, brackets, etc.)
  const cleanText = sanitizeTextForTts(text);

  if (!cleanText) {
    if (options.onEnd) options.onEnd();
    return;
  }

  // Get exact segments matching the UI renderer
  utteranceQueue = getPrayerSegments(cleanText);

  if (utteranceQueue.length === 0) {
    if (options.onEnd) options.onEnd();
    return;
  }

  queueIndex = 0;
  queueOptions = options;
  isQueueActive = true;
  isQueuePaused = false;

  // Give Chrome's speech synthesis engine a tiny delay after cancel() to prevent stuttering at beginning
  setTimeout(() => {
    if (newSessionId === currentSessionId && isQueueActive) {
      speakNextSegment();
    }
  }, 40);
};

// Listen to voiceschanged event to warm up voices list in browsers like Chrome
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    // Just trigger voice fetching to populate cache
    getPolishVoice();
  };
}

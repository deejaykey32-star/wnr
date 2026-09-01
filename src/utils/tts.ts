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
 * Get all available Polish voices — ONLY voices with lang pl-* are returned.
 * Never falls back to non-Polish voices.
 */
/**
 * Returns true if the given voice name is likely female based on known Polish voice names.
 */
export function isFemaleVoiceName(name: string): boolean {
  const fn = (name || '').toLowerCase();
  return (
    fn.includes('paulina') || fn.includes('zofia') || fn.includes('ewa') ||
    fn.includes('agnieszka') || fn.includes('maja') || fn.includes('zosia') ||
    fn.includes('kobieta')
  );
}

/**
 * Returns true if the given voice name is likely male based on known Polish voice names.
 */
export function isMaleVoiceName(name: string): boolean {
  const fn = (name || '').toLowerCase();
  return (
    fn.includes('jacek') || fn.includes('jan') || fn.includes('marek') ||
    fn.includes('adam') || fn.includes('mężczyzna') || fn.includes('tomasz') ||
    fn.includes('paweł') || fn.includes('pawel')
  );
}

/**
 * Get all available Polish voices — ONLY voices with lang pl-* or Polish names are returned.
 */
export const getPolishVoices = (): SpeechSynthesisVoice[] => {
  if (!isTtsSupported()) return [];
  try {
    const voices = window.speechSynthesis.getVoices();
    return voices.filter(v => {
      const lang = (v.lang || '').toLowerCase().replace('_', '-');
      const name = (v.name || '').toLowerCase();
      
      return (
        lang.startsWith('pl') ||
        name.includes('polski') ||
        name.includes('polskie') ||
        name.includes('polish') ||
        name.includes('paulina') ||
        name.includes('zofia') ||
        name.includes('jacek') ||
        name.includes('ewa')
      );
    });
  } catch {
    return [];
  }
};

/**
 * Get all available voices matching a specific language code (e.g. 'pl', 'en', 'de', 'es', 'fr', 'uk', etc.).
 */
export const getVoicesForLang = (langCode: string): SpeechSynthesisVoice[] => {
  if (!isTtsSupported()) return [];
  try {
    const target = (langCode || 'pl').toLowerCase().replace('_', '-');
    if (target === 'pl' || target.startsWith('pl')) {
      return getPolishVoices();
    }
    const voices = window.speechSynthesis.getVoices();
    return voices.filter(v => {
      const vLang = (v.lang || '').toLowerCase().replace('_', '-');
      const vName = (v.name || '').toLowerCase();
      
      // Direct prefix or code match
      if (vLang.startsWith(target) || vLang.includes(`-${target}`) || vLang.includes(`_${target}`)) {
        return true;
      }
      
      // Keyword fallback for language names
      if (target === 'en' && (vName.includes('english') || vLang.includes('en'))) return true;
      if (target === 'de' && (vName.includes('deutsch') || vName.includes('german') || vLang.includes('de'))) return true;
      if (target === 'es' && (vName.includes('español') || vName.includes('spanish') || vLang.includes('es'))) return true;
      if (target === 'fr' && (vName.includes('français') || vName.includes('french') || vLang.includes('fr'))) return true;
      if (target === 'it' && (vName.includes('italiano') || vName.includes('italian') || vLang.includes('it'))) return true;
      if (target === 'uk' && (vName.includes('ukrainian') || vName.includes('україн') || vLang.includes('uk'))) return true;
      if (target === 'cs' && (vName.includes('czech') || vName.includes('češt') || vLang.includes('cs'))) return true;
      if (target === 'sk' && (vName.includes('slovak') || vName.includes('slovenč') || vLang.includes('sk'))) return true;
      if (target === 'ru' && (vName.includes('russian') || vName.includes('рус') || vLang.includes('ru'))) return true;
      if (target === 'pt' && (vName.includes('portuguese') || vName.includes('português') || vLang.includes('pt'))) return true;

      return false;
    });
  } catch {
    return [];
  }
};

/**
 * Find the best available Polish voice matching the given preference.
 * voiceURI is searched in ALL available voices (exact match), then Polish voices.
 */
export const getPolishVoice = (preference?: { voiceURI?: string; gender?: 'female' | 'male' }): SpeechSynthesisVoice | null => {
  if (!isTtsSupported()) return null;

  try {
    const allVoices = window.speechSynthesis.getVoices();
    const polishVoices = getPolishVoices();

    // 1. Exact voiceURI / name match — use that specific voice directly
    if (preference?.voiceURI) {
      const targetUri = preference.voiceURI.trim();
      const exactMatch = allVoices.find(v => 
        (v.voiceURI && v.voiceURI.trim() === targetUri) ||
        (v.name && v.name.trim() === targetUri) ||
        (v.voiceURI || v.name) === targetUri
      );
      if (exactMatch) return exactMatch;
    }

    if (polishVoices.length === 0) {
      return allVoices[0] || null;
    }

    // 2. Male: try known male names → first non-female Polish voice → first available
    if (preference?.gender === 'male') {
      const namedMale = polishVoices.find(v => isMaleVoiceName(v.name));
      if (namedMale) return namedMale;
      const nonFemale = polishVoices.find(v => !isFemaleVoiceName(v.name));
      if (nonFemale) return nonFemale;
      // Also check all system voices for male if polishVoices didn't have one
      const anyMale = allVoices.find(v => isMaleVoiceName(v.name));
      if (anyMale) return anyMale;
      return polishVoices[0];
    }

    // 3. Female: try known female names → Google PL → first non-male Polish voice
    if (preference?.gender === 'female') {
      const namedFemale = polishVoices.find(v => isFemaleVoiceName(v.name));
      if (namedFemale) return namedFemale;
      const googlePl = polishVoices.find(v => v.name.toLowerCase().includes('google'));
      if (googlePl) return googlePl;
      return polishVoices.find(v => !isMaleVoiceName(v.name)) || polishVoices[0];
    }

    // 4. No gender preference: Paulina > Zofia > Ewa > Google PL > Microsoft PL > first
    return (
      polishVoices.find(v => v.name.toLowerCase().includes('paulina')) ||
      polishVoices.find(v => v.name.toLowerCase().includes('zofia')) ||
      polishVoices.find(v => v.name.toLowerCase().includes('ewa')) ||
      polishVoices.find(v => v.name.toLowerCase().includes('google')) ||
      polishVoices.find(v => v.name.toLowerCase().includes('microsoft')) ||
      polishVoices[0]
    );
  } catch (err) {
    console.warn("Failed to get voices:", err);
    return null;
  }
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
    
    const targetLang = (queueOptions.lang || 'pl').toLowerCase();
    let voiceToUse: SpeechSynthesisVoice | null = null;

    if (targetLang === 'pl' || targetLang.startsWith('pl')) {
      voiceToUse = getPolishVoice({ 
        voiceURI: queueOptions.voiceURI, 
        gender: queueOptions.gender 
      });
      utterance.lang = 'pl-PL';
    } else {
      const allVoices = window.speechSynthesis.getVoices();
      if (queueOptions.voiceURI) {
        voiceToUse = allVoices.find(v => 
          (v.voiceURI && v.voiceURI.trim() === queueOptions.voiceURI) || 
          (v.name && v.name.trim() === queueOptions.voiceURI)
        ) || null;
      }
      if (!voiceToUse) {
        voiceToUse = allVoices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith(targetLang)) || null;
      }
      utterance.lang = voiceToUse ? voiceToUse.lang : targetLang;
    }

    if (voiceToUse) {
      utterance.voice = voiceToUse;
    }

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
    // 0. Remove QR codes and captions
    .replace(/\[qr:[^\]]+\]/gi, '')
    .replace(/\[caption:[^\]]+\]/gi, '')

    // 0b. Remove scripture citations in parentheses, e.g. (Mt 10,8), (J 10,34), (Dz 2,1-4)
    .replace(/\([A-Za-z0-9\s,\.\-–—]+\)/g, (match) => {
      if (/\b(Mt|Marek|Łk|Łukasz|J|Jan|Dz|Apostolskie|Rzym|Kor|Gal|Efez|Filip|Kol|Tes|Tim|Tyt|Filem|Hbr|Jk|Piotr|Juda|Ap|Rdz|Wj|Kpł|Lb|Pwt|Joz|Sędziowie|Rut|Sam|Krl|Krn|Ezd|Ne|Tob|Jdt|Est|Mach|Hiob|Ps|Prz|Kohelet|Pieśń|Mdr|Syr|Iz|Jer|Lm|Bar|Ez|Dn|Oz|Joel|Am|Obad|Jonasz|Mich|Nah|Hab|Sof|Ag|Zach|Mal)\b/i.test(match)) {
        return '';
      }
      if (/Cykl|Dzień|Różaniec|Historii/i.test(match)) {
        return '';
      }
      return match;
    })

    // 0c. Remove dates in brackets, headers, footers, page numbers and brand acronyms
    .replace(/\[\d{2}\.\d{2}\.\d{4}\]/g, '')
    .replace(/Widoki na Raj\s*[-—–]\s*WnR365/gi, '')
    .replace(/eMBiK365\s*[-—–]\s*widokinaraj\.pl/gi, '')
    .replace(/DZIEŃ\s+\d+\s*[-—–]\s*[^\s]+/gi, '')
    .replace(/Cykl\s+[I|V|X\d]+\s*\([^\)]*\)\s*[-—–]\s*Dzień\s*\d+/gi, '')
    .replace(/WnR365\s*[-—–]\s*Widoki na Raj\s*[-—–]?\s*\([^\)]*\)\s*[-—–]?\s*\[[^\]]*\]/gi, '')
    .replace(/str\.\s*\d+/gi, '')
    .replace(/\b(eMBiK365|WnR365|RHZ365|Biblia365|widokinaraj\.pl)\b/gi, '')
    .replace(/\b(np|itd|itp|tzn|tzw|wg)\b\.?/gi, '')

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
    lang?: string;
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

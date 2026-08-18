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
 * Find the best available Polish voice
 */
export const getPolishVoice = (): SpeechSynthesisVoice | null => {
  if (!isTtsSupported()) return null;

  try {
    const voices = window.speechSynthesis.getVoices();
    
    // 1. Look for Microsoft Paulina or Google polski or any native Polish voice
    const polishVoices = voices.filter(v => v.lang.toLowerCase().includes('pl'));
    
    if (polishVoices.length > 0) {
      // Prefer local/native voices if possible, or google voices
      const googleVoice = polishVoices.find(v => v.name.toLowerCase().includes('google'));
      const microsoftVoice = polishVoices.find(v => v.name.toLowerCase().includes('microsoft'));
      return googleVoice || microsoftVoice || polishVoices[0];
    }
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
    
    const plVoice = getPolishVoice();
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
 * Read the specified text aloud
 */
export const speakText = (
  text: string, 
  options: { 
    rate?: number; 
    pitch?: number; 
    volume?: number;
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

  // Strip unwanted symbols
  const cleanText = text
    .replace(/[\[\]]/g, '')
    .trim();

  if (!cleanText) {
    if (options.onEnd) options.onEnd();
    return;
  }

  // Split text by sentence/clause boundaries while preserving them as much as possible.
  const sentenceRegex = /[^.!?;\n]+[.!?;\n]*/g;
  const segments = cleanText.match(sentenceRegex) || [cleanText];

  // Clean segments and filter empty ones, splitting excessively long sentences
  const rawSegments = segments
    .map(s => s.trim())
    .filter(s => s.length > 0);

  utteranceQueue = [];
  for (const seg of rawSegments) {
    utteranceQueue.push(...splitLongSegment(seg, 180));
  }

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

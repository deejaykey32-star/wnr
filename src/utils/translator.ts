/**
 * Live Translation Utility for WnR365 Ebook & TTS
 * Uses Google Translate GTX client-side API for instant translation from Polish to target languages.
 */

export interface TargetLanguageOption {
  code: string;
  name: string;
  flag: string;
  voiceLangPrefix: string;
}

export const SUPPORTED_LANGUAGES: TargetLanguageOption[] = [
  { code: 'pl', name: 'Polski', flag: '🇵🇱', voiceLangPrefix: 'pl' },
  { code: 'en', name: 'English', flag: '🇬🇧', voiceLangPrefix: 'en' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', voiceLangPrefix: 'de' },
  { code: 'es', name: 'Español', flag: '🇪🇸', voiceLangPrefix: 'es' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', voiceLangPrefix: 'fr' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', voiceLangPrefix: 'it' },
  { code: 'uk', name: 'Ukraiński', flag: '🇺🇦', voiceLangPrefix: 'uk' },
  { code: 'cs', name: 'Čeština', flag: '🇨🇿', voiceLangPrefix: 'cs' },
  { code: 'sk', name: 'Slovenčina', flag: '🇸🇰', voiceLangPrefix: 'sk' },
  { code: 'pt', name: 'Português', flag: '🇵🇹', voiceLangPrefix: 'pt' },
];

/**
 * Translate text from Polish (sl=pl) to targetLang (tl=...) in real-time.
 * Automatically splits text into sentences to prevent HTTP GET URL length limit errors.
 */
export async function translateTextFromPolish(text: string, targetLang: string): Promise<string> {
  if (!text || !text.trim() || targetLang === 'pl') {
    return text;
  }

  // Split by sentence delimiters (period, exclamation, question mark, newline)
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  const translatedParts: string[] = [];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=pl&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(trimmed)}`;
      const response = await fetch(url);
      if (!response.ok) {
        translatedParts.push(trimmed);
        continue;
      }

      const data = await response.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const sentenceTranslation = data[0]
          .map((chunk: any) => (Array.isArray(chunk) && chunk[0] ? chunk[0] : ''))
          .join('');
        translatedParts.push(sentenceTranslation || trimmed);
      } else {
        translatedParts.push(trimmed);
      }
    } catch (err) {
      console.warn("Translation failed for sentence:", trimmed.substring(0, 30), err);
      translatedParts.push(trimmed);
    }
  }

  return translatedParts.join(' ');
}

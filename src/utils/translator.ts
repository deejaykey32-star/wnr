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
  { code: 'pl', name: 'Polski (Polish)', flag: '🇵🇱', voiceLangPrefix: 'pl' },
  { code: 'en', name: 'English (Angielski)', flag: '🇬🇧', voiceLangPrefix: 'en' },
  { code: 'de', name: 'Deutsch (Niemiecki)', flag: '🇩🇪', voiceLangPrefix: 'de' },
  { code: 'es', name: 'Español (Hiszpański)', flag: '🇪🇸', voiceLangPrefix: 'es' },
  { code: 'fr', name: 'Français (Francuski)', flag: '🇫🇷', voiceLangPrefix: 'fr' },
  { code: 'it', name: 'Italiano (Włoski)', flag: '🇮🇹', voiceLangPrefix: 'it' },
  { code: 'uk', name: 'Ukraiński (Українська)', flag: '🇺🇦', voiceLangPrefix: 'uk' },
  { code: 'cs', name: 'Čeština (Czeski)', flag: '🇨🇿', voiceLangPrefix: 'cs' },
  { code: 'sk', name: 'Slovenčina (Słowacki)', flag: '🇸🇰', voiceLangPrefix: 'sk' },
  { code: 'pt', name: 'Português (Portugalski)', flag: '🇵🇹', voiceLangPrefix: 'pt' },
  { code: 'ru', name: 'Русский (Rosyjski)', flag: '🇷🇺', voiceLangPrefix: 'ru' },
  { code: 'hr', name: 'Hrvatski (Chorwacki)', flag: '🇭🇷', voiceLangPrefix: 'hr' },
  { code: 'sr', name: 'Srpski (Serbski)', flag: '🇷🇸', voiceLangPrefix: 'sr' },
  { code: 'sl', name: 'Slovenščina (Słoweński)', flag: '🇸🇮', voiceLangPrefix: 'sl' },
  { code: 'bg', name: 'Български (Bułgarski)', flag: '🇧🇬', voiceLangPrefix: 'bg' },
  { code: 'ro', name: 'Română (Rumuński)', flag: '🇷🇴', voiceLangPrefix: 'ro' },
  { code: 'hu', name: 'Magyar (Węgierski)', flag: '🇭🇺', voiceLangPrefix: 'hu' },
  { code: 'nl', name: 'Nederlands (Holenderski)', flag: '🇳🇱', voiceLangPrefix: 'nl' },
  { code: 'sv', name: 'Svenska (Szwedzki)', flag: '🇸🇪', voiceLangPrefix: 'sv' },
  { code: 'no', name: 'Norsk (Norweski)', flag: '🇳🇴', voiceLangPrefix: 'no' },
  { code: 'da', name: 'Dansk (Duński)', flag: '🇩🇰', voiceLangPrefix: 'da' },
  { code: 'fi', name: 'Suomi (Fiński)', flag: '🇫🇮', voiceLangPrefix: 'fi' },
  { code: 'el', name: 'Ελληνικά (Grecki)', flag: '🇬🇷', voiceLangPrefix: 'el' },
  { code: 'tr', name: 'Türkçe (Turecki)', flag: '🇹🇷', voiceLangPrefix: 'tr' },
  { code: 'lt', name: 'Lietuvių (Litewski)', flag: '🇱🇹', voiceLangPrefix: 'lt' },
  { code: 'lv', name: 'Latviešu (Łotewski)', flag: '🇱🇻', voiceLangPrefix: 'lv' },
  { code: 'et', name: 'Eesti (Estoński)', flag: '🇪🇪', voiceLangPrefix: 'et' },
  { code: 'he', name: 'עברית (Hebrajski)', flag: '🇮🇱', voiceLangPrefix: 'he' },
  { code: 'ar', name: 'العربية (Arabski)', flag: '🇸🇦', voiceLangPrefix: 'ar' },
  { code: 'zh-CN', name: '简体中文 (Chiński uproszczony)', flag: '🇨🇳', voiceLangPrefix: 'zh' },
  { code: 'zh-TW', name: '繁體中文 (Chiński tradycyjny)', flag: '🇹🇼', voiceLangPrefix: 'zh' },
  { code: 'ja', name: '日本語 (Japoński)', flag: '🇯🇵', voiceLangPrefix: 'ja' },
  { code: 'ko', name: '한국어 (Koreański)', flag: '🇰🇷', voiceLangPrefix: 'ko' },
  { code: 'hi', name: 'हिन्दी (Hindi)', flag: '🇮🇳', voiceLangPrefix: 'hi' },
  { code: 'bn', name: 'বাংলা (Bengalski)', flag: '🇧🇩', voiceLangPrefix: 'bn' },
  { code: 'vi', name: 'Tiếng Việt (Wietnamski)', flag: '🇻🇳', voiceLangPrefix: 'vi' },
  { code: 'th', name: 'ไทย (Tajski)', flag: '🇹🇭', voiceLangPrefix: 'th' },
  { code: 'id', name: 'Bahasa Indonesia (Indonezyjski)', flag: '🇮🇩', voiceLangPrefix: 'id' },
  { code: 'ms', name: 'Bahasa Melayu (Malajski)', flag: '🇲🇾', voiceLangPrefix: 'ms' },
  { code: 'fil', name: 'Filipino / Tagalog', flag: '🇵🇭', voiceLangPrefix: 'fil' },
  { code: 'sw', name: 'Kiswahili (Suahili)', flag: '🇰🇪', voiceLangPrefix: 'sw' },
  { code: 'la', name: 'Latina (Łacina)', flag: '🇻🇦', voiceLangPrefix: 'la' },
  { code: 'ga', name: 'Gaeilge (Irlandzki)', flag: '🇮🇪', voiceLangPrefix: 'ga' },
  { code: 'cy', name: 'Cymraeg (Walijski)', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', voiceLangPrefix: 'cy' },
  { code: 'mt', name: 'Malti (Maltański)', flag: '🇲🇹', voiceLangPrefix: 'mt' },
  { code: 'is', name: 'Íslenska (Islandzki)', flag: '🇮🇸', voiceLangPrefix: 'is' },
  { code: 'sq', name: 'Shqip (Albański)', flag: '🇦🇱', voiceLangPrefix: 'sq' },
  { code: 'mk', name: 'Македонски (Macedoński)', flag: '🇲🇰', voiceLangPrefix: 'mk' },
  { code: 'bs', name: 'Bosanski (Bośniacki)', flag: '🇧🇦', voiceLangPrefix: 'bs' },
  { code: 'hy', name: 'Հայերեն (Ormiański)', flag: '🇦🇲', voiceLangPrefix: 'hy' },
  { code: 'ka', name: 'ქართული (Gruziński)', flag: '🇬🇪', voiceLangPrefix: 'ka' },
  { code: 'az', name: 'Azərbaycan (Azerbejdżański)', flag: '🇦🇿', voiceLangPrefix: 'az' },
  { code: 'kk', name: 'Qazaqsha (Kazachski)', flag: '🇰🇿', voiceLangPrefix: 'kk' },
  { code: 'uz', name: 'Oʻzbekcha (Uzbecki)', flag: '🇺🇿', voiceLangPrefix: 'uz' },
  { code: 'fa', name: 'فارسی (Perski)', flag: '🇮🇷', voiceLangPrefix: 'fa' },
  { code: 'ur', name: 'اردو (Urdu)', flag: '🇵🇰', voiceLangPrefix: 'ur' },
  { code: 'ta', name: 'தமிழ் (Tamilski)', flag: '🇮🇳', voiceLangPrefix: 'ta' },
  { code: 'te', name: 'తెలుగు (Telugijski)', flag: '🇮🇳', voiceLangPrefix: 'te' },
  { code: 'kn', name: 'ಕನ್ನಡ (Kannada)', flag: '🇮🇳', voiceLangPrefix: 'kn' },
  { code: 'ml', name: 'മലയാളം (Malajalam)', flag: '🇮🇳', voiceLangPrefix: 'ml' },
  { code: 'si', name: 'සිංහල (Syngaleski)', flag: '🇱🇰', voiceLangPrefix: 'si' },
  { code: 'my', name: 'မြန်မာ (Birmański)', flag: '🇲🇲', voiceLangPrefix: 'my' },
  { code: 'km', name: 'ខ្មែរ (Khmerski)', flag: '🇰🇭', voiceLangPrefix: 'km' },
  { code: 'am', name: 'አማርኛ (Amharski)', flag: '🇪🇹', voiceLangPrefix: 'am' },
  { code: 'af', name: 'Afrikaans', flag: '🇿🇦', voiceLangPrefix: 'af' },
  { code: 'zu', name: 'isiZulu (Zuluski)', flag: '🇿🇦', voiceLangPrefix: 'zu' },
  { code: 'ca', name: 'Català (Kataloński)', flag: '🇪🇸', voiceLangPrefix: 'ca' },
  { code: 'eu', name: 'Euskara (Baskijski)', flag: '🇪🇸', voiceLangPrefix: 'eu' },
  { code: 'gl', name: 'Galego (Galicyjski)', flag: '🇪🇸', voiceLangPrefix: 'gl' },
  { code: 'be', name: 'Беларуская (Białoruski)', flag: '🇧🇾', voiceLangPrefix: 'be' },
  { code: 'mn', name: 'Монгол (Mongolski)', flag: '🇲🇳', voiceLangPrefix: 'mn' },
  { code: 'ne', name: 'नेपाली (Nepalski)', flag: '🇳🇵', voiceLangPrefix: 'ne' },
  { code: 'mg', name: 'Malagasy (Malagaski)', flag: '🇲🇬', voiceLangPrefix: 'mg' },
  { code: 'so', name: 'Soomaali (Somalijski)', flag: '🇸🇴', voiceLangPrefix: 'so' },
  { code: 'haw', name: 'ʻŌlelo Hawaiʻi (Hawajski)', flag: '🇺🇸', voiceLangPrefix: 'haw' },
  { code: 'mi', name: 'Te Reo Māori (Maoryski)', flag: '🇳🇿', voiceLangPrefix: 'mi' },
  { code: 'lb', name: 'Lëtzebuergesch (Luksemburski)', flag: '🇱🇺', voiceLangPrefix: 'lb' },
  { code: 'gd', name: 'Gàidhlig (Szkocki gaelicki)', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', voiceLangPrefix: 'gd' },
  { code: 'fy', name: 'Frysk (Fryzyjski)', flag: '🇳🇱', voiceLangPrefix: 'fy' },
];

export function getLanguageOption(code: string): TargetLanguageOption {
  const list = SUPPORTED_LANGUAGES || [];
  return list.find(l => l.code === code) || list[0] || { code: 'pl', name: 'Polski (Polish)', flag: '🇵🇱', voiceLangPrefix: 'pl' };
}

const translationCache = new Map<string, string>();

/**
 * Fast parallel translation helper for a single text chunk (up to ~450 chars).
 */
async function translateChunk(chunk: string, targetLang: string): Promise<string> {
  const trimmed = chunk.trim();
  if (!trimmed || targetLang === 'pl') return chunk;

  const cacheKey = `${targetLang}_${trimmed}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=pl&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(trimmed)}`;
    const response = await fetch(url);
    if (!response.ok) return chunk;

    const data = await response.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const result = data[0]
        .map((part: any) => (Array.isArray(part) && part[0] ? part[0] : ''))
        .join('');
      if (result) {
        translationCache.set(cacheKey, result);
        return result;
      }
    }
    return chunk;
  } catch (err) {
    console.warn("Chunk translation warning:", err);
    return chunk;
  }
}

/**
 * Translate text from Polish (sl=pl) to targetLang (tl=...) in real-time.
 * Groups text into larger ~450-char blocks and translates them in PARALLEL via Promise.all.
 * Uses in-memory caching for instant 0ms responses on repeated text.
 */
export async function translateTextFromPolish(text: string, targetLang: string): Promise<string> {
  if (!text || !text.trim() || targetLang === 'pl') {
    return text;
  }

  const fullCacheKey = `${targetLang}_FULL_${text}`;
  if (translationCache.has(fullCacheKey)) {
    return translationCache.get(fullCacheKey)!;
  }

  // 1. Split by sentence delimiters (period, exclamation, question mark, newline)
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];

  // 2. Group sentences into optimal chunks of ~450 characters to minimize HTTP requests
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > 450) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // 3. Fire ALL chunk translations concurrently in PARALLEL!
  const translatedChunks = await Promise.all(
    chunks.map(chunk => translateChunk(chunk, targetLang))
  );

  const finalResult = translatedChunks.join(' ');
  if (finalResult && finalResult.trim().length > 0) {
    translationCache.set(fullCacheKey, finalResult);
  }

  return finalResult || text;
}

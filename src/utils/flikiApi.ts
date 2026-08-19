/**
 * Fliki AI API Integration Utility for 16:9 YouTube Video Export
 * Handles user voice cloning, religious image prompt extraction for "dla którego...",
 * Fliki REST API calls, status polling, and MP4 video URL generation.
 */

export interface FlikiScene {
  id: string;
  stepIndex: number;
  label: string;
  prayerType: string;
  text: string;
  clausulaText?: string;
  imageTopic: string;
  imagePrompt: string;
}

export interface FlikiVoice {
  id: string;
  name: string;
  lang: string;
  gender?: string;
  isCloned?: boolean;
}

const STORAGE_KEY_API_KEY = 'fliki_api_key';
const STORAGE_KEY_VOICE_ID = 'fliki_voice_id';
const STORAGE_KEY_MAKE_WEBHOOK = 'make_webhook_url';

export const getStoredFlikiApiKey = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEY_API_KEY) || '';
  } catch {
    return '';
  }
};

export const setStoredFlikiApiKey = (key: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY_API_KEY, key.trim());
  } catch {}
};

export const getStoredFlikiVoiceId = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEY_VOICE_ID) || 'deejaykey';
  } catch {
    return 'deejaykey';
  }
};

export const setStoredFlikiVoiceId = (voiceId: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY_VOICE_ID, voiceId.trim());
  } catch {}
};

export const getStoredMakeWebhookUrl = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEY_MAKE_WEBHOOK) || '';
  } catch {
    return '';
  }
};

export const setStoredMakeWebhookUrl = (url: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY_MAKE_WEBHOOK, url.trim());
  } catch {}
};

export interface MakeWebhookPayload {
  title: string;
  presentationMode: 'minimalist_16_9_widokinaraj';
  aspectRatio: '16:9';
  voiceId: string;
  customVoice: string;
  format: 'mp4';
  resolution: '1080p';
  styleNotes: string;
  scenes: Array<{
    beadIndex: number;
    stepLabel: string;
    text: string;
    clausulaText: string;
    imageTopic: string;
    mediaQuery: string;
    notes: string;
  }>;
  cycleInfo: {
    cycleType: string;
    dayOfCycle: number;
    dayIndex: number;
    cycleName: string;
    formattedDate: string;
  };
  flikiApiKey: string;
  flikiJsonString: string;
  fullScriptText?: string;
  content?: string;
  scriptText?: string;
  youtubeTitle?: string;
  youtubeDescription?: string;
}

export const buildMakeWebhookPayload = (
  steps: any[],
  prayers: Record<string, any>,
  cycleInfo: any,
  formattedDate: string,
  flikiApiKey: string,
  flikiVoiceId: string
): MakeWebhookPayload => {
  const selectedVoice = (flikiVoiceId && flikiVoiceId.trim()) ? flikiVoiceId.trim() : 'deejaykey';
  const rawScenes = buildFlikiScenesFromSteps(steps, prayers, cycleInfo);

  const formattedScenes = rawScenes.map((s, idx) => {
    const cleanText = (s.text || '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/"/g, '„')
      .trim();
    const cleanPrompt = (s.imagePrompt || '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/"/g, "'")
      .trim();
    const cleanClausula = (s.clausulaText || '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/"/g, "'")
      .trim();
    const cleanTopic = (s.imageTopic || '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/"/g, "'")
      .trim();

    return {
      beadIndex: idx + 1,
      stepLabel: s.label || `Paciorek ${idx + 1}`,
      text: cleanText,
      clausulaText: cleanClausula,
      imageTopic: cleanTopic,
      mediaQuery: cleanPrompt,
      notes: `Paciorek ${idx + 1} (${s.label}): Wezwanie: "${cleanClausula || 'Modlitwa'}" | Temat obrazu: ${cleanTopic}`
    };
  });

  const flikiRequestObj: any = {
    title: `RHZ365 ${cycleInfo.cycleName} - 16:9 Minimalistyczna`,
    aspectRatio: '16:9',
    format: 'mp4',
    scenes: formattedScenes.map(s => {
      const sceneObj: any = {
        text: s.text,
        mediaQuery: s.mediaQuery
      };
      if (selectedVoice && selectedVoice.length > 5) {
        sceneObj.voiceId = selectedVoice;
      }
      return sceneObj;
    })
  };

  if (selectedVoice && selectedVoice.length > 5) {
    flikiRequestObj.voiceId = selectedVoice;
  }

  const fullScriptText = formattedScenes.map(s => `[${s.stepLabel}]\n${s.text}`).join('\n\n');

  // Safe limits for YouTube API (Title max 100 chars, Description max 5000 chars)
  const baseTitle = `RHZ365 Dzień ${cycleInfo.dayOfCycle} - ${cycleInfo.cycleName}`.replace(/[<>]/g, '');
  const safeTitle = baseTitle.length > 90 ? baseTitle.slice(0, 87) + '...' : baseTitle;

  const rawDescription = `🌹 Różaniec Historii Zbawienia 16:9 (RHZ365)\n🌐 Portal: https://widokinaraj.pl\n🎙️ Lektor Custom Voice: deejaykey (Fliki AI)\n\n${fullScriptText}\n\n#Różaniec #RHZ365 #WidokiNaRaj #Modlitwa`.replace(/[<>]/g, '');
  const safeYoutubeDescription = rawDescription.length > 4400 
    ? rawDescription.slice(0, 4350) + '\n\n[...pełna treść rozważań dostępna na widokinaraj.pl]' 
    : rawDescription;

  return {
    title: safeTitle,
    presentationMode: 'minimalist_16_9_widokinaraj',
    aspectRatio: '16:9',
    voiceId: selectedVoice,
    customVoice: 'deejaykey',
    format: 'mp4',
    resolution: '1080p',
    styleNotes: 'Wersja minimalistyczna 16:9 wzorowana na widokinaraj.pl: osobny unikalny obraz sakralny dla każdego paciorka, podkład lektorski deejaykey z Fliki AI, subtelne napisy złote/białe na ciemnym tle.',
    scenes: formattedScenes,
    fullScriptText: fullScriptText,
    content: fullScriptText,
    scriptText: fullScriptText,
    youtubeTitle: safeTitle,
    youtubeDescription: safeYoutubeDescription,
    cycleInfo: {
      cycleType: cycleInfo.cycleType,
      dayOfCycle: cycleInfo.dayOfCycle,
      dayIndex: cycleInfo.dayIndex,
      cycleName: cycleInfo.cycleName,
      formattedDate: formattedDate
    },
    flikiApiKey: flikiApiKey || '',
    flikiJsonString: JSON.stringify(flikiRequestObj, null, 2)
  };
};

export const sendToMakeWebhook = async (
  webhookUrl: string,
  payload: MakeWebhookPayload
): Promise<{ success: boolean; message: string; responseData?: any }> => {
  if (!webhookUrl) {
    throw new Error('Wprowadź poprawny adres URL Webhooka z Make.com.');
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        success: false,
        message: `Błąd serwera Make.com HTTP ${res.status}: ${errText || res.statusText}`
      };
    }

    const resText = await res.text().catch(() => '');
    let resJson = null;
    try {
      resJson = JSON.parse(resText);
    } catch {}

    return {
      success: true,
      message: 'Pomyślnie przesłano dane do Make.com Webhook!',
      responseData: resJson || resText
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Wyjątek sieciowy podczas wysyłania do Make.com: ${err?.message || err}`
    };
  }
};

/**
 * Extracts the clausula / petition starting with "dla którego..." or "który..."
 * after the word "Jezus" in Hail Mary prayers, and determines a distinct 16:9 religious image prompt for EVERY bead.
 */
export const extractHailMaryClausula = (
  text: string, 
  defaultTitle: string = '',
  stepLabel?: string,
  stepIndex?: number
): { clausula: string; topic: string; imagePrompt: string } => {
  if (!text) {
    const beadName = stepLabel || (stepIndex !== undefined ? `Paciorek ${stepIndex + 1}` : 'Paciorek');
    return { 
      clausula: '', 
      topic: `${defaultTitle || 'Różaniec Święty'} (${beadName})`, 
      imagePrompt: `Catholic sacred art painting, 16:9 widescreen format, holy rosary prayer scene for ${beadName}, detailed classical catholic painting` 
    };
  }

  // 1. Regex to match "...Jezus, dla którego..." or "...Jezus, który..."
  const jezusMatch = text.match(/Jezus,?\s+((?:dla którego|który|którego)[^.!?;\n]+)/i);
  let clausula = '';
  if (jezusMatch && jezusMatch[1]) {
    clausula = jezusMatch[1].trim();
  }

  // 2. Map clausula or text keywords to specific Catholic sacred art topics
  let baseTopic = defaultTitle || 'Różaniec Święty';
  let basePrompt = 'Christian sacred art classical catholic painting holy rosary';

  const lowerText = (text + ' ' + clausula).toLowerCase();

  if (lowerText.includes('zwiastow') || lowerText.includes('gabriel') || lowerText.includes('poczęła')) {
    baseTopic = 'Zwiastowanie Najświętszej Maryi Pannie (Archanioł Gabriel)';
    basePrompt = 'The Annunciation of the Blessed Virgin Mary by Archangel Gabriel classical catholic sacred art masterpiece';
  } else if (lowerText.includes('elżbiet') || lowerText.includes('jan chrzciciel') || lowerText.includes('łonie matki') || lowerText.includes('nawiedz')) {
    baseTopic = 'Nawiedzenie świętej Elżbiety (Maryja i Elżbieta)';
    basePrompt = 'The Visitation of Mary to Saint Elizabeth Catholic sacred painting renaissance style';
  } else if (lowerText.includes('betlejem') || lowerText.includes('narodzi') || lowerText.includes('żłób') || lowerText.includes('pasterz')) {
    baseTopic = 'Narodzenie Pana Jezusa w Betlejem';
    basePrompt = 'The Nativity of Jesus Christ in Bethlehem holy night sacred art classical painting';
  } else if (lowerText.includes('ofiarow') || lowerText.includes('symeon') || lowerText.includes('świątyni')) {
    baseTopic = 'Ofiarowanie Pana Jezusa w Świątyni (Starzec Symeon)';
    basePrompt = 'Presentation of Lord Jesus in the Temple Saint Simeon Catholic sacred art';
  } else if (lowerText.includes('odnalezi') || lowerText.includes('znalezi') || lowerText.includes('12-letni') || lowerText.includes('nauczyciel')) {
    baseTopic = 'Odnalezienie 12-letniego Jezusa w Świątyni';
    basePrompt = 'Finding of the young child Jesus in the Temple teaching doctors Catholic sacred painting';
  } else if (lowerText.includes('ogrójec') || lowerText.includes('getsemani') || lowerText.includes('krew') || lowerText.includes('modlił się')) {
    baseTopic = 'Modlitwa Pana Jezusa w Ogrójcu (Getsemani)';
    basePrompt = 'Agony of Lord Jesus Christ in the Garden of Gethsemane sacred art baroque style';
  } else if (lowerText.includes('biczow') || lowerText.includes('słup')) {
    baseTopic = 'Biczowanie Pana Jezusa przy Słupie';
    basePrompt = 'Scourging of Jesus Christ at the Pillar Catholic sacred art painting';
  } else if (lowerText.includes('cierni') || lowerText.includes('koron')) {
    baseTopic = 'Cierniem Ukoronowanie Pana Jezusa';
    basePrompt = 'Crowning with Thorns of Jesus Christ Catholic sacred art';
  } else if (lowerText.includes('dźwiga') || lowerText.includes('droga krzyżowa') || lowerText.includes('kalwari')) {
    baseTopic = 'Dźwiganie Krzyża na Kalwarię';
    basePrompt = 'Jesus Christ carrying the Holy Cross to Calvary sacred art painting';
  } else if (lowerText.includes('ukrzyżowa') || lowerText.includes('śmierć') || lowerText.includes('krzyż')) {
    baseTopic = 'Ukrzyżowanie i Śmierć Pana Jezusa';
    basePrompt = 'The Crucifixion of Lord Jesus Christ on Golgotha classical sacred art';
  } else if (lowerText.includes('zmartwychwsta') || lowerText.includes('grób') || lowerText.includes('zwycięz')) {
    baseTopic = 'Zmartwychwstanie Pańskie';
    basePrompt = 'The Resurrection of Jesus Christ glorious light Catholic sacred art';
  } else if (lowerText.includes('wniebowstąp') || lowerText.includes('obłok')) {
    baseTopic = 'Wniebowstąpienie Pańskie';
    basePrompt = 'The Ascension of Lord Jesus Christ into Heaven sacred art painting';
  } else if (lowerText.includes('zesłan') || lowerText.includes('duch święty') || lowerText.includes('wieczernik') || lowerText.includes('języki ognia')) {
    baseTopic = 'Zesłanie Ducha Świętego w Wieczerniku';
    basePrompt = 'Pentecost Descent of the Holy Spirit upon Mary and Apostles sacred art';
  } else if (lowerText.includes('wniebowzię') || lowerText.includes('aniel')) {
    baseTopic = 'Wniebowzięcie Najświętszej Maryi Panny';
    basePrompt = 'Assumption of the Virgin Mary into Heaven sacred art baroque painting';
  } else if (lowerText.includes('ukoronowanie nmp') || lowerText.includes('królow') || lowerText.includes('nieba i ziemi')) {
    baseTopic = 'Ukoronowanie NMP na Królową Nieba i Ziemi';
    basePrompt = 'Coronation of the Blessed Virgin Mary Queen of Heaven sacred art';
  }

  const beadLabelStr = stepLabel || (stepIndex !== undefined ? `Paciorek ${stepIndex + 1}` : '');
  const topic = clausula 
    ? `${baseTopic} - ${clausula} (${beadLabelStr})` 
    : `${baseTopic} (${beadLabelStr})`;

  // Ensure UNIQUE, distinct 16:9 image prompt tailored specifically to this bead
  const cleanSnippet = (clausula || text.slice(0, 80)).replace(/["']/g, '').trim();
  const imagePrompt = clausula 
    ? `Catholic sacred art 16:9 widescreen painting depicting: "${cleanSnippet}", ${beadLabelStr}, baroque oil painting, golden spiritual glow, detailed masterpiece` 
    : `${basePrompt}, 16:9 widescreen format, depicting ${defaultTitle || 'sacred prayer'}, ${beadLabelStr}, high detail catholic art`;

  return { clausula, topic, imagePrompt };
};

/**
 * Converts prayer steps into Fliki scene structure for 16:9 YouTube video generation,
 * ensuring each bead gets its own distinct image prompt and clausula details.
 */
export const buildFlikiScenesFromSteps = (
  steps: any[],
  prayers: Record<string, any>,
  cycleInfo: { cycleType: string; dayOfCycle: number; cycleName: string }
): FlikiScene[] => {
  return steps.map((step, idx) => {
    let rawText = step.text || prayers[step.prayerType]?.text || '';
    const title = step.label || prayers[step.prayerType]?.title || `Paciorek ${idx + 1}`;

    const { clausula, topic, imagePrompt } = extractHailMaryClausula(rawText, title, title, idx);

    return {
      id: step.id || `step-${idx}`,
      stepIndex: idx,
      label: title,
      prayerType: step.prayerType || 'hailMary',
      text: rawText,
      clausulaText: clausula,
      imageTopic: topic,
      imagePrompt: imagePrompt
    };
  });
};

/**
 * Fetches available voices from Fliki REST API and identifies custom cloned voices like 'deejaykey'.
 */
export const fetchFlikiVoices = async (apiKey: string): Promise<FlikiVoice[]> => {
  if (!apiKey) throw new Error('Brak klucza Fliki API Key.');

  const res = await fetch('https://api.fliki.ai/v1/voices', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Błąd Fliki API (${res.status}): ${errText || res.statusText}`);
  }

  const data = await res.json();
  const rawList = Array.isArray(data) ? data : (data.voices || data.data || []);
  
  return rawList.map((v: any) => {
    const name = v.name || 'Głos AI';
    const isDeejaykey = name.toLowerCase().includes('deejaykey') || (v.id && String(v.id).toLowerCase().includes('deejaykey'));
    return {
      id: v.id || v._id || v.voiceId,
      name: isDeejaykey ? `${name} (Custom Voice)` : name,
      lang: v.language || v.lang || 'pl-PL',
      gender: v.gender,
      isCloned: Boolean(v.isCloned || v.cloned || v.custom || isDeejaykey)
    };
  });
};

export interface FlikiGenerateResult {
  success: boolean;
  videoId?: string;
  downloadUrl?: string;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  jsonScript?: any;
}

/**
 * Triggers video generation via Fliki API or generates JSON payload for Fliki project import.
 */
export const generateFlikiVideo = async (
  apiKey: string,
  voiceId: string,
  title: string,
  scenes: FlikiScene[]
): Promise<FlikiGenerateResult> => {
  const payload = {
    title: title || 'RHZ365 - Wersja Minimalistyczna 16:9',
    aspectRatio: '16:9',
    voiceId: voiceId || undefined,
    format: 'mp4',
    resolution: '1080p',
    scenes: scenes.map(s => ({
      text: s.text,
      voiceId: voiceId || undefined,
      mediaQuery: s.imagePrompt,
      notes: `Wezwanie: ${s.clausulaText || 'b.d.'} | Temat: ${s.imageTopic}`
    }))
  };

  if (!apiKey) {
    // Fallback: return formatted JSON payload if API Key is not set yet
    return {
      success: true,
      status: 'completed',
      message: 'Wygenerowano gotowy skrypt wideo (JSON) dla Fliki AI.',
      jsonScript: payload
    };
  }

  try {
    const res = await fetch('https://api.fliki.ai/v1/generate/video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const errMsg = errJson?.message || errJson?.error || `Błąd HTTP ${res.status}`;
      return {
        success: false,
        status: 'failed',
        message: `Nie udało się rozpocząć generowania wideo w Fliki API: ${errMsg}`,
        jsonScript: payload
      };
    }

    const data = await res.json();
    const videoId = data.id || data.videoId || data.jobId;
    const downloadUrl = data.downloadUrl || data.url;

    if (downloadUrl) {
      return {
        success: true,
        videoId,
        downloadUrl,
        status: 'completed',
        progress: 100,
        message: 'Wideo zostało wygenerowane pomyślnie!',
        jsonScript: payload
      };
    }

    return {
      success: true,
      videoId,
      status: 'processing',
      progress: 10,
      message: 'Rozpoczęto generowanie pliku MP4 w Fliki AI...',
      jsonScript: payload
    };
  } catch (err: any) {
    return {
      success: false,
      status: 'failed',
      message: `Wyjątek sieciowy podczas połączenia z Fliki API: ${err?.message || err}`,
      jsonScript: payload
    };
  }
};

/**
 * Polls Fliki API to check video generation progress and retrieve download link.
 */
export const checkFlikiVideoStatus = async (
  apiKey: string,
  videoId: string
): Promise<FlikiGenerateResult> => {
  if (!apiKey || !videoId) {
    throw new Error('Wymagany klucz API oraz ID wideo do sprawdzenia statusu.');
  }

  const res = await fetch(`https://api.fliki.ai/v1/generate/video/${videoId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Błąd sprawdzania statusu (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const status = data.status || (data.downloadUrl ? 'completed' : 'processing');
  const progress = data.progress || (status === 'completed' ? 100 : 50);

  return {
    success: true,
    videoId,
    downloadUrl: data.downloadUrl || data.url,
    status: status === 'completed' || status === 'done' ? 'completed' : (status === 'failed' ? 'failed' : 'processing'),
    progress,
    message: data.message || (status === 'completed' ? 'Gotowy plik MP4' : 'Przetwarzanie wideo...')
  };
};

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
    baseTopic = 'Wniebowzięcie Najświętszej Maryi Pannie';
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

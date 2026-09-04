import { sanitizeTextForTts } from './tts';

export interface RenderProgress {
  progress: number;
  message: string;
}

export interface BeadData {
  id: string;
  index: number;
  type: string;
  colorType: string;
  decadeIndex?: number;
}

export interface PrayerStep {
  id: string;
  prayerType: string;
  label: string;
  rgbaBeadId: string;
  cmykBeadId: string;
  text?: string;
  beadNumber?: number;
  decadeIndex?: number;
}

// Paleta kolorów paciorków (RGBA i CMYK)
const BEAD_COLORS: Record<string, { fill: string; stroke: string; glow: string; text: string }> = {
  white:   { fill: '#e2e8f0', stroke: '#94a3b8', glow: 'rgba(226,232,240,0.8)', text: '#1e293b' },
  black:   { fill: '#374151', stroke: '#6b7280', glow: 'rgba(55,65,81,0.8)',    text: '#f1f5f9' },
  red:     { fill: '#dc2626', stroke: '#f87171', glow: 'rgba(220,38,38,0.8)',   text: '#ffffff' },
  green:   { fill: '#16a34a', stroke: '#4ade80', glow: 'rgba(22,163,74,0.8)',   text: '#ffffff' },
  blue:    { fill: '#2563eb', stroke: '#60a5fa', glow: 'rgba(37,99,235,0.8)',   text: '#ffffff' },
  cyan:    { fill: '#0891b2', stroke: '#22d3ee', glow: 'rgba(8,145,178,0.8)',   text: '#ffffff' },
  magenta: { fill: '#a21caf', stroke: '#e879f9', glow: 'rgba(162,28,175,0.8)', text: '#ffffff' },
  yellow:  { fill: '#d97706', stroke: '#fbbf24', glow: 'rgba(217,119,6,0.8)',  text: '#1e293b' },
  transparent: { fill: 'rgba(56,189,248,0.12)', stroke: '#38bdf8', glow: 'rgba(56,189,248,0.5)', text: '#38bdf8' },
};

function drawBead(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  colorType: string,
  isActive: boolean,
  isRgba: boolean,
  label: string,
  t: number
): void {
  const palette = BEAD_COLORS[colorType] || BEAD_COLORS['black'];
  const activeColor = isRgba ? '#38bdf8' : '#fbbf24';
  const activeGlow  = isRgba ? 'rgba(56,189,248,0.6)' : 'rgba(251,191,36,0.6)';

  if (isActive) {
    // Pulsujący glow
    const pulse = 1 + 0.3 * Math.sin(t * 6);
    const glowR = r * 1.7 * pulse;
    const grd = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, glowR);
    grd.addColorStop(0, activeGlow);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Gradient kulki
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.05, cx, cy, r);
  const lighter = palette.fill;
  grad.addColorStop(0, lighter + 'ff');
  grad.addColorStop(1, lighter + '99');

  ctx.save();
  ctx.shadowColor = isActive ? activeGlow : palette.glow;
  ctx.shadowBlur = isActive ? 18 : 6;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = isActive ? activeColor : palette.stroke;
  ctx.lineWidth = isActive ? 3 : 1.5;
  ctx.stroke();
  ctx.restore();

  // Etykieta w środku (krzyż, IHS, litera)
  if (label) {
    ctx.save();
    ctx.fillStyle = isActive ? activeColor : palette.text;
    ctx.font = `bold ${Math.floor(r * 0.8)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy);
    ctx.restore();
  }
}

function drawBeadStrip(
  ctx: CanvasRenderingContext2D,
  beadsList: BeadData[],
  activeId: string,
  centerX: number,
  centerY: number,
  isRgba: boolean,
  t: number
): void {
  const STRIP_H = 360;
  const BEAD_SPACING = STRIP_H / 5;
  const activeIndex = beadsList.findIndex(b => b.id === activeId);

  // Pionowa linia-nić
  const lineGrad = ctx.createLinearGradient(centerX, centerY - STRIP_H / 2, centerX, centerY + STRIP_H / 2);
  lineGrad.addColorStop(0, 'rgba(0,0,0,0)');
  lineGrad.addColorStop(0.5, isRgba ? 'rgba(56,189,248,0.25)' : 'rgba(251,191,36,0.25)');
  lineGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - STRIP_H / 2);
  ctx.lineTo(centerX, centerY + STRIP_H / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Nagłówek paska
  ctx.save();
  ctx.fillStyle = isRgba ? '#38bdf8' : '#fbbf24';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.7;
  ctx.fillText(isRgba ? 'RGBA' : 'CMYK', centerX, centerY - STRIP_H / 2 - 16);
  ctx.restore();

  if (activeIndex === -1) return;

  // Okno 5 paciorków: -2, -1, 0, +1, +2
  const offsets = [-2, -1, 0, 1, 2];
  offsets.forEach((offset, i) => {
    const idx = activeIndex + offset;
    if (idx < 0 || idx >= beadsList.length) return;
    const bead = beadsList[idx];
    if (!bead || bead.type === 'connector') return;

    const isActive = offset === 0;
    const beadY = centerY + offset * BEAD_SPACING;
    const r = isActive ? 22 : 14;
    const opacity = isActive ? 1 : Math.max(0.25, 1 - Math.abs(offset) * 0.35);

    let label = '';
    if (bead.type === 'cross') label = '†';
    else if (bead.type === 'connector') label = 'IHS';
    else if (bead.type === 'decade-separator') {
      const dec = (bead.decadeIndex ?? 0) + 1;
      label = `D${dec}`;
    }

    ctx.globalAlpha = opacity;
    drawBead(ctx, centerX, beadY, r, bead.colorType, isActive, isRgba, label, t);
    ctx.globalAlpha = 1;
  });
}

interface SceneChunk {
  text: string;
  label: string;
  steps: { text: string; rgbaBeadId: string; cmykBeadId: string; label: string }[];
  promptKeywords: string;
}

function buildSceneChunks(
  textInput: string,
  stepsData?: PrayerStep[],
  titleFallback: string = 'Modlitwa'
): SceneChunk[] {
  const chunks: SceneChunk[] = [];
  const TARGET_WORDS_PER_SCENE = 30; // ~12-15s czas czytania lektora (ok. 2.2 słów/sek)

  if (stepsData && stepsData.length > 0) {
    // Exactly 1 image per prayer bead step (16 beads = 16 images)
    for (let i = 0; i < stepsData.length; i++) {
      const step = stepsData[i];
      const stepText = (step.text || '').trim();
      if (!stepText) continue;
      chunks.push({
        text: stepText,
        label: step.label || `Paciorek ${i + 1}`,
        steps: [{
          text: stepText,
          rgbaBeadId: step.rgbaBeadId || '',
          cmykBeadId: step.cmykBeadId || '',
          label: step.label || ''
        }],
        promptKeywords: stepText.slice(0, 120)
      });
    }
  } else {
    // Balance text into exactly 16 scene chunks (16 images for 16 beads)
    const TARGET_CHUNKS = 16;
    const rawSentences = textInput.split(/[.!?]\s+/).map(s => s.trim()).filter(s => s.length > 0);
    if (rawSentences.length === 0) rawSentences.push(textInput);

    if (rawSentences.length <= TARGET_CHUNKS) {
      for (const sent of rawSentences) {
        chunks.push({
          text: sent,
          label: titleFallback,
          steps: [{ text: sent, rgbaBeadId: '', cmykBeadId: '', label: titleFallback }],
          promptKeywords: sent.slice(0, 120)
        });
      }
    } else {
      const groupSize = Math.ceil(rawSentences.length / TARGET_CHUNKS);
      for (let i = 0; i < rawSentences.length; i += groupSize) {
        const fullText = rawSentences.slice(i, i + groupSize).join('. ') + '.';
        chunks.push({
          text: fullText,
          label: titleFallback,
          steps: [{ text: fullText, rgbaBeadId: '', cmykBeadId: '', label: titleFallback }],
          promptKeywords: fullText.slice(0, 120)
        });
        if (chunks.length === TARGET_CHUNKS) break;
      }
    }
  }

  if (chunks.length === 0) {
    chunks.push({
      text: textInput || titleFallback,
      label: titleFallback,
      steps: [{ text: textInput || titleFallback, rgbaBeadId: '', cmykBeadId: '', label: titleFallback }],
      promptKeywords: titleFallback
    });
  }

  return chunks;
}

async function fetchTTSForText(
  text: string,
  audioContext: AudioContext
): Promise<AudioBuffer> {
  const cleanText = sanitizeTextForTts(text);
  const words = cleanText.split(/\s+/);
  const subChunks: string[] = [];
  let currentChunk = '';

  for (const word of words) {
    if ((currentChunk + ' ' + word).length > 150) {
      if (currentChunk) subChunks.push(currentChunk);
      currentChunk = word;
    } else {
      currentChunk = currentChunk ? currentChunk + ' ' + word : word;
    }
  }
  if (currentChunk) subChunks.push(currentChunk);

  const buffers: AudioBuffer[] = [];
  for (const chunkText of subChunks) {
    if (!chunkText.trim()) continue;
    try {
      const ttsUrl = `/api/tts?lang=pl&text=${encodeURIComponent(chunkText.trim())}`;
      const res = await fetch(ttsUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuf = await res.arrayBuffer();
      const decoded = await audioContext.decodeAudioData(arrayBuf);
      buffers.push(decoded);
    } catch (e) {
      // Cicha pauza jako fallback
      const silent = audioContext.createBuffer(1, audioContext.sampleRate * 1.0, audioContext.sampleRate);
      buffers.push(silent);
    }
  }

  if (buffers.length === 0) {
    return audioContext.createBuffer(1, audioContext.sampleRate * 2.0, audioContext.sampleRate);
  }

  const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
  const result = audioContext.createBuffer(
    buffers[0].numberOfChannels,
    totalLength,
    buffers[0].sampleRate
  );
  let offset = 0;
  for (const b of buffers) {
    for (let ch = 0; ch < b.numberOfChannels; ch++) {
      result.getChannelData(ch).set(b.getChannelData(ch), offset);
    }
    offset += b.length;
  }
  return result;
}

export const generateVideoClientSide = async (
  text: string,
  fishApiKey: string,
  voiceSampleUrlOrPath: string,
  onProgress: (state: RenderProgress) => void,
  stepsData?: PrayerStep[],
  rgbaBeads?: BeadData[],
  cmykBeads?: BeadData[],
  titleFallback: string = 'Modlitwa Różańcowa'
): Promise<string> => {
  try {
    // 1. Podział na sceny trwające co kilkanaście sekund (12-15s)
    onProgress({ progress: 10, message: 'Przygotowywanie scen 12–15-sekundowych...' });
    const sceneChunks = buildSceneChunks(text, stepsData, titleFallback);

    // 2. Pobieranie obrazów sakralnych dopasowanych do treści sceny z Pollinations.ai
    onProgress({ progress: 15, message: `Pobieranie ${sceneChunks.length} ilustracji sakralnych 16:9 (zmiana co 12–15s)...` });
    
    const images: HTMLImageElement[] = [];
    const imageCache = new Map<string, HTMLImageElement>();

    for (let i = 0; i < sceneChunks.length; i++) {
      onProgress({
        progress: 15 + Math.floor((i / sceneChunks.length) * 20),
        message: `Generowanie obrazu dla sceny ${i + 1}/${sceneChunks.length}...`
      });

      const chunk = sceneChunks[i];
      const cacheKey = chunk.promptKeywords.slice(0, 40);

      if (imageCache.has(cacheKey)) {
        images.push(imageCache.get(cacheKey)!);
        continue;
      }

      const MASTERPIECE_SACRED_URLS = [
          "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Leonardo_da_Vinci_%281452-1519%29_-_The_Last_Supper_%281495-1498%29.jpg/1280px-Leonardo_da_Vinci_%281452-1519%29_-_The_Last_Supper_%281495-1498%29.jpg",
          "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Fra_Angelico_-_The_Annunciation_-_WGA00473.jpg/1280px-Fra_Angelico_-_The_Annunciation_-_WGA00473.jpg",
          "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/RAFAEL_-_Madonna_Sixtina_%28Gem%C3%A4ldegalerie_Alter_Meister%2C_Dresden%2C_1513-14._%C3%93leo_sobre_lienzo%2C_265_x_196_cm%29.jpg/1280px-RAFAEL_-_Madonna_Sixtina_%28Gem%C3%A4ldegalerie_Alter_Meister%2C_Dresden%2C_1513-14._%C3%93leo_sobre_lienzo%2C_265_x_196_cm%29.jpg",
          "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Michelangelo%27s_%22God%22%2C_from_%22the_Creation_of_Adam%22.jpg/1280px-Michelangelo%27s_%22God%22%2C_from_%22the_Creation_of_Adam%22.jpg",
          "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/God_the_Father_and_angels%2C_Pietro_Perugino%2C_Stanza_dell%27Incendio_di_Borgo%2C_medalion%2C_part_of_the_ceiling%2C_Vatican_City_1.jpg/1280px-God_the_Father_and_angels%2C_Pietro_Perugino%2C_Stanza_dell%27Incendio_di_Borgo%2C_medalion%2C_part_of_the_ceiling%2C_Vatican_City_1.jpg",
          "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Bartolom%C3%A9_Esteban_Murillo_-_The_Immaculate_Conception_of_Los_Venerables_-_Prado.jpg/1280px-Bartolom%C3%A9_Esteban_Murillo_-_The_Immaculate_Conception_of_Los_Venerables_-_Prado.jpg"
        ];

        const selectedMasterpieceUrl = MASTERPIECE_SACRED_URLS[i % MASTERPIECE_SACRED_URLS.length];

        const loaded = await new Promise<HTMLImageElement>((res) => {
          const tempImg = new Image();
          tempImg.crossOrigin = 'anonymous';
          tempImg.onload = () => res(tempImg);
          tempImg.onerror = () => {
            // High-detail Renaissance fallback canvas
            const fbCanvas = document.createElement('canvas');
            fbCanvas.width = 1280; fbCanvas.height = 720;
            const c = fbCanvas.getContext('2d')!;
            const g = c.createRadialGradient(640, 200, 30, 640, 200, 600);
            g.addColorStop(0, '#312e81');
            g.addColorStop(0.6, '#0f172a');
            g.addColorStop(1, '#020617');
            c.fillStyle = g;
            c.fillRect(0, 0, 1280, 720);
            const fbImg = new Image();
            fbImg.onload = () => res(fbImg);
            fbImg.src = fbCanvas.toDataURL();
          };
          tempImg.src = selectedMasterpieceUrl;
        });

        imageCache.set(cacheKey, loaded);
        images.push(loaded);
        await new Promise(r => setTimeout(r, 50));
      }

      // 3. Synteza głosu lektora TTS dla każdej sceny
      onProgress({ progress: 40, message: 'Przygotowywanie ścieżki lektora...' });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      interface SceneTiming { start: number; end: number; duration: number; }
      const sceneTimings: SceneTiming[] = [];
      const sceneBuffers: AudioBuffer[] = [];

      for (let i = 0; i < sceneChunks.length; i++) {
        onProgress({
          progress: 40 + Math.floor((i / sceneChunks.length) * 20),
          message: `Lektor: scena ${i + 1}/${sceneChunks.length}...`
        });

        const buf = await fetchTTSForText(sceneChunks[i].text, audioContext);
        sceneBuffers.push(buf);
      }

      // Połączenie ścieżek audio scen
      let totalSamples = sceneBuffers.reduce((a, b) => a + b.length, 0);
      if (totalSamples === 0) totalSamples = audioContext.sampleRate * 5;

      const audioBuffer = audioContext.createBuffer(
        sceneBuffers[0]?.numberOfChannels || 1,
        totalSamples,
        sceneBuffers[0]?.sampleRate || audioContext.sampleRate
      );

      let offset = 0;
      for (const buf of sceneBuffers) {
        const startSec = offset / buf.sampleRate;
        const durationSec = buf.duration;
        sceneTimings.push({ start: startSec, end: startSec + durationSec, duration: durationSec });
        for (let ch = 0; ch < buf.numberOfChannels; ch++) {
          audioBuffer.getChannelData(ch).set(buf.getChannelData(ch), offset);
        }
        offset += buf.length;
      }

      const totalDuration = audioBuffer.duration || 5;

      // 4. Renderowanie wideo na Canvas i nagrywanie MediaRecorder
      onProgress({ progress: 65, message: 'Montowanie wideo MP4 z podświetlaniem tekstu...' });

      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d')!;
      const W = canvas.width, H = canvas.height;

      const stream = canvas.captureStream(30);
      const dest = audioContext.createMediaStreamDestination();
      const bufferSource = audioContext.createBufferSource();
      bufferSource.buffer = audioBuffer;
      bufferSource.connect(dest);

      const combinedStream = new MediaStream([
        ...stream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 4000000
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      return new Promise<string>((resolve) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          resolve(URL.createObjectURL(blob));
        };

        mediaRecorder.start(100);
        bufferSource.start(0);

        const startTime = performance.now();

      const renderLoop = () => {
        const now = performance.now();
        const t = (now - startTime) / 1000;

        if (t >= totalDuration) {
          mediaRecorder.stop();
          stream.getTracks().forEach(track => track.stop());
          try { bufferSource?.stop(); } catch {}
          return;
        }

        const pct = 65 + Math.floor((t / totalDuration) * 33);
        onProgress({ progress: pct, message: `Renderowanie wideo: ${t.toFixed(1)}s / ${totalDuration.toFixed(1)}s` });

        let sceneIndex = sceneTimings.length - 1;
        for (let i = 0; i < sceneTimings.length; i++) {
          if (t >= sceneTimings[i].start && t < sceneTimings[i].end) {
            sceneIndex = i;
            break;
          }
        }
        if (sceneIndex < 0) sceneIndex = 0;

        const currentChunk = sceneChunks[sceneIndex];
        const img = images[sceneIndex];

        const sceneTiming = sceneTimings[sceneIndex];
        const relTime = t - sceneTiming.start;
        const subRatio = sceneTiming.duration > 0 ? relTime / sceneTiming.duration : 0;
        const stepIdx = Math.min(
          Math.floor(subRatio * currentChunk.steps.length),
          currentChunk.steps.length - 1
        );
        const activeStep = currentChunk.steps[stepIdx] || currentChunk.steps[0];

        // ── TŁO: Klasyczne arcydzieło sakralne ────────────────────
        ctx.drawImage(img, 0, 0, W, H);

        // Winieta
        const vigL = ctx.createLinearGradient(0, 0, 260, 0);
        vigL.addColorStop(0, 'rgba(0,0,0,0.85)');
        vigL.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = vigL;
        ctx.fillRect(0, 0, 260, H);

        const vigR = ctx.createLinearGradient(W, 0, W - 260, 0);
        vigR.addColorStop(0, 'rgba(0,0,0,0.85)');
        vigR.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = vigR;
        ctx.fillRect(W - 260, 0, 260, H);

        const botGrad = ctx.createLinearGradient(0, H - 240, 0, H);
        botGrad.addColorStop(0, 'rgba(0,0,0,0)');
        botGrad.addColorStop(1, 'rgba(10,12,22,0.96)');
        ctx.fillStyle = botGrad;
        ctx.fillRect(0, H - 240, W, 240);

        // ── PASKI RÓŻAŃCA (RGBA & CMYK) ──────────────────────────
        if (rgbaBeads && cmykBeads && activeStep?.rgbaBeadId && activeStep?.cmykBeadId) {
          ctx.save();
          drawBeadStrip(ctx, rgbaBeads, activeStep.rgbaBeadId, 100, H / 2, true, t);
          ctx.restore();

          ctx.save();
          drawBeadStrip(ctx, cmykBeads, activeStep.cmykBeadId, W - 100, H / 2, false, t);
          ctx.restore();
        }

        // ── ŚRODKOWY TEKST MODLITWY Z AKTYWNYM KARAOKE (SŁOWO PO SŁOWIE) ──
        const textMaxW = W - 540, textBaseY = H - 110;
        const activeLabel = activeStep?.label || currentChunk.label;

        if (activeLabel) {
          ctx.save();
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 14px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`📿 ${activeLabel.toUpperCase()}`, W / 2, textBaseY - 60);
          ctx.restore();
        }

        const displayText = activeStep?.text || currentChunk.text;
        const words = displayText.split(/\s+/).filter(w => w.length > 0);
        const activeWordIdx = Math.min(
          Math.floor((relTime / Math.max(sceneTiming.duration, 0.1)) * words.length),
          words.length - 1
        );

        ctx.save();
        ctx.font = 'bold 24px serif';
        ctx.textBaseline = 'middle';

        const linesWithWords: { word: string; idx: number }[][] = [];
        let currentLineWords: { word: string; idx: number }[] = [];
        let currentLineWidth = 0;

        for (let wi = 0; wi < words.length; wi++) {
          const w = words[wi];
          const wWidth = ctx.measureText(w + ' ').width;
          if (currentLineWidth + wWidth > textMaxW && currentLineWords.length > 0) {
            linesWithWords.push(currentLineWords);
            currentLineWords = [];
            currentLineWidth = 0;
          }
          currentLineWords.push({ word: w, idx: wi });
          currentLineWidth += wWidth;
        }
        if (currentLineWords.length > 0) linesWithWords.push(currentLineWords);

        const lineH = 36;
        const totalTextH = linesWithWords.length * lineH;
        const startY = textBaseY - totalTextH / 2 + lineH / 2;

        linesWithWords.forEach((lWords, li) => {
          const lY = startY + li * lineH;
          const fullLineText = lWords.map(lw => lw.word).join(' ');
          const fullLineWidth = ctx.measureText(fullLineText).width;
          let curX = (W - fullLineWidth) / 2;

          lWords.forEach(lw => {
            const isWordActive = lw.idx === activeWordIdx;
            const isWordPast = lw.idx < activeWordIdx;

            if (isWordActive) {
              ctx.fillStyle = '#fbbf24'; // Active word: glowing gold
              ctx.shadowColor = 'rgba(251,191,36,0.9)';
              ctx.shadowBlur = 16;
            } else if (isWordPast) {
              ctx.fillStyle = '#fef08a'; // Past words: light warm gold
              ctx.shadowBlur = 0;
            } else {
              ctx.fillStyle = '#cbd5e1'; // Upcoming words: light slate
              ctx.shadowBlur = 0;
            }

            ctx.fillText(lw.word, curX, lY);
            curX += ctx.measureText(lw.word + ' ').width;
          });
        });
        ctx.restore();

        const progW = (t / totalDuration) * W;
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(0, H - 4, W, 4);
        const progGrad = ctx.createLinearGradient(0, 0, progW, 0);
        progGrad.addColorStop(0, '#6366f1');
        progGrad.addColorStop(0.5, '#38bdf8');
        progGrad.addColorStop(1, '#fbbf24');
        ctx.fillStyle = progGrad;
        ctx.fillRect(0, H - 4, progW, 4);
        ctx.restore();

        setTimeout(renderLoop, 40);
      };

      setTimeout(renderLoop, 40);
    });

  } catch (error: any) {
    onProgress({ progress: 0, message: `Błąd renderowania: ${error.message}` });
    throw error;
  }
};

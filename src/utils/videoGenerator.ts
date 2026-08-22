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
    let currentSteps: { text: string; rgbaBeadId: string; cmykBeadId: string; label: string }[] = [];
    let currentWords = 0;
    let currentLabel = '';

    for (const step of stepsData) {
      const stepText = (step.text || '').trim();
      if (!stepText) continue;

      const wordsInStep = stepText.split(/\s+/).length;
      if (!currentLabel) currentLabel = step.label || titleFallback;

      currentSteps.push({
        text: stepText,
        rgbaBeadId: step.rgbaBeadId || '',
        cmykBeadId: step.cmykBeadId || '',
        label: step.label || ''
      });
      currentWords += wordsInStep;

      // Gdy zgromadzimy ok. 30 słów (12-15 sekund) domykamy scenę
      if (currentWords >= TARGET_WORDS_PER_SCENE) {
        const fullText = currentSteps.map(s => s.text).join(' ');
        chunks.push({
          text: fullText,
          label: currentLabel,
          steps: [...currentSteps],
          promptKeywords: fullText.slice(0, 120)
        });
        currentSteps = [];
        currentWords = 0;
        currentLabel = '';
      }
    }

    if (currentSteps.length > 0) {
      const fullText = currentSteps.map(s => s.text).join(' ');
      chunks.push({
        text: fullText,
        label: currentLabel || titleFallback,
        steps: [...currentSteps],
        promptKeywords: fullText.slice(0, 120)
      });
    }
  } else {
    // Tekst zebrany z wpisu blogowego WnR365
    const paragraphs = textInput.split(/\n+/).filter(p => p.trim().length > 0);
    const rawSentences: string[] = [];
    for (const para of paragraphs) {
      const sents = para.split(/[.!?]\s+/).filter(s => s.trim().length > 0);
      rawSentences.push(...sents);
    }
    if (rawSentences.length === 0) rawSentences.push(textInput);

    let curSentenceGroup: string[] = [];
    let curWords = 0;

    for (const sentence of rawSentences) {
      const words = sentence.trim().split(/\s+/).length;
      curSentenceGroup.push(sentence.trim());
      curWords += words;

      if (curWords >= TARGET_WORDS_PER_SCENE) {
        const fullText = curSentenceGroup.join('. ') + '.';
        chunks.push({
          text: fullText,
          label: titleFallback,
          steps: [{ text: fullText, rgbaBeadId: '', cmykBeadId: '', label: titleFallback }],
          promptKeywords: fullText.slice(0, 120)
        });
        curSentenceGroup = [];
        curWords = 0;
      }
    }

    if (curSentenceGroup.length > 0) {
      const fullText = curSentenceGroup.join('. ') + '.';
      chunks.push({
        text: fullText,
        label: titleFallback,
        steps: [{ text: fullText, rgbaBeadId: '', cmykBeadId: '', label: titleFallback }],
        promptKeywords: fullText.slice(0, 120)
      });
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
  const words = text.split(/\s+/);
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

      const cleanPrompt = encodeURIComponent(`holy sacred christian painting, baroque style, soft cinematic light, ${chunk.promptKeywords}`);
      const seed = Math.floor(Math.random() * 1000000);
      const url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1280&height=720&nologo=true&seed=${seed}`;

      const img = await new Promise<HTMLImageElement>((resolve) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        let timeoutId: any;

        const finish = (result: HTMLImageElement) => {
          clearTimeout(timeoutId);
          imageCache.set(cacheKey, result);
          resolve(result);
        };

        image.onload = () => finish(image);

        const handleFallback = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 1280; canvas.height = 720;
          const c = canvas.getContext('2d')!;
          const grd = c.createRadialGradient(640, 360, 50, 640, 360, 600);
          grd.addColorStop(0, '#1e1b4b');
          grd.addColorStop(1, '#090d16');
          c.fillStyle = grd;
          c.fillRect(0, 0, 1280, 720);
          c.fillStyle = '#fbbf24';
          c.font = 'bold 36px serif';
          c.textAlign = 'center';
          c.fillText(chunk.label || titleFallback, 640, 340);
          c.fillStyle = '#94a3b8';
          c.font = '18px sans-serif';
          c.fillText('WnR365 • RHZ365', 640, 390);

          const fb = new Image();
          fb.onload = () => finish(fb);
          fb.src = canvas.toDataURL();
        };

        image.onerror = handleFallback;
        timeoutId = setTimeout(() => {
          image.src = '';
          handleFallback();
        }, 3000);

        image.src = url;
      });

      images.push(img);
      await new Promise(r => setTimeout(r, 100));
    }

    // 3. Synteza głosu lektora TTS dla każdej sceny
    onProgress({ progress: 40, message: 'Synteza lektora AI TTS dla pełnej treści...' });
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    interface SceneTiming { start: number; end: number; duration: number; }
    const sceneTimings: SceneTiming[] = [];
    const sceneBuffers: AudioBuffer[] = [];

    for (let i = 0; i < sceneChunks.length; i++) {
      onProgress({
        progress: 40 + Math.floor((i / sceneChunks.length) * 20),
        message: `Nagrywanie lektora: scena ${i + 1}/${sceneChunks.length}...`
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

    // 4. Montaż wideo na HTML Canvas
    onProgress({ progress: 65, message: 'Rozpoczynanie nagrywania pliku wideo 16:9...' });

    const W = 1280, H = 720;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    const stream = canvas.captureStream(25);
    let mediaRecorder: MediaRecorder;
    const audioTracks: MediaStreamTrack[] = [];
    let bufferSource: AudioBufferSourceNode | null = null;

    if (audioBuffer) {
      const dest = audioContext.createMediaStreamDestination();
      bufferSource = audioContext.createBufferSource();
      bufferSource.buffer = audioBuffer;
      bufferSource.connect(dest);

      const gain = audioContext.createGain();
      gain.gain.value = 0;
      bufferSource.connect(gain);
      gain.connect(audioContext.destination);
      dest.stream.getAudioTracks().forEach(t => audioTracks.push(t));

      const combined = new MediaStream([...stream.getVideoTracks(), ...audioTracks]);
      let mime = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';
      mediaRecorder = new MediaRecorder(combined, { mimeType: mime });

      if (audioContext.state === 'suspended') await audioContext.resume();
      bufferSource.start(0);
    } else {
      let mime = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm;codecs=vp8';
      if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';
      mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
    }

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };

    const totalDuration = audioBuffer.duration;
    const audioStartTime = audioContext.currentTime;

    return new Promise<string>((resolve) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(URL.createObjectURL(blob));
      };

      mediaRecorder.start(1000);
      const startTime = performance.now();

      const renderLoop = () => {
        const t = audioBuffer 
          ? (audioContext.currentTime - audioStartTime) 
          : ((performance.now() - startTime) / 1000);

        if (t >= totalDuration) {
          mediaRecorder.stop();
          stream.getTracks().forEach(track => track.stop());
          try { bufferSource?.stop(); } catch {}
          return;
        }

        const pct = 65 + Math.floor((t / totalDuration) * 33);
        onProgress({ progress: pct, message: `Renderowanie wideo: ${t.toFixed(1)}s / ${totalDuration.toFixed(1)}s` });

        // Wybór aktywnej sceny (zmiana obrazka co kilkanaście sekund)
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

        // Wyznaczenie aktywnego kroku/paciorka wewnątrz sceny
        const sceneTiming = sceneTimings[sceneIndex];
        const relTime = t - sceneTiming.start;
        const subRatio = sceneTiming.duration > 0 ? relTime / sceneTiming.duration : 0;
        const stepIdx = Math.min(
          Math.floor(subRatio * currentChunk.steps.length),
          currentChunk.steps.length - 1
        );
        const activeStep = currentChunk.steps[stepIdx] || currentChunk.steps[0];

        // ── TŁO: Obraz z Pollinations (zmiana co 12-15s) ─────────
        ctx.drawImage(img, 0, 0, W, H);

        // Winieta po bokach i na dole
        const vigL = ctx.createLinearGradient(0, 0, 260, 0);
        vigL.addColorStop(0, 'rgba(0,0,0,0.8)');
        vigL.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = vigL;
        ctx.fillRect(0, 0, 260, H);

        const vigR = ctx.createLinearGradient(W, 0, W - 260, 0);
        vigR.addColorStop(0, 'rgba(0,0,0,0.8)');
        vigR.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = vigR;
        ctx.fillRect(W - 260, 0, 260, H);

        const botGrad = ctx.createLinearGradient(0, H - 240, 0, H);
        botGrad.addColorStop(0, 'rgba(0,0,0,0)');
        botGrad.addColorStop(1, 'rgba(0,0,0,0.92)');
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
        } else {
          // Środkowy pulsujący symbol IHS
          const bPulse = 24 + Math.sin(t * 5) * 6;
          ctx.save();
          const grd = ctx.createRadialGradient(W/2, H - 280, bPulse*0.3, W/2, H - 280, bPulse*1.8);
          grd.addColorStop(0, 'rgba(251,191,36,0.5)');
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(W/2, H - 280, bPulse*1.8, 0, Math.PI * 2);
          ctx.fill();

          const grad = ctx.createRadialGradient(W/2 - bPulse*0.3, H - 280 - bPulse*0.3, bPulse*0.1, W/2, H - 280, bPulse);
          grad.addColorStop(0, '#fcd34d');
          grad.addColorStop(1, '#d97706');
          
          ctx.beginPath();
          ctx.arc(W/2, H - 280, bPulse, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.shadowColor = 'rgba(251,191,36,0.8)';
          ctx.shadowBlur = 20;
          ctx.fill();
          ctx.shadowBlur = 0;
          
          ctx.fillStyle = '#78350f';
          ctx.font = `bold ${Math.floor(bPulse*0.6)}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('IHS', W/2, H - 280);
          ctx.restore();
        }

        // ── ŚRODKOWY TEKST MODLITWY ──────────────────────────────
        const textMaxW = W - 540, textBaseY = H - 130;
        const activeLabel = activeStep?.label || currentChunk.label;

        if (activeLabel) {
          ctx.save();
          ctx.fillStyle = 'rgba(56,189,248,0.9)';
          ctx.font = 'bold 13px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(activeLabel.toUpperCase(), W / 2, textBaseY - 50);
          ctx.restore();
        }

        // Zawijanie tekstu aktywnego kroku
        const displayText = activeStep?.text || currentChunk.text;
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const words = displayText.split(' ');
        const lineH = 36;
        let curLine = '';
        const wrappedLines: string[] = [];
        for (const word of words) {
          const test = curLine ? curLine + ' ' + word : word;
          if (ctx.measureText(test).width > textMaxW) {
            if (curLine) wrappedLines.push(curLine);
            curLine = word;
          } else {
            curLine = test;
          }
        }
        if (curLine) wrappedLines.push(curLine);

        const totalTextH = wrappedLines.length * lineH;
        const startY = textBaseY - totalTextH / 2 + lineH / 2;
        wrappedLines.forEach((line, i) => {
          ctx.fillText(line, W / 2, startY + i * lineH);
        });
        ctx.restore();

        // Pasek postępu na dole
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

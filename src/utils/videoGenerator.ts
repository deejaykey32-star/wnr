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

export const generateVideoClientSide = async (
  text: string,
  fishApiKey: string,
  voiceSampleUrlOrPath: string,
  onProgress: (state: RenderProgress) => void,
  stepsData?: PrayerStep[],
  rgbaBeads?: BeadData[],
  cmykBeads?: BeadData[]
): Promise<string> => {
  try {
    // 1. Podział tekstu na sceny (po jednym kroku modlitwy)
    onProgress({ progress: 10, message: 'Przygotowywanie scen modlitwy...' });
    
    // Jeśli mamy steps, każdy step to osobna scena
    let scenes: { text: string; rgbaBeadId: string; cmykBeadId: string; label: string }[] = [];
    if (stepsData && stepsData.length > 0) {
      scenes = stepsData
        .map(step => ({
          text: step.text?.trim() || '',
          rgbaBeadId: step.rgbaBeadId || '',
          cmykBeadId: step.cmykBeadId || '',
          label: step.label || ''
        }))
        .filter(s => s.text.length > 2);
    } else {
      const sentences = text.split(/[.!?]\s+/).filter(s => s.trim().length > 3);
      if (sentences.length === 0) sentences.push(text);
      scenes = sentences.map(s => ({ text: s, rgbaBeadId: '', cmykBeadId: '', label: '' }));
    }

    // 2. Generowanie obrazów w tle (Pollinations.ai) — jeden obraz na scenę
    onProgress({ progress: 20, message: `Generowanie ${scenes.length} obrazów sakralnych 16:9...` });
    const imageUrls = scenes.map((scene) => {
      const cleanPrompt = encodeURIComponent(`holy sacred christian painting, baroque style, soft light, ${scene.text.slice(0, 80)}`);
      const seed = Math.floor(Math.random() * 1000000);
      return `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1280&height=720&nologo=true&seed=${seed}`;
    });

    const images: HTMLImageElement[] = await Promise.all(
      imageUrls.map((url) => {
        return new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => {
            // Fallback: ciemne tło z tekstem
            const canvas = document.createElement('canvas');
            canvas.width = 1280; canvas.height = 720;
            const c = canvas.getContext('2d')!;
            c.fillStyle = '#0f172a';
            c.fillRect(0, 0, 1280, 720);
            c.fillStyle = '#fbbf24';
            c.font = 'bold 36px serif';
            c.textAlign = 'center';
            c.fillText('Modlitwa Różańcowa', 640, 360);
            const fb = new Image();
            fb.src = canvas.toDataURL();
            fb.onload = () => resolve(fb);
          };
          img.src = url;
        });
      })
    );

    // 3. Synteza lektora (Google Translate TTS przez Cloudflare Pages Function)
    onProgress({ progress: 40, message: 'Synteza głosu lektora (TTS)...' });
    let audioBuffer: AudioBuffer | null = null;
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    interface SceneTiming { start: number; end: number; duration: number; }
    const sceneTimings: SceneTiming[] = [];

    try {
      onProgress({ progress: 42, message: 'Generowanie audio lektora pl-PL...' });
      const sentenceBuffers: AudioBuffer[] = [];

      for (let i = 0; i < scenes.length; i++) {
        const sentence = scenes[i].text.slice(0, 200);
        onProgress({
          progress: 42 + Math.floor((i / scenes.length) * 15),
          message: `Audio scena ${i + 1}/${scenes.length}...`
        });
        try {
          const ttsUrl = `/api/tts?lang=pl&text=${encodeURIComponent(sentence)}`;
          const ttsRes = await fetch(ttsUrl);
          if (!ttsRes.ok) throw new Error(`TTS HTTP ${ttsRes.status}`);
          const audioData = await ttsRes.arrayBuffer();
          const decoded = await audioContext.decodeAudioData(audioData);
          sentenceBuffers.push(decoded);
        } catch (e) {
          // Silent fallback for this scene (0.5s silence)
          const silentBuf = audioContext.createBuffer(1, audioContext.sampleRate * 0.5, audioContext.sampleRate);
          sentenceBuffers.push(silentBuf);
        }
      }

      if (sentenceBuffers.length > 0) {
        const totalLength = sentenceBuffers.reduce((a, b) => a + b.length, 0);
        audioBuffer = audioContext.createBuffer(
          sentenceBuffers[0].numberOfChannels,
          totalLength,
          sentenceBuffers[0].sampleRate
        );
        let offset = 0;
        for (const buf of sentenceBuffers) {
          const startSec = offset / buf.sampleRate;
          const durationSec = buf.duration;
          sceneTimings.push({ start: startSec, end: startSec + durationSec, duration: durationSec });
          for (let ch = 0; ch < buf.numberOfChannels; ch++) {
            audioBuffer.getChannelData(ch).set(buf.getChannelData(ch), offset);
          }
          offset += buf.length;
        }
      }
    } catch (e) {
      console.warn('[VideoGen] TTS failed, generating silent video:', e);
    }

    // Fallback timingów jeśli brak audio
    if (sceneTimings.length < scenes.length) {
      sceneTimings.length = 0;
      const dur = audioBuffer ? audioBuffer.duration : scenes.length * 6.0;
      const avg = dur / scenes.length;
      for (let i = 0; i < scenes.length; i++) {
        sceneTimings.push({ start: i * avg, end: (i + 1) * avg, duration: avg });
      }
    }

    // 4. Montaż wideo na HTML Canvas z animacją różańca
    onProgress({ progress: 60, message: 'Inicjalizacja renderowania wideo 16:9...' });

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
      // Aktywny sink (0 gain) — wymuszony render audio w przeglądarce
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

    const totalDuration = audioBuffer ? audioBuffer.duration : scenes.length * 6.0;

    return new Promise<string>((resolve) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(URL.createObjectURL(blob));
      };

      mediaRecorder.start();
      const startTime = performance.now();

      const renderLoop = () => {
        const t = (performance.now() - startTime) / 1000;

        if (t >= totalDuration) {
          mediaRecorder.stop();
          try { bufferSource?.stop(); } catch {}
          return;
        }

        const pct = 60 + Math.floor((t / totalDuration) * 38);
        onProgress({ progress: pct, message: `Renderowanie: ${t.toFixed(1)}s / ${totalDuration.toFixed(1)}s` });

        // Wyznacz aktywną scenę
        let sceneIndex = scenes.length - 1;
        for (let i = 0; i < sceneTimings.length; i++) {
          if (t >= sceneTimings[i].start && t < sceneTimings[i].end) {
            sceneIndex = i;
            break;
          }
        }
        if (sceneIndex < 0) sceneIndex = 0;

        const scene = scenes[sceneIndex];
        const img = images[sceneIndex];

        // ── TŁO: obraz Pollinations ──────────────────────────────
        ctx.drawImage(img, 0, 0, W, H);

        // Ciemna winietka na krawędziach (dla czytelności pasków różańca)
        const vigL = ctx.createLinearGradient(0, 0, 260, 0);
        vigL.addColorStop(0, 'rgba(0,0,0,0.78)');
        vigL.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = vigL;
        ctx.fillRect(0, 0, 260, H);

        const vigR = ctx.createLinearGradient(W, 0, W - 260, 0);
        vigR.addColorStop(0, 'rgba(0,0,0,0.78)');
        vigR.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = vigR;
        ctx.fillRect(W - 260, 0, 260, H);

        // Gradient dołu dla napisów
        const botGrad = ctx.createLinearGradient(0, H - 220, 0, H);
        botGrad.addColorStop(0, 'rgba(0,0,0,0)');
        botGrad.addColorStop(1, 'rgba(0,0,0,0.9)');
        ctx.fillStyle = botGrad;
        ctx.fillRect(0, H - 220, W, 220);

        // ── PASKI RÓŻAŃCA ────────────────────────────────────────
        if (rgbaBeads && cmykBeads && scene.rgbaBeadId && scene.cmykBeadId) {
          ctx.save();
          drawBeadStrip(ctx, rgbaBeads, scene.rgbaBeadId, 100, H / 2, true, t);
          ctx.restore();

          ctx.save();
          drawBeadStrip(ctx, cmykBeads, scene.cmykBeadId, W - 100, H / 2, false, t);
          ctx.restore();
        } else {
          // Fallback: jeden animowany paciorek
          const bPulse = 18 + Math.sin(t * 5) * 4;
          ctx.save();
          ctx.beginPath();
          ctx.arc(80, H - 80, bPulse, 0, Math.PI * 2);
          ctx.fillStyle = '#fbbf24';
          ctx.shadowColor = 'rgba(251,191,36,0.8)';
          ctx.shadowBlur = 18;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.restore();
        }

        // ── ŚRODKOWY TEKST MODLITWY ──────────────────────────────
        const textX = 270, textMaxW = W - 540, textBaseY = H - 130;

        // Etykieta (nazwa kroku)
        if (scene.label) {
          ctx.save();
          ctx.fillStyle = 'rgba(56,189,248,0.9)';
          ctx.font = 'bold 13px monospace';
          ctx.textAlign = 'center';
          ctx.letterSpacing = '3px';
          ctx.fillText(scene.label.toUpperCase(), W / 2, textBaseY - 50);
          ctx.restore();
        }

        // Tekst modlitwy z zawijaniem
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const words = scene.text.split(' ');
        const lineH = 38;
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

        requestAnimationFrame(renderLoop);
      };

      renderLoop();
    });

  } catch (error: any) {
    onProgress({ progress: 0, message: `Błąd renderowania: ${error.message}` });
    throw error;
  }
};

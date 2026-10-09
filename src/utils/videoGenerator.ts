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
  header?: string;   // nagłówek sceny wideo (np. tytuł tajemnicy) — informacja o treści
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


// ═══════════════════════════════════════════════════════════════════════════
//  SCENY, TOKENY I OŚ CZASU LEKTORA
//  Zasada: wyświetlany tekst i tekst lektora pochodzą z TEJ SAMEJ listy słów
//  (tokenów). Każde słowo ma własny czas start/end liczony z realnego audio,
//  więc podświetlenie nie może „uciec" od lektora.
// ═══════════════════════════════════════════════════════════════════════════

interface Token {
  word: string;        // słowo dokładnie tak, jak jest wyświetlane
  weight: number;      // „waga mówiona" (≈ liczba sylab); 0 = słowo niewymawiane (np. sygnatura)
  pauseAfter: number;  // dodatkowa waga pauzy po słowie (przecinek / kropka)
  para: number;        // indeks akapitu w treści (-1 = nagłówek)
  start: number;       // sekundy (globalnie, względem początku audio)
  end: number;
}

interface Scene {
  kicker: string;          // mała etykieta (np. „Tajemnica 1, Zdrowaś Maryjo 3/10")
  header: string;          // nagłówek — informacja o treści
  subheader: string;       // np. „Etap 5 - Część 1 …" / sygnatura biblijna (tylko wyświetlana)
  headerTokens: Token[];   // tokeny nagłówka (czytane tylko gdy speakHeader)
  bodyTokens: Token[];     // tokeny treści modlitwy
  paragraphCount: number;
  rgbaBeadId: string;
  cmykBeadId: string;
  start: number;
  end: number;
}

// Modlitwy, przed którymi zawsze zaczynamy nowy akapit
const PRAYER_STARTS = [
  'Ojcze nasz', 'Zdrowaś Maryjo', 'Chwała Ojcu', 'O mój Jezu', 'Pod Twoją obronę',
  'Witaj Królowo', 'Wierzę w Boga', 'W imię Ojca'
];
const PRAYER_START_RE = new RegExp(
  `([.!?])\\s+(?=(?:${PRAYER_STARTS.join('|')})(?![\\p{L}]))`,
  'gu'
);

const SCENE_GAP_SEC = 0.6;     // oddech między paciorkami
const MAX_PHRASE_CHARS = 160;  // limit Google TTS ≈ 200 znaków

function normalizeText(raw: string): string {
  return (raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/[­​‌‍﻿]/g, '')
    // podwójne kropki z doklejania „." przez resolver (np. „Amen.." → „Amen.") — bez ruszania „..."
    .replace(/(?<!\.)([.!?])\.(?!\.)/g, '$1')
    // akapit przed każdą kolejną modlitwą (np. „… Amen. O mój Jezu …")
    .replace(PRAYER_START_RE, '$1\n\n')
    .trim();
}

/** Dzieli tekst na akapity; pojedyncze \n wewnątrz akapitu łączymy spacją (wersy → proza). */
function toParagraphs(text: string): string[] {
  return normalizeText(text)
    .split(/\n\s*\n+/)
    .map(p => p.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 0);
}

/** Wyciąga z początku treści linie informacyjne (Etap/Część/Tajemnica, sygnatury) do podtytułu. */
function splitLeadingInfo(text: string, header: string): { subheader: string; body: string } {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  const info: string[] = [];
  while (lines.length > 0) {
    const l = lines[0].trim();
    if (!l) { lines.shift(); continue; }
    const isEtap = /^Etap\s+\d+.*Tajemnica/i.test(l);
    const isCitation = /^\([^()]{2,60}\)\.?$/.test(l);
    const isHeaderRepeat = header && l.replace(/[.\s]+$/, '') === header.replace(/[.\s]+$/, '');
    if (isEtap || isCitation || isHeaderRepeat) {
      if (isEtap) {
        // „Etap 5 - Część 1 - Tajemnica 1 - <tytuł>" → „Etap 5 · Część 1 · Tajemnica 1" (tytuł jest już w nagłówku)
        const m = l.match(/^(Etap\s+\d+)\s*[-–—]\s*(Część\s+\d+)\s*[-–—]\s*(Tajemnica\s+\d+)/i);
        info.push(m ? `${m[1]} · ${m[2]} · ${m[3]}` : l.replace(/\.$/, ''));
      } else if (!isHeaderRepeat) info.push(l.replace(/\.$/, ''));
      lines.shift();
    } else break;
  }
  return { subheader: info.join('  ·  '), body: lines.join('\n') };
}

const VOWELS_RE = /[aeiouyąęóAEIOUYĄĘÓ]/g;

function wordWeight(word: string, inCitation: boolean): number {
  if (inCitation) return 0;
  const spoken = sanitizeTextForTts(word).replace(/[^\p{L}\p{N}]/gu, '');
  if (!spoken) return 0;
  if (/^\d+$/.test(spoken)) return Math.max(2, spoken.length * 1.6); // liczby czytane są długo
  const syl = (spoken.match(VOWELS_RE) || []).length;
  return Math.max(1, syl) + spoken.length * 0.04;
}

function pauseWeight(word: string): number {
  if (/[.!?…]["”»)]*$/.test(word)) return 1.4;
  if (/[,;:—–]["”»)]*$/.test(word)) return 0.7;
  return 0;
}

/** Zamienia tekst na tokeny; słowa w nawiasach z sygnaturą biblijną dostają wagę 0 (sanitizer je usuwa). */
function tokenize(paragraphs: string[], paraOffset = 0): Token[] {
  const tokens: Token[] = [];
  paragraphs.forEach((p, pi) => {
    const words = p.split(/\s+/).filter(Boolean);
    let depth = 0;
    let citationGroup = false;
    words.forEach((w, wi) => {
      if (w.includes('(')) {
        depth++;
        // sprawdź zawartość nawiasu — jeśli to sygnatura (Mt 10,8), sanitizer ją wytnie
        const rest = words.slice(wi).join(' ');
        const inner = rest.slice(rest.indexOf('('), rest.indexOf(')') + 1);
        citationGroup = inner.length > 0 && sanitizeTextForTts(inner).trim() === '';
      }
      const inCitation = depth > 0 && citationGroup;
      tokens.push({ word: w, weight: wordWeight(w, inCitation), pauseAfter: inCitation ? 0 : pauseWeight(w), para: pi + paraOffset, start: 0, end: 0 });
      if (w.includes(')')) { depth = Math.max(0, depth - 1); if (depth === 0) citationGroup = false; }
    });
  });
  return tokens;
}

function buildScenes(
  textInput: string,
  stepsData: PrayerStep[] | undefined,
  titleFallback: string
): Scene[] {
  const scenes: Scene[] = [];

  const makeScene = (kicker: string, rawHeader: string, text: string, rgba: string, cmyk: string, speakHeader: boolean) => {
    const split = splitLeadingInfo(text, rawHeader);
    let { subheader } = split;
    const { body } = split;
    // Sygnatura biblijna z końca tytułu → podtytuł (lektor jej nie czyta, nagłówek jest czytelniejszy)
    let header = rawHeader;
    const m = rawHeader.match(/^(.*\S)\s*(\([^()]{2,80}\))\s*$/);
    if (m) {
      header = m[1];
      if (!subheader.includes(m[2])) subheader = subheader ? `${subheader}  ·  ${m[2]}` : m[2];
    }
    const paragraphs = toParagraphs(body);
    if (paragraphs.length === 0 && !header) return;
    const headerTokens = header && speakHeader ? tokenize([header], -1).map(t => ({ ...t, para: -1 })) : [];
    // nagłówek kończy się pauzą jak po kropce
    if (headerTokens.length) headerTokens[headerTokens.length - 1].pauseAfter = Math.max(1.4, headerTokens[headerTokens.length - 1].pauseAfter);
    scenes.push({
      kicker, header, subheader,
      headerTokens,
      bodyTokens: tokenize(paragraphs),
      paragraphCount: paragraphs.length,
      rgbaBeadId: rgba, cmykBeadId: cmyk,
      start: 0, end: 0
    });
  };

  if (stepsData && stepsData.length > 0) {
    // Dokładnie 1 scena na 1 paciorek / krok modlitwy
    stepsData.forEach((step, i) => {
      const text = (step.text || '').trim();
      if (!text) return;
      const label = step.label || `Paciorek ${i + 1}`;
      const header = (step.header || '').trim();
      let kicker = label;
      let showHeader = header;
      if (!header || header === label) {
        // Etykieta „Tajemnica 1 — Chwała Ojcu & O mój Jezu" → kicker „Tajemnica 1" + nagłówek „Chwała Ojcu & O mój Jezu"
        const m = label.match(/^(.+?)(?:\s+[—–-]\s+|,\s+)(.+)$/);
        kicker = m ? m[1] : '';
        showHeader = m ? m[2] : label;
      }
      // Tytuł tajemnicy jest zapowiadany przez lektora (jak w odtwarzaczu na stronie); pozostałe nagłówki są tylko informacją
      const speakHeader = step.prayerType === 'mystery' && !!header && header !== label;
      makeScene(kicker, showHeader, text, step.rgbaBeadId || '', step.cmykBeadId || '', speakHeader);
    });
  } else {
    // Wpis bloga: akapity grupowane w sceny ≤ ~70 słów (zmiana ilustracji co kilkanaście sekund)
    const paragraphs = toParagraphs(textInput);
    const groups: string[][] = [];
    let cur: string[] = [];
    let curWords = 0;
    const pushCur = () => { if (cur.length) { groups.push(cur); cur = []; curWords = 0; } };
    for (const p of paragraphs) {
      const pw = p.split(/\s+/).length;
      if (pw > 90) {
        // bardzo długi akapit dzielimy po zdaniach
        pushCur();
        const sentences = p.match(/[^.!?]+[.!?]+["”»)]*|\S[^.!?]*$/g) || [p];
        let buf = '';
        for (const s of sentences) {
          if ((buf + ' ' + s).split(/\s+/).length > 70 && buf) { groups.push([buf.trim()]); buf = ''; }
          buf += ' ' + s.trim();
        }
        if (buf.trim()) groups.push([buf.trim()]);
        continue;
      }
      if (curWords + pw > 70) pushCur();
      cur.push(p); curWords += pw;
    }
    pushCur();
    const total = groups.length;
    groups.forEach((g, i) => {
      makeScene(total > 1 ? `Część ${i + 1}/${total}` : '', titleFallback, g.join('\n\n'), '', '', i === 0);
    });
  }

  if (scenes.length === 0) {
    makeScene('', titleFallback, textInput || titleFallback, '', '', false);
  }
  return scenes;
}

// ─── Synteza mowy z pomiarem czasu ────────────────────────────────────────

async function fetchTtsBuffer(text: string, audioContext: AudioContext): Promise<AudioBuffer | null> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`/api/tts?lang=pl&text=${encodeURIComponent(text)}`);
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      return await audioContext.decodeAudioData(arrayBuf);
    } catch {
      // limit zapytań Google TTS — odczekaj i spróbuj ponownie (zamiast wstawiać ciszę)
      await new Promise(r => setTimeout(r, 700 * attempt));
    }
  }
  return null;
}

/** Zwraca [początek, koniec] właściwej mowy w buforze (pomija ciszę na brzegach). */
function speechBounds(buf: AudioBuffer): [number, number] {
  const data = buf.getChannelData(0);
  const win = Math.max(1, Math.floor(buf.sampleRate * 0.01)); // okna 10 ms
  const threshold = 0.012;
  let first = -1, last = -1;
  for (let i = 0; i < data.length; i += win) {
    let peak = 0;
    const end = Math.min(data.length, i + win);
    for (let j = i; j < end; j++) { const v = Math.abs(data[j]); if (v > peak) peak = v; }
    if (peak > threshold) { if (first < 0) first = i; last = end; }
  }
  if (first < 0) return [0, buf.duration];
  return [first / buf.sampleRate, last / buf.sampleRate];
}

interface Phrase { tokens: Token[]; spoken: string; }

/** Frazy dla lektora: cięcie na granicach zdań/przecinków, nigdy w środku słowa ani między akapitami. */
function buildPhrases(tokens: Token[]): Phrase[] {
  const phrases: Phrase[] = [];
  let cur: Token[] = [];
  const flush = () => {
    if (!cur.length) return;
    phrases.push({ tokens: cur, spoken: sanitizeTextForTts(cur.map(t => t.word).join(' ')) });
    cur = [];
  };
  let depth = 0; // nie tniemy wewnątrz nawiasu — inaczej sanitizer nie rozpozna sygnatury (Mt 10,8)
  tokens.forEach((t, i) => {
    const candidate = sanitizeTextForTts([...cur, t].map(x => x.word).join(' '));
    if (cur.length && depth === 0 && candidate.length > MAX_PHRASE_CHARS) flush();
    cur.push(t);
    depth += (t.word.match(/\(/g) || []).length - (t.word.match(/\)/g) || []).length;
    if (depth < 0) depth = 0;
    const next = tokens[i + 1];
    const curLen = sanitizeTextForTts(cur.map(x => x.word).join(' ')).length;
    const endsSentence = /[.!?…]["”»)]*$/.test(t.word);
    const endsClause = /[,;:]["”»)]*$/.test(t.word);
    if (!next || next.para !== t.para) { depth = 0; flush(); return; }
    if (depth > 0) return;
    if ((endsSentence && curLen > 25) || (endsClause && curLen > 60)) flush();
  });
  flush();
  return phrases;
}

/** Rozkłada czas mowy frazy na słowa proporcjonalnie do sylab i pauz interpunkcyjnych. */
function assignTimes(tokens: Token[], from: number, to: number) {
  const total = tokens.reduce((a, t, i) => a + t.weight + (i < tokens.length - 1 ? t.pauseAfter : 0), 0);
  if (total <= 0) { tokens.forEach(t => { t.start = from; t.end = from; }); return; }
  const unit = (to - from) / total;
  let cursor = from;
  tokens.forEach((t, i) => {
    t.start = cursor;
    t.end = cursor + t.weight * unit;
    cursor = t.end + (i < tokens.length - 1 ? t.pauseAfter * unit : 0);
  });
}

// ─── Układ tekstu: nagłówek + akapity justowane ───────────────────────────

const PANEL = { x: 230, y: 54, w: 1280 - 460, h: 720 - 54 - 44, pad: 34 };
const BODY_FONT = '"Georgia", "Times New Roman", serif';

interface PlacedWord { token: Token; x: number; y: number; w: number; }
interface SceneLayout {
  fontSize: number;
  lineH: number;
  headerLines: { words: PlacedWord[]; y: number }[];
  headerFont: string;
  subheaderLines: string[];
  subheaderY: number;
  dividerY: number;
  bodyTop: number;
  bodyWords: PlacedWord[];
  bodyHeight: number;
  bodyFont: string;
}

function wrapWords(ctx: CanvasRenderingContext2D, tokens: Token[], maxW: number): Token[][] {
  const lines: Token[][] = [];
  let line: Token[] = [];
  let width = 0;
  const space = ctx.measureText(' ').width;
  for (const t of tokens) {
    const w = ctx.measureText(t.word).width;
    if (line.length && width + space + w > maxW) { lines.push(line); line = []; width = 0; }
    width += (line.length ? space : 0) + w;
    line.push(t);
  }
  if (line.length) lines.push(line);
  return lines;
}

function layoutScene(ctx: CanvasRenderingContext2D, scene: Scene): SceneLayout {
  const innerX = PANEL.x + PANEL.pad;
  const innerW = PANEL.w - PANEL.pad * 2;
  let y = PANEL.y + PANEL.pad + 18; // miejsce na „kicker"

  // Nagłówek (wyśrodkowany, złoty) — tokeny nagłówka wyświetlane zawsze, czytane tylko gdy mają czasy
  const headerFont = `600 30px ${BODY_FONT}`;
  ctx.font = headerFont;
  const hTokens = scene.headerTokens.length ? scene.headerTokens : tokenize(scene.header ? [scene.header] : [], -1).map(t => ({ ...t, start: -1, end: -1 }));
  const headerLines: SceneLayout['headerLines'] = [];
  const space = ctx.measureText(' ').width;
  wrapWords(ctx, hTokens, innerW).forEach(line => {
    y += 38;
    const widths = line.map(t => ctx.measureText(t.word).width);
    const lineW = widths.reduce((a, b) => a + b, 0) + space * (line.length - 1);
    let x = innerX + (innerW - lineW) / 2;
    headerLines.push({ y, words: line.map((t, i) => { const pw = { token: t, x, y, w: widths[i] }; x += widths[i] + space; return pw; }) });
  });

  ctx.font = `italic 17px ${BODY_FONT}`;
  const subheaderLines: string[] = [];
  if (scene.subheader) {
    wrapWords(ctx, tokenize([scene.subheader]), innerW).forEach(l => subheaderLines.push(l.map(t => t.word).join(' ')));
  }
  const subheaderY = y + 36;
  y += subheaderLines.length * 24 + (subheaderLines.length ? 8 : 0) + (headerLines.length || subheaderLines.length ? 22 : 0);
  const dividerY = y;
  const bodyTop = y + (headerLines.length || subheaderLines.length ? 34 : 4); // wyraźny odstęp nagłówek → treść
  const bodyMaxH = PANEL.y + PANEL.h - PANEL.pad - bodyTop;

  // Dobór rozmiaru czcionki: największy, przy którym cały tekst się mieści (min. 21 px — potem przewijanie)
  let chosen: { fontSize: number; lineH: number; words: PlacedWord[]; height: number } | null = null;
  for (let fs = 32; fs >= 21; fs -= 1) {
    const font = `500 ${fs}px ${BODY_FONT}`;
    ctx.font = font;
    const lineH = Math.round(fs * 1.45);
    const paraGap = Math.round(lineH * 0.75);
    const sp = ctx.measureText(' ').width;
    const words: PlacedWord[] = [];
    let cy = 0;
    for (let p = 0; p < scene.paragraphCount; p++) {
      const pTokens = scene.bodyTokens.filter(t => t.para === p);
      const lines = wrapWords(ctx, pTokens, innerW);
      lines.forEach((line, li) => {
        const widths = line.map(t => ctx.measureText(t.word).width);
        const textW = widths.reduce((a, b) => a + b, 0);
        const isLast = li === lines.length - 1;
        // Justowanie do obu krawędzi (ostatnia linia akapitu wyrównana do lewej)
        let gap = sp;
        if (!isLast && line.length > 1) {
          gap = (innerW - textW) / (line.length - 1);
          if (gap > sp * 3.2) gap = sp; // zbyt rozstrzelona linia — nie justuj
        }
        let x = innerX;
        line.forEach((t, i) => { words.push({ token: t, x, y: cy + lineH / 2, w: widths[i] }); x += widths[i] + gap; });
        cy += lineH;
      });
      if (p < scene.paragraphCount - 1) cy += paraGap;
    }
    chosen = { fontSize: fs, lineH, words, height: cy };
    if (cy <= bodyMaxH) break;
  }

  return {
    fontSize: chosen!.fontSize,
    lineH: chosen!.lineH,
    headerLines,
    headerFont,
    subheaderLines,
    subheaderY,
    dividerY,
    bodyTop,
    bodyWords: chosen!.words,
    bodyHeight: chosen!.height,
    bodyFont: `500 ${chosen!.fontSize}px ${BODY_FONT}`
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawWord(ctx: CanvasRenderingContext2D, pw: PlacedWord, state: 'active' | 'past' | 'future' | 'static', fontSize: number) {
  if (state === 'active') {
    ctx.save();
    ctx.fillStyle = 'rgba(251,191,36,0.22)';
    roundRect(ctx, pw.x - 4, pw.y - fontSize * 0.68, pw.w + 8, fontSize * 1.32, 6);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fde047';
    ctx.shadowColor = 'rgba(251,191,36,0.9)';
    ctx.shadowBlur = 14;
  } else {
    ctx.shadowBlur = 0;
    ctx.fillStyle = state === 'past' ? '#fef3c7' : state === 'future' ? '#cbd5e1' : '#f1f5f9';
  }
  ctx.fillText(pw.token.word, pw.x, pw.y);
  ctx.shadowBlur = 0;
}

const MASTERPIECE_SACRED_URLS = [
  "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Leonardo_da_Vinci_%281452-1519%29_-_The_Last_Supper_%281495-1498%29.jpg/1280px-Leonardo_da_Vinci_%281452-1519%29_-_The_Last_Supper_%281495-1498%29.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Fra_Angelico_-_The_Annunciation_-_WGA00473.jpg/1280px-Fra_Angelico_-_The_Annunciation_-_WGA00473.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/RAFAEL_-_Madonna_Sixtina_%28Gem%C3%A4ldegalerie_Alter_Meister%2C_Dresden%2C_1513-14._%C3%93leo_sobre_lienzo%2C_265_x_196_cm%29.jpg/1280px-RAFAEL_-_Madonna_Sixtina_%28Gem%C3%A4ldegalerie_Alter_Meister%2C_Dresden%2C_1513-14._%C3%93leo_sobre_lienzo%2C_265_x_196_cm%29.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Michelangelo%27s_%22God%22%2C_from_%22the_Creation_of_Adam%22.jpg/1280px-Michelangelo%27s_%22God%22%2C_from_%22the_Creation_of_Adam%22.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/God_the_Father_and_angels%2C_Pietro_Perugino%2C_Stanza_dell%27Incendio_di_Borgo%2C_medalion%2C_part_of_the_ceiling%2C_Vatican_City_1.jpg/1280px-God_the_Father_and_angels%2C_Pietro_Perugino%2C_Stanza_dell%27Incendio_di_Borgo%2C_medalion%2C_part_of_the_ceiling%2C_Vatican_City_1.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Bartolom%C3%A9_Esteban_Murillo_-_The_Immaculate_Conception_of_Los_Venerables_-_Prado.jpg/1280px-Bartolom%C3%A9_Esteban_Murillo_-_The_Immaculate_Conception_of_Los_Venerables_-_Prado.jpg"
];

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => {
      const fb = document.createElement('canvas');
      fb.width = 1280; fb.height = 720;
      const c = fb.getContext('2d')!;
      const g = c.createRadialGradient(640, 200, 30, 640, 200, 600);
      g.addColorStop(0, '#312e81'); g.addColorStop(0.6, '#0f172a'); g.addColorStop(1, '#020617');
      c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
      const fbImg = new Image();
      fbImg.onload = () => res(fbImg);
      fbImg.src = fb.toDataURL();
    };
    img.src = url;
  });
}

/** Rysuje obraz w trybie „cover" (bez rozciągania proporcji). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number) {
  const s = Math.max(W / img.width, H / img.height);
  const w = img.width * s, h = img.height * s;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

// ═══════════════════════════════════════════════════════════════════════════

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
  void fishApiKey; void voiceSampleUrlOrPath; // (zachowana sygnatura — lektor: Google TTS przez /api/tts)

  // AudioContext tworzony od razu (jeszcze w kontekście kliknięcia), by przeglądarka pozwoliła go uruchomić
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  audioContext.resume().catch(() => {});

  try {
    // 1. Sceny (1 paciorek = 1 scena) — nagłówek, akapity, tokeny słów
    onProgress({ progress: 8, message: 'Przygotowywanie scen, nagłówków i akapitów...' });
    const scenes = buildScenes(text, stepsData, titleFallback);

    // 2. Ilustracje
    onProgress({ progress: 12, message: 'Pobieranie ilustracji sakralnych 16:9...' });
    const uniqueImages = await Promise.all(
      MASTERPIECE_SACRED_URLS.slice(0, Math.min(MASTERPIECE_SACRED_URLS.length, scenes.length)).map(loadImage)
    );
    const images = scenes.map((_, i) => uniqueImages[i % uniqueImages.length]);

    // 3. Lektor: synteza fraza po frazie + pomiar realnego czasu każdej frazy
    const allPhrases: { scene: number; phrase: Phrase }[] = [];
    scenes.forEach((sc, si) => {
      buildPhrases(sc.headerTokens).forEach(p => allPhrases.push({ scene: si, phrase: p }));
      buildPhrases(sc.bodyTokens).forEach(p => allPhrases.push({ scene: si, phrase: p }));
    });

    const sampleRate = audioContext.sampleRate;
    const pieces: { buf: AudioBuffer | null; silence: number }[] = [];
    let cursor = 0.3; // krótka cisza na start
    let failed = 0;
    let lastScene = -1;

    for (let i = 0; i < allPhrases.length; i++) {
      const { scene: si, phrase } = allPhrases[i];
      onProgress({
        progress: 15 + Math.floor((i / Math.max(1, allPhrases.length)) * 45),
        message: `Lektor: fraza ${i + 1}/${allPhrases.length} (scena ${si + 1}/${scenes.length})...`
      });

      if (si !== lastScene) {
        if (lastScene >= 0) {
          scenes[lastScene].end = cursor;
          pieces.push({ buf: null, silence: SCENE_GAP_SEC });
          cursor += SCENE_GAP_SEC;
        }
        scenes[si].start = cursor;
        lastScene = si;
      }

      if (!phrase.spoken.trim()) {
        assignTimes(phrase.tokens, cursor, cursor);
        continue;
      }

      const buf = await fetchTtsBuffer(phrase.spoken, audioContext);
      if (buf) {
        const [s0, s1] = speechBounds(buf);
        assignTimes(phrase.tokens, cursor + s0, cursor + s1);
        pieces.push({ buf, silence: 0 });
        cursor += buf.duration;
      } else {
        // Nie udało się pobrać głosu — zachowujemy oś czasu (tekst dalej się podświetla w tempie mowy)
        failed++;
        const est = Math.max(0.8, phrase.spoken.length * 0.065);
        assignTimes(phrase.tokens, cursor, cursor + est);
        pieces.push({ buf: null, silence: est });
        cursor += est;
      }
      await new Promise(r => setTimeout(r, 60)); // łagodnie dla limitów Google TTS
    }
    if (lastScene >= 0) scenes[lastScene].end = cursor;
    // sceny bez żadnej frazy (np. sama sygnatura)
    scenes.forEach((sc, i) => {
      if (sc.end <= sc.start) {
        const prevEnd = i > 0 ? scenes[i - 1].end : 0;
        sc.start = prevEnd; sc.end = prevEnd + 2;
        [...sc.headerTokens, ...sc.bodyTokens].forEach(t => { t.start = sc.start; t.end = sc.start; });
        if (sc.end > cursor) { pieces.push({ buf: null, silence: sc.end - cursor }); cursor = sc.end; }
      }
    });
    const totalDuration = cursor + 0.8;

    // Złożenie jednej ścieżki audio dokładnie wg wyliczonej osi czasu
    const audioBuffer = audioContext.createBuffer(1, Math.ceil(totalDuration * sampleRate), sampleRate);
    const out = audioBuffer.getChannelData(0);
    let pos = Math.round(0.3 * sampleRate);
    for (const p of pieces) {
      if (p.buf) {
        const src = p.buf.getChannelData(0);
        const ratio = p.buf.sampleRate / sampleRate; // decodeAudioData resampluje do sampleRate kontekstu, ale na wszelki wypadek
        const len = Math.round(p.buf.duration * sampleRate);
        for (let k = 0; k < len && pos + k < out.length; k++) out[pos + k] = src[Math.min(src.length - 1, Math.floor(k * ratio))];
        pos += len;
      } else {
        pos += Math.round(p.silence * sampleRate);
      }
    }

    if (failed > 0) {
      onProgress({ progress: 60, message: `Uwaga: ${failed} fraz(y) lektora nie udało się pobrać — w tych miejscach będzie cisza.` });
    }

    // 4. Render: zegarem jest AudioContext.currentTime (ten sam, który odtwarza lektora)
    onProgress({ progress: 62, message: 'Montowanie wideo z synchronicznym podświetlaniem słów...' });

    if (audioContext.state !== 'running') {
      await audioContext.resume().catch(() => {});
      await new Promise(r => setTimeout(r, 300));
    }
    if (audioContext.state !== 'running') {
      throw new Error('Przeglądarka zablokowała dźwięk. Kliknij przycisk generowania ponownie (bez przełączania karty).');
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;

    const layouts = new Map<number, SceneLayout>();
    const getLayout = (i: number) => {
      let l = layouts.get(i);
      if (!l) { l = layoutScene(ctx, scenes[i]); layouts.set(i, l); }
      return l;
    };

    const stream = canvas.captureStream(30);
    const dest = audioContext.createMediaStreamDestination();
    const bufferSource = audioContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(dest);

    const combinedStream = new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';
    const mediaRecorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 4000000 });
    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    let scrollY = 0;
    let lastSceneIdx = -1;

    const drawFrame = (t: number) => {
      // aktywna scena
      let si = 0;
      for (let i = 0; i < scenes.length; i++) { if (t >= scenes[i].start - SCENE_GAP_SEC / 2) si = i; }
      const scene = scenes[si];
      const layout = getLayout(si);
      if (si !== lastSceneIdx) { scrollY = 0; lastSceneIdx = si; }

      // ── TŁO ──
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, W, H);
      drawCover(ctx, images[si], W, H);
      const vigL = ctx.createLinearGradient(0, 0, 260, 0);
      vigL.addColorStop(0, 'rgba(0,0,0,0.85)'); vigL.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = vigL; ctx.fillRect(0, 0, 260, H);
      const vigR = ctx.createLinearGradient(W, 0, W - 260, 0);
      vigR.addColorStop(0, 'rgba(0,0,0,0.85)'); vigR.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = vigR; ctx.fillRect(W - 260, 0, 260, H);

      // ── PASKI RÓŻAŃCA ──
      if (rgbaBeads && cmykBeads && scene.rgbaBeadId && scene.cmykBeadId) {
        ctx.save(); drawBeadStrip(ctx, rgbaBeads, scene.rgbaBeadId, 100, H / 2, true, t); ctx.restore();
        ctx.save(); drawBeadStrip(ctx, cmykBeads, scene.cmykBeadId, W - 100, H / 2, false, t); ctx.restore();
      }

      // ── PANEL TEKSTU ──
      ctx.save();
      ctx.fillStyle = 'rgba(8,10,22,0.72)';
      roundRect(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 18);
      ctx.fill();
      ctx.strokeStyle = 'rgba(251,191,36,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      const wordState = (tok: Token, activeTok: Token | null): 'active' | 'past' | 'future' | 'static' => {
        if (tok.start < 0) return 'static';
        if (tok === activeTok) return 'active';
        return t >= tok.end && tok.end > 0 ? 'past' : 'future';
      };
      // aktywne słowo = ostatnie, które już się zaczęło (bez migotania w pauzach)
      const timed = [...scene.headerTokens, ...scene.bodyTokens].filter(tk => tk.weight > 0);
      let activeTok: Token | null = null;
      for (const tk of timed) { if (tk.start <= t) activeTok = tk; else break; }
      if (activeTok && t > activeTok.end + 0.6) activeTok = null; // dłuższa cisza — bez podświetlenia

      // kicker
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (scene.kicker) {
        ctx.fillStyle = 'rgba(251,191,36,0.85)';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`📿 ${scene.kicker.toUpperCase()}`, W / 2, PANEL.y + PANEL.pad + 2);
      }
      ctx.restore();

      // nagłówek
      ctx.save();
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = layout.headerFont;
      layout.headerLines.forEach(line => line.words.forEach(pw => {
        // nagłówek zawsze złoty — wyróżnia się od treści; czytane słowo nagłówka dostaje podświetlenie
        if (wordState(pw.token, activeTok) === 'active') drawWord(ctx, pw, 'active', 30);
        else { ctx.fillStyle = '#fbbf24'; ctx.fillText(pw.token.word, pw.x, pw.y); }
      }));
      if (layout.subheaderLines.length) {
        ctx.font = `italic 17px ${BODY_FONT}`;
        ctx.fillStyle = 'rgba(226,232,240,0.75)';
        ctx.textAlign = 'center';
        layout.subheaderLines.forEach((l, i) => ctx.fillText(l, W / 2, layout.subheaderY + i * 24));
      }
      if (layout.headerLines.length || layout.subheaderLines.length) {
        const g = ctx.createLinearGradient(PANEL.x + 80, 0, PANEL.x + PANEL.w - 80, 0);
        g.addColorStop(0, 'rgba(251,191,36,0)'); g.addColorStop(0.5, 'rgba(251,191,36,0.7)'); g.addColorStop(1, 'rgba(251,191,36,0)');
        ctx.fillStyle = g;
        ctx.fillRect(PANEL.x + 80, layout.dividerY + 12, PANEL.w - 160, 1.5);
      }
      ctx.restore();

      // treść — justowana, z przewijaniem gdy tekst dłuższy niż panel
      const bodyMaxH = PANEL.y + PANEL.h - PANEL.pad - layout.bodyTop;
      if (layout.bodyHeight > bodyMaxH && activeTok && activeTok.para >= 0) {
        const pw = layout.bodyWords.find(w => w.token === activeTok);
        if (pw) {
          const target = Math.min(layout.bodyHeight - bodyMaxH, Math.max(0, pw.y - bodyMaxH * 0.4));
          scrollY += (target - scrollY) * 0.12;
        }
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(PANEL.x, layout.bodyTop - 6, PANEL.w, bodyMaxH + 12);
      ctx.clip();
      ctx.font = layout.bodyFont;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      for (const pw of layout.bodyWords) {
        const y = layout.bodyTop + pw.y - scrollY;
        if (y < layout.bodyTop - layout.lineH || y > layout.bodyTop + bodyMaxH + layout.lineH) continue;
        drawWord(ctx, { ...pw, y }, wordState(pw.token, activeTok), layout.fontSize);
      }
      ctx.restore();

      // pasek postępu
      const progW = Math.min(1, t / totalDuration) * W;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, H - 4, W, 4);
      const progGrad = ctx.createLinearGradient(0, 0, Math.max(1, progW), 0);
      progGrad.addColorStop(0, '#6366f1'); progGrad.addColorStop(0.5, '#38bdf8'); progGrad.addColorStop(1, '#fbbf24');
      ctx.fillStyle = progGrad;
      ctx.fillRect(0, H - 4, progW, 4);
    };

    return await new Promise<string>((resolve, reject) => {
      let finished = false;
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        audioContext.close().catch(() => {});
        resolve(URL.createObjectURL(blob));
      };
      mediaRecorder.onerror = (e: any) => reject(e?.error || new Error('MediaRecorder error'));

      drawFrame(0);
      mediaRecorder.start(100);
      const startAt = audioContext.currentTime + 0.35;
      bufferSource.start(startAt);

      const finish = () => {
        if (finished) return;
        finished = true;
        drawFrame(totalDuration);
        setTimeout(() => {
          if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
          stream.getTracks().forEach(track => track.stop());
        }, 250);
      };
      bufferSource.onended = finish;

      const renderLoop = () => {
        if (finished) return;
        const t = Math.max(0, audioContext.currentTime - startAt);
        if (t >= totalDuration + 0.5) { finish(); return; }
        drawFrame(t);
        onProgress({ progress: 62 + Math.floor((t / totalDuration) * 37), message: `Renderowanie wideo: ${t.toFixed(1)}s / ${totalDuration.toFixed(1)}s` });
        setTimeout(renderLoop, 33);
      };
      renderLoop();
    });
  } catch (error: any) {
    audioContext.close().catch(() => {});
    onProgress({ progress: 0, message: `Błąd renderowania: ${error.message}` });
    throw error;
  }
};

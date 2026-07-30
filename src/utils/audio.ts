// Web Audio API Synthesizer for high-quality bells and chimes
let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function playBeadChime(type: 'father' | 'hail' | 'decade' | 'cross') {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    
    // Create oscillators
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Set frequencies and gains based on chime type
    if (type === 'cross' || type === 'father' || type === 'decade') {
      // Deeper, richer cathedral-like bell
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(220, now); // A3
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(330, now); // E4 (Fifth)
      
      // Long decay
      gainNode.gain.setValueAtTime(0.0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 2.6);
      osc2.stop(now + 2.6);
    } else {
      // High, crisp crystalline chime for Hail Mary
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now); // E5 (Major Third)
      
      // Sweet shorter decay
      gainNode.gain.setValueAtTime(0.0, now);
      gainNode.gain.linearRampToValueAtTime(0.15, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.3);
      osc2.stop(now + 1.3);
    }
  } catch (err) {
    console.warn("Audio Context is blocked or not supported yet:", err);
  }
}

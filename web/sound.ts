/** Âm thanh tổng hợp bằng Web Audio (không cần file âm thanh) */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Tiếng nổ nhỏ "bụp" khi đốt hydrogen */
export function playPop(): void {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime;
  const len = Math.floor(a.sampleRate * 0.18);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (a.sampleRate * 0.025));
  const noise = a.createBufferSource();
  noise.buffer = buf;
  const band = a.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1400;
  band.Q.value = 0.8;
  const gain = a.createGain();
  gain.gain.value = 0.9;
  noise.connect(band).connect(gain).connect(a.destination);
  noise.start(t0);

  const thump = a.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(220, t0);
  thump.frequency.exponentialRampToValueAtTime(60, t0 + 0.12);
  const tg = a.createGain();
  tg.gain.setValueAtTime(0.6, t0);
  tg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
  thump.connect(tg).connect(a.destination);
  thump.start(t0);
  thump.stop(t0 + 0.16);
}

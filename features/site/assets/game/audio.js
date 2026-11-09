// Procedural audio for the desert oasis settlement builder.
// Everything is synthesized with the Web Audio API: no files, no network, no DOM.
// One shared graph builder (buildEngine) serves both live playback and renderOffline.

const LOOKAHEAD = 0.3; // seconds scheduled ahead of the audio clock
const TICK_MS = 100; // scheduler interval
const MAX_VOICES = 40; // hard cap on simultaneously sounding one-shot voices
const MUSIC_VOICES = 24; // cap the music may use, leaving room for sfx and ambience

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1 in full daylight, 0 at night, smooth dawn (5.5-7.5) and dusk (17.5-19.5).
function dayFactor(h) {
  h = ((h % 24) + 24) % 24;
  return smooth(5.5, 7.5, h) * (1 - smooth(17.5, 19.5, h));
}

// ---------------------------------------------------------------------------
// Musical material. Semitone offsets from D4.
// Night: D Eb F# G A Bb C (flat 2nd, raised 3rd), Day: D major pentatonic.
// ---------------------------------------------------------------------------
const D4 = 293.6648;
const NIGHT_SCALE = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16];
const DAY_SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19];
const CHORD_TONES = new Set([0, 4, 7, 12, 16, 19]);
const PLUCK_OFFSETS = [-12, -7, 0, 1, 2, 4, 5, 7, 8, 9, 10, 12, 13, 14, 16, 19];
const freqOf = (off) => D4 * Math.pow(2, off / 12);

// ---------------------------------------------------------------------------
// Karplus-Strong pluck data (plain JS), cached per sample rate.
// ---------------------------------------------------------------------------
const pluckCache = new Map();
function getPluckData(sr) {
  let m = pluckCache.get(sr);
  if (m) return m;
  m = new Map();
  const rng = mulberry32(7);
  for (const off of PLUCK_OFFSETS) {
    const f = freqOf(off);
    const n = Math.max(2, Math.round(sr / f));
    const len = Math.floor(sr * (off < 0 ? 2.6 : 1.9));
    const ring = new Float32Array(n);
    let prev = 0;
    for (let i = 0; i < n; i++) {
      prev = prev * 0.45 + (rng() * 2 - 1) * 0.55; // softened excitation = warmer pluck
      ring[i] = prev;
    }
    const decay = off < 0 ? 0.9985 : 0.9972;
    const out = new Float32Array(len);
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const next = idx + 1 === n ? 0 : idx + 1;
      const a = ring[idx];
      out[i] = a;
      ring[idx] = decay * 0.5 * (a + ring[next]);
      idx = next;
    }
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
    const g = peak > 0 ? 0.9 / peak : 1;
    const fade = Math.min(2048, len);
    for (let i = 0; i < len; i++) {
      let v = out[i] * g;
      if (i >= len - fade) v *= (len - i) / fade;
      out[i] = v;
    }
    // Averaging filter adds half a sample of delay: actual pitch is sr / (n + 0.5).
    m.set(off, { data: out, rate: f / (sr / (n + 0.5)) });
  }
  pluckCache.set(sr, m);
  return m;
}

// ---------------------------------------------------------------------------
// Noise data (plain JS).
// ---------------------------------------------------------------------------
function makeWhite(sr, seconds, seed) {
  const rng = mulberry32(seed);
  const d = new Float32Array(Math.floor(sr * seconds));
  for (let i = 0; i < d.length; i++) d[i] = rng() * 2 - 1;
  return d;
}
// Brown-ish noise made seamlessly loopable by cross-fading the tail into the head.
function makeBrown(sr, seconds, seed) {
  const rng = mulberry32(seed);
  const len = Math.floor(sr * seconds);
  const fade = Math.floor(sr * 0.25);
  const x = new Float32Array(len + fade);
  let acc = 0;
  for (let i = 0; i < x.length; i++) {
    acc = acc * 0.985 + (rng() * 2 - 1) * 0.1;
    x[i] = acc;
  }
  const y = new Float32Array(len);
  for (let i = 0; i < len; i++) y[i] = x[i];
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    y[i] = x[i] * t + x[len + i] * (1 - t);
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(y[i]));
  const g = peak > 0 ? 0.9 / peak : 1;
  for (let i = 0; i < len; i++) y[i] *= g;
  return y;
}
function makeImpulse(sr, seconds, seed, chan) {
  const rng = mulberry32(seed + chan * 101);
  const len = Math.floor(sr * seconds);
  const d = new Float32Array(len);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    lp = lp * 0.55 + (rng() * 2 - 1) * 0.45;
    d[i] = lp * Math.pow(1 - i / len, 2.8) * (i < 200 ? i / 200 : 1);
  }
  return d;
}

// ---------------------------------------------------------------------------
// WAV encoder: 16-bit PCM stereo. channels = [Float32Array left, right?].
// ---------------------------------------------------------------------------
export function encodeWav(channels, sampleRate) {
  const left = channels[0];
  const right = channels[1] || left;
  const len = left.length;
  const nch = 2;
  const buf = new ArrayBuffer(44 + len * nch * 2);
  const v = new DataView(buf);
  const str = (o, s) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + len * nch * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, nch, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * nch * 2, true);
  v.setUint16(32, nch * 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, len * nch * 2, true);
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < 2; c++) {
      let s = (c === 0 ? left : right)[i];
      s = s < -1 ? -1 : s > 1 ? 1 : s;
      v.setInt16(o, Math.round(s < 0 ? s * 32768 : s * 32767), true);
      o += 2;
    }
  }
  return buf;
}

// ---------------------------------------------------------------------------
// The shared graph. cfg = { live, onCaption, vols, state, isMuted }
// ---------------------------------------------------------------------------
function buildEngine(ctx, cfg) {
  const live = cfg.live;
  const vols = cfg.vols;
  const state = cfg.state;
  const sr = ctx.sampleRate;
  const rA = mulberry32(1337); // ambience + sfx randomness
  const rM = mulberry32(20241109); // music phrases

  // ---- shared buffers ----
  const mkBuf = (data) => {
    const b = ctx.createBuffer(1, data.length, sr);
    b.getChannelData(0).set(data);
    return b;
  };
  const white = mkBuf(makeWhite(sr, 4, 11));
  const brown = mkBuf(makeBrown(sr, 4, 23));
  const plucks = new Map();
  for (const [off, p] of getPluckData(sr)) plucks.set(off, { b: mkBuf(p.data), rate: p.rate });
  const irBuf = ctx.createBuffer(2, Math.floor(sr * 1.8), sr);
  irBuf.getChannelData(0).set(makeImpulse(sr, 1.8, 5, 0));
  irBuf.getChannelData(1).set(makeImpulse(sr, 1.8, 5, 1));

  // ---- buses ----
  const master = ctx.createGain();
  master.gain.value = live ? 0 : vols.master;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 18;
  comp.ratio.value = 3;
  comp.attack.value = 0.01;
  comp.release.value = 0.25;
  master.connect(comp);
  comp.connect(ctx.destination);

  const musicBus = ctx.createGain();
  const ambBus = ctx.createGain();
  const sfxBus = ctx.createGain();
  musicBus.connect(master);
  ambBus.connect(master);
  sfxBus.connect(master);

  const reverb = ctx.createConvolver();
  reverb.buffer = irBuf;
  const reverbOut = ctx.createGain();
  reverbOut.gain.value = 0.75;
  reverb.connect(reverbOut);
  reverbOut.connect(master);
  const musicSend = ctx.createGain();
  musicSend.gain.value = 0.32;
  musicBus.connect(musicSend);
  musicSend.connect(reverb);
  const sfxSend = ctx.createGain();
  sfxSend.gain.value = 0.28;
  sfxBus.connect(sfxSend);
  sfxSend.connect(reverb);

  // ambience layer buses
  const mkLayer = () => {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(ambBus);
    return g;
  };
  const waterGain = mkLayer();
  const windGain = mkLayer();
  const marketGain = mkLayer();
  const rainGain = mkLayer();
  const insectGain = mkLayer();
  const birdGain = mkLayer();
  birdGain.gain.value = 0.9;

  // ---- helpers ----
  const ramp = (param, v, tc) => {
    if (live) param.setTargetAtTime(v, ctx.currentTime, tc);
    else param.setValueAtTime(v, 0);
  };
  const panNode = (p, dest) => {
    let n;
    if (typeof ctx.createStereoPanner === 'function') {
      n = ctx.createStereoPanner();
      n.pan.value = clamp(p || 0, -1, 1);
    } else n = ctx.createGain();
    n.connect(dest);
    return n;
  };
  const voices = [];
  let pruneBefore = 0;
  const voiceOk = (when, limit) => {
    let c = 0;
    for (let i = voices.length - 1; i >= 0; i--) {
      const v = voices[i];
      if (v.e < pruneBefore) {
        voices.splice(i, 1);
        continue;
      }
      if (v.s <= when && v.e > when) c++;
    }
    return c < limit;
  };
  const addVoice = (s, d) => voices.push({ s, e: s + d });

  const capLast = new Map();
  const caption = (text, gapMs) => {
    if (!cfg.onCaption) return;
    const now = Date.now();
    if (now - (capLast.get(text) || 0) < Math.max(4000, gapMs || 4000)) return;
    capLast.set(text, now);
    try {
      cfg.onCaption(text);
    } catch (e) {
      /* caption sinks must never break audio */
    }
  };

  function envGain(dest, when, a, peak, d) {
    const g = ctx.createGain();
    const p = g.gain;
    const att = Math.max(a, 0.004);
    p.setValueAtTime(0.0001, when);
    p.linearRampToValueAtTime(Math.max(peak, 0.0002), when + att);
    p.exponentialRampToValueAtTime(0.0001, when + att + d);
    g.connect(dest);
    return g;
  }
  function tone(dest, type, f0, when, a, d, peak, f1) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, when);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, when + Math.max(a, 0.004) + d);
    const g = envGain(dest, when, a, peak, d);
    o.connect(g);
    o.start(when);
    o.stop(when + Math.max(a, 0.004) + d + 0.05);
    return g;
  }
  function noiseSrc(buf, when, dur, rate) {
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    if (rate) s.playbackRate.value = rate;
    s.start(when, rA() * (buf.duration - 0.5));
    s.stop(when + dur);
    return s;
  }
  function burst(dest, buf, when, a, d, peak, type, f0, q, f1) {
    const s = noiseSrc(buf, when, Math.max(a, 0.004) + d + 0.05);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, when);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, when + Math.max(a, 0.004) + d);
    f.Q.value = q;
    s.connect(f);
    const g = envGain(dest, when, a, peak, d);
    f.connect(g);
    return g;
  }
  function pluck(dest, off, when, vel) {
    const p = plucks.get(off);
    if (!p) return;
    const s = ctx.createBufferSource();
    s.buffer = p.b;
    s.playbackRate.value = p.rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vel, when + 0.003);
    s.connect(g);
    g.connect(dest);
    s.start(when);
    s.stop(when + p.b.duration / p.rate + 0.05);
  }
  function bell(dest, when, f, peak) {
    tone(dest, 'sine', f, when, 0.006, 1.5, peak);
    tone(dest, 'sine', f * 2, when, 0.006, 0.8, peak * 0.32);
    tone(dest, 'sine', f * 3.01, when, 0.006, 0.4, peak * 0.1);
  }
  function birdTrill(dest, when) {
    const n = 2 + Math.floor(rA() * 3);
    const base = 2600 + rA() * 1500;
    const up = rA() > 0.3;
    for (let i = 0; i < n; i++) {
      const f0 = base * (1 + (rA() - 0.5) * 0.1);
      tone(dest, 'sine', f0, when + i * 0.11, 0.01, 0.07, 0.05, up ? f0 * 1.45 : f0 * 0.7);
    }
    addVoice(when, n * 0.11 + 0.15);
  }

  // ---- ambience graph (persistent, looping) ----
  const sources = [];
  function loopNoise(buf, rate, offsetFrac) {
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.playbackRate.value = rate;
    sources.push([s, offsetFrac * buf.duration]);
    return s;
  }
  function lfo(freq, depth, target) {
    const o = ctx.createOscillator();
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = depth;
    o.connect(g);
    g.connect(target);
    sources.push([o, 0]);
    return o;
  }
  const filt = (type, f, q) => {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  };

  // water: two babbling bands
  {
    const n1 = loopNoise(white, 1.0, 0.1);
    const f1 = filt('bandpass', 520, 0.8);
    n1.connect(f1);
    f1.connect(waterGain);
    const n2 = loopNoise(white, 0.9, 0.55);
    const f2 = filt('bandpass', 1700, 1.2);
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    lfo(0.43, 0.2, g2.gain);
    n2.connect(f2);
    f2.connect(g2);
    g2.connect(waterGain);
  }
  // wind: brown noise through a slowly wandering bandpass
  {
    const n = loopNoise(brown, 0.8, 0.3);
    const f = filt('bandpass', 450, 1.4);
    lfo(0.071, 220, f.frequency);
    lfo(0.133, 110, f.frequency);
    const mod = ctx.createGain();
    mod.gain.value = 0.75;
    lfo(0.05, 0.25, mod.gain);
    n.connect(f);
    f.connect(mod);
    mod.connect(windGain);
  }
  // rain: bright noise
  {
    const n = loopNoise(white, 1.1, 0.8);
    const hp = filt('highpass', 1500, 0.7);
    const lp = filt('lowpass', 9000, 0.7);
    n.connect(hp);
    hp.connect(lp);
    lp.connect(rainGain);
  }
  // drone: warm low D with a fifth, slow breathing
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0;
  const droneLP = filt('lowpass', 420, 0.5);
  droneLP.connect(droneGain);
  droneGain.connect(musicBus);
  {
    const mk = (type, f, g) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og);
      og.connect(droneLP);
      sources.push([o, 0]);
    };
    const d2 = D4 / 4;
    mk('triangle', d2, 0.55);
    mk('sine', d2 * 1.004, 0.45);
    mk('sine', d2 * 1.5, 0.3);
    mk('sine', d2 * 2, 0.22);
    lfo(0.047, 0.22, droneGain.gain);
  }

  // ---- ambience events ----
  function murmur(when) {
    if (!voiceOk(when, MAX_VOICES - 6)) return;
    const syl = 3 + Math.floor(rA() * 4);
    const dur = syl * (0.11 + rA() * 0.06) + 0.1;
    const s = noiseSrc(white, when, dur + 0.1);
    const f1 = filt('bandpass', 450, 3.5);
    const f2 = filt('bandpass', 1500, 4);
    const f2g = ctx.createGain();
    f2g.gain.value = 0.45;
    const lp = filt('lowpass', 2600, 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    s.connect(f1);
    s.connect(f2);
    f1.connect(g);
    f2.connect(f2g);
    f2g.connect(g);
    g.connect(lp);
    lp.connect(panNode((rA() - 0.5) * 1.2, marketGain));
    let t = when;
    const base = 300 + rA() * 250;
    for (let i = 0; i < syl; i++) {
      const sd = 0.08 + rA() * 0.07;
      f1.frequency.setValueAtTime(base * (0.8 + rA() * 0.7), t);
      f2.frequency.setValueAtTime(base * (2.6 + rA() * 1.6), t);
      g.gain.linearRampToValueAtTime(0.1 * (0.5 + rA() * 0.7), t + sd * 0.4);
      g.gain.linearRampToValueAtTime(0.01, t + sd);
      t += sd + 0.02 + rA() * 0.04;
    }
    g.gain.linearRampToValueAtTime(0, t + 0.05);
    addVoice(when, dur);
    if (state.market > 0.25) caption('Market murmurs', 14000);
  }
  function clink(when) {
    if (!voiceOk(when, MAX_VOICES - 6)) return;
    const f = 2000 + rA() * 2200;
    const d = panNode((rA() - 0.5) * 1.2, marketGain);
    tone(d, 'sine', f, when, 0.002, 0.28, 0.02);
    tone(d, 'sine', f * 2.76, when, 0.002, 0.12, 0.01);
    addVoice(when, 0.4);
  }
  function bubble(when) {
    if (!voiceOk(when, MAX_VOICES - 6)) return;
    const f = 400 + rA() * 700;
    tone(waterGain, 'sine', f, when, 0.004, 0.05, 0.05, f * 1.7);
    addVoice(when, 0.1);
    if (state.water > 0.3) caption('Water trickles', 14000);
  }
  function insect(when) {
    if (!voiceOk(when, MAX_VOICES - 6)) return;
    const n = 3 + Math.floor(rA() * 4);
    const f = 4300 + rA() * 900;
    for (let i = 0; i < n; i++) tone(insectGain, 'sine', f, when + i * 0.05, 0.006, 0.03, 0.03);
    addVoice(when, n * 0.05 + 0.1);
  }
  function bird(when) {
    if (!voiceOk(when, MAX_VOICES - 6)) return;
    birdTrill(panNode((rA() - 0.5) * 1.6, birdGain), when);
    caption('Birds sing', 14000);
  }
  const birdWeight = () => {
    const h = ((state.timeOfDay % 24) + 24) % 24;
    return Math.max(0, 1 - Math.abs(h - 6.5) / 1.5);
  };
  const gens = [
    { next: 0, rate: () => state.water * 2.2, fire: bubble },
    { next: 0, rate: () => state.market * dayFactor(state.timeOfDay) * 0.3, fire: clink },
    { next: 0, rate: () => state.market * (0.3 + 0.7 * dayFactor(state.timeOfDay)) * 0.8, fire: murmur },
    { next: 0, rate: () => state.insects * (1 - dayFactor(state.timeOfDay)) * 2, fire: insect },
    { next: 0, rate: () => birdWeight() * 0.9, fire: bird },
  ];

  // ---- music ----
  const music = { next: 0.05, step: 0, bar: 0, motif: [], key: '', fluteUntil: 0 };
  const stepDur = () => 30 / lerp(54, 88, dayFactor(state.timeOfDay)); // one eighth note

  function genMotif(scale, dens) {
    const m = [];
    let d = Math.floor(scale.length * 0.4);
    for (let s = 0; s < 8; s++) {
      const strong = s === 0 || s === 4;
      if (s === 4 ? rM() > dens + 0.3 : !strong && rM() > dens) {
        m.push(-1);
        continue;
      }
      d = clamp(d + Math.floor(rM() * 5) - 2, 0, scale.length - 1);
      if (strong) {
        let best = d;
        let bd = 99;
        for (let i = 0; i < scale.length; i++) {
          if (CHORD_TONES.has(scale[i]) && Math.abs(i - d) < bd) {
            bd = Math.abs(i - d);
            best = i;
          }
        }
        d = best;
      }
      m.push(d);
    }
    return m;
  }
  function varyMotif(motif, scale) {
    const m = motif.slice();
    const k = 1 + Math.floor(rM() * 2);
    for (let i = 0; i < k; i++) {
      const s = 1 + Math.floor(rM() * 7);
      if (s === 4 || m[s] < 0) continue;
      m[s] = clamp(m[s] + (rM() > 0.5 ? 1 : -1), 0, scale.length - 1);
    }
    return m;
  }
  function drum(when, vel, tak) {
    if (!voiceOk(when, MUSIC_VOICES)) return;
    burst(musicBus, brown, when, 0.004, 0.2, 0.55 * vel, 'bandpass', tak ? 950 : 170, tak ? 1.6 : 1.1);
    if (!tak) tone(musicBus, 'sine', 110, when, 0.004, 0.24, 0.3 * vel, 52);
    addVoice(when, 0.3);
  }
  function flute(when, off, dur, vel) {
    if (!voiceOk(when, MUSIC_VOICES)) return;
    const f = freqOf(off + 12);
    const out = panNode(0.15, musicBus);
    const end = when + dur;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vel, when + 0.3);
    g.gain.linearRampToValueAtTime(vel * 0.85, end);
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.6);
    g.connect(out);
    const stopAt = end + 0.7;
    const vib = ctx.createOscillator();
    vib.frequency.value = 4.6;
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(0, when);
    vg.gain.linearRampToValueAtTime(f * 0.006, when + 1);
    vib.connect(vg);
    vib.start(when);
    vib.stop(stopAt);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.985, when);
    o.frequency.linearRampToValueAtTime(f, when + 0.12);
    vg.connect(o.frequency);
    o.connect(g);
    o.start(when);
    o.stop(stopAt);
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 2;
    const vg2 = ctx.createGain();
    vg2.gain.value = 2;
    vg.connect(vg2);
    vg2.connect(o2.frequency);
    const g2 = ctx.createGain();
    g2.gain.value = 0.12;
    o2.connect(g2);
    g2.connect(g);
    o2.start(when);
    o2.stop(stopAt);
    // breath
    const ns = noiseSrc(white, when, dur + 0.7);
    const bf = filt('bandpass', f, 5);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, when);
    bg.gain.linearRampToValueAtTime(0.55, when + 0.12);
    bg.gain.linearRampToValueAtTime(0.14, when + 0.5);
    bg.gain.linearRampToValueAtTime(0.0001, end + 0.5);
    ns.connect(bf);
    bf.connect(bg);
    bg.connect(g);
    addVoice(when, dur + 0.7);
    addVoice(when, dur + 0.7);
  }

  function musicStep(t) {
    const day = dayFactor(state.timeOfDay);
    const sd = stepDur();
    const slot = music.step % 8;
    if (slot === 0) {
      const isDay = day >= 0.5;
      const scale = isDay ? DAY_SCALE : NIGHT_SCALE;
      const key = isDay ? 'd' : 'n';
      const dens = isDay ? 0.62 : 0.34;
      const pb = music.bar % 4;
      if (key !== music.key || pb === 0) {
        music.motif = genMotif(scale, dens);
        music.key = key;
      } else {
        music.motif = varyMotif(music.motif, scale);
        if (pb === 3) {
          music.motif[6] = 0;
          music.motif[7] = -1;
        }
      }
      music.scale = scale;
      music.dens = dens;
      // bass pluck on the downbeat
      if (pb % 2 === 0 && (isDay || rM() < 0.6)) {
        pluck(panNode(-0.1, musicBus), -12, t, 0.5 * (isDay ? 0.8 : 0.7));
        addVoice(t, 2.5);
      }
      // night flute
      if (day < 0.5 && t > music.fluteUntil && rM() < 0.55 * (1 - day * 2)) {
        const off = music.scale[Math.floor(rM() * Math.min(6, music.scale.length))];
        const dur = sd * (6 + Math.floor(rM() * 9));
        flute(t + 0.05, off, dur, 0.11);
        music.fluteUntil = t + dur + 1;
      }
    }
    const scale = music.scale || DAY_SCALE;
    const deg = music.motif[slot];
    if (deg !== undefined && deg >= 0 && voiceOk(t, MUSIC_VOICES)) {
      const strong = slot === 0 || slot === 4;
      const vel = (strong ? 0.42 : 0.26) * (0.85 + rM() * 0.3) * (day >= 0.5 ? 1 : 0.8);
      pluck(panNode((rM() - 0.5) * 0.6, musicBus), scale[deg], t + (rM() - 0.5) * 0.012, vel);
      addVoice(t, 2);
    }
    if (slot === 4 && rM() < 0.35) {
      pluck(panNode(0.1, musicBus), -7, t, 0.3);
      addVoice(t, 2.5);
    }
    // frame drum
    if (day >= 0.5) {
      if (slot === 0) drum(t, 0.8, false);
      else if (slot === 4) drum(t, 0.55, false);
      else if (slot === 3 && rM() < 0.7) drum(t, 0.35, true);
      else if (slot === 6 && rM() < 0.5) drum(t, 0.3, true);
    } else {
      if (slot === 0 && music.bar % 2 === 0) drum(t, 0.5, false);
      else if (slot === 4 && rM() < 0.3) drum(t, 0.3, false);
    }
    music.step++;
    if (slot === 7) music.bar++;
    return sd;
  }

  // ---- scheduler (shared by live timer and offline loop) ----
  function schedule(from, upTo) {
    pruneBefore = from - 3;
    if (music.next < from) music.next = from + 0.02;
    while (music.next < upTo) {
      const sd = musicStep(music.next);
      music.next += sd;
    }
    for (const g of gens) {
      if (g.next < from) g.next = from;
      const r = g.rate();
      if (r <= 0.002) {
        g.next = Math.max(g.next, upTo);
        continue;
      }
      while (g.next < upTo) {
        g.fire(g.next);
        g.next += Math.max(0.05, -Math.log(1 - rA() * 0.999) / r);
      }
    }
  }

  // ---- sfx ----
  const SFX = {
    place(o, t, k) {
      burst(o, brown, t, 0.003, 0.1, 0.6 * k, 'lowpass', 420, 0.7);
      tone(o, 'sine', 150, t, 0.003, 0.13, 0.5 * k, 70);
      burst(o, white, t + 0.02, 0.01, 0.16, 0.06 * k, 'highpass', 3800, 0.7);
    },
    sculpt(o, t, k) {
      burst(o, white, t, 0.03, 0.22, 0.1 * k, 'bandpass', 700, 1.2, 1600);
      tone(o, 'sine', 120, t, 0.01, 0.18, 0.3 * k, 80);
    },
    carve(o, t, k) {
      for (let i = 0; i < 4; i++) burst(o, white, t + i * 0.07, 0.012, 0.09, 0.11 * k, 'bandpass', 1300 + i * 170 + rA() * 200, 2.2);
    },
    water(o, t, k) {
      for (let i = 0; i < 6; i++) {
        const f = 500 + rA() * 700;
        const tt = t + i * 0.07 + rA() * 0.04;
        tone(o, 'sine', f, tt, 0.004, 0.05, 0.07 * k, f * 1.6);
      }
      burst(o, white, t, 0.05, 0.45, 0.03 * k, 'bandpass', 2200, 1);
    },
    discover(o, t, k) {
      bell(o, t, 587.33, 0.2 * k);
      bell(o, t + 0.15, 880, 0.17 * k);
    },
    unlock(o, t, k) {
      [587.33, 739.99, 880, 1174.66].forEach((f, i) => bell(o, t + i * 0.11, f, 0.15 * k));
    },
    ui(o, t, k) {
      tone(o, 'sine', 1900, t, 0.002, 0.03, 0.07 * k, 1500);
    },
    uiBack(o, t, k) {
      tone(o, 'sine', 1300, t, 0.002, 0.04, 0.07 * k, 900);
    },
    photo(o, t, k) {
      burst(o, white, t, 0.002, 0.035, 0.16 * k, 'bandpass', 3200, 1.4);
      burst(o, white, t + 0.07, 0.002, 0.05, 0.12 * k, 'bandpass', 2400, 1.4);
      tone(o, 'sine', 200, t, 0.003, 0.05, 0.08 * k, 120);
    },
    delete(o, t, k) {
      burst(o, white, t, 0.01, 0.28, 0.16 * k, 'lowpass', 1800, 0.8, 200);
      tone(o, 'sine', 220, t, 0.005, 0.22, 0.2 * k, 90);
    },
    undo(o, t, k) {
      tone(o, 'sine', 740, t, 0.003, 0.08, 0.1 * k, 520);
      tone(o, 'sine', 520, t + 0.07, 0.003, 0.1, 0.1 * k, 380);
    },
    goal(o, t, k) {
      [7, 12, 16].forEach((off, i) => pluck(o, off, t + i * 0.13, 0.5 * k));
    },
    chapter(o, t, k) {
      [14, 12, 9, 7, 4, 0].forEach((off, i) => pluck(o, off, t + i * 0.22, 0.42 * k));
      [0, 7, 12, 16].forEach((off, i) => pluck(o, off, t + 1.5 + i * 0.04, 0.4 * k));
      bell(o, t + 1.5, 587.33, 0.12 * k);
    },
    footstep(o, t, k) {
      burst(o, brown, t, 0.003, 0.07, 0.22 * k * (0.7 + rA() * 0.3), 'lowpass', 300 + rA() * 200, 0.8);
    },
    bloom(o, t, k) {
      tone(o, 'sine', 392, t, 0.15, 0.5, 0.12 * k, 784);
      tone(o, 'sine', 1174.66, t + 0.1, 0.2, 0.5, 0.05 * k);
      bell(o, t + 0.3, 1568, 0.05 * k);
    },
    birds(o, t) {
      birdTrill(o, t);
      birdTrill(o, t + 0.5 + rA() * 0.3);
    },
  };
  const SFX_CAPTIONS = {
    place: 'Soft thud',
    carve: 'Sand scrapes',
    water: 'Water trickles',
    discover: 'Chimes',
    unlock: 'Chimes',
    goal: 'Plucked notes rise',
    chapter: 'Chimes',
    photo: 'Shutter click',
    bloom: 'A flower blooms',
    birds: 'Birds sing',
  };

  function sfx(name, opts, when) {
    const fn = Object.prototype.hasOwnProperty.call(SFX, name) ? SFX[name] : null;
    if (!fn) return;
    const k = clamp(Number.isFinite(+opts?.intensity) ? +opts.intensity : 1, 0, 2) * 0.8;
    if (!voiceOk(when, MAX_VOICES)) return;
    const out = panNode(opts && Number.isFinite(+opts.pan) ? +opts.pan : 0, sfxBus);
    fn(out, when, k);
    addVoice(when, 2);
    if (SFX_CAPTIONS[name]) caption(SFX_CAPTIONS[name], 4000);
  }

  // ---- params / volumes ----
  function applyParams(p, tc) {
    if (p) {
      if (Number.isFinite(+p.timeOfDay) && p.timeOfDay !== null) state.timeOfDay = ((+p.timeOfDay % 24) + 24) % 24;
      for (const k of ['water', 'market', 'wind', 'rain', 'insects']) {
        if (p[k] !== undefined && p[k] !== null && Number.isFinite(+p[k])) state[k] = clamp(+p[k], 0, 1);
      }
    }
    const day = dayFactor(state.timeOfDay);
    const t = tc === undefined ? 0.5 : tc;
    ramp(waterGain.gain, 0.26 * state.water, t);
    ramp(windGain.gain, 0.5 * state.wind, t);
    ramp(marketGain.gain, state.market * (0.3 + 0.7 * day), t);
    ramp(rainGain.gain, state.rain > 0.001 ? 0.2 * state.rain : 0, t);
    ramp(insectGain.gain, state.insects * (1 - day), t);
    ramp(droneGain.gain, lerp(0.12, 0.075, day), t * 2);
    ramp(droneLP.frequency, lerp(340, 520, day), t * 2);
  }
  function applyVolumes(tc) {
    const t = tc === undefined ? 0.1 : tc;
    ramp(master.gain, cfg.isMuted() ? 0 : vols.master, t);
    ramp(musicBus.gain, vols.music, t);
    ramp(ambBus.gain, vols.ambience, t);
    ramp(sfxBus.gain, vols.sfx, t);
  }

  function start() {
    const t0 = live ? ctx.currentTime + 0.02 : 0;
    for (const [s, off] of sources) {
      if (s.buffer) s.start(t0, off);
      else s.start(t0);
    }
  }

  return { start, schedule, sfx, applyParams, applyVolumes, master, ctx };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
function makeNoop() {
  const noop = () => {};
  return {
    available: false,
    init: noop,
    setVolumes: noop,
    setMuted: noop,
    isMuted: () => false,
    update: noop,
    sfx: noop,
    renderOffline: () => Promise.reject(new Error('Web Audio is unavailable')),
  };
}

export function createAudio(opts = {}) {
  let AC = null;
  let OAC = null;
  try {
    const g = typeof globalThis !== 'undefined' ? globalThis : {};
    AC = g.AudioContext || g.webkitAudioContext || null;
    OAC = g.OfflineAudioContext || g.webkitOfflineAudioContext || null;
  } catch (e) {
    AC = null;
  }
  if (!AC) return makeNoop();

  const onCaption = opts && typeof opts.onCaption === 'function' ? opts.onCaption : null;
  const vols = { master: 0.8, music: 0.55, ambience: 0.7, sfx: 0.8 };
  const state = { timeOfDay: 12, water: 0.5, market: 0.3, wind: 0.3, rain: 0, insects: 0.3 };
  let muted = false;
  let ctx = null;
  let engine = null;
  let timer = null;

  const api = {
    available: true,
    init() {
      try {
        if (!ctx) {
          try {
            ctx = new AC({ latencyHint: 'playback' });
          } catch (e) {
            ctx = new AC();
          }
          engine = buildEngine(ctx, { live: true, onCaption, vols, state, isMuted: () => muted });
          engine.applyParams(null, 0.05);
          engine.applyVolumes(0.6);
          engine.start();
          timer = setInterval(() => {
            try {
              if (ctx.state === 'running') engine.schedule(ctx.currentTime, ctx.currentTime + LOOKAHEAD);
            } catch (e) {
              /* keep the timer alive */
            }
          }, TICK_MS);
        }
        if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
          const r = ctx.resume();
          if (r && typeof r.catch === 'function') r.catch(() => {});
        }
      } catch (e) {
        if (timer) clearInterval(timer);
        timer = null;
        ctx = null;
        engine = null;
        api.available = false;
      }
    },
    setVolumes(v) {
      try {
        if (v) for (const k of ['master', 'music', 'ambience', 'sfx']) if (Number.isFinite(+v[k]) && v[k] !== null) vols[k] = clamp(+v[k], 0, 1);
        if (engine) engine.applyVolumes(0.1);
      } catch (e) {
        /* ignore */
      }
    },
    setMuted(b) {
      try {
        muted = !!b;
        if (engine) engine.applyVolumes(0.1);
      } catch (e) {
        /* ignore */
      }
    },
    isMuted: () => muted,
    update(p) {
      try {
        if (engine) engine.applyParams(p, 0.5);
        else if (p) {
          // before init: just remember the values
          if (Number.isFinite(+p.timeOfDay)) state.timeOfDay = ((+p.timeOfDay % 24) + 24) % 24;
          for (const k of ['water', 'market', 'wind', 'rain', 'insects']) if (Number.isFinite(+p[k]) && p[k] !== null) state[k] = clamp(+p[k], 0, 1);
        }
      } catch (e) {
        /* ignore */
      }
    },
    sfx(name, o) {
      try {
        if (engine && ctx.state === 'running') engine.sfx(name, o || {}, ctx.currentTime + 0.005);
      } catch (e) {
        /* ignore */
      }
    },
    renderOffline(seconds, params, events = []) {
      return new Promise((resolve, reject) => {
        try {
          if (!OAC) throw new Error('OfflineAudioContext is unavailable');
          const secs = clamp(+seconds || 10, 1, 300);
          const rate = 44100;
          const octx = new OAC(2, Math.ceil(secs * rate), rate);
          const st = Object.assign({}, state);
          const ov = Object.assign({}, vols);
          const eng = buildEngine(octx, { live: false, onCaption: null, vols: ov, state: st, isMuted: () => false });
          eng.applyParams(params || {}, 0);
          eng.applyVolumes(0);
          eng.start();
          eng.master.gain.setValueAtTime(ov.master, Math.max(0, secs - 0.5));
          eng.master.gain.linearRampToValueAtTime(0, secs);
          const evs = (Array.isArray(events) ? events : [])
            .filter((e) => e && Number.isFinite(+e.t) && +e.t >= 0 && +e.t < secs)
            .sort((a, b) => a.t - b.t);
          let ei = 0;
          for (let t = 0; t < secs; t += 0.5) {
            const up = Math.min(secs, t + 0.5);
            eng.schedule(t, up);
            while (ei < evs.length && evs[ei].t < up) {
              eng.sfx(evs[ei].name, evs[ei], evs[ei].t);
              ei++;
            }
          }
          octx
            .startRendering()
            .then((buf) => resolve(encodeWav([buf.getChannelData(0), buf.getChannelData(Math.min(1, buf.numberOfChannels - 1))], buf.sampleRate)))
            .catch(reject);
        } catch (e) {
          reject(e);
        }
      });
    },
  };
  return api;
}

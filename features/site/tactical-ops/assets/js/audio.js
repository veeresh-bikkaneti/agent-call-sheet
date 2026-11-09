// audio.js — WebAudio synth sound manager. No audio files, no external APIs.
// Everything starts only after a user gesture (autoplay policy).
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = false;
    this.ambient = null;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      if (!this.ensure()) { this.enabled = false; return false; }
      this.startAmbient();
    } else if (this.ambient) {
      try { this.ambient.stop(); } catch (e) { /* already stopped */ }
      this.ambient = null;
    }
    return this.enabled;
  }

  tone(freq, dur, type, gain, slideTo) {
    if (!this.enabled || !this.ensure()) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(gain || 0.12, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  noise(dur, gain, cutoff) {
    if (!this.enabled || !this.ensure()) return;
    const t0 = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = cutoff || 800;
    const g = this.ctx.createGain(); g.gain.value = gain || 0.15;
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t0);
  }

  click() { this.tone(880, 0.06, 'square', 0.08); }
  select() { this.tone(440, 0.08, 'triangle', 0.1, 660); }
  hit() { this.noise(0.12, 0.2, 500); this.tone(160, 0.12, 'sawtooth', 0.12, 90); }
  crit() { this.noise(0.18, 0.25, 900); this.tone(220, 0.2, 'sawtooth', 0.14, 55); this.tone(1320, 0.1, 'square', 0.06); }
  kill() { this.tone(523, 0.12, 'triangle', 0.12); setTimeout(() => this.tone(659, 0.12, 'triangle', 0.12), 90); setTimeout(() => this.tone(784, 0.22, 'triangle', 0.14), 180); }
  open() { this.tone(330, 0.09, 'triangle', 0.1, 495); }
  denied() { this.tone(140, 0.15, 'square', 0.08, 100); }

  startAmbient() {
    if (!this.enabled || !this.ensure() || this.ambient) return;
    // Drizzle: looped filtered noise at low gain
    const dur = 2;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filt = this.ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 2400; filt.Q.value = 0.4;
    const g = this.ctx.createGain(); g.gain.value = 0.035;
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start();
    this.ambient = src;
  }
}

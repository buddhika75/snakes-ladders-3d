// All sounds are synthesised with the Web Audio API — no audio files needed.
export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.musicTimer = null;
  }

  ensure() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      this.ctx = new C();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  tone(freq, dur, { type = 'sine', vol = 0.3, when = 0, slideTo = null, attack = 0.005, music = false } = {}) {
    if (music ? !this.musicOn : !this.sfxOn) return;
    const ctx = this.ensure();
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.3, when = 0, freq = 2000, q = 1, type = 'bandpass', slideTo = null } = {}) {
    if (!this.sfxOn) return;
    const ctx = this.ensure();
    const t = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur);
  }

  click() { this.tone(880, 0.06, { type: 'triangle', vol: 0.2 }); }

  dice() {
    for (let i = 0; i < 8; i++) {
      const w = i * 0.075 + Math.random() * 0.03;
      this.noise(0.05, { when: w, vol: 0.5, freq: 1600 + Math.random() * 1800, q: 5 });
      this.tone(250 + Math.random() * 500, 0.04, { type: 'triangle', vol: 0.1, when: w });
    }
  }

  land() {
    this.tone(150, 0.18, { vol: 0.45, slideTo: 60 });
    this.noise(0.09, { vol: 0.35, freq: 900, q: 2 });
  }

  step(i = 0) {
    const scale = [0, 2, 4, 5, 7, 9, 11, 12];
    const f = 523.25 * Math.pow(2, scale[i % 8] / 12);
    this.tone(f, 0.13, { type: 'triangle', vol: 0.25 });
    this.tone(f * 2, 0.07, { vol: 0.07 });
  }

  ladder() {
    const notes = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5, 1318.5];
    notes.forEach((n, i) => {
      this.tone(n, 0.2, { type: 'square', vol: 0.06, when: i * 0.1 });
      this.tone(n / 2, 0.2, { type: 'triangle', vol: 0.14, when: i * 0.1 });
    });
  }

  snake() {
    this.noise(0.9, { vol: 0.28, freq: 7000, q: 0.8, type: 'highpass' });
    this.tone(700, 1.3, { type: 'sawtooth', vol: 0.12, slideTo: 70, when: 0.15 });
    this.tone(705, 1.3, { type: 'sawtooth', vol: 0.08, slideTo: 72, when: 0.15 });
    this.tone(90, 0.5, { vol: 0.4, slideTo: 40, when: 1.3 });
  }

  bonk() {
    this.tone(220, 0.15, { type: 'square', vol: 0.12 });
    this.tone(165, 0.25, { type: 'square', vol: 0.12, when: 0.13 });
  }

  six() {
    [784, 1046.5, 1568].forEach((n, i) => this.tone(n, 0.15, { type: 'triangle', vol: 0.2, when: i * 0.07 }));
  }

  win() {
    const seq = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    seq.forEach((n, i) => this.tone(n, 0.22, { type: 'square', vol: 0.08, when: i * 0.13 }));
    [523.25, 659.25, 783.99, 1046.5].forEach(n => this.tone(n, 1.6, { type: 'triangle', vol: 0.12, when: 0.85, attack: 0.03 }));
    for (let i = 0; i < 10; i++) this.noise(0.12, { when: 0.9 + i * 0.12 + Math.random() * 0.05, vol: 0.15, freq: 5000, q: 1 });
  }

  // Gentle generative pentatonic background music.
  startMusic() {
    if (this.musicTimer) return;
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];
    const pattern = [0, 2, 4, 2, 3, 5, 4, 1, 0, 4, 6, 5, 3, 2, 1, 2];
    const bass = [130.81, 110.0, 98.0, 110.0];
    let step = 0;
    this.musicTimer = setInterval(() => {
      if (!this.musicOn || !this.ctx) { step++; return; }
      const n = scale[pattern[step % pattern.length]];
      this.tone(n, 0.45, { vol: 0.045, music: true });
      if (step % 4 === 0) this.tone(bass[(step / 4) % 4], 1.3, { type: 'triangle', vol: 0.05, music: true, attack: 0.05 });
      step++;
    }, 320);
  }
}

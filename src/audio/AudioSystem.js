/**
 * 程序化音频(WebAudio,零外部素材):
 * 环境低频嗡鸣+海流白噪、声纳 ping、光晶琶音、信标点燃 swell、
 * 守卫低吼、咬击冲击、心跳(缺氧)、修复滴答、UI 点击、气泡。
 */
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.heartPhase = 0;
  }

  /** 需用户手势后调用 */
  start(settings) {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.ambBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.ambBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applySettings(settings);
    this._startAmbient();
    this.started = true;
  }

  applySettings(s) {
    if (!this.started) return;
    this.master.gain.value = s.master;
    this.sfxBus.gain.value = s.sfx;
    this.ambBus.gain.value = s.ambient;
  }

  _startAmbient() {
    const ctx = this.ctx;
    // 深海低频双音(轻微失谐 → 差拍涌动)
    for (const [f, g] of [[52, 0.16], [52.7, 0.13], [104.3, 0.05]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = f;
      const gain = ctx.createGain(); gain.gain.value = g;
      osc.connect(gain).connect(this.ambBus);
      osc.start();
    }
    // 海流:循环白噪 → lowpass → LFO 浪涌
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf; noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 240; lp.Q.value = 0.6;
    const nGain = ctx.createGain(); nGain.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(nGain.gain);
    noise.connect(lp).connect(nGain).connect(this.ambBus);
    noise.start(); lfo.start();
  }

  _env(node, t0, a, peak, d, end = 0.0001) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.linearRampToValueAtTime(peak, t0 + a);
    node.gain.exponentialRampToValueAtTime(end, t0 + a + d);
  }

  _tone(freq, { type = 'sine', a = 0.01, d = 0.3, peak = 0.2, sweep = null, bus = null } = {}) {
    if (!this.started) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweep), t0 + a + d);
    const g = ctx.createGain();
    this._env(g, t0, a, peak, d);
    osc.connect(g).connect(bus || this.sfxBus);
    osc.start(t0); osc.stop(t0 + a + d + 0.1);
  }

  ping() { this._tone(880, { type: 'sine', a: 0.005, d: 0.7, peak: 0.12, sweep: 440 }); }
  ui() { this._tone(520, { type: 'square', a: 0.002, d: 0.06, peak: 0.05 }); }
  bubble() { this._tone(300 + Math.random() * 500, { type: 'sine', a: 0.005, d: 0.12, peak: 0.05, sweep: 900 + Math.random() * 400 }); }

  pickup() {
    this._tone(660, { a: 0.005, d: 0.18, peak: 0.16 });
    setTimeout(() => this._tone(990, { a: 0.005, d: 0.3, peak: 0.14 }), 90);
  }

  repairTick() { this._tone(180 + Math.random() * 80, { type: 'triangle', a: 0.003, d: 0.07, peak: 0.06 }); }

  beacon() {
    if (!this.started) return;
    this._tone(110, { type: 'sine', a: 0.4, d: 2.6, peak: 0.3 });
    this._tone(220, { type: 'sine', a: 0.5, d: 2.2, peak: 0.18 });
    setTimeout(() => this._tone(1320, { a: 0.02, d: 1.8, peak: 0.1 }), 500);
    setTimeout(() => this._tone(1760, { a: 0.02, d: 2.4, peak: 0.08 }), 700);
  }

  growl() {
    if (!this.started) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, t0);
    osc.frequency.exponentialRampToValueAtTime(45, t0 + 1.1);
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; curve[i] = Math.tanh(x * 3); }
    shaper.curve = curve;
    const g = ctx.createGain();
    this._env(g, t0, 0.06, 0.22, 1.2);
    osc.connect(shaper).connect(g).connect(this.sfxBus);
    osc.start(t0); osc.stop(t0 + 1.5);
  }

  bite() {
    if (!this.started) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    // 低频冲击
    this._tone(70, { type: 'sine', a: 0.002, d: 0.4, peak: 0.5, sweep: 40 });
    // 噪声撕裂
    const len = ctx.sampleRate * 0.25;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.value = 0.3;
    src.connect(bp).connect(g).connect(this.sfxBus);
    src.start(t0);
  }

  heartbeat() {
    this._tone(58, { type: 'sine', a: 0.004, d: 0.16, peak: 0.4 });
    setTimeout(() => this._tone(52, { type: 'sine', a: 0.004, d: 0.14, peak: 0.3 }), 190);
  }

  victory() {
    const notes = [262, 330, 392, 523, 660];
    notes.forEach((f, i) => setTimeout(() => this._tone(f, { a: 0.02, d: 1.6, peak: 0.16 }), i * 180));
  }

  defeat() {
    const notes = [220, 196, 165, 110];
    notes.forEach((f, i) => setTimeout(() => this._tone(f, { type: 'triangle', a: 0.02, d: 1.2, peak: 0.18 }), i * 260));
  }

  /** 每帧:低氧心跳节拍(由 main 驱动) */
  update(dt, oxygenLow, ratio) {
    if (!this.started) return;
    if (oxygenLow) {
      this.heartPhase -= dt;
      if (this.heartPhase <= 0) {
        const urgency = 1 - ratio / 0.25; // 越低越急
        this.heartPhase = Math.max(0.45, 1.05 - urgency * 0.55);
        this.heartbeat();
      }
    } else {
      this.heartPhase = 0;
    }
  }
}

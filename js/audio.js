// Audio procédural (WebAudio) : musique folk/trad générée (accordéon, violon, podorythmie), nuit plus douce, combat plus rythmé, bruitages.
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const SCALE = [0, 2, 4, 5, 7, 9, 11];
const PROG = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14], [0, 4, 7]];
export class Audio {
  constructor() { this.ctx = null; this.mode = 'title'; this.vol = 0.7; this.mvol = 0.6; this.step = 0; this.next = 0; this.seed = 7; this.combat = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx; c.resume().catch(() => {});
    this.master = c.createGain(); this.master.gain.value = this.vol; const comp = c.createDynamicsCompressor(); this.master.connect(comp); comp.connect(c.destination);
    this.mus = c.createGain(); this.mus.gain.value = this.mvol * 0.5; this.mus.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.6; this.sfx.connect(this.master);
    const len = c.sampleRate * 2, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5); }
    this.rev = c.createConvolver(); this.rev.buffer = ir; this.revG = c.createGain(); this.revG.gain.value = 0.3; this.revG.connect(this.rev); this.rev.connect(this.mus);
    const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; this.noise = nb;
    // vent continu (planeur, tempête)
    const ws = c.createBufferSource(); ws.buffer = nb; ws.loop = true; this.windF = c.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 500; this.windF.Q.value = 0.7;
    this.windG = c.createGain(); this.windG.gain.value = 0; ws.connect(this.windF); this.windF.connect(this.windG); this.windG.connect(this.sfx); ws.start();
    this.next = c.currentTime + 0.1;
    this.timer = setInterval(() => this.tick(), 50);
  }
  setVol(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  setMusic(v) { this.mvol = v; if (this.mus) this.mus.gain.value = v * 0.5; }
  wind(v) { if (this.windG) { this.windG.gain.setTargetAtTime(Math.min(0.5, v), this.ctx.currentTime, 0.2); this.windF.frequency.setTargetAtTime(300 + v * 900, this.ctx.currentTime, 0.2); } }
  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  tick() {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    const night = this.mode === 'night', bpm = night ? 72 : this.combat > 0.5 ? 126 : 104, sp = 60 / bpm / 4;
    while (this.next < c.currentTime + 0.25) { this.play(this.step, this.next, sp, night); this.next += sp; this.step++; }
  }
  play(st, t, sp, night) {
    const bar = Math.floor(st / 16) % 8, s = st % 16, ch = PROG[bar], root = 50, cmb = this.combat > 0.5 && this.mode !== 'title';
    if (night) {
      if (s === 0) for (const n of ch) this.pad(mtof(root + n), t, sp * 16, 0.05);
      if (s % 4 === 0 || (s % 2 === 0 && this.rnd() < 0.3)) this.bell(mtof(root + 24 + ch[(this.rnd() * 3) | 0] + (this.rnd() < 0.3 ? 12 : 0)), t, 0.07);
      if (s === 0) this.bass(mtof(root - 12 + ch[0]), t, sp * 12, 0.12);
      return;
    }
    // accordéon : accords sur les temps faibles (oum-pa)
    if (s % 4 === 2) for (const n of ch) this.accord(mtof(root + 12 + n), t, sp * 1.6, this.mode === 'title' ? 0.035 : 0.045);
    if (s % 8 === 0) this.bass(mtof(root - 12 + ch[0]), t, sp * 3, 0.16); else if (s % 8 === 4) this.bass(mtof(root - 12 + ch[2] - 12 + 12), t, sp * 3, 0.12);
    // podorythmie (pieds) : grosse caisse et claquette
    if (this.mode !== 'title') { if (s % 4 === 0) this.kick(t, cmb ? 0.35 : 0.22); if (s % 4 === 2 || (cmb && s % 2 === 1 && this.rnd() < 0.4)) this.clack(t, cmb ? 0.14 : 0.08); }
    // violon : mélodie en phrases de 2 mesures, répétées
    const phrase = Math.floor(st / 32) % 4;
    if (s % 2 === 0) {
      const k = (st % 32) / 2; const h = Math.sin((k + 1) * 12.9898 + phrase * 78.233) * 43758.5453; const r = h - Math.floor(h);
      if (r < 0.78 || s % 4 === 0) {
        const strong = s % 8 === 0; let deg = strong ? [0, 2, 4][Math.floor(r * 3)] + ch[0] / 2 : Math.floor(r * 9);
        const semi = SCALE[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7) + (strong ? 0 : 0);
        this.fiddle(mtof(root + 24 + (strong ? ch[Math.floor(r * 3)] : semi)), t, sp * (strong ? 3 : 1.8), this.mode === 'title' ? 0.05 : 0.06);
      }
    }
  }
  env(g, t, a, d, v) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0008, t + a + d); }
  osc(type, f, t, dur, dest) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o; }
  accord(f, t, d, v) { const c = this.ctx, g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1700; fl.connect(g); g.connect(this.mus); g.connect(this.revG); this.env(g, t, 0.03, d, v); this.osc('square', f, t, d, fl); this.osc('sawtooth', f * 1.004, t, d, fl); }
  fiddle(f, t, d, v) { const c = this.ctx, g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1800; fl.Q.value = 0.8; fl.connect(g); g.connect(this.mus); g.connect(this.revG); this.env(g, t, 0.04, d, v);
    const o = this.osc('sawtooth', f, t, d, fl); const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = f * 0.008; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + d + 0.05); }
  bass(f, t, d, v) { const g = this.ctx.createGain(); g.connect(this.mus); this.env(g, t, 0.01, d, v); this.osc('triangle', f, t, d, g); }
  pad(f, t, d, v) { const c = this.ctx, g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 700; fl.connect(g); g.connect(this.mus); g.connect(this.revG); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + d * 0.4); g.gain.linearRampToValueAtTime(0, t + d); this.osc('sawtooth', f, t, d, fl); this.osc('sawtooth', f * 1.006, t, d, fl); }
  bell(f, t, v) { const g = this.ctx.createGain(); g.connect(this.mus); g.connect(this.revG); this.env(g, t, 0.005, 1.4, v); this.osc('sine', f, t, 1.4, g); const g2 = this.ctx.createGain(); g2.connect(this.mus); this.env(g2, t, 0.005, 0.4, v * 0.4); this.osc('sine', f * 2.76, t, 0.4, g2); }
  kick(t, v, dest) { const c = this.ctx, g = c.createGain(); g.connect(dest || this.mus); this.env(g, t, 0.003, 0.18, v); const o = this.osc('sine', 110, t, 0.2, g); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.15); }
  nz(t, d, v, type, f, dest, q = 1) { const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); s.connect(fl); fl.connect(g); g.connect(dest || this.sfx); this.env(g, t, 0.003, d, v); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05); return fl; }
  clack(t, v) { this.nz(t, 0.05, v, 'highpass', 2500, this.mus); }
  // ---------- bruitages ----------
  fx(name, v = 1) {
    const c = this.ctx; if (!c || c.state !== 'running') return; const t = c.currentTime, S = this.sfx;
    const tone = (type, f0, f1, d, vol, at = 0) => { const g = c.createGain(); g.connect(S); this.env(g, t + at, 0.005, d, vol * v); const o = this.osc(type, f0, t + at, d, g); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + at + d); };
    switch (name) {
      case 'swing': { const f = this.nz(t, 0.16, 0.25 * v, 'bandpass', 900, S, 2); f.frequency.exponentialRampToValueAtTime(2600, t + 0.15); break; }
      case 'hit': this.kick(t, 0.5 * v, S); this.nz(t, 0.08, 0.3 * v, 'lowpass', 1800); tone('square', 220, 90, 0.08, 0.08); break;
      case 'bonk': tone('triangle', 520, 260, 0.12, 0.25); tone('square', 780, 300, 0.06, 0.06); break;
      case 'hurt': tone('square', 160, 70, 0.22, 0.14); this.nz(t, 0.1, 0.2 * v, 'lowpass', 900); break;
      case 'coin': tone('square', 988, 0, 0.06, 0.07); tone('square', 1318, 0, 0.12, 0.07, 0.06); break;
      case 'jump': tone('square', 300, 520, 0.1, 0.05); break;
      case 'land': this.nz(t, 0.08, 0.15 * v, 'lowpass', 500); break;
      case 'break': this.nz(t, 0.18, 0.35 * v, 'lowpass', 1200); tone('triangle', 180, 80, 0.12, 0.12); break;
      case 'place': this.kick(t, 0.25 * v, S); this.nz(t, 0.04, 0.2 * v, 'highpass', 1800); break;
      case 'throw': tone('sine', 600, 200, 0.1, 0.12); this.nz(t, 0.08, 0.12 * v, 'bandpass', 1500); break;
      case 'splat': this.nz(t, 0.12, 0.25 * v, 'lowpass', 2400); break;
      case 'glide': { const f = this.nz(t, 0.4, 0.25 * v, 'bandpass', 400, S, 1.5); f.frequency.exponentialRampToValueAtTime(1600, t + 0.35); break; }
      case 'eat': for (let i = 0; i < 3; i++) this.nz(t + i * 0.09, 0.05, 0.2 * v, 'bandpass', 1400 + i * 300, S, 3); break;
      case 'level': [0, 4, 7, 12, 16].forEach((n, i) => tone('square', mtof(74 + n), 0, 0.18, 0.07, i * 0.08)); break;
      case 'quest': [0, 7, 12, 7, 12, 19].forEach((n, i) => tone('triangle', mtof(69 + n), 0, 0.2, 0.12, i * 0.09)); break;
      case 'accept': tone('triangle', mtof(74), 0, 0.12, 0.1); tone('triangle', mtof(81), 0, 0.2, 0.1, 0.1); break;
      case 'horn': tone('square', 233, 0, 0.35, 0.07); tone('square', 277, 0, 0.35, 0.07); break;
      case 'squeak': tone('square', 1400, 2200, 0.08, 0.05); tone('square', 1800, 1200, 0.08, 0.05, 0.09); break;
      case 'buzz': { const g = c.createGain(); g.connect(S); this.env(g, t, 0.05, 0.5, 0.05 * v); const o = this.osc('sawtooth', 210, t, 0.5, g); const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 30; lg.gain.value = 30; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 0.55); break; }
      case 'brame': tone('sawtooth', 150, 70, 0.75, 0.1 * v); tone('square', 95, 60, 0.6, 0.05 * v, 0.12); break;
      case 'paper': this.nz(t, 0.15, 0.2 * v, 'highpass', 3000); break;
      case 'chomp': tone('square', 140, 60, 0.15, 0.15); this.nz(t, 0.06, 0.25 * v, 'lowpass', 700); break;
      case 'die': tone('square', 300, 60, 0.6, 0.12); break;
      case 'roll': { const f = this.nz(t, 0.25, 0.22 * v, 'bandpass', 500, S, 1.2); f.frequency.exponentialRampToValueAtTime(1500, t + 0.22); break; }
      case 'crit': tone('square', 1200, 600, 0.1, 0.08); tone('triangle', 1800, 0, 0.15, 0.06, 0.02); break;
      case 'boom': this.kick(t, 0.9 * v, S); this.nz(t, 0.35, 0.35 * v, 'lowpass', 400); tone('sine', 70, 35, 0.4, 0.3); break;
      case 'charge': tone('square', 220, 880, 0.3, 0.06); tone('triangle', 330, 1320, 0.3, 0.05); break;
      case 'gull': tone('square', 1500, 900, 0.12, 0.05); tone('square', 1700, 1000, 0.14, 0.05, 0.14); break;
      case 'blower': this.nz(t, 0.4, 0.2 * v, 'bandpass', 300, S, 2); tone('sawtooth', 70, 90, 0.4, 0.05); break;
      case 'ui': tone('square', 660, 0, 0.04, 0.05); break;
      case 'deny': tone('square', 200, 150, 0.15, 0.08); break;
    }
  }
}

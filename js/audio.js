// Audio procédural (WebAudio) : un thème par lieu (folk du village, valse de Charlevoix, complainte gaspésienne, groove de Montréal,
// flûte du Nord, mine, égouts, nuit, combat) en fondus enchaînés ; ambiances (vent, eau, oiseaux, ville, caverne) ; bruitages ;
// bus musique / bruitages / ambiance → compresseur → volume → limiteur.
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const SCALE = [0, 2, 4, 5, 7, 9, 11];
const PROG = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14], [0, 4, 7]];
// Thèmes par lieu : chacun a sa propre piste (gain) ; on passe de l'un à l'autre en fondu enchaîné.
const THEMES = {
  title: { bpm: 104 }, village: { bpm: 104 }, nuit: { bpm: 72 },
  charlevoix: { bpm: 84 }, montmagny: { bpm: 112 }, gaspesie: { bpm: 96 }, montreal: { bpm: 108 }, boreal: { bpm: 76 },
  mine: { bpm: 66 }, egout: { bpm: 70 }, combat: { bpm: 132 },
};
const hashr = (a, b) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };
export class Audio {
  constructor() { this.ctx = null; this.mode = 'title'; this.theme = 'title'; this.vol = 0.7; this.mvol = 0.6; this.svol = 0.8; this.step = 0; this.next = 0; this.seed = 7; this.combat = 0; this.boss = 0; this.layers = {}; this.ambT = { wind: 0, water: 0, birds: 0, city: 0, cave: 0, geese: 0 }; this.fade = 2.5; }
  init(ctx) {
    if (this.ctx) { if (this.ctx.state !== 'running' && this.ctx.resume) this.ctx.resume().catch(() => {}); return; }
    if (ctx) this.ctx = ctx;
    else { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; try { this.ctx = new AC(); } catch (e) { return; } this.ctx.resume().catch(() => {}); }
    const c = this.ctx;
    // bus de mixage : musique, bruitages, ambiance → colle (compresseur doux) → volume général → limiteur → sortie
    this.master = c.createGain(); this.master.gain.value = this.vol;
    const glue = c.createDynamicsCompressor(); glue.threshold.value = -18; glue.knee.value = 12; glue.ratio.value = 2.5; glue.attack.value = 0.02; glue.release.value = 0.25;
    const lim = c.createDynamicsCompressor(); lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.08; this.limiter = lim;
    this.bus = c.createGain(); this.bus.connect(glue); glue.connect(this.master); this.master.connect(lim); lim.connect(c.destination);
    this.mus = c.createGain(); this.mus.gain.value = this.mvol * 0.5; this.mus.connect(this.bus);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.6 * this.svol; this.sfx.connect(this.bus);
    this.amb = c.createGain(); this.amb.gain.value = 0.5 * this.svol; this.amb.connect(this.bus);
    const len = c.sampleRate * 2, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5); }
    this.rev = c.createConvolver(); this.rev.buffer = ir; this.revG = c.createGain(); this.revG.gain.value = 0.3; this.revG.connect(this.rev); this.rev.connect(this.mus);
    // grande réverbération (donjons) : écho long
    const len2 = c.sampleRate * 4, ir2 = c.createBuffer(2, len2, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir2.getChannelData(ch); for (let i = 0; i < len2; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len2, 1.6); }
    this.cave = c.createConvolver(); this.cave.buffer = ir2; this.caveG = c.createGain(); this.caveG.gain.value = 0.5; this.caveG.connect(this.cave); this.cave.connect(this.bus);
    const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; this.noise = nb;
    // bruit brun (plus doux) pour l'eau et la ville
    const bb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), bd = bb.getChannelData(0); let last = 0; for (let i = 0; i < bd.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; } this.brown = bb;
    const loop = (buf, type, f, q, dest) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(dest); s.start(); return { g, fl }; };
    // vent continu (planeur, tempête)
    const w = loop(nb, 'bandpass', 500, 0.7, this.sfx); this.windF = w.fl; this.windG = w.g;
    // lits d'ambiance : vent doux, eau (vagues), ville (rumeur), caverne (souffle grave)
    this.A = { wind: loop(nb, 'bandpass', 380, 0.5, this.amb), water: loop(this.brown, 'lowpass', 600, 0.5, this.amb), city: loop(this.brown, 'lowpass', 260, 0.7, this.amb), cave: loop(this.brown, 'lowpass', 140, 0.9, this.amb) };
    this.next = c.currentTime + 0.1; this.ambNext = c.currentTime + 0.5;
    for (const k in THEMES) { const g = c.createGain(); g.gain.value = 0; g.connect(this.mus); this.layers[k] = { g, v: 0, step: 0, next: c.currentTime + 0.1 }; }
    this.layers[this.theme].v = 1; this.layers[this.theme].g.gain.value = 1;
    if (!ctx) this.timer = setInterval(() => this.tick(), 50);
  }
  setVol(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  setMusic(v) { this.mvol = v; if (this.mus) this.mus.gain.value = v * 0.5; }
  setSfx(v) { this.svol = v; if (this.sfx) { this.sfx.gain.value = 0.6 * v; this.amb.gain.value = 0.5 * v; } }
  wind(v) { if (this.windG) { this.windG.gain.setTargetAtTime(Math.min(0.5, v), this.ctx.currentTime, 0.2); this.windF.frequency.setTargetAtTime(300 + v * 900, this.ctx.currentTime, 0.2); } }
  // thème de musique voulu (fondu enchaîné de this.fade secondes)
  setTheme(name) { if (THEMES[name]) this.theme = name; }
  // ambiance voulue : { wind, water, birds, city, cave } entre 0 et 1
  setAmbience(o, at) { Object.assign(this.ambT, o); if (!this.A) return; const t = at ?? this.ctx.currentTime;
    this.A.wind.g.gain.setTargetAtTime(0.10 * this.ambT.wind, t, 1.2); this.A.water.g.gain.setTargetAtTime(0.22 * this.ambT.water, t, 1.2); this.A.city.g.gain.setTargetAtTime(0.22 * this.ambT.city, t, 1.2); this.A.cave.g.gain.setTargetAtTime(0.25 * this.ambT.cave, t, 1.2); }
  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  tick(ahead = 0.25) {
    const c = this.ctx; if (!c || (c.state !== 'running' && !this.offline)) return;
    const now = c.currentTime;
    // thème de fond : le thème voulu (nuit remplace le village) ; le combat se superpose
    let base = this.mode === 'title' ? 'title' : this.theme; if (this.mode === 'night' && (base === 'village' || base === 'charlevoix' || base === 'montmagny' || base === 'gaspesie' || base === 'boreal')) base = 'nuit';
    const cmb = this.mode === 'title' ? 0 : Math.max(this.combat, this.boss);
    for (const k in this.layers) { const L = this.layers[k], tg = k === 'combat' ? (cmb > 0.5 ? 1 : 0) : k === base ? (cmb > 0.5 ? 0.25 : 1) : 0;
      if (Math.abs(tg - L.v) > 0.001) { L.v = tg; L.g.gain.cancelScheduledValues(now); L.g.gain.setValueAtTime(L.g.gain.value, now); L.g.gain.linearRampToValueAtTime(tg, now + this.fade); L.until = now + this.fade; }
      const on = L.v > 0 || (L.until && now < L.until + 0.1);
      if (!on) { L.next = Math.max(L.next, now + 0.05); continue; }
      const sp = 60 / THEMES[k].bpm / 4;
      while (L.next < now + ahead) { this.play(k, L.step, L.next, sp); L.next += sp; L.step++; }
    }
    // ambiance ponctuelle : oiseaux, gouttes, klaxons, marteau-piqueur, vagues
    while (this.ambNext < now + ahead) { this.ambEvent(this.ambNext); this.ambNext += 0.25; }
  }
  // rendu hors ligne (démos) : tout planifier d'avance jusqu'à dur secondes
  prerender(t0, t1) { this.offline = true; for (let t = t0; t < t1; t += 0.2) this.tickAt(t); }
  tickAt(t) { const real = this.ctx; this.ctx = new Proxy(real, { get: (o, k) => k === 'currentTime' ? t : typeof o[k] === 'function' ? o[k].bind(o) : o[k] }); try { this.tick(0.3); } finally { this.ctx = real; } }
  ambEvent(t) {
    const A = this.ambT, r = Math.random();
    if (A.birds > 0.05 && r < 0.18 * A.birds) this.chirp(t, A.birds);
    if (A.cave > 0.05 && Math.random() < 0.22 * A.cave) this.drip(t, A.cave);
    if (A.city > 0.05) { if (Math.random() < 0.012 * A.city) this.carHorn(t, A.city); if (Math.random() < 0.008 * A.city) this.jackhammer(t, A.city); }
    if (A.geese > 0.05 && Math.random() < 0.22 * A.geese) this.fx('honk', 0.35 + Math.random() * 0.35);
    if (A.water > 0.05 && Math.random() < 0.05 * A.water) { const fl = this.nz(t, 2.2, 0.06 * A.water, 'lowpass', 500, this.amb); fl.frequency.setValueAtTime(300, t); fl.frequency.linearRampToValueAtTime(900, t + 1); fl.frequency.linearRampToValueAtTime(250, t + 2.2); }
  }
  chirp(t, v) { const c = this.ctx, n = 2 + ((Math.random() * 4) | 0), f0 = 2400 + Math.random() * 2400, pan = c.createStereoPanner ? c.createStereoPanner() : null; const g = c.createGain(); if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; g.connect(pan); pan.connect(this.amb); } else g.connect(this.amb);
    for (let i = 0; i < n; i++) { const tt = t + i * (0.07 + Math.random() * 0.05), gg = c.createGain(); gg.connect(g); this.env(gg, tt, 0.005, 0.06, 0.05 * v); const o = this.osc('sine', f0, tt, 0.07, gg); o.frequency.setValueAtTime(f0 * (1 + Math.random() * 0.2), tt); o.frequency.exponentialRampToValueAtTime(f0 * (0.7 + Math.random() * 0.6), tt + 0.06); } }
  drip(t, v) { const g = this.ctx.createGain(); g.connect(this.amb); g.connect(this.caveG); this.env(g, t, 0.002, 0.12, 0.08 * v); const f = 900 + Math.random() * 1400, o = this.osc('sine', f, t, 0.12, g); o.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.05); }
  carHorn(t, v) { const g = this.ctx.createGain(), fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1400; g.connect(fl); fl.connect(this.amb); const d = 0.2 + Math.random() * 0.4; this.env(g, t, 0.01, d, 0.03 * v); this.osc('square', 392 + Math.random() * 60, t, d, g); this.osc('square', 494 + Math.random() * 60, t, d, g); }
  jackhammer(t, v) { for (let i = 0; i < 14; i++) this.nz(t + i * 0.055, 0.03, 0.07 * v, 'bandpass', 1500, this.amb, 2); }
  // ---------- musique ----------
  play(th, st, t, sp) {
    const g = this.layers[th] ? this.layers[th].g : this.mus; this.out = g;
    if (th === 'title' || th === 'village') return this.folk(st, t, sp, th === 'title');
    if (th === 'nuit') return this.night(st, t, sp);
    return (th === 'combat' ? this.fight : this[th]).call(this, st, t, sp);
  }
  night(st, t, sp) {
    const bar = Math.floor(st / 16) % 8, s = st % 16, ch = PROG[bar], root = 50;
    if (s === 0) for (const n of ch) this.pad(mtof(root + n), t, sp * 16, 0.05);
    if (s % 4 === 0 || (s % 2 === 0 && this.rnd() < 0.3)) this.bell(mtof(root + 24 + ch[(this.rnd() * 3) | 0] + (this.rnd() < 0.3 ? 12 : 0)), t, 0.07);
    if (s === 0) this.bass(mtof(root - 12 + ch[0]), t, sp * 12, 0.12);
  }
  folk(st, t, sp, title) {
    const bar = Math.floor(st / 16) % 8, s = st % 16, ch = PROG[bar], root = 50;
    // accordéon : accords sur les temps faibles (oum-pa)
    if (s % 4 === 2) for (const n of ch) this.accord(mtof(root + 12 + n), t, sp * 1.6, title ? 0.035 : 0.045);
    if (s % 8 === 0) this.bass(mtof(root - 12 + ch[0]), t, sp * 3, 0.16); else if (s % 8 === 4) this.bass(mtof(root - 12 + ch[2]), t, sp * 3, 0.12);
    // podorythmie (pieds) : grosse caisse et claquette
    if (!title) { if (s % 4 === 0) this.kick(t, 0.22); if (s % 4 === 2) this.clack(t, 0.08); }
    // violon : mélodie en phrases de 2 mesures, répétées
    const phrase = Math.floor(st / 32) % 4;
    if (s % 2 === 0) { const k = (st % 32) / 2, r = hashr(k + 1, phrase);
      if (r < 0.78 || s % 4 === 0) { const strong = s % 8 === 0, deg = strong ? 0 : Math.floor(r * 9), semi = SCALE[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7);
        this.fiddle(mtof(root + 24 + (strong ? ch[Math.floor(r * 3)] : semi)), t, sp * (strong ? 3 : 1.8), title ? 0.05 : 0.06); } }
  }
  // Charlevoix : valse lente (3 temps), piano en arpèges, cordes tenues, ré majeur
  charlevoix(st, t, sp) {
    const B3 = 12, bar = Math.floor(st / B3) % 8, s = st % B3, P = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12], [0, 4, 7], [5, 9, 12], [7, 11, 14], [7, 11, 14]][bar], root = 50;
    if (s === 0) { this.bass(mtof(root - 12 + P[0]), t, sp * 10, 0.13); for (const n of P) this.pad(mtof(root + n), t, sp * 12, 0.03); }
    if (s % 2 === 0) { const k = s / 2, n = [P[0], P[1], P[2], P[1] + 12, P[2], P[1]][k]; this.piano(mtof(root + 12 + n), t, sp * 5, 0.06); }
    const ph = Math.floor(st / (B3 * 2)) % 4; if (s % 4 === 0) { const r = hashr(st % (B3 * 2), ph); if (r < 0.7) this.flute(mtof(root + 24 + [0, 2, 4, 7, 9, 12][(r * 6) | 0] + (bar % 4 === 3 ? 2 : 0)), t, sp * 4, 0.045); }
  }
  // Montmagny : reel d'accordéon (diatonique), pieds qui tapent, un peu de piano
  montmagny(st, t, sp) {
    const bar = Math.floor(st / 16) % 8, s = st % 16, P = [[0, 4, 7], [0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]][bar], root = 55;
    if (s === 0) { this.bass(mtof(root - 12 + P[0]), t, sp * 6, 0.14); for (const n of P) this.accord(mtof(root + n), t, sp * 3.5, 0.035); }
    if (s % 4 === 0) this.kick(t, s === 0 ? 0.26 : 0.14); if (s % 2 === 1) this.clack(t, 0.09);
    if (s % 2 === 0) { const r = hashr((st % 32) / 2 + 1, Math.floor(st / 32) % 4); if (r < 0.85 || s % 8 === 0) {
      const deg = [0, 2, 4, 5, 7, 9, 11, 12][(r * 8) | 0]; this.concertina(mtof(root + 12 + (s % 8 === 0 ? P[(r * 3) | 0] : deg)), t, sp * (s % 8 === 0 ? 2.8 : 1.5), 0.055); } }
    if (s === 8) this.piano(mtof(root + 24 + P[1]), t, sp * 4, 0.04);
  }
  // Gaspésie : complainte de marin en ré dorien, accordéon en bourdon, concertina, vagues dans la caisse
  gaspesie(st, t, sp) {
    const bar = Math.floor(st / 16) % 8, s = st % 16, P = [[0, 3, 7], [0, 3, 7], [5, 9, 12], [0, 3, 7], [10, 14, 17], [5, 9, 12], [7, 10, 14], [0, 3, 7]][bar], root = 50;
    if (s === 0) { this.accord(mtof(root + P[0]), t, sp * 15, 0.03); this.accord(mtof(root + 7), t, sp * 15, 0.02); this.bass(mtof(root - 12 + P[0]), t, sp * 6, 0.15); }
    if (s === 8) this.bass(mtof(root - 12 + P[2] - 12), t, sp * 6, 0.12);
    if (s % 4 === 0) this.kick(t, s === 0 ? 0.2 : 0.1); if (s % 8 === 6) this.clack(t, 0.06);
    if (s % 2 === 0) { const r = hashr((st % 32) / 2 + 3, Math.floor(st / 32) % 4); if (r < 0.7 || s % 8 === 0) { const D = [0, 2, 3, 5, 7, 9, 10, 12, 14]; this.concertina(mtof(root + 12 + (s % 8 === 0 ? P[(r * 3) | 0] : D[(r * 9) | 0])), t, sp * (s % 8 === 0 ? 3.5 : 1.8), 0.05); } }
  }
  // Montréal : groove de ville, basse qui marche, piano électrique, charleston, « clang » de chantier
  montreal(st, t, sp) {
    const bar = Math.floor(st / 16) % 4, s = st % 16, P = [[2, 5, 9, 12], [7, 11, 14, 17], [0, 4, 7, 11], [9, 12, 16, 19]][bar], root = 45;
    if (s === 0 || s === 10) for (const n of P) this.ep(mtof(root + 12 + n), t, sp * 5, 0.03);
    if (s % 4 === 0) { const w = [0, 4, 7, 5][s / 4]; this.bass(mtof(root - 12 + P[0] + w), t, sp * 3.2, 0.17); }
    if (s % 2 === 0) this.nz(t, 0.03, s % 4 === 2 ? 0.08 : 0.05, 'highpass', 7000, this.out);
    if (s === 4 || s === 12) this.nz(t, 0.12, 0.12, 'bandpass', 1800, this.out, 0.8);
    if (s === 0 || s === 7 || s === 10) this.kick(t, 0.24);
    if (s === 14 && bar === 3) this.clang(t, 0.06);
    if (s % 2 === 0 && hashr(st % 64, 9) < 0.35) this.ep(mtof(root + 24 + P[(hashr(st, 4) * 4) | 0]), t, sp * 1.5, 0.035);
  }
  // Royaume / Nord : flûte modale clairsemée, bourdon
  boreal(st, t, sp) {
    const s = st % 32, root = 52;
    if (s === 0) { this.pad(mtof(root), t, sp * 32, 0.04); this.pad(mtof(root + 7), t, sp * 32, 0.03); this.bass(mtof(root - 12), t, sp * 24, 0.1); }
    if (s % 4 === 0) { const r = hashr(st % 64, 2); if (r < 0.55) this.flute(mtof(root + 12 + [0, 2, 3, 7, 10, 12, 14][(r * 7) | 0]), t, sp * 6, 0.05); }
  }
  // Mine : bourdon grave, pouls lent, cloche dissonante, cordes qui frottent
  mine(st, t, sp) {
    const s = st % 32, root = 38;
    if (s === 0) { this.drone(mtof(root), t, sp * 32, 0.09); this.drone(mtof(root + 6), t, sp * 32, 0.03); }
    if (s % 8 === 0) this.kick(t, 0.16);
    if (s % 8 === 4 && hashr(st, 5) < 0.5) this.bell(mtof(root + 36 + [0, 1, 6, 7][(hashr(st, 6) * 4) | 0]), t, 0.04, true);
    if (s === 16) this.nz(t, 1.8, 0.05, 'bandpass', 300, this.out, 3);
  }
  // Égouts : basse en ostinato, gouttes mélodiques en écho, souffle de tuyaux
  egout(st, t, sp) {
    const s = st % 16, bar = Math.floor(st / 16) % 4, root = 40;
    if (s % 4 === 0) this.bass(mtof(root + [0, 0, 3, -2][bar] + (s === 12 ? 7 : 0)), t, sp * 2.5, 0.16);
    if (s === 0) this.drone(mtof(root + 12 + [0, 0, 3, -2][bar]), t, sp * 16, 0.04);
    if (s % 2 === 1 && hashr(st, 7) < 0.3) this.bell(mtof(root + 36 + [0, 3, 7, 10, 12][(hashr(st, 8) * 5) | 0]), t, 0.035, true);
    if (s === 8) this.nz(t, 0.6, 0.05, 'lowpass', 400, this.out);
  }
  // Combat : 132 bpm, basse en croches, caisse claire, violon en coups d'archet ; plus lourd contre un boss
  fight(st, t, sp) {
    const bar = Math.floor(st / 16) % 4, s = st % 16, P = [[0, 3, 7], [0, 3, 7], [8, 12, 15], [10, 14, 17]][bar], root = 45, B = this.boss > 0.5;
    if (s % 2 === 0) this.bass(mtof(root - 12 + P[0] + (s % 8 === 6 ? 12 : 0)), t, sp * 1.6, 0.17);
    if (s % 4 === 0) this.kick(t, B ? 0.42 : 0.34); if (s % 8 === 4) this.nz(t, 0.14, 0.2, 'bandpass', 1600, this.out, 0.7);
    if (s % 2 === 1) this.nz(t, 0.025, 0.05, 'highpass', 6000, this.out);
    if (s % 4 === 2 || (s % 2 === 0 && hashr(st % 32, 1) < 0.4)) this.fiddle(mtof(root + 24 + P[(hashr(st, 3) * 3) | 0]), t, sp * 1.2, 0.055);
    if (B && s === 0) this.drone(mtof(root - 12), t, sp * 16, 0.06);
  }
  env(g, t, a, d, v) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0008, t + a + d); }
  osc(type, f, t, dur, dest) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o; }
  accord(f, t, d, v) { const c = this.ctx, g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1700; fl.connect(g); g.connect(this.out || this.mus); g.connect(this.revG); this.env(g, t, 0.03, d, v); this.osc('square', f, t, d, fl); this.osc('sawtooth', f * 1.004, t, d, fl); }
  fiddle(f, t, d, v) { const c = this.ctx, g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1800; fl.Q.value = 0.8; fl.connect(g); g.connect(this.out || this.mus); g.connect(this.revG); this.env(g, t, 0.04, d, v);
    const o = this.osc('sawtooth', f, t, d, fl); const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = f * 0.008; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + d + 0.05); }
  bass(f, t, d, v) { const g = this.ctx.createGain(); g.connect(this.out || this.mus); this.env(g, t, 0.01, d, v); this.osc('triangle', f, t, d, g); }
  pad(f, t, d, v) { const c = this.ctx, g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 700; fl.connect(g); g.connect(this.out || this.mus); g.connect(this.revG); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + d * 0.4); g.gain.linearRampToValueAtTime(0, t + d); this.osc('sawtooth', f, t, d, fl); this.osc('sawtooth', f * 1.006, t, d, fl); }
  bell(f, t, v, cave) { const g = this.ctx.createGain(); g.connect(this.out || this.mus); g.connect(cave ? this.caveG : this.revG); this.env(g, t, 0.005, 1.4, v); this.osc('sine', f, t, 1.4, g); const g2 = this.ctx.createGain(); g2.connect(this.out || this.mus); this.env(g2, t, 0.005, 0.4, v * 0.4); this.osc('sine', f * 2.76, t, 0.4, g2); }
  kick(t, v, dest) { const c = this.ctx, g = c.createGain(); g.connect(dest || this.out || this.mus); this.env(g, t, 0.003, 0.18, v); const o = this.osc('sine', 110, t, 0.2, g); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.15); }
  nz(t, d, v, type, f, dest, q = 1) { const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); s.connect(fl); fl.connect(g); g.connect(dest || this.sfx); this.env(g, t, 0.003, d, v); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05); return fl; }
  clack(t, v) { this.nz(t, 0.05, v, 'highpass', 2500, this.out || this.mus); }
  piano(f, t, d, v) { const g = this.ctx.createGain(); g.connect(this.out); g.connect(this.revG); this.env(g, t, 0.004, d, v); this.osc('triangle', f, t, d, g); const g2 = this.ctx.createGain(); g2.connect(this.out); this.env(g2, t, 0.002, d * 0.3, v * 0.35); this.osc('sine', f * 2, t, d * 0.3, g2); }
  flute(f, t, d, v) { const c = this.ctx, g = c.createGain(); g.connect(this.out); g.connect(this.revG); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.08); g.gain.linearRampToValueAtTime(v * 0.7, t + d * 0.7); g.gain.linearRampToValueAtTime(0, t + d);
    const o = this.osc('sine', f, t, d, g), l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5; lg.gain.value = f * 0.006; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + d + 0.05); this.nz(t, 0.06, v * 0.3, 'bandpass', f * 2, g, 2); }
  concertina(f, t, d, v) { const c = this.ctx, g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 2200; fl.connect(g); g.connect(this.out); g.connect(this.revG); this.env(g, t, 0.02, d, v); this.osc('square', f, t, d, fl); this.osc('square', f * 1.007, t, d, fl); }
  ep(f, t, d, v) { const c = this.ctx, g = c.createGain(), tr = c.createGain(); tr.connect(this.out); tr.connect(this.revG); g.connect(tr); this.env(g, t, 0.005, d, v); this.osc('sine', f, t, d, g); const g2 = c.createGain(); g2.connect(tr); this.env(g2, t, 0.002, 0.25, v * 0.5); this.osc('sine', f * 3, t, 0.25, g2);
    const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 4.5; lg.gain.value = 0.3; l.connect(lg); lg.connect(tr.gain); l.start(t); l.stop(t + d + 0.05); }
  drone(f, t, d, v) { const c = this.ctx, g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 420; fl.connect(g); g.connect(this.out); g.connect(this.caveG); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + d * 0.3); g.gain.linearRampToValueAtTime(0, t + d);
    this.osc('sawtooth', f, t, d, fl); this.osc('sawtooth', f * 1.01, t, d, fl); this.osc('triangle', f / 2, t, d, fl); }
  clang(t, v) { const g = this.ctx.createGain(); g.connect(this.out); g.connect(this.revG); this.env(g, t, 0.001, 0.5, v); for (const m of [1, 2.76, 5.4]) this.osc('sine', 820 * m, t, 0.5, g); }
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
      case 'dig': this.nz(t, 0.06, 0.18 * v, 'bandpass', 700, S, 1.5); tone('triangle', 140, 90, 0.05, 0.06 * v); break;
      case 'craft': tone('square', 523, 0, 0.07, 0.07); tone('square', 659, 0, 0.07, 0.07, 0.07); tone('square', 784, 0, 0.14, 0.08, 0.14); this.nz(t, 0.05, 0.15, 'highpass', 2500); break;
      case 'place': this.kick(t, 0.25 * v, S); this.nz(t, 0.04, 0.2 * v, 'highpass', 1800); break;
      case 'throw': tone('sine', 600, 200, 0.1, 0.12); this.nz(t, 0.08, 0.12 * v, 'bandpass', 1500); break;
      case 'splat': this.nz(t, 0.12, 0.25 * v, 'lowpass', 2400); break;
      case 'glide': { const f = this.nz(t, 0.4, 0.25 * v, 'bandpass', 400, S, 1.5); f.frequency.exponentialRampToValueAtTime(1600, t + 0.35); break; }
      case 'eat': for (let i = 0; i < 3; i++) this.nz(t + i * 0.09, 0.05, 0.2 * v, 'bandpass', 1400 + i * 300, S, 3); break;
      case 'level': [0, 4, 7, 12, 16].forEach((n, i) => tone('square', mtof(74 + n), 0, 0.18, 0.07, i * 0.08)); break;
      case 'quest': [0, 7, 12, 7, 12, 19].forEach((n, i) => tone('triangle', mtof(69 + n), 0, 0.2, 0.12, i * 0.09)); break;
      case 'accept': tone('triangle', mtof(74), 0, 0.12, 0.1); tone('triangle', mtof(81), 0, 0.2, 0.1, 0.1); break;
      case 'sirene': tone('sawtooth', 131, 128, 1.6, 0.08); tone('square', 175, 170, 1.6, 0.05); break; // sirène de but
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
      case 'honk': tone('square', 420, 330, 0.16, 0.05); tone('square', 400, 310, 0.18, 0.05, 0.22); break;
      case 'miaou': tone('triangle', 700, 1100, 0.12, 0.06); tone('triangle', 1100, 600, 0.25, 0.06, 0.12); break;
      case 'thunder': this.nz(t, 1.6, 0.5 * v, 'lowpass', 220); this.kick(t, 0.6 * v, S); break;
      case 'ui': tone('square', 660, 0, 0.04, 0.05); break;
      case 'deny': tone('square', 200, 150, 0.15, 0.08); break;
    }
  }
}

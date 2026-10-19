// Démos audio rendues hors ligne (OfflineAudioContext) : avant (ea378cf) et après (thèmes, fondus, ambiances, limiteur).
// Sortie : audio-demo/*.mp3 (ignoré par git). PORT=8923 node tools/audiodemo.js
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve'); const fs = require('fs'); const { execFileSync } = require('child_process');
const PORT = +(process.env.PORT || 8923), OUT = __dirname + '/../audio-demo/';
(async () => {
  const srv = await serve(PORT); const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await browser.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForTimeout(500);
  const DEMOS = [
    ['avant-village', 'old', { combat: 0, dur: 20 }], ['avant-combat', 'old', { combat: 1, dur: 20 }], ['avant-nuit', 'old', { night: 1, dur: 20 }],
    ['apres-village', 'new', { seq: [[0, 'village', 0, { wind: 0.3, birds: 1, water: 0.3 }]], dur: 20 }],
    ['apres-charlevoix', 'new', { seq: [[0, 'charlevoix', 0, { wind: 0.5, birds: 0.8, water: 0.5 }]], dur: 24 }],
    ['apres-gaspesie', 'new', { seq: [[0, 'gaspesie', 0, { wind: 0.6, water: 1, birds: 0.2 }]], dur: 24 }],
    ['apres-montreal', 'new', { seq: [[0, 'montreal', 0, { city: 1, wind: 0.2 }]], dur: 24 }],
    ['apres-nord', 'new', { seq: [[0, 'boreal', 0, { wind: 0.7, birds: 0.5 }]], dur: 20 }],
    ['apres-mine', 'new', { seq: [[0, 'mine', 0, { cave: 1 }]], dur: 24 }],
    ['apres-egouts', 'new', { seq: [[0, 'egout', 0, { cave: 1, water: 0.5 }]], dur: 24 }],
    ['apres-combat-boss', 'new', { seq: [[0, 'mine', 0, { cave: 1 }], [3, 'mine', 1, { cave: 1 }, 1]], dur: 20 }],
    ['apres-nuit', 'new', { seq: [[0, 'village', 0, { wind: 0.2, water: 0.4 }]], night: 1, dur: 20 }],
    // fondus enchaînés : village → combat → village → autocar vers Montréal → descente aux égouts
    ['apres-fondus', 'new', { seq: [[0, 'village', 0, { wind: 0.3, birds: 1 }], [8, 'village', 1, { wind: 0.3, birds: 1 }], [16, 'village', 0, { wind: 0.3, birds: 1 }], [22, 'montreal', 0, { city: 1 }], [32, 'egout', 0, { cave: 1, water: 0.5 }]], dur: 42 }],
  ];
  const res = [];
  for (const [name, kind, o] of DEMOS) {
    const r = await p.evaluate(async ([kind, o]) => {
      const SR = 44100, ctx = new OfflineAudioContext(2, SR * o.dur, SR);
      if (kind === 'old') {
        const { Audio } = await import('/audio-demo/audio-avant.js'); const a = new Audio(); const AC = window.AudioContext; window.AudioContext = function () { return ctx; }; a.init(); window.AudioContext = AC; clearInterval(a.timer);
        a.mode = o.night ? 'night' : 'day'; a.combat = o.combat; const night = !!o.night, bpm = night ? 72 : o.combat > 0.5 ? 126 : 104, sp = 60 / bpm / 4;
        while (a.next < o.dur) { a.play(a.step, a.next, sp, night); a.next += sp; a.step++; }
      } else {
        const { Audio } = await import('/js/audio.js?' + Math.random()); const a = new Audio(); a.init(ctx); a.mode = o.night ? 'night' : 'day';
        const seq = o.seq.concat([[o.dur]]);
        for (let i = 0; i < seq.length - 1; i++) { const [t0, th, cmb, amb, boss] = seq[i]; a.setTheme(th); a.combat = cmb; a.boss = boss || 0; a.setAmbience(Object.assign({ wind: 0, water: 0, birds: 0, city: 0, cave: 0 }, amb), t0); a.prerender(t0, seq[i + 1][0]); }
      }
      const buf = await ctx.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
      let peak = 0, sq = 0; const pcm = new Int16Array(n * 2);
      for (let i = 0; i < n; i++) { const l = L[i], r = R[i]; peak = Math.max(peak, Math.abs(l), Math.abs(r)); sq += l * l + r * r; pcm[2 * i] = Math.max(-1, Math.min(1, l)) * 32767; pcm[2 * i + 1] = Math.max(-1, Math.min(1, r)) * 32767; }
      const bytes = new Uint8Array(pcm.buffer); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return { b64: btoa(bin), peak, rms: Math.sqrt(sq / (2 * n)), n };
    }, [kind, o]);
    const pcm = Buffer.from(r.b64, 'base64'), wav = Buffer.alloc(44); const sr = 44100;
    wav.write('RIFF', 0); wav.writeUInt32LE(36 + pcm.length, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(sr, 24); wav.writeUInt32LE(sr * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(pcm.length, 40);
    const wp = '/tmp/vq-' + name + '.wav'; fs.writeFileSync(wp, Buffer.concat([wav, pcm]));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wp, '-codec:a', 'libmp3lame', '-b:a', '160k', OUT + name + '.mp3']); fs.unlinkSync(wp);
    const line = { name, s: o.dur, peak: +r.peak.toFixed(3), rmsDb: +(20 * Math.log10(r.rms || 1e-9)).toFixed(1) }; res.push(line); console.log(JSON.stringify(line));
  }
  const ok = !errs.length && res.every(r => r.peak <= 1.0 && r.rmsDb > -40) && res.filter(r => r.name.startsWith('apres')).every(r => r.peak < 0.99);
  for (const e of errs) console.log('ERR', e);
  console.log(ok ? 'AUDIODEMO OK' : 'AUDIODEMO ÉCHEC'); await browser.close(); srv.close(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });

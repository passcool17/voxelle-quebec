// Mise en page du HUD (v5b) : chevauchements de boîtes et largeurs minimales, par format. Capture <préfixe>-<format>-hud.png.
// PORT=8954 node tools/hud.js <préfixe> [formats séparés par des virgules]
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8954), PFX = process.argv[2] || 'apres-v5b', SH = __dirname + '/../shots/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const ALL = { ordi: [1280, 720, 0], paysage: [844, 390, 1], '390x844': [390, 844, 1], '360x740': [360, 740, 1], '412x915': [412, 915, 1], '320x568': [320, 568, 1] };
const ONLY = (process.argv[3] || Object.keys(ALL).join(',')).split(',');
(async () => {
  const srv = await serve(PORT); const browser = await chromium.launch({ args: ARGS }); const errs = [], rep = []; let total = 0;
  for (const name of ONLY) { const [w, h, t] = ALL[name];
    const ctx = await browser.newContext(t ? { viewport: { width: w, height: h }, hasTouch: true, isMobile: true } : { viewport: { width: w, height: h } }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(name + ' pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(name + ' console: ' + m.text()); });
    const ev = (f, a) => p.evaluate(f, a), W = ms => p.waitForTimeout(ms);
    await p.goto(`http://localhost:${PORT}/`); await ev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'low', view: 3, fsAuto: false })); }); await p.reload(); await W(2500);
    await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 }); await W(1500);
    // état chargé : quête longue au suivi, hiver, au village, repère actif
    await ev(() => { const g = __game; g.S.cash = 12500; if ('tuto' in g.S) g.S.tuto = -1; for (const id in g.QUESTS) if (g.QUESTS[id].chap) g.S.q[id] = { st: 'done', n: g.QUESTS[id].n }; g.G.dirtyQ = true; g.setSeason(0);
      setInterval(() => { g.G.weatherT = 1e9; g.sky.snow = g.sky.rain = 0; g.sky.t = 0.42; }, 50); const v = g.gen.cell(-1, 0), P = g.G.P; P.x = v.x + 3; P.z = v.z + 9; P.y = g.gen.heightAt(P.x, P.z) + 1.2; g.G.camYaw = 0.3; g.G.camPitch = 0.22; g.G.camDist = 8; });
    await p.waitForFunction(() => __game.world.loadedAround(__game.G.P.x, __game.G.P.z, 1), null, { timeout: 120000 }); await W(3000);
    const measure = async (extra) => ev(extra => {
      const vis = e => e && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden', R = e => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
      const union = es => es.filter(vis).map(R).reduce((o, b) => ({ l: Math.min(o.l, b.l), r: Math.max(o.r, b.r), t: Math.min(o.t, b.t), b: Math.max(o.b, b.b) }), { l: 1e9, r: -1e9, t: 1e9, b: -1e9 });
      if (extra) { const tk = document.querySelector('#tTalk'); tk.classList.remove('hidden'); const pr = document.querySelector('#prompt'); pr.textContent = 'E  Parler à Ginette, cantine du village'; pr.classList.remove('hidden'); }
      const box = {}; const st = document.querySelector('#stats');
      box.barres = union([...st.children].filter(c => c.id !== 'tracker'));
      box.mapbox = union([...document.querySelector('#mapbox').children].filter(c => c.id !== 'tracker'));
      for (const id of ['tracker', 'hotbar', 'stick', 'prompt', 'weapon']) { const e = document.getElementById(id); if (vis(e) && e.innerHTML.trim() !== '') box[id] = R(e); }
      document.querySelectorAll('#tTop .tb').forEach(e => { if (vis(e)) box['haut:' + e.id] = R(e); });
      document.querySelectorAll('#touch > .tb').forEach(e => { if (vis(e)) box[e.id] = R(e); });
      const wp = document.getElementById('wp'); if (wp.style.display !== 'none') box.wp = union([...wp.children]);
      // cercles (boutons ronds, bâton) : chevauchement de cercles ; sinon rectangles
      const round = k => /^t(Atk|Jump|Roll|Brk|Place|Talk)$/.test(k) || k === 'stick';
      const ov = []; const ks = Object.keys(box); const VW = innerWidth, VH = innerHeight;
      for (let i = 0; i < ks.length; i++) { const a = box[ks[i]]; if (a.l < -1 || a.t < -1 || a.r > VW + 1 || a.b > VH + 1) ov.push(ks[i] + ' hors écran');
        for (let j = i + 1; j < ks.length; j++) { const b = box[ks[j]], A = ks[i], Bk = ks[j]; if (A.startsWith('haut:') && Bk.startsWith('haut:')) continue;
          let hit; if (round(A) && round(Bk)) { hit = Math.hypot((a.l + a.r - b.l - b.r) / 2, (a.t + a.b - b.t - b.b) / 2) < (a.r - a.l + b.r - b.l) / 2 - 1; }
          else hit = a.r > b.l + 1 && a.l < b.r - 1 && a.b > b.t + 1 && a.t < b.b - 1;
          if (hit) ov.push(A + '×' + Bk); } }
      const hp = document.querySelector('#hpbar').getBoundingClientRect().width, row = document.querySelector('#stats .row'), q = document.querySelector('#tracker .q');
      const lh = q ? parseFloat(getComputedStyle(q).lineHeight) || parseFloat(getComputedStyle(q).fontSize) * 1.2 : 1, words = q ? q.textContent.trim().split(/\s+/).length : 0;
      const qLines = q ? Math.round((q.clientHeight - 8) / lh) : 0;
      return { ov, hpW: Math.round(hp), statsRowLines: Math.round(row.getBoundingClientRect().height / parseFloat(getComputedStyle(row).fontSize) / 1.15), trackerW: box.tracker ? Math.round(box.tracker.r - box.tracker.l) : 0, qWords: words, qLines, wordsPerLine: qLines ? +(words / qLines).toFixed(1) : 0 };
    }, extra);
    const m1 = await measure(false); await p.screenshot({ path: SH + PFX + '-' + name + '-hud.png' });
    const m2 = t ? await measure(true) : { ov: [] }; if (t) await p.screenshot({ path: SH + PFX + '-' + name + '-hud-parle.png' });
    // repère : 8 caps
    let wpOv = 0; const wpL = []; for (let a = 0; a < 8; a++) { await ev(a => { __game.G.camYaw = a / 8 * Math.PI * 2; document.querySelector('#tTalk').classList.add('hidden'); }, a); await W(400); const m = await measure(false); const f = m.ov.filter(o => o.includes('wp')); wpOv += f.length; wpL.push(...f.map(o => a + ':' + o)); }
    const n = m1.ov.length + m2.ov.length + wpOv; total += n;
    rep.push(`${name} : ${n} chevauchement(s) [${[...m1.ov, ...m2.ov.map(o => 'parle:' + o)].join(', ')}${wpOv ? ', repère ' + wpL.join(' ') : ''}] ; barre de vie ${m1.hpW}px, ligne niveau/piasses ${m1.statsRowLines} ligne(s), suivi ${m1.trackerW}px, ${m1.qWords} mots sur ${m1.qLines} lignes (${m1.wordsPerLine}/ligne)`);
    await ctx.close();
  }
  console.log(rep.join('\n')); console.log('TOTAL chevauchements', total); console.log(errs.join('\n') || 'aucune erreur'); console.log('HUD FIN');
  await browser.close(); srv.close();
})().catch(e => { console.log('ÉCHEC', e.message); process.exit(1); });

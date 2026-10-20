// Captures comparatives v5 (défauts v4) : cabane (intérieur), HUD téléphone l'hiver (paysage + portrait), village l'hiver
// (mini-carte + toits), cabane à sucre l'hiver, village printemps / été, nom de PNJ derrière un mur.
// PORT=8952 node tools/v5shots.js <préfixe> (avant-v5 / apres-v5). Mesure aussi : chevauchements repère/boutons tactiles
// (16 caps, 3 formats de téléphone) et étiquettes de PNJ affichées alors qu'un mur les cache.
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8952), PFX = process.argv[2] || 'apres-v5', SH = __dirname + '/../shots/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const DEVS = [['ordi', { viewport: { width: 1280, height: 720 } }], ['mobile', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }],
  ['portrait', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }], ['petit', { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true }]];
(async () => {
  const srv = await serve(PORT); const browser = await chromium.launch({ args: ARGS }); const errs = [], rep = [];
  for (const [dev, opt] of DEVS.filter(([d]) => !process.env.ONLY || process.env.ONLY.split(',').includes(d))) {
    const ctx = await browser.newContext(opt); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(dev + ' pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(dev + ' console: ' + m.text()); });
    const ev = (f, a) => p.evaluate(f, a), W = ms => p.waitForTimeout(ms), shot = n => p.screenshot({ path: SH + PFX + '-' + dev + '-' + n + '.png' });
    await p.goto(`http://localhost:${PORT}/`); await ev(d => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: d === 'ordi' ? 'mid' : 'auto', view: 4, fsAuto: false })); }, dev); await p.reload(); await W(3000);
    await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 }); await W(1500);
    await ev(() => { const g = __game; g.S.cash = 500; setInterval(() => { const P = __game.G.P; if (P) { P.hp = P.hpMax || 100; } g.G.weatherT = 1e9; g.sky.snowT = g.sky.rainT = 0; g.sky.snow = g.sky.rain = 0; g.sky.t = 0.42; }, 30); if ('tuto' in g.S) g.S.tuto = -1; for (const id in g.QUESTS) if (g.QUESTS[id].chap) g.S.q[id] = { st: 'done', n: g.QUESTS[id].n }; g.G.dirtyQ = true; });
    const go = async (x, z, yaw, pitch = 0.18, dist = 6, wait = 2500, y) => {
      await ev(([x, z, yaw, pitch, dist, y]) => { const g = __game, P = g.G.P; P.x = x; P.z = z; P.y = y != null ? y : g.gen.heightAt(x, z) + 1.2; P.vx = P.vy = P.vz = 0; g.G.camYaw = yaw; g.G.camPitch = pitch; g.G.camDist = dist; }, [x, z, yaw, pitch, dist, y]);
      await p.waitForFunction(() => __game.world.loadedAround(__game.G.P.x, __game.G.P.z, 2), null, { timeout: 120000 }); await W(wait);
    };
    const season = async k => { await ev(k => __game.setSeason(k), k); await W(900); };
    const V = await ev(() => { const g = __game, v = g.gen.cell(-1, 0), c = g.gen.cell(1, 0); return { vx: v.x, vz: v.z, cx: c.x, cz: c.z }; });
    // étiquettes de PNJ visibles alors qu'un voxel cache la tête (rayon caméra → tête)
    const hidden = () => ev(() => { const g = __game, c = g.camera.position, out = [], B = g.B, LEAFS = [B.SPRUCE, B.MAPLE, B.MAPLE2, B.MAPLE3, B.BIRCH, B.SNOWLEAF, B.TUFT, B.FLOWR, B.FLOWY, B.FLOWV, B.BERRY];
      for (const [, n] of g.G.npcs) { if (!n.label || n.label.style.display === 'none') continue; const dx = n.x - c.x, dy = n.y + 1.9 - c.y, dz = n.z - c.z, L = Math.hypot(dx, dy, dz);
        let h = false; for (let t = 0.3; t < L - 0.6; t += 0.2) { const b = g.world.get(c.x + dx / L * t, c.y + dy / L * t, c.z + dz / L * t); if (b > 0 && b !== g.B.WATER && b !== g.B.GLASS && !LEAFS.includes(b)) { h = true; break; } }
        if (h) out.push(n.name); } return out; });
    if (dev === 'ordi') {
      await go(V.cx + 4, V.cz + 17, 0.25, 0.2, 7, 4000); await season(0); await shot('erabliere-hiver');
      await go(V.vx + 3, V.vz + 9, 0.3, 0.22, 8, 4000);
      for (const [k, n] of [[0, 'hiver'], [1, 'printemps'], [2, 'ete']]) { await season(k); await shot('village-' + n); }
      await season(0); await go(V.vx + 3, V.vz + 9, 0.3, 0.55, 13, 3000); await shot('village-hiver-haut'); // toits vus d'en haut + mini-carte
      await season(2);
      // nom de PNJ derrière un mur : on cherche un PNJ et un point à ~9 m d'où un mur le cache
      const spot = await ev(() => { const g = __game, P = g.G.P;
        for (const [, n] of g.G.npcs) for (let a = 0; a < 16; a++) { const ang = a / 16 * Math.PI * 2, x = n.x + Math.sin(ang) * 9, z = n.z + Math.cos(ang) * 9, y = g.gen.heightAt(x, z) + 1;
          if (Math.abs(y - n.y) > 2 || g.world.solid(x, y + 0.5, z) || g.world.solid(x, y + 1.5, z)) continue;
          const o = { x, y: y + 1.6, z }, dx = n.x - x, dy = n.y + 1.9 - o.y, dz = n.z - z, L = Math.hypot(dx, dy, dz); const h = g.world.ray(o, { x: dx / L, y: dy / L, z: dz / L }, L - 0.6);
          if (h && h.t > 1.5) { n.home = { x: n.x, z: n.z }; n.wander = 1e9; return { x, z, yaw: Math.atan2(x - n.x, z - n.z), name: n.name, nx: n.x, nz: n.z }; } }
        return null; });
      if (spot) { await go(spot.x, spot.z, spot.yaw, 0.15, 5, 2500); await ev(s => { for (const [, n] of __game.G.npcs) if (n.name === s.name) { n.x = s.nx; n.z = s.nz; n.vx = n.vz = 0; } }, spot); await W(1200); await shot('nom-mur'); rep.push(dev + ' nom-mur : ' + spot.name + ', étiquettes cachées par un mur mais affichées = ' + JSON.stringify(await hidden())); }
      else rep.push('ordi nom-mur : aucun point trouvé');
    }
    if (dev === 'ordi' || dev === 'mobile') {
      await ev(() => __game.homeSetup());
      const H = await ev(() => ({ x: __game.gen.home.cx, z: __game.gen.home.cz }));
      await go(H.x + 0.5, H.z + 1.5, 0.6, 0.35, 3.2, 3500); await W(800); await shot('cabane-int'); rep.push(dev + ' cabane : étiquettes à travers un mur = ' + JSON.stringify(await hidden()));
    }
    if (dev !== 'ordi') {
      await season(0); await go(V.vx + 3, V.vz + 9, 0.3, 0.22, 8, 3500); await shot('village-hiver');
      // repère vs boutons tactiles : 16 caps
      let bad = 0, seen = 0;
      for (let a = 0; a < 16; a++) {
        await ev(a => { __game.G.camYaw = a / 16 * Math.PI * 2; }, a); await W(500);
        const r = await ev(() => { const w = document.querySelector('#wp'); if (!w || w.style.display === 'none') return null; const R = [...w.children].map(c => c.getBoundingClientRect()).reduce((o, b) => ({ l: Math.min(o.l, b.left), r: Math.max(o.r, b.right), t: Math.min(o.t, b.top), b: Math.max(o.b, b.bottom) }), { l: 1e9, r: -1e9, t: 1e9, b: -1e9 });
          const hit = [...document.querySelectorAll('#touch .tb, #stick, #mapbox, #hotbar')].filter(e => e.offsetParent !== null).map(e => [e.id || e.className, e.getBoundingClientRect()]).filter(([, b]) => R.r > b.left && R.l < b.right && R.b > b.top && R.t < b.bottom).map(([n]) => n);
          return hit; });
        if (r) { seen++; if (r.length) { bad++; rep.push(dev + ' cap ' + a + ' : ' + r.join(',')); if (bad === 1) await shot('village-hiver-chevauche'); } }
      }
      rep.push(dev + ' repère : ' + bad + ' chevauchement(s) sur ' + seen + ' caps');
    }
    await ctx.close();
  }
  console.log(rep.join('\n')); console.log(errs.join('\n') || 'aucune erreur'); console.log('V5SHOTS OK');
  await browser.close(); srv.close();
})().catch(e => { console.log('ÉCHEC', e.message); process.exit(1); });

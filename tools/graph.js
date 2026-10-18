// Captures comparatives (mêmes scènes, même caméra) : PORT=8916 node tools/graph.js graph-avant|graph-apres [mobile]
// Monde figé (état 'fige') pendant la capture, interface masquée. Mesure FPS et triangles du terrain par scène.
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8916), PFX = process.argv[2] || 'graph-test', SH = __dirname + '/../shots/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const SCENES = [
  { n: 'ville', x: 0.5, z: -66, yaw: -0.3, pitch: 0.55, dist: 18, t: 0.42 },
  { n: 'perso', x: 3, z: -72, yaw: 0.4, pitch: 0.12, dist: 4.2, t: 0.42, face: true, gaston: [1.2, -0.7] },
  { n: 'cabane', x: 151, z: -56, yaw: 0, pitch: 0.35, dist: 14, t: 0.4 },
  { n: 'foret', x: 30, z: -260, yaw: 0, pitch: 0.45, dist: 18, t: 0.45 },
  { n: 'fleuve', x: 0, z: 'shore', yaw: 0, pitch: 0.4, dist: 9, t: 0.31 },
  { n: 'combat', x: -7, z: -200, yaw: 0.5, pitch: 0.25, dist: 6.5, t: 0.42, foes: [['cone', -1.5, -3], ['raton', 1.5, -2.5], ['bureau', 0, -5.5], ['plow', 4.5, -7]] },
  { n: 'nuit', x: 0.5, z: -66, yaw: -0.3, pitch: -0.12, dist: 10, t: 0.02 },
];
(async () => {
  const srv = await serve(PORT); const mob = process.argv[3] === 'mobile';
  const browser = await chromium.launch({ args: ARGS });
  const ctx = await browser.newContext(mob ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(`http://localhost:${PORT}/${mob ? '?touch' : ''}`);
  await p.evaluate(m => { localStorage.clear(); if (!m) localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'high', view: 6 })); }, mob); await p.reload();
  await p.waitForTimeout(3000);
  await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  const res = [];
  for (const sc of (mob ? SCENES.filter(s => ['ville', 'perso', 'combat'].includes(s.n)) : SCENES)) {
    await p.evaluate(sc => { const g = __game, G = g.G, P = G.P; G.state = 'play'; document.getElementById('hud').style.visibility = 'hidden';
      const tc = document.getElementById('touch'); if (tc) tc.style.visibility = 'hidden';
      for (const e of G.enemies) { e.hp = 0; e.dead = true; e.model.g.visible = false; e.label.style.display = 'none'; }
      G.spawnT = 1e9; G.weatherT = 1e9; g.sky.snowT = 0; g.sky.snow = 0;
      let z = sc.z; if (z === 'shore') z = g.gen.riverZ(sc.x) + g.gen.riverW(sc.x) + 5;
      P.x = sc.x; P.z = z; P.y = g.gen.heightAt(sc.x, z) + 6; P.vx = P.vy = P.vz = 0; P.hp = 1e6; window.__sc = { x: sc.x, z }; }, sc);
    await p.waitForFunction(() => __game.world.loadedAround(__sc.x, __sc.z, 2) && __game.world.loadedFrac() > 0.9, null, { timeout: 120000 }).catch(() => console.log('chargement incomplet', sc.n));
    await p.evaluate(sc => { const g = __game, G = g.G, P = G.P; P.y = g.world.ground(P.x, P.z, 120); P.vy = 0; G.camYaw = sc.yaw; G.camPitch = sc.pitch; G.camDist = sc.dist; g.sky.t = sc.t;
      P.yaw = sc.face ? sc.yaw + Math.PI : sc.yaw; G.enemies = G.enemies.filter(e => !e.dead);
      for (const f of sc.foes || []) { const e = g.spawnEnemy(f[0], P.x + f[1], P.z + f[2], { lvl: 2 }); e.state = 'idle'; } }, sc);
    await p.waitForTimeout(sc.foes ? 400 : 1200);
    await p.evaluate(sc => { const g = __game, G = g.G, P = G.P; G.camYaw = sc.yaw; G.camPitch = sc.pitch; P.yaw = sc.face ? sc.yaw + Math.PI : sc.yaw; P.vx = P.vz = 0;
      for (const e of G.enemies) { const dx = P.x - e.x, dz = P.z - e.z; e.model.g.rotation.y = Math.atan2(-dx, -dz); }
      if (sc.gaston) for (const [, q] of G.npcs) if (q.role === 'gaston') { q.x = P.x + sc.gaston[0]; q.z = P.z + sc.gaston[1]; q.model.g.position.set(q.x, g.world.ground(q.x, q.z, P.y + 3), q.z); q.model.g.rotation.y = sc.yaw + Math.PI - 0.4; }
      g.world.ray = () => null; g.sky.t = sc.t; G.state = 'fige'; for (const e of G.enemies) e.label.style.display = 'none'; document.querySelectorAll('.lb').forEach(l => l.style.visibility = 'hidden'); }, sc);
    await p.waitForTimeout(1500);
    const m = await p.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else {
      let tri = 0; __game.world.group.traverse(o => { if (o.geometry && o.geometry.index) tri += o.geometry.index.count / 3; });
      r({ fps: +(n / ((performance.now() - t0) / 1000)).toFixed(1), triTerrain: Math.round(tri), chunks: __game.world.chunks.size, view: __game.world.view }); } }; requestAnimationFrame(f); }));
    const file = SH + PFX + (mob ? '-mobile' : '') + '-' + sc.n + '.png'; await p.screenshot({ path: file });
    console.log(sc.n, JSON.stringify(m), file); res.push({ scene: sc.n, ...m });
  }
  console.log('RÉSUMÉ', JSON.stringify(res));
  console.log(errs.length ? errs.join('\n') : 'aucune erreur JS');
  await browser.close(); srv.close(); process.exit(errs.length ? 1 : 0);
})();

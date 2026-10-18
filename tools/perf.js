// Mesure FPS / triangles / appels de rendu selon la qualité, à un endroit donné : PORT=8918 node tools/perf.js [x z]
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8918), X = +(process.argv[2] ?? -7), Z = +(process.argv[3] ?? -200);
(async () => {
  const srv = await serve(PORT);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://localhost:${PORT}/`); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'high', view: 6 })); }); await p.reload(); await p.waitForTimeout(2500);
  await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  await p.evaluate(([x, z]) => { const g = __game, P = g.G.P; P.x = x; P.z = z; P.y = g.gen.heightAt(x, z) + 3; P.hp = 1e6; g.G.spawnT = 1e9; window.__sc = [x, z]; }, [X, Z]);
  for (const q of ['high', 'mid', 'low']) {
    await p.evaluate(q => { const g = __game; g.OPT.qual = q; g.applyQuality(); g.G.state = 'play'; }, q);
    await p.waitForFunction(() => __game.world.loadedFrac() > 0.95 && !__game.world.pending.size && ![...__game.world.chunks.values()].some(c => c.want != null), null, { timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => new Promise(res => { const g = __game; g.G.state = 'fige'; let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else { const i = g.renderer.info.render; res({ fps: +(n / ((performance.now() - t0) / 1000)).toFixed(1), tri: i.triangles, calls: i.calls, terrain: g.world.triangles(), lod0: [...g.world.chunks.values()].filter(c => c.lod === 0).length, chunks: g.world.chunks.size, shadows: g.renderer.shadowMap.enabled, mem: Math.round(performance.memory ? performance.memory.usedJSHeapSize / 1e6 : 0) }); } }; requestAnimationFrame(f); }));
    console.log(q, JSON.stringify(r));
  }
  console.log(errs.length ? errs.join('\n') : 'aucune erreur JS');
  await b.close(); srv.close();
})();

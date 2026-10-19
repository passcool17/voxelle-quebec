// Captures avant/après de l'amélioration générale + FPS : PORT=8917 node tools/amelio.js avant-amelio|apres-amelio [extra]
// Scènes : titre, combat, village, dialogue de quête, nuit. FPS mesuré 3 s par scène (monde figé), qualité « mid », vue 5.
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8917), PFX = process.argv[2] || 'amelio-test', SH = __dirname + '/../shots/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
(async () => {
  const srv = await serve(PORT);
  const browser = await chromium.launch({ args: ARGS });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const ev = (f, a) => p.evaluate(f, a);
  const fps = () => ev(() => { const P = __game.G.P; if (P) P.hp = __game.stats().hpMax; }).then(() => ev(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); }; requestAnimationFrame(f); })));
  await p.goto(`http://localhost:${PORT}/`);
  await ev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 5 })); }); await p.reload();
  await p.waitForTimeout(6000);
  const res = {};
  res.titre = await fps(); await p.screenshot({ path: SH + PFX + '-titre.png' });
  await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  const go = async (x, z) => { await ev(([x, z]) => { const g = __game, G = g.G, P = G.P; for (const e of G.enemies) { e.hp = 0; e.dead = true; e.model.g.visible = false; e.label.style.display = 'none'; }
      G.spawnT = 1e9; G.weatherT = 1e9; g.sky.snowT = 0; g.sky.snow = 0; P.x = x; P.z = z; P.y = g.gen.heightAt(x, z) + 4; P.vx = P.vy = P.vz = 0; P.hp = 1e6; G.godT = 1; window.__sc = [x, z]; }, [x, z]);
    await p.waitForFunction(() => __game.world.loadedAround(__sc[0], __sc[1], 2) && __game.world.loadedFrac() > 0.9, null, { timeout: 120000 }).catch(() => console.log('chargement incomplet'));
    await ev(() => { const g = __game, P = g.G.P; P.y = g.world.ground(P.x, P.z, 120); P.vy = 0; }); };
  const cam = (yaw, pitch, dist, t) => ev(([yaw, pitch, dist, t]) => { const g = __game, G = g.G; G.camYaw = yaw; G.camPitch = pitch; G.camDist = dist; g.sky.t = t; }, [yaw, pitch, dist, t]);
  // combat : quelques ennemis devant, le joueur frappe
  await go(-7, -200); await cam(0.5, 0.25, 6.5, 0.42);
  await ev(() => { const g = __game, P = g.G.P; for (const f of [['cone', -1.5, -3], ['raton', 1.5, -2.5], ['bureau', 0, -5.5], ['plow', 4.5, -7]]) { const e = g.spawnEnemy(f[0], P.x + f[1], P.z + f[2], { lvl: 2 }); e.state = 'idle'; } });
  await p.waitForTimeout(1500);
  await ev(() => { const g = __game; g.G.P.yaw = 0.5; g.input.bot = null; window.__swing = setInterval(() => { g.input.lmb = true; setTimeout(() => g.input.lmb = false, 80); }, 400); });
  res.combat = await fps(); await p.waitForTimeout(150); await p.screenshot({ path: SH + PFX + '-combat.png' });
  await ev(() => { clearInterval(window.__swing); __game.input.lmb = false; });
  // village
  const vil = await ev(() => { const c = __game.gen.cell(-1, 0); return [c.x, c.z]; });
  await go(vil[0] + 2, vil[1] + 8); await cam(0.2, 0.45, 16, 0.4); await p.waitForTimeout(2500);
  res.village = await fps(); await p.screenshot({ path: SH + PFX + '-village.png' });
  // dialogue de quête avec Gaston
  const vc = await ev(() => { const c = __game.gen.cell(0, 0); return [c.x, c.z]; });
  await go(vc[0], vc[1] + 4); await p.waitForTimeout(2500);
  const ok = await ev(() => { const G = __game.G; let n = null; for (const [, q] of G.npcs) if (q.role === 'gaston') n = q; if (!n) return false; const P = G.P; P.x = n.x - 1.6; P.z = n.z + 1.2; P.y = __game.world.ground(P.x, P.z, n.y + 3); G.camYaw = Math.atan2(P.x - n.x, P.z - n.z) + 0.5; G.camPitch = 0.2; G.camDist = 4.5; __game.openDialog(n); return true; });
  await p.waitForTimeout(1200); res.dialogue = await fps(); await p.screenshot({ path: SH + PFX + '-dialogue.png' }); if (ok) await ev(() => __game.closeDialog());
  // nuit en ville
  await go(0.5, -66); await cam(-0.3, 0.1, 10, 0.02); await p.waitForTimeout(2000);
  res.nuit = await fps(); await p.screenshot({ path: SH + PFX + '-nuit.png' });
  console.log('FPS', JSON.stringify(res));
  console.log(errs.length ? errs.join('\n') : 'aucune erreur JS');
  await browser.close(); srv.close(); process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('ÉCHEC', e); process.exit(2); });

// Test du monde vivant (phase 2) : flâneurs et activités au village, bulles de dialogue, salut, écureuils, chats,
// volée d'oies, pluie + éclair, nuit. usage : PORT=8920 node tools/monde.js [préfixe captures]
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8920), PFX = process.argv[2] || 'monde-test', SH = __dirname + '/../shots/';
(async () => {
  const srv = await serve(PORT);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [], res = {};
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const ev = (f, a) => p.evaluate(f, a), W = ms => p.waitForTimeout(ms);
  await p.goto(`http://localhost:${PORT}/`); await ev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 5 })); }); await p.reload(); await W(2000);
  await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 90000 });
  await ev(() => { window.gw = s => new Promise(r => { const t0 = __game.G.t; const f = () => __game.G.t - t0 >= s ? r() : setTimeout(f, 20); f(); }); const g = __game; g.G.spawnT = 1e9; g.G.weatherT = 1e9; g.sky.snowT = 0; g.sky.rainT = 0; g.G.P.hp = 1e5; });
  const tp = async (x, z) => { await ev(([x, z]) => { const P = __game.G.P; P.x = x; P.z = z; P.y = 90; P.vy = 0; for (const e of __game.G.enemies) { e.hp = 0; e.dead = true; e.model.g.visible = false; e.label.remove(); } }, [x, z]); await p.waitForFunction(([x, z]) => __game.world.loadedAround(x, z, 2), [x, z], { timeout: 90000 }); await ev(([x, z]) => { const P = __game.G.P; P.y = __game.world.ground(x, z, 120); P.vy = 0; }, [x, z]); await W(2500); };
  const vil = await ev(() => { const c = __game.gen.cell(-1, 0); return [c.x, c.z]; });
  await tp(vil[0] + 2, vil[1] + 10); await ev(() => gw(2));
  res.village = await ev(() => { const ns = [...__game.G.npcs.values()].filter(n => Math.hypot(n.x - __game.G.P.x, n.z - __game.G.P.z) < 30); const acts = {}; for (const n of ns) if (n.act) acts[n.act] = (acts[n.act] || 0) + 1; return { npcs: ns.length, acts }; });
  // bulles : attendre qu'au moins une bulle apparaisse (salut ou bavardage)
  res.bulle = await ev(async () => { for (let i = 0; i < 40; i++) { await gw(0.5); const n = [...__game.G.npcs.values()].find(n => n.sayEl.style.display !== 'none' && n.sayEl.textContent); if (n) return n.sayEl.textContent; } return null; });
  await ev(() => { const G = __game.G; G.camYaw = 0.2; G.camPitch = 0.35; G.camDist = 12; __game.sky.t = 0.42; let k = 0; for (const n of G.npcs.values()) if (Math.hypot(n.x - G.P.x, n.z - G.P.z) < 20 && k < 3) { __game.say(n, k++ ? 'Belle tuque!' : 'Paraît que le chantier va finir en 2090.'); } }); await W(1500);
  await p.screenshot({ path: SH + PFX + '-village.png' });
  // animaux : écureuils hors du village, chats au village
  res.chat = await ev(async () => { for (let i = 0; i < 30; i++) { await gw(0.5); if (__game.G.critters.some(c => c.kind === 'chat')) return true; } return false; });
  await tp(30, -260); await ev(() => gw(1));
  res.ecureuil = await ev(async () => { for (let i = 0; i < 40; i++) { await gw(0.5); const c = __game.G.critters.find(c => c.kind === 'ecureuil'); if (c) return true; } return false; });
  res.fuite = await ev(async () => { const G = __game.G, P = G.P, c = G.critters.find(c => c.kind === 'ecureuil'); if (!c) return null; c.x = P.x + 2; c.z = P.z; c.y = __game.world.ground(c.x, c.z, P.y + 3); await gw(1); return +Math.hypot(c.x - P.x, c.z - P.z).toFixed(1); });
  await ev(() => { const G = __game.G, P = G.P; const c = G.critters.find(c => c.kind === 'ecureuil'); if (c) { c.x = P.x + 1.2; c.z = P.z - 2.2; c.y = __game.world.ground(c.x, c.z, P.y + 3); c.pause = 30; } G.camYaw = 0.3; G.camPitch = 0.15; G.camDist = 4; });
  await W(800); await p.screenshot({ path: SH + PFX + '-ecureuil.png' });
  // oies
  res.oies = await ev(async () => { const G = __game.G; G.flockT = 0; __game.sky.t = 0.4; await gw(0.6); if (!G.flock) return false; G.flock.x = G.P.x - G.flock.dx * 25; G.flock.z = G.P.z - G.flock.dz * 25; G.flock.y = G.P.y + 14; return G.flock.birds.length; });
  await ev(() => { const G = __game.G; G.camYaw = Math.atan2(G.flock.dx, G.flock.dz); G.camPitch = -0.55; G.camDist = 5; }); await W(1500);
  await p.screenshot({ path: SH + PFX + '-oies.png' });
  // pluie + éclair
  res.pluie = await ev(async () => { const g = __game; g.sky.rainT = 1; g.sky.rain = 0.95; g.G.camPitch = 0.25; g.G.camDist = 7; await gw(1.5); return { rain: +g.sky.rain.toFixed(2), vis: g.sky.rainL.visible, clock: document.getElementById('clock').textContent }; });
  await ev(() => { __game.sky.flash = 0.6; }); await W(300); await p.screenshot({ path: SH + PFX + '-pluie.png' });
  await ev(() => { const g = __game; g.sky.rainT = 0; g.sky.rain = 0; });
  // nuit au village
  await tp(vil[0] + 2, vil[1] + 10); await ev(() => { const G = __game.G; __game.sky.t = 0.97; G.camYaw = 0.2; G.camPitch = 0.3; G.camDist = 12; }); await W(2500);
  await p.screenshot({ path: SH + PFX + '-nuit.png' });
  console.log(JSON.stringify(res, null, 1));
  const ok = res.village.npcs >= 7 && Object.keys(res.village.acts).length >= 2 && res.bulle && res.chat && res.ecureuil && res.fuite > 3 && res.oies >= 9 && res.pluie.vis;
  console.log(ok ? 'MONDE OK' : 'MONDE ÉCHEC'); console.log(errs.length ? errs.slice(0, 20).join('\n') : 'aucune erreur JS');
  await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
})().catch(e => { console.error('ÉCHEC', e); process.exit(2); });

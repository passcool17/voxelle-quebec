// Captures comparatives v3 (premiers pas, suivi, tactile, donjon) : ordi 1280×720 et téléphone 844×390 tactile.
// PORT=8941 node tools/v3shots.js <préfixe> (ex. avant-v3 / apres-v3)
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8941), PFX = process.argv[2] || 'apres-v3', SH = __dirname + '/../shots/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
(async () => {
  const srv = await serve(PORT); const browser = await chromium.launch({ args: ARGS }); const errs = [];
  for (const dev of ['ordi', 'mobile']) {
    const ctx = await browser.newContext(dev === 'ordi' ? { viewport: { width: 1280, height: 720 } } : { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(dev + ' pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(dev + ' console: ' + m.text()); });
    const ev = (f, a) => p.evaluate(f, a), W = ms => p.waitForTimeout(ms), shot = n => p.screenshot({ path: SH + PFX + '-' + dev + '-' + n + '.png' });
    const arrive = async () => { await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 }); await p.waitForFunction(() => __game.world.loadedAround(__game.G.P.x, __game.G.P.z, 1), null, { timeout: 120000 }); await W(1500); };
    await p.goto(`http://localhost:${PORT}/`); await ev(d => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: d === 'ordi' ? 'mid' : 'auto', view: 4, fsAuto: false })); }, dev); await p.reload(); await W(3000);
    // 1) premier lancement, juste après l'arrivée en jeu
    await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 }); await W(1200);
    await shot('premier');
    await ev(() => { const g = __game; g.S.cash = 500; setInterval(() => { const P = __game.G.P; if (P) P.hp = P.hpMax || 100; }, 50); g.G.weatherT = 1e9; g.sky.t = 0.4; if ('tuto' in g.S) g.S.tuto = -1; });
    // 2) chapitre 2 en cours : suivi d'objectif
    await ev(() => { const g = __game, S = g.S; S.q = { cones: { st: 'done', n: 6 }, permis: { st: 'active', n: 0 } }; g.G.dirtyQ = true; g.G.camYaw = Math.PI; });
    await W(2500); await shot('ch2');
    // 3) combat : trois cônes devant
    await ev(() => { const g = __game, P = g.G.P; for (let k = 0; k < 3; k++) g.spawnEnemy('cone', P.x - 2 + k * 2, P.z - 5 - k); g.G.camYaw = 0; });
    await W(2500); await shot('combat');
    await ev(() => { const g = __game; for (const e of [...g.G.enemies]) g.damageEnemy(e, 1e9, 0, 1, 0); });
    // 4) après le récit : tous les chapitres faits
    await ev(() => { const g = __game, S = g.S; for (const [id, q] of Object.entries(g.QUESTS)) if (q.chap) S.q[id] = { st: 'done', n: q.n }; g.G.dirtyQ = true; });
    await W(2000); await shot('fin');
    // 5) donjon : mine de Charlevoix, deuxième salle
    await ev(() => __game.travel('charlevoix')); await arrive();
    await ev(() => { const g = __game, s = g.gen.reg.places.mine, pl = g.dunPlan(s), P = g.G.P; P.x = pl.ent.x + 0.5; P.z = pl.ent.z + 0.5; P.y = s.fy + 0.05; P.vx = P.vy = P.vz = 0; g.G.camDist = 4.5; }); await W(2500);
    await ev(() => { const g = __game, s = g.gen.reg.places.mine, pl = g.dunPlan(s), P = g.G.P, l = pl.links.find(l => !l[0] && !l[1]), r = pl.rooms.find(m => m.i === l[2] && m.j === l[3]); P.x = r.x + 0.5; P.z = r.z + 0.5; P.y = s.fy + 0.05; for (const e of g.G.enemies) e.hp = Math.min(e.hp, 1); }); await W(2500);
    await shot('donjon');
    await ctx.close();
  }
  console.log(errs.join('\n') || 'aucune erreur'); console.log('V3SHOTS OK');
  await browser.close(); srv.close();
})().catch(e => { console.log('ÉCHEC', e.message); process.exit(1); });

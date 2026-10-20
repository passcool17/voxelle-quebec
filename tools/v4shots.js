// Captures comparatives v4 (saisons, fleuve gelé, patinoire, cabane, coffre) : ordi 1280×720 et téléphone 844×390 tactile.
// PORT=8951 node tools/v4shots.js <préfixe> (ex. avant-v4 / apres-v4). Même cadrage avant/après : positions calculées
// depuis le village de Ginette (cell(-1,0)) et la cabane à sucre (cell(1,0)); setSeason / meubles seulement s'ils existent.
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8951), PFX = process.argv[2] || 'apres-v4', SH = __dirname + '/../shots/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const SAISONS = ['hiver', 'printemps', 'ete', 'automne'];
(async () => {
  const srv = await serve(PORT); const browser = await chromium.launch({ args: ARGS }); const errs = [];
  for (const dev of ['ordi', 'mobile']) {
    const ctx = await browser.newContext(dev === 'ordi' ? { viewport: { width: 1280, height: 720 } } : { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(dev + ' pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(dev + ' console: ' + m.text()); });
    const ev = (f, a) => p.evaluate(f, a), W = ms => p.waitForTimeout(ms), shot = n => p.screenshot({ path: SH + PFX + '-' + dev + '-' + n + '.png' });
    await p.goto(`http://localhost:${PORT}/`); await ev(d => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: d === 'ordi' ? 'mid' : 'auto', view: 4, fsAuto: false })); }, dev); await p.reload(); await W(3000);
    await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 }); await W(1500);
    if (dev === 'mobile') await shot('accueil'); // bannière d'accueil vs barre de blocs
    await ev(() => { const g = __game; g.S.cash = 500; setInterval(() => { const P = __game.G.P; if (P) { P.hp = P.hpMax || 100; } g.G.weatherT = 1e9; g.sky.snowT = g.sky.rainT = 0; g.sky.snow = g.sky.rain = 0; g.sky.t = 0.42; }, 30); if ('tuto' in g.S) g.S.tuto = -1; for (const id in g.QUESTS) if (g.QUESTS[id].chap) g.S.q[id] = { st: 'done', n: g.QUESTS[id].n }; g.G.dirtyQ = true; });
    // place le joueur (mètres), regarde dans la direction yaw (0 = nord), attend le chargement
    const go = async (x, z, yaw, pitch = 0.18, dist = 6, wait = 2500) => {
      await ev(([x, z, yaw, pitch, dist]) => { const g = __game, P = g.G.P; P.x = x; P.z = z; P.y = g.gen.heightAt(x, z) + 1.2; P.vx = P.vy = P.vz = 0; g.G.camYaw = yaw; g.G.camPitch = pitch; g.G.camDist = dist; }, [x, z, yaw, pitch, dist]);
      await p.waitForFunction(() => __game.world.loadedAround(__game.G.P.x, __game.G.P.z, 2), null, { timeout: 120000 }); await W(wait);
    };
    const season = async k => { await ev(k => { const g = __game; if (g.setSeason) g.setSeason(k); }, k); await W(600); };
    const V = await ev(() => { const g = __game, v = g.gen.cell(-1, 0), c = g.gen.cell(1, 0); return { vx: v.x, vz: v.z, cx: c.x, cz: c.z, rz: g.gen.riverZ(v.x), rw: g.gen.riverW(v.x) }; });
    if (dev === 'ordi') {
      // 1) les 4 saisons, même endroit : la cabane à sucre dans l'érablière, puis la place du village
      await go(V.cx + 4, V.cz + 17, 0.25, 0.2, 7, 4000);
      for (let k = 0; k < 4; k++) { await season(k); await W(900); await shot('erabliere-' + SAISONS[k]); }
      await go(V.vx + 3, V.vz + 9, 0.3, 0.22, 8, 4000);
      for (let k = 0; k < 4; k++) { await season(k); await W(900); await shot('village-' + SAISONS[k]); }
      // 2) hiver : patinoire au sud du village, puis debout sur le fleuve
      await season(0);
      await go(V.vx - 2, V.vz + 19, Math.PI, 0.32, 8, 3000); await shot('patinoire');
      await go(V.vx + 6, V.rz - V.rw * 0.4, Math.PI * 0.85, 0.2, 7, 3000); await shot('fleuve');
      await season(2);
    }
    // 3) la cabane meublée (terrain à l'est du village), intérieur
    await ev(() => { const g = __game; if (g.homeSetup) g.homeSetup(); });
    const H = await ev(() => { const g = __game, v = g.gen.cell(-1, 0); return g.gen.home ? { x: g.gen.home.cx, z: g.gen.home.cz } : { x: v.x + 32, z: v.z + 1 }; });
    await go(H.x + 0.5, H.z + 1.5, 0.6, 0.35, 3.2, 3500); await shot('cabane-int');
    await ev(() => { const g = __game; if (g.openCoffre) g.openCoffre(); else g.openPanel('inv'); }); await W(900); await shot('coffre');
    await ev(() => { const g = __game; g.closePanels ? g.closePanels() : document.querySelectorAll('[data-close]').forEach(b => b.offsetParent && b.click()); });
    if (dev === 'mobile') { await season(0); await go(V.vx + 3, V.vz + 9, 0.3, 0.22, 8, 3500); await shot('village-hiver'); }
    await ctx.close();
  }
  console.log(errs.join('\n') || 'aucune erreur'); console.log('V4SHOTS OK');
  await browser.close(); srv.close();
})().catch(e => { console.log('ÉCHEC', e.message); process.exit(1); });

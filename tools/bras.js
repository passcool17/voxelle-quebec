// Captures des bras / armes / zombies (vue de côté et de trois-quarts), monde figé.
// PORT=8917 node tools/bras.js <préfixe> [gars|fille]   → shots/<préfixe>-*.png
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8917), PFX = process.argv[2] || 'bras-test', PERSO = process.argv[3] || 'gars', SH = __dirname + '/../shots/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
// cam : yaw de la caméra relatif à la direction où regarde le joueur (0 = derrière lui, PI = devant)
const SHOTS = [
  { n: 'cote-repos', cam: Math.PI / 2, pitch: 0.12, dist: 4.6, atk: 0, foe: false, mid: false },
  { n: 'cote-coup', cam: Math.PI / 2, pitch: 0.15, dist: 6.2, atk: 0.35, foe: true, mid: true },
  { n: 'face34-coup', cam: Math.PI * 0.72, pitch: 0.2, dist: 5.0, atk: 0.3, foe: false, mid: false },
  { n: 'zombie34', cam: Math.PI * 0.2, pitch: 0.18, dist: 6.5, atk: 0, foe: true, mid: true },
];
(async () => {
  const srv = await serve(PORT);
  const browser = await chromium.launch({ args: ARGS });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(`http://localhost:${PORT}/`);
  await p.evaluate(perso => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 4 })); localStorage.setItem('voxelle-quebec-perso', perso); }, PERSO); await p.reload();
  await p.waitForTimeout(3000);
  await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  await p.evaluate(() => { const g = __game, G = g.G, P = G.P; document.getElementById('hud').style.visibility = 'hidden';
    for (const e of G.enemies) { e.hp = 0; e.dead = true; e.model.g.visible = false; e.label.style.display = 'none'; }
    G.spawnT = 1e9; G.weatherT = 1e9; g.sky.snowT = 0; g.sky.snow = 0; P.hp = 1e6;
    P.x = -7; P.z = -200; P.y = g.gen.heightAt(P.x, P.z) + 6; P.vx = P.vy = P.vz = 0; });
  await p.waitForFunction(() => __game.world.loadedAround(-7, -200, 2) && __game.world.loadedFrac() > 0.9, null, { timeout: 120000 }).catch(() => console.log('chargement incomplet'));
  for (const sc of SHOTS) {
    await p.evaluate(async sc => { const g = __game, G = g.G, P = G.P, mod = await import('/js/models.js');
      G.state = 'fige'; g.world.ray = () => null; g.sky.t = 0.42;
      const X = -7, Z = -200, Y = g.world.ground(X, Z, 120); P.y = Y; P.yaw = 0;
      const m = P.model; m.g.visible = true; m.g.position.set(X, Y, Z); m.g.rotation.y = 0;
      mod.animHuman(m, 0, 0, sc.atk, false, false);
      G.enemies.forEach(e => { e.model.g.visible = false; e.label.style.display = 'none'; });
      if (sc.foe) { let e = G.enemies.find(e => e.type === 'bureau' && !e.dead); if (!e) e = g.spawnEnemy('bureau', X, Z - 2.6, { lvl: 2 });
        e.state = 'idle'; e.model.g.visible = true; const ey = g.world.ground(X, Z - 2.6, Y + 3); e.model.g.position.set(X, ey, Z - 2.6); e.model.g.rotation.y = Math.PI; // il regarde le joueur (+z)
        mod.animHuman(e.model.m, 0.12, 0.7, 0, false, false); e.label.style.display = 'none'; }
      // la cible de la caméra (P.x/P.z) peut bouger sans déplacer le modèle, figé
      P.x = X; P.z = sc.mid ? Z - 1.3 : Z; G.camYaw = sc.cam; G.camPitch = sc.pitch; G.camDist = sc.dist;
      document.querySelectorAll('.lb').forEach(l => l.style.visibility = 'hidden'); }, sc);
    await p.waitForTimeout(1500);
    const file = SH + PFX + '-' + sc.n + '.png'; await p.screenshot({ path: file }); console.log(file);
  }
  console.log(errs.length ? errs.join('\n') : 'aucune erreur JS');
  await browser.close(); srv.close(); process.exit(errs.length ? 1 : 0);
})();

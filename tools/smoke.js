// Test rapide : charge le titre, lance une partie, capture, et liste les erreurs JS.
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
(async () => {
  const PORT = +(process.env.PORT || 8790); const srv = await serve(PORT);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(`http://localhost:${PORT}/?seedtest`); await p.waitForTimeout(6000);
  await p.screenshot({ path: 'shots/smoke_title.png' });
  await p.evaluate(() => localStorage.clear());
  await p.click('#bNew'); await p.click('#bPersoGo'); 
  await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 60000 });
  await p.waitForTimeout(4000);
  await p.screenshot({ path: 'shots/smoke_play.png' });
  console.log(await p.evaluate(() => ({ chunks: __game.world.chunks.size, fps: __game.G.fps, P: [__game.G.P.x, __game.G.P.y, __game.G.P.z].map(Math.round), npcs: __game.G.npcs.size, en: __game.G.enemies.length })));
  console.log(errs.join('\n') || 'aucune erreur');
  await b.close(); srv.close();
})();

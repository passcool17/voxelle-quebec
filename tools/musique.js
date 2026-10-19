// Test « Musique et sons » : thème par lieu (village, Charlevoix, Montréal, égouts), fondu enchaîné, combat,
// ambiances (oiseaux, ville, caverne), curseurs musique/bruitages, limiteur, tactile.
// PORT=8924 node tools/musique.js
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8924);
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
(async () => {
  const srv = await serve(PORT); const browser = await chromium.launch({ args: ARGS });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [], res = {};
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const ev = (f, a) => p.evaluate(f, a); const W = ms => p.waitForTimeout(ms);
  await p.goto(`http://localhost:${PORT}/`); await ev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 4 })); }); await p.reload();
  await W(3000);
  await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  await ev(() => { const g = __game; g.G.P.hp = 1e6; g.G.weatherT = 1e9; g.sky.t = 0.4; g.G.spawnT = 1e9; for (const e of g.G.enemies) e.hp = 0; });
  const arrive = async () => { await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 }); await p.waitForFunction(() => __game.world.loadedAround(__game.G.P.x, __game.G.P.z, 1), null, { timeout: 120000 }); await W(1500); };
  const snap = () => ev(() => { const a = __game.audio, L = a.layers; const on = Object.keys(L).filter(k => L[k].v > 0.5); return { ctx: a.ctx && a.ctx.state, theme: __game.G.theme, layersOn: on, amb: Object.fromEntries(Object.entries(a.ambT).map(([k, v]) => [k, +v.toFixed(2)])) }; });
  await W(1500); res.village = await snap();
  res.bus = await ev(() => { const a = __game.audio; return { limiteur: a.limiter.ratio.value, seuil: a.limiter.threshold.value, mus: +a.mus.gain.value.toFixed(3), sfx: +a.sfx.gain.value.toFixed(3) }; });
  // curseurs
  res.curseurs = await ev(() => { const a = __game.audio, s = document.getElementById('oSfx'), m = document.getElementById('oMus'); s.value = 0.25; s.oninput(); m.value = 0.2; m.oninput(); const o = { sfx: +a.sfx.gain.value.toFixed(3), amb: +a.amb.gain.value.toFixed(3), mus: +a.mus.gain.value.toFixed(3), opts: JSON.parse(localStorage.getItem('voxelle-quebec-opts')).sfx }; s.value = 0.8; s.oninput(); m.value = 0.6; m.oninput(); return o; });
  // combat : un raton qui poursuit
  await ev(() => { const g = __game, P = g.G.P, e = g.spawnEnemy('raton', P.x + 5, P.z + 5, { lvl: 1 }); e.state = 'chase'; e.hp = 1e6; window.__foe = e; });
  await W(4500); res.combat = await snap(); res.combatGain = await ev(() => +__game.audio.combat.toFixed(2));
  await ev(() => { const g = __game; g.damageEnemy(__foe, 1e9, 0, 1, 0); }); await W(6000); res.apresCombat = await snap();
  // fondu : le gain du village monte pendant que celui du combat descend
  // Charlevoix
  await ev(() => __game.travel('charlevoix')); await arrive(); await W(1000); res.charlevoix = await snap();
  res.fondu = await ev(async () => { const L = __game.audio.layers, a = __game.audio; a.setTheme('gaspesie'); let mid = null; for (let k = 0; k < 80 && !mid; k++) { await new Promise(r => setTimeout(r, 100)); const c = L.charlevoix.g.gain.value, g = L.gaspesie.g.gain.value; if (c > 0.1 && c < 0.95 && g > 0.05 && g < 0.9) mid = { charlevoix: +c.toFixed(2), gaspesie: +g.toFixed(2), cible: L.gaspesie.v }; } mid = mid || { charlevoix: 1, gaspesie: 0 }; a.setTheme('charlevoix'); return mid; });
  // Montréal et égouts
  await ev(() => __game.travel('montreal')); await arrive(); await W(1000); res.montreal = await snap();
  await ev(() => { const s = __game.gen.reg.places.egout, P = __game.G.P; P.x = s.x + 0.5; P.z = s.z + 3.2; P.y = __game.gen.heightAt(P.x, P.z) + 2; }); await arrive();
  await p.keyboard.press('KeyE'); await W(2500); res.egout = await snap();
  console.log(JSON.stringify(res, null, 1));
  // tactile
  const m = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }); const merr = [];
  m.on('pageerror', e => merr.push(e.message));
  await m.goto(`http://localhost:${PORT}/`); await m.evaluate(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'low', view: 3 })); }); await m.reload(); await m.waitForTimeout(3000);
  await m.tap('#bNew'); await m.tap('#bPersoGo'); await m.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 }); await m.waitForTimeout(2500);
  const mob = await m.evaluate(() => ({ ctx: __game.audio.ctx && __game.audio.ctx.state, theme: __game.G.theme }));
  console.log('mobile', JSON.stringify(mob), 'erreurs', merr.length);
  const has = (s, k) => s.layersOn.includes(k);
  const ok = res.village.theme === 'village' && has(res.village, 'village') && res.village.amb.birds > 0 && res.bus.limiteur >= 20 && res.curseurs.sfx < 0.2 && res.curseurs.mus === 0.1 && res.curseurs.opts === 0.25
    && has(res.combat, 'combat') && !has(res.apresCombat, 'combat') && res.charlevoix.theme === 'charlevoix' && has(res.charlevoix, 'charlevoix') && res.fondu.charlevoix > 0.1 && res.fondu.charlevoix < 0.95 && res.fondu.gaspesie > 0.05
    && res.montreal.theme === 'montreal' && res.montreal.amb.city === 1 && res.egout.theme === 'egout' && res.egout.amb.cave === 1 && mob.theme === 'village' && !errs.length && !merr.length;
  for (const e of errs.concat(merr)) console.log('ERR', e);
  console.log(ok ? 'MUSIQUE OK' : 'MUSIQUE ÉCHEC'); await browser.close(); srv.close(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });

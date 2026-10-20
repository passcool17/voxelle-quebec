// Bot de test Playwright : apparaît, parle à Gaston, accepte la quête, explore jusqu'au chantier, combat les cônes-golems,
// rend la quête, monte de niveau, casse/pose des blocs, monte sur les remparts et plane, sauvegarde, recharge, vérifie l'état.
// Captures dans shots/. usage : PORT=8913 node tools/bot.js
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8913), SH = __dirname + '/../shots/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
const brain = require('./brain');
(async () => {
  const srv = await serve(PORT); const t0 = Date.now();
  const browser = await chromium.launch({ args: ARGS });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const snap = async n => { await p.screenshot({ path: SH + n + '.png' }); console.log('capture', SH + n + '.png'); };
  const ev = (f, a) => p.evaluate(f, a);
  const state = () => ev(() => { const g = __game, P = g.G.P, S = g.S; return { st: g.G.state, x: +P.x.toFixed(1), y: +P.y.toFixed(1), z: +P.z.toFixed(1), hp: Math.round(P.hp), lvl: S.lvl, xp: S.xp, cash: S.cash, q: JSON.stringify(S.q), en: g.G.enemies.length, kills: S.stats.kills, fps: g.G.fps, unstuck: window.__botInfo ? window.__botInfo.unstuck : 0, view: g.world.view }; });
  const run = async (task, maxS, label) => { await ev(t => { window.__task = t; }, task); const end = Date.now() + maxS * 1000; let k = 0;
    while (Date.now() < end) { await p.waitForTimeout(500); const done = await ev(() => window.__task.done || (window.__task.until && eval(window.__task.until))); if (done) break; if (++k % 10 === 0) console.log(label, JSON.stringify(await state())); }
    const s = await state(); console.log(label, 'fin', JSON.stringify(s)); return s; };
  await p.goto(`http://localhost:${PORT}/`); await ev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 5 })); }); await p.reload();
  await p.waitForTimeout(7000); await snap('title');
  await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 90000 });
  await ev(brain); await p.waitForTimeout(1500);
  const W = await ev(() => { const g = __game.gen; const c = n => { const s = g.cell(...n); return [s.x, s.z, s.h]; }; return { ville: c([0, 0]), chantier: c([0, -1]), VR: g.VR }; });
  console.log('monde', JSON.stringify(W));
  const [vx, vz, vh] = W.ville, R = 34;
  // 1. parler à Gaston
  const gaston = await ev(() => { for (const [, n] of __game.G.npcs) if (n.role === 'gaston') return [n.x, n.z]; return null; });
  console.log('gaston', gaston);
  await run({ type: 'goto', pts: [[gaston[0], gaston[1] + 1.2, 1.2]], fight: false }, 30, 'versGaston');
  await p.waitForTimeout(300); await ev(() => __game.pressed.add('KeyE')); await p.waitForTimeout(600);
  await snap('dialog_quete');
  await p.click('#dbtns .btn.big'); await p.waitForTimeout(400);
  // 2. explorer jusqu'au chantier par la porte Nord
  const [cx, cz] = W.chantier;
  await run({ type: 'goto', pts: [[vx, vz - 20], [vx, vz - R - 6], [vx, vz - R - 14]], fight: true }, 60, 'porteNord');
  await ev(() => { __game.G.camPitch = 0.05; }); await ev(() => { window.__task = { type: 'idle' }; }); await p.waitForTimeout(1500);
  await snap('paysage_jour');
  await run({ type: 'goto', pts: [[(vx + cx) / 2, (vz - R + cz) / 2], [cx, cz + 14]], fight: true }, 150, 'versChantier');
  // 3. combat au chantier jusqu'à l'objectif
  let shotCombat = false;
  await ev(() => { window.__task = { type: 'fight', pts: [], until: "__game.S.q.cones && __game.S.q.cones.st === 'ready'" }; });
  for (let i = 0; i < 360; i++) { await p.waitForTimeout(500); const s = await state(); if (i % 12 === 0) console.log('combat', JSON.stringify(s));
    if (!shotCombat && await ev(() => __game.G.enemies.some(e => e.state === 'chase' && Math.hypot(e.x - __game.G.P.x, e.z - __game.G.P.z) < 4))) { await p.waitForTimeout(250); await snap('combat'); shotCombat = true; }
    if (JSON.parse(s.q).cones && JSON.parse(s.q).cones.st === 'ready') break;
    if (s.st === 'dead') { console.log('mort, réapparition'); await p.click('#bRespawn'); await run({ type: 'goto', pts: [[vx, vz - R - 6], [cx, cz + 14]], fight: true }, 150, 'retourChantier'); await ev(() => { window.__task = { type: 'fight', pts: [] }; }); }
    if (await ev(() => !__game.G.enemies.some(e => e.camp))) await ev(([a, b]) => { window.__task = { type: 'fight', pts: [[a, b, 2]] }; }, [cx, cz]);
  }
  // 4. revenir voir Gaston
  await run({ type: 'goto', pts: [[vx, vz - R - 8], [vx, vz - R + 4], [gaston[0], gaston[1] + 1.2, 1.2]], fight: true }, 180, 'retourGaston');
  await ev(() => { window.__task = { type: 'idle' }; }); await p.waitForTimeout(400);
  await ev(() => __game.pressed.add('KeyE')); await p.waitForTimeout(600); await snap('dialog_recompense');
  await ev(() => __game.closeDialog()); await p.waitForTimeout(300);
  // 5. casser / poser un bloc
  const bp = await ev(async () => { const g = __game, G = g.G, P = G.P; G.camPitch = 0.75; await new Promise(r => setTimeout(r, 400)); const t = G.target; if (!t) return { err: 'pas de cible' };
    const before = g.world.get(t.x, t.y, t.z), cnt0 = JSON.stringify(g.S.blocks); g.pressed.add('KeyF'); for (let k = 0; k < 40 && g.world.get(t.x, t.y, t.z) === before; k++) await new Promise(r => setTimeout(r, 100)); // minage : prend la dureté du bloc
    const after = g.world.get(t.x, t.y, t.z); await new Promise(r => setTimeout(r, 400)); const t2 = G.target;
    const st0 = g.S.stats.placed; g.input.rmbP = true; for (let k = 0; k < 30 && g.input.rmbP; k++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 150)); // attend que la boucle de jeu ait traité le clic (machine lente)
    const diag = { consumed: !g.input.rmbP, placedStat: g.S.stats.placed - st0, P: [P.x, P.y, P.z].map(v => +v.toFixed(2)), t2: t2 && [t2.x, t2.y, t2.z, t2.n], enemies: G.enemies.length, hot: g.S.hot };
    const placed = t2 ? g.world.get(t2.x + t2.n[0], t2.y + t2.n[1], t2.z + t2.n[2]) : -9;
    return { broke: [t.x, t.y, t.z, before, after], placed: t2 ? [t2.x + t2.n[0], t2.y + t2.n[1], t2.z + t2.n[2], placed] : null, cnt0, cnt1: JSON.stringify(g.S.blocks), stats: g.S.stats, diag }; });
  console.log('blocs', JSON.stringify(bp));
  await ev(() => { __game.G.camPitch = 0.3; });
  // 6. sac à dos (équiper le lance-balles)
  await ev(() => __game.pressed.add('KeyI')); await p.waitForTimeout(500);
  const cell = await p.$('#invbody .cell'); if (cell) { await cell.click(); await p.waitForTimeout(200); }
  await snap('inventaire'); await ev(() => __game.pressed.add('KeyI')); await p.waitForTimeout(300);
  // 7. monter sur les remparts par l'escalier, sauter, planer
  const x0 = vx - R, z1 = vz + R;
  await run({ type: 'goto', pts: [[vx, vz + 8], [vx, z1 - 5.5], [x0 + 5.5, z1 - 5.5, 0.8], [x0 + 5.5, z1 - 2, 0.5], [x0 + 11.5, z1 - 2, 0.5], [x0 + 11.5, z1 - 0.5, 0.4]], fight: false, walk: true }, 70, 'remparts');
  const topY = (await state()).y; console.log('hauteur sur les remparts', topY, 'sol', vh);
  await ev(() => { window.__task = { type: 'goto', pts: [[__game.G.P.x, __game.G.P.z + 60]], fight: false, walk: true }; });
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(150); const s = await ev(() => ({ g: __game.G.P.ground, vy: __game.G.P.vy, gl: __game.G.P.gliding, y: __game.G.P.y })); if (!s.g && s.vy < 0) { await ev(() => { __game.input.bot.jumpP = true; __game.pressed.add('Space'); }); break; } }
  await p.waitForTimeout(1200); await snap('planeur');
  for (let i = 0; i < 120; i++) { await p.waitForTimeout(250); if (await ev(() => __game.G.P.ground && !__game.G.P.gliding)) break; }
  await ev(() => { window.__task = { type: 'idle' }; }); await p.waitForTimeout(500);
  const glide = await ev(() => __game.S.stats.glide); console.log('distance planée', glide.toFixed(1));
  await ev(() => { window.__task = { type: 'idle' }; });
  // 8. nuit avec aurores
  await ev(() => { const g = __game; g.sky.t = 0.02; g.sky.snowT = 0; g.sky.snow = 0; g.G.weatherT = 999; g.G.camYaw = 0; g.G.camPitch = -0.3; g.G.camDist = 7; });
  await p.waitForTimeout(1500); await snap('nuit_aurores');
  await ev(() => { const g = __game; g.sky.t = 0.4; g.G.camPitch = 0.3; g.G.camDist = 5.8; });
  // 9. sauvegarder, recharger, continuer
  const before = await ev(() => { const g = __game; g.writeSave(); return { lvl: g.S.lvl, xp: g.S.xp, cash: g.S.cash, q: g.S.q, pos: g.S.pos.map(Math.round), placed: g.S.stats.placed }; });
  await p.reload(); await p.waitForTimeout(3000);
  const contVisible = await p.isVisible('#bCont'); await p.click('#bCont');
  await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 90000 }); await p.waitForTimeout(1500);
  const restored = await ev(() => [__game.G.P.x, __game.G.P.y, __game.G.P.z].map(Math.round)); console.log('position restaurée', restored);
  if (bp.placed) { await ev(([x, z]) => { const P = __game.G.P; P.x = x + 3.5; P.z = z + 3.5; P.y = 80; P.vy = 0; }, [bp.placed[0], bp.placed[2]]); await p.waitForFunction(([x, z]) => __game.world.loadedAround(x, z, 1), [bp.placed[0], bp.placed[2]], { timeout: 60000 }); }
  const after = await ev(([pl, before_pos]) => { const g = __game; return { edits: Object.keys(g.S.edits || {}).length, lvl: g.S.lvl, xp: g.S.xp, cash: g.S.cash, q: g.S.q, pos: before_pos, placed: g.S.stats.placed, block: pl ? g.world.get(pl[0], pl[1], pl[2]) : null }; }, [bp.placed, before.pos]);
  console.log('avant', JSON.stringify(before)); console.log('après', JSON.stringify(after), 'bouton Continuer', contVisible);
  await browser.close();
  // 10. mobile (tactile)
  const b2 = await chromium.launch({ args: ARGS });
  const mc = await b2.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await mc.newPage(); mp.on('pageerror', e => errs.push('mobile pageerror: ' + e.message)); mp.on('console', m => { if (m.type() === 'error') errs.push('mobile console: ' + m.text()); });
  await mp.goto(`http://localhost:${PORT}/`); await mp.evaluate(() => localStorage.clear()); await mp.reload(); await mp.waitForTimeout(3000);
  await mp.tap('#bNew'); await mp.tap('#bPersoGo'); await mp.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 }); await mp.waitForTimeout(4000);
  const mInfo = await mp.evaluate(() => ({ view: __game.world.view, touch: document.body.classList.contains('touch'), fps: __game.G.fps }));
  await mp.screenshot({ path: SH + 'mobile.png' }); console.log('capture', SH + 'mobile.png', JSON.stringify(mInfo));
  await b2.close(); srv.close();
  const ok = { quete: after.q.cones && after.q.cones.st === 'done', niveau: after.lvl >= 2, plane: glide > 8, bloc: bp.broke && bp.broke[4] === 0 && bp.placed && bp.placed[3] > 0, sauvegarde: Math.hypot(restored[0] - before.pos[0], restored[2] - before.pos[2]) < 2 && after.lvl === before.lvl && after.cash === before.cash && JSON.stringify(after.q) === JSON.stringify(before.q) && after.block === bp.placed[3], erreurs: errs.length === 0 };
  console.log('RÉSULTAT', JSON.stringify(ok), 'durée', Math.round((Date.now() - t0) / 1000) + ' s');
  console.log(errs.length ? errs.slice(0, 20).join('\n') : 'aucune erreur JS');
  process.exit(Object.values(ok).every(Boolean) ? 0 : 1);
})().catch(e => { console.error('ÉCHEC', e); process.exit(2); });

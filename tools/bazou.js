// v6.4 : course de bazous sur la 175 — Ti-Gus, inscription, grille, compte à rebours, conduite (portes), porte manquée, IA à l'arrivée,
// victoire et défaite, record, remorquage, sauvegarde/rechargement, vieille partie, compagnon passager, abandon, téléphone (◀ ▶ GAZ FREIN). usage : PORT=8937 node tools/bazou.js
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8937), PFX = process.argv[2] || 'apres-v6-bazou', SH = __dirname + '/../shots/';
(async () => {
  const srv = await serve(PORT);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [], bad = [], ok = (c, msg) => { console.log((c ? 'ok   ' : 'ÉCHEC ') + msg); if (!c) bad.push(msg); };
  const mk = async opt => { const ctx = await b.newContext(opt); const p = await ctx.newPage(); p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); }); return p; };
  const shot = async (n, pg) => { await pg.screenshot({ path: SH + PFX + '-' + n + '.png' }); console.log('capture', PFX + '-' + n + '.png'); };
  const boot = async (p, tap) => { await p.goto(`http://localhost:${PORT}/`); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 4, fsAuto: false })); }); await p.reload(); await p.waitForTimeout(2500);
    if (tap) { await p.tap('#bNew'); await p.tap('#bPersoGo', { timeout: 120000 }); } else { await p.click('#bNew'); await p.click('#bPersoGo', { timeout: 120000 }); } await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
    await p.evaluate(() => { const S = __game.S; S.tuto = -1; S.lvl = 4; S.cash = 100; __game.G.P.hp = 400; __game.G.spawnT = 1e9; }); };
  const tpF = p => async (x, z, wait = 900) => { await p.evaluate(([x, z]) => { const P = __game.G.P; P.x = x; P.z = z; P.y = 90; P.vy = 0; }, [x, z]);
    await p.waitForFunction(([x, z]) => __game.world.loadedAround(x, z, 1), [x, z], { timeout: 90000 });
    await p.evaluate(([x, z]) => { const P = __game.G.P; P.y = __game.world.ground(x, z) + 0.1; P.vy = 0; P.iT = 99; }, [x, z]); await p.waitForTimeout(wait); };
  // pilote : vise la route (roadX) un peu devant, gaz au fond ; mode 'lent' = 60 % du temps sans gaz
  const pilot = (p, mode) => p.evaluate(mode => { clearInterval(window.__pl); window.__pl = setInterval(() => { const g = __game, c = g.G.car, N = g.gen.nord, R = g.bazou.R; if (!R || !c) return;
    const zt = c.z - 14, tx = N.roadX(zt) + (R.aimOff || 0), dx = tx - c.x, dz = zt - c.z, want = Math.atan2(-dx, -dz), d = Math.atan2(Math.sin(want - c.yaw), Math.cos(want - c.yaw));
    g.input.tx = Math.max(-1, Math.min(1, -d * 3)); g.input.tz = mode === 'lent' ? (Math.random() < 0.6 ? 0 : -1) : -1; }, 40); }, mode);
  const stop = p => p.evaluate(() => { clearInterval(window.__pl); __game.input.tx = __game.input.tz = 0; });

  const p = await mk({ viewport: { width: 1280, height: 720 } }); const ev = (f, a) => p.evaluate(f, a), W = ms => p.waitForTimeout(ms), tp = tpF(p);
  await boot(p);
  await ev(() => __game.petGive('chien')); await W(500);
  const GA = await ev(() => __game.bazou.garage);
  const talk = async () => { await tp(GA.x - 2, GA.z - 2, 1500); await p.waitForFunction(() => [...__game.G.npcs.values()].some(n => n.role === 'garagiste'), null, { timeout: 30000 }).catch(() => {});
    const n = await ev(() => { for (const [, n] of __game.G.npcs) if (n.role === 'garagiste') return [n.x, n.z]; return null; }); if (!n) return null;
    await tp(n[0] - 1.3, n[1], 500); await ev(() => __game.pressed.add('KeyE')); await p.waitForFunction(() => __game.G.state === 'dialog', null, { timeout: 15000 }).catch(() => {});
    return ev(() => __game.G.state === 'dialog' ? { r: __game.G.dlgNpc && __game.G.dlgNpc.role, t: document.getElementById('dtext').textContent, b: [...document.querySelectorAll('#dbtns .btn')].map(b => b.textContent) } : null); };
  const btn = async label => { for (const x of await p.$$('#dbtns .btn')) if ((await x.textContent()).includes(label)) { await x.click(); await W(300); return true; } return false; };
  // ---------- 1. Ti-Gus → départ ----------
  const d1 = await talk(); ok(d1 && d1.r === 'garagiste' && d1.b.some(t => /COURSE SUR LA 175/.test(t)), 'Ti-Gus au garage : ' + JSON.stringify(d1 && d1.b));
  const cash0 = await ev(() => __game.S.cash); await btn('COURSE SUR LA 175'); await W(400);
  const g0 = await ev(() => { const g = __game, R = g.bazou.R; return R && { drive: g.G.drive, ai: R.ai.length, gates: R.gates.length, freeze: g.G.race.freeze, cash: g.S.cash, v: g.G.car.v }; });
  ok(g0 && g0.drive && g0.ai === 3 && g0.gates === 5 && g0.freeze && g0.cash === cash0 - 10, 'grille : au volant, 3 rivaux, 5 portes, inscription -10 $ ' + JSON.stringify(g0));
  await ev(() => { const G = __game.G; G.camYaw = G.car.yaw + 0.5; G.camPitch = 0.35; }); await W(300); await shot('grille', p);
  await p.keyboard.down('KeyW'); await W(1200); const vf = await ev(() => [__game.bazou.R.count, __game.G.car.v]); await p.keyboard.up('KeyW');
  ok(vf[0] > 0 ? vf[1] === 0 : true, 'compte à rebours : le bazou reste sur la ligne (v=' + vf[1] + ')');
  await p.waitForFunction(() => __game.bazou.R.count <= 0, null, { timeout: 15000 });
  const pet = await ev(() => { const d = __game.G.pet, c = __game.G.car; return d && d.M.g.visible && Math.hypot(d.M.g.position.x - c.x, d.M.g.position.z - c.z) < 1.5; }); ok(pet, 'Pistache est assis dans le bazou (passager)');
  // ---------- 2. conduire : W + pilote ; porte manquée ----------
  await p.keyboard.down('KeyW'); await W(1500); const sp = await ev(() => __game.G.car.v); await p.keyboard.up('KeyW');
  ok(sp > 8, 'W : le bazou accélère (' + sp.toFixed(1) + ' m/s)');
  await ev(() => { __game.bazou.R.aimOff = 12; }); await pilot(p, 'vite');
  await p.waitForFunction(() => __game.G.car.z < -237, null, { timeout: 30000 }).catch(() => {});
  const miss = await ev(() => __game.bazou.R.cp); ok(miss === 0, 'porte 1 passée à côté (12 m) : pas comptée');
  // retour : on remet le bazou avant la porte sur la route
  await ev(() => { const g = __game, c = g.G.car, N = g.gen.nord; c.z = -228; c.x = N.roadX(-228); c.v = 0; c.yaw = c.dir = 0; g.bazou.R.prevZ = c.z; g.bazou.R.aimOff = 0; });
  await p.waitForFunction(() => __game.bazou.R.cp >= 2, null, { timeout: 40000 }).catch(() => {});
  await W(600); await ev(() => { const G = __game.G; G.camYaw = G.car.yaw - 0.35; G.camPitch = 0.28; }); await W(250); await shot('course', p);
  ok((await ev(() => __game.bazou.R.cp)) >= 2, 'portes 1 et 2 passées sur la route (' + await ev(() => __game.bazou.R.cpT.map(t => t.toFixed(1)).join(', ')) + ' s)');
  await p.waitForFunction(() => __game.bazou.R.done && __game.bazou.R.pos, null, { timeout: 60000 }).catch(() => {});
  await stop(p);
  const r1 = await ev(() => ({ pos: __game.bazou.R && __game.bazou.R.pos, lr: __game.G.lastRace, b: __game.S.bazou, cash: __game.S.cash, ai: __game.bazou.R && __game.bazou.R.ai.map(a => [a.name.slice(0, 8), +a.s.toFixed(0), a.fin && +a.fin.toFixed(1)]), dmg: __game.bazou.R && +__game.bazou.R.dmg.toFixed(0) }));
  ok(r1.pos && r1.b.n === 1 && r1.b.best > 0 && r1.lr.rec, 'arrivée : ' + r1.pos + 'e en ' + (r1.lr && r1.lr.t.toFixed(1)) + ' s, record ' + JSON.stringify(r1.b) + ' rivaux ' + JSON.stringify(r1.ai) + ' dégâts ' + r1.dmg);
  await shot('arrivee', p);
  const rt = await ev(() => document.getElementById('bzRes').textContent); ok(/Nouveau record/.test(rt) && /Toi/.test(rt), 'tableau d\'arrivée avec record');
  // ---------- 3. 2e course : lente → l'IA gagne ----------
  await ev(() => [...document.querySelectorAll('#bzResB .btn')].find(b => /GARAGE/.test(b.textContent)).click()); await W(800);
  ok(await ev(() => !__game.G.drive && !__game.bazou.R && Math.hypot(__game.G.P.x - __game.bazou.garage.x, __game.G.P.z - __game.bazou.garage.z) < 4), 'remorqué jusqu\'au garage');
  await ev(() => { __game.S.cash = 100; __game.bazou.start(); }); await p.waitForFunction(() => __game.bazou.R.count <= 0, null, { timeout: 15000 });
  await pilot(p, 'lent');
  const aiFin = await p.waitForFunction(() => __game.bazou.R.ai.some(a => a.fin != null), null, { timeout: 90000 }).then(() => true).catch(() => false);
  ok(aiFin, 'un rival franchit l\'arrivée : ' + await ev(() => __game.bazou.R.order.join(', ')));
  await ev(() => { const g = __game, c = g.G.car, N = g.gen.nord, R = g.bazou.R; R.cp = 4; c.z = -590; c.x = N.roadX(-590); c.v = 15; c.yaw = c.dir = 0; R.prevZ = c.z; });
  await p.waitForFunction(() => __game.bazou.R.pos, null, { timeout: 20000 }).catch(() => {});
  await stop(p);
  const r2 = await ev(() => ({ pos: __game.bazou.R && __game.bazou.R.pos, b: __game.S.bazou, lr: __game.G.lastRace }));
  ok(r2.pos > 1 && r2.b.n === 2 && !r2.lr.rec && r2.b.best === r1.b.best, 'défaite : ' + r2.pos + 'e, record gardé ' + r2.b.best);
  await ev(() => [...document.querySelectorAll('#bzResB .btn')].find(b => /RESTER/.test(b.textContent)).click()); await W(300);
  // ---------- 4. abandon (sortir du bazou) ----------
  await ev(() => { __game.S.cash = 100; __game.bazou.start(); }); await W(500); await ev(() => __game.pressed.add('KeyE')); await W(800);
  ok(await ev(() => !__game.bazou.R && !__game.G.race && __game.S.bazou.n === 2), 'sortir du bazou = abandon, fiche inchangée');
  // ---------- 5. sauvegarde ----------
  const bz = await ev(() => JSON.stringify(__game.S.bazou)); await ev(() => __game.writeSave()); await p.reload(); await W(2500); await p.click('#bCont'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 90000 }); await W(800);
  ok((await ev(() => JSON.stringify(__game.S.bazou))) === bz, 'rechargé : ' + bz);
  const ns = await ev(() => __game.normSave({ q: {} }).bazou); ok(ns && ns.n === 0 && ns.best === 0, 'vieille partie : S.bazou créé');
  const d2 = await talk(); ok(d2 && /record : \d:\d\d\.\d/.test(d2.t), 'Ti-Gus affiche ton record'); await ev(() => __game.closeDialog());
  // ---------- 6. téléphone ----------
  const m = await mk({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const tpm = tpF(m);
  await boot(m, true); await m.evaluate(() => __game.petGive('raton'));
  await m.evaluate(() => __game.bazou.start()); await m.waitForFunction(() => __game.bazou.R.count <= 0, null, { timeout: 20000 });
  ok(await m.evaluate(() => ['bzPad', 'bzPad2'].every(id => getComputedStyle(document.getElementById(id)).display !== 'none') && getComputedStyle(document.getElementById('stick')).display === 'none'), 'téléphone : ◀ ▶ GAZ FREIN affichés, bâton caché');
  const cdp = await m.context().newCDPSession(m); const ctr = async sel => { const r = await m.evaluate(s => document.querySelector(s).getBoundingClientRect().toJSON(), sel); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
  const gz = await ctr('#bzPad2 [data-k="g"]'), rt2 = await ctr('#bzPad [data-k="r"]');
  const yaw0 = await m.evaluate(() => __game.G.car.yaw);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: gz.x, y: gz.y, id: 1 }] }); await m.waitForTimeout(1500);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: gz.x, y: gz.y, id: 1 }, { x: rt2.x, y: rt2.y, id: 2 }] }); await m.waitForTimeout(500);
  await shot('mobile', m);
  const mv = await m.evaluate(() => ({ v: __game.G.car.v, yaw: __game.G.car.yaw }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await m.waitForTimeout(300);
  ok(mv.v > 6 && mv.yaw < yaw0 - 0.05, 'téléphone : GAZ fait rouler (' + mv.v.toFixed(1) + ' m/s), ▶ tourne à droite (' + (mv.yaw - yaw0).toFixed(2) + ' rad)');
  const fb = await ctr('#bzPad2 [data-k="b"]'); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fb.x, y: fb.y, id: 3 }] }); await m.waitForTimeout(700);
  const vb = await m.evaluate(() => __game.G.car.v); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  ok(vb < mv.v - 3, 'téléphone : FREIN ralentit (' + vb.toFixed(1) + ' m/s)');
  ok(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(bad.length ? 'BAZOU ÉCHEC (' + bad.length + ')' : 'BAZOU OK');
  await b.close(); srv.close(); process.exit(bad.length ? 1 : 0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });

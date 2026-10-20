// v6.3 : hockey sur la patinoire de Mireille — lancer la game, patiner, lancer, compter, l'IA compte, fin de match, récompense,
// Coupe Mireille, fiche, sauvegarde/rechargement, vieille partie, dek hockey l'été (abandon), téléphone (bâton tactile + LANCE). usage : PORT=8936 node tools/hockey.js
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8936), PFX = process.argv[2] || 'apres-v6-hockey', SH = __dirname + '/../shots/';
(async () => {
  const srv = await serve(PORT);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [], bad = [], ok = (c, msg) => { console.log((c ? 'ok   ' : 'ÉCHEC ') + msg); if (!c) bad.push(msg); };
  const mk = async opt => { const ctx = await b.newContext(opt); const p = await ctx.newPage(); p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); }); return p; };
  const shot = async (n, pg) => { await pg.screenshot({ path: SH + PFX + '-' + n + '.png' }); console.log('capture', PFX + '-' + n + '.png'); };
  const boot = async (p, tap) => { await p.goto(`http://localhost:${PORT}/`); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 4, fsAuto: false })); }); await p.reload(); await p.waitForTimeout(2500);
    if (tap) { await p.tap('#bNew'); await p.tap('#bPersoGo'); } else { await p.click('#bNew'); await p.click('#bPersoGo'); } await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
    await p.evaluate(() => { const S = __game.S; S.tuto = -1; S.lvl = 4; S.cash = 100; __game.G.P.hp = 400; __game.G.spawnT = 1e9; }); };
  const tpF = p => async (x, z, wait = 900) => { await p.evaluate(([x, z]) => { const P = __game.G.P; P.x = x; P.z = z; P.y = 90; P.vy = 0; }, [x, z]);
    await p.waitForFunction(([x, z]) => __game.world.loadedAround(x, z, 1), [x, z], { timeout: 90000 });
    await p.evaluate(([x, z]) => { const P = __game.G.P; P.y = __game.world.ground(x, z) + 0.1; P.vy = 0; P.iT = 99; }, [x, z]); await p.waitForTimeout(wait); };
  // donne la rondelle à un joueur (index) à d mètres du but visé ; le gardien adverse regarde ailleurs si noSave
  const setup = (p, i, d, noSave) => p.evaluate(([i, d, noSave]) => { const H = __game.hockey, M = H.M, R = H.rk(), s = M.L[i], sx = s.team ? -1 : 1;
    s.x = R.cx + sx * (R.gx - d); s.z = R.cz; s.vx = s.vz = 0; s.yaw = sx > 0 ? -Math.PI / 2 : Math.PI / 2; s.cd = 0; M.puck.own = s; M.lastTouch = s; s.think = 0.2;
    for (const q of M.L) if (q.team !== s.team) { q.x = R.cx - sx * 6 + (q.gk ? 0 : (Math.random() - 0.5) * 4); q.z = R.cz + (q.gk ? 5 : (Math.random() - 0.5) * 6); q.vx = q.vz = 0; if (noSave) q.cd = 99; } }, [i, d, noSave]);
  const st = p => p.evaluate(() => { const M = __game.hockey.M; return M ? { ph: M.ph, sc: M.sc.slice(), clock: M.clock } : null; });

  const p = await mk({ viewport: { width: 1280, height: 720 } }); const ev = (f, a) => p.evaluate(f, a), W = ms => p.waitForTimeout(ms), tp = tpF(p);
  await boot(p);
  await ev(() => { __game.setSeason(0); __game.petGive('chien'); }); await W(800);
  const RK = await ev(() => { const R = __game.hockey.rk(); return { cx: R.cx, cz: R.cz, mx: R.s.x - 12.5, mz: R.s.z + 3.5 }; });
  const talk = async () => { await tp(RK.mx + 1.5, RK.mz, 1500); const n = await ev(() => { for (const [, n] of __game.G.npcs) if (n.role === 'animatrice') return [n.x, n.z]; return null; }); if (!n) return null;
    await tp(n[0] + 1.3, n[1], 500); await ev(() => __game.pressed.add('KeyE')); await W(500); return ev(() => __game.G.state === 'dialog' ? [...document.querySelectorAll('#dbtns .btn')].map(b => b.textContent) : null); };
  const btn = async label => { for (const x of await p.$$('#dbtns .btn')) if ((await x.textContent()).includes(label)) { await x.click(); await W(300); return true; } return false; };
  // ---------- 1. Mireille → game ----------
  const bt = await talk(); ok(bt && bt.some(t => /GAME DE HOCKEY/.test(t)), 'Mireille : ' + JSON.stringify(bt));
  const cash0 = await ev(() => __game.S.cash);
  await btn('GAME DE HOCKEY'); await W(500);
  ok((await ev(() => __game.G.state)) === 'hockey' && await ev(() => getComputedStyle(document.getElementById('hockey')).display !== 'none' && __game.hockey.M.L.length === 6), 'game lancée : 6 joueurs, pointage affiché');
  await shot('mise-au-jeu', p);
  ok((await st(p)).ph === 'mise' && /Mise au jeu/.test(await ev(() => document.getElementById('hkMsg').textContent)), 'mise au jeu au centre');
  await p.waitForFunction(() => __game.hockey.M.ph === 'jeu', null, { timeout: 10000 });
  // ---------- 2. patiner ----------
  const x0 = await ev(() => __game.G.P.x); await p.keyboard.down('KeyD'); await W(900); await p.keyboard.up('KeyD'); const x1 = await ev(() => __game.G.P.x);
  await W(600); const x2 = await ev(() => __game.G.P.x);
  ok(x1 - x0 > 1.5 && x2 > x1, 'patine vers la droite : +' + (x1 - x0).toFixed(1) + ' m, puis glisse encore +' + (x2 - x1).toFixed(1) + ' m');
  const sitd = await ev(() => { const d = __game.G.pet, h = __game.G.petHold; return d && h ? +Math.hypot(d.x - h.x, d.z - h.z).toFixed(1) : 99; });
  // ---------- 3. ton but ----------
  await setup(p, 0, 4.5, true); await W(100);
  await p.keyboard.press('Space');
  await p.waitForFunction(() => { const M = __game.hockey.M; return M.ph === 'but' || (M.puck.own === null && Math.hypot(M.puck.vx, M.puck.vz) > 8); }, null, { timeout: 5000 }).catch(() => {});
  await W(120); await shot('lancer', p);
  await p.waitForFunction(() => __game.hockey.M.ph === 'but', null, { timeout: 5000 }).catch(() => {});
  let s = await st(p); ok(s.ph === 'but' && s.sc[0] === 1 && await ev(() => __game.S.hockey.buts === 1 && (__game.G.hkLog || []).includes('B:Toi')), 'BUT! lancer avec Espace → Bleus 1 (' + JSON.stringify(s) + ')');
  await W(300); await shot('but', p);
  ok(sitd < 3 || await ev(() => { const d = __game.G.pet, h = __game.G.petHold; return Math.hypot(d.x - h.x, d.z - h.z) < 3; }), 'Pistache attend le long de la bande');
  // ---------- 4. l'IA compte ----------
  await p.waitForFunction(() => __game.hockey.M.ph === 'jeu', null, { timeout: 10000 });
  let aiOk = false;
  for (let k = 0; k < 4 && !aiOk; k++) { await setup(p, 3, 5, true); await ev(() => { const M = __game.hockey.M; M.L[0].x = M.L[3].x + 6; M.L[0].z = M.L[3].z + 4; });
    aiOk = await p.waitForFunction(() => __game.hockey.M.sc[1] >= 1, null, { timeout: 12000 }).then(() => true).catch(() => false);
    if (!aiOk) await p.waitForFunction(() => __game.hockey.M.ph === 'jeu', null, { timeout: 8000 }).catch(() => {}); }
  ok(aiOk && !!(await ev(() => (__game.G.hkLog || []).find(x => /^R:/.test(x)))), 'les Rouges comptent tout seuls (IA : ' + await ev(() => (__game.G.hkLog || []).join(', ')) + ')');
  await p.waitForFunction(() => __game.hockey.M.ph === 'jeu', null, { timeout: 10000 }); await W(1500);
  await shot('pointage', p);
  ok(await ev(() => document.getElementById('hkB').textContent === '1' && document.getElementById('hkR').textContent === '1' && /^[0-3]:\d\d$/.test(document.getElementById('hkClock').textContent)), 'pointage : 1 — 1, horloge ' + await ev(() => document.getElementById('hkClock').textContent));
  // ---------- 5. fin du match ----------
  await ev(() => { __game.hockey.M.sc[0] = 2; }); await setup(p, 0, 4, true); await W(100); await p.mouse.click(640, 300);
  await p.waitForFunction(() => __game.hockey.M.ph === 'fin', null, { timeout: 12000 }).catch(() => {});
  const fin = await ev(() => ({ ph: __game.hockey.M.ph, txt: document.getElementById('hkEndT').textContent, h: __game.S.hockey, cash: __game.S.cash, cup: __game.S.inv.some(i => i.id === 'coupe_mireille') }));
  ok(fin.ph === 'fin' && /VICTOIRE/.test(fin.txt) && fin.h.w === 1 && fin.h.gp === 1 && fin.h.gf === 3 && fin.h.ga === 1 && fin.cash === cash0 + 50 && fin.cup, 'victoire 3 — 1 (lancer au clic) : +50 $, Coupe Mireille, fiche ' + JSON.stringify(fin.h));
  await W(400); await shot('fin', p);
  await ev(() => [...document.querySelectorAll('#hkEndBtns .btn')].find(b => /SORTIR/.test(b.textContent)).click()); await W(600);
  ok(await ev(() => __game.G.state === 'play' && !__game.G.petHold && [...__game.G.npcs.values()].every(n => n.model.g.visible)), 'SORTIR : retour au jeu, patineurs du village revenus');
  const bt2 = await talk(); await btn('TA FICHE'); const fi = await ev(() => document.getElementById('dtext').textContent);
  ok(/Coupe Mireille gagnée/.test(fi) && /Tes buts : 2/.test(fi), 'fiche de hockey : ' + fi.replace(/\s+/g, ' ').slice(0, 120)); await ev(() => __game.closeDialog());
  // ---------- 6. sauvegarde ----------
  await ev(() => __game.writeSave()); await p.reload(); await W(2500); await p.click('#bCont'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 90000 }); await W(800);
  ok(await ev(() => __game.S.hockey.w === 1 && __game.S.hockey.coupe && __game.S.hockey.buts === 2), 'rechargé : fiche de hockey gardée');
  const ns = await ev(() => __game.normSave({ q: {} }).hockey); ok(ns && ns.gp === 0 && ns.coupe === false, 'vieille partie : S.hockey créé');
  // ---------- 7. dek hockey l'été, abandon ----------
  await ev(() => __game.setSeason(2)); await W(800); const bt3 = await talk(); ok(bt3 && bt3.some(t => /DEK HOCKEY/.test(t)), 'été : ' + JSON.stringify(bt3));
  await btn('DEK HOCKEY'); await W(400); ok(await ev(() => __game.hockey.M && __game.hockey.M.dek), 'dek hockey : balle orange');
  await ev(() => __game.pressed.add('Escape')); await W(400); ok(await ev(() => __game.G.state === 'play' && __game.S.hockey.gp === 1), 'Échap : partie abandonnée, fiche inchangée');
  // ---------- 8. téléphone ----------
  const m = await mk({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const cdp = await m.context().newCDPSession(m);
  await boot(m, true); await m.evaluate(() => { __game.setSeason(0); __game.petGive('raton'); }); await m.waitForTimeout(800);
  await m.evaluate(() => __game.hockey.start()); await m.waitForFunction(() => __game.hockey.M.ph === 'jeu', null, { timeout: 15000 });
  ok(await m.evaluate(() => getComputedStyle(document.getElementById('hkLance')).display !== 'none' && getComputedStyle(document.getElementById('tAtk')).display === 'none' && getComputedStyle(document.getElementById('stick')).display !== 'none'), 'téléphone : LANCE/PASSE, bâton de pouce gardé, autres boutons cachés');
  const r = await m.evaluate(() => document.getElementById('stick').getBoundingClientRect().toJSON()), cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  const mx0 = await m.evaluate(() => __game.G.P.x);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
  for (let k = 1; k <= 5; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + k * 12, y: cy, id: 1 }] });
  await m.waitForTimeout(900); await m.waitForTimeout(100); await shot('mobile', m);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const mx1 = await m.evaluate(() => __game.G.P.x); ok(mx1 - mx0 > 1.5, 'téléphone : patine au pouce (+' + (mx1 - mx0).toFixed(1) + ' m)');
  await setup(m, 0, 4.5, true); await m.waitForTimeout(100); await m.tap('#hkLance');
  const mg = await m.waitForFunction(() => __game.hockey.M.sc[0] >= 1, null, { timeout: 6000 }).then(() => true).catch(() => false);
  ok(mg, 'téléphone : BUT au bouton LANCE');
  await setup(m, 0, 8, true); const own = await m.evaluate(() => __game.hockey.M.ph); if (own === 'jeu') { await m.tap('#hkPasse'); await m.waitForTimeout(400); }
  ok(own !== 'jeu' || await m.evaluate(() => { const M = __game.hockey.M; return M.puck.own !== M.L[0]; }), 'téléphone : PASSE');
  ok(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(bad.length ? 'HOCKEY ÉCHEC (' + bad.length + ')' : 'HOCKEY OK');
  await b.close(); srv.close(); process.exit(bad.length ? 1 : 0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });

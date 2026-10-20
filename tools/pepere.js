// v5c : les trois quêtes de Pépère Tremblay, jouées au complet (téléportations) :
// sirop (10 chaudières éparpillées, ratons de garde, gel en 4 min → échec puis réussite), temps des sucres (eau d'érable
// bouillie à l'évaporateur + neige ramassée → 2 tires), feuilles (10 rouge vif parmi des ternes qui ne comptent pas).
// usage : PORT=8936 node tools/pepere.js [préfixe captures]
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8936), PFX = process.argv[2] || 'apres-v5c', SH = __dirname + '/../shots/';
(async () => {
  const srv = await serve(PORT);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [], res = {}, bad = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const ev = (f, a) => p.evaluate(f, a), W = ms => p.waitForTimeout(ms);
  const ok = (c, msg) => { console.log((c ? 'ok   ' : 'ÉCHEC ') + msg); if (!c) bad.push(msg); };
  const shot = async n => { await p.screenshot({ path: SH + PFX + '-' + n + '.png' }); console.log('capture', PFX + '-' + n + '.png'); };
  await p.goto(`http://localhost:${PORT}/`); await ev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 4 })); }); await p.reload(); await W(2000);
  await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 90000 });
  await ev(() => { const S = __game.S; S.tuto = -1; S.lvl = 8; S.q.cones = { st: 'done', n: 6 }; __game.G.P.hp = 400; __game.G.spawnT = 1e9; });
  const tp = async (x, z, wait = 900) => { await ev(([x, z]) => { const P = __game.G.P; P.x = x; P.z = z; P.y = 90; P.vy = 0; }, [x, z]);
    await p.waitForFunction(([x, z]) => __game.world.loadedAround(x, z, 1), [x, z], { timeout: 90000 });
    await ev(([x, z]) => { const P = __game.G.P; P.y = __game.world.ground(x, z) + 0.1; P.vy = 0; P.iT = 1; }, [x, z]); await W(wait); };
  const calm = () => ev(() => { const G = __game.G; G.P.hp = 400; G.P.iT = 99; for (const e of G.enemies) if (!e.dead) { e.hp = 0; e.dead = true; e.model.g.visible = false; e.label.remove(); } });
  const talk = async () => { const c = await ev(() => { const s = __game.gen.cell(1, 0); return [s.x, s.z]; }); await tp(c[0] + 3, c[1] + 3, 1500);
    const n = await ev(() => { for (const [, n] of __game.G.npcs) if (n.role === 'pepere') return [n.x, n.z]; return null; }); if (!n) return 'pas de pépère';
    await tp(n[0], n[1] + 1.4, 600); await ev(() => { const P = __game.G.P; for (const [, o] of __game.G.npcs) if (o.role !== 'pepere' && Math.hypot(o.x - P.x, o.z - P.z) < 4) { o.x += 6; o.home.x += 6; } });
    await ev(() => __game.pressed.add('KeyE')); await W(500); return ev(() => __game.G.state); };
  const btn = async label => { if (!(await p.isVisible('#dialog'))) return false; for (const x of await p.$$('#dbtns .btn')) if ((await x.textContent()).includes(label)) { await x.click(); await W(300); return true; } return false; };
  const close = () => ev(() => { if (__game.G.state === 'dialog') __game.closeDialog(); });
  const C = await ev(() => { const s = __game.gen.cell(1, 0); return { x: s.x, z: s.z }; });
  const pick = (kind, pre) => ev(([k, pre]) => __game.G.pickups.filter(p => p.kind === k && (!pre || (p.key || '').startsWith(pre))).map(p => ({ x: p.x, z: p.z, key: p.key, guard: p.guard || 0 })), [kind, pre]);
  // marche sur l'objet ; renvoie s'il a disparu (ramassé)
  const grab = async it => { await tp(it.x, it.z, 300); await calm(); try { await p.waitForFunction(k => !__game.G.pickups.some(q => q.key === k), it.key, { timeout: 8000 }); return true; } catch (e) { return false; } };
  const allLoaded = async () => { for (const [dx, dz] of [[0, 0], [30, 0], [-30, 0], [0, 30], [0, -30], [24, 24], [-24, -24], [24, -24], [-24, 24]]) await tp(C.x + dx, C.z + dz, 1200); };

  // ---------- 1. sirop ----------
  res.dlg1 = await talk(); res.acc1 = await btn('ACCEPTER'); await close();
  ok(res.acc1 && (await ev(() => (__game.S.q.sirop || {}).st)) === 'active', 'sirop accepté');
  ok(await ev(() => __game.QUESTS.sirop.n === 10), 'sirop : il faut 10 chaudières');
  await allLoaded(); await calm();
  let pails = await pick('chaudiere', 'b1,0');
  const ds = pails.map(q => Math.hypot(q.x - C.x, q.z - C.z));
  ok(pails.length === 12, 'sirop : 12 chaudières dans l’érablière (' + pails.length + ')');
  ok(Math.min(...ds) > 12 && Math.max(...ds) > 28, 'sirop : éparpillées loin de la cabane (' + Math.min(...ds).toFixed(0) + ' à ' + Math.max(...ds).toFixed(0) + ' m)');
  ok(pails.filter(q => q.guard).length >= 3, 'sirop : chaudières gardées : ' + pails.filter(q => q.guard).length);
  // vue d'ensemble : caméra haute au-dessus de la cabane, chaudières grossies ×4 pour la capture seulement
  await tp(C.x, C.z + 4, 800); await calm();
  await ev(() => { const G = __game.G; G.pickups.forEach(q => { if (q.kind === 'chaudiere') q.m.scale.setScalar(4); }); G.camPitch = 1.25; G.camDist = 46; G.overShot = true; });
  await W(1500); await shot('chaudieres-eparpillees');
  await ev(() => { const G = __game.G; G.pickups.forEach(q => q.m.scale.setScalar(1)); G.camPitch = 0.32; G.camDist = 5.8; });
  // chaudière gardée : des ratons apparaissent à l'approche
  const gp = pails.find(q => q.guard);
  await calm(); await ev(k => { const q = __game.G.pickups.find(q => q.key === k); if (q) q.guarded = false; }, gp.key);
  await ev(([x, z]) => { const P = __game.G.P; P.x = x + 9; P.z = z; P.y = __game.world.ground(x + 9, z) + 0.1; P.iT = 99; P.hp = 400; }, [gp.x, gp.z]); await W(1500);
  const guards = await ev(k => __game.G.enemies.filter(e => !e.dead && e.type === 'raton' && e.guardOf === k).length, gp.key);
  ok(guards >= 1 && guards <= 2 && guards === gp.guard, 'sirop : ' + guards + ' raton(s) gardent la chaudière');
  await ev(([x, z]) => { const G = __game.G; G.camYaw = Math.atan2(G.P.x - x, G.P.z - z); G.camPitch = 0.35; G.camDist = 6; }, [gp.x, gp.z]); await W(900); await shot('chaudiere-gardee');
  await calm();
  // première chaudière : la minuterie part
  pails = await pick('chaudiere', 'b1,0');
  ok(await grab(pails[0]), 'sirop : 1re chaudière ramassée');
  let sq = await ev(() => __game.S.q.sirop);
  ok(sq.n === 1 && sq.left > 230 && sq.left <= 240, 'sirop : minuterie partie (' + (sq.left || 0).toFixed(0) + ' s)');
  await W(1200); const trk = await ev(() => document.getElementById('tracker').textContent);
  ok(/gel dans [34]:\d\d/.test(trk), 'sirop : minuterie dans le suivi « ' + (trk.match(/Chaudières[^·]*· gel dans \d:\d\d/) || [''])[0] + ' »');
  await shot('gel-minuterie');
  for (const it of pails.slice(1, 3)) ok(await grab(it), 'sirop : chaudière ' + it.key);
  sq = await ev(() => __game.S.q.sirop); ok(sq.n === 3 && sq.keys.length === 3, 'sirop : 3 / 10 et 3 clés suivies');
  // échec : on fait passer le temps
  const dt0 = await ev(() => { const s = __game.S.q.sirop; const l = s.left; s.left = 1.5; return l; });
  await p.waitForFunction(() => __game.S.q.sirop.left == null, null, { timeout: 20000 }).catch(() => {});
  sq = await ev(() => __game.S.q.sirop);
  const ban = await ev(() => document.getElementById('banner').textContent);
  ok(sq.st === 'active' && sq.n === 0 && sq.keys.length === 0, 'sirop : gel → 0 / 10, toujours en cours');
  ok(/GELÉ/.test(ban), 'sirop : bannière « ' + ban.slice(0, 40) + ' »');
  ok(await ev(k => k.every(x => !__game.S.taken[x]), pails.slice(0, 3).map(q => q.key)), 'sirop : chaudières remises dans l’érablière (S.taken effacé)');
  await shot('gel-echec');
  await tp(C.x, C.z, 1500); pails = await pick('chaudiere', 'b1,0');
  ok(pails.length === 12, 'sirop : les 12 chaudières sont revenues (' + pails.length + ')');
  // réussite : 10 en moins de 4 minutes (de jeu)
  for (const it of pails) { if (await ev(() => __game.S.q.sirop.st) !== 'active') break; await grab(it); }
  sq = await ev(() => __game.S.q.sirop);
  ok(sq.st === 'ready' && sq.left == null, 'sirop : 10 / 10 → objectif atteint, minuterie arrêtée (' + sq.st + ')');
  const cash0 = await ev(() => __game.S.cash);
  await talk(); await btn('MERCI'); await close();
  ok((await ev(() => __game.S.q.sirop.st)) === 'done' && (await ev(() => __game.S.cash)) - cash0 >= 90, 'sirop : terminée, récompense ' + ((await ev(() => __game.S.cash)) - cash0) + ' $');

  // ---------- 2. temps des sucres (printemps) ----------
  await ev(() => { const g = __game, S = g.S; g.setSeason(1); S.inv = S.inv.filter(i => i.id !== 'sirop'); delete S.blocks[g.B.SNOW]; });
  await W(800);
  res.dlg2 = await talk(); res.acc2 = await btn('ACCEPTER'); await close();
  ok((await ev(() => (__game.S.q.tire_printemps || {}).st)) === 'active', 'tire : acceptée au printemps');
  ok(await ev(() => !__game.S.inv.some(i => i.id === 'sirop' || i.id === 'sirop_coulee') && !(__game.S.blocks[__game.B.SNOW] > 0)), 'tire : Pépère ne donne plus ni sirop ni neige');
  await allLoaded(); await calm();
  const eaux = await pick('eau', 'e1,0'), neiges = await pick('neige', 'n1,0');
  ok(eaux.length === 10 && neiges.length === 8, 'tire : ' + eaux.length + ' eaux d’érable, ' + neiges.length + ' mottes de neige');
  const step0 = await ev(() => document.getElementById('tracker').textContent); ok(/eau d’érable/.test(step0), 'tire : suivi « ramasse l’eau »');
  let got = 0; for (const it of eaux.slice(0, 6)) got += await grab(it) ? 1 : 0;
  ok(got === 6 && (await ev(() => __game.S.inv.filter(i => i.id === 'eau_erable').reduce((a, i) => a + (i.n || 1), 0))) === 6, 'tire : 6 eaux d’érable au sac');
  // bouillir loin de la cabane : refusé
  await tp(C.x + 40, C.z + 40, 400);
  ok(!(await ev(() => __game.craft('bouillir'))), 'tire : bouillir refusé loin de l’évaporateur');
  await tp(C.x + 1, C.z + 6, 800);
  ok(await ev(() => __game.craft('bouillir')), 'tire : 1re canne bouillie à la cabane');
  await ev(() => { __game.openPanel('craft'); const i = __game.RECIPES.findIndex(r => r.id === 'bouillir'); const el = document.querySelector('.rcp[data-i="' + i + '"]'); if (el) el.click(); });
  await W(400); const cr = await ev(() => document.getElementById('craftbody').textContent);
  ok(/Faire bouillir/.test(cr) && /Tire de Pépère/.test(cr), 'tire : recettes de la quête à l’atelier');
  await ev(() => { const b = document.getElementById('cGo'); if (b) b.click(); }); // 2e canne, par le bouton
  await W(250); await shot('bouillir');
  await ev(() => __game.closePanels && __game.closePanels());
  ok(await ev(() => __game.S.inv.filter(i => i.id === 'sirop_coulee').reduce((a, i) => a + (i.n || 1), 0) === 2), 'tire : 2 cannes de sirop de la coulée');
  ok(!(await ev(() => __game.craft('tire_pepere'))), 'tire : pas de tire sans neige');
  got = 0; for (const it of neiges.slice(0, 4)) got += await grab(it) ? 1 : 0;
  ok(got === 4 && (await ev(() => __game.S.blocks[__game.B.SNOW])) === 4, 'tire : 4 mottes de neige ramassées');
  await ev(() => { __game.craft('tire_pepere'); __game.craft('tire_pepere'); });
  ok((await ev(() => __game.S.q.tire_printemps.st)) === 'ready', 'tire : 2 tires → objectif atteint');
  await talk(); await btn('MERCI'); await close();
  ok((await ev(() => __game.S.q.tire_printemps.st)) === 'done', 'tire : terminée');

  // ---------- 3. feuilles (automne) ----------
  await ev(() => __game.setSeason(3)); await W(800);
  res.dlg3 = await talk(); res.acc3 = await btn('ACCEPTER'); await close();
  ok((await ev(() => (__game.S.q.feuilles || {}).st)) === 'active' && (await ev(() => __game.QUESTS.feuilles.n)) === 10, 'feuilles : acceptée, il en faut 10');
  await allLoaded(); await calm();
  const rouges = await pick('feuille', 'f1,0'), ternes = await pick('feuille_terne', 'g1,0');
  ok(rouges.length === 14 && ternes.length === 20, 'feuilles : ' + rouges.length + ' rouges, ' + ternes.length + ' ternes');
  // gros plan : une terne et la rouge la plus proche
  const t0 = ternes[0]; const r0 = rouges.slice().sort((a, b2) => Math.hypot(a.x - t0.x, a.z - t0.z) - Math.hypot(b2.x - t0.x, b2.z - t0.z))[0];
  ok(!(await grab(t0)) && (await ev(() => __game.S.q.feuilles.n)) === 0, 'feuilles : une terne ne compte pas (reste au sol)');
  await ev(([t, r]) => { const G = __game.G; for (const q of G.pickups) if (q.key === r.key) { q.x = t.x + 1.2; q.z = t.z; } const P = G.P; P.x = t.x + 0.6; P.z = t.z + 3.2; P.y = __game.world.ground(P.x, P.z) + 0.1; G.camYaw = 0; G.camPitch = 0.5; G.camDist = 3.2; }, [t0, r0]);
  await W(1200); await shot('feuilles-rouges-ternes');
  let n = 0; for (const it of rouges) { if (await ev(() => __game.S.q.feuilles.st) !== 'active') break; n += await grab(await ev(k => { const q = __game.G.pickups.find(q => q.key === k); return q ? { x: q.x, z: q.z, key: k } : null; }, it.key) || it) ? 1 : 0; }
  ok((await ev(() => __game.S.q.feuilles.st)) === 'ready', 'feuilles : 10 rouges → objectif atteint (' + n + ' ramassées)');
  await talk(); await btn('MERCI'); await close();
  ok((await ev(() => __game.S.q.feuilles.st)) === 'done', 'feuilles : terminée');

  // ---------- vieilles parties ----------
  const ns = await ev(() => { const s = __game.normSave({ q: { sirop: { st: 'active', n: 4 }, feuilles: { st: 'active', n: 5 }, tire_printemps: { st: 'active', n: 1 } }, taken: { 'c1,0:2': 1 } }); return { sirop: s.q.sirop, f: s.q.feuilles, t: s.q.tire_printemps }; });
  ok(Array.isArray(ns.sirop.keys) && ns.sirop.left === null && ns.sirop.n === 4 && ns.f.n === 5 && ns.t.n === 1, 'vieille partie en cours : progression gardée, minuterie au repos');

  ok(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(bad.length ? 'PÉPÈRE ÉCHEC (' + bad.length + ')' : 'PÉPÈRE OK');
  await b.close(); srv.close(); process.exit(bad.length ? 1 : 0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });

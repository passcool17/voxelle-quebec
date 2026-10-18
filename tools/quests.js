// Test fonctionnel des quêtes (raccourcis de téléportation) : permis B-52, sirop de Pépère, voleurs de poutine,
// contrat de village, boutique du dépanneur, Grand Chantier (boss). usage : PORT=8915 node tools/quests.js
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve'); const brain = require('./brain');
const PORT = +(process.env.PORT || 8915), SH = __dirname + '/../shots/';
(async () => {
  const srv = await serve(PORT);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [], res = {};
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const ev = (f, a) => p.evaluate(f, a);
  await p.goto(`http://localhost:${PORT}/`); await ev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'high', view: 4 })); }); await p.reload(); await p.waitForTimeout(2000);
  await p.click('#bNew'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 90000 }); await ev(brain);
  const tp = async (x, z) => { await ev(([x, z]) => { const P = __game.G.P; P.x = x; P.z = z; P.y = 90; P.vy = 0; window.__task = { type: 'idle' }; }, [x, z]);
    await p.waitForFunction(([x, z]) => __game.world.loadedAround(x, z, 1), [x, z], { timeout: 60000 });
    await ev(([x, z]) => { const P = __game.G.P; P.y = __game.world.ground(x, z) + 0.2; P.vy = 0; P.iT = 1; }, [x, z]); await p.waitForTimeout(2500); };
  const talk = async (role, near) => { if (near) await tp(near[0] + 3, near[1] + 3); await p.waitForTimeout(1500); const n = await ev(r => { for (const [, n] of __game.G.npcs) if (n.role === r) return [n.x, n.z]; return null; }, role); if (!n) return 'pas de PNJ ' + role;
    await tp(role === 'gaston' ? n[0] - 1.5 : n[0], role === 'gaston' ? n[1] : n[1] + 1.4); await ev(() => __game.pressed.add('KeyE')); await p.waitForTimeout(500); return await ev(() => __game.G.state); };
  const btn = async label => { if (!(await p.isVisible('#dialog'))) { console.log('pas de dialogue pour', label, await ev(() => __game.G.state)); return false; } const bs = await p.$$('#dbtns .btn'); for (const x of bs) if ((await x.textContent()).includes(label)) { await x.click(); await p.waitForTimeout(300); return true; } return false; };
  const fight = async (type, n, cond, maxS = 90) => { await ev(([t, n]) => { const P = __game.G.P; for (let i = 0; i < n; i++) __game.spawnEnemy(t, P.x + 5 + i * 1.5, P.z + 4); window.__task = { type: 'fight', pts: [] }; }, [type, n]);
    const end = Date.now() + maxS * 1000; while (Date.now() < end) { await p.waitForTimeout(500); if (await ev(c => eval(c), cond)) break; if (await ev(() => __game.G.state === 'dead')) { await p.click('#bRespawn'); return false; } } await ev(() => { window.__task = { type: 'idle' }; }); return await ev(c => eval(c), cond); };
  const gen = await ev(() => { const g = __game.gen, c = n => { const s = g.cell(...n); return [s.x, s.z]; }; return { ville: c([0, 0]), cabane: c([1, 0]), village: c([-1, 0]), grand: c([2, -1]) }; });
  // un peu plus costaud pour aller vite
  await ev(() => { const S = __game.S; S.lvl = 6; S.equip.arme = { id: 'pelle_alu', r: 2 }; S.inv.push({ id: 'tourtiere', n: 6 }); S.q.cones = { st: 'done', n: 6 }; __game.G.P.hp = 200; });
  // 1. permis
  res.permis_dlg = await talk('lapaperasse'); res.permis_acc = await btn('ACCEPTER');
  await ev(() => { __game.S.bureauKills = 2; });
  res.permis_kill = await fight('bureau', 1, "__game.G.pickups.some(p => p.kind === 'permis')");
  const pp = await ev(() => { const q = __game.G.pickups.find(p => p.kind === 'permis'); return q ? [q.x, q.z] : null; });
  if (pp) { await ev(([x, z]) => { const P = __game.G.P; P.x = x; P.z = z; }, pp); await p.waitForTimeout(1200); }
  res.permis_ready = await ev(() => __game.S.q.permis && __game.S.q.permis.st);
  await talk('lapaperasse'); await p.waitForTimeout(300); await btn('MERCI'); await ev(() => __game.closeDialog());
  res.permis_done = await ev(() => (__game.S.q.permis || {}).st === 'done' && __game.S.inv.some(i => i.id === 'tuque_patrimoine'));
  // 2. boutique
  await talk('commercant'); await btn('MAGASINER'); const cash0 = await ev(() => __game.S.cash);
  const sb = await p.$('.shop button'); if (sb) await sb.click(); await p.waitForTimeout(200);
  await p.screenshot({ path: SH + 'boutique.png' });
  res.shop = (await ev(() => __game.S.cash)) < cash0; await ev(() => __game.closeDialog());
  // 3. sirop
  res.sirop_dlg = await talk('pepere', gen.cabane); await p.screenshot({ path: SH + 'cabane_pepere.png' }); res.sirop_acc = await btn('ACCEPTER');
  const pails = await ev(() => __game.G.pickups.filter(p => p.kind === 'chaudiere').map(p => [p.x, p.z]));
  for (const [x, z] of pails.slice(0, 5)) { await ev(([x, z]) => { const P = __game.G.P; P.x = x; P.z = z; P.y = __game.world.ground(x, z); }, [x, z]); await p.waitForTimeout(700); }
  res.sirop_ready = await ev(() => __game.S.q.sirop && __game.S.q.sirop.st);
  await talk('pepere', gen.cabane); await btn('MERCI'); await ev(() => __game.closeDialog());
  res.sirop_done = await ev(() => (__game.S.q.sirop || {}).st === 'done');
  // 4. poutine + contrat au village
  res.poutine_dlg = await talk('ginette', gen.village); await p.screenshot({ path: SH + 'village_ginette.png' }); res.poutine_acc = await btn('ACCEPTER');
  res.poutine_kill = await fight('raton', 4, "(__game.S.q.poutine || {}).st === 'ready'");
  await talk('ginette', gen.village); await btn('MERCI'); await ev(() => __game.closeDialog());
  res.poutine_done = await ev(() => (__game.S.q.poutine || {}).st === 'done');
  await talk('aubergiste'); res.contrat_acc = await btn('ACCEPTER');
  const ct = await ev(() => __game.S.contract && [__game.S.contract.target, __game.S.contract.n]);
  if (ct) res.contrat_kill = await fight(ct[0], ct[1], "__game.S.contract && __game.S.contract.st === 'ready'");
  await talk('aubergiste'); await btn('MERCI'); await ev(() => __game.closeDialog());
  res.contrat_done = await ev(() => __game.S.contract === null && __game.S.contractsDone === 1);
  // 5. Grand Chantier
  console.log('avant boss', JSON.stringify(res)); res.boss_talk = await talk('gaston', gen.ville); res.boss_acc = await btn('ACCEPTER');
  await ev(() => { const S = __game.S; S.lvl = 12; S.equip.arme = { id: 'baton_or', r: 2 }; __game.G.P.hp = 300; });
  await tp(gen.grand[0], gen.grand[1] + 18); await p.waitForTimeout(3000);
  await ev(() => { window.__task = { type: 'fight', pts: [] }; });
  let shot = false; const end = Date.now() + 240000;
  while (Date.now() < end) { await p.waitForTimeout(500); const s = await ev(() => ({ boss: !!__game.G.boss, dead: __game.S.bossDead, st: __game.G.state, hp: __game.G.boss ? Math.round(__game.G.boss.hp) : 0 }));
    if (s.boss && !shot && await ev(() => Math.hypot(__game.G.boss.x - __game.G.P.x, __game.G.boss.z - __game.G.P.z) < 7)) { await p.screenshot({ path: SH + 'boss.png' }); shot = true; }
    if (s.dead) break; if (s.st === 'dead') { await p.click('#bRespawn'); await ev(() => { __game.G.P.hp = 300; }); await tp(gen.grand[0], gen.grand[1] + 10); await ev(() => { window.__task = { type: 'fight', pts: [] }; }); } }
  res.boss_dead = await ev(() => __game.S.bossDead && (__game.S.q.supreme || {}).st === 'ready');
  console.log(JSON.stringify(res, null, 1));
  console.log(errs.length ? errs.slice(0, 20).join('\n') : 'aucune erreur JS');
  await b.close(); srv.close();
  process.exit(Object.values(res).every(v => v === true || v === 'dialog' || v === 'ready') && !errs.length ? 0 : 1);
})().catch(e => { console.error('ÉCHEC', e); process.exit(2); });
process.on('exit', () => {});

// Test du récit principal (phase 3) : chapitres 3 (mémo → Pépère), 5 (souffleuses), 6 (goélands, Chicoutimi),
// 7 (boss Comité du Grand Plan au chantier de la 175), journal. usage : PORT=8921 node tools/recit.js [préfixe]
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve'); const brain = require('./brain');
const PORT = +(process.env.PORT || 8921), PFX = process.argv[2] || 'recit-test', SH = __dirname + '/../shots/';
(async () => {
  const srv = await serve(PORT);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [], res = {};
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const ev = (f, a) => p.evaluate(f, a), W = ms => p.waitForTimeout(ms);
  await p.goto(`http://localhost:${PORT}/`); await ev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 4 })); }); await p.reload(); await W(2000);
  await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 90000 }); await ev(brain);
  const tp = async (x, z) => { await ev(([x, z]) => { const P = __game.G.P; P.x = x; P.z = z; P.y = 90; P.vy = 0; window.__task = { type: 'idle' }; }, [x, z]);
    await p.waitForFunction(([x, z]) => __game.world.loadedAround(x, z, 1), [x, z], { timeout: 90000 });
    await ev(([x, z]) => { const P = __game.G.P; P.y = __game.world.ground(x, z) + 0.2; P.vy = 0; P.iT = 1; }, [x, z]); await W(2500); };
  const talk = async (role, near) => { if (near) await tp(near[0] + 3, near[1] + 3); await W(1500); const n = await ev(r => { for (const [, n] of __game.G.npcs) if (n.role === r) return [n.x, n.z]; return null; }, role); if (!n) return 'pas de PNJ ' + role;
    await tp(n[0], n[1] + 1.4); await ev(r => { const P = __game.G.P; for (const [, o] of __game.G.npcs) if (o.role !== r && Math.hypot(o.x - P.x, o.z - P.z) < 4) { o.x += 6; o.home.x += 6; } }, role); await ev(() => __game.pressed.add('KeyE')); await W(600); return await ev(() => __game.G.state); };
  const btn = async label => { if (!(await p.isVisible('#dialog'))) return false; for (const x of await p.$$('#dbtns .btn')) if ((await x.textContent()).includes(label)) { await x.click(); await W(300); return true; } return false; };
  const close = () => ev(() => { if (__game.G.state === 'dialog') __game.closeDialog(); });
  const st = id => ev(id => (__game.S.q[id] || {}).st, id);
  const fight = async (type, n, cond, maxS = 150) => { await ev(([t, n]) => { const P = __game.G.P; for (let i = 0; i < n; i++) { const e = __game.spawnEnemy(t, P.x + 5 + i * 1.5, P.z + 4); e.state = 'chase'; } window.__task = { type: 'fight', pts: [] }; }, [type, n]);
    const end = Date.now() + maxS * 1000; while (Date.now() < end) { await W(500); if (await ev(c => eval(c), cond)) break; if (await ev(() => __game.G.state === 'dead')) { await p.click('#bRespawn'); await ev(() => { __game.G.P.hp = 400; }); } } await ev(() => { window.__task = { type: 'idle' }; }); return await ev(c => eval(c), cond); };
  const gen = await ev(() => { const g = __game.gen, c = n => { const s = g.cell(...n); return [s.x, s.z]; }, NP = g.nord.places; return { ville: c([0, 0]), cabane: c([1, 0]), port: [NP.port.x, NP.port.z], etape: [NP.etape.x, NP.etape.z], travaux: [NP.travaux.x, NP.travaux.z] }; });
  await ev(() => { const S = __game.S; S.lvl = 10; S.equip.arme = { id: 'pelle_alu', r: 2 }; S.inv.push({ id: 'tourtiere', n: 10 }); for (const k of ['cones', 'permis', 'supreme', 'nouvelles', 'pate']) S.q[k] = { st: 'done', n: 1 }; S.bossDead = true; __game.G.P.hp = 400; __game.G.spawnT = 1e9; });
  // journal avant
  await ev(() => __game.openPanel('quests')); await W(600); await p.screenshot({ path: SH + PFX + '-journal-debut.png' }); await ev(() => { document.getElementById('quests').classList.add('hidden'); __game.G.state = 'play'; });
  if (!process.env.SKIP) {
  // ch. 3 : mémo → Pépère
  res.memo_dlg = await talk('lapaperasse'); await p.screenshot({ path: SH + PFX + '-dialogue-memo.png' }); res.memo_acc = await btn('ACCEPTER'); await close();
  res.memo_item = await ev(() => __game.S.inv.some(i => i.id === 'memo'));
  res.memo_pepere = await talk('pepere', gen.cabane); await p.screenshot({ path: SH + PFX + '-dialogue-pepere.png' }); await btn('MERCI'); await close();
  res.memo_done = (await st('memo')) === 'done' && !(await ev(() => __game.S.inv.some(i => i.id === 'memo')));
  // ch. 5 : souffleuses
  await talk('lapaperasse', gen.ville); res.souf_acc = await btn('ACCEPTER'); await close();
  res.souf_kill = await fight('souffleuse', 4, "(__game.S.q.souffleuses || {}).st === 'ready'");
  await talk('lapaperasse', gen.ville); await btn('MERCI'); await close(); res.souf_done = (await st('souffleuses')) === 'done';
  } else { await ev(() => { const S = __game.S; S.q.memo = { st: 'done', n: 1 }; S.q.souffleuses = { st: 'done', n: 4 }; }); res.memo_done = res.souf_done = true; }
  // ch. 6 : goélands à Chicoutimi (lance-balles)
  await talk('saguenayen', gen.port); res.goel_acc = await btn('ACCEPTER'); await close();
  await ev(() => { __game.S.equip.arme = { id: 'lanceur', r: 2 }; });
  res.goel_kill = await fight('goeland', 5, "(__game.S.q.goelands || {}).st === 'ready'", 200);
  await ev(() => { __game.S.equip.arme = { id: 'pelle_alu', r: 2 }; });
  await talk('saguenayen', gen.port); await btn('MERCI'); await close(); res.goel_done = (await st('goelands')) === 'done';
  // ch. 7 : le Comité
  res.comite_dlg = await talk('cuisiniere', gen.etape); res.comite_acc = await btn('ACCEPTER'); await close();
  await ev(() => { __game.S.lvl = 14; __game.S.equip.arme = { id: 'baton_or', r: 2 }; __game.G.P.hp = 500; __game.G.spawnT = 0; });
  await tp(gen.travaux[0], gen.travaux[1] + 22); await W(3000);
  await ev(() => { window.__task = { type: 'fight', pts: [] }; window.__ph = []; setInterval(() => { const B = __game.G.boss; if (B && !__ph.includes(B.phase)) __ph.push(B.phase); }, 30); });
  let shot = 0; const end = Date.now() + 300000;
  while (Date.now() < end) { await W(500); const s = await ev(() => { const B = __game.G.boss, P = __game.G.P; return { boss: B ? B.type : null, d: B ? Math.hypot(B.x - P.x, B.z - P.z) : 99, dead: !!__game.S.comiteDead, st: __game.G.state, ph: B ? B.phase : 0 }; });
    if (s.boss === 'comite' && s.d < 9 && (shot === 0 || (shot === 1 && s.ph >= 2))) { await p.screenshot({ path: SH + PFX + '-comite' + (++shot) + '.png' }); }
    if (s.dead) break; if (s.st === 'dead') { await p.click('#bRespawn'); await ev(() => { __game.G.P.hp = 500; }); await tp(gen.travaux[0], gen.travaux[1] + 12); await ev(() => { window.__task = { type: 'fight', pts: [] }; }); } }
  res.comite_phases = await ev(() => window.__ph); res.comite_dead = await ev(() => !!__game.S.comiteDead && (__game.S.q.comite || {}).st === 'ready');
  await talk('cuisiniere', gen.etape); await btn('MERCI'); await close();
  res.comite_done = (await st('comite')) === 'done' && await ev(() => __game.S.inv.some(i => i.id === 'casque_or'));
  await ev(() => __game.openPanel('quests')); await W(600); await p.screenshot({ path: SH + PFX + '-journal-fin.png' });
  res.journal = await ev(() => document.querySelectorAll('#qbody .qitem.done').length);
  console.log(JSON.stringify(res, null, 1));
  const ok = res.memo_done && res.souf_done && res.goel_done && res.comite_done && res.comite_phases.includes(3) && res.journal >= 7;
  console.log(ok ? 'RÉCIT OK' : 'RÉCIT ÉCHEC'); console.log(errs.length ? errs.slice(0, 20).join('\n') : 'aucune erreur JS');
  await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
})().catch(e => { console.error('ÉCHEC', e); process.exit(2); });

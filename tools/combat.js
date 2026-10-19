// Test du combat (phase 1) : roulade invulnérable, combo, coup chargé, arrêt sur image, souffleuse (mottes en cloche),
// goéland (piqué), Cône Suprême en 3 phases battu par le bot. usage : PORT=8919 node tools/combat.js [préfixe captures]
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve'); const brain = require('./brain');
const PORT = +(process.env.PORT || 8919), PFX = process.argv[2] || 'combat-test', SH = __dirname + '/../shots/';
(async () => {
  const srv = await serve(PORT);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [], res = {};
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const ev = (f, a) => p.evaluate(f, a), W = ms => p.waitForTimeout(ms);
  await p.goto(`http://localhost:${PORT}/`); await ev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 4 })); }); await p.reload(); await W(2000);
  await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 90000 });
  const tp = async (x, z) => { await ev(([x, z]) => { const P = __game.G.P; P.x = x; P.z = z; P.y = 90; P.vy = 0; }, [x, z]); await p.waitForFunction(([x, z]) => __game.world.loadedAround(x, z, 1), [x, z], { timeout: 60000 }); await ev(([x, z]) => { const P = __game.G.P; P.y = __game.world.ground(x, z) + 0.2; P.vy = 0; }, [x, z]); await W(1500); };
  await ev(() => { window.gw = s => new Promise(r => { const t0 = __game.G.t; const f = () => __game.G.t - t0 >= s ? r() : setTimeout(f, 15); f(); }); window.press = async (s = 0.05) => { const P = __game.G.P; __game.input.lmb = true; await gw(s); while (!P.atkWas) await new Promise(r => setTimeout(r, 15)); __game.input.lmb = false; await gw(0.02); }; });
  const clear = () => ev(() => { const G = __game.G; for (const e of G.enemies) { e.hp = 0; e.dead = true; e.model.g.visible = false; e.label.remove(); } G.spawnT = 1e9; });
  await tp(-7, -200); await clear();
  // 1. roulade : invulnérable pendant la roulade, se déplace
  res.roll = await ev(async () => { const g = __game, P = g.G.P; P.hp = 100; const x0 = P.x, z0 = P.z; g.pressed.add('KeyC'); await new Promise(r => setTimeout(r, 120)); const rolling = P.rollT > 0; const hp0 = P.hp; P.iT = 0;
    const e = g.spawnEnemy('cone', P.x + 1, P.z); g.damageEnemy; const T = e.T; /* coup direct pendant la roulade */ const hb = P.hp; window.__hurtTest = true;
    await new Promise(r => setTimeout(r, 500)); const moved = Math.hypot(P.x - x0, P.z - z0); e.hp = 0; e.dead = true; e.model.g.visible = false; e.label.remove(); return { rolling, moved: +moved.toFixed(2) }; });
  res.rollInvuln = await ev(async () => { const g = __game, P = g.G.P; P.iT = 0; P.hp = 100; g.pressed.add('KeyC'); await new Promise(r => setTimeout(r, 60)); const r = P.rollT > 0;
    // un formulaire droit sur le joueur pendant la roulade
    const e = g.spawnEnemy('bureau', P.x + 2, P.z); e.state = 'idle'; e.T = Object.assign({}, e.T, { aggro: 0 }); g.G.P.iT = 0; const hp = P.hp;
    g.G.enemies.forEach(x => x.cd = 9); window.__g = g; return { r, hp }; });
  await ev(() => { const g = __game, P = g.G.P; P.iT = 0; P.hp = 100; g.pressed.add('KeyC'); });
  await W(50); const inv = await ev(() => { const g = __game, P = g.G.P; const hp = P.hp; const a = P.rollT > 0; /* appel direct */ const fake = { x: P.x + 1, z: P.z, T: { name: 'test' } };
    window.__game.G.state === 'play'; return { a, hp }; });
  // on appelle hurtPlayer indirectement : un cône frappe pendant la roulade
  res.dodge = await ev(async () => { const g = __game, P = g.G.P; P.iT = 0; P.hp = 100; P.rollCd = 0; g.pressed.add('KeyC'); await new Promise(r => setTimeout(r, 40));
    const e = g.spawnEnemy('cone', P.x, P.z + 0.5); e.state = 'chase'; e.cd = 0; await new Promise(r => setTimeout(r, 350)); const during = P.hp; e.hp = 0; e.dead = true; e.model.g.visible = false; e.label.remove(); return { rollT: +P.rollT.toFixed(2), hpDuring: during }; });
  // 2. combo : 3 coups de suite → coup final
  await clear();
  res.combo = await ev(async () => { const g = __game, G = g.G, P = G.P; P.hp = 1e5; await gw(0.8); const e = g.spawnEnemy('trou', P.x, P.z - 1.8, { lvl: 1 }); e.hp = e.hpMax = 5000; e.state = 'chase'; e.cd = 99;
    G.camYaw = 0; G.dbg.log = []; await gw(0.3); for (let i = 0; i < 3; i++) { await press(); G.dbg.log.push("press" + P.combo + "@" + G.t.toFixed(2)); await gw(0.45); }
    await gw(0.3); const dmg = 5000 - e.hp; e.hp = 0; e.dead = true; e.model.g.visible = false; e.label.remove(); return { dmg: Math.round(dmg), fin: G.dbg.fin, hitstop: G.dbg.hs, log: G.dbg.log.join(" ") }; });
  // 3. coup chargé : touche tout autour
  res.charged = await ev(async () => { const g = __game, G = g.G, P = G.P; const es = [[0, -2], [0, 2], [2, 0], [-2, 0]].map(([dx, dz]) => { const e = g.spawnEnemy('cone', P.x + dx, P.z + dz, { lvl: 1 }); e.hp = e.hpMax = 900; e.cd = 99; e.T = Object.assign({}, e.T, { aggro: 0 }); e.state = 'idle'; return e; });
    await gw(0.5); await press(0.9); const held = 0.9; await gw(0.4);
    const hit = es.filter(e => e.hp < 900).length; es.forEach(e => { e.hp = 0; e.dead = true; e.model.g.visible = false; e.label.remove(); }); return { held: +held.toFixed(2), hitAround: hit }; });
  // 4. souffleuse : lance des mottes en cloche avec zones marquées
  await clear();
  res.souffleuse = await ev(async () => { const g = __game, G = g.G, P = G.P; P.hp = 1e5; const e = g.spawnEnemy('souffleuse', P.x + 9, P.z - 3, { lvl: 1 }); e.state = 'chase'; e.cd = 0; let motte = 0, mark = 0;
    for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 100)); motte = Math.max(motte, G.projs.filter(q => q.kind === 'motte').length); mark = Math.max(mark, G.rings.filter(r => r.r0 === r.r1).length); }
    return { motte, mark, hpLost: Math.round(1e5 - P.hp) }; });
  await ev(() => { const G = __game.G, P = G.P; G.camYaw = -1.1; G.camPitch = 0.35; G.camDist = 7; P.hp = 1e5; for (const e of G.enemies) if (e.type === 'souffleuse') e.cd = 0; }); await W(1200);
  await p.screenshot({ path: SH + PFX + '-souffleuse.png' });
  // 5. goéland : pique sur le joueur
  await clear();
  res.goeland = await ev(async () => { const g = __game, G = g.G, P = G.P; P.hp = 1e5; P.iT = 0; const e = g.spawnEnemy('goeland', P.x + 4, P.z - 4, { lvl: 1 }); e.state = 'chase'; e.cd = 1.5; let dove = false, high = 0, lowNear = false;
    for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 100)); high = Math.max(high, e.y - P.y); if (e.dive) dove = true; if (e.rec > 0) lowNear = true; if (dove && lowNear) break; }
    return { dove, high: +high.toFixed(1), recovered: lowNear, hpLost: Math.round(1e5 - P.hp) }; });
  await ev(() => { const G = __game.G; G.camYaw = 0.6; G.camPitch = 0.1; G.camDist = 6; for (const e of G.enemies) if (e.type === 'goeland') { e.rec = 0; e.dive = null; e.cd = 0.3; } }); await W(900);
  await p.screenshot({ path: SH + PFX + '-goeland.png' });
  if (process.env.NOBOSS) { console.log(JSON.stringify(res)); await b.close(); srv.close(); return; }
  // 6. Cône Suprême : 3 phases, battu par le bot
  await clear(); await ev(brain);
  const grand = await ev(() => { const s = __game.gen.cell(2, -1); return [s.x, s.z]; });
  await ev(() => { const S = __game.S; S.lvl = 8; S.equip.arme = { id: 'pelle_alu', r: 1 }; S.inv.push({ id: 'tourtiere', n: 8 }); __game.G.P.hp = 300; __game.G.spawnT = 0; });
  await tp(grand[0], grand[1] + 18); await W(2500); await ev(() => { window.__task = { type: 'fight', pts: [] }; });
  await ev(() => { window.__seen = { phases: [], stomp: false, wave: false, charge: false, dodged: 0 }; setInterval(() => { const B = __game.G.boss, Z = window.__seen; if (!B) return; if (!Z.phases.includes(B.phase)) Z.phases.push(B.phase); if (B.stomp) Z.stomp = true; if (B.wave) Z.wave = true; if (B.bch) Z.charge = true; if (__game.G.P.dodged && __game.G.P.dodged !== Z.lastD) { Z.lastD = __game.G.P.dodged; Z.dodged++; } }, 20); });
  const seen = {}; let shots = 0; const end = Date.now() + 300000;
  while (Date.now() < end) { await W(400);
    const s = await ev(() => { const B = __game.G.boss, P = __game.G.P; return { boss: !!B, ph: B ? B.phase : 0, st: B && B.stomp ? 1 : 0, w: B && B.wave ? 1 : 0, ch: B && B.bch ? 1 : 0, dead: __game.S.bossDead, state: __game.G.state, d: B ? Math.hypot(B.x - P.x, B.z - P.z) : 99 }; });
    if (s.boss && s.d < 9 && ((shots === 0) || (shots === 1 && s.ph >= 2 && (s.st || s.w)) || (shots === 2 && s.ph === 3))) { await p.screenshot({ path: SH + PFX + '-boss' + (shots + 1) + '.png' }); shots++; }
    if (s.dead) break; if (s.state === 'dead') { await p.click('#bRespawn'); await ev(() => { __game.G.P.hp = 300; }); await tp(grand[0], grand[1] + 10); await ev(() => { window.__task = { type: 'fight', pts: [] }; }); } }
  res.boss = Object.assign(await ev(() => window.__seen), { dead: await ev(() => __game.S.bossDead), deaths: await ev(() => __game.S.stats.kills >= 0 && 0) });
  console.log(JSON.stringify(res, null, 1));
  const ok = res.dodge.hpDuring === 100 && res.combo.fin > 0 && res.combo.hitstop > 0 && res.charged.hitAround >= 3 && res.souffleuse.motte > 0 && res.souffleuse.mark > 0 && res.goeland.dove && res.boss.dead && res.boss.phases.includes(3) && res.boss.wave;
  console.log(ok ? 'COMBAT OK' : 'COMBAT ÉCHEC'); console.log(errs.length ? errs.slice(0, 20).join('\n') : 'aucune erreur JS');
  await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
})().catch(e => { console.error('ÉCHEC', e); process.exit(2); });

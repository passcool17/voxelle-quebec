// v6.1 : le compagnon — adopter Pistache (quête du chenil), le suivre (et téléportation), aide au combat, K.-O. puis retour,
// trésor déterré, apprivoiser Bandit (raton docile + poutine), changer à la cabane, sauvegarde/rechargement, téléphone.
// usage : PORT=8937 node tools/compagnon.js [préfixe captures]
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8937), PFX = process.argv[2] || 'apres-v6-compagnon', SH = __dirname + '/../shots/';
(async () => {
  const srv = await serve(PORT);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [], bad = [], ok = (c, msg) => { console.log((c ? 'ok   ' : 'ÉCHEC ') + msg); if (!c) bad.push(msg); };
  const mk = async opt => { const ctx = await b.newContext(opt); const p = await ctx.newPage(); p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); }); return p; };
  const p = await mk({ viewport: { width: 1280, height: 720 } });
  const ev = (f, a) => p.evaluate(f, a), W = ms => p.waitForTimeout(ms);
  const shot = async (n, pg = p) => { await pg.screenshot({ path: SH + PFX + '-' + n + '.png' }); console.log('capture', PFX + '-' + n + '.png'); };
  await p.goto(`http://localhost:${PORT}/`); await ev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 4 })); }); await p.reload(); await W(2000);
  await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 90000 });
  await ev(() => { const S = __game.S; S.tuto = -1; S.lvl = 6; S.q.cones = { st: 'done', n: 6 }; __game.G.P.hp = 400; __game.G.spawnT = 1e9; });
  const tp = async (x, z, wait = 900) => { await ev(([x, z]) => { const P = __game.G.P; P.x = x; P.z = z; P.y = 90; P.vy = 0; }, [x, z]);
    await p.waitForFunction(([x, z]) => __game.world.loadedAround(x, z, 1), [x, z], { timeout: 90000 });
    await ev(([x, z]) => { const P = __game.G.P; P.y = __game.world.ground(x, z) + 0.1; P.vy = 0; P.iT = 1; }, [x, z]); await W(wait); };
  const calm = () => ev(() => { const G = __game.G; G.P.hp = 400; G.P.iT = 99; for (const e of G.enemies) if (!e.dead) { e.hp = 0; e.dead = true; e.model.g.visible = false; e.label.remove(); } });
  const btn = async label => { if (!(await p.isVisible('#dialog'))) return false; for (const x of await p.$$('#dbtns .btn')) if ((await x.textContent()).includes(label)) { await x.click(); await W(300); return true; } return false; };
  const close = () => ev(() => { if (__game.G.state === 'dialog') __game.closeDialog(); });
  const V = await ev(() => { const s = __game.gen.cell(-1, 0); return { x: s.x, z: s.z }; });
  const talk = async role => { await tp(V.x + 2, V.z + 2, 1500); const n = await ev(r => { for (const [, n] of __game.G.npcs) if (n.role === r) return [n.x, n.z]; return null; }, role); if (!n) return null;
    await tp(n[0], n[1] + 1.4, 500); await ev(r => { const P = __game.G.P; for (const [, o] of __game.G.npcs) if (o.role !== r && Math.hypot(o.x - P.x, o.z - P.z) < 4) { o.x += 6; o.home.x += 6; } }, role);
    await ev(() => __game.pressed.add('KeyE')); await W(500); return ev(() => __game.G.state); };
  const pet = () => ev(() => { const p = __game.G.pet, P = __game.G.P; return p ? { kind: p.kind, d: +Math.hypot(p.x - P.x, p.z - P.z).toFixed(2), dy: +(p.y - P.y).toFixed(2), hp: p.hp, ko: +p.ko.toFixed(1), hits: p.hits, finds: p.finds, tps: p.tps, dig: !!p.dig, lbl: p.label.style.display !== 'none' && p.label.textContent } : null; });

  // ---------- 1. adopter Pistache ----------
  ok(await ev(() => !__game.G.pet && __game.S.comp && !__game.S.comp.act), 'nouvelle partie : pas de compagnon');
  ok((await talk('eleveuse')) === 'dialog', 'Mme Gagnon au village');
  ok(await ev(() => { for (const [, n] of __game.G.npcs) if (n.role === 'eleveuse') return !!n.dog; return false; }), 'Pistache attend au chenil (modèle à côté d’elle)');
  ok(await btn('ACCEPTER') && (await ev(() => (__game.S.q.chiot || {}).st)) === 'active', 'quête « Un chien pour la vie » acceptée'); await close();
  await ev(() => { const g = __game, P = g.G.P; for (let k = 0; k < 3; k++) { const e = g.spawnEnemy('raton', P.x + 3 + k, P.z + 3); g.damageEnemy(e, 9999, 0, 0, 0); } }); await W(400);
  ok((await ev(() => __game.S.q.chiot.st)) === 'ready', '3 ratons chassés');
  await talk('eleveuse'); await btn('MERCI'); await close(); await W(600);
  const p0 = await pet(); ok(p0 && p0.kind === 'chien' && (await ev(() => __game.S.comp.have.chien && __game.S.comp.act === 'chien')), 'Pistache adopté : ' + JSON.stringify(p0));
  ok(await ev(() => { for (const [, n] of __game.G.npcs) if (n.role === 'eleveuse') return !n.dog; return true; }), 'le chien n’est plus au chenil');
  // ---------- 2. il suit ----------
  await ev(() => { const G = __game.G; G.camYaw = 0; __game.keys.add('KeyW'); }); await W(3500); let q = await pet(); const dWalk = q.d; await ev(() => __game.keys.delete('KeyW'));
  await p.waitForFunction(() => { const p = __game.G.pet, P = __game.G.P; return Math.hypot(p.x - P.x, p.z - P.z) < 4.5 && p.label.style.display !== 'none'; }, null, { timeout: 10000 }).catch(() => {});
  q = await pet(); ok(q.d < 4.5 && Math.abs(q.dy) < 1.5, 'il suit en marchant : ' + dWalk + ' m en marche, ' + q.d + ' m à l’arrêt');
  await ev(() => { const G = __game.G; G.camYaw = G.P.yaw + 1.9; G.camPitch = 0.3; G.camDist = 5.5; }); await W(1200); await shot('chien-village');
  ok(q.lbl && /Pistache/.test(q.lbl), 'étiquette « ' + q.lbl + ' »');
  const tps0 = q.tps; const far = await ev(() => [__game.G.P.x + 60, __game.G.P.z + 10]); await tp(far[0], far[1], 1500);
  q = await pet(); ok(q.d < 3.5 && q.tps > tps0, 'trop loin → il te rejoint (téléporté) : ' + q.d + ' m');
  // ---------- 3. combat ----------
  await calm();
  await ev(() => { const g = __game, P = g.G.P; const e = g.spawnEnemy('cone', P.x + 3, P.z + 2, { lvl: 1 }); e.hp = e.hpMax = 400; e.state = 'chase'; window.__foe = e; });
  await p.waitForFunction(() => __game.G.pet.hits >= 2, null, { timeout: 25000 }).catch(() => {});
  q = await pet(); ok(q.hits >= 2 && (await ev(() => __foe.hp < 400)), 'il attaque l’ennemi qui te poursuit : ' + q.hits + ' coups (cône ' + (await ev(() => Math.round(__foe.hp))) + '/400)');
  await ev(() => { const G = __game.G, f = __foe, d = G.pet; G.camYaw = Math.atan2(d.z - f.z, -(d.x - f.x)); G.camPitch = 0.3; G.camDist = 5; G.P.x = (d.x + f.x) / 2 + Math.sin(G.camYaw) * 1.5; G.P.z = (d.z + f.z) / 2 + Math.cos(G.camYaw) * 1.5; }); await W(400); await shot('combat');
  await ev(() => { __game.G.pet.hp = 1; }); await p.waitForFunction(() => __game.G.pet.ko > 0, null, { timeout: 30000 }).catch(() => {});
  q = await pet(); ok(q.ko > 0 && /K\.-O\./.test(await ev(() => __game.G.pet.nm.textContent)), 'K.-O. (' + q.ko + ' s), pas de mort');
  await calm(); await ev(() => { __game.G.pet.ko = 0.3; }); await W(1200);
  q = await pet(); ok(q.ko <= 0 && q.hp === 70, 'il revient à lui, PV pleins (' + q.hp + ')');
  // ---------- 4. trésor ----------
  await tp(V.x + 30, V.z + 25, 1500); await calm();
  const cash0 = await ev(() => __game.S.cash);
  ok(await ev(() => __game.petSniff()), 'il renifle quelque chose (coin marqué)');
  ok(await ev(() => !!(__game.G.pet.dig && __game.G.pet.dig.mark)), 'chien : cercle au sol dès qu’il sent');
  await p.waitForFunction(() => __game.G.pet.dig && __game.G.pet.dig.t > 0.8, null, { timeout: 15000 }).catch(() => {});
  await ev(() => { const G = __game.G, d = G.pet; G.camYaw = Math.atan2(G.P.x - d.x, G.P.z - d.z) + 0.5; G.camPitch = 0.45; G.camDist = 4.5; G.P.iT = 99; }); await W(200); await shot('tresor');
  await p.waitForFunction(() => __game.G.pet.finds >= 1, null, { timeout: 15000 }).catch(() => {});
  q = await pet(); const nP = await ev(() => __game.G.pickups.filter(p => p.kind === 'piasse').length);
  ok(q.finds >= 1 && nP >= 3, 'trésor déterré : ' + nP + ' piles de piasses au sol');
  await ev(() => { const G = __game.G, P = G.P; for (const p of G.pickups) if (p.kind === 'piasse' || p.kind === 'gear') { p.x = P.x; p.z = P.z; p.y = P.y + 0.8; } }); await W(1200);
  ok((await ev(() => __game.S.cash)) > cash0, 'butin ramassé : +' + ((await ev(() => __game.S.cash)) - cash0) + ' $');
  // ---------- 5. apprivoiser Bandit ----------
  await calm();
  const tame = await ev(async () => { const g = __game, P = g.G.P; const e = g.spawnEnemy('raton', P.x + 2, P.z, { lvl: 1 }); e.hp = Math.ceil(e.hpMax * 0.36) + 1; g.damageEnemy(e, 2, 0, 0, 0); window.__rat = e; await new Promise(r => setTimeout(r, 300)); return { st: e.state, hp: e.hp }; });
  ok(tame.st === 'docile', 'raton à bout de forces → docile (' + JSON.stringify(tame) + ')');
  await ev(() => { const P = __game.G.P, e = __rat; P.x = e.x + 1.2; P.z = e.z; e.docile = 30; }); await W(600);
  const pr = await ev(() => document.getElementById('prompt').textContent); ok(/Apprivoiser/.test(pr), 'invite « ' + pr + ' »');
  const pout0 = await ev(() => __game.S.inv.filter(i => i.id === 'poutine').reduce((a, i) => a + (i.n || 1), 0));
  await ev(() => __game.pressed.add('KeyE')); await W(600);
  ok(await ev(() => __game.S.comp.have.raton && __game.S.comp.act === 'chien'), 'Bandit apprivoisé (va à la cabane : Pistache reste actif)');
  ok((await ev(() => __game.S.inv.filter(i => i.id === 'poutine').reduce((a, i) => a + (i.n || 1), 0))) === pout0 - 1, 'une poutine donnée');
  // ---------- 6. changer à la cabane ----------
  await ev(() => __game.homeSetup()); const H = await ev(() => ({ x: (__game.H.x0 + __game.H.ix0) / 2, z: (__game.H.z0 + __game.H.iz0) / 2, x0: __game.H.x0, z0: __game.H.z0 }));
  await tp(H.x0 + 1.5, H.z0 + 1.5, 1500);
  const use = await ev(() => document.getElementById('prompt').textContent); ok(/Changer de compagnon/.test(use), 'à ta cabane : « ' + use + ' »');
  await ev(() => __game.pressed.add('KeyE')); await W(1200);
  q = await pet(); ok(q && q.kind === 'raton' && (await ev(() => __game.S.comp.act)) === 'raton', 'Bandit t’accompagne maintenant');
  await ev(() => { const G = __game.G; G.camYaw = G.P.yaw + 2.2; G.camPitch = 0.3; G.camDist = 4.5; }); await W(1200); await shot('raton');
  // raton : chipe des piasses aux ennemis battus près de lui
  await ev(async () => { const g = __game, P = g.G.P; g.G.petSteals = 0; for (let k = 0; k < 8; k++) { const e = g.spawnEnemy('cone', g.G.pet.x + 1, g.G.pet.z + 1, { lvl: 1 }); g.damageEnemy(e, 9999, 0, 0, 0); } });
  ok((await ev(() => __game.G.petSteals)) >= 1, 'raton : chipe des piasses (' + (await ev(() => __game.G.petSteals)) + ' fois sur 8)');
  // ---------- 7. sauvegarde / rechargement ----------
  await ev(() => __game.writeSave()); await p.reload(); await W(2500);
  await p.click('#bCont'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 90000 }); await W(2500);
  q = await pet(); ok(q && q.kind === 'raton' && (await ev(() => __game.S.comp.have.chien && __game.S.comp.have.raton)), 'rechargé : Bandit actif, les deux adoptés');
  const ns = await ev(() => { const s = __game.normSave({ q: {} }); const s2 = __game.normSave({ q: {}, comp: { have: { chien: true }, act: 'raton' } }); return [s.comp, s2.comp]; });
  ok(ns[0].act === null && typeof ns[0].have === 'object' && ns[1].act === null, 'vieille partie sans compagnon / incohérente : normalisée ' + JSON.stringify(ns));
  // ---------- 8. téléphone ----------
  const m = await mk({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await m.goto(`http://localhost:${PORT}/`); await m.evaluate(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 3, fsAuto: false })); }); await m.reload(); await m.waitForTimeout(2500);
  await m.tap('#bNew'); await m.tap('#bPersoGo'); await m.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  await m.evaluate(() => { const g = __game; g.S.tuto = -1; g.G.spawnT = 1e9; g.petGive('chien'); g.G.dirtyQ = true; }); await m.waitForTimeout(4500);
  await m.evaluate(() => { const G = __game.G; G.camYaw = G.P.yaw + 2.3; G.camPitch = 0.35; G.camDist = 4.5; }); await m.waitForTimeout(1000); await shot('mobile', m);
  await m.evaluate(() => { const g = __game, P = g.G.P; const e = g.spawnEnemy('raton', P.x + 1.5, P.z - 1, { lvl: 1 }); e.hp = Math.ceil(e.hpMax * 0.36) + 1; g.damageEnemy(e, 2, 0, 0, 0); e.docile = 30; e.vx = e.vz = 0; g.G.camPitch = 0.35; g.G.camDist = 5; }); await m.waitForTimeout(1500);
  const mb = await m.evaluate(() => { const t = document.getElementById('tTalk'), p = __game.G.pet, P = __game.G.P; return { hid: t.classList.contains('hidden'), txt: t.textContent, pet: !!p, d: p && +Math.hypot(p.x - P.x, p.z - P.z).toFixed(1) }; });
  ok(mb.pet && mb.d < 4 && !mb.hid && mb.txt === 'APPRIVOISE', 'téléphone : Pistache suit (' + mb.d + ' m), bouton « ' + mb.txt + ' » près du raton docile');
  await m.tap('#tTalk'); await m.waitForTimeout(600);
  ok(await m.evaluate(() => __game.S.comp.have.raton), 'téléphone : le bouton apprivoise Bandit');
  ok(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(bad.length ? 'COMPAGNON ÉCHEC (' + bad.length + ')' : 'COMPAGNON OK');
  await b.close(); srv.close(); process.exit(bad.length ? 1 : 0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });

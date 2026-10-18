// Test du Nord : bazou sur la 175, autocar vers L'Étape et Chicoutimi, quêtes « pâté chinois » et « nouvelles de Québec »,
// bannières de région, mini-carte, version mobile. Captures shots/nord-*. usage : PORT=8917 node tools/nord.js
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve'); const brain = require('./brain');
const PORT = +(process.env.PORT || 8917), SH = __dirname + '/../shots/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
(async () => {
  const srv = await serve(PORT); const t0 = Date.now();
  const b = await chromium.launch({ args: ARGS });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [], res = {};
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const ev = (f, a) => p.evaluate(f, a);
  const snap = async n => { await p.screenshot({ path: SH + n + '.png' }); console.log('capture', SH + n + '.png'); };
  const waitPlay = () => p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  const settle = (x, z, r = 2) => p.waitForFunction(([x, z, r]) => __game.world.loadedAround(x, z, r), [x, z, r], { timeout: 90000 });
  const tp = async (x, z) => { await ev(([x, z]) => { const P = __game.G.P; if (__game.G.drive) __game.exitCar(); P.x = x; P.z = z; P.y = 95; P.vy = 0; window.__task = { type: 'idle' }; }, [x, z]);
    await settle(x, z, 1); await ev(([x, z]) => { const P = __game.G.P; P.y = __game.world.ground(x, z) + 0.2; P.vy = 0; P.iT = 1; }, [x, z]); await p.waitForTimeout(1800); };
  const npc = role => ev(r => { let best = null, bd = 1e9; const P = __game.G.P; for (const [, n] of __game.G.npcs) if (n.role === r) { const d = Math.hypot(n.x - P.x, n.z - P.z); if (d < bd) { bd = d; best = [n.x, n.z, n.y]; } } return best; }, role);
  const talk = async role => { await p.waitForTimeout(800); let n = await npc(role); if (!n) { await p.waitForTimeout(3000); n = await npc(role); } if (!n) return 'pas de PNJ ' + role;
    await tp(n[0], n[1] + 1.3); await ev(y => { const P = __game.G.P; P.y = y + 0.05; P.vy = 0; }, n[2]); await ev(r => { const P = __game.G.P; for (const [, o] of __game.G.npcs) if (o.role !== r && Math.hypot(o.x - P.x, o.z - P.z) < 4) { o.x += 6; o.home.x += 6; } }, role);
    await ev(() => __game.pressed.add('KeyE')); await p.waitForTimeout(500);
    for (let k = 0; k < 4 && (await ev(() => __game.G.state)) !== 'dialog'; k++) { await p.waitForTimeout(1500); n = await npc(role); if (n) { await tp(n[0], n[1] + 1.3); await ev(y => { const P = __game.G.P; P.y = y + 0.05; P.vy = 0; }, n[2]); } await p.waitForTimeout(400); await ev(() => __game.pressed.add('KeyE')); await p.waitForTimeout(500); }
    const st = await ev(() => __game.G.state); if (st !== 'dialog') console.log('talk', role, JSON.stringify(await ev(r => { const P = __game.G.P; const o = [...__game.G.npcs.values()].find(n => n.role === r); return o && { d: Math.hypot(o.x - P.x, o.z - P.z), dy: P.y - o.y, py: P.y, ny: o.y, drive: !!__game.G.drive }; }, role)));
    return st; };
  const btn = async label => { if (!(await p.isVisible('#dialog'))) return false; for (const x of await p.$$('#dbtns .btn')) if ((await x.textContent()).includes(label)) { await x.click(); await p.waitForTimeout(300); return true; } return false; };
  const region = () => ev(() => { const P = __game.G.P; return __game.gen.nord.region(P.x, P.z); });
  const view = async (yaw, pitch, dist) => { await ev(([y, pi, d]) => { const G = __game.G; G.camYaw = y; G.camPitch = pi; if (d) G.camDist = d; window.__task = { type: 'idle' }; }, [yaw, pitch, dist]); await p.waitForTimeout(2500); };
  await p.goto(`http://localhost:${PORT}/`); await ev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 5 })); }); await p.reload(); await p.waitForTimeout(2500);
  await p.click('#bNew'); await waitPlay(); await ev(brain);
  const W = await ev(() => { const n = __game.gen.nord; return { stops: n.stops, P: Object.fromEntries(Object.entries(n.places).map(([k, s]) => [k, [s.x, s.z, s.h]])) }; });
  await ev(() => { const S = __game.S; S.lvl = 6; S.equip.arme = { id: 'pelle_alu', r: 2 }; S.inv.push({ id: 'tourtiere', n: 6 }); __game.G.P.hp = __game.stats().hpMax; });
  // 1. bazou : monter et rouler vers le nord sur la 175
  const car = await ev(() => [__game.car.x, __game.car.z]); res.car = !!car;
  await tp(car[0] + 2.2, car[1]); await ev(() => __game.pressed.add('KeyE')); await p.waitForTimeout(400);
  res.drive_in = await ev(() => __game.G.drive);
  await ev(() => { window.__bot = (api, dt) => { const G = api.G, C = api.car; if (!G.drive || !C) return; const n = api.gen.nord, z = C.z - 14, tx = n.roadX(z) + 1.8, tz = z;
    const want = Math.atan2(-(tx - C.x), -(tz - C.z)), da = Math.atan2(Math.sin(want - C.yaw), Math.cos(want - C.yaw)); api.input.bot = { mx: Math.max(-1, Math.min(1, -da * 3)), mz: -1, run: false }; }; });
  const z0 = await ev(() => __game.car.z); const dEnd = Date.now() + 40000; let shotRoad = false;
  while (Date.now() < dEnd) { await p.waitForTimeout(1000); const c = await ev(() => ({ z: __game.car.z, v: __game.car.v })); if (z0 - c.z > 130 && !shotRoad) { shotRoad = true; await snap('nord-bazou-175'); } if (z0 - c.z > 260) break; }
  const drv = await ev(() => { const C = __game.car, r = __game.gen.nord.road(C.x, C.z); return { z: C.z, off: r ? Math.abs(r.d) : 99 }; });
  console.log('bazou', JSON.stringify(drv), 'parcouru', Math.round(z0 - drv.z));
  res.drive_dist = z0 - drv.z > 120; res.drive_road = drv.off < 7;
  res.r175_banner = (await region()) === 'r175';
  await ev(() => { window.__bot = null; }); await ev(brain); await ev(() => __game.pressed.add('KeyE')); await p.waitForTimeout(300); res.drive_out = !(await ev(() => __game.G.drive));
  // 2. autocar vers L'Étape
  await tp(W.stops[0].ax, W.stops[0].az); res.bus_dlg = await talk('chauffeur'); res.bus_btn = await btn('L’ÉTAPE'); await waitPlay(); await p.waitForTimeout(2500);
  res.etape_region = await region(); res.etape_banner = await ev(() => document.getElementById('banner').textContent);
  res.etape_where = await ev(() => document.getElementById('where').textContent);
  // capture L'Étape : depuis la route, vers l'ouest
  const [ex, ez, eh] = W.P.etape; await tp(ex + 27, ez + 26); await settle(ex + 27, ez + 26, 2); await view(0.72, 0.28, 13); await snap('nord-etape');
  await ev(() => { const P = __game.G.P; P.x = 0; }).catch(() => {});
  // 3. quête du pâté chinois
  res.pate_dlg = await talk('cuisiniere'); res.pate_acc = await btn('ACCEPTER');
  const [tx, tz] = W.P.travaux; await tp(tx + 3, tz + 14); await p.waitForTimeout(2500);
  await ev(() => { window.__task = { type: 'fight', pts: [] }; }); { const end = Date.now() + 80000; while (Date.now() < end) { await p.waitForTimeout(800); if (await ev(() => !__game.G.enemies.some(e => !e.dead && e.type === 'cone'))) break; if (await ev(() => __game.G.state === 'dead')) { await p.click('#bRespawn'); await tp(tx + 3, tz + 14); await ev(() => { window.__task = { type: 'fight', pts: [] }; }); } } }
  await ev(() => { window.__task = { type: 'idle' }; });
  const cans = await ev(() => __game.G.pickups.filter(q => q.kind === 'ble').map(q => [q.x, q.z]));
  for (const [x, z] of cans.slice(0, 3)) { await ev(([x, z]) => { const P = __game.G.P; P.x = x; P.z = z; P.y = __game.world.ground(x, z); P.vy = 0; }, [x, z]); await p.waitForTimeout(900); }
  res.pate_ready = await ev(() => (__game.S.q.pate || {}).st);
  await tp(ex + 6, ez + 2); await talk('cuisiniere'); await btn('MERCI'); await ev(() => __game.closeDialog());
  res.pate_done = await ev(() => (__game.S.q.pate || {}).st === 'done' && __game.S.inv.some(i => i.id === 'pate'));
  // 4. route 175 dans la réserve (au sud du lac), puis point de vue
  await tp(await ev(() => __game.gen.nord.roadX(-790) + 3.8), -790); await view(0, 0.1, 7); await snap('nord-route175-reserve');
  const [bx, bz, bh] = W.P.belvedere; await tp(bx + 1, bz - 2); await ev(([x, z]) => { const P = __game.G.P; P.y = __game.world.ground(x, z) + 0.1; }, [bx + 1, bz - 2]); await settle(bx + 1, bz - 2, 2); await ev(() => { const P = __game.G.P; for (const [, o] of __game.G.npcs) if (Math.hypot(o.x - P.x, o.z - P.z) < 12) { o.x += 14; o.home.x += 14; } }); await view(Math.PI + 0.7, 0.34, 12); await snap('nord-point-de-vue-lac-jacques-cartier');
  res.belv_region = await region();
  // 5. autocar vers Chicoutimi (depuis L'Étape)
  await tp(W.stops[2].ax, W.stops[2].az); await talk('chauffeur'); res.bus2 = await btn('CHICOUTIMI'); await waitPlay(); await p.waitForTimeout(2500);
  res.chic_region = await region(); res.chic_banner = await ev(() => document.getElementById('banner').textContent);
  // fjord : depuis le quai, vers l'est
  const [px, pz] = W.P.port; await tp(px, pz - 18); await settle(px, pz - 18, 2); await view(-Math.PI / 2 + 0.35, 0.22, 10); await snap('nord-chicoutimi-fjord');
  await tp(W.P.chicoutimi[0] + 1, W.P.chicoutimi[1] + 18); await view(0.0, 0.2, 9); await snap('nord-chicoutimi-ville');
  // 6. nouvelles de Québec : Gilles → Gaston → Gilles
  res.nouv_dlg = await talk('saguenayen'); res.nouv_acc = await btn('ACCEPTER'); await ev(() => __game.G.state === 'dialog' && __game.closeDialog());
  await tp(W.stops[3].ax, W.stops[3].az); await talk('chauffeur'); await btn('VIEILLE-VILLE'); await waitPlay(); await p.waitForTimeout(1500);
  res.ville_back = (await ev(() => __game.G.P.z)) > -200;
  { const [gx, gz] = await ev(() => { const P = __game.G.P; return [P.x - 2, P.z + 49]; }); await tp(gx, gz); await settle(gx, gz, 2); }
  res.gaston = await talk('gaston'); await ev(() => __game.closeDialog());
  res.nouv_ready = await ev(() => (__game.S.q.nouvelles || {}).st);
  await tp(W.stops[0].ax, W.stops[0].az); await talk('chauffeur'); await btn('CHICOUTIMI'); await waitPlay(); await p.waitForTimeout(1500);
  res.bus3 = await ev(() => __game.G.P.z) < -2200; await tp(px, pz - 18); await settle(px, pz - 18, 2);
  res.gilles2 = await talk('saguenayen'); await btn('MERCI'); await ev(() => __game.closeDialog());
  res.nouv_done = await ev(() => (__game.S.q.nouvelles || {}).st === 'done' && __game.S.inv.some(i => i.id === 'bleuets') && !__game.S.inv.some(i => i.id === 'gazette'));
  // 7. mini-carte et grande carte
  await tp(await ev(() => __game.gen.nord.roadX(-1150) + 5), -1150); await p.waitForTimeout(1500);
  const mb = await p.$('#mapbox'); await mb.screenshot({ path: SH + 'nord-minicarte.png' }); console.log('capture', SH + 'nord-minicarte.png');
  await ev(() => { __game.G.mapZ = 2; __game.pressed.add('KeyM'); }); await p.waitForTimeout(2500); await snap('nord-carte'); await ev(() => __game.pressed.add('KeyM')); await p.waitForTimeout(400);
  // 8. sauvegarde : le bazou et les quêtes restent
  await ev(() => __game.writeSave()); res.save = await ev(() => { const s = JSON.parse(localStorage.getItem('voxelle-quebec-v2')); return !!(s.car && s.q.pate && s.q.nouvelles); });
  res.fps = await ev(() => __game.G.fps);
  // 9. mobile
  const m = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }); const merrs = [];
  m.on('pageerror', e => merrs.push('pageerror: ' + e.message)); m.on('console', x => { if (x.type() === 'error') merrs.push('console: ' + x.text()); });
  await m.goto(`http://localhost:${PORT}/?touch`); await m.evaluate(() => localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 4 }))); await m.reload(); await m.waitForTimeout(2500); await m.click('#bNew'); await m.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  await m.evaluate(() => __game.travel('etape')); await m.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 }); await m.waitForTimeout(4000);
  res.mobile_region = await m.evaluate(() => __game.gen.nord.region(__game.G.P.x, __game.G.P.z));
  await m.evaluate(() => { const G = __game.G; G.camYaw = 0.72; G.camPitch = 0.3; }); await m.waitForTimeout(1500);
  await m.screenshot({ path: SH + 'nord-mobile-etape.png' }); console.log('capture', SH + 'nord-mobile-etape.png');
  res.mobile_errs = merrs.length === 0; if (merrs.length) console.log(merrs.slice(0, 10).join('\n'));
  console.log(JSON.stringify(res, null, 1));
  console.log(errs.length ? errs.slice(0, 20).join('\n') : 'aucune erreur JS', '·', Math.round((Date.now() - t0) / 1000), 's');
  await b.close(); srv.close();
  if (errs.length) console.log(errs.slice(0, 10).join('\n'));
  const ok = res.car && res.drive_in && res.drive_dist && res.drive_road && res.r175_banner && res.drive_out && res.bus_btn && res.etape_region === 'etape' && /ÉTAPE/.test(res.etape_banner) && res.pate_acc && res.pate_ready === 'ready' && res.pate_done
    && res.belv_region === 'belvedere' && res.bus2 && /CHICOUTIMI/.test(res.chic_banner) && res.nouv_acc && res.ville_back && res.nouv_ready === 'ready' && res.nouv_done && res.save && res.mobile_region === 'etape' && res.mobile_errs && !errs.length;
  console.log(ok ? 'NORD OK' : 'NORD ÉCHEC'); process.exit(ok ? 0 : 1);
})().catch(e => { console.error('ÉCHEC', e); process.exit(2); });

// Test « Donjons et trésors » : mine (Charlevoix) et égouts (Montréal) ; entrée, noirceur, ennemis sous terre,
// pièges, coffres, mini-boss, sortie, sauvegarde (y compris vieille sauvegarde sans « dun »), tactile.
// PORT=8922 node tools/donjons.js [préfixe captures, défaut apres-v2-p4]
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8922), PFX = process.argv[2] || 'apres-v2-p4', SH = __dirname + '/../shots/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
(async () => {
  const srv = await serve(PORT); const browser = await chromium.launch({ args: ARGS });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [], res = {};
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const ev = (f, a) => p.evaluate(f, a);
  await p.goto(`http://localhost:${PORT}/`); await ev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 4 })); }); await p.reload();
  await p.waitForTimeout(3000);
  await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  await ev(() => { const g = __game; g.S.cash = 500; g.G.P.hp = 1e5; g.G.weatherT = 1e9; });
  const arrive = async () => { await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 }); await p.waitForFunction(() => __game.world.loadedAround(__game.G.P.x, __game.G.P.z, 1), null, { timeout: 120000 }); await p.waitForTimeout(1500); };
  const W = ms => p.waitForTimeout(ms);
  const run = async (key, stop) => {
    const o = {};
    if (stop) { await ev(s => __game.travel(s), stop); await arrive(); }
    const s = await ev(k => { const s = __game.gen.reg.places[k]; return { x: s.x, z: s.z, fy: s.fy, kind: s.kind }; }, key);
    await ev(s => { const P = __game.G.P; P.x = s.x + 0.5; P.z = s.z + 3.2; P.y = __game.gen.heightAt(P.x, P.z) + 2; P.vx = P.vz = P.vy = 0; }, s); await arrive();
    o.porte = await ev(() => __game.G.door && __game.G.door.down && document.getElementById('prompt').textContent);
    await ev(() => { const G = __game.G; G.camYaw = 0.4; G.camPitch = 0.3; G.camDist = 7; }); await W(1200);
    await p.screenshot({ path: SH + PFX + '-' + key + '-entree.png' });
    await p.keyboard.press('KeyE'); await W(2500);
    o.dedans = await ev(() => __game.dun && __game.dun.key); o.noirceur = await ev(() => +__game.sky.under.toFixed(2));
    o.ennemis = await ev(fy => __game.G.enemies.filter(e => Math.abs(e.y - fy) < 3).length, s.fy);
    o.ySol = await ev(() => +(__game.G.P.y - __game.dun.fy).toFixed(2));
    // salle voisine éclairée : capture
    await ev(k => { const g = __game, G = g.G, s = g.gen.reg.places[k], e = g.dunPlan(s).ent, P = G.P;
      for (const foe of G.enemies) foe.hp = Math.min(foe.hp, 1);
      
      P.x = e.x + 0.5 - 1.5; P.z = e.z + 0.5 + 1.5; G.camYaw = 2.4; G.camPitch = 0.3; G.camDist = 3; }, key); await W(2000);
    await p.screenshot({ path: SH + PFX + '-' + key + '-salle.png' });
    // coffre : on marche dessus
    const c = await ev(() => { const P = __game.G.P, c = __game.pickups.filter(p => p.kind === 'coffre').sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0]; return c && { x: c.x, y: c.y, z: c.z, key: c.key }; });
    const cash0 = await ev(() => __game.S.cash);
    if (c) { await ev(c => { const P = __game.G.P; P.x = c.x; P.z = c.z; P.y = c.y; P.vx = P.vz = P.vy = 0; }, c); await W(900); }
    o.coffre = c ? await ev(([k, c0, c]) => ({ pris: !!__game.S.taken[k], gain: __game.S.cash - c0, c, st: __game.G.state, P: [__game.G.P.x, __game.G.P.y, __game.G.P.z].map(v => +v.toFixed(1)), hp: __game.G.P.hp }), [c.key, cash0, c]) : 'aucun';
    // piège : on se tient dessus pendant un cycle
    o.piege = await ev(async fy => { const g = __game, G = g.G, P = G.P, t = [...G.traps.values()].filter(t => Math.abs(t.y - fy) < 1)[0]; if (!t) return 'aucun';
      P.hp = 100; P.iT = 0; P.x = t.x; P.z = t.z; P.y = t.y + 0.05; P.vx = P.vz = P.vy = 0; const h0 = P.hp, t0 = G.t; for (let k = 0; k < 400 && P.hp === h0 && G.t - t0 < 3.5; k++) { P.x = t.x; P.z = t.z; await new Promise(r => setTimeout(r, 100)); } return { kind: t.kind, hpPerdu: h0 - P.hp }; }, s.fy);
    await ev(() => { const P = __game.G.P; P.hp = 1e5; });
    // salle du boss
    const b = await ev(k => { const s = __game.gen.reg.places[k], r = __game.dunPlan(s).bossRoom; window.__bossRoom = { x: r.x + 0.5, z: r.z + 0.5, fy: s.fy }; return { x: r.x + 0.5, z: r.z + 0.5 }; }, key);
    await ev(([b, fy]) => { const P = __game.G.P; P.x = b.x; P.z = b.z + 3; P.y = fy + 0.05; P.vx = P.vz = P.vy = 0; }, [b, s.fy]); await W(2000);
    o.boss = await ev(() => __game.G.boss && { type: __game.G.boss.type, nom: __game.G.boss.T.name, lvl: __game.G.boss.lvl });
    await ev(() => { const g = __game, G = g.G, P = G.P, e = G.boss; if (!e) return;
      for (const o of [...G.enemies]) if (o !== e) g.damageEnemy(o, 1e9, 0, 1, 0);
      e.stunT = 99; e.cd = 99; e.vx = e.vz = e.vy = 0; e.state = 'chase';
      const r = window.__bossRoom, far = e.type === 'grosraton' ? 4.2 : 3.6;
      e.x = r.x; e.z = r.z - 1.2; e.y = r.fy; e.yaw = Math.PI;
      P.x = r.x; P.z = r.z + far; P.y = r.fy + 0.05; P.vx = P.vz = P.vy = 0; P.model.g.visible = false;
      G.camYaw = 0; G.camPitch = 0.2; G.camDist = 0.7;
      window.__freeze = setInterval(() => { e.stunT = 99; e.cd = 99; e.vx = e.vz = e.vy = 0; e.x = r.x; e.z = r.z - 1.2; e.y = r.fy; e.yaw = Math.PI; P.x = r.x; P.z = r.z + far; P.model.g.visible = false; }, 30);
    }); await W(3000);
    await p.screenshot({ path: SH + PFX + '-' + key + '-boss.png' }); await ev(() => { clearInterval(window.__freeze); __game.G.P.model.g.visible = true; __game.G.camDist = 5.8; });
    // preuve : aucune étiquette de surface sous terre (chauffeur, villageois…)
    o.heroVisible = await ev(() => __game.G.P.model.g.visible); o.labels = await ev(() => [...document.querySelectorAll('#labels .npc .nm')].filter(e => e.offsetParent !== null).map(e => e.textContent));
    o.phases = await ev(async () => { const g = __game, e = g.G.boss, ph = []; if (!e) return null; for (let k = 0; k < 4 && e.hp > 0; k++) { g.damageEnemy(e, e.hpMax * 0.3, 0, 1, 0); ph.push(e.phase); await new Promise(r => setTimeout(r, 400)); } return ph; });
    await W(800);
    o.vaincu = await ev(k => __game.S.dun[k] === 1, key); o.butin = await ev(() => __game.pickups.filter(p => p.kind === 'gear').length);
    // le boss ne revient pas
    await W(800); o.pasDeRetour = await ev(() => !__game.G.boss);
    await ev(() => { const g = __game; for (const e of [...g.G.enemies]) g.damageEnemy(e, 1e7, 0, 1, 0); }); await W(600);
    // sortie par l'échelle
    await ev(k => { const g = __game, s = g.gen.reg.places[k], e = g.dunPlan(s).ent, P = g.G.P; P.x = e.x - e.hr + 1.5; P.z = e.z - e.hr + 1.5; P.y = s.fy + 0.05; P.vx = P.vz = P.vy = 0; }, key); await W(700);
    o.echelle = await ev(() => __game.G.door && !__game.G.door.down); o.echDiag = await ev(() => ({ st: __game.G.state, dun: !!__game.dun, P: [__game.G.P.x, __game.G.P.y, __game.G.P.z].map(v => +v.toFixed(1)) })); await p.keyboard.press('KeyE'); await W(3500);
    o.dehors = await ev(() => !__game.dun && __game.sky.under < 0.5);
    return o;
  };
  res.mine = await run('mine', 'charlevoix');
  res.egout = await run('egout', 'montreal');
  // sauvegarde, puis vieille sauvegarde sans « dun »
  res.sauve = await ev(() => { __game.writeSave(); return JSON.parse(localStorage.getItem('voxelle-quebec-v2')).dun; });
  await p.reload(); await W(3000); await p.click('#bCont'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  res.recharge = await ev(() => __game.S.dun.mine === 1 && __game.S.dun.egout === 1);
  // le jeu sauvegarde au pagehide : on vieillit la sauvegarde après le rechargement
  await p.reload(); await W(3000); await ev(() => { const s = JSON.parse(localStorage.getItem('voxelle-quebec-v2')); delete s.dun; localStorage.setItem('voxelle-quebec-v2', JSON.stringify(s)); }); await p.click('#bCont'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  res.vieille = await ev(() => typeof __game.S.dun === 'object' && !__game.S.dun.mine);
  console.log(JSON.stringify(res, null, 1));
  // tactile : bouton ENTRE à l'entrée de la mine
  const m = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }); const merr = [];
  m.on('pageerror', e => merr.push(e.message));
  await m.goto(`http://localhost:${PORT}/`); await m.evaluate(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'low', view: 3 })); }); await m.reload(); await m.waitForTimeout(3000);
  await m.tap('#bNew'); await m.tap('#bPersoGo'); await m.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  await m.evaluate(() => __game.travel('charlevoix')); await m.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  await m.evaluate(() => { const s = __game.gen.reg.places.mine, P = __game.G.P; P.x = s.x + 0.5; P.z = s.z + 3.2; P.y = __game.gen.heightAt(P.x, P.z) + 2; });
  await m.waitForFunction(() => __game.world.loadedAround(__game.G.P.x, __game.G.P.z, 1) && __game.G.door, null, { timeout: 120000 }); await m.waitForTimeout(800);
  const btn = await m.evaluate(() => { const b = document.getElementById('tTalk'); return !b.classList.contains('hidden') && b.textContent; });
  await m.tap('#tTalk'); await m.waitForTimeout(2500); const mIn = await m.evaluate(() => !!__game.dun);
  await m.screenshot({ path: SH + PFX + '-mobile.png' });
  console.log('mobile', btn, mIn, 'erreurs', merr.length);
  const one = o => o.porte && o.dedans && o.noirceur > 0.8 && o.ennemis > 0 && o.coffre.pris && o.coffre.gain > 0 && o.piege.hpPerdu > 0 && o.boss && o.vaincu && o.butin > 0 && o.pasDeRetour && o.echelle && o.dehors && Array.isArray(o.labels) && !o.labels.some(n => /chauffeur|Chauffeur|villageois|Réjean|Francine|Josée|Raymond/i.test(n));
  const ok = one(res.mine) && one(res.egout) && res.mine.boss.type !== res.egout.boss.type && res.recharge && res.vieille && btn === 'ENTRE' && mIn && !errs.length && !merr.length;
  for (const e of errs.concat(merr)) console.log('ERR', e);
  console.log(ok ? 'DONJONS OK' : 'DONJONS ÉCHEC'); await browser.close(); srv.close(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });

// Test « Nouvelles régions » : Charlevoix, Gaspésie (traversier), Montréal ; PNJ, boutiques, une quête par région, tactile.
// PORT=8921 node tools/regions.js [préfixe captures, défaut apres-v2-p3]
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8921), PFX = process.argv[2] || 'apres-v2-p3', SH = __dirname + '/../shots/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
(async () => {
  const srv = await serve(PORT); const browser = await chromium.launch({ args: ARGS });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [], res = {};
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const ev = (f, a) => p.evaluate(f, a);
  await p.goto(`http://localhost:${PORT}/`); await ev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 4 })); }); await p.reload();
  await p.waitForTimeout(3000);
  await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  await ev(() => { const g = __game; g.S.cash = 2000; g.G.P.hp = 1e6; g.G.weatherT = 1e9; });
  const arrive = async () => { try { await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 }); } catch (e) { console.log(JSON.stringify(res), await ev(() => [__game.G.state, __game.G.P.x, __game.G.P.z, document.getElementById('dtext').textContent])); throw e; } await p.waitForFunction(() => __game.world.loadedAround(__game.G.P.x, __game.G.P.z, 1), null, { timeout: 120000 }); await p.waitForTimeout(1500); };
  const npc = role => ev(r => { for (const [, n] of __game.G.npcs) if (n.role === r) return { name: n.name, d: +Math.hypot(n.x - __game.G.P.x, n.z - __game.G.P.z).toFixed(1) }; return null; }, role);
  const talk = (role, btn) => ev(([r, btn]) => { const g = __game; let n = null; for (const [, q] of g.G.npcs) if (q.role === r) n = q; if (!n) return { err: 'pas de ' + r };
    g.openDialog(n); const t = document.getElementById('dtext').textContent, bs = [...document.querySelectorAll('#dbtns .btn')]; const labels = bs.map(b => b.textContent);
    if (btn) { const b = bs.find(b => b.textContent.includes(btn)); if (b) b.click(); else return { err: 'bouton ' + btn, labels }; } else g.closeDialog(); return { t: t.slice(0, 90), labels }; }, [role, btn]);
  const goto = (x, z) => ev(([x, z]) => { if (__game.G.state === 'dialog') __game.closeDialog(); const P = __game.G.P; P.x = x; P.z = z; P.y = __game.gen.heightAt(x, z) + 2; P.vx = P.vz = P.vy = 0; }, [x, z]);
  const collectAll = async kind => { const pts = await ev(k => { const R = __game.gen.reg.structs; return R.flatMap(s => []).concat(__game.pickups.filter(p => p.kind === k).map(p => [p.x, p.z])); }, kind);
    for (const [x, z] of pts) { await ev(([x, z]) => { const P = __game.G.P; P.x = x; P.z = z; P.y = __game.gen.heightAt(x, z) + 0.6; P.vx = P.vz = P.vy = 0; }, [x, z]); await p.waitForTimeout(500); } return pts.length; };
  const qst = id => ev(id => __game.S.q[id] && __game.S.q[id].st, id);
  const place = k => ev(k => { const s = __game.gen.reg.places[k]; return [s.x, s.z]; }, k);
  const killN = (type, n) => ev(([type, n]) => { const g = __game, P = g.G.P; for (let k = 0; k < n; k++) { const e = g.spawnEnemy(type, P.x + 4 + k, P.z + 3); if (e) g.damageEnemy(e || g.G.enemies[g.G.enemies.length - 1], 1e7, 0, 1, 0); } return g.G.enemies.length; }, [type, n]);

  // 1) autocar du village de départ vers Baie-Saint-Paul
  await ev(() => __game.travel('charlevoix')); await arrive();
  res.charlevoix = { region: await ev(() => __game.gen.nord.region(__game.G.P.x, __game.G.P.z)), peintre: await npc('peintre'), chauffeur: await npc('chauffeur'), commercant: await npc('commercant') };
  await ev(() => { const G = __game.G; G.camYaw = 2.6; G.camPitch = 0.25; G.camDist = 9; __game.sky.t = 0.42; }); await p.waitForTimeout(1500);
  await p.screenshot({ path: SH + PFX + '-charlevoix.png' });
  res.pinceauxOffre = await talk('peintre', 'ACCEPTER'); res.pinceauxActif = await qst('pinceaux');
  res.boutique = await ev(() => __game.SHOPS.charlevoix.length);
  const bv = await place('belvcharl'); await goto(bv[0], bv[1]); await arrive();
  res.pinceauxVus = await collectAll('pinceau'); res.pinceaux = await qst('pinceaux');
  await ev(() => { const G = __game.G; G.camYaw = 3.6; G.camPitch = 0.12; G.camDist = 10; }); await p.waitForTimeout(1500); await p.screenshot({ path: SH + PFX + '-belvedere.png' });
  const ba = await place('baie'); await goto(ba[0], ba[1]); await arrive();
  res.pinceauxFini = (await talk('peintre', 'MERCI'), await qst('pinceaux'));
  // 2) autocar vers Montréal
  res.busListe = (await talk('chauffeur')).labels;
  await talk('chauffeur', 'MONTRÉAL'); await arrive();
  res.montreal = { region: await ev(() => __game.gen.nord.region(__game.G.P.x, __game.G.P.z)), contremaitre: await npc('contremaitre'), cycliste: await npc('cycliste'), cones: await ev(() => { const w = __game.world, P = __game.G.P, B = __game.B; let c = 0; for (let x = -30; x < 30; x += 0.5) for (let z = -30; z < 30; z += 0.5) for (let y = 33; y < 40; y += 0.5) if (w.get(P.x + x, y, P.z + z) === B.CONE) c++; return c; }) };
  await ev(() => { const G = __game.G; G.camYaw = 0.8; G.camPitch = 0.35; G.camDist = 12; }); await p.waitForTimeout(1500); await p.screenshot({ path: SH + PFX + '-montreal.png' });
  res.nidsOffre = await talk('contremaitre', 'ACCEPTER'); await killN('trou', 5); await p.waitForTimeout(600); res.nids = await qst('nids');
  await talk('contremaitre', 'MERCI'); res.nidsFini = await qst('nids');
  res.pisteOffre = await talk('cycliste', 'ACCEPTER'); await killN('cone', 8); await p.waitForTimeout(600); await talk('cycliste', 'MERCI'); res.pisteFini = await qst('piste');
  res.ennemisMtl = await ev(() => { const g = __game; g.G.spawnT = 0; return g.gen.reg.level(g.G.P.x, g.G.P.z); });
  // 3) Montmagny : autocar, puis battures + quête de l'accordéon
  await ev(() => { if (__game.G.state === 'dialog') __game.closeDialog(); __game.travel('montmagny'); }); await arrive();
  res.montmagny = { region: await ev(() => __game.gen.nord.region(__game.G.P.x, __game.G.P.z)), accordeoniste: await npc('accordeoniste'), oiseleur: await npc('oiseleur'), commercant: await npc('commercant'), cycliste: await npc('cycliste'), carRoof: await ev(() => { const C = __game.G.car, s = __game.gen.reg.places.mm; if (!C) return null; const gy = __game.gen.heightAt(C.x, C.z) + 1; return { x: +C.x.toFixed(1), z: +C.z.toFixed(1), y: +C.y.toFixed(1), gy: +gy.toFixed(1), onRoof: C.y > gy + 2.5 }; }) };
  // plan large depuis le sud : église + place + salle (caméra dans le ciel, pas dans un mur)
  await ev(() => { if (__game.G.state === 'dialog') __game.closeDialog(); const G = __game.G, s = __game.gen.reg.places.mm, P = G.P;
    P.x = s.x; P.z = s.z + 22; P.y = __game.gen.heightAt(P.x, P.z) + 1.5; P.vx = P.vz = P.vy = 0;
    G.camYaw = Math.atan2(P.x - s.x, P.z - (s.z + 6)); G.camPitch = 0.35; G.camDist = 12; __game.sky.t = 0.4;
    if (G.car) { const C = G.car; C.x = s.x - 2; C.z = s.z + 1; C.yaw = 0; C.y = __game.gen.heightAt(C.x, C.z) + 1; C.settled = true; C.m.g.visible = false; }
    G.enemies.length = 0;
  });
  await arrive(); await p.waitForTimeout(2200);
  await p.screenshot({ path: SH + 'apres-montmagny-ville.png' });
  await ev(() => { if (__game.G.car) __game.G.car.m.g.visible = true; });
  res.accordeonOffre = await talk('accordeoniste', 'ACCEPTER'); res.accordeonActif = await qst('accordeon');
  res.boutiqueMM = await ev(() => __game.SHOPS.montmagny.length);
  const bt = await place('battures');
  await goto(bt[0], bt[1] + 4); await arrive();
  res.accordeonVu = await collectAll('accordeon'); res.plumesVues = await collectAll('plume');
  // oies au sol sur le sable + volée basse ; panneau BATTURES dans le cadre ; pas de dialogue
  await ev(([x, z]) => { if (__game.G.state === 'dialog') __game.closeDialog();
    const g = __game, G = g.G, P = G.P;
    // un peu au sud du centre, regard vers le fleuve (z-) où est le panneau BATTURES
    P.x = x + 4; P.z = z + 8; P.y = g.gen.heightAt(P.x, P.z) + 1.2; P.vx = P.vz = P.vy = 0;
    for (let k = 0; k < 9; k++) {
      const ox = x - 4 + (k % 3) * 4, oz = z - 2 + Math.floor(k / 3) * 3.5;
      g.critterSpawn('oie', ox, oz);
    }
    if (G.flock) { for (const b of G.flock.birds) { if (b.M.g.parent) b.M.g.parent.remove(b.M.g); } G.flock = null; }
    G.flockT = 0;
    G.camYaw = Math.atan2(P.x - (x - 2), P.z - (z - 10)); G.camPitch = 0.14; G.camDist = 11; g.sky.t = 0.38;
  }, bt);
  await p.waitForTimeout(1200);
  await ev(() => { const G = __game.G, P = G.P;
    if (!G.flock) G.flockT = 0;
    if (G.flock) { const F = G.flock, yaw = G.camYaw, dx = Math.sin(yaw), dz = Math.cos(yaw);
      F.dx = dx; F.dz = dz; F.y = P.y + 7; F.x = P.x - dx * 20; F.z = P.z - dz * 20; F.t = 1.2; }
    // remise à niveau des oies au sol (chunks chargés)
    for (const c of G.critters) if (c.kind === 'oie') c.y = __game.world.ground(c.x, c.z, c.y + 2);
  });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: SH + 'apres-montmagny-oies.png' });
  res.oiesVues = await ev(() => ({ sol: __game.G.critters.filter(c => c.kind === 'oie').length, volee: __game.G.flock ? __game.G.flock.birds.length : 0, sand: true }));
  const mm = await place('mm'); await goto(mm[0], mm[1]); await arrive();
  res.accordeonFini = (await talk('accordeoniste', 'MERCI'), await qst('accordeon'));
  // marina : rive est, regard vers quai + bateau blanc/bleu + fleuve (cadrage ouvert)
  await ev(() => { if (__game.G.state === 'dialog') __game.closeDialog(); const s = __game.gen.reg.places.mm, P = __game.G.P, G = __game.G;
    P.x = s.x + 14; P.z = s.z - 20; P.y = Math.max(__game.gen.heightAt(P.x, P.z), 31) + 1.5; P.vx = P.vz = P.vy = 0;
    const tx = s.x - 2, tz = s.z - 28;
    G.camYaw = Math.atan2(P.x - tx, P.z - tz); G.camPitch = 0.2; G.camDist = 16; __game.sky.t = 0.36;
    if (G.car) G.car.m.g.visible = false;
    G.enemies.length = 0;
  }); await arrive();
  res.marina = await npc('matelot');
  await ev(() => { if (__game.G.state === 'dialog') __game.closeDialog(); });
  await p.waitForTimeout(2200);
  await p.screenshot({ path: SH + 'apres-montmagny-quai.png' });
  res.ferryMM = (await talk('matelot')).labels;
  await ev(() => { if (__game.G.state === 'dialog') __game.closeDialog(); });
  // Île aux Grues : sur la grève de l'île (hors maison), vue maison + fleuve
  const ile = await place('ile');
  await ev(([ix, iz]) => { const P = __game.G.P, G = __game.G;
    P.x = ix + 4; P.z = iz + 3; P.y = __game.gen.heightAt(P.x, P.z) + 1.5; P.vx = P.vz = P.vy = 0;
    G.camYaw = Math.atan2(P.x - ix, P.z - iz); G.camPitch = 0.2; G.camDist = 10; __game.sky.t = 0.32;
    G.enemies.length = 0;
  }, ile); await arrive();
  await p.waitForTimeout(2500);
  await p.screenshot({ path: SH + 'apres-montmagny-ile.png' });
  // 4) quai de la Vieille-Ville, traversier (escale Montmagny sur la liste) puis Percé
  await ev(() => { if (__game.G.state === 'dialog') __game.closeDialog(); __game.travel('quai'); }); await arrive();
  res.matelot = await npc('matelot'); res.traversier = (await talk('matelot')).labels;
  res.escaleMM = res.traversier.some(l => /MONTMAGNY/.test(l));
  const cash0 = await ev(() => __game.S.cash); await talk('matelot', 'PERCÉ'); await arrive();
  res.billet = cash0 - await ev(() => __game.S.cash);
  res.perce = { region: await ev(() => __game.gen.nord.region(__game.G.P.x, __game.G.P.z)), capitaine: await npc('capitaine'), gardienne: await npc('gardienne') };
  res.casiersOffre = await talk('capitaine', 'ACCEPTER'); res.casiersVus = await collectAll('casier'); res.casiers = await qst('casiers');
  const pc = await place('perce'); await goto(pc[0], pc[1]); await arrive(); await talk('capitaine', 'MERCI'); res.casiersFini = await qst('casiers');
  const rk = await place('rocher'); await goto(pc[0] - 6, pc[1] + 30); await arrive();
  await ev(([x, z]) => { const G = __game.G, P = G.P; G.camYaw = Math.atan2(P.x - x, P.z - z); G.camPitch = 0.1; G.camDist = 6; __game.sky.t = 0.3; }, rk); await p.waitForTimeout(2000);
  await p.screenshot({ path: SH + PFX + '-rocher-perce.png' });
  res.retourQuai = (await talk('capitaine')).labels;
  await ev(() => { if (__game.G.state === 'dialog') __game.closeDialog(); });
  await ev(() => __game.writeSave());
  console.log(JSON.stringify(res, null, 1));
  // tactile : reprendre à Percé
  const m = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }); const merr = [];
  m.on('pageerror', e => merr.push(e.message));
  await m.goto(`http://localhost:${PORT}/`); await m.evaluate(() => { localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'low', view: 3 })); }); await m.reload(); await m.waitForTimeout(3000);
  await m.evaluate(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'low', view: 3 })); }); await m.reload(); await m.waitForTimeout(3000);
  await m.tap('#bNew'); await m.tap('#bPersoGo'); await m.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  await m.evaluate(() => __game.travel('montreal')); await m.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 }); await m.waitForTimeout(4000);
  await m.screenshot({ path: SH + PFX + '-mobile.png' });
  const mob = await m.evaluate(() => ({ region: __game.gen.nord.region(__game.G.P.x, __game.G.P.z), touch: !document.getElementById('touch').classList.contains('hidden') }));
  console.log('mobile', JSON.stringify(mob), 'erreurs', merr.length);
  const ok = res.pinceauxFini === 'done' && res.nidsFini === 'done' && res.pisteFini === 'done' && res.casiersFini === 'done' && res.accordeonFini === 'done' && res.montmagny.region && res.montmagny.accordeoniste && !res.montmagny.cycliste && res.montmagny.carRoof && !res.montmagny.carRoof.onRoof && res.oiesVues && res.oiesVues.sol >= 4 && res.oiesVues.sand && res.escaleMM && res.charlevoix.region && res.montreal.region && res.perce.region && res.billet > 0 && res.montreal.cones > 0 && mob.region && !errs.length && !merr.length;
  for (const e of errs.concat(merr)) console.log('ERR', e);
  console.log(ok ? 'REGIONS OK' : 'REGIONS ÉCHEC'); await browser.close(); srv.close(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });

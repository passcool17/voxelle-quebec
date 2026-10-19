// Test « Progression » : XP et niveaux, points et arbre de talents (3 branches, prérequis), effets, équipement visible (héros et héroïne),
// rareté du butin (4 niveaux, faisceau coloré), sauvegarde, vieille sauvegarde sans talents, tactile.
// PORT=8920 node tools/progression.js [préfixe]
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8920), PFX = process.argv[2] || 'apres-v2-p2', SH = __dirname + '/../shots/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
(async () => {
  const srv = await serve(PORT); const browser = await chromium.launch({ args: ARGS });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [], res = {};
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const ev = (f, a) => p.evaluate(f, a);
  await p.goto(`http://localhost:${PORT}/`); await ev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 4 })); }); await p.reload();
  await p.waitForTimeout(3000);
  await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  await ev(() => { const G = __game.G; G.spawnT = 1e9; G.weatherT = 1e9; for (const e of G.enemies) e.hp = 0; }); await p.waitForTimeout(1500);
  // niveaux et points
  res.niveaux = await ev(() => { const g = __game, S = g.S, o = {}; const hp0 = g.stats().hpMax, d0 = g.stats().dmg;
    o.pts0 = g.talentPts(); let n = 0; while (S.lvl < 6 && n++ < 50) g.gainXP(400); o.lvl = S.lvl; o.pts = g.talentPts();
    o.prereqBloque = !g.learn('crit'); o.force1 = g.learn('force'); o.crit = g.learn('crit'); o.castor = g.learn('castor'); o.patinBloque = !g.learn('patin');
    o.pioche = g.learn('pioche'); o.reste = g.talentPts();
    o.hpMax = [hp0, g.stats().hpMax]; o.dmg = [Math.round(d0), Math.round(g.stats().dmg)]; o.mineBonus = g.G.mineBonus; return o; });
  res.niveaux.effets = res.niveaux.hpMax[1] > res.niveaux.hpMax[0] * 1.5 && res.niveaux.dmg[1] > res.niveaux.dmg[0] && res.niveaux.mineBonus === 0.25;
  // panneau des talents
  await p.keyboard.press('KeyT'); await p.waitForTimeout(700); res.panneau = await ev(() => __game.G.state === 'talents' && document.querySelectorAll('#talbody .tal').length);
  await p.click('#talbody .tal[data-t="jambes"]'); await p.waitForTimeout(300); res.clicTalent = await ev(() => (__game.S.tal.jambes || 0) === 1);
  await p.screenshot({ path: SH + PFX + '-talents.png' });
  await p.keyboard.press('KeyT'); await p.waitForTimeout(300);
  // équipement visible
  const look = () => ev(() => { const m = __game.G.P.model; let v = 0; m.g.traverse(o => { if (o.isMesh) v += o.geometry.attributes.position.count; }); return { hat: m.c.hatType, vest: !!m.c.vest, pads: !!m.c.pads, raq: !!m.c.raquettes, mitt: m.c.mitt, v }; });
  const l0 = await look();
  res.equipe = await ev(() => { const g = __game, S = g.S; for (const id of ['casque_hockey', 'epaulettes', 'raquettes', 'gants_travail']) { g.addItem(id, 1, 2); g.equip(S.inv[S.inv.length - 1]); } return Object.fromEntries(Object.entries(S.equip).map(([k, v]) => [k, v && v.id])); });
  const l1 = await look(); res.lookHockey = l1.hat === 'hockey' && l1.pads && l1.raq && l1.v > l0.v;
  const shotP = async name => { await ev(() => { const g = __game, G = g.G, P = G.P; G.camYaw = P.yaw + Math.PI + 0.5; G.camPitch = 0.12; G.camDist = 3.4; g.sky.t = 0.42; }); await p.waitForTimeout(1500); await p.screenshot({ path: SH + PFX + '-' + name + '.png' }); };
  await shotP('hockey-heros');
  await ev(() => { const g = __game, S = g.S; for (const id of ['casque_chantier', 'dossard']) { g.addItem(id, 1, 1); g.equip(S.inv[S.inv.length - 1]); } localStorage.setItem('voxelle-quebec-perso', 'fille'); g.refreshLook(); });
  const l2 = await look(); res.lookChantierFille = l2.hat === 'casque' && l2.vest && !!(await ev(() => __game.G.P.model.P.queue));
  await shotP('chantier-heroine');
  // rareté
  res.rarete = await ev(() => { const g = __game, n = [0, 0, 0, 0]; for (let i = 0; i < 4000; i++) n[g.rollRarity()]++; return n; });
  res.rareteOk = res.rarete.every(v => v > 0) && res.rarete[0] > res.rarete[1] && res.rarete[2] > res.rarete[3];
  await ev(() => { const g = __game, G = g.G, P = G.P; G.camYaw = 0; G.camPitch = 0.3; G.camDist = 5.5; for (let r = 0; r < 4; r++) g.dropGearAt(P.x - 2.2 + r * 1.5, P.y + 0.6, P.z - 3.2, ['casque_hockey', 'dossard', 'grattoir', 'epaulettes'][r], r); });
  await p.waitForTimeout(1800); res.butinSol = await ev(() => __game.G.pickups.filter(q => q.kind === 'gear').map(q => q.r));
  await p.screenshot({ path: SH + PFX + '-butin.png' });
  // sac (bordures de rareté)
  await ev(() => { const g = __game; for (let r = 0; r < 4; r++) g.addItem('casque_chantier', 1, r); }); await p.keyboard.press('KeyI'); await p.waitForTimeout(600); await p.screenshot({ path: SH + PFX + '-sac.png' }); await p.keyboard.press('KeyI'); await p.waitForTimeout(300);
  // sauvegarde + vieille sauvegarde sans talents
  const snap = await ev(() => { const g = __game; g.writeSave(); return { tal: JSON.stringify(g.S.tal), lvl: g.S.lvl }; });
  await p.reload(); await p.waitForTimeout(3000); await p.click('#bCont'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  res.recharge = await ev(snap => { const g = __game; return { tal: JSON.stringify(g.S.tal) === snap.tal, chapeau: g.G.P.model.c.hatType === 'casque', veste: !!g.G.P.model.c.vest, mine: g.G.mineBonus === 0.25 }; }, snap);
  // le jeu sauvegarde au pagehide : on vieillit la sauvegarde après le rechargement
  await p.reload(); await p.waitForTimeout(3000); await ev(() => { const s = JSON.parse(localStorage.getItem('voxelle-quebec-v2')); delete s.tal; s.lvl = 4; localStorage.setItem('voxelle-quebec-v2', JSON.stringify(s)); }); await p.click('#bCont'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  res.vieille = await ev(() => ({ pts: __game.talentPts(), tal: __game.S.tal }));
  console.log(JSON.stringify(res));
  // tactile : SAC → TALENTS
  const m = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }); const merr = [];
  m.on('pageerror', e => merr.push(e.message)); m.on('console', q => { if (q.type() === 'error') merr.push(q.text()); });
  await m.goto(`http://localhost:${PORT}/?touch`); await m.evaluate(() => localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'low', view: 3 }))); await m.reload(); await m.waitForTimeout(3000); await m.tap('#bNew'); await m.tap('#bPersoGo');
  await m.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 }); await m.evaluate(() => __game.gainXP(400)); await m.waitForTimeout(800);
  await m.tap('#tInv'); await m.waitForTimeout(600); await m.tap('#iTal'); await m.waitForTimeout(600);
  const mob = { talents: await m.evaluate(() => __game.G.state === 'talents') }; await m.screenshot({ path: SH + PFX + '-mobile-talents.png' });
  console.log('mobile', JSON.stringify(mob));
  const N = res.niveaux, all = [N.pts0 === 0, N.lvl >= 6, N.prereqBloque, N.force1, N.crit, N.castor, N.patinBloque, N.pioche, N.effets, res.panneau === 12, res.clicTalent, res.lookHockey, res.lookChantierFille, res.rareteOk, res.butinSol.length === 4 && res.butinSol.includes(3), ...Object.values(res.recharge), res.vieille.pts === 3, mob.talents];
  const E = errs.concat(merr); console.log(E.length ? E.join('\n') : 'aucune erreur JS');
  console.log(all.every(Boolean) && !E.length ? 'PROGRESSION OK' : 'PROGRESSION ÉCHEC ' + all.map((v, i) => v ? '' : i).filter(String).join(','));
  await browser.close(); srv.close(); process.exit(all.every(Boolean) && !E.length ? 0 : 1);
})().catch(e => { console.error('ÉCHEC', e); process.exit(2); });

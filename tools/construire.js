// Test « Construire et miner » : dureté et outils, minerais, atelier (main / établi), flambeaux, sauvegarde, vieille sauvegarde, tactile.
// PORT=8919 node tools/construire.js [préfixe captures, défaut apres-v2-p1]
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8919), PFX = process.argv[2] || 'apres-v2-p1', SH = __dirname + '/../shots/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
(async () => {
  const srv = await serve(PORT); const browser = await chromium.launch({ args: ARGS });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [], res = {};
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const ev = (f, a) => p.evaluate(f, a);
  await p.goto(`http://localhost:${PORT}/`); await ev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 4 })); }); await p.reload();
  await p.waitForTimeout(3000);
  await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  // champ dégagé à l'ouest du village de départ
  await ev(() => { const g = __game, G = g.G, P = G.P; G.spawnT = 1e9; G.weatherT = 1e9; for (const e of G.enemies) e.hp = 0; P.x = g.gen.VX - 80; P.z = g.gen.VZ - 70; P.y = g.gen.heightAt(P.x, P.z) + 3; P.hp = 1e6; window.__sc = [P.x, P.z]; });
  await p.waitForFunction(() => __game.world.loadedAround(__sc[0], __sc[1], 1), null, { timeout: 120000 });
  await p.waitForFunction(() => __game.G.P.ground, null, { timeout: 60000 }); await p.waitForTimeout(1000);
  console.log('sol', await ev(() => { const g = __game, P = g.G.P, c = g.gen.column(Math.floor(P.x), Math.floor(P.z)); return [P.x, P.y, P.z, c.biome, g.world.get(P.x, P.y - 0.25, P.z)]; }));
  // vise le sol devant soi
  const aim = () => ev(() => { const G = __game.G; G.camPitch = 0.85; G.camDist = 3.2; });
  await aim(); await p.waitForTimeout(800);
  // mine un bloc de type b ; renvoie le temps de jeu écoulé
  const mineOne = b => ev(async b => { const g = __game, G = g.G; const t = G.target; if (!t) return { err: 'pas de cible' };
    g.world.set(t.x, t.y, t.z, b); await new Promise(r => setTimeout(r, 250)); const t0 = G.t; g.pressed.add('KeyF');
    for (let k = 0; k < 120 && g.world.get(t.x, t.y, t.z) === b; k++) await new Promise(r => setTimeout(r, 60));
    return { ok: g.world.get(t.x, t.y, t.z) === 0, dt: +(G.t - t0).toFixed(2), expect: +g.mineTime(b).toFixed(2) }; }, b);
  const B = await ev(() => __game.B);
  res.terreMain = await mineOne(B.DIRT); await aim();
  res.pierreMain = await mineOne(B.STONE); await aim();
  // minerais : présents dans la pierre des tronçons chargés
  res.minerais = await ev(() => { const g = __game; let c = 0, f = 0; for (const [, ch] of g.world.chunks) if (ch.data) for (let i = 0; i < ch.data.length; i++) { if (ch.data[i] === g.B.COAL) c++; else if (ch.data[i] === g.B.IRONORE) f++; } return { charbon: c, fer: f }; });
  const coal0 = await ev(() => __game.S.inv.filter(i => i.id === 'charbon').reduce((a, i) => a + i.n, 0));
  res.charbonMine = await mineOne(B.COAL); await aim();
  res.charbonGagne = (await ev(() => __game.S.inv.filter(i => i.id === 'charbon').reduce((a, i) => a + i.n, 0))) - coal0;
  // atelier : à la main
  res.atelier = await ev(() => { const g = __game, S = g.S, B = g.B, o = {};
    const pl0 = S.blocks[B.PLANK] || 0; o.planches = g.craft('planches') && S.blocks[B.PLANK] === pl0 + 4;
    o.etabli = g.craft('etabli') && S.blocks[B.BENCH] === 1;
    o.sansEtabliRefuse = !g.craft('pic_bois');
    return o; });
  // pose l'établi devant soi (barre : choisir l'établi)
  res.poseEtabli = await ev(async () => { const g = __game, S = g.S, G = g.G; const i = g.hotList().indexOf(g.B.BENCH); S.hot = i; G.dirtyHot = true; await new Promise(r => setTimeout(r, 300));
    g.input.rmbP = true; await new Promise(r => setTimeout(r, 500)); return { idx: i, near: g.nearBench(), reste: S.blocks[g.B.BENCH] || 0 }; });
  res.etabliRecettes = await ev(() => { const g = __game, S = g.S, B = g.B, o = {};
    S.blocks[B.STONE] = (S.blocks[B.STONE] || 0) + 6; S.blocks[B.SAND] = 4; g.addItem('fer', 6); g.addItem('charbon', 4);
    o.pic_bois = g.craft('pic_bois'); o.pic_fer = g.craft('pic_fer'); o.hache = g.craft('hache'); o.raquettes = g.craft('raquettes'); o.flambeau = g.craft('flambeau'); o.vitre = g.craft('vitre');
    o.outils = S.inv.filter(i => g.ITEMS[i.id].slot === 'outil').map(i => i.id); o.flambeaux = S.blocks[B.TORCH]; return o; });
  await aim(); await p.waitForTimeout(500);
  res.pierrePicFer = await mineOne(B.STONE); await aim();
  res.outilChoisi = await ev(() => __game.toolFor(__game.B.STONE).name);
  res.picPlusRapide = res.pierrePicFer.ok && res.pierreMain.ok && res.pierrePicFer.dt < res.pierreMain.dt * 0.6;
  // atelier ouvert (K) : capture
  await p.keyboard.press('KeyK'); await p.waitForTimeout(700); res.panneau = await ev(() => __game.G.state === 'craft' && document.querySelectorAll('#craftbody .rcp').length);
  await p.click('#craftbody .rcp[data-i="0"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: SH + PFX + '-atelier.png' });
  await p.keyboard.press('KeyK'); await p.waitForTimeout(400);
  // petite cabane avec flambeaux, établi devant, puis capture
  res.cabane = await ev(async () => { const g = __game, G = g.G, P = G.P, w = g.world, B = g.B; const x0 = Math.floor(P.x) + 2, z0 = Math.floor(P.z) - 4, y0 = Math.floor(w.ground(x0 + 1, z0 + 1) * 2) / 2;
    const X = 3.5, Z = 3, H = 2.5;
    for (let x = 0; x <= X; x += 0.5) for (let z = 0; z <= Z; z += 0.5) for (let y = 0; y < H; y += 0.5) { const wall = x === 0 || x === X || z === 0 || z === Z; if (!wall) continue; const door = z === Z && x >= 1.5 && x <= 2 && y < 2; const win = (x === 0 || x === X) && z >= 1 && z <= 2 && y >= 1 && y < 2; w.set(x0 + x, y0 + y, z0 + z, door ? 0 : win ? B.GLASS : B.PLANK); }
    for (let x = -0.5; x <= X + 0.5; x += 0.5) for (let z = -0.5; z <= Z + 0.5; z += 0.5) w.set(x0 + x, y0 + H, z0 + z, B.REDROOF);
    w.set(x0 + 2.5, y0 + 1, z0 + Z + 1, B.BENCH);
    w.set(x0 + 1, y0 + 1.5, z0 + Z + 0.5, B.TORCH); w.set(x0 + 2.5, y0 + 1.5, z0 + Z + 0.5, B.TORCH);
    G.camYaw = 0.6; G.camPitch = 0.3; G.camDist = 8; g.sky.t = 0.71; return [x0, z0]; });
  await p.waitForTimeout(2500); await p.screenshot({ path: SH + PFX + '-cabane.png' });
  await ev(() => { __game.sky.t = 0.4; });
  // flambeau posé depuis la barre
  await aim(); await p.waitForTimeout(500);
  res.flambeauPose = await ev(async () => { const g = __game, S = g.S, G = g.G; S.hot = g.hotList().indexOf(g.B.TORCH); G.dirtyHot = true; await new Promise(r => setTimeout(r, 300)); const t = G.target; if (!t) return 'pas de cible';
    const x = t.x + t.n[0], y = t.y + t.n[1], z = t.z + t.n[2], n0 = S.blocks[g.B.TORCH]; g.input.rmbP = true; await new Promise(r => setTimeout(r, 400)); return { b: g.world.get(x, y, z) === g.B.TORCH, moins1: S.blocks[g.B.TORCH] === n0 - 1, pos: [x, y, z] }; });
  // sauvegarde, puis rechargement comme une ancienne sauvegarde (sans les champs ajoutés)
  const snap = await ev(() => { const g = __game; g.writeSave(); const s = JSON.parse(localStorage.getItem('voxelle-quebec-v2')); delete s.stats.crafted; delete s.stats.mined; localStorage.setItem('voxelle-quebec-v2', JSON.stringify(s)); return { bench: g.S.blocks[g.B.BENCH] || 0, torch: g.S.blocks[g.B.TORCH], outils: g.S.inv.filter(i => g.ITEMS[i.id].slot === 'outil').length, edits: Object.keys(g.S.edits).length }; });
  await p.reload(); await p.waitForTimeout(3000); await p.click('#bCont'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  const fp = res.flambeauPose.pos;
  await p.waitForFunction(fp => __game.world.loadedAround(fp[0], fp[2], 1), fp, { timeout: 120000 });
  res.recharge = await ev(([snap, fp]) => { const g = __game; return { torch: g.S.blocks[g.B.TORCH] === snap.torch, outils: g.S.inv.filter(i => g.ITEMS[i.id].slot === 'outil').length === snap.outils, flambeauMonde: g.world.get(fp[0], fp[1], fp[2]) === g.B.TORCH, crafted: g.S.stats.crafted === 0 }; }, [snap, fp]);
  console.log(JSON.stringify(res, null, 1));
  // tactile : bouton ATELIER, CASSE gardé
  const m = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }); const merr = [];
  m.on('pageerror', e => merr.push(e.message)); m.on('console', q => { if (q.type() === 'error') merr.push(q.text()); });
  await m.goto(`http://localhost:${PORT}/?touch`); await m.evaluate(() => localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'low', view: 3 }))); await m.reload(); await m.waitForTimeout(3000); await m.tap('#bNew'); await m.tap('#bPersoGo'); await m.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  await m.waitForTimeout(1500);
  await m.tap('#tCraft'); await m.waitForTimeout(800); const mob = { atelier: await m.evaluate(() => __game.G.state === 'craft') };
  await m.screenshot({ path: SH + PFX + '-mobile-atelier.png' });
  await m.evaluate(() => document.querySelector('#craft [data-close]').click()); await m.waitForTimeout(300);
  mob.casse = await m.evaluate(async () => { const g = __game, G = g.G; G.camPitch = 0.85; G.camDist = 3.2; await new Promise(r => setTimeout(r, 600)); const t = G.target; if (!t) return 'pas de cible'; g.world.set(t.x, t.y, t.z, g.B.DIRT); await new Promise(r => setTimeout(r, 200));
    const b = document.getElementById('tBrk'), o = { bubbles: true, pointerId: 7, pointerType: 'touch' }; b.dispatchEvent(new PointerEvent('pointerdown', o));
    for (let k = 0; k < 60 && g.world.get(t.x, t.y, t.z) === g.B.DIRT; k++) await new Promise(r => setTimeout(r, 60)); b.dispatchEvent(new PointerEvent('pointerup', o)); return g.world.get(t.x, t.y, t.z) === 0; });
  await m.screenshot({ path: SH + PFX + '-mobile.png' });
  console.log('mobile', JSON.stringify(mob));
  const all = [res.terreMain.ok, res.pierreMain.ok, res.minerais.charbon > 0, res.minerais.fer > 0, res.charbonMine.ok, res.charbonGagne >= 1, ...Object.values(res.atelier), res.poseEtabli.near, ...['pic_bois', 'pic_fer', 'hache', 'raquettes', 'flambeau', 'vitre'].map(k => res.etabliRecettes[k]), res.picPlusRapide, res.outilChoisi === 'Pic en fer', res.panneau > 10, res.flambeauPose.b, res.flambeauPose.moins1, ...Object.values(res.recharge), mob.atelier, mob.casse === true];
  const E = errs.concat(merr);
  console.log(E.length ? E.join('\n') : 'aucune erreur JS');
  console.log(all.every(Boolean) && !E.length ? 'CONSTRUIRE OK' : 'CONSTRUIRE ÉCHEC ' + all.map((v, i) => v ? '' : i).filter(String).join(','));
  await browser.close(); srv.close(); process.exit(all.every(Boolean) && !E.length ? 0 : 1);
})().catch(e => { console.error('ÉCHEC', e); process.exit(2); });

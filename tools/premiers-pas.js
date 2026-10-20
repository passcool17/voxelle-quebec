// Test « Premiers pas et clarté » (v3) : PORT=8943 node tools/premiers-pas.js
// Ordi 1280×720 puis téléphone 844×390 tactile :
// 1) premiers pas : 7 étapes qui avancent quand l'action est faite, passer / revoir, vieille sauvegarde sans tutoriel forcé ;
// 2) suivi + repère : prochaine action concrète partout (ch. 2, toutes les quêtes, après le ch. 7), repère à l'écran ;
// 3) tactile : boutons sans chevauchement, FRAPPE/ROULE agrandis, étiquettes hors du HUD et sans chevauchement,
//    pause + sauvegarde + son coupé à l'arrière-plan, « 1 point » au singulier ;
// 4) donjon : mini-carte du plan des salles visitées ; mini-carte de surface identique à l'ancienne méthode.
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8943);
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
const inter = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
(async () => {
  const t0 = Date.now(), srv = await serve(PORT), browser = await chromium.launch({ args: ARGS }); const errs = [], ok = {};
  for (const dev of ['ordi', 'mobile']) {
    const mob = dev === 'mobile', T = k => dev + '.' + k;
    const ctx = await browser.newContext(mob ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 720 } });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(dev + ' pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(dev + ' console: ' + m.text()); });
    const ev = (f, a) => p.evaluate(f, a), W = ms => p.waitForTimeout(ms);
    const play = () => p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
    const arrive = async () => { await play(); await p.waitForFunction(() => __game.world.loadedAround(__game.G.P.x, __game.G.P.z, 1), null, { timeout: 120000 }); await W(1500); };
    const tuto = () => ev(() => __game.S.tuto);
    const waitTuto = (n, ms = 8000) => p.waitForFunction(n => __game.S.tuto === n, n, { timeout: ms }).then(() => true).catch(() => false);
    const press = async (k, tap) => { if (mob && tap) await p.tap(tap); else await p.keyboard.press(k); };
    await p.goto(`http://localhost:${PORT}/`); await ev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 4, fsAuto: false })); }); await p.reload(); await W(2500);
    await p.click('#bNew'); await p.click('#bPersoGo'); await play(); await W(1500);
    await ev(() => { __game.G.weatherT = 1e9; __game.sky.t = 0.4; setInterval(() => { const P = __game.G.P; if (P) P.hp = P.hpMax || 100; }, 50); });
    // ---- 1) premiers pas
    const s0 = await ev(() => ({ tuto: __game.S.tuto, tr: document.getElementById('tracker').innerText, wp: getComputedStyle(document.getElementById('wp')).display, wpPos: __game.wpPos }));
    console.log(dev, 'départ', JSON.stringify(s0));
    ok[T('tutoDepart')] = s0.tuto === 0 && /Premiers pas 1\/7/.test(s0.tr) && !/Explore/.test(s0.tr) && /Gaston/.test(s0.tr) && s0.wp !== 'none' && !!s0.wpPos;
    const steps = [];
    await ev(() => { const P = __game.G.P; P.x += 6; }); steps.push(await waitTuto(1));
    await ev(() => { const g = __game; let n = null; for (const [, q] of g.G.npcs) if (q.role === 'gaston') n = q; g.G.P.x = n.x + 1.2; g.G.P.z = n.z; }); await W(600);
    await press('KeyE', '#tTalk'); await p.waitForFunction(() => __game.G.state === 'dialog', null, { timeout: 8000 });
    await p.click('#dbtns .btn.big'); steps.push(await waitTuto(2));
    const trCones = await ev(() => document.getElementById('tracker').innerText);
    await ev(() => { const g = __game, P = g.G.P; const e = g.spawnEnemy('cone', P.x, P.z - 3); g.damageEnemy(g.G.enemies[g.G.enemies.length - 1], 1e9, 0, 1, 0); }); steps.push(await waitTuto(3));
    await W(400); await press('KeyC', '#tRoll'); steps.push(await waitTuto(4));
    await ev(() => { __game.S.stats.blocks++; }); steps.push(await waitTuto(5)); // le minage lui-même est couvert par construire.js
    await ev(() => __game.craft('planches')); steps.push(await waitTuto(6));
    await press('KeyJ', '#tQuest'); steps.push(await waitTuto(-1)); await W(300); if (mob) await ev(() => document.querySelector('#quests [data-close]').click()); else await press('KeyJ'); await W(300);
    console.log(dev, 'étapes', JSON.stringify(steps), 'suivi cônes :', JSON.stringify(trCones));
    ok[T('tutoEtapes')] = steps.every(Boolean) && /chantier/.test(trCones);
    // revoir puis passer
    await ev(() => __game.closeDialog()); await press('Escape', '#tPause'); await W(300);
    const lb1 = await ev(() => document.getElementById('bTuto').textContent); await p.click('#bTuto'); await W(500);
    const unpause = () => ev(() => { const G = __game.G; if (G.state === 'pause') { document.getElementById('pause').classList.add('hidden'); G.state = 'play'; } });
    await unpause(); const re = await tuto(); let skip;
    if (mob) { await p.waitForSelector('#tracker .tskip', { timeout: 5000 }); await p.tap('#tracker .tskip'); await W(300); skip = await tuto(); }
    else { await press('Escape'); await W(300); const lb2 = await ev(() => document.getElementById('bTuto').textContent); console.log('lb2', lb2, await ev(() => __game.S.tuto)); await p.click('#bTuto'); await W(300); skip = (await tuto()) === -1 && /PASSER/.test(lb2) ? -1 : 'x'; await unpause(); }
    console.log(dev, 'revoir/passer', JSON.stringify({ lb1, re, skip, st: await ev(() => __game.G.state) }));
    ok[T('revoirPasser')] = /REVOIR/.test(lb1) && re === 0 && skip === -1;
    // ---- 2) suivi : chapitre 2, toutes les quêtes, après le ch. 7
    await ev(() => { const g = __game; g.S.q = { cones: { st: 'done', n: 6 }, permis: { st: 'active', n: 0 } }; g.G.dirtyQ = true; }); await W(1200);
    const c2 = await ev(() => ({ tr: document.getElementById('tracker').innerText, wp: __game.wpPos, disp: getComputedStyle(document.getElementById('wp')).display, txt: document.querySelector('#wp span').textContent }));
    ok[T('ch2')] = /bureaucrates zombies/.test(c2.tr) && !!c2.wp && c2.disp !== 'none' && / k?m$/.test(c2.txt);
    const all = await ev(() => { const g = __game, miss = []; for (const id in g.QUESTS) { for (const st of ['active', 'ready']) { g.S.q = { [id]: { st, n: 0 } }; if (!g.questTargetPos(id)) miss.push(id + ':' + st); } g.S.q = {}; if (!g.giverPos(g.QUESTS[id].giver, g.QUESTS[id])) miss.push(id + ':giver'); } return miss; });
    await ev(() => { const g = __game; g.S.q = {}; for (const [id, q] of Object.entries(g.QUESTS)) if (q.chap) g.S.q[id] = { st: 'done', n: q.n }; g.G.dirtyQ = true; }); await W(1200);
    const fin = await ev(() => ({ tr: document.getElementById('tracker').innerText, wp: !!__game.wpPos }));
    const fin2 = await ev(() => { const g = __game; for (const id in g.QUESTS) g.S.q[id] = { st: 'done', n: 1 }; g.S.dun = { mine: 1, egout: 1 }; const o = g.objectives(); g.S.dun = {}; return o.map(o => o.t + ' — ' + o.d + (o.pos ? ' @' : '')); });
    console.log(dev, 'ch2', JSON.stringify(c2), 'sans repère', JSON.stringify(all), 'fin', JSON.stringify(fin), JSON.stringify(fin2));
    ok[T('toutesQuetes')] = all.length === 0; ok[T('apresCh7')] = !/Explore/.test(fin.tr) && fin.wp && fin2.length > 0 && fin2[0].endsWith('@');
    // ---- 3) tactile, étiquettes, arrière-plan, pluriel
    await ev(() => { const g = __game; g.S.q = { cones: { st: 'done', n: 6 }, permis: { st: 'active', n: 0 } }; g.G.dirtyQ = true; const s = g.gen.cell(0, 0), P = g.G.P; P.x = g.gen.VX + 2.5; P.z = g.gen.VZ + 10.5; P.y = g.gen.VH + 1; g.G.camYaw = Math.PI; }); await W(2500);
    const lab = await ev(() => { const R = id => { const e = document.getElementById(id); return e && e.offsetParent !== null ? e.getBoundingClientRect().toJSON() : null; };
      const hud = ['stats', 'mapbox', 'tTop', 'hotbar'].map(R).filter(Boolean), it = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      const nm = [...document.querySelectorAll('#labels .lb')].filter(e => e.style.display !== 'none').map(e => (e.querySelector('.nm') || e).getBoundingClientRect().toJSON()).filter(r => r.width);
      let overHud = 0, overlap = 0; for (const r of nm) if (hud.some(h => it(r, h))) overHud++; for (let i = 0; i < nm.length; i++) for (let j = i + 1; j < nm.length; j++) if (it(nm[i], nm[j])) { overlap++; console.log('chevauchement', JSON.stringify([nm[i], nm[j]])); }
      return { n: nm.length, overHud, overlap }; });
    console.log(dev, 'étiquettes', JSON.stringify(lab)); ok[T('etiquettes')] = lab.n > 0 && lab.overHud === 0 && lab.overlap === 0;
    if (mob) {
      const tb = await ev(() => { const ids = ['tAtk', 'tJump', 'tRoll', 'tBrk', 'tPlace', 'tEat', 'tSwap', 'tTalk', 'stick']; document.getElementById('tTalk').classList.remove('hidden');
        const r = ids.map(id => [id, document.getElementById(id).getBoundingClientRect().toJSON()]); document.getElementById('tTalk').classList.add('hidden');
        const it = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height, bad = [];
        for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (it(r[i][1], r[j][1])) bad.push(r[i][0] + '/' + r[j][0]);
        const tr = document.getElementById('tracker').getBoundingClientRect(), st = document.getElementById('stick').getBoundingClientRect(), H = innerHeight;
        return { bad, atk: r[0][1].width / H, roll: r[2][1].width / H, trackerSurStick: tr.bottom > st.top, trackerSousBoutons: r.some(([, b]) => it(b, tr)) }; });
      console.log('boutons', JSON.stringify(tb)); ok[T('boutons')] = !tb.bad.length && tb.atk > 0.2 && tb.roll > 0.13 && !tb.trackerSurStick && !tb.trackerSousBoutons;
    }
    const bg = await ev(async () => { const g = __game; g.audio.init(); await new Promise(r => setTimeout(r, 300)); g.G.P.x += 0.7; const x = g.G.P.x;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'));
      await new Promise(r => setTimeout(r, 300)); const s = JSON.parse(localStorage.getItem('voxelle-quebec-v2')), o = { st: g.G.state, saved: Math.abs(s.pos[0] - x) < 0.01, audio: g.audio.ctx ? g.audio.ctx.state : 'none' };
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); await new Promise(r => setTimeout(r, 300)); o.audioRetour = g.audio.ctx ? g.audio.ctx.state : 'none'; return o; });
    console.log(dev, 'arrière-plan', JSON.stringify(bg)); ok[T('arrierePlan')] = bg.st === 'pause' && bg.saved && bg.audio === 'suspended';
    await p.click('#bResume'); await W(300); await unpause();
    await ev(() => __game.openPanel('talents')); const tal = await ev(() => document.getElementById('talbody').innerText); await ev(() => document.querySelector('#talents [data-close]').click());
    ok[T('pluriel')] = !/ 1 points/.test(tal) && /1 point dans/.test(tal);
    // ---- 4) mini-carte : surface identique à l'ancienne méthode ; donjon : plan des salles visitées
    const mm = await ev(() => { const g = __game; g.miniRun(); const d = g.mimg.data, P = g.G.P, ox = Math.floor(P.x) - 80, oz = Math.floor(P.z) - 80; let diff = 0, known = 0;
      for (let j = 0; j < 160; j++) for (let i = 0; i < 160; i++) { const c = g.topColor(ox + i, oz + j) || [22, 34, 50], k = (i + j * 160) * 4; if (c[0] !== d[k] || c[1] !== d[k + 1] || c[2] !== d[k + 2]) diff++; if (g.topColor(ox + i, oz + j)) known++; }
      let t = performance.now(); for (let k = 0; k < 20; k++) g.miniRun(); const tNew = (performance.now() - t) / 20;
      t = performance.now(); for (let k = 0; k < 20; k++) for (let j = 0; j < 160; j++) for (let i = 0; i < 160; i++) g.topColor(ox + i, oz + j); const tOld = (performance.now() - t) / 20;
      return { diff, known, tNew: +tNew.toFixed(2), tOld: +tOld.toFixed(2) }; });
    console.log(dev, 'mini-carte surface', JSON.stringify(mm)); ok[T('miniSurface')] = mm.diff === 0 && mm.known > 5000;
    if (mob) { // donjon une seule fois (le plus lent) : sur téléphone
      await ev(() => __game.travel('charlevoix')); await arrive();
      await ev(() => { const g = __game, s = g.gen.reg.places.mine, pl = g.dunPlan(s), P = g.G.P; P.x = pl.ent.x + 0.5; P.z = pl.ent.z + 0.5; P.y = s.fy + 0.05; P.vx = P.vy = P.vz = 0; }); await W(2500);
      await ev(() => { const g = __game, s = g.gen.reg.places.mine, pl = g.dunPlan(s), P = g.G.P, l = pl.links.find(l => !l[0] && !l[1]), r = pl.rooms.find(m => m.i === l[2] && m.j === l[3]); P.x = r.x + 0.5; P.z = r.z + 0.5; P.y = s.fy + 0.05; }); await W(2500);
      const dn = await ev(() => { const g = __game, c = document.getElementById('mini').getContext('2d').getImageData(0, 0, 160, 160).data; let dark = 0, gold = 0;
        for (let k = 0; k < c.length; k += 4) { if (c[k] === 12 && c[k + 1] === 20 && c[k + 2] === 32) dark++; if (c[k] === 255 && c[k + 1] === 210 && c[k + 2] === 58) gold++; }
        const seen = g.S.dunSeen.mine || 0, bits = seen.toString(2).replace(/0/g, '').length, b = g.dunPlan(g.gen.reg.places.mine).bossRoom;
        return { dun: g.dun && g.dun.key, bits, dark, gold, tr: document.getElementById('tracker').innerText, wp: g.wpPos, boss: { x: b.x + 0.5, z: b.z + 0.5 } }; });
      console.log('donjon', JSON.stringify(dn));
      ok[T('donjonMini')] = dn.dun === 'mine' && dn.bits >= 2 && dn.dark > 160 * 160 * 0.4 && dn.gold > 20;
      ok[T('donjonSuivi')] = /boss/.test(dn.tr) && dn.wp && Math.abs(dn.wp.x - dn.boss.x) < 0.01 && Math.abs(dn.wp.z - dn.boss.z) < 0.01;
      await ev(() => __game.writeSave()); await p.reload(); await W(2500); await p.click('#bCont'); await play(); await W(800);
      ok[T('dunSeenSauve')] = await ev(() => (__game.S.dunSeen.mine || 0) > 0);
    }
    // ---- vieille sauvegarde (sans tuto ni dunSeen) : chargée, pas de premiers pas forcés
    await p.reload(); await W(2500); // (pagehide sauvegarde la partie : on vieillit la sauvegarde après le rechargement)
    await ev(() => { const s = JSON.parse(localStorage.getItem('voxelle-quebec-v2')); delete s.tuto; delete s.dunSeen; localStorage.setItem('voxelle-quebec-v2', JSON.stringify(s)); }); await p.click('#bCont'); await play(); await W(1000);
    const old = await ev(() => ({ tuto: __game.S.tuto, ds: typeof __game.S.dunSeen, tr: document.getElementById('tracker').innerText }));
    console.log(dev, 'vieille sauvegarde', JSON.stringify(old)); ok[T('vieilleSauvegarde')] = old.tuto === -1 && old.ds === 'object' && !/Premiers pas/.test(old.tr);
    await ctx.close();
  }
  console.log(JSON.stringify(ok, null, 1)); console.log(errs.join('\n') || '0 erreur JS');
  const pass = Object.values(ok).every(Boolean) && !errs.length;
  console.log(pass ? 'PREMIERS-PAS OK' : 'PREMIERS-PAS ÉCHEC', Math.round((Date.now() - t0) / 1000) + ' s');
  await browser.close(); srv.close(); process.exit(pass ? 0 : 1);
})().catch(e => { console.log('PREMIERS-PAS ÉCHEC', e.message); process.exit(1); });

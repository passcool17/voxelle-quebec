// v4 : saisons (jour → saison, uniformes, glace où l'on marche, météo, journal), la cabane (quête du terrain, meubles,
// lit = réveil, coffre, raccourci), sauvegarde/rechargement, vieille sauvegarde, glissade, téléphone 844×390.
// PORT=8919 node tools/saisons.js
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8919);
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const fails = []; const ok = (c, m) => { console.log((c ? 'OK   ' : 'ÉCHEC ') + m); if (!c) fails.push(m); };
(async () => {
  const srv = await serve(PORT); const browser = await chromium.launch({ args: ARGS }); const errs = [];
  const page = async (opt) => { const p = await browser.newPage(opt); p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); }); return p; };
  const p = await page({ viewport: { width: 1280, height: 720 } });
  const ev = (f, a) => p.evaluate(f, a), W = ms => p.waitForTimeout(ms);
  const gw = s => ev(s => new Promise(r => { const t0 = __game.G.t; const f = () => __game.G.t - t0 >= s ? r() : setTimeout(f, 50); f(); }), s);
  const play = () => p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  const calm = () => ev(() => { const g = __game, G = g.G; for (const e of G.enemies) { e.hp = 0; e.dead = true; e.model.g.visible = false; e.label.style.display = 'none'; } G.spawnT = 1e9; G.weatherT = 1e9; g.sky.snowT = g.sky.rainT = g.sky.snow = g.sky.rain = 0; if ('tuto' in g.S) g.S.tuto = -1; });
  const go = async (x, z, y0) => { await ev(([x, z]) => { const P = __game.G.P; P.x = x; P.z = z; P.y = __game.gen.heightAt(x, z) + 6; P.vx = P.vy = P.vz = 0; window.__sc = [x, z]; }, [x, z]);
    await p.waitForFunction(() => __game.world.loadedAround(__sc[0], __sc[1], 1), null, { timeout: 120000 }); await calm();
    await ev(y0 => { const g = __game, P = g.G.P; P.y = g.world.ground(P.x, P.z, y0 || 120) + 0.05; P.vy = 0; }, y0); };
  await p.goto(`http://localhost:${PORT}/`);
  await ev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'low', view: 3, fsAuto: false })); }); await p.reload(); await W(3000);
  await p.click('#bNew'); await p.click('#bPersoGo'); await play(); await calm();

  // 1. nouvelle partie : début de l'été, horloge
  const s0 = await ev(() => ({ day: __game.S.day, k: __game.season, clock: document.getElementById('clock') ? document.getElementById('clock').textContent : document.getElementById('hud').textContent }));
  ok(s0.day === 6 && s0.k === 2 && /Été/.test(s0.clock), 'nouvelle partie : jour 6, été, affiché au HUD (' + s0.clock.slice(0, 60) + ')');
  // 2. paramètres des 4 saisons et transitions douces
  const sp = await ev(() => [0, 1, 2, 3].map(k => __game.seasonParams(k * 3 + 1.5)));
  ok(sp[0].snow > 0.9 && sp[0].ice > 0.9 && sp[2].snow === 0 && sp[3].fall > 0.8 && sp[2].green > 0.9 && sp[1].fresh > 0.5, 'neige/glace l’hiver, vert l’été, couleurs l’automne, verdure au printemps');
  const tr = await ev(() => [2.9, 3.3, 3.6, 4.2].map(d => __game.seasonParams(d).snow));
  ok(tr[0] === 1 && tr[0] > tr[1] && tr[1] > tr[2] && tr[2] > tr[3] && tr[3] < 0.05, 'transition hiver → printemps graduelle (neige ' + tr.map(v => v.toFixed(2)).join(' → ') + ')');
  const wx = await ev(async () => { const m = await import('./js/saisons.js'); return [0, 1, 2, 3].map(k => { const c = {}; for (let i = 0; i < 400; i++) { const w = m.weatherPick(k, i / 400); c[w] = (c[w] || 0) + 1; } return c; }); });
  ok((wx[0].neige || 0) > (wx[0].pluie || 0) && (wx[1].pluie || 0) > (wx[2].pluie || 0) && !wx[2].neige, 'météo pondérée : neige l’hiver, plus de pluie au printemps qu’à l’été ' + JSON.stringify(wx));
  // 3. hiver : fleuve gelé, on marche dessus ; l'été on nage
  const rv = await ev(() => { const g = __game.gen, x = 40; return [x, g.riverZ(x)]; });
  await ev(() => __game.setSeason(0)); await go(rv[0], rv[1]); await gw(3);
  const ice = await ev(() => { const g = __game, P = g.G.P; return { fr: g.frozen, u: g.SEASON_U.uIce.value, y: P.y, w: g.world.ground(P.x, P.z), gr: P.ground, sw: !!P.swim, banner: document.getElementById('banner').textContent }; });
  ok(ice.fr && ice.u > 0.99 && ice.gr && Math.abs(ice.y - ice.w) < 0.3, 'hiver : fleuve gelé, debout sur la glace ' + JSON.stringify(ice));
  const slide = await ev(() => new Promise(r => { const P = __game.G.P; P.vx = 6; P.vz = 0; setTimeout(() => r(Math.abs(P.vx)), 250); }));
  ok(slide > 1.5, 'la glace glisse (vitesse après 0,25 s sans touche : ' + slide.toFixed(2) + ')');
  const wd = await ev(() => document.getElementById('hud').textContent.includes('Hiver'));
  ok(wd, 'HUD : « Hiver »');
  await ev(() => __game.setSeason(2)); await gw(2);
  const sum = await ev(() => { const g = __game, P = g.G.P; return { fr: g.frozen, y: P.y, w: g.world.ground(P.x, P.z) }; });
  ok(!sum.fr && sum.y < sum.w - 0.2, 'été : l’eau redevient de l’eau (on s’enfonce) ' + JSON.stringify(sum));
  // 4. nouveau jour → nouvelle saison, bannière
  await ev(() => { const g = __game; g.S.day = 8; g.sky.t = 0.9995; }); await gw(1);
  const nd = await ev(() => ({ day: __game.S.day, k: __game.season, b: document.getElementById('banner').textContent }));
  ok(nd.day === 9 && nd.k === 3 && /AUTOMNE/.test(nd.b), 'minuit : jour 9 → automne, bannière ' + JSON.stringify(nd));
  // 5. journal : paragraphe de la saison
  await ev(() => __game.openPanel('quests')); await W(400);
  const jn = await ev(() => { const e = document.querySelector('p.saison'); return e ? e.textContent : ''; });
  ok(/Automne/.test(jn), 'journal : saison affichée (' + jn.slice(0, 80) + ')'); await ev(() => __game.closePanels());
  // 6. quête « Ton bout de terrain » → cabane, lit et coffre
  await ev(() => { const g = __game; g.setSeason(2); g.S.q.terrain = { st: 'active', n: 0 }; g.addItem('acte'); });
  const H = await ev(() => __game.H); await go(H.cx + 0.5, H.cz + 1.5, H.h + 3); await gw(1.5);
  const hq = await ev(() => { const S = __game.S; return { st: S.q.terrain.st, home: S.home, lit: S.inv.some(i => i.id === 'lit'), cof: S.inv.some(i => i.id === 'coffre_m'), acte: S.inv.some(i => i.id === 'acte') }; });
  ok(hq.st === 'done' && hq.home && hq.lit && hq.cof && !hq.acte, 'arrivée sur le terrain : quête finie, lit et coffre dans le sac ' + JSON.stringify(hq));
  // 7. meubles : le lit (dormir → matin, point de réveil), le coffre
  const pl = await ev(() => { const g = __game, P = g.G.P; P.yaw = 0; const a = g.furnPlace('lit'); const u = g.useNear(); return { a, n: g.S.furn.length, u: u && u.txt, lit: g.S.inv.some(i => i.id === 'lit') }; });
  ok(pl.a && pl.n === 1 && !pl.lit && /Dormir/.test(pl.u), 'lit installé, action « Dormir » tout près ' + JSON.stringify(pl));
  await ev(() => __game.sky.t = 0.8); 
  await gw(0.3); /* une image de jeu pour que l'invite du meuble s'affiche */
  await p.keyboard.press('e'); await W(500);
  const dl = await ev(() => ({ st: __game.G.state, t: document.getElementById('dname').textContent }));
  ok(dl.st === 'dialog' && /Lit/i.test(dl.t), 'touche E près du lit : fenêtre du lit (' + dl.t + ')');
  if (dl.st !== 'dialog') await ev(() => __game.furnOpen(0));
  const d0 = await ev(() => __game.S.day);
  await ev(() => [...document.querySelectorAll('#dbtns .btn')].find(b => /DORMIR/.test(b.textContent)).click()); await W(1500);
  const sl = await ev(() => ({ day: __game.S.day, t: __game.sky.t, sp: __game.S.spawn, st: __game.G.state, r: __game.S.restedTo }));
  ok(sl.day === d0 + 1 && sl.t < 0.3 && sl.sp && sl.st === 'play', 'dormir : le lendemain matin, réveil ici ' + JSON.stringify(sl));
  const xp = await ev(() => { const S = __game.S, a = S.xp; __game.gainXP(100); return S.xp - a; });
  ok(xp >= 120 || xp < 0, 'bien reposé : +20 % d’XP (' + xp + ')');
  await ev(() => { const P = __game.G.P; P.x = __game.H.ix0 + 1; P.z = __game.H.iz0 + 1.5; P.yaw = Math.PI; __game.furnPlace('coffre_m'); __game.addItem('sirop'); });
  await ev(() => __game.openCoffre(1)); await W(300);
  const ch0 = await ev(() => { const c = document.querySelector('#dtext .cell[data-s="sac"]'); const id = __game.S.inv[+c.dataset.k].id; c.click(); return id; }); await W(200);
  const ch = await ev(() => ({ n: __game.S.chest.length, id: __game.S.chest[0] && __game.S.chest[0].id }));
  ok(ch.n === 1 && ch.id === ch0, 'coffre : objet du sac rangé dans le coffre (' + ch0 + ')');
  await ev(() => { const c = document.querySelector('#dtext .cell[data-s="cof"]'); c.click(); }); await W(200);
  const ch2 = await ev(() => __game.S.chest.length); ok(ch2 === 0, 'coffre : objet repris');
  await ev(() => document.querySelector('#dtext .cell[data-s="sac"]').click()); await ev(() => [...document.querySelectorAll('#dbtns .btn')].find(b => /FERMER/.test(b.textContent)).click()); await W(300);
  // 8. mort → réveil dans le lit
  await ev(() => { const g = __game, P = g.G.P; P.x += 60; P.z += 20; g.die('test'); }); await W(300);
  const lb = await ev(() => document.getElementById('bRespawn').textContent); ok(/LIT/.test(lb), 'écran de mort : « ' + lb + ' »');
  await p.click('#bRespawn'); await W(500);
  const rs = await ev(() => { const g = __game, P = g.G.P, s = g.S.spawn; return Math.hypot(P.x - s[0], P.z - s[2]); }); ok(rs < 0.5, 'réveil au lit (' + rs.toFixed(2) + ' m)');
  // 9. raccourci « retour à la cabane » : touche H, puis délai
  await go(H.cx + 300, H.cz + 120); await gw(0.5);
  await ev(() => __game.S.homeT = -9); await p.keyboard.press('h'); await play(); await gw(0.5);
  const gh = await ev(() => { const g = __game, P = g.G.P; return { in: g.inHome(g.H, P.x, P.z), again: g.goHome() }; });
  ok(gh.in && gh.again === false, 'touche H : retour à la cabane, puis délai avant le prochain ' + JSON.stringify(gh));
  // 10. sauvegarde → rechargement
  await ev(() => __game.writeSave()); const before = await ev(() => JSON.stringify({ d: __game.S.day, f: __game.S.furn.length, c: __game.S.chest.length, s: __game.S.spawn, h: __game.S.home }));
  await p.reload(); await W(3000); await p.click('#bCont'); await play(); await calm();
  const after = await ev(() => JSON.stringify({ d: __game.S.day, f: __game.S.furn.length, c: __game.S.chest.length, s: __game.S.spawn, h: __game.S.home }));
  ok(before === after, 'sauvegarde/rechargement : jour, meubles, coffre, lit, terrain ' + after);
  const fm = await ev(() => __game.useNear() !== undefined); ok(fm, 'meubles réaffichés au chargement');
  // 11. vieille sauvegarde (v3, sans les champs v4)
  // la partie sauvegarde au pagehide : on vieillit la sauvegarde après le rechargement, au menu
  await p.reload(); await W(500);
  await ev(() => { const k = 'voxelle-quebec-v2', s = JSON.parse(localStorage.getItem(k)); for (const f of ['day', 'home', 'furn', 'chest', 'spawn', 'homeT', 'restedTo']) delete s[f]; delete s.q.terrain; localStorage.setItem(k, JSON.stringify(s)); });
  await p.reload(); await W(3000); await p.click('#bCont'); await play(); await calm(); await gw(1);
  const old = await ev(() => { const S = __game.S; return { d: S.day, f: S.furn, c: S.chest, h: S.home, k: __game.season }; });
  ok(old.d === 6 && Array.isArray(old.f) && !old.f.length && Array.isArray(old.c) && !old.h && old.k === 2, 'vieille sauvegarde : été, pas de cabane, sans erreur ' + JSON.stringify(old));
  // 12. hiver : glissade sur la butte de la patinoire
  await ev(() => __game.setSeason(0)); const PAT = await ev(() => __game.PAT);
  await go(PAT.butte.x0 + 0.5, (PAT.butte.z0 + PAT.butte.z1) / 2); await gw(1);
  await ev(() => { const g = __game, P = g.G.P; P.y = g.world.ground(P.x, P.z) + 0.05; P.vy = 0; }); await gw(0.4);
  const bu = await ev(() => { const u = __game.useNear(); return u && u.txt; }); ok(/Glisser/.test(bu || ''), 'haut de la butte l’hiver : « ' + bu + ' »');
  await ev(() => __game.useNear().fn()); await gw(0.5); const sl1 = await ev(() => !!__game.G.P.sled);
  await p.waitForFunction(() => !__game.G.P.sled, null, { timeout: 30000 }).catch(() => {});
  const sl2 = await ev(() => ({ n: __game.S.stats.glissades, x: __game.G.P.x - __game.PAT.butte.x0 }));
  ok(sl1 && sl2.n === 1 && sl2.x > 8, 'glissade en traîne sauvage jusqu’en bas ' + JSON.stringify(sl2));
  const sk = await ev(() => [...__game.G.npcs.values()].filter(n => n.act === 'patine').length); ok(sk >= 3, 'patineurs sur la patinoire l’hiver (' + sk + ')');

  // 13. téléphone 844×390 : bannière sous la barre de blocs, bouton tactile près d'un meuble, bouton de la cabane dans la pause
  const m = await page({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const mev = (f, a) => m.evaluate(f, a);
  await m.goto(`http://localhost:${PORT}/`); await mev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'auto', view: 3, fsAuto: false })); }); await m.reload(); await m.waitForTimeout(3000);
  await m.tap('#bNew'); await m.tap('#bPersoGo'); await m.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 }); await m.waitForTimeout(800);
  const bh = await mev(() => { const b = document.getElementById('banner').getBoundingClientRect(), h = document.getElementById('hotbar').getBoundingClientRect(); return { b: Math.round(b.top), h: Math.round(h.bottom), vis: getComputedStyle(document.getElementById('banner')).opacity }; });
  ok(bh.b >= bh.h, 'téléphone : la bannière d’accueil est sous la barre de blocs ' + JSON.stringify(bh));
  await mev(() => { const g = __game; g.homeSetup(); const P = g.G.P; P.x = g.H.ix1 - 0.6; P.z = g.H.iz1 - 0.6; P.y = g.H.h + 1.1; P.vx = P.vy = P.vz = 0; window.__sc = [P.x, P.z]; });
  await m.waitForFunction(() => __game.world.loadedAround(__sc[0], __sc[1], 1), null, { timeout: 120000 }); await m.waitForTimeout(800);
  const tb = await mev(() => { const t = document.getElementById('tTalk'); return { hid: t.classList.contains('hidden'), txt: t.textContent }; });
  ok(!tb.hid && /DORS/.test(tb.txt), 'téléphone : bouton « ' + tb.txt + ' » près du lit');
  await m.tap('#tTalk'); await m.waitForTimeout(500);
  const td = await mev(() => ({ st: __game.G.state, t: document.getElementById('dname').textContent })); ok(td.st === 'dialog' && /Lit/i.test(td.t), 'téléphone : le bouton ouvre le lit');
  await mev(() => [...document.querySelectorAll('#dbtns .btn')].find(b => /FERMER/.test(b.textContent)).click()); await m.waitForTimeout(300);
  await mev(() => __game.openCoffre(1)); await m.waitForTimeout(300);
  const cc = await mev(() => { const r = document.querySelector('#dtext .chest').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.bottom), vh: innerHeight, n: document.querySelectorAll('#dtext .cell').length }; });
  ok(cc.n > 0 && cc.h <= cc.vh, 'téléphone : coffre lisible à l’écran ' + JSON.stringify(cc));
  await mev(() => __game.closeDialog()); await m.waitForTimeout(200); await m.tap('#tPause'); await m.waitForTimeout(400);
  const ph = await mev(() => ({ st: __game.G.state, h: !document.getElementById('bHome').classList.contains('hidden') }));
  ok(ph.st === 'pause' && ph.h, 'téléphone : « RETOUR À LA CABANE » dans la pause ' + JSON.stringify(ph));

  ok(!errs.length, 'aucune erreur JS' + (errs.length ? ' : ' + errs.slice(0, 5).join(' | ') : ''));
  console.log(fails.length ? 'ÉCHECS : ' + fails.length : 'TOUT OK');
  await browser.close(); srv.close(); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('ERREUR', e); process.exit(2); });

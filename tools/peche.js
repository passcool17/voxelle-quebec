// v6.2 : pêche blanche — hors saison (« revenez l'hiver »), location, cabane, prise réussie, ratés (touche manquée, poisson décroché),
// quête, cuisine, vente, tableau des records, sauvegarde/rechargement, téléphone (bouton TIRE tactile). usage : PORT=8938 node tools/peche.js
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8938), PFX = process.argv[2] || 'apres-v6-peche', SH = __dirname + '/../shots/';
(async () => {
  const srv = await serve(PORT);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [], bad = [], ok = (c, msg) => { console.log((c ? 'ok   ' : 'ÉCHEC ') + msg); if (!c) bad.push(msg); };
  const mk = async opt => { const ctx = await b.newContext(opt); const p = await ctx.newPage(); p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); }); return p; };
  const shot = async (n, pg) => { await pg.screenshot({ path: SH + PFX + '-' + n + '.png' }); console.log('capture', PFX + '-' + n + '.png'); };
  const boot = async (p, tap) => { await p.goto(`http://localhost:${PORT}/`); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 4, fsAuto: false })); }); await p.reload(); await p.waitForTimeout(2500);
    if (tap) { await p.tap('#bNew'); await p.tap('#bPersoGo'); } else { await p.click('#bNew'); await p.click('#bPersoGo'); } await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
    await p.evaluate(() => { const S = __game.S; S.tuto = -1; S.lvl = 4; S.cash = 100; __game.G.P.hp = 400; __game.G.spawnT = 1e9; }); };
  const tpF = p => async (x, z, wait = 900) => { await p.evaluate(([x, z]) => { const P = __game.G.P; P.x = x; P.z = z; P.y = 90; P.vy = 0; }, [x, z]);
    await p.waitForFunction(([x, z]) => __game.world.loadedAround(x, z, 1), [x, z], { timeout: 90000 });
    await p.evaluate(([x, z]) => { const P = __game.G.P; P.y = __game.world.ground(x, z) + 0.1; P.vy = 0; P.iT = 99; }, [x, z]); await p.waitForTimeout(wait); };
  // pilote automatique du mini-jeu : ferre à la touche, tient le curseur sur la zone (mode 'bon'), ou ne fait rien ('rien')
  const pilot = (p, mode, touch) => p.evaluate(([mode, touch]) => { clearInterval(window.__pk); window.__pk = setInterval(() => { const F = __game.peche.F; if (!F) return; const t = document.getElementById('pkTire');
    const hold = v => { if (touch) { if (v !== window.__h) t.dispatchEvent(new PointerEvent(v ? 'pointerdown' : 'pointerup', { bubbles: true, pointerType: 'touch' })); window.__h = v; } else F.hold = v; };
    if (F.ph === 'attente' && F.bite > 1.2 && F.t < 0.3) F.bite = 1.2; // pas d'attente interminable pendant le test
    if (mode === 'rien') { hold(false); return; }
    if (F.ph === 'touche' && F.t > 0.15) { if (touch) { t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })); t.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' })); } else F.tap = true; }
    if (F.ph === 'combat') hold(F.m < F.c - F.v * 0.25); else if (F.ph !== 'touche') hold(false); }, 25); }, [mode, touch]);
  const phase = (p, re, ms = 40000) => p.waitForFunction(re => { const F = __game.peche.F; return F && new RegExp(re).test(F.ph); }, re, { timeout: ms }).then(() => true).catch(() => false);

  const p = await mk({ viewport: { width: 1280, height: 720 } }); const ev = (f, a) => p.evaluate(f, a), W = ms => p.waitForTimeout(ms), tp = tpF(p);
  await boot(p);
  const PK = await ev(() => { const k = __game.peche; return { shore: k.shore, board: k.board, huts: k.huts }; });
  const talk = async () => { await tp(PK.shore.x + 2, PK.shore.z - 2, 1500); const n = await ev(() => { for (const [, n] of __game.G.npcs) if (n.role === 'pecheur') return [n.x, n.z]; return null; }); if (!n) return null;
    await tp(n[0], n[1] - 1.4, 500); await ev(() => __game.pressed.add('KeyE')); await W(500); return ev(() => __game.G.state === 'dialog' ? document.getElementById('dtext').textContent : null); };
  const btn = async label => { for (const x of await p.$$('#dbtns .btn')) if ((await x.textContent()).includes(label)) { await x.click(); await W(300); return true; } return false; };
  const close = () => ev(() => { if (__game.G.state === 'dialog') __game.closeDialog(); });
  // ---------- 1. hors saison ----------
  ok(await ev(() => __game.season === 2 && !__game.frozen), 'départ en été');
  const t0 = await talk(); ok(t0 && /hiver/.test(t0), 'Ti-Guy sur la rive : « ' + (t0 || '').slice(0, 70) + '… »'); await close();
  ok((await ev(() => __game.peche.built)) === 0, 'pas de cabanes sur l’eau l’été');
  const lb = await ev(() => [...document.querySelectorAll('#labels .lb')].map(e => e.textContent).find(t => /Pêche blanche/.test(t))); ok(/revenez l’hiver/.test(lb || ''), 'tableau : « ' + lb + ' »');
  // ---------- 2. hiver : cabanes, quête, location ----------
  await ev(() => __game.setSeason(0)); await W(1500); await tp(PK.shore.x, PK.shore.z - 1, 1500);
  ok(await ev(() => __game.frozen) && (await ev(() => __game.peche.built)) === 5, 'hiver : fleuve gelé, 5 cabanes sur la glace');
  await ev(([h]) => { const G = __game.G, P = G.P; P.x = h.x - 4; P.z = h.z - 12; P.y = __game.world.ground(P.x, P.z) + 0.1; G.camYaw = Math.PI + 0.3; G.camPitch = 0.42; G.camDist = 3.2; }, [PK.huts[2]]); await W(1500); await shot('cabanes', p);
  const t1 = await talk(); ok(/pêche blanche/i.test(t1 || '') && await btn('ACCEPTER'), 'quête « La pêche blanche » acceptée'); await close();
  await ev(() => __game.petGive('chien')); await W(500);
  const cash0 = await ev(() => __game.S.cash); await talk(); ok(await btn('LOUER'), 'bouton LOUER'); await close();
  ok((await ev(() => __game.S.cash)) === cash0 - 10 && await ev(() => __game.S.peche.rent === __game.S.day), 'cabane louée : -10 $');
  // ---------- 3. entrer, pêcher, réussir ----------
  const H = PK.huts[2]; await tp(H.x, H.z, 1500);
  const pr = await ev(() => document.getElementById('prompt').textContent); ok(/Pêcher sur la glace/.test(pr), 'dans la cabane : « ' + pr + ' »');
  await ev(() => __game.pressed.add('KeyE')); await W(400); ok((await ev(() => __game.G.state)) === 'peche' && await ev(() => getComputedStyle(document.getElementById('peche')).display !== 'none' && document.getElementById('prompt').classList.contains('hidden')), 'mini-jeu lancé (état peche, panneau visible)');
  await pilot(p, 'bon');
  ok(await phase(p, 'combat'), 'ça mord → ferré → combat');
  await p.waitForFunction(() => { const F = __game.peche.F; return F && (F.ph !== 'combat' || F.prog > 0.55); }, null, { timeout: 30000 }).catch(() => {});
  const sit = await ev(() => { const d = __game.G.pet, P = __game.G.P; return +Math.hypot(d.x - P.x, d.z - P.z).toFixed(1); });
  await ev(() => { const G = __game.G; G.camYaw = 2.6; G.camPitch = 0.85; G.camDist = 4.4; }); await W(150); await shot('tension', p);
  ok(sit < 3, 'Pistache assis à côté (' + sit + ' m)');
  let got = await phase(p, 'pris|rate'); let F = await ev(() => { const F = __game.peche.F; return { ph: F.ph, fish: F.fish, msg: F.msg }; });
  for (let k = 0; k < 3 && F.ph !== 'pris'; k++) { await ev(() => document.querySelector('#pkBtns .btn').click()); await phase(p, 'pris|rate'); F = await ev(() => { const F = __game.peche.F; return { ph: F.ph, fish: F.fish, msg: F.msg }; }); }
  await W(200); await shot('prise', p);
  ok(F.ph === 'pris' && await ev(f => __game.S.inv.some(i => i.id === f) && __game.S.peche.rec[f].n >= 1, F.fish), 'prise : ' + F.fish + ' (' + (F.msg || '').replace(/<[^>]+>/g, '') + ')');
  // ---------- 4. ratés ----------
  await pilot(p, 'rien'); await ev(() => document.querySelector('#pkBtns .btn').click());
  await phase(p, 'rate'); F = await ev(() => __game.peche.F.msg); ok(/reparti/.test(F), 'raté : touche pas ferrée → « ' + F + ' »');
  await ev(() => { clearInterval(window.__pk); window.__pk = setInterval(() => { const F = __game.peche.F; if (!F) return; if (F.ph === 'attente' && F.bite > 1.2) F.bite = 1.2; if (F.ph === 'touche') F.tap = true; if (F.ph === 'combat') F.hold = false; }, 25); });
  await ev(() => document.querySelector('#pkBtns .btn').click());
  await phase(p, 'rate'); F = await ev(() => __game.peche.F.msg); ok(/décroché/.test(F), 'raté : ligne relâchée → « ' + F + ' »');
  // ---------- 5. quête (4 poissons) ----------
  await pilot(p, 'bon');
  for (let k = 0; k < 10 && (await ev(() => __game.S.q.peche_blanche.st)) === 'active'; k++) { await ev(() => document.querySelector('#pkBtns .btn').click()); await phase(p, 'pris|rate'); }
  ok((await ev(() => __game.S.q.peche_blanche.st)) === 'ready', 'quête : 4 poissons (' + (await ev(() => __game.S.peche.n)) + ' en tout)');
  await ev(() => [...document.querySelectorAll('#pkBtns .btn')].find(b => /SORTIR/.test(b.textContent)).click()); await W(300);
  ok((await ev(() => __game.G.state)) === 'play' && await ev(() => !document.getElementById('peche') || document.getElementById('peche').classList.contains('hidden')), 'SORTIR : retour au jeu');
  // ---------- 6. cuisine, vente, quête rendue ----------
  await ev(() => __game.addItem('poulamon', 3)); ok(await ev(() => __game.craft('friture') && __game.S.inv.some(i => i.id === 'friture')), 'cuisine : friture de poulamons');
  const nf = await ev(() => __game.S.inv.filter(i => ['poulamon', 'perchaude', 'dore', 'brochet', 'maski'].includes(i.id)).length);
  const c1 = await ev(() => __game.S.cash); await talk(); await btn('MERCI'); await W(300);
  ok((await ev(() => __game.S.q.peche_blanche.st)) === 'done', 'quête rendue');
  await close(); await talk(); const sold = nf ? await btn('VENDRE') : true;
  ok(sold && (!nf || (await ev(() => __game.S.cash)) > c1 + 60) && await ev(() => !__game.S.inv.some(i => ['poulamon', 'perchaude', 'dore', 'brochet', 'maski'].includes(i.id))), 'poissons vendus à Ti-Guy (+' + ((await ev(() => __game.S.cash)) - c1) + ' $ avec la récompense)');
  await close();
  // ---------- 7. tableau des records ----------
  await tp(PK.board.x, PK.board.z - 1.2, 1200);
  const bp = await ev(() => document.getElementById('prompt').textContent); ok(/records/.test(bp), 'tableau : « ' + bp + ' »');
  await ev(() => __game.pressed.add('KeyE')); await W(500);
  const tb = await ev(() => document.getElementById('dtext').textContent); ok(/Poisson.*Record/.test(tb) && /kg/.test(tb), 'records affichés');
  await shot('records', p); await close();
  // ---------- 8. sauvegarde ----------
  const rec = await ev(() => JSON.stringify(__game.S.peche.rec)); await ev(() => __game.writeSave()); await p.reload(); await W(2500);
  await p.click('#bCont'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 90000 }); await W(1500);
  ok((await ev(() => JSON.stringify(__game.S.peche.rec))) === rec, 'rechargé : records gardés');
  const ns = await ev(() => __game.normSave({ q: {} }).peche); ok(ns && ns.rent === -1 && ns.n === 0 && typeof ns.rec === 'object', 'vieille partie : S.peche créé ' + JSON.stringify(ns));
  // ---------- 9. téléphone ----------
  const m = await mk({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const tpm = tpF(m);
  await boot(m, true); await m.evaluate(() => { const g = __game; g.setSeason(0); g.S.peche.rent = g.S.day; g.petGive('raton'); }); await m.waitForTimeout(1000);
  await tpm(H.x, H.z, 1800);
  const tt = await m.evaluate(() => { const t = document.getElementById('tTalk'); return t.classList.contains('hidden') ? '' : t.textContent; }); ok(tt === 'PÊCHE', 'téléphone : bouton « ' + tt + ' » dans la cabane');
  await m.tap('#tTalk'); await m.waitForTimeout(400); ok((await m.evaluate(() => __game.G.state)) === 'peche' && await m.evaluate(() => getComputedStyle(document.getElementById('peche')).display !== 'none' && getComputedStyle(document.getElementById('touch')).display === 'none'), 'téléphone : mini-jeu lancé (panneau visible, manettes cachées)');
  await pilot(m, 'bon', true); await phase(m, 'combat');
  await m.waitForFunction(() => { const F = __game.peche.F; return F && (F.ph !== 'combat' || F.prog > 0.5); }, null, { timeout: 30000 }).catch(() => {});
  await m.evaluate(() => { const G = __game.G; G.camYaw = 2.6; G.camPitch = 0.9; G.camDist = 4.6; }); await m.waitForTimeout(150); await shot('mobile', m);
  let mf = await phase(m, 'pris|rate'); for (let k = 0; k < 3 && (await m.evaluate(() => __game.peche.F.ph)) !== 'pris'; k++) { await m.evaluate(() => document.querySelector('#pkBtns .btn').click()); await phase(m, 'pris|rate'); }
  ok((await m.evaluate(() => __game.peche.F.ph)) === 'pris' && (await m.evaluate(() => __game.S.peche.n)) >= 1, 'téléphone : poisson pris au bouton TIRE (pointeurs tactiles)');
  ok(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(bad.length ? 'PÊCHE ÉCHEC (' + bad.length + ')' : 'PÊCHE OK');
  await b.close(); srv.close(); process.exit(bad.length ? 1 : 0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });

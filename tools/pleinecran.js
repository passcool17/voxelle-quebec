// Plein écran mobile : PORT=8940 node tools/pleinecran.js
// 1) mobile 844×390 tactile : bouton titre → document.fullscreenElement, icône, rendu à la taille de l'écran ; JOUER → plein écran auto ;
//    bouton du HUD (sans chevauchement avec les commandes) ; zones sûres simulées (encoche) ; captures.
// 2) iPhone (pas de plein écran d'élément) : bouton → astuce « écran d'accueil ». 3) bureau : pas de bouton tactile, bouton dans les options.
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8940), SH = __dirname + '/../shots/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const errs = [], ok = {};
const watch = (p, tag) => { p.on('pageerror', e => errs.push(tag + ' pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(tag + ' console: ' + m.text()); }); };
const inter = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
(async () => {
  const t0 = Date.now(), srv = await serve(PORT), browser = await chromium.launch({ args: ARGS });
  // ---------- 1. mobile ----------
  const mc = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const m = await mc.newPage(); watch(m, 'mobile');
  await m.goto(`http://localhost:${PORT}/`); await m.evaluate(() => localStorage.clear()); await m.reload(); await m.waitForTimeout(2500);
  await m.evaluate(() => { window.__fsEv = 0; document.addEventListener('fullscreenchange', () => window.__fsEv++); });
  const st = await m.evaluate(() => ({ mode: __game.FS.mode, touch: document.body.classList.contains('touch'), vis: !document.getElementById('fsTitle').classList.contains('hidden'), r: document.getElementById('fsTitle').getBoundingClientRect().toJSON(), menu: document.querySelector('#title .menu').getBoundingClientRect().toJSON(), logo: document.querySelector('#title .logo').getBoundingClientRect().toJSON() }));
  console.log('titre', JSON.stringify(st));
  ok.boutonTitre = st.mode === 'api' && st.touch && st.vis && !inter(st.r, st.menu) && !inter(st.r, st.logo) && st.r.width <= 60;
  await m.screenshot({ path: SH + 'pleinecran-mobile-titre.png' });
  await m.tap('#fsTitle'); await m.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 5000 }).catch(() => {}); await m.waitForTimeout(400);
  const fsIn = await m.evaluate(() => { const r = __game.renderer, c = r.domElement, b = document.getElementById('fsTitle');
    return { el: document.fullscreenElement === document.documentElement, ev: window.__fsEv, pressed: b.getAttribute('aria-pressed'), title: b.title, cw: c.clientWidth, ch: c.clientHeight, bw: c.width, bh: c.height, pr: r.getPixelRatio(), iw: innerWidth, ih: innerHeight, aspect: +__game.camera.aspect.toFixed(4) }; });
  console.log('après bouton', JSON.stringify(fsIn));
  ok.pleinEcran = fsIn.el && fsIn.ev >= 1 && fsIn.pressed === 'true' && fsIn.title.startsWith('Quitter');
  ok.rendu = fsIn.cw === fsIn.iw && fsIn.ch === fsIn.ih && fsIn.bw === Math.round(fsIn.iw * fsIn.pr) && Math.abs(fsIn.aspect - fsIn.iw / fsIn.ih) < 1e-3;
  await m.tap('#fsTitle'); await m.waitForFunction(() => !document.fullscreenElement, null, { timeout: 5000 }).catch(() => {}); await m.waitForTimeout(300);
  const fsOut = await m.evaluate(() => ({ el: !!document.fullscreenElement, pressed: document.getElementById('fsTitle').getAttribute('aria-pressed') }));
  console.log('sortie', JSON.stringify(fsOut)); ok.sortie = !fsOut.el && fsOut.pressed === 'false';
  // redimensionnement (rotation / barre d'adresse ; hors plein écran : Chrome refuse de redimensionner une fenêtre plein écran) : le rendu suit
  const n0 = await m.evaluate(() => __game.resizeN); await m.setViewportSize({ width: 800, height: 360 }); await m.waitForTimeout(500);
  const rs = await m.evaluate(() => ({ n: __game.resizeN, cw: __game.renderer.domElement.clientWidth, ch: __game.renderer.domElement.clientHeight, a: +__game.camera.aspect.toFixed(4) }));
  await m.setViewportSize({ width: 844, height: 390 }); await m.waitForTimeout(500);
  console.log('redimensionné', JSON.stringify(rs)); ok.redim = rs.n > n0 && rs.cw === 800 && rs.ch === 360 && Math.abs(rs.a - 800 / 360) < 1e-3;
  // JOUER → plein écran automatique (geste)
  await m.tap('#bNew'); await m.waitForTimeout(300); const auto = await m.evaluate(() => !!document.fullscreenElement);
  await m.tap('#bPersoGo'); await m.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 }); await m.waitForTimeout(3500);
  console.log('plein écran auto au lancement', auto); ok.auto = auto;
  const hud = await m.evaluate(() => { const R = id => { const e = document.getElementById(id); return e && e.offsetParent !== null ? e.getBoundingClientRect().toJSON() : null; };
    const ids = ['stick', 'tAtk', 'tJump', 'tRoll', 'tBrk', 'tPlace', 'tEat', 'tSwap', 'tInv', 'tQuest', 'tMap', 'tCraft', 'tPause', 'hotbar', 'mapbox', 'stats', 'tracker'];
    return { fs: R('tFs'), pressed: document.getElementById('tFs').getAttribute('aria-pressed'), others: Object.fromEntries(ids.map(i => [i, R(i)])) }; });
  const hits = Object.entries(hud.others).filter(([, r]) => inter(hud.fs, r)).map(([k]) => k);
  console.log('bouton HUD', JSON.stringify(hud.fs), 'chevauche', hits.length ? hits : 'rien');
  const lay0 = await m.evaluate(() => { const R = s => document.querySelector(s).getBoundingClientRect(); return { stats: R('#stats').right, top: R('#tTop').left, hot: R('#hotbar').left }; });
  console.log('disposition', JSON.stringify(lay0));
  ok.boutonHUD = lay0.stats < lay0.top && lay0.stats < lay0.hot && !!hud.fs && hits.length === 0 && hud.fs.width <= 60 && hud.pressed === (auto ? 'true' : 'false');
  await m.evaluate(() => { const G = __game.G; G.spawnT = 1e9; G.camPitch = 0.3; }); await m.waitForTimeout(800);
  await m.screenshot({ path: SH + 'pleinecran-mobile-hud.png' });
  await m.tap('#tFs'); await m.waitForTimeout(400); const hudOut = await m.evaluate(() => ({ el: !!document.fullscreenElement, pressed: document.getElementById('tFs').getAttribute('aria-pressed'), state: __game.G.state }));
  await m.tap('#tFs'); await m.waitForTimeout(400); const hudIn = await m.evaluate(() => !!document.fullscreenElement);
  console.log('HUD bascule', JSON.stringify(hudOut), 'puis', hudIn); ok.basculeHUD = !hudOut.el && hudOut.pressed === 'false' && hudOut.state === 'play' && hudIn;
  // zones sûres simulées : encoche à gauche (paysage), barre d'accueil en bas
  const SA = { l: 44, r: 44, b: 21, t: 0 };
  await m.evaluate(SA => { const s = document.documentElement.style; for (const k in SA) s.setProperty('--sa-' + k, SA[k] + 'px');
    const n = document.createElement('div'); n.id = 'fakeNotch'; n.style.cssText = 'position:fixed;left:0;top:50%;width:32px;height:190px;margin-top:-95px;background:#000;border-radius:0 26px 26px 0;z-index:99;pointer-events:none';
    const h = document.createElement('div'); h.style.cssText = 'position:fixed;left:50%;bottom:7px;width:140px;height:5px;margin-left:-70px;background:#fff;border-radius:3px;z-index:99;pointer-events:none;opacity:.8'; document.body.append(n, h); }, SA);
  await m.waitForTimeout(500);
  const sa = await m.evaluate(() => { const R = s => document.querySelector(s).getBoundingClientRect(); const W = innerWidth, H = innerHeight;
    return { stats: R('#stats').left, stick: R('#stick').left, atk: W - R('#tAtk').right, map: W - R('#mapbox').right, stickB: H - R('#stick').bottom, fs: R('#tFs').top, canvasW: __game.renderer.domElement.clientWidth }; });
  const lay = await m.evaluate(() => { const R = s => document.querySelector(s).getBoundingClientRect(); return { stats: R('#stats').right, top: R('#tTop').left, hot: R('#hotbar').left, statsB: R('#stats').bottom, hotT: R('#hotbar').top }; });
  sa.lay = lay; sa.layOk = lay.stats < lay.top && (lay.stats < lay.hot || lay.statsB < lay.hotT);
  console.log('zones sûres', JSON.stringify(sa));
  ok.zonesSures = sa.stats >= SA.l && sa.stick >= SA.l && sa.atk >= SA.r && sa.map >= SA.r && sa.stickB >= SA.b && sa.canvasW === 844 && sa.layOk;
  await m.screenshot({ path: SH + 'pleinecran-mobile-zones-sures.png' });
  // ---------- 2. iPhone : pas de requestFullscreen sur les éléments ----------
  const ic = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  await ic.addInitScript(() => { delete Element.prototype.requestFullscreen; delete Element.prototype.webkitRequestFullscreen; Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false, configurable: true }); });
  const ip = await ic.newPage(); watch(ip, 'iphone');
  await ip.goto(`http://localhost:${PORT}/`); await ip.waitForTimeout(2500);
  const i1 = await ip.evaluate(() => ({ mode: __game.FS.mode, ios: __game.FS.isIOS, vis: !document.getElementById('fsTitle').classList.contains('hidden') }));
  await ip.tap('#fsTitle'); await ip.waitForTimeout(300);
  const i2 = await ip.evaluate(() => ({ hint: document.getElementById('fshint').classList.contains('hidden') ? '' : document.getElementById('fshint').textContent, fs: !!document.fullscreenElement }));
  console.log('iPhone', JSON.stringify(i1), JSON.stringify(i2)); ok.iphone = i1.mode === 'ios' && i1.ios && i1.vis && /écran d’accueil/.test(i2.hint) && !i2.fs;
  await ip.tap('#bNew'); await ip.waitForTimeout(300); ok.iphoneJouer = await ip.isVisible('#perso');
  // ---------- 3. bureau ----------
  const dp = await browser.newPage({ viewport: { width: 1280, height: 720 } }); watch(dp, 'bureau');
  await dp.goto(`http://localhost:${PORT}/`); await dp.waitForTimeout(2500);
  const d1 = await dp.evaluate(() => ({ title: !document.getElementById('fsTitle').classList.contains('hidden'), hud: !document.getElementById('tFs').classList.contains('hidden'), auto: !document.getElementById('oFsAutoL').classList.contains('hidden') }));
  await dp.click('#bOpts'); const optBtn = await dp.isVisible('#bFs'); const optTxt = await dp.textContent('#bFs');
  await dp.click('#bFs'); await dp.waitForTimeout(400); const dFs = await dp.evaluate(() => !!document.fullscreenElement);
  await dp.click('#bFs'); await dp.waitForTimeout(400); const dOut = await dp.evaluate(() => !document.fullscreenElement);
  console.log('bureau', JSON.stringify(d1), 'options', optBtn, optTxt, dFs, dOut); ok.bureau = !d1.title && !d1.hud && !d1.auto && optBtn && dFs && dOut;
  ok.erreurs = errs.length === 0;
  await browser.close(); srv.close();
  console.log('captures', SH + 'pleinecran-mobile-hud.png', SH + 'pleinecran-mobile-zones-sures.png', SH + 'pleinecran-mobile-titre.png');
  console.log('RÉSULTAT', JSON.stringify(ok), 'durée', Math.round((Date.now() - t0) / 1000) + ' s');
  console.log(errs.length ? errs.slice(0, 20).join('\n') : 'aucune erreur JS');
  process.exit(Object.values(ok).every(Boolean) ? 0 : 1);
})().catch(e => { console.error('ÉCHEC', e); process.exit(2); });

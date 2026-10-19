// Phase 4 (graphismes) : vérifie et capture les effets — eau (scintillement, gouttes de pluie), érablière (feuilles qui tombent),
// lucioles la nuit, brume du matin, fenêtres chaudes, ombres rondes en qualité basse + mobile. PORT=8918 node tools/effets.js
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8918), SH = __dirname + '/../shots/', PFX = 'apres-amelio-p4-';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const fails = []; const ok = (c, m) => { console.log((c ? 'OK   ' : 'ÉCHEC ') + m); if (!c) fails.push(m); };
(async () => {
  const srv = await serve(PORT);
  const browser = await chromium.launch({ args: ARGS });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const ev = (f, a) => p.evaluate(f, a);
  const gw = s => ev(s => new Promise(r => { const t0 = __game.G.t; const f = () => __game.G.t - t0 >= s ? r() : setTimeout(f, 50); f(); }), s);
  await p.goto(`http://localhost:${PORT}/`);
  await ev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 5 })); }); await p.reload();
  await p.waitForTimeout(4000);
  await p.click('#bNew'); await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  const go = async (x, z, wet) => { await ev(([x, z, wet]) => { const g = __game, G = g.G, P = G.P; for (const e of G.enemies) { e.hp = 0; e.dead = true; e.model.g.visible = false; e.label.style.display = 'none'; }
      G.spawnT = 1e9; G.weatherT = 1e9; g.sky.snowT = 0; g.sky.snow = 0; g.sky.rainT = wet ? 1 : 0; g.sky.rain = wet ? 1 : 0; P.x = x; P.z = z; P.y = g.gen.heightAt(x, z) + 4; P.vx = P.vy = P.vz = 0; P.hp = 1e6; G.godT = 1e6; window.__sc = [x, z]; }, [x, z, wet]);
    await p.waitForFunction(() => __game.world.loadedAround(__sc[0], __sc[1], 2) && __game.world.loadedFrac() > 0.9, null, { timeout: 120000 }).catch(() => console.log('chargement incomplet'));
    await ev(() => { const g = __game, P = g.G.P; P.y = g.world.ground(P.x, P.z, 120); P.vy = 0; }); };
  const cam = (yaw, pitch, dist, t) => ev(([yaw, pitch, dist, t]) => { const g = __game, G = g.G; G.camYaw = yaw; G.camPitch = pitch; G.camDist = dist; g.sky.t = t; }, [yaw, pitch, dist, t]);
  const shot = n => p.screenshot({ path: SH + PFX + n + '.png' }).then(() => console.log('capture', SH + PFX + n + '.png'));
  // trouver une érablière et une campagne près de la ville (spirale sur la carte)
  const spots = await ev(() => { const g = __game.gen, B = { CAMPAGNE: 1, ERABLIERE: 3 }, out = {};
    for (let r = 60; r < 900 && !(out.er && out.ca); r += 24) for (let a = 0; a < 6.28; a += 0.25) { const x = Math.round(Math.cos(a) * r), z = Math.round(-200 + Math.sin(a) * r); if (z < -600) continue; const c = g.column(x, z);
      if (c.w > 0.05 || c.wl > c.h) continue; if (!out.er && c.biome === B.ERABLIERE) out.er = [x, z]; if (!out.ca && c.biome === B.CAMPAGNE) out.ca = [x, z]; }
    return out; });
  console.log('lieux', JSON.stringify(spots));
  // 1. eau au soleil : scintillement + bleu plus profond
  const sx = 30, sz = await ev(x => __game.gen.riverZ(x) + __game.gen.riverW(x) + 5, sx);
  await go(sx, sz); await cam(0, 0.32, 9, 0.6); await gw(1.5);
  const wU = await ev(() => { let u = null; __game.G.scene?.traverse?.(o => { if (o.material?.uniforms?.rain) u = 1; }); return u; });
  await shot('eau-soleil');
  // 2. pluie sur l'eau : ronds de gouttes
  await go(sx, sz, true); await cam(0, 0.5, 7, 0.45); await gw(2);
  const rainU = await ev(() => __game.sky.rain); ok(rainU > 0.9, 'pluie active pour les ronds sur l’eau (' + rainU.toFixed(2) + ')');
  await shot('eau-pluie');
  // 3. érablière : feuilles qui tombent
  if (spots.er) { await go(spots.er[0], spots.er[1]); await cam(0.4, 0.2, 7, 0.42); await gw(5);
    const L = await ev(() => ({ v: __game.amb.leaf.p.visible, a: __game.amb.leafA })); ok(L.v && L.a > 0.5, 'feuilles d’érable qui tombent (alpha ' + L.a.toFixed(2) + ')'); await shot('erabliere-feuilles'); }
  else ok(false, 'aucune érablière trouvée');
  // 4. lucioles la nuit en campagne
  if (spots.ca) { await go(spots.ca[0], spots.ca[1]); await cam(0.8, 0.12, 6, 0.03); await gw(6);
    const F = await ev(() => ({ v: __game.amb.fly.p.visible, a: __game.amb.flyA })); ok(F.v && F.a > 0.4, 'lucioles la nuit (alpha ' + F.a.toFixed(2) + ')'); await shot('lucioles'); }
  // 5. brume du matin au village
  const vil = await ev(() => { const c = __game.gen.cell(-1, 0); return [c.x, c.z]; });
  await go(vil[0] + 2, vil[1] + 8); await cam(0.2, 0.3, 16, 0.27); await gw(1);
  const mist = await ev(() => __game.sky.mist); ok(mist > 0.8, 'brume du matin (' + mist.toFixed(2) + ')'); await shot('brume-matin');
  // jour : pas de lucioles, pas de brume
  await cam(0.2, 0.3, 16, 0.45); await gw(6); const day = await ev(() => ({ m: __game.sky.mist, f: __game.amb.flyA })); ok(day.m < 0.01 && day.f < 0.1, 'de jour : ni brume ni lucioles');
  // 6. fenêtres chaudes la nuit en ville
  await go(0.5, -66); await cam(-0.3, 0.1, 10, 0.02); await gw(1.5); await shot('ville-nuit');
  // 7. qualité basse : ombres portées coupées, ombres rondes sous les personnages
  await ev(() => { __game.OPT.qual = 'low'; __game.applyQuality(); });
  const vc = await ev(() => { const c = __game.gen.cell(0, 0); return [c.x, c.z]; }); await go(vc[0] + 3, vc[1] + 6); await cam(0.3, 0.55, 9, 0.45); await gw(1.5);
  const sh = await ev(() => ({ s: __game.renderer.shadowMap.enabled, b: (() => { let v = null; __game.G.P.model?.g?.traverse?.(o => { if (o.geometry?.type === 'CircleGeometry') v = o.material.visible; }); return v; })() }));
  ok(!sh.s, 'qualité basse : ombres portées coupées'); await shot('ombres-rondes');
  console.log('ombres rondes', JSON.stringify(sh));
  // pas de dépassement de matériau : retour en qualité moyenne
  await ev(() => { __game.OPT.qual = 'mid'; __game.applyQuality(); }); await gw(0.5);
  await browser.close();
  // 8. mobile (tactile) : effets actifs, pas d'erreur
  const b2 = await chromium.launch({ args: ARGS });
  const mc = await b2.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await mc.newPage(); mp.on('pageerror', e => errs.push('mobile pageerror: ' + e.message)); mp.on('console', m => { if (m.type() === 'error') errs.push('mobile console: ' + m.text()); });
  await mp.goto(`http://localhost:${PORT}/`); await mp.evaluate(() => localStorage.clear()); await mp.reload(); await mp.waitForTimeout(3000);
  await mp.tap('#bNew'); await mp.tap('#bPersoGo'); await mp.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 }); await mp.waitForTimeout(5000);
  const mi = await mp.evaluate(() => ({ shadows: __game.renderer.shadowMap.enabled, fly: __game.amb.fly.p.geometry.attributes.position.count, fps: __game.G.fps }));
  ok(!mi.shadows && mi.fly <= 30, 'mobile : ombres rondes, effets allégés ' + JSON.stringify(mi));
  await mp.screenshot({ path: SH + PFX + 'mobile.png' }); console.log('capture', SH + PFX + 'mobile.png');
  await b2.close();
  ok(!errs.length, 'aucune erreur JS' + (errs.length ? ' :\n' + errs.join('\n') : ''));
  console.log(fails.length ? 'EFFETS ÉCHEC (' + fails.length + ')' : 'EFFETS OK');
  srv.close(); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('ÉCHEC', e); process.exit(2); });

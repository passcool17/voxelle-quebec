// Test du choix de personnage : écran de choix, héroïne en jeu (marche, frappe, saut), mémoire localStorage, retour au héros.
// PORT=8918 node tools/perso.js
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const serve = require('./serve');
const PORT = +(process.env.PORT || 8918), SH = __dirname + '/../shots/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
(async () => {
  const srv = await serve(PORT); const browser = await chromium.launch({ args: ARGS });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [], res = {};
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const ev = (f, a) => p.evaluate(f, a);
  await p.goto(`http://localhost:${PORT}/`); await ev(() => { localStorage.clear(); localStorage.setItem('voxelle-quebec-opts', JSON.stringify({ qual: 'mid', view: 4 })); }); await p.reload();
  await p.waitForTimeout(3000);
  res.defaut = (await p.textContent('#persoNom')) === 'LE HÉROS';
  await p.click('#bNew'); await p.waitForSelector('#perso:not(.hidden)'); await p.waitForTimeout(800);
  await p.click('.pcard[data-p="fille"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: SH + 'perso-choix.png' });
  res.carteOn = await ev(() => document.querySelector('.pcard[data-p="fille"]').classList.contains('on'));
  res.portraits = await ev(() => [...document.querySelectorAll('.pcard canvas')].every(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n > 2000; }));
  await p.click('#bPersoGo'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  res.memoire = await ev(() => localStorage.getItem('voxelle-quebec-perso') === 'fille' && __game.perso() === 'fille');
  res.queue = await ev(() => !!__game.G.P.model.P.queue);
  // un peu de jeu : marcher, frapper, sauter
  await p.waitForTimeout(3000);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(2500); await p.keyboard.press('Space'); await p.waitForTimeout(800); await p.keyboard.up('KeyW');
  for (let i = 0; i < 3; i++) { await p.mouse.down(); await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(500); }
  res.joue = await ev(() => __game.G.state === 'play' || __game.G.state === 'pause');
  await ev(() => { if (__game.G.state === 'pause') document.getElementById('bResume').click(); });
  await ev(() => { const G = __game.G; G.camYaw = G.P.yaw + 2.4; G.camPitch = 0.15; G.camDist = 4; });
  await p.waitForTimeout(1500); await p.screenshot({ path: SH + 'perso-heroine-jeu.png' });
  // rechargement : le menu affiche l'héroïne, puis on repasse au héros
  await ev(() => __game.writeSave()); await p.reload(); await p.waitForTimeout(3000);
  res.menuFille = (await p.textContent('#persoNom')) === 'L’HÉROÏNE';
  await p.click('#bPerso'); await p.click('.pcard[data-p="gars"]'); await p.click('#bPersoGo');
  res.retourGars = (await p.textContent('#persoNom')) === 'LE HÉROS' && await p.isVisible('#title');
  await p.screenshot({ path: SH + 'perso-titre.png' });
  await p.click('#bCont'); await p.waitForFunction(() => __game.G.state === 'play', null, { timeout: 120000 });
  res.contGars = await ev(() => !__game.G.P.model.P.queue);
  console.log(JSON.stringify(res));
  console.log(errs.length ? errs.join('\n') : 'aucune erreur JS');
  const ok = Object.values(res).every(v => v === true) && !errs.length; console.log(ok ? 'PERSO OK' : 'PERSO ÉCHEC');
  await browser.close(); srv.close(); process.exit(ok ? 0 : 1);
})();

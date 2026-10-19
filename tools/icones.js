// Génère les icônes de l'appli (manifest + écran d'accueil iOS) par code : node tools/icones.js
// Tuque rouge en pixels (pompon, rebord blanc) sur fond marine.
const { chromium } = require('/workspace/tnd-run/node_modules/playwright');
const fs = require('fs'), OUT = __dirname + '/../assets/';
const SIZES = [['icon192.png', 192, 0.86], ['icon512.png', 512, 0.86], ['apple-touch-icon.png', 180, 0.86], ['icon-maskable512.png', 512, 0.62]];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  for (const [name, S, k] of SIZES) {
    const url = await p.evaluate(([S, k]) => {
      const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
      const bg = g.createLinearGradient(0, 0, 0, S); bg.addColorStop(0, '#1f3f8a'); bg.addColorStop(1, '#14243a'); g.fillStyle = bg; g.fillRect(0, 0, S, S);
      // neige au sol
      g.fillStyle = '#dfefff'; g.fillRect(0, S * 0.84, S, S * 0.16); g.fillStyle = '#b8d4ee'; g.fillRect(0, S * 0.84, S, S * 0.02);
      // grille 16×16 pixels, centrée et réduite par k
      const M = [
        '......WWWW......',
        '.....WWWWWW.....',
        '......WWWW......',
        '.......RR.......',
        '.....RRRRRR.....',
        '....RRRRRRRR....',
        '...RRRRRRRRRR...',
        '...RRRRRRRRRR...',
        '..RRRRRRRRRRRR..',
        '...RRRRRRRRRR...',
        '..RRRRRRRRRRRR..',
        '.WWWWWWWWWWWWWW.',
        '.WGWWGWWGWWGWWG.',
        '.WWWWWWWWWWWWWW.',
        '................',
        '................'];
      const C = { W: '#ffffff', G: '#c8d8ea', R: '#e0282e', B: '#ffffff' }, D = { W: '#c8d8ea', G: '#9fb4cc', R: '#a8181e', B: '#dde' };
      const cell = S * k / 16, ox = (S - cell * 16) / 2, oy = (S - cell * 16) / 2 + S * 0.05;
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(ox + cell * 1.3, oy + cell * 14.1, cell * 14, cell * 0.8); // ombre
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const ch = M[y][x]; if (ch === '.') continue;
        g.fillStyle = C[ch]; g.fillRect(Math.floor(ox + x * cell), Math.floor(oy + y * cell), Math.ceil(cell), Math.ceil(cell));
        g.fillStyle = D[ch]; g.fillRect(Math.floor(ox + x * cell), Math.floor(oy + (y + 0.78) * cell), Math.ceil(cell), Math.ceil(cell * 0.22)); }
      // flocons
      g.fillStyle = 'rgba(255,255,255,.75)'; for (const [fx, fy] of [[0.12, 0.14], [0.86, 0.1], [0.9, 0.42], [0.08, 0.55], [0.78, 0.7]]) g.fillRect(fx * S, fy * S, S * 0.025, S * 0.025);
      return c.toDataURL('image/png');
    }, [S, k]);
    fs.writeFileSync(OUT + name, Buffer.from(url.split(',')[1], 'base64')); console.log('écrit', name, S + 'px');
  }
  await b.close();
})();

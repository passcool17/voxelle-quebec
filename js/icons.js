// Icônes pixel dessinées par le code (objets et blocs), en dataURL.
import { COL } from './blocks.js';
const cache = new Map();
const hex = c => '#' + c.toString(16).padStart(6, '0');
function shade(c, m) { return 'rgb(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].map(v => Math.min(255, v * m) | 0).join(',') + ')'; }
export function blockIcon(b) {
  const k = 'b' + b; if (cache.has(k)) return cache.get(k);
  const cv = document.createElement('canvas'); cv.width = cv.height = 32; const x = cv.getContext('2d'); const c = COL[b];
  const P = (pts, f) => { x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); x.fillStyle = f; x.fill(); };
  P([16, 3, 29, 9, 16, 15, 3, 9], shade(c[0], 1.05)); P([3, 9, 16, 15, 16, 29, 3, 23], shade(c[1], 0.85)); P([16, 15, 29, 9, 29, 23, 16, 29], shade(c[1], 0.65));
  x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(16, 3); x.lineTo(29, 9); x.lineTo(29, 23); x.lineTo(16, 29); x.lineTo(3, 23); x.lineTo(3, 9); x.closePath(); x.moveTo(3, 9); x.lineTo(16, 15); x.lineTo(29, 9); x.moveTo(16, 15); x.lineTo(16, 29); x.stroke();
  const u = cv.toDataURL(); cache.set(k, u); return u;
}
// grilles 12x12 : lettres -> couleurs
const PAL = { k: '#111', w: '#f2f2f2', b: '#8b6a3e', B: '#5a3a22', r: '#c8282e', R: '#8a1c2a', y: '#f2c12e', o: '#ff7a1a', g: '#3a8a3a', u: '#2e5fa8', U: '#1f3f8a', s: '#c9ced6', S: '#8a8f98', c: '#c07a20', C: '#e8b84a', p: '#f8f8f0', m: '#7a4a22', e: '#e8c040', v: '#9a6adf', n: '#222428' };
const ART = {
  baton: ['..........b.', '.........b..', '........b...', '.......b....', '......b.....', '.....b......', '....b.......', '...b........', '..k.........', '.kk.........', 'kkkww.......', 'kkk.........'],
  baton_carbone: ['..........n.', '.........n..', '........n...', '.......n....', '......n.....', '.....n......', '....n.......', '...n........', '..k.........', '.kk.........', 'kkkyy.......', 'kkk.........'],
  baton_or: ['..........e.', '.........e..', '........e...', '.......e....', '......e.....', '.....e......', '....e.......', '...e........', '..y.........', '.yy.........', 'yyyww.......', 'yyy.........'],
  pelle: ['.........kkk', '..........b.', '.........b..', '........b...', '.......b....', '......b.....', '.....b......', '..uuub......', '.uuuuu......', '.uuuuu......', '.uuuuu......', '..uuu.......'],
  pelle_alu: ['.........kkk', '..........b.', '.........b..', '........b...', '.......b....', '......b.....', '.....b......', '..sssb......', '.sssss......', '.sssss......', '.sssss......', '..sss.......'],
  lanceur: ['............', '......ww....', '.....wwww...', '.....wwww...', '..uuuuuuuuk.', '.uuuuuuuuuk.', '.uuuuuuuuuk.', '..uuSS......', '....SS......', '....SS......', '............', '............'],
  tuque: ['.....ww.....', '....wwww....', '.....ww.....', '....rrrr....', '...rrrrrr...', '..rrrrrrrr..', '..rrrrrrrr..', '.rrrrrrrrrr.', '.wwwwwwwwww.', '.wwwwwwwwww.', '............', '............'],
  tuque_patrimoine: ['.....yy.....', '....yyyy....', '.....yy.....', '....uuuu....', '...uuuuuu...', '..uuwuuwuu..', '..uuuuuuuu..', '.uuuuuuuuuu.', '.wwwwwwwwww.', '.wwwwwwwwww.', '............', '............'],
  mitaines: ['............', '...rrrr.....', '..rrrrrr....', '..rrrrrr.rr.', '..rrrrrrrrr.', '..rrrrrrrr..', '..rrrrrrr...', '..rrrrrrr...', '..wwwwwww...', '..wwwwwww...', '............', '............'],
  mitaines_doublees: ['............', '...uuuu.....', '..uuuuuu....', '..uuuuuu.uu.', '..uuuuuuuuu.', '..uuuuuuuu..', '..uuuuuuu...', '..uuuuuuu...', '..yyyyyyy...', '..yyyyyyy...', '............', '............'],
  manteau: ['...uu..uu...', '..uuuuuuuu..', '.uuuuwwuuuu.', '.uuuuwwuuuu.', '.uu.uwwu.uu.', '.uu.uwwu.uu.', '.uu.rrrr.uu.', '....uwwu....', '....uwwu....', '....uuuu....', '............', '............'],
  bottes: ['............', '..BB....BB..', '..BB....BB..', '..BB....BB..', '..BB....BB..', '..BBB...BBB.', '..BBBB..BBBB', '..kkkk..kkkk', '............', '............', '............', '............'],
  poutine: ['............', '...C.C..C...', '..CCmCCmCC..', '..CmpCmCpC..', '.wwwwwwwwww.', '.wwrwwrwwrw.', '.wwwwwwwwww.', '..wwwwwwww..', '..wwwwwwww..', '............', '............', '............'],
  sirop: ['....ww......', '....ww......', '...cccc..c..', '..cccccccc..', '..cccwwccc..', '..ccwrrwcc..', '..ccwrrwcc..', '..cccwwccc..', '..cccccccc..', '..cccccccc..', '............', '............'],
  tourtiere: ['............', '............', '...CCCCCC...', '..CmCCCCmC..', '.CCCCmmCCCC.', '.CmCCCCCCmC.', '.CCCCCCCCCC.', '.SSSSSSSSSS.', '..SSSSSSSS..', '............', '............', '............'],
  permis: ['..pppppppp..', '..pUUUUUUp..', '..pppppppp..', '..pSSSSSSp..', '..pppppppp..', '..pSSSSSSp..', '..pppppppp..', '..pSSSSppp..', '..ppppprrp..', '..ppppprrp..', '..pppppppp..', '............'],
  chaudiere: ['............', '...kkkkkk...', '..k......k..', '..ssssssss..', '..sccccccs..', '..ssssssss..', '..ssssssss..', '..ssssssss..', '..ssssssss..', '...ssssss...', '............', '............'],
  glider: ['............', 'rrruurryyrrr', '.rruurryyrr.', '..ruurryyr..', '...uurryy...', '....rryy....', '.....rr.....', '.....BB.....', '....B..B....', '...B....B...', '............', '............'],
};
export function itemIcon(id) {
  if (cache.has(id)) return cache.get(id);
  const a = ART[id] || ART.permis, cv = document.createElement('canvas'); cv.width = cv.height = 36; const x = cv.getContext('2d');
  for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) { const ch = a[j][i]; if (ch !== '.') { x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(i * 3 + 1, j * 3 + 1, 3, 3); } }
  for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) { const ch = a[j][i]; if (ch !== '.') { x.fillStyle = PAL[ch]; x.fillRect(i * 3, j * 3, 3, 3); } }
  const u = cv.toDataURL(); cache.set(id, u); return u;
}
export { hex };

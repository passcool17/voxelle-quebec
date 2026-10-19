// Donjons : mine abandonnée (Charlevoix) et égouts (Montréal). Plan en grille, labyrinthe tiré du germe,
// salles, couloirs, coffres, pièges, mini-boss dans la salle la plus loin de l'entrée.
import { B } from './blocks.js';
import { mulberry } from './noise.js';

export const DUN = {
  mine: { name: 'Mine abandonnée', wall: B.STONE, floor: B.GRAVEL, boss: 'grosraton', foes: ['raton', 'mouches', 'raton', 'bureau'], trap: 'pics', lvl: 6 },
  egout: { name: 'Égouts de Montréal', wall: B.BRICK, floor: B.COBBLE, boss: 'deneigete', foes: ['raton', 'trou', 'bureau', 'raton'], trap: 'vapeur', lvl: 8 },
};
const N = 4, C = 11;
const cache = new Map();
// plan : salles (i,j), couloirs entre voisins, salle du boss, coffres, pièges
export function dunPlan(s) {
  if (cache.has(s)) return cache.get(s);
  const r = mulberry(s.seed ^ 0x5eed), D = DUN[s.kind], cx = (i, j) => s.x + i * C * s.dx, cz = (i, j) => s.z - j * C;
  const seen = new Set(['0,0']), links = [], st = [[0, 0]], dist = { '0,0': 0 };
  while (st.length) {
    const [i, j] = st[st.length - 1], nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [i + a, j + b]).filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N && !seen.has(a + ',' + b));
    if (!nb.length) { st.pop(); continue; }
    const [a, b] = nb[(r() * nb.length) | 0]; seen.add(a + ',' + b); links.push([i, j, a, b]); dist[a + ',' + b] = dist[i + ',' + j] + 1; st.push([a, b]);
  }
  // deux boucles en plus, pour ne pas tout faire en cul-de-sac
  for (let k = 0; k < 2; k++) { const i = (r() * (N - 1)) | 0, j = (r() * N) | 0; if (!links.some(l => l[0] === i && l[1] === j && l[2] === i + 1 && l[3] === j)) links.push([i, j, i + 1, j]); }
  let far = '0,0'; for (const k in dist) if (dist[k] > dist[far]) far = k;
  const rooms = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = i + ',' + j, boss = k === far, ent = !i && !j;
    rooms.push({ i, j, x: cx(i, j), z: cz(i, j), hr: boss ? 5 : ent ? 3 : 3 + ((r() * 2) | 0), boss, ent }); }
  const chests = [], traps = [], foes = [];
  for (const m of rooms) {
    if (m.ent) continue;
    if (m.boss) { chests.push({ x: m.x + 3.5, z: m.z - 3.5, rich: true }); continue; }
    if (r() < 0.5) chests.push({ x: m.x + (r() < 0.5 ? -1 : 1) * (m.hr - 1) + 0.5, z: m.z + (r() < 0.5 ? -1 : 1) * (m.hr - 1) + 0.5 });
    const nf = 1 + ((r() * 2) | 0); for (let k = 0; k < nf; k++) foes.push({ type: D.foes[(r() * D.foes.length) | 0], x: m.x + (r() - 0.5) * m.hr, z: m.z + (r() - 0.5) * m.hr });
  }
  for (const [i, j, a, b] of links) if (r() < 0.6) { const x = (cx(i, j) + cx(a, b)) / 2, z = (cz(i, j) + cz(a, b)) / 2; traps.push({ kind: D.trap, x: x + (i === a ? 0 : 0.5), z: z + (j === b ? 0 : 0.5), ph: r() * 3 }); }
  const bossRoom = rooms.find(m => m.boss), ent = rooms[0];
  const plan = { rooms, links, chests, traps, foes, bossRoom, ent, cx, cz, x0: Math.min(s.x, s.x + (N - 1) * C * s.dx) - 6, x1: Math.max(s.x, s.x + (N - 1) * C * s.dx) + 6, z0: s.z - (N - 1) * C - 6, z1: s.z + 6 };
  cache.set(s, plan); return plan;
}
// la case du joueur est-elle dans le donjon ?
export function dunInside(s, x, y, z) { const p = dunPlan(s); return x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1 && y > s.fy - 2 && y < s.fy + 6; }
export function dunRoomAt(s, x, z) { const p = dunPlan(s); return p.rooms.find(m => Math.abs(x - m.x) <= m.hr + 0.5 && Math.abs(z - m.z) <= m.hr + 0.5) || null; }

// construction en voxels (découpée au tronçon par P.fill)
export function dunBuild(s, P) {
  const p = dunPlan(s), D = DUN[s.kind], y = s.fy, mine = s.kind === 'mine', r = mulberry(s.seed ^ 77);
  const boxes = [];
  for (const m of p.rooms) boxes.push([m.x - m.hr, m.z - m.hr, m.x + m.hr, m.z + m.hr, 3]);
  for (const [i, j, a, b] of p.links) { const x0 = p.cx(i, j), z0 = p.cz(i, j), x1 = p.cx(a, b), z1 = p.cz(a, b);
    if (j === b) boxes.push([Math.min(x0, x1), z0 - 1, Math.max(x0, x1), z0, 2]); else boxes.push([x0 - 1, Math.min(z0, z1), x0, Math.max(z0, z1), 2]); }
  for (const [x0, z0, x1, z1, h] of boxes) P.fill(x0 - 1, y - 1, z0 - 1, x1 + 1, y + h + 1, z1 + 1, D.wall);
  for (const [x0, z0, x1, z1, h] of boxes) { P.fill(x0, y, z0, x1, y + h, z1, 0); P.fill(x0, y - 1, z0, x1, y - 1, z1, D.floor); }
  // égouts : rigole d'eau au centre des couloirs, voûtes en pierre
  if (!mine) for (const [x0, z0, x1, z1, h] of boxes) if (h === 2) { const alongX = z1 - z0 < 2; if (alongX) P.ffill(2 * x0, 2 * y - 1, 2 * z0 + 1, 2 * x1 + 1, 2 * y - 1, 2 * z0 + 2, B.WATER); else P.ffill(2 * x0 + 1, 2 * y - 1, 2 * z0, 2 * x0 + 2, 2 * y - 1, 2 * z1 + 1, B.WATER);
    P.fill(x0, y + h, z0, x1, y + h, z1, B.STONE); }
  // mine : poutres de bois aux 3 m dans les couloirs, minerai dans les murs
  if (mine) for (const [x0, z0, x1, z1, h] of boxes) {
    if (h === 2) { const alongX = z1 - z0 < 2; const L = alongX ? x1 - x0 : z1 - z0;
      for (let t = 1; t < L; t += 3) { if (alongX) { P.fill(x0 + t, y, z0, x0 + t, y + 1, z0, B.LOG); P.fill(x0 + t, y, z1, x0 + t, y + 1, z1, B.LOG); P.fill(x0 + t, y + 2, z0, x0 + t, y + 2, z1, B.PLANK); }
        else { P.fill(x0, y, z0 + t, x0, y + 1, z0 + t, B.LOG); P.fill(x1, y, z0 + t, x1, y + 1, z0 + t, B.LOG); P.fill(x0, y + 2, z0 + t, x1, y + 2, z0 + t, B.PLANK); } } }
    for (let k = 0; k < 6; k++) { const side = (r() * 4) | 0, u = x0 + ((r() * (x1 - x0 + 1)) | 0), v = z0 + ((r() * (z1 - z0 + 1)) | 0), yy = y + ((r() * 2) | 0), b = r() < 0.65 ? B.COAL : B.IRONORE;
      if (side === 0) P.set(x0 - 1, yy, v, b); else if (side === 1) P.set(x1 + 1, yy, v, b); else if (side === 2) P.set(u, yy, z0 - 1, b); else P.set(u, yy, z1 + 1, b); }
  }
  // salles : flambeaux (mine) ou fanaux (égouts) aux murs ; salle du boss plus riche
  for (const m of p.rooms) {
    const L = mine ? B.TORCH : B.LAMP;
    P.set(m.x - m.hr, y + 2, m.z, L); P.set(m.x + m.hr, y + 2, m.z, L);
    if (m.boss) { P.set(m.x, y + 2, m.z - m.hr, L); P.set(m.x, y + 2, m.z + m.hr, L); P.fill(m.x - m.hr, y - 1, m.z - m.hr, m.x + m.hr, y - 1, m.z + m.hr, mine ? B.COBBLE : B.STRIPE); }
    if (m.ent) { // échelle de sortie (barreaux) dans le coin
      const lx = m.x - m.hr, lz = m.z - m.hr; for (let k = 0; k < 4; k++) P.set(lx, y + k, lz, k % 2 ? B.PLANK : B.LOG); P.set(m.x - m.hr + 1, y + 3, m.z - m.hr, L); }
    if (!mine && !m.ent && !m.boss) { P.set(m.x - m.hr, y, m.z - m.hr, B.CONE); if (r() < 0.5) P.set(m.x + m.hr, y, m.z + m.hr, B.CONE); }
    if (mine && !m.ent && !m.boss && r() < 0.6) P.fill(m.x + 1, y, m.z + 1, m.x + 2, y, m.z + 1, B.PLANK); // vieilles caisses
  }
}
// PNJ (aucun), objets (coffres) et pièges pour main.js
export function dunLayout(s, m) {
  const p = dunPlan(s);
  for (const c of p.chests) m.items.push({ kind: c.rich ? 'coffre_or' : 'coffre', x: c.x, z: c.z, y: s.fy + 1 });
  m.traps = p.traps.map(t => ({ ...t, y: s.fy }));
}

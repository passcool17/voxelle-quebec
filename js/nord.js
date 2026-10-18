// Le Nord : route 175, Réserve faunique des Laurentides (lacs, Sept îles, lac Jacques-Cartier, L'Étape, point de vue),
// puis le Saguenay (Chicoutimi, fjord, lac Kénogami). Géographie inspirée de la vraie, fortement comprimée (~1 km de jeu = 50 km).
// Partagé entre le Worker (blocs) et le fil principal (hauteurs, lieux, régions, PNJ). Nord = −z, est = +x.
import { hash2, mulberry, smooth } from './noise.js';
import { B, SEA } from './blocks.js';
const lerp = (a, b, t) => a + (b - a) * t;

// spline de Catmull-Rom sur des points [z, v] (z décroissant vers le nord)
function curve(pts) {
  const n = pts.length;
  return z => {
    if (z >= pts[0][0]) return pts[0][1]; if (z <= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0; while (z < pts[i + 1][0]) i++;
    const p0 = pts[Math.max(0, i - 1)][1], p1 = pts[i][1], p2 = pts[i + 1][1], p3 = pts[Math.min(n - 1, i + 2)][1];
    const t = (pts[i][0] - z) / (pts[i][0] - pts[i + 1][0]);
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  };
}
export const Z_ROAD0 = -116, Z_END = -2392, Z_RES = -560, Z_SAG = -2150;
const ROADX = [[-116, 0], [-226, -7], [-330, -12], [-450, 0], [-600, 14], [-700, 8], [-820, -6], [-960, 0], [-1100, 14], [-1250, 26], [-1400, 22], [-1530, 14], [-1700, 0], [-1900, -24], [-2080, -14], [-2230, 20], [-2330, 44], [-2392, 48]];
const ROADH = [[-116, 47], [-200, 48.5], [-330, 55], [-450, 60], [-600, 58], [-760, 55.5], [-950, 57], [-1100, 56], [-1300, 57], [-1530, 59], [-1800, 61], [-2050, 58], [-2200, 50], [-2300, 42], [-2392, 38]];
export const REGIONS = {
  r175: ['Route 175', 'Direction nord : Laurentides et Saguenay'],
  poste: ['Poste d’accueil', 'Réserve faunique des Laurentides'],
  reserve: ['Réserve faunique des Laurentides', 'Lacs, épinettes, orignaux… pis mouches noires'],
  septiles: ['Les Sept îles', 'Sept petits lacs. On a arrêté de compter à six.'],
  camp: ['Camp de pêche', 'Ça mord… surtout les mouches'],
  travaux: ['Travaux sur la 175', 'Une voie sur deux. Depuis 1987.'],
  etape: ['L’Étape', 'Relais routier · bouffe chaude · essence'],
  lacjc: ['Lac Jacques-Cartier', 'Long, étroit, et frette en masse'],
  belvedere: ['Point de vue sur le Lac Jacques-Cartier', 'Sortez les cellulaires!'],
  saguenay: ['Saguenay', 'Bienvenue au Royaume!'],
  chicoutimi: ['Chicoutimi', 'Saguenay · la ville au bord du fjord'],
  port: ['Port de Chicoutimi', 'Croisières, goélands pis vent de face'],
  musee: ['Fjordorama', 'Musée (fictif) du fjord'],
  fjord: ['Fjord du Saguenay', 'Des falaises de 300 pieds. Ou de 30 blocs.'],
  kenogami: ['Lac Kénogami', 'Long comme un mardi'],
};

// ---------- police de 3×5 voxels pour les panneaux ----------
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110',
  6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110', ' ': '000000000000000', '-': '000000111000000', '.': '000000000000010', ':': '000010000010000',
};
const ACC = { 'É': ['E', 'aigu'], 'È': ['E', 'grave'], 'Ê': ['E', 'circ'] };
function textW(str) { let w = 0; for (const ch of str) w += (ch === '\'' || ch === '’' ? 1 : 3) + 1; return Math.max(0, w - 1); }
// texte en voxels fins ; (fx, fy, fz) = coin haut-gauche de la 1re lettre, (ux, uz) = sens de lecture
function vtext(P, str, fx, fy, fz, ux, uz, b) {
  let c = 0;
  for (const ch of str) {
    if (ch === '\'' || ch === '’') { P.fset(fx + c * ux, fy, fz + c * uz, b); P.fset(fx + c * ux, fy - 1, fz + c * uz, b); c += 2; continue; }
    const a = ACC[ch], g = FONT[a ? a[0] : ch] || FONT[' '];
    for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) if (g[r * 3 + k] === '1') P.fset(fx + (c + k) * ux, fy - r, fz + (c + k) * uz, b);
    if (a) { const k = a[1] === 'aigu' ? 2 : a[1] === 'grave' ? 0 : 1; P.fset(fx + (c + k) * ux, fy + 2, fz + (c + k) * uz, b); if (a[1] === 'circ') { P.fset(fx + c * ux, fy + 1, fz + c * uz, b); P.fset(fx + (c + 2) * ux, fy + 1, fz + (c + 2) * uz, b); } }
    c += 4;
  }
}
// panneau : lignes de texte, centré en (fcx, fcz), haut à fyTop. axis 'x' = panneau le long de x (faces ±z), 'z' = le long de z (faces ±x)
function panel(P, lines, fcx, fyTop, fcz, axis, bg, fg, both = true, pad = 1) {
  const W = Math.max(...lines.map(textW)) + 2 * pad, Hh = lines.length * 8 - 1 + 2 * pad, h0 = Math.floor(W / 2);
  const fy0 = fyTop - Hh + 1;
  if (axis === 'x') P.ffill(fcx - h0, fy0, fcz, fcx - h0 + W - 1, fyTop, fcz, bg); else P.ffill(fcx, fy0, fcz - h0, fcx, fyTop, fcz - h0 + W - 1, bg);
  lines.forEach((ln, i) => {
    const tw = textW(ln), off = Math.floor((W - tw) / 2), fy = fyTop - pad - 2 - i * 8;
    if (axis === 'x') { vtext(P, ln, fcx - h0 + off, fy, fcz + 1, 1, 0, fg); if (both) vtext(P, ln, fcx - h0 + W - 1 - off, fy, fcz - 1, -1, 0, fg); }
    else { vtext(P, ln, fcx + 1, fy, fcz - h0 + W - 1 - off, 0, -1, fg); if (both) vtext(P, ln, fcx - 1, fy, fcz - h0 + off, 0, 1, fg); }
  });
  return { W, H: Hh, fy0 };
}
const MOOSE = ['1.1.1......', '.111.......', '..11111111.', '.1111111111', '11.11111111', '...1111111.', '...1.1..1.1', '...1.1..1.1'];

export function createNord({ N, N2, N3, seed }) {
  const roadX = curve(ROADX), roadH = curve(ROADH);
  const slope = z => roadX(z - 1) - roadX(z);
  function road(x, z) {
    if (z > Z_ROAD0 + 1 || z < Z_END - 3) return null;
    const s = slope(z); return { d: (x - roadX(z)) / Math.sqrt(1 + s * s), h: roadH(z) };
  }
  // fjord du Saguenay (d'ouest en est) et lac Kénogami
  const zF = x => -2472 + 16 * Math.sin(x * 0.006 + 0.7) + 9 * N2.n2(x * 0.003, 5.5), wF = x => 33 + 7 * N3.n2(x * 0.004, 2.2);
  const KC = { x: -270, z: -2318, ux: -0.958, uz: -0.287, L: 175, W: 27, level: 40 };
  const townW = (x, z, df, wf) => (1 - smooth(110, 190, Math.abs(x - 50))) * (1 - smooth(120, 190, df - wf));
  const townH = (x, z, df, wf) => SEA + 2 + Math.max(0, df - wf) * 0.14 + 1.2 * N2.n2(x * 0.02, z * 0.02);
  // relief brut du plateau (sans lacs ni route)
  function plateau(x, z) {
    const zz = Math.max(Z_END, Math.min(-300, z));
    let h = roadH(zz) + 0.5 + 6.5 * N.fbm(x * 0.011 + 13, z * 0.011, 4) + 11 * Math.pow(N3.ridge(x * 0.0055 + 40, z * 0.0055 - 7, 3), 3);
    if (z < Z_SAG + 60) {
      const zf = zF(x), wf = wF(x), df = Math.abs(z - zf);
      if (z < zf) h = lerp(h, SEA + 34 + 7 * N2.fbm(x * 0.01, z * 0.01, 3) + 0.4 * (h - roadH(zz)), smooth(0, 60, zf - z) * 0 + 1);
      else { const tw = townW(x, z, df, wf); if (tw > 0) h = lerp(h, Math.min(h, townH(x, z, df, wf)), tw); }
      // vers le fjord : on redescend
      const edge = z > zf ? lerp(6, 2.5, townW(x, z, df, wf)) : 4.5;
      const bed = SEA - 5 - 10 * Math.max(0, 1 - (df / wf) ** 2);
      h = lerp(bed, h, smooth(wf, wf + edge, df));
    }
    return h;
  }
  // ---------- lacs ----------
  const lakeCache = new Map();
  function perimLevel(cx, cz, a, b, ang) {
    let m = 1e9; const c = Math.cos(ang), s = Math.sin(ang);
    for (let k = 0; k < 10; k++) { const t = k / 10 * 6.283, u = Math.cos(t) * a * 1.3, v = Math.sin(t) * b * 1.3; m = Math.min(m, plateau(cx + u * c - v * s, cz + u * s + v * c)); }
    return Math.floor(m - 0.6);
  }
  const SEPT = [[-648, 24, 10, 6, 0.3], [-672, 50, 13, 7, -0.4], [-702, 24, 8, 5, 1.0], [-692, -30, 11, 6, 0.6], [-730, 36, 10, 8, 0.2], [-712, 72, 8, 5, -0.8], [-754, -26, 12, 6, -0.3]]
    .map(([z, dx, a, b, ang]) => { const x = roadX(z) + dx; return { x, z, a, b, ang, level: perimLevel(x, z, a, b, ang), depth: 2.5, sept: true }; });
  const JC = { z0: -985, z1: -1522, level: 53 };
  const jcHW = z => { const t = (JC.z0 - z) / (JC.z0 - JC.z1); return 8 + 30 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, t * 1.05))), 0.7) * (1 - 0.4 * t) + 4 * N2.n2(z * 0.02, 3.3); };
  const jcCX = z => roadX(z) + 13 + jcHW(z);
  let structs = null; // défini plus bas
  function lakeCell(ci, cj) {
    const k = ci + ',' + cj; if (lakeCache.has(k)) return lakeCache.get(k);
    let L = null; const h = hash2(ci, cj, seed + 501);
    if (h < 0.55) {
      const cz = cj * 60 + 30 + (hash2(cj, ci, seed + 502) - 0.5) * 26, cx = ci * 60 + 30 + (hash2(ci + 7, cj, seed + 503) - 0.5) * 26;
      const a = 6 + hash2(ci, cj + 3, seed + 504) * 15, b = a * (0.4 + 0.5 * hash2(ci + 3, cj, seed + 505)), ang = hash2(ci + 9, cj + 9, seed + 506) * 3.14;
      const ok = cz < Z_RES - 50 && cz > Z_SAG + 40 && Math.abs(cx - roadX(cz)) > a + 18
        && !(cz < JC.z0 + 30 && cz > JC.z1 - 30 && cx > roadX(cz) - 10 && cx < jcCX(cz) + jcHW(cz) + a + 12)
        && !(cz < -630 && cz > -780 && Math.abs(cx - roadX(cz)) < 100)
        && !structs.some(s => Math.hypot(s.x - cx, s.z - cz) < a + s.R2 + 6);
      if (ok) L = { x: cx, z: cz, a, b, ang, level: perimLevel(cx, cz, a, b, ang), depth: 1.5 + a * 0.15 };
    }
    lakeCache.set(k, L); return L;
  }
  // distance signée (m) au bord d'un lac elliptique, < 0 dedans
  function ellD(L, x, z) { const c = Math.cos(L.ang), s = Math.sin(L.ang), dx = x - L.x, dz = z - L.z, u = dx * c + dz * s, v = -dx * s + dz * c; const r = Math.hypot(u / L.a, v / L.b); return { r, sd: (r - 1) * L.b }; }
  function lakes(x, z, h) {
    let wl = 0, lake = null;
    const carve = (r, sd, level, depth, levee) => {
      if (r < 1) { h = Math.min(h, level - 0.6 - depth * (1 - r * r)); wl = level; }
      else if (sd < 8) { h = Math.min(h, lerp(level + 0.3, h, smooth(0, 8, sd))); if (levee && sd < 4) h = Math.max(h, level + 0.6); if (sd < 3) wl = level; }
    };
    if (z < Z_RES - 20 && z > Z_SAG + 20) {
      const ci = Math.floor(x / 60), cj = Math.floor(z / 60);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const L = lakeCell(ci + a, cj + b); if (!L) continue; const e = ellD(L, x, z); if (e.sd < 8) carve(e.r, e.sd, L.level, L.depth, false); }
      if (z < -620 && z > -790) for (const L of SEPT) { const e = ellD(L, x, z); if (e.sd < 8) { carve(e.r, e.sd, L.level, L.depth, false); if (e.r < 1.2) lake = 'septiles'; } }
      if (z < JC.z0 + 30 && z > JC.z1 - 30) {
        const hw = jcHW(Math.max(JC.z1, Math.min(JC.z0, z))), t = (JC.z0 - z) / (JC.z0 - JC.z1), cx = jcCX(Math.max(JC.z1, Math.min(JC.z0, z)));
        const ex = t < 0 ? -t * (JC.z0 - JC.z1) / 14 : t > 1 ? (t - 1) * (JC.z0 - JC.z1) / 14 : 0;
        const r = Math.hypot((x - cx) / hw, ex), sd = (r - 1) * Math.min(hw, 14);
        if (sd < 8) { carve(r, sd, JC.level, 5 + hw * 0.12, true); }
      }
    }
    if (z < Z_SAG + 60) {
      const dx = x - KC.x, dz = z - KC.z, u = dx * KC.ux + dz * KC.uz, v = -dx * KC.uz + dz * KC.ux;
      const W = KC.W + 7 * N.n2(u * 0.015, 9.1), r = Math.hypot(u / KC.L, v / W), sd = (r - 1) * W;
      if (sd < 8) carve(r, sd, KC.level, 6, true);
    }
    return { h, wl };
  }
  // ---------- relief final du nord ----------
  function terrain(x, z, hOld) {
    const wN = smooth(470, 640, -z); let h = hOld, wl = 0;
    if (wN > 0) { h = lerp(hOld, plateau(x, z), wN); if (wN > 0.6) { const L = lakes(x, z, h); h = L.h; wl = L.wl; } }
    const r = road(x, z); let rd = 99;
    if (r) { rd = Math.abs(r.d); const wr = 1 - smooth(5, 24, rd); if (wr > 0) h = lerp(h, r.h, wr * smooth(Z_ROAD0 + 1, Z_ROAD0 - 6, z)); if (rd < 6) wl = 0; }
    let biome = -1, dens = 1;
    if (wN > 0.5) {
      biome = h > SEA + 46 ? 4 : 2; dens = 1.9;
      if (z < Z_SAG + 60) { const zf = zF(x), wf = wF(x), df = Math.abs(z - zf); const tw = z > zf ? townW(x, z, df, wf) : 0; if (tw > 0.3) { biome = 1; dens = 0.35; } }
    }
    return { h, wl, nord: wN > 0.5, rd, biome, dens };
  }
  // ---------- lieux (pseudo-structures) ----------
  structs = [];
  const add = o => { o.nord = true; o.i = 'N'; o.j = structs.length; o.seed = (hash2(o.j, 77, seed) * 1e9) | 0; o.R2 = o.R2 || o.R + 14; o.h = Math.round(o.h); structs.push(o); return o; };
  const at = (z, dx) => roadX(z) + dx;
  const P = {};
  P.poste = add({ type: 'poste', key: 'poste', name: 'Poste d’accueil', x: Math.round(at(-600, 15)), z: -600, h: roadH(-600), R: 9, R2: 20, BR: 22, safe: true });
  P.camp = add({ type: 'camp', key: 'camp', name: 'Camp de pêche', x: Math.round(SEPT[1].x - SEPT[1].a - 6), z: Math.round(SEPT[1].z + 3), h: SEPT[1].level + 1, R: 5, R2: 9, BR: 14, safe: true, lake: SEPT[1] });
  P.travaux = add({ type: 'travaux', key: 'travaux', name: 'Travaux sur la 175', x: Math.round(at(-862, 0)), z: -862, h: roadH(-862), R: 7, R2: 12, BR: 18 });
  P.etape = add({ type: 'etape', key: 'etape', name: 'L’Étape', x: Math.round(at(-1100, -24)), z: -1100, h: roadH(-1100), R: 19, R2: 30, BR: 30, safe: true });
  P.belvedere = add({ type: 'belvedere', key: 'belvedere', name: 'Point de vue', x: Math.round(at(-1530, 15)), z: -1530, h: roadH(-1530) + 3, R: 6, R2: 15, BR: 12, safe: true });
  const tz = x => { const zf = zF(x), wf = wF(x); return { shore: zf + wf, h: z => townH(x, z, z - zf, wf) }; };
  P.chicoutimi = add({ type: 'chicoutimi', key: 'chicoutimi', name: 'Chicoutimi', x: 48, z: Z_END, h: roadH(Z_END), R: 34, R2: 54, BR: 40, safe: true });
  { const s = tz(28); P.port = add({ type: 'port', key: 'port', name: 'Port de Chicoutimi', x: 28, z: Math.round(s.shore + 7), h: SEA + 2, R: 11, R2: 22, BR: 30, safe: true }); }
  { const s = tz(158), z = Math.round(s.shore + 24); P.musee = add({ type: 'musee', key: 'musee', name: 'Fjordorama', x: 158, z, h: s.h(z), R: 17, R2: 30, BR: 22, safe: true }); }
  { const s = tz(-44), z = Math.round(s.shore + 46); add({ type: 'village', name: 'Chicoutimi', key: 'chicoutimi', x: -44, z, h: s.h(z), R: 23, R2: 40, safe: true }); }
  { const s = tz(132), z = Math.round(s.shore + 92); add({ type: 'village', name: 'Chicoutimi', key: 'chicoutimi', x: 132, z, h: s.h(z), R: 23, R2: 40, safe: true }); }
  const KZ = [];
  // panneaux le long de la route : 175 (vert), orignaux (jaune), destinations
  const signs = [];
  for (let z = -170, k = 0; z > Z_END + 120; z -= 230, k++) {
    if (Math.abs(z - P.travaux.z) < 40 || Math.abs(z - P.etape.z) < 50 || Math.abs(z - P.poste.z) < 40 || Math.abs(z - P.belvedere.z) < 40 || Math.abs(z + 226) < 30) continue;
    const kind = z < Z_RES && k % 2 ? 'orignal' : '175';
    signs.push({ kind, x: Math.round(at(z, 6.5) * 2), z: z * 2 });
  }
  signs.push({ kind: 'dest', lines: ['CHICOUTIMI', 'SAGUENAY'], x: Math.round(at(-2190, 7) * 2), z: -2190 * 2 });
  signs.push({ kind: 'dest', lines: ['L\'ÉTAPE 2 KM'], x: Math.round(at(-1040, 7) * 2), z: -1040 * 2 });
  signs.push({ kind: 'dest', lines: ['SAGUENAY 175'], x: Math.round(at(-140, 7.5) * 2), z: -140 * 2 });
  function region(x, z) {
    if (z > -150) return null;
    for (const s of structs) if (s.key && Math.hypot(x - s.x, z - s.z) < s.R + 8) return s.key;
    if (z > Z_RES) { const r = road(x, z); return r && Math.abs(r.d) < 45 ? 'r175' : null; }
    if (z > Z_SAG) {
      if (z < -620 && z > -790 && Math.abs(x - roadX(z)) < 110) return 'septiles';
      if (z < JC.z0 + 20 && z > JC.z1 - 20 && x > roadX(z) + 6 && x < jcCX(z) + jcHW(z) + 30) return 'lacjc';
      return 'reserve';
    }
    const dx = x - KC.x, dz = z - KC.z, u = dx * KC.ux + dz * KC.uz, v = -dx * KC.uz + dz * KC.ux; if (Math.hypot(u / KC.L, v / (KC.W + 25)) < 1.15) return 'kenogami';
    const zf = zF(x), df = Math.abs(z - zf), wf = wF(x);
    if (z > zf && townW(x, z, df, wf) > 0.5) return 'chicoutimi';
    if (df < wf + 45) return 'fjord';
    return 'saguenay';
  }
  // étiquettes de carte
  const labels = [
    { n: 'Route 175', x: at(-300, 10), z: -300 }, { n: 'Poste d’accueil', x: P.poste.x, z: P.poste.z }, { n: 'Sept îles', x: at(-700, 30), z: -700 }, { n: 'Réserve faunique des Laurentides', sh: 'Réserve faunique', x: at(-1300, -70), z: -1300, big: true },
    { n: 'Travaux', x: P.travaux.x, z: P.travaux.z }, { n: 'L’Étape', x: P.etape.x, z: P.etape.z }, { n: 'Lac Jacques-Cartier', sh: 'Lac J.-Cartier', x: jcCX(-1200), z: -1200 }, { n: 'Point de vue sur le Lac Jacques-Cartier', sh: 'Point de vue', x: P.belvedere.x, z: P.belvedere.z },
    { n: 'Chicoutimi', x: P.chicoutimi.x, z: P.chicoutimi.z, big: true }, { n: 'Fjordorama', x: P.musee.x, z: P.musee.z }, { n: 'Port', x: P.port.x, z: P.port.z }, { n: 'Lac Kénogami', x: KC.x, z: KC.z }, { n: 'Saguenay', x: 260, z: zF(260) }, { n: 'Vieille-Ville', x: 0, z: -76, big: true },
  ];
  const stops = [
    { key: 'ville', label: 'VIEILLE-VILLE', ax: 4, az: -121, car: [10, -126, 0] },
    { key: 'poste', label: 'POSTE D’ACCUEIL', ax: Math.round(at(-612, 6)), az: -612, car: [at(-620, 9), -620, 0] },
    { key: 'etape', label: 'L’ÉTAPE', ax: P.etape.x + 15, az: P.etape.z + 10, car: [P.etape.x + 7, P.etape.z + 11, 0] },
    { key: 'chicoutimi', label: 'CHICOUTIMI', ax: P.chicoutimi.x + 0.5, az: P.chicoutimi.z + 24, car: [P.chicoutimi.x - 0.5, P.chicoutimi.z + 31, 0] },
  ];
  return { stops, roadX, roadH, road, zF, wF, terrain, structs, places: P, signs, region, labels, plateau, JC, jcCX, jcHW, SEPT, KC };
}

// ---------- passe « route » dans un tronçon (voxels fins) : asphalte, lignes, accotements, panneaux ----------
export function buildRoad(nord, P, data, idx, hf, FW, FM, CS, WH, ox, oz) {
  const top = (x, z) => hf[(x + FM) + (z + FM) * FW];
  for (let z = 0; z < CS; z++) {
    const wz = (oz + z + 0.5) * 0.5; const zr = nord.road(nord.roadX(wz), wz); if (!zr) continue;
    for (let x = 0; x < CS; x++) {
      const wx = (ox + x + 0.5) * 0.5, r = nord.road(wx, wz); const ad = Math.abs(r.d); if (ad > 4.8) continue;
      const h = top(x, z); if (h < 2 || h >= WH - 22) continue;
      const line = ad < 0.26 && (((oz + z) >> 3) & 1) === 0 ? B.YELLOW : ad < 0.26 ? B.YELLOW : ad > 3.0 && ad < 3.3 ? B.STRIPE : ad < 3.7 ? B.ROAD : B.GRAVEL;
      data[idx(x, h, z)] = line; data[idx(x, h - 1, z)] = B.GRAVEL; data[idx(x, h - 2, z)] = B.GRAVEL;
      for (let y = h + 1; y < Math.min(WH, h + 30); y++) data[idx(x, y, z)] = 0;
    }
  }
  // panneaux
  for (const s of nord.signs) {
    if (s.x < ox - 30 || s.x > ox + CS + 30 || s.z < oz - 8 || s.z > oz + CS + 8) continue;
    const gh = Math.floor(nord.roadH(s.z / 2) * 2) + 2;
    if (s.kind === '175') { P.ffill(s.x, gh - 2, s.z, s.x, gh + 7, s.z, B.IRON); panel(P, ['175'], s.x, gh + 14, s.z - 1, 'x', B.SIGN, B.TRIM, false); P.ffill(s.x - 7, gh + 8, s.z - 2, s.x + 7, gh + 8, s.z - 2, 0); }
    else if (s.kind === 'orignal') {
      P.ffill(s.x, gh - 2, s.z, s.x, gh + 6, s.z, B.IRON);
      P.ffill(s.x - 6, gh + 7, s.z - 1, s.x + 6, gh + 16, s.z - 1, B.YELLOW);
      MOOSE.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '1') P.fset(s.x - 5 + i, gh + 15 - j, s.z, B.IRON); });
    } else if (s.kind === 'dest') {
      const W = Math.max(...s.lines.map(textW)) + 2; P.ffill(s.x - (W >> 1) + 1, gh - 2, s.z, s.x - (W >> 1) + 1, gh + 7, s.z, B.IRON); P.ffill(s.x + (W >> 1) - 1, gh - 2, s.z, s.x + (W >> 1) - 1, gh + 7, s.z, B.IRON);
      panel(P, s.lines, s.x, gh + 7 + s.lines.length * 8 + 1, s.z - 1, 'x', B.SIGN, B.TRIM, false);
    }
  }
}

// ---------- constructions du Nord ----------
export function nordLayout(s, m, r) {
  if (s.type === 'poste') { m.npcs.push({ role: 'gardeparc', x: s.x - 5.5, z: s.z + 4.5 }, { role: 'chauffeur', x: s.x - 6.5, z: s.z - 4.5, stop: 'poste' }); }
  else if (s.type === 'camp') { m.npcs.push({ role: 'pecheur', x: s.x + 1.5, z: s.z + 3.5 }); }
  else if (s.type === 'travaux') {
    for (let k = 0; k < 5; k++) m.spawns.push({ type: 'cone', x: s.x + (k % 2 ? 2.5 : -2.5), z: s.z - 8 + k * 4 });
    m.items.push({ kind: 'ble', x: s.x + 6.5, z: s.z - 3.5 }, { kind: 'ble', x: s.x - 6.5, z: s.z + 4.5 }, { kind: 'ble', x: s.x + 6.5, z: s.z + 6.5 }, { kind: 'ble', x: s.x - 6.5, z: s.z - 6.5 });
  } else if (s.type === 'etape') {
    m.npcs.push({ role: 'cuisiniere', x: s.x + 4.5, z: s.z + 1.5 }, { role: 'commercant', x: s.x + 4.5, z: s.z - 4.5, shop: 'etape' }, { role: 'chauffeur', x: s.x + 21.5, z: s.z + 13.5, stop: 'etape' });
    for (let k = 0; k < 3; k++) m.npcs.push({ role: 'villageois', x: s.x + 8 + r() * 10, z: s.z - 10 + r() * 20 });
  } else if (s.type === 'belvedere') { m.npcs.push({ role: 'villageois', x: s.x + 1.5, z: s.z + 1.5 }); }
  else if (s.type === 'chicoutimi') {
    m.npcs.push({ role: 'chauffeur', x: s.x + 5.5, z: s.z + 14.5, stop: 'chicoutimi' }, { role: 'aubergiste', x: s.x - 4.5, z: s.z + 4.5 }, { role: 'commercant', x: s.x + 6.5, z: s.z - 2.5 });
    for (let k = 0; k < 5; k++) m.npcs.push({ role: 'villageois', x: s.x + (r() - 0.5) * 24, z: s.z + (r() - 0.5) * 24 });
  } else if (s.type === 'port') { m.npcs.push({ role: 'saguenayen', x: s.x - 3.5, z: s.z - 1.5 }, { role: 'villageois', x: s.x + 5, z: s.z + 2 }); }
  else if (s.type === 'musee') { m.npcs.push({ role: 'guide', x: s.x + 0.5, z: s.z + 8.5 }); }
}
export function nordBuild(s, P, H) {
  const h = s.h, F = v => v * 2;
  if (s.type === 'poste') {
    // pavillon d'accueil en bois rond, toit vert ; barrière levée ; grande arche au-dessus de la route
    H.house(P, s.x - 8, s.z - 3, 7, 6, h, B.LOG, B.COPPER, 'w', 3, true);
    P.fill(s.x - 10, h, s.z - 7, s.x - 2, h, s.z + 6, B.GRAVEL);
    const rz = s.z - 6, rx = Math.round(s.x - 15);
    for (const dx of [-12, 12]) { P.fill(rx + dx, h - 2, rz, rx + dx + 1, h + 9, rz, B.LOG); P.fill(rx + dx - 1, h + 1, rz - 1, rx + dx + 2, h + 1, rz + 1, B.COBBLE); }
    P.fill(rx - 12, h + 10, rz, rx + 13, h + 10, rz, B.LOG);
    panel(P, ['RÉSERVE', 'FAUNIQUE DES', 'LAURENTIDES'], F(rx) + 1, F(h + 10) + 26, F(rz), 'x', B.BROWN, B.TRIM, true, 2);
    // barrière rouge et blanche relevée
    P.fill(rx + 5, h + 1, rz + 3, rx + 5, h + 2, rz + 3, B.IRON); for (let k = 0; k < 6; k++) P.fset(F(rx + 5), F(h + 3) + k, F(rz + 3), k & 1 ? B.STRIPE : B.REDROOF);
    H.lampPost(P, s.x - 3, s.z + 6, h); H.lampPost(P, s.x - 3, s.z - 7, h);
    // arrêt d'autocar
    busStop(P, s.x - 7, s.z - 6, h);
  } else if (s.type === 'camp') {
    H.house(P, s.x - 3, s.z - 2, 6, 5, h, B.DPLANK, B.SHINGLE, 's', 3, true);
    const L = s.lake, wl = L.level + 1; // quai sur le lac
    P.fill(s.x + 3, wl, s.z, s.x + 12, wl, s.z + 1, B.PLANK); for (const xx of [s.x + 5, s.x + 9, s.x + 12]) P.fill(xx, wl - 3, s.z, xx, wl - 1, s.z, B.LOG);
    // canot rouge
    P.ffill(F(s.x + 6), F(wl) - 1, F(s.z + 3), F(s.x + 11), F(wl) - 1, F(s.z + 3) + 1, B.REDROOF); P.ffill(F(s.x + 6) + 1, F(wl) - 2, F(s.z + 3), F(s.x + 11) - 1, F(wl) - 2, F(s.z + 3) + 1, B.REDROOF);
    P.fill(s.x - 4, h + 1, s.z + 3, s.x - 3, h + 1, s.z + 3, B.LOG); // bûches
    P.ffill(F(s.x + 1), F(h + 1), F(s.z + 4), F(s.x + 1), F(h + 1) + 2, F(s.z + 4), B.SLOG);
  } else if (s.type === 'travaux') {
    for (let z = s.z - 16; z <= s.z + 16; z += 2) { const x = Math.round(H.nord.roadX(z) + 0.5); P.set(x, Math.round(H.nord.roadH(z)) + 1, z, B.CONE); if (z % 4 === 0) P.ffill(F(x), F(Math.round(H.nord.roadH(z)) + 2), F(z), F(x), F(Math.round(H.nord.roadH(z)) + 2), F(z), B.STRIPE); }
    // panneau orange TRAVAUX
    const sx = Math.round(H.nord.roadX(s.z + 20) + 7), sz = s.z + 20; P.fill(sx, h, sz, sx, h + 3, sz, B.IRON);
    panel(P, ['TRAVAUX'], F(sx), F(h + 4) + 9, F(sz) - 1, 'x', B.CONE, B.IRON, true);
    // caisses de blé d'Inde éventrées
    for (const [dx, dz] of [[7, -4], [-7, 4], [7, 6], [-7, -7]]) { P.fill(s.x + dx - 1, h + 1, s.z + dz - 1, s.x + dx, h + 1, s.z + dz - 1, B.PLANK); }
    P.fill(s.x + 9, h + 1, s.z - 10, s.x + 13, h + 3, s.z - 8, B.WHITE); P.fill(s.x + 9, h + 4, s.z - 10, s.x + 13, h + 4, s.z - 8, B.TIN); P.set(s.x + 11, h + 2, s.z - 8, B.GLASS);
  } else if (s.type === 'etape') {
    // stationnement, restaurant en bois rond, marquise des pompes, enseigne lumineuse
    P.fill(s.x - 16, h, s.z - 16, s.x + 20, h, s.z + 16, B.ROAD);
    for (let z = s.z - 14; z <= s.z + 14; z += 3) P.ffill(F(s.x + 3), F(h) + 1, F(z), F(s.x + 6), F(h) + 1, F(z), B.STRIPE);
    H.house(P, s.x - 15, s.z - 7, 16, 13, h, B.LOG, B.REDROOF, 'e', 4, true);
    for (let z = s.z - 5; z <= s.z + 5; z += 2) if (Math.abs(z - (s.z - 1)) > 1) P.fill(s.x, h + 2, z, s.x, h + 3, z, B.GLASS);
    // comptoir extérieur
    P.fill(s.x + 2, h + 1, s.z, s.x + 2, h + 1, s.z + 3, B.PLANK); P.fill(s.x + 1, h + 4, s.z - 6, s.x + 3, h + 4, s.z + 6, B.REDROOF);
    // marquise et pompes
    const gx = s.x + 9, gz = s.z - 6;
    for (const [a, b] of [[0, 0], [8, 0], [0, 12], [8, 12]]) P.fill(gx + a, h + 1, gz + b, gx + a, h + 5, gz + b, B.WHITE);
    P.fill(gx - 1, h + 6, gz - 1, gx + 9, h + 6, gz + 13, B.WHITE); P.fill(gx - 1, h + 6, gz - 1, gx + 9, h + 6, gz - 1, B.REDROOF); P.fill(gx - 1, h + 6, gz + 13, gx + 9, h + 6, gz + 13, B.REDROOF);
    P.ffill(F(gx - 1), F(h + 6) + 2, F(gz) - 2, F(gx + 9) + 1, F(h + 6) + 2, F(gz) - 2, B.NEON);
    for (const pz of [gz + 3, gz + 8]) { P.fill(gx + 4, h + 1, pz, gx + 4, h + 2, pz + 1, B.REDROOF); P.set(gx + 4, h + 2, pz, B.GLASS); P.fill(gx + 3, h + 1, pz, gx + 5, h + 1, pz + 1, B.COBBLE); P.fset(F(gx + 4), F(h + 3), F(pz), B.WHITE); }
    for (let x = gx; x <= gx + 8; x += 4) for (let z = gz + 2; z <= gz + 10; z += 4) P.fset(F(x) + 1, F(h + 6) - 1, F(z), B.LAMP);
    // pylône de l'enseigne
    const px = s.x + 19, pz = s.z - 14;
    P.fill(px, h + 1, pz - 1, px, h + 9, pz - 1, B.IRON); P.fill(px, h + 1, pz + 1, px, h + 9, pz + 1, B.IRON);
    panel(P, ['L\'ÉTAPE', 'RESTO GAZ'], F(px), F(h + 10) + 17, F(pz), 'z', B.IRON, B.NEON, true, 2);
    P.fill(px, h + 19, pz - 6, px, h + 19, pz + 6, B.REDROOF);
    // tables à pique-nique et lampadaires
    for (const [x, z] of [[s.x - 6, s.z + 10], [s.x - 1, s.z + 11], [s.x - 11, s.z + 10]]) { P.fill(x, h + 1, z, x + 1, h + 1, z, B.PLANK); P.ffill(F(x), F(h + 1), F(z) - 1, F(x + 1) + 1, F(h + 1), F(z) - 1, B.DPLANK); P.ffill(F(x), F(h + 1), F(z) + 2, F(x + 1) + 1, F(h + 1), F(z) + 2, B.DPLANK); }
    for (const [x, z] of [[s.x + 2, s.z - 15], [s.x + 2, s.z + 15], [s.x + 18, s.z + 15]]) H.lampPost(P, x, z, h);
    busStop(P, s.x + 19, s.z + 12, h);
    // un camion stationné
    P.fill(s.x - 4, h + 1, s.z - 14, s.x + 8, h + 4, s.z - 12, B.TIN); P.fill(s.x + 9, h + 1, s.z - 14, s.x + 11, h + 3, s.z - 12, B.BLUE); P.set(s.x + 11, h + 3, s.z - 13, B.GLASS);
    P.fill(s.x - 4, h + 4, s.z - 14, s.x + 8, h + 4, s.z - 12, B.WHITE); P.ffill(F(s.x - 3), F(h + 2), F(s.z - 12) + 2, F(s.x + 7), F(h + 2) + 1, F(s.z - 12) + 2, B.REDROOF);
  } else if (s.type === 'belvedere') {
    P.fill(s.x - 4, h, s.z - 4, s.x + 4, h, s.z + 4, B.PLANK);
    for (let k = -4; k <= 4; k++) { for (const [x, z] of [[s.x + k, s.z + 4], [s.x + 4, s.z + k], [s.x + k, s.z - 4]]) { P.ffill(F(x), F(h + 1), F(z), F(x), F(h + 1) + 1, F(z), B.DPLANK); P.ffill(F(x), F(h + 1) + 2, F(z), F(x) + 1, F(h + 1) + 2, F(z) + 1, B.PLANK); } }
    for (let k = -4; k <= 4; k++) { P.ffill(F(s.x + k), F(h + 1), F(s.z + 4) + 1, F(s.x + k) + 1, F(h + 1) + 1, F(s.z + 4) + 1, 0); }
    // longue-vue
    P.ffill(F(s.x + 2), F(h + 1), F(s.z + 2), F(s.x + 2), F(h + 1) + 2, F(s.z + 2), B.IRON); P.ffill(F(s.x + 2), F(h + 1) + 3, F(s.z + 2), F(s.x + 2), F(h + 1) + 3, F(s.z + 2) + 2, B.COPPER);
    // escalier depuis la route
    for (let k = 0; k < 4; k++) P.fill(s.x - 5 - k, h - k, s.z - 1, s.x - 5 - k, h - k, s.z + 1, B.PLANK);
    P.fill(s.x - 5, h + 1, s.z - 5, s.x - 5, h + 3, s.z - 5, B.LOG);
    panel(P, ['POINT', 'DE VUE'], F(s.x - 5), F(h + 4) + 16, F(s.z - 5), 'z', B.BROWN, B.TRIM, true, 1);
  } else if (s.type === 'chicoutimi') {
    P.fill(s.x - 12, h, s.z - 12, s.x + 12, h, s.z + 12, B.COBBLE);
    P.fill(s.x - 34, h, s.z - 2, s.x + 34, h, s.z + 2, B.ROAD); P.fill(s.x - 2, h, s.z - 34, s.x + 2, h, s.z + 34, B.ROAD);
    // église (fictive) à double clocher au nord de la place
    H.church(P, s.x - 5, s.z - 22, h); H.church(P, s.x + 5, s.z - 22, h);
    const r = mulberry(s.seed);
    for (const [x0, z0, door] of [[s.x - 33, s.z - 14, 'e'], [s.x - 33, s.z + 5, 'e'], [s.x - 33, s.z + 14, 'e'], [s.x + 26, s.z - 14, 'w'], [s.x + 26, s.z + 5, 'w'], [s.x + 26, s.z + 14, 'w'], [s.x - 22, s.z + 22, 'n'], [s.x + 14, s.z + 22, 'n'], [s.x - 22, s.z - 12, 's'], [s.x + 15, s.z - 12, 's']])
      H.house(P, x0, z0, 7, 6, h, [B.WHITE, B.BRICK, B.PLANK, B.WHITE][r() * 4 | 0], [B.TIN, B.REDROOF, B.SHINGLE, B.COPPER][r() * 4 | 0], door, 4 + (r() * 2 | 0), r() < 0.6);
    for (const [x, z] of [[s.x - 11, s.z - 11], [s.x + 11, s.z - 11], [s.x - 11, s.z + 11], [s.x + 11, s.z + 11], [s.x - 3, s.z + 26], [s.x + 3, s.z - 30]]) H.lampPost(P, x, z, h);
    // monument : une grosse bleuet sur socle
    P.fill(s.x - 1, h + 1, s.z - 1, s.x + 1, h + 2, s.z + 1, B.COBBLE); P.ffill(F(s.x) - 2, F(h + 3), F(s.z) - 2, F(s.x) + 3, F(h + 3) + 4, F(s.z) + 3, B.BLUE); P.ffill(F(s.x), F(h + 3) + 5, F(s.z), F(s.x) + 1, F(h + 3) + 5, F(s.z) + 1, B.SPRUCE);
    busStop(P, s.x + 5, s.z + 16, h);
  } else if (s.type === 'port') {
    P.fill(s.x - 14, h, s.z - 2, s.x + 14, h, s.z + 8, B.COBBLE);
    P.fill(s.x - 2, h, s.z - 24, s.x + 2, h, s.z - 3, B.PLANK); for (let z = s.z - 24; z < s.z - 2; z += 4) { P.fill(s.x - 2, SEA - 6, z, s.x - 2, h - 1, z, B.LOG); P.fill(s.x + 2, SEA - 6, z, s.x + 2, h - 1, z, B.LOG); }
    for (let z = s.z - 22; z < s.z - 2; z += 5) P.ffill(F(s.x + 2) + 1, F(h + 1), F(z), F(s.x + 2) + 1, F(h + 1), F(z), B.IRON);
    // bateau de croisière « Le Fjordissimo »
    const bx = s.x + 4, bz = s.z - 22, y0 = SEA - 1;
    P.fill(bx, y0, bz, bx + 5, y0 + 2, bz + 15, B.WHITE); P.fill(bx + 1, y0 + 2, bz + 1, bx + 4, y0 + 2, bz + 14, B.PLANK);
    P.ffill(F(bx), F(y0 + 1), F(bz), F(bx + 5) + 1, F(y0 + 1), F(bz + 15) + 1, B.BLUE);
    P.fill(bx + 1, y0 + 3, bz + 3, bx + 4, y0 + 4, bz + 11, B.WHITE); for (let z = bz + 4; z <= bz + 10; z += 2) { P.set(bx + 1, y0 + 4, z, B.GLASS); P.set(bx + 4, y0 + 4, z, B.GLASS); }
    P.fill(bx + 1, y0 + 5, bz + 3, bx + 4, y0 + 5, bz + 11, B.TIN); P.fill(bx + 2, y0 + 6, bz + 7, bx + 3, y0 + 7, bz + 8, B.REDROOF);
    P.ffill(F(bx) + 2, F(y0 + 2), F(bz) - 1, F(bx + 5) - 1, F(y0 + 2) + 1, F(bz) - 1, B.WHITE);
    for (const x of [s.x - 12, s.x - 6, s.x + 8, s.x + 13]) H.lampPost(P, x, s.z + 7, h);
    P.fill(s.x - 10, h + 1, s.z + 3, s.x - 8, h + 1, s.z + 3, B.PLANK);
  } else if (s.type === 'musee') {
    const x0 = s.x - 13, x1 = s.x + 13, z0 = s.z - 6, z1 = s.z + 6;
    P.fill(x0 - 2, h, z0 - 3, x1 + 2, h, z1 + 6, B.COBBLE);
    P.fill(x0, h + 1, z0, x1, h + 7, z1, B.WHITE); P.fill(x0 + 1, h + 1, z0 + 1, x1 - 1, h + 6, z1 - 1, 0);
    P.fill(x0 + 1, h + 2, z0, x1 - 1, h + 6, z0, B.GLASS); for (let x = x0 + 2; x < x1; x += 3) P.fill(x, h + 2, z1, x, h + 5, z1, B.GLASS);
    P.fill(s.x - 1, h + 1, z1, s.x + 1, h + 3, z1, 0);
    P.fill(x0 - 1, h + 8, z0 - 1, x1 + 1, h + 8, z1 + 1, B.TIN);
    // voile (rappel d'une vague / d'une falaise)
    for (let k = 0; k < 12; k++) P.fill(x0 + 2 + k, h + 9, s.z - 1 - Math.floor(k / 3), x0 + 2 + k, h + 9 + Math.floor(k * 0.9), s.z + 1, B.COPPER);
    panel(P, ['FJORDORAMA'], F(s.x), F(h + 7), F(z1) + 1, 'x', B.WHITE, B.BLUE, false, 0);
    // maquette du fjord dedans
    P.fill(s.x - 6, h + 1, s.z - 2, s.x + 6, h + 1, s.z + 2, B.STONE); P.fill(s.x - 6, h + 1, s.z, s.x + 6, h + 1, s.z, B.WATER); P.fill(s.x - 6, h + 2, s.z - 2, s.x + 6, h + 2, s.z - 2, B.STONE);
    for (const x of [x0 - 1, x1 + 1]) H.lampPost(P, x, z1 + 5, h);
  }
}
function busStop(P, x, z, h) {
  const F = v => v * 2;
  P.ffill(F(x), F(h + 1), F(z), F(x), F(h + 1) + 6, F(z), B.IRON); P.ffill(F(x) - 1, F(h + 1) + 7, F(z), F(x) + 1, F(h + 1) + 9, F(z), B.BLUE); P.fset(F(x), F(h + 1) + 8, F(z) + 1, B.TRIM); P.fset(F(x), F(h + 1) + 8, F(z) - 1, B.TRIM);
  P.fill(x + 1, h + 1, z - 2, x + 1, h + 3, z + 2, B.GLASS); P.fill(x + 1, h + 4, z - 2, x + 3, h + 4, z + 2, B.TIN); P.fill(x + 2, h + 1, z - 1, x + 2, h + 1, z + 1, B.PLANK);
}

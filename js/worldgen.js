// Génération procédurale du monde : relief, fleuve, biomes, arbres, structures (Vieille-Ville, villages, chantiers, cabanes à sucre).
// Partagé entre le Web Worker (blocs) et le fil principal (hauteurs, positions des structures et des PNJ).
import { makeNoise, mulberry, hash2, smooth } from './noise.js';
import { B, CS, WH, SEA } from './blocks.js';
export const BIOME = { RIVE: 0, CAMPAGNE: 1, BOREALE: 2, ERABLIERE: 3, COLLINES: 4, VILLE: 5 };
export const BIOME_NAME = ['Rives du Fleuve', 'Campagne', 'Forêt boréale', 'Érablière', 'Laurentides enneigées', 'Vieille-Ville'];
export const CELL = 144;
const lerp = (a, b, t) => a + (b - a) * t;

export function createGen(seed) {
  const N = makeNoise(seed), N2 = makeNoise(seed + 101), N3 = makeNoise(seed + 202), N4 = makeNoise(seed + 303);
  const riverZ = x => 34 * N.fbm(x * 0.0022 + 3.1, 1.7, 3) + 12 * N2.n2(x * 0.009, 7.7);
  const riverW = x => 24 + 8 * N3.n2(x * 0.004, 1.3);
  const VX = 0, VZ = Math.round(riverZ(0) - 72), VH = SEA + 17, VR = 34;
  function rawH(x, z) {
    const rz = riverZ(x), north = rz - z, d = Math.abs(z - rz), W = riverW(x);
    const base = N.fbm(x * 0.006, z * 0.006, 4);
    let land;
    const r = N3.ridge(x * 0.007, z * 0.007, 4);
    if (north > 0) { const m = smooth(50, 380, north); land = SEA + 5 + base * 4 + 6 * N2.fbm(x * 0.0025, z * 0.0025, 3) + m * (8 + 44 * r * r * r * 1.4); }
    else land = SEA + 4 + base * 2.5 + 4 * N2.fbm(x * 0.003, z * 0.003, 2) + smooth(160, 600, -north) * 14 * r * r;
    const bed = SEA - 1 - 8 * Math.max(0, 1 - (d / W) ** 2);
    const sh = smooth(W * 0.8, W + 30, d);
    return { h: lerp(bed, land, sh), north, d, W };
  }
  // ---------- structures (grille de cellules) ----------
  const cellCache = new Map();
  function cell(i, j) {
    const k = i + ',' + j; let s = cellCache.get(k); if (s !== undefined) return s;
    s = makeCell(i, j); cellCache.set(k, s); return s;
  }
  function makeCell(i, j) {
    let type;
    const forced = { '0,0': 'ville', '1,0': 'cabane', '-1,0': 'village', '0,-1': 'chantier', '2,-1': 'grand', '-1,-1': 'none', '1,-1': 'none' }[i + ',' + j];
    const r = mulberry((seed * 7919) ^ (i * 92821 + j * 68917));
    const hv = r();
    type = forced || (hv < 0.36 ? 'village' : hv < 0.56 ? 'chantier' : hv < 0.74 ? 'cabane' : hv < 0.78 ? 'grand' : 'none');
    if (type === 'none') return null;
    let x, z;
    if (type === 'ville') { x = VX; z = VZ; }
    else {
      x = Math.round(VX + i * CELL + (r() - 0.5) * CELL * 0.4); z = Math.round(VZ + j * CELL + (r() - 0.5) * CELL * 0.4);
      if (forced) { x = Math.round(VX + i * CELL + (r() - 0.5) * 16); z = Math.round(VZ + j * CELL + (r() - 0.5) * 16); }
      // pas dans le fleuve
      const rz = riverZ(x), W = riverW(x);
      if (Math.abs(z - rz) < W + 34) z = Math.round(z < rz ? rz - W - 34 : rz + W + 34);
      if (type === 'cabane' && !forced && biomeRaw(x, z, rawH(x, z)) !== BIOME.ERABLIERE && r() < 0.6) type = 'village';
    }
    const R = { ville: VR + 6, village: 23, chantier: 15, grand: 21, cabane: 10 }[type];
    let h = type === 'ville' ? VH : Math.round(rawH(x, z).h);
    if (type !== 'ville') h = Math.max(SEA + 2, Math.min(SEA + 40, h));
    return { type, i, j, x, z, h, R, R2: R + (type === 'ville' ? 36 : 22), seed: (r() * 1e9) | 0, square: type === 'ville' };
  }
  function structsNear(x, z) {
    const ci = Math.round((x - VX) / CELL), cj = Math.round((z - VZ) / CELL), out = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const s = cell(ci + a, cj + b); if (s) out.push(s); }
    return out;
  }
  function biomeRaw(x, z, R) {
    const { h, north, d, W } = R;
    if (d < W + 10 && h <= SEA + 2.5) return BIOME.RIVE;
    if (h > SEA + 30) return BIOME.COLLINES;
    const m = N4.n2(x * 0.0045 - 20, z * 0.0045 + 9), t = N2.n2(x * 0.004 + 50, z * 0.004);
    if (m > 0.3) return BIOME.ERABLIERE;
    if (north > 70 || t < -0.35) return BIOME.BOREALE;
    return BIOME.CAMPAGNE;
  }
  // Colonne : hauteur finale, biome, poids d'aplanissement
  function column(x, z) {
    const R = rawH(x, z); let h = R.h, w = 0, st = null;
    for (const s of structsNear(x, z)) {
      const dx = Math.abs(x - s.x), dz = Math.abs(z - s.z), dist = s.square ? Math.max(dx, dz) : Math.hypot(dx, dz);
      if (dist < s.R2) { const ww = 1 - smooth(s.R, s.R2, dist); if (ww > w) { w = ww; st = s; } h = lerp(h, s.h, ww); }
    }
    let biome = biomeRaw(x, z, R);
    if (st && st.type === 'ville' && w > 0.5) biome = BIOME.VILLE;
    return { h: Math.floor(h), biome, w, st, north: R.north, d: R.d, W: R.W };
  }
  function heightAt(x, z) { return column(Math.floor(x), Math.floor(z)).h; }
  function allStructs(x0, z0, x1, z1) {
    const out = [];
    for (let i = Math.floor((x0 - VX) / CELL) - 1; i <= Math.ceil((x1 - VX) / CELL) + 1; i++) for (let j = Math.floor((z0 - VZ) / CELL) - 1; j <= Math.ceil((z1 - VZ) / CELL) + 1; j++) { const s = cell(i, j); if (s && s.x >= x0 && s.x <= x1 && s.z >= z0 && s.z <= z1) out.push(s); }
    return out;
  }

  // ---------- génération d'un tronçon ----------
  function genChunk(cx, cz) {
    const data = new Uint8Array(CS * CS * WH), ox = cx * CS, oz = cz * CS;
    const idx = (x, y, z) => x + z * CS + y * CS * CS;
    const M = 4, SW = CS + M * 2, cols = new Array(SW * SW);
    for (let z = 0; z < SW; z++) for (let x = 0; x < SW; x++) cols[x + z * SW] = column(ox + x - M, oz + z - M);
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const c = cols[(x + M) + (z + M) * SW], h = Math.min(WH - 2, c.h), wx = ox + x, wz = oz + z;
      data[idx(x, 0, z)] = B.BEDROCK;
      for (let y = 1; y <= h; y++) data[idx(x, y, z)] = B.STONE;
      const hn = hash2(wx, wz, seed);
      let top = B.GRASS, sub = B.DIRT, sd = 3;
      if (c.biome === BIOME.RIVE || h <= SEA) { top = h <= SEA + 1 ? (hn < 0.25 ? B.GRAVEL : B.SAND) : B.GRASS; sub = B.SAND; }
      else if (c.biome === BIOME.COLLINES) {
        const sl = Math.max(Math.abs(cols[(x + M + 1) + (z + M) * SW].h - cols[(x + M - 1) + (z + M) * SW].h), Math.abs(cols[(x + M) + (z + M + 1) * SW].h - cols[(x + M) + (z + M - 1) * SW].h));
        if (sl > 4) { top = B.STONE; sub = B.STONE; } else if (h > SEA + 38 + hn * 4) { top = B.SNOW; sub = B.SNOW; sd = 1 + (hn * 2 | 0); } else if (h > SEA + 33) top = B.SNOWGRASS;
      } else if (c.biome === BIOME.CAMPAGNE && c.north < 0 && N4.n2(wx * 0.03, wz * 0.03) > 0.45 && c.w < 0.1) top = B.FIELD;
      for (let y = Math.max(1, h - sd); y < h; y++) data[idx(x, y, z)] = sub;
      data[idx(x, h, z)] = top;
      for (let y = h + 1; y <= SEA; y++) data[idx(x, y, z)] = B.WATER;
      if (h < SEA && c.north > 220 && c.d > c.W + 20) data[idx(x, SEA, z)] = B.ICE; // lacs gelés au nord
    }
    // primitives découpées au tronçon
    const fill = (x0, y0, z0, x1, y1, z1, b, onlyAir) => {
      if (x0 > x1) [x0, x1] = [x1, x0]; if (z0 > z1) [z0, z1] = [z1, z0];
      const ax = Math.max(x0 - ox, 0), bx = Math.min(x1 - ox, CS - 1), az = Math.max(z0 - oz, 0), bz = Math.min(z1 - oz, CS - 1), ay = Math.max(y0, 1), by = Math.min(y1, WH - 1);
      for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) { const i = idx(x, y, z); if (!onlyAir || data[i] === 0 || data[i] === B.WATER) data[i] = b; }
    };
    const set = (x, y, z, b, onlyAir) => fill(x, y, z, x, y, z, b, onlyAir);
    const P = { fill, set, ox, oz };
    // arbres
    for (let z = 0; z < SW; z++) for (let x = 0; x < SW; x++) {
      const c = cols[x + z * SW], wx = ox + x - M, wz = oz + z - M;
      if (c.w > 0.02 || c.h <= SEA + 1 || c.biome === BIOME.RIVE) continue;
      const hv = hash2(wx, wz, seed + 9);
      const dens = [0, 0.008, 0.05, 0.04, 0.016, 0][c.biome] * (c.biome === BIOME.COLLINES && c.h > SEA + 40 ? 0.2 : 1);
      if (hv >= dens) continue;
      const hv2 = hash2(wz, wx, seed + 13);
      if (c.biome === BIOME.BOREALE || c.biome === BIOME.COLLINES) spruce(P, wx, c.h, wz, hv2, c.h > SEA + 33);
      else if (c.biome === BIOME.ERABLIERE) hv2 < 0.82 ? maple(P, wx, c.h, wz, hv2) : birch(P, wx, c.h, wz, hv2);
      else hv2 < 0.5 ? birch(P, wx, c.h, wz, hv2) : maple(P, wx, c.h, wz, hv2);
    }
    // structures
    const seen = new Set();
    for (const [dx, dz] of [[0, 0], [CS, 0], [0, CS], [CS, CS], [CS / 2, CS / 2]]) for (const s of structsNear(ox + dx, oz + dz)) {
      if (seen.has(s)) continue; seen.add(s);
      const rad = s.R + 4; if (s.x + rad < ox || s.x - rad > ox + CS || s.z + rad < oz || s.z - rad > oz + CS) continue;
      BUILD[s.type](P, s);
    }
    return data;
  }
  return { genChunk, column, heightAt, rawH, riverZ, riverW, structsNear, cell, allStructs, VX, VZ, VH, VR, layout };
}

// ---------- arbres ----------
function spruce(P, x, h, z, r, snowy) {
  const t = 6 + (r * 5 | 0);
  P.fill(x, h + 1, z, x, h + t, z, B.SLOG);
  for (let y = h + 3; y <= h + t + 1; y++) {
    const rr = Math.min(3, Math.round((h + t + 1 - y) / 2.6 + ((y - h) % 2 ? 0 : 0.4)));
    for (let a = -rr; a <= rr; a++) for (let b = -rr; b <= rr; b++) if (Math.abs(a) + Math.abs(b) <= rr + (rr > 1 ? 1 : 0) && (a || b || y > h + t)) P.set(x + a, y, z + b, snowy && (y - h) % 2 === 0 ? B.SNOWLEAF : B.SPRUCE, true);
  }
  P.set(x, h + t + 2, z, snowy ? B.SNOWLEAF : B.SPRUCE, true);
}
function maple(P, x, h, z, r) {
  const t = 4 + (r * 3 | 0), cy = h + t + 1, R = 2.4 + r * 0.9;
  P.fill(x, h + 1, z, x, h + t, z, B.LOG);
  for (let a = -3; a <= 3; a++) for (let b = -2; b <= 3; b++) for (let c = -3; c <= 3; c++) {
    const d = Math.hypot(a, b * 1.15, c); if (d > R) continue;
    const hv = hash2(x + a * 7 + b * 131, z + c * 13, 777);
    if (d > R - 0.8 && hv < 0.25) continue;
    P.set(x + a, cy + b, z + c, hv < 0.55 ? B.MAPLE : B.MAPLE2, true);
  }
}
function birch(P, x, h, z, r) {
  const t = 5 + (r * 3 | 0), cy = h + t;
  P.fill(x, h + 1, z, x, h + t, z, B.BIRCHLOG);
  for (let a = -2; a <= 2; a++) for (let b = -1; b <= 2; b++) for (let c = -2; c <= 2; c++) if (Math.hypot(a, b * 1.3, c) <= 2.2) P.set(x + a, cy + b, z + c, B.BIRCH, true);
}

// ---------- bâtiments ----------
function house(P, x0, z0, w, d, h, wall, roof, door, H = 4, chimney = false, ridgeX = null) {
  const x1 = x0 + w - 1, z1 = z0 + d - 1;
  P.fill(x0, h, z0, x1, h, z1, B.DPLANK);
  P.fill(x0, h + 1, z0, x1, h + H, z1, wall);
  P.fill(x0 + 1, h + 1, z0 + 1, x1 - 1, h + H + 8, z1 - 1, B.AIR);
  for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) P.fill(cx, h + 1, cz, cx, h + H, cz, B.DPLANK);
  // fenêtres
  for (let x = x0 + 2; x < x1 - 0; x += 3) { P.set(x, h + 2, z0, B.GLASS); P.set(x, h + 2, z1, B.GLASS); }
  for (let z = z0 + 2; z < z1 - 0; z += 3) { P.set(x0, h + 2, z, B.GLASS); P.set(x1, h + 2, z, B.GLASS); }
  // porte (2 de haut)
  const mx = (x0 + x1) >> 1, mz = (z0 + z1) >> 1;
  const dp = { n: [mx, z0], s: [mx, z1], w: [x0, mz], e: [x1, mz] }[door];
  P.fill(dp[0], h + 1, dp[1], dp[0], h + 2, dp[1], B.AIR);
  const lamp = { n: [mx + 1, z0 - 1], s: [mx + 1, z1 + 1], w: [x0 - 1, mz + 1], e: [x1 + 1, mz + 1] }[door];
  P.set(lamp[0], h + 3, lamp[1], B.LAMP);
  // toit à deux versants, pente raide (style québécois)
  const alongX = ridgeX ?? (w >= d);
  const span = alongX ? d : w;
  for (let k = 0; k <= (span >> 1) + 1; k++) {
    const y = h + H + 1 + k;
    if (alongX) { const a = z0 - 1 + k, b = z1 + 1 - k; if (a > b) break; P.fill(x0 - 1, y, a, x1 + 1, y, b, roof); if (b - a >= 2) P.fill(x0, y, a + 1, x1, y, b - 1, k === 0 ? B.AIR : roof); }
    else { const a = x0 - 1 + k, b = x1 + 1 - k; if (a > b) break; P.fill(a, y, z0 - 1, b, y, z1 + 1, roof); if (b - a >= 2) P.fill(a + 1, y, z0, b - 1, y, z1, k === 0 ? B.AIR : roof); }
  }
  // pignons
  if (alongX) for (let k = 0; k <= span >> 1; k++) { const y = h + H + 1 + k, a = z0 + k, b = z1 - k; if (a > b) break; P.fill(x0, y, a, x0, y, b, wall); P.fill(x1, y, a, x1, y, b, wall); }
  else for (let k = 0; k <= span >> 1; k++) { const y = h + H + 1 + k, a = x0 + k, b = x1 - k; if (a > b) break; P.fill(a, y, z0, b, y, z0, wall); P.fill(a, y, z1, b, y, z1, wall); }
  if (chimney) P.fill(x1 - 1, h + H, z0 + 1, x1 - 1, h + H + (span >> 1) + 3, z0 + 1, B.BRICK);
}
function church(P, cx, cz, h) {
  const w = 7, d = 12, x0 = cx - 3, z0 = cz - 6;
  house(P, x0, z0, w, d, h, B.WHITE, B.TIN, 's', 6, false, false);
  // clocher à l'avant (sud)
  const tz = z0 + d - 1;
  P.fill(cx - 1, h + 1, tz - 1, cx + 1, h + 12, tz + 1, B.WHITE);
  P.fill(cx, h + 1, tz + 1, cx, h + 3, tz + 1, B.AIR);
  P.fill(cx, h + 9, tz - 1, cx, h + 10, tz + 1, B.AIR); P.fill(cx - 1, h + 9, tz, cx + 1, h + 10, tz, B.AIR);
  P.fill(cx - 2, h + 13, tz - 2, cx + 2, h + 13, tz + 2, B.TIN);
  P.fill(cx - 1, h + 14, tz - 1, cx + 1, h + 16, tz + 1, B.TIN);
  P.fill(cx, h + 17, tz, cx, h + 22, tz, B.TIN);
  P.fill(cx, h + 23, tz, cx, h + 25, tz, B.GOLD); P.fill(cx - 1, h + 24, tz, cx + 1, h + 24, tz, B.GOLD);
}
function lampPost(P, x, z, h) { P.fill(x, h + 1, z, x, h + 3, z, B.DPLANK); P.set(x, h + 4, z, B.LAMP); }

export function layout(s) {
  // Métadonnées d'une structure : PNJ, points d'apparition, objets à ramasser, entrées.
  const r = mulberry(s.seed), m = { npcs: [], spawns: [], items: [], gates: [], houses: [] };
  if (s.type === 'village') {
    const n = 5 + (r() * 2 | 0), a0 = r() * 6.28;
    for (let k = 0; k < n; k++) {
      const a = a0 + k / n * 6.283 + (r() - 0.5) * 0.3, rad = 14 + r() * 3;
      const w = 6 + (r() * 3 | 0), d = 5 + (r() * 2 | 0);
      const hx = Math.round(s.x + Math.cos(a) * rad - w / 2), hz = Math.round(s.z + Math.sin(a) * rad - d / 2);
      const dx = Math.cos(a), dz = Math.sin(a); const door = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'w' : 'e') : (dz > 0 ? 'n' : 's');
      const wall = [B.WHITE, B.PLANK, B.WHITE, B.BRICK][r() * 4 | 0], roof = [B.REDROOF, B.COPPER, B.TIN, B.REDROOF][r() * 4 | 0];
      if (Math.abs(Math.sin(a) + 1) < 0.35) continue; // place pour l'église au nord
      m.houses.push({ x: hx, z: hz, w, d, wall: k === 0 ? B.BRICK : wall, roof, door, shop: k === 0 });
    }
    m.npcs.push({ role: 'aubergiste', x: s.x + 2.5, z: s.z + 1.5 });
    const shop = m.houses[0]; if (shop) { const sx = shop.x + shop.w / 2, sz = shop.z + shop.d / 2; m.npcs.push({ role: 'commercant', x: s.x + (sx - s.x) * 0.55, z: s.z + (sz - s.z) * 0.55 }); }
    for (let k = 0; k < 3; k++) m.npcs.push({ role: 'villageois', x: s.x + (r() - 0.5) * 16, z: s.z + (r() - 0.5) * 16 });
    if (s.i === -1 && s.j === 0) m.npcs.push({ role: 'ginette', x: s.x - 3, z: s.z + 3 });
  } else if (s.type === 'ville') {
    m.npcs.push({ role: 'gaston', x: s.x + 4.5, z: s.z + 8.5 }, { role: 'lapaperasse', x: s.x - 5.5, z: s.z - 7.5 }, { role: 'commercant', x: s.x + 12.5, z: s.z + 14.5 });
    for (let k = 0; k < 5; k++) m.npcs.push({ role: 'villageois', x: s.x + (r() - 0.5) * 50, z: s.z + 8 + r() * 20 });
    m.npcs.push({ role: 'garde', x: s.x + 3, z: s.z - s.R + 3 }, { role: 'garde', x: s.x - 3, z: s.z + s.R - 3 });
    m.gates.push({ x: s.x, z: s.z - 34 - 3 }, { x: s.x, z: s.z + 34 + 3 });
  } else if (s.type === 'cabane') {
    m.npcs.push({ role: s.i === 1 && s.j === 0 ? 'pepere' : 'acericulteur', x: s.x + 1.5, z: s.z + 5 });
    for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283 + 0.3; m.items.push({ kind: 'chaudiere', x: s.x + Math.cos(a) * 13 + 0.5, z: s.z + Math.sin(a) * 13 + 0.5 + 1.2 }); }
  } else if (s.type === 'chantier' || s.type === 'grand') {
    const n = s.type === 'grand' ? 7 : 6;
    for (let k = 0; k < n; k++) { const a = k / n * 6.283; m.spawns.push({ type: 'cone', x: s.x + Math.cos(a) * 7, z: s.z + Math.sin(a) * 7 }); }
    if (s.type === 'grand') m.spawns.push({ type: 'supreme', x: s.x, z: s.z });
  }
  return m;
}

const BUILD = {
  village(P, s) {
    const m = layout(s), h = s.h;
    P.fill(s.x - 6, h, s.z - 6, s.x + 6, h, s.z + 6, B.GRAVEL);
    for (const ho of m.houses) {
      const cx = ho.x + (ho.w >> 1), cz = ho.z + (ho.d >> 1);
      // sentier vers la place
      const n = Math.ceil(Math.hypot(cx - s.x, cz - s.z));
      for (let k = 0; k <= n; k++) { const t = k / n, x = Math.round(s.x + (cx - s.x) * t), z = Math.round(s.z + (cz - s.z) * t); P.fill(x, h, z, x + 1, h, z, B.PATH); }
    }
    for (const ho of m.houses) house(P, ho.x, ho.z, ho.w, ho.d, h, ho.wall, ho.roof, ho.door, 4, !ho.shop);
    church(P, s.x, s.z - 15, h);
    lampPost(P, s.x - 5, s.z - 5, h); lampPost(P, s.x + 5, s.z + 5, h); lampPost(P, s.x + 5, s.z - 5, h); lampPost(P, s.x - 5, s.z + 5, h);
    // puits / mât au centre avec drapeau bleu
    P.fill(s.x, h + 1, s.z, s.x, h + 7, s.z, B.WHITE); P.fill(s.x + 1, h + 5, s.z, s.x + 3, h + 7, s.z, B.BLUE); P.set(s.x + 2, h + 6, s.z, B.WHITE);
    // ballots de foin
    P.fill(s.x + 8, h + 1, s.z + 9, s.x + 9, h + 1, s.z + 9, B.HAY);
  },
  cabane(P, s) {
    const h = s.h;
    P.fill(s.x - 5, h, s.z - 4, s.x + 6, h, s.z + 7, B.PATH);
    house(P, s.x - 4, s.z - 3, 9, 7, h, B.DPLANK, B.REDROOF, 's', 4, true);
    // cheminée à vapeur au faîte (évaporateur)
    P.fill(s.x, h + 9, s.z, s.x + 1, h + 10, s.z, B.PLANK);
    // érables autour (sur le cercle des chaudières)
    for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283 + 0.3, x = Math.round(s.x + Math.cos(a) * 13), z = Math.round(s.z + Math.sin(a) * 13); maple(P, x, h, z, (k * 0.37) % 1); }
    P.fill(s.x + 6, h + 1, s.z + 4, s.x + 7, h + 2, s.z + 4, B.LOG);
  },
  chantier(P, s) {
    const h = s.h, r = mulberry(s.seed + 5), big = s.type === 'grand', R = big ? 15 : 10;
    P.fill(s.x - R, h, s.z - R, s.x + R, h, s.z + R, B.ROAD);
    for (let x = s.x - R; x <= s.x + R; x += 4) P.fill(x, h, s.z, x + 1, h, s.z, B.YELLOW);
    // barrières orange et blanches
    for (let k = -R; k <= R; k++) { const b = (k & 1) ? B.CONE : B.STRIPE; if (Math.abs(k) > 2) { P.set(s.x + k, h + 1, s.z - R, b); P.set(s.x + k, h + 1, s.z + R, b); P.set(s.x - R, h + 1, s.z + k, b); P.set(s.x + R, h + 1, s.z + k, b); } }
    // cônes empilés
    for (let k = 0; k < (big ? 26 : 12); k++) { const x = s.x + Math.round((r() - 0.5) * R * 1.6), z = s.z + Math.round((r() - 0.5) * R * 1.6); P.set(x, h + 1, z, B.CONE); if (r() < 0.3) P.set(x, h + 2, z, B.STRIPE); }
    // roulotte de chantier
    const tx = s.x - R + 2, tz = s.z - R + 2;
    P.fill(tx, h + 1, tz, tx + 5, h + 3, tz + 2, B.WHITE); P.set(tx + 2, h + 2, tz + 2, B.GLASS); P.set(tx + 4, h + 2, tz + 2, B.GLASS); P.fill(tx, h + 4, tz, tx + 5, h + 4, tz + 2, B.TIN);
    // tas de terre et de gravier
    P.fill(s.x + R - 5, h + 1, s.z + R - 5, s.x + R - 2, h + 2, s.z + R - 2, B.DIRT); P.fill(s.x + R - 4, h + 3, s.z + R - 4, s.x + R - 3, h + 3, s.z + R - 3, B.GRAVEL);
    // grue jaune
    const gx = s.x + R - 3, gz = s.z - R + 3, gh = big ? 22 : 14;
    P.fill(gx, h + 1, gz, gx, h + gh, gz, B.YELLOW); P.fill(gx - (big ? 12 : 8), h + gh, gz, gx + 3, h + gh, gz, B.YELLOW); P.fill(gx + 2, h + gh - 2, gz, gx + 3, h + gh - 1, gz, B.STONE);
    P.set(gx - (big ? 12 : 8), h + gh + 1, gz, B.LAMP);
  },
  grand(P, s) { BUILD.chantier(P, s); },
  ville(P, s) {
    const h = s.h, R = 34, x0 = s.x - R, x1 = s.x + R, z0 = s.z - R, z1 = s.z + R;
    // pavés + rues
    P.fill(x0, h, z0, x1, h, z1, B.GRASS);
    P.fill(s.x - 2, h, z0 - 8, s.x + 2, h, z1 + 8, B.COBBLE); P.fill(x0, h, s.z + 2, x1, h, s.z + 6, B.COBBLE);
    P.fill(x0 + 3, h, s.z - 14, x1 - 3, h, s.z - 12, B.COBBLE);
    // remparts
    const WT = h + 8;
    for (const [a, b, c, d] of [[x0, z0, x1, z0 + 1], [x0, z1 - 1, x1, z1], [x0, z0, x0 + 1, z1], [x1 - 1, z0, x1, z1]]) P.fill(a, h - 2, b, c, WT, d, B.COBBLE);
    for (let k = x0; k <= x1; k += 2) { P.set(k, WT + 1, z0, B.COBBLE); P.set(k, WT + 1, z1, B.COBBLE); }
    for (let k = z0; k <= z1; k += 2) { P.set(x0, WT + 1, k, B.COBBLE); P.set(x1, WT + 1, k, B.COBBLE); }
    // chemin de ronde accessible : escaliers intérieurs
    
    // bastions d'angle
    for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) { P.fill(cx - 3, h - 2, cz - 3, cx + 3, WT + 3, cz + 3, B.COBBLE); P.fill(cx - 2, WT + 3, cz - 2, cx + 2, WT + 3, cz + 2, B.AIR); P.set(cx, WT + 4, cz, B.LAMP); }
    // chemin de ronde accessible : escalier intérieur au sud-ouest
    for (let k = 0; k < 8; k++) P.fill(x0 + 5 + k, h + 1, z1 - 3, x0 + 5 + k, h + 1 + k, z1 - 2, B.COBBLE);
    // portes nord et sud (arches)
    for (const zz of [z0, z1]) { P.fill(s.x - 2, h + 1, zz - 1, s.x + 2, h + 5, zz + 1, B.AIR); P.fill(s.x - 3, h + 6, zz - 1, s.x + 3, WT + 2, zz + 1, B.COBBLE); P.fill(s.x - 1, WT + 3, zz, s.x + 1, WT + 3, zz, B.COPPER); }
    // le Château (fictif) : brique, toits de cuivre vert, tourelles
    const cx0 = s.x + 6, cz0 = s.z - 30, cw = 24, cd = 13, CH = 11, mx = cx0 + 12;
    P.fill(cx0, h, cz0, cx0 + cw - 1, h, cz0 + cd - 1, B.COBBLE);
    P.fill(cx0, h + 1, cz0, cx0 + cw - 1, h + CH, cz0 + cd - 1, B.BRICK);
    P.fill(cx0 + 1, h + 1, cz0 + 1, cx0 + cw - 2, h + CH - 1, cz0 + cd - 2, B.AIR);
    for (let y = h + 3; y < h + CH; y += 3) for (let x = cx0 + 2; x < cx0 + cw - 2; x += 2) { P.set(x, y, cz0, B.GLASS); P.set(x, y, cz0 + cd - 1, B.GLASS); }
    for (let y = h + 3; y < h + CH; y += 3) for (let z = cz0 + 2; z < cz0 + cd - 2; z += 2) { P.set(cx0, y, z, B.GLASS); P.set(cx0 + cw - 1, y, z, B.GLASS); }
    P.fill(mx - 1, h + 1, cz0 + cd - 1, mx + 1, h + 3, cz0 + cd - 1, B.AIR); P.fill(mx - 1, h, cz0 + cd, mx + 1, h, s.z - 12, B.COBBLE);
    for (let k = 0; k < 8; k++) { const y = h + CH + 1 + k, a = cz0 - 1 + k, b = cz0 + cd - k; if (a > b) break; P.fill(cx0 - 1, y, a, cx0 + cw, y, b, B.COPPER); }
    // lucarnes
    for (let x = cx0 + 3; x < cx0 + cw - 3; x += 4) { P.set(x, h + CH + 2, cz0 + cd, B.GLASS); P.set(x, h + CH + 2, cz0 - 1, B.GLASS); }
    for (const [tx, tz] of [[cx0 - 1, cz0 - 1], [cx0 + cw - 2, cz0 - 1], [cx0 - 1, cz0 + cd - 2], [cx0 + cw - 2, cz0 + cd - 2]]) {
      P.fill(tx, h + 1, tz, tx + 2, h + CH + 4, tz + 2, B.BRICK); P.set(tx + 1, h + CH, tz, B.GLASS);
      P.fill(tx, h + CH + 5, tz, tx + 2, h + CH + 6, tz + 2, B.COPPER); P.fill(tx + 1, h + CH + 7, tz + 1, tx + 1, h + CH + 10, tz + 1, B.COPPER);
    }
    // tour centrale
    const tx = mx - 3, tz = cz0 + 3;
    P.fill(tx, h + CH, tz, tx + 6, h + CH + 10, tz + 6, B.BRICK);
    for (let y = h + CH + 3; y < h + CH + 10; y += 3) { P.set(tx + 3, y, tz + 6, B.GLASS); P.set(tx + 3, y, tz, B.GLASS); P.set(tx, y, tz + 3, B.GLASS); P.set(tx + 6, y, tz + 3, B.GLASS); }
    for (let k = 0; k < 4; k++) P.fill(tx - 1 + k, h + CH + 11 + k * 2, tz - 1 + k, tx + 7 - k, h + CH + 12 + k * 2, tz + 7 - k, B.COPPER);
    P.fill(mx, h + CH + 19, tz + 3, mx, h + CH + 24, tz + 3, B.COPPER); P.set(mx, h + CH + 25, tz + 3, B.GOLD);
    // drapeau bleu et blanc (fictif)
    P.fill(mx + 1, h + CH + 22, tz + 3, mx + 5, h + CH + 24, tz + 3, B.BLUE); P.fill(mx + 3, h + CH + 22, tz + 3, mx + 3, h + CH + 24, tz + 3, B.WHITE); P.fill(mx + 1, h + CH + 23, tz + 3, mx + 5, h + CH + 23, tz + 3, B.WHITE);
    // basilique (fictive) au nord-ouest
    church(P, s.x - 18, s.z - 24, h);
    // maisons de la Vieille-Ville (rangées)
    const r = mulberry(s.seed);
    const rows = [[x0 + 4, s.z + 10], [s.x + 5, s.z + 10], [x0 + 4, s.z + 20], [s.x + 5, s.z + 20], [x0 + 4, s.z - 8], [s.x + 5, s.z - 8]];
    for (const [rx, rz] of rows) for (let k = 0; k < 4; k++) {
      const w = 6 + (r() * 2 | 0), hx = rx + k * 7; if (hx + w > (rx < s.x ? s.x - 3 : x1 - 3)) break;
      house(P, hx, rz, Math.min(w, 6), 6, h, [B.COBBLE, B.WHITE, B.BRICK, B.WHITE][r() * 4 | 0], [B.TIN, B.REDROOF, B.COPPER, B.TIN][r() * 4 | 0], rz < s.z ? 's' : 'n', 4 + (r() * 2 | 0), r() < 0.5, true);
    }
    // terrasse de planches au sud, avec lanternes
    P.fill(x0 + 3, h, z1 - 6, x1 - 3, h, z1 - 3, B.PLANK);
    for (let x = x0 + 4; x < x1 - 3; x += 8) lampPost(P, x, z1 - 4, h);
    for (let z = s.z - 12; z < z1; z += 8) { lampPost(P, s.x - 4, z, h); lampPost(P, s.x + 4, z, h); }
    // fontaine
    P.fill(s.x - 2, h + 1, s.z + 3, s.x + 2, h + 1, s.z + 5, B.COBBLE); P.fill(s.x - 1, h + 1, s.z + 4, s.x + 1, h + 1, s.z + 4, B.WATER); P.fill(s.x, h + 2, s.z + 4, s.x, h + 3, s.z + 4, B.COBBLE);
  },
};

// Génération procédurale du monde : relief, fleuve, biomes, arbres, structures (Vieille-Ville, villages, chantiers, cabanes à sucre).
// Partagé entre le Web Worker (blocs) et le fil principal (hauteurs, positions des structures et des PNJ).
import { makeNoise, mulberry, hash2, smooth } from './noise.js';
import { createRegions, buildCity, regLayout, regBuild } from './regions.js';
import { B, CS, WH, SEA, SEAV, CSM, VS } from './blocks.js';
import { createNord, buildRoad, nordLayout, nordBuild } from './nord.js';
export const BIOME = { RIVE: 0, CAMPAGNE: 1, BOREALE: 2, ERABLIERE: 3, COLLINES: 4, VILLE: 5 };
export const BIOME_NAME = ['Rives du Fleuve', 'Campagne', 'Forêt boréale', 'Érablière', 'Laurentides enneigées', 'Vieille-Ville'];
export const CELL = 144;
const lerp = (a, b, t) => a + (b - a) * t;

export function createGen(seed) {
  const N = makeNoise(seed), N2 = makeNoise(seed + 101), N3 = makeNoise(seed + 202), N4 = makeNoise(seed + 303);
  const riverZ = x => 34 * N.fbm(x * 0.0022 + 3.1, 1.7, 3) + 12 * N2.n2(x * 0.009, 7.7);
  const riverW = x => 24 + 8 * N3.n2(x * 0.004, 1.3) + 180 * smooth(1750, 2350, x); // le fleuve s'élargit en golfe vers la Gaspésie
  const VX = 0, VZ = Math.round(riverZ(0) - 72), VH = SEA + 17, VR = 34;
  const nord = createNord({ N, N2, N3, seed });
  const reg = createRegions({ N, N2, N3, seed, riverZ, riverW, VX });
  { const nr = nord.region; nord.region = (x, z) => reg.region(x, z) || nr(x, z); nord.labels.push(...reg.labels); nord.stops.push(...reg.stops); Object.assign(nord.places, reg.places); }
  function rawH(x, z) {
    const rz = riverZ(x), north = rz - z, d = Math.abs(z - rz), W = riverW(x);
    if (z < -660) { const T = nord.terrain(x, z, 0); return { h: T.h, north, d, W, wl: T.wl, nord: T.nord, rd: T.rd, nb: T.biome, dens: T.dens }; }
    const base = N.fbm(x * 0.006, z * 0.006, 4);
    let land;
    const r = N3.ridge(x * 0.007, z * 0.007, 4);
    if (north > 0) { const m = smooth(50, 380, north); land = SEA + 5 + base * 4 + 6 * N2.fbm(x * 0.0025, z * 0.0025, 3) + m * (8 + 44 * r * r * r * 1.4); }
    else land = SEA + 4 + base * 2.5 + 4 * N2.fbm(x * 0.003, z * 0.003, 2) + smooth(160, 600, -north) * 14 * r * r;
    const bed = SEA - 1 - 8 * Math.max(0, 1 - (d / W) ** 2);
    const sh = smooth(W * 0.8, W + 30, d);
    const T = nord.terrain(x, z, lerp(bed, land, sh));
    const RG = reg.terrain(x, z, T.h, north, d, W);
    if (RG) return { h: RG.h, north, d, W, wl: 0, nord: false, rd: 99, nb: RG.nb, dens: RG.dens, reg: RG.reg, city: RG.city };
    return { h: T.h, north, d, W, wl: T.wl, nord: T.nord, rd: T.rd, nb: T.biome, dens: T.dens };
  }
  // ---------- structures (grille de cellules) ----------
  const cellCache = new Map();
  function cell(i, j) {
    const k = i + ',' + j; let s = cellCache.get(k); if (s !== undefined) return s;
    s = makeCell(i, j); cellCache.set(k, s); return s;
  }
  function makeCell(i, j) {
    let type;
    if (j <= -3) return null; // le Nord a ses propres lieux (nord.js)
    { const cx = VX + i * CELL, cz = VZ + j * CELL; if (reg.region(cx, cz) || reg.region(cx, cz - 60) || reg.region(cx, cz + 60)) return null; } // nouvelles régions : leurs propres lieux
    const forced = { '0,0': 'ville', '1,0': 'cabane', '-1,0': 'village', '0,-1': 'chantier', '2,-1': 'grand', '-1,-1': 'none', '1,-1': 'none', '0,-2': 'none' }[i + ',' + j];
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
    if (z < -400) for (const s of nord.structs) { const r = Math.max(s.R2, s.BR || 0) + 20; if (Math.abs(x - s.x) < r && Math.abs(z - s.z) < r) out.push(s); }
    for (const s of reg.structs) { const r = Math.max(s.R2, s.BR || 0) + 20; if (Math.abs(x - s.x) < r && Math.abs(z - s.z) < r) out.push(s); }
    return out;
  }
  function biomeRaw(x, z, R) {
    const { h, north, d, W } = R;
    if (R.nb >= 0) return R.nb;
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
    return { h: Math.floor(h), hc: h, biome, w, st, north: R.north, d: R.d, W: R.W, wl: w > 0.5 && st && st.nord && st.type !== 'camp' ? 0 : R.wl, nord: R.nord, rd: R.rd, dens: R.dens, reg: R.reg, city: R.city };
  }
  // hauteur du dernier voxel plein (en mètres, multiple de VS) : la surface est à heightAt + 1
  function heightAt(x, z) { const c = column(Math.floor(x), Math.floor(z)); return Math.floor(c.hc * 2) / 2; }
  function allStructs(x0, z0, x1, z1) {
    const out = [];
    for (let i = Math.floor((x0 - VX) / CELL) - 1; i <= Math.ceil((x1 - VX) / CELL) + 1; i++) for (let j = Math.floor((z0 - VZ) / CELL) - 1; j <= Math.ceil((z1 - VZ) / CELL) + 1; j++) { const s = cell(i, j); if (s && s.x >= x0 && s.x <= x1 && s.z >= z0 && s.z <= z1) out.push(s); }
    for (const s of nord.structs) if (s.x >= x0 && s.x <= x1 && s.z >= z0 && s.z <= z1) out.push(s);
    for (const s of reg.structs) if (s.x >= x0 && s.x <= x1 && s.z >= z0 && s.z <= z1) out.push(s);
    return out;
  }

  // ---------- génération d'un tronçon (voxels fins de VS m) ----------
  function genChunk(cx, cz) {
    const data = new Uint8Array(CS * CS * WH), ox = cx * CS, oz = cz * CS, oxm = cx * CSM, ozm = cz * CSM;
    const idx = (x, y, z) => x + z * CS + y * CS * CS;
    // grille d'un mètre avec marge (bruit coûteux), interpolée au voxel
    const M = 7, GW = CSM + 2 * M + 1, cols = new Array(GW * GW);
    for (let j = 0; j < GW; j++) for (let i = 0; i < GW; i++) cols[i + j * GW] = column(oxm - M + i, ozm - M + j);
    const FM = 2, FW = CS + 2 * FM, hf = new Int16Array(FW * FW), cf = new Array(FW * FW);
    for (let zv = -FM; zv < CS + FM; zv++) for (let xv = -FM; xv < CS + FM; xv++) {
      const gx = (xv + 0.5) * VS + M - 0.5, gz = (zv + 0.5) * VS + M - 0.5, i0 = Math.floor(gx), j0 = Math.floor(gz), fx = gx - i0, fz = gz - j0;
      const c00 = cols[i0 + j0 * GW], c10 = cols[i0 + 1 + j0 * GW], c01 = cols[i0 + (j0 + 1) * GW], c11 = cols[i0 + 1 + (j0 + 1) * GW];
      const hc = lerp(lerp(c00.hc, c10.hc, fx), lerp(c01.hc, c11.hc, fx), fz), k = (xv + FM) + (zv + FM) * FW;
      hf[k] = Math.min(WH - 3, Math.floor(hc * 2) + 1); cf[k] = fx < 0.5 ? (fz < 0.5 ? c00 : c01) : (fz < 0.5 ? c10 : c11);
    }
    const H = (xv, zv) => hf[(xv + FM) + (zv + FM) * FW];
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const k = (x + FM) + (z + FM) * FW, c = cf[k], h = hf[k], wx = ox + x, wz = oz + z, hm = h / 2;
      data[idx(x, 0, z)] = B.BEDROCK;
      for (let y = 1; y <= h; y++) data[idx(x, y, z)] = B.STONE;
      // minerais (charbon, fer) en petites poches dans la pierre, sous la terre
      const ro = hash2(wx >> 1, wz >> 1, seed + 601);
      if (ro < 0.05 && h > 16) { const y0 = 4 + Math.floor(hash2(wz >> 1, wx >> 1, seed + 602) * (h - 16)), ore = ro < 0.032 ? B.COAL : B.IRONORE; data[idx(x, y0, z)] = ore; data[idx(x, y0 + 1, z)] = ore; }
      const hn = hash2(wx >> 1, wz >> 1, seed);
      let top = B.GRASS, sub = B.DIRT, sd = 6;
      const wv = c.wl ? c.wl * 2 + 1 : SEAV;
      if (c.nord && c.w < 0.3) { const sl = Math.max(Math.abs(H(x + 2, z) - H(x - 2, z)), Math.abs(H(x, z + 2) - H(x, z - 2))); if (sl > 6) { top = B.STONE; sub = B.STONE; } }
      if (top === B.STONE) {}
      else if (c.biome === BIOME.RIVE || h <= wv) { top = h <= wv + 2 ? (hn < 0.25 ? B.GRAVEL : (N3.n2(wx * 0.04, wz * 0.04) > 0.55 ? B.PEBBLE : B.SAND)) : B.GRASS; sub = B.SAND; }
      else if (c.biome === BIOME.COLLINES) {
        const sl = Math.max(Math.abs(H(x + 2, z) - H(x - 2, z)), Math.abs(H(x, z + 2) - H(x, z - 2)));
        if (sl > 8) { top = B.STONE; sub = B.STONE; } else if (hm > SEA + 38 + hn * 4) { top = B.SNOW; sub = B.SNOW; sd = 2 + (hn * 4 | 0); } else if (hm > SEA + 33) top = B.SNOWGRASS;
      } else if (c.biome === BIOME.CAMPAGNE && c.north < 0 && N4.n2(wx * 0.015, wz * 0.015) > 0.45 && c.w < 0.1) top = (wz & 3) < 2 ? B.FIELD : B.DIRT;
      else if (c.biome === BIOME.BOREALE && c.w < 0.05 && N2.n2(wx * 0.05 + 7, wz * 0.05) > 0.35) top = B.MOSS;
      for (let y = Math.max(1, h - sd); y < h; y++) data[idx(x, y, z)] = sub;
      data[idx(x, h, z)] = top;
      for (let y = h + 1; y <= wv; y++) data[idx(x, y, z)] = B.WATER;
      if (h < SEAV && c.north > 220 && c.d > c.W + 20 && !c.nord && !c.wl) data[idx(x, SEAV, z)] = B.ICE; // lacs gelés au nord (pas dans la réserve)
    }
    // primitives découpées au tronçon : ffill en voxels fins absolus, fill en mètres (blocs de 2×2×2 voxels)
    const ffill = (x0, y0, z0, x1, y1, z1, b, onlyAir) => {
      if (x0 > x1) [x0, x1] = [x1, x0]; if (z0 > z1) [z0, z1] = [z1, z0]; if (y0 > y1) [y0, y1] = [y1, y0];
      const ax = Math.max(x0 - ox, 0), bx = Math.min(x1 - ox, CS - 1), az = Math.max(z0 - oz, 0), bz = Math.min(z1 - oz, CS - 1), ay = Math.max(y0, 1), by = Math.min(y1, WH - 1);
      for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) { const i = idx(x, y, z); if (!onlyAir || data[i] === 0 || data[i] === B.WATER || data[i] >= B.TUFT && data[i] <= B.BERRY) data[i] = b; }
    };
    const fset = (x, y, z, b, onlyAir) => { const lx = x - ox, lz = z - oz; if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || y < 1 || y >= WH) return; const i = idx(lx, y, lz); if (!onlyAir || data[i] === 0 || data[i] === B.WATER || data[i] >= B.TUFT && data[i] <= B.BERRY) data[i] = b; };
    const fget = (x, y, z) => { const lx = x - ox, lz = z - oz; if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || y < 0 || y >= WH) return -1; return data[idx(lx, y, lz)]; };
    const fill = (x0, y0, z0, x1, y1, z1, b, onlyAir) => { if (x0 > x1) [x0, x1] = [x1, x0]; if (z0 > z1) [z0, z1] = [z1, z0]; if (y0 > y1) [y0, y1] = [y1, y0]; ffill(2 * x0, 2 * y0, 2 * z0, 2 * x1 + 1, 2 * y1 + 1, 2 * z1 + 1, b, onlyAir); };
    const set = (x, y, z, b, onlyAir) => fill(x, y, z, x, y, z, b, onlyAir);
    const P = { fill, set, ffill, fset, fget, ox, oz };
    // arbres et rochers (positions tirées sur la grille d'un mètre)
    for (let j = 0; j < GW; j++) for (let i = 0; i < GW; i++) {
      const c = cols[i + j * GW], wx = oxm - M + i, wz = ozm - M + j;
      if (c.w > 0.02 || c.city || c.h <= SEA + 1 || c.biome === BIOME.RIVE || c.rd < 9 || (c.wl && c.h < c.wl + 1)) continue;
      const hv = hash2(wx, wz, seed + 9), fy = Math.min(WH - 3, Math.floor(c.hc * 2) + 1), fx = wx * 2, fz = wz * 2;
      const dens = [0, 0.008, 0.05, 0.04, 0.016, 0][c.biome] * (c.biome === BIOME.COLLINES && c.h > SEA + 40 ? 0.2 : 1) * (c.dens || 1);
      if (hv >= dens) { if (hv < dens + [0, 0.002, 0.004, 0.002, 0.006, 0][c.biome]) rock(P, fx, fy, fz, hash2(wz, wx, seed + 31)); continue; }
      const hv2 = hash2(wz, wx, seed + 13);
      if (c.nord && c.biome === BIOME.BOREALE && hv2 < 0.16) birch(P, fx, fy, fz, hv2 * 6);
      else if (c.biome === BIOME.BOREALE || c.biome === BIOME.COLLINES) spruce(P, fx, fy, fz, hv2, c.h > SEA + 33);
      else if (c.biome === BIOME.ERABLIERE) hv2 < 0.82 ? maple(P, fx, fy, fz, hv2) : birch(P, fx, fy, fz, hv2);
      else hv2 < 0.5 ? birch(P, fx, fy, fz, hv2) : maple(P, fx, fy, fz, hv2);
    }
    // route 175 et ses panneaux (avant les lieux, qui peuvent la recouvrir)
    if (oz * VS < -100 && oz * VS > -2420) buildRoad(nord, P, data, idx, hf, FW, FM, CS, WH, ox, oz);
    if (oxm < -1000 && oxm > -1800) buildCity(reg, P, data, idx, hf, cf, FW, FM, CS, ox, oz, seed);
    // structures
    const seen = new Set();
    for (const [dx, dz] of [[0, 0], [CSM, 0], [0, CSM], [CSM, CSM], [CSM / 2, CSM / 2]]) for (const s of structsNear(oxm + dx, ozm + dz)) {
      if (seen.has(s)) continue; seen.add(s);
      const rad = (s.BR || s.R) + 4; if (s.x + rad < oxm || s.x - rad > oxm + CSM || s.z + rad < ozm || s.z - rad > ozm + CSM) continue;
      if (s.reg) regBuild(s, P, HELP); else if (s.nord && s.type !== 'village') nordBuild(s, P, HELP); else BUILD[s.type](P, s);
    }
    // végétation au sol (herbes, fleurs, bleuets) sur le dessus resté libre
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const k = (x + FM) + (z + FM) * FW, c = cf[k], h = hf[k];
      if (h + 1 >= WH || c.w > 0.3 || c.city) continue;
      const tb = data[idx(x, h, z)]; if ((tb !== B.GRASS && tb !== B.SNOWGRASS && tb !== B.MOSS) || data[idx(x, h + 1, z)] !== 0) continue;
      const wx = ox + x, wz = oz + z, r = hash2(wx, wz, seed + 77), r2 = hash2(wz, wx, seed + 78);
      const pf = N.n2(wx * 0.03 + 11, wz * 0.03) * 0.5 + 0.5;
      let sp = 0;
      if (c.biome === BIOME.CAMPAGNE || c.biome === BIOME.VILLE) { if (r < 0.02 * pf) sp = [B.FLOWR, B.FLOWY, B.FLOWV][r2 * 3 | 0]; else if (r < 0.12) sp = B.TUFT; }
      else if (c.biome === BIOME.ERABLIERE) { if (r < 0.008) sp = r2 < 0.5 ? B.FLOWY : B.FLOWR; else if (r < 0.08) sp = B.TUFT; }
      else if (c.biome === BIOME.BOREALE) { if (r < 0.014) sp = B.BERRY; else if (r < 0.07) sp = B.TUFT; }
      else if (c.biome === BIOME.COLLINES) { if (r < 0.03 && tb !== B.SNOWGRASS) sp = B.TUFT; }
      else if (c.biome === BIOME.RIVE) { if (r < 0.15) sp = B.TUFT; }
      if (sp) data[idx(x, h + 1, z)] = sp;
    }
    return data;
  }
  const HELP = { house, church, lampPost, nord };
  return { genChunk, column, heightAt, rawH, riverZ, riverW, structsNear, cell, allStructs, VX, VZ, VH, VR, layout, nord, reg };
}

// ---------- arbres (en voxels fins) ----------
function spruce(P, x, h, z, r, snowy) {
  const T = 14 + (r * 10 | 0), top = h + T + 2, y0 = h + 4, R0 = 4.2 + r * 1.6;
  P.ffill(x, h + 1, z, x, h + T, z, B.SLOG);
  for (let y = y0; y <= top; y++) {
    const t = (y - y0) / (top - y0), ph = (top - y) % 3, R = (R0 * Math.pow(1 - t, 0.95) + 0.7) * [1, 0.78, 0.58][2 - ph];
    const Ri = Math.ceil(R);
    for (let a = -Ri; a <= Ri; a++) for (let b = -Ri; b <= Ri; b++) {
      const d2 = a * a + b * b; if (d2 > R * R + 0.3 || (!a && !b && y <= h + T)) continue;
      const hv = hash2(x + a * 7 + y * 131, z + b * 13, 911);
      if (d2 > (R - 1) * (R - 1) && hv < 0.2) continue;
      P.fset(x + a, y, z + b, snowy && ph === 2 && hv > 0.15 ? B.SNOWLEAF : B.SPRUCE, true);
    }
  }
  P.fset(x, top + 1, z, snowy ? B.SNOWLEAF : B.SPRUCE, true);
}
function blob(P, cx, cy, cz, R, pick, sy = 1) {
  const Ri = Math.ceil(R);
  for (let a = -Ri; a <= Ri; a++) for (let b = -Ri; b <= Ri; b++) for (let c = -Ri; c <= Ri; c++) {
    const d = Math.hypot(a, b / sy, c); if (d > R) continue;
    const hv = hash2(cx + a * 7 + b * 131, cz + c * 13 + b, 777 + cy);
    if (d > R - 1.1 && hv < 0.28) continue;
    P.fset(cx + a, cy + b, cz + c, pick(hv, b), true);
  }
}
function maple(P, x, h, z, r) {
  const T = 7 + (r * 5 | 0), cy = h + T + 4;
  P.ffill(x, h + 1, z, x + 1, h + 3, z + 1, B.LOG); P.ffill(x, h + 1, z, x, h + T + 3, z, B.LOG);
  const mix = r * 3 | 0; // teinte dominante : rouge, orangé, jaune
  const pick = (hv) => { const k = (hv * 1000 % 1); return k < 0.12 ? B.MAPLE3 : mix === 0 ? (k < 0.7 ? B.MAPLE : B.MAPLE2) : mix === 1 ? (k < 0.6 ? B.MAPLE2 : B.MAPLE) : (k < 0.55 ? B.MAPLE3 : B.MAPLE2); };
  const n = 4 + (r * 3 | 0);
  blob(P, x, cy, z, 3.8 + r * 1.2, pick, 0.85);
  for (let k = 0; k < n; k++) {
    const a = k / n * 6.283 + r * 9, d = 2.6 + hash2(x + k, z, 5) * 2.2, bx = Math.round(x + Math.cos(a) * d), bz = Math.round(z + Math.sin(a) * d), by = cy - 1 + Math.round(hash2(z, x + k, 6) * 3);
    // branche
    for (let t = 0.3; t <= 0.85; t += 0.15) P.fset(Math.round(x + (bx - x) * t), Math.round(h + T + (by - h - T) * t), Math.round(z + (bz - z) * t), B.LOG, true);
    blob(P, bx, by, bz, 2.4 + hash2(bx, bz, 7) * 1.3, pick, 0.8);
  }
}
function birch(P, x, h, z, r) {
  const T = 10 + (r * 6 | 0), cy = h + T + 2;
  for (let y = h + 1; y <= h + T; y++) P.fset(x, y, z, hash2(x, z + y * 17, 41) < 0.2 ? B.BIRCHMARK : B.BIRCHLOG);
  const pick = (hv) => (hv * 977 % 1) < 0.15 ? B.MAPLE3 : B.BIRCH;
  blob(P, x, cy, z, 2.6 + r, pick, 1.5);
  blob(P, x + (r < 0.5 ? 2 : -2), cy - 2, z + 1, 2.0, pick, 1.2);
  blob(P, x - 1, cy + 3, z - (r < 0.5 ? 1 : -1), 1.8, pick, 1.3);
}
function rock(P, x, h, z, r) {
  const R = 1.2 + r * 1.8, Ri = Math.ceil(R);
  for (let a = -Ri; a <= Ri; a++) for (let b = -1; b <= Ri; b++) for (let c = -Ri; c <= Ri; c++) {
    const d = Math.hypot(a, b * 1.4, c); if (d > R) continue;
    P.fset(x + a, h + b, z + c, b >= R * 0.55 - 0.5 && hash2(x + a, z + c, 3) < 0.6 ? B.MOSS : B.STONE);
  }
}

// ---------- bâtiments (gabarit au mètre, finitions au voxel fin) ----------
// fenêtre vue de l'extérieur : appui, linteau, volets colorés en saillie d'un voxel fin
function windowF(P, x, y, z, side, shutter) {
  const fy = 2 * y;
  if (side === 'n' || side === 's') {
    const oz = side === 'n' ? 2 * z - 1 : 2 * z + 2, fx = 2 * x;
    P.ffill(fx - 1, fy - 1, oz, fx + 2, fy - 1, oz, B.TRIM); P.ffill(fx - 1, fy + 2, oz, fx + 2, fy + 2, oz, B.TRIM);
    if (shutter) { P.ffill(fx - 1, fy, oz, fx - 1, fy + 1, oz, shutter); P.ffill(fx + 2, fy, oz, fx + 2, fy + 1, oz, shutter); }
  } else {
    const ox = side === 'w' ? 2 * x - 1 : 2 * x + 2, fz = 2 * z;
    P.ffill(ox, fy - 1, fz - 1, ox, fy - 1, fz + 2, B.TRIM); P.ffill(ox, fy + 2, fz - 1, ox, fy + 2, fz + 2, B.TRIM);
    if (shutter) { P.ffill(ox, fy, fz - 1, ox, fy + 1, fz - 1, shutter); P.ffill(ox, fy, fz + 2, ox, fy + 1, fz + 2, shutter); }
  }
}
// lanterne murale fine : petit voxel lumineux sous un chapeau de fer
function lanternF(P, fx, fy, fz) { P.fset(fx, fy, fz, B.LAMP); P.fset(fx, fy + 1, fz, B.IRON); P.fset(fx, fy - 1, fz, B.IRON); }
function house(P, x0, z0, w, d, h, wall, roof, door, H = 4, chimney = false, ridgeX = null) {
  const x1 = x0 + w - 1, z1 = z0 + d - 1;
  const shut = [B.BLUE, B.REDROOF, B.COPPER, B.DPLANK, 0][((x0 * 7 + z0 * 13) % 5 + 5) % 5];
  P.fill(x0, h, z0, x1, h, z1, B.DPLANK);
  P.fill(x0, h + 1, z0, x1, h + H, z1, wall);
  if (wall === B.WHITE) for (let y = 2 * (h + 1) + 1; y <= 2 * (h + H) + 1; y += 2) P.ffill(2 * x0, y, 2 * z0, 2 * x1 + 1, y, 2 * z1 + 1, B.TRIM);
  P.fill(x0 + 1, h + 1, z0 + 1, x1 - 1, h + H + 8, z1 - 1, B.AIR);
  for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) P.fill(cx, h + 1, cz, cx, h + H, cz, B.DPLANK);
  // soubassement de pierre (un voxel fin)
  P.ffill(2 * x0, 2 * h + 2, 2 * z0, 2 * x1 + 1, 2 * h + 2, 2 * z1 + 1, B.COBBLE); P.fill(x0 + 1, h + 1, z0 + 1, x1 - 1, h + 1, z1 - 1, B.AIR);
  // fenêtres
  for (let x = x0 + 2; x < x1 - 0; x += 3) { P.set(x, h + 2, z0, B.GLASS); P.set(x, h + 2, z1, B.GLASS); windowF(P, x, h + 2, z0, 'n', shut); windowF(P, x, h + 2, z1, 's', shut); }
  for (let z = z0 + 2; z < z1 - 0; z += 3) { P.set(x0, h + 2, z, B.GLASS); P.set(x1, h + 2, z, B.GLASS); windowF(P, x0, h + 2, z, 'w', shut); windowF(P, x1, h + 2, z, 'e', shut); }
  // porte (2 de haut) avec cadre
  const mx = (x0 + x1) >> 1, mz = (z0 + z1) >> 1;
  const dp = { n: [mx, z0], s: [mx, z1], w: [x0, mz], e: [x1, mz] }[door];
  P.fill(dp[0], h + 1, dp[1], dp[0], h + 2, dp[1], B.AIR);
  const fy0 = 2 * h + 2, fy1 = 2 * h + 6;
  if (door === 'n' || door === 's') { const oz = door === 'n' ? 2 * dp[1] - 1 : 2 * dp[1] + 2, fx = 2 * dp[0];
    P.ffill(fx - 1, fy0, oz, fx - 1, fy1, oz, B.TRIM); P.ffill(fx + 2, fy0, oz, fx + 2, fy1, oz, B.TRIM); P.ffill(fx - 1, fy1, oz, fx + 2, fy1, oz, B.TRIM);
    lanternF(P, fx + 3, fy1 - 1, oz); P.ffill(fx - 1, 2 * h + 1, oz, fx + 2, 2 * h + 1, oz + (door === 'n' ? -1 : 1), B.COBBLE); }
  else { const ox = door === 'w' ? 2 * dp[0] - 1 : 2 * dp[0] + 2, fz = 2 * dp[1];
    P.ffill(ox, fy0, fz - 1, ox, fy1, fz - 1, B.TRIM); P.ffill(ox, fy0, fz + 2, ox, fy1, fz + 2, B.TRIM); P.ffill(ox, fy1, fz - 1, ox, fy1, fz + 2, B.TRIM);
    lanternF(P, ox, fy1 - 1, fz + 3); P.ffill(ox, 2 * h + 1, fz - 1, ox + (door === 'w' ? -1 : 1), 2 * h + 1, fz + 2, B.COBBLE); }
  // toit à deux versants au voxel fin, avant-toit retroussé (style québécois)
  const alongX = ridgeX ?? (w >= d);
  const U0 = alongX ? 2 * x0 - 1 : 2 * z0 - 1, U1 = alongX ? 2 * x1 + 2 : 2 * z1 + 2; // long du faîte
  const V0 = alongX ? 2 * z0 - 2 : 2 * x0 - 2, V1 = alongX ? 2 * z1 + 3 : 2 * x1 + 3;   // en travers
  const put = (u0, y, v0, u1, v1, b) => alongX ? P.ffill(u0, y, v0, u1, y, v1, b) : P.ffill(v0, y, u0, v1, y, u1, b);
  const yb = 2 * (h + H + 1), off = k => k < 2 ? k * 2 : k + 2;
  let kTop = 0;
  for (let k = 0; ; k++) {
    const a = V0 + off(k), b = V1 - off(k); if (a > b) { kTop = k - 1; break; }
    put(U0, yb + k, a, U1, b, roof);
    if (k === 0 && b - a >= 4) put(U0 + 1, yb, a + 2, U1 - 1, b - 2, B.AIR);
    // pignons (murs triangulaires)
    const ga = a + 2, gb = b - 2;
    if (ga <= gb) { if (alongX) { P.ffill(2 * x0, yb + k, ga, 2 * x0 + 1, yb + k, gb, wall); P.ffill(2 * x1, yb + k, ga, 2 * x1 + 1, yb + k, gb, wall); }
      else { P.ffill(ga, yb + k, 2 * z0, gb, yb + k, 2 * z0 + 1, wall); P.ffill(ga, yb + k, 2 * z1, gb, yb + k, 2 * z1 + 1, wall); } }
  }
  // faîtière
  { const mid = (V0 + V1) >> 1; put(U0, yb + kTop + 1, mid, U1, mid + ((V1 - V0) & 1), B.TRIM === roof ? B.WHITE : roof); }
  // lucarne de pignon
  if (H >= 4) { const gy = yb + 2, c = alongX ? (2 * z0 + 2 * z1 + 1) >> 1 : (2 * x0 + 2 * x1 + 1) >> 1;
    if (alongX) { P.ffill(2 * x0, gy, c, 2 * x0, gy + 1, c + 1, B.GLASS); P.ffill(2 * x1 + 1, gy, c, 2 * x1 + 1, gy + 1, c + 1, B.GLASS); }
    else { P.ffill(c, gy, 2 * z0, c + 1, gy + 1, 2 * z0, B.GLASS); P.ffill(c, gy, 2 * z1 + 1, c + 1, gy + 1, 2 * z1 + 1, B.GLASS); } }
  if (chimney) { const fx = 2 * (x1 - 1), fz = 2 * (z0 + 1), ytop = yb + kTop + 4;
    P.ffill(fx, 2 * (h + H), fz, fx + 1, ytop, fz + 1, B.BRICK); P.ffill(fx, ytop + 1, fz, fx + 1, ytop + 1, fz + 1, B.COBBLE); }
}
function church(P, cx, cz, h) {
  const w = 7, d = 12, x0 = cx - 3, z0 = cz - 6;
  house(P, x0, z0, w, d, h, B.WHITE, B.TIN, 's', 6, false, false);
  // clocher à l'avant (sud)
  const tz = z0 + d - 1;
  P.fill(cx - 1, h + 1, tz - 1, cx + 1, h + 12, tz + 1, B.WHITE);
  for (let y = 2 * (h + 1) + 1; y <= 2 * (h + 12) + 1; y += 2) P.ffill(2 * cx - 2, y, 2 * tz - 2, 2 * cx + 3, y, 2 * tz + 3, B.TRIM);
  P.fill(cx, h + 1, tz + 1, cx, h + 3, tz + 1, B.AIR);
  P.fill(cx, h + 9, tz - 1, cx, h + 10, tz + 1, B.AIR); P.fill(cx - 1, h + 9, tz, cx + 1, h + 10, tz, B.AIR);
  // horloge
  { const fz = 2 * tz + 4, fx = 2 * cx, fy = 2 * (h + 7); P.ffill(fx - 1, fy - 1, fz, fx + 2, fy + 2, fz, B.TRIM); P.ffill(fx, fy, fz, fx, fy + 1, fz, B.IRON); P.fset(fx + 1, fy, fz, B.IRON); }
  P.fill(cx - 2, h + 13, tz - 2, cx + 2, h + 13, tz + 2, B.TIN);
  P.fill(cx - 1, h + 14, tz - 1, cx + 1, h + 15, tz + 1, B.TIN);
  // flèche fine et effilée
  const fx = 2 * cx, fz = 2 * tz;
  for (let k = 0; k < 14; k++) { const r = k < 4 ? 1 : 0, y = 2 * (h + 16) + k; P.ffill(fx - r, y, fz - r, fx + 1 + r, y, fz + 1 + r, B.TIN); }
  P.ffill(fx, 2 * (h + 16) + 14, fz, fx, 2 * (h + 16) + 21, fz, B.GOLD); P.ffill(fx - 2, 2 * (h + 16) + 18, fz, fx + 2, 2 * (h + 16) + 18, fz, B.GOLD);
}
function lampPost(P, x, z, h) {
  const fx = 2 * x, fz = 2 * z, y0 = 2 * h + 2;
  P.ffill(fx, y0, fz, fx, y0 + 5, fz, B.IRON);
  P.fset(fx, y0 + 6, fz, B.LAMP); P.fset(fx, y0 + 7, fz, B.IRON);
}

export function layout(s) {
  // Métadonnées d'une structure : PNJ, points d'apparition, objets à ramasser, entrées.
  const r = mulberry(s.seed), m = { npcs: [], spawns: [], items: [], gates: [], houses: [] };
  if (s.reg) { regLayout(s, m, r); return m; }
  if (s.nord && s.type !== 'village') { nordLayout(s, m, r); return m; }
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
    const r2 = mulberry(s.seed + 7); for (let k = 0; k < 3; k++) { const a = r2() * 6.283, d = 3 + r2() * 4; m.npcs.push({ role: 'villageois', x: s.x + Math.cos(a) * d, z: s.z + Math.sin(a) * d }); }
  } else if (s.type === 'ville') {
    m.npcs.push({ role: 'gaston', x: s.x + 4.5, z: s.z + 8.5 }, { role: 'lapaperasse', x: s.x - 5.5, z: s.z - 7.5 }, { role: 'commercant', x: s.x + 12.5, z: s.z + 14.5 });
    for (let k = 0; k < 5; k++) m.npcs.push({ role: 'villageois', x: s.x + (r() - 0.5) * 50, z: s.z + 8 + r() * 20 });
    { const r2 = mulberry(s.seed + 7); for (let k = 0; k < 4; k++) m.npcs.push({ role: 'villageois', x: s.x + (r2() - 0.5) * 30, z: s.z + 4 + r2() * 14 }); }
    m.npcs.push({ role: 'garde', x: s.x + 3, z: s.z - s.R + 3 }, { role: 'garde', x: s.x - 3, z: s.z + s.R - 3 });
    m.npcs.push({ role: 'chauffeur', x: s.x + 6.5, z: s.z - 34 - 6.5, stop: 'ville' });
    m.gates.push({ x: s.x, z: s.z - 34 - 3 }, { x: s.x, z: s.z + 34 + 3 });
  } else if (s.type === 'cabane') {
    m.npcs.push({ role: s.i === 1 && s.j === 0 ? 'pepere' : 'acericulteur', x: s.x + 1.5, z: s.z + 5 }, { role: 'villageois', x: s.x - 2.5, z: s.z + 7 });
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
    // corniche en saillie sous le chemin de ronde (voxel fin, côté extérieur)
    P.ffill(2 * x0, 2 * WT, 2 * z0 - 1, 2 * x1 + 1, 2 * WT, 2 * z0 - 1, B.STONE); P.ffill(2 * x0, 2 * WT, 2 * z1 + 2, 2 * x1 + 1, 2 * WT, 2 * z1 + 2, B.STONE);
    P.ffill(2 * x0 - 1, 2 * WT, 2 * z0, 2 * x0 - 1, 2 * WT, 2 * z1 + 1, B.STONE); P.ffill(2 * x1 + 2, 2 * WT, 2 * z0, 2 * x1 + 2, 2 * WT, 2 * z1 + 1, B.STONE);
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
    for (let k = 0; k < 16; k++) { const y = 2 * (h + CH + 1) + k, a = 2 * (cz0 - 1) + k, b = 2 * (cz0 + cd) + 1 - k; if (a > b) break; P.ffill(2 * (cx0 - 1), y, a, 2 * (cx0 + cw) + 1, y, b, B.COPPER); }
    P.ffill(2 * cx0 - 1, 2 * (h + CH) + 1, 2 * cz0 - 1, 2 * (cx0 + cw) , 2 * (h + CH) + 1, 2 * (cz0 + cd), B.COBBLE, true);
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

// Nouvelles régions (v2) : Charlevoix (rive nord, à l'est), Gaspésie (rive sud du golfe, loin à l'est), Montréal satirique (à l'ouest).
// Relief, lieux (pseudo-structures), PNJ, constructions et ville en voxels. Tout est fictif sauf les noms de lieux.
import { B, SEA } from './blocks.js';
import { smooth, hash2 } from './noise.js';
import { REGIONS, panel } from './nord.js';
import { dunBuild, dunLayout, dunPlan } from './donjons.js';

Object.assign(REGIONS, {
  charlevoix: ['Charlevoix', 'Des montagnes qui plongent dans le fleuve'],
  baie: ['Baie-Saint-Paul', 'Peintres, fromages pis côtes à 15 %'],
  belvcharl: ['Belvédère de Charlevoix', 'La plus belle vue… quand y’a pas de brume'],
  gaspesie: ['Gaspésie', 'Le bout du monde, avec un phare'],
  perce: ['Percé', 'Village de pêcheurs · homards · goélands'],
  rocher: ['Rocher Percé', 'Un gros rocher avec un trou. Les touristes adorent.'],
  phare: ['Phare de Percé', 'Allumé depuis 1874. Ou depuis mardi.'],
  montreal: ['Montréal', 'Deux saisons : l’hiver pis la construction'],
  mtl: ['Place des Cônes', 'Montréal · centre-ville (en travaux)'],
  quai: ['Quai de la Vieille-Ville', 'Traversier pour la Gaspésie'],
  mine: ['Mine abandonnée', 'Charlevoix · fermée depuis 1952 · rouverte par les ratons'],
  egout: ['Égouts de Montréal', 'Accès interdit (sauf aventuriers pis ratons)'],
  montmagny: ['Montmagny', 'Capitale de l’oie blanche · accordéon · battures'],
  mm: ['Montmagny', 'Vieille-Ville · marina · Festival de l’Oie blanche'],
  battures: ['Battures de Montmagny', 'Des milliers d’oies. Pis une odeur… caractéristique.'],
  ile: ['Île aux Grues', 'Vue depuis le quai · Grosse-Île au loin'],
});
export const CH = { x0: 980, x1: 1620, bsp: 1290 }, GA = { x0: 2250, x1: 3060, perce: 2640 }, MT = { x0: -1720, x1: -1080, c: -1400 }, MM = { x0: 1680, x1: 2180, town: 1880 };
const LOT = 26, ST = 6; // Montréal : îlots de 26 m dont 6 m de rue

export function createRegions({ N, N2, N3, seed, riverZ, riverW, VX }) {
  const zsN = x => riverZ(x) - riverW(x), zsS = x => riverZ(x) + riverW(x);
  const wBox = (x, a, b, e) => smooth(a, a + e, x) * (1 - smooth(b - e, b, x));
  // relief de Charlevoix : falaise de rive puis grosses collines (vue sur le fleuve)
  const charH = (x, z, inland) => {
    const cliff = SEA + 2 + 20 * smooth(3, 40, inland);
    const r = N3.ridge(x * 0.0065 + 5, z * 0.0065 - 3, 3), hills = 24 * r * r + 6 * N.fbm(x * 0.012, z * 0.012, 3) + 12 * smooth(60, 260, inland);
    return Math.min(SEA + 56, cliff + hills * smooth(10, 90, inland));
  };
  // relief de la Gaspésie : falaises abruptes au bord du golfe, anse basse à Percé
  const gaspH = (x, z, inland) => {
    const top = SEA + 15 + 5 * N.fbm(x * 0.01, z * 0.01, 3) + 9 * smooth(40, 220, inland) + 6 * Math.pow(N3.ridge(x * 0.006, z * 0.006, 3), 3);
    const cove = 1 - smooth(26, 58, Math.abs(x - GA.perce)), beach = SEA + 1.6 + Math.max(0, inland - 8) * 0.12;
    const cl = inland < 0 ? SEA - 2 : SEA + 0.5 + (top - SEA - 0.5) * smooth(0, 3.5, inland);
    return cove > 0 ? cl + (Math.min(top, beach + inland * 0.04) - cl) * cove * smooth(-2, 2, inland) : cl;
  };
  const mtlIn = (x, z) => x > MT.x0 + 40 && x < MT.x1 - 40 && z < zsN(x) - 12 && z > zsN(x) - 300;
  // terrain : null hors région ; sinon hauteur, biome (nb), densité d'arbres, ville
  function terrain(x, z, h, north, d, W) {
    if (x > CH.x0 && x < CH.x1 && north > W - 4 && north < 520) {
      const w = wBox(x, CH.x0, CH.x1, 90) * (1 - smooth(420, 520, north)); if (w <= 0) return null;
      const inl = north - W, hc = charH(x, z, inl);
      return { h: h + (hc - h) * w, nb: w > 0.5 && inl > 14 ? (N2.n2(x * 0.005, z * 0.005) > -0.1 ? 3 : 2) : -1, dens: 1.25, reg: 'charlevoix' };
    }
    if (x > GA.x0 && x < GA.x1 && north < 0) {
      const w = wBox(x, GA.x0, GA.x1, 110) * (1 - smooth(380, 480, -north)); if (w <= 0) return null;
      const inl = -north - W, hg = gaspH(x, z, inl);
      return { h: inl < -3 ? h : h + (hg - h) * w, nb: w > 0.5 ? (inl < 12 && Math.abs(x - GA.perce) < 60 ? 0 : 2) : -1, dens: 0.9, reg: 'gaspesie' };
    }
    if (x > MT.x0 && x < MT.x1 && north > W - 4 && north < 360) {
      const w = wBox(x, MT.x0, MT.x1, 50) * (1 - smooth(300, 360, north)); if (w <= 0) return null;
      const inl = north - W, hm = SEA + 0.5 + 4.5 * smooth(0, 6, inl);
      return { h: h + (hm - h) * w, nb: w > 0.5 ? 1 : -1, dens: w > 0.3 ? 0 : 1, reg: 'montreal', city: w > 0.5 && mtlIn(x, z) };
    }
    // Montmagny : rive sud entre Québec et la Gaspésie — battures plates, petite ville, collines douces
    if (x > MM.x0 && x < MM.x1 && north < 0) {
      const w = wBox(x, MM.x0, MM.x1, 80) * (1 - smooth(280, 360, -north)); if (w <= 0) return null;
      const inl = -north - W;
      const flat = SEA + 1.2 + 1.8 * smooth(0, 10, inl) + 4 * smooth(20, 90, inl) + 3 * N.fbm(x * 0.01, z * 0.01, 2);
      const batt = inl < 14 && Math.abs(x - MM.town) < 90;
      return { h: inl < -2 ? h : h + (flat - h) * w, nb: w > 0.5 ? (batt || inl < 8 ? 0 : 2) : -1, dens: batt ? 0.15 : 0.85, reg: 'montmagny' };
    }
    return null;
  }
  // ---------- lieux ----------
  const structs = [], P = {};
  const add = o => { o.reg = true; o.i = 'R'; o.j = structs.length; o.seed = (hash2(o.j, 991, seed) * 1e9) | 0; o.R2 = o.R2 ?? o.R + 14; o.h = Math.round(o.h * 2) / 2; structs.push(o); P[o.key] = o; return o; };
  add({ type: 'baie', key: 'baie', name: 'Baie-Saint-Paul', x: CH.bsp, z: Math.round(zsN(CH.bsp) - 34), h: SEA + 4, R: 26, R2: 46, BR: 34, safe: true });
  { const x = CH.bsp - 120, z = Math.round(zsN(x) - 130); add({ type: 'belvc', key: 'belvcharl', name: 'Belvédère', x, z, h: Math.floor(charH(x, z, zsN(x) - z)) + 1, R: 6, R2: 16, BR: 12, safe: true }); }
  add({ type: 'perce', key: 'perce', name: 'Percé', x: GA.perce, z: Math.round(zsS(GA.perce) + 24), h: SEA + 3, R: 22, R2: 36, BR: 32, safe: true });
  add({ type: 'rocher', key: 'rocher', name: 'Rocher Percé', x: GA.perce + 8, z: Math.round(zsS(GA.perce + 8) - 46), h: SEA, R: -1, R2: 0, BR: 46 });
  { const x = GA.perce - 82, z = Math.round(zsS(x) + 9); add({ type: 'phare', key: 'phare', name: 'Phare', x, z, h: Math.floor(gaspH(x, z, z - zsS(x))), R: 5, R2: 9, BR: 8, safe: true }); }
  { const x = MT.c, z = Math.round(zsN(x) - 12 - 2 * LOT - LOT / 2); add({ type: 'mtl', key: 'mtl', name: 'Place des Cônes', x: Math.floor(x / LOT) * LOT + ST + 10, z: Math.floor(z / LOT) * LOT + ST + 10, h: SEA + 5, R: 9, R2: 14, BR: 14, safe: true }); }
  { const x = VX + 18, z = Math.round(zsN(x) - 4); add({ type: 'quai', key: 'quai', name: 'Quai', x, z, h: SEA + 2, R: 3, R2: 7, BR: 18, safe: true }); }
  // Montmagny : ville, battures (oies), île aux Grues au large
  add({ type: 'mm', key: 'mm', name: 'Montmagny', x: MM.town, z: Math.round(zsS(MM.town) + 28), h: SEA + 3, R: 24, R2: 40, BR: 30, safe: true });
  { const x = MM.town - 40, z = Math.round(zsS(x) + 6); add({ type: 'batt', key: 'battures', name: 'Battures', x, z, h: SEA + 1, R: 18, R2: 28, BR: 22, safe: true }); }
  { const x = MM.town + 30, z = Math.round(zsS(x) - 55); add({ type: 'ile', key: 'ile', name: 'Île aux Grues', x, z, h: SEA + 2, R: 8, R2: 14, BR: 16 }); }
  // donjons : la mine (Charlevoix, dans la montagne) et les égouts (Montréal, sous la Place des Cônes)
  { const x = CH.bsp + 60, z = Math.round(zsN(x) - 120), h = Math.floor(charH(x, z, zsN(x) - z)); let lo = h;
    for (let i = -6; i <= 40; i += 4) for (let j = -40; j <= 6; j += 4) lo = Math.min(lo, charH(x + i, z + j, zsN(x + i) - z - j));
    add({ type: 'donjon', kind: 'mine', key: 'mine', name: 'Mine', x, z, h, dx: 1, fy: Math.floor(Math.min(lo - 8, h - 10)), R: 3, R2: 9, BR: 50 }); }
  { const x = P.mtl.x - ST - 7, z = P.mtl.z; add({ type: 'donjon', kind: 'egout', key: 'egout', name: 'Égouts', x, z, h: SEA + 5, dx: -1, fy: SEA - 6, R: -1, R2: 0, BR: 50 }); }
  // arrêts : autocar (Orignal Express) et traversier
  const stops = [
    { key: 'charlevoix', label: 'BAIE-SAINT-PAUL', ax: P.baie.x - 14.5, az: P.baie.z + 8.5, car: [P.baie.x - 20, P.baie.z + 8, 0] },
    { key: 'montreal', label: 'MONTRÉAL', ax: P.mtl.x + 0.5, az: P.mtl.z + 13.5, car: [P.mtl.x + 3, P.mtl.z + 16, Math.PI / 2] },
    { key: 'montmagny', label: 'MONTMAGNY', ax: P.mm.x - 10.5, az: P.mm.z + 8.5, car: [P.mm.x - 16, P.mm.z + 6, 0] },
    { key: 'quai', label: 'QUAI DE LA VIEILLE-VILLE', ax: P.quai.x - 2.5, az: P.quai.z - 2.5, car: [P.quai.x - 8, P.quai.z - 6, 0], mode: 'ferry' },
    { key: 'mmferry', label: 'MONTMAGNY (MARINA)', ax: P.mm.x - 6.5, az: P.mm.z - 16.5, car: [P.mm.x - 12, P.mm.z - 4, 0], mode: 'ferry' },
    { key: 'perce', label: 'PERCÉ', ax: P.perce.x - 8.5, az: P.perce.z - 12.5, car: [P.perce.x - 14, P.perce.z - 4, 0], mode: 'ferry' },
  ];
  function region(x, z) {
    for (const s of structs) if (Math.hypot(x - s.x, z - s.z) < Math.max(s.R, 6) + 10) return s.key;
    const rz = riverZ(x), W = riverW(x), north = rz - z;
    if (x > CH.x0 + 40 && x < CH.x1 - 40 && north > W - 30 && north < 480) return 'charlevoix';
    if (x > MM.x0 + 40 && x < MM.x1 - 40 && north < -W + 40 && north > -340) return 'montmagny';
    if (x > GA.x0 + 40 && x < GA.x1 - 40 && north < -W + 40 && north > -460) return 'gaspesie';
    if (x > GA.x0 + 40 && x < GA.x1 - 40 && Math.abs(north) < W) return 'rocher';
    if (x > MT.x0 + 30 && x < MT.x1 - 30 && north > W - 30 && north < 330) return 'montreal';
    return null;
  }
  const labels = [
    { n: 'Charlevoix', x: CH.bsp - 60, z: zsN(CH.bsp) - 260, big: true }, { n: 'Baie-Saint-Paul', m: 1, x: P.baie.x, z: P.baie.z }, { n: 'Belvédère', m: 1, x: P.belvcharl.x, z: P.belvcharl.z },
    { n: 'Montmagny', x: MM.town, z: zsS(MM.town) + 160, big: true }, { n: 'Montmagny', m: 1, x: P.mm.x, z: P.mm.z }, { n: 'Battures', m: 1, x: P.battures.x, z: P.battures.z }, { n: 'Île aux Grues', m: 1, x: P.ile.x, z: P.ile.z },
    { n: 'Gaspésie', x: GA.perce, z: zsS(GA.perce) + 220, big: true }, { n: 'Percé', m: 1, x: P.perce.x, z: P.perce.z }, { n: 'Rocher Percé', m: 1, x: P.rocher.x, z: P.rocher.z }, { n: 'Phare', x: P.phare.x, z: P.phare.z },
    { n: 'Montréal', x: MT.c, z: zsN(MT.c) - 200, big: true }, { n: 'Place des Cônes', sh: 'Place', m: 1, x: P.mtl.x, z: P.mtl.z }, { n: 'Quai', m: 1, x: P.quai.x, z: P.quai.z },
  ];
  // niveau des ennemis par région
  const level = (x, z) => { const r = region(x, z); if (!r) return 0; if (x > CH.x0 - 60 && x < CH.x1 + 60) return 3 + (hash2(x | 0, z | 0, 5) < 0.3 ? 1 : 0); if (x > MM.x0 - 40 && x < MM.x1 + 40) return 4; if (x > GA.x0 - 60) return 5; if (x < MT.x1 + 60) return 4 + (hash2(x | 0, z | 0, 6) < 0.4 ? 1 : 0); return 0; };
  // un lot de Montréal : rue / ruelle / type d'îlot
  const lotType = (i, j) => { const h = hash2(i, j, seed + 4401); return h < 0.52 ? 'plex' : h < 0.7 ? 'chantier' : h < 0.85 ? 'parc' : 'stat'; };
  return { dunPlan, terrain, structs, places: P, stops, region, labels, level, zsN, zsS, mtlIn, lotType, LOT, ST };
}

// ---------- Montréal : rues, trottoirs, plex, chantiers, cônes et nids-de-poule (passe sur un tronçon) ----------
export function buildCity(R, P, data, idx, hf, cf, FW, FM, CS, ox, oz, seed) {
  const top = (x, z) => hf[(x + FM) + (z + FM) * FW];
  let any = false;
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const c = cf[(x + FM) + (z + FM) * FW]; if (!c.city) continue; any = true;
    const wx = (ox + x) * 0.5, wz = (oz + z) * 0.5, lx = ((wx % R.LOT) + R.LOT) % R.LOT, lz = ((wz % R.LOT) + R.LOT) % R.LOT, h = top(x, z);
    const street = lx < R.ST || lz < R.ST, side = !street && (lx < R.ST + 1.5 || lz < R.ST + 1.5 || lx >= R.LOT - 0.5 || lz >= R.LOT - 0.5);
    if (street) {
      const mid = (lx >= 2.75 && lx < 3.25 && lz >= R.ST) || (lz >= 2.75 && lz < 3.25 && lx >= R.ST);
      const dash = mid && (Math.floor((lx < R.ST ? wz : wx) * 0.5) & 1) === 0;
      data[idx(x, h, z)] = dash ? B.YELLOW : (lx < R.ST && lz < R.ST && (Math.floor(wx) + Math.floor(wz)) % 2 === 0 && lx > 1 && lz > 1 && lx < 5 && lz < 5) ? B.STRIPE : B.ROAD;
      // nids-de-poule (trous d'un mètre, avec de l'eau au fond) et cônes « partout »
      const hp = hash2(Math.floor(wx), Math.floor(wz), seed + 4402);
      if (hp < 0.012 && !mid) { data[idx(x, h, z)] = B.WATER; data[idx(x, h - 1, z)] = B.GRAVEL; }
      else if (hp > 0.975 && (Math.floor(wx * 2) & 1) === 0 && (Math.floor(wz * 2) & 1) === 0) { data[idx(x, h + 1, z)] = B.CONE; data[idx(x, h + 2, z)] = B.STRIPE; data[idx(x, h + 3, z)] = B.CONE; }
    } else if (side) { data[idx(x, h, z)] = B.COBBLE; const hc = hash2(Math.floor(wx), Math.floor(wz), seed + 4403); if (hc < 0.03 && (Math.floor(wx * 2) & 1) === 0 && (Math.floor(wz * 2) & 1) === 0) { data[idx(x, h + 1, z)] = B.CONE; data[idx(x, h + 2, z)] = B.STRIPE; data[idx(x, h + 3, z)] = B.CONE; } }
  }
  if (!any) return;
  // îlots touchant ce tronçon
  const m0x = ox * 0.5, m0z = oz * 0.5, m1x = m0x + CS * 0.5, m1z = m0z + CS * 0.5;
  for (let i = Math.floor(m0x / R.LOT) - 1; i <= Math.floor(m1x / R.LOT) + 1; i++) for (let j = Math.floor(m0z / R.LOT) - 1; j <= Math.floor(m1z / R.LOT) + 1; j++) {
    const bx = i * R.LOT + R.ST + 1.5, bz = j * R.LOT + R.ST + 1.5, W = R.LOT - R.ST - 2; // intérieur de l'îlot (m)
    if (!R.mtlIn(bx, bz) || !R.mtlIn(bx + W, bz + W)) continue;
    if (bx > m1x + 2 || bx + W < m0x - 2 || bz > m1z + 2 || bz + W < m0z - 2) continue;
    const pl = R.places.mtl; if (Math.abs(bx + W / 2 - pl.x) < 14 && Math.abs(bz + W / 2 - pl.z) < 14) { place(P, bx, bz, W, pl.h); continue; }
    const t = R.lotType(i, j), g = SEA + 5; // sol de la ville
    if (t === 'plex') plexRow(P, bx, bz, W, g, hash2(i, j, seed + 4404));
    else if (t === 'chantier') chantier(P, bx, bz, W, g, hash2(i, j, seed + 4405));
    else if (t === 'parc') parc(P, bx, bz, W, g, hash2(i, j, seed + 4406));
    else stationnement(P, bx, bz, W, g);
    // panneau DÉTOUR au coin de certains îlots
    if (hash2(i, j, seed + 4407) < 0.3) { const sx = Math.round((bx - 1) * 2), sz = Math.round((bz + W + 0.5) * 2), gy = g * 2 + 2; P.ffill(sx, gy - 1, sz, sx, gy + 5, sz, B.IRON); panel(P, ['DÉTOUR'], sx, gy + 13, sz + 1, 'x', B.CONE, B.IRON, true); }
  }
}
const F = v => Math.round(v * 2);
function plexRow(P, bx, bz, W, g, hv) {
  // 3 plex de 6 m, façade au sud (rue), escaliers extérieurs en colimaçon, balcons, corniche
  const walls = [B.BRICK, B.BROWN, B.SAND, B.BRICK, B.REDROOF, B.WHITE];
  for (let k = 0; k < 3; k++) {
    const x0 = Math.round(bx + k * 6), x1 = x0 + 5, z0 = Math.round(bz + 2), z1 = Math.round(bz + W - 5.5), H = 9, wall = walls[(((hv * 97) | 0) + k * 3) % walls.length];
    P.fill(x0, g + 1, z0, x1, g + H, z1, wall);
    P.fill(x0, g + H + 1, z0, x1, g + H + 1, z1, B.TIN);
    P.ffill(F(x0), F(g + H + 1), F(z1) + 1, F(x1) + 1, F(g + H + 1) + 1, F(z1) + 2, B.TRIM); // corniche
    for (let f = 0; f < 3; f++) { const y = g + 1 + f * 3; P.ffill(F(x0) + 2, F(y) + 2, F(z1) + 1, F(x0) + 4, F(y) + 4, F(z1) + 1, B.GLASS); P.ffill(F(x0) + 7, F(y) + 2, F(z1) + 1, F(x0) + 9, F(y) + 4, F(z1) + 1, B.GLASS); }
    P.ffill(F(x0) + 5, F(g + 1), F(z1) + 1, F(x0) + 6, F(g + 1) + 3, F(z1) + 1, B.DPLANK); // porte
    // balcons aux 2e et 3e
    for (const f of [1, 2]) { const y = F(g + 1 + f * 3) - 1; P.ffill(F(x0), y, F(z1) + 2, F(x1) + 1, y, F(z1) + 3, B.DPLANK); P.ffill(F(x0), y + 1, F(z1) + 4, F(x1) + 1, y + 2, F(z1) + 4, B.IRON); P.ffill(F(x0) + 1, y + 1, F(z1) + 4, F(x1), y + 1, F(z1) + 4, 0); }
    // escalier en colimaçon (fer) du trottoir au balcon du 3e
    const cx = F(x1) - 1, cz = F(z1) + 7, y0 = F(g) + 1, n = F(7);
    P.ffill(cx, y0, cz, cx, y0 + n + 2, cz, B.IRON);
    for (let s = 0; s < n; s++) { const a = s * 0.62, sx = cx + Math.round(Math.cos(a) * 2), sz = cz + Math.round(Math.sin(a) * 2); P.ffill(sx - (sx < cx ? 1 : 0), y0 + s, sz - (sz < cz ? 1 : 0), sx + (sx > cx ? 1 : 0), y0 + s, sz + (sz > cz ? 1 : 0), B.IRON); }
  }
}
function chantier(P, bx, bz, W, g, hv) {
  // clôture orange, trou, grue jaune, cônes
  const x0 = Math.round(bx), z0 = Math.round(bz), x1 = Math.round(bx + W), z1 = Math.round(bz + W);
  P.fill(x0 + 2, g - 3, z0 + 2, x1 - 2, g, z1 - 2, 0); P.fill(x0 + 2, g - 4, z0 + 2, x1 - 2, g - 4, z1 - 2, B.GRAVEL); P.ffill(F(x0 + 4), F(g - 4) + 1, F(z0 + 4), F(x0 + 8), F(g - 4) + 1, F(z0 + 7), B.WATER);
  for (let x = x0; x <= x1; x++) for (const z of [z0, z1]) { P.ffill(F(x), F(g + 1), F(z), F(x) + 1, F(g + 1) + 1, F(z), x % 2 ? B.STRIPE : B.CONE); }
  for (let z = z0; z <= z1; z++) for (const x of [x0, x1]) { P.ffill(F(x), F(g + 1), F(z), F(x), F(g + 1) + 1, F(z) + 1, z % 2 ? B.STRIPE : B.CONE); }
  const cx = x0 + 3, cz = z1 - 3, Hc = 26 + Math.round(hv * 6);
  P.fill(cx, g - 3, cz, cx, g + Hc, cz, B.YELLOW); for (let y = g; y < g + Hc; y += 2) P.ffill(F(cx), F(y), F(cz), F(cx) + 1, F(y), F(cz) + 1, B.IRON);
  P.fill(cx - 4, g + Hc + 1, cz, cx + 15, g + Hc + 1, cz, B.YELLOW); P.fill(cx - 4, g + Hc, cz, cx - 2, g + Hc, cz, B.COBBLE);
  P.ffill(F(cx + 12), F(g + 6), F(cz), F(cx + 12), F(g + Hc), F(cz), B.IRON); P.fill(cx + 12, g + 5, cz, cx + 12, g + 5, cz, B.CONE);
  P.fill(cx - 1, g + Hc - 2, cz - 1, cx + 1, g + Hc, cz + 1, B.BLUE); // cabine
  for (let k = 0; k < 6; k++) { const x = x0 + 4 + ((hv * 1000 + k * 37) % (W - 7) | 0), z = z0 + 1; P.ffill(F(x), F(g + 1) - 1, F(z), F(x), F(g + 1), F(z), B.CONE); }
}
function parc(P, bx, bz, W, g, hv) {
  const x0 = Math.round(bx), z0 = Math.round(bz), x1 = Math.round(bx + W), z1 = Math.round(bz + W), mx = (x0 + x1) >> 1, mz = (z0 + z1) >> 1;
  P.fill(mx - 1, g, z0, mx, g, z1, B.PATH); P.fill(x0, g, mz - 1, x1, g, mz, B.PATH);
  for (const [tx, tz] of [[x0 + 4, z0 + 4], [x1 - 4, z1 - 4], [x0 + 4, z1 - 5]]) { P.fill(tx, g + 1, tz, tx, g + 4, tz, B.LOG); P.fill(tx - 2, g + 4, tz - 2, tx + 2, g + 6, tz + 2, hv < 0.5 ? B.MAPLE : B.MAPLE2); P.fill(tx - 1, g + 7, tz - 1, tx + 1, g + 7, tz + 1, hv < 0.5 ? B.MAPLE : B.MAPLE2); }
  P.fill(mx + 3, g + 1, mz + 3, mx + 5, g + 1, mz + 3, B.PLANK); // banc
  P.fill(mx - 3, g + 1, mz - 4, mx - 3, g + 1, mz - 4, B.CONE); // même dans le parc
}
function stationnement(P, bx, bz, W, g) {
  const x0 = Math.round(bx), z0 = Math.round(bz), x1 = Math.round(bx + W), z1 = Math.round(bz + W);
  P.fill(x0, g, z0, x1, g, z1, B.ROAD);
  for (let x = x0 + 1; x < x1; x += 3) P.ffill(F(x), F(g) + 1, F(z0 + 1), F(x), F(g) + 1, F(z0 + 6), B.STRIPE);
  P.ffill(F(x0), F(g) + 1, F(z1), F(x0), F(g) + 3, F(z1), B.IRON); panel(P, ['P 2 H', '20 $'], F(x0), F(g) + 12, F(z1) - 1, 'x', B.BLUE, B.TRIM, true);
}
function place(P, bx, bz, W, g) {
  // Place des Cônes : pavé, un cône géant « monument », fontaine
  const x0 = Math.round(bx) - 2, z0 = Math.round(bz) - 2, x1 = Math.round(bx + W) + 2, z1 = Math.round(bz + W) + 2, mx = (x0 + x1) >> 1, mz = (z0 + z1) >> 1;
  P.fill(x0, g, z0, x1, g, z1, B.COBBLE); P.fill(x0 + 2, g + 1, z0 + 2, x1 - 2, g + 12, z1 - 2, 0);
  for (let k = 0; k < 9; k++) { const r = Math.max(0, 4 - Math.floor(k / 2)); P.fill(mx - r, g + 1 + k, mz - r, mx + r, g + 1 + k, mz + r, k % 3 === 2 ? B.STRIPE : B.CONE); }
  P.fill(mx - 5, g + 1, mz - 5, mx + 5, g + 1, mz - 5, B.COBBLE); P.fill(mx - 5, g + 1, mz + 5, mx + 5, g + 1, mz + 5, B.COBBLE);
  panel(P, ['PLACE DES CÔNES', 'TRAVAUX 1976-2099'], F(mx), F(g + 1) + 26, F(mz + 6) + 1, 'x', B.SIGN, B.TRIM, true);
}

// ---------- PNJ et objets des lieux ----------
export function regLayout(s, m, r) {
  if (s.type === 'baie') {
    m.npcs.push({ role: 'peintre', x: s.x + 3.5, z: s.z + 2.5 }, { role: 'chauffeur', x: s.x - 12.5, z: s.z + 10.5, stop: 'charlevoix' }, { role: 'aubergiste', x: s.x - 3.5, z: s.z - 2.5 }, { role: 'commercant', x: s.x + 9.5, z: s.z - 6.5, shop: 'charlevoix' });
    for (let k = 0; k < 5; k++) m.npcs.push({ role: 'villageois', x: s.x + (r() - 0.5) * 30, z: s.z + (r() - 0.5) * 24 });
  } else if (s.type === 'belvc') {
    m.npcs.push({ role: 'villageois', x: s.x + 1.5, z: s.z + 2.5 });
    for (let k = 0; k < 4; k++) { const a = k * 1.7 + 0.4, d = 12 + k * 5; m.items.push({ kind: 'pinceau', x: s.x + Math.cos(a) * d + 0.5, z: s.z + Math.sin(a) * d + 0.5 }); }
  } else if (s.type === 'perce') {
    m.npcs.push({ role: 'capitaine', x: s.x - 6.5, z: s.z - 14.5, stop: 'perce' }, { role: 'gardienne', x: s.x + 6.5, z: s.z + 2.5 }, { role: 'commercant', x: s.x + 4.5, z: s.z - 4.5, shop: 'perce' }, { role: 'aubergiste', x: s.x - 2.5, z: s.z + 4.5 });
    for (let k = 0; k < 4; k++) m.npcs.push({ role: 'villageois', x: s.x + (r() - 0.5) * 26, z: s.z + (r() - 0.5) * 14 });
    for (let k = 0; k < 5; k++) m.items.push({ kind: 'casier', x: s.x - 40 + k * 20 + 0.5, z: s.z - 18 + (k % 2) * 3 + 0.5 });
  } else if (s.type === 'phare') m.npcs.push({ role: 'villageois', x: s.x + 2.5, z: s.z + 2.5 });
  else if (s.type === 'mtl') {
    m.npcs.push({ role: 'contremaitre', x: s.x - 6.5, z: s.z + 7.5 }, { role: 'cycliste', x: s.x + 7.5, z: s.z + 7.5 }, { role: 'chauffeur', x: s.x - 2.5, z: s.z + 14.5, stop: 'montreal' }, { role: 'commercant', x: s.x + 7.5, z: s.z - 7.5, shop: 'montreal' });
    for (let k = 0; k < 6; k++) m.npcs.push({ role: 'villageois', x: s.x + (r() - 0.5) * 22, z: s.z + (r() - 0.5) * 22 });
  } else if (s.type === 'mm') {
    m.npcs.push(
      { role: 'accordeoniste', x: s.x + 2.5, z: s.z + 3.5 },
      { role: 'oiseleur', x: s.x - 8.5, z: s.z - 10.5 },
      { role: 'commercant', x: s.x + 8.5, z: s.z - 4.5, shop: 'montmagny' },
      { role: 'chauffeur', x: s.x - 12.5, z: s.z + 9.5, stop: 'montmagny' },
      { role: 'matelot', x: s.x - 5.5, z: s.z - 15.5, stop: 'mmferry' },
      { role: 'aubergiste', x: s.x - 2.5, z: s.z + 6.5 });
    for (let k = 0; k < 5; k++) m.npcs.push({ role: 'villageois', x: s.x + (r() - 0.5) * 28, z: s.z + (r() - 0.5) * 20 });
  } else if (s.type === 'batt') {
    m.npcs.push({ role: 'oiseleur', x: s.x + 2.5, z: s.z + 4.5 });
    for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.2, d = 8 + k * 3; m.items.push({ kind: 'plume', x: s.x + Math.cos(a) * d + 0.5, z: s.z + Math.sin(a) * d + 0.5 }); }
    m.items.push({ kind: 'accordeon', x: s.x - 14.5, z: s.z + 11.5 });
  } else if (s.type === 'ile') {
    m.npcs.push({ role: 'villageois', x: s.x + 1.5, z: s.z + 1.5 });
  } else if (s.type === 'donjon') { dunLayout(s, m); if (s.kind === 'mine') m.npcs.push({ role: 'villageois', x: s.x - 4.5, z: s.z + 4.5 }); }
  else if (s.type === 'quai') m.npcs.push({ role: 'matelot', x: s.x + 1.5, z: s.z - 1.5, stop: 'quai' });
}
export function regBuild(s, P, H) {
  const h = s.h;
  if (s.type === 'baie') {
    // village de peintres : maisons colorées, église, galeries avec chevalets
    P.fill(s.x - 16, h, s.z - 3, s.x + 16, h, s.z + 3, B.COBBLE); P.fill(s.x - 2, h, s.z - 18, s.x + 2, h, s.z + 16, B.COBBLE);
    const cols = [B.BLUE, B.REDROOF, B.YELLOW, B.WHITE, B.COPPER, B.BRICK];
    [[-16, -14], [-6, -15], [6, -14], [14, -14], [-16, 6], [8, 6], [16, 6]].forEach(([dx, dz], k) => H.house(P, s.x + dx - 3, s.z + dz, 6, 6, h, cols[k % 6] === B.YELLOW ? B.WHITE : cols[k % 6], k % 2 ? B.TIN : B.REDROOF, dz < 0 ? 's' : 'n', 3, k % 3 === 0));
    H.church(P, s.x - 4, s.z + 14, h);
    for (const dx of [-8, 0, 10]) { const fx = F(s.x + dx), fz = F(s.z + 4), y = F(h) + 1; P.ffill(fx, y, fz, fx, y + 3, fz, B.PLANK); P.ffill(fx - 1, y + 3, fz, fx + 2, y + 5, fz, [B.BLUE, B.FLOWR, B.YELLOW][(dx + 8) % 3] || B.BLUE); }
    H.lampPost(P, s.x - 13, s.z + 9, h); busSign(P, s.x - 14, s.z + 10, h, 'BAIE-SAINT-PAUL');
    panel(P, ['BAIE-SAINT-PAUL'], F(s.x), F(h + 6) + 2, F(s.z - 19), 'x', B.SIGN, B.TRIM, true);
  } else if (s.type === 'belvc') {
    P.fill(s.x - 4, h, s.z - 4, s.x + 4, h, s.z + 4, B.PLANK); P.fill(s.x - 4, h + 1, s.z - 4, s.x + 4, h + 1, s.z - 4, B.LOG); P.fill(s.x - 4, h + 1, s.z + 4, s.x + 4, h + 1, s.z + 4, B.LOG);
    P.fill(s.x - 4, h + 1, s.z - 4, s.x - 4, h + 1, s.z + 4, B.LOG); P.fill(s.x + 4, h + 1, s.z - 3, s.x + 4, h + 1, s.z + 4, B.LOG);
    P.fill(s.x - 4, h + 1, s.z - 3, s.x + 4, h + 9, s.z + 3, 0); P.fill(s.x + 2, h + 1, s.z, s.x + 2, h + 2, s.z, B.IRON); P.fill(s.x + 2, h + 3, s.z, s.x + 2, h + 3, s.z, B.BLUE); // longue-vue
    panel(P, ['BELVÉDÈRE'], F(s.x - 4), F(h + 4) + 4, F(s.z), 'z', B.BROWN, B.TRIM, true);
  } else if (s.type === 'perce') {
    // village de pêcheurs : maisons de bardeaux, quai, casiers, bateaux
    const cols = [B.REDROOF, B.WHITE, B.BLUE, B.YELLOW, B.COPPER];
    [[-20, 4], [-10, 6], [0, 8], [10, 6], [20, 4]].forEach(([dx, dz], k) => H.house(P, s.x + dx - 3, s.z + dz, 6, 5, s.h, cols[k] === B.YELLOW ? B.PLANK : cols[k], k % 2 ? B.SHINGLE : B.REDROOF, 'n', 3, k === 2));
    const qz0 = s.z - 12, qz1 = s.z - 34; P.fill(s.x - 9, SEA + 1, qz1, s.x - 6, SEA + 1, qz0, B.PLANK); for (let z = qz1; z <= qz0; z += 4) { P.fill(s.x - 9, SEA - 3, z, s.x - 9, SEA, z, B.LOG); P.fill(s.x - 6, SEA - 3, z, s.x - 6, SEA, z, B.LOG); }
    // bateau de pêche rouge et bleu au bout du quai
    const bx = s.x - 3, bz = qz1 + 4; P.fill(bx, SEA, bz - 4, bx + 2, SEA, bz + 4, B.REDROOF); P.fill(bx, SEA + 1, bz - 5, bx + 2, SEA + 1, bz + 5, B.BLUE); P.fill(bx + 1, SEA + 1, bz - 4, bx + 1, SEA + 1, bz + 4, 0); P.fill(bx, SEA + 2, bz + 1, bx + 2, SEA + 3, bz + 3, B.WHITE);
    for (let k = 0; k < 4; k++) P.fill(s.x + 4 + k * 2, s.h + 1, s.z - 6, s.x + 4 + k * 2, s.h + 1, s.z - 6, B.DPLANK); // casiers empilés
    busSign(P, s.x - 9, s.z - 13, s.h, 'TRAVERSIER');
    panel(P, ['PERCÉ'], F(s.x), F(s.h + 5) + 2, F(s.z + 15), 'x', B.SIGN, B.TRIM, true);
  } else if (s.type === 'rocher') {
    // Rocher Percé : longue muraille de roc dans l'eau, avec une arche au bout est
    const L = 34, Wd = 6, Ht = 30;
    for (let x = -L; x <= L; x++) { const t = Math.abs(x) / L, hh = Math.round(Ht * (1 - Math.pow(t, 6)) * (0.9 + 0.1 * Math.sin(x * 0.7))), w = Math.max(2, Math.round(Wd * (1 - t * 0.5)));
      P.fill(s.x + x, SEA - 6, s.z - w, s.x + x, SEA + hh, s.z + w, x % 5 === 0 ? B.BRICK : B.STONE); }
    P.fill(s.x + 18, SEA - 2, s.z - 8, s.x + 25, SEA + 12, s.z + 8, 0); P.fill(s.x + 19, SEA + 13, s.z - 8, s.x + 24, SEA + 14, s.z + 8, 0); // l'arche
    for (let x = -L; x <= L; x += 3) P.fill(s.x + x, SEA + Math.round(Ht * (1 - Math.pow(Math.abs(x) / L, 6))) + 1, s.z - 1, s.x + x, SEA + Math.round(Ht * (1 - Math.pow(Math.abs(x) / L, 6))) + 1, s.z + 1, B.SNOW); // fientes de fous de Bassan
  } else if (s.type === 'phare') {
    for (let y = 0; y < 14; y++) P.fill(s.x - 1, h + 1 + y, s.z - 1, s.x + 1, h + 1 + y, s.z + 1, y % 4 < 2 ? B.WHITE : B.REDROOF);
    P.fill(s.x - 1, h + 15, s.z - 1, s.x + 1, h + 16, s.z + 1, B.LAMP); P.fill(s.x - 2, h + 17, s.z - 2, s.x + 2, h + 17, s.z + 2, B.REDROOF); P.fill(s.x - 1, h + 18, s.z - 1, s.x + 1, h + 18, s.z + 1, B.REDROOF);
    H.house(P, s.x + 3, s.z - 2, 5, 4, h, B.WHITE, B.REDROOF, 'e', 3);
  } else if (s.type === 'mm') {
    // Montmagny : vieille-ville, église, salle de l'accordéon, marina
    P.fill(s.x - 18, h, s.z - 4, s.x + 18, h, s.z + 4, B.COBBLE); P.fill(s.x - 3, h, s.z - 20, s.x + 3, h, s.z + 14, B.COBBLE);
    const cols = [B.WHITE, B.BRICK, B.YELLOW, B.BLUE, B.COPPER, B.REDROOF];
    [[-16, -12], [-6, -14], [6, -12], [14, -10], [-16, 6], [8, 8], [16, 4]].forEach(([dx, dz], k) => H.house(P, s.x + dx - 3, s.z + dz, 6, 5, h, cols[k % 6] === B.YELLOW ? B.PLANK : cols[k % 6], k % 2 ? B.TIN : B.SHINGLE, dz < 0 ? 's' : 'n', 3));
    H.church(P, s.x - 3, s.z + 12, h);
    P.fill(s.x + 6, h + 1, s.z - 2, s.x + 14, h + 5, s.z + 4, B.PLANK); P.fill(s.x + 7, h + 1, s.z - 1, s.x + 13, h + 4, s.z + 3, 0); P.fill(s.x + 6, h + 6, s.z - 2, s.x + 14, h + 6, s.z + 4, B.REDROOF);
    panel(P, ['ACCORDÉON'], F(s.x + 10), F(h + 5) + 4, F(s.z + 5), 'x', B.SIGN, B.TRIM, true);
    const qz0 = s.z - 12, qz1 = s.z - 30; P.fill(s.x - 8, SEA + 1, qz1, s.x - 4, SEA + 1, qz0, B.PLANK);
    for (let z = qz1; z <= qz0; z += 4) { P.fill(s.x - 8, SEA - 3, z, s.x - 8, SEA, z, B.LOG); P.fill(s.x - 4, SEA - 3, z, s.x - 4, SEA, z, B.LOG); }
    P.fill(s.x - 8, SEA + 2, qz1, s.x - 4, SEA + 10, qz0, 0);
    const fx = s.x - 1, fz = qz1 + 5; P.fill(fx, SEA - 1, fz - 5, fx + 4, SEA + 1, fz + 5, B.WHITE); P.fill(fx, SEA + 1, fz - 5, fx + 4, SEA + 1, fz + 5, B.BLUE);
    H.lampPost(P, s.x - 11, s.z + 8, h); busSign(P, s.x - 12, s.z + 9, h, 'MONTMAGNY'); busSign(P, s.x - 8, s.z - 14, h, 'TRAVERSIER');
    panel(P, ['MONTMAGNY', 'CAPITALE DE L\'OIE BLANCHE'], F(s.x), F(h + 6) + 2, F(s.z + 18), 'x', B.SIGN, B.TRIM, true);
  } else if (s.type === 'batt') {
    P.fill(s.x - 20, h, s.z - 14, s.x + 20, h, s.z + 14, B.SAND);
    for (let k = 0; k < 7; k++) { const ax = s.x - 16 + k * 5, az = s.z - 8 + (k % 3) * 6; P.fill(ax, h, az, ax + 2, h, az + 2, B.WATER); }
    for (let k = 0; k < 28; k++) {
      const a = k * 2.3 + 0.4, d = 4 + (k % 7) * 2.2, gx = Math.round(s.x + Math.cos(a) * d), gz = Math.round(s.z + Math.sin(a) * d);
      P.set(gx, h + 1, gz, B.WHITE); P.set(gx, h + 2, gz, B.WHITE); if (k % 3 === 0) P.set(gx, h + 3, gz, B.STONE);
    }
    panel(P, ['BATTURES', 'OIES BLANCHES'], F(s.x), F(h + 2) + 8, F(s.z + 16), 'x', B.SIGN, B.TRIM, true);
  } else if (s.type === 'ile') {
    for (let dx = -7; dx <= 7; dx++) for (let dz = -5; dz <= 5; dz++) {
      const rr = Math.hypot(dx / 7, dz / 5); if (rr > 1) continue;
      const hh = Math.round((1 - rr * rr) * 5);
      P.fill(s.x + dx, SEA - 2, s.z + dz, s.x + dx, SEA + hh, s.z + dz, rr > 0.7 ? B.SAND : B.STONE);
    }
    H.house(P, s.x - 2, s.z - 1, 5, 4, SEA + 4, B.WHITE, B.REDROOF, 's', 3);
    panel(P, ['ÎLE AUX GRUES'], F(s.x), F(SEA + 8) + 4, F(s.z + 6), 'x', B.SIGN, B.TRIM, true);
  } else if (s.type === 'donjon') { dunBuild(s, P); dunEntrance(s, P, h); }
  else if (s.type === 'quai') {
    P.fill(s.x - 3, SEA + 1, s.z - 2, s.x + 3, SEA + 1, s.z + 16, B.PLANK); for (let z = s.z; z <= s.z + 16; z += 4) { P.fill(s.x - 3, SEA - 3, z, s.x - 3, SEA, z, B.LOG); P.fill(s.x + 3, SEA - 3, z, s.x + 3, SEA, z, B.LOG); }
    P.fill(s.x - 3, SEA + 2, s.z - 2, s.x + 3, SEA + 12, s.z + 16, 0);
    // traversier blanc et bleu amarré
    const fz = s.z + 10, fx = s.x + 6; P.fill(fx, SEA - 1, fz - 7, fx + 5, SEA + 1, fz + 7, B.WHITE); P.fill(fx, SEA + 1, fz - 7, fx + 5, SEA + 1, fz + 7, B.BLUE); P.fill(fx + 1, SEA + 2, fz - 3, fx + 4, SEA + 4, fz + 3, B.WHITE); P.fill(fx + 2, SEA + 5, fz - 1, fx + 3, SEA + 6, fz + 1, B.REDROOF);
    busSign(P, s.x - 3, s.z - 3, SEA + 1, 'TRAVERSIER');
  }
}
function dunEntrance(s, P, h) {
  if (s.kind === 'mine') { // chevalement de bois sur le flanc de la montagne
    P.fill(s.x - 2, h, s.z - 2, s.x + 2, h, s.z + 2, B.PLANK); P.fill(s.x - 1, h, s.z - 1, s.x + 1, h, s.z + 1, B.COAL);
    for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) P.fill(s.x + a, h + 1, s.z + b, s.x + a, h + 4, s.z + b, B.LOG);
    P.fill(s.x - 2, h + 5, s.z - 2, s.x + 2, h + 5, s.z + 2, B.DPLANK); P.fill(s.x - 2, h + 1, s.z - 2, s.x + 2, h + 4, s.z + 2, 0, false);
    for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) P.fill(s.x + a, h + 1, s.z + b, s.x + a, h + 4, s.z + b, B.LOG);
    P.fill(s.x, h + 6, s.z, s.x, h + 7, s.z, B.LOG);
    panel(P, ['MINE'], F(s.x), F(h + 5) + 3, F(s.z + 3), 'x', B.SIGN, B.TRIM, true);
  } else { // trou d'homme dans la rue, entouré de cônes
    P.fill(s.x - 1, h, s.z - 1, s.x, h, s.z, B.IRON); for (const [a, b] of [[-2, -2], [1, -2], [-2, 1], [1, 1]]) P.set(s.x + a, h + 1, s.z + b, B.CONE);
    panel(P, ['ÉGOUTS'], F(s.x), F(h) + 8, F(s.z - 3), 'x', B.SIGN, B.TRIM, true); P.ffill(F(s.x), F(h) + 2, F(s.z - 3), F(s.x), F(h) + 7, F(s.z - 3), B.IRON);
  }
}
function busSign(P, x, z, h, txt) { const fx = F(x), fz = F(z), y = F(h) + 2; P.ffill(fx, y, fz, fx, y + 6, fz, B.IRON); panel(P, [txt], fx, y + 14, fz - 1, 'x', B.BLUE, B.TRIM, true); }

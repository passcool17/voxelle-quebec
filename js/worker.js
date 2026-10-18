// Web Worker : génère les tronçons (voxels fins) et calcule leurs maillages hors du fil principal.
// Niveau de détail : lod 0 = voxels fins + végétation, lod 1 = voxels de 2×2×2 (tronçons lointains, bords fermés).
import { createGen } from './worldgen.js';
import { meshChunk, topInfo } from './mesher.js';
import { CS, WH, B, OPAQUE, SPRITE, CSM } from './blocks.js';
let gen = null, edits = {};
const cache = new Map(); // clé -> Uint8Array
const key = (cx, cz) => cx + ',' + cz;
const CS2 = CS * CS;
function chunk(cx, cz) {
  const k = key(cx, cz); let d = cache.get(k);
  if (d) { cache.delete(k); cache.set(k, d); return d; }
  d = gen.genChunk(cx, cz);
  const e = edits[k]; if (e) for (let i = 0; i < e.length; i += 2) d[e[i]] = e[i + 1];
  cache.set(k, d);
  if (cache.size > 320) { const first = cache.keys().next().value; cache.delete(first); }
  return d;
}
// tableau rembourré (1 voxel autour) pour le maillage fin
function padFine(cx, cz) {
  const P = CS + 2, PP = P * P, pad = new Uint8Array(PP * WH), self = chunk(cx, cz);
  const nb = {};
  const src = (dx, dz) => (dx || dz) ? (nb[dx + ',' + dz] || (nb[dx + ',' + dz] = chunk(cx + dx, cz + dz))) : self;
  for (let z = -1; z <= CS; z++) for (let x = -1; x <= CS; x++) {
    const dx = x < 0 ? -1 : x >= CS ? 1 : 0, dz = z < 0 ? -1 : z >= CS ? 1 : 0, d = src(dx, dz), lx = x - dx * CS, lz = z - dz * CS;
    const si = lx + lz * CS, di = (x + 1) + (z + 1) * P;
    for (let y = 0; y < WH; y++) pad[di + y * PP] = d[si + y * CS2];
  }
  return pad;
}
// réduction 2×2×2 : on garde le bloc le plus haut de la cellule s'il y a assez de matière ; bords = air (jupes)
function padCoarse(cx, cz) {
  const S = CS >> 1, H = WH >> 1, P = S + 2, PP = P * P, pad = new Uint8Array(PP * H), d = chunk(cx, cz);
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) for (let y = 0; y < H; y++) {
    let n = 0, w = 0, top = 0;
    for (let k = 7; k >= 0; k--) { const b = d[(2 * x + (k & 1)) + (2 * z + (k >> 1 & 1)) * CS + (2 * y + (k >> 2)) * CS2]; if (!b || SPRITE[b]) continue; if (b === B.WATER) { w++; continue; } n++; if (!top) top = b; }
    pad[(x + 1) + (z + 1) * P + y * PP] = n >= 3 ? top : w + n >= 3 ? B.WATER : 0;
  }
  return pad;
}
function meshMsg(t, cx, cz, withData, lod) {
  const m = lod ? meshChunk(padCoarse(cx, cz), CS >> 1, WH >> 1, 2, cx * (CS >> 1), cz * (CS >> 1), false)
                : meshChunk(padFine(cx, cz), CS, WH, 1, cx * CS, cz * CS, true);
  const d = chunk(cx, cz), ti = topInfo((x, y, z) => d[x + z * CS + y * CS2], CS, WH, 2);
  const msg = { t, cx, cz, lod, m, top: ti.top, hm: ti.hm }, tr = [];
  for (const k of ['op', 'wa', 'gl']) tr.push(m[k].pos.buffer, m[k].nor.buffer, m[k].col.buffer, m[k].tex.buffer, m[k].idx.buffer);
  tr.push(ti.top.buffer, ti.hm.buffer);
  if (withData) { msg.data = d.slice(); tr.push(msg.data.buffer); }
  postMessage(msg, tr);
}
onmessage = e => {
  const q = e.data;
  if (q.t === 'init') { gen = createGen(q.seed); edits = q.edits || {}; cache.clear(); postMessage({ t: 'ready' }); }
  else if (q.t === 'chunk') meshMsg('chunk', q.cx, q.cz, !q.noData, q.lod || 0);
  else if (q.t === 'remesh') meshMsg('mesh', q.cx, q.cz, false, q.lod || 0);
  else if (q.t === 'set') {
    const cx = Math.floor(q.x / CS), cz = Math.floor(q.z / CS), lx = q.x - cx * CS, lz = q.z - cz * CS, k = key(cx, cz);
    const d = chunk(cx, cz), i = lx + lz * CS + q.y * CS2; d[i] = q.b;
    (edits[k] || (edits[k] = [])).push(i, q.b);
    const todo = [[cx, cz]];
    if (lx === 0) todo.push([cx - 1, cz]); if (lx === CS - 1) todo.push([cx + 1, cz]);
    if (lz === 0) todo.push([cx, cz - 1]); if (lz === CS - 1) todo.push([cx, cz + 1]);
    for (const [a, b] of todo) { const kk = key(a, b); if (kk in q.loaded) meshMsg('mesh', a, b, false, q.loaded[kk]); }
  }
};

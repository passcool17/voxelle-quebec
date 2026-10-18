// Web Worker : génère les tronçons et calcule leurs maillages hors du fil principal.
import { createGen } from './worldgen.js';
import { meshChunk, topInfo } from './mesher.js';
import { CS, WH } from './blocks.js';
let gen = null, edits = {};
const cache = new Map(); // clé -> Uint8Array
const key = (cx, cz) => cx + ',' + cz;
function chunk(cx, cz) {
  const k = key(cx, cz); let d = cache.get(k);
  if (d) { cache.delete(k); cache.set(k, d); return d; }
  d = gen.genChunk(cx, cz);
  const e = edits[k]; if (e) for (let i = 0; i < e.length; i += 2) d[e[i]] = e[i + 1];
  cache.set(k, d);
  if (cache.size > 900) { const first = cache.keys().next().value; cache.delete(first); }
  return d;
}
function getter(cx, cz) {
  const nb = {};
  const self = chunk(cx, cz);
  return (x, y, z) => {
    if (y < 0) return 1; if (y >= WH) return 0;
    if (x >= 0 && x < CS && z >= 0 && z < CS) return self[x + z * CS + y * CS * CS];
    const dx = x < 0 ? -1 : x >= CS ? 1 : 0, dz = z < 0 ? -1 : z >= CS ? 1 : 0, k = dx + ',' + dz;
    const d = nb[k] || (nb[k] = chunk(cx + dx, cz + dz));
    return d[(x - dx * CS) + (z - dz * CS) * CS + y * CS * CS];
  };
}
function meshMsg(t, cx, cz, withData) {
  const g = getter(cx, cz), m = meshChunk(g), ti = topInfo(g);
  const msg = { t, cx, cz, m, top: ti.top, hm: ti.hm }, tr = [];
  for (const k of ['op', 'wa', 'gl']) tr.push(m[k].pos.buffer, m[k].nor.buffer, m[k].col.buffer, m[k].idx.buffer);
  tr.push(ti.top.buffer, ti.hm.buffer);
  if (withData) { msg.data = chunk(cx, cz).slice(); tr.push(msg.data.buffer); }
  postMessage(msg, tr);
}
onmessage = e => {
  const q = e.data;
  if (q.t === 'init') { gen = createGen(q.seed); edits = q.edits || {}; cache.clear(); postMessage({ t: 'ready' }); }
  else if (q.t === 'chunk') meshMsg('chunk', q.cx, q.cz, true);
  else if (q.t === 'set') {
    const cx = Math.floor(q.x / CS), cz = Math.floor(q.z / CS), lx = q.x - cx * CS, lz = q.z - cz * CS, k = key(cx, cz);
    const d = chunk(cx, cz), i = lx + lz * CS + q.y * CS * CS; d[i] = q.b;
    (edits[k] || (edits[k] = [])).push(i, q.b);
    const todo = [[cx, cz]];
    if (lx === 0) todo.push([cx - 1, cz]); if (lx === CS - 1) todo.push([cx + 1, cz]);
    if (lz === 0) todo.push([cx, cz - 1]); if (lz === CS - 1) todo.push([cx, cz + 1]);
    for (const [a, b] of todo) if (q.loaded.includes(key(a, b))) meshMsg('mesh', a, b, false);
  }
};

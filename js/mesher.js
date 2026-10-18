// Maillage par élimination des faces cachées + occlusion ambiante par sommet + couleurs par sommet.
import { CS, WH, B, COL, OPAQUE, GLOW } from './blocks.js';
import { hash2 } from './noise.js';
// faces : normale, axes u/v, 4 coins (ordre CCW vu de l'extérieur)
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], s: 0.8, k: 1 },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], s: 0.8, k: 1 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0, k: 0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.55, k: 2 },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], s: 0.9, k: 1 },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], s: 0.9, k: 1 },
];
const AO = [0.5, 0.68, 0.84, 1];
class Buf { constructor() { this.p = []; this.n = []; this.c = []; this.i = []; this.v = 0; }
  out() { const nv = this.v; return { pos: new Float32Array(this.p), nor: new Int8Array(this.n), col: new Uint8Array(this.c), idx: nv > 65535 ? new Uint32Array(this.i) : new Uint16Array(this.i) }; } }
// get(x,y,z) en coordonnées locales, peut déborder d'un bloc sur les voisins
export function meshChunk(get) {
  const op = new Buf(), wa = new Buf(), gl = new Buf();
  const sol = (x, y, z) => OPAQUE[get(x, y, z)];
  for (let y = 1; y < WH; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const b = get(x, y, z); if (!b) continue;
    const water = b === B.WATER;
    for (let f = 0; f < 6; f++) {
      const F = FACES[f], nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2];
      const nb = ny >= WH ? 0 : ny < 0 ? 1 : get(nx, ny, nz);
      if (water) { if (nb !== 0) continue; } else if (OPAQUE[nb]) continue;
      const buf = water ? wa : GLOW[b] ? gl : op;
      let col = COL[b][F.k];
      const hv = hash2(x * 7 + y * 131, z * 11 + y, b) * 0.12 - 0.06 + (b === B.GRASS && F.k === 0 ? (hash2(x >> 2, z >> 2, 5) - 0.5) * 0.08 : 0);
      let r = (col >> 16 & 255), g = (col >> 8 & 255), bl = col & 255;
      // gazon/neige : bande colorée en haut des côtés
      const a = [0, 0, 0, 0];
      for (let k = 0; k < 4; k++) {
        const C = F.c[k];
        if (water) { a[k] = 1; continue; }
        // occlusion ambiante
        const ox = x + F.n[0], oy = y + F.n[1], oz = z + F.n[2];
        let d = [0, 0, 0]; for (let q = 0; q < 3; q++) if (F.n[q] === 0) d[q] = C[q] ? 1 : -1;
        let s1, s2, cc;
        if (F.n[0]) { s1 = sol(ox, oy + d[1], oz); s2 = sol(ox, oy, oz + d[2]); cc = sol(ox, oy + d[1], oz + d[2]); }
        else if (F.n[1]) { s1 = sol(ox + d[0], oy, oz); s2 = sol(ox, oy, oz + d[2]); cc = sol(ox + d[0], oy, oz + d[2]); }
        else { s1 = sol(ox + d[0], oy, oz); s2 = sol(ox, oy + d[1], oz); cc = sol(ox + d[0], oy + d[1], oz); }
        a[k] = AO[s1 && s2 ? 0 : 3 - s1 - s2 - cc];
      }
      const v0 = buf.v;
      for (let k = 0; k < 4; k++) {
        const C = F.c[k];
        let py = y + C[1]; if (water && C[1] === 1 && get(x, y + 1, z) !== B.WATER) py -= 0.12;
        buf.p.push(x + C[0], py, z + C[2]); buf.n.push(F.n[0] * 127, F.n[1] * 127, F.n[2] * 127);
        let m = F.s * a[k] * (1 + hv);
        let rr = r, gg = g, bb = bl;
        if ((b === B.GRASS || b === B.SNOWGRASS) && F.k === 1 && C[1] === 1) { const t = COL[b][0]; rr = (rr + (t >> 16 & 255)) >> 1; gg = (gg + (t >> 8 & 255)) >> 1; bb = (bb + (t & 255)) >> 1; }
        if (b === B.CONE && F.k === 1 && (y & 1)) { rr = 245; gg = 245; bb = 245; }
        buf.c.push(Math.min(255, rr * m) | 0, Math.min(255, gg * m) | 0, Math.min(255, bb * m) | 0);
      }
      // diagonale selon l'AO (évite les artefacts)
      if (a[0] + a[2] > a[1] + a[3]) buf.i.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
      else buf.i.push(v0 + 1, v0 + 2, v0 + 3, v0 + 1, v0 + 3, v0);
      buf.v += 4;
    }
  }
  return { op: op.out(), wa: wa.out(), gl: gl.out() };
}
// Couleur et hauteur du dessus de chaque colonne (mini-carte)
export function topInfo(get) {
  const top = new Uint8Array(CS * CS * 3), hm = new Uint8Array(CS * CS);
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    let y = WH - 1; while (y > 0 && !get(x, y, z)) y--;
    const b = get(x, y, z), c = b === B.WATER ? 0x3a78c0 : COL[b][0], i = x + z * CS;
    const m = b === B.WATER ? 1 : 0.75 + (y - 30) * 0.008;
    top[i * 3] = Math.min(255, (c >> 16 & 255) * m); top[i * 3 + 1] = Math.min(255, (c >> 8 & 255) * m); top[i * 3 + 2] = Math.min(255, (c & 255) * m); hm[i] = y;
  }
  return { top, hm };
}

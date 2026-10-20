// Maillage « glouton » (fusion des faces coplanaires identiques) avec occlusion ambiante par sommet,
// couleurs par sommet, grain de texture (attribut tex), eau à part (profondeur + écume), végétation en petits modèles.
// Attribut kd (saisons) : bits 0-2 classe (blocks.js SEASON), bit 3 dessus à ciel ouvert (neige), bits 4-7 ombrage AO×face /15.
// Entrée : tableau « rembourré » d'un voxel sur les 4 côtés : (S+2) × (S+2) × H, index = (x+1) + (z+1)*P + y*P*P.
import { B, COL, OPAQUE, GLOW, SPRITE, TEX, SEASON } from './blocks.js';
import { hash2, hash3 } from './noise.js';
const AO = [0.42, 0.62, 0.82, 1];
const SHADE = [0.86, 0.86, 1.0, 0.62, 0.93, 0.93]; // +x -x +y -y +z -z
class Buf {
  constructor() { this.p = []; this.n = []; this.c = []; this.t = []; this.k = []; this.i = []; this.v = 0; }
  out() { return { pos: new Float32Array(this.p), nor: new Int8Array(this.n), col: new Uint8Array(this.c), tex: new Uint8Array(this.t), kd: new Uint8Array(this.k), idx: this.v > 65535 ? new Uint32Array(this.i) : new Uint16Array(this.i) }; }
}
// boîte (végétation) : coordonnées en voxels, sans dessous
function addBox(buf, x0, y0, z0, x1, y1, z1, col, tex, sc, kd = 0) {
  const r = col >> 16 & 255, g = col >> 8 & 255, b = col & 255;
  const F = [
    [[1, 0, 0], [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], 0.86],
    [[-1, 0, 0], [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], 0.86],
    [[0, 1, 0], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], 1],
    [[0, 0, 1], [[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]], 0.93],
    [[0, 0, -1], [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], 0.93],
  ];
  for (const [n, cs, s] of F) {
    const v0 = buf.v;
    for (let k = 0; k < 4; k++) { const c = cs[k], m = s * (c[1] === y0 ? 0.7 : 1);
      buf.p.push(c[0] * sc, c[1] * sc, c[2] * sc); buf.n.push(n[0] * 127, n[1] * 127, n[2] * 127); buf.c.push(Math.min(255, r * m) | 0, Math.min(255, g * m) | 0, Math.min(255, b * m) | 0); buf.t.push(tex); buf.k.push(kd ? kd | (n[1] > 0 ? 8 : 0) | Math.round(Math.min(1, m) * 15) << 4 : 0); }
    buf.i.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3); buf.v += 4;
  }
}
function sprite(buf, b, x, y, z, wx, wz) {
  const h = (k) => hash3(wx, y, wz, k);
  if (b === B.TUFT) {
    const base = 0x5f9a3a, n = 2 + (h(1) * 2 | 0);
    for (let k = 0; k < n; k++) { const bx = x + 0.15 + h(10 + k) * 0.6, bz = z + 0.15 + h(20 + k) * 0.6, hh = 0.45 + h(30 + k) * 0.6, w = 0.11;
      const c = h(40 + k) < 0.3 ? 0x7fb54a : h(40 + k) < 0.6 ? base : 0x4f8a34; addBox(buf, bx, y, bz, bx + w, y + hh, bz + w, c, 40, 1, 6); }
  } else if (b === B.BERRY) {
    addBox(buf, x + 0.1, y, z + 0.1, x + 0.9, y + 0.45, z + 0.9, 0x34602c, 120, 1, 6);
    for (let k = 0; k < 3; k++) { const bx = x + 0.15 + h(5 + k) * 0.55, bz = z + 0.15 + h(9 + k) * 0.55; addBox(buf, bx, y + 0.45, bz, bx + 0.14, y + 0.58, bz + 0.14, COL[B.BERRY][0], 30, 1); }
  } else {
    const bx = x + 0.3 + h(3) * 0.3, bz = z + 0.3 + h(4) * 0.3, hh = 0.5 + h(5) * 0.35;
    addBox(buf, bx + 0.05, y, bz + 0.05, bx + 0.13, y + hh, bz + 0.13, 0x3f7a2a, 20, 1, 6);
    addBox(buf, bx - 0.06, y + hh, bz - 0.06, bx + 0.24, y + hh + 0.22, bz + 0.24, COL[b][0], 40, 1, 6);
    addBox(buf, bx + 0.04, y + hh + 0.22, bz + 0.04, bx + 0.14, y + hh + 0.28, bz + 0.14, 0xf2e070, 10, 1);
  }
}
// S : taille du tronçon (voxels du niveau), H : hauteur, sc : échelle des sommets (1 ou 2 pour le niveau de détail),
// ox, oz : origine monde en voxels du niveau (pour les hachages)
export function meshChunk(pad, S, H, sc, ox, oz, sprites) {
  const P = S + 2, PP = P * P;
  const op = new Buf(), wa = new Buf(), gl = new Buf();
  const at = (x, y, z) => y < 0 ? B.BEDROCK : y >= H ? 0 : pad[(x + 1) + (z + 1) * P + y * PP];
  const opq = (x, y, z) => OPAQUE[at(x, y, z)];
  // étendue verticale utile
  let ymin = H, ymax = 0;
  for (let y = 0; y < H; y++) { let any = false; for (let z = 0; z < S && !any; z++) for (let x = 0; x < S; x++) { const b = pad[(x + 1) + (z + 1) * P + y * PP]; if (b && b !== B.BEDROCK) { any = true; break; } } if (any) { if (y < ymin) ymin = y; ymax = y; } }
  if (ymin > ymax) return { op: op.out(), wa: wa.out(), gl: gl.out() };
  ymin = Math.max(0, ymin - 1);
  // dessus de chaque colonne (plus haut voxel opaque ou eau : le fond sous la glace reste sans neige) : seules ces faces reçoivent la neige d'hiver
  const ctop = new Int16Array(S * S); for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) { let y = ymax; while (y > 0 && !OPAQUE[pad[(x + 1) + (z + 1) * P + y * PP]] && pad[(x + 1) + (z + 1) * P + y * PP] !== B.WATER) y--; ctop[x + z * S] = y; }
  const mask = new Int32Array(Math.max(S, H) * Math.max(S, H));
  // axes : a (normale), u, v ; signe du produit u×v par rapport à +a
  const AX = [[0, 2, 1, -1], [1, 0, 2, -1], [2, 0, 1, 1]];
  const pos = [0, 0, 0], q = [0, 0, 0];
  for (let f = 0; f < 6; f++) {
    const [a, u, v, uxv] = AX[f >> 1], s = f & 1 ? -1 : 1, fid = a * 2 + (s < 0 ? 1 : 0);
    const dimA = a === 1 ? H : S, dimU = u === 1 ? H : S, dimV = v === 1 ? H : S;
    const aLo = a === 1 ? ymin : 0, aHi = a === 1 ? ymax : dimA - 1;
    const uLo = u === 1 ? ymin : 0, uHi = u === 1 ? ymax : dimU - 1, vLo = v === 1 ? ymin : 0, vHi = v === 1 ? ymax : dimV - 1;
    const kTop = a === 1 ? (s > 0 ? 0 : 2) : 1;
    const n = [0, 0, 0]; n[a] = s;
    const du = [0, 0, 0], dv = [0, 0, 0]; du[u] = 1; dv[v] = 1;
    for (let i = aLo; i <= aHi; i++) {
      let any = false;
      for (let jv = vLo; jv <= vHi; jv++) for (let ju = uLo; ju <= uHi; ju++) {
        pos[a] = i; pos[u] = ju; pos[v] = jv;
        const x = pos[0], y = pos[1], z = pos[2], b = at(x, y, z); let key = 0;
        if (b && !SPRITE[b] && !(y === 0 && s < 0)) {
          const nx = x + n[0], ny = y + n[1], nz = z + n[2], nb = at(nx, ny, nz);
          if (b === B.WATER) {
            if (nb === 0 || SPRITE[nb]) {
              let foam = 0, dep = 0;
              if (a === 1 && s > 0) {
                for (let k = 0; k < 4; k++) { const su = k === 1 || k === 2 ? 1 : -1, sv = k >= 2 ? 1 : -1;
                  const s1 = opq(x + du[0] * su, y, z + du[2] * su), s2 = opq(x + dv[0] * sv, y, z + dv[2] * sv), c = opq(x + du[0] * su + dv[0] * sv, y, z + du[2] * su + dv[2] * sv);
                  if (s1 || s2 || c) foam |= 1 << k; }
                let d = 1; while (d < 8 && at(x, y - d, z) === B.WATER) d++; dep = d < 2 ? 0 : d < 4 ? 1 : d < 7 ? 2 : 3;
              }
              key = ((B.WATER * 8 + dep) << 8 | foam) + 1;
            }
          } else if (!OPAQUE[nb]) {
            let variant = 0;
            if ((b === B.GRASS || b === B.SNOWGRASS) && kTop === 1 && !opq(x, y + 1, z)) variant = 1;
            else if (b === B.CONE && kTop === 1 && (y & 1)) variant = 2;
            if (kTop === 0 && x >= 0 && z >= 0 && x < S && z < S && y >= ctop[x + z * S]) variant |= 4;
            let ao = 0;
            for (let k = 0; k < 4; k++) { const su = k === 1 || k === 2 ? 1 : -1, sv = k >= 2 ? 1 : -1;
              const s1 = opq(nx + du[0] * su, ny + du[1] * su, nz + du[2] * su), s2 = opq(nx + dv[0] * sv, ny + dv[1] * sv, nz + dv[2] * sv), c = opq(nx + du[0] * su + dv[0] * sv, ny + du[1] * su + dv[1] * sv, nz + du[2] * su + dv[2] * sv);
              ao |= (s1 && s2 ? 0 : 3 - s1 - s2 - c) << (k * 2); }
            key = ((b * 8 + variant) << 8 | ao) + 1;
          }
        }
        mask[ju + jv * dimU] = key; if (key) any = true;
      }
      if (!any) continue;
      const plane = i + (s > 0 ? 1 : 0);
      for (let jv = vLo; jv <= vHi; jv++) for (let ju = uLo; ju <= uHi;) {
        const key = mask[ju + jv * dimU]; if (!key) { ju++; continue; }
        let w = 1; while (ju + w <= uHi && mask[ju + w + jv * dimU] === key) w++;
        let h = 1; outer: while (jv + h <= vHi) { for (let k = 0; k < w; k++) if (mask[ju + k + (jv + h) * dimU] !== key) break outer; h++; }
        for (let hh = 0; hh < h; hh++) for (let k = 0; k < w; k++) mask[ju + k + (jv + hh) * dimU] = 0;
        // émission du quad
        const kk = key - 1, lo = kk & 255, mv = kk >> 8, b = mv >> 3, variant = mv & 3, open = mv & 4, water = b === B.WATER;
        const buf = water ? wa : GLOW[b] ? gl : op;
        let col;
        if (water) col = [0x2a7f9a, 0x22688f, 0x1c5684, 0x174878][variant];
        else { col = COL[b][kTop]; if (variant === 1) { const t = COL[b][0]; col = ((t >> 16 & 255) * 0.88 << 16) | ((t >> 8 & 255) * 0.88 << 8) | ((t & 255) * 0.88); } else if (variant === 2) col = 0xf2f2f2; }
        const r = col >> 16 & 255, g = col >> 8 & 255, bl = col & 255, sh = water ? 1 : SHADE[fid];
        const tex = water ? 0 : TEX[b], kc = water ? 0 : SEASON[b] | (open ? 8 : 0);
        const cu = [ju, ju + w, ju + w, ju], cv = [jv, jv, jv + h, jv + h], av = [0, 0, 0, 0];
        const v0 = buf.v;
        for (let k = 0; k < 4; k++) {
          q[a] = plane; q[u] = cu[k]; q[v] = cv[k];
          let py = q[1]; if (water && a === 1 && s > 0) py -= 0.22;
          buf.p.push(q[0] * sc, py * sc, q[2] * sc); buf.n.push(n[0] * 127, n[1] * 127, n[2] * 127);
          if (water) { av[k] = 1; buf.c.push(r, g, bl); buf.t.push(lo >> k & 1 ? 255 : 0); buf.k.push(0); }
          else { const ao = AO[lo >> (k * 2) & 3]; av[k] = ao; const m = sh * ao; buf.c.push(Math.min(255, r * m) | 0, Math.min(255, g * m) | 0, Math.min(255, bl * m) | 0); buf.t.push(tex); buf.k.push(kc | Math.round(Math.min(1, m) * 15) << 4); }
        }
        const fwd = s * uxv > 0;
        const o = fwd ? [0, 1, 2, 3] : [0, 3, 2, 1];
        if (av[o[0]] + av[o[2]] >= av[o[1]] + av[o[3]]) buf.i.push(v0 + o[0], v0 + o[1], v0 + o[2], v0 + o[0], v0 + o[2], v0 + o[3]);
        else buf.i.push(v0 + o[1], v0 + o[2], v0 + o[3], v0 + o[1], v0 + o[3], v0 + o[0]);
        buf.v += 4;
        ju += w;
      }
    }
  }
  if (sprites) for (let y = ymin; y <= ymax; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) { const b = pad[(x + 1) + (z + 1) * P + y * PP]; if (SPRITE[b]) sprite(op, b, x, y, z, ox + x, oz + z); }
  return { op: op.out(), wa: wa.out(), gl: gl.out() };
}
// Couleur et hauteur du dessus de chaque colonne d'un mètre (mini-carte), échantillonnée dans les données fines
export function topInfo(get, S, H, step) {
  const M = S / step, top = new Uint8Array(M * M * 3), hm = new Uint8Array(M * M);
  for (let z = 0; z < M; z++) for (let x = 0; x < M; x++) {
    let y = H - 1; while (y > 0 && (!get(x * step, y, z * step) || SPRITE[get(x * step, y, z * step)])) y--;
    const b = get(x * step, y, z * step), c = b === B.WATER ? 0x3a78c0 : COL[b][0], i = x + z * M, ym = y / step;
    const m = b === B.WATER ? 1 : 0.75 + (ym - 30) * 0.008;
    top[i * 3] = Math.min(255, (c >> 16 & 255) * m); top[i * 3 + 1] = Math.min(255, (c >> 8 & 255) * m); top[i * 3 + 2] = Math.min(255, (c & 255) * m); hm[i] = ym;
  }
  return { top, hm };
}

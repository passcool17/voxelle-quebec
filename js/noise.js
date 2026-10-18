// Bruit simplex 2D avec graine (implémentation maison, domaine public) + utilitaires de hachage.
export function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function hash2(x, z, s) { let h = (x | 0) * 374761393 + (z | 0) * 668265263 + (s | 0) * 2147483647; h = (h ^ (h >>> 13)) * 1274126177; h ^= h >>> 16; return (h >>> 0) / 4294967296; }
export function hash3(x, y, z, s) { return hash2(x * 31 + y * 7919, z ^ (y * 104729), s); }
const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
const GR = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
export function makeNoise(seed) {
  const r = mulberry(seed), p = new Uint8Array(512), perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  function n2(x, y) {
    const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t); const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255; let n = 0, tt;
    tt = 0.5 - x0 * x0 - y0 * y0; if (tt > 0) { const g = GR[p[ii + p[jj]] & 7]; tt *= tt; n += tt * tt * (g[0] * x0 + g[1] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1; if (tt > 0) { const g = GR[p[ii + i1 + p[jj + j1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x1 + g[1] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2; if (tt > 0) { const g = GR[p[ii + 1 + p[jj + 1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x2 + g[1] * y2); }
    return 70 * n; // ~[-1,1]
  }
  function fbm(x, y, oct = 4, lac = 2, gain = 0.5) { let a = 1, f = 1, s = 0, t = 0; for (let o = 0; o < oct; o++) { s += a * n2(x * f, y * f); t += a; a *= gain; f *= lac; } return s / t; }
  function ridge(x, y, oct = 4) { let a = 1, f = 1, s = 0, t = 0; for (let o = 0; o < oct; o++) { s += a * (1 - Math.abs(n2(x * f, y * f))); t += a; a *= 0.5; f *= 2; } return s / t; }
  return { n2, fbm, ridge };
}
export const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

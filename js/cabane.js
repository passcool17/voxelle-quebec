// Ta cabane (v4) : meubles (modèles en boîtes), décor d'hiver du village (bonhomme de neige fictif, traînes sauvages,
// fanions), et petites fonctions pures (terrain, coffre) testables sans le jeu.
import * as THREE from 'three';
import { box, bake } from './models.js';
export const FURN = ['lit', 'coffre_m', 'poele', 'table', 'chaise', 'cadre', 'tapis'];
// action proposée près du meuble (touche E / B / bouton tactile)
export const FURN_ACT = { lit: ['Dormir jusqu’au matin', 'DORS'], coffre_m: ['Ouvrir le coffre', 'OUVRE'], poele: ['Se réchauffer au poêle', 'CHAUFFE'], table: ['Regarder la table', 'VOIR'], chaise: ['Se bercer', 'BERCE'], cadre: ['Admirer tes trophées', 'VOIR'], tapis: ['Regarder le tapis', 'VOIR'] };
export const inHome = (h, x, z) => !!h && x >= h.x0 && x <= h.x1 + 1 && z >= h.z0 && z <= h.z1 + 1;
export const inCabin = (h, x, z) => !!h && x >= h.ix0 && x <= h.ix1 + 1 && z >= h.iz0 && z <= h.iz1 + 1;
// coffre : déplacer une pile (ou un objet d'équipement) d'une liste à l'autre ; renvoie false si plein
export const CHEST_MAX = 24;
export function moveStack(from, to, i, max = 1e9) {
  const it = from[i]; if (!it) return false;
  const same = !it.r && to.find(o => o.id === it.id && !o.r);
  if (!same && to.length >= max) return false;
  from.splice(i, 1); if (same) same.n = (same.n || 1) + (it.n || 1); else to.push(it); return true;
}
// meubles : modèle centré au sol, avant = +z
export function furnModel(id, trophies = []) {
  const g = new THREE.Group(), W = 0xb98b52, D = 0x6e4b2e;
  if (id === 'lit') {
    box(g, 1.1, 0.3, 2.0, D, 0, 0.25, 0); box(g, 1.1, 0.75, 0.1, D, 0, 0.45, -1.0); box(g, 1.1, 0.45, 0.08, D, 0, 0.35, 1.0);
    for (const [x, z] of [[-0.5, -0.95], [0.5, -0.95], [-0.5, 0.95], [0.5, 0.95]]) box(g, 0.1, 0.25, 0.1, D, x, 0.12, z);
    box(g, 1.0, 0.14, 1.9, 0xf2eee4, 0, 0.46, 0); box(g, 0.7, 0.12, 0.34, 0xffffff, 0, 0.58, -0.72);
    const q = [0xc8282e, 0x2e5fa8, 0xf2c12e, 0x2c7a3a, 0xe8e0d0, 0x8a3a6a]; // courtepointe en carrés
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) box(g, 0.34, 0.06, 0.32, q[(i + j * 2) % q.length], -0.34 + i * 0.34, 0.55, -0.3 + j * 0.32);
  } else if (id === 'coffre_m') {
    box(g, 0.9, 0.5, 0.56, 0x8a5a32, 0, 0.25, 0); box(g, 0.94, 0.16, 0.6, 0x9b6a3e, 0, 0.56, 0);
    for (const x of [-0.3, 0.3]) box(g, 0.08, 0.68, 0.62, 0x3a3a3e, x, 0.33, 0); box(g, 0.12, 0.12, 0.04, 0xe8c040, 0, 0.45, 0.3, true);
  } else if (id === 'poele') {
    box(g, 0.8, 0.55, 0.6, 0x26282c, 0, 0.45, 0); box(g, 0.86, 0.06, 0.66, 0x3a3c40, 0, 0.75, 0);
    for (const [x, z] of [[-0.32, -0.22], [0.32, -0.22], [-0.32, 0.22], [0.32, 0.22]]) box(g, 0.08, 0.18, 0.08, 0x1a1a1e, x, 0.09, z);
    box(g, 0.3, 0.2, 0.04, 0xff8a2a, 0, 0.45, 0.31, true); box(g, 0.16, 1.4, 0.16, 0x2a2c30, 0.2, 1.48, -0.12);
    box(g, 0.34, 0.08, 0.34, 0x8a8f98, -0.15, 0.82, 0.05); // bouilloire
  } else if (id === 'table') {
    box(g, 1.3, 0.08, 0.85, W, 0, 0.76, 0); for (const [x, z] of [[-0.56, -0.34], [0.56, -0.34], [-0.56, 0.34], [0.56, 0.34]]) box(g, 0.08, 0.72, 0.08, D, x, 0.36, z);
    box(g, 0.24, 0.1, 0.24, 0xf2f2f2, -0.3, 0.85, 0); box(g, 0.14, 0.2, 0.14, 0xc07a20, 0.3, 0.9, 0.05, true); // bol et sirop
  } else if (id === 'chaise') {
    box(g, 0.5, 0.07, 0.5, W, 0, 0.46, 0); box(g, 0.5, 0.6, 0.06, W, 0, 0.8, -0.24); for (const x of [-0.22, 0.22]) { box(g, 0.06, 0.44, 0.06, D, x, 0.22, 0.2); box(g, 0.06, 0.44, 0.06, D, x, 0.22, -0.2); box(g, 0.05, 0.06, 0.8, D, x, 0.02, 0); }
  } else if (id === 'cadre') {
    box(g, 1.2, 1.1, 0.08, D, 0, 1.15, 0); box(g, 1.04, 0.94, 0.09, 0x2c5a34, 0, 1.15, 0.01); box(g, 1.3, 0.08, 0.3, W, 0, 0.55, 0.1);
    box(g, 0.08, 0.55, 0.08, D, -0.5, 0.27, 0.1); box(g, 0.08, 0.55, 0.08, D, 0.5, 0.27, 0.1);
    const T = { supreme: 0xff7a1a, comite: 0xe8c040, mine: 0x8d8a84, egout: 0x6a8a5a, deneigete: 0xd83a1a };
    trophies.slice(0, 6).forEach((t, i) => { const x = -0.45 + (i % 3) * 0.45, y = i < 3 ? 1.42 : 0.94; box(g, 0.2, 0.06, 0.06, 0xe8c040, x, y - 0.16, 0.07); box(g, 0.14, 0.22, 0.08, T[t] || 0xe8c040, x, y, 0.08, true); });
    if (!trophies.length) box(g, 0.3, 0.2, 0.04, 0xe8e0d0, 0, 1.15, 0.06); // « ton trophée ici »
  } else if (id === 'tapis') {
    const c = [0xc8282e, 0xe8d8c0, 0x2e5fa8, 0xe8d8c0, 0x2c7a3a, 0xe8d8c0, 0xc07a20];
    for (let k = 0; k < 7; k++) box(g, 2.0 - k * 0.06, 0.03, 0.2, c[k], 0, 0.015 + (k & 1) * 0.002, -0.6 + k * 0.2);
  }
  return bake(g);
}
// décor d'hiver : Frimousse (bonhomme de neige du village, original : écharpe verte, chapeau de paille, balai), traînes sauvages, fanions
export function winterDecor(pat) {
  const g = new THREE.Group(), sm = new THREE.Group(), S = 0xf4f8fc;
  box(sm, 1.3, 1.1, 1.3, S, 0, 0.55, 0); box(sm, 1.0, 0.9, 1.0, S, 0, 1.5, 0); box(sm, 0.72, 0.68, 0.72, S, 0, 2.28, 0);
  box(sm, 0.1, 0.1, 0.05, 0x111111, -0.16, 2.38, 0.37); box(sm, 0.1, 0.1, 0.05, 0x111111, 0.16, 2.38, 0.37); box(sm, 0.1, 0.1, 0.34, 0xff7a1a, 0, 2.26, 0.52);
  for (const y of [1.25, 1.55, 1.85]) box(sm, 0.1, 0.1, 0.05, 0x3a2a1a, 0, y, 0.51);
  box(sm, 0.82, 0.14, 0.82, 0x2c8a4a, 0, 1.94, 0); box(sm, 0.18, 0.5, 0.06, 0x2c8a4a, 0.3, 1.7, 0.44); // écharpe verte
  box(sm, 1.0, 0.06, 1.0, 0xd9b44a, 0, 2.64, 0); box(sm, 0.56, 0.24, 0.56, 0xd9b44a, 0, 2.78, 0); box(sm, 0.58, 0.06, 0.58, 0x2e5fa8, 0, 2.7, 0); // chapeau de paille
  box(sm, 1.0, 0.07, 0.07, 0x6b4a2b, -0.85, 1.6, 0); box(sm, 0.07, 1.8, 0.07, 0x9b7a4d, 0.75, 1.1, 0.25); box(sm, 0.3, 0.4, 0.12, 0xd9b44a, 0.75, 0.15, 0.25); // bras, balai
  sm.position.set(pat.x - 13, 0, pat.z - 3); sm.rotation.y = 0.5; g.add(sm); g.userData.snowman = sm;
  const b = pat.butte;
  for (let k = 0; k < 2; k++) { const t = new THREE.Group(); box(t, 0.5, 0.06, 1.6, 0xb98b52, 0, 0.05, 0); box(t, 0.5, 0.3, 0.06, 0xb98b52, 0, 0.2, -0.8); box(t, 0.04, 0.04, 1.3, 0xc8282e, -0.2, 0.12, 0.1); t.position.set(b.x1 + 1.5 + k * 0.8, 0, b.z1 + 1.5); t.rotation.y = 1.4 + k * 0.3; g.add(t); }
  const cols = [0x2e5fa8, 0xf2f2f2, 0xf2c12e, 0x2c8a4a];
  for (let k = 0; k <= 12; k++) { const x = pat.x - 10 + k * (20 / 12); box(g, 0.3, 0.32, 0.03, cols[k % 4], x, 2.9 - Math.sin(k / 12 * Math.PI) * 0.45, pat.z - 8.4); }
  for (const x of [pat.x - 10.5, pat.x + 10.5]) box(g, 0.12, 3.2, 0.12, 0x6b4a2b, x, 1.6, pat.z - 8.4);
  return bake(g);
}
// traîne sauvage sous le joueur pendant la glissade
export function sledModel() { const t = new THREE.Group(); box(t, 0.55, 0.06, 1.5, 0xb98b52, 0, 0.03, 0); box(t, 0.55, 0.32, 0.06, 0xb98b52, 0, 0.18, -0.74); return bake(t); }

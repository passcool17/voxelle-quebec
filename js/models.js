// Modèles voxel faits de boîtes (personnages, ennemis, objets) + animations simples.
// Chaque pièce animée (pivot) est « cuite » en une seule géométrie à couleurs par sommet : peu d'appels de rendu,
// et le nuanceur des modèles ajoute un grain de micro-voxels et des arêtes marquées.
import * as THREE from 'three';
import { patchModel } from './materials.js';
const mats = new Map(), geo = new THREE.BoxGeometry(1, 1, 1);
export function mat(c, glow) { const k = c + (glow ? 'g' : ''); let m = mats.get(k); if (!m) { m = glow ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshLambertMaterial({ color: c }); mats.set(k, m); } return m; }
export function box(parent, w, h, d, c, x = 0, y = 0, z = 0, glow) { const m = new THREE.Mesh(geo, mat(c, glow)); m.scale.set(w, h, d); m.position.set(x, y, z); m.userData.box = { c, glow: !!glow }; parent.add(m); return m; }
function pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
export const MODEL_MAT = patchModel(new THREE.MeshLambertMaterial({ vertexColors: true }));
const MODEL_GLOW = new THREE.MeshBasicMaterial({ vertexColors: true });
let shadowsOn = false;
export function setModelShadows(on) { shadowsOn = on; }
// fusionne les boîtes enfants directes de chaque groupe (sauf celles marquées keep)
export function bake(root) {
  const groups = []; root.traverse(o => { if (!o.isMesh) groups.push(o); });
  if (!root.isMesh && !groups.includes(root)) groups.push(root);
  const tmp = new THREE.Matrix4(), col = new THREE.Color(), v = new THREE.Vector3(), nm = new THREE.Matrix3();
  const src = geo.attributes, idx = geo.index.array;
  for (const g of groups) {
    for (const glow of [false, true]) {
      const kids = g.children.filter(o => o.isMesh && o.userData.box && !o.userData.keep && o.userData.box.glow === glow); if (kids.length < 1) continue;
      const nV = kids.length * 24, pos = new Float32Array(nV * 3), nor = new Float32Array(nV * 3), cl = new Float32Array(nV * 3), bs = new Float32Array(nV * 3), bc = new Float32Array(nV * 3), ii = new Uint16Array(kids.length * 36);
      kids.forEach((k, n) => {
        k.updateMatrix(); tmp.copy(k.matrix); nm.getNormalMatrix(tmp); col.set(k.userData.box.c);
        const c = new THREE.Vector3().setFromMatrixPosition(tmp), sc = k.scale;
        for (let i = 0; i < 24; i++) {
          v.fromBufferAttribute(src.position, i).applyMatrix4(tmp); pos.set([v.x, v.y, v.z], (n * 24 + i) * 3);
          v.fromBufferAttribute(src.normal, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], (n * 24 + i) * 3);
          cl.set([col.r, col.g, col.b], (n * 24 + i) * 3); bs.set([Math.abs(sc.x), Math.abs(sc.y), Math.abs(sc.z)], (n * 24 + i) * 3); bc.set([c.x, c.y, c.z], (n * 24 + i) * 3);
        }
        for (let i = 0; i < 36; i++) ii[n * 36 + i] = idx[i] + n * 24;
        g.remove(k);
      });
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); bg.setAttribute('color', new THREE.BufferAttribute(cl, 3));
      bg.setAttribute('bsize', new THREE.BufferAttribute(bs, 3)); bg.setAttribute('boxc', new THREE.BufferAttribute(bc, 3)); bg.setIndex(new THREE.BufferAttribute(ii, 1)); bg.computeBoundingSphere();
      const mesh = new THREE.Mesh(bg, glow ? MODEL_GLOW : MODEL_MAT); mesh.castShadow = !glow; mesh.userData.baked = true; g.add(mesh);
    }
  }
  return root;
}
const shade = (c, f) => { const r = Math.min(255, (c >> 16 & 255) * f), g = Math.min(255, (c >> 8 & 255) * f), b = Math.min(255, (c & 255) * f); return (r << 16) | (g << 8) | b; };

// ---------- humains ----------
export function human(o = {}) {
  const c = Object.assign({ skin: 0xf0c8a0, coat: 0x2e5fa8, pants: 0x2b2f3a, boots: 0x5a3a22, hat: 0xc8282e, hatBand: 0xf2f2f2, pom: 0xf2f2f2, mitt: 0xc8282e, sash: true, hair: 0x5a3a22, beard: null, glasses: false, apron: null, hatType: 'tuque', scale: 1, zombie: false }, o);
  const g = new THREE.Group(), body = pivot(g, 0, 0, 0), P = {};
  for (const [k, sx] of [['legL', -0.15], ['legR', 0.15]]) {
    const L = P[k] = pivot(body, sx, 0.8, 0);
    box(L, 0.24, 0.62, 0.26, c.pants, 0, -0.33, 0); box(L, 0.25, 0.04, 0.27, shade(c.pants, 0.75), 0, -0.12, 0);
    box(L, 0.26, 0.2, 0.34, c.boots, 0, -0.7, 0.03); box(L, 0.28, 0.05, 0.37, 0x1c1814, 0, -0.785, 0.03); box(L, 0.28, 0.06, 0.29, c.zombie ? 0x222222 : 0xe8e0d0, 0, -0.58, 0.01);
    box(L, 0.06, 0.02, 0.02, 0xd8c8a0, 0, -0.66, -0.14); box(L, 0.06, 0.02, 0.02, 0xd8c8a0, 0, -0.71, -0.14);
  }
  P.torso = pivot(body, 0, 0.8, 0);
  box(P.torso, 0.56, 0.62, 0.32, c.coat, 0, 0.31, 0);
  box(P.torso, 0.58, 0.1, 0.34, shade(c.coat, 0.82), 0, 0.03, 0); // ourlet
  box(P.torso, 0.42, 0.08, 0.36, shade(c.coat, 1.18), 0, 0.6, 0.0); // col
  box(P.torso, 0.02, 0.44, 0.02, shade(c.coat, 0.6), 0, 0.33, -0.165); // fermeture
  for (const y of [0.48, 0.36, 0.24]) box(P.torso, 0.04, 0.04, 0.02, 0xd8c070, 0.04, y, -0.168);
  box(P.torso, 0.12, 0.08, 0.02, shade(c.coat, 0.78), -0.16, 0.2, -0.166); box(P.torso, 0.12, 0.08, 0.02, shade(c.coat, 0.78), 0.16, 0.2, -0.166);
  if (c.apron) { box(P.torso, 0.46, 0.5, 0.02, c.apron, 0, 0.22, -0.17); box(P.torso, 0.18, 0.1, 0.02, shade(c.apron, 0.85), 0, 0.12, -0.182); }
  if (c.sash) { // ceinture fléchée : chevrons
    box(P.torso, 0.58, 0.1, 0.34, 0xc8282e, 0, 0.06, 0); box(P.torso, 0.585, 0.025, 0.345, 0xf2c12e, 0, 0.06, 0);
    for (let i = 0; i < 6; i++) box(P.torso, 0.04, 0.04, 0.02, [0x1f4fa8, 0x2c7a3a, 0xf2f2f2][i % 3], -0.25 + i * 0.1, 0.085 - (i % 2) * 0.05, -0.175);
    box(P.torso, 0.06, 0.26, 0.04, 0x1f4fa8, 0.18, -0.08, -0.18); box(P.torso, 0.06, 0.22, 0.04, 0xc8282e, 0.24, -0.06, -0.18);
    box(P.torso, 0.07, 0.04, 0.045, 0xf2c12e, 0.18, -0.2, -0.18); box(P.torso, 0.07, 0.04, 0.045, 0xf2c12e, 0.24, -0.16, -0.18);
  } else box(P.torso, 0.57, 0.05, 0.33, 0x2a2018, 0, 0.06, 0);
  P.head = pivot(P.torso, 0, 0.62, 0);
  box(P.head, 0.12, 0.06, 0.12, c.skin, 0, 0.02, 0); // cou
  box(P.head, 0.42, 0.42, 0.42, c.skin, 0, 0.24, 0);
  box(P.head, 0.04, 0.1, 0.08, shade(c.skin, 0.9), -0.225, 0.22, 0.02); box(P.head, 0.04, 0.1, 0.08, shade(c.skin, 0.9), 0.225, 0.22, 0.02);
  box(P.head, 0.07, 0.08, 0.06, shade(c.skin, 0.88), 0, 0.2, -0.235); // nez
  const eyeW = c.zombie ? 0xd8e0b0 : 0xf8f8f4;
  for (const sx of [-1, 1]) {
    box(P.head, 0.09, 0.08, 0.02, eyeW, sx * 0.1, 0.27, -0.215); box(P.head, 0.045, 0.06, 0.02, c.zombie ? 0x802020 : 0x2a1e18, sx * 0.1 + 0.015, 0.265, -0.222);
    box(P.head, 0.015, 0.015, 0.01, 0xffffff, sx * 0.1 + 0.03, 0.285, -0.229);
    box(P.head, 0.1, 0.025, 0.02, c.zombie ? 0x3a3a3a : shade(c.hair, 0.9), sx * 0.1, 0.33 + (c.zombie ? sx * -0.01 : 0), -0.216);
    if (!c.zombie && !c.beard) box(P.head, 0.06, 0.035, 0.01, 0xe89a90, sx * 0.14, 0.17, -0.214);
  }
  box(P.head, c.zombie ? 0.18 : 0.12, 0.025, 0.02, c.zombie ? 0x3a2a2a : 0x8a4a3a, 0, 0.12, -0.215);
  if (c.glasses) { box(P.head, 0.36, 0.025, 0.02, 0x222222, 0, 0.3, -0.228); box(P.head, 0.13, 0.11, 0.015, 0xa0d0f0, -0.1, 0.27, -0.226); box(P.head, 0.13, 0.11, 0.015, 0xa0d0f0, 0.1, 0.27, -0.226); }
  if (c.beard) { box(P.head, 0.44, 0.16, 0.1, c.beard, 0, 0.07, -0.19); box(P.head, 0.3, 0.08, 0.08, c.beard, 0, -0.02, -0.18); box(P.head, 0.2, 0.04, 0.03, shade(c.beard, 0.85), 0, 0.15, -0.235); box(P.head, 0.06, 0.08, 0.3, c.beard, -0.2, 0.16, -0.06); box(P.head, 0.06, 0.08, 0.3, c.beard, 0.2, 0.16, -0.06); }
  box(P.head, 0.44, 0.1, 0.44, c.hair, 0, 0.42, 0.02); box(P.head, 0.44, 0.22, 0.08, c.hair, 0, 0.32, 0.2); box(P.head, 0.05, 0.12, 0.3, c.hair, -0.215, 0.33, 0.06); box(P.head, 0.05, 0.12, 0.3, c.hair, 0.215, 0.33, 0.06);
  if (c.hatType === 'tuque') {
    box(P.head, 0.46, 0.2, 0.46, c.hat, 0, 0.52, 0);
    box(P.head, 0.48, 0.08, 0.48, c.hatBand, 0, 0.43, 0); box(P.head, 0.485, 0.02, 0.485, shade(c.hatBand, 0.82), 0, 0.45, 0);
    for (let i = 0; i < 4; i++) box(P.head, 0.465, 0.02, 0.465, shade(c.hat, 0.82), 0, 0.5 + i * 0.045, 0);
    box(P.head, 0.36, 0.1, 0.36, c.hat, 0, 0.66, 0); box(P.head, 0.24, 0.06, 0.24, c.hat, 0, 0.73, 0);
    box(P.head, 0.14, 0.12, 0.14, c.pom, 0, 0.8, 0); box(P.head, 0.1, 0.06, 0.18, c.pom, 0, 0.82, 0); box(P.head, 0.18, 0.06, 0.1, c.pom, 0, 0.79, 0); box(P.head, 0.1, 0.18, 0.1, shade(c.pom, 0.9), 0, 0.81, 0);
  }
  else if (c.hatType === 'kepi') { box(P.head, 0.46, 0.18, 0.46, c.hat, 0, 0.52, 0); box(P.head, 0.47, 0.04, 0.47, 0xe8c040, 0, 0.45, 0); box(P.head, 0.46, 0.04, 0.16, 0x111111, 0, 0.43, -0.28); box(P.head, 0.06, 0.06, 0.02, 0xe8c040, 0, 0.53, -0.235); }
  else if (c.hatType === 'bun') { box(P.head, 0.22, 0.2, 0.2, c.hair, 0, 0.56, 0.12); box(P.head, 0.04, 0.04, 0.24, 0xc8282e, 0.06, 0.6, 0.12); }
  else if (c.hatType === 'casque') { box(P.head, 0.5, 0.18, 0.5, 0xf2c12e, 0, 0.52, 0); box(P.head, 0.56, 0.04, 0.56, 0xf2c12e, 0, 0.44, 0); box(P.head, 0.08, 0.06, 0.52, shade(0xf2c12e, 0.85), 0, 0.62, 0); }
  else if (c.hatType === 'filet') { box(P.head, 0.46, 0.12, 0.46, 0xe8e8f0, 0, 0.47, 0); box(P.head, 0.3, 0.06, 0.3, 0xe8e8f0, 0, 0.55, 0.02); }
  for (const [k, sx] of [['armL', -1], ['armR', 1]]) {
    const A = P[k] = pivot(P.torso, sx * 0.37, 0.56, 0);
    box(A, 0.18, 0.56, 0.22, c.coat, 0, -0.26, 0); box(A, 0.19, 0.05, 0.23, shade(c.coat, 0.8), 0, -0.47, 0);
    box(A, 0.2, 0.16, 0.24, c.zombie ? c.skin : c.mitt, 0, -0.58, 0); box(A, 0.07, 0.1, 0.08, c.zombie ? c.skin : shade(c.mitt, 0.9), -sx * 0.1, -0.55, -0.08);
  }
  P.hand = pivot(P.armR, 0, -0.6, 0);
  g.scale.setScalar(c.scale);
  bake(g);
  return { g, P, body, c, kind: 'human' };
}
export function weaponModel(kind) {
  const g = new THREE.Group();
  if (kind === 'baton' || kind === 'baton_carbone' || kind === 'baton_or') {
    const shaft = kind === 'baton_or' ? 0xe8c040 : kind === 'baton_carbone' ? 0x222428 : 0xb98b52;
    box(g, 0.07, 0.07, 1.25, shaft, 0, 0, -0.45); box(g, 0.08, 0.08, 0.22, 0x111111, 0, 0, 0.12);
    box(g, 0.07, 0.12, 0.42, 0x111111, 0, -0.06, -1.12).rotation.x = 0; const b = box(g, 0.07, 0.1, 0.4, kind === 'baton_or' ? 0xffe070 : 0xf2f2f2, 0, -0.07, -1.25); b.position.x = 0.1; b.scale.set(0.3, 0.1, 0.07); b.position.set(0.12, -0.08, -1.08);
  } else if (kind === 'pelle' || kind === 'pelle_alu') {
    box(g, 0.07, 0.07, 1.1, 0x8b6a3e, 0, 0, -0.4); box(g, 0.22, 0.06, 0.06, 0x111111, 0, 0, 0.14);
    box(g, 0.5, 0.04, 0.45, kind === 'pelle_alu' ? 0xc9ced6 : 0x2e5fa8, 0, 0, -1.12);
  } else if (kind === 'lanceur') {
    box(g, 0.16, 0.16, 0.8, 0x2e5fa8, 0, 0.05, -0.25); box(g, 0.2, 0.2, 0.08, 0x1a1a1a, 0, 0.05, -0.66); box(g, 0.22, 0.22, 0.22, 0xf2f6fb, 0, 0.22, -0.1); box(g, 0.08, 0.2, 0.1, 0x333333, 0, -0.1, 0.02);
    box(g, 0.17, 0.04, 0.5, 0xf2f2f2, 0, 0.14, -0.3); box(g, 0.06, 0.06, 0.06, 0xc8282e, 0, 0.16, -0.58);
  }
  if (kind.startsWith('baton')) { box(g, 0.075, 0.075, 0.05, 0xf2f2f2, 0, 0, -0.2); box(g, 0.075, 0.075, 0.05, 0xf2f2f2, 0, 0, -0.3); }
  return bake(g);
}
export function setWeapon(m, kind) {
  if (m.weapon) m.P.hand.remove(m.weapon);
  m.weapon = weaponModel(kind); m.wkind = kind;
  if (kind === 'lanceur') { m.weapon.rotation.x = 0; m.weapon.position.set(0, 0, -0.05); }
  else { m.weapon.rotation.x = -1.2; m.weapon.position.set(0, 0, 0); }
  m.P.hand.add(m.weapon);
}
// Animation : t temps, mv vitesse 0..1, atk 0..1 (progression d'un coup), air, glide
export function animHuman(m, t, mv, atk, air, glide, sit) {
  const P = m.P, s = Math.sin(t * 10) * mv;
  P.legL.rotation.x = s * 0.8; P.legR.rotation.x = -s * 0.8;
  P.armL.rotation.x = -s * 0.7; P.armR.rotation.x = s * 0.7; P.armR.rotation.z = 0; P.armL.rotation.z = 0; P.torso.rotation.y = 0; P.torso.rotation.x = 0;
  m.body.position.y = Math.abs(Math.sin(t * 10)) * 0.06 * mv;
  if (m.c.zombie) { P.armL.rotation.x = -1.4 + Math.sin(t * 3) * 0.1; P.armR.rotation.x = -1.3 + Math.cos(t * 3) * 0.1; }
  if (air && !glide) { P.legL.rotation.x = 0.5; P.legR.rotation.x = -0.3; P.armL.rotation.z = -0.5; P.armR.rotation.z = 0.5; }
  if (glide) { P.armL.rotation.x = P.armR.rotation.x = -2.9; P.armL.rotation.z = 0.15; P.armR.rotation.z = -0.15; P.legL.rotation.x = 0.25; P.legR.rotation.x = 0.35; P.torso.rotation.x = -0.15; }
  if (atk > 0) {
    if (m.wkind === 'lanceur') { P.armR.rotation.x = -1.5 - Math.sin(atk * Math.PI) * 0.3; P.armL.rotation.x = -1.3; }
    else { const k = atk < 0.35 ? atk / 0.35 : 1 - (atk - 0.35) / 0.65; P.armR.rotation.x = -0.6 - k * 1.2; P.armR.rotation.z = 0.2; P.torso.rotation.y = (atk < 0.35 ? -atk / 0.35 : -1 + (atk - 0.35) / 0.65 * 2.2) * 0.9; P.armL.rotation.x = -0.8; }
  }
  if (sit) { P.legL.rotation.x = P.legR.rotation.x = -1.5; }
}

// ---------- cerf-volant fléché ----------
export function glider() {
  const g = new THREE.Group();
  const cols = [0xc8282e, 0x1f4fa8, 0xf2c12e, 0x2c7a3a, 0xf2f2f2];
  for (let i = 0; i < 9; i++) { const x = (i - 4) * 0.34; box(g, 0.34, 0.05, 1.2 - Math.abs(i - 4) * 0.06, cols[[0, 1, 0, 2, 4, 2, 0, 1, 0][i]], x, 0, 0); }
  for (let i = 0; i < 4; i++) { box(g, 0.1, 0.06, 0.12, 0xf2c12e, (i - 1.5) * 0.7, 0.01, -0.25 + Math.abs(i - 1.5) * 0.12); }
  box(g, 0.04, 1.0, 0.04, 0x5a3a22, -0.8, -0.5, 0); box(g, 0.04, 1.0, 0.04, 0x5a3a22, 0.8, -0.5, 0);
  g.rotation.z = 0; return bake(g);
}

// ---------- ennemis ----------
export function enemyModel(type) {
  const g = new THREE.Group(), P = {}; let kind = type;
  if (type === 'cone' || type === 'supreme') {
    const s = type === 'supreme' ? 2.4 : 1;
    const body = pivot(g, 0, 0, 0); P.body = body;
    box(body, 0.92, 0.1, 0.92, 0x1e1e1e, 0, 0.05, 0); box(body, 0.8, 0.04, 0.8, 0x2c2c2c, 0, 0.12, 0);
    for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) box(body, 0.14, 0.06, 0.14, 0x141414, x, 0.03, z);
    // cône effilé en 14 tranches, bandes réfléchissantes
    for (let i = 0; i < 14; i++) { const t = i / 13, w = 0.74 - t * 0.56, y = 0.18 + i * 0.115, band = i === 4 || i === 5 || i === 9;
      box(body, w, 0.12, w, band ? 0xf4f4f0 : (i % 2 ? 0xff7a1a : 0xf47014), 0, y, 0); }
    box(body, 0.16, 0.06, 0.16, 0xff8a2a, 0, 1.82, 0);
    // visage fâché
    for (const sx of [-1, 1]) { box(body, 0.09, 0.08, 0.02, 0xfff4d0, sx * 0.12, 1.0, -0.245); box(body, 0.045, 0.06, 0.02, 0x111111, sx * 0.11, 0.99, -0.255); box(body, 0.12, 0.025, 0.02, 0x2a1a10, sx * 0.12, 1.07 - sx * -0.0, -0.25).rotation.z = sx * 0.35; }
    box(body, 0.22, 0.035, 0.02, 0x2a1a10, 0, 0.82, -0.29); box(body, 0.05, 0.03, 0.02, 0xf4f4f0, -0.06, 0.8, -0.3); box(body, 0.05, 0.03, 0.02, 0xf4f4f0, 0.06, 0.8, -0.3);
    for (const [k, sx] of [['armL', -1], ['armR', 1]]) { const A = P[k] = pivot(body, sx * 0.42, 0.72, 0); box(A, 0.16, 0.44, 0.16, 0xff7a1a, 0, -0.22, 0); box(A, 0.17, 0.06, 0.17, 0xf4f4f0, 0, -0.14, 0); box(A, 0.2, 0.14, 0.2, 0x1e1e1e, 0, -0.48, 0); }
    if (type === 'supreme') { box(body, 0.34, 0.08, 0.34, 0xe8c040, 0, 1.88, 0); for (const [x, z] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13], [0, -0.15], [0, 0.15]]) box(body, 0.06, 0.14, 0.06, 0xe8c040, x, 1.98, z); box(body, 0.06, 0.06, 0.02, 0xff2020, 0, 1.88, -0.18, true); box(body, 0.05, 0.05, 0.02, 0x30a0ff, -0.1, 1.88, -0.175, true); box(body, 0.05, 0.05, 0.02, 0x30ff80, 0.1, 1.88, -0.175, true); }
    g.scale.setScalar(s); kind = 'cone';
  } else if (type === 'bureau') {
    const m = human({ skin: 0x9fb88a, coat: 0x5a5f6a, pants: 0x3a3e48, boots: 0x111111, hatType: 'none', hair: 0x3a3a3a, mitt: 0x9fb88a, sash: false, glasses: true, zombie: true });
    box(m.P.torso, 0.08, 0.36, 0.02, 0xb02020, 0, 0.36, -0.172); box(m.P.torso, 0.1, 0.06, 0.02, 0x901818, 0, 0.55, -0.174); box(m.P.torso, 0.16, 0.5, 0.02, 0xe8e8e0, 0, 0.36, -0.168);
    box(m.P.torso, 0.06, 0.08, 0.02, 0x1f4fa8, -0.17, 0.46, -0.174); // stylo dans la poche
    box(m.P.hand, 0.3, 0.02, 0.4, 0xf8f8f0, 0, -0.06, -0.12); box(m.P.hand, 0.2, 0.025, 0.02, 0x2040a0, 0, -0.045, -0.2); box(m.P.hand, 0.06, 0.03, 0.06, 0xc02020, 0.08, -0.04, -0.02);
    box(m.P.armL, 0.36, 0.26, 0.1, 0x4a2e1a, 0, -0.78, 0); box(m.P.armL, 0.12, 0.04, 0.04, 0x2a1a0e, 0, -0.63, 0); box(m.P.armL, 0.04, 0.04, 0.11, 0xd8c070, 0.1, -0.72, 0);
    bake(m.g); m.g.userData = m; return { g: m.g, P: m.P, m, kind: 'human' };
  } else if (type === 'plow') {
    const body = pivot(g, 0, 0, 0); P.body = body;
    box(body, 1.6, 0.9, 2.6, 0xf28a1a, 0, 0.85, 0.2); box(body, 1.62, 0.12, 2.62, 0x222222, 0, 0.46, 0.2); box(body, 1.62, 0.06, 2.62, 0xf4f4f0, 0, 1.0, 0.2);
    box(body, 1.4, 0.8, 1.0, 0xf28a1a, 0, 1.7, -0.3); box(body, 1.44, 0.06, 1.04, 0x222222, 0, 2.12, -0.3);
    box(body, 1.42, 0.45, 0.04, 0x8fd0ff, 0, 1.8, -0.82); box(body, 0.04, 0.45, 0.8, 0x8fd0ff, -0.71, 1.8, -0.3); box(body, 0.04, 0.45, 0.8, 0x8fd0ff, 0.71, 1.8, -0.3);
    box(body, 0.04, 0.45, 0.05, 0x222222, 0, 1.8, -0.84);
    for (const sx of [-1, 1]) { box(body, 0.08, 0.08, 0.02, 0xfff4d0, sx * 0.3, 1.86, -0.85); box(body, 0.04, 0.05, 0.02, 0x111111, sx * 0.3, 1.85, -0.86); box(body, 0.2, 0.15, 0.04, 0xfff0a0, sx * 0.6, 1.05, -1.1, true); box(body, 0.06, 0.2, 0.06, 0x222222, sx * 0.86, 1.75, -0.7); box(body, 0.04, 0.14, 0.1, 0x8fd0ff, sx * 0.9, 1.85, -0.72); }
    box(body, 0.5, 0.06, 0.02, 0x111111, 0, 1.68, -0.85);
    for (let i = 0; i < 5; i++) box(body, 0.06, 0.4, 0.04, 0x333333, -0.4 + i * 0.2, 0.95, -1.08); box(body, 1.2, 0.5, 0.06, 0x555555, 0, 0.95, -1.06);
    box(body, 0.12, 0.7, 0.12, 0x444444, 0.6, 2.0, 0.8); box(body, 0.16, 0.06, 0.16, 0x222222, 0.6, 2.36, 0.8);
    P.blade = pivot(body, 0, 0.55, -1.35); box(P.blade, 2.4, 0.7, 0.12, 0xc9ced6, 0, 0, 0); box(P.blade, 2.4, 0.08, 0.14, 0xff7a1a, 0, 0.3, 0); box(P.blade, 2.42, 0.06, 0.16, 0x6a6e76, 0, -0.33, 0.02);
    for (let i = 0; i < 6; i++) box(P.blade, 0.05, 0.05, 0.02, 0x6a6e76, -1.0 + i * 0.4, 0.1, -0.07);
    for (const [x, z] of [[-0.82, -0.5], [0.82, -0.5], [-0.82, 0.9], [0.82, 0.9]]) { box(body, 0.3, 0.6, 0.6, 0x161616, x, 0.3, z); box(body, 0.32, 0.22, 0.22, 0x9a9a9a, x, 0.3, z); for (let k = 0; k < 3; k++) box(body, 0.31, 0.06, 0.62, 0x0a0a0a, x, 0.08 + k * 0.22, z); }
    P.light = box(body, 0.3, 0.2, 0.3, 0xffa020, 0, 2.24, -0.3, true); P.light.userData.keep = true;
    box(body, 0.9, 0.04, 0.6, 0xf2f2f2, 0, 1.0, 1.5); box(body, 0.5, 0.2, 0.04, 0xf4f4f0, 0, 0.8, 1.51); box(body, 0.3, 0.06, 0.042, 0x1f4fa8, 0, 0.8, 1.52);
  } else if (type === 'raton') {
    const body = pivot(g, 0, 0, 0); P.body = body;
    box(body, 0.5, 0.42, 0.8, 0x7d7a74, 0, 0.42, 0); box(body, 0.42, 0.12, 0.6, 0x9d9a94, 0, 0.24, 0); box(body, 0.46, 0.1, 0.5, 0x6a6862, 0, 0.62, 0.05);
    P.head = pivot(body, 0, 0.55, -0.48); box(P.head, 0.42, 0.36, 0.36, 0x8d8a84, 0, 0, 0); box(P.head, 0.44, 0.12, 0.3, 0x1a1a1a, 0, 0.04, -0.04);
    box(P.head, 0.46, 0.04, 0.2, 0xe8e4dc, 0, 0.12, -0.08);
    for (const sx of [-1, 1]) { box(P.head, 0.08, 0.08, 0.02, 0xffffff, sx * 0.1, 0.05, -0.19); box(P.head, 0.04, 0.05, 0.02, 0x111111, sx * 0.1, 0.05, -0.2); box(P.head, 0.12, 0.13, 0.06, 0x5a5854, sx * 0.15, 0.24, 0); box(P.head, 0.06, 0.07, 0.03, 0xd8c8c0, sx * 0.15, 0.23, -0.03);
      box(P.head, 0.12, 0.012, 0.012, 0xe0e0e0, sx * 0.14, -0.06, -0.3); box(P.head, 0.11, 0.012, 0.012, 0xe0e0e0, sx * 0.13, -0.09, -0.3); }
    box(P.head, 0.14, 0.12, 0.16, 0xd8d4cc, 0, -0.08, -0.22); box(P.head, 0.06, 0.05, 0.03, 0x111111, 0, -0.04, -0.31);
    P.tail = pivot(body, 0, 0.5, 0.4); for (let i = 0; i < 7; i++) box(P.tail, 0.17 - i * 0.008, 0.17 - i * 0.008, 0.11, i % 2 ? 0x1a1a1a : 0x9d9a94, 0, 0.035 * i, 0.06 + i * 0.1);
    for (const [x, z] of [[-0.18, -0.28], [0.18, -0.28], [-0.18, 0.28], [0.18, 0.28]]) { box(body, 0.12, 0.24, 0.12, 0x3a3a3a, x, 0.12, z); box(body, 0.14, 0.04, 0.15, 0x222222, x, 0.02, z - 0.01); }
    P.poutine = pivot(body, 0, 0.75, -0.2); box(P.poutine, 0.3, 0.16, 0.24, 0xf2f2f2, 0, 0, 0); box(P.poutine, 0.31, 0.03, 0.25, 0xc02020, 0, 0.04, 0); box(P.poutine, 0.26, 0.08, 0.2, 0xe8b84a, 0, 0.1, 0);
    for (let i = 0; i < 5; i++) box(P.poutine, 0.035, 0.035, 0.14, 0xf0c860, -0.09 + i * 0.045, 0.15 + (i % 2) * 0.02, (i % 3 - 1) * 0.03).rotation.y = i * 0.6;
    box(P.poutine, 0.12, 0.04, 0.1, 0x7a4a22, 0.03, 0.16, 0.02); box(P.poutine, 0.06, 0.05, 0.06, 0xfaf6e0, -0.06, 0.17, -0.04); box(P.poutine, 0.05, 0.04, 0.05, 0xfaf6e0, 0.07, 0.17, 0.05);
  } else if (type === 'mouches') {
    P.flies = []; for (let i = 0; i < 18; i++) { const f = box(g, 0.08, 0.06, 0.1, 0x101010, 0, 0, 0); f.userData.keep = true; f.userData.ph = Math.random() * 6.28; f.userData.r = 0.3 + Math.random() * 0.7; P.flies.push(f); }
  } else if (type === 'trou') {
    const body = pivot(g, 0, 0, 0); P.body = body;
    box(body, 2.0, 0.08, 2.0, 0x4a4c50, 0, 0.04, 0); box(body, 1.5, 0.1, 1.5, 0x0a0a0a, 0, 0.06, 0);
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, r = 0.85 + (i % 3) * 0.06; box(body, 0.22, 0.1, 0.12, i % 2 ? 0x5a5c60 : 0x3a3c40, Math.cos(a) * r, 0.07, Math.sin(a) * r).rotation.y = -a; }
    for (let i = 0; i < 6; i++) { const a = i * 1.1; box(body, 0.5, 0.02, 0.03, 0x1a1a1a, Math.cos(a) * 1.05, 0.085, Math.sin(a) * 1.05).rotation.y = -a + 0.4; }
    box(body, 0.3, 0.03, 0.08, 0xf2c12e, 0.7, 0.085, 0.75);
    P.jaw = pivot(body, 0, 0.08, 0);
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283; const t = box(P.jaw, 0.13, 0.24 + (i % 2) * 0.06, 0.13, 0xf2f0e0, Math.cos(a) * 0.68, 0.1, Math.sin(a) * 0.68); t.rotation.y = -a; }
    P.eyes = pivot(body, 0, 0.2, 0); for (const sx of [-1, 1]) { box(P.eyes, 0.14, 0.14, 0.14, 0xffe030, sx * 0.3, 0, -0.1, true); box(P.eyes, 0.06, 0.1, 0.02, 0x101010, sx * 0.3, 0, -0.18); }
  }
  bake(g);
  return { g, P, kind };
}
export function animEnemy(e, t, dt) {
  const M = e.model, P = M.P;
  if (M.kind === 'human') return animHuman(M.m, t, e.moving ? 0.7 : 0, e.atkAnim, !e.ground, false);
  const mv = e.moving ? 1 : 0, s = Math.sin(t * 9);
  if (e.type === 'cone' || e.type === 'supreme') { P.body.position.y = Math.abs(s) * 0.08 * mv; P.body.rotation.z = s * 0.06 * mv; P.armL.rotation.x = s * 0.8 * mv; P.armR.rotation.x = -s * 0.8 * mv; if (e.atkAnim > 0) { P.armL.rotation.x = P.armR.rotation.x = -2.2 * Math.sin(e.atkAnim * Math.PI); } }
  else if (e.type === 'plow') { P.light.visible = Math.sin(t * 14) > -0.2; P.light.rotation.y = t * 8; P.body.position.y = Math.sin(t * 30) * 0.02 * mv; P.blade.position.y = 0.55 + (e.state === 'wind' ? Math.sin(t * 20) * 0.08 : 0); }
  else if (e.type === 'raton') { P.body.position.y = Math.abs(s) * 0.1 * mv; P.tail.rotation.y = Math.sin(t * 6) * 0.4; P.head.rotation.x = e.atkAnim > 0 ? 0.4 : 0; P.poutine.visible = !e.stole; }
  else if (e.type === 'mouches') { for (const f of P.flies) { const ph = f.userData.ph + t * (5 + f.userData.r * 3), r = f.userData.r; f.position.set(Math.cos(ph) * r, 1.1 + Math.sin(ph * 1.7) * 0.4, Math.sin(ph * 1.3) * r); } }
  else if (e.type === 'trou') { const open = e.state === 'chase' || e.atkAnim > 0 ? 1 : 0; e.jawT = (e.jawT || 0) + (open - (e.jawT || 0)) * Math.min(1, dt * 8); P.jaw.position.y = 0.08 + e.jawT * (0.15 + (e.atkAnim > 0 ? Math.sin(e.atkAnim * Math.PI) * 0.4 : Math.abs(Math.sin(t * 8)) * 0.1)); P.eyes.visible = e.jawT > 0.3; P.eyes.position.y = 0.2 + e.jawT * 0.3; }
}

// ---------- objets au sol ----------
export function pickupModel(kind) {
  const g = new THREE.Group();
  if (kind === 'piasse') { box(g, 0.32, 0.32, 0.08, 0xe8c040, 0, 0, 0, true); box(g, 0.18, 0.18, 0.1, 0xb08a20, 0, 0, 0); }
  else if (kind === 'chaudiere') { box(g, 0.4, 0.45, 0.4, 0xc9ced6, 0, 0, 0); box(g, 0.34, 0.06, 0.34, 0xc07a20, 0, 0.21, 0, true); box(g, 0.44, 0.04, 0.04, 0x555555, 0, 0.3, 0); }
  else if (kind === 'permis') { box(g, 0.5, 0.04, 0.66, 0xf8f8f0, 0, 0, 0, true); box(g, 0.3, 0.05, 0.06, 0x2040a0, 0, 0.01, -0.15); box(g, 0.12, 0.06, 0.12, 0xc02020, 0.12, 0.01, 0.18); }
  else if (kind === 'sirop') { box(g, 0.3, 0.4, 0.14, 0xc07a20, 0, 0, 0, true); box(g, 0.1, 0.1, 0.1, 0xf2f2f2, 0, 0.25, 0); }
  else if (kind === 'poutine') { box(g, 0.36, 0.18, 0.3, 0xf2f2f2, 0, 0, 0); box(g, 0.32, 0.1, 0.26, 0xe8b84a, 0, 0.12, 0, true); }
  else { box(g, 0.4, 0.4, 0.4, 0x9a6adf, 0, 0, 0, true); box(g, 0.46, 0.08, 0.46, 0xf2c12e, 0, 0.1, 0); }
  return bake(g);
}

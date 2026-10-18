// Modèles voxel faits de boîtes (personnages, ennemis, objets) + animations simples.
import * as THREE from 'three';
const mats = new Map(), geo = new THREE.BoxGeometry(1, 1, 1);
export function mat(c, glow) { const k = c + (glow ? 'g' : ''); let m = mats.get(k); if (!m) { m = glow ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshLambertMaterial({ color: c }); mats.set(k, m); } return m; }
export function box(parent, w, h, d, c, x = 0, y = 0, z = 0, glow) { const m = new THREE.Mesh(geo, mat(c, glow)); m.scale.set(w, h, d); m.position.set(x, y, z); parent.add(m); return m; }
function pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

// ---------- humains ----------
export function human(o = {}) {
  const c = Object.assign({ skin: 0xf0c8a0, coat: 0x2e5fa8, pants: 0x2b2f3a, boots: 0x5a3a22, hat: 0xc8282e, hatBand: 0xf2f2f2, pom: 0xf2f2f2, mitt: 0xc8282e, sash: true, hair: 0x5a3a22, beard: null, glasses: false, apron: null, hatType: 'tuque', scale: 1, zombie: false }, o);
  const g = new THREE.Group(), body = pivot(g, 0, 0, 0), P = {};
  P.legL = pivot(body, -0.15, 0.8, 0); box(P.legL, 0.24, 0.62, 0.26, c.pants, 0, -0.33, 0); box(P.legL, 0.26, 0.2, 0.34, c.boots, 0, -0.7, 0.03);
  P.legR = pivot(body, 0.15, 0.8, 0); box(P.legR, 0.24, 0.62, 0.26, c.pants, 0, -0.33, 0); box(P.legR, 0.26, 0.2, 0.34, c.boots, 0, -0.7, 0.03);
  P.torso = pivot(body, 0, 0.8, 0);
  box(P.torso, 0.56, 0.62, 0.32, c.coat, 0, 0.31, 0);
  if (c.apron) box(P.torso, 0.46, 0.5, 0.02, c.apron, 0, 0.22, -0.17);
  if (c.sash) { box(P.torso, 0.58, 0.1, 0.34, 0xc8282e, 0, 0.06, 0); box(P.torso, 0.58, 0.03, 0.35, 0xf2c12e, 0, 0.06, 0); box(P.torso, 0.06, 0.26, 0.04, 0x1f4fa8, 0.18, -0.08, -0.18); box(P.torso, 0.06, 0.22, 0.04, 0xc8282e, 0.24, -0.06, -0.18); }
  P.head = pivot(P.torso, 0, 0.62, 0);
  box(P.head, 0.42, 0.42, 0.42, c.skin, 0, 0.22, 0);
  box(P.head, 0.07, 0.07, 0.02, 0x1a1a1a, -0.1, 0.24, -0.215); box(P.head, 0.07, 0.07, 0.02, 0x1a1a1a, 0.1, 0.24, -0.215);
  if (c.zombie) { box(P.head, 0.07, 0.03, 0.02, 0xd03030, -0.1, 0.29, -0.216); box(P.head, 0.07, 0.03, 0.02, 0xd03030, 0.1, 0.29, -0.216); box(P.head, 0.2, 0.05, 0.02, 0x3a2a2a, 0, 0.1, -0.215); }
  if (c.glasses) { box(P.head, 0.36, 0.03, 0.02, 0x222222, 0, 0.27, -0.222); box(P.head, 0.12, 0.1, 0.02, 0xa0d0f0, -0.1, 0.24, -0.223); box(P.head, 0.12, 0.1, 0.02, 0xa0d0f0, 0.1, 0.24, -0.223); }
  if (c.beard) box(P.head, 0.44, 0.18, 0.1, c.beard, 0, 0.06, -0.19);
  box(P.head, 0.44, 0.1, 0.44, c.hair, 0, 0.04 + 0.38, 0.02);
  if (c.hatType === 'tuque') { box(P.head, 0.46, 0.2, 0.46, c.hat, 0, 0.5, 0); box(P.head, 0.47, 0.07, 0.47, c.hatBand, 0, 0.41, 0); box(P.head, 0.36, 0.1, 0.36, c.hat, 0, 0.63, 0); box(P.head, 0.14, 0.14, 0.14, c.pom, 0, 0.74, 0); }
  else if (c.hatType === 'kepi') { box(P.head, 0.46, 0.18, 0.46, c.hat, 0, 0.5, 0); box(P.head, 0.46, 0.04, 0.16, 0x111111, 0, 0.42, -0.28); }
  else if (c.hatType === 'bun') { box(P.head, 0.22, 0.2, 0.2, c.hair, 0, 0.55, 0.12); }
  else if (c.hatType === 'casque') { box(P.head, 0.5, 0.18, 0.5, 0xf2c12e, 0, 0.5, 0); box(P.head, 0.56, 0.04, 0.56, 0xf2c12e, 0, 0.42, 0); }
  else if (c.hatType === 'filet') { box(P.head, 0.46, 0.12, 0.46, 0xe8e8f0, 0, 0.46, 0); }
  P.armL = pivot(P.torso, -0.37, 0.56, 0); box(P.armL, 0.18, 0.56, 0.22, c.coat, 0, -0.26, 0); box(P.armL, 0.2, 0.16, 0.24, c.zombie ? c.skin : c.mitt, 0, -0.58, 0);
  P.armR = pivot(P.torso, 0.37, 0.56, 0); box(P.armR, 0.18, 0.56, 0.22, c.coat, 0, -0.26, 0); box(P.armR, 0.2, 0.16, 0.24, c.zombie ? c.skin : c.mitt, 0, -0.58, 0);
  P.hand = pivot(P.armR, 0, -0.6, 0);
  g.scale.setScalar(c.scale);
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
  }
  return g;
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
  g.rotation.z = 0; return g;
}

// ---------- ennemis ----------
export function enemyModel(type) {
  const g = new THREE.Group(), P = {}; let kind = type;
  if (type === 'cone' || type === 'supreme') {
    const s = type === 'supreme' ? 2.4 : 1;
    const body = pivot(g, 0, 0, 0); P.body = body;
    box(body, 0.9, 0.12, 0.9, 0x222222, 0, 0.06, 0);
    const lay = [[0.72, 0xff7a1a], [0.6, 0xf2f2f2], [0.5, 0xff7a1a], [0.4, 0xf2f2f2], [0.3, 0xff7a1a], [0.2, 0xff7a1a]];
    lay.forEach(([w, c], i) => box(body, w, 0.26, w, c, 0, 0.25 + i * 0.26, 0));
    box(body, 0.08, 0.1, 0.02, 0x111111, -0.12, 0.92, -0.26); box(body, 0.08, 0.1, 0.02, 0x111111, 0.12, 0.92, -0.26);
    box(body, 0.22, 0.04, 0.02, 0x111111, 0, 0.78, -0.31);
    P.armL = pivot(body, -0.42, 0.7, 0); box(P.armL, 0.16, 0.5, 0.16, 0xff7a1a, 0, -0.25, 0);
    P.armR = pivot(body, 0.42, 0.7, 0); box(P.armR, 0.16, 0.5, 0.16, 0xff7a1a, 0, -0.25, 0);
    if (type === 'supreme') { box(body, 0.34, 0.1, 0.34, 0xe8c040, 0, 1.86, 0); for (const [x, z] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) box(body, 0.06, 0.14, 0.06, 0xe8c040, x, 1.97, z); box(body, 0.06, 0.06, 0.02, 0xff2020, 0, 1.86, -0.18, true); }
    g.scale.setScalar(s); kind = 'cone';
  } else if (type === 'bureau') {
    const m = human({ skin: 0x9fb88a, coat: 0x5a5f6a, pants: 0x3a3e48, boots: 0x111111, hatType: 'none', hair: 0x3a3a3a, mitt: 0x9fb88a, sash: false, glasses: true, zombie: true });
    box(m.P.torso, 0.08, 0.36, 0.02, 0xb02020, 0, 0.36, -0.17);
    box(m.P.hand, 0.3, 0.02, 0.4, 0xf8f8f0, 0, -0.06, -0.12); box(m.P.hand, 0.2, 0.025, 0.02, 0x2040a0, 0, -0.045, -0.2);
    m.g.userData = m; return { g: m.g, P: m.P, m, kind: 'human' };
  } else if (type === 'plow') {
    const body = pivot(g, 0, 0, 0); P.body = body;
    box(body, 1.6, 0.9, 2.6, 0xf28a1a, 0, 0.85, 0.2); box(body, 1.4, 0.8, 1.0, 0xf28a1a, 0, 1.7, -0.3);
    box(body, 1.42, 0.45, 0.04, 0x8fd0ff, 0, 1.8, -0.82, false);
    box(body, 0.06, 0.06, 0.02, 0x111111, -0.3, 1.85, -0.85); box(body, 0.06, 0.06, 0.02, 0x111111, 0.3, 1.85, -0.85);
    box(body, 0.5, 0.06, 0.02, 0x111111, 0, 1.68, -0.85);
    P.blade = pivot(body, 0, 0.55, -1.35); box(P.blade, 2.4, 0.7, 0.12, 0xc9ced6, 0, 0, 0); box(P.blade, 2.4, 0.08, 0.14, 0xff7a1a, 0, 0.3, 0);
    for (const [x, z] of [[-0.82, -0.5], [0.82, -0.5], [-0.82, 0.9], [0.82, 0.9]]) box(body, 0.3, 0.6, 0.6, 0x161616, x, 0.3, z);
    P.light = box(body, 0.3, 0.2, 0.3, 0xffa020, 0, 2.2, -0.3, true);
    box(body, 0.9, 0.04, 0.6, 0xf2f2f2, 0, 1.0, 1.5);
  } else if (type === 'raton') {
    const body = pivot(g, 0, 0, 0); P.body = body;
    box(body, 0.5, 0.42, 0.8, 0x7d7a74, 0, 0.42, 0);
    P.head = pivot(body, 0, 0.55, -0.48); box(P.head, 0.42, 0.36, 0.36, 0x8d8a84, 0, 0, 0); box(P.head, 0.44, 0.12, 0.3, 0x1a1a1a, 0, 0.04, -0.04);
    box(P.head, 0.07, 0.07, 0.02, 0xffffff, -0.1, 0.05, -0.19); box(P.head, 0.07, 0.07, 0.02, 0xffffff, 0.1, 0.05, -0.19);
    box(P.head, 0.14, 0.12, 0.16, 0xd8d4cc, 0, -0.08, -0.22); box(P.head, 0.06, 0.05, 0.03, 0x111111, 0, -0.04, -0.31);
    box(P.head, 0.1, 0.12, 0.06, 0x5a5854, -0.15, 0.24, 0); box(P.head, 0.1, 0.12, 0.06, 0x5a5854, 0.15, 0.24, 0);
    P.tail = pivot(body, 0, 0.5, 0.4); for (let i = 0; i < 5; i++) box(P.tail, 0.16, 0.16, 0.14, i % 2 ? 0x1a1a1a : 0x9d9a94, 0, 0.04 * i, 0.07 + i * 0.13);
    for (const [x, z] of [[-0.18, -0.28], [0.18, -0.28], [-0.18, 0.28], [0.18, 0.28]]) box(body, 0.12, 0.24, 0.12, 0x3a3a3a, x, 0.12, z);
    P.poutine = pivot(body, 0, 0.75, -0.2); box(P.poutine, 0.3, 0.16, 0.24, 0xf2f2f2, 0, 0, 0); box(P.poutine, 0.26, 0.08, 0.2, 0xe8b84a, 0, 0.1, 0); box(P.poutine, 0.12, 0.04, 0.1, 0x7a4a22, 0.03, 0.15, 0.02); box(P.poutine, 0.06, 0.05, 0.06, 0xfaf6e0, -0.06, 0.15, -0.04);
  } else if (type === 'mouches') {
    P.flies = []; for (let i = 0; i < 18; i++) { const f = box(g, 0.08, 0.06, 0.1, 0x101010, 0, 0, 0); f.userData.ph = Math.random() * 6.28; f.userData.r = 0.3 + Math.random() * 0.7; P.flies.push(f); }
  } else if (type === 'trou') {
    const body = pivot(g, 0, 0, 0); P.body = body;
    box(body, 2.0, 0.08, 2.0, 0x4a4c50, 0, 0.04, 0); box(body, 1.5, 0.1, 1.5, 0x0a0a0a, 0, 0.06, 0);
    P.jaw = pivot(body, 0, 0.08, 0);
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; const t = box(P.jaw, 0.14, 0.26, 0.14, 0xf2f0e0, Math.cos(a) * 0.7, 0.1, Math.sin(a) * 0.7); t.rotation.y = -a; }
    P.eyes = pivot(body, 0, 0.2, 0); box(P.eyes, 0.14, 0.14, 0.14, 0xffe030, -0.3, 0, -0.1, true); box(P.eyes, 0.14, 0.14, 0.14, 0xffe030, 0.3, 0, -0.1, true);
  }
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
  return g;
}

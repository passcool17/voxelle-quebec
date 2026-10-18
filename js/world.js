// Gestion des tronçons côté fil principal : demandes au Worker, maillages Three.js (deux niveaux de détail),
// données fines pour les collisions et le lancer de rayon. Coordonnées publiques en mètres ; voxels de VS m.
import * as THREE from 'three';
import { CS, WH, B, SOLID, LEAF, VS, IVS, CSM, WHM } from './blocks.js';
import { terrainMaterial, waterMaterial } from './materials.js';
export class World {
  constructor(scene, gen, seed, edits) {
    this.scene = scene; this.gen = gen; this.seed = seed; this.edits = edits || {}; this.chunks = new Map(); this.pending = new Set(); this.view = 6;
    this.lod0 = 3; this.shadows = false;
    this.group = new THREE.Group(); scene.add(this.group);
    this.matOp = terrainMaterial();
    this.matWa = waterMaterial();
    this.matGl = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    this.ready = false; this.onChunk = null; this.inflight = 0;
    this.worker.onmessage = e => this.msg(e.data);
    this.worker.onerror = e => { console.error('worker: ' + e.message); };
    const pack = {}; for (const k in this.edits) { const o = this.edits[k], a = []; for (const i in o) a.push(+i, o[i]); pack[k] = a; }
    this.worker.postMessage({ t: 'init', seed, edits: pack });
    this.stats = { tri: 0, meshes: 0 };
  }
  key(cx, cz) { return cx + ',' + cz; }
  setShadows(on) { this.shadows = on; for (const [, c] of this.chunks) for (const m of c.meshes) if (m.material === this.matOp) { m.castShadow = on; m.receiveShadow = on; } }
  msg(q) {
    if (q.t === 'ready') { this.ready = true; return; }
    const k = this.key(q.cx, q.cz);
    if (q.t === 'chunk') { this.inflight--; this.pending.delete(k); }
    let c = this.chunks.get(k);
    if (!c) { if (q.t !== 'chunk') return; c = { cx: q.cx, cz: q.cz, meshes: [], lod: q.lod }; this.chunks.set(k, c); }
    if (q.t === 'mesh' && c.want != null && q.lod !== c.want) return; // réponse périmée
    if (q.data) c.data = q.data;
    c.lod = q.lod; c.want = null; c.top = q.top; c.hm = q.hm;
    for (const m of c.meshes) { this.group.remove(m); m.geometry.dispose(); } c.meshes = [];
    for (const [name, mat] of [['op', this.matOp], ['wa', this.matWa], ['gl', this.matGl]]) {
      const d = q.m[name]; if (!d.idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(d.nor, 3, true));
      g.setAttribute('color', new THREE.BufferAttribute(d.col, 3, true));
      g.setAttribute('tex', new THREE.BufferAttribute(d.tex, 1, true));
      g.setIndex(new THREE.BufferAttribute(d.idx, 1));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat); mesh.scale.setScalar(VS); mesh.position.set(q.cx * CSM, 0, q.cz * CSM); mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      if (name === 'wa') mesh.renderOrder = 2;
      if (name === 'op' && this.shadows) { mesh.castShadow = q.lod === 0; mesh.receiveShadow = true; }
      this.group.add(mesh); c.meshes.push(mesh);
    }
    if (this.onChunk) this.onChunk(c);
  }
  update(px, pz, maxInflight = 3) {
    if (!this.ready) return;
    const pcx = Math.floor(px / CSM), pcz = Math.floor(pz / CSM), R = this.view, L = this.lod0;
    let remesh = 0;
    for (const [k, c] of this.chunks) {
      const d = Math.hypot(c.cx - pcx, c.cz - pcz);
      if (d > R + 2.5) { for (const m of c.meshes) { this.group.remove(m); m.geometry.dispose(); } this.chunks.delete(k); continue; }
      // changement de niveau de détail (avec hystérésis)
      if (c.want == null && remesh < 2) {
        const want = this.lodFor(d, c.lod);
        if (want !== c.lod) { c.want = want; remesh++; this.worker.postMessage({ t: 'remesh', cx: c.cx, cz: c.cz, lod: want }); }
      }
    }
    while (this.inflight < maxInflight) {
      let best = null, bd = 1e9;
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dz); if (d > R + 0.5 || d >= bd) continue;
        const k = this.key(pcx + dx, pcz + dz); if (this.chunks.has(k) || this.pending.has(k)) continue;
        bd = d; best = [pcx + dx, pcz + dz, k];
      }
      if (!best) break;
      this.pending.add(best[2]); this.inflight++; this.worker.postMessage({ t: 'chunk', cx: best[0], cz: best[1], lod: this.lodFor(bd, -1) });
    }
  }
  // niveau voulu selon la distance (en tronçons), avec hystérésis autour du niveau actuel
  lodFor(d, cur) {
    const T = [this.lod0 + 0.5, this.lod0 + 2.6], base = d <= T[0] ? 0 : d <= T[1] ? 1 : 2;
    if (cur < 0 || cur === base) return base;
    const lo = cur === 0 ? -1 : T[cur - 1], hi = cur === 2 ? 1e9 : T[cur];
    return d >= lo - 0.7 && d <= hi + 0.7 ? cur : base;
  }
  triangles() { let t = 0; for (const [, c] of this.chunks) for (const m of c.meshes) t += m.geometry.index.count / 3; return t; }
  loadedAround(x, z, r = 1) { const cx = Math.floor(x / CSM), cz = Math.floor(z / CSM); for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const c = this.chunks.get(this.key(cx + a, cz + b)); if (!c || !c.data) return false; } return true; }
  loadedFrac() { let n = 0, t = 0; const R = this.view; for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) if (Math.hypot(dx, dz) <= R + 0.5) t++; return Math.min(1, this.chunks.size / t); }
  // accès en voxels
  getV(x, y, z) {
    if (y < 0) return B.BEDROCK; if (y >= WH) return 0;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS), c = this.chunks.get(cx + ',' + cz);
    if (!c || !c.data) return -1;
    return c.data[(x - cx * CS) + (z - cz * CS) * CS + y * CS * CS];
  }
  solidV(x, y, z) { const b = this.getV(x, y, z); return b < 0 ? 1 : SOLID[b]; }
  // accès en mètres
  get(x, y, z) { return this.getV(Math.floor(x * IVS), Math.floor(y * IVS), Math.floor(z * IVS)); }
  solid(x, y, z) { const b = this.get(x, y, z); return b < 0 ? 1 : SOLID[b]; }
  set(x, y, z, b) {
    x = Math.floor(x * IVS + 1e-6); y = Math.floor(y * IVS + 1e-6); z = Math.floor(z * IVS + 1e-6); if (y < 1 || y >= WH) return false;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS), k = cx + ',' + cz, c = this.chunks.get(k); if (!c || !c.data) return false;
    const i = (x - cx * CS) + (z - cz * CS) * CS + y * CS * CS; c.data[i] = b;
    (this.edits[k] || (this.edits[k] = {}))[i] = b;
    const loaded = {}; for (const [kk, cc] of this.chunks) loaded[kk] = cc.want != null ? cc.want : cc.lod;
    this.worker.postMessage({ t: 'set', x, y, z, b, loaded });
    return true;
  }
  // surface (en mètres) la plus haute, hors feuillage, sous y0
  ground(x, z, y0 = WHM - 1) {
    const vx = Math.floor(x * IVS), vz = Math.floor(z * IVS);
    for (let y = Math.min(WH - 1, Math.floor(y0 * IVS)); y > 0; y--) { const b = this.getV(vx, y, vz); if (b < 0) return this.gen.heightAt(x, z) + 1; if (b === B.WATER || (SOLID[b] && !LEAF[b])) return (y + 1) * VS; }
    return VS;
  }
  // lancer de rayon voxel (DDA) ; o, d en mètres. Renvoie le coin du voxel (m), la normale (±VS), t (m).
  ray(o, d, max) {
    const ox = o.x * IVS, oy = o.y * IVS, oz = o.z * IVS, M = max * IVS;
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
    const tdx = Math.abs(1 / d.x), tdy = Math.abs(1 / d.y), tdz = Math.abs(1 / d.z);
    let tx = (sx > 0 ? x + 1 - ox : ox - x) * tdx, ty = (sy > 0 ? y + 1 - oy : oy - y) * tdy, tz = (sz > 0 ? z + 1 - oz : oz - z) * tdz;
    let n = [0, 0, 0], t = 0;
    for (let i = 0; i < 512 && t <= M; i++) {
      const b = this.getV(x, y, z);
      if (b > 0 && b !== B.WATER) return { x: x * VS, y: y * VS, z: z * VS, n: n.map(v => v * VS), b, t: t * VS };
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; }
      else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; }
    }
    return null;
  }
}
// Collisions boîte englobante (mètres) contre les voxels fins, avec montée automatique jusqu'à un mètre
export function boxHit(w, x, y, z, hw, h) {
  const x0 = Math.floor((x - hw) * IVS), x1 = Math.floor((x + hw - 0.001) * IVS), y0 = Math.floor(y * IVS), y1 = Math.floor((y + h - 0.001) * IVS), z0 = Math.floor((z - hw) * IVS), z1 = Math.floor((z + hw - 0.001) * IVS);
  for (let by = y0; by <= y1; by++) for (let bz = z0; bz <= z1; bz++) for (let bx = x0; bx <= x1; bx++) if (w.solidV(bx, by, bz)) return true;
  return false;
}
const fl = v => Math.floor(v * IVS) * VS;
export function moveBody(w, e, dt, stepUp = true) {
  const hw = e.hw, h = e.h; let hitWall = false;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(e.vx), Math.abs(e.vy), Math.abs(e.vz)) * dt / 0.25));
  const sd = dt / steps; const wasGround = e.ground; e.ground = false;
  for (let s = 0; s < steps; s++) {
    let ny = e.y + e.vy * sd;
    if (boxHit(w, e.x, ny, e.z, hw, h)) { if (e.vy < 0) { ny = fl(ny) + VS; e.ground = true; } else ny = fl(ny + h) - h - 0.001; if (boxHit(w, e.x, ny, e.z, hw, h)) ny = e.y; e.vy = 0; }
    e.y = ny;
    for (const ax of ['x', 'z']) {
      const v = ax === 'x' ? e.vx : e.vz; if (!v) continue;
      const nx = ax === 'x' ? e.x + v * sd : e.x, nz = ax === 'z' ? e.z + v * sd : e.z;
      if (!boxHit(w, nx, e.y, nz, hw, h)) { e.x = nx; e.z = nz; continue; }
      // marche automatique : un ou deux voxels (≤ 1 m), aussi en l'air près d'un rebord
      let stepped = false;
      if (stepUp && (wasGround || e.ground || e.vy < 3)) for (let sy = fl(e.y + 0.02) + VS; sy - e.y <= 1.05; sy += VS) {
        if (!boxHit(w, nx, sy, nz, hw, h) && !boxHit(w, e.x, sy, e.z, hw, h)) { e.stepOff = (e.stepOff || 0) + (sy - e.y); e.y = sy; e.x = nx; e.z = nz; if (e.vy < 0) e.vy = 0; stepped = true; break; }
      }
      if (stepped) continue;
      hitWall = true;
      if (ax === 'x') { const fx = v > 0 ? fl(nx + hw) - hw - 0.001 : fl(nx - hw) + VS + hw + 0.001; if (!boxHit(w, fx, e.y, e.z, hw, h)) e.x = fx; e.vx = 0; }
      else { const fz = v > 0 ? fl(nz + hw) - hw - 0.001 : fl(nz - hw) + VS + hw + 0.001; if (!boxHit(w, e.x, e.y, fz, hw, h)) e.z = fz; e.vz = 0; }
    }
  }
  if (!e.ground && e.vy <= 0 && boxHit(w, e.x, e.y - 0.05, e.z, hw * 0.95, 0.05)) e.ground = true;
  e.hitWall = hitWall;
}

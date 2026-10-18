// Gestion des tronçons côté fil principal : demandes au Worker, maillages Three.js, données pour collisions, lancer de rayon.
import * as THREE from 'three';
import { CS, WH, B, SOLID, LEAF } from './blocks.js';
export class World {
  constructor(scene, gen, seed, edits) {
    this.scene = scene; this.gen = gen; this.seed = seed; this.edits = edits || {}; this.chunks = new Map(); this.pending = new Set(); this.view = 6;
    this.group = new THREE.Group(); scene.add(this.group);
    this.matOp = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.matWa = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false });
    this.matGl = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    this.ready = false; this.onChunk = null; this.inflight = 0;
    this.worker.onmessage = e => this.msg(e.data);
    this.worker.onerror = e => { console.error('worker: ' + e.message); };
    const pack = {}; for (const k in this.edits) { const o = this.edits[k], a = []; for (const i in o) a.push(+i, o[i]); pack[k] = a; }
    this.worker.postMessage({ t: 'init', seed, edits: pack });
  }
  key(cx, cz) { return cx + ',' + cz; }
  msg(q) {
    if (q.t === 'ready') { this.ready = true; return; }
    const k = this.key(q.cx, q.cz);
    if (q.t === 'chunk') { this.inflight--; this.pending.delete(k); }
    let c = this.chunks.get(k);
    if (!c) { if (q.t !== 'chunk') return; c = { cx: q.cx, cz: q.cz, meshes: [] }; this.chunks.set(k, c); }
    if (q.data) c.data = q.data;
    c.top = q.top; c.hm = q.hm;
    for (const m of c.meshes) { this.group.remove(m); m.geometry.dispose(); } c.meshes = [];
    for (const [name, mat] of [['op', this.matOp], ['wa', this.matWa], ['gl', this.matGl]]) {
      const d = q.m[name]; if (!d.idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(d.nor, 3, true));
      g.setAttribute('color', new THREE.BufferAttribute(d.col, 3, true));
      g.setIndex(new THREE.BufferAttribute(d.idx, 1));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat); mesh.position.set(q.cx * CS, 0, q.cz * CS); mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      if (name === 'wa') mesh.renderOrder = 2;
      this.group.add(mesh); c.meshes.push(mesh);
    }
    if (this.onChunk) this.onChunk(c);
  }
  update(px, pz, maxInflight = 3) {
    if (!this.ready) return;
    const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS), R = this.view;
    for (const [k, c] of this.chunks) if (Math.hypot(c.cx - pcx, c.cz - pcz) > R + 2.5) { for (const m of c.meshes) { this.group.remove(m); m.geometry.dispose(); } this.chunks.delete(k); }
    while (this.inflight < maxInflight) {
      let best = null, bd = 1e9;
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dz); if (d > R + 0.5 || d >= bd) continue;
        const k = this.key(pcx + dx, pcz + dz); if (this.chunks.has(k) || this.pending.has(k)) continue;
        bd = d; best = [pcx + dx, pcz + dz, k];
      }
      if (!best) break;
      this.pending.add(best[2]); this.inflight++; this.worker.postMessage({ t: 'chunk', cx: best[0], cz: best[1] });
    }
  }
  loadedAround(x, z, r = 1) { const cx = Math.floor(x / CS), cz = Math.floor(z / CS); for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const c = this.chunks.get(this.key(cx + a, cz + b)); if (!c || !c.data) return false; } return true; }
  loadedFrac() { let n = 0, t = 0; const R = this.view; for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) if (Math.hypot(dx, dz) <= R + 0.5) t++; return Math.min(1, this.chunks.size / t); }
  get(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0) return B.BEDROCK; if (y >= WH) return 0;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS), c = this.chunks.get(cx + ',' + cz);
    if (!c || !c.data) return -1;
    return c.data[(x - cx * CS) + (z - cz * CS) * CS + y * CS * CS];
  }
  solid(x, y, z) { const b = this.get(x, y, z); return b < 0 ? 1 : SOLID[b]; }
  set(x, y, z, b) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z); if (y < 1 || y >= WH) return false;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS), k = cx + ',' + cz, c = this.chunks.get(k); if (!c || !c.data) return false;
    const i = (x - cx * CS) + (z - cz * CS) * CS + y * CS * CS; c.data[i] = b;
    (this.edits[k] || (this.edits[k] = {}))[i] = b;
    this.worker.postMessage({ t: 'set', x, y, z, b, loaded: [...this.chunks.keys()] });
    return true;
  }
  // sol le plus haut (hors feuillage) sous y0
  ground(x, z, y0 = WH - 1) {
    for (let y = Math.min(WH - 1, Math.floor(y0)); y > 0; y--) { const b = this.get(x, y, z); if (b < 0) return this.gen.heightAt(x, z) + 1; if (b === B.WATER || (SOLID[b] && !LEAF[b])) return y + 1; }
    return 1;
  }
  // lancer de rayon voxel (DDA)
  ray(o, d, max) {
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
    const tdx = Math.abs(1 / d.x), tdy = Math.abs(1 / d.y), tdz = Math.abs(1 / d.z);
    let tx = (sx > 0 ? x + 1 - o.x : o.x - x) * tdx, ty = (sy > 0 ? y + 1 - o.y : o.y - y) * tdy, tz = (sz > 0 ? z + 1 - o.z : o.z - z) * tdz;
    let n = [0, 0, 0], t = 0;
    for (let i = 0; i < 256 && t <= max; i++) {
      const b = this.get(x, y, z);
      if (b > 0 && b !== B.WATER) return { x, y, z, n, b, t };
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; }
      else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; }
    }
    return null;
  }
}
// Collisions boîte englobante contre les voxels, avec montée automatique d'un bloc
export function boxHit(w, x, y, z, hw, h) {
  for (let by = Math.floor(y); by <= Math.floor(y + h - 0.001); by++) for (let bz = Math.floor(z - hw); bz <= Math.floor(z + hw - 0.001); bz++) for (let bx = Math.floor(x - hw); bx <= Math.floor(x + hw - 0.001); bx++) if (w.solid(bx, by, bz)) return true;
  return false;
}
export function moveBody(w, e, dt, stepUp = true) {
  const hw = e.hw, h = e.h; let hitWall = false;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(e.vx), Math.abs(e.vy), Math.abs(e.vz)) * dt / 0.4));
  const sd = dt / steps; const wasGround = e.ground; e.ground = false;
  for (let s = 0; s < steps; s++) {
    let ny = e.y + e.vy * sd;
    if (boxHit(w, e.x, ny, e.z, hw, h)) { if (e.vy < 0) { ny = Math.floor(ny) + 1; e.ground = true; } else ny = Math.floor(ny + h) - h - 0.001; if (boxHit(w, e.x, ny, e.z, hw, h)) ny = e.y; e.vy = 0; }
    e.y = ny;
    for (const ax of ['x', 'z']) {
      const v = ax === 'x' ? e.vx : e.vz; if (!v) continue;
      const nx = ax === 'x' ? e.x + v * sd : e.x, nz = ax === 'z' ? e.z + v * sd : e.z;
      if (!boxHit(w, nx, e.y, nz, hw, h)) { e.x = nx; e.z = nz; continue; }
      // marche automatique : un bloc, aussi en l'air si les pieds sont près du rebord (escalade légère)
      const sy = Math.floor(e.y + 0.02) + 1;
      if (stepUp && sy - e.y <= 1.05 && (wasGround || e.ground || e.vy < 3) && !boxHit(w, nx, sy, nz, hw, h) && !boxHit(w, e.x, sy, e.z, hw, h)) { e.stepOff = (e.stepOff || 0) + (sy - e.y); e.y = sy; e.x = nx; e.z = nz; if (e.vy < 0) e.vy = 0; continue; }
      hitWall = true;
      if (ax === 'x') { const fx = v > 0 ? Math.floor(nx + hw) - hw - 0.001 : Math.floor(nx - hw) + 1 + hw + 0.001; if (!boxHit(w, fx, e.y, e.z, hw, h)) e.x = fx; e.vx = 0; }
      else { const fz = v > 0 ? Math.floor(nz + hw) - hw - 0.001 : Math.floor(nz - hw) + 1 + hw + 0.001; if (!boxHit(w, e.x, e.y, fz, hw, h)) e.z = fz; e.vz = 0; }
    }
  }
  if (!e.ground && e.vy <= 0 && boxHit(w, e.x, e.y - 0.05, e.z, hw * 0.95, 0.05)) e.ground = true;
  e.hitWall = hitWall;
}

// Ambiance : lucioles la nuit (campagne, forêts), feuilles qui tombent dans les érablières et forêts, poussière des pas.
// Deux nuages de points réutilisés (pas d'allocation par image), centrés sur le joueur.
import * as THREE from 'three';
export class Ambiance {
  constructor(scene, mobile) {
    const mk = (n, size, blend, cols) => { const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), g = new THREE.BufferGeometry();
      for (let i = 0; i < n; i++) { pos.set([(Math.random() - 0.5) * 36, Math.random() * 8, (Math.random() - 0.5) * 36], i * 3); const c = new THREE.Color(cols[(Math.random() * cols.length) | 0]); col.set([c.r, c.g, c.b], i * 3); }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const m = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: blend, sizeAttenuation: true });
      const p = new THREE.Points(g, m); p.frustumCulled = false; p.visible = false; scene.add(p); return { p, m, A: pos, ph: Float32Array.from({ length: n }, () => Math.random() * 6.28) }; };
    this.fly = mk(mobile ? 30 : 60, 0.22, THREE.AdditiveBlending, [0xd8ff6a, 0xfff07a, 0xb8ff8a]);
    this.leaf = mk(mobile ? 40 : 90, 0.2, THREE.NormalBlending, [0xd8481e, 0xe8902a, 0xf2c12e, 0xb02a14]);
    this.flyA = 0; this.leafA = 0;
  }
  // night 0..1, forest : feuillus/conifères autour, maple : érablière (feuilles rouges)
  update(dt, P, t, night, forest, maple, weather) {
    const tf = night * (forest ? 1 : 0.5) * (1 - weather), tl = (maple ? 1 : forest ? 0.35 : 0) * (1 - night * 0.5);
    this.flyA += (tf - this.flyA) * Math.min(1, dt * 0.6); this.leafA += (tl - this.leafA) * Math.min(1, dt * 0.6);
    for (const [S, a, fall] of [[this.fly, this.flyA, false], [this.leaf, this.leafA, true]]) {
      S.p.visible = a > 0.02; if (!S.p.visible) continue; S.m.opacity = a * (fall ? 0.95 : 0.9 * (0.6 + 0.4 * Math.sin(t * 3)));
      S.p.position.set(Math.floor(P.x / 36) * 36, P.y - 1, Math.floor(P.z / 36) * 36); const A = S.A;
      for (let i = 0, k = 0; i < A.length; i += 3, k++) { const ph = S.ph[k];
        if (fall) { A[i + 1] -= dt * (0.7 + (k % 5) * 0.12); A[i] += Math.sin(t * 1.7 + ph) * dt * 0.9; A[i + 2] += Math.cos(t * 1.3 + ph) * dt * 0.6; if (A[i + 1] < 0) A[i + 1] += 9; }
        else { A[i] += Math.sin(t * 0.7 + ph) * dt * 0.6; A[i + 1] = 0.6 + 1.6 * (0.5 + 0.5 * Math.sin(t * 0.5 + ph * 2)); A[i + 2] += Math.cos(t * 0.6 + ph) * dt * 0.6; }
        // garder les points autour du joueur (tuile de 36 m)
        const wx = A[i] + S.p.position.x - P.x, wz = A[i + 2] + S.p.position.z - P.z; if (wx > 18) A[i] -= 36; else if (wx < -18) A[i] += 36; if (wz > 18) A[i + 2] -= 36; else if (wz < -18) A[i + 2] += 36; }
      S.p.geometry.attributes.position.needsUpdate = true; }
  }
}

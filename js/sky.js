// Ciel : dôme dégradé, soleil, lune, étoiles, aurores boréales, nuages voxel, neige.
import * as THREE from 'three';
import { smooth } from './noise.js';
const C = (h) => new THREE.Color(h);
const DAY_TOP = C(0x3f86e0), DAY_HOR = C(0xc4e2ff), SET_HOR = C(0xff9a5a), SET_TOP = C(0x5a5aa8), NIGHT_TOP = C(0x020512), NIGHT_HOR = C(0x0b1838), SNOW_HOR = C(0xc8d0d8), SNOW_TOP = C(0x8f9aa8);
export class Sky {
  constructor(scene, mobile) {
    this.scene = scene; this.t = 0.3; this.dayF = 1; this.snow = 0; this.snowT = 0; this.rain = 0; this.rainT = 0; this.flash = 0; this.thunder = 0; this.under = 0;
    this.u = { top: { value: C(0) }, hor: { value: C(0) }, sun: { value: new THREE.Vector3() }, dayF: { value: 1 } };
    const sm = new THREE.ShaderMaterial({ uniforms: this.u, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sun; uniform float dayF; varying vec3 vP;
        void main(){ float h = clamp(vP.y,-0.2,1.); vec3 c = mix(hor, top, pow(max(h,0.),0.5)); if(h<0.) c = mix(hor, hor*0.7, -h*5.);
          c = mix(c, hor * 1.06 + vec3(0.02), exp(-max(h, 0.) * 14.) * 0.45 * dayF);
          float s = max(dot(vP, normalize(sun)),0.); float up = step(-0.05,sun.y);
          c += vec3(1.,.9,.7)*smoothstep(0.9992,0.9996,s)*2.5*up + vec3(1.,.85,.6)*pow(s,600.)*1.6*up + vec3(1.,.78,.5)*pow(s,40.)*0.25*dayF;
          c += vec3(1.,.55,.28)*pow(s,6.)*0.32*(1.-abs(sun.y))*dayF*exp(-max(h,0.)*3.);
          vec3 m = -normalize(sun); float ms = max(dot(vP,m),0.); c += vec3(.9,.95,1.)*smoothstep(0.9993,0.9996,ms)*(1.-dayF);
          gl_FragColor = vec4(c,1.); }` });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(480, 24, 16), sm); this.dome.renderOrder = -10; this.dome.frustumCulled = false; scene.add(this.dome);
    // étoiles
    const sp = []; for (let i = 0; i < 900; i++) { const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 0.9 + 0.1, Math.random() * 2 - 1).normalize().multiplyScalar(450); sp.push(v.x, v.y, v.z); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: mobile ? 2 : 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.stars = new THREE.Points(sg, this.starMat); this.stars.renderOrder = -9; this.stars.frustumCulled = false; scene.add(this.stars);
    // aurores
    this.au = { t: { value: 0 }, a: { value: 0 } };
    const am = new THREE.ShaderMaterial({ uniforms: this.au, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying vec2 vUv; uniform float t; void main(){ vUv = uv; vec3 p = position; p.y += sin(uv.x*9.+t*0.4)*8.; p.z += sin(uv.x*5.+t*0.25)*25.; gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.); }',
      fragmentShader: `varying vec2 vUv; uniform float t; uniform float a;
        void main(){ float w = 0.5+0.5*sin(vUv.x*60.+t*1.3+sin(vUv.x*13.-t)*3.); w = pow(w,1.5)*0.8+0.2;
          float v = vUv.y; float band = smoothstep(0.,0.15,v)*(1.-smoothstep(0.35,1.,v));
          vec3 c = mix(vec3(0.15,1.,0.55), vec3(0.7,0.25,1.), smoothstep(0.3,0.9,v));
          float edge = smoothstep(0.,0.1,vUv.x)*smoothstep(1.,0.9,vUv.x);
          gl_FragColor = vec4(c*band*w*edge*a, 1.); }` });
    this.aurora = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const g = new THREE.PlaneGeometry(1, 1, 80, 1), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const u = p.getX(i) + 0.5, v = p.getY(i) + 0.5, ang = -1.2 + u * 2.4 + k * 0.5, R = 330 - k * 30; p.setXYZ(i, Math.sin(ang) * R, 70 + k * 12 + v * (90 + k * 15), -Math.cos(ang) * R * 0.8 - 40 * k); }
      g.computeBoundingSphere(); const m = new THREE.Mesh(g, am); m.frustumCulled = false; m.renderOrder = -8; this.aurora.add(m);
    }
    scene.add(this.aurora);
    // nuages voxel : amas de cubes de 3 m (une géométrie par nuage), dessous ombré
    this.clouds = new THREE.Group(); const cm = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.85, fog: true });
    for (let i = 0; i < (mobile ? 14 : 26); i++) { const c = new THREE.Mesh(cloudGeo(), cm); c.position.set((Math.random() - 0.5) * 500, Math.random() * 14, (Math.random() - 0.5) * 500); this.clouds.add(c); }
    this.cloudMat = cm; scene.add(this.clouds);
    // neige
    const N = mobile ? 700 : 1800, pos = new Float32Array(N * 3); for (let i = 0; i < N * 3; i++) pos[i] = (Math.random() - 0.5) * 50;
    const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: mobile ? 0.16 : 0.12, transparent: true, opacity: 0, depthWrite: false });
    this.snowPts = new THREE.Points(ng, this.snowMat); this.snowPts.frustumCulled = false; scene.add(this.snowPts);
    // pluie : traits verticaux autour de la caméra
    const RN = mobile ? 350 : 900, rp = new Float32Array(RN * 6);
    for (let i = 0; i < RN; i++) { const x = (Math.random() - 0.5) * 44, y = (Math.random() - 0.5) * 36, z = (Math.random() - 0.5) * 44; rp.set([x, y, z, x - 0.05, y - 0.9, z], i * 6); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: 0xa8c0d8, transparent: true, opacity: 0, depthWrite: false });
    this.rainL = new THREE.LineSegments(rg, this.rainMat); this.rainL.frustumCulled = false; this.rainL.visible = false; scene.add(this.rainL);
    // lumières
    this.sun = new THREE.DirectionalLight(0xffffff, 2); this.shadowR = 38; this.hemi = new THREE.HemisphereLight(0xbfe0ff, 0x5a4a30, 1); scene.add(this.sun, this.hemi, this.sun.target);
    this.fog = new THREE.Fog(0xc4e2ff, 60, 120); scene.fog = this.fog;
    this.top = C(0); this.hor = C(0);
  }
  update(dt, camPos, now, viewDist, snowLocal) {
    const a = (this.t - 0.25) * Math.PI * 2, el = Math.sin(a);
    const sd = new THREE.Vector3(Math.cos(a), el, 0.35).normalize(); this.u.sun.value.copy(sd);
    const dayF = smooth(-0.12, 0.18, el), setF = Math.max(0, 1 - Math.abs(el) / 0.35) * smooth(-0.2, 0.05, el);
    this.dayF = dayF; this.u.dayF.value = dayF;
    const tgt = Math.max(this.snowT, snowLocal ? snowLocal * Math.max(this.snowT, this.rainT, 0.85) : 0); this.snow += (tgt - this.snow) * Math.min(1, dt * 0.4);
    const rt = this.rainT * (1 - (snowLocal || 0)); this.rain += (rt - this.rain) * Math.min(1, dt * 0.4);
    this.flash = Math.max(0, this.flash - dt * 3); if (this.rain > 0.6 && Math.random() < dt * 0.05) { this.flash = 1; this.thunder = 1.2 + Math.random() * 1.5; }
    this.top.copy(NIGHT_TOP).lerp(DAY_TOP, dayF).lerp(SET_TOP, setF * 0.5); this.hor.copy(NIGHT_HOR).lerp(DAY_HOR, dayF).lerp(SET_HOR, setF * 0.7);
    const GRAY = C(0x7a8490).multiplyScalar(0.25 + dayF * 0.75), rn = this.rain * 0.7; this.top.lerp(GRAY, rn); this.hor.lerp(GRAY.clone().multiplyScalar(1.2), rn * 0.8);
    const sn = this.snow * 0.75; this.top.lerp(SNOW_TOP.clone().multiplyScalar(0.25 + dayF * 0.75), sn); this.hor.lerp(SNOW_HOR.clone().multiplyScalar(0.2 + dayF * 0.8), sn);
    this.u.top.value.copy(this.top); this.u.hor.value.copy(this.hor);
    // brume du matin (vers 5 h – 8 h) : brouillard plus proche et plus pâle
    const mist = Math.max(0, 1 - Math.abs(this.t - 0.27) / 0.07) * (1 - this.snow); this.mist = mist;
    this.fog.color.copy(this.hor).lerp(C(0xe8eef4).multiplyScalar(0.4 + dayF * 0.6), mist * 0.35); this.fog.far = viewDist * (1 - this.snow * 0.45 - this.rain * 0.3 - mist * 0.35); this.fog.near = this.fog.far * (0.38 - this.snow * 0.25);
    const U = this.under || 0; if (U > 0.001) { this.fog.color.lerp(C(0x0c0a08), U); this.fog.far += (34 - this.fog.far) * U; this.fog.near += (3 - this.fog.near) * U; }
    this.dome.position.copy(camPos); this.stars.position.copy(camPos); this.aurora.position.set(camPos.x, camPos.y * 0.3, camPos.z);
    this.starMat.opacity = (1 - dayF) * (1 - this.snow * 0.9) * 0.9; this.stars.rotation.y = now * 0.002;
    this.au.t.value = now; this.au.a.value = (1 - smooth(-0.25, 0.05, el)) * (1 - this.snow * 0.85) * 0.8; this.aurora.visible = this.au.a.value > 0.01;
    // lumière
    const moonUp = Math.max(0, -el);
    this.sun.position.set(camPos.x + sd.x * 100 * (el > 0 ? 1 : -1), camPos.y + Math.abs(sd.y) * 100 + 20, camPos.z + sd.z * 100);
    if (this.sun.castShadow) { const g = this.shadowR * 2 / this.sun.shadow.mapSize.x * 4; const tx = Math.round(camPos.x / g) * g, ty = Math.round(camPos.y / g) * g, tz = Math.round(camPos.z / g) * g;
      this.sun.position.set(tx + sd.x * 100 * (el > 0 ? 1 : -1), ty + Math.abs(sd.y) * 100 + 20, tz + sd.z * 100); this.sun.target.position.set(tx, ty, tz); }
    else this.sun.target.position.copy(camPos);
    this.sun.color.set(0xffffff).lerp(C(0xffb070), setF).lerp(C(0x8fa8ff), 1 - dayF);
    this.sun.intensity = (2.6 * dayF + 0.85 * moonUp * (1 - dayF)) * (1 - this.snow * 0.4 - this.rain * 0.45);
    this.hemi.intensity = 0.75 + 0.4 * dayF + this.flash * 2.5; this.hemi.color.copy(this.hor).lerp(C(0xffffff), 0.3); this.hemi.groundColor.set(0x4a3a28).multiplyScalar(0.4 + dayF * 0.6);
    if (U > 0.001) { this.sun.intensity *= 1 - U; this.hemi.intensity += (0.55 - this.hemi.intensity) * U; this.hemi.color.lerp(C(0xffc890), U); this.hemi.groundColor.lerp(C(0x3a2a1a), U); }
    // nuages
    this.clouds.position.set(0, 112, 0); this.cloudMat.color.set(0xffffff).lerp(this.hor, 0.25).multiplyScalar(0.35 + dayF * 0.65); this.cloudMat.opacity = 0.12 + 0.73 * dayF;
    for (const c of this.clouds.children) { c.position.x += dt * 2; if (c.position.x - camPos.x > 260) c.position.x -= 520; if (c.position.x - camPos.x < -260) c.position.x += 520; if (c.position.z - camPos.z > 260) c.position.z -= 520; if (c.position.z - camPos.z < -260) c.position.z += 520; }
    // neige
    this.snowMat.opacity = Math.min(1, this.snow * 1.3) * 0.9; this.snowPts.visible = this.snow > 0.02 && U < 0.5;
    if (this.snowPts.visible) { const p = this.snowPts.geometry.attributes.position, A = p.array; for (let i = 0; i < A.length; i += 3) { A[i + 1] -= dt * (2 + (i % 7) * 0.25); A[i] += Math.sin(now + i) * dt * 0.4; if (A[i + 1] < -20) A[i + 1] += 40; } p.needsUpdate = true; this.snowPts.position.set(Math.floor(camPos.x / 50) * 50, camPos.y, Math.floor(camPos.z / 50) * 50);
      // recadrer autour de la caméra
      for (let i = 0; i < A.length; i += 3) { const wx = A[i] + this.snowPts.position.x - camPos.x; if (wx > 25) A[i] -= 50; else if (wx < -25) A[i] += 50; const wz = A[i + 2] + this.snowPts.position.z - camPos.z; if (wz > 25) A[i + 2] -= 50; else if (wz < -25) A[i + 2] += 50; } }
    // pluie
    this.rainMat.opacity = Math.min(1, this.rain * 1.4) * 0.55; this.rainL.visible = this.rain > 0.02 && U < 0.5;
    if (this.rainL.visible) { const p = this.rainL.geometry.attributes.position, A = p.array, dy = dt * 24;
      for (let i = 0; i < A.length; i += 6) { A[i + 1] -= dy; A[i + 4] -= dy; if (A[i + 1] < -18) { A[i + 1] += 36; A[i + 4] += 36; } } p.needsUpdate = true; this.rainL.position.copy(camPos); }
    return { dayF, el };
  }
  setShadows(on, size) {
    const s = this.sun; s.castShadow = on; if (!on) return;
    if (s.shadow.map && s.shadow.mapSize.x !== size) { s.shadow.map.dispose(); s.shadow.map = null; }
    s.shadow.mapSize.set(size, size); const c = s.shadow.camera, R = this.shadowR; c.left = -R; c.right = R; c.top = R; c.bottom = -R; c.near = 1; c.far = 320; c.updateProjectionMatrix();
    s.shadow.bias = -0.0006; s.shadow.normalBias = 0.04;
  }
  clock() { const m = Math.floor(((this.t * 24) % 24) * 60); return String(Math.floor(m / 60)).padStart(2, '0') + ' h ' + String(m % 60).padStart(2, '0'); }
}

// géométrie d'un nuage : cubes de 3 m en amas, couleur plus sombre dessous
function cloudGeo() {
  const S = 3, cells = new Set(), n = 18 + Math.random() * 40 | 0, w = 3 + Math.random() * 5;
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, r = Math.random() * w; const x = Math.round(Math.cos(a) * r * 1.4), z = Math.round(Math.sin(a) * r), y = Math.random() < 0.3 && r < w * 0.6 ? 1 : 0; cells.add(x + ',' + y + ',' + z); if (y) cells.add(x + ',0,' + z); }
  const pos = [], nor = [], col = [], idx = [];
  const F = [[[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]], [[-1, 0, 0], [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]], [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]], [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]], [[0, 0, 1], [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]]], [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]]];
  for (const k of cells) { const [x, y, z] = k.split(',').map(Number);
    for (const [n, cs] of F) { if (cells.has((x + n[0]) + ',' + (y + n[1]) + ',' + (z + n[2]))) continue; const v0 = pos.length / 3;
      for (const c of cs) { pos.push((x + c[0]) * S * 1.6, (y + c[1]) * S * 0.9, (z + c[2]) * S * 1.6); nor.push(...n); const m = n[1] < 0 ? 0.72 : n[1] > 0 ? 1 : 0.88 - (1 - c[1]) * 0.08; col.push(m, m, m * 1.02); }
      idx.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeBoundingSphere(); return g;
}

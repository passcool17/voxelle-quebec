// Ciel : dôme dégradé, soleil, lune, étoiles, aurores boréales, nuages voxel, neige.
import * as THREE from 'three';
import { smooth } from './noise.js';
const C = (h) => new THREE.Color(h);
const DAY_TOP = C(0x3f86e0), DAY_HOR = C(0xc4e2ff), SET_HOR = C(0xff9a5a), SET_TOP = C(0x5a5aa8), NIGHT_TOP = C(0x020512), NIGHT_HOR = C(0x0b1838), SNOW_HOR = C(0xc8d0d8), SNOW_TOP = C(0x8f9aa8);
export class Sky {
  constructor(scene, mobile) {
    this.scene = scene; this.t = 0.3; this.dayF = 1; this.snow = 0; this.snowT = 0;
    this.u = { top: { value: C(0) }, hor: { value: C(0) }, sun: { value: new THREE.Vector3() }, dayF: { value: 1 } };
    const sm = new THREE.ShaderMaterial({ uniforms: this.u, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sun; uniform float dayF; varying vec3 vP;
        void main(){ float h = clamp(vP.y,-0.2,1.); vec3 c = mix(hor, top, pow(max(h,0.),0.55)); if(h<0.) c = mix(hor, hor*0.7, -h*5.);
          float s = max(dot(vP, normalize(sun)),0.); c += vec3(1.,.85,.6)*pow(s,400.)*2.0*step(-0.05,sun.y); c += vec3(1.,.6,.3)*pow(s,8.)*0.25*(1.-abs(sun.y))*dayF;
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
    // nuages voxel
    this.clouds = new THREE.Group(); const cm = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: true }), bg = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < (mobile ? 14 : 28); i++) { const c = new THREE.Mesh(bg, cm); c.scale.set(16 + Math.random() * 30, 4, 12 + Math.random() * 20); c.position.set((Math.random() - 0.5) * 500, 0, (Math.random() - 0.5) * 500); this.clouds.add(c); }
    this.cloudMat = cm; scene.add(this.clouds);
    // neige
    const N = mobile ? 700 : 1800, pos = new Float32Array(N * 3); for (let i = 0; i < N * 3; i++) pos[i] = (Math.random() - 0.5) * 50;
    const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: mobile ? 0.16 : 0.12, transparent: true, opacity: 0, depthWrite: false });
    this.snowPts = new THREE.Points(ng, this.snowMat); this.snowPts.frustumCulled = false; scene.add(this.snowPts);
    // lumières
    this.sun = new THREE.DirectionalLight(0xffffff, 2); this.hemi = new THREE.HemisphereLight(0xbfe0ff, 0x5a4a30, 1); scene.add(this.sun, this.hemi, this.sun.target);
    this.fog = new THREE.Fog(0xc4e2ff, 60, 120); scene.fog = this.fog;
    this.top = C(0); this.hor = C(0);
  }
  update(dt, camPos, now, viewDist, snowLocal) {
    const a = (this.t - 0.25) * Math.PI * 2, el = Math.sin(a);
    const sd = new THREE.Vector3(Math.cos(a), el, 0.35).normalize(); this.u.sun.value.copy(sd);
    const dayF = smooth(-0.12, 0.18, el), setF = Math.max(0, 1 - Math.abs(el) / 0.35) * smooth(-0.2, 0.05, el);
    this.dayF = dayF; this.u.dayF.value = dayF;
    const tgt = Math.max(this.snowT, snowLocal || 0); this.snow += (tgt - this.snow) * Math.min(1, dt * 0.4);
    this.top.copy(NIGHT_TOP).lerp(DAY_TOP, dayF).lerp(SET_TOP, setF * 0.5); this.hor.copy(NIGHT_HOR).lerp(DAY_HOR, dayF).lerp(SET_HOR, setF * 0.7);
    const sn = this.snow * 0.75; this.top.lerp(SNOW_TOP.clone().multiplyScalar(0.25 + dayF * 0.75), sn); this.hor.lerp(SNOW_HOR.clone().multiplyScalar(0.2 + dayF * 0.8), sn);
    this.u.top.value.copy(this.top); this.u.hor.value.copy(this.hor);
    this.fog.color.copy(this.hor); this.fog.far = viewDist * (1 - this.snow * 0.45); this.fog.near = this.fog.far * (0.6 - this.snow * 0.35);
    this.dome.position.copy(camPos); this.stars.position.copy(camPos); this.aurora.position.set(camPos.x, camPos.y * 0.3, camPos.z);
    this.starMat.opacity = (1 - dayF) * (1 - this.snow * 0.9) * 0.9; this.stars.rotation.y = now * 0.002;
    this.au.t.value = now; this.au.a.value = (1 - smooth(-0.25, 0.05, el)) * (1 - this.snow * 0.85) * 0.8; this.aurora.visible = this.au.a.value > 0.01;
    // lumière
    const moonUp = Math.max(0, -el);
    this.sun.position.set(camPos.x + sd.x * 100 * (el > 0 ? 1 : -1), camPos.y + Math.abs(sd.y) * 100 + 20, camPos.z + sd.z * 100);
    this.sun.target.position.copy(camPos);
    this.sun.color.set(0xffffff).lerp(C(0xffb070), setF).lerp(C(0x8fa8ff), 1 - dayF);
    this.sun.intensity = (2.2 * dayF + 0.5 * moonUp * (1 - dayF)) * (1 - this.snow * 0.4);
    this.hemi.intensity = 0.55 + 0.9 * dayF; this.hemi.color.copy(this.hor).lerp(C(0xffffff), 0.3); this.hemi.groundColor.set(0x4a3a28).multiplyScalar(0.4 + dayF * 0.6);
    // nuages
    this.clouds.position.set(0, 112, 0); this.cloudMat.color.set(0xffffff).multiplyScalar(0.25 + dayF * 0.75);
    for (const c of this.clouds.children) { c.position.x += dt * 2; if (c.position.x - camPos.x > 260) c.position.x -= 520; if (c.position.x - camPos.x < -260) c.position.x += 520; if (c.position.z - camPos.z > 260) c.position.z -= 520; if (c.position.z - camPos.z < -260) c.position.z += 520; }
    // neige
    this.snowMat.opacity = Math.min(1, this.snow * 1.3) * 0.9; this.snowPts.visible = this.snow > 0.02;
    if (this.snowPts.visible) { const p = this.snowPts.geometry.attributes.position, A = p.array; for (let i = 0; i < A.length; i += 3) { A[i + 1] -= dt * (2 + (i % 7) * 0.25); A[i] += Math.sin(now + i) * dt * 0.4; if (A[i + 1] < -20) A[i + 1] += 40; } p.needsUpdate = true; this.snowPts.position.set(Math.floor(camPos.x / 50) * 50, camPos.y, Math.floor(camPos.z / 50) * 50);
      // recadrer autour de la caméra
      for (let i = 0; i < A.length; i += 3) { const wx = A[i] + this.snowPts.position.x - camPos.x; if (wx > 25) A[i] -= 50; else if (wx < -25) A[i] += 50; const wz = A[i + 2] + this.snowPts.position.z - camPos.z; if (wz > 25) A[i + 2] -= 50; else if (wz < -25) A[i + 2] += 50; } }
    return { dayF, el };
  }
  clock() { const m = Math.floor(((this.t * 24) % 24) * 60); return String(Math.floor(m / 60)).padStart(2, '0') + ' h ' + String(m % 60).padStart(2, '0'); }
}

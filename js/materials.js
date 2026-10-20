// Matériaux : terrain (grain par voxel, biseau discret, variations de teinte), eau animée (reflets, écume),
// modèles (micro-voxels + arêtes). Les nuanceurs étendent ceux de Three.js pour garder lumières, ombres et brouillard.
import * as THREE from 'three';
const HASH = `
float vqHash(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vqNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  float a = vqHash(vec3(i, 1.)), b = vqHash(vec3(i + vec2(1, 0), 1.)), c = vqHash(vec3(i + vec2(0, 1), 1.)), d = vqHash(vec3(i + vec2(1, 1), 1.));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }`;
// Saisons : uniformes partagés par le terrain (aucun remaillage au changement de saison, voir saisons.js)
export const SEASON_U = { uSnow: { value: 0 }, uIce: { value: 0 }, uGreen: { value: 1 }, uFall: { value: 0 }, uFresh: { value: 0 } };
export function terrainMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, SEASON_U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float tex; attribute float kd; varying float vTex; varying float vKd; varying vec3 vVox; varying vec3 vNw;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTex = tex; vKd = kd; vVox = (modelMatrix * vec4(position, 1.0)).xyz * 2.0; vNw = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSnow, uIce, uGreen, uFall, uFresh; varying float vTex; varying float vKd; varying vec3 vVox; varying vec3 vNw;' + HASH)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 inside = vVox - vNw * 0.5; vec3 cell = floor(inside);
        float tb = floor(vTex * 255.0 + 0.5), bevF = step(127.5, tb), amp = mod(tb, 128.0) / 127.0;
        // saison : classe du bloc (kd bits 0-2), dessus à ciel ouvert (bit 3), ombrage AO×face (bits 4-7)
        float kq = floor(vKd * 255.0 + 0.5), cls = mod(kq, 8.0), opn = mod(floor(kq / 8.0), 2.0), shd = floor(kq / 16.0) / 15.0;
        if (kq > 0.5) { vec3 c = diffuseColor.rgb; float hv = vqHash(cell + 7.0), top = step(0.5, vNw.y);
          if (cls == 1.0) c = mix(mix(c, shd * vec3(0.66, 0.58, 0.27), uFall * 0.7 * top), shd * vec3(0.42, 0.72, 0.26), uFresh * 0.45 * top);
          else if (cls == 2.0) c = mix(c, shd * vec3(0.28, 0.52, 0.19) * (0.8 + 0.4 * hv), uGreen);
          else if (cls == 3.0) c = mix(c, shd * vec3(0.9, 0.7, 0.16) * (0.85 + 0.3 * hv), uFall);
          else if (cls == 5.0) c = mix(c, shd * vec3(0.78, 0.89, 0.97) * (0.96 + 0.08 * hv), uIce);
          else if (cls == 6.0) c = mix(mix(c, c * vec3(1.35, 1.05, 0.5) + shd * 0.05, uFall * 0.8), shd * vec3(0.9, 0.93, 0.97), uSnow * 0.8);
          if (cls == 2.0 || cls == 3.0) c = mix(c, shd * mix(vec3(0.45, 0.39, 0.33), vec3(0.93, 0.95, 0.98), 0.25 + 0.65 * top), uSnow * 0.85); // feuillus givrés
          if (opn > 0.5 && cls != 5.0) { float nz = vqNoise(cell.xz * 0.11) * 0.6 + vqHash(cell + 3.0) * 0.4, cov = smoothstep(nz - 0.08, nz + 0.08, uSnow * 1.16 - 0.08);
            c = mix(c, shd * vec3(0.95, 0.97, 1.0), cov); amp *= 1.0 - 0.75 * cov; }
          diffuseColor.rgb = c; }
        float px = length(fwidth(vVox)); float near = 1.0 - smoothstep(0.3, 1.0, px);
        float h1 = vqHash(cell), mac = vqNoise(cell.xz * 0.045 + cell.y * 0.02);
        float v = (h1 - 0.5) * 0.2 * amp + (mac - 0.5) * 0.34 * amp;
        diffuseColor.rgb *= 1.0 + v;
        // plaques plus sèches / plus fraîches (teinte)
        diffuseColor.rgb *= mix(vec3(1.0), vec3(1.07, 1.03, 0.84), smoothstep(0.55, 0.95, mac) * amp);
        if (bevF > 0.5) { vec3 f = fract(vVox); vec3 e3 = min(f, 1.0 - f) + abs(vNw) * 10.0; float e = min(e3.x, min(e3.y, e3.z));
          diffuseColor.rgb *= mix(1.0, mix(0.86, 1.0, smoothstep(0.0, 0.1, e)), near); }
      }`);
  };
  m.customProgramCacheKey = () => 'vq-terrain';
  return m;
}
export function waterMaterial() {
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 1, 1) }, skyCol: { value: new THREE.Color(0.7, 0.85, 1) }, dayF: { value: 1 }, sunInt: { value: 1 }, rain: { value: 0 } }]);
  u.frozen = SEASON_U.uIce; // eau gelée l'hiver (même uniforme que la patinoire)
  return new THREE.ShaderMaterial({ uniforms: u, vertexColors: true, transparent: true, depthWrite: false, fog: true,
    vertexShader: `attribute float tex; varying float vFoam; varying vec3 vW; varying vec3 vCol;
      #include <fog_pars_vertex>
      void main(){ vFoam = tex; vCol = color; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float time; uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 skyCol; uniform float dayF; uniform float sunInt; uniform float rain; uniform float frozen;
      varying float vFoam; varying vec3 vW; varying vec3 vCol;
      #include <fog_pars_fragment>
      void main(){ vec2 p = vW.xz; float t = time * (1.0 - frozen); vec2 g = vec2(0.0);
        g += vec2(cos(p.x * 0.9 + t * 1.3), cos(p.y * 0.7 + t * 1.1)) * 0.05;
        g += vec2(cos((p.x + p.y) * 1.7 - t * 1.9), cos((p.x - p.y) * 1.5 + t * 1.6)) * 0.035;
        g += vec2(sin(p.x * 3.7 + p.y * 1.3 + t * 2.7), sin(p.y * 3.3 - p.x * 1.1 + t * 2.3)) * 0.018;
        g += rain * vec2(sin(p.x * 11.0 + t * 9.0) * cos(p.y * 7.0 - t * 5.0), cos(p.y * 10.0 - t * 8.0) * sin(p.x * 6.0 + t * 4.0)) * 0.06; // gouttes de pluie
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y)); vec3 V = normalize(cameraPosition - vW);
        float fres = 0.06 + 0.9 * pow(1.0 - max(dot(n, V), 0.0), 4.0);
        vec3 base = vCol * (0.25 + 0.75 * dayF) * mix(0.62, 1.0, pow(1.0 - max(V.y, 0.0), 2.0)) * (1.0 - rain * 0.2); // plus sombre (profond) vu de haut
        vec3 c = mix(base, skyCol, fres);
        vec3 H = normalize(normalize(sunDir) + V); float sp = pow(max(dot(n, H), 0.0), 140.0) * sunInt;
        c += sunCol * sp * 1.6;
        // scintillement : petites facettes qui renvoient le soleil
        vec2 cellp = floor(p * 5.0 + vec2(t * 0.35, -t * 0.25)); float gh = fract(sin(dot(cellp, vec2(12.9898, 78.233))) * 43758.5453);
        c += sunCol * step(0.975, gh) * pow(max(dot(n, H), 0.0), 18.0) * sunInt * dayF * (0.6 + 0.4 * sin(t * 6.0 + gh * 30.0)) * 1.4;
        float fo = vFoam * (0.55 + 0.45 * sin(p.x * 3.0 + t * 1.7) * sin(p.y * 3.4 - t * 1.3));
        float foam = smoothstep(0.3, 0.85, fo);
        c = mix(c, vec3(0.9, 0.95, 1.0) * (0.3 + 0.7 * dayF), foam * 0.75);
        float a = clamp(mix(0.7, 0.95, fres) + foam * 0.25, 0.0, 1.0);
        if (frozen > 0.001) { // glace : blanc bleuté, plaques de neige, fissures; presque opaque
          vec2 q = p * 0.6; float n1 = fract(sin(dot(floor(q), vec2(12.9898, 78.233))) * 43758.5453), cr = smoothstep(0.035, 0.0, min(fract(q.x + n1 * 0.5), fract(q.y + n1 * 0.3)));
          vec2 s2 = floor(p * 0.35); float sn = smoothstep(0.55, 0.75, fract(sin(dot(s2, vec2(39.3, 11.7))) * 2741.31));
          vec3 ice = mix(vec3(0.68, 0.82, 0.9), vec3(0.93, 0.96, 1.0), sn * 0.85) * (0.3 + 0.7 * dayF) * (1.0 - cr * 0.25);
          ice += sunCol * pow(max(dot(vec3(0.0, 1.0, 0.0), normalize(normalize(sunDir) + V)), 0.0), 60.0) * sunInt * 0.5;
          c = mix(c, ice, frozen); a = mix(a, 0.97, frozen); }
        gl_FragColor = vec4(c, a);
        #include <fog_fragment>
      }` });
}
// modèles faits de boîtes : grain de micro-voxels (≈ 5,5 cm) et arêtes un peu assombries
export function patchModel(m) {
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 bsize; attribute vec3 boxc; varying vec3 vLoc; varying vec3 vHalf;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = position - boxc; vHalf = bsize * 0.5;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc; varying vec3 vHalf;' + HASH)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 c = floor(vLoc / 0.055 + 0.5); float h = vqHash(c + 3.0);
        vec3 e3 = vHalf - abs(vLoc); float m1 = min(e3.x, min(e3.y, e3.z)), m3 = max(e3.x, max(e3.y, e3.z)), m2 = e3.x + e3.y + e3.z - m1 - m3;
        float edge = mix(0.8, 1.0, smoothstep(0.004, 0.022, m2));
        diffuseColor.rgb *= (0.95 + h * 0.1) * edge; }`);
  };
  m.customProgramCacheKey = () => 'vq-model';
  return m;
}

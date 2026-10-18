// Matériaux : terrain (grain par voxel, biseau discret, variations de teinte), eau animée (reflets, écume),
// modèles (micro-voxels + arêtes). Les nuanceurs étendent ceux de Three.js pour garder lumières, ombres et brouillard.
import * as THREE from 'three';
const HASH = `
float vqHash(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vqNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  float a = vqHash(vec3(i, 1.)), b = vqHash(vec3(i + vec2(1, 0), 1.)), c = vqHash(vec3(i + vec2(0, 1), 1.)), d = vqHash(vec3(i + vec2(1, 1), 1.));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }`;
export function terrainMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float tex; varying float vTex; varying vec3 vVox; varying vec3 vNw;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTex = tex; vVox = (modelMatrix * vec4(position, 1.0)).xyz * 2.0; vNw = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTex; varying vec3 vVox; varying vec3 vNw;' + HASH)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 inside = vVox - vNw * 0.5; vec3 cell = floor(inside);
        float tb = floor(vTex * 255.0 + 0.5), bevF = step(127.5, tb), amp = mod(tb, 128.0) / 127.0;
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
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 1, 1) }, skyCol: { value: new THREE.Color(0.7, 0.85, 1) }, dayF: { value: 1 }, sunInt: { value: 1 } }]);
  return new THREE.ShaderMaterial({ uniforms: u, vertexColors: true, transparent: true, depthWrite: false, fog: true,
    vertexShader: `attribute float tex; varying float vFoam; varying vec3 vW; varying vec3 vCol;
      #include <fog_pars_vertex>
      void main(){ vFoam = tex; vCol = color; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float time; uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 skyCol; uniform float dayF; uniform float sunInt;
      varying float vFoam; varying vec3 vW; varying vec3 vCol;
      #include <fog_pars_fragment>
      void main(){ vec2 p = vW.xz; float t = time; vec2 g = vec2(0.0);
        g += vec2(cos(p.x * 0.9 + t * 1.3), cos(p.y * 0.7 + t * 1.1)) * 0.05;
        g += vec2(cos((p.x + p.y) * 1.7 - t * 1.9), cos((p.x - p.y) * 1.5 + t * 1.6)) * 0.035;
        g += vec2(sin(p.x * 3.7 + p.y * 1.3 + t * 2.7), sin(p.y * 3.3 - p.x * 1.1 + t * 2.3)) * 0.018;
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y)); vec3 V = normalize(cameraPosition - vW);
        float fres = 0.06 + 0.9 * pow(1.0 - max(dot(n, V), 0.0), 4.0);
        vec3 base = vCol * (0.25 + 0.75 * dayF);
        vec3 c = mix(base, skyCol, fres);
        vec3 H = normalize(normalize(sunDir) + V); float sp = pow(max(dot(n, H), 0.0), 140.0) * sunInt;
        c += sunCol * sp * 1.6;
        float fo = vFoam * (0.55 + 0.45 * sin(p.x * 3.0 + t * 1.7) * sin(p.y * 3.4 - t * 1.3));
        float foam = smoothstep(0.3, 0.85, fo);
        c = mix(c, vec3(0.9, 0.95, 1.0) * (0.3 + 0.7 * dayF), foam * 0.75);
        gl_FragColor = vec4(c, clamp(mix(0.7, 0.95, fres) + foam * 0.25, 0.0, 1.0));
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

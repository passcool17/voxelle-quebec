// Voxelle-Québec : RPG d'exploration en voxels, Québec satirique. Fil principal : jeu, entités, quêtes, interface.
import * as THREE from 'three';
import { createGen, BIOME, BIOME_NAME, layout, CELL } from './worldgen.js';
import { World, moveBody, boxHit } from './world.js';
import { B, CSM as CS, SEA, NAME, PLACEABLE, DROP, SOLID, COL, LEAF, VS } from './blocks.js';
import { Sky } from './sky.js';
import { Audio } from './audio.js';
import { human, setWeapon, animHuman, glider, enemyModel, animEnemy, pickupModel, box } from './models.js';
import { ITEMS, RARITY, SHOP, ENEMIES, NPCS, CHATTER, QUESTS, CONTRACT_TARGETS } from './data.js';
import { blockIcon, itemIcon } from './icons.js';
import { mulberry, smooth } from './noise.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const isTouch = Q.has('touch') || (matchMedia('(pointer: coarse)').matches && 'ontouchstart' in window);
const mobile = isTouch || Q.has('mobile') || /Android|iPhone|iPad/.test(navigator.userAgent);
if (isTouch) document.body.classList.add('touch');
// v2 : monde en voxels fins (0,5 m) ; les sauvegardes v1 sont reprises sans les blocs modifiés
const SEED = 20261018, SAVE_KEY = 'voxelle-quebec-v2', OLD_SAVE_KEY = 'voxelle-quebec-v1', OPT_KEY = 'voxelle-quebec-opts';
const DAY_LEN = 600;

// ---------- options ----------
const OPT = Object.assign({ view: mobile ? 4 : 7, qual: 'auto', vol: 0.7, mus: 0.6, sens: 1, inv: false }, JSON.parse(localStorage.getItem(OPT_KEY) || '{}'));
function saveOpts() { localStorage.setItem(OPT_KEY, JSON.stringify(OPT)); }

// ---------- rendu ----------
const renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: 'high-performance' });
let pixelRatio = Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.75);
renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth, innerHeight);
$('app').appendChild(renderer.domElement);
const canvas = renderer.domElement;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1000);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const sky = new Sky(scene, mobile);
const gen = createGen(SEED);
const audio = new Audio(); audio.setVol(OPT.vol); audio.setMusic(OPT.mus);
let world = null;

// ---------- état ----------
const G = { state: 'title', t: 0, P: null, enemies: [], npcs: new Map(), pickups: [], projs: [], parts: [], camps: new Map(), spawnT: 0, saveT: 0, frameAvg: 16, lastStruct: null, weatherT: 60, fps: 60 };
function freshSave() {
  return { v: 2, pos: [gen.VX + 2.5, gen.VH + 1, gen.VZ + 10.5], yaw: Math.PI, hp: 100, lvl: 1, xp: 0, cash: 15, inv: [{ id: 'poutine', n: 3 }], equip: { arme: { id: 'baton' }, tete: { id: 'tuque' }, mains: null, corps: null, pieds: null },
    weapons: [{ id: 'baton' }], wi: 0, blocks: { [B.PLANK]: 96, [B.COBBLE]: 64, [B.LAMP]: 16, [B.GLASS]: 24 }, hot: 0, q: {}, contract: null, contractsDone: 0, bureauKills: 0, taken: {}, bossDead: false, time: 0.32, edits: {}, stats: { kills: 0, blocks: 0, placed: 0, glide: 0, dist: 0 }, glider: true };
}
let S = null; // sauvegarde active
function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 2) return s; } catch (e) {}
  try { const o = JSON.parse(localStorage.getItem(OLD_SAVE_KEY)); if (o && o.v === 1) { o.v = 2; o.edits = {}; o.migrated = true; return o; } } catch (e) {}
  return null;
}
function writeSave() {
  if (!S || !G.P) return;
  const P = G.P; S.pos = [P.x, P.y, P.z]; S.yaw = G.camYaw; S.hp = P.hp; S.time = sky.t; S.edits = world ? world.edits : S.edits;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); return true; } catch (e) { toast('Sauvegarde impossible (espace plein)'); return false; }
}

// ---------- entrées ----------
const keys = new Set(), pressed = new Set();
const input = { mdx: 0, mdy: 0, lmb: false, rmbP: false, wheel: 0, tx: 0, tz: 0, tRun: false, tAtk: false, tJump: false, tJumpP: false, look: [0, 0], bot: null, gp: null, gpPrev: [] };
addEventListener('keydown', e => {
  if (e.repeat) { if (!['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) return; }
  keys.add(e.code); pressed.add(e.code); audio.init();
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code) && G.state !== 'title') e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => {
  audio.init();
  if (G.state === 'play' && !document.pointerLockElement && !isTouch) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (er) {} }
  if (e.button === 0) input.lmb = true; if (e.button === 2) input.rmbP = true; if (e.button === 1) pressed.add('KeyF');
});
addEventListener('mouseup', e => { if (e.button === 0) input.lmb = false; });
addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) { input.mdx += e.movementX; input.mdy += e.movementY; } });
addEventListener('wheel', e => { if (G.state === 'play') input.wheel += Math.sign(e.deltaY); }, { passive: true });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && G.state === 'play' && !G.noPauseOnUnlock) openPause(); G.noPauseOnUnlock = false; });
function unlock() { if (document.pointerLockElement) { G.noPauseOnUnlock = true; document.exitPointerLock(); } }
// manette
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : []; let p = null; for (const q of pads) if (q && q.connected) { p = q; break; }
  input.gp = p; if (!p) return;
  const b = i => p.buttons[i] && p.buttons[i].pressed, prev = input.gpPrev, now = p.buttons.map(x => x.pressed);
  const edge = i => now[i] && !prev[i];
  if (edge(0)) pressed.add('Space'); if (edge(1)) pressed.add('KeyE'); if (edge(2)) pressed.add('KeyR'); if (edge(3)) pressed.add('KeyQ');
  if (edge(5)) pressed.add('KeyF'); if (edge(6)) input.rmbP = true; if (edge(9)) pressed.add('Escape'); if (edge(8)) pressed.add('KeyI');
  if (edge(14)) input.wheel -= 1; if (edge(15)) input.wheel += 1; if (edge(12)) pressed.add('KeyJ'); if (edge(13)) pressed.add('KeyM');
  input.gpAtk = b(7); input.gpRun = b(4); input.gpJump = b(0);
  input.gpPrev = now; if (now.some(x => x)) audio.init();
}
const dz = v => Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85;

// ---------- joueur ----------
function stats() {
  const e = S.equip; let def = 0, spd = 0;
  for (const k of ['tete', 'mains', 'corps', 'pieds']) if (e[k]) { const it = ITEMS[e[k].id]; def += (it.def || 0) * RARITY[e[k].r || 0].m; spd += it.spd || 0; }
  const w = e.arme ? ITEMS[e.arme.id] : ITEMS.baton, wm = e.arme ? RARITY[e.arme.r || 0].m : 1;
  return { def: Math.round(def), spd, hpMax: 100 + 14 * (S.lvl - 1), dmg: w.dmg * wm * (1 + 0.1 * (S.lvl - 1)), W: w };
}
const xpNext = l => 100 + (l - 1) * (l - 1) * 60 + (l - 1) * 80;
function makePlayer() {
  const m = human({}); setWeapon(m, S.equip.arme ? S.equip.arme.id : 'baton');
  const gl = glider(); gl.position.set(0, 2.25, 0); gl.visible = false; m.g.add(gl);
  scene.add(m.g);
  const P = { x: S.pos[0], y: S.pos[1], z: S.pos[2], vx: 0, vy: 0, vz: 0, hw: 0.3, h: 1.75, ground: false, hp: S.hp, stam: 1, yaw: S.yaw, model: m, gl, gliding: false, atkT: 0, atkCd: 0, hitAt: -1, iT: 0, buff: 0, brkCd: 0, fallV: 0, walkT: 0 };
  G.camYaw = S.yaw; G.camPitch = 0.32; G.camDist = 5.8;
  return P;
}
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(VS * 1.02, VS * 1.02, VS * 1.02)), new THREE.LineBasicMaterial({ color: 0x0c1420 }));
outline.visible = false; scene.add(outline);

function camUpdate(dt) {
  const P = G.P, sens = OPT.sens * 0.0024;
  G.camYaw -= input.mdx * sens; G.camPitch += input.mdy * sens * (OPT.inv ? -1 : 1); input.mdx = input.mdy = 0;
  if (input.gp) { const ax = input.gp.axes; G.camYaw -= dz(ax[2] || 0) * dt * 2.6 * OPT.sens; G.camPitch += dz(ax[3] || 0) * dt * 2 * OPT.sens * (OPT.inv ? -1 : 1); }
  G.camYaw -= input.look[0] * 0.006 * OPT.sens; G.camPitch += input.look[1] * 0.005 * OPT.sens; input.look[0] = input.look[1] = 0;
  G.camPitch = Math.max(-0.9, Math.min(1.25, G.camPitch));
  const so = P.model.stepOffV || 0;
  const tx = P.x, ty = P.y + 1.55 - so, tz = P.z;
  const cp = Math.cos(G.camPitch), dir = tmpV.set(Math.sin(G.camYaw) * cp, Math.sin(G.camPitch), Math.cos(G.camYaw) * cp);
  let d = G.camDist + (P.gliding ? 1.5 : 0);
  const hit = world.ray(tmpV2.set(tx, ty, tz), dir, d + 0.3); if (hit) d = Math.max(0.6, hit.t - 0.35);
  camera.position.set(tx + dir.x * d, ty + dir.y * d, tz + dir.z * d);
  camera.lookAt(tx, ty + 0.25, tz);
}
function moveInput() {
  let mx = 0, mz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1; if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  if (input.gp) { mx += dz(input.gp.axes[0] || 0); mz += dz(input.gp.axes[1] || 0); }
  mx += input.tx; mz += input.tz;
  if (input.bot) { mx = input.bot.mx; mz = input.bot.mz; }
  const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
  return { mx, mz, run: keys.has('ShiftLeft') || keys.has('ShiftRight') || input.gpRun || input.tRun || (input.bot && input.bot.run) };
}
function playerUpdate(dt) {
  const P = G.P, st = stats(); P.hpMax = st.hpMax;
  if (!world.loadedAround(P.x, P.z, 1)) { P.vx = P.vz = 0; P.vy = 0; return; }
  const { mx, mz, run } = moveInput();
  const s = Math.sin(G.camYaw), c = Math.cos(G.camYaw);
  // direction voulue dans le monde (avant = -z caméra)
  const wx = mx * c + mz * s, wz = -mx * s + mz * c, mv = Math.hypot(wx, wz);
  const inWater = world.get(P.x, P.y + 0.5, P.z) === B.WATER, headWater = world.get(P.x, P.y + 1.4, P.z) === B.WATER;
  const canRun = run && P.stam > 0.05 && mv > 0.1 && !P.gliding;
  if (canRun) P.stam = Math.max(0, P.stam - dt * 0.18); else P.stam = Math.min(1, P.stam + dt * (P.ground ? 0.25 : 0.1));
  let sp = (canRun ? 8.4 : 5.4) * (1 + st.spd + (P.buff > 0 ? 0.25 : 0)); if (inWater) sp *= 0.55;
  const jumpP = pressed.has('Space') || input.tJumpP || (input.bot && input.bot.jumpP); input.tJumpP = false; if (input.bot) input.bot.jumpP = false;
  const jumpH = keys.has('Space') || input.tJump || input.gpJump || (input.bot && input.bot.jump);
  if (P.gliding) {
    const f = Math.max(0.4, 1 - mz * 0.35), gs = 10.5 * f;
    const fx = -s, fz = -c;
    P.vx += (fx * gs + wx * 2 - P.vx) * Math.min(1, dt * 2.2); P.vz += (fz * gs + wz * 2 - P.vz) * Math.min(1, dt * 2.2);
    P.vy += (-2.1 - P.vy) * Math.min(1, dt * 3); P.yaw = Math.atan2(P.vx, P.vz) + Math.PI;
    S.stats.glide += Math.hypot(P.vx, P.vz) * dt;
    if (P.ground || inWater || jumpP || pressed.has('KeyG')) { P.gliding = false; P.gl.visible = false; if (!P.ground) audio.fx('jump', 0.5); }
    audio.wind(Math.hypot(P.vx, P.vz) / 14);
  } else {
    audio.wind(sky.snow * 0.12);
    const acc = P.ground ? 14 : inWater ? 5 : 3.2;
    P.vx += (wx * sp - P.vx) * Math.min(1, dt * acc); P.vz += (wz * sp - P.vz) * Math.min(1, dt * acc);
    if (inWater) { P.vy -= 9 * dt; P.vy *= Math.pow(0.2, dt); if (jumpH) P.vy = Math.min(P.vy + 30 * dt, 4.5); }
    else P.vy -= 26 * dt;
    if (jumpP && P.ground && !inWater) { P.vy = 8.6; P.ground = false; audio.fx('jump'); }
    else if (jumpP && !P.ground && !inWater && S.glider && P.vy < 2) { P.gliding = true; P.gl.visible = true; audio.fx('glide'); P.vy = Math.max(P.vy, -4); if (!G.glidedOnce) { G.glidedOnce = true; toast('Cerf-volant fléché déployé!'); } }
    if (pressed.has('KeyG') && !P.ground && S.glider && !inWater) { P.gliding = true; P.gl.visible = true; audio.fx('glide'); }
    if (mv > 0.1 && P.atkT <= 0) { const ty = Math.atan2(wx, wz) + Math.PI; P.yaw += Math.atan2(Math.sin(ty - P.yaw), Math.cos(ty - P.yaw)) * Math.min(1, dt * 12); }
  }
  if (P.vy < -40) P.vy = -40;
  const fallV = P.vy, wasGround = P.ground; P.stepOff = 0;
  moveBody(world, P, dt, true);
  if (P.stepOff) P.model.stepOffV = (P.model.stepOffV || 0) + P.stepOff;
  P.model.stepOffV = Math.max(0, (P.model.stepOffV || 0) - dt * 7);
  if (P.ground && !wasGround) { if (fallV < -17 && !inWater) { hurtPlayer(Math.round((-fallV - 17) * 4), null, 'chute'); } else if (fallV < -6) audio.fx('land', 0.6); }
  if (P.y < -10) { P.y = gen.heightAt(P.x, P.z) + 3; P.vy = 0; }
  S.stats.dist += Math.hypot(P.vx, P.vz) * dt;
  // attaque
  P.atkCd -= dt; P.iT -= dt; P.buff -= dt; P.brkCd -= dt;
  if (input.lmb || input.gpAtk || input.tAtk || (input.bot && input.bot.atk)) tryAttack(st);
  if (P.atkT > 0) { P.atkT += dt / Math.max(0.3, st.W.cd); if (P.atkT >= 1) P.atkT = 0; }
  if (P.hitAt > 0) { P.hitAt -= dt; if (P.hitAt <= 0) melee(st); }
  // bloc visé
  const cd = tmpV.copy(camera.getWorldDirection(tmpV2)), co = camera.position;
  const hit = world.ray(co, cd, G.camDist + 8);
  G.target = null;
  if (hit) { const hx = hit.x + VS / 2, hy = hit.y + VS / 2, hz = hit.z + VS / 2; if (Math.hypot(hx - P.x, hy - (P.y + 1.4), hz - P.z) < 6.2) G.target = hit; }
  outline.visible = !!G.target && !isTouch || (!!G.target && isTouch);
  if (G.target) outline.position.set(G.target.x + VS / 2, G.target.y + VS / 2, G.target.z + VS / 2);
  if (pressed.has('KeyF') || input.tBrkP || (input.bot && input.bot.brkP)) breakBlock(); input.tBrkP = false; if (input.bot) input.bot.brkP = false;
  if (input.rmbP || input.tPlaceP || (input.bot && input.bot.placeP)) placeBlock(); input.rmbP = false; input.tPlaceP = false; if (input.bot) input.bot.placeP = false;
  // modèle
  const m = P.model; m.g.position.set(P.x, P.y - (m.stepOffV || 0), P.z); m.g.rotation.y = P.yaw;
  P.walkT += dt * Math.min(1.4, Math.hypot(P.vx, P.vz) / 5.4);
  animHuman(m, P.walkT, P.ground ? Math.min(1, Math.hypot(P.vx, P.vz) / 5) : 0, P.atkT, !P.ground && !inWater, P.gliding);
  if (P.gliding) { P.gl.rotation.z = Math.max(-0.4, Math.min(0.4, (mx) * -0.3)); }
  if (P.iT > 0) m.g.visible = Math.floor(P.iT * 20) % 2 === 0; else m.g.visible = true;
}
function tryAttack(st) {
  const P = G.P; if (P.atkCd > 0) return;
  P.atkCd = st.W.cd; P.atkT = 0.001;
  // assistance de visée : vers l'ennemi le plus proche devant la caméra
  const fy = G.camYaw; let best = null, bd = 1e9;
  for (const e of G.enemies) { if (e.dead) continue; const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz); if (d > (st.W.kind === 'ranged' ? 24 : st.W.range + e.T.hw + 1.6)) continue; const a = Math.atan2(-dx, -dz), da = Math.abs(Math.atan2(Math.sin(a - fy), Math.cos(a - fy))); if (da < 0.9 && d + da * 4 < bd) { bd = d + da * 4; best = e; } }
  P.yaw = best ? Math.atan2(-(best.x - P.x), -(best.z - P.z)) : fy;
  if (st.W.kind === 'ranged') {
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    let vy = Math.sin(-G.camPitch + 0.25) * 0.5 + 0.12;
    if (best) { const d = Math.hypot(best.x - P.x, best.z - P.z); vy = ((best.y + best.T.h * 0.5) - (P.y + 1.4)) / Math.max(1, d) + d * 0.012; }
    const v = new THREE.Vector3(fx, vy, fz).normalize().multiplyScalar(st.W.speed);
    spawnProj({ x: P.x + fx * 0.6, y: P.y + 1.4, z: P.z + fz * 0.6 }, v, 'p', st.dmg, 'snow'); audio.fx('throw');
  } else { P.hitAt = 0.11; audio.fx('swing'); }
}
function melee(st) {
  const P = G.P, fy = P.yaw, W = st.W; let n = 0;
  for (const e of G.enemies) {
    if (e.dead) continue; const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz);
    if (d > W.range + e.T.hw || Math.abs(e.y - P.y) > 2.2 + (e.T.boss ? 2 : 0)) continue;
    const a = Math.atan2(-dx, -dz), da = Math.abs(Math.atan2(Math.sin(a - fy), Math.cos(a - fy)));
    if (da > W.arc / 2 && d > 1.1) continue;
    damageEnemy(e, st.dmg, dx / (d || 1), dz / (d || 1), W.kb || 6); n++;
  }
  if (n) audio.fx(n && G.enemies.some(e => e.type === 'cone') ? 'bonk' : 'hit');
}
function breakBlock() {
  const P = G.P; if (P.brkCd > 0 || !G.target) return; const t = G.target;
  if (t.b === B.BEDROCK) { audio.fx('deny'); toast('Le roc-mère est incassable.'); P.brkCd = 0.3; return; }
  if (!world.set(t.x, t.y, t.z, B.AIR)) return;
  P.brkCd = 0.12; audio.fx('break');
  const d = DROP(t.b); if (d && PLACEABLE.includes(d)) { S.blocks[d] = (S.blocks[d] || 0) + 1; }
  burst(t.x + VS / 2, t.y + VS / 2, t.z + VS / 2, COL[t.b][1], 8); S.stats.blocks++; G.dirtyHot = true;
}
function placeBlock() {
  const P = G.P, list = hotList(), b = list[S.hot % Math.max(1, list.length)]; if (!G.target) return;
  if (!b || !(S.blocks[b] > 0)) { audio.fx('deny'); toast('Plus de blocs de ce type. Casse des blocs pour en ramasser!'); return; }
  const x = G.target.x + G.target.n[0], y = G.target.y + G.target.n[1], z = G.target.z + G.target.n[2];
  const cur = world.get(x, y, z); if (cur !== 0 && cur !== B.WATER) return;
  // pas dans le joueur ni dans un ennemi
  const inBox = (e) => x + VS > e.x - e.hw && x < e.x + e.hw && z + VS > e.z - e.hw && z < e.z + e.hw && y + VS > e.y && y < e.y + e.h;
  if (inBox(P)) { audio.fx('deny'); return; }
  for (const e of G.enemies) if (inBox(e)) return;
  if (!world.set(x, y, z, b)) return;
  S.blocks[b]--; if (S.blocks[b] <= 0) delete S.blocks[b]; audio.fx('place'); S.stats.placed++; G.dirtyHot = true;
}
function hotList() { return PLACEABLE.filter(b => S.blocks[b] > 0).slice(0, 9); }
function hurtPlayer(d, src, why) {
  const P = G.P; if (P.iT > 0 && why !== 'chute') return; if (G.state !== 'play') return;
  const st = stats(); d = Math.max(1, Math.round(d * (1 - st.def / (st.def + 30))));
  P.hp -= d; P.iT = 0.45; audio.fx('hurt'); floatTxt(P.x, P.y + 2, P.z, '-' + d, '#ff6a6a');
  $('hurt').style.opacity = 1; setTimeout(() => $('hurt').style.opacity = 0, 140);
  if (src) { const dx = P.x - src.x, dz = P.z - src.z, l = Math.hypot(dx, dz) || 1; P.vx += dx / l * 6; P.vz += dz / l * 6; P.vy = Math.max(P.vy, 4); if (P.gliding) { P.gliding = false; P.gl.visible = false; } }
  if (P.hp <= 0) die(why || (src && src.T.name));
}
function die(why) {
  const P = G.P; P.hp = 0; G.state = 'dead'; unlock(); audio.fx('die');
  const lost = Math.floor(S.cash * 0.1); S.cash -= lost;
  $('deadtxt').textContent = (why ? 'Par : ' + why + '. ' : '') + (lost ? 'Tu as échappé ' + lost + ' piasses.' : '');
  show('dead');
}
function respawn() {
  const P = G.P; P.x = gen.VX + 2.5; P.z = gen.VZ + 10.5; P.y = gen.VH + 1; P.vx = P.vy = P.vz = 0; P.hp = stats().hpMax; P.gliding = false; P.gl.visible = false; P.iT = 2;
  hide('dead'); G.state = 'play'; writeSave();
}
function eat() {
  const order = ['poutine', 'sirop', 'tourtiere']; const P = G.P;
  const it = S.inv.find(i => order.includes(i.id) && i.n > 0) ; if (!it) { toast('Rien à manger dans ton sac.'); audio.fx('deny'); return; }
  if (P.hp >= P.hpMax && it.id !== 'sirop') { toast('Tu n’as pas faim.'); return; }
  useItem(it);
}
function useItem(it) {
  const D = ITEMS[it.id], P = G.P; if (D.slot !== 'conso') return;
  P.hp = Math.min(stats().hpMax, P.hp + D.heal); if (D.stam) P.stam = 1; if (D.buff) P.buff = D.buff;
  it.n--; if (it.n <= 0) S.inv.splice(S.inv.indexOf(it), 1); audio.fx('eat'); floatTxt(P.x, P.y + 2, P.z, '+' + D.heal, '#8dff6a'); toast(D.name + ' : +' + D.heal + ' PV');
}
function swapWeapon() {
  const ws = S.inv.filter(i => ITEMS[i.id].slot === 'arme'); if (!ws.length) { toast('Une seule arme pour l’instant.'); return; }
  equip(ws[0]);
}
function equip(it) {
  const D = ITEMS[it.id]; const slot = D.slot; if (!['arme', 'tete', 'mains', 'corps', 'pieds'].includes(slot)) return;
  const i = S.inv.indexOf(it); if (i >= 0) S.inv.splice(i, 1);
  if (S.equip[slot]) S.inv.push(S.equip[slot]);
  S.equip[slot] = it; if (slot === 'arme') setWeapon(G.P.model, it.id);
  audio.fx('ui'); toast(D.name + ' équipé' + (slot === 'tete' || slot === 'arme' ? '' : 's'));
  G.dirtyHot = true;
}
function addItem(id, n = 1, r = 0) {
  const D = ITEMS[id];
  if (D.slot === 'conso' || D.slot === 'quete') { const it = S.inv.find(i => i.id === id); if (it) it.n += n; else S.inv.push({ id, n }); }
  else for (let k = 0; k < n; k++) S.inv.push({ id, r });
}

// ---------- étiquettes HTML (noms, barres de vie) ----------
const labelsEl = $('labels');
function makeLabel(cls, html) { const d = document.createElement('div'); d.className = 'lb ' + cls; d.innerHTML = html; labelsEl.appendChild(d); return d; }
const projV = new THREE.Vector3();
function placeLabel(el, x, y, z, maxD = 34) {
  const d = Math.hypot(x - camera.position.x, z - camera.position.z);
  projV.set(x, y, z).project(camera);
  if (projV.z > 1 || d > maxD || Math.abs(projV.x) > 1.2 || Math.abs(projV.y) > 1.2) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
  el.style.display = '';
  const sx = (projV.x * 0.5 + 0.5) * innerWidth, sy = (-projV.y * 0.5 + 0.5) * innerHeight;
  el.style.transform = `translate(${sx | 0}px,${sy | 0}px) translate(-50%,-100%)`;
}
function floatTxt(x, y, z, t, col) {
  projV.set(x, y, z).project(camera); if (projV.z > 1) return;
  const d = document.createElement('div'); d.textContent = t; d.style.color = col || '#fff';
  d.style.left = ((projV.x * 0.5 + 0.5) * innerWidth) + 'px'; d.style.top = ((-projV.y * 0.5 + 0.5) * innerHeight) + 'px';
  $('floats').appendChild(d); setTimeout(() => d.remove(), 1000);
}
// ---------- particules ----------
const partGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
function burst(x, y, z, color, n = 8, spd = 4) {
  if (G.parts.length > 220) return;
  const m = new THREE.MeshLambertMaterial({ color });
  for (let i = 0; i < n; i++) { const p = new THREE.Mesh(partGeo, m); p.position.set(x, y, z); scene.add(p); G.parts.push({ m: p, vx: (Math.random() - 0.5) * spd, vy: Math.random() * spd, vz: (Math.random() - 0.5) * spd, life: 0.6 + Math.random() * 0.4, mat: m }); }
}
function partsUpdate(dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) { const p = G.parts[i]; p.life -= dt; p.vy -= 14 * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt; p.m.scale.setScalar(Math.max(0.05, p.life)); if (p.life <= 0) { scene.remove(p.m); G.parts.splice(i, 1); } }
}
// ---------- projectiles ----------
const snowGeo = new THREE.BoxGeometry(0.26, 0.26, 0.26);
function spawnProj(o, v, owner, dmg, kind) {
  const mesh = kind === 'snow' ? new THREE.Mesh(snowGeo, new THREE.MeshLambertMaterial({ color: 0xf8fbff })) : (() => { const g = new THREE.Group(); box(g, 0.4, 0.04, 0.52, 0xf8f8f0, 0, 0, 0, true); box(g, 0.26, 0.05, 0.05, 0x2040a0, 0, 0.01, -0.12); return g; })();
  mesh.position.set(o.x, o.y, o.z); scene.add(mesh);
  G.projs.push({ pos: mesh.position, vel: v, owner, dmg, kind, mesh, life: 3 });
}
function projUpdate(dt) {
  const P = G.P;
  for (let i = G.projs.length - 1; i >= 0; i--) {
    const p = G.projs[i]; p.life -= dt; let dead = p.life <= 0;
    if (p.kind === 'snow') p.vel.y -= 9 * dt; else { p.mesh.rotation.y += dt * 9; const dx = P.x - p.pos.x, dy = P.y + 1 - p.pos.y, dz = P.z - p.pos.z, l = Math.hypot(dx, dy, dz) || 1; p.vel.x += dx / l * dt * 4; p.vel.y += dy / l * dt * 4; p.vel.z += dz / l * dt * 4; }
    p.pos.addScaledVector(p.vel, dt);
    if (world.solid(p.pos.x, p.pos.y, p.pos.z) && world.get(p.pos.x, p.pos.y, p.pos.z) > 0) dead = true;
    if (!dead && p.owner === 'p') for (const e of G.enemies) { if (e.dead) continue; const r = e.T.hw + 0.35; if (Math.abs(p.pos.x - e.x) < r && Math.abs(p.pos.z - e.z) < r && p.pos.y > e.y - 0.2 && p.pos.y < e.y + e.T.h + 0.3) { const l = Math.hypot(p.vel.x, p.vel.z) || 1; damageEnemy(e, p.dmg, p.vel.x / l, p.vel.z / l, 4); dead = true; break; } }
    if (!dead && p.owner === 'e' && Math.abs(p.pos.x - P.x) < 0.55 && Math.abs(p.pos.z - P.z) < 0.55 && p.pos.y > P.y && p.pos.y < P.y + 1.9) { hurtPlayer(p.dmg, { x: p.pos.x - p.vel.x, z: p.pos.z - p.vel.z, T: { name: 'un formulaire en trois copies' } }, 'un formulaire'); audio.fx('paper'); dead = true; }
    if (dead) { burst(p.pos.x, p.pos.y, p.pos.z, p.kind === 'snow' ? 0xffffff : 0xf8f8f0, 5, 3); if (p.kind === 'snow') audio.fx('splat', 0.5); scene.remove(p.mesh); G.projs.splice(i, 1); }
  }
}
// ---------- ennemis ----------
function enemyLevel(x, z) { return 1 + Math.floor(Math.hypot(x - gen.VX, z - gen.VZ) / 220); }
function spawnEnemy(type, x, z, opt = {}) {
  const T = ENEMIES[type], lvl = opt.lvl || enemyLevel(x, z), y = world.ground(x, z);
  const M = enemyModel(type); scene.add(M.g);
  const hpm = 1 + 0.3 * (lvl - 1);
  const e = { type, T, lvl, x, y, z, vx: 0, vy: 0, vz: 0, hw: T.hw, h: T.h, ground: false, hp: T.hp * hpm, hpMax: T.hp * hpm, dmg: T.dmg * (1 + 0.18 * (lvl - 1)), model: M, state: type === 'trou' ? 'hidden' : 'idle', cd: 1, atkAnim: 0, t: Math.random() * 10, wander: Math.random() * 6.28, home: { x, z }, camp: opt.camp, hurtT: 0, yaw: Math.random() * 6.28, moving: false };
  e.label = makeLabel('foe', `<div class="nm">${T.name} <span class="gold">niv. ${lvl}</span></div><div class="hb"><div></div></div>`);
  e.hbEl = e.label.querySelector('.hb div');
  if (T.boss) { $('bossbox').classList.remove('hidden'); $('bossname').textContent = T.name + ' (niv. ' + lvl + ')'; G.boss = e; }
  G.enemies.push(e); return e;
}
function damageEnemy(e, dmg, nx, nz, kb) {
  const crit = Math.random() < 0.12, d = Math.round(dmg * (0.88 + Math.random() * 0.24) * (crit ? 1.7 : 1));
  e.hp -= d; e.hurtT = 0.15; e.state = e.state === 'hidden' ? 'chase' : e.state === 'idle' ? 'chase' : e.state;
  if (!e.T.boss && e.type !== 'trou') { e.vx += nx * kb; e.vz += nz * kb; e.vy = Math.max(e.vy, 3.5); }
  floatTxt(e.x, e.y + e.T.h + 0.4, e.z, (crit ? 'CRITIQUE! ' : '') + d, crit ? '#ffd23a' : '#ffffff');
  burst(e.x, e.y + e.T.h * 0.6, e.z, { cone: 0xff7a1a, supreme: 0xff7a1a, bureau: 0xf8f8f0, plow: 0xf28a1a, raton: 0x8d8a84, mouches: 0x202020, trou: 0x4a4c50 }[e.type], 5, 3);
  if (e.type === 'raton') audio.fx('squeak'); if (e.type === 'plow') audio.fx('horn', 0.5);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true; scene.remove(e.model.g); e.label.remove();
  burst(e.x, e.y + e.T.h * 0.5, e.z, e.type === 'mouches' ? 0x202020 : 0xffffff, 14, 6);
  S.stats.kills++;
  gainXP(Math.round(e.T.xp * (1 + 0.25 * (e.lvl - 1))));
  const [a, b] = e.T.cash; const n = Math.round((a + Math.random() * (b - a)) * (1 + 0.2 * (e.lvl - 1)));
  for (let k = 0; k < Math.min(6, Math.ceil(n / 3)); k++) dropPickup('piasse', e.x + (Math.random() - 0.5) * 1.5, e.y + 0.6, e.z + (Math.random() - 0.5) * 1.5, { val: Math.ceil(n / Math.min(6, Math.ceil(n / 3))) });
  if (Math.random() < 0.12) dropPickup('poutine', e.x, e.y + 0.6, e.z, {});
  if (Math.random() < (e.T.boss ? 1 : 0.06)) dropGear(e);
  if (e.type === 'raton' && e.stole) dropPickup('piasse', e.x, e.y + 0.6, e.z, { val: e.stole });
  if (e.type === 'bureau' && S.q.permis && S.q.permis.st === 'active' && !G.pickups.some(p => p.kind === 'permis')) { S.bureauKills++; if (S.bureauKills >= 3 || Math.random() < 0.25) { dropPickup('permis', e.x, e.y + 0.6, e.z, {}); toast('Le bureaucrate a échappé un formulaire!'); } }
  if (e.T.boss) { S.bossDead = true; $('bossbox').classList.add('hidden'); G.boss = null; banner('LE CÔNE SUPRÊME EST VAINCU!', 'Les rues sont libres… pour l’instant.'); }
  questEvent('kill', e.type);
  if (e.camp) { const c = G.camps.get(e.camp); if (c) { c.alive--; if (c.alive <= 0) { c.cleared = G.t; toast('Chantier nettoyé!'); } } }
}
function dropGear(e) {
  const pool = ['tuque', 'mitaines', 'bottes', 'manteau', 'mitaines_doublees', 'pelle', 'baton_carbone', 'lanceur', 'pelle_alu'];
  const id = e.T.boss ? 'manteau' : pool[(Math.random() * pool.length) | 0];
  const r = e.T.boss ? 2 : Math.random() < 0.2 ? 2 : Math.random() < 0.5 ? 1 : 0;
  dropPickup('gear', e.x, e.y + 0.6, e.z, { id, r });
}
function enemiesUpdate(dt) {
  const P = G.P;
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (e.dead) { G.enemies.splice(i, 1); continue; }
    const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz), T = e.T;
    if (d > 110 && !e.camp || d > 160) { scene.remove(e.model.g); e.label.remove(); G.enemies.splice(i, 1); if (e.camp) { const c = G.camps.get(e.camp); if (c && --c.alive <= 0) G.camps.delete(e.camp); } if (e.T.boss) { $('bossbox').classList.add('hidden'); G.boss = null; } continue; }
    if (!world.loadedAround(e.x, e.z, 0)) continue;
    e.t += dt; e.cd -= dt; e.hurtT -= dt; if (e.atkAnim > 0) { e.atkAnim += dt * 2.5; if (e.atkAnim >= 1) e.atkAnim = 0; }
    const alive = G.state === 'play' && P.hp > 0, dy = Math.abs(P.y - e.y);
    let tvx = 0, tvz = 0, sp = T.spd;
    if (e.state === 'idle' && alive && d < T.aggro && dy < 8) { e.state = 'chase'; if (e.type === 'plow') audio.fx('horn'); if (e.type === 'mouches') audio.fx('buzz'); }
    if (e.state === 'chase' && (d > T.aggro * 2.2 || !alive)) e.state = 'idle';
    if (e.type === 'trou') { if (e.state === 'hidden' && alive && d < T.aggro) e.state = 'chase'; if (e.state === 'chase' && d > 9) e.state = 'hidden'; }
    if (e.state === 'idle') { e.wander += (Math.random() - 0.5) * dt * 2; const hx = e.home.x - e.x, hz = e.home.z - e.z; const far = Math.hypot(hx, hz) > 10; tvx = (far ? hx / 10 : Math.sin(e.wander)) * sp * 0.35; tvz = (far ? hz / 10 : Math.cos(e.wander)) * sp * 0.35; if (e.type === 'trou') tvx = tvz = 0; }
    else if (e.state === 'chase') {
      const ux = dx / (d || 1), uz = dz / (d || 1);
      if (T.ranged) { const want = 7; const k = d > want + 1 ? 1 : d < want - 2 ? -0.7 : 0; tvx = ux * sp * k + -uz * sp * 0.3 * Math.sin(e.t * 0.7); tvz = uz * sp * k + ux * sp * 0.3 * Math.sin(e.t * 0.7);
        if (e.cd <= 0 && d < T.range + 4) { e.cd = T.cd; e.atkAnim = 0.01; spawnProj({ x: e.x, y: e.y + 1.4, z: e.z }, new THREE.Vector3(ux * 8, 0.6, uz * 8), 'e', e.dmg, 'form'); audio.fx('paper', 0.6); } }
      else if (e.type === 'raton' && e.stole) { tvx = -ux * sp * 1.1; tvz = -uz * sp * 1.1; if (d > 30) { e.state = 'idle'; } }
      else if (e.type === 'plow') {
        if (!e.charge && e.cd <= 0 && d < 18) { e.charge = { t: 0.9, dx: ux, dz: uz, wind: true }; e.state = 'chase'; audio.fx('horn'); }
        if (e.charge) { e.charge.t -= dt; if (e.charge.wind) { tvx = tvz = 0; e.yaw = Math.atan2(-e.charge.dx, -e.charge.dz); if (e.charge.t <= 0) { e.charge.wind = false; e.charge.t = 1.4; } } else { tvx = e.charge.dx * 13; tvz = e.charge.dz * 13; if (d < 2.2 && !e.charge.hit) { e.charge.hit = true; hurtPlayer(e.dmg, e, T.name); } if (e.charge.t <= 0 || e.hitWall) { e.charge = null; e.cd = T.cd; } } }
        else { tvx = ux * sp; tvz = uz * sp; }
      } else {
        const reach = T.range + 0.3;
        if (d > reach - 0.3) { tvx = ux * sp; tvz = uz * sp; }
        if (d < reach + (T.boss ? 0.6 : 0) && dy < 2.5 + (T.boss ? 2 : 0) && e.cd <= 0) {
          e.cd = T.cd; e.atkAnim = 0.01;
          setTimeout(() => { if (!e.dead && Math.hypot(P.x - e.x, P.z - e.z) < reach + 0.8) { hurtPlayer(e.dmg, e, T.name); if (e.type === 'raton' && !e.stole && S.cash > 0) { const s = Math.min(S.cash, 3 + (Math.random() * 6 | 0)); S.cash -= s; e.stole = s; toast('Le raton t’a volé ' + s + ' piasses! Rattrape-le!'); } if (e.type === 'trou') audio.fx('chomp'); } }, 220);
        }
        if (T.boss && e.cd <= 0.05 && Math.random() < dt * 0.3 && G.enemies.length < 14) { spawnEnemy('cone', e.x + (Math.random() - 0.5) * 4, e.z + (Math.random() - 0.5) * 4, { camp: e.camp }); const c = G.camps.get(e.camp); if (c) c.alive++; toast('Le Cône Suprême appelle des renforts!'); }
      }
    }
    e.moving = Math.hypot(tvx, tvz) > 0.3;
    if (e.type === 'trou') { tvx *= 0.5; tvz *= 0.5; }
    const k = Math.min(1, dt * (e.ground || T.fly ? 8 : 2));
    e.vx += (tvx - e.vx) * k; e.vz += (tvz - e.vz) * k;
    if (T.fly) { const gy = world.ground(e.x, e.z, e.y + 3); const ty = Math.max(gy + 0.3, e.state === 'chase' ? P.y + 0.2 : gy + 0.8); e.vy += ((ty - e.y) * 3 - e.vy) * Math.min(1, dt * 4); e.x += e.vx * dt; e.z += e.vz * dt; e.y += e.vy * dt; if (world.solid(e.x, e.y + 0.6, e.z) && world.get(e.x, e.y + 0.6, e.z) > 0) e.y += 2 * dt * 5; }
    else { e.vy -= 26 * dt; const wasG = e.ground; moveBody(world, e, dt, true); if (e.hitWall && e.ground && e.moving && e.type !== 'plow') e.vy = 8; if (e.y < -5) { e.hp = 0; e.dead = true; scene.remove(e.model.g); e.label.remove(); continue; } }
    if (e.moving && !(e.charge && e.charge.wind)) { const ty = Math.atan2(-tvx, -tvz); e.yaw += Math.atan2(Math.sin(ty - e.yaw), Math.cos(ty - e.yaw)) * Math.min(1, dt * 8); }
    if (e.state === 'chase' && !e.moving && e.type !== 'plow') { const ty = Math.atan2(-dx, -dz); e.yaw += Math.atan2(Math.sin(ty - e.yaw), Math.cos(ty - e.yaw)) * Math.min(1, dt * 8); }
    e.model.g.position.set(e.x, e.y, e.z); e.model.g.rotation.y = e.yaw;
    const sc = e.hurtT > 0 ? 1.12 : 1; if (!T.boss) e.model.g.scale.setScalar(sc);
    animEnemy(e, e.t, dt);
    if (e.type === 'mouches' && e.state === 'chase' && Math.random() < dt * 0.4) audio.fx('buzz', 0.6);
    // étiquette
    const show = d < 30 && (e.state !== 'hidden'); if (show) { placeLabel(e.label, e.x, e.y + T.h + (T.boss ? 5 : 0.5), e.z); e.hbEl.style.width = Math.max(0, e.hp / e.hpMax * 100) + '%'; } else e.label.style.display = 'none';
  }
  if (G.boss) $('bossbox').querySelector('.fill').style.width = Math.max(0, G.boss.hp / G.boss.hpMax * 100) + '%';
}
// apparition des ennemis selon le biome et l'heure
function spawner(dt) {
  G.spawnT -= dt; if (G.spawnT > 0) return; G.spawnT = 1.3;
  const P = G.P, wild = G.enemies.filter(e => !e.camp).length, cap = mobile ? 5 : 7;
  const night = sky.dayF < 0.35;
  if (wild < cap + (night ? 2 : 0)) {
    const a = Math.random() * 6.28, r = 26 + Math.random() * 22, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
    if (world.loadedAround(x, z, 0)) {
      const col = gen.column(Math.floor(x), Math.floor(z));
      const safe = col.st && col.w > 0.35 && (col.st.type === 'ville' || col.st.type === 'village' || col.st.type === 'cabane');
      const y = world.ground(x, z), wb = world.get(x, y - 0.25, z);
      if (wb !== B.WATER && Math.abs(y - P.y) < 14) {
        let pool;
        if (col.biome === BIOME.BOREALE) pool = night ? ['bureau', 'raton', 'mouches'] : ['mouches', 'mouches', 'raton'];
        else if (col.biome === BIOME.ERABLIERE) pool = night ? ['raton', 'raton', 'bureau'] : ['raton', 'mouches', 'trou'];
        else if (col.biome === BIOME.COLLINES) pool = ['plow', 'plow', night ? 'bureau' : 'mouches'];
        else if (col.biome === BIOME.RIVE) pool = night ? ['raton', 'bureau'] : ['trou', 'raton'];
        else pool = night ? ['bureau', 'bureau', 'raton', 'trou'] : ['trou', 'bureau', 'raton'];
        if (S.q.permis && S.q.permis.st === 'active') pool.push('bureau', 'bureau', 'bureau');
        if (S.q.poutine && S.q.poutine.st === 'active') pool.push('raton', 'raton', 'raton');
        if (S.contract && S.contract.st === 'active') pool.push(S.contract.target, S.contract.target);
        const type = pool[(Math.random() * pool.length) | 0];
        if (!safe || (night && type === 'raton')) spawnEnemy(type, x, z);
      }
    }
  }
  // camps de chantier
  for (const s of gen.allStructs(P.x - 100, P.z - 100, P.x + 100, P.z + 100)) {
    if (s.type !== 'chantier' && s.type !== 'grand') continue;
    const k = s.i + ',' + s.j; let c = G.camps.get(k);
    if (Math.hypot(s.x - P.x, s.z - P.z) > 90 || !world.loadedAround(s.x, s.z, 1)) continue;
    if (c && (c.alive > 0 || G.t - c.cleared < 240)) continue;
    c = { alive: 0, cleared: 0 }; G.camps.set(k, c);
    const m = layout(s);
    for (const sp of m.spawns) { if (sp.type === 'supreme' && S.bossDead) continue; spawnEnemy(sp.type, sp.x, sp.z, { camp: k, lvl: s.type === 'grand' ? Math.max(3, enemyLevel(s.x, s.z)) : undefined }); c.alive++; }
  }
}

// ---------- PNJ ----------
function npcLook(role, seed) {
  const r = mulberry(seed);
  const base = NPCS[role] && NPCS[role].look ? Object.assign({}, NPCS[role].look) : {};
  if (role === 'villageois' || !NPCS[role] || !NPCS[role].look) {
    const coats = [0x2e5fa8, 0x8a1c2a, 0x2c7a3a, 0x6a3a8a, 0xc07a20, 0x3a4a6a, 0xa83a5a], hats = [0xc8282e, 0x1f4fa8, 0xf2c12e, 0x2c5a34, 0xf2f2f2, 0x6a3a8a];
    Object.assign(base, { coat: coats[(r() * coats.length) | 0], hat: hats[(r() * hats.length) | 0], skin: [0xf0c8a0, 0xd8a878, 0xb07a50, 0x8a5a3a][(r() * 4) | 0], hair: [0x5a3a22, 0x2a2a2a, 0xc8a050, 0x8a3a1a, 0xc0c0c0][(r() * 5) | 0], sash: r() < 0.3, hatType: r() < 0.75 ? 'tuque' : 'none', beard: r() < 0.2 ? 0x6a4a3a : null });
  }
  return base;
}
function npcsUpdate(dt) {
  const P = G.P; const near = gen.allStructs(P.x - 120, P.z - 120, P.x + 120, P.z + 120);
  for (const s of near) {
    if (s.type === 'chantier' || s.type === 'grand') continue;
    if (Math.hypot(s.x - P.x, s.z - P.z) > 100 || !world.loadedAround(s.x, s.z, 1)) continue;
    const m = layout(s);
    m.npcs.forEach((n, k) => {
      const key = s.i + ',' + s.j + ':' + k; if (G.npcs.has(key)) return;
      const model = human(Object.assign(npcLook(n.role, s.seed + k * 31), {})); scene.add(model.g);
      const nm = n.role === 'villageois' ? ['Réjean', 'Lise', 'Jocelyn', 'Francine', 'Ti-Paul', 'Manon', 'Gaétan', 'Sylvie', 'Normand', 'Huguette'][(s.seed + k) % 10] : n.role === 'aubergiste' ? 'Aubergiste du village' : n.role === 'commercant' ? 'Dépanneur' : NPCS[n.role].name;
      const npc = { key, role: n.role, s, x: n.x, z: n.z, y: world.ground(n.x, n.z), vx: 0, vy: 0, vz: 0, hw: 0.3, h: 1.75, ground: false, home: { x: n.x, z: n.z }, model, name: nm, t: Math.random() * 9, yaw: Math.random() * 6, wander: Math.random() * 6, walkT: 0, chat: CHATTER[(s.seed + k * 7) % CHATTER.length] };
      npc.label = makeLabel('npc', `<div class="mk"></div><div class="nm">${nm}</div>`); npc.mkEl = npc.label.querySelector('.mk');
      G.npcs.set(key, npc);
    });
    // chaudières de sirop autour des cabanes
    if (s.type === 'cabane') m.items.forEach((it, k) => { const key = 'c' + s.i + ',' + s.j + ':' + k; if (S.taken[key] || G.pickups.some(p => p.key === key)) return; dropPickup('chaudiere', it.x, world.ground(it.x, it.z) + 0.4, it.z, { key, still: true }); });
  }
  let talk = null, td = 2.6;
  for (const [k, n] of G.npcs) {
    const dx = P.x - n.x, dz = P.z - n.z, d = Math.hypot(dx, dz);
    if (d > 140) { scene.remove(n.model.g); n.label.remove(); G.npcs.delete(k); continue; }
    if (!world.loadedAround(n.x, n.z, 0)) continue;
    n.t += dt; let tvx = 0, tvz = 0;
    const fixed = n.role !== 'villageois';
    if (d < 4) { const ty = Math.atan2(dx, dz); n.yaw += Math.atan2(Math.sin(ty - n.yaw), Math.cos(ty - n.yaw)) * Math.min(1, dt * 6); }
    else if (!fixed || Math.hypot(n.home.x - n.x, n.home.z - n.z) > 1.5) {
      n.wander += (Math.random() - 0.5) * dt * 1.5; const hx = n.home.x - n.x, hz = n.home.z - n.z, far = Math.hypot(hx, hz) > (fixed ? 1 : 7);
      const go = far || Math.sin(n.t * 0.4 + n.wander) > 0.2; if (go) { tvx = far ? hx / Math.hypot(hx, hz) * 1.6 : Math.sin(n.wander) * 1.3; tvz = far ? hz / Math.hypot(hx, hz) * 1.6 : Math.cos(n.wander) * 1.3; n.yaw = Math.atan2(-tvx, -tvz); }
    }
    n.vx = tvx; n.vz = tvz; n.vy -= 26 * dt; moveBody(world, n, dt, true); if (n.hitWall && n.ground) n.vy = 7;
    n.walkT += dt * Math.hypot(tvx, tvz) / 3;
    n.model.g.position.set(n.x, n.y, n.z); n.model.g.rotation.y = n.yaw; animHuman(n.model, n.walkT, Math.hypot(tvx, tvz) > 0.2 ? 0.6 : 0, 0, false, false);
    const mk = npcMark(n); n.mkEl.textContent = mk === 'ready' ? '?' : mk === 'avail' ? '!' : ''; n.mkEl.className = 'mk' + (mk === 'ready' ? ' rdy' : '');
    placeLabel(n.label, n.x, n.y + 2.3, n.z, 30);
    if (d < td && Math.abs(P.y - n.y) < 2.5) { td = d; talk = n; }
  }
  G.talkTo = talk;
  const pr = $('prompt');
  if (talk && G.state === 'play') { pr.innerHTML = (isTouch ? '' : '<kbd>E</kbd> ') + 'Parler à ' + talk.name; pr.classList.remove('hidden'); $('tTalk').classList.remove('hidden'); }
  else { pr.classList.add('hidden'); $('tTalk').classList.add('hidden'); }
}
function questsOf(role) { return Object.entries(QUESTS).filter(([id, q]) => q.giver === role); }
function questAvailable(id) { const q = QUESTS[id]; if (S.q[id]) return false; return !(q.requires || []).some(r => !S.q[r] || S.q[r].st !== 'done'); }
function npcMark(n) {
  for (const [id] of questsOf(n.role)) { const s = S.q[id]; if (s && s.st === 'ready') return 'ready'; }
  for (const [id] of questsOf(n.role)) if (questAvailable(id)) return 'avail';
  if (n.role === 'aubergiste') { const c = S.contract; if (c && c.key === n.s.i + ',' + n.s.j && c.st === 'ready') return 'ready'; if (!c) return 'avail'; }
  return '';
}
// ---------- objets au sol ----------
function dropPickup(kind, x, y, z, o) {
  const m = pickupModel(kind === 'gear' ? 'gear' : kind); m.position.set(x, y, z); scene.add(m);
  G.pickups.push(Object.assign({ kind, m, x, y, z, vy: o.still ? 0 : 4, vx: o.still ? 0 : (Math.random() - 0.5) * 3, vz: o.still ? 0 : (Math.random() - 0.5) * 3, t: 0, life: o.still ? 1e9 : 90 }, o));
}
function pickupsUpdate(dt) {
  const P = G.P;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const p = G.pickups[i]; p.t += dt; p.life -= dt;
    const gy = world.ground(p.x, p.z, p.y + 0.5) + 0.35;
    if (!p.still) { p.vy -= 18 * dt; p.y += p.vy * dt; p.x += p.vx * dt; p.z += p.vz * dt; if (p.y < gy) { p.y = gy; p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; } }
    const dx = P.x - p.x, dz = P.z - p.z, dy = P.y + 0.8 - p.y, d = Math.hypot(dx, dz, dy);
    if (p.kind === 'piasse' && d < 3.5 && p.t > 0.4) { p.x += dx / d * dt * 10; p.z += dz / d * dt * 10; p.y += dy / d * dt * 10; }
    p.m.position.set(p.x, p.y + Math.sin(p.t * 3) * 0.1, p.z); p.m.rotation.y = p.t * 2;
    if (d > 150 && !p.still) p.life = 0;
    if (d < 1.4 && p.t > 0.3) {
      if (p.kind === 'chaudiere' && !(S.q.sirop && S.q.sirop.st === 'active')) { if (!G.cdHint || G.t - G.cdHint > 6) { G.cdHint = G.t; toast(S.q.sirop && S.q.sirop.st === 'done' ? 'Pépère a déjà son sirop.' : 'Une chaudière d’eau d’érable… Pépère Tremblay en cherche peut-être.'); } continue; }
      collect(p); p.life = 0;
    }
    if (p.life <= 0) { scene.remove(p.m); G.pickups.splice(i, 1); }
  }
}
function collect(p) {
  if (p.kind === 'piasse') { S.cash += p.val || 1; audio.fx('coin'); floatTxt(p.x, p.y + 0.6, p.z, '+' + (p.val || 1) + ' $', '#8dff6a'); }
  else if (p.kind === 'poutine') { addItem('poutine'); audio.fx('coin'); toast('Poutine ramassée!'); }
  else if (p.kind === 'chaudiere') { S.taken[p.key] = 1; audio.fx('coin'); questEvent('collect', 'chaudiere'); }
  else if (p.kind === 'permis') { audio.fx('quest'); questEvent('collect', 'permis'); }
  else if (p.kind === 'gear') { addItem(p.id, 1, p.r); audio.fx('coin'); toast(ITEMS[p.id].name + ' (' + RARITY[p.r].n + ') ajouté au sac'); }
}
// ---------- quêtes ----------
function questEvent(kind, what) {
  for (const id in S.q) { const s = S.q[id], q = QUESTS[id]; if (s.st !== 'active') continue;
    if ((kind === 'kill' && q.type === 'kill' && q.target === what) || (kind === 'collect' && q.type === 'collect' && q.item === what)) { s.n++; toast(q.title + ' : ' + Math.min(s.n, q.n) + ' / ' + q.n); if (s.n >= q.n) { s.st = 'ready'; audio.fx('quest'); banner('OBJECTIF ATTEINT', 'Retourne voir ' + NPCS[q.giver].name); } } }
  const c = S.contract; if (c && c.st === 'active' && kind === 'kill' && c.target === what) { c.prog++; if (c.prog >= c.n) { c.st = 'ready'; audio.fx('quest'); banner('CONTRAT REMPLI', 'Retourne voir l’aubergiste'); } else toast('Contrat : ' + c.prog + ' / ' + c.n); }
  G.dirtyQ = true;
}
function gainXP(n) {
  S.xp += n; floatTxt(G.P.x, G.P.y + 2.4, G.P.z, '+' + n + ' XP', '#9ae0ff');
  while (S.xp >= xpNext(S.lvl)) { S.xp -= xpNext(S.lvl); S.lvl++; const st = stats(); G.P.hp = st.hpMax; audio.fx('level'); banner('NIVEAU ' + S.lvl + '!', 'PV max ' + st.hpMax + ' · dégâts +10 %'); burst(G.P.x, G.P.y + 1, G.P.z, 0xffd23a, 20, 6); }
}
function reward(r) {
  S.cash += r.cash || 0; if (r.item) addItem(r.item, 1, 0); if (r.give) for (const k in r.give) addItem(k, r.give[k]);
  gainXP(r.xp || 0); audio.fx('quest');
  return `<span class="rw">Récompense : ${r.cash || 0} piasses · ${r.xp} XP${r.item ? ' · ' + ITEMS[r.item].name : ''}${r.give ? ' · ' + Object.entries(r.give).map(([k, v]) => v + ' × ' + ITEMS[k].name).join(', ') : ''}</span>`;
}
function questTargetPos(id) {
  const q = QUESTS[id], s = S.q[id];
  const giverCell = { gaston: [0, 0], lapaperasse: [0, 0], pepere: [1, 0], ginette: [-1, 0] }[q.giver];
  if (s && s.st === 'ready') { const c = gen.cell(...giverCell); return { x: c.x, z: c.z }; }
  if (q.where) { const c = gen.cell(...q.where); return { x: c.x, z: c.z }; }
  if (id === 'sirop') { const c = gen.cell(1, 0); return { x: c.x, z: c.z }; }
  if (id === 'poutine') { const c = gen.cell(-1, 0); return { x: c.x, z: c.z }; }
  return null;
}
// ---------- dialogues ----------
function openDialog(n) {
  G.state = 'dialog'; unlock(); G.dlgNpc = n; audio.fx('ui'); show('dialog'); renderDialog(n);
}
function renderDialog(n, extra) {
  $('dname').textContent = n.name; const btns = []; let txt = '';
  const add = (label, fn, big) => btns.push({ label, fn, big });
  const close = () => closeDialog();
  const qs = questsOf(n.role);
  const ready = qs.find(([id]) => S.q[id] && S.q[id].st === 'ready'), avail = qs.find(([id]) => questAvailable(id)), active = qs.find(([id]) => S.q[id] && S.q[id].st === 'active');
  if (extra) txt = extra;
  else if (ready) { const [id, q] = ready; S.q[id].st = 'done'; txt = q.done + reward(q.reward); if (id === 'permis') S.inv = S.inv.filter(i => i.id !== 'permis'); G.dirtyQ = true; add('MERCI!', () => renderDialog(n)); }
  else if (avail) { const [id, q] = avail; txt = '<b class="gold">' + q.title + '</b><br>' + q.intro; add('ACCEPTER', () => { S.q[id] = { st: 'active', n: 0 }; audio.fx('accept'); toast('Nouvelle quête : ' + q.title); G.dirtyQ = true; writeSave(); closeDialog(); }, true); add('PLUS TARD', close); }
  else if (active) { const [id, q] = active; txt = q.wait + '<br><span class="gold">Progrès : ' + Math.min(S.q[id].n, q.n) + ' / ' + q.n + '</span>'; }
  else if (n.role === 'aubergiste') {
    const key = n.s.i + ',' + n.s.j, c = S.contract;
    if (c && c.key === key && c.st === 'ready') { S.contract = null; S.contractsDone++; txt = 'Bonne job! Le village peut respirer.' + reward({ cash: c.cash, xp: c.xp }); add('MERCI!', () => renderDialog(n)); }
    else if (c && c.key === key) { txt = 'Ton contrat : ' + ENEMIES[c.target].name + ' ' + c.prog + ' / ' + c.n + '. Ils rôdent autour du village.'; add('ABANDONNER LE CONTRAT', () => { S.contract = null; G.dirtyQ = true; renderDialog(n); }); }
    else if (c) { txt = 'Finis donc ton autre contrat avant, au village où tu l’as pris.'; }
    else {
      const biome = gen.column(n.s.x, n.s.z + 30).biome, pool = CONTRACT_TARGETS[biome] || CONTRACT_TARGETS[1], r = mulberry(n.s.seed + S.contractsDone * 17);
      const target = pool[(r() * pool.length) | 0], cnt = 3 + ((r() * 3) | 0), lv = enemyLevel(n.s.x, n.s.z);
      const offer = { key, target, n: cnt, prog: 0, st: 'active', cash: 25 + cnt * 8 * lv, xp: 70 + cnt * 20 * lv };
      txt = 'J’ai un contrat pour toi : débarrasse le coin de <b class="gold">' + cnt + ' × ' + ENEMIES[target].name + '</b>. Je paye ' + offer.cash + ' piasses.';
      add('ACCEPTER', () => { S.contract = offer; audio.fx('accept'); toast('Contrat accepté'); G.dirtyQ = true; closeDialog(); }, true);
    }
  }
  else if (n.role === 'commercant') { txt = 'Bienvenue au dépanneur! On a de tout, ou presque.'; add('MAGASINER', () => openShop(n), true); }
  else if (n.role === 'garde') txt = 'Les remparts sont solides. Les cônes, par exemple, rentrent par les portes comme tout le monde.';
  else if (n.role === 'acericulteur') txt = 'Mon sirop est le meilleur du rang. Le voisin dit la même chose, mais il ment.';
  else txt = n.chat;
  if (!btns.length || !btns.some(b => b.label === 'AU REVOIR')) add('AU REVOIR', close);
  $('dtext').innerHTML = txt;
  const bb = $('dbtns'); bb.innerHTML = '';
  for (const b of btns) { const e = document.createElement('button'); e.className = 'btn' + (b.big ? ' big' : ''); e.textContent = b.label; e.onclick = () => { audio.fx('ui'); b.fn(); }; bb.appendChild(e); }
  setTimeout(() => { const f = bb.querySelector('.btn'); if (f && !isTouch) f.focus(); }, 30);
}
function openShop(n) {
  const wrap = document.createElement('div'); wrap.className = 'shop';
  for (const id of SHOP) { const D = ITEMS[id]; const b = document.createElement('button'); b.innerHTML = `<img src="${itemIcon(id)}"><span>${D.name}<br><small>${D.desc}</small></span><em>${D.price} $</em>`; b.disabled = false;
    b.onclick = () => { if (S.cash < D.price) { audio.fx('deny'); toast('Pas assez de piasses!'); return; } S.cash -= D.price; addItem(id); audio.fx('coin'); toast(D.name + ' acheté'); }; wrap.appendChild(b); }
  renderDialog(n, 'Qu’est-ce que je te sers? Tu as <span class="green">' + S.cash + ' piasses</span>.');
  $('dtext').appendChild(wrap);
}
function closeDialog() { hide('dialog'); G.state = 'play'; G.dlgNpc = null; }

// ---------- interface ----------
function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }
function toast(t) { const d = document.createElement('div'); d.textContent = t; const el = $('toast'); el.appendChild(d); while (el.children.length > 3) el.firstChild.remove(); setTimeout(() => d.remove(), 3400); }
let bannerT = null;
function banner(t, sub) { const b = $('banner'); b.innerHTML = t + (sub ? '<small>' + sub + '</small>' : ''); b.style.opacity = 1; clearTimeout(bannerT); bannerT = setTimeout(() => b.style.opacity = 0, 3200); }
let hudT = 0;
function hudUpdate(dt) {
  const P = G.P, st = stats();
  hudT -= dt; if (hudT > 0 && !G.dirtyHot && !G.dirtyQ) return; hudT = 0.12;
  $('hpbar').querySelector('.fill').style.width = Math.max(0, P.hp / st.hpMax * 100) + '%'; $('hpbar').querySelector('span').textContent = Math.ceil(Math.max(0, P.hp)) + ' / ' + st.hpMax;
  $('stbar').querySelector('.fill').style.width = P.stam * 100 + '%';
  $('xpbar').querySelector('.fill').style.width = Math.min(100, S.xp / xpNext(S.lvl) * 100) + '%';
  $('lvl').textContent = 'NIV. ' + S.lvl + '  ·  ' + S.xp + ' / ' + xpNext(S.lvl) + ' XP';
  $('cash').querySelector('b').textContent = S.cash;
  const col = gen.column(Math.floor(P.x), Math.floor(P.z));
  const place = col.st && col.w > 0.4 ? { ville: 'Vieille-Ville', village: 'Village', cabane: 'Cabane à sucre', chantier: 'Chantier', grand: 'Grand Chantier' }[col.st.type] : BIOME_NAME[col.biome];
  $('where').textContent = place; $('clock').textContent = sky.clock() + (sky.snow > 0.4 ? ' · neige' : '');
  if (G.dirtyHot) { G.dirtyHot = false; renderHot(); }
  if (G.dirtyQ || !G.trackT || G.t - G.trackT > 1) { G.dirtyQ = false; G.trackT = G.t; renderTracker(); }
}
function renderHot() {
  const list = hotList(); if (S.hot >= list.length) S.hot = Math.max(0, list.length - 1);
  const hb = $('hotbar'); hb.innerHTML = '';
  list.forEach((b, i) => { const d = document.createElement('div'); d.className = 's' + (i === S.hot ? ' on' : ''); d.innerHTML = `<img src="${blockIcon(b)}"><i>${S.blocks[b]}</i>`; d.title = NAME[b]; d.onpointerdown = e => { e.stopPropagation(); S.hot = i; renderHot(); }; hb.appendChild(d); });
  if (!list.length) hb.innerHTML = '<div class="s zero"><img src="' + blockIcon(B.DIRT) + '"><i>0</i></div>';
  const w = S.equip.arme || { id: 'baton' }; $('weapon').innerHTML = `<img src="${itemIcon(w.id)}"><div>${ITEMS[w.id].name}<small>${isTouch ? '' : 'Q : changer · R : manger'}</small></div>`;
}
function renderTracker() {
  const out = [];
  for (const id in S.q) { const s = S.q[id], q = QUESTS[id]; if (s.st === 'done') continue; out.push(`<div class="q ${s.st === 'ready' ? 'ready' : ''}"><b>${q.title}</b>${s.st === 'ready' ? 'Retourne voir ' + NPCS[q.giver].name.split(',')[0] : (q.type === 'kill' ? ENEMIES[q.target].name : ITEMS[q.item].name) + ' : ' + Math.min(s.n, q.n) + ' / ' + q.n}</div>`); }
  const c = S.contract; if (c) out.push(`<div class="q ${c.st === 'ready' ? 'ready' : ''}"><b>Contrat du village</b>${c.st === 'ready' ? 'Retourne voir l’aubergiste' : ENEMIES[c.target].name + ' : ' + c.prog + ' / ' + c.n}</div>`);
  if (!out.length) out.push('<div class="q"><b>Explore!</b>Cherche les <span class="gold">!</span> au-dessus des gens.</div>');
  $('tracker').innerHTML = out.slice(0, 3).join('');
}
// mini-carte
const mini = $('mini'), mctx = mini.getContext('2d'), mimg = mctx.createImageData(160, 160);
let miniT = 0;
function topColor(x, z) { const cx = Math.floor(x / CS), cz = Math.floor(z / CS), c = world.chunks.get(cx + ',' + cz); if (!c || !c.top) return null; const i = ((x - cx * CS) + (z - cz * CS) * CS) * 3; return [c.top[i], c.top[i + 1], c.top[i + 2]]; }
function drawMarkers(ctx, cx, cz, scale, W, round) {
  const P = G.P, put = (x, z, col, sz, shape) => { let px = (x - cx) * scale + W / 2, pz = (z - cz) * scale + W / 2; if (round) { const dx = px - W / 2, dz = pz - W / 2, l = Math.hypot(dx, dz); if (l > W / 2 - 6) { px = W / 2 + dx / l * (W / 2 - 6); pz = W / 2 + dz / l * (W / 2 - 6); } } else if (px < 0 || pz < 0 || px > W || pz > W) return;
    ctx.fillStyle = '#0c1420'; ctx.fillRect(px - sz / 2 - 1, pz - sz / 2 - 1, sz + 2, sz + 2); ctx.fillStyle = col; if (shape === 'd') { ctx.save(); ctx.translate(px, pz); ctx.rotate(Math.PI / 4); ctx.fillRect(-sz / 2, -sz / 2, sz, sz); ctx.restore(); } else ctx.fillRect(px - sz / 2, pz - sz / 2, sz, sz); };
  const R = W / scale;
  for (const s of gen.allStructs(cx - R, cz - R, cx + R, cz + R)) put(s.x, s.z, { ville: '#5ab8ff', village: '#ffffff', cabane: '#c8361e', chantier: '#ff7a1a', grand: '#ff3a1a' }[s.type], s.type === 'ville' ? 10 : 7);
  for (const e of G.enemies) if (!e.dead && e.state !== 'hidden') put(e.x, e.z, '#ff4a4a', 4);
  for (const [, n] of G.npcs) { const mk = npcMark(n); if (mk) put(n.x, n.z, mk === 'ready' ? '#8dff6a' : '#ffd23a', 6); }
  for (const id in S.q) if (S.q[id].st !== 'done') { const p = questTargetPos(id); if (p) put(p.x, p.z, S.q[id].st === 'ready' ? '#8dff6a' : '#ffd23a', 10, 'd'); }
  // joueur
  const px = (P.x - cx) * scale + W / 2, pz = (P.z - cz) * scale + W / 2; ctx.save(); ctx.translate(px, pz); ctx.rotate(-G.camYaw); ctx.fillStyle = '#0c1420'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(7, 7); ctx.lineTo(-7, 7); ctx.fill(); ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.fill(); ctx.restore();
}
function miniUpdate(dt) {
  miniT -= dt; if (miniT > 0) return; miniT = 0.25;
  const P = G.P, d = mimg.data, ox = Math.floor(P.x) - 80, oz = Math.floor(P.z) - 80;
  for (let j = 0; j < 160; j++) for (let i = 0; i < 160; i++) { const c = topColor(ox + i, oz + j), k = (i + j * 160) * 4; if (c) { d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; } else { d[k] = 22; d[k + 1] = 34; d[k + 2] = 50; } d[k + 3] = 255; }
  mctx.putImageData(mimg, 0, 0); drawMarkers(mctx, P.x, P.z, 1, 160, true);
}
function drawBigMap() {
  const cv = $('bigmap'), ctx = cv.getContext('2d'), W = 480, P = G.P, sc = 1.5, img = ctx.createImageData(W, W), d = img.data;
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) { const x = Math.floor(P.x + (i - W / 2) / sc), z = Math.floor(P.z + (j - W / 2) / sc); let c = topColor(x, z); const k = (i + j * W) * 4;
    if (!c) { const col = gen.column(x, z); const h = col.h; c = h <= SEA ? [40, 80, 140] : [[200, 190, 140], [100, 150, 70], [50, 90, 60], [170, 70, 40], [210, 215, 225], [150, 150, 150]][col.biome].map(v => v * (0.55 + (h - SEA) * 0.006)); }
    d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255; }
  ctx.putImageData(img, 0, 0); drawMarkers(ctx, P.x, P.z, sc, W, false);
  $('maplegend').innerHTML = '<span style="color:#5ab8ff">■</span> Vieille-Ville &nbsp; ■ Village &nbsp; <span style="color:#c8361e">■</span> Cabane à sucre &nbsp; <span style="color:#ff7a1a">■</span> Chantier &nbsp; <span class="gold">◆</span> Objectif de quête';
}
// sac
let invSel = null;
function renderInv() {
  const st = stats(), e = S.equip, slots = [['arme', 'Arme'], ['tete', 'Tête'], ['mains', 'Mains'], ['corps', 'Corps'], ['pieds', 'Pieds']];
  let h = '<div><div class="eq">' + slots.map(([k, l]) => { const it = e[k]; return `<div class="slot" data-eq="${k}">${it ? `<img src="${itemIcon(it.id)}">` : ''}<div>${it ? `<span style="color:${RARITY[it.r || 0].c}">${ITEMS[it.id].name}</span>` : '<span style="color:#789">(vide)</span>'}<small>${l}</small></div></div>`; }).join('') + '</div>';
  h += `<div class="statl">Niveau ${S.lvl} · PV ${Math.ceil(G.P.hp)} / ${st.hpMax}<br>Dégâts ${Math.round(st.dmg)} · Défense ${st.def}<br>Piasses : <span class="green">${S.cash}</span><br>Cerf-volant fléché : ${S.glider ? 'oui (Espace en l’air)' : 'non'}<br>Ennemis vaincus : ${S.stats.kills} · Blocs cassés : ${S.stats.blocks} · posés : ${S.stats.placed}</div></div>`;
  h += '<div><div class="grid">' + S.inv.map((it, i) => `<div class="cell${invSel === i ? ' sel' : ''}" data-i="${i}"><img src="${itemIcon(it.id)}">${it.n > 1 ? `<i>${it.n}</i>` : ''}</div>`).join('') + '</div>';
  const sel = S.inv[invSel];
  h += '<div id="idesc">' + (sel ? `<span style="color:${RARITY[sel.r || 0].c}">${ITEMS[sel.id].name}</span>${sel.r ? ' (' + RARITY[sel.r].n + ')' : ''} — ${ITEMS[sel.id].desc}${ITEMS[sel.id].dmg ? ' · Dégâts ' + Math.round(ITEMS[sel.id].dmg * RARITY[sel.r || 0].m) : ''}${ITEMS[sel.id].def ? ' · Défense ' + Math.round(ITEMS[sel.id].def * RARITY[sel.r || 0].m) : ''}<br>` + (ITEMS[sel.id].slot === 'conso' ? '<button class="btn sm" id="iUse">MANGER</button>' : ITEMS[sel.id].slot !== 'quete' ? '<button class="btn sm" id="iEq">ÉQUIPER</button> <button class="btn sm" id="iSell">VENDRE (' + sellPrice(sel) + ' $)</button>' : '') : 'Choisis un objet.') + '</div>';
  h += '<div class="statl">Blocs : ' + (PLACEABLE.filter(b => S.blocks[b] > 0).map(b => `<img src="${blockIcon(b)}" style="width:1.4em;vertical-align:middle"> ${S.blocks[b]}`).join(' &nbsp; ') || 'aucun — casse des blocs avec F') + '</div></div>';
  $('invbody').innerHTML = h;
  $('invbody').querySelectorAll('.cell').forEach(c => c.onclick = () => { invSel = +c.dataset.i; audio.fx('ui'); renderInv(); });
  const u = $('iUse'); if (u) u.onclick = () => { useItem(sel); invSel = null; renderInv(); };
  const q = $('iEq'); if (q) q.onclick = () => { equip(sel); invSel = null; renderInv(); };
  const s = $('iSell'); if (s) s.onclick = () => { S.cash += sellPrice(sel); S.inv.splice(invSel, 1); invSel = null; audio.fx('coin'); renderInv(); };
}
function sellPrice(it) { return Math.round((ITEMS[it.id].price || 40) * 0.3 * RARITY[it.r || 0].m); }
function renderQuests() {
  let h = '';
  const list = Object.entries(S.q).sort((a, b) => (a[1].st === 'done') - (b[1].st === 'done'));
  for (const [id, s] of list) { const q = QUESTS[id]; h += `<div class="qitem ${s.st}"><b>${q.title}</b> — ${NPCS[q.giver].name}<br>${s.st === 'done' ? 'Terminée.' : s.st === 'ready' ? 'Objectif atteint : retourne voir ' + NPCS[q.giver].name + '.' : q.wait + ' (' + Math.min(s.n, q.n) + ' / ' + q.n + ')'}</div>`; }
  if (S.contract) h += `<div class="qitem ${S.contract.st}"><b>Contrat du village</b><br>${ENEMIES[S.contract.target].name} : ${S.contract.prog} / ${S.contract.n}</div>`;
  const avail = Object.keys(QUESTS).filter(questAvailable).length;
  if (!h) h = '<p>Aucune quête pour l’instant. Parle à Gaston, le crieur public, sur la place de la Vieille-Ville.</p>';
  h += `<p class="gold">${avail} quête(s) à découvrir · ${S.contractsDone} contrat(s) de village rempli(s)</p>`;
  $('qbody').innerHTML = h;
}
function openPanel(id) { if (G.state !== 'play') return; G.state = id; unlock(); show(id); audio.fx('ui'); if (id === 'inv') renderInv(); if (id === 'quests') renderQuests(); if (id === 'map') drawBigMap(); }
function closePanels() { for (const id of ['inv', 'quests', 'map', 'dialog']) hide(id); if (['inv', 'quests', 'map', 'dialog'].includes(G.state)) G.state = 'play'; G.dirtyHot = true; }
function openPause() { if (G.state !== 'play') return; G.state = 'pause'; unlock(); show('pause'); }
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { audio.fx('ui'); const sc = b.closest('.screen'); sc.classList.add('hidden'); if (sc.id === 'help' || sc.id === 'opts') { if (G.prevScreen) show(G.prevScreen); } else closePanels(); });
// options
function bindOpts() {
  const v = $('oView'); v.value = OPT.view; $('oViewV').textContent = OPT.view; v.oninput = () => { OPT.view = +v.value; $('oViewV').textContent = OPT.view; if (world) world.view = OPT.view; G.viewCap = OPT.view; saveOpts(); };
  $('oQual').value = OPT.qual; $('oQual').onchange = () => { OPT.qual = $('oQual').value; applyQuality(); saveOpts(); };
  $('oVol').value = OPT.vol; $('oVol').oninput = () => { OPT.vol = +$('oVol').value; audio.setVol(OPT.vol); saveOpts(); };
  $('oMus').value = OPT.mus; $('oMus').oninput = () => { OPT.mus = +$('oMus').value; audio.setMusic(OPT.mus); saveOpts(); };
  $('oSens').value = OPT.sens; $('oSens').oninput = () => { OPT.sens = +$('oSens').value; saveOpts(); };
  $('oInv').checked = OPT.inv; $('oInv').onchange = () => { OPT.inv = $('oInv').checked; saveOpts(); };
  $('bReset').onclick = () => { if (confirm('Effacer la sauvegarde? Ta partie sera perdue.')) { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(OLD_SAVE_KEY); location.reload(); } };
}
// qualité : définition, ombres portées (soleil/lune), rayon des tronçons détaillés (le reste en demi-résolution)
function applyQuality() {
  const q = OPT.qual === 'auto' ? (mobile ? 'low' : 'high') : OPT.qual; G.qual = q;
  pixelRatio = Math.min(devicePixelRatio || 1, q === 'low' ? 1 : q === 'mid' ? 1.25 : 1.75); renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth, innerHeight);
  const sh = q !== 'low' && !G.autoNoShadow;
  if (renderer.shadowMap.enabled !== sh || G.shadowSize !== (q === 'high' ? 2048 : 1024)) {
    renderer.shadowMap.enabled = sh; renderer.shadowMap.type = THREE.PCFShadowMap; G.shadowSize = q === 'high' ? 2048 : 1024;
    sky.setShadows(sh, G.shadowSize); scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  }
  qualWorld();
}
function qualWorld() { if (!world) return; const q = G.qual || 'high'; world.setShadows(renderer.shadowMap.enabled); world.lod0 = q === 'high' ? 2.6 : q === 'mid' ? 2 : 1.5; }
// ---------- tactile ----------
function setupTouch() {
  if (!isTouch) return; show('touch');
  const stick = $('stick'), knob = $('knob'); let sid = null, sx = 0, sy = 0;
  stick.addEventListener('pointerdown', e => { sid = e.pointerId; const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; stick.setPointerCapture(e.pointerId); mv(e); audio.init(); });
  const mv = e => { if (e.pointerId !== sid) return; const R = stick.clientWidth / 2; let dx = (e.clientX - sx) / R, dy = (e.clientY - sy) / R; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } input.tx = dx; input.tz = dy; input.tRun = l > 0.95; knob.style.transform = `translate(${dx * R * 0.7}px,${dy * R * 0.7}px)`; };
  stick.addEventListener('pointermove', mv);
  const end = e => { if (e.pointerId !== sid) return; sid = null; input.tx = input.tz = 0; input.tRun = false; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  // regard : glisser sur le reste de l'écran
  let lid = null, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; lid = e.pointerId; lx = e.clientX; ly = e.clientY; audio.init(); });
  addEventListener('pointermove', e => { if (e.pointerId !== lid) return; input.look[0] += (e.clientX - lx) * 1.4; input.look[1] += (e.clientY - ly) * 1.4; lx = e.clientX; ly = e.clientY; });
  addEventListener('pointerup', e => { if (e.pointerId === lid) lid = null; });
  const hold = (id, k) => { const b = $(id); b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); input[k] = true; b.classList.add('on'); audio.init(); }); const up = () => { input[k] = false; b.classList.remove('on'); }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up); };
  const tap = (id, fn) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audio.init(); fn(); });
  hold('tAtk', 'tAtk'); hold('tJump', 'tJump'); tap('tJump', () => input.tJumpP = true);
  tap('tBrk', () => input.tBrkP = true); tap('tPlace', () => input.tPlaceP = true); tap('tTalk', () => pressed.add('KeyE'));
  tap('tEat', () => pressed.add('KeyR')); tap('tSwap', () => pressed.add('KeyQ')); tap('tInv', () => pressed.add('KeyI')); tap('tQuest', () => pressed.add('KeyJ')); tap('tMap', () => pressed.add('KeyM')); tap('tPause', () => pressed.add('Escape'));
}

// ---------- déroulement ----------
function makeWorld(edits) {
  if (world) { world.worker.terminate(); scene.remove(world.group); for (const [, c] of world.chunks) for (const m of c.meshes) m.geometry.dispose(); }
  world = new World(scene, gen, SEED, JSON.parse(JSON.stringify(edits || {}))); world.view = OPT.view; G.viewCap = OPT.view; qualWorld();
}
function clearEntities() {
  for (const e of G.enemies) { scene.remove(e.model.g); e.label.remove(); } G.enemies = [];
  for (const [, n] of G.npcs) { scene.remove(n.model.g); n.label.remove(); } G.npcs.clear();
  for (const p of G.pickups) scene.remove(p.m); G.pickups = []; for (const p of G.projs) scene.remove(p.mesh); G.projs = []; G.camps.clear(); G.boss = null; $('bossbox').classList.add('hidden');
}
function startGame(fresh) {
  audio.init(); const old = loadSave();
  S = fresh || !old ? freshSave() : old;
  if (fresh && old && Object.keys(old.edits || {}).length) makeWorld({}); else if (!fresh && old && G.worldEdits !== 'save') makeWorld(S.edits);
  G.worldEdits = 'save';
  clearEntities(); if (G.P) scene.remove(G.P.model.g);
  G.P = makePlayer(); sky.t = S.time; hide('title'); show('loading'); G.state = 'loading'; G.loadT = 0;
  if (fresh) writeSave();
}
function waterUpdate() {
  const u = world.matWa.uniforms; u.time.value = G.t; u.sunDir.value.copy(sky.sun.position).sub(sky.sun.target.position).normalize();
  u.sunCol.value.copy(sky.sun.color); u.skyCol.value.copy(sky.hor).lerp(sky.top, 0.3); u.dayF.value = sky.dayF; u.sunInt.value = Math.min(1.2, sky.sun.intensity / 2);
}
function enterPlay() {
  hide('loading'); show('hud'); G.state = 'play'; G.dirtyHot = true; G.dirtyQ = true; setupTouchOnce();
  const P = G.P; const gy = world.ground(P.x, P.z, P.y + 2); if (P.y < gy - 0.5 || boxHit(world, P.x, P.y, P.z, P.hw, P.h)) P.y = gy;
  if (S.migrated) { delete S.migrated; setTimeout(() => toast('Le monde est maintenant en voxels de 50 cm : tes anciennes constructions ont été remises à zéro.'), 2500); }
  if (!S.q.cones && !S.introDone) { S.introDone = true; banner('VOXELLE-QUÉBEC', 'Va parler à Gaston, le crieur public, sur la place'); }
  else banner('BON RETOUR!', 'Niveau ' + S.lvl + ' · ' + S.cash + ' piasses');
  audio.mode = 'day';
}
let touchSet = false; function setupTouchOnce() { if (!touchSet) { touchSet = true; setupTouch(); } }
function handleKeys() {
  const st = G.state;
  if (st === 'play') {
    if (pressed.has('KeyE') && G.talkTo) openDialog(G.talkTo);
    if (pressed.has('KeyI') || pressed.has('Tab')) openPanel('inv');
    else if (pressed.has('KeyJ')) openPanel('quests');
    else if (pressed.has('KeyM')) openPanel('map');
    else if (pressed.has('Escape') || pressed.has('KeyP')) openPause();
    if (pressed.has('KeyR')) eat();
    if (pressed.has('KeyQ')) swapWeapon();
    for (let i = 1; i <= 9; i++) if (pressed.has('Digit' + i)) { S.hot = i - 1; G.dirtyHot = true; }
    if (input.wheel) { const n = Math.max(1, hotList().length); S.hot = ((S.hot + input.wheel) % n + n) % n; input.wheel = 0; G.dirtyHot = true; }
  } else if (['inv', 'quests', 'map'].includes(st)) {
    const k = { inv: ['KeyI', 'Tab'], quests: ['KeyJ'], map: ['KeyM'] }[st];
    if (pressed.has('Escape') || k.some(x => pressed.has(x))) closePanels();
  } else if (st === 'dialog') { if (pressed.has('Escape')) closeDialog(); }
  else if (st === 'pause') { if (pressed.has('Escape') || pressed.has('KeyP')) resume(); }
  input.wheel = 0;
}
function resume() { hide('pause'); G.state = 'play'; if (!isTouch) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} } }
let last = performance.now(), perfT = 0, perfAcc = 0, perfN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000); last = now; G.frameAvg += ((now - G.lastNow || 16) - G.frameAvg) * 0.05; G.lastNow = now;
  G.t += dt; pollPad();
  if (window.__bot && G.state !== 'title') try { window.__bot(API, dt); } catch (e) { console.error('bot: ' + e.message); }
  handleKeys();
  const st = G.state;
  if (st === 'title') {
    const a = G.t * 0.05, cx = gen.VX, cz = gen.VZ - 6;
    camera.position.set(cx + Math.sin(a) * 62, gen.VH + 30, cz + Math.cos(a) * 62); camera.lookAt(cx, gen.VH + 8, cz);
    world.update(cx, cz, 4); sky.t = 0.36 + Math.sin(G.t * 0.02) * 0.02; sky.update(dt, camera.position, G.t, world.view * CS, 0); audio.mode = 'title';
  } else if (st === 'loading') {
    const P = G.P; world.update(P.x, P.z, 4); G.loadT += dt;
    const ok = world.loadedAround(P.x, P.z, 2), f = world.loadedFrac();
    $('loadfill').style.width = Math.min(100, (ok ? 60 : 0) + f * 40) + '%'; $('loadtxt').textContent = 'Génération du monde… ' + Math.round(Math.min(100, (ok ? 60 : 0) + f * 40)) + ' %';
    camUpdate(dt); sky.update(dt, camera.position, G.t, world.view * CS, 0);
    if (ok && (f > 0.35 || G.loadT > 6)) enterPlay();
  } else {
    const P = G.P;
    if (st === 'play') {
      playerUpdate(dt); enemiesUpdate(dt); npcsUpdate(dt); pickupsUpdate(dt); projUpdate(dt); spawner(dt);
      sky.t = (sky.t + dt / DAY_LEN) % 1;
      G.weatherT -= dt; if (G.weatherT <= 0) { sky.snowT = Math.random() < 0.35 ? 1 : 0; G.weatherT = 90 + Math.random() * 150; }
      G.saveT += dt; if (G.saveT > 20) { G.saveT = 0; writeSave(); }
      // qualité automatique
      perfAcc += dt; perfN++; perfT += dt;
      if (perfT > 4) { const avg = perfAcc / perfN; G.fps = Math.round(1 / avg); perfT = perfAcc = perfN = 0;
        if (OPT.qual === 'auto') {
          if (avg > 0.045 && renderer.shadowMap.enabled) { G.autoNoShadow = true; applyQuality(); }
          else if (avg > 0.034 && world.view > 3) world.view--; else if (avg < 0.019 && world.view < G.viewCap) world.view++; } }
      const chasing = G.enemies.some(e => e.state === 'chase' && Math.hypot(e.x - P.x, e.z - P.z) < 22);
      audio.combat += ((chasing ? 1 : 0) - audio.combat) * Math.min(1, dt * 0.8);
      audio.mode = sky.dayF < 0.3 ? 'night' : 'day';
    } else { for (const e of G.enemies) e.label.style.display = 'none'; }
    world.update(P.x, P.z, 3);
    camUpdate(dt); partsUpdate(dt);
    const col = gen.column(Math.floor(P.x), Math.floor(P.z));
    sky.update(dt, camera.position, G.t, world.view * CS, col.biome === BIOME.COLLINES ? 0.85 : 0);
    if (st === 'play') { hudUpdate(dt); miniUpdate(dt); }
  }
  pressed.clear();
  waterUpdate();
  renderer.render(scene, camera);
}
// boutons
$('bCont').onclick = () => startGame(false);
$('bNew').onclick = () => { if (loadSave() && !confirm('Commencer une nouvelle partie? L’ancienne sauvegarde sera remplacée.')) return; startGame(true); };
$('bHelp').onclick = () => { G.prevScreen = 'title'; hide('title'); show('help'); };
$('bOpts').onclick = () => { G.prevScreen = 'title'; hide('title'); show('opts'); };
$('bResume').onclick = () => resume();
$('bSave').onclick = () => { if (writeSave()) toast('Partie sauvegardée'); };
$('bPOpts').onclick = () => { G.prevScreen = 'pause'; hide('pause'); show('opts'); };
$('bPHelp').onclick = () => { G.prevScreen = 'pause'; hide('pause'); show('help'); };
$('bQuit').onclick = () => { writeSave(); hide('pause'); hide('hud'); hide('touch'); touchSet = false; clearEntities(); scene.remove(G.P.model.g); G.state = 'title'; show('title'); $('bCont').classList.remove('hidden'); };
$('bRespawn').onclick = () => respawn();
// démarrage
bindOpts(); applyQuality();
const saved = loadSave(); if (!saved) $('bCont').classList.add('hidden');
makeWorld(saved ? saved.edits : {}); G.worldEdits = saved ? 'save' : 'none';
requestAnimationFrame(frame);
// point d'entrée pour les tests automatiques
const API = { G, get S() { return S; }, get world() { return world; }, sky, input, gen, keys, pressed, camera, stats, xpNext, hotList, questTargetPos, layout, writeSave, startGame, openDialog, closeDialog, QUESTS, ENEMIES, B, eat, spawnEnemy, toast, renderer, applyQuality, OPT };
window.__game = API;

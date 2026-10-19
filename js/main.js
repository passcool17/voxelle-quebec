// Voxelle-Québec : RPG d'exploration en voxels, Québec satirique. Fil principal : jeu, entités, quêtes, interface.
import * as THREE from 'three';
import { createGen, BIOME, BIOME_NAME, layout, CELL } from './worldgen.js';
import { REGIONS, Z_ROAD0, Z_END } from './nord.js';
import { World, moveBody, boxHit } from './world.js';
import { B, CSM as CS, SEA, NAME, PLACEABLE, DROP, DROP_ITEM, SOLID, COL, LEAF, VS, IVS } from './blocks.js';
import { RECIPES, mineTime, toolFor, missing, consume } from './craft.js';
import { Sky } from './sky.js';
import { Audio } from './audio.js';
import { Ambiance } from './fx.js';
import { TALENTS, TAL, talentFx, points as talentPts, canLearn, spentIn } from './talents.js';
import { gearLook, human, PLAYER_LOOKS, setWeapon, animHuman, glider, enemyModel, animEnemy, pickupModel, box, carModel, critterModel } from './models.js';
import { ITEMS, RARITY, SHOP, SHOPS, ENEMIES, NPCS, CHATTER, ROLE_CHAT, QUESTS, CONTRACT_TARGETS, AMBIENT } from './data.js';
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
const amb = new Ambiance(scene, mobile);
// ombre ronde sous les personnages quand les ombres portées sont coupées (mobile, qualité basse)
const blobGeo = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2), blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
function addBlob(g, r) { const b = new THREE.Mesh(blobGeo, blobMat); b.scale.setScalar(r / (g.scale.x || 1)); b.position.y = 0.04 / (g.scale.x || 1); b.renderOrder = 1; g.add(b); return b; }

// ---------- état ----------
const G = { state: 'title', t: 0, P: null, enemies: [], npcs: new Map(), pickups: [], projs: [], parts: [], rings: [], critters: [], flock: null, flockT: 25, sayT: 4, hitstop: 0, shake: 0, dbg: { fin: 0, hs: 0 }, camps: new Map(), spawnT: 0, saveT: 0, frameAvg: 16, lastStruct: null, weatherT: 60, fps: 60, regSeen: {}, regKey: null, car: null, drive: false, mapZ: 0 };
function freshSave() {
  return { v: 2, pos: [gen.VX + 2.5, gen.VH + 1, gen.VZ + 10.5], yaw: Math.PI, hp: 100, lvl: 1, xp: 0, cash: 15, inv: [{ id: 'poutine', n: 3 }], equip: { arme: { id: 'baton' }, tete: { id: 'tuque' }, mains: null, corps: null, pieds: null },
    weapons: [{ id: 'baton' }], wi: 0, blocks: { [B.PLANK]: 96, [B.COBBLE]: 64, [B.LAMP]: 16, [B.GLASS]: 24, [B.LOG]: 6 }, hot: 0, q: {}, contract: null, contractsDone: 0, bureauKills: 0, taken: {}, bossDead: false, time: 0.32, edits: {}, stats: { kills: 0, blocks: 0, placed: 0, glide: 0, dist: 0 }, glider: true };
}
let S = null; // sauvegarde active
function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 2) return normSave(s); } catch (e) {}
  try { const o = JSON.parse(localStorage.getItem(OLD_SAVE_KEY)); if (o && o.v === 1) { o.v = 2; o.edits = {}; o.migrated = true; return normSave(o); } } catch (e) {}
  return null;
}
// anciennes sauvegardes : on complète les champs ajoutés depuis (sans rien perdre)
function normSave(s) {
  const f = freshSave();
  for (const k of ['blocks', 'inv', 'equip', 'stats', 'q', 'taken', 'edits']) if (!s[k] || typeof s[k] !== 'object') s[k] = f[k];
  for (const k in f.stats) if (s.stats[k] == null) s.stats[k] = 0;
  s.stats.crafted = s.stats.crafted || 0; s.stats.mined = s.stats.mined || 0; if (!s.tal || typeof s.tal !== 'object') s.tal = {};
  return s;
}
function writeSave() {
  if (!S || !G.P) return;
  const P = G.P; S.pos = [P.x, P.y, P.z]; S.yaw = G.camYaw; S.hp = P.hp; S.time = sky.t; S.edits = world ? world.edits : S.edits;
  if (G.car) S.car = { x: +G.car.x.toFixed(2), z: +G.car.z.toFixed(2), yaw: +G.car.yaw.toFixed(3) };
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
  if (edge(5)) input.gpBrkP = true; if (edge(6)) input.rmbP = true; if (edge(9)) pressed.add('Escape'); if (edge(8)) pressed.add('KeyI');
  if (edge(14)) input.wheel -= 1; if (edge(15)) input.wheel += 1; if (edge(12)) pressed.add('KeyJ'); if (edge(13)) pressed.add('KeyM'); if (edge(10)) pressed.add('KeyC');
  input.gpAtk = b(7); input.gpRun = b(4); input.gpJump = b(0); input.gpBrk = b(5);
  input.gpPrev = now; if (now.some(x => x)) audio.init();
}
const dz = v => Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85;

// ---------- joueur ----------
function stats() {
  const e = S.equip; let def = 0, spd = 0;
  for (const k of ['tete', 'mains', 'corps', 'pieds']) if (e[k]) { const it = ITEMS[e[k].id]; def += (it.def || 0) * RARITY[e[k].r || 0].m; spd += it.spd || 0; }
  const w = e.arme ? ITEMS[e.arme.id] : ITEMS.baton, wm = e.arme ? RARITY[e.arme.r || 0].m : 1, tf = G.tf || talentFx(S);
  return { def: Math.round(def), spd: spd + tf.spd, hpMax: Math.round((100 + 14 * (S.lvl - 1)) * (1 + tf.hp)), dmg: w.dmg * wm * (1 + 0.1 * (S.lvl - 1)) * (1 + tf.dmg), W: w };
}
const xpNext = l => 100 + (l - 1) * (l - 1) * 60 + (l - 1) * 80;
// personnage choisi (gars = le héros, fille = l'héroïne) : gardé à part de la sauvegarde, changeable au menu
const PERSO_KEY = 'voxelle-quebec-perso';
const perso = () => localStorage.getItem(PERSO_KEY) === 'fille' ? 'fille' : 'gars';
const PERSO_NOM = { gars: 'LE HÉROS', fille: 'L’HÉROÏNE' };
// talents : effets recalculés quand on apprend un talent ou qu'on charge une partie
function refreshTalents() { G.tf = talentFx(S); G.mineBonus = G.tf.mine; G.oreBonus = G.tf.ore; }
// modèle du joueur : le personnage choisi + l'équipement porté (tuque, casque, dossard, épaulettes, mitaines, bottes, raquettes)
function playerModel() { const m = human(gearLook(PLAYER_LOOKS[perso()], S.equip)); setWeapon(m, S.equip.arme ? S.equip.arme.id : 'baton'); return m; }
function refreshLook() {
  const P = G.P; if (!P) return; const old = P.model, m = playerModel();
  m.g.position.copy(old.g.position); m.g.rotation.copy(old.g.rotation); old.g.remove(P.gl); m.g.add(P.gl); scene.remove(old.g); scene.add(m.g); addBlob(m.g, 0.45);
  m.stepOffV = old.stepOffV; P.model = m;
}
function makePlayer() {
  refreshTalents();
  const m = playerModel();
  const gl = glider(); gl.position.set(0, 2.25, 0); gl.visible = false; m.g.add(gl);
  scene.add(m.g); addBlob(m.g, 0.45);
  const P = { x: S.pos[0], y: S.pos[1], z: S.pos[2], vx: 0, vy: 0, vz: 0, hw: 0.3, h: 1.75, ground: false, hp: S.hp, stam: 1, yaw: S.yaw, model: m, gl, gliding: false, atkT: 0, atkCd: 0, hitAt: -1, iT: 0, buff: 0, brkCd: 0, fallV: 0, walkT: 0, rollT: 0, rollCd: 0, holdT: 0, atkWas: false, atkBuf: 0, combo: 0, lastSwing: -9, spinT: 0 };
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
  if (G.shake > 0.01) { const k = G.shake * 0.5; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; camera.position.z += (Math.random() - 0.5) * k; camera.rotation.z += (Math.random() - 0.5) * k * 0.08; }
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
  if (canRun) P.stam = Math.max(0, P.stam - dt * 0.18 * G.tf.runCost); else P.stam = Math.min(1, P.stam + dt * (P.ground ? 0.25 : 0.1));
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
    audio.wind(sky.snow * 0.12 + sky.rain * 0.22);
    const acc = P.ground ? 14 : inWater ? 5 : 3.2;
    P.vx += (wx * sp - P.vx) * Math.min(1, dt * acc); P.vz += (wz * sp - P.vz) * Math.min(1, dt * acc);
    if (inWater) { P.vy -= 9 * dt; P.vy *= Math.pow(0.2, dt); if (jumpH) P.vy = Math.min(P.vy + 30 * dt, 4.5); }
    else P.vy -= 26 * dt;
    if (jumpP && P.ground && !inWater) { P.vy = 8.6; P.ground = false; audio.fx('jump'); }
    else if (jumpP && !P.ground && !inWater && S.glider && P.vy < 2) { P.gliding = true; P.gl.visible = true; audio.fx('glide'); P.vy = Math.max(P.vy, -4); if (!G.glidedOnce) { G.glidedOnce = true; toast('Cerf-volant fléché déployé!'); } }
    if (pressed.has('KeyG') && !P.ground && S.glider && !inWater) { P.gliding = true; P.gl.visible = true; audio.fx('glide'); }
    // roulade : courte, rapide, invulnérable (C, L3, bouton ROULE)
    const rollP = pressed.has('KeyC') || input.tRollP || (input.bot && input.bot.rollP); input.tRollP = false; if (input.bot) input.bot.rollP = false;
    P.rollCd -= dt;
    if (rollP && P.ground && !inWater && P.rollT <= 0 && P.rollCd <= 0 && P.stam > 0.15) {
      const l = mv > 0.1 ? mv : 0; P.rollDir = l ? [wx / l, wz / l] : [-Math.sin(P.yaw), -Math.cos(P.yaw)]; P.rollT = ROLL_T; P.rollCd = G.tf.gardien ? 0.28 : 0.55; P.stam = Math.max(0, P.stam - (G.tf.gardien ? 0.1 : 0.2));
      P.atkT = 0; P.hitAt = -1; P.holdT = 0; audio.fx('roll'); burst(P.x, P.y + 0.15, P.z, 0xd8d0c0, 6, 2.5);
    }
    if (P.rollT > 0) { P.rollT -= dt; const k = 7 + 7 * Math.max(0, P.rollT / ROLL_T); P.vx = P.rollDir[0] * k; P.vz = P.rollDir[1] * k; P.yaw = Math.atan2(P.rollDir[0], P.rollDir[1]) + Math.PI; }
    else if (mv > 0.1 && P.atkT <= 0) { const ty = Math.atan2(wx, wz) + Math.PI; P.yaw += Math.atan2(Math.sin(ty - P.yaw), Math.cos(ty - P.yaw)) * Math.min(1, dt * 12); }
  }
  if (P.vy < -40) P.vy = -40;
  const fallV = P.vy, wasGround = P.ground; P.stepOff = 0;
  moveBody(world, P, dt, true);
  if (P.stepOff) P.model.stepOffV = (P.model.stepOffV || 0) + P.stepOff;
  P.model.stepOffV = Math.max(0, (P.model.stepOffV || 0) - dt * 7);
  if (P.ground && !inWater && Math.hypot(P.vx, P.vz) > 7 && Math.random() < dt * 9) burst(P.x, P.y + 0.08, P.z, sky.snow > 0.4 || gen.column(Math.floor(P.x), Math.floor(P.z)).biome === BIOME.COLLINES ? 0xf4f8ff : 0xcfc0a0, 1, 1.4);
  if (P.ground && !wasGround && fallV < -9 && !inWater) { burst(P.x, P.y + 0.1, P.z, 0xd8d0c0, 7, 3); ring(P.x, P.y + 0.06, P.z, 0.3, 1.3, 0.3, 0xe8e0d0); }
  if (P.ground && !wasGround) { if (fallV < -17 && !inWater) { hurtPlayer(Math.round((-fallV - 17) * 4), null, 'chute'); } else if (fallV < -6) audio.fx('land', 0.6); }
  if (P.y < -10) { P.y = gen.heightAt(P.x, P.z) + 3; P.vy = 0; }
  S.stats.dist += Math.hypot(P.vx, P.vz) * dt;
  // attaque
  P.atkCd -= dt; P.iT -= dt; P.buff -= dt; P.brkCd -= dt;
  // attaque : un clic = un coup (enchaîner 3 coups = coup final) ; garder enfoncé = coup chargé tournoyant
  const atkDown = !!(input.lmb || input.gpAtk || input.tAtk || (input.bot && input.bot.atk));
  if (P.rollT <= 0 && !G.drive) {
    if (atkDown && !P.atkWas) P.atkBuf = 0.3;
    if (st.W.kind === 'ranged') { if (atkDown) tryAttack(st); }
    else {
      const CHARGE_T = CHARGE_T0 * (G.tf.patin ? 0.6 : 1);
      if (atkDown) { const h0 = P.holdT; P.holdT += dt; if (h0 < CHARGE_T && P.holdT >= CHARGE_T) { audio.fx('charge'); burst(P.x, P.y + 1.2, P.z, 0xffd23a, 8, 3); } if (P.holdT > CHARGE_T && Math.random() < dt * 14) burst(P.x + (Math.random() - 0.5), P.y + 0.3 + Math.random() * 1.4, P.z + (Math.random() - 0.5), 0xffd23a, 1, 1.5); }
      else { if (P.holdT >= CHARGE_T) chargedAttack(st); P.holdT = 0; }
      if (P.atkBuf > 0 && P.atkCd <= 0) { P.atkBuf = 0; tryAttack(st); }
    }
  }
  P.atkWas = atkDown; P.atkBuf -= dt; P.spinT -= dt;
  if (P.atkT > 0) { P.atkT += dt / Math.max(0.3, st.W.cd); if (P.atkT >= 1) P.atkT = 0; }
  if (P.hitAt > 0) { P.hitAt -= dt; if (P.hitAt <= 0) melee(st); }
  // bloc visé
  const cd = tmpV.copy(camera.getWorldDirection(tmpV2)), co = camera.position;
  const hit = world.ray(co, cd, G.camDist + 8);
  G.target = null;
  if (hit) { const hx = hit.x + VS / 2, hy = hit.y + VS / 2, hz = hit.z + VS / 2; if (Math.hypot(hx - P.x, hy - (P.y + 1.4), hz - P.z) < 6.2) G.target = hit; }
  outline.visible = !!G.target && !isTouch || (!!G.target && isTouch);
  if (G.target) outline.position.set(G.target.x + VS / 2, G.target.y + VS / 2, G.target.z + VS / 2);
  mineUpdate(dt);
  if (input.rmbP || input.tPlaceP || (input.bot && input.bot.placeP)) placeBlock(); input.rmbP = false; input.tPlaceP = false; if (input.bot) input.bot.placeP = false;
  // modèle
  const m = P.model; m.g.position.set(P.x, P.y - (m.stepOffV || 0), P.z); m.g.rotation.y = P.yaw + (P.spinT > 0 ? (1 - P.spinT / 0.32) * Math.PI * 2 : 0);
  P.walkT += dt * Math.min(1.4, Math.hypot(P.vx, P.vz) / 5.4);
  animHuman(m, P.walkT, P.ground ? Math.min(1, Math.hypot(P.vx, P.vz) / 5) : 0, P.atkT, !P.ground && !inWater, P.gliding);
  if (P.gliding) { P.gl.rotation.z = Math.max(-0.4, Math.min(0.4, (mx) * -0.3)); }
  // roulade avant : rotation autour du centre du corps (avant = −z, donc angle négatif)
  if (P.rollT > 0) { const a = -(1 - P.rollT / ROLL_T) * Math.PI * 2, c = 0.55; m.body.rotation.x = a; m.body.position.set(0, c - c * Math.cos(a), -c * Math.sin(a)); }
  else if (m.body.rotation.x) { m.body.rotation.x = 0; m.body.position.z = 0; }
  if (P.holdT > CHARGE_T0 * (G.tf.patin ? 0.6 : 1)) { m.P.armR.rotation.x = 2.6; m.P.torso.rotation.y = -0.6; }
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
    let ax = fx, az = fz;
    if (best) { // visée avec anticipation (cibles mobiles : goélands, ratons)
      const tf = Math.hypot(best.x - P.x, best.z - P.z) / st.W.speed, lx = best.x + best.vx * tf - P.x, lz = best.z + best.vz * tf - P.z, d = Math.hypot(lx, lz) || 1, ly = best.y + (best.vy || 0) * tf + best.T.h * 0.5;
      ax = lx / d; az = lz / d; vy = (ly - (P.y + 1.4)) / Math.max(1, d) + d * 0.012; }
    const v = new THREE.Vector3(ax, vy, az).normalize().multiplyScalar(st.W.speed);
    spawnProj({ x: P.x + fx * 0.6, y: P.y + 1.4, z: P.z + fz * 0.6 }, v, 'p', st.dmg, 'snow'); audio.fx('throw');
  } else { P.hitAt = 0.11; audio.fx('swing'); P.combo = G.t - P.lastSwing < 0.95 ? P.combo + 1 : 1; P.lastSwing = G.t; if (P.combo >= 3) { P.fin = true; P.combo = 0; P.atkCd *= 1.25; } }
}
const ROLL_T = 0.42, CHARGE_T0 = 0.6;
function chargedAttack(st) {
  const P = G.P; P.atkCd = st.W.cd * 1.3; P.atkT = 0; P.hitAt = -1; P.spinT = 0.32; P.combo = 0;
  audio.fx('swing'); audio.fx('boom', 0.6); ring(P.x, P.y + 0.12, P.z, 0.6, st.W.range + 1.2, 0.35, 0xffd23a);
  melee(st, { mult: 2.2, kbm: 2.2, all: true, add: G.tf.patin ? 1.8 : 1.0, heavy: true });
  G.shake = Math.max(G.shake, 0.45);
}
function melee(st, o = {}) {
  const P = G.P, fy = P.yaw, W = st.W; let n = 0;
  if (P.fin && !o.all) { P.fin = false; o = { mult: 1.6, kbm: 1.9, heavy: true, fin: true }; }
  for (const e of G.enemies) {
    if (e.dead) continue; const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz);
    if (d > W.range + e.T.hw + (o.add || 0) || Math.abs(e.y - P.y) > 2.2 + (e.T.boss ? 2 : 0)) continue;
    const a = Math.atan2(-dx, -dz), da = Math.abs(Math.atan2(Math.sin(a - fy), Math.cos(a - fy)));
    if (!o.all && da > W.arc / 2 && d > 1.1) continue;
    damageEnemy(e, st.dmg * (o.mult || 1), dx / (d || 1), dz / (d || 1), (W.kb || 6) * (o.kbm || 1), { src: 'p', heavy: o.heavy }); n++;
  }
  if (n && o.fin) { G.dbg.fin++; floatTxt(P.x, P.y + 2.6, P.z, 'COMBO!', '#ffd23a'); G.shake = Math.max(G.shake, 0.35); }
  if (n) audio.fx(n && G.enemies.some(e => e.type === 'cone') ? 'bonk' : 'hit');
}
// minage : un appui (F, CASSE, RB) mine le bloc visé jusqu'au bout ; garder enfoncé enchaîne les blocs.
// Le temps dépend de la dureté du bloc et du meilleur outil du sac (pic, hache).
const mineBar = $('minebar');
function mineUpdate(dt) {
  const P = G.P, down = keys.has('KeyF') || input.tBrk || input.gpBrk || (input.bot && input.bot.brk);
  if (pressed.has('KeyF') || input.tBrkP || input.gpBrkP || (input.bot && input.bot.brkP)) P.mineGo = true;
  input.tBrkP = false; input.gpBrkP = false; if (input.bot) input.bot.brkP = false;
  const t = G.target, k = t ? t.x + ',' + t.y + ',' + t.z : null;
  if (!P.mine || P.mine.k !== k) P.mine = { k, p: 0, b: t ? t.b : 0 };
  if (!t || !(P.mineGo || down) || G.drive) { if (!down) P.mineGo = false; P.mine.p = 0; mineBar.style.display = 'none'; outline.material.color.setHex(0x0c1420); return; }
  if (t.b === B.BEDROCK) { if (P.brkCd <= 0) { audio.fx('deny'); toast('Le roc-mère est incassable.'); P.brkCd = 1; } P.mineGo = false; return; }
  const T = mineTime(S, ITEMS, t.b, G.mineBonus || 0); P.mine.p += dt / T;
  if (Math.random() < dt * 10) { burst(t.x + VS / 2, t.y + VS / 2, t.z + VS / 2, COL[t.b][1], 1, 2); }
  if ((P.mine.tick = (P.mine.tick || 0) - dt) <= 0) { P.mine.tick = 0.22; audio.fx('dig', 0.5); if (P.atkT <= 0) P.atkT = 0.001; }
  outline.material.color.setRGB(0.05 + P.mine.p * 0.95, 0.08 + P.mine.p * 0.75, 0.12);
  mineBar.style.display = 'block'; mineBar.firstChild.style.width = Math.min(100, P.mine.p * 100) + '%';
  if (P.mine.p >= 1) { breakBlock(); P.mine = null; P.mineGo = down; mineBar.style.display = 'none'; }
}
function breakBlock() {
  const P = G.P; if (!G.target) return; const t = G.target;
  if (t.b === B.BEDROCK) return;
  if (!world.set(t.x, t.y, t.z, B.AIR)) return;
  audio.fx('break');
  const d = DROP(t.b); if (d && PLACEABLE.includes(d)) { S.blocks[d] = (S.blocks[d] || 0) + 1 + (Math.random() < G.tf.extra ? 1 : 0); }
  const di = DROP_ITEM[t.b]; if (di) { const n = 1 + (Math.random() < (G.oreBonus || 0) ? 1 : 0); addItem(di, n); floatTxt(t.x + VS / 2, t.y + 1, t.z + VS / 2, '+' + n + ' ' + ITEMS[di].name, '#ffd23a'); audio.fx('coin', 0.6); S.stats.mined++; }
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
  const P = G.P; if (G.state !== 'play') return;
  if (P.rollT > 0 && why !== 'chute') { if (!P.dodged || G.t - P.dodged > 0.4) { P.dodged = G.t; floatTxt(P.x, P.y + 2, P.z, 'ESQUIVE!', '#9ae0ff'); } return; }
  if (P.iT > 0 && why !== 'chute') return;
  const st = stats(); d = Math.max(1, Math.round(d * (1 - st.def / (st.def + 30))));
  P.hp -= d; P.iT = 0.45; audio.fx('hurt'); G.shake = Math.max(G.shake, 0.3); floatTxt(P.x, P.y + 2, P.z, '-' + d, '#ff6a6a');
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
  if (G.drive) exitCar();
  const P = G.P, near = P.z < -480 || Math.abs(P.x - gen.VX) > 700 ? gen.nord.stops.slice(1).reduce((a, b) => Math.hypot(b.ax - P.x, b.az - P.z) < Math.hypot(a.ax - P.x, a.az - P.z) ? b : a) : null;
  if (near) { P.x = near.ax; P.z = near.az; P.y = gen.heightAt(P.x, P.z) + 1.5; toast('Tu te réveilles à l’arrêt d’autocar : ' + near.label); }
  else { P.x = gen.VX + 2.5; P.z = gen.VZ + 10.5; P.y = gen.VH + 1; } P.vx = P.vy = P.vz = 0; P.hp = stats().hpMax; P.gliding = false; P.gl.visible = false; P.iT = 2;
  hide('dead'); G.state = 'play'; writeSave();
}
function eat() {
  const order = ['poutine', 'bleuets', 'pate', 'sirop', 'tarte', 'tourtiere']; const P = G.P;
  const it = S.inv.find(i => order.includes(i.id) && i.n > 0) ; if (!it) { toast('Rien à manger dans ton sac.'); audio.fx('deny'); return; }
  if (P.hp >= P.hpMax && it.id !== 'sirop') { toast('Tu n’as pas faim.'); return; }
  useItem(it);
}
function useItem(it) {
  const D = ITEMS[it.id], P = G.P; if (D.slot !== 'conso') return;
  const heal = Math.round(D.heal * (1 + G.tf.food));
  P.hp = Math.min(stats().hpMax, P.hp + heal); if (D.stam) P.stam = 1; if (D.buff) P.buff = D.buff;
  it.n--; if (it.n <= 0) S.inv.splice(S.inv.indexOf(it), 1); audio.fx('eat'); floatTxt(P.x, P.y + 2, P.z, '+' + heal, '#8dff6a'); toast(D.name + ' : +' + heal + ' PV');
}
function swapWeapon() {
  const ws = S.inv.filter(i => ITEMS[i.id].slot === 'arme'); if (!ws.length) { toast('Une seule arme pour l’instant.'); return; }
  equip(ws[0]);
}
function equip(it) {
  const D = ITEMS[it.id]; const slot = D.slot; if (!['arme', 'tete', 'mains', 'corps', 'pieds'].includes(slot)) return;
  const i = S.inv.indexOf(it); if (i >= 0) S.inv.splice(i, 1);
  if (S.equip[slot]) S.inv.push(S.equip[slot]);
  S.equip[slot] = it; if (slot === 'arme') setWeapon(G.P.model, it.id); else refreshLook();
  audio.fx('ui'); toast(D.name + ' équipé' + (slot === 'tete' || slot === 'arme' ? '' : 's'));
  G.dirtyHot = true;
}
function addItem(id, n = 1, r = 0) {
  const D = ITEMS[id];
  if (D.slot === 'conso' || D.slot === 'quete' || D.slot === 'mat') { const it = S.inv.find(i => i.id === id); if (it) it.n += n; else S.inv.push({ id, n }); }
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
// anneaux au sol (onde de choc, coup chargé, zone d'impact) : r0 → r1 pendant life ; r0 === r1 = avertissement clignotant
const ringGeo = new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2);
function ring(x, y, z, r0, r1, life, color) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(x, y, z); m.scale.setScalar(r0); scene.add(m); const r = { m, life, max: life, r0, r1 }; G.rings.push(r); return r;
}
function ringsUpdate(dt) {
  for (let i = G.rings.length - 1; i >= 0; i--) { const r = G.rings[i]; r.life -= dt; const k = 1 - Math.max(0, r.life) / r.max;
    r.m.scale.setScalar(r.r0 + (r.r1 - r.r0) * (r.r0 === r.r1 ? 1 : Math.sqrt(k))); r.m.material.opacity = r.r0 === r.r1 ? 0.35 + 0.45 * Math.abs(Math.sin(k * 18)) : 0.85 * (1 - k);
    if (r.life <= 0) { scene.remove(r.m); r.m.material.dispose(); G.rings.splice(i, 1); } }
}
// éclair blanc sur un ennemi touché (échange temporaire des matériaux)
const FLASH_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff });
function setFlash(g, on) { g.traverse(o => { if (!o.isMesh) return; if (on) { if (!o.userData.mat0) o.userData.mat0 = o.material; o.material = FLASH_MAT; } else if (o.userData.mat0) o.material = o.userData.mat0; }); }
function partsUpdate(dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) { const p = G.parts[i]; p.life -= dt; p.vy -= 14 * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt; p.m.scale.setScalar(Math.max(0.05, p.life)); if (p.life <= 0) { scene.remove(p.m); G.parts.splice(i, 1); } }
}
// ---------- projectiles ----------
const snowGeo = new THREE.BoxGeometry(0.26, 0.26, 0.26);
function spawnProj(o, v, owner, dmg, kind) {
  const mesh = kind === 'snow' || kind === 'motte' ? new THREE.Mesh(snowGeo, new THREE.MeshLambertMaterial({ color: kind === 'motte' ? 0xe8eef8 : 0xf8fbff }))  : (() => { const g = new THREE.Group(); box(g, 0.4, 0.04, 0.52, 0xf8f8f0, 0, 0, 0, true); box(g, 0.26, 0.05, 0.05, 0x2040a0, 0, 0.01, -0.12); return g; })();
  mesh.position.set(o.x, o.y, o.z); scene.add(mesh);
  if (kind === 'motte') mesh.scale.setScalar(1.7);
  const pr = { pos: mesh.position, vel: v, owner, dmg, kind, mesh, life: 3 }; G.projs.push(pr); return pr;
}
function projUpdate(dt) {
  const P = G.P;
  for (let i = G.projs.length - 1; i >= 0; i--) {
    const p = G.projs[i]; p.life -= dt; let dead = p.life <= 0;
    if (p.kind === 'snow' || p.kind === 'motte') p.vel.y -= 9 * dt; else { p.mesh.rotation.y += dt * 9; const dx = P.x - p.pos.x, dy = P.y + 1 - p.pos.y, dz = P.z - p.pos.z, l = Math.hypot(dx, dy, dz) || 1; p.vel.x += dx / l * dt * 4; p.vel.y += dy / l * dt * 4; p.vel.z += dz / l * dt * 4; }
    p.pos.addScaledVector(p.vel, dt);
    if (world.solid(p.pos.x, p.pos.y, p.pos.z) && world.get(p.pos.x, p.pos.y, p.pos.z) > 0) dead = true;
    if (!dead && p.owner === 'p') for (const e of G.enemies) { if (e.dead) continue; const r = e.T.hw + 0.35; if (Math.abs(p.pos.x - e.x) < r && Math.abs(p.pos.z - e.z) < r && p.pos.y > e.y - 0.2 && p.pos.y < e.y + e.T.h + 0.3) { const l = Math.hypot(p.vel.x, p.vel.z) || 1; damageEnemy(e, p.dmg, p.vel.x / l, p.vel.z / l, 4, { src: 'p', light: true }); dead = true; break; } }
    if (p.kind === 'motte') { if (!dead && Math.abs(p.pos.x - P.x) < 0.6 && Math.abs(p.pos.z - P.z) < 0.6 && p.pos.y > P.y && p.pos.y < P.y + 1.9) dead = true;
      if (dead) { if (p.mark) p.mark.life = 0; ring(p.pos.x, p.pos.y + 0.05, p.pos.z, 0.3, 1.9, 0.3, 0xffffff); burst(p.pos.x, p.pos.y, p.pos.z, 0xffffff, 8, 4); audio.fx('splat'); if (Math.hypot(p.pos.x - P.x, p.pos.z - P.z) < 1.9 && Math.abs(p.pos.y - P.y - 0.5) < 1.8) hurtPlayer(p.dmg, { x: p.pos.x - p.vel.x, z: p.pos.z - p.vel.z }, 'une motte de neige'); scene.remove(p.mesh); G.projs.splice(i, 1); continue; } }
    if (!dead && p.owner === 'e' && p.kind === 'form' && Math.abs(p.pos.x - P.x) < 0.55 && Math.abs(p.pos.z - P.z) < 0.55 && p.pos.y > P.y && p.pos.y < P.y + 1.9) { hurtPlayer(p.dmg, { x: p.pos.x - p.vel.x, z: p.pos.z - p.vel.z, T: { name: 'un formulaire en trois copies' } }, 'un formulaire'); audio.fx('paper'); dead = true; }
    if (dead) { burst(p.pos.x, p.pos.y, p.pos.z, p.kind === 'snow' ? 0xffffff : 0xf8f8f0, 5, 3); if (p.kind === 'snow') audio.fx('splat', 0.5); scene.remove(p.mesh); G.projs.splice(i, 1); }
  }
}
// ---------- ennemis ----------
function enemyLevel(x, z) { const rl = gen.reg.level(x, z); if (rl) return rl; if (z < -480) return Math.min(6, 3 + Math.floor((-480 - z) / 700)); return 1 + Math.floor(Math.hypot(x - gen.VX, z - gen.VZ) / 220); }
function spawnEnemy(type, x, z, opt = {}) {
  const T = ENEMIES[type], lvl = opt.lvl || enemyLevel(x, z), y = world.ground(x, z);
  const M = enemyModel(type); scene.add(M.g); if (!T.fly) addBlob(M.g, Math.max(0.4, T.hw * 1.2));
  const hpm = 1 + 0.3 * (lvl - 1);
  const e = { type, T, lvl, x, y, z, vx: 0, vy: 0, vz: 0, hw: T.hw, h: T.h, ground: false, hp: T.hp * hpm, hpMax: T.hp * hpm, dmg: T.dmg * (1 + 0.18 * (lvl - 1)), model: M, state: type === 'trou' ? 'hidden' : 'idle', cd: 1, atkAnim: 0, t: Math.random() * 10, wander: Math.random() * 6.28, home: { x, z }, camp: opt.camp, hurtT: 0, yaw: Math.random() * 6.28, moving: false };
  e.label = makeLabel('foe', `<div class="nm">${T.name} <span class="gold">niv. ${lvl}</span></div><div class="hb"><div></div></div>`);
  e.hbEl = e.label.querySelector('.hb div');
  if (T.boss) { $('bossbox').classList.remove('hidden'); e.phase = 1; e.skT = 4; G.boss = e; bossTitle(e); }
  if (T.fly) e.y += T.dive ? 6 : 0.8;
  G.enemies.push(e); return e;
}
const FOE_COL = { comite: 0x5a6a8a, cone: 0xff7a1a, supreme: 0xff7a1a, bureau: 0xf8f8f0, plow: 0xf28a1a, raton: 0x8d8a84, mouches: 0x202020, trou: 0x4a4c50, orignal: 0x4a3020, souffleuse: 0xd83a1a, goeland: 0xf2f2f2 };
const PHASES_BY = { supreme: ['', 'Inspection de chantier', 'Zone de travaux élargie', 'Heures supplémentaires'], comite: ['', 'Réunion de démarrage', 'Comité élargi', 'Prolongation des travaux'] };
let PHASES = PHASES_BY.supreme;
function bossTitle(e) { PHASES = PHASES_BY[e.type] || PHASES_BY.supreme; $('bossname').innerHTML = e.T.name + ' (niv. ' + e.lvl + ') <small>· phase ' + e.phase + ' : ' + PHASES[e.phase] + '</small>'; }
function damageEnemy(e, dmg, nx, nz, kb, o = {}) {
  const crit = Math.random() < 0.12 + (o.src === 'p' ? G.tf.crit : 0), d = Math.round(dmg * (0.88 + Math.random() * 0.24) * (crit ? 1.7 : 1));
  e.hp -= d; e.hurtT = 0.15; e.flashT = 0.09; if (G.dbg.log) G.dbg.log.push(e.type + ":" + d); e.state = e.state === 'hidden' ? 'chase' : e.state === 'idle' ? 'chase' : e.state;
  if (!e.T.boss && e.type !== 'trou') { e.vx += nx * kb; e.vz += nz * kb; e.vy = Math.max(e.vy, 3.5); e.stunT = o.heavy ? 0.5 : 0.28; if (e.dive) { e.dive = null; e.rec = 1.2; } }
  else if (e.T.boss && o.heavy) { e.vx += nx * 2; e.vz += nz * 2; }
  floatTxt(e.x, e.y + e.T.h + 0.4, e.z, (crit ? 'CRITIQUE! ' : '') + d, crit ? '#ffd23a' : o.heavy ? '#ffb04a' : '#ffffff');
  burst(e.x, e.y + e.T.h * 0.6, e.z, FOE_COL[e.type], crit || o.heavy ? 9 : 5, crit || o.heavy ? 5 : 3);
  if (o.src === 'p') { burst(e.x - nx * e.T.hw, e.y + e.T.h * 0.55, e.z - nz * e.T.hw, 0xfff0a0, 3, 6); G.hitstop = Math.max(G.hitstop, o.light ? 0.02 : crit || o.heavy ? 0.09 : 0.05); G.dbg.hs = Math.max(G.dbg.hs, G.hitstop); G.shake = Math.max(G.shake, crit || o.heavy ? 0.28 : o.light ? 0.04 : 0.12); if (crit) audio.fx('crit'); }
  if (e.T.boss) { const ph = e.hp < e.hpMax * 0.33 ? 3 : e.hp < e.hpMax * 0.66 ? 2 : 1;
    if (ph > e.phase && e.hp > 0) { e.phase = ph; bossTitle(e); e.skT = 1.5; G.shake = 0.6; audio.fx('boom'); audio.fx('horn'); banner('PHASE ' + ph + ' : ' + PHASES[ph].toUpperCase(), ph === 2 ? 'Il tape du pied : saute ou roule (C) pour éviter l’onde!' : 'Il fonce sur toi! Roule sur le côté au dernier moment.'); ring(e.x, e.y + 0.1, e.z, 1, 9, 0.6, 0xff3a1a); } }
  if (e.type === 'souffleuse') audio.fx('blower', 0.5); if (e.type === 'goeland') audio.fx('gull', 0.7);
  if (e.type === 'raton') audio.fx('squeak'); if (e.type === 'plow') audio.fx('horn', 0.5); if (e.type === 'orignal') audio.fx('brame', 0.6);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true; scene.remove(e.model.g); e.label.remove(); if (e.mark) e.mark.life = 0;
  G.hitstop = Math.max(G.hitstop, e.T.boss ? 0.35 : 0.07); G.shake = Math.max(G.shake, e.T.boss ? 1 : 0.22); burst(e.x, e.y + e.T.h * 0.5, e.z, FOE_COL[e.type], 10, 5);
  burst(e.x, e.y + e.T.h * 0.5, e.z, e.type === 'mouches' ? 0x202020 : 0xffffff, 14, 6);
  S.stats.kills++;
  gainXP(Math.round(e.T.xp * (1 + 0.25 * (e.lvl - 1))));
  const [a, b] = e.T.cash; const n = Math.round((a + Math.random() * (b - a)) * (1 + 0.2 * (e.lvl - 1)) * (1 + G.tf.cash));
  for (let k = 0; k < Math.min(6, Math.ceil(n / 3)); k++) dropPickup('piasse', e.x + (Math.random() - 0.5) * 1.5, e.y + 0.6, e.z + (Math.random() - 0.5) * 1.5, { val: Math.ceil(n / Math.min(6, Math.ceil(n / 3))) });
  if (Math.random() < 0.12) dropPickup('poutine', e.x, e.y + 0.6, e.z, {});
  if (Math.random() < (e.T.boss ? 1 : 0.06 + G.tf.luck + (e.elite ? 0.5 : 0))) dropGear(e);
  if (e.type === 'cone' && Math.random() < 0.55) { addItem('plastique', 1); floatTxt(e.x, e.y + e.T.h + 0.8, e.z, '+1 Plastique orange', '#ff9a3a'); }
  if (e.type === 'raton' && e.stole) dropPickup('piasse', e.x, e.y + 0.6, e.z, { val: e.stole });
  if (e.type === 'bureau' && S.q.permis && S.q.permis.st === 'active' && !G.pickups.some(p => p.kind === 'permis')) { S.bureauKills++; if (S.bureauKills >= 3 || Math.random() < 0.25) { dropPickup('permis', e.x, e.y + 0.6, e.z, {}); toast('Le bureaucrate a échappé un formulaire!'); } }
  if (e.T.boss) { if (e.type === 'comite') { S.comiteDead = true; banner('LE COMITÉ EST DISSOUS!', 'Retourne voir Rolande, à L’Étape'); } else { S.bossDead = true; banner('LE CÔNE SUPRÊME EST VAINCU!', 'Les rues sont libres… pour l’instant.'); } $('bossbox').classList.add('hidden'); G.boss = null; }
  questEvent('kill', e.type);
  if (e.camp) { const c = G.camps.get(e.camp); if (c) { c.alive--; if (c.alive <= 0) { c.cleared = G.t; toast('Chantier nettoyé!'); } } }
}
function dropGear(e) {
  const pool = ['tuque', 'mitaines', 'bottes', 'manteau', 'mitaines_doublees', 'pelle', 'baton_carbone', 'lanceur', 'pelle_alu', 'casque_chantier', 'casque_hockey', 'dossard', 'epaulettes', 'gants_travail', 'grattoir', 'raquettes'];
  const id = e.T.boss ? (e.type === 'comite' ? 'baton_carbone' : 'manteau') : pool[(Math.random() * pool.length) | 0];
  dropPickup('gear', e.x, e.y + 0.6, e.z, { id, r: rollRarity(e.T.boss ? 2 : e.elite ? 1 : 0) });
}
// rareté : commun 55 %, rare 30 %, épique 12 %, légendaire 3 % (décalés vers le haut par le talent Trèfle et les ennemis forts)
function rollRarity(min = 0) {
  const l = G.tf.luck * 3, x = Math.random();
  const r = x < 0.03 + l * 0.3 ? 3 : x < 0.15 + l ? 2 : x < 0.45 + l * 1.5 ? 1 : 0;
  return Math.max(min, r);
}
function enemiesUpdate(dt) {
  const P = G.P;
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (e.dead) { G.enemies.splice(i, 1); continue; }
    const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz), T = e.T;
    if (d > 110 && !e.camp || d > 160) { scene.remove(e.model.g); e.label.remove(); G.enemies.splice(i, 1); if (e.camp) { const c = G.camps.get(e.camp); if (c && --c.alive <= 0) G.camps.delete(e.camp); } if (e.T.boss) { $('bossbox').classList.add('hidden'); G.boss = null; } continue; }
    if (!world.loadedAround(e.x, e.z, 0)) continue;
    e.t += dt; e.cd -= dt; e.hurtT -= dt; e.stunT = (e.stunT || 0) - dt; e.flashT = (e.flashT || 0) - dt;
    if ((e.flashT > 0) !== !!e.flashOn) setFlash(e.model.g, e.flashOn = e.flashT > 0); if (e.atkAnim > 0) { e.atkAnim += dt * 2.5; if (e.atkAnim >= 1) e.atkAnim = 0; }
    const alive = G.state === 'play' && P.hp > 0, dy = Math.abs(P.y - e.y);
    let tvx = 0, tvz = 0, sp = T.spd * (e.phase === 3 ? 1.4 : 1);
    if (e.state === 'idle' && alive && d < T.aggro && dy < 8) { e.state = 'chase'; if (e.type === 'plow') audio.fx('horn'); if (e.type === 'orignal') audio.fx('brame'); if (e.type === 'mouches') audio.fx('buzz'); }
    if (e.state === 'chase' && (d > T.aggro * 2.2 || !alive)) e.state = 'idle';
    if (e.type === 'trou') { if (e.state === 'hidden' && alive && d < T.aggro) e.state = 'chase'; if (e.state === 'chase' && d > 9) e.state = 'hidden'; }
    if (e.state === 'idle') { e.wander += (Math.random() - 0.5) * dt * 2; const hx = e.home.x - e.x, hz = e.home.z - e.z; const far = Math.hypot(hx, hz) > 10; tvx = (far ? hx / 10 : Math.sin(e.wander)) * sp * 0.35; tvz = (far ? hz / 10 : Math.cos(e.wander)) * sp * 0.35; if (e.type === 'trou') tvx = tvz = 0; }
    else if (e.state === 'chase' && e.stunT > 0) { tvx = tvz = 0; }
    else if (e.state === 'chase') {
      const ux = dx / (d || 1), uz = dz / (d || 1), bv = T.boss ? bossAI(e, dt, d, ux, uz, dy) : null;
      if (bv) { tvx = bv[0]; tvz = bv[1]; }
      else if (T.lob) { // souffleuse : garde ses distances, s'arrête, puis lance 3 mottes en cloche (zones d'impact marquées au sol)
        if (e.wind) { e.wind -= dt; tvx = tvz = 0; e.yaw = Math.atan2(-dx, -dz);
          if (e.wind <= 0) { e.wind = 0; e.cd = T.cd; e.atkAnim = 0.01; audio.fx('blower');
            for (let k = 0; k < 3; k++) { const tx = P.x + P.vx * 0.5 + (k ? (Math.random() - 0.5) * 4 : 0), tz = P.z + P.vz * 0.5 + (k ? (Math.random() - 0.5) * 4 : 0), ty = world.ground(tx, tz, P.y + 3), fx = e.x - Math.sin(e.yaw) * 0.6, fz = e.z - Math.cos(e.yaw) * 0.6, fy = e.y + 1.3;
              const Tf = 1.0 + Math.hypot(tx - fx, tz - fz) * 0.03, pr = spawnProj({ x: fx, y: fy, z: fz }, new THREE.Vector3((tx - fx) / Tf, (ty - fy + 4.5 * Tf * Tf) / Tf, (tz - fz) / Tf), 'e', e.dmg, 'motte'); pr.mark = ring(tx, ty + 0.06, tz, 1.9, 1.9, Tf + 0.2, 0xff4a4a); } } }
        else { const want = 10, k = d > want + 2 ? 1 : d < want - 3 ? -0.8 : 0; tvx = ux * sp * k - uz * sp * 0.4 * Math.sin(e.t * 0.5); tvz = uz * sp * k + ux * sp * 0.4 * Math.sin(e.t * 0.5);
          if (e.cd <= 0 && d < T.range + 4) { e.wind = 0.7; audio.fx('blower', 0.6); } } }
      else if (T.dive) { // goéland : tourne au-dessus, pique sur le joueur, puis reste étourdi au sol un instant
        if (e.rec > 0) { e.rec -= dt; tvx = tvz = 0; e.wantY = world.ground(e.x, e.z, e.y + 2) + 0.5; }
        else if (e.dive) { e.dive.t -= dt; const dd = Math.hypot(dx, dz, P.y + 1 - e.y); tvx = dx / dd * 14; tvz = dz / dd * 14; e.wantY = P.y + 0.6;
          if (dd < 1.3 && !e.dive.hit) { e.dive.hit = true; hurtPlayer(e.dmg, e, T.name); if (S.cash > 0 && Math.random() < 0.5) { S.cash--; floatTxt(P.x, P.y + 2.2, P.z, '-1 $ (une frite!)', '#ffd23a'); } }
          if (e.dive.hit || e.dive.t <= 0 || e.y < world.ground(e.x, e.z, e.y + 2) + 0.7) { e.dive = null; e.rec = 1.1; e.cd = T.cd; } }
        else { e.orb = (e.orb || Math.random() * 6) + dt * 0.9; const ox = P.x + Math.cos(e.orb) * 7 - e.x, oz = P.z + Math.sin(e.orb) * 7 - e.z, ol = Math.hypot(ox, oz) || 1; tvx = ox / ol * sp; tvz = oz / ol * sp; e.wantY = P.y + 6;
          if (e.cd <= 0 && d < 12) { e.dive = { t: 1.4 }; audio.fx('gull'); } } }
      else if (T.ranged) { const want = 7; const k = d > want + 1 ? 1 : d < want - 2 ? -0.7 : 0; tvx = ux * sp * k + -uz * sp * 0.3 * Math.sin(e.t * 0.7); tvz = uz * sp * k + ux * sp * 0.3 * Math.sin(e.t * 0.7);
        if (e.cd <= 0 && d < T.range + 4) { e.cd = T.cd; e.atkAnim = 0.01; spawnProj({ x: e.x, y: e.y + 1.4, z: e.z }, new THREE.Vector3(ux * 8, 0.6, uz * 8), 'e', e.dmg, 'form'); audio.fx('paper', 0.6); } }
      else if (e.type === 'raton' && e.stole) { tvx = -ux * sp * 1.1; tvz = -uz * sp * 1.1; if (d > 30) { e.state = 'idle'; } }
      else if (e.type === 'plow' || T.charge) {
        if (!e.charge && e.cd <= 0 && d < 18) { e.charge = { t: 0.9, dx: ux, dz: uz, wind: true }; e.state = 'chase'; audio.fx(e.type === 'orignal' ? 'brame' : 'horn'); }
        if (e.charge) { e.charge.t -= dt; if (e.charge.wind) { tvx = tvz = 0; e.yaw = Math.atan2(-e.charge.dx, -e.charge.dz); if (e.charge.t <= 0) { e.charge.wind = false; e.charge.t = 1.4; } } else { tvx = e.charge.dx * 13; tvz = e.charge.dz * 13; if (d < 2.2 && !e.charge.hit) { e.charge.hit = true; hurtPlayer(e.dmg, e, T.name); } if (e.charge.t <= 0 || e.hitWall) { e.charge = null; e.cd = T.cd; } } }
        else { tvx = ux * sp; tvz = uz * sp; }
      } else {
        const reach = T.range + 0.3;
        if (d > reach - 0.3) { tvx = ux * sp; tvz = uz * sp; }
        if (d < reach + (T.boss ? 0.6 : 0) && dy < 2.5 + (T.boss ? 2 : 0) && e.cd <= 0) {
          e.cd = T.cd; e.atkAnim = 0.01;
          setTimeout(() => { if (!e.dead && Math.hypot(P.x - e.x, P.z - e.z) < reach + 0.8) { hurtPlayer(e.dmg, e, T.name); if (e.type === 'raton' && !e.stole && S.cash > 0) { const s = Math.min(S.cash, 3 + (Math.random() * 6 | 0)); S.cash -= s; e.stole = s; toast('Le raton t’a volé ' + s + ' piasses! Rattrape-le!'); } if (e.type === 'trou') audio.fx('chomp'); } }, 220);
        }
        if (T.boss && e.cd <= 0.05 && Math.random() < dt * 0.3 && G.enemies.length < 14) { spawnEnemy('cone', e.x + (Math.random() - 0.5) * 4, e.z + (Math.random() - 0.5) * 4, { camp: e.camp }); const c = G.camps.get(e.camp); if (c) c.alive++; toast(T.name + (e.type === 'comite' ? ' convoque des cônes en sous-comité!' : ' appelle des renforts!')); }
      }
    }
    e.moving = Math.hypot(tvx, tvz) > 0.3;
    if (e.type === 'trou') { tvx *= 0.5; tvz *= 0.5; }
    const k = Math.min(1, dt * (e.stunT > 0 ? 3 : e.ground || T.fly ? 8 : 2));
    e.vx += (tvx - e.vx) * k; e.vz += (tvz - e.vz) * k;
    if (T.fly) { const gy = world.ground(e.x, e.z, e.y + 3); const ty = Math.max(gy + 0.3, e.wantY != null && e.state === 'chase' ? e.wantY : e.state === 'chase' ? P.y + 0.2 : gy + (T.dive ? 5 : 0.8)); e.wantY = null; e.vy += ((ty - e.y) * 3 - e.vy) * Math.min(1, dt * 4); e.x += e.vx * dt; e.z += e.vz * dt; e.y += e.vy * dt; if (world.solid(e.x, e.y + 0.6, e.z) && world.get(e.x, e.y + 0.6, e.z) > 0) e.y += 2 * dt * 5; }
    else { e.vy -= 26 * dt; const wasG = e.ground; moveBody(world, e, dt, true); if (e.hitWall && e.ground && e.moving && e.type !== 'plow') e.vy = 8; if (e.y < -5) { e.hp = 0; e.dead = true; scene.remove(e.model.g); e.label.remove(); continue; } }
    if (e.moving && !(e.charge && e.charge.wind)) { const ty = Math.atan2(-tvx, -tvz); e.yaw += Math.atan2(Math.sin(ty - e.yaw), Math.cos(ty - e.yaw)) * Math.min(1, dt * 8); }
    if (e.state === 'chase' && !e.moving && e.type !== 'plow') { const ty = Math.atan2(-dx, -dz); e.yaw += Math.atan2(Math.sin(ty - e.yaw), Math.cos(ty - e.yaw)) * Math.min(1, dt * 8); }
    e.model.g.position.set(e.x, e.y + (e.stomp && !e.stomp.fired ? Math.max(0, 0.8 - e.stomp.t) * 1.6 : 0), e.z); e.model.g.rotation.y = e.yaw;
    if (e.wind) e.model.g.position.x += Math.sin(e.t * 60) * 0.04;
    const sc = e.hurtT > 0 ? 1.12 : 1; if (!T.boss) e.model.g.scale.setScalar(sc);
    animEnemy(e, e.t, dt);
    if (e.type === 'mouches' && e.state === 'chase' && Math.random() < dt * 0.4) audio.fx('buzz', 0.6);
    // étiquette
    const show = d < 30 && (e.state !== 'hidden'); if (show) { placeLabel(e.label, e.x, e.y + T.h + (T.boss ? 5 : 0.5), e.z); e.hbEl.style.width = Math.max(0, e.hp / e.hpMax * 100) + '%'; } else e.label.style.display = 'none';
  }
  if (G.boss && G.boss.wave) { const w = G.boss.wave, dB = Math.hypot(P.x - G.boss.x, P.z - G.boss.z); w.r += dt * 14; if (!w.hit && Math.abs(dB - w.r) < 0.9 && P.ground && P.y - G.boss.y < 1.0) { w.hit = true; hurtPlayer(G.boss.dmg * 0.9, G.boss, G.boss.T.name); } if (w.r > 13) G.boss.wave = null; }
  if (G.boss) $('bossbox').querySelector('.fill').style.width = Math.max(0, G.boss.hp / G.boss.hpMax * 100) + '%';
}
// Cône Suprême : phase 1 corps-à-corps + renforts ; phase 2 onde de choc (sauter ou rouler) ; phase 3 plus rapide, charges + ondes
function bossAI(e, dt, d, ux, uz, dy) {
  const P = G.P, T = e.T; e.skT -= dt;
  if (e.stomp) { e.stomp.t -= dt;
    if (!e.stomp.fired && e.stomp.t <= 0) { e.stomp.fired = true; e.wave = { r: 1 }; ring(e.x, e.y + 0.12, e.z, 1, 13, 0.9, 0xff7a1a); burst(e.x, e.y + 0.3, e.z, 0xc9ced6, 16, 7); G.shake = Math.max(G.shake, 0.7); audio.fx('boom'); }
    if (e.stomp.t < -0.5) e.stomp = null; return [0, 0]; }
  if (e.bch) { e.bch.t -= dt;
    if (e.bch.wind) { e.yaw = Math.atan2(-e.bch.dx, -e.bch.dz); if (e.bch.t <= 0) { e.bch.wind = false; e.bch.t = 1.1; audio.fx('horn'); } return [0, 0]; }
    if (d < 2.8 && !e.bch.hit) { e.bch.hit = true; hurtPlayer(e.dmg * 1.2, e, T.name); }
    if (e.bch.t <= 0 || e.hitWall) { e.bch = null; e.cd = 1.2; if (e.hitWall) { G.shake = Math.max(G.shake, 0.4); burst(e.x, e.y + 1, e.z, 0xff7a1a, 10, 5); } return [0, 0]; }
    return [e.bch.dx * 12, e.bch.dz * 12]; }
  if (e.phase >= 2 && e.skT <= 0 && d < 14) { e.skT = e.phase === 3 ? 4.2 : 6.5;
    if (e.phase === 3 && (e.lastSk === 'stomp' || d > 7)) { e.lastSk = 'bch'; e.bch = { t: 0.75, wind: true, dx: ux, dz: uz }; ring(e.x, e.y + 0.1, e.z, 2.6, 2.6, 0.75, 0xff3a1a); audio.fx('charge'); }
    else { e.lastSk = 'stomp'; e.stomp = { t: 0.85 }; e.mark = ring(e.x, e.y + 0.1, e.z, 12, 12, 0.85, 0xff3a1a); audio.fx('charge'); }
    return [0, 0]; }
  if (e.phase === 3 && e.cd > 0.6) e.cd -= dt * 0.4; // attaque plus souvent
  return null;
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
      const safe = col.st && col.w > 0.35 && (col.st.type === 'ville' || col.st.type === 'village' || col.st.type === 'cabane' || col.st.safe);
      const y = world.ground(x, z), wb = world.get(x, y - 0.25, z);
      if (wb !== B.WATER && Math.abs(y - P.y) < 14) {
        let pool;
        const rr = col.reg && gen.nord.region(x, z);
        if (rr) pool = rr === 'charlevoix' || rr === 'belvcharl' || rr === 'baie' ? (night ? ['raton', 'bureau', 'orignal'] : ['raton', 'mouches', 'orignal', 'goeland', 'souffleuse'])
          : rr === 'gaspesie' || rr === 'perce' || rr === 'phare' || rr === 'rocher' ? (night ? ['raton', 'bureau', 'goeland'] : ['goeland', 'goeland', 'goeland', 'raton', 'orignal'])
          : (night ? ['cone', 'trou', 'bureau', 'raton'] : ['cone', 'cone', 'trou', 'trou', 'bureau', 'goeland']);
        else if (col.nord) { const nr = gen.nord.region(x, z); pool = nr === 'saguenay' || nr === 'fjord' || nr === 'kenogami' || nr === 'chicoutimi' ? (night ? ['raton', 'bureau', 'mouches', 'souffleuse'] : ['mouches', 'raton', 'orignal', 'goeland', 'goeland']) : night ? ['orignal', 'bureau', 'mouches', 'raton'] : ['mouches', 'mouches', 'orignal', 'orignal', 'raton']; if (col.rd < 10) pool.push('trou', 'cone'); }
        else if (col.biome === BIOME.BOREALE) pool = night ? ['bureau', 'raton', 'mouches'] : ['mouches', 'mouches', 'raton'];
        else if (col.biome === BIOME.ERABLIERE) pool = night ? ['raton', 'raton', 'bureau'] : ['raton', 'mouches', 'trou'];
        else if (col.biome === BIOME.COLLINES) pool = ['plow', 'plow', 'souffleuse', night ? 'bureau' : 'mouches'];
        else if (col.biome === BIOME.RIVE) pool = night ? ['raton', 'bureau', 'souffleuse'] : ['trou', 'raton', 'goeland', 'goeland'];
        else pool = night ? ['bureau', 'bureau', 'raton', 'trou', 'souffleuse'] : ['trou', 'bureau', 'raton', 'goeland', 'souffleuse'];
        if (S.q.permis && S.q.permis.st === 'active') pool.push('bureau', 'bureau', 'bureau');
        if (S.q.poutine && S.q.poutine.st === 'active') pool.push('raton', 'raton', 'raton');
        if (S.contract && S.contract.st === 'active') pool.push(S.contract.target, S.contract.target);
        const type = pool[(Math.random() * pool.length) | 0];
        if (!safe || (night && type === 'raton')) spawnEnemy(type, x, z);
      }
    }
  }
  // le Comité du Grand Plan tient sa réunion au chantier de la 175 (quête « comite »)
  const TW = gen.nord.places.travaux;
  if (S.q.comite && S.q.comite.st === 'active' && !S.comiteDead && !G.boss && Math.hypot(TW.x - P.x, TW.z - P.z) < 70 && world.loadedAround(TW.x, TW.z, 1)) {
    const k = 'comite'; G.camps.set(k, { alive: 4, cleared: 0 }); spawnEnemy('comite', TW.x, TW.z + 3, { camp: k, lvl: 6 }); for (let i = 0; i < 3; i++) spawnEnemy('cone', TW.x + (i - 1) * 4, TW.z + 8, { camp: k, lvl: 5 });
    banner('LE COMITÉ DU GRAND PLAN', 'La réunion est ouverte. Ordre du jour : toi.'); }
  // camps de chantier
  for (const s of gen.allStructs(P.x - 100, P.z - 100, P.x + 100, P.z + 100)) {
    if (s.type !== 'chantier' && s.type !== 'grand' && s.type !== 'travaux') continue;
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
      const model = human(Object.assign(npcLook(n.role, s.seed + k * 31), {})); scene.add(model.g); addBlob(model.g, 0.42);
      const nm = n.role === 'villageois' ? ['Réjean', 'Lise', 'Jocelyn', 'Francine', 'Ti-Paul', 'Manon', 'Gaétan', 'Sylvie', 'Normand', 'Huguette'][(s.seed + k) % 10] : n.role === 'aubergiste' ? (s.reg ? 'Aubergiste de ' + s.name : s.nord ? 'Aubergiste de Chicoutimi' : 'Aubergiste du village') : n.role === 'commercant' ? ({ etape: 'Comptoir de L’Étape', charlevoix: 'Boutique du terroir', perce: 'Poissonnerie de Percé', montreal: 'Dépanneur ouvert 24 h (sauf travaux)' }[n.shop] || (s.nord ? 'Dépanneur du Royaume' : 'Dépanneur')) : NPCS[n.role].name;
      const npc = { key, role: n.role, stop: n.stop, shop: n.shop, s, x: n.x, z: n.z, y: world.ground(n.x, n.z), vx: 0, vy: 0, vz: 0, hw: 0.3, h: 1.75, ground: false, home: { x: n.x, z: n.z }, model, name: nm, t: Math.random() * 9, yaw: Math.random() * 6, wander: Math.random() * 6, walkT: 0, chat: ROLE_CHAT[n.role] ? ROLE_CHAT[n.role][(s.seed + k) % ROLE_CHAT[n.role].length] : CHATTER[(s.seed + k * 7) % CHATTER.length] };
      if (n.role === 'villageois') { npc.act = ['marche', 'marche', 'pelle', 'jase', 'hockey'][(s.seed + k * 13) % 5]; if (npc.act === 'pelle') setWeapon(model, 'pelle'); if (npc.act === 'hockey') setWeapon(model, 'baton'); }
      npc.label = makeLabel('npc', `<div class="say"></div><div class="mk"></div><div class="nm">${nm}</div>`); npc.mkEl = npc.label.querySelector('.mk'); npc.sayEl = npc.label.querySelector('.say');
      G.npcs.set(key, npc);
    });
    // objets de quête au sol (chaudières des cabanes, cannes de blé d'Inde des travaux)
    m.items.forEach((it, k) => { const key = 'c' + s.i + ',' + s.j + ':' + k; if (S.taken[key] || G.pickups.some(p => p.key === key)) return; dropPickup(it.kind, it.x, world.ground(it.x, it.z) + 0.4, it.z, { key, still: true }); });
  }
  let talk = null, td = 2.6;
  for (const [k, n] of G.npcs) {
    const dx = P.x - n.x, dz = P.z - n.z, d = Math.hypot(dx, dz);
    if (d > 140) { scene.remove(n.model.g); n.label.remove(); G.npcs.delete(k); continue; }
    if (!world.loadedAround(n.x, n.z, 0)) continue;
    n.t += dt; let tvx = 0, tvz = 0;
    const fixed = n.role !== 'villageois' || (n.act && n.act !== 'marche');
    if (d < 4) { const ty = Math.atan2(-dx, -dz); n.yaw += Math.atan2(Math.sin(ty - n.yaw), Math.cos(ty - n.yaw)) * Math.min(1, dt * 6); }
    else if (!fixed || Math.hypot(n.home.x - n.x, n.home.z - n.z) > 1.5) {
      n.wander += (Math.random() - 0.5) * dt * 1.5; const hx = n.home.x - n.x, hz = n.home.z - n.z, far = Math.hypot(hx, hz) > (fixed ? 1 : 7);
      const go = far || Math.sin(n.t * 0.4 + n.wander) > 0.2; if (go) { tvx = far ? hx / Math.hypot(hx, hz) * 1.6 : Math.sin(n.wander) * 1.3; tvz = far ? hz / Math.hypot(hx, hz) * 1.6 : Math.cos(n.wander) * 1.3; n.yaw = Math.atan2(-tvx, -tvz); }
    }
    n.vx = tvx; n.vz = tvz; n.vy -= 26 * dt; moveBody(world, n, dt, true); if (n.hitWall && n.ground) n.vy = 7;
    n.walkT += dt * Math.hypot(tvx, tvz) / 3;
    // activités : pelleter, jaser (face au voisin), jouer au hockey ; saluer le joueur qui passe
    if (n.act === 'jase' && d >= 4) { let o = null, od = 6; for (const [, q] of G.npcs) if (q !== n && Math.hypot(q.x - n.x, q.z - n.z) < od) { od = Math.hypot(q.x - n.x, q.z - n.z); o = q; } if (o) { const ty = Math.atan2(n.x - o.x, n.z - o.z); n.yaw += Math.atan2(Math.sin(ty - n.yaw), Math.cos(ty - n.yaw)) * Math.min(1, dt * 4); } }
    n.model.g.position.set(n.x, n.y, n.z); n.model.g.rotation.y = n.yaw; animHuman(n.model, n.walkT, Math.hypot(tvx, tvz) > 0.2 ? 0.6 : 0, 0, false, false);
    const A = n.model.P;
    if (n.act === 'pelle' && d >= 4) { const k = Math.sin(n.t * 2.6); A.armR.rotation.x = 0.7 + k * 0.5; A.armL.rotation.x = 0.9 + k * 0.4; A.torso.rotation.x = 0.25 + k * 0.15; if (k > 0.98 && Math.random() < 0.3 && d < 25) burst(n.x - Math.sin(n.yaw) * 1.2, n.y + 0.4, n.z - Math.cos(n.yaw) * 1.2, 0xf8fbff, 3, 2.5); }
    else if (n.act === 'hockey' && d >= 4) { const k = Math.sin(n.t * 4); A.armR.rotation.x = 0.5 + k * 0.35; A.armL.rotation.x = 0.6 + k * 0.3; A.torso.rotation.y = k * 0.3; }
    else if (n.act === 'jase' && d >= 4) { if (Math.sin(n.t * 0.9) > 0.3) { A.armL.rotation.x = 0.8 + Math.sin(n.t * 5) * 0.4; A.armL.rotation.z = -0.2; } }
    if (n.role === 'villageois' && d < 7 && d > 2.6 && !(G.t - (n.greetT ?? -99) < 90) && G.state === 'play') { n.greetT = G.t; n.waveT = 1.6; say(n, pick(sky.dayF < 0.3 ? AMBIENT.nuit : AMBIENT.salut)); }
    if (n.waveT > 0) { n.waveT -= dt; A.armR.rotation.x = 2.7; A.armR.rotation.z = 0.35 + Math.sin(n.t * 14) * 0.35; }
    if (n.sayEl.style.display !== 'none' && G.t > n.sayUntil) n.sayEl.style.display = 'none';
    const mk = npcMark(n); n.mkEl.textContent = mk === 'ready' ? '?' : mk === 'avail' ? '!' : ''; n.mkEl.className = 'mk' + (mk === 'ready' ? ' rdy' : '');
    placeLabel(n.label, n.x, n.y + 2.3, n.z, 30);
    if (d < td && Math.abs(P.y - n.y) < 2.5) { td = d; talk = n; }
  }
  if (G.drive) talk = null;
  G.talkTo = talk;
  // bavardage ambiant : de temps en temps, quelqu'un près de toi dit quelque chose
  G.sayT -= dt; if (G.sayT <= 0 && G.state === 'play') { G.sayT = 5 + Math.random() * 6; const near = [...G.npcs.values()].filter(n => Math.hypot(n.x - P.x, n.z - P.z) < 15 && n !== talk && !(G.t < n.sayUntil));
    if (near.length) { const n = near[(Math.random() * near.length) | 0]; const pool = sky.rain > 0.4 ? AMBIENT.pluie : sky.snow > 0.4 ? AMBIENT.neige : n.act && AMBIENT[n.act] ? AMBIENT[n.act] : n.role === 'villageois' ? CHATTER : ROLE_CHAT[n.role] || AMBIENT.salut; say(n, pick(pool)); } }
  const C = G.car; G.nearCar = !!(C && !G.drive && !P.gliding && Math.hypot(C.x - P.x, C.z - P.z) < 3.4 && Math.abs(C.y - P.y) < 2.5);
  const pr = $('prompt'), ptxt = talk ? 'Parler à ' + talk.name : G.drive ? 'Sortir du bazou' : G.nearCar ? 'Conduire le bazou' : '';
  if (ptxt && G.state === 'play') { pr.innerHTML = (isTouch ? '' : '<kbd>E</kbd> ') + ptxt; pr.classList.remove('hidden'); $('tTalk').classList.remove('hidden'); $('tTalk').textContent = talk ? 'PARLE' : G.drive ? 'SORS' : 'AUTO'; }
  else { pr.classList.add('hidden'); $('tTalk').classList.add('hidden'); }
}
const pick = a => a[(Math.random() * a.length) | 0];
function say(n, txt) { n.sayEl.textContent = txt; n.sayEl.style.display = 'block'; n.sayUntil = G.t + 4.5; }
// ---------- animaux d'ambiance : écureuils (fuient), chats de ruelle (en ville et au village), volée d'oies (le jour) ----------
function critterSpawn(kind, x, z) { const M = critterModel(kind); scene.add(M.g); const c = { kind, M, x, z, y: world.ground(x, z), vx: 0, vz: 0, t: Math.random() * 9, yaw: Math.random() * 6.28, hopT: 0, pause: Math.random() * 2 }; G.critters.push(c); return c; }
function crittersUpdate(dt) {
  const P = G.P;
  G.critT = (G.critT || 0) - dt;
  if (G.critT <= 0) { G.critT = 2;
    const a = Math.random() * 6.28, r = 14 + Math.random() * 16, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
    if (world.loadedAround(x, z, 0)) { const col = gen.column(Math.floor(x), Math.floor(z)), y = world.ground(x, z), wet = world.get(x, y - 0.25, z) === B.WATER;
      const town = col.st && col.w > 0.35 && ['ville', 'village', 'chicoutimi', 'etape', 'cabane'].includes(col.st.type), nE = G.critters.filter(c => c.kind === 'ecureuil').length, nC = G.critters.filter(c => c.kind === 'chat').length;
      if (!wet && Math.abs(y - P.y) < 8) { if (town && nC < 2) critterSpawn('chat', x, z); else if (!town && col.biome !== BIOME.RIVE && nE < (mobile ? 3 : 5)) critterSpawn('ecureuil', x, z); } } }
  // volée d'oies en V, le jour
  G.flockT -= dt;
  if (!G.flock && G.flockT <= 0 && sky.dayF > 0.5) { G.flockT = 70 + Math.random() * 60; const a = Math.random() * 6.28, dx = Math.cos(a), dz = Math.sin(a), y = P.y + 28 + Math.random() * 10, birds = [];
    for (let i = 0; i < 9; i++) { const M = critterModel('oie'), row = Math.ceil(i / 2), side = i % 2 ? 1 : -1; scene.add(M.g); birds.push({ M, ox: -dz * side * row * 2.2 - dx * row * 2.4, oz: dx * side * row * 2.2 - dz * row * 2.4, ph: Math.random() * 6 }); }
    G.flock = { x: P.x - dx * 160, z: P.z - dz * 160, y, dx, dz, birds, t: 0, honk: 0 }; }
  if (G.flock) { const F = G.flock; F.t += dt; F.x += F.dx * 10 * dt; F.z += F.dz * 10 * dt; F.honk -= dt;
    if (F.honk <= 0 && Math.hypot(F.x - P.x, F.z - P.z) < 70) { F.honk = 1.5 + Math.random() * 2; audio.fx('honk', 0.5); }
    for (const b of F.birds) { b.M.g.position.set(F.x + b.ox, F.y + Math.sin(F.t * 1.3 + b.ph) * 0.3, F.z + b.oz); b.M.g.rotation.y = Math.atan2(-F.dx, -F.dz); const f = Math.sin(F.t * 7 + b.ph) * 0.5; b.M.P.wL.rotation.z = f; b.M.P.wR.rotation.z = -f; }
    if (F.t > 34) { for (const b of F.birds) scene.remove(b.M.g); G.flock = null; } }
  for (let i = G.critters.length - 1; i >= 0; i--) { const c = G.critters[i], dx = c.x - P.x, dz = c.z - P.z, d = Math.hypot(dx, dz);
    if (d > 55) { scene.remove(c.M.g); G.critters.splice(i, 1); continue; }
    if (!world.loadedAround(c.x, c.z, 0)) continue;
    c.t += dt; let sp = 0;
    if (c.kind === 'ecureuil') { if (d < 5) { c.yaw = Math.atan2(-dx, -dz); sp = 6; c.pause = 0.8; } else if (c.pause > 0) { c.pause -= dt; } else { c.hopT -= dt; sp = 3.2; if (c.hopT <= 0) { c.hopT = 0.4 + Math.random() * 0.8; c.yaw += (Math.random() - 0.5) * 2.5; if (Math.random() < 0.3) c.pause = 1 + Math.random() * 2; } } }
    else { if (d < 2.4 && !(c.meow > G.t)) { c.meow = G.t + 8; audio.fx('miaou', 0.6); floatTxt(c.x, c.y + 0.8, c.z, 'miaou', '#ffd23a'); } if (c.pause > 0) c.pause -= dt; else { sp = 1.1; c.hopT -= dt; if (c.hopT <= 0) { c.hopT = 1 + Math.random() * 2; c.yaw += (Math.random() - 0.5) * 2; if (Math.random() < 0.4) c.pause = 2 + Math.random() * 4; } } }
    const nx = c.x - Math.sin(c.yaw) * sp * dt, nz = c.z - Math.cos(c.yaw) * sp * dt, ny = world.ground(nx, nz, c.y + 1);
    if (Math.abs(ny - c.y) < 0.6 && world.get(nx, ny - 0.25, nz) !== B.WATER) { c.x = nx; c.z = nz; c.y = ny; } else c.yaw += 2;
    const hop = c.kind === 'ecureuil' && sp > 0 ? Math.abs(Math.sin(c.t * 14)) * 0.12 : 0;
    c.M.g.position.set(c.x, c.y + hop, c.z); c.M.g.rotation.y = c.yaw; c.M.P.tail.rotation.x = c.kind === 'chat' ? Math.sin(c.t * 2) * 0.2 : -0.2 + Math.sin(c.t * 8) * 0.15; c.M.P.body.rotation.x = c.kind === 'ecureuil' && sp === 0 ? -0.5 : 0; }
}
function questsOf(role) { return Object.entries(QUESTS).filter(([id, q]) => q.giver === role); }
function questAvailable(id) { const q = QUESTS[id]; if (S.q[id]) return false; return !(q.requires || []).some(r => !S.q[r] || S.q[r].st !== 'done'); }
function npcMark(n) {
  for (const [id] of questsOf(n.role)) { const s = S.q[id]; if (s && s.st === 'ready') return 'ready'; }
  for (const [id] of questsOf(n.role)) if (questAvailable(id)) return 'avail';
  if (n.role === 'aubergiste') { const c = S.contract; if (c && c.key === n.s.i + ',' + n.s.j && c.st === 'ready') return 'ready'; if (!c) return 'avail'; }
  return '';
}
// ---------- le bazou (véhicule) et l'autocar ----------
const FARE = 5, CAR_HOME = { x: 10, z: -126, yaw: 0 };
function placeCar() {
  if (!S.car) S.car = Object.assign({}, CAR_HOME);
  if (!G.car) { const m = carModel(); m.g.rotation.order = 'YXZ'; scene.add(m.g); G.car = { m, v: 0, vy: 0, pitch: 0, y: 0 }; }
  const C = G.car; C.x = S.car.x; C.z = S.car.z; C.yaw = S.car.yaw || 0; C.v = 0; C.vy = 0; C.y = gen.heightAt(C.x, C.z) + 1; C.settled = false;
}
function carUpdate(dt) {
  const C = G.car; if (!C) return;
  if (!G.drive && world.loadedAround(C.x, C.z, 0)) { const gy = world.ground(C.x, C.z, C.y + 2.5); if (!C.settled || Math.abs(gy - C.y) > 0.01) { C.y = gy; C.settled = true; } }
  C.m.g.position.set(C.x, C.y, C.z); C.m.g.rotation.y = C.yaw; C.m.g.rotation.x = C.pitch;
  for (const w of C.m.P.wheels) w.rotation.x -= C.v * dt / 0.41;
  C.m.P.body.position.y = G.drive ? Math.sin(G.t * 23) * 0.012 * Math.min(1, Math.abs(C.v) / 5) : 0;
}
function enterCar() {
  const P = G.P; if (!G.car || P.gliding) return;
  G.drive = true; P.model.g.visible = false; G.camDist = 9.5; G.camYaw = G.car.yaw; outline.visible = false; audio.fx('horn', 0.6);
  if (!G.carHint) { G.carHint = true; toast(isTouch ? 'Bazou : pousse le bâton pour rouler · SORS pour débarquer' : 'Bazou : W/S avancer/reculer · A/D tourner · Maj : turbo · E : sortir'); }
}
function exitCar() {
  const C = G.car, P = G.P; if (!C) return; G.drive = false;
  const fx = -Math.sin(C.yaw), fz = -Math.cos(C.yaw);
  let ex = C.x + fz * 2.3, ez = C.z - fx * 2.3; if (world.loadedAround(ex, ez, 0) && world.ground(ex, ez, C.y + 3) > C.y + 1.6) { ex = C.x - fz * 2.3; ez = C.z + fx * 2.3; }
  P.x = ex; P.z = ez; P.y = world.loadedAround(ex, ez, 0) ? world.ground(ex, ez, C.y + 3) : C.y; P.vx = P.vz = P.vy = 0; P.model.g.visible = true; G.camDist = 5.8;
  C.v = 0; S.car = { x: C.x, z: C.z, yaw: C.yaw };
}
function driveUpdate(dt) {
  const C = G.car, P = G.P;
  const { mx, mz, run } = moveInput(), thr = -mz, vmax = run ? 30 : 21;
  if (thr > 0.1) C.v += (C.v < 0 ? 24 : 9) * thr * dt; else if (thr < -0.1) C.v -= (C.v > 0 ? 24 : 6) * -thr * dt; else C.v *= Math.pow(0.5, dt);
  C.v = Math.max(-7, Math.min(vmax, C.v)); if (Math.abs(C.v) < 0.08 && Math.abs(thr) < 0.1) C.v = 0;
  C.yaw -= mx * dt * 1.7 * Math.max(-1, Math.min(1, C.v / 5));
  const fx = -Math.sin(C.yaw), fz = -Math.cos(C.yaw), nx = C.x + fx * C.v * dt, nz = C.z + fz * C.v * dt;
  if (!world.loadedAround(nx, nz, 1)) C.v *= Math.pow(0.05, dt);
  else if (C.v) {
    const sg = Math.sign(C.v), px = nx + fx * 2.1 * sg, pz = nz + fz * 2.1 * sg, gy = world.ground(px, pz, C.y + 1.5), wet = world.get(px, gy - 0.25, pz) === B.WATER;
    if (gy > C.y + 1.05 || wet) { if (Math.abs(C.v) > 6) { audio.fx('bonk'); burst(px, C.y + 1, pz, 0x8a8a8e, 6, 3); } C.v = -C.v * 0.25; if (wet && !G.wetHint) { G.wetHint = true; toast('Le bazou flotte pas. Pas encore.'); } }
    else { C.x = nx; C.z = nz; }
  }
  const g0 = world.ground(C.x, C.z, C.y + 1.5);
  if (g0 >= C.y - 0.05) { C.y = g0; C.vy = 0; } else { C.vy -= 26 * dt; C.y = Math.max(g0, C.y + C.vy * dt); }
  const gf = world.ground(C.x + fx * 1.5, C.z + fz * 1.5, C.y + 1.5), gb = world.ground(C.x - fx * 1.5, C.z - fz * 1.5, C.y + 1.5);
  C.pitch += (Math.max(-0.5, Math.min(0.5, Math.atan2(gf - gb, 3))) - C.pitch) * Math.min(1, dt * 8);
  if (Math.abs(C.v) > 7) for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - C.x, e.z - C.z) < 2.1 + e.T.hw && Math.abs(e.y - C.y) < 2.5 && !(e.carT > G.t)) { e.carT = G.t + 0.8; damageEnemy(e, 18 + Math.abs(C.v) * 2.2, fx, fz, 12); audio.fx('hit'); }
  P.x = C.x; P.z = C.z; P.y = C.y + 0.4; P.vx = fx * C.v; P.vz = fz * C.v; P.vy = 0; P.ground = true; P.iT -= dt; P.atkCd -= dt; P.buff -= dt;
  P.stam = Math.min(1, P.stam + dt * 0.25);
  if (Math.abs(C.v) > 1.5) G.camYaw += Math.atan2(Math.sin(C.yaw - G.camYaw), Math.cos(C.yaw - G.camYaw)) * Math.min(1, dt * 2.2);
  S.stats.dist += Math.abs(C.v) * dt; audio.wind(Math.abs(C.v) / 45);
  P.model.g.position.set(P.x, P.y, P.z); P.model.g.visible = false;
}
function travel(key) {
  const st = gen.nord.stops.find(s => s.key === key), P = G.P; if (!st) return;
  if (G.drive) exitCar();
  P.x = st.ax; P.z = st.az; P.y = gen.heightAt(P.x, P.z) + 1.5; P.vx = P.vz = P.vy = 0; P.iT = 2; P.gliding = false; P.gl.visible = false;
  S.car = { x: st.car[0], z: st.car[1], yaw: st.car[2] }; if (G.car) placeCar();
  G.travelTo = key; G.state = 'loading'; G.loadT = 0; hide('hud'); show('loading'); audio.fx('horn');
}
// ---------- objets au sol ----------
const beamGeo = new THREE.BoxGeometry(0.12, 2.4, 0.12).translate(0, 1.2, 0);
function dropPickup(kind, x, y, z, o) {
  const m = pickupModel(kind === 'gear' ? 'gear' : kind); m.position.set(x, y, z); scene.add(m);
  if (kind === 'gear') { const c = new THREE.Color(RARITY[o.r || 0].c), beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.35 + 0.12 * (o.r || 0), depthWrite: false, blending: THREE.AdditiveBlending })); beam.scale.y = 1 + (o.r || 0) * 0.6; m.add(beam); }
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
      const gate = { chaudiere: ['sirop', 'Une chaudière d’eau d’érable… Pépère Tremblay en cherche peut-être.', 'Pépère a déjà son sirop.'], ble: ['pate', 'Une canne de blé d’Inde en crème… La cuisinière de L’Étape en cherche peut-être.', 'Rolande a déjà son blé d’Inde.'] }[p.kind];
      if (!gate && ITEMS[p.kind] && ITEMS[p.kind].slot === 'quete' && p.key) { const qid = Object.keys(QUESTS).find(id => QUESTS[id].item === p.kind); if (qid && !(S.q[qid] && S.q[qid].st === 'active')) { if (!G.cdHint || G.t - G.cdHint > 6) { G.cdHint = G.t; toast(S.q[qid] && S.q[qid].st === 'done' ? 'Tu as déjà rapporté tout ça.' : ITEMS[p.kind].name + '… ' + NPCS[QUESTS[qid].giver].name.split(',')[0] + ' en cherche peut-être.'); } continue; } }
      if (gate && !(S.q[gate[0]] && S.q[gate[0]].st === 'active')) { if (!G.cdHint || G.t - G.cdHint > 6) { G.cdHint = G.t; toast(S.q[gate[0]] && S.q[gate[0]].st === 'done' ? gate[2] : gate[1]); } continue; }
      collect(p); p.life = 0;
    }
    if (p.life <= 0) { scene.remove(p.m); G.pickups.splice(i, 1); }
  }
}
function collect(p) {
  if (p.kind === 'piasse') { S.cash += p.val || 1; audio.fx('coin'); floatTxt(p.x, p.y + 0.6, p.z, '+' + (p.val || 1) + ' $', '#8dff6a'); }
  else if (p.kind === 'poutine') { addItem('poutine'); audio.fx('coin'); toast('Poutine ramassée!'); }
  else if (p.kind === 'chaudiere' || p.kind === 'ble' || p.kind === 'pinceau' || p.kind === 'casier') { S.taken[p.key] = 1; audio.fx('coin'); questEvent('collect', p.kind); }
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
  while (S.xp >= xpNext(S.lvl)) { S.xp -= xpNext(S.lvl); S.lvl++; const st = stats(); G.P.hp = st.hpMax; audio.fx('level'); banner('NIVEAU ' + S.lvl + '!', 'PV max ' + st.hpMax + ' · dégâts +10 % · 1 point de talent (T)'); burst(G.P.x, G.P.y + 1, G.P.z, 0xffd23a, 20, 6); G.dirtyHot = true; }
}
function rewardTxt(r) { return (r.cash || 0) + ' piasses · ' + r.xp + ' XP' + (r.item ? ' · ' + ITEMS[r.item].name : '') + (r.give ? ' · ' + Object.entries(r.give).map(([k, v]) => v + ' × ' + ITEMS[k].name).join(', ') : ''); }
function reward(r) {
  S.cash += r.cash || 0; if (r.item) addItem(r.item, 1, 0); if (r.give) for (const k in r.give) addItem(k, r.give[k]);
  gainXP(r.xp || 0); audio.fx('quest');
  return `<span class="rw">Récompense : ${r.cash || 0} piasses · ${r.xp} XP${r.item ? ' · ' + ITEMS[r.item].name : ''}${r.give ? ' · ' + Object.entries(r.give).map(([k, v]) => v + ' × ' + ITEMS[k].name).join(', ') : ''}</span>`;
}
function questTargetPos(id) {
  const q = QUESTS[id], s = S.q[id];
  if (q.home) { const R = gen.reg.places, p = s && s.st === 'ready' ? R[q.home] : R[q.at || q.home]; return p ? { x: p.x, z: p.z } : null; }
  const NP = gen.nord.places, gp = { gaston: gen.cell(0, 0), lapaperasse: gen.cell(0, 0), pepere: gen.cell(1, 0), ginette: gen.cell(-1, 0), cuisiniere: NP.etape, saguenayen: NP.port }[q.giver];
  if (s && s.st === 'active' && q.type === 'talk' && q.to === 'pepere') { const c = gen.cell(1, 0); return { x: c.x, z: c.z }; }
  if (s && s.st === 'active' && id === 'comite') return { x: NP.travaux.x, z: NP.travaux.z };
  if (s && s.st === 'active' && id === 'goelands') return { x: NP.port.x, z: NP.port.z };
  if (s && s.st === 'ready') return { x: gp.x, z: gp.z };
  if (id === 'pate') return { x: NP.travaux.x, z: NP.travaux.z };
  if (id === 'nouvelles') { const c = gen.cell(0, 0); return { x: c.x, z: c.z }; }
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
  let pre = '';
  const talkQ = !extra && Object.entries(S.q).find(([id, st]) => st.st === 'active' && QUESTS[id].type === 'talk' && QUESTS[id].to === n.role);
  if (talkQ) { const [id, st] = talkQ, q = QUESTS[id]; st.st = 'done'; st.n = 1; if (q.give) S.inv = S.inv.filter(i => i.id !== q.give); audio.fx('quest'); banner('CHAPITRE ' + q.chap + ' TERMINÉ', q.title); G.dirtyQ = true; $('dtext').innerHTML = ''; }
  if (n.role === 'gaston' && !extra && S.q.nouvelles && S.q.nouvelles.st === 'active') { addItem('gazette'); questEvent('collect', 'gazette'); pre = 'Des nouvelles pour le Saguenay? Tiens, la <b class="gold">Gazette des remparts</b>, encore chaude. Dis-leur que le pont tient!<br><br>'; }
  if (extra) txt = extra;
  else if (talkQ) { const q = QUESTS[talkQ[0]]; txt = q.done + reward(q.reward); add('MERCI!', () => renderDialog(n)); }
  else if (ready) { const [id, q] = ready; S.q[id].st = 'done'; txt = q.done + reward(q.reward); if (id === 'permis') S.inv = S.inv.filter(i => i.id !== 'permis'); if (id === 'nouvelles') S.inv = S.inv.filter(i => i.id !== 'gazette'); G.dirtyQ = true; add('MERCI!', () => renderDialog(n)); }
  else if (avail) { const [id, q] = avail; txt = (q.chap ? '<span class="chap">Récit · chapitre ' + q.chap + '</span><br>' : '') + '<b class="gold">' + q.title + '</b><br>' + q.intro + '<br><span class="rw">Récompense : ' + rewardTxt(q.reward) + '</span>'; add('ACCEPTER', () => { S.q[id] = { st: 'active', n: 0 }; if (q.give) addItem(q.give); audio.fx('accept'); toast((q.chap ? 'Chapitre ' + q.chap + ' : ' : 'Nouvelle quête : ') + q.title); G.dirtyQ = true; writeSave(); closeDialog(); }, true); add('PLUS TARD', close); }
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
  else if (n.role === 'chauffeur' || n.role === 'matelot' || (n.role === 'capitaine' && n.stop)) {
    const ferry = n.role !== 'chauffeur';
    txt = ferry ? (n.role === 'capitaine' ? n.chat + '<br><br>' : '') + '<b class="gold">Traversier du Fleuve</b> : Quai de la Vieille-Ville ↔ Percé, en Gaspésie. ' + FARE * 2 + ' piasses. Ton bazou voyage dans la cale.'
      : 'Autocars <b class="gold">Orignal Express</b> : Vieille-Ville, Réserve, L’Étape, Chicoutimi, Baie-Saint-Paul, Montréal. ' + FARE + ' piasses le billet. Ton bazou voyage sur le toit, gratis.';
    const fare = ferry ? FARE * 2 : FARE;
    for (const st of gen.nord.stops) if (st.key !== n.stop && !!st.mode === ferry) add(st.label + ' · ' + fare + ' $', () => { if (S.cash < fare) { audio.fx('deny'); toast('Pas assez de piasses pour le billet!'); return; } S.cash -= fare; closeDialog(); travel(st.key); }, true);
  }
  else if (ROLE_CHAT[n.role] && !NPCS[n.role].quest) txt = n.chat;
  else if (n.role === 'garde') txt = 'Les remparts sont solides. Les cônes, par exemple, rentrent par les portes comme tout le monde.';
  else if (n.role === 'acericulteur') txt = 'Mon sirop est le meilleur du rang. Le voisin dit la même chose, mais il ment.';
  else txt = n.chat;
  if (n.role === 'capitaine' && n.stop && (talkQ || ready || avail || active) && !extra) for (const st of gen.nord.stops) if (st.key !== n.stop && st.mode) add('TRAVERSIER : ' + st.label + ' · ' + FARE * 2 + ' $', () => { if (S.cash < FARE * 2) { audio.fx('deny'); toast('Pas assez de piasses pour le billet!'); return; } S.cash -= FARE * 2; closeDialog(); travel(st.key); });
  if (!btns.length || !btns.some(b => b.label === 'AU REVOIR')) add('AU REVOIR', close);
  $('dtext').innerHTML = pre + txt;
  const bb = $('dbtns'); bb.innerHTML = '';
  for (const b of btns) { const e = document.createElement('button'); e.className = 'btn' + (b.big ? ' big' : ''); e.textContent = b.label; e.onclick = () => { audio.fx('ui'); b.fn(); }; bb.appendChild(e); }
  setTimeout(() => { const f = bb.querySelector('.btn'); if (f && !isTouch) f.focus(); }, 30);
}
function openShop(n) {
  const wrap = document.createElement('div'); wrap.className = 'shop';
  const list = (n.shop && SHOPS[n.shop]) || (n.s && n.s.nord ? SHOPS.chicoutimi : SHOP);
  for (const id of list) { const D = ITEMS[id]; const b = document.createElement('button'); b.innerHTML = `<img src="${itemIcon(id)}"><span>${D.name}<br><small>${D.desc}</small></span><em>${D.price} $</em>`; b.disabled = false;
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
  $('hpbar').querySelector('.fill').style.width = Math.max(0, Math.min(100, P.hp / st.hpMax * 100)) + '%'; $('hpbar').querySelector('span').textContent = Math.ceil(Math.max(0, P.hp)) + ' / ' + st.hpMax;
  $('stbar').querySelector('.fill').style.width = P.stam * 100 + '%';
  $('xpbar').querySelector('.fill').style.width = Math.min(100, S.xp / xpNext(S.lvl) * 100) + '%';
  const tp = talentPts(S); $('lvl').innerHTML = 'NIV. ' + S.lvl + '  ·  ' + S.xp + ' / ' + xpNext(S.lvl) + ' XP' + (tp ? ' <span class="gold">· ★ ' + tp + ' talent' + (tp > 1 ? 's' : '') + (isTouch ? '' : ' (T)') + '</span>' : '');
  $('cash').querySelector('b').textContent = S.cash;
  const col = gen.column(Math.floor(P.x), Math.floor(P.z)), rk = gen.nord.region(P.x, P.z);
  const place = rk ? REGIONS[rk][0] : col.st && col.w > 0.4 ? col.st.name || { ville: 'Vieille-Ville', village: 'Village', cabane: 'Cabane à sucre', chantier: 'Chantier', grand: 'Grand Chantier' }[col.st.type] : BIOME_NAME[col.biome];
  if (rk !== G.regKey) { if (rk && (!G.regSeen[rk] || G.t - G.regSeen[rk] > 60)) { banner(REGIONS[rk][0].toUpperCase(), REGIONS[rk][1]); G.lastBanner = rk; } G.regKey = rk; }
  if (rk) G.regSeen[rk] = G.t;
  $('where').textContent = place; $('clock').textContent = sky.clock() + (sky.snow > 0.4 ? ' · neige' : sky.rain > 0.4 ? ' · pluie' : '');
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
  const ids = Object.keys(S.q).sort((a, b) => (QUESTS[a].chap ? 0 : 1) - (QUESTS[b].chap ? 0 : 1));
  for (const id of ids) { const s = S.q[id], q = QUESTS[id]; if (s.st === 'done') continue; out.push(`<div class="q ${s.st === 'ready' ? 'ready' : ''}"><b>${q.chap ? 'Ch. ' + q.chap + ' · ' : ''}${q.title}</b>${objTxt(id)}</div>`); }
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
  // route 175
  if (cz - R < Z_ROAD0 && cz + R > Z_END) { ctx.strokeStyle = '#0c1420'; ctx.lineWidth = scale > 0.9 ? 5 : 4; const pts = []; const st = Math.max(2, 4 / scale);
    for (let z = Math.min(Z_ROAD0, cz + R); z >= Math.max(Z_END, cz - R); z -= st) pts.push([(gen.nord.roadX(z) - cx) * scale + W / 2, (z - cz) * scale + W / 2]);
    if (round) { ctx.save(); ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2 - 2, 0, 6.283); ctx.clip(); }
    for (const [lw, c] of [[scale > 0.9 ? 5 : 4, '#0c1420'], [scale > 0.9 ? 2.5 : 2, '#e8e2c8']]) { ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
    if (round) ctx.restore(); }
  for (const s of gen.allStructs(cx - R, cz - R, cx + R, cz + R)) put(s.x, s.z, { ville: '#5ab8ff', village: '#ffffff', cabane: '#c8361e', chantier: '#ff7a1a', grand: '#ff3a1a', travaux: '#ff7a1a', etape: '#ffd23a', poste: '#c89a5a', camp: '#c89a5a', belvedere: '#9ae0ff', chicoutimi: '#5ab8ff', port: '#5ab8ff', musee: '#9ae0ff', baie: '#5ab8ff', belvc: '#9ae0ff', perce: '#5ab8ff', rocher: '#c8a888', phare: '#ff4a3a', mtl: '#ff7a1a', quai: '#9ae0ff' }[s.type] || '#ffffff', s.type === 'ville' || s.type === 'chicoutimi' ? 10 : 7);
  // noms des lieux
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  for (const L of gen.nord.labels) { const px = (L.x - cx) * scale + W / 2, pz = (L.z - cz) * scale + W / 2, t = round && L.sh ? L.sh : L.n;
    if (round ? Math.hypot(px - W / 2, pz - W / 2) > W / 2 - 12 : px < -40 || pz < 0 || px > W + 40 || pz > W) continue;
    if (scale < 0.3 && !L.big && !L.m) continue;
    ctx.font = (round ? 13 : L.big ? 20 : 16) + 'px "Jersey 10", monospace'; ctx.lineWidth = 4; ctx.strokeStyle = '#0c1420'; ctx.strokeText(t, px, pz - 8); ctx.fillStyle = L.big ? '#ffd23a' : '#ffffff'; ctx.fillText(t, px, pz - 8); }
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
  const cv = $('bigmap'), ctx = cv.getContext('2d'), W = 480, P = G.P, sc = [1.5, 0.45, 0.16][G.mapZ], stp = sc < 1 ? 4 : 1, img = ctx.createImageData(W, W), d = img.data;
  for (let j = 0; j < W; j += stp) for (let i = 0; i < W; i += stp) { const x = Math.floor(P.x + (i - W / 2) / sc), z = Math.floor(P.z + (j - W / 2) / sc); let c = stp === 1 ? topColor(x, z) : null;
    if (!c) { const col = gen.column(x, z); const h = col.h; c = h <= SEA || (col.wl && h < col.wl) ? [40, 80, 140] : [[200, 190, 140], [100, 150, 70], [50, 90, 60], [170, 70, 40], [210, 215, 225], [150, 150, 150]][col.biome].map(v => v * (0.55 + (h - SEA) * 0.006)); }
    for (let b = 0; b < stp; b++) for (let a = 0; a < stp; a++) { const k = (i + a + (j + b) * W) * 4; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255; } }
  ctx.putImageData(img, 0, 0); drawMarkers(ctx, P.x, P.z, sc, W, false);
  $('maplegend').innerHTML = '<span style="color:#5ab8ff">■</span> Ville &nbsp; ■ Village &nbsp; <span style="color:#c8361e">■</span> Cabane &nbsp; <span style="color:#ff7a1a">■</span> Chantier &nbsp; <span class="gold">■</span> Relais &nbsp; <span style="color:#e8e2c8">━</span> Route 175 &nbsp; <span class="gold">◆</span> Quête<br><button class="btn sm" id="mzBtn">' + ['ZOOM : PROCHE', 'ZOOM : RÉGION', 'ZOOM : TOUT LE NORD'][G.mapZ] + (isTouch ? '' : ' (Z)') + '</button>';
  $('mzBtn').onclick = e => { e.stopPropagation(); G.mapZ = (G.mapZ + 1) % 3; drawBigMap(); };
}
// sac
let invSel = null;
function renderInv() {
  const st = stats(), e = S.equip, slots = [['arme', 'Arme'], ['tete', 'Tête'], ['mains', 'Mains'], ['corps', 'Corps'], ['pieds', 'Pieds']];
  let h = '<div><div class="eq">' + slots.map(([k, l]) => { const it = e[k]; return `<div class="slot" data-eq="${k}">${it ? `<img src="${itemIcon(it.id)}">` : ''}<div>${it ? `<span style="color:${RARITY[it.r || 0].c}">${ITEMS[it.id].name}</span>` : '<span style="color:#789">(vide)</span>'}<small>${l}</small></div></div>`; }).join('') + '</div>';
  h += `<div class="statl">Niveau ${S.lvl} · PV ${Math.ceil(G.P.hp)} / ${st.hpMax}<br>Dégâts ${Math.round(st.dmg)} · Défense ${st.def}<br>Piasses : <span class="green">${S.cash}</span><br>Cerf-volant fléché : ${S.glider ? 'oui (Espace en l’air)' : 'non'}<br>Ennemis vaincus : ${S.stats.kills} · Blocs cassés : ${S.stats.blocks} · posés : ${S.stats.placed}</div></div>`;
  h += '<div><div class="grid">' + S.inv.map((it, i) => `<div class="cell${invSel === i ? ' sel' : ''}" data-i="${i}"${it.r ? ` style="box-shadow: inset 0 0 0 3px ${RARITY[it.r].c}"` : ''}><img src="${itemIcon(it.id)}">${it.n > 1 ? `<i>${it.n}</i>` : ''}</div>`).join('') + '</div>';
  const sel = S.inv[invSel];
  h += '<div id="idesc">' + (sel ? `<span style="color:${RARITY[sel.r || 0].c}">${ITEMS[sel.id].name}</span>${sel.r ? ' (' + RARITY[sel.r].n + ')' : ''} — ${ITEMS[sel.id].desc}${ITEMS[sel.id].dmg ? ' · Dégâts ' + Math.round(ITEMS[sel.id].dmg * RARITY[sel.r || 0].m) : ''}${ITEMS[sel.id].def ? ' · Défense ' + Math.round(ITEMS[sel.id].def * RARITY[sel.r || 0].m) : ''}<br>` + (ITEMS[sel.id].slot === 'conso' ? '<button class="btn sm" id="iUse">MANGER</button>' : ITEMS[sel.id].slot === 'mat' || ITEMS[sel.id].slot === 'outil' ? '<button class="btn sm" id="iSell">VENDRE (' + sellPrice(sel) + ' $)</button>' + (ITEMS[sel.id].slot === 'outil' ? ' <small>Outil : servi tout seul quand tu mines.</small>' : '') : ITEMS[sel.id].slot !== 'quete' ? '<button class="btn sm" id="iEq">ÉQUIPER</button> <button class="btn sm" id="iSell">VENDRE (' + sellPrice(sel) + ' $)</button>' : '') : 'Choisis un objet.') + '</div>';
  h += '<div class="statl">Blocs : ' + (PLACEABLE.filter(b => S.blocks[b] > 0).map(b => `<img src="${blockIcon(b)}" style="width:1.4em;vertical-align:middle"> ${S.blocks[b]}`).join(' &nbsp; ') || 'aucun — casse des blocs avec F') + '</div></div>';
  h += '<div class="row2"><button class="btn sm" id="iTal">TALENTS' + (talentPts(S) ? ' (★ ' + talentPts(S) + ')' : '') + '</button><button class="btn sm" id="iCraft">ATELIER</button></div>';
  $('invbody').innerHTML = h;
  $('iTal').onclick = () => { closePanels(); openPanel('talents'); }; $('iCraft').onclick = () => { closePanels(); openPanel('craft'); };
  $('invbody').querySelectorAll('.cell').forEach(c => c.onclick = () => { invSel = +c.dataset.i; audio.fx('ui'); renderInv(); });
  const u = $('iUse'); if (u) u.onclick = () => { useItem(sel); invSel = null; renderInv(); };
  const q = $('iEq'); if (q) q.onclick = () => { equip(sel); invSel = null; renderInv(); };
  const s = $('iSell'); if (s) s.onclick = () => { S.cash += sellPrice(sel); if (sel.n > 1) sel.n--; else { S.inv.splice(invSel, 1); invSel = null; } audio.fx('coin'); renderInv(); };
}
function sellPrice(it) { return Math.round((ITEMS[it.id].price || 40) * 0.3 * RARITY[it.r || 0].m); }
function objTxt(id) { const q = QUESTS[id], s = S.q[id]; if (s.st === 'ready') return 'Retourne voir ' + NPCS[q.giver].name.split(',')[0]; if (q.type === 'talk') return 'Parle à ' + NPCS[q.to].name.split(',')[0]; return (q.type === 'kill' ? ENEMIES[q.target].name : ITEMS[q.item].name) + ' : ' + Math.min(s.n, q.n) + ' / ' + q.n; }
// journal : récit principal par chapitres (fait / en cours / à venir), quêtes secondaires, contrats
function renderQuests() {
  const main = Object.entries(QUESTS).filter(([, q]) => q.chap).sort((a, b) => a[1].chap - b[1].chap), side = Object.entries(QUESTS).filter(([, q]) => !q.chap);
  const stOf = id => S.q[id] ? S.q[id].st : questAvailable(id) ? 'avail' : 'locked';
  const ICON = { done: '✔', active: '●', ready: '★', avail: '!', locked: '·' };
  const row = (id, q) => { const st = stOf(id); const giver = NPCS[q.giver].name;
    if (st === 'locked') return `<div class="qitem locked"><b>${q.chap ? 'Chapitre ' + q.chap + ' · ' : ''}???</b><br>Débloqué après : ${(q.requires || []).map(r => QUESTS[r].title).join(', ')}</div>`;
    const prog = S.q[id] && st === 'active' && q.n > 1 ? `<div class="qbar"><div style="width:${Math.min(100, S.q[id].n / q.n * 100)}%"></div></div>` : '';
    const what = st === 'done' ? 'Terminée.' : st === 'avail' ? 'À prendre auprès de ' + giver + '.' : st === 'ready' ? 'Objectif atteint : retourne voir ' + giver + '.' : q.wait + ' — ' + objTxt(id);
    return `<div class="qitem ${st}"><span class="ic">${ICON[st]}</span><b>${q.chap ? 'Chapitre ' + q.chap + ' · ' : ''}${q.title}</b> — ${giver}<br>${what}${prog}${st !== 'done' ? '<br><small class="rw">Récompense : ' + rewardTxt(q.reward) + '</small>' : ''}</div>`; };
  const doneN = main.filter(([id]) => stOf(id) === 'done').length;
  let h = `<h2>Le Grand Plan des cônes <small>${doneN} / ${main.length} chapitres</small></h2><div class="qbar big"><div style="width:${doneN / main.length * 100}%"></div></div>` + main.map(([id, q]) => row(id, q)).join('');
  const sideSeen = side.filter(([id]) => stOf(id) !== 'locked');
  h += '<h2>Quêtes secondaires</h2>' + (sideSeen.map(([id, q]) => row(id, q)).join('') || '<p>Aucune pour l’instant.</p>');
  if (S.contract) h += `<h2>Contrat du village</h2><div class="qitem ${S.contract.st}"><b>Contrat du village</b><br>${ENEMIES[S.contract.target].name} : ${S.contract.prog} / ${S.contract.n}</div>`;
  h += `<p class="gold">${S.contractsDone} contrat(s) de village rempli(s)</p>`;
  $('qbody').innerHTML = h;
}
// talents : 3 branches ; cliquer un talent pour y mettre un point
function renderTalents() {
  const pts = talentPts(S);
  let h = `<p class="cnote">${pts ? '<span class="gold">★ ' + pts + ' point' + (pts > 1 ? 's' : '') + ' à placer</span>' : 'Aucun point libre : gagne un niveau pour en avoir un.'} · Niveau ${S.lvl}</p><div class="tals">`;
  for (const b of TALENTS) {
    h += `<div class="tbr"><h2 style="color:${b.col}">${b.name}<small>${b.sub} · ${spentIn(S, b.key)} pt</small></h2>`;
    for (const t of b.list) { const r = (S.tal || {})[t.id] || 0, ok = canLearn(S, t.id), locked = spentIn(S, b.key) < t.req;
      h += `<div class="tal${ok ? ' can' : ''}${locked ? ' locked' : ''}${r ? ' has' : ''}" data-t="${t.id}"><b>${t.name}</b> <span class="pips">${'◆'.repeat(r)}${'◇'.repeat(t.max - r)}</span><br><small>${locked ? 'Débloqué avec ' + t.req + ' points dans la branche' : t.txt(Math.max(1, r))}</small></div>`; }
    h += '</div>';
  }
  h += `</div><div class="row2"><button class="btn sm" id="tReset">RÉINITIALISER (${resetCost()} $)</button></div>`;
  $('talbody').innerHTML = h;
  $('talbody').querySelectorAll('.tal').forEach(c => c.onclick = () => { if (learn(c.dataset.t)) renderTalents(); else audio.fx('deny'); });
  $('tReset').onclick = () => { if (!Object.keys(S.tal || {}).length) return; if (S.cash < resetCost()) { audio.fx('deny'); toast('Pas assez de piasses.'); return; } S.cash -= resetCost(); S.tal = {}; refreshTalents(); audio.fx('coin'); renderTalents(); };
}
const resetCost = () => 20 * Math.max(1, S.lvl - 1);
function learn(id) {
  if (!canLearn(S, id)) return false;
  S.tal = S.tal || {}; S.tal[id] = (S.tal[id] || 0) + 1; refreshTalents(); audio.fx('level', 0.6); toast(TAL[id].name + ' : rang ' + S.tal[id]); G.dirtyHot = true;
  if (G.P) G.P.hp = Math.min(G.P.hp, stats().hpMax);
  return true;
}
// atelier : recettes à la main ou à l'établi (bloc posé à moins de 5 m)
function nearBench() {
  const P = G.P, x0 = Math.floor(P.x * IVS), y0 = Math.floor((P.y + 0.8) * IVS), z0 = Math.floor(P.z * IVS), R = 10;
  for (let y = y0 - 6; y <= y0 + 6; y++) for (let z = z0 - R; z <= z0 + R; z++) for (let x = x0 - R; x <= x0 + R; x++) if (world.getV(x, y, z) === B.BENCH) return true;
  return false;
}
let craftSel = 0;
function renderCraft() {
  const nb = nearBench(), ing = (r) => [...Object.entries(r.inb || {}).map(([b, n]) => `<span class="${(S.blocks[b] || 0) >= n ? '' : 'red'}"><img src="${blockIcon(+b)}">${n} ${NAME[b]}</span>`), ...Object.entries(r.ini || {}).map(([id, n]) => `<span class="${S.inv.filter(i => i.id === id).reduce((a, i) => a + (i.n || 1), 0) >= n ? '' : 'red'}"><img src="${itemIcon(id)}">${n} ${ITEMS[id].name}</span>`)].join(' ');
  const outIcon = r => r.out.b ? blockIcon(r.out.b) : itemIcon(r.out.i);
  let h = `<p class="cnote">${nb ? '<span class="green">Établi à côté : toutes les recettes.</span>' : 'Sans établi, seulement les recettes de base. Fabrique un <b>Établi</b> (4 planches) et pose-le.'}</p><div class="recipes">`;
  RECIPES.forEach((r, i) => { const miss = missing(S, r, nb); h += `<div class="rcp${miss.length ? ' no' : ''}${i === craftSel ? ' sel' : ''}" data-i="${i}"><img src="${outIcon(r)}"><div><b>${r.name}${(r.out.n || 1) > 1 ? ' ×' + r.out.n : ''}</b>${r.bench ? ' <small class="gold">établi</small>' : ''}<br><small>${ing(r)}</small></div></div>`; });
  const r = RECIPES[craftSel], miss = missing(S, r, nb), D = r.out.i ? ITEMS[r.out.i] : null;
  h += `</div><div id="cdesc"><b>${r.name}</b> — ${D ? D.desc : 'Bloc : ' + NAME[r.out.b] + ' ×' + (r.out.n || 1) + '.'}${r.note ? ' ' + r.note : ''}<br>${miss.length ? '<span class="red">Il manque : ' + miss.map(m => m === 'établi' ? 'un établi à côté' : m[0] === 'b' && !isNaN(+m.slice(1)) ? NAME[+m.slice(1)] : ITEMS[m].name).join(', ') + '</span>' : '<button class="btn" id="cGo">FABRIQUER</button>'}</div>`;
  $('craftbody').innerHTML = h;
  $('craftbody').querySelectorAll('.rcp').forEach(c => c.onclick = () => { craftSel = +c.dataset.i; audio.fx('ui'); renderCraft(); });
  const go = $('cGo'); if (go) go.onclick = () => { craft(RECIPES[craftSel].id); renderCraft(); };
}
function craft(id) {
  const r = RECIPES.find(q => q.id === id); if (!r || missing(S, r, nearBench()).length) { audio.fx('deny'); return false; }
  consume(S, r);
  if (r.out.b) S.blocks[r.out.b] = (S.blocks[r.out.b] || 0) + (r.out.n || 1) * (r.bench && G.tf.foreman ? 2 : 1); else addItem(r.out.i, r.out.n || 1, 0);
  S.stats.crafted++; audio.fx('craft'); toast('Fabriqué : ' + r.name + ((r.out.n || 1) > 1 ? ' ×' + r.out.n : '')); G.dirtyHot = true; questEvent('craft', id);
  return true;
}
function openPanel(id) { if (G.state !== 'play') return; G.state = id; unlock(); show(id); audio.fx('ui'); if (id === 'craft') renderCraft(); if (id === 'talents') renderTalents(); if (id === 'inv') renderInv(); if (id === 'quests') renderQuests(); if (id === 'map') drawBigMap(); }
function closePanels() { for (const id of ['inv', 'quests', 'map', 'dialog', 'craft', 'talents']) hide(id); if (['inv', 'quests', 'map', 'dialog', 'craft', 'talents'].includes(G.state)) G.state = 'play'; G.dirtyHot = true; }
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
  hold('tAtk', 'tAtk'); hold('tJump', 'tJump'); tap('tJump', () => input.tJumpP = true); tap('tRoll', () => input.tRollP = true);
  hold('tBrk', 'tBrk'); tap('tBrk', () => input.tBrkP = true); tap('tCraft', () => pressed.add('KeyK')); tap('tPlace', () => input.tPlaceP = true); tap('tTalk', () => pressed.add('KeyE'));
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
  if (G.car) { scene.remove(G.car.m.g); G.car = null; } G.drive = false;
  for (const c of G.critters) scene.remove(c.M.g); G.critters = []; if (G.flock) { for (const b of G.flock.birds) scene.remove(b.M.g); G.flock = null; }
  for (const p of G.pickups) scene.remove(p.m); G.pickups = []; for (const p of G.projs) scene.remove(p.mesh); G.projs = []; for (const r of G.rings) scene.remove(r.m); G.rings = []; G.camps.clear(); G.boss = null; $('bossbox').classList.add('hidden');
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
  u.sunCol.value.copy(sky.sun.color); u.skyCol.value.copy(sky.hor).lerp(sky.top, 0.3); u.dayF.value = sky.dayF; u.sunInt.value = Math.min(1.2, sky.sun.intensity / 2); u.rain.value = sky.rain;
  const k = 1 - sky.dayF; world.matGl.color.setRGB(0.86 + 0.8 * k, 0.86 + 0.5 * k, 0.86 + 0.05 * k); // fenêtres et lanternes plus chaudes la nuit
  blobMat.visible = !renderer.shadowMap.enabled;
}
function enterPlay() {
  hide('loading'); show('hud'); G.state = 'play'; G.dirtyHot = true; G.dirtyQ = true; setupTouchOnce();
  const P = G.P; const gy = world.ground(P.x, P.z, P.y + 2); if (P.y < gy - 0.5 || boxHit(world, P.x, P.y, P.z, P.hw, P.h)) P.y = gy;
  if (S.migrated) { delete S.migrated; setTimeout(() => toast('Le monde est maintenant en voxels de 50 cm : tes anciennes constructions ont été remises à zéro.'), 2500); }
  placeCar();
  if (G.travelTo) { const k = G.travelTo; G.travelTo = null; G.regKey = gen.nord.region(P.x, P.z); if (G.regKey) G.regSeen[G.regKey] = G.t; banner((REGIONS[k] ? REGIONS[k][0] : 'Vieille-Ville').toUpperCase(), 'Terminus! Merci d’avoir voyagé avec Orignal Express'); }
  else if (!S.q.cones && !S.introDone) { S.introDone = true; banner('VOXELLE-QUÉBEC', 'Va parler à Gaston, le crieur public, sur la place'); }
  else banner('BON RETOUR!', 'Niveau ' + S.lvl + ' · ' + S.cash + ' piasses');
  audio.mode = 'day';
}
let touchSet = false; function setupTouchOnce() { if (!touchSet) { touchSet = true; setupTouch(); } }
function handleKeys() {
  const st = G.state;
  if (st === 'play') {
    if (pressed.has('KeyE')) { if (G.drive) exitCar(); else if (G.talkTo) openDialog(G.talkTo); else if (G.nearCar) enterCar(); }
    if (pressed.has('KeyI') || pressed.has('Tab')) openPanel('inv');
    else if (pressed.has('KeyJ')) openPanel('quests');
    else if (pressed.has('KeyM')) openPanel('map');
    else if (pressed.has('KeyK')) openPanel('craft');
    else if (pressed.has('KeyT')) openPanel('talents');
    else if (pressed.has('Escape') || pressed.has('KeyP')) openPause();
    if (pressed.has('KeyR')) eat();
    if (pressed.has('KeyQ')) swapWeapon();
    for (let i = 1; i <= 9; i++) if (pressed.has('Digit' + i)) { S.hot = i - 1; G.dirtyHot = true; }
    if (input.wheel) { const n = Math.max(1, hotList().length); S.hot = ((S.hot + input.wheel) % n + n) % n; input.wheel = 0; G.dirtyHot = true; }
  } else if (['inv', 'quests', 'map', 'craft', 'talents'].includes(st)) {
    if (st === 'map' && (pressed.has('KeyZ') || pressed.has('Equal') || pressed.has('Minus'))) { G.mapZ = (G.mapZ + (pressed.has('Minus') ? 2 : 1)) % 3; drawBigMap(); }
    const k = { inv: ['KeyI', 'Tab'], quests: ['KeyJ'], map: ['KeyM'], craft: ['KeyK'], talents: ['KeyT'] }[st];
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
      const gd = G.hitstop > 0 ? dt * 0.08 : dt; G.hitstop = Math.max(0, G.hitstop - dt); // arrêt sur image à l'impact
      if (G.drive) driveUpdate(gd); else playerUpdate(gd); carUpdate(gd); enemiesUpdate(gd); npcsUpdate(dt); pickupsUpdate(gd); projUpdate(gd); spawner(dt);
      crittersUpdate(dt);
      sky.t = (sky.t + dt / DAY_LEN) % 1;
      G.weatherT -= dt; if (G.weatherT <= 0) { const r = Math.random(); sky.snowT = r < 0.28 ? 1 : 0; sky.rainT = r >= 0.28 && r < 0.5 ? 1 : 0; G.weatherT = 90 + Math.random() * 150; }
      if (sky.thunder > 0) { sky.thunder -= dt; if (sky.thunder <= 0) audio.fx('thunder'); }
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
    camUpdate(dt); partsUpdate(dt); ringsUpdate(dt); G.shake *= Math.pow(0.004, dt);
    const col = gen.column(Math.floor(P.x), Math.floor(P.z));
    sky.update(dt, camera.position, G.t, world.view * CS, col.biome === BIOME.COLLINES ? 0.85 : 0);
    amb.update(dt, P, G.t, 1 - sky.dayF, col.biome === BIOME.BOREALE || col.biome === BIOME.ERABLIERE || col.biome === BIOME.CAMPAGNE, col.biome === BIOME.ERABLIERE, Math.max(sky.rain, sky.snow));
    if (st === 'play') { hudUpdate(dt); miniUpdate(dt); }
  }
  pressed.clear();
  waterUpdate();
  renderer.render(scene, camera);
}
// écran de choix du personnage : portraits rendus avec les vrais modèles
function drawPortraits() {
  const sc = new THREE.Scene(); sc.add(new THREE.AmbientLight(0xffffff, 1.2)); const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-2, 3, -4); sc.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 180 / 260, 0.1, 20); cam.position.set(-0.9, 1.45, -4.1); cam.lookAt(0, 1.05, 0);
  const W = 180 * 2, H = 260 * 2, rt = new THREE.WebGLRenderTarget(W, H), px = new Uint8Array(W * H * 4);
  const keepSh = renderer.shadowMap.enabled, keepCol = renderer.getClearColor(new THREE.Color()), keepA = renderer.getClearAlpha(); renderer.shadowMap.enabled = false;
  for (const card of document.querySelectorAll('#perso .pcard')) {
    const m = human(PLAYER_LOOKS[card.dataset.p]); setWeapon(m, 'baton'); m.g.rotation.y = card.dataset.p === 'fille' ? 0.75 : 0.35; animHuman(m, 0, 0, 0, false, false); m.P.armR.rotation.x = 0.5; sc.add(m.g);
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, cam); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px); renderer.setRenderTarget(null);
    sc.remove(m.g);
    const cv = card.querySelector('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d'), img = cx.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4); // à l'endroit
    cx.putImageData(img, 0, 0);
  }
  renderer.shadowMap.enabled = keepSh; renderer.setClearColor(keepCol, keepA); rt.dispose();
}
let persoMode = 'new', persoSel = 'gars', portraitsOk = false;
function persoLabel() { $('persoNom').textContent = PERSO_NOM[perso()]; }
function openPerso(mode) {
  persoMode = mode; persoSel = perso(); hide('title'); show('perso');
  if (!portraitsOk) { try { drawPortraits(); portraitsOk = true; } catch (er) { console.warn('portraits', er); } }
  document.querySelectorAll('#perso .pcard').forEach(c => c.classList.toggle('on', c.dataset.p === persoSel));
  $('bPersoGo').textContent = mode === 'new' ? 'C’EST PARTI!' : 'OK';
}
document.querySelectorAll('#perso .pcard').forEach(c => c.onclick = () => { persoSel = c.dataset.p; audio.fx('ui'); document.querySelectorAll('#perso .pcard').forEach(o => o.classList.toggle('on', o === c)); });
$('bPersoGo').onclick = () => { localStorage.setItem(PERSO_KEY, persoSel); persoLabel(); hide('perso'); if (persoMode === 'new') startGame(true); else show('title'); };
$('bPersoBack').onclick = () => { hide('perso'); show('title'); };
$('bPerso').onclick = () => openPerso('change');
persoLabel();
// boutons
$('bCont').onclick = () => startGame(false);
$('bNew').onclick = () => { if (loadSave() && !confirm('Commencer une nouvelle partie? L’ancienne sauvegarde sera remplacée.')) return; openPerso('new'); };
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
const API = { dropGearAt: (x, y, z, id, r) => dropPickup('gear', x, y, z, { id, r, still: true }), gainXP, learn, refreshLook, talentPts: () => talentPts(S), rollRarity, dropGear, equip, craft, nearBench, RECIPES, mineTime: b => mineTime(S, ITEMS, b, G.mineBonus || 0), toolFor: b => toolFor(S, ITEMS, b), addItem, ITEMS, renderCraft, normSave, amb, renderQuests, openPanel, say, critterSpawn, damageEnemy, ring, perso, openPerso, travel, enterCar, exitCar, REGIONS, get car() { return G.car; }, drawBigMap, G, get S() { return S; }, get world() { return world; }, sky, input, gen, keys, pressed, camera, stats, xpNext, hotList, questTargetPos, layout, writeSave, startGame, openDialog, closeDialog, QUESTS, ENEMIES, B, eat, spawnEnemy, toast, renderer, applyQuality, OPT, NPCS, SHOPS, get pickups() { return G.pickups; } };
window.__game = API;

// v6.4 : course de bazous sur la 175, du garage de Ti-Gus (au bout du village) vers le nord, 5 points de contrôle.
// Ton bazou (physique de main.js, avec dérapage en course), 3 rivaux (IA sur la route), dégâts et boucane, chrono, record.
import * as THREE from 'three';
import { BAZOU } from './data.js';
export function createBazou(C) {
  const { G, gen, scene, audio } = C, S = () => C.S(), N = () => gen.nord;
  const garage = { x: 14.5, z: -123.5 };
  let R = null, el = null; // R : la course en cours
  const roadDir = z => { const dx = N().roadX(z - 1) - N().roadX(z); return Math.atan2(-dx, 1); }; // cap vers le nord le long de la route
  const ground = (x, z) => C.world.loadedAround(x, z, 0) ? C.world.ground(x, z, N().roadH(z) + 4) : gen.heightAt(x, z) + 1;
  const fmt = t => Math.floor(t / 60) + ':' + (t % 60).toFixed(1).padStart(4, '0');
  // ---------- interface ----------
  function ui() {
    if (el) return; el = document.createElement('div'); el.id = 'bazou'; el.className = 'hidden';
    el.innerHTML = '<div id="bzTop"><span id="bzPos">1/4</span><span id="bzCp">CP 0/5</span><span id="bzT">0:00.0</span></div><div id="bzCount"></div><div id="bzSpd"><b>0</b> km/h<div id="bzDmg"><div></div></div><small>carrosserie</small></div>'
      + '<div id="bzRes" class="hidden"></div><button id="bzAb" class="btn">ABANDON</button>'
      + '<div id="bzPad"><button data-k="l" class="btn">◀</button><button data-k="r" class="btn">▶</button></div><div id="bzPad2"><button data-k="b" class="btn">FREIN</button><button data-k="g" class="btn big">GAZ</button></div>';
    document.body.appendChild(el);
    el.querySelectorAll('[data-k]').forEach(b => { const k = b.dataset.k, on = e => { e.preventDefault(); if (R) { R.tb[k] = true; R.tbUsed = true; } }, off = () => { if (R) R.tb[k] = false; };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off); });
    el.querySelector('#bzAb').onclick = () => abandon('Course abandonnée.');
  }
  const $ = id => el.querySelector('#' + id);
  // ---------- portes des points de contrôle ----------
  function gate(z, fin) {
    const g = new THREE.Group(), x = N().roadX(z), y = ground(x, z), w = 11, mat = c => new THREE.MeshLambertMaterial({ color: c });
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.4, 0.35), mat(0x3a3a3a)); p.position.set(sx * w / 2, 2.2, 0); g.add(p); }
    if (fin) for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) { const q = new THREE.Mesh(new THREE.BoxGeometry(w / 12, 0.4, 0.12), mat((i + j) % 2 ? 0x111111 : 0xf2f2f2)); q.position.set(-w / 2 + (i + 0.5) * w / 12, 4.0 + j * 0.4, 0); g.add(q); }
    else { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, 0.12), mat(0xff7a1a)); b.position.set(0, 4.1, 0); g.add(b); }
    g.position.set(x, y, z); g.rotation.y = roadDir(z); scene.add(g); return g;
  }
  // ---------- départ ----------
  function start() {
    if (R || !G.car) return; ui();
    const s = S(); if (s.cash < BAZOU.frais) { audio.fx('deny'); C.toast('L’inscription coûte ' + BAZOU.frais + ' piasses.'); return; }
    s.cash -= BAZOU.frais;
    const z0 = BAZOU.z0, yaw = roadDir(z0), slot = (k, lane) => { const z = z0 + 5 + k * 7; return { x: N().roadX(z) + lane, z }; };
    // ton bazou sur la grille (2e rangée, voie de droite), toi au volant
    const me = slot(1, 1.7), car = G.car; if (G.drive) C.exitCar();
    s.car = { x: me.x, z: me.z, yaw: roadDir(me.z) }; C.placeCar(); G.P.x = me.x; G.P.z = me.z; G.carHint = true; C.enterCar(); car.dir = car.yaw; G.camYaw = car.yaw; G.camPitch = 0.3;
    R = { t: 0, count: 3.2, cp: 0, cpT: [], ai: [], gates: [], tb: {}, dmg: 0, smokeT: 0, done: false, freeze: true, z0, prevZ: me.z, order: [] };
    BAZOU.rivaux.forEach((r, i) => { const sp = [slot(0, -1.7), slot(0, 1.7), slot(1, -1.7)][i], m = C.carModel(r.col, r.roof, r.box, r.tuque); m.g.rotation.order = 'YXZ'; scene.add(m.g);
      const lbl = C.makeLabel('npc', `<div class="nm">${r.name.replace(/ «.*»/, '')}</div>`);
      R.ai.push({ ...r, m, lbl, s: z0 - sp.z, v: 0, lane: sp.x - N().roadX(sp.z), lane0: sp.x - N().roadX(sp.z), y: ground(sp.x, sp.z), pitch: 0, fin: null, wob: Math.random() * 6 }); });
    BAZOU.cps.forEach((z, i) => R.gates.push(gate(z, i === BAZOU.cps.length - 1)));
    R.L = z0 - BAZOU.cps[BAZOU.cps.length - 1]; for (const a of R.ai) aiStep(a, 0, 0); // rivaux posés sur la grille
    G.race = { freeze: true, vmax: run => (run ? 29 : 24) * (1 - Math.min(0.35, R.dmg * 0.004)), hit: v => hurt(Math.min(25, v * 0.9)) };
    el.classList.remove('hidden'); $('bzRes').classList.add('hidden'); document.body.classList.add('bazou'); document.body.classList.toggle('bzTouch', !!C.isTouch);
    C.toast(C.isTouch ? 'GAZ pour avancer, ◀ ▶ pour tourner, FREIN pour ralentir.' : 'W : gaz · S : frein · A/D : tourner · Maj : turbo. Passe les 5 portes!');
    audio.fx('horn'); G.raceLog = []; show();
  }
  function hurt(n) { if (!R) return; R.dmg = Math.min(100, R.dmg + n); if (n > 4) { C.burst(G.car.x, G.car.y + 1.2, G.car.z, 0x8a8a8e, 6, 3); } }
  function cleanup() {
    if (!R) return; for (const a of R.ai) { scene.remove(a.m.g); a.lbl.remove(); } for (const g of R.gates) scene.remove(g);
    R = null; G.race = null; el.classList.add('hidden'); document.body.classList.remove('bazou', 'bzTouch'); C.input.tx = C.input.tz = 0;
  }
  function abandon(msg) { if (!R) return; C.toast(msg); cleanup(); C.writeSave(); }
  // ---------- IA ----------
  function aiStep(a, dt, pS) {
    const L = R.L, gap = a.s - pS;
    let vt = a.vmax * (gap > 45 ? 0.9 : gap < -45 ? 1.08 : 1) * (a.fin ? 0.4 : 1); // élastique : ni trop loin devant, ni trop loin derrière
    const z = R.z0 - a.s, curv = Math.abs(N().roadX(z - 12) - 2 * N().roadX(z) + N().roadX(z + 12)); vt *= 1 - Math.min(0.25, curv * 0.03); // ralentit dans les courbes
    a.v += Math.max(-12, Math.min(7.5, (vt - a.v) * 2)) * dt; a.s += a.v * dt;
    const car = G.car, nz = R.z0 - a.s, ahead = Math.abs(car.x - (N().roadX(nz) + a.lane)) < 1.9 && (a.s < (R.z0 - car.z)) && (R.z0 - car.z) - a.s < 8;
    a.lane += ((ahead ? -Math.sign(a.lane0 || 1) * 1.7 : a.lane0) - a.lane) * Math.min(1, dt * 1.5); // dépasse par l'autre voie
    if (a.s >= R.L && a.fin == null) { a.fin = R.t; R.order.push(a.name); audio.fx('honk', 0.4); }
    const x = N().roadX(nz) + a.lane + Math.sin(R.t * 1.3 + a.wob) * 0.25, gy = ground(x, nz), yaw = roadDir(nz);
    a.y += (gy - a.y) * Math.min(1, dt * 12); const gf = ground(x - Math.sin(yaw) * 1.5, nz - Math.cos(yaw) * 1.5), gb = ground(x + Math.sin(yaw) * 1.5, nz + Math.cos(yaw) * 1.5);
    a.pitch += (Math.max(-0.4, Math.min(0.4, Math.atan2(gf - gb, 3))) - a.pitch) * Math.min(1, dt * 8);
    a.x = x; a.z = nz; a.m.g.position.set(x, a.y, nz); a.m.g.rotation.y = yaw; a.m.g.rotation.x = a.pitch;
    for (const w of a.m.P.wheels) w.rotation.x -= a.v * dt / 0.41; a.m.P.body.position.y = Math.sin(R.t * 23 + a.wob) * 0.015 * Math.min(1, a.v / 5);
    if (a.v > 8 && Math.random() < dt * 6) C.burst(x + Math.sin(yaw) * 2.2, a.y + 0.5, nz + Math.cos(yaw) * 2.2, 0x6a6a6a, 1, 1, -1.5); // boucane du pot d'échappement
    // accrochage avec toi
    const d = Math.hypot(car.x - x, car.z - nz);
    if (d < 2.5 && R.t - (a.bumpT || -9) > 0.6) { a.bumpT = R.t; const rel = Math.abs(car.v - a.v); car.v *= 0.82; a.v *= 0.9; car.x += (car.x - x) / (d || 1) * 0.6; car.z += (car.z - nz) / (d || 1) * 0.3; hurt(4 + rel * 0.8); audio.fx('bonk', 0.7); R.bumps = (R.bumps || 0) + 1; }
    C.placeLabel(a.lbl, x, a.y + 2.6, nz, 60);
  }
  // ---------- boucle (état play) ----------
  function update(dt) {
    if (!R) return;
    const car = G.car;
    if (!G.drive) { abandon('T’es sorti du bazou : course abandonnée.'); return; }
    // tactile : boutons ◀ ▶ GAZ FREIN
    if (R.tbUsed) { const tb = R.tb; C.input.tx = (tb.r ? 1 : 0) - (tb.l ? 1 : 0); C.input.tz = tb.g ? -1 : tb.b ? 1 : 0; }
    if (R.count > 0) { R.count -= dt; G.race.freeze = R.count > 0; car.v = 0; if (Math.ceil(R.count) !== R.lastC) { R.lastC = Math.ceil(R.count); audio.fx(R.count > 0 ? 'ui' : 'level', 0.7); } show(); return; }
    if (!R.done) R.t += dt;
    R.L = R.z0 - BAZOU.cps[BAZOU.cps.length - 1];
    const pS = R.z0 - car.z;
    for (const a of R.ai) aiStep(a, dt, pS);
    // points de contrôle (on traverse la ligne vers le nord, sur la route)
    if (!R.done) { const cz = BAZOU.cps[R.cp];
      if (R.prevZ > cz && car.z <= cz) { if (Math.abs(car.x - N().roadX(cz)) < 7.5) { R.cp++; R.cpT.push(R.t); audio.fx(R.cp === BAZOU.cps.length ? 'quest' : 'coin');
          if (R.cp === BAZOU.cps.length) finish(); else C.toast('Porte ' + R.cp + '/' + BAZOU.cps.length + ' · ' + fmt(R.t)); }
        else C.toast('T’as manqué la porte! Reviens passer dedans.'); }
      R.prevZ = car.z; }
    // dégâts : boucane du capot, dérapage = fumée des pneus
    const slip = car.dir != null ? Math.abs(Math.atan2(Math.sin(car.yaw - car.dir), Math.cos(car.yaw - car.dir))) : 0;
    if ((R.smokeT -= dt) < 0) { R.smokeT = 0.12;
      if (R.dmg > 30) C.burst(car.x - Math.sin(car.yaw) * 1.8, car.y + 1.3, car.z - Math.cos(car.yaw) * 1.8, R.dmg > 65 ? 0x2a2a2a : 0x8a8a8a, 1, 1.2, -2);
      if (slip > 0.18 && Math.abs(car.v) > 8) { C.burst(car.x + Math.sin(car.yaw) * 1.4, car.y + 0.3, car.z + Math.cos(car.yaw) * 1.4, 0xd8d8d8, 2, 1.5, -1); R.drift = (R.drift || 0) + 1; } }
    if (R.done && R.endT != null && (R.endT -= dt) <= 0) { R.endT = null; results(); }
    show();
  }
  function finish() {
    R.done = true; R.myT = R.t; G.race.freeze = false; R.endT = 1.2;
    C.banner('ARRIVÉE!', 'Ton temps : ' + fmt(R.t));
  }
  function results() {
    const s = S(), b = s.bazou, me = R.myT;
    // les rivaux pas encore arrivés : temps estimé à leur vitesse
    const times = R.ai.map(a => ({ name: a.name, t: a.fin != null ? a.fin : R.t + (R.L - a.s) / Math.max(8, a.vmax) })).concat([{ name: 'Toi', t: me, me: true }]).sort((a, b) => a.t - b.t);
    const pos = times.findIndex(x => x.me) + 1, pr = BAZOU.prix[pos - 1], rec = !b.best || me < b.best;
    b.n++; if (pos === 1) b.w++; if (pos <= 3) b.podium++; if (rec) b.best = +me.toFixed(2);
    s.cash += pr.cash; C.gainXP(pr.xp); audio.fx(pos === 1 ? 'quest' : 'coin'); G.dirtyHot = true;
    R.pos = pos; G.lastRace = { pos, t: me, rec, times };
    const rows = times.map((x, i) => `<tr${x.me ? ' class="gold"' : ''}><td>${i + 1}</td><td>${x.name}</td><td>${fmt(x.t)}</td></tr>`).join('');
    $('bzRes').innerHTML = `<b class="big">${pos === 1 ? 'VICTOIRE SUR LA 175!' : pos + (pos === 1 ? 're' : 'e') + ' place'}</b><table class="rec">${rows}</table>`
      + (rec ? '<b class="gold">Nouveau record : ' + fmt(me) + '</b><br>' : 'Ton record : ' + fmt(b.best) + '<br>') + `<span class="rw">${pr.cash} piasses · ${pr.xp} XP</span><div id="bzResB"></div>`;
    const bb = $('bzResB'), mk = (l, fn) => { const e = document.createElement('button'); e.className = 'btn'; e.textContent = l; e.onclick = fn; bb.appendChild(e); };
    mk('RETOUR AU GARAGE', () => { cleanup(); towHome(); }); mk('RESTER ICI', () => { cleanup(); C.writeSave(); });
    $('bzRes').classList.remove('hidden'); C.writeSave();
  }
  function towHome() { // Ti-Gus te remorque jusqu'au garage
    const s = S(); if (G.drive) C.exitCar(); s.car = { x: 10, z: -126, yaw: 0 }; C.placeCar(); const P = G.P; P.x = garage.x - 1.5; P.z = garage.z - 1.5; P.y = gen.heightAt(P.x, P.z) + 1.5; P.vx = P.vz = P.vy = 0; C.writeSave();
    C.toast('Ti-Gus t’a remorqué jusqu’au garage.');
  }
  function show() {
    if (!R) return; const car = G.car;
    const pS = R.z0 - car.z, ranks = R.ai.filter(a => (a.fin != null && (!R.done || a.fin < R.myT)) || (a.fin == null && !R.done && a.s > pS)).length + 1;
    const set = (id, v) => { if ($(id).textContent !== v) $(id).textContent = v; };
    set('bzPos', 'P ' + ranks + '/4'); set('bzCp', 'Porte ' + R.cp + '/' + BAZOU.cps.length); set('bzT', fmt(R.done ? R.myT : R.t));
    set('bzCount', R.count > 0 ? String(Math.ceil(R.count)) : R.t < 1 ? 'GO!' : '');
    $('bzSpd').firstChild.textContent = Math.round(Math.abs(car.v) * 3.6 * 1.6); $('bzDmg').firstChild.style.width = (100 - R.dmg) + '%';
  }
  // ---------- Ti-Gus ----------
  function talk(add) {
    const b = S().bazou;
    add('COURSE SUR LA 175 · ' + BAZOU.frais + ' $', () => { C.closeDialog(); start(); }, true);
    return 'Une course de bazous sur la 175, jusqu’à la réserve : cinq portes, trois chauffards du rang pis toi. Ça coûte ' + BAZOU.frais + ' piasses d’inscription. Casse pas mon garage en partant.'
      + '<br><span class="gold">Courses : ' + b.n + ' · victoires : ' + b.w + ' · record : ' + (b.best ? fmt(b.best) : '—') + '</span>';
  }
  return { start, update, talk, abandon, towHome, garage, get R() { return R; }, fmt };
}

// v6.3 : hockey (dek hockey hors de l'hiver) sur la patinoire du village de Mireille — 3 contre 3 (2 patineurs + gardien),
// premier à 3 buts ou 3 minutes. Tu patines avec ton bâton : LANCE (Espace / clic gauche / bouton), PASSE (E / clic droit / bouton).
import * as THREE from 'three';
import { HOCKEY } from './data.js';
export function createHockey(C) {
  const { G, scene, audio } = C, S = () => C.S();
  const rk = () => { const s = C.gen.extras[0]; return { s, cx: s.x + 0.5, cz: s.z + 0.5, hx: 10.3, hz: 6.3, gx: 8.75, mouth: 0.82, y: s.h + 1 }; };
  let M = null, el = null; // M : la partie en cours
  const ice = () => C.G.season === 0;
  // ---------- interface ----------
  function ui() {
    if (el) return; el = document.createElement('div'); el.id = 'hockey'; el.className = 'hidden';
    el.innerHTML = '<div id="hkScore"><span class="b">BLEUS <b id="hkB">0</b></span><span id="hkClock">3:00</span><span class="r"><b id="hkR">0</b> ROUGES</span></div><div id="hkMsg"></div>'
      + '<div id="hkEnd" class="hidden"><div id="hkEndT"></div><div id="hkEndBtns"></div></div><div id="hkBtns"><button id="hkPasse" class="btn">PASSE</button><button id="hkLance" class="btn big">LANCE</button></div><small id="hkHelp"></small>';
    document.body.appendChild(el);
    const bt = (id, f) => el.querySelector('#' + id).addEventListener('pointerdown', e => { e.preventDefault(); if (M) M[f] = true; });
    bt('hkLance', 'wantShot'); bt('hkPasse', 'wantPass');
    // clic gauche : lance, clic droit : passe (pris à l'appui : un clic rapide tombe parfois entre deux images)
    addEventListener('mousedown', e => { if (!M || G.state !== 'hockey' || (e.target.closest && e.target.closest('#hockey button'))) return; if (e.button === 0) M.wantShot = true; else if (e.button === 2) M.wantPass = true; });
  }
  const $ = id => el.querySelector('#' + id);
  // ---------- joueurs ----------
  function skaterModel(team, k, gk) {
    const T = team ? HOCKEY.rouges : HOCKEY.bleus, look = Object.assign(C.npcLook('villageois', 4000 + team * 97 + k * 31), { coat: T.coat, hat: gk ? 0x2a2a2a : T.hat, pom: T.hat, sash: false });
    const m = C.human(look); C.setWeapon(m, 'baton'); scene.add(m.g); return m;
  }
  function makeTeams() {
    const R = rk(), L = [];
    const add = (team, name, gk, me) => { const sk = { team, name, gk, me, x: R.cx, z: R.cz, vx: 0, vz: 0, yaw: 0, cd: 0, walkT: 0, hold: 0, think: Math.random() };
      if (me) sk.model = G.P.model; else { sk.model = skaterModel(team, L.length, gk); sk.label = C.makeLabel('npc', `<div class="nm">${name}</div>`); }
      L.push(sk); return sk; };
    add(0, 'Toi', false, true); add(0, HOCKEY.bleus.skaters[0], false); add(0, HOCKEY.bleus.goalie, true);
    add(1, HOCKEY.rouges.skaters[0], false); add(1, HOCKEY.rouges.skaters[1], false); add(1, HOCKEY.rouges.goalie, true);
    return L;
  }
  function faceoff() {
    const R = rk(), L = M.L; M.ph = 'mise'; M.t = 0; M.puck.own = null; M.puck.vx = M.puck.vz = 0; M.puck.x = R.cx; M.puck.z = R.cz; M.lastTouch = null;
    const spots = [[-1.3, 0], [-3.6, 2.4], [-R.gx + 0.7, 0], [1.3, 0], [3.6, -2.4], [R.gx - 0.7, 0]];
    L.forEach((p, i) => { p.x = R.cx + spots[i][0]; p.z = R.cz + spots[i][1]; p.vx = p.vz = 0; p.yaw = p.team ? Math.PI / 2 : -Math.PI / 2; p.hold = 0; p.cd = 0; });
  }
  // ---------- début / fin ----------
  function start() {
    if (M) return; ui(); const R = rk(), P = G.P;
    M = { L: null, sc: [0, 0], clock: HOCKEY.temps, ph: 'mise', t: 0, wantShot: false, wantPass: false, goals: [], shots: 0, dek: !ice() };
    M.L = makeTeams();
    const pk = new THREE.Mesh(M.dek ? new THREE.SphereGeometry(0.13, 10, 8) : new THREE.CylinderGeometry(0.17, 0.17, 0.07, 14), new THREE.MeshLambertMaterial({ color: M.dek ? 0xff7a1a : 0x111111 }));
    scene.add(pk); M.puck = { mesh: pk, x: R.cx, z: R.cz, vx: 0, vz: 0, own: null };
    M.weapon = S().equip.arme ? S().equip.arme.id : 'baton'; C.setWeapon(P.model, 'baton');
    // les patineurs du village laissent la glace aux joueurs ; on cache les étiquettes du monde
    for (const [, n] of G.npcs) { if (n.s === R.s && n.role === 'villageois') { n.model.g.visible = false; n.hiddenHk = true; } }
    document.querySelectorAll('#labels .lb').forEach(e => { e.style.display = 'none'; });
    G.petHold = { x: R.cx - 3, z: R.cz + R.hz + 1.6, y: R.y, yaw: Math.PI }; // le compagnon attend le long de la bande
    G.state = 'hockey'; C.unlock(); G.camYaw = 0; G.camPitch = 0.72; G.camDist = 10;
    el.classList.remove('hidden'); $('hkEnd').classList.add('hidden'); document.body.classList.add('hockey');
    $('hkHelp').textContent = C.isTouch ? 'Pouce gauche : patine · LANCE : tire au but · PASSE : à ton coéquipier' : 'WASD : patine (Maj : vite) · Espace ou clic : LANCE · E ou clic droit : PASSE · Échap : abandonner';
    faceoff(); audio.fx('accept'); show();
  }
  function quit() {
    if (!M) return; const P = G.P;
    scene.remove(M.puck.mesh); for (const p of M.L) if (!p.me) { scene.remove(p.model.g); p.label.remove(); }
    for (const [, n] of G.npcs) if (n.hiddenHk) { n.model.g.visible = true; n.hiddenHk = false; }
    C.setWeapon(P.model, M.weapon); G.petHold = null;
    const R = rk(); P.x = R.cx - 6; P.z = R.cz + R.hz + 2.2; P.y = C.world.ground(P.x, P.z) + 0.1; P.vx = P.vz = P.vy = 0; // sur le banc des joueurs
    M = null; el.classList.add('hidden'); document.body.classList.remove('hockey'); G.state = 'play'; G.camPitch = 0.32; G.camDist = 5.8; C.writeSave();
  }
  function finish() {
    const s = S(), h = s.hockey, [b, r] = M.sc, res = b > r ? 'victoire' : b === r ? 'nulle' : 'defaite', pr = HOCKEY.prix[res];
    M.ph = 'fin'; M.t = 0; h.gp++; h[res === 'victoire' ? 'w' : res === 'nulle' ? 't' : 'l']++; h.gf += b; h.ga += r; if (b - r > h.best) h.best = b - r;
    let cup = ''; if (res === 'victoire' && !h.coupe) { h.coupe = true; C.addItem('coupe_mireille', 1); cup = '<br><b class="gold">Ta première victoire : Mireille te remet la Coupe Mireille!</b>'; }
    s.cash += pr.cash; C.gainXP(pr.xp); audio.fx(res === 'victoire' ? 'quest' : res === 'nulle' ? 'coin' : 'deny'); G.dirtyHot = true;
    const t = res === 'victoire' ? 'VICTOIRE DES BLEUS!' : res === 'nulle' ? 'MATCH NUL' : 'LES ROUGES GAGNENT';
    $('hkEndT').innerHTML = `<b class="big">${t}</b><br>Bleus ${b} — ${r} Rouges du rang 4<br>Tes buts : ${M.goals.filter(g => g.me).length} · lancers : ${M.shots}<br><span class="rw">${pr.cash} piasses · ${pr.xp} XP</span>${cup}`;
    const bb = $('hkEndBtns'); bb.innerHTML = ''; const mk = (l, fn) => { const e = document.createElement('button'); e.className = 'btn'; e.textContent = l; e.onclick = fn; bb.appendChild(e); };
    mk('REJOUER', () => { quit(); start(); }); mk('SORTIR', quit);
    $('hkEnd').classList.remove('hidden'); G.lastMatch = { res, b, r };
    C.writeSave();
  }
  // ---------- rondelle ----------
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  function release(p, vx, vz) { const k = M.puck; k.own = null; k.vx = vx; k.vz = vz; k.x = p.x - Math.sin(p.yaw) * 0.75; k.z = p.z - Math.cos(p.yaw) * 0.75; p.cd = 0.45; M.lastTouch = p; }
  function shoot(p, aimZ) {
    const R = rk(), sx = p.team ? -1 : 1, nx = R.cx + sx * R.gx, nz = aimZ != null ? aimZ : R.cz + (Math.random() - 0.5) * 1.3, dx = nx - p.x, dz = nz - p.z, L = Math.hypot(dx, dz) || 1, v = 15 + Math.random() * 3;
    p.yaw = Math.atan2(-dx, -dz); release(p, dx / L * v, dz / L * v); M.shotFrom = { team: p.team, d: L }; if (p.me) M.shots++;
    audio.fx('hit', 0.7); C.burst(M.puck.x, rk().y + 0.1, M.puck.z, ice() ? 0xe8f4ff : 0xb0a890, 4, 2.5);
  }
  function pass(p, to) {
    const dx = to.x + to.vx * 0.35 - p.x, dz = to.z + to.vz * 0.35 - p.z, L = Math.hypot(dx, dz) || 1, v = Math.min(12, 6 + L * 0.9);
    p.yaw = Math.atan2(-dx, -dz); release(p, dx / L * v, dz / L * v); M.shotFrom = null; audio.fx('swing', 0.6);
  }
  function goal(team) {
    const R = rk(), sc = M.lastTouch && M.lastTouch.team === team && !M.lastTouch.gk ? M.lastTouch : M.L.find(p => p.team === team && !p.gk);
    M.sc[team]++; M.goals.push({ team, who: sc.name, me: !!sc.me }); if (sc.me) S().hockey.buts++;
    M.ph = 'but'; M.t = 0; M.puck.vx *= 0.2; M.puck.vz *= 0.2; audio.fx('sirene');
    const nx = R.cx + (team ? -1 : 1) * R.gx; for (let k = 0; k < 3; k++) C.burst(nx, R.y + 1.2, R.cz, [0xffd23a, 0x2e5fa8, 0xc8282e][k], 10, 5);
    C.banner(team === 0 ? 'BUT DES BLEUS!' : 'BUT DES ROUGES', sc.me ? 'C’est TOI qui l’as mis dedans!' : sc.name + ' compte');
    G.hkLog = (G.hkLog || []).concat((team ? 'R:' : 'B:') + sc.name);
  }
  function puckStep(dt) {
    const R = rk(), k = M.puck;
    if (k.own) { const p = k.own; k.x = p.x - Math.sin(p.yaw) * 0.75; k.z = p.z - Math.cos(p.yaw) * 0.75; k.vx = p.vx; k.vz = p.vz; }
    else {
      const n = 3, h = dt / n, fr = Math.exp(-(M.dek ? 1.1 : 0.45) * h);
      for (let i = 0; i < n; i++) {
        const ox = k.x; k.x += k.vx * h; k.z += k.vz * h; k.vx *= fr; k.vz *= fr;
        // buts : la rondelle franchit la ligne entre les poteaux, du bon côté
        for (const sx of [-1, 1]) { const gl = R.cx + sx * R.gx, inMouth = Math.abs(k.z - R.cz) < R.mouth;
          if (inMouth && (ox - gl) * sx < 0 && (k.x - gl) * sx >= 0 && M.ph === 'jeu') { goal(sx > 0 ? 0 : 1); return; }
          if ((k.x - gl) * sx > 0 && (k.x - gl) * sx < 0.7 && Math.abs(k.z - R.cz) < R.mouth + 0.2 && (ox - gl) * sx > 0 && !(M.ph === 'but')) { k.vx = -k.vx * 0.4; k.x = gl + sx * 0.72; } } // filet : par derrière, ça rebondit
        if (Math.abs(k.x - R.cx) > R.hx) { k.x = R.cx + Math.sign(k.x - R.cx) * R.hx; k.vx = -k.vx * 0.55; audio.fx('bonk', 0.15); }
        if (Math.abs(k.z - R.cz) > R.hz) { k.z = R.cz + Math.sign(k.z - R.cz) * R.hz; k.vz = -k.vz * 0.55; }
        // gardiens : arrêt selon la distance du lancer
        if (M.ph === 'jeu') for (const g of M.L) if (g.gk && g.cd <= 0 && dist(g, k) < 0.55 && Math.hypot(k.vx, k.vz) > 6) {
          const fromD = M.shotFrom ? M.shotFrom.d : 8, sv = Math.max(0.3, Math.min(0.85, 0.22 + fromD * 0.07));
          if (Math.random() < sv) { k.own = g; k.vx = k.vz = 0; g.hold = 0.8; audio.fx('land', 0.8); M.saves = (M.saves || 0) + 1; C.toast(g.name + ' fait l’arrêt!'); } else g.cd = 0.4;
          break; }
      }
    }
    k.mesh.position.set(k.x, R.y + (M.dek ? 0.13 : 0.035), k.z);
  }
  // ---------- intelligence ----------
  function ai(p, dt) {
    const R = rk(), k = M.puck, sx = p.team ? -1 : 1, mates = M.L.filter(q => q.team === p.team && q !== p && !q.gk), foes = M.L.filter(q => q.team !== p.team);
    let tx = p.x, tz = p.z, sp = p.team ? 5.1 : 5.3;
    if (p.gk) { const gl = R.cx - sx * R.gx; tx = gl + sx * 0.7; tz = R.cz + Math.max(-0.75, Math.min(0.75, (k.z - R.cz) * 0.6)); sp = 4;
      if (k.own === p && (p.hold -= dt) <= 0) { const to = mates.length ? mates.reduce((a, b) => dist(a, p) < dist(b, p) ? a : b) : null; if (to) pass(p, to); else release(p, sx * 6, 0); } }
    else if (k.own === p) { const nx = R.cx + sx * R.gx, dn = Math.abs(nx - p.x); tx = nx - sx * 2.5; tz = R.cz + Math.sin(p.think * 7) * 1.2; sp *= 0.92;
      const press = foes.some(f => !f.gk && dist(f, p) < 1.3), free = mates.find(m => !foes.some(f => !f.gk && dist(f, m) < 1.6));
      if ((p.think -= dt) < 0) { p.think = 0.4 + Math.random() * 0.5;
        if (dn < 6.5 && Math.random() < 0.55) shoot(p); else if (press && free && Math.random() < 0.5) pass(p, free); } }
    else if (k.own && k.own.team === p.team) { tx = k.own.x + sx * 3; tz = R.cz + (k.own.z > R.cz ? -2.6 : 2.6); }
    else { // rondelle libre ou à l'adversaire : le plus proche y va, l'autre se replie entre la rondelle et son but
      const chaser = [p, ...mates].reduce((a, b) => dist(a, k) < dist(b, k) ? a : b);
      if (chaser === p) { tx = k.x + k.vx * 0.25; tz = k.z + k.vz * 0.25; sp *= 1.05; }
      else { const gl = R.cx - sx * R.gx; tx = gl + (k.x - gl) * 0.45; tz = R.cz + (k.z - R.cz) * 0.5; } }
    steer(p, tx - p.x, tz - p.z, sp, dt);
    // mise en échec (poke) : vol de la rondelle
    if (!p.gk && k.own && k.own.team !== p.team && !k.own.gk && dist(p, k.own) < 1.0 && k.own.cd <= 0 && Math.random() < dt * (k.own.me ? 0.8 : 1.1)) {
      const o = k.own; release(o, (p.x - o.x) * 1.5, (p.z - o.z) * 1.5); o.cd = 0.6; p.cd = 0; audio.fx('bonk', 0.4); if (o.me) C.toast(p.name + ' te vole la rondelle!'); }
  }
  function steer(p, dx, dz, sp, dt) {
    const L = Math.hypot(dx, dz), ax = L > 0.25 ? dx / L * sp : 0, az = L > 0.25 ? dz / L * sp : 0, kk = Math.min(1, dt * (M.dek ? 6 : 3.2));
    p.vx += (ax - p.vx) * kk; p.vz += (az - p.vz) * kk;
  }
  function me(p, dt) {
    const mi = C.moveInput(), m = Math.hypot(mi.mx, mi.mz), sp = (mi.run ? 6.4 : 5.6) * (M.dek ? 0.9 : 1);
    if (m > 0.12) { const kk = Math.min(1, dt * (M.dek ? 6 : 3.4)); p.vx += (mi.mx / m * sp * Math.min(1, m) - p.vx) * kk; p.vz += (mi.mz / m * sp * Math.min(1, m) - p.vz) * kk; }
    else { const f = Math.exp(-(M.dek ? 6 : 1.1) * dt); p.vx *= f; p.vz *= f; } // sur la glace, tu glisses
    const k = M.puck, R = rk(), mates = M.L.filter(q => q.team === 0 && !q.me && !q.gk);
    if (M.wantShot) { if (k.own === p) shoot(p, R.cz + Math.max(-0.6, Math.min(0.6, mi.mz * 0.6 + (Math.random() - 0.5) * 0.5)));
      else if (!k.own && dist(p, k) < 1.5) { shoot(p); }
      else if (k.own && k.own.team === 1 && !k.own.gk && dist(p, k.own) < 1.4) { if (Math.random() < 0.6) { const o = k.own; release(o, (p.x - o.x) * 2, (p.z - o.z) * 2); o.cd = 0.6; audio.fx('bonk', 0.5); } else audio.fx('swing', 0.4); }
      else audio.fx('swing', 0.4); p.atk = 0.3; }
    if (M.wantPass && k.own === p && mates.length) pass(p, mates[0]);
    M.wantShot = M.wantPass = false;
  }
  // ---------- boucle ----------
  function game(dt) {
    if (!M) return; const R = rk(), P = G.P, k = M.puck;
    if (C.pressed.has('Escape') && M.ph !== 'fin') { C.toast('Partie abandonnée.'); quit(); return; }
    if (M.ph === 'fin') { show(); return; }
    if (C.pressed.has('Space')) M.wantShot = true;
    if (C.pressed.has('KeyE') || C.input.rmbP) M.wantPass = true; C.input.rmbP = false;
    G.camYaw = 0; G.camPitch = 0.72; G.camDist = innerWidth < innerHeight ? 17 : C.isTouch ? 12.5 : 10; // téléphone debout : plus de recul pour voir la largeur de la glace // vue de la galerie
    M.t += dt;
    if (M.ph === 'mise') { M.wantShot = M.wantPass = false; if (M.t > 1.6) { M.ph = 'jeu'; M.t = 0; audio.fx('ui'); k.vz = (Math.random() - 0.5) * 2; } }
    else if (M.ph === 'but') { if (M.t > 2.6) { if (M.sc[0] >= HOCKEY.buts || M.sc[1] >= HOCKEY.buts) finish(); else faceoff(); } }
    if (M.ph === 'jeu') { M.clock -= dt; if (M.clock <= 0) { M.clock = 0; finish(); show(); return; } }
    const play = M.ph === 'jeu';
    for (const p of M.L) { p.cd -= dt; if (play) { if (p.me) me(p, dt); else ai(p, dt); } else { p.vx *= 0.8; p.vz *= 0.8; } }
    // déplacement, bandes, collisions entre joueurs
    for (const p of M.L) {
      p.x += p.vx * dt; p.z += p.vz * dt;
      p.x = Math.max(R.cx - R.hx + 0.3, Math.min(R.cx + R.hx - 0.3, p.x)); p.z = Math.max(R.cz - R.hz + 0.3, Math.min(R.cz + R.hz - 0.3, p.z));
      for (const sx of [-1, 1]) { const gl = R.cx + sx * R.gx; if (!p.gk && Math.abs(p.z - R.cz) < 1.05 && (p.x - gl) * sx > -0.35 && (p.x - gl) * sx < 0.8) p.x = gl - sx * 0.35; }
      const sp = Math.hypot(p.vx, p.vz); if (sp > 0.4) { const ty = Math.atan2(-p.vx, -p.vz); p.yaw += Math.atan2(Math.sin(ty - p.yaw), Math.cos(ty - p.yaw)) * Math.min(1, dt * 9); }
      p.walkT += dt * sp / 4.5;
    }
    for (let i = 0; i < M.L.length; i++) for (let j = i + 1; j < M.L.length; j++) { const a = M.L[i], b = M.L[j], d = dist(a, b); if (d < 0.7 && d > 0.001) { const ux = (b.x - a.x) / d, uz = (b.z - a.z) / d, o = (0.7 - d) / 2; a.x -= ux * o; a.z -= uz * o; b.x += ux * o; b.z += uz * o; } }
    // prise de la rondelle libre
    if (play && !k.own) { let best = null, bd = 0.7; for (const p of M.L) if (p.cd <= 0) { const d = dist(p, k) - (p.gk ? 0.1 : 0); if (d < bd && Math.hypot(k.vx - p.vx, k.vz - p.vz) < (p.gk ? 20 : 13)) { bd = d; best = p; } }
      if (best) { k.own = best; best.cd = 0.35; M.lastTouch = best; if (best.gk) best.hold = 0.8; } }
    puckStep(dt);
    // modèles et étiquettes
    for (const p of M.L) {
      const sp = Math.hypot(p.vx, p.vz);
      if (p.me) { P.x = p.x; P.z = p.z; P.y = R.y; P.vx = p.vx; P.vz = p.vz; P.vy = 0; P.yaw = p.yaw; }
      p.model.g.position.set(p.x, R.y, p.z); p.model.g.rotation.y = p.yaw;
      C.animHuman(p.model, p.walkT, Math.min(0.4, sp / 9), p.atk > 0 ? 1 - p.atk / 0.3 : 0, false, false); p.atk = Math.max(0, (p.atk || 0) - dt);
      const A = p.model.P; A.torso.rotation.x = p.gk ? 0.22 : 0.14; if (!(p.atk > 0)) { A.armR.rotation.x = 0.55; A.armL.rotation.x = 0.45; } // penché sur le bâton
      if (p.label) C.placeLabel(p.label, p.x, R.y + 2.3, p.z, 40);
    }
    show();
  }
  function show() {
    if (!M) return; $('hkB').textContent = M.sc[0]; $('hkR').textContent = M.sc[1];
    const c = Math.ceil(M.clock), t = Math.floor(c / 60) + ':' + String(c % 60).padStart(2, '0'); if ($('hkClock').textContent !== t) $('hkClock').textContent = t;
    const k = M.puck, msg = M.ph === 'mise' ? 'Mise au jeu… ' + Math.max(1, Math.ceil(1.6 - M.t)) : M.ph === 'but' ? '<b class="gold">BUT!</b> ' + M.goals[M.goals.length - 1].who : M.ph === 'fin' ? '' : k.own && k.own.me ? 'T’as la rondelle : LANCE!' : k.own && k.own.team === 0 ? k.own.name + ' a la rondelle' : k.own ? '<span class="red">' + k.own.name + ' a la rondelle</span>' : '';
    if ($('hkMsg').innerHTML !== msg) $('hkMsg').innerHTML = msg;
    $('hkBtns').style.display = M.ph === 'fin' ? 'none' : '';
  }
  // ---------- dialogue de Mireille, fiche ----------
  function talkAdd(add) {
    add(ice() ? 'JOUER UNE GAME DE HOCKEY' : 'JOUER UNE GAME DE DEK HOCKEY', () => { C.closeDialog(); start(); }, true);
    add('TA FICHE DE HOCKEY', fiche);
  }
  function fiche() {
    const h = S().hockey;
    C.dlg('Ligue de garage du village — ta fiche', `<table class="rec"><tr><th>Parties</th><th>V</th><th>N</th><th>D</th><th>Buts pour</th><th>Contre</th></tr><tr><td>${h.gp}</td><td>${h.w}</td><td>${h.t}</td><td>${h.l}</td><td>${h.gf}</td><td>${h.ga}</td></tr></table>`
      + `<p>Tes buts : <b class="gold">${h.buts}</b> · plus grosse victoire : ${h.best > 0 ? 'par ' + h.best : '—'}<br>${h.coupe ? '<b class="gold">🏆 Coupe Mireille gagnée</b>' : 'La Coupe Mireille attend sa première victoire.'}</p>`, [['FERMER', () => C.closeDialog(), true]]);
  }
  return { start, quit, game, talkAdd, fiche, rk, get M() { return M; }, shoot, goal };
}

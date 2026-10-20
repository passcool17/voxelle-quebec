// v6.2 : pêche blanche — village de cabanes sur le fleuve gelé (à l'ouest de la Vieille-Ville), location chez Ti-Guy,
// mini-jeu : percer, attendre la touche, ferrer, puis garder la ligne dans la zone verte (souris/clavier/tactile).
import * as THREE from 'three';
import { box, bake } from './models.js';
import { FISH, ITEMS } from './data.js';
import { SEA } from './blocks.js';
const RENT = 10;
export function createPeche(C) {
  const { G, gen, scene } = C, S = () => C.S();
  const X0 = -50, rz = x => gen.riverZ(x), rw = x => gen.riverW(x);
  const huts = [-15, -7.5, 0, 7.5, 15].map((dx, i) => { const x = Math.floor(X0 + dx) + 0.5; return { i, x, z: Math.floor(rz(x) - rw(x) * 0.42 + (i % 2) * 3) + 0.5, c: [0xb02a20, 0x2e5fa8, 0xe0b030, 0x3a7a3a, 0xe8e4dc][i] }; });
  // la rive nord la plus proche, sur la terre ferme : Ti-Guy et le tableau des records
  let sz = Math.floor(rz(X0) - rw(X0)); while (gen.heightAt(X0 + 0.5, sz + 0.5) < SEA + 0.5 && sz > rz(X0) - rw(X0) - 20) sz--;
  const shore = { x: X0 + 0.5, z: sz - 2.5 }, board = { x: X0 + 3, z: sz - 2.5 };
  let built = null, boardM = null, boardL = null;
  const ice = (x, z) => C.world.ground(x, z, SEA + 4);
  function hutModel(c) {
    const g = new THREE.Group(), w = 2.6, h = 2.1, t = 0.14, dark = new THREE.Color(c).multiplyScalar(0.6).getHex();
    box(g, w, h, t, c, 0, h / 2, w / 2); box(g, t, h, w, c, -w / 2, h / 2, 0); box(g, t, h, w, c, w / 2, h / 2, 0); // fond et côtés
    box(g, 0.85, h, t, c, -0.875, h / 2, -w / 2); box(g, 0.85, h, t, c, 0.875, h / 2, -w / 2); box(g, 0.9, 0.35, t, c, 0, h - 0.175, -w / 2); // façade, porte ouverte vers la rive
    const top = new THREE.Group(); g.add(top); g.userData.top = top; // toit à part : on l'enlève pendant la pêche pour voir dedans
    box(top, w + 0.4, 0.14, w + 0.4, dark, 0, h + 0.07, 0); box(top, w * 0.7, 0.12, w * 0.7, dark, 0, h + 0.2, 0);
    box(top, 0.18, 0.7, 0.18, 0x3a3a3a, 0.8, h + 0.45, 0.6); box(top, 0.24, 0.06, 0.24, 0x2a2a2a, 0.8, h + 0.82, 0.6); // tuyau du poêle
    box(g, 0.5, 0.35, 0.04, 0xfff0a0, w / 2 + 0.03, 1.3, 0.2, true); // fenêtre éclairée
    box(g, 0.8, 0.12, 0.35, 0x8a5a2c, 0, 0.45, 0.95); box(g, 0.1, 0.4, 0.1, 0x5a3a22, -0.3, 0.2, 0.95); box(g, 0.1, 0.4, 0.1, 0x5a3a22, 0.3, 0.2, 0.95); // banc
    box(g, 0.6, 0.02, 0.6, 0xc8d8e8, 0, 0.01, -0.1); // glace grattée
    bake(g); return g;
  }
  function boardModel() {
    const g = new THREE.Group(); box(g, 0.14, 1.6, 0.14, 0x5a3a22, -0.6, 0.8, 0); box(g, 0.14, 1.6, 0.14, 0x5a3a22, 0.6, 0.8, 0);
    box(g, 1.6, 0.9, 0.08, 0x8a5a2c, 0, 1.45, 0); box(g, 1.4, 0.7, 0.02, 0xe8e0c8, 0, 1.45, -0.05); for (let k = 0; k < 4; k++) box(g, 0.9 - (k % 2) * 0.3, 0.05, 0.02, 0x3a3a3a, -0.1, 1.68 - k * 0.15, -0.065);
    box(g, 0.3, 0.12, 0.02, 0x9ab8c8, 0.45, 1.3, -0.065); bake(g); return g;
  }
  const rented = () => S().peche.rent === S().day;
  const roof = (h, v) => { const m = built && built[h.i]; if (m) m.userData.top.visible = v; };
  function update(dt) {
    if (F && built) roof(F.h, false);
    const P = G.P, d = Math.hypot(P.x - X0, P.z - rz(X0));
    if (d < 140 && G.frozen && !built) { built = huts.map(h => { const m = hutModel(h.c); m.position.set(h.x, ice(h.x, h.z), h.z); scene.add(m); return m; }); }
    else if ((d >= 150 || !G.frozen) && built) { built.forEach(m => scene.remove(m)); built = null; }
    if (d < 140 && !boardM) { boardM = boardModel(); boardM.position.set(board.x, C.world.ground(board.x, board.z), board.z); boardM.rotation.y = Math.PI; scene.add(boardM); boardL = C.makeLabel('npc', '<div class="nm"></div>'); }
    else if (d >= 150 && boardM) { scene.remove(boardM); boardM = null; boardL.remove(); boardL = null; }
    if (boardL) { const t = G.frozen ? 'Pêche blanche · records' : 'Pêche blanche · revenez l’hiver!'; const nm = boardL.firstChild; if (nm.textContent !== t) nm.textContent = t; C.placeLabel(boardL, board.x, boardM.position.y + 2.3, board.z, 24); }
  }
  function useNear(P) {
    if (Math.hypot(P.x - board.x, P.z - board.z) < 2) return { txt: 'Lire le tableau des records de pêche', btn: 'RECORDS', fn: showBoard };
    if (!G.frozen) return null;
    for (const h of huts) if (Math.hypot(P.x - h.x, P.z - h.z) < 1.2) return rented() ? { txt: 'Pêcher sur la glace', btn: 'PÊCHE', fn: () => start(h) } : { txt: 'Cabane à pêche barrée : loue-la à Ti-Guy, sur la rive (' + RENT + ' $)', btn: 'CABANE', fn: () => { C.audio.fx('deny'); C.toast('C’est barré. Ti-Guy loue les cabanes sur la rive nord, ' + RENT + ' piasses la journée.'); } };
    return null;
  }
  const fishIn = () => S().inv.filter(i => FISH[i.id]);
  function talk(add, again) {
    const s = S(); let txt;
    if (!G.frozen) txt = 'La glace prend juste l’hiver, mon ami. Reviens quand le fleuve est gelé : mes cabanes vont être là, avec le poêle allumé.';
    else if (rented()) txt = 'Ta cabane t’attend : la rouge, la bleue, n’importe laquelle. Perce ton trou, pis ferre quand ça mord!';
    else { txt = 'Une cabane à pêche pour la journée? ' + RENT + ' piasses, le poêle pis l’appât fournis.'; add('LOUER UNE CABANE · ' + RENT + ' $', () => { if (s.cash < RENT) { C.audio.fx('deny'); C.toast('Pas assez de piasses.'); return; } s.cash -= RENT; s.peche.rent = s.day; C.audio.fx('coin'); C.toast('Cabane louée pour la journée : entre dans n’importe laquelle!'); again(); }, true); }
    const f = fishIn(), v = f.reduce((a, i) => a + ITEMS[i.id].price * (i.n || 1), 0);
    if (f.length) add('VENDRE TES POISSONS · ' + v + ' $', () => { s.inv = s.inv.filter(i => !FISH[i.id]); s.cash += v; C.audio.fx('coin'); C.toast('Ti-Guy t’achète tes poissons : +' + v + ' $'); G.dirtyHot = true; again(); });
    add('TABLEAU DES RECORDS', showBoard);
    return txt;
  }
  function showBoard() {
    const s = S().peche; let h = '<table class="rec"><tr><th>Poisson</th><th>Pris</th><th>Record</th></tr>';
    for (const id in FISH) { const r = s.rec[id]; h += `<tr><td>${r ? ITEMS[id].name : (FISH[id].rare ? '???' : ITEMS[id].name)}</td><td>${r ? r.n : 0}</td><td>${r ? r.best.toFixed(2) + ' kg' : '—'}</td></tr>`; }
    h += '</table><p>' + s.n + ' poisson' + (s.n > 1 ? 's' : '') + ' en tout.' + (s.rec.maski ? ' <b class="gold">Le Gros Maski est au tableau!</b>' : ' Le Gros Maski court encore.') + '</p>';
    C.dlg('Tableau des records — pêche blanche', h, [['FERMER', () => C.closeDialog(), true]]);
  }
  // ---------- mini-jeu ----------
  let el = null, F = null; // F : partie en cours
  function ui() {
    if (el) return; el = document.createElement('div'); el.id = 'peche'; el.className = 'hidden';
    el.innerHTML = '<b id="pkT">Pêche blanche</b><div id="pkMsg"></div><div id="pkBar"><div id="pkZone"></div><div id="pkMark"></div></div><div id="pkProg"><div></div></div><div id="pkBtns"></div><button id="pkTire" class="btn big">TIRE</button><small id="pkHelp"></small>';
    document.body.appendChild(el);
    const t = el.querySelector('#pkTire'), on = e => { e.preventDefault(); if (F) { F.hold = true; F.tap = true; } }, off = () => { if (F) F.hold = false; };
    t.addEventListener('pointerdown', on); t.addEventListener('pointerup', off); t.addEventListener('pointerleave', off); t.addEventListener('pointercancel', off);
  }
  const $ = id => el.querySelector('#' + id);
  function start(h) {
    ui(); const P = G.P; P.x = h.x; P.z = h.z + 0.3; P.vx = P.vz = 0; P.yaw = 0; G.state = 'peche'; C.unlock(); G.camPitch = Math.max(G.camPitch, 0.8); G.camDist = Math.min(Math.max(G.camDist, 4), 5); // vue plongeante, toit enlevé el.classList.remove('hidden');
    $('pkHelp').textContent = C.isTouch ? 'Garde TIRE enfoncé pour tirer, relâche pour donner du fil.' : 'Maintiens ESPACE ou le clic pour tirer, relâche pour donner du fil. Échap : sortir.';
    F = { h, ph: 'perce', t: 0, hold: false, tap: false, hole: null, mesh: null };
    C.audio.fx('dig'); show();
  }
  function hole() { if (F.hole) return; const m = new THREE.Mesh(new THREE.CircleGeometry(0.28, 14), new THREE.MeshBasicMaterial({ color: 0x0a2a40 })); m.rotation.x = -Math.PI / 2; m.position.set(F.h.x, ice(F.h.x, F.h.z) + 0.03, F.h.z - 0.5); scene.add(m);
    const bob = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.08), new THREE.MeshBasicMaterial({ color: 0xe02020 })); bob.position.copy(m.position); bob.position.y += 0.06; scene.add(bob); F.hole = m; F.bob = bob; }
  function pickFish() {
    const night = C.sky.dayF < 0.3, ws = Object.entries(FISH).map(([id, f]) => [id, f.p * (f.rare && night ? 2 : 1)]), tot = ws.reduce((a, w) => a + w[1], 0);
    let r = Math.random() * tot; for (const [id, w] of ws) { if ((r -= w) <= 0) return id; } return 'poulamon';
  }
  function wait() { F.ph = 'attente'; F.t = 0; F.bite = 2 + Math.random() * 4.5; F.fish = pickFish(); }
  function game(dt) {
    if (!F) return;
    const press = F.tap || C.pressed.has('Space') || (C.input.lmb && !F.lmbWas); F.lmbWas = C.input.lmb; F.tap = false;
    const hold = F.hold || C.keys.has('Space') || C.input.lmb;
    F.t += dt;
    if (C.pressed.has('Escape')) { quit(); return; }
    if (F.ph === 'perce') { if (Math.random() < dt * 20) C.burst(F.h.x, ice(F.h.x, F.h.z) + 0.1, F.h.z - 0.5, 0xe8f4ff, 1, 2.5); if (F.t > 1.4) { hole(); wait(); C.audio.fx('splat', 0.4); } }
    else if (F.ph === 'attente') { if (F.bob) F.bob.position.y = F.hole.position.y + 0.06 + Math.sin(F.t * 3) * 0.015;
      if (press) { F.bite += 2; F.t = Math.min(F.t, 0.5); C.toast('Trop vite! T’as fait peur au poisson.'); }
      else if (F.t > F.bite) { F.ph = 'touche'; F.t = 0; C.audio.fx('splat'); } }
    else if (F.ph === 'touche') { if (F.bob) F.bob.position.y = F.hole.position.y - 0.04 + Math.sin(F.t * 30) * 0.03;
      if (press) { const f = FISH[F.fish]; F.ph = 'combat'; F.t = 0; F.m = 0.5; F.v = 0; F.c = 0.5; F.ct = 0.5; F.ctT = 0; F.prog = 0.3; F.snap = 0; F.zs = f.zs; F.spd = f.spd; C.audio.fx('swing'); }
      else if (F.t > 1.1) end(false, 'Il a mordu pis il est reparti avec l’appât…'); }
    else if (F.ph === 'combat') {
      F.v += (hold ? 2.6 : -2.3) * dt; F.v = Math.max(-1.2, Math.min(1.2, F.v)); F.m += F.v * dt;
      if (F.m <= 0) { F.m = 0; F.v = Math.max(0, F.v); } if (F.m >= 1) { F.m = 1; F.v = Math.min(0, F.v); }
      if ((F.ctT -= dt) <= 0) { F.ctT = (0.5 + Math.random()) / F.spd; F.ct = F.zs / 2 + Math.random() * (1 - F.zs); }
      F.c += Math.sign(F.ct - F.c) * Math.min(Math.abs(F.ct - F.c), F.spd * 0.45 * dt);
      const inside = Math.abs(F.m - F.c) < F.zs / 2; F.prog += (inside ? 0.17 : -0.12) * dt; F.inside = inside;
      F.snap = F.m >= 0.995 ? F.snap + dt : Math.max(0, F.snap - dt * 2);
      if (F.bob) F.bob.position.y = F.hole.position.y - 0.05 + Math.sin(F.t * 18) * 0.02 * (inside ? 0.4 : 1);
      if (F.prog >= 1) catchIt(); else if (F.prog <= 0) end(false, 'Le poisson s’est décroché…'); else if (F.snap > 1) end(false, 'CLAC! T’as tiré trop fort : la ligne a cassé.');
    }
    show();
  }
  function catchIt() {
    const s = S(), id = F.fish, f = FISH[id], kg = +(f.w[0] + Math.random() * Math.random() * (f.w[1] - f.w[0])).toFixed(2), r = s.peche.rec[id] || (s.peche.rec[id] = { n: 0, best: 0 }), rec = kg > r.best;
    r.n++; if (rec) r.best = kg; s.peche.n++; C.addItem(id, 1); C.audio.fx(f.rare ? 'level' : 'coin'); C.questEvent('act', 'poisson'); G.dirtyHot = true;
    if (F.bob) C.burst(F.bob.position.x, F.bob.position.y + 0.2, F.bob.position.z, 0x9ae0ff, 12, 3);
    end(true, (f.rare ? '<b class="gold">LE GROS MASKI!</b> ' : 'Belle prise! ') + ITEMS[id].name + ' de <b>' + kg.toFixed(2) + ' kg</b>' + (rec ? ' · <span class="gold">nouveau record!</span>' : ''));
    G.lastFish = { id, kg, rec };
  }
  function end(ok, msg) { F.ph = ok ? 'pris' : 'rate'; F.t = 0; F.msg = msg; F.ok = ok; if (!ok) C.audio.fx('deny'); G.fishLog = (G.fishLog || []).concat(ok ? 'pris:' + F.fish : 'rate'); }
  function again() { if (F) { wait(); show(); } }
  function quit() { if (!F) return; if (F.hole) { scene.remove(F.hole); scene.remove(F.bob); } roof(F.h, true); F = null; el.classList.add('hidden'); G.state = 'play'; C.writeSave(); }
  function show() {
    const ph = F.ph, bar = ph === 'combat';
    $('pkBar').style.display = bar ? '' : 'none'; $('pkProg').style.display = bar ? '' : 'none'; $('pkTire').style.display = ph === 'pris' || ph === 'rate' ? 'none' : '';
    $('pkMsg').innerHTML = ph === 'perce' ? 'Tu perces la glace à la tarière…' : ph === 'attente' ? 'La ligne est à l’eau. Patience… attends que ça morde.' : ph === 'touche' ? '<b class="bite">ÇA MORD! FERRE!</b>' : bar ? (F.inside ? 'Garde-le dans le vert!' : F.m > 0.85 ? '<span class="red">Attention, la ligne force!</span>' : 'Ramène la ligne dans le vert!') : F.msg;
    if (bar) { $('pkZone').style.left = ((F.c - F.zs / 2) * 100) + '%'; $('pkZone').style.width = (F.zs * 100) + '%'; $('pkMark').style.left = (F.m * 100) + '%'; $('pkProg').firstChild.style.width = Math.max(0, Math.min(100, F.prog * 100)) + '%'; $('pkBar').classList.toggle('in', !!F.inside); }
    const b = $('pkBtns'); const want = ph === 'pris' || ph === 'rate' ? 'end' : 'play';
    if (b.dataset.m !== want) { b.dataset.m = want; b.innerHTML = '';
      const mk = (l, fn) => { const e = document.createElement('button'); e.className = 'btn'; e.textContent = l; e.onclick = fn; b.appendChild(e); };
      if (want === 'end') mk('ENCORE', again); mk('SORTIR', quit); }
  }
  return { update, useNear, talk, game, quit, showBoard, huts, shore, board, get F() { return F; }, get built() { return built ? built.length : 0; }, X0 };
}

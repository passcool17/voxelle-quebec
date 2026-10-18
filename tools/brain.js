// Cerveau du bot (exécuté dans la page).
function brain() {
  // pilote dans la page : suit window.__task, combat ce qui s'approche
  const B = { last: null, stuckT: 0, side: 1, strafeT: 0, unstuck: 0, lastPos: null, chk: 0 };
  window.__botInfo = B;
  window.__bot = (api, dt) => {
    const G = api.G, P = G.P, T = window.__task; const I = api.input;
    I.bot = { mx: 0, mz: 0, run: false, jump: false, jumpP: false, atk: false };
    if (G.state !== 'play' || !P || !T) return;
    const S = api.S, st = api.stats();
    if (P.hp < st.hpMax * 0.45 && S.inv.some(i => ['poutine', 'sirop', 'tourtiere'].includes(i.id))) api.pressed.add('KeyR');
    // ennemi à combattre
    let foe = null, fd = 1e9;
    if (T.fight !== false) for (const e of G.enemies) { if (e.dead || e.state === 'hidden' && T.type !== 'fight') continue; const d = Math.hypot(e.x - P.x, e.z - P.z); const lim = T.type === 'fight' ? 40 : (e.state === 'chase' ? 12 : 0); if (d < lim && Math.abs(e.y - P.y) < 6 && d < fd) { fd = d; foe = e; } }
    let tx, tz, want = 0.8;
    if (foe) { tx = foe.x; tz = foe.z; want = (st.W.kind === 'ranged' ? 8 : st.W.range * 0.7 + foe.T.hw); }
    else if (T.type === 'goto' || T.type === 'fight') { const p = T.pts[T.i || 0]; if (!p) { T.done = true; return; } tx = p[0]; tz = p[1]; if (Math.hypot(tx - P.x, tz - P.z) < (p[2] || 1.6)) { T.i = (T.i || 0) + 1; if (T.i >= T.pts.length) { T.done = true; return; } } }
    else if (T.type === 'idle') return;
    const dx = tx - P.x, dz = tz - P.z, d = Math.hypot(dx, dz);
    let yaw = Math.atan2(-dx, -dz);
    if (foe) { G.camYaw += Math.atan2(Math.sin(yaw - G.camYaw), Math.cos(yaw - G.camYaw)) * Math.min(1, dt * 10); G.camPitch = 0.3; I.bot.atk = d < want + 1.2 || (st.W.kind === 'ranged' && d < 20);
      I.bot.mz = d > want ? -1 : d < want - 1.5 ? 0.6 : 0; I.bot.mx = 0.35 * B.side; if (Math.random() < dt * 0.4) B.side *= -1; }
    else { G.camYaw = yaw; G.camPitch = T.pitch ?? 0.3; I.bot.mz = -1; I.bot.run = d > 6 && P.stam > 0.3 && !T.walk; }
    // blocage : sauter, puis contourner, puis se dégager
    B.chk += dt; if (B.chk > 0.8) { B.chk = 0; const moved = B.lastPos ? Math.hypot(P.x - B.lastPos[0], P.z - B.lastPos[1]) : 9; B.lastPos = [P.x, P.z]; if (moved < 0.6 && !foe) B.stuckT += 0.8; else B.stuckT = Math.max(0, B.stuckT - 0.8); }
    if (B.stuckT > 0.7) I.bot.jump = true, I.bot.jumpP = P.ground;
    if (B.stuckT > 2.5) { if (B.strafeT <= 0) { B.strafeT = 1.2; B.side = Math.random() < 0.5 ? 1 : -1; } }
    if (B.strafeT > 0) { B.strafeT -= dt; I.bot.mx = B.side; I.bot.mz = -0.3; }
    if (B.stuckT > 14) { P.y += 3; P.x += Math.sign(dx) * 2; P.z += Math.sign(dz) * 2; B.unstuck++; B.stuckT = 0; }
    if (P.hitWall && P.ground && !foe) I.bot.jumpP = true;
  };
}
module.exports = brain;

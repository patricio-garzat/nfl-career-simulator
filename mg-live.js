/* =====================================================================
   MINI GAMES ON THE LIVE-GAME FIELD
   The RB, WR/TE and QB games are played on the same field as "watch live" (live-game.js: lvFieldSVG, 10 px per yard, both end zones, benches),
   with the same real formations (lvPlan), the same players (lvMakeActors) and the same timeline engine (lvTimeline): the huddle breaks and lines up,
   linemen block, receivers run real routes, defenders drop into zones. Only YOUR player (and whoever chases him) is simulated live.
   Your team always attacks to the right, 1 yard = 10 px, script time = real time.
   ===================================================================== */
const MGL_K = 1.6;                      // size of the HUD and the labels
const MGL_W = 590, MGL_H = 690;         // the camera window (screen units): the whole width of the field (both sidelines and the white border) and about 69 yards of its length
// The field is turned 90°: your team attacks from the bottom of the screen to the top. Everything (formations, routes, speeds) is computed in the live field's own coordinates
// (x towards the end zone, y across); the whole field group is rotated -90° (screen = (y, -x)) and the camera follows the play.

// team colors on the field: never two dark teams — if both are dark, the rival (the visitor) wears its secondary / light color (or white)
const mgLiveCol = ctx => {
  const col = lvColors(ctx.t.id, ctx.o.id), a = col[ctx.t.id], b = col[ctx.o.id];
  if (lum(a) < 0.3 && lum(b) < 0.3) { const sec = TEAM[ctx.o.id].c2; col[ctx.o.id] = lum(sec) >= 0.3 && lvDelta(sec, a) >= 22 ? sec : '#FFFFFF'; }
  return col;
};
// builds the stage: the live field, the line of scrimmage and the actors of the formation. `hud` is the SVG of the score bug (or '').
function mgLiveInit(ctx, play, hud, extra = '', win = null) {
  const col = mgLiveCol(ctx), WW = win ? win.w : MGL_W, WH = win ? win.h : MGL_H;
  ctx.k = MGL_K; ctx.rot = 90;
  const sc = lvScene(play, { myDir: 1, myId: ctx.t.id, oppId: ctx.o.id, col });
  let svg = lvFieldSVG(ctx.t.id, ctx.o.id, false);
  svg = svg.replace('class="lv-field"', `class="lv-field mg-svg mg-live" style="--ar:${(WW / WH).toFixed(4)}"`)
    .replace(/(<svg[^>]*viewBox=")[^"]*(")/, `$1-66 -1270 ${WW} ${WH}$2`)
    .replace(/(<svg[^>]*>)/, '$1<g id="mgRot" transform="rotate(-90)">')
    .replace('<g id="lvActors"></g><g id="lvFx"></g></svg>', `${extra}<g id="lvActors"></g><g id="mgFx"></g></g><g id="mgHudWrap">${hud}</g></svg>`);
  ctx.stage.innerHTML = svg;
  const los = ctx.stage.querySelector('#lvLos'); if (los) { los.setAttribute('x', lvX(sc.los) - 2); los.setAttribute('opacity', 0.9); }
  const F = lvPlan(play), actors = lvMakeActors(sc, play), T = lvTimeline(actors);
  Object.values(actors).forEach(a => { if (a.el && a.el.querySelectorAll) { a.el.querySelectorAll('.lv-pr').forEach(tx => tx.remove()); a.el.querySelectorAll('text').forEach(tx => tx.setAttribute('transform', 'rotate(90)')); } });      // no position letters; your number stays upright
  const L = { col, sc, F, actors, T, svg: ctx.stage.querySelector('svg.mg-live'), hud: ctx.stage.querySelector('#mgHud'), press: ctx.stage.querySelector('#mgPress'), cx: lvX(sc.los) + 150, cy: lvY(0), W: WW, H: WH };
  L.hudW = L.hud ? L.hud.getBBox().width : 0;
  mgLiveCam(ctx, L, L.cx, L.cy, 1);
  return L;
}
// camera: centre of the view (px of the field), smoothed; the score bug stays at the top of the screen
function mgLiveCam(ctx, L, fx, fy, dt) {
  const k = Math.min(1, dt * 3.5), W = L.W, H = L.H;
  L.cx += (fx - L.cx) * k; L.cy = lvY(0);                                                   // the camera only follows the play up and down the field: both sidelines are always in view
  const sx = L.cy, sy = -L.cx;                                                             // field -> screen
  const x = clamp(sx - W / 2, -66, 619 - W), y = clamp(sy - H / 2, -1270, 70 - H);
  L.svg.setAttribute('viewBox', `${x.toFixed(1)} ${y.toFixed(1)} ${W} ${H}`);
  if (L.hud) { const hk = MGL_K; L.hud.setAttribute('transform', `translate(${(x + W / 2 - L.hudW * hk / 2).toFixed(1)} ${(y + 6).toFixed(1)}) scale(${hk})`); }
  if (L.press) { L.press.setAttribute('x', x); L.press.setAttribute('y', y); L.press.setAttribute('width', W); L.press.setAttribute('height', H); }
}
// a play call near the action, kept inside the camera window
function mgLivePop(ctx, L, x, y, txt, cls) { const m = 80; mgPop(ctx, x, clamp(y, L.cy - L.W / 2 + m, L.cy + L.W / 2 - m), txt, cls); }
// renders the timeline and keeps the player's name tag upright
function mgLiveRender(L, t) { L.T.render(t); const tg = L.actors.tag; if (tg) { const x = tg.el.getAttribute('x'), y = tg.el.getAttribute('y'); tg.el.setAttribute('transform', `rotate(90 ${x} ${y})`); } }
// the huddle breaks and lines up, exactly like the live game (the snap is at script second LV_SN)
function mgLivePre(L, defShadow) {
  const { T, sc, F } = L, SN = LV_SN, to = (u, v) => sc.P(u, v), dd = r => r + '_d', defKeys = Object.keys(F.def);
  const shadow = F.mot && F.cov === 'man' ? (F.mot === 'RB' ? 'LB1' : 'LB3') : null;
  Object.keys(F.off).forEach(r => { const q = F.pre[r] || F.off[r]; T.move(r, to(q[0], q[1]), (F.hurry ? 0.05 : 0.55) + rr(0, 0.18), SN - (r === F.mot ? 0.9 : 0.5) - rr(0, 0.08), { prof: 1, pa: 0.2, pd: 0.25 }); });
  defKeys.forEach(r => { const q = F.def[r]; T.move(dd(r), to(q[0], q[1]), 0.2 + rr(0, 0.3), SN - (r === shadow ? 0.9 : 0.18), { prof: 1, pa: 0.3, pd: 0.4 }); });
  if (F.mot) {
    const q = F.off[F.mot], pq = F.pre[F.mot]; T.move(F.mot, to(q[0], q[1]), -0.7 + SN, SN - 0.02, { prof: 1, pa: 0.3, pd: 0.3 });
    if (shadow) T.move(dd(shadow), to(F.def[shadow][0], F.def[shadow][1] + (q[1] - pq[1]) * 0.85), SN - 0.55, SN - 0.02, { prof: 1, pa: 0.3, pd: 0.3 });
  }
}
// where a mini-game actor is facing (radians, 0 = towards the right end zone) and a smooth turn
function mgLiveFace(a, ang, k = 0.35) { let d = ang - a.face; d = Math.atan2(Math.sin(d), Math.cos(d)); a.face += d * k; a.fc.setAttribute('transform', `rotate(${(a.face * 180 / Math.PI).toFixed(0)})${a.isMe ? ' scale(1.25)' : ''}`); }
// the huddle breaks and lines up while the players' noise plays (second 4 of the clip is the snap); resolves with the script time reached
async function mgLivePreSnap(ctx, L, ref) {
  Snd.players('assets/sounds/players-huddle.mp3', mgSndVol('nfl_players_vol3', 75.16), 1, Math.max(0, 4 - LV_SN));
  const f0 = performance.now(); let t = 0;
  await new Promise(r => { const step = () => { if (!ctx.alive()) return r(); t = (performance.now() - f0) / 1000; mgLiveRender(L, t); mgLiveCam(ctx, L, ref.x, ref.y, 0.016); if (t >= LV_SN) return r(); requestAnimationFrame(step); }; step(); });
  return t;
}
function mgLiveMe(L, me, x, y) { mgLiveSet(me, x, y); const tg = L.actors.tag; if (tg) { tg.el.setAttribute('x', x); tg.el.setAttribute('y', y - 21); tg.el.setAttribute('transform', `rotate(90 ${x} ${y - 21})`); } }
const mgLiveSet = (a, x, y) => { a.x = x; a.y = y; a.el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`); };

/* =====================================================================
   RB — RUSH FOR YARDS (live field)
   Snap, handoff, run through the hole the line opens, then dodge the second level. SPACE runs, the arrows turn. 0.1 point per yard, 6 for a touchdown.
   ===================================================================== */
function mgRBLive(ctx, i, st) {
  const lv = MG_LV.indexOf(i), SN = LV_SN, LOS_ABS = 40, play = { kind: 'run', off: 'me', los: LOS_ABS, down: 1, dist: 10, hurry: false };
  const col = mgLiveCol(ctx), tc = col[ctx.t.id] || ctx.t.c1;
  const hud = mgBug([{ w: 34, fill: tc, on: textOn(tc), txt: [[ctx.t.id, 'n']] }, { w: 56, fill: '#0b1220', txt: [['0', 'n', 'mgYdN'], [' YDS', 'l']] }, { w: 62, fill: '#13203a', txt: [['0', 'n', 'mgPtN'], [' PTS', 'l']] }], -58, 600, MGL_K);
  if (ctx.rbPts == null) ctx.rbPts = 0;
  // the hole: one of the gaps of the line (lateral yards from the middle)
  const gapV = [-5, -3, -1, 1, 3, 5][lvWeightedMg([0.1, 0.2, 0.2, 0.2, 0.2, 0.1])];
  const holeSvg = `<g id="mgHole" pointer-events="none"></g>`;
  const L = mgLiveInit(ctx, play, hud, holeSvg), { sc, F, actors, T } = L;
  const to = (u, v) => sc.P(u, v), O = r => F.off[r], D = r => F.def[r], dd = r => r + '_d', defKeys = Object.keys(F.def), sgn = lvSgn;
  const OLS = ['OL1', 'OL2', 'OL3', 'OL4', 'OL5'], DLS = ['DL1', 'DL2', 'DL3', 'DL4'], LBS = ['LB1', 'LB2', 'LB3'];
  const losX = lvX(sc.los), goalX = lvX(100), tdX = goalX + 30, yMin = lvY(-25.8), yMax = lvY(25.8);
  // ---- script (everything that is not you) ----
  mgLivePre(L);
  const pairDL = {}; DLS.forEach(d => { pairDL[d] = OLS.filter(r => r !== 'OL3').sort((a, b) => Math.abs(O(a)[1] - D(d)[1]) - Math.abs(O(b)[1] - D(d)[1]))[0]; });
  const pushV = {}; DLS.forEach(d => { const dv = D(d)[1]; pushV[d] = dv < gapV ? Math.min(0, gapV - 3.4 - dv) : Math.max(0, gapV + 3.4 - dv); });
  const tFree = {}; DLS.forEach(d => { tFree[d] = 2.8 + rr(0, 0.9); });
  const shMap = {}; OLS.forEach(r => { const ds = DLS.filter(d => pairDL[d] === r); shMap[r] = ds.length ? ds.reduce((a, d) => a + pushV[d], 0) / ds.length : 0; });
  OLS.filter(r => r !== 'OL3').forEach(r => T.move(r, to(O(r)[0] + 0.9, O(r)[1] + shMap[r]), SN + 0.05, SN + 0.75, { prof: 1, pa: 0.4, pd: 0.5 }));
  DLS.forEach(d => { const o = pairDL[d]; T.follow(dd(d), o, SN + 0.05, SN + tFree[d], 12.5, ((D(d)[1] + pushV[d]) - (O(o)[1] + shMap[o])) * 10, { wob: 3, fq: 7 + rnd() * 3, bl: 0.4 }); });
  const inside = gapV <= 0 ? 1 : -1, lbf = LBS.slice().sort((a, b) => Math.abs(D(a)[1] - gapV) - Math.abs(D(b)[1] - gapV))[0];   // the linebacker who fills the hole, held by the center
  T.move(dd(lbf), to(2.4, gapV + inside * 1.9), SN + 0.25, SN + 0.95, { prof: 1, pa: 0.3, pd: 0.4 });
  T.follow('OL3', dd(lbf), SN + 0.3, SN + 2.2, -11, 0, { bl: 0.6, wob: 2, fq: 8 });
  const edge = DLS.slice().filter(d => sgn(D(d)[1]) === sgn(O('TE')[1])).sort((a, b) => Math.abs(D(b)[1]) - Math.abs(D(a)[1]))[0] || 'DL4';
  T.follow('TE', dd(edge), SN + 0.25, SN + 2.6, -9, (O('TE')[1] - D(edge)[1]) * 4, { wob: 2.4, bl: 0.6 });
  const rel = {};                                                  // when each defender stops being blocked / starts reacting (seconds after the snap)
  DLS.forEach(d => { rel[dd(d)] = tFree[d]; });
  ['CB1', 'CB2'].forEach((c, k) => { rel[dd(c)] = 2.2 + rr(0, 0.9); T.follow('WR' + (k + 1), dd(c), SN + 0.2, SN + rel[dd(c)], -8, 0, { bl: 0.7, wob: 2, fq: 6 + rnd() * 3 }); });
  const slotT = ['LB3', 'S2'].sort((a, b) => Math.abs(D(a)[1] - O('WR3')[1]) - Math.abs(D(b)[1] - O('WR3')[1]))[0];
  rel[dd(slotT)] = 2.3 + rr(0, 0.6); T.follow('WR3', dd(slotT), SN + 0.3, SN + rel[dd(slotT)], -8, 0, { bl: 0.7, wob: 2, fq: 6 + rnd() * 3 });
  rel[dd(lbf)] = 2.2;
  LBS.filter(r => r !== lbf && r !== slotT).forEach((r, k) => { rel[dd(r)] = 1.0 + k * 0.12; });
  ['S1', 'S2'].filter(r => r !== slotT).forEach((r, k) => { rel[dd(r)] = 1.3 + k * 0.1; });
  const spd = { DL: 54, LB: [66, 72, 78][lv], S: [74, 79, 84][lv], CB: [74, 78, 82][lv] };
  const qb = actors.QB, rbA = actors.RB;
  T.move('ball', T.posAt('QB', SN + 0.22), SN, SN + 0.22, { arc: 3 }); T.follow('ball', 'QB', SN + 0.22, SN + 0.45, 0, 0, { bl: 0 });
  T.run('QB', [to(O('QB')[0] - 2.0, O('QB')[1] + sgn(O('RB')[1] || 1) * 1.4)], SN + 0.5, 4);
  T.move('RB', to(O('RB')[0] + 0.4, O('RB')[1]), SN, SN + 0.45, { prof: 1, pa: 0.4, pd: 0.4 });
  // the hole marker: two chevrons pointing at the end zone
  const hx = losX + 14, hy = lvY(gapV);
  ctx.stage.querySelector('#mgHole').innerHTML = `<g class="mg-landring"><path d="M${hx - 16} ${hy - 20} l16 20 l-16 20 M${hx + 4} ${hy - 20} l16 20 l-16 20" stroke="#6dffbb" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>${mgTag(hx + 4, hy + 46, 'HOLE', '#3fe38c', 10, ctx.k, 90)}`;
  ctx.dbg = { hx, hy, tdX };
  ctx.say('Hit the <b>HOLE</b> · hold <b>SPACE</b> to run, <b>◀ ▶</b> to turn');
  return new Promise(async res => {
    const ydN = ctx.stage.querySelector('#mgYdN'), ptN = ctx.stage.querySelector('#mgPtN'), holeG = ctx.stage.querySelector('#mgHole');
    let t = await mgLivePreSnap(ctx, L, { x: losX + 150, y: lvY(0) }), last = performance.now(), ended = false, raf = 0, inp = null;
    ctx.ctrl.innerHTML = `<div class="mg-btns three" style="grid-template-columns:1fr 1.7fr 1fr">${mgHoldBtn('l', '◀')}<button class="mg-b mg-hold mg-go" data-hold="g" style="--c:#c5ff3a">RUN<small>SPACE</small></button>${mgHoldBtn('r', '▶')}</div>`;
    if (!ctx.alive()) return res(false);
    inp = mgInput(ctx);
    ctx.say('<b>HIKE!</b> Hit the hole!', 'go'); Snd.play('mgSnap', 0.02);
    const me = actors.RB, ball = actors.ball;
    me.dyn = true; { const p = T.posAt('RB', SN + 0.45); me.mx = p.x; me.my = p.y; }
    let best = 0, stun = 0, hits = 0, hitT = -9, hd = 0, mpx = me.mx, mpy = me.my, mpx_prev = me.mx, mpy_prev = me.my, handed = false;
    const chasers = defKeys.map(r => { const id = dd(r), k = r.replace(/\d+$/, ''), a = actors[id]; return { id, a, kind: k, rel: rel[id] == null ? 9 : rel[id], spd: spd[k] || 60, dyn: false, x: a.x, y: a.y, px: a.x, py: a.y }; });
    const cleanup = () => { ended = true; cancelAnimationFrame(raf); inp.dispose(); };
    const finish = async (td, why) => {
      if (ended) return; cleanup(); ctx.ctrl.innerHTML = '';
      const yds = Math.max(0, Math.round(best)), pts = Math.round((yds * 0.1 + (td ? 6 : 0)) * 10) / 10; (ctx.dbg.fin = ctx.dbg.fin || []).push([yds, td, why || '', Math.round(tau0())]); ctx.rbPts = Math.round((ctx.rbPts + pts) * 10) / 10;
      mgLivePop(ctx, L, me.x + 34, me.y, td ? 'TOUCHDOWN!' : yds >= 10 ? 'BIG GAIN!' : yds >= 4 ? `+${yds} YDS` : 'TACKLED!', yds >= 4 || td ? 'good' : 'bad'); mgShake(ctx); Snd.play(td ? 'td' : yds >= 4 ? 'mgPat' : 'mgHit', td ? 0.05 : 0);
      ctx.say(`${yds >= 4 || td ? '✅' : '❌'} ${td ? '<b>TOUCHDOWN!</b> ' : ''}${yds}-yard run · <b>+${mgPts(pts)} pts</b>${td ? ' (6 for the touchdown)' : ''}${why ? `<span class="mg-tip">${why}</span>` : ''}`, yds >= 4 || td ? 'good' : 'bad');
      if (yds >= 12 && !td) ctx.perfects++; if (td) ctx.perfects++;
      Snd.stopPlayers(800);
      res(yds >= 4 || td);
    };
    const tau0 = () => t - SN;
    const frame = now => {
      if (ended) return; if (!ctx.alive()) { cleanup(); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; const tau = t - SN; stun = Math.max(0, stun - dt);
      mgLiveRender(L, t);                                                                         // everything scripted: the line, the blockers, the quarterback, the ball
      // ---- you: the handoff, then free running (arrows turn, SPACE runs) ----
      const turn = inp.k.r - inp.k.l; if (turn) hd += turn * 230 * dt; else if (inp.k.u) hd -= Math.sign(hd) * Math.min(Math.abs(hd), 400 * dt); hd = ((hd + 540) % 360) - 180;
      const rad = hd * Math.PI / 180, vx = Math.cos(rad), vy = Math.sin(rad);
      if (tau < 0.45) { const p = T.posAt('RB', t); mpx = p.x; mpy = p.y; }
      else {
        handed = true;
        if (inp.k.g) { const sp = 84 * (stun > 0 ? 0.4 : 1) * (vx < 0 ? 0.7 : 1); mpx = clamp(mpx + vx * sp * dt, lvX(-8), lvX(108)); mpy = clamp(mpy + vy * sp * dt, yMin, yMax); }
      }
      mgLiveMe(L, me, mpx, mpy); mgLiveFace(me, rad, 0.5); mgLiveCam(ctx, L, mpx + 130, mpy, dt);
      best = Math.max(best, (mpx - losX) / 10);
      if (handed) { ball.el.setAttribute('transform', `translate(${(mpx + 7 * Math.cos(rad) + 5).toFixed(1)} ${(mpy + 7 * Math.sin(rad) + 4).toFixed(1)}) scale(.85)`); }
      // ---- the defense: scripted until blocked / reaction time is over, then pursuit with lead ----
      let hitBy = null, nearest = 999;
      const lead = 0.35 * 6;
      chasers.forEach(c => {
        if (!c.dyn && tau >= c.rel) { const p = T.posAt(c.id, t); c.x = p.x; c.y = p.y; c.dyn = true; c.t0 = tau; }
        if (!c.dyn) return;
        const ramp = c.kind === 'DL' ? 1 : 0.5 + 0.5 * Math.min(1, (tau - c.rel) / 1.4), sp2 = c.spd * ramp * (stun > 0 ? 1.05 : 1);
        const aimX = mpx + (mpx - mpx_prev) * lead, aimY = mpy + (mpy - mpy_prev) * lead;
        const dx = aimX - c.x, dy = aimY - c.y, d = Math.hypot(dx, dy) || 1, st2 = Math.min(d, sp2 * dt); c.x += dx / d * st2; c.y += dy / d * st2;
        const dist = Math.hypot(c.x - mpx, c.y - mpy); nearest = Math.min(nearest, dist);
        if (dist < 15 && tau >= 0.45) hitBy = hitBy && hitBy !== c ? 'multi' : c;
      });
      chasers.forEach((a, k) => { if (!a.dyn) return; for (let j = k + 1; j < chasers.length; j++) { const b = chasers[j]; if (!b.dyn) continue; const dx = b.x - a.x, dy = b.y - a.y, dd2 = Math.hypot(dx, dy); if (dd2 > 0 && dd2 < 16) { const pu = (16 - dd2) * 0.35; a.x -= dx / dd2 * pu; a.y -= dy / dd2 * pu; b.x += dx / dd2 * pu; b.y += dy / dd2 * pu; } } });
      chasers.forEach(c => { if (!c.dyn) return; mgLiveSet(c.a, c.x, c.y); mgLiveFace(c.a, Math.atan2(mpy - c.y, mpx - c.x), 0.3); });
      mpx_prev = mpx; mpy_prev = mpy;
      // ---- tackles: a first hit slows you down, a second one (or two defenders at once) ends the run ----
      if (hitBy === 'multi' || (hitBy && stun > 0 && tau - hitT > 0.12)) return finish(false, hitBy === 'multi' ? 'Two defenders got to you.' : 'You got hit twice — dodge them!');
      if (hitBy && stun <= 0) { stun = 0.6; hitT = tau; hits++; mgLivePop(ctx, L, mpx + 34, mpy, 'HIT!', 'bad'); Snd.play('mgHit', 0); const bx = mpx - hitBy.x, by = mpy - hitBy.y, bl = Math.hypot(bx, by) || 1; hitBy.x -= bx / bl * 12; hitBy.y -= by / bl * 12; }
      const yd = Math.max(0, Math.round(best)); ydN.textContent = yd; ptN.textContent = mgPts(ctx.rbPts + yd * 0.1);
      if (holeG) holeG.setAttribute('opacity', clamp(1 - Math.max(0, tau - 1.3) / 0.8, 0, 1).toFixed(2));
      if (mpx >= tdX) return finish(true);
      if (tau > 22) return finish(false, 'Time ran out.');
      raf = requestAnimationFrame(frame);
    };
    last = performance.now();
    raf = requestAnimationFrame(frame);
  });
}

/* ---------- the pieces of a passing play (routes, coverage, protection) of the live game, for the QB and WR/TE games ---------- */
function mgLivePassScript(L) {
  const { T, sc, F } = L, SN = LV_SN, to = (u, v) => sc.P(u, v), O = r => F.off[r], D = r => F.def[r], dd = r => r + '_d', sgn = lvSgn;
  const OLS = ['OL1', 'OL2', 'OL3', 'OL4', 'OL5'], DLS = ['DL1', 'DL2', 'DL3', 'DL4'], defKeys = Object.keys(F.def), clampV = v => clamp(v, -24.3, 24.3);
  const R = (id, a, t0, spd = 7, o = {}) => T.run(id, a.map(q => to(q[0], q[1])), SN + t0, spd, o.t1 != null ? { ...o, t1: SN + o.t1 } : o);
  const M = (id, q, t0, t1, o = {}) => T.move(id, to(q[0], q[1]), SN + t0, SN + t1, o);
  const FOL = (id, other, t0, t1, du = 0, dv = 0, o = {}) => T.follow(id, other, SN + t0, SN + t1, du * 10, dv * 10, o);
  const cup = { OL1: -1.5, OL2: -2.1, OL3: -2.4, OL4: -2.1, OL5: -1.5 };
  const pairDL = {}; DLS.forEach(d => { pairDL[d] = OLS.slice().sort((a, b) => Math.abs(O(a)[1] - D(d)[1]) - Math.abs(O(b)[1] - D(d)[1]))[0]; });
  const engage = (t0, t1, du, free = [], wob = 3.2) => DLS.forEach(d => { if (free.includes(d)) return; FOL(dd(d), pairDL[d], t0, t1, du, (D(d)[1] - O(pairDL[d])[1]) * 0.45, { wob, fq: 7 + rnd() * 3, bl: 0.4 }); });
  const passPro = (free = [], tEng = 3) => { OLS.forEach(r => M(r, [cup[r], O(r)[1] * 0.93], 0.05, 0.55, { prof: 1, pa: 0.4, pd: 0.5 })); engage(0.05, tEng, 1.25, free); };
  const routePts = (type, st, air) => {
    const v0 = st[1], sg = sgn(v0 || (rnd() < 0.5 ? -1 : 1)), inn = d => clampV(v0 - sg * d), out = d => clampV(v0 + sg * d);
    air = Math.max(air, 1); let r;
    switch (type) {
      case 'go': r = [[air * 0.55, inn(0.2)], [air, inn(1.2)]]; break;
      case 'curl': r = [[air + 2.6, inn(0.1)], [air, inn(1.5)]]; break;
      case 'comeback': r = [[air + 3.2, v0], [air, out(2.6)]]; break;
      case 'out': r = [[air, inn(0.1)], [air, out(3.4)]]; break;
      case 'dig': r = [[air, inn(0.2)], [air, inn(7.5)]]; break;
      case 'slant': r = [[1.6, inn(0.1)], [air, inn(Math.max(3, (air - 1.6) * 0.9))]]; break;
      case 'post': r = [[air * 0.62, inn(0.3)], [air, inn(0.3 + air * 0.38 * 0.85)]]; break;
      case 'corner': r = [[air * 0.62, inn(0.2)], [air, out(air * 0.38 * 0.85)]]; break;
      case 'flat': r = [[Math.max(-3.5, air * 0.3 - 3), out(3)], [Math.max(air, -1), out(8)]]; break;
      case 'wheel': r = [[-2.8, out(4.2)], [air * 0.5, out(8)], [air, out(6.8)]]; break;
      case 'drag': r = [[Math.max(air, 2), inn(3)], [Math.max(air, 2) + 0.3, inn(10)]]; break;
      default: r = [[air * 0.6, inn(0.2)], [air, inn(1.1)]];
    }
    return r;
  };
  const pickRoute = (role, air, v0) => {
    let t;
    if (role === 'RB') t = air >= 9 ? 'wheel' : 'flat';
    else if (role === 'TE') t = air >= 15 ? 'seam' : air >= 8 ? pick(['dig', 'curl', 'drag']) : pick(['drag', 'curl']);
    else if (air <= 4) t = pick(['slant', 'slant', 'curl']); else if (air <= 9) t = pick(['slant', 'curl', 'out', 'curl']); else if (air <= 17) t = pick(['out', 'dig', 'comeback', 'post', 'curl']); else t = pick(['go', 'go', 'post', 'corner']);
    if (Math.abs(v0) > 18 && t === 'out') t = 'comeback';
    return t;
  };
  const sendRoutes = (exclude = []) => ['WR1', 'WR2', 'WR3', 'TE', 'RB'].forEach(r => {
    if (exclude.includes(r) || !O(r)) return;
    const st = O(r);
    if (r === 'RB' && rnd() < 0.5) { R('RB', [[-3.5, st[1] * 0.6 + (st[1] === 0 ? 1.5 : 0)]], 0.05, 6); return; }
    if (r === 'TE' && rnd() < 0.35) { const ed = sgn(st[1]) === sgn(D('DL1')[1]) ? 'DL1' : 'DL4'; FOL('TE', dd(ed), 0.25, 3, -0.9, (st[1] - D(ed)[1]) * 0.4, { wob: 2.4, bl: 0.6 }); return; }
    const cr = F.concept && F.concept.R[r];
    if (cr) { R(r, routePts(cr, st, Math.round(LV_DEPTH[cr] * rr(0.92, 1.1))), 0, 7.4); return; }
    const a2 = Math.round(rr(5, 19)); R(r, routePts(pickRoute(r, a2, st[1]), st, a2), 0, 7.4);
  });
  const ZONES = {
    c3: { CB1: [14, 17], CB2: [14, 17], S1: [16, 0], S2: [7.5, 12], LB1: [8.5, 6], LB2: [9.5, 0], LB3: [6.5, 13] },
    c2: { CB1: [6.5, 18], CB2: [6.5, 18], S1: [15, 8.5], S2: [15, 8.5], LB1: [9, 6.5], LB2: [11, 0], LB3: [6.5, 13.5] },
    c4: { CB1: [12.5, 14.5], CB2: [12.5, 14.5], S1: [11.5, 8.5], S2: [11.5, 8.5], LB1: [7.5, 5], LB2: [8.5, 0], LB3: [6.5, 10.5] },
  };
  const sd = r => sgn(D(r)[1] || 1);
  const zoneDrop = (cov, excl = []) => { const Z = ZONES[cov] || ZONES.c3; defKeys.filter(r => !DLS.includes(r) && !excl.includes(r)).forEach(r => { const z = Z[r]; R(dd(r), [[z[0], sd(r) * z[1]]], 0.05, 5.8, { pa: 0.3 }); }); };
  const manOf = { WR1: 'CB1', WR2: 'CB2', WR3: 'LB3', TE: 'LB2', RB: 'LB1' };
  return { R, M, FOL, to, O, D, dd, sgn, OLS, DLS, defKeys, pairDL, passPro, routePts, pickRoute, sendRoutes, zoneDrop, manOf, cup };
}

/* =====================================================================
   WR / TE — CATCH IT (live field)
   A three-play drive from the same series: the real formation breaks the huddle, the others run their routes against the real coverage, the quarterback
   throws to a ring you can see on the grass. Run there before the ball (and the defender) arrives. SPACE runs, the arrows turn.
   ===================================================================== */
function mgCatchLive(ctx, i, st) {
  const lv = MG_LV.indexOf(i), SN = LV_SN, te = ctx.P.pos === 'TE', meRole = te ? 'TE' : 'WR1', Tf = [2.5, 2.3, 2.1][lv], VR = 95, VD = [0, 82, 100][lv], R_CATCH = 24;
  if (st.A == null) { st.A = Math.round(rr(56, 66)); st.down = 1; st.toGo = 10; }
  let note = '';
  if (lv === 2 && 100 - st.A > 12) { st.A = 100 - randInt(8, 12); st.down = 1; st.toGo = 10; note = `Pass interference — ball at the ${100 - st.A}`; }
  st.toGo = Math.min(10, st.toGo);
  const A = st.A, gl = 100 - A, td = lv === 2, down = st.down, toGo = Math.min(st.toGo, gl);
  const depth = td ? gl + rr(3, 5.5) : clamp(Math.round(rr(8 + lv * 1.5, 14 + lv * 2)), 6, Math.max(6, gl - 6));
  const play = { kind: 'catch', off: 'me', los: A, down, dist: toGo, yards: Math.round(depth), hurry: false };
  const col = mgLiveCol(ctx), tc = col[ctx.t.id] || ctx.t.c1;
  const ord = n => ['', '1ST', '2ND', '3RD', '4TH'][n] || n + 'TH', spot = a => (a > 50 ? `${ctx.o.id} ${Math.round(100 - a)}` : a === 50 ? 'MIDFIELD' : `${ctx.t.id} ${Math.round(a)}`);
  const hud = mgBug([{ w: 66, fill: tc, on: textOn(tc), txt: [[`${ord(down)} & ${gl <= 10 ? 'GOAL' : toGo}`, 'n']] }, { w: 62, fill: '#0b1220', txt: [[spot(A), 'n']] }], -58, 600, MGL_K);
  const L = mgLiveInit(ctx, play, hud, '<g id="mgRing" pointer-events="none"></g>'), { sc, F, actors, T } = L;
  const fdEl = ctx.stage.querySelector('#lvFd'); if (fdEl && A + toGo < 100) { fdEl.setAttribute('x', lvX(A + toGo) - 2); fdEl.setAttribute('opacity', 0.85); }
  const PS = mgLivePassScript(L), { R, FOL, O, D, dd, to } = PS, losX = lvX(sc.los), yMin = lvY(-25.8), yMax = lvY(25.8), defKeys = PS.defKeys;
  mgLivePre(L);
  // ---- the scripted play: quarterback drop, protection, the other routes, coverage ----
  const qb0 = O('QB'), dropTo = [-6.7 + rr(-0.3, 0.3), qb0[1] + rr(-0.4, 0.4)], dropT = 1.0, tRel = 0.95 + lv * 0.0;
  R('QB', [dropTo], 0, 5, { t1: dropT, pa: 0.25, pd: 0.35 });
  T.move('ball', T.posAt('QB', SN + 0.12), SN, SN + 0.12); T.follow('ball', 'QB', SN + 0.12, SN + tRel, 0, 0, { bl: 0 });
  PS.passPro([], 8); PS.sendRoutes([meRole]);
  const prim = te ? 'LB2' : 'CB1', myV = O(meRole)[1], inside = -PS.sgn(myV || 1) * 0.35;
  if (F.cov === 'man') {
    Object.keys(PS.manOf).forEach(r => { if (r === meRole || !O(r)) return; FOL(dd(PS.manOf[r]), r, 0.05, 8, 1.15, -PS.sgn(O(r)[1] || 1) * 0.35, { lag: 0.2, bl: 1.0, wob: 2, fq: 6 + rnd() * 3 }); });
    PS.zoneDrop('c3', Object.values(PS.manOf).concat([prim]));
  } else PS.zoneDrop(F.cov, [prim]);
  FOL(dd(prim), meRole, 0.05, tRel, 1.15, inside, { lag: 0.2, bl: 1.2, wob: 2, fq: 7 });
  // ---- the ring: where the ball will land (always reachable) ----
  const me0 = T.posAt(meRole, SN), v0 = O(meRole)[1], sgV = PS.sgn(v0 || 1);
  let Lx = losX + depth * 10, Ly = lvY(clamp(v0 - sgV * rr(3, 11), -22, 22));
  for (let k = 0; k < 60 && Math.hypot(Lx - me0.x, Ly - me0.y) > VR * Tf * 0.72; k++) { Lx = Lx + (me0.x - Lx) * 0.1; Ly = Ly + (me0.y - Ly) * 0.14; }
  for (let k = 0; k < 40 && Math.hypot(Lx - me0.x, Ly - me0.y) < 70; k++) Ly = lvY(clamp(v0 - sgV * rr(3, 12), -22, 22));
  const adj = lv >= 1 ? { ta: 0.42, dx: rr(-28, 28), dy: td ? rr(-8, 8) : rr(-45, 45) } : null;     // the wind nudges the ball in the air
  const L2 = adj ? { x: Lx + adj.dx, y: clamp(Ly + adj.dy, yMin, yMax) } : { x: Lx, y: Ly };
  const route = te ? ['SEAM', 'DRAG', 'CORNER', 'OVER', 'POST'][i] : ['GO', 'POST', 'FADE', 'OUT', 'DEEP'][i];
  ctx.say(note ? `🚩 ${note}` : td ? 'Last play — <b>catch it in the end zone</b>' : 'Get to the <b>ring</b> before the ball does');
  ctx.dbg = { me: meRole };
  return new Promise(async res => {
    const ring = ctx.stage.querySelector('#mgRing');
    let t = await mgLivePreSnap(ctx, L, { x: losX + 150, y: lvY(0) }), last = performance.now(), ended = false, raf = 0, inp = null;
    ctx.ctrl.innerHTML = `<div class="mg-timer"><i></i></div><div class="mg-btns three" style="grid-template-columns:1fr 1.7fr 1fr">${mgHoldBtn('l', '◀')}<button class="mg-b mg-hold mg-go" data-hold="g" style="--c:#c5ff3a">RUN<small>SPACE</small></button>${mgHoldBtn('r', '▶')}</div>`;
    if (!ctx.alive()) return res(false);
    inp = mgInput(ctx);
    ctx.say(`<b>HIKE!</b> <b>${route}</b> · run to the ring`, 'go'); Snd.play('mgSnap', 0.02);
    const me = actors[meRole], ball = actors.ball, p0 = T.posAt(meRole, SN);
    let mpx = p0.x, mpy = p0.y, hd = 0, released = false, Q0 = null, P1 = null, cur = { x: Lx, y: Ly }, adjusted = false;
    const defA = actors[dd(prim)], D1 = { x: 0, y: 0, on: false };
    const bar = ctx.ctrl.querySelector('.mg-timer i');
    const cleanup = () => { ended = true; cancelAnimationFrame(raf); inp.dispose(); };
    const drawRing = () => {
      ring.innerHTML = `<path d="M${Q0.x.toFixed(1)} ${Q0.y.toFixed(1)} L${(adjusted ? P1 : cur).x.toFixed(1)} ${(adjusted ? P1 : cur).y.toFixed(1)}" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-dasharray="6 8" stroke-linecap="round" fill="none"/><path d="M${P1 ? P1.x.toFixed(1) : Q0.x.toFixed(1)} ${P1 ? P1.y.toFixed(1) : Q0.y.toFixed(1)} L${cur.x.toFixed(1)} ${cur.y.toFixed(1)}" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-dasharray="6 8" stroke-linecap="round" fill="none"/>
        <g transform="translate(${cur.x.toFixed(1)} ${cur.y.toFixed(1)})"><circle r="${R_CATCH}" fill="${td ? '#ffd23d' : '#c5ff3a'}" fill-opacity=".2" stroke="${td ? '#ffd23d' : '#c5ff3a'}" stroke-width="3" class="mg-landring"/><circle r="8" fill="none" stroke="#fff" stroke-opacity=".8" stroke-dasharray="2 3"/>${td ? mgTag(0, -R_CATCH - 16, 'TD', '#ffd23d', 10, ctx.k, 90) : ''}</g>`;
    };
    const finish = async () => {
      ended = true; cancelAnimationFrame(raf); inp.dispose(); ctx.ctrl.innerHTML = '';
      const dR = Math.hypot(mpx - cur.x, mpy - cur.y), dD = D1.on ? Math.hypot(D1.x - cur.x, D1.y - cur.y) : 999, hasD = D1.on;
      const ok = dR <= R_CATCH && (!hasD || dR <= dD + 8 || dD > 28), perfect = ok && dR <= 9;
      ball.el.setAttribute('transform', `translate(${(ok ? mpx : cur.x).toFixed(1)} ${(ok ? mpy : cur.y).toFixed(1)}) scale(1)`);
      Snd.stopPlayers(800);
      if (ok) {
        const gain = Math.max(1, Math.round((cur.x - losX) / 10)), na = Math.min(100, A + gain), scored = td && na >= 100, first = !scored && gain >= toGo;
        if (perfect) ctx.perfects++;
        st.A = na; if (first) { st.down = 1; st.toGo = Math.min(10, 100 - na); } else { st.down = down + 1; st.toGo = Math.max(1, toGo - gain); }
        mgLivePop(ctx, L, mpx + 34, mpy, scored ? 'TOUCHDOWN!' : perfect ? 'PERFECT!' : 'CAUGHT!', 'good'); Snd.play(scored ? 'td' : 'mgPat', scored ? 0.05 : 0); mgShake(ctx);
        const spotNow = a => (a > 50 ? `${ctx.o.id} ${Math.round(100 - a)}` : a === 50 ? 'MIDFIELD' : `${ctx.t.id} ${Math.round(a)}`);
        ctx.say(scored ? `🏈 <b>TOUCHDOWN!</b> ${mgYardsStr(gain)} in the end zone` : `✅ ${perfect ? '✨ Dead center! ' : 'Caught it! '}${mgYardsStr(gain)}${first ? ' · <b>1ST DOWN</b>' : ''} · ball on the ${spotNow(na)}`, 'good'); res(true);
      } else {
        st.down = down + 1;
        const broke = hasD && dD < dR && dD <= 28; mgLivePop(ctx, L, cur.x + 34, cur.y, broke ? 'BROKEN UP' : 'TOO FAR', 'bad'); Snd.play(broke ? 'mgHit' : 'mgPat', 0); if (broke) mgShake(ctx);
        ctx.say(`❌ ${broke ? 'The defender got there first' : `Missed it by ${Math.round(dR / 10)} yds`}<span class="mg-tip">Watch the ring — it can move in the air.</span>`, 'bad'); res(false);
      }
    };
    const frame = now => {
      if (ended) return; if (!ctx.alive()) { cleanup(); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; const tau = t - SN;
      mgLiveRender(L, t);
      // ---- you: arrows turn, SPACE runs ----
      const turn = inp.k.r - inp.k.l; if (turn) hd += turn * 280 * dt; else if (inp.k.u) hd -= Math.sign(hd) * Math.min(Math.abs(hd), 420 * dt); hd = ((hd + 540) % 360) - 180;
      const rad = hd * Math.PI / 180;
      if (inp.k.g) { mpx = clamp(mpx + Math.cos(rad) * VR * dt, lvX(-8), lvX(108)); mpy = clamp(mpy + Math.sin(rad) * VR * dt, yMin, yMax); }
      mgLiveMe(L, me, mpx, mpy); mgLiveFace(me, rad, 0.5); mgLiveCam(ctx, L, mpx + 120, mpy, dt);
      // ---- the throw: the ball leaves the quarterback and the ring shows where it will land ----
      if (!released && tau >= tRel) {
        released = true; const q = T.posAt('QB', SN + tRel); Q0 = { x: q.x, y: q.y }; Snd.play('mgThrow', 0); ctx.say('<b>BALL IS UP!</b> Run to the ring', 'go');
        if (bar) { bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth; bar.style.transition = `width ${Tf}s linear`; bar.style.width = '0%'; }
        if (VD) { const p = T.posAt(dd(prim), SN + tRel); D1.x = p.x; D1.y = p.y; D1.on = true; }
        drawRing();
      }
      if (released) {
        const u = Math.min(1, (tau - tRel) / Tf);
        if (adj && !adjusted && u >= adj.ta) { adjusted = true; P1 = { x: Q0.x + (cur.x - Q0.x) * adj.ta, y: Q0.y + (cur.y - Q0.y) * adj.ta }; cur = { ...L2 }; mgLivePop(ctx, L, cur.x + 34, cur.y, '💨 WIND!', 'bad'); Snd.play('mgSwish', 0); drawRing(); }
        const bp = adjusted ? { x: P1.x + (cur.x - P1.x) * ((u - adj.ta) / (1 - adj.ta)), y: P1.y + (cur.y - P1.y) * ((u - adj.ta) / (1 - adj.ta)) } : { x: Q0.x + (cur.x - Q0.x) * u, y: Q0.y + (cur.y - Q0.y) * u };
        const h = Math.sin(Math.PI * u) * 34; ball.el.setAttribute('transform', `translate(${(bp.x + h).toFixed(1)} ${bp.y.toFixed(1)}) scale(${(1 + h / 60).toFixed(2)}) rotate(${(u * 720).toFixed(0)})`);
        // the defender races to the same spot
        if (D1.on) { const dx = cur.x - D1.x, dy = cur.y - D1.y, dm = Math.hypot(dx, dy); if (dm > 14) { D1.x += dx / dm * VD * dt; D1.y += dy / dm * VD * dt; } mgLiveSet(defA, D1.x, D1.y); mgLiveFace(defA, Math.atan2(dy, dx), 0.3); }
        if (u >= 1) return finish();
      }
      raf = requestAnimationFrame(frame);
    };
    last = performance.now();
    raf = requestAnimationFrame(frame);
  });
}

/* =====================================================================
   QB — POCKET PRESENCE (live field)
   The real pass-protection scheme of the live game: the line sets a cup, the rushers fight their blockers and some of them win. You steer the quarterback inside the
   pocket (arrows) to stay away from the rush and press SPACE when the timing bar is inside the green to fire the pass to your receiver (the TARGET tag).
   ===================================================================== */
function mgQBLive(ctx, i, st) {
  const lv = MG_LV.indexOf(i), SN = LV_SN, nR = [2, 3, 4][lv], tMax = [6.4, 5.8, 5.2][lv], vq = 92, vr = [50, 58, 66][lv], zone = [0.28, 0.22, 0.17][lv], sp = [0.85, 1.0, 1.15][lv];
  const pT = rr(0.34, 0.68), LOS_ABS = randInt(28, 44), play = { kind: 'qbPass', off: 'me', los: LOS_ABS, down: 1, dist: 10, yards: 14, hurry: false };
  const col = mgLiveCol(ctx), tc = col[ctx.t.id] || ctx.t.c1, spot = a => (a > 50 ? `${ctx.o.id} ${Math.round(100 - a)}` : a === 50 ? 'MIDFIELD' : `${ctx.t.id} ${Math.round(a)}`);
  const hud = mgBug([{ w: 66, fill: tc, on: textOn(tc), txt: [['1ST & 10', 'n']] }, { w: 62, fill: '#0b1220', txt: [[spot(LOS_ABS), 'n']] }], -58, 600, MGL_K)
    + '<defs><radialGradient id="mgPrG" cx="50%" cy="60%" r="65%"><stop offset=".55" stop-color="#ff2d2d" stop-opacity="0"/><stop offset="1" stop-color="#ff2d2d" stop-opacity=".8"/></radialGradient></defs><rect id="mgPress" x="-1500" y="-1500" width="4200" height="3200" fill="url(#mgPrG)" opacity="0" pointer-events="none"/>';
  const L = mgLiveInit(ctx, play, hud, '<g id="mgTgt" pointer-events="none"></g>'), { sc, F, actors, T } = L;
  const PS = mgLivePassScript(L), { R, FOL, O, D, dd, to } = PS, losX = lvX(sc.los), yMin = lvY(-25.8), yMax = lvY(25.8);
  mgLivePre(L);
  // ---- scripted play: the target's route (we know where he will be), the other routes, coverage, protection ----
  const cr = (F.concept && F.concept.R.WR1) || 'curl', air = Math.round((LV_DEPTH[cr] || 10) * rr(0.95, 1.05)), rp = PS.routePts(cr, O('WR1'), air);
  R('WR1', rp, 0, 7.4); PS.sendRoutes(['WR1']);
  if (F.cov === 'man') { Object.keys(PS.manOf).forEach(r => { if (!O(r)) return; FOL(dd(PS.manOf[r]), r, 0.05, 9, 1.15, -PS.sgn(O(r)[1] || 1) * 0.35, { lag: 0.2, bl: 1.0, wob: 2, fq: 6 + rnd() * 3 }); }); PS.zoneDrop('c3', Object.values(PS.manOf)); }
  else { PS.zoneDrop(F.cov, ['CB1']); FOL(dd('CB1'), 'WR1', 0.05, 9, 1.4, -PS.sgn(O('WR1')[1] || 1) * 0.35, { lag: 0.25, bl: 1.2, wob: 2 }); }
  const rushIds = ['DL3', 'DL2', 'DL4', 'DL1'].slice(0, nR);
  PS.passPro(rushIds, 9);
  const rush = rushIds.map((d, j) => ({ d, id: dd(d), a: actors[dd(d)], tf: [1.9, 1.55, 1.25][lv] + j * [0.75, 0.6, 0.45][lv] + rr(0, 0.35), mv: pick([-1, 1, 0]), free: false, speed: 0, chip: 0, x: 0, y: 0 }));
  rush.forEach(r => { const o = PS.pairDL[r.d]; FOL(r.id, o, 0.05, r.tf, 1.25, (D(r.d)[1] - O(o)[1]) * 0.45, { wob: 3.2, fq: 7 + rnd() * 3, bl: 0.4 }); r.ol = o; });
  const qb0 = O('QB'), dropU = qb0[0] < -3 ? qb0[0] - 1.2 : -6.7;
  T.move('ball', T.posAt('QB', SN + 0.12), SN, SN + 0.12);
  ctx.say('Move in the pocket · press <b>SPACE</b> when the bar is in the green');
  ctx.dbg = { pT, zone };
  return new Promise(async res => {
    const press = ctx.stage.querySelector('#mgPress'), tgt = ctx.stage.querySelector('#mgTgt'), qbA = actors.QB, ball = actors.ball, wr = actors.WR1;
    let t = await mgLivePreSnap(ctx, L, { x: losX + 150, y: lvY(0) }), last = performance.now(), ended = false, raf = 0, inp = null, minD = 999, Q = { x: 0, y: 0, vx: 0, vy: 0 };
    ctx.ctrl.innerHTML = `<div class="mg-timer"><i></i></div><div class="mg-power"><div class="mg-py" style="left:${(pT - 0.2) * 100}%;width:40%"></div><div class="mg-pz" style="left:${(pT - zone / 2) * 100}%;width:${zone * 100}%"></div><i id="mgPI"></i></div><div class="mg-btns five">${mgHoldBtn('l', '◀')}${mgHoldBtn('u', '▲')}${mgHoldBtn('d', '▼')}${mgHoldBtn('r', '▶')}<button class="mg-b big" id="mgThrow" style="--c:#c5ff3a">THROW <small>SPACE</small></button></div>`;
    if (!ctx.alive()) return res(false);
    inp = mgInput(ctx);
    const pi = ctx.ctrl.querySelector('#mgPI'), bar = ctx.ctrl.querySelector('.mg-timer i');
    if (bar) { bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth; bar.style.transition = `width ${tMax}s linear`; bar.style.width = '0%'; }
    ctx.say('<b>HIKE!</b> Stay alive · <b>SPACE</b> in the green', 'go'); Snd.play('mgSnap', 0.02);
    { const p = T.posAt('QB', SN); Q.x = p.x; Q.y = p.y; }
    const qMin = losX - 120, qMax = losX - 18, q0y = Q.y, dropX = sc.P(dropU, 0).x;
    tgt.innerHTML = `<g class="mg-landring"><circle r="22" fill="none" stroke="#ffd23d" stroke-width="3" stroke-dasharray="6 6"/></g>${mgTag(0, -36, 'TARGET', '#ffd23d', 9.5, ctx.k, 90)}`;
    const cleanup = () => { ended = true; cancelAnimationFrame(raf); inp.dispose(); document.removeEventListener('keydown', onKey); };
    const marker = () => { const ph = ((t - SN) * sp) % 2; return ph < 1 ? ph : 2 - ph; };
    const sack = async why => {
      if (ended) return; cleanup(); ctx.ctrl.innerHTML = ''; Snd.stopPlayers(800);
      mgLivePop(ctx, L, Q.x + 34, Q.y, 'SACK!', 'bad'); Snd.play('mgHit', 0); mgShake(ctx);
      ctx.say(`❌ SACKED! ${why}<span class="mg-tip">Throw before the rush gets to you — move to buy time.</span>`, 'bad'); res(false);
    };
    const fly = (x0, y0, x1, y1, ms, arc) => new Promise(r => { const f0 = performance.now(), step = () => { if (!ctx.alive()) return r(); const k = Math.min(1, (performance.now() - f0) / ms), x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k, hh = Math.sin(Math.PI * k) * arc; ball.el.setAttribute('transform', `translate(${(x + hh).toFixed(1)} ${y.toFixed(1)}) scale(${(1 + Math.sin(Math.PI * k) * 0.5).toFixed(2)}) rotate(${(k * 540).toFixed(0)})`); if (k < 1) requestAnimationFrame(step); else r(); }; step(); });
    const doThrow = async () => {
      if (ended) return; const v = marker(), perr = Math.abs(v - pT), close = minD; cleanup(); ctx.ctrl.innerHTML = ''; Snd.stopPlayers(800);
      const inGreen = perr <= zone / 2, inYellow = perr <= 0.2, perfect = inGreen && perr <= zone * 0.2 && close > 55;
      const tw = T.posAt('WR1', t + 0.55), wx = tw.x, wy = tw.y; Snd.play('mgThrow', 0);
      mgLiveFace(qbA, Math.atan2(wy - Q.y, wx - Q.x), 1);
      await fly(Q.x, Q.y, wx, wy, 560, 40); if (!ctx.alive()) return res(false);
      if (inGreen) {
        const yds = Math.max(2, Math.round((wx - losX) / 10 + rr(0, 3)));
        mgLivePop(ctx, L, wx + 34, wy, perfect ? 'PERFECT!' : mgYardsStr(yds), 'good'); Snd.play('mgPat', 0); if (yds >= 12) Snd.play('td', 0.12);
        if (perfect) ctx.perfects++;
        ctx.say(`✅ ${perfect ? '✨ Perfect throw! ' : 'Complete! '}${mgYardsStr(yds)}`, 'good'); res(true);
      } else if (inYellow) {
        ball.el.setAttribute('transform', `translate(${wx + (v < pT ? -26 : 26)} ${wy + 18}) rotate(30)`);
        mgLivePop(ctx, L, wx + 34, wy, 'INCOMPLETE', 'bad'); Snd.play('mgPat', 0);
        ctx.say(`❌ Off target — ${v < pT ? 'too early' : 'too late'}<span class="mg-tip">Press SPACE when the marker is inside the green.</span>`, 'bad'); res(false);
      } else {
        mgLivePop(ctx, L, wx + 34, wy, 'INTERCEPTED!', 'bad'); Snd.play('mgHit', 0); mgShake(ctx);
        ctx.say(`❌ Intercepted — the timing was way off<span class="mg-tip">Wait for the green zone.</span>`, 'bad'); res(false);
      }
    };
    const onKey = e => { if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); if (!e.repeat) doThrow(); } };
    document.addEventListener('keydown', onKey);
    ctx.ov.querySelector('#mgThrow').addEventListener('pointerdown', ev => { ev.preventDefault(); doThrow(); });
    const frame = now => {
      if (ended) return; if (!ctx.alive()) { cleanup(); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; const tau = t - SN;
      mgLiveRender(L, t);
      // ---- you: the drop-back, then steer the quarterback inside the pocket ----
      let vx = inp.k.r - inp.k.l, vy = inp.k.d - inp.k.u; const m = Math.hypot(vx, vy), ox = Q.x, oy = Q.y;
      if (m > 0) { Q.x = clamp(Q.x + vx / m * vq * dt, qMin, qMax); Q.y = clamp(Q.y + vy / m * vq * dt, Math.max(yMin, q0y - 80), Math.min(yMax, q0y + 80)); }
      else if (tau < 1.4 && Q.x > dropX) Q.x = Math.max(dropX, Q.x - 55 * dt);
      Q.vx = (Q.x - ox) / dt; Q.vy = (Q.y - oy) / dt;
      mgLiveMe(L, qbA, Q.x, Q.y); { const wp = T.posAt('WR1', t); mgLiveFace(qbA, Math.atan2(wp.y - Q.y, wp.x - Q.x), 0.25); }
      ball.el.setAttribute('transform', `translate(${(Q.x + 7).toFixed(1)} ${(Q.y + 2).toFixed(1)}) scale(.85)`);
      // ---- the rush: blocked until they win, then a swim / spin / bull rush and a curved chase that leads the quarterback ----
      minD = 999;
      rush.forEach(r => {
        if (!r.free && tau >= r.tf) { const p = T.posAt(r.id, SN + r.tf); r.x = p.x; r.y = p.y; r.free = true; r.t0 = tau; mgLivePop(ctx, L, r.x + 34, r.y, r.mv === 0 ? 'BULL RUSH!' : r.mv < 0 ? 'SWIM!' : 'SPIN!', 'bad'); }
        if (!r.free) return;
        const age = tau - r.t0, side = r.y < lvY(0) ? -1 : 1;
        if (age < 0.3 && r.mv !== 0) { r.y += side * (r.mv === 1 ? 70 : 52) * dt; r.x += 14 * dt; }
        r.speed = Math.min(vr * (r.chip > 0 ? 0.45 : 1), r.speed + vr * 2.2 * dt);
        const ax = Q.x + Q.vx * 0.3, ay = Q.y + Q.vy * 0.3, dx = ax - r.x, dy = ay - r.y, d = Math.hypot(dx, dy) || 1, s2 = Math.min(d, r.speed * dt); r.x += dx / d * s2; r.y += dy / d * s2;
        mgLiveSet(r.a, r.x, r.y); mgLiveFace(r.a, Math.atan2(dy, dx), 0.3);
        minD = Math.min(minD, Math.hypot(r.x - Q.x, r.y - Q.y));
      });
      // the linemen beaten by a rusher are walked back and to the side
      rush.forEach(r => { if (!r.free) return; const oa = actors[r.ol], p = T.posAt(r.ol, t), b = Math.min(1, (tau - r.t0) / 0.35), sg = r.y < p.y ? 1 : -1; mgLiveSet(oa, p.x - 6 * b, p.y + sg * 10 * b); });
      const v = marker(); pi.style.left = (v * 100) + '%';
      { const wp = T.posAt('WR1', t); tgt.setAttribute('transform', `translate(${wp.x.toFixed(1)} ${wp.y.toFixed(1)})`); }
      press.setAttribute('opacity', clamp(1 - minD / 95, 0, 0.7).toFixed(2));
      mgLiveCam(ctx, L, Q.x + 190, (Q.y + lvY(0)) / 2, dt);
      if (minD < 17) return sack('A rusher got to you.'); if (tau >= tMax) return sack('You held it too long.');
      raf = requestAnimationFrame(frame);
    };
    last = performance.now();
    raf = requestAnimationFrame(frame);
  });
}

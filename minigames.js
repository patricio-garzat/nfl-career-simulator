/* =====================================================================
   MINI GAMES — every 3-5 games of the regular season a short mini game pops up, depending on your position:
     QB  → READ THE DEFENSE   (see the defense, throw to the open man: WR, TE or RB)
     RB  → FIND THE HOLE      (the defense shifts: run to the weak side)
     WR/TE → CATCH IT         (tap at the exact moment the ball fills your hands)
     K   → KICK IT            (aim against the wind, stop the power bar in the green)
   Other positions have none. 5 attempts, 3 or more = a good grade. The grade gives (or takes) a performance bonus for the next games.
   State lives in the season object (season.mg, season.buffs, season.mgLog), so it saves with the career.
   ===================================================================== */
const MG_KIND = { QB: 'qb', RB: 'rb', WR: 'catch', TE: 'catch', K: 'kick' };
const MG_GRADES = [
  { n: 'DISASTER', perf: -0.06, left: 2 }, { n: 'BAD DAY', perf: -0.06, left: 2 }, { n: 'ROUGH', perf: -0.03, left: 2 },
  { n: 'GOOD', perf: 0.04, left: 3 }, { n: 'GREAT', perf: 0.07, left: 3 }, { n: 'PERFECT', perf: 0.10, left: 3 },
];

function mgEnsure(se) { se.buffs = se.buffs || []; se.mgLog = se.mgLog || []; se.train = se.train || { phys: 0, ment: 0 }; se.injExtra = se.injExtra || 0; if (se.mgIn == null) se.mgIn = randInt(3, 5); if (se.mgSince == null) se.mgSince = 0; return se; }
function mgInitSeason(season) { season.buffs = []; season.mg = null; season.mgLog = []; season.mgIn = randInt(3, 5); season.mgSince = 0; season.train = { phys: 0, ment: 0 }; season.injExtra = 0; }
// what the active bonuses do to the game engine
function mgMods(se) {
  let perf = 1; (se.buffs || []).forEach(b => { if (b.left > 0) perf *= 1 + (b.perf || 0); });
  return { perf, inj: 1, team: 0 };
}
// after every game: age the bonuses and, every 3-5 games, offer a mini game (only for positions that have one)
function mgAfterGame(se, game, notes) {
  mgEnsure(se);
  se.buffs.forEach(b => { b.left--; }); se.buffs = se.buffs.filter(b => b.left > 0);
  if (se.mg) { se.mg.age = (se.mg.age || 0) + 1; if (se.mg.age >= 3) { se.mg = null; se.mgSince = 0; se.mgIn = randInt(3, 5); } }   // ignored for too long: it expires
  const kind = MG_KIND[S.player.pos];
  if (!kind || game.k !== 'REG' || se.status !== 'regular' || se.mg) return;
  se.mgSince++;
  const left = se.schedule.length - se.games.length;
  if (se.mgSince >= se.mgIn && left >= 2 && !se.injury) { se.mg = { kind, wk: game.wk, age: 0 }; notes.push('🎮 MINI GAME — a training challenge is ready.'); }
}
const MG_META = {
  qb: P => ({ icon: '🏈', title: 'READ THE DEFENSE', how: 'Spot the defense, then throw to the open man.', legend: [['🔴', 'Blitz', 'RB'], ['🛡️', 'Two deep', 'TE'], ['↔️', 'Soft corners', 'WR']] }),
  rb: P => ({ icon: '🏃', title: 'FIND THE HOLE', how: 'The defense shifts. Run to the weak side.', legend: [['👀', 'Fewer defenders', 'run there']] }),
  catch: P => ({ icon: '🙌', title: P.pos === 'TE' ? 'CATCH IT · SEAM ROUTE' : 'CATCH IT · GO ROUTE', how: 'Tap when the ball fills your hands.', legend: [['⭕', 'Ball = ring', 'tap']] }),
  kick: P => ({ icon: '🥅', title: 'KICK IT', how: 'Aim against the wind, then stop the power bar in the green.', legend: [['💨', 'Wind pushes', 'aim into it']] }),
};
const mgBannerHTML = se => (se.mg && MG_META[se.mg.kind]) ? `<div class="banner dec-banner"><span>🎮 <b>MINI GAME</b> — ${MG_META[se.mg.kind](S.player).title}</span><button class="btn btn-primary btn-sm" data-act="playMini">PLAY</button></div>` : '';

/* ---------- shared bits ---------- */
const mgBall = (x, y, s = 1, rot = 0, id = '') => `<g ${id ? `id="${id}"` : ''} transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><ellipse rx="11" ry="7" fill="#8a4b22" stroke="#3d1c08" stroke-width="1.3"/><path d="M-5 0H5M-2.5 -2.2v4.4M0 -2.2v4.4M2.5 -2.2v4.4" stroke="#fff" stroke-width="1.1" fill="none" stroke-linecap="round"/></g>`;
const mgStroke = c => (lum(c) > 0.7 ? '#10151d' : '#ffffff');
const mgDot = (x, y, c1, r = 7, label = '', c2 = '#fff', cls = '', extra = '') => `<g class="${cls}" ${extra} style="transform:translate(${x}px,${y}px)"><circle r="${r}" fill="${c1}" stroke="${mgStroke(c1)}" stroke-width="1.6"/>${label ? `<text y="3.2" text-anchor="middle" font-size="${r > 8 ? 9 : 7}" font-weight="800" fill="${textOn(c1)}" font-family="Barlow Condensed, sans-serif">${label}</text>` : ''}</g>`;
const mgShuffleNoRepeat = (keys, n) => {          // every key at least once, never the same one twice in a row
  const out = shuffle(keys.slice());
  while (out.length < n) { let k; do { k = pick(keys); } while (k === out[out.length - 1]); out.push(k); }
  return out;
};
const mgYardsStr = y => `${y >= 0 ? '+' : '−'}${Math.abs(y)} YDS`;

/* ---------- overlay + runner ---------- */
let MGX = null;
function mgOpen() {
  const se = curSeason(); if (!se || !se.mg || !MG_META[se.mg.kind]) return;
  const P = S.player, kind = se.mg.kind, t = TEAM[S.teamId], meta = MG_META[kind](P);
  let opp; try { opp = nextGameInfo(se).opp; } catch (e) { opp = null; } opp = opp || TEAM_LIST.find(x => x.id !== S.teamId);
  const ov = document.createElement('div'); ov.className = 'mg-overlay'; ov.style.cssText = themeVars(S.teamId);
  ov.innerHTML = `<div class="mg-wrap">
    <div class="mg-top"><span class="mg-tag">🎮 MINI GAME</span><button class="mini mg-skip" data-mg="skip">SKIP</button></div>
    <div class="mg-board"><img src="${logoUrl(t.id)}" alt=""><div class="mg-bt"><b>${esc(meta.title)}</b><span>${esc(P.name)} · ${P.pos} · #${playerNumber()}</span></div><img src="${logoUrl(opp.id)}" alt=""></div>
    <div class="mg-pips">${[0, 1, 2, 3, 4].map(i => `<i data-p="${i}"></i>`).join('')}<em id="mgScore">0/5</em></div>
    <div class="mg-stage" id="mgStage"></div><div class="mg-msg" id="mgMsg"></div><div class="mg-ctrl" id="mgCtrl"></div></div>`;
  document.body.appendChild(ov);
  const stage = ov.querySelector('#mgStage'), msg = ov.querySelector('#mgMsg'), ctrl = ov.querySelector('#mgCtrl');
  const ctx = { ov, stage, msg, ctrl, t, o: opp, P, kind, alive: () => ov.isConnected, say: (h, cls = '') => { msg.className = 'mg-msg ' + cls; msg.innerHTML = h; }, results: [] };
  MGX = ctx;
  stage.innerHTML = `<div class="mg-intro"><div class="mg-bigicon">${meta.icon}</div><h2>${esc(meta.title)}</h2><p>${esc(meta.how)}</p>
    <div class="mg-legend">${meta.legend.map(([i, a, b]) => `<span>${i} ${a} <b>→ ${b}</b></span>`).join('')}</div><p class="mg-sub">5 tries · get 3 or more for a bonus</p></div>`;
  ctrl.innerHTML = `<button class="btn btn-primary btn-xl" data-mg="start">START</button>`;
  Snd.play('whistle', 0.05);
}
async function mgRun(ctx) {
  const fn = { qb: mgQB, rb: mgRB, catch: mgCatch, kick: mgKick }[ctx.kind], st = { plan: null };
  ctx.ctrl.innerHTML = ''; ctx.say('');
  for (let i = 0; i < 5; i++) {
    if (!ctx.alive()) return;
    ctx.ov.querySelectorAll('.mg-pips i').forEach((p, k) => p.classList.toggle('cur', k === i));
    const ok = await fn(ctx, i, st); if (!ctx.alive()) return;
    ctx.results.push(ok);
    ctx.ov.querySelector(`.mg-pips i[data-p="${i}"]`).className = ok ? 'ok' : 'bad';
    ctx.ov.querySelector('#mgScore').textContent = `${ctx.results.filter(Boolean).length}/5`;
    Snd.play(ok ? 'chime' : 'down', 0.05);
    await sleep(i < 4 ? 1500 : 900);
  }
  mgFinish(ctx);
}
function mgFinish(ctx) {
  const se = curSeason(), sc = ctx.results.filter(Boolean).length, g = MG_GRADES[sc], good = sc >= 3;
  const fx = `${g.perf > 0 ? '+' : '−'}${Math.abs(Math.round(g.perf * 100))}% performance · next ${g.left} games`;
  ctx.stage.innerHTML = `<div class="mg-res ${good ? 'good' : 'bad'}"><div class="mg-grade">${g.n}</div><div class="mg-big">${sc}<small>/5</small></div>
    <div class="mg-stars">${[0, 1, 2, 3, 4].map(i => `<span class="${i < sc ? 'on' : ''}">★</span>`).join('')}</div>
    <div class="mg-bonus ${good ? 'good' : 'bad'}">${good ? '⚡' : '⚠️'} ${fx}</div></div>`;
  ctx.say(''); ctx.ctrl.innerHTML = `<button class="btn btn-primary btn-xl" data-mg="done">CONTINUE</button>`;
  se.buffs.push({ left: g.left, perf: g.perf, label: 'Mini game ' + g.n.toLowerCase() });
  if (sc >= 4) se.train.ment = Math.min(1.5, (se.train.ment || 0) + 0.25);
  se.mgLog.push({ kind: ctx.kind, score: sc, wk: se.mg ? se.mg.wk : 0 }); se.mg = null; se.mgSince = 0; se.mgIn = randInt(3, 5);
  saveGame();
  Snd.play(sc >= 4 ? 'bigFanfare' : good ? 'win' : 'lose', 0.1);
  if (sc >= 4) burst(ctx.stage, sc === 5 ? 70 : 40);
}
function mgSkip() { const se = curSeason(); if (se) { se.mg = null; se.mgSince = 0; se.mgIn = randInt(3, 5); saveGame(); } const o = document.querySelector('.mg-overlay'); if (o) o.remove(); MGX = null; renderDashboard(); }
function mgDone() { const o = document.querySelector('.mg-overlay'); if (o) o.remove(); MGX = null; renderDashboard(); }
// one delegated listener for the overlay buttons
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-mg]'); if (!b || !MGX) return;
  const k = b.dataset.mg;
  if (k === 'skip') mgSkip(); else if (k === 'done') mgDone(); else if (k === 'start') mgRun(MGX);
});
// wait for a button/tap choice or a timeout; the timer bar is drawn in the control area
function mgChoice(ctx, secs, onPick) {
  return new Promise(res => {
    const bar = ctx.ctrl.querySelector('.mg-timer i'); let done = false;
    const finish = v => { if (done) return; done = true; clearTimeout(to); res(v); };
    if (bar) { bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth; bar.style.transition = `width ${secs}s linear`; bar.style.width = '0%'; }
    const to = setTimeout(() => finish(null), secs * 1000);
    ctx.pick = v => finish(v);
  });
}
const mgPickBtn = (ctx, sel) => { ctx.ov.querySelectorAll(sel).forEach(el => el.addEventListener('pointerdown', ev => { ev.preventDefault(); if (ctx.pick) ctx.pick(el.dataset.pick); }, { once: true })); };

/* =====================================================================
   QB — READ THE DEFENSE
   ===================================================================== */
const QB_DEF = {
  blitz: { name: 'BLITZ', ans: 'RB', tip: 'Blitz! Dump it to the RB before the rush arrives.' },
  cover2: { name: 'COVER 2', ans: 'TE', tip: 'Two safeties deep — the seam is open for the TE.' },
  soft: { name: 'SOFT CORNERS', ans: 'WR', tip: 'Corners are backing off — the WR is open outside.' },
};
const QB_CALLS = ['SMASH RIGHT', 'TRIPS BUNCH', 'FLOOD LEFT', 'MESH', 'Y-CROSS', 'FOUR VERTS', 'STICK', 'CURL-FLAT', 'SLANT', 'DRAGON', 'LEVELS', 'HITCH-GO'];
const QB_TGT = { WR: { x: 26, y: 132, c: '#ffd23d' }, TE: { x: 224, y: 138, c: '#35e0ff' }, RB: { x: 132, y: 178, c: '#c5ff3a' } };
function mgQB(ctx, i, st) {
  if (!st.plan) st.plan = mgShuffleNoRepeat(Object.keys(QB_DEF), 5);
  const key = st.plan[i], d = QB_DEF[key], T1 = ctx.t.c1, O1 = ctx.o.c1, dk = ctx.o.c1;
  const base = { DL: [[140, 118], [158, 118], [182, 118], [200, 118]], LB: [[120, 100], [170, 96], [222, 100]], CB: [[26, 108], [300, 108]], S: [[112, 52], [228, 52]] };
  const fin = {
    blitz: { DL: [[140, 122], [158, 122], [182, 122], [200, 122]], LB: [[128, 126], [170, 124], [214, 126]], CB: [[26, 114], [300, 114]], S: [[110, 96], [228, 92]] },
    cover2: { DL: [[140, 118], [158, 118], [182, 118], [200, 118]], LB: [[118, 92], [170, 88], [224, 92]], CB: [[26, 102], [300, 102]], S: [[92, 26], [248, 26]] },
    soft: { DL: [[140, 118], [158, 118], [182, 118], [200, 118]], LB: [[128, 96], [170, 92], [214, 96]], CB: [[26, 68], [300, 68]], S: [[118, 30], [222, 30]] },
  }[key];
  const defs = []; let n = 0;
  Object.keys(base).forEach(g => base[g].forEach((p, k) => { defs.push(mgDot(p[0], p[1], O1, 6.5, '', '#fff', 'mg-d', `data-f="${fin[g][k][0]},${fin[g][k][1]}"`)); n++; }));
  const route = (a, c) => `<path d="${a}" stroke="${c}" stroke-width="2.4" stroke-dasharray="6 5" fill="none" marker-end="url(#mgArr${c.slice(1)})" opacity=".9"/>`;
  const marker = c => `<marker id="mgArr${c.slice(1)}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`;
  const call = pick(QB_CALLS);
  const ol = [140, 155, 170, 185, 200].map(x => mgDot(x, 140, T1, 6.2)).join('');
  const tgts = Object.entries(QB_TGT).map(([k, p]) => `<g class="mg-tg" data-pick="${k}" style="cursor:pointer"><circle cx="${p.x}" cy="${p.y}" r="20" fill="transparent"/>${mgDot(p.x, p.y, T1, 9, k === 'RB' ? '' : '', '#fff')}<text x="${p.x}" y="${p.y + 21}" text-anchor="middle" font-size="9" font-weight="800" fill="${p.c}" font-family="Barlow Condensed, sans-serif" letter-spacing=".08em">${k}</text></g>`).join('');
  ctx.stage.innerHTML = `<svg class="mg-svg" viewBox="0 0 340 250"><defs>${marker('#ffd23d')}${marker('#35e0ff')}${marker('#c5ff3a')}<linearGradient id="mgGr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c6a3c"/><stop offset="1" stop-color="#14522d"/></linearGradient></defs>
    <rect width="340" height="250" rx="14" fill="url(#mgGr)"/>${[30, 80, 130, 180, 230].map(y => `<line x1="0" x2="340" y1="${y}" y2="${y}" stroke="#fff" stroke-opacity=".12" stroke-width="2"/>`).join('')}
    <line x1="0" x2="340" y1="130" y2="130" stroke="#4aa8ff" stroke-width="2.5" stroke-opacity=".8"/>
    <text x="170" y="200" text-anchor="middle" font-size="46" font-weight="800" fill="#fff" fill-opacity=".05" font-family="Barlow Condensed, sans-serif">${esc(ctx.t.nick.toUpperCase())}</text>
    <g id="mgRoutes">${route('M26 132 L26 58 L44 22', '#ffd23d')}${route('M224 138 L224 96 L208 34', '#35e0ff')}${route('M132 178 Q100 178 68 152', '#c5ff3a')}</g>
    <g id="mgZones" opacity="0"><rect x="6" y="8" width="160" height="62" rx="8" fill="${O1}" fill-opacity=".28" stroke="${O1}" stroke-dasharray="4 4"/><rect x="174" y="8" width="160" height="62" rx="8" fill="${O1}" fill-opacity=".28" stroke="${O1}" stroke-dasharray="4 4"/></g>
    <g id="mgBlz" opacity="0" stroke="#ff4d4d" stroke-width="3" fill="none" stroke-linecap="round"><path d="M128 124 L158 154"/><path d="M170 122 L170 150"/><path d="M214 124 L186 154"/><path d="M110 96 L150 150"/></g>
    <g id="mgCush" opacity="0" stroke="#ffd23d" stroke-width="2" stroke-dasharray="3 4" fill="none"><path d="M26 76 L26 124"/><path d="M300 76 L300 124"/></g>
    ${defs.join('')}${ol}${mgDot(170, 162, T1, 8.5, '', '#fff')}${tgts}
    <g id="mgBallG">${mgBall(170, 162, 0.9, 0, 'mgBallEl')}</g><g id="mgFx"></g></svg>
    <div class="mg-call">PLAY: <b>${call}</b> · ${i + 1} of 5</div>`;
  ctx.ctrl.innerHTML = `<div class="mg-timer"><i></i></div><div class="mg-btns three">${['WR', 'TE', 'RB'].map(k => `<button class="mg-b" data-pick="${k}" style="--c:${QB_TGT[k].c}">${k}</button>`).join('')}</div>`;
  ctx.say('Defense is lining up…');
  return (async () => {
    await sleep(350); if (!ctx.alive()) return false;
    ctx.stage.querySelectorAll('.mg-d').forEach(g => { const [fx, fy] = g.dataset.f.split(',').map(Number); g.style.transform = `translate(${fx}px,${fy}px)`; });
    ctx.stage.querySelector(key === 'blitz' ? '#mgBlz' : key === 'cover2' ? '#mgZones' : '#mgCush').style.opacity = 1;
    await sleep(900); if (!ctx.alive()) return false;
    ctx.say('<b>HIKE!</b> Who is open?', 'go'); Snd.play('tick', 0.02);
    mgPickBtn(ctx, '.mg-btns .mg-b, .mg-tg');
    const pickd = await mgChoice(ctx, 5);
    if (!ctx.alive()) return false;
    ctx.ctrl.innerHTML = '';
    const fx = ctx.stage.querySelector('#mgFx');
    const flash = (x, y, txt, cls) => { fx.innerHTML = `<text x="${x}" y="${y}" text-anchor="middle" class="mg-pop ${cls}">${txt}</text>`; };
    const ballTo = (x, y) => { const b = ctx.stage.querySelector('#mgBallG'); b.style.transition = 'transform .5s cubic-bezier(.3,.7,.4,1)'; b.style.transform = `translate(${x - 170}px,${y - 162}px)`; };
    let ok = pickd === d.ans, txt = '', cls = ok ? 'good' : 'bad';
    if (!pickd) { txt = 'SACKED! Too slow'; flash(170, 160, 'SACK!', 'bad'); }
    else {
      const tg = QB_TGT[pickd]; ballTo(tg.x, tg.y - 6); await sleep(520);
      if (ok) { const y = pickd === 'WR' ? randInt(18, 32) : pickd === 'TE' ? randInt(12, 20) : randInt(7, 13); txt = `COMPLETE! ${mgYardsStr(y)}`; flash(tg.x, tg.y - 16, mgYardsStr(y), 'good'); if (y >= 20) Snd.play('td', 0.05); }
      else if (key === 'blitz') { txt = 'SACKED! The blitz got there'; flash(170, 150, 'SACK!', 'bad'); }
      else if (key === 'cover2') { txt = pickd === 'WR' ? 'INTERCEPTED by the safety!' : 'Only +2 — they sat on the short route'; flash(tg.x, tg.y - 16, pickd === 'WR' ? 'INT!' : '+2', 'bad'); }
      else { txt = pickd === 'TE' ? 'Swatted — incomplete' : 'Tackled for +1'; flash(tg.x, tg.y - 16, pickd === 'TE' ? 'INC' : '+1', 'bad'); }
    }
    ctx.say(`${ok ? '✅' : '❌'} ${txt}<span class="mg-tip">${d.name} → ${d.tip}</span>`, ok ? 'good' : 'bad');
    return ok;
  })();
}

/* =====================================================================
   RB — FIND THE HOLE
   ===================================================================== */
function mgRB(ctx, i, st) {
  if (!st.sides) { st.sides = []; for (let k = 0; k < 5; k++) { let s; do { s = rnd() < 0.5 ? 'L' : 'R'; } while (k >= 2 && st.sides[k - 1] === s && st.sides[k - 2] === s); st.sides.push(s); } }
  const heavy = st.sides[i], weak = heavy === 'L' ? 'R' : 'L', disguise = i >= 3, T1 = ctx.t.c1, O1 = ctx.o.c1;
  const heavyPos = [[112, 118], [134, 118], [156, 118], [178, 118], [120, 98], [144, 96], [236, 98], [252, 70]];     // 6 on the left, 1 + a safety on the right
  const mirror = arr => arr.map(([x, y]) => [340 - x, y]);
  const fin = heavy === 'L' ? heavyPos : mirror(heavyPos), init = disguise ? (heavy === 'L' ? mirror(heavyPos) : heavyPos) : fin;
  const defs = fin.map((p, k) => mgDot(init[k][0], init[k][1], O1, 7, '', '#fff', 'mg-d', `data-f="${p[0]},${p[1]}"`)).join('');
  const ol = [128, 149, 170, 191, 212].map(x => mgDot(x, 138, T1, 6.8)).join('');
  ctx.stage.innerHTML = `<svg class="mg-svg" viewBox="0 0 340 250"><defs><linearGradient id="mgGr2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c6a3c"/><stop offset="1" stop-color="#14522d"/></linearGradient></defs>
    <rect width="340" height="250" rx="14" fill="url(#mgGr2)"/>${[30, 80, 130, 180, 230].map(y => `<line x1="0" x2="340" y1="${y}" y2="${y}" stroke="#fff" stroke-opacity=".12" stroke-width="2"/>`).join('')}
    <line x1="0" x2="340" y1="130" y2="130" stroke="#4aa8ff" stroke-width="2.5" stroke-opacity=".8"/>
    <text x="170" y="60" text-anchor="middle" font-size="46" font-weight="800" fill="#fff" fill-opacity=".05" font-family="Barlow Condensed, sans-serif">${esc(ctx.o.nick.toUpperCase())}</text>
    <g id="mgHole" opacity="0"><path d="${weak === 'L' ? 'M96 150 L96 40' : 'M244 150 L244 40'}" stroke="#c5ff3a" stroke-width="22" stroke-opacity=".18" stroke-linecap="round"/></g>
    ${defs}${ol}${mgDot(170, 158, T1, 8, '')}<g id="mgRunner" style="transform:translate(170px,198px);transition:transform .45s ease-in"><circle r="10" fill="${T1}" stroke="#fff" stroke-width="2"/><text y="3.8" text-anchor="middle" font-size="11" font-weight="800" fill="${textOn(T1)}" font-family="Barlow Condensed, sans-serif">${playerNumber()}</text></g>
    <g id="mgFx"></g></svg><div class="mg-call">RUN PLAY · ${i + 1} of 5</div>`;
  ctx.ctrl.innerHTML = `<div class="mg-timer"><i></i></div><div class="mg-btns two"><button class="mg-b" data-pick="L" style="--c:#ffd23d">◀ RUN LEFT</button><button class="mg-b" data-pick="R" style="--c:#35e0ff">RUN RIGHT ▶</button></div>`;
  ctx.say('Defense is lining up…');
  return (async () => {
    await sleep(500); if (!ctx.alive()) return false;
    ctx.say('<b>HIKE!</b> Find the weak side', 'go'); Snd.play('tick', 0.02);
    mgPickBtn(ctx, '.mg-btns .mg-b');
    if (disguise) setTimeout(() => { if (!ctx.alive()) return; ctx.stage.querySelectorAll('.mg-d').forEach(g => { const [fx, fy] = g.dataset.f.split(',').map(Number); g.style.transition = 'transform .7s ease-in-out'; g.style.transform = `translate(${fx}px,${fy}px)`; }); ctx.say('<b>⚠ THEY SHIFT!</b> Read it again', 'go'); }, 1100);
    const pickd = await mgChoice(ctx, 3.6);
    if (!ctx.alive()) return false;
    ctx.ctrl.innerHTML = '';
    const run = ctx.stage.querySelector('#mgRunner'), fx = ctx.stage.querySelector('#mgFx');
    ctx.stage.querySelectorAll('.mg-d').forEach(g => { const [fx2, fy2] = g.dataset.f.split(',').map(Number); g.style.transition = 'none'; g.style.transform = `translate(${fx2}px,${fy2}px)`; });
    const ok = pickd === weak;
    const lane = pickd === 'L' ? 96 : 244;
    if (!pickd) { run.style.transition = 'transform .4s ease-in'; run.style.transform = 'translate(170px,150px)'; await sleep(450); fx.innerHTML = `<text x="170" y="120" text-anchor="middle" class="mg-pop bad">STUFFED!</text>`; ctx.say('❌ You hesitated and got stuffed<span class="mg-tip">Pick a side before time runs out.</span>', 'bad'); return false; }
    run.style.transition = 'transform .35s ease-in'; run.style.transform = `translate(${lane}px,150px)`; await sleep(380);
    if (ok) {
      ctx.stage.querySelector('#mgHole').style.opacity = 1;
      run.style.transition = 'transform .6s ease-out'; run.style.transform = `translate(${lane}px,36px)`; await sleep(620);
      const y = randInt(8, 18); fx.innerHTML = `<text x="${lane}" y="30" text-anchor="middle" class="mg-pop good">${mgYardsStr(y)}</text>`; if (y >= 15) Snd.play('td', 0.05);
      ctx.say(`✅ Through the hole! ${mgYardsStr(y)}<span class="mg-tip">You ran at the side with fewer defenders.</span>`, 'good'); return true;
    }
    ctx.stage.querySelectorAll('.mg-d').forEach((g, k) => { if (k < 6) { g.style.transition = 'transform .35s ease-in'; g.style.transform = `translate(${lane + (k % 3) * 8 - 8}px,${130 - (k % 2) * 10}px)`; } });
    await sleep(380); const y = randInt(-2, 1); fx.innerHTML = `<text x="${lane}" y="112" text-anchor="middle" class="mg-pop bad">${mgYardsStr(y)}</text>`;
    ctx.say(`❌ Stuffed! ${mgYardsStr(y)}<span class="mg-tip">The defense was stacked on that side — run away from the crowd.</span>`, 'bad'); return false;
  })();
}

/* =====================================================================
   WR / TE — CATCH IT
   ===================================================================== */
function mgCatch(ctx, i, st) {
  const P = ctx.P, T1 = ctx.t.c1, T2 = ctx.t.c2, O1 = ctx.o.c1, te = P.pos === 'TE';
  const D = [1.9, 1.75, 1.6, 1.5, 1.4][i], off = (rnd() < 0.5 ? -1 : 1) * rr(10, 46), x1 = 170 + off, y1 = 196, R = 40, contested = i >= 2;
  const zone = contested ? [0.8, 1.08] : [0.74, 1.12];
  ctx.stage.innerHTML = `<svg class="mg-svg tall" viewBox="0 0 340 300"><defs><linearGradient id="mgSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1330"/><stop offset=".45" stop-color="#26437a"/><stop offset="1" stop-color="#14522d"/></linearGradient></defs>
    <rect width="340" height="300" rx="14" fill="url(#mgSky)"/>${Array.from({ length: 16 }, (_, k) => `<circle cx="${18 + k * 21}" cy="${14 + (k % 3) * 7}" r="2" fill="#ffe9a8" opacity=".75"/>`).join('')}
    <polygon points="118,64 222,64 372,300 -32,300" fill="#1c6a3c"/>${[84, 108, 138, 176, 224].map(y => `<line x1="${170 - (y - 64) * 0.5 - 52 * (1 - (y - 64) / 236) * 0}" x2="${170 + (y - 64) * 0.5}" y1="${y}" y2="${y}" stroke="#fff" stroke-opacity=".3" stroke-width="${1 + (y - 64) / 90}"/>`).join('')}
    <text x="170" y="150" text-anchor="middle" font-size="60" font-weight="800" fill="#fff" fill-opacity=".06" font-family="Barlow Condensed, sans-serif">${esc(ctx.t.nick.toUpperCase())}</text>
    ${mgDot(170, 62, T1, 7, '', '#fff')}
    <g id="mgDef" style="transform:translate(${x1 < 170 ? 380 : -40}px,${y1 + 24}px)"><circle r="17" fill="${O1}" stroke="${mgStroke(O1)}" stroke-width="2"/><text y="4" text-anchor="middle" font-size="11" font-weight="800" fill="${textOn(O1)}" font-family="Barlow Condensed, sans-serif">${contested ? (te ? 'LB' : 'CB') : ''}</text></g>
    <g id="mgRing"><circle cx="${x1}" cy="${y1}" r="${R}" fill="${T2}" fill-opacity=".12" stroke="#fff" stroke-width="3"/><circle cx="${x1}" cy="${y1}" r="${R * 0.96}" fill="none" stroke="#c5ff3a" stroke-width="2" stroke-dasharray="4 5" opacity=".9"/></g>
    <path d="M30 300 Q40 262 98 252 L242 252 Q300 262 310 300 Z" fill="${T1}" stroke="${T2}" stroke-width="3"/><text x="170" y="292" text-anchor="middle" font-size="40" font-weight="800" fill="${textOn(T1)}" font-family="Barlow Condensed, sans-serif" stroke="${T2}" stroke-width="1.5" paint-order="stroke">${playerNumber()}</text>
    <g id="mgBallG">${mgBall(170, 70, 0.2, 0, 'mgBallEl')}</g><g id="mgFx"></g></svg><div class="mg-call">${te ? 'SEAM ROUTE — LB closing in' : 'GO ROUTE — corner on your hip'} · ${i + 1} of 5</div>`;
  ctx.ctrl.innerHTML = `<div class="mg-btns one"><button class="mg-b big" id="mgCatchBtn" style="--c:#c5ff3a">🙌 CATCH!</button></div>`;
  ctx.say('Get ready…');
  return new Promise(async res => {
    await sleep(700); if (!ctx.alive()) return res(false);
    ctx.say('<b>BALL IS UP!</b> Tap when it fills the ring', 'go'); Snd.play('whoosh', 0.02);
    const ball = ctx.stage.querySelector('#mgBallEl'), def = ctx.stage.querySelector('#mgDef'), t0 = performance.now(); let tapped = false, raf = 0;
    const sAt = t => 0.1 + 1.1 * Math.pow(t, 2.2);
    const place = t => { const tt = Math.min(t, 1.3), s = sAt(tt), x = 170 + (x1 - 170) * Math.min(tt, 1) + (tt > 1 ? (x1 - 170) * (tt - 1) * 0.6 : 0), y = 70 + (y1 - 70) * Math.pow(Math.min(tt, 1), 1.5) + (tt > 1 ? (tt - 1) * 160 : 0); ball.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(tt * 720).toFixed(0)}) scale(${(s * R / 11 * 0.95).toFixed(3)})`); return { x, y, s }; };
    const finish = async (ok, why, t) => {
      cancelAnimationFrame(raf); tapped = true; ctx.ctrl.innerHTML = ''; ctx.stage.removeEventListener('pointerdown', onTap);
      const fx = ctx.stage.querySelector('#mgFx'), ring = ctx.stage.querySelector('#mgRing');
      if (ok) {
        ball.setAttribute('transform', `translate(${x1} ${y1}) rotate(20) scale(${(R / 11 * 0.95).toFixed(3)})`); ring.querySelector('circle').setAttribute('stroke', '#c5ff3a'); ring.querySelector('circle').setAttribute('stroke-width', 6);
        const perfect = Math.abs(sAt(t) - 1) < 0.07, y = te ? randInt(10, 24) : randInt(18, 44);
        fx.innerHTML = `<text x="${x1}" y="${y1 - 56}" text-anchor="middle" class="mg-pop good">${perfect ? 'PERFECT!' : 'CAUGHT!'}</text>`; if (y >= 25) Snd.play('td', 0.05);
        ctx.say(`✅ ${perfect ? 'PERFECT CATCH!' : 'Caught it!'} ${mgYardsStr(y)}`, 'good'); res(true);
      } else {
        const p = place(t), dir = p.x < 170 ? -1 : 1;
        fx.innerHTML = `<text x="${x1}" y="${y1 - 56}" text-anchor="middle" class="mg-pop bad">${why === 'early' ? 'TOO EARLY' : 'TOO LATE'}</text>`;
        ball.setAttribute('transform', `translate(${(p.x + dir * 60).toFixed(0)} ${(p.y + 70).toFixed(0)}) rotate(260) scale(${(p.s * R / 11 * 0.95).toFixed(3)})`);
        ctx.say(`❌ ${why === 'early' ? 'Too early — the ball bounced off your hands' : 'Too late — it went right through'}<span class="mg-tip">Tap when the ball is as big as the ring.</span>`, 'bad'); res(false);
      }
    };
    const tick = () => {
      if (!ctx.alive()) return; const t = (performance.now() - t0) / 1000 / D; place(t);
      if (contested) { const k = Math.min(1, t); def.style.transform = `translate(${(x1 < 170 ? 380 : -40) + (x1 - (x1 < 170 ? 380 : -40) + (x1 < 170 ? 36 : -36)) * k}px,${y1 + 24 - 6 * k}px)`; }
      if (t >= 1.3) return finish(false, 'late', 1.3);
      raf = requestAnimationFrame(tick);
    };
    const onTap = ev => { if (tapped || !ctx.alive()) return; ev.preventDefault(); const t = (performance.now() - t0) / 1000 / D, s = sAt(t); if (s < zone[0]) finish(false, 'early', t); else if (s <= zone[1]) finish(true, '', t); else finish(false, 'late', t); };
    ctx.ov.querySelector('#mgCatchBtn').addEventListener('pointerdown', onTap, { once: true }); ctx.stage.addEventListener('pointerdown', onTap);
    raf = requestAnimationFrame(tick);
  });
}

/* =====================================================================
   K — KICK IT
   ===================================================================== */
function mgKick(ctx, i, st) {
  if (!st.k) st.k = { dist: [28, 34, 40, 46, 52] };
  const dist = st.k.dist[i], mph = randInt(4, 18), dir = rnd() < 0.5 ? -1 : 1, T1 = ctx.t.c1, O1 = ctx.o.c1;
  const drift = dir * mph * (dist / 40) * 0.07, sc = clamp(1.25 - (dist - 28) * 0.018, 0.7, 1.2), hw = 38 * sc, pT = 0.5 + (dist - 28) / 24 * 0.35;
  const barY = 118, postTop = barY - 74 * sc;
  let aim = 0;
  const flagA = dir * Math.min(35, mph * 2.2);
  ctx.stage.innerHTML = `<svg class="mg-svg tall" viewBox="0 0 340 300"><defs><linearGradient id="mgSky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1330"/><stop offset=".5" stop-color="#2a4a85"/><stop offset="1" stop-color="#14522d"/></linearGradient></defs>
    <rect width="340" height="300" rx="14" fill="url(#mgSky2)"/>${Array.from({ length: 16 }, (_, k) => `<circle cx="${18 + k * 21}" cy="${12 + (k % 3) * 7}" r="2" fill="#ffe9a8" opacity=".7"/>`).join('')}
    <rect x="0" y="150" width="340" height="40" fill="${T1}" opacity=".0"/><polygon points="96,150 244,150 372,300 -32,300" fill="#1c6a3c"/>
    <rect x="96" y="150" width="148" height="18" fill="${O1}" opacity=".85"/><text x="170" y="163" text-anchor="middle" font-size="13" font-weight="800" fill="${textOn(O1)}" font-family="Barlow Condensed, sans-serif" letter-spacing=".25em">${esc(ctx.o.nick.toUpperCase())}</text>
    ${[190, 215, 245].map((y, k) => `<line x1="${170 - 74 - k * 22}" x2="${170 + 74 + k * 22}" y1="${y}" y2="${y}" stroke="#fff" stroke-opacity=".28" stroke-width="${1.4 + k * 0.5}"/>`).join('')}
    <g stroke="#ffd23d" stroke-width="${4.5 * sc}" stroke-linecap="round" fill="none"><line x1="170" x2="170" y1="${barY}" y2="156"/><line x1="${170 - hw}" x2="${170 + hw}" y1="${barY}" y2="${barY}"/><line x1="${170 - hw}" x2="${170 - hw}" y1="${barY}" y2="${postTop}"/><line x1="${170 + hw}" x2="${170 + hw}" y1="${barY}" y2="${postTop}"/></g>
    <g id="mgWindArrow" opacity=".95"><line x1="170" y1="${barY - 26 * sc}" x2="${170 + drift * hw}" y2="${barY - 26 * sc}" stroke="#35e0ff" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 7"/><path d="M${170 + drift * hw} ${barY - 26 * sc} l${-dir * 9} -6 v12z" fill="#35e0ff"/><text x="170" y="${barY - 34 * sc}" text-anchor="middle" font-size="10" fill="#35e0ff" font-family="Barlow Condensed, sans-serif" letter-spacing=".1em">WIND PUSH</text></g>
    <g transform="translate(298 52)"><line x1="0" y1="0" x2="0" y2="52" stroke="#ddd" stroke-width="3"/><path class="mg-flag" d="M0 2 L${dir * 30} ${5 + Math.abs(flagA) * 0.05} L0 20 Z" fill="${ctx.t.c2}" stroke="#fff" stroke-width="1" style="transform-origin:0 10px;--fa:${flagA}deg"/><text y="68" text-anchor="middle" font-size="12" font-weight="800" fill="#fff" font-family="Barlow Condensed, sans-serif">${dir < 0 ? '◀' : ''} ${mph} MPH ${dir > 0 ? '▶' : ''}</text></g>
    <text x="42" y="78" text-anchor="middle" font-size="30" font-weight="800" fill="#fff" font-family="Barlow Condensed, sans-serif">${dist}</text><text x="42" y="92" text-anchor="middle" font-size="10" fill="#fff" fill-opacity=".7" letter-spacing=".15em" font-family="Barlow Condensed, sans-serif">YD FG</text>
    <g id="mgAim"><line id="mgAimL" x1="170" y1="268" x2="170" y2="150" stroke="#ffd23d" stroke-width="2" stroke-dasharray="5 5"/><circle id="mgAimC" cx="170" cy="150" r="7" fill="none" stroke="#ffd23d" stroke-width="2.5"/></g>
    <g id="mgBallG">${mgBall(170, 268, 1.5, 0, 'mgBallEl')}</g><g id="mgFx"></g></svg><div class="mg-call">${dist}-YARD FIELD GOAL · ${i + 1} of 5</div>`;
  const aimX = a => 170 + a * hw * 2;
  ctx.ctrl.innerHTML = `<div class="mg-aim"><span>AIM</span><input type="range" min="-100" max="100" value="0" id="mgAimIn"></div><div class="mg-btns one"><button class="mg-b big" id="mgKickGo" style="--c:#ffd23d">🦵 KICK</button></div>`;
  ctx.say('Wind is blowing — <b>aim into it</b>');
  const inp = ctx.ov.querySelector('#mgAimIn'), setAim = () => { aim = inp.value / 100; const x = aimX(aim); ctx.stage.querySelector('#mgAimL').setAttribute('x2', x); const c = ctx.stage.querySelector('#mgAimC'); c.setAttribute('cx', x); };
  inp.addEventListener('input', setAim);
  return new Promise(res => {
    ctx.ov.querySelector('#mgKickGo').addEventListener('click', async () => {
      if (!ctx.alive()) return; const go = ctx.ov.querySelector('#mgKickGo'); go.disabled = true; inp.disabled = true;
      ctx.ctrl.innerHTML = `<div class="mg-power"><div class="mg-pz" style="left:${(pT - 0.09) * 100}%;width:18%"></div><div class="mg-py" style="left:${(pT - 0.2) * 100}%;width:40%"></div><i id="mgPI"></i></div><div class="mg-btns one"><button class="mg-b big" id="mgStop" style="--c:#c5ff3a">⏹ STOP</button></div>`;
      ctx.say('<b>Stop the bar in the green!</b>', 'go');
      const pi = ctx.ov.querySelector('#mgPI'), t0 = performance.now(), sp = 0.9 + i * 0.13; let raf = 0;
      const val = () => { const ph = ((performance.now() - t0) / 1000 * sp) % 2; return ph < 1 ? ph : 2 - ph; };
      const upd = () => { if (!ctx.alive()) return; pi.style.left = (val() * 100) + '%'; raf = requestAnimationFrame(upd); }; raf = requestAnimationFrame(upd);
      const stop = async ev => {
        ev.preventDefault(); ctx.stage.removeEventListener('pointerdown', stop); cancelAnimationFrame(raf); const p = val(), perr = Math.abs(p - pT); ctx.ctrl.innerHTML = '';
        const lateral = aim * 2 + drift + (rnd() - 0.5) * 0.22 * (1 + 3 * perr) + (p < pT ? -0.1 : 0.1) * perr * 2, wide = Math.abs(lateral) > 0.92, short = p < pT - 0.2, over = p > pT + 0.2;
        const ok = !wide && !short && !over;
        // ball flight
        const ball = ctx.stage.querySelector('#mgBallEl'), tEnd = short ? 0.62 : 1, dur = 1100, f0 = performance.now();
        const landX = 170 + lateral * hw;
        await new Promise(r2 => { const step = () => { if (!ctx.alive()) return r2(); const k = Math.min(1, (performance.now() - f0) / dur), t = k * tEnd; const x = 170 + (landX - 170) * t, y = 268 - (268 - 118) * t - Math.sin(Math.PI * t) * 46, s = 1.5 - 1.15 * t; ball.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(k * 540).toFixed(0)}) scale(${s.toFixed(2)})`); if (k < 1) requestAnimationFrame(step); else r2(); }; step(); });
        if (!ctx.alive()) return res(false);
        const fx = ctx.stage.querySelector('#mgFx'); let txt;
        if (ok) { txt = `${dist}-YARD FIELD GOAL IS GOOD!`; fx.innerHTML = `<text x="170" y="96" text-anchor="middle" class="mg-pop good">GOOD!</text>`; Snd.play('td', 0.05); }
        else { const why = short ? 'SHORT' : wide ? (lateral < 0 ? 'WIDE LEFT' : 'WIDE RIGHT') : 'OVER'; txt = `No good — ${why.toLowerCase()}`; fx.innerHTML = `<text x="170" y="96" text-anchor="middle" class="mg-pop bad">${why}</text>`; }
        const tip = wide ? '<span class="mg-tip">The wind pushed it — aim against the arrow.</span>' : (short || over) ? '<span class="mg-tip">Stop the bar inside the green zone.</span>' : '';
        ctx.say(`${ok ? '✅' : '❌'} ${txt}${tip}`, ok ? 'good' : 'bad'); res(ok);
      };
      ctx.ov.querySelector('#mgStop').addEventListener('pointerdown', stop, { once: true }); ctx.stage.addEventListener('pointerdown', stop);
    }, { once: true });
  });
}

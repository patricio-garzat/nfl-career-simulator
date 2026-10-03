/* =====================================================================
   COLLEGE SEASON — before the draft you play ONE season with the team you picked.
   How it goes (stats, record, mini games) decides how your rating moves, so it decides where you go in the draft.
   Lives only in memory (it happens before the career save exists); the result is written into the prospect (preview)
   and then the normal draft takes over.
   ===================================================================== */
let CS = null;
const csTeamR = name => 66 + ((COLLEGES.find(c => c[0] === name) || [0, 0])[1]) * 3.4;     // school strength (only differences matter)
const csColors = info => ({ c1: info.c1 || '#1b3a6b', c2: info.c2 || '#ffffff' });
const csTheme = info => { const c = csColors(info); return `--t1:${c.c1};--t2:${c.c2};--ta:${accentOf(c)}`; };
const csBadge = (info, size = '') => { const c = csColors(info); return `<span class="team-badge logo ${size}" style="--t1:${c.c1};--t2:${c.c2};color:${textOn(c.c1)}"><img src="${collegeLogo(info.id, 120)}" alt="" onerror="this.style.visibility='hidden'"></span>`; };
const csPack = (name, info) => { const c = csColors(info); return { id: info.id, name, nick: name, c1: c.c1, c2: c.c2, logo: collegeLogo(info.id, 120) }; };

function csStart() {
  const P = preview, info = COLLEGE_INFO[P.college];
  const league = leagueOfDiv(info.div), G = league === 'NCAA' ? 12 : 10;
  const rows = NCAA.filter(r => leagueOfDiv(r[2]) === league && r[1] !== P.college);
  const near = rows.filter(r => r[2] === info.div), other = rows.filter(r => r[2] !== info.div);
  const opps = []; const used = new Set();
  while (opps.length < G) {
    const useOther = other.length && rnd() < (info.div === 'FBS' ? 0.14 : 0.25), src = useOther ? other : (near.length ? near : rows);
    const r = pick(src); if (used.has(r[1]) && used.size < rows.length - 1) continue; used.add(r[1]);
    opps.push({ name: r[1], r: csTeamR(r[1]) + gauss(0, 3), home: rnd() < 0.5 });
  }
  CS = { P, info, G, idx: 0, games: [], playoffGames: [], schedule: opps, teamR: csTeamR(P.college) + gauss(0, 2.5), form: Math.exp(gauss(0, 0.11)), status: 'regular', done: false, ovr0: P.ovr, attr0: { ...P.attrs }, proj0: draftProjectionLabel(P), pick0: projectedPick(P), num: Number.isInteger(P.number) ? P.number : (NUM_DEFAULT[P.pos] || 1) };
  mgInitSeason(CS); CS.mgIn = randInt(3, 4);
  { let t = 0; for (let k = 0; k < 60; k++) t += csStats(0, 1).fp; CS.baseFp = Math.max(1, t / 60); }   // what a player with these exact ratings normally produces
  renderCollege();
}

// one game's stat line for this prospect (same engine as the NFL season)
function csStats(diff, form) {
  const P = CS.P, cfg = POS[P.pos], sk = skillOf(P.ovr), gsc = clamp(diff * 0.0035, -0.08, 0.08);
  const pass = clamp(Math.round(gauss(34.5 * (1 - gsc), 5.2)), 20, 54);
  const tg = { pass, rush: clamp(Math.round(gauss(27 + gsc * 30 - 0.3 * (pass - 34.5), 4)), 14, 42) };
  const baseMy = clamp(Math.round(gauss(27 + diff * 0.225, 8.8)), 3, 63);
  const c = {
    pos: P.pos, s: sk, z: clamp((sk - 0.5) / 0.5, -1, 1), slot: 1, mult: 1, form, tg,
    ym: clamp(1 + diff * 0.004, 0.88, 1.12), tm: clamp(1 + diff * 0.006, 0.85, 1.15), matchup: clamp(1 + diff * 0.006, 0.8, 1.2),
    a: n => clamp((P.attrs[n] - 40) / 55, 0, 1), pts: baseMy, snap: snapShare(P.pos, 1),
  };
  const s = cfg.gen(c), fp = fantasyPts(P.pos, s);
  return { s, fp, rate: ratingIdx(P.pos, fp), baseMy };
}
function csPlayGame() {
  const P = CS.P, cfg = POS[P.pos], sc = CS.schedule[CS.idx], mods = mgMods(CS);
  const myR = CS.teamR + (P.ovr - 70) * cfg.impR * snapShare(P.pos, 1), diff = myR - sc.r + mods.team;
  const { s, fp, rate, baseMy } = csStats(diff, CS.form * mods.perf);
  const impact = P.pos === 'K' ? 0 : cfg.impact * clamp((fp - cfg.bench) / cfg.bench, -1, 2.5) * snapShare(P.pos, 1);
  let my = clamp(Math.round(baseMy + impact), 3, 63), op = clamp(Math.round(gauss(27 - diff * 0.225, 8.8)), 3, 63);
  const td = sg(s.passTD) + sg(s.rushTD) + sg(s.recTD) + sg(s.defTD);
  if (P.pos !== 'K') my = Math.max(my, td * 7);
  if (my === op) { if (rnd() < logistic(diff * 0.064)) my += 3; else op += 3; }
  const game = { k: 'REG', wk: CS.idx + 1, opp: sc.name, home: sc.home, my, op, w: my > op, st: 'ACTIVE', dnp: false, slot: 1, inj: null, hurt: null, s, fp, rate, td };
  CS.games.push(game); CS.idx++;
  if (CS.idx >= CS.G) CS.done = true;
  // bonuses age; every 3-4 games a mini game is offered
  CS.buffs.forEach(b => { b.left--; }); CS.buffs = CS.buffs.filter(b => b.left > 0);
  if (CS.mg) { CS.mg.age = (CS.mg.age || 0) + 1; if (CS.mg.age >= 3) { CS.mg = null; CS.mgSince = 0; CS.mgIn = randInt(3, 4); } }
  const kind = MG_KIND[P.pos];
  if (kind && !CS.mg && !CS.done) { CS.mgSince++; if (CS.mgSince >= CS.mgIn && CS.G - CS.idx >= 2) CS.mg = { kind, wk: game.wk, age: 0 }; }
  return game;
}

function csEnv() {
  const opp = CS.schedule[Math.min(CS.idx, CS.G - 1)], oi = COLLEGE_INFO[opp.name];
  return { se: CS, P: CS.P, t: csPack(CS.P.college, CS.info), o: csPack(opp.name, oi), number: CS.num, theme: csTheme(CS.info), save: false, onDone: () => renderCollege(),
    jersey: view => jerseySVG(collegeJersey(CS.P.college), jName(CS.P), CS.num, { view, noShield: true, word: CS.P.college.toUpperCase(), backLogo: collegeLogo(CS.info.id, 80) }) };
}
// same as seasonTotals(), but for the college season (there is no career save yet, so S is null)
function csTotals() {
  const cfg = POS[CS.P.pos], T = { gp: 0, fp: 0 }; cfg.stats.forEach(x => { T[x.k] = 0; });
  CS.games.forEach(g => { T.gp++; T.fp += g.fp; cfg.stats.forEach(x => { T[x.k] += (g.s[x.k] || 0); }); });
  T.fp = r1(T.fp); T.ppg = T.gp ? T.fp / T.gp : 0; return T;
}
const csRec = () => { const w = CS.games.filter(g => g.w).length; return { w, l: CS.games.length - w }; };

function renderCollege() {
  const P = CS.P, cfg = POS[P.pos], info = CS.info, T = csTotals(), rec = csRec(), last = CS.games[CS.games.length - 1];
  const sum = cfg.summary(T), done = CS.done;
  const nxt = CS.schedule[CS.idx], oi = nxt ? COLLEGE_INFO[nxt.name] : null;
  const next = done ? `<div class="next-card done"><div class="eyebrow">SEASON COMPLETE</div><div class="nc-big">${rec.w}–${rec.l} · time for the draft board</div></div>`
    : `<div class="next-card"><div class="eyebrow">GAME ${CS.idx + 1} OF ${CS.G}</div><div class="nc-row">${csBadge(oi, 'lg')}<div><div class="nc-big">${nxt.home ? 'vs' : '@'} ${esc(nxt.name)}</div><div class="muted">${oi.conf ? esc(oi.conf) + ' · ' : ''}Team strength ${Math.round(nxt.r)}</div></div></div></div>`;
  const lastCard = last ? `<div class="last-game"><span class="muted">Last game:</span> <b class="r${last.rate}-t">${RATING[last.rate].icon} ${RATING[last.rate].k}</b> · ${fmt1(last.fp)} FP · ${last.w ? 'W' : 'L'} ${last.my}-${last.op} vs ${esc(last.opp)}</div>` : '';
  const mgBanner = CS.mg && MG_META[CS.mg.kind] ? `<div class="banner dec-banner"><span>🎮 <b>MINI GAME</b> — ${MG_META[CS.mg.kind](P).title}</span><button class="btn btn-primary btn-sm" data-act="csMini">PLAY</button></div>` : '';
  const buffs = CS.buffs.length ? `<div class="dec-buffs">${CS.buffs.map(x => `<span class="chip ${x.perf < 0 ? 'bad' : 'gold'}">${esc(x.label)} · ${x.left}g</span>`).join('')}</div>` : '';
  setScreen(`<div class="wrap" style="${csTheme(info)}">
    <div class="brandbar"><span>🎓 COLLEGE SEASON</span><i></i><span class="muted">${esc(P.college).toUpperCase()}</span></div>
    <header class="hero"><span class="hero-num">${CS.num}</span>
      <div class="hero-l">${csBadge(info, 'xl')}
        <div><div class="eyebrow">${esc(P.college).toUpperCase()} · STARTER</div>
          <h1 class="player-name">${esc(P.name)}</h1>
          <div class="chips">${posBadge(P.pos)}<span class="chip">#${CS.num}</span><span class="chip">AGE ${P.age}</span>${youthChip(P.youth)}<span class="chip gold">DRAFT: ${esc(draftProjectionLabel(P)).toUpperCase()}</span></div>
        </div></div>
      ${ovrRing(P.ovr, 'big')}
    </header>
    ${mgBanner}
    <div class="dash-grid">
      <div class="col">
        <section class="card">
          <div class="card-h"><h3>COLLEGE SEASON</h3><span class="rec">${rec.w}–${rec.l}</span></div>
          <div class="tiles">${tile('GP', T.gp)}${sum.map(s => tile(s.l, s.v)).join('')}${tile('FANTASY PPG', fmt1(T.ppg), 'hl')}</div>
          ${lastCard}${sparkBars(CS)}${buffs}
        </section>
        ${next}
        <div class="actions">
          ${done ? '<button class="btn btn-primary btn-xl" data-act="csFinish">SEE MY DRAFT STOCK ▸</button>' : '<button class="btn btn-primary btn-xl" data-act="csPlay">PLAY NEXT GAME</button><button class="btn btn-secondary" data-act="csSim">SIMULATE SEASON</button>'}
          <button class="btn btn-ghost only-m" data-act="csPlayer">PLAYER</button>
        </div>
      </div>
      <div class="col">
        <section class="card"><div class="card-h"><h3>ATTRIBUTES</h3></div><div class="attr-list">${attrBars(P)}</div></section>
        <section class="card"><div class="card-h"><h3>DRAFT BOARD</h3></div><div class="muted small">Your season moves your rating — and the rating decides your draft spot. Big games and mini games raise your stock; bad ones drop it.</div></section>
      </div>
    </div></div>`, 'dash');
}

function csGameModal(game) {
  const cfg = POS[CS.P.pos], rt = RATING[game.rate], oi = COLLEGE_INFO[game.opp];
  let body = `<div class="perf r${game.rate}"><div class="perf-t">${rt.icon} ${rt.k} PERFORMANCE</div><div class="perf-fp">${fmt1(game.fp)} <small>Fantasy Points</small></div></div>
    <div class="mini-tiles">${cfg.cols.map(c => `<div><b>${c.g(game)}</b><span>${c.h}</span></div>`).join('')}</div>`;
  if (game.td > 0) body += `<div class="td-flash">🏈 TOUCHDOWN${game.td > 1 ? ' ×' + game.td : ''}!</div>`;
  if (CS.mg) body += `<div class="note">🎮 A mini game is ready.</div>`;
  openModal(`<div class="gm-head"><div class="eyebrow">GAME ${game.wk} · ${game.home ? 'vs' : '@'} ${esc(game.opp)}</div><div class="gm-res ${game.w ? 'w' : 'l'}">${game.w ? 'W' : 'L'} ${game.my}–${game.op}</div></div>${body}
    <div class="row end"><button class="btn btn-ghost" data-act="csClose">CLOSE</button>${CS.mg ? '<button class="btn btn-primary" data-act="csMini">🎮 PLAY MINI GAME ▸</button>' : CS.done ? '<button class="btn btn-primary" data-act="csFinish">SEE MY DRAFT STOCK ▸</button>' : '<button class="btn btn-primary" data-act="csPlayModal">NEXT GAME ▸</button>'}</div>`, 'game');
  Snd.play('whistle'); Snd.play(game.w ? 'win' : 'lose', 0.5);
  if (game.rate >= 5) Snd.play('cheer', 0.7); if (game.td > 0) { Snd.play('td', 0.6); burst(modalRoot.querySelector('.modal-card'), 30); }
}

/* ---- end of the season: rating moves with how it went, then the draft board ---- */
function csFinishSeason() {
  const P = CS.P, cfg = POS[P.pos], T = csTotals(), gp = T.gp, G = CS.games.length, w = CS.games.filter(g => g.w).length;
  const idx = gp >= 4 ? (T.fp / gp) / CS.baseFp : 1;      // compared with what YOUR ratings predict, so luck, form and mini games decide it
  const greatShare = gp ? CS.games.filter(g => g.rate >= 4).length / gp : 0;
  const perf = clamp(idx - 1, -0.6, 1.0) + (greatShare - 0.15) * 0.8;
  const target = clamp(Math.round(perf * 5.5 + (w / G - 0.5) * 2.4 + 0.8 + (CS.train.ment || 0) + gauss(0, 0.9)), -5, 7);
  const o0 = P.ovr; let guard = 0;
  while (calcOvr(P.pos, P.attrs) !== o0 + target && guard++ < 120) {
    const up = calcOvr(P.pos, P.attrs) < o0 + target, a = cfg.attrs.filter(([n]) => (up ? P.attrs[n] < 99 : P.attrs[n] > 35)); if (!a.length) break;
    const tot = a.reduce((s, x) => s + x[1], 0); let r = rnd() * tot, ch = a[0]; for (const x of a) { r -= x[1]; if (r <= 0) { ch = x; break; } }
    P.attrs[ch[0]] += up ? 1 : -1;
  }
  P.ovr = calcOvr(P.pos, P.attrs);
  const grade = perf >= 0.55 ? ['ALL-AMERICAN SEASON', '🏆'] : perf >= 0.25 ? ['BREAKOUT YEAR', '🚀'] : perf >= -0.1 ? ['SOLID SEASON', '👍'] : perf >= -0.35 ? ['QUIET YEAR', '😐'] : ['ROUGH YEAR', '📉'];
  CS.result = { ovrFrom: CS.ovr0, ovrTo: P.ovr, perf, grade, w, l: G - w, T, proj1: draftProjectionLabel(P), pick1: projectedPick(P), changes: cfg.attrs.map(([n]) => ({ attr: n, from: CS.attr0[n], to: P.attrs[n], d: P.attrs[n] - CS.attr0[n] })) };
  CS.finished = true;
  renderCollegeReport();
}
function renderCollegeReport() {
  const P = CS.P, R = CS.result, cfg = POS[P.pos], up = R.ovrTo > R.ovrFrom, down = R.ovrTo < R.ovrFrom, rise = R.pick1 < CS.pick0 - 3, fall = R.pick1 > CS.pick0 + 3;
  setScreen(`<div class="wrap narrow" style="${csTheme(CS.info)}">
    <div class="eyebrow">COLLEGE SEASON REVIEW</div><h2 class="h-xxl">${R.grade[1]} ${R.grade[0]}</h2>
    <section class="card dev-card">
      <div class="cs-sum">${csBadge(CS.info, 'lg')}<div><b>${esc(P.college)}</b><span>${R.w}–${R.l} · ${R.T.gp} games · ${fmt1(R.T.ppg)} fantasy PPG</span></div></div>
      <div class="big-line">${cfg.line(R.T).map(x => `<div><b>${fmtN(x.v)}</b><span>${x.l}</span></div>`).join('')}</div>
      <div class="ovr-change"><div class="oc-from">OVR <b>${R.ovrFrom}</b></div><div class="oc-arrow ${up ? 'up' : down ? 'down' : ''}">→</div>
        <div class="oc-to ${up ? 'up' : down ? 'down' : ''}"><b id="ovrNum">${R.ovrFrom}</b><span>${up ? '▲' : down ? '▼' : '●'}</span></div></div>
      <div class="dev-list">${R.changes.map((c, i) => `<div class="dev-row" style="animation-delay:${0.1 + i * 0.12}s"><span>${c.attr}</span><b class="${c.d > 0 ? 'good' : c.d < 0 ? 'bad' : 'muted'}">${c.d > 0 ? '+' : ''}${c.d}</b><div class="bar ${barClass(c.to)}"><i style="--w:${c.to}%"></i></div><em>${c.to}</em></div>`).join('')}</div>
      <div class="banner ${rise ? 'good' : fall ? 'warn' : ''} cs-stock">📋 <b>DRAFT STOCK:</b> ${esc(CS.proj0)} → <b>${esc(R.proj1)}</b> ${rise ? '▲ rising' : fall ? '▼ falling' : '● steady'}</div>
    </section>
    <div class="row end"><button class="btn btn-primary btn-xl" data-act="csDraft">ENTER THE DRAFT</button></div></div>`);
  Snd.play(up ? 'up' : down ? 'down' : 'tick', 0.4);
  setTimeout(() => { const el = document.getElementById('ovrNum'); if (el) countUp(el, R.ovrFrom, R.ovrTo); if (up && el) burst(el.closest('.dev-card'), 26); }, 350);
}

Object.assign(actions, {
  startCollege: () => csStart(),
  csPlay: () => { if (!CS || CS.done) return; const g = csPlayGame(); renderCollege(); csGameModal(g); },
  csPlayModal: () => { closeModal(); actions.csPlay(); },
  csClose: () => { closeModal(); },
  csMini: () => { closeModal(); mgOpen(csEnv()); },
  csPlayer: () => { openModal(`<h3 class="modal-h">${esc(CS.P.name)} · ${CS.P.pos} · OVR ${CS.P.ovr}</h3><div class="attr-list">${attrBars(CS.P)}</div><div class="row end"><button class="btn btn-primary" data-act="closeModal">CLOSE</button></div>`); },
  csFinish: () => { closeModal(); csFinishSeason(); },
  csDraft: () => { actions.enterDraft(); CS = null; },
  csSim: async () => {
    if (!CS || CS.done) return; if (CS.mg) { mgOpen(csEnv()); return; }
    const ov = document.createElement('div'); ov.className = 'sim-overlay';
    ov.innerHTML = `<div class="sim-box"><div class="eyebrow">SIMULATING ${esc(CS.P.college).toUpperCase()} SEASON</div><div class="sim-bar"><i></i></div><div class="sim-stage">REGULAR SEASON</div><div class="sim-feed"></div></div>`;
    document.body.appendChild(ov); const feed = ov.querySelector('.sim-feed'), bar = ov.querySelector('.sim-bar i');
    while (!CS.done) {
      const g = csPlayGame(); Snd.play(g.td ? 'cheer' : 'tick');
      const line = document.createElement('div'); line.className = 'feed-line ' + (g.w ? 'w' : 'l');
      line.textContent = `WK ${g.wk} · ${g.home ? 'vs' : '@'} ${g.opp} · ${g.w ? 'W' : 'L'} ${g.my}-${g.op} · ${fmt1(g.fp)} FP${g.td ? ' · 🏈' + g.td : ''}`;
      feed.prepend(line); while (feed.children.length > 7) feed.lastChild.remove(); bar.style.width = Math.min(100, 100 * CS.idx / CS.G) + '%';
      if (CS.mg) break; await sleep(110);
    }
    await sleep(400); ov.remove(); renderCollege();
    if (CS.mg) mgOpen(csEnv()); else if (CS.done) csFinishSeason();
  },
});
// when the draft starts, keep the college line in the career
(() => { const base = actions.enterDraft; actions.enterDraft = function () { const res = base.apply(this, arguments); if (CS && CS.finished && CS.P === preview && S) { S.college = { school: CS.P.college, w: CS.result.w, l: CS.result.l, grade: CS.result.grade[0], ovrFrom: CS.result.ovrFrom, ovrTo: CS.result.ovrTo }; saveGame(); } return res; }; })();

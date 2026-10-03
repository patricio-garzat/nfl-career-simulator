/* =====================================================================
   COLLEGE SEASON — before the draft you play ONE season with the team you picked.
   How it goes (stats, record, mini games) decides how your rating moves, so it decides where you go in the draft.
   Lives only in memory (it happens before the career save exists); the result is written into the prospect (preview)
   and then the normal draft takes over.
   ===================================================================== */
let CS = null;
const csTeamR = name => 66 + ((COLLEGES.find(c => c[0] === name) || [0, 0])[1]) * 3.4;     // school strength (only differences matter)
const csInfoOf = name => (CS && CS.oppInfo && CS.oppInfo[name]) || COLLEGE_INFO[name];
const csYouth = () => !!(CS && CS.kind === 'youth');
const csLabel = () => csYouth() ? 'YOUTH SEASON' : 'COLLEGE SEASON';
const csIcon = () => csYouth() ? '🧒' : '🎓';
// how hard the recruiters are chasing you (0..1): rating first, season second
const rcLevel = (P, perf = 0) => clamp((P.ovr - 60) / 26 + perf * 0.35, 0, 1);
const rcLabel = l => l < 0.3 ? 'Low' : l < 0.55 ? 'Growing' : l < 0.8 ? 'High' : 'Elite';
const csColors = info => ({ c1: info.c1 || '#1b3a6b', c2: info.c2 || '#ffffff' });
const csTheme = info => { const c = csColors(info); return `--t1:${c.c1};--t2:${c.c2};--ta:${accentOf(c)}`; };
const csBadge = (info, size = '') => { const c = csColors(info); return `<span class="team-badge logo ${size}" style="--t1:${c.c1};--t2:${c.c2};color:${textOn(c.c1)}"><img src="${collegeLogo(info.id, 120)}" alt="" onerror="this.style.visibility='hidden'"></span>`; };
const csPack = (name, info) => { const c = csColors(info); return { id: info.id, name, nick: name, c1: c.c1, c2: c.c2, logo: collegeLogo(info.id, 120) }; };

function csStart(kind) {
  const P = preview, youth = kind === 'youth';
  let name, info, G, rows, oppInfo = null;
  if (youth) {                                              // the MFL kids' season: 8 games against the other MFL clubs
    const mi = MFL_INFO[P.youth]; name = P.youth; info = { id: 'mfl-' + mi.slug, div: 'MFL', conf: 'MFL', c1: mi.c1, c2: mi.c2 }; G = 8; oppInfo = {};
    rows = MFL_TEAMS.filter(r => r[1] !== name).map(r => { oppInfo[r[1]] = { id: 'mfl-' + r[0], div: 'MFL', conf: 'MFL', c1: '#' + r[2], c2: '#' + r[3] }; return [r[0], r[1], 'MFL']; });
  } else {
    name = P.college; info = COLLEGE_INFO[name];
    const league = leagueOfDiv(info.div); G = league === 'NCAA' ? 12 : 10;
    rows = NCAA.filter(r => leagueOfDiv(r[2]) === league && r[1] !== name);
  }
  const near = rows.filter(r => r[2] === info.div), other = rows.filter(r => r[2] !== info.div);
  const opps = []; const used = new Set();
  while (opps.length < G) {
    const useOther = other.length && rnd() < (info.div === 'FBS' ? 0.14 : 0.25), src = useOther ? other : (near.length ? near : rows);
    const r = pick(src); if (used.has(r[1]) && used.size < rows.length - 1) continue; used.add(r[1]);
    opps.push({ name: r[1], r: csTeamR(r[1]) + gauss(0, 3), home: rnd() < 0.5 });
  }
  CS = { P, kind: youth ? 'youth' : 'school', name, info, oppInfo, G, idx: 0, games: [], playoffGames: [], schedule: opps, teamR: csTeamR(name) + gauss(0, 2.5), form: Math.exp(gauss(0, 0.11)), status: 'regular', done: false, ovr0: P.ovr, attr0: { ...P.attrs }, proj0: draftProjectionLabel(P), pick0: projectedPick(P), num: Number.isInteger(P.number) ? P.number : (NUM_DEFAULT[P.pos] || 1) };
  mgInitSeason(CS, CS.P.pos);
  { let t = 0; for (let k = 0; k < 60; k++) t += csStats(0, 1).fp; CS.baseFp = Math.max(1, t / 60); }   // what a player with these exact ratings normally produces
  renderCollege();
  if (CS.mg) setTimeout(() => { if (CS && CS.mg) mgOpen(csEnv()); }, 450);   // camp mini game
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
  CS.buffs.forEach(b => { b.left--; }); CS.buffs = CS.buffs.filter(b => b.left > 0);   // the camp bonus lasts the whole season
  return game;
}

function csEnv() {
  const opp = CS.schedule[Math.min(CS.idx, CS.G - 1)], oi = csInfoOf(opp.name);
  return { se: CS, P: CS.P, t: csPack(CS.name, CS.info), o: csPack(opp.name, oi), number: CS.num, theme: csTheme(CS.info), save: false, onDone: () => renderCollege(),
    jersey: view => csYouth() ? youthJerseySVG(CS.name, view, CS.num, jName(CS.P)) : jerseySVG(collegeJersey(CS.name), jName(CS.P), CS.num, { view, noShield: true, word: CS.name.toUpperCase(), backLogo: collegeLogo(CS.info.id, 80) }) };
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
  const nxt = CS.schedule[CS.idx], oi = nxt ? csInfoOf(nxt.name) : null, yth = csYouth();
  const next = done ? `<div class="next-card done"><div class="eyebrow">SEASON COMPLETE</div><div class="nc-big">${rec.w}–${rec.l} · ${yth ? 'time to meet the recruiters' : 'time for the draft board'}</div></div>`
    : `<div class="next-card"><div class="eyebrow">GAME ${CS.idx + 1} OF ${CS.G}</div><div class="nc-row">${csBadge(oi, 'lg')}<div><div class="nc-big">${nxt.home ? 'vs' : '@'} ${esc(nxt.name)}</div><div class="muted">${oi.conf ? esc(oi.conf) + ' · ' : ''}Team strength ${Math.round(nxt.r)}</div></div></div></div>`;
  const lastCard = last ? `<div class="last-game"><span class="muted">Last game:</span> <b class="r${last.rate}-t">${RATING[last.rate].icon} ${RATING[last.rate].k}</b> · ${fmt1(last.fp)} FP · ${last.w ? 'W' : 'L'} ${last.my}-${last.op} vs ${esc(last.opp)}</div>` : '';
  const mgBanner = CS.mg && MG_META[CS.mg.kind] ? `<div class="banner dec-banner"><span>🎮 <b>${yth ? 'YOUTH CAMP' : 'COLLEGE CAMP'}</b> — ${MG_META[CS.mg.kind](P).title}</span><button class="btn btn-primary btn-sm" data-act="csMini">PLAY</button></div>` : '';
  const buffs = CS.buffs.length ? `<div class="dec-buffs">${CS.buffs.map(x => `<span class="chip ${x.perf < 0 ? 'bad' : 'gold'}">${esc(x.label)} · ${x.left}g</span>`).join('')}</div>` : '';
  setScreen(`<div class="wrap" style="${csTheme(info)}">
    <div class="brandbar"><span>${csIcon()} ${csLabel()}</span><i></i><span class="muted">${esc(CS.name).toUpperCase()}</span></div>
    <header class="hero"><span class="hero-num">${CS.num}</span>
      <div class="hero-l">${csBadge(info, 'xl')}
        <div><div class="eyebrow">${esc(CS.name).toUpperCase()} · STARTER</div>
          <h1 class="player-name">${esc(P.name)}</h1>
          <div class="chips">${posBadge(P.pos)}<span class="chip">#${CS.num}</span><span class="chip">AGE ${P.age}</span>${yth ? '' : youthChip(P.youth)}${yth ? `<span class="chip gold">RECRUITS: ${rcLabel(rcLevel(P)).toUpperCase()}</span>` : `<span class="chip gold">DRAFT: ${esc(draftProjectionLabel(P)).toUpperCase()}</span>`}</div>
        </div></div>
      ${ovrRing(P.ovr, 'big')}
    </header>
    ${mgBanner}
    <div class="dash-grid">
      <div class="col">
        <section class="card">
          <div class="card-h"><h3>${csLabel()}</h3><span class="rec">${rec.w}–${rec.l}</span></div>
          <div class="tiles">${tile('GP', T.gp)}${sum.map(s => tile(s.l, s.v)).join('')}${tile('FANTASY PPG', fmt1(T.ppg), 'hl')}</div>
          ${lastCard}${sparkBars(CS)}${buffs}
        </section>
        ${next}
        <div class="actions">
          ${done ? `<button class="btn btn-primary btn-xl" data-act="csFinish">${yth ? 'SEE MY OFFERS ▸' : 'SEE MY DRAFT STOCK ▸'}</button>` : '<button class="btn btn-primary btn-xl" data-act="csPlay">PLAY NEXT GAME</button><button class="btn btn-secondary" data-act="csSim">SIMULATE SEASON</button>'}
          <button class="btn btn-ghost only-m" data-act="csPlayer">PLAYER</button>
        </div>
      </div>
      <div class="col">
        <section class="card"><div class="card-h"><h3>ATTRIBUTES</h3></div><div class="attr-list">${attrBars(P)}</div></section>
        <section class="card"><div class="card-h"><h3>${yth ? 'RECRUITERS' : 'DRAFT BOARD'}</h3></div><div class="muted small">${yth ? 'Your season moves your rating — and the rating decides who comes calling: 5 colleges (NCAA and ONEFA), the LFA and the UFL. Big games and mini games raise their interest.' : 'Your season moves your rating — and the rating decides your draft spot. Big games and mini games raise your stock; bad ones drop it.'}</div></section>
      </div>
    </div></div>`, 'dash');
}

function csGameModal(game) {
  const cfg = POS[CS.P.pos], rt = RATING[game.rate];
  let body = `<div class="perf r${game.rate}"><div class="perf-t">${rt.icon} ${rt.k} PERFORMANCE</div><div class="perf-fp">${fmt1(game.fp)} <small>Fantasy Points</small></div></div>
    <div class="mini-tiles">${cfg.cols.map(c => `<div><b>${c.g(game)}</b><span>${c.h}</span></div>`).join('')}</div>`;
  if (game.td > 0) body += `<div class="td-flash">🏈 TOUCHDOWN${game.td > 1 ? ' ×' + game.td : ''}!</div>`;
  if (CS.mg) body += `<div class="note">🎮 A mini game is ready.</div>`;
  openModal(`<div class="gm-head"><div class="eyebrow">GAME ${game.wk} · ${game.home ? 'vs' : '@'} ${esc(game.opp)}</div><div class="gm-res ${game.w ? 'w' : 'l'}">${game.w ? 'W' : 'L'} ${game.my}–${game.op}</div></div>${body}
    <div class="row end"><button class="btn btn-ghost" data-act="csClose">CLOSE</button>${CS.mg ? '<button class="btn btn-primary" data-act="csMini">🎮 PLAY MINI GAME ▸</button>' : CS.done ? `<button class="btn btn-primary" data-act="csFinish">${csYouth() ? 'SEE MY OFFERS ▸' : 'SEE MY DRAFT STOCK ▸'}</button>` : '<button class="btn btn-primary" data-act="csPlayModal">NEXT GAME ▸</button>'}</div>`, 'game');
  Snd.play('whistle'); Snd.play(game.w ? 'win' : 'lose', 0.5);
  if (game.rate >= 5) Snd.play('cheer', 0.7); if (game.td > 0) { Snd.play('td', 0.6); burst(modalRoot.querySelector('.modal-card'), 30); }
}

/* ---- end of the season: rating moves with how it went, then the draft board ---- */
function csFinishSeason() {
  const P = CS.P, cfg = POS[P.pos], T = csTotals(), gp = T.gp, G = CS.games.length, w = CS.games.filter(g => g.w).length;
  const idx = gp >= 4 ? (T.fp / gp) / CS.baseFp : 1;      // compared with what YOUR ratings predict, so luck, form and mini games decide it
  const greatShare = gp ? CS.games.filter(g => g.rate >= 4).length / gp : 0;
  const camp = CS.mgLog && CS.mgLog.length ? (CS.mgLog[0].score - 2.5) * 0.2 : 0;     // the camp mini game at the start of the season
  const perf = clamp(idx - 1, -0.6, 1.0) + (greatShare - 0.15) * 0.8 + camp;
  const sc = csYouth() ? 0.6 : 1, target = clamp(Math.round((perf * 5.5 + (w / G - 0.5) * 2.4 + 0.8 + (CS.train.ment || 0) + gauss(0, 0.9)) * sc), csYouth() ? -3 : -5, csYouth() ? 4 : 7);
  const o0 = P.ovr; let guard = 0;
  while (calcOvr(P.pos, P.attrs) !== o0 + target && guard++ < 120) {
    const up = calcOvr(P.pos, P.attrs) < o0 + target, a = cfg.attrs.filter(([n]) => (up ? P.attrs[n] < 99 : P.attrs[n] > 35)); if (!a.length) break;
    const tot = a.reduce((s, x) => s + x[1], 0); let r = rnd() * tot, ch = a[0]; for (const x of a) { r -= x[1]; if (r <= 0) { ch = x; break; } }
    P.attrs[ch[0]] += up ? 1 : -1;
  }
  P.ovr = calcOvr(P.pos, P.attrs);
  const grade = perf >= 0.55 ? ['ALL-AMERICAN SEASON', '🏆'] : perf >= 0.25 ? ['BREAKOUT YEAR', '🚀'] : perf >= -0.1 ? ['SOLID SEASON', '👍'] : perf >= -0.35 ? ['QUIET YEAR', '😐'] : ['ROUGH YEAR', '📉'];
  P.recruitPerf = perf; CS.result = { camp: CS.mgLog && CS.mgLog.length ? CS.mgLog[0] : null, ovrFrom: CS.ovr0, ovrTo: P.ovr, perf, grade, w, l: G - w, T, proj1: draftProjectionLabel(P), pick1: projectedPick(P), changes: cfg.attrs.map(([n]) => ({ attr: n, from: CS.attr0[n], to: P.attrs[n], d: P.attrs[n] - CS.attr0[n] })) };
  if (csYouth()) P.youthRec = { team: CS.name, w, l: G - w, grade: grade[0], icon: grade[1], ovrFrom: CS.ovr0, ovrTo: P.ovr, line: cfg.line(T).map(x => ({ v: x.v, l: x.l })), ppg: T.ppg, gp: T.gp };   // kept for the career timeline
  CS.finished = true;
  renderCollegeReport();
}
function renderCollegeReport() {
  const P = CS.P, R = CS.result, cfg = POS[P.pos], up = R.ovrTo > R.ovrFrom, down = R.ovrTo < R.ovrFrom, rise = R.pick1 < CS.pick0 - 3, fall = R.pick1 > CS.pick0 + 3;
  const yth = csYouth(), lvl = rcLevel(P, R.perf);
  setScreen(`<div class="wrap narrow" style="${csTheme(CS.info)}">
    <div class="eyebrow">${csLabel()} REVIEW</div><h2 class="h-xxl">${R.grade[1]} ${R.grade[0]}</h2>
    <section class="card dev-card">
      <div class="cs-sum">${csBadge(CS.info, 'lg')}<div><b>${esc(CS.name)}</b><span>${R.w}–${R.l} · ${R.T.gp} games · ${fmt1(R.T.ppg)} fantasy PPG</span></div></div>
      <div class="big-line">${cfg.line(R.T).map(x => `<div><b>${fmtN(x.v)}</b><span>${x.l}</span></div>`).join('')}</div>
      <div class="ovr-change"><div class="oc-from">OVR <b>${R.ovrFrom}</b></div><div class="oc-arrow ${up ? 'up' : down ? 'down' : ''}">→</div>
        <div class="oc-to ${up ? 'up' : down ? 'down' : ''}"><b id="ovrNum">${R.ovrFrom}</b><span>${up ? '▲' : down ? '▼' : '●'}</span></div></div>
      <div class="dev-list">${R.changes.map((c, i) => `<div class="dev-row" style="animation-delay:${0.1 + i * 0.12}s"><span>${c.attr}</span><b class="${c.d > 0 ? 'good' : c.d < 0 ? 'bad' : 'muted'}">${c.d > 0 ? '+' : ''}${c.d}</b><div class="bar ${barClass(c.to)}"><i style="--w:${c.to}%"></i></div><em>${c.to}</em></div>`).join('')}</div>
      ${R.camp ? `<div class="banner ${R.camp.score >= 3 ? 'good' : 'warn'} cs-stock">🎮 Camp: <b>${MG_GRADES[R.camp.score].n}</b> (${R.camp.score}/5) ${R.camp.score >= 3 ? 'helped' : 'hurt'} your rating</div>` : ''}
      ${yth ? `<div class="banner ${lvl >= 0.55 ? 'good' : ''} cs-stock">📣 <b>RECRUITING BUZZ:</b> ${rcLabel(lvl)} — 5 colleges, the LFA and the UFL are watching</div>` : `<div class="banner ${rise ? 'good' : fall ? 'warn' : ''} cs-stock">📋 <b>DRAFT STOCK:</b> ${esc(CS.proj0)} → <b>${esc(R.proj1)}</b> ${rise ? '▲ rising' : fall ? '▼ falling' : '● steady'}</div>`}
    </section>
    <div class="row end">${yth ? '<button class="btn btn-primary btn-xl" data-act="csOffers">SEE MY OFFERS ▸</button>' : '<button class="btn btn-primary btn-xl" data-act="csDraft">ENTER THE DRAFT</button>'}</div></div>`);
  Snd.play(up ? 'up' : down ? 'down' : 'tick', 0.4);
  setTimeout(() => { const el = document.getElementById('ovrNum'); if (el) countUp(el, R.ovrFrom, R.ovrTo); if (up && el) burst(el.closest('.dev-card'), 26); }, 350);
}

/* ---- RECRUITING OFFERS: after the MFL season, 5 colleges (NCAA + ONEFA), 1 LFA team and 1 UFL team come calling ---- */
function makeOffers(P) {
  const lvl = rcLevel(P, P.recruitPerf || 0), tgt = 1 + clamp(lvl + gauss(0, 0.08), 0, 1) * 4;     // the better you are, the bigger the programs that call
  const wsample = (pool, n, w) => { const items = pool.slice(), out = []; while (out.length < n && items.length) { const ws = items.map(w), tot = ws.reduce((a, b) => a + b, 0); let r = rnd() * tot, i = 0; for (; i < items.length - 1; i++) { r -= ws[i]; if (r <= 0) break; } out.push(items.splice(i, 1)[0]); } return out; };
  const prestige = r => clamp(Math.round(3 + ((COLLEGES.find(c => c[0] === r[1]) || [0, 0])[1])), 1, 5);
  const hw = r => Math.exp(-Math.pow(prestige(r) - tgt, 2) / 1.6) + 0.02;
  const nMX = rnd() < 0.5 ? 1 : 2;
  const card = r => ({ name: r[1], lg: r[2] === 'MX' ? 'ONEFA' : 'NCAA', id: r[0], c1: '#' + r[4], c2: '#' + r[5], stars: prestige(r), sub: r[2] === 'MX' ? `ONEFA · ${r[3]}` : `NCAA ${r[2]}${r[3] ? ' · ' + r[3] : ''}`,
    role: prestige(r) <= tgt - 0.4 ? 'Starter from day one' : prestige(r) >= tgt + 0.9 ? 'Battle for the job' : 'Real shot at starting' });
  const colleges = wsample(NCAA.filter(r => ['FBS', 'FCS', 'OTHER'].includes(r[2])), 5 - nMX, hw).concat(wsample(NCAA.filter(r => r[2] === 'MX'), nMX, hw)).sort((a, b) => prestige(b) - prestige(a)).map(card);
  const pro = (div, lg, sub) => { const r = pick(NCAA.filter(x => x[2] === div)); return { name: r[1], lg, id: r[0], c1: '#' + r[4], c2: '#' + r[5], stars: 0, sub, role: lvl >= 0.6 ? 'Wants you as a starter' : lvl >= 0.35 ? 'Wants you on the roster' : 'Tryout offer' }; };
  return { lvl, hs: colleges, lfa: pro('LFA', 'LFA', 'México · pro league'), ufl: pro('UFL', 'UFL', 'United Football League') };
}
function offerCard(o) {
  const stars = o.stars ? '★'.repeat(o.stars) + '<i>' + '★'.repeat(5 - o.stars) + '</i>' : '';
  return `<button type="button" class="of-card" data-act="offerPick" data-n="${esc(o.name)}" style="--oc:${o.c1};--oc2:${o.c2}">
    <img src="${collegeLogo(o.id, 120)}" alt="" onerror="this.style.visibility='hidden'"><div class="of-t"><b>${esc(o.name)}</b><span>${esc(o.sub)}</span><em>${esc(o.role)}</em></div>${stars ? `<div class="of-stars" title="Program prestige">${stars}</div>` : '<div class="of-pro">PRO</div>'}</button>`;
}
function renderOffers() {
  const P = preview; if (!P.offers) P.offers = makeOffers(P);
  const O = P.offers, y = MFL_INFO[P.youth] || { c1: '#4a5a7a' };
  setScreen(`<div class="wrap narrow offers" style="--yc:${y.c1}">
    <div class="eyebrow">AFTER YOUR ${esc(P.youth || 'MFL').toUpperCase()} SEASON</div><h2 class="h-xl">WHO WANTS YOU?</h2>
    <div class="muted of-lead">Recruiting interest: <b>${rcLabel(O.lvl)}</b> · OVR ${P.ovr}. A better rating and a better season bring bigger programs. Pick one — you start your next season there.</div>
    <section class="card"><div class="card-h"><h3>COLLEGES</h3><span class="muted small">5 interested · NCAA + ONEFA</span></div><div class="of-grid">${O.hs.map(offerCard).join('')}</div></section>
    <section class="card"><div class="card-h"><h3>PRO PATHWAYS</h3><span class="muted small">1 LFA · 1 UFL</span></div><div class="of-grid">${offerCard(O.lfa)}${offerCard(O.ufl)}</div></section>
  </div>`);
  Snd.play('up', 0.3);
}
const offerPool = name => (preview.offers ? [].concat(preview.offers.hs, [preview.offers.lfa, preview.offers.ufl]) : []).find(o => o.name === name);

Object.assign(actions, {
  startCollege: () => csStart(),
  startYouth: () => csStart('youth'),
  skipOffers: () => { CS = null; preview.recruitPerf = 0; renderOffers(); },
  csOffers: () => { CS = null; renderOffers(); },
  offerPick: (d) => {
    const o = offerPool(d.n); if (!o) return;
    confirmBox(`Join ${esc(o.name)}?`, `${esc(o.sub)} · ${esc(o.role)}. You will play your next season there and then enter the draft.`, 'JOIN', () => {
      preview.college = o.name; form.college = o.name; CS = null; Snd.play('whistle'); csStart();
    });
  },
  csPlay: () => { if (!CS || CS.done) return; if (CS.mg) { mgOpen(csEnv()); return; } const g = csPlayGame(); renderCollege(); csGameModal(g); },
  csPlayModal: () => { closeModal(); actions.csPlay(); },
  csClose: () => { closeModal(); },
  csMini: () => { closeModal(); mgOpen(csEnv()); },
  csPlayer: () => { openModal(`<h3 class="modal-h">${esc(CS.P.name)} · ${CS.P.pos} · OVR ${CS.P.ovr}</h3><div class="attr-list">${attrBars(CS.P)}</div><div class="row end"><button class="btn btn-primary" data-act="closeModal">CLOSE</button></div>`); },
  csFinish: () => { closeModal(); csFinishSeason(); },
  csDraft: () => { actions.enterDraft(); CS = null; },
  csSim: async () => {
    if (!CS || CS.done) return; if (CS.mg) { mgOpen(csEnv()); return; }
    const ov = document.createElement('div'); ov.className = 'sim-overlay';
    ov.innerHTML = `<div class="sim-box"><div class="eyebrow">SIMULATING ${esc(CS.name).toUpperCase()} SEASON</div><div class="sim-bar"><i></i></div><div class="sim-stage">REGULAR SEASON</div><div class="sim-feed"></div></div>`;
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
(() => { const base = actions.enterDraft; actions.enterDraft = function () { const res = base.apply(this, arguments); if (CS && CS.finished && CS.kind !== 'youth' && CS.P === preview && S) { S.college = { school: CS.name, w: CS.result.w, l: CS.result.l, grade: CS.result.grade[0], icon: CS.result.grade[1], ovrFrom: CS.result.ovrFrom, ovrTo: CS.result.ovrTo, line: POS[CS.P.pos].line(CS.result.T).map(x => ({ v: x.v, l: x.l })), ppg: CS.result.T.ppg, gp: CS.result.T.gp }; saveGame(); } return res; }; })();

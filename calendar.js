/* =====================================================================
   LEAGUE CALENDAR — real dates and kickoff times for every game of the season, and a screen to browse them.
   The regular season has 18 weeks (17 games + a bye). Week 1 opens on the Thursday after Labor Day. Each week has its NFL windows:
   Thursday night · Sunday (9:30 AM international, 1:00 PM, 4:05 / 4:25 PM) · Sunday night · Monday night
   (Thanksgiving: three Thursday games; Week 18: Saturday games). Times are Eastern.
   season.league = { weeks: [ [ {a, h, s, w, pa, ph, u, ia, ih, pw} ... ] x 18 ], tw: { team: [week of each of its games] } }
     a/h away/home team, s slot, w winner (null until decided), pa/ph points, u = index in the user's schedule, ia/ih = game number of each team, pw = pre-simulated winner of a user game
   Results of the other 31 teams are decided up front (like before) and feed season.aiRes, which drives the standings; the user's games write their real results back.
   ===================================================================== */
const CAL_SLOTS = {
  TNF: { off: 0, min: 20 * 60 + 15, name: 'Thursday Night', tag: 'THU NIGHT' },
  THA: { off: 0, min: 12 * 60 + 30, name: 'Thanksgiving', tag: 'THANKSGIVING' }, THB: { off: 0, min: 16 * 60 + 30, name: 'Thanksgiving', tag: 'THANKSGIVING' }, THC: { off: 0, min: 20 * 60 + 20, name: 'Thanksgiving Night', tag: 'THANKSGIVING' },
  SAT1: { off: 2, min: 16 * 60 + 30, name: 'Saturday', tag: 'SATURDAY' }, SAT2: { off: 2, min: 20 * 60, name: 'Saturday Night', tag: 'SAT NIGHT' },
  INT: { off: 3, min: 9 * 60 + 30, name: 'Sunday Morning · International', tag: 'SUNDAY' },
  SUN1: { off: 3, min: 13 * 60, name: 'Sunday', tag: 'SUNDAY' }, SUN4: { off: 3, min: 16 * 60 + 5, name: 'Sunday Late', tag: 'SUNDAY' }, SUN4b: { off: 3, min: 16 * 60 + 25, name: 'Sunday Late', tag: 'SUNDAY' },
  SNF: { off: 3, min: 20 * 60 + 20, name: 'Sunday Night', tag: 'SUN NIGHT' },
  MNE: { off: 4, min: 19 * 60 + 15, name: 'Monday Night', tag: 'MON NIGHT' }, MNF: { off: 4, min: 20 * 60 + 15, name: 'Monday Night', tag: 'MON NIGHT' },
};
const CAL_DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], CAL_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CAL_INTL = { 5: 'London', 6: 'London', 7: 'London', 10: 'Berlin' };
const CAL_WEST = ['LV', 'LAR', 'LAC', 'SF', 'SEA', 'ARI', 'DEN'];
const calTimeStr = min => { const h = Math.floor(min / 60), m = min % 60; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
function calThursday(year, wk) {                                    // Thursday of a week: the first one follows Labor Day (first Monday of September)
  const d = new Date(Date.UTC(year, 8, 1)); while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + 3 + 7 * (wk - 1)); return d;
}
const calAdd = (d, n) => { const x = new Date(d.getTime()); x.setUTCDate(x.getUTCDate() + n); return x; };
const calShort = d => `${CAL_DOW[d.getUTCDay()].slice(0, 3)}, ${CAL_MONTH[d.getUTCMonth()]} ${d.getUTCDate()}`;
const calLong = d => `${CAL_DOW[d.getUTCDay()].toUpperCase()} · ${CAL_MONTH[d.getUTCMonth()].toUpperCase()} ${d.getUTCDate()}`;
// kickoff of a league game: { date, time, name, tag }
function calWhen(year, wk, g) {
  const s = CAL_SLOTS[g.s] || CAL_SLOTS.SUN1, date = calAdd(calThursday(year, wk), s.off);
  let min = s.min; if (g.s === 'TNF' && wk === 1) min = 20 * 60 + 20;
  return { date, time: calTimeStr(min), name: s.name, tag: s.tag, min: s.off * 1440 + min };
}
// playoff dates: Wild Card weekend (Sat-Mon), Divisional (Sat-Sun), Conference Championships (Sun), Super Bowl (two Sundays later)
function calPlayoffWhen(season, short) {
  const y = season.year, po = season.po || {}, afc = po.conf === 'AFC', seed = po.mySeed || 4;
  const sat = n => calAdd(calThursday(y, n), 2), sun = n => calAdd(calThursday(y, n), 3), mon = n => calAdd(calThursday(y, n), 4);
  if (short === 'WC') {
    const k = { 2: 0, 7: 0, 3: 1, 6: 1, 4: 2, 5: 2 }[seed] || 0;
    const t = afc ? [[sat(19), 16 * 60 + 30, 'Saturday'], [sat(19), 20 * 60 + 15, 'Saturday Night'], [sun(19), 13 * 60, 'Sunday']][k] : [[sun(19), 16 * 60 + 30, 'Sunday'], [sun(19), 20 * 60, 'Sunday Night'], [mon(19), 20 * 60, 'Monday Night']][k];
    return { date: t[0], time: calTimeStr(t[1]), name: t[2] };
  }
  if (short === 'DIV') { const t = [[sat(20), 16 * 60 + 35, 'Saturday'], [sat(20), 20 * 60 + 15, 'Saturday Night'], [sun(20), 15 * 60, 'Sunday'], [sun(20), 18 * 60 + 30, 'Sunday Night']][(seed + (afc ? 0 : 2)) % 4]; return { date: t[0], time: calTimeStr(t[1]), name: t[2] }; }
  if (short === 'CONF') return { date: sun(21), time: calTimeStr(afc ? 15 * 60 : 18 * 60 + 30), name: afc ? 'Sunday' : 'Sunday Night' };
  return { date: calAdd(sun(21), 14), time: calTimeStr(18 * 60 + 30), name: 'Super Bowl Sunday' };
}

/* ---------- building the league's season ---------- */
function calGenLeague(season, fromWeek, prev) {
  const ids = TEAM_LIST.map(t => t.id), rt = id => S.teamRatings[id], dv = id => TEAM[id].conf + TEAM[id].div, U = season.teamId;
  const weeks = prev ? prev.weeks.slice(0, fromWeek - 1).map(w => w.map(g => ({ ...g }))) : [];
  const played = {}, homes = {}, meets = {}; ids.forEach(i => { played[i] = 0; homes[i] = 0; });
  const mk = (a, b) => (a < b ? a + b : b + a);
  weeks.forEach(wk => wk.forEach(g => { played[g.a]++; played[g.h]++; homes[g.h]++; meets[mk(g.a, g.h)] = (meets[mk(g.a, g.h)] || 0) + 1; }));
  const userGame = wk => { const i = season.schedule.findIndex(x => x.week === wk); return i < 0 ? null : { idx: i, opp: season.schedule[i].oppId, home: season.schedule[i].home }; };
  // future user games count as meetings between the user's team and its opponents
  season.schedule.forEach((x, i) => { if (x.week >= fromWeek) meets[mk(U, x.oppId)] = (meets[mk(U, x.oppId)] || 0) + 1; });
  const BYE_T = [2, 2, 4, 4, 4, 4, 4, 4, 2, 2];                           // byes in weeks 5..14
  const prime = {}; ids.forEach(i => { prime[i] = 0; });
  weeks.forEach(wk => wk.forEach(g => { if (['TNF', 'SNF', 'MNF', 'MNE'].includes(g.s)) { prime[g.a]++; prime[g.h]++; } }));
  let prevThu = new Set(prev && weeks.length ? weeks[weeks.length - 1].filter(g => g.s === 'TNF').flatMap(g => [g.a, g.h]) : []);
  let prevMon = new Set(prev && weeks.length ? weeks[weeks.length - 1].filter(g => g.s === 'MNF' || g.s === 'MNE').flatMap(g => [g.a, g.h]) : []);
  for (let wk = fromWeek; wk <= 18; wk++) {
    const left = 18 - wk + 1, ug = userGame(wk), pool = ids.filter(i => played[i] < 17 || i === U || (ug && i === ug.opp));
    const rem = i => 17 - played[i];
    const userBye = !ug && rem(U) > 0 ? [U] : [];
    const canBye = pool.filter(i => rem(i) < left && i !== U && !(ug && i === ug.opp));
    const needers = pool.filter(i => rem(i) === left - 1).length;
    const byeWeeksLeft = Math.max(1, 14 - Math.max(wk, 5) + 1);
    let nBye = wk < 5 ? 0 : (!prev && wk <= 14) ? BYE_T[wk - 5] : (wk > 14 ? needers : Math.ceil(needers / byeWeeksLeft));
    nBye = Math.min(nBye, canBye.length + userBye.length);
    let others = Math.max(0, nBye - userBye.length);
    if ((userBye.length + others) % 2) others = others > 0 ? others - 1 : Math.min(canBye.length, 1);        // an even number of teams must be on the field
    const byes = userBye.concat(shuffle(canBye).slice(0, others)), reserved = ug ? [U, ug.opp] : [];
    let playing = pool.filter(i => !byes.includes(i));
    if (playing.length % 2) {                                              // still odd (late weeks): one more team waits, preferably one that has not had its bye yet
      const drop = shuffle(playing.filter(i => !reserved.includes(i) && rem(i) < left))[0] || shuffle(playing.filter(i => !reserved.includes(i)))[0];
      if (drop) { byes.push(drop); playing = playing.filter(i => i !== drop); }
    }
    const games = [], free = shuffle(playing.filter(i => !(ug && (i === U || i === ug.opp))));
    const mkGame = (a, h, u) => ({ a, h, s: 'SUN1', w: null, pa: 0, ph: 0, ...(u !== undefined ? { u } : {}) });
    if (ug && playing.includes(U)) games.push(mkGame(ug.home ? ug.opp : U, ug.home ? U : ug.opp, ug.idx));
    while (free.length > 1) {
      const a = free.pop();
      let best = null, bs = 1e9;
      free.forEach(b => { const m = meets[mk(a, b)] || 0, sd = dv(a) === dv(b); const sc = (sd && m < 2 ? 0 : m === 0 ? 1.2 : m < 2 ? 3 : 6) + Math.random() * 1.6; if (sc < bs) { bs = sc; best = b; } });
      free.splice(free.indexOf(best), 1);
      const homeA = homes[a] < homes[best] ? true : homes[a] > homes[best] ? false : rnd() < 0.5;
      games.push(mkGame(homeA ? best : a, homeA ? a : best));
      meets[mk(a, best)] = (meets[mk(a, best)] || 0) + 1;
    }
    games.forEach(g => { played[g.a]++; played[g.h]++; homes[g.h]++; });
    // results of the games that do not involve the user, and a pre-simulated winner for the ones that do (so every team has a string of results)
    games.forEach(g => {
      const pa = logistic(0.064 * (rt(g.a) - (rt(g.h) + 2.2))), awayWins = rnd() < pa, win = awayWins ? g.a : g.h, lose = awayWins ? g.h : g.a;
      const W = clamp(Math.round(gauss(26 + (rt(win) - 72) * 0.2, 6)), 10, 48); let L = clamp(Math.round(gauss(17 + (rt(lose) - 72) * 0.2, 6)), 0, 44); if (L >= W) L = Math.max(0, W - randInt(1, 10));
      if (g.u !== undefined) { g.pw = win; } else { g.w = win; g.pa = awayWins ? W : L; g.ph = awayWins ? L : W; }
    });
    calAssign(games, wk, season.year, { prevMon, prevThu, prime }, rt, U);
    prevMon = new Set(games.filter(g => g.s === 'MNF' || g.s === 'MNE').flatMap(g => [g.a, g.h]));
    prevThu = new Set(games.filter(g => g.s === 'TNF').flatMap(g => [g.a, g.h]));
    games.forEach(g => { if (['TNF', 'SNF', 'MNF', 'MNE'].includes(g.s)) { prime[g.a]++; prime[g.h]++; } });
    weeks.push(games);
  }
  // per-team lists: week of each game, game numbers, and the string of results
  const tw = {}, aiRes = {}; ids.forEach(i => { tw[i] = []; aiRes[i] = ''; });
  weeks.forEach((games, wi) => games.forEach(g => {
    g.ia = tw[g.a].length; g.ih = tw[g.h].length; tw[g.a].push(wi + 1); tw[g.h].push(wi + 1);
    const res = g.w || g.pw;
    aiRes[g.a] += res === g.a ? '1' : '0'; aiRes[g.h] += res === g.h ? '1' : '0';
  }));
  return { league: { weeks, tw }, aiRes };
}
// give every game of a week its window: primetime slots go to the juiciest games, Sunday is split into early and late, Thursday teams cannot have played on Monday night
function calAssign(gs, wk, year, ctx, rt, U) {
  const { prevMon, prevThu, prime } = ctx;
  const div = id => TEAM[id].conf + TEAM[id].div, sc = new Map();
  gs.forEach(g => sc.set(g, rt(g.a) + rt(g.h) + (div(g.a) === div(g.h) ? 6 : 0) + (g.a === U || g.h === U ? (rt(U) - 70) * 0.6 + rr(0, 8) : 0) + rr(0, 10) - (prime[g.a] >= 4 ? 25 : 0) - (prime[g.h] >= 4 ? 25 : 0)));
  const sorted = gs.slice().sort((x, y) => sc.get(y) - sc.get(x)), rest = new Set(gs);
  const take = (slot, pred) => { const g = sorted.find(x => rest.has(x) && (!pred || pred(x))); if (g) { g.s = slot; rest.delete(g); } return g; };
  const thu = calThursday(year, wk), thanks = thu.getUTCMonth() === 10 && thu.getUTCDate() >= 22 && thu.getUTCDate() <= 28;
  if (wk === 18) { take('SNF'); take('SAT1'); take('SAT2'); }
  else {
    take('SNF');
    if (wk <= 2) take('MNE');
    take('MNF');
    if (thanks) { take('THA', g => g.h === 'DET') || take('THA'); take('THB', g => g.h === 'DAL') || take('THB'); take('THC'); }
    else if (wk === 1) { const open = sorted.filter(x => rest.has(x)).sort((x, y) => rt(y.h) - rt(x.h))[0]; if (open) { open.s = 'TNF'; rest.delete(open); } }
    else take('TNF', g => !prevMon.has(g.a) && !prevMon.has(g.h) && !prevThu.has(g.a) && !prevThu.has(g.h)) || take('TNF', g => !prevMon.has(g.a) && !prevMon.has(g.h));
    if (CAL_INTL[wk]) { const g = shuffle([...rest].filter(x => x.u === undefined))[0]; if (g) { g.s = 'INT'; g.v = CAL_INTL[wk]; rest.delete(g); } }
  }
  const left = [...rest], nLate = left.length >= 8 ? clamp(Math.round(left.length * 0.37), 3, 6) : 0;
  const late = left.slice().sort((x, y) => (CAL_WEST.includes(y.h) ? 2 : 0) + Math.random() - ((CAL_WEST.includes(x.h) ? 2 : 0) + Math.random())).slice(0, nLate);
  left.forEach(g => { g.s = late.includes(g) ? (CAL_WEST.includes(g.h) ? 'SUN4' : 'SUN4b') : 'SUN1'; });
}
const calGameOf = (se, i) => { if (!se.league) return null; const wk = se.schedule[i] && se.schedule[i].week; return wk ? (se.league.weeks[wk - 1] || []).find(g => g.u === i) || null : null; };
function calWhenOfUser(se, i) { const g = calGameOf(se, i); return g ? calWhen(se.year, se.schedule[i].week, g) : null; }
const calWhenText = w => (w ? `${calShort(w.date)} · ${w.time} ET` : '');
// the game the user just played: write the real result into the league, and make the opponent's record agree
function calAfterUserGame(season, idx, game) {
  const g = calGameOf(season, idx); if (!g) return;
  const U = season.teamId, opp = U === g.a ? g.h : g.a;
  g.w = game.w ? U : opp; const myPts = game.my, opPts = game.op;
  g.pa = U === g.a ? myPts : opPts; g.ph = U === g.a ? opPts : myPts;
  const oi = opp === g.a ? g.ia : g.ih, r = season.aiRes && season.aiRes[opp];
  if (r) season.aiRes[opp] = r.slice(0, oi) + (game.w ? '0' : '1') + r.slice(oi + 1);
  const w = calWhen(season.year, season.schedule[idx].week, g); game.date = w.date.toISOString().slice(0, 10); game.time = w.time; game.slotName = w.name;
}
// after a trade the rest of the league's calendar is rebuilt around the new team's opponents
function calRebuildAfterTrade(se, p) {
  if (!se.league) return;
  const from = p ? se.schedule[p - 1].week + 1 : 1;
  const old = se.aiRes || {}, r = calGenLeague(se, from, se.league);
  const n = {}; TEAM_LIST.forEach(t => { n[t.id] = r.league.tw[t.id].filter(w => w < from).length; });
  Object.keys(r.aiRes).forEach(id => { const prevR = old[id] || ''; r.aiRes[id] = prevR.slice(0, n[id]) + r.aiRes[id].slice(n[id]); });
  // the user's own results so far stay exactly as they were
  se.league = r.league; se.aiRes = r.aiRes;
}
// standings follow the weeks: how many games each team has played once the user has played k games
function calPlayedBy(season, id, k) {
  if (id === season.teamId) return Math.min(k, 17);
  if (k >= 17) return 17;
  const W = k ? season.schedule[k - 1].week : 0, tw = season.league.tw[id] || [];
  return tw.filter(w => w <= W).length;
}
function calCurWeek(se) {                                            // the week the user is in (last finished week + 1)
  if (se.status !== 'regular') return 18;
  const k = se.games.length; return k >= 17 ? 18 : se.schedule[k].week;
}

/* ---------- screens ---------- */
let calView = 'league', calSel = null, calSeasonIdx = null;
const calRecAt = (se, id, wk) => {                                   // record entering a week (only for weeks up to the user's next one)
  const r = se.aiRes && se.aiRes[id]; if (!r) return '';
  const n = (se.league.tw[id] || []).filter(w => w < wk).length, w = r.slice(0, n).split('').filter(x => x === '1').length;
  return `${w}-${n - w}`;
};
function calGameRow(se, g, wk, shown) {
  const U = se.teamId, mine = g.u !== undefined || g.a === U || g.h === U, done = g.w != null && wk <= shown;
  const side = id => {
    const win = done && g.w === id, rec = wk <= shown + 1 ? calRecAt(se, id, wk) : '';
    return `<div class="cal-t ${win ? 'win' : done ? 'lose' : ''}">${badge(id)}<div><b>${TEAM[id].nick}</b><small>${TEAM[id].city}${rec ? ' · ' + rec : ''}</small></div>${done ? `<em>${id === g.a ? g.pa : g.ph}</em>` : ''}</div>`;
  };
  const w = calWhen(se.year, wk, g);
  return `<div class="cal-g ${mine ? 'me' : ''}">${side(g.a)}<div class="cal-at">${done ? '<span>FINAL</span>' : `<span>@</span><small>${w.time}</small>`}</div>${side(g.h)}${g.v ? `<div class="cal-v">📍 ${g.v}</div>` : ''}</div>`;
}
function renderCalendar() {
  const se = S.seasons[calSeasonIdx == null ? S.seasons.length - 1 : calSeasonIdx], team = TEAM[se.teamId];
  if (!se.league && !se.complete) {                                   // a season saved before the calendar existed: build it now around what has been played
    const old = se.aiRes || {}, r = calGenLeague(se, 1, null); se.league = r.league; se.aiRes = r.aiRes;
    if (old[se.teamId]) se.aiRes[se.teamId] = old[se.teamId];
    se.games.forEach((g, i) => calAfterUserGame(se, i, g));
    saveGame();
  }
  if (!se.league) { setScreen(`<div class="wrap"><div class="topbar"><button class="btn btn-ghost" data-act="goHome">◂ BACK</button></div><div class="card muted">The calendar of a finished season is no longer kept.</div></div>`); return; }
  const shown = se.status === 'regular' ? (se.games.length ? se.schedule[se.games.length - 1].week : 0) : 18;
  if (calSel == null) calSel = calCurWeek(se);
  const chips = Array.from({ length: 18 }, (_, i) => i + 1).map(w => `<button class="cal-wk ${w === calSel ? 'on' : ''} ${w <= shown ? 'past' : ''} ${w === calCurWeek(se) && se.status === 'regular' ? 'now' : ''}" data-act="calWeek" data-w="${w}">${w}</button>`).join('') + `<button class="cal-wk po ${calSel === 'PO' ? 'on' : ''}" data-act="calWeek" data-w="PO">PLAYOFFS</button>`;
  let body = '';
  if (calView === 'mine') body = calMine(se);
  else if (calSel === 'PO') body = calPlayoffs(se);
  else {
    const wk = calSel, games = (se.league.weeks[wk - 1] || []).slice().sort((a, b) => calWhen(se.year, wk, a).min - calWhen(se.year, wk, b).min);
    const groups = []; games.forEach(g => { const w = calWhen(se.year, wk, g), key = g.s === 'SUN4' || g.s === 'SUN4b' ? 'SUN4' : g.s === 'MNE' || g.s === 'MNF' ? 'MNF' + g.s : g.s; let grp = groups.find(x => x.key === key && (g.s === 'SUN1' || g.s === 'SUN4' || g.s === 'SUN4b' || g.s === 'INT' || true)); if (!grp) { grp = { key, w, g: [] }; groups.push(grp); } grp.g.push(g); });
    const day = [];
    body = groups.map(gr => {
      const dkey = calLong(gr.w.date), head = day.includes(dkey) ? '' : `<div class="cal-day">${dkey}</div>`; day.push(dkey);
      const time = gr.key === 'SUN4' ? '4:05 / 4:25 PM ET' : gr.w.time + ' ET';
      return `${head}<div class="cal-slot"><span class="cal-tag ${/NIGHT/.test(gr.w.tag) ? 'prime' : ''}">${gr.w.name.toUpperCase()}</span><span class="cal-time">${time}</span></div><div class="cal-list">${gr.g.map(g => calGameRow(se, g, wk, shown)).join('')}</div>`;
    }).join('');
    const playing = new Set(games.flatMap(g => [g.a, g.h])), byes = TEAM_LIST.map(t => t.id).filter(id => !playing.has(id));
    if (byes.length) body += `<div class="cal-bye"><span>ON BYE</span>${byes.map(id => `<i class="${id === se.teamId ? 'me' : ''}">${badge(id)}${TEAM[id].nick}</i>`).join('')}</div>`;
    const thu = calThursday(se.year, wk);
    body = `<div class="cal-range">WEEK ${wk} · ${calShort(thu)} – ${calShort(calAdd(thu, wk === 18 ? 3 : 4))}</div>` + body;
  }
  setScreen(`<div class="wrap" style="${themeVars(se.teamId)}">
    <div class="topbar"><button class="btn btn-ghost" data-act="goHome">◂ BACK</button><span class="eyebrow">${se.year} · NFL CALENDAR</span></div>
    <h2 class="h-xl title-logo">${nflLogo('inline')}SCHEDULE</h2>
    <div class="tabs"><button class="tab ${calView === 'league' ? 'on' : ''}" data-act="calView" data-v="league">ALL GAMES</button><button class="tab ${calView === 'mine' ? 'on' : ''}" data-act="calView" data-v="mine">${esc(team.nick.toUpperCase())}</button></div>
    ${calView === 'league' ? `<div class="cal-weeks">${chips}</div>` : ''}
    <div class="cal-body">${body}</div>
    <div class="muted small st-note">Dates and kickoff times follow the real NFL calendar (Eastern time). Results of the other teams appear as your season moves forward.</div></div>`);
  const on = document.querySelector('.cal-wk.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
}
function calMine(se) {
  const rows = [];
  for (let wk = 1; wk <= 18; wk++) {
    const i = se.schedule.findIndex(x => x.week === wk);
    if (i < 0) { rows.push(`<div class="cal-m bye"><b>${wk}</b><div class="cal-md"><span>${calShort(calThursday(se.year, wk))}</span></div><div class="cal-mo"><i>BYE WEEK</i></div></div>`); continue; }
    const s = se.schedule[i], g = se.games[i], lg = calGameOf(se, i), w = lg ? calWhen(se.year, wk, lg) : null, opp = TEAM[s.oppId];
    rows.push(`<div class="cal-m ${g ? (g.w ? 'w' : 'l') : ''}"><b>${wk}</b><div class="cal-md"><span>${w ? calShort(w.date) : ''}</span><small>${w ? w.time + ' ET' : ''}</small></div><div class="cal-mo">${badge(s.oppId)}<div><b>${s.home ? 'vs' : '@'} ${opp.name}</b><small>${w ? w.name : ''}</small></div></div><div class="cal-mr">${g ? `${g.w ? 'W' : 'L'} ${g.my}-${g.op}` : ''}</div></div>`);
  }
  return `<div class="cal-mine">${rows.join('')}</div>`;
}
function calPlayoffs(se) {
  const rounds = [['WC', 'Wild Card'], ['DIV', 'Divisional Round'], ['CONF', 'Conference Championship'], ['SB', 'Super Bowl']];
  return `<div class="cal-mine">${rounds.map(([k, n], i) => {
    const w = calPlayoffWhen(se, k);
    const rd = se.po && se.po.rounds.find(r => r.name === ROUND_NAME[k]);
    return `<div class="cal-m ${rd ? (rd.res === 'WIN' ? 'w' : rd.res === 'LOSS' ? 'l' : '') : ''}"><b>${k}</b><div class="cal-md"><span>${calShort(w.date)}</span><small>${w.time} ET</small></div><div class="cal-mo"><div><b>${n}</b><small>${w.name}${rd && rd.opp ? ' · vs ' + TEAM[rd.opp].name : ''}</small></div></div><div class="cal-mr">${rd ? (rd.res === 'BYE' ? 'BYE' : `${rd.res === 'WIN' ? 'W' : 'L'} ${rd.score || ''}`) : ''}</div></div>`;
  }).join('')}</div><div class="muted small st-note">The playoff field is set when the 17 games are over.</div>`;
}
Object.assign(actions, {
  viewCalendar: () => { calSeasonIdx = null; calSel = null; renderCalendar(); },
  calView: (d) => { calView = d.v; renderCalendar(); },
  calWeek: (d) => { calSel = d.w === 'PO' ? 'PO' : parseInt(d.w, 10); calView = 'league'; renderCalendar(); },
});

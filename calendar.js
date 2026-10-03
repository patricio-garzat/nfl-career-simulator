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
function calSlotInfo(date, m) {                                       // window name from the weekday and kickoff time
  const dow = date.getUTCDay(), mo = date.getUTCMonth(), dd = date.getUTCDate();
  if (mo === 11 && dd === 25) return { name: 'Christmas Day', tag: 'CHRISTMAS' };
  if (dow === 4 && mo === 10 && dd >= 22 && dd <= 28) return { name: m >= 19 * 60 + 30 ? 'Thanksgiving Night' : 'Thanksgiving', tag: 'THANKSGIVING' };
  if (dow === 5 && mo === 10 && dd >= 23 && dd <= 29) return { name: 'Black Friday', tag: 'BLACK FRIDAY' };
  if (dow === 3) return { name: 'Wednesday Night', tag: 'WED NIGHT' };
  if (dow === 4) return { name: 'Thursday Night', tag: 'THU NIGHT' };
  if (dow === 5) return { name: m >= 17 * 60 ? 'Friday Night' : 'Friday', tag: 'FRIDAY NIGHT' };
  if (dow === 6) return m >= 19 * 60 ? { name: 'Saturday Night', tag: 'SAT NIGHT' } : { name: 'Saturday', tag: 'SATURDAY' };
  if (dow === 0) return m < 12 * 60 ? { name: 'Sunday Morning · International', tag: 'SUNDAY' } : m < 15 * 60 ? { name: 'Sunday', tag: 'SUNDAY' } : m < 19 * 60 ? { name: 'Sunday Late', tag: 'SUNDAY' } : { name: 'Sunday Night', tag: 'SUN NIGHT' };
  if (dow === 1) return { name: 'Monday Night', tag: 'MON NIGHT' };
  return { name: 'Tuesday', tag: 'TUESDAY' };
}
function calWhen(year, wk, g) {
  if (g.d) {                                                          // a real kickoff (2026): exact date and Eastern time
    const date = new Date(g.d + 'T00:00:00Z'), si = calSlotInfo(date, g.m);
    return { date, time: calTimeStr(g.m), name: si.name, tag: si.tag, min: Math.floor(date.getTime() / 86400000) * 1440 + g.m, n: g.n || '' };
  }
  const s = CAL_SLOTS[g.s] || CAL_SLOTS.SUN1, date = calAdd(calThursday(year, wk), s.off);
  let min = s.min; if (g.s === 'TNF' && wk === 1) min = 20 * 60 + 20;
  return { date, time: calTimeStr(min), name: s.name, tag: s.tag, min: s.off * 1440 + min, n: '' };
}
// the real regular season of a team (week, opponent, home or away) when the year has a real schedule
function calRealSchedule(teamId, year) {
  let real = typeof NFL_REAL !== 'undefined' && NFL_REAL[year];
  if (!real && year > 2026) {                                           // the formula schedule of a new season, or the one already stored in the current season
    const cur = S.seasons.length ? S.seasons[S.seasons.length - 1] : null;
    if (cur && cur.year === year && cur.league && cur.league.formula) real = cur.league.weeks.map(w => w.map(g => [g.a, g.h]));
    else if (!cur || cur.year !== year) real = calFormulaSeason(year);
  }
  if (!real) return null;
  const out = []; real.forEach((games, i) => games.forEach(([a, h]) => { if (a === teamId) out.push({ week: i + 1, oppId: h, home: false }); else if (h === teamId) out.push({ week: i + 1, oppId: a, home: true }); }));
  out.real = true; return out;
}
// playoff dates: Wild Card weekend (Sat-Mon), Divisional (Sat-Sun), Conference Championships (Sun), Super Bowl (two Sundays later)
function calPlayoffWhen(season, short) {
  const y = season.year, po = season.po || {}, afc = po.conf === 'AFC', seed = po.mySeed || 4;
  const sun = n => calAdd(calThursday(y, n), 3), mon = n => calAdd(calThursday(y, n), 4);
  if (short === 'WC') {
    const k = { 2: 0, 7: 0, 3: 1, 6: 1, 4: 2, 5: 2 }[seed] || 0;
    const t = afc ? [[sun(19), 13 * 60, 'Sunday'], [sun(19), 16 * 60 + 30, 'Sunday'], [sun(19), 20 * 60, 'Sunday Night']][k] : [[sun(19), 13 * 60, 'Sunday'], [sun(19), 16 * 60 + 30, 'Sunday'], [mon(19), 20 * 60 + 15, 'Monday Night']][k];
    return { date: t[0], time: calTimeStr(t[1]), name: t[2] };
  }
  if (short === 'DIV') { const t = [[sun(20), 13 * 60, 'Sunday'], [sun(20), 16 * 60 + 30, 'Sunday'], [sun(20), 20 * 60, 'Sunday Night'], [mon(20), 20 * 60 + 15, 'Monday Night']][(seed + (afc ? 0 : 2)) % 4]; return { date: t[0], time: calTimeStr(t[1]), name: t[2] }; }
  if (short === 'CONF') return { date: sun(21), time: calTimeStr(afc ? 15 * 60 : 18 * 60 + 30), name: afc ? 'Sunday' : 'Sunday Night' };
  return { date: calAdd(sun(21), 14), time: calTimeStr(18 * 60 + 30), name: 'Super Bowl Sunday' };
}


/* ---------- the NFL scheduling formula (used from 2027 on; 2026 is the real schedule) ----------
   17 games = 6 division games (home and away vs each rival) + 4 vs one division of the same conference (3-year rotation, home/away split 2-2)
   + 4 vs one division of the other conference (4-year rotation) + 2 vs the same-place finishers (last year's standings) of the two remaining divisions of the conference
   + 1 vs the same-place finisher of another division of the other conference (the "17th game", home team alternates by year).
   Then the 272 games are dealt into 18 weeks: every team plays each week except one bye (weeks 5-14), and Week 18 is all division games. */
const CAL_DIVS = ['East', 'North', 'South', 'West'];
const CAL_INTRA_CYCLE = [[['East', 'West'], ['North', 'South']], [['East', 'North'], ['South', 'West']], [['East', 'South'], ['North', 'West']]];   // 2026 = first entry, then it keeps rotating
const CAL_NFC_ORDER = ['North', 'South', 'East', 'West'];             // 2026: AFC East-NFC North, AFC North-NFC South, AFC South-NFC East, AFC West-NFC West; every year the NFC side shifts one place
let CAL_FORMULA = {};
function calPrevRank(year) {                                          // place (0 = first) of every team in its division last season
  const prev = S.seasons.find(s => s.year === year - 1 && s.wins), rank = {}, mem = (c, d) => TEAM_LIST.filter(t => t.conf === c && t.div === d);
  ['AFC', 'NFC'].forEach(c => CAL_DIVS.forEach(d => {
    const m = mem(c, d).map(t => t.id).sort((a, b) => ((prev ? prev.wins[b] - prev.wins[a] : 0) || (S.teamRatings[b] - S.teamRatings[a]) + (rnd() - 0.5) * 0.01));
    m.forEach((id, i) => { rank[id] = i; });
  }));
  return rank;
}
function calFormulaGames(year) {                                      // the 272 matchups [away, home] of the season
  const k = year - 2026, rank = calPrevRank(year), games = [], mem = (c, d) => TEAM_LIST.filter(t => t.conf === c && t.div === d).map(t => t.id);
  const at = (c, d, r) => mem(c, d).find(id => rank[id] === r);
  const pairs = CAL_INTRA_CYCLE[((k % 3) + 3) % 3];
  ['AFC', 'NFC'].forEach(c => {
    CAL_DIVS.forEach(d => { const m = mem(c, d); for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) { games.push([m[i], m[j]]); games.push([m[j], m[i]]); } });   // division: home and away
    pairs.forEach(([x, y]) => {                                       // the 4-game block with a division of the same conference (each team: 2 home, 2 away)
      mem(c, x).forEach((a, i) => mem(c, y).forEach((b, j) => { if ((i + j + k) % 2 === 0) games.push([a, b]); else games.push([b, a]); }));
      if (x !== pairs[0][0]) return;                                  // same-place games are listed once per conference (from the first pair of divisions)
      const others = CAL_DIVS.filter(d => d !== x && d !== y), z = others[0], w = others[1];
      for (let r = 0; r < 4; r++) {                                   // same-place games: x hosts z, w hosts x, z hosts y, y hosts w (swapped every other year)
        const X = at(c, x, r), Y = at(c, y, r), Z = at(c, z, r), W = at(c, w, r), sw = k % 2 === 1;
        const add = (host, vis) => games.push(sw ? [host, vis] : [vis, host]);
        add(X, Z); add(W, X); add(Z, Y); add(Y, W);
      }
    });
  });
  ['East', 'North', 'South', 'West'].forEach((ad, i) => {             // AFC division i vs NFC division (i + k) of the rotation: 4 games per team
    const nd = CAL_NFC_ORDER[(i + k) % 4], nd17 = CAL_NFC_ORDER[(i + k + 3) % 4];
    mem('AFC', ad).forEach((a, ai) => mem('NFC', nd).forEach((b, bj) => { if ((ai + bj + k) % 2 === 0) games.push([b, a]); else games.push([a, b]); }));
    for (let r = 0; r < 4; r++) { const a = at('AFC', ad, r), b = at('NFC', nd17, r); games.push(k % 2 === 0 ? [b, a] : [a, b]); }   // 17th game
  });
  return games;
}
// one week: a perfect matching among the teams that play, using only games that are still unplayed (depth-first with a node budget)
function calPickWeek(playing, adj, lastWeekPairs) {
  const free = new Set(playing), chosen = []; let nodes = 0;
  const other = (g, t) => (g.a === t ? g.h : g.a);
  const opts = t => adj[t].filter(g => !g.wk && free.has(other(g, t)));
  const rec = () => {
    if (!free.size) return true;
    if (++nodes > 4000) return false;
    let best = null, bc = 1e9; free.forEach(t => { const n = opts(t).length; if (n < bc) { bc = n; best = t; } });
    if (bc === 0) return false;
    const cand = shuffle(opts(best)).sort((x, y) => (lastWeekPairs.has(x.a + x.h) || lastWeekPairs.has(x.h + x.a) ? 1 : 0) - (lastWeekPairs.has(y.a + y.h) || lastWeekPairs.has(y.h + y.a) ? 1 : 0));
    for (const g of cand) {
      const o = other(g, best); free.delete(best); free.delete(o); chosen.push(g);
      if (rec()) return true;
      chosen.pop(); free.add(best); free.add(o);
      if (nodes > 4000) return false;
    }
    return false;
  };
  return rec() ? chosen.slice() : null;
}
// deals the matchups into weeks; returns 18 arrays of [away, home] or null if this attempt dead-ends
function calDealWeeks(matchups) {
  const ids = TEAM_LIST.map(t => t.id), games = matchups.map(([a, h]) => ({ a, h, wk: 0 })), adj = {}; ids.forEach(i => { adj[i] = []; });
  games.forEach(g => { adj[g.a].push(g); adj[g.h].push(g); });
  // byes: 32 teams over weeks 5..14
  const quota = [2, 2, 4, 4, 4, 4, 4, 4, 2, 2], bye = {}, order = shuffle(ids); let p = 0; quota.forEach((q, i) => { for (let n = 0; n < q; n++) bye[order[p++]] = i + 5; });
  // week 18: division games only (a perfect matching inside every division)
  const dv = id => TEAM[id].conf + TEAM[id].div;
  ['AFC', 'NFC'].forEach(c => CAL_DIVS.forEach(d => {
    const m = TEAM_LIST.filter(t => t.conf === c && t.div === d).map(t => t.id), pairing = shuffle([[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]])[0];
    pairing.forEach(([i, j]) => { const g = shuffle(adj[m[i]].filter(x => !x.wk && ((x.a === m[i] && x.h === m[j]) || (x.a === m[j] && x.h === m[i]))))[0]; g.wk = 18; });
  }));
  let last = new Set();
  for (let wk = 1; wk <= 17; wk++) {
    const playing = ids.filter(i => bye[i] !== wk), pick = calPickWeek(playing, adj, last);
    if (!pick) return null;
    pick.forEach(g => { g.wk = wk; });
    last = new Set(pick.map(g => g.a + g.h));
  }
  const weeks = Array.from({ length: 18 }, () => []); games.forEach(g => weeks[g.wk - 1].push([g.a, g.h]));
  return weeks;
}
function calFormulaSeason(year) {
  if (CAL_FORMULA[year]) return CAL_FORMULA[year];
  const matchups = calFormulaGames(year);
  for (let tries = 0; tries < 400; tries++) { const w = calDealWeeks(matchups); if (w) { CAL_FORMULA[year] = w; return w; } }
  return null;                                                         // (never seen) -> the random generator below takes over
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
  const simRes = g => {                                                   // result of a game that does not involve the user, or the pre-simulated winner of one that does
    const pa = logistic(0.064 * (rt(g.a) - (rt(g.h) + 2.2))), awayWins = rnd() < pa, win = awayWins ? g.a : g.h, lose = awayWins ? g.h : g.a;
    const W = clamp(Math.round(gauss(26 + (rt(win) - 72) * 0.2, 6)), 10, 48); let L = clamp(Math.round(gauss(17 + (rt(lose) - 72) * 0.2, 6)), 0, 44); if (L >= W) L = Math.max(0, W - randInt(1, 10));
    if (g.u !== undefined) { g.pw = win; } else { g.w = win; g.pa = awayWins ? W : L; g.ph = awayWins ? L : W; }
  };
  const real = typeof NFL_REAL !== 'undefined' && NFL_REAL[season.year];
  if (real) {                                                            // the real season: matchups, dates and times exactly as scheduled
    for (let wk = fromWeek; wk <= 18; wk++) {
      const games = (real[wk - 1] || []).map(([a, h, d, m, n, v]) => ({ a, h, d, m, n, ...(v ? { v } : {}), s: 'REAL', w: null, pa: 0, ph: 0 }));
      games.forEach(g => { const ui = season.schedule.findIndex(x => x.week === wk && ((g.a === U && g.h === x.oppId && !x.home) || (g.h === U && g.a === x.oppId && x.home))); if (ui >= 0) g.u = ui; });
      games.forEach(simRes); weeks.push(games);
    }
  }
  const formNew = !real && !prev && typeof CAL_FORMULA !== 'undefined' && CAL_FORMULA[season.year], formPrev = !real && prev && prev.formula;
  const tagUser = (g, wk) => { const ui = season.schedule.findIndex(x => x.week === wk && ((g.a === U && g.h === x.oppId && !x.home) || (g.h === U && g.a === x.oppId && x.home))); if (ui >= 0) g.u = ui; };
  if (formNew) {                                                         // the NFL formula (2027 on): matchups from last year's standings and the rotations; slots handed out like any other season
    const prime = {}; ids.forEach(i => { prime[i] = 0; }); let pMon = new Set(), pThu = new Set(), pPrime = new Set();
    for (let wk = 1; wk <= 18; wk++) {
      const games = formNew[wk - 1].map(([a, h]) => ({ a, h, s: 'SUN1', w: null, pa: 0, ph: 0 }));
      games.forEach(g => tagUser(g, wk)); games.forEach(simRes);
      calAssign(games, wk, season.year, { prevMon: pMon, prevThu: pThu, prime, prevPrime: pPrime }, rt, U);
      pPrime = new Set(games.filter(g => ['TNF', 'SNF', 'MNF', 'MNE'].includes(g.s)).flatMap(g => [g.a, g.h]));
      pMon = new Set(games.filter(g => g.s === 'MNF' || g.s === 'MNE').flatMap(g => [g.a, g.h])); pThu = new Set(games.filter(g => g.s === 'TNF').flatMap(g => [g.a, g.h]));
      games.forEach(g => { if (['TNF', 'SNF', 'MNF', 'MNE'].includes(g.s)) { prime[g.a]++; prime[g.h]++; } });
      weeks.push(games);
    }
  } else if (formPrev) {                                                 // after a trade: same matchups and windows, only the user's games change and the unplayed results are redrawn
    for (let wk = fromWeek; wk <= 18; wk++) {
      const games = prev.weeks[wk - 1].map(g => { const n = { ...g, w: null, pa: 0, ph: 0 }; delete n.u; delete n.pw; return n; });
      games.forEach(g => tagUser(g, wk)); games.forEach(simRes); weeks.push(games);
    }
  }
  const skipGen = real || formNew || formPrev;
  const BYE_T = [2, 2, 4, 4, 4, 4, 4, 4, 2, 2];                           // byes in weeks 5..14
  let genPrev = new Set();
  const prime = {}; ids.forEach(i => { prime[i] = 0; });
  weeks.forEach(wk => wk.forEach(g => { if (['TNF', 'SNF', 'MNF', 'MNE'].includes(g.s)) { prime[g.a]++; prime[g.h]++; } }));
  let prevThu = new Set(prev && weeks.length ? weeks[weeks.length - 1].filter(g => g.s === 'TNF').flatMap(g => [g.a, g.h]) : []);
  let prevMon = new Set(prev && weeks.length ? weeks[weeks.length - 1].filter(g => g.s === 'MNF' || g.s === 'MNE').flatMap(g => [g.a, g.h]) : []);
  for (let wk = skipGen ? 19 : fromWeek; wk <= 18; wk++) {
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
    games.forEach(simRes);
    calAssign(games, wk, season.year, { prevMon, prevThu, prime, prevPrime: genPrev }, rt, U);
    genPrev = new Set(games.filter(g => ['TNF', 'SNF', 'MNF', 'MNE'].includes(g.s)).flatMap(g => [g.a, g.h]));
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
  return { league: { weeks, tw, ...((formNew || formPrev) ? { formula: true } : {}) }, aiRes };
}
// give every game of a week its window: primetime slots go to the juiciest games, Sunday is split into early and late, Thursday teams cannot have played on Monday night
function calAssign(gs, wk, year, ctx, rt, U) {
  const { prevMon, prevThu, prime } = ctx, prevPrime = ctx.prevPrime || new Set();
  const div = id => TEAM[id].conf + TEAM[id].div, sc = new Map();
  gs.forEach(g => sc.set(g, rt(g.a) + rt(g.h) + (div(g.a) === div(g.h) ? 6 : 0) + (g.a === U || g.h === U ? (rt(U) - 70) * 0.6 + rr(0, 8) : 0) + rr(0, 10) - (prime[g.a] >= 4 ? 25 : 0) - (prime[g.h] >= 4 ? 25 : 0) - (prevPrime.has(g.a) ? 22 : 0) - (prevPrime.has(g.h) ? 22 : 0)));
  const sorted = gs.slice().sort((x, y) => sc.get(y) - sc.get(x)), rest = new Set(gs);
  const take = (slot, pred) => { const g = sorted.find(x => rest.has(x) && (!pred || pred(x))); if (g) { g.s = slot; rest.delete(g); } return g; };
  const thu = calThursday(year, wk), thanks = thu.getUTCMonth() === 10 && thu.getUTCDate() >= 22 && thu.getUTCDate() <= 28;
  if (wk === 18) { take('SNF'); }                                    // the finale is all Sunday (no Saturday games)
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
  se.league = r.league; se.aiRes = r.aiRes; se.aiOff = n[se.teamId] - p;   // the new team's own earlier games come before the user's in its string of results
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
  return `<div class="cal-g ${mine ? 'me' : ''}">${side(g.a)}<div class="cal-at">${done ? '<span>FINAL</span>' : `<span>@</span><small>${w.time}</small>`}${w.n ? `<i class="cal-net">${w.n}</i>` : ''}</div>${side(g.h)}${g.v ? `<div class="cal-v">📍 ${g.v}</div>` : ''}</div>`;
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
    const groups = []; games.forEach(g => { const w = calWhen(se.year, wk, g), key = w.date.toISOString().slice(0, 10) + '|' + w.name; let grp = groups.find(x => x.key === key); if (!grp) { grp = { key, w, g: [], times: [] }; groups.push(grp); } grp.g.push(g); if (!grp.times.includes(w.time)) grp.times.push(w.time); });
    const day = [];
    body = groups.map(gr => {
      const dkey = calLong(gr.w.date), head = day.includes(dkey) ? '' : `<div class="cal-day">${dkey}</div>`; day.push(dkey);
      const time = gr.times.join(' / ') + ' ET';
      return `${head}<div class="cal-slot"><span class="cal-tag ${/NIGHT|THANKS|CHRISTMAS|BLACK/.test(gr.w.tag) ? 'prime' : ''}">${gr.w.name.toUpperCase()}</span><span class="cal-time">${time}</span></div><div class="cal-list">${gr.g.map(g => calGameRow(se, g, wk, shown)).join('')}</div>`;
    }).join('');
    const playing = new Set(games.flatMap(g => [g.a, g.h])), byes = TEAM_LIST.map(t => t.id).filter(id => !playing.has(id));
    if (byes.length) body += `<div class="cal-bye"><span>ON BYE</span>${byes.map(id => `<i class="${id === se.teamId ? 'me' : ''}">${badge(id)}${TEAM[id].nick}</i>`).join('')}</div>`;
    const dts = games.map(g => calWhen(se.year, wk, g).date.getTime()), lo = new Date(Math.min(...dts)), hi = new Date(Math.max(...dts));
    body = `<div class="cal-range">WEEK ${wk} · ${calShort(lo)} – ${calShort(hi)}</div>` + body;
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

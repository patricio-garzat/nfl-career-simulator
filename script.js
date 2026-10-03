/* =====================================================================
   NFL CAREER SIMULATOR — script.js
   Vanilla JS, no backend. Whole career is stored in localStorage.

   Sections
   0. Utilities            6. Draft & rookie contract
   1. Static data          7. Season engine (schedule, games, playoffs)
   2. Position configs     8. Awards & player development
   3. State & saving       9. Free agency
   4. Fantasy & ratings    10. UI helpers (modal, splash, confetti)
   5. Player generation    11. Screens  12. Actions & boot
   ===================================================================== */
'use strict';

/* ---------------------------------------------------------------------
   0. UTILITIES
   --------------------------------------------------------------------- */
const rnd = Math.random;
const randInt = (a, b) => Math.floor(rnd() * (b - a + 1)) + a;
const rr = (a, b) => a + rnd() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const logistic = x => 1 / (1 + Math.exp(-x));
const r1 = n => Math.round(n * 10) / 10;
const fmt = n => Number(n).toLocaleString('en-US');
const fmt1 = n => (Math.round(n * 10) / 10).toFixed(1);
const fmtN = n => (typeof n === 'number' ? (Number.isInteger(n) ? fmt(n) : fmt1(n)) : n);
const sum = (T, ...k) => k.reduce((a, x) => a + (T[x] || 0), 0);
const uid = () => Math.random().toString(36).slice(2, 8);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function money(m) { m = r1(m); return '$' + (Number.isInteger(m) ? m : m.toFixed(1)) + 'M'; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Standard normal random (Box–Muller)
function gauss(mean = 0, sd = 1) {
  let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
// Poisson sample (Knuth for small λ, normal approximation for large λ)
function poisson(l) {
  if (l <= 0) return 0;
  if (l > 30) return Math.max(0, Math.round(gauss(l, Math.sqrt(l))));
  const L = Math.exp(-l); let k = 0, p = 1;
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
}
const binom = (n, p) => { let c = 0; for (let i = 0; i < n; i++) if (rnd() < p) c++; return c; };
const expo = mean => -Math.log(1 - rnd()) * mean;
// Sum of n plays whose yardage is exponentially distributed (many short gains, a few big ones)
function yardsFor(n, mean, cap = 80) {
  let y = 0;
  for (let i = 0; i < n; i++) y += Math.min(cap, Math.round(expo(mean * 0.9) + mean * 0.1));
  return y;
}
function interp(x, table) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1], [x1, y1] = table[i];
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

/* ---------------------------------------------------------------------
   1. STATIC DATA
   --------------------------------------------------------------------- */
const SAVE_KEY = 'nfl_career_sim_v1';
const START_YEAR = 2027;

// id, city, nickname, primary, secondary, conference, division, base strength (0-100)
const TEAM_DATA = [
  ['BUF', 'Buffalo', 'Bills', '#00338D', '#C60C30', 'AFC', 'East', 82],
  ['MIA', 'Miami', 'Dolphins', '#008E97', '#FC4C02', 'AFC', 'East', 73],
  ['NE', 'New England', 'Patriots', '#002244', '#C60C30', 'AFC', 'East', 63],
  ['NYJ', 'New York', 'Jets', '#125740', '#FFFFFF', 'AFC', 'East', 67],
  ['BAL', 'Baltimore', 'Ravens', '#241773', '#9E7C0C', 'AFC', 'North', 83],
  ['CIN', 'Cincinnati', 'Bengals', '#FB4F14', '#000000', 'AFC', 'North', 78],
  ['CLE', 'Cleveland', 'Browns', '#311D00', '#FF3C00', 'AFC', 'North', 63],
  ['PIT', 'Pittsburgh', 'Steelers', '#FFB612', '#101820', 'AFC', 'North', 74],
  ['HOU', 'Houston', 'Texans', '#03202F', '#A71930', 'AFC', 'South', 78],
  ['IND', 'Indianapolis', 'Colts', '#002C5F', '#A2AAAD', 'AFC', 'South', 70],
  ['JAX', 'Jacksonville', 'Jaguars', '#006778', '#D7A22A', 'AFC', 'South', 69],
  ['TEN', 'Tennessee', 'Titans', '#0C2340', '#4B92DB', 'AFC', 'South', 64],
  ['DEN', 'Denver', 'Broncos', '#FB4F14', '#002244', 'AFC', 'West', 75],
  ['KC', 'Kansas City', 'Chiefs', '#E31837', '#FFB81C', 'AFC', 'West', 84],
  ['LV', 'Las Vegas', 'Raiders', '#000000', '#A5ACAF', 'AFC', 'West', 65],
  ['LAC', 'Los Angeles', 'Chargers', '#0080C6', '#FFC20E', 'AFC', 'West', 76],
  ['DAL', 'Dallas', 'Cowboys', '#003594', '#869397', 'NFC', 'East', 73],
  ['NYG', 'New York', 'Giants', '#0B2265', '#A71930', 'NFC', 'East', 62],
  ['PHI', 'Philadelphia', 'Eagles', '#004C54', '#A5ACAF', 'NFC', 'East', 83],
  ['WAS', 'Washington', 'Commanders', '#5A1414', '#FFB612', 'NFC', 'East', 75],
  ['CHI', 'Chicago', 'Bears', '#0B162A', '#C83803', 'NFC', 'North', 68],
  ['DET', 'Detroit', 'Lions', '#0076B6', '#B0B7BC', 'NFC', 'North', 81],
  ['GB', 'Green Bay', 'Packers', '#203731', '#FFB612', 'NFC', 'North', 78],
  ['MIN', 'Minnesota', 'Vikings', '#4F2683', '#FFC62F', 'NFC', 'North', 77],
  ['ATL', 'Atlanta', 'Falcons', '#A71930', '#000000', 'NFC', 'South', 71],
  ['CAR', 'Carolina', 'Panthers', '#0085CA', '#101820', 'NFC', 'South', 62],
  ['NO', 'New Orleans', 'Saints', '#D3BC8D', '#101820', 'NFC', 'South', 66],
  ['TB', 'Tampa Bay', 'Buccaneers', '#D50A0A', '#34302B', 'NFC', 'South', 72],
  ['ARI', 'Arizona', 'Cardinals', '#97233F', '#000000', 'NFC', 'West', 68],
  ['LAR', 'Los Angeles', 'Rams', '#003594', '#FFA300', 'NFC', 'West', 77],
  ['SF', 'San Francisco', '49ers', '#AA0000', '#B3995D', 'NFC', 'West', 80],
  ['SEA', 'Seattle', 'Seahawks', '#002244', '#69BE28', 'NFC', 'West', 73],
];
const TEAM = {};
const TEAM_LIST = TEAM_DATA.map(([id, city, nick, c1, c2, conf, div, base]) => {
  const t = { id, city, nick, name: `${city} ${nick}`, c1, c2, conf, div, base };
  TEAM[id] = t; return t;
});

// College name, talent bonus applied to the rookie's starting overall
// COLLEGES / COLLEGE_INFO / collegeLogo come from colleges.js (all NCAA programs with their official ESPN logos)
const FIRST = ['Marcus', 'Tyrese', 'Jalen', 'Devon', 'Caleb', 'Malik', 'Trevon', 'Isaiah', 'Cole', 'Darius', 'Kyle', 'Jordan', 'Brandon', 'Xavier', 'Elijah', 'Micah', 'Noah', 'Landon', 'Terrell', 'Zach'];
const LAST = ['Williams', 'Carter', 'Brooks', 'Henderson', 'Mitchell', 'Reed', 'Coleman', 'Foster', 'Hayes', 'Jenkins', 'Bryant', 'Washington', 'Sanders', 'Price', 'Rivera', 'Simmons', 'Griffin', 'Patterson', 'Hughes', 'Powell'];
const DEV = { Normal: 1.0, Impact: 1.2, Star: 1.4, Superstar: 1.65 };

/* ---------------------------------------------------------------------
   2. POSITION CONFIGS
   Each position defines: attributes (name, OVR weight, is-physical),
   stat keys, game-log columns, fantasy benchmarks, award thresholds,
   and a per-game stat generator.
   --------------------------------------------------------------------- */
const ST = (...defs) => defs.map(d => { const [k, label, short] = d.split(':'); return { k, label, short }; });
const RATING = [
  { k: 'TERRIBLE', icon: '💀' }, { k: 'POOR', icon: '👎' }, { k: 'AVERAGE', icon: '➖' },
  { k: 'GOOD', icon: '👍' }, { k: 'GREAT', icon: '🔥' }, { k: 'ELITE', icon: '⭐' },
];
const ROLES = { FR: 'Franchise Player', ST: 'Starter', RT: 'Rotational Player', BU: 'Backup' };
const ROUND_NAME = { WC: 'Wild Card Round', DIV: 'Divisional Round', CONF: 'Conference Championship', SB: 'Super Bowl' };

const sg = s => s || 0;
// Shared column builders for the game-log table
const colSum = (h, f) => ({ h, n: 1, g: g => f(g.s), t: T => f(T) });

const POS = {
  QB: {
    name: 'Quarterback', side: 'O',
    attrs: [['Throw Power', .15, 1], ['Accuracy', .22, 0], ['Deep Accuracy', .14, 0], ['Short Accuracy', .20, 0], ['Mobility', .09, 1], ['Awareness', .20, 0]],
    stats: ST('passAtt:Pass Attempts:ATT', 'passComp:Completions:CMP', 'passYds:Passing Yards:PYD', 'passTD:Passing TD:PTD', 'int:Interceptions:INT', 'rushAtt:Rush Attempts:CAR', 'rushYds:Rush Yards:RYD', 'rushTD:Rush TD:RTD', 'fumbles:Fumbles:FUM', 'twoPt:2-Pt Conversions:2PT'),
    bench: 17, thr: [8, 13.5, 20.5, 27, 34], impact: 3.5, impR: .17, awd: { pb: 20.5, ap2: 22.5, ap1: 24, lead: 26 },
    leaders: [['passYds', 'Passing Yards', 5100], ['passTD', 'Passing TDs', 38]],
    cols: [
      { h: 'C/ATT', g: g => `${g.s.passComp}/${g.s.passAtt}`, t: T => `${fmt(T.passComp)}/${fmt(T.passAtt)}` },
      colSum('YDS', s => s.passYds), colSum('TD', s => s.passTD), colSum('INT', s => s.int), colSum('RUSH', s => s.rushYds),
    ],
    extra: s => [['Completion %', s.passAtt ? fmt1(100 * s.passComp / s.passAtt) + '%' : '—']],
    summary: T => [{ l: 'YDS', v: fmt(sum(T, 'passYds', 'rushYds')) }, { l: 'TD', v: sum(T, 'passTD', 'rushTD') }],
    career: T => [{ l: 'Career Yards', v: fmt(sum(T, 'passYds', 'rushYds')) }, { l: 'Career TD', v: sum(T, 'passTD', 'rushTD') }],
    line: T => [{ v: T.passYds, l: 'PASS YDS' }, { v: T.passTD, l: 'PASS TD' }, { v: T.int, l: 'INT' }],
    careerLines: T => [{ v: T.passYds, l: 'Passing Yards' }, { v: T.passTD, l: 'Passing Touchdowns' }, { v: T.rushYds, l: 'Rushing Yards' }],
    gen: genQB,
  },
  RB: {
    name: 'Running Back', side: 'O',
    attrs: [['Speed', .20, 1], ['Acceleration', .15, 1], ['Carrying', .15, 0], ['Vision', .20, 0], ['Elusiveness', .20, 1], ['Strength', .10, 1]],
    stats: ST('rushAtt:Rush Attempts:CAR', 'rushYds:Rush Yards:RYD', 'rushTD:Rush TD:RTD', 'targets:Targets:TGT', 'rec:Receptions:REC', 'recYds:Receiving Yards:RCY', 'recTD:Receiving TD:RCT', 'fumbles:Fumbles:FUM', 'twoPt:2-Pt Conversions:2PT'),
    bench: 12.5, thr: [3.5, 7.5, 14, 20, 28], impact: 1.5, impR: .06, awd: { pb: 15.5, ap2: 17, ap1: 18.5, lead: 21 },
    leaders: [['rushYds', 'Rushing Yards', 1700], ['rushTD', 'Rushing TDs', 17]],
    cols: [colSum('CAR', s => s.rushAtt), colSum('YDS', s => s.rushYds), colSum('REC', s => s.rec), colSum('REC YDS', s => s.recYds), colSum('TD', s => s.rushTD + s.recTD)],
    extra: () => [],
    summary: T => [{ l: 'YDS', v: fmt(sum(T, 'rushYds', 'recYds')) }, { l: 'TD', v: sum(T, 'rushTD', 'recTD') }],
    career: T => [{ l: 'Career Yards', v: fmt(sum(T, 'rushYds', 'recYds')) }, { l: 'Career TD', v: sum(T, 'rushTD', 'recTD') }],
    line: T => [{ v: T.rushYds, l: 'RUSH YDS' }, { v: sum(T, 'rushTD', 'recTD'), l: 'TD' }, { v: T.rec, l: 'REC' }],
    careerLines: T => [{ v: T.rushYds, l: 'Rushing Yards' }, { v: T.rec, l: 'Receptions' }, { v: sum(T, 'rushTD', 'recTD'), l: 'Touchdowns' }],
    gen: genRB,
  },
  WR: {
    name: 'Wide Receiver', side: 'O',
    attrs: [['Speed', .22, 1], ['Acceleration', .16, 1], ['Catching', .22, 0], ['Route Running', .22, 0], ['Strength', .06, 1], ['Awareness', .12, 0]],
    stats: ST('targets:Targets:TGT', 'rec:Receptions:REC', 'recYds:Receiving Yards:YDS', 'recTD:Receiving TD:TD', 'rushAtt:Rush Attempts:CAR', 'rushYds:Rush Yards:RYD', 'rushTD:Rush TD:RTD', 'fumbles:Fumbles:FUM', 'twoPt:2-Pt Conversions:2PT'),
    bench: 14, thr: [3.5, 7.5, 14, 20, 28], impact: 1.5, impR: .08, awd: { pb: 17.5, ap2: 19.5, ap1: 21, lead: 23.5 },
    leaders: [['recYds', 'Receiving Yards', 1700], ['rec', 'Receptions', 115], ['recTD', 'Receiving TDs', 14]],
    cols: [colSum('TGT', s => s.targets), colSum('REC', s => s.rec), colSum('YDS', s => s.recYds), colSum('TD', s => s.recTD + s.rushTD)],
    extra: () => [],
    summary: T => [{ l: 'YDS', v: fmt(T.recYds) }, { l: 'TD', v: sum(T, 'recTD', 'rushTD') }],
    career: T => [{ l: 'Career Yards', v: fmt(T.recYds) }, { l: 'Career TD', v: sum(T, 'recTD', 'rushTD') }],
    line: T => [{ v: T.rec, l: 'REC' }, { v: T.recYds, l: 'YDS' }, { v: sum(T, 'recTD', 'rushTD'), l: 'TD' }],
    careerLines: T => [{ v: T.rec, l: 'Receptions' }, { v: T.recYds, l: 'Receiving Yards' }, { v: sum(T, 'recTD', 'rushTD'), l: 'Touchdowns' }],
    gen: genWR,
  },
  TE: {
    name: 'Tight End', side: 'O',
    attrs: [['Catching', .22, 0], ['Route Running', .16, 0], ['Blocking', .20, 0], ['Strength', .14, 1], ['Speed', .14, 1], ['Awareness', .14, 0]],
    stats: ST('targets:Targets:TGT', 'rec:Receptions:REC', 'recYds:Receiving Yards:YDS', 'recTD:Receiving TD:TD', 'rushAtt:Rush Attempts:CAR', 'rushYds:Rush Yards:RYD', 'rushTD:Rush TD:RTD', 'fumbles:Fumbles:FUM', 'twoPt:2-Pt Conversions:2PT'),
    bench: 9, thr: [2, 5, 10, 15, 21], impact: 1.2, impR: .05, awd: { pb: 11.5, ap2: 12.5, ap1: 14, lead: 16 },
    leaders: [['recYds', 'Receiving Yards', 1100], ['rec', 'Receptions', 90], ['recTD', 'Receiving TDs', 11]],
    cols: [colSum('TGT', s => s.targets), colSum('REC', s => s.rec), colSum('YDS', s => s.recYds), colSum('TD', s => s.recTD + s.rushTD)],
    extra: () => [],
    summary: T => [{ l: 'YDS', v: fmt(T.recYds) }, { l: 'TD', v: sum(T, 'recTD', 'rushTD') }],
    career: T => [{ l: 'Career Yards', v: fmt(T.recYds) }, { l: 'Career TD', v: sum(T, 'recTD', 'rushTD') }],
    line: T => [{ v: T.rec, l: 'REC' }, { v: T.recYds, l: 'YDS' }, { v: sum(T, 'recTD', 'rushTD'), l: 'TD' }],
    careerLines: T => [{ v: T.rec, l: 'Receptions' }, { v: T.recYds, l: 'Receiving Yards' }, { v: sum(T, 'recTD', 'rushTD'), l: 'Touchdowns' }],
    gen: genWR,
  },
  OL: {
    name: 'Offensive Line', side: 'O',
    attrs: [['Pass Block', .25, 0], ['Run Block', .25, 0], ['Strength', .20, 1], ['Awareness', .12, 0], ['Agility', .10, 1], ['Stamina', .08, 1]],
    stats: ST('snap:Snap %:SNP', 'pancakes:Pancake Blocks:PNK', 'pressures:Pressures Allowed:PRS', 'sacksAllowed:Sacks Allowed:SKA', 'penalties:Penalties:PEN'),
    bench: 6.5, thr: [3.5, 5.5, 7.5, 9, 10.5], impact: .8, impR: .06, awd: { pb: 8.0, ap2: 8.7, ap1: 9.3, lead: 10 },
    leaders: [],
    cols: [colSum('PANCAKES', s => s.pancakes), colSum('PRESS', s => s.pressures), colSum('SACKS ALW', s => s.sacksAllowed), colSum('PEN', s => s.penalties)],
    extra: () => [],
    summary: T => [{ l: 'PANCAKES', v: T.pancakes }, { l: 'SACKS ALLOWED', v: T.sacksAllowed }],
    career: T => [{ l: 'Career Pancakes', v: fmt(T.pancakes) }, { l: 'Games Played', v: fmt(T.gp) }],
    line: T => [{ v: T.pancakes, l: 'PANCAKES' }, { v: T.sacksAllowed, l: 'SACKS ALLOWED' }, { v: T.penalties, l: 'PEN' }],
    careerLines: T => [{ v: T.pancakes, l: 'Pancake Blocks' }, { v: T.gp, l: 'Games Played' }, { v: T.sacksAllowed, l: 'Sacks Allowed' }],
    gen: genOL,
  },
  DL: defPos('Defensive Line', [['Pass Rush', .25, 0], ['Run Stop', .20, 0], ['Strength', .18, 1], ['Block Shedding', .15, 0], ['Acceleration', .12, 1], ['Awareness', .10, 0]],
    { bench: 7, thr: [1.5, 4, 8.5, 13, 19], impact: 1.5, impR: .08, awd: { pb: 7.2, ap2: 8, ap1: 8.8, lead: 10 }, leaders: [['sacks', 'Sacks', 15], ['tackles', 'Tackles', 85]], sack: true }),
  LB: defPos('Linebacker', [['Tackling', .20, 0], ['Pursuit', .15, 1], ['Strength', .10, 1], ['Coverage', .15, 0], ['Speed', .15, 1], ['Awareness', .25, 0]],
    { bench: 11, thr: [3, 7, 12, 17, 23], impact: 1.2, impR: .06, awd: { pb: 12, ap2: 13, ap1: 14.5, lead: 16.5 }, leaders: [['tackles', 'Tackles', 150], ['sacks', 'Sacks', 11]], sack: true }),
  CB: defPos('Cornerback', [['Speed', .20, 1], ['Man Coverage', .22, 0], ['Zone Coverage', .18, 0], ['Ball Skills', .15, 0], ['Press', .10, 0], ['Acceleration', .15, 1]],
    { bench: 6.5, thr: [1, 3.5, 7, 11, 16], impact: 1.3, impR: .07, awd: { pb: 9, ap2: 9.8, ap1: 10.6, lead: 12 }, leaders: [['ints', 'Interceptions', 7], ['pd', 'Pass Deflections', 22]], sack: false }),
  S: defPos('Safety', [['Speed', .15, 1], ['Zone Coverage', .20, 0], ['Tackling', .20, 0], ['Ball Skills', .15, 0], ['Hit Power', .10, 1], ['Awareness', .20, 0]],
    { bench: 7.5, thr: [1.5, 4.5, 8.5, 12.5, 17.5], impact: 1.2, impR: .05, awd: { pb: 11.5, ap2: 12.5, ap1: 13.5, lead: 15 }, leaders: [['ints', 'Interceptions', 7], ['tackles', 'Tackles', 145]], sack: false }),
  K: {
    name: 'Kicker', side: 'S',
    attrs: [['Kick Power', .30, 1], ['Kick Accuracy', .40, 0], ['Consistency', .20, 0], ['Clutch', .10, 0]],
    stats: ST('fgm:Field Goals Made:FGM', 'fga:Field Goals Attempted:FGA', 'xpm:Extra Points Made:XPM', 'xpa:Extra Points Attempted:XPA'),
    bench: 7, thr: [1, 4, 8, 11, 14], impact: .5, impR: .03, awd: { pb: 7.6, ap2: 8.2, ap1: 8.8, lead: 9.5 },
    leaders: [['fgm', 'Field Goals Made', 34]],
    cols: [
      { h: 'FG', g: g => `${g.s.fgm}/${g.s.fga}`, t: T => `${T.fgm}/${T.fga}` },
      { h: 'FG%', g: g => g.s.fga ? fmt1(100 * g.s.fgm / g.s.fga) : '—', t: T => T.fga ? fmt1(100 * T.fgm / T.fga) : '—' },
      colSum('XP', s => s.xpm), colSum('PTS', s => s.fgm * 3 + s.xpm),
    ],
    extra: s => [['Field Goal %', s.fga ? fmt1(100 * s.fgm / s.fga) + '%' : '—'], ['Points Scored', s.fgm * 3 + s.xpm]],
    summary: T => [{ l: 'FGM', v: T.fgm }, { l: 'FG%', v: T.fga ? fmt1(100 * T.fgm / T.fga) + '%' : '—' }],
    career: T => [{ l: 'Career FGM', v: fmt(T.fgm) }, { l: 'Career FG%', v: T.fga ? fmt1(100 * T.fgm / T.fga) + '%' : '—' }],
    line: T => [{ v: T.fgm, l: 'FGM' }, { v: T.fga ? fmt1(100 * T.fgm / T.fga) + '%' : '—', l: 'FG%' }, { v: T.xpm, l: 'XP' }],
    careerLines: T => [{ v: T.fgm, l: 'Field Goals Made' }, { v: T.fga ? fmt1(100 * T.fgm / T.fga) + '%' : '—', l: 'Field Goal %' }, { v: T.xpm, l: 'Extra Points' }],
    gen: genK,
  },
};

// All four defensive positions share the same stat set and presentation
function defPos(name, attrs, o) {
  return {
    name, side: 'D', attrs, stats: ST('tackles:Total Tackles:TKL', 'solo:Solo Tackles:SOLO', 'sacks:Sacks:SCK', 'ints:Interceptions:INT', 'pd:Pass Deflections:PD', 'ff:Forced Fumbles:FF', 'fr:Fumble Recoveries:FR', 'defTD:Defensive TD:TD'),
    bench: o.bench, thr: o.thr, impact: o.impact, impR: o.impR, awd: o.awd, leaders: o.leaders,
    cols: [colSum('TKL', s => s.tackles), colSum('SOLO', s => s.solo), colSum('SCK', s => s.sacks), colSum('INT', s => s.ints), colSum('PD', s => s.pd)],
    extra: () => [],
    summary: T => [{ l: 'TKL', v: T.tackles }, o.sack ? { l: 'SACKS', v: fmtN(T.sacks) } : { l: 'INT', v: T.ints }],
    career: T => [{ l: 'Career Tackles', v: fmt(T.tackles) }, o.sack ? { l: 'Career Sacks', v: fmtN(T.sacks) } : { l: 'Career INT', v: T.ints }],
    line: T => [{ v: T.tackles, l: 'TKL' }, { v: T.sacks, l: 'SCK' }, { v: T.ints, l: 'INT' }],
    careerLines: T => [{ v: T.tackles, l: 'Tackles' }, { v: T.sacks, l: 'Sacks' }, { v: T.ints, l: 'Interceptions' }],
    gen: c => genDEF(c.pos, c),
  };
}

/* --- Per-game stat generators -------------------------------------------
   Model: the team's game volume is drawn first (pass attempts, rush attempts), then the player receives his SHARE of
   it according to his depth-chart slot, and efficiency (catch %, yards per catch/carry, TD rate...) comes from skill.
   Anchors follow recent NFL seasons: ~34.5 pass att + ~27 rush att per team game, WR1 ~8 targets, WR2 ~6, WR3 ~4,
   TE1 ~5, lead RB ~16 carries, LB1 ~7.5 tackles, DL1 ~0.4 sacks, QB ~1.4 pass TD / 0.7 INT per game...
   ctx: s (0..1 skill), z (-1..1), slot (depth chart), mult (injury/limited), form (season hot/cold), tg {pass, rush},
        ym (yardage matchup), tm (scoring matchup), matchup, a(attr), pts (team points), snap (snap share) */
const TGT_SHARE = { WR: [0.235, 0.18, 0.13, 0.065, 0.03], TE: [0.155, 0.055], RB: [0.095, 0.065, 0.025] };
const RUSH_SHARE = { RB: [0.60, 0.25, 0.07] };
const shareAt = (arr, slot) => arr[Math.min(slot, arr.length) - 1] * (slot > arr.length ? 0.4 : 1);

// Many modest gains plus the odd breakaway: keeps the mean at ypc but gives realistic game-to-game swings
function runYards(n, ypc) {
  const pBig = 0.05, base = Math.max(1.8, (ypc - pBig * 30) / (1 - pBig));
  let y = 0;
  for (let i = 0; i < n; i++) y += rnd() < pBig ? Math.min(80, Math.round(10 + expo(20))) : Math.max(-4, Math.round(gauss(base, 2.9)));
  return y;
}
function genQB(c) {
  const z = c.z, mob = c.a('Mobility');
  if (c.slot > 1) { // backup: garbage-time snaps only
    const att = randInt(2, 9), comp = binom(att, 0.6), ra = rnd() < 0.3 ? randInt(1, 3) : 0;
    return { passAtt: att, passComp: comp, passYds: yardsFor(comp, 9, 40), passTD: rnd() < 0.06 ? 1 : 0, int: rnd() < 0.05 ? 1 : 0, rushAtt: ra, rushYds: ra * 2, rushTD: 0, fumbles: 0, twoPt: 0 };
  }
  const att = Math.max(1, Math.round(c.tg.pass * (1 + 0.05 * z) * c.mult));
  const cmpP = clamp(0.64 + 0.06 * z + 0.03 * (c.a('Accuracy') - 0.5) * 2 + (c.ym - 1) * 0.25 + gauss(0, 0.02), 0.45, 0.83);
  const comp = binom(att, cmpP);
  const ypc = clamp(10.5 + 1.2 * z + 0.8 * (c.a('Deep Accuracy') - 0.5) * 2, 8.5, 13.8) * c.ym;
  const passYds = yardsFor(comp, ypc, 75);
  const passTD = poisson(att * (0.038 + 0.024 * z) * c.tm * c.form);
  const int = poisson(att * (0.021 - 0.008 * z) * (2 - c.tm));
  const rushAtt = poisson((1.6 + 3.4 * mob) * c.mult);
  return { passAtt: att, passComp: comp, passYds, passTD, int, rushAtt, rushYds: runYards(rushAtt, 4.2 + 2.0 * mob), rushTD: binom(rushAtt, 0.03 + 0.05 * mob), fumbles: poisson(0.11), twoPt: rnd() < 0.012 ? 1 : 0 };
}
function genRB(c) {
  const z = c.z;
  const carries = binom(c.tg.rush, Math.min(0.85, shareAt(RUSH_SHARE.RB, c.slot) * (1 + 0.1 * z) * c.mult * c.form));
  const ypc = clamp(4.1 + 0.55 * z + 0.4 * (c.a('Elusiveness') - 0.5) * 2, 3.1, 5.6) * c.ym;
  const rushYds = runYards(carries, ypc);
  const rushTD = binom(carries, clamp((0.030 + 0.012 * z) * c.tm, 0.01, 0.08));
  const targets = binom(Math.round(c.tg.pass * 0.95), Math.min(0.3, shareAt(TGT_SHARE.RB, c.slot) * (1 + 0.15 * z) * c.mult * c.form));
  const rec = binom(targets, clamp(0.78 + 0.04 * z, 0.6, 0.9));
  return { rushAtt: carries, rushYds, rushTD, targets, rec, recYds: yardsFor(rec, 7.2 + 1.0 * z, 55), recTD: binom(rec, 0.04), fumbles: poisson(0.006 * (carries + rec)), twoPt: rnd() < 0.008 ? 1 : 0 };
}
// WR and TE share one generator (different share tables, catch rates and yardage)
function genWR(c) {
  const te = c.pos === 'TE', z = c.z;
  const share = Math.min(0.45, shareAt(TGT_SHARE[c.pos], c.slot) * (1 + (te ? 0.28 : 0.22) * z) * c.mult * c.form);
  const targets = binom(Math.round(c.tg.pass * 0.95), share);
  const cr = clamp((te ? 0.70 : 0.645) + 0.05 * z + 0.03 * (c.a('Catching') - 0.5) * 2 + gauss(0, 0.015), 0.45, 0.88);
  const rec = binom(targets, cr);
  const ypr = clamp((te ? 10.6 : 12.2) + (te ? 1.5 : 2.6) * z + (te ? 0.8 : 2.0) * (c.a('Speed') - 0.5) * 2, 8, 19) * c.ym;
  const recTD = binom(rec, clamp(((te ? 0.085 : 0.075) + 0.028 * z) * c.tm, 0.02, 0.2));
  const rushAtt = poisson(te ? 0.03 : 0.15);
  return { targets, rec, recYds: yardsFor(rec, ypr, 80), recTD, rushAtt, rushYds: yardsFor(rushAtt, 5, 30), rushTD: rushAtt && rnd() < 0.03 ? 1 : 0, fumbles: rnd() < 0.04 ? 1 : 0, twoPt: rnd() < 0.006 ? 1 : 0 };
}
// Per-game baselines for the average starter in each depth slot (DL1..DL6, LB1..LB5, CB1..CB4, S1..S3)
const DEFP = {
  DL: { tk: [2.8, 2.7, 2.5, 2.3, 1.4, 1.0], sk: [.36, .31, .20, .17, .13, .10], int: [.008, .008, .006, .006, .004, .003], pd: [.14, .13, .10, .10, .06, .05], ff: [.07, .06, .05, .05, .03, .03], fr: [.04, .04, .04, .04, .02, .02], solo: .62, skAttr: 'Pass Rush' },
  LB: { tk: [7.4, 6.2, 4.0, 2.2, 1.2], sk: [.14, .11, .08, .04, .02], int: [.045, .04, .03, .02, .01], pd: [.30, .26, .20, .10, .05], ff: [.07, .06, .05, .03, .02], fr: [.05, .05, .04, .02, .01], solo: .62, skAttr: 'Pursuit' },
  CB: { tk: [3.9, 3.5, 3.0, 1.3], sk: [.01, .01, .01, 0], int: [.14, .12, .09, .03], pd: [.80, .70, .52, .18], ff: [.05, .05, .04, .02], fr: [.03, .03, .02, .01], solo: .74, skAttr: 'Speed' },
  S: { tk: [6.4, 5.6, 1.8], sk: [.05, .05, .02], int: [.13, .11, .02], pd: [.52, .46, .12], ff: [.06, .05, .02], fr: [.04, .04, .02], solo: .66, skAttr: 'Speed' },
};
function genDEF(pos, c) {
  const p = DEFP[pos], i = Math.min(c.slot, p.tk.length) - 1, z = c.z, m = c.mult * (c.slot > p.tk.length ? 0.4 : 1) * c.form;
  const plays = (c.tg.pass + c.tg.rush) / 61.5, pass = c.tg.pass / 34.5; // opposing offense volume this week
  const ball = (pos === 'CB' || pos === 'S') ? 0.85 + 0.3 * c.a('Ball Skills') : 1;
  const tackles = poisson(p.tk[i] * (1 + 0.14 * z) * plays * m);
  const solo = binom(tackles, p.solo);
  const sackEv = poisson(p.sk[i] * (1 + 1.15 * z) * (0.85 + 0.3 * c.a(p.skAttr)) * pass * m);
  let sacks = 0; for (let k = 0; k < sackEv; k++) sacks += rnd() < 0.2 ? 0.5 : 1;
  const tm = 1 + 0.45 * z;
  const ints = poisson(p.int[i] * tm * ball * pass * m), pd = poisson(p.pd[i] * tm * ball * pass * m);
  const ff = poisson(p.ff[i] * plays * m), fr = poisson(p.fr[i] * plays * m);
  let defTD = 0; for (let k = 0; k < ints + fr; k++) if (rnd() < 0.12) defTD++;
  return { tackles, solo, sacks, ints, pd, ff, fr, defTD };
}
function genK(c) {
  const fga = poisson(1.85 * Math.sqrt(c.tm));
  const pct = clamp(0.815 + 0.065 * c.z + 0.04 * (c.a('Kick Accuracy') - 0.5) * 2 + gauss(0, 0.03), 0.5, 0.99);
  const fgm = binom(fga, pct);
  // touchdowns (= extra-point tries) are whatever is left of the team's points once field goals are removed
  const xpa = Math.max(0, Math.round((c.pts - 3 * fgm) / 7 + gauss(0, 0.35)));
  return { fga, fgm, xpa, xpm: binom(xpa, clamp(0.93 + 0.05 * c.s, 0.8, 1)) };
}
function genOL(c) {
  const part = Math.min(1, c.snap);
  const pancakes = poisson((0.5 + 2.6 * Math.pow(c.s, 1.2)) * part * c.matchup);
  const pressures = poisson(Math.max(0.3, 4.4 - 3.4 * c.s) * part * (2 - c.matchup));
  return { snap: Math.round(clamp(part * 100 * rr(0.9, 1), 20, 100)), pancakes, pressures, sacksAllowed: binom(pressures, 0.13), penalties: poisson((0.55 - 0.3 * c.s) * part) };
}

/* ---------------------------------------------------------------------
   3. STATE & SAVING
   --------------------------------------------------------------------- */
let S = null; // the current career (plain JSON, saved to localStorage)

const hasSave = () => { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } };
function saveGame() {
  if (!S) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { toast('⚠️ Could not save — storage unavailable'); }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
    const d = JSON.parse(raw); if (!d || !d.player) return false;
    S = d; return true;
  } catch (e) { return false; }
}
function resetSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } S = null; }

const curSeason = () => S.seasons[S.seasons.length - 1];
const awardCount = id => S.seasons.reduce((n, s) => n + (s.awards || []).filter(a => a.id === id).length, 0);
const cfgOf = () => POS[S.player.pos];

/* ---------------------------------------------------------------------
   4. FANTASY, RATINGS, ROLES
   --------------------------------------------------------------------- */
// PPR scoring. IDP / kicker / O-line use reasonable custom scoring.
function fantasyPts(pos, s) {
  const g = k => s[k] || 0;
  let fp;
  if (pos === 'K') fp = g('fgm') * 3 + g('xpm') - (g('fga') - g('fgm'));
  else if (pos === 'OL') fp = 3 + 5.5 * (g('snap') / 100) + g('pancakes') * 0.75 - g('sacksAllowed') * 2 - g('pressures') * 0.4 - g('penalties') * 1.25;
  else if (POS[pos].side === 'D') fp = g('solo') * 1.5 + (g('tackles') - g('solo')) * 0.75 + g('sacks') * 4 + g('ints') * 4 + g('pd') * 1.5 + g('ff') * 3 + g('fr') * 2 + g('defTD') * 6;
  else fp = g('rec') + g('recYds') * 0.1 + g('rushYds') * 0.1 + g('passYds') * 0.04 + g('passTD') * 4 + g('rushTD') * 6 + g('recTD') * 6 - g('int') * 2 - g('fumbles') * 2 + g('twoPt') * 2;
  return r1(fp);
}
// Rating index 0..5 (TERRIBLE..ELITE) from fantasy points vs position thresholds
function ratingIdx(pos, fp) {
  const i = POS[pos].thr.findIndex(t => fp < t);
  return i === -1 ? 5 : i;
}
/* --- Depth chart -----------------------------------------------------------------------
   Each season (and after a trade) the team's depth chart at your position is generated: teammates' ratings depend on the
   team's strength, and your slot (WR1, WR2, ...) is where your rating + the coaches' preference (draft pedigree) ranks.
   The slot decides your workload: target/carry share, snaps, and how often you play at all. It can change mid-season. */
const DEPTH = {
  QB: { n: 2, starters: 1, labels: ['QB1', 'QB2'], top: 9, step: 8 },
  RB: { n: 3, starters: 1, labels: ['RB1', 'RB2', 'RB3'], top: 7, step: 4.5 },
  WR: { n: 5, starters: 3, labels: ['WR1', 'WR2', 'WR3', 'WR4', 'WR5'], top: 7, step: 3.6 },
  TE: { n: 2, starters: 1, labels: ['TE1', 'TE2'], top: 6, step: 6 },
  OL: { n: 7, starters: 5, labels: ['LT', 'LG', 'C', 'RG', 'RT', 'OL6', 'OL7'], top: 7, step: 2.6 },
  DL: { n: 6, starters: 4, labels: ['DL1', 'DL2', 'DL3', 'DL4', 'DL5', 'DL6'], top: 7, step: 3 },
  LB: { n: 5, starters: 3, labels: ['LB1', 'LB2', 'LB3', 'LB4', 'LB5'], top: 7, step: 3.5 },
  CB: { n: 4, starters: 2, labels: ['CB1', 'CB2', 'CB3 (Nickel)', 'CB4'], top: 7, step: 3.5 },
  S: { n: 3, starters: 2, labels: ['S1', 'S2', 'S3'], top: 6, step: 4.5 },
  K: { n: 0, starters: 1, labels: ['K1'], top: 0, step: 0 },
};
// share of the offensive/defensive snaps, chance of dressing at all, and expected fantasy output relative to slot 1
const SNAP = { QB: [1, .05], RB: [.65, .3, .12], WR: [.92, .85, .62, .3, .12], TE: [.82, .4], OL: [1, 1, 1, 1, 1, .12, .05], DL: [.75, .72, .65, .6, .35, .25], LB: [.95, .9, .55, .2, .08], CB: [.98, .95, .6, .15], S: [.97, .93, .3], K: [1] };
const PLAYP = { QB: [1, .12], RB: [1, 1, .7], WR: [1, 1, 1, .9, .55], TE: [1, .9], OL: [1, 1, 1, 1, 1, .12, .05], DL: [1, 1, 1, 1, .85, .6], LB: [1, 1, .95, .6, .3], CB: [1, 1, .95, .45], S: [1, 1, .5], K: [1] };
const SLOTX = { QB: [1, .1], RB: [1, .5, .2], WR: [1, .75, .55, .3, .15], TE: [1, .4], OL: [1, 1, 1, 1, 1, .3, .2], DL: [1, .95, .85, .8, .45, .3], LB: [1, .85, .5, .25, .1], CB: [1, .9, .65, .25], S: [1, .9, .35], K: [1] };
const atSlot = (tbl, pos, slot) => tbl[pos][Math.min(slot, tbl[pos].length) - 1];
const snapShare = (pos, slot) => atSlot(SNAP, pos, slot);
const expPPG = (pos, slot) => POS[pos].bench * atSlot(SLOTX, pos, slot); // what is "normal" for that slot
const teamTalent = id => 65.5 + (S.teamRatings[id] - 72) * 0.55;
function buildDepth(teamId) {
  const P = S.player, D = DEPTH[P.pos], mu = teamTalent(teamId), mates = [];
  for (let i = 0; i < D.n - 1; i++) mates.push({ name: `${pick(FIRST)[0]}. ${pick(LAST)}`, ovr: Math.round(clamp(mu + D.top - D.step * i + gauss(0, 3), 45, 93)) });
  mates.sort((a, b) => b.ovr - a.ovr);
  const eff = P.ovr + (S.contract ? S.contract.bias : 0); // coaches favor high draft picks
  let slot = 1 + mates.filter(m => m.ovr > eff).length;
  if (D.n && slot > D.n) { slot = D.n; mates.pop(); } // the roster only dresses D.n players at the position
  return { teamId, slot, mates };
}
// Expected slot on another team (used to describe free-agent and trade offers)
function projSlot(teamId, ovr, bias, pos) {
  const D = DEPTH[pos], mu = teamTalent(teamId);
  let slot = 1; for (let i = 0; i < D.n - 1; i++) if (mu + D.top - D.step * i > ovr + bias) slot++;
  return D.n ? Math.min(slot, D.n) : 1;
}
const slotLabel = (pos, slot) => DEPTH[pos].labels[slot - 1] || `${pos}${slot}`;
function tierOf(pos, slot, ovr) {
  const D = DEPTH[pos];
  if (slot === 1 && ovr >= 85 && pos !== 'K') return 'Franchise Player';
  if (pos === 'QB') return slot === 1 ? 'Starter' : 'Backup';
  return slot <= D.starters ? 'Starter' : slot === D.starters + 1 ? 'Rotational Player' : 'Backup';
}
const roleText = (pos, slot, ovr) => `${slotLabel(pos, slot)} · ${tierOf(pos, slot, ovr)}`;
const curSlot = (se = S.seasons[S.seasons.length - 1]) => (se && se.depth ? se.depth.slot : projSlot(S.teamId, S.player.ovr, S.contract.bias, S.player.pos));
const depthText = se => roleText(S.player.pos, curSlot(se), S.player.ovr);
function curRoleKey(se) {
  const P = S.player, D = DEPTH[P.pos], sl = curSlot(se);
  if (sl === 1) return P.ovr >= 85 ? 'FR' : 'ST';
  return sl <= D.starters ? 'ST' : sl === D.starters + 1 ? 'RT' : 'BU';
}
// Every 4 games the coaches review your play
function evalDepth(se, notes) {
  const d = se.depth, P = S.player;
  if (!d || P.pos === 'K' || se.games.length % 4 !== 0) return;
  const recent = se.games.slice(-4).filter(g => g.st !== 'OUT');
  if (recent.length < 2) return;
  const avg = recent.reduce((a, g) => a + g.fp, 0) / recent.length, exp = expPPG(P.pos, d.slot);
  if (d.slot > 1 && avg > exp * 1.4 && rnd() < 0.55) { d.slot--; notes.push(`📋 DEPTH CHART — your play earned a promotion: you are now ${slotLabel(P.pos, d.slot)}!`); }
  else if (d.slot < DEPTH[P.pos].n && avg < exp * 0.5 && rnd() < 0.4) { d.slot++; notes.push(`📋 DEPTH CHART — the coaches moved you down to ${slotLabel(P.pos, d.slot)}.`); }
  se.role = curRoleKey(se);
}
function usageHint(pos, slot) {
  const tp = 34.5 * 0.95;
  if (pos === 'QB') return slot === 1 ? 'Starting quarterback · ~35 pass attempts per game' : 'Backup — you play only if the starter is hurt or in garbage time';
  if (pos === 'RB') return `Expected workload: ~${Math.round(27 * shareAt(RUSH_SHARE.RB, slot))} carries + ~${(tp * shareAt(TGT_SHARE.RB, slot)).toFixed(1)} targets per game`;
  if (pos === 'WR' || pos === 'TE') return `Expected workload: ~${(tp * shareAt(TGT_SHARE[pos], slot)).toFixed(1)} targets per game`;
  if (pos === 'K') return 'Starting kicker';
  if (pos === 'OL') return slot <= 5 ? 'Starting offensive line · every snap' : 'Reserve lineman — rarely plays';
  return `Expected usage: ~${Math.round(100 * snapShare(pos, slot))}% of defensive snaps`;
}
function depthCardHTML(se) {
  const P = S.player, D = DEPTH[P.pos], d = se.depth;
  if (!d) return '';
  const list = d.mates.map(m => ({ name: m.name, ovr: m.ovr }));
  list.splice(d.slot - 1, 0, { name: P.name, ovr: P.ovr, you: true });
  const rows = list.map((x, i) => `${i === D.starters && list.length > D.starters ? '<div class="dc-sep">BACKUPS</div>' : ''}<div class="dc-row ${x.you ? 'you' : ''}"><span class="dc-pos">${slotLabel(P.pos, i + 1)}</span><span class="dc-name">${esc(x.name)}${x.you ? ' <em>YOU</em>' : ''}</span><b>${x.ovr}</b></div>`).join('');
  return `<section class="card depth-card"><div class="card-h"><h3>DEPTH CHART</h3><span class="chip gold">${slotLabel(P.pos, d.slot)}</span></div>${rows}<div class="muted small dc-hint">${usageHint(P.pos, d.slot)}</div></section>`;
}

const calcOvr = (pos, attrs) => Math.round(POS[pos].attrs.reduce((s, [n, w]) => s + attrs[n] * w, 0));

/* ---------------------------------------------------------------------
   5. PLAYER GENERATION
   --------------------------------------------------------------------- */
function generatePlayer(name, pos, college, age) {
  const bonus = (COLLEGES.find(c => c[0] === college) || [0, 0])[1];
  const target = clamp(gauss(71.5 + bonus + (pos === 'K' ? 6 : 0), 5.2), 58, 88);
  const attrs = {};
  POS[pos].attrs.forEach(([n]) => { attrs[n] = clamp(Math.round(target + gauss(0, 4.5)), 40, 96); });
  const roll = rnd();
  const dev = roll < .05 ? 'Superstar' : roll < .20 ? 'Star' : roll < .45 ? 'Impact' : 'Normal';
  return { name, pos, college, age, attrs, ovr: calcOvr(pos, attrs), dev, devMult: DEV[dev] };
}

function newCareer(player) {
  const ratings = {};
  TEAM_LIST.forEach(t => { ratings[t.id] = clamp(t.base + gauss(0, 2.5), 55, 90); });
  S = {
    v: 1, phase: 'draft', player, year: START_YEAR, teamId: null, teamRatings: ratings,
    draft: null, contract: null, contracts: [], trades: [], jerseys: {}, earnings: 0, seasons: [], fa: null, carryInjury: null, createdAt: Date.now(),
  };
}

/* ---------------------------------------------------------------------
   6. DRAFT & ROOKIE CONTRACT
   --------------------------------------------------------------------- */
const DRAFT_POS_ADJ = { QB: 1.5, RB: -2, WR: 0, TE: -1, OL: 0, DL: 1, LB: -1, CB: 0, S: -1.5, K: -11 };
// Draft "score" -> logistic curve -> overall pick number (1..260; >224 = undrafted)
function projectedPick(P, noise = 0) {
  const sc = P.ovr + DRAFT_POS_ADJ[P.pos] + noise;
  return Math.round(1 + 260 * Math.pow(logistic((72.5 - sc) / 3.5), 1.6));
}
function draftProjectionLabel(P) {
  const o = projectedPick(P);
  if (o > 224) return 'Undrafted / late round';
  const rd = Math.floor((o - 1) / 32) + 1;
  return rd === 1 ? 'Round 1' : rd >= 6 ? 'Rounds 6–7' : `Round ${rd}`;
}
function runDraft(P) {
  const overall = projectedPick(P, gauss(0, 3));
  const order = shuffle(TEAM_LIST.map(t => t.id));
  if (overall > 224) return { year: START_YEAR, undrafted: true, teamId: pick(order), overall: null, round: null, pick: null };
  return { year: START_YEAR, undrafted: false, overall, round: Math.floor((overall - 1) / 32) + 1, pick: ((overall - 1) % 32) + 1, teamId: order[(overall - 1) % 32] };
}
function rookieContract(d, pos) {
  if (d.undrafted) return { years: 3, total: 2.9, guaranteed: 0.1, bias: -6 };
  const o = d.overall; let total;
  if (o <= 32) total = 40 * (1 - (o - 1) / 31 * 0.62);
  else if (o <= 64) total = 12 - (o - 33) / 31 * 3.6;
  else if (o <= 96) total = 7.6 - (o - 65) / 31 * 1.7;
  else if (o <= 128) total = 5.7 - (o - 97) / 31 * 0.8;
  else total = 4.8 - (o - 129) / 95 * 0.9;
  if (pos === 'K') total *= 0.4;
  if (pos === 'QB' && o <= 32) total *= 1.08;
  const gPct = o <= 32 ? 1 : o <= 64 ? .72 : o <= 96 ? .4 : o <= 128 ? .22 : .1;
  const bias = o <= 32 ? 4 : o <= 64 ? 1.5 : o <= 96 ? -.5 : o <= 160 ? -2 : -3.5;
  return { years: 4, total: r1(total), guaranteed: r1(total * gPct), bias };
}
function makeContract(o, type) {
  return { years: o.years, yearsLeft: o.years, total: o.total, guaranteed: o.guaranteed, aav: o.total / o.years, bias: o.bias, teamId: o.teamId, type, startYear: o.startYear };
}

/* ---------------------------------------------------------------------
   7. SEASON ENGINE
   --------------------------------------------------------------------- */
function buildSchedule(teamId) {
  const me = TEAM[teamId];
  const same = t => t.conf === me.conf && t.div === me.div;
  const rivals = TEAM_LIST.filter(t => t.id !== teamId && same(t)).map(t => t.id);
  const others = shuffle(TEAM_LIST.filter(t => t.id !== teamId && !same(t)).map(t => t.id)).slice(0, 11);
  const opps = shuffle([...rivals, ...rivals, ...others]); // division rivals twice + 11 others = 17 games
  const bye = randInt(6, 13);
  return opps.map((oppId, i) => ({ week: i + 1 < bye ? i + 1 : i + 2, oppId, home: rnd() < 0.5 }));
}

function startSeason() {
  const P = S.player;
  const season = {
    year: S.year, age: P.age, teamId: S.teamId, ovrStart: P.ovr, role: null, rookie: S.seasons.length === 0,
    schedule: buildSchedule(S.teamId), idx: 0, games: [], playoffGames: [], status: 'regular',
    injury: null, injuries: [], missed: 0, form: Math.exp(gauss(0, 0.11)),
    record: null, po: null, wins: null, seed: null, divRank: null, awards: [], dev: null, complete: false,
    rigged: !!S.egg, // easter egg: this season ends with the Super Bowl title
  };
  S.egg = false;
  if (S.carryInjury) { season.injury = S.carryInjury; S.carryInjury = null; }
  season.aiRes = genAiResults(S.teamId);
  if (typeof calGenLeague === 'function') { const lg = calGenLeague(season, 1, null); season.league = lg.league; season.aiRes = lg.aiRes; }   // real calendar: dates, windows and every team's games
  season.style = Math.exp(gauss(0, 0.07)); // pass-heavy or run-heavy scheme this year
  mgInitSeason(season);
  S.seasons.push(season);
  season.depth = buildDepth(S.teamId); season.role = curRoleKey(season);
  return season;
}
// League results: every other team's 17 games are decided up front (string of 1/0 = win/loss),
// so standings can be shown live while the user's season is in progress and always agree with the final table.
function genAiResults(userId) {
  const res = {};
  TEAM_LIST.forEach(t => {
    const r = S.teamRatings[t.id] + gauss(0, 2.5), p = clamp(logistic(0.064 * (r - 72)), 0.08, 0.92);
    res[t.id] = Array.from({ length: 17 }, () => (rnd() < p ? '1' : '0')).join('');
  });
  return res;
}
// Wins of all 32 teams after k games (the user's team uses its real results)
function leagueGP(season, k) {                                   // games each team has played once the user has played k (teams on a bye have one less)
  const g = {}; TEAM_LIST.forEach(t => { g[t.id] = season.league && typeof calPlayedBy === 'function' ? calPlayedBy(season, t.id, k) : k; }); return g;
}
function leagueWins(season, k) {
  if (!season.aiRes) season.aiRes = genAiResults(season.teamId); // old saves
  const w = {}, gp = leagueGP(season, k);
  TEAM_LIST.forEach(t => {
    w[t.id] = season.aiRes[t.id] ? season.aiRes[t.id].slice(0, gp[t.id]).split('').filter(x => x === '1').length : season.games.slice(0, k).filter(g => g.w).length;
  });
  return w;
}
function standingsData(season) {
  if (season.wins) return { wins: season.wins, k: 17, gp: leagueGP(season, 17) };
  const k = season.games.length;
  return { wins: leagueWins(season, k), k, gp: leagueGP(season, k) };
}
// "2nd" / "T-2nd" within the user's division
function divisionLine(season) {
  const { wins, k } = standingsData(season), me = TEAM[season.teamId], label = `${me.conf} ${me.div}`;
  if (!k) return label;
  const mates = TEAM_LIST.filter(t => t.conf === me.conf && t.div === me.div && t.id !== me.id);
  const better = mates.filter(t => wins[t.id] > wins[me.id]).length, tied = mates.some(t => wins[t.id] === wins[me.id]);
  return `${label}: ${tied ? 'T-' : ''}${['1st', '2nd', '3rd', '4th'][better]}`;
}

// Between seasons teams drift toward the mean with random shocks
function evolveRatings() {
  TEAM_LIST.forEach(t => { const r = S.teamRatings[t.id]; S.teamRatings[t.id] = clamp(r + (72 - r) * 0.12 + gauss(0, 3.3), 54, 90); });
}
// Team strength including the user's contribution (big for QBs, small elsewhere)
function effRating(season, playing = true) {
  const base = S.teamRatings[season.teamId];
  if (!playing) return base;
  const P = S.player;
  return base + (P.ovr - 70) * POS[P.pos].impR * snapShare(P.pos, curSlot(season));
}

const INJ_BASE = { QB: .009, RB: .017, WR: .014, TE: .014, OL: .012, DL: .014, LB: .015, CB: .015, S: .014, K: .002 };
const injuryChance = (pos, age) => INJ_BASE[pos] * (1 + Math.max(0, age - 29) * 0.07);
function rollInjury() {
  const r = rnd(); let weeks;
  if (r < .32) weeks = 1; else if (r < .54) weeks = 2; else if (r < .74) weeks = randInt(3, 4);
  else if (r < .89) weeks = randInt(5, 8); else if (r < .96) weeks = randInt(9, 12); else weeks = randInt(13, 17);
  const minor = ['Hamstring Strain', 'Ankle Sprain', 'Groin Strain', 'Calf Strain', 'Rib Contusion', 'Quad Contusion', 'Shoulder Sprain', 'Concussion', 'Hip Pointer', 'Hand Injury'];
  const mid = ['Knee Sprain (MCL)', 'High Ankle Sprain', 'Broken Hand', 'Shoulder Separation', 'Foot Fracture', 'Torn Hamstring'];
  const major = ['Torn ACL', 'Achilles Rupture', 'Fractured Leg', 'Torn Labrum', 'Lisfranc Injury', 'Broken Collarbone'];
  return { weeks, name: weeks <= 2 ? pick(minor) : weeks <= 8 ? pick(minor.concat(mid)) : pick(major) };
}

/* --- Playoff bracket (7 seeds per conference) ---------------------------- */
const aiWin = (a, b) => (rnd() < logistic(0.064 * (S.teamRatings[a] - S.teamRatings[b])) ? a : b);
function makeCmp(wins) { const tb = {}; TEAM_LIST.forEach(t => { tb[t.id] = rnd(); }); return (a, b) => (wins[b] - wins[a]) || (tb[b] - tb[a]); }
function confSeeds(conf, wins, cmp) {
  const teams = TEAM_LIST.filter(t => t.conf === conf);
  const winners = ['East', 'North', 'South', 'West'].map(d => teams.filter(t => t.div === d).map(t => t.id).sort(cmp)[0]).sort(cmp);
  const rest = teams.map(t => t.id).filter(id => !winners.includes(id)).sort(cmp).slice(0, 3);
  return winners.concat(rest); // seeds 1..4 division winners, 5..7 wild cards
}
function pairsFor(round, alive) {
  const a = alive.slice().sort((x, y) => x - y);
  if (round === 0) return [[2, 7], [3, 6], [4, 5]];
  if (round === 1) return [[a[0], a[3]], [a[1], a[2]]];
  return [[a[0], a[1]]];
}
// Winners (as seed numbers) of a round. If the user takes part, their result is `userWon`.
function roundWinners(po, ids, round, alive, userSeed, userWon) {
  const w = pairsFor(round, alive).map(([x, y]) => {
    if (userSeed && (x === userSeed || y === userSeed)) return userWon ? userSeed : (x === userSeed ? y : x);
    return aiWin(ids[x - 1], ids[y - 1]) === ids[x - 1] ? x : y;
  });
  if (round === 0) w.push(1); // seed #1 has a bye
  return w;
}
function simConfChampion(ids) {
  let alive = [1, 2, 3, 4, 5, 6, 7];
  for (let r = 0; r < 3; r++) alive = roundWinners(null, ids, r, alive, 0, false);
  return ids[alive[0] - 1];
}
const PO_SHORT = ['WC', 'DIV', 'CONF', 'SB'];
function poMatchup(season) {
  const po = season.po;
  if (po.round === 3) return { name: ROUND_NAME.SB, short: 'SB', oppId: po.sbOpp, oppSeed: 99 };
  const pr = pairsFor(po.round, po.alive).find(p => p.includes(po.mySeed));
  const oppSeed = pr[0] === po.mySeed ? pr[1] : pr[0];
  return { name: ROUND_NAME[PO_SHORT[po.round]], short: PO_SHORT[po.round], oppId: po.ids[oppSeed - 1], oppSeed };
}

// End of the 17-game regular season: standings, seeding, playoff berth
function finalizeRegular(season, notes) {
  const w = leagueWins(season, 17)[season.teamId]; // team record (a mid-season trade changes the team)
  season.record = { w, l: 17 - w };
  const wins = leagueWins(season, 17);
  season.wins = wins;
  const cmp = makeCmp(wins), me = TEAM[season.teamId];
  const div = TEAM_LIST.filter(t => t.conf === me.conf && t.div === me.div).map(t => t.id).sort(cmp);
  season.divRank = div.indexOf(season.teamId) + 1;
  const ids = confSeeds(me.conf, wins, cmp);
  const mySeed = ids.indexOf(season.teamId) + 1;
  season.seed = mySeed || null;
  const otherConf = me.conf === 'AFC' ? 'NFC' : 'AFC', otherIds = confSeeds(otherConf, wins, cmp);
  season.seedIds = { [me.conf]: ids, [otherConf]: otherIds };
  if (season.divRank === 1) notes.push(`🏆 ${me.conf} ${me.div} Champions`);
  if (!mySeed) { season.status = 'done'; notes.push(`❌ Regular season over: ${w}–${17 - w}. The team missed the playoffs.`); return; }
  const po = { conf: me.conf, ids, otherIds, mySeed, alive: [1, 2, 3, 4, 5, 6, 7], round: 0, rounds: [], eliminated: false, champion: false, sbOpp: null };
  season.po = po; season.status = 'playoffs';
  notes.push(`🏁 Regular season complete: ${w}–${17 - w}. PLAYOFFS CLINCHED — #${mySeed} seed in the ${me.conf}!`);
  if (mySeed === 1) { // first-round bye: other games are simulated, user advances
    po.alive = roundWinners(po, ids, 0, po.alive, 0, false); po.round = 1;
    po.rounds.push({ name: ROUND_NAME.WC, res: 'BYE' });
    notes.push('😴 First-round BYE earned.');
  }
}
function resolvePlayoffRound(season, win, game, notes) {
  const po = season.po;
  po.rounds.push({ name: game.round, opp: game.opp, res: win ? 'WIN' : 'LOSS', score: `${game.my}-${game.op}` });
  if (!win) { po.eliminated = true; season.status = 'done'; notes.push(`💔 Eliminated in the ${game.round}.`); return; }
  if (po.round === 3) { po.champion = true; season.status = 'done'; notes.push('🏆 SUPER BOWL CHAMPIONS!'); return; }
  po.alive = roundWinners(po, po.ids, po.round, po.alive, po.mySeed, true);
  po.round++;
  if (po.round === 3) { po.sbOpp = simConfChampion(po.otherIds); notes.push(`🏟️ Heading to the SUPER BOWL vs ${TEAM[po.sbOpp].name}!`); }
  else notes.push(`➡️ Advancing to the ${ROUND_NAME[PO_SHORT[po.round]]}.`);
}

/* --- Trades --------------------------------------------------------------------------
   Window: until the user has played TRADE_DEADLINE games (NFL deadline = Tuesday before Week 9).
   Offers can arrive on their own (more likely for stars and for players stuck on the bench) or the player can
   request a trade. One trade per season. The contract carries over; role and schedule change with the team. */
const TRADE_DEADLINE = 8;
const offersOf = se => (se.tradeOffers = se.tradeOffers || []);
const deadlineWeek = se => se.schedule[Math.min(TRADE_DEADLINE, se.schedule.length - 1)].week;
function tradeStatus(se) {
  if (se.traded) return 'used';
  if (se.status !== 'regular' || se.games.length > TRADE_DEADLINE) return 'closed';
  return se.games.length === TRADE_DEADLINE ? 'today' : 'open';
}
// Keep the league table in sync with the user's actual results for their current team
function recordUserRes(season, idx, win) {
  const id = season.teamId;
  if (!season.aiRes) season.aiRes = genAiResults(id);
  let r = season.aiRes[id];
  if (!r) r = season.games.slice(0, idx).map(g => (g.w ? '1' : '0')).join('').padEnd(17, '0'); // saves from before this feature
  season.aiRes[id] = r.slice(0, idx) + (win ? '1' : '0') + r.slice(idx + 1);
}
// What the old team would receive (flavor text scaled to the player's trade value)
function tradePackage() {
  const P = S.player, adj = { QB: 6, K: -14, RB: -3, S: -2, LB: -1, OL: 0, TE: -1, WR: 1, CB: 1, DL: 2 }[P.pos];
  const v = P.ovr + adj - Math.max(0, P.age - 28) * 1.8 + gauss(0, 2.5), y = S.year + 1;
  if (v >= 92) return `${y} 1st + ${y + 1} 1st-round picks`;
  if (v >= 84) return `${y} 1st-round pick`;
  if (v >= 77) return `${y} 2nd + ${y + 1} 5th-round picks`;
  if (v >= 71) return `${y} 3rd-round pick`;
  if (v >= 65) return `${y} 5th-round pick`;
  if (v >= 58) return `${y} 7th-round pick`;
  return 'Conditional 7th-round pick';
}
function pickWeighted(ids, n, wf) {
  const out = [], pool = ids.slice();
  while (out.length < n && pool.length) {
    const ws = pool.map(wf), tot = ws.reduce((a, b) => a + b, 0);
    let x = rnd() * tot, i = 0;
    for (; i < pool.length; i++) { x -= ws[i]; if (x <= 0) break; }
    out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
  }
  return out;
}
function mkTradeOffer(teamId, until) {
  const P = S.player, bias = randInt(-2, 5), r = S.teamRatings[teamId];
  let it = P.ovr >= 85 ? 3 : P.ovr >= 76 ? 2 : P.ovr >= 66 ? 1 : 0;
  if (rnd() < 0.3) it = clamp(it + (rnd() < 0.5 ? -1 : 1), 0, 3);
  const why = r >= 76 ? `Contender looking for a difference-maker at ${P.pos}` : r <= 66 ? `Rebuilding team that wants a cornerstone at ${P.pos}` : `Has a hole at ${P.pos} and wants immediate help`;
  return { id: uid(), teamId, bias, role: roleText(P.pos, projSlot(teamId, P.ovr, bias, P.pos), P.ovr), interest: it, pkg: tradePackage(), why, until };
}
function genTradeOffers(se, n, until) {
  const P = S.player, taken = offersOf(se).map(o => o.teamId);
  const ids = TEAM_LIST.map(t => t.id).filter(id => id !== se.teamId && !taken.includes(id));
  // stars attract contenders; low-rated players mostly get calls from weaker teams
  return pickWeighted(ids, n, id => Math.pow(S.teamRatings[id] / 72, P.ovr >= 78 ? 6 : P.ovr <= 66 ? -3 : 1.5)).map(id => mkTradeOffer(id, until));
}
// Runs after every regular-season game: expire offers, deadline messages, new incoming offers
function tradeTick(se, notes) {
  const p = se.games.length, offers = offersOf(se), live = offers.filter(o => o.until >= p);
  if (live.length < offers.length) notes.push('⌛ A trade offer expired.');
  se.tradeOffers = live;
  if (se.traded) return;
  if (p === TRADE_DEADLINE + 1) { se.tradeOffers = []; notes.push('⏰ The trade deadline has passed. Rosters are locked for the season.'); return; }
  if (p > TRADE_DEADLINE) return;
  if (p === TRADE_DEADLINE) notes.push('⏰ TRADE DEADLINE DAY — this is your last chance to make a deal.');
  const P = S.player;
  let chance = clamp(0.025 + (P.ovr - 65) * 0.002 + (['BU', 'RT'].includes(curRoleKey()) ? 0.025 : 0), 0.02, 0.12);
  if (p === TRADE_DEADLINE) chance *= 2; // deadline-day flurry
  if (se.tradeOffers.length < 2 && p >= 2 && rnd() < chance) {
    const [o] = genTradeOffers(se, 1, Math.min(TRADE_DEADLINE, p + 3));
    if (o) { se.tradeOffers.push(o); notes.push(`📞 TRADE OFFER — the ${TEAM[o.teamId].name} want to acquire you. Open the Trade Center before the deadline.`); }
  }
}
function executeTrade(o) {
  const se = curSeason(), p = se.games.length, from = se.teamId, to = o.teamId, before = recOf(se);
  se.stints = (se.stints || []).concat({ teamId: from, g: p, w: before.w, l: before.l });
  const ns = buildSchedule(to); // the new team's remaining opponents replace the old ones
  for (let j = p; j < se.schedule.length; j++) { se.schedule[j].oppId = ns[j].oppId; se.schedule[j].home = ns[j].home; }
  se.teamId = to; S.teamId = to; S.contract.teamId = to; S.contract.bias = o.bias;
  if (typeof calRebuildAfterTrade === 'function') calRebuildAfterTrade(se, p);   // the rest of the league's calendar is rebuilt around the new team's games
  se.trade = { from, to, after: p, pkg: o.pkg }; se.traded = true; se.tradeOffers = []; se.depth = buildDepth(to); se.role = curRoleKey(se);
  S.trades = (S.trades || []).concat({ year: se.year, from, to, after: p, pkg: o.pkg });
  S.contracts.push({ ...S.contract, type: 'Trade', startYear: S.year });
  saveGame();
}
const tradeLine = se => (se.stints && se.stints.length ? `<div class="muted small trade-line">↔ Traded from ${TEAM[se.stints[0].teamId].name} (${se.stints[0].w}–${se.stints[0].l}) after Game ${se.stints[0].g}</div>` : '');
function deadlineText(se) {
  const st = tradeStatus(se), left = TRADE_DEADLINE - se.games.length;
  if (st === 'used') return `🔁 Traded from ${TEAM[se.stints[0].teamId].name}`;
  if (st === 'today') return '⏰ TRADE DEADLINE DAY';
  if (st === 'open') return `⏰ Trade deadline: before Week ${deadlineWeek(se)} · ${left} game${left === 1 ? '' : 's'} left`;
  return se.status === 'regular' || se.status === 'playoffs' || se.status === 'done' ? '🔒 Trade deadline passed' : '';
}

// OVR -> 0..1 skill. Gains flatten above ~88 OVR so even 99-OVR players stay inside realistic NFL numbers
function skillOf(ovr) { let s = (ovr - 50) / 45; if (s > 0.85) s = 0.85 + (s - 0.85) * 0.55; return clamp(s, 0.03, 1.05); }

/* --- Playing one game ---------------------------------------------------- */
function playGame(season) {
  const P = S.player, pos = P.pos, cfg = POS[pos], po = season.po, notes = [];
  let kind, wk, oppId, home, mInfo = null;
  if (season.status === 'regular') {
    const sc = season.schedule[season.idx]; kind = 'REG'; wk = sc.week; oppId = sc.oppId; home = sc.home;
  } else {
    mInfo = poMatchup(season); kind = 'PO'; wk = mInfo.short; oppId = mInfo.oppId; home = po.mySeed < mInfo.oppSeed;
  }
  let mult = 1; // < 1 when playing hurt or after leaving the game early
  const depth = season.depth || (season.depth = buildDepth(season.teamId)); // saves from before depth charts
  let slot = depth.slot;
  if (slot > 1 && rnd() < 0.05) slot--; // the man ahead of you is out this week: you move up for a game

  // Availability: injured -> out (limited in the last recovery week); healthy backups may be inactive; otherwise roll for a new injury
  let st = 'ACTIVE', injNote = null, hurt = null, dnp = false;
  const inj = season.injury;
  if (inj) {
    if (inj.weeksLeft === 1 && rnd() < 0.5) { st = 'LIMITED'; mult *= 0.6; injNote = 'Played through ' + inj.name; }
    else { st = 'OUT'; injNote = inj.name; }
    inj.weeksLeft--;
    if (inj.weeksLeft <= 0) { season.injury = null; notes.push(`✅ ${inj.name}: fully recovered. You are cleared to play.`); }
  } else if (rnd() > atSlot(PLAYP, pos, slot)) {
    st = 'OUT'; dnp = true; injNote = "Coach's decision"; // not dressed / did not play
  } else if (rnd() < injuryChance(pos, P.age) * mgMods(season).inj) {
    hurt = rollInjury();
    season.injury = { name: hurt.name, weeks: hurt.weeks, weeksLeft: hurt.weeks };
    season.injuries.push({ name: hurt.name, weeks: hurt.weeks, wk, year: season.year });
    mult *= rr(0.35, 0.75); // left the game early
  }

  const myR = effRating(season, st !== 'OUT'), oppR = S.teamRatings[oppId];
  const diff = myR - oppR + (season.rigged ? 18 : 0) + mgMods(season).team;
  const baseMy = clamp(Math.round(gauss(22.5 + diff * 0.225, 8.2)), 3, 56);
  let s = {}, fp = 0, rate = null;
  if (st !== 'OUT') {
    // team volume for this game: favorites run a bit more, underdogs throw a bit more
    const sk = skillOf(P.ovr), gsc = clamp(diff * 0.0035, -0.08, 0.08);
    const pass = clamp(Math.round(gauss(34.5 * (1 - gsc) * (season.style || 1), 5.2)), 20, 54);
    const tg = { pass, rush: clamp(Math.round(gauss(27 + gsc * 30 - 0.3 * (pass - 34.5), 4)), 14, 42) };
    const c = {
      pos, s: sk, z: clamp((sk - 0.5) / 0.5, -1, 1), slot, mult, form: season.form * mgMods(season).perf, tg,
      ym: clamp(1 + diff * 0.004, 0.88, 1.12), tm: clamp(1 + diff * 0.006, 0.85, 1.15), matchup: clamp(1 + diff * 0.006, 0.8, 1.2),
      a: n => clamp((P.attrs[n] - 40) / 55, 0, 1), pts: baseMy, snap: snapShare(pos, slot) * Math.min(1, mult),
    };
    s = cfg.gen(c); fp = fantasyPts(pos, s); rate = ratingIdx(pos, fp);
  } else if (kind === 'REG' && !dnp) season.missed++;

  // Final score: team strength + the player's own contribution + noise; points never below what the player's own scores require
  const impact = st === 'OUT' || pos === 'K' ? 0 : cfg.impact * clamp((fp - cfg.bench) / cfg.bench, -1, 2.5) * snapShare(pos, slot) * Math.min(1, mult);
  let my = clamp(Math.round(baseMy + impact), 3, 56);
  let op = clamp(Math.round(gauss(22.5 - diff * 0.225, 8.2)), 3, 56);
  const td = sg(s.passTD) + sg(s.rushTD) + sg(s.recTD) + sg(s.defTD);
  if (pos !== 'K') my = Math.max(my, td * 7); // the team scored at least the player's own touchdowns
  if (my === op) { if (rnd() < logistic(diff * 0.064)) my += 3; else op += 3; } // overtime
  let win = my > op;
  // easter egg: the team wins every playoff game and loses 2-4 in the regular season; a lost game just flips its score (still a realistic result)
  if (season.rigged && !win && (kind === 'PO' || season.games.filter(g => !g.w).length >= (season.riggedCap = season.riggedCap || randInt(2, 4)))) { [my, op] = [op, my]; win = true; }

  const game = { k: kind, wk, round: mInfo ? mInfo.name : null, opp: oppId, home, my, op, w: win, tm: season.teamId, st, dnp, slot, inj: injNote, hurt, s, fp, rate, td };
  if (kind === 'PO' && typeof calPlayoffWhen === 'function') { const pw = calPlayoffWhen(season, wk); game.date = pw.date.toISOString().slice(0, 10); game.time = pw.time; game.slotName = pw.name; }
  if (kind === 'REG') {
    recordUserRes(season, season.idx, win);
    if (typeof calAfterUserGame === 'function') calAfterUserGame(season, season.idx, game);
    season.games.push(game); season.idx++;
    if (season.idx >= season.schedule.length) finalizeRegular(season, notes);
    else { tradeTick(season, notes); evalDepth(season, notes); }
  } else {
    season.playoffGames.push(game);
    resolvePlayoffRound(season, win, game, notes);
  }
  mgAfterGame(season, game, notes);
  return { game, notes };
}

function seasonTotals(season) {
  const T = { gp: 0, fp: 0 };
  const cfg = POS[S.player.pos];
  cfg.stats.forEach(x => { T[x.k] = 0; });
  season.games.forEach(g => {
    if (g.st === 'OUT') return;
    T.gp++; T.fp += g.fp;
    cfg.stats.forEach(x => { T[x.k] += (g.s[x.k] || 0); });
  });
  T.fp = r1(T.fp); T.ppg = T.gp ? T.fp / T.gp : 0;
  return T;
}
function careerTotals() {
  const T = { gp: 0, fp: 0 };
  POS[S.player.pos].stats.forEach(x => { T[x.k] = 0; });
  S.seasons.forEach(se => {
    const t = seasonTotals(se);
    Object.keys(T).forEach(k => { T[k] += t[k]; });
  });
  T.fp = r1(T.fp); T.ppg = T.gp ? T.fp / T.gp : 0;
  return T;
}
// Team record after the games played so far (follows the user's current team, so it survives trades)
const recOf = se => {
  const k = se.games.length, r = se.aiRes && se.aiRes[se.teamId];
  const w = r ? r.slice(0, k).split('').filter(x => x === '1').length : se.games.filter(g => g.w).length;
  return { w, l: k - w };
};

/* ---------------------------------------------------------------------
   8. AWARDS & PLAYER DEVELOPMENT
   --------------------------------------------------------------------- */
const AWARD_META = {
  SB_CHAMP: { icon: '🏆', label: 'Super Bowl Champion' }, SB_MVP: { icon: '🎖️', label: 'Super Bowl MVP' },
  MVP: { icon: '👑', label: 'NFL MVP' }, OPOY: { icon: '⚔️', label: 'Offensive Player of the Year' },
  DPOY: { icon: '🛡️', label: 'Defensive Player of the Year' }, ROY: { icon: '🌟', label: 'Rookie of the Year' },
  CPOY: { icon: '💪', label: 'Comeback Player of the Year' }, AP1: { icon: '🏅', label: 'First-Team All-Pro' },
  AP2: { icon: '🥈', label: 'Second-Team All-Pro' }, PB: { icon: '⭐', label: 'Pro Bowl' }, LEADER: { icon: '📈', label: 'League Leader' },
};
function computeAwards(season, T) {
  const out = [], P = S.player, pos = P.pos, cfg = POS[pos], th = cfg.awd, gp = T.gp;
  const add = (id, extra = '') => out.push({ id, icon: AWARD_META[id].icon, label: AWARD_META[id].label + extra });
  const wins = season.record ? season.record.w : 8;
  const ppg = gp ? T.fp / gp : 0, eff = ppg + (wins - 8.5) * 0.08;
  const roll = (thr, spread) => rnd() < logistic((eff - thr) / spread);
  const off = ['QB', 'RB', 'WR', 'TE'].includes(pos), def = cfg.side === 'D';

  if (season.po && season.po.champion) {
    add('SB_CHAMP');
    const sb = season.playoffGames[season.playoffGames.length - 1];
    if (sb && sb.st !== 'OUT' && pos !== 'OL') {
      const sc = sb.fp / cfg.bench;
      if (rnd() < clamp(logistic((sc - 1.9) / 0.28) * (pos === 'QB' ? 1.3 : 1), 0, 0.95)) add('SB_MVP');
    }
  }
  let mvp = false;
  if (off && gp >= 13) {
    const thr = th.lead * (pos === 'QB' ? 1.04 : 1.18), tf = wins >= 12 ? 1 : wins >= 10 ? 0.6 : 0.15;
    if (rnd() < logistic((eff - thr) / (thr * 0.04)) * tf) { mvp = true; add('MVP'); }
  }
  if (off && !mvp && gp >= 12 && rnd() < logistic((eff - th.lead * 0.97) / (th.lead * 0.04))) add('OPOY');
  if (def && gp >= 12 && rnd() < logistic((eff - th.lead * 0.97) / (th.lead * 0.04))) add('DPOY');
  if (season.rookie && gp >= 10 && (off || def) && rnd() < logistic((eff - th.pb * 0.9) / (th.pb * 0.06))) add('ROY', off ? ' (Offensive)' : ' (Defensive)');
  const prev = S.seasons.length >= 2 ? S.seasons[S.seasons.length - 2] : null;
  if (prev && prev.missed >= 6 && gp >= 12 && eff >= th.pb * 0.85 && rnd() < 0.5) add('CPOY');

  if (gp >= 9) {
    const ap1 = roll(th.ap1, th.ap1 * 0.045), ap2 = !ap1 && roll(th.ap2, th.ap2 * 0.045);
    if (ap1) add('AP1'); else if (ap2) add('AP2');
    if (ap1 || ap2 || roll(th.pb, th.pb * 0.05)) add('PB');
  }
  if (gp >= 12) cfg.leaders.forEach(([k, label, thr]) => { if (T[k] >= thr * rr(0.95, 1.08)) add('LEADER', ` — ${label}`); });
  return out;
}

const DECLINE_MULT = { QB: .6, K: .45, OL: .85, RB: 1.4, WR: 1.1, CB: 1.15, S: 1, TE: 1, DL: 1.05, LB: 1.1 };
/* Two clocks: athleticism (speed, strength, burst…) peaks early and fades from 28; technique and football IQ keep growing into the early 30s and only fade late. */
const GROW_PHYS = { 21: 2.9, 22: 2.5, 23: 2.0, 24: 1.5, 25: 1.1, 26: 0.7, 27: 0.3 };
const GROW_MENT = { 21: 2.9, 22: 2.5, 23: 2.0, 24: 1.5, 25: 1.1, 26: 0.8, 27: 0.55, 28: 0.4, 29: 0.25, 30: 0.1, 31: 0 };
const FADE_PHYS = [-0.3, -0.8, -1.4, -2.0, -2.6, -3.2, -3.8];           // ages 28, 29, 30 …
const FADE_MENT = [-0.2, -0.5, -0.9, -1.3, -1.8];                       // ages 32, 33, 34 …
function ageDelta(age, phys, pos) {
  let d;
  if (phys) d = age <= 27 ? GROW_PHYS[Math.max(21, age)] : FADE_PHYS[Math.min(age - 28, 6)];
  else d = age <= 31 ? GROW_MENT[Math.max(21, age)] : FADE_MENT[Math.min(age - 32, 4)];
  if (d > 0 && pos === 'RB' && age >= 27) d -= 0.6;
  return d < 0 ? d * DECLINE_MULT[pos] : d;
}
const stochRound = v => { const f = Math.floor(v); return f + (rnd() < v - f ? 1 : 0); };
// Offseason progression: age curve per attribute type + your season (counts a lot) + the training you chose + serious injuries.
// The yearly overall change is kept in a believable band: a good, healthy season never wrecks your rating, a bad one never skyrockets it.
function develop(season, T) {
  const P = S.player, cfg = POS[P.pos], age = season.age, gp = T.gp;
  const idx = gp >= 4 ? (T.fp / gp) / expPPG(P.pos, season.depth ? season.depth.slot : 1) : 1;
  const greatShare = gp ? season.games.filter(g => g.st !== 'OUT' && g.rate >= 4).length / gp : 0;
  const perf = gp >= 4 ? clamp(idx - 1, -0.6, 1.0) + (greatShare - 0.15) * 0.8 : 0;
  const physNames = cfg.attrs.filter(a => a[2]).map(a => a[0]);
  const injPen = {};
  season.injuries.filter(i => i.weeks >= 9).forEach(() => shuffle(physNames).slice(0, 2).forEach(n => { injPen[n] = (injPen[n] || 0) + randInt(1, 3); }));
  if (season.injExtra) shuffle(physNames).slice(0, 2).forEach(n => { injPen[n] = (injPen[n] || 0) + Math.ceil(season.injExtra / 2); });   // rushed back and re-injured
  const tr = season.train || { phys: 0, ment: 0 };
  const camp = season.mgLog && season.mgLog.length ? (season.mgLog[0].score - 2.5) * 0.6 : 0;   // preseason camp mini game
  const ovrFrom = P.ovr, why = { age: 0, camp: 0, season: 0, training: 0, injury: 0 };
  const rawD = {};
  cfg.attrs.forEach(([name, , phys]) => {
    let base = ageDelta(age, !!phys, P.pos);
    if (base > 0) base *= P.devMult;
    const sp = perf * (phys ? 0.55 : 1.0) * (age <= 30 ? 1 : 0.7);         // technique responds more to how you played
    const trn = phys ? tr.phys : tr.ment, inj = injPen[name] || 0;
    const cp = camp * (phys ? 0.55 : 1.0) * (age <= 30 ? 1 : 0.7);
    rawD[name] = stochRound(base + sp + cp + trn + gauss(0, 0.55) - inj);
    why.age += base; why.season += sp; why.camp += cp; why.training += trn; why.injury -= inj;
  });
  Object.keys(why).forEach(k => { why[k] = Math.round(why[k] / cfg.attrs.length * 10) / 10; });
  const apply = () => cfg.attrs.forEach(([name]) => { const d = rawD[name]; P.attrs[name] = clamp(P.attrs[name] + d, 35, 99); });
  const before = { ...P.attrs };
  cfg.attrs.forEach(([name]) => { let d = rawD[name]; if (d > 0 && before[name] >= 88) d = Math.round(d * 0.4); rawD[name] = d; });
  apply();
  // guard rails on the overall
  const serious = Object.keys(injPen).length > 0, perfC = perf + camp * 0.3, good = perfC > 0.35 && gp >= 8, poor = perfC < -0.2;
  const floor = serious ? -6 : good ? (age <= 28 ? 0 : age <= 31 ? -1 : -2) : (age <= 27 ? -2 : -5);
  const ceil = poor ? (age <= 24 ? 3 : age <= 27 ? 2 : 1) : age >= 30 ? 2 : 7;
  let ovr = calcOvr(P.pos, P.attrs), guard = 0, smoothed = 0;
  while ((ovr < ovrFrom + floor || ovr > ovrFrom + ceil) && guard++ < 60) {
    const up = ovr < ovrFrom + floor, pickA = cfg.attrs.filter(([n]) => (up ? P.attrs[n] < 99 : P.attrs[n] > 35))[Math.floor(rnd() * cfg.attrs.length)] || cfg.attrs[0];
    P.attrs[pickA[0]] = clamp(P.attrs[pickA[0]] + (up ? 1 : -1), 35, 99); smoothed += up ? 1 : -1;
    ovr = calcOvr(P.pos, P.attrs);
  }
  P.ovr = ovr;
  const changes = cfg.attrs.map(([name]) => ({ attr: name, from: before[name], to: P.attrs[name], d: P.attrs[name] - before[name] }));
  return { ovrFrom, ovrTo: P.ovr, changes, injured: serious, why, smoothed, perfIdx: Math.round(perf * 100) / 100 };
}

function finishSeason() {
  const season = curSeason();
  if (season.complete) return;
  const T = seasonTotals(season);
  if (!season.record) { const r = recOf(season); season.record = r; }
  season.complete = true; season.league = null;   // the calendar of a finished season is no longer kept (saves stay small)
  season.awards = computeAwards(season, T);
  const prevBest = Math.max(0, ...S.seasons.slice(0, -1).filter(s => !s.partial).map(s => { const t = seasonTotals(s); return t.gp >= 8 ? t.ppg : 0; }));
  season.careerBest = S.seasons.length > 1 && T.gp >= 8 && T.ppg > prevBest;
  season.salary = S.contract.aav; S.earnings += S.contract.aav; S.contract.yearsLeft--;
  season.dev = develop(season, T);
  // Unfinished injuries carry over into next season (6 weeks of offseason healing)
  if (season.injury) {
    const left = season.injury.weeksLeft - 6;
    S.carryInjury = left > 0 ? { name: season.injury.name, weeks: season.injury.weeks, weeksLeft: left } : null;
  }
  S.phase = 'summary';
  saveGame();
}

/* ---------------------------------------------------------------------
   9. FREE AGENCY
   --------------------------------------------------------------------- */
const VAL_TABLE = [[55, 1.0], [60, 1.4], [65, 2.6], [70, 5.5], [75, 10], [80, 17], [85, 26], [90, 35], [95, 43], [100, 50]];
const PAY_MULT = { QB: 1.55, WR: 1.0, RB: 0.7, TE: 0.7, OL: 0.95, DL: 1.1, LB: 0.8, CB: 0.95, S: 0.65, K: 0.12 };
const minSalary = () => (S.player.pos === 'K' ? 0.9 : 1.2);
function marketAAV() {
  const P = S.player, nextAge = P.age + 1, last = curSeason();
  const T = seasonTotals(last), idx = T.gp >= 4 ? (T.fp / T.gp) / expPPG(P.pos, last.depth ? last.depth.slot : 1) : 1;
  const ageM = nextAge <= 26 ? 1.05 : nextAge <= 28 ? 1 : nextAge === 29 ? .95 : nextAge === 30 ? .86 : nextAge === 31 ? .76 : nextAge === 32 ? .65 : .5;
  return Math.max(minSalary(), interp(P.ovr, VAL_TABLE) * PAY_MULT[P.pos] * ageM * clamp(1 + 0.15 * (idx - 1), 0.88, 1.15));
}
const INTEREST = ['Low', 'Medium', 'High', 'Very High'];
function mkOffer(teamId, mv, cool, isCur) {
  const P = S.player, nextAge = P.age + 1;
  const f = (isCur ? rr(0.88, 1.06) : rr(0.84, 1.22)) * cool;
  const years = nextAge <= 27 ? randInt(3, 5) : nextAge <= 29 ? randInt(3, 4) : nextAge <= 31 ? randInt(2, 3) : nextAge <= 34 ? randInt(1, 2) : 1;
  const aav = Math.max(minSalary(), mv * f), total = r1(aav * years);
  const gPct = clamp(0.62 - (nextAge - 24) * 0.03 + rr(-0.1, 0.1) - (years <= 2 ? 0.1 : 0), 0.2, 0.8);
  const bias = isCur ? randInt(0, 4) : randInt(-2, 5);
  const score = f / cool;
  let it = score > 1.12 ? 3 : score > 1.0 ? 2 : score > 0.9 ? 1 : 0;
  if (rnd() < 0.25) it = clamp(it + (rnd() < 0.5 ? -1 : 1), 0, 3);
  return { id: uid(), teamId, years, total, guaranteed: r1(total * gPct), bias, role: roleText(P.pos, projSlot(teamId, P.ovr, bias, P.pos), P.ovr), interest: it, isCur };
}
function genOffers(round) {
  const P = S.player, mv = marketAAV(), cool = Math.pow(0.92, round);
  let n = P.ovr >= 85 ? 6 : P.ovr >= 75 ? 5 : P.ovr >= 65 ? 4 : 3;
  if (P.age + 1 >= 33) n = Math.max(2, n - 2);
  const others = shuffle(TEAM_LIST.map(t => t.id).filter(id => id !== S.teamId)).slice(0, n - 1);
  return [S.teamId, ...others].map((id, i) => mkOffer(id, mv, cool, i === 0));
}
function lastChanceOffer() {
  const total = r1(minSalary() * 1.1);
  return { id: uid(), teamId: S.teamId, years: 1, total, guaranteed: r1(total * 0.2), bias: 0, role: roleText(S.player.pos, projSlot(S.teamId, S.player.ovr, 0, S.player.pos), S.player.ovr), interest: 0, isCur: true, last: true };
}

/* ---------------------------------------------------------------------
   10. UI HELPERS
   --------------------------------------------------------------------- */
/* ---------------------------------------------------------------------
   AUDIO — calm, ASMR-style sounds, all synthesized with the Web Audio API (no files needed).
   Palette: soft wooden taps, kalimba-like plucks, singing-bowl tones, a breath of air, and tiny "rain-like" applause.
   Everything is quiet, low-passed and slightly panned left/right. Browsers only allow audio after a click, so the
   engine wakes up on the first click. Snd.play(name, delaySeconds, ...args) is safe to call anywhere.
   --------------------------------------------------------------------- */
const Snd = (() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  const VOLUME = 0.7;
  let ctx = null, master = null, noiseBuf = null, whiteBuf = null, muted = false;
  // the mute switch is NOT remembered between visits: a stray tap on the 🔇 button must never leave the game silent for good
  try { localStorage.removeItem('nfl_sound_muted'); } catch (e) { /* ignore */ }

  function init() {
    if (ctx) return true;
    if (!AC) return false;
    ctx = new AC();
    ctx.onstatechange = () => { if (!muted && ctx && ctx.state !== 'running' && !document.hidden) ctx.resume().catch(() => {}); };
    master = ctx.createGain(); master.gain.value = muted ? 0 : VOLUME;
    const soften = ctx.createBiquadFilter(); soften.type = 'lowpass'; soften.frequency.value = 3800; soften.Q.value = 0.3; // takes the edge off everything
    const comp = ctx.createDynamicsCompressor();
    master.connect(soften); soften.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04; d[i] = last; } // brown-ish noise: warm, not hissy
    let pk = 0; for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); for (let i = 0; i < d.length; i++) d[i] = (d[i] / pk) * 0.9; // normalize
    whiteBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); // plain noise for crisp taps and applause
    const w = whiteBuf.getChannelData(0); for (let i = 0; i < w.length; i++) w[i] = (Math.random() * 2 - 1) * 0.9;
    return true;
  }
  // route a node to the output with a gentle random stereo position
  function out(node, pan) {
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan === undefined ? rr(-0.35, 0.35) : pan; node.connect(p); p.connect(master); } else node.connect(master);
  }
  function env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  // soft sine tone with a slow-ish attack and long decay
  function tone(f, t, dur, o = {}) {
    const { vol = 0.08, attack = 0.02, to = null, pan } = o;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(f, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + attack + dur);
    env(g, t, attack, dur, vol); osc.connect(g); out(g, pan);
    osc.start(t); osc.stop(t + attack + dur + 0.05);
  }
  function noise(t, dur, o = {}) {
    const { type = 'lowpass', f = 1200, to = null, q = 0.7, vol = 0.05, attack = 0.005, pan, crisp = false } = o;
    const src = ctx.createBufferSource(); src.buffer = crisp ? whiteBuf : noiseBuf; src.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain(); env(g, t, attack, Math.max(0.03, dur - attack), vol);
    src.connect(fl); fl.connect(g); out(g, pan); src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  // kalimba / music-box pluck: warm fundamental + a faint, quickly fading overtone
  function pluck(f, t, vol = 0.07) { const pan = rr(-0.3, 0.3); tone(f, t, 1.0, { vol, attack: 0.004, pan }); tone(f * 2, t, 0.35, { vol: vol * 0.22, attack: 0.003, pan }); }
  // singing bowl: sine partials at bowl-like ratios, long calm decay
  function bowl(f, t, vol = 0.05) { [[1, 3.4, 1], [2.756, 2.2, 0.3], [5.404, 1.1, 0.1]].forEach(([r, d, v]) => tone(f * r, t, d, { vol: vol * v, attack: 0.04, pan: 0 })); }
  // finger tap on wood: a tiny filtered noise tick + a very short low thump
  function tap(t, vol = 0.08, f = 1500) { noise(t, 0.04, { type: 'lowpass', f, vol: vol * 2.2, attack: 0.002, crisp: true }); tone(210, t, 0.05, { vol: vol * 0.7, attack: 0.002, to: 130 }); }
  // soft heartbeat-like thump
  function thump(t, vol = 0.16) { tone(95, t, 0.28, { vol, attack: 0.01, to: 55 }); }
  // a breath of air
  function air(t, dur = 0.9, vol = 0.05) { noise(t, dur, { type: 'bandpass', f: 350, to: 900, q: 0.5, vol: vol * 3, attack: dur * 0.4 }); }
  // quiet applause: many tiny taps scattered in time and space, like light rain
  function applause(t, dur = 1.2, vol = 0.03) {
    for (let i = 0; i < Math.round(dur * 26); i++) noise(t + rnd() * dur, 0.025, { type: 'bandpass', f: rr(1100, 2600), q: 1.2, vol: rr(0.4, 1) * vol * 2.4, attack: 0.002, crisp: true });
  }
  // ---- ASMR palette: soft textures (brushes, taps, paper, a faint wood knock). Nothing repeats the same pitch, and nothing sings a melody. ----
  const PIT = [196, 220, 247, 262, 294];
  // a soft finger/brush tap: a tiny band of noise at a random spot + a barely-there low knock
  function soft(t, vol = 0.06) { noise(t, 0.035, { type: 'bandpass', f: rr(1300, 2600), q: 0.9, vol: vol * 2.4, attack: 0.002, crisp: true }); tone(rr(150, 200), t, 0.04, { vol: vol * 0.25, attack: 0.002, to: 110 }); }
  // a brush over fabric / a breath: band-passed noise that slides up or down
  function brush(t, dur = 0.35, vol = 0.04, up = true) { const lo = rr(600, 800), hi = rr(1500, 2100); noise(t, dur, { type: 'bandpass', f: up ? lo : hi, to: up ? hi : lo, q: 0.55, vol: vol * 3, attack: dur * 0.45 }); }
  // a tiny glassy droplet at a random pitch (never the same twice)
  function ping(t, vol = 0.02) { tone(rr(1500, 2700), t, 0.28, { vol, attack: 0.003, pan: rr(-0.4, 0.4) }); }
  // one low, quiet bowl note for the big moments (random from a few low notes)
  function hum(t, vol = 0.03) { const f = PIT[Math.floor(rnd() * PIT.length)]; tone(f, t, 2.2, { vol, attack: 0.25, pan: 0 }); tone(f * 2.01, t, 1.2, { vol: vol * 0.25, attack: 0.3, pan: 0 }); }

  const lib = {
    click: t => soft(t, 0.05),
    tick: t => soft(t, 0.03),
    clock: t => { for (let i = 0; i < 4; i++) soft(t + i * 0.55, 0.025); },
    drum: t => thump(t, 0.1),
    pick: t => { thump(t, 0.12); brush(t + 0.25, 0.5, 0.035, true); ping(t + 0.7, 0.014); },
    fanfare: t => { brush(t, 0.6, 0.04, true); ping(t + 0.35, 0.016); ping(t + 0.5, 0.012); hum(t + 0.2, 0.022); },
    bigFanfare: t => { hum(t, 0.035); brush(t + 0.1, 1.2, 0.04, true); [0.4, 0.6, 0.85, 1.05].forEach(d => ping(t + d, 0.013)); air(t + 0.3, 1.6, 0.03); applause(t + 1.2, 2.2, 0.024); },
    roar: t => { air(t, 1.8, 0.04); applause(t + 0.2, 1.6, 0.022); },
    cheer: t => applause(t, 1.0, 0.04),
    whistle: t => { brush(t, 0.22, 0.03, true); soft(t + 0.18, 0.03); },
    horn: t => { thump(t, 0.07); brush(t + 0.05, 0.4, 0.03, true); },
    td: t => { thump(t, 0.09); brush(t + 0.05, 0.6, 0.035, true); ping(t + 0.3, 0.014); applause(t + 0.3, 1.5, 0.022); },
    win: t => { brush(t, 0.5, 0.035, true); ping(t + 0.3, 0.014); },
    lose: t => { brush(t, 0.55, 0.03, false); },
    boo: t => tone(rr(150, 190), t, 0.7, { vol: 0.02, attack: 0.15, to: 120 }),
    injury: t => { thump(t, 0.09); brush(t + 0.05, 0.6, 0.025, false); },
    chime: (t, f) => { ping(t, 0.02); hum(t, 0.015); },
    up: t => { brush(t, 0.5, 0.035, true); ping(t + 0.3, 0.013); ping(t + 0.42, 0.01); },
    down: t => { brush(t, 0.45, 0.03, false); },
    whoosh: t => air(t, 0.8, 0.035),
    penScratch: t => noise(t, 0.08, { type: 'bandpass', f: rr(2400, 3800), q: 1.1, vol: 0.04, attack: 0.008, crisp: true }),
    cash: t => { soft(t, 0.04); ping(t + 0.06, 0.012); },
    contract: t => { lib.cash(t); lib.fanfare(t + 0.3); applause(t + 1, 1.4, 0.02); },
    seasonEnd: t => { hum(t, 0.03); brush(t + 0.15, 0.8, 0.03, false); },
    draftEnd: t => { ping(t, 0.016); brush(t, 0.7, 0.03, true); applause(t + 0.2, 1.2, 0.03); },
    anthem: t => { hum(t, 0.03); hum(t + 0.9, 0.025); },
    phone: t => { soft(t, 0.04); soft(t + 0.5, 0.04); soft(t + 1.0, 0.04); },
    // ---- mini games: very quiet, single events (no loops), a little random pitch each time so it never feels repetitive ----
    mgSnap: t => { thump(t, 0.1); noise(t, 0.06, { type: 'lowpass', f: 900, vol: 0.06, crisp: true, attack: 0.002 }); },
    mgThrow: t => { air(t, 0.55, 0.03); tone(rr(300, 380), t, 0.3, { vol: 0.014, attack: 0.08, to: rr(520, 640) }); },
    mgPat: t => { noise(t, 0.06, { type: 'bandpass', f: rr(620, 820), q: 0.8, vol: 0.1, attack: 0.002, crisp: true }); tone(rr(140, 170), t, 0.1, { vol: 0.09, attack: 0.002, to: 90 }); },
    mgKick: t => { thump(t, 0.2); noise(t, 0.12, { type: 'lowpass', f: 1500, vol: 0.07, crisp: true, attack: 0.002 }); air(t + 0.06, 0.9, 0.028); },
    mgHit: t => { thump(t, 0.15); noise(t, 0.09, { type: 'lowpass', f: 650, vol: 0.07, attack: 0.002 }); },
    mgSwish: t => air(t, 0.35, 0.03),
    mgGood: (t, lvl = 0) => { ping(t, 0.02); if (lvl >= 2) ping(t + 0.09, 0.012); },
    mgMiss: t => tone(rr(130, 165), t, 0.55, { vol: 0.035, attack: 0.06, to: 105 }),
    mgCrowd: (t, lvl = 1) => { noise(t, 1.1 * lvl, { type: 'bandpass', f: 420, to: 650, q: 0.6, vol: 0.022, attack: 0.45 }); applause(t + 0.25, 0.7 * lvl, 0.012); },
    mgTension: t => tone(115, t, 1.5, { vol: 0.025, attack: 0.7, to: 150 }),
    mgTick: t => tap(t, 0.04, rr(800, 1000)),
    mgPost: t => { tone(1318, t, 0.9, { vol: 0.03, attack: 0.002 }); tone(1980, t, 0.5, { vol: 0.012, attack: 0.002 }); noise(t, 0.05, { type: 'bandpass', f: 2200, q: 1.5, vol: 0.05, crisp: true, attack: 0.001 }); },
    trade: t => { air(t, 0.7, 0.035); ping(t + 0.3, 0.014); ping(t + 0.45, 0.012); applause(t + 0.5, 1.0, 0.02); },
  };

  // browsers pause audio on their own (idle tab, 'interrupted' on Safari/iOS, a closed context): wake it up again, or rebuild it
  function revive() {
    if (!ctx) return Promise.resolve(false);
    if (ctx.state === 'closed') { ctx = null; if (!init()) return Promise.resolve(false); }
    if (ctx.state === 'running') return Promise.resolve(true);
    return Promise.race([ctx.resume().then(() => ctx.state === 'running'), new Promise(r => setTimeout(() => r(false), 400))]).catch(() => false);
  }
  function unlock() { if (init()) revive(); }
  function play(name, delay = 0, ...args) {
    if (muted || !init()) return;
    const f = lib[name];
    const go = () => { if (f) { try { f(ctx.currentTime + 0.02 + delay, ...args); } catch (e) { /* never break the game over a sound */ } } };
    if (ctx.state === 'running') go(); else revive().then(ok => { if (ok) go(); });
  }
  // Phones are picky: the audio context must be created / resumed INSIDE a tap (iOS only counts touchend / click, not touchstart), and iOS keeps Web Audio silent
  // while the ringer switch is off unless the page asks for the "playback" audio session. So: build it on the first gesture of any kind and prime the session once.
  let primed = false;
  function primeSession() {
    if (primed) return; primed = true;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ignore */ }
    try { const b = ctx.createBuffer(1, 1, 22050), src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(0); } catch (e) { /* ignore */ }
    try { const au = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='); au.volume = 0.01; const p = au.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
  }
  ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend', 'keydown'].forEach(ev => window.addEventListener(ev, () => {
    if (muted) return;
    if (!ctx) init();
    if (ctx) { primeSession(); if (ctx.state !== 'running') revive(); }
  }, { passive: true, capture: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !muted && ctx && ctx.state !== 'running') revive(); });
  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : VOLUME, ctx.currentTime, 0.05);
    if (!m) unlock();
  }
  return { play, unlock, setMuted, isMuted: () => muted };
})();

/* ---------------------------------------------------------------------
   THEME, BACKDROP & JERSEYS
   --------------------------------------------------------------------- */
// Light / dark theme (saved in localStorage, applied on <html data-theme>)
const Theme = {
  get() { try { return localStorage.getItem('nfl_theme') || 'dark'; } catch (e) { return 'dark'; } },
  set(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem('nfl_theme', t); } catch (e) { /* ignore */ } },
};

// Jersey numbers follow the NFL's position rules, so a QB can't wear #99
const NUM_RULES = { QB: [[0, 19]], RB: [[0, 49], [80, 89]], WR: [[0, 19], [80, 89]], TE: [[0, 49], [80, 89]], OL: [[50, 79]], DL: [[50, 79], [90, 99]], LB: [[0, 59], [90, 99]], CB: [[0, 49]], S: [[0, 49]], K: [[0, 19]] };
const NUM_DEFAULT = { QB: 12, RB: 22, WR: 11, TE: 88, OL: 72, DL: 94, LB: 54, CB: 24, S: 29, K: 3 };
const numberOk = (pos, n) => Number.isInteger(n) && NUM_RULES[pos].some(([a, b]) => n >= a && n <= b);
const numberRule = pos => NUM_RULES[pos].map(([a, b]) => `${a}–${b}`).join(' or ');
const randomNumber = pos => { const r = pick(NUM_RULES[pos]); return randInt(r[0], r[1]); };
const surname = name => (String(name).trim().split(/\s+/).pop() || '');
const playerNumber = () => (S && S.player && Number.isInteger(S.player.number) ? S.player.number : NUM_DEFAULT[S.player.pos]);
// What the back of the jersey says is NOT the player's name: it has its own field (defaults to the last name)
const cleanJerseyName = s => String(s || '').toUpperCase().replace(/[^A-Z0-9ÁÉÍÓÚÑÜ .'\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
const jName = p => cleanJerseyName(p.jerseyName) || cleanJerseyName(surname(p.name)) || 'ROOKIE';

/* =====================================================================
   NFL JERSEY CREATOR — design model + 2D SVG renderer (no DOM here)
   The jersey is drawn with SVG paths traced from the reference uniform sheet (uniform-shapes.js -> UNI), split into zones:
   body, left/right sleeve, shoulders (yoke), collar, side panels, cuffs, shoulder stripes, sleeve stripes + name & number.
   Design state (one per team, saved in S.jerseys[teamId]):
   { primary, secondary, accent, pattern, <element flags>, parts:{body,sleeveL,sleeveR,collar,shoulders,sidePanels,cuffs,decor},
     numFont, numColor, numOutline, numOutlineW, numSize, numY, nameFont, nameColor, nameOutline, nameOutlineW, nameSize, textCustom }
   ===================================================================== */
const JERSEY_BLACK = '#111418';
// the team's two logo colors, with near-black ones unified to our standard black
const jcIsAlt = key => typeof key === 'string' && key[1] === ':';          // 'c:Alabama' (college) / 'y:Pumas' (youth) jersey keys
const teamCols = key => {
  const nb = c => (lum(c) < 0.08 ? JERSEY_BLACK : c);
  if (jcIsAlt(key)) { const b = key[0] === 'c' ? collegeJerseyBase(key.slice(2)) : youthJerseyBase(key.slice(2)); return [nb(b.primary), nb(b.secondary)]; }
  const t = TEAM[key]; return [nb(t.c1), nb(t.c2)];
};
const contrastOn = hex => (lum(hex) > 0.58 ? '#111418' : '#FFFFFF');
function mixHex(a, b, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const sameHex = (a, b) => !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();

/* ---- patterns: each one is a recipe over the design elements, so patterns can be combined with the toggles ---- */
const JC_EL_DEFAULT = { sleeveStripes: false, retro: false, sidePanels: false, colorBlock: false, gradient: false, cuffs: false, hemTrim: false, collarContrast: true };
const JC_PATTERNS = [
  { k: 'solid', label: 'Solid', el: {} },
  { k: 'sleeve', label: 'Sleeve Stripes', el: { sleeveStripes: true, cuffs: true } },
  { k: 'side', label: 'Side Panels', el: { sidePanels: true } },
  { k: 'block', label: 'Color Block', el: { colorBlock: true, cuffs: true } },
  { k: 'gradient', label: 'Gradient', el: { gradient: true } },
  { k: 'minimal', label: 'Minimal', el: { collarContrast: false, hemTrim: true } },
  { k: 'retro', label: 'Retro', el: { sleeveStripes: true, retro: true, cuffs: true, hemTrim: true } },
];
const JC_DETAILS = [['sidePanels', 'Side panels'], ['colorBlock', 'Color block'], ['gradient', 'Gradient'], ['cuffs', 'Cuffs'], ['hemTrim', 'Hem trim'], ['collarContrast', 'Contrast collar']];
const JC_PARTS = [['body', 'Body'], ['sleeveL', 'Left Sleeve'], ['sleeveR', 'Right Sleeve'], ['collar', 'Collar'], ['shoulders', 'Shoulders'], ['sidePanels', 'Side Panels'], ['cuffs', 'Cuffs'], ['swoosh', 'Nike swoosh'], ['decor', 'Decorative elements'], ['decorMid', 'Sleeve middle line'], ['shStripe', 'Shoulder lines'], ['shStripeMid', 'Shoulder middle line']];
// cap = cap-height / font-size (calibrated once the fonts load, see jcCalibrate), wf = average glyph width / font-size
const JC_FONTS = [
  { k: 'jets', label: 'NFL Jets', css: "'Saira Extra Condensed'", w: 900, cap: 0.70, wf: 0.36, glyph: true },   // numbers use the traced glyphs (fonts-jets.js); names use the closest font
  { k: 't_sf', label: '49ers', css: "'Rye'", w: 400, cap: 0.76, wf: 0.73 },
  { k: 'oldsport', label: 'Old Sport Athletic', css: "'Old Sport Athletic'", w: 400, cap: 0.73, wf: 0.65 },       // fontspace.com fonts, in assets/fonts
  { k: 'jackport', label: 'Jackport College', css: "'Jackport College'", w: 400, cap: 0.73, wf: 0.47 },
  { k: 'jerseym54', label: 'Jersey M54', css: "'Jersey M54'", w: 400, cap: 0.77, wf: 0.51 },
  { k: 'maldini', label: 'Maldini', css: "'Maldini'", w: 400, cap: 0.70, wf: 0.47 },
];
const jcFont = k => JC_FONTS.find(f => f.k === k) || JC_FONTS[0];
function jcCalibrate() { // measure the real cap height of each font so numbers always have the same visual height
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    Promise.all(JC_FONTS.map(f => document.fonts.load(`${f.w} 100px ${f.css}`).catch(() => {}))).then(() => {
      JC_FONTS.forEach(f => { ctx.font = `${f.w} 100px ${f.css}`; const m = ctx.measureText('H'); if (m.actualBoundingBoxAscent > 30) f.cap = m.actualBoundingBoxAscent / 100; });
      if (typeof S !== 'undefined' && S && S.phase && document.querySelector('.jc2')) renderLocker(true);
    });
  } catch (e) { /* keep the estimated values */ }
}

/* ---- color palettes: built only from the team's own colors (+ black / white) ---- */
function jcPalettes(teamId) {
  const [c1, c2] = teamCols(teamId), main = lum(c1) > 0.72 ? c2 : c1, sub = sameHex(main, c1) ? c2 : c1;
  const acc = (s, pref) => (!sameHex(pref, s) && Math.abs(lum(pref) - lum(s)) > 0.12 ? pref : contrastOn(s));
  const team = [
    { k: 'home', label: 'Home', p: c1, s: c2, a: acc(c2, '#FFFFFF') },
    { k: 'away', label: 'Away', p: '#FFFFFF', s: main, a: acc(main, sub) },
    { k: 'alternate', label: 'Alternate', p: JERSEY_BLACK, s: main, a: '#FFFFFF' },
    { k: 'throwback', label: 'Throwback', p: lum(c2) < 0.12 ? '#FFFFFF' : c2, s: c1, a: '#FFFFFF' },
    { k: 'inverse', label: 'Inverse', p: c2, s: c1, a: '#FFFFFF' },
  ];
  team.push(
    { k: 'blackout', label: 'Blackout', p: JERSEY_BLACK, s: c1, a: acc(c1, c2) },
    { k: 'rush', label: 'Color Rush', p: c1, s: mixHex(c1, '#000000', 0.45), a: acc(mixHex(c1, '#000000', 0.45), c2) },
    { k: 'whiteout', label: 'Whiteout', p: '#FFFFFF', s: c2, a: acc(c2, c1) });
  const seen = new Set();
  return team.map(x => (sameHex(x.a, x.p) ? { ...x, a: acc(x.p, x.s) } : x))
    .filter(x => { const key = (x.p + x.s).toLowerCase(); if (sameHex(x.p, x.s) || seen.has(key)) return false; seen.add(key); return true; });
}

// the only colors you can pick are the team's own (plus white / black) and a few shades of them
function jcSwatches(teamId) {
  const [c1, c2] = teamCols(teamId), out = [];
  const dist = (x, y) => [1, 3, 5].reduce((t, i) => t + Math.abs(parseInt(x.slice(i, i + 2), 16) - parseInt(y.slice(i, i + 2), 16)), 0);
  [c1, c2, '#FFFFFF', JERSEY_BLACK, mixHex(c1, '#000000', 0.4), mixHex(c1, '#FFFFFF', 0.4), mixHex(c2, '#000000', 0.4), mixHex(c2, '#FFFFFF', 0.4)].forEach(h => { if (!out.some(x => dist(x, h) < 48)) out.push(h.toUpperCase()); });
  return out.slice(0, 8);
}
/* ---- design state helpers ---- */
// number / name colors follow the jersey unless the user picked their own
function autoText(c) {
  if (c.textCustom) return c;
  const nc = contrastOn(c.primary);
  c.numColor = nc;
  c.numOutline = Math.abs(lum(c.accent) - lum(nc)) > 0.25 ? c.accent : (Math.abs(lum(c.secondary) - lum(nc)) > 0.25 ? c.secondary : (nc === '#FFFFFF' ? JERSEY_BLACK : '#FFFFFF'));
  c.nameColor = nc; c.nameOutline = c.numOutline;
  return c;
}
function applyPattern(c, k) {
  const pt = JC_PATTERNS.find(p => p.k === k) || JC_PATTERNS[0];
  return { ...c, ...JC_EL_DEFAULT, ...pt.el, pattern: pt.k, sleeveCount: undefined };
}
const patternMatches = (c, k) => { const pt = JC_PATTERNS.find(p => p.k === k), want = { ...JC_EL_DEFAULT, ...pt.el }; return Object.keys(want).every(e => !!c[e] === want[e]); };
function newJersey(pal, pattern = 'solid') {
  const base = { primary: pal.p, secondary: pal.s, accent: pal.a, pattern: 'solid', ...JC_EL_DEFAULT, parts: {}, numFont: 'jets', nameFont: 'jets', numSize: 100, numY: 0, nameSize: 100, numOutlineW: 2.4, nameOutlineW: 0, textCustom: false, sleeveNums: false, swoosh: true, sleeveLogo: false, sleeveLogoSize: 100 };
  return autoText(applyPattern(base, pattern));
}
// jersey in the school's colors (create screen + player card)
const _cj = {};
function collegeJerseyBase(name) {
  if (_cj[name]) return _cj[name];
  const info = COLLEGE_INFO[name] || {}, ok = h => /^#[0-9A-F]{6}$/i.test(h || '');
  let p = ok(info.c1) ? info.c1 : '#E9EDF4', sec = ok(info.c2) ? info.c2 : '#2B3A55';
  if (lum(p) > 0.88 && lum(sec) < 0.88) [p, sec] = [sec, p];                   // a near-white main color makes an unreadable jersey: use the other one as the body
  const near = (a, b) => [1, 3, 5].reduce((t, i) => t + Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)), 0) < 70;
  if (near(p, sec)) sec = lum(p) > 0.5 ? '#111418' : '#FFFFFF';
  const acc = Math.abs(lum(sec) - lum(p)) > 0.3 ? contrastOn(sec) : contrastOn(p);
  return (_cj[name] = newJersey({ p, s: sec, a: acc }, 'solid'));
}
// the kid's first jersey: the MFL team's colors (taken from its logo), built the same way as a college jersey
const _yj = {};
function youthJerseyBase(name) {
  if (_yj[name]) return _yj[name];
  const info = MFL_INFO[name] || {}, ok = h => /^#[0-9A-F]{6}$/i.test(h || '');
  let p = ok(info.c1) ? info.c1 : '#E9EDF4', sec = ok(info.c2) ? info.c2 : '#2B3A55';
  if (lum(p) > 0.88 && lum(sec) < 0.88) [p, sec] = [sec, p];
  const near = (a, b) => [1, 3, 5].reduce((t, i) => t + Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)), 0) < 70;
  if (near(p, sec)) sec = lum(p) > 0.5 ? '#111418' : '#FFFFFF';
  const acc = Math.abs(lum(sec) - lum(p)) > 0.3 ? contrastOn(sec) : contrastOn(p);
  return (_yj[name] = newJersey({ p, s: sec, a: acc }, 'solid'));
}
// the school's / kid team's jersey: your edited version if you designed one in the Locker Room, otherwise the club colors
const collegeJersey = name => (typeof S !== 'undefined' && S && S.jerseys && S.jerseys['c:' + name]) ? normJersey(S.jerseys['c:' + name]) : collegeJerseyBase(name);
const youthJersey = name => (typeof S !== 'undefined' && S && S.jerseys && S.jerseys['y:' + name]) ? normJersey(S.jerseys['y:' + name]) : youthJerseyBase(name);
const youthJerseySVG = (name, view, num, shown) => jerseySVG(youthJersey(name), shown || '', num, { view, noShield: true, word: String(name).toUpperCase(), backLogo: MFL_INFO[name] ? mflLogo(MFL_INFO[name].slug) : '' });
const neutralJersey = () => newJersey({ p: '#E9EDF4', s: '#2B3A55', a: '#8B97AD' }, 'solid');
// default HOME jersey of each team, as close to the real one as the creator allows: colors, number color + outline, and the sleeve lines
// p/s/a = body / secondary / accent, n = number color, o = number outline ('' = none), l = sleeve lines [count, style, outer color, middle color]
const JC_REAL = {
  ARI: { p: '#97233F', s: '#000000', a: '#FFFFFF', n: '#FFFFFF', o: '#000000', l: [3, 'tri', '#000000', '#FFFFFF'] },
  ATL: { p: '#000000', s: '#A71930', a: '#FFFFFF', n: '#FFFFFF', o: '#A71930', l: [3, 'tri', '#A71930', '#FFFFFF'] },
  BAL: { p: '#241773', s: '#000000', a: '#9E7C0C', n: '#FFFFFF', o: '#000000', l: [3, 'tri', '#000000', '#9E7C0C'] },
  BUF: { p: '#00338D', s: '#C60C30', a: '#FFFFFF', n: '#FFFFFF', o: '#C60C30', l: [3, 'tri', '#C60C30', '#FFFFFF'] },
  CAR: { p: '#0085CA', s: '#000000', a: '#BFC0BF', n: '#000000', o: '#FFFFFF', l: [3, 'tri', '#000000', '#BFC0BF'] },
  CHI: { p: '#0B162A', s: '#C83803', a: '#FFFFFF', n: '#C83803', o: '#FFFFFF', l: [3, 'tri', '#C83803', '#FFFFFF'] },
  CIN: { p: '#000000', s: '#FB4F14', a: '#FFFFFF', n: '#FB4F14', o: '#FFFFFF', l: [2, 'even', '#FB4F14', '#FB4F14'] },
  CLE: { p: '#311D00', s: '#FF3C00', a: '#FFFFFF', n: '#FF3C00', o: '#FFFFFF', l: [3, 'tri', '#FF3C00', '#FFFFFF'] },
  DAL: { p: '#FFFFFF', s: '#003594', a: '#869397', n: '#003594', o: '#869397', l: [3, 'tri', '#003594', '#869397'], cc: true },
  DEN: { p: '#FB4F14', s: '#002244', a: '#FFFFFF', n: '#FFFFFF', o: '#002244', l: [3, 'tri', '#002244', '#FFFFFF'] },
  DET: { p: '#0076B6', s: '#B0B7BC', a: '#FFFFFF', n: '#FFFFFF', o: '#B0B7BC', l: [2, 'even', '#B0B7BC', '#B0B7BC'] },
  GB: { p: '#203731', s: '#FFB612', a: '#FFFFFF', n: '#FFFFFF', o: '#FFB612', l: [2, 'even', '#FFB612', '#FFB612'] },
  HOU: { p: '#03202F', s: '#A71930', a: '#FFFFFF', n: '#FFFFFF', o: '#A71930', l: [3, 'tri', '#A71930', '#FFFFFF'] },
  IND: { p: '#002C5F', s: '#A2AAAD', a: '#FFFFFF', n: '#FFFFFF', o: '', l: [2, 'even', '#FFFFFF', '#FFFFFF'] },
  JAX: { p: '#000000', s: '#006778', a: '#D7A22A', n: '#FFFFFF', o: '#006778', l: [3, 'tri', '#006778', '#D7A22A'] },
  KC: { p: '#E31837', s: '#FFB81C', a: '#FFFFFF', n: '#FFFFFF', o: '#FFB81C', l: [3, 'tri', '#FFFFFF', '#FFB81C'] },
  LV: { p: '#000000', s: '#A5ACAF', a: '#FFFFFF', n: '#FFFFFF', o: '#A5ACAF', l: [2, 'even', '#A5ACAF', '#A5ACAF'] },
  LAC: { p: '#0080C6', s: '#FFC20E', a: '#FFFFFF', n: '#FFFFFF', o: '#FFC20E', l: [3, 'tri', '#FFC20E', '#FFFFFF'] },
  LAR: { p: '#003594', s: '#FFD100', a: '#FFFFFF', n: '#FFD100', o: '#FFFFFF', l: [2, 'even', '#FFD100', '#FFD100'] },
  MIA: { p: '#008E97', s: '#FC4C02', a: '#FFFFFF', n: '#FFFFFF', o: '#FC4C02', l: [3, 'tri', '#FC4C02', '#FFFFFF'] },
  MIN: { p: '#4F2683', s: '#FFC62F', a: '#FFFFFF', n: '#FFFFFF', o: '#FFC62F', l: [3, 'tri', '#FFC62F', '#FFFFFF'] },
  NE: { p: '#002244', s: '#C60C30', a: '#B0B7BC', n: '#FFFFFF', o: '#C60C30', l: [3, 'tri', '#C60C30', '#B0B7BC'] },
  NO: { p: '#101820', s: '#D3BC8D', a: '#FFFFFF', n: '#D3BC8D', o: '#FFFFFF', l: [3, 'tri', '#D3BC8D', '#FFFFFF'] },
  NYG: { p: '#0B2265', s: '#A71930', a: '#FFFFFF', n: '#FFFFFF', o: '#A71930', l: [3, 'tri', '#A71930', '#FFFFFF'] },
  NYJ: { p: '#125740', s: '#000000', a: '#FFFFFF', n: '#FFFFFF', o: '', l: [2, 'even', '#FFFFFF', '#FFFFFF'] },
  PHI: { p: '#004C54', s: '#A5ACAF', a: '#FFFFFF', n: '#FFFFFF', o: '#000000', l: [3, 'tri', '#A5ACAF', '#FFFFFF'] },
  PIT: { p: '#101820', s: '#FFB612', a: '#FFFFFF', n: '#FFB612', o: '', l: [3, 'tri', '#FFB612', '#FFFFFF'] },
  SF: { p: '#AA0000', s: '#B3995D', a: '#FFFFFF', n: '#B3995D', o: '', l: [2, 'even', '#B3995D', '#B3995D'], font: 't_sf' },
  SEA: { p: '#002244', s: '#69BE28', a: '#A5ACAF', n: '#FFFFFF', o: '#69BE28', l: [3, 'tri', '#A5ACAF', '#69BE28'] },
  TB: { p: '#D50A0A', s: '#34302B', a: '#B1BABF', n: '#B1BABF', o: '#000000', l: [3, 'tri', '#000000', '#FF7900'] },
  TEN: { p: '#0C2340', s: '#4B92DB', a: '#C8102E', n: '#FFFFFF', o: '#4B92DB', l: [3, 'tri', '#C8102E', '#4B92DB'] },
  WAS: { p: '#5A1414', s: '#FFB612', a: '#FFFFFF', n: '#FFB612', o: '#FFFFFF', l: [2, 'even', '#FFB612', '#FFB612'] },
};
const defaultJersey = key => {
  if (jcIsAlt(key)) return key[0] === 'c' ? collegeJerseyBase(key.slice(2)) : youthJerseyBase(key.slice(2));
  const d = JC_REAL[key]; if (!d) return newJersey(jcPalettes(key)[0], 'solid');
  const c = newJersey({ p: d.p, s: d.s, a: d.a }, 'solid');
  c.numColor = c.nameColor = d.n; c.numOutline = c.nameOutline = d.o || d.n; c.numOutlineW = d.o ? 2.4 : 0; c.nameOutlineW = 0; c.textCustom = true;
  c.collarContrast = !!d.cc;                       // the collar matches the body on nearly every real jersey (the Cowboys' white jersey has a navy one)
  if (d.font) c.numFont = c.nameFont = d.font;
  c.sleeveCount = d.l[0]; c.sleeveStripes = true; c.sleeveStyle = d.l[1]; c.parts = { ...(c.parts || {}), decor: d.l[2], decorMid: d.l[3] };
  return c;
};
// upgrades designs saved by the older creators
function migrateJersey(o) {
  const c = newJersey({ p: o.body || '#FFFFFF', s: o.trim || o.cap || '#111418', a: o.outline || '#FFFFFF' }, 'solid');
  c.sleeveStripes = !!o.stripes; c.cuffs = !!o.stripes; c.colorBlock = !!o.yoke;
  if (o.num) { c.numColor = o.num; c.numOutline = o.outline || c.numOutline; c.nameColor = o.name || o.num; c.nameOutline = c.numOutline; c.textCustom = true; }
  c.numSize = o.numSize || 100; c.numY = o.numY || 0; c.nameSize = o.nameSize || 100;
  return c;
}
/* ---- patterns by zone (patterns.js): any of the front, side panels, shoulders or sleeves can carry the knit or the tiger stripes, with its own scale, 90° turns and color ---- */
const ZP_ZONES = [['torso', 'Front'], ['sides', 'Side panels'], ['shoulders', 'Shoulders'], ['sleeves', 'Sleeves']];
function jcNormZones(zp) {
  const out = {};
  ZP_ZONES.forEach(([z]) => { const v = (zp && zp[z]) || {}; out[z] = { p: JC_PATS.some(x => x.k === v.p) ? v.p : '', s: clamp(Number(v.s) || 100, 40, 400), r: [0, 90, 180, 270].includes(Number(v.r)) ? Number(v.r) : 0, c: /^#[0-9a-f]{6}$/i.test(v.c || '') ? v.c : '' }; });
  return out;
}
// writes a value into the config: 'parts.collar' -> cfg.parts.collar, 'zp.torso.s' -> cfg.zp.torso.s, anything else -> cfg[path]
function jcSetPath(cfg, path, v) {
  if (path.startsWith('parts.')) cfg.parts[path.slice(6)] = v;
  else if (path.startsWith('zp.')) { const [, z, f] = path.split('.'); cfg.zp = jcNormZones(cfg.zp); cfg.zp[z][f] = v; }
  else cfg[path] = v;
}
function jcZonePatterns(cfg, Z, id, C, back) {
  let defs = '', out = '', imgs = {};
  const zone = {
    torso: { clip: `<path d="${Z.torso}"/>`, col: C.body },
    sides: { clip: `<path d="${Z.sideL}"/><path d="${Z.sideR}"/>`, col: (cfg.sidePanels || cfg.parts.sidePanels) ? C.sidePanels : C.body },
    shoulders: { clip: back ? `<path d="${Z.yoke}"/>` : `<path d="${Z.yokeL}"/><path d="${Z.yokeR}"/>`, col: C.shoulders },
    sleeves: { clip: `<path d="${Z.sleeveVisL}"/><path d="${Z.sleeveVisR}"/>`, col: C.sleeveL },
  };
  ZP_ZONES.forEach(([z]) => {
    const v = cfg.zp[z], P = JC_PATS.find(x => x.k === v.p); if (!P) return;
    const k = P.base * v.s / 100, zc = zone[z].col, col = v.c || (lum(zc) > 0.5 ? mixHex(zc, '#000000', 0.38) : mixHex(zc, '#ffffff', 0.34));
    let content, PW = P.w, PH = P.h;
    if (P.img) {
      if (!imgs[P.k]) { defs += `<image id="${id}im${P.k}" href="${P.img}" width="${P.w}" height="${P.h}"/>`; imgs[P.k] = 1; }
      const u = `<use href="#${id}im${P.k}"`;
      content = P.mirror ? `${u}/>${u} transform="translate(${2 * P.w} 0) scale(-1 1)"/>${u} transform="translate(0 ${2 * P.h}) scale(1 -1)"/>${u} transform="translate(${2 * P.w} ${2 * P.h}) scale(-1 -1)"/>` : `${u}/>`;
      if (P.mirror) { PW = 2 * P.w; PH = 2 * P.h; }
    } else content = P.inner;
    defs += `<pattern id="${id}pz${z}" width="${PW}" height="${PH}" patternUnits="userSpaceOnUse" patternTransform="translate(150 150) rotate(${v.r}) scale(${k.toFixed(4)}) translate(${-PW / 2} ${-PH / 2})">${content}</pattern>`
      + `<mask id="${id}pm${z}" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="345"><rect width="300" height="345" fill="url(#${id}pz${z})"/></mask><clipPath id="${id}zc${z}">${zone[z].clip}</clipPath>`;
    out += `<g clip-path="url(#${id}zc${z})"><rect width="300" height="345" fill="${col}" mask="url(#${id}pm${z})"/></g>`;
  });
  return { defs, out };
}
function normJersey(c) {
  let o = c && c.primary !== undefined ? { ...c } : migrateJersey(c || {});
  o = { ...JC_EL_DEFAULT, numFont: 'jets', nameFont: 'jets', numSize: 100, numY: 0, nameSize: 100, numOutlineW: 2.4, nameOutlineW: 0, pattern: 'solid', ...o };
  o.torsoLogo = !!o.torsoLogo; o.logoX = clamp(Number(o.logoX) || 150, 8, 292); o.logoY = clamp(Number(o.logoY) || 112, 8, 337); o.logoSize = clamp(Number(o.logoSize) || 100, 40, 220);
  o.sleeveStyle = JC_SLEEVE_STYLES.some(x => x[0] === o.sleeveStyle) ? o.sleeveStyle : 'even'; o.sleeveThick = clamp(Number(o.sleeveThick) || 100, 60, 200); o.sleeveNumY = clamp(Number(o.sleeveNumY) || 0, -50, 40);
  o.zp = jcNormZones(o.zp);
  o.shCount = clamp(Math.round(Number(o.shCount) || 0), 0, 3); o.shStyle = JC_SLEEVE_STYLES.some(x => x[0] === o.shStyle) ? o.shStyle : 'even'; o.shThick = clamp(Number(o.shThick) || 100, 60, 200); o.shPos = clamp(Number(o.shPos) || 0, -8, 72); o.nameBox = o.nameBox !== false; o.nameBoxFill = /^#[0-9a-f]{6}$/i.test(o.nameBoxFill) ? o.nameBoxFill : ''; o.nameY = clamp(Number(o.nameY) || 0, -30, 40); o.jockTag = !!o.jockTag; o.jockX = clamp(Number(o.jockX) || 98, 10, 290); o.jockY = clamp(Number(o.jockY) || 322, 200, 340); o.jockSize = clamp(Number(o.jockSize) || 100, 40, 240); o.shAngle = clamp(Number(o.shAngle) || 0, -45, 45); o.sleevePos = clamp(Number(o.sleevePos) || 0, -8, 60);
  o.showWord = o.showWord !== false; o.swoosh = !!o.swoosh; o.sleeveLogo = !!o.sleeveLogo; o.sleeveLogoFlipL = !!o.sleeveLogoFlipL; o.sleeveLogoFlipR = !!o.sleeveLogoFlipR; o.sleeveLogoSize = clamp(Number(o.sleeveLogoSize) || 100, 40, 160); o.sleeveLogoRot = clamp(Number(o.sleeveLogoRot) || 0, -45, 45); o.sleeveLogoSpread = clamp(Number(o.sleeveLogoSpread) || 0, -24, 24); o.sleeveLogoY = clamp(Number(o.sleeveLogoY) || 0, -30, 40); o.noSideNums = !!o.noSideNums; o.sleeveNums = !!o.sleeveNums && !o.noSideNums; o.parts = { ...(o.parts || {}) }; delete o.shoulderStripes; delete o.chestStripe; delete o.verticalStripe;
  const hx = (v, d) => /^#[0-9a-f]{6}$/i.test(v) ? v : d; o.primary = hx(o.primary, '#FFFFFF'); o.secondary = hx(o.secondary, '#111418'); o.accent = hx(o.accent, '#FFFFFF');
  o.numSize = clamp(Number(o.numSize) || 100, 50, 150); o.nameSize = clamp(Number(o.nameSize) || 100, 50, 150); o.numY = clamp(Number(o.numY) || 0, -60, 70); o.numYFront = clamp(o.numYFront !== undefined && o.numYFront !== null && Number.isFinite(Number(o.numYFront)) ? Number(o.numYFront) : o.numY, -60, 70);   // number height: the front and the back are independent
  o.sideNumColor = /^#[0-9a-f]{6}$/i.test(o.sideNumColor) ? o.sideNumColor : ''; o.sideNumOutline = /^#[0-9a-f]{6}$/i.test(o.sideNumOutline) ? o.sideNumOutline : '';
  o.numOutlineW = clamp(Number(o.numOutlineW) || 0, 0, 8); o.nameOutlineW = clamp(Number(o.nameOutlineW) || 0, 0, 5);
  if (!JC_FONTS.some(f => f.k === o.numFont)) o.numFont = 'jets'; if (!JC_FONTS.some(f => f.k === o.nameFont)) o.nameFont = 'jets';
  if (!o.numColor || !o.nameColor || !o.numOutline || !o.nameOutline) { const keep = o.textCustom; o.textCustom = false; autoText(o); o.textCustom = keep; }
  return o;
}
const jerseyFor = teamId => normJersey((S && S.jerseys && S.jerseys[teamId]) || defaultJersey(teamId));
// resolved colors for every part: explicit override > pattern/palette default
function jcColors(c) {
  const pr = c.parts || {}, P = c.primary, S2 = c.secondary, A = c.accent, body = pr.body || P;
  return { body, sleeveL: pr.sleeveL || (c.colorBlock ? S2 : body), sleeveR: pr.sleeveR || (c.colorBlock ? S2 : body), shoulders: pr.shoulders || (c.colorBlock ? S2 : body),
    swoosh: pr.swoosh || (lum(pr.sleeveL || (c.colorBlock ? S2 : body)) > 0.55 ? '#111418' : '#FFFFFF'), collar: pr.collar || (c.collarContrast ? S2 : body), sidePanels: pr.sidePanels || S2, cuffs: pr.cuffs || S2, decor: pr.decor || A, shStripe: pr.shStripe || pr.decor || A, decorMid: pr.decorMid || S2, shStripeMid: pr.shStripeMid || S2 };
}
// a visually coherent random design: a real palette + a pattern recipe + a couple of compatible details
function randomJersey(teamId, current) {
  const pal = pick(jcPalettes(teamId));
  let c = applyPattern(newJersey(pal, 'solid'), pick(JC_PATTERNS).k);
  if (Math.abs(lum(c.primary) - lum(c.secondary)) < 0.16) c.secondary = c.accent;      // never primary ≈ secondary
  if (!c.cuffs && rnd() < 0.3) c.cuffs = true;
  if (!c.hemTrim && rnd() < 0.18) c.hemTrim = true;
  if (rnd() < 0.15) c.collarContrast = false;
  c.numFont = pick(['jets', 'oldsport', 'jackport', 'jerseym54', 'maldini']); c.nameFont = c.numFont; c.numOutlineW = pick([0, 3.2, 3.2, 4.5]);
  c.sleeveStyle = pick(JC_SLEEVE_STYLES)[0]; c.sleeveThick = pick([90, 100, 120, 150]);
  if (current) { c.numSize = current.numSize; c.numY = current.numY; c.numYFront = current.numYFront; c.noSideNums = current.noSideNums; c.nameSize = current.nameSize; c.zp = current.zp; c.swoosh = current.swoosh; c.sleeveLogo = current.sleeveLogo; c.sleeveLogoFlipL = current.sleeveLogoFlipL; c.sleeveLogoFlipR = current.sleeveLogoFlipR; c.jockTag = current.jockTag; c.jockX = current.jockX; c.jockY = current.jockY; c.jockSize = current.jockSize; c.sleeveLogoSize = current.sleeveLogoSize; c.sleeveLogoRot = current.sleeveLogoRot; c.sleeveLogoSpread = current.sleeveLogoSpread; c.sleeveLogoY = current.sleeveLogoY; c.torsoLogo = current.torsoLogo; c.logoX = current.logoX; c.logoY = current.logoY; c.logoSize = current.logoSize; c.sleeveNums = current.sleeveNums; }
  return autoText(c);
}

/* ---- text layout shared by the SVG and the PNG export (coordinates in the 300 x 345 jersey box) ---- */
// sleeve lines: each style gives the width of every line (x thickness) and the gap between them (x spacing), counting from the cuff towards the shoulder
const JC_SLEEVE_STYLES = [['even', 'Even', [1, 1, 1], 1], ['thick', 'Thick + thin', [1.9, 0.6, 0.6], 0.8], ['taper', 'Tapered', [0.7, 1.1, 1.6], 1], ['wide', 'Wide', [1.7, 1.7, 1.7], 1], ['spaced', 'Spaced', [1, 1, 1], 2.4], ['tri', '3 together', [1, 1, 1], 0]];
function jcStripeBands(c) {
  const st = JC_SLEEVE_STYLES.find(x => x[0] === c.sleeveStyle) || JC_SLEEVE_STYLES[0], n = jcSleeveCount(c) && st[0] === 'tri' ? 3 : jcSleeveCount(c), k = c.sleeveThick / 100, T = 7 * k, out = []; let pos = 10 + (c.sleevePos || 0);
  for (let i = 0; i < n; i++) { const w = T * st[2][i]; out.push([pos, pos + w, i]); pos += w + 4.5 * k * st[3]; }
  return out;
}
// vertical lines on the shoulders, pushed towards the outside (the arm seam): x ranges measured from the outer edge of the shoulder inwards
function jcShoulderBands(c) {
  const st = JC_SLEEVE_STYLES.find(x => x[0] === c.shStyle) || JC_SLEEVE_STYLES[0], n = (c.shCount || 0) && st[0] === 'tri' ? 3 : (c.shCount || 0), k = (c.shThick || 100) / 100, T = 5.2 * k, out = []; let pos = 7 + (c.shPos || 0);
  for (let i = 0; i < n; i++) { const w = T * st[2][i]; out.push([pos, pos + w, i]); pos += w + 3.4 * k * st[3]; }
  return out;
}
const JC_SH_EDGE = 49;   // x of the outer end of the left shoulder (the arm seam); the right side is the mirror image
// a band parallel to the end of the sleeve: the cuff curve moved a..b units towards the shoulder (side 'R' is the mirror image)
function jcBandPath(side, a, b) {
  const P = UNI.cuffCurve, n = P.length;
  const off = d => P.map((p, i) => { const q0 = P[Math.max(0, i - 1)], q1 = P[Math.min(n - 1, i + 1)]; let tx = q1[0] - q0[0], ty = q1[1] - q0[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; let nx = ty, ny = -tx; if (ny > 0) { nx = -nx; ny = -ny; } return [p[0] + nx * d, p[1] + ny * d]; });
  const A = off(a), B = off(b), pts = A.concat(B.reverse()).map(q => (side === 'R' ? [2 * UNI.meta.cx - q[0], q[1]] : q));
  return 'M' + pts.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L') + 'Z';
}
const jcSleeveCount = c => (c.sleeveCount != null ? c.sleeveCount : (c.sleeveStripes ? (c.retro ? 3 : 2) : 0));
// the traced NFL numerals: a run of glyph paths (cap height 100 units)
function jcJetsRun(t) {
  let pen = 0; const parts = [];
  String(t).split('').forEach(ch => { const g = JETS.glyphs[ch]; if (!g) return; if (parts.length) pen += JETS.gap; parts.push({ d: g.d, x: pen }); pen += g.w; });
  return { w: pen, parts };
}
// real width of a run of text (canvas), so the name plate wraps the name exactly
let _jcMeasure = null;
function jcTextW(t, size, css, weight, ls) {
  try {
    _jcMeasure = _jcMeasure || document.createElement('canvas').getContext('2d');
    const c = _jcMeasure; c.font = `${weight} ${size}px ${css}, 'Arial Narrow', Impact, sans-serif`;
    const lsOk = 'letterSpacing' in c; if (lsOk) c.letterSpacing = ls + 'px';
    const w = c.measureText(t).width; return lsOk ? w : w + ls * t.length;
  } catch (e) { return null; }
}
function jcTexts(c, view, name, number, word) {
  const f = jcFont(c.numFont), nf = jcFont(c.nameFont), digits = String(number).length;
  const capH = 80 * c.numSize / 100 * (digits === 1 ? 1.04 : 1), size = capH / f.cap, y = 171 + (view === 'back' ? c.numY : c.numYFront) + capH / 2;
  const out = [f.glyph ? { k: 'num', jets: true, run: jcJetsRun(number), cap: capH, t: String(number), x: UNI.meta.cx, y, fill: c.numColor, stroke: c.numOutlineW > 0 ? c.numOutline : null, sw: c.numOutlineW, maxW: 130 }
    : { k: 'num', t: String(number), x: UNI.meta.cx, y, size, css: f.css, w: f.w, wf: f.wf, fill: c.numColor, stroke: c.numOutlineW > 0 ? c.numOutline : null, sw: c.numOutlineW, ls: 0, maxW: 130 }];
  if (view === 'back') {
    const nm = String(name || '').toUpperCase(), len = nm.length, capN = (len > 8 ? 19 - (len - 8) * 1.2 : 19) * c.nameSize / 100, ny = 97 + (c.nameY || 0), sizeN = capN / nf.cap, lsN = 1.5, maxWN = 150;
    if (c.nameBox && len) {                                   // the name sits in a rectangle that wraps it with a small margin and grows / shrinks with its length
      const real = jcTextW(nm, sizeN, nf.css, nf.w, lsN), w = Math.min(maxWN, real == null ? len * sizeN * nf.wf + (len - 1) * lsN : real), vis = Math.max(6, w - lsN);     // letter-spacing trails the last letter: the glyphs are centred without it
      const padX = Math.max(3.5, capN * 0.3), padY = Math.max(2.6, capN * 0.2), body = jcColors(c).body;
      const fill = c.nameBoxFill || body;                                    // same color as the jersey, outlined in the same black line as the other seams
      out.push({ k: 'plate', x: UNI.meta.cx - lsN / 2, y: ny - capN - padY, w: vis + 2 * padX, h: capN + 2 * padY, fill, line: '#14171c' });
    }
    out.push({ k: 'name', t: nm, x: UNI.meta.cx, y: ny, size: sizeN, css: nf.css, w: nf.w, wf: nf.wf, fill: c.nameColor, stroke: c.nameOutlineW > 0 ? c.nameOutline : null, sw: c.nameOutlineW > 0 ? c.nameOutlineW : 2.4, ls: lsN, maxW: maxWN });
  } else if (word && c.showWord !== false) {
    out.push({ k: 'word', t: String(word).toUpperCase(), x: UNI.meta.cx, y: 97, size: (7 * c.nameSize / 100) / nf.cap, css: nf.css, w: nf.w, wf: nf.wf, fill: c.nameColor, stroke: null, sw: 0, ls: 2.4, maxW: 130 });
  }
  return out;
}
// numbers on the shoulders: exactly the position, angle, size and squeeze of the Illustrator drawing; whatever pokes out of the jersey is simply cut off by its outline
// numbers moved down from the shoulders to the sleeves, exactly as in the Illustrator drawing (JERSEY2.svg): Anton 128.6px, nearly upright and tilted ~16 degrees,
// starting outside the edge of the jersey; whatever passes the outline is cut off. (x, y) = start of the baseline of the drawing's "00", r = rotation
const JC_SLEEVE = {
  front: { L: { x: 6.2, y: 103.7, r: 16.8 }, R: { x: 260.8, y: 118.6, r: -15.8 } },
  back: { L: { x: 5.9, y: 104.2, r: 16.76 }, R: { x: 256.4, y: 119.9, r: -15.82 } },
};
function jcSleeveTexts(c, view, number) {
  const f = jcFont(c.numFont), n = String(number).length, base0 = 128.6 * 0.3 * 0.73, cap = n > 2 ? base0 * 0.8 : base0;
  const run = f.glyph ? jcJetsRun(number) : null, half00 = f.glyph ? (JETS.glyphs['0'].w * 2 + JETS.gap) / 100 * base0 / 2 : f.wf * 2 * (128.6 * 0.3 * 0.73 / f.cap) / 2;
  const mk = side => {
    const d = JC_SLEEVE[view][side], rad = d.r * Math.PI / 180;
    const base = { k: 'sh', t: String(number), x: 0, y: 0, tx: d.x + Math.cos(rad) * half00, ty: d.y + (c.sleeveNumY || 0) + Math.sin(rad) * half00, rot: d.r, sx: 1, fill: c.sideNumColor || c.numColor, stroke: c.numOutlineW > 0 ? (c.sideNumOutline || c.numOutline) : null, sw: Math.min(1.2, c.numOutlineW * 0.4), maxW: 1e9, clip: 'bo' };
    return f.glyph ? { ...base, jets: true, run, cap } : { ...base, size: cap / f.cap, css: f.css, w: f.w, wf: f.wf, ls: 0 };
  };
  return [mk('L'), mk('R')];
}
const JC_SHOULDER = {
  front: { L: { x: 51.4, y: 19.41, r: 67.8, sx: 0.8 }, R: { x: 238.4, y: 51.27, r: -67.2, sx: 0.8 } },
  back: { L: { x: 51.4, y: 19.4, r: 67.784, sx: 0.8417 }, R: { x: 238.4, y: 51.27, r: -67.216, sx: 0.8417 } },
};
function jcShoulderTexts(c, view, number) {
  if (c.noSideNums) return [];                   // the side numbers can be removed altogether
  if (c.sleeveNums) return jcSleeveTexts(c, view, number);
  const f = jcFont(c.numFont), size = 41.55 * 0.73 / f.cap, adv = f.wf * size, cap = 41.55 * 0.73;   // 138.5px Anton in the drawing = 41.55 here
  const run = f.glyph ? jcJetsRun(number) : null, two = f.glyph ? (JETS.glyphs['0'].w * 2 + JETS.gap) / 100 * cap / 2 : adv;
  const mk = side => {
    const d = JC_SHOULDER[view][side], rad = d.r * Math.PI / 180, half = two * d.sx;       // the drawing's "00" is two digits wide: centre the real number on it
    const base = { k: 'sh', t: String(number), x: 0, y: 0, tx: d.x + Math.cos(rad) * half, ty: d.y + Math.sin(rad) * half, rot: d.r, sx: d.sx, fill: c.sideNumColor || c.numColor, stroke: c.numOutlineW > 0 ? (c.sideNumOutline || c.numOutline) : null, sw: Math.min(1.1, c.numOutlineW * 0.35), maxW: 1e9, clip: 'bo' };
    return f.glyph ? { ...base, jets: true, run, cap } : { ...base, size, css: f.css, w: f.w, wf: f.wf, ls: 0 };
  };
  return [mk('L'), mk('R')];
}
const jcTextSVG = s => {
  if (s.k === 'plate') return `<rect x="${(s.x - s.w / 2).toFixed(2)}" y="${s.y.toFixed(2)}" width="${s.w.toFixed(2)}" height="${s.h.toFixed(2)}" rx="1.4" fill="${s.fill}" stroke="${s.line}" stroke-width=".85"/>`;
  if (s.jets) {
    const k = s.cap / 100, w = s.run.w * k, sq = w > s.maxW ? s.maxW / w : 1;
    const attrs = `fill="${s.fill}" fill-rule="evenodd"${s.stroke ? ` stroke="${s.stroke}" stroke-width="${(s.sw / k).toFixed(2)}" paint-order="stroke" stroke-linejoin="round"` : ''}`;
    const at = s.rot !== undefined ? `translate(${s.tx.toFixed(2)} ${s.ty.toFixed(2)}) rotate(${s.rot}) scale(${s.sx || 1} 1) translate(${(-w * sq / 2).toFixed(2)} ${(-s.cap).toFixed(2)})` : `translate(${(s.x - w * sq / 2).toFixed(2)} ${(s.y - s.cap).toFixed(2)})`;
    return `<g transform="${at} scale(${(k * sq).toFixed(4)} ${k.toFixed(4)})">${s.run.parts.map(p => `<path d="${p.d}" transform="translate(${p.x.toFixed(2)} 0)" ${attrs}/>`).join('')}</g>`;
  }
  const est = s.t.length * s.size * s.wf + Math.max(0, s.t.length - 1) * s.ls, squeeze = est > s.maxW;
  return `<text${s.rot !== undefined ? ` transform="translate(${s.tx.toFixed(1)} ${s.ty.toFixed(1)}) rotate(${s.rot}) scale(${s.sx || 1} 1)"` : ''} x="${s.x}" y="${s.y.toFixed(1)}" font-family="${s.css},'Arial Narrow',Impact,sans-serif" font-weight="${s.w}" font-size="${s.size.toFixed(1)}" text-anchor="middle"${s.ls ? ` letter-spacing="${s.ls}"` : ''} fill="${s.fill}"${s.stroke ? ` stroke="${s.stroke}" stroke-width="${s.sw}" paint-order="stroke" stroke-linejoin="round"` : ''}${squeeze ? ` textLength="${s.maxW}" lengthAdjust="spacingAndGlyphs"` : ''}>${esc(s.t)}</text>`;
};

/* tiny NFL shield (vector fallback, so the collar never ends up empty offline) */
function nflShield(x, y, k, hidden) {
  const star = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="0.9" fill="#fff"/>`;
  return `<g${hidden ? ' display="none"' : ''} transform="translate(${x} ${y}) scale(${k})"><path d="M-11 -13 H11 V4 Q11 11 0 15 Q-11 11 -11 4 Z" fill="#0A2A5E" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/>`
    + [-6, -2, 2, 6].map(cx => star(cx, -8.4)).join('') + star(-4, -5.6) + star(0, -5.6) + star(4, -5.6)
    + `<rect x="-8" y="-2.6" width="16" height="2" fill="#D50A0A"/><text x="0" y="8.6" text-anchor="middle" font-family="'Barlow Condensed',Impact,sans-serif" font-weight="800" font-size="9.5" fill="#fff">NFL</text></g>`;
}
// the official NFL logo (same image the rest of the app uses) in the V of the collar, with the vector shield as an offline fallback
const NFL_COLLAR = { x: 150, y: 65.5, s: 15 };
const nflCollarLogo = () => `<image href="${NFL_LOGO}" x="${NFL_COLLAR.x - NFL_COLLAR.s / 2}" y="${NFL_COLLAR.y - NFL_COLLAR.s / 2}" width="${NFL_COLLAR.s}" height="${NFL_COLLAR.s}" preserveAspectRatio="xMidYMid meet" onerror="this.setAttribute('display','none');this.nextElementSibling.removeAttribute('display')"/>${nflShield(NFL_COLLAR.x, NFL_COLLAR.y, 0.5, true)}`;

/* ---- the jersey itself: pieces from the user's Illustrator drawing (uniform-shapes.js), viewBox 300 x 345, front or back ---- */
function jerseyOne(cfg, view, name, number, o = {}) {
  cfg = normJersey(cfg);
  const id = 'u' + uid(), back = view === 'back', Z = UNI[view], M = UNI.meta, C = jcColors(cfg), INK = '#14171c';
  const ln = `fill="none" stroke="${INK}" stroke-width=".85" stroke-linejoin="round"`;
  const grad = cfg.gradient && !cfg.parts.body, bodyFill = grad ? `url(#${id}gr)` : C.body;
  const side = (cfg.sidePanels || cfg.parts.sidePanels) ? C.sidePanels : bodyFill;
  const dA = mixHex(C.body, '#000000', 0.2), dB = mixHex(C.body, '#000000', 0.36);
  const pieces = back
    ? [['sleeveL', C.sleeveL], ['sideL', side], ['torso', bodyFill], ['sleeveR', C.sleeveR], ['yoke', C.shoulders], ['sideR', side], ['collarBack', C.collar]]
    : [['sleeveL', C.sleeveL], ['neckB', dB], ['neckA', dA], ['sideL', side], ['collarL', C.collar], ['neckBand', C.collar], ['torso', bodyFill], ['sleeveR', C.sleeveR], ['yokeL', C.shoulders], ['yokeR', C.shoulders], ['sideR', side], ['collarR', C.collar], ['neckTip', C.collar]];
  const zpl = o.cls === 'thumb' ? { defs: '', out: '' } : jcZonePatterns(cfg, Z, id, C, back);
  const bottom = Z.meta.bottom, B = UNI.bands, nStr = jcSleeveCount(cfg);
  // shoulder lines: vertical bands on the yoke, pushed to the outside; `shAngle` tips them (positive = top further out), mirrored on the two shoulders
  const shRects = side2 => {
    const bands = jcShoulderBands(cfg); if (!bands.length) return '';
    const mid = JC_SH_EDGE + (bands[0][0] + bands[bands.length - 1][1]) / 2, ang = (cfg.shAngle || 0) * (side2 === 'L' ? -1 : 1), px = side2 === 'L' ? mid : 2 * UNI.meta.cx - mid;
    return `<g transform="rotate(${ang} ${px.toFixed(1)} 60)">` + bands.map(([a, b, i]) => { const x0 = side2 === 'L' ? JC_SH_EDGE + a : 2 * UNI.meta.cx - (JC_SH_EDGE + b); return `<rect x="${x0.toFixed(1)}" y="-10" width="${(b - a + (cfg.shStyle === 'tri' ? 0.35 : 0)).toFixed(1)}" height="150" fill="${cfg.shStyle === 'tri' && i === 1 ? C.shStripeMid : C.shStripe}"/>`; }).join('') + '</g>';
  };
  const shLines = !cfg.shCount ? '' : (back ? `<g clip-path="url(#${id}yoke)">${shRects('L')}${shRects('R')}</g>` : `<g clip-path="url(#${id}yokeL)">${shRects('L')}</g><g clip-path="url(#${id}yokeR)">${shRects('R')}</g>`);
  const bandsOf = side2 => (cfg.cuffs ? `<path d="${B[side2].cuff}" fill="${C.cuffs}"/>` : '') + jcStripeBands(cfg).map(([a, b, i]) => `<path d="${jcBandPath(side2, a, b)}" fill="${cfg.sleeveStyle === 'tri' && i === 1 ? C.decorMid : C.decor}"/>`).join('');
  const tid = o.teamId || (typeof S !== 'undefined' && S && S.teamId), lkey = lum(C.body) > 0.45 ? 'light' : 'dark';
  const backHref = !back ? '' : (o.backLogo !== undefined ? o.backLogo : (tid && TEAM[tid] ? (o.logoData ? o.logoData[lkey] : jcLogoUrl(tid, lkey)) : ''));
  const backLogo = backHref ? `<image href="${backHref}" x="${M.cx - 8.5}" y="35" width="17" height="17" preserveAspectRatio="xMidYMid meet"/>` : '';
  // college / kids-team jerseys carry THEIR OWN logo (passed as logoSrc or backLogo), never the NFL team's
  const lsrc = o.logoSrc !== undefined ? o.logoSrc : (o.backLogo !== undefined ? o.backLogo : undefined), ownLogo = lsrc !== undefined;
  const tSz = 34 * cfg.logoSize / 100, tHref = (!back && cfg.torsoLogo && (ownLogo ? !!lsrc : (tid && TEAM[tid]))) ? (ownLogo ? (o.logoData ? o.logoData[lkey] : lsrc) : (o.logoData ? o.logoData[lkey] : jcLogoUrl(tid, lkey))) : '';
  const torsoLogo = tHref ? `<g clip-path="url(#${id}bo)"><image class="jc-tlogo" data-tlogo="1" href="${tHref}" x="${(cfg.logoX - tSz / 2).toFixed(1)}" y="${(cfg.logoY - tSz / 2).toFixed(1)}" width="${tSz.toFixed(1)}" height="${tSz.toFixed(1)}" preserveAspectRatio="xMidYMid meet"/><circle class="jc-thit" data-thit="1" cx="${cfg.logoX.toFixed(1)}" cy="${cfg.logoY.toFixed(1)}" r="${Math.max(tSz / 2, 24).toFixed(1)}" fill="transparent"/></g>` : '';   // the round hit area makes a small logo easy to grab
  // the Nike jock tag, front only, lower left; moves and scales (width 36 units at 100%, aspect of the real label)
  const jW = 36 * cfg.jockSize / 100, jH = jW * 159 / 520, jHref = o.logoData && o.logoData.jock ? o.logoData.jock : 'assets/nfl/jocktag.png';
  const jockTag = (!back && cfg.jockTag) ? `<g clip-path="url(#${id}bo)"><image class="jc-jock" href="${jHref}" x="${(cfg.jockX - jW / 2).toFixed(1)}" y="${(cfg.jockY - jH / 2).toFixed(1)}" width="${jW.toFixed(1)}" height="${jH.toFixed(1)}" preserveAspectRatio="xMidYMid meet" data-jock="1"/><rect class="jc-jhit" data-jhit="1" x="${(cfg.jockX - Math.max(jW / 2, 20)).toFixed(1)}" y="${(cfg.jockY - Math.max(jH / 2, 12)).toFixed(1)}" width="${(Math.max(jW, 40)).toFixed(1)}" height="${(Math.max(jH, 24)).toFixed(1)}" fill="transparent"/></g>` : '';
  const swoosh = cfg.swoosh && Z.swooshL ? `<g clip-path="url(#${id}bo)" fill="${C.swoosh}"><path d="${Z.swooshL}"/><path d="${Z.swooshR}"/></g>` : '';
  // team logo on both sleeves (spot from the user's JERSEY2Logos.svg; whatever sticks out of the jersey outline is cut off by the clip below): the wearer's right sleeve as it is, the wearer's left one mirrored (so on the front view the screen-right logo is the mirrored one), so faces/birds look the same way on both arms
  const sl = (cfg.sleeveLogo && (ownLogo ? !!lsrc : (tid && TEAM[tid])) && UNI.slogo) ? ['L', 'R'].map(sd => {
    const g = UNI.slogo[view][sd], w = g.w * cfg.sleeveLogoSize / 100, k = lum(C['sleeve' + sd]) > 0.45 ? 'light' : 'dark';
    const href = ownLogo ? (o.logoData ? o.logoData[k] : lsrc) : (o.logoData ? o.logoData[k] : jcLogoUrl(tid, k));
    return `<image class="jc-slogo" href="${href}" x="${(-w / 2).toFixed(2)}" y="${(-w / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${w.toFixed(2)}" preserveAspectRatio="xMidYMid meet" transform="translate(${(g.x + (sd === 'L' ? -1 : 1) * (cfg.sleeveLogoSpread || 0)).toFixed(2)} ${(g.y + (cfg.sleeveLogoY || 0)).toFixed(2)}) rotate(${(g.r + (sd === 'L' ? -1 : 1) * (cfg.sleeveLogoRot || 0)).toFixed(2)})${((back ? sd : (sd === 'L' ? 'R' : 'L')) === 'L') !== !!cfg['sleeveLogoFlip' + (back ? sd : (sd === 'L' ? 'R' : 'L'))] ? ' scale(-1 1)' : ''}"/>`;
  }).join('') : '';
  const sleeveLogos = sl ? `<g clip-path="url(#${id}bo)">${sl}</g>` : '';
  const yokes = back ? ['yoke'] : ['yokeL', 'yokeR'];
  const hem = cfg.hemTrim ? `<g clip-path="url(#${id}bd)"><rect x="0" y="${(bottom - 9).toFixed(1)}" width="300" height="14" fill="${C.decor}"/></g>` : '';
  const texts = o.noText ? '' : jcTexts(cfg, view, name, number, o.word).map(jcTextSVG).join('') +
    jcShoulderTexts(cfg, view, number).map(t => `<g clip-path="url(#${id}${t.clip})"${cfg.sleeveNums ? ' data-snum="1" class="jc-snum"' : ''}>${cfg.sleeveNums ? `<circle cx="${t.tx < UNI.meta.cx ? 33 : 2 * UNI.meta.cx - 33}" cy="${(t.ty - (t.cap || 28) / 2).toFixed(1)}" r="20" fill="transparent"/>` : ''}${jcTextSVG(t)}</g>`).join('');
  const clipSleeves = `<clipPath id="${id}sleeveVisL"><path d="${Z.sleeveVisL}"/></clipPath><clipPath id="${id}sleeveVisR"><path d="${Z.sleeveVisR}"/></clipPath>`;
  const clipYokes = back ? `<clipPath id="${id}yoke"><path d="${Z.yoke}"/></clipPath>` : `<clipPath id="${id}yokeL"><path d="${Z.yokeL}"/></clipPath><clipPath id="${id}yokeR"><path d="${Z.yokeR}"/></clipPath>`;
  return `<svg${o.noText ? ' xmlns="http://www.w3.org/2000/svg"' : ''} class="jersey part-jersey ${back ? 'is-back' : 'is-front'} ${o.cls || ''}" viewBox="0 0 ${M.w} ${M.h}" role="img" aria-label="${back ? 'Back' : 'Front'} of jersey ${esc(String(name || ''))} ${number}">
    <defs>
      <clipPath id="${id}bo"><path d="${Z.bodyOuter}"/></clipPath>
      <clipPath id="${id}bd"><path d="${Z.torso}"/><path d="${Z.sideL}"/><path d="${Z.sideR}"/></clipPath><clipPath id="${id}sp"><path d="${Z.sideL}"/><path d="${Z.sideR}"/></clipPath>
      <clipPath id="${id}sl"><path d="${Z.sleeveL}"/></clipPath><clipPath id="${id}sr"><path d="${Z.sleeveR}"/></clipPath>${clipYokes}${clipSleeves}
      <linearGradient id="${id}gr" gradientUnits="userSpaceOnUse" x1="0" y1="40" x2="0" y2="${M.h}"><stop offset=".2" stop-color="${cfg.primary}"/><stop offset="1" stop-color="${cfg.secondary}"/></linearGradient>
      <linearGradient id="${id}s" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".2"/><stop offset=".2" stop-color="#000" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".06"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient>
      <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>
      <pattern id="${id}m" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r=".75" fill="rgba(0,0,0,.14)"/></pattern>
      ${zpl.defs}
    </defs>
    <g clip-path="url(#${id}bo)">
      ${pieces.map(([k, fill]) => `<path d="${Z[k]}" fill="${fill}"/>`).join('')}
      ${zpl.out}
      <g clip-path="url(#${id}sl)">${bandsOf('L')}</g><g clip-path="url(#${id}sr)">${bandsOf('R')}</g>
      ${shLines}
      ${hem}
      <g clip-path="url(#${id}sp)"><rect width="${M.w}" height="${M.h}" fill="url(#${id}m)"/></g><rect width="${M.w}" height="${M.h}" fill="url(#${id}s)"/><rect width="${M.w}" height="${M.h}" fill="url(#${id}v)"/>
    </g>
    ${pieces.map(([k]) => `<path d="${Z[k]}" ${ln}/>`).join('')}
    <path d="${Z.bodyOuter}" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>
    ${swoosh}${sleeveLogos}${back || o.noShield ? '' : nflCollarLogo()}${backLogo}${torsoLogo}${jockTag}
    ${texts}
  </svg>`;
}
// view: 'back' (default), 'front' or 'both' (front + back side by side)
function jerseySVG(cfg, name, number, o = {}) {
  const view = o.view || 'back';
  if (view === 'both') return `<div class="jersey-pair">${jerseyOne(cfg, 'front', name, number, o)}${jerseyOne(cfg, 'back', name, number, o)}</div>`;
  return jerseyOne(cfg, view, name, number, o);
}

/* ---- PNG export: the SVG shapes are rasterized, and the name/number are drawn with canvas text (so the page fonts are used) ---- */
// team logo on the back, just under the collar: ESPN has a normal version (light fabric) and a "dark" one (dark fabric) and allows CORS, so it also goes into the PNG
const jcLogoUrl = (teamId, key) => `https://a.espncdn.com/i/teamlogos/nfl/${key === 'dark' ? '500-dark' : '500'}/${({ WAS: 'wsh' })[teamId] || teamId.toLowerCase()}.png`;
async function jcLogoDataURL(teamId, key, url) {
  try {
    const r = await fetch(url || jcLogoUrl(teamId, key), { mode: 'cors' }); if (!r.ok) return null;
    const b = await r.blob();
    return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(b); });
  } catch (e) { return null; }
}
// export: official logo if the CDN allows reading it, otherwise the vector shield
async function drawCollarLogo(ctx, ox, oy, sc) {
  const { x, y, s } = NFL_COLLAR;
  const load = (src, cors) => new Promise((res, rej) => { const im = new Image(); if (cors) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = src; });
  try { const im = await load(NFL_LOGO, true); ctx.drawImage(im, ox + (x - s / 2) * sc, oy + (y - s / 2) * sc, s * sc, s * sc); }
  catch (e) {
    try {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${UNI.meta.w} ${UNI.meta.h}" width="${UNI.meta.w}" height="${UNI.meta.h}">${nflShield(x, y, 0.5)}</svg>`;
      const im = await load('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
      ctx.drawImage(im, ox, oy, UNI.meta.w * sc, UNI.meta.h * sc);
    } catch (e2) { /* the logo is decoration only */ }
  }
}
// draws one view of the jersey (shapes, collar logo, numbers and name) onto a canvas: (ox, oy) in canvas pixels, sc = canvas pixels per jersey unit
async function jcDrawJersey(ctx, cfg, view, name, num, word, id, logoData, ox, oy, sc, shadow, extra) {
  const W = UNI.meta.w, H = UNI.meta.h;
    const svg = jerseyOne(cfg, view, name, num, { noText: true, noShield: true, word, teamId: id, logoData, ...(extra || {}) });
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    if (shadow) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 14 * sc; ctx.shadowOffsetY = 14 * sc; }
    ctx.drawImage(img, ox, oy, W * sc, H * sc);
    if (shadow) ctx.restore();
    if (view === 'front') await drawCollarLogo(ctx, ox, oy, sc);
    jcTexts(cfg, view, name, num, word).concat(jcShoulderTexts(cfg, view, num)).forEach(s => {
      ctx.save();
      if (s.k === 'plate') { ctx.fillStyle = s.fill; ctx.strokeStyle = s.line; ctx.lineWidth = 0.85 * sc; const rx = ox + (s.x - s.w / 2) * sc, ry = oy + s.y * sc; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(rx, ry, s.w * sc, s.h * sc, 1.4 * sc); else ctx.rect(rx, ry, s.w * sc, s.h * sc); ctx.fill(); ctx.stroke(); ctx.restore(); return; }
      if (s.clip) { ctx.translate(ox, oy); ctx.scale(sc, sc); ctx.clip(new Path2D(s.clip === 'bo' ? UNI[view].bodyOuter : UNI[view][s.clip])); ctx.setTransform(1, 0, 0, 1, 0, 0); }
      if (s.jets) {
        const k = s.cap / 100, w = s.run.w * k, sq = w > s.maxW ? s.maxW / w : 1;
        if (s.rot !== undefined) { ctx.translate(ox + s.tx * sc, oy + s.ty * sc); ctx.rotate(s.rot * Math.PI / 180); ctx.scale(s.sx || 1, 1); ctx.translate(-w * sq / 2 * sc, -s.cap * sc); } else ctx.translate(ox + (s.x - w * sq / 2) * sc, oy + (s.y - s.cap) * sc);
        ctx.scale(k * sq * sc, k * sc);
        s.run.parts.forEach(pt => { const path = new Path2D(pt.d); ctx.save(); ctx.translate(pt.x, 0); if (s.stroke) { ctx.lineWidth = s.sw / k; ctx.lineJoin = 'round'; ctx.strokeStyle = s.stroke; ctx.stroke(path); } ctx.fillStyle = s.fill; ctx.fill(path, 'evenodd'); ctx.restore(); });
        ctx.restore(); return;
      }
      ctx.font = `${s.w} ${s.size * sc}px ${s.css}, 'Arial Narrow', Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
      if ('letterSpacing' in ctx) ctx.letterSpacing = (s.ls * sc) + 'px';
      const w = ctx.measureText(s.t).width, k = s.maxW && w > s.maxW * sc ? (s.maxW * sc) / w : 1;
      if (s.rot !== undefined) { ctx.translate(ox + s.tx * sc, oy + s.ty * sc); ctx.rotate(s.rot * Math.PI / 180); ctx.scale(s.sx || 1, 1); } else ctx.translate(ox + s.x * sc, oy + s.y * sc);
      ctx.scale(k, 1);
      if (s.stroke) { ctx.lineWidth = s.sw * sc; ctx.strokeStyle = s.stroke; ctx.strokeText(s.t, 0, 0); }
      ctx.fillStyle = s.fill; ctx.fillText(s.t, 0, 0); ctx.restore();
    });
}
async function exportJerseyPNG() {
  const alt = jcAlt(), id = S.teamId, cfg = jerseyFor(jcKey()), name = jName(S.player), num = playerNumber(), word = alt ? alt.word : TEAM[id].nick;
  await Promise.all(JC_FONTS.map(f => document.fonts.load(`${f.w} 100px ${f.css}`).catch(() => {})));
  const sc = 3, W = UNI.meta.w, H = UNI.meta.h, pad = 28, gap = 28;
  const cv = document.createElement('canvas'); cv.width = (W * 2 + gap + pad * 2) * sc; cv.height = (H + pad * 2) * sc;
  const ctx = cv.getContext('2d');
  const views = ['front', 'back'];
  const one = alt ? await jcLogoDataURL(null, null, alt.logo) : null;
  const logoData = alt ? { light: one, dark: one } : { light: await jcLogoDataURL(id, 'light'), dark: await jcLogoDataURL(id, 'dark') };
  logoData.jock = await jcLogoDataURL(null, null, 'assets/nfl/jocktag.png');
  const extra = alt ? { logoSrc: alt.logo, backLogo: one || '' } : undefined;
  for (let i = 0; i < 2; i++) await jcDrawJersey(ctx, cfg, views[i], name, num, word, id, logoData, (pad + i * (W + gap)) * sc, pad * sc, sc, undefined, extra);
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name.replace(/[^A-Z0-9]+/g, '-')}-${num}-jersey.png`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

/* ---- download the framed display case (vitrina) exactly as it looks on screen: wooden frame, team-colored mat, jersey and brass plaque ---- */
async function exportVitrinaPNG(o = {}) {
  const P = S.player, id = S.teamId, t = TEAM[id], cc = POS[P.pos], C = careerTotals(), cfg = jerseyFor(id), name = jName(P), num = playerNumber(), view = o.view || jcView || 'front', gold = !!o.gold;
  await Promise.all(JC_FONTS.map(f => document.fonts.load(`${f.w} 100px ${f.css}`).catch(() => {})).concat(['500', '600', '700', '800'].map(w => document.fonts.load(`${w} 20px 'Barlow Condensed'`).catch(() => {})), [document.fonts.load("700 12px 'Inter'").catch(() => {})]));
  const logoData = { light: await jcLogoDataURL(id, 'light'), dark: await jcLogoDataURL(id, 'dark'), jock: await jcLogoDataURL(null, null, 'assets/nfl/jocktag.png') };
  const stats = cc.careerLines(C).map(x => ({ v: fmtN(x.v), l: x.l }));
  const aw = [[awardCount('SB_CHAMP'), '🏆', 'Super Bowl'], [awardCount('MVP'), '👑', 'MVP'], [awardCount('AP1'), '🏅', 'All-Pro'], [awardCount('PB'), '⭐', 'Pro Bowl']].filter(a => a[0]).map(a => `${a[1]} ${a[0]}× ${a[2]}`);
  const seasons = S.seasons.filter(x => x.games.length), years = seasons.length ? (seasons[0].year === seasons[seasons.length - 1].year ? `${seasons[0].year}` : `${seasons[0].year} – ${seasons[seasons.length - 1].year}`) : `${S.year}`;
  const sub = `#${num} · ${P.pos} · ${years}`, foot = `${o.final ? 'CAREER TOTALS' : 'CAREER SO FAR'} · ${fmt1(C.fp)} FANTASY PTS`;
  const SC = 3, M = 64, FW = 460, PF = 16, PI = 10, JW = 300, JH = JW * UNI.meta.h / UNI.meta.w, bg = S.jerseyBg || 'team';
  const matW = FW - 2 * PF - 2 * PI, matH = 26 + 15.6 + 10 + JH + 18, plW = matW - 8, inner = plW - 28;
  const HEAD = "'Barlow Condensed', 'Arial Narrow', sans-serif", BODY = "'Inter', system-ui, sans-serif";
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  // text helper (letter spacing in css px)
  const txt = (str, x, y, font, color, ls = 0, align = 'center') => { ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; if ('letterSpacing' in ctx) ctx.letterSpacing = ls + 'px'; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const tw = (str, font, ls = 0) => { ctx.font = font; if ('letterSpacing' in ctx) ctx.letterSpacing = ls + 'px'; return ctx.measureText(str).width; };
  // plaque height: name + sub + stats + awards + footer (measured, so it matches the CSS layout)
  ctx.setTransform(SC, 0, 0, SC, 0, 0);
  const awLines = []; { let line = [], w = 0; aw.forEach(a => { const wa = tw(a, `700 12px ${BODY}`); if (line.length && w + 12 + wa > inner) { awLines.push(line); line = []; w = 0; } w += (line.length ? 12 : 0) + wa; line.push({ a, wa }); }); if (line.length) awLines.push(line); }
  const plH = 12 + 27.3 + 2 + 15.6 + 8 + 58 + (awLines.length ? 8 + awLines.length * 15 + (awLines.length - 1) * 4 : 0) + 8 + 12 + 12;
  const FH = PF + PI + matH + 12 + plH + 4 + PI + PF;
  cv.width = (FW + 2 * M) * SC; cv.height = (FH + 2 * M) * SC; ctx.setTransform(SC, 0, 0, SC, 0, 0);
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const lin = (x, y, w, h, deg, stops) => { const a = deg * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a), len = Math.abs(w * dx) + Math.abs(h * dy), cx = x + w / 2, cy = y + h / 2, g = ctx.createLinearGradient(cx - dx * len / 2, cy - dy * len / 2, cx + dx * len / 2, cy + dy * len / 2); stops.forEach(([p, c]) => g.addColorStop(p, c)); return g; };
  const inset = (x, y, w, h, r, blur, color) => { ctx.save(); rr(x, y, w, h, r); ctx.clip(); ctx.shadowColor = color; ctx.shadowBlur = blur * SC; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.rect(x - 200, y - 200, w + 400, h + 400); ctx.moveTo(x + r, y); ctx.arcTo(x, y, x, y + h, r); ctx.arcTo(x, y + h, x + w, y + h, r); ctx.arcTo(x + w, y + h, x + w, y, r); ctx.arcTo(x + w, y, x, y, r); ctx.closePath(); ctx.fill('evenodd'); ctx.restore(); };
  const fx = M, fy = M;
  /* wooden / gold frame */
  const wood1 = gold ? '#f2cf6b' : '#6a4526', wood2 = gold ? '#9b6f12' : '#3b2514', rim = gold ? '#ffe9a3' : '#8a6238';
  ctx.save(); ctx.shadowColor = gold ? 'rgba(176,119,0,.45)' : 'rgba(0,0,0,.45)'; ctx.shadowBlur = 60 * SC; ctx.shadowOffsetY = 24 * SC; rr(fx, fy, FW, FH, 10); ctx.fillStyle = wood2; ctx.fill(); ctx.restore();
  rr(fx, fy, FW, FH, 10); ctx.fillStyle = lin(fx, fy, FW, FH, 135, [[0, wood1], [0.55, wood2], [1, wood1]]); ctx.fill();
  ctx.save(); rr(fx, fy, FW, FH, 10); ctx.clip(); ctx.lineWidth = 3; ctx.strokeStyle = gold ? 'rgba(120,80,0,.5)' : 'rgba(0,0,0,.45)'; rr(fx + 3.5, fy + 3.5, FW - 7, FH - 7, 7); ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = rim; rr(fx + 1, fy + 1, FW - 2, FH - 2, 9); ctx.stroke(); ctx.restore();
  /* dark inner frame */
  const ix = fx + PF, iy = fy + PF, iw = FW - 2 * PF, ih = FH - 2 * PF;
  rr(ix, iy, iw, ih, 4); ctx.fillStyle = '#11141b'; ctx.fill(); inset(ix, iy, iw, ih, 4, 14, 'rgba(0,0,0,.8)');
  /* mat */
  const mx = ix + PI, my = iy + PI, t1 = t.c1;
  let g0, g1, tagCol = 'rgba(255,255,255,.8)';
  if (bg === 'dark') { g0 = '#1d222c'; g1 = '#0a0d12'; } else if (bg === 'light') { g0 = '#ffffff'; g1 = '#d5dbe6'; tagCol = 'rgba(20,32,64,.7)'; } else { g0 = mixHex('#1a1f2b', t1, 0.55); g1 = mixHex('#0c1018', t1, 0.25); }
  { const cx = mx + matW / 2, cy = my + matH * 0.3, rad = Math.hypot(Math.max(cx - mx, mx + matW - cx), Math.max(cy - my, my + matH - cy)), gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad); gr.addColorStop(0, g0); gr.addColorStop(bg === 'light' ? 0.9 : bg === 'dark' ? 0.85 : 0.8, g1); gr.addColorStop(1, g1); rr(mx, my, matW, matH, 3); ctx.fillStyle = gr; ctx.fill(); inset(mx, my, matW, matH, 3, 40, 'rgba(0,0,0,.55)'); }
  txt(t.name.toUpperCase(), mx + matW / 2 + 2.2, my + 26 + 12, `700 13px ${HEAD}`, tagCol, 4.42);
  const jx = mx + (matW - JW) / 2, jy = my + 26 + 15.6 + 10;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); await jcDrawJersey(ctx, cfg, view, name, num, t.nick, id, logoData, jx * SC, jy * SC, SC * JW / UNI.meta.w, true); ctx.restore(); ctx.setTransform(SC, 0, 0, SC, 0, 0);
  /* brass plaque */
  const px = mx + 4, py = my + matH + 12;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 6 * SC; ctx.shadowOffsetY = 2 * SC; rr(px, py, plW, plH, 4); ctx.fillStyle = '#c89a2c'; ctx.fill(); ctx.restore();
  rr(px, py, plW, plH, 4); ctx.fillStyle = lin(px, py, plW, plH, 135, [[0, '#f6dc8a'], [0.45, '#c89a2c'], [0.7, '#f1d27a'], [1, '#b9892a']]); ctx.fill();
  ctx.save(); rr(px, py, plW, plH, 4); ctx.clip(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(120,80,0,.35)'; rr(px + 2, py + 2, plW - 4, plH - 4, 3); ctx.stroke(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,244,200,.7)'; rr(px + 0.5, py + 0.5, plW - 1, plH - 1, 4); ctx.stroke(); ctx.restore();
  const shad = (fn) => { fn(0, 1, 'rgba(255,244,200,.55)'); fn(0, 0, '#3a2700'); };
  const cxp = px + plW / 2; let y = py + 12;
  shad((dx, dy, c) => txt(P.name.toUpperCase(), cxp + dx + 1.3, y + 21.5 + dy, `800 26px ${HEAD}`, c, 2.6)); y += 27.3 + 2;
  shad((dx, dy, c) => txt(sub.toUpperCase(), cxp + dx + 1.3, y + 12 + dy, `600 13px ${HEAD}`, c, 2.6)); y += 15.6 + 8;
  ctx.fillStyle = 'rgba(90,60,0,.45)'; ctx.fillRect(px + 14, y, inner, 1); ctx.fillRect(px + 14, y + 57, inner, 1);
  { const items = stats.map(s2 => ({ ...s2, w: Math.max(tw(s2.v, `700 28px ${HEAD}`), tw(s2.l.toUpperCase(), `500 10px ${HEAD}`, 1.4)) })), free = inner - items.reduce((a, b) => a + b.w, 0), gap = free / (items.length * 2); let x = px + 14 + gap;
    items.forEach(it => { const cx = x + it.w / 2; shad((dx, dy, c) => { txt(it.v, cx + dx, y + 9 + 24 + dy, `700 28px ${HEAD}`, c); txt(it.l.toUpperCase(), cx + dx + 0.7, y + 9 + 28 + 10 + dy, `500 10px ${HEAD}`, c, 1.4); }); x += it.w + gap * 2; }); }
  y += 58;
  if (awLines.length) { y += 8; awLines.forEach((line, li) => { const total = line.reduce((a, b) => a + b.wa, 0) + 12 * (line.length - 1); let x = cxp - total / 2; line.forEach(it => { shad((dx, dy, c) => txt(it.a, x + dx, y + 12 + dy, `700 12px ${BODY}`, c, 0, 'left')); x += it.wa + 12; }); y += 15 + 4; }); y -= 4; }
  y += 8; ctx.globalAlpha = 0.8; shad((dx, dy, c) => txt(foot.toUpperCase(), cxp + dx + 1.3, y + 10 + dy, `500 10px ${HEAD}`, c, 2.6)); ctx.globalAlpha = 1;
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name.replace(/[^A-Z0-9]+/g, '-')}-${num}-vitrina.png`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

// Framed jersey: wooden (or gold, for Hall of Famers) frame, team-colored mat and a brass plaque with career stats
function frameHTML(o = {}) {
  const P = S.player, id = S.teamId, alt = o.useAlt ? jcAlt() : null, t = alt ? { name: alt.name, nick: alt.word } : TEAM[id], cc = POS[P.pos], C = careerTotals();
  const stats = cc.careerLines(C).map(x => `<div><b>${fmtN(x.v)}</b><span>${x.l}</span></div>`).join('');
  const aw = [[awardCount('SB_CHAMP'), '🏆', 'Super Bowl'], [awardCount('MVP'), '👑', 'MVP'], [awardCount('AP1'), '🏅', 'All-Pro'], [awardCount('PB'), '⭐', 'Pro Bowl']].filter(a => a[0]).map(a => `<span>${a[1]} ${a[0]}× ${a[2]}</span>`).join('');
  const seasons = S.seasons.filter(s => s.games.length);
  const years = seasons.length ? (seasons[0].year === seasons[seasons.length - 1].year ? `${seasons[0].year}` : `${seasons[0].year} – ${seasons[seasons.length - 1].year}`) : `${S.year}`;
  return `<div class="frame ${o.gold ? 'gold' : ''}" style="${themeVars(id)}"><div class="frame-in">
    <div class="mat bg-${S.jerseyBg || 'team'}"><div class="mat-tag">${t.name.toUpperCase()}</div>
      <div class="mat-jersey">${alt ? jerseySVG(jerseyFor(alt.key), jName(P), playerNumber(), jcOpts({ view: o.view || 'both' })) : jerseySVG(jerseyFor(id), jName(P), playerNumber(), { view: o.view || 'both', word: t.nick })}</div></div>
    <div class="plaque"><div class="pl-name">${esc(P.name)}</div><div class="pl-sub">#${playerNumber()} · ${P.pos} · ${years}</div>
      <div class="pl-stats">${stats}</div>${aw ? `<div class="pl-aw">${aw}</div>` : ''}<div class="pl-foot">${o.final ? 'CAREER TOTALS' : 'CAREER SO FAR'} · ${fmt1(C.fp)} FANTASY PTS</div></div></div></div>`;
}
// Small jersey card for the dashboard
function jerseyCardHTML() {
  const P = S.player, id = S.teamId;
  return `<section class="card jersey-card"><div class="card-h"><h3>JERSEY</h3><span class="chip gold">#${playerNumber()}</span></div>
    <div class="jc-body"><div class="jc-svg">${jerseySVG(jerseyFor(id), jName(P), playerNumber(), { team: id, part: 'jersey' })}</div>
      <div class="jc-text"><b>${esc(jName(P))}</b><span class="muted">${TEAM[id].name}</span>
        <button class="btn btn-ghost btn-sm" data-act="viewLocker">OPEN CREATOR</button></div></div></section>`;
}
// Live jersey preview while creating the player (the jersey name is its own field)
function updateCreateJersey() {
  const el = document.getElementById('createJersey'); if (!el) return;
  const n = parseInt(form.number, 10), ok = numberOk(form.pos, n);
  const shown = cleanJerseyName(form.jerseyName) || cleanJerseyName(surname(form.name)) || 'YOUR NAME';
  const ym = form.youth && MFL_INFO[form.youth];
  const sec = document.getElementById('collegeSec'), note = document.getElementById('youthNote'), eb = document.getElementById('stageEyebrow');
  if (sec) sec.hidden = !!ym; if (note) note.hidden = !ym; if (eb) eb.textContent = ym ? 'YOUR FIRST JERSEY' : 'YOUR COLLEGE JERSEY';
  if (ym) {
    el.innerHTML = youthJerseySVG(form.youth, 'both', Number.isInteger(n) ? clamp(n, 0, 99) : '?', shown);
    const yp0 = document.getElementById('createYouth'); if (yp0) yp0.innerHTML = '';
    const cc0 = document.getElementById('createCollege'); if (cc0) cc0.innerHTML = `<img class="col-logo" src="${mflLogo(ym.slug)}" alt=""><b>${esc(form.youth)}</b>`;
    if (updateCreateJersey.last !== 'y:' + form.youth) { updateCreateJersey.last = 'y:' + form.youth; el.classList.remove('jswap'); void el.offsetWidth; el.classList.add('jswap'); }
    const hint0 = document.getElementById('numHint'); if (hint0) { hint0.textContent = ok ? `${form.pos} numbers: ${numberRule(form.pos)}` : `${form.pos} numbers must be ${numberRule(form.pos)}`; hint0.className = 'hint ' + (ok ? '' : 'bad'); }
    const jn0 = document.querySelector('[data-model="jerseyName"]'); if (jn0) jn0.placeholder = cleanJerseyName(surname(form.name)) || 'Defaults to your last name';
    return;
  }
  el.innerHTML = jerseySVG(form.college ? collegeJersey(form.college) : neutralJersey(), shown, Number.isInteger(n) ? clamp(n, 0, 99) : '?', { view: 'both', noShield: true, word: String(form.college || 'ROOKIE').toUpperCase(), backLogo: COLLEGE_INFO[form.college] ? collegeLogo(COLLEGE_INFO[form.college].id, 80) : '' });
  const yp = document.getElementById('createYouth');
  if (yp) yp.innerHTML = form.youth && MFL_INFO[form.youth] ? `<div class="eyebrow">YOUR FIRST JERSEY · ${esc(form.youth).toUpperCase()} (${ym.lg === 'HS' ? 'HIGH SCHOOL' : 'MFL'})</div><div class="stage-jersey">${youthJerseySVG(form.youth, 'both', Number.isInteger(n) ? clamp(n, 0, 99) : '?', shown)}</div>` : '';
  const cc = document.getElementById('createCollege'); if (cc) cc.innerHTML = form.college ? `${collegeImg(form.college, 80, 'col-logo')}<b>${esc(form.college)}</b>` : '<b class="muted">No team selected yet</b>';
  if (updateCreateJersey.last !== form.college) { updateCreateJersey.last = form.college; el.classList.remove('jswap'); void el.offsetWidth; el.classList.add('jswap'); }
  const hint = document.getElementById('numHint');
  if (hint) { hint.textContent = ok ? `${form.pos} numbers: ${numberRule(form.pos)}` : `${form.pos} numbers must be ${numberRule(form.pos)}`; hint.className = 'hint ' + (ok ? '' : 'bad'); }
  const jn = document.querySelector('[data-model="jerseyName"]'); if (jn) jn.placeholder = cleanJerseyName(surname(form.name)) || 'Defaults to your last name';
}
// Faint team-logo watermark + team-colored glow behind every in-game screen (NFL shield on menus)
function updateBackdrop(html) {
  const el = document.getElementById('bgmark'); if (!el) return;
  const menu = !S || !S.teamId || !['season', 'summary', 'development', 'freeAgency', 'retired'].includes(S.phase) || /title-screen|form-card|player-card|draft-screen/.test(html);
  const id = menu ? null : S.teamId, url = id ? logoUrl(id) : NFL_LOGO;
  document.documentElement.style.setProperty('--glow', id ? accentOf(TEAM[id]) : '#35e0ff');
  if (el.dataset.src === url) return;
  el.dataset.src = url; el.classList.add('swap');
  setTimeout(() => { el.style.setProperty('--mark', `url('${url}')`); el.classList.remove('swap'); }, 220);
}

const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
let screenToken = 0;
function setScreen(html, cls = '') {
  screenToken++;
  app.className = 'screen ' + cls;
  app.innerHTML = html;
  updateBackdrop(html);
  window.scrollTo(0, 0); app.scrollTop = 0;
}
function openModal(html, cls = '') {
  modalRoot.innerHTML = `<div class="overlay"><div class="modal-card ${cls}">${html}</div></div>`;
}
const closeModal = () => { modalRoot.innerHTML = ''; };
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  document.getElementById('toast-root').appendChild(el);
  setTimeout(() => el.classList.add('out'), 2400); setTimeout(() => el.remove(), 2900);
}
let pendingConfirm = null;
function confirmBox(title, text, yes, onYes, danger) {
  pendingConfirm = onYes;
  openModal(`<h3 class="modal-h">${title}</h3><p class="modal-p">${text}</p>
    <div class="row end"><button class="btn btn-ghost" data-act="closeModal">CANCEL</button>
    <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="confirmYes">${yes}</button></div>`, 'small');
}
// Full-screen transition card
function splash(title, sub, ms = 1500) {
  return new Promise(res => {
    const el = document.createElement('div');
    el.className = 'splash';
    el.innerHTML = `<div class="splash-in">${nflLogo('season')}<div class="splash-title">${title}</div><div class="splash-sub">${sub}</div></div>`;
    document.body.appendChild(el); Snd.play("whoosh");
    const end = () => { el.remove(); res(); };
    el.addEventListener('click', () => { el.classList.add('out'); setTimeout(end, 250); }, { once: true });
    setTimeout(() => el.classList.add('out'), Math.max(0, ms - 350)); setTimeout(() => { if (el.isConnected) end(); }, ms);
  });
}
// Small particle burst (touchdowns, awards, contracts)
// confetti colors: your current team's (dark colors get lighter shades so they show up on dark screens), plus a little white
function confettiColors() {
  let c1, c2;
  if (typeof CS !== 'undefined' && CS && CS.info && !(S && S.phase === 'season')) { c1 = CS.info.c1; c2 = CS.info.c2; }
  else if (S && S.teamId && TEAM[S.teamId]) { c1 = TEAM[S.teamId].c1; c2 = TEAM[S.teamId].c2; }
  if (!c1) return ['#c5ff3a', '#ffc53d', '#ffffff', '#35e0ff'];
  const shades = c => (lum(c) < 0.3 ? [mixHex(c, '#ffffff', 0.4), mixHex(c, '#ffffff', 0.22), c] : [c, c, mixHex(c, '#ffffff', 0.25)]);
  return [...shades(c1), ...shades(c2 || c1), '#ffffff'];
}
function burst(parent, n = 28, colors) {
  colors = colors || confettiColors();
  const box = document.createElement('div'); box.className = 'burst';
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.style.setProperty('--dx', rr(-190, 190) + 'px'); p.style.setProperty('--dy', rr(-180, 20) + 'px');
    p.style.setProperty('--r', rr(-540, 540) + 'deg'); p.style.background = pick(colors); p.style.animationDelay = rr(0, 0.2) + 's';
    box.appendChild(p);
  }
  parent.appendChild(box); setTimeout(() => box.remove(), 2200);
}
function countUp(el, from, to, ms = 1100) {
  const t0 = performance.now();
  const step = t => {
    const k = Math.min(1, (t - t0) / ms);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const accentOf = t => (lum(t.c1) < 0.2 ? t.c2 : t.c1);
const textOn = hex => (lum(hex) > 0.6 ? '#101820' : '#ffffff');
// a readable accent for text / glows on the dark UI: the brighter of the two team colors, lightened if it is still dark
const brightOf = t => { let c = lum(t.c1) >= lum(t.c2) ? t.c1 : t.c2; if (lum(c) < 0.32) c = mixHex(c, '#ffffff', 0.5); return c; };
// Team logos come from Sleeper's CDN (…/team_logos/nfl/<abbr>.png). If an image can't load (offline), the badge
// falls back to the colored abbreviation chip. The NFL shield comes from ESPN's CDN.
const logoUrl = id => `assets/nfl-logos/${id}.svg`;   // vector logos from nfl.com: razor sharp at any size
const NFL_LOGO = 'https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png';
const nflLogo = (cls = '') => `<img class="nfl-logo ${cls}" src="${NFL_LOGO}" alt="NFL" onerror="this.remove()">`;
function badge(id, size = '') {
  const t = TEAM[id];
  return `<span class="team-badge logo ${size}" style="--t1:${t.c1};--t2:${t.c2};color:${textOn(t.c1)}"><img src="${logoUrl(id)}" alt="${t.id}" loading="lazy" onerror="this.parentNode.classList.remove('logo');this.remove()"><b>${t.id}</b></span>`;
}
function themeVars(id) { const t = TEAM[id]; return `--t1:${t.c1};--t2:${t.c2};--ta:${accentOf(t)}`; }
const tile = (l, v, cls = '') => `<div class="tile ${cls}"><div class="tile-v">${v}</div><div class="tile-l">${l}</div></div>`;
const posBadge = p => `<span class="pos-badge">${p}</span>`;
function barClass(v) { return v >= 88 ? 'elite' : v >= 75 ? 'hi' : v >= 60 ? 'mid' : 'lo'; }
function attrBars(P) {
  return POS[P.pos].attrs.map(([n]) => `<div class="attr"><span>${n}</span><b>${P.attrs[n]}</b><div class="bar ${barClass(P.attrs[n])}"><i style="--w:${P.attrs[n]}%"></i></div></div>`).join('');
}
const ovrRing = (ovr, cls = '') => `<div class="ovr-ring ${cls}" style="--p:${ovr}"><span class="n">${ovr}</span><small>OVR</small></div>`;
const awardChips = list => (list && list.length ? list.map(a => `<span class="award">${a.icon} ${esc(a.label)}</span>`).join('') : '');

/* ---------------------------------------------------------------------
   11. SCREENS
   --------------------------------------------------------------------- */
/* --- Title ---------------------------------------------------------------- */
function renderTitle() {
  const can = hasSave();
  let info = 'No saved career found';
  if (can) {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      info = d.phase === 'retired' ? `${esc(d.player.name)} · ${d.player.pos} · Retired` : `${esc(d.player.name)} · ${d.player.pos} · ${d.teamId ? TEAM[d.teamId].name : 'Draft'} · ${d.year} · Age ${d.player.age}`;
    } catch (e) { info = 'Saved career'; }
  }
  setScreen(`<div class="title-screen">
    <div class="title-bg"></div>
    <div class="title-inner">
      ${nflLogo('title')}
      <div class="eyebrow">THE CAREER MODE</div>
      <h1 class="logo">NFL<span>CAREER</span></h1>
      <p class="tagline">Build Your Legacy</p>
      <div class="menu">
        <button class="btn btn-primary btn-xl" data-act="startCareer">START CAREER</button>
        <button class="btn btn-ghost" data-act="continueCareer" ${can ? '' : 'disabled'}>CONTINUE CAREER</button>
        <button class="btn btn-ghost" data-act="startCareer">NEW CAREER</button>
        <button class="btn btn-danger-ghost" data-act="resetSave" ${can ? '' : 'disabled'}>RESET SAVE</button>
      </div>
      <div class="save-info">${info}</div>
    </div></div>`);
}

/* --- Create player ----------------------------------------------------------- */
/* ---- college picker: every NCAA program with its official logo ---- */
let collegeDiv = 'ALL';
const collegeImg = (name, size = 80, cls = 'col-logo') => { const c = COLLEGE_INFO[name]; return c ? `<img class="${cls}" src="${collegeLogo(c.id, size)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : ''; };
const collegeChip = name => `<span class="chip chip-col">${collegeImg(name, 40, 'col-logo xs')}${esc(name)}</span>`;
const DIV_LABEL = { FBS: 'FBS', FCS: 'FCS', OTHER: 'Other', MX: 'México', LFA: 'LFA', UFL: 'UFL', MFL: 'MFL', HS: 'High School' };
// leagues shown first; picking one reveals its teams
const COLLEGE_LEAGUES = [
  { k: 'NCAA', name: 'NCAA', sub: 'College football', logo: 'assets/leagues/ncaa.png', divs: ['FBS', 'FCS', 'OTHER'] },
  { k: 'MX', name: 'ONEFA', sub: 'México · universities', logo: 'assets/leagues/onefa.png', divs: ['MX'] },
  { k: 'LFA', name: 'LFA', sub: 'México · pro league', logo: 'assets/leagues/lfa.png', divs: ['LFA'] },
  { k: 'UFL', name: 'UFL', sub: 'United Football League', logo: 'assets/leagues/ufl.png', divs: ['UFL'] },
];
const leagueOfDiv = d => (COLLEGE_LEAGUES.find(l => l.divs.includes(d)) || {}).k || 'NCAA';
let collegeLeague = '';   // '' = the league screen
function collegePickerHTML() {
  const cur = COLLEGE_INFO[form.college] || null;
  const count = l => NCAA.filter(r => l.divs.includes(r[2])).length;
  const leagues = COLLEGE_LEAGUES.map(l => `<button type="button" class="cp-league" data-act="collegeLeague" data-l="${l.k}"><img src="${l.logo}" alt=""><div><b>${l.name}</b><span>${l.sub}</span><em>${count(l)} teams</em></div></button>`).join('');
  const subs = [['ALL', 'All'], ['FBS', 'FBS'], ['FCS', 'FCS'], ['OTHER', 'Other']].map(([k, l]) => `<button type="button" class="mini ${collegeDiv === k ? 'on' : ''}" data-act="collegeTab" data-d="${k}">${l}</button>`).join('');
  const tiles = NCAA.map(([id, name, div, conf]) => `<button type="button" class="cp-tile ${name === form.college ? 'on' : ''}" data-act="pickCollege" data-n="${esc(name)}" data-d="${div}" data-l="${leagueOfDiv(div)}" data-q="${esc((name + ' ' + conf + (div === 'MX' ? ' mexico méxico onefa' : div === 'LFA' ? ' lfa mexico méxico liga profesional' : div === 'UFL' ? ' ufl united football league professional pro' : ' ncaa')).toLowerCase())}" title="${esc(name)}${conf ? ' · ' + esc(conf) : ''}"><img src="${collegeLogo(id, 80)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span>${esc(name)}</span></button>`).join('');
  return `<div class="college-pick" id="cpRoot">
    <div class="cp-cur" id="cpCur">${cur ? `${collegeImg(form.college, 120, 'col-logo lg')}<div><b>${esc(form.college)}</b><span>${(cur.conf ? esc(cur.conf) + ' · ' : '') + DIV_LABEL[cur.div]}</span></div>` : '<span class="youth-ph">🎓</span><div><b>No team selected</b><span>pick a league below</span></div>'}</div>
    <div class="cp-tools"><button type="button" class="mini cp-back" id="cpBack" data-act="collegeBack" hidden>◂ LEAGUES</button><input class="input cp-search" data-filter="college" placeholder="Search ${NCAA.length} teams…" autocomplete="off"></div>
    <div class="cp-leagues" id="cpLeagues">${leagues}</div>
    <div class="minis cp-subs" id="cpSubs" hidden>${subs}</div>
    <div class="cp-grid" id="cpGrid" hidden>${tiles}<div class="cp-empty" hidden>No team matches that search.</div></div>
  </div>`;
}
function applyCollegeFilter() {
  const grid = document.getElementById('cpGrid'); if (!grid) return;
  const q = ((document.querySelector('[data-filter="college"]') || {}).value || '').trim().toLowerCase();
  const showTeams = !!collegeLeague || !!q;
  document.getElementById('cpLeagues').hidden = showTeams; grid.hidden = !showTeams;
  document.getElementById('cpBack').hidden = !showTeams; document.getElementById('cpSubs').hidden = collegeLeague !== 'NCAA' || !!q;
  document.querySelectorAll('#cpSubs .mini').forEach(b => b.classList.toggle('on', b.dataset.d === collegeDiv));
  let n = 0;
  grid.querySelectorAll('.cp-tile').forEach(t => {
    const lg = !q && collegeLeague ? t.dataset.l === collegeLeague && (collegeLeague !== 'NCAA' || collegeDiv === 'ALL' || t.dataset.d === collegeDiv) : true;
    const ok = lg && (!q || t.dataset.q.includes(q)); t.hidden = !ok; if (ok) n++;
  });
  const e = grid.querySelector('.cp-empty'); if (e) e.hidden = n > 0;
}
let form = { name: '', pos: 'WR', college: '', age: 22, number: NUM_DEFAULT.WR, jerseyName: '', youth: '' };
let preview = null, rerolls = 3;
// first team: the MFL (Monterrey Football League) youth club where you started as a kid (optional, just for the story)
const youthChip = name => { const i = MFL_INFO[name]; return i ? `<span class="chip chip-col youth-chip" style="--yc:${i.c1}"><img class="col-logo xs" src="${mflLogo(i.slug)}" alt="">${esc(name)} <small>${i.lg === 'HS' ? 'HS' : 'MFL'}</small></span>` : ''; };
// first-team picker: two leagues side by side (MFL kids league / U.S. high schools), then the team grid
let ypLg = 'MFL';
function youthGridHTML(lg) {
  const rows = lg === 'HS' ? HS_TEAMS : MFL_TEAMS;
  return rows.map(([slug, name, c1]) => `<button type="button" class="cp-tile ${name === form.youth ? 'on' : ''}" data-act="youthPick" data-n="${esc(name)}" style="--yc:${'#' + c1}"><img src="${mflLogo(slug)}" alt=""><span>${esc(name)}</span></button>`).join('');
}
function youthModal() {
  if (MFL_INFO[form.youth] && !document.getElementById('youthPrev')) ypLg = MFL_INFO[form.youth].lg;
  openModal(`<h3 class="modal-h">YOUR FIRST TEAM</h3><p class="modal-p">Where did you start playing? Pick a league, then a team.</p>
    <div class="yp-tabs"><button type="button" class="yp-tab ${ypLg === 'MFL' ? 'on' : ''}" data-act="youthLg" data-lg="MFL"><img src="${LEAGUE_LOGO.MFL}" alt=""><span><b>MFL</b><small>Kids league · Monterrey</small></span></button><button type="button" class="yp-tab ${ypLg === 'HS' ? 'on' : ''}" data-act="youthLg" data-lg="HS"><i class="yp-hs">HS</i><span><b>USA High School</b><small>MaxPreps national top 25</small></span></button></div>
    <div class="youth-prev" id="youthPrev" style="--yc:${(MFL_INFO[form.youth] || {}).c1 || '#4a5a7a'}">${youthPrevHTML()}</div>
    <div class="cp-grid youth-grid">${youthGridHTML(ypLg)}</div>
    <div class="row end"><button class="btn btn-ghost" data-act="youthNone">NO YOUTH TEAM</button><button class="btn btn-primary" data-act="closeModal">DONE</button></div>`, 'youth');
}
// the jersey shown while you browse the MFL teams (your name and number on it)
function youthPrevHTML() {
  const i = MFL_INFO[form.youth], n = parseInt(form.number, 10), shown = cleanJerseyName(form.jerseyName) || cleanJerseyName(surname(form.name)) || 'YOUR NAME';
  return i ? `<div class="yp-jersey">${youthJerseySVG(form.youth, 'both', Number.isInteger(n) ? n : '', shown)}</div><div class="yp-name"><img src="${mflLogo(i.slug)}" alt=""><b>${esc(form.youth)}</b><small>${i.lg === 'HS' ? 'High School · ' + esc(i.st) : 'MFL'}</small></div>` : '<div class="yp-empty">Tap a team to see its jersey</div>';
}
function youthRowHTML() {
  const i = MFL_INFO[form.youth];
  return i ? `<button type="button" class="youth-btn on" data-act="pickYouth" style="--yc:${i.c1};--yc2:${i.c2}"><span class="youth-jy">${youthJerseySVG(form.youth, 'front', Number.isInteger(parseInt(form.number, 10)) ? parseInt(form.number, 10) : '', '')}</span><div><b>${esc(form.youth)}</b><span>MFL · your first team</span></div><em>CHANGE</em></button><button type="button" class="mini youth-x" data-act="youthNone" title="Remove">✕</button>`
    : `<button type="button" class="youth-btn" data-act="pickYouth"><span class="youth-ph">🧒</span><div><b>Choose your first team</b><span>MFL or U.S. high school · optional</span></div><em>PICK</em></button>`;
}
function renderCreate() {
  collegeDiv = 'ALL'; collegeLeague = '';
  setScreen(`<div class="wrap create">
    <div class="eyebrow">STEP 1 OF 2</div><h2 class="h-xl">CREATE YOUR PLAYER</h2>
    <div class="create-grid">
    <div class="card form-card">
      <label class="lbl">Player Name</label>
      <input class="input" data-model="name" maxlength="24" placeholder="e.g. Alex Johnson" value="${esc(form.name)}" autocomplete="off">
      <label class="lbl">Position</label>
      <div class="pos-grid">${Object.keys(POS).map(p => `<button class="pos-btn ${form.pos === p ? 'sel' : ''}" data-act="pickPos" data-pos="${p}"><b>${p}</b><span>${POS[p].name}</span></button>`).join('')}</div>
      <label class="lbl lbl-m">First Team <span class="hint">where you started as a kid</span></label>
      <div class="youth-row" id="youthRow">${youthRowHTML()}</div>
      <div id="collegeSec" ${form.youth ? 'hidden' : ''}>
      <label class="lbl lbl-m">College <span class="hint">every NCAA program + Mexican ONEFA and LFA teams + the UFL</span></label>
      ${collegePickerHTML()}
      </div>
      <div class="youth-note" id="youthNote" ${form.youth ? '' : 'hidden'}>🧒 <b>You'll play a season with your first team.</b> Then 5 colleges (NCAA and ONEFA), the LFA and the UFL make you offers — and you pick where to go next. Leave First Team empty to choose a college right now.</div>
      <div class="row3">
        <div><label class="lbl">Age</label><input class="input" type="number" min="21" max="25" data-model="age" value="${form.age}"></div>
        <div><label class="lbl">Jersey Number <span class="hint" id="numHint"></span></label><input class="input" type="number" min="0" max="99" data-model="number" value="${form.number}"></div>
        <div><label class="lbl">&nbsp;</label><button class="btn btn-ghost" data-act="randNumber" style="width:100%">RANDOM #</button></div>
      </div>
      <label class="lbl">Name on the Jersey <span class="hint">what the back says — separate from your player name</span></label>
      <input class="input" data-model="jerseyName" maxlength="12" placeholder="Defaults to your last name" value="${esc(form.jerseyName || '')}" autocomplete="off">
      <div class="row end"><button class="btn btn-ghost" data-act="toTitle">BACK</button><button class="btn btn-primary" data-act="genPlayer">GENERATE PLAYER</button></div>
    </div>
    <div class="card jersey-stage"><div class="eyebrow" id="stageEyebrow">YOUR COLLEGE JERSEY</div><div id="createCollege" class="create-college"></div><div id="createJersey" class="stage-jersey"></div><div id="createYouth" class="create-youth"></div>
      <div class="muted small">The colors follow the college you pick. Name and number update as you type. You'll get your team's colors after the draft — and can design it freely in the Jersey Creator (Locker Room).</div></div>
    </div></div>`);
  updateCreateJersey();
}
function renderPreview() {
  const P = preview;
  setScreen(`<div class="wrap narrow">
    <div class="eyebrow">STEP 2 OF 2 · PRE-SEASON</div><h2 class="h-xl">YOUR PLAYER</h2>
    <div class="card player-card pop">
      <div class="pc-top">
        ${ovrRing(P.ovr, 'big')}
        <div class="pc-id">
          <div class="pc-name">${esc(P.name)}</div>
          <div class="chips">${posBadge(P.pos)}<span class="chip">${POS[P.pos].name}</span>${P.college ? collegeChip(P.college) : ''}${youthChip(P.youth)}<span class="chip">AGE ${P.age}</span></div>
          <div class="chips"><span class="chip ${P.dev === 'Normal' ? '' : 'gold'}">${P.dev === 'Normal' ? '' : '★ '}${P.dev} development</span>${P.college ? `<span class="chip">Projection: ${draftProjectionLabel(P)}</span>` : `<span class="chip">Recruits: ${rcLabel(rcLevel(P))}</span>`}</div>
        </div>
        <div class="pc-jersey">${P.college ? jerseySVG(collegeJersey(P.college), jName(P), P.number, { noShield: true, backLogo: COLLEGE_INFO[P.college] ? collegeLogo(COLLEGE_INFO[P.college].id, 80) : '' }) : youthJerseySVG(P.youth, 'front', P.number, jName(P))}</div>
      </div>
      <div class="attr-grid">${attrBars(P)}</div>
    </div>
    <div class="row between">
      <button class="btn btn-ghost" data-act="backCreate">EDIT DETAILS</button>
      <div class="row">
        <button class="btn btn-ghost" data-act="reroll" ${rerolls ? '' : 'disabled'}>REROLL (${rerolls} left)</button>
        ${P.college ? `<button class="btn btn-ghost" data-act="enterDraft">SKIP TO DRAFT</button>
        <button class="btn btn-primary" data-act="startCollege">🎓 PLAY COLLEGE SEASON</button>` : `<button class="btn btn-ghost" data-act="skipOffers">SKIP TO OFFERS</button>
        <button class="btn btn-primary" data-act="startYouth">🧒 PLAY ${esc(P.youth).toUpperCase()} SEASON</button>`}
      </div>
    </div></div>`);
}

/* --- Draft ------------------------------------------------------------------- */
let draftSkipped = false, draftWaits = [];
const waitD = ms => new Promise(r => { const t = setTimeout(r, ms); draftWaits.push(() => { clearTimeout(t); r(); }); });
function draftFinalHTML() {
  const P = S.player, d = S.draft, t = TEAM[d.teamId], c = S.contract;
  return `<div class="draft-final pop" style="${themeVars(d.teamId)}">
    <div class="draft-row">${badge(d.teamId, 'xl')}<div class="draft-jersey">${jerseySVG(jerseyFor(d.teamId), jName(P), playerNumber(), { view: 'both', team: d.teamId, word: t.nick })}<span>YOUR #${playerNumber()} JERSEY</span></div></div>
    <div class="d-name">${esc(P.name)}<span>${P.pos}</span></div>
    <div class="d-sub">${d.undrafted ? 'Undrafted free agent' : `Round ${d.round} — Pick #${d.pick} (Overall #${d.overall})`} · ${t.name}</div>
    <div class="d-contract"><div>${c.years} YEARS</div><div>${money(c.total)}</div><div>${money(c.guaranteed)} GUARANTEED</div></div>
    <div class="welcome">Welcome to the NFL.</div>
    <button class="btn btn-primary btn-xl" data-act="beginRookie">BEGIN ROOKIE SEASON</button></div>`;
}
// "college -> NFL team" reveal: the school's logo, an arrow that draws itself, and the franchise popping in
function collegeToNflHTML(P, teamId, undrafted) {
  const t = TEAM[teamId], ci = COLLEGE_INFO[P.college];
  const left = ci ? `<img class="c2n-logo" src="${collegeLogo(ci.id, 240)}" alt="" onerror="this.style.visibility='hidden'">` : `<div class="c2n-ph">${esc(String(P.college || '?').slice(0, 2).toUpperCase())}</div>`;
  return `<div class="select-line">${undrafted ? '…but the' : 'The ' + esc(t.name) + ' select'}</div>
    <div class="c2n">
      <div class="c2n-col c2n-from">${left}<span>${esc(P.college)}</span></div>
      <svg class="c2n-arrow" viewBox="0 0 140 40" aria-hidden="true"><path class="c2n-line" d="M4 20 H118"/><path class="c2n-head" d="M104 6 L128 20 L104 34"/></svg>
      <div class="c2n-col c2n-to"><img class="c2n-logo" src="${logoUrl(teamId)}" alt="" onerror="this.style.visibility='hidden'"><span>${esc(t.name)}</span></div>
    </div>${undrafted ? '<div class="select-line">sign you as an undrafted free agent.</div>' : ''}`;
}
async function renderDraft() {
  const d = S.draft, P = S.player, t = TEAM[d.teamId];
  setScreen(`<div class="draft-screen" style="${themeVars(d.teamId)}"><div class="draft-bg"></div>
    <div class="wrap narrow center">
      ${nflLogo('draft')}<div class="eyebrow">${d.year} NFL DRAFT</div>
      <div class="draft-stage" id="dStage"></div>
      <button class="btn btn-ghost skip" id="dSkip" data-act="draftSkip">SKIP ▸</button>
    </div></div>`);
  const tok = screenToken, stage = document.getElementById('dStage'), alive = () => tok === screenToken && !draftSkipped;
  draftSkipped = false; draftWaits = [];
  const show = html => { stage.innerHTML = html; };
  const finish = () => {
    if (tok !== screenToken) return;
    const sk = document.getElementById('dSkip'); if (sk) sk.remove();
    Snd.play("draftEnd"); show(draftFinalHTML()); burst(stage, 40, [t.c1, t.c2, '#ffffff', '#ffc53d']);
  };
  if (d.undrafted) {
    Snd.play("clock"); show('<div class="clock">THE DRAFT HAS ENDED…</div><div class="muted">Waiting for the phone to ring…</div>'); await waitD(2000);
    if (alive()) { Snd.play("down"); show('<div class="pick-line bad">UNDRAFTED</div><div class="muted">Your name was never called.</div>'); await waitD(1700); }
    if (alive()) { Snd.play("pick"); show(collegeToNflHTML(P, d.teamId, true)); Snd.play("fanfare", 1.15); await waitD(3300); }
  } else {
    const fake = [3, 2, 1].filter(k => d.overall - k >= 1).map(k => `<div class="tick-row"><b>#${d.overall - k}</b> ${pick(FIRST)} ${pick(LAST)} — ${pick(Object.keys(POS))}</div>`).join('');
    Snd.play("clock"); show(`<div class="clock">ON THE CLOCK…</div><div class="ticker">${fake}</div>`); await waitD(2200);
    if (alive()) { Snd.play("pick"); show(`<div class="pick-line">Round ${d.round} — Pick #${d.pick}</div><div class="muted">Overall #${d.overall}</div>`); await waitD(1500); }
    if (alive()) { Snd.play("pick"); show(collegeToNflHTML(P, d.teamId, false)); Snd.play("fanfare", 1.15); await waitD(3200); }
    if (alive()) { Snd.play("roar"); show(`<div class="badge-pop small">${badge(d.teamId, 'lg')}</div><div class="select-line">The ${t.name} select</div><div class="d-name big pop">${esc(P.name)}<span>${P.pos}</span></div><div class="muted">${esc(P.college)}</div>`); burst(stage, 36, [t.c1, t.c2, '#ffffff', '#ffc53d']); await waitD(2300); }
  }
  finish();
}

/* --- Dashboard ---------------------------------------------------------------- */
function nextGameInfo(season) {
  if (season.status === 'regular') {
    const g = season.schedule[season.idx], t = TEAM[g.oppId], w = typeof calWhenOfUser === 'function' ? calWhenOfUser(season, season.idx) : null;
    return { title: `WEEK ${g.week}`, opp: t, ha: g.home ? 'vs' : '@', when: w ? `${calShort(w.date)} · ${w.time} ET · ${w.name}` : '' };
  }
  const m = poMatchup(season), t = TEAM[m.oppId], w = typeof calPlayoffWhen === 'function' ? calPlayoffWhen(season, m.short) : null;
  return { title: m.name.toUpperCase(), opp: t, ha: m.short === 'SB' ? 'vs' : (season.po.mySeed < m.oppSeed ? 'vs' : '@'), when: w ? `${calShort(w.date)} · ${w.time} ET · ${w.name}` : '' };
}
function sparkBars(season) {
  const g = season.games.concat(season.playoffGames).slice(-8);
  if (!g.length) return '<div class="muted small">No games played yet.</div>';
  const mx = Math.max(10, ...g.map(x => x.fp));
  return `<div class="spark">${g.map(x => `<div class="sp" title="${x.st === 'OUT' ? (x.dnp ? 'DNP' : 'Injured') : fmt1(x.fp) + ' FP'}"><i class="r${x.st === 'OUT' ? 'x' : x.rate}" style="height:${x.st === 'OUT' ? 6 : Math.max(6, 100 * x.fp / mx)}%"></i><span>${x.k === 'PO' ? x.wk : 'W' + x.wk}</span></div>`).join('')}</div>`;
}
function renderDashboard() {
  const P = S.player, cfg = POS[P.pos], se = curSeason(), team = TEAM[S.teamId];
  const T = seasonTotals(se), C = careerTotals(), rec = recOf(se), rk = curRoleKey();
  const done = se.status === 'done';
  const completed = S.seasons.filter(s => s.complete).length;
  const last = se.games.concat(se.playoffGames).slice(-1)[0];
  let nextCard = '';
  if (done) nextCard = `<div class="next-card done"><div class="eyebrow">SEASON COMPLETE</div><div class="nc-big">${se.po && se.po.champion ? '🏆 SUPER BOWL CHAMPIONS' : 'The season has ended'}</div><div class="muted">View your season summary to see awards and player development.</div></div>`;
  else { const n = nextGameInfo(se); nextCard = `<div class="next-card ${se.status === 'playoffs' ? 'po' : ''}" style="--o1:${n.opp.c1};--o2:${n.opp.c2}"><img class="nc-ghost" src="${logoUrl(n.opp.id)}" alt=""><div class="eyebrow">${n.title}${se.status === 'playoffs' ? ' · PLAYOFFS' : ''}</div><div class="nc-row">${badge(n.opp.id, 'lg')}<div><div class="nc-big">${n.ha} ${n.opp.name}</div><div class="muted">${n.opp.conf} ${n.opp.div} · Team strength ${Math.round(S.teamRatings[n.opp.id])}</div></div></div>${n.when ? `<div class="nc-when">🗓️ ${n.when}</div>` : ''}</div>`; }
  const inj = se.injury ? `<div class="banner warn">⚠️ <b>INJURY</b> — ${esc(se.injury.name)} · Expected recovery: ${se.injury.weeksLeft} week${se.injury.weeksLeft > 1 ? 's' : ''}</div>` : '';
  const sum = cfg.summary(T), car = cfg.career(C), divLine = divisionLine(se);
  const pend = offersOf(se).length, dlText = deadlineText(se);
  const tradeBanner = pend ? `<div class="banner trade"><span>📞 <b>TRADE OFFER${pend > 1 ? 'S' : ''}</b> — ${pend} team${pend > 1 ? 's want' : ' wants'} to acquire you.</span><button class="btn btn-ghost btn-sm" data-act="viewTrades">OPEN TRADE CENTER</button></div>` : '';
  const lastCard = last ? (last.st === 'OUT' ? `<div class="last-game"><span class="muted">Last game:</span> ${last.dnp ? '📋 DNP — ' : '⚠️ Inactive — '}${esc(last.inj)}</div>` : `<div class="last-game"><span class="muted">Last game:</span> <b class="r${last.rate}-t">${RATING[last.rate].icon} ${RATING[last.rate].k}</b> · ${fmt1(last.fp)} FP · ${last.w ? 'W' : 'L'} ${last.my}-${last.op} vs ${last.opp}</div>`) : '';
  setScreen(`<div class="wrap dashx" style="${themeVars(S.teamId)};--tb:${brightOf(team)};--tx:${textOn(brightOf(team))}">
    <div class="brandbar">${nflLogo('brand')}<span>NFL CAREER</span><i></i><span class="muted">${se.year} SEASON</span></div>
    <header class="hero"><span class="hero-num">${playerNumber()}</span>
      <div class="hero-l"><span class="egg-hit" data-act="egg">${badge(S.teamId, 'xl')}</span>
        <div><div class="eyebrow">${team.name.toUpperCase()} · ${depthText(se).toUpperCase()}</div>
          <h1 class="player-name">${esc(P.name)}</h1>
          <div class="chips">${posBadge(P.pos)}<span class="chip">#${playerNumber()}</span><span class="chip">AGE ${P.age}</span><span class="chip">${se.year} SEASON</span>${collegeChip(P.college)}<span class="chip ${P.dev === 'Normal' ? '' : 'gold'}">${P.dev === 'Normal' ? '' : '★ '}${P.dev}</span></div>
        </div></div>
      ${ovrRing(P.ovr, 'big')}
    </header>
    ${inj}${tradeBanner}${mgBannerHTML(se)}
    <div class="dash-grid">
      <div class="col">
        <section class="card">
          <div class="card-h"><h3>CURRENT SEASON</h3><span class="rec">${rec.w}–${rec.l}${se.status === 'playoffs' ? ' · PLAYOFFS' : ''}</span></div>
          <div class="tiles">${tile('GP', T.gp)}${sum.map(s => tile(s.l, s.v)).join('')}${tile('FANTASY PPG', fmt1(T.ppg), 'hl')}</div>
          <div class="fp-row"><div><span class="muted">Fantasy Total</span> <b>${fmt1(T.fp)} PTS</b></div><div class="muted small st-line">${divLine}</div><div class="muted small st-line">${dlText}</div></div>
          ${lastCard}${sparkBars(se)}${typeof ffDashLine === 'function' ? ffDashLine(se, T) : ''}
        </section>
        ${nextCard}
        <div class="actions">
          ${done ? '<button class="btn btn-primary btn-xl" data-act="seasonSummary">SEASON SUMMARY ▸</button>' : '<button class="btn btn-primary btn-xl" data-act="simNext">SIMULATE NEXT GAME</button><button class="btn btn-live btn-xl" data-act="watchLive">▶ WATCH LIVE</button><button class="btn btn-secondary" data-act="simSeason">SIMULATE SEASON</button>'}
          <button class="btn btn-ghost" data-act="viewStats">VIEW STATS</button>
          <button class="btn btn-ghost" data-act="viewStandings">STANDINGS</button>
          <button class="btn btn-ghost" data-act="viewCalendar">CALENDAR</button>
          <button class="btn btn-ghost" data-act="viewCareer">CAREER</button>
          <button class="btn btn-ghost" data-act="viewContract">CONTRACT</button>
          <button class="btn btn-ghost" data-act="viewTrades">TRADES${pend ? ' (' + pend + ')' : ''}</button>
          <button class="btn btn-ghost only-m" data-act="viewPlayer">PLAYER</button>
          <button class="btn btn-ghost" data-act="saveExit">SAVE &amp; EXIT</button>
        </div>
      </div>
      <div class="col">
        <section class="card"><div class="card-h"><h3>ATTRIBUTES</h3></div><div class="attr-list">${attrBars(P)}</div></section>
        ${depthCardHTML(se)}
        ${jerseyCardHTML()}
        <section class="card"><div class="card-h"><h3>CAREER</h3></div>
          <div class="tiles t3">${tile('SEASONS', S.seasons.length)}${tile(car[0].l.replace('Career ', '').toUpperCase(), car[0].v)}${tile(car[1].l.replace('Career ', '').toUpperCase(), car[1].v)}
          ${tile('PRO BOWLS', awardCount('PB'))}${tile('SUPER BOWLS', awardCount('SB_CHAMP'))}${tile('EARNINGS', money(S.earnings), 'gold')}</div>
          <div class="muted small">${completed} completed season${completed === 1 ? '' : 's'} · ${S.contract.yearsLeft} yr left on contract</div>
        </section>
      </div>
    </div></div>`, 'dash');
}

/* --- Game result modal ---------------------------------------------------------- */
function showGameModal(game, notes, season) {
  const cfg = cfgOf(), opp = TEAM[game.opp];
  const label = game.k === 'PO' ? ROUND_NAME[game.wk].toUpperCase() : `WEEK ${game.wk}`;
  const whenTxt = game.date && typeof calShort === 'function' ? ` · ${calShort(new Date(game.date + 'T00:00:00Z'))}` : '';
  let body;
  if (game.st === 'OUT') {
    body = game.dnp ? `<div class="banner big">📋 <b>DNP — COACH'S DECISION</b><br>You were not active this week (${depthText(season)}).</div>` : `<div class="banner warn big">⚠️ <b>INJURY — INACTIVE</b><br>${esc(game.inj)}</div>`;
  } else {
    const rt = RATING[game.rate];
    body = `<div class="perf r${game.rate}"><div class="perf-t">${rt.icon} ${rt.k} PERFORMANCE</div><div class="perf-fp">${fmt1(game.fp)} <small>Fantasy Points</small></div></div>
      <div class="mini-tiles">${cfg.cols.map(c => `<div><b>${c.g(game)}</b><span>${c.h}</span></div>`).join('')}</div>`;
    if (game.td > 0) body += `<div class="td-flash">🏈 TOUCHDOWN${game.td > 1 ? ' ×' + game.td : ''}!</div>`;
    if (game.st === 'LIMITED') body += `<div class="banner warn">Played through ${esc(game.inj.replace('Played through ', ''))} — limited snaps.</div>`;
  }
  if (game.hurt) body += `<div class="banner warn big">⚠️ <b>INJURY</b><br><span class="inj-name">${esc(game.hurt.name)}</span><br>Expected Recovery: <b>${game.hurt.weeks} week${game.hurt.weeks > 1 ? 's' : ''}</b></div>`;
  const nt = notes.map(n => `<div class="note">${n}</div>`).join('');
  const next = season.status !== 'done';
  openModal(`<div class="gm-head"><div class="eyebrow">${label}${whenTxt} · ${game.home ? 'vs' : '@'} ${opp.name}</div>
    <div class="gm-res ${game.w ? 'w' : 'l'}">${game.w ? 'W' : 'L'} ${game.my}–${game.op}</div></div>${body}${nt}
    <div class="row end"><button class="btn btn-ghost" data-act="closeModal">CLOSE</button>${offersOf(season).length && season.status === 'regular' ? '<button class="btn btn-secondary" data-act="viewTrades">TRADE CENTER</button>' : ''}${next && season.mg ? '<button class="btn btn-primary" data-act="playMini">🎮 PLAY MINI GAME ▸</button>' : next ? '<button class="btn btn-primary" data-act="simNextModal">NEXT GAME ▸</button>' : '<button class="btn btn-primary" data-act="seasonSummary">SEASON SUMMARY ▸</button>'}</div>`, 'game');
  Snd.play('whistle');
  if (notes.some(n => n.includes('TRADE OFFER'))) Snd.play('phone', 1.1);
  if (notes.some(n => n.includes('DEPTH CHART'))) Snd.play('chime', 1.0);
  if (game.st === 'OUT') Snd.play('down', 0.4);
  else {
    Snd.play(game.w ? 'win' : 'lose', 0.5);
    if (game.rate >= 5) Snd.play('cheer', 0.7);
    if (game.rate === 0) Snd.play('boo', 0.7);
    if (game.td > 0) Snd.play('td', 0.6);
  }
  if (game.hurt) Snd.play('injury', 0.9);
  if (notes.some(n => n.includes('SUPER BOWL CHAMPIONS'))) Snd.play('bigFanfare', 1.2);
  else if (notes.some(n => n.includes('PLAYOFFS CLINCHED'))) Snd.play('fanfare', 1.2);
  if (game.w) burst(modalRoot.querySelector('.modal-card'), game.td > 0 ? 56 : 44);   // a win rains confetti in your team's colors
  else if (game.td > 0 && game.st !== 'OUT') burst(modalRoot.querySelector('.modal-card'), 34);
  if (notes.some(n => n.includes('SUPER BOWL CHAMPIONS'))) burst(modalRoot.querySelector('.modal-card'), 70);
}

/* --- Stats / season viewer -------------------------------------------------------- */
let viewIdx = 0;
function detailHTML(g) {
  const cfg = cfgOf();
  if (g.st === 'OUT') return g.dnp ? `<div class="detail"><div class="banner">📋 Did not play — coach's decision${g.slot ? ' (' + slotLabel(S.player.pos, g.slot) + ')' : ''}. No stats recorded.</div></div>` : `<div class="detail"><div class="banner warn">⚠️ Injured — ${esc(g.inj)}. No stats recorded.</div></div>`;
  const kv = cfg.stats.map(x => `<div class="kv"><span>${x.label}</span><b>${fmtN(g.s[x.k])}</b></div>`).concat(cfg.extra(g.s).map(([l, v]) => `<div class="kv"><span>${l}</span><b>${v}</b></div>`)).join('');
  const rt = RATING[g.rate];
  return `<div class="detail"><div class="detail-top"><div class="perf-mini r${g.rate}">${rt.icon} ${rt.k}</div><div class="fp-big">${fmt1(g.fp)} <small>PTS</small></div>${g.tm ? `<span class="chip">with ${g.tm}</span>` : ''}${g.slot ? `<span class="chip">${slotLabel(S.player.pos, g.slot)}</span>` : ''}${g.td ? `<span class="chip gold">🏈 ${g.td} TD</span>` : ''}${g.inj ? `<span class="chip warn">${esc(g.inj)}</span>` : ''}${g.hurt ? `<span class="chip warn">Injured: ${esc(g.hurt.name)} (${g.hurt.weeks}w)</span>` : ''}</div><div class="kv-grid">${kv}</div></div>`;
}
function gameLogTable(games, T, withTotals) {
  const cfg = cfgOf();
  const head = `<tr><th>WK</th><th>OPP</th><th>RESULT</th>${cfg.cols.map(c => `<th>${c.h}</th>`).join('')}<th>FANTASY</th></tr>`;
  const rows = games.map(g => {
    const out = g.st === 'OUT';
    const cells = out ? `<td colspan="${cfg.cols.length}" class="out-cell">${g.dnp ? "📋 DNP — COACH'S DECISION" : '⚠️ INJURED — ' + esc(g.inj)}</td>` : cfg.cols.map(c => `<td>${c.g(g)}</td>`).join('');
    const fp = out ? '<td class="fp dnp">DNP</td>' : `<td class="fp r${g.rate}">${fmt1(g.fp)}</td>`;
    return `<tr class="gl-row" data-act="toggleRow"><td>${g.wk}</td><td><span class="ha">${g.home ? 'vs' : '@'}</span> ${g.opp}</td><td class="res ${g.w ? 'w' : 'l'}">${g.w ? 'W' : 'L'} ${g.my}-${g.op}</td>${cells}${fp}</tr>
      <tr class="gl-detail" hidden><td colspan="${4 + cfg.cols.length}">${detailHTML(g)}</td></tr>`;
  }).join('');
  let foot = '';
  if (withTotals && T.gp) {
    foot = `<tfoot><tr><td colspan="3">TOTAL</td>${cfg.cols.map(c => `<td>${c.t(T)}</td>`).join('')}<td class="fp">${fmt1(T.fp)}</td></tr>
      <tr><td colspan="3">PER GAME</td>${cfg.cols.map(c => `<td>${c.n ? fmt1(c.t(T) / T.gp) : ''}</td>`).join('')}<td class="fp">${fmt1(T.ppg)}</td></tr></tfoot>`;
  }
  return `<div class="table-wrap"><table class="gl"><thead>${head}</thead><tbody>${rows}</tbody>${foot}</table></div>`;
}
function renderStats(idx) {
  viewIdx = idx;
  const se = S.seasons[idx], cfg = cfgOf(), team = TEAM[se.teamId], T = seasonTotals(se), rec = recOf(se);
  const active = se.games.filter(g => g.st !== 'OUT');
  const best = active.length ? active.reduce((a, b) => (b.fp > a.fp ? b : a)) : null;
  const worst = active.length ? active.reduce((a, b) => (b.fp < a.fp ? b : a)) : null;
  const gameLine = g => g ? `<b>Wk ${g.wk} ${g.home ? 'vs' : '@'} ${g.opp}</b> · <span class="r${g.rate}-t">${fmt1(g.fp)} PTS</span> · ${RATING[g.rate].k}` : '—';
  const avgLines = cfg.line(T).filter(x => typeof x.v === 'number' && T.gp).map(x => `${fmt1(x.v / T.gp)} ${x.l}/G`).join(' · ');
  let poText = '';
  if (se.po) poText = se.po.rounds.map(r => `${r.name}: <b class="${r.res === 'WIN' ? 'good' : r.res === 'LOSS' ? 'bad' : ''}">${r.res}</b>`).join(' · ');
  const options = S.seasons.map((s, i) => `<option value="${i}" ${i === idx ? 'selected' : ''}>${s.year} — ${TEAM[s.teamId].name}</option>`).join('');
  setScreen(`<div class="wrap" style="${themeVars(se.teamId)}">
    <div class="topbar"><button class="btn btn-ghost" data-act="goHome">◂ BACK</button><select class="input sel-season" data-change="selSeason">${options}</select></div>
    <header class="season-head"><div class="eyebrow">${se.year} — REGULAR SEASON · AGE ${se.age}</div>
      <div class="sh-row">${badge(se.teamId, 'lg')}<div><h2 class="h-xl">${team.name}</h2><div class="rec-big">${rec.w}–${rec.l}${se.complete || se.status !== 'regular' ? '' : ' <small>in progress</small>'}</div>${tradeLine(se)}</div></div>
      ${poText ? `<div class="po-line">Playoffs: <b class="good">YES</b> (#${se.seed} seed) · ${poText}</div>` : (se.record ? '<div class="po-line">Playoffs: <b class="bad">NO</b></div>' : '')}
      <div class="chips">${awardChips(se.awards)}</div></header>
    <div class="tiles stat-tiles">${tile('GAMES PLAYED', T.gp)}${cfg.summary(T).map(s => tile(s.l, s.v)).join('')}${tile('FANTASY AVERAGE', fmt1(T.ppg) + ' PPG', 'hl')}${tile('FANTASY TOTAL', fmt1(T.fp) + ' PTS', 'gold')}</div>
    <div class="trio">
      <div class="card"><div class="eyebrow">SEASON AVERAGE</div><div class="trio-v">${fmt1(T.ppg)} <small>PPG</small></div><div class="muted small">${avgLines || '—'}</div></div>
      <div class="card"><div class="eyebrow">BEST GAME</div><div class="trio-t">${gameLine(best)}</div></div>
      <div class="card"><div class="eyebrow">WORST GAME</div><div class="trio-t">${gameLine(worst)}</div></div>
    </div>
    <h3 class="sec-h">${se.year} — REGULAR SEASON GAME LOG <small>(click a row to expand)</small></h3>
    ${se.games.length ? gameLogTable(se.games, T, true) : '<div class="card muted">No games played yet this season.</div>'}
    ${se.playoffGames.length ? `<h3 class="sec-h">${se.year} — PLAYOFFS</h3>${gameLogTable(se.playoffGames, T, false)}` : ''}
  </div>`);
}

/* --- Standings --------------------------------------------------------------------- */
let stIdx = 0, stConf = null, stView = 'div';
function renderStandings(idx) {
  const se = S.seasons[idx]; stIdx = idx;
  if (!stConf) stConf = TEAM[se.teamId].conf;
  const { wins, k, gp } = standingsData(se);
  const cmp = (a, b) => (wins[b] - wins[a]) || (S.teamRatings[b] - S.teamRatings[a]);
  const pct = id => (gp[id] ? (wins[id] / gp[id]).toFixed(3).replace(/^0/, '') : '.000');
  const head = first => `<thead><tr><th>${first}</th><th class="tm">TEAM</th><th>W</th><th>L</th><th>PCT</th></tr></thead>`;
  const row = (id, lead) => `<tr class="${id === se.teamId ? 'me' : ''}"><td class="rk">${lead}</td><td class="tm">${badge(id)}<span>${TEAM[id].name}</span></td><td>${wins[id]}</td><td>${gp[id] - wins[id]}</td><td>${pct(id)}</td></tr>`;
  const confTeams = TEAM_LIST.filter(t => t.conf === stConf);
  let body;
  if (stView === 'div') {
    body = `<div class="st-grid">${['East', 'North', 'South', 'West'].map(d => {
      const ids = confTeams.filter(t => t.div === d).map(t => t.id).sort(cmp);
      return `<div class="st-card"><div class="eyebrow">${stConf} ${d.toUpperCase()}</div><table class="st-table">${head('')}<tbody>${ids.map((id, i) => row(id, i === 0 && k ? '★' : '')).join('')}</tbody></table></div>`;
    }).join('')}</div>`;
  } else {
    const seeds = (se.seedIds && se.seedIds[stConf]) || confSeeds(stConf, wins, cmp);
    const rest = confTeams.map(t => t.id).filter(id => !seeds.includes(id)).sort(cmp);
    body = `<div class="st-card"><table class="st-table">${head('SEED')}<tbody>${seeds.map((id, i) => row(id, i + 1)).join('')}<tr class="cut"><td colspan="5">PLAYOFF LINE</td></tr>${rest.map(id => row(id, '')).join('')}</tbody></table></div>`;
  }
  const mine = TEAM[se.teamId], mySeed = se.seedIds ? (se.seedIds[mine.conf].indexOf(se.teamId) + 1) : 0;
  const options = S.seasons.map((x, i) => `<option value="${i}" ${i === idx ? 'selected' : ''}>${x.year} season</option>`).join('');
  setScreen(`<div class="wrap" style="${themeVars(se.teamId)}">
    <div class="topbar"><button class="btn btn-ghost" data-act="goHome">◂ BACK</button><select class="input sel-season" data-change="selStandSeason">${options}</select></div>
    <div class="eyebrow">${se.year} · ${k >= 17 ? 'FINAL STANDINGS' : k ? 'THROUGH ' + k + ' GAME' + (k > 1 ? 'S' : '') : 'PRESEASON'}</div>
    <h2 class="h-xl title-logo">${nflLogo('inline')}STANDINGS</h2>
    <div class="st-me card">${badge(se.teamId, 'lg')}<div><b>${mine.name}</b><div class="muted">${wins[se.teamId]}–${gp[se.teamId] - wins[se.teamId]} · ${divisionLine(se)}${mySeed ? ' · #' + mySeed + ' seed' : (k >= 17 ? ' · missed the playoffs' : '')}</div></div></div>
    <div class="tabs">
      <button class="tab ${stConf === 'AFC' ? 'on' : ''}" data-act="standConf" data-c="AFC">AFC</button><button class="tab ${stConf === 'NFC' ? 'on' : ''}" data-act="standConf" data-c="NFC">NFC</button>
      <span class="tab-gap"></span>
      <button class="tab ${stView === 'div' ? 'on' : ''}" data-act="standView" data-v="div">DIVISIONS</button><button class="tab ${stView === 'conf' ? 'on' : ''}" data-act="standView" data-v="conf">PLAYOFF PICTURE</button>
    </div>
    ${body}
    <div class="muted small st-note">★ division leader · seeds 1–4 are division winners, 5–7 are wild cards · league results are simulated alongside your season.</div></div>`);
}

/* --- Trade Center -------------------------------------------------------------------- */
function renderTrades() {
  const se = curSeason(), st = tradeStatus(se), offers = offersOf(se), P = S.player, c = S.contract;
  const { wins, k } = standingsData(se), left = TRADE_DEADLINE - se.games.length;
  const statusHTML = {
    open: `⏰ <b>Trade deadline: before Week ${deadlineWeek(se)}</b> — ${left} game${left === 1 ? '' : 's'} left`,
    today: '⏰ <b>TRADE DEADLINE DAY</b> — last chance to make a deal',
    used: '🔁 <b>You were already traded this season</b> — one trade per season',
    closed: '🔒 <b>The trade deadline has passed</b> — trades reopen next season',
  }[st];
  const cards = offers.map(o => {
    const t = TEAM[o.teamId];
    return `<div class="offer" style="${themeVars(o.teamId)}">
      <div class="of-head">${badge(o.teamId, 'lg')}<div><div class="of-team">${t.name}</div><span class="muted small">${t.conf} ${t.div} · ${wins[o.teamId]}–${k - wins[o.teamId]}</span></div></div>
      <div class="muted small">${esc(o.why)}</div>
      <div class="of-pkg"><span>Your current team would receive</span><b>${o.pkg}</b></div>
      <div class="of-rows"><div><span>Your role</span><b>${o.role}</b></div><div><span>Team strength</span><b>${Math.round(S.teamRatings[o.teamId])}</b></div>
        <div><span>Team interest</span><b class="interest i${o.interest}">${INTEREST[o.interest]}</b></div><div><span>Contract</span><b>${c.yearsLeft} yr · ${money(c.aav)}/yr</b></div></div>
      <div class="muted small">${o.until < TRADE_DEADLINE ? 'Offer expires after Game ' + o.until : 'Valid until the deadline'}</div>
      <div class="row"><button class="btn btn-ghost grow" data-act="tradeDecline" data-id="${o.id}">DECLINE</button><button class="btn btn-primary grow" data-act="tradeAccept" data-id="${o.id}">ACCEPT TRADE</button></div></div>`;
  }).join('');
  const reqState = { refused: 'The front office <b>refused</b> your request — they want to keep you. You can\'t ask again this season.', granted: 'The front office granted your request. Offers are listed above.', nobody: 'The front office granted your request, but <b>no team is interested</b> right now.' }[se.tradeReq];
  const canAsk = (st === 'open' || st === 'today') && !se.tradeReq;
  const hist = (S.trades || []).map(t => `<div class="hist-row">${badge(t.from)} ↔ ${badge(t.to)}<div><b>${t.year}</b> <span class="muted">· after Game ${t.after} · ${TEAM[t.from].name} → ${TEAM[t.to].name}</span></div><div class="hist-v">${t.pkg}</div></div>`).join('');
  setScreen(`<div class="wrap" style="${themeVars(S.teamId)}">
    <div class="topbar"><button class="btn btn-ghost" data-act="goHome">◂ BACK</button><span class="eyebrow">${se.year} · TRADE CENTER</span></div>
    <h2 class="h-xl">TRADE CENTER</h2>
    <div class="banner trade deadline"><span>${statusHTML}</span></div>
    <div class="st-me card">${badge(S.teamId, 'lg')}<div><b>${esc(P.name)} · ${P.pos} · OVR ${P.ovr}</b><div class="muted">${TEAM[S.teamId].name} · ${depthText(se)} · contract: ${c.yearsLeft} yr left at ${money(c.aav)}/yr (carries over in a trade)</div></div></div>
    <h3 class="sec-h">OFFERS ${offers.length ? '(' + offers.length + ')' : ''}</h3>
    ${cards ? '<div class="offers">' + cards + '</div>' : '<div class="card muted">No trade offers right now. Teams call on their own before the deadline — or you can ask the front office to shop you.</div>'}
    <h3 class="sec-h">REQUEST A TRADE</h3>
    <div class="card">${reqState ? '<div>' + reqState + '</div>' : (canAsk ? '<div class="muted">Ask the front office to shop you around. Teams that value you will make offers — but stars are harder to move, and the front office may say no. You can ask once per season.</div>' : '<div class="muted">Trade requests are only possible before the deadline.</div>')}
      ${canAsk ? '<div class="row end"><button class="btn btn-secondary" data-act="requestTrade">REQUEST A TRADE</button></div>' : ''}</div>
    ${hist ? '<h3 class="sec-h">TRADE HISTORY</h3><div class="card">' + hist + '</div>' : ''}</div>`);
}

/* --- NFL Jersey Creator (page) --------------------------------------------------------------------
   Desktop: [ PREVIEW ] [ EDITOR ].  Mobile: the preview stays pinned on top while the editor scrolls.
   Every control is bound with data-jc="<path>" (e.g. primary, parts.collar, numOutlineW): typing/dragging updates the
   jersey instantly (jcLive); releasing saves it into S.jerseys[teamId]. */
let jcView = 'front'; // FRONT / BACK
let jcTarget = 'nfl';  // which jersey the creator edits: 'nfl' (your team), 'college', 'youth'
function jcKey() { const P = S.player; if (jcTarget === 'college' && P.college) return 'c:' + P.college; if (jcTarget === 'youth' && P.youth) return 'y:' + P.youth; return S.teamId; }
function jcAlt() {
  const k = jcKey(); if (!jcIsAlt(k)) return null; const name = k.slice(2);
  if (k[0] === 'c') { const i = COLLEGE_INFO[name]; return { key: k, name, word: name.toUpperCase(), logo: i ? collegeLogo(i.id, 200) : '', kind: 'College' }; }
  const i = MFL_INFO[name]; return { key: k, name, word: name.toUpperCase(), logo: i ? mflLogo(i.slug) : '', kind: 'Youth' };
}
// options for every jersey drawn by the creator: NFL team logo + nickname, or the college / kid team's own logo + name
const jcOpts = (o = {}) => { const a = jcAlt(); return a ? { ...o, noShield: true, logoSrc: a.logo, backLogo: a.logo, word: a.word } : { ...o, word: TEAM[S.teamId].nick }; };
let jcTab = 'colors';  // editor tab
const JC_TABS = [['colors', '🎨', 'Colors'], ['style', '👕', 'Style'], ['patterns', '🔳', 'Patterns'], ['extras', '🏷', 'Sleeves & logos'], ['text', '🔤', 'Name & number']];
function renderLocker(keepScroll) {
  const ed0 = document.querySelector('.jc2-editor'), ey = ed0 ? ed0.scrollTop : 0, ay = app.scrollTop;
  const y = window.scrollY, P = S.player, id = S.teamId, t0 = TEAM[id], alt = jcAlt(), key = jcKey(), t = alt ? { name: alt.name } : TEAM[id], cfg = jerseyFor(key), C = jcColors(cfg), bg = S.jerseyBg || 'team';
  const fontOpts = cur => JC_FONTS.map(f => `<option value="${f.k}" ${f.k === cur ? 'selected' : ''}>${f.label}</option>`).join('');
  const opt = (list, cur) => list.map(f => `<option value="${f.k}" ${f.k === cur ? 'selected' : ''}>${f.label}</option>`).join('');
  const chip = (act, k, l, on) => `<button class="mini ${on ? 'on' : ''}" data-act="${act}" data-k="${k}">${l}</button>`;
  const SW = jcSwatches(key);
  const colorRow = (label, path, val, extra = '') => `<div class="jc-sw"><span class="jc-sw-l">${label}</span><div class="sw-row">${SW.map(h => `<button class="sw ${sameHex(h, val) ? 'on' : ''}" style="background:${h}" data-act="jcColor" data-path="${path}" data-c="${h}" title="${h}" aria-label="${label} ${h}"></button>`).join('')}${extra}</div></div>`;
  const range = (label, path, min, max, step, val, unit = '') => `<label class="rng"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-jc="${path}"><b data-rv="${path}">${val}${unit}</b></label>`;
  const pals = jcPalettes(key).map((p, i) => `<button class="theme" data-act="jcPalette" data-i="${i}" title="${p.label}"><span class="tri"><i style="background:${p.p}"></i><i style="background:${p.s}"></i><i style="background:${p.a}"></i></span><em>${p.label}</em></button>`).join('');
  const pats = JC_PATTERNS.map(p => `<button class="design ${patternMatches(cfg, p.k) ? 'on' : ''}" data-act="jcPattern" data-k="${p.k}" title="${p.label}">${jerseySVG(applyPattern(cfg, p.k), '', playerNumber(), jcOpts({ view: 'front', cls: 'thumb', noText: false }))}<em>${p.label}</em></button>`).join('');
  const zpRow = ([z, l]) => {
    const v = cfg.zp[z], P = JC_PATS.find(x => x.k === v.p);
    return `<div class="zp-row"><div class="zp-h"><b>${l}</b><div class="seg zp-seg"><button class="tog ${!v.p ? 'on' : ''}" data-act="jcZoneOff" data-z="${z}"><i></i>Off</button>${JC_PATS.map(p => `<button class="tog ${v.p === p.k ? 'on' : ''}" data-act="jcZonePat" data-z="${z}" data-p="${p.k}"><i></i>${p.name}</button>`).join('')}</div></div>`
      + (P ? `<div class="zp-ctl">${range('Scale', 'zp.' + z + '.s', 40, 400, 10, v.s, '%')}<div class="zp-line"><button class="btn btn-ghost btn-sm" data-act="jcZoneRot" data-z="${z}">⟳ Rotate 90° <small>${v.r}°</small></button></div>${colorRow('Color', 'zp.' + z + '.c', v.c || '#', v.c ? `<button class="mini" data-act="jcZoneAuto" data-z="${z}">Auto</button>` : '<span class="hint">auto</span>')}</div>` : '') + '</div>';
  };
  const dets = JC_DETAILS.map(([k, l]) => `<button class="tog ${cfg[k] ? 'on' : ''}" data-act="jcToggle" data-k="${k}"><i></i>${l}</button>`).join('');
  const parts = JC_PARTS.map(([k, l]) => `<div class="jc-part">${colorRow(l, 'parts.' + k, C[k], cfg.parts[k] ? `<button class="mini" data-act="jcPartAuto" data-k="${k}">Auto</button>` : '<span class="hint">auto</span>')}</div>`).join('');
  const nStr = jcSleeveCount(cfg);
  const sleeveSel = `<div class="minis big sl-sel">${[0, 1, 2, 3].map(n => chip('jcSleeve', n, n ? String(n) : 'None', nStr === n)).join('')}</div>${nStr ? `<div class="minis sl-styles">${JC_SLEEVE_STYLES.map(x => chip('jcSleeveStyle', x[0], x[1], cfg.sleeveStyle === x[0])).join('')}</div>${range('Line thickness', 'sleeveThick', 60, 200, 5, cfg.sleeveThick, '%')}${range('Position · cuff ↔ shoulder', 'sleevePos', -8, 60, 1, Math.round(cfg.sleevePos || 0))}${colorRow(cfg.sleeveStyle === 'tri' ? 'Outer lines color' : 'Line color', 'parts.decor', C.decor)}${cfg.sleeveStyle === 'tri' ? colorRow('Middle line color', 'parts.decorMid', C.decorMid) : ''}` : ''}`;
  const shoulderSel = `<div class="minis big sl-sel">${[0, 1, 2, 3].map(n => chip('jcShoulder', n, n ? String(n) : 'None', (cfg.shCount || 0) === n)).join('')}</div>${cfg.shCount ? `<div class="minis sl-styles">${JC_SLEEVE_STYLES.map(x => chip('jcShStyle', x[0], x[1], cfg.shStyle === x[0])).join('')}</div>${range('Line thickness', 'shThick', 60, 200, 5, cfg.shThick, '%')}${range('Position · outside ↔ neck', 'shPos', -8, 72, 1, Math.round(cfg.shPos || 0))}${range('Rotate · in ↔ out', 'shAngle', -45, 45, 1, Math.round(cfg.shAngle || 0), '°')}${colorRow(cfg.shStyle === 'tri' ? 'Outer lines color' : 'Line color', 'parts.shStripe', C.shStripe)}${cfg.shStyle === 'tri' ? colorRow('Middle line color', 'parts.shStripeMid', C.shStripeMid) : ''}` : ''}`;
  setScreen(`<div class="wrap jc-wrap" style="${themeVars(id)}">
    <div class="topbar"><button class="btn btn-ghost" data-act="goHome">◂ BACK</button><span class="eyebrow">JERSEY CREATOR</span></div>
    <h2 class="h-xl title-logo">${badge(id, 'lg')}<span>NFL JERSEY CREATOR</span></h2>
    <div class="jc2">
      <section class="jc2-preview">
        ${P.college || P.youth ? `<div class="jc-target"><span>JERSEY</span>${[['nfl', '🏈 ' + t0.nick], P.college ? ['college', '🎓 ' + P.college] : null, P.youth ? ['youth', '🧒 ' + P.youth] : null].filter(Boolean).map(([k, l]) => chip('jcTarget', k, esc(l), (alt ? jcTarget : 'nfl') === k)).join('')}</div>` : ''}
        <div class="jc2-bar">
          <div class="minis big">${chip('jcView', 'front', 'FRONT', jcView === 'front')}${chip('jcView', 'back', 'BACK', jcView === 'back')}</div>
          <div class="minis">${chip('jerseyBg', 'team', 'Team', bg === 'team')}${chip('jerseyBg', 'dark', 'Dark', bg === 'dark')}${chip('jerseyBg', 'light', 'Light', bg === 'light')}</div>
          <button class="mini solo" data-act="jerseyExpand">⛶ Expand</button>
        </div>
        ${frameHTML({ view: jcView, useAlt: true })}
      </section>
      <section class="card jc2-editor">
        <div class="jc-actions">
          <button class="btn btn-primary btn-sm" data-act="jcRandom">🎲 RANDOMIZE</button>
          <button class="btn btn-ghost btn-sm" data-act="jcReset">↺ RESET DESIGN</button>
          <button class="btn btn-secondary btn-sm" data-act="jcExport">⬇ DOWNLOAD PNG</button>
        </div>
        <nav class="jc-tabs" role="tablist">${JC_TABS.map(([k, ic, l]) => `<button class="jc-tab ${jcTab === k ? 'on' : ''}" data-act="jcTab" data-k="${k}" role="tab"><span>${ic}</span>${l}</button>`).join('')}</nav>
        <div class="jc-pane">
        ${jcTab === 'colors' ? `
<section class="jc-card"><h4 class="jc-h">🎨 Team colors<small>primary · secondary · accent</small></h4>
        <div class="jc-colors stack">${colorRow('Primary', 'primary', cfg.primary)}${colorRow('Secondary', 'secondary', cfg.secondary)}${colorRow('Accent', 'accent', cfg.accent)}</div>
</section>
<section class="jc-card"><h4 class="jc-h">✨ Color presets<small>${t.name} colors</small></h4>
        <div class="themes pals">${pals}</div>
</section>
<section class="jc-card"><h4 class="jc-h">🧩 Color each part<small>give any part its own color</small></h4>
        <div class="jc-parts">${parts}</div>
</section>
        ` : ''}
        ${jcTab === 'style' ? `
<section class="jc-card"><h4 class="jc-h">👕 Design</h4>
        <div class="designs jc-pats">${pats}</div>
</section>
<section class="jc-card"><h4 class="jc-h">🛠 Details<small>combine them freely</small></h4>
        <div class="seg">${dets}</div>
</section>
        ` : ''}
        ${jcTab === 'patterns' ? `
<section class="jc-card"><h4 class="jc-h">🔳 Patterns by zone</h4>
<p class="jc-note">Put a pattern on just one part of the jersey. Each zone has its own scale, a 90° turn and its own color.</p>
        ${ZP_ZONES.map(zpRow).join('')}
</section>
        ` : ''}
        ${jcTab === 'extras' ? `
<section class="jc-card"><h4 class="jc-h">〰️ Sleeve lines</h4>
        ${sleeveSel}
</section>
<section class="jc-card"><h4 class="jc-h">▮ Shoulder lines<small>vertical lines pushed to the outside of the shoulders</small></h4>
        ${shoulderSel}
</section>
<section class="jc-card"><h4 class="jc-h">🏷 Jock tag<small>front, lower left · drag it or use the sliders</small></h4>
        <div class="seg"><button class="tog ${cfg.jockTag ? 'on' : ''}" data-act="jcJock"><i></i>Jock tag</button>${cfg.jockTag ? '<button class="mini" data-act="jcJockReset">Reset position</button>' : ''}</div>
        ${cfg.jockTag ? range('Size', 'jockSize', 40, 240, 5, cfg.jockSize, '%') + range('Move left ↔ right', 'jockX', 10, 290, 1, Math.round(cfg.jockX)) + range('Move up ↕ down', 'jockY', 200, 340, 1, Math.round(cfg.jockY)) + (jcView === 'back' ? '<div class="muted small">Switch to FRONT to see and move it.</div>' : '') : ''}
</section>
<section class="jc-card"><h4 class="jc-h">✔ Nike swoosh<small>on both sleeves</small></h4>
        <div class="seg"><button class="tog ${cfg.swoosh ? 'on' : ''}" data-act="jcSwoosh"><i></i>Nike swoosh</button></div>
        ${cfg.swoosh ? colorRow('Swoosh color', 'parts.swoosh', C.swoosh, cfg.parts.swoosh ? '<button class="mini" data-act="jcPartAuto" data-k="swoosh">Auto</button>' : '<span class="hint">auto</span>') : ''}
</section>
<section class="jc-card"><h4 class="jc-h">🏷 Team logo on the sleeves<small>right as is, left mirrored</small></h4>
        <div class="seg"><button class="tog ${cfg.sleeveLogo ? 'on' : ''}" data-act="jcSleeveLogo"><i></i>Logo on sleeves</button></div>
        ${cfg.sleeveLogo ? range('Sleeve logo size', 'sleeveLogoSize', 40, 160, 5, cfg.sleeveLogoSize, '%') + range('Rotate · in ↔ out', 'sleeveLogoRot', -45, 45, 1, Math.round(cfg.sleeveLogoRot || 0), '°') + range('Spread · in ↔ out', 'sleeveLogoSpread', -24, 24, 1, Math.round(cfg.sleeveLogoSpread || 0)) + range('Height · up ↔ down', 'sleeveLogoY', -30, 40, 1, Math.round(cfg.sleeveLogoY || 0)) + `<div class="seg"><button class="tog ${cfg.sleeveLogoFlipR ? 'on' : ''}" data-act="jcSleeveFlip" data-s="R"><i></i>Flip right sleeve</button><button class="tog ${cfg.sleeveLogoFlipL ? 'on' : ''}" data-act="jcSleeveFlip" data-s="L"><i></i>Flip left sleeve</button></div>` : ''}
</section>
<section class="jc-card"><h4 class="jc-h">🏈 Team logo on the chest<small>drag it on the jersey, or use the sliders</small></h4>
        <div class="seg"><button class="tog ${cfg.torsoLogo ? 'on' : ''}" data-act="jcTorsoLogo"><i></i>Logo on chest</button>${cfg.torsoLogo ? '<button class="mini" data-act="jcLogoCenter">Reset position</button>' : ''}</div>
        ${cfg.torsoLogo ? range('Logo size', 'logoSize', 40, 220, 5, cfg.logoSize, '%') + range('Move left ↔ right', 'logoX', 8, 292, 2, Math.round(cfg.logoX)) + range('Move up ↕ down', 'logoY', 8, 337, 2, Math.round(cfg.logoY)) + (jcView === 'back' ? '<div class="muted small">Switch to FRONT to see and move the logo.</div>' : '') : ''}
</section>
        ` : ''}
        ${jcTab === 'text' ? `
<section class="jc-card"><h4 class="jc-h">🔤 Name on the jersey</h4>
        <div class="seg"><button class="tog ${cfg.showWord ? 'on' : ''}" data-act="jcWord"><i></i>Team name on the front</button></div>
        <div class="lk-num"><input class="input" maxlength="12" value="${esc(jName(P))}" data-change="jerseyName" aria-label="Player name on the jersey" placeholder="NAME ON JERSEY"></div>
        <div class="jc-grid2"><label class="jc-sel"><span>Font</span><select class="input" data-jc="nameFont">${fontOpts(cfg.nameFont)}</select></label>${range('Size', 'nameSize', 50, 150, 5, cfg.nameSize, '%')}</div>
        <div class="jc-colors stack">${colorRow('Name color', 'nameColor', cfg.nameColor)}${colorRow('Name outline', 'nameOutline', cfg.nameOutline)}</div>
        ${range('Outline width', 'nameOutlineW', 0, 5, 0.5, cfg.nameOutlineW)}
        ${range('Move up ↕ down', 'nameY', -30, 40, 1, Math.round(cfg.nameY || 0))}
        <div class="seg"><button class="tog ${cfg.nameBox ? 'on' : ''}" data-act="jcNameBox"><i></i>Name plate (rectangle)</button></div>
        ${cfg.nameBox ? colorRow('Plate color', 'nameBoxFill', cfg.nameBoxFill || '#000000', cfg.nameBoxFill ? '<button class="mini" data-act="jcNameBoxAuto">Auto</button>' : '<span class="hint">auto</span>') : ''}
</section>
<section class="jc-card"><h4 class="jc-h">🔢 Number</h4>
        <div class="lk-num"><input class="input" type="number" min="0" max="99" value="${playerNumber()}" data-change="jerseyNumber" aria-label="Jersey number" style="max-width:110px"><button class="btn btn-ghost btn-sm" data-act="randNumber2">RANDOM #</button><span class="hint" id="numHint2">${P.pos} numbers: ${numberRule(P.pos)}</span></div>
        <div class="jc-grid2"><label class="jc-sel"><span>Font</span><select class="input" data-jc="numFont">${fontOpts(cfg.numFont)}</select></label>${range('Size', 'numSize', 50, 150, 5, cfg.numSize, '%')}</div>
        ${range(jcView === 'back' ? 'Position · BACK' : 'Position · FRONT', jcView === 'back' ? 'numY' : 'numYFront', -60, 70, 2, jcView === 'back' ? cfg.numY : cfg.numYFront)}<div class="muted small">Front and back have their own height — switch FRONT / BACK above to set each one.</div>
        <div class="jc-colors stack">${colorRow('Number color', 'numColor', cfg.numColor)}${colorRow('Number outline', 'numOutline', cfg.numOutline)}</div>
        ${range('Outline width', 'numOutlineW', 0, 8, 0.5, cfg.numOutlineW)}
</section>
<section class="jc-card"><h4 class="jc-h">↕ Shoulder / sleeve numbers<small>show, move down to the sleeves, or remove</small></h4>
        <div class="minis big">${chip('jcNumPos', 'shoulder', 'SHOULDERS', !cfg.sleeveNums && !cfg.noSideNums)}${chip('jcNumPos', 'sleeve', 'SLEEVES', cfg.sleeveNums)}${chip('jcNumPos', 'none', 'NONE', cfg.noSideNums)}</div>${cfg.noSideNums ? '' : `<div class="jc-colors stack">${colorRow('Side number color', 'sideNumColor', cfg.sideNumColor || cfg.numColor, `${cfg.sideNumColor ? '<button class="mini" data-act="jcSideAuto" data-k="sideNumColor">Same as main</button>' : '<span class="hint">same as main</span>'}`)}${colorRow('Side number outline', 'sideNumOutline', cfg.sideNumOutline || cfg.numOutline, `${cfg.sideNumOutline ? '<button class="mini" data-act="jcSideAuto" data-k="sideNumOutline">Same as main</button>' : '<span class="hint">same as main</span>'}`)}</div>`}${cfg.sleeveNums ? `<div class="muted small">Drag a sleeve number up or down on the jersey.${(cfg.sleeveNumY || 0) ? ' <button class="mini" data-act="jcNumReset">Reset height</button>' : ''}</div>` : ''}
</section>
        <div class="muted small lk-note">The jersey name is separate from your player name (<b>${esc(P.name)}</b>). Each team keeps its own design; when you change teams you get a fresh home jersey.</div>
        ` : ''}
        </div>
      </section>
    </div></div>`);
  if (keepScroll) {
    const restore = () => { const ed = document.querySelector('.jc2-editor'); [document.documentElement, app, ed].forEach(e => { if (e) e.style.scrollBehavior = 'auto'; }); window.scrollTo(0, y); app.scrollTop = ay; if (ed) ed.scrollTop = ey; };
    restore(); requestAnimationFrame(restore);   // again after layout settles (images/fonts), never animated
  }
}
/* --- Career + timeline --------------------------------------------------------------- */
function achievementLines() {
  const lines = [];
  ['SB_CHAMP', 'SB_MVP', 'MVP', 'OPOY', 'DPOY', 'ROY', 'CPOY', 'AP1', 'AP2', 'PB', 'LEADER'].forEach(id => {
    const n = awardCount(id); if (!n) return;
    const m = AWARD_META[id]; lines.push({ n, icon: m.icon, text: `${n > 1 ? n + '× ' : ''}${m.label}${id === 'LEADER' ? (n > 1 ? 's' : '') : ''}` });
  });
  return lines;
}
function renderCareer() {
  const P = S.player, cfg = cfgOf(), C = careerTotals(), d = S.draft;
  const rows = S.seasons.map((se, i) => {
    const t = seasonTotals(se), rec = se.complete || se.games.length ? recOf(se) : { w: 0, l: 0 };
    return `<button class="tl-row" data-act="viewSeason" data-i="${i}" style="${themeVars(se.teamId)}">
      <div class="tl-year">${se.year}</div>${badge(se.teamId)}
      <div class="tl-main"><b>${TEAM[se.teamId].name}</b><span class="muted">Age ${se.age} · ${rec.w}–${rec.l}${se.stints ? ' · ↔ from ' + se.stints[0].teamId : ''}${se.po ? (se.po.champion ? ' · 🏆 Champions' : ' · Playoffs') : ''}${se.complete ? '' : ' · in progress'}</span>
        <span class="tl-line">${cfg.line(t).map(x => `${fmtN(x.v)} ${x.l}`).join(' · ')} · <b>${fmt1(t.ppg)} PPG</b></span></div>
      <div class="tl-aw">${(se.awards || []).slice(0, 5).map(a => a.icon).join(' ')}</div></button>`;
  }).join('');
  const ach = achievementLines();
  // the seasons before the NFL: your kids team (MFL) and your college / league team
  const preRow = (yr, logo, name, sub, rec, line, icon, col) => `<div class="tl-row pre" style="--t1:${col || '#2b3a55'};--ta:${col || '#2b3a55'}"><div class="tl-year">${yr}</div><span class="tl-pl">${logo}</span>
      <div class="tl-main"><b>${esc(name)}</b><span class="muted">${sub} · ${rec}</span><span class="tl-line">${line}</span></div><div class="tl-aw">${icon || ''}</div></div>`;
  const lineOf = r => `${(r.line || []).map(x => `${fmtN(x.v)} ${x.l}`).join(' · ')}${r.ppg != null ? ` · <b>${fmt1(r.ppg)} PPG</b>` : ''} · OVR ${r.ovrFrom} → ${r.ovrTo}`;
  const yr0 = d.year - (S.college ? 1 : 0) - (P.youthRec ? 1 : 0);
  const pre = (P.youthRec && MFL_INFO[P.youthRec.team] ? preRow(yr0, `<img src="${mflLogo(MFL_INFO[P.youthRec.team].slug)}" alt="">`, P.youthRec.team, (youthLg(P.youthRec.team) === 'HS' ? 'High School' : 'Youth · MFL'), `${P.youthRec.w}–${P.youthRec.l}`, lineOf(P.youthRec), P.youthRec.icon, MFL_INFO[P.youthRec.team].c1) : '')
    + (S.college ? preRow(d.year - 1, COLLEGE_INFO[S.college.school] ? `<img src="${collegeLogo(COLLEGE_INFO[S.college.school].id, 80)}" alt="" onerror="this.style.visibility='hidden'">` : '', S.college.school, S.college.line ? 'College' : 'Before the draft', `${S.college.w}–${S.college.l}`, S.college.line ? lineOf(S.college) : `OVR ${S.college.ovrFrom} → ${S.college.ovrTo} · ${esc(S.college.grade || '')}`, S.college.icon, COLLEGE_INFO[S.college.school] && COLLEGE_INFO[S.college.school].c1) : '');
  setScreen(`<div class="wrap">
    <div class="topbar"><button class="btn btn-ghost" data-act="goHome">◂ BACK</button><span class="eyebrow">CAREER TIMELINE</span></div>
    <header class="season-head"><h2 class="h-xl">${esc(P.name)}</h2><div class="chips">${posBadge(P.pos)}${collegeChip(P.college)}<span class="chip">AGE ${P.age}</span><span class="chip">OVR ${P.ovr}</span></div></header>
    <div class="tiles auto">${tile('GAMES', fmt(C.gp))}${cfg.career(C).map(s => tile(s.l.toUpperCase(), s.v)).join('')}${tile('FANTASY CAREER', fmt1(C.fp) + ' PTS', 'hl')}${tile('EARNINGS', money(S.earnings), 'gold')}</div>
    <div class="card"><div class="card-h"><h3>ACHIEVEMENTS</h3></div>${ach.length ? ach.map(a => `<div class="ach">${a.icon} ${a.text}</div>`).join('') : '<div class="muted">No awards yet — keep grinding.</div>'}</div>
    <h3 class="sec-h">TIMELINE <small>(click a season to open its stats)</small></h3>
    <div class="timeline">${pre}
      <div class="tl-draft"><span>${d.year}</span> ${d.undrafted ? 'Signed as an undrafted free agent' : `Drafted — Round ${d.round}, Pick #${d.pick} (Overall #${d.overall})`} by ${TEAM[d.teamId].name}</div>${rows}</div>
    <div class="row end"><button class="btn btn-danger-ghost" data-act="retireAsk">RETIRE FROM THE NFL</button></div></div>`);
}

/* --- Contract ------------------------------------------------------------------------- */
function renderContract() {
  const c = S.contract, P = S.player, se = curSeason();
  const played = Math.min(c.years, c.years - c.yearsLeft + (se.complete ? 0 : 1));
  const pct = Math.round(100 * played / c.years);
  const hist = S.contracts.map(k => `<div class="hist-row">${badge(k.teamId)}<div><b>${TEAM[k.teamId].name}</b><span class="muted"> · ${k.type} · from ${k.startYear}</span></div><div class="hist-v">${k.years} yrs · ${money(k.total)} · ${money(k.guaranteed)} gtd</div></div>`).join('');
  setScreen(`<div class="wrap narrow" style="${themeVars(S.teamId)}">
    <div class="topbar"><button class="btn btn-ghost" data-act="goHome">◂ BACK</button><span class="eyebrow">CONTRACT</span></div>
    <section class="card contract-card"><div class="eyebrow">CURRENT CONTRACT · ${c.type.toUpperCase()}</div>
      <div class="cc-top">${badge(S.teamId, 'lg')}<div><div class="cc-big">${c.years} years / ${money(c.total)}</div><div class="muted">${TEAM[S.teamId].name} · ${depthText(se)}</div></div></div>
      <div class="bar gold"><i style="--w:${pct}%"></i></div><div class="muted small">Year ${played} of ${c.years} · ${c.yearsLeft} remaining</div>
      <div class="tiles t3">${tile('GUARANTEED', money(c.guaranteed))}${tile('PER YEAR', money(c.aav))}${tile('CAREER EARNINGS', money(S.earnings), 'gold')}</div></section>
    <div class="card"><div class="card-h"><h3>MARKET WATCH</h3></div><div class="muted">Estimated market value for ${esc(P.name)} (OVR ${P.ovr}, age ${P.age}): <b class="gold-t">${money(marketAAV())} per year</b>.</div></div>
    <div class="card"><div class="card-h"><h3>CONTRACT HISTORY</h3></div>${hist}</div></div>`);
}

/* --- Season summary ----------------------------------------------------------------------- */
function renderSummary() {
  const se = curSeason(), P = S.player, cfg = cfgOf(), T = seasonTotals(se), rec = se.record, c = S.contract;
  let poHTML = '';
  if (se.po) {
    poHTML = `<div class="po-box ${se.po.champion ? 'champ' : ''}">${se.po.champion ? '<div class="champ-t">🏆 SUPER BOWL CHAMPIONS 🏆</div>' : '<div class="eyebrow">POSTSEASON</div>'}
      ${se.po.rounds.map(r => `<div class="po-r"><span>${r.name}</span><b class="${r.res === 'LOSS' ? 'bad' : 'good'}">${r.res}${r.opp ? ` vs ${r.opp} ${r.score}` : ''}</b></div>`).join('')}</div>`;
  } else poHTML = '<div class="po-box"><div class="eyebrow">POSTSEASON</div><div class="muted">Playoffs: NO</div></div>';
  const divTeams = TEAM_LIST.filter(t => t.conf === TEAM[se.teamId].conf && t.div === TEAM[se.teamId].div).sort((a, b) => se.wins[b.id] - se.wins[a.id]);
  const standings = divTeams.map(t => `<div class="st-row ${t.id === se.teamId ? 'me' : ''}">${badge(t.id)}<span>${t.name}</span><b>${se.wins[t.id]}–${17 - se.wins[t.id]}</b></div>`).join('');
  const expiring = c.yearsLeft <= 0;
  setScreen(`<div class="wrap narrow summary" style="${themeVars(se.teamId)}">
    <div class="eyebrow">SEASON COMPLETE</div><h2 class="h-xxl">${se.year} SEASON COMPLETE</h2>
    <div class="sum-team">${badge(se.teamId, 'xl')}<div><div class="sum-name">${TEAM[se.teamId].name}</div><div class="rec-big">${rec.w}–${rec.l}</div>
      <div class="muted">${se.divRank === 1 ? 'Division champions · ' : ''}${se.seed ? '#' + se.seed + ' seed' : 'Missed the playoffs'}</div>${tradeLine(se)}</div></div>
    <section class="card"><div class="eyebrow">YOUR SEASON</div>
      <div class="big-line">${cfg.line(T).map(x => `<div><b>${fmtN(x.v)}</b><span>${x.l}</span></div>`).join('')}</div>
      <div class="ppg-big">${fmt1(T.ppg)} <small>PPR PPG</small></div>
      <div class="muted center">${T.gp} games played · ${fmt1(T.fp)} fantasy points${se.missed ? ` · missed ${se.missed} game${se.missed > 1 ? 's' : ''} (injury)` : ''}</div>
      ${se.careerBest ? '<div class="career-best">🔥 Career Best</div>' : ''}</section>
    ${typeof ffSummaryHTML === 'function' ? ffSummaryHTML(se, T) : ''}
    <section class="card"><div class="eyebrow">AWARDS</div><div class="award-list">${se.awards.length ? se.awards.map((a, i) => `<div class="award big" style="animation-delay:${0.25 + i * 0.22}s">${a.icon} ${esc(a.label)}</div>`).join('') : '<div class="muted">No awards this season.</div>'}</div></section>
    <div class="two">${poHTML}<div class="po-box"><div class="eyebrow">${TEAM[se.teamId].conf} ${TEAM[se.teamId].div} STANDINGS</div>${standings}</div></div>
    <section class="card next-card"><div class="eyebrow">NEXT SEASON</div>
      ${expiring ? '<div class="nc-big">Your contract expires.</div><div class="muted">Free Agency awaits…</div>' : `<div class="nc-big">Year ${c.years - c.yearsLeft + 1} of ${c.years} on your ${money(c.total)} contract</div><div class="muted">${money(c.aav)} per year · ${TEAM[S.teamId].name}</div>`}</section>
    <div class="row between"><div class="row"><button class="btn btn-ghost" data-act="viewStats">VIEW GAME LOG</button><button class="btn btn-ghost" data-act="viewStandings">STANDINGS</button></div><button class="btn btn-primary btn-xl" data-act="toDevelopment">CONTINUE</button></div></div>`);
  Snd.play(se.po && se.po.champion ? 'bigFanfare' : 'seasonEnd', 0.2);
  se.awards.forEach((a, i) => Snd.play('chime', 0.8 + i * 0.28, [783.99, 880, 1046.5, 1174.66, 1318.5][i % 5]));
  const w = app.querySelector('.summary');
  if (se.po && se.po.champion) setTimeout(() => burst(w, 80), 400);
  else if (se.awards.length) setTimeout(() => burst(w, 36), 600);
}

/* --- Development ------------------------------------------------------------------------------ */
function renderDevelopment() {
  const se = curSeason(), dv = se.dev, P = S.player;
  const up = dv.ovrTo > dv.ovrFrom, down = dv.ovrTo < dv.ovrFrom;
  const pj = projSlot(S.teamId, P.ovr, S.contract.bias, P.pos), curSl = se.depth ? se.depth.slot : pj;
  setScreen(`<div class="wrap narrow">
    <div class="eyebrow">OFFSEASON</div><h2 class="h-xxl">PLAYER DEVELOPMENT</h2>
    <section class="card dev-card">
      <div class="ovr-change"><div class="oc-from">OVR <b>${dv.ovrFrom}</b></div><div class="oc-arrow ${up ? 'up' : down ? 'down' : ''}">→</div>
        <div class="oc-to ${up ? 'up' : down ? 'down' : ''}"><b id="ovrNum">${dv.ovrFrom}</b><span>${up ? '▲' : down ? '▼' : '●'}</span></div></div>
      <div class="dev-list">${dv.changes.map((c, i) => `<div class="dev-row" style="animation-delay:${0.1 + i * 0.12}s"><span>${c.attr}</span><b class="${c.d > 0 ? 'good' : c.d < 0 ? 'bad' : 'muted'}">${c.d > 0 ? '+' : ''}${c.d}</b>
        <div class="bar ${barClass(c.to)}"><i style="--w:${c.to}%"></i></div><em>${c.to}</em></div>`).join('')}</div>
      ${dv.why ? `<div class="dev-why"><span>WHY</span>${[['AGE', dv.why.age], ['PRESEASON CAMP', dv.why.camp || 0], ['YOUR SEASON', dv.why.season], ['TRAINING', dv.why.training], ['INJURY', dv.why.injury]].filter(([, v]) => v !== 0).map(([l, v]) => `<em class="${v > 0 ? 'good' : 'bad'}">${l} ${v > 0 ? '+' : ''}${v.toFixed(1)}</em>`).join('')}</div>` : ''}
      <div class="muted small center">Age ${se.age} · ${P.dev} development${dv.injured ? ' · a serious injury cost you some athleticism' : ''}${dv.smoothed ? ' · your overall changes are kept within a believable range' : ''}</div>
      ${pj !== curSl ? `<div class="banner ${pj < curSl ? 'good' : 'warn'}">Depth chart outlook: ${slotLabel(P.pos, curSl)} → <b>${slotLabel(P.pos, pj)}</b> (projected)</div>` : ''}
    </section>
    <div class="row end"><button class="btn btn-primary btn-xl" data-act="afterDev">CONTINUE</button></div></div>`);
  Snd.play(up ? 'up' : down ? 'down' : 'tick', 0.4);
  setTimeout(() => { const el = document.getElementById('ovrNum'); if (el) countUp(el, dv.ovrFrom, dv.ovrTo); if (up && el) burst(el.closest('.dev-card'), 26); }, 350);
}

/* --- Free agency ---------------------------------------------------------------------------------- */
function renderFA() {
  const P = S.player, c = S.contract, offers = S.fa.offers;
  const last = offers.length === 1 && offers[0].last;
  setScreen(`<div class="wrap">
    <div class="eyebrow">${S.year + 1} OFFSEASON</div><h2 class="h-xxl">FREE AGENCY</h2>
    <div class="card fa-top" style="${themeVars(S.teamId)}"><div><div class="eyebrow">YOUR CURRENT TEAM</div><div class="fa-team">${badge(S.teamId, 'lg')}<b>${TEAM[S.teamId].name}</b></div></div>
      <div><div class="eyebrow">CURRENT CONTRACT (EXPIRED)</div><div class="fa-c">${c.years} Years — ${money(c.total)}</div></div>
      <div><div class="eyebrow">PLAYER</div><div class="fa-c">${esc(P.name)} · ${P.pos} · OVR ${P.ovr} · Age ${P.age + 1}</div></div></div>
    ${last ? '<div class="banner warn">The market has dried up. This is the only offer left on the table.</div>' : ''}
    <div class="offers">${offers.map(o => { const t = TEAM[o.teamId]; return `<div class="offer ${o.isCur ? 'cur' : ''}" style="${themeVars(o.teamId)}">
      <div class="of-head">${badge(o.teamId, 'lg')}<div><div class="of-team">${t.name}</div>${o.isCur ? '<span class="chip gold">RE-SIGN · YOUR TEAM</span>' : `<span class="muted small">${t.conf} ${t.div}</span>`}</div></div>
      <div class="of-main"><b>${o.years} Year${o.years > 1 ? 's' : ''}</b><b class="of-money">${money(o.total)}</b></div>
      <div class="of-rows"><div><span>Guaranteed</span><b>${money(o.guaranteed)}</b></div><div><span>Per year</span><b>${money(o.total / o.years)}</b></div><div><span>Role</span><b>${o.role}</b></div>
        <div><span>Team interest</span><b class="interest i${o.interest}">${INTEREST[o.interest]}</b></div></div>
      <div class="row"><button class="btn btn-ghost grow" data-act="faDecline" data-id="${o.id}">DECLINE</button><button class="btn btn-primary grow" data-act="faAccept" data-id="${o.id}">${o.isCur ? 'STAY — ACCEPT' : 'ACCEPT'}</button></div></div>`; }).join('')}</div>
    <div class="row end"><button class="btn btn-danger-ghost" data-act="retireAsk">RETIRE INSTEAD</button></div></div>`);
}

/* --- Career complete ------------------------------------------------------------------------------ */
function legacyScore() {
  return awardCount('SB_CHAMP') * 6 + awardCount('SB_MVP') * 5 + awardCount('MVP') * 10 + awardCount('AP1') * 4 + awardCount('AP2') * 1.5 + awardCount('PB') * 1.5
    + (awardCount('OPOY') + awardCount('DPOY')) * 5 + awardCount('ROY') * 2 + awardCount('LEADER') * 1.5 + S.seasons.length * 0.3;
}
function renderCareerComplete() {
  const P = S.player, cfg = cfgOf(), C = careerTotals(), seasons = S.seasons.filter(s => s.games.length);
  const best = seasons.length ? seasons.reduce((a, b) => (seasonTotals(b).fp > seasonTotals(a).fp ? b : a)) : null;
  const bT = best ? seasonTotals(best) : null;
  const score = legacyScore();
  const tier = score >= 80 ? 'G.O.A.T.' : score >= 45 ? 'HALL OF FAME' : score >= 28 ? 'STAR' : score >= 12 ? 'SOLID STARTER' : 'JOURNEYMAN';
  const ach = achievementLines();
  const teams = [...new Set(S.seasons.flatMap(s => (s.stints || []).map(x => x.teamId).concat(s.teamId)))];
  setScreen(`<div class="wrap narrow complete">
    ${nflLogo('draft')}<div class="eyebrow">RETIREMENT</div>
    <h1 class="h-mega">CAREER COMPLETE</h1>
    <div class="cc-name">${esc(P.name)}</div>
    <div class="cc-sub">${P.pos} — ${seasons.length} Season${seasons.length === 1 ? '' : 's'} · ${esc(P.college)}${P.youth ? ' · started at ' + esc(P.youth) + ' (' + (youthLg(P.youth) === 'HS' ? 'High School' : 'MFL') + ')' : ''}</div>
    <div class="legacy ${score >= 45 ? 'hof' : ''}"><span>${score >= 45 ? '🏛️' : '🎽'}</span> ${tier}<small>Legacy score ${Math.round(score)}</small></div>
    <section class="frame-wrap">${frameHTML({ gold: score >= 45, final: true })}</section>
    <section class="card"><div class="eyebrow">CAREER STATS</div><div class="big-line">${cfg.careerLines(C).map(x => `<div><b>${fmtN(x.v)}</b><span>${x.l}</span></div>`).join('')}</div></section>
    <section class="card"><div class="eyebrow">ACHIEVEMENTS</div>${ach.length ? ach.map((a, i) => `<div class="ach big" style="animation-delay:${i * 0.12}s">${a.icon} ${a.text}</div>`).join('') : '<div class="muted">A quiet career — but you made it to the NFL.</div>'}</section>
    <div class="two"><section class="card"><div class="eyebrow">CAREER EARNINGS</div><div class="gold-big">${money(S.earnings)}</div></section>
      <section class="card"><div class="eyebrow">FANTASY CAREER</div><div class="gold-big cyan">${fmt1(C.fp)} <small>PPR PTS</small></div><div class="muted small">${fmt1(C.ppg)} PPG over ${C.gp} games</div></section></div>
    ${best ? `<section class="card"><div class="eyebrow">BEST SEASON · ${best.year} (${TEAM[best.teamId].name})</div><div class="big-line">${cfg.line(bT).map(x => `<div><b>${fmtN(x.v)}</b><span>${x.l}</span></div>`).join('')}<div><b>${fmt1(bT.ppg)}</b><span>PPG</span></div></div></section>` : ''}
    <section class="card"><div class="eyebrow">YOUR JERSEYS</div><div class="cc-jerseys">${teams.map((id, i) => {
      const yrs = S.seasons.filter(se => se.teamId === id || (se.stints || []).some(x => x.teamId === id)).map(se => se.year), y0 = Math.min(...yrs), y1 = Math.max(...yrs);
      return `<div class="cc-jersey" style="${themeVars(id)}"><div class="cc-jh">${badge(id)}<div><b>${TEAM[id].name}</b><span>${y0 === y1 ? y0 : y0 + '–' + y1}${i === teams.length - 1 ? ' · FINAL TEAM' : ''}</span></div></div>
        ${jerseySVG(jerseyFor(id), jName(P), playerNumber(), { view: 'both', teamId: id, word: TEAM[id].nick })}</div>`;
    }).join('')}${[P.college ? `<div class="cc-jersey"><div class="cc-jh"><img class="col-logo" src="${COLLEGE_INFO[P.college] ? collegeLogo(COLLEGE_INFO[P.college].id, 80) : ''}" alt=""><div><b>${esc(P.college)}</b><span>COLLEGE</span></div></div>${jerseySVG(collegeJersey(P.college), jName(P), playerNumber(), { view: 'both', noShield: true, word: P.college.toUpperCase(), backLogo: COLLEGE_INFO[P.college] ? collegeLogo(COLLEGE_INFO[P.college].id, 80) : '' })}</div>` : '', P.youth && MFL_INFO[P.youth] ? `<div class="cc-jersey"><div class="cc-jh"><img class="col-logo" src="${mflLogo(MFL_INFO[P.youth].slug)}" alt=""><div><b>${esc(P.youth)}</b><span>FIRST TEAM · MFL</span></div></div>${youthJerseySVG(P.youth, 'both', playerNumber(), jName(P))}</div>` : ''].join('')}</div><div class="muted small">The last design you saved for each team.</div></section>
    <div class="row between wrap-row"><button class="btn btn-ghost" data-act="viewCareer">VIEW CAREER TIMELINE</button><button class="btn btn-ghost" data-act="toTitle">MAIN MENU</button><button class="btn btn-primary" data-act="startCareer">NEW CAREER</button></div></div>`);
  if (score >= 45) { setTimeout(() => burst(app.querySelector('.complete'), 90), 500); Snd.play('bigFanfare', 0.4); }
}

/* ---------------------------------------------------------------------
   12. ACTIONS & BOOT
   --------------------------------------------------------------------- */
function goHome() {
  if (!S) return renderTitle();
  if (S.phase === 'freeAgency' && (!S.fa || S.fa.signed)) return startNextSeason(); // contract already signed before a reload
  ({ draft: renderDraft, season: renderDashboard, summary: renderSummary, development: renderDevelopment, freeAgency: renderFA, retired: renderCareerComplete }[S.phase] || renderTitle)();
}
// the Super Bowl celebration: once, right after the game that wins the title
async function maybeCelebrate(se, game) {
  if (!game || game.k !== 'PO' || !game.w || !se.po || !se.po.champion || se.sbShown) return;
  se.sbShown = true; saveGame(); await showChampionCelebration(se, game);
}
let busy = false;

// Continue after the offseason: new year, new season
async function startNextSeason() {
  S.year++; S.player.age++;
  evolveRatings(); startSeason(); S.phase = 'season'; S.fa = null;
  saveGame(); Snd.play('whistle', 0.5);
  await splash(`${S.year} SEASON`, `${TEAM[S.teamId].name} · Age ${S.player.age}`, 1600);
  if (typeof ffPreseason === 'function') await ffPreseason(curSeason());   // fantasy draft day
  renderDashboard();
  if (curSeason().mg) setTimeout(() => mgOpen(), 450);   // preseason camp mini game
}
async function doRetire() {
  const se = curSeason();
  if (se && !se.complete) { if (!se.games.length && !se.playoffGames.length) S.seasons.pop(); else { se.partial = true; se.complete = true; if (!se.record) se.record = recOf(se); } }
  S.phase = 'retired'; saveGame(); Snd.play('anthem');
  await splash('RETIREMENT', 'You have decided to retire from the NFL.', 2200);
  renderCareerComplete();
}
function enterFreeAgency() {
  S.phase = 'freeAgency';
  S.fa = { round: 0, offers: genOffers(0) };
  saveGame(); renderFA(); Snd.play('cash', 0.3);
}

// Jersey Creator state helpers (the design lives in S.jerseys[teamId]; name/number belong to the player)
function jcSave(cfg) { S.jerseys = S.jerseys || {}; S.jerseys[jcKey()] = normJersey(cfg); }
function editJersey(fn) {
  const cfg = JSON.parse(JSON.stringify(jerseyFor(jcKey())));
  fn(cfg); jcSave(cfg); saveGame(); renderLocker(true);
}
function setPlayerNumber(n) {
  if (!numberOk(S.player.pos, n)) { toast(`${S.player.pos} numbers must be ${numberRule(S.player.pos)}`); renderLocker(true); return; }
  S.player.number = n; saveGame(); renderLocker(true); toast(`Now wearing #${n}`);
}
// instant preview: redraws only the big jersey (called on every input event)
function jcLive() {
  const el = document.querySelector('.jc2-preview .mat-jersey'); if (!el) return;
  el.innerHTML = jerseySVG(jerseyFor(jcKey()), jName(S.player), playerNumber(), jcOpts({ view: jcView }));
}
// a bound control changed: path like "primary" or "parts.collar"
function jcInput(el, commit) {
  const path = el.dataset.jc, cfg = JSON.parse(JSON.stringify(jerseyFor(jcKey())));
  const v = el.type === 'range' ? Number(el.value) : el.value;
  jcSetPath(cfg, path, v);
  if (['numColor', 'numOutline', 'nameColor', 'nameOutline'].includes(path)) cfg.textCustom = true;
  if (['primary', 'secondary', 'accent'].includes(path)) autoText(cfg);
  jcSave(cfg);
  const lab = document.querySelector(`[data-rv="${path}"]`); if (lab && el.type === 'range') lab.textContent = v + (/(Size|Thick|\.s|jockSize)$/.test(path) ? '%' : /(shAngle|sleeveLogoRot)$/.test(path) ? '°' : '');
  const code = el.parentNode && el.parentNode.querySelector('code'); if (code) code.textContent = path.startsWith('parts.') ? 'CUSTOM' : String(v).toUpperCase();
  if (commit) { saveGame(); renderLocker(true); } else jcLive();
}

const actions = {
  /* title */
  toTitle: () => { closeModal(); renderTitle(); },
  startCareer: () => {
    const go = () => { form = { name: '', pos: 'WR', college: '', age: 22, number: NUM_DEFAULT.WR, jerseyName: '', youth: '' }; renderCreate(); };
    if (hasSave()) confirmBox('Start a new career?', 'Your saved career will be replaced as soon as you enter the draft.', 'NEW CAREER', go, true); else go();
  },
  continueCareer: () => { if (loadGame()) goHome(); else { toast('No save found'); renderTitle(); } },
  resetSave: () => confirmBox('Reset save?', 'This permanently deletes your saved career.', 'DELETE', () => { resetSave(); toast('Save deleted'); renderTitle(); }, true),
  closeModal: () => closeModal(),
  pickYouth: () => { youthModal(); },
  youthLg: (d) => { ypLg = d.lg; youthModal(); },
  youthPick: (d) => {
    form.youth = d.n; const r = document.getElementById('youthRow'); if (r) r.innerHTML = youthRowHTML(); updateCreateJersey();
    document.querySelectorAll('.youth-grid .cp-tile').forEach(t => t.classList.toggle('on', t.dataset.n === d.n));
    const pv = document.getElementById('youthPrev'); if (pv) { pv.style.setProperty('--yc', MFL_INFO[d.n].c1); pv.innerHTML = youthPrevHTML(); pv.classList.remove('jswap'); void pv.offsetWidth; pv.classList.add('jswap'); }
    Snd.play('mgGood', 0, 0);
  },
  youthNone: () => { form.youth = ''; const r = document.getElementById('youthRow'); if (r) r.innerHTML = youthRowHTML(); updateCreateJersey(); closeModal(); },
  confirmYes: () => { const f = pendingConfirm; pendingConfirm = null; closeModal(); if (f) f(); },

  /* create */
  pickPos: (d) => {
    form.pos = d.pos; document.querySelectorAll('.pos-btn').forEach(b => b.classList.toggle('sel', b.dataset.pos === d.pos));
    if (!numberOk(form.pos, parseInt(form.number, 10))) { form.number = NUM_DEFAULT[form.pos]; const i = document.querySelector('[data-model="number"]'); if (i) i.value = form.number; }
    updateCreateJersey();
  },
  genPlayer: () => {
    const name = form.name.trim();
    if (!name) { toast('Please enter a player name'); const i = document.querySelector('[data-model="name"]'); if (i) i.focus(); return; }
    if (!form.youth && !form.college) { toast('Pick a college or a first team'); const c = document.getElementById('cpRoot'); if (c) c.scrollIntoView({ block: 'center' }); return; }
    const age = clamp(parseInt(form.age, 10) || 22, 21, 25), num = parseInt(form.number, 10);
    if (!numberOk(form.pos, num)) { toast(`${form.pos} jersey numbers must be ${numberRule(form.pos)}`); const i = document.querySelector('[data-model="number"]'); if (i) i.focus(); return; }
    form.age = age; rerolls = 3;
    preview = generatePlayer(name, form.pos, form.youth ? '' : form.college, age); preview.number = num; preview.jerseyName = cleanJerseyName(form.jerseyName); preview.youth = form.youth || ''; renderPreview();
  },
  reroll: () => { if (!rerolls) return; rerolls--; const num = preview.number, jn = preview.jerseyName, yt = preview.youth; preview = generatePlayer(preview.name, preview.pos, preview.college, preview.age); preview.number = num; preview.jerseyName = jn; preview.youth = yt; renderPreview(); },
  backCreate: () => renderCreate(),
  enterDraft: () => {
    newCareer(preview);
    S.draft = runDraft(S.player); S.teamId = S.draft.teamId;
    S.contract = makeContract({ ...rookieContract(S.draft, S.player.pos), teamId: S.teamId, startYear: START_YEAR }, 'Rookie');
    S.contracts = [{ ...S.contract }];
    S.phase = 'draft'; saveGame(); renderDraft();
  },
  draftSkip: () => { draftSkipped = true; draftWaits.splice(0).forEach(f => f()); },
  beginRookie: async () => {
    if (busy) return; busy = true;
    try {
      if (typeof contractSign === 'function' && S.contract) await contractSign({ teamId: S.teamId, kind: 'ROOKIE CONTRACT', years: S.contract.years, total: S.contract.total, guaranteed: S.contract.guaranteed, role: null, startYear: START_YEAR, date: `May 2, ${START_YEAR}` });
      S.year = START_YEAR; startSeason(); S.phase = 'season'; saveGame(); Snd.play('whistle', 0.5);
      await splash(`${S.year} SEASON`, `${TEAM[S.teamId].name} · Rookie Season`, 1700);
      if (typeof ffPreseason === 'function') await ffPreseason(curSeason());   // fantasy draft day
      renderDashboard();
      if (curSeason().mg) setTimeout(() => mgOpen(), 450);   // preseason camp mini game
    } finally { busy = false; }
  },

  /* dashboard */
  playMini: () => { closeModal(); mgOpen(); },
  simNext: async () => {
    const se = curSeason(); if (se.status === 'done') return actions.seasonSummary();
    if (se.mg) return mgOpen();
    const r = playGame(se); saveGame(); renderDashboard(); await maybeCelebrate(se, r.game); showGameModal(r.game, r.notes, se);
  },
  watchLive: () => {
    if (busy) return; const se = curSeason(); if (se.status === 'done') return actions.seasonSummary();
    if (se.mg) return mgOpen();
    const r = playGame(se); saveGame();
    LV.done = async () => { renderDashboard(); await maybeCelebrate(se, r.game); showGameModal(r.game, r.notes, se); };
    openLiveGame(r.game, r.notes, se);
  },
  simNextModal: () => { closeModal(); actions.simNext(); },
  viewPlayer: () => {                                    // phones: attributes, depth chart and career live here instead of on the dashboard
    const P = S.player, se = curSeason(), C = careerTotals(), car = POS[P.pos].career(C), completed = S.seasons.filter(x => x.complete).length;
    openModal(`<h3 class="modal-h">${esc(P.name)} · ${P.pos} · OVR ${P.ovr}</h3>
      <div class="attr-list">${attrBars(P)}</div>
      ${depthCardHTML(se)}
      <div class="tiles t3">${tile('SEASONS', S.seasons.length)}${tile(car[0].l.replace('Career ', '').toUpperCase(), car[0].v)}${tile(car[1].l.replace('Career ', '').toUpperCase(), car[1].v)}${tile('PRO BOWLS', awardCount('PB'))}${tile('SUPER BOWLS', awardCount('SB_CHAMP'))}${tile('EARNINGS', money(S.earnings), 'gold')}</div>
      <div class="muted small">${completed} completed season${completed === 1 ? '' : 's'} · ${S.contract.yearsLeft} yr left on contract</div>
      <div class="row end"><button class="btn btn-primary" data-act="closeModal">CLOSE</button></div>`);
  },
  simSeason: async () => {
    if (busy) return; busy = true;
    try {
      const se = curSeason();
      if (se.mg) { mgOpen(); return; }
      if (se.status !== 'done') {
        const ov = document.createElement('div'); ov.className = 'sim-overlay';
        ov.innerHTML = `<div class="sim-box"><div class="eyebrow">SIMULATING ${se.year} SEASON</div><div class="sim-bar"><i></i></div><div class="sim-stage">REGULAR SEASON</div><div class="sim-feed"></div></div>`;
        document.body.appendChild(ov);
        const feed = ov.querySelector('.sim-feed'), bar = ov.querySelector('.sim-bar i'), stage = ov.querySelector('.sim-stage');
        let paused = null;
        while (se.status !== 'done') {
          const r = playGame(se), g = r.game; Snd.play(g.td ? 'cheer' : 'tick');
          const line = document.createElement('div'); line.className = 'feed-line ' + (g.w ? 'w' : 'l');
          line.textContent = `${g.k === 'PO' ? ROUND_NAME[g.wk] : 'WK ' + g.wk} · ${g.home ? 'vs' : '@'} ${g.opp} · ${g.w ? 'W' : 'L'} ${g.my}-${g.op} · ${g.st === 'OUT' ? (g.dnp ? 'DNP' : 'INJURED') : fmt1(g.fp) + ' FP' + (g.td ? ' · 🏈' + g.td : '')}`;
          feed.prepend(line); while (feed.children.length > 7) feed.lastChild.remove();
          bar.style.width = Math.min(100, 100 * se.games.length / 17) + '%';
          if (se.status === 'playoffs' && stage.textContent !== 'PLAYOFFS') { stage.textContent = 'PLAYOFFS'; Snd.play('fanfare'); }
          const call = r.notes.find(n => n.includes('TRADE OFFER'));
          if (call) { paused = call; break; } // stop the sim so the user can answer the call
          if (se.mg) { paused = 'MINI'; break; } // a mini game is ready
          await sleep(110);
        }
        if (paused === 'MINI') { ov.remove(); saveGame(); renderDashboard(); mgOpen(); return; }
        if (paused) {
          ov.remove(); saveGame(); renderDashboard();
          openModal(`<h3 class="modal-h">📞 TRADE OFFER</h3><p class="modal-p">${paused.replace('📞 TRADE OFFER — ', '')}</p>
            <div class="row end"><button class="btn btn-ghost" data-act="simSeasonModal">KEEP SIMULATING</button><button class="btn btn-secondary" data-act="viewTrades">TRADE CENTER</button></div>`, 'small');
          Snd.play('phone'); return;
        }
        await sleep(500); ov.remove(); saveGame();
        await maybeCelebrate(se, se.playoffGames[se.playoffGames.length - 1]);
      }
      await actions.seasonSummary(true);
    } finally { busy = false; }
  },
  seasonSummary: async (inner) => {
    closeModal();
    if (busy && inner !== true) return;
    const wasBusy = busy; busy = true;
    try {
      if (S.phase !== 'summary') {
        await splash('SEASON COMPLETE', `${curSeason().year}`, 1500);
        finishSeason();
      }
      renderSummary();
    } finally { busy = wasBusy; }
  },
  viewStats: () => renderStats(S.seasons.length - 1),
  viewTrades: () => { closeModal(); renderTrades(); },
  simSeasonModal: () => { closeModal(); actions.simSeason(); },
  requestTrade: () => {
    const se = curSeason(), st = tradeStatus(se), P = S.player;
    if ((st !== 'open' && st !== 'today') || se.tradeReq) return;
    se.tradeReq = 'asked';
    // the front office is reluctant to lose its best players
    if (rnd() < { FR: 0.5, ST: 0.25, RT: 0.08, BU: 0.02 }[curRoleKey()]) { se.tradeReq = 'refused'; saveGame(); renderTrades(); Snd.play('down'); toast('The front office refused your trade request'); return; }
    let n = P.ovr >= 82 ? 5 : P.ovr >= 72 ? 4 : P.ovr >= 62 ? 3 : 2;
    if (P.age >= 33) n--; if (P.ovr < 55 && P.age >= 30) n = 0;
    const fresh = n > 0 ? genTradeOffers(se, n, TRADE_DEADLINE) : [];
    offersOf(se).push(...fresh); se.tradeReq = fresh.length ? 'granted' : 'nobody';
    saveGame(); renderTrades(); Snd.play(fresh.length ? 'phone' : 'down');
    toast(fresh.length ? `📞 ${fresh.length} team${fresh.length > 1 ? 's have' : ' has'} made an offer` : 'No team is interested');
  },
  tradeDecline: (d) => { const se = curSeason(); se.tradeOffers = offersOf(se).filter(o => o.id !== d.id); saveGame(); renderTrades(); toast('Offer declined'); },
  tradeAccept: (d) => {
    const se = curSeason(), o = offersOf(se).find(x => x.id === d.id); if (!o || tradeStatus(se) === 'closed' || tradeStatus(se) === 'used') return;
    const t = TEAM[o.teamId];
    confirmBox(`Accept the trade to ${t.city}?`, `You'd join the ${t.name} as a <b>${o.role}</b>. Your contract carries over, and the rest of your season is played with your new team. You can only be traded once this season.`, 'ACCEPT TRADE', async () => {
      const from = se.teamId; executeTrade(o);
      const c = S.contract || {};
      if (typeof contractSign === 'function') await contractSign({ teamId: o.teamId, kind: 'TRADE · NEW TEAM', years: c.yearsLeft || c.years || 1, total: c.total || 0, guaranteed: c.guaranteed || 0, role: o.role, startYear: S.year, date: `${['October', 'November'][rnd() < 0.5 ? 0 : 1]} ${randInt(2, 27)}, ${S.year}` });
      openModal(`<div class="nc-anim" style="${themeVars(o.teamId)}"><div class="eyebrow">TRADE COMPLETED</div><div class="row">${badge(from, 'lg')}<span class="trade-arrow">➜</span>${badge(o.teamId, 'xl')}</div>
        <h3 class="modal-h">You've been traded to the ${t.name}!</h3><div class="d-contract"><div>${o.role.toUpperCase()}</div><div>${o.pkg}</div></div>
        <div class="muted">Your remaining schedule has changed.</div><button class="btn btn-primary btn-xl" data-act="tradeDone">TO THE DASHBOARD ▸</button></div>`, 'contract');
      burst(modalRoot.querySelector('.modal-card'), 50, [t.c1, t.c2, '#ffffff', '#ffc53d']); Snd.play('trade');
    });
  },
  tradeDone: () => { closeModal(); renderDashboard(); },
  viewLocker: () => { jcTarget = 'nfl'; renderLocker(); },
  jcView: (d) => { jcView = d.k; renderLocker(true); },
  jcTab: (d) => { jcTab = d.k; renderLocker(false); const ed = document.querySelector('.jc2-editor'); if (ed) ed.scrollTop = 0; },
  jcPattern: (d) => editJersey(c => Object.assign(c, applyPattern(c, d.k))),
  jcZonePat: (d) => editJersey(c => { c.zp = jcNormZones(c.zp); c.zp[d.z].p = d.p; }),
  jcZoneOff: (d) => editJersey(c => { c.zp = jcNormZones(c.zp); c.zp[d.z].p = ''; }),
  jcZoneRot: (d) => editJersey(c => { c.zp = jcNormZones(c.zp); c.zp[d.z].r = (c.zp[d.z].r + 90) % 360; }),
  jcZoneAuto: (d) => editJersey(c => { c.zp = jcNormZones(c.zp); c.zp[d.z].c = ''; }),
  jcToggle: (d) => editJersey(c => { c[d.k] = !c[d.k]; c.pattern = 'custom'; }),
  jcPalette: (d) => editJersey(c => { const p = jcPalettes(jcKey())[Number(d.i)]; c.primary = p.p; c.secondary = p.s; c.accent = p.a; c.parts = {}; c.sideNumColor = ''; c.sideNumOutline = ''; c.textCustom = false; autoText(c); }),
  jcColor: (d) => editJersey(c => {
    const path = d.path, v = d.c;
    jcSetPath(c, path, v);
    if (['numColor', 'numOutline', 'nameColor', 'nameOutline'].includes(path)) c.textCustom = true;
    if (['primary', 'secondary', 'accent'].includes(path)) autoText(c);
  }),
  jcNumPos: (d) => editJersey(c => { c.sleeveNums = d.k === 'sleeve'; c.noSideNums = d.k === 'none'; }),
  jcJock: () => { jcView = 'front'; editJersey(c => { c.jockTag = !c.jockTag; }); },
  jcJockReset: () => editJersey(c => { c.jockX = 98; c.jockY = 322; c.jockSize = 100; }),
  jcTorsoLogo: () => { jcView = 'front'; editJersey(c => { c.torsoLogo = !c.torsoLogo; }); },
  jcLogoCenter: () => editJersey(c => { c.logoX = 150; c.logoY = 112; c.logoSize = 100; }),
  jcNumReset: () => editJersey(c => { c.sleeveNumY = 0; }),
  jcSwoosh: () => editJersey(c => { c.swoosh = !c.swoosh; }),
  jcSleeveFlip: (d) => editJersey(c => { c['sleeveLogoFlip' + d.s] = !c['sleeveLogoFlip' + d.s]; }),
  jcSleeveLogo: () => editJersey(c => { c.sleeveLogo = !c.sleeveLogo; }),
  jcNameBox: () => { jcView = 'back'; editJersey(c => { c.nameBox = !c.nameBox; }); },
  jcNameBoxAuto: () => editJersey(c => { c.nameBoxFill = ''; }),
  jcWord: () => { jcView = 'front'; editJersey(c => { c.showWord = !c.showWord; }); },
  jcSleeveStyle: (d) => editJersey(c => { c.sleeveStyle = d.k; }),
  jcShoulder: (d) => editJersey(c => { c.shCount = Number(d.k); }),
  jcShStyle: (d) => editJersey(c => { c.shStyle = d.k; }),
  jcSleeve: (d) => editJersey(c => { const n = Number(d.k); c.sleeveCount = n; c.sleeveStripes = n > 0; c.retro = n === 3; }),
  jcSideAuto: (d) => editJersey(c => { c[d.k] = ''; }),
  jcPartAuto: (d) => editJersey(c => { delete c.parts[d.k]; }),
  jcRandom: () => editJersey(c => Object.assign(c, randomJersey(jcKey(), c))),
  jcTarget: (d) => { jcTarget = d.k; jcView = 'front'; renderLocker(true); },
  jcReset: () => { if (S.jerseys) delete S.jerseys[jcKey()]; saveGame(); renderLocker(true); toast('Design reset'); },
  jcExport: () => { (jcAlt() ? exportJerseyPNG() : exportVitrinaPNG()).then(() => toast(jcAlt() ? '⬇ Jersey saved as PNG' : '⬇ Display case saved as PNG')).catch(e => { console.error(e); toast('Could not export the image'); }); },
  jerseyBg: (d) => { S.jerseyBg = d.k; saveGame(); renderLocker(true); },
  jerseyExpand: () => {
    const P = S.player, id = S.teamId, alt = jcAlt();
    openModal(`<div class="expand mat bg-${S.jerseyBg || 'team'}" style="${themeVars(id)}"><div class="mat-tag">${(alt ? alt.name : TEAM[id].name).toUpperCase()}</div><div class="mat-jersey">${jerseySVG(jerseyFor(jcKey()), jName(P), playerNumber(), jcOpts({ view: 'both' }))}</div></div>
      <div class="row end"><button class="btn btn-primary" data-act="closeModal">CLOSE</button></div>`, 'wide');
  },
  jerseyName: (v) => { S.player.jerseyName = cleanJerseyName(v) || ''; saveGame(); renderLocker(true); toast(`Jersey name: ${jName(S.player)}`); },
  jerseyNumber: (v) => setPlayerNumber(parseInt(v, 10)),
  randNumber2: () => setPlayerNumber(randomNumber(S.player.pos)),
  pickCollege: (d) => {
    form.college = d.n; const c = COLLEGE_INFO[d.n];
    document.querySelectorAll('#cpGrid .cp-tile.on').forEach(t => t.classList.remove('on'));
    document.querySelectorAll('#cpGrid .cp-tile').forEach(t => { if (t.dataset.n === d.n) t.classList.add('on'); });
    const cur = document.getElementById('cpCur'); if (cur && c) cur.innerHTML = `${collegeImg(d.n, 120, 'col-logo lg')}<div><b>${esc(d.n)}</b><span>${c.conf ? esc(c.conf) + ' · ' : ''}${DIV_LABEL[c.div]}</span></div>`;
    Snd.play('click'); updateCreateJersey();
  },
  collegeTab: (d) => { collegeDiv = d.d; applyCollegeFilter(); const g = document.getElementById('cpGrid'); if (g) g.scrollTop = 0; },
  collegeLeague: (d) => {
    collegeLeague = d.l; collegeDiv = 'ALL'; applyCollegeFilter(); Snd.play('click');
    const g = document.getElementById('cpGrid'); if (g) { g.scrollTop = 0; const on = g.querySelector('.cp-tile.on:not([hidden])'); if (on) on.scrollIntoView({ block: 'nearest' }); }
  },
  collegeBack: () => { collegeLeague = ''; collegeDiv = 'ALL'; const i = document.querySelector('[data-filter="college"]'); if (i) i.value = ''; applyCollegeFilter(); },
  randNumber: () => { form.number = randomNumber(form.pos); const i = document.querySelector('[data-model="number"]'); if (i) i.value = form.number; updateCreateJersey(); },
  egg: () => {
    const se = curSeason(), live = se && se.status !== 'done' && !se.complete;
    const on = live ? (se.rigged = !se.rigged) : (S.egg = !S.egg);
    saveGame(); Snd.play(on ? 'cheer' : 'tick');
    const b = document.querySelector('.egg-hit'); if (b) { b.classList.remove('egg-pop'); void b.offsetWidth; b.classList.add('egg-pop'); }
    toast(on ? (live ? '🏆 This season ends with the Super Bowl' : '🏆 Next season ends with the Super Bowl') : '🏆 Easter egg off');
  },
  toggleTheme: () => { const t = Theme.get() === 'dark' ? 'light' : 'dark'; Theme.set(t); updateThemeBtn(); toast(t === 'light' ? '☀️ Light mode' : '🌙 Dark mode'); },
  viewStandings: () => { stConf = null; stView = 'div'; renderStandings(S.seasons.length - 1); },
  standConf: (d) => { stConf = d.c; renderStandings(stIdx); },
  standView: (d) => { stView = d.v; renderStandings(stIdx); },
  selStandSeason: (v) => renderStandings(parseInt(v, 10)),
  viewSeason: (d) => renderStats(parseInt(d.i, 10)),
  viewCareer: () => renderCareer(),
  viewContract: () => renderContract(),
  saveExit: () => { saveGame(); toast('💾 Career saved'); renderTitle(); },
  goHome: () => goHome(),
  toggleSound: () => { Snd.setMuted(!Snd.isMuted()); updateSoundBtn(); toast(Snd.isMuted() ? '🔇 Sound off' : '🔊 Sound on'); },
  toggleRow: (d, el) => { const n = el.nextElementSibling; if (n) { n.hidden = !n.hidden; el.classList.toggle('open', !n.hidden); } },
  selSeason: (v) => renderStats(parseInt(v, 10)),

  /* offseason */
  toDevelopment: () => { S.phase = 'development'; saveGame(); renderDevelopment(); },
  afterDev: () => {
    const nextAge = S.player.age + 1;
    if (S.contract.yearsLeft <= 0) {
      if (S.player.ovr < 52 && nextAge >= 33) { confirmBox('No offers', 'No team is interested in signing you. It is time to hang up the cleats.', 'RETIRE', doRetire, false); return; }
      return enterFreeAgency();
    }
    if (S.player.ovr < 50 || nextAge >= 41) { confirmBox('Time to retire', 'Your body can no longer keep up with the NFL.', 'RETIRE', doRetire, false); return; }
    if (nextAge >= 34) {
      openModal(`<h3 class="modal-h">RETIREMENT?</h3><p class="modal-p">You will be ${nextAge}. Do you want to play another season or retire?</p>
        <div class="row end"><button class="btn btn-ghost" data-act="retireYes">RETIRE</button><button class="btn btn-primary" data-act="nextSeasonGo">ONE MORE SEASON</button></div>`, 'small');
      return;
    }
    startNextSeason();
  },
  nextSeasonGo: () => { closeModal(); startNextSeason(); },
  retireYes: () => { closeModal(); doRetire(); },
  retireAsk: () => confirmBox('Retire from the NFL?', 'Your career will end and the final career summary will be shown. This cannot be undone.', 'RETIRE', doRetire, true),

  /* free agency */
  faAccept: async (d) => {
    const o = S.fa.offers.find(x => x.id === d.id); if (!o) return;
    const t = TEAM[o.teamId];
    S.contract = makeContract({ ...o, startYear: S.year + 1 }, o.isCur ? 'Re-sign' : 'Free Agent');
    S.contracts.push({ ...S.contract }); S.teamId = o.teamId; S.fa = { signed: true }; saveGame();
    if (typeof contractSign === 'function') await contractSign({ teamId: o.teamId, kind: o.isCur ? 'RE-SIGNING' : 'FREE AGENT CONTRACT', years: o.years, total: o.total, guaranteed: o.guaranteed, role: o.role, startYear: S.year + 1, date: `March 15, ${S.year + 1}` });
    openModal(`<div class="nc-anim" style="${themeVars(o.teamId)}"><div class="eyebrow">NEW CONTRACT</div>${badge(o.teamId, 'xl')}
      <h3 class="modal-h">${o.isCur ? 'You re-signed with' : 'You signed with'} the ${t.name}!</h3>
      <div class="d-contract"><div>${o.years} YEAR${o.years > 1 ? 'S' : ''}</div><div>${money(o.total)}</div><div>${money(o.guaranteed)} GUARANTEED</div></div>
      <div class="muted">Role: ${o.role}</div>
      <button class="btn btn-primary btn-xl" data-act="nextSeasonGo">${S.year + 1} SEASON ▸</button></div>`, 'contract');
    burst(modalRoot.querySelector('.modal-card'), 60, [t.c1, t.c2, '#ffffff', '#ffc53d']); Snd.play('contract');
  },
  faDecline: (d) => {
    const o = S.fa.offers.find(x => x.id === d.id); if (!o) return;
    if (o.last) { confirmBox('Decline the last offer?', 'No other team wants you. Declining means retiring from the NFL.', 'RETIRE', doRetire, true); return; }
    S.fa.offers = S.fa.offers.filter(x => x.id !== d.id);
    if (!S.fa.offers.length) {
      S.fa.round++;
      if (S.fa.round <= 2) { S.fa.offers = genOffers(S.fa.round); toast('The market cooled — new (lower) offers came in'); }
      else S.fa.offers = [lastChanceOffer()];
    }
    saveGame(); renderFA();
  },
};

/* Event delegation: every clickable thing carries data-act */
document.addEventListener('click', e => {
  Snd.unlock();
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (el.dataset.act !== 'toggleSound') Snd.play('click');
  const f = actions[el.dataset.act];
  if (!f) return;
  const keep = KEEP_SCROLL.has(el.dataset.act), ys = keep ? [window.scrollY, app.scrollTop] : null;
  f(el.dataset, el, e);
  if (keep) { const back = () => { app.style.scrollBehavior = 'auto'; window.scrollTo(0, ys[0]); app.scrollTop = ys[1]; }; back(); requestAnimationFrame(back); }   // in-place re-renders stay where you were
});
const KEEP_SCROLL = new Set(['standConf', 'standView', 'tradeDecline', 'reroll', 'jcView', 'jerseyBg', 'jcReset']);
let jcDrag = null, jcNumDrag = null;
document.addEventListener('pointerdown', e => {                       // sleeve numbers: drag up or down (vertical only)
  const el = e.target.closest && e.target.closest('[data-snum]'); if (!el || !el.closest('.jc2-preview')) return;
  const svg = el.ownerSVGElement, p = svg && jcPoint(svg, e); if (!p) return;
  const cfg = JSON.parse(JSON.stringify(jerseyFor(jcKey()))); jcNumDrag = { svg, cfg, y0: p.y, v0: cfg.sleeveNumY || 0 }; e.preventDefault();
});
document.addEventListener('pointermove', e => {
  if (!jcNumDrag) return; const p = jcPoint(jcNumDrag.svg, e); if (!p) return;
  jcNumDrag.cfg.sleeveNumY = clamp(jcNumDrag.v0 + (p.y - jcNumDrag.y0), -50, 40); jcSave(jcNumDrag.cfg); jcLive(); jcNumDrag.svg = document.querySelector('.jc2-preview svg') || jcNumDrag.svg;
});
['pointerup', 'pointercancel'].forEach(ev => document.addEventListener(ev, () => { if (!jcNumDrag) return; jcSave(jcNumDrag.cfg); saveGame(); jcNumDrag = null; renderLocker(true); }));
const jcPoint = (svg, e) => { const m = svg.getScreenCTM(); if (!m) return null; const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(m.inverse()); };
document.addEventListener('pointerdown', e => {
  const jh = e.target.closest && e.target.closest('rect[data-jhit], image[data-jock]');
  if (jh && jh.closest('.jc2-preview')) {
    const svg = jh.ownerSVGElement, p = jcPoint(svg, e); if (!p) return;
    const cfg = JSON.parse(JSON.stringify(jerseyFor(jcKey()))); jcDrag = { svg, cfg, jock: true, dx: cfg.jockX - p.x, dy: cfg.jockY - p.y }; e.preventDefault(); return;
  }
  const el = e.target.closest && e.target.closest('image[data-tlogo], circle[data-thit]'); if (!el || !el.closest('.jc2-preview')) return;
  const svg = el.ownerSVGElement, p = jcPoint(svg, e); if (!p) return;
  const cfg = JSON.parse(JSON.stringify(jerseyFor(jcKey()))); jcDrag = { svg, cfg, dx: cfg.logoX - p.x, dy: cfg.logoY - p.y }; svg.querySelector('image[data-tlogo]').classList.add('drag'); e.preventDefault();
});
document.addEventListener('pointermove', e => {
  if (!jcDrag) return; const p = jcPoint(jcDrag.svg, e); if (!p) return; const c = jcDrag.cfg;
  if (jcDrag.jock) {
    c.jockX = clamp(p.x + jcDrag.dx, 10, 290); c.jockY = clamp(p.y + jcDrag.dy, 200, 340);
    const im = jcDrag.svg.querySelector('image[data-jock]'), hit = jcDrag.svg.querySelector('rect[data-jhit]');
    if (im) { im.setAttribute('x', (c.jockX - Number(im.getAttribute('width')) / 2).toFixed(1)); im.setAttribute('y', (c.jockY - Number(im.getAttribute('height')) / 2).toFixed(1)); }
    if (hit) { hit.setAttribute('x', (c.jockX - Number(hit.getAttribute('width')) / 2).toFixed(1)); hit.setAttribute('y', (c.jockY - Number(hit.getAttribute('height')) / 2).toFixed(1)); }
    return;
  }
  c.logoX = clamp(p.x + jcDrag.dx, 8, 292); c.logoY = clamp(p.y + jcDrag.dy, 8, 337);
  const el = jcDrag.svg.querySelector('image[data-tlogo]'), sz = Number(el.getAttribute('width')); el.setAttribute('x', (c.logoX - sz / 2).toFixed(1)); el.setAttribute('y', (c.logoY - sz / 2).toFixed(1));
  const hit = jcDrag.svg.querySelector('circle[data-thit]'); if (hit) { hit.setAttribute('cx', c.logoX.toFixed(1)); hit.setAttribute('cy', c.logoY.toFixed(1)); }
});
['pointerup', 'pointercancel'].forEach(ev => document.addEventListener(ev, () => { if (!jcDrag) return; jcSave(jcDrag.cfg); saveGame(); const el = jcDrag.svg.querySelector('image[data-tlogo]'); if (el) el.classList.remove('drag'); const was = jcDrag.jock; jcDrag = null; if (was) renderLocker(true); }));
document.addEventListener('input', e => {
  const jc = e.target.closest('[data-jc]');
  if (jc) { jcInput(jc, false); return; }
  if (e.target.closest('[data-filter="college"]')) { applyCollegeFilter(); return; }
  const el = e.target.closest('[data-model]');
  if (el) { form[el.dataset.model] = el.value; if (['name', 'number', 'jerseyName'].includes(el.dataset.model)) updateCreateJersey(); }
});
document.addEventListener('change', e => {
  const jc = e.target.closest('[data-jc]');
  if (jc) { jcInput(jc, true); return; }
  const m = e.target.closest('[data-model]'); if (m) form[m.dataset.model] = m.value;
  const c = e.target.closest('[data-change]'); if (c && actions[c.dataset.change]) actions[c.dataset.change](c.value, c);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalRoot.firstChild && !modalRoot.querySelector('.contract')) closeModal(); });
// Persistent mute button (top-right on every screen)
const soundBtn = document.createElement('button');
soundBtn.className = 'sound-btn'; soundBtn.dataset.act = 'toggleSound'; soundBtn.title = 'Toggle sound';
function updateSoundBtn() { soundBtn.textContent = Snd.isMuted() ? '🔇' : '🔊'; }
updateSoundBtn(); document.body.appendChild(soundBtn);
const themeBtn = document.createElement('button');
themeBtn.className = 'sound-btn theme-btn'; themeBtn.dataset.act = 'toggleTheme'; themeBtn.title = 'Light / dark mode';
function updateThemeBtn() { themeBtn.textContent = Theme.get() === 'dark' ? '🌙' : '☀️'; }
Theme.set(Theme.get()); updateThemeBtn(); document.body.appendChild(themeBtn);
const bgmark = document.createElement('div'); bgmark.id = 'bgmark'; document.body.insertBefore(bgmark, document.body.firstChild);

jcCalibrate();
renderTitle();

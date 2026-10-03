/* =====================================================================
   LIVE GAME — watch the game on a small NFL field, snap by snap, for every play your player is part of.
   The game has already been simulated by playGame(); this file turns that result (score + the player's stat line) into a
   believable script of plays and animates each one. Whatever happens on the field always adds up to the real box score.
   ===================================================================== */
const LV = { speed: 1, run: 0 };
const LV_FW = 1200, LV_FH = 533, LV_PAD = 10;               // field drawing: 120 yards x 53.3 yards, 10 px per yard (endzones included)
const lvX = abs => 100 + abs * 10;                          // yards from the left goal line -> px
const lvY = v => LV_PAD + LV_FH / 2 + v * 10;               // lateral yards from the middle of the field -> px

/* ---------- script: from the box score to a list of plays ---------- */
// split `total` into n whole numbers (>= min each) with a natural spread: a few big plays, many small ones
function lvAlloc(total, n, min = 0) {
  if (n <= 0) return [];
  const base = Math.max(0, total - min * n), w = Array.from({ length: n }, () => Math.pow(rnd(), 1.9) + 0.1), sw = w.reduce((a, b) => a + b, 0);
  const out = w.map(x => Math.floor(base * x / sw)); let rem = base - out.reduce((a, b) => a + b, 0);
  while (rem-- > 0) out[Math.floor(rnd() * n)]++;
  return out.map(x => x + min);
}
const lvAllocSigned = (total, n) => lvAlloc(total + 2 * n, n).map(x => x - 2);   // carries can lose a yard or two
function lvCoins(rem) {   // random split of points into touchdowns / field goals (/ the odd 2-point or safety)
  const out = [];
  while (rem > 0) {
    const opts = [7, 3, 6, 8, 2].filter(c => c <= rem && (rem - c === 0 || rem - c >= 2)), pool = [];
    opts.forEach(c => { const w = c === 7 ? 60 : c === 3 ? 40 : c === 6 ? 5 : c === 8 ? 4 : 2; for (let i = 0; i < w; i++) pool.push(c); });
    const c = pool.length ? pick(pool) : rem; out.push(c); rem -= c;
  }
  return out;
}
const LV_SCORE_LABEL = { 7: 'TOUCHDOWN', 6: 'TOUCHDOWN', 8: 'TOUCHDOWN + 2-PT', 3: 'FIELD GOAL', 2: 'SAFETY', 1: 'EXTRA POINT' };

function lvBuild(game) {
  const P = S.player, pos = P.pos, s = game.s || {}, plays = [], N = k => Math.max(0, Math.round(s[k] || 0));
  const mk = (kind, o = {}) => plays.push({ kind, off: 'me', yards: 0, td: false, pts: 0, inc: {}, ...o });
  const tdMark = (n, count) => { const idx = shuffle([...Array(count).keys()]).slice(0, Math.min(n, count)); return i => idx.includes(i); };
  if (game.st !== 'OUT') {
    if (['WR', 'TE', 'RB'].includes(pos)) {
      const rec = N('rec'), tgt = N('targets'), yd = lvAlloc(N('recYds'), rec), isTD = tdMark(N('recTD'), rec);
      for (let i = 0; i < rec; i++) { const td = isTD(i), y = td ? Math.max(1, yd[i]) : yd[i]; mk('catch', { yards: y, td, pts: td ? 7 : 0, inc: { targets: 1, rec: 1, recYds: y, recTD: td ? 1 : 0 } }); }
      for (let i = 0; i < Math.max(0, tgt - rec); i++) mk('incomplete', { inc: { targets: 1 }, drop: rnd() < 0.3 });
    }
    if (['WR', 'TE', 'RB', 'QB'].includes(pos)) {
      const ra = N('rushAtt'), yd = lvAllocSigned(N('rushYds'), ra), isTD = tdMark(N('rushTD'), ra);
      for (let i = 0; i < ra; i++) { const td = isTD(i), y = td ? Math.max(1, yd[i]) : yd[i]; mk(pos === 'QB' ? 'qbRush' : 'rush', { yards: y, td, pts: td ? 7 : 0, inc: { rushAtt: 1, rushYds: y, rushTD: td ? 1 : 0 } }); }
    }
    if (pos === 'QB') {
      const att = N('passAtt'), comp = Math.min(att, N('passComp')), ints = Math.min(N('int'), att - comp), yd = lvAlloc(N('passYds'), comp), isTD = tdMark(N('passTD'), comp);
      for (let i = 0; i < comp; i++) { const td = isTD(i), y = td ? Math.max(1, yd[i]) : yd[i]; mk('qbPass', { yards: y, td, pts: td ? 7 : 0, inc: { passAtt: 1, passComp: 1, passYds: y, passTD: td ? 1 : 0 } }); }
      for (let i = 0; i < att - comp; i++) mk(i < ints ? 'qbInt' : 'qbInc', { inc: i < ints ? { passAtt: 1, int: 1 } : { passAtt: 1 } });
    }
    if (pos === 'OL') {
      for (let i = 0; i < N('pancakes'); i++) mk('pancake', { yards: Math.round(rr(3, 9)), inc: { pancakes: 1 } });
      const sk = N('sacksAllowed'), pr = Math.max(0, N('pressures') - sk);
      for (let i = 0; i < sk; i++) mk('sackAllowed', { yards: -Math.round(rr(4, 9)), inc: { pressures: 1, sacksAllowed: 1 } });
      for (let i = 0; i < pr; i++) mk('pressure', { inc: { pressures: 1 } });
      for (let i = 0; i < N('penalties'); i++) mk('penalty', { inc: { penalties: 1 }, yards: pick([-5, -10, -10]) });
      for (let i = 0; i < 3 + Math.floor(rnd() * 3); i++) mk('block', { yards: Math.round(rr(2, 12)) });
    }
    if (['DL', 'LB', 'CB', 'S'].includes(pos)) {
      const sacks = s.sacks || 0, full = Math.floor(sacks), half = sacks - full >= 0.5 ? 1 : 0, tk = N('tackles'), solo = N('solo');
      for (let i = 0; i < full; i++) mk('sack', { off: 'op', yards: -Math.round(rr(4, 10)), inc: { tackles: 1, solo: 1, sacks: 1 } });
      if (half) mk('sack', { off: 'op', half: true, yards: -Math.round(rr(3, 7)), inc: { tackles: 1, sacks: 0.5 } });
      const rest = Math.max(0, tk - full - half), soloLeft = Math.max(0, solo - full), ys = lvAlloc(Math.round(rest * 4.2), rest);
      const ffIdx = tdMark(N('ff'), rest);
      for (let i = 0; i < rest; i++) mk('tackle', { off: 'op', yards: ys[i] - 1, solo: i < soloLeft, ff: ffIdx(i), pass: rnd() < 0.42, inc: { tackles: 1, solo: i < soloLeft ? 1 : 0, ff: ffIdx(i) ? 1 : 0 } });
      let tds = N('defTD');
      for (let i = 0; i < N('ints'); i++) { const td = tds > 0; if (td) tds--; mk('int', { off: 'op', td, pts: td ? 7 : 0, yards: td ? 0 : Math.round(rr(0, 28)), inc: { ints: 1, defTD: td ? 1 : 0 } }); }
      for (let i = 0; i < N('pd'); i++) mk('pd', { off: 'op', inc: { pd: 1 } });
      for (let i = 0; i < N('fr'); i++) { const td = tds > 0; if (td) tds--; mk('frec', { off: 'op', td, pts: td ? 7 : 0, inc: { fr: 1, defTD: td ? 1 : 0 } }); }
    }
    if (pos === 'K') {
      const fgm = N('fgm'), fga = Math.max(fgm, N('fga')), xpm = N('xpm'), xpa = Math.max(xpm, N('xpa'));
      for (let i = 0; i < fga; i++) { const made = i < fgm; mk('fg', { made, yards: Math.round(made ? rr(21, 54) : rr(38, 58)), pts: made ? 3 : 0, inc: { fga: 1, fgm: made ? 1 : 0 } }); }
      for (let i = 0; i < xpa; i++) mk('xp', { made: i < xpm, yards: 33, pts: i < xpm ? 1 : 0, inc: { xpa: 1, xpm: i < xpm ? 1 : 0 }, afterTD: true });
    }
  }
  /* team scoring around the player's own plays */
  const events = [];
  let myPts = plays.reduce((a, p) => a + (p.pts || 0), 0);
  if (pos === 'K') {                                   // each extra point follows a touchdown (6) by the offense
    plays.filter(p => p.kind === 'xp').forEach(p => events.push({ type: 'score', side: 'me', pts: 6, label: 'TOUCHDOWN', pair: p }));
    myPts += events.length * 6;
  }
  let remMe = game.my - myPts;
  if (remMe < 0) { plays.forEach(p => { if (p.pts && remMe < 0) { const d = Math.min(p.pts, -remMe); p.pts -= d; remMe += d; } }); remMe = Math.max(0, remMe); }
  lvCoins(remMe).forEach(c => events.push({ type: 'score', side: 'me', pts: c, label: LV_SCORE_LABEL[c] }));
  lvCoins(game.op).forEach(c => events.push({ type: 'score', side: 'op', pts: c, label: LV_SCORE_LABEL[c] }));
  /* put everything in order along the 60 minutes of the game */
  const items = shuffle(plays.filter(p => p.kind !== 'xp').map(p => ({ type: 'play', play: p })).concat(events.filter(e => !e.pair)));
  const pairs = events.filter(e => e.pair), total = items.length + pairs.length * 2;
  const times = Array.from({ length: total }, () => rr(90, 3480)).sort((a, b) => a - b);
  const out = []; let ti = 0;
  items.forEach(it => { out.push({ ...it, t: times[ti++] }); });
  pairs.forEach(e => { const t = times[ti++]; out.push({ ...e, t }); out.push({ type: 'play', play: e.pair, t: t + 10 + rnd() * 20 }); ti++; });
  out.sort((a, b) => a.t - b.t);
  out.forEach(e => { e.q = Math.min(4, Math.floor(e.t / 900) + 1); const left = 900 - (e.t % 900); e.clock = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`; });
  /* field position, down & distance */
  out.filter(e => e.type === 'play').forEach(e => {
    const p = e.play;
    if (p.kind === 'fg' || p.kind === 'xp') { p.los = clamp(100 - (p.yards - 17), 30, 99); p.down = p.kind === 'xp' ? 0 : 4; p.dist = p.kind === 'xp' ? 0 : Math.round(rr(3, 12)); return; }
    const adv = p.td ? p.yards : Math.max(0, p.yards || 0);
    p.los = p.td ? clamp(100 - Math.max(1, p.yards), 1, 99) : clamp(Math.round(rr(14, 82)), 3, Math.max(4, 98 - adv));
    if (p.kind === 'int' || p.kind === 'frec') p.los = Math.round(rr(30, 75));
    p.down = pick([1, 1, 1, 2, 2, 3, 3, 4]); p.dist = p.down === 1 ? Math.min(10, 100 - p.los) : clamp(Math.round(rr(1, 12)), 1, 100 - p.los);
    if (p.los >= 90) p.dist = Math.min(p.dist, 100 - p.los);
  });
  return out;
}


/* ---------- real end zone designs (home team paints BOTH end zones, as in a real stadium) ----------
   bg: paint color, or null = bare turf (several teams really play on unpainted grass with only the lettering painted on top).
   ends: [left zone, right zone] (one entry = same word at both ends). Everything is drawn in the zone's own frame:
   x along the 53.3-yard length (0 = middle, text reads left to right), y across the depth (-50 end line ... +50 goal line), 10 px per yard.
   t = wordmark {s text, f fill, o outline, w outline width, ff font, h cap height px, n length px, x, y, it italic, sh [color, dx, dy] 3D shadow}
   l = logo {k team|nfl|afc|nfc, x, y, w, g grayscale}; x = special {bolt, spark, rule, band} */
const LV_EZ = {
  BUF: { bg: '#00338D', ends: [[{ t: { s: 'BILLS', f: '#F5F5F5', o: '#C60C30', w: 3, ff: 'Alfa Slab One', h: 76, n: 290 } }]] },
  MIA: { bg: null, ends: [[{ t: { s: 'MIAMI', f: '#F8F9F7', o: '#FC4C02', w: 3, ff: 'Racing Sans One', h: 56, n: 346, it: 1 } }], [{ t: { s: 'DOLPHINS', f: '#F8F9F7', o: '#FC4C02', w: 3, ff: 'Racing Sans One', h: 52, n: 400, it: 1 } }]] },
  NE: { bg: null, ends: [[{ t: { s: 'PATRIOTS', f: '#FAFAFA', o: '#002244', w: 2.5, ff: 'Barlow Condensed', fw: 800, h: 82, n: 260, x: 30 } }, { l: { k: 'team', x: -205, y: 0, w: 74 } }]] },
  NYJ: { bg: '#125740', ends: [[{ l: { k: 'img', src: 'assets/nfl/jets-white.png', x: 0, y: 0, w: 290, h: 91 } }]] },   // the Jets' own logo in white on green
  BAL: { bg: '#241773', ends: [[{ l: { k: 'img', src: 'assets/nfl/ravens-wordmark.png', x: 0, y: 0, w: 470, h: 66 } }]] },   // the Ravens' own wordmark on purple
  CIN: { bg: '#FB4F14', deco: 'tiger', ends: [[{ t: { s: 'BENGALS', f: '#000000', o: '#FFFFFF', w: 4.5, ff: 'Alfa Slab One', h: 42, n: 420 } }]] },
  CLE: { bg: null, ends: [[{ t: { s: 'BROWNS', f: '#F8F9F7', o: '#FF3C00', w: 3, ff: 'Saira Extra Condensed', fw: 800, h: 62, n: 280 } }], [{ t: { s: 'CLEVELAND', f: '#F8F9F7', o: '#FF3C00', w: 3, ff: 'Saira Extra Condensed', fw: 800, h: 62, n: 360 } }]] },
  PIT: { bg: null, ends: [[{ t: { s: 'PITTSBURGH', f: '#FFB612', o: '#101820', w: 3, ff: 'Archivo Black', h: 46, n: 340, x: -34 } }, { l: { k: 'nfl', x: 228, y: 0, w: 50 } }], [{ t: { s: 'STEELERS', f: '#FFB612', o: '#101820', w: 3, ff: 'Archivo Black', h: 46, n: 300, x: -34 } }, { l: { k: 'nfl', x: 228, y: 0, w: 50 } }]] },
  HOU: { bg: '#03202F', ends: [[{ t: { s: 'TEXANS', f: '#FFFFFF', o: '#A71930', w: 3.5, ff: 'Russo One', h: 60, n: 330 } }]] },
  IND: { bg: '#1A4FB0', ends: [[{ t: { s: 'INDIANAPOLIS', f: '#F2EFE8', ff: 'Archivo Black', h: 50, n: 440 } }], [{ t: { s: 'COLTS', f: '#F2EFE8', o: '#0B1D5B', w: 3, ff: 'Archivo Black', h: 70, n: 240 } }, { l: { k: 'afc', x: -205, y: 8, w: 40 } }, { l: { k: 'nfl', x: 205, y: 8, w: 40 } }]] },
  JAX: { bg: '#0A5B7B', ends: [[{ t: { s: 'JAGUARS', f: '#FFFFFF', ff: 'Archivo Black', h: 40, n: 330, y: 6 } }, { t: { s: 'JACKSONVILLE', f: '#E8F1F4', ff: 'Archivo Black', h: 16, n: 250, y: -30 } }]] },
  TEN: { bg: null, ends: [[{ t: { s: 'TITANS', f: '#0C2340', o: '#FFFFFF', w: 5, ff: 'Russo One', h: 66, n: 480, sh: ['#4B92DB', 4, 4] } }]] },
  DEN: { bg: null, ends: [[{ t: { s: 'BRONCOS', f: '#FB4F14', o: '#FFFFFF', w: 4, ff: 'Russo One', h: 60, n: 360 } }]] },
  KC: { bg: null, ends: [[{ t: { s: 'CHIEFS', f: '#E31837', ff: 'Alfa Slab One', h: 60, n: 350 } }]] },
  LV: { bg: '#0A0A0A', ends: [[{ t: { s: 'Las Vegas', f: '#DADDE0', ff: 'Pacifico', h: 52, n: 340, cap: 0.62 } }, { x: 'spark', px: -170, py: -30, r: 12 }, { x: 'spark', px: 150, py: 28, r: 9 }, { x: 'spark', px: 205, py: -26, r: 7 }, { x: 'spark', px: -215, py: 26, r: 6 }], [{ t: { s: 'RAIDERS', f: '#A5ACAF', o: '#FFFFFF', w: 1.5, ff: 'Russo One', h: 64, n: 340 } }]] },
  LAC: { bg: '#0080C6', deco: 'band', ends: [[{ t: { s: 'CHARGERS', f: '#FFFFFF', ff: 'Russo One', h: 50, n: 330, x: 14, y: 4 } }, { x: 'bolt', px: -230, py: 6, r: 22 }], [{ t: { s: 'LOS ANGELES', f: '#FFFFFF', ff: 'Russo One', h: 46, n: 380, x: 14, y: 4 } }, { x: 'bolt', px: -230, py: 6, r: 22 }]] },
  DAL: { bg: '#1B3A8C', ends: [[{ t: { s: 'COWBOYS', f: '#A9B0B4', o: '#FFFFFF', w: 3, ff: 'Russo One', h: 60, n: 270, sh: ['#0B1F5A', 3, 3] } }, { l: { k: 'team', x: -215, y: 0, w: 82, g: 1 } }, { l: { k: 'team', x: 215, y: 0, w: 82, g: 1 } }]] },
  NYG: { bg: '#1E5FB5', ends: [[{ t: { s: 'GIANTS', f: '#FFFFFF', ff: 'Archivo Black', h: 66, n: 320, x: 20, sh: ['#0B2265', 4, 4] } }, { l: { k: 'team', x: -225, y: 0, w: 76 } }]] },
  PHI: { bg: '#00494F', ends: [[{ t: { s: 'EAGLES', f: '#EDF1F1', ff: 'Squada One', h: 72, n: 360 } }]] },
  WAS: { bg: null, ends: [[{ t: { s: 'COMMANDERS', f: '#5A1414', ff: 'Barlow Condensed', fw: 800, h: 46, n: 400 } }, { x: 'rule', py: -34, n: 430 }, { x: 'rule', py: 34, n: 430 }, { l: { k: 'team', x: -235, y: 0, w: 62 } }, { l: { k: 'team', x: 235, y: 0, w: 62 } }]] },
  CHI: { bg: null, ends: [[{ t: { s: 'CHICAGO', f: '#C83803', o: '#0B162A', w: 3, ff: 'Archivo Black', h: 56, n: 380 } }, { l: { k: 'nfc', x: -232, y: 8, w: 52 } }, { l: { k: 'nfl', x: 232, y: 8, w: 48 } }], [{ t: { s: 'BEARS', f: '#C83803', o: '#0B162A', w: 3, ff: 'Archivo Black', h: 60, n: 290 } }, { l: { k: 'nfc', x: -232, y: 8, w: 52 } }, { l: { k: 'nfl', x: 232, y: 8, w: 48 } }]] },
  DET: { bg: '#0076B6', ends: [[{ t: { s: 'LIONS', f: 'none', o: '#FFFFFF', w: 3, ff: 'Russo One', h: 66, n: 330 } }]] },
  GB: { bg: '#2E6B2E', op: 0.9, ends: [[{ t: { s: 'PACKERS', f: '#FFB612', o: '#FFFFFF', w: 3, ff: 'Alfa Slab One', h: 66, n: 340 } }], [{ t: { s: 'GREEN BAY', f: '#FFB612', o: '#FFFFFF', w: 3, ff: 'Alfa Slab One', h: 66, n: 410 } }]] },
  MIN: { bg: '#4F2683', ends: [[{ t: { s: 'VIKINGS', f: '#F4F1EA', ff: 'Cinzel', fw: 900, h: 64, n: 400, cap: 0.7 } }]] },
  ATL: { bg: null, ends: [[{ t: { s: 'ATLANTA', f: '#FFFFFF', o: '#000000', w: 1.5, ff: 'Archivo Black', h: 56, n: 168, x: -172 } }, { l: { k: 'team', x: 0, y: 0, w: 130 } }, { t: { s: 'FALCONS', f: '#FFFFFF', o: '#000000', w: 1.5, ff: 'Archivo Black', h: 56, n: 168, x: 172 } }]] },
  CAR: { bg: null, ends: [[{ t: { s: 'PANTHERS', f: '#000000', o: '#0085CA', w: 5, ff: 'Russo One', h: 48, n: 420, it: 1 } }]] },
  NO: { bg: null, deco: 'sband', ends: [[{ t: { s: 'SAINTS', f: '#000000', o: '#D3BC8D', w: 2.5, ff: 'Alfa Slab One', h: 58, n: 330 } }]] },
  TB: { bg: null, ends: [[{ t: { s: 'BUCCANEERS', f: '#D50A0A', o: '#FFFFFF', w: 1.5, ff: 'Alfa Slab One', h: 42, n: 400, sh: ['#111111', 4, 4] } }]] },
  ARI: { bg: null, ends: [[{ t: { s: 'ARIZONA', f: '#97233F', o: '#FFFFFF', w: 4, ff: 'Archivo Black', h: 50, n: 330 } }], [{ t: { s: 'CARDINALS', f: '#97233F', o: '#FFFFFF', w: 4, ff: 'Archivo Black', h: 50, n: 400 } }]] },
  LAR: { bg: '#0B2A8A', ends: [[{ t: { s: 'RAMS', f: '#FFD100', ff: 'Alfa Slab One', h: 66, n: 280 } }]] },
  SF: { bg: null, ends: [[{ t: { s: '49ERS', f: '#AA0000', o: '#B3995D', w: 4, ff: 'Rye', h: 56, n: 300, cap: 0.7 } }, { l: { k: 'nfl', x: -235, y: 10, w: 48 } }, { l: { k: 'nfc', x: 235, y: 10, w: 52 } }]] },
  SEA: { bg: '#002244', ends: [[{ t: { s: 'SEAHAWKS', f: '#A5ACAF', o: '#FFFFFF', w: 1.5, ff: 'Graduate', h: 52, n: 330, x: -4 } }, { l: { k: 'nfl', x: -232, y: 0, w: 46 } }, { l: { k: 'team', x: 232, y: 0, w: 70 } }]] },
};
const lvSpark = (x, y, r) => `<path d="M${x} ${y - r}Q${x + r * 0.15} ${y - r * 0.15} ${x + r} ${y}Q${x + r * 0.15} ${y + r * 0.15} ${x} ${y + r}Q${x - r * 0.15} ${y + r * 0.15} ${x - r} ${y}Q${x - r * 0.15} ${y - r * 0.15} ${x} ${y - r}z" fill="#E8ECEF"/>`;
const lvBolt = (x, y, r) => `<path transform="translate(${x} ${y}) scale(${r / 22})" d="M-14 -30L10 -30L0 -8L16 -8L-10 30L-2 4L-16 4Z" fill="#FFC20E"/>`;
function lvEzItems(items, team) {
  return items.map(it => {
    if (it.t) {
      const t = it.t, cap = t.cap || 0.72, fs = t.h / cap, x = t.x || 0, y = (t.y || 0) + t.h / 2;
      const one = (dx, dy, fill, o, w) => `<text x="${x + dx}" y="${y + dy}" text-anchor="middle" textLength="${t.n}" lengthAdjust="spacingAndGlyphs" font-family="'${t.ff}',Impact,sans-serif" font-weight="${t.fw || 400}" font-size="${fs.toFixed(1)}" fill="${fill}"${o ? ` stroke="${o}" stroke-width="${w}" stroke-linejoin="round" paint-order="stroke"` : ''}${t.it ? ` transform="translate(${x} ${y}) skewX(-10) translate(${-x} ${-y})"` : ''}>${esc(t.s)}</text>`;
      return `<g opacity=".95">${t.sh ? one(t.sh[1], t.sh[2], t.sh[0], t.sh[0], (t.w || 0) + 1) : ''}${one(0, 0, t.f, t.o, t.w)}</g>`;
    }
    if (it.l) {
      const l = it.l, src = l.k === 'team' ? logoUrl(team.id) : l.k === 'nfl' ? NFL_LOGO : `https://a.espncdn.com/i/teamlogos/nfl/500/${l.k}.png`;   // afc / nfc from the ESPN CDN
      const lh = l.h || l.w; return `<image href="${l.src || src}" x="${l.x - l.w / 2}" y="${l.y - lh / 2}" width="${l.w}" height="${lh}" opacity=".95" preserveAspectRatio="xMidYMid meet"${l.g ? ' style="filter:grayscale(1) brightness(1.25)"' : ''}/>`;
    }
    if (it.x === 'spark') return lvSpark(it.px, it.py, it.r);
    if (it.x === 'bolt') return lvBolt(it.px, it.py, it.r);
    if (it.x === 'rule') return `<rect x="${-it.n / 2}" y="${it.py - 1.6}" width="${it.n}" height="3.2" fill="#5A1414" opacity=".95"/>`;
    return '';
  }).join('');
}
// the stripes of the Bengals zone: black curved bands over the orange, from both sidelines
function lvTiger() {
  let out = '';
  for (let i = 0; i < 9; i++) {
    const x0 = -246 + i * 62, w = 20 + (i % 3) * 5, bend = (i % 2 ? 1 : -1) * 16;
    out += `<path d="M${x0} -50 Q${x0 + bend} -16 ${x0 + bend * 0.2} 0 Q${x0 - bend * 0.8} 16 ${x0 + w * 0.2} 50 L${x0 + w + 6} 50 Q${x0 + w - bend * 0.5} 16 ${x0 + w + bend * 0.2} 0 Q${x0 + w + bend} -16 ${x0 + w} -50Z" fill="#0b0b0b"/>`;
  }
  return out;
}
function lvEndZone(x, team, rot, endIdx) {
  const d = LV_EZ[team.id], top = LV_PAD, cx = x + 50, cy = lvY(0);
  if (!d) {                                                        // safety net: a team with no design gets its color and name
    const bg = team.c1, txt = lum(bg) > 0.5 ? '#101418' : '#FFFFFF';
    return `<rect x="${x}" y="${top}" width="100" height="${LV_FH}" fill="${bg}"/><g transform="translate(${cx} ${cy}) rotate(${rot})"><text text-anchor="middle" y="22" font-family="'Anton',sans-serif" font-size="70" fill="${txt}">${esc(team.nick.toUpperCase())}</text></g>`;
  }
  const items = d.ends[Math.min(endIdx, d.ends.length - 1)];
  const turf = `<rect x="${x}" y="${top}" width="50" height="${LV_FH}" fill="#2a8044"/><rect x="${x + 50}" y="${top}" width="50" height="${LV_FH}" fill="#2f8a4a"/>`;   // mowed grass shows through unpainted zones
  const paint = turf + (d.bg ? `<rect x="${x}" y="${top}" width="100" height="${LV_FH}" fill="${d.bg}" opacity="${d.op || 0.94}"/>` : '');
  const local = (d.deco === 'tiger' ? lvTiger() : '') + (d.deco === 'band' ? `<rect x="-270" y="-50" width="540" height="7" fill="#fff" opacity=".85"/>` : '')
    + (d.deco === 'sband' ? `<rect x="-270" y="-50" width="540" height="9" fill="#101010" opacity=".92"/><rect x="-270" y="-39" width="540" height="2" fill="#D3BC8D"/>` : '') + lvEzItems(items, team);
  const cid = 'lvEzC' + x;                                          // nothing may spill over the white border: clip to the end zone itself
  return `<defs><clipPath id="${cid}"><rect x="${x}" y="${top}" width="100" height="${LV_FH}"/></clipPath></defs><g clip-path="url(#${cid})">${paint}<g transform="translate(${cx} ${cy}) rotate(${rot})">${local}</g></g>`;
}

/* ---------- the field ---------- */
function lvFieldSVG(away, home) {
  const A = TEAM[away], H = TEAM[home], top = LV_PAD, bot = LV_PAD + LV_FH, cy = lvY(0);
  const stripes = Array.from({ length: 20 }, (_, i) => `<rect x="${lvX(i * 5)}" y="${top}" width="50" height="${LV_FH}" fill="${i % 2 ? '#2e8848' : '#2b8245'}"/>`).join('');
  // yard lines: a full-width line every 5 yards, the goal lines heavier
  const lines = Array.from({ length: 21 }, (_, i) => `<line x1="${lvX(i * 5)}" x2="${lvX(i * 5)}" y1="${top}" y2="${bot}" stroke="#fff" stroke-opacity=".95" stroke-width="${i === 0 || i === 20 ? 3.4 : 2}"/>`).join('');
  // NFL hash marks: one-yard ticks on the inbound lines (70'9" from each sideline = 3.08 yd either side of the middle) and along both sidelines
  const hy = 3.08, hashes = Array.from({ length: 99 }, (_, i) => {
    if ((i + 1) % 5 === 0) return '';
    const x = lvX(i + 1), t = (y, d) => `<line x1="${x}" x2="${x}" y1="${y}" y2="${y + d}" stroke="#fff" stroke-opacity=".85" stroke-width="1.8"/>`;
    return t(lvY(-hy) - 3.5, 7) + t(lvY(hy) - 3.5, 7) + t(top + 2, 7) + t(bot - 9, 7);
  }).join('');
  // yard numbers: 6 ft x 4 ft numerals (drawn 1.5x so they read on a small screen), base 12 yd from the sideline, clear of the line on both sides;
  // the 10-40 pairs carry a small arrow pointing at the nearest goal line. Far-side numbers are turned 180° so they read from the other sideline.
  const NW = 20, NH = 30, GAP = 9, ARW = 13;
  const digit = (ch, cx, y0, rot) => `<text x="${cx}" y="${y0 + NH}" text-anchor="middle" font-size="${NH / 0.7}" ${ch === '1' ? '' : `textLength="${NW}" lengthAdjust="spacingAndGlyphs"`} ${rot ? `transform="rotate(180 ${cx} ${y0 + NH / 2})"` : ''}>${ch}</text>`;
  const nums = [1, 2, 3, 4, 5, 4, 3, 2, 1].map((n, i) => {
    const X = lvX((i + 1) * 10), toLeft = i < 4, toRight = i > 4;
    const place = (y0, far) => {
      const L = X - GAP - NW / 2, R = X + GAP + NW / 2, d = far ? ['0', String(n)] : [String(n), '0'];   // upside-down "30" is seen as 0 then 3 along the field
      let g = digit(d[0], L, y0, far) + digit(d[1], R, y0, far);
      const ay = y0 + NH / 2;
      if (toLeft) g += `<polygon points="${X - GAP - NW - 5 - ARW},${ay} ${X - GAP - NW - 5},${ay - 8} ${X - GAP - NW - 5},${ay + 8}"/>`;
      if (toRight) g += `<polygon points="${X + GAP + NW + 5 + ARW},${ay} ${X + GAP + NW + 5},${ay - 8} ${X + GAP + NW + 5},${ay + 8}"/>`;
      return g;
    };
    return place(bot - 120 - NH, false) + place(top + 120, true);
  }).join('');
  // end zones: the home team's real design, painted on BOTH ends
  const ezOf = (x, team, rot, end) => lvEndZone(x, team, rot, end);
  const pylon = (x, y) => `<rect x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" fill="#ff6a13" stroke="#fff" stroke-width="1"/>`;
  const pylons = [100, 1100, 0, 1200].map(x => pylon(Math.min(1198, Math.max(2, x)), top + 5) + pylon(Math.min(1198, Math.max(2, x)), bot - 5)).join('');
  const post = (x, d) => `<g stroke="#ffd23d" stroke-width="5" stroke-linecap="round" fill="none"><line x1="${x}" x2="${x}" y1="${lvY(-3.1)}" y2="${lvY(3.1)}"/><line x1="${x}" x2="${x + d * 18}" y1="${lvY(-3.1)}" y2="${lvY(-3.1)}"/><line x1="${x}" x2="${x + d * 18}" y1="${lvY(3.1)}" y2="${lvY(3.1)}"/></g>`;
  // everything outside the playing field, like the real thing: a white border band, the dashed coaches' box and each team's bench area with its logo
  const VX = -70, VY = -66, VW = 1340, VH = 685, bandX = -20, bandY = top - 20, bandW = 1240, bandH = LV_FH + 40;
  const bench = (team, outer) => {
    const x0 = lvX(35), x1 = lvX(85), y0 = outer ? bandY - 46 : bandY + bandH + 46, yn = outer ? bandY - 2 : bandY + bandH + 2, c = team.c1, mid = (x0 + x1) / 2, ly = (y0 + yn) / 2;
    const dark = lum(c) < 0.45;
    return `<polygon points="${x0 + 14},${y0} ${x1 - 14},${y0} ${x1},${yn} ${x0},${yn}" fill="${c}"/><image href="${logoUrl(team.id)}" x="${mid - 24}" y="${ly - 24}" width="48" height="48" opacity="${dark ? 1 : .95}" preserveAspectRatio="xMidYMid meet"/>`;
  };
  const dashes = `<rect x="-46" y="${bandY - 24}" width="1292" height="${bandH + 48}" fill="none" stroke="#f0dc9a" stroke-opacity=".75" stroke-width="2" stroke-dasharray="9 7"/><rect x="-42" y="${bandY - 20}" width="1284" height="${bandH + 40}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.4" stroke-dasharray="9 7"/>`;
  const bandTxt = (t, x, rot) => `<text transform="translate(${x} ${cy}) rotate(${rot})" text-anchor="middle" font-family="'Barlow Condensed',sans-serif" font-weight="800" font-size="12" letter-spacing="2.2" fill="#2f8a4a" opacity=".9">${t}</text>`;
  return `<svg class="lv-field" viewBox="${VX} ${VY} ${VW} ${VH}" role="img" aria-label="Football field">
    <rect x="${VX}" y="${VY}" width="${VW}" height="${VH}" rx="16" fill="#2b7d47"/>
    ${dashes}${bench(A, true)}${bench(H, false)}
    <rect x="${bandX}" y="${bandY}" width="${bandW}" height="${bandH}" fill="#f6f7f4"/>${bandTxt('IT TAKES ALL OF US', -10, -90)}${bandTxt('CHOOSE LOVE', 1210, 90)}
    ${stripes}${ezOf(0, A, -90, 0)}${ezOf(1100, H, 90, 0)}
    <g class="lv-lines">${lines}${hashes}</g>
    <g class="lv-nums" fill="#fff" fill-opacity=".92">${nums}</g>
    <image href="${logoUrl(home)}" x="${lvX(50) - 90}" y="${cy - 90}" width="180" height="180" opacity=".92" preserveAspectRatio="xMidYMid meet"/>
    ${pylons}${post(4, 1)}${post(1196, -1)}
    <rect id="lvLos" y="${LV_PAD}" width="4" height="${LV_FH}" fill="#4aa8ff" opacity="0"/><rect id="lvFd" y="${LV_PAD}" width="4" height="${LV_FH}" fill="#ffd23d" opacity="0"/>
    <g id="lvActors"></g><g id="lvFx"></g></svg>`;
}

/* ---------- actors and formations ---------- */
// role -> [u, v]: u = yards from the line of scrimmage (towards the end zone the offense attacks), v = lateral yards
const LV_OFF = { OL1: [-0.6, -4], OL2: [-0.6, -2], OL3: [-0.6, 0], OL4: [-0.6, 2], OL5: [-0.6, 4], TE: [-0.6, 6.4], QB: [-4.4, 0], RB: [-5.2, 2.6], WR1: [-0.4, -21], WR2: [-0.4, 22], WR3: [-1.3, -11] };
const LV_DEF = { DL1: [1.1, -3.5], DL2: [1.1, -1.2], DL3: [1.1, 1.2], DL4: [1.1, 3.5], LB1: [4.5, -6], LB2: [4.5, 0], LB3: [4.5, 6], CB1: [6.6, -21], CB2: [6.6, 21], S1: [12, -7], S2: [12, 8] };
const LV_ME = { QB: 'QB', RB: 'RB', WR: 'WR1', TE: 'TE', OL: 'OL2', DL: 'DL2', LB: 'LB2', CB: 'CB1', S: 'S1', K: 'K' };

function lvScene(play, ctx) {
  const meOff = ['QB', 'RB', 'WR', 'TE', 'OL', 'K'].includes(S.player.pos), myRole = LV_ME[S.player.pos];
  const offIsMe = play.off === 'me', dir = offIsMe ? ctx.myDir : -ctx.myDir, los = dir === 1 ? play.los : 100 - play.los;
  const P = (u, v) => ({ x: lvX(los + dir * u), y: lvY(v) });
  const offCol = TEAM[offIsMe ? ctx.myId : ctx.oppId].c1, defCol = TEAM[offIsMe ? ctx.oppId : ctx.myId].c1;
  return { dir, los, P, offCol, defCol, offIsMe, myRole, meOff, meOnField: offIsMe ? meOff : !meOff };
}
function lvMakeActors(sc, play) {
  const g = document.getElementById('lvActors'); g.innerHTML = '';
  const kick = play.kind === 'fg' || play.kind === 'xp';
  const offLayout = { ...LV_OFF }, defLayout = { ...LV_DEF };
  if (kick) {                                       // field-goal unit: line of scrimmage, holder and kicker; the defense rushes
    Object.assign(offLayout, { OL1: [-0.6, -5.2], OL2: [-0.6, -3.2], OL3: [-0.6, -1.2], OL4: [-0.6, 1.2], OL5: [-0.6, 3.2], TE: [-0.6, 5.2], QB: [-7, 0.4], RB: [-0.6, -7.2], WR1: [-0.6, 7.2], WR2: [-0.6, -9.2], WR3: [-0.6, 9.2], K: [-8.4, -1.6] });
    delete offLayout.RB; offLayout.RB = [-0.6, -7.2]; offLayout.K = [-8.4, -1.6];
    Object.assign(defLayout, { DL1: [1.1, -5.4], DL2: [1.1, -2.2], DL3: [1.1, 0], DL4: [1.1, 2.2], LB1: [1.1, 5.4], LB2: [1.1, -8], LB3: [1.1, 8], CB1: [3, -10], CB2: [3, 10], S1: [10, -3], S2: [10, 3] });
  }
  const actors = {}, mk = (role, off) => {
    const [u, v] = (off ? offLayout : defLayout)[role], p = sc.P(u, v), isMe = sc.meOnField && off === sc.meOff && role === sc.myRole;
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'g'); el.setAttribute('class', 'lv-pl' + (isMe ? ' me' : ''));
    el.innerHTML = `<circle r="${isMe ? 12.5 : 9.5}" fill="${off ? sc.offCol : sc.defCol}" stroke="${isMe ? '#ffd23d' : '#fff'}" stroke-width="${isMe ? 3.5 : 2}"/>` + (isMe ? `<text y="3.6" text-anchor="middle" class="lv-pn">${playerNumber()}</text>` : '');
    g.appendChild(el); actors[role + (off ? '' : '_d')] = { el, x: p.x, y: p.y, id: role + (off ? '' : '_d'), role, off, isMe };
    el.setAttribute('transform', `translate(${p.x} ${p.y})`);
  };
  Object.keys(offLayout).forEach(r => mk(r, true)); Object.keys(defLayout).forEach(r => mk(r, false));
  if (!kick) { /* the 11th offensive man: K does not exist in a normal formation */ }
  const ball = document.createElementNS('http://www.w3.org/2000/svg', 'g'); ball.setAttribute('class', 'lv-ball');
  ball.innerHTML = '<ellipse class="sh" rx="7" ry="3.4" cy="6" fill="#000" opacity=".3"/><ellipse class="b" rx="7.5" ry="4.6" fill="#8a4b1f" stroke="#fff" stroke-width="1.2"/><line x1="-2.5" x2="2.5" stroke="#fff" stroke-width="1"/>';
  g.appendChild(ball);
  const bp = sc.P(kick ? -7 : -0.6, kick ? 0.4 : 0); actors.ball = { el: ball, x: bp.x, y: bp.y, id: 'ball', ball: true };
  ball.setAttribute('transform', `translate(${bp.x} ${bp.y})`);
  // your player's name tag
  const me = Object.values(actors).find(a => a.isMe);
  if (me) { const tag = document.createElementNS('http://www.w3.org/2000/svg', 'text'); tag.setAttribute('class', 'lv-tag'); tag.textContent = surname(S.player.name).toUpperCase(); tag.setAttribute('text-anchor', 'middle'); g.appendChild(tag); actors.tag = { el: tag, follow: me.id, tag: true, x: me.x, y: me.y }; }
  return actors;
}

/* ---------- tiny timeline engine: move(actor, to, t0, t1), follow(ball, actor, t0, t1) ---------- */
function lvTimeline(actors) {
  const steps = [], cur = {}; Object.values(actors).forEach(a => { cur[a.id] = { x: a.x, y: a.y }; });
  const at = (id, t) => {
    const list = steps.filter(s => s.a === id).sort((a, b) => a.t0 - b.t0); let p = actors[id] ? { x: actors[id].x, y: actors[id].y, z: 0 } : { x: 0, y: 0, z: 0 };
    for (const s of list) {
      if (t < s.t0) break;
      if (s.follow) { const q = at(s.follow, Math.min(t, s.t1)); p = { x: q.x + (s.dx || 0), y: q.y + (s.dy || 0), z: 0 }; continue; }
      const k = clamp((t - s.t0) / Math.max(0.001, s.t1 - s.t0), 0, 1), e = s.linear ? k : k * k * (3 - 2 * k);
      p = { x: s.from.x + (s.to.x - s.from.x) * e, y: s.from.y + (s.to.y - s.from.y) * e, z: s.arc ? 4 * s.arc * k * (1 - k) : 0 };
    }
    return p;
  };
  const T = {
    move(id, to, t0, t1, o = {}) { const from = cur[id]; steps.push({ a: id, t0, t1, from, to, ...o }); cur[id] = { x: to.x, y: to.y }; },
    follow(id, other, t0, t1, dx = 0, dy = 0) { steps.push({ a: id, t0, t1, follow: other, dx, dy }); const q = at(other, t1); cur[id] = { x: q.x + dx, y: q.y + dy }; },
    pos: id => ({ ...cur[id] }),
    posAt: at,
    end: 0,
    render(t) {
      Object.values(actors).forEach(a => {
        if (a.tag) { const p = at(a.follow, t); a.el.setAttribute('x', p.x); a.el.setAttribute('y', p.y - 20); return; }
        const p = at(a.id, t);
        if (a.ball) { a.el.setAttribute('transform', `translate(${p.x} ${p.y - p.z}) scale(${1 + p.z / 90})`); a.el.querySelector('.sh').setAttribute('cy', 6 + p.z * 0.9); a.el.querySelector('.sh').setAttribute('opacity', Math.max(0.1, 0.3 - p.z / 300)); }
        else a.el.setAttribute('transform', `translate(${p.x} ${p.y})`);
      });
    },
  };
  return T;
}

/* ---------- play templates ---------- */
function lvPlayScript(play, sc, A, T) {
  const { P, dir } = sc, me = sc.myRole, ballId = 'ball';
  const to = (u, v) => P(u, v), tackleAll = (ids, p, t0, t1) => ids.forEach((id, i) => T.move(id, { x: p.x + dir * (-3 - i * 3), y: p.y + (i % 2 ? 9 : -9) * (i ? 1 : 0.4) }, t0, t1));
  const rec = r => A[r] ? r : 'WR2', result = { dur: 4, text: '', fx: [] };
  const offIds = Object.keys(LV_OFF), defKeys = Object.keys(LV_DEF);
  const crowd = (end, exclude = []) => defKeys.filter(k => !exclude.includes(k)).sort((a, b) => Math.hypot(T.pos(a + '_d').x - end.x, T.pos(a + '_d').y - end.y) - Math.hypot(T.pos(b + '_d').x - end.x, T.pos(b + '_d').y - end.y)).slice(0, 3);
  const pocket = (t1 = 1) => { ['OL1', 'OL2', 'OL3', 'OL4', 'OL5'].forEach(r => { const q = LV_OFF[r]; T.move(r, to(q[0] - 1.6, q[1] * 0.92), 0.15, t1); }); ['DL1', 'DL2', 'DL3', 'DL4'].forEach(r => { const q = LV_DEF[r]; T.move(r + '_d', to(q[0] - 0.4, q[1] * 0.9), 0.15, t1); }); };
  const sideV = r => LV_OFF[r][1];
  const meDefRole = ['DL', 'LB', 'CB', 'S'].includes(S.player.pos) ? LV_ME[S.player.pos] : null;
  const k = play.kind;
  /* a pass to a receiver (the target is you if you are WR/TE/RB, otherwise a teammate) */
  const passTo = (target, air, yac, res, defRole) => {
    const tv = sideV(target) * 0.5, dId = defRole + '_d';
    T.move('QB', to(-7.6, 0.4), 0, 1.0); pocket(1.1);
    T.move(target, to(air * 0.55, sideV(target) * 0.75), 0, 0.85); T.move(target, to(air, tv), 0.85, 1.85);
    T.move(dId, to(air - 0.6, tv + (defRole === meDefRole ? 0.5 : 1)), 0.1, 1.9);
    offIds.filter(r => ['WR1', 'WR2', 'WR3', 'TE'].includes(r) && r !== target).forEach((r, i) => T.move(r, to(7 + i * 3, sideV(r) * 0.8), 0, 2));
    T.move('RB', to(-4, sideV('RB') * 1.4), 0, 1.2);
    T.follow(ballId, 'QB', 0, 1.0, 0, 0);
    let end = to(air, tv), t = 1.85;
    if (res === 'comp') {
      T.move(ballId, T.posAt(target, 1.85), 1.0, 1.85, { arc: 40 + air * 2.4 }); T.follow(ballId, target, 1.85, 6, 0, 0);
      if (yac > 0) { end = to(air + yac, tv + (rnd() - 0.5) * 3); T.move(target, end, 1.85, 1.85 + 0.35 + yac * 0.075); t = 1.85 + 0.35 + yac * 0.075; }
      const ends = crowd(end).concat([defRole]).filter((x, i, a) => a.indexOf(x) === i).slice(0, 3); ends.forEach((r, i) => T.move(r + '_d', { x: end.x + dir * (-1.2 - i * 2.2) + (i ? 0 : 0), y: end.y + (i % 2 ? 8 : -6) * (i ? 1 : 0.5) }, Math.max(1.9, t - 1), t + 0.25));
      result.dur = t + 0.9; result.end = end;
    } else if (res === 'inc') {
      const land = to(air + 2.4, tv + 1.6); T.move(ballId, land, 1.0, 1.9, { arc: 46 + air * 2 }); T.move(ballId, to(air + 3.4, tv + 2.4), 1.9, 2.3, { arc: 8 }); result.dur = 3.0; result.end = land; result.fx.push({ t: 1.95, p: land, text: 'INCOMPLETE', cls: 'bad' });
    } else if (res === 'pd') {
      const land = to(air, tv); T.move(ballId, land, 1.0, 1.85, { arc: 46 + air * 2 }); T.move(ballId, to(air + 1.5, tv - 6), 1.85, 2.4, { arc: 38 }); result.dur = 3.2; result.end = land; result.fx.push({ t: 1.9, p: land, text: 'PASS BREAKUP', cls: 'good' });
    } else if (res === 'int') {
      const dEnd = to(air, tv), retU = play.td ? -(play.los + 3) : air - (play.yards || 0);
      T.move(ballId, dEnd, 1.0, 1.85, { arc: 46 + air * 2 }); T.follow(ballId, dId, 1.85, 8);
      const rp = to(retU, tv + (play.td ? 0 : 3)); T.move(dId, rp, 1.9, 1.9 + 0.6 + Math.abs(retU - air) * 0.06);
      ['QB', target].forEach((r, i) => T.move(r, to(retU + 1 + i, tv * 0.5 + i * 2), 2, 2 + 0.7 + Math.abs(retU - air) * 0.06));
      result.dur = 2.0 + 0.9 + Math.abs(retU - air) * 0.06; result.end = rp; result.fx.push({ t: 1.95, p: dEnd, text: play.td ? 'PICK SIX!' : 'INTERCEPTION', cls: 'good' });
    }
    return end;
  };
  const rushPlay = (carrier, yards, td) => {
    const holeV = (rnd() - 0.5) * 6;
    pocket(0.5); ['OL1', 'OL2', 'OL3', 'OL4', 'OL5'].forEach(r => T.move(r, to(1.4, LV_OFF[r][1]), 0.5, 1.4)); ['DL1', 'DL2', 'DL3', 'DL4'].forEach(r => T.move(r + '_d', to(2.8 + Math.max(0, yards) * 0.2, LV_DEF[r][1]), 0.5, 1.7));
    offIds.filter(r => ['WR1', 'WR2', 'WR3'].includes(r)).forEach((r, i) => T.move(r, to(5 + i * 2, sideV(r) * 0.9), 0, 2));
    if (carrier === 'QB') { T.move('QB', to(-3, 0), 0, 0.5); T.follow(ballId, 'QB', 0, 9); T.move('QB', to(0.5, holeV), 0.5, 1.15); T.move('QB', to(yards, holeV + (rnd() - 0.5) * 4), 1.15, 1.15 + 0.45 + Math.abs(yards) * 0.07); }
    else {
      T.follow(ballId, 'QB', 0, 0.45); T.move('QB', to(-4.4, 0.8), 0, 0.5); T.move(ballId, T.posAt('RB', 0.55), 0.45, 0.6); T.follow(ballId, carrier, 0.6, 9);
      T.move(carrier, to(-3.2, 1.8), 0, 0.55); T.move(carrier, to(0.6, holeV), 0.55, 1.2); T.move(carrier, to(yards, holeV + (rnd() - 0.5) * 4), 1.2, 1.2 + 0.4 + Math.abs(yards) * 0.07);
    }
    const t = 1.2 + 0.45 + Math.abs(yards) * 0.07, end = to(yards, holeV);
    crowd(end).forEach((r, i) => T.move(r + '_d', { x: end.x + dir * (-1.6 - i * 2), y: end.y + (i % 2 ? 8 : -7) * (i ? 1 : 0.5) }, 1.0, t + 0.2)); result.dur = t + 0.9; result.end = end;
    return end;
  };
  const sackPlay = (rusher, loss) => {
    T.move('QB', to(-7.2, 0.4), 0, 0.9); pocket(0.9); T.follow(ballId, 'QB', 0, 9);
    ['OL1', 'OL2', 'OL3', 'OL4', 'OL5'].forEach(r => T.move(r, to(-1.9, LV_OFF[r][1] * 0.9), 0.15, 1.0));
    const q = to(-7.2 - Math.abs(loss) + 4.4, 0.4); T.move('QB', q, 0.9, 1.9); T.move(rusher + '_d', to(-7.4 - Math.abs(loss) + 4.4, 0.7), 0.2, 1.7);
    result.dur = 3.1; result.end = q; result.fx.push({ t: 1.7, p: q, text: 'SACK', cls: 'good' });
  };
  const passerTarget = () => ['WR1', 'WR2', 'WR3', 'TE'].filter(r => r !== (['WR', 'TE'].includes(S.player.pos) ? LV_ME[S.player.pos] : '')).sort(() => rnd() - 0.5)[0];
  const anyDef = pickRole => pickRole;
  switch (k) {
    case 'catch': { const target = LV_ME[S.player.pos] === 'RB' ? 'RB' : LV_ME[S.player.pos]; const y = Math.max(0, play.yards), air = play.td ? Math.max(1, Math.round(y * rr(0.35, 0.8))) : Math.round(y * rr(0.4, 0.85)); passTo(target, Math.max(0.5, air), Math.max(0, y - air), 'comp', pick(['CB1', 'CB2', 'LB2', 'S1'])); result.text = `${play.td ? 'TOUCHDOWN — ' : ''}${y}-yard catch`; break; }
    case 'incomplete': passTo(LV_ME[S.player.pos], Math.round(rr(6, 20)), 0, 'inc', pick(['CB1', 'CB2', 'S1'])); result.text = play.drop ? 'Pass hits your hands — dropped' : 'Pass falls incomplete'; break;
    case 'qbPass': { const t = passerTarget(), y = Math.max(0, play.yards), air = Math.max(1, Math.round(y * rr(0.5, 0.9))); passTo(t, air, Math.max(0, y - air), 'comp', pick(['CB1', 'CB2', 'LB2', 'S1'])); result.text = `${play.td ? 'TOUCHDOWN — ' : ''}${y}-yard completion`; break; }
    case 'qbInc': passTo(passerTarget(), Math.round(rr(6, 22)), 0, 'inc', pick(['CB1', 'CB2'])); result.text = 'Pass falls incomplete'; break;
    case 'qbInt': passTo(passerTarget(), Math.round(rr(8, 22)), 0, 'int', pick(['CB1', 'CB2', 'S1'])); result.text = 'INTERCEPTED'; break;
    case 'rush': rushPlay('RB' === LV_ME[S.player.pos] || S.player.pos === 'RB' ? 'RB' : LV_ME[S.player.pos], play.yards, play.td); result.text = `${play.td ? 'TOUCHDOWN — ' : ''}${play.yards}-yard run`; break;
    case 'qbRush': rushPlay('QB', play.yards, play.td); result.text = `${play.td ? 'TOUCHDOWN — ' : ''}${play.yards}-yard scramble`; break;
    case 'pancake': { rushPlay('RB', play.yards, false); T.move('DL2_d', to(3.8 + play.yards * 0.15, LV_DEF.DL2[1] + 0.5), 0.55, 1.5); T.move(me, to(2.6, LV_OFF[me] ? LV_OFF[me][1] : -2), 0.55, 1.5); result.fx.push({ t: 1.3, p: T.pos('DL2_d'), text: 'PANCAKE!', cls: 'good', sticky: true }); result.text = 'Pancake block springs a run'; break; }
    case 'block': { rushPlay('RB', play.yards, false); T.move(me, to(1.6, LV_OFF[me][1]), 0.5, 1.2); result.text = `Solid block — ${play.yards}-yard gain`; break; }
    case 'pressure': { passTo('WR2', 12, 0, 'inc', 'CB1'); T.move('DL2_d', to(-5.2, LV_OFF[me] ? LV_OFF[me][1] + 3 : 1), 0.2, 1.0); result.fx.push({ t: 1.0, p: T.pos('DL2_d'), text: 'PRESSURE', cls: 'bad' }); result.text = 'Defender beats you — QB hurried'; break; }
    case 'sackAllowed': sackPlay('DL2', play.yards); result.text = 'Sack allowed'; break;
    case 'penalty': { rushPlay('RB', 3, false); result.fx.push({ t: 1.0, p: T.pos('QB'), text: '🚩 FLAG', cls: 'bad' }); result.text = `Penalty on you (${Math.abs(play.yards)} yds)`; break; }
    case 'sack': sackPlay(LV_ME[S.player.pos], play.yards); result.text = play.half ? 'Shared sack' : 'SACK!'; break;
    case 'tackle': {
      const y = Math.max(-1, play.yards); const end = play.pass ? passTo('WR2', Math.max(1, y - 2), 2, 'comp', pick(['CB2', 'S2'])) : rushPlay('RB', y, false);
      const ids = [LV_ME[S.player.pos] + '_d'].concat(play.solo ? [] : [pick(['LB1', 'LB3', 'S2']) + '_d']);
      const tEnd = (result.dur || 3) - 0.7; ids.forEach((id, i) => T.move(id, { x: end.x + dir * (-0.8 - i * 1.6), y: end.y + (i ? 8 : -5) * (i ? 1 : 0.6) }, Math.max(1.2, tEnd - 1), tEnd));
      result.fx.push({ t: tEnd, p: end, text: play.solo ? 'TACKLE' : 'ASSISTED TACKLE', cls: 'good' });
      if (play.ff) { result.fx.push({ t: tEnd + 0.2, p: end, text: 'FORCED FUMBLE!', cls: 'good' }); T.move(ballId, { x: end.x + dir * 36, y: end.y - 18 }, tEnd, tEnd + 0.5, { arc: 22 }); }
      result.text = `${play.solo ? 'Tackle' : 'Assisted tackle'} for ${y >= 0 ? y : 'a loss of ' + Math.abs(y)}${y >= 0 ? ' yards' : ''}${play.ff ? ' — fumble forced' : ''}`; break;
    }
    case 'int': passTo('WR2', Math.round(rr(8, 18)), 0, 'int', LV_ME[S.player.pos]); result.text = play.td ? 'PICK SIX!' : 'INTERCEPTION'; break;
    case 'pd': passTo('WR2', Math.round(rr(7, 18)), 0, 'pd', LV_ME[S.player.pos]); result.text = 'Pass broken up'; break;
    case 'frec': { const end = rushPlay('RB', 3, false); T.move(ballId, { x: end.x + dir * 40, y: end.y - 12 }, 1.9, 2.5, { arc: 20 }); T.follow(ballId, LV_ME[S.player.pos] + '_d', 2.5, 9); T.move(LV_ME[S.player.pos] + '_d', { x: end.x + dir * 40, y: end.y - 12 }, 1.8, 2.5); const out = P(play.td ? -(play.los + 2) : 6, 0); T.move(LV_ME[S.player.pos] + '_d', out, 2.6, 3.8); result.dur = 4.3; result.fx.push({ t: 2.3, p: end, text: 'FUMBLE RECOVERED', cls: 'good' }); result.text = play.td ? 'Fumble recovery — TOUCHDOWN' : 'Fumble recovered'; break; }
    case 'fg': case 'xp': {
      const kicker = A.K, snapT = 0.5;
      T.move(ballId, T.pos('QB'), 0, snapT, { arc: 4 }); T.follow(ballId, 'QB', snapT, 1.2); T.move('K', to(-6.4, -0.8), 0.7, 1.3); T.move('QB', to(-6.9, 0.2), 0.3, 0.6);
      ['DL1', 'DL2', 'DL3', 'DL4', 'LB1', 'LB3'].forEach((r, i) => T.move(r + '_d', to(0.2, LV_DEF[r][1] * 0.9), 0.9, 1.4));
      const goalAbs = dir === 1 ? 110 : -10, kx = lvX(sc.los - dir * 7), endX = lvX(goalAbs), made = play.made;
      const spot = P(-7, 0.4), endY = lvY(made ? 0.3 : (rnd() < 0.5 ? -4.6 : 4.6)), far = { x: endX, y: endY };
      T.move(ballId, far, 1.3, 2.7, { arc: 70 }); result.dur = 3.9; result.end = far;
      result.fx.push({ t: 2.6, p: { x: 600, y: lvY(-2) }, text: made ? (k === 'xp' ? 'EXTRA POINT GOOD' : `FIELD GOAL GOOD — ${play.yards} YDS`) : `NO GOOD — ${play.yards} YDS`, cls: made ? 'good' : 'bad', sticky: true });
      result.text = made ? (k === 'xp' ? 'Extra point is good' : `${play.yards}-yard field goal is GOOD`) : `${play.yards}-yard field goal is NO GOOD`; break;
    }
  }
  if (play.td) result.fx.push({ t: Math.max(0, result.dur - 1.1), p: result.end || P(0, 0), text: 'TOUCHDOWN!', cls: 'td', sticky: true });
  if (play.td) result.dur += 1.1;
  return result;
}

/* ---------- player (the viewer) ---------- */
function lvStatLine(T) { const cfg = POS[S.player.pos], lines = cfg.line(T); return lines.map(l => `<div><b>${esc(String(l.v == null ? 0 : (typeof l.v === 'string' || Number.isInteger(l.v) ? l.v : fmt1(l.v))))}</b><span>${l.l}</span></div>`).join(''); }

function lvScoreboardHTML(L) {
  const a = TEAM[L.away], h = TEAM[L.home];
  const tm = (t, side) => `<div class="lv-team ${side}" data-side="${side}"><img src="${logoUrl(t.id)}" alt=""><div><b>${t.id}</b><small>${esc(t.nick)}</small></div><div class="lv-score" id="lvScore_${side}">0</div><i class="lv-poss" id="lvPoss_${side}">🏈</i></div>`;
  return `<div class="lv-board">${tm(a, 'away')}<div class="lv-mid"><div class="lv-q" id="lvQ">1ST</div><div class="lv-clock" id="lvClock">15:00</div></div>${tm(h, 'home')}</div>`;
}

async function openLiveGame(game, notes, season) {
  const myId = game.tm, oppId = game.opp, away = game.home ? oppId : myId, home = game.home ? myId : oppId, P = S.player;
  const myDir = game.home ? -1 : 1;                          // away team attacks to the right, home team to the left
  const L = { game, away, home, myId, oppId, myDir, score: { away: 0, home: 0 }, T: {}, token: ++LV.run, skipped: false, speed: LV.speed || 1 };
  POS[P.pos].stats.forEach(x => { L.T[x.k] = 0; });
  const ov = document.createElement('div'); ov.className = 'lv-overlay'; ov.id = 'lvOverlay'; ov.style.cssText = `${themeVars(myId)}`;
  const label = game.k === 'PO' ? (game.round || 'PLAYOFFS') : `WEEK ${game.wk}`;
  ov.innerHTML = `<div class="lv-wrap">
    <div class="lv-top"><span class="lv-live"><i></i>LIVE</span><b>${label}</b><span class="muted">${TEAM[away].name} @ ${TEAM[home].name}</span><div class="lv-ctrl"><button class="mini on" data-lv-speed="1">1×</button><button class="mini" data-lv-speed="2">2×</button><button class="mini" data-lv-speed="4">4×</button><button class="btn btn-ghost btn-sm" id="lvSkip">SKIP ▸</button></div></div>
    ${lvScoreboardHTML(L)}
    <div class="lv-stage">${lvFieldSVG(away, home)}<div class="lv-banner" id="lvBanner"></div></div>
    <div class="lv-bottom">
      <div class="lv-info card"><div class="lv-dd" id="lvDD">Kickoff</div><div class="lv-text" id="lvText">${game.st === 'OUT' ? (game.dnp ? "You are not active today — you'll follow the game from the sideline." : 'You are out with an injury — you follow the game from the sideline.') : 'Watching every snap you are part of…'}</div></div>
      <div class="lv-me card"><div class="lv-me-h">${esc(P.name)} · ${P.pos} · #${playerNumber()}</div><div class="lv-tiles" id="lvTiles"></div></div>
      <div class="lv-log card" id="lvLog"></div>
    </div></div>`;
  document.body.appendChild(ov);
  const $ = id => document.getElementById(id), setScore = () => { $('lvScore_away').textContent = L.score.away; $('lvScore_home').textContent = L.score.home; };
  const setClock = (q, clock) => { $('lvQ').textContent = ['1ST', '2ND', '3RD', '4TH'][q - 1]; $('lvClock').textContent = clock; };
  const sleep = ms => new Promise(r => { const t = setTimeout(r, ms / L.speed); L.waits = L.waits || []; L.waits.push(() => { clearTimeout(t); r(); }); });
  const alive = () => LV.run === L.token && document.getElementById('lvOverlay') && !L.skipped;
  const log = (q, clock, text, cls = '') => { const el = $('lvLog'); if (!el) return; el.insertAdjacentHTML('afterbegin', `<div class="lv-row ${cls}"><em>Q${q} ${clock}</em><span>${text}</span></div>`); };
  const tiles = () => { const el = $('lvTiles'); if (el) el.innerHTML = lvStatLine(L.T); };
  tiles();
  ov.querySelectorAll('[data-lv-speed]').forEach(b => b.addEventListener('click', () => { L.speed = Number(b.dataset.lvSpeed); LV.speed = L.speed; ov.querySelectorAll('[data-lv-speed]').forEach(x => x.classList.toggle('on', x === b)); }));
  const finish = () => {
    if (L.finished) return; L.finished = true; L.skipped = true; (L.waits || []).splice(0).forEach(f => f()); if (L.cancelAnim) L.cancelAnim();
    const el = document.getElementById('lvOverlay'); if (el) el.remove();
    if (game.st !== 'OUT') { /* the box score is the truth */ }
    LV.done && LV.done();
  };
  $('lvSkip').addEventListener('click', () => { L.skipped = true; (L.waits || []).splice(0).forEach(f => f()); if (L.cancelAnim) L.cancelAnim(); finalScreen(true); });
  const poss = side => { ['away', 'home'].forEach(s2 => { const e = $('lvPoss_' + s2); if (e) e.style.opacity = s2 === side ? 1 : 0; }); };
  const sideOf = who => (who === 'me') === !!game.home ? 'home' : 'away';
  const bumpScore = side => { const el = $('lvScore_' + side); if (el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } };
  const banner = async (text, cls, ms = 1500) => { const b = $('lvBanner'); if (!b || b.classList.contains('final')) return; b.className = 'lv-banner show ' + cls; b.textContent = text; await sleep(ms); if (b && !b.classList.contains('final')) b.className = 'lv-banner'; };
  const finalScreen = (skipped) => {
    L.score = { away: game.home ? game.op : game.my, home: game.home ? game.my : game.op }; setScore();
    const el = document.getElementById('lvOverlay'); if (!el) return finish();
    const win = game.w; POS[P.pos].stats.forEach(x => { L.T[x.k] = (game.s || {})[x.k] || 0; }); tiles(); setClock(4, '0:00');
    const b = $('lvBanner'); if (b) { b.className = `lv-banner show final ${win ? 'good' : 'bad'}`; b.innerHTML = `<small>FINAL</small>${win ? 'VICTORY' : 'DEFEAT'}<span>${TEAM[away].id} ${L.score.away} — ${L.score.home} ${TEAM[home].id}</span><button class="btn btn-primary" id="lvDone">CONTINUE ▸</button>`; const d = $('lvDone'); if (d) d.addEventListener('click', finish); }
    const sk = $('lvSkip'); if (sk) sk.style.display = 'none'; Snd.play(win ? 'fanfare' : 'down');
    if (win) { const st = el.querySelector('.lv-stage') || el; burst(st, 70); setTimeout(() => burst(st, 50), 450); }   // team-colored confetti
  };
  /* ---- play the script ---- */
  await sleep(700);
  const script = lvBuild(game);
  for (const e of script) {
    if (!alive()) break;
    setClock(e.q, e.clock);
    if (e.type === 'score') {
      const side = sideOf(e.side); poss(side); L.score[side] += e.pts; setScore(); bumpScore(side);
      const t = TEAM[e.side === 'me' ? myId : oppId];
      log(e.q, e.clock, `${t.id} — ${e.label} (+${e.pts})`, e.side === 'me' ? 'good' : 'bad'); $('lvText').textContent = `${t.name}: ${e.label}`; $('lvDD').textContent = `${TEAM[away].id} ${L.score.away} – ${L.score.home} ${TEAM[home].id}`;
      Snd.play(e.side === 'me' ? 'cheer' : 'down'); await banner(`${t.id} ${e.label}`, e.side === 'me' ? 'good' : 'bad', 1300); await sleep(300);
      continue;
    }
    const p = e.play, sc = lvScene(p, { myDir, myId, oppId });
    poss(sideOf(p.off));
    const dd = p.kind === 'xp' ? 'Extra point' : p.kind === 'fg' ? `Field goal · ${p.yards} yds` : `${['', '1st', '2nd', '3rd', '4th'][p.down]} & ${p.dist}`;
    const spot = p.los < 50 ? `${TEAM[p.off === 'me' ? myId : oppId].id} ${p.los}` : (p.los === 50 ? 'Midfield' : `${TEAM[p.off === 'me' ? oppId : myId].id} ${100 - p.los}`);
    $('lvDD').textContent = `${dd} · ball on ${spot}`; $('lvText').textContent = '…';
    const A = lvMakeActors(sc, p), T = lvTimeline(A), res = lvPlayScript(p, sc, A, T);
    const los = $('lvLos'), fd = $('lvFd'), losX = lvX(sc.los) - 2;
    if (los) { los.setAttribute('x', lvX(sc.los) - 2); los.setAttribute('opacity', .9); }
    if (fd && p.kind !== 'fg' && p.kind !== 'xp') { fd.setAttribute('x', lvX(sc.dir === 1 ? sc.los + p.dist : sc.los) - 2 + (sc.dir === 1 ? 0 : 0)); const fdAbs = sc.dir === 1 ? Math.min(100, sc.los + p.dist) : Math.max(0, sc.los - p.dist); fd.setAttribute('x', lvX(fdAbs) - 2); fd.setAttribute('opacity', .85); } else if (fd) fd.setAttribute('opacity', 0);
    const fxLayer = $('lvFx'); fxLayer.innerHTML = ''; const pending = (res.fx || []).slice().sort((a, b) => a.t - b.t);
    Snd.play('whistle');
    await new Promise(resolve => {
      let start = null, raf = 0, last = 0;
      L.cancelAnim = () => { cancelAnimationFrame(raf); resolve(); };
      const frame = ts => {
        if (!alive()) return resolve();
        if (start === null) { start = ts; last = ts; }
        const t = ((ts - start) / 1000) * L.speed; T.render(t);
        while (pending.length && pending[0].t <= t) { const f = pending.shift(); const el = document.createElementNS('http://www.w3.org/2000/svg', 'text'); el.setAttribute('class', `lv-pop ${f.cls}${f.sticky ? ' sticky' : ''}`); el.setAttribute('x', Math.min(1090, Math.max(110, f.p.x))); el.setAttribute('y', Math.max(60, f.p.y - 28)); el.setAttribute('text-anchor', 'middle'); el.textContent = f.text; fxLayer.appendChild(el); Snd.play(f.cls === 'td' ? 'roar' : (f.cls === 'good' ? 'pick' : 'click')); }
        if (t >= res.dur) return resolve();
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });
    if (!alive()) break;
    T.render(res.dur);
    Object.entries(p.inc || {}).forEach(([k2, v]) => { L.T[k2] = (L.T[k2] || 0) + v; }); tiles();
    $('lvText').textContent = res.text;
    log(e.q, e.clock, `${res.text}`, p.td || ['pd', 'sack', 'int', 'frec', 'pancake', 'tackle'].includes(p.kind) && !p.td ? 'good' : (['incomplete', 'qbInc', 'qbInt', 'penalty', 'pressure', 'sackAllowed'].includes(p.kind) ? 'bad' : ''));
    if (p.pts) { const side = sideOf('me'); L.score[side] += p.pts; setScore(); bumpScore(side); log(e.q, e.clock, `${TEAM[myId].id} — ${p.kind === 'fg' ? 'FIELD GOAL' : p.kind === 'xp' ? 'EXTRA POINT' : 'TOUCHDOWN'} (+${p.pts})`, 'good'); if (p.td) await banner('TOUCHDOWN!', 'good', 1300); }
    await sleep(900);
  }
  if (alive()) { await sleep(500); finalScreen(false); } else if (!L.finished && !document.getElementById('lvDone')) finalScreen(true);
}

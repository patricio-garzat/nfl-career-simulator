/* =====================================================================
   LIVE GAME — watch the game on a small NFL field, snap by snap, for every play your player is part of.
   The game has already been simulated by playGame(); this file turns that result (score + the player's stat line) into a
   believable script of plays and animates each one. Whatever happens on the field always adds up to the real box score.
   ===================================================================== */
const LV = { speed: 1, run: 0 };
const LV_PACE = 0.65;                                        // plays unfold at this fraction of their scripted speed (smaller = slower, more like watching a real snap)
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
  NE: { bg: '#002244', ends: [[{ l: { k: 'team', x: -136, y: 0, w: 90, h: 90 } }, { l: { k: 'img', src: 'assets/nfl/patriots-wordmark-white.png', x: 55, y: 0, w: 250, h: 58 } }]] },   // white PATRIOTS wordmark + the logo, centered together on the team's navy
  NYJ: { bg: '#125740', ends: [[{ l: { k: 'img', src: 'assets/nfl/jets-white.png', x: 0, y: 0, w: 290, h: 91 } }]] },   // the Jets' own logo in white on green
  BAL: { bg: '#241773', ends: [[{ l: { k: 'img', src: 'assets/nfl/ravens-wordmark.png', x: 0, y: 0, w: 470, h: 66 } }]] },   // the Ravens' own wordmark on purple
  CIN: { bg: '#FB4F14', deco: 'tiger', ends: [[{ t: { s: 'BENGALS', f: '#000000', o: '#FFFFFF', w: 4.5, ff: 'Alfa Slab One', h: 42, n: 420 } }]] },
  CLE: { bg: null, ends: [[{ t: { s: 'BROWNS', f: '#F8F9F7', o: '#FF3C00', w: 3, ff: 'Saira Extra Condensed', fw: 800, h: 62, n: 280 } }], [{ t: { s: 'CLEVELAND', f: '#F8F9F7', o: '#FF3C00', w: 3, ff: 'Saira Extra Condensed', fw: 800, h: 62, n: 360 } }]] },
  PIT: { bg: null, ends: [[{ t: { s: 'PITTSBURGH', f: '#FFB612', o: '#101820', w: 3, ff: 'Archivo Black', h: 46, n: 340, x: -34 } }, { l: { k: 'nfl', x: 228, y: 0, w: 50 } }], [{ t: { s: 'STEELERS', f: '#FFB612', o: '#101820', w: 3, ff: 'Archivo Black', h: 46, n: 300, x: -34 } }, { l: { k: 'nfl', x: 228, y: 0, w: 50 } }]] },
  HOU: { bg: '#03202F', ends: [[{ t: { s: 'TEXANS', f: '#FFFFFF', o: '#A71930', w: 3.5, ff: 'Russo One', h: 60, n: 330 } }]] },
  IND: { bg: '#1A4FB0', ends: [[{ l: { k: 'img', src: 'assets/nfl/colts-wordmark.png', x: 0, y: 0, w: 250, h: 76, stretch: 1 } }]] },   // the COLTS wordmark in white on blue (stretched wide, as painted on a field)
  JAX: { bg: '#000000', op: 0.96, ends: [[{ l: { k: 'img', src: 'assets/nfl/jaguars-wordmark.png', x: 0, y: 0, w: 250, h: 76 } }]] },   // JACKSONVILLE JAGUARS on black
  TEN: { bg: null, ends: [[{ t: { s: 'TITANS', f: '#0C2340', o: '#FFFFFF', w: 5, ff: 'Russo One', h: 66, n: 480, sh: ['#4B92DB', 4, 4] } }]] },
  DEN: { bg: null, ends: [[{ t: { s: 'BRONCOS', f: '#FB4F14', o: '#FFFFFF', w: 4, ff: 'Russo One', h: 60, n: 360 } }]] },
  KC: { bg: '#FFB81C', ends: [[{ l: { k: 'img', src: 'assets/nfl/chiefs-wordmark.png', x: 0, y: 0, w: 315, h: 76 } }]] },   // CHIEFS wordmark, white outline, on gold
  LV: { bg: '#0A0A0A', ends: [[{ t: { s: 'Las Vegas', f: '#DADDE0', ff: 'Pacifico', h: 52, n: 340, cap: 0.62 } }, { x: 'spark', px: -170, py: -30, r: 12 }, { x: 'spark', px: 150, py: 28, r: 9 }, { x: 'spark', px: 205, py: -26, r: 7 }, { x: 'spark', px: -215, py: 26, r: 6 }], [{ t: { s: 'RAIDERS', f: '#A5ACAF', o: '#FFFFFF', w: 1.5, ff: 'Russo One', h: 64, n: 340 } }]] },
  LAC: { bg: '#0080C6', deco: 'band', ends: [[{ t: { s: 'CHARGERS', f: '#FFFFFF', ff: 'Russo One', h: 50, n: 330, x: 14, y: 4 } }, { x: 'bolt', px: -230, py: 6, r: 22 }], [{ t: { s: 'LOS ANGELES', f: '#FFFFFF', ff: 'Russo One', h: 46, n: 380, x: 14, y: 4 } }, { x: 'bolt', px: -230, py: 6, r: 22 }]] },
  DAL: { bg: '#1B3A8C', ends: [[{ t: { s: 'COWBOYS', f: '#A9B0B4', o: '#FFFFFF', w: 3, ff: 'Russo One', h: 60, n: 270, sh: ['#0B1F5A', 3, 3] } }, { l: { k: 'team', x: -215, y: 0, w: 82, g: 1 } }, { l: { k: 'team', x: 215, y: 0, w: 82, g: 1 } }]] },
  NYG: { bg: '#1E5FB5', ends: [[{ t: { s: 'GIANTS', f: '#FFFFFF', ff: 'Archivo Black', h: 66, n: 320, x: 20, sh: ['#0B2265', 4, 4] } }, { l: { k: 'team', x: -225, y: 0, w: 76 } }]] },
  PHI: { bg: '#00494F', ends: [[{ t: { s: 'EAGLES', f: '#EDF1F1', ff: 'Squada One', h: 72, n: 360 } }]] },
  WAS: { bg: null, ends: [[{ t: { s: 'COMMANDERS', f: '#5A1414', ff: 'Barlow Condensed', fw: 800, h: 46, n: 400 } }, { x: 'rule', py: -34, n: 430 }, { x: 'rule', py: 34, n: 430 }, { l: { k: 'team', x: -235, y: 0, w: 62 } }, { l: { k: 'team', x: 235, y: 0, w: 62 } }]] },
  CHI: { bg: null, ends: [[{ t: { s: 'CHICAGO', f: '#C83803', o: '#0B162A', w: 3, ff: 'Archivo Black', h: 56, n: 380 } }, { l: { k: 'nfc', x: -232, y: 8, w: 52 } }, { l: { k: 'nfl', x: 232, y: 8, w: 48 } }], [{ t: { s: 'BEARS', f: '#C83803', o: '#0B162A', w: 3, ff: 'Archivo Black', h: 60, n: 290 } }, { l: { k: 'nfc', x: -232, y: 8, w: 52 } }, { l: { k: 'nfl', x: 232, y: 8, w: 48 } }]] },
  DET: { bg: '#0076B6', ends: [[{ t: { s: 'LIONS', f: 'none', o: '#FFFFFF', w: 3, ff: 'Russo One', h: 66, n: 330 } }]] },
  GB: { bg: '#2E6B2E', op: 0.9, ends: [[{ t: { s: 'PACKERS', f: '#FFB612', o: '#FFFFFF', w: 3, ff: 'Alfa Slab One', h: 66, n: 340 } }], [{ t: { s: 'GREEN BAY', f: '#FFB612', o: '#FFFFFF', w: 3, ff: 'Alfa Slab One', h: 66, n: 410 } }]] },
  MIN: { bg: '#4F2683', ends: [[{ l: { k: 'img', src: 'assets/nfl/vikings-wordmark-white.png', x: 0, y: 0, w: 230, h: 73 } }]] },   // white VIKINGS wordmark, big and centered with margin, on the team's purple
  ATL: { bg: null, ends: [[{ l: { k: 'img', src: 'assets/nfl/falcons-atl.png', x: 0, y: 0, w: 240, h: 92 } }]] },   // the ATL logo on bare turf
  CAR: { bg: '#000000', op: 0.96, ends: [[{ l: { k: 'img', src: 'assets/nfl/panthers-wordmark.png', x: 0, y: 0, w: 302, h: 76 } }]] },   // PANTHERS script on black
  NO: { bg: '#D3BC8D', ends: [[{ l: { k: 'img', src: 'assets/nfl/saints-wordmark.png', x: 0, y: 0, w: 328, h: 76 } }]] },   // SAINTS in black on old gold
  TB: { bg: '#D50A0A', ends: [[{ l: { k: 'img', src: 'assets/nfl/buccaneers-wordmark.png', x: 0, y: 0, w: 274, h: 76 } }]] },   // BUCCANEERS in black with pewter shadow on red
  ARI: { bg: null, ends: [[{ l: { k: 'img', src: 'assets/nfl/cardinals-wordmark.png', x: 0, y: 0, w: 430, h: 92 } }]] },   // ARIZONA CARDINALS wordmark with a white outline on bare turf
  LAR: { bg: '#0B2A8A', ends: [[{ l: { k: 'img', src: 'assets/nfl/rams-wordmark.png', x: 0, y: 0, w: 340, h: 75 } }]] },   // the LA Rams wordmark on blue
  SF: { bg: null, ends: [[{ t: { s: '49ERS', f: '#AA0000', o: '#B3995D', w: 4, ff: 'Rye', h: 56, n: 300, cap: 0.7 } }, { l: { k: 'nfl', x: -235, y: 10, w: 48 } }, { l: { k: 'nfc', x: 235, y: 10, w: 52 } }]] },
  SEA: { bg: '#002244', ends: [[{ t: { s: 'SEAHAWKS', f: '#A5ACAF', o: '#FFFFFF', w: 1.5, ff: 'Graduate', h: 52, n: 330, x: -4 } }, { l: { k: 'nfl', x: -232, y: 0, w: 46 } }, { l: { k: 'team', x: 232, y: 0, w: 70 } }]] },
};
const lvSpark = (x, y, r) => `<path d="M${x} ${y - r}Q${x + r * 0.15} ${y - r * 0.15} ${x + r} ${y}Q${x + r * 0.15} ${y + r * 0.15} ${x} ${y + r}Q${x - r * 0.15} ${y + r * 0.15} ${x - r} ${y}Q${x - r * 0.15} ${y - r * 0.15} ${x} ${y - r}z" fill="#E8ECEF"/>`;
const lvBolt = (x, y, r) => `<path transform="translate(${x} ${y}) scale(${r / 22})" d="M-14 -30L10 -30L0 -8L16 -8L-10 30L-2 4L-16 4Z" fill="#FFC20E"/>`;
// every end zone's art keeps a margin from the white border: shrink the whole group if its extent goes past the safe box (232 px along the length, 38 px across the depth)
function lvEzScale(items) {
  let ex = 0, ey = 0;
  items.forEach(it => {
    if (it.t) { ex = Math.max(ex, Math.abs(it.t.x || 0) + it.t.n / 2); ey = Math.max(ey, Math.abs(it.t.y || 0) + it.t.h / 2 + (it.t.w || 0) / 2); }
    else if (it.l) { ex = Math.max(ex, Math.abs(it.l.x) + it.l.w / 2); ey = Math.max(ey, Math.abs(it.l.y) + (it.l.h || it.l.w) / 2); }
    else if (it.x === 'rule') { ex = Math.max(ex, it.n / 2); ey = Math.max(ey, Math.abs(it.py) + 2); }
    else if (it.px !== undefined) { ex = Math.max(ex, Math.abs(it.px) + it.r); ey = Math.max(ey, Math.abs(it.py) + it.r); }
  });
  return Math.min(1, 232 / (ex || 1), 38 / (ey || 1));
}
function lvEzItems(items, team) {
  const k = lvEzScale(items);
  return `<g transform="scale(${k.toFixed(3)})">${lvEzItemsRaw(items, team)}</g>`;
}
function lvEzItemsRaw(items, team) {
  return items.map(it => {
    if (it.t) {
      const t = it.t, cap = t.cap || 0.72, fs = t.h / cap, x = t.x || 0, y = (t.y || 0) + t.h / 2;
      const one = (dx, dy, fill, o, w) => `<text x="${x + dx}" y="${y + dy}" text-anchor="middle" textLength="${t.n}" lengthAdjust="spacingAndGlyphs" font-family="'${t.ff}',Impact,sans-serif" font-weight="${t.fw || 400}" font-size="${fs.toFixed(1)}" fill="${fill}"${o ? ` stroke="${o}" stroke-width="${w}" stroke-linejoin="round" paint-order="stroke"` : ''}${t.it ? ` transform="translate(${x} ${y}) skewX(-10) translate(${-x} ${-y})"` : ''}>${esc(t.s)}</text>`;
      return `<g opacity=".95">${t.sh ? one(t.sh[1], t.sh[2], t.sh[0], t.sh[0], (t.w || 0) + 1) : ''}${one(0, 0, t.f, t.o, t.w)}</g>`;
    }
    if (it.l) {
      const l = it.l, src = l.k === 'team' ? logoUrl(team.id) : l.k === 'nfl' ? NFL_LOGO : `https://a.espncdn.com/i/teamlogos/nfl/500/${l.k}.png`;   // afc / nfc from the ESPN CDN
      const lh = l.h || l.w; return `<image href="${l.src || src}" x="${l.x - l.w / 2}" y="${l.y - lh / 2}" width="${l.w}" height="${lh}" opacity=".95" preserveAspectRatio="${l.stretch ? 'none' : 'xMidYMid meet'}"${l.g ? ' style="filter:grayscale(1) brightness(1.25)"' : ''}/>`;
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
  const turf = `<rect x="${x}" y="${top}" width="100" height="${LV_FH}" fill="#2d8647"/>`;   // unpainted grass: a single flat green
  const paint = turf + (d.bg ? `<rect x="${x}" y="${top}" width="100" height="${LV_FH}" fill="${d.bg}" opacity="${d.op || 0.94}"/>` : '');
  const local = (d.deco === 'tiger' ? lvTiger() : '') + (d.deco === 'band' ? `<rect x="-270" y="-50" width="540" height="7" fill="#fff" opacity=".85"/>` : '')
    + (d.deco === 'sband' ? `<rect x="-270" y="-50" width="540" height="9" fill="#101010" opacity=".92"/><rect x="-270" y="-39" width="540" height="2" fill="#D3BC8D"/>` : '') + lvEzItems(items, team);
  const cid = 'lvEzC' + x;                                          // nothing may spill over the white border: clip to the end zone itself
  return `<defs><clipPath id="${cid}"><rect x="${x}" y="${top}" width="100" height="${LV_FH}"/></clipPath></defs><g clip-path="url(#${cid})">${paint}<g transform="translate(${cx} ${cy}) rotate(${rot})">${local}</g></g>`;
}

/* ---------- the field ---------- */
function lvFieldSVG(away, home, sb) {
  const A = TEAM[away], H = TEAM[home], top = LV_PAD, bot = LV_PAD + LV_FH, cy = lvY(0);
  // grass: a tile of tiny blades (fixed seed, so it never shimmers) drawn over the turf, the aprons and the end zones at low opacity
  const grassTile = (() => { let sd = 7; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647; let b = '';
    for (let i = 0; i < 46; i++) { const x = R() * 44, y = 6 + R() * 38, len = 3 + R() * 5, dx = (R() - 0.5) * 3, dark = R() < 0.55; b += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + dx).toFixed(1)}" y2="${(y - len).toFixed(1)}" stroke="${dark ? '#06240f' : '#c9f59a'}" stroke-opacity="${dark ? (0.10 + R() * 0.08).toFixed(2) : (0.06 + R() * 0.07).toFixed(2)}" stroke-width="${(0.7 + R() * 0.6).toFixed(1)}" stroke-linecap="round"/>`; }
    return `<pattern id="lvGrass" width="44" height="44" patternUnits="userSpaceOnUse">${b}</pattern>`; })();
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
  const NH = 22, GAP = 6, ARW = 10, FS = NH / 0.71, DW = 14;   // cap height 2 yd (drawn 1.5x), Special Gothic Condensed One; DW = width of one digit
  const pair = (n, X, y0, far) => {                                 // "3|0": the yard line runs between the digits and neither one touches it
    const yb = y0 + NH, g = `<text x="${X - GAP}" y="${yb}" text-anchor="end" font-size="${FS.toFixed(1)}">${n}</text><text x="${X + GAP}" y="${yb}" text-anchor="start" font-size="${FS.toFixed(1)}">0</text>`;
    return far ? `<g transform="rotate(180 ${X} ${y0 + NH / 2})">${g}</g>` : g;     // far-side numbers are turned so they read from the other sideline
  };
  const nums = [1, 2, 3, 4, 5, 4, 3, 2, 1].map((n, i) => {
    const X = lvX((i + 1) * 10), toLeft = i < 4, toRight = i > 4;
    const place = (y0, far) => {
      let g = pair(n, X, y0, far);
      const ay = y0 + NH / 2;
      if (toLeft) g += `<polygon points="${X - GAP - DW - 5 - ARW},${ay} ${X - GAP - DW - 5},${ay - 7} ${X - GAP - DW - 5},${ay + 7}"/>`;
      if (toRight) g += `<polygon points="${X + GAP + DW + 5 + ARW},${ay} ${X + GAP + DW + 5},${ay - 7} ${X + GAP + DW + 5},${ay + 7}"/>`;
      return g;
    };
    return place(bot - 120 - NH, false) + place(top + 120, true);
  }).join('');
  // end zones: the home team's real design, painted on BOTH ends
  const ezOf = (x, team, rot, end) => lvEndZone(x, team, rot, end);
  const pylon = (x, y) => `<rect x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" fill="#ff6a13" stroke="#fff" stroke-width="1"/>`;
  const pylons = [100, 1100, 0, 1200].map(x => pylon(Math.min(1198, Math.max(2, x)), top + 5) + pylon(Math.min(1198, Math.max(2, x)), bot - 5)).join('');
  const post = (x, d) => `<g stroke="#ffd23d" stroke-width="5" stroke-linecap="round" fill="none"><line x1="${x}" x2="${x}" y1="${lvY(-3.1)}" y2="${lvY(3.1)}"/><line x1="${x}" x2="${x + d * 9}" y1="${lvY(-3.1)}" y2="${lvY(-3.1)}"/><line x1="${x}" x2="${x + d * 9}" y1="${lvY(3.1)}" y2="${lvY(3.1)}"/></g>`;
  // everything outside the playing field, like the real thing: a white border band, the dashed coaches' box and each team's bench area with its logo
  const VX = -70, VY = -66, VW = 1340, VH = 685, bandX = -20, bandY = top - 20, bandW = 1240, bandH = LV_FH + 40;
  const bench = (team, outer) => {
    const x0 = lvX(25), x1 = lvX(75), y0 = outer ? bandY - 46 : bandY + bandH + 46, yn = outer ? bandY - 2 : bandY + bandH + 2, c = team.c1, mid = (x0 + x1) / 2, ly = (y0 + yn) / 2;
    const dark = lum(c) < 0.45;
    return `<polygon points="${x0 + 14},${y0} ${x1 - 14},${y0} ${x1},${yn} ${x0},${yn}" fill="${c}"/><image href="${logoUrl(team.id)}" x="${mid - 24}" y="${ly - 24}" width="48" height="48" opacity="${dark ? 1 : .95}" preserveAspectRatio="xMidYMid meet"/>`;
  };
  const dashes = `<rect x="-46" y="${bandY - 24}" width="1292" height="${bandH + 48}" fill="none" stroke="#f0dc9a" stroke-opacity=".75" stroke-width="2" stroke-dasharray="9 7"/><rect x="-42" y="${bandY - 20}" width="1284" height="${bandH + 40}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.4" stroke-dasharray="9 7"/>`;
  const bandTxt = (t, x, rot, dy = 0) => `<text transform="translate(${x} ${cy + dy}) rotate(${rot})" text-anchor="middle" font-family="'Barlow Condensed',sans-serif" font-weight="800" font-size="12" letter-spacing="2.2" fill="#2f8a4a" opacity=".9">${t}</text>`;
  return `<svg class="lv-field" viewBox="${VX} ${VY} ${VW} ${VH}" role="img" aria-label="Football field">
    <defs>${grassTile}</defs><rect x="${VX}" y="${VY}" width="${VW}" height="${VH}" rx="16" fill="#2b7d47"/><rect x="${VX}" y="${VY}" width="${VW}" height="${VH}" rx="16" fill="url(#lvGrass)"/>
    ${dashes}${bench(A, true)}${bench(H, false)}
    <rect x="${bandX}" y="${bandY}" width="${bandW}" height="${bandH}" fill="#f6f7f4"/>${bandTxt('IT TAKES ALL OF US', -10, -90, 135)}${bandTxt('CHOOSE LOVE', 1210, 90, -135)}
    ${stripes}${ezOf(0, A, -90, 0)}${ezOf(1100, H, 90, 0)}<rect x="0" y="${top}" width="1200" height="${LV_FH}" fill="url(#lvGrass)" pointer-events="none"/>
    <g class="lv-lines">${lines}${hashes}</g>
    <g class="lv-nums" fill="#fff" fill-opacity=".92">${nums}</g>
    ${sb ? `<image href="${NFL_LOGO}" x="${lvX(50) - 90}" y="${cy - 90}" width="180" height="180" opacity=".95" preserveAspectRatio="xMidYMid meet"/>${[20, 80].map(y => `<image href="super-bowl-trophy.png" x="${lvX(y) - 40}" y="${cy - 49}" width="80" height="98" opacity=".95" preserveAspectRatio="xMidYMid meet"/>`).join('')}`   // Super Bowl: the NFL shield at midfield, a small Lombardi trophy on each 20
      : `<image href="${logoUrl(home)}" x="${lvX(50) - 90}" y="${cy - 90}" width="180" height="180" opacity=".92" preserveAspectRatio="xMidYMid meet"/>`}
    ${pylons}${post(-10, 1)}${post(1210, -1)}
    <rect id="lvLos" y="${LV_PAD}" width="4" height="${LV_FH}" fill="#4aa8ff" opacity="0"/><rect id="lvFd" y="${LV_PAD}" width="4" height="${LV_FH}" fill="#ffd23d" opacity="0"/>
    <g id="lvActors"></g><g id="lvFx"></g></svg>`;
}

/* ---------- actors and formations ---------- */
// u = yards from the line of scrimmage towards the end zone the offense attacks, v = lateral yards (screen-down is positive)
const LV_ME = { QB: 'QB', RB: 'RB', WR: 'WR1', TE: 'TE', OL: 'OL2', DL: 'DL2', LB: 'LB2', CB: 'CB1', S: 'S1', K: 'K' };
const LV_PASS_KINDS = ['catch', 'incomplete', 'qbPass', 'qbInc', 'qbInt', 'pressure', 'sackAllowed', 'sack', 'int', 'pd'];
const LV_SN = 1.6;                                           // script seconds between breaking the huddle and the snap (the clock does not run during it)
const lvSgn = v => (v < 0 ? -1 : 1);
const lvLabel = role => role.replace(/\d+$/, '');

/* one formation plan per play: where each man lines up, the coverage, any pre-snap motion, and where everybody starts (the huddle / walking up) */
function lvPlan(play) {
  if (play._f) return play._f;
  const k = play.kind, kick = k === 'fg' || k === 'xp', pos = S.player.pos;
  const meDef = ['DL', 'LB', 'CB', 'S'].includes(pos) ? LV_ME[pos] : null;
  let pass = LV_PASS_KINDS.includes(k) || (k === 'tackle' && !!play.pass);
  if (k === 'tackle' && meDef === 'DL2') pass = false;           // an interior lineman makes his tackles against the run
  const F = (play._f = { kick, pass, off: {}, def: {}, pre: {}, hud: {}, dst: {}, mot: null, cov: pass ? 'man' : 'run' });
  if (kick) {                                                   // field-goal unit: 7 on the line, two wings, holder and kicker; the defense rushes
    F.off = { OL1: [-0.6, -4], OL2: [-0.6, -2], OL3: [-0.6, 0], OL4: [-0.6, 2], OL5: [-0.6, 4], TE: [-0.6, 6], WR1: [-0.6, -6], WR2: [-1.4, 8], WR3: [-1.4, -8], QB: [-7, 0.4], K: [-8.7, -3] };
    F.def = { DL1: [1.1, -5.4], DL2: [1.1, -2.2], DL3: [1.1, 0], DL4: [1.1, 2.2], LB1: [1.1, 5.4], LB2: [1.1, -8], LB3: [1.1, 8], CB1: [3, -10], CB2: [3, 10], S1: [10, -3], S2: [10, 3] };
  } else {
    const fl = rnd() < 0.5 ? -1 : 1;
    const key = pass ? pick(['gun22', 'gun22', 'gun31', 'gun31', 'uc']) : pick(['uc', 'uc', 'pistol', 'gun22']);
    const base = { OL1: [-0.6, -4], OL2: [-0.6, -2], OL3: [-0.6, 0], OL4: [-0.6, 2], OL5: [-0.6, 4] };
    const form = {
      gun22: { TE: [-0.6, 6.4], WR1: [-0.6, -22.5], WR3: [-1.5, -12.5], WR2: [-0.6, 22.5], QB: [-4.9, 0], RB: [-4.9, 2.4] },
      gun31: { TE: [-0.6, 6.4], WR1: [-0.6, -22.5], WR3: [-1.5, 13.5], WR2: [-0.6, 22.5], QB: [-4.9, 0], RB: [-4.9, -2.4] },
      uc: { TE: [-0.6, 6.4], WR1: [-0.6, -22.5], WR3: [-1.5, -12.5], WR2: [-0.6, 22.5], QB: [-1.9, 0], RB: [-6.3, 0] },
      pistol: { TE: [-0.6, 6.4], WR1: [-0.6, -22.5], WR3: [-1.5, -12.5], WR2: [-0.6, 22.5], QB: [-3.8, 0], RB: [-6.6, 0] },
    }[key];
    Object.entries({ ...base, ...form }).forEach(([r, [u, v]]) => { F.off[r] = [u, v * fl]; });
    if (key.startsWith('gun') && rnd() < 0.5) {                 // pre-snap motion: the back shifts across, or the slot man tightens in
      if (key === 'gun31' || rnd() < 0.6) { const q = F.off.RB; F.pre.RB = q.slice(); F.off.RB = [q[0], -q[1]]; F.mot = 'RB'; }
      else { const q = F.off.WR3; F.pre.WR3 = q.slice(); F.off.WR3 = [q[0], q[1] * 0.55]; F.mot = 'WR3'; }
    }
    const seen = r => F.pre[r] || F.off[r];                      // alignment the defense reads
    F.cov = pass ? pick(['man', 'man', 'c3', 'c3', 'c2', 'c4']) : 'run';
    const press = pass && F.cov === 'man' && rnd() < 0.4;
    const cbAt = r => [press ? 1.7 : rr(5.6, 7.3), seen(r)[1] - lvSgn(seen(r)[1]) * 0.4];
    const twoHigh = F.cov === 'c2' || F.cov === 'c4';
    Object.assign(F.def, {
      DL1: [0.95, -5 * fl], DL2: [0.95, -1.6 * fl], DL3: [0.95, 1.6 * fl], DL4: [0.95, 5 * fl],
      LB1: [4.8, -5 * fl], LB2: [4.9, 0.4 * fl],
      LB3: pass ? [5.2, seen('WR3')[1] - lvSgn(seen('WR3')[1]) * 0.8] : [4.7, 6 * fl],
      CB1: cbAt('WR1'), CB2: cbAt('WR2'),
      S1: !pass ? [12.8, -3.5 * fl] : twoHigh ? [13.8, -8.5 * fl] : [14.8, 0.8 * fl],
      S2: !pass ? [8.2, 6.5 * fl] : twoHigh ? [13.8, 8.5 * fl] : [8.8, 7.2 * fl],
    });
  }
  const offKeys = Object.keys(F.off);
  offKeys.forEach(r => {                                        // the huddle: linemen and backs gather behind the ball, receivers come in from the flanks
    const q = F.pre[r] || F.off[r];
    F.hud[r] = r.startsWith('OL') ? [-8 + rr(-0.5, 0.5), q[1] * 0.5] : r === 'QB' ? [-8.8, rr(-0.4, 0.4)] : r === 'K' ? [-11, -2] : [Math.min(q[0], -1) - 5, q[1] * 0.92 + rr(-0.5, 0.5)];
  });
  Object.keys(F.def).forEach(r => { const q = F.def[r]; F.dst[r] = [q[0] + (r.startsWith('DL') ? rr(3, 4) : rr(2.5, 4.5)), q[1] * 1.05 + rr(-1, 1)]; });
  return F;
}

function lvScene(play, ctx) {
  const meOff = ['QB', 'RB', 'WR', 'TE', 'OL', 'K'].includes(S.player.pos), myRole = LV_ME[S.player.pos];
  const offIsMe = play.off === 'me', dir = offIsMe ? ctx.myDir : -ctx.myDir, los = dir === 1 ? play.los : 100 - play.los;
  const P = (u, v) => ({ x: lvX(clamp(los + dir * u, -9.4, 109.4)), y: lvY(v) });
  const offCol = TEAM[offIsMe ? ctx.myId : ctx.oppId].c1, defCol = TEAM[offIsMe ? ctx.oppId : ctx.myId].c1;
  return { dir, los, P, offCol, defCol, offIsMe, myRole, meOff, meOnField: offIsMe ? meOff : !meOff };
}
function lvMakeActors(sc, play) {
  const F = lvPlan(play), g = document.getElementById('lvActors'); g.innerHTML = '';
  const actors = {}, svg = 'http://www.w3.org/2000/svg';
  const mk = (role, off) => {
    const q = (off ? F.hud : F.dst)[role], p = sc.P(q[0], q[1]), isMe = sc.meOnField && off === sc.meOff && role === sc.myRole;
    const col = off ? sc.offCol : sc.defCol, id = role + (off ? '' : '_d'), face = (off ? sc.dir === 1 : sc.dir !== 1) ? 0 : Math.PI;
    const el = document.createElementNS(svg, 'g'); el.setAttribute('class', 'lv-pl' + (isMe ? ' me' : ''));
    el.innerHTML = `<g class="lv-fc"><path d="M9 -5.2L16.5 0L9 5.2Z" fill="${isMe ? '#ffd23d' : '#fff'}" opacity=".92"/></g><circle r="${isMe ? 12.5 : 9.5}" fill="${col}" stroke="${isMe ? '#ffd23d' : '#fff'}" stroke-width="${isMe ? 3.5 : 2}"/>`
      + (isMe ? `<text y="3.6" text-anchor="middle" class="lv-pn">${playerNumber()}</text>` : `<text y="2.7" text-anchor="middle" class="lv-pr" fill="${contrastOn(col)}">${lvLabel(role)}</text>`);
    g.appendChild(el); actors[id] = { el, fc: el.querySelector('.lv-fc'), x: p.x, y: p.y, id, role, off, isMe, face };
    el.setAttribute('transform', `translate(${p.x} ${p.y})`);
  };
  Object.keys(F.off).forEach(r => mk(r, true)); Object.keys(F.def).forEach(r => mk(r, false));
  const ball = document.createElementNS(svg, 'g'); ball.setAttribute('class', 'lv-ball');
  ball.innerHTML = '<ellipse class="sh" rx="7" ry="3.4" cy="6" fill="#000" opacity=".3"/><ellipse class="b" rx="7.5" ry="4.6" fill="#8a4b1f" stroke="#fff" stroke-width="1.2"/><line x1="-2.5" x2="2.5" stroke="#fff" stroke-width="1"/>';
  g.appendChild(ball);
  const bp = sc.P(-0.1, 0); actors.ball = { el: ball, x: bp.x, y: bp.y, id: 'ball', ball: true };
  ball.setAttribute('transform', `translate(${bp.x} ${bp.y})`);
  // your player's name tag
  const me = Object.values(actors).find(a => a.isMe);
  if (me) { const tag = document.createElementNS(svg, 'text'); tag.setAttribute('class', 'lv-tag'); tag.textContent = surname(S.player.name).toUpperCase(); tag.setAttribute('text-anchor', 'middle'); g.appendChild(tag); actors.tag = { el: tag, follow: me.id, tag: true, id: 'tag', x: me.x, y: me.y }; }
  return actors;
}

/* ---------- tiny timeline engine ----------
   move(id, to, t0, t1)            straight line (smooth, or a trapezoid speed profile with prof:1)
   run(id, pts, t0, speed, o)      a rounded path at a given speed (yards / second); o.t1 forces the arrival time
   follow(id, other, t0, t1, dx, dy, {lag, wob})   stick to another actor (blocking, man coverage, tackling), optionally with a reaction lag and a little tussle */
function lvTimeline(actors) {
  const steps = {}, cur = {};
  Object.values(actors).forEach(a => { if (!a.tag) { cur[a.id] = { x: a.x, y: a.y }; steps[a.id] = []; } });
  const add = s => { const l = steps[s.a]; l.push(s); l.sort((p, q) => p.t0 - q.t0); };
  const smooth = k => k * k * (3 - 2 * k);
  const prof = (k, a, d) => {                                   // trapezoid speed profile: accelerate over a, cruise, brake over d
    const tot = 1 - a / 2 - d / 2; let s;
    if (a > 0 && k < a) s = k * k / (2 * a);
    else if (d > 0 && k > 1 - d) { const q = k - (1 - d); s = a / 2 + (1 - d - a) + q - q * q / (2 * d); }
    else s = a / 2 + (k - a);
    return clamp(s / tot, 0, 1);
  };
  const chaikin = (pts, n) => {                                  // rounds the corners of a polyline (cuts stay sharp but not robotic)
    for (let it = 0; it < n; it++) {
      if (pts.length < 3) break;
      const out = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 }); }
      out.push(pts[pts.length - 1]); pts = out;
    }
    return pts;
  };
  const at = (id, t) => {
    const list = steps[id]; let p = actors[id] ? { x: actors[id].x, y: actors[id].y, z: 0 } : { x: 0, y: 0, z: 0 };
    if (!list) return p;
    for (const s of list) {
      if (t < s.t0) break;
      const k = clamp((t - s.t0) / Math.max(0.001, s.t1 - s.t0), 0, 1);
      if (s.follow) {
        const tt = Math.min(t, s.t1), q = at(s.follow, tt - (s.lag || 0));
        const b = s.bl ? 1 - smooth(clamp((t - s.t0) / s.bl, 0, 1)) : 0;      // the starting offset to the target fades out, so he keeps moving with the target while he closes in
        p = { x: q.x + (s.dx || 0) + s.rel.x * b, y: q.y + (s.dy || 0) + (s.wob ? s.wob * Math.sin(tt * s.fq + s.ph) : 0) + s.rel.y * b, z: 0 }; continue;
      }
      if (s.path) {
        const d = prof(k, s.pa, s.pd) * s.len, c = s.cum; let i = 1; while (i < c.length - 1 && c[i] < d) i++;
        const seg = c[i] - c[i - 1] || 1, f = clamp((d - c[i - 1]) / seg, 0, 1), a = s.path[i - 1], b = s.path[i];
        p = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: 0 }; continue;
      }
      const e = s.lin ? k : (s.prof ? prof(k, s.pa == null ? 0.2 : s.pa, s.pd == null ? 0.2 : s.pd) : smooth(k));
      p = { x: s.from.x + (s.to.x - s.from.x) * e, y: s.from.y + (s.to.y - s.from.y) * e, z: s.arc ? 4 * s.arc * k * (1 - k) : 0 };
    }
    return p;
  };
  const T = {
    move(id, to, t0, t1, o = {}) { add({ a: id, t0, t1: Math.max(t1, t0 + 0.02), from: at(id, t0), to: { x: to.x, y: to.y }, ...o }); cur[id] = { x: to.x, y: to.y }; },
    run(id, pts, t0, speed, o = {}) {
      const f = at(id, t0), poly = chaikin([{ x: f.x, y: f.y }, ...pts.map(q => ({ x: q.x, y: q.y }))], o.sm == null ? 1 : o.sm), cum = [0];
      for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y));
      const len = cum[cum.length - 1], t1 = o.t1 != null ? Math.max(o.t1, t0 + 0.06) : t0 + Math.max(0.06, len / 10 / speed);
      add({ a: id, t0, t1, path: poly, cum, len, pa: o.pa == null ? 0.14 : o.pa, pd: o.pd || 0 }); cur[id] = { x: poly[poly.length - 1].x, y: poly[poly.length - 1].y };
      return t1;
    },
    follow(id, other, t0, t1, dx = 0, dy = 0, o = {}) {
      const f = at(id, t0), q0 = at(other, t0 - (o.lag || 0));
      add({ a: id, t0, t1: Math.max(t1, t0 + 0.02), follow: other, dx, dy, rel: { x: f.x - q0.x - dx, y: f.y - q0.y - dy }, bl: o.bl == null ? 0.25 : o.bl, lag: o.lag || 0, wob: o.wob || 0, fq: o.fq || 8, ph: Math.random() * 6.28 });
      const q = at(other, t1 - (o.lag || 0)); cur[id] = { x: q.x + dx, y: q.y + dy };
    },
    pos: id => ({ ...cur[id] }),
    posAt: at,
    steps,
    end: 0,
    render(t) {
      Object.values(actors).forEach(a => {
        if (a.tag) { const p = at(a.follow, t); a.el.setAttribute('x', p.x); a.el.setAttribute('y', p.y - 21); return; }
        const p = at(a.id, t);
        if (a.ball) { a.el.setAttribute('transform', `translate(${p.x} ${p.y - p.z}) scale(${1 + p.z / 90})`); a.el.querySelector('.sh').setAttribute('cy', 6 + p.z * 0.9); a.el.querySelector('.sh').setAttribute('opacity', Math.max(0.1, 0.3 - p.z / 300)); return; }
        a.el.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
        const q = at(a.id, t - 0.09), vx = p.x - q.x, vy = p.y - q.y;      // players face where they are running
        if (vx * vx + vy * vy > 0.9) { let d = Math.atan2(vy, vx) - a.face; d = Math.atan2(Math.sin(d), Math.cos(d)); a.face += d * 0.35; }
        a.fc.setAttribute('transform', `rotate(${(a.face * 180 / Math.PI).toFixed(0)})${a.isMe ? ' scale(1.25)' : ''}`);
      });
    },
  };
  return T;
}

/* ---------- play templates ----------
   Every play is built from the same football pieces: the huddle breaks and lines up (sometimes with motion), then each position does its job —
   linemen block and rush, receivers run routes, defenders play man or zone and then pursue, the tackle is made by whoever is closest. */
function lvPlayScript(play, sc, A, T) {
  const { P, dir } = sc, F = play._f, SN = LV_SN, ballId = 'ball', k = play.kind, me = sc.myRole;
  const result = { dur: 4, text: '', fx: [], snap: SN };
  const meDef = ['DL', 'LB', 'CB', 'S'].includes(S.player.pos) ? LV_ME[S.player.pos] : null;
  const to = (u, v) => P(u, v), O = r => F.off[r], D = r => F.def[r], dd = r => r + '_d';
  const loc = p => ({ u: (p.x - lvX(sc.los)) * dir / 10, v: (p.y - lvY(0)) / 10 });
  const posL = (id, t) => T.posAt(id, SN + t), at = (id, t) => loc(posL(id, t));
  const pts = a => a.map(q => to(q[0], q[1]));
  const R = (id, a, t0, spd = 7, o = {}) => T.run(id, pts(a), SN + t0, spd, o.t1 != null ? { ...o, t1: SN + o.t1 } : o) - SN;
  const RT = (id, a, t0, tArr, o = {}) => {                       // run to a point, arriving at tArr but never faster than a sprint
    const p0 = at(id, t0); let len = 0, pv = [p0.u, p0.v]; a.forEach(q => { len += Math.hypot(q[0] - pv[0], q[1] - pv[1]); pv = q; });
    return R(id, a, t0, 9, { ...o, t1: Math.max(tArr, t0 + len / 10.5) });
  };
  const M = (id, q, t0, t1, o = {}) => T.move(id, to(q[0], q[1]), SN + t0, SN + t1, o);
  const FOL = (id, other, t0, t1, du = 0, dv = 0, o = {}) => T.follow(id, other, SN + t0, SN + t1, dir * du * 10, dv * 10, o);
  const FX = (t, p, text, cls, sticky) => result.fx.push({ t: SN + t, p, text, cls, sticky });
  const done = tl => { result.dur = SN + tl; };
  const clampV = v => clamp(v, -24.3, 24.3);
  const OLS = ['OL1', 'OL2', 'OL3', 'OL4', 'OL5'], DLS = ['DL1', 'DL2', 'DL3', 'DL4'], defKeys = Object.keys(F.def);
  const SKILL = ['QB', 'WR1', 'WR2', 'WR3', 'TE', 'RB'];
  const manOf = { WR1: 'CB1', WR2: 'CB2', WR3: 'LB3', TE: 'LB2', RB: 'LB1' };
  const tgtOf = { CB1: 'WR1', LB2: 'TE', S1: 'WR3', DL2: 'WR2' };
  const pairDL = {};                                               // each lineman's man across the ball
  DLS.forEach(d => { pairDL[d] = OLS.slice().sort((a, b) => Math.abs(O(a)[1] - D(d)[1]) - Math.abs(O(b)[1] - D(d)[1]))[0]; });
  const pairOL = ol => DLS.slice().sort((a, b) => Math.abs(D(a)[1] - O(ol)[1]) - Math.abs(D(b)[1] - O(ol)[1]))[0];
  const sd = r => lvSgn(D(r)[1] || 1);

  /* ---- before the snap: break the huddle, line up, (motion) ---- */
  const shadow = F.mot && F.cov === 'man' ? (F.mot === 'RB' ? 'LB1' : 'LB3') : null;
  Object.keys(F.off).forEach(r => { const q = F.pre[r] || F.off[r]; T.move(r, to(q[0], q[1]), rr(0, 0.12), SN - (r === F.mot ? 0.9 : 0.5) - rr(0, 0.08), { prof: 1, pa: 0.2, pd: 0.25 }); });
  defKeys.forEach(r => { const q = D(r); T.move(dd(r), to(q[0], q[1]), 0.1 + rr(0, 0.2), SN - (r === shadow ? 0.9 : 0.18), { prof: 1, pa: 0.3, pd: 0.4 }); });
  if (F.mot) {
    const q = O(F.mot), pq = F.pre[F.mot]; M(F.mot, q, -0.7, -0.02, { prof: 1, pa: 0.3, pd: 0.3 });
    if (shadow) M(dd(shadow), [D(shadow)[0], D(shadow)[1] + (q[1] - pq[1]) * 0.85], -0.55, -0.02, { prof: 1, pa: 0.3, pd: 0.3 });   // man coverage follows the motion man, zone does not
  }

  /* ---- blocking ---- */
  const cup = { OL1: -1.5, OL2: -2.1, OL3: -2.4, OL4: -2.1, OL5: -1.5 };
  const engage = (t0, t1, du, free = [], wob = 3.2) => DLS.forEach(d => { if (free.includes(d)) return; FOL(dd(d), pairDL[d], t0, t1, du, (D(d)[1] - O(pairDL[d])[1]) * 0.45, { wob, fq: 7 + rnd() * 3, bl: 0.4 }); });
  const passPro = (free = [], tEng = 3) => { OLS.forEach(r => M(r, [cup[r], O(r)[1] * 0.93], 0.05, 0.55, { prof: 1, pa: 0.4, pd: 0.5 })); engage(0.05, tEng, 1.25, free); };

  /* ---- routes ---- */
  const routePts = (type, st, air) => {                            // waypoints from the receiver's alignment; the last one is the catch point
    const v0 = st[1], sg = lvSgn(v0 || (rnd() < 0.5 ? -1 : 1)), inn = d => clampV(v0 - sg * d), out = d => clampV(v0 + sg * d);
    air = Math.max(air, 1);
    let r;
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
      default: r = [[air * 0.6, inn(0.2)], [air, inn(1.1)]];       // seam
    }
    return r;
  };
  const pickRoute = (role, air, v0) => {
    let t;
    if (role === 'RB') t = air >= 9 ? 'wheel' : 'flat';
    else if (role === 'TE') t = air >= 15 ? 'seam' : air >= 8 ? pick(['dig', 'curl', 'drag']) : pick(['drag', 'curl']);
    else if (air <= 4) t = pick(['slant', 'slant', 'curl']);
    else if (air <= 9) t = pick(['slant', 'curl', 'out', 'curl']);
    else if (air <= 17) t = pick(['out', 'dig', 'comeback', 'post', 'curl']);
    else t = pick(['go', 'go', 'post', 'corner']);
    if (Math.abs(v0) > 18 && t === 'out') t = 'comeback';
    return t;
  };
  const sendRoutes = (exclude = []) => {                           // everybody who is not the target runs his own route (or stays in to block)
    ['WR1', 'WR2', 'WR3', 'TE', 'RB'].forEach(r => {
      if (exclude.includes(r)) return;
      const st = O(r);
      if (r === 'RB' && rnd() < 0.5) { R('RB', [[-3.5, st[1] * 0.6 + (st[1] === 0 ? 1.5 : 0)]], 0.05, 6); return; }
      if (r === 'TE' && rnd() < 0.35) { const ed = lvSgn(st[1]) === lvSgn(D('DL1')[1]) ? 'DL1' : 'DL4'; FOL('TE', dd(ed), 0.25, 3, -0.9, (st[1] - D(ed)[1]) * 0.4, { wob: 2.4, bl: 0.6 }); return; }
      const a2 = Math.round(rr(5, 19)); R(r, routePts(pickRoute(r, a2, st[1]), st, a2), 0, 7.4);
    });
  };

  /* ---- coverage ---- */
  const ZONES = {
    c3: { CB1: [14, 17], CB2: [14, 17], S1: [16, 0], S2: [7.5, 12], LB1: [8.5, 6], LB2: [9.5, 0], LB3: [6.5, 13] },
    c2: { CB1: [6.5, 18], CB2: [6.5, 18], S1: [15, 8.5], S2: [15, 8.5], LB1: [9, 6.5], LB2: [11, 0], LB3: [6.5, 13.5] },
    c4: { CB1: [12.5, 14.5], CB2: [12.5, 14.5], S1: [11.5, 8.5], S2: [11.5, 8.5], LB1: [7.5, 5], LB2: [8.5, 0], LB3: [6.5, 10.5] },
  };
  const zoneDrop = (cov, excl = []) => {                           // defenders drop into their zones (backpedal, then settle)
    const Z = ZONES[cov] || ZONES.c3;
    defKeys.filter(r => !DLS.includes(r) && !excl.includes(r)).forEach(r => { const z = Z[r]; R(dd(r), [[z[0], sd(r) * z[1]]], 0.05, 5.8, { pa: 0.3 }); });
  };

  /* ---- tackling: the nearest men run to where the carrier will be stopped, the first one wraps him up, the rest pile on ---- */
  const swarm = (carrier, tEnd, o = {}) => {
    const ids = (o.ids || defKeys.filter(r => !DLS.includes(r) || (o.dl || []).includes(r)).map(dd)).filter(id => id !== carrier && !(o.not || []).includes(id));
    const tR = id => (o.tRid && o.tRid[id] != null) ? o.tRid[id] : Math.max(o.tR || 0, /^LB/.test(id) ? 0.42 : /^S/.test(id) ? 0.55 : /^(CB|WR|TE|RB|QB)/.test(id) ? 0.65 : 0.95);
    const endP = loc(posL(carrier, tEnd)), tHit = tEnd - 0.28, trail = o.trail == null ? -1 : o.trail;
    const cand = ids.map(id => { const t0 = Math.min(tR(id), tHit - 0.2), p = at(id, t0), d = Math.hypot(p.u - endP.u, p.v - endP.v); return { id, t0, p, d, eta: t0 + d / 10.5 }; }).sort((a, b) => a.eta - b.eta);
    const nH = o.n || (o.solo ? 1 : (rnd() < 0.42 ? 1 : 2));
    let hitters = cand.slice(0, nH);
    if (o.first) { const f = cand.find(c => c.id === o.first); if (f) hitters = [f, ...hitters.filter(c => c !== f)].slice(0, nH); }
    let tFin = tEnd;
    hitters.forEach((c, i) => {
      if (o.td) { tFin = Math.max(tFin, RT(c.id, [[endP.u + trail * (2.6 + i * 1.6), endP.v + (i % 2 ? 1.4 : -1.4)]], c.t0, tEnd + 0.4)); return; }   // touchdown: they chase but never catch him
      let tA = tHit, ch = loc(posL(carrier, tHit));                   // where he can really get to him: aim at the carrier's spot when he arrives
      for (let it = 0; it < 5; it++) { ch = loc(posL(carrier, Math.min(tA, tEnd))); const nt = Math.max(tHit, c.t0 + Math.hypot(c.p.u - ch.u, c.p.v - ch.v) / 10.5); if (Math.abs(nt - tA) < 0.01) break; tA = nt; }
      ch = loc(posL(carrier, Math.min(tA, tEnd)));
      tA = RT(c.id, [[ch.u, ch.v]], c.t0, tA);
      if (tA < tEnd + 0.4) FOL(c.id, carrier, tA, tEnd + 1.0, 0.5 - i * 0.45, i ? (i % 2 ? 0.8 : -0.8) : 0, { bl: 0.12 });
      tFin = Math.max(tFin, tA);
    });
    cand.filter(c => !hitters.includes(c)).forEach((c, i) => {
      const side = i % 2 ? 1 : -1, far = c.d > 16 ? 0.5 : c.d > 9 ? 0.8 : 1, tg = o.td ? [endP.u + trail * (4 + i), endP.v + side * 2.4] : [endP.u + (rnd() < 0.5 ? 1 : -1) * rr(0.8, 2.2), endP.v + side * rr(1.4, 3.4)];
      RT(c.id, [[c.p.u + (tg[0] - c.p.u) * far, c.p.v + (tg[1] - c.p.v) * far]], c.t0, tEnd + 0.25);
    });
    return tFin;
  };

  /* ---- a pass: drop-back, route, coverage, throw, catch, run after the catch, tackle ---- */
  const passTo = (target, air, yac, res, defRole, o = {}) => {
    const st = O(target), qb0 = O('QB'), shot = qb0[0] < -3, ty = pickRoute(target, air, st[1]);
    const rp = routePts(ty, st, air), cp = rp[rp.length - 1];
    const dropTo = shot ? [qb0[0] - 1.2, qb0[1] + rr(-0.5, 0.5)] : [-6.7 + rr(-0.3, 0.3), qb0[1] + rr(-0.4, 0.4)], dropT = shot ? 0.45 : 1.0;
    let tT = Math.max(dropT + 0.22, (shot ? 0.68 : 0.9) + Math.max(0, air) * 0.04 + rr(0, 0.12));
    if (o.hurry) tT = Math.max(dropT * 0.8 + 0.1, tT - 0.45);
    const dist0 = Math.hypot(cp[0] - dropTo[0], cp[1] - dropTo[1]), flight = 0.3 + dist0 / 27;
    let len = 0, pv = st; rp.forEach(q => { len += Math.hypot(q[0] - pv[0], q[1] - pv[1]); pv = q; });
    const tCatch = Math.max(tT + flight, len / 9 + 0.15); tT = tCatch - flight;
    // quarterback: snap, drop, step into the throw
    R('QB', [dropTo], 0, 5, { t1: dropT, pa: 0.25, pd: 0.35 });
    T.move(ballId, posL('QB', shot ? 0.3 : 0.12), SN, SN + (shot ? 0.3 : 0.12), shot ? { arc: 6 } : {}); FOL(ballId, 'QB', shot ? 0.3 : 0.12, tT, 0, 0, { bl: 0 });
    M('QB', [dropTo[0] + 0.7, dropTo[1]], tT - 0.3, tT + 0.12, { prof: 1, pa: 0.4, pd: 0.4 });
    // the target and the rest of the routes
    R(target, rp, 0, 8, { t1: tCatch, pa: 0.14, pd: 0 });
    passPro(o.rusher ? [o.rusher] : [], tCatch + 0.2);              // pass protection (a rusher who wins his block is left free)
    sendRoutes([target]);
    if (o.rusher) { const rv = D(o.rusher)[1], g = lvSgn(rv || 1); RT(dd(o.rusher), [[-0.4, rv + g * 1.1], [-2.8, dropTo[1] + g * 0.9]], 0.1, tT + 0.12, { pa: 0.25 }); FX(tT, posL(dd(o.rusher), tT), 'PRESSURE', 'bad'); }
    // coverage: the man covering the target stays on him; the others play man or zone
    const prim = defRole, others = defKeys.filter(r => !DLS.includes(r) && r !== prim), inside = -lvSgn(st[1] || 1) * 0.35;
    const blFor = (dr, wr) => { const a = at(dd(dr), 0.05), b = at(wr, 0.05); return clamp(Math.hypot(a.u - b.u, a.v - b.v) / 4.2, 0.4, 2.5); };   // the farther he starts from his man, the slower he closes
    const stick = (dr, wr, t1, du = 1.15) => FOL(dd(dr), wr, 0.05, t1, du, inside, { lag: 0.2, bl: blFor(dr, wr), wob: 2, fq: 6 + rnd() * 3 });
    if (res === 'int') { FOL(dd(prim), target, 0.05, tCatch - 0.4, 0.4, 0, { lag: 0.15, bl: blFor(prim, target), wob: 1.5 }); M(dd(prim), cp, tCatch - 0.4, tCatch, { prof: 1, pa: 0.3, pd: 0.5 }); }
    else if (res === 'comp') stick(prim, target, tCatch + 0.05);
    else { FOL(dd(prim), target, 0.05, tCatch - 0.3, 1.0, inside, { lag: 0.15, bl: blFor(prim, target), wob: 1.8 }); M(dd(prim), [cp[0] + 0.3, cp[1]], tCatch - 0.3, tCatch + 0.05, { prof: 1, pa: 0.3, pd: 0.4 }); }
    if (F.cov === 'man') {
      Object.entries(manOf).forEach(([wr, dr]) => { if (dr !== prim && others.includes(dr)) stick(dr, wr, tCatch + 0.6); });
      if (prim !== 'S1') R(dd('S1'), [[16.2, 0.5]], 0.1, 5.5, { pa: 0.3 });
      if (prim !== 'S2') R(dd('S2'), [[10.5, sd('S2') * 6]], 0.1, 5.5, { pa: 0.3 });
    } else zoneDrop(F.cov, [prim]);
    if (res !== 'comp') others.forEach(r => {                       // zone defenders and safeties break on the ball once it is thrown (after a catch the swarm takes over)
      if (F.cov === 'man' && Object.values(manOf).includes(r)) return;
      const p = at(dd(r), tT), dx = cp[0] - p.u, dy = cp[1] - p.v, dist = Math.hypot(dx, dy), f = Math.min(dist < 14 ? 0.55 : 0.2, (dist < 14 ? 7 : 3) / Math.max(dist, 0.1));
      R(dd(r), [[p.u + dx * f, p.v + dy * f]], tT + 0.05, 6.5);
    });
    // the ball, and what happens at the catch point
    let tFin, endLoc = { u: cp[0], v: cp[1] }, arc = 16 + dist0 * 2;
    if (res === 'comp') {
      T.move(ballId, posL(target, tCatch), SN + tT, SN + tCatch, { arc });
      let tEnd = tCatch + 0.5;
      if (yac > 0.4) {
        const dv1 = rr(-1.8, 1.8), dv2 = rr(-3, 3);
        tEnd = R(target, [[cp[0] + yac * 0.45, clampV(cp[1] + dv1)], [cp[0] + yac, clampV(cp[1] + dv1 + dv2)]], tCatch, 8.4, { pa: 0.28, pd: o.td ? 0 : 0.3 });
      }
      FOL(ballId, target, tCatch, tEnd + 4, 0, 0, { bl: 0 });
      tFin = swarm(target, tEnd, { tR: tCatch + 0.05, first: o.first ? dd(o.first) : (prim ? dd(prim) : null), td: !!o.td, solo: o.solo, n: o.td ? 3 : undefined, ids: defKeys.filter(r => !DLS.includes(r)).map(dd) });
      endLoc = at(target, tEnd);
      done(tFin + 0.9);
    } else if (res === 'inc') {
      const land = [cp[0] + rr(1.8, 3.2) * (o.drop ? 0.3 : 1), clampV(cp[1] + rr(-2.2, 2.2))];
      if (o.drop) { T.move(ballId, posL(target, tCatch), SN + tT, SN + tCatch, { arc }); T.move(ballId, to(land[0], land[1]), SN + tCatch, SN + tCatch + 0.45, { arc: 14 }); }
      else { T.move(ballId, to(land[0], land[1]), SN + tT, SN + tCatch + 0.1, { arc }); T.move(ballId, to(land[0] + 1.0, land[1] + 0.6), SN + tCatch + 0.1, SN + tCatch + 0.35, { arc: 6 }); }
      FX(tCatch + 0.1, to(land[0], land[1]), 'INCOMPLETE', 'bad'); endLoc = { u: land[0], v: land[1] }; done(tCatch + 1.0);
    } else if (res === 'pd') {
      T.move(ballId, to(cp[0], cp[1]), SN + tT, SN + tCatch, { arc });
      T.move(ballId, to(cp[0] + rr(1, 2.5), cp[1] - sd(prim) * rr(2.5, 4.5)), SN + tCatch, SN + tCatch + 0.5, { arc: 38 });
      FX(tCatch + 0.05, to(cp[0], cp[1]), 'PASS BREAKUP', 'good'); done(tCatch + 1.1);
    } else if (res === 'int') {
      const retU = play.td ? -(play.los + 3) : cp[0] - (play.yards || 0);
      T.move(ballId, to(cp[0], cp[1]), SN + tT, SN + tCatch, { arc }); FOL(ballId, dd(prim), tCatch, tCatch + 9, 0, 0, { bl: 0 });
      const gv = cp[1] + rr(-3, 3), tEnd = R(dd(prim), [[(cp[0] + retU) / 2, gv], [retU, gv + rr(-3, 3)]], tCatch + 0.05, 8.2, { pa: 0.25, pd: play.td ? 0 : 0.3 });
      tFin = swarm(dd(prim), tEnd, { ids: SKILL, tR: tCatch + 0.1, td: !!play.td, trail: 1, n: play.td ? 3 : 2 });
      FX(tCatch + 0.05, to(cp[0], cp[1]), play.td ? 'PICK SIX!' : 'INTERCEPTION', 'good'); endLoc = { u: retU, v: gv }; done(tFin + 0.9);
    }
    result.end = to(endLoc.u, endLoc.v);
    return { tFin, end: endLoc };
  };

  /* ---- a deflection at the line by a lineman (batted ball) ---- */
  const tipPlay = res => {
    const qb0 = O('QB'), shot = qb0[0] < -3, dropTo = shot ? [qb0[0] - 1.2, qb0[1]] : [-6.7, qb0[1]], dropT = shot ? 0.45 : 1.0, tT = Math.max(dropT + 0.2, 1.15), tB = tT + 0.28;
    const g = D('DL2')[1], tipPt = [-1.9, g * 0.6];
    R('QB', [dropTo], 0, 5, { t1: dropT, pa: 0.25, pd: 0.35 });
    T.move(ballId, posL('QB', shot ? 0.3 : 0.12), SN, SN + (shot ? 0.3 : 0.12), shot ? { arc: 6 } : {}); FOL(ballId, 'QB', shot ? 0.3 : 0.12, tT, 0, 0, { bl: 0 });
    passPro(['DL2'], tB + 0.2); sendRoutes([]); zoneDrop('c3');
    RT(dd('DL2'), [[-0.4, g + lvSgn(g) * 0.7], tipPt], 0.1, tB, { pa: 0.25 });
    T.move(ballId, to(tipPt[0], tipPt[1]), SN + tT, SN + tB, { arc: 14 });
    if (res === 'pd') { T.move(ballId, to(tipPt[0] - 1.8, tipPt[1] + rr(-3, 3)), SN + tB, SN + tB + 0.55, { arc: 30 }); FX(tB, to(tipPt[0], tipPt[1]), 'BATTED DOWN', 'good'); done(tB + 1.2); result.end = to(tipPt[0], tipPt[1]); return; }
    FOL(ballId, dd('DL2'), tB, tB + 9, 0, 0, { bl: 0 });
    const retU = play.td ? -(play.los + 3) : tipPt[0] - (play.yards || 0), tEnd = R(dd('DL2'), [[(tipPt[0] + retU) / 2, tipPt[1] + rr(-2, 2)], [retU, tipPt[1] + rr(-3, 3)]], tB + 0.05, 8, { pa: 0.25, pd: play.td ? 0 : 0.3 });
    const tFin = swarm(dd('DL2'), tEnd, { ids: SKILL, tR: tB + 0.1, td: !!play.td, trail: 1, n: 2 });
    FX(tB, to(tipPt[0], tipPt[1]), play.td ? 'PICK SIX!' : 'INTERCEPTION', 'good'); done(tFin + 0.9); result.end = to(retU, tipPt[1]);
  };

  /* ---- a run: snap, handoff, blocking up front, the hole, the carrier, pursuit and the tackle ---- */
  const holeFor = r => !r ? null : r.startsWith('DL') ? D(r)[1] + rr(-1.2, 1.2) : r.startsWith('LB') ? D(r)[1] + rr(-4, 4) : r.startsWith('CB') ? D(r)[1] * 0.62 + rr(-2, 2) : D(r)[1] * 0.4 + rr(-3, 3);
  const runPlay = (carrier, yards, td, o = {}) => {
    const qb = O('QB'), shot = qb[0] < -3;
    let hv = o.hv;
    if (hv == null) { const kd = pick(['in', 'in', 'off', 'off', 'out']); hv = kd === 'in' ? rr(-3.5, 3.5) : (rnd() < 0.5 ? -1 : 1) * (kd === 'off' ? rr(5, 7.5) : rr(11, 16)); }
    hv = clampV(hv);
    const hs = lvSgn(hv), tH0 = shot ? 0.55 : 0.78, mesh = shot ? [qb[0] - 0.3, qb[1] + hs * 0.9] : [qb[0] - 1.4, qb[1] + hs * 0.9];
    T.move(ballId, posL('QB', shot ? 0.3 : 0.12), SN, SN + (shot ? 0.3 : 0.12), shot ? { arc: 6 } : {});
    R('QB', [shot ? [qb[0] - 0.2, qb[1] + hs * 0.25] : [qb[0] - 1.0, qb[1] + hs * 0.4]], 0, 4, { t1: tH0, pa: 0.3, pd: 0.3 });
    const tH = RT(carrier, [mesh], 0, tH0, { pa: 0.2 });
    FOL(ballId, 'QB', shot ? 0.3 : 0.12, tH - 0.12, 0, 0, { bl: 0 }); T.move(ballId, posL(carrier, tH), SN + tH - 0.12, SN + tH); FOL(ballId, carrier, tH, tH + 12, 0, 0, { bl: 0 });
    let path;
    if (yards <= 1) path = [[Math.min(0.4, yards + 0.8), hv * 0.85], [yards, hv * 0.85 + rr(-1, 1)]];
    else if (Math.abs(hv) > 10) path = [[-2.2, hv * 0.6], [-0.2, hv * 0.92], [Math.min(yards, 3.5), hv + hs * 0.8], [yards, hv + hs * rr(1.5, 3.5)]];
    else path = [[0.5, hv * 0.9], [yards * 0.55, hv + rr(-1.4, 1.4)], [yards, hv + rr(-2.2, 2.2)]];
    const tEnd = R(carrier, path.map(q => [q[0], clampV(q[1])]), tH, Math.abs(yards) > 14 ? 8.6 : 7.5, { pa: 0.22, pd: td ? 0 : 0.3 });
    // the line: zone blocking, one guard pulls on runs outside the tackles
    const big = Math.abs(hv) > 4.5, pull = big ? ['OL2', 'OL4'].find(r => O(r)[1] * hs < 0) : null, tShed = 0.95;
    const pen = yards <= 1 ? DLS.slice().sort((a, b) => Math.abs(D(a)[1] - hv) - Math.abs(D(b)[1] - hv))[0] : null;
    const surge = Math.min(2.4, 1.0 + Math.max(0, yards) * 0.08) + (o.surge || 0);
    OLS.forEach(r => { if (r === pull) return; const q = O(r), s2 = r === o.pan ? surge + 1.4 : surge; M(r, [s2, q[1] + hs * rr(0.8, 1.3)], 0.12, 1.0, { prof: 1, pa: 0.3, pd: 0.5 }); });
    if (o.pan) { const q = O(o.pan); M(o.pan, [surge + 3.3, q[1] + hs * 1.0], 1.0, 1.6, { prof: 1, pa: 0.3, pd: 0.5 }); }
    if (pull) { const q = O(pull); R(pull, [[-1.6, q[1] * 0.9], [-1.5, hv * 0.55], [1.2, hv - hs * 0.4], [3.4, hv - hs * 0.3]], 0.05, 7.8, { pa: 0.3 }); }
    DLS.forEach(d => { if (d === pen) return; const ol = (pull && pairDL[d] === pull) ? 'OL3' : pairDL[d]; FOL(dd(d), ol, 0.12, tShed + 0.1, 1.1, (D(d)[1] - O(ol)[1]) * 0.35, { wob: 3, fq: 7 + rnd() * 3, bl: 0.4 }); });
    // receivers and tight end: stalk-block on the run side, otherwise clear the defense out
    const blocked = [];
    ['WR1', 'WR2', 'WR3'].forEach(r => {
      if (r === carrier) return;
      const q = O(r), cb = manOf[r], sameSide = Math.abs(hv) > 8 && lvSgn(q[1]) === hs;
      if (sameSide && cb !== o.first && cb !== meDef && yards >= 4) { const ta = RT(r, [[D(cb)[0] - 0.9, D(cb)[1]]], 0.05, 1.1); FOL(dd(cb), r, ta, Math.max(tEnd + 0.4, ta + 0.3), 0.9, 0, { wob: 2.4, bl: 0.3 }); blocked.push(cb); }
      else R(r, routePts('go', q, rr(14, 20)), 0, 7.6);
    });
    if (carrier !== 'TE') { const ed = lvSgn(O('TE')[1]) === lvSgn(D('DL1')[1]) ? 'DL1' : 'DL4'; if (ed !== pen) FOL('TE', dd(ed), 0.15, tShed + 0.1, -0.9, (O('TE')[1] - D(ed)[1]) * 0.4, { wob: 2.4, bl: 0.6 }); }
    if (carrier !== 'RB') R('RB', [[-3.2, hv * 0.5], [2.0, hv]], 0.05, 7);
    // linebackers and safeties read the run: a step toward the hole before they fill
    ['LB1', 'LB2', 'LB3', 'S1', 'S2'].forEach(r => { if (!blocked.includes(r)) M(dd(r), [D(r)[0] - 0.3, D(r)[1] + (hv - D(r)[1]) * 0.1], 0.05, 0.4); });
    let tFin = tEnd + 0.5, endLoc = at(carrier, tEnd);
    if (!td) {
      const not = blocked.map(dd).concat(o.fumble && meDef ? [dd(meDef)] : []);
      tFin = swarm(carrier, tEnd, { first: o.first ? dd(o.first) : null, solo: o.solo, not, dl: yards <= 2 ? DLS : (o.first && DLS.includes(o.first) ? [o.first] : []), tRid: pen ? { [dd(pen)]: 0.25 } : {} });
    } else tFin = swarm(carrier, tEnd, { td: true, n: 3, not: blocked.map(dd), tR: 0.5 });
    if (o.pan) { const dl = pairOL(o.pan); FX(1.15, posL(dd(dl), 1.15), 'PANCAKE!', 'good', true); }
    result.end = to(endLoc.u, endLoc.v); done(tFin + 0.9);
    return { tEnd, tFin, end: endLoc };
  };

  /* ---- a quarterback scramble: the pocket breaks down, he flushes and runs ---- */
  const scramblePlay = (yards, td) => {
    const qb0 = O('QB'), shot = qb0[0] < -3, dropTo = shot ? [qb0[0] - 1.2, qb0[1]] : [-6.7, qb0[1]], dropT = shot ? 0.45 : 1.0, tB = dropT + 0.55;
    const hv = (rnd() < 0.5 ? -1 : 1) * rr(4, 9), hs = lvSgn(hv);
    R('QB', [dropTo], 0, 5, { t1: dropT, pa: 0.25, pd: 0.35 });
    T.move(ballId, posL('QB', shot ? 0.3 : 0.12), SN, SN + (shot ? 0.3 : 0.12), shot ? { arc: 6 } : {}); FOL(ballId, 'QB', shot ? 0.3 : 0.12, tB + 12, 0, 0, { bl: 0 });
    passPro([], tB + 0.1); sendRoutes([]); zoneDrop('c3');
    const path = yards <= 2 ? [[dropTo[0] + 1.5, hv * 0.5], [yards, hv]] : [[dropTo[0] + 1.2, hv * 0.55], [Math.min(yards, 4), hv], [yards, hv + rr(-3, 3)]];
    const tEnd = R('QB', path.map(q => [q[0], clampV(q[1])]), tB, 7.3, { pa: 0.2, pd: td ? 0 : 0.3 });
    const tFin = swarm('QB', tEnd, { dl: DLS, tR: tB, td, n: td ? 3 : undefined });
    result.end = to(path[path.length - 1][0], clampV(path[path.length - 1][1]));
    return tFin;
  };

  /* ---- a sack: the rusher beats his man (or blitzes) and takes the quarterback down ---- */
  const sackPlay = (rusher, loss) => {
    const qb0 = O('QB'), shot = qb0[0] < -3, dropTo = shot ? [qb0[0] - 1.2, qb0[1]] : [-6.7, qb0[1]], dropT = shot ? 0.45 : 1.0;
    const spot = [Math.min(-2.5, loss), qb0[1] + rr(-1.4, 1.4)], isDL = DLS.includes(rusher), v0 = D(rusher)[1], g = lvSgn(v0 || 1), edge = isDL && Math.abs(v0) > 3;
    const rp = isDL ? (edge ? [[0.1, v0 * 1.22], [-2.0, v0 * 0.95], [spot[0] + 0.4, spot[1] + g * 0.9]] : [[0.1, v0 + g * 1.0], [-2.6, spot[1] + g], [spot[0] + 0.4, spot[1] + g * 0.5]])
      : [[Math.max(0, D(rusher)[0] * 0.3), v0 * 0.7], [-1.6, spot[1] + g * 1.4], [spot[0] + 0.4, spot[1] + g * 0.5]];
    R('QB', [dropTo], 0, 5, { t1: dropT, pa: 0.25, pd: 0.35 });
    T.move(ballId, posL('QB', shot ? 0.3 : 0.12), SN, SN + (shot ? 0.3 : 0.12), shot ? { arc: 6 } : {});
    passPro(isDL ? [rusher] : [], 4); sendRoutes([]); zoneDrop('c3', [rusher]);
    const tS = RT(dd(rusher), rp, 0.12, 1.95 + rnd() * 0.4, { pa: 0.25 });
    M('QB', [(dropTo[0] + spot[0]) / 2, dropTo[1] * 0.4 + spot[1] * 0.6], dropT + 0.1, tS - 0.3, { prof: 1, pa: 0.3, pd: 0.3 }); M('QB', spot, tS - 0.3, tS + 0.25, { prof: 1, pa: 0.3, pd: 0.5 });
    FOL(ballId, 'QB', shot ? 0.3 : 0.12, tS + 9, 0, 0, { bl: 0 });
    FOL(dd(rusher), 'QB', tS, tS + 1.1, 0.4, g * 0.6, { bl: 0.12 });
    FX(tS, to(spot[0], spot[1]), 'SACK', 'good');
    result.end = to(spot[0], spot[1]); done(tS + 1.0);
  };

  /* ---- kicks: snap to the holder, spot the ball, kick; the line holds and the wings / corners rush ---- */
  const kickPlay = () => {
    const holder = O('QB'), made = play.made, goalAbs = dir === 1 ? 110 : -10, endX = lvX(goalAbs), far = { x: endX, y: lvY(made ? 0.3 : (rnd() < 0.5 ? -4.6 : 4.6)) };
    T.move(ballId, posL('QB', 0.45), SN, SN + 0.45, { arc: 3 }); FOL(ballId, 'QB', 0.45, 1.3, 0, 0, { bl: 0 });
    R('K', [[holder[0] - 1.1, holder[1] - 1.2]], 0.2, 6, { t1: 1.26, pa: 0.3, pd: 0 });
    R('K', [[holder[0] + 0.9, holder[1] - 0.4]], 1.26, 5, { t1: 1.5, pd: 0.3 });             // follow-through
    DLS.forEach(d => FOL(dd(d), pairDL[d], 0.1, 1.9, 1.15, 0, { wob: 3, fq: 7 + rnd() * 3, bl: 0.2 }));
    [['LB2', 'WR3'], ['LB3', 'WR2'], ['LB1', 'TE']].forEach(([r, w]) => { R(dd(r), [[D(r)[0] - 0.2, O(w)[1] + (D(r)[1] - O(w)[1]) * 0.2]], 0.1, 6); FOL(dd(r), w, 0.8, 1.9, 0.9, 0, { wob: 2.4, bl: 0.2 }); });
    [['CB1', 'WR1'], ['CB2', 'WR2']].forEach(([r, w]) => R(dd(r), [[1.2, D(r)[1] * 0.7]], 0.1, 6));
    T.move(ballId, far, SN + 1.3, SN + 2.7, { arc: 70 }); result.end = far; done(3.9);
    FX(2.6, { x: 600, y: lvY(-2) }, made ? (k === 'xp' ? 'EXTRA POINT GOOD' : `FIELD GOAL GOOD — ${play.yards} YDS`) : `NO GOOD — ${play.yards} YDS`, made ? 'good' : 'bad', true);
    result.text = made ? (k === 'xp' ? 'Extra point is good' : `${play.yards}-yard field goal is GOOD`) : `${play.yards}-yard field goal is NO GOOD`;
  };

  const passerTarget = () => (rnd() < 0.08 ? 'RB' : pick(['WR1', 'WR2', 'WR3', 'TE']));
  const rushCarrier = () => (S.player.pos === 'RB' ? 'RB' : LV_ME[S.player.pos]);
  const pickAir = (r, lo, hi) => (r === 'RB' ? Math.round(rr(1, 6)) : Math.round(rr(lo, hi)));
  switch (k) {
    case 'catch': { const target = LV_ME[S.player.pos], y = Math.max(0, play.yards), air = play.td ? Math.max(1, Math.round(y * rr(0.35, 0.8))) : Math.round(y * rr(0.4, 0.85)); passTo(target, Math.max(0.5, air), Math.max(0, y - air), 'comp', manOf[target], { td: play.td }); result.text = `${play.td ? 'TOUCHDOWN — ' : ''}${y}-yard catch`; break; }
    case 'incomplete': { const target = LV_ME[S.player.pos]; passTo(target, pickAir(target, 6, 20), 0, 'inc', manOf[target], { drop: play.drop }); result.text = play.drop ? 'Pass hits your hands — dropped' : 'Pass falls incomplete'; break; }
    case 'qbPass': { const t = passerTarget(), y = Math.max(0, play.yards), air = Math.max(1, Math.round(y * rr(0.5, 0.9))); passTo(t, t === 'RB' ? Math.min(air, 7) : air, Math.max(0, y - (t === 'RB' ? Math.min(air, 7) : air)), 'comp', manOf[t], { td: play.td }); result.text = `${play.td ? 'TOUCHDOWN — ' : ''}${y}-yard completion`; break; }
    case 'qbInc': { const t = passerTarget(); passTo(t, pickAir(t, 6, 22), 0, 'inc', manOf[t]); result.text = 'Pass falls incomplete'; break; }
    case 'qbInt': { const t = passerTarget(); passTo(t, pickAir(t, 8, 22), 0, 'int', t === 'RB' ? 'LB1' : pick([manOf[t], manOf[t], 'S1'])); result.text = 'INTERCEPTED'; break; }
    case 'rush': runPlay(rushCarrier(), play.yards, play.td); result.text = `${play.td ? 'TOUCHDOWN — ' : ''}${play.yards}-yard run`; break;
    case 'qbRush': { const tF = scramblePlay(play.yards, play.td); done(tF + 0.9); result.text = `${play.td ? 'TOUCHDOWN — ' : ''}${play.yards}-yard scramble`; break; }
    case 'pancake': runPlay('RB', play.yards, false, { hv: O(me)[1] + rr(-1.5, 1.5), pan: me }); result.text = 'Pancake block springs a run'; break;
    case 'block': runPlay('RB', play.yards, false, { hv: O(me)[1] + rr(-2, 2), surge: 0.8 }); result.text = `Solid block — ${play.yards}-yard gain`; break;
    case 'pressure': passTo('WR2', 12, 0, 'inc', 'CB2', { hurry: true, rusher: pairOL(me) }); result.text = 'Defender beats you — QB hurried'; break;
    case 'sackAllowed': sackPlay(pairOL(me), play.yards); result.text = 'Sack allowed'; break;
    case 'penalty': runPlay('RB', 3, false); FX(1.0, posL('QB', 1.0), '🚩 FLAG', 'bad'); result.text = `Penalty on you (${Math.abs(play.yards)} yds)`; break;
    case 'sack': sackPlay(meDef, play.yards); result.text = play.half ? 'Shared sack' : 'SACK!'; break;
    case 'tackle': {
      const y = Math.max(-1, play.yards); let r;
      if (F.pass) { const air = Math.max(1, y - 2); r = passTo(tgtOf[meDef] || 'WR2', air, Math.max(0, y - air), 'comp', meDef, { first: meDef, solo: play.solo }); }
      else r = runPlay('RB', y, false, { hv: holeFor(meDef), first: meDef, solo: play.solo });
      if (play.ff) { const e = r.end, tb = r.tFin - 0.4; FX(tb + 0.2, to(e.u, e.v), 'FORCED FUMBLE!', 'good'); T.move(ballId, to(e.u + 1.8, e.v - 1.8), SN + tb, SN + tb + 0.5, { arc: 22 }); done(r.tFin + 1.2); }
      result.text = `${play.solo ? 'Tackle' : 'Assisted tackle'} for ${y >= 0 ? y : 'a loss of ' + Math.abs(y)}${y >= 0 ? ' yards' : ''}${play.ff ? ' — fumble forced' : ''}`; break;
    }
    case 'int': if (meDef === 'DL2') tipPlay('int'); else passTo(tgtOf[meDef] || 'WR2', Math.round(rr(8, 18)), 0, 'int', meDef); result.text = play.td ? 'PICK SIX!' : 'INTERCEPTION'; break;
    case 'pd': if (meDef === 'DL2') tipPlay('pd'); else passTo(tgtOf[meDef] || 'WR2', Math.round(rr(7, 18)), 0, 'pd', meDef); result.text = meDef === 'DL2' ? 'Pass batted down' : 'Pass broken up'; break;
    case 'frec': {
      const r = runPlay('RB', 3, false, { hv: holeFor(meDef), fumble: true }), e = r.end, tb = r.tEnd - 0.1, loose = [e.u + rr(1.2, 2.6), clampV(e.v + rr(-2.5, 2.5))];
      T.move(ballId, to(loose[0], loose[1]), SN + tb, SN + tb + 0.5, { arc: 22 }); T.move(ballId, to(loose[0] + 0.9, loose[1] + 0.5), SN + tb + 0.5, SN + tb + 0.75, { arc: 6 });
      const tRec = RT(dd(meDef), [loose], 0.5, tb + 0.7, { pa: 0.25, pd: 0.3 });
      FX(tRec, to(loose[0], loose[1]), 'FUMBLE RECOVERED', 'good');
      FOL(ballId, dd(meDef), tRec, tRec + 12, 0, 0, { bl: 0 });
      if (play.td) {
        const gu = -(play.los + 2), tEnd = R(dd(meDef), [[(loose[0] + gu) / 2, loose[1] + rr(-3, 3)], [gu, loose[1] + rr(-3, 3)]], tRec + 0.05, 8.2, { pa: 0.25, pd: 0 });
        const tf = swarm(dd(meDef), tEnd, { ids: SKILL, td: true, trail: 1, n: 3, tR: tRec + 0.1 }); result.end = to(gu, loose[1]); done(tf + 0.9);
      } else { result.end = to(loose[0], loose[1]); done(tRec + 1.1); }
      result.text = play.td ? 'Fumble recovery — TOUCHDOWN' : 'Fumble recovered'; break;
    }
    case 'fg': case 'xp': kickPlay(); break;
  }
  if (play.td) result.fx.push({ t: Math.max(0, result.dur - 1.1), p: result.end || P(0, 0), text: 'TOUCHDOWN!', cls: 'td', sticky: true });
  if (play.td) result.dur += 1.1;
  return result;
}

/* ---------- player (the viewer) ---------- */
function lvStatLine(T) { const cfg = POS[S.player.pos], lines = cfg.line(T); return lines.map(l => `<div><b>${esc(String(l.v == null ? 0 : (typeof l.v === 'string' || Number.isInteger(l.v) ? l.v : fmt1(l.v))))}</b><span>${l.l}</span></div>`).join(''); }

function lvScoreboardHTML(L) {
  const a = TEAM[L.away], h = TEAM[L.home];
  // broadcast-style score bug: a silver frame, a team window with a possession dot over a black score bar on each side, and the down & distance / quarter + clock block in the middle
  const side = (t, s) => `<div class="bug-side ${s}"><div class="bug-logo"><img src="${logoUrl(t.id)}" alt=""><i class="lv-poss" id="lvPoss_${s}"></i></div><div class="bug-score"><b>${t.id}</b><span class="lv-score" id="lvScore_${s}">0</span></div></div>`;
  return `<div class="lv-bug" id="lvBug">${side(a, 'away')}<div class="bug-mid"><div class="bug-dd" id="lvBugDD">KICKOFF</div><div class="bug-brand"><img src="${NFL_LOGO}" alt="NFL"></div><div class="bug-clock"><span id="lvQ">1st Q</span><b id="lvClock">15:00</b></div></div>${side(h, 'home')}</div>`;
}

// background track by broadcast window: Thursday night, Sunday game day, Sunday night, Monday night
function lvTrack(game) {
  const n = String(game.slotName || ''), r = String(game.round || '');
  if (/monday/i.test(n)) return 'assets/sounds/live-monday-night.mp3';
  if (/thursday|thanksgiving|wednesday|friday|christmas/i.test(n)) return 'assets/sounds/live-thursday-night.mp3';
  if (/night/i.test(n) || /super bowl/i.test(r + n)) return 'assets/sounds/live-sunday-night.mp3';
  return 'assets/sounds/live-sunday-gameday.mp3';
}
async function openLiveGame(game, notes, season) {
  const myId = game.tm, oppId = game.opp, away = game.home ? oppId : myId, home = game.home ? myId : oppId, P = S.player;
  const myDir = game.home ? -1 : 1;                          // away team attacks to the right, home team to the left
  const L = { game, away, home, myId, oppId, myDir, score: { away: 0, home: 0 }, T: {}, token: ++LV.run, skipped: false, speed: LV.speed || 1 };
  POS[P.pos].stats.forEach(x => { L.T[x.k] = 0; });
  const ov = document.createElement('div'); ov.className = 'lv-overlay'; ov.id = 'lvOverlay'; ov.style.cssText = `${themeVars(myId)}`;
  const label = game.k === 'PO' ? (game.round || 'PLAYOFFS') : `WEEK ${game.wk}`;
  const whenTxt = game.date && typeof calShort === 'function' ? ` · ${calShort(new Date(game.date + 'T00:00:00Z'))} · ${game.time} ET` : '';
  ov.innerHTML = `<div class="lv-wrap">
    <div class="lv-top"><span class="lv-live"><i></i>LIVE</span><b>${label}</b><span class="muted">${TEAM[away].name} @ ${TEAM[home].name}${whenTxt}</span><div class="lv-ctrl"><label class="lv-vol" title="Music volume">🎵<input type="range" id="lvMusic" min="0" max="100" step="1" value="40" aria-label="Music volume"></label><button class="mini on" data-lv-speed="1">1×</button><button class="mini" data-lv-speed="2">2×</button><button class="mini" data-lv-speed="4">4×</button><button class="btn btn-ghost btn-sm" id="lvSkip">SKIP ▸</button></div></div>
    ${lvScoreboardHTML(L)}
    <div class="lv-stage">${lvFieldSVG(away, home, /super bowl|^SB$/i.test(String(game.round || '')))}<div class="lv-banner" id="lvBanner"></div></div>
    <div class="lv-bottom">
      <div class="lv-info card"><div class="lv-dd" id="lvDD">Kickoff</div><div class="lv-text" id="lvText">${game.st === 'OUT' ? (game.dnp ? "You are not active today — you'll follow the game from the sideline." : 'You are out with an injury — you follow the game from the sideline.') : 'Watching every snap you are part of…'}</div></div>
      <div class="lv-me card"><div class="lv-me-h">${esc(P.name)} · ${P.pos} · #${playerNumber()}</div><div class="lv-tiles" id="lvTiles"></div></div>
      <div class="lv-log card" id="lvLog"></div>
    </div></div>`;
  document.body.appendChild(ov);
  const musicVol = () => { let v = 40; try { const x = parseInt(localStorage.getItem('nfl_music_vol'), 10); if (x >= 0 && x <= 100) v = x; } catch (e) { /* ignore */ } return v; };
  Snd.music(lvTrack(game), musicVol() / 100 * 0.8);
  const mv = ov.querySelector('#lvMusic'); if (mv) { mv.value = musicVol(); mv.addEventListener('input', () => { Snd.setMusicVol(mv.value / 100 * 0.8); try { localStorage.setItem('nfl_music_vol', mv.value); } catch (e) { /* ignore */ } }); }
  const $ = id => document.getElementById(id), setScore = () => { $('lvScore_away').textContent = L.score.away; $('lvScore_home').textContent = L.score.home; };
  const setClock = (q, clock) => { $('lvQ').textContent = ['1st', '2nd', '3rd', '4th'][q - 1] + ' Q'; $('lvClock').textContent = clock; };
  const setBugDD = txt => { const el = $('lvBugDD'); if (el) el.textContent = txt; };
  // the clock only runs while a play is live, in real seconds (at 2x / 4x it simply runs faster, like the play itself); between plays it just shows the next snap's time
  const clockOf = gt => { const q = Math.min(4, Math.floor(gt / 900) + 1), left = Math.max(0, 900 - (gt - (q - 1) * 900)); return [q, `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`]; };
  L.frozen = false;
  const sleep = ms => new Promise(r => { const t = setTimeout(r, ms / L.speed); L.waits = L.waits || []; L.waits.push(() => { clearTimeout(t); r(); }); });
  const alive = () => LV.run === L.token && document.getElementById('lvOverlay') && !L.skipped;
  const log = (q, clock, text, cls = '') => { const el = $('lvLog'); if (!el) return; el.insertAdjacentHTML('afterbegin', `<div class="lv-row ${cls}"><em>Q${q} ${clock}</em><span>${text}</span></div>`); };
  const tiles = () => { const el = $('lvTiles'); if (el) el.innerHTML = lvStatLine(L.T); };
  tiles();
  ov.querySelectorAll('[data-lv-speed]').forEach(b => b.addEventListener('click', () => { L.speed = Number(b.dataset.lvSpeed); LV.speed = L.speed; ov.querySelectorAll('[data-lv-speed]').forEach(x => x.classList.toggle('on', x === b)); }));
  const finish = () => {
    Snd.stopMusic(500);
    if (L.finished) return; L.finished = true; L.skipped = true;  (L.waits || []).splice(0).forEach(f => f()); if (L.cancelAnim) L.cancelAnim();
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
    Snd.stopMusic(900);
    L.score = { away: game.home ? game.op : game.my, home: game.home ? game.my : game.op }; setScore();
    const el = document.getElementById('lvOverlay'); if (!el) return finish();
    const win = game.w; POS[P.pos].stats.forEach(x => { L.T[x.k] = (game.s || {})[x.k] || 0; }); tiles(); L.frozen = true; setClock(4, '0:00'); setBugDD('FINAL');
    const b = $('lvBanner'); if (b) { b.className = `lv-banner show final ${win ? 'good' : 'bad'}`; b.innerHTML = `<small>FINAL</small>${win ? 'VICTORY' : 'DEFEAT'}<span>${TEAM[away].id} ${L.score.away} — ${L.score.home} ${TEAM[home].id}</span><button class="btn btn-primary" id="lvDone">CONTINUE ▸</button>`; const d = $('lvDone'); if (d) d.addEventListener('click', finish); }
    const sk = $('lvSkip'); if (sk) sk.style.display = 'none'; Snd.play(win ? 'fanfare' : 'down');
    if (win) { const st = el.querySelector('.lv-stage') || el; burst(st, 70); setTimeout(() => burst(st, 50), 450); }   // team-colored confetti
  };
  /* ---- play the script ---- */
  await sleep(700);
  const script = lvBuild(game);
  for (let si = 0; si < script.length; si++) {
    const e = script[si];
    if (!alive()) break;
    setClock(e.q, e.clock);
    if (e.type === 'score') {
      const side = sideOf(e.side); poss(side); L.score[side] += e.pts; setScore(); bumpScore(side);
      const t = TEAM[e.side === 'me' ? myId : oppId];
      log(e.q, e.clock, `${t.id} — ${e.label} (+${e.pts})`, e.side === 'me' ? 'good' : 'bad'); $('lvText').textContent = `${t.name}: ${e.label}`; $('lvDD').textContent = `${TEAM[away].id} ${L.score.away} – ${L.score.home} ${TEAM[home].id}`; setBugDD(String(e.label || 'SCORE').toUpperCase());
      Snd.play(e.side === 'me' ? 'cheer' : 'down'); await banner(`${t.id} ${e.label}`, e.side === 'me' ? 'good' : 'bad', 1300); await sleep(300);
      continue;
    }
    const p = e.play, sc = lvScene(p, { myDir, myId, oppId });
    poss(sideOf(p.off));
    const dd = p.kind === 'xp' ? 'Extra point' : p.kind === 'fg' ? `Field goal · ${p.yards} yds` : `${['', '1st', '2nd', '3rd', '4th'][p.down]} & ${p.dist}`;
    const spot = p.los < 50 ? `${TEAM[p.off === 'me' ? myId : oppId].id} ${p.los}` : (p.los === 50 ? 'Midfield' : `${TEAM[p.off === 'me' ? oppId : myId].id} ${100 - p.los}`);
    $('lvDD').textContent = `${dd} · ball on ${spot}`; setBugDD(p.kind === 'xp' ? 'Extra Point' : p.kind === 'fg' ? `FG ${p.yards} yds` : `${['', '1st', '2nd', '3rd', '4th'][p.down]} & ${p.dist}`); $('lvText').textContent = '…';
    const A = lvMakeActors(sc, p), T = lvTimeline(A), res = lvPlayScript(p, sc, A, T); LV.last = { A, T, res, sc, p };
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
        const real = ((ts - start) / 1000) * L.speed, t = real * LV_PACE; T.render(t); { const nx = script[si + 1], live = Math.max(0, Math.min(real, res.dur / LV_PACE) - res.snap / LV_PACE), [cq, cc] = clockOf(Math.min(e.t + live, nx ? nx.t - 0.5 : e.q * 900)); if (!L.frozen) setClock(cq, cc); }
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

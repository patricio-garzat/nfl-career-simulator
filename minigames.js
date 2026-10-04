/* =====================================================================
   PRESEASON CAMP — at the start of each season you play ONE mini game for your position; the grade sets how the whole season goes and how your rating moves:
     QB    → FIND THE OPEN MAN (WR or RB; level 3: the defense switches)
     RB    → FIND THE HOLE    (3 gaps, a defense that shifts, a juke at the end)
     WR/TE → CATCH IT         (different throws: deep, slant, lob, knuckle, contested)
     K     → KICK IT          (different situations: hash, rain, snow, wind, pressure)
   Other positions have none. 3 levels (each harder), 2 or more = a good grade; perfect plays add a small extra bonus.
   Scenes are drawn with your team's colors and logo, the rival's, and YOUR jersey. Sounds are tiny single events (Snd.play('mg…')).
   State lives in the season object (season.mg, season.buffs, season.mgLog), so it saves with the career.
   ===================================================================== */
// 3 levels per camp; each one is as hard as attempts 1 / 3 / 5 used to be. raw hits (0-3) -> grade score (0-5)
const MG_LV = [0, 2, 4], MG_SC = [0, 2, 3, 5];
const MG_KIND = { QB: 'qb', RB: 'rb', WR: 'catch', TE: 'catch', K: 'kick' };
const MG_GRADES = [
  { n: 'DISASTER', perf: -0.06, left: 2 }, { n: 'BAD DAY', perf: -0.06, left: 2 }, { n: 'ROUGH', perf: -0.03, left: 2 },
  { n: 'GOOD', perf: 0.04, left: 3 }, { n: 'GREAT', perf: 0.07, left: 3 }, { n: 'PERFECT', perf: 0.10, left: 3 },
];

function mgEnsure(se) { se.buffs = se.buffs || []; se.mgLog = se.mgLog || []; se.train = se.train || { phys: 0, ment: 0 }; se.injExtra = se.injExtra || 0; if (se.mgIn == null) se.mgIn = randInt(3, 5); if (se.mgSince == null) se.mgSince = 0; return se; }
function mgInitSeason(season, pos) { pos = pos || (S && S.player && S.player.pos); season.buffs = []; season.mg = MG_KIND[pos] ? { kind: MG_KIND[pos], wk: 0, age: 0 } : null; season.mgLog = []; season.mgIn = randInt(3, 5); season.mgSince = 0; season.train = { phys: 0, ment: 0 }; season.injExtra = 0; }
function mgMods(se) { let perf = 1; (se.buffs || []).forEach(b => { if (b.left > 0) perf *= 1 + (b.perf || 0); }); return { perf, inj: 1, team: 0 }; }
// after every game the bonuses age (the camp bonus lasts the whole season); there are no more mini games during the season
function mgAfterGame(se, game, notes) { mgEnsure(se); se.buffs.forEach(b => { b.left--; }); se.buffs = se.buffs.filter(b => b.left > 0); }
const MG_META = {
  qb: P => ({ icon: '🏈', title: 'POCKET PRESENCE', how: 'Dodge the pass rush inside the pocket and press SPACE when the bar is in the green to throw to your WR. Wait too long and you get sacked.', legend: [['', '← → ↑ ↓ move', 'dodge the rush'], ['', 'SPACE', 'throw in the green'], ['', 'Too slow', 'SACK']] }),
  rb: P => ({ icon: '🏃', title: 'RUSH FOR YARDS', how: 'Take the handoff, hit the hole the line opens, then keep dodging tacklers. Hold SPACE to run and use the arrows to turn. Every yard is a point (10 more for a touchdown) and your points raise your performance.', legend: [['', 'SPACE', 'run forward'], ['', '← →', 'turn'], ['', 'Every yard', '1 point'], ['', 'Touchdown', '+10 points']] }),
  catch: P => ({ icon: '🙌', title: P.pos === 'TE' ? 'CATCH IT · SEAM' : 'CATCH IT · GO ROUTE', how: 'A three-play drive: catch to move the chains, and the last pass is for the touchdown. Run to where the ball will land.', legend: [['⌨️', 'Arrow keys / drag', 'move'], ['⭕', 'Ring', 'be there first']] }),
  kick: P => ({ icon: '🥅', title: 'KICK IT', how: 'Aim into the wind, stop the bar in the green.', legend: [['💨', 'Wind pushes', 'AIM AGAINST'], ['⏹', 'Power', 'GREEN']] }),
};
/* weekly training: the camp mini game opens the season; after that, every week you can play it again from a button. Playing lifts your next game
   (a bigger lift for a better score, plus a small streak bonus for training week after week); skipping the week just means no lift. */
const MG_WEEK_PERF = [0.01, 0.01, 0.015, 0.03, 0.045, 0.06];
const mgGamesIn = se => (se && se.games ? se.games.length : 0);
const mgCanTrain = (se, pos) => !!(se && !se.mg && !se.done && (se.status == null || se.status === 'regular') && MG_KIND[pos || (se.P || S.player).pos] && se.mgTrainAt !== mgGamesIn(se) && mgGamesIn(se) < (se.schedule ? se.schedule.length : 99));
function mgWeeklyHTML(se, act = 'playWeekly') {
  const pos = (se.P || S.player).pos; if (!MG_KIND[pos] || se.mg || se.done || !(se.status == null || se.status === 'regular')) return '';
  const n = mgGamesIn(se) + 1, meta = MG_META[MG_KIND[pos]](se.P || S.player);
  if (se.mgTrainAt === mgGamesIn(se)) return `<div class="banner dec-banner trained"><span>✅ <b>TRAINED FOR WEEK ${n}</b> — your next game gets the boost${se.mgStreak > 1 ? ` · ${se.mgStreak}-week streak` : ''}</span></div>`;
  const streak = se.mgTrainAt === mgGamesIn(se) - 1 && se.mgStreak ? se.mgStreak : 0;
  return `<div class="banner dec-banner weekly"><span>🎮 <b>WEEK ${n} TRAINING</b> — ${meta.title} · play it to boost your next game${streak ? ` · ${streak}-week streak` : ''}</span><button class="btn btn-primary btn-sm" data-act="${act}">PLAY</button></div>`;
}
function mgStartWeekly(env) {
  const se = env.se, pos = env.P.pos; if (!mgCanTrain(se, pos)) return false;
  se.mg = { kind: MG_KIND[pos], wk: mgGamesIn(se), age: 0, weekly: true }; mgOpen(env); return true;
}
const mgBannerHTML = se => (se.mg && MG_META[se.mg.kind]) ? `<div class="banner dec-banner"><span>🎮 <b>PRESEASON CAMP</b> — ${MG_META[se.mg.kind](S.player).title}</span><button class="btn btn-primary btn-sm" data-act="playMini">PLAY</button></div>` : '';

/* ---------- shared drawing kit ---------- */
const mgStroke = c => (lum(c) > 0.7 ? '#10151d' : '#ffffff');
// a pile of tiny fans in the stands (stable pattern, rows sway one after the other)
function mgCrowd(x, y, w, rows, c1, c2) {
  const pal = ['#ffffff', c1, c2, '#8ea0c8', '#1c2740', c1]; let s = '';
  for (let r = 0; r < rows; r++) {
    s += `<g class="mg-cr" style="animation-delay:${(r * 0.21).toFixed(2)}s">`;
    for (let k = 0; k < Math.floor(w / 7); k++) s += `<circle cx="${(x + 3 + k * 7 + (r % 2 ? 3.5 : 0)).toFixed(1)}" cy="${(y + r * 6.4).toFixed(1)}" r="2.7" fill="${pal[(k * 7 + r * 13 + ((k * r) % 5)) % pal.length]}" opacity="${(0.4 + ((k * 31 + r * 17) % 55) / 100).toFixed(2)}"/>`;
    s += '</g>';
  }
  return s;
}
// stadium lights: soft glows tinted with the team color
const mgLights = (id, c1) => `<radialGradient id="${id}"><stop offset="0" stop-color="${mixHex(c1, '#ffffff', 0.55)}" stop-opacity=".75"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient>`;
const mgFlares = (id, w = 340) => [[18, 8], [w / 3, 2], [w * 2 / 3, 2], [w - 18, 8]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="46" fill="url(#${id})" class="mg-flare"/>`).join('');
// a player seen from above: shoulders, helmet, facemask (down = faces the other way)
let mgGid = 0;
// a top-down football player: ground shadow, legs and cleats, swinging arms, shoulder pads with a stripe and a (back) number, and a glossy helmet with a facemask.
// f = jersey color, t = helmet / trim color. o: s scale, down (faces down the screen), cls, attrs, you (ring + number), num, run (limbs swing)
const mgGuy = (x, y, f, t, o = {}) => {
  const s = o.s || 1, id = 'mgG' + (++mgGid), dk = c => mixHex(c, '#000000', 0.38), lt = c => mixHex(c, '#ffffff', 0.38), line = mgStroke(f), hl = mgStroke(t), tr = lum(f) > 0.55 ? dk(f) : lt(f);
  const num = o.num != null && o.num !== '' ? `<text y="${(2.1 * s).toFixed(1)}" text-anchor="middle" font-size="${(5.6 * s).toFixed(1)}" font-weight="800" font-family="Barlow Condensed, sans-serif" fill="#fff" stroke="rgba(0,0,0,.65)" stroke-width="${(1.1 * s).toFixed(1)}" paint-order="stroke" transform="${o.down ? '' : ''}">${esc(String(o.num))}</text>` : '';
  return `<g class="mg-guy ${o.cls || ''}${o.run ? ' mg-run' : ''}" ${o.attrs || ''} transform="translate(${x} ${y})">
    <defs><radialGradient id="${id}j" cx="38%" cy="30%" r="85%"><stop offset="0" stop-color="${lt(f)}"/><stop offset=".55" stop-color="${f}"/><stop offset="1" stop-color="${dk(f)}"/></radialGradient>
    <radialGradient id="${id}h" cx="36%" cy="30%" r="80%"><stop offset="0" stop-color="${lt(t)}"/><stop offset=".5" stop-color="${t}"/><stop offset="1" stop-color="${dk(t)}"/></radialGradient></defs>
    ${o.you ? `<circle r="${15 * s}" fill="rgba(255,210,61,.18)" stroke="#ffd23d" stroke-width="2" class="mg-you"/>` : ''}
    <ellipse cx="${(2.4 * s).toFixed(1)}" cy="${(3.2 * s).toFixed(1)}" rx="${(11.5 * s).toFixed(1)}" ry="${(7.4 * s).toFixed(1)}" fill="#000" opacity=".34"/>
    <g class="mg-body" ${o.down ? 'transform="rotate(180)"' : ''}>
      <ellipse class="mg-lg l" cx="${(-4.2 * s).toFixed(1)}" cy="${(6.2 * s).toFixed(1)}" rx="${(2.7 * s).toFixed(1)}" ry="${(3.4 * s).toFixed(1)}" fill="#2a3040" stroke="#0a0d14" stroke-width=".7"/>
      <ellipse class="mg-lg r" cx="${(4.2 * s).toFixed(1)}" cy="${(6.2 * s).toFixed(1)}" rx="${(2.7 * s).toFixed(1)}" ry="${(3.4 * s).toFixed(1)}" fill="#2a3040" stroke="#0a0d14" stroke-width=".7"/>
      <ellipse class="mg-ar l" cx="${(-10.6 * s).toFixed(1)}" cy="${(0.8 * s).toFixed(1)}" rx="${(2.5 * s).toFixed(1)}" ry="${(4.3 * s).toFixed(1)}" fill="${dk(f)}" stroke="${line}" stroke-width=".6" stroke-opacity=".7"/>
      <ellipse class="mg-ar r" cx="${(10.6 * s).toFixed(1)}" cy="${(0.8 * s).toFixed(1)}" rx="${(2.5 * s).toFixed(1)}" ry="${(4.3 * s).toFixed(1)}" fill="${dk(f)}" stroke="${line}" stroke-width=".6" stroke-opacity=".7"/>
      <ellipse cx="0" cy="${(1.2 * s).toFixed(1)}" rx="${(10.4 * s).toFixed(1)}" ry="${(6.2 * s).toFixed(1)}" fill="url(#${id}j)" stroke="${line}" stroke-width="1.1" stroke-opacity=".85"/>
      <path d="M${(-8.4 * s).toFixed(1)} ${(-1.4 * s).toFixed(1)}Q0 ${(-5.6 * s).toFixed(1)} ${(8.4 * s).toFixed(1)} ${(-1.4 * s).toFixed(1)}" fill="none" stroke="${tr}" stroke-width="${(1.5 * s).toFixed(1)}" stroke-linecap="round" opacity=".85"/>
      ${num}
      <circle cx="0" cy="${(-1.2 * s).toFixed(1)}" r="${(5 * s).toFixed(1)}" fill="url(#${id}h)" stroke="${hl}" stroke-width="1" stroke-opacity=".9"/>
      <path d="M0 ${(-6 * s).toFixed(1)}V${(3.4 * s).toFixed(1)}" stroke="${tr}" stroke-width="${(1.5 * s).toFixed(1)}" stroke-linecap="round" opacity=".7"/>
      <path d="M${(-3.2 * s).toFixed(1)} ${(-5.4 * s).toFixed(1)}Q0 ${(-8.6 * s).toFixed(1)} ${(3.2 * s).toFixed(1)} ${(-5.4 * s).toFixed(1)}" fill="none" stroke="#cfd6e4" stroke-width="${(.9 * s).toFixed(1)}" stroke-linecap="round"/>
      <ellipse cx="${(-1.6 * s).toFixed(1)}" cy="${(-3.2 * s).toFixed(1)}" rx="${(1.5 * s).toFixed(1)}" ry="${(1 * s).toFixed(1)}" fill="#fff" opacity=".55"/>
    </g></g>`;
};
const mgBall = (x, y, s = 1, rot = 0, id = '') => { const g = 'mgB' + (++mgGid); return `<g ${id ? `id="${id}"` : ''} transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><defs><radialGradient id="${g}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#c47a3c"/><stop offset=".55" stop-color="#8a4b22"/><stop offset="1" stop-color="#4a2209"/></radialGradient></defs><ellipse rx="11" ry="7" fill="url(#${g})" stroke="#3d1c08" stroke-width="1.3"/><path d="M-5 0H5M-2.5 -2.2v4.4M0 -2.2v4.4M2.5 -2.2v4.4" stroke="#fff" stroke-width="1.1" fill="none" stroke-linecap="round"/><path d="M-8.6 -3.2Q0 -6.6 8.6 -3.2" stroke="#fff" stroke-opacity=".5" stroke-width="1.1" fill="none" stroke-linecap="round"/><ellipse cx="-3" cy="-2.6" rx="4.4" ry="1.5" fill="#fff" opacity=".28"/></g>`; };
const mgFootball = cls => `<svg viewBox="0 0 24 14" class="mg-fb ${cls || ''}"><ellipse cx="12" cy="7" rx="11" ry="6.2"/><path d="M8 7h8M10 5.2v3.6M12 5.2v3.6M14 5.2v3.6" /></svg>`;
const mgShuffleNoRepeat = (keys, n) => { const out = shuffle(keys.slice()).slice(0, n); while (out.length < n) { let k; do { k = pick(keys); } while (k === out[out.length - 1]); out.push(k); } return out; };
const mgYardsStr = y => `${y >= 0 ? '+' : '−'}${Math.abs(y)} YDS`;
/* ---------- the live-game field in miniature (same turf, mowing stripes, grass blades, white lines, hash marks, slab yard numbers and end zones) ---------- */
function mgGrassPat(id) {
  let sd = 7; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647; let b = '';
  for (let i = 0; i < 46; i++) { const x = R() * 44, y = 6 + R() * 38, len = 3 + R() * 5, dx = (R() - 0.5) * 3, dark = R() < 0.55; b += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + dx).toFixed(1)}" y2="${(y - len).toFixed(1)}" stroke="${dark ? '#06240f' : '#c9f59a'}" stroke-opacity="${dark ? (0.10 + R() * 0.08).toFixed(2) : (0.06 + R() * 0.07).toFixed(2)}" stroke-width="${(0.7 + R() * 0.6).toFixed(1)}"/>`; }
  return `<pattern id="${id}" width="44" height="44" patternUnits="userSpaceOnUse">${b}</pattern>`;
}
// o: { id, w, sl (sideline x), band (white band width outside it), y0, y1 (drawn range), yRef/Aref (screen y of a yard line, upfield = up), ppy (px per yard), Amin, Amax, numL, numR, hashes }
function mgFieldInner(o) {
  const { w, sl, y0, y1, yRef, Aref, ppy } = o, yOf = A => yRef - (A - Aref) * ppy, Amin = Math.max(0, o.Amin), Amax = Math.min(100, o.Amax), cx = w / 2;
  let out = `<rect x="0" y="${y0}" width="${w}" height="${y1 - y0}" fill="#2b7d47"/>`;
  for (let A = Math.floor(Amin / 5) * 5; A < Amax; A += 5) if ((A / 5) % 2) out += `<rect x="${sl}" y="${yOf(A + 5)}" width="${w - sl * 2}" height="${5 * ppy}" fill="#fff" opacity=".04"/>`;     // mowing stripes
  const bw = o.band == null ? sl : o.band;
  out += `<rect x="${sl - bw}" y="${y0}" width="${bw}" height="${y1 - y0}" fill="#f6f7f4"/><rect x="${w - sl}" y="${y0}" width="${bw}" height="${y1 - y0}" fill="#f6f7f4"/>`;
  out += `<rect x="0" y="${y0}" width="${w}" height="${y1 - y0}" fill="url(#${o.id})" pointer-events="none"/>`;
  for (let A = Math.ceil(Amin / 5) * 5; A <= Amax; A += 5) { const y = yOf(A); out += `<line x1="${sl}" x2="${w - sl}" y1="${y}" y2="${y}" stroke="#fff" stroke-opacity=".95" stroke-width="${(A === 0 || A === 100 ? 3.2 : 2) * Math.max(0.7, ppy / 10)}"/>`; }
  if (o.hashes !== false) for (let A = Math.ceil(Amin); A <= Amax; A++) { if (A % 5 === 0) continue; const y = yOf(A), l = Math.max(2.6, ppy * 0.7), c = 3.08 * ppy; out += `<g stroke="#fff" stroke-opacity=".85" stroke-width="${Math.max(1, ppy * 0.18)}"><line x1="${cx - c - l / 2}" x2="${cx - c + l / 2}" y1="${y}" y2="${y}"/><line x1="${cx + c - l / 2}" x2="${cx + c + l / 2}" y1="${y}" y2="${y}"/><line x1="${sl}" x2="${sl + l}" y1="${y}" y2="${y}"/><line x1="${w - sl - l}" x2="${w - sl}" y1="${y}" y2="${y}"/></g>`; }
  out += `<line x1="${sl}" x2="${sl}" y1="${y0}" y2="${y1}" stroke="#fff" stroke-width="3"/><line x1="${w - sl}" x2="${w - sl}" y1="${y0}" y2="${y1}" stroke="#fff" stroke-width="3"/>`;
  // slab-style yard numbers, tops pointing to the middle of the field, with an arrow towards the nearest goal line
  const nh = 2.2 * ppy, num = (x, y, rot, v) => {
    const s = String(v), fs = nh / 0.71, gp = Math.max(1.4, ppy * 0.6);       // "3|0": a small gap each side of the yard line
    return `<g transform="translate(${x} ${y}) rotate(${rot})" font-family="'Special Gothic Condensed One','Barlow Condensed',sans-serif" font-size="${fs.toFixed(1)}" fill="#fff" fill-opacity="${o.numOp || 0.95}"><text x="${-gp}" y="${nh / 2}" text-anchor="end">${s[0]}</text><text x="${gp}" y="${nh / 2}" text-anchor="start">${s[1]}</text></g>`;
  };
  const arrow = (x, y, up) => `<polygon points="${x - nh * 0.34},${y + (up ? 0.3 : -0.3) * nh} ${x + nh * 0.34},${y + (up ? 0.3 : -0.3) * nh} ${x},${y + (up ? -0.35 : 0.35) * nh}" fill="#fff" fill-opacity="${o.numOp || 0.95}"/>`;
  for (let A = Math.ceil(Math.max(10, Amin) / 10) * 10; A <= Math.min(90, Amax); A += 10) {
    const v = A <= 50 ? A : 100 - A, y = yOf(A), up = A > 50;
    out += num(o.numL, y, 90, v) + num(o.numR, y, -90, v);
    if (v !== 50) { const ay = y + (up ? -1 : 1) * (nh * 1.45 + 2); out += arrow(o.numL, ay, up) + arrow(o.numR, ay, up); }
  }
  return out;
}
// an end zone strip [x, y, w, h]: the opponent's real design in the NFL (same art as the live game, scaled to fit); other teams keep their color, stripes and logo
function mgEndZone(ctx, x, y, w, h, k) {
  const team = ctx.o, d = ctx.env.nfl && typeof LV_EZ !== 'undefined' ? LV_EZ[team.id] : null, cid = 'mgEz' + Math.random().toString(36).slice(2, 7), cx = x + w / 2, cy = y + h / 2;
  if (!d) {
    const n = w > 240 ? 3 : 1, lg = Math.min(h * 0.8, 92);
    return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${team.c1}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#mgStripe)" opacity=".2"/>${Array.from({ length: n }, (_, i) => `<image href="${team.logo}" x="${cx + (i - (n - 1) / 2) * w * 0.3 - lg / 2}" y="${cy - lg / 2}" width="${lg}" height="${lg}" opacity=".92" preserveAspectRatio="xMidYMid meet"/>`).join('')}</g>`;
  }
  const items = d.ends[0], local = (d.deco === 'tiger' ? lvTiger() : '') + (d.deco === 'band' ? '<rect x="-270" y="-50" width="540" height="7" fill="#fff" opacity=".85"/>' : '')
    + (d.deco === 'sband' ? '<rect x="-270" y="-50" width="540" height="9" fill="#101010" opacity=".92"/><rect x="-270" y="-39" width="540" height="2" fill="#D3BC8D"/>' : '') + ''; const ez = mgEzExtent(items), fit = Math.max(k * (typeof lvEzScale === 'function' ? lvEzScale(items, d.ey) : 1), Math.min((w * 0.47) / ez.x, (h * 0.44) / ez.y, 2.6)), art = lvEzItemsRaw(items, team);
  return `<defs><clipPath id="${cid}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs><g clip-path="url(#${cid})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#2d8647"/>${d.bg ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${d.bg}" opacity="${d.op || 0.94}"/>` : ''}<g transform="translate(${cx} ${cy}) scale(${k})">${local}</g><g transform="translate(${cx} ${cy}) scale(${fit.toFixed(3)})">${art}</g></g>`;
}
// half-width / half-height of what an end zone design paints (to scale it up to fill the mini game end zone)
function mgEzExtent(items) {
  let ex = 0, ey = 0;
  items.forEach(it => {
    if (it.t) { ex = Math.max(ex, Math.abs(it.t.x || 0) + it.t.n / 2); ey = Math.max(ey, Math.abs(it.t.y || 0) + it.t.h / 2 + (it.t.w || 0) / 2); }
    else if (it.l) { ex = Math.max(ex, Math.abs(it.l.x) + it.l.w / 2); ey = Math.max(ey, Math.abs(it.l.y) + (it.l.h || it.l.w) / 2); }
    else if (it.x === 'rule') { ex = Math.max(ex, it.n / 2); ey = Math.max(ey, Math.abs(it.py) + (it.th || 3.2) / 2); }
    else if (it.px !== undefined) { ex = Math.max(ex, Math.abs(it.px) + it.r); ey = Math.max(ey, Math.abs(it.py) + it.r); }
  });
  return { x: ex || 1, y: ey || 1 };
}
// the grass texture over an end zone (the pattern twice, plus a mowing stripe), so the painted end zone reads as turf like the rest of the field
const mgEzGrass = (pat, x, y, w, h) => `<g pointer-events="none"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${pat})"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${pat})" opacity=".85"/><rect x="${x}" y="${y + h / 2}" width="${w}" height="${h / 2}" fill="#fff" opacity=".05"/></g>`;
const mgPylon = (x, y, s = 1) => `<rect x="${x - 4 * s}" y="${y - 4 * s}" width="${8 * s}" height="${8 * s}" fill="#ff6a13" stroke="#fff" stroke-width="1"/>`;
// the stand-alone field used by the QB and WR/TE games: LOS at screen y = yRef on yard line Aref (10 px per yard), your logo at midfield if it is in view, crowd strips top and bottom
function mgField(ctx, w, h, id, yRef, Aref, opt = {}) {
  const t = ctx.t, o = ctx.o, ppy = 10, yOf = A => yRef - (A - Aref) * ppy;
  const inner = mgFieldInner({ id: id + 'g', w, sl: 14, y0: 0, y1: h, yRef, Aref, ppy, Amin: Aref - (h - yRef) / ppy - 1, Amax: Aref + yRef / ppy + 1, numL: 50, numR: w - 50 });
  const mid = yOf(50);
  return `<defs>${mgGrassPat(id + 'g')}</defs><rect width="${w}" height="${h}" rx="14" fill="#1d6c3d"/>${inner}
    ${mid > 20 && mid < h - 20 ? `<image href="${(ctx.env.nfl && typeof NFL_MID_LOGO !== 'undefined' && NFL_MID_LOGO[t.id]) || t.logo}" x="${w / 2 - 44}" y="${mid - 44}" width="88" height="88" opacity=".88" preserveAspectRatio="xMidYMid meet" transform="rotate(90 ${w / 2} ${mid})"/>` : ''}
    ${opt.crowd === false ? '' : `<rect width="${w}" height="16" rx="8" fill="#050810" opacity=".75"/><rect y="${h - 14}" width="${w}" height="14" rx="7" fill="#050810" opacity=".75"/><g class="mg-crowd">${mgCrowd(0, 4, w, 2, t.c1, o.c1)}</g><g class="mg-crowd">${mgCrowd(0, h - 11, w, 2, t.c1, t.c2)}</g>`}`;
}

/* ---------- overlay + runner ---------- */
// the NFL season's environment; the college season (college.js) passes its own: { se, P, t, o, number, theme, save, onDone, jersey }
function mgEnvNFL(force) {
  const se = curSeason(); if (!se || (!force && (!se.mg || !MG_META[se.mg.kind]))) return null;
  let opp; try { opp = nextGameInfo(se).opp; } catch (e) { opp = null; } opp = opp || TEAM_LIST.find(x => x.id !== S.teamId);
  const P = S.player, tid = S.teamId;
  return { se, P, t: { ...TEAM[tid], logo: logoUrl(tid) }, o: { ...opp, logo: logoUrl(opp.id) }, number: playerNumber(), theme: themeVars(tid), save: true, nfl: true, onDone: () => renderDashboard(),
    jersey: view => jerseySVG(jerseyFor(tid), jName(P), playerNumber(), { view, teamId: tid, word: TEAM[tid].nick }) };
}
let MGX = null;
function mgOpen(env) {
  env = env || mgEnvNFL(); if (!env) return;
  const se = env.se; if (!se.mg || !MG_META[se.mg.kind]) return;
  const P = env.P, kind = se.mg.kind, t = env.t, meta = MG_META[kind](P);
  let opp = env.o; if (typeof lvDelta === 'function' && opp.c1 && t.c1 && lvDelta(t.c1, opp.c1) < 22) opp = { ...opp, c1: opp.c2 || '#ffffff', c2: opp.c1 };   // two similar colors: the rival wears its secondary one
  env.o = opp;
  const ov = document.createElement('div'); ov.className = 'mg-overlay'; ov.style.cssText = `${env.theme};--o1:${opp.c1 || '#444'};--o2:${opp.c2 || '#fff'}`;
  ov.innerHTML = `<div class="mg-bgart"><img class="a" src="${t.logo}" alt=""><img class="b" src="${opp.logo}" alt=""></div><div class="mg-wrap">
    <div class="mg-top"><span class="mg-tag">${se.mg.weekly ? `WEEK ${mgGamesIn(se) + 1} TRAINING` : 'PRESEASON CAMP'}</span><button class="mini mg-skip" data-mg="skip">SKIP</button></div>
    <div class="mg-board"><div class="mg-team me"><img src="${t.logo}" alt=""><div><small>YOU</small><b>${esc(t.nick || t.name)}</b></div></div><div class="mg-bt"><b>${esc(meta.title)}</b><span>${esc(P.name)} · ${P.pos} · #${env.number}</span></div><div class="mg-team op"><img src="${opp.logo}" alt=""><div><small>VS</small><b>${esc(opp.nick || opp.name)}</b></div></div></div>
    <div class="mg-pips">${[0, 1, 2].map(i => `<span data-p="${i}">${mgFootball()}</span>`).join('')}<em id="mgScore">0/3</em><b class="mg-combo" id="mgCombo" hidden></b></div>
    <div class="mg-stage" id="mgStage"></div><div class="mg-msg" id="mgMsg"></div><div class="mg-ctrl" id="mgCtrl"></div></div>`;
  document.body.appendChild(ov);
  const stage = ov.querySelector('#mgStage'), msg = ov.querySelector('#mgMsg'), ctrl = ov.querySelector('#mgCtrl');
  const ctx = { env, number: env.number, ov, stage, msg, ctrl, t, o: opp, P, kind, alive: () => ov.isConnected, say: (h, cls = '') => { msg.className = 'mg-msg ' + cls; msg.innerHTML = h; }, results: [], perfects: 0, combo: 0 };
  MGX = ctx;
  stage.innerHTML = `<div class="mg-intro" style="background-image:radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, ${t.c1} 40%, transparent), transparent)">
    <img class="mg-intro-logo" src="${t.logo}" alt=""><h2>${esc(meta.title)}</h2><p>${esc(meta.how)}</p>
    <div class="mg-legend">${meta.legend.map(([i, a, b]) => `<span>${i === '🔴' ? '<i class="mg-dot r"></i>' : i === '🟢' ? '<i class="mg-dot g"></i>' : ''}${a}${b ? ` <b>→ ${b}</b>` : ''}</span>`).join('')}</div><p class="mg-sub">3 levels · your grade sets ${MGX && MGX.env.se.mg && MGX.env.se.mg.weekly ? 'your next game' : 'the whole season'}</p></div>`;
  ctrl.innerHTML = `<button class="btn btn-primary btn-xl" data-mg="start">START</button>`;
  Snd.play('mgCrowd', 0.05);
  mgAmbience();
}
// stadium crowd noise under every mini game (volume = the CROWD slider of the live game), and the players' noise of each play: second 4 of the clip is the snap
const mgSndVol = (key, def) => { let v = def; try { const x = parseInt(localStorage.getItem(key), 10); if (x >= 0 && x <= 100) v = x; } catch (e) { /* ignore */ } return 0.6 * Math.pow(v / 100, 1.6); };
function mgAmbience() { Snd.crowd('assets/sounds/crowd-stadium.m4a', mgSndVol('nfl_crowd_vol', 35)); }
// waits `ms` before the snap while the players' noise plays, so that second 4 of the clip lands on the snap
async function mgPre(ctx, ms) { Snd.players('assets/sounds/players-huddle.mp3', mgSndVol('nfl_players_vol2', 62.12), 1, Math.max(0, 4 - ms / 1000)); await sleep(ms); }
async function mgRun(ctx) {
  const fn = { qb: mgQB, rb: mgRB, catch: mgCatch, kick: mgKick }[ctx.kind], st = {};
  ctx.ctrl.innerHTML = ''; ctx.say('');
  for (let i = 0; i < 3; i++) {
    if (!ctx.alive()) return;
    ctx.ov.querySelectorAll('.mg-pips [data-p]').forEach((p, k) => p.classList.toggle('cur', k === i));
    const ok = await fn(ctx, MG_LV[i], st); Snd.stopPlayers(800); if (!ctx.alive()) return;
    ctx.results.push(ok);
    ctx.combo = ok ? ctx.combo + 1 : 0;
    ctx.ov.querySelector(`.mg-pips [data-p="${i}"]`).className = ok ? 'ok' : 'bad';
    ctx.ov.querySelector('#mgScore').textContent = ctx.kind === 'rb' ? `${ctx.rbPts || 0} PTS` : `${ctx.results.filter(Boolean).length}/3`;
    const cb = ctx.ov.querySelector('#mgCombo'); if (ctx.combo >= 2) { cb.hidden = false; cb.textContent = `🔥 x${ctx.combo}`; cb.classList.remove('pop'); void cb.offsetWidth; cb.classList.add('pop'); } else cb.hidden = true;
    if (ok) { Snd.play('mgGood', 0, Math.min(4, ctx.combo - 1)); mgFlash(ctx, true); } else { Snd.play('mgMiss', 0); mgFlash(ctx, false); }
    await sleep(i < 2 ? 1500 : 900);
  }
  mgFinish(ctx);
}
function mgFlash(ctx, good) { const s = ctx.stage; s.classList.remove('mg-good', 'mg-badflash'); void s.offsetWidth; s.classList.add(good ? 'mg-good' : 'mg-badflash'); if (good) { Snd.play('mgCrowd', 0.12, 1); burst(s, 14, [ctx.t.c1, ctx.t.c2, '#ffffff', '#ffd23d']); } }
function mgFinish(ctx) {
  const se = ctx.env.se, rbm = ctx.kind === 'rb', pts = ctx.rbPts || 0;
  const raw = rbm ? (pts >= 32 ? 3 : pts >= 18 ? 2 : pts >= 8 ? 1 : 0) : ctx.results.filter(Boolean).length, sc = rbm ? (pts < 8 ? 0 : pts < 18 ? 2 : pts < 32 ? 3 : pts < 52 ? 4 : 5) : MG_SC[raw], g = MG_GRADES[sc], good = sc >= 3;
  const extra = good && !rbm ? Math.min(0.04, ctx.perfects * 0.01) : 0, perf = rbm ? clamp(-0.04 + pts * 0.0025, -0.05, 0.12) : Math.min(0.12, g.perf + extra);
  const weekly = !!(se.mg && se.mg.weekly), gi = mgGamesIn(se), streak = weekly ? (se.mgTrainAt === gi - 1 && se.mgStreak ? se.mgStreak + 1 : 1) : 0;
  const wPerf = weekly ? (rbm ? clamp(0.008 + pts * 0.0011, 0.008, 0.07) : MG_WEEK_PERF[sc]) + Math.min(0.03, 0.005 * (streak - 1)) : 0;
  const fx = rbm && !weekly ? `${pts} points → ${perf >= 0 ? '+' : '−'}${Math.abs(perf * 100).toFixed(1).replace(/\.0$/, '')}% performance all season · moves your rating` : weekly ? `${rbm ? pts + ' points → ' : ''}+${(wPerf * 100).toFixed(1).replace(/\.0$/, '')}% performance in your next game${streak > 1 ? ` · ${streak}-week training streak` : ''}` : `${perf > 0 ? '+' : '−'}${Math.abs(Math.round(perf * 100))}% performance all season · moves your rating`;
  ctx.stage.innerHTML = `<div class="mg-res ${good ? 'good' : 'bad'}" style="background-image:radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, ${ctx.t.c1} 38%, transparent), transparent)">
    <img class="mg-intro-logo small" src="${ctx.t.logo}" alt="">
    <div class="mg-grade">${g.n}</div><div class="mg-big">${rbm ? pts : raw}<small>${rbm ? ' PTS' : '/3'}</small></div>
    <div class="mg-stars">${[0, 1, 2].map(i => `<span class="${i < raw ? 'on' : ''}">★</span>`).join('')}</div>
    ${ctx.perfects ? `<div class="mg-perf">✨ ${ctx.perfects} perfect play${ctx.perfects > 1 ? 's' : ''}</div>` : ''}
    <div class="mg-bonus ${good || weekly ? 'good' : 'bad'}">${good || weekly ? '⚡' : '⚠️'} ${fx}</div></div>`;
  ctx.say(''); ctx.ctrl.innerHTML = `<button class="btn btn-primary btn-xl" data-mg="done">CONTINUE</button>`;
  if (weekly) { se.buffs.push({ left: 1, perf: wPerf, label: 'Week ' + (gi + 1) + ' training' }); se.mgTrainAt = gi; se.mgStreak = streak; }
  else { se.buffs.push({ left: 99, perf, label: 'Camp ' + g.n.toLowerCase() }); if (sc >= 4) se.train.ment = Math.min(1.5, (se.train.ment || 0) + 0.25); }
  let grew = 0; if (ctx.env.nfl && typeof seasonGrow === 'function') { const notes = []; grew = seasonGrow(se, weekly ? [0, 0, 0.12, 0.35, 0.6, 0.9][sc] : [0, 0, 0.2, 0.7, 1.2, 1.7][sc], notes, weekly ? 'weekly training' : 'preseason camp'); if (grew) { const bx = ctx.stage.querySelector('.mg-bonus'); if (bx) bx.insertAdjacentHTML('afterend', `<div class="mg-bonus good">📈 RATING +${grew} → ${S.player.ovr}${notes.some(x => x.includes('DEPTH')) ? ' · moved up the depth chart' : ''}</div>`); } }
  se.mgLog.push({ kind: ctx.kind, score: sc, wk: se.mg ? se.mg.wk : 0, weekly }); se.mg = null; se.mgSince = 0; se.mgIn = randInt(3, 5);
  if (ctx.env.save) saveGame();
  Snd.play(sc >= 4 ? 'bigFanfare' : good ? 'win' : 'lose', 0.1);
  if (sc >= 4) burst(ctx.stage, sc === 5 ? 70 : 40);
}
function mgSkip() { Snd.stopCrowd(900); Snd.stopPlayers(500); const env = MGX && MGX.env, se = env && env.se; if (se) { se.mg = null; se.mgSince = 0; se.mgIn = randInt(3, 5); if (env.save) saveGame(); } const o = document.querySelector('.mg-overlay'); if (o) o.remove(); MGX = null; if (env) env.onDone(); }
function mgDone() { Snd.stopCrowd(1800); Snd.stopPlayers(900); const env = MGX && MGX.env; const o = document.querySelector('.mg-overlay'); if (o) o.remove(); MGX = null; if (env) env.onDone(); }
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-mg]'); if (!b || !MGX) return;
  const k = b.dataset.mg;
  if (k === 'skip') mgSkip(); else if (k === 'done') mgDone(); else if (k === 'start') mgRun(MGX);
});
// wait for a button/tap choice or a timeout; the timer bar is drawn in the control area (the last second ticks very softly)
function mgChoice(ctx, secs) {
  return new Promise(res => {
    const bar = ctx.ctrl.querySelector('.mg-timer i'); let done = false;
    const finish = v => { if (done) return; done = true; clearTimeout(to); clearTimeout(tk); res(v); };
    if (bar) { bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth; bar.style.transition = `width ${secs}s linear`; bar.style.width = '0%'; }
    const to = setTimeout(() => finish(null), secs * 1000);
    const tk = setTimeout(() => { if (!done) Snd.play('mgTick'); }, Math.max(0, secs * 1000 - 900));
    ctx.pickStart = performance.now(); ctx.pickSecs = secs; ctx.pick = v => finish(v);
  });
}
const mgPickBtn = (ctx, sel) => { ctx.ov.querySelectorAll(sel).forEach(el => el.addEventListener('pointerdown', ev => { ev.preventDefault(); if (ctx.pick) ctx.pick(el.dataset.pick); }, { once: true })); };
const mgPop = (ctx, x, y, txt, cls) => { const fx = ctx.stage.querySelector('#mgFx'); if (fx) fx.innerHTML = `<text x="${x}" y="${y}" text-anchor="middle" class="mg-pop ${cls}">${txt}</text>`; };
const mgShake = ctx => { ctx.stage.classList.remove('mg-shake'); void ctx.stage.offsetWidth; ctx.stage.classList.add('mg-shake'); };

/* =====================================================================
   QB — POCKET PRESENCE
   You drop back: move inside the pocket with the arrow keys / WASD (or drag) to stay away from the pass rush, and press SPACE when the timing bar is inside the green
   to fire the pass to your WR. Throw outside the green and the pass fails; wait too long (or let a rusher touch you) and it is a sack.
   Level 1: two rushers, slow bar. Level 2: three rushers. Level 3: four rushers, fast bar, narrow window.
   ===================================================================== */
function mgQB(ctx, i, st) {
  const lv = MG_LV.indexOf(i), T1 = ctx.t.c1, T2 = ctx.t.c2, O1 = ctx.o.c1, O2 = ctx.o.c2, LOSY = 150, flip = rnd() < 0.5, mx = x => (flip ? 340 - x : x);
  const nR = [2, 3, 4][lv], rushIdx = [2, 1, 3, 0].slice(0, nR), tMax = [6.4, 5.8, 5.2][lv], vq = 92, vr = [50, 58, 66][lv], zone = [0.28, 0.22, 0.17][lv], sp = [0.85, 1.0, 1.15][lv];
  const pT = rr(0.34, 0.68), B = { x0: 52, x1: 288, y0: 184, y1: 286 };
  // ---- the formation: 5 linemen, QB, 3 receivers, a back and a tight end against 4 linemen, 2 linebackers, 3 corners/nickel and 2 safeties ----
  const olHome = [[104, 166], [137, 166], [170, 166], [203, 166], [236, 166]], olCup = [[100, 184], [135, 176], [170, 172], [205, 176], [240, 184]], pair = [0, 1, 3, 4];    // DL k is blocked by OL pair[k] (the center helps wherever the rush wins)
  const dlX = [118, 150, 190, 222], lbHome = [[132, 118], [208, 118]], lbZone = [[108, 96], [232, 96]], sfHome = [[96, 92], [244, 92]];
  const wrs = [{ P: [[36, 154], [36, 112], [96, 58]], T: [0, 1, 2.7] }, { P: [[304, 154], [304, 92], [262, 96]], T: [0, 1.2, 2.4] }, { P: [[250, 162], [250, 104], [190, 66]], T: [0, 1.1, 2.8] }];
  const teR = { P: [[268, 164], [300, 138], [322, 104]], T: [0, 0.9, 2.1] };
  const sm = u => u * u * (3 - 2 * u);
  const route = (w, t) => { const P = w.P, T = w.T; if (t <= 0) return [mx(P[0][0]), P[0][1]]; for (let k = 0; k < P.length - 1; k++) if (t <= T[k + 1]) { const u = sm((t - T[k]) / (T[k + 1] - T[k])); return [mx(P[k][0] + (P[k + 1][0] - P[k][0]) * u), P[k][1] + (P[k + 1][1] - P[k][1]) * u]; } const e = P[P.length - 1]; return [mx(e[0]), e[1]]; };
  const gid = 'mgPr' + (++mgGid), G = (c1, c2, o) => mgGuy(0, 0, c1, c2, o);
  ctx.stage.innerHTML = `<svg class="mg-svg tall" viewBox="0 0 340 300"><defs><radialGradient id="${gid}" cx="50%" cy="60%" r="65%"><stop offset=".55" stop-color="#ff2d2d" stop-opacity="0"/><stop offset="1" stop-color="#ff2d2d" stop-opacity=".8"/></radialGradient></defs>
    ${mgField(ctx, 340, 300, 'mgQ', LOSY, 33, { crowd: false })}
    <line x1="14" x2="326" y1="${LOSY}" y2="${LOSY}" stroke="#4aa8ff" stroke-width="2.6" stroke-opacity=".9"/>
    <path d="M${wrs[0].P.map(p => `${mx(p[0])} ${p[1]}`).join(' L')}" stroke="#ffd23d" stroke-width="2" stroke-dasharray="5 6" fill="none" opacity=".55" class="mg-route"/>
    ${olHome.map((p, k) => G(T1, T2, { s: 0.92, cls: 'mg-rbd', attrs: `id="mgOL${k}"` })).join('')}
    ${dlX.map((x, k) => G(O1, O2, { s: 0.92, down: true, run: rushIdx.includes(k), cls: 'mg-rbd', attrs: `id="mgDL${k}"` })).join('')}
    ${lbHome.map((p, k) => G(O1, O2, { s: 0.92, down: true, run: true, cls: 'mg-rbd', attrs: `id="mgLB${k}"` })).join('')}
    ${sfHome.map((p, k) => G(O1, O2, { s: 0.92, down: true, run: true, cls: 'mg-rbd', attrs: `id="mgSF${k}"` })).join('')}
    ${wrs.map((w, k) => G(O1, O2, { s: 0.98, down: true, run: true, cls: 'mg-rbd', attrs: `id="mgCB${k}"` })).join('')}
    ${wrs.map((w, k) => G(T1, T2, { s: 0.98, run: true, cls: 'mg-rbd', attrs: `id="mgWR${k}"` })).join('')}
    ${G(T1, T2, { s: 0.95, run: true, cls: 'mg-rbd', attrs: 'id="mgTE"' })}${G(T1, T2, { s: 0.95, run: true, cls: 'mg-rbd', attrs: 'id="mgRB"' })}
    <g id="mgTgt"><circle r="17" fill="none" stroke="#ffd23d" stroke-width="2.4" stroke-dasharray="4 4" class="mg-landring"/><text y="-22" text-anchor="middle" font-size="9.5" font-weight="800" fill="#ffd23d" stroke="rgba(0,0,0,.6)" stroke-width="2.4" paint-order="stroke" font-family="Barlow Condensed, sans-serif" letter-spacing=".12em">TARGET</text></g>
    <g id="mgQBg" class="mg-rbd">${mgGuy(0, 0, T1, T2, { s: 1.05, you: true, run: true, num: ctx.number })}</g>
    <g id="mgBallG">${mgBall(0, 0, 0.62, 0, 'mgBallEl')}</g>
    <rect id="mgPress" width="340" height="300" fill="url(#${gid})" opacity="0" pointer-events="none"/><g id="mgFx"></g></svg><div class="mg-call">POCKET PRESENCE · ${lv + 1}/3</div>`;
  ctx.ctrl.innerHTML = `<div class="mg-timer"><i></i></div><div class="mg-power"><div class="mg-py" style="left:${(pT - 0.2) * 100}%;width:40%"></div><div class="mg-pz" style="left:${(pT - zone / 2) * 100}%;width:${zone * 100}%"></div><i id="mgPI"></i></div><div class="mg-btns five">${mgHoldBtn('l', '◀')}${mgHoldBtn('u', '▲')}${mgHoldBtn('d', '▼')}${mgHoldBtn('r', '▶')}<button class="mg-b big" id="mgThrow" style="--c:#c5ff3a">THROW <small>SPACE</small></button></div>`;
  ctx.say('Move in the pocket · press <b>SPACE</b> when the bar is in the green');
  return new Promise(async res => {
    const q = id => ctx.stage.querySelector('#' + id), ang = (dx, dy) => Math.atan2(dx, -dy) * 180 / Math.PI;
    // a player: sprite + position + the way he faces (0 = up the screen, 180 = down)
    const P = (id, x, y, f0) => { const e = q(id); return { e, b: e.querySelector('.mg-body'), x, y, f: f0, px: x, py: y }; };
    const put = (p, dt, face) => { p.e.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`); if (face == null) { const dx = p.x - p.px, dy = p.y - p.py; if (dx * dx + dy * dy > 0.04) face = ang(dx, dy); } if (face != null) { const d = ((face - p.f + 540) % 360) - 180; p.f += d * Math.min(1, dt * 12); p.b.setAttribute('transform', `rotate(${p.f.toFixed(0)})`); } p.px = p.x; p.py = p.y; };
    const Q = { x: 170, y: 206, vx: 0, vy: 0 }, qb = P('mgQBg', Q.x, Q.y, 0), ballE = q('mgBallEl'), press = q('mgPress'), tgt = q('mgTgt'), pi = ctx.ctrl.querySelector('#mgPI');
    const ol = olHome.map((h, k) => ({ ...P('mgOL' + k, h[0], h[1], 0), hx: h[0], hy: h[1], push: 0, beat: 0 }));
    const dl = dlX.map((x, k) => ({ ...P('mgDL' + k, x, 142, 180), hx: x, rush: rushIdx.includes(k), contact: 0, free: false, tf: 0, mv: 0, ox: 0, speed: 0, chip: 0 }));
    rushIdx.forEach((k, j) => { dl[k].tf = [1.9, 1.55, 1.25][lv] + j * [0.75, 0.6, 0.45][lv] + rr(0, 0.35); dl[k].mv = pick([-1, 1, 0]); });
    const lb = lbHome.map((h, k) => ({ ...P('mgLB' + k, h[0], h[1], 180) })), sf = sfHome.map((h, k) => ({ ...P('mgSF' + k, h[0], h[1], 180) }));
    const wr = wrs.map((w, k) => { const p = route(w, 0); return { ...P('mgWR' + k, p[0], p[1], 0) }; }), cb = wrs.map((w, k) => { const p = route(w, 0); return { ...P('mgCB' + k, p[0], p[1] - 17, 180) }; });
    const te = { ...P('mgTE', mx(teR.P[0][0]), teR.P[0][1], 0) }, rb = { ...P('mgRB', mx(150), 246, 0), state: 0, tt: 0, tgt: null };
    const all0 = [qb, ...ol, ...dl, ...lb, ...sf, ...wr, ...cb, te, rb]; all0.forEach(p => put(p, 1, p.f));
    await mgPre(ctx, 2000); if (!ctx.alive()) return res(false);
    const inp = mgInput(ctx);
    const bar = ctx.ctrl.querySelector('.mg-timer i'); if (bar) { bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth; bar.style.transition = `width ${tMax}s linear`; bar.style.width = '0%'; }
    ctx.say('<b>HIKE!</b> Stay alive · <b>SPACE</b> in the green', 'go'); Snd.play('mgSnap', 0.02);
    let t = 0, last = performance.now(), ended = false, raf = 0, minD = 999;
    const cleanup = () => { ended = true; cancelAnimationFrame(raf); inp.dispose(); document.removeEventListener('keydown', onKey); };
    const marker = () => { const ph = (t * sp) % 2; return ph < 1 ? ph : 2 - ph; };
    const sack = async why => {
      if (ended) return; cleanup(); ctx.ctrl.innerHTML = '';
      mgPop(ctx, Q.x, Q.y - 20, 'SACK!', 'bad'); Snd.play('mgHit', 0); mgShake(ctx);
      ctx.say(`❌ SACKED! ${why}<span class="mg-tip">Throw before the rush gets to you — move to buy time.</span>`, 'bad'); res(false);
    };
    const fly = (x0, y0, x1, y1, ms, arc) => new Promise(r => { const f0 = performance.now(); const step = () => { if (!ctx.alive()) return r(); const k = Math.min(1, (performance.now() - f0) / ms), x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - Math.sin(Math.PI * k) * arc; ballE.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(k * 540).toFixed(0)}) scale(${(0.62 + Math.sin(Math.PI * k) * 0.25).toFixed(2)})`); if (k < 1) requestAnimationFrame(step); else r(); }; step(); });
    const doThrow = async () => {
      if (ended) return; const v = marker(), perr = Math.abs(v - pT), close = minD; cleanup(); ctx.ctrl.innerHTML = '';
      const inGreen = perr <= zone / 2, inYellow = perr <= 0.2, perfect = inGreen && perr <= zone * 0.2 && close > 50;
      const tw = route(wrs[0], t + 0.55), wx = tw[0], wy = tw[1]; Snd.play('mgThrow', 0);
      qb.e.querySelector('.mg-body').setAttribute('transform', `rotate(${ang(wx - Q.x, wy - Q.y).toFixed(0)})`);
      await fly(Q.x, Q.y - 6, wx, wy - 6, 560, 26); if (!ctx.alive()) return res(false);
      if (inGreen) {
        const yds = Math.max(2, Math.round((LOSY - wy) / 10 + rr(0, 3)));
        mgPop(ctx, wx, wy - 18, perfect ? 'PERFECT!' : mgYardsStr(yds), 'good'); Snd.play('mgPat', 0); if (yds >= 12) Snd.play('td', 0.12);
        if (perfect) ctx.perfects++;
        ctx.say(`✅ ${perfect ? '✨ Perfect throw! ' : 'Complete! '}${mgYardsStr(yds)}`, 'good'); res(true);
      } else if (inYellow) {
        ballE.setAttribute('transform', `translate(${wx + (v < pT ? -20 : 20)} ${wy + 14}) rotate(30) scale(0.62)`);
        mgPop(ctx, wx, wy - 18, 'INCOMPLETE', 'bad'); Snd.play('mgPat', 0);
        ctx.say(`❌ Off target — ${v < pT ? 'too early' : 'too late'}<span class="mg-tip">Press SPACE when the marker is inside the green.</span>`, 'bad'); res(false);
      } else {
        mgPop(ctx, wx, wy - 18, 'INTERCEPTED!', 'bad'); Snd.play('mgHit', 0); mgShake(ctx);
        ctx.say(`❌ Intercepted — the timing was way off<span class="mg-tip">Wait for the green zone.</span>`, 'bad'); res(false);
      }
    };
    const onKey = e => { if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); if (!e.repeat) doThrow(); } };
    document.addEventListener('keydown', onKey);
    ctx.ov.querySelector('#mgThrow').addEventListener('pointerdown', ev => { ev.preventDefault(); doThrow(); });
    const ease = u => u * u * (3 - 2 * u), toward = (p, tx, ty, sp2, dt) => { const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1, st2 = Math.min(d, sp2 * dt); p.x += dx / d * st2; p.y += dy / d * st2; return d; };
    const frame = now => {
      if (ended) return; if (!ctx.alive()) { cleanup(); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      // ---- the quarterback: a short drop-back at the snap, then you steer him ----
      let vx = inp.k.r - inp.k.l, vy = inp.k.d - inp.k.u; if (inp.tx !== null) { vx = inp.tx - Q.x; vy = inp.ty - Q.y; if (Math.hypot(vx, vy) < 6) { vx = 0; vy = 0; } }
      const m = Math.hypot(vx, vy), ox = Q.x, oy = Q.y;
      if (m > 0) { Q.x = clamp(Q.x + vx / m * vq * dt, B.x0, B.x1); Q.y = clamp(Q.y + vy / m * vq * dt, B.y0, B.y1); } else if (t < 0.6) Q.y = Math.min(Q.y + 26 * dt, 222);
      Q.vx = (Q.x - ox) / dt; Q.vy = (Q.y - oy) / dt; qb.x = Q.x; qb.y = Q.y; put(qb, dt, ang(wr[0].x - Q.x, wr[0].y - Q.y));        // he keeps his eyes on the target while he steps around
      ballE.setAttribute('transform', `translate(${Q.x.toFixed(1)} ${(Q.y - 9).toFixed(1)}) rotate(90) scale(0.62)`);
      // ---- the line: the tackles kick-slide back into a cup, then every lineman fights his man; beaten linemen get walked back ----
      const u0 = ease(Math.min(1, t / 0.5));
      ol.forEach((o, k) => { const c = olCup[k]; o.hx = olHome[k][0] + (c[0] - olHome[k][0]) * u0; o.hy = olHome[k][1] + (c[1] - olHome[k][1]) * u0; });
      dl.forEach((d, k) => {
        const ob = pair[k] == null ? null : ol[pair[k]];
        if (!d.rush) {                                                         // a blocked lineman: pushes, gives ground, never wins
          if (ob) { ob.push = Math.min(10, 2.2 * t); d.x = ob.hx + Math.sin(t * 7 + k) * 1.6; d.y = ob.hy + ob.push - 13 + Math.cos(t * 6 + k) * 1.1; } else { d.x = d.hx + Math.sin(t * 6) * 1.5; d.y = 144 + Math.cos(t * 5) * 1; }
          return;
        }
        if (!d.free) {
          if (t < 0.4) { const u = ease(t / 0.4), cx = ob ? ob.hx : d.hx, cy = ob ? ob.hy - 13 : 150; d.x = d.hx + (cx - d.hx) * u; d.y = 142 + (cy - 142) * u; }          // get-off: close the cushion
          else { if (ob) { ob.push = Math.min(14, 3.4 * (t - 0.2)); d.x = ob.hx + Math.sin(t * 9 + k) * 2 + d.ox; d.y = ob.hy + ob.push - 13 + Math.cos(t * 8 + k) * 1.2; } }
          if (t >= d.tf) { d.free = true; d.t0 = t; mgPop(ctx, d.x, d.y - 14, d.mv === 0 ? 'BULL RUSH!' : d.mv < 0 ? 'SWIM!' : 'SPIN!', 'bad'); }
          return;
        }
        // beaten block: a swim / spin move to the outside (a bull rush just runs through), then a curved chase that leads the quarterback
        const age = t - d.t0, side = d.x < 170 ? -1 : 1;
        if (age < 0.3 && d.mv !== 0) { d.x += side * (d.mv === 1 ? 62 : 46) * dt; d.y += 18 * dt; }
        d.speed = Math.min(vr * (d.chip > 0 ? 0.45 : 1), d.speed + vr * 2.2 * dt * (d.chip > 0 ? 0.5 : 1));
        const aimX = Q.x + Q.vx * 0.3, aimY = Q.y + Q.vy * 0.3, dist = toward(d, aimX, aimY, d.speed, dt);
        minD = Math.min(minD, Math.hypot(d.x - Q.x, d.y - Q.y)); if (ob) { ob.beat = Math.min(1, age / 0.35); }
        d.chip = Math.max(0, d.chip - dt);
      });
      dl.forEach(d => put(d, dt, d.rush && d.free ? null : 180));
      minD = Math.min(999, ...dl.filter(d => d.free).map(d => Math.hypot(d.x - Q.x, d.y - Q.y)), 999);
      ol.forEach((o, k) => { const kd = dl.find((d, j) => pair[j] === k && d.free); let x = o.hx, y = o.hy + o.push; if (kd) { const s = (kd.x < o.hx ? 1 : -1) * 12 * o.beat; x += s; y += 6 * o.beat; }
        if (k === 2) { const fr = dl.filter(d => d.free).sort((a, b) => Math.hypot(a.x - Q.x, a.y - Q.y) - Math.hypot(b.x - Q.x, b.y - Q.y))[0]; if (fr) x += clamp((fr.x - o.hx) * 0.35, -26, 26) * Math.min(1, (t - 1) / 0.6); }
        o.x += (x - o.x) * Math.min(1, dt * 14); o.y += (y - o.y) * Math.min(1, dt * 14); const eng = dl.find((d, j) => pair[j] === k); put(o, dt, kd ? ang(kd.x - o.x, kd.y - o.y) : 0); });
      // ---- linebackers drop into shallow zones, safeties settle deep and drift to the throw side, corners shadow the receivers at a cushion ----
      lb.forEach((p, k) => { const z = lbZone[k], u = ease(Math.min(1, t / 1.0)), w = route(wrs[k === 0 ? 2 : 1], t); p.x = lbHome[k][0] + (z[0] - lbHome[k][0]) * u + Math.sin(t * 2 + k) * 2 + (w[0] - z[0]) * 0.12 * u; p.y = lbHome[k][1] + (z[1] - lbHome[k][1]) * u; put(p, dt, ang(Q.x - p.x, Q.y - p.y)); });
      sf.forEach((p, k) => { const w = route(wrs[k === 0 ? 0 : 1], t); p.x += ((sfHome[k][0] * 0.6 + w[0] * 0.4) - p.x) * Math.min(1, dt * 1.6); p.y += ((sfHome[k][1] - 4 * Math.min(1, t)) - p.y) * Math.min(1, dt * 1.4); put(p, dt, ang(Q.x - p.x, Q.y - p.y)); });
      // ---- receivers run their routes with an eased break; the corners mirror them a step late ----
      wr.forEach((p, k) => { const r = route(wrs[k], t); p.x = r[0]; p.y = r[1]; put(p, dt); const c = cb[k], cu = Math.min(1, dt * 4.2); c.x += (p.x - c.x) * cu; c.y += (p.y - 17 - c.y) * cu; put(c, dt, ang(p.x - c.x, p.y - c.y)); if (k === 0) { tgt.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`); } });
      { const r = route(teR, t); te.x = r[0]; te.y = r[1]; put(te, dt); }
      // ---- the back: steps up and picks up the most dangerous rusher, then leaks out to the flat ----
      { const thr = dl.filter(d => d.free).sort((a, b) => Math.hypot(a.x - Q.x, a.y - Q.y) - Math.hypot(b.x - Q.x, b.y - Q.y))[0];
        if (rb.state === 0) { if (t > 0.5 && thr) { rb.state = 1; rb.tgt = thr; rb.tt = t; } else { rb.x += (mx(150) - rb.x) * dt * 3; rb.y += (222 - rb.y) * dt * 1.2; } }
        if (rb.state === 1) { const d = toward(rb, rb.tgt.x, rb.tgt.y + 12, 78, dt); if (d < 16) { rb.tgt.chip = 0.5; rb.tgt.speed *= 0.82; } if (t - rb.tt > 1.6) rb.state = 2; }
        if (rb.state === 2) toward(rb, mx(300), 196, 60, dt);
        put(rb, dt, rb.state === 1 && rb.tgt ? ang(rb.tgt.x - rb.x, rb.tgt.y - rb.y) : null); }
      const v = marker(); pi.style.left = (v * 100) + '%';
      press.setAttribute('opacity', clamp(1 - minD / 95, 0, 0.7).toFixed(2));
      if (minD < 15) return sack('A rusher got to you.'); if (t >= tMax) return sack('You held it too long.');
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}

/* =====================================================================
   Controls shared by the two "arcade" games (RB run, WR/TE catch): arrow keys / WASD, dragging a finger on the field, or the on-screen hold buttons.
   ===================================================================== */
function mgInput(ctx) {
  const k = { l: 0, r: 0, u: 0, d: 0, g: 0 }, o = { k, tx: null, ty: null };
  const map = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd', a: 'l', A: 'l', d: 'r', D: 'r', w: 'u', W: 'u', s: 'd', S: 'd' };
  if (ctx.kind === 'rb') { map[' '] = 'g'; map.Spacebar = 'g'; }
  const kd = e => { const m = map[e.key]; if (m) { k[m] = 1; e.preventDefault(); } }, ku = e => { const m = map[e.key]; if (m) k[m] = 0; };
  document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
  const toXY = ev => { const s = ctx.stage.querySelector('svg'); if (!s || !s.createSVGPoint) return null; const pt = s.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const m = s.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : null; };
  const pd = ev => { if (ev.target.closest && ev.target.closest('.mg-hold')) return; const p = toXY(ev); if (p) { o.tx = p.x; o.ty = p.y; } };
  const pm = ev => { if (o.tx === null) return; const p = toXY(ev); if (p) { o.tx = p.x; o.ty = p.y; } };
  const pu = () => { o.tx = null; o.ty = null; };
  ctx.stage.addEventListener('pointerdown', pd); ctx.stage.addEventListener('pointermove', pm); window.addEventListener('pointerup', pu); window.addEventListener('pointercancel', pu);
  ctx.stage.classList.add('live');
  ctx.ov.querySelectorAll('.mg-hold').forEach(b => { const key = b.dataset.hold, on = e => { e.preventDefault(); k[key] = 1; b.classList.add('down'); }, off = () => { k[key] = 0; b.classList.remove('down'); }; b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off); });
  o.dispose = () => { document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); ctx.stage.removeEventListener('pointerdown', pd); ctx.stage.removeEventListener('pointermove', pm); window.removeEventListener('pointerup', pu); window.removeEventListener('pointercancel', pu); ctx.stage.classList.remove('live'); };
  return o;
}
const mgHoldBtn = (key, label) => `<button class="mg-b mg-hold" data-hold="${key}" style="--c:#35e0ff">${label}</button>`;

/* =====================================================================
   RB — RUSH FOR YARDS
   Same formation view as the QB game: the snap, the handoff, and you run: first through the HOLE the line opens, then keep going upfield dodging the linebackers and the secondary.
   A first hit slows you down, a second one (or two defenders at once) brings you down. Every yard is a point (+10 for a touchdown); the points become the % your performance goes up.
   ===================================================================== */
function mgRB(ctx, i, st) {
  const lv = MG_LV.indexOf(i), T1 = ctx.t.c1, T2 = ctx.t.c2, O1 = ctx.o.c1, O2 = ctx.o.c2, LOSY = 150, A0 = 40, GOALY = LOSY - (100 - A0) * 10, RY = 205;
  if (ctx.rbPts == null) ctx.rbPts = 0;
  const holeI = lvWeightedMg([0.15, 0.25, 0.2, 0.25, 0.15]), gapX = [84, 134, 170, 206, 256][holeI];
  const vRB = 84, spd = { DL: 50, LB: [62, 68, 74][lv], S: [70, 75, 80][lv], CB: [70, 74, 78][lv] };
  const olH = [[104, 166], [137, 166], [170, 166], [203, 166], [236, 166]], dlH = [118, 150, 190, 222], lbH = [[128, 122], [170, 118], [212, 122]], sfH = [[112, 84], [228, 84]], cbH = [[40, 120], [300, 120]];
  const gid = 'mgRBg', G = (c1, c2, o) => mgGuy(0, 0, c1, c2, o);
  ctx.stage.innerHTML = `<svg class="mg-svg tall" viewBox="0 0 340 300"><defs>${mgGrassPat(gid)}</defs>
    <rect width="340" height="300" rx="14" fill="#2b7d47"/>
    <g id="mgRW">
      ${mgFieldInner({ id: gid, w: 340, sl: 14, y0: GOALY - 112, y1: 340, yRef: LOSY, Aref: A0, ppy: 10, Amin: A0 - 16, Amax: 100, numL: 50, numR: 290 })}
      <image href="${(ctx.env.nfl && typeof NFL_MID_LOGO !== 'undefined' && NFL_MID_LOGO[ctx.t.id]) || ctx.t.logo}" x="126" y="${LOSY - (50 - A0) * 10 - 44}" width="88" height="88" opacity=".88" preserveAspectRatio="xMidYMid meet" transform="rotate(90 170 ${LOSY - (50 - A0) * 10})"/>
      ${mgEndZone(ctx, 14, GOALY - 100, 312, 100, 0.6)}${mgEzGrass(gid, 14, GOALY - 100, 312, 100)}
      <line x1="14" x2="326" y1="${GOALY}" y2="${GOALY}" stroke="#fff" stroke-width="3.4"/><line x1="14" x2="326" y1="${GOALY - 100}" y2="${GOALY - 100}" stroke="#fff" stroke-width="3.4"/>
      ${mgPylon(14, GOALY)}${mgPylon(326, GOALY)}${mgPylon(14, GOALY - 100)}${mgPylon(326, GOALY - 100)}
      <line x1="14" x2="326" y1="${LOSY}" y2="${LOSY}" stroke="#4aa8ff" stroke-width="2.8" stroke-opacity=".9"/>
      <g id="mgHole" opacity=".95"><path d="M${gapX - 16} ${LOSY - 6} l16 -18 l16 18 M${gapX - 16} ${LOSY + 8} l16 -18 l16 18" stroke="#6dffbb" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="mg-landring"/><text x="${gapX}" y="${LOSY + 26}" text-anchor="middle" font-size="10" font-weight="800" fill="#6dffbb" stroke="rgba(0,0,0,.6)" stroke-width="2.4" paint-order="stroke" font-family="Barlow Condensed, sans-serif" letter-spacing=".16em">HOLE</text></g>
      ${olH.map((p, k) => G(T1, T2, { s: 0.92, cls: 'mg-rbd', attrs: `id="mgOL${k}"` })).join('')}
      ${[0, 1].map(k => G(T1, T2, { s: 0.92, run: true, cls: 'mg-rbd', attrs: `id="mgWR${k}"` })).join('')}${G(T1, T2, { s: 0.92, cls: 'mg-rbd', attrs: 'id="mgTE"' })}
      ${dlH.map((x, k) => G(O1, O2, { s: 0.92, down: true, cls: 'mg-rbd', attrs: `id="mgDL${k}"` })).join('')}
      ${lbH.map((p, k) => G(O1, O2, { s: 0.92, down: true, run: true, cls: 'mg-rbd', attrs: `id="mgLB${k}"` })).join('')}
      ${sfH.map((p, k) => G(O1, O2, { s: 0.92, down: true, run: true, cls: 'mg-rbd', attrs: `id="mgSF${k}"` })).join('')}
      ${cbH.map((p, k) => G(O1, O2, { s: 0.92, down: true, run: true, cls: 'mg-rbd', attrs: `id="mgCB${k}"` })).join('')}
      <g id="mgQBg" class="mg-rbd">${mgGuy(0, 0, T1, T2, { s: 0.95, num: '' })}</g>
      <g id="mgMeG" class="mg-rbd">${mgGuy(0, 0, T1, T2, { s: 1.05, you: true, run: true, num: ctx.number })}</g>
      <g id="mgBallG">${mgBall(0, 0, 0.62, 0, 'mgBallEl')}</g>
    </g>
    <g id="mgHud"><rect x="70" y="8" width="200" height="30" rx="15" fill="rgba(5,8,16,.74)" stroke="rgba(255,255,255,.22)"/><text id="mgYd" x="170" y="29" text-anchor="middle" font-size="18" font-weight="800" fill="#fff" font-family="Barlow Condensed, sans-serif" letter-spacing=".04em">0 YDS · 0 PTS</text></g>
    <g id="mgFx"></g></svg><div class="mg-call">RUSH FOR YARDS · ${lv + 1}/3</div>`;
  ctx.ctrl.innerHTML = `<div class="mg-btns three" style="grid-template-columns:1fr 1.7fr 1fr">${mgHoldBtn('l', '◀')}<button class="mg-b mg-hold mg-go" data-hold="g" style="--c:#c5ff3a">RUN<small>SPACE</small></button>${mgHoldBtn('r', '▶')}</div>`;
  ctx.say('Hit the <b>HOLE</b> · hold <b>SPACE</b> to run, <b>◀ ▶</b> to turn');
  return new Promise(async res => {
    const q = id => ctx.stage.querySelector('#' + id), ang = (dx, dy) => Math.atan2(dx, -dy) * 180 / Math.PI;
    const P = (id, x, y, f0) => { const e = q(id); return { e, b: e.querySelector('.mg-body'), x, y, f: f0, px: x, py: y }; };
    const put = (p, dt, face) => { p.e.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`); if (face == null) { const dx = p.x - p.px, dy = p.y - p.py; if (dx * dx + dy * dy > 0.04) face = ang(dx, dy); } if (face != null) { const d = ((face - p.f + 540) % 360) - 180; p.f += d * Math.min(1, dt * 12); p.b.setAttribute('transform', `rotate(${p.f.toFixed(0)})`); } p.px = p.x; p.py = p.y; };
    const world = q('mgRW'), ydT = q('mgYd'), hole = q('mgHole'), ballE = q('mgBallEl');
    const me = P('mgMeG', 170, 232, 0), qb = P('mgQBg', 170, 181, 0);
    me.b.insertAdjacentHTML('beforeend', `<path d="M-4.5 -17 L0 -24 L4.5 -17 Z" fill="#ffd23d" stroke="rgba(0,0,0,.6)" stroke-width="1" stroke-linejoin="round"/><g id="mgCarry" style="display:none">${mgBall(9.5, -2.5, 0.56, 90)}</g>`); const carry = q('mgCarry');
    const ol = olH.map((h, k) => ({ ...P('mgOL' + k, h[0], h[1], 0), hx: h[0], hy: h[1] }));
    const dl = dlH.map((x, k) => ({ ...P('mgDL' + k, x, 147, 180), hx: x, kind: 'DL', held: null, free: false, spd: spd.DL, react: 0 }));
    const lb = lbH.map((h, k) => ({ ...P('mgLB' + k, h[0], h[1], 180), hx: h[0], kind: 'LB', held: null, free: true, spd: spd.LB, react: 1.0 + k * 0.12 }));
    const sf = sfH.map((h, k) => ({ ...P('mgSF' + k, h[0], h[1], 180), hx: h[0], kind: 'S', held: null, free: true, spd: spd.S, react: 1.3 + k * 0.1 }));
    const cb = cbH.map((h, k) => ({ ...P('mgCB' + k, h[0], h[1], 180), hx: h[0], kind: 'CB', held: null, free: false, spd: spd.CB, react: 0.5 }));
    const wr = [0, 1].map(k => ({ ...P('mgWR' + k, k ? 314 : 26, 154, 0) })), te = { ...P('mgTE', 268, 164, 0) };
    const defs = [...dl, ...lb, ...sf, ...cb];
    // the line opens the hole: the linemen next to it are driven away from it
    dl.forEach((d, j) => { d.tx = clamp(d.hx < gapX ? Math.min(d.hx, gapX - 32) : Math.max(d.hx, gapX + 32), 30, 310); d.sealed = true; d.tFree = 2.8 + rr(0, 0.8); });
    const inside = gapX <= 170 ? 1 : -1;
    // who blocks whom: [blocker, defender, how long he holds him]
    const holds = [[ol[0], dl[0]], [ol[1], dl[1]], [ol[3], dl[2]], [ol[4], dl[3]], [wr[0], cb[0]], [wr[1], cb[1]]].map(([o, d], n) => ({ o, d, tEnd: n < 4 ? 2.8 + rr(0, 0.9) : 2.2 + rr(0, 0.9) }));
    const center = ol[2]; let centerTarget = lb[holeI <= 1 ? 0 : holeI >= 3 ? 2 : 1];
    [qb, me, ...ol, ...defs, ...wr, te].forEach(p => put(p, 1, p.f));
    ballE.setAttribute('transform', `translate(170 ${qb.y - 8}) rotate(90) scale(0.62)`);
    await mgPre(ctx, 2000); if (!ctx.alive()) return res(false);
    const inp = mgInput(ctx);
    ctx.say('<b>HIKE!</b> Hit the hole!', 'go'); Snd.play('mgSnap', 0.02);
    let t = 0, last = performance.now(), ended = false, raf = 0, best = 0, stun = 0, hits = 0, hitT = -9, hd = 0;
    const cleanup = () => { ended = true; cancelAnimationFrame(raf); inp.dispose(); };
    const finish = async (td, why) => {
      if (ended) return; cleanup(); ctx.ctrl.innerHTML = '';
      const yds = Math.max(0, Math.round(best)), pts = yds + (td ? 10 : 0); ctx.rbPts += pts;
      const sx = me.x, sy = me.y + Math.max(0, RY - me.y);
      mgPop(ctx, 170, 120, td ? 'TOUCHDOWN!' : yds >= 10 ? 'BIG GAIN!' : yds >= 4 ? `+${yds} YDS` : 'TACKLED!', yds >= 4 || td ? 'good' : 'bad'); mgShake(ctx); Snd.play(td ? 'td' : yds >= 4 ? 'mgPat' : 'mgHit', td ? 0.05 : 0);
      ctx.say(`${yds >= 4 || td ? '✅' : '❌'} ${td ? '<b>TOUCHDOWN!</b> ' : ''}${yds}-yard run · <b>+${pts} pts</b>${td ? ' (10 for the touchdown)' : ''}${why ? `<span class="mg-tip">${why}</span>` : ''}`, yds >= 4 || td ? 'good' : 'bad');
      if (yds >= 12 && !td) ctx.perfects++; if (td) ctx.perfects++;
      res(yds >= 4 || td);
    };
    const ease = u => u * u * (3 - 2 * u), toward = (p, tx, ty, sp2, dt) => { const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1, st2 = Math.min(d, sp2 * dt); p.x += dx / d * st2; p.y += dy / d * st2; return d; };
    const frame = now => {
      if (ended) return; if (!ctx.alive()) { cleanup(); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; stun = Math.max(0, stun - dt);
      // ---- you: the handoff, then free running ----
      // arrows turn the runner (up straightens him upfield), SPACE moves him in the direction he faces
      const turn = inp.k.r - inp.k.l; if (turn) hd += turn * 230 * dt; else if (inp.k.u) hd -= Math.sign(hd) * Math.min(Math.abs(hd), 400 * dt); hd = ((hd + 540) % 360) - 180;
      const rad = hd * Math.PI / 180, vx = Math.sin(rad), vy = -Math.cos(rad);
      if (t >= 0.45) { if (inp.k.g) { const sp = vRB * (stun > 0 ? 0.4 : 1) * (vy > 0 ? 0.7 : 1); me.x = clamp(me.x + vx * sp * dt, 22, 318); me.y += vy * sp * dt; } } else { me.y -= 8 * dt; }
      best = Math.max(best, (LOSY - me.y) / 10);
      // ---- the quarterback hands off, then the ball is yours ----
      qb.x = 170 + (t < 0.3 ? 0 : 6 * Math.sin(Math.min(1, (t - 0.3) / 0.2) * 3)); qb.y = 181 + (t < 0.4 ? 0 : 3); put(qb, dt, t < 0.3 ? 0 : -50);
      const bx = t < 0.3 ? qb.x : t < 0.45 ? qb.x + (me.x - qb.x) * ((t - 0.3) / 0.15) : me.x, by = (t < 0.3 ? qb.y - 8 : t < 0.45 ? qb.y - 8 + (me.y - 6 - (qb.y - 8)) * ((t - 0.3) / 0.15) : me.y - 6);
      if (t >= 0.45) { carry.style.display = ''; ballE.parentNode.style.display = 'none'; } else ballE.setAttribute('transform', `translate(${bx.toFixed(1)} ${by.toFixed(1)}) rotate(90) scale(0.7)`);
      // ---- the line: it surges, opens the hole and the second level reacts ----
      const sur = ease(Math.min(1, t / 0.6));
      ol.forEach((o, k) => { o.y = o.hy - 7 * sur; });
      holes: { const hd = holds; hd.forEach(h => { if (t < h.tEnd) { if (h.d.kind === 'CB') { const cx = h.d.hx; toward(h.o, cx, h.d.y + 13, 70, dt); h.d.x += (h.o.x - h.d.x) * Math.min(1, dt * 6); h.d.y += ((h.o.y - 13) - h.d.y) * Math.min(1, dt * 6); h.d.x += Math.sin(t * 9 + h.d.hx) * 0.4; } else { const u = ease(Math.min(1, Math.max(0, (t - 0.1) / 0.7))), dx0 = (h.d.tx - h.d.hx) * u; h.o.x = h.o.hx + dx0; h.d.x = h.d.hx + dx0 + Math.sin(t * 8 + h.d.hx) * 1.5; h.d.y = h.o.y - 13 + Math.cos(t * 7 + h.d.hx) * 1; } } else h.released = true; }); }
      // the center climbs to the linebacker who is going to fill the hole; the tight end seals the edge
      { const lbT = centerTarget; if (t > 0.4 && t < 2.2) toward(center, lbT.x, lbT.y + 14, 110, dt); else if (t >= 2.2) {} else { center.x = center.hx; center.y = center.hy - 7 * sur; } if (t > 0.4 && (Math.hypot(center.x - lbT.x, center.y - lbT.y) < 22 || t > 0.95) && t < 2.2) { lbT.held = center; } if (t >= 2.2 && lbT.held === center) lbT.held = null; }
      { const edge = dl[3]; if (t > 0.3 && t < 2.4) toward(te, edge.x + 8, edge.y + 14, 55, dt); }
      wr.forEach((w, k) => { const c = cb[k]; if (t < 0.2) return; if (t < holds[4 + k].tEnd) toward(w, c.x, c.y + 13, 76, dt); else toward(w, w.x + (k ? -20 : 20), w.y - 12, 40, dt); });
      // ---- the defense reads the run and pursues (linemen once their block is over), the linebacker fills the hole ----
      lb.forEach(d => { if (d.held) { d.x += Math.sin(t * 9) * 0.5; return; } });
      let nearest = 999, hitBy = null;
      defs.forEach(d => {
        if (d === centerTarget && !d.held && t >= 0.4 && t < 1.1) { toward(d, gapX + inside * 18, LOSY - 26, 58, dt); return; }                      // the linebacker fills the hole
        const releasedHold = holds.some(h => h.d === d && h.released);
        if (d.kind === 'DL') { if (!d.free && (releasedHold && t >= d.tFree)) d.free = true; }
        if (d.kind === 'CB') { if (!d.free && releasedHold) d.free = true; }
        if (!d.free || d.held || t < d.react) { return; }
        const lead = 0.35, tx = me.x + (me.x - me.px) * lead * 6, ty = me.y + (me.y - me.py) * lead * 6, sp = d.spd * (stun > 0 ? 1.05 : 1) * (d.kind === 'DL' ? 1 : 0.5 + 0.5 * Math.min(1, Math.max(0, t - d.react) / 1.4));
        toward(d, tx, ty, sp, dt);
        const dist = Math.hypot(d.x - me.x, d.y - me.y); nearest = Math.min(nearest, dist); if (dist < 11 && t >= 0.45) { hitBy = hitBy && hitBy !== d ? 'multi' : d; }
      });
      defs.forEach((d, a) => { for (let b = a + 1; b < defs.length; b++) { const e = defs[b], dx = e.x - d.x, dy = e.y - d.y, dd = Math.hypot(dx, dy); if (dd > 0 && dd < 11 && !(d.held || e.held)) { const pu = (11 - dd) * 0.35; d.x -= dx / dd * pu; d.y -= dy / dd * pu; e.x += dx / dd * pu; e.y += dy / dd * pu; } } });
      defs.forEach(d => put(d, dt, d.free && !d.held ? ang(me.x - d.x, me.y - d.y) : (d.kind === 'DL' ? 180 : null)));
      ol.forEach(o => put(o, dt, 0)); wr.forEach(w => put(w, dt)); put(te, dt, 0);
      // ---- tackles: a first hit slows you down, a second one (or two defenders at once) ends the run ----
      if (hitBy === 'multi' || (hitBy && stun > 0 && t - hitT > 0.12)) return finish(false, hitBy === 'multi' ? 'Two defenders got to you.' : 'You got hit twice — dodge them!');
      if (hitBy && stun <= 0) { stun = 0.6; hitT = t; hits++; mgPop(ctx, me.x, Math.max(30, me.y + Math.max(0, RY - me.y) - 22), 'HIT!', 'bad'); Snd.play('mgHit', 0); const dxh = me.x - hitBy.x; hitBy.x -= (dxh >= 0 ? 8 : -8); hitBy.y += 6; }
      put(me, dt, hd);
      // ---- camera, HUD, the end zone ----
      const cy = Math.max(0, RY - me.y); world.setAttribute('transform', `translate(0 ${cy.toFixed(1)})`);
      const yd = Math.max(0, Math.round(best)), pts = yd; ydT.textContent = `${yd} YDS · ${ctx.rbPts + pts} PTS`;
      hole.setAttribute('opacity', clamp(1 - Math.max(0, t - 1.3) / 0.8, 0, 1).toFixed(2));
      if (me.y <= GOALY - 30) return finish(true);
      if (t > 15) return finish(false, 'Time ran out.');
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}
const lvWeightedMg = w => { let r = rnd() * w.reduce((a, b) => a + b, 0), i = 0; while (i < w.length - 1 && (r -= w[i]) > 0) i++; return i; };

/* =====================================================================
   WR / TE — CATCH IT
   Top-down. The ball leaves the QB and you can SEE where it will land (the ring). Run there (arrows / drag) before it arrives.
   Later throws are quicker, the wind nudges the ball mid-air, and a defender races you to the same spot.
   ===================================================================== */
function mgCatch(ctx, i, st) {
  const P = ctx.P, T1 = ctx.t.c1, T2 = ctx.t.c2, O1 = ctx.o.c1, O2 = ctx.o.c2, te = P.pos === 'TE', lv = MG_LV.indexOf(i), ppy = 10, yRef = 230;
  const T = [2.5, 2.3, 2.1, 1.95, 1.8][i], VR = 122, Q = { x: 170, y: yRef + 36 }, B0 = { x: Q.x, y: Q.y - 11 }, dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // the drive: three plays from the same series. The ball starts around midfield, every catch moves it up the field (you see the lines move), the third pass is for the touchdown
  if (st.A == null) { st.A = Math.round(rr(56, 66)); st.down = 1; st.toGo = 10; }
  let note = '';
  if (lv === 2 && 100 - st.A > 12) { st.A = 100 - randInt(8, 12); st.down = 1; st.toGo = 10; note = `Pass interference — ball at the ${100 - st.A}`; }
  st.toGo = Math.min(10, st.toGo);     // a missed catch before: the ball is spotted close enough for a touchdown pass
  const A = st.A, gl = 100 - A, td = lv === 2, down = st.down, toGo = Math.min(st.toGo, gl);
  const depth = td ? gl + rr(3, 5.5) : clamp(Math.round(rr(8 + lv * 1.5, 14 + lv * 2)), 6, Math.max(6, gl - 6));
  const L = { x: rr(46, 294), y: yRef - depth * ppy }, R = { x: 170 + rr(-70, 70), y: yRef - rr(22, 54) };
  for (let k = 0; k < 60 && dist(R, L) > VR * T * 0.72; k++) { R.x = clamp(R.x + (L.x - R.x) * 0.15, 40, 300); R.y = clamp(R.y - 6, L.y + 70, yRef - 10); }
  for (let k = 0; k < 40 && dist(R, L) < 70; k++) { L.x = rr(46, 294); }
  const adj = i >= 2 ? { ta: 0.42, dx: rr(-40, 40), dy: td ? rr(-10, 8) : rr(-28, 28) } : null;
  const L2 = adj ? { x: clamp(L.x + adj.dx, 30, 310), y: clamp(L.y + adj.dy, 44, yRef - 20) } : L;
  if (adj && dist(R, L2) > VR * T * 0.8) { L2.x = (L2.x + L.x) / 2; L2.y = (L2.y + L.y) / 2; }
  const D = i >= 1 ? { x: pick([30, 310]), y: clamp(L.y + rr(-8, 60), 44, 190) } : null, VD = 64 + 9 * i;
  const route = (te ? ['SEAM', 'DRAG', 'CORNER', 'OVER', 'POST'] : ['GO', 'POST', 'FADE', 'OUT', 'DEEP'])[i];
  const spot = a => (a > 50 ? `${ctx.o.id} ${Math.round(100 - a)}` : a === 50 ? 'MIDFIELD' : `${ctx.t.id} ${Math.round(a)}`), ord = n => ['', '1ST', '2ND', '3RD', '4TH'][n] || n + 'TH';
  const board = `${ord(down)} & ${gl <= 10 ? 'GOAL' : toGo} · ${spot(A)}`, yOfA = a => yRef - (a - A) * ppy;
  const ezTop = yOfA(110), fdY = A + toGo < 100 ? yOfA(A + toGo) : null;
  ctx.stage.innerHTML = `<svg class="mg-svg tall" viewBox="0 0 340 300"><rect width="340" height="300" rx="14" fill="#2b7d47"/><g id="mgWorld">${mgField(ctx, 340, 300, 'mgC', yRef, A, { crowd: false })}
    ${yOfA(100) > 0 ? mgEndZone(ctx, 14, Math.max(-60, ezTop), 312, yOfA(100) - Math.max(-60, ezTop), 0.6) + mgEzGrass('mgCg', 14, Math.max(-60, ezTop), 312, yOfA(100) - Math.max(-60, ezTop)) + `<line x1="14" x2="326" y1="${yOfA(100)}" y2="${yOfA(100)}" stroke="#fff" stroke-width="3.4"/>${ezTop > -4 ? `<line x1="14" x2="326" y1="${ezTop}" y2="${ezTop}" stroke="#fff" stroke-width="3.4"/>${mgPylon(14, ezTop)}${mgPylon(326, ezTop)}` : ''}${mgPylon(14, yOfA(100))}${mgPylon(326, yOfA(100))}` : ''}
    <line x1="14" x2="326" y1="${yRef}" y2="${yRef}" stroke="#4aa8ff" stroke-width="2.8" stroke-opacity=".9"/>${fdY != null && fdY > 24 ? `<line x1="14" x2="326" y1="${fdY}" y2="${fdY}" stroke="#ffd23d" stroke-width="2.8" stroke-opacity=".95"/>` : ''}</g>
    <path id="mgPath" d="M${B0.x} ${B0.y} L${L.x} ${L.y}" stroke="#fff" stroke-opacity=".85" stroke-width="2.6" stroke-dasharray="4 6" stroke-linecap="round" fill="none"/>
    <g id="mgLand" transform="translate(${L.x} ${L.y})"><circle r="20" fill="${td ? '#ffd23d' : T2}" fill-opacity=".2" stroke="${td ? '#ffd23d' : '#c5ff3a'}" stroke-width="3" class="mg-landring"/><circle r="7" fill="none" stroke="#fff" stroke-opacity=".8" stroke-dasharray="2 3"/>${td ? '<text y="4" text-anchor="middle" font-size="11" font-weight="800" fill="#fff" font-family="Barlow Condensed, sans-serif" stroke="rgba(0,0,0,.6)" stroke-width="2.4" paint-order="stroke">TD</text>' : ''}</g>
    ${D ? mgGuy(0, 0, O1, O2, { s: 1.17, down: true, cls: 'mg-defn', attrs: 'id="mgDefn"' }) : ''}
    ${mgGuy(Q.x, Q.y, T1, T2, { s: 1.17 })}
    <g id="mgMe" transform="translate(${R.x} ${R.y})">${mgGuy(0, 0, T1, T2, { s: 1.3, you: true, run: true, num: ctx.number })}<text y="-18" text-anchor="middle" font-size="9" font-weight="800" fill="#ffd23d" font-family="Barlow Condensed, sans-serif" letter-spacing=".12em" stroke="rgba(0,0,0,.6)" stroke-width="2.4" paint-order="stroke">YOU</text></g>
    <ellipse id="mgShadow" rx="7" ry="4" fill="#000" opacity=".35" cx="${B0.x}" cy="${B0.y}"/><g id="mgBallG">${mgBall(B0.x, B0.y, 1, 0, 'mgBallEl')}</g>
    <g id="mgHud"><rect x="60" y="6" width="220" height="28" rx="14" fill="rgba(5,8,16,.74)" stroke="rgba(255,255,255,.22)"/><text x="170" y="26" text-anchor="middle" font-size="18" font-weight="800" fill="#fff" font-family="Barlow Condensed, sans-serif" letter-spacing=".05em">${board}</text></g>
    <g id="mgFx"></g></svg><div class="mg-call">${te ? 'TE' : 'WR'} · <b>${route}</b> · ${lv + 1}/3</div>`;
  ctx.ctrl.innerHTML = `<div class="mg-timer"><i></i></div><div class="mg-btns four">${mgHoldBtn('l', '◀')}${mgHoldBtn('u', '▲')}${mgHoldBtn('d', '▼')}${mgHoldBtn('r', '▶')}</div>`;
  ctx.say(note ? `🚩 ${note}` : td ? 'Last play — <b>catch it in the end zone</b>' : 'Get to the <b>ring</b> before the ball does');
  return new Promise(async res => {
    await mgPre(ctx, note ? 2600 : 2000); if (!ctx.alive()) return res(false);
    const inp = mgInput(ctx);
    const bar = ctx.ctrl.querySelector('.mg-timer i'); if (bar) { bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth; bar.style.transition = `width ${T}s linear`; bar.style.width = '0%'; }
    ctx.say('<b>BALL IS UP!</b> Run to the ring', 'go'); Snd.play('mgThrow', 0.02);
    const me = ctx.stage.querySelector('#mgMe'), landG = ctx.stage.querySelector('#mgLand'), pathEl = ctx.stage.querySelector('#mgPath'), ball = ctx.stage.querySelector('#mgBallEl'), shadow = ctx.stage.querySelector('#mgShadow'), dEl = ctx.stage.querySelector('#mgDefn');
    let cur = { ...L }, Dp = D ? { ...D } : null, t0 = performance.now(), last = t0, raf = 0, ended = false, adjusted = false, P1 = null;
    const finish = async () => {
      ended = true; cancelAnimationFrame(raf); inp.dispose(); ctx.ctrl.innerHTML = '';
      const dR = dist(R, cur), dD = Dp ? dist(Dp, cur) : 99;
      const ok = dR <= 20 && (!Dp || dR <= dD + 5 || dD > 22), perfect = ok && dR <= 8;
      ball.setAttribute('transform', `translate(${ok ? R.x : cur.x} ${ok ? R.y - 2 : cur.y}) rotate(20) scale(1)`); shadow.setAttribute('opacity', 0);
      if (ok) {
        const gain = Math.max(1, Math.round((yRef - cur.y) / ppy)), na = Math.min(100, A + gain), scored = td && na >= 100, first = !scored && gain >= toGo;
        if (perfect) ctx.perfects++;
        st.A = na; if (first) { st.down = 1; st.toGo = Math.min(10, 100 - na); } else { st.down = down + 1; st.toGo = Math.max(1, toGo - gain); }
        mgPop(ctx, R.x, R.y - 26, scored ? 'TOUCHDOWN!' : perfect ? 'PERFECT!' : 'CAUGHT!', 'good'); Snd.play(scored ? 'td' : 'mgPat', scored ? 0.05 : 0); mgShake(ctx);
        ctx.say(scored ? `🏈 <b>TOUCHDOWN!</b> ${mgYardsStr(gain)} in the end zone` : `✅ ${perfect ? '✨ Dead center! ' : 'Caught it! '}${mgYardsStr(gain)}${first ? ' · <b>1ST DOWN</b>' : ''} · ball on the ${spot(na)}`, 'good'); res(true);
      } else {
        st.down = down + 1;
        const broke = Dp && dD < dR && dD <= 22; mgPop(ctx, cur.x, cur.y - 26, broke ? 'BROKEN UP' : 'TOO FAR', 'bad'); Snd.play(broke ? 'mgHit' : 'mgPat', 0); if (broke) mgShake(ctx);
        ctx.say(`❌ ${broke ? 'The defender got there first' : `Missed it by ${Math.round(dR / 10)} yds`}<span class="mg-tip">Watch the ring — it can move in the air.</span>`, 'bad'); res(false);
      }
    };
    const frame = now => {
      if (!ctx.alive()) { inp.dispose(); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now; const u = Math.min(1, (now - t0) / 1000 / T);
      // you move
      let vx = inp.k.r - inp.k.l, vy = inp.k.d - inp.k.u; if (inp.tx !== null) { vx = inp.tx - R.x; vy = inp.ty - R.y; const m = Math.hypot(vx, vy); if (m < 6) { vx = 0; vy = 0; } }
      const m = Math.hypot(vx, vy); if (m > 0) { R.x = clamp(R.x + vx / m * VR * dt, 16, 324); R.y = clamp(R.y + vy / m * VR * dt, 34, 286); }
      me.setAttribute('transform', `translate(${R.x} ${R.y})`);
      // the wind nudges the ball mid-air
      if (adj && !adjusted && u >= adj.ta) { adjusted = true; P1 = { x: B0.x + (L.x - B0.x) * adj.ta, y: B0.y + (L.y - B0.y) * adj.ta }; cur = { ...L2 }; mgPop(ctx, cur.x, cur.y - 30, '💨 WIND!', 'bad'); Snd.play('mgSwish', 0); }
      const bp = adjusted ? { x: P1.x + (cur.x - P1.x) * ((u - adj.ta) / (1 - adj.ta)), y: P1.y + (cur.y - P1.y) * ((u - adj.ta) / (1 - adj.ta)) } : { x: B0.x + (L.x - B0.x) * u, y: B0.y + (L.y - B0.y) * u };
      const h = Math.sin(Math.PI * u) * 22; ball.setAttribute('transform', `translate(${bp.x.toFixed(1)} ${(bp.y - h).toFixed(1)}) rotate(${(u * 720).toFixed(0)}) scale(${(1 + h / 70).toFixed(2)})`); shadow.setAttribute('cx', bp.x.toFixed(1)); shadow.setAttribute('cy', bp.y.toFixed(1)); shadow.setAttribute('rx', (7 - h / 14).toFixed(1));
      landG.setAttribute('transform', `translate(${cur.x} ${cur.y})`); pathEl.setAttribute('d', adjusted ? `M${P1.x} ${P1.y} L${cur.x} ${cur.y}` : `M${B0.x} ${B0.y} L${L.x} ${L.y}`);
      // the defender races to the same spot
      if (Dp) { const dx = cur.x - Dp.x, dy = cur.y - Dp.y, dm = Math.hypot(dx, dy); if (dm > 12) { Dp.x += dx / dm * VD * dt; Dp.y += dy / dm * VD * dt; } dEl.setAttribute('transform', `translate(${Dp.x} ${Dp.y})`); }
      if (u >= 1) return finish();
      raf = requestAnimationFrame(frame);
    };
    if (dEl) dEl.setAttribute('transform', `translate(${D.x} ${D.y})`);
    raf = requestAnimationFrame(frame);
  });
}

/* =====================================================================
   K — KICK IT
   Eight situations (5 are drawn each time, short to long). The ball has to pass BETWEEN the yellow uprights: touching a post is no good.
   ===================================================================== */
const KICK_SCN = {
  xp: { name: 'EXTRA POINT', dist: 33, mph: [3, 8], wx: 'clear', zone: 0.2 },
  left: { name: 'LEFT HASH', dist: 39, mph: [6, 13], wx: 'clear', hash: -1, zone: 0.17 },
  right: { name: 'RIGHT HASH', dist: 41, mph: [6, 13], wx: 'clear', hash: 1, zone: 0.17 },
  rain: { name: 'HEAVY RAIN', dist: 44, mph: [9, 16], wx: 'rain', zone: 0.14 },
  snow: { name: 'SNOW GAME', dist: 42, mph: [8, 15], wx: 'snow', zone: 0.15 },
  pressure: { name: 'LAST SECOND', dist: 47, mph: [4, 10], wx: 'clear', shaky: true, zone: 0.15 },
  dome: { name: 'DOME · LONG', dist: 53, mph: [0, 0], wx: 'dome', zone: 0.15 },
  gale: { name: 'BIG WIND', dist: 50, mph: [14, 20], wx: 'clear', zone: 0.15 },
};
// ball flight seen from above: ground track (x, y) + height h (the ball is drawn h px up the screen and grows, its shadow stays on the grass)
function mgFly(ctx, ball, shadow, pts, dur) {
  return new Promise(r => { const f0 = performance.now(); const step = () => {
    if (!ctx.alive()) return r(); const k = Math.min(1, (performance.now() - f0) / dur); let a = pts[0], b = pts[pts.length - 1];
    for (let j = 0; j < pts.length - 1; j++) if (k >= pts[j].t && k <= pts[j + 1].t) { a = pts[j]; b = pts[j + 1]; break; }
    const u = b.t === a.t ? 1 : (k - a.t) / (b.t - a.t), L = (m, n) => m + (n - m) * u, x = L(a.x, b.x), y = L(a.y, b.y), h = L(a.h, b.h), oa = a.o === undefined ? 1 : a.o, o = oa + ((b.o === undefined ? 1 : b.o) - oa) * u;
    ball.setAttribute('transform', `translate(${x.toFixed(1)} ${(y - h).toFixed(1)}) rotate(90) scale(${(0.5 + h / 70).toFixed(2)})`); ball.style.opacity = o;
    shadow.setAttribute('cx', x.toFixed(1)); shadow.setAttribute('cy', y.toFixed(1)); shadow.setAttribute('opacity', (Math.max(0.08, 0.4 - h / 150) * o).toFixed(2));
    if (k < 1) requestAnimationFrame(step); else r(); }; step(); });
}
function mgKick(ctx, i, st) {
  if (!st.plan) st.plan = shuffle(Object.keys(KICK_SCN)).slice(0, 5).sort((a, b) => KICK_SCN[a].dist - KICK_SCN[b].dist);
  const sc = KICK_SCN[st.plan[i]], dist = sc.dist, mph = randInt(sc.mph[0], sc.mph[1]), dir = rnd() < 0.5 ? -1 : 1, T1 = ctx.t.c1, T2 = ctx.t.c2, O1 = ctx.o.c1, O2 = ctx.o.c2;
  const drift = dir * mph * (dist / 40) * 0.07, pT = clamp(0.5 + (dist - 28) / 24 * 0.35 + (sc.wx === 'rain' ? 0.03 : 0), 0.45, 0.9);
  // ---- scene: seen from above, the kicker at the bottom, the uprights at the end line (the whole field is drawn to scale: s px per yard) ----
  const s = 210 / dist, yE = 66, yG = yE + 10 * s, yB = yE + dist * s, hw = clamp(3.08 * s * 1.4, 15, 28), bx = 170 + (sc.hash || 0) * 3.08 * s;
  const sl = 170 - 26.65 * s, band = Math.min(sl, 2.4 * s), flagA = dir * Math.min(35, mph * 2.2), barH = 9, upH = 26;
  let aim = 0;
  const field = mgFieldInner({ id: 'mgKg', w: 340, sl, band, y0: yE, y1: 300, yRef: yG, Aref: 100, ppy: s, Amin: Math.max(0, 100 - (300 - yG) / s), Amax: 100, numL: sl + 11 * s, numR: 340 - sl - 11 * s, numOp: 0.95 });
  const rows = mgCrowd(0, 8, 340, 6, T1, O1);
  const weather = sc.wx === 'rain' ? Array.from({ length: 40 }, (_, k) => `<line x1="${(k * 19) % 340}" y1="${(k * 37) % 220 - 20}" x2="${(k * 19) % 340 - 6}" y2="${(k * 37) % 220 + 4}" stroke="#bcd7ff" stroke-opacity=".5" stroke-width="1.2" class="mg-rain" style="animation-delay:${((k * 0.07) % 0.6).toFixed(2)}s"/>`).join('')
    : sc.wx === 'snow' ? Array.from({ length: 34 }, (_, k) => `<circle cx="${(k * 29) % 340}" cy="${(k * 41) % 260}" r="${1.2 + (k % 3) * 0.7}" fill="#fff" opacity=".8" class="mg-snow" style="animation-delay:${((k * 0.13) % 2).toFixed(2)}s"/>`).join('') : '';
  const streaks = mph >= 6 && sc.wx !== 'dome' ? Array.from({ length: Math.min(8, Math.round(mph / 2)) }, (_, k) => `<line x1="${dir > 0 ? 0 : 340}" y1="${120 + k * 20}" x2="${dir > 0 ? 38 : 302}" y2="${120 + k * 20}" stroke="#fff" stroke-opacity=".22" stroke-width="1.4" stroke-linecap="round" class="mg-streak" style="--dx:${dir * 340}px;animation-duration:${(1.8 - Math.min(1, mph / 22)).toFixed(2)}s;animation-delay:${(k * 0.25).toFixed(2)}s"/>`).join('') : '';
  const sideDots = Array.from({ length: 7 }, (_, k) => `<circle cx="${sl - band - 5 - (k % 2) * 4}" cy="${yG + 30 + k * 9}" r="2.2" fill="${k % 2 ? T1 : T2}" opacity=".8"/><circle cx="${340 - sl + band + 5 + (k % 2) * 4}" cy="${yG + 30 + k * 9}" r="2.2" fill="${k % 2 ? O1 : O2}" opacity=".8"/>`).join('');
  const los = yB - 7 * s, line = (n, y, f, t, down) => Array.from({ length: n }, (_, k) => mgGuy(170 + (k - (n - 1) / 2) * Math.max(8, s * 1.9), y, f, t, { s: 0.48, down })).join('');
  ctx.stage.innerHTML = `<svg class="mg-svg tall" viewBox="0 0 340 300"><defs>${mgGrassPat('mgKg')}<pattern id="mgStripe" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="14" fill="#fff"/></pattern><linearGradient id="mgStands" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0f20"/><stop offset="1" stop-color="#1a2342"/></linearGradient></defs>
    <rect width="340" height="300" rx="14" fill="#1d6c3d"/>${field}
    <rect width="340" height="${yE - band}" fill="url(#mgStands)"/><g class="mg-crowd">${rows}</g>
    <rect x="${sl - band}" y="${yE - band}" width="${340 - 2 * (sl - band)}" height="${band}" fill="#f6f7f4"/>
    ${mgEndZone(ctx, sl, yE, 340 - 2 * sl, 10 * s, s / 10)}${mgEzGrass('mgKg', sl, yE, 340 - 2 * sl, 10 * s)}
    <line x1="${sl}" x2="${340 - sl}" y1="${yE}" y2="${yE}" stroke="#fff" stroke-width="3"/><line x1="${sl}" x2="${340 - sl}" y1="${yG}" y2="${yG}" stroke="#fff" stroke-width="3.4"/>
    ${mgPylon(sl, yG, 0.8)}${mgPylon(340 - sl, yG, 0.8)}${mgPylon(sl, yE, 0.8)}${mgPylon(340 - sl, yE, 0.8)}
    ${sc.wx === 'snow' ? `<rect x="0" y="${yE - band}" width="340" height="300" fill="#e6f2ee" opacity=".38" pointer-events="none"/>` : sc.wx === 'rain' ? `<rect x="0" y="0" width="340" height="300" fill="#0a1124" opacity=".22" pointer-events="none"/>` : sc.wx === 'dome' ? '<rect x="0" y="0" width="340" height="300" fill="#10142b" opacity=".18" pointer-events="none"/>' : ''}
    <line x1="${sl}" x2="${340 - sl}" y1="${los}" y2="${los}" stroke="#4aa8ff" stroke-width="2" stroke-opacity=".7"/>${line(9, los - 2.4 * s, O1, O2, true)}${line(9, los + 2.2, T1, T2, false)}
    ${sideDots}
    <ellipse cx="170" cy="${yE}" rx="4" ry="2.4" fill="#c99700" stroke="#7a5a00"/>
    <g stroke="#ffd23d" stroke-linecap="round" fill="none"><line x1="170" x2="170" y1="${yE}" y2="${yE - barH}" stroke-width="3"/><line x1="${170 - hw}" x2="${170 + hw}" y1="${yE - barH}" y2="${yE - barH}" stroke-width="4"/><line id="mgUL" class="mg-upr" x1="${170 - hw}" x2="${170 - hw}" y1="${yE - barH}" y2="${yE - barH - upH}" stroke-width="4"/><line id="mgUR" class="mg-upr" x1="${170 + hw}" x2="${170 + hw}" y1="${yE - barH}" y2="${yE - barH - upH}" stroke-width="4"/></g>
    <g opacity=".95"><rect x="${170 - 56}" y="4" width="112" height="22" rx="11" fill="rgba(5,8,16,.62)"/><line x1="170" y1="19" x2="${170 + drift * hw}" y2="19" stroke="#35e0ff" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 7"/>${mph ? `<path d="M${170 + drift * hw} 19 l${-dir * 8} -5 v10z" fill="#35e0ff"/>` : ''}<text x="170" y="13" text-anchor="middle" font-size="9" fill="#35e0ff" font-family="Barlow Condensed, sans-serif" letter-spacing=".1em">${mph ? 'WIND PUSH' : 'NO WIND'}</text></g>
    <g transform="translate(250 5)"><rect width="84" height="22" rx="11" fill="rgba(5,8,16,.62)"/><line x1="12" y1="4" x2="12" y2="18" stroke="#ddd" stroke-width="2"/><path class="mg-flag" d="M12 4 L${12 + dir * 13} ${6 + Math.abs(flagA) * 0.04} L12 11 Z" fill="${T2}" stroke="#fff" stroke-width=".8"/><text x="52" y="16" text-anchor="middle" font-size="11.5" font-weight="800" fill="#fff" font-family="Barlow Condensed, sans-serif">${mph ? `${dir < 0 ? '◀ ' : ''}${mph} MPH${dir > 0 ? ' ▶' : ''}` : 'DOME'}</text></g>
    <g transform="translate(6 272)"><rect width="64" height="22" rx="11" fill="rgba(5,8,16,.62)"/><text x="32" y="16" text-anchor="middle" font-size="13" font-weight="800" fill="#fff" font-family="Barlow Condensed, sans-serif">${dist}<tspan font-size="8.5" fill-opacity=".75" letter-spacing=".12em"> YD FG</tspan></text></g>
    ${streaks}${weather}
    <g id="mgAim" ${sc.shaky ? 'class="mg-shaky"' : ''}><line id="mgAimL" x1="${bx}" y1="${yB}" x2="170" y2="${yE}" stroke="#ffd23d" stroke-width="2" stroke-dasharray="5 5"/><circle id="mgAimC" cx="170" cy="${yE - barH - 4}" r="6" fill="none" stroke="#ffd23d" stroke-width="2.5"/></g>
    ${mgGuy(bx - 15, yB + 12, T1, T2, { s: 0.9, you: true, num: ctx.number })}${mgGuy(bx + 13, yB + 3, T1, T2, { s: 0.74 })}<ellipse id="mgSh" rx="6" ry="3" fill="#000" opacity=".38" cx="${bx}" cy="${yB}"/><g id="mgBallG">${mgBall(bx, yB - 1, 0.5, 90, 'mgBallEl')}</g><g id="mgFx"></g></svg><div class="mg-call">${sc.name} · ${MG_LV.indexOf(i) + 1}/3</div>`;
  const aimX = a => 170 + a * hw * 2;
  ctx.ctrl.innerHTML = `<div class="mg-aim"><span>AIM</span><input type="range" min="-100" max="100" value="0" id="mgAimIn"></div><div class="mg-btns one"><button class="mg-b big" id="mgKickGo" style="--c:#ffd23d">🦵 KICK <small>SPACE</small></button></div>`;
  ctx.say(sc.shaky ? '<b>Everything on the line…</b> steady your aim · ← → aim · SPACE kick' : 'Aim <b>into</b> the wind · <b>← →</b> aim · <b>SPACE</b> kick');
  if (sc.shaky) Snd.play('mgTension', 0.05);
  const inp = ctx.ov.querySelector('#mgAimIn'), setAim = () => { aim = inp.value / 100; const x = aimX(aim); ctx.stage.querySelector('#mgAimL').setAttribute('x2', x); ctx.stage.querySelector('#mgAimC').setAttribute('cx', x); };
  inp.addEventListener('input', setAim);
  // keyboard: ← → move the aim, SPACE kicks and then stops the power bar
  let phase = 'aim', stopFn = null;
  const kd = e => {
    if (!ctx.alive()) { document.removeEventListener('keydown', kd); return; }
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault(); if (e.repeat) return;
      if (phase === 'aim') { const go = ctx.ov.querySelector('#mgKickGo'); if (go && !go.disabled) go.click(); } else if (phase === 'power' && stopFn) stopFn(e);
      return;
    }
    const dx = (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') ? -1 : (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') ? 1 : 0;
    if (dx && phase === 'aim') { e.preventDefault(); inp.value = clamp(Number(inp.value) + dx * (e.repeat ? 4 : 3), -100, 100); setAim(); }
  };
  document.addEventListener('keydown', kd);
  return new Promise(res => {
    ctx.ov.querySelector('#mgKickGo').addEventListener('click', async () => {
      if (!ctx.alive()) return; ctx.ov.querySelector('#mgKickGo').disabled = true; inp.disabled = true; phase = 'power';
      const z = sc.zone;
      ctx.ctrl.innerHTML = `<div class="mg-power"><div class="mg-py" style="left:${(pT - 0.2) * 100}%;width:40%"></div><div class="mg-pz" style="left:${(pT - z / 2) * 100}%;width:${z * 100}%"></div><i id="mgPI"></i></div><div class="mg-btns one"><button class="mg-b big" id="mgStop" style="--c:#c5ff3a">⏹ STOP <small>SPACE</small></button></div>`;
      ctx.say('<b>Stop the bar in the green!</b> · SPACE', 'go');
      const pi = ctx.ov.querySelector('#mgPI'), t0 = performance.now(), sp = (0.95 + i * 0.12) * (sc.shaky ? 1.18 : 1); let raf = 0;
      const val = () => { const ph = ((performance.now() - t0) / 1000 * sp) % 2; return ph < 1 ? ph : 2 - ph; };
      const upd = () => { if (!ctx.alive()) return; pi.style.left = (val() * 100) + '%'; raf = requestAnimationFrame(upd); }; raf = requestAnimationFrame(upd);
      const stop = async ev => {
        ev.preventDefault(); phase = 'done'; document.removeEventListener('keydown', kd); ctx.stage.removeEventListener('pointerdown', stop); cancelAnimationFrame(raf); const p = val(), perr = Math.abs(p - pT); ctx.ctrl.innerHTML = '';
        const shake = sc.shaky ? (rnd() - 0.5) * 0.5 : 0;
        const lateral = aim * 2 + drift + shake + (rnd() - 0.5) * 0.22 * (1 + 3 * perr) + (p < pT ? -0.1 : 0.1) * perr * 2, al = Math.abs(lateral);
        const short = p < pT - 0.2, over = p > pT + 0.2;
        // the ball must pass BETWEEN the posts: inside 0.8 of the upright line is clean, 0.8 to 1.14 touches the post
        const upright = !short && !over && al > 0.8 && al <= 1.14, wide = !short && !over && al > 1.14, ok = !short && !over && al <= 0.8;
        const perfect = ok && al < 0.3 && perr < z / 2;
        Snd.play('mgKick', 0);
        const ball = ctx.stage.querySelector('#mgBallEl'), shadow = ctx.stage.querySelector('#mgSh'), landX = 170 + lateral * hw, sgn = lateral < 0 ? -1 : 1;
        const arcPts = (n, tEnd, x1, y1, hf) => Array.from({ length: n + 1 }, (_, k) => { const f = k / n; return { t: f * tEnd, x: bx + (x1 - bx) * f, y: yB + (y1 - yB) * f, h: hf(f) }; });
        const clear = f => 56 * Math.sin(Math.PI * (0.08 + 0.84 * f));                   // an ordinary kick: peaks mid-way and is a little above the crossbar at the posts
        let frames, dur = 1150;
        if (short) { const x1 = bx + (landX - bx) * 0.62, y1 = yB + (yE - yB) * 0.62; frames = arcPts(12, 0.8, x1, y1, f => 200 * f * (1 - f)).concat([{ t: 0.92, x: x1 + (landX - bx) * 0.04, y: y1 - 6, h: 7 }, { t: 1, x: x1 + (landX - bx) * 0.07, y: y1 - 9, h: 0 }]); dur = 900; }
        else if (over) { frames = arcPts(14, 1, landX, yE - 60, f => 380 * f * (1 - f)).map((f, k, a) => (k === a.length - 1 ? { ...f, o: 0 } : f)); }
        else if (ok) { frames = arcPts(12, 0.7, landX, yE, clear).concat([{ t: 0.86, x: landX, y: yE - 18, h: 10, o: 1 }, { t: 1, x: landX + (landX - 170) * 0.1, y: yE - 36, h: 4, o: 0 }]); }
        else if (upright) { frames = arcPts(12, 0.7, landX, yE, clear).concat([{ t: 0.82, x: landX - sgn * 8, y: yE + 10, h: 26 }, { t: 1, x: landX - sgn * 22, y: yE + 34, h: 0 }]); }
        else { frames = arcPts(14, 1, landX, yE - 50, f => 38 * Math.sin(Math.PI * (0.05 + 0.9 * f))).map((f, k, a) => (k === a.length - 1 ? { ...f, o: 0 } : f)); }
        await mgFly(ctx, ball, shadow, frames, dur);
        if (!ctx.alive()) return res(false);
        let txt;
        const popY = yG + 22;
        if (ok) { txt = `${dist}-YARD FIELD GOAL IS GOOD!`; mgPop(ctx, 170, popY, perfect ? 'PERFECT!' : 'GOOD!', 'good'); if (perfect) { ctx.perfects++; txt = '✨ PERFECT KICK! ' + txt; } Snd.play('td', 0.15); mgShake(ctx); }
        else if (upright) {
          const up = ctx.stage.querySelector(lateral < 0 ? '#mgUL' : '#mgUR'); if (up) { up.classList.add('hit'); } Snd.play('mgPost', 0); mgShake(ctx);
          txt = 'It hit the upright — no good!'; mgPop(ctx, 170, popY, 'OFF THE POST!', 'bad');
        } else { const why = short ? 'SHORT' : over ? 'TOO HIGH' : (lateral < 0 ? 'WIDE LEFT' : 'WIDE RIGHT'); txt = `No good — ${why.toLowerCase()}`; mgPop(ctx, 170, popY, why, 'bad'); }
        const tip = (wide || upright) ? '<span class="mg-tip">The wind pushed it — aim against the arrow.</span>' : (short || over) ? '<span class="mg-tip">Stop the bar inside the green.</span>' : '';
        ctx.say(`${ok ? '✅' : '❌'} ${txt}${tip}`, ok ? 'good' : 'bad'); res(ok);
      };
      stopFn = stop; ctx.ov.querySelector('#mgStop').addEventListener('pointerdown', stop, { once: true }); ctx.stage.addEventListener('pointerdown', stop);
    }, { once: true });
  });
}

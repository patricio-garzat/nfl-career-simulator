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
  qb: P => ({ icon: '🏈', title: 'FIND THE OPEN MAN', how: 'A defender sticks to one receiver. Throw to the other one.', legend: [['🔴', 'Defender on him', 'covered'], ['🟢', 'Nobody close', 'THROW HERE']] }),
  rb: P => ({ icon: '🏃', title: 'RUSH FOR THE TD', how: 'Reach the end zone for a touchdown. Dodge the defenders and outrun the tackler.', legend: [['⌨️', '← → keys', 'dodge'], ['🏃', 'Tackler behind you', 'don\'t stumble'], ['🏈', 'End zone', 'TOUCHDOWN']] }),
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
const mgGuy = (x, y, f, t, o = {}) => { const s = o.s || 1; return `<g class="mg-guy ${o.cls || ''}" ${o.attrs || ''} style="transform:translate(${x}px,${y}px)">${o.you ? `<circle r="${15 * s}" fill="rgba(255,210,61,.18)" stroke="#ffd23d" stroke-width="2" class="mg-you"/>` : ''}<ellipse rx="${10 * s}" ry="${6 * s}" fill="${f}" stroke="${mgStroke(f)}" stroke-width="1.3"/><g ${o.down ? 'transform="rotate(180)"' : ''}><circle cy="${-1 * s}" r="${4.8 * s}" fill="${t}" stroke="${mgStroke(t)}" stroke-width="1"/><path d="M${-2.6 * s} ${-4.6 * s}Q0 ${-7.6 * s} ${2.6 * s} ${-4.6 * s}" stroke="${mgStroke(t)}" fill="none" stroke-width="1.1"/></g></g>`; };
const mgBall = (x, y, s = 1, rot = 0, id = '') => `<g ${id ? `id="${id}"` : ''} transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><ellipse rx="11" ry="7" fill="#8a4b22" stroke="#3d1c08" stroke-width="1.3"/><path d="M-5 0H5M-2.5 -2.2v4.4M0 -2.2v4.4M2.5 -2.2v4.4" stroke="#fff" stroke-width="1.1" fill="none" stroke-linecap="round"/><ellipse rx="9" ry="5" fill="none" stroke="rgba(255,255,255,.18)"/></g>`;
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
    return `<g transform="translate(${x} ${y}) rotate(${rot})" font-family="'Special Gothic Condensed One','Barlow Condensed',sans-serif" font-size="${fs.toFixed(1)}" fill="#fff" fill-opacity="${o.numOp || 0.5}"><text x="${-gp}" y="${nh / 2}" text-anchor="end">${s[0]}</text><text x="${gp}" y="${nh / 2}" text-anchor="start">${s[1]}</text></g>`;
  };
  const arrow = (x, y, up) => `<polygon points="${x - nh * 0.34},${y + (up ? 0.3 : -0.3) * nh} ${x + nh * 0.34},${y + (up ? 0.3 : -0.3) * nh} ${x},${y + (up ? -0.35 : 0.35) * nh}" fill="#fff" fill-opacity="${o.numOp || 0.5}"/>`;
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
    const n = w > 240 ? 3 : 1, lg = Math.min(h * 0.62, 56);
    return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${team.c1}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#mgStripe)" opacity=".2"/>${Array.from({ length: n }, (_, i) => `<image href="${team.logo}" x="${cx + (i - (n - 1) / 2) * w * 0.3 - lg / 2}" y="${cy - lg / 2}" width="${lg}" height="${lg}" opacity=".92" preserveAspectRatio="xMidYMid meet"/>`).join('')}</g>`;
  }
  const items = d.ends[0], local = (d.deco === 'tiger' ? lvTiger() : '') + (d.deco === 'band' ? '<rect x="-270" y="-50" width="540" height="7" fill="#fff" opacity=".85"/>' : '')
    + (d.deco === 'sband' ? '<rect x="-270" y="-50" width="540" height="9" fill="#101010" opacity=".92"/><rect x="-270" y="-39" width="540" height="2" fill="#D3BC8D"/>' : '') + lvEzItems(items, team, d.ey);
  return `<defs><clipPath id="${cid}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs><g clip-path="url(#${cid})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#2d8647"/>${d.bg ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${d.bg}" opacity="${d.op || 0.94}"/>` : ''}<g transform="translate(${cx} ${cy}) scale(${k})">${local}</g></g>`;
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
    ${mid > 20 && mid < h - 20 ? `<image href="${(ctx.env.nfl && typeof NFL_MID_LOGO !== 'undefined' && NFL_MID_LOGO[t.id]) || t.logo}" x="${w / 2 - 44}" y="${mid - 44}" width="88" height="88" opacity=".88" preserveAspectRatio="xMidYMid meet"/>` : ''}
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
  const P = env.P, kind = se.mg.kind, t = env.t, opp = env.o, meta = MG_META[kind](P);
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
}
async function mgRun(ctx) {
  const fn = { qb: mgQB, rb: mgRB, catch: mgCatch, kick: mgKick }[ctx.kind], st = {};
  ctx.ctrl.innerHTML = ''; ctx.say('');
  for (let i = 0; i < 3; i++) {
    if (!ctx.alive()) return;
    ctx.ov.querySelectorAll('.mg-pips [data-p]').forEach((p, k) => p.classList.toggle('cur', k === i));
    const ok = await fn(ctx, MG_LV[i], st); if (!ctx.alive()) return;
    ctx.results.push(ok);
    ctx.combo = ok ? ctx.combo + 1 : 0;
    ctx.ov.querySelector(`.mg-pips [data-p="${i}"]`).className = ok ? 'ok' : 'bad';
    ctx.ov.querySelector('#mgScore').textContent = `${ctx.results.filter(Boolean).length}/3`;
    const cb = ctx.ov.querySelector('#mgCombo'); if (ctx.combo >= 2) { cb.hidden = false; cb.textContent = `🔥 x${ctx.combo}`; cb.classList.remove('pop'); void cb.offsetWidth; cb.classList.add('pop'); } else cb.hidden = true;
    if (ok) { Snd.play('mgGood', 0, Math.min(4, ctx.combo - 1)); mgFlash(ctx, true); } else { Snd.play('mgMiss', 0); mgFlash(ctx, false); }
    await sleep(i < 2 ? 1500 : 900);
  }
  mgFinish(ctx);
}
function mgFlash(ctx, good) { const s = ctx.stage; s.classList.remove('mg-good', 'mg-badflash'); void s.offsetWidth; s.classList.add(good ? 'mg-good' : 'mg-badflash'); if (good) { Snd.play('mgCrowd', 0.12, 1); burst(s, 14, [ctx.t.c1, ctx.t.c2, '#ffffff', '#ffd23d']); } }
function mgFinish(ctx) {
  const se = ctx.env.se, raw = ctx.results.filter(Boolean).length, sc = MG_SC[raw], g = MG_GRADES[sc], good = sc >= 3;
  const extra = good ? Math.min(0.04, ctx.perfects * 0.01) : 0, perf = Math.min(0.12, g.perf + extra);
  const weekly = !!(se.mg && se.mg.weekly), gi = mgGamesIn(se), streak = weekly ? (se.mgTrainAt === gi - 1 && se.mgStreak ? se.mgStreak + 1 : 1) : 0;
  const wPerf = weekly ? MG_WEEK_PERF[sc] + Math.min(0.03, 0.005 * (streak - 1)) : 0;
  const fx = weekly ? `+${(wPerf * 100).toFixed(1).replace(/\.0$/, '')}% performance in your next game${streak > 1 ? ` · ${streak}-week training streak` : ''}` : `${perf > 0 ? '+' : '−'}${Math.abs(Math.round(perf * 100))}% performance all season · moves your rating`;
  ctx.stage.innerHTML = `<div class="mg-res ${good ? 'good' : 'bad'}" style="background-image:radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, ${ctx.t.c1} 38%, transparent), transparent)">
    <div class="mg-jersey-big small">${ctx.env.jersey ? ctx.env.jersey('back') : ''}</div>
    <div class="mg-grade">${g.n}</div><div class="mg-big">${raw}<small>/3</small></div>
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
function mgSkip() { const env = MGX && MGX.env, se = env && env.se; if (se) { se.mg = null; se.mgSince = 0; se.mgIn = randInt(3, 5); if (env.save) saveGame(); } const o = document.querySelector('.mg-overlay'); if (o) o.remove(); MGX = null; if (env) env.onDone(); }
function mgDone() { const env = MGX && MGX.env; const o = document.querySelector('.mg-overlay'); if (o) o.remove(); MGX = null; if (env) env.onDone(); }
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
   QB — FIND THE OPEN MAN
   Two receivers: the WR (deep) and the RB (short). A defender is stuck to one of them: throw to the other one.
   Level 1: it is obvious. Level 2: both have a defender, one is much closer. Level 3: the defense SWITCHES right after the snap.
   ===================================================================== */
const QB_R = {
  WR: { x: 292, y: 140, c: '#ffd23d', l: 'WR', route: [[292, 140], [292, 70], [268, 36]] },
  RB: { x: 104, y: 190, c: '#c5ff3a', l: 'RB', route: [[104, 190], [64, 186], [38, 158]] },
};
const QB_COVER = { WR: [276, 126], RB: [120, 178] }, QB_NEAR = { WR: [244, 100], RB: [144, 154] };   // right on top of him / still in the picture but clearly behind
function mgQB(ctx, i, st) {
  const lv = MG_LV.indexOf(i);
  if (!st.open) { const a = shuffle(['WR', 'RB']); st.open = [a[0], a[1], pick(['WR', 'RB'])]; st.flip = [rnd() < 0.5, rnd() < 0.5, rnd() < 0.5]; }
  const open = st.open[lv], shut = open === 'WR' ? 'RB' : 'WR', flip = st.flip[lv], mx = x => (flip ? 340 - x : x);
  const T1 = ctx.t.c1, T2 = ctx.t.c2, O1 = ctx.o.c1, O2 = ctx.o.c2, switchy = lv === 2;
  const line = [[148, 134], [196, 134]];                                            // the two key defenders start on the line and then pick their men
  const fin = [QB_COVER[shut], lv === 0 ? [170, 56] : QB_NEAR[open]];              // final spots: one is glued to a receiver, the other is far from the open man
  const pre = switchy ? [QB_COVER[open], QB_NEAR[shut]] : fin;                      // level 3 shows the opposite picture first
  const defs = fin.map((f, k) => mgGuy(mx(line[k][0]), line[k][1], '#e04b4b', '#4a1010', { s: 1.25, down: true, cls: 'mg-d', attrs: `data-p="${mx(pre[k][0])},${pre[k][1]}" data-f="${mx(f[0])},${f[1]}"` })).join('');
  const dl = [140, 158, 182, 200].map(x => mgGuy(x, 118, '#b83a3a', '#4a1010', { s: 1.0, down: true })).join(''), ol = [134, 152, 170, 188, 206].map(x => mgGuy(x, 146, T1, T2, { s: 1.0 })).join('');
  const marker = c => `<marker id="mgA${c.slice(1)}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`;
  const routes = Object.entries(QB_R).map(([k, g]) => `<path d="M${g.route.map(p => `${mx(p[0])} ${p[1]}`).join(' L')}" stroke="${g.c}" stroke-width="2.4" stroke-dasharray="6 5" fill="none" marker-end="url(#mgA${g.c.slice(1)})" opacity=".9" class="mg-route"/>`).join('');
  const tgs = Object.entries(QB_R).map(([k, g]) => { const x = mx(g.x), y = g.y; return `<g class="mg-tg" data-pick="${k}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="26" fill="transparent"/>${mgGuy(x, y, T1, T2, { s: 1.5 })}<text x="${x}" y="${y + 25}" text-anchor="middle" font-size="12" font-weight="800" fill="${g.c}" font-family="Barlow Condensed, sans-serif" letter-spacing=".08em" stroke="rgba(0,0,0,.6)" stroke-width="2.6" paint-order="stroke">${g.l}</text></g>`; }).join('');
  const ringAt = (p, c) => `<circle cx="${mx(p[0])}" cy="${p[1]}" r="20" fill="none" stroke="${c}" stroke-width="3.2" stroke-dasharray="5 4"/>`;
  const rings = `<g id="mgRings" opacity="0" style="transition:opacity .35s">${ringAt([QB_R[open].x, QB_R[open].y], '#6dffbb')}${ringAt(QB_COVER[shut], '#ff5d5d')}</g>`;
  ctx.stage.innerHTML = `<svg class="mg-svg" viewBox="0 0 340 250">${mgField(ctx, 340, 250, 'mgQ', 132, 33, { crowd: false })}<defs>${marker('#ffd23d')}${marker('#c5ff3a')}</defs>
    <line x1="0" x2="340" y1="132" y2="132" stroke="#4aa8ff" stroke-width="2.5" stroke-opacity=".85"/>${routes}${dl}${defs}${ol}${tgs}${rings}${mgGuy(170, 168, T1, T2, { s: 1.5, you: true, cls: 'mg-qb' })}
    <g id="mgBallG">${mgBall(170, 168, 0.85, 0, 'mgBallEl')}</g><g id="mgFx"></g></svg><div class="mg-call">FIND THE OPEN MAN · ${lv + 1}/3</div>`;
  ctx.ctrl.innerHTML = `<div class="mg-timer"><i></i></div><div class="mg-btns two">${Object.entries(QB_R).map(([k, g]) => `<button class="mg-b" data-pick="${k}" style="--c:${g.c}">${g.l}</button>`).join('')}</div>`;
  ctx.say('The defense is getting set…');
  const secs = [5.5, 4.8, 4.4][lv];
  return (async () => {
    await sleep(350); if (!ctx.alive()) return false;
    const go = key => ctx.stage.querySelectorAll('.mg-d').forEach(g => { const [fx, fy] = g.dataset[key].split(',').map(Number); g.style.transform = `translate(${fx}px,${fy}px)`; });
    go('p'); ctx.say(switchy ? 'Who is open? <b>Watch closely…</b>' : 'Throw to the receiver with <b>nobody close</b>.');
    await sleep(900); if (!ctx.alive()) return false;
    ctx.say('<b>HIKE!</b>', 'go'); Snd.play('mgSnap', 0.02);
    mgPickBtn(ctx, '.mg-btns .mg-b, .mg-tg');
    if (switchy) setTimeout(() => { if (!ctx.alive() || !ctx.pick) return; go('f'); ctx.say('<b>⚠ THE DEFENSE SWITCHES!</b>', 'go'); Snd.play('mgSwish', 0); }, 1000);
    const pickd = await mgChoice(ctx, secs); if (!ctx.alive()) return false;
    ctx.ctrl.innerHTML = ''; go('f'); const rg = ctx.stage.querySelector('#mgRings'); if (rg) rg.style.opacity = 1;
    const quick = pickd && (performance.now() - ctx.pickStart) / 1000 < secs * 0.45;
    const ok = pickd === open, bg = ctx.stage.querySelector('#mgBallG');
    let txt = '';
    if (!pickd) { txt = 'SACKED! Too slow'; mgPop(ctx, 170, 150, 'SACK!', 'bad'); Snd.play('mgHit', 0); mgShake(ctx); }
    else {
      const tg = QB_R[pickd], tx = mx(tg.x), ty = tg.y - 6; Snd.play('mgThrow', 0);
      await new Promise(r => { const t0 = performance.now(), dur = 520; const step = () => { if (!ctx.alive()) return r(); const k = Math.min(1, (performance.now() - t0) / dur), x = 170 + (tx - 170) * k, y = 168 + (ty - 168) * k - Math.sin(Math.PI * k) * 26; ctx.stage.querySelector('#mgBallEl').setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(k * 540).toFixed(0)}) scale(${(0.85 + Math.sin(Math.PI * k) * 0.35).toFixed(2)})`); if (k < 1) requestAnimationFrame(step); else r(); }; step(); });
      if (ok) { const y = pickd === 'WR' ? randInt(14, 32) : randInt(5, 12); txt = `COMPLETE! ${mgYardsStr(y)}`; mgPop(ctx, tx, ty - 14, mgYardsStr(y), 'good'); Snd.play('mgPat', 0); if (y >= 20) Snd.play('td', 0.15); }
      else if (pickd === 'WR') { txt = 'INTERCEPTED! The WR was covered'; mgPop(ctx, tx, ty - 14, 'INT!', 'bad'); Snd.play('mgHit', 0); mgShake(ctx); }
      else { txt = 'TACKLED! The RB was covered'; mgPop(ctx, tx, ty - 14, 'LOSS', 'bad'); Snd.play('mgHit', 0); mgShake(ctx); }
    }
    if (ok && quick) { ctx.perfects++; txt += ' · ✨ quick read'; }
    const tip = `${shut} had a defender on him — <b>${open}</b> was open${switchy ? ' (after the switch)' : ''}.`;
    ctx.say(`${ok ? '✅' : '❌'} ${txt}${ok ? '' : `<span class="mg-tip">${tip}</span>`}`, ok ? 'good' : 'bad');
    return ok;
  })();
}

/* =====================================================================
   Controls shared by the two "arcade" games (RB run, WR/TE catch): arrow keys / WASD, dragging a finger on the field, or the on-screen hold buttons.
   ===================================================================== */
function mgInput(ctx) {
  const k = { l: 0, r: 0, u: 0, d: 0 }, o = { k, tx: null, ty: null };
  const map = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd', a: 'l', A: 'l', d: 'r', D: 'r', w: 'u', W: 'u', s: 'd', S: 'd' };
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
   RB — RUSH FOR THE TD
   Top-down. You carry the ball up the field; defenders are scattered ahead, a tackler chases you. Dodge left/right and reach the line before he catches you.
   Hitting a defender makes you stumble (you slow down and the chaser gains). Later runs are longer, with defenders that slide and that track you.
   ===================================================================== */
function mgRB(ctx, i, st) {
  const T1 = ctx.t.c1, T2 = ctx.t.c2, O1 = ctx.o.c1, O2 = ctx.o.c2, yds = [24, 28, 32, 36, 40][i], GOAL = yds * 10, RY = 205, XMIN = 26, XMAX = 314;
  const vf = 62, vc = vf * (1 + 0.02 * i), LAT = 190, IN = 24;    // IN: how far past the goal line he must be (whole body in the end zone) before it counts
  // defenders ahead, in rows
  const defs = []; let w = 92 + rr(0, 16);
  while (w < GOAL - 24) {
    w += 28 + rnd() * 14; const n = 1 + (rnd() < 0.42 + i * 0.1 ? 1 : 0) + (i >= 2 && rnd() < 0.22 ? 1 : 0), xs = [];
    for (let k = 0; k < n; k++) { let x, tries = 0; do { x = rr(XMIN + 8, XMAX - 8); tries++; } while (xs.some(q => Math.abs(q - x) < 64) && tries < 20); xs.push(x); defs.push({ w, x, bx: x, type: i >= 1 && rnd() < 0.28 + 0.08 * i ? 'slide' : (i >= 2 && rnd() < 0.22 ? 'track' : 'stand'), ph: rnd() * 6.28, hit: false }); }
  }
  const start = 100 - yds, yOfA = A => -(A - start) * 10;   // you start on the opponent's (yds)-yard line; 10 px per yard, upfield = up
  const dsvg = defs.map((d, k) => mgGuy(0, 0, O1, O2, { s: 1.45, down: true, cls: 'mg-rbd', attrs: `data-k="${k}"` })).join('');
  ctx.stage.innerHTML = `<svg class="mg-svg tall" viewBox="0 0 340 300"><defs>${mgGrassPat('mgRGp')}<linearGradient id="mgRG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d6c3d"/><stop offset="1" stop-color="#12502b"/></linearGradient>${mgLights('mgRL', T1)}</defs>
    <rect width="340" height="300" rx="14" fill="url(#mgRG)"/>
    <g id="mgRW" style="transform:translate(0px,${RY}px)">
      ${mgFieldInner({ id: 'mgRGp', w: 340, sl: 14, y0: -GOAL - 100, y1: 110, yRef: 0, Aref: start, ppy: 10, Amin: start - 12, Amax: 100, numL: 50, numR: 290 })}
      ${yOfA(50) < 100 && yOfA(50) > -GOAL - 100 ? `<image href="${(ctx.env.nfl && typeof NFL_MID_LOGO !== 'undefined' && NFL_MID_LOGO[ctx.t.id]) || ctx.t.logo}" x="126" y="${yOfA(50) - 44}" width="88" height="88" opacity=".88" preserveAspectRatio="xMidYMid meet"/>` : ''}
      ${mgEndZone(ctx, 14, -GOAL - 100, 312, 100, 0.6)}${mgEzGrass('mgRGp', 14, -GOAL - 100, 312, 100)}
      <line x1="14" x2="326" y1="${-GOAL}" y2="${-GOAL}" stroke="#fff" stroke-width="3.4"/><line x1="14" x2="326" y1="${-GOAL - 100}" y2="${-GOAL - 100}" stroke="#fff" stroke-width="3.4"/>
      <rect x="0" y="${-GOAL - 122}" width="340" height="22" fill="#f6f7f4"/><g stroke="#ffd23d" stroke-width="3.4" stroke-linecap="round" fill="none"><line x1="158" x2="182" y1="${-GOAL - 114}" y2="${-GOAL - 114}"/><line x1="170" x2="170" y1="${-GOAL - 100}" y2="${-GOAL - 114}"/><circle cx="158" cy="${-GOAL - 114}" r="2.2"/><circle cx="182" cy="${-GOAL - 114}" r="2.2"/></g>
      ${mgPylon(14, -GOAL)}${mgPylon(326, -GOAL)}${mgPylon(14, -GOAL - 100)}${mgPylon(326, -GOAL - 100)}
      <line x1="14" x2="326" y1="0" y2="0" stroke="#4aa8ff" stroke-width="3" stroke-opacity=".85"/>${dsvg}</g>
    <defs><pattern id="mgStripe" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="14" fill="#fff"/></pattern></defs>
    <g id="mgChaser" class="mg-chaser"><circle r="17" fill="rgba(255,60,60,.16)" class="mg-you" style="stroke:#ff5d5d;stroke-width:2"/>${mgGuy(0, 0, O1, O2, { s: 1.6 })}</g>
    <g id="mgMe">${mgGuy(0, 0, T1, T2, { s: 1.6, you: true })}${mgBall(0, -2, 0.6, 90)}</g>
    <g id="mgHud"><rect x="104" y="20" width="132" height="30" rx="15" fill="rgba(5,8,16,.7)" stroke="rgba(255,255,255,.2)"/><text id="mgYd" x="170" y="41" text-anchor="middle" font-size="20" font-weight="800" fill="#fff" font-family="Barlow Condensed, sans-serif">${yds} YDS TO TD</text>
      <rect x="10" y="60" width="10" height="130" rx="5" fill="rgba(255,255,255,.12)"/><rect id="mgGap" x="10" y="190" width="10" height="130" rx="5" fill="#6dffbb" style="transform-origin:15px 190px;transform:scaleY(-1)"/><text x="15" y="204" text-anchor="middle" font-size="8" fill="#fff" fill-opacity=".7" font-family="Barlow Condensed, sans-serif" letter-spacing=".1em">GAP</text></g>
    <g id="mgFx"></g></svg><div class="mg-call">RUSH FOR THE TD · ${yds} yds out · ${MG_LV.indexOf(i) + 1}/3</div>`;
  ctx.ctrl.innerHTML = `<div class="mg-btns two">${mgHoldBtn('l', '◀ LEFT')}${mgHoldBtn('r', 'RIGHT ▶')}</div>`;
  ctx.say('<b>← →</b> dodge the defenders · get to the <b>END ZONE</b>');
  return new Promise(async res => {
    await sleep(500); if (!ctx.alive()) return res(false);
    const inp = mgInput(ctx);
    const R = { x: 170, w: 0, stun: 0 }, C = { x: 170, w: -(78 - 3 * i) }, els = [...ctx.stage.querySelectorAll('.mg-rbd')], world = ctx.stage.querySelector('#mgRW'), me = ctx.stage.querySelector('#mgMe'), ch = ctx.stage.querySelector('#mgChaser'), ydT = ctx.stage.querySelector('#mgYd'), gapB = ctx.stage.querySelector('#mgGap');
    let last = performance.now(), t = 0, ended = false, stumbles = 0, raf = 0, lean = 0, scored = false;
    ctx.say('<b>GO!</b>', 'go'); Snd.play('mgSnap', 0);
    const end = async (win) => {
      if (ended) return; ended = true; cancelAnimationFrame(raf); inp.dispose(); ctx.ctrl.innerHTML = '';
      const got = Math.max(0, Math.min(yds, Math.round(R.w / 10)));
      if (win) {
        const perfect = stumbles === 0; if (perfect) ctx.perfects++;
        mgPop(ctx, 170, 100, perfect ? 'UNTOUCHED TD!' : 'TOUCHDOWN!', 'good'); mgShake(ctx);
        ctx.say(`🏈 <b>TOUCHDOWN!</b> ${yds}-yard run${perfect ? ' · ✨ untouched' : stumbles ? ` · ${stumbles} stumble${stumbles > 1 ? 's' : ''}` : ''}`, 'good'); res(true);
      } else {
        mgPop(ctx, 170, 120, 'STOPPED SHORT!', 'bad'); Snd.play('mgHit', 0); mgShake(ctx);
        ctx.say(`❌ Tackled just ${Math.max(1, yds - got)} yard${yds - got === 1 ? '' : 's'} short of the end zone<span class="mg-tip">Dodge the defenders — every hit lets the tackler catch up.</span>`, 'bad'); res(false);
      }
    };
    const frame = now => {
      if (!ctx.alive()) { inp.dispose(); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      // steering
      let dir = (inp.k.r - inp.k.l); if (inp.tx !== null) dir = clamp((inp.tx - R.x) / 14, -1, 1);
      R.x = clamp(R.x + dir * LAT * dt, XMIN, XMAX); lean += (dir * 14 - lean) * Math.min(1, dt * 10);
      R.stun = Math.max(0, R.stun - dt); R.w += vf * (R.stun > 0 ? 0.3 : 1) * dt; C.w += vc * dt; C.x += clamp(R.x - C.x, -62 * dt, 62 * dt);
      defs.forEach(d => {
        if (d.type === 'slide') d.x = clamp(d.bx + Math.sin(t * 1.7 + d.ph) * 38, XMIN, XMAX);
        else if (d.type === 'track' && !d.hit) { const ah = d.w - R.w; if (ah > 0 && ah < 150) d.x = clamp(d.x + clamp(R.x - d.x, -1, 1) * (30 + 5 * i) * dt, XMIN, XMAX); }
        if (!d.hit && Math.abs(d.w - R.w) < 15 && Math.abs(d.x - R.x) < 17) { d.hit = true; R.stun = 0.7; stumbles++; Snd.play('mgHit', 0); mgShake(ctx); }
      });
      // draw
      world.style.transform = `translate(0px,${RY + R.w}px)`;
      els.forEach((e, k) => { const d = defs[k]; e.style.transform = `translate(${d.x}px,${-d.w}px) rotate(${d.hit ? 90 : 0}deg)`; e.style.opacity = d.hit ? 0.55 : 1; });
      me.style.transform = `translate(${R.x}px,${RY}px) rotate(${lean * 0.9}deg)`; ch.style.transform = `translate(${C.x}px,${RY + (R.w - C.w)}px)`;
      const gap = R.w - C.w; gapB.style.transform = `scaleY(${-clamp(gap / 90, 0.03, 1)})`; gapB.setAttribute('fill', gap < 28 ? '#ff5d5d' : gap < 55 ? '#ffd23d' : '#6dffbb');
      ydT.textContent = `${Math.max(0, Math.ceil((GOAL + IN - R.w) / 10))} YDS TO TD`;
      if (R.w >= GOAL + IN && !scored) { scored = true; Snd.play('td', 0.05); mgPop(ctx, 170, 100, 'TOUCHDOWN!', 'good'); }      // his whole body is inside the end zone: now it is a touchdown (not before), and nobody can stop him
      if (R.w >= GOAL + 50) return end(true);                         // he runs into the end zone before the play is over
      if (!scored && C.w >= R.w - 14 && Math.abs(C.x - R.x) < 20) return end(false);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}

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
  ctx.stage.innerHTML = `<svg class="mg-svg tall" viewBox="0 0 340 300"><rect width="340" height="300" rx="14" fill="#2b7d47"/><g id="mgWorld" style="transform:translateY(0px)">${mgField(ctx, 340, 300, 'mgC', yRef, A, { crowd: false })}
    ${yOfA(100) > 0 ? mgEndZone(ctx, 14, Math.max(-60, ezTop), 312, yOfA(100) - Math.max(-60, ezTop), 0.6) + mgEzGrass('mgCg', 14, Math.max(-60, ezTop), 312, yOfA(100) - Math.max(-60, ezTop)) + `<line x1="14" x2="326" y1="${yOfA(100)}" y2="${yOfA(100)}" stroke="#fff" stroke-width="3.4"/>${ezTop > 0 ? `<rect x="0" y="0" width="340" height="${ezTop}" fill="#f6f7f4"/>` : ''}${mgPylon(14, yOfA(100))}${mgPylon(326, yOfA(100))}` : ''}
    <line x1="14" x2="326" y1="${yRef}" y2="${yRef}" stroke="#4aa8ff" stroke-width="2.8" stroke-opacity=".9"/>${fdY != null && fdY > 24 ? `<line x1="14" x2="326" y1="${fdY}" y2="${fdY}" stroke="#ffd23d" stroke-width="2.8" stroke-opacity=".95"/>` : ''}</g>
    <path id="mgPath" d="M${B0.x} ${B0.y} L${L.x} ${L.y}" stroke="#fff" stroke-opacity=".85" stroke-width="2.6" stroke-dasharray="4 6" stroke-linecap="round" fill="none"/>
    <g id="mgLand" style="transform:translate(${L.x}px,${L.y}px)"><circle r="20" fill="${td ? '#ffd23d' : T2}" fill-opacity=".2" stroke="${td ? '#ffd23d' : '#c5ff3a'}" stroke-width="3" class="mg-landring"/><circle r="7" fill="none" stroke="#fff" stroke-opacity=".8" stroke-dasharray="2 3"/>${td ? '<text y="4" text-anchor="middle" font-size="11" font-weight="800" fill="#fff" font-family="Barlow Condensed, sans-serif" stroke="rgba(0,0,0,.6)" stroke-width="2.4" paint-order="stroke">TD</text>' : ''}</g>
    ${D ? mgGuy(0, 0, O1, O2, { s: 1.5, down: true, cls: 'mg-defn', attrs: 'id="mgDefn"' }) : ''}
    ${mgGuy(Q.x, Q.y, T1, T2, { s: 1.5 })}
    <g id="mgMe" style="transform:translate(${R.x}px,${R.y}px)">${mgGuy(0, 0, T1, T2, { s: 1.6, you: true })}<text y="-18" text-anchor="middle" font-size="9" font-weight="800" fill="#ffd23d" font-family="Barlow Condensed, sans-serif" letter-spacing=".12em" stroke="rgba(0,0,0,.6)" stroke-width="2.4" paint-order="stroke">YOU</text></g>
    <ellipse id="mgShadow" rx="7" ry="4" fill="#000" opacity=".35" cx="${B0.x}" cy="${B0.y}"/><g id="mgBallG">${mgBall(B0.x, B0.y, 1, 0, 'mgBallEl')}</g>
    <g id="mgHud"><rect x="60" y="6" width="220" height="28" rx="14" fill="rgba(5,8,16,.74)" stroke="rgba(255,255,255,.22)"/><text x="170" y="26" text-anchor="middle" font-size="18" font-weight="800" fill="#fff" font-family="Barlow Condensed, sans-serif" letter-spacing=".05em">${board}</text></g>
    <g id="mgFx"></g></svg><div class="mg-call">${te ? 'TE' : 'WR'} · <b>${route}</b> · ${lv + 1}/3</div>`;
  ctx.ctrl.innerHTML = `<div class="mg-timer"><i></i></div><div class="mg-btns four">${mgHoldBtn('l', '◀')}${mgHoldBtn('u', '▲')}${mgHoldBtn('d', '▼')}${mgHoldBtn('r', '▶')}</div>`;
  ctx.say(note ? `🚩 ${note}` : td ? 'Last play — <b>catch it in the end zone</b>' : 'Get to the <b>ring</b> before the ball does');
  return new Promise(async res => {
    await sleep(note ? 1200 : 700); if (!ctx.alive()) return res(false);
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
      me.style.transform = `translate(${R.x}px,${R.y}px)`;
      // the wind nudges the ball mid-air
      if (adj && !adjusted && u >= adj.ta) { adjusted = true; P1 = { x: B0.x + (L.x - B0.x) * adj.ta, y: B0.y + (L.y - B0.y) * adj.ta }; cur = { ...L2 }; mgPop(ctx, cur.x, cur.y - 30, '💨 WIND!', 'bad'); Snd.play('mgSwish', 0); }
      const bp = adjusted ? { x: P1.x + (cur.x - P1.x) * ((u - adj.ta) / (1 - adj.ta)), y: P1.y + (cur.y - P1.y) * ((u - adj.ta) / (1 - adj.ta)) } : { x: B0.x + (L.x - B0.x) * u, y: B0.y + (L.y - B0.y) * u };
      const h = Math.sin(Math.PI * u) * 22; ball.setAttribute('transform', `translate(${bp.x.toFixed(1)} ${(bp.y - h).toFixed(1)}) rotate(${(u * 720).toFixed(0)}) scale(${(1 + h / 70).toFixed(2)})`); shadow.setAttribute('cx', bp.x.toFixed(1)); shadow.setAttribute('cy', bp.y.toFixed(1)); shadow.setAttribute('rx', (7 - h / 14).toFixed(1));
      landG.style.transform = `translate(${cur.x}px,${cur.y}px)`; pathEl.setAttribute('d', adjusted ? `M${P1.x} ${P1.y} L${cur.x} ${cur.y}` : `M${B0.x} ${B0.y} L${L.x} ${L.y}`);
      // the defender races to the same spot
      if (Dp) { const dx = cur.x - Dp.x, dy = cur.y - Dp.y, dm = Math.hypot(dx, dy); if (dm > 12) { Dp.x += dx / dm * VD * dt; Dp.y += dy / dm * VD * dt; } dEl.style.transform = `translate(${Dp.x}px,${Dp.y}px)`; }
      if (u >= 1) return finish();
      raf = requestAnimationFrame(frame);
    };
    if (dEl) dEl.style.transform = `translate(${D.x}px,${D.y}px)`;
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
  const field = mgFieldInner({ id: 'mgKg', w: 340, sl, band, y0: yE, y1: 300, yRef: yG, Aref: 100, ppy: s, Amin: Math.max(0, 100 - (300 - yG) / s), Amax: 100, numL: sl + 11 * s, numR: 340 - sl - 11 * s, numOp: 0.9 });
  const rows = mgCrowd(0, 8, 340, 6, T1, O1);
  const weather = sc.wx === 'rain' ? Array.from({ length: 40 }, (_, k) => `<line x1="${(k * 19) % 340}" y1="${(k * 37) % 220 - 20}" x2="${(k * 19) % 340 - 6}" y2="${(k * 37) % 220 + 4}" stroke="#bcd7ff" stroke-opacity=".5" stroke-width="1.2" class="mg-rain" style="animation-delay:${((k * 0.07) % 0.6).toFixed(2)}s"/>`).join('')
    : sc.wx === 'snow' ? Array.from({ length: 34 }, (_, k) => `<circle cx="${(k * 29) % 340}" cy="${(k * 41) % 260}" r="${1.2 + (k % 3) * 0.7}" fill="#fff" opacity=".8" class="mg-snow" style="animation-delay:${((k * 0.13) % 2).toFixed(2)}s"/>`).join('') : '';
  const streaks = mph >= 6 && sc.wx !== 'dome' ? Array.from({ length: Math.min(8, Math.round(mph / 2)) }, (_, k) => `<line x1="${dir > 0 ? 0 : 340}" y1="${120 + k * 20}" x2="${dir > 0 ? 38 : 302}" y2="${120 + k * 20}" stroke="#fff" stroke-opacity=".22" stroke-width="1.4" stroke-linecap="round" class="mg-streak" style="--dx:${dir * 340}px;animation-duration:${(1.8 - Math.min(1, mph / 22)).toFixed(2)}s;animation-delay:${(k * 0.25).toFixed(2)}s"/>`).join('') : '';
  const sideDots = Array.from({ length: 7 }, (_, k) => `<circle cx="${sl - band - 5 - (k % 2) * 4}" cy="${yG + 30 + k * 9}" r="2.2" fill="${k % 2 ? T1 : T2}" opacity=".8"/><circle cx="${340 - sl + band + 5 + (k % 2) * 4}" cy="${yG + 30 + k * 9}" r="2.2" fill="${k % 2 ? O1 : O2}" opacity=".8"/>`).join('');
  const los = yB - 7 * s, line = (n, y, f, t, down) => Array.from({ length: n }, (_, k) => mgGuy(170 + (k - (n - 1) / 2) * Math.max(8, s * 1.9), y, f, t, { s: 0.62, down })).join('');
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
    ${mgGuy(bx - 15, yB + 12, T1, T2, { s: 1.15, you: true })}${mgGuy(bx + 13, yB + 3, T1, T2, { s: 0.95 })}<ellipse id="mgSh" rx="6" ry="3" fill="#000" opacity=".38" cx="${bx}" cy="${yB}"/><g id="mgBallG">${mgBall(bx, yB - 1, 0.5, 90, 'mgBallEl')}</g><g id="mgFx"></g></svg><div class="mg-call">${sc.name} · ${MG_LV.indexOf(i) + 1}/3</div>`;
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

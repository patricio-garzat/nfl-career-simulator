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
  rb: P => ({ icon: '🏃', title: 'BREAK AWAY', how: 'Dodge the defenders and outrun the tackler.', legend: [['⌨️', '← → keys', 'dodge'], ['🏃', 'Tackler behind you', 'don\'t stumble']] }),
  catch: P => ({ icon: '🙌', title: P.pos === 'TE' ? 'CATCH IT · SEAM' : 'CATCH IT · GO ROUTE', how: 'Run to where the ball will land.', legend: [['⌨️', 'Arrow keys / drag', 'move'], ['⭕', 'Ring', 'be there first']] }),
  kick: P => ({ icon: '🥅', title: 'KICK IT', how: 'Aim into the wind, stop the bar in the green.', legend: [['💨', 'Wind pushes', 'AIM AGAINST'], ['⏹', 'Power', 'GREEN']] }),
};
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
// top-down field with your logo at midfield
function mgTopField(ctx, w = 340, h = 260, id = 'mgG') {
  const t = ctx.t, o = ctx.o;
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d6c3d"/><stop offset="1" stop-color="#12502b"/></linearGradient></defs>
    <rect width="${w}" height="${h}" rx="14" fill="url(#${id})"/>${[0, 1, 2, 3, 4, 5].map(i => `<rect x="0" y="${i * 44 + 10}" width="${w}" height="22" fill="#fff" opacity=".035"/>`).join('')}
    ${[40, 90, 140, 190, 240].map(y => `<line x1="0" x2="${w}" y1="${y}" y2="${y}" stroke="#fff" stroke-opacity=".16" stroke-width="2"/>`).join('')}
    <image href="${t.logo}" x="${w / 2 - 58}" y="${h / 2 - 20}" width="116" height="116" opacity=".1" preserveAspectRatio="xMidYMid meet"/>
    <image href="${o.logo}" x="${w / 2 - 36}" y="8" width="72" height="72" opacity=".08" preserveAspectRatio="xMidYMid meet"/>
    <rect width="${w}" height="16" rx="8" fill="#050810" opacity=".75"/><rect y="${h - 14}" width="${w}" height="14" rx="7" fill="#050810" opacity=".75"/>
    <g class="mg-crowd">${mgCrowd(0, 4, w, 2, t.c1, o.c1)}</g><g class="mg-crowd">${mgCrowd(0, h - 11, w, 2, t.c1, t.c2)}</g>`;
}

/* ---------- overlay + runner ---------- */
// the NFL season's environment; the college season (college.js) passes its own: { se, P, t, o, number, theme, save, onDone, jersey }
function mgEnvNFL() {
  const se = curSeason(); if (!se || !se.mg || !MG_META[se.mg.kind]) return null;
  let opp; try { opp = nextGameInfo(se).opp; } catch (e) { opp = null; } opp = opp || TEAM_LIST.find(x => x.id !== S.teamId);
  const P = S.player, tid = S.teamId;
  return { se, P, t: { ...TEAM[tid], logo: logoUrl(tid) }, o: { ...opp, logo: logoUrl(opp.id) }, number: playerNumber(), theme: themeVars(tid), save: true, onDone: () => renderDashboard(),
    jersey: view => jerseySVG(jerseyFor(tid), jName(P), playerNumber(), { view, teamId: tid, word: TEAM[tid].nick }) };
}
let MGX = null;
function mgOpen(env) {
  env = env || mgEnvNFL(); if (!env) return;
  const se = env.se; if (!se.mg || !MG_META[se.mg.kind]) return;
  const P = env.P, kind = se.mg.kind, t = env.t, opp = env.o, meta = MG_META[kind](P);
  const ov = document.createElement('div'); ov.className = 'mg-overlay'; ov.style.cssText = env.theme;
  ov.innerHTML = `<div class="mg-wrap">
    <div class="mg-top"><span class="mg-tag">🎮 PRESEASON CAMP</span><button class="mini mg-skip" data-mg="skip">SKIP</button></div>
    <div class="mg-board"><img src="${t.logo}" alt=""><div class="mg-bt"><b>${esc(meta.title)}</b><span>${esc(P.name)} · ${P.pos} · #${env.number}</span></div><img src="${opp.logo}" alt=""></div>
    <div class="mg-pips">${[0, 1, 2].map(i => `<span data-p="${i}">${mgFootball()}</span>`).join('')}<em id="mgScore">0/3</em><b class="mg-combo" id="mgCombo" hidden></b></div>
    <div class="mg-stage" id="mgStage"></div><div class="mg-msg" id="mgMsg"></div><div class="mg-ctrl" id="mgCtrl"></div></div>`;
  document.body.appendChild(ov);
  const stage = ov.querySelector('#mgStage'), msg = ov.querySelector('#mgMsg'), ctrl = ov.querySelector('#mgCtrl');
  const ctx = { env, number: env.number, ov, stage, msg, ctrl, t, o: opp, P, kind, alive: () => ov.isConnected, say: (h, cls = '') => { msg.className = 'mg-msg ' + cls; msg.innerHTML = h; }, results: [], perfects: 0, combo: 0 };
  MGX = ctx;
  stage.innerHTML = `<div class="mg-intro" style="background-image:radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, ${t.c1} 40%, transparent), transparent)">
    <div class="mg-jersey-big">${env.jersey ? env.jersey('front') : ''}</div><div class="mg-bigicon">${meta.icon}</div><h2>${esc(meta.title)}</h2><p>${esc(meta.how)}</p>
    <div class="mg-legend">${meta.legend.map(([i, a, b]) => `<span>${i} ${a}${b ? ` <b>→ ${b}</b>` : ''}</span>`).join('')}</div><p class="mg-sub">3 levels · your grade sets the whole season</p></div>`;
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
  const fx = `${perf > 0 ? '+' : '−'}${Math.abs(Math.round(perf * 100))}% performance all season · moves your rating`;
  ctx.stage.innerHTML = `<div class="mg-res ${good ? 'good' : 'bad'}" style="background-image:radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, ${ctx.t.c1} 38%, transparent), transparent)">
    <div class="mg-jersey-big small">${ctx.env.jersey ? ctx.env.jersey('back') : ''}</div>
    <div class="mg-grade">${g.n}</div><div class="mg-big">${raw}<small>/3</small></div>
    <div class="mg-stars">${[0, 1, 2].map(i => `<span class="${i < raw ? 'on' : ''}">★</span>`).join('')}</div>
    ${ctx.perfects ? `<div class="mg-perf">✨ ${ctx.perfects} perfect play${ctx.perfects > 1 ? 's' : ''}</div>` : ''}
    <div class="mg-bonus ${good ? 'good' : 'bad'}">${good ? '⚡' : '⚠️'} ${fx}</div></div>`;
  ctx.say(''); ctx.ctrl.innerHTML = `<button class="btn btn-primary btn-xl" data-mg="done">CONTINUE</button>`;
  se.buffs.push({ left: 99, perf, label: 'Camp ' + g.n.toLowerCase() });
  if (sc >= 4) se.train.ment = Math.min(1.5, (se.train.ment || 0) + 0.25);
  se.mgLog.push({ kind: ctx.kind, score: sc, wk: se.mg ? se.mg.wk : 0 }); se.mg = null; se.mgSince = 0; se.mgIn = randInt(3, 5);
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
  ctx.stage.innerHTML = `<svg class="mg-svg" viewBox="0 0 340 250">${mgTopField(ctx)}<defs>${marker('#ffd23d')}${marker('#c5ff3a')}</defs>
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
   RB — BREAK AWAY
   Top-down. You carry the ball up the field; defenders are scattered ahead, a tackler chases you. Dodge left/right and reach the line before he catches you.
   Hitting a defender makes you stumble (you slow down and the chaser gains). Later runs are longer, with defenders that slide and that track you.
   ===================================================================== */
function mgRB(ctx, i, st) {
  const T1 = ctx.t.c1, T2 = ctx.t.c2, O1 = ctx.o.c1, O2 = ctx.o.c2, yds = [24, 28, 32, 36, 40][i], GOAL = yds * 10, RY = 205, XMIN = 26, XMAX = 314;
  const vf = 62, vc = vf * (1 + 0.02 * i), LAT = 190;
  // defenders ahead, in rows
  const defs = []; let w = 92 + rr(0, 16);
  while (w < GOAL - 24) {
    w += 28 + rnd() * 14; const n = 1 + (rnd() < 0.42 + i * 0.1 ? 1 : 0) + (i >= 2 && rnd() < 0.22 ? 1 : 0), xs = [];
    for (let k = 0; k < n; k++) { let x, tries = 0; do { x = rr(XMIN + 8, XMAX - 8); tries++; } while (xs.some(q => Math.abs(q - x) < 64) && tries < 20); xs.push(x); defs.push({ w, x, bx: x, type: i >= 1 && rnd() < 0.28 + 0.08 * i ? 'slide' : (i >= 2 && rnd() < 0.22 ? 'track' : 'stand'), ph: rnd() * 6.28, hit: false }); }
  }
  // real yard lines: every 5 yards (numbers every 10, counting down to the goal line). You start on the opponent's (yds)-yard line.
  const start = 100 - yds, yardNum = A => (A <= 50 ? A : 100 - A), absLines = [];
  for (let A = Math.ceil(start / 5) * 5; A <= 100; A += 5) absLines.push(A);
  const numTxt = (x, y, rot, v) => `<text transform="translate(${x} ${y}) rotate(${rot})" text-anchor="middle" fill="#fff" fill-opacity=".42" font-size="24" font-weight="800" font-family="Barlow Condensed, sans-serif" letter-spacing=".08em">${v}</text>`;
  const lineSVG = absLines.map(A => { const wv = (A - start) * 10, major = A % 10 === 0 && A < 100; return `<line x1="0" x2="340" y1="${-wv}" y2="${-wv}" stroke="#fff" stroke-opacity="${wv === 0 ? 0 : major ? 0.4 : 0.2}" stroke-width="${major ? 2.6 : 1.6}"/>${major ? numTxt(44, -wv + 8, -90, yardNum(A)) + numTxt(296, -wv - 8, 90, yardNum(A)) : ''}`; }).join('')
    + Array.from({ length: Math.floor(GOAL / 10) }, (_, k) => { const wv = (k + 1) * 10; return `<g stroke="#fff" stroke-opacity=".22" stroke-width="1.2"><line x1="150" x2="150" y1="${-wv}" y2="${-wv - 4}"/><line x1="190" x2="190" y1="${-wv}" y2="${-wv - 4}"/><line x1="6" x2="14" y1="${-wv}" y2="${-wv}"/><line x1="326" x2="334" y1="${-wv}" y2="${-wv}"/></g>`; }).join('');
  // mowing stripes every 10 yards (they also run across the end zone paint, so the paint looks like it is ON the grass)
  const stripes = Array.from({ length: Math.floor(yds / 10) + 5 }, (_, k) => { const A0 = Math.floor(start / 10) * 10 + k * 10; return (A0 / 10) % 2 ? `<rect x="0" y="${-(A0 + 10 - start) * 10}" width="340" height="100" fill="#fff" opacity=".045"/>` : ''; }).join('');
  const dsvg = defs.map((d, k) => mgGuy(0, 0, O1, O2, { s: 1.45, down: true, cls: 'mg-rbd', attrs: `data-k="${k}"` })).join('');
  ctx.stage.innerHTML = `<svg class="mg-svg tall" viewBox="0 0 340 300"><defs><linearGradient id="mgRG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d6c3d"/><stop offset="1" stop-color="#12502b"/></linearGradient>${mgLights('mgRL', T1)}</defs>
    <rect width="340" height="300" rx="14" fill="url(#mgRG)"/>
    <g id="mgRW" style="transform:translate(0px,${RY}px)">
      <clipPath id="mgRbClip"><rect x="0" y="${-GOAL - 120}" width="340" height="120"/></clipPath>
      <rect x="0" y="${-GOAL - 120}" width="340" height="120" fill="${O1}"/><rect x="0" y="${-GOAL - 120}" width="340" height="120" fill="url(#mgStripe)" opacity=".2"/>
      <g clip-path="url(#mgRbClip)" opacity=".92"><image href="${ctx.o.logo}" x="125" y="${-GOAL - 100}" width="90" height="80" preserveAspectRatio="xMidYMid meet"/></g>
      ${stripes}${lineSVG}<line x1="0" x2="340" y1="0" y2="0" stroke="#4aa8ff" stroke-width="3" stroke-opacity=".85"/><line x1="0" x2="340" y1="${-GOAL}" y2="${-GOAL}" stroke="#fff" stroke-width="5"/>
      <line x1="2" x2="2" y1="${-GOAL - 120}" y2="0" stroke="#fff" stroke-opacity=".7" stroke-width="3"/><line x1="338" x2="338" y1="${-GOAL - 120}" y2="0" stroke="#fff" stroke-opacity=".7" stroke-width="3"/>${dsvg}</g>
    <defs><pattern id="mgStripe" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="14" fill="#fff"/></pattern></defs>
    <g id="mgChaser" class="mg-chaser"><circle r="17" fill="rgba(255,60,60,.16)" class="mg-you" style="stroke:#ff5d5d;stroke-width:2"/>${mgGuy(0, 0, O1, O2, { s: 1.6 })}</g>
    <g id="mgMe">${mgGuy(0, 0, T1, T2, { s: 1.6, you: true })}${mgBall(0, -2, 0.6, 90)}</g>
    <g id="mgHud"><rect x="104" y="20" width="132" height="30" rx="15" fill="rgba(5,8,16,.7)" stroke="rgba(255,255,255,.2)"/><text id="mgYd" x="170" y="41" text-anchor="middle" font-size="20" font-weight="800" fill="#fff" font-family="Barlow Condensed, sans-serif">0 / ${yds} YDS</text>
      <rect x="10" y="60" width="10" height="130" rx="5" fill="rgba(255,255,255,.12)"/><rect id="mgGap" x="10" y="190" width="10" height="130" rx="5" fill="#6dffbb" style="transform-origin:15px 190px;transform:scaleY(-1)"/><text x="15" y="204" text-anchor="middle" font-size="8" fill="#fff" fill-opacity=".7" font-family="Barlow Condensed, sans-serif" letter-spacing=".1em">GAP</text></g>
    <g id="mgFx"></g></svg><div class="mg-call">BREAK AWAY · ${yds} yds · ${MG_LV.indexOf(i) + 1}/3</div>`;
  ctx.ctrl.innerHTML = `<div class="mg-btns two">${mgHoldBtn('l', '◀ LEFT')}${mgHoldBtn('r', 'RIGHT ▶')}</div>`;
  ctx.say('<b>← →</b> dodge the defenders · outrun the tackler');
  return new Promise(async res => {
    await sleep(500); if (!ctx.alive()) return res(false);
    const inp = mgInput(ctx);
    const R = { x: 170, w: 0, stun: 0 }, C = { x: 170, w: -(78 - 3 * i) }, els = [...ctx.stage.querySelectorAll('.mg-rbd')], world = ctx.stage.querySelector('#mgRW'), me = ctx.stage.querySelector('#mgMe'), ch = ctx.stage.querySelector('#mgChaser'), ydT = ctx.stage.querySelector('#mgYd'), gapB = ctx.stage.querySelector('#mgGap');
    let last = performance.now(), t = 0, ended = false, stumbles = 0, raf = 0, lean = 0;
    ctx.say('<b>GO!</b>', 'go'); Snd.play('mgSnap', 0);
    const end = async (win) => {
      if (ended) return; ended = true; cancelAnimationFrame(raf); inp.dispose(); ctx.ctrl.innerHTML = '';
      const got = Math.max(0, Math.min(yds, Math.round(R.w / 10)));
      if (win) {
        const perfect = stumbles === 0; if (perfect) ctx.perfects++;
        mgPop(ctx, 170, 100, perfect ? 'CLEAN RUN!' : 'FIRST DOWN!', 'good'); Snd.play('td', 0.05); mgShake(ctx);
        ctx.say(`✅ ${perfect ? '✨ Untouched! ' : 'Made it! '}${mgYardsStr(yds)}${stumbles ? ` · ${stumbles} stumble${stumbles > 1 ? 's' : ''}` : ''}`, 'good'); res(true);
      } else {
        mgPop(ctx, 170, 120, 'TACKLED!', 'bad'); Snd.play('mgHit', 0); mgShake(ctx);
        ctx.say(`❌ Tackled after ${mgYardsStr(got)}<span class="mg-tip">Dodge the defenders — every hit lets the tackler catch up.</span>`, 'bad'); res(false);
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
      ydT.textContent = `${Math.min(yds, Math.max(0, Math.floor(R.w / 10)))} / ${yds} YDS`;
      if (R.w >= GOAL) return end(true);
      if (C.w >= R.w - 14 && Math.abs(C.x - R.x) < 20) return end(false);
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
  const P = ctx.P, T1 = ctx.t.c1, T2 = ctx.t.c2, O1 = ctx.o.c1, O2 = ctx.o.c2, te = P.pos === 'TE';
  const T = [2.5, 2.3, 2.1, 1.95, 1.8][i], VR = 122, Q = { x: 170, y: 266 }, dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const R = { x: 170 + rr(-70, 70), y: rr(176, 208) };
  let L; do { L = { x: rr(46, 294), y: rr(50, 160) }; } while (dist(R, L) > VR * T * 0.74 || dist(R, L) < 78);
  const adj = i >= 2 ? { ta: 0.42, dx: rr(-40, 40), dy: rr(-28, 28) } : null;
  const L2 = adj ? { x: clamp(L.x + adj.dx, 30, 310), y: clamp(L.y + adj.dy, 44, 190) } : L;
  if (adj && dist(R, L2) > VR * T * 0.86) { L2.x = (L2.x + L.x) / 2; L2.y = (L2.y + L.y) / 2; }
  const D = i >= 1 ? { x: pick([30, 310]), y: rr(48, 130) } : null, VD = 64 + 9 * i;
  const route = (te ? ['SEAM', 'DRAG', 'CORNER', 'OVER', 'POST'] : ['GO', 'POST', 'FADE', 'OUT', 'DEEP'])[i];
  ctx.stage.innerHTML = `<svg class="mg-svg tall" viewBox="0 0 340 300">${mgTopField(ctx, 340, 300, 'mgCG')}
    <line x1="0" x2="340" y1="230" y2="230" stroke="#4aa8ff" stroke-width="2.5" stroke-opacity=".6"/>
    <path id="mgPath" d="M${Q.x} ${Q.y} L${L.x} ${L.y}" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-dasharray="3 6" fill="none"/>
    <g id="mgLand" style="transform:translate(${L.x}px,${L.y}px)"><circle r="20" fill="${T2}" fill-opacity=".15" stroke="#c5ff3a" stroke-width="3" class="mg-landring"/><circle r="7" fill="none" stroke="#fff" stroke-opacity=".8" stroke-dasharray="2 3"/></g>
    ${D ? mgGuy(0, 0, O1, O2, { s: 1.5, down: true, cls: 'mg-defn', attrs: 'id="mgDefn"' }) : ''}
    ${mgGuy(Q.x, Q.y, T1, T2, { s: 1.5 })}
    <g id="mgMe" style="transform:translate(${R.x}px,${R.y}px)">${mgGuy(0, 0, T1, T2, { s: 1.6, you: true })}<text y="-18" text-anchor="middle" font-size="9" font-weight="800" fill="#ffd23d" font-family="Barlow Condensed, sans-serif" letter-spacing=".12em" stroke="rgba(0,0,0,.6)" stroke-width="2.4" paint-order="stroke">YOU</text></g>
    <ellipse id="mgShadow" rx="7" ry="4" fill="#000" opacity=".35" cx="${Q.x}" cy="${Q.y}"/><g id="mgBallG">${mgBall(Q.x, Q.y, 1, 0, 'mgBallEl')}</g><g id="mgFx"></g></svg><div class="mg-call">${te ? 'TE' : 'WR'} · <b>${route}</b> · ${MG_LV.indexOf(i) + 1}/3</div>`;
  ctx.ctrl.innerHTML = `<div class="mg-timer"><i></i></div><div class="mg-btns four">${mgHoldBtn('l', '◀')}${mgHoldBtn('u', '▲')}${mgHoldBtn('d', '▼')}${mgHoldBtn('r', '▶')}</div>`;
  ctx.say('Get to the <b>ring</b> before the ball does');
  return new Promise(async res => {
    await sleep(600); if (!ctx.alive()) return res(false);
    const inp = mgInput(ctx);
    const bar = ctx.ctrl.querySelector('.mg-timer i'); if (bar) { bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth; bar.style.transition = `width ${T}s linear`; bar.style.width = '0%'; }
    ctx.say('<b>BALL IS UP!</b> Run to the ring', 'go'); Snd.play('mgThrow', 0.02);
    const me = ctx.stage.querySelector('#mgMe'), landG = ctx.stage.querySelector('#mgLand'), pathEl = ctx.stage.querySelector('#mgPath'), ball = ctx.stage.querySelector('#mgBallEl'), shadow = ctx.stage.querySelector('#mgShadow'), dEl = ctx.stage.querySelector('#mgDefn');
    let cur = { ...L }, Dp = D ? { ...D } : null, t0 = performance.now(), last = t0, raf = 0, ended = false, adjusted = false, P1 = null;
    const finish = async () => {
      ended = true; cancelAnimationFrame(raf); inp.dispose(); ctx.ctrl.innerHTML = '';
      const dR = dist(R, cur), dD = Dp ? dist(Dp, cur) : 99;
      const fx = ctx.stage.querySelector('#mgFx');
      const ok = dR <= 20 && (!Dp || dR <= dD + 5 || dD > 22), perfect = ok && dR <= 8;
      ball.setAttribute('transform', `translate(${ok ? R.x : cur.x} ${ok ? R.y - 2 : cur.y}) rotate(20) scale(1)`); shadow.setAttribute('opacity', 0);
      if (ok) {
        if (perfect) ctx.perfects++; const y = te ? randInt(10, 24) : randInt(18, 44);
        mgPop(ctx, R.x, R.y - 26, perfect ? 'PERFECT!' : 'CAUGHT!', 'good'); Snd.play('mgPat', 0); mgShake(ctx); if (y >= 25) Snd.play('td', 0.2);
        ctx.say(`✅ ${perfect ? '✨ Dead center! ' : 'Caught it! '}${mgYardsStr(y)}`, 'good'); res(true);
      } else {
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
      if (adj && !adjusted && u >= adj.ta) { adjusted = true; P1 = { x: Q.x + (L.x - Q.x) * adj.ta, y: Q.y + (L.y - Q.y) * adj.ta }; cur = { ...L2 }; mgPop(ctx, cur.x, cur.y - 30, '💨 WIND!', 'bad'); Snd.play('mgSwish', 0); }
      const bp = adjusted ? { x: P1.x + (cur.x - P1.x) * ((u - adj.ta) / (1 - adj.ta)), y: P1.y + (cur.y - P1.y) * ((u - adj.ta) / (1 - adj.ta)) } : { x: Q.x + (L.x - Q.x) * u, y: Q.y + (L.y - Q.y) * u };
      const h = Math.sin(Math.PI * u) * 34; ball.setAttribute('transform', `translate(${bp.x.toFixed(1)} ${(bp.y - h).toFixed(1)}) rotate(${(u * 720).toFixed(0)}) scale(${(1 + h / 60).toFixed(2)})`); shadow.setAttribute('cx', bp.x.toFixed(1)); shadow.setAttribute('cy', bp.y.toFixed(1)); shadow.setAttribute('rx', (7 - h / 14).toFixed(1));
      landG.style.transform = `translate(${cur.x}px,${cur.y}px)`; pathEl.setAttribute('d', adjusted ? `M${P1.x} ${P1.y} L${cur.x} ${cur.y}` : `M${Q.x} ${Q.y} L${L.x} ${L.y}`);
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
// ball animation through a list of timed points
function mgFly(ctx, ball, pts, dur, spin = 540) {
  return new Promise(r => { const f0 = performance.now(); const step = () => {
    if (!ctx.alive()) return r(); const k = Math.min(1, (performance.now() - f0) / dur); let a = pts[0], b = pts[pts.length - 1];
    for (let j = 0; j < pts.length - 1; j++) if (k >= pts[j].t && k <= pts[j + 1].t) { a = pts[j]; b = pts[j + 1]; break; }
    const u = b.t === a.t ? 1 : (k - a.t) / (b.t - a.t), x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u, s = a.s + (b.s - a.s) * u;
    ball.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(k * spin).toFixed(0)}) scale(${s.toFixed(2)})`); ball.style.opacity = b.o !== undefined ? (a.o !== undefined ? a.o + (b.o - a.o) * u : b.o) : 1;
    if (k < 1) requestAnimationFrame(step); else r(); }; step(); });
}
function mgKick(ctx, i, st) {
  if (!st.plan) st.plan = shuffle(Object.keys(KICK_SCN)).slice(0, 5).sort((a, b) => KICK_SCN[a].dist - KICK_SCN[b].dist);
  const sc = KICK_SCN[st.plan[i]], dist = sc.dist, mph = randInt(sc.mph[0], sc.mph[1]), dir = rnd() < 0.5 ? -1 : 1, T1 = ctx.t.c1, T2 = ctx.t.c2, O1 = ctx.o.c1, O2 = ctx.o.c2;
  const drift = dir * mph * (dist / 40) * 0.07, size = clamp(1.25 - (dist - 28) * 0.018, 0.7, 1.2), hw = 34 * size, pT = clamp(0.5 + (dist - 28) / 24 * 0.35 + (sc.wx === 'rain' ? 0.03 : 0), 0.45, 0.9);
  const barY = 122, postTop = barY - 74 * size, baseY = 152, flagA = dir * Math.min(35, mph * 2.2), bx = 170 + (sc.hash || 0) * 34;
  let aim = 0;
  // ---- scene ----
  const half = y => 70 + (y - 176), yAt = d => 176 + 92 * Math.pow(1 - d / dist, 1.5);
  const line = d => { const y = yAt(d), h = half(y); return { y, x1: 170 - h, x2: 170 + h }; };
  const yl = []; for (let v = 5; v < dist; v += 5) yl.push(dist - v);      // yard lines every 5 yards counted from the goal line
  const bands = []; const marks = [0, ...yl.slice().reverse().reverse().sort((p, q) => p - q), dist]; for (let k = 0; k < marks.length - 1; k++) { const a = line(marks[k]), b = line(marks[k + 1]); if (k % 2) bands.push(`<polygon points="${a.x1},${a.y} ${a.x2},${a.y} ${b.x2},${b.y} ${b.x1},${b.y}" fill="#fff" opacity=".055"/>`); }
  const num = (x, y, v, side) => { const f = 0.55 + (y - 176) / 400; return `<text transform="translate(${x} ${y}) scale(1 ${(0.5).toFixed(2)}) skewX(${side * -16})" font-size="${(9 + (y - 176) / 7).toFixed(1)}" fill="#fff" fill-opacity="${(0.55 + f * 0.2).toFixed(2)}" font-weight="800" font-family="Barlow Condensed, sans-serif" text-anchor="middle" letter-spacing=".04em">${v}</text>`; };
  const yardSVG = yl.map(d => { const l = line(d), val = Math.round(dist - d); return `<line x1="${l.x1}" x2="${l.x2}" y1="${l.y}" y2="${l.y}" stroke="#fff" stroke-opacity=".38" stroke-width="${(1 + (l.y - 176) / 90).toFixed(2)}"/>${val % 10 === 0 ? num(l.x1 + 26 + (l.y - 176) * 0.18, l.y + 6 + (l.y - 176) / 14, val, -1) + num(l.x2 - 26 - (l.y - 176) * 0.18, l.y + 6 + (l.y - 176) / 14, val, 1) : ''}`; }).join('');
  const hashes = yl.concat([0]).map(d => { const l = line(d || 2.5), y = l.y; return d % 5 === 0 && d ? '' : `<line x1="${170 - 20}" x2="${170 - 20}" y1="${y}" y2="${y + 3}" stroke="#fff" stroke-opacity=".3"/><line x1="${170 + 20}" x2="${170 + 20}" y1="${y}" y2="${y + 3}" stroke="#fff" stroke-opacity=".3"/>`; }).join('');
  const sky = sc.wx === 'dome' ? ['#10142b', '#1a2040'] : sc.wx === 'snow' ? ['#2b3a55', '#5b6f94'] : sc.wx === 'rain' ? ['#0a1124', '#2a3a5c'] : ['#070d24', '#22407a'];
  const ads = [[ctx.o.nick, O1], ['NFL CAREER', '#12182b'], [ctx.t.nick, T1], ['NFL CAREER', '#12182b']].map(([n, c], k) => ` <rect x="${k * 85}" y="139" width="85" height="11" fill="${c}"/><text x="${k * 85 + 42.5}" y="147.5" text-anchor="middle" font-size="7.5" font-weight="800" fill="${textOn(c)}" font-family="Barlow Condensed, sans-serif" letter-spacing=".16em">${esc(String(n).toUpperCase())}</text>`).join('');
  const weather = sc.wx === 'rain' ? Array.from({ length: 40 }, (_, k) => `<line x1="${(k * 19) % 340}" y1="${(k * 37) % 220 - 20}" x2="${(k * 19) % 340 - 6}" y2="${(k * 37) % 220 + 4}" stroke="#bcd7ff" stroke-opacity=".5" stroke-width="1.2" class="mg-rain" style="animation-delay:${((k * 0.07) % 0.6).toFixed(2)}s"/>`).join('')
    : sc.wx === 'snow' ? Array.from({ length: 34 }, (_, k) => `<circle cx="${(k * 29) % 340}" cy="${(k * 41) % 260}" r="${1.2 + (k % 3) * 0.7}" fill="#fff" opacity=".8" class="mg-snow" style="animation-delay:${((k * 0.13) % 2).toFixed(2)}s"/>`).join('') : '';
  const streaks = mph >= 6 && sc.wx !== 'dome' ? Array.from({ length: Math.min(8, Math.round(mph / 2)) }, (_, k) => `<line x1="${dir > 0 ? 0 : 340}" y1="${190 + k * 12}" x2="${dir > 0 ? 38 : 302}" y2="${190 + k * 12}" stroke="#fff" stroke-opacity=".22" stroke-width="1.4" stroke-linecap="round" class="mg-streak" style="--dx:${dir * 340}px;animation-duration:${(1.8 - Math.min(1, mph / 22)).toFixed(2)}s;animation-delay:${(k * 0.25).toFixed(2)}s"/>`).join('') : '';
  const sideline = Array.from({ length: 9 }, (_, k) => `<circle cx="${-2 + k * 4}" cy="${250 + (k % 3) * 5}" r="2.4" fill="${k % 2 ? T1 : T2}" opacity=".8"/><circle cx="${342 - k * 4}" cy="${250 + (k % 3) * 5}" r="2.4" fill="${k % 2 ? O1 : O2}" opacity=".8"/>`).join('');
  const lamp = (x) => `<g><line x1="${x}" y1="152" x2="${x}" y2="26" stroke="#2a3350" stroke-width="3"/><rect x="${x - 13}" y="14" width="26" height="14" rx="3" fill="#cfd8f5"/>${[0, 1, 2, 3, 4, 5].map(k => `<circle cx="${x - 9 + (k % 3) * 9}" cy="${18 + Math.floor(k / 3) * 7}" r="2.2" fill="#fff"/>`).join('')}<circle cx="${x}" cy="22" r="40" fill="url(#mgKL)" class="mg-flare"/></g>`;
  ctx.stage.innerHTML = `<svg class="mg-svg tall" viewBox="0 0 340 300"><defs><linearGradient id="mgSky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient><linearGradient id="mgGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sc.wx === 'snow' ? '#9fb9b0' : '#1f7440'}"/><stop offset="1" stop-color="${sc.wx === 'snow' ? '#c9ddd6' : '#12532c'}"/></linearGradient>${mgLights('mgKL', T1)}<linearGradient id="mgStands" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0f20"/><stop offset="1" stop-color="#1a2342"/></linearGradient>
      <pattern id="mgEzP" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><rect width="5" height="10" fill="#fff" opacity=".12"/></pattern></defs>
    <rect width="340" height="300" rx="14" fill="url(#mgSky2)"/>
    <rect x="0" y="40" width="340" height="100" fill="url(#mgStands)"/><g class="mg-crowd">${mgCrowd(0, 49, 340, 12, T1, O1)}</g><rect x="0" y="40" width="340" height="100" fill="url(#mgStands)" opacity=".28"/>
    ${sc.wx === 'dome' ? '<rect x="0" y="0" width="340" height="40" fill="#0b0f22"/>' : lamp(24) + lamp(316)}
    <g stroke="#fff" stroke-opacity=".1" stroke-width=".8">${Array.from({ length: 9 }, (_, k) => `<line x1="${120 + k * 12.5}" y1="92" x2="${120 + k * 12.5}" y2="139"/>`).join('')}${Array.from({ length: 6 }, (_, k) => `<line x1="120" y1="${92 + k * 11}" x2="220" y2="${92 + k * 11}"/>`).join('')}</g>
    ${ads}
    <polygon points="${170 - half(150)},150 ${170 + half(150)},150 ${170 + half(300)},300 ${170 - half(300)},300" fill="url(#mgGrass)"/>${bands.join('')}
    <clipPath id="mgEzClip"><polygon points="${170 - half(150)},150 ${170 + half(150)},150 ${170 + half(176)},176 ${170 - half(176)},176"/></clipPath>
    <polygon points="${170 - half(150)},150 ${170 + half(150)},150 ${170 + half(176)},176 ${170 - half(176)},176" fill="${O1}"/><polygon points="${170 - half(150)},150 ${170 + half(150)},150 ${170 + half(176)},176 ${170 - half(176)},176" fill="url(#mgEzP)"/>
    <g clip-path="url(#mgEzClip)" opacity=".92">
      <g transform="translate(${170 - 46} 163) scale(1 .5)"><image href="${ctx.o.logo}" x="-17" y="-17" width="34" height="34" preserveAspectRatio="xMidYMid meet"/></g>
      <g transform="translate(${170 + 46} 163) scale(1 .5)"><image href="${ctx.o.logo}" x="-17" y="-17" width="34" height="34" preserveAspectRatio="xMidYMid meet"/></g>
      <g transform="translate(170 163) scale(1 .5)"><image href="${ctx.o.logo}" x="-22" y="-22" width="44" height="44" preserveAspectRatio="xMidYMid meet"/></g>
    </g>
    <line x1="${170 - half(176)}" x2="${170 + half(176)}" y1="176" y2="176" stroke="#fff" stroke-width="3"/><line x1="${170 - half(150)}" x2="${170 + half(150)}" y1="150" y2="150" stroke="#fff" stroke-width="2" stroke-opacity=".85"/>
     <polyline points="${170 - half(150)},150 ${170 - half(300)},300" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="2.5"/><polyline points="${170 + half(150)},150 ${170 + half(300)},300" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="2.5"/>
    ${yardSVG}${hashes}${sideline}
    <rect x="${170 - 9}" y="${baseY - 3}" width="18" height="6" rx="2" fill="#e6a900" stroke="#7a5a00"/>
    <g stroke="#ffd23d" stroke-linecap="round" fill="none"><line x1="170" x2="170" y1="${baseY}" y2="${barY}" stroke-width="${3.6 * size}"/><line x1="${170 - hw}" x2="${170 + hw}" y1="${barY}" y2="${barY}" stroke-width="${4.4 * size}"/><line id="mgUL" class="mg-upr" x1="${170 - hw}" x2="${170 - hw}" y1="${barY}" y2="${postTop}" stroke-width="${4.4 * size}"/><line id="mgUR" class="mg-upr" x1="${170 + hw}" x2="${170 + hw}" y1="${barY}" y2="${postTop}" stroke-width="${4.4 * size}"/></g>
    <g opacity=".95"><line x1="170" y1="${barY - 22 * size}" x2="${170 + drift * hw}" y2="${barY - 22 * size}" stroke="#35e0ff" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 7"/>${mph ? `<path d="M${170 + drift * hw} ${barY - 22 * size} l${-dir * 9} -6 v12z" fill="#35e0ff"/>` : ''}<text x="170" y="${barY - 30 * size}" text-anchor="middle" font-size="10" fill="#35e0ff" font-family="Barlow Condensed, sans-serif" letter-spacing=".1em" stroke="rgba(0,0,0,.5)" stroke-width="2" paint-order="stroke">${mph ? 'WIND PUSH' : 'NO WIND'}</text></g>
    <g transform="translate(302 60)"><line x1="0" y1="0" x2="0" y2="46" stroke="#ddd" stroke-width="3"/><path class="mg-flag" d="M0 2 L${dir * 28} ${5 + Math.abs(flagA) * 0.05} L0 18 Z" fill="${T2}" stroke="#fff" stroke-width="1"/><text y="62" text-anchor="middle" font-size="12" font-weight="800" fill="#fff" font-family="Barlow Condensed, sans-serif" stroke="rgba(0,0,0,.55)" stroke-width="2.4" paint-order="stroke">${mph ? `${dir < 0 ? '◀ ' : ''}${mph} MPH${dir > 0 ? ' ▶' : ''}` : 'DOME'}</text></g>
    <g><rect x="14" y="62" width="56" height="42" rx="8" fill="rgba(5,8,16,.7)" stroke="rgba(255,255,255,.18)"/><text x="42" y="88" text-anchor="middle" font-size="26" font-weight="800" fill="#fff" font-family="Barlow Condensed, sans-serif">${dist}</text><text x="42" y="99" text-anchor="middle" font-size="8.5" fill="#fff" fill-opacity=".7" letter-spacing=".15em" font-family="Barlow Condensed, sans-serif">YD FG</text></g>
    ${streaks}${weather}
    <g id="mgAim" ${sc.shaky ? 'class="mg-shaky"' : ''}><line id="mgAimL" x1="${bx}" y1="268" x2="170" y2="150" stroke="#ffd23d" stroke-width="2" stroke-dasharray="5 5"/><circle id="mgAimC" cx="170" cy="150" r="7" fill="none" stroke="#ffd23d" stroke-width="2.5"/></g>
    ${mgGuy(bx + 26, 276, T1, T2, { s: 1.2 })}<g id="mgBallG">${mgBall(bx, 268, 1.5, 0, 'mgBallEl')}</g><g id="mgFx"></g></svg><div class="mg-me kick">${ctx.env.jersey ? ctx.env.jersey('back') : ''}</div><div class="mg-call">${sc.name} · ${MG_LV.indexOf(i) + 1}/3</div>`;
  const aimX = a => 170 + a * hw * 2;
  ctx.ctrl.innerHTML = `<div class="mg-aim"><span>AIM</span><input type="range" min="-100" max="100" value="0" id="mgAimIn"></div><div class="mg-btns one"><button class="mg-b big" id="mgKickGo" style="--c:#ffd23d">🦵 KICK</button></div>`;
  ctx.say(sc.shaky ? '<b>Everything on the line…</b> steady your aim' : 'Aim <b>into</b> the wind');
  if (sc.shaky) Snd.play('mgTension', 0.05);
  const inp = ctx.ov.querySelector('#mgAimIn'), setAim = () => { aim = inp.value / 100; const x = aimX(aim); ctx.stage.querySelector('#mgAimL').setAttribute('x2', x); ctx.stage.querySelector('#mgAimC').setAttribute('cx', x); };
  inp.addEventListener('input', setAim);
  return new Promise(res => {
    ctx.ov.querySelector('#mgKickGo').addEventListener('click', async () => {
      if (!ctx.alive()) return; ctx.ov.querySelector('#mgKickGo').disabled = true; inp.disabled = true;
      const z = sc.zone;
      ctx.ctrl.innerHTML = `<div class="mg-power"><div class="mg-py" style="left:${(pT - 0.2) * 100}%;width:40%"></div><div class="mg-pz" style="left:${(pT - z / 2) * 100}%;width:${z * 100}%"></div><i id="mgPI"></i></div><div class="mg-btns one"><button class="mg-b big" id="mgStop" style="--c:#c5ff3a">⏹ STOP</button></div>`;
      ctx.say('<b>Stop the bar in the green!</b>', 'go');
      const pi = ctx.ov.querySelector('#mgPI'), t0 = performance.now(), sp = (0.95 + i * 0.12) * (sc.shaky ? 1.18 : 1); let raf = 0;
      const val = () => { const ph = ((performance.now() - t0) / 1000 * sp) % 2; return ph < 1 ? ph : 2 - ph; };
      const upd = () => { if (!ctx.alive()) return; pi.style.left = (val() * 100) + '%'; raf = requestAnimationFrame(upd); }; raf = requestAnimationFrame(upd);
      const stop = async ev => {
        ev.preventDefault(); ctx.stage.removeEventListener('pointerdown', stop); cancelAnimationFrame(raf); const p = val(), perr = Math.abs(p - pT); ctx.ctrl.innerHTML = '';
        const shake = sc.shaky ? (rnd() - 0.5) * 0.5 : 0;
        const lateral = aim * 2 + drift + shake + (rnd() - 0.5) * 0.22 * (1 + 3 * perr) + (p < pT ? -0.1 : 0.1) * perr * 2, al = Math.abs(lateral);
        const short = p < pT - 0.2, over = p > pT + 0.2;
        // the ball must pass BETWEEN the posts: inside 0.8 of the upright line is clean, 0.8 to 1.14 touches the post
        const upright = !short && !over && al > 0.8 && al <= 1.14, wide = !short && !over && al > 1.14, ok = !short && !over && al <= 0.8;
        const perfect = ok && al < 0.3 && perr < z / 2;
        Snd.play('mgKick', 0);
        const ball = ctx.stage.querySelector('#mgBallEl'), landX = 170 + lateral * hw, sgn = lateral < 0 ? -1 : 1;
        const main = (n, tEnd, yEnd, sEnd) => Array.from({ length: n + 1 }, (_, k) => { const t = k / n * tEnd; return { t, x: bx + (landX - bx) * t, y: 268 - (268 - yEnd) * t - Math.sin(Math.PI * t) * 46, s: 1.5 - (1.5 - sEnd) * t }; });
        let frames, dur = 1150;
        if (short) { frames = main(10, 0.62, barY, 0.35).map((f, k, a) => ({ ...f, t: f.t / 0.62 })); dur = 800; }
        else if (over) { frames = main(10, 1, 30, 0.22); }
        else if (ok) { const m = main(10, 0.62, barY, 0.35).map(f => ({ ...f, t: f.t * 0.7 })); frames = m.concat([{ t: 0.85, x: landX, y: barY - 24, s: 0.3, o: 1 }, { t: 1, x: landX, y: barY - 44, s: 0.22, o: 0 }]); }
        else if (upright) { const m = main(10, 0.62, barY + 2, 0.35).map(f => ({ ...f, t: f.t * 0.6 })); const hx = landX; frames = m.concat([{ t: 0.72, x: hx - sgn * 10, y: barY + 14, s: 0.33 }, { t: 1, x: hx - sgn * 26, y: barY + 66, s: 0.5 }]); }
        else { frames = main(10, 1, 70, 0.26); }
        await mgFly(ctx, ball, frames, dur);
        if (!ctx.alive()) return res(false);
        let txt;
        if (ok) { txt = `${dist}-YARD FIELD GOAL IS GOOD!`; mgPop(ctx, 170, 96, perfect ? 'PERFECT!' : 'GOOD!', 'good'); if (perfect) { ctx.perfects++; txt = '✨ PERFECT KICK! ' + txt; } Snd.play('td', 0.15); mgShake(ctx); }
        else if (upright) {
          const up = ctx.stage.querySelector(lateral < 0 ? '#mgUL' : '#mgUR'); if (up) { up.classList.add('hit'); } Snd.play('mgPost', 0); mgShake(ctx);
          txt = 'It hit the upright — no good!'; mgPop(ctx, 170, 96, 'OFF THE POST!', 'bad');
        } else { const why = short ? 'SHORT' : over ? 'TOO HIGH' : (lateral < 0 ? 'WIDE LEFT' : 'WIDE RIGHT'); txt = `No good — ${why.toLowerCase()}`; mgPop(ctx, 170, 96, why, 'bad'); }
        const tip = (wide || upright) ? '<span class="mg-tip">The wind pushed it — aim against the arrow.</span>' : (short || over) ? '<span class="mg-tip">Stop the bar inside the green.</span>' : '';
        ctx.say(`${ok ? '✅' : '❌'} ${txt}${tip}`, ok ? 'good' : 'bad'); res(ok);
      };
      ctx.ov.querySelector('#mgStop').addEventListener('pointerdown', stop, { once: true }); ctx.stage.addEventListener('pointerdown', stop);
    }, { once: true });
  });
}

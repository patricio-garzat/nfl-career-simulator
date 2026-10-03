/* =====================================================================
   MINI GAMES — every 3-5 games a short mini game pops up, depending on your position:
     QB    → READ THE DEFENSE (5 coverages, 5 targets, disguised looks)
     RB    → FIND THE HOLE    (3 gaps, a defense that shifts, a juke at the end)
     WR/TE → CATCH IT         (different throws: deep, slant, lob, knuckle, contested)
     K     → KICK IT          (different situations: hash, rain, snow, wind, pressure)
   Other positions have none. 5 attempts, 3 or more = a good grade; perfect plays add a small extra bonus.
   Scenes are drawn with your team's colors and logo, the rival's, and YOUR jersey. Sounds are tiny single events (Snd.play('mg…')).
   State lives in the season object (season.mg, season.buffs, season.mgLog), so it saves with the career.
   ===================================================================== */
const MG_KIND = { QB: 'qb', RB: 'rb', WR: 'catch', TE: 'catch', K: 'kick' };
const MG_GRADES = [
  { n: 'DISASTER', perf: -0.06, left: 2 }, { n: 'BAD DAY', perf: -0.06, left: 2 }, { n: 'ROUGH', perf: -0.03, left: 2 },
  { n: 'GOOD', perf: 0.04, left: 3 }, { n: 'GREAT', perf: 0.07, left: 3 }, { n: 'PERFECT', perf: 0.10, left: 3 },
];

function mgEnsure(se) { se.buffs = se.buffs || []; se.mgLog = se.mgLog || []; se.train = se.train || { phys: 0, ment: 0 }; se.injExtra = se.injExtra || 0; if (se.mgIn == null) se.mgIn = randInt(3, 5); if (se.mgSince == null) se.mgSince = 0; return se; }
function mgInitSeason(season) { season.buffs = []; season.mg = null; season.mgLog = []; season.mgIn = randInt(3, 5); season.mgSince = 0; season.train = { phys: 0, ment: 0 }; season.injExtra = 0; }
function mgMods(se) { let perf = 1; (se.buffs || []).forEach(b => { if (b.left > 0) perf *= 1 + (b.perf || 0); }); return { perf, inj: 1, team: 0 }; }
function mgAfterGame(se, game, notes) {
  mgEnsure(se);
  se.buffs.forEach(b => { b.left--; }); se.buffs = se.buffs.filter(b => b.left > 0);
  if (se.mg) { se.mg.age = (se.mg.age || 0) + 1; if (se.mg.age >= 3) { se.mg = null; se.mgSince = 0; se.mgIn = randInt(3, 5); } }
  const kind = MG_KIND[S.player.pos];
  if (!kind || game.k !== 'REG' || se.status !== 'regular' || se.mg) return;
  se.mgSince++;
  const left = se.schedule.length - se.games.length;
  if (se.mgSince >= se.mgIn && left >= 2 && !se.injury) { se.mg = { kind, wk: game.wk, age: 0 }; notes.push('🎮 MINI GAME — a training challenge is ready.'); }
}
const MG_META = {
  qb: P => ({ icon: '🏈', title: 'READ THE DEFENSE', how: 'Read the coverage, find the open man.', legend: [['🔴', 'Blitz', 'RB'], ['🛡️', 'Two deep', 'TE'], ['🟨', 'Soft corners', 'WR'], ['🔱', 'Three deep', 'SLOT'], ['🔗', 'Man', 'RUN']] }),
  rb: P => ({ icon: '🏃', title: 'FIND THE HOLE', how: 'Run where the defense is not.', legend: [['👀', 'Empty gap', 'GO'], ['⚡', 'Then', 'JUKE']] }),
  catch: P => ({ icon: '🙌', title: P.pos === 'TE' ? 'CATCH IT · SEAM' : 'CATCH IT · GO ROUTE', how: 'Tap when the ball fills the ring.', legend: [['⭕', 'Ball = ring', 'TAP'], ['🌀', 'Every throw is different', '']] }),
  kick: P => ({ icon: '🥅', title: 'KICK IT', how: 'Aim into the wind, stop the bar in the green.', legend: [['💨', 'Wind pushes', 'AIM AGAINST'], ['⏹', 'Power', 'GREEN']] }),
};
const mgBannerHTML = se => (se.mg && MG_META[se.mg.kind]) ? `<div class="banner dec-banner"><span>🎮 <b>MINI GAME</b> — ${MG_META[se.mg.kind](S.player).title}</span><button class="btn btn-primary btn-sm" data-act="playMini">PLAY</button></div>` : '';

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
    <div class="mg-top"><span class="mg-tag">🎮 MINI GAME</span><button class="mini mg-skip" data-mg="skip">SKIP</button></div>
    <div class="mg-board"><img src="${t.logo}" alt=""><div class="mg-bt"><b>${esc(meta.title)}</b><span>${esc(P.name)} · ${P.pos} · #${env.number}</span></div><img src="${opp.logo}" alt=""></div>
    <div class="mg-pips">${[0, 1, 2, 3, 4].map(i => `<span data-p="${i}">${mgFootball()}</span>`).join('')}<em id="mgScore">0/5</em><b class="mg-combo" id="mgCombo" hidden></b></div>
    <div class="mg-stage" id="mgStage"></div><div class="mg-msg" id="mgMsg"></div><div class="mg-ctrl" id="mgCtrl"></div></div>`;
  document.body.appendChild(ov);
  const stage = ov.querySelector('#mgStage'), msg = ov.querySelector('#mgMsg'), ctrl = ov.querySelector('#mgCtrl');
  const ctx = { env, number: env.number, ov, stage, msg, ctrl, t, o: opp, P, kind, alive: () => ov.isConnected, say: (h, cls = '') => { msg.className = 'mg-msg ' + cls; msg.innerHTML = h; }, results: [], perfects: 0, combo: 0 };
  MGX = ctx;
  stage.innerHTML = `<div class="mg-intro" style="background-image:radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, ${t.c1} 40%, transparent), transparent)">
    <div class="mg-jersey-big">${env.jersey ? env.jersey('front') : ''}</div><div class="mg-bigicon">${meta.icon}</div><h2>${esc(meta.title)}</h2><p>${esc(meta.how)}</p>
    <div class="mg-legend">${meta.legend.map(([i, a, b]) => `<span>${i} ${a}${b ? ` <b>→ ${b}</b>` : ''}</span>`).join('')}</div><p class="mg-sub">5 tries · 3 or more for a bonus</p></div>`;
  ctrl.innerHTML = `<button class="btn btn-primary btn-xl" data-mg="start">START</button>`;
  Snd.play('mgCrowd', 0.05);
}
async function mgRun(ctx) {
  const fn = { qb: mgQB, rb: mgRB, catch: mgCatch, kick: mgKick }[ctx.kind], st = {};
  ctx.ctrl.innerHTML = ''; ctx.say('');
  for (let i = 0; i < 5; i++) {
    if (!ctx.alive()) return;
    ctx.ov.querySelectorAll('.mg-pips [data-p]').forEach((p, k) => p.classList.toggle('cur', k === i));
    const ok = await fn(ctx, i, st); if (!ctx.alive()) return;
    ctx.results.push(ok);
    ctx.combo = ok ? ctx.combo + 1 : 0;
    ctx.ov.querySelector(`.mg-pips [data-p="${i}"]`).className = ok ? 'ok' : 'bad';
    ctx.ov.querySelector('#mgScore').textContent = `${ctx.results.filter(Boolean).length}/5`;
    const cb = ctx.ov.querySelector('#mgCombo'); if (ctx.combo >= 2) { cb.hidden = false; cb.textContent = `🔥 x${ctx.combo}`; cb.classList.remove('pop'); void cb.offsetWidth; cb.classList.add('pop'); } else cb.hidden = true;
    if (ok) { Snd.play('mgGood', 0, Math.min(4, ctx.combo - 1)); mgFlash(ctx, true); } else { Snd.play('mgMiss', 0); mgFlash(ctx, false); }
    await sleep(i < 4 ? 1500 : 900);
  }
  mgFinish(ctx);
}
function mgFlash(ctx, good) { const s = ctx.stage; s.classList.remove('mg-good', 'mg-badflash'); void s.offsetWidth; s.classList.add(good ? 'mg-good' : 'mg-badflash'); if (good) { Snd.play('mgCrowd', 0.12, 1); burst(s, 14, [ctx.t.c1, ctx.t.c2, '#ffffff', '#ffd23d']); } }
function mgFinish(ctx) {
  const se = ctx.env.se, sc = ctx.results.filter(Boolean).length, g = MG_GRADES[sc], good = sc >= 3;
  const extra = good ? Math.min(0.04, ctx.perfects * 0.01) : 0, perf = Math.min(0.12, g.perf + extra);
  const fx = `${perf > 0 ? '+' : '−'}${Math.abs(Math.round(perf * 100))}% performance · next ${g.left} games`;
  ctx.stage.innerHTML = `<div class="mg-res ${good ? 'good' : 'bad'}" style="background-image:radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, ${ctx.t.c1} 38%, transparent), transparent)">
    <div class="mg-jersey-big small">${ctx.env.jersey ? ctx.env.jersey('back') : ''}</div>
    <div class="mg-grade">${g.n}</div><div class="mg-big">${sc}<small>/5</small></div>
    <div class="mg-stars">${[0, 1, 2, 3, 4].map(i => `<span class="${i < sc ? 'on' : ''}">★</span>`).join('')}</div>
    ${ctx.perfects ? `<div class="mg-perf">✨ ${ctx.perfects} perfect play${ctx.perfects > 1 ? 's' : ''}</div>` : ''}
    <div class="mg-bonus ${good ? 'good' : 'bad'}">${good ? '⚡' : '⚠️'} ${fx}</div></div>`;
  ctx.say(''); ctx.ctrl.innerHTML = `<button class="btn btn-primary btn-xl" data-mg="done">CONTINUE</button>`;
  se.buffs.push({ left: g.left, perf, label: 'Mini game ' + g.n.toLowerCase() });
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
   QB — READ THE DEFENSE
   5 coverages, 5 targets. Attempts 3-5 disguise the look: the defense rotates after the snap.
   ===================================================================== */
const QB_DEF = {
  blitz: { name: 'BLITZ', ans: 'RB', tip: 'Blitz → hot throw to the RB.' },
  cover2: { name: 'COVER 2', ans: 'TE', tip: 'Two deep → seam to the TE.' },
  cover3: { name: 'COVER 3', ans: 'WR2', tip: 'Three deep → slot underneath.' },
  soft: { name: 'SOFT CORNERS', ans: 'WR1', tip: 'Corners off → outside WR.' },
  man: { name: 'MAN', ans: 'RUN', tip: 'Man coverage → scramble!' },
};
const QB_TG = {
  WR1: { x: 28, y: 142, c: '#ffd23d', l: 'WR', route: [[28, 142], [28, 78], [10, 44]] },
  WR2: { x: 270, y: 152, c: '#ff8fd0', l: 'SLOT', route: [[270, 152], [270, 116], [246, 106]] },
  TE: { x: 226, y: 144, c: '#35e0ff', l: 'TE', route: [[226, 144], [226, 92], [214, 34]] },
  RB: { x: 130, y: 186, c: '#c5ff3a', l: 'RB', route: [[130, 186], [104, 188], [72, 164]] },
  RUN: { x: 170, y: 168, c: '#ffffff', l: 'RUN', route: [[170, 168], [190, 120], [200, 72]] },
};
const QB_LOOK = {
  blitz: { DL: [[140, 124], [158, 124], [182, 124], [200, 124]], LB: [[130, 132], [170, 130], [212, 132]], CB: [[28, 116], [276, 120]], S: [[108, 100], [232, 98]] },
  cover2: { DL: [[140, 118], [158, 118], [182, 118], [200, 118]], LB: [[120, 98], [170, 92], [222, 98]], CB: [[28, 104], [276, 108]], S: [[88, 34], [252, 34]] },
  cover3: { DL: [[140, 118], [158, 118], [182, 118], [200, 118]], LB: [[116, 100], [160, 98], [226, 100]], CB: [[28, 46], [276, 50]], S: [[170, 28], [208, 80]] },
  soft: { DL: [[140, 118], [158, 118], [182, 118], [200, 118]], LB: [[130, 98], [170, 94], [214, 98]], CB: [[28, 72], [276, 74]], S: [[120, 34], [222, 34]] },
  man: { DL: [[140, 118], [158, 118], [182, 118], [200, 118]], LB: [[134, 150], [226, 126], [170, 96]], CB: [[28, 130], [270, 136]], S: [[170, 36], [100, 100]] },
};
function mgQB(ctx, i, st) {
  if (!st.plan) { st.plan = shuffle(Object.keys(QB_DEF)); st.flip = [rnd() < 0.5, rnd() < 0.5, rnd() < 0.5, rnd() < 0.5, rnd() < 0.5]; }
  const key = st.plan[i], d = QB_DEF[key], T1 = ctx.t.c1, T2 = ctx.t.c2, O1 = ctx.o.c1, O2 = ctx.o.c2, flip = st.flip[i];
  const mx = x => (flip ? 340 - x : x), disguise = i >= 2 && rnd() < 0.7, preKey = disguise ? pick(Object.keys(QB_DEF).filter(k => k !== key)) : key;
  const order = ['DL', 'LB', 'CB', 'S'], flat = lk => order.flatMap(g => lk[g]);
  const pre = flat(QB_LOOK[preKey]), fin = flat(QB_LOOK[key]);
  const defs = fin.map((p, k) => mgGuy(mx(pre[k][0]), pre[k][1], O1, O2, { s: 1.12, down: true, cls: 'mg-d', attrs: `data-f="${mx(p[0])},${p[1]}"` })).join('');
  const marker = c => `<marker id="mgA${c.slice(1)}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`;
  const routes = Object.entries(QB_TG).map(([k, g]) => `<path d="M${g.route.map(p => `${mx(p[0])} ${p[1]}`).join(' L')}" stroke="${g.c}" stroke-width="2.4" stroke-dasharray="6 5" fill="none" marker-end="url(#mgA${g.c.slice(1)})" opacity="${k === 'RUN' ? 0.55 : 0.9}" class="mg-route"/>`).join('');
  const tell = {
    blitz: `<g stroke="#ff4d4d" stroke-width="3" fill="none" stroke-linecap="round"><path d="M${mx(130)} 128 L${mx(158)} 156"/><path d="M${mx(170)} 126 L${mx(170)} 152"/><path d="M${mx(212)} 128 L${mx(186)} 156"/><path d="M${mx(108)} 102 L${mx(150)} 154"/></g>`,
    cover2: `<rect x="6" y="8" width="160" height="64" rx="10" fill="${O1}" fill-opacity=".3" stroke="${O1}" stroke-dasharray="4 4"/><rect x="174" y="8" width="160" height="64" rx="10" fill="${O1}" fill-opacity=".3" stroke="${O1}" stroke-dasharray="4 4"/>`,
    cover3: `<rect x="6" y="8" width="108" height="64" rx="10" fill="${O1}" fill-opacity=".3" stroke="${O1}" stroke-dasharray="4 4"/><rect x="116" y="8" width="108" height="64" rx="10" fill="${O1}" fill-opacity=".3" stroke="${O1}" stroke-dasharray="4 4"/><rect x="226" y="8" width="108" height="64" rx="10" fill="${O1}" fill-opacity=".3" stroke="${O1}" stroke-dasharray="4 4"/>`,
    soft: `<g stroke="#ffd23d" stroke-width="2" stroke-dasharray="3 4" fill="none"><path d="M${mx(28)} 80 L${mx(28)} 130"/><path d="M${mx(276)} 82 L${mx(276)} 132"/></g>`,
    man: `<g stroke="#ff9a9a" stroke-width="1.8" stroke-dasharray="2 3" fill="none"><path d="M${mx(28)} 134 L${mx(28)} 142"/><path d="M${mx(270)} 140 L${mx(270)} 150"/><path d="M${mx(226)} 130 L${mx(226)} 140"/><path d="M${mx(134)} 154 L${mx(130)} 182"/></g><path d="M${mx(170)} 150 L${mx(184)} 60" stroke="#6dffbb" stroke-width="14" stroke-opacity=".18" stroke-linecap="round" fill="none"/>`,
  }[key];
  const ol = [134, 152, 170, 188, 206].map(x => mgGuy(x, 146, T1, T2, { s: 1.0 })).join('');
  const tgs = Object.entries(QB_TG).map(([k, g]) => { const x = mx(g.x), y = g.y; return `<g class="mg-tg" data-pick="${k}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="22" fill="transparent"/>${k === 'RUN' ? '' : mgGuy(x, y, T1, T2, { s: 1.4 })}<text x="${x}" y="${y + 23}" text-anchor="middle" font-size="10" font-weight="800" fill="${g.c}" font-family="Barlow Condensed, sans-serif" letter-spacing=".08em" stroke="rgba(0,0,0,.6)" stroke-width="2.4" paint-order="stroke">${g.l}</text></g>`; }).join('');
  const call = pick(['SMASH', 'TRIPS BUNCH', 'FLOOD', 'MESH', 'Y-CROSS', 'FOUR VERTS', 'STICK', 'CURL-FLAT', 'SLANT', 'DRAGON', 'LEVELS', 'HITCH-GO']);
  ctx.stage.innerHTML = `<svg class="mg-svg" viewBox="0 0 340 250">${mgTopField(ctx)}<defs>${marker('#ffd23d')}${marker('#ff8fd0')}${marker('#35e0ff')}${marker('#c5ff3a')}${marker('#ffffff')}</defs>
    <line x1="0" x2="340" y1="132" y2="132" stroke="#4aa8ff" stroke-width="2.5" stroke-opacity=".85"/>${routes}
    <g id="mgTell" opacity="0" style="transition:opacity .35s">${tell}</g>${defs}${ol}${tgs}${mgGuy(170, 168, T1, T2, { s: 1.5, you: true, cls: 'mg-qb' })}
    <g id="mgBallG">${mgBall(170, 168, 0.85, 0, 'mgBallEl')}</g><g id="mgFx"></g></svg><div class="mg-call">PLAY: <b>${call}</b> · ${i + 1}/5</div>`;
  ctx.ctrl.innerHTML = `<div class="mg-timer"><i></i></div><div class="mg-btns five">${Object.entries(QB_TG).map(([k, g]) => `<button class="mg-b" data-pick="${k}" style="--c:${g.c}">${g.l}</button>`).join('')}</div>`;
  ctx.say('Defense is lining up…');
  const secs = [5.2, 4.8, 4.4, 4.0, 3.6][i];
  return (async () => {
    await sleep(350); if (!ctx.alive()) return false;
    const moveDefs = () => ctx.stage.querySelectorAll('.mg-d').forEach(g => { const [fx, fy] = g.dataset.f.split(',').map(Number); g.style.transform = `translate(${fx}px,${fy}px)`; });
    const showTell = () => { const t = ctx.stage.querySelector('#mgTell'); if (t) t.style.opacity = 1; };
    if (!disguise) { moveDefs(); showTell(); }
    await sleep(900); if (!ctx.alive()) return false;
    ctx.say('<b>HIKE!</b>', 'go'); Snd.play('mgSnap', 0.02);
    mgPickBtn(ctx, '.mg-btns .mg-b, .mg-tg');
    if (disguise) setTimeout(() => { if (!ctx.alive() || !ctx.pick) return; moveDefs(); showTell(); ctx.say('<b>⚠ THE DEFENSE ROTATES!</b>', 'go'); Snd.play('mgSwish', 0); }, 1100);
    const pickd = await mgChoice(ctx, secs); if (!ctx.alive()) return false;
    ctx.ctrl.innerHTML = ''; moveDefs(); showTell();
    const quick = pickd && (performance.now() - ctx.pickStart) / 1000 < secs * 0.45;
    const ok = pickd === d.ans, bg = ctx.stage.querySelector('#mgBallG'), qb = ctx.stage.querySelector('.mg-qb');
    let txt = '';
    if (!pickd) { txt = 'SACKED! Too slow'; mgPop(ctx, 170, 150, 'SACK!', 'bad'); Snd.play('mgHit', 0); mgShake(ctx); }
    else if (pickd === 'RUN') {
      const yy = ok ? 70 : 128;
      qb.style.transition = 'transform .7s ease-in'; qb.style.transform = `translate(${mx(196)}px,${yy}px)`; bg.style.transition = 'transform .7s ease-in'; bg.style.transform = `translate(${mx(196) - 170}px,${yy - 168}px)`; await sleep(720);
      if (ok) { const y = randInt(9, 18); txt = `SCRAMBLE! ${mgYardsStr(y)}`; mgPop(ctx, mx(196), 56, mgYardsStr(y), 'good'); Snd.play('mgSwish', 0); } else { txt = 'TACKLED behind the line'; mgPop(ctx, mx(190), 118, 'TACKLED', 'bad'); Snd.play('mgHit', 0); mgShake(ctx); }
    } else {
      const tg = QB_TG[pickd], tx = mx(tg.x), ty = tg.y - 6; Snd.play('mgThrow', 0);
      await new Promise(r => { const t0 = performance.now(), dur = 520; const step = () => { if (!ctx.alive()) return r(); const k = Math.min(1, (performance.now() - t0) / dur), x = 170 + (tx - 170) * k, y = 168 + (ty - 168) * k - Math.sin(Math.PI * k) * 26; ctx.stage.querySelector('#mgBallEl').setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(k * 540).toFixed(0)}) scale(${(0.85 + Math.sin(Math.PI * k) * 0.35).toFixed(2)})`); if (k < 1) requestAnimationFrame(step); else r(); }; step(); });
      if (ok) { const y = pickd === 'WR1' ? randInt(18, 32) : pickd === 'WR2' ? randInt(10, 18) : pickd === 'TE' ? randInt(12, 22) : randInt(7, 13); txt = `COMPLETE! ${mgYardsStr(y)}`; mgPop(ctx, tx, ty - 14, mgYardsStr(y), 'good'); Snd.play('mgPat', 0); if (y >= 20) Snd.play('td', 0.15); }
      else if (key === 'blitz') { txt = 'SACKED! The blitz got there'; mgPop(ctx, 170, 150, 'SACK!', 'bad'); Snd.play('mgHit', 0); mgShake(ctx); }
      else if (pickd === 'WR1' && key !== 'soft') { txt = 'INTERCEPTED!'; mgPop(ctx, tx, ty - 14, 'INT!', 'bad'); Snd.play('mgHit', 0); }
      else { txt = 'Incomplete — covered'; mgPop(ctx, tx, ty - 14, 'INC', 'bad'); Snd.play('mgPat', 0); }
    }
    if (ok && quick) { ctx.perfects++; txt += ' · ✨ quick read'; }
    ctx.say(`${ok ? '✅' : '❌'} ${txt}${ok ? '' : `<span class="mg-tip">${d.name}: ${d.tip}</span>`}`, ok ? 'good' : 'bad');
    return ok;
  })();
}

/* =====================================================================
   RB — FIND THE HOLE
   Three gaps, the defense stacks two of them (and shifts late on attempts 4-5); then a juke timing at the end.
   ===================================================================== */
const RB_GAPS = { L: 112, M: 170, R: 228 };
function mgRB(ctx, i, st) {
  if (!st.open) { st.open = []; for (let k = 0; k < 5; k++) { let g; do { g = pick(['L', 'M', 'R']); } while (k && g === st.open[k - 1]); st.open.push(g); } }
  const open = st.open[i], disguise = i >= 3, T1 = ctx.t.c1, T2 = ctx.t.c2, O1 = ctx.o.c1, O2 = ctx.o.c2;
  const shape = openGap => {   // two defenders at each closed gap on the line, linebackers behind them, safeties deep
    const closed = ['L', 'M', 'R'].filter(g => g !== openGap), pos = [];
    closed.forEach((g, k) => { const x = RB_GAPS[g]; pos.push([x - 11, 122], [x + 11, 122], [x + (k ? 8 : -8) * 0.6, 100]); });
    pos.push([RB_GAPS[openGap] + (openGap === 'M' ? 0 : openGap === 'L' ? -34 : 34), 96]);
    pos.push([RB_GAPS[closed[0]], 62], [RB_GAPS[closed[1]], 62]); return pos;
  };
  const fin = shape(open), init = disguise ? shape(pick(['L', 'M', 'R'].filter(g => g !== open))) : fin;
  const defs = fin.map((p, k) => mgGuy(init[k][0], init[k][1], O1, O2, { s: 1.12, down: true, cls: 'mg-d', attrs: `data-f="${p[0]},${p[1]}"` })).join('');
  const ol = [126, 148, 170, 192, 214].map(x => mgGuy(x, 144, T1, T2, { s: 1.05 })).join('');
  const lanes = ['L', 'M', 'R'].map(g => `<g class="mg-tg" data-pick="${g}" style="cursor:pointer"><rect x="${RB_GAPS[g] - 28}" y="30" width="56" height="116" rx="10" fill="#fff" fill-opacity="0" stroke="#fff" stroke-opacity=".12" stroke-dasharray="3 5"/></g>`).join('');
  ctx.stage.innerHTML = `<svg class="mg-svg" viewBox="0 0 340 250">${mgTopField(ctx, 340, 250, 'mgR')}<line x1="0" x2="340" y1="132" y2="132" stroke="#4aa8ff" stroke-width="2.5" stroke-opacity=".85"/>
    ${lanes}<g id="mgHole" opacity="0"><rect x="${RB_GAPS[open] - 22}" y="26" width="44" height="118" rx="14" fill="#c5ff3a" fill-opacity=".16"/></g>${defs}${ol}${mgGuy(170, 162, T1, T2, { s: 1.15 })}
    <g id="mgRunner" style="transform:translate(170px,200px);transition:transform .45s ease-in">${mgGuy(0, 0, T1, T2, { s: 1.5, you: true })}</g><g id="mgRing"></g><g id="mgFx"></g></svg><div class="mg-call">RUN PLAY · ${i + 1}/5</div>`;
  ctx.ctrl.innerHTML = `<div class="mg-timer"><i></i></div><div class="mg-btns three"><button class="mg-b" data-pick="L" style="--c:#ffd23d">◀ LEFT</button><button class="mg-b" data-pick="M" style="--c:#ffffff">MIDDLE</button><button class="mg-b" data-pick="R" style="--c:#35e0ff">RIGHT ▶</button></div>`;
  ctx.say('Defense is lining up…');
  const secs = [3.8, 3.5, 3.2, 3.0, 2.8][i];
  return (async () => {
    await sleep(500); if (!ctx.alive()) return false;
    ctx.say('<b>HIKE!</b> Find the open gap', 'go'); Snd.play('mgSnap', 0.02);
    mgPickBtn(ctx, '.mg-btns .mg-b, .mg-tg');
    if (disguise) setTimeout(() => { if (!ctx.alive() || !ctx.pick) return; ctx.stage.querySelectorAll('.mg-d').forEach(g => { const [fx, fy] = g.dataset.f.split(',').map(Number); g.style.transition = 'transform .7s ease-in-out'; g.style.transform = `translate(${fx}px,${fy}px)`; }); ctx.say('<b>⚠ THEY SHIFT!</b>', 'go'); Snd.play('mgSwish', 0); }, 1000);
    const pickd = await mgChoice(ctx, secs); if (!ctx.alive()) return false;
    ctx.ctrl.innerHTML = '';
    const run = ctx.stage.querySelector('#mgRunner'); ctx.stage.querySelectorAll('.mg-d').forEach(g => { const [fx, fy] = g.dataset.f.split(',').map(Number); g.style.transition = 'none'; g.style.transform = `translate(${fx}px,${fy}px)`; });
    const ok = pickd === open, lane = pickd ? RB_GAPS[pickd] : 170;
    if (!pickd) { run.style.transform = 'translate(170px,150px)'; await sleep(450); mgPop(ctx, 170, 118, 'STUFFED!', 'bad'); Snd.play('mgHit', 0); mgShake(ctx); ctx.say('❌ You hesitated and got stuffed', 'bad'); return false; }
    run.style.transition = 'transform .35s ease-in'; run.style.transform = `translate(${lane}px,150px)`; Snd.play('mgSwish', 0); await sleep(380);
    if (!ok) {
      ctx.stage.querySelectorAll('.mg-d').forEach((g, k) => { if (k < 6) { g.style.transition = 'transform .35s ease-in'; g.style.transform = `translate(${lane + (k % 3) * 9 - 9}px,${132 - (k % 2) * 9}px)`; } });
      await sleep(380); const y = randInt(-2, 1); mgPop(ctx, lane, 112, mgYardsStr(y), 'bad'); Snd.play('mgHit', 0); mgShake(ctx);
      ctx.say(`❌ Stuffed! ${mgYardsStr(y)}<span class="mg-tip">That gap was crowded — find the empty one.</span>`, 'bad'); return false;
    }
    ctx.stage.querySelector('#mgHole').style.opacity = 1;
    run.style.transition = 'transform .5s ease-out'; run.style.transform = `translate(${lane}px,96px)`; await sleep(520);
    // juke: a safety closes in; tap as the ring closes
    const ring = ctx.stage.querySelector('#mgRing'), tack = ctx.stage.querySelectorAll('.mg-d')[6];
    if (tack) { tack.style.transition = 'transform .9s ease-in'; tack.style.transform = `translate(${lane + (lane < 170 ? -4 : 4)}px,86px)`; }
    ring.innerHTML = `<circle cx="${lane}" cy="96" r="34" fill="none" stroke="#ffd23d" stroke-width="3" class="mg-jring"/><circle cx="${lane}" cy="96" r="12" fill="none" stroke="#fff" stroke-opacity=".6" stroke-dasharray="3 3"/>`;
    ctx.ctrl.innerHTML = `<div class="mg-btns one"><button class="mg-b big" id="mgJuke" style="--c:#ffd23d">⚡ JUKE!</button></div>`; ctx.say('<b>Tackler coming!</b> Juke when the ring closes', 'go');
    const t0 = performance.now(), D = 0.95; let res = null;
    const jr = ring.querySelector('.mg-jring'); const loop = () => { if (!ctx.alive() || res) return; const k = Math.min(1, (performance.now() - t0) / 1000 / D); jr.setAttribute('r', (34 - 24 * k).toFixed(1)); if (k < 1.12) requestAnimationFrame(loop); }; requestAnimationFrame(loop);
    await new Promise(r => { const tap = ev => { if (ev) ev.preventDefault(); if (res) return; const k = (performance.now() - t0) / 1000 / D; res = k > 0.7 && k < 1.08 ? 'perfect' : 'late'; r(); }; ctx.ov.querySelector('#mgJuke').addEventListener('pointerdown', tap, { once: true }); setTimeout(() => { if (!res) { res = 'late'; r(); } }, D * 1000 * 1.12); });
    ctx.ctrl.innerHTML = ''; ring.innerHTML = '';
    const y = res === 'perfect' ? randInt(16, 28) : randInt(7, 14);
    if (res === 'perfect') { ctx.perfects++; Snd.play('mgSwish', 0); run.style.transition = 'transform .5s ease-out'; run.style.transform = `translate(${lane + (lane < 170 ? 22 : -22)}px,30px)`; if (tack) { tack.style.transition = 'transform .5s'; tack.style.transform = `translate(${lane + (lane < 170 ? -26 : 26)}px,100px)`; } await sleep(500); Snd.play('td', 0.05); }
    else { run.style.transition = 'transform .4s ease-out'; run.style.transform = `translate(${lane}px,70px)`; await sleep(420); Snd.play('mgHit', 0); }
    mgPop(ctx, lane, 52, mgYardsStr(y), 'good');
    ctx.say(`✅ ${res === 'perfect' ? '✨ JUKED HIM! ' : 'Dragged down. '}${mgYardsStr(y)}`, 'good'); return true;
  })();
}

/* =====================================================================
   WR / TE — CATCH IT
   First person, behind you: your own jersey at the bottom. Every throw is different.
   ===================================================================== */
const CATCH_THROWS = {
  deep: { name: 'DEEP BALL', D: [2.1, 1.9], R: 40, zone: [0.74, 1.12], curve: 0.5 },
  slant: { name: 'QUICK SLANT', D: [1.15, 1.0], R: 46, zone: [0.72, 1.12], curve: 0 },
  lob: { name: 'HIGH LOB', D: [1.9, 1.7], R: 40, zone: [0.74, 1.1], curve: 1 },
  knuckle: { name: 'KNUCKLEBALL', D: [1.9, 1.7], R: 42, zone: [0.78, 1.06], wobble: true, curve: 0.3 },
  contested: { name: 'CONTESTED', D: [1.7, 1.5], R: 42, zone: [0.76, 0.98], hit: true, curve: 0.2 },
};
function mgCatch(ctx, i, st) {
  if (!st.plan) st.plan = mgShuffleNoRepeat(Object.keys(CATCH_THROWS), 5);
  const P = ctx.P, T1 = ctx.t.c1, T2 = ctx.t.c2, O1 = ctx.o.c1, O2 = ctx.o.c2, te = P.pos === 'TE', th = CATCH_THROWS[st.plan[i]];
  const D = th.D[0] - (th.D[0] - th.D[1]) * (i / 4), off = (rnd() < 0.5 ? -1 : 1) * rr(12, 46), x1 = 170 + off, y1 = 196, R = th.R, zone = th.zone;
  const route = (te ? ['SEAM', 'DRAG', 'CORNER', 'OVER'] : ['GO', 'POST', 'FADE', 'OUT'])[i % 4];
  ctx.stage.innerHTML = `<svg class="mg-svg tall" viewBox="0 0 340 300"><defs><linearGradient id="mgSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070d24"/><stop offset=".5" stop-color="#22407a"/><stop offset="1" stop-color="#12502b"/></linearGradient>${mgLights('mgCL', T1)}</defs>
    <rect width="340" height="300" rx="14" fill="url(#mgSky)"/>${mgFlares('mgCL')}<g class="mg-crowd">${mgCrowd(0, 20, 340, 5, T1, O1)}</g>
    <polygon points="118,64 222,64 372,300 -32,300" fill="#1c6a3c"/>
    ${[84, 108, 138, 176, 224].map(y => `<line x1="${170 - (y - 64) * 0.5}" x2="${170 + (y - 64) * 0.5}" y1="${y}" y2="${y}" stroke="#fff" stroke-opacity=".28" stroke-width="${1 + (y - 64) / 90}"/>`).join('')}
    <image href="${ctx.o.logo}" x="130" y="80" width="80" height="80" opacity=".1" preserveAspectRatio="xMidYMid meet"/>
    ${mgGuy(170, 62, T1, T2, { s: 0.9 })}
    <g id="mgDef" style="transform:translate(${x1 < 170 ? 380 : -40}px,${y1 + 28}px)"><ellipse rx="22" ry="14" fill="${O1}" stroke="${mgStroke(O1)}" stroke-width="2"/><circle cy="-6" r="9" fill="${O2}" stroke="${mgStroke(O2)}" stroke-width="1.5"/>${th.hit ? `<text y="22" text-anchor="middle" font-size="10" font-weight="800" fill="#ff8b8b" font-family="Barlow Condensed, sans-serif" letter-spacing=".1em">${te ? 'LB' : 'CB'}</text>` : ''}</g>
    <g id="mgRing"><circle cx="${x1}" cy="${y1}" r="${R}" fill="${T2}" fill-opacity=".12" stroke="#fff" stroke-width="3"/><circle cx="${x1}" cy="${y1}" r="${(R * 0.96).toFixed(1)}" fill="none" stroke="#c5ff3a" stroke-width="2" stroke-dasharray="4 5"/></g>
    <g id="mgTrail"></g><g id="mgBallG">${mgBall(170, 70, 0.2, 0, 'mgBallEl')}</g><g id="mgFx"></g></svg>
    <div class="mg-me">${ctx.env.jersey ? ctx.env.jersey('back') : ''}</div><div class="mg-call">${th.name} · <b>${route}</b> · ${i + 1}/5</div>`;
  ctx.ctrl.innerHTML = `<div class="mg-btns one"><button class="mg-b big" id="mgCatchBtn" style="--c:#c5ff3a">🙌 CATCH!</button></div>`;
  ctx.say('Get ready…');
  return new Promise(async res => {
    await sleep(750); if (!ctx.alive()) return res(false);
    ctx.say('<b>BALL IS UP!</b>', 'go'); Snd.play('mgThrow', 0.02);
    const ball = ctx.stage.querySelector('#mgBallEl'), def = ctx.stage.querySelector('#mgDef'), trail = ctx.stage.querySelector('#mgTrail'), t0 = performance.now(); let tapped = false, raf = 0, pts = [];
    const sAt = t => { let s = 0.1 + 1.1 * Math.pow(t, 2.2); if (th.wobble) s *= 1 + 0.07 * Math.sin(t * 18); return s; };
    const place = t => {
      const tt = Math.min(t, 1.3), s = sAt(tt), k = Math.min(tt, 1), arc = th.curve ? Math.sin(Math.PI * k) * (th.curve * 46) : 0;
      const x = 170 + (x1 - 170) * k + (tt > 1 ? (x1 - 170) * (tt - 1) * 0.6 : 0) + (th.wobble ? Math.sin(tt * 14) * 6 * (1 - k) : 0);
      const y = 70 + (y1 - 70) * Math.pow(k, 1.5) - arc + (tt > 1 ? (tt - 1) * 160 : 0);
      ball.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(tt * 720).toFixed(0)}) scale(${(s * R / 11 * 0.95).toFixed(3)})`);
      pts.push([x, y]); if (pts.length > 14) pts.shift(); trail.innerHTML = `<polyline points="${pts.map(p => p.map(v => v.toFixed(0)).join(',')).join(' ')}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="${(2 + s * 5).toFixed(1)}" stroke-linecap="round"/>`;
      return { x, y, s };
    };
    const finish = async (ok, why, t) => {
      cancelAnimationFrame(raf); tapped = true; ctx.ctrl.innerHTML = ''; ctx.stage.removeEventListener('pointerdown', onTap); trail.innerHTML = '';
      const ring = ctx.stage.querySelector('#mgRing');
      if (ok) {
        ball.setAttribute('transform', `translate(${x1} ${y1}) rotate(20) scale(${(R / 11 * 0.95).toFixed(3)})`); ring.querySelector('circle').setAttribute('stroke', '#c5ff3a'); ring.querySelector('circle').setAttribute('stroke-width', 6);
        const perfect = Math.abs(sAt(t) - 1) < 0.07, y = te ? randInt(10, 24) : randInt(18, 44); if (perfect) ctx.perfects++;
        mgPop(ctx, x1, y1 - 56, perfect ? 'PERFECT!' : 'CAUGHT!', 'good'); Snd.play('mgPat', 0); mgShake(ctx); if (y >= 25) Snd.play('td', 0.2);
        ctx.say(`✅ ${perfect ? '✨ PERFECT CATCH! ' : 'Caught it! '}${mgYardsStr(y)}`, 'good'); res(true);
      } else {
        const p = place(t), dir = p.x < 170 ? -1 : 1;
        ball.setAttribute('transform', `translate(${(p.x + dir * 60).toFixed(0)} ${(p.y + 70).toFixed(0)}) rotate(260) scale(${(p.s * R / 11 * 0.95).toFixed(3)})`);
        const msg = why === 'early' ? 'TOO EARLY' : why === 'hit' ? 'KNOCKED AWAY' : 'TOO LATE'; mgPop(ctx, x1, y1 - 56, msg, 'bad'); Snd.play(why === 'hit' ? 'mgHit' : 'mgPat', 0); if (why === 'hit') mgShake(ctx);
        ctx.say(`❌ ${why === 'early' ? 'Too early' : why === 'hit' ? 'The defender got there first' : 'Too late'}<span class="mg-tip">Tap when the ball is as big as the ring.</span>`, 'bad'); res(false);
      }
    };
    const tick = () => {
      if (!ctx.alive()) return; const t = (performance.now() - t0) / 1000 / D; place(t);
      if (th.hit || i >= 3) { const k = Math.min(1, t), from = x1 < 170 ? 380 : -40; def.style.transform = `translate(${from + (x1 - from + (x1 < 170 ? 40 : -40)) * k}px,${y1 + 28 - 10 * k}px)`; }
      if (th.hit && t > zone[1] + 0.04 && !tapped) return finish(false, 'hit', t);
      if (t >= 1.3) return finish(false, 'late', 1.3);
      raf = requestAnimationFrame(tick);
    };
    const onTap = ev => { if (tapped || !ctx.alive()) return; ev.preventDefault(); const t = (performance.now() - t0) / 1000 / D, s = sAt(t); if (s < zone[0]) finish(false, 'early', t); else if (s <= zone[1]) finish(true, '', t); else finish(false, th.hit ? 'hit' : 'late', t); };
    ctx.ov.querySelector('#mgCatchBtn').addEventListener('pointerdown', onTap, { once: true }); ctx.stage.addEventListener('pointerdown', onTap);
    raf = requestAnimationFrame(tick);
  });
}

/* =====================================================================
   K — KICK IT
   Eight situations (5 are drawn each time, short to long): hash marks, rain, snow, big wind, a last-second kick with shaky aim…
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
function mgKick(ctx, i, st) {
  if (!st.plan) st.plan = shuffle(Object.keys(KICK_SCN)).slice(0, 5).sort((a, b) => KICK_SCN[a].dist - KICK_SCN[b].dist);
  const sc = KICK_SCN[st.plan[i]], dist = sc.dist, mph = randInt(sc.mph[0], sc.mph[1]), dir = rnd() < 0.5 ? -1 : 1, T1 = ctx.t.c1, T2 = ctx.t.c2, O1 = ctx.o.c1;
  const drift = dir * mph * (dist / 40) * 0.07, size = clamp(1.25 - (dist - 28) * 0.018, 0.7, 1.2), hw = 38 * size, pT = clamp(0.5 + (dist - 28) / 24 * 0.35 + (sc.wx === 'rain' ? 0.03 : 0), 0.45, 0.9);
  const barY = 118, postTop = barY - 74 * size, flagA = dir * Math.min(35, mph * 2.2), bx = 170 + (sc.hash || 0) * 34;
  let aim = 0;
  const weather = sc.wx === 'rain' ? Array.from({ length: 36 }, (_, k) => `<line x1="${(k * 19) % 340}" y1="${(k * 37) % 220 - 20}" x2="${(k * 19) % 340 - 6}" y2="${(k * 37) % 220 + 4}" stroke="#bcd7ff" stroke-opacity=".5" stroke-width="1.2" class="mg-rain" style="animation-delay:${((k * 0.07) % 0.6).toFixed(2)}s"/>`).join('')
    : sc.wx === 'snow' ? Array.from({ length: 30 }, (_, k) => `<circle cx="${(k * 29) % 340}" cy="${(k * 41) % 260}" r="${1.2 + (k % 3) * 0.7}" fill="#fff" opacity=".8" class="mg-snow" style="animation-delay:${((k * 0.13) % 2).toFixed(2)}s"/>`).join('') : '';
  const streaks = mph >= 6 && sc.wx !== 'dome' ? Array.from({ length: Math.min(8, Math.round(mph / 2)) }, (_, k) => `<line x1="${dir > 0 ? 0 : 340}" y1="${150 + k * 15}" x2="${dir > 0 ? 38 : 302}" y2="${150 + k * 15}" stroke="#fff" stroke-opacity=".22" stroke-width="1.4" stroke-linecap="round" class="mg-streak" style="--dx:${dir * 340}px;animation-duration:${(1.8 - Math.min(1, mph / 22)).toFixed(2)}s;animation-delay:${(k * 0.25).toFixed(2)}s"/>`).join('') : '';
  ctx.stage.innerHTML = `<svg class="mg-svg tall" viewBox="0 0 340 300"><defs><linearGradient id="mgSky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sc.wx === 'dome' ? '#1a1f33' : sc.wx === 'snow' ? '#2b3a55' : '#070d24'}"/><stop offset=".5" stop-color="${sc.wx === 'rain' ? '#2a3a5c' : sc.wx === 'snow' ? '#5b6f94' : '#22407a'}"/><stop offset="1" stop-color="${sc.wx === 'snow' ? '#3d6a52' : '#12502b'}"/></linearGradient>${mgLights('mgKL', T1)}</defs>
    <rect width="340" height="300" rx="14" fill="url(#mgSky2)"/>${sc.wx === 'dome' ? '' : mgFlares('mgKL')}<g class="mg-crowd">${mgCrowd(0, 26, 340, 4, T1, O1)}</g>
    <polygon points="96,150 244,150 372,300 -32,300" fill="${sc.wx === 'snow' ? '#dbe7e0' : '#1c6a3c'}" ${sc.wx === 'snow' ? 'fill-opacity=".55"' : ''}/>
    <rect x="96" y="150" width="148" height="18" fill="${O1}" opacity=".9"/><image href="${ctx.o.logo}" x="106" y="150" width="18" height="18"/><image href="${ctx.o.logo}" x="216" y="150" width="18" height="18"/><text x="170" y="163" text-anchor="middle" font-size="12" font-weight="800" fill="${textOn(O1)}" font-family="Barlow Condensed, sans-serif" letter-spacing=".22em">${esc(ctx.o.nick.toUpperCase())}</text>
    ${[190, 215, 245].map((y, k) => `<line x1="${170 - 74 - k * 22}" x2="${170 + 74 + k * 22}" y1="${y}" y2="${y}" stroke="#fff" stroke-opacity=".28" stroke-width="${1.4 + k * 0.5}"/>`).join('')}
    <g stroke="#ffd23d" stroke-width="${4.5 * size}" stroke-linecap="round" fill="none"><line x1="170" x2="170" y1="${barY}" y2="156"/><line x1="${170 - hw}" x2="${170 + hw}" y1="${barY}" y2="${barY}"/><line x1="${170 - hw}" x2="${170 - hw}" y1="${barY}" y2="${postTop}"/><line x1="${170 + hw}" x2="${170 + hw}" y1="${barY}" y2="${postTop}"/></g>
    <g opacity=".95"><line x1="170" y1="${barY - 26 * size}" x2="${170 + drift * hw}" y2="${barY - 26 * size}" stroke="#35e0ff" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 7"/>${mph ? `<path d="M${170 + drift * hw} ${barY - 26 * size} l${-dir * 9} -6 v12z" fill="#35e0ff"/>` : ''}<text x="170" y="${barY - 34 * size}" text-anchor="middle" font-size="10" fill="#35e0ff" font-family="Barlow Condensed, sans-serif" letter-spacing=".1em">${mph ? 'WIND PUSH' : 'NO WIND'}</text></g>
    <g transform="translate(298 54)"><line x1="0" y1="0" x2="0" y2="52" stroke="#ddd" stroke-width="3"/><path class="mg-flag" d="M0 2 L${dir * 30} ${5 + Math.abs(flagA) * 0.05} L0 20 Z" fill="${T2}" stroke="#fff" stroke-width="1"/><text y="68" text-anchor="middle" font-size="12" font-weight="800" fill="#fff" font-family="Barlow Condensed, sans-serif">${mph ? `${dir < 0 ? '◀ ' : ''}${mph} MPH${dir > 0 ? ' ▶' : ''}` : 'DOME'}</text></g>
    <text x="42" y="86" text-anchor="middle" font-size="30" font-weight="800" fill="#fff" font-family="Barlow Condensed, sans-serif">${dist}</text><text x="42" y="100" text-anchor="middle" font-size="10" fill="#fff" fill-opacity=".7" letter-spacing=".15em" font-family="Barlow Condensed, sans-serif">YD FG</text>
    ${streaks}${weather}
    <g id="mgAim" ${sc.shaky ? 'class="mg-shaky"' : ''}><line id="mgAimL" x1="${bx}" y1="268" x2="170" y2="150" stroke="#ffd23d" stroke-width="2" stroke-dasharray="5 5"/><circle id="mgAimC" cx="170" cy="150" r="7" fill="none" stroke="#ffd23d" stroke-width="2.5"/></g>
    <g id="mgBallG">${mgBall(bx, 268, 1.5, 0, 'mgBallEl')}</g><g id="mgFx"></g></svg><div class="mg-me kick">${ctx.env.jersey ? ctx.env.jersey('back') : ''}</div><div class="mg-call">${sc.name} · ${i + 1}/5</div>`;
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
        const lateral = aim * 2 + drift + shake + (rnd() - 0.5) * 0.22 * (1 + 3 * perr) + (p < pT ? -0.1 : 0.1) * perr * 2, wide = Math.abs(lateral) > 0.92, short = p < pT - 0.2, over = p > pT + 0.2, ok = !wide && !short && !over;
        const perfect = ok && Math.abs(lateral) < 0.3 && perr < z / 2;
        Snd.play('mgKick', 0);
        const ball = ctx.stage.querySelector('#mgBallEl'), tEnd = short ? 0.62 : 1, dur = 1100, f0 = performance.now(), landX = 170 + lateral * hw;
        await new Promise(r2 => { const step = () => { if (!ctx.alive()) return r2(); const k = Math.min(1, (performance.now() - f0) / dur), t = k * tEnd; const x = bx + (landX - bx) * t, y = 268 - (268 - 118) * t - Math.sin(Math.PI * t) * 46, s = 1.5 - 1.15 * t; ball.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(k * 540).toFixed(0)}) scale(${s.toFixed(2)})`); if (k < 1) requestAnimationFrame(step); else r2(); }; step(); });
        if (!ctx.alive()) return res(false);
        let txt;
        if (ok) { txt = `${dist}-YARD FIELD GOAL IS GOOD!`; mgPop(ctx, 170, 96, perfect ? 'PERFECT!' : 'GOOD!', 'good'); if (perfect) { ctx.perfects++; txt = '✨ PERFECT KICK! ' + txt; } Snd.play('td', 0.15); mgShake(ctx); }
        else { const why = short ? 'SHORT' : wide ? (lateral < 0 ? 'WIDE LEFT' : 'WIDE RIGHT') : 'OVER'; txt = `No good — ${why.toLowerCase()}`; mgPop(ctx, 170, 96, why, 'bad'); }
        const tip = wide ? '<span class="mg-tip">The wind pushed it — aim against the arrow.</span>' : (short || over) ? '<span class="mg-tip">Stop the bar inside the green.</span>' : '';
        ctx.say(`${ok ? '✅' : '❌'} ${txt}${tip}`, ok ? 'good' : 'bad'); res(ok);
      };
      ctx.ov.querySelector('#mgStop').addEventListener('pointerdown', stop, { once: true }); ctx.stage.addEventListener('pointerdown', stop);
    }, { once: true });
  });
}

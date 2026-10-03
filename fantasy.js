/* =====================================================================
   FANTASY PRESEASON — every NFL season opens with a draft-day screen: where fantasy managers rank you at your position, your ADP
   (average draft position) in a 12-team PPR league and the round you go in, drawn on an animated snake-draft board filled with
   the real ADP list of that year (fantasy-adp.js: real fantasyfootballcalculator.com snapshots; the browser can't call that API
   live because it sends no CORS headers, so the data is bundled).
   How you are valued: your projected points (simulated with the game's own stat engine) blended with last season's output, plus
   rookie draft-capital hype, mapped to a positional rank through the game's own fantasy scale; that rank picks a real ADP slot.
   ===================================================================== */
const FF_COL = { QB: '#ff2a6d', RB: '#00ceb8', WR: '#58a7ff', TE: '#ffae58', K: '#c471ed', DEF: '#b8a089', DL: '#e08a4a', LB: '#e08a4a', CB: '#e08a4a', S: '#e08a4a', OL: '#9aa6c0' };
const FF_TEAMS = 12, FF_ROUNDS = 15;
const ffAnchors = pos => {
  const c = POS[pos], a = c.awd, raw = [[1, a.lead * 1.04], [3, a.ap1], [6, a.ap2], [12, a.pb], [24, c.bench * 1.08], [36, c.bench * 0.88], [60, c.bench * 0.64], [100, c.bench * 0.46], [160, c.bench * 0.3]];
  for (let i = 1; i < raw.length; i++) raw[i][1] = Math.min(raw[i][1], raw[i - 1][1] * 0.985);    // always strictly falling
  return raw;
};
// points per game -> position rank (1 = best), log-interpolated between the anchors of the game's own fantasy scale
function ffRankOf(pos, ppg) {
  const A = ffAnchors(pos);
  if (ppg >= A[0][1]) return 1;
  for (let i = 1; i < A.length; i++) {
    if (ppg >= A[i][1]) { const t = (A[i - 1][1] - ppg) / (A[i - 1][1] - A[i][1]); return Math.exp(Math.log(A[i - 1][0]) + t * (Math.log(A[i][0]) - Math.log(A[i - 1][0]))); }
  }
  const L = A[A.length - 1]; return Math.min(260, L[0] + (L[1] - ppg) / Math.max(0.2, L[1]) * 240);
}
// rank -> average draft position. QB/RB/WR/TE/K use the real list of that year; defenders are IDP-league picks; linemen are not draftable
function ffAdpOf(pos, rank, year) {
  const real = ['QB', 'RB', 'WR', 'TE', 'K'].includes(pos);
  if (real) {
    const arr = FF_ADP[year].filter(p => p[1] === pos).map(p => p[3]).sort((a, b) => a - b), n = arr.length;
    if (rank >= n) return arr[n - 1] + (rank - n + 1) * 3.4;
    const i = Math.max(0, Math.floor(rank) - 1), f = rank - Math.floor(rank);
    return arr[i] + (arr[Math.min(n - 1, i + 1)] - arr[i]) * (rank < 1 ? 0 : f);
  }
  if (pos === 'OL') return null;
  const pts = [[1, 64], [6, 92], [12, 112], [24, 150], [36, 178], [60, 230]];                    // IDP leagues: defenders go in rounds 6-15
  for (let i = 1; i < pts.length; i++) if (rank <= pts[i][0]) return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * (rank - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
  return 240;
}
const ffPickLabel = adp => { const p = Math.max(1, Math.round(adp)), r = Math.ceil(p / FF_TEAMS); return `${r}.${String(((p - 1) % FF_TEAMS) + 1).padStart(2, '0')}`; };

// the game's own stat engine, run 120 times for an average game of this player on this team
function ffProject(se) {
  const P = S.player, pos = P.pos, cfg = POS[pos], slot = curSlot(se), sk = skillOf(P.ovr), N = 120;
  const base = effRating(se, true); let tot = 0;
  for (let k = 0; k < N; k++) {
    const diff = base - gauss(72, 5), gsc = clamp(diff * 0.0035, -0.08, 0.08);
    const pass = clamp(Math.round(gauss(34.5 * (1 - gsc) * (se.style || 1), 5.2)), 20, 54);
    const c = { pos, s: sk, z: clamp((sk - 0.5) / 0.5, -1, 1), slot, mult: 1, form: 1, tg: { pass, rush: clamp(Math.round(gauss(27 + gsc * 30 - 0.3 * (pass - 34.5), 4)), 14, 42) },
      ym: clamp(1 + diff * 0.004, 0.88, 1.12), tm: clamp(1 + diff * 0.006, 0.85, 1.15), matchup: clamp(1 + diff * 0.006, 0.8, 1.2), a: n => clamp((P.attrs[n] - 40) / 55, 0, 1), pts: clamp(Math.round(gauss(22.5 + diff * 0.225, 8.2)), 3, 56), snap: snapShare(pos, slot) };
    tot += fantasyPts(pos, cfg.gen(c));
  }
  const avail = atSlot(PLAYP, pos, slot) * (1 - INJ_BASE[pos] * 17 * 2.2), ppg = tot / N;
  return { ppg, avail, season: ppg * 17 * avail };
}
function ffEvaluate(se) {
  const P = S.player, pos = P.pos, proj = ffProject(se), prev = S.seasons.filter(x => x !== se && x.complete && x.teamId).slice(-1)[0];
  let lastPPG = null;
  if (prev) { const T = seasonTotals(prev); if (T.gp >= 6) lastPPG = T.ppg; }
  const trueRank = ffRankOf(pos, proj.ppg * (0.88 + 0.12 * proj.avail));
  let perceived = lastPPG == null ? proj.ppg : proj.ppg * 0.6 + lastPPG * 0.4;
  let rank = ffRankOf(pos, perceived * (0.88 + 0.12 * proj.avail));
  if (!prev && S.draft && !S.draft.undrafted) rank *= S.draft.round === 1 ? 0.8 : S.draft.round === 2 ? 0.92 : S.draft.round >= 5 ? 1.2 : 1;     // rookie hype follows draft capital
  rank = clamp(rank * Math.exp(gauss(0, 0.07)), 1, 260);
  const years = Object.keys(FF_ADP).map(Number), year = years[(Math.max(0, S.seasons.indexOf(se)) + 6) % years.length];      // cycles the real ADP years: 2025, 2019, 2020...
  let adp = ffAdpOf(pos, rank, year); if (adp != null) adp = Math.min(adp, 999);
  const lastRank = lastPPG == null ? null : Math.round(ffRankOf(pos, lastPPG));
  const undrafted = adp != null && adp > FF_TEAMS * FF_ROUNDS;
  return { year, pos, rank: Math.min(99, Math.max(1, Math.round(rank))), trueRank: Math.min(99, Math.round(trueRank)), adp, undrafted, adpYear: year, proj: proj.ppg, projSeason: proj.season, lastRank: lastRank == null ? null : Math.min(99, lastRank), lastPPG, label: adp == null || undrafted ? null : ffPickLabel(adp), round: adp == null || undrafted ? null : Math.ceil(Math.round(adp) / FF_TEAMS) };
}

// the board: a full snake draft simulated by 12 managers that follow the real ADP list, but draft like people do (roster needs, QBs and TEs once,
// kickers and defenses at the end, a bit of noise), with you taken at your ADP
function ffBoard(F) {
  const N = FF_TEAMS, R = FF_ROUNDS, total = N * R, P = S.player;
  const avail = FF_ADP[F.year].map(p => ({ n: p[0], pos: p[1], tm: p[2], adp: p[3] })).sort((x, y) => x.adp - y.adp);
  const mePick = F.adp != null && !F.undrafted ? clamp(Math.round(F.adp), 1, total) : 0;
  const me = { n: P.name, pos: P.pos, tm: S.teamId, adp: F.adp == null ? 9999 : F.adp, me: true };
  const teams = Array.from({ length: N }, () => ({ QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 })), cells = [];
  const fits = (p, T, round) => {
    if (p.pos === 'QB') return T.QB === 0 || (T.QB === 1 && round >= 9 && rnd() < 0.5);                 // one QB, maybe a backup late
    if (p.pos === 'TE') return T.TE === 0 || (T.TE === 1 && round >= 10 && rnd() < 0.4);
    if (p.pos === 'K') return T.K === 0 && round >= 13;
    if (p.pos === 'DEF') return T.DEF === 0 && round >= 11;
    return T[p.pos] < 6;
  };
  for (let pick = 1; pick <= total; pick++) {
    const round = Math.ceil(pick / N), k = (pick - 1) % N, ti = round % 2 ? k : N - 1 - k, T = teams[ti];
    let choice;
    if (mePick && pick === mePick) choice = me;
    else {
      const pool = []; for (const p of avail) { if (fits(p, T, round)) pool.push(p); if (pool.length >= 8) break; }
      // late rounds: a team still without a kicker / defense takes one
      const need = round >= 14 && T.K === 0 ? pool.find(x => x.pos === 'K') || avail.find(x => x.pos === 'K') : round >= 13 && T.DEF === 0 ? pool.find(x => x.pos === 'DEF') || avail.find(x => x.pos === 'DEF') : null;
      if (need && rnd() < 0.7) choice = need;
      else { const w = pool.map((_, i) => Math.exp(-i * 0.55)); let r = rnd() * w.reduce((x, y) => x + y, 0), i = 0; for (; i < pool.length - 1; i++) { r -= w[i]; if (r <= 0) break; } choice = pool[i] || avail[0]; }
    }
    if (!choice) break;
    if (!choice.me) avail.splice(avail.indexOf(choice), 1);
    teams[ti][choice.pos] = (teams[ti][choice.pos] || 0) + 1;
    cells.push({ ...choice, pick, team: ti, row: round - 1, col: ti });
  }
  const idx = cells.findIndex(c => c.me);
  return { cells, mine: idx >= 0 ? cells[idx] : null, idx, list: avail };
}
const ffShort = n => { const w = String(n).split(' ').filter(x => !/^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(x)); return (w[w.length - 1] || n).replace(/[^A-Za-z'’.-]/g, '').slice(0, 10); };
const ffOrd = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

function ffPreseason(se, reuse) {
  return new Promise(resolve => {
    let F; try { F = reuse && se.fantasy ? se.fantasy : ffEvaluate(se); } catch (e) { console.warn('fantasy', e); return resolve(); }
    se.fantasy = F; saveGame();
    const B = ffBoard(F), P = S.player, pos = P.pos, t = TEAM[S.teamId], col = FF_COL[pos] || '#c5ff3a';
    const nb = B.idx >= 0 ? B.cells[B.idx - 1] : null, na = B.idx >= 0 ? B.cells[B.idx + 1] : null;
    const idp = !['QB', 'RB', 'WR', 'TE', 'K'].includes(pos);
    const trend = F.lastRank == null ? (S.seasons.length === 1 ? '🆕 ROOKIE' : '') : (F.rank < F.lastRank ? `▲ up from ${pos}${F.lastRank}` : F.rank > F.lastRank ? `▼ down from ${pos}${F.lastRank}` : `● same as last year`);
    const when = F.adp == null ? `<b>Not draftable</b><span>linemen aren't in fantasy leagues</span>` : F.undrafted ? `<b>Undrafted</b><span>a waiver-wire pickup</span>` : `<b>Round ${F.round}</b><span>pick ${F.label} · ADP ${F.adp.toFixed(1)}</span>`;
    const ov = document.createElement('div'); ov.className = 'ff-overlay'; ov.style.cssText = themeVars(S.teamId);
    ov.innerHTML = `<div class="ff-wrap">
      <div class="ff-top"><span class="ff-tag">📊 FANTASY DRAFT DAY</span><button class="mini" id="ffSkip">SKIP ▸</button></div>
      <h2 class="ff-h">${se.year} FANTASY BOARD</h2><div class="ff-sub">12-team PPR · ADP of the ${F.year} real-life drafts${idp ? ' · IDP league' : ''}</div>
      <div class="ff-hero">
        <div class="ff-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="bg"/><circle cx="60" cy="60" r="52" class="fg" id="ffArc" style="stroke:${col}"/></svg>
          <div class="ff-rank"><small>${pos}</small><b id="ffRank">${F.rank}</b><em>${esc(trend)}</em></div></div>
        <div class="ff-facts">
          <div class="ff-fact"><span>FANTASY RANK</span><b>${pos} ${F.rank >= 99 ? '99+' : '#' + F.rank}</b><small>${F.adp == null || F.undrafted ? 'among ' + pos + 's' : `~#${B.idx + 1} overall`}</small></div>
          <div class="ff-fact gold"><span>DRAFTED ON AVERAGE</span>${when}</div>
          <div class="ff-fact"><span>PROJECTION</span><b>${fmt1(F.proj)} PPG</b><small>${Math.round(F.projSeason)} pts on the season</small></div>
        </div>
      </div>
      <div class="ff-ticker" id="ffTicker">Draft room is open…</div>
      <div class="ff-bwrap" id="ffBWrap"><div class="ff-board" id="ffBoard">${Array.from({ length: FF_TEAMS * FF_ROUNDS }, (_, i) => `<div class="ff-c" data-i="${i}"><em>${ffPickLabel(Math.floor(i / FF_TEAMS) % 2 ? (Math.floor(i / FF_TEAMS) + 1) * FF_TEAMS - (i % FF_TEAMS) : Math.floor(i / FF_TEAMS) * FF_TEAMS + (i % FF_TEAMS) + 1)}</em></div>`).join('')}</div></div>
      <div class="ff-leg">${['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map(k => `<span><i style="background:${FF_COL[k]}"></i>${k}</span>`).join('')}<span><i class="you"></i>YOU</span></div>
      <div class="ff-near" id="ffNear">${B.idx >= 0 ? `Managers take <b>${esc(ffShort(nb ? nb.n : ''))}</b> right before you and <b>${esc(ffShort(na ? na.n : ''))}</b> right after.` : ''}</div>
      <div class="ff-actions"><button class="btn btn-primary btn-xl" id="ffGo">TO THE SEASON ▸</button></div>
    </div>`;
    document.body.appendChild(ov);
    const cells = ov.querySelectorAll('.ff-c'), tick = ov.querySelector('#ffTicker'), arc = ov.querySelector('#ffArc'), rk = ov.querySelector('#ffRank');
    const C = 2 * Math.PI * 52; arc.style.strokeDasharray = C; arc.style.strokeDashoffset = C;
    const bw = ov.querySelector('#ffBWrap');
    const nameParts = n => { const w = String(n).trim().split(/\s+/); return w.length > 1 ? [w[0], w.slice(1).join(' ')] : ['', w[0] || '']; };
    const place = (i, instant) => {
      const c = B.cells[i], el = ov.querySelector(`.ff-c[data-i="${c.row * FF_TEAMS + c.col}"]`); if (!el) return;
      const [fn, ln] = nameParts(c.n), col2 = FF_COL[c.pos] || '#8a95a8';
      el.className = 'ff-c on' + (c.me ? ' me' : ''); el.style.setProperty('--pc', col2);
      el.innerHTML = `<em>${ffPickLabel(c.pick)}</em><small>${esc(fn)}</small><b>${esc(ln)}</b><i>${c.pos === 'DEF' ? 'DEF' : c.pos} - ${c.me ? TEAM[S.teamId].id : esc(c.tm)}</i>`;
      if (!instant) { tick.innerHTML = `<b>${ffPickLabel(c.pick)}</b> ${c.me ? '<span class="gold">YOU — ' + esc(P.name) + '</span>' : esc(c.n)} <small>${c.pos} · ${c.tm}</small>` }
    };
    let done = false, alive = true;
    const finish = () => {
      if (done) return; done = true;
      B.cells.forEach((_, i) => place(i, true));
      const target = Math.min(60, F.rank); rk.textContent = F.rank; arc.style.transition = 'none'; arc.style.strokeDashoffset = C * (1 - clamp(1 - (Math.log(F.rank) / Math.log(60)), 0.06, 1) * 0.94);
      if (B.idx >= 0) tick.innerHTML = `<b>${F.label}</b> <span class="gold">YOU — ${esc(P.name)}</span> <small>${pos} · ${t.id}</small>`;
    };
    ov.querySelector('#ffSkip').addEventListener('click', () => { alive = false; finish(); });
    ov.querySelector('#ffGo').addEventListener('click', () => { alive = false; ov.classList.add('out'); setTimeout(() => { ov.remove(); resolve(); }, 380); });
    (async () => {
      Snd.play('whoosh', 0.1);
      // the rank dial falls into place while the board fills
      const frac = clamp(1 - Math.log(F.rank) / Math.log(60), 0.06, 1) * 0.94;
      arc.style.transition = 'stroke-dashoffset 2.4s cubic-bezier(.2,.7,.2,1)'; requestAnimationFrame(() => { arc.style.strokeDashoffset = C * (1 - frac); });
      countUp(rk, Math.min(99, F.rank + 40), F.rank, 2400);
      const upTo = B.idx >= 0 ? B.idx : B.cells.length;
      for (let i = 0; i < B.cells.length && alive; i++) {
        if (i === B.idx) {                                                      // your pick: hold the room for a beat
          await sleep(420); if (!alive) break; place(i); Snd.play('cheer', 0, 1); Snd.play('up', 0.1); burst(ov.querySelector('.ff-board'), 44); await sleep(900); continue;
        }
        place(i);
        const near = B.idx >= 0 && i > B.idx - 6 && i < B.idx;
        await sleep(near ? 95 + (B.idx - i) * 0 : i < upTo ? 16 : 6);
        if (i % 12 === 0 && i < upTo && !near) Snd.play('tick', 0, 0);
      }
      if (alive) finish();
    })();
  });
}

// small lines for the dashboard and the end-of-season summary
function ffDashLine(se, T) {
  const F = se.fantasy; if (!F) return '';
  const now = T.gp >= 2 ? Math.min(99, Math.round(ffRankOf(S.player.pos, T.ppg))) : null;
  return `<div class="ff-line">📊 <span>Fantasy: <b>${F.pos}${now ? ' #' + now : ''}</b>${now ? ' now' : ''} · preseason ADP ${F.label || '—'} (${F.pos} ${F.rank >= 99 ? '99+' : '#' + F.rank})</span><button class="mini" data-act="viewFantasy">BOARD</button></div>`;
}
function ffSummaryHTML(se, T) {
  const F = se.fantasy; if (!F || T.gp < 4) return '';
  const fin = Math.min(99, Math.round(ffRankOf(F.pos, T.ppg))), d = F.rank - fin;
  return `<section class="card ff-sum"><div class="eyebrow">FANTASY FINISH</div><div class="ff-sum-row"><div><b>${F.pos}${fin}</b><span>finished</span></div><div class="${d > 0 ? 'good' : d < 0 ? 'bad' : ''}"><b>${d > 0 ? '+' + d : d < 0 ? d : '±0'}</b><span>vs ${F.pos}${F.rank} draft rank</span></div><div><b>${F.label || '—'}</b><span>ADP</span></div></div>
    <div class="muted center">${d >= 6 ? 'Huge value: you were a league-winner for anyone who drafted you. 🏆' : d > 0 ? 'You beat your draft price.' : d <= -6 ? 'A bust compared with where you were drafted.' : d < 0 ? 'A bit under your draft price.' : 'Exactly what managers paid for.'}</div></section>`;
}
Object.assign(actions, { viewFantasy: () => { const se = curSeason(); if (se && se.fantasy) { ffPreseason(se, true); } } });

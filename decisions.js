/* =====================================================================
   CAREER DECISIONS — every 3-5 games the season asks you for a choice (two options, each with a risk).
   They depend on how the season is going: an injury, a bad streak, a hot streak (sponsors), the mood of the locker room…
   Three meters (confidence, condition, chemistry) tie everything to the game engine; training choices feed the offseason development.
   State lives inside the season object (season.m, season.buffs, season.pending, season.train), so it saves with the career.
   ===================================================================== */
const DEC_BASE = { conf: 50, fit: 75, chem: 50 };
const decMeters = se => (se.m = se.m || { conf: 50, fit: 75, chem: 50 });
const m100 = v => clamp(Math.round(v), 0, 100);
// saves from before the decisions existed: fill in whatever is missing
function decEnsure(se) {
  decMeters(se); se.buffs = se.buffs || []; se.decLog = se.decLog || []; se.train = se.train || { phys: 0, ment: 0 };
  se.injExtra = se.injExtra || 0; se.sponsor = se.sponsor || 0; if (se.decIn == null) se.decIn = randInt(3, 5); if (se.sinceDec == null) se.sinceDec = 0;
  return se;
}

// seed the meters of a new season from the previous one (they drift back toward the baseline during the offseason)
function decInitSeason(season, prev) {
  const m = prev && prev.m ? prev.m : null;
  season.m = m ? { conf: m100(DEC_BASE.conf + (m.conf - DEC_BASE.conf) * 0.5), fit: m100(DEC_BASE.fit + (m.fit - DEC_BASE.fit) * 0.3), chem: m100(DEC_BASE.chem + (m.chem - DEC_BASE.chem) * 0.5) } : { conf: 50, fit: 75, chem: season.rookie ? 40 : 50 };
  season.buffs = []; season.pending = null; season.decLog = []; season.decIn = randInt(3, 5); season.sinceDec = 0;
  season.train = { phys: 0, ment: 0 }; season.injExtra = 0; season.sponsor = 0;
}

// what the meters and the active effects do to the game engine
function decMods(se) {
  const m = decMeters(se); let perf = 1 + (m.conf - 50) * 0.0016, inj = clamp(1 + (65 - m.fit) * 0.012, 0.6, 1.7), team = (m.chem - 50) * 0.07;
  (se.buffs || []).forEach(b => { if (b.left > 0) { perf *= 1 + (b.perf || 0); inj *= b.inj || 1; team += b.team || 0; } });
  return { perf, inj, team };
}

// after every game: update the meters, age the effects, and maybe open a decision
function decAfterGame(se, game, notes) {
  decEnsure(se); const m = se.m;
  (se.buffs || []).forEach(b => { b.left--; }); se.buffs = (se.buffs || []).filter(b => b.left > 0);
  if (game.st === 'OUT') { m.conf = m100(m.conf - 0.5); m.fit = m100(m.fit + 3 + (75 - m.fit) * 0.08); }
  else { m.conf = m100(m.conf + [-5, -3, -1, 1, 3, 5][game.rate] + (game.w ? 1 : -1)); m.fit = m100(m.fit - 1.5 + (75 - m.fit) * 0.08); }
  if (game.hurt) m.fit = m100(m.fit - 10);
  m.chem = m100(m.chem + (game.w ? 1 : -1));
  if (game.k !== 'REG' || se.status !== 'regular' || se.pending) return;
  se.sinceDec = (se.sinceDec || 0) + 1;
  const left = se.schedule.length - se.games.length;
  let type = null;
  if (game.hurt && game.hurt.weeks >= 2 && left >= 2) type = 'injury';
  else if (se.sinceDec >= (se.decIn || 4) && left >= 2) type = decPick(se);
  if (!type) return;
  se.pending = { type, wk: game.wk, ctx: decCtx(se, type, game) };
  notes.push('🎯 DECISION — the season needs a call from you.');
}

const decRecent = (se, n) => se.games.filter(g => g.st !== 'OUT').slice(-n);
function decPick(se) {
  const last = (se.decLog || []).slice(-1)[0], recent = decRecent(se, 2), rec3 = decRecent(se, 3), done = t => (se.decLog || []).filter(x => x.type === t).length;
  const slump = (recent.length === 2 && recent.every(g => g.rate <= 1)) || (se.games.slice(-3).length === 3 && se.games.slice(-3).every(g => !g.w));
  if (slump && !(last && last.type === 'slump')) return 'slump';
  const hot = rec3.length >= 2 && rec3.reduce((a, g) => a + g.rate, 0) / rec3.length >= 3.2;
  const w = { training: done('training') >= 2 ? 0.4 : 3, sponsor: hot && done('sponsor') < 2 ? 3.5 : 0, leader: done('leader') >= 2 ? 0.5 : 2.5 };
  if (last) w[last.type] = 0;
  const tot = Object.values(w).reduce((a, b) => a + b, 0); if (tot <= 0) return 'training';
  let r = rnd() * tot; for (const k of Object.keys(w)) { r -= w[k]; if (r <= 0) return k; }
  return 'training';
}
function decCtx(se, type, game) {
  const P = S.player;
  if (type === 'injury') return { name: game.hurt.name, weeks: se.injury ? se.injury.weeksLeft : game.hurt.weeks };
  if (type === 'slump') { const lost3 = se.games.slice(-3).length === 3 && se.games.slice(-3).every(g => !g.w); return { why: lost3 ? 'team' : 'perf' }; }
  if (type === 'sponsor') return { base: r1(clamp((P.ovr - 55) * 0.09, 0.4, 4.5) * (P.pos === 'QB' ? 1.5 : P.pos === 'K' ? 0.4 : 1)) };
  if (type === 'leader') { const w = recOf(se).w, g = se.games.length; return { mood: w / Math.max(1, g) >= 0.5 ? 'win' : 'lose', odds: decLeaderOdds(se) }; }
  return {};
}
function decLeaderOdds(se) {
  const P = S.player, m = decMeters(se), rec3 = decRecent(se, 3), form = rec3.length ? rec3.reduce((a, g) => a + g.rate, 0) / rec3.length : 2.5;
  return clamp(Math.round(48 + (m.conf - 50) * 0.35 + (se.rookie ? -14 : 6) + (form - 2.5) * 6 + (P.ovr - 75) * 0.25), 20, 85);
}

/* ---------- the decisions ---------- */
const DEC = {
  injury: c => ({
    icon: '🩹', title: 'INJURY — RECOVERY PLAN', text: `You are out with <b>${esc(c.name)}</b> (${c.weeks} more week${c.weeks > 1 ? 's' : ''}). How do you handle the recovery?`,
    opts: [
      { k: 'A', icon: '⚡', label: 'RUSH BACK', desc: `Play as soon as the doctors allow it: about 40% less time on the sideline.`, risk: '30% chance of a setback: +2 weeks out and some lasting athleticism lost' },
      { k: 'B', icon: '🧊', label: 'FULL REHAB', desc: 'Follow the medical plan to the letter. Fitness back up and a lower injury risk for a month.', risk: '25% chance the coaches give your spot to a teammate while you are away' },
    ],
  }),
  slump: c => ({
    icon: '📉', title: 'BAD STREAK', text: c.why === 'team' ? 'Three losses in a row. The locker room is tense and everyone looks at you. What is your answer?' : 'Two rough games in a row. The crowd and the media are asking questions. What do you do?',
    opts: [
      { k: 'A', icon: '🎞️', label: 'STUDY FILM, PLAY SAFE', desc: 'Back to basics for the next 3 games: fewer mistakes, small boost.', risk: '75% it works (+6% performance, confidence up) · 25% you overthink it (−4%)' },
      { k: 'B', icon: '🔥', label: 'PLAY LOOSE, GO BIG', desc: 'Trust your instincts and force big plays for the next 3 games.', risk: '50/50 · big swing: +12% and a huge confidence boost, or −8%' },
    ],
  }),
  training: () => ({
    icon: '🏋️', title: 'TRAINING PLAN', text: 'The coaches give you a free hand for the next practice block. Where do you put the work? It also shapes how you develop in the offseason.',
    opts: [
      { k: 'A', icon: '💪', label: 'POWER & SPEED CAMP', desc: 'Physical attributes grow more in the offseason (+1) and your fitness goes up.', risk: 'Your body pays for it: +30% injury risk for the next 4 games' },
      { k: 'B', icon: '🧠', label: 'FILM & TECHNIQUE', desc: 'Mental attributes grow more in the offseason (+1) and +3% performance for 3 games.', risk: 'You neglect conditioning: fitness −8 and physical attributes grow a bit less (−0.5)' },
    ],
  }),
  sponsor: c => ({
    icon: '💼', title: 'SPONSORSHIP OFFERS', text: 'You are playing great and brands are calling. Two offers are on the table.',
    opts: [
      { k: 'A', icon: '🌎', label: 'NATIONAL CAMPAIGN', desc: `${money(r1(c.base * 2.2))} for a national ad deal. Fame and money.`, risk: '45% chance the shoots and interviews distract you (−5% performance for 4 games, chemistry −3)' },
      { k: 'B', icon: '🏪', label: 'LOCAL DEAL', desc: `${money(c.base)} with a local brand. Fans and teammates love it.`, risk: '25% chance the sponsor cuts the contract short and you only get half' },
    ],
  }),
  leader: c => ({
    icon: '🗣️', title: 'LEADERSHIP IN THE LOCKER ROOM', text: c.mood === 'win' ? 'The team is rolling and the vets look at you with respect. Time to decide what kind of teammate you are.' : 'The team is struggling and someone has to say something. The room is waiting.',
    opts: [
      { k: 'A', icon: '📢', label: 'TAKE THE LOCKER ROOM', desc: 'Give the speech. If it lands, the whole team plays better for the next 5 games.', risk: `~${c.odds}% it lands (chemistry +12, team +2) · otherwise the vets resent it (chemistry −8, confidence −5)` },
      { k: 'B', icon: '🤫', label: 'LEAD BY EXAMPLE', desc: 'Work quietly and let your play talk. Small, steady gain in chemistry and confidence.', risk: '25% a veteran puts you in your place (confidence −3)' },
    ],
  }),
};

/* ---------- resolution ---------- */
function decResolve(se, key) {
  const p = se.pending; if (!p) return null;
  decEnsure(se);
  const m = decMeters(se), P = S.player, c = p.ctx || {}, out = { good: true, lines: [], head: '' };
  const addBuff = (left, o) => se.buffs.push({ left, ...o });
  const L = t => out.lines.push(t);
  if (p.type === 'injury') {
    if (key === 'A') {
      const w = se.injury ? se.injury.weeksLeft : 0;
      if (se.injury) se.injury.weeksLeft = Math.max(1, Math.round(w * 0.6));
      if (rnd() < 0.3) { if (se.injury) se.injury.weeksLeft += 2; se.injExtra = (se.injExtra || 0) + 2; m.conf = m100(m.conf - 4); out.good = false; out.head = 'SETBACK'; L('You pushed too hard and felt it again. Two more weeks out, and your body will not be the same.'); }
      else { m.conf = m100(m.conf + 5); out.head = 'BACK EARLY'; L(`The doctors clear you ahead of schedule: ${se.injury ? se.injury.weeksLeft : 0} week${se.injury && se.injury.weeksLeft === 1 ? '' : 's'} to go. Confidence +5.`); }
    } else {
      m.fit = m100(m.fit + 15); addBuff(4, { inj: 0.85, label: 'Rehab' });
      if (rnd() < 0.25 && se.depth && se.depth.slot < (DEPTH[P.pos].n || 1) && P.pos !== 'K') { se.depth.slot++; se.role = curRoleKey(se); m.chem = m100(m.chem - 2); out.good = false; out.head = 'LOST YOUR SPOT'; L(`You followed the plan, but while you were away the coaches moved you down to ${slotLabel(P.pos, se.depth.slot)}.`); }
      else { out.head = 'PATIENCE PAYS'; L('You trust the process. Fitness +15 and a lower injury risk for the next 4 games.'); }
    }
  } else if (p.type === 'slump') {
    const r = rnd();
    if (key === 'A') {
      if (r < 0.75) { addBuff(3, { perf: 0.06, label: 'Film study' }); m.conf = m100(m.conf + 5); out.head = 'BACK ON TRACK'; L('The film study pays off. +6% performance for 3 games, confidence +5.'); }
      else { addBuff(3, { perf: -0.04, label: 'Overthinking' }); m.conf = m100(m.conf - 2); out.good = false; out.head = 'OVERTHINKING'; L('You think too much on the field. −4% performance for 3 games.'); }
    } else {
      if (r < 0.5) { addBuff(3, { perf: 0.12, label: 'Playing loose' }); m.conf = m100(m.conf + 10); out.head = 'SWAGGER'; L('You play free and it shows. +12% performance for 3 games, confidence +10.'); }
      else { addBuff(3, { perf: -0.08, label: 'Forcing it' }); m.conf = m100(m.conf - 6); out.good = false; out.head = 'FORCING IT'; L('You force plays that are not there. −8% performance for 3 games, confidence −6.'); }
    }
  } else if (p.type === 'training') {
    if (key === 'A') { se.train.phys = Math.min(2, se.train.phys + 1); m.fit = m100(m.fit + 5); addBuff(4, { inj: 1.3, label: 'Heavy load' }); out.head = 'POWER CAMP'; L('Physical attributes get +1 extra in the offseason. Fitness +5, but injury risk is up 30% for 4 games.'); }
    else { se.train.ment = Math.min(2, se.train.ment + 1); se.train.phys -= 0.5; m.fit = m100(m.fit - 8); addBuff(3, { perf: 0.03, label: 'Technique work' }); out.head = 'FILM & TECHNIQUE'; L('Mental attributes get +1 extra in the offseason, +3% performance for 3 games. Fitness −8.'); }
  } else if (p.type === 'sponsor') {
    if (key === 'A') {
      const amt = r1(c.base * 2.2); S.earnings += amt; se.sponsor += amt;
      if (rnd() < 0.45) { addBuff(4, { perf: -0.05, label: 'Distracted' }); m.chem = m100(m.chem - 3); out.good = false; out.head = 'DISTRACTED'; L(`${money(amt)} in the bank, but the shoots and interviews pull you away from the game: −5% performance for 4 games, chemistry −3.`); }
      else { m.conf = m100(m.conf + 4); out.head = 'MARKETABLE'; L(`${money(amt)} and a national spotlight. Confidence +4.`); }
    } else {
      const half = rnd() < 0.25, amt = r1(c.base * (half ? 0.5 : 1)); S.earnings += amt; se.sponsor += amt;
      if (half) { out.good = false; out.head = 'DEAL CUT SHORT'; L(`The sponsor pulls out halfway. You only collect ${money(amt)}.`); }
      else { m.conf = m100(m.conf + 2); m.chem = m100(m.chem + 2); out.head = 'FAN FAVORITE'; L(`${money(amt)} and goodwill in the city. Confidence +2, chemistry +2.`); }
    }
  } else if (p.type === 'leader') {
    if (key === 'A') {
      if (rnd() * 100 < c.odds) { m.chem = m100(m.chem + 12); m.conf = m100(m.conf + 5); addBuff(5, { team: 2, label: 'Locker room fired up' }); out.head = 'THE ROOM FOLLOWS YOU'; L('Your words land. Chemistry +12 and the team plays better for the next 5 games.'); }
      else { m.chem = m100(m.chem - 8); m.conf = m100(m.conf - 5); out.good = false; out.head = 'IT BACKFIRES'; L('The vets resent being lectured. Chemistry −8, confidence −5.'); }
    } else {
      if (rnd() < 0.25) { m.conf = m100(m.conf - 3); out.good = false; out.head = 'PUT IN YOUR PLACE'; L('A veteran tells you to keep your head down. Confidence −3.'); }
      else { m.chem = m100(m.chem + 4); m.conf = m100(m.conf + 2); out.head = 'RESPECT EARNED'; L('Nobody says a word, but everybody notices. Chemistry +4, confidence +2.'); }
    }
  }
  se.decLog.push({ type: p.type, key, good: out.good, wk: p.wk });
  se.pending = null; se.sinceDec = 0; se.decIn = randInt(3, 5);
  return out;
}

/* ---------- UI ---------- */
const decBar = (label, v, tip) => `<div class="dm" title="${tip}"><span>${label}</span><div class="bar ${barClass(v)}"><i style="--w:${v}%"></i></div><b>${v}</b></div>`;
function decMetersHTML(se) {
  const m = decMeters(se), b = (se.buffs || []).filter(x => x.left > 0);
  return `<div class="dec-meters">${decBar('CONFIDENCE', m.conf, 'Raises or lowers your performance')}${decBar('CONDITION', m.fit, 'Low condition means more injuries')}${decBar('CHEMISTRY', m.chem, 'Helps the whole team win')}</div>
    ${b.length ? `<div class="dec-buffs">${b.map(x => `<span class="chip ${((x.perf || 0) < 0 || (x.inj || 1) > 1) && !(x.team > 0) ? 'bad' : 'gold'}">${esc(x.label)} · ${x.left}g</span>`).join('')}</div>` : ''}`;
}
function decBannerHTML(se) {
  if (!se.pending) return '';
  const d = DEC[se.pending.type](se.pending.ctx || {});
  return `<div class="banner dec-banner"><span>${d.icon} <b>DECISION NEEDED</b> — ${d.title}</span><button class="btn btn-primary btn-sm" data-act="openDecision">DECIDE</button></div>`;
}
function openDecision() {
  const se = curSeason(); if (!se || !se.pending) return false;
  const d = DEC[se.pending.type](se.pending.ctx || {});
  openModal(`<div class="dec"><div class="eyebrow">WEEK ${se.pending.wk} · DECISION</div><h3 class="dec-h">${d.icon} ${d.title}</h3><p class="modal-p">${d.text}</p>
    <div class="dec-opts">${d.opts.map(o => `<button class="dec-opt" data-act="decide" data-k="${o.k}"><span class="dec-ic">${o.icon}</span><b>${o.label}</b><span class="dec-d">${o.desc}</span><span class="dec-r">⚠ ${o.risk}</span></button>`).join('')}</div>
    <div class="muted small">Once you choose there is no going back. You can also decide later; the game will wait.</div>
    <div class="row end"><button class="btn btn-ghost" data-act="closeModal">LATER</button></div></div>`, 'decision');
  Snd.play('phone', 0.05);
  return true;
}
function decideNow(key) {
  const se = curSeason(), res = decResolve(se, key); if (!res) return;
  saveGame();
  openModal(`<div class="dec"><div class="eyebrow">DECISION RESULT</div><h3 class="dec-h ${res.good ? 'good' : 'bad'}">${res.good ? '✅' : '⚠️'} ${res.head}</h3>
    ${res.lines.map(t => `<p class="modal-p">${t}</p>`).join('')}${decMetersHTML(se)}
    <div class="row end"><button class="btn btn-primary" data-act="decDone">CONTINUE</button></div></div>`, 'decision');
  Snd.play(res.good ? 'chime' : 'down', 0.05);
}

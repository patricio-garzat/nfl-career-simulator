/* =====================================================================
   CONTRACT SIGNING — whenever you join a team (rookie deal, free agency, re-signing, trade) a contract is laid on the desk with the NFL and the
   team's logos; a vector pen signs it and the player's real signature (assets/signature.png, revealed along its traced centre line:
   assets/signature-strokes.json) appears exactly where the pen passes.
   contractSign({ teamId, kind, years, total, guaranteed, role }) -> Promise that resolves when the player taps CONTINUE.
   ===================================================================== */
let SIGN_STROKES = null;
async function signStrokes() {
  if (SIGN_STROKES) return SIGN_STROKES;
  try { SIGN_STROKES = await fetch('assets/signature-strokes.json').then(r => r.json()); } catch (e) { SIGN_STROKES = []; }
  return SIGN_STROKES;
}
// signature image (500 x 300) -> paper coordinates (paper is 620 x 800)
const SG = { x: 62, y: 552, k: 0.58 };
const sgPt = ([x, y]) => [SG.x + x * SG.k, SG.y + y * SG.k];
const sgDist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// cream paper grain (speckles, fibres, soft stains), painted once on a canvas and tiled over the contract
let PAPER_TEX = null;
function paperTexture() {
  if (PAPER_TEX) return PAPER_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 300; const x = c.getContext('2d');
  for (let i = 0; i < 16; i++) { const px = Math.random() * 300, py = Math.random() * 300, r = 50 + Math.random() * 90; for (const ox of [-300, 0, 300]) for (const oy of [-300, 0, 300]) { const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r); g.addColorStop(0, 'rgba(150,115,60,.07)'); g.addColorStop(1, 'rgba(150,115,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 300, 300); } }   // wrapped, so the tiles join without seams
  for (let i = 0; i < 7000; i++) { x.fillStyle = `rgba(${95 + Math.random() * 40 | 0},${75 + Math.random() * 30 | 0},${45 + Math.random() * 20 | 0},${0.03 + Math.random() * 0.09})`; x.fillRect(Math.random() * 300, Math.random() * 300, 1 + Math.random() * 1.2, 1 + Math.random() * 1.2); }
  x.lineWidth = 0.6;
  for (let i = 0; i < 170; i++) { const px = Math.random() * 300, py = Math.random() * 300, a = Math.random() * 6.28, l = 5 + Math.random() * 18; x.strokeStyle = i % 3 ? 'rgba(120,92,55,.09)' : 'rgba(255,255,255,.28)'; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + 0.6) * l * 0.5, py + Math.sin(a + 0.6) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
  return (PAPER_TEX = c.toDataURL('image/png'));
}

function contractPaper(o) {
  const P = S.player, t = TEAM[o.teamId], y0 = o.startYear || S.year, yrs = o.years || 1, y1 = y0 + yrs - 1, id = 'sg' + uid();
  const bright = brightOf(t), date = o.date || `July 1, ${y0}`;
  const L = (txt, y, extra = '') => `<text x="52" y="${y}" class="sg-t" ${extra}>${esc(txt)}</text>`;
  const lines = [
    [`This Agreement is made on ${date}, between the ${t.name} (the "Club")`, 'and'],
    [`and ${P.name.toUpperCase()}, a professional football player (the "Player"),`, 'pos'],
    [`who plays the position of ${POS[P.pos].name}.`],
    [],
    [`1. TERM.  The Club employs the Player for ${yrs} season${yrs > 1 ? 's' : ''}, ${y0}${yrs > 1 ? '–' + y1 : ''}.`],
    [`2. COMPENSATION.  The Club will pay the Player a total of ${money(o.total)} over the term`],
    [`    of this contract, of which ${money(o.guaranteed)} is fully guaranteed.`],
    [o.role ? `3. ROLE.  The Player is signed as ${o.role}.` : `3. ROLE.  The Player joins the roster as a member of the active squad.`],
    [`4. SERVICES.  The Player will perform with the highest skill and diligence and will`],
    [`    abide by the rules of the National Football League and of the Club.`],
  ];
  let y = 168;
  const textEls = lines.map((ln, i) => { const yy = y; y += ln.length ? 19 : 10; return ln.length ? `<g class="sg-line" style="animation-delay:${(0.2 + i * 0.045).toFixed(2)}s">${L(ln[0], yy)}</g>` : ''; }).join('');
  const grey = [0, 1, 2].map(i => `<rect class="sg-line" style="animation-delay:${(0.72 + i * 0.04).toFixed(2)}s" x="52" y="${y + 6 + i * 12}" width="${i === 2 ? 300 : 516}" height="4" rx="2" fill="#cfc8b6"/>`).join('');
  const boxY = y + 54, bw = 168;
  const box = (x, big, small, d, key = '') => `<g class="sg-pop" style="animation-delay:${d}s"><rect x="${x}" y="${boxY}" width="${bw}" height="62" rx="8" fill="${t.c1}" opacity=".96"/><text x="${x + bw / 2}" y="${boxY + 33}" text-anchor="middle" class="sg-big" data-k="${key}" fill="${textOn(t.c1)}">${esc(big)}</text><text x="${x + bw / 2}" y="${boxY + 52}" text-anchor="middle" class="sg-small" fill="${textOn(t.c1)}" opacity=".78">${small}</text></g>`;
  const boxes = box(52, `${yrs} YEAR${yrs > 1 ? 'S' : ''}`, 'TERM', '0.78') + box(226, money(o.total), 'TOTAL VALUE', '0.88', 'total') + box(400, money(o.guaranteed), 'GUARANTEED', '0.98', 'guar');
  const sigY = 705;
  return `<svg class="sg-paper" viewBox="0 0 620 800" xmlns="http://www.w3.org/2000/svg" overflow="visible">
    <defs>
      <linearGradient id="${id}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf7"/><stop offset="1" stop-color="#f1e9d4"/></linearGradient>
      <linearGradient id="${id}b" x1="0" x2="1"><stop offset="0" stop-color="#050609"/><stop offset=".4" stop-color="#2b2e38"/><stop offset="1" stop-color="#050609"/></linearGradient>
      <linearGradient id="${id}m" x1="0" x2="1"><stop offset="0" stop-color="#5b616b"/><stop offset=".5" stop-color="#e8ebef"/><stop offset="1" stop-color="#7a808a"/></linearGradient>
      <pattern id="${id}t" width="300" height="300" patternUnits="userSpaceOnUse"><image href="${paperTexture()}" width="300" height="300"/></pattern>
      <radialGradient id="${id}v" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#8a6a2c" stop-opacity="0"/><stop offset="1" stop-color="#8a6a2c" stop-opacity=".26"/></radialGradient>
      <linearGradient id="${id}fo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".45" stop-color="#000" stop-opacity=".07"/><stop offset=".55" stop-color="#fff" stop-opacity=".4"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <linearGradient id="${id}sh" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <clipPath id="${id}cl"><rect width="608" height="786" rx="6"/></clipPath>
    </defs>
    <rect x="6" y="8" width="608" height="786" rx="6" fill="rgba(0,0,0,.28)"/>
    <rect x="0" y="0" width="608" height="786" rx="6" fill="url(#${id}p)" stroke="#d8cfb8"/>
    <g clip-path="url(#${id}cl)">
      <rect width="608" height="786" fill="url(#${id}t)"/>
      <image href="${logoUrl(o.teamId)}" x="134" y="250" width="340" height="340" opacity=".055" preserveAspectRatio="xMidYMid meet"/>
      <rect y="255" width="608" height="16" fill="url(#${id}fo)"/><rect y="517" width="608" height="16" fill="url(#${id}fo)"/>
      <rect width="608" height="786" fill="url(#${id}v)"/>
    </g>
    <g class="sg-line" style="animation-delay:.05s">
      <image href="${NFL_LOGO}" x="40" y="34" width="70" height="70" preserveAspectRatio="xMidYMid meet"/>
      <image href="${logoUrl(o.teamId)}" x="498" y="34" width="70" height="70" preserveAspectRatio="xMidYMid meet"/>
      <text x="304" y="62" text-anchor="middle" class="sg-title">STANDARD PLAYER CONTRACT</text>
      <text x="304" y="90" text-anchor="middle" class="sg-sub" fill="${mixHex(bright, '#000000', 0.25)}">${esc(t.name.toUpperCase())} · ${esc(o.kind || 'NEW CONTRACT')}</text>
      <rect x="40" y="118" width="528" height="3" fill="${t.c1}"/><rect x="40" y="124" width="528" height="1.2" fill="${t.c2}"/>
    </g>
    ${textEls}${grey}${boxes}
    <g class="sg-line" style="animation-delay:1.05s">
      <text x="52" y="${sigY - 2}" class="sg-x">X</text>
      <rect x="70" y="${sigY}" width="300" height="1.4" fill="#2b2b2b"/><text x="70" y="${sigY + 17}" class="sg-small" fill="#6b665a">PLAYER SIGNATURE</text>
      <rect x="400" y="${sigY}" width="168" height="1.4" fill="#2b2b2b"/><text x="400" y="${sigY + 17}" class="sg-small" fill="#6b665a">DATE</text>
      <text x="408" y="${sigY - 8}" class="sg-date">${esc(date)}</text>
    </g>
    <g clip-path="url(#${id}cl)"><rect id="sgShine" class="sg-shine" x="-260" y="-40" width="220" height="900" fill="url(#${id}sh)" transform="skewX(-18)" opacity="0"/></g>
    <circle id="sgRing" class="sg-ring" cx="470" cy="590" r="30" fill="none" stroke="${bright}" stroke-width="5" opacity="0"/>
    <g transform="translate(470 590) rotate(-12)"><g id="sgStamp" class="sg-stamp" opacity="0"><rect x="-70" y="-26" width="140" height="52" rx="6" fill="none" stroke="${mixHex(bright, '#000000', 0.2)}" stroke-width="4"/><rect x="-64" y="-20" width="128" height="40" rx="3" fill="none" stroke="${mixHex(bright, '#000000', 0.2)}" stroke-width="1.4"/><text y="9" text-anchor="middle" class="sg-stampt" fill="${mixHex(bright, '#000000', 0.2)}">SIGNED</text></g></g>
    <g id="sgPen" class="sg-pen" style="--pc:${bright}">
      <ellipse cx="14" cy="6" rx="22" ry="5" fill="rgba(0,0,0,.28)" class="sg-penshadow"/>
      <g class="sg-penbody" transform="rotate(32)">
        <path d="M0 0 L-2.4 -11 L2.4 -11 Z" fill="#dfe3e8" stroke="#8d939c" stroke-width=".6"/>
        <path d="M-2.4 -11 L-6.5 -36 L6.5 -36 L2.4 -11 Z" fill="url(#${id}m)" stroke="#6e747d" stroke-width=".6"/>
        <rect x="-7.5" y="-76" width="15" height="40" rx="3" fill="#1d2230" stroke="#0e1118" stroke-width=".6"/>
        ${[0, 1, 2, 3, 4, 5].map(i => `<rect x="-7.5" y="${-72 + i * 6}" width="15" height="1.2" fill="rgba(255,255,255,.14)"/>`).join('')}
        <rect x="-8.6" y="-80" width="17.2" height="4.6" rx="1.5" fill="#c9ced6" stroke="#868c96" stroke-width=".5"/>
        <rect x="-8.2" y="-176" width="16.4" height="96" rx="4" fill="url(#${id}b)" stroke="#000" stroke-width=".6"/>
        <rect x="-5.2" y="-172" width="2.6" height="86" rx="1.3" fill="rgba(255,255,255,.4)"/>
        <rect x="7.4" y="-174" width="3.4" height="62" rx="1.7" fill="#e6e8ec" stroke="#8d939c" stroke-width=".5"/><circle cx="9.1" cy="-112" r="2.6" fill="#e6e8ec" stroke="#8d939c" stroke-width=".5"/>
        <rect x="-6.4" y="-184" width="12.8" height="10" rx="3.2" fill="#1d2230"/>
      </g>
    </g>
  </svg>`;
}

async function contractSign(o) {
  await signStrokes();
  return new Promise(resolve => {
    const t = TEAM[o.teamId], bright = brightOf(t);
    const ov = document.createElement('div'); ov.className = 'sg-overlay'; ov.style.cssText = `${themeVars(o.teamId)};--tb:${bright};--tx:${textOn(bright)}`;
    ov.innerHTML = `<div class="sg-top"><span class="sg-tag">✍️ ${esc(o.kind || 'NEW CONTRACT')}</span><button class="mini" id="sgSkip">SKIP ▸</button></div>
      <div class="sg-desk">${contractPaper(o)}</div>
      <div class="sg-actions"><button class="btn btn-primary btn-xl sg-sign" id="sgSign" hidden>✍️ SIGN</button><button class="btn btn-primary btn-xl" id="sgGo" hidden>CONTINUE ▸</button></div>`;
    document.body.appendChild(ov);
    const pen = ov.querySelector('#sgPen'), stamp = ov.querySelector('#sgStamp'), strokes = SIGN_STROKES;
    // the signature is painted on a canvas as the pen goes: a white trail is laid along the pen's path and the real signature image shows only where that trail is
    const desk = ov.querySelector('.sg-desk'), cv = document.createElement('canvas'), mc = document.createElement('canvas'), vx = cv.getContext('2d'), mx = mc.getContext('2d'), sigImg = new Image(), IK = 2;
    cv.width = mc.width = 500 * IK; cv.height = mc.height = 300 * IK; cv.className = 'sg-ink';
    cv.style.cssText = `left:${SG.x / 620 * 100}%;top:${SG.y / 800 * 100}%;width:${500 * SG.k / 620 * 100}%`;
    desk.appendChild(cv); sigImg.src = 'assets/signature.png';
    mx.strokeStyle = '#fff'; mx.lineWidth = 11 * IK; mx.lineCap = 'round'; mx.lineJoin = 'round';
    const drawInk = () => { vx.globalCompositeOperation = 'copy'; vx.drawImage(mc, 0, 0); vx.globalCompositeOperation = 'source-in'; vx.drawImage(sigImg, 0, 0, 500 * IK, 300 * IK); vx.globalCompositeOperation = 'source-over'; };
    let inkAt = null;
    let alive = true, finished = false;
    const place = (x, y, lift = 0, tilt = 0) => { pen.setAttribute('transform', `translate(${x.toFixed(1)} ${(y - lift).toFixed(1)}) rotate(${tilt})`); pen.classList.toggle('lift', lift > 2); };
    const ease = k => 1 - Math.pow(1 - k, 3), eio = k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    const frame = ms => new Promise(r => requestAnimationFrame(() => r()));
    const done = () => {
      if (finished) return; finished = true;
      ov.classList.add('sg-done');                                      // every line of the contract is on the page, whatever its animation delay
      vx.clearRect(0, 0, cv.width, cv.height); vx.drawImage(sigImg, 0, 0, 500 * IK, 300 * IK);   // the whole signature, in case the pen was skipped
      pen.style.opacity = 0; stamp.setAttribute('opacity', '.9'); stamp.classList.add('on');
      ['#sgRing', '#sgShine'].forEach(q => ov.querySelector(q).classList.add('on')); const desk = ov.querySelector('.sg-desk'); desk.classList.remove('shake'); void desk.offsetWidth; desk.classList.add('shake');
      const nums = { total: o.total, guar: o.guaranteed }; Object.entries(nums).forEach(([k2, v]) => { const el = ov.querySelector(`[data-k="${k2}"]`); if (el) el.textContent = money(v); });
      const go = ov.querySelector('#sgGo'); go.hidden = false; ov.querySelector('#sgSkip').hidden = true;
    };
    ov.querySelector('#sgSkip').addEventListener('click', () => { alive = false; ov.querySelector('#sgSign').hidden = true; ov.dispatchEvent(new Event('sg-skip')); done(); });
    ov.querySelector('#sgGo').addEventListener('click', () => { ov.classList.add('out'); setTimeout(() => { ov.remove(); resolve(); }, 300); });
    (async () => {
      Snd.play('whoosh', 0.1);
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const tl = (ms, fn) => new Promise(res => { const t0 = performance.now(); const step = now => { const k = Math.min(1, (now - t0) / ms); fn(k); if (k < 1 && alive) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
      pen.style.opacity = 0; place(700, 930, 0, 0);
      [['total', o.total], ['guar', o.guaranteed]].forEach(([k2, v]) => { const el = ov.querySelector(`[data-k="${k2}"]`); if (el) { el.textContent = money(0); setTimeout(() => tl(650, k => { if (!finished) el.textContent = money(v * ease(k)); }), 950); } });   // the figures count up
      await wait(1100);                                                   // the contract lands and its lines write themselves in
      if (!alive) return;
      const signBtn = ov.querySelector('#sgSign'); signBtn.hidden = false; Snd.play('click', 0);        // nothing is signed until the player taps SIGN
      await new Promise(r => { signBtn.addEventListener('click', () => { signBtn.hidden = true; Snd.play('whoosh', 0); r(); }, { once: true }); ov.addEventListener('sg-skip', r, { once: true }); });
      if (!alive) return;
      await wait(120);
      if (!alive) return;
      const start = sgPt(strokes[0][0]); pen.style.opacity = 1;
      const from = [720, 900];
      await tl(430, k => { const e = ease(k); place(from[0] + (start[0] - from[0]) * e, from[1] + (start[1] - from[1]) * e - Math.sin(Math.PI * k) * 40, (1 - e) * 18, 0); });
      if (!alive) return;
      const SPEED = 0.9;                                                 // image px per ms
      let tick = 0;
      for (let si = 0; si < strokes.length && alive; si++) {
        let lastJ = 1; inkAt = null;
        const S0 = strokes[si], seg = [0]; for (let i = 1; i < S0.length; i++) seg.push(seg[i - 1] + sgDist(S0[i - 1], S0[i]));
        const total = seg[seg.length - 1] || 1, dur = Math.max(60, total / SPEED);
        if (si > 0) {                                                     // pen lifts and moves to the next stroke
          const a = sgPt(strokes[si - 1][strokes[si - 1].length - 1]), b = sgPt(S0[0]);
          await tl(Math.min(120, 40 + sgDist(a, b) * 0.8), k => { const e = eio(k); place(a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, Math.sin(Math.PI * k) * 20, 0); });
          if (!alive) return;
        }
        await tl(dur, k => {   // one continuous stroke: quick start, steady speed, soft landing
          const d = (0.72 * k + 0.28 * eio(k)) * total; let j = 1; while (j < seg.length - 1 && seg[j] < d) j++;
          const f = (d - seg[j - 1]) / ((seg[j] - seg[j - 1]) || 1), pa = S0[j - 1], pb = S0[j] || pa;
          const px = pa[0] + (pb[0] - pa[0]) * f, py = pa[1] + (pb[1] - pa[1]) * f, [X, Y] = sgPt([px, py]);
          mx.beginPath(); if (!inkAt) inkAt = [S0[0][0], S0[0][1]]; mx.moveTo(inkAt[0] * IK, inkAt[1] * IK);
          for (let q = lastJ; q < j; q++) mx.lineTo(S0[q][0] * IK, S0[q][1] * IK);      // every point the pen has passed since the last frame
          mx.lineTo(px * IK, py * IK); mx.stroke(); inkAt = [px, py]; lastJ = j; drawInk();
          place(X + Math.sin(performance.now() / 23) * 0.35, Y + Math.cos(performance.now() / 29) * 0.35, 0, 0);
          if (performance.now() - tick > 85) { tick = performance.now(); Snd.play('penScratch', 0); }
        });
        mx.beginPath(); mx.moveTo(inkAt[0] * IK, inkAt[1] * IK); mx.lineTo(S0[S0.length - 1][0] * IK, S0[S0.length - 1][1] * IK); mx.stroke(); drawInk();
      }
      if (!alive) return;
      const last = sgPt(strokes[strokes.length - 1][strokes[strokes.length - 1].length - 1]);
      await tl(300, k => { const e = ease(k); place(last[0] + 260 * e, last[1] - 70 * e, 14 * e, 8 * e); pen.style.opacity = 1 - k * k; });
      if (!alive) return;
      done(); Snd.play('contract', 0.1);
      burst(ov, 60, [t.c1, t.c2, '#ffffff', '#ffc53d']);
    })();
  });
}

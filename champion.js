/* =====================================================================
   SUPER BOWL CELEBRATION — shown once, right after the game that wins the title.
   Spotlight rays, the Lombardi trophy rising with a shine sweep, "YOU WON THE SUPER BOWL" slamming in, confetti cannons.
   ===================================================================== */
function lvConfetti(canvas, colors) {
  const ctx = canvas.getContext('2d'); let W = 0, H = 0, raf = 0, stopped = false, t0 = performance.now(); const parts = [];
  const resize = () => { W = canvas.width = canvas.clientWidth * devicePixelRatio; H = canvas.height = canvas.clientHeight * devicePixelRatio; };
  resize(); window.addEventListener('resize', resize);
  const add = (x, y, vx, vy) => parts.push({ x, y, vx, vy, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.35, w: (6 + Math.random() * 9) * devicePixelRatio, h: (3 + Math.random() * 6) * devicePixelRatio, c: colors[Math.floor(Math.random() * colors.length)], flip: Math.random() * 6.28 });
  const cannon = (side) => { for (let i = 0; i < 110; i++) { const a = (side < 0 ? -0.95 : -2.2) + (Math.random() - 0.5) * 0.7, sp = (14 + Math.random() * 15) * devicePixelRatio; add(side < 0 ? W * 0.02 : W * 0.98, H * 0.95, Math.cos(a) * sp, Math.sin(a) * sp); } };
  setTimeout(() => !stopped && cannon(-1), 500); setTimeout(() => !stopped && cannon(1), 650); setTimeout(() => !stopped && cannon(-1), 2600); setTimeout(() => !stopped && cannon(1), 2700);
  const frame = now => {
    if (stopped) return; const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    if (t < 14 && Math.random() < 0.7) for (let i = 0; i < 2; i++) add(Math.random() * W, -20, (Math.random() - 0.5) * 2 * devicePixelRatio, (2 + Math.random() * 3) * devicePixelRatio);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.vy += 0.34 * devicePixelRatio; p.vx *= 0.992; p.vy *= 0.992; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.flip += 0.12;
      if (p.y > H + 40) { parts.splice(i, 1); continue; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.flip)); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { stopped = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
}

function showChampionCelebration(season, game) {
  return new Promise(resolve => {
    const P = S.player, t = TEAM[season.teamId], opp = TEAM[game.opp], gold = '#ffd23d';
    const ov = document.createElement('div'); ov.className = 'sb-overlay'; ov.style.cssText = themeVars(season.teamId);
    const spark = Array.from({ length: 16 }, (_, i) => `<i class="sb-spark" style="left:${8 + Math.random() * 84}%;top:${10 + Math.random() * 70}%;animation-delay:${(Math.random() * 3).toFixed(2)}s;--s:${(0.5 + Math.random() * 1.1).toFixed(2)}"></i>`).join('');
    ov.innerHTML = `
      <div class="sb-bg" style="--a:${t.c1};--b:${t.c2}"></div><div class="sb-rays"></div><div class="sb-rays r2"></div>
      <canvas class="sb-confetti"></canvas>
      <div class="sb-stage">
        <div class="sb-kick">${esc(t.name.toUpperCase())} · ${season.year} SEASON</div>
        <div class="sb-trophy-wrap"><i class="sb-ring"></i><i class="sb-ring r2"></i><i class="sb-ring r3"></i>
          <div class="sb-trophy"><img src="super-bowl-trophy.png" alt="Super Bowl trophy"><div class="sb-shine"></div></div>${spark}</div>
        <div class="sb-title"><span class="l1">YOU WON THE</span><span class="l2">SUPER BOWL</span></div>
        <div class="sb-sub">${esc(P.name)} — World Champion</div>
        <div class="sb-score"><img src="${logoUrl(season.teamId)}" alt=""><b>${game.my}</b><span>–</span><b>${game.op}</b><img src="${logoUrl(game.opp)}" alt=""></div>
        <button class="btn btn-primary btn-xl sb-go" id="sbGo">CONTINUE ▸</button>
      </div>`;
    document.body.appendChild(ov);
    const stop = lvConfetti(ov.querySelector('.sb-confetti'), [t.c1, t.c2, gold, '#ffffff', '#c9d0dc', '#ffb300']);
    Snd.play('bigFanfare', 0.2); Snd.play('roar', 1.2); Snd.play('cheer', 2.4);
    const t1 = setTimeout(() => Snd.play('cheer'), 5200);
    const done = () => { clearTimeout(t1); stop(); ov.classList.add('out'); setTimeout(() => { ov.remove(); resolve(); }, 450); };
    ov.querySelector('#sbGo').addEventListener('click', done);
  });
}

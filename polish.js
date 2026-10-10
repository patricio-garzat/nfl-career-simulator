/* =====================================================================
   POLISH LAYER (behaviour) — ambient backdrop, count-up numbers, quiet
   redraws and the cursor spotlight. Loaded last; it never touches game state.
   ===================================================================== */
(function () {
  'use strict';
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  // animatable ring fill (--rp) — only switched on when the browser can register the property
  try { CSS.registerProperty({ name: '--rp', syntax: '<number>', inherits: false, initialValue: '0' }); root.classList.add('rp'); } catch (e) { /* older browsers: the ring simply shows its final value */ }

  /* ---- ambient backdrop: three drifting glows, a vignette with film grain, a few rising sparks ---- */
  if (!document.getElementById('ambient')) {
    const a = document.createElement('div'); a.id = 'ambient'; a.setAttribute('aria-hidden', 'true');
    a.innerHTML = '<i class="am1"></i><i class="am2"></i><i class="am3"></i>';
    if (!reduce) {
      for (let i = 0; i < 14; i++) {
        const s = document.createElement('s'), z = 2 + Math.random() * 3;
        s.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;width:${z.toFixed(1)}px;height:${z.toFixed(1)}px;--dx:${Math.round(Math.random() * 120 - 60)}px;--dur:${(16 + Math.random() * 16).toFixed(1)}s;--dl:${(-Math.random() * 30).toFixed(1)}s`;
        a.appendChild(s);
      }
    }
    document.body.insertBefore(a, document.body.firstChild);
  }

  /* ---- numbers count up when a screen opens ---- */
  const NUM = /^(-?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?$/;
  function countUp(el) {
    const tn = [...el.childNodes].find(n => n.nodeType === 3 && NUM.test(n.nodeValue.trim()));
    if (!tn || [...el.childNodes].some(n => n.nodeType === 1 && n.tagName !== 'SUP')) return;
    const txt = tn.nodeValue.trim(), m = txt.match(NUM), neg = m[1] === '-', comma = m[2].includes(','), dec = m[3] ? m[3].length - 1 : 0;
    const end = parseFloat(m[2].replace(/,/g, '') + (m[3] || '')) * (neg ? -1 : 1);
    if (!isFinite(end) || Math.abs(end) < 2 || Math.abs(end) > 1e7) return;
    const fmt = v => { const s = Math.abs(v).toFixed(dec); const [i, d] = s.split('.'); return (v < 0 ? '-' : '') + (comma ? i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : i) + (d ? '.' + d : ''); };
    const t0 = performance.now() + 250, dur = 950;
    tn.nodeValue = fmt(0);
    (function step(now) {
      if (!tn.parentNode) return;
      const k = Math.min(1, Math.max(0, (now - t0) / dur)), e = 1 - Math.pow(1 - k, 3);
      tn.nodeValue = fmt(end * e);
      if (k < 1) requestAnimationFrame(step); else tn.nodeValue = txt;
    })(performance.now());
  }

  /* ---- react to every screen change ---- */
  const app = document.getElementById('app'); let lastSig = '', lastAt = 0;
  if (app) new MutationObserver(() => {
    const sig = app.innerHTML.slice(0, 90), now = Date.now();
    // the same screen redrawn a moment later (a slider, a toggle…) shouldn't replay its entrance
    const quiet = sig === lastSig && now - lastAt < 2500; lastSig = sig; lastAt = now;
    app.classList.toggle('no-anim', quiet);
    app.querySelectorAll('.hero').forEach(h => { if (!h.querySelector('.hero-sheen')) h.insertAdjacentHTML('beforeend', '<i class="hero-sheen"></i>'); });
    if (quiet || reduce) return;
    app.querySelectorAll('.tile-v, .ovr-ring .n, .tb-v, .stat-v, .big-n').forEach(countUp);
  }).observe(app, { childList: true });

  /* ---- cursor spotlight on cards (mouse only) ---- */
  if (window.matchMedia && matchMedia('(hover: hover)').matches) {
    let raf = 0, ev = null;
    document.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return; ev = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0; const t = ev.target && ev.target.closest && ev.target.closest('.card, .next-card'); if (!t) return;
        const r = t.getBoundingClientRect(); t.style.setProperty('--mx', (ev.clientX - r.left) + 'px'); t.style.setProperty('--my', (ev.clientY - r.top) + 'px');
      });
    }, { passive: true });
  }
})();

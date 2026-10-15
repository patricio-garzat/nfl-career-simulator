/* =====================================================================
   ICONS — the game uses clean line icons instead of emoji. Any emoji that
   ends up in the page (templates, toasts, messages…) is swapped for the
   matching icon automatically; the icons take the colour of the text.
   ===================================================================== */
(function () {
  'use strict';
  const P = (d) => d;
  const ICON = {
    trophy: P('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/>'),
    football: P('<path d="M4 20C2.5 14 6 6 12.5 4c3.5-1 6.5-.6 7.5.4s1.4 4-.4 7.6C17.5 18.500 10 22.500 4 20z"/><path d="M9 15l6-6M10.5 10.5l3 3M8.500 12.500l3 3M12 8.500l3 3"/>'),
    x: P('<path d="M6 6l12 12M18 6L6 18"/>'),
    check: P('<path d="M5 12.500l4.500 4.500L19 7.500"/>'),
    alert: P('<path d="M12 3.500l9.500 16.500h-19z"/><path d="M12 10v4.500M12 17.500v.01"/>'),
    clipboard: P('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>'),
    gamepad: P('<path d="M7 8h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.200 2L14.500 14h-5L8.200 15A3 3 0 0 1 3 13v-1a4 4 0 0 1 4-4z"/><path d="M8 11v3M6.500 12.500h3M16 11.500v.01M18 13v.01"/>'),
    star: P('<path d="M12 3l2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100-4.400-4.300 6.100-.9z"/>'),
    sparkles: P('<path d="M12 3l1.800 4.700 4.700 1.800-4.700 1.800L12 16l-1.800-4.700L5.500 9.500l4.700-1.800z"/><path d="M19 15l.8 2.200 2.200.8-2.200.8L19 21l-.8-2.200-2.200-.8 2.200-.8z"/>'),
    clock: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    hourglass: P('<path d="M7 3h10M7 21h10M8 3c0 5 3 6 4 9-1 3-4 4-4 9M16 3c0 5-3 6-4 9 1 3 4 4 4 9"/>'),
    phone: P('<path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
    flame: P('<path d="M12 3c1 4 5 5.500 5 11a5 5 0 0 1-10 0c0-2 1-3.500 2-4.500.3 1.500 1 2 2 2.500C11 9 10.500 6 12 3z"/>'),
    trendUp: P('<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>'),
    trendDown: P('<path d="M3 7l6 6 4-4 8 8M15 17h6v-6"/>'),
    bars: P('<path d="M5 20V10M12 20V4M19 20v-7"/>'),
    flag: P('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
    crown: P('<path d="M3 8l4.500 4L12 5l4.500 7L21 8l-2 11H5z"/>'),
    medal: P('<circle cx="12" cy="15" r="5"/><path d="M8.500 3L11 9M15.500 3L13 9M10 14.500l1.500 1.500 2.500-3"/>'),
    volume: P('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.500 8.500a5 5 0 0 1 0 7M19 6a8.500 8.500 0 0 1 0 12"/>'),
    volumeX: P('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
    user: P('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    tag: P('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.500" cy="8.500" r="1.200"/>'),
    download: P('<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>'),
    thumbUp: P('<path d="M7 11v9H4v-9zM7 11l4-8c1.500 0 2.500 1 2.500 2.500L13 9h5.500a2 2 0 0 1 2 2.400l-1.200 6A2.500 2.500 0 0 1 16.800 20H7"/>'),
    thumbDown: P('<g transform="rotate(180 12 12)"><path d="M7 11v9H4v-9zM7 11l4-8c1.500 0 2.500 1 2.500 2.500L13 9h5.500a2 2 0 0 1 2 2.400l-1.200 6A2.500 2.500 0 0 1 16.800 20H7"/></g>'),
    repeat: P('<path d="M17 2l4 4-4 4M21 6H8a5 5 0 0 0-5 5M7 22l-4-4 4-4M3 18h13a5 5 0 0 0 5-5"/>'),
    lock: P('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    cap: P('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.500V16c0 1.500 3 3 6 3s6-1.500 6-3v-4.500M22 9v6"/>'),
    palette: P('<path d="M12 3a9 9 0 1 0 0 18c1.500 0 2-1 1.500-2.200-.5-1.300.2-2.300 1.500-2.300H17a4 4 0 0 0 4-4C21 6.500 17 3 12 3z"/><circle cx="7.500" cy="11" r="1"/><circle cx="10.500" cy="7" r="1"/><circle cx="15.500" cy="7.500" r="1"/>'),
    shirt: P('<path d="M8 3L3 6l2.500 4L8 9v12h8V9l2.500 1L21 6l-5-3a4 4 0 0 1-8 0z"/>'),
    grid: P('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/>'),
    type: P('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
    sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.500 1.500M17.500 17.500L19 19M5 19l1.500-1.500M17.500 6.500L19 5"/>'),
    moon: P('<path d="M20 14.500A8.500 8.500 0 0 1 9.500 4 8.500 8.500 0 1 0 20 14.500z"/>'),
    camera: P('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.500"/>'),
    pointer: P('<path d="M9 11V5.500a1.500 1.500 0 0 1 3 0V10M12 9.500a1.500 1.500 0 0 1 3 0V11M15 10.500a1.500 1.500 0 0 1 3 0V15c0 4-2 6-5.500 6H12c-3 0-4.500-2-5.500-4L4 12.500A1.500 1.500 0 0 1 6.500 11L9 13"/>'),
    hand: P('<path d="M7 12V6a1.500 1.500 0 0 1 3 0v5M10 11V4.500a1.500 1.500 0 0 1 3 0V11M13 11V5.500a1.500 1.500 0 0 1 3 0V12M16 11.500a1.500 1.500 0 0 1 3 0V15c0 4-2.500 6-6 6h-1c-3 0-4.500-1.500-6-4l-2-3.500a1.500 1.500 0 0 1 2.500-1.500L7 14"/>'),
    run: P('<circle cx="15" cy="5" r="2"/><path d="M9 21l3-6-3-3 2-4 4 3 3 1M8 10l3-3M12 15l4 2.500"/>'),
    goal: P('<path d="M3 20V6h18v14M3 6l3 14M21 6l-3 14M9 6l1 14M15 6l-1 14M3 12h18"/>'),
    zap: P('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
    pen: P('<path d="M4 20l1-4L17 4l3 3L8 19z"/><path d="M14 7l3 3"/>'),
    skull: P('<path d="M12 3a8 8 0 0 0-8 8c0 3 1.500 4.500 3 5.500V20h10v-3.500c1.500-1 3-2.500 3-5.500a8 8 0 0 0-8-8z"/><circle cx="9" cy="11.500" r="1.400"/><circle cx="15" cy="11.500" r="1.400"/>'),
    meh: P('<circle cx="12" cy="12" r="9"/><path d="M8.500 15h7M9 9.500v.01M15 9.500v.01"/>'),
    heartOff: P('<path d="M12 20s-8-5-8-11a4.500 4.500 0 0 1 8-2.500A4.500 4.500 0 0 1 20 9c0 6-8 11-8 11z"/><path d="M12 7l-2 4 3 2-1 4"/>'),
    stadium: P('<ellipse cx="12" cy="8" rx="9" ry="3.500"/><path d="M3 8v8c0 2 4 3.500 9 3.500s9-1.500 9-3.500V8M8 11v8M16 11v8"/>'),
    arrowRight: P('<path d="M4 12h15M13 6l6 6-6 6"/>'),
    swords: P('<path d="M5 19L19 5M14 5h5v5M5 5l14 14M5 10V5h5"/>'),
    shield: P('<path d="M12 3l8 3v5.500c0 5-3.500 8.500-8 9.500-4.500-1-8-4.500-8-9.500V6z"/>'),
    dumbbell: P('<path d="M6 7v10M3 9.500v5M18 7v10M21 9.500v5M6 12h12"/>'),
    calendar: P('<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
    expand: P('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    dice: P('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/>'),
    cube: P('<path d="M12 3l8 4.500v9L12 21l-8-4.500v-9z"/><path d="M12 12l8-4.500M12 12L4 7.500M12 12v9"/>'),
    puzzle: P('<path d="M5 5h5a2 2 0 1 1 4 0h5v5a2 2 0 1 0 0 4v5h-5a2 2 0 1 0-4 0H5v-5a2 2 0 1 1 0-4z"/>'),
    wrench: P('<path d="M14.500 6.500a4 4 0 0 0 5 5L21 13l-8 8a2.500 2.500 0 0 1-3.500-3.500l8-8z"/>'),
    hash: P('<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>'),
    landmark: P('<path d="M3 9l9-5 9 5zM5 9v9M9.500 9v9M14.500 9v9M19 9v9M3 21h18"/>'),
    save: P('<path d="M5 3h11l4 4v14H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>'),
    pin: P('<path d="M12 21s7-6.200 7-11.500a7 7 0 0 0-14 0C5 14.800 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/>'),
    rocket: P('<path d="M14 4c3 0 6 1 6 1s1 3 1 6c-2 3-4 5-6 6l-4-4c1-2 3-6 3-9z"/><path d="M9 13l-4 1 3 3M10 17l-1 4M6 9l4-1"/>'),
    megaphone: P('<path d="M3 11v3l12 5V6zM15 6c3 1 5 2.500 5 5.500S18 17 15 18"/><path d="M6 15l1 5h3l-1-4"/>'),
    wind: P('<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>'),
    target: P('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'),
    keyboard: P('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>'),
    stop: P('<rect x="6" y="6" width="12" height="12" rx="1.500"/>'),
    minus: P('<path d="M5 12h14"/>'),
  };
  const MAP = {
    '🏆': 'trophy', '🏈': 'football', '❌': 'x', '✅': 'check', '⚠': 'alert', '📋': 'clipboard', '🎮': 'gamepad', '⭐': 'star', '🌟': 'star', '✨': 'sparkles',
    '⏰': 'clock', '⌛': 'hourglass', '📞': 'phone', '🔥': 'flame', '📈': 'trendUp', '📉': 'trendDown', '📊': 'bars', '🚩': 'flag', '🏁': 'flag', '👑': 'crown',
    '🏅': 'medal', '🎖': 'medal', '🥈': 'medal', '🔇': 'volumeX', '🔊': 'volume', '🧒': 'user', '🏷': 'tag', '⬇': 'download', '👍': 'thumbUp', '👎': 'thumbDown',
    '🔁': 'repeat', '🔒': 'lock', '🎓': 'cap', '🎨': 'palette', '👕': 'shirt', '🎽': 'shirt', '🔳': 'grid', '🔤': 'type', '☀': 'sun', '🌙': 'moon', '📷': 'camera',
    '👆': 'pointer', '🙌': 'hand', '🏃': 'run', '🥅': 'goal', '⚡': 'zap', '🦵': 'football', '✍': 'pen', '💀': 'skull', '😴': 'meh', '😐': 'meh', '💔': 'heartOff',
    '🏟': 'stadium', '➡': 'arrowRight', '➜': 'arrowRight', '⚔': 'swords', '🛡': 'shield', '💪': 'dumbbell', '🗓': 'calendar', '⛶': 'expand', '🎲': 'dice',
    '🧊': 'cube', '🧩': 'puzzle', '🛠': 'wrench', '🔢': 'hash', '🏛': 'landmark', '💾': 'save', '📍': 'pin', '🚀': 'rocket', '📣': 'megaphone', '💨': 'wind',
    '⭕': 'target', '⌨': 'keyboard', '⏹': 'stop', '➖': 'minus', '🔴': null, '🟢': null,
  };
  // CSS: one mask per icon, painted with the text colour
  const style = document.createElement('style');
  const base = '.ic{display:inline-block;width:1.1em;height:1.1em;vertical-align:-.19em;background:currentColor;-webkit-mask:var(--m) center/contain no-repeat;mask:var(--m) center/contain no-repeat;flex:none;margin:0 .06em}';
  style.textContent = base + Object.keys(ICON).map(k => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;
    return `.ic-${k}{--m:url("data:image/svg+xml,${encodeURIComponent(svg)}")}`;
  }).join('');
  document.head.appendChild(style);

  const KEEP = new Set(['★', '☆', '✔', '✕', '✓', '✗']);
  // every emoji-like character (the ones above are plain symbols and stay)
  const RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{23E9}-\u{23FF}\u{2300}-\u{2328}\u{FE0F}\u{200D}]/gu;
  const FAST = /[\u{231A}\u{231B}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{23E9}-\u{23FF}\u{2328}]/u;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'TITLE', 'OPTION', 'INPUT', 'NOSCRIPT']);

  function swap(node) {
    const txt = node.nodeValue; if (!txt || !FAST.test(txt)) return;
    const par = node.parentNode; if (!par || SKIP.has(par.nodeName) || par.nodeName === 'text' || par.nodeName === 'tspan' || (par.closest && par.closest('[data-noicon]'))) {
      if (par && (SKIP.has(par.nodeName) || par.nodeName === 'text' || par.nodeName === 'tspan')) node.nodeValue = txt.replace(RE, c => (KEEP.has(c) ? c : ''));   // places that cannot hold an element: just drop the emoji
      return;
    }
    const frag = document.createDocumentFragment(); let last = 0, m; RE.lastIndex = 0;
    while ((m = RE.exec(txt))) {
      const ch = m[0]; if (KEEP.has(ch)) continue;
      if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
      last = m.index + ch.length;
      const name = MAP[ch];
      if (name) { const s = document.createElement('span'); s.className = 'ic ic-' + name; s.setAttribute('aria-hidden', 'true'); frag.appendChild(s); }
    }
    if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
    par.replaceChild(frag, node);
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { swap(root); return; }
    if (root.nodeType !== 1 || SKIP.has(root.nodeName)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = []; let n;
    while ((n = w.nextNode())) if (FAST.test(n.nodeValue)) list.push(n);
    list.forEach(swap);
  }
  let queued = new Set(), raf = 0;
  const flush = () => { raf = 0; const q = queued; queued = new Set(); q.forEach(n => { if (n.isConnected) walk(n); }); };
  new MutationObserver(muts => {
    for (const m of muts) { if (m.type === 'characterData') queued.add(m.target); else m.addedNodes.forEach(n => queued.add(n)); }
    if (!raf) raf = requestAnimationFrame(flush);
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  walk(document.body);
  window.iconize = walk;   // (handy from the console)
})();

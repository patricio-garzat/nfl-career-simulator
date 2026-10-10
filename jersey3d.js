/* =====================================================================
   3D JERSEY VIEWER — turns the jersey you designed into a real 3D object
   you can spin with the mouse / finger. The same canvas drawing used by
   "Download PNG" is wrapped around an inflated jersey-shaped mesh (three.js
   is loaded only when you open the viewer).
   ===================================================================== */
let _j3d = null;   // the open viewer (so it can be closed from anywhere)

// front + back of the current design as high-res canvases (transparent background)
async function j3dCanvases(sc) {
  const alt = jcAlt(), id = S.teamId, cfg = jerseyFor(jcKey()), name = jName(S.player), num = playerNumber(), word = alt ? alt.word : TEAM[id].nick;
  await Promise.all(JC_FONTS.map(f => document.fonts.load(`${f.w} 100px ${f.css}`).catch(() => {})));
  const W = UNI.meta.w, H = UNI.meta.h;
  const one = alt ? await jcLogoDataURL(null, null, alt.logo) : null;
  const logoData = alt ? { light: one, dark: one } : { light: await jcLogoDataURL(id, 'light'), dark: await jcLogoDataURL(id, 'dark') };
  logoData.jock = await jcLogoDataURL(null, null, 'assets/nfl/jocktag.png');
  const extra = alt ? { logoSrc: alt.logo, backLogo: one || '' } : undefined;
  const out = {};
  for (const v of ['front', 'back']) {
    const cv = document.createElement('canvas'); cv.width = Math.round(W * sc); cv.height = Math.round(H * sc);
    await jcDrawJersey(cv.getContext('2d'), cfg, v, name, num, word, id, logoData, 0, 0, sc, undefined, extra);
    out[v] = cv;
  }
  return out;
}

// jersey-shaped, slightly inflated body: a front panel and a back panel that meet along the silhouette
function j3dBuild(THREE, fc, bc, maxAniso) {
  const W = UNI.meta.w, H = UNI.meta.h, ST = 2, nx = Math.floor(W / ST) + 1, ny = Math.floor(H / ST) + 2, U = 0.01;
  const grab = (cv, flip) => { const c = document.createElement('canvas'); c.width = nx; c.height = ny; const x = c.getContext('2d'); if (flip) { x.translate(nx, 0); x.scale(-1, 1); } x.drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, nx, H / ST); return x.getImageData(0, 0, nx, ny).data; };
  // mask = where either side of the jersey has fabric (the back is mirrored into front coordinates)
  const fa = grab(fc, false), ba = grab(bc, true), M = new Uint8Array(nx * ny);
  for (let k = 0; k < nx * ny; k++) M[k] = (fa[k * 4 + 3] > 24 || ba[k * 4 + 3] > 24) ? 1 : 0;
  // the hem and the sleeve openings are not seams: extend the mask past them so the panels stay apart there
  let jmax = 0; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (M[j * nx + i]) jmax = j;
  const PAD = 16, ph = ny + PAD, P = new Uint8Array(nx * ph); P.set(M);
  for (let j = jmax + 1; j < ph; j++) for (let i = 0; i < nx; i++) P[j * nx + i] = M[jmax * nx + i];
  // distance from the nearest edge (chamfer transform)
  const D = new Float32Array(nx * ph), BIG = 1e5, R2 = Math.SQRT2;
  for (let k = 0; k < D.length; k++) D[k] = P[k] ? BIG : 0;
  for (let j = 0; j < ph; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (!D[k]) continue; let v = D[k]; if (i > 0) v = Math.min(v, D[k - 1] + 1); if (j > 0) { v = Math.min(v, D[k - nx] + 1); if (i > 0) v = Math.min(v, D[k - nx - 1] + R2); if (i < nx - 1) v = Math.min(v, D[k - nx + 1] + R2); } D[k] = v; }
  for (let j = ph - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { const k = j * nx + i; if (!D[k]) continue; let v = D[k]; if (i < nx - 1) v = Math.min(v, D[k + 1] + 1); if (j < ph - 1) { v = Math.min(v, D[k + nx] + 1); if (i < nx - 1) v = Math.min(v, D[k + nx + 1] + R2); if (i > 0) v = Math.min(v, D[k + nx - 1] + R2); } D[k] = v; }
  for (let pass = 0; pass < 2; pass++) { const C = D.slice(); for (let j = 1; j < ph - 1; j++) for (let i = 1; i < nx - 1; i++) { const k = j * nx + i; if (!C[k]) continue; let a = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) a += Math.min(C[k + dj * nx + di], 40); D[k] = a / 9; } }   // smooth the distance field (no saw-tooth seams)
  const hgt = (i, j) => {
    const d = Math.min(D[j * nx + i], 60) * ST;                         // distance to the edge, in jersey units
    const t = Math.min(1, d / 15), edge = Math.sin(t * Math.PI / 2);   // round, pillowy edge
    const x = i * ST - W / 2, y = j * ST;
    const wrinkle = Math.sin(y * 0.11 + x * 0.045) * 0.9 + Math.sin(y * 0.05 - x * 0.12 + 1.7) * 0.8 + Math.sin(x * 0.2 + y * 0.03) * 0.35;   // soft folds
    return (16 * edge + 19 * Math.min(1, d / 56)) + wrinkle * Math.min(1, d / 14) * 0.9;
  };
  // vertices: front grid then back grid
  const N = nx * ny, pos = new Float32Array(N * 6), uv = new Float32Array(N * 4);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = i * ST, y = j * ST, h = M[k] || D[k] > 0 ? hgt(i, j) : 0, px = (x - W / 2) * U, py = (H / 2 - y) * U;
    pos[k * 3] = px; pos[k * 3 + 1] = py; pos[k * 3 + 2] = h * U;
    pos[(N + k) * 3] = px; pos[(N + k) * 3 + 1] = py; pos[(N + k) * 3 + 2] = -h * U;
    uv[k * 2] = x / W; uv[k * 2 + 1] = 1 - y / H;
    uv[(N + k) * 2] = 1 - x / W; uv[(N + k) * 2 + 1] = 1 - y / H;
  }
  const fi = [], bi = [];
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    if (!(M[a] || M[b] || M[c] || M[d])) continue;
    fi.push(a, c, b, b, c, d); bi.push(N + a, N + b, N + c, N + b, N + d, N + c);
  }
  const mk = (idx, map) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; };
  // fine fabric weave as a bump map
  const wv = document.createElement('canvas'); wv.width = wv.height = 16; { const x = wv.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#c8c8c8'; for (let a = 0; a < 16; a += 4) for (let b = 0; b < 16; b += 4) x.fillRect(a, b, 2, 2); x.fillStyle = '#505050'; for (let a = 2; a < 16; a += 4) for (let b = 2; b < 16; b += 4) x.fillRect(a, b, 2, 2); }
  const weave = new THREE.CanvasTexture(wv); weave.wrapS = weave.wrapT = THREE.RepeatWrapping; weave.repeat.set(90, 104);
  const tex = cv => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  const mat = cv => new THREE.MeshStandardMaterial({ map: tex(cv), bumpMap: weave, bumpScale: 0.35, roughness: 0.78, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.5, alphaToCoverage: true });
  const group = new THREE.Group(), front = new THREE.Mesh(mk(fi), mat(fc)), back = new THREE.Mesh(mk(bi), mat(bc));
  group.add(front, back);
  return { group, mats: [front.material, back.material], geos: [front.geometry, back.geometry], tex: [front.material.map, back.material.map, weave] };
}

async function openJersey3D() {
  if (_j3d) return;
  const ov = document.createElement('div'); ov.className = 'j3d'; ov.style.cssText = themeVars(S.teamId);
  ov.innerHTML = `<div class="j3d-top"><div><div class="eyebrow">3D VIEW</div><b class="j3d-title">${esc(jName(S.player))} · #${playerNumber()}</b></div><button class="j3d-x" data-j3d="close" aria-label="Close">✕</button></div>
    <div class="j3d-stage"><canvas class="j3d-cv"></canvas><div class="j3d-load"><i></i><span>Building your 3D jersey…</span></div></div>
    <div class="j3d-bar"><button data-j3d="front">FRONT</button><button data-j3d="back">BACK</button><button data-j3d="auto" class="on">⟳ AUTO-ROTATE</button><button data-j3d="reset">RESET VIEW</button><button data-j3d="save">📷 SAVE IMAGE</button></div>
    <div class="j3d-hint">Drag to rotate · scroll or pinch to zoom · double-click to reset</div>`;
  document.body.appendChild(ov);
  const st = { dead: false, raf: 0, off: [] }; _j3d = st;
  const close = () => { if (st.dead) return; st.dead = true; cancelAnimationFrame(st.raf); st.off.forEach(f => f()); if (st.dispose) st.dispose(); ov.classList.add('out'); setTimeout(() => ov.remove(), 260); _j3d = null; };
  st.close = close;
  try {
    const [THREE, cvs] = await Promise.all([import('./assets/vendor/three.module.min.js?v=' + (window.APP_BUILD || '1')), j3dCanvases(4)]);
    if (st.dead) return;
    const cv = ov.querySelector('.j3d-cv'), stage = ov.querySelector('.j3d-stage');
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa3b8, 1.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(-2.5, 3.5, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0xbfd8ff, 1.5); rim.position.set(3.5, 2, -4); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffe9d0, 1.0); fill.position.set(3, -1.5, 3.5); scene.add(fill);
    const side = new THREE.DirectionalLight(0xffffff, 0.9); side.position.set(-5, 0.5, -1); scene.add(side);
    const built = j3dBuild(THREE, cvs.front, cvs.back, renderer.capabilities.getMaxAnisotropy());
    const jersey = new THREE.Group(); jersey.add(built.group); scene.add(jersey);
    // soft contact shadow under the jersey
    const sh = document.createElement('canvas'); sh.width = sh.height = 128; { const x = sh.getContext('2d'), g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sh), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -2.15; scene.add(shadow);

    // view state: yaw/pitch with a little inertia, zoom with wheel / pinch
    const v = { yaw: -0.5, pitch: 0.08, vy: 0, vp: 0, dist: 8.2, auto: true, hold: 0, goal: null };
    const HOME = { yaw: -0.5, pitch: 0.08, dist: 8.2 }; st.v = v;
    const fit = () => { const r = stage.getBoundingClientRect(), w = Math.max(200, r.width), h = Math.max(200, r.height); renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w / h < 0.8 ? 40 : 30; HOME.dist = w / h < 0.8 ? 10.2 : 8.2; cam.updateProjectionMatrix(); };
    fit(); v.dist = HOME.dist; const ro = new ResizeObserver(fit); ro.observe(stage); st.off.push(() => ro.disconnect());
    const ptrs = new Map(); let pinch = 0;
    const on = (t, e, f, o) => { t.addEventListener(e, f, o); st.off.push(() => t.removeEventListener(e, f, o)); };
    on(cv, 'pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, e); v.hold = 2.5; v.goal = null; v.vy = v.vp = 0; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); } cv.classList.add('grab'); });
    on(cv, 'pointermove', e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      if (ptrs.size === 2) { ptrs.set(e.pointerId, e); const [a, b] = [...ptrs.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); if (pinch) v.dist = Math.min(15, Math.max(4.5, v.dist * pinch / d)); pinch = d; return; }
      const dx = e.clientX - p.clientX, dy = e.clientY - p.clientY; ptrs.set(e.pointerId, e);
      v.yaw += dx * 0.0095; v.pitch = Math.max(-0.7, Math.min(0.7, v.pitch + dy * 0.006)); v.vy = dx * 0.0095; v.vp = dy * 0.006; v.hold = 2.5;
    });
    const up = e => { ptrs.delete(e.pointerId); pinch = 0; if (!ptrs.size) cv.classList.remove('grab'); };
    on(cv, 'pointerup', up); on(cv, 'pointercancel', up);
    on(cv, 'wheel', e => { e.preventDefault(); v.dist = Math.min(15, Math.max(4.5, v.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
    const home = () => { v.goal = { ...HOME, yaw: Math.round((v.yaw - HOME.yaw) / (2 * Math.PI)) * 2 * Math.PI + HOME.yaw }; v.vy = v.vp = 0; };
    on(cv, 'dblclick', home);
    const setBtn = () => { ov.querySelector('[data-j3d=auto]').classList.toggle('on', v.auto); };
    on(document, 'keydown', e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') { v.yaw -= 0.2; v.hold = 2.5; } else if (e.key === 'ArrowRight') { v.yaw += 0.2; v.hold = 2.5; } else if (e.key === 'ArrowUp') v.pitch = Math.max(-0.7, v.pitch - 0.1); else if (e.key === 'ArrowDown') v.pitch = Math.min(0.7, v.pitch + 0.1); });
    const turn = target => { const base = Math.round((v.yaw - target) / (2 * Math.PI)) * 2 * Math.PI + target; v.goal = { yaw: base, pitch: 0.05, dist: v.dist }; v.vy = v.vp = 0; v.hold = 2.5; };
    on(ov, 'click', e => {
      const b = e.target.closest('[data-j3d]'); if (!b) return; const k = b.dataset.j3d;
      if (k === 'close') close(); else if (k === 'front') turn(0); else if (k === 'back') turn(Math.PI);
      else if (k === 'auto') { v.auto = !v.auto; setBtn(); } else if (k === 'reset') home();
      else if (k === 'save') { renderer.render(scene, cam); cv.toBlob(bl => { const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = `${jName(S.player).replace(/[^A-Z0-9]+/g, '-')}-${playerNumber()}-3d.png`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); toast('📷 3D view saved'); }, 'image/png'); }
    });
    st.dispose = () => { renderer.dispose(); built.geos.forEach(g => g.dispose()); built.mats.forEach(m => m.dispose()); built.tex.forEach(t => t.dispose()); shadow.geometry.dispose(); shadow.material.map.dispose(); shadow.material.dispose(); };
    ov.classList.add('ready');

    let last = performance.now(); const t0 = last;
    const loop = now => {
      if (st.dead) return; st.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (v.goal) {
        const k = 1 - Math.pow(0.0015, dt); v.yaw += (v.goal.yaw - v.yaw) * k; v.pitch += (v.goal.pitch - v.pitch) * k; v.dist += (v.goal.dist - v.dist) * k;
        if (Math.abs(v.goal.yaw - v.yaw) + Math.abs(v.goal.pitch - v.pitch) + Math.abs(v.goal.dist - v.dist) < 0.002) v.goal = null;
      } else if (!ptrs.size) {
        v.yaw += v.vy; v.pitch = Math.max(-0.7, Math.min(0.7, v.pitch + v.vp)); const f = Math.pow(0.04, dt); v.vy *= f; v.vp *= f;
        if (v.hold > 0) v.hold -= dt; else if (v.auto) { v.yaw += dt * 0.55; v.pitch += (0.08 - v.pitch) * Math.min(1, dt * 1.5); }
      }
      const tt = (now - t0) / 1000;
      jersey.rotation.set(v.pitch, v.yaw, 0, 'YXZ'); jersey.position.y = Math.sin(tt * 1.1) * 0.035; jersey.rotation.z = Math.sin(tt * 0.8) * 0.012;
      shadow.scale.setScalar(1 - Math.sin(tt * 1.1) * 0.025);
      cam.position.set(0, 0.15, v.dist); cam.lookAt(0, 0, 0);
      renderer.render(scene, cam);
    };
    st.raf = requestAnimationFrame(loop);
  } catch (e) {
    console.error(e); ov.querySelector('.j3d-load span').textContent = 'Could not start the 3D viewer on this device.'; ov.querySelector('.j3d-load i').style.display = 'none';
    ov.addEventListener('click', ev => { if (ev.target.closest('[data-j3d=close]')) close(); });
  }
}

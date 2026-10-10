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
  // the sleeve is one tube in 3D: its logo, swoosh and shoulder number live on the front half only (drawing them again on the back would print them twice, split by the seam)
  const cfgs = { front: cfg, back: { ...cfg, swoosh: false, sleeveLogo: false, noSideNums: true } };
  for (const v of ['front', 'back']) {
    const cv = document.createElement('canvas'); cv.width = Math.round(W * sc); cv.height = Math.round(H * sc);
    await jcDrawJersey(cv.getContext('2d'), cfgs[v], v, name, num, word, id, logoData, 0, 0, sc, undefined, extra);
    out[v] = cv;
    const bv = document.createElement('canvas'); bv.width = cv.width; bv.height = cv.height;
    await jcDrawJersey(bv.getContext('2d'), cfgs[v], v, name, num, word, id, logoData, 0, 0, sc, undefined, { ...(extra || {}), noOverlay: true });
    out[v + 'Base'] = bv;
  }
  out.body = jcColors(normJersey(cfg)).body;
  return out;
}


// where the names / numbers / plates are (full drawing minus the bare garment): raised, stitched "tackle twill" lettering
function j3dPrint(full, base) {
  const w = full.width, h = full.height, N = w * h, fx = full.getContext('2d'), F = fx.getImageData(0, 0, w, h), fd = F.data, bd = base.getContext('2d').getImageData(0, 0, w, h).data;
  const m = new Uint8Array(N);
  for (let k = 0; k < N; k++) { const o = k * 4, da = Math.abs(fd[o + 3] - bd[o + 3]), dc = Math.abs(fd[o] - bd[o]) + Math.abs(fd[o + 1] - bd[o + 1]) + Math.abs(fd[o + 2] - bd[o + 2]); m[k] = (fd[o + 3] > 40 && (da > 60 || dc > 90)) ? 255 : 0; }
  const minf = (src, r) => { const t = new Uint8Array(N), o = new Uint8Array(N); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 255; for (let d = -r; d <= r; d++) { const xx = x + d; if (xx < 0 || xx >= w) { v = 0; break; } if (src[y * w + xx] < v) v = src[y * w + xx]; } t[y * w + x] = v; } for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 255; for (let d = -r; d <= r; d++) { const yy = y + d; if (yy < 0 || yy >= h) { v = 0; break; } if (t[yy * w + x] < v) v = t[yy * w + x]; } o[y * w + x] = v; } return o; };
  const E = minf(m, 5);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {                        // stitching just inside the edge of every letter
    const k = y * w + x; if (!m[k] || E[k]) continue; if (((x + y) >> 3) & 1) continue;
    const o = k * 4, lum = (fd[o] * 0.3 + fd[o + 1] * 0.59 + fd[o + 2] * 0.11) / 255, f = lum > 0.28 ? 0.6 : 1.7;
    fd[o] = Math.min(255, fd[o] * f + (lum > 0.28 ? 0 : 20)); fd[o + 1] = Math.min(255, fd[o + 1] * f + (lum > 0.28 ? 0 : 20)); fd[o + 2] = Math.min(255, fd[o + 2] * f + (lum > 0.28 ? 0 : 20));
  }
  fx.putImageData(F, 0, 0);
  // soft raised relief (blurred mask)
  let a = Float32Array.from(m), b = new Float32Array(N); const R = 4;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) { let s = 0; for (let x = -R; x <= R; x++) s += a[y * w + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { b[y * w + x] = s / (2 * R + 1); s += a[y * w + Math.min(w - 1, x + R + 1)] - a[y * w + Math.max(0, x - R)]; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let y = -R; y <= R; y++) s += b[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { a[y * w + x] = s / (2 * R + 1); s += b[Math.min(h - 1, y + R + 1) * w + x] - b[Math.max(0, y - R) * w + x]; } }
  }
  const hc = document.createElement('canvas'); hc.width = w; hc.height = h; const hx = hc.getContext('2d'), H = hx.createImageData(w, h);
  for (let k = 0; k < N; k++) { const v = Math.max(0, Math.min(255, a[k])); H.data[k * 4] = H.data[k * 4 + 1] = H.data[k * 4 + 2] = v; H.data[k * 4 + 3] = 255; }
  hx.putImageData(H, 0, 0);
  return hc;
}
// tileable fabric: R = knit/mesh height, G = albedo (mesh holes), B = twill height (for the lettering)
function j3dFabric() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), im = x.createImageData(S, S), TAU = Math.PI * 2, ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const u = i / S * 4, v = j / S * 4, fu = u - Math.floor(u), fv = v - Math.floor(v), d = Math.hypot(fu - 0.5, fv - 0.5), hole = 1 - ss(0.1, 0.24, d);
    const rib = 0.5 + 0.5 * Math.sin(TAU * (u * 2 + 0.35 * Math.sin(TAU * v * 2))), cross = 0.5 + 0.5 * Math.sin(TAU * v * 2);
    const knit = 0.42 + 0.22 * rib + 0.12 * cross - 0.55 * hole, twill = 0.5 + 0.5 * Math.sin(TAU * 6 * ((i + j) / S)), o = (j * S + i) * 4;
    im.data[o] = Math.max(0, Math.min(1, knit)) * 255; im.data[o + 1] = (1 - 0.5 * hole - 0.08 * (1 - rib)) * 255; im.data[o + 2] = twill * 255; im.data[o + 3] = 255;
  }
  x.putImageData(im, 0, 0); return c;
}
// a soft studio environment (light boxes) so cloth and print pick up believable highlights
function j3dEnv(THREE, renderer) {
  const sc = new THREE.Scene(), add = (g, col, k, p) => { const mt = new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }), m = new THREE.Mesh(g, mt); m.position.set(...p); m.lookAt(0, 0, 0); sc.add(m); return m; };
  add(new THREE.BoxGeometry(24, 24, 24).scale(-1, 1, 1), 0x2b303c, 1, [0, 0, 0]).lookAt(0, 0, -1);
  add(new THREE.PlaneGeometry(9, 7), 0xffffff, 7, [-6, 6, 8]); add(new THREE.PlaneGeometry(7, 9), 0xdce8ff, 4, [9, 3, -4]); add(new THREE.PlaneGeometry(10, 4), 0xfff0dc, 3, [4, -4, 9]); add(new THREE.PlaneGeometry(14, 5), 0xffffff, 2.2, [0, 11, 0]);
  const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromScene(sc, 0.04); pm.dispose(); return rt;
}

// jersey-shaped, slightly inflated body: a front panel and a back panel that meet along the silhouette
function j3dBuild(THREE, cvs, maxAniso, bodyColor) {
  const fc = cvs.front, bc = cvs.back;
  const W = UNI.meta.w, H = UNI.meta.h, ST = 2, nx = Math.floor(W / ST) + 1, ny = Math.floor(H / ST) + 2, U = 0.01;
  const grab = (cv, flip) => { const c = document.createElement('canvas'); c.width = nx; c.height = ny; const x = c.getContext('2d'); if (flip) { x.translate(nx, 0); x.scale(-1, 1); } x.drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, nx, H / ST); return x.getImageData(0, 0, nx, ny).data; };
  // mask = where either side of the jersey has fabric (the back is mirrored into front coordinates)
  const fa = grab(fc, false), ba = grab(bc, true), M = new Uint8Array(nx * ny);
  for (let k = 0; k < nx * ny; k++) M[k] = (fa[k * 4 + 3] > 24 || ba[k * 4 + 3] > 24) ? 1 : 0;
  // the hem and the sleeve openings are not seams: extend the mask past them so the panels stay apart there
  let jmax = 0; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (M[j * nx + i]) jmax = j;
  const PAD = 16, ph = ny + PAD, P = new Uint8Array(nx * ph); P.set(M);
  for (let j = jmax + 1; j < ph; j++) for (let i = 0; i < nx; i++) P[j * nx + i] = M[jmax * nx + i];
  // the sleeve ends are openings too: push the "inside" 16 units past each cuff (the cuff edge from the drawing, slanted down and out) so the two panels stay apart there
  const CUFF = [[71.76, 153.48], [59.01, 152.52], [43.41, 148.38], [20.79, 141.36], [14.5, 138.5]];
  for (const sgn of [1, -1]) for (let q = 0; q < CUFF.length - 1; q++) {
    const [x0, y0] = CUFF[q], [x1, y1] = CUFF[q + 1], cn = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.5);
    for (let a = 0; a <= cn; a++) { const x = x0 + (x1 - x0) * a / cn, y = y0 + (y1 - y0) * a / cn;
      for (let t = 0; t <= 16; t += 0.5) { const px = sgn > 0 ? x - 0.334 * t : W - x + 0.334 * t, py = y + 0.94 * t, ci = Math.round(px / ST), cj = Math.round(py / ST); if (ci >= 0 && ci < nx && cj >= 0 && cj < ph) P[cj * nx + ci] = 1; } }
  }
  // distance from the nearest edge (chamfer transform)
  const D = new Float32Array(nx * ph), BIG = 1e5, R2 = Math.SQRT2;
  for (let k = 0; k < D.length; k++) D[k] = P[k] ? BIG : 0;
  for (let j = 0; j < ph; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (!D[k]) continue; let v = D[k]; if (i > 0) v = Math.min(v, D[k - 1] + 1); if (j > 0) { v = Math.min(v, D[k - nx] + 1); if (i > 0) v = Math.min(v, D[k - nx - 1] + R2); if (i < nx - 1) v = Math.min(v, D[k - nx + 1] + R2); } D[k] = v; }
  for (let j = ph - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { const k = j * nx + i; if (!D[k]) continue; let v = D[k]; if (i < nx - 1) v = Math.min(v, D[k + 1] + 1); if (j < ph - 1) { v = Math.min(v, D[k + nx] + 1); if (i < nx - 1) v = Math.min(v, D[k + nx + 1] + R2); if (i > 0) v = Math.min(v, D[k + nx - 1] + R2); } D[k] = v; }
  const blur = (A, rad, passes) => { const T = new Float32Array(A.length); for (let q = 0; q < passes; q++) { for (let j = 0; j < ph; j++) for (let i = 0; i < nx; i++) { let a = 0, n = 0; for (let di = -rad; di <= rad; di++) { const ii = i + di; if (ii >= 0 && ii < nx) { a += A[j * nx + ii]; n++; } } T[j * nx + i] = a / n; } for (let j = 0; j < ph; j++) for (let i = 0; i < nx; i++) { let a = 0, n = 0; for (let dj = -rad; dj <= rad; dj++) { const jj = j + dj; if (jj >= 0 && jj < ph) { a += T[jj * nx + i]; n++; } } A[j * nx + i] = a / n; } } };
  // local half-width of the garment (ridge of the distance field): torso ~70, sleeves ~27
  const Wd = new Float32Array(D.length), Tm = new Float32Array(D.length), RW = 18;
  for (let j = 0; j < ph; j++) for (let i = 0; i < nx; i++) { let m = 0; for (let di = -RW; di <= RW; di++) { const ii = i + di; if (ii >= 0 && ii < nx) m = Math.max(m, D[j * nx + ii]); } Tm[j * nx + i] = Math.min(m, 60); }
  for (let j = 0; j < ph; j++) for (let i = 0; i < nx; i++) { let m = 0; for (let dj = -RW; dj <= RW; dj++) { const jj = j + dj; if (jj >= 0 && jj < ph) m = Math.max(m, Tm[jj * nx + i]); } Wd[j * nx + i] = m; }
  blur(Wd, 7, 3);
  const hgt = (i, j) => {
    const k = j * nx + i, d = Math.min(D[k], 60) * ST, w = Math.max(d, Wd[k] * ST);
    const body = 0.56 * Math.sqrt(Math.max(0, d * (2 * w - d)));          // elliptical cross-section: front and back wrap around into the side seams
    const pinch = Math.min(1, d / 11); const seam = pinch * pinch;           // flat, sewn seam: both panels close exactly on the outline
    const x = i * ST - W / 2, y = j * ST;
    const wrinkle = Math.sin(y * 0.11 + x * 0.045) * 0.9 + Math.sin(y * 0.05 - x * 0.12 + 1.7) * 0.8 + Math.sin(x * 0.2 + y * 0.03) * 0.35;   // soft folds
    return body * seam + wrinkle * Math.min(1, d / 16) * seam;
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
  // fabric + stitched print (see j3dPrint / j3dFabric); the shader mixes mesh-knit body fabric and twill lettering
  const fabTex = new THREE.CanvasTexture(j3dFabric()); fabTex.wrapS = fabTex.wrapT = THREE.RepeatWrapping; fabTex.anisotropy = maxAniso;
  const tex = cv => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  const mat = (cv, base) => {
    const relief = new THREE.CanvasTexture(j3dPrint(cv, base)); relief.anisotropy = maxAniso;
    const m = new THREE.MeshPhysicalMaterial({ map: tex(cv), bumpMap: relief, bumpScale: 2.4, roughness: 0.86, metalness: 0, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x9aa4b8), envMapIntensity: 0.55, side: THREE.FrontSide, alphaTest: 0.5, alphaToCoverage: true });
    m.userData.relief = relief;
    m.onBeforeCompile = sh => {
      sh.uniforms.fabTex = { value: fabTex }; sh.uniforms.fabRep = { value: new THREE.Vector2(24, 28) }; sh.uniforms.fabBump = { value: 0.55 };
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D fabTex; uniform vec2 fabRep; uniform float fabBump;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec2 fUv = vMapUv * fabRep; vec3 fb = texture2D(fabTex, fUv).rgb; float pm = texture2D(bumpMap, vBumpMapUv).x;
          diffuseColor.rgb *= mix(0.80 + 0.26 * fb.g, 0.9 + 0.22 * fb.b, pm);`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n          roughnessFactor = mix(roughnessFactor, 0.52, pm);')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          float Hf = mix(fb.r, fb.b, pm) * fabBump; normal = perturbNormalArb(- vViewPosition, normal, vec2(dFdx(Hf), dFdy(Hf)), faceDirection);`);
    };
    return m;
  };
  // the inside of the jersey (seen through the neck, the hem and the sleeve ends) is a plain, darker lining
  const lin = new THREE.Color(/^#|^rgb/i.test(bodyColor || '') ? bodyColor : '#444a58').multiplyScalar(0.5);
  const alphaOf = cv => { const c = document.createElement('canvas'); c.width = 600; c.height = Math.round(600 * cv.height / cv.width); const x = c.getContext('2d'); x.drawImage(cv, 0, 0, c.width, c.height); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); return new THREE.CanvasTexture(c); };
  const inner = cv => new THREE.MeshStandardMaterial({ color: lin, alphaMap: alphaOf(cv), roughness: 0.9, metalness: 0, side: THREE.BackSide, alphaTest: 0.5, alphaToCoverage: true });
  const group = new THREE.Group(), gf = mk(fi), gb = mk(bi), mF = mat(fc, cvs.frontBase), mB = mat(bc, cvs.backBase), iF = inner(fc), iB = inner(bc);
  group.add(new THREE.Mesh(gf, mF), new THREE.Mesh(gb, mB), new THREE.Mesh(gf, iF), new THREE.Mesh(gb, iB));
  return { group, mats: [mF, mB, iF, iB], geos: [gf, gb], tex: [mF.map, mB.map, mF.userData.relief, mB.userData.relief, iF.alphaMap, iB.alphaMap, fabTex] };
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
    const envRT = j3dEnv(THREE, renderer); scene.environment = envRT.texture;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa3b8, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(-2.5, 3.5, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0xbfd8ff, 1.5); rim.position.set(3.5, 2, -4); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffe9d0, 1.0); fill.position.set(3, -1.5, 3.5); scene.add(fill);
    const side = new THREE.DirectionalLight(0xffffff, 0.9); side.position.set(-5, 0.5, -1); scene.add(side);
    const built = j3dBuild(THREE, cvs, renderer.capabilities.getMaxAnisotropy(), cvs.body);
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
    st.dispose = () => { envRT.dispose(); renderer.dispose(); built.geos.forEach(g => g.dispose()); built.mats.forEach(m => m.dispose()); built.tex.forEach(t => t.dispose()); shadow.geometry.dispose(); shadow.material.map.dispose(); shadow.material.dispose(); };
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

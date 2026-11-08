// special.js — the "special" family of Patakha '97.
//   lighting-ritual  #146 #147 #148 #149 #150 #152 #153 #154 #155 #157 #194  the art of lighting, first person
//   agarbatti-chain  #119  three incense delays, three bangs, one after another
//   sleeper-dud      #123  the dud that wakes up when you lean in
//   mud-killa        #142 #143 #144  the courtyard fort the day before: anaar cannon, matchbox village, toy soldiers
//   dud-hunt         #159  the morning after: find the fuskis in the red paper
//   deepavali-dawn   #210  Tamil Nadu morning: saram, then the Lakshmi vedi
//   narakasur        #223  Goa: the papier-mache demon burns before dawn and topples
// Everything here is virtual play; no construction detail beyond "an agarbatti next to a wick".
(function () {
  'use strict';
  const { Body, v3, M3 } = Phys;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const lp = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
  const easeOut = t => 1 - (1 - t) * (1 - t);
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const hash = (i, j) => { const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shade = (rgb, k) => rgb.map(v => v * k);
  const ready = i => i && i.complete && i.naturalWidth > 0;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const I3 = M3.I();
  const stage = () => (typeof Stage !== 'undefined' ? Stage : null);
  const isArmed = () => { const st = stage(); return !st || st.phase === 'armed'; };
  // Pull the camera back to the wide plate (the "run back", or to fit a 3 m effigy).
  const zoomOut = api => { const st = stage(); if (st && st.goPlace) st.goPlace(api.place, false); };

  // ---------- little timeline ----------
  const later = (s, at, fn) => s.queue.push({ at, fn });
  function runQueue(s) {
    for (let i = s.queue.length - 1; i >= 0; i--) if (s.now >= s.queue[i].at) { const q = s.queue[i]; s.queue.splice(i, 1); q.fn(); }
  }

  // ---------- sound: footsteps and a far-off rooster, built on Sfx's modal synth ----------
  Sfx.MODES['patakha-thump'] = [[64, 0.11, 1], [118, 0.07, 0.5], [190, 0.04, 0.25]];
  Sfx.MODES['patakha-rooster'] = [[640, 0.16, 1], [1280, 0.12, 0.4], [1920, 0.07, 0.15]];
  function footstep(api, i) { api.Sfx.strike('patakha-thump', { vol: 0.6 * Math.max(0.3, 1 - i * 0.13), pan: i % 2 ? 0.22 : -0.22, detune: rnd(0.9, 1.1) }); }
  const CROW = [[0, 1.0], [0.12, 1.22], [0.24, 1.18], [0.42, 1.42], [0.47, 1.36], [0.52, 1.44], [0.57, 1.37], [0.62, 1.42], [0.67, 1.35], [0.76, 1.05]];
  function rooster(s, api, at, vol = 0.13) { for (const [d, f] of CROW) later(s, at + d, () => api.Sfx.strike('patakha-rooster', { vol, pan: -0.55, detune: f })); }

  // ---------- geometry ----------
  function box(w, h, d, rgb, o = {}) {
    const x = w / 2, z = d / 2, y0 = o.center ? -h / 2 : 0, y1 = y0 + h;
    const p = [[-x, y0, -z], [x, y0, -z], [x, y0, z], [-x, y0, z], [-x, y1, -z], [x, y1, -z], [x, y1, z], [-x, y1, z]];
    const faces = [
      { pts: [p[4], p[5], p[6], p[7]], n: [0, 1, 0], rgb: o.top || rgb },
      { pts: [p[3], p[2], p[6], p[7]], n: [0, 0, 1], rgb: o.front || rgb },
      { pts: [p[0], p[1], p[5], p[4]], n: [0, 0, -1], rgb: shade(rgb, 0.92) },
      { pts: [p[1], p[2], p[6], p[5]], n: [1, 0, 0], rgb: shade(rgb, 0.96) },
      { pts: [p[0], p[3], p[7], p[4]], n: [-1, 0, 0], rgb: shade(rgb, 0.96) },
    ];
    if (o.bottom) faces.push({ pts: [p[0], p[1], p[2], p[3]], n: [0, -1, 0], rgb: shade(rgb, 0.7) });
    return { faces, hull: p };
  }
  // Frustum on +y from 0 to h (a cone when r1 = 0), with sloped normals.
  function frustum(r0, r1, h, o = {}) {
    const segs = o.segs || 10, bands = o.bands || 1, slope = (r0 - r1) / h, rings = [], faces = [];
    for (let b = 0; b <= bands; b++) {
      const r = r0 + (r1 - r0) * b / bands, y = h * b / bands, ring = [];
      for (let i = 0; i < segs; i++) { const a = i / segs * TAU; ring.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
      rings.push(ring);
    }
    for (let b = 0; b < bands; b++) for (let i = 0; i < segs; i++) {
      const i2 = (i + 1) % segs, a = (i + 0.5) / segs * TAU;
      faces.push({ pts: [rings[b][i], rings[b][i2], rings[b + 1][i2], rings[b + 1][i]], n: v3.norm([Math.cos(a), slope, Math.sin(a)]), rgb: o.colourAt ? o.colourAt(i, b) : o.rgb });
    }
    if (o.top !== false && r1 > 0.001) faces.push({ pts: rings[bands].slice().reverse(), n: [0, 1, 0], rgb: o.top || o.rgb || faces[faces.length - 1].rgb });
    if (o.bottom) faces.push({ pts: rings[0].slice(), n: [0, -1, 0], rgb: o.bottom });
    return { faces, hull: [...rings[0], ...rings[bands]] };
  }
  function sphere(r, o = {}) {
    const lat = o.lat || 6, lon = o.lon || 10, sq = o.squash || 1, grid = [], faces = [];
    for (let i = 0; i <= lat; i++) {
      const phi = -Math.PI / 2 + Math.PI * i / lat, row = [];
      for (let j = 0; j < lon; j++) { const th = j / lon * TAU; row.push([Math.cos(th) * Math.cos(phi) * r, Math.sin(phi) * r * sq, Math.sin(th) * Math.cos(phi) * r]); }
      grid.push(row);
    }
    for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) {
      const j2 = (j + 1) % lon, phi = -Math.PI / 2 + Math.PI * (i + 0.5) / lat, th = (j + 0.5) / lon * TAU;
      faces.push({ pts: [grid[i][j], grid[i][j2], grid[i + 1][j2], grid[i + 1][j]], n: [Math.cos(th) * Math.cos(phi), Math.sin(phi), Math.sin(th) * Math.cos(phi)], rgb: o.colourAt ? o.colourAt(i, j) : o.rgb });
    }
    return { faces, hull: [grid[0][0], grid[lat][0], ...grid[lat >> 1]] };
  }
  // A frustum from point a to point b (arms, sticks, horns).
  function limb(a, b, r0, r1, o = {}) {
    const d = v3.sub(b, a), len = v3.len(d), y = v3.scale(d, 1 / len);
    let x = v3.cross(y, [0, 0, 1]); if (v3.len(x) < 1e-3) x = [1, 0, 0]; x = v3.norm(x);
    const z = v3.cross(x, y), R = [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
    return Mesh.place(frustum(r0, r1, len, o).faces, R, a);
  }
  const scaleFaces = (faces, k) => k === 1 ? faces : faces.map(f => ({ ...f, pts: f.pts.map(p => v3.scale(p, k)) }));

  // ---------- crackers ----------
  const BOMBS = {
    atom:    { size: 1.0, r: 0.13, wick: [[0, 0.222, 0], [0.03, 0.3, 0.02], [0.075, 0.34, 0.05]] },
    lakshmi: { size: 0.75, r: 0.17, wick: [[0.15, 0.05, 0], [0.2, 0.068, 0.03], [0.25, 0.05, 0.07]] },
    bijli:   { size: 0.38, r: 0.12, wick: [[0.1, 0.024, 0], [0.135, 0.036, 0.02], [0.17, 0.026, 0.045]] },
  };
  function bombFaces(kind, burnt = false) {
    if (kind === 'atom') {
      const m = sphere(0.12, { lat: 5, lon: 10, squash: 0.94, colourAt: (i, j) => burnt && i >= 3 && j < 4 ? [38, 32, 26] : i === 2 ? (j % 2 ? [222, 182, 66] : [194, 46, 38]) : shade([62, 104, 58], 0.8 + 0.4 * hash(i, j)) });
      return Mesh.place(m.faces, I3, [0, 0.113, 0]);
    }
    if (kind === 'anaar') {
      const m = frustum(0.12, 0.035, 0.42, { segs: 9, bands: 2, colourAt: (i, b) => burnt && b === 1 ? [46, 36, 30] : (i % 3 ? [196, 60, 40] : [60, 120, 70]), top: burnt ? [30, 24, 20] : [120, 90, 60] });
      return m.faces;
    }
    const bij = kind === 'bijli', r = bij ? 0.024 : 0.05, h = bij ? 0.2 : 0.3;
    const m = Mesh.cylinder(r, h, { segs: 8, bands: 3, colourAt: (sg, b) => burnt && b === 2 ? [44, 34, 28] : b === 1 ? (bij ? [210, 186, 120] : [228, 196, 78]) : [196, 44, 36], top: burnt ? [30, 24, 20] : [176, 40, 34], bottom: [176, 40, 34] });
    // lying on its side; rotZ maps the cylinder's +y to −x, so the wick end (+x) is the bottom cap
    return Mesh.place(m.faces, M3.rotZ(Math.PI / 2), [0, r, 0]);
  }
  function makeBomb(kind, at = [0, 0, 0], k = 1, yaw = 0) {
    const B = BOMBS[kind] || BOMBS.atom, R = M3.rotY(yaw);
    const tf = p => v3.add(at, M3.mulV(R, v3.scale(p, k)));
    return { kind, size: B.size, at, k, r: B.r * k, faces: Mesh.place(scaleFaces(bombFaces(kind), k), R, at), wick: B.wick.map(tf) };
  }
  // point along the wick: p = 0 at the tip, 1 at the base
  function wickPoint(b, p) {
    const [base, mid, tip] = b.wick;
    return p < 0.5 ? lerp3(tip, mid, p * 2) : lerp3(mid, base, (p - 0.5) * 2);
  }
  function drawWick(api, b, burnt = 0) {
    const c = api.ctx, pts = [b.wick[0], b.wick[1], wickPoint(b, burnt)];
    if (burnt > 0.5) pts.splice(1, 1, wickPoint(b, burnt));
    const q0 = api.project(pts[0]);
    c.save(); c.lineCap = 'round'; c.strokeStyle = '#b9a988'; c.lineWidth = Math.max(1.3, api.cam.scale * 0.02 * b.k * q0.f);
    c.beginPath(); pts.forEach((p, i) => { const q = api.project(p); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); }); c.stroke(); c.restore();
  }
  function drawBomb(api, b, burnt = 0) {
    api.shadow(b.at, b.r, 0);
    api.drawFaces(b.faces);
    if (burnt < 1) drawWick(api, b, burnt);
  }
  function scorch(api, at, r) {
    api.remain((ctx, a) => {
      const c = a.project([at[0], 0.002, at[2]]), rr = a.cam.scale * r * c.f;
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, 0.45);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr); g.addColorStop(0, 'rgba(18,12,9,.55)'); g.addColorStop(1, 'rgba(18,12,9,0)');
      ctx.fillStyle = g; ctx.fillRect(-rr, -rr, rr * 2, rr * 2); ctx.restore();
    });
  }
  // The shared bang: Sfx.boom, sparks, red paper, smoke, light, shake, scorch.
  function bang(api, at, size, o = {}) {
    const pan = o.pan ?? api.panOf(at), p = [at[0], at[1] + 0.05, at[2]];
    if (!o.silent) api.Sfx.boom({ vol: o.vol ?? 0.85, size, muffle: o.muffle ?? 0.12, pan });
    if (!o.dark) {
      api.burst(p, Math.round(140 * size), 10 * size, { flat: true });
      api.paper(p, Math.round(24 * size), 4.5 * size, o.colours);
      api.smoke(p, Math.round(12 * size));
    }
    api.light([at[0], at[1] + 0.2, at[2]], 0.7 + size * 0.5);
    api.shake(o.shake ?? 4 + 5 * size);
    scorch(api, at, 0.25 + 0.3 * size);
  }

  // ---------- screen-space drawing ----------
  function glow(c, x, y, r, rgb, a) {
    if (!(r > 0) || a <= 0) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); c.restore();
  }
  function flame(c, x, y, h, t, o = {}) {
    const f = 1 + Math.sin(t * 23) * 0.07 + Math.sin(t * 37 + 1) * 0.05, hh = h * f, w = h * (o.w || 0.3), sway = Math.sin(t * 9) * h * 0.08;
    glow(c, x, y - hh * 0.4, hh * (o.halo || 1.8), o.glow || '255,160,60', 0.32);
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(x, y, x, y - hh);
    g.addColorStop(0, o.base || 'rgba(255,120,30,0.95)'); g.addColorStop(0.45, 'rgba(255,196,84,0.9)'); g.addColorStop(1, 'rgba(255,240,200,0.05)');
    c.fillStyle = g; c.beginPath(); c.moveTo(x + sway, y - hh); c.quadraticCurveTo(x + w, y - hh * 0.25, x, y); c.quadraticCurveTo(x - w, y - hh * 0.25, x + sway, y - hh); c.fill();
    c.restore();
  }
  function stroke(c, a, b, col, w) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
  function label(c, text, x, y, o = {}) {
    c.save(); c.font = `600 ${o.size || 15}px system-ui, sans-serif`; c.textAlign = o.align || 'left';
    c.fillStyle = 'rgba(0,0,0,.45)'; c.fillText(text, x + 1, y + 1); c.fillStyle = o.colour || 'rgba(255,244,220,.92)'; c.fillText(text, x, y); c.restore();
  }
  function vignette(c, W, H, a) {
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
    c.fillStyle = g; c.fillRect(-20, -20, W + 40, H + 40);
  }
  // Pre-dawn blue (194), softer dawn (210), night before dawn (223).
  function tintDawn(c, W, H, k) {
    c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = `rgba(58,76,150,${0.78 * k})`; c.fillRect(-20, -20, W + 40, H + 40);
    c.globalCompositeOperation = 'source-over'; c.fillStyle = `rgba(6,12,36,${0.28 * k})`; c.fillRect(-20, -20, W + 40, H + 40);
    c.restore();
  }
  // Cool morning wash with drifting haze (159, 123).
  function makeHaze() { const h = []; for (let i = 0; i < 5; i++) h.push({ x: rnd(0, 1.2), y: rnd(0.35, 0.8), r: rnd(0.18, 0.34), v: rnd(0.008, 0.025), a: rnd(0.07, 0.13) }); return h; }
  function tintMorning(c, W, H, t, haze, k = 1) {
    c.save();
    c.globalCompositeOperation = 'screen'; c.fillStyle = `rgba(105,128,160,${0.34 * k})`; c.fillRect(-20, -20, W + 40, H + 40);
    c.globalCompositeOperation = 'multiply'; c.fillStyle = `rgba(196,212,236,${0.7 * k})`; c.fillRect(-20, -20, W + 40, H + 40);
    c.globalCompositeOperation = 'source-over';
    for (const h of haze) {
      const x = (((h.x + t * h.v) % 1.5) + 1.5) % 1.5 - 0.25, r = h.r * W;
      const g = c.createRadialGradient(x * W, h.y * H, 0, x * W, h.y * H, r);
      g.addColorStop(0, `rgba(226,233,242,${h.a * k})`); g.addColorStop(1, 'rgba(226,233,242,0)');
      c.fillStyle = g; c.fillRect(x * W - r, h.y * H - r, 2 * r, 2 * r);
    }
    c.restore();
  }
  // Red cracker paper (and a few burnt bits) lying flat on the road.
  function makeScraps(n, x0, x1, z0, z1) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const burnt = Math.random() < 0.16;
      out.push({ x: rnd(x0, x1), z: rnd(z0, z1), yaw: rnd(0, TAU), w: rnd(0.05, 0.14), h: rnd(0.03, 0.08), col: burnt ? '#2a221d' : pick(['#b0302a', '#c23a2e', '#9a2a24', '#c9a24a', '#b8342c', '#a82c26']) });
    }
    return out;
  }
  function drawScraps(api, list) {
    const c = api.ctx, sc = api.cam.scale;
    for (const p of list) {
      const q = api.project([p.x, 0.003, p.z]), s = sc * q.f;
      if (q.y < -10 || q.y > api.H + 10) continue;
      c.save(); c.translate(q.x, q.y); c.scale(1, 0.45); c.rotate(p.yaw);
      c.fillStyle = p.col; c.fillRect(-p.w * s / 2, -p.h * s / 2, p.w * s, p.h * s); c.restore();
    }
  }

  // ---------- the first-person hand (pov-hand.webp pinches a thin stick at ~(365,378), pointing left) ----------
  const HAND = { px: 365, py: 378, a0: Math.atan2(-6, -53) };
  function drawHand(api, P, rot, o = {}) {
    const im = api.img('pov-hand'); if (!ready(im)) return;
    const c = api.ctx, k = (o.size || 0.8) * api.H / 1000;
    c.save(); c.translate(P.x, P.y); c.rotate(rot); if (o.mirror) c.scale(-1, 1);
    if (o.alpha != null) c.globalAlpha = o.alpha;
    c.drawImage(im, -HAND.px * k, -HAND.py * k, 1000 * k, 1000 * k); c.restore();
  }

  // ======================================================================================
  // lighting-ritual: a small bomb on the floor, a lighter in your hand. Drag the burning
  // end to the wick, hold it there till it catches, and the camera runs back.
  // ======================================================================================
  const TOOLS = {
    agarbatti: { draw: 'agarbatti', len: 0.30, catch: 0.75, follow: 14, wob: 0.002 },
    broom:     { draw: 'broom', len: 0.95, catch: 0.6, spring: true, wob: 0.026 },
    candle:    { draw: 'phuljhadi', len: 0.36, catch: 0.2, follow: 14, wob: 0.002, station: 'candle' },
    parapet:   { draw: 'phuljhadi', len: 0.36, catch: 0.2, follow: 14, wob: 0.002, station: 'diya' },
    gas:       { draw: 'phuljhadi', len: 0.36, catch: 0.2, follow: 14, wob: 0.002, station: 'stove', noBomb: true },
    newspaper: { draw: 'newspaper', len: 0.30, catch: 0.12, follow: 11, wob: 0.006 },
    sparkler:  { draw: 'sparkler', len: 0.62, catch: 0.25, follow: 9, wob: 0.011 },
  };
  const stoveGeom = api => { const rx = Math.min(api.W, api.H) * 0.13; return { cx: api.W * 0.25, cy: api.H * 0.86, rx, ry: rx * 0.3 }; };

  function lrPose(s, api) {
    const W = api.W, H = api.H, T = s.T, wob = T.wob * H, t = s.now;
    const F = { x: s.tip.x + (Math.sin(t * 5.3) + 0.6 * Math.sin(t * 8.7 + 1)) * wob, y: s.tip.y + (Math.cos(t * 4.1) + 0.5 * Math.sin(t * 9.3)) * wob };
    const A = { x: W * 0.86, y: H * 1.45 };
    let dx = F.x - A.x, dy = F.y - A.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const L = T.len * H;
    let frac = 1;
    if (T.draw === 'newspaper') frac = s.paper;
    else if ((T.draw === 'phuljhadi' || T.draw === 'sparkler') && s.lit) frac = 1 - 0.55 * s.burn;
    const P = { x: F.x - dx * L * frac, y: F.y - dy * L * frac }, E = { x: P.x + dx * L, y: P.y + dy * L };
    const ox = s.drop * W * 0.12, oy = s.drop * H * 1.15;
    for (const p of [F, P, E]) { p.x += ox; p.y += oy; }
    s.F = F; s.P = P; s.E = E; s.dir = { x: dx, y: dy }; s.ang = Math.atan2(dy, dx);
  }
  function lrStation(s, api) {
    const st = s.station;
    if (!st) return null;
    if (st.kind === 'stove') { const g = stoveGeom(api); return { x: g.cx, y: g.cy - g.ry * 0.8, rx: g.rx * 1.1, ry: g.ry * 2.6 }; }
    const q = api.project(st.flame), r = Math.max(18, api.cam.scale * 0.12 * s.k);
    return { x: q.x, y: q.y - r * 0.3, rx: r, ry: r };
  }
  const lrWickScreen = (s, api) => api.project(s.bomb.wick[2]);
  const lrHitR = (s, api) => Math.max(18 * api.H / 800, api.cam.scale * 0.12 * s.k);

  function lrLightTool(s, api) {
    s.lit = true; s.litAt = s.armedT;
    s.sizzle = api.Sfx.fuse({ vol: 0.045, pan: 0.3 });
    api.Sfx.crack({ vol: 0.2, pieces: 2, pan: 0.2 });
    if (s.T.noBomb) api.ignite();
  }

  function lrToolFx(s, api, dt) {
    if (s.drop >= 1) return;
    const kind = s.T.draw, F = s.F, u = api.H / 800;
    if (kind === 'agarbatti' || kind === 'broom') {
      s.threadT += dt;
      if (s.threadT > 0.035) { s.threadT = 0; s.thread.push({ x: F.x, y: F.y, a: 0, ph: rnd(0, TAU) }); if (s.thread.length > 60) s.thread.shift(); }
    } else if ((kind === 'phuljhadi' || kind === 'sparkler') && s.lit) {
      const n = api.reduced ? 1 : kind === 'sparkler' ? 7 : 5;
      for (let i = 0; i < n; i++) { const a = rnd(0, TAU), sp = rnd(40, 190) * u; api.sparkScreen(F.x, F.y, Math.cos(a) * sp, Math.sin(a) * sp, { life: rnd(0.12, 0.42), size: rnd(0.6, 1.3), color: Math.random() < 0.5 ? 'white' : 'gold', gravity: 200 }); }
      const g = api.unproject(F.x, F.y); if (g) api.light(g, 0.22, [255, 232, 196]);
    } else if (kind === 'newspaper') {
      for (let i = 0; i < (api.reduced ? 1 : 2); i++) api.sparkScreen(F.x + rnd(-8, 8) * u, F.y - rnd(0, 20) * u, rnd(-25, 25) * u, -rnd(40, 110) * u, { life: rnd(0.3, 0.8), size: rnd(0.6, 1.1), gravity: -40 });
      s.smokeT += dt;
      if (s.smokeT > 0.14) { s.smokeT = 0; const g = api.unproject(F.x, F.y - 30 * u); if (g) api.smoke(g, 1, { size: 0.8 }); }
      const g = api.unproject(F.x, F.y); if (g) api.light(g, 0.35);
    }
    for (let i = s.thread.length - 1; i >= 0; i--) {
      const p = s.thread[i]; p.a += dt; p.y -= (22 + p.a * 16) * u * dt; p.x += Math.sin(p.a * 3 + p.ph) * 12 * u * dt;
      if (p.a > 1.8) s.thread.splice(i, 1);
    }
  }

  function lrRun(s, api, e) {
    s.ranAt = e; s.reaction = e;
    zoomOut(api);
    if (!s.T.noBomb) { s.sizzle?.stop(); s.sizzle = null; }
    api.Sfx.whoosh({ vol: 0.07, dur: 0.35 });
  }

  function lrBang(s, api, e) {
    s.bangAt = e; s.fuseSnd?.stop(); s.fuseSnd = null;
    const b = s.bomb, at = [b.at[0], 0.06 * b.k, b.at[2]], o = s.o;
    if (o.sense === 'eyes') {
      // eyes shut: you hear it through your palms and see it through your eyelids
      api.Sfx.boom({ vol: 0.9, size: b.size, muffle: 0.88, pan: 0 });
      bang(api, at, b.size, { silent: true, dark: true, shake: 7 });
      s.flash = 1;
    } else if (o.sense === 'ear') {
      api.Sfx.boom({ vol: 0.55, size: b.size, muffle: 0.9, pan: -0.85 });   // the plugged ear
      api.Sfx.boom({ vol: 0.85, size: b.size, muffle: 0.05, pan: 0.85 });   // the open one
      bang(api, at, b.size, { silent: true });
    } else bang(api, at, b.size);
    if (o.scene === 'dawn') {
      s.clockAt = s.clock;
      later(s, s.now + 1.7, () => api.Sfx.boom({ vol: 0.22, size: 0.8, muffle: 0.55, pan: -0.7 }));
      later(s, s.now + 2.5, () => api.Sfx.boom({ vol: 0.14, size: 0.6, muffle: 0.65, pan: 0.6 }));
    }
  }

  function lrFmtClock(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60;
    return `${h}:${String(m).padStart(2, '0')} AM`;
  }

  const LR = DiwaliTricks.register({
    id: 'lighting-ritual',
    name: 'The art of lighting',
    compendium: [146, 147, 148, 149, 150, 152, 153, 154, 155, 157, 194],
    mode: 'ground',
    views: ['doorstep', 'lane', 'roof', 'room'],
    fuse: 1.6,
    interactive: true,
    options: [
      { key: 'tool', label: 'Lighter', choices: [['agarbatti', 'Agarbatti'], ['broom', 'Agarbatti on a broomstick'], ['candle', 'Mombatti station'], ['parapet', 'Parapet diya'], ['gas', 'Kitchen gas'], ['newspaper', 'Newspaper torch'], ['sparkler', 'Long sparkler']], default: 'agarbatti' },
      { key: 'bomb', label: 'Bomb', choices: [['atom', 'Atom bomb'], ['lakshmi', 'Lakshmi'], ['bijli', 'Bijli']], default: 'atom' },
    ],
    spentLine: 'Light it, and run',

    create(api, o) {
      api.img('pov-hand');
      LR.spentLine = o.line || 'Light it, and run';
      const T = TOOLS[o.tool] || TOOLS.agarbatti, k = api.place === 'roof' ? 2.2 : 1;   // the parapet ledge is nearer than the roof's stage point
      const s = {
        o, T, k, bomb: T.noBomb ? null : makeBomb(o.bomb || 'atom', [0, 0, 0], k, o.bomb === 'atom' ? 0 : -0.35),
        now: 0, armedT: 0, e: 0, queue: [], tip: { x: api.W * 0.74, y: api.H * (T.draw === 'broom' ? 0.5 : 0.62) }, tv: { x: 0, y: 0 },
        heat: 0, sheat: 0, lit: !T.station, litAt: null, contact: 0, touching: false, slips: 0, firstTouch: null,
        burn: 0, paper: 1, rolls: 1, thread: [], threadT: 0, smokeT: 0, live: false, fuse: o.fuse || 1.6,
        ranAt: null, bangAt: null, drop: 0, steps: 0, eyes: 0, flash: 0, ear: 0, stoveOn: 1, clock: 4 * 3600 + 30 * 60 + 50,
      };
      if (T.station === 'candle') {
        const at = [-1.75, 0, 0.55];
        s.station = { kind: 'candle', at, flame: [at[0], 0.44, at[2]], faces: Mesh.place(Mesh.cylinder(0.065, 0.42, { segs: 10, bands: 1, rgb: [238, 232, 216], top: [248, 244, 230], bottom: false }).faces, I3, [at[0], 0.21, at[2]]) };
      } else if (T.station === 'diya') {
        const at = [-3.4, 0, 0.25], m = Mesh.dome(0.1 * k, { lat: 2, lon: 10, squash: 0.5, rgb: [176, 86, 48], inner: [70, 44, 20] });
        s.station = { kind: 'diya', at, flame: [at[0] + 0.075 * k, 0.06 * k, at[2]], faces: Mesh.place(m.faces, M3.rotX(Math.PI), [at[0], 0.05 * k, at[2]]) };
      } else if (T.station === 'stove') s.station = { kind: 'stove' };
      if (o.scene === 'dawn') { rooster(s, api, 1.1); rooster(s, api, 7.5, 0.09); }
      lrPose(s, api);
      return s;
    },

    wick(s) { return s.bomb ? s.bomb.wick[2] : [0, 0.05, 0]; },

    ignite(s, api) {
      s.live = true; s.igniteT = s.armedT; s.paperAtCatch = s.paper; s.burnAtCatch = s.burn;
      s.manual = !!api.pointer.down; s.autoReact = rnd(0.22, 0.55);
      if (s.bomb) {
        s.fuseSnd = api.Sfx.fuse({ pan: api.panOf(s.bomb.at) });
        api.Sfx.crack({ vol: 0.25, pieces: 2, pan: api.panOf(s.bomb.at) });
      }
    },

    update(s, api, dt, e) {
      s.now += dt; runQueue(s);
      const T = s.T, o = s.o;
      if (e < 0) {
        // ----- aiming (ready/armed) -----
        const armed = isArmed();
        if (armed) s.armedT += dt;
        s.clock += dt * 4;
        let target = null;
        if (armed && api.pointer.down) target = { x: api.pointer.x, y: api.pointer.y };
        else if (s.auto) target = s.auto;
        if (target) {
          if (T.spring) {   // a broomstick is heavy at the far end: it overshoots and sways
            s.tv.x += ((target.x - s.tip.x) * 38 - s.tv.x * 5.5) * dt; s.tv.y += ((target.y - s.tip.y) * 38 - s.tv.y * 5.5) * dt;
            s.tip.x += s.tv.x * dt; s.tip.y += s.tv.y * dt;
          } else { const a = Math.min(1, dt * T.follow); s.tip.x += (target.x - s.tip.x) * a; s.tip.y += (target.y - s.tip.y) * a; }
        }
        // burning lighters burn down while you aim
        if (T.draw === 'newspaper') {
          s.paper -= dt * 0.075;
          if (s.paper < 0.22) { s.paper = 1; s.rolls++; api.say('Ek aur akhbaar laao!'); api.Sfx.rustle({ vol: 0.2 }); }
        } else if ((T.draw === 'phuljhadi' || T.draw === 'sparkler') && s.lit) {
          s.burn += dt / (T.draw === 'sparkler' ? 40 : 28);
          if (s.burn > 0.97) { s.burn = 0; if (T.station) { s.lit = false; s.sizzle?.stop(); s.sizzle = null; api.say('Doosri phuljhadi!'); } }
        }
        lrPose(s, api);
        lrToolFx(s, api, dt);
        if (!armed) return false;
        const F = s.F;
        if (!s.lit) {
          const st = lrStation(s, api);
          if (st && Math.hypot((F.x - st.x) / st.rx, (F.y - st.y) / st.ry) < 1) { s.sheat += dt / 0.3; if (s.sheat >= 1) lrLightTool(s, api); }
          else s.sheat = Math.max(0, s.sheat - dt);
          return false;
        }
        if (T.noBomb) return false;
        const w = lrWickScreen(s, api), on = Math.hypot(F.x - w.x, F.y - w.y) < lrHitR(s, api);
        if (on) { s.heat += dt / T.catch; s.contact += dt; if (s.firstTouch == null) s.firstTouch = s.armedT; }
        else { if (s.touching) s.slips++; s.heat = Math.max(0, s.heat - dt * 0.35 / T.catch); }
        s.touching = on;
        if (s.heat >= 1) api.ignite();
        return false;
      }

      // ----- live -----
      s.e = e;
      if (o.scene === 'dawn' && s.bangAt == null) s.clock += dt * 4;
      lrPose(s, api);
      lrToolFx(s, api, dt);
      if (T.noBomb) {
        // #150: the phuljhadi caught at the stove; Mummy has opinions
        if (!s.said && e > 0.45) { s.said = true; api.say('GAS BAND KARO!'); }
        if (s.gasOffAt == null && e > 1.7) { s.gasOffAt = e; api.Sfx.strike('steel', { vol: 0.12, pan: -0.5, detune: 0.6 }); }
        if (s.gasOffAt != null) s.stoveOn = Math.max(0, 1 - (e - s.gasOffAt) / 0.35);
        if (s.ranAt == null && e > 2.5) lrRun(s, api, e);
      } else {
        const b = s.bomb;
        if (s.bangAt == null && s.eyes < 0.3) {
          const wp = wickPoint(b, clamp(e / s.fuse, 0, 1));
          api.burst(wp, api.reduced ? 1 : 3, 2.4, { life: 0.25, size: 0.8, gravity: 120 });
          api.light(wp, 0.2);
          if (Math.random() < dt * 8) api.smoke(wp, 1, { size: 0.4 });
        }
        if (s.ranAt == null) {
          if (o.run === 'manual') {
            // #153: you decide when to run. The reaction time is the stat.
            if (s.manual) { if (!api.pointer.down || api.pointer.justUp) lrRun(s, api, e); }
            else if (e >= s.autoReact) lrRun(s, api, e);
            if (s.ranAt == null && e >= s.fuse - 0.05) { lrRun(s, api, e); api.say('Arre bhaag!'); }
          } else if (e >= 0.16) lrRun(s, api, e);
        }
        if (s.bangAt == null && e >= s.fuse) lrBang(s, api, e);
      }
      if (s.ranAt != null) {
        const re = e - s.ranAt;
        s.drop = ease(clamp(re / 0.4, 0, 1));
        while (s.steps < 5 && re >= s.steps * 0.17) { footstep(api, s.steps); api.shake(1.6); s.steps++; }
        if (o.sense === 'eyes' && s.bangAt == null) s.eyes = clamp((re - 0.2) / 0.3, 0, 1);
        if (o.sense === 'ear') s.ear = ease(clamp((re - 0.05) / 0.35, 0, 1));
      }
      if (T.noBomb) return e > 4.8;
      if (s.bangAt != null) {
        const be = e - s.bangAt;
        if (o.sense === 'eyes') {
          s.flash *= Math.exp(-dt * 4);
          if (be > 1.1) {
            if (!s.opened) {
              s.opened = true; s.eyesFor = e - (s.ranAt + 0.2);
              const at = [s.bomb.at[0], 0.1, s.bomb.at[2]];
              api.smoke(at, 14, { size: 1.3 }); api.paper([at[0], 1.2, at[2]], 12, 1.2);
            }
            s.eyes = Math.max(0, 1 - (be - 1.1) / 0.6);
          }
          return be > 3.0;
        }
        return be > (o.scene === 'dawn' ? 3.2 : 2.4);
      }
      return false;
    },

    autoplay(s, api, t) {
      if (t < 0.5) return;
      const wig = { x: Math.sin(t * 2.1) * 4, y: Math.cos(t * 1.7) * 3 };
      if (!s.lit) { const st = lrStation(s, api); if (st) s.auto = { x: st.x + wig.x, y: st.y + wig.y }; return; }
      if (s.bomb) { const w = lrWickScreen(s, api); s.auto = { x: w.x + wig.x, y: w.y + wig.y }; }
    },

    stop(s) { s.fuseSnd?.stop(); s.sizzle?.stop(); },

    draw(s, api) {
      const c = api.ctx, W = api.W, H = api.H, u = H / 800, T = s.T, o = s.o, t = s.now;
      // ---- scene ----
      const st = s.station;
      if (st && st.faces) { api.shadow(st.at, (st.kind === 'diya' ? 0.14 : 0.1) * s.k, 0); api.drawFaces(st.faces); }
      if (s.bomb && s.bangAt == null) drawBomb(api, s.bomb, s.live ? clamp(s.e / s.fuse, 0, 1) : 0);
      if (st && st.kind === 'stove') {
        const g = stoveGeom(api);
        c.save();
        const grd = c.createLinearGradient(0, H * 0.72, 0, H);
        grd.addColorStop(0, '#4a4e55'); grd.addColorStop(1, '#25272b');
        c.fillStyle = grd; c.beginPath(); c.moveTo(-10, H * 0.73); c.lineTo(W * 0.52, H * 0.755); c.lineTo(W * 0.6, H + 10); c.lineTo(-10, H + 10); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(220,226,235,.5)'; c.lineWidth = 2 * u; c.beginPath(); c.moveTo(-10, H * 0.73); c.lineTo(W * 0.52, H * 0.755); c.stroke();
        c.fillStyle = '#131313'; c.beginPath(); c.ellipse(g.cx, g.cy, g.rx, g.ry, 0, 0, TAU); c.fill();
        c.fillStyle = '#2b2522'; c.beginPath(); c.ellipse(g.cx, g.cy - g.ry * 0.15, g.rx * 0.62, g.ry * 0.6, 0, 0, TAU); c.fill();
        c.strokeStyle = '#0c0c0c'; c.lineCap = 'round'; c.lineWidth = 6 * u;
        for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; c.beginPath(); c.moveTo(g.cx + Math.cos(a) * g.rx * 0.55, g.cy + Math.sin(a) * g.ry * 0.55 - g.ry * 0.5); c.lineTo(g.cx + Math.cos(a) * g.rx * 1.3, g.cy + Math.sin(a) * g.ry * 1.3 - g.ry * 0.5); c.stroke(); }
        const kx = W * 0.44, ky = H * 0.94, kr = 0.035 * H;
        c.fillStyle = '#1d1d1f'; c.beginPath(); c.arc(kx, ky, kr, 0, TAU); c.fill();
        const ka = -Math.PI / 2 + (1 - s.stoveOn) * Math.PI / 2;
        stroke(c, { x: kx, y: ky }, { x: kx + Math.cos(ka) * kr * 0.85, y: ky + Math.sin(ka) * kr * 0.85 }, '#e8e8e8', 2.5 * u);
        c.restore();
      }
      // ---- the hand and its lighter ----
      if (s.drop < 1) {
        const { P, E, F } = s, kind = T.draw;
        c.save(); c.lineCap = 'round';
        if (kind === 'agarbatti' || kind === 'broom') {
          let A = P;
          if (kind === 'broom') {
            const B = lp(P, E, 0.8);
            stroke(c, P, B, '#6f5530', 10 * u); stroke(c, P, B, '#a8834c', 6 * u);
            stroke(c, lp(P, E, 0.75), lp(P, E, 0.83), '#e6e1d2', 12 * u);   // the tape
            A = lp(P, E, 0.74);
          }
          const core = lp(A, E, 0.25);
          stroke(c, A, core, '#d6b47a', 2.2 * u);
          stroke(c, core, E, '#3e2418', 3.8 * u);
          stroke(c, lp(core, E, 0.96), E, '#9d958c', 3.6 * u);
        } else if (kind === 'phuljhadi' || kind === 'sparkler') {
          const C0 = lp(P, E, kind === 'sparkler' ? 0.3 : 0.42);
          stroke(c, P, E, s.lit ? '#2c2522' : '#77726c', 1.8 * u);
          stroke(c, C0, F, '#8e8a84', 5.2 * u); stroke(c, C0, F, '#aca79f', 2.2 * u);
          if (s.lit) stroke(c, F, lp(F, E, 0.05), '#ff7a3a', 3 * u);
        } else if (kind === 'newspaper') {
          const nx = -s.dir.y, ny = s.dir.x, w0 = 7 * u, w1 = 7 * u + 15 * u * s.paper;
          c.fillStyle = '#e4dccb'; c.beginPath();
          c.moveTo(P.x + nx * w0, P.y + ny * w0); c.lineTo(F.x + nx * w1, F.y + ny * w1); c.lineTo(F.x - nx * w1, F.y - ny * w1); c.lineTo(P.x - nx * w0, P.y - ny * w0); c.closePath(); c.fill();
          c.strokeStyle = 'rgba(60,60,60,.35)'; c.lineWidth = 1.2 * u;
          for (let i = 0; i < 4; i++) { const a = lp(P, F, 0.12 + i * 0.2), b = lp(P, F, 0.24 + i * 0.2), q = (i % 2 ? 0.5 : -0.4) * w0; c.beginPath(); c.moveTo(a.x + nx * q, a.y + ny * q); c.lineTo(b.x + nx * q, b.y + ny * q); c.stroke(); }
          stroke(c, { x: F.x + nx * w1, y: F.y + ny * w1 }, { x: F.x - nx * w1, y: F.y - ny * w1 }, '#2a1d14', 4 * u);
        }
        c.restore();
        drawHand(api, P, s.ang - HAND.a0);
      }
      // ---- light of the hour ----
      if (o.scene === 'dawn') tintDawn(c, W, H, s.bangAt == null ? 1 : Math.max(0.75, 1 - (s.e - s.bangAt) * 0.08));
      // ---- fire layer ----
      if (st && st.kind !== 'stove') {
        const q = api.project(st.flame);
        flame(c, q.x, q.y, Math.max(10, api.cam.scale * 0.14 * s.k) * (st.kind === 'diya' ? 0.9 : 1), t + 0.7);
        api.light(st.flame, 0.12);
      }
      if (st && st.kind === 'stove' && s.stoveOn > 0.01) {
        const g = stoveGeom(api), on = s.stoveOn;
        glow(c, g.cx, g.cy - g.ry * 0.4, g.rx * 1.6, '70,120,255', 0.28 * on);
        c.save(); c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 22; i++) {
          const a = i / 22 * TAU, bx = g.cx + Math.cos(a) * g.rx * 0.8, by = g.cy + Math.sin(a) * g.ry * 0.8 - g.ry * 0.15;
          const h = g.ry * 1.25 * on * (0.8 + 0.3 * Math.sin(t * 31 + i * 2.1)), w = g.rx * 0.07;
          c.fillStyle = 'rgba(80,140,255,0.8)'; c.beginPath(); c.moveTo(bx - w, by); c.quadraticCurveTo(bx, by - h * 1.4, bx + w, by); c.fill();
          c.fillStyle = 'rgba(200,228,255,0.55)'; c.beginPath(); c.moveTo(bx - w * 0.4, by); c.quadraticCurveTo(bx, by - h * 0.7, bx + w * 0.4, by); c.fill();
        }
        c.restore();
      }
      if (s.bomb && s.bangAt == null) {
        const w = lrWickScreen(s, api);
        if (!s.live && s.heat > 0) glow(c, w.x, w.y, (6 + s.heat * 12) * u, '255,120,40', 0.4 + s.heat * 0.5);
        if (s.live && s.eyes < 0.3) { const q = api.project(wickPoint(s.bomb, clamp(s.e / s.fuse, 0, 1))); glow(c, q.x, q.y, 14 * u, '255,170,70', 0.7); }
      }
      if (s.drop < 1) {
        const F = s.F, kind = T.draw;
        if (kind === 'agarbatti' || kind === 'broom') {
          glow(c, F.x, F.y, 9 * u * (1 + s.heat * 0.6), '255,100,30', 0.65 + 0.25 * Math.sin(t * 6));
          c.fillStyle = '#ffcf80'; c.beginPath(); c.arc(F.x, F.y, 1.8 * u, 0, TAU); c.fill();
        } else if ((kind === 'phuljhadi' || kind === 'sparkler') && s.lit) {
          glow(c, F.x, F.y, 30 * u, '255,236,200', 0.55); glow(c, F.x, F.y, 9 * u, '255,255,240', 0.9);
        } else if (kind === 'newspaper') {
          const h = 64 * u * (0.75 + 0.25 * s.paper);
          flame(c, F.x - 6 * u, F.y, h * 0.8, t + 1.3, { w: 0.4 }); flame(c, F.x + 5 * u, F.y, h * 0.7, t + 2.1, { w: 0.4 }); flame(c, F.x, F.y + 2 * u, h, t, { w: 0.45 });
        }
      }
      if (s.thread.length > 1) {
        c.save(); c.lineCap = 'round'; c.lineWidth = 1.4 * u;
        for (let i = 1; i < s.thread.length; i++) {
          const a = s.thread[i - 1], b = s.thread[i];
          c.strokeStyle = `rgba(206,200,190,${0.32 * Math.max(0, 1 - a.a / 1.8)})`;
          c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
        }
        c.restore();
      }
      // ---- #155: the other hand goes to the ear ----
      if (s.ear > 0) drawHand(api, { x: W * 0.03, y: -H * 0.03 + (1 - s.ear) * H * 0.8 }, -Math.PI / 3, { mirror: true });
      // ---- #154: eyes shut ----
      if (s.eyes > 0) {
        c.save(); c.fillStyle = `rgba(3,2,2,${0.93 * s.eyes})`; c.fillRect(-20, -20, W + 40, H + 40);
        if (s.flash > 0.01) {
          c.globalCompositeOperation = 'lighter';
          const g = c.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, Math.max(W, H) * 0.7);
          g.addColorStop(0, `rgba(170,50,25,${0.6 * s.flash * s.eyes})`); g.addColorStop(1, 'rgba(60,10,5,0)');
          c.fillStyle = g; c.fillRect(0, 0, W, H);
        }
        c.restore();
        vignette(c, W, H, 0.9 * s.eyes);
      }
      if (o.scene === 'dawn' && s.bangAt == null) label(c, lrFmtClock(s.clock), W / 2, H - 120, { align: 'center', size: 20, colour: 'rgba(214,226,255,.9)' });
    },

    stat(s) {
      if (!s.live) return '';
      const f = v => v.toFixed(1);
      switch (s.o.stat) {
        case 'ember': return `Ember on the wick ${f(s.contact)} s · bang ${f(s.fuse)} s later`;
        case 'aim': return `Aiming took ${f(s.igniteT)} s · slipped off the wick ${s.slips}×`;
        case 'dip': return s.litAt != null ? `Candle to wick in ${f(s.igniteT - s.litAt)} s` : '';
        case 'diya': return s.litAt != null ? `Diya to wick in ${f(s.igniteT - s.litAt)} s` : '';
        case 'gas': return s.litAt != null ? `Stove to sparkler in ${f(s.litAt)} s` : '';
        case 'torch': return `Torch left ${Math.round(s.paperAtCatch * 100)}% · ${s.rolls} newspaper${s.rolls > 1 ? 's' : ''}`;
        case 'run': {
          if (s.reaction == null) return '';
          const r = s.reaction;
          return `Ran in ${r.toFixed(2)} s · ${r < 0.3 ? 'bijli ki speed' : r < 0.6 ? 'theek-thaak' : 'arre bhaag!'}`;
        }
        case 'eyes': return s.eyesFor != null ? `Eyes shut ${f(s.eyesFor)} s` : '';
        case 'ear': return s.bangAt != null ? `Wick to bang ${f(s.bangAt)} s · one ear plugged` : '';
        case 'reach': return `${Math.round(s.burnAtCatch * 100)}% of the sparkler gone before it caught`;
        case 'dawn': return s.clockAt != null ? `Pehla dhamaka: ${lrFmtClock(s.clockAt)}` : '';
      }
      return '';
    },
  });

  // ======================================================================================
  // agarbatti-chain (#119): three bombs, three incense sticks of different lengths.
  // ======================================================================================
  const AC = { rate: 0.105, catchH: 0.08 };
  DiwaliTricks.register({
    id: 'agarbatti-chain',
    name: 'Agarbatti time bomb',
    compendium: [119],
    mode: 'ground',
    views: ['courtyard'],
    fuse: 0.6,
    options: [{ key: 'count', label: 'Bombs', choices: [[3, 'Three']], default: 3 }],
    spentLine: 'Teen agarbatti, teen dhamake, ek ke baad ek',

    create(api, opts) {
      const lens = shuffle([0.42, 0.72, 1.02]);
      const spots = [[-1.5, 0, 0.15], [0, 0, -0.25], [1.5, 0, 0.2]];
      const items = spots.map((at, i) => {
        const b = makeBomb('lakshmi', at, 1, rnd(-0.25, 0.25));
        const base = [b.wick[2][0] + 0.03, 0, b.wick[2][2] + 0.02];   // stuck upright right beside the wick
        return { b, base, len: lens[i], h: lens[i], rate: AC.rate * rnd(0.92, 1.08), lean: rnd(-0.06, 0.06), caughtAt: null, bangAt: null, burnP: 0, thread: [], threadT: 0 };
      });
      return { items, bangs: [], lit: false, now: 0 };
    },

    wick(s) { const it = s.items.reduce((a, b) => a.len > b.len ? a : b); return [it.base[0] + it.lean, it.len, it.base[2]]; },

    ignite(s, api) { s.lit = true; api.Sfx.crack({ vol: 0.15, pieces: 2 }); },

    update(s, api, dt, e) {
      s.now += dt;
      const u = api.H / 800;
      for (const it of s.items) {
        if (it.bangAt == null && it.caughtAt == null) {
          it.h = Math.max(AC.catchH, it.h - it.rate * dt);
          if (it.h <= AC.catchH) { it.caughtAt = e; api.Sfx.crack({ vol: 0.3, pieces: 3, pan: api.panOf(it.b.at) }); it.fs = api.Sfx.fuse({ vol: 0.05, pan: api.panOf(it.b.at) }); }
        }
        if (it.caughtAt != null && it.bangAt == null) {
          const p = clamp((e - it.caughtAt) / 0.55, 0, 1), wp = wickPoint(it.b, p);
          it.burnP = p;
          api.burst(wp, api.reduced ? 1 : 3, 2.2, { life: 0.25, size: 0.8, gravity: 120 }); api.light(wp, 0.2);
          if (p >= 1) { it.bangAt = e; it.fs?.stop(); s.bangs.push(e); bang(api, it.b.at, it.b.size); }
        }
        // the incense smoke thread, in screen space
        const top = api.project([it.base[0] + it.lean * it.h / it.len, it.h, it.base[2]]);
        it.threadT += dt;
        if (it.bangAt == null && it.threadT > 0.05) { it.threadT = 0; it.thread.push({ x: top.x, y: top.y, a: 0, ph: rnd(0, TAU) }); if (it.thread.length > 40) it.thread.shift(); }
        for (let i = it.thread.length - 1; i >= 0; i--) { const p = it.thread[i]; p.a += dt; p.y -= (20 + p.a * 14) * u * dt; p.x += Math.sin(p.a * 3 + p.ph) * 10 * u * dt; if (p.a > 1.8) it.thread.splice(i, 1); }
      }
      const last = s.items.every(it => it.bangAt != null) ? Math.max(...s.items.map(it => it.bangAt)) : null;
      return (last != null && e > last + 2.5) || e > 30;
    },

    stop(s) { for (const it of s.items) it.fs?.stop(); },

    draw(s, api) {
      const c = api.ctx, u = api.H / 800, sc = api.cam.scale;
      for (const it of s.items) {
        if (it.bangAt != null) continue;
        drawBomb(api, it.b, it.burnP);
        // the stick: bare bamboo at the bottom, masala coating above, ember on top
        const b0 = api.project(it.base), core = api.project([it.base[0] + it.lean * 0.12 / it.len, 0.12, it.base[2]]);
        const top = api.project([it.base[0] + it.lean * it.h / it.len, it.h, it.base[2]]);
        c.save(); c.lineCap = 'round';
        stroke(c, b0, core, '#d6b47a', Math.max(1.2, sc * 0.012 * b0.f));
        if (it.h > 0.12) stroke(c, core, top, '#3e2418', Math.max(1.6, sc * 0.02 * b0.f));
        c.restore();
        if (s.lit) {
          glow(c, top.x, top.y, 7 * u, '255,100,30', 0.7 + 0.2 * Math.sin(s.now * 6 + it.len * 9));
          c.fillStyle = '#ffcf80'; c.beginPath(); c.arc(top.x, top.y, 1.5 * u, 0, TAU); c.fill();
        }
        if (it.thread.length > 1) {
          c.save(); c.lineWidth = 1.3 * u;
          for (let i = 1; i < it.thread.length; i++) { const a = it.thread[i - 1], b = it.thread[i]; c.strokeStyle = `rgba(206,200,190,${0.3 * Math.max(0, 1 - a.a / 1.8)})`; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
          c.restore();
        }
      }
    },

    stat(s) {
      const b = s.bangs.slice().sort((x, y) => x - y);
      if (b.length < 2) return b.length ? 'First one gone…' : '';
      const gaps = []; for (let i = 1; i < b.length; i++) gaps.push(`${(b[i] - b[i - 1]).toFixed(1)} s`);
      return `Gaps: ${gaps.join(', ')}`;
    },
  });

  // ======================================================================================
  // sleeper-dud (#123): the dud everyone gave up on. Lean in to check it…
  // ======================================================================================
  DiwaliTricks.register({
    id: 'sleeper-dud',
    name: 'The sleeper',
    compendium: [123],
    mode: 'ground',
    views: ['lane'],
    fuse: 1.0,
    interactive: true,
    options: [],
    spentLine: 'Fuski samjha tha… fuski nahi tha',

    create(api) {
      api.img('pov-hand');
      const yaw = rnd(-0.6, 0.6), R = M3.rotY(yaw);
      const b = { kind: 'lakshmi', size: 0.55, at: [0, 0, 0], k: 1, r: 0.17, faces: Mesh.place(bombFaces('lakshmi', true), R, [0, 0, 0]), wick: [[0.15, 0.05, 0], [0.18, 0.06, 0.015], [0.2, 0.055, 0.03]].map(p => M3.mulV(R, p)) };
      return { b, now: 0, t: 0, leanAt: null, popP: rnd(0.84, 0.96), p: 0, scraps: makeScraps(70, -4, 4, -5, 2.5), haze: makeHaze(), wispT: 0, hissed: false, recoil: 0, popped: false };
    },

    wick(s) { return s.b.wick[2]; },

    update(s, api, dt, e) {
      s.now += dt;
      const armed = isArmed();
      if (e < 0) {
        if (armed) s.t += dt;
        s.wispT += dt;
        if (s.wispT > 2.6) { s.wispT = 0; api.smoke(s.b.wick[2], 1, { size: 0.3 }); }
        if (armed && s.leanAt == null && (api.pointer.justDown || s.autoLean)) { s.leanAt = s.t; s.waited = s.t; }
        if (s.leanAt != null) {
          s.p = easeOut(clamp((s.t - s.leanAt) / 1.3, 0, 1));
          if (!s.hissed && s.p > 0.45) { s.hissed = true; api.Sfx.crack({ vol: 0.08, pieces: 2, pan: api.panOf(s.b.at) }); api.smoke(s.b.wick[2], 2, { size: 0.35 }); }
          if (s.p >= s.popP && s.end) {
            // how close the stick was when it woke up
            const q = api.project(s.b.wick[2]), d = Math.hypot(s.end.x - q.x, s.end.y - q.y) / (api.cam.scale * q.f);
            s.cm = Math.max(1, Math.round(d * Phys.UNIT_M * 100));
            api.ignite();
          }
        }
        return false;
      }
      if (!s.popped) {
        s.popped = true;
        bang(api, [0, 0.04, 0], s.b.size, { shake: 9 });
        api.Sfx.crack({ vol: 0.5, pieces: 3 });
        api.say('Baap re!');
      }
      s.recoil = easeOut(clamp(e / 0.35, 0, 1));
      return e > 2.6;
    },

    autoplay(s, api, t) { if (t > 1.8) s.autoLean = true; },

    draw(s, api) {
      const c = api.ctx, W = api.W, H = api.H, u = H / 800;
      drawScraps(api, s.scraps);
      if (!s.popped) {
        drawBomb(api, s.b, 0);
        const q = api.project(s.b.wick[2]);   // burnt-black wick stub
        c.fillStyle = '#1a1512'; c.beginPath(); c.arc(q.x, q.y, Math.max(1.2, api.cam.scale * 0.012), 0, TAU); c.fill();
      }
      tintMorning(c, W, H, s.now, s.haze, 0.8);
      // the lean: a vignette closes in, the hand reaches out with a little stick
      const lean = s.popped ? Math.max(0, 1 - s.recoil * 1.5) * s.p : s.p;
      if (lean > 0) vignette(c, W, H, 0.55 * lean);
      if (s.leanAt != null) {
        const q = api.project(s.b.at), target = { x: q.x + 10 * u, y: q.y - 6 * u }, rest = { x: W * 0.95, y: H * 1.2 };
        let end = lp(rest, target, s.p);
        if (s.popped) end = { x: end.x + s.recoil * W * 0.25, y: end.y + s.recoil * H * 0.9 };
        s.end = end;
        const A = { x: W * 0.86, y: H * 1.45 }; let dx = end.x - A.x, dy = end.y - A.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
        const L = 0.34 * H, P = { x: end.x - dx * L, y: end.y - dy * L };
        c.save(); c.lineCap = 'round'; stroke(c, P, end, '#7a5a34', 3 * u); c.restore();
        drawHand(api, P, Math.atan2(dy, dx) - HAND.a0 + (s.popped ? s.recoil * 0.5 : 0));
      }
    },

    stat(s) { return s.popped ? `Slept ${s.waited.toFixed(1)} s · woke up with the stick ${s.cm} cm away` : ''; },
  });

  // ======================================================================================
  // mud-killa (#142 #143 #144): the courtyard fort, built the day before.
  // ======================================================================================
  const FORT = { X: 1.6, Z0: -2.4, Z1: -0.2, WH: 0.45, WT: 0.2, TH: 0.78 };
  function mudRgb() { const k = rnd(0.88, 1.12); return [128 * k, 86 * k, 52 * k]; }
  function buildFort() {
    const { X, Z0, Z1, WH, WT, TH } = FORT, faces = [];
    const add = (fs, pos, R = I3) => { for (const f of Mesh.place(fs, R, pos)) faces.push(f); };
    faces.push({ pts: [[-X, 0.004, Z0], [X, 0.004, Z0], [X, 0.004, Z1], [-X, 0.004, Z1]], n: [0, 1, 0], rgb: [104, 72, 44] });
    add(box(2 * X, WH, WT, mudRgb()).faces, [0, 0, Z0]);
    add(box(WT, WH, Z1 - Z0, mudRgb()).faces, [-X, 0, (Z0 + Z1) / 2]);
    add(box(WT, WH, Z1 - Z0, mudRgb()).faces, [X, 0, (Z0 + Z1) / 2]);
    const seg = X - 0.27;
    add(box(seg, WH, WT, mudRgb()).faces, [-(0.27 + seg / 2), 0, Z1]);
    add(box(seg, WH, WT, mudRgb()).faces, [0.27 + seg / 2, 0, Z1]);
    add(box(0.6, 0.12, WT + 0.02, mudRgb()).faces, [0, WH - 0.12, Z1]);         // over the gate
    add(box(0.52, WH - 0.12, 0.04, [92, 58, 32]).faces, [0, 0, Z1 - 0.05]);       // wooden gate
    for (const [x, z] of [[-X, Z1], [X, Z1], [-X, Z0], [X, Z0]]) {
      const col = mudRgb();
      add(frustum(0.27, 0.23, TH, { segs: 8, colourAt: i => shade(col, 0.9 + 0.2 * hash(i, x * 7 + z)), top: shade(col, 1.12) }).faces, [x, 0, z]);
    }
    const merlon = x => box(0.12, 0.1, WT + 0.02, mudRgb()).faces;
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) add(merlon(), [sx * (0.42 + i * 0.3), WH, Z1]);
    for (let i = 0; i < 8; i++) add(merlon(), [-1.15 + i * 0.33, WH, Z0]);
    for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) add(box(WT + 0.02, 0.1, 0.12, mudRgb()).faces, [sx * X, WH, Z0 + 0.45 + i * 0.33]);
    return faces;
  }
  function soldierBody(api, pos, rgb, yaw) {
    const b = box(0.09, 0.2, 0.07, rgb, { bottom: true }), h = box(0.06, 0.07, 0.06, shade(rgb, 1.08), { bottom: true });
    const faces = [...Mesh.place(b.faces, I3, [0, -0.135, 0]), ...Mesh.place(h.faces, I3, [0, 0.065, 0])];
    const hull = [...b.hull.map(p => [p[0], p[1] - 0.135, p[2]]), ...h.hull.slice(4).map(p => [p[0], p[1] + 0.065, p[2]])];
    const body = new Body({
      pos: [pos[0], 0.135, pos[2]], R: M3.rotY(yaw), mass: 0.02, inertia: 0.02 * (0.27 * 0.27 + 0.09 * 0.09) / 12, restitution: 0.3, friction: 0.6, angDrag: 0.4, contactAngDrag: 6, contactLinDrag: 3, hull,
      onImpact: (sp, at) => { if (sp > 2.5) api.Sfx.strike('shell', { vol: Math.min(0.14, sp / 90), pan: api.panOf(at), detune: 1.7 }); },
    });
    return { faces, body, kind: 'soldier' };
  }
  function houseBody(api, pos, rgb, yaw) {
    const b = box(0.26, 0.17, 0.16, rgb, { bottom: true, front: shade(rgb, 1.2), top: [214, 196, 160] });
    const faces = Mesh.place(b.faces, I3, [0, -0.085, 0]), hull = b.hull.map(p => [p[0], p[1] - 0.085, p[2]]);
    const body = new Body({
      pos: [pos[0], 0.085, pos[2]], R: M3.rotY(yaw), mass: 0.012, inertia: 0.012 * (0.26 * 0.26 + 0.17 * 0.17) / 12, restitution: 0.25, friction: 0.6, angDrag: 0.4, contactAngDrag: 6, contactLinDrag: 3, hull,
      onImpact: (sp, at) => { if (sp > 2.5) api.Sfx.strike('clay', { vol: Math.min(0.15, sp / 80), pan: api.panOf(at), detune: 1.4 }); },
    });
    return { faces, body, kind: 'house' };
  }
  const toppled = it => it.body.dir([0, 1, 0])[1] < 0.6;

  const MK = DiwaliTricks.register({
    id: 'mud-killa',
    name: 'Mud killa',
    compendium: [142, 143, 144],
    mode: 'ground',
    views: ['courtyard'],
    fuse: 1.4,
    options: [{ key: 'scene', label: 'Battle', choices: [['anaar', 'Anaar cannon'], ['village', 'Matchbox village'], ['soldiers', 'Toy soldiers vs bijli']], default: 'anaar' }],
    spentLine: 'Killa safe raha, sipahi let gaye',

    create(api, o) {
      MK.spentLine = o.line || MK.spentLine;
      const { X, Z0, Z1, TH, WH } = FORT;
      const s = { o, fort: buildFort(), items: [], now: 0, fired: false, e: 0 };
      const diyaMesh = Mesh.dome(0.075, { lat: 2, lon: 6, squash: 0.5, rgb: [176, 86, 48], inner: [70, 44, 20] }).faces;
      s.diyas = [[-X, TH, Z1], [X, TH, Z1], [-X, TH, Z0], [X, TH, Z0], [-0.45, WH + 0.1, Z1], [0.45, WH + 0.1, Z1]];
      for (const d of s.diyas) for (const f of Mesh.place(diyaMesh, M3.rotX(Math.PI), [d[0], d[1] + 0.035, d[2]])) s.fort.push(f);
      s.sprouts = [];
      for (let i = 0; i < 46; i++) {
        const side = i % 4, t = rnd(-1, 1);
        const p = side === 0 ? [t * X, 0, Z1 + 0.13] : side === 1 ? [t * X, 0, Z0 - 0.13] : side === 2 ? [-X - 0.13, 0, lerp(Z0, Z1, (t + 1) / 2)] : [X + 0.13, 0, lerp(Z0, Z1, (t + 1) / 2)];
        s.sprouts.push(p);
      }
      const army = (n, x0, x1, z0, z1, rgb, yaw) => { for (let i = 0; i < n; i++) { const p = [lerp(x0, x1, (i % Math.ceil(n / 2)) / Math.max(1, Math.ceil(n / 2) - 1)) + rnd(-0.04, 0.04), 0, i < Math.ceil(n / 2) ? z0 : z1]; const it = soldierBody(api, p, rgb, yaw + rnd(-0.2, 0.2)); it.home = p; s.items.push(it); } };
      if (o.scene === 'anaar') {
        army(9, -1.2, 1.2, 0.9, 1.35, [184, 158, 104], Math.PI / 2);
        s.anaarAt = [-X, TH, Z1];
        s.anaar = Mesh.place(bombFaces('anaar'), I3, s.anaarAt);
      } else if (o.scene === 'village') {
        const cols = [[214, 176, 60], [70, 110, 170], [190, 60, 46], [60, 140, 90], [214, 176, 60], [150, 80, 140]];
        const spots = [[-0.9, -1.8], [-0.35, -1.95], [0.4, -1.85], [0.95, -1.6], [-1.0, -0.8], [0.9, -0.75]];
        spots.forEach(([x, z], i) => { const it = houseBody(api, [x, 0, z], cols[i], rnd(-0.4, 0.4)); it.home = [x, 0, z]; s.items.push(it); });
        for (const [x, z] of [[-0.5, -0.6], [0.45, -1.1], [-0.25, -1.45], [0.6, -0.55]]) { const it = soldierBody(api, [x, 0, z], [72, 112, 52], rnd(0, TAU)); it.home = [x, 0, z]; s.items.push(it); }
        s.bomb = makeBomb('bijli', [0.02, 0, -1.2], 1, rnd(0, TAU));
      } else {
        army(6, -1.5, -0.5, 0.75, 1.15, [72, 112, 52], 0);
        army(6, 0.5, 1.5, 0.75, 1.15, [184, 158, 104], Math.PI);
        s.bomb = makeBomb('bijli', [0, 0, 0.95], 1, rnd(-0.5, 0.5) + Math.PI / 2);
      }
      return s;
    },

    wick(s) { return s.bomb ? s.bomb.wick[2] : [s.anaarAt[0] + 0.14, s.anaarAt[1] + 0.03, s.anaarAt[2] + 0.06]; },

    ignite(s, api) {
      s.fired = true;
      if (s.o.scene === 'anaar') { s.hiss = api.Sfx.skid({ pan: api.panOf(s.anaarAt) }); return; }
      const at = s.bomb.at;
      bang(api, at, s.bomb.size, { colours: [[176, 48, 38], [120, 80, 48], [96, 64, 40]] });
      api.paper([at[0], 0.05, at[2]], 14, 3, [[120, 80, 48], [104, 70, 42]]);   // mud chips
      const R = s.o.scene === 'village' ? 1.7 : 1.5;
      for (const it of s.items) {
        const d = v3.sub(it.body.pos, at); d[1] = 0;
        const dist = Math.hypot(d[0], d[2]) || 0.01, k = Math.max(0, 1 - dist / R);
        if (k <= 0) continue;
        const out = [d[0] / dist, 0, d[2] / dist], house = it.kind === 'house', sp = (house ? 6 : 9) * k * rnd(0.7, 1.2), spin = house ? 30 : 14;
        it.body.kick([out[0] * sp, rnd(2, house ? 9 : 6) * k + 1, out[2] * sp], [rnd(-spin, spin) * k, rnd(-6, 6), rnd(-spin, spin) * k]);
      }
    },

    update(s, api, dt, e) {
      s.now += dt; s.e = e;
      if (s.o.scene === 'anaar') {
        const on = e < 5.5, nozzle = [s.anaarAt[0], s.anaarAt[1] + 0.42, s.anaarAt[2]];
        if (on) {
          // the cannon traverses across the attackers
          const tx = Math.sin(e * 0.9) * 1.25, tz = 1.12, hd = v3.norm([tx - nozzle[0], 0, tz - nozzle[2]]);
          const n = api.reduced ? 3 : 13, ramp = Math.min(1, e / 0.4);
          const gpx = Phys.G * api.cam.scale * api.project(nozzle).f;   // real gravity, in screen pixels
          for (let i = 0; i < n; i++) { const h = rnd(2, 5) * ramp, up = rnd(7, 12) * ramp; api.spark(nozzle, [hd[0] * h + rnd(-1, 1), up, hd[2] * h + rnd(-1, 1)], { life: rnd(0.4, 0.9), size: rnd(0.7, 1.4), color: Math.random() < 0.25 ? 'white' : 'gold', gravity: gpx }); }
          api.light(nozzle, 0.55 + 0.15 * Math.sin(e * 30));
          if (Math.random() < dt * 6) api.smoke(nozzle, 1, { size: 0.7 });
          s.hiss?.set(0.38 * ramp, 0.2, api.panOf(nozzle));
          if (e > 0.6) for (const it of s.items) {
            if (it.hit) continue;
            const d = v3.norm([it.body.pos[0] - nozzle[0], 0, it.body.pos[2] - nozzle[2]]);
            if (Math.acos(clamp(v3.dot(d, hd), -1, 1)) < 0.2 && Math.random() < dt * 2.2) {
              it.hit = true;
              it.body.kick([hd[0] * rnd(1.2, 2.4), rnd(1, 2.2), hd[2] * rnd(1.2, 2.4)], [rnd(-9, 9), rnd(-3, 3), rnd(-9, 9)]);
              api.burst([it.body.pos[0], 0.2, it.body.pos[2]], 8, 2.5, { life: 0.3 });
            }
          }
        } else if (s.hiss) { s.hiss.stop(); s.hiss = null; s.fired = 'done'; }
      }
      let awake = false;
      if (s.fired) for (const it of s.items) { for (let i = 0; i < 3; i++) it.body.step(dt / 3); awake ||= it.body.awake; }
      const minT = s.o.scene === 'anaar' ? 6.5 : 1.2;
      return (e > minT && !awake) || e > (s.o.scene === 'anaar' ? 11 : 8);
    },

    stop(s) { s.hiss?.stop(); },

    draw(s, api) {
      const c = api.ctx, u = api.H / 800, sc = api.cam.scale, t = s.now;
      const { X, Z0, Z1, TH } = FORT;
      api.shadow([0, 0, (Z0 + Z1) / 2], 2.2, 0);
      // aliv sprouts on the mud (kids sow grain on the killa so it turns green)
      c.save(); c.strokeStyle = '#6a9a3a'; c.lineCap = 'round';
      for (const p of s.sprouts) { const q = api.project(p), h = sc * 0.05 * q.f; c.lineWidth = Math.max(1, sc * 0.008 * q.f); for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x + k * h * 0.4, q.y - h); c.stroke(); } }
      c.restore();
      const all = s.fort.slice();
      if (s.anaar) for (const f of s.anaar) all.push(f);
      if (s.bomb && !s.fired) for (const f of s.bomb.faces) all.push(f);
      for (const it of s.items) { api.shadow(it.body.pos, 0.07, it.body.pos[1]); for (const f of Mesh.place(it.faces, it.body.R, it.body.pos)) all.push(f); }
      api.drawFaces(all);
      if (s.bomb && !s.fired) drawWick(api, s.bomb, 0);
      if (s.anaar && !s.fired) { const a = api.project([s.anaarAt[0] + 0.1, s.anaarAt[1] + 0.03, s.anaarAt[2] + 0.04]), w = api.project(MK.wick(s)); stroke(c, a, w, '#b9a988', 1.5 * u); }
      // saffron flag on the back tower
      const fb = [-X, TH, Z0], ft = [-X, TH + 0.5, Z0], q0 = api.project(fb), q1 = api.project(ft);
      stroke(c, q0, q1, '#5a4030', Math.max(1, sc * 0.012));
      const fl = api.project([-X + 0.3, TH + 0.43 + Math.sin(t * 4) * 0.03, Z0]), fm = api.project([-X, TH + 0.36, Z0]);
      c.fillStyle = '#f08a24'; c.beginPath(); c.moveTo(q1.x, q1.y); c.lineTo(fl.x, fl.y); c.lineTo(fm.x, fm.y); c.closePath(); c.fill();
      // diya flames on the ramparts
      for (const [i, d] of s.diyas.entries()) { const q = api.project([d[0], d[1] + 0.08, d[2]]); flame(c, q.x, q.y, Math.max(7, sc * 0.09 * q.f), t + i * 1.7, { halo: 2.4 }); }
    },

    stat(s) {
      if (!s.fired) return '';
      const sol = s.items.filter(it => it.kind === 'soldier'), houses = s.items.filter(it => it.kind === 'house');
      if (s.o.scene === 'anaar') return `Anaar cannon: ${sol.filter(toppled).length} of ${sol.length} soldiers knocked over`;
      if (s.o.scene === 'village') return `Matchbox houses flipped: ${houses.filter(toppled).length} of ${houses.length}`;
      const far = Math.max(0, ...sol.map(it => Math.hypot(it.body.pos[0] - it.home[0], it.body.pos[2] - it.home[2]))) * Phys.UNIT_M * 100;
      return `Soldiers down: ${sol.filter(toppled).length} of ${sol.length} · farthest ${Math.round(far)} cm`;
    },
  });

  // ======================================================================================
  // dud-hunt (#159): the morning after. Six half-burnt fuskis hide in the red paper.
  // ======================================================================================
  DiwaliTricks.register({
    id: 'dud-hunt',
    name: 'Morning-after dud hunt',
    compendium: [159],
    mode: 'ground',
    views: ['lane'],
    fuse: 1.0,
    interactive: true,
    options: [{ key: 'count', label: 'Duds', choices: [[6, 'Six']], default: 6 }],
    spentLine: 'Subah ki dhoop, aur jeb mein fuskiyan',

    create(api, o) {
      const n = o.count || 6, kinds = shuffle(['lakshmi', 'bijli', 'atom', 'anaar', 'lakshmi', 'bijli']).slice(0, n), duds = [];
      for (const kind of kinds) {
        let p, tries = 0;
        do { p = [rnd(-4.2, 4.2), 0, rnd(-5.5, 2.2)]; tries++; } while (tries < 40 && duds.some(d => Math.hypot(d.at[0] - p[0], d.at[2] - p[2]) < 1.3));
        const yaw = rnd(0, TAU), R = M3.rotY(yaw);
        // a half-burnt anaar lies on its side, resting on its widest ring
        const local = kind === 'anaar' ? Mesh.place(bombFaces('anaar', true), M3.rotZ(Math.PI / 2), [0.2, 0.11, 0]) : bombFaces(kind, true);
        duds.push({ kind, at: p, R, local, found: null, yaw });
      }
      return { duds, scraps: makeScraps(150, -5.5, 5.5, -7, 3), haze: makeHaze(), now: 0, t: 0, lastFind: 0, rings: [], glint: null, live: false, foundN: 0 };
    },

    wick(s) { return s.duds[0].at; },

    ignite(s, api) {
      s.live = true; s.huntT = s.t;
      s.duds.filter(d => d.found != null).forEach((d, i, arr) => { d.from = d.at.slice(); d.to = [(i - (arr.length - 1) / 2) * 0.9, 0, 2.3]; d.lineAt = i * 0.18; d.landed = false; });
      api.say('Aaj ka khazana!');
    },

    update(s, api, dt, e) {
      s.now += dt;
      for (let i = s.rings.length - 1; i >= 0; i--) { s.rings[i].a += dt; if (s.rings[i].a > 0.7) s.rings.splice(i, 1); }
      if (e < 0) {
        if (!isArmed()) return false;
        s.t += dt;
        let tap = null;
        if (api.pointer.justDown) tap = { x: api.pointer.x, y: api.pointer.y };
        else if (s.autoTap) tap = s.autoTap;
        s.autoTap = null;
        if (tap) {
          let best = null, bd = Infinity;
          for (const d of s.duds) {
            if (d.found != null) continue;
            const q = api.project(d.at), r = Math.max(26 * api.H / 800, api.cam.scale * 0.35 * q.f), dd = Math.hypot(q.x - tap.x, q.y - tap.y);
            if (dd < r && dd < bd) { bd = dd; best = d; }
          }
          if (best) {
            best.found = s.t; s.lastFind = s.t; s.foundN++;
            const q = api.project(best.at); s.rings.push({ x: q.x, y: q.y, a: 0 });
            api.Sfx.rustle({ vol: 0.18, pan: api.panOf(best.at) }); api.Sfx.strike('coin', { vol: 0.12, pan: api.panOf(best.at), detune: 0.8 + s.foundN * 0.06 });
            if (s.foundN === s.duds.length) s.allAt = s.t;
          } else {
            api.Sfx.rustle({ vol: 0.1 });
            const g = api.unproject(tap.x, tap.y); if (g) api.paper([g[0], 0.05, g[2]], 3, 1.2);
          }
        }
        if (s.t - s.lastFind > 6 && !s.glint) { const d = s.duds.find(x => x.found == null); if (d) s.glint = { d, a: 0 }; }
        if (s.glint) { s.glint.a += dt; if (s.glint.a > 1.2 || s.glint.d.found != null) { s.glint = null; s.lastFind = s.t - 3; } }
        if ((s.allAt != null && s.t > s.allAt + 0.7) || s.t > 60) api.ignite();
        return false;
      }
      for (const d of s.duds) {
        if (d.to == null) continue;
        const p = clamp((e - d.lineAt) / 0.5, 0, 1);
        d.at = [lerp(d.from[0], d.to[0], ease(p)), Math.sin(p * Math.PI) * 0.9, lerp(d.from[2], d.to[2], ease(p))];
        if (p >= 1 && !d.landed) { d.landed = true; api.Sfx.strike('shell', { vol: 0.12, pan: api.panOf(d.to), detune: 1.2 }); }
      }
      return e > 0.18 * s.duds.length + 2.2;
    },

    autoplay(s, api, t) {
      if (t - (s.autoLast || 0) < 0.9 || t < 1) return;
      const d = s.duds.find(x => x.found == null);
      if (!d) return;
      s.autoLast = t;
      const q = api.project(d.at); s.autoTap = { x: q.x + rnd(-4, 4), y: q.y + rnd(-3, 3) };
    },

    draw(s, api) {
      const c = api.ctx, W = api.W, H = api.H, u = H / 800;
      drawScraps(api, s.scraps);
      const faces = [];
      for (const d of s.duds) {
        let at = d.at;
        if (!s.live && d.found != null) { const a = s.t - d.found; if (a > 0.5) continue; at = [at[0], easeOut(a / 0.5) * 0.6, at[2]]; }
        if (s.live && d.found == null) continue;
        api.shadow(at, 0.12, at[1]);
        for (const f of Mesh.place(d.local, d.R, at)) faces.push(f);
      }
      api.drawFaces(faces);
      tintMorning(c, W, H, s.now, s.haze, 1);
      for (const r of s.rings) {
        c.save(); c.strokeStyle = `rgba(255,248,220,${1 - r.a / 0.7})`; c.lineWidth = 2 * u;
        c.beginPath(); c.ellipse(r.x, r.y, (10 + r.a * 60) * u, (5 + r.a * 26) * u, 0, 0, TAU); c.stroke(); c.restore();
      }
      if (s.glint) {
        const q = api.project(s.glint.d.at), k = Math.sin(s.glint.a / 1.2 * Math.PI), L = 12 * u * k;
        c.save(); c.strokeStyle = `rgba(255,252,236,${0.9 * k})`; c.lineWidth = 1.5 * u;
        c.beginPath(); c.moveTo(q.x - L, q.y); c.lineTo(q.x + L, q.y); c.moveTo(q.x, q.y - L); c.lineTo(q.x, q.y + L); c.stroke(); c.restore();
        glow(c, q.x, q.y, L * 1.2, '255,250,230', 0.5 * k);
      }
      if (!s.live) label(c, `Fuskis: ${s.foundN}/${s.duds.length}`, W / 2, H - 120, { align: 'center', size: 20, colour: 'rgba(255,246,228,.95)' });
    },

    stat(s) { return s.live ? `Fuskis found: ${s.foundN}/${s.duds.length} in ${s.huntT.toFixed(1)} s` : ''; },
  });

  // ======================================================================================
  // deepavali-dawn (#210): oil bath, new clothes, and crackers before the sun is up.
  // A saram (ladi) crackles down its thread, then the Lakshmi vedi.
  // ======================================================================================
  DiwaliTricks.register({
    id: 'deepavali-dawn',
    name: 'Morning Deepavali',
    compendium: [210],
    mode: 'ground',
    views: ['courtyard'],
    fuse: 1.3,
    options: [{ key: 'count', label: 'Saram', choices: [[36, '36 crackers']], default: 36 }],
    spentLine: 'Ganga snanam done, pudhu dress on, saram over',

    create(api, o) {
      const N = o.count || 36, thread = [], items = [];
      for (let i = 0; i <= 60; i++) { const u = i / 60; thread.push([-2.2 + 3.4 * u, 0.012, -0.1 + 0.28 * Math.sin(u * TAU * 0.8)]); }
      for (let i = 0; i < N; i++) {
        const u = (i + 0.5) / N, x = -2.2 + 3.4 * u, z = -0.1 + 0.28 * Math.sin(u * TAU * 0.8), tz = 0.28 * 0.8 * TAU * Math.cos(u * TAU * 0.8) / 3.4;
        const tang = Math.atan2(tz, 1), side = i % 2 ? 1 : -1, a = tang + side * 1.15;
        items.push({ at: [x, 0.015, z], dir: [Math.cos(a), 0, Math.sin(a)], popped: false });
      }
      return { items, thread, vedi: makeBomb('lakshmi', [1.8, 0, 0.45], 1, -0.6), vediP: 0, now: 0, pops: 0, acc: 0, next: N - 1, firstPop: null, lastPop: null, vediLit: null, vediAt: null, said: false };
    },

    wick(s) { const p = s.thread[s.thread.length - 1]; return [p[0] + 0.12, 0.02, p[2] + 0.04]; },

    update(s, api, dt, e) {
      s.now += dt;
      // the saram pops from the lit end back along the thread, not quite evenly
      if (s.next >= 0) {
        s.acc += dt * 17 * rnd(0.6, 1.5);
        while (s.acc >= 1 && s.next >= 0) {
          s.acc -= 1;
          const it = s.items[s.next--];
          it.popped = true; s.pops++; if (s.firstPop == null) s.firstPop = e; s.lastPop = e;
          const pan = api.panOf(it.at);
          api.Sfx.boom({ vol: 0.32, size: 0.22, muffle: 0.05, pan });
          api.burst(it.at, 16, 4.5, { flat: true, life: 0.4 });
          api.paper([it.at[0], 0.04, it.at[2]], 4, 2.4);
          api.light(it.at, 0.35); api.shake(1.2);
          if (Math.random() < 0.3) api.smoke(it.at, 2, { size: 0.6 });
        }
      }
      // someone has already lit the Lakshmi vedi from the same agarbatti
      if (s.vediLit == null && e > 1.4) { s.vediLit = e; s.vfs = api.Sfx.fuse({ vol: 0.05, pan: api.panOf(s.vedi.at) }); }
      if (s.vediLit != null && s.vediAt == null) {
        const p = clamp((e - s.vediLit) / 2.0, 0, 1), wp = wickPoint(s.vedi, p);
        s.vediP = p;
        api.burst(wp, api.reduced ? 1 : 3, 2.2, { life: 0.25, size: 0.8, gravity: 120 }); api.light(wp, 0.18);
        if (p >= 1 && s.next < 0) { s.vediAt = e; s.vfs?.stop(); bang(api, s.vedi.at, 0.85); }
      }
      if (s.vediAt != null && !s.said && e > s.vediAt + 0.5) { s.said = true; api.say('Deepavali vazhthukkal!'); }
      return (s.vediAt != null && e > s.vediAt + 2.8) || e > 20;
    },

    stop(s) { s.vfs?.stop(); },

    draw(s, api) {
      const c = api.ctx, W = api.W, H = api.H, sc = api.cam.scale, t = s.now;
      // kolam in rice flour by the door: dots, loops around them, a diamond through
      c.save(); c.strokeStyle = 'rgba(245,242,232,.85)'; c.fillStyle = 'rgba(245,242,232,.9)'; c.lineWidth = Math.max(1, sc * 0.01);
      const K = [-0.4, 0, 1.45], sp = 0.2;
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
        if (Math.abs(i) + Math.abs(j) > 3) continue;
        const p = [K[0] + i * sp, 0.003, K[2] + j * sp * 0.9], q = api.project(p);
        c.beginPath(); c.arc(q.x, q.y, Math.max(1, sc * 0.012 * q.f), 0, TAU); c.fill();
        if ((i + j) % 2 === 0) { c.beginPath(); for (let k = 0; k <= 14; k++) { const a = k / 14 * TAU, r = api.project([p[0] + Math.cos(a) * sp * 0.42, 0.003, p[2] + Math.sin(a) * sp * 0.42]); k ? c.lineTo(r.x, r.y) : c.moveTo(r.x, r.y); } c.stroke(); }
      }
      c.beginPath(); [[0, -2.6], [2.6, 0], [0, 2.6], [-2.6, 0], [0, -2.6]].forEach(([i, j], k) => { const q = api.project([K[0] + i * sp, 0.003, K[2] + j * sp * 0.9]); k ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); }); c.stroke();
      c.restore();
      // the saram on its thread
      c.save(); c.lineCap = 'round';
      c.strokeStyle = '#d9cfae'; c.lineWidth = Math.max(1, sc * 0.008);
      c.beginPath(); s.thread.forEach((p, i) => { const q = api.project(p); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); }); c.stroke();
      for (const it of s.items) {
        if (it.popped) continue;
        const a = api.project(it.at), b = api.project(v3.add(it.at, v3.scale(it.dir, 0.12)));
        stroke(c, a, b, '#b8302a', Math.max(2, sc * 0.035 * a.f)); stroke(c, a, b, '#e06a5a', Math.max(0.8, sc * 0.012 * a.f));
      }
      c.restore();
      if (s.vediAt == null) drawBomb(api, s.vedi, s.vediP || 0);
      // dawn: blue pre-sunrise, a warm band coming up behind the houses
      c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgba(120,128,190,.55)'; c.fillRect(-20, -20, W + 40, H + 40);
      c.globalCompositeOperation = 'screen';
      const g = c.createLinearGradient(0, 0, 0, H * 0.45); g.addColorStop(0, 'rgba(255,150,120,.16)'); g.addColorStop(1, 'rgba(255,150,120,0)');
      c.fillStyle = g; c.fillRect(-20, -20, W + 40, H * 0.45 + 20); c.restore();
    },

    stat(s) {
      if (!s.pops) return '';
      const dur = (s.lastPop - s.firstPop).toFixed(1);
      return s.vediAt != null ? `Saram: ${s.pops} pops in ${dur} s · then the Lakshmi vedi` : `Saram: ${s.pops} pops`;
    },
  });

  // ======================================================================================
  // narakasur (#223): Goa, Naraka Chaturdashi. A 3 m papier-mache demon, made by the kids
  // of the lane, burns before dawn with crackers popping inside, and topples.
  // ======================================================================================
  const NK = { Z: -10, com: 6.2 };
  function buildNarakasur() {
    const faces = [], skin = [56, 126, 116], add = fs => { for (const f of fs) faces.push(f); };
    const vary = (rgb, i, j) => shade(rgb, 0.88 + 0.24 * hash(i, j));
    for (const sx of [-1, 1]) add(Mesh.place(frustum(0.42, 0.36, 3.4, { segs: 8, colourAt: i => vary(skin, i, sx), top: false }).faces, I3, [sx * 0.55, 0, 0]));
    add(Mesh.place(frustum(1.2, 0.95, 2.4, { segs: 12, bands: 2, colourAt: (i, b) => b === 0 ? (i % 2 ? [250, 206, 60] : [236, 120, 30]) : [236, 120, 30], top: false, bottom: [200, 100, 30] }).faces, I3, [0, 2.6, 0]));
    add(Mesh.place(frustum(0.95, 1.35, 4.0, { segs: 12, bands: 3, colourAt: (i, b) => b === 2 && i % 2 ? [232, 190, 70] : vary(skin, i, b), top: vary(skin, 3, 3) }).faces, I3, [0, 5.0, 0]));
    add(Mesh.place(frustum(0.4, 0.35, 0.6, { segs: 8, rgb: skin, top: false }).faces, I3, [0, 9.0, 0]));
    for (const sx of [-1, 1]) {
      add(limb([sx * 1.15, 8.6, 0], [sx * 2.9, 10.6, 0.3], 0.38, 0.3, { segs: 8, colourAt: i => vary(skin, i, sx + 5) }));
      add(Mesh.place(sphere(0.45, { lat: 3, lon: 6, rgb: skin }).faces, I3, [sx * 2.95, 10.75, 0.3]));
    }
    // a gold gada in the right hand
    add(limb([2.95, 10.2, 0.3], [3.2, 13.0, 0.3], 0.12, 0.12, { segs: 6, rgb: [120, 80, 40] }));
    add(Mesh.place(sphere(0.6, { lat: 4, lon: 8, colourAt: (i, j) => (i + j) % 2 ? [236, 196, 76] : [210, 160, 50] }).faces, I3, [3.2, 13.3, 0.3]));
    // head, crown, horns
    add(Mesh.place(sphere(1.35, { lat: 6, lon: 12, squash: 1.08, colourAt: (i, j) => vary(skin, i, j + 20) }).faces, I3, [0, 10.9, 0]));
    add(Mesh.place(frustum(0.95, 0.55, 1.5, { segs: 10, colourAt: i => i % 2 ? [236, 196, 76] : [214, 64, 48], top: [236, 196, 76] }).faces, I3, [0, 11.9, 0]));
    for (const sx of [-1, 1]) add(limb([sx * 1.0, 11.6, 0], [sx * 1.9, 13.2, 0.1], 0.22, 0.02, { segs: 6, rgb: [238, 228, 204] }));
    for (const f of faces) { let y = 0; for (const p of f.pts) y += p[1]; f.hy = y / f.pts.length; }
    return Mesh.place(faces, I3, [0, -NK.com, 0]).map((f, i) => ({ ...f, hy: faces[i].hy }));
  }
  const NK_TONGUES = (() => { const a = []; for (let i = 0; i < 12; i++) { const y = 0.6 + i * 1.15; a.push([(i % 2 ? 0.7 : -0.7) * (y < 5 ? 1 : 1.1), y, 0.6]); } return a; })();
  const nkRad = y => y < 3.4 ? 0.9 : y < 5 ? 1.1 : y < 9 ? 1.2 : 1.3;
  const nkFront = e => Math.min(15, 1.2 * e + 0.06 * e * e);
  // lowest of the upper hull (head, hands, gada): the base edge is the hinge and always touches
  const nkLow = b => { let m = Infinity; for (let i = 4; i < b.hull.length; i++) m = Math.min(m, b.toWorld(b.hull[i])[1]); return m; };
  // pose the effigy rotated by s.th about its base edge on the falling side
  function nkPose(s) {
    const b = s.body, R = M3.rotZ(-s.dir * s.th), pivot = [s.dir * 0.9, 0, NK.Z];
    b.R = R; b.pos = v3.sub(pivot, M3.mulV(R, [s.dir * 0.9, -NK.com, 0]));
  }

  DiwaliTricks.register({
    id: 'narakasur',
    name: 'Narakasur',
    compendium: [223],
    mode: 'ground',
    views: ['lane'],
    fuse: 1.5,
    options: [],
    spentLine: 'Narakasur gir gaya. Ab ghar jaake nahao',

    create(api) {
      zoomOut(api);   // a 3 m effigy needs the wide plate
      const faces = buildNarakasur(), dir = Math.random() < 0.5 ? -1 : 1;
      const hull = [[-0.9, 0, -0.45], [0.9, 0, -0.45], [0.9, 0, 0.45], [-0.9, 0, 0.45], [0, 13.4, 0], [-3.0, 10.7, 0.3], [3.0, 10.7, 0.3], [3.2, 13.9, 0.3]].map(p => [p[0], p[1] - NK.com, p[2]]);
      const body = new Body({ pos: [0, NK.com, NK.Z], mass: 3, inertia: 3 * (14 * 14 + 3 * 3) / 12, restitution: 0.1, friction: 0.8, angDrag: 0.05, contactAngDrag: 3, contactLinDrag: 2, hull,
        onImpact: () => {} });
      return { faces, body, dir, giveAt: rnd(12.2, 14.4), now: 0, pops: 0, front: 0, toppleAt: null, landed: null, smokeT: 0, popT: 0, lit: false };
    },

    wick(s) { return [0.95, 0.4, NK.Z + 0.7]; },

    ignite(s, api) { s.lit = true; s.crackle = api.Sfx.fuse({ vol: 0.09, pan: 0 }); api.Sfx.whoosh({ vol: 0.15, dur: 0.8 }); },

    update(s, api, dt, e) {
      s.now += dt; s.e = e;
      const b = s.body;
      s.front = nkFront(e);
      const lo = Math.max(0, s.front - 6), hi = Math.min(14.2, s.front), burning = s.landed == null || e < s.landed + 3;
      const W = (y, a, r) => b.toWorld([Math.cos(a) * r, y - NK.com, Math.sin(a) * r * 0.6]);
      if (burning && hi > lo) {
        const n = api.reduced ? 3 : 16;
        for (let i = 0; i < n; i++) {
          const y = rnd(lo, hi), p = W(y, rnd(0, TAU), nkRad(y) * rnd(0.6, 1.05));
          api.spark(p, [rnd(-1.2, 1.2), rnd(5, 13), rnd(-1.2, 1.2)], { life: rnd(0.3, 0.9), size: rnd(0.8, 1.6), color: Math.random() < 0.2 ? 'red' : 'gold', gravity: -140 });
        }
        api.light(W((lo + hi) / 2, 0, 0), 1.0, [255, 150, 60]);
        s.smokeT += dt;
        if (s.smokeT > 0.09) { s.smokeT = 0; api.smoke(W(hi, rnd(0, TAU), 0.5), 2, { size: 2.4 }); }
        // crackers stuffed inside pop as the fire reaches them
        if (Math.random() < dt * 4) {
          const y = rnd(lo, hi), p = W(y, rnd(0, TAU), nkRad(y) * 0.8);
          s.pops++;
          api.burst(p, api.reduced ? 4 : 22, 6, { color: Math.random() < 0.5 ? 'white' : 'gold', life: 0.5 });
          api.paper(p, 3, 3);
          api.Sfx.boom({ vol: 0.28, size: 0.32, muffle: 0.4, pan: api.panOf(p) });
          api.shake(1.2);
        }
      }
      if (s.toppleAt == null && s.front > s.giveAt) {
        s.toppleAt = e; s.th = 0; s.thv = 0.1;
        api.Sfx.crack({ vol: 0.5, pieces: 5 });
      }
      if (s.toppleAt != null && s.landed == null) {
        // the burnt legs give way: an inverted pendulum hinged on the base edge, until the hull meets the road
        const d = Math.hypot(NK.com, 0.9), I = (14 * 14) / 3, phi0 = Math.atan2(0.9, NK.com);
        for (let i = 0; i < 4; i++) {
          const h = dt / 4;
          if (s.th < phi0) s.thv = Math.max(s.thv, 0.28);              // leaning over its own burnt foot
          else s.thv += (Phys.G * d / I) * Math.sin(s.th - phi0) * h;   // then gravity takes it
          s.th += s.thv * h;
          nkPose(s);
          if (nkLow(b) < 0) { s.th -= s.thv * h; nkPose(s); s.hit = true; break; }
        }
        if (s.hit || s.th > 1.65) {
          s.landed = e;
          s.crackle?.stop(); s.crackle = null;
          const mid = b.toWorld([0, 2, 0]);
          api.Sfx.boom({ vol: 0.75, size: 1.4, muffle: 0.55, pan: api.panOf(mid) });
          for (let i = 0; i < 6; i++) api.burst(b.toWorld([0, i * 2.2 - NK.com + 1, 0]), api.reduced ? 6 : 40, 9, { life: 0.8 });
          api.smoke(mid, 18, { size: 2.6 }); api.paper(mid, 30, 5); api.shake(7);
          api.say('Narakasur khatam!');
        }
      }
      return (s.landed != null && e > s.landed + 3.6) || e > 25;
    },

    stop(s) { s.crackle?.stop(); },

    draw(s, api) {
      const c = api.ctx, W = api.W, H = api.H, b = s.body, t = s.now, sc = api.cam.scale;
      tintDawn(c, W, H, 0.55);
      const front = s.lit ? s.front : 0;
      api.shadow([b.pos[0], 0, b.pos[2]], 2.2, 0);
      const faces = Mesh.place(s.faces, b.R, b.pos);
      for (let i = 0; i < faces.length; i++) {
        const k = clamp((front - s.faces[i].hy - 1.5) / 4, 0, 0.85);
        if (k > 0) faces[i].rgb = faces[i].rgb.map((v, j) => lerp(v, [34, 24, 20][j], k));
      }
      api.drawFaces(faces);
      // the painted face: googly eyes, big moustache, two little fangs. More funny than fierce.
      const hc = b.toWorld([0, 10.9 - NK.com, 1.25]), q = api.project(hc), qx = api.project(b.toWorld([1.3, 10.9 - NK.com, 1.25])), qu = api.project(b.toWorld([0, 11.9 - NK.com, 1.25]));
      const r = Math.hypot(qx.x - q.x, qx.y - q.y), char = clamp((front - 9.5) / 3, 0, 1);
      if (r > 3 && char < 1) {
        c.save(); c.translate(q.x, q.y); c.rotate(Math.atan2(qu.x - q.x, -(qu.y - q.y))); c.globalAlpha = 1 - char;
        for (const sx of [-1, 1]) {
          c.fillStyle = '#fbf6ea'; c.beginPath(); c.ellipse(sx * r * 0.38, -r * 0.15, r * 0.24, r * 0.28, 0, 0, TAU); c.fill();
          c.fillStyle = '#141010'; c.beginPath(); c.arc(sx * r * 0.38 + Math.sin(t * 1.3) * r * 0.08, -r * 0.12 + Math.cos(t * 1.7) * r * 0.05, r * 0.11, 0, TAU); c.fill();
          c.strokeStyle = '#141010'; c.lineWidth = r * 0.09; c.lineCap = 'round';
          c.beginPath(); c.moveTo(sx * r * 0.15, -r * 0.42); c.quadraticCurveTo(sx * r * 0.4, -r * 0.62, sx * r * 0.66, -r * 0.46); c.stroke();
          c.beginPath(); c.moveTo(0, r * 0.22); c.bezierCurveTo(sx * r * 0.3, r * 0.1, sx * r * 0.55, r * 0.35, sx * r * 0.62, r * 0.12); c.stroke();
        }
        c.fillStyle = '#a8241c'; c.beginPath(); c.ellipse(0, r * 0.45, r * 0.26, r * 0.12, 0, 0, Math.PI); c.fill();
        c.fillStyle = '#fbf6ea';
        for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * r * 0.16, r * 0.45); c.lineTo(sx * r * 0.1, r * 0.3); c.lineTo(sx * r * 0.04, r * 0.45); c.closePath(); c.fill(); }
        c.fillStyle = '#d23a2a'; c.fillRect(-r * 0.04, -r * 0.62, r * 0.08, r * 0.22);
        c.restore();
      }
      // flame tongues along the burning band (flames always rise, even once it's lying down)
      if (s.lit && (s.landed == null || s.e < s.landed + 3)) {
        const lo = Math.max(0, front - 6);
        NK_TONGUES.forEach((a, i) => {
          if (a[1] > front || a[1] < lo) return;
          const p = api.project(b.toWorld([a[0], a[1] - NK.com, a[2]]));
          flame(c, p.x, p.y, sc * 1.4 * p.f * (0.8 + 0.3 * Math.sin(t * 3 + i)), t + i * 0.9, { w: 0.42, halo: 1.4 });
        });
      }
    },

    stat(s) { return s.toppleAt != null ? `Stood burning ${s.toppleAt.toFixed(1)} s · ${s.pops} pops inside` : s.pops ? `${s.pops} pops inside` : ''; },
  });
})();

// ---------- memory bindings ----------
// The art of lighting (#146–#157) and the first bang of the street (#194).
DiwaliTricks.bind(146, 'lighting-ritual', { tool: 'agarbatti', bomb: 'lakshmi', fuse: 1.8, stat: 'ember', line: 'Agarbatti: dheere, par pakka' }, 'doorstep');
DiwaliTricks.bind(147, 'lighting-ritual', { tool: 'broom', bomb: 'atom', fuse: 2.0, stat: 'aim', line: 'Jhaadu ka asli istemaal' }, 'doorstep');
DiwaliTricks.bind(148, 'lighting-ritual', { tool: 'candle', bomb: 'lakshmi', fuse: 1.5, stat: 'dip', line: 'Mombatti ke paas sabki line lagi thi' }, 'doorstep');
DiwaliTricks.bind(149, 'lighting-ritual', { tool: 'parapet', bomb: 'atom', fuse: 1.6, stat: 'diya', line: 'Diya bhi bacha, hum bhi' }, 'roof');
DiwaliTricks.bind(150, 'lighting-ritual', { tool: 'gas', stat: 'gas', line: 'Gas band, phuljhadi chalu, bhaago bahar' }, 'room');
DiwaliTricks.bind(152, 'lighting-ritual', { tool: 'newspaper', bomb: 'atom', fuse: 1.4, stat: 'torch', line: 'Aaj ka akhbaar kisi ne nahi padha' }, 'doorstep');
DiwaliTricks.bind(153, 'lighting-ritual', { tool: 'agarbatti', bomb: 'lakshmi', fuse: 1.3, run: 'manual', stat: 'run', line: 'Do metre ki daud, poori style mein' }, 'doorstep');
DiwaliTricks.bind(154, 'lighting-ritual', { tool: 'agarbatti', bomb: 'atom', fuse: 1.7, sense: 'eyes', stat: 'eyes', line: 'Aankh band, kaan band, dil dhak-dhak' }, 'doorstep');
DiwaliTricks.bind(155, 'lighting-ritual', { tool: 'agarbatti', bomb: 'lakshmi', fuse: 1.5, sense: 'ear', stat: 'ear', line: 'Ek ungli kaan mein: the signature pose' }, 'doorstep');
DiwaliTricks.bind(157, 'lighting-ritual', { tool: 'sparkler', bomb: 'atom', fuse: 1.6, stat: 'reach', line: 'Door se hi kaam ho gaya' }, 'doorstep');
DiwaliTricks.bind(194, 'lighting-ritual', { tool: 'agarbatti', bomb: 'atom', fuse: 1.8, scene: 'dawn', stat: 'dawn', line: 'Poori gali jaag gayi. Hum jeet gaye' }, 'lane');
// Timing gags, forts, mornings, effigies.
DiwaliTricks.bind(119, 'agarbatti-chain', { count: 3 }, 'courtyard');
DiwaliTricks.bind(123, 'sleeper-dud', {}, 'lane');
DiwaliTricks.bind(142, 'mud-killa', { scene: 'anaar', line: 'Killa safe raha, sipahi let gaye' }, 'courtyard');
DiwaliTricks.bind(143, 'mud-killa', { scene: 'village', line: 'Ek bijli, aur poora gaon ulta' }, 'courtyard');
DiwaliTricks.bind(144, 'mud-killa', { scene: 'soldiers', line: 'War movie khatam. Sab sipahi let gaye' }, 'courtyard');
DiwaliTricks.bind(159, 'dud-hunt', { count: 6 }, 'lane');
DiwaliTricks.bind(210, 'deepavali-dawn', { count: 36 }, 'courtyard');
DiwaliTricks.bind(223, 'narakasur', {}, 'lane');

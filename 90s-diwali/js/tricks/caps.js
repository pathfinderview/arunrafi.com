// caps.js — toy caps: paper roll caps, single tikli and red plastic cap guns. Harmless little pops:
// a sharp "tik", a pin-prick flash and a curl of that acrid smoke.
//   'cap-strike'    #105 roll on the floor tapped with a stone · #106 strip slammed with a brick
//   'tikli-nail'    #113 a single tikli on a nail head, hit with a hammer
//   'chappal-strip' #112 a popping strip scraped under the chappal
//   'cap-gun'       #107 roll-cap pistol · #108 8-shot ring revolver · #109 chor-police · #116 dialogue duel
//   'bolt-grenade'  #111 caps between two washers on a bolt, flung down
//   'cap-fuse'      #114 the whole roll unspooled and lit
//   'chatpati'      #56  Bengal's strike-crackers scraped on the courtyard floor
(function () {
  'use strict';
  const { v3, M3, Body } = Phys;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const now = () => performance.now();
  const host = () => (typeof window !== 'undefined' && window.Stage) || null;
  const autoOn = () => !!(host() && host().autoplay);
  const armedNow = () => !!(host() && host().phase === 'armed');
  const SP = 0.036;          // 7 mm between caps on a roll
  const CAP_R = 0.017;       // each cap's bump of composition, ~3.5 mm across

  // ---------- shared helpers ----------
  function rayPoint(api, x, y, d) {
    const c = api.cam, dx = (x - c.cx) / c.F, dy = -(y - c.cy) / c.F;
    const r = [0, 1, 2].map(i => c.fwd[i] + c.right[i] * dx + c.up[i] * dy), l = Math.hypot(r[0], r[1], r[2]) || 1;
    return [c.C[0] + r[0] / l * d, Math.max(0.05, c.C[1] + r[1] / l * d), c.C[2] + r[2] / l * d];
  }
  function pointerLive(api) { const p = api.pointer; return p.t > 0 && (p.down || now() - p.t < 1400); }
  const panX = (api, x) => clamp((x / api.W - 0.5) * 1.6, -1, 1);
  // one camera for many projections in a frame
  function projector(api) { const S = host(), c = api.cam; return S && S.project3 ? p => S.project3(p, c) : api.project; }
  function glow(ctx, x, y, r, rgb, a) {
    if (r <= 0 || a <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // a ground anchor at a screen fraction; it follows the push-in until the moment goes live
  function anchor(s, api, fx, fy) {
    if (!s.frozen) { const g = api.unproject(api.W * fx, api.H * fy); if (g) s.A = [g[0], 0, g[2]]; }
    return s.A;
  }

  // the sharp paper "tik": a crack with the smallest boom under it (rate-limited so rapid fire stays crisp)
  let lastTik = 0;
  function tik(api, pan, loud = 1) {
    const t = now(); if (t - lastTik < 30) return; lastTik = t;
    api.Sfx.crack({ vol: Math.min(0.9, 0.42 * loud), pieces: 1, pan });
    api.Sfx.boom({ vol: Math.min(0.8, 0.15 * loud), size: 0.06 + 0.05 * loud, pan });
  }
  function capPop(api, p, o = {}) {
    const loud = o.loud || 1;
    if (!o.quiet) tik(api, api.panOf(p), loud);
    api.burst(p, o.flash ?? 7, 2 + loud, { life: 0.12, size: 0.6, color: 'white', flat: true, gravity: 120 });
    api.light(p, 0.28 * loud, [255, 236, 210]);
    if (o.smoke !== 0) api.smoke(p, o.smoke ?? 1, { size: 0.3 + 0.1 * loud });
  }

  // virtual pointer so autoplay performs the same gestures a finger would
  function vInit() { return { x: 0, y: 0, vx: 0, vy: 0, down: false, justDown: false, justUp: false, active: false, t: 0 }; }
  function vGo(v, from, to, dur, delay = 0, hold = 0) { Object.assign(v, { active: true, down: false, t: -delay, dur, hold, from, to, x: from[0], y: from[1], vx: 0, vy: 0 }); }
  function vStep(v, dt) {
    v.justDown = v.justUp = false;
    if (!v.active) return;
    v.t += dt;
    const k = clamp(v.t / v.dur, 0, 1), px = v.x, py = v.y;
    v.x = lerp(v.from[0], v.to[0], k); v.y = lerp(v.from[1], v.to[1], k);
    v.vx = (v.x - px) / Math.max(dt, 1e-3); v.vy = (v.y - py) / Math.max(dt, 1e-3);
    if (!v.down && v.t >= 0) { v.down = true; v.justDown = true; }
    if (k >= 1) { if (v.hold > 0) { v.hold -= dt; v.vx = v.vy = 0; return; } v.down = false; v.justUp = true; v.active = false; }
  }
  const input = (s, api) => (s.v.active || s.v.justUp ? s.v : api.pointer);
  function vTap(v, x, y) { vGo(v, [x, y], [x, y], 0.05); }

  // axis-aligned box faces centred on the origin (bricks, planks, hammer parts)
  function box(w, h, d, rgbOf) {
    const x = w / 2, y = h / 2, z = d / 2;
    const V = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
    const F = [[[4, 5, 6, 7], [0, 0, 1]], [[1, 0, 3, 2], [0, 0, -1]], [[5, 1, 2, 6], [1, 0, 0]], [[0, 4, 7, 3], [-1, 0, 0]], [[7, 6, 2, 3], [0, 1, 0]], [[0, 1, 5, 4], [0, -1, 0]]];
    return F.map(([ix, n], i) => ({ pts: ix.map(k => V[k]), n, rgb: rgbOf(i, n) }));
  }
  const shift = (faces, o) => faces.map(f => ({ ...f, pts: f.pts.map(p => [p[0] + o[0], p[1] + o[1], p[2] + o[2]]) }));

  // a straight strip of roll caps lying on the floor along x
  function drawStrip(api, P, A, x0, x1, w) {
    const ctx = api.ctx, y = 0.004, z = A[2];
    const a = P([A[0] + x0, y, z - w / 2]), b = P([A[0] + x1, y, z - w / 2]), c = P([A[0] + x1, y, z + w / 2]), d = P([A[0] + x0, y, z + w / 2]);
    ctx.fillStyle = '#c93a44'; ctx.strokeStyle = '#8e2430'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  function drawCap(api, P, p, popped, r) {
    const ctx = api.ctx, q = P(p);
    if (popped) {
      ctx.fillStyle = 'rgba(22,16,14,.85)'; ctx.beginPath(); ctx.ellipse(q.x, q.y, r * 1.25, r * 0.75, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(150,140,130,.5)'; ctx.beginPath(); ctx.ellipse(q.x, q.y, r * 0.5, r * 0.3, 0, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = '#6e1f1a'; ctx.beginPath(); ctx.ellipse(q.x, q.y, r, r * 0.62, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(230,140,120,.55)'; ctx.beginPath(); ctx.ellipse(q.x - r * 0.3, q.y - r * 0.2, r * 0.35, r * 0.22, 0, 0, TAU); ctx.fill();
    }
  }
  const pxPerUnit = (P, p) => { const a = P(p), b = P([p[0] + 1, p[1], p[2]]); return Math.abs(b.x - a.x); };

  // ---------- the hand sprite (same cut-out the sparklers use) ----------
  const GRIP = [360, 378], STUB = Math.atan2(-8, -53);
  let tinted = null;
  function handImg(api) {
    const im = api.img('pov-hand');
    if (!im || !im.complete || !im.naturalWidth) return null;
    if (!tinted) {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 640;
        const g = c.getContext('2d'); g.drawImage(im, 0, 0, 640, 640);
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = 'rgba(26,14,36,0.36)'; g.fillRect(0, 0, 640, 640);
        g.fillStyle = 'rgba(255,150,70,0.10)'; g.fillRect(0, 0, 640, 640);
        tinted = c;
      } catch { tinted = im; }
    }
    return tinted;
  }
  const handSize = api => 0.55 * Math.min(api.W, api.H);
  function toS(h, u, v) { const c = Math.cos(h.ang), s = Math.sin(h.ang); return [h.gx + (u * c - v * s) * h.D, h.gy + (u * s + v * c) * h.D]; }
  function drawHand(ctx, api, h) {
    const im = handImg(api), k = h.D / 1000;
    ctx.save(); ctx.translate(h.gx, h.gy); ctx.rotate(h.ang - STUB);
    sleeve(ctx, k);
    if (im) ctx.drawImage(im, -GRIP[0] * k, -GRIP[1] * k, 1000 * k, 1000 * k);
    else {
      ctx.fillStyle = '#6e4a34';
      ctx.beginPath(); ctx.ellipse(150 * k, 90 * k, 160 * k, 125 * k, 0.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(180 * k, 220 * k); ctx.lineTo(420 * k, 120 * k); ctx.lineTo(700 * k, 520 * k); ctx.lineTo(420 * k, 680 * k); ctx.fill();
    }
    ctx.restore();
  }
  // the sprite's kurta sleeve is cut at the image edge; carry it on along the forearm, off-screen
  function sleeve(ctx, k) {
    const X = x => (x - GRIP[0]) * k, Y = y => (y - GRIP[1]) * k, ex = 0.604 * 2400, ey = 0.797 * 2400;
    const g = ctx.createLinearGradient(X(727), Y(1000), X(1000), Y(793));
    g.addColorStop(0, '#8a6e56'); g.addColorStop(0.5, '#987c64'); g.addColorStop(1, '#9e8670');
    ctx.fillStyle = g; ctx.beginPath();
    ctx.moveTo(X(722), Y(1004)); ctx.lineTo(X(1004), Y(1004)); ctx.lineTo(X(1004), Y(788));
    ctx.lineTo(X(1004 + ex), Y(788 + ey)); ctx.lineTo(X(722 + ex), Y(1004 + ey)); ctx.closePath(); ctx.fill();
  }
  // place the hand so a point u along the stub lands on (x, y), keeping it in the lower frame
  function handAt(h, api, x, y, u) {
    h.D = handSize(api);
    h.gx = clamp(x - Math.cos(h.ang) * u * h.D, api.W * 0.12, api.W * 0.92); h.gy = clamp(y - Math.sin(h.ang) * u * h.D, api.H * 0.4, api.H * 0.94);
  }

  // ======================================================================================
  // #105 / #106 — the roll on the floor, hit with a stone (it feeds one cap at a time)
  // or the whole strip slammed with a brick
  // ======================================================================================
  function stoneMesh() {
    const d = Mesh.dome(0.17, { lat: 4, lon: 12, squash: 0.72, colourAt: (i, j) => { const k = 0.75 + 0.35 * Math.abs(Math.sin(i * 7.1 + j * 3.3)); return [118 * k, 112 * k, 104 * k]; }, inner: [60, 58, 54] });
    for (const row of d.grid) for (const p of row) { const k = rnd(0.86, 1.1); p[0] *= k; p[2] *= k; p[1] *= rnd(0.9, 1.08); }
    return d.faces;
  }
  function brickMesh() {
    return box(0.55, 0.375, 1.15, (i, n) => n[1] > 0 ? [172, 80, 50] : n[1] < 0 ? [120, 54, 36] : [rnd(150, 170), rnd(66, 76), rnd(42, 50)]);
  }
  const BRICK_STEPS = [-0.75, -0.3, 0.15, 0.6, 0.88, -0.55, -0.05, 0.4, -0.85, 0.75, 0.25, -0.35, 0.05];

  DiwaliTricks.register({
    id: 'cap-strike',
    name: 'Roll caps on the floor',
    compendium: [105, 106],
    mode: 'ground',
    views: ['doorstep', 'lane'],
    fuse: 0.3,
    interactive: true,
    options: [{ key: 'tool', label: 'Hit with', choices: [['stone', 'A stone'], ['brick', 'A brick']], default: 'stone' }],
    spentLine: 'Pathar se tik-tik, ek ek karke',

    create(api, opts) {
      const tool = opts.tool === 'brick' ? 'brick' : 'stone';
      this.spentLine = tool === 'brick' ? 'Eent se dhadaam: poori patti ek saath' : 'Pathar se tik-tik, ek ek karke';
      const s = { tool, A: [0, 0, 0], frozen: false, v: vInit(), clock: 0, popped: 0, duds: 0, slams: 0, y: tool === 'brick' ? 1.0 : 0.5, phase: 'rest', pt: 0, from: 0,
        feed: 0, feedTo: 0, aim: 0, aimTo: 0, idle: 0, autoT: 0.4, step: 0, after: 0 };
      if (tool === 'stone') { s.N = 30; s.caps = Array.from({ length: s.N }, () => ({ popped: false, dud: Math.random() < 0.14, tried: false })); s.mesh = stoneMesh(); s.rest = 0.5; }
      else { s.N = 56; s.caps = Array.from({ length: s.N }, (_, i) => ({ x: (i - (s.N - 1) / 2) * SP, popped: false })); s.mesh = brickMesh(); s.rest = 1.0; }
      return s;
    },

    autoplay(s, api, t) { if (t > 0.5 && !s.v.active && s.phase === 'rest') { const q = api.project([s.A[0] + s.aim, 0, s.A[2]]); vTap(s.v, q.x, q.y); } },

    update(s, api, dt, e) {
      s.clock += dt;
      const A = anchor(s, api, 0.5, s.tool === 'brick' ? 0.86 : 0.78), can = e >= 0 || armedNow();
      vStep(s.v, dt);
      const P = input(s, api), live = pointerLive(api) || s.v.active;
      // brick: slide along the strip under your finger, or step along it on its own
      if (s.tool === 'brick') {
        if (pointerLive(api) && !s.v.active) { const g = api.unproject(api.pointer.x, api.pointer.y); if (g) s.aimTo = clamp(g[0] - A[0], -0.85, 0.85); }
        s.aim = lerp(s.aim, s.aimTo, 1 - Math.exp(-dt * 9));
      }
      if (e >= 0 && autoOn() && !s.v.active) {
        s.autoT -= dt;
        if (s.autoT <= 0 && (s.phase === 'rest' || s.phase === 'up')) {
          if (s.tool === 'brick') { s.aimTo = BRICK_STEPS[s.step++ % BRICK_STEPS.length]; s.autoT = 0.95; }
          else s.autoT = Math.random() < 0.15 ? 0.9 : rnd(0.22, 0.5);
          const q = api.project([A[0] + (s.tool === 'brick' ? s.aimTo : 0), 0, A[2]]); vTap(s.v, q.x, q.y);
        }
      }
      if (can && P.justDown && (s.phase === 'rest' || s.phase === 'up')) { s.phase = 'down'; s.pt = 0; s.from = s.y; }
      // the stroke
      s.pt += dt;
      const contact = 0.004, downT = s.tool === 'brick' ? 0.08 : 0.06;
      if (s.phase === 'down') {
        s.y = lerp(s.from, contact, Math.min(1, (s.pt / downT) ** 2));
        if (s.pt >= downT) { s.phase = 'up'; s.pt = 0; s.y = contact; impact(s, api, A, e); }
      } else if (s.phase === 'up') {
        const k = Math.min(1, s.pt / (s.tool === 'brick' ? 0.32 : 0.2)); s.y = lerp(contact, s.rest, 1 - (1 - k) ** 2);
        if (k >= 1) s.phase = 'rest';
      } else s.y = s.rest + Math.sin(s.clock * 2.2) * 0.03;
      s.feed = lerp(s.feed, s.feedTo, 1 - Math.exp(-dt * 16));
      if (e < 0) return false;
      s.idle = P.justDown ? 0 : s.idle + dt;
      const done = s.tool === 'stone' ? s.popped >= s.N : (s.popped >= s.N * 0.92 || s.slams >= 14);
      if (done) s.after += dt;
      return s.after > 0.7 || (!autoOn() && s.idle > 5) || e > 32;
    },

    draw(s, api) {
      const ctx = api.ctx, A = anchor(s, api, 0.5, s.tool === 'brick' ? 0.86 : 0.78), P = projector(api), r = Math.max(1.2, pxPerUnit(P, A) * CAP_R);
      ctx.save();
      if (s.tool === 'stone') {
        const xl = Math.max(-1.15, -s.feed * SP - 0.03), xr = 0.47;
        drawStrip(api, P, A, xl, xr, 0.05);
        for (let i = 0; i < s.N; i++) { const x = (i - s.feed) * SP; if (x > 0.44 || x < -1.15) continue; drawCap(api, P, [A[0] + x, 0.006, A[2]], s.caps[i].popped, r); }
        drawCoil(api, P, [A[0] + 0.56, 0, A[2] + 0.02], 0.07 + 0.06 * (1 - s.popped / s.N));
        api.shadow([A[0], 0, A[2]], 0.2, s.y * 2);
        api.drawFaces(Mesh.place(s.mesh, M3.rotY(0.5), [A[0], s.y, A[2]]));
      } else {
        drawStrip(api, P, A, -1.04, 1.04, 0.05);
        for (const c of s.caps) drawCap(api, P, [A[0] + c.x, 0.006, A[2]], c.popped, r);
        const lift = (s.y - 0.004) / (s.rest - 0.004), R = M3.mul(M3.rotZ(0.16 * lift), M3.rotX(-0.1 * lift));
        api.shadow([A[0] + s.aim, 0, A[2]], 0.5, s.y * 1.5);
        api.drawFaces(Mesh.place(s.mesh, R, [A[0] + s.aim, s.y + 0.1875, A[2]]));
      }
      ctx.restore();
    },

    stat(s) {
      if (s.tool === 'stone') return s.popped ? `${s.popped} caps popped${s.duds ? ` · ${s.duds} dud${s.duds === 1 ? '' : 's'}` : ''}` : '';
      return s.slams ? `${s.popped} caps in ${s.slams} slam${s.slams === 1 ? '' : 's'}` : '';
    },
  });
  function drawCoil(api, P, c, rad) {
    const ctx = api.ctx, b = P(c), t = P([c[0], 0.05, c[2]]), ex = P([c[0] + rad, 0.05, c[2]]), ez = P([c[0], 0.05, c[2] + rad]);
    const rx = Math.abs(ex.x - t.x), ry = Math.max(1, Math.abs(ez.y - t.y));
    ctx.fillStyle = '#8e2632'; ctx.beginPath(); ctx.ellipse(b.x, b.y, rx, ry, 0, 0, Math.PI); ctx.lineTo(t.x - rx, t.y); ctx.ellipse(t.x, t.y, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d24c56'; ctx.beginPath(); ctx.ellipse(t.x, t.y, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(110,28,36,.7)'; ctx.lineWidth = 0.8;
    for (let k = 0.35; k < 1; k += 0.22) { ctx.beginPath(); ctx.ellipse(t.x, t.y, rx * k, ry * k, 0, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = '#3a2a24'; ctx.beginPath(); ctx.ellipse(t.x, t.y, rx * 0.22, ry * 0.22, 0, 0, TAU); ctx.fill();
  }
  function impact(s, api, A, e) {
    if (s.tool === 'stone') {
      const k = s.feedTo, cap = s.caps[k], p = [A[0], 0.02, A[2]];
      if (!cap) { api.Sfx.strike('clay', { vol: 0.3, pan: api.panOf(p) }); return; }
      if (cap.dud && !cap.tried) {            // didn't catch: "tuk" — hit it again
        cap.tried = true; s.duds++;
        api.Sfx.strike('clay', { vol: 0.32, pan: api.panOf(p) });
        if (e < 0) api.ignite();
        return;
      }
      cap.popped = true; s.popped++; s.feedTo++;
      capPop(api, p);
      api.Sfx.strike('clay', { vol: 0.12, pan: api.panOf(p) });
      if (Math.random() < 0.3) api.paper(p, 1, 1.2, [[200, 60, 70], [150, 40, 50]]);
      if (e < 0) api.ignite();
      return;
    }
    // brick: everything under it gets a shot at going off
    s.slams++;
    const cx = s.aim, pan = api.panOf([A[0] + cx, 0, A[2]]);
    let n = 0;
    for (const c of s.caps) if (!c.popped && Math.abs(c.x - cx) < 0.29 && Math.random() < 0.62) {
      c.popped = true; n++;
      capPop(api, [A[0] + c.x, 0.03, A[2] + rnd(-0.03, 0.03)], { quiet: true, flash: 4, smoke: Math.random() < 0.5 ? 1 : 0 });
    }
    s.popped += n;
    api.Sfx.strike('clay', { vol: 0.65, pan, detune: 0.7 });
    if (n) {
      api.Sfx.boom({ vol: Math.min(0.85, 0.3 + 0.045 * n), size: Math.min(0.45, 0.14 + 0.02 * n), pan });
      api.Sfx.crack({ vol: 0.55, pieces: Math.min(7, n + 1), pan });
      api.paper([A[0] + cx, 0.05, A[2]], Math.min(10, n), 2.2, [[200, 60, 70], [150, 40, 50]]);
      api.light([A[0] + cx, 0.2, A[2]], 0.5 + 0.04 * n, [255, 230, 200]);
    }
    api.smoke([A[0] + cx, 0.05, A[2]], 2 + Math.ceil(n / 2), { size: 0.6 });
    api.shake(1 + n * 0.3);
    if (e < 0) api.ignite();
  }

  DiwaliTricks.bind(105, 'cap-strike', { tool: 'stone' }, 'doorstep');
  DiwaliTricks.bind(106, 'cap-strike', { tool: 'brick' }, 'lane');

  // ======================================================================================
  // #113 — one tikli on a nail head in a plank; a wobbly hammer. Precision, not power.
  // ======================================================================================
  const NAIL_TOP = 0.235;
  function plankFaces() { return box(2.0, 0.12, 0.7, (i, n) => n[1] > 0 ? [150, 108, 66] : [112, 78, 46]); }
  function hammerFaces() {
    const head = shift(box(0.14, 0.42, 0.15, (i, n) => n[1] < 0 ? [190, 194, 200] : [92, 96, 104]), [0, -0.21, -1.5]);
    const handle = shift(box(0.065, 0.06, 1.5, () => [168, 112, 62]), [0, 0, -0.72]);
    return [...head, ...handle];
  }
  DiwaliTricks.register({
    id: 'tikli-nail',
    name: 'Tikli on a nail',
    compendium: [113],
    mode: 'ground',
    views: ['doorstep', 'lane'],
    fuse: 0.3,
    interactive: true,
    options: [],
    spentLine: 'Ek tikli, ek hathoda, poora nishana',

    create(api) {
      const nail = [...Mesh.cylinder(0.014, 0.12, { segs: 6, bands: 1, rgb: [150, 150, 156] }).faces.map(f => ({ ...f, pts: f.pts.map(p => [p[0], p[1] + 0.17, p[2]]) })),
        ...Mesh.cylinder(0.04, 0.012, { segs: 10, bands: 1, rgb: [176, 178, 184], top: [196, 198, 204] }).faces.map(f => ({ ...f, pts: f.pts.map(p => [p[0], p[1] + 0.229, p[2]]) }))];
      return { A: [0, 0, 0], frozen: false, v: vInit(), clock: 0, plank: plankFaces(), nail, hammer: hammerFaces(), th: 0.75, phase: 'rest', pt: 0, from: 0.75,
        aim: 0, off: 0, tikli: 1, drop: 0, pops: 0, swings: 0, left: 10, dents: [], idle: 0, after: 0, autoCool: 0.6 };
    },

    autoplay(s, api, t) { autoSwing(s, api, t > 0.5); },

    update(s, api, dt, e) {
      s.clock += dt;
      const A = anchor(s, api, 0.5, 0.74), can = e >= 0 || armedNow();
      vStep(s.v, dt);
      const P = input(s, api);
      if (pointerLive(api) && !s.v.active) { const g = api.unproject(api.pointer.x, api.pointer.y); if (g) s.off = lerp(s.off, clamp(g[0] - A[0], -0.6, 0.6), 1 - Math.exp(-dt * 10)); }
      else s.off = lerp(s.off, 0, 1 - Math.exp(-dt * 3));
      // a kid's hand is never still
      s.wob = Math.sin(s.clock * 2.1) * 0.13 + Math.sin(s.clock * 5.3 + 1) * 0.035;
      if (s.phase === 'rest' || s.phase === 'up') s.aim = s.off + s.wob;
      if (e >= 0 && autoOn()) autoSwing(s, api, true, dt);
      if (can && P.justDown && (s.phase === 'rest' || s.phase === 'up') && s.drop <= 0 && s.left > 0) { s.phase = 'down'; s.pt = 0; s.from = s.th; s.swings++; }
      s.pt += dt;
      if (s.phase === 'down') {
        s.th = lerp(s.from, 0, Math.min(1, (s.pt / 0.08) ** 2));
        if (s.pt >= 0.08) { s.phase = 'up'; s.pt = 0; s.th = 0; strikeNail(s, api, A, e); }
      } else if (s.phase === 'up') { const k = Math.min(1, s.pt / 0.3); s.th = lerp(0, 0.75, 1 - (1 - k) ** 2); if (k >= 1) s.phase = 'rest'; }
      else s.th = 0.75 + Math.sin(s.clock * 1.7) * 0.04;
      if (s.drop > 0) { s.drop -= dt; if (s.drop <= 0 && s.left > 0) s.tikli = 1; }
      if (e < 0) return false;
      s.idle = P.justDown ? 0 : s.idle + dt;
      if (s.left <= 0 || s.swings >= 18) s.after += dt;
      return s.after > 0.8 || (!autoOn() && s.idle > 6) || e > 35;
    },

    draw(s, api) {
      const ctx = api.ctx, A = anchor(s, api, 0.5, 0.74), P = projector(api);
      api.shadow([A[0], 0, A[2]], 1.0, 0);
      api.drawFaces(shift(s.plank, [A[0], 0.06, A[2]]));
      for (const d of s.dents) { const q = P([A[0] + d[0], 0.121, A[2] + d[1]]), k = pxPerUnit(P, A); ctx.fillStyle = 'rgba(50,30,16,.55)'; ctx.beginPath(); ctx.ellipse(q.x, q.y, k * 0.06, k * 0.025, 0, 0, TAU); ctx.fill(); }
      api.drawFaces(shift(s.nail, [A[0], 0, A[2]]));
      // the tikli: a single red paper dot on the nail head (or dropping onto it)
      if (s.tikli) {
        const k = pxPerUnit(P, A), y = NAIL_TOP + 0.003 + Math.max(0, s.drop) * 0.6, q = P([A[0], y, A[2]]);
        ctx.fillStyle = '#d23a3a'; ctx.beginPath(); ctx.ellipse(q.x, q.y, k * 0.045, k * 0.026, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#7a1e1a'; ctx.beginPath(); ctx.ellipse(q.x, q.y, k * 0.018, k * 0.011, 0, 0, TAU); ctx.fill();
      }
      const pivot = [A[0] + s.aim, NAIL_TOP + 0.42, A[2] + 1.5];
      const tipY = pivot[1] + Math.sin(s.th) * 1.5 - 0.42 * Math.cos(s.th);
      api.shadow([pivot[0], 0, A[2] + (1 - Math.cos(s.th)) * 1.5], 0.22, Math.max(0, tipY));
      api.drawFaces(Mesh.place(s.hammer, M3.rotX(s.th), pivot));
    },

    stat(s) { return s.swings ? `${s.pops} of ${s.swings} swing${s.swings === 1 ? '' : 's'} popped a tikli` : ''; },
  });
  function autoSwing(s, api, go, dt = 0) {
    s.autoCool -= dt || 1 / 60;
    if (!go || s.v.active || s.phase !== 'rest' || s.drop > 0 || !s.tikli || s.autoCool > 0) return;
    // wait for the wobble to line up (most of the time)
    s.tryMiss ??= Math.random() < 0.18;
    if (Math.abs(s.aim) < (s.tryMiss ? 0.16 : 0.035)) { s.tryMiss = Math.random() < 0.18; const q = api.project([s.A[0], NAIL_TOP, s.A[2]]); vTap(s.v, q.x, q.y); s.autoCool = 0.35; }
  }
  function strikeNail(s, api, A, e) {
    const p = [A[0], NAIL_TOP + 0.01, A[2]], pan = api.panOf(p);
    if (Math.abs(s.aim) < 0.09) {
      api.Sfx.strike('steel', { vol: 0.3, pan, detune: 0.8 });
      if (s.tikli) { s.tikli = 0; s.pops++; s.left--; capPop(api, p, { loud: 1.4, flash: 10, smoke: 2 }); s.drop = s.left > 0 ? 0.55 : 0; }
    } else {           // missed: the hammer thunks into the plank and leaves a dent
      api.Sfx.strike('clay', { vol: 0.5, pan, detune: 0.6 });
      api.smoke([A[0] + s.aim, 0.12, A[2]], 1, { size: 0.3 });
      s.dents.push([s.aim, rnd(-0.05, 0.05)]); if (s.dents.length > 12) s.dents.shift();
      api.shake(0.8);
    }
    if (e < 0) api.ignite();
  }
  DiwaliTricks.bind(113, 'tikli-nail', {}, 'doorstep');

  // ======================================================================================
  // #112 — a popping strip on the road; press with the chappal and scrape across it
  // ======================================================================================
  // right-foot sole outline in world units (x across, z along; −z is toward the toe)
  const SOLE = [[0, 0.62], [0.15, 0.57], [0.19, 0.38], [0.16, 0.12], [0.17, -0.12], [0.2, -0.34], [0.18, -0.5], [0.1, -0.6], [-0.02, -0.64], [-0.13, -0.6], [-0.2, -0.46], [-0.21, -0.3], [-0.16, -0.08], [-0.15, 0.14], [-0.18, 0.38], [-0.14, 0.57]];
  const TOES = [[-0.11, -0.53, 0.05], [-0.02, -0.56, 0.035], [0.05, -0.54, 0.03], [0.11, -0.5, 0.027], [0.15, -0.44, 0.024]];
  DiwaliTricks.register({
    id: 'chappal-strip',
    name: 'Popping strip under the chappal',
    compendium: [112],
    mode: 'ground',
    views: ['lane', 'doorstep'],
    fuse: 0.3,
    interactive: true,
    options: [],
    spentLine: 'Chappal ke neeche chat-chat-chat',

    create() {
      const N = 50;
      return { A: [0, 0, 0], frozen: false, v: vInit(), clock: 0, N, caps: Array.from({ length: N }, (_, i) => ({ x: (i - (N - 1) / 2) * SP, popped: false })),
        fx: 0, fxPrev: 0, lift: 0.3, popped: 0, scrapes: 0, pressing: false, moved: 0, idle: 0, after: 0, dir: 1, autoT: 0 };
    },

    autoplay(s, api, t) { if (t > 0.4 && !s.v.active) autoScrape(s, api); },

    update(s, api, dt, e) {
      s.clock += dt;
      const A = anchor(s, api, 0.5, 0.82), can = e >= 0 || armedNow();
      vStep(s.v, dt);
      const P = input(s, api);
      if (e >= 0 && autoOn() && !s.v.active && s.popped < s.N * 0.9) { s.autoT -= dt; if (s.autoT <= 0) { autoScrape(s, api); s.autoT = 0.25; } }
      const follow = s.v.active || pointerLive(api);
      if (follow) { const g = api.unproject(P.x, P.y); if (g) s.fxT = clamp(g[0] - A[0], -1.1, 1.1); }
      else s.fxT = Math.sin(s.clock * 0.7) * 0.15;
      s.fxPrev = s.fx; s.fx = lerp(s.fx, s.fxT, 1 - Math.exp(-dt * 18));
      const press = can && P.down;
      if (press && !s.pressing) { s.moved = 0; api.Sfx.rustle({ vol: 0.08 }); }
      if (!press && s.pressing && s.moved > 0.25) s.scrapes++;
      s.pressing = press;
      s.lift = lerp(s.lift, press ? 0 : 0.28, 1 - Math.exp(-dt * 14));
      const vx = (s.fx - s.fxPrev) / Math.max(dt, 1e-3);
      if (press && s.lift < 0.05) {
        s.moved += Math.abs(vx) * dt;
        const speed = Math.abs(vx);
        if (speed > 0.5) {
          if (Math.random() < dt * 8) api.Sfx.rustle({ vol: 0.05 });
          for (const c of s.caps) if (!c.popped && Math.abs(c.x - s.fx) < 0.17 && Math.random() < dt * 7 * Math.min(2.5, speed / 2)) {
            c.popped = true; s.popped++;
            const side = Math.sign(rnd(-1, 1)) * 0.2;
            capPop(api, [A[0] + c.x, 0.03, A[2] + side], { flash: 5, smoke: Math.random() < 0.4 ? 1 : 0 });
            if (e < 0) { api.ignite(); e = 0; }
          }
        }
      }
      if (e < 0) return false;
      s.idle = P.down ? 0 : s.idle + dt;
      if (s.popped >= s.N * 0.9) s.after += dt;
      return s.after > 0.8 || (!autoOn() && s.idle > 5) || e > 20;
    },

    draw(s, api) {
      const ctx = api.ctx, A = anchor(s, api, 0.5, 0.82), P = projector(api), r = Math.max(1.2, pxPerUnit(P, A) * CAP_R);
      drawStrip(api, P, A, -0.93, 0.93, 0.05);
      for (const c of s.caps) drawCap(api, P, [A[0] + c.x, 0.006, A[2]], c.popped, r);
      const F = [A[0] + s.fx, s.lift, A[2] + 0.02];
      api.shadow([F[0], 0, F[2] - 0.1], 0.35, s.lift * 6);
      drawChappal(ctx, P, F);
    },

    stat(s) { return s.popped ? `${s.popped} pops in ${Math.max(1, s.scrapes + (s.pressing ? 1 : 0))} scrape${s.scrapes + (s.pressing ? 1 : 0) > 1 ? 's' : ''}` : ''; },
  });
  function autoScrape(s, api) {
    const A = s.A, y = 0.82 * api.H, from = api.project([A[0] - 0.85 * s.dir, 0, A[2]]), to = api.project([A[0] + 0.85 * s.dir, 0, A[2]]);
    vGo(s.v, [from.x, y], [to.x, y], 0.75, 0.25);
    s.dir *= -1;
  }
  function drawChappal(ctx, P, F) {
    const ring = (y, k = 1, dx = 0, dz = 0) => SOLE.map(([x, z]) => P([F[0] + x * k + dx, F[1] + y, F[2] + z * k + dz]));
    const path = q => { ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); };
    // leg and pyjama hem coming in from the bottom of the screen
    const h0 = P([F[0] - 0.12, F[1] + 0.12, F[2] + 0.42]), h1 = P([F[0] + 0.13, F[1] + 0.12, F[2] + 0.42]);
    const k0 = P([F[0] - 0.16, F[1] + 1.8, F[2] + 1.6]), k1 = P([F[0] + 0.18, F[1] + 1.8, F[2] + 1.6]);
    const m0 = P([F[0] - 0.15, F[1] + 0.9, F[2] + 0.95]), m1 = P([F[0] + 0.17, F[1] + 0.9, F[2] + 0.95]);
    path(ring(0)); ctx.fillStyle = '#244f8c'; ctx.fill();                                   // blue rubber sole edge
    path(ring(0.06)); ctx.fillStyle = '#ece6d8'; ctx.fill(); ctx.strokeStyle = '#2f5fa8'; ctx.lineWidth = 1.2; ctx.stroke();  // white footbed
    // the foot on top
    path(ring(0.1, 0.84, 0, 0.03)); const g = ctx.createLinearGradient(h0.x, h0.y - 40, h0.x, h0.y + 10); g.addColorStop(0, '#a8714c'); g.addColorStop(1, '#7c5034'); ctx.fillStyle = g; ctx.fill();
    for (const [x, z, r] of TOES) { const q = P([F[0] + x, F[1] + 0.11, F[2] + z]), e = P([F[0] + x + r, F[1] + 0.11, F[2] + z]); const rr = Math.abs(e.x - q.x); ctx.fillStyle = '#93603f'; ctx.beginPath(); ctx.ellipse(q.x, q.y, rr, rr * 0.8, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(240,220,200,.35)'; ctx.beginPath(); ctx.ellipse(q.x, q.y - rr * 0.2, rr * 0.5, rr * 0.35, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#86583a'; ctx.beginPath(); ctx.moveTo(h0.x, h0.y); ctx.lineTo(h1.x, h1.y); ctx.lineTo(k1.x, k1.y); ctx.lineTo(k0.x, k0.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e4dccb'; ctx.beginPath(); ctx.moveTo(m0.x, m0.y); ctx.lineTo(m1.x, m1.y); ctx.lineTo(k1.x + 30, k1.y + 300); ctx.lineTo(k0.x - 30, k0.y + 300); ctx.closePath(); ctx.fill();
    // the blue V strap from the toe post
    const post = P([F[0] - 0.06, F[1] + 0.13, F[2] - 0.44]), sl = P([F[0] - 0.2, F[1] + 0.07, F[2] + 0.0]), sr = P([F[0] + 0.19, F[1] + 0.07, F[2] + 0.02]), mid = P([F[0], F[1] + 0.2, F[2] - 0.15]);
    ctx.strokeStyle = '#2d5fae'; ctx.lineWidth = Math.max(3, Math.abs(sr.x - sl.x) * 0.12); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sl.x, sl.y); ctx.quadraticCurveTo(mid.x - 4, mid.y, post.x, post.y); ctx.quadraticCurveTo(mid.x + 4, mid.y, sr.x, sr.y); ctx.stroke();
  }
  DiwaliTricks.bind(112, 'chappal-strip', {}, 'lane');

  // ======================================================================================
  // Cap guns, first person, bottom-right like your own hand. Tap to fire.
  // ======================================================================================
  const GUNS = {
    roll: { body: '#c4291f', hi: '#ec5a44', dark: '#7a1510', grip: '#2a2422', gripHi: '#4c423b', metal: '#3a3a3e' },
    ring: { body: '#aab0b9', hi: '#e2e6ea', dark: '#4c5159', grip: '#7a4524', gripHi: '#a3683c', metal: '#2e3036' },
  };
  function gunXY(g, lx, ly) {
    const a = g.aim - g.recoil * 0.22 + (g.twirl || 0), X = (lx + g.recoil * 0.06) * g.sc, Y = ly * g.sc;
    return [g.x + g.m * (X * Math.cos(a) - Y * Math.sin(a)), g.y + X * Math.sin(a) + Y * Math.cos(a)];
  }
  function aimAt(g, x, y) { const d = Math.atan2(y - g.y, g.m * (x - g.x)) - Math.PI; return clamp(Math.atan2(Math.sin(d), Math.cos(d)), -0.45, 0.8); }
  function poly2(ctx, pts) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }
  function drawGun(ctx, g) {
    const C = GUNS[g.kind];
    ctx.save(); ctx.translate(g.x, g.y); if (g.m < 0) ctx.scale(-1, 1);
    ctx.rotate(g.aim - g.recoil * 0.22 + (g.twirl || 0)); ctx.translate(g.recoil * 0.06 * g.sc, 0); ctx.scale(g.sc, g.sc);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 0.012;
    // forearm and kurta sleeve running off the corner
    ctx.fillStyle = '#7e553a'; poly2(ctx, [[0.06, 0.42], [0.36, 0.3], [1.9, 0.95], [1.5, 1.6]]); ctx.fill();
    ctx.fillStyle = '#d4c7aa'; poly2(ctx, [[0.95, 0.6], [1.2, 0.58], [2.2, 1.0], [1.8, 1.9], [0.8, 1.05]]); ctx.fill();
    ctx.strokeStyle = 'rgba(120,100,70,.6)'; ctx.beginPath(); ctx.moveTo(0.95, 0.6); ctx.lineTo(0.8, 1.05); ctx.stroke();
    // grip
    ctx.fillStyle = C.grip; poly2(ctx, [[0.0, 0.04], [0.27, 0.04], [0.37, 0.6], [0.13, 0.66]]); ctx.fill();
    if (g.kind === 'ring') { ctx.fillStyle = C.gripHi; ctx.beginPath(); ctx.arc(0.2, 0.3, 0.05, 0, TAU); ctx.fill(); }
    // barrel and frame
    const L = g.kind === 'ring' ? 1.12 : 1.0;
    ctx.fillStyle = C.body; poly2(ctx, [[-L, -0.16], [-0.15, -0.16], [-0.15, -0.02], [-L, -0.02]]); ctx.fill();
    ctx.fillStyle = C.hi; ctx.fillRect(-L, -0.155, L - 0.17, 0.03);
    ctx.fillStyle = C.dark; ctx.fillRect(-L - 0.04, -0.18, 0.07, 0.18);
    ctx.fillStyle = '#121010'; ctx.beginPath(); ctx.ellipse(-L - 0.04, -0.09, 0.012, 0.045, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.dark; poly2(ctx, [[-L + 0.06, -0.16], [-L + 0.1, -0.21], [-L + 0.13, -0.16]]); ctx.fill();
    ctx.fillStyle = C.body; poly2(ctx, [[-0.22, -0.19], [0.28, -0.19], [0.31, 0.06], [-0.22, 0.06]]); ctx.fill();
    ctx.strokeStyle = C.dark; ctx.stroke();
    // trigger guard + trigger
    ctx.strokeStyle = C.body; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(-0.2, 0.06); ctx.quadraticCurveTo(-0.16, 0.25, 0.02, 0.2); ctx.lineTo(0.03, 0.06); ctx.stroke();
    ctx.strokeStyle = C.metal; ctx.lineWidth = 0.022; ctx.beginPath(); ctx.moveTo(-0.06, 0.06); ctx.quadraticCurveTo(-0.1, 0.12 + (1 - g.hammer) * 0.02, -0.05, 0.17); ctx.stroke();
    ctx.lineWidth = 0.012;
    if (g.kind === 'roll') {
      // the round cap-roll lid on the side and the used strip curling out of the top
      ctx.fillStyle = C.hi; ctx.beginPath(); ctx.arc(0.04, -0.07, 0.085, 0, TAU); ctx.fill(); ctx.strokeStyle = C.dark; ctx.stroke();
      ctx.fillStyle = C.dark; ctx.beginPath(); ctx.arc(0.04, -0.07, 0.018, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#cf3f48'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(0.14, -0.19);
      const pt = u => [0.14 + 0.36 * u, -0.19 - 0.42 * u + 0.3 * u * u];
      for (let u = 0.1; u <= 1.001; u += 0.1) ctx.lineTo(...pt(u)); ctx.stroke();
      const fr = g.feed % 1;
      for (let k = 0; k < 7; k++) { const u = (k + fr) / 7; if (u > 1) continue; const [x, y] = pt(u); ctx.fillStyle = k === 0 && g.flash > 0 ? '#ffd7a0' : '#1e1614'; ctx.beginPath(); ctx.arc(x, y, 0.012, 0, TAU); ctx.fill(); }
      ctx.lineWidth = 0.012;
    } else {
      // revolver drum with the plastic ring cap peeping out; it turns one notch per shot
      ctx.fillStyle = C.dark; poly2(ctx, [[-0.2, -0.2], [0.12, -0.2], [0.12, 0.07], [-0.2, 0.07]]); ctx.fill();
      ctx.strokeStyle = C.hi; ctx.lineWidth = 0.014;
      for (let k = 0; k < 3; k++) { const y = -0.15 + k * 0.09 + ((g.ringRot % 1) * 0.09); if (y < 0.06) { ctx.beginPath(); ctx.moveTo(-0.18, y); ctx.lineTo(0.1, y); ctx.stroke(); } }
      for (let k = 0; k < 3; k++) { const idx = Math.floor(g.ringRot) + k; ctx.fillStyle = idx < g.shots ? '#1e1614' : idx < 8 ? '#d83a32' : '#5a2a28'; ctx.beginPath(); ctx.arc(-0.22, -0.13 + k * 0.08, 0.026, 0, TAU); ctx.fill(); }
      ctx.lineWidth = 0.012;
    }
    // hammer (cocked back, snaps forward on a shot)
    ctx.save(); ctx.translate(0.25, -0.17); ctx.rotate(-0.9 * g.hammer); ctx.fillStyle = C.metal; poly2(ctx, [[-0.03, 0], [0.03, 0], [0.05, -0.1], [0.0, -0.13]]); ctx.fill(); ctx.restore();
    // fist around the grip: fingers, thumb over the top, index on the trigger
    ctx.fillStyle = '#8e6143';
    ctx.beginPath(); ctx.ellipse(0.17, 0.36, 0.17, 0.25, -0.25, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(60,36,22,.6)'; ctx.lineWidth = 0.01;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(0.03 + k * 0.012, 0.24 + k * 0.1); ctx.quadraticCurveTo(0.12, 0.27 + k * 0.1, 0.22, 0.22 + k * 0.11); ctx.stroke(); }
    ctx.fillStyle = '#9a6a4a'; ctx.beginPath(); ctx.ellipse(0.12, 0.02, 0.13, 0.05, -0.25, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8e6143'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(0.04, 0.2); ctx.quadraticCurveTo(-0.08, 0.17 - (1 - g.hammer) * 0.02, -0.07, 0.1); ctx.stroke();
    ctx.restore();
  }
  function gunFire(s, api, g, o = {}) {
    const [mx, my] = gunXY(g, g.kind === 'ring' ? -1.16 : -1.04, -0.09);
    g.recoil = 1; g.hammer = 0; g.flash = 0.09;
    const pan = panX(api, mx), dir = g.aim + (g.m > 0 ? Math.PI : 0);
    const dx = g.m > 0 ? -Math.cos(g.aim) : Math.cos(g.aim), dy = -Math.sin(g.aim);
    if (o.dry) { api.Sfx.strike('shell', { vol: 0.16, pan, detune: 1.6 }); api.Sfx.strike('coin', { vol: 0.05, pan }); return; }
    tik(api, pan, o.loud || 1);
    for (let i = 0; i < (api.reduced ? 3 : 12); i++) { const sp = g.sc * rnd(1, 4), a = rnd(-0.5, 0.5); api.sparkScreen(mx, my, (dx * Math.cos(a) - dy * Math.sin(a)) * sp, (dx * Math.sin(a) + dy * Math.cos(a)) * sp, { life: rnd(0.04, 0.12), color: Math.random() < 0.5 ? 'white' : 'gold', size: rnd(0.5, 0.9), gravity: 200 }); }
    api.light(rayPoint(api, mx, my, 6), 0.35, [255, 230, 200]);
    api.smoke(rayPoint(api, mx, my, 5), 1, { size: 0.35 });
    s.wisps.push({ x: mx, y: my, t: 0, seed: rnd(0, 6), w: g.sc });
    s.words.push({ x: mx + dx * g.sc * 0.15, y: my - g.sc * 0.12, t: 0, text: o.word || (Math.random() < 0.5 ? 'TIK!' : 'TAK!') });
    if (s.wisps.length > 14) s.wisps.shift();
    if (s.words.length > 8) s.words.shift();
  }
  function gunTick(g, dt) {
    g.recoil = Math.max(0, g.recoil - dt * 9); g.hammer = Math.min(1, g.hammer + dt * 8); g.flash = Math.max(0, g.flash - dt);
    g.feed = lerp(g.feed, g.feedTo || 0, 1 - Math.exp(-dt * 18)); g.ringRot = lerp(g.ringRot, g.ringTo || 0, 1 - Math.exp(-dt * 16));
  }
  function drawFx(ctx, s, guns) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const g of guns) if (g.flash > 0) {
      const [mx, my] = gunXY(g, g.kind === 'ring' ? -1.16 : -1.04, -0.09), k = g.flash / 0.09;
      glow(ctx, mx, my, g.sc * 0.35 * k, '255,220,150', 0.8 * k); glow(ctx, mx, my, g.sc * 0.08, '255,255,240', k);
      ctx.strokeStyle = `rgba(255,240,200,${k})`; ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + s.clock * 7; ctx.beginPath(); ctx.moveTo(mx + Math.cos(a) * g.sc * 0.04, my + Math.sin(a) * g.sc * 0.04); ctx.lineTo(mx + Math.cos(a) * g.sc * 0.16 * k, my + Math.sin(a) * g.sc * 0.16 * k); ctx.stroke(); }
    }
    ctx.restore();
    // curling cap smoke
    ctx.save(); ctx.lineCap = 'round';
    for (const w of s.wisps) {
      const a = Math.max(0, 1 - w.t / 1.6) * 0.32; if (a <= 0) continue;
      ctx.strokeStyle = `rgba(200,194,186,${a})`; ctx.lineWidth = Math.max(2, w.w * 0.025) * (1 + w.t);
      ctx.beginPath();
      for (let i = 0; i < 12; i++) { const x = w.x + Math.sin(i * 0.65 + w.t * 3 + w.seed) * (3 + i * 1.6) * (0.6 + w.t), y = w.y - i * 5 * (0.6 + w.t * 0.8) - w.t * 26; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    // comic "TIK!" pops
    ctx.textAlign = 'center';
    for (const t of s.words) {
      const a = Math.max(0, 1 - t.t / 0.7); if (a <= 0) continue;
      ctx.font = `800 ${Math.round(14 + 10 * Math.min(1, t.t * 8))}px system-ui, sans-serif`;
      ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,16,10,.85)'; ctx.strokeText(t.text, t.x, t.y - t.t * 30);
      ctx.fillStyle = '#ffe9b0'; ctx.fillText(t.text, t.x, t.y - t.t * 30);
    }
    ctx.restore();
  }
  function fxTick(s, dt) { for (const w of s.wisps) w.t += dt; for (const t of s.words) t.t += dt; }

  // --- chor-police: cardboard "chor" cut-outs pop up from behind the gate, scooter and cycle ---
  const COVERS = [
    { name: 'scooter', base: [0.43, 0.545], top: [0.43, 0.46], mode: 'up' },
    { name: 'gate', base: [0.2, 0.665], top: [0.245, 0.36], mode: 'side' },
    { name: 'cycle', base: [0.79, 0.69], top: [0.79, 0.5], mode: 'up' },
    { name: 'gate-house', base: [0.47, 0.5], top: [0.47, 0.42], mode: 'up' },
  ];
  function coversNow(api) {
    const S = host(), W = api.W, out = [];
    if (S && S.toScreen) for (const c of COVERS) {
      const b = S.toScreen(c.base[0], c.base[1]), t = S.toScreen(c.top[0], c.top[1]);
      const x = c.mode === 'side' ? t.x : b.x;
      if (x > W * 0.06 && x < W * 0.94) out.push({ ...c, bx: b.x, by: b.y, tx: t.x, ty: t.y });
    }
    if (out.length < 2) out.push({ name: 'road', mode: 'up', bx: W * 0.5, by: api.H * 0.62, tx: W * 0.5, ty: api.H * 0.62 });
    return out;
  }
  function targetBox(api, T) {
    const cv = T.cover, g = api.unproject(cv.bx, cv.by);
    let h = 70, w = 32;
    if (g) { const P = projector(api), b = P([g[0], 0, g[2] - 1]), t = P([g[0], 5, g[2] - 1]); h = Math.abs(b.y - t.y); w = h * 0.42; }
    if (cv.mode === 'side') { const cx = cv.tx - w * 0.5 + w * 0.62 * T.k; return { cx, bottom: cv.by, w, h, clip: [cv.tx, 0, api.W, api.H] }; }
    const cx = cv.bx + T.dx * w, bottom = cv.ty + h * (1 - 0.72 * T.k);
    return { cx, bottom, w, h, clip: [0, 0, api.W, cv.ty] };
  }
  function drawChor(ctx, B, fall, hit) {
    const { cx, bottom, w, h } = B;
    ctx.save(); ctx.beginPath(); ctx.rect(...B.clip); ctx.clip();
    ctx.translate(cx, bottom); ctx.scale(1, 1 - fall * 0.92); ctx.translate(0, 0);
    ctx.fillStyle = '#b88a58'; ctx.strokeStyle = '#5e4128'; ctx.lineWidth = 1.5;
    // body
    ctx.beginPath(); ctx.moveTo(-w * 0.36, 0); ctx.lineTo(-w * 0.44, -h * 0.58); ctx.quadraticCurveTo(-w * 0.4, -h * 0.66, -w * 0.18, -h * 0.68); ctx.lineTo(w * 0.18, -h * 0.68); ctx.quadraticCurveTo(w * 0.4, -h * 0.66, w * 0.44, -h * 0.58); ctx.lineTo(w * 0.36, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    // marker stripes on the shirt
    ctx.fillStyle = 'rgba(40,30,26,.65)'; for (let k = 0; k < 3; k++) ctx.fillRect(-w * 0.4, -h * (0.52 - k * 0.12), w * 0.8, h * 0.04);
    // head, cap, mask
    ctx.fillStyle = '#c09262'; ctx.beginPath(); ctx.arc(0, -h * 0.8, w * 0.22, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b2b33'; ctx.beginPath(); ctx.arc(0, -h * 0.84, w * 0.23, Math.PI, 0); ctx.fill(); ctx.fillRect(-w * 0.05, -h * 0.85, w * 0.34, h * 0.025);
    ctx.fillStyle = '#16161a'; ctx.fillRect(-w * 0.23, -h * 0.82, w * 0.46, h * 0.045);
    ctx.fillStyle = '#e8d2a8'; ctx.beginPath(); ctx.arc(-w * 0.09, -h * 0.798, w * 0.035, 0, TAU); ctx.arc(w * 0.09, -h * 0.798, w * 0.035, 0, TAU); ctx.fill();
    // loot bag
    ctx.fillStyle = '#d8c7a0'; ctx.beginPath(); ctx.arc(w * 0.46, -h * 0.3, w * 0.17, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5e4128'; ctx.font = `700 ${Math.max(8, w * 0.2)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('₹', w * 0.46, -h * 0.27);
    ctx.fillStyle = '#1e1a18'; ctx.font = `800 ${Math.max(7, w * 0.17)}px system-ui, sans-serif`; ctx.fillText('CHOR', 0, -h * 0.18);
    ctx.restore();
    if (hit > 0) { ctx.save(); ctx.textAlign = 'center'; ctx.font = '800 16px system-ui, sans-serif'; ctx.globalAlpha = hit; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,20,10,.9)'; ctx.strokeText('PAKDA!', cx, bottom - h * 0.9 - (1 - hit) * 24); ctx.fillStyle = '#ffd84a'; ctx.fillText('PAKDA!', cx, bottom - h * 0.9 - (1 - hit) * 24); ctx.restore(); }
  }

  // --- the duel: two kids, two cap guns, original filmi-parody lines ---
  const DUEL = [
    ['Yeh mohalla mera hai!', 'Teri goli khatam, Pinku!'],
    ['Haath upar, Bunty! Warna tik-tik!', 'Police? Tere paas toh seeti bhi nahi!'],
    ['Main police hoon, asli wala!', 'Nakli goli, asli dhamaka!'],
    ['Aaj tu nahi bachega, Bunty!', 'Tik-tik se kya hoga, Pinku?'],
    ['Ek roll aur baaki hai!', 'Mummy bula rahi hai... kal milte hain!'],
  ];
  const GUN_KINDS = {
    roll: { line: 'Tik-tik-tik, poori roll khatam' },
    ring: { line: 'Aath goli, phir click-click' },
    chor: { line: 'Chor pakda gaya, police zindabad!' },
    duel: { line: 'Dialogue poore, roll khatam' },
  };
  DiwaliTricks.register({
    id: 'cap-gun',
    name: 'Cap gun',
    compendium: [107, 108, 109, 116],
    mode: 'hand',
    views: ['lane'],
    fuse: 0.3,
    interactive: true,
    options: [{ key: 'game', label: 'Play', choices: [['roll', 'Roll-cap pistol'], ['ring', 'Ring-cap revolver'], ['chor', 'Chor-police'], ['duel', 'Dialogue duel']], default: 'roll' }],
    spentLine: GUN_KINDS.roll.line,

    create(api, opts) {
      const game = GUN_KINDS[opts.game] ? opts.game : 'roll';
      this.spentLine = GUN_KINDS[game].line;
      const gun = { kind: game === 'ring' ? 'ring' : 'roll', m: 1, x: 0, y: 0, sc: 1, aim: 0.25, recoil: 0, hammer: 1, flash: 0, feed: 0, feedTo: 0, ringRot: 0, ringTo: 0, shots: 0, twirl: 0 };
      const s = { game, gun, guns: [gun], v: vInit(), clock: 0, caps: 0, roll: 36, clicks: 0, wisps: [], words: [], idle: 0, after: 0, autoT: 0.5, burst: 0, aimX: null, aimY: null };
      if (game === 'chor') { s.targets = []; s.spawnT = 0.3; s.caught = 0; s.escaped = 0; }
      if (game === 'duel') { s.friend = { ...gun, kind: 'ring', m: -1, shots: 0 }; s.guns.push(s.friend); s.round = 0; s.turn = 'me'; s.wait = 0; s.lines = 0; }
      return s;
    },

    autoplay(s, api, t) { if (t > 0.5 && !s.v.active) autoFire(s, api, true); },

    update(s, api, dt, e) {
      s.clock += dt;
      const W = api.W, H = api.H, can = e >= 0 || armedNow(), g = s.gun;
      vStep(s.v, dt);
      const P = input(s, api), live = s.v.active || pointerLive(api);
      layoutGuns(s, api);
      // aim: at the finger, or a lazy idle sweep
      let ax = W * (0.42 + Math.sin(s.clock * 0.6) * 0.08), ay = H * (0.42 + Math.sin(s.clock * 0.9) * 0.04);
      if (s.game === 'duel') { ax = W * 0.3; ay = H * 0.5; }
      if (live) { ax = P.x; ay = P.y; }
      if (s.aimX == null) { s.aimX = ax; s.aimY = ay; }
      const k = 1 - Math.exp(-dt * 14); s.aimX += (ax - s.aimX) * k; s.aimY += (ay - s.aimY) * k;
      g.aim = aimAt(g, s.aimX, s.aimY);
      if (s.friend) s.friend.aim = aimAt(s.friend, W * 0.72, H * 0.5) + Math.sin(s.clock * 1.3) * 0.03;
      for (const q of s.guns) gunTick(q, dt);
      fxTick(s, dt);
      if (g.spin > 0) { g.spin -= dt; g.twirl = (1 - Math.max(0, g.spin) / 0.8) * TAU * 2; if (g.spin <= 0) g.twirl = 0; }
      if (e >= 0 && autoOn() && !s.v.active) autoFire(s, api, false, dt);
      if (can && P.justDown) pull(s, api, P.x, P.y, e);
      if (s.game === 'chor') chorUpdate(s, api, dt, e);
      if (s.game === 'duel') duelUpdate(s, api, dt, e);
      if (e < 0) return false;
      s.idle = P.justDown ? 0 : s.idle + dt;
      let done = false;
      if (s.game === 'roll') done = s.caps >= s.roll;
      if (s.game === 'ring') done = s.clicks >= 2 && !(g.spin > 0);
      if (s.game === 'chor') done = e > 16 && !s.targets.length || s.caught >= 10;
      if (s.game === 'duel') done = s.round >= DUEL.length && s.wait > 2.2;
      if (done) s.after += dt;
      return s.after > 0.8 || (!autoOn() && s.idle > (s.game === 'duel' ? 9 : 5)) || e > 40;
    },

    draw(s, api) {
      const ctx = api.ctx;
      layoutGuns(s, api);
      if (s.game === 'chor') for (const T of s.targets) drawChor(ctx, targetBox(api, T), T.fall, T.hit);
      for (const g of s.guns) drawGun(ctx, g);
      drawFx(ctx, s, s.guns);
      if (s.game === 'ring' && s.gun.shots) {   // shots left, as little red dots
        ctx.save(); for (let i = 0; i < 8; i++) { ctx.fillStyle = i < 8 - s.gun.shots ? '#e0443a' : 'rgba(40,30,28,.6)'; ctx.beginPath(); ctx.arc(api.W - 24 - i * 13, 24, 4.5, 0, TAU); ctx.fill(); } ctx.restore();
      }
    },

    stat(s) {
      switch (s.game) {
        case 'roll': return s.caps ? `${s.caps} caps popped` : '';
        case 'ring': return s.gun.shots ? `${s.gun.shots} shots${s.clicks >= 2 ? ', then click-click' : ''}` : '';
        case 'chor': return `Chor pakde: ${s.caught}${s.escaped ? ` · ${s.escaped} bhaag gaye` : ''}`;
        case 'duel': return s.lines ? `${s.lines} dialogues · ${s.caps} caps` : '';
      }
      return '';
    },
  });
  function layoutGuns(s, api) {
    const W = api.W, H = api.H, sc = 0.5 * Math.min(W, H);
    // the fist (gun-local 0.17, 0.36) sits at ~68% across, 76% down; the forearm runs off the corner
    const g = s.gun; g.sc = sc; g.x = 0.68 * W - 0.17 * sc; g.y = 0.76 * H - 0.36 * sc;
    if (s.friend) { const f = s.friend; f.sc = sc * 0.92; f.x = 0.32 * W + 0.17 * f.sc; f.y = 0.76 * H - 0.36 * f.sc; }
  }
  // one trigger pull
  function pull(s, api, x, y, e) {
    const g = s.gun;
    if (s.game === 'ring') {
      if (g.shots >= 8) { if (s.clicks < 2) { s.clicks++; gunFire(s, api, g, { dry: true }); if (s.clicks === 2) g.spin = 0.8; } return; }
      g.shots++; g.ringTo = g.shots; s.caps++;
      gunFire(s, api, g, { loud: 1.15, word: g.shots === 8 ? 'BANG!' : 'TAK!' });
    } else {
      if (s.caps >= s.roll && s.game === 'roll') { gunFire(s, api, g, { dry: true }); return; }
      s.caps++; g.feedTo = (g.feedTo || 0) + 1;
      gunFire(s, api, g);
    }
    if (s.game === 'chor') shootAt(s, api, x, y);
    if (s.game === 'duel' && s.turn === 'me' && s.round < DUEL.length) { api.say(DUEL[s.round][0], 1800); s.lines++; s.turn = 'friend'; s.wait = 0; }
    if (e < 0) api.ignite();
  }
  function autoFire(s, api, armed, dt = 0) {
    const W = api.W, H = api.H, v = s.v;
    if (s.game === 'chor') {
      const T = s.targets.find(t => t.state === 'up' && t.t > 0.3 && !t.aimed);
      if (!T) return;
      T.aimed = true;
      const B = targetBox(api, T), miss = Math.random() < 0.15 ? B.w * 1.6 : 0;
      const px = (B.clip[0] > 0 ? Math.max(B.cx, B.clip[0] + B.w * 0.2) : B.cx) + miss, py = B.bottom - B.h * 0.55;
      vGo(v, [px, py], [px, py], 0.05, 0.25);      // swing the gun onto him, then pull
      return;
    }
    if (s.game === 'duel') { if (s.turn === 'me' && s.wait > (armed ? 0 : 1.0) && s.round < DUEL.length) vTap(v, W * 0.32, H * 0.5); return; }
    if (armed) { vTap(v, W * 0.4, H * 0.42); return; }
    s.autoT -= dt;
    if (s.autoT > 0) return;
    const x = W * rnd(0.3, 0.55), y = H * rnd(0.35, 0.5);
    if (s.game === 'ring') { vTap(v, x, y); s.autoT = s.gun.shots >= 8 ? 0.6 : rnd(0.4, 0.6); return; }
    vTap(v, x, y);
    if (s.burst < 2) { s.burst++; s.autoT = 0.13; } else { s.burst = 0; s.autoT = rnd(0.5, 0.9); }
  }
  function chorUpdate(s, api, dt, e) {
    const covers = coversNow(api);
    for (const T of s.targets) {
      T.cover = covers.find(c => c.name === T.cover.name) || T.cover;
      T.t += dt;
      if (T.state === 'rise') { T.k = Math.min(1, T.k + dt * 4); if (T.k >= 1) { T.state = 'up'; T.t = 0; } }
      else if (T.state === 'up') { if (T.t > 2.4) { T.state = 'duck'; if (e >= 0) s.escaped++; } }
      else if (T.state === 'duck') T.k = Math.max(0, T.k - dt * 4);
      else if (T.state === 'hit') { T.fall = Math.min(1, T.fall + dt * 4.5); T.hit = Math.max(0, T.hit - dt * 1.2); }
    }
    s.targets = s.targets.filter(T => !(T.state === 'duck' && T.k <= 0) && !(T.state === 'hit' && T.hit <= 0));
    s.spawnT -= dt;
    const open = covers.filter(c => !s.targets.some(T => T.cover.name === c.name));
    if (s.spawnT <= 0 && open.length && s.targets.length < 2 && (e < 16)) {
      s.spawnT = rnd(0.9, 1.5);
      s.targets.push({ cover: open[(Math.random() * open.length) | 0], state: 'rise', k: 0, t: 0, fall: 0, hit: 0, dx: rnd(-0.6, 0.6) });
      api.Sfx.rustle({ vol: 0.06 });
    }
  }
  function shootAt(s, api, x, y) {
    for (const T of s.targets) {
      if (T.state !== 'up' && T.state !== 'rise') continue;
      const B = targetBox(api, T), top = B.bottom - B.h, left = Math.max(B.cx - B.w * 0.5, B.clip[0]), bottom = Math.min(B.bottom, B.clip[3]);
      if (x > left - 6 && x < B.cx + B.w * 0.55 && y > top - 6 && y < bottom) {
        T.state = 'hit'; T.hit = 1; s.caught++;
        api.Sfx.strike('clay', { vol: 0.28, pan: panX(api, x), detune: 1.4 }); api.Sfx.rustle({ vol: 0.12, pan: panX(api, x) });
        if (s.caught === 1) api.say('Chor pakda!', 1300);
        return;
      }
    }
  }
  function duelUpdate(s, api, dt, e) {
    s.wait += dt;
    if (s.turn === 'friend' && s.wait > 1.3) {
      const f = s.friend;
      f.shots++; f.ringTo = f.shots % 8;
      gunFire(s, api, f, { word: 'TAK!' }); s.caps++;
      api.say(DUEL[s.round][1], 1900); s.lines++;
      s.round++; s.turn = 'me'; s.wait = 0;
    }
  }
  DiwaliTricks.bind(107, 'cap-gun', { game: 'roll' }, 'lane');
  DiwaliTricks.bind(108, 'cap-gun', { game: 'ring' }, 'lane');
  DiwaliTricks.bind(109, 'cap-gun', { game: 'chor' }, 'lane');
  DiwaliTricks.bind(116, 'cap-gun', { game: 'duel' }, 'lane');

  // ======================================================================================
  // #111 — bolt-and-washer "grenade": flick it up the lane; it goes off when it lands nose-first,
  // the loose washer skittering away with a clink
  // ======================================================================================
  const steel = (k = 1) => [150 * k, 152 * k, 158 * k];
  function boltParts() {
    const at = (faces, y) => faces.map(f => ({ ...f, pts: f.pts.map(p => [p[0], p[1] + y, p[2]]) }));
    const head = at(Mesh.cylinder(0.065, 0.05, { segs: 6, bands: 1, rgb: steel(0.95), top: steel(1.1) }).faces, 0.17);
    const shaft = at(Mesh.cylinder(0.028, 0.32, { segs: 8, bands: 1, rgb: steel(0.85) }).faces, 0.0);
    const w1 = at(Mesh.cylinder(0.085, 0.014, { segs: 14, bands: 1, rgb: steel(1.05), top: steel(1.15) }).faces, -0.06);
    const capRing = at(Mesh.cylinder(0.07, 0.012, { segs: 14, bands: 1, rgb: [190, 50, 56], top: [205, 70, 70] }).faces, -0.073);
    const w2 = Mesh.cylinder(0.085, 0.014, { segs: 14, bands: 1, rgb: steel(1.05), top: steel(1.15) });
    const nut = at(Mesh.cylinder(0.05, 0.04, { segs: 6, bands: 1, rgb: steel(0.8), top: steel(0.95) }).faces, -0.13);
    return { head, shaft, w1, capRing, w2: w2.faces, w2hull: w2.hull, nut };
  }
  DiwaliTricks.register({
    id: 'bolt-grenade',
    name: 'Bolt-and-washer grenade',
    compendium: [111],
    mode: 'hand',
    views: ['lane'],
    fuse: 0.3,
    interactive: true,
    options: [],
    spentLine: 'Instant war movie, gali number 4',

    create(api) {
      const parts = boltParts();
      return { parts, v: vInit(), clock: 0, held: true, h: { gx: 0, gy: 0, ang: -2.0, D: 1 }, hx: null, hy: null, bolt: null, washer: null, banged: false, throwAt: null, bangAt: null, follow: 0 };
    },

    autoplay(s, api, t) {
      if (t > 0.6 && !s.v.active && s.held) { const W = api.W, H = api.H; vGo(s.v, [W * 0.62, H * 0.86], [W * 0.56, H * 0.5], 0.2, 0.15); }
    },

    update(s, api, dt, e) {
      s.clock += dt;
      const W = api.W, H = api.H, can = e >= 0 || armedNow();
      vStep(s.v, dt);
      const P = input(s, api), live = s.v.active || pointerLive(api);
      if (s.held) {
        let tx = W * 0.62 + Math.sin(s.clock * 1.4) * 0.02 * W, ty = H * 0.72 + Math.sin(s.clock * 2.1) * 0.01 * H;
        if (live) { tx = P.x; ty = Math.max(P.y, H * 0.3); }
        if (s.hx == null) { s.hx = tx; s.hy = ty; }
        const k = 1 - Math.exp(-dt * 20); s.hx += (tx - s.hx) * k; s.hy += (ty - s.hy) * k;
        if (can && P.down) { s.path ??= []; s.path.push([P.x, P.y, s.clock]); if (s.path.length > 12) s.path.shift(); }
        if (can && P.justUp && s.path && s.path.length > 1) {
          const a = s.path[0], b = s.path[s.path.length - 1], T = Math.max(0.03, b[2] - a[2]);
          const vy = (b[1] - a[1]) / T, vx = (b[0] - a[0]) / T;
          if (vy < -250 || a[1] - b[1] > 40) throwBolt(s, api, vx, vy);
          s.path = null;
        }
        if (!P.down && !P.justUp) s.path = null;
      } else s.follow = Math.min(1, s.follow + dt * 3);
      if (s.bolt) stepBolt(s, api, dt, e);
      if (e < 0) return false;
      const still = (!s.bolt || !s.bolt.awake) && (!s.washer || !s.washer.awake);
      return (s.banged && still && e > 1.5) || e > 10;
    },

    draw(s, api) {
      const ctx = api.ctx, h = s.h;
      if (s.hx == null) { s.hx = api.W * 0.62; s.hy = api.H * 0.72; }
      if (s.bolt) {
        const b = s.bolt, pp = s.parts;
        api.shadow(b.pos, 0.1, b.pos[1]);
        api.drawFaces(Mesh.place(s.banged ? [...pp.head, ...pp.shaft, ...pp.w1] : [...pp.head, ...pp.shaft, ...pp.w1, ...pp.capRing, ...pp.w2.map(f => ({ ...f, pts: f.pts.map(p => [p[0], p[1] - 0.085, p[2]]) })), ...pp.nut], b.R, b.pos));
        if (s.washer) { api.shadow(s.washer.pos, 0.09, s.washer.pos[1]); api.drawFaces(Mesh.place(pp.w2, s.washer.R, s.washer.pos)); }
      }
      // your hand: holding the bolt, then following through after the throw
      h.ang = -2.0 - s.follow * 0.25;
      handAt(h, api, s.hx, s.hy - s.follow * api.H * 0.08, 0.07);
      if (s.held) drawHeldBolt(ctx, h);
      drawHand(ctx, api, h);
    },

    stat(s) {
      if (!s.banged) return '';
      return `Bang at ${s.bangDist.toFixed(1)} m${s.washer ? ` · washer rolled ${(s.washer.travel * Phys.UNIT_M).toFixed(1)} m` : ''}`;
    },
  });
  function drawHeldBolt(ctx, h) {
    const [x, y] = toS(h, 0.08, 0), D = h.D, a = h.ang;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = '#8c9098'; ctx.fillRect(-D * 0.008, -D * 0.06, D * 0.016, D * 0.09);           // shaft
    ctx.fillStyle = '#b4b8c0'; ctx.fillRect(-D * 0.025, -D * 0.012, D * 0.05, D * 0.006); ctx.fillRect(-D * 0.025, -D * 0.0, D * 0.05, D * 0.006);   // washers
    ctx.fillStyle = '#c63a40'; ctx.fillRect(-D * 0.02, -D * 0.006, D * 0.04, D * 0.006);           // caps between them
    ctx.fillStyle = '#9da1a8'; ctx.fillRect(-D * 0.018, -D * 0.075, D * 0.036, D * 0.016);          // hex head
    ctx.restore();
  }
  function throwBolt(s, api, vx, vy) {
    const strength = clamp(-vy / 1400, 0.45, 1.25), W = api.W;
    const start = rayPoint(api, s.hx, s.hy - s.h.D * 0.05, 5);
    s.held = false; s.throwAt = start.slice();
    const pp = s.parts;
    s.bolt = new Body({
      pos: start, mass: 0.05, inertia: 0.05 * 0.01, restitution: 0.35, friction: 0.5, angDrag: 0.2, contactAngDrag: 3, hull: [[0, 0.2, 0], [0, -0.15, 0], [0.085, -0.06, 0], [-0.085, -0.06, 0], [0, -0.06, 0.085], [0, -0.06, -0.085]],
      onImpact: (sp, at) => { if (!s.banged && sp > 4) bang(s, api, at); else if (sp > 2) api.Sfx.strike('steel', { vol: clamp(sp / 60, 0.03, 0.2), pan: api.panOf(at) }); },
    });
    s.bolt.R = M3.rotX(-0.4);
    s.bolt.kick([vx / W * 6 + rnd(-0.5, 0.5), rnd(9, 13) * strength, -rnd(9, 13) * strength], [rnd(-8, 8), rnd(-3, 3), rnd(-8, 8)]);
    api.Sfx.whoosh({ vol: 0.08, dur: 0.3, pan: api.panOf(start) });
    api.ignite();
  }
  function stepBolt(s, api, dt, e) {
    for (let i = 0; i < 4; i++) { s.bolt.step(dt / 4); if (s.washer) s.washer.step(dt / 4); }
  }
  function bang(s, api, at) {
    s.banged = true;
    const p = [at[0], 0.05, at[2]], pan = api.panOf(p);
    s.bangDist = Math.hypot(at[0] - s.throwAt[0], at[2] - s.throwAt[2]) * Phys.UNIT_M;
    api.Sfx.boom({ vol: 0.75, size: 0.32, pan }); api.Sfx.crack({ vol: 0.5, pieces: 3, pan });
    api.burst(p, 50, 6, { flat: true }); api.smoke(p, 8, { size: 0.7 }); api.light([at[0], 0.3, at[2]], 0.9, [255, 220, 170]);
    api.paper(p, 6, 2.2, [[200, 60, 70], [150, 40, 50]]); api.shake(3);
    const pp = s.parts;
    s.washer = new Body({
      pos: [at[0], 0.06, at[2]], mass: 0.01, inertia: 0.01 * 0.004, restitution: 0.45, friction: 0.35, angDrag: 0.15, contactAngDrag: 1.2, hull: pp.w2hull,
      onImpact: (sp, q) => api.Sfx.strike('coin', { vol: clamp(sp / 40, 0.04, 0.45), pan: api.panOf(q), detune: rnd(0.95, 1.08) }),
    });
    s.washer.kick([rnd(-5, 5), rnd(6, 9), rnd(-4, 3)], [rnd(-20, 20), rnd(-6, 6), rnd(-20, 20)]);
    s.bolt.kick([rnd(-2, 2), rnd(3, 5), rnd(-2, 1)], [rnd(-10, 10), 0, rnd(-10, 10)]);
    api.remain((ctx, a) => {
      const c = a.project([p[0], 0.002, p[2]]), r = a.cam.scale * 0.22 * c.f;
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, 0.45);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(18,12,9,.5)'); g.addColorStop(1, 'rgba(18,12,9,0)');
      ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
    });
  }
  DiwaliTricks.bind(111, 'bolt-grenade', {}, 'lane');

  // ======================================================================================
  // #114 — the whole roll unspooled down the road and lit at one end: a fizzing chain of pops
  // ======================================================================================
  DiwaliTricks.register({
    id: 'cap-fuse',
    name: 'The whole roll, lit',
    compendium: [114],
    mode: 'ground',
    views: ['lane', 'courtyard'],
    fuse: 1.1,
    options: [],
    spentLine: 'Poori roll ek saans mein: fssst-tiktiktik',

    create(api) {
      // a snaking strip ~1.6 m long, from the left of the road to the right
      const pts = [], N = 160;
      for (let i = 0; i <= N; i++) { const x = -4 + 8 * i / N; pts.push([x, 0.35 * Math.sin(x * 1.3) + 0.15 * Math.sin(x * 3.1 + 1)]); }
      const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const len = cum[cum.length - 1], caps = [];
      for (let a = 0.05; a < len; a += SP) caps.push({ a, popped: false });
      return { A: [0, 0, 0], frozen: false, pts, cum, len, caps, front: 0, popped: 0, next: 0, smokeT: 0, speed: 1.6, stall: 0, t: 0 };
    },

    wick(s, api) { const A = anchor(s, api, 0.5, 0.8), [x, z] = s.pts[0]; return [A[0] + x, 0.02, A[2] + z]; },

    ignite(s, api) {
      s.frozen = true;
      s.fizz = api.Sfx.fuse({ vol: 0.07, pan: api.panOf(this.wick(s, api)) });
      const A = s.A, pts = s.pts, cum = s.cum, sref = s;
      api.remain((ctx, a) => {      // the burnt black line stays on the road
        if (sref.front < 0.05) return;
        ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(14,10,8,.55)';
        ctx.beginPath(); let started = false;
        for (let i = 0; i < pts.length && cum[i] <= sref.front; i++) { const q = a.project([A[0] + pts[i][0], 0.003, A[2] + pts[i][1]]); ctx.lineWidth = Math.max(1, a.cam.scale * 0.04 * q.f); started ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); started = true; }
        ctx.stroke(); ctx.restore();
      });
    },

    update(s, api, dt, e) {
      s.t += dt;
      // the front races, stutters on a damp bit, races again
      if (s.stall > 0) s.stall -= dt; else if (Math.random() < dt * 0.6) s.stall = rnd(0.1, 0.35);
      s.front = Math.min(s.len, s.front + (s.stall > 0 ? 0.25 : s.speed * rnd(0.8, 1.25)) * dt);
      const A = s.A, f = pointAt(s, s.front), p = [A[0] + f[0], 0.02, A[2] + f[1]];
      if (s.front < s.len) {
        for (let i = 0; i < (api.reduced ? 1 : 5); i++) api.spark(p, [rnd(-2.5, 2.5), rnd(0.5, 4), rnd(-2.5, 2.5)], { life: rnd(0.12, 0.35), size: rnd(0.5, 1), gravity: 160 });
        api.light([p[0], 0.15, p[2]], 0.45, [255, 214, 160]);
        s.smokeT -= dt; if (s.smokeT <= 0) { s.smokeT = 0.07; api.smoke(p, 1, { size: 0.45 }); }
      }
      let popsNow = 0;
      while (s.next < s.caps.length && s.caps[s.next].a <= s.front) {
        const c = s.caps[s.next++]; c.popped = true; s.popped++; popsNow++;
        const q = pointAt(s, c.a), cp = [A[0] + q[0], 0.02, A[2] + q[1]];
        capPop(api, cp, { quiet: popsNow > 1 || Math.random() < 0.35, flash: 3, smoke: 0, loud: rnd(0.6, 1.1) });
      }
      if (s.front >= s.len) { s.fizz?.stop(); s.fizz = null; s.endT = (s.endT || 0) + dt; }
      return (s.endT || 0) > 1.2 || e > 20;
    },

    stop(s) { s.fizz?.stop(); s.fizz = null; },

    draw(s, api) {
      const ctx = api.ctx, A = anchor(s, api, 0.5, 0.8), P = projector(api), k = pxPerUnit(P, A), r = Math.max(1.1, k * CAP_R);
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const line = (a0, a1, style, w) => {
        ctx.beginPath(); let st = false;
        for (let i = 0; i < s.pts.length; i++) { if (s.cum[i] < a0 || s.cum[i] > a1) continue; const q = P([A[0] + s.pts[i][0], 0.004, A[2] + s.pts[i][1]]); st ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); st = true; }
        const e = pointAt(s, a1), q = P([A[0] + e[0], 0.004, A[2] + e[1]]); if (st) ctx.lineTo(q.x, q.y);
        ctx.strokeStyle = style; ctx.lineWidth = w; ctx.stroke();
      };
      line(s.front, s.len, '#c93a44', Math.max(2, k * 0.05));
      line(0, s.front, '#2a2320', Math.max(1.5, k * 0.04));
      // caps: every other one is plenty at this distance
      for (let i = s.next; i < s.caps.length; i += 2) { const q = pointAt(s, s.caps[i].a); drawCap(api, P, [A[0] + q[0], 0.006, A[2] + q[1]], false, r); }
      if (s.front > 0 && s.front < s.len) {
        const f = pointAt(s, s.front), q = P([A[0] + f[0], 0.02, A[2] + f[1]]);
        ctx.globalCompositeOperation = 'lighter'; glow(ctx, q.x, q.y, k * 0.35, '255,190,110', 0.45); glow(ctx, q.x, q.y, k * 0.06, '255,250,230', 1);
      }
      ctx.restore();
    },

    stat(s) { return s.popped ? `${s.popped} caps in ${(s.front * Phys.UNIT_M).toFixed(1)} m · ${s.t.toFixed(1)} s` : ''; },
  });
  function pointAt(s, a) {
    a = clamp(a, 0, s.len);
    let lo = 0, hi = s.cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s.cum[m] < a) lo = m; else hi = m; }
    const t = (a - s.cum[lo]) / ((s.cum[hi] - s.cum[lo]) || 1);
    return [lerp(s.pts[lo][0], s.pts[hi][0], t), lerp(s.pts[lo][1], s.pts[hi][1], t)];
  }
  DiwaliTricks.bind(114, 'cap-fuse', {}, 'lane');

  // ======================================================================================
  // #56 — chatpati (Bengal): a flat strike-cracker scraped on the courtyard floor till it catches
  // and crackles. Let go in time and it fizzes out on the floor; hold on too long and it snaps
  // right by your fingers (a fright, not a hurt).
  // ======================================================================================
  const CHAT_U = 0.075;     // where the tablet sits on the stub, in hand units
  DiwaliTricks.register({
    id: 'chatpati',
    name: 'Chatpati on the floor',
    compendium: [56],
    mode: 'hand',
    views: ['courtyard', 'lane'],
    fuse: 0.3,
    interactive: true,
    options: [],
    spentLine: 'Zyada der pakdi, toh chatpati ne chat se jawab diya',

    create(api) {
      return { v: vInit(), clock: 0, h: { gx: 0, gy: 0, ang: 3.05, D: 1 }, tx: null, ty: null, left: 5, used: 0, close: 0, state: 'held', st: 0, rub: 0, onFloor: [], forks: [], jerk: 0, idle: 0, after: 0, autoN: 0, crackT: 0 };
    },

    autoplay(s, api, t) { if (t > 0.5 && !s.v.active && s.state === 'held') autoChat(s, api); },

    update(s, api, dt, e) {
      s.clock += dt;
      const W = api.W, H = api.H, can = e >= 0 || armedNow(), h = s.h;
      vStep(s.v, dt);
      const P = input(s, api), live = s.v.active || pointerLive(api);
      if (e >= 0 && autoOn() && !s.v.active && s.state === 'held' && s.left > 0) { s.autoWait = (s.autoWait || 0) + dt; if (s.autoWait > 0.6) { s.autoWait = 0; autoChat(s, api); } }
      let tx = W * 0.6 + Math.sin(s.clock * 1.2) * 0.02 * W, ty = H * 0.72 + Math.sin(s.clock * 0.9) * 0.015 * H;
      if (live && P.y > H * 0.3) { tx = P.x; ty = P.y; }
      if (s.jerk > 0) { s.jerk -= dt; tx += Math.sin(s.jerk * 60) * 10; ty -= (s.jerk / 0.5) * H * 0.18; }
      if (s.tx == null) { s.tx = tx; s.ty = ty; }
      const k = 1 - Math.exp(-dt * 20); s.tx += (tx - s.tx) * k; s.ty += (ty - s.ty) * k;
      handAt(h, api, s.tx, s.ty, CHAT_U);
      const [cx, cy] = toS(h, CHAT_U, 0); s.cx = cx; s.cy = cy;
      const D = h.D, pressed = can && P.down && P.y > H * 0.3;
      // scraping: friction sparks till it catches
      if (s.state === 'held' && pressed && s.left > 0) {
        const sp = Math.hypot(P.vx || 0, P.vy || 0);
        if (sp > 80) {
          s.rub += sp * dt;
          if (Math.random() < 0.6) api.sparkScreen(cx, cy, rnd(-0.4, 0.4) * D, -rnd(0.05, 0.4) * D, { life: rnd(0.04, 0.12), color: 'gold', size: 0.6, gravity: D * 2, floor: cy + 3 });
          if (Math.random() < dt * 10) api.Sfx.rustle({ vol: 0.07 });
        }
        if (s.rub > Math.min(W, H) * 0.1) { s.state = 'fizz'; s.st = 0; s.left--; s.used++; s.rub = 0; api.Sfx.crack({ vol: 0.4, pieces: 3 }); if (e < 0) api.ignite(); }
      } else if (s.state === 'held') s.rub = Math.max(0, s.rub - dt * 200);
      if (s.state === 'fizz') {
        s.st += dt;
        crackle(s, api, cx, cy, dt, D);
        if (!pressed && !P.down) {           // let go in time: it drops and finishes on the floor
          s.onFloor.push({ x: cx, y: cy + D * 0.02, t: s.st });
          s.state = 'gap'; s.st = 0;
        } else if (s.st > 1.3) {             // held on too long: CHAT! right by the fingers
          capPop(api, rayPoint(api, cx, cy, 5), { loud: 1.6, flash: 14, smoke: 3 });
          api.Sfx.crack({ vol: 0.6, pieces: 4 }); api.shake(2);
          s.close++; s.jerk = 0.5; s.state = 'gap'; s.st = 0;
          api.say(s.close === 1 ? 'Arre baap re! Chhod de!' : 'Phir se? Chhodna tha!', 1500);
        }
      } else if (s.state === 'gap') { s.st += dt; if (s.st > 0.7) s.state = s.left > 0 ? 'held' : 'done'; }
      for (let i = s.onFloor.length - 1; i >= 0; i--) {
        const f = s.onFloor[i]; f.t += dt;
        crackle(s, api, f.x, f.y, dt * 0.8, D);
        if (f.t > 1.5) { capPop(api, rayPoint(api, f.x, f.y, 6), { loud: 1.2, flash: 10, smoke: 2 }); s.onFloor.splice(i, 1); }
      }
      // runs the spark forks
      for (let i = s.forks.length - 1; i >= 0; i--) {
        const q = s.forks[i]; q.t -= dt; if (q.t > 0) continue;
        for (let j = 0; j < 3; j++) { const a = rnd(0, TAU), v = D * rnd(0.15, 0.4); api.sparkScreen(q.x, q.y, Math.cos(a) * v, Math.sin(a) * v, { life: rnd(0.03, 0.09), color: 'white', size: 0.45, gravity: D, floor: q.floor }); }
        s.forks[i] = s.forks[s.forks.length - 1]; s.forks.pop();
      }
      if (e < 0) return false;
      s.idle = P.down ? 0 : s.idle + dt;
      if (s.state === 'done' && !s.onFloor.length) s.after += dt;
      return s.after > 0.6 || (!autoOn() && s.idle > 6 && s.state === 'held' && !s.onFloor.length) || e > 35;
    },

    draw(s, api) {
      const ctx = api.ctx, h = s.h;
      if (s.tx == null) { handAt(h, api, api.W * 0.6, api.H * 0.72, CHAT_U); [s.cx, s.cy] = toS(h, CHAT_U, 0); }
      const D = h.D;
      // scrape marks on the floor
      ctx.save();
      for (const f of s.onFloor) { tablet(ctx, f.x, f.y, D, 0.2, true); ctx.globalCompositeOperation = 'lighter'; glow(ctx, f.x, f.y, D * 0.12, '255,200,140', 0.5); ctx.globalCompositeOperation = 'source-over'; }
      if (s.state === 'held' || s.state === 'fizz') tablet(ctx, s.cx, s.cy, D, h.ang, s.state === 'fizz');
      drawHand(ctx, api, h);
      if (s.state === 'fizz') { ctx.globalCompositeOperation = 'lighter'; glow(ctx, s.cx, s.cy, D * 0.16, '255,210,150', 0.55); glow(ctx, s.cx, s.cy, D * 0.03, '255,255,240', 1); }
      ctx.restore();
    },

    stat(s) { return s.used ? `${s.used} chatpati${s.used === 1 ? '' : 's'} · ${s.close} close call${s.close === 1 ? '' : 's'}` : ''; },
  });
  function tablet(ctx, x, y, D, ang, burnt) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = burnt ? '#3b2e28' : '#2f8a4a'; ctx.fillRect(-D * 0.025, -D * 0.017, D * 0.05, D * 0.034);
    if (!burnt) { ctx.fillStyle = '#e04b8a'; ctx.fillRect(-D * 0.025, -D * 0.005, D * 0.05, D * 0.01); }
    ctx.restore();
  }
  function crackle(s, api, x, y, dt, D) {
    const n = Math.round(rnd(0.6, 1.4) * 240 * dt * (api.reduced ? 0.2 : 1));
    for (let i = 0; i < n; i++) {
      const a = rnd(-Math.PI, 0.2), v = D * rnd(0.2, 1.1), life = rnd(0.04, 0.18);
      api.sparkScreen(x, y, Math.cos(a) * v, Math.sin(a) * v, { life, color: Math.random() < 0.6 ? 'white' : 'gold', size: rnd(0.5, 0.9), gravity: D * 1.6, floor: y + 4 });
      if (Math.random() < 0.25 && s.forks.length < 200) s.forks.push({ x: x + Math.cos(a) * v * life * 0.6, y: y + Math.sin(a) * v * life * 0.6, t: life * 0.6, floor: y + 4 });
    }
    s.crackT -= dt;
    if (s.crackT <= 0) { s.crackT = rnd(0.04, 0.09); api.Sfx.crack({ vol: 0.14, pieces: 2, pan: panX(api, x) }); }
    api.light(rayPoint(api, x, y, 6), 0.5, [255, 220, 180]);
  }
  function autoChat(s, api) {
    const W = api.W, H = api.H, holdLong = s.used % 2 === 1;   // every other one, held a bit too long
    vGo(s.v, [W * 0.4, H * 0.72], [W * 0.62, H * 0.75], 0.35, 0.1, holdLong ? 1.6 : 0.45);
  }
  DiwaliTricks.bind(56, 'chatpati', {}, 'courtyard');
})();

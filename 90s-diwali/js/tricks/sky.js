// sky.js — the rocket family. Compendium #1 3 4 6 7 8 10 11 13 14 15 17 18 198.
// Rockets launched from the terrace parapet (place 'roof'): a fizzing sputter on the fuse, a sharp
// whoosh with a tail flare and a camera nudge, a thick curling gold trail that lingers and drifts,
// a wobbly climb (with a rising whistle on the whistle types), then a burst picked per launch from
// real 90s rocket heads: gold willow, rang-birangi peony, chit-chit glitter, double ring, or (1 in 8)
// a dud that just goes "phut". Bursts are sized from the real distance so one over the park fills
// about a third of the sky; they light the houses, and the bang arrives late because it is far.
// Plus three cousins: the rocket car down the lane, "the train" on a string, and two sky games
// (the dogfight and the judges' panel).
(function () {
  'use strict';
  const { G, v3, M3, UNIT_M } = Phys;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const TAU = Math.PI * 2;
  const RGB = { gold: [255, 190, 90], rose: [255, 150, 190], green: [170, 255, 150], blue: [150, 190, 255], white: [235, 240, 255], red: [255, 120, 100] };
  const COLOURS = ['gold', 'rose', 'green', 'blue'];
  const L = 3.0;      // rocket: ~10 cm tube + ~50 cm stick (world units)
  const TUBE = 0.36;  // fraction of the cutout-rocket sprite that is tube + nose
  const SPUTTER = 0.38;
  const phaseNow = () => (typeof Stage !== 'undefined' ? Stage.phase : 'armed');
  const ready = i => i && i.complete && i.naturalWidth > 0;

  // ---------- small helpers ----------
  function later(s, dt, fn) { s.later.push({ at: s.clock + dt, fn }); }
  function runLater(s) {
    for (let i = s.later.length - 1; i >= 0; i--) if (s.clock >= s.later[i].at) { const f = s.later[i].fn; s.later.splice(i, 1); f(); }
  }
  // world point on the ray through a screen point, `depth` units in front of the camera
  function rayPoint(c, sx, sy, depth) {
    const dx = (sx - c.cx) / c.F, dy = -(sy - c.cy) / c.F;
    return v3.add(c.C, v3.scale(v3.add(v3.add(c.fwd, v3.scale(c.right, dx)), v3.scale(c.up, dy)), depth));
  }
  // heading away over the park: elevation above the parapet, yaw to the right (+)
  const dirFrom = (el, yaw) => [Math.sin(yaw) * Math.cos(el), Math.sin(el), -Math.cos(yaw) * Math.cos(el)];
  // lean a direction sideways (as the bottle tips: + = to the right on screen)
  const roll = (d, a) => v3.norm([d[0] * Math.cos(a) + d[1] * Math.sin(a), -d[0] * Math.sin(a) + d[1] * Math.cos(a), d[2]]);
  function screenTilt(api, from, dir) { const a = api.project(from), b = api.project(v3.add(from, v3.scale(dir, 2))); return Math.atan2(b.x - a.x, a.y - b.y); }
  const bez = (A, C, B, u) => { const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u; return [A[0] * a + C[0] * b + B[0] * c, A[1] * a + C[1] * b + B[1] * c, A[2] * a + C[2] * b + B[2] * c]; };
  const bez3 = (A, B, C, D, u) => { const a = (1 - u) ** 3, b = 3 * u * (1 - u) ** 2, c = 3 * u * u * (1 - u), d = u ** 3; return [0, 1, 2].map(i => A[i] * a + B[i] * b + C[i] * c + D[i] * d); };
  const easeU = tau => 1 - (1 - tau) * (1 - tau);          // fast off the pad, slowing to the apex
  const tauOf = u => 1 - Math.sqrt(1 - u);
  // rotation that takes local +y to `dir`
  function alignY(dir) {
    const h = Math.atan2(dir[2], dir[0]), e = Math.asin(clamp(dir[1], -1, 1));
    return M3.mul(M3.rotY(-h), M3.rotZ(e - Math.PI / 2));
  }
  // rotation that takes local +x to heading h on the ground
  const alignX = h => M3.rotY(-h);
  function box(w, h, d, rgb, o = {}) {
    const x = w / 2, z = d / 2, y0 = o.y0 || 0, y1 = y0 + h;
    const f = (pts, n, c) => ({ pts, n, rgb: c || rgb });
    return [
      f([[-x, y1, -z], [x, y1, -z], [x, y1, z], [-x, y1, z]], [0, 1, 0], o.top),
      f([[-x, y0, z], [x, y0, z], [x, y1, z], [-x, y1, z]], [0, 0, 1], o.front),
      f([[-x, y0, -z], [x, y0, -z], [x, y1, -z], [-x, y1, -z]], [0, 0, -1]),
      f([[x, y0, -z], [x, y0, z], [x, y1, z], [x, y1, -z]], [1, 0, 0], o.side),
      f([[-x, y0, -z], [-x, y0, z], [-x, y1, z], [-x, y1, -z]], [-1, 0, 0], o.side),
    ];
  }

  // A rising whistle, synthesised (Sfx-style WebAudio on the shared context).
  function whistle(api, { f0 = 1100, f1 = 2900, dur = 1.4, vol = 0.05, pan = 0 } = {}) {
    try {
      if (api.Sfx.muted) return null;
      const ac = api.Sfx.unlock();
      if (!ac || ac.state !== 'running') return null;
      const t = ac.currentTime, o = ac.createOscillator(), o2 = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain();
      const g = ac.createGain(), g2 = ac.createGain(), p = ac.createStereoPanner();
      o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      o2.type = 'triangle'; o2.frequency.setValueAtTime(f0 * 0.5, t); o2.frequency.exponentialRampToValueAtTime(f1 * 0.5, t + dur);
      lfo.frequency.value = 21; lg.gain.value = f0 * 0.015; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.07);
      g.gain.setValueAtTime(vol, t + dur * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      g2.gain.value = 0.25;
      p.pan.value = clamp(pan, -1, 1);
      o.connect(g); o2.connect(g2).connect(g); g.connect(p).connect(ac.destination);
      for (const n of [o, o2, lfo]) { n.start(t); n.stop(t + dur + 0.05); }
      return {
        pan(v) { p.pan.setTargetAtTime(clamp(v, -1, 1), ac.currentTime, 0.05); },
        stop() { const s = ac.currentTime; g.gain.cancelScheduledValues(s); g.gain.setTargetAtTime(0.0001, s, 0.03); for (const n of [o, o2, lfo]) try { n.stop(s + 0.15); } catch {} },
      };
    } catch { return null; }
  }

  // ---------- rocket sprite ----------
  function drawRocket(api, tail, dir, o = {}) {
    const ctx = api.ctx, nose = v3.add(tail, v3.scale(dir, TUBE * L)), end = v3.sub(tail, v3.scale(dir, (1 - TUBE) * L));
    const a = api.project(nose), b = api.project(end), m = api.project(tail);
    const len = Math.hypot(b.x - a.x, b.y - a.y), w = Math.max(1.6, 0.357 * L * api.cam.F / m.d);
    const im = api.img('cutout-rocket');
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (ready(im) && len > 5) {
      ctx.translate(a.x, a.y); ctx.rotate(Math.atan2(-(b.x - a.x), b.y - a.y));
      ctx.drawImage(im, -w / 2, 0, w, Math.max(len, w * 0.6));
    } else {
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#a07c48'; ctx.lineWidth = Math.max(1, w * 0.09); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(m.x, m.y); ctx.stroke();
      ctx.strokeStyle = '#c8322a'; ctx.lineWidth = Math.max(1.6, w * 0.3); ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(a.x, a.y); ctx.stroke();
    }
    ctx.restore();
  }
  function glowAt(api, p, r, rgb = [255, 200, 120], a = 0.8) {
    const ctx = api.ctx, q = api.project(p);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
    g.addColorStop(0, `rgba(${rgb.join(',')},${a})`); g.addColorStop(1, `rgba(${rgb.join(',')},0)`);
    ctx.fillStyle = g; ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2); ctx.restore();
  }
  function drawBottle(api, base, ang, sand) {
    const ctx = api.ctx, b = api.project([base[0], 0, base[2]]), t = api.project([base[0], 1.3, base[2]]);
    const h = Math.max(8, (b.y - t.y) / 0.94), w = h * 1000 / 1500, px = Math.sign(ang || 1) * w * 0.2 * Math.min(1, Math.abs(ang) * 4);
    api.shadow([base[0], 0, base[2]], 0.3, 0);
    const im = api.img('green-bottle');
    ctx.save(); ctx.translate(b.x + px, b.y); ctx.rotate(ang);
    if (ready(im)) { ctx.globalAlpha = 0.9; ctx.drawImage(im, -w / 2 - px, -h * 0.975, w, h); ctx.globalAlpha = 1; }
    else {
      ctx.fillStyle = 'rgba(40,110,60,.85)';
      ctx.beginPath(); ctx.moveTo(-px - w * 0.2, 0); ctx.lineTo(-px - w * 0.2, -h * 0.6); ctx.lineTo(-px - w * 0.07, -h * 0.8); ctx.lineTo(-px - w * 0.07, -h * 0.97);
      ctx.lineTo(-px + w * 0.07, -h * 0.97); ctx.lineTo(-px + w * 0.07, -h * 0.8); ctx.lineTo(-px + w * 0.2, -h * 0.6); ctx.lineTo(-px + w * 0.2, 0); ctx.closePath(); ctx.fill();
    }
    if (sand) {
      ctx.fillStyle = 'rgba(190,152,96,.62)';
      ctx.fillRect(-px - w * 0.185, -h * 0.5, w * 0.37, h * 0.47);
      ctx.fillStyle = 'rgba(120,90,50,.5)';
      for (let i = 0; i < 14; i++) ctx.fillRect(-px + ((i * 37) % 30 - 15) / 15 * w * 0.16, -h * (0.08 + ((i * 53) % 40) / 100), 1.2, 1.2);
    }
    ctx.restore();
  }

  // ---------- spark budget: ~1800 live sparks per trick (450 with reduced motion) ----------
  // The stage keeps its own list; we count what we hand it, in 0.1 s buckets by expiry time.
  const CAP = 1800, CAP_REDUCED = 450, SLOTS = 100;
  function loadOf(s) {
    const Ld = s.load || (s.load = { n: 0, ring: new Float32Array(SLOTS), i: Math.floor((s.clock || 0) * 10) });
    const now = Math.floor((s.clock || 0) * 10);
    while (Ld.i <= now) { const k = Ld.i % SLOTS; Ld.n -= Ld.ring[k]; Ld.ring[k] = 0; Ld.i++; }
    return Ld;
  }
  const room = (api, s) => (api.reduced ? CAP_REDUCED : CAP) - loadOf(s).n;
  function counted(s, life) { const Ld = loadOf(s); Ld.ring[(Math.floor(((s.clock || 0) + Math.min(9.5, life)) * 10) + 1) % SLOTS]++; Ld.n++; }
  // screen-space spark (sky effects) and world spark, both through the budget
  function ss(api, s, x, y, vx, vy, o) { if (room(api, s) <= 0) return false; api.sparkScreen(x, y, vx, vy, o); counted(s, o.life); return true; }
  function ws(api, s, p, v, o) { if (room(api, s) <= 0) return false; api.spark(p, v, o); counted(s, o.life); return true; }
  function wburst(api, s, p, n, speed, o = {}) {
    n = Math.round(n * (api.reduced ? 0.25 : 1));
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), up = o.flat ? rnd(0.02, 0.35) : rnd(-0.2, 1), sp = rnd(speed * 0.25, speed);
      if (!ws(api, s, p, [Math.cos(a) * sp, up * sp * (o.lift ?? 1), Math.sin(a) * sp], { color: o.color, size: o.size ?? rnd(0.7, 1.5), gravity: o.gravity, life: (o.life ?? 0.8) * rnd(0.55, 1.1) })) break;
    }
  }
  // per-trick effect state: timers, flashes, sky washes, glitter glints and willow stars
  function fx(s) {
    s.clock ??= 0; s.later ??= []; s.flashes ??= []; s.washes ??= []; s.glints ??= []; s.stars ??= []; s.bursts ??= [];
    if (s.wind == null) s.wind = rnd(-14, 14);       // the breeze the trails drift on (px/s)
    return s;
  }
  const fxBusy = s => s.stars.length + s.glints.length + s.washes.length + s.flashes.length > 0;
  // how much sky this screen has: the horizon height, and the burst radius that fills ~1/3 of it
  function skyOf(api) {
    const c = api.cam, hz = api.project([c.C[0], c.C[1], c.C[2] - 5000]).y, skyH = clamp(hz, api.H * 0.25, api.H * 0.85);
    return { skyH, R: Math.sqrt(api.W * skyH / (3 * Math.PI)) };
  }

  // ---------- rocket physics ----------
  function newRocket(tail, dir, o = {}) {
    return {
      pos: tail.slice(), dir: dir.slice(), vel: v3.scale(dir, 3), t: 0, burn: o.burn ?? 1.3, thrust: o.thrust ?? 150, wob: o.wob ?? 0.5,
      wv: [0, 0, 0], drag: o.drag ?? 0.45, vane: o.vane ?? 0.02, colour: o.colour || pick(COLOURS), done: false,
      spin: 0, spinRate: o.spinRate || 0, peak: 0, home: null, homeGain: 0, maxT: o.maxT ?? 6, twin: !!o.twin, ph: rnd(0, TAU),
    };
  }
  function stepRocket(r, dt, noisy = true) {
    r.t += dt;
    const burning = r.t < r.burn;
    if (noisy && r.wob) {
      for (let i = 0; i < 3; i++) r.wv[i] += rnd(-1, 1) * r.wob * 40 * dt;
      r.wv = v3.scale(r.wv, Math.exp(-dt * 4));
      r.dir = v3.norm(v3.add(r.dir, v3.scale(r.wv, dt)));
      // the stick waggles: a real paper rocket never flies a clean line
      const sx = -r.dir[2], sz = r.dir[0], sl = Math.hypot(sx, sz);
      if (burning && sl > 0.05) { const w = Math.sin(r.t * 11 + r.ph) * r.wob * 2.2 * dt / sl; r.dir = v3.norm([r.dir[0] + sx * w, r.dir[1], r.dir[2] + sz * w]); }
    }
    const sp = v3.len(r.vel);
    if (r.home) { const want = v3.norm(v3.sub(r.home, r.pos)); r.dir = v3.norm(v3.add(r.dir, v3.scale(v3.sub(want, r.dir), Math.min(1, r.homeGain * dt)))); }
    else if (sp > 1) { const vh = v3.scale(r.vel, 1 / sp); r.dir = v3.norm(v3.add(r.dir, v3.scale(v3.sub(vh, r.dir), Math.min(1, r.vane * sp * dt)))); }
    if (burning) r.vel = v3.add(r.vel, v3.scale(r.dir, r.thrust * Math.min(1, r.t / 0.12) * dt));
    r.vel[1] -= G * dt;
    r.vel = v3.scale(r.vel, Math.exp(-r.drag * dt));
    r.pos = v3.add(r.pos, v3.scale(r.vel, dt));
    r.spin += r.spinRate * dt;
    r.peak = Math.max(r.peak, r.pos[1]);
  }
  // the hot spray right behind the nozzle (world space, so it is the right size near and far)
  function exhaust(api, s, r, dt, at = r.pos) {
    const n = api.reduced ? 1 : 4;
    for (let i = 0; i < n; i++) ws(api, s, at, v3.add(v3.add(v3.scale(r.vel, 0.15), v3.scale(r.dir, -rnd(6, 18))), [rnd(-2.5, 2.5), rnd(-2.5, 2.5), rnd(-2.5, 2.5)]), { life: rnd(0.12, 0.4), size: rnd(0.8, 1.5), gravity: 200 });
    if (Math.random() < dt * 16) api.smoke(at, 1, { size: 0.8 });
  }
  // The thick gold trail: sparks laid along the screen path, curling a little and drifting on the breeze.
  // 'gold' sparks cool from white-gold to orange as they age, so the trail fades the same way behind it.
  function trail(api, s, r, at, o = {}) {
    const key = o.key || 'trq', q = api.project(at), p0 = r[key] || q;
    r[key] = { x: q.x, y: q.y };
    const dx = q.x - p0.x, dy = q.y - p0.y, len = Math.hypot(dx, dy);
    const ux = len > 0.01 ? dx / len : 0, uy = len > 0.01 ? dy / len : -1, nx = -uy, ny = ux;
    const big = clamp(api.cam.F / q.d / 22, 0.45, 1.6) * (o.size ?? 1);
    const young = clamp(1 - r.t / Math.max(0.3, r.burn), 0, 1);
    const n = Math.max(1, Math.round((api.reduced ? 1 : clamp(len / 4, 3, 9)) * (o.n ?? 1)));
    for (let i = 0; i < n; i++) {
      const f = Math.random(), curl = Math.sin(s.clock * 6.5 + f * 2 + r.t * 2.3) * rnd(5, 18) * big;
      if (!ss(api, s, p0.x + dx * f + nx * rnd(-1.4, 1.4) * big, p0.y + dy * f + ny * rnd(-1.4, 1.4) * big,
        nx * curl - ux * rnd(5, 24) + s.wind * rnd(0.6, 1.2), ny * curl - uy * rnd(5, 24) + rnd(-5, 2),
        { color: 'gold', life: rnd(0.75, 1.3) * (0.7 + 0.4 * young) * (o.life ?? 1), size: rnd(1.0, 2.0) * big, gravity: rnd(6, 20) })) break;
    }
  }

  // ---------- the burst ----------
  // Real 90s rocket heads, picked per launch. All drawn in screen space from the real distance,
  // so a burst over the park fills about a third of the sky and far ones (other terraces) are smaller.
  const KINDS = ['willow', 'peony', 'glitter', 'ring'];
  const KIND_NAME = { willow: 'gold willow', peony: 'rang-birangi peony', glitter: 'chit-chit glitter', ring: 'double ring', dud: 'phuss' };
  const pickKind = (dud = false, pool = KINDS) => (dud && Math.random() < 1 / 8 ? 'dud' : pick(pool));
  const PEONY = ['rose', 'green', 'blue', 'gold'];
  const STAR = { gold: '#ffd98a', rose: '#ffb4cb', green: '#c9ffb0', blue: '#b9d4ff', white: '#f3f6ff', red: '#ff8a7a' };
  const DUD_LINES = ['Phuss. Do rupaye ka dhuaan', 'Upar gaya, "phut" bola, bas. Paisa vasool nahi', 'Phus-phus. Bhaiya bole, "Is baar sab seele hain"'];

  function burstSky(api, s, pos, colour = 'gold', k = 1, colour2 = null, o = {}) {
    fx(s);
    const kind = o.kind || pickKind(false), c = api.cam, q = api.project(pos), sky = skyOf(api);
    const R = clamp(16 * k * c.F / q.d, sky.R * k * (o.min ?? 0.3), sky.R * (o.max ?? 1.15));
    const red = api.reduced ? 0.3 : 1, v = R * 1.57, VY = 0.74;      // stage sparks drag sideways harder than down
    s.bursts.push({ kind, x: Math.round(q.x), y: Math.round(q.y), R: Math.round(R), d: Math.round(q.d) });
    if (kind === 'dud') { dud(api, s, pos, q); return kind; }
    const rgb = RGB[colour] || RGB.gold;
    // the break: a white-hot pop at the centre
    for (let i = 0; i < 30 * red; i++) { const a = rnd(0, TAU), sp = rnd(0.1, 0.35) * v; ss(api, s, q.x, q.y, Math.cos(a) * sp, Math.sin(a) * sp * VY, { color: 'white', life: rnd(0.15, 0.35), size: rnd(1.4, 2.4), gravity: 0 }); }
    if (kind === 'peony') {
      // rings of colour inside each other: rose, green, blue, gold (starting from this rocket's colour)
      const start = Math.max(0, PEONY.indexOf(colour)), shells = [[1, 70], [0.78, 52], [0.56, 38], [0.34, 26]];
      shells.forEach(([f, n], j) => {
        const col = j === 0 && colour2 ? colour2 : PEONY[(start + j) % 4];
        for (let i = 0; i < n * red; i++) {
          const u = rnd(-1, 1), ph = rnd(0, TAU), rr = Math.sqrt(1 - u * u), sp = v * f * rnd(0.92, 1);
          ss(api, s, q.x, q.y, Math.cos(ph) * rr * sp, u * sp * VY, { color: col, life: rnd(1.2, 1.75), size: rnd(1.1, 1.9), gravity: 34 });
        }
      });
    } else if (kind === 'willow') {
      // heavy gold stars on long falling trails: they spread, stall and droop toward the houses
      for (let i = 0; i < 56 * red; i++) {
        const u = rnd(-1, 1), ph = rnd(0, TAU), rr = Math.sqrt(1 - u * u), sp = R * 2.15 * rnd(0.85, 1);
        s.stars.push({ x: q.x, y: q.y, vx: Math.cos(ph) * rr * sp, vy: u * sp, t: 0, life: rnd(2.6, 3.4), col: colour2 && i % 4 === 0 ? colour2 : 'gold', drip: 16, dl: rnd(0.9, 1.4), g: 44, drag: 2.2, size: rnd(1.1, 1.6), acc: rnd(0, 1) });
      }
    } else if (kind === 'glitter') {
      for (let i = 0; i < 110 * red; i++) {
        const u = rnd(-1, 1), ph = rnd(0, TAU), rr = Math.sqrt(1 - u * u), sp = v * 0.85 * rnd(0.6, 1);
        ss(api, s, q.x, q.y, Math.cos(ph) * rr * sp, u * sp * VY, { color: i % 3 ? 'gold' : 'white', life: rnd(0.8, 1.2), size: rnd(0.9, 1.5), gravity: 30 });
      }
      crackle(api, s, pos, q, R);
    } else {
      // two crossed rings and a little gold pistil
      const t1 = rnd(-0.5, 0.5), rings = [[t1, rnd(0.3, 0.45), colour], [t1 + rnd(1.2, 1.9), rnd(0.35, 0.6), colour2 || pick(PEONY.filter(x => x !== colour))]];
      for (const [tilt, asp, col] of rings) {
        const n = Math.round(60 * red), ct = Math.cos(tilt), st = Math.sin(tilt);
        for (let i = 0; i < n; i++) {
          const th = i / n * TAU + rnd(-0.03, 0.03), lx = Math.cos(th), ly = Math.sin(th) * asp, sp = v * rnd(0.96, 1);
          ss(api, s, q.x, q.y, (lx * ct - ly * st) * sp, (lx * st + ly * ct) * sp * VY, { color: col, life: rnd(1.35, 1.8), size: rnd(1.4, 2), gravity: 22 });
        }
      }
      for (let i = 0; i < 26 * red; i++) { const a = rnd(0, TAU), sp = v * rnd(0.1, 0.28); ss(api, s, q.x, q.y, Math.cos(a) * sp, Math.sin(a) * sp * VY, { color: 'gold', life: rnd(0.8, 1.2), size: rnd(0.8, 1.2), gravity: 30 }); }
    }
    // slow glitter drifting down out of the shell
    if (kind !== 'willow') for (let w = 0; w < (api.reduced ? 2 : 7); w++) later(s, 0.5 + w * 0.22, () => {
      for (let i = 0; i < 11 * Math.sqrt(k); i++) { const a = rnd(0, TAU), rr = R * 0.8 * Math.sqrt(rnd(0.1, 1)); ss(api, s, q.x + Math.cos(a) * rr, q.y + Math.sin(a) * rr * 0.85 + w * 6, rnd(-5, 5) + s.wind * 0.4, rnd(2, 12), { color: Math.random() < 0.5 ? 'white' : 'gold', life: rnd(1.5, 2.9), size: rnd(0.45, 0.85), gravity: 12 }); }
    });
    // light: the flash, the houses glowing in its colour, the warm light on the park below
    const near = q.d < 60;
    s.flashes.push({ x: q.x, y: q.y, r: R * 0.6, t0: s.clock, rgb });
    s.washes.push({ x: q.x, y: q.y, rgb: kind === 'willow' || kind === 'glitter' ? RGB.gold : rgb, t0: s.clock, a: clamp(0.1 + 0.08 * k, 0.1, 0.3) * (near ? 1.4 : 1) });
    api.light(pos, clamp(0.75 * k, 0.4, 1.4), rgb);
    api.smoke(pos, 3, { size: 2.5 });
    farBang(api, s, pos, (kind === 'willow' ? 0.9 : kind === 'glitter' ? 0.7 : 0.8) * k);
    return kind;
  }
  // glitter: a delayed second wave of tiny white flashes, each heard as a "chit" (late, like the bang)
  function crackle(api, s, pos, q, R) {
    const dm = v3.len(v3.sub(pos, api.cam.C)) * UNIT_M, late = dm / 343, pan = api.panOf(pos), vol = clamp(5 / dm, 0.04, 0.22);
    const end = 0.5 + (api.reduced ? 0.6 : 1.4);
    let t = 0.5;
    while (t < end) {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < n; j++, t += rnd(0.035, 0.07)) {
        const at = t;
        later(s, at, () => {
          for (let g = 0; g < (api.reduced ? 1 : 4); g++) {
            const a = rnd(0, TAU), rr = R * 0.95 * Math.sqrt(Math.random()), x = q.x + Math.cos(a) * rr, y = q.y + Math.sin(a) * rr * 0.85 + at * 16;
            s.glints.push({ x, y, t0: s.clock, r: rnd(2.2, 4.5) });
            ss(api, s, x, y, rnd(-30, 30), rnd(-30, 30), { color: 'white', life: rnd(0.08, 0.16), size: rnd(1.3, 2), gravity: 0 });
          }
        });
        later(s, at + late, () => api.Sfx.boom({ size: 0.05, vol: vol * rnd(0.6, 1), muffle: clamp(dm / 220, 0, 0.3), pan: clamp(pan + rnd(-0.2, 0.2), -1, 1) }));
      }
      t += rnd(0.08, 0.2);
    }
  }
  // the dud: up it goes, and then... phut
  function dud(api, s, pos, q) {
    for (let i = 0; i < (api.reduced ? 4 : 14); i++) ss(api, s, q.x, q.y, rnd(-35, 35), rnd(-30, 20), { color: 'gold', life: rnd(0.3, 0.75), size: rnd(0.7, 1.1), gravity: 90 });
    s.flashes.push({ x: q.x, y: q.y, r: 14, t0: s.clock, rgb: RGB.gold });
    api.smoke(pos, 4, { size: 1.8 }); api.light(pos, 0.12);
    const dm = v3.len(v3.sub(pos, api.cam.C)) * UNIT_M;
    later(s, 0.05 + dm / 343, () => api.Sfx.boom({ vol: clamp(5 / dm, 0.05, 0.2), size: 0.15, muffle: 0.75, pan: api.panOf(pos) }));
  }
  // the bang arrives late: sound travels ~343 m/s
  function farBang(api, s, pos, size = 0.8) {
    const dm = v3.len(v3.sub(pos, api.cam.C)) * UNIT_M;
    later(s, 0.06 + dm / 343, () => {
      api.Sfx.boom({ vol: clamp(16 / dm, 0.12, 0.8), size, muffle: clamp(dm / 160, 0.04, 0.45), pan: api.panOf(pos) });
      if (dm < 30) api.shake(Math.max(1, 30 / dm));
    });
  }
  // willow stars: we fly them ourselves and let each one drip sparks, which makes the long falling trails
  function stepFx(api, s, dt) {
    for (let i = s.stars.length - 1; i >= 0; i--) {
      const st = s.stars[i];
      st.t += dt;
      if (st.t >= st.life) { s.stars[i] = s.stars[s.stars.length - 1]; s.stars.pop(); continue; }
      const k = Math.exp(-st.drag * dt);
      st.vx = st.vx * k + s.wind * 0.25 * dt; st.vy = st.vy * k + st.g * dt;
      st.x += st.vx * dt; st.y += st.vy * dt;
      st.acc += st.drip * dt;
      while (st.acc >= 1) {
        st.acc -= 1;
        ss(api, s, st.x + rnd(-0.8, 0.8), st.y + rnd(-0.8, 0.8), st.vx * 0.06 + rnd(-3, 3), st.vy * 0.06 + rnd(0, 5), { color: st.col, life: st.dl * rnd(0.6, 1) * (1 - 0.4 * st.t / st.life), size: st.size * rnd(0.55, 0.85), gravity: 26 });
      }
    }
  }
  // the whole scene brightens in the burst's colour for a moment (houses, parapet, park)
  function drawWash(api, s) {
    const ctx = api.ctx;
    for (let i = s.washes.length - 1; i >= 0; i--) {
      const w = s.washes[i], t = s.clock - w.t0;
      if (t > 0.8) { s.washes.splice(i, 1); continue; }
      const a = w.a * Math.pow(1 - t / 0.8, 2), r = Math.max(api.W, api.H) * 1.25, c = w.rgb.join(',');
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, r);
      g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(0.35, `rgba(${c},${a * 0.5})`); g.addColorStop(1, `rgba(${c},${a * 0.2})`);
      ctx.fillStyle = g; ctx.fillRect(-20, -20, api.W + 40, api.H + 40); ctx.restore();
    }
  }
  function drawFx(api, s) {
    const ctx = api.ctx;
    for (let i = s.flashes.length - 1; i >= 0; i--) {
      const f = s.flashes[i], t = s.clock - f.t0;
      if (t > 0.35) { s.flashes.splice(i, 1); continue; }
      const a = 0.6 * (1 - t / 0.35), r = f.r * (0.6 + t * 1.5);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, `rgba(255,250,235,${a})`); g.addColorStop(0.3, `rgba(${f.rgb.join(',')},${a * 0.5})`); g.addColorStop(1, `rgba(${f.rgb.join(',')},0)`);
      ctx.fillStyle = g; ctx.fillRect(f.x - r, f.y - r, r * 2, r * 2); ctx.restore();
    }
    if (!s.stars.length && !s.glints.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < s.stars.length; i++) {
      const st = s.stars[i], f = 1 - st.t / st.life, a = Math.min(1, f / 0.2) * (0.75 + 0.25 * Math.random());
      ctx.globalAlpha = a;
      ctx.fillStyle = st.col === 'gold' ? (f > 0.75 ? '#fff0cc' : f > 0.45 ? '#ffd98a' : '#ffa337') : STAR[st.col] || '#fff';
      ctx.beginPath(); ctx.arc(st.x, st.y, st.size * (0.7 + 0.6 * f), 0, TAU); ctx.fill();
      if (i % 2 === 0) api.glow(st.x, st.y, st.size * 7, '#7a3a0c', 0.3 * a);
    }
    for (let i = s.glints.length - 1; i >= 0; i--) {
      const g = s.glints[i], t = s.clock - g.t0;
      if (t > 0.1) { s.glints.splice(i, 1); continue; }
      const k = 1 - t / 0.1;
      ctx.globalAlpha = k; ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r * (0.4 + 0.6 * k), 0, TAU); ctx.fill();
      api.glow(g.x, g.y, g.r * 4, '#8a8aa0', 0.5 * k);
    }
    ctx.restore();
  }
  function label(api, text, x, y, o = {}) {
    const ctx = api.ctx;
    ctx.save(); ctx.font = o.font || '600 13px system-ui, sans-serif'; ctx.textAlign = o.align || 'center';
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = o.color || 'rgba(255,240,210,.92)'; ctx.fillText(text, x, y); ctx.restore();
  }
  // lift-off: the sharp whoosh, a bright tail flare and a nudge of the camera
  function liftOff(api, s, at, dir, o = {}) {
    const pan = api.panOf(at);
    api.Sfx.whoosh({ vol: o.vol ?? 0.34, pan, dur: 0.32 });
    api.Sfx.crack({ vol: 0.22, pieces: 2, pan });
    api.light(at, 1.0, [255, 215, 150]);
    api.shake(o.shake ?? 1.3);
    s.flare = { at: at.slice(), t0: s.clock };
    for (let i = 0; i < (api.reduced ? 4 : 26); i++) ws(api, s, at, v3.add(v3.scale(dir, -rnd(4, 12)), [rnd(-6, 6), rnd(-1, 4), rnd(-6, 6)]), { life: rnd(0.3, 0.8), size: rnd(0.8, 1.6), gravity: 220 });
    api.smoke(at, 4, { size: 1.1 });
  }
  function drawFlare(api, s) {
    if (!s.flare) return;
    const t = s.clock - s.flare.t0;
    if (t > 0.35) { s.flare = null; return; }
    const f = 1 - t / 0.35, q = api.project(s.flare.at), k = clamp(api.cam.F / q.d / 25, 0.6, 1.6);
    glowAt(api, s.flare.at, (18 + 55 * f) * k, [255, 225, 160], 0.9 * f);
    api.glow(q.x, q.y, 60 * k * f, '#ffb040', 0.6 * f);
  }

  // ======================================================================================
  // sky-rocket: one engine, many launchpads
  // ======================================================================================
  // whistle: true / false / undefined (= a coin toss, like the packet you got that year)
  // dud: may go "phut" (1 in 8) · k / kmin: burst size · pool: burst kinds to pick from
  const LAUNCH = {
    bottle:    { pad: 'bottle', alpha: 0.12, elev: 1.12, burn: 1.15, thrust: 96, wob: 0.55, kick: 1.6, dud: true,
      line: 'Sharbat ki khaali bottle: best launchpad ever made' },
    sand:      { pad: 'sand', alpha: 0.08, elev: 1.12, burn: 1.15, thrust: 96, wob: 0.6, kick: 4.6, dud: true,
      line: 'Ret bhari thi. Phir bhi gir gayi' },
    pipe:      { pad: 'pipe', burn: 1.7, thrust: 235, wob: 0.6, elev: 0.5, vane: 0.05, drag: 0.3, whistle: false, chaos: true,
      k: 1.5, kmin: 0.8, pool: ['willow', 'peony', 'glitter'],
      line: 'Bhaiya ka bazooka. Kisi aur ko haath nahi lagaane diya' },
    brick:     { pad: 'brick', alpha: 0.24, elev: 1.05, burn: 1.2, thrust: 98, wob: 1.2, sputter: 0.75, dud: true,
      line: 'Eent pe kaala nishaan aaj bhi hai' },
    parapet:   { pad: 'ledge', burn: 2, thrust: 110, wob: 0.3, homing: true, maxT: 4, whistle: false, k: 0.6,
      line: '"Kiski balcony thi?" Sab chup' },
    boomerang: { pad: 'bottle', alpha: 0.12, elev: 1.0, burn: 2.4, thrust: 100, wob: 0.35, kick: 1.2, boomerang: true, maxT: 4, whistle: true,
      line: 'U-turn le ke seedha humari taraf. Chacha ki chappal chhat pe hi reh gayi' },
    parachute: { pad: 'bottle', alpha: 0.06, elev: 1.12, burn: 1.15, thrust: 98, wob: 0.45, kick: 1.2, chute: true, whistle: true, k: 0.9,
      line: 'Parachute mila Verma ke bachchon ko. Phir se' },
    double:    { pad: 'bottle', alpha: 0.08, elev: 0.95, burn: 1.6, thrust: 115, wob: 1.6, kick: 2, twin: true, spinRate: 16, whistle: true,
      line: '"Double power." Bas ghoomta raha' },
    count:     { pad: 'bottle', alpha: 0.05, elev: 1.0, burn: 1.5, thrust: 92, wob: 0.45, kick: 1.2, count: true, dud: true,
      line: 'Ek… do… teen… mera wala sabse upar gaya' },
  };
  const COUNT = ['ek', 'do', 'teen', 'char', 'paanch', 'chhe', 'saat', 'aath'];

  function skyCreate(api, cfg) {
    const s = fx({
      cfg, clock: 0, later: [], flashes: [], rockets: [], launched: false, liftT: null, popT: null, ended: null,
      yaw: cfg.alpha ? rnd(-cfg.alpha, cfg.alpha) : 0, lean: 0, elev: cfg.elev || 0.87, bottle: { ang: 0, w: 0, fell: false, landed: false },
      statText: '', minBack: Infinity, turned: false, chute: null, sputter: cfg.sputter || SPUTTER, mesh: null,
      whistles: cfg.whistle ?? Math.random() < 0.5, kind: null, dudLine: null,
    });
    // burst when it reaches the middle of the sky we can see, so the whole shell fits on screen
    s.popY = skyOf(api).skyH * rnd(0.4, 0.56);
    if (cfg.pad === 'brick') { s.lean = (Math.random() < 0.5 ? -1 : 1) * rnd(0.16, cfg.alpha); s.base = [0.25, 0.05, 0]; }
    else if (cfg.pad === 'pipe') { s.base = [-0.25, 0.32, 0.7]; s.yaw = rnd(0.12, 0.3) * (Math.random() < 0.5 ? -1 : 1); }
    else if (cfg.pad === 'ledge') s.base = [-0.7, 0.06, 0.5];
    else s.base = [0, 0.1, 0];
    if (cfg.homing) {
      // someone's balcony across the empty plot (screen right)
      s.target = rayPoint(api.cam, api.W * 0.86, api.H * 0.43, 150);
    }
    // meshes for the solid pads
    if (cfg.pad === 'brick') {
      const faces = box(1.15, 0.55, 0.5, [168, 74, 52], { top: [184, 88, 62], side: [150, 64, 46] });
      for (const hx of [-0.27, 0.25]) faces.push({ pts: [[hx - 0.13, 0.553, -0.12], [hx + 0.13, 0.553, -0.12], [hx + 0.13, 0.553, 0.12], [hx - 0.13, 0.553, 0.12]], n: [0, 1, 0], rgb: [34, 20, 16] });
      s.mesh = faces;
    } else if (cfg.pad === 'pipe') {
      s.pipe = Mesh.cylinder(0.2, 4, { segs: 12, bands: 2, rgb: [206, 204, 196], inner: [60, 58, 56], top: false, bottom: false });
      s.brace = box(0.9, 0.7, 0.45, [160, 72, 50], { top: [176, 86, 60] });
    } else if (cfg.pad === 'ledge') {
      s.mesh = box(0.5, 0.28, 0.4, [150, 140, 128], { top: [170, 160, 146] });
    }
    pose(s, api);
    return s;
  }
  // where the rocket sits before it goes
  function pose(s, api) {
    const cfg = s.cfg;
    if (cfg.pad === 'pipe') {
      const e = cfg.elev, h = -Math.PI / 2 + s.yaw;
      s.padDir = v3.norm([Math.cos(e) * Math.cos(h), Math.sin(e), Math.cos(e) * Math.sin(h)]);
      s.tail0 = v3.add(s.base, v3.scale(s.padDir, 2.15));
    } else if (cfg.pad === 'ledge') {
      const aimAt = v3.add(s.target, [0, 22, 0]);
      const d = v3.norm(v3.sub(aimAt, s.base));
      s.padDir = v3.norm([d[0], clamp(d[1], 0.3, 0.45), d[2]]);
      s.tail0 = v3.add(s.base, v3.scale(s.padDir, (1 - TUBE) * L));
    } else {
      const d = roll(dirFrom(s.elev, s.yaw), s.lean);
      s.tilt = screenTilt(api, s.base, d);
      s.padDir = roll(d, s.bottle.ang);
      s.tail0 = v3.add(s.base, v3.scale(s.padDir, (1 - TUBE) * L));
    }
  }
  function wickOf(s) { return s.cfg.pad === 'pipe' ? v3.add(s.base, [0, 0.12, 0.05]) : v3.add(s.tail0, [0.14, -0.22, 0]); }

  function stepBottle(s, api, dt) {
    const b = s.bottle;
    if (b.landed) return;
    const crit = 0.37;
    if (!b.fell && Math.abs(b.ang) < crit) b.w += (-34 * b.ang - 5 * b.w) * dt;
    else { b.fell = true; b.w += Math.sign(b.ang) * 26 * Math.sin(Math.abs(b.ang)) * dt; }
    b.ang += b.w * dt;
    if (Math.abs(b.ang) >= Math.PI / 2) {
      b.ang = Math.sign(b.ang) * Math.PI / 2;
      if (Math.abs(b.w) > 2) { b.w *= -0.25; api.Sfx.strike('coin', { vol: 0.35, detune: 0.42, pan: api.panOf(s.base) }); }
      else { b.w = 0; b.landed = true; }
    }
  }

  function launch(s, api) {
    const cfg = s.cfg;
    s.launched = true; s.liftT = s.clock;
    s.fizz?.stop(); s.fizz = null;
    pose(s, api);
    const r = newRocket(s.tail0, s.padDir, { burn: cfg.burn, thrust: cfg.thrust, wob: cfg.wob, maxT: cfg.maxT, twin: cfg.twin, spinRate: cfg.spinRate, drag: cfg.drag });
    if (cfg.pad === 'pipe') r.vel = v3.scale(s.padDir, 36);       // spat out of the barrel
    if (cfg.vane) r.vane = cfg.vane;
    if (cfg.pad === 'sand') {
      // the kick of lift-off: the heavy bottle rocks... and goes over anyway
      const side = Math.random() < 0.5 ? -1 : 1;
      s.bottle.w = side * cfg.kick * rnd(0.75, 1.1);
      r.dir = roll(r.dir, -side * 0.12);
    }
    s.rockets.push(r);
    const pan = api.panOf(r.pos);
    if (cfg.pad === 'pipe') {
      // the deep THUNK of the tube, a muzzle flash, smoke out of both ends
      const muzzle = v3.add(s.base, v3.scale(s.padDir, 4));
      liftOff(api, s, muzzle, s.padDir, { shake: 4.5, vol: 0.4 });
      api.Sfx.boom({ vol: 0.55, size: 1.3, muffle: 0.88, pan });
      api.Sfx.strike('postbox', { vol: 0.3, detune: 0.55, pan });
      api.smoke(muzzle, 9, { size: 1.6 }); api.smoke(s.base, 6, { size: 1.3 });
      wburst(api, s, muzzle, 70, 10, { life: 0.5 });
    } else liftOff(api, s, s.tail0, s.padDir);
    s.hiss = api.Sfx.skid({ pan });
    if (s.whistles) s.whis = whistle(api, { f0: cfg.count ? 900 : rnd(1000, 1300), f1: rnd(2600, 3300), dur: Math.min(cfg.burn, cfg.boomerang ? 2.2 : 1.35), vol: cfg.chute ? 0.07 : 0.05, pan });
    if (cfg.pad === 'brick') wburst(api, s, s.base, 40, 6, { flat: true, life: 0.5 });
    // a black mark stays where it went up from
    const at = cfg.pad === 'pipe' ? s.base.slice() : [s.base[0], 0, s.base[2]];
    api.remain((ctx, a) => {
      const c = a.project([at[0], 0.002, at[2]]), rr = a.cam.scale * 0.35 * c.f;
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, 0.45);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr); g.addColorStop(0, 'rgba(16,11,8,.45)'); g.addColorStop(1, 'rgba(16,11,8,0)');
      ctx.fillStyle = g; ctx.fillRect(-rr, -rr, rr * 2, rr * 2); ctx.restore();
    });
  }

  function pop(s, api, r) {
    r.done = true; s.popT = s.clock;
    s.hiss?.stop(); s.hiss = null; s.whis?.stop(); s.whis = null;
    const cfg = s.cfg;
    if (cfg.twin) {
      // one engine each: a rose peony, then a green double ring a beat later
      s.kind = 'twin';
      burstSky(api, s, r.pos, 'rose', 0.8, null, { kind: 'peony' });
      const p2 = v3.add(r.pos, [rnd(-8, 8), rnd(-3, 3), 0]);
      later(s, 0.22, () => burstSky(api, s, p2, 'green', 0.8, 'blue', { kind: 'ring' }));
    } else if (cfg.boomerang) {
      // right over the terrace: a huge close burst, sparks raining on the floor, everyone ducking
      s.kind = burstSky(api, s, r.pos, r.colour, 1.2, null, { kind: pick(['peony', 'glitter', 'ring']), min: 1.1, max: 1.75 });
      wburst(api, s, r.pos, 90, 14, { life: 1.2 });
      api.paper(r.pos, 18, 5);
      api.light(r.pos, 1.4, RGB[r.colour] || RGB.gold);
      api.shake(9);
      later(s, 0.15, () => api.Sfx.boom({ vol: 0.75, size: 0.9, pan: api.panOf(r.pos) }));
    } else {
      s.kind = burstSky(api, s, r.pos, r.colour, cfg.k ?? 1, cfg.count ? 'white' : null, { kind: cfg.pool ? pick(cfg.pool) : pickKind(!!cfg.dud), min: cfg.kmin ?? 0.8, max: cfg.pad === 'pipe' ? 1.4 : 1.15 });
    }
    if (s.kind === 'dud') { s.dudLine = pick(cfg.dudLines || DUD_LINES); later(s, 0.45, () => api.say('Phuss…')); }
    if (cfg.chute) {
      s.chute = { pos: r.pos.slice(), vel: [r.vel[0] * 0.3, Math.max(0, r.vel[1]) * 0.3, r.vel[2] * 0.3], t: 0, sw: rnd(0, TAU), wind: rnd(2, 4) * (Math.random() < 0.5 ? -1 : 1) };
      later(s, 0.9, () => api.say('Parachute! Daudo!'));
    } else s.ended = s.clock;
  }

  function skyUpdate(s, api, dt, e) {
    const cfg = s.cfg;
    if (!s.launched) {
      // ignition sputter: it fizzes, spits and coughs in the bottle before it goes
      if (!s.sputtering) {
        s.sputtering = true; api.Sfx.crack({ vol: 0.25, pieces: 4, pan: api.panOf(s.tail0) });
        s.fizz = api.Sfx.skid({ pan: api.panOf(s.tail0) });
        if (cfg.kick && cfg.pad !== 'sand') s.bottle.w = (Math.random() < 0.5 ? -1 : 1) * cfg.kick * rnd(0.85, 1.1);
      }
      if (cfg.kick) stepBottle(s, api, dt);
      pose(s, api);
      const k = clamp(e / s.sputter, 0, 1), n = api.reduced ? 1 : Math.round(rnd(2, 8) * (0.4 + k));
      s.fizz?.set(0.08 + 0.32 * k, 0.75 + 0.25 * k, api.panOf(s.tail0));
      for (let i = 0; i < n; i++) ws(api, s, s.tail0, v3.add(v3.scale(s.padDir, -rnd(3, 10)), [rnd(-3, 3), rnd(-1, 2), rnd(-3, 3)]), { life: rnd(0.1, 0.45), size: rnd(0.6, 1.4), gravity: 240 });
      // now and then a bigger spit out sideways
      if (!api.reduced && Math.random() < dt * 6) { const d = [rnd(-1, 1), rnd(0, 0.6), rnd(-1, 1)]; for (let i = 0; i < 6; i++) ws(api, s, s.tail0, v3.add(v3.scale(d, rnd(4, 9)), [rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)]), { life: rnd(0.2, 0.5), size: rnd(0.8, 1.3), gravity: 220 }); }
      if (Math.random() < dt * (8 + 20 * k)) api.Sfx.crack({ vol: 0.06 + 0.06 * k, pieces: 1, pan: api.panOf(s.tail0) });
      if (Math.random() < dt * 6) api.smoke(s.tail0, 1, { size: 0.6 });
      if (cfg.pad === 'brick' && Math.random() < dt * 20) wburst(api, s, s.base, 4, 5, { flat: true, life: 0.35 });
      api.light(s.tail0, 0.25 + k * 0.35 + rnd(0, 0.12));
      if (e >= s.sputter) launch(s, api);
      return false;
    }
    if (cfg.kick) stepBottle(s, api, dt);
    for (const r of s.rockets) {
      if (r.done) continue;
      // behaviours
      if (cfg.twin) {
        // two engines that never agree: the pair cones and corkscrews
        const side = v3.norm(v3.cross(r.dir, [0, 0, 1])), up2 = v3.cross(side, r.dir);
        const push = v3.add(v3.scale(side, Math.cos(r.spin)), v3.scale(up2, Math.sin(r.spin)));
        if (r.t < r.burn) r.dir = v3.norm(v3.add(r.dir, v3.scale(push, 2.2 * dt)));
      }
      if (cfg.chaos && r.t < r.burn && Math.random() < dt * 1.8) {
        // the bazooka round coughs and jinks mid-flight
        r.wv = v3.add(r.wv, [rnd(-3, 3), rnd(-0.5, 1.5), rnd(-3, 3)]);
        api.Sfx.crack({ vol: 0.16, pieces: 2, pan: api.panOf(r.pos) });
        wburst(api, s, r.pos, 10, 7, { life: 0.4 });
      }
      if (cfg.boomerang) {
        // up and away... a lazy loop out to one side... and then straight back at the family, low
        if (!r.kin) {
          const sd = Math.random() < 0.5 ? -1 : 1;
          r.kin = { A: r.pos.slice(), P1: [sd * 2, 28, -32], P2: [sd * 13, 20, 6], B: [-sd * rnd(1, 2.5), 7, 17], T: rnd(2.0, 2.3), ph: rnd(0, TAU) };
        }
        const k = r.kin; r.t += dt;
        const tau = Math.min(1, r.t / k.T), u = tau + 0.12 * Math.sin(TAU * tau), prev = r.pos;   // quick off the pad, hangs at the loop, quick at us
        const w = Math.sin(r.t * 12 + k.ph) * 0.5;
        r.pos = v3.add(bez3(k.A, k.P1, k.P2, k.B, u), [w, w * 0.4, 0]);
        r.vel = v3.scale(v3.sub(r.pos, prev), 1 / Math.max(dt, 1e-3));
        if (v3.len(r.vel) > 0.1) r.dir = v3.norm(r.vel);
        r.peak = Math.max(r.peak, r.pos[1]);
        r.burn = k.T;
      } else if (cfg.homing) {
        // over the empty plot on a lazy arc, wobbling, straight into someone's balcony
        if (!r.kin) { const A = r.pos.slice(), B = s.target; r.kin = { A, B, C: [A[0] * 0.6 + B[0] * 0.4, Math.max(A[1], B[1]) + 26, A[2] * 0.5 + B[2] * 0.5], T: rnd(1.8, 2.2), ph: rnd(0, TAU) }; }
        const k = r.kin; r.t += dt;
        const tau = Math.min(1, r.t / k.T), u = tau * (0.55 + 0.45 * tau), prev = r.pos;
        const w = Math.sin(r.t * 11 + k.ph) * 0.9 * (1 - tau);
        r.pos = v3.add(bez(k.A, k.C, k.B, u), [w, w * 0.5, 0]);
        r.vel = v3.scale(v3.sub(r.pos, prev), 1 / Math.max(dt, 1e-3));
        if (v3.len(r.vel) > 0.1) r.dir = v3.norm(r.vel);
        r.peak = Math.max(r.peak, r.pos[1]);
        r.burn = k.T;
      } else for (let i = 0; i < 2; i++) stepRocket(r, dt / 2);
      // keep the twin from landing back on us
      if (r.pos[1] < 0.3 && r.pos[2] > -6) { r.pos[1] = 0.3; r.vel[1] = Math.abs(r.vel[1]) * 0.3; r.vel = v3.scale(r.vel, 0.6); api.Sfx.crack({ vol: 0.2, pieces: 2 }); }
      if (r.pos[2] > 20) { r.vel[2] = Math.min(r.vel[2], 0); }
      const burning = r.t < r.burn;
      if (burning) {
        if (cfg.twin) {
          const side = v3.norm(v3.cross(r.dir, [0, 0, 1])), off = v3.scale(side, 0.13 * Math.cos(r.spin));
          exhaust(api, s, r, dt, v3.add(r.pos, off)); exhaust(api, s, r, dt, v3.sub(r.pos, off));
          trail(api, s, r, v3.add(r.pos, off), { n: 0.7 }); trail(api, s, r, v3.sub(r.pos, off), { n: 0.7, key: 'trq2' });
        } else { exhaust(api, s, r, dt); trail(api, s, r, r.pos, { size: cfg.pad === 'pipe' ? 1.25 : 1 }); }
        if (r.t < 0.5) api.light(r.pos, 0.6 * (1 - r.t * 1.6));
        const d = v3.len(v3.sub(r.pos, api.cam.C));
        s.hiss?.set(clamp((s.whistles ? 40 : 55) / d, 0.08, 0.75), clamp(0.3 + r.t / r.burn * 0.6, 0, 1), api.panOf(r.pos));
        s.whis?.pan(api.panOf(r.pos));
      } else {
        if (s.hiss) { s.hiss.stop(); s.hiss = null; }
        // the last embers falling off the empty tube
        if (r.t < r.burn + 0.3 && Math.random() < 0.5) ws(api, s, r.pos, [rnd(-1, 1), -rnd(0, 2), rnd(-1, 1)], { life: rnd(0.3, 0.7), size: 0.7, gravity: 120 });
      }
      // turning back toward the family
      if (cfg.boomerang && r.dir[2] > 0.25 && !s.turned) { s.turned = true; api.say('Bhaago! Wapas aa raha hai!'); }
      if (s.turned) s.minBack = Math.min(s.minBack, v3.len(r.pos) * UNIT_M);
      // when does it go off?
      const q = api.project(r.pos);
      let go = r.t > r.maxT;
      if (!cfg.boomerang && !cfg.homing) {
        if (r.t > r.burn && r.vel[1] < 0) go = true;                                       // apex
        if (r.t > r.burn * 0.5 && q.y < s.popY) go = true;                                 // middle of our sky
        if ((r.t > r.burn || r.vel[1] < 0) && r.t > 0.3 && q.y > skyOf(api).skyH * 0.95) go = true;   // sinking behind the houses
      }
      if (r.t > 0.3 && q.y < api.H * 0.02) go = true;                                       // never off the top
      const edge = cfg.boomerang ? -0.08 : 0.04;
      if (r.t > 0.5 && (q.x < api.W * edge || q.x > api.W * (1 - edge)) && !cfg.homing) go = true;
      if (cfg.boomerang && r.t >= r.kin.T) go = true;
      if (cfg.homing) {
        if (r.t >= r.kin.T) { go = true; s.balcony = true; }
      }
      if (go) {
        if (cfg.homing) {
          s.landDist = Math.hypot(r.pos[0] - s.base[0], r.pos[2] - s.base[2]) * UNIT_M;
          pop(s, api, r);
          if (s.balcony) later(s, 0.5, () => api.say('Kisi ki balcony mein!'));
        } else pop(s, api, r);
        if (cfg.pad === 'pipe') s.range = Math.hypot(r.pos[0] - s.base[0], r.pos[2] - s.base[2]) * UNIT_M;
      }
    }
    // the little parachute
    const ch = s.chute;
    if (ch && s.ended == null) {
      ch.t += dt;
      const open = Math.min(1, ch.t / 0.9);
      ch.vel[1] += (-6.2 - ch.vel[1]) * Math.min(1, dt * (0.6 + open * 3));
      if (open < 1) ch.vel[1] -= G * dt * (1 - open);
      ch.vel[0] += (ch.wind + Math.sin(ch.t * 0.9) * 2 - ch.vel[0]) * Math.min(1, dt * 0.8);
      ch.vel[2] *= Math.exp(-dt * 0.8);
      ch.pos = v3.add(ch.pos, v3.scale(ch.vel, dt));
      if (ch.pos[1] < -6 || ch.t > 14) { s.ended = s.clock; s.floatT = ch.t; }
    }
    if (s.popT != null && !s.statText) s.statText = statFor(s);
    if (s.ended != null && s.chute) s.statText = statFor(s);
    return s.ended != null && s.clock > s.ended + 2.6 && !s.later.length && !fxBusy(s);
  }

  function statFor(s) {
    const cfg = s.cfg, r = s.rockets[0], peak = r ? r.peak * UNIT_M : 0, secs = s.popT != null && s.liftT != null ? s.popT - s.liftT : 0;
    const head = s.kind === 'dud' ? ' · then just "phut"' : s.kind && KIND_NAME[s.kind] ? ` · ${KIND_NAME[s.kind]}` : '';
    if (cfg.count) return `Popped at ${secs.toFixed(1)} s · "${COUNT.slice(0, Math.max(1, Math.ceil(secs))).join('-')}"${s.kind === 'dud' ? ' · phut' : ''}`;
    if (cfg.boomerang) return isFinite(s.minBack) ? `Came back to ${s.minBack.toFixed(1)} m from us${head}` : `Peak ${peak.toFixed(0)} m${head}`;
    if (cfg.chute) return s.floatT != null ? `Parachute floated ${s.floatT.toFixed(1)} s` : `Peak ${peak.toFixed(0)} m${head}`;
    if (cfg.pad === 'sand') return `Peak ${peak.toFixed(0)} m · ${s.bottle.fell ? 'bottle toppled anyway' : 'bottle stayed up (for once)'}${s.kind === 'dud' ? ' · phut' : ''}`;
    if (cfg.pad === 'pipe') return `Range ${(s.range || 0).toFixed(0)} m, flat and fast${head}`;
    if (cfg.pad === 'brick') return `Scraped out of the brick · peak ${peak.toFixed(0)} m${head}`;
    if (cfg.homing) return s.balcony ? `Landed ${s.landDist.toFixed(0)} m away, in a balcony` : `Came down ${(s.landDist || 0).toFixed(0)} m away`;
    if (cfg.twin) return `Spun ${Math.round(r.spin / TAU)} times · peak ${peak.toFixed(1)} m · two bursts`;
    return `Peak ${peak.toFixed(0)} m above our chhat${head}`;
  }

  function skyDraw(s, api) {
    const cfg = s.cfg, ctx = api.ctx;
    const r = s.rockets[0];
    drawWash(api, s);
    // the pad
    if (cfg.pad === 'brick') { api.shadow([0, 0, 0], 0.7, 0); api.drawFaces(Mesh.place(s.mesh, M3.I(), [0, 0, 0])); }
    if (cfg.pad === 'ledge') { api.drawFaces(Mesh.place(s.mesh, M3.I(), v3.add(s.base, v3.scale(s.padDir, 1.5)).map((v, i) => i === 1 ? 0 : v))); }
    if (!s.launched) {
      if (cfg.pad !== 'pipe') drawRocket(api, s.tail0, s.padDir);
    }
    if (cfg.pad === 'pipe') {
      api.drawFaces(Mesh.place(s.brace, M3.I(), [s.base[0] + s.padDir[0] * 1.2, 0, s.base[2] + s.padDir[2] * 1.2]));
      api.shadow(v3.add(s.base, v3.scale(s.padDir, 2)), 0.5, 0.4);
      api.drawFaces(Mesh.place(s.pipe.faces, alignY(s.padDir), v3.add(s.base, v3.scale(s.padDir, 2))));
    }
    if (cfg.pad === 'bottle' || cfg.pad === 'sand') drawBottle(api, s.base, s.tilt + s.bottle.ang, cfg.pad === 'sand');
    drawFlare(api, s);
    // the rocket in flight
    if (r && !r.done) {
      if (r.twin) {
        const side = v3.norm(v3.cross(r.dir, [0, 0, 1])), off = v3.scale(side, 0.13 * Math.cos(r.spin)), back = Math.sin(r.spin) > 0;
        drawRocket(api, v3.add(r.pos, back ? off : v3.scale(off, -1)), r.dir, { alpha: 0.85 });
        drawRocket(api, v3.add(r.pos, back ? v3.scale(off, -1) : off), r.dir);
      } else drawRocket(api, r.pos, r.dir);
      if (r.t < r.burn) {
        // the white-gold tail flame, flickering
        const rr = Math.max(8, 2.2 * api.cam.F / api.project(r.pos).d) * rnd(0.85, 1.15);
        glowAt(api, r.pos, rr, [255, 225, 170], 0.85);
        glowAt(api, r.pos, rr * 0.4, [255, 250, 235], 0.9);
      }
    }
    // parachute
    const ch = s.chute;
    if (ch && s.ended == null) {
      const q = api.project(ch.pos), open = Math.min(1, ch.t / 0.9), rr = Math.max(6, 3 * api.cam.F / q.d) * (0.3 + 0.7 * open);
      const sway = Math.sin(ch.t * 1.7 + ch.sw) * 0.25;
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(sway);
      ctx.strokeStyle = 'rgba(230,220,200,.7)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); for (const fx of [-1, -0.4, 0.4, 1]) { ctx.moveTo(fx * rr, 0); ctx.lineTo(0, rr * 1.5); } ctx.stroke();
      ctx.fillStyle = 'rgba(236,228,214,.92)';
      ctx.beginPath(); ctx.ellipse(0, 0, rr, rr * 0.7 * open + 1, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(190,60,50,.85)'; ctx.beginPath(); ctx.ellipse(0, 0, rr * 0.35, rr * 0.7 * open + 1, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a4a3a'; ctx.fillRect(-1.5, rr * 1.5, 3, 4);
      ctx.restore();
      label(api, `${ch.t.toFixed(1)} s`, q.x, q.y - rr - 6, { font: '600 12px system-ui, sans-serif' });
    }
    // counting the arc
    if (cfg.count && s.liftT != null) {
      const t = (s.popT ?? s.clock) - s.liftT, n = Math.min(COUNT.length, Math.floor(t) + 1);
      const words = COUNT.slice(0, n).join('… ') + (s.popT != null ? (s.kind === 'dud' ? ` — phut. ${t.toFixed(1)} s` : ` — POP! ${t.toFixed(1)} s`) : '…');
      label(api, words, api.W / 2, api.H * 0.09, { font: 'italic 600 22px Georgia, serif' });
    }
    drawFx(api, s);
  }

  const SkyRocket = DiwaliTricks.register({
    id: 'sky-rocket',
    name: 'Rocket from the terrace',
    compendium: [1, 4, 6, 7, 8, 10, 11, 13, 17],
    mode: 'sky',
    views: ['roof'],
    fuse: 1.4,
    options: [{ key: 'launch', label: 'Launched from', default: 'bottle', choices: [
      ['bottle', 'Glass bottle'], ['sand', 'Sand-filled bottle'], ['pipe', 'PVC pipe bazooka'], ['brick', 'Brick hole'], ['parapet', 'Parapet ledge'],
      ['boomerang', 'The boomerang'], ['parachute', 'Whistle + parachute'], ['double', 'Double engine'], ['count', 'Count the arc']] }],
    spentLine: LAUNCH.bottle.line,
    create(api, opts) {
      const cfg = LAUNCH[opts.launch] || LAUNCH.bottle;
      SkyRocket.spentLine = cfg.line;
      return skyCreate(api, cfg);
    },
    wick(s) { return wickOf(s); },
    ignite(s) { s.clock = s.clock || 0; },
    update(s, api, dt, e) {
      s.clock += dt; runLater(s); stepFx(api, s, dt);
      const done = skyUpdate(s, api, dt, e);
      if (s.dudLine) SkyRocket.spentLine = s.dudLine;
      return done;
    },
    draw: skyDraw,
    stop(s) { s.hiss?.stop(); s.whis?.stop(); s.fizz?.stop(); },
    stat(s) { return s.statText; },
  });

  // ======================================================================================
  // sky-aim (#3): tilt the bottle toward the house that never returned the cricket ball
  // ======================================================================================
  const AIM = { pad: 'bottle', alpha: 0, elev: 0.6, burn: 1.35, thrust: 150, wob: 0.3, kick: 0.8, dud: true, line: 'Ball wapas nahi di thi. Hisaab barabar',
    dudLines: ['Seedha unki balcony tak gaya… aur phuss. Unko pata bhi nahi chala'] };
  const AIM_HIT = 9;
  function aimSim(s, el, yaw) {
    const dir = dirFrom(el, yaw), r = newRocket(v3.add(s.base, v3.scale(dir, (1 - TUBE) * L)), dir, { burn: AIM.burn, thrust: AIM.thrust, wob: 0 });
    let best = Infinity;
    for (let i = 0; i < 420; i++) { stepRocket(r, 1 / 60, false); best = Math.min(best, v3.len(v3.sub(r.pos, s.target))); if (r.t > r.burn && r.vel[1] < 0) break; }
    return best;
  }
  const input = (s, api) => (s.fake && s.fake.on ? s.fake : api.pointer);
  const consume = s => { if (s.fake) s.fake.justDown = s.fake.justUp = false; };

  const SkyAim = DiwaliTricks.register({
    id: 'sky-aim',
    name: 'Aimed at the unfriendly house',
    compendium: [3],
    mode: 'sky',
    views: ['roof'],
    interactive: true,
    fuse: 1.1,
    spentLine: AIM.line,
    create(api) {
      SkyAim.spentLine = AIM.line;
      const s = skyCreate(api, { ...AIM });
      s.target = rayPoint(api.cam, api.W * 0.84, api.H * 0.40, 140);
      s.fuseIn = 1.1; s.aim = 0;
      // pointing the finger at their house = tipping the bottle toward it
      const b = api.project(s.base), T = api.project(s.target);
      s.aimT = Math.atan2(T.x - b.x, Math.max(10, b.y - T.y));
      s.yawT = Math.atan2(s.target[0] - s.base[0], -(s.target[2] - s.base[2]));
      // the elevation that carries it to their height (the older kids just knew)
      let bd = Infinity;
      for (let el = 0.15; el < 1.2; el += 0.01) { const d = aimSim(s, el, s.yawT); if (d < bd) { bd = d; s.elev = el; } }
      s.yaw = 0;
      pose(s, api);
      return s;
    },
    wick(s) { return wickOf(s); },
    ignite(s, api) { s.lit = true; s.fuseSnd = api.Sfx.fuse({ pan: api.panOf(wickOf(s)) }); },
    update(s, api, dt, e) {
      s.clock += dt; runLater(s); stepFx(api, s, dt);
      if (e < 0) {
        const p = input(s, api);
        if (phaseNow() === 'armed') {
          const b = api.project(s.base);
          if (p.justDown) s.dragging = true;
          if (s.dragging && p.down) s.aim = clamp(Math.atan2(p.x - b.x, Math.max(10, b.y - p.y)), -1.2, 1.2);
          if (s.dragging && p.justUp) { s.dragging = false; api.ignite(); }
        }
        s.yaw = s.aimT ? s.aim * s.yawT / s.aimT : 0;
        pose(s, api);
        consume(s);
        return false;
      }
      const t = e - s.fuseIn;
      if (t < 0) {
        api.burst(wickOf(s), 2, 2.2, { life: 0.25, size: 0.8, gravity: 120 });
        api.light(wickOf(s), 0.18);
        pose(s, api);
        return false;
      }
      if (s.fuseSnd) { s.fuseSnd.stop(); s.fuseSnd = null; }
      const r = s.rockets[0];
      if (r && !r.done) {
        const d = v3.len(v3.sub(r.pos, s.target));
        s.minMiss = Math.min(s.minMiss ?? Infinity, d);
        if (d < AIM_HIT && !s.hit) { s.hit = true; r.t = Math.max(r.t, r.burn); r.vel[1] = Math.min(r.vel[1], -0.01); api.say('Seedha unki balcony mein!'); }
      }
      const done = skyUpdate(s, api, dt, t);
      if (s.popT != null) {
        const miss = (s.minMiss ?? 0) * UNIT_M, how = s.kind === 'dud' ? ' · then just "phut"' : s.kind ? ` · ${KIND_NAME[s.kind]}` : '';
        s.statText = (s.hit ? `Right onto their balcony (${miss.toFixed(1)} m)` : `Missed their balcony by ${miss.toFixed(1)} m`) + how;
      }
      if (s.dudLine) SkyAim.spentLine = s.dudLine;
      return done;
    },
    autoplay(s, api, t) {
      const f = s.fake || (s.fake = { on: true, x: 0, y: 0, down: false, justDown: false, justUp: false, vx: 0, vy: 0, started: false });
      const b = api.project(s.base), R = api.H * 0.3;
      if (!f.started && t > 0.35) { f.started = true; f.down = true; f.justDown = true; f.goal = s.aimT * rnd(0.96, 1.04); }
      if (f.started && f.down) {
        const k = clamp((t - 0.35) / 0.9, 0, 1), a = f.goal * (1 - Math.pow(1 - k, 3));
        f.x = b.x + Math.sin(a) * R; f.y = b.y - Math.cos(a) * R;
        if (t > 1.5) { f.down = false; f.justUp = true; }
      }
    },
    draw(s, api) {
      skyDraw(s, api);
      if (s.popT == null) {
        const q = api.project(s.target), ctx = api.ctx;
        ctx.save(); ctx.strokeStyle = 'rgba(255,230,190,.55)'; ctx.setLineDash([3, 4]); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(q.x, q.y, 16, 0, TAU); ctx.stroke();
        if (!s.launched && !s.lit) {
          // the line the bottle is pointing along
          const n = api.project(v3.add(s.tail0, v3.scale(s.padDir, TUBE * L))), R = api.H * 0.22;
          ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(n.x + Math.sin(s.aim) * R, n.y - Math.cos(s.aim) * R); ctx.stroke();
        }
        ctx.restore();
        label(api, 'their house (kept our ball)', q.x, q.y - 22, { font: '600 12px system-ui, sans-serif' });
        if (!s.lit) label(api, 'Drag to tilt the bottle, let go to light', api.W / 2, api.H * 0.08);
      }
    },
    stop(s) { s.hiss?.stop(); s.whis?.stop(); s.fuseSnd?.stop(); s.fizz?.stop(); },
    stat(s) { return s.statText; },
  });

  // ======================================================================================
  // far rockets: other buildings' rockets on fixed curves (used by the dogfight and the judges)
  // ======================================================================================
  function stepFar(api, s, k, dt) {
    if (k.done || k.skip) return;
    const tau = (s.clock - k.t0) / k.T;
    if (tau < 0) return;
    const prev = k.pos || k.A;
    k.pos = bez(k.A, k.C, k.B, easeU(Math.min(1, tau)));
    if (!k.flying) { k.flying = true; api.Sfx.whoosh({ vol: 0.06, pan: api.panOf(k.A), dur: 0.5 }); wburst(api, s, k.A, 10, 4, { life: 0.4 }); }
    // their trail: thinner, because it is two buildings away
    k.t = tau * k.T; k.burn = 0.85 * k.T;
    if (tau < 0.85) trail(api, s, k, k.pos, { n: 0.45, size: 0.8, life: 0.8 });
    if (tau >= 1) {
      k.done = true; k.burstAt = s.clock;
      k.kind = burstSky(api, s, k.pos, k.colour, k.size, k.colour2, { kind: k.dud ? 'dud' : k.kind || pickKind(false), min: 0.45 });
    }
  }
  function drawFar(api, k, s) {
    if (!k.flying || k.done || k.skip) return;
    glowAt(api, k.pos, 5, RGB[k.colour] || RGB.gold, 0.9);
  }

  // ======================================================================================
  // sky-dogfight (#15): the next building keeps launching; tap to send ours across one of theirs
  // ======================================================================================
  const DOG_T = 1.9, DOG_SPUT = 0.25, HIT = 14;
  const SkyDog = DiwaliTricks.register({
    id: 'sky-dogfight',
    name: 'Rocket dogfight',
    compendium: [15],
    mode: 'sky',
    views: ['roof'],
    interactive: true,
    fuse: 0.3,
    spentLine: 'Saamne wali building se war shuru',
    create(api) {
      const c = api.cam, s = fx({ clock: 0, later: [], flashes: [], yaw: 0.03, lean: 0, elev: 0.9, base: [0, 0.1, 0], bottle: { ang: 0 }, cfg: { pad: 'bottle' }, enemies: [], launchT: null });
      pose(s, api);
      const O = s.tail0, q = api.project(O), E = rayPoint(c, q.x + api.W * 0.03, api.H * 0.1, 190);
      s.path = { O, C: [O[0], E[1] * 0.5, O[2] + (E[2] - O[2]) * 0.45], E };
      let side = Math.random() < 0.5 ? -1 : 1;
      for (let i = 0; i < 14; i++, side = -side) {
        const u = rnd(0.55, 0.85), X = bez(s.path.O, s.path.C, s.path.E, u), dX = api.project(X).d, ue = 0.75;
        const A = rayPoint(c, api.W * (side < 0 ? 0.05 : 0.95), api.H * 0.47, dX), B = rayPoint(c, api.W * (side < 0 ? 0.78 : 0.22), api.H * 0.12, dX + 15);
        const w = 2 * ue * (1 - ue), Cc = [0, 1, 2].map(j => (X[j] - (1 - ue) * (1 - ue) * A[j] - ue * ue * B[j]) / w);
        const T = rnd(2.9, 3.4);
        // theirs are bought from the same shop: now and then one goes "phut"
        s.enemies.push({ A, B, C: Cc, X, u, T, t0: 0.8 + i * 2.7, cross: 0.8 + i * 2.7 + tauOf(ue) * T, colour: pick(COLOURS), size: rnd(0.8, 1.05), kind: pickKind(true) });
      }
      return s;
    },
    wick(s) { return wickOf(s); },
    ignite(s, api) { s.launchT = s.clock; api.Sfx.crack({ vol: 0.25, pieces: 4 }); },
    update(s, api, dt, e) {
      s.clock += dt; runLater(s); stepFx(api, s, dt);
      for (const k of s.enemies) { if (s.launchT != null && k.t0 > s.launchT + 0.3) k.skip = true; stepFar(api, s, k, dt); }
      if (e < 0) {
        const p = input(s, api);
        if (phaseNow() === 'armed' && p.justDown) api.ignite();
        consume(s);
        return false;
      }
      const t = s.clock - s.launchT - DOG_SPUT;
      if (t < 0) {
        for (let i = 0; i < (api.reduced ? 1 : 5); i++) ws(api, s, s.tail0, [rnd(-3, 3), -rnd(2, 8), rnd(-3, 3)], { life: rnd(0.1, 0.35), size: rnd(0.6, 1.3), gravity: 240 });
        if (Math.random() < dt * 20) api.Sfx.crack({ vol: 0.08, pieces: 1 });
        api.light(s.tail0, 0.3 + rnd(0, 0.15));
        return false;
      }
      if (!s.ours) {
        s.ours = { pos: s.path.O.slice(), dir: s.padDir.slice(), t: 0, done: false, colour: 'green', burn: DOG_T * 0.7 };
        liftOff(api, s, s.tail0, s.padDir);
        s.hiss = api.Sfx.skid({}); s.whis = whistle(api, { dur: DOG_T * 0.8, vol: 0.05 });
      }
      const o = s.ours;
      if (!o.done) {
        o.t += dt;
        const tau = Math.min(1, o.t / DOG_T), prev = o.pos;
        o.pos = bez(s.path.O, s.path.C, s.path.E, easeU(tau));
        const d = v3.sub(o.pos, prev); if (v3.len(d) > 1e-4) o.dir = v3.norm(d);
        o.vel = v3.scale(d, 1 / Math.max(dt, 1e-3));
        if (tau < 0.8) { exhaust(api, s, { vel: o.vel, dir: o.dir }, dt, o.pos); trail(api, s, o, o.pos); }
        s.hiss?.set(clamp(30 / v3.len(v3.sub(o.pos, api.cam.C)), 0.06, 0.6), 0.3 + tau * 0.6, api.panOf(o.pos));
        for (const k of s.enemies) {
          if (!k.flying || k.done) continue;
          const dd = v3.len(v3.sub(k.pos, o.pos));
          s.minMiss = Math.min(s.minMiss ?? Infinity, dd);
          if (dd < HIT && (s.lock !== k || dd < s.lockD)) { s.lock = k; s.lockD = dd; continue; }
          if (s.lock === k) {
            // closest approach just passed: that was the crossing
            s.hit = true; k.done = true; o.done = true; s.minMiss = s.lockD;
            const mid = v3.scale(v3.add(k.pos, o.pos), 0.5);
            burstSky(api, s, mid, 'green', 1.25, k.colour, { kind: pick(['ring', 'peony', 'glitter']), min: 0.6 });
            api.say('Shot it down!');
            break;
          }
        }
        if (!o.done && tau >= 1) { o.done = true; s.kind = burstSky(api, s, o.pos, 'green', 1, null, { kind: pickKind(true), min: 0.45 }); }
        if (o.done) { s.endT = s.clock; s.hiss?.stop(); s.hiss = null; s.whis?.stop(); s.whis = null; }
      }
      if (s.endT != null && !s.statText) {
        const m = (s.minMiss ?? Infinity) * UNIT_M;
        s.statText = s.hit ? `Crossed it at ${m.toFixed(1)} m · shot down!` : (isFinite(m) ? `Missed theirs by ${m.toFixed(1)} m` : 'Nothing in the sky to hit') + (s.kind === 'dud' ? ' · and ours went "phut"' : '');
      }
      const busy = s.enemies.some(k => k.flying && !k.done && !k.skip);
      return s.endT != null && s.clock > s.endT + 2.6 && !busy && !s.later.length && !fxBusy(s);
    },
    autoplay(s, api, t) {
      const f = s.fake || (s.fake = { on: true, x: api.W / 2, y: api.H / 2, down: false, justDown: false, justUp: false, vx: 0, vy: 0 });
      if (s.plan == null) {
        // launch so ours reaches the crossing point when theirs does
        for (const k of s.enemies) { const at = k.cross - DOG_SPUT - tauOf(k.u) * DOG_T; if (at > s.clock + 0.15) { s.plan = at - 1 / 30 + rnd(-0.04, 0.04); break; } }
      }
      if (s.plan != null && s.clock >= s.plan && !f.tapped) { f.tapped = true; f.down = true; f.justDown = true; }
      else if (f.tapped && f.down) { f.down = false; f.justUp = true; }
    },
    draw(s, api) {
      drawWash(api, s);
      for (const k of s.enemies) drawFar(api, k, s);
      if (!s.ours) drawRocket(api, s.tail0, s.padDir);
      drawBottle(api, s.base, s.tilt, false);
      drawFlare(api, s);
      const o = s.ours;
      if (o && !o.done) { drawRocket(api, o.pos, o.dir); if (o.t < o.burn) glowAt(api, o.pos, Math.max(8, 2.2 * api.cam.F / api.project(o.pos).d) * rnd(0.85, 1.15), [255, 225, 170], 0.85); }
      drawFx(api, s);
      if (s.launchT == null) label(api, 'Tap to launch ours across theirs', api.W / 2, api.H * 0.08);
    },
    stop(s) { s.hiss?.stop(); s.whis?.stop(); },
    stat(s) { return s.statText || ''; },
  });

  // ======================================================================================
  // sky-judge (#198): the judges' panel in vests rates the other terraces' rockets
  // ======================================================================================
  const WHO = [[0.2, 'the corner house'], [0.38, 'B-block'], [0.55, 'the new flats'], [0.72, 'C-block'], [1.01, "Gupta-ji's terrace"]];
  const whoAt = x => WHO.find(([f]) => x <= f)[1];
  function scoreOf(k) {
    if (k.dud) return 2;
    const h = k.B[1] * UNIT_M, hN = clamp((h - 6) / 16, 0, 1);
    return clamp(Math.round(3 + 3 * hN + 3 * clamp((k.size - 0.6) / 0.8, 0, 1) + (k.colour2 ? 1 : 0)), 1, 10);
  }
  DiwaliTricks.register({
    id: 'sky-judge',
    name: "Rating the other terraces' rockets",
    compendium: [198],
    mode: 'sky',
    views: ['roof'],
    fuse: 0.9,
    spentLine: 'Judges ka panel, banyan pehen ke. Strict marking',
    create(api) {
      const c = api.cam, s = fx({ clock: 0, later: [], flashes: [], rk: [] });
      const xs = [0.2, 0.76, 0.36, 0.62, 0.5], dud = 1 + Math.floor(Math.random() * 3);
      xs.forEach((fx, i) => {
        const d = rnd(170, 250), A = rayPoint(c, api.W * fx, api.H * 0.47, d), B = rayPoint(c, api.W * (fx + rnd(-0.06, 0.06)), api.H * rnd(0.1, 0.3), d + rnd(0, 20));
        const C = [A[0] * 0.6 + B[0] * 0.4, B[1], (A[2] + B[2]) / 2];
        const last = i === xs.length - 1;
        s.rk.push({ A, B, C, T: rnd(1.4, 2.0), t0: 0.2 + i * 2.5, colour: pick(COLOURS), colour2: last || Math.random() < 0.3 ? pick(['white', 'green', 'rose']) : null,
          size: last ? 1.45 : rnd(0.6, 1.2), dud: i === dud, fx, who: whoAt(fx) });
      });
      return s;
    },
    wick(s) { return s.rk[0].A; },
    update(s, api, dt) {
      s.clock += dt; runLater(s); stepFx(api, s, dt);
      for (const k of s.rk) stepFar(api, s, k, dt);
      const p = api.pointer;
      const open = s.rk.filter(k => k.burstAt != null && k.card == null);
      if (p.justDown && open.length) {
        let best = open[0]; for (const k of open) if (Math.abs(k.fx * api.W - p.x) < Math.abs(best.fx * api.W - p.x)) best = k;
        rate(s, api, best);
      }
      for (const k of open) if (k.card == null && s.clock > k.burstAt + 1.2) rate(s, api, k);
      const all = s.rk.every(k => k.card != null);
      return all && s.clock > Math.max(...s.rk.map(k => k.card.t)) + 2 && !fxBusy(s);
    },
    draw(s, api) {
      const ctx = api.ctx;
      drawWash(api, s);
      for (const k of s.rk) drawFar(api, k, s);
      drawFx(api, s);
      // score cards held up from the parapet
      for (const k of s.rk) {
        if (!k.card) continue;
        const t = s.clock - k.card.t, up = Math.min(1, t / 0.3), cw = Math.min(54, api.W * 0.11), ch = cw * 0.85;
        const x = clamp(k.fx * api.W, cw, api.W - cw), y = api.H - ch * 1.6 * up + ch * 0.2;
        ctx.save();
        ctx.fillStyle = '#6b4f33'; ctx.fillRect(x - 2, y + ch / 2, 4, api.H);
        ctx.fillStyle = k.card.score >= 8 ? '#fff6dc' : '#f2efe6'; ctx.fillRect(x - cw / 2, y - ch / 2, cw, ch);
        ctx.fillStyle = k.card.score >= 8 ? '#b0301e' : '#262019'; ctx.font = `700 ${Math.round(ch * 0.62)}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(k.card.score), x, y + 1);
        ctx.restore();
      }
      if (!s.rk.some(k => k.card)) label(api, 'Tap a burst to hold up your score', api.W / 2, api.H * 0.08);
    },
    stat(s) {
      const rated = s.rk.filter(k => k.card);
      if (!rated.length) return '';
      const best = rated.reduce((a, b) => (b.card.score > a.card.score ? b : a));
      return `Best: ${best.card.score}/10 · the ${best.colour} one from ${best.who}`;
    },
  });
  function rate(s, api, k) {
    k.card = { score: scoreOf(k), t: s.clock };
    api.Sfx.rustle({ vol: 0.12 });
    if (k.card.score >= 9) api.say(`${k.card.score}! ${k.who} wins`);
  }

  // ======================================================================================
  // rocket-car (#14): a rocket taped to a toy truck, down the lane
  // ======================================================================================
  const CarT = DiwaliTricks.register({
    id: 'rocket-car',
    name: 'Rocket car',
    compendium: [14],
    mode: 'ground',
    views: ['lane'],
    fuse: 1.2,
    spentLine: 'Toy truck kabhi pehle jaisa nahi raha',
    create(api) {
      const heading = api.aim([0, 0, 0]) + rnd(-0.18, 0.18);
      // a 9 cm tin toy truck (local +x = forward), with the rocket taped on its back
      const body = [
        ...box(0.46, 0.12, 0.2, [178, 38, 32], { y0: 0.06, top: [196, 50, 40] }),
        ...box(0.16, 0.1, 0.18, [200, 170, 60], { y0: 0.18, top: [214, 186, 70] }).map(f => ({ ...f, pts: f.pts.map(p => [p[0] + 0.13, p[1], p[2]]) })),
      ];
      const wheel = Mesh.cylinder(0.06, 0.05, { segs: 8, bands: 1, colourAt: s => (s % 2 ? [40, 38, 36] : [70, 66, 60]), top: [150, 150, 150], bottom: [150, 150, 150] });
      const rocket = Mesh.lathe([[-0.26, 0.055], [0.22, 0.055], [0.24, 0.05], [0.4, 0.004]], { segs: 10, colourAt: (i, sg) => i === 0 ? (sg % 4 < 2 ? [196, 40, 36] : [232, 190, 64]) : [206, 46, 40] });
      return fx({ heading, body, wheel, rocket, pos: [0, 0, 0], vy: 0, y: 0, speed: 0, roll: 0, flip: 0, flipping: false, dist: 0, burn: 2.1, popped: false, omega: 0 });
    },
    wick(s) { const d = [Math.cos(s.heading), 0, Math.sin(s.heading)]; return [s.pos[0] - d[0] * 0.36, 0.33, s.pos[2] - d[2] * 0.36]; },
    ignite(s, api) {
      s.skid = api.Sfx.skid({ pan: api.panOf(s.pos) });
      const d = [Math.cos(s.heading), 0, Math.sin(s.heading)];
      liftOff(api, s, [s.pos[0] - d[0] * 0.36, 0.33, s.pos[2] - d[2] * 0.36], d, { vol: 0.26, shake: 1 });
    },
    update(s, api, dt, e) {
      s.clock += dt; runLater(s); stepFx(api, s, dt);
      const burning = e < s.burn, d = [Math.cos(s.heading), Math.sin(s.heading)];
      // wheels grip: it mostly goes straight, then veers as the tape loosens
      s.omega += rnd(-1, 1) * 4 * dt + (e > 0.8 ? rnd(-1, 1) * 10 * dt : 0);
      s.omega *= Math.exp(-dt * 2); s.heading += s.omega * dt;
      const thrust = burning ? 46 * Math.min(1, e / 0.2) : 0;
      s.speed += (thrust - 2.5 - s.speed * 0.35) * dt; s.speed = Math.max(0, s.speed);
      if (s.y <= 0 && burning && s.speed > 14 && Math.random() < dt * 1.2) { s.vy = rnd(3, 6); if (!s.flipping && Math.random() < 0.3) s.flipping = true; }
      s.vy -= G * dt; s.y = Math.max(0, s.y + s.vy * dt); if (s.y === 0 && s.vy < 0) { if (s.vy < -4) api.Sfx.strike('tin', { vol: 0.15, pan: api.panOf(s.pos) }); s.vy = 0; }
      if (s.flipping) { s.flip = Math.min(Math.PI, s.flip + dt * 9); if (s.flip >= Math.PI) s.flipped = true; }
      if (s.flipped) s.speed *= Math.exp(-dt * 2.5);
      s.pos[0] += d[0] * s.speed * dt; s.pos[2] += d[1] * s.speed * dt; s.dist += s.speed * dt * UNIT_M;
      s.roll += s.speed * dt / 0.06;
      const tail = [s.pos[0] - d[0] * 0.34, s.y + 0.335, s.pos[2] - d[1] * 0.34];
      if (burning) {
        for (let i = 0; i < (api.reduced ? 2 : 9); i++) ws(api, s, tail, [-d[0] * rnd(6, 15) + rnd(-2, 2), rnd(0, 4), -d[1] * rnd(6, 15) + rnd(-2, 2)], { life: rnd(0.15, 0.5), size: rnd(0.7, 1.5), gravity: 160 });
        // a lazy gold trail hanging over the lane behind it
        for (let i = 0; i < (api.reduced ? 1 : 3); i++) ws(api, s, tail, [-d[0] * rnd(1, 3) + rnd(-0.8, 0.8), rnd(0.5, 2), -d[1] * rnd(1, 3) + rnd(-0.8, 0.8)], { life: rnd(0.7, 1.2), size: rnd(1, 1.7), gravity: 25 });
        api.light(tail, 0.5 + rnd(0, 0.1));
        if (Math.random() < dt * 12) api.smoke(tail, 1, { size: 0.6 });
      }
      if (s.flipped && s.speed > 2) ws(api, s, [s.pos[0], 0.02, s.pos[2]], [rnd(-3, 3), rnd(1, 4), rnd(-3, 3)], { life: 0.3, size: 0.6 });
      s.skid?.set(burning ? 0.5 + Math.min(0.3, s.speed / 80) : Math.min(0.2, s.speed / 60), Math.min(1, s.speed / 30), api.panOf(s.pos));
      if (!s.popped && e > s.burn + 0.1) {
        s.popped = true; s.skid?.stop(); s.skid = null;
        // the head goes off on the road: rose, green and gold, the whole lane lit up
        wburst(api, s, tail, 80, 8, { color: 'rose', life: 1.1 }); wburst(api, s, tail, 50, 6, { color: 'green', life: 1 }); wburst(api, s, tail, 50, 4, { life: 0.9 });
        api.light(tail, 1.2, [255, 140, 180]); api.shake(2.5); api.paper(tail, 8, 3);
        const q = api.project(tail), R = clamp(api.cam.F / q.d * 2.2, 30, 180);
        s.flashes.push({ x: q.x, y: q.y, r: R, t0: s.clock, rgb: RGB.rose });
        s.washes.push({ x: q.x, y: q.y, rgb: RGB.rose, t0: s.clock, a: 0.16 });
        api.Sfx.boom({ vol: 0.6, size: 0.5, pan: api.panOf(s.pos) }); api.smoke(tail, 6);
        const at = s.pos.slice();
        api.remain((ctx, a) => { const c = a.project([at[0], 0.002, at[2]]), r = a.cam.scale * 0.25 * c.f; ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, 0.45); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(16,11,8,.4)'); g.addColorStop(1, 'rgba(16,11,8,0)'); ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore(); });
      }
      return (s.popped && s.speed < 0.3 && e > s.burn + 0.6 && !fxBusy(s)) || e > 10 || Math.hypot(s.pos[0], s.pos[2]) > 70;
    },
    stop(s) { s.skid?.stop(); },
    draw(s, api) {
      const R = M3.mul(alignX(s.heading), M3.rotX(s.flip)), lift = [s.pos[0], s.y + (s.flip > 0 ? Math.sin(s.flip) * 0.2 + (s.flip > Math.PI / 2 ? 0.3 : 0) : 0), s.pos[2]];
      drawWash(api, s);
      api.shadow(s.pos, 0.3, s.y);
      const faces = [...Mesh.place(s.body, R, lift)];
      for (const [wx, wz] of [[-0.15, 0.11], [0.15, 0.11], [-0.15, -0.11], [0.15, -0.11]]) {
        const RW = M3.mul(R, M3.mul(M3.rotX(Math.PI / 2), M3.rotY(s.roll)));
        faces.push(...Mesh.place(s.wheel.faces, RW, v3.add(lift, M3.mulV(R, [wx, 0.06, wz]))));
      }
      faces.push(...Mesh.place(s.rocket.faces, R, v3.add(lift, M3.mulV(R, [-0.06, 0.335, 0]))));
      api.drawFaces(faces);
      // the stub of the snapped stick and a strip of tape
      const a = api.project(v3.add(lift, M3.mulV(R, [-0.3, 0.335, 0]))), b = api.project(v3.add(lift, M3.mulV(R, [-0.7, 0.3, 0])));
      const ctx = api.ctx; ctx.save(); ctx.strokeStyle = '#a07c48'; ctx.lineWidth = Math.max(1, api.cam.scale * 0.018 * a.f); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
      drawFlare(api, s);
      drawFx(api, s);
    },
    stat(s) { return s.dist > 0.05 ? `Drove ${s.dist.toFixed(1)} m${s.flipped ? ' · and went upside down' : ''}` : ''; },
  });

  // ======================================================================================
  // rocket-train (#18): a string between two posts, a rocket threaded on a straw, zip!
  // ======================================================================================
  function trainLayout(s, api) {
    const gl = api.unproject(api.W * 0.1, api.H * 0.66) || [-4, 0, -1], gr = api.unproject(api.W * 0.9, api.H * 0.62) || [4, 0, -1.5];
    const topOf = g0 => { const g = [g0[0] < 0 ? Math.min(g0[0], -4) : Math.max(g0[0], 4), 0, g0[2]]; let lo = 0.6, hi = 10; for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (api.project([g[0], m, g[2]]).y > api.H * 0.3) lo = m; else hi = m; } return Math.min(lo, 6); };
    s.P = [[Math.min(gl[0], -4), 0, gl[2]], [Math.max(gr[0], 4), 0, gr[2]]];
    s.h = Math.min(topOf(gl), topOf(gr));
    const [A, B] = s.P;
    s.span = Math.hypot(B[0] - A[0], B[2] - A[2]);
    s.axis = [(B[0] - A[0]) / s.span, 0, (B[2] - A[2]) / s.span];
  }
  DiwaliTricks.register({
    id: 'rocket-train',
    name: 'The train on a string',
    compendium: [18],
    mode: 'ground',
    views: ['courtyard'],
    fuse: 1.2,
    spentLine: 'Rassi pe rocket. Poori gali dekh rahi thi',
    create(api) {
      const s = fx({ x: 0.45, v: 0, burn: 1.6, popped: false, bonks: 0, reachT: null, fixed: false, bob: 0, bobV: 0 });
      s.post = Mesh.cylinder(0.09, 1, { segs: 8, bands: 1, rgb: [120, 86, 52], top: [150, 112, 70] });
      s.rocket = Mesh.lathe([[-0.26, 0.055], [0.22, 0.055], [0.24, 0.05], [0.4, 0.004]], { segs: 10, colourAt: (i, sg) => i === 0 ? (sg % 4 < 2 ? [196, 40, 36] : [232, 190, 64]) : [206, 46, 40] });
      trainLayout(s, api);
      return s;
    },
    wick(s) { const p = posOn(s); return [p[0] - s.axis[0] * 0.3, p[1] - 0.04, p[2] - s.axis[2] * 0.3]; },
    ignite(s, api) {
      s.fixed = true; trainLayout(s, api); s.whirr = api.Sfx.skid({ pan: api.panOf(posOn(s)) });
      const p = posOn(s); liftOff(api, s, v3.sub(p, v3.scale(s.axis, 0.3)), s.axis, { vol: 0.28, shake: 1 });
    },
    update(s, api, dt, e) {
      s.clock += dt; runLater(s); stepFx(api, s, dt);
      const burning = e < s.burn, end = s.span - 0.45;
      s.v += ((burning ? 58 * Math.min(1, e / 0.15) : 0) - 3 * Math.sign(s.v) - s.v * 0.4) * dt;
      s.x += s.v * dt;
      if (s.x >= end) {
        s.x = end;
        if (s.v > 2) { s.bonks++; api.Sfx.strike('clay', { vol: clamp(s.v / 40, 0.1, 0.6), pan: api.panOf(posOn(s)) }); s.bobV += s.v * 0.08; if (s.reachT == null) s.reachT = e; }
        s.v = -Math.abs(s.v) * 0.25;
      }
      if (s.x < 0.45) { s.x = 0.45; s.v = Math.abs(s.v) * 0.2; }
      // the string bounces under it
      s.bobV += (-60 * s.bob - 3 * s.bobV) * dt + (burning ? rnd(-1, 1) * 8 * dt : 0); s.bob += s.bobV * dt;
      const p = posOn(s);
      if (burning) {
        const tail = v3.sub(p, v3.scale(s.axis, 0.3));
        for (let i = 0; i < (api.reduced ? 2 : 10); i++) ws(api, s, tail, [-s.axis[0] * rnd(5, 14) + rnd(-2, 2), rnd(-3, 3), -s.axis[2] * rnd(5, 14) + rnd(-2, 2)], { life: rnd(0.15, 0.6), size: rnd(0.6, 1.3), gravity: 220 });
        // a gold trail hanging along the string, drifting down slowly
        for (let i = 0; i < (api.reduced ? 1 : 3); i++) ws(api, s, tail, [-s.axis[0] * rnd(1, 3) + rnd(-0.6, 0.6), rnd(-0.5, 1), -s.axis[2] * rnd(1, 3) + rnd(-0.6, 0.6)], { life: rnd(0.7, 1.2), size: rnd(1, 1.6), gravity: 30 });
        api.light(tail, 0.55 + rnd(0, 0.1));
        if (Math.random() < dt * 10) api.smoke(tail, 1, { size: 0.6 });
      }
      s.whirr?.set(burning ? 0.45 + Math.min(0.3, Math.abs(s.v) / 50) : 0.05, clamp(Math.abs(s.v) / 30, 0.1, 1), api.panOf(p));
      if (!s.popped && e > s.burn + 0.12) {
        s.popped = true; s.whirr?.stop(); s.whirr = null;
        // the head goes off at the end of the line: green and gold over the courtyard
        wburst(api, s, p, 70, 7, { color: 'green', life: 1 }); wburst(api, s, p, 50, 5, { life: 0.9 });
        api.light(p, 1.1, [190, 255, 170]); api.shake(2);
        const q = api.project(p), R = clamp(api.cam.F / q.d * 2.2, 30, 180);
        s.flashes.push({ x: q.x, y: q.y, r: R, t0: s.clock, rgb: RGB.green });
        s.washes.push({ x: q.x, y: q.y, rgb: RGB.green, t0: s.clock, a: 0.14 });
        api.Sfx.boom({ vol: 0.5, size: 0.4, pan: api.panOf(p) }); api.smoke(p, 5); api.paper(p, 10, 3);
      }
      return s.popped && e > s.burn + 1.6 && !fxBusy(s);
    },
    stop(s) { s.whirr?.stop(); },
    draw(s, api) {
      if (!s.fixed) trainLayout(s, api);
      drawWash(api, s);
      const ctx = api.ctx, [A, B] = s.P, p = posOn(s);
      for (const P of s.P) { api.shadow(P, 0.2, 0); api.drawFaces(Mesh.place(s.post.faces, [1, 0, 0, 0, s.h, 0, 0, 0, 1], [P[0], s.h / 2, P[2]])); }
      const a = api.project([A[0], s.h, A[2]]), b = api.project([B[0], s.h, B[2]]), m = api.project([p[0], p[1] + 0.06, p[2]]);
      ctx.save(); ctx.strokeStyle = 'rgba(232,222,200,.85)'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(m.x, m.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      // the straw it hangs from
      ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = Math.max(2, api.cam.scale * 0.03);
      const s1 = api.project(v3.add(p, v3.add(v3.scale(s.axis, -0.12), [0, 0.07, 0]))), s2 = api.project(v3.add(p, v3.add(v3.scale(s.axis, 0.12), [0, 0.07, 0])));
      ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke(); ctx.restore();
      api.shadow([p[0], 0, p[2]], 0.2, p[1]);
      api.drawFaces(Mesh.place(s.rocket.faces, alignX(Math.atan2(s.axis[2], s.axis[0])), p));
      drawFlare(api, s);
      drawFx(api, s);
    },
    stat(s) {
      const m = (s.x - 0.45) * UNIT_M;
      if (s.reachT != null) return `Zipped ${((s.span - 0.9) * UNIT_M).toFixed(1)} m in ${s.reachT.toFixed(1)} s`;
      return m > 0.02 ? `Got ${m.toFixed(1)} m down the string` : '';
    },
  });
  function posOn(s) {
    const A = s.P[0], t = s.x / s.span, sag = 0.12 + 0.35 * Math.sin(Math.PI * clamp(t, 0, 1)) * Math.min(1, s.span / 8);
    return [A[0] + s.axis[0] * s.x, s.h - sag - 0.12 - s.bob, A[2] + s.axis[2] * s.x];
  }

  // ---------- memory bindings ----------
  DiwaliTricks.bind(1, 'sky-rocket', { launch: 'bottle' }, 'roof');
  DiwaliTricks.bind(3, 'sky-aim', {}, 'roof');
  DiwaliTricks.bind(4, 'sky-rocket', { launch: 'boomerang' }, 'roof');
  DiwaliTricks.bind(6, 'sky-rocket', { launch: 'parachute' }, 'roof');
  DiwaliTricks.bind(7, 'sky-rocket', { launch: 'sand' }, 'roof');
  DiwaliTricks.bind(8, 'sky-rocket', { launch: 'pipe' }, 'roof');
  DiwaliTricks.bind(10, 'sky-rocket', { launch: 'brick' }, 'roof');
  DiwaliTricks.bind(11, 'sky-rocket', { launch: 'parapet' }, 'roof');
  DiwaliTricks.bind(13, 'sky-rocket', { launch: 'double' }, 'roof');
  DiwaliTricks.bind(14, 'rocket-car', {}, 'lane');
  DiwaliTricks.bind(15, 'sky-dogfight', {}, 'roof');
  DiwaliTricks.bind(17, 'sky-rocket', { launch: 'count' }, 'roof');
  DiwaliTricks.bind(18, 'rocket-train', {}, 'courtyard');
  DiwaliTricks.bind(198, 'sky-judge', {}, 'roof');
})();

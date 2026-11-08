// throw.js — crackers that leave the hand. Compendium #45 46 47 48 49 51 52 53 55 220.
// First person: the pov-hand sprite holds the cracker at the bottom-right of the screen. The player
// lights it (tap), waits, and flicks to throw (or blows into the fist and slams, or just lets go).
// Safety rule of the house: the cracker always leaves the hand before it goes off. If you hold a lit
// one too long, the hand panics and lobs it away for you.
(function () {
  'use strict';
  const { G, v3, M3, UNIT_M } = Phys;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;
  const phaseNow = () => (typeof Stage !== 'undefined' ? Stage.phase : 'armed');
  const ready = i => i && i.complete && i.naturalWidth > 0;
  const PANIC = 0.3;   // seconds of fuse left when the hand gives up and throws it

  function rayPoint(c, sx, sy, depth) {
    const dx = (sx - c.cx) / c.F, dy = -(sy - c.cy) / c.F;
    return v3.add(c.C, v3.scale(v3.add(v3.add(c.fwd, v3.scale(c.right, dx)), v3.scale(c.up, dy)), depth));
  }
  function later(s, dt, fn) { s.later.push({ at: s.clock + dt, fn }); }
  function runLater(s) { for (let i = s.later.length - 1; i >= 0; i--) if (s.clock >= s.later[i].at) { const f = s.later[i].fn; s.later.splice(i, 1); f(); } }
  function box(w, h, d, rgb, o = {}) {
    const x = w / 2, z = d / 2, y0 = o.y0 || 0, y1 = y0 + h, f = (pts, n, c) => ({ pts, n, rgb: c || rgb });
    return [
      f([[-x, y1, -z], [x, y1, -z], [x, y1, z], [-x, y1, z]], [0, 1, 0], o.top),
      f([[-x, y0, z], [x, y0, z], [x, y1, z], [-x, y1, z]], [0, 0, 1]),
      f([[x, y0, -z], [x, y0, z], [x, y1, z], [x, y1, -z]], [1, 0, 0], o.side),
      f([[-x, y0, -z], [-x, y0, z], [-x, y1, z], [-x, y1, -z]], [-1, 0, 0], o.side),
    ];
  }
  function label(api, text, x, y, o = {}) {
    const ctx = api.ctx;
    ctx.save(); ctx.font = o.font || '600 13px system-ui, sans-serif'; ctx.textAlign = o.align || 'center';
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = o.color || 'rgba(255,240,210,.92)'; ctx.fillText(text, x, y); ctx.restore();
  }

  // ---------- the crackers (no brands; plain paper, twine, a fuse) ----------
  const KIND = {
    atom:  { r: 0.13, round: true, paper: [52, 104, 60], twine: '#c8402e', size: 0.9, name: 'bomb' },
    choco: { r: 0.15, round: true, paper: [104, 66, 38], twine: '#cdb27a', size: 1.25, name: 'chocolate bomb' },
    thup:  { r: 0.12, round: true, paper: [226, 216, 192], twine: '#b33328', size: 0.6, name: 'thup-thup' },
    potka: { r: 0.11, round: true, paper: [196, 72, 58], twine: '#e8d9a8', size: 0.7, name: 'potka' },
    bijli: { r: 0.1, size: 0.35, name: 'bijli' },
    half:  { r: 0.05, size: 0, name: 'half a bijli' },
  };
  function drawCracker(ctx, K, x, y, pr, rot, o = {}) {
    pr = Math.max(1.5, pr);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    if (K.round) {
      const [r, g, b] = K.paper;
      ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.beginPath(); ctx.arc(0, 0, pr, 0, TAU); ctx.fill();
      const hi = ctx.createRadialGradient(-pr * 0.4, -pr * 0.45, pr * 0.05, -pr * 0.2, -pr * 0.2, pr * 1.1);
      hi.addColorStop(0, 'rgba(255,248,230,.45)'); hi.addColorStop(0.5, 'rgba(255,248,230,0)'); hi.addColorStop(1, 'rgba(0,0,0,.4)');
      ctx.fillStyle = hi; ctx.beginPath(); ctx.arc(0, 0, pr, 0, TAU); ctx.fill();
      // paper creases and the twine binding
      ctx.strokeStyle = K.twine; ctx.lineWidth = Math.max(0.8, pr * 0.1);
      ctx.beginPath(); ctx.ellipse(0, 0, pr * 0.98, pr * 0.32, 0.5, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, pr * 0.32, pr * 0.98, 0.5, 0, TAU); ctx.stroke();
      if (!o.noFuse) { ctx.strokeStyle = '#8a8478'; ctx.lineWidth = Math.max(0.8, pr * 0.09); ctx.beginPath(); ctx.moveTo(pr * 0.5, -pr * 0.75); ctx.quadraticCurveTo(pr * 0.9, -pr * 1.3, pr * 1.25, -pr * 1.35); ctx.stroke(); }
    } else {
      // a bijli: thin red paper tube with a gold band; `half` is snapped open at one end
      const L = pr * 2 * (K === KIND.half ? 0.55 : 1), w = Math.max(1.5, pr * 0.45);
      ctx.fillStyle = '#b8261e'; ctx.fillRect(-L / 2, -w / 2, L, w);
      ctx.fillStyle = '#e2b34a'; ctx.fillRect(-L * 0.12, -w / 2, L * 0.24, w);
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-L / 2, -w / 2, L, w * 0.3);
      if (K === KIND.half) { ctx.fillStyle = '#3a2a20'; ctx.fillRect(-L / 2 - 1, -w / 2, 2, w); }
      else if (!o.noFuse) { ctx.strokeStyle = '#8a8478'; ctx.lineWidth = Math.max(0.8, w * 0.2); ctx.beginPath(); ctx.moveTo(L / 2, 0); ctx.lineTo(L / 2 + pr * 0.5, -pr * 0.15); ctx.stroke(); }
    }
    ctx.restore();
  }
  // where the fuse end is, in screen space
  function wickScreen(K, x, y, pr, rot) {
    const lx = K.round ? pr * 1.25 : K === KIND.half ? -pr * 0.55 : pr * 1.5, ly = K.round ? -pr * 1.35 : -pr * 0.15;
    return [x + lx * Math.cos(rot) - ly * Math.sin(rot), y + lx * Math.sin(rot) + ly * Math.cos(rot)];
  }

  // ---------- the variants ----------
  const HOW = {
    toss:   { kind: 'atom', fuse: [2.1, 2.8], dRel: 14, name: 'Throw it up',
      line: 'Light, wait, toss… aur upar hi phata. Hero!' },
    thup:   { kind: 'thup', impact: true, dRel: 18, name: 'Thup-thup',
      line: '"Mera zyada zor se phata!"' },
    potka:  { kind: 'potka', impact: true, dRel: 18, wall: true, name: 'Dewal potka',
      line: 'Deewar pe kaala daag, para mein sabko pata chal gaya' },
    phoonk: { kind: 'thup', impact: true, blow: true, dRel: 18, name: 'Phoonk bomb',
      line: 'Jitni zor se phoonka, utni zor se phata. Pakka' },
    water:  { kind: 'choco', fuse: [2.7, 3.4], dRel: 15, pond: true, name: 'Chocolate bomb on water',
      line: 'Paani ke bilkul upar. Pukur ke kinare sab ne taali bajayi' },
    flick:  { kind: 'bijli', fuse: [1.2, 1.6], dRel: 16, name: 'Bijli flick',
      line: 'Carrom ka striker, Diwali edition' },
    bowl:   { kind: 'bijli', fuse: [2.4, 2.9], dRel: 16, bowl: true, name: 'Bijli bowling',
      line: 'Gully cricket, Diwali rules. Batsman safe, wicket gone' },
    drop:   { kind: 'bijli', fuse: [1.7, 2.3], dRel: 30, drop: true, handUp: 0.3, name: 'Bijli from the balcony',
      line: 'Beech hawa mein phati. Timing sab kuch thi' },
    fuski:  { kind: 'half', fizz: true, name: 'The fuski flare',
      line: 'Phuss wala bijli bhi bekaar nahi jaata tha' },
    gust:   { kind: 'choco', fuse: [2.4, 3.0], dRel: 18, gust: true, name: 'Chocolate bomb gust',
      line: 'Dhamaka nahi, hawa ka thappad. Baal ud gaye' },
  };

  // ---------- the hand ----------
  function handFrame(api, s) {
    const D = Math.min(api.W, api.H) * 0.62, h = s.hand, bob = Math.sin(s.clock * 1.4) * 2.5;
    const x0 = api.W - D * 0.95 + h.x, y0 = api.H - D * 0.9 + h.y + bob - (s.cfg.handUp || 0) * api.H * h.up;
    // rotate about the wrist (bottom-right of the sprite)
    const wx = x0 + 0.8 * D, wy = y0 + 0.92 * D, c = Math.cos(h.r), sn = Math.sin(h.r);
    const lx = (0.32 - 0.8) * D, ly = (0.375 - 0.92) * D;
    return { D, x0, y0, wx, wy, x: wx + lx * c - ly * sn, y: wy + lx * sn + ly * c };
  }
  function drawHand(api, s) {
    const f = handFrame(api, s), ctx = api.ctx, im = api.img('pov-hand');
    ctx.save(); ctx.translate(f.wx, f.wy); ctx.rotate(s.hand.r);
    if (ready(im)) ctx.drawImage(im, -0.8 * f.D, -0.92 * f.D, f.D, f.D);
    else {
      ctx.fillStyle = '#b07a52'; ctx.beginPath(); ctx.ellipse((0.36 - 0.8) * f.D, (0.4 - 0.92) * f.D, f.D * 0.12, f.D * 0.1, -0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e9dcc4'; ctx.beginPath(); ctx.ellipse(0, 0, f.D * 0.18, f.D * 0.12, -0.7, 0, TAU); ctx.fill();
    }
    ctx.restore();
    return f;
  }
  function handSpring(s, dt) {
    const h = s.hand;
    h.vx += (-60 * h.x - 11 * h.vx) * dt; h.vy += (-60 * h.y - 11 * h.vy) * dt; h.vr += (-60 * h.r - 11 * h.vr) * dt;
    h.x += h.vx * dt; h.y += h.vy * dt; h.r += h.vr * dt;
    h.up += ((s.st === 'hold' || s.st === 'lit' ? 1 : 0.6) - h.up) * Math.min(1, dt * 4);
  }

  // ---------- input ----------
  const input = (s, api) => (s.fake && s.fake.on ? s.fake : api.pointer);
  const consume = s => { if (s.fake) s.fake.justDown = s.fake.justUp = false; };
  function swipeVel(p) {
    const path = p.path;
    if (path && path.length >= 2) {
      const last = path[path.length - 1];
      let j = path.length - 2; while (j > 0 && last[2] - path[j][2] < 90) j--;
      const dt = Math.max(16, last[2] - path[j][2]) / 1000;
      return [(last[0] - path[j][0]) / dt, (last[1] - path[j][1]) / dt];
    }
    return [p.vx || 0, p.vy || 0];
  }

  // ---------- trick ----------
  const T = DiwaliTricks.register({
    id: 'hand-throw',
    name: 'Thrown from the hand',
    compendium: [45, 46, 47, 48, 49, 51, 52, 53, 55, 220],
    mode: 'hand',
    views: ['lane', 'park', 'landing'],
    interactive: true,
    fuse: 0,
    options: [{ key: 'how', label: 'How', default: 'toss', choices: Object.keys(HOW).map(k => [k, HOW[k].name]) }],
    spentLine: HOW.toss.line,

    create(api, opts) {
      const how = HOW[opts.how] ? opts.how : 'toss', cfg = HOW[how];
      T.spentLine = cfg.line;
      const s = {
        how, cfg, K: KIND[cfg.kind], clock: 0, later: [], st: 'hold', lit: false, fuseLeft: 0, fuseMax: 0,
        hand: { x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0, up: 1 }, pos: null, vel: null, spin: rnd(-14, 14), rot: 0,
        statText: '', power: 0, blowing: false, puffs: [], ripples: [], rings: [], bouncedAt: null,
      };
      if (cfg.fuse) s.fuseMax = rnd(cfg.fuse[0], cfg.fuse[1]);
      if (cfg.pond) { s.pond = { c: [0, 0, -14], rx: 11, rz: 7, wob: Array.from({ length: 28 }, () => rnd(0.88, 1.1)) }; placePond(s, api); }
      if (cfg.bowl) {
        s.batter = { x: 0.8, z: -30, dodge: 0, swing: 0, swingV: 0, hops: 0 };
        s.stumps = [...box(0.6, 0.5, 0.3, [150, 66, 48], { top: [168, 80, 58] }), ...box(0.6, 0.5, 0.3, [158, 70, 50], { y0: 0.5, top: [172, 84, 60] })];
      }
      return s;
    },

    wick(s, api) { return s.pos || [0, 0.1, 0]; },

    ignite(s, api) { /* the gesture already threw (or lit) it */ },

    update(s, api, dt, e) {
      s.clock += dt; runLater(s);
      handSpring(s, dt);
      const cfg = s.cfg, f = handFrame(api, s);
      const inHand = s.st === 'hold' || s.st === 'lit';
      // the lit fuse in the hand: sputtering sparks, counting down
      if (s.lit && inHand && !cfg.fizz) {
        s.fuseLeft -= dt;
        const pr = handSize(s, f), [wx, wy] = wickScreen(s.K, f.x, f.y, pr, s.rot);
        for (let i = 0; i < (api.reduced ? 1 : 3); i++) api.sparkScreen(wx, wy, rnd(-90, 90), rnd(-140, 20), { life: rnd(0.08, 0.3), size: rnd(0.6, 1.1), gravity: 400 });
        if (s.fuseLeft < PANIC) panic(s, api, f);
      }
      // the fuski flare: hissing sideways out of the open end
      if (cfg.fizz && s.st === 'fizz') fizz(s, api, dt, f, e);
      if (s.pond && !s.pos) placePond(s, api);
      if (s.gustBits) for (const b of s.gustBits) { b.t += dt; if (b.t > 0) { b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 1.03; b.vy *= 1.03; } }
      if (s.batter) { const b = s.batter; b.swing += b.swingV * dt; b.swingV *= Math.exp(-dt * 3); }
      if (e < 0) {
        if (phaseNow() === 'armed') gesture(s, api, dt, f);
        consume(s);
        return false;
      }
      if (s.st === 'fly' || s.st === 'ground' || s.st === 'sunk' || s.st === 'floor') fly(s, api, dt);
      if (!s.burst && !s.doneAt && e > 12 && s.pos) bang(s, api, s.pos, s.K.size, { onGround: s.pos[1] < 0.5 });   // never leave one lying lit
      for (const r of s.rings) r.t += dt;
      for (const r of s.ripples) r.t += dt;
      return s.doneAt != null && s.clock > s.doneAt + (cfg.gust ? 2.4 : 1.8) && !s.later.length;
    },

    autoplay(s, api, t) {
      const f = s.fake || (s.fake = { on: true, x: 0, y: 0, down: false, justDown: false, justUp: false, vx: 0, vy: 0, auto: true });
      const cfg = s.cfg, hf = handFrame(api, s);
      const tap = () => { f.x = hf.x; f.y = hf.y; f.down = true; f.justDown = true; f.vx = f.vy = 0; f.upAt = t + 0.06; };
      const swipe = (vx, vy, dur = 0.1) => { f.x = hf.x; f.y = hf.y; f.down = true; f.justDown = true; f.sw = { vx, vy, end: t + dur }; };
      if (f.down && f.upAt != null && t >= f.upAt) { f.down = false; f.justUp = true; f.upAt = null; }
      if (f.down && f.sw) { f.x += f.sw.vx / 60; f.y += f.sw.vy / 60; f.vx = f.sw.vx; f.vy = f.sw.vy; if (t >= f.sw.end) { f.down = false; f.justUp = true; f.sw = null; } }
      if (f.down || f.justUp) return;
      const H = api.H, W = api.W;
      if (cfg.fizz) { if (!s.snapped && t > 0.4) tap(); else if (s.snapped && !s.lit && t > 1.3) tap(); return; }
      if (cfg.blow) { if (!s.blowing && !f.blew && t > 0.4) { f.blew = true; f.x = hf.x; f.y = hf.y; f.down = true; f.justDown = true; f.upAt = t + rnd(1.1, 1.9); } return; }
      if (cfg.impact) {
        if (t > 0.6 && !f.thrown) { f.thrown = true; if (cfg.wall) swipe(-W * rnd(2, 3), -H * rnd(-0.2, 0.8)); else swipe(-W * rnd(0, 0.3), H * rnd(2, 3.8)); }
        return;
      }
      // fuse crackers: light first, then throw at the right moment
      if (!s.lit) { if (t > 0.35) tap(); return; }
      if (s.st !== 'lit' || f.thrown) return;
      const left = s.fuseLeft;
      if (s.how === 'toss' && left < 0.8 + s.autoJitter) { f.thrown = true; swipe(-W * 0.15, -H * rnd(2.4, 2.9)); }
      if (s.how === 'water' && s.autoWater == null) s.autoWater = flightTimeWater(s, api, -H * 1.6) + 0.1 - 0.06;
      if (s.how === 'water' && left < s.autoWater + s.autoJitter * 0.15) { f.thrown = true; swipe(-W * 0.1, -H * 1.6); }
      if (s.how === 'flick' && left < 0.75 + s.autoJitter) { f.thrown = true; swipe(-W * rnd(0.6, 1.2), -H * 1.4); }
      if (s.how === 'bowl' && left < 2.0) { f.thrown = true; swipe(W * rnd(-0.9, 0.9), -H * rnd(1.9, 2.9)); }
      if (s.how === 'drop' && left < 0.45 + s.autoJitter * 0.4) { f.thrown = true; tap(); }
      if (s.how === 'gust' && left < 1.6) { f.thrown = true; swipe(-W * 0.3, -H * 1.5); }
    },

    draw(s, api) {
      const ctx = api.ctx, cfg = s.cfg;
      if (s.pond) drawPond(api, s);
      if (s.batter) drawCricket(api, s);
      // shock ring on the ground (the gust)
      for (const r of s.rings) {
        if (r.t > 0.6) continue;
        const k = r.t / 0.6, R = 2 + k * 30;
        const c = api.project(r.at), ex = api.project(v3.add(r.at, [R, 0, 0])), ez = api.project(v3.add(r.at, [0, 0, R]));
        ctx.save(); ctx.strokeStyle = `rgba(255,236,200,${0.5 * (1 - k)})`; ctx.lineWidth = 3 + 10 * (1 - k);
        ctx.beginPath(); ctx.ellipse(c.x, c.y, Math.abs(ex.x - c.x) + 1, Math.abs(ez.y - c.y) + 1, 0, 0, TAU); ctx.stroke();
        // and the wall of air rushing at the camera
        const sr = k * Math.max(api.W, api.H) * 1.2;
        const g = ctx.createRadialGradient(c.x, c.y, sr * 0.7, c.x, c.y, sr);
        g.addColorStop(0, 'rgba(255,240,220,0)'); g.addColorStop(0.85, `rgba(255,240,220,${0.18 * (1 - k)})`); g.addColorStop(1, 'rgba(255,240,220,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, api.W, api.H);
        ctx.restore();
      }
      // dust and grit blown at the face
      if (s.gustBits) {
        ctx.save(); ctx.strokeStyle = 'rgba(220,200,170,.5)'; ctx.lineCap = 'round';
        for (const b of s.gustBits) { if (b.t > b.life || b.t < 0) continue; const k = 1 - b.t / b.life; ctx.globalAlpha = k; ctx.lineWidth = b.w; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03); ctx.stroke(); }
        ctx.restore();
      }
      // the cracker in flight (or lying there, fizzing)
      if (s.pos && !s.burst && s.st !== 'sunk') {
        const q = api.project(s.pos), K = s.K, f = handFrame(api, s);
        let pr = K.r * api.cam.F / q.d, x = q.x, y = q.y;
        const k = clamp((s.clock - s.relT) / 0.12, 0, 1);
        if (k < 1) { pr = handSize(s, f) * (1 - k) + pr * k; x = s.relX * (1 - k) + x * k; y = s.relY * (1 - k) + y * k; }
        if (s.st !== 'floor') { api.shadow(s.pos, K.r * 1.2, s.pos[1]); drawCracker(ctx, K, x, y, pr, s.rot); }
        if (s.lit && !s.burst) { const [wx, wy] = wickScreen(K, x, y, pr, s.rot); s.wickNow = [wx, wy]; }
      }
      // the hand, with the cracker in it
      const f = drawHand(api, s);
      if (s.st === 'hold' || s.st === 'lit' || s.st === 'fizz' || s.st === 'spent-hand') {
        const pr = handSize(s, f);
        drawCracker(ctx, s.K, f.x, f.y, pr, s.rot, { noFuse: cfg.fizz && s.snapped });
        if (cfg.fizz && s.halfOff) {
          const t = s.clock - s.halfOff;
          if (t < 1.2) drawCracker(ctx, KIND.half, f.x + 20 + t * 60, f.y + t * t * 900, pr, s.rot + t * 9, { noFuse: true });
        }
      }
      // lighting with the agarbatti
      if (s.lightT != null && s.clock - s.lightT < 0.45) {
        const t = (s.clock - s.lightT) / 0.45, reach = Math.sin(t * Math.PI), pr = handSize(s, f), [wx, wy] = wickScreen(s.K, f.x, f.y, pr, s.rot);
        const sx = wx - api.W * 0.32, sy = api.H + 10, tx = sx + (wx - sx) * reach * 0.95, ty = sy + (wy - sy) * reach * 0.95;
        ctx.save(); ctx.strokeStyle = '#5a3a26'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, 9); g.addColorStop(0, 'rgba(255,170,80,.95)'); g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g; ctx.fillRect(tx - 9, ty - 9, 18, 18); ctx.restore();
      }
      // phoonk: breath puffs into the fist and the power ring
      if (cfg.blow && (s.blowing || s.power > 0) && s.st === 'hold') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const p of s.puffs) { const k = p.t / 0.6; if (k > 1) continue; ctx.strokeStyle = `rgba(230,236,255,${0.35 * (1 - k)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x + (f.x - p.x) * k, p.y + (f.y - p.y) * k, 6 + k * 10, 0, TAU); ctx.stroke(); }
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(f.x, f.y, f.D * 0.16, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
        ctx.strokeStyle = s.power > 0.8 ? '#ff7a3c' : '#ffd38a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, f.D * 0.16, -Math.PI / 2, -Math.PI / 2 + TAU * s.power); ctx.stroke();
        ctx.restore();
        label(api, `phoonk power ${Math.round(s.power * 100)}%`, f.x, f.y - f.D * 0.2);
      }
      // hints
      if (s.st === 'hold' || s.st === 'lit') {
        const hint = hintFor(s);
        if (hint) label(api, hint, api.W / 2, api.H * 0.08);
      }
      if (s.st === 'lit' && !cfg.fizz) {
        // the fuse you can see shrinking
        const pr = handSize(s, f), k = clamp(s.fuseLeft / s.fuseMax, 0, 1);
        ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(f.x - pr * 2, f.y + pr * 1.8, pr * 4, 3);
        ctx.fillStyle = k < 0.3 ? '#ff6a3a' : '#ffcf7a'; ctx.fillRect(f.x - pr * 2, f.y + pr * 1.8, pr * 4 * k, 3); ctx.restore();
      }
    },

    stop(s) { s.fuseSnd?.stop(); s.hissSnd?.stop(); },
    stat(s) { return s.statText; },
  });

  function handSize(s, f) { return f.D * (s.K.round ? 0.045 : 0.05); }
  function hintFor(s) {
    const cfg = s.cfg;
    if (cfg.fizz) return !s.snapped ? 'Tap to snap the dud in half' : !s.lit ? 'Tap to light the open end' : '';
    if (cfg.blow) return s.blowing ? 'Blow (or keep holding)… let go to slam' : 'Hold to blow into your fist';
    if (cfg.wall) return 'Fling it left, at the wall';
    if (cfg.impact) return 'Flick down to smash it';
    if (!s.lit) return 'Tap to light it';
    if (cfg.drop) return 'Wait for it… tap to let go';
    if (cfg.bowl) return 'Flick up to bowl it at the batsman';
    if (cfg.pond) return 'Wait… then lob it over the water';
    return s.how === 'flick' ? 'Flick it!' : 'Wait for it… flick up to toss';
  }

  // ---------- gestures ----------
  function lightIt(s, api, f) {
    s.lit = true; s.st = 'lit'; s.fuseLeft = s.fuseMax; s.lightT = s.clock; s.autoJitter = rnd(-0.15, 0.15);
    s.fuseSnd = api.Sfx.fuse({ pan: 0.4 });
    api.Sfx.crack({ vol: 0.12, pieces: 2, pan: 0.4 });
  }
  function gesture(s, api, dt, f) {
    const p = input(s, api), cfg = s.cfg;
    if (p.justDown) {
      s.stroke = { t: s.clock, afterLit: s.lit };
      if (cfg.fizz) {
        if (!s.snapped) { s.snapped = true; s.halfOff = s.clock; api.Sfx.crack({ vol: 0.4, pieces: 3, pan: 0.4 }); s.hand.vr -= 3; }
        else if (!s.lit) { s.lit = true; s.lightT = s.clock; s.st = 'fizz'; s.fizzT = 0; s.fizzLen = rnd(2.6, 3.6); s.hissSnd = api.Sfx.fuse({ vol: 0.14, pan: 0.4 }); api.ignite(); }
      } else if (cfg.blow) {
        s.blowing = true;
        if (!p.auto && !s.micAsked) { s.micAsked = true; api.mic().then(fn => { s.mic = fn; }).catch(() => {}); }
      } else if (!cfg.impact && !s.lit) lightIt(s, api, f);
      else if (cfg.drop && s.st === 'lit') { release(s, api, f, [0, 0]); s.stroke = null; }
    }
    if (cfg.blow && s.blowing && p.down) {
      // the harder (or longer) you blow, the bigger the bang
      const lvl = s.mic ? clamp(s.mic() * 2.4, 0, 1) : 0;
      s.power = clamp(s.power + dt * (s.mic ? 0.12 + lvl * 0.9 : 0.55), 0, 1);
      s.hand.x += (-api.W * 0.1 - s.hand.x) * Math.min(1, dt * 3); s.hand.y += (-api.H * 0.08 - s.hand.y) * Math.min(1, dt * 3);
      if (Math.random() < dt * (6 + lvl * 20)) s.puffs.push({ x: api.W * rnd(0.42, 0.55), y: api.H * 1.02, t: 0 });
      api.Sfx.rustle && Math.random() < dt * 5 && api.Sfx.rustle({ vol: 0.04 + lvl * 0.08 });
    }
    for (const q of s.puffs) q.t += dt;
    if (s.puffs.length > 30) s.puffs.splice(0, s.puffs.length - 30);
    if (p.justUp && s.stroke) {
      const sv = swipeVel(p), sp = Math.hypot(sv[0], sv[1]) / api.H;
      if (cfg.blow) { if (s.blowing) { s.blowing = false; release(s, api, f, [0, api.H * 3]); } }
      else if (cfg.impact) { if (sp > 0.5) release(s, api, f, sv); }
      else if (cfg.fizz) { /* taps only */ }
      else if (s.lit && s.st === 'lit' && (s.stroke.afterLit || sp > 1.2)) {
        if (cfg.drop || sp > 0.5) release(s, api, f, sv);
      }
      s.stroke = null;
    }
  }
  function panic(s, api, f) {
    // never in the hand: a scared lob, away from everyone
    release(s, api, f, [-api.H * 0.4, -api.H * 1.6]);
    s.panicked = true; api.say('Arre! Phenko!');
  }

  // ---------- release: hand → world ----------
  function release(s, api, f, sv) {
    const cfg = s.cfg, c = api.cam, H = api.H, W = api.W;
    const sp = Math.hypot(sv[0], sv[1]) / H, dx = sv[0] / (Math.hypot(sv[0], sv[1]) || 1), dy = sv[1] / (Math.hypot(sv[0], sv[1]) || 1);
    const p0 = rayPoint(c, f.x, f.y, cfg.dRel || 18);
    let v;
    const solve = (g, tf) => [(g[0] - p0[0]) / tf, (g[1] - p0[1]) / tf + 0.5 * G * tf, (g[2] - p0[2]) / tf];
    const ground = (sx, sy, fb) => api.unproject(sx, sy) || fb;
    if (s.how === 'toss') {
      const up = dy < -0.3 ? clamp(10 + sp * 6, 12, 27) : 9;
      v = [dx * sp * 3, up, -clamp(10 + sp * 3, 10, 20)];
    } else if (s.how === 'thup' || s.how === 'phoonk') {
      const g = ground(clamp(f.x - W * 0.12 + dx * W * 0.1, W * 0.1, W * 0.9), H * (s.how === 'phoonk' ? 0.9 : 0.84), [0, 0, 4]);
      const tf = s.how === 'phoonk' ? 0.2 : clamp(0.36 - sp * 0.06, 0.1, 0.36);
      v = solve([g[0], s.K.r, g[2]], tf);
    } else if (s.how === 'potka') {
      // the wall is the screen-left edge: aim at a spot on it, chest high-ish, at the depth of its foot
      const g = ground(W * 0.07, H * 0.62, [-14, 0, -12]), d = api.project(g).d;
      const tgt = rayPoint(c, W * 0.07, H * clamp(0.3 + dy * 0.1, 0.2, 0.42), d);
      s.wallX = tgt[0];
      const tf = clamp(0.5 - sp * 0.05, 0.22, 0.5);
      v = solve([tgt[0], Math.max(1.5, tgt[1]), tgt[2]], tf);
    } else if (s.how === 'water') {
      v = solve(waterAim(s, dx), waterTf(sp, dy));
    } else if (s.how === 'flick') {
      const g = ground(clamp(f.x + dx * W * 0.25 - W * 0.15, W * 0.05, W * 0.95), H * clamp(0.76 - sp * 0.04, 0.62, 0.76), [0, 0, 2]);
      v = solve([g[0], 0.6, g[2]], clamp(0.35 + sp * 0.08, 0.35, 0.75));
      s.spin = rnd(18, 30) * (Math.random() < 0.5 ? -1 : 1);
    } else if (s.how === 'bowl') {
      const pitch = [s.batter.x + dx * 3, 0.05, s.batter.z + clamp(6 + (sp - 2) * 5, 3, 12)];
      v = solve(pitch, 0.6);
      s.turn = clamp(dx * 14, -12, 12);
    } else if (s.how === 'drop') {
      v = [dx * sp * 1.5, dy < 0 ? 2 : 0, -1];
      s.dropY = p0[1];
    } else if (s.how === 'gust') {
      const g = ground(W * 0.45 + dx * W * 0.1, H * 0.6, [0, 0, -8]);
      v = solve([g[0], s.K.r, g[2]], 0.7);
    } else v = [0, 5, -8];
    s.pos = p0; s.vel = v; s.p0 = p0.slice();
    s.st = 'fly'; s.relT = s.clock; s.relX = f.x; s.relY = f.y;
    s.throwSpeed = v3.len(v) * UNIT_M;
    // the hand follows through
    const hv = s.how === 'drop' ? [0, 120] : [clamp(sv[0] * 0.25, -900, 900), clamp(sv[1] * 0.25, -900, 900)];
    s.hand.vx += hv[0]; s.hand.vy += hv[1]; s.hand.vr += clamp(sv[0] / H, -4, 4) * 0.6 + (s.how === 'phoonk' ? 3 : 0);
    if (s.how !== 'drop') api.Sfx.whoosh({ vol: 0.08 + Math.min(0.12, sp * 0.03), pan: 0.3, dur: 0.25 });
    api.ignite();
  }
  // the pond sits in the lower middle of the view (re-placed while the camera pushes in)
  function placePond(s, api) { const c = api.unproject(api.W * 0.45, api.H * 0.7); if (c) s.pond.c = [c[0], 0, c[2]]; }
  function waterAim(s, dx) { return [s.pond.c[0] + dx * 3, 0.05, s.pond.c[2]]; }
  function waterTf(sp, dy) { return clamp(0.75 + sp * 0.12 * (dy < 0 ? 1 : 0.4), 0.75, 1.3); }
  function flightTimeWater(s, api, vy) { return waterTf(Math.abs(vy) / api.H, -1); }

  // ---------- flight ----------
  function inPond(s, p) {
    const P = s.pond; if (!P) return false;
    const a = Math.atan2((p[2] - P.c[2]) / P.rz, (p[0] - P.c[0]) / P.rx), k = P.wob[Math.floor(((a + Math.PI) / TAU) * P.wob.length) % P.wob.length];
    return Math.hypot((p[0] - P.c[0]) / P.rx, (p[2] - P.c[2]) / P.rz) < k;
  }
  function fly(s, api, dt) {
    const cfg = s.cfg, K = s.K;
    if (s.burst) return;
    if (s.lit) {
      s.fuseLeft -= dt;
      if (s.wickNow && s.st !== 'sunk') for (let i = 0; i < (api.reduced ? 1 : 2); i++) api.sparkScreen(s.wickNow[0], s.wickNow[1], rnd(-60, 60), rnd(-90, 20), { life: rnd(0.08, 0.25), size: 0.7, gravity: 300 });
      if (s.st === 'sunk' && Math.random() < dt * 20) api.spark(v3.add(s.pos, [0, 0.1, 0]), [rnd(-1, 1), rnd(1, 3), rnd(-1, 1)], { color: 'white', life: 0.3, size: 0.6 });
    }
    if (s.st === 'fly') {
      for (let i = 0; i < 2; i++) {
        const h = dt / 2;
        s.vel[1] -= G * h; s.vel = v3.scale(s.vel, Math.exp(-0.12 * h));
        if (s.turn && s.bouncedAt) { s.vel[0] += s.turn * h * 2; }
        s.pos = v3.add(s.pos, v3.scale(s.vel, h));
        s.rot += s.spin * h;
        if (collide(s, api)) break;
      }
    } else if (s.st === 'ground') {
      // skitter to a stop, fizzing
      const sp = Math.hypot(s.vel[0], s.vel[2]);
      if (sp > 0.05) { const k = Math.max(0, sp - 30 * dt) / sp; s.vel[0] *= k; s.vel[2] *= k; s.pos[0] += s.vel[0] * dt; s.pos[2] += s.vel[2] * dt; s.rot += sp * dt * 3; }
      if (s.how === 'bowl') bowlTick(s, api);
    }
    if (s.lit && s.fuseLeft <= 0) {
      if (s.st === 'sunk') underwater(s, api);
      else bang(s, api, s.pos, K.size, { onGround: s.st !== 'fly' && s.pos[1] < 0.5 });
    }
  }
  function collide(s, api) {
    const cfg = s.cfg, K = s.K, r = K.round ? K.r : 0.04;
    if (cfg.wall && s.pos[0] <= s.wallX) {
      s.pos[0] = s.wallX + 0.05;
      const h = s.pos[1] * UNIT_M;
      s.statText = `Hit the wall ${h.toFixed(1)} m up · crack!`;
      bang(s, api, s.pos, K.size, { wall: true });
      return true;
    }
    if (cfg.drop && s.pos[1] <= s.dropY - 16) {
      s.st = 'floor'; s.vel = [0, 0, 0]; s.landed = true;
      api.Sfx.strike('clay', { vol: 0.08, pan: 0.2 });
      return true;
    }
    if (!cfg.drop && s.pos[1] <= r && s.vel[1] < 0) {
      s.pos[1] = r;
      if (cfg.pond && inPond(s, s.pos)) {
        s.st = 'sunk'; s.vel = [0, 0, 0]; s.hitWaterT = s.clock;
        s.ripples.push({ at: s.pos.slice(), t: 0 });
        api.Sfx.crack({ vol: 0.12, pieces: 2 }); api.Sfx.rustle({ vol: 0.2 });
        for (let i = 0; i < (api.reduced ? 6 : 26); i++) api.spark(s.pos, [rnd(-3, 3), rnd(3, 9), rnd(-3, 3)], { color: 'white', life: rnd(0.3, 0.7), size: rnd(0.6, 1.1) });
        return true;
      }
      if (cfg.impact) {
        const vImp = v3.len(s.vel) * UNIT_M;
        s.impactV = vImp;
        let size = K.size * clamp(0.6 + vImp / 12, 0.6, 1.5);
        if (cfg.blow) size = 0.45 + s.power * 0.95;
        bang(s, api, s.pos, size, { onGround: true, crack: true });
        return true;
      }
      if (s.bouncedAt == null) s.bouncedAt = s.pos.slice();
      api.Sfx.strike('clay', { vol: clamp(-s.vel[1] / 60, 0.03, 0.2), pan: api.panOf(s.pos), detune: 1.6 });
      s.vel[1] = -s.vel[1] * (K.round ? 0.25 : 0.35); s.vel[0] *= 0.7; s.vel[2] *= 0.7;
      if (Math.abs(s.vel[1]) < 2) { s.vel[1] = 0; s.st = 'ground'; s.landed = true; }
    }
    if (s.how === 'bowl') bowlTick(s, api);
    return false;
  }

  // ---------- the bang ----------
  function bang(s, api, pos, size, o = {}) {
    s.burst = true; s.doneAt = s.clock; s.burstPos = pos.slice();
    s.fuseSnd?.stop(); s.fuseSnd = null;
    const pan = api.panOf(pos), cfg = s.cfg;
    api.burst(pos, Math.round(140 * size), 9 * size, { flat: !!o.onGround, life: 0.7 });
    api.paper(pos, Math.round(18 * size), 3.5 * size);
    api.smoke(pos, Math.round(8 + 8 * size), { size: 1 + size * 0.5 });
    api.light(pos, 0.6 + size * 0.5);
    api.shake(cfg.gust ? 16 : 3 + 6 * size);
    api.Sfx.boom({ vol: clamp(0.45 + size * 0.35, 0.3, 1), size, muffle: o.wall ? 0.1 : 0, pan });
    if (o.crack || o.wall) api.Sfx.crack({ vol: 0.6, pieces: 4, pan });
    if (o.wall) {
      // sparks splash back off the wall
      for (let i = 0; i < (api.reduced ? 10 : 60); i++) api.spark(pos, [rnd(2, 12), rnd(-4, 8), rnd(-6, 6)], { life: rnd(0.2, 0.6) });
      const at = pos.slice();
      api.remain((ctx, a) => {
        const c = a.project(at), ez = a.project(v3.add(at, [0, 0, 0.7])), ey = a.project(v3.add(at, [0, 0.6, 0]));
        ctx.save(); ctx.transform(ez.x - c.x, ez.y - c.y, ey.x - c.x, ey.y - c.y, c.x, c.y);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, 'rgba(14,10,8,.6)'); g.addColorStop(1, 'rgba(14,10,8,0)');
        ctx.fillStyle = g; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
      });
    } else if (o.onGround) {
      const at = pos.slice(), rr0 = 0.3 + size * 0.25;
      api.remain((ctx, a) => {
        const c = a.project([at[0], 0.002, at[2]]), r = a.cam.scale * rr0 * c.f;
        ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, 0.45);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(16,11,8,.5)'); g.addColorStop(1, 'rgba(16,11,8,0)');
        ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
      });
    }
    // the hand flinches a little (it's safe; it's just loud)
    s.hand.vy += 140 * size; s.hand.vx += 90 * size;
    if (cfg.gust) gust(s, api, pos);
    s.statText = statFor(s, pos, size, o);
  }
  function underwater(s, api) {
    // it went into the water: it can't go off. a hiss, a plop, a little steam, bubbles — phuss.
    s.burst = true; s.doneAt = s.clock; s.fuseSnd?.stop(); s.fuseSnd = null;
    const p = s.pos;
    api.Sfx.strike('blast-plop' in (api.Sfx.MODES || {}) ? 'blast-plop' : 'clay', { vol: 0.3, detune: 0.7, pan: api.panOf(p) });
    const hiss = api.Sfx.fuse({ vol: 0.05, pan: api.panOf(p) }); setTimeout(() => hiss.stop(), 900);
    api.smoke([p[0], 0.1, p[2]], 5, { size: 0.8 });
    for (let i = 0; i < (api.reduced ? 6 : 26); i++) api.spark([p[0] + rnd(-.2, .2), 0.06, p[2] + rnd(-.2, .2)], [rnd(-0.6, 0.6), rnd(1, 3), rnd(-0.6, 0.6)], { color: 'blue', life: rnd(0.3, 0.7), size: rnd(0.6, 1.1), gravity: 120 });
    s.ripples.push({ at: p.slice(), t: 0 }, { at: p.slice(), t: -0.25 });
    api.say('Phuss… paani mein!');
    s.statText = 'Paani mein gira · phuss. Bomb nahi phata';
  }
  function gust(s, api, pos) {
    s.rings.push({ at: [pos[0], 0.02, pos[2]], t: 0 });
    api.light(pos, 1.4, [255, 220, 170]);
    api.Sfx.whoosh({ vol: 0.35, dur: 0.6 });
    const q = api.project(pos);
    s.gustBits = [];
    for (let i = 0; i < (api.reduced ? 12 : 60); i++) {
      const a = rnd(0, TAU), sp = rnd(500, 1300);
      s.gustBits.push({ x: q.x + Math.cos(a) * rnd(5, 40), y: q.y + Math.sin(a) * rnd(5, 30), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, t: -rnd(0.03, 0.15), life: rnd(0.25, 0.6), w: rnd(1, 2.6) });
    }
    // the push on your face: the hand is shoved back
    later(s, 0.05, () => { s.hand.vx += 900; s.hand.vy += 500; s.hand.vr += 2.5; api.shake(10); });
  }
  function statFor(s, pos, size, o) {
    const h = pos[1] * UNIT_M, d = Math.hypot(pos[0] - s.p0[0], pos[2] - s.p0[2]) * UNIT_M;
    switch (s.how) {
      case 'toss': return s.panicked ? `Panic throw · burst at ${h.toFixed(1)} m` : (h > 0.3 ? `Burst at ${h.toFixed(1)} m` : 'Landed first · burst on the road');
      case 'thup': return `Smashed at ${s.impactV.toFixed(1)} m/s · zor ${clamp(Math.round(s.impactV / 0.85), 1, 10)}/10`;
      case 'phoonk': return `Phoonk power ${Math.round(s.power * 100)}% · bang ×${(size / 0.45).toFixed(1)}`;
      case 'potka': return s.statText;
      case 'water': {
        if (!inPond(s, pos)) return 'Missed the water · burst on the grass';
        const hw = Math.max(0, h - 0.0);
        return hw < 0.12 ? 'Burst right on the water — perfect!' : `Burst ${hw.toFixed(1)} m above the water${hw < 0.5 ? ' — perfect!' : ''}`;
      }
      case 'flick': return `Flicked ${d.toFixed(1)} m${h > 0.3 ? ', burst mid-air' : ''}`;
      case 'bowl': return `Pitched at ${(s.pitchM || 0).toFixed(1)} m · ${s.outcome || 'short and wide'}`;
      case 'drop': return s.landed ? 'Fell all the way · popped on the floor below' : `Burst ${((s.dropY - pos[1]) * UNIT_M).toFixed(1)} m into the fall`;
      case 'gust': return `Burst ${d.toFixed(1)} m away · the gust hit your face`;
    }
    return '';
  }

  // ---------- the fuski flare ----------
  function fizz(s, api, dt, f, e) {
    s.fizzT += dt;
    const pr = handSize(s, f), [ox, oy] = wickScreen(KIND.half, f.x, f.y, pr, s.rot);
    // steer with the finger if it's down, else the wrist idles
    const p = api.pointer;
    const aim = p.down && e >= 0 ? Math.atan2(p.y - oy, p.x - ox) : Math.PI + Math.sin(s.clock * 1.7) * 0.25 - 0.15;
    const life = s.fizzT < s.fizzLen ? 1 : 0;
    const k = s.fizzT < 0.2 ? s.fizzT / 0.2 : s.fizzT > s.fizzLen - 0.5 ? Math.max(0, (s.fizzLen - s.fizzT) / 0.5) : 1;
    if (life) {
      const n = Math.round((api.reduced ? 3 : 14) * k);
      for (let i = 0; i < n; i++) { const a = aim + rnd(-0.28, 0.28), sp = rnd(220, 560) * (0.6 + 0.4 * k); api.sparkScreen(ox, oy, Math.cos(a) * sp, Math.sin(a) * sp - rnd(0, 80), { color: Math.random() < 0.15 ? 'white' : 'gold', life: rnd(0.2, 0.65), size: rnd(0.7, 1.5), gravity: 520 }); }
      s.hand.vx += rnd(-1, 1) * 120 * dt; s.hand.vy += rnd(-1, 1) * 120 * dt;
      const wp = rayPoint(api.cam, ox, oy, 14);
      api.light(wp, 0.35 * k + 0.1);
    } else if (!s.fizzOut) {
      s.fizzOut = true; s.hissSnd?.stop(); s.hissSnd = null; s.doneAt = s.clock;
      api.smoke(rayPoint(api.cam, ox, oy, 14), 4, { size: 0.8 });
      api.Sfx.crack({ vol: 0.08, pieces: 1 });
      s.statText = `Hissed for ${s.fizzLen.toFixed(1)} s · no bang, all sparkle`;
    }
  }

  // ---------- the pond (#49) ----------
  function drawPond(api, s) {
    const P = s.pond, ctx = api.ctx, n = P.wob.length;
    const pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU - Math.PI, k = P.wob[i]; pts.push(api.project([P.c[0] + Math.cos(a) * P.rx * k, 0, P.c[2] + Math.sin(a) * P.rz * k])); }
    const c = api.project(P.c);
    ctx.save();
    ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath();
    ctx.strokeStyle = 'rgba(70,58,40,.9)'; ctx.lineWidth = 5; ctx.stroke();
    const g = ctx.createLinearGradient(0, Math.min(...pts.map(q => q.y)), 0, Math.max(...pts.map(q => q.y)));
    g.addColorStop(0, 'rgba(34,40,52,.96)'); g.addColorStop(1, 'rgba(14,20,28,.96)');
    ctx.fillStyle = g; ctx.fill();
    ctx.clip();
    // streetlight and fairy-light reflections, shivering
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const x = c.x + (i - 4) * (pts[n / 4 | 0].x - c.x) * 0.22, y0 = c.y - 10 + (i % 3) * 6;
      ctx.strokeStyle = i % 3 ? 'rgba(255,170,90,.22)' : 'rgba(255,230,170,.3)'; ctx.lineWidth = 2;
      for (let j = 0; j < 4; j++) { const yy = y0 + j * 7, w = 6 + Math.sin(s.clock * 3 + i + j) * 3; ctx.beginPath(); ctx.moveTo(x - w, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const r of s.ripples) {
      if (r.t < 0 || r.t > 1.6) continue;
      const q = api.project(r.at), R = 0.4 + r.t * 5, ex = api.project(v3.add(r.at, [R, 0, 0])), ez = api.project(v3.add(r.at, [0, 0, R]));
      ctx.strokeStyle = `rgba(220,230,240,${0.45 * (1 - r.t / 1.6)})`; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(q.x, q.y, Math.abs(ex.x - q.x) + 1, Math.abs(ez.y - q.y) + 1, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();
    // reflected glow of the burst on the water
    if (s.burst && s.clock - s.doneAt < 0.4) {
      const k = 1 - (s.clock - s.doneAt) / 0.4, R = Math.abs(pts[0].x - c.x);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g2 = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R);
      g2.addColorStop(0, `rgba(255,200,120,${0.4 * k})`); g2.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g2; ctx.fillRect(c.x - R, c.y - R, R * 2, R * 2); ctx.restore();
    }
  }

  // ---------- gully cricket (#52) ----------
  function bowlTick(s, api) {
    const b = s.batter, p = s.pos;
    if (s.bouncedAt && s.pitchM == null) s.pitchM = Math.hypot(s.bouncedAt[0] - s.p0[0], s.bouncedAt[2] - s.p0[2]) * UNIT_M;
    if (!s.reached && p[2] <= b.z + 1.2) {
      s.reached = true;
      const batX = b.x - 0.7, dx = p[0] - batX;
      if (Math.abs(dx) < 0.8 && p[1] < 4) {
        // connects: the bijli goes up and away over the houses, bursts there
        s.outcome = 'hit for six!'; b.swingV = 9;
        s.st = 'fly'; s.vel = [rnd(-14, -6), rnd(22, 28), rnd(-10, -4)]; s.turn = 0;
        s.fuseLeft = Math.min(s.fuseLeft, 0.8);
        api.Sfx.strike('clay', { vol: 0.5, detune: 0.7 }); api.say('Chhakka!');
      } else {
        b.swingV = 7; b.dodge = 1;
        s.outcome = Math.abs(p[0]) < 0.8 ? 'bowled him!' : 'wide, and he jumped';
      }
    }
    // the bijli reaches the brick stumps
    if (s.reached && s.outcome !== 'hit for six!' && p[2] <= -32.6 && !s.atStumps) {
      s.atStumps = true; s.vel[0] *= 0.2; s.vel[2] = Math.max(s.vel[2], -1);
      if (Math.abs(p[0]) < 0.8) { api.Sfx.strike('clay', { vol: 0.35 }); api.burst([0, 1, -33], 12, 4, { color: 'red', life: 0.4 }); }
      s.fuseLeft = Math.min(s.fuseLeft, 0.6);
    }
    // keep the batsman well clear of anything lit
    if (s.lit && !s.burst && Math.hypot(p[0] - b.x, p[2] - b.z) < 4) b.dodge = 1;
  }
  function drawCricket(api, s) {
    const b = s.batter, ctx = api.ctx;
    b.hop = (b.hop || 0) + (b.dodge - (b.hop || 0)) * 0.12;
    api.shadow([0, 0, -33], 0.5, 0);
    api.drawFaces(Mesh.place(s.stumps, M3.I(), [0, 0, -33]));
    const bx = b.x + b.hop * 3.5, by = Math.sin(Math.min(1, b.hop) * Math.PI) * 1.2;
    const feet = api.project([bx, by, b.z]), head = api.project([bx, by + 6, b.z]);
    const h = feet.y - head.y, w = h * 0.22;
    api.shadow([bx, 0, b.z], 0.8, by);
    ctx.save();
    ctx.fillStyle = '#1e1712'; ctx.strokeStyle = 'rgba(255,190,120,.28)'; ctx.lineWidth = 1;
    // legs, shorts, vest, head
    ctx.fillRect(feet.x - w * 0.42, feet.y - h * 0.45, w * 0.3, h * 0.45); ctx.fillRect(feet.x + w * 0.12, feet.y - h * 0.45, w * 0.3, h * 0.45);
    ctx.fillStyle = '#2a211a'; ctx.fillRect(feet.x - w * 0.5, feet.y - h * 0.6, w, h * 0.18);
    ctx.fillStyle = '#d8d0c0'; ctx.globalAlpha = 0.85; ctx.fillRect(feet.x - w * 0.5, feet.y - h * 0.86, w, h * 0.28); ctx.globalAlpha = 1;
    ctx.fillStyle = '#1e1712'; ctx.beginPath(); ctx.arc(feet.x, feet.y - h * 0.92, h * 0.08, 0, TAU); ctx.fill(); ctx.stroke();
    // the bat: a plank of wood
    const sw = -0.6 + Math.sin(Math.min(Math.PI, b.swing)) * 1.6, hx = feet.x - w * 0.4, hy = feet.y - h * 0.62;
    ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = Math.max(2, w * 0.25); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - Math.cos(sw) * h * 0.4, hy + Math.sin(sw) * h * 0.4); ctx.stroke();
    ctx.restore();
  }

  // ---------- memory bindings ----------
  DiwaliTricks.bind(45, 'hand-throw', { how: 'toss' }, 'lane');
  DiwaliTricks.bind(46, 'hand-throw', { how: 'thup' }, 'lane');
  DiwaliTricks.bind(47, 'hand-throw', { how: 'potka' }, 'lane');
  DiwaliTricks.bind(48, 'hand-throw', { how: 'phoonk' }, 'lane');
  DiwaliTricks.bind(49, 'hand-throw', { how: 'water' }, 'park');
  DiwaliTricks.bind(51, 'hand-throw', { how: 'flick' }, 'lane');
  DiwaliTricks.bind(52, 'hand-throw', { how: 'bowl' }, 'lane');
  DiwaliTricks.bind(53, 'hand-throw', { how: 'drop' }, 'landing');
  DiwaliTricks.bind(55, 'hand-throw', { how: 'fuski' }, 'lane');
  DiwaliTricks.bind(220, 'hand-throw', { how: 'gust' }, 'lane');
})();

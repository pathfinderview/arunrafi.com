// sparkler.js — the phuljhadi family, in first person. Your hand (the pov-hand sprite) holds a thin
// grey wire whose coated tip burns down in a dense, forking white-gold spray with a hot bead, lighting
// the doorstep. The burning point follows the pointer while it's live and sways on its own when idle.
//   'phuljhadi'      #83 name in the air · #84 circles · #85 sword fight · #86 chain down the line
//                    #87 heart-bent wire · #88 five tied together · #91 into the water bucket
//                    #93 pencil crackers · #94 both ends of the Hanuman's tail
//   'colour-matches' #95 one by one · #96 the whole box at once · #97 struck on the wall
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const now = () => performance.now();
  const host = () => (typeof window !== 'undefined' && window.Stage) || null;
  const autoOn = () => !!(host() && host().autoplay);
  const armedNow = () => !!(host() && host().phase === 'armed');
  const HAND_M = 0.28;        // the hand sprite square (D) spans ~28 cm: a kid's fist is ~1/3 of it

  // ---------- shared helpers ----------
  // world point on the camera ray through a screen pixel, d units from the eye (lights, smoke, wick)
  function rayPoint(api, x, y, d) {
    const c = api.cam, dx = (x - c.cx) / c.F, dy = -(y - c.cy) / c.F;
    const r = [0, 1, 2].map(i => c.fwd[i] + c.right[i] * dx + c.up[i] * dy), l = Math.hypot(r[0], r[1], r[2]) || 1;
    return [c.C[0] + r[0] / l * d, Math.max(0.05, c.C[1] + r[1] / l * d), c.C[2] + r[2] / l * d];
  }
  function pointerLive(api) { const p = api.pointer; return p.t > 0 && (p.down || now() - p.t < 1400); }
  const handSize = api => 0.55 * Math.min(api.W, api.H);
  function glow(ctx, x, y, r, rgb, a) {
    if (r <= 0 || a <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // teardrop flame standing upright at (x, y)
  function flame(ctx, x, y, w, h, core, mid) {
    ctx.save(); ctx.translate(x, y);
    const g = ctx.createRadialGradient(0, -h * 0.15, 0, 0, -h * 0.2, h * 0.95);
    g.addColorStop(0, `rgba(${core},0.95)`); g.addColorStop(0.35, `rgba(${mid},0.75)`); g.addColorStop(1, `rgba(${mid},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -h);
    ctx.bezierCurveTo(w * 0.9, -h * 0.45, w, w * 0.2, 0, w * 0.9);
    ctx.bezierCurveTo(-w, w * 0.2, -w * 0.9, -h * 0.45, 0, -h);
    ctx.fill(); ctx.restore();
  }

  // ---------- the hand sprite ----------
  // pov-hand.webp is 1000×1000; the wire stub leaves the fist at GRIP and points along STUB.
  const GRIP = [360, 378], STUB = Math.atan2(-8, -53), SLEEVE = [[680, 1000], [1000, 1000], [1000, 690]];
  let tinted = null;
  function handImg(api) {
    const im = api.img('pov-hand');
    if (!im || !im.complete || !im.naturalWidth) return null;
    if (!tinted) {
      try {   // evening grade: a little darker and warmer than the daylight cut-out
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
  // a hand pose h = {gx, gy, ang (wire direction on screen), D (sprite size px), m (1 right hand, -1 mirrored)}
  function toS(h, u, v) { const c = Math.cos(h.ang), s = Math.sin(h.ang); return [h.gx + (u * c - v * h.m * s) * h.D, h.gy + (u * s + v * h.m * c) * h.D]; }
  const spriteRot = h => (h.m < 0 ? Math.PI - h.ang : h.ang) - STUB;
  // push the hand down until the cut sleeve edge of the sprite is off-screen
  function fitGrip(h, W, H) {
    const r = spriteRot(h), c = Math.cos(r), s = Math.sin(r), k = h.D / 1000;
    let need = 0;
    for (const [px, py] of SLEEVE) {
      const lx = (px - GRIP[0]) * k, ly = (py - GRIP[1]) * k;
      const x = h.gx + (lx * c - ly * s) * h.m, y = h.gy + lx * s + ly * c;
      if (x > -8 && x < W + 8 && y < H + 4) need = Math.max(need, H + 4 - y);
    }
    h.gy += need;
  }
  function drawHand(ctx, api, h) {
    const im = handImg(api), k = h.D / 1000;
    ctx.save(); ctx.translate(h.gx, h.gy); if (h.m < 0) ctx.scale(-1, 1); ctx.rotate(spriteRot(h));
    sleeve(ctx, k);
    if (im) ctx.drawImage(im, -GRIP[0] * k, -GRIP[1] * k, 1000 * k, 1000 * k);
    else {      // sprite still loading: a plain fist and sleeve
      ctx.fillStyle = '#6e4a34';
      ctx.beginPath(); ctx.ellipse(150 * k, 90 * k, 160 * k, 125 * k, 0.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(180 * k, 220 * k); ctx.lineTo(420 * k, 120 * k); ctx.lineTo(700 * k, 520 * k); ctx.lineTo(420 * k, 680 * k); ctx.fill();
      ctx.fillStyle = '#cbbd9f'; ctx.beginPath(); ctx.moveTo(330 * k, 330 * k); ctx.lineTo(640 * k, 320 * k); ctx.lineTo(640 * k, 622 * k); ctx.lineTo(330 * k, 622 * k); ctx.fill();
    }
    ctx.restore();
  }

  // The sprite's kurta sleeve is cut where it meets the image's bottom and right edges; carry it on
  // past the frame along the forearm so the arm can swing anywhere without showing a cut.
  function sleeve(ctx, k) {
    const X = x => (x - GRIP[0]) * k, Y = y => (y - GRIP[1]) * k, ex = 0.604 * 2400, ey = 0.797 * 2400;
    const g = ctx.createLinearGradient(X(727), Y(1000), X(1000), Y(793));
    g.addColorStop(0, '#8a6e56'); g.addColorStop(0.5, '#987c64'); g.addColorStop(1, '#9e8670');
    ctx.fillStyle = g; ctx.beginPath();
    ctx.moveTo(X(722), Y(1004)); ctx.lineTo(X(1004), Y(1004)); ctx.lineTo(X(1004), Y(788));
    ctx.lineTo(X(1004 + ex), Y(788 + ey)); ctx.lineTo(X(722 + ex), Y(1004 + ey)); ctx.closePath(); ctx.fill();
  }

  // ---------- polylines in hand-local units (u along the wire, v across; ×D on screen) ----------
  function poly(pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cum, len: cum[cum.length - 1] };
  }
  function at(p, a) {
    a = clamp(a, 0, p.len);
    let i = 1; while (i < p.cum.length - 1 && p.cum[i] < a) i++;
    const t = (a - p.cum[i - 1]) / ((p.cum[i] - p.cum[i - 1]) || 1);
    return [lerp(p.pts[i - 1][0], p.pts[i][0], t), lerp(p.pts[i - 1][1], p.pts[i][1], t)];
  }
  function strokeRange(ctx, h, p, a, b, style, width, alpha = 1) {
    a = clamp(a, 0, p.len); b = clamp(b, 0, p.len);
    if (b - a < 1e-4 || alpha <= 0) return;
    ctx.beginPath();
    let q = toS(h, ...at(p, a)); ctx.moveTo(q[0], q[1]);
    for (let i = 0; i < p.pts.length; i++) if (p.cum[i] > a && p.cum[i] < b) { q = toS(h, p.pts[i][0], p.pts[i][1]); ctx.lineTo(q[0], q[1]); }
    q = toS(h, ...at(p, b)); ctx.lineTo(q[0], q[1]);
    ctx.globalAlpha = alpha; ctx.strokeStyle = style; ctx.lineWidth = width; ctx.stroke(); ctx.globalAlpha = 1;
  }
  function catmull(raw, per = 10) {
    const out = [];
    for (let i = 0; i < raw.length - 1; i++) {
      const p0 = raw[Math.max(0, i - 1)], p1 = raw[i], p2 = raw[i + 1], p3 = raw[Math.min(raw.length - 1, i + 2)];
      for (let j = 0; j < per; j++) {
        const t = j / per, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
      }
    }
    out.push(raw[raw.length - 1].slice());
    return poly(out);
  }

  // "DIWALI" in one unbroken sparkler stroke (a sparkler never lifts off the page), then an underline.
  const WORD = [[0.02, 0.02], [0, 0.5], [0, 1], [0.3, 0.96], [0.55, 0.74], [0.6, 0.46], [0.5, 0.2], [0.26, 0.03], [0.02, 0.02],
    [0.4, 0.08], [0.78, 0.2], [0.84, 0.98], [0.86, 0.02], [0.98, 0.5], [1.05, 1.0], [1.2, 0.02], [1.38, 0.66], [1.56, 0.02], [1.76, 1.0],
    [1.92, 0.02], [2.14, 1.0], [2.37, 0.02], [2.28, 0.4], [2.02, 0.42], [2.3, 0.6], [2.6, 1.0], [2.57, 0.06], [2.62, 0.0], [2.95, 0.03],
    [3.12, 0.98], [3.13, 0.02], [3.35, 0.12], [3.42, -0.12], [2.4, -0.24], [1.2, -0.24], [-0.1, -0.1]];
  let wordPath = null;
  const WRITE_AT = 0.7, WRITE_DUR = 6.8;

  // ---------- spark spray (screen space) ----------
  // Sparkler sparks fork: a share of them split into 3–4 tiny sparks part-way through their flight.
  function spray(s, api, f, x, y, dt, D) {
    f.acc += f.rate * dt * (api.reduced ? 0.18 : 1);
    const g = D * 1.15;
    while (f.acc >= 1) {
      f.acc -= 1;
      const a = rnd(0, TAU), sp = D * f.spd * (0.2 + 0.8 * Math.pow(Math.random(), 0.6));
      const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp - D * 0.15, life = rnd(0.07, 0.3) * f.life;
      const col = Math.random() < f.white ? 'white' : f.col;
      api.sparkScreen(x + Math.cos(a) * 2, y + Math.sin(a) * 2, vx, vy, { life, color: col, size: rnd(0.45, 1.0) * f.size, gravity: g });
      if (Math.random() < 0.28 && s.forks.length < 320) {
        const ft = life * rnd(0.4, 0.8), dr = 1 - 0.6 * ft;
        s.forks.push({ x: x + vx * ft * dr, y: y + vy * ft * dr + 0.5 * g * ft * ft, t: ft, D, col: col === 'white' ? 'white' : 'gold' });
      }
    }
  }
  function runForks(s, api, dt) {
    for (let i = s.forks.length - 1; i >= 0; i--) {
      const k = s.forks[i]; k.t -= dt;
      if (k.t > 0) continue;
      const n = api.reduced ? 1 : 3 + (Math.random() < 0.5 ? 1 : 0);
      for (let j = 0; j < n; j++) { const a = rnd(0, TAU), sp = k.D * rnd(0.2, 0.6); api.sparkScreen(k.x, k.y, Math.cos(a) * sp, Math.sin(a) * sp, { life: rnd(0.04, 0.12), color: k.col, size: rnd(0.35, 0.6), gravity: k.D * 0.8 }); }
      s.forks[i] = s.forks[s.forks.length - 1]; s.forks.pop();
    }
  }
  // persistence-of-vision trail: oldest first, drawn in age buckets as additive strokes
  function drawTrail(ctx, f, T, clock, D, warm) {
    const tr = f.trail; if (tr.length < 2) return;
    const B = 8, wide = Math.max(3, D * 0.026), core = Math.max(1.4, D * 0.0055);
    let i = 0;
    while (i < tr.length - 1) {
      const b = Math.min(B - 1, Math.floor((clock - tr[i][2]) / T * B));
      let j = i + 1;
      while (j < tr.length - 1 && Math.min(B - 1, Math.floor((clock - tr[j][2]) / T * B)) === b) j++;
      const al = Math.pow(1 - (b + 0.5) / B, 1.5);
      ctx.beginPath(); ctx.moveTo(tr[i][0], tr[i][1]); for (let k = i + 1; k <= j; k++) ctx.lineTo(tr[k][0], tr[k][1]);
      ctx.strokeStyle = `rgba(${warm},${al * 0.32})`; ctx.lineWidth = wide; ctx.stroke();
      ctx.strokeStyle = `rgba(255,240,214,${al * 0.9})`; ctx.lineWidth = core; ctx.stroke();
      i = j;
    }
  }

  // ---------- sticks and fronts ----------
  // A stick is a wire/pencil polyline; each front is a burning point travelling along it.
  function front(st, start, stop, burn, o = {}) {
    return { st, start, pos: start, stop, dir: Math.sign(stop - start), speed: Math.abs(stop - start) / burn, lit: false, out: false, cool: 0, burnt: 0,
      emit: 'spray', col: 'gold', rgb: '255,214,160', rate: 900, spd: 1.45, size: 1, life: 1, white: 0.62, trail: [], acc: 0, x: 0, y: 0, px: 0, ...o };
  }
  function straight(L, handle, burn, o, look = 'wire', angle = 0) {
    const st = { look, p: poly([[0, 0], [L * Math.cos(angle), L * Math.sin(angle)]]), handle, paper: o.paper, fronts: [] };
    st.fronts.push(front(st, st.p.len, handle, burn, o));
    return st;
  }
  function heartStick(burn) {
    const sc = 0.3 / 29, pts = [[0, 0], [0.18, 0], [0.36, 0]];
    for (let i = 1; i <= 56; i++) {
      const t = Math.PI - i / 56 * TAU, sn = Math.sin(t);
      const hx = 16 * sn * sn * sn, hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pts.push([0.36 + (hy + 17) * sc, hx * sc]);
    }
    const st = { look: 'wire', p: poly(pts), handle: 0.2, fronts: [] };
    st.fronts.push(front(st, st.p.len, 0.2, burn, {}));
    st.centre = [0.36 + 14 * sc, 0];
    return st;
  }
  function drawStick(ctx, h, st) {
    const D = h.D, p = st.p;
    if (st.look === 'wire') {
      strokeRange(ctx, h, p, 0, p.len, '#827e78', Math.max(1.1, D * 0.0042));
      for (const f of st.fronts) {
        const lo = Math.min(f.pos, f.stop), hi = Math.max(f.pos, f.stop);
        strokeRange(ctx, h, p, lo, hi, '#5d5852', Math.max(2.4, D * 0.012));
        strokeRange(ctx, h, p, lo, hi, '#a49d92', Math.max(0.8, D * 0.0035), 0.45);
        const b0 = Math.min(f.start, f.pos), b1 = Math.max(f.start, f.pos);
        strokeRange(ctx, h, p, b0, b1, '#2e2925', Math.max(1.3, D * 0.0055));
      }
    } else {      // paper pencil on a little wooden handle
      strokeRange(ctx, h, p, 0, p.len, '#c49a62', Math.max(1.6, D * 0.009));
      for (const f of st.fronts) {
        const lo = Math.min(f.pos, f.stop), hi = Math.max(f.pos, f.stop), w = Math.max(3, D * 0.021);
        strokeRange(ctx, h, p, lo, hi, st.paper, w);
        ctx.setLineDash([D * 0.01, D * 0.015]); strokeRange(ctx, h, p, lo, hi, '#f3e6c4', w, 0.5); ctx.setLineDash([]);
        const b0 = Math.min(f.start, f.pos), b1 = Math.max(f.start, f.pos);
        strokeRange(ctx, h, p, b0, b1, '#57524d', Math.max(2, D * 0.014));
      }
    }
    // the hot end of the burnt wire behind each front
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const f of st.fronts) {
      const heat = f.lit ? 1 : f.cool; if (heat <= 0.01) continue;
      const back = -f.dir, w = Math.max(1.4, D * 0.006);
      strokeRange(ctx, h, p, Math.min(f.pos, f.pos + back * 0.035), Math.max(f.pos, f.pos + back * 0.035), '#ffd890', w, heat);
      strokeRange(ctx, h, p, Math.min(f.pos, f.pos + back * 0.1), Math.max(f.pos, f.pos + back * 0.1), '#ff6a24', w, 0.6 * heat);
      strokeRange(ctx, h, p, Math.min(f.pos, f.pos + back * 0.2), Math.max(f.pos, f.pos + back * 0.2), '#8a2a10', w, 0.45 * heat);
    }
    ctx.restore();
  }

  // An actor is one hand + its sticks: you, your cousin, or a kid down the line.
  function actor(o) { return { h: { gx: 0, gy: 0, ang: o.ang, D: 1, m: o.m || 1 }, base: o.ang, scale: o.scale || 1, sticks: o.sticks, ctrl: o.ctrl || 'front', tx: null, ty: null, vx: 0, lean: 0, extra: 0, off: [0, 0], ...o.extra }; }
  const mainFront = a => a.sticks[a.mainStick || 0].fronts[0];
  function ctrlLocal(a) {
    if (Array.isArray(a.ctrl)) return a.ctrl;
    const f = mainFront(a);
    return at(f.st.p, a.ctrl === 'end' ? f.st.p.len : f.pos);
  }
  // First person: the hand stays in its corner of the frame (grip ~66% across, ~75% down; mirrored
  // for a left hand) and the wire swings to point at the target, the hand sliding only as far as it must.
  const RIGHT_RANGE = [-3.05, -1.2], LEFT_RANGE = [-1.94, -0.09];
  function clampAng(a, [lo, hi]) { if (a >= lo && a <= hi) return a; return Math.abs(wrap(a - lo)) < Math.abs(wrap(a - hi)) ? lo : hi; }
  function pose(a, W, H, D, tx, ty) {
    const h = a.h; h.D = D * a.scale;
    const [u, v] = ctrlLocal(a);
    if (a.fp) {
      const [axf, ayf] = a.anchor || (h.m > 0 ? [0.66, 0.75] : [0.34, 0.75]), R = a.region || (h.m > 0 ? [0.4, 0.92, 0.6, 0.92] : [0.08, 0.6, 0.6, 0.92]);
      let ang = a.base;
      if (u > 0.08) { ang = Math.atan2(ty - ayf * H, tx - axf * W) - Math.atan2(v * h.m, u); if (!a.free) ang = clampAng(ang, h.m > 0 ? RIGHT_RANGE : LEFT_RANGE); }
      h.ang = ang + a.lean * 0.6 + a.extra;
      const c = Math.cos(h.ang), s = Math.sin(h.ang);
      h.gx = clamp(tx - (u * c - v * h.m * s) * h.D, R[0] * W, R[1] * W);
      h.gy = clamp(ty - (u * s + v * h.m * c) * h.D, R[2] * H, R[3] * H);
      return;
    }
    h.ang = a.base + a.lean + a.extra;
    const c = Math.cos(h.ang), s = Math.sin(h.ang);
    h.gx = tx - (u * c - v * h.m * s) * h.D + a.off[0]; h.gy = ty - (u * s + v * h.m * c) * h.D + a.off[1];
    fitGrip(h, W, H);
  }
  function follow(a, tx, ty, dt, rate) {
    if (a.tx == null) { a.tx = tx; a.ty = ty; }
    const k = 1 - Math.exp(-dt * rate), px = a.tx;
    a.tx += (tx - a.tx) * k; a.ty += (ty - a.ty) * k;
    a.vx = lerp(a.vx, (a.tx - px) / Math.max(dt, 1e-3), 1 - Math.exp(-dt * 8));
    a.lean = lerp(a.lean, clamp(-a.vx / (a.h.D * 7 || 1), -0.32, 0.32), 1 - Math.exp(-dt * 10));
  }
  // burn every lit front: move it, emit, keep its trail
  function burn(s, api, a, dt, T) {
    const D = a.h.D;
    for (const st of a.sticks) for (const f of st.fronts) {
      const [x, y] = toS(a.h, ...at(st.p, f.pos));
      if (f.lit) {
        f.pos += f.dir * f.speed * dt * (0.85 + 0.3 * Math.random()); f.burnt += dt;
        if ((f.stop - f.pos) * f.dir <= 0) { f.pos = f.stop; f.lit = false; f.out = true; f.cool = 1; }
        if (f.emit === 'spray') spray(s, api, f, x, y, dt, D);
        else {       // coloured flame: drips of coloured sparks, a little crackle, a lot of smoke
          spray(s, api, f, x, y - D * 0.02, dt, D);
          f.smokeT = (f.smokeT || 0) - dt;
          if (f.smokeT <= 0) { f.smokeT = 0.12; api.smoke(rayPoint(api, x, y - D * 0.06, 5), 1, { size: 0.45 }); }
        }
        if (f.trail.length) f.px += Math.hypot(x - f.x, y - f.y);
        f.trail.push([x, y, s.clock]);
      } else if (f.cool > 0) f.cool = Math.max(0, f.cool - dt * 0.9);
      while (f.trail.length && s.clock - f.trail[0][2] > T) f.trail.shift();
      f.x = x; f.y = y;
    }
  }
  function litFronts(a) { let n = 0; for (const st of a.sticks) for (const f of st.fronts) if (f.lit) n++; return n; }
  function drawGlows(ctx, s, a, t) {
    const D = a.h.D;
    for (const st of a.sticks) for (const f of st.fronts) {
      if (!f.lit) { if (f.cool > 0) glow(ctx, f.x, f.y, D * 0.025, '255,110,40', f.cool * 0.6); continue; }
      const fl = 0.8 + 0.4 * Math.sin(t * 53 + f.start * 40) * Math.sin(t * 31);
      if (f.emit === 'spray') {
        glow(ctx, f.x, f.y, D * 0.2 * f.size, '255,170,80', 0.2 * fl);
        glow(ctx, f.x, f.y, D * 0.05 * f.size, '255,222,160', 0.75);
        glow(ctx, f.x, f.y, D * 0.014 * f.size, '255,255,240', 1);
      } else {
        glow(ctx, f.x, f.y, D * 0.22, f.rgb, 0.22 * fl);
        flame(ctx, f.x, f.y, D * 0.028 * f.size, D * 0.1 * f.size * (0.85 + 0.3 * fl), f.core, f.rgb);
      }
    }
  }

  // ---------- the phuljhadi trick ----------
  const KINDS = {
    name:    { burn: 10, trail: 3.0, rest: [0.5, 0.42], line: 'Phuljhadi se naam likha, sirf humein dikha' },
    circles: { burn: 10, trail: 0.55, rest: [0.48, 0.42], line: 'Gol gol ghumao, aag ka chakkar' },
    sword:   { burn: 10, trail: 0.22, rest: [0.52, 0.4], line: 'Dhishoom! Mummy ne dono ko daanta' },
    chain:   { burn: 11, trail: 0.2, rest: [0.48, 0.38], line: 'Ek se doosri, poori line jal gayi' },
    heart:   { burn: 10, trail: 1.6, rest: [0.5, 0.42], line: 'Dil wali phuljhadi, Didi ke liye' },
    mega:    { burn: 8, trail: 0.3, rest: [0.5, 0.4], line: 'Paanch ek saath: mega phuljhadi!' },
    bucket:  { burn: 7, trail: 0.25, rest: [0.5, 0.42], line: 'Tsssss. Sabse satisfying awaaz' },
    pencil:  { burn: 4.2, trail: 0.12, rest: [0.54, 0.5], line: 'Bomb se darr, pencil se pyaar' },
    tail:    { burn: 7, trail: 0.15, rest: [0.62, 0.72], line: 'Dono taraf se jali, Hanuman ki poonch' },
  };
  const UP_LEFT = -2.27, UP_RIGHT = -0.87;     // ~130° and ~50° above horizontal
  const PENCILS = { red: { paper: '#c3302b', col: 'red', rgb: '255,70,50', core: '255,232,210' }, green: { paper: '#2c9446', col: 'green', rgb: '90,255,120', core: '235,255,225' } };
  function pencil(which, burn) {
    const P = PENCILS[which];
    return straight(0.6, 0.18, burn, { emit: 'flame', col: P.col, rgb: P.rgb, core: P.core, paper: P.paper, rate: 140, spd: 0.55, life: 1.3, white: 0.1, size: 1 }, 'pencil');
  }

  DiwaliTricks.register({
    id: 'phuljhadi',
    name: 'Phuljhadi',
    compendium: [83, 84, 85, 86, 87, 88, 91, 93, 94],
    mode: 'hand',
    views: ['doorstep', 'lane', 'courtyard'],
    fuse: 1.0,
    options: [{ key: 'kind', label: 'Play', choices: Object.keys(KINDS).map(k => [k, k]), default: 'name' }],
    spentLine: KINDS.name.line,

    create(api, opts) {
      const kind = KINDS[opts.kind] ? opts.kind : 'name', K = KINDS[kind];
      this.spentLine = K.line;
      const s = { kind, K, clock: 0, D: handSize(api), forks: [], lit: false, after: 0, others: [], usedPointer: false };
      let sticks, ctrl = 'front', mainStick = 0, ang = UP_LEFT;
      if (kind === 'heart') { const st = heartStick(K.burn); sticks = [st]; ctrl = st.centre; ang = -1.95; }
      else if (kind === 'mega') { sticks = [-0.075, -0.037, 0, 0.037, 0.075].map(d => straight(0.85 + rnd(-0.03, 0.03), 0.26, K.burn * rnd(0.93, 1.07), { rate: 520, spd: 1.6, size: 1.15 }, 'wire', d)); mainStick = 2; }
      else if (kind === 'pencil') { sticks = [pencil('red', K.burn)]; s.queue = ['green']; s.times = []; }
      else if (kind === 'tail') {
        const st = { look: 'pencil', paper: '#d9861e', p: poly([[-0.6, 0], [0.6, 0]]), fronts: [] };
        const o = { emit: 'flame', col: 'gold', rgb: '255,160,50', core: '255,236,190', rate: 260, spd: 0.75, white: 0.3, size: 0.95 };
        st.fronts.push(front(st, 0, 0.5, K.burn, o), front(st, 1.2, 0.7, K.burn * 1.04, o));
        sticks = [st]; ctrl = [0, 0]; ang = -2.62;
      } else sticks = [straight(0.85, 0.26, K.burn, {})];
      s.me = actor({ ang, sticks, ctrl, extra: { mainStick, fp: true } });
      if (kind === 'sword') {
        s.cousin = actor({ ang: UP_RIGHT, m: -1, scale: 0.92, sticks: [straight(0.85, 0.26, K.burn * 1.05, { rate: 520 })], extra: { mode: 'idle', t: 0, next: 1.2, aim: [0, 0], fp: true, anchor: [0.3, 0.76] } });
        s.others.push(s.cousin); s.clashes = 0; s.clashCool = 0;
      }
      if (kind === 'chain') {
        s.kids = [0.5, 0.39, 0.28, 0.17, 0.06].map((xf, i) => actor({ ang: i % 2 ? UP_LEFT : UP_RIGHT, m: i % 2 ? 1 : -1, scale: 0.72,
          sticks: [straight(0.85, 0.26, 8 * rnd(0.95, 1.05), { rate: 380, size: 0.8 })], extra: { xf, yo: [0, 0.03, -0.01, 0.045, 0.015][i], dip: 0, tLit: null } }));
        s.others.push(...s.kids); s.step = 0; s.touch = 0; s.wait = 0; s.lit5 = 0;
      }
      if (kind === 'bucket') { s.wires = 6; s.oldWires = Array.from({ length: 6 }, () => [rnd(-0.45, 0.45), rnd(-0.4, 0.3), rnd(-0.5, 0.5), rnd(0.5, 0.9)]); s.ripples = []; }
      if (kind === 'circles') { s.spin = 0; s.turn = 0; s.circles = 0; s.cx = null; }
      return s;
    },

    wick(s, api) { restPose(s, api); const f = mainFront(s.me); return rayPoint(api, f.x, f.y, 5); },

    ignite(s, api) {
      s.lit = true;
      const me = s.me;
      for (const st of me.sticks) for (const f of st.fronts) f.lit = true;
      if (s.cousin) for (const st of s.cousin.sticks) for (const f of st.fronts) f.lit = true;
      const f = mainFront(me);
      s.hiss = api.Sfx.fuse({ vol: s.kind === 'mega' ? 0.07 : 0.035, pan: api.panOf(rayPoint(api, f.x, f.y, 5)) });
      api.Sfx.crack({ vol: 0.2, pieces: 2 });
    },

    update(s, api, dt, e) {
      const W = api.W, H = api.H, D = s.D = handSize(api), P = api.pointer, me = s.me, K = s.K;
      s.clock += dt;
      const live = pointerLive(api);
      if (live) s.usedPointer = true;
      let [tx, ty] = drive(s, api, e, dt, live);
      follow(me, tx, ty, dt, s.kind === 'name' && !live ? 30 : s.kind === 'circles' && !live ? 40 : 22);
      // bucket: after the wire goes out, swing it tip-down for the dunk
      if (s.kind === 'bucket' && s.dunking) { me.free = true; me.anchor = [0.56, 0.32]; me.region = [0.3, 0.98, 0.3, 0.95]; }
      pose(me, W, H, D, me.tx, me.ty);
      burn(s, api, me, dt, K.trail);
      const f = mainFront(me);
      if (s.kind === 'circles' && f.lit) countCircles(s, f, dt, Math.min(W, H));
      if (s.kind === 'sword') swordUpdate(s, api, dt, e);
      if (s.kind === 'chain') chainUpdate(s, api, dt, e);
      if (s.kind === 'pencil' && !litFronts(me) && s.queue.length) {
        if (!s.swap) s.times.push(f.burnt);
        s.swap = (s.swap || 0) + dt;
        if (s.swap > 0.5) {      // second pencil, lit from the first one's last flicker
          s.swap = 0; me.sticks = [pencil(s.queue.shift(), K.burn)];
          const g = mainFront(me); g.lit = true;
          api.Sfx.crack({ vol: 0.25, pieces: 2 }); api.Sfx.whoosh({ vol: 0.06, dur: 0.3 });
        }
      }
      runForks(s, api, dt);
      // light on the scene from the brightest burning point
      let best = null;
      for (const a of [me, ...s.others]) for (const st of a.sticks) for (const g of st.fronts) if (g.lit && (!best || a === me)) best = g;
      if (best) {
        const fl = 0.85 + 0.3 * Math.random(), rgb = best.emit === 'flame' ? best.rgb.split(',').map(Number) : [255, 212, 158];
        api.light(rayPoint(api, best.x, best.y, 7), (s.kind === 'mega' ? 1.0 : 0.6) * fl, rgb);
      }
      const anyLit = [me, ...s.others].some(litFronts);
      if (!anyLit && s.hiss && !(s.kind === 'pencil' && s.queue.length)) { s.hiss.stop(); s.hiss = null; }
      if (s.kind === 'bucket') return bucketUpdate(s, api, dt, e, live);
      if (s.kind === 'pencil' && s.queue.length) return e > 30;
      if (s.kind === 'chain' && s.step < 5 && e < 30) return false;
      if (!anyLit) s.after += dt;
      return s.after > 1.0 || e > 40;
    },

    stop(s) { s.hiss?.stop(); s.hiss = null; s.steam?.stop(); s.steam = null; },

    draw(s, api) {
      const ctx = api.ctx, me = s.me, t = s.clock;
      if (!s.lit) restPose(s, api);
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // trails first (they hang in the air behind everything you hold)
      ctx.globalCompositeOperation = 'lighter';
      for (const a of [me, ...s.others]) for (const st of a.sticks) for (const f of st.fronts) drawTrail(ctx, f, s.K.trail, s.clock, a.h.D, f.emit === 'flame' ? f.rgb : '255,150,60');
      ctx.globalCompositeOperation = 'source-over';
      for (const a of s.others) { for (const st of a.sticks) drawStick(ctx, a.h, st); drawHand(ctx, api, a.h); }
      if (s.kind === 'bucket') drawBucket(s, api, 'back');
      for (const st of me.sticks) drawStick(ctx, me.h, st);
      if (s.kind === 'mega') { const [x, y] = toS(me.h, 0.17, 0); ctx.fillStyle = '#9a958c'; ctx.beginPath(); ctx.ellipse(x, y, me.h.D * 0.02, me.h.D * 0.008, me.h.ang + Math.PI / 2, 0, TAU); ctx.fill(); }
      if (s.kind === 'bucket') drawBucket(s, api, 'front');
      drawHand(ctx, api, me.h);
      ctx.globalCompositeOperation = 'lighter';
      for (const a of s.others) drawGlows(ctx, s, a, t);
      drawGlows(ctx, s, me, t);
      if (s.kind === 'sword' && s.flash > 0) glow(ctx, s.fx, s.fy, me.h.D * 0.3, '255,236,200', s.flash);
      ctx.restore();
    },

    stat(s) {
      const f = mainFront(s.me), m = v => (v / s.D * HAND_M).toFixed(1);
      switch (s.kind) {
        case 'name': { const px = f.px; return px < 5 ? '' : (!s.usedPointer && s.wrote ? `Wrote DIWALI · ${m(px)} m of light` : `${m(px)} m of light in the air`); }
        case 'circles': return `${s.circles} circles of fire`;
        case 'sword': return `${s.clashes} clash${s.clashes === 1 ? '' : 'es'}`;
        case 'chain': return `${s.lit5} of 5 lit · ${(s.chainT || 0).toFixed(1)} s down the line`;
        case 'heart': return f.burnt ? `Heart traced in ${f.burnt.toFixed(1)} s` : '';
        case 'mega': return f.burnt ? `5 wires · ${f.burnt.toFixed(1)} s of mega spray` : '';
        case 'bucket': return s.dunked ? `Tsss! ${s.wires} wires in the bucket` : '';
        case 'pencil': return s.times.length ? `Red ${s.times[0].toFixed(1)} s · green ${f.burnt.toFixed(1)} s` : '';
        case 'tail': return f.burnt ? `Two flames · ${f.burnt.toFixed(1)} s` : '';
      }
      return '';
    },
  });

  // before lighting: hold it out and sway a little (draw runs without update until it's live)
  function restPose(s, api) {
    s.D = handSize(api);
    const t = now() / 1000, [rx, ry] = s.K.rest;
    const tx = rx * api.W + Math.sin(t * 1.1) * 0.02 * api.W, ty = ry * api.H + Math.sin(t * 0.8 + 1) * 0.015 * api.H;
    s.me.tx = tx; s.me.ty = ty;
    pose(s.me, api.W, api.H, s.D, tx, ty);
    for (const st of s.me.sticks) for (const f of st.fronts) [f.x, f.y] = toS(s.me.h, ...at(st.p, f.pos));
    if (s.cousin) { const c = s.cousin; pose(c, api.W, api.H, s.D, 0.42 * api.W, 0.4 * api.H); for (const st of c.sticks) for (const f of st.fronts) [f.x, f.y] = toS(c.h, ...at(st.p, f.pos)); }
    if (s.kids) for (const k of s.kids) kidPose(s, api, k);
  }
  function sway(s, api, rx, ry, amp = 1) {
    const t = s.clock, W = api.W, H = api.H;
    return [rx * W + amp * (Math.sin(t * 1.1) * 0.035 * W + Math.sin(t * 2.7 + 1) * 0.012 * W), ry * H + amp * (Math.sin(t * 0.83 + 2) * 0.03 * H + Math.sin(t * 3.3) * 0.01 * H)];
  }
  // where the burning point wants to be this frame
  function drive(s, api, e, dt, live) {
    const P = api.pointer, W = api.W, H = api.H, [rx, ry] = s.K.rest;
    if (s.kind === 'bucket' && s.dunking && (!live || s.autoDunk)) return s.waterAt || [W * 0.3, H * 0.75];
    if (live) return [P.x, P.y];
    switch (s.kind) {
      case 'name': {
        wordPath ??= catmull(WORD, 8);
        const hgt = Math.min(0.21 * H, 0.84 * W / 3.5), x0 = W / 2 - 1.68 * hgt, base = 0.47 * H + 0.5 * hgt;
        const k = clamp((e - WRITE_AT) / WRITE_DUR, 0, 1);
        if (k >= 1) s.wrote = true;
        if (k >= 1) { const [x, y] = sway(s, api, 0, 0, 0.4); return [x + x0 - 0.1 * hgt, y + base + 0.1 * hgt]; }
        const [u, v] = at(wordPath, k * wordPath.len);
        return [x0 + u * hgt + v * 0.18 * hgt, base - v * hgt];
      }
      case 'circles': {
        s.spin += dt * lerp(4.5, 13.5, clamp(e / 3, 0, 1));
        const R = 0.13 * Math.min(W, H);
        return [0.47 * W + Math.cos(s.spin) * R, 0.4 * H + Math.sin(s.spin) * R * 0.92];
      }
      case 'sword': {
        const c = s.cousin, cf = mainFront(c);
        if (c.mode === 'jab' || c.mode === 'back') return [cf.x + s.D * 0.05, cf.y - s.D * 0.02];
        return sway(s, api, rx, ry);
      }
      case 'chain': {
        if (s.step === 0 && e > 0.6) { const k = s.kids[0], kf = mainFront(k); return [kf.x + s.D * 0.02, kf.y]; }
        return sway(s, api, rx, ry, 0.6);
      }
      case 'heart': return sway(s, api, rx, ry, 0.35);
      case 'tail': return sway(s, api, rx, ry, 0.6);
    }
    return sway(s, api, rx, ry);
  }
  function countCircles(s, f, dt, minWH) {
    if (s.cx == null) { s.cx = f.x; s.cy = f.y; }
    const k = 1 - Math.exp(-dt * 2.5);
    s.cx += (f.x - s.cx) * k; s.cy += (f.y - s.cy) * k;
    const a = Math.atan2(f.y - s.cy, f.x - s.cx), r = Math.hypot(f.x - s.cx, f.y - s.cy);
    if (s.prevA != null && r > 0.025 * minWH) s.turn += wrap(a - s.prevA);
    s.prevA = a;
    s.circles = Math.max(s.circles, Math.floor(Math.abs(s.turn) / TAU));
  }

  // #85 — the cousin's sparkler jabs in from the left; tips meeting throw a shower of extra sparks
  function swordUpdate(s, api, dt, e) {
    const c = s.cousin, W = api.W, H = api.H, mf = mainFront(s.me);
    c.t += dt;
    let tx, ty, rate = 6;
    const idle = [0.3 * W + Math.sin(s.clock * 1.3 + 2) * 0.05 * W, 0.46 * H + Math.sin(s.clock * 0.9) * 0.05 * H];
    if (c.mode === 'idle') { [tx, ty] = idle; if (c.t > c.next) { c.mode = 'jab'; c.t = 0; c.aim = [mf.x + rnd(-0.03, 0.03) * s.D, mf.y + rnd(-0.04, 0.03) * s.D]; } }
    else if (c.mode === 'jab') { [tx, ty] = c.aim; rate = 15; if (c.t > 0.35) { c.mode = 'back'; c.t = 0; } }
    else { [tx, ty] = idle; rate = 7; if (c.t > 0.45) { c.mode = 'idle'; c.t = 0; c.next = rnd(0.5, 1.2); } }
    follow(c, tx, ty, dt, rate);
    pose(c, W, H, s.D, c.tx, c.ty);
    burn(s, api, c, dt, s.K.trail);
    s.clashCool -= dt; s.flash = Math.max(0, (s.flash || 0) - dt * 4);
    const cf = mainFront(c);
    if (cf.lit && mf.lit && s.clashCool <= 0 && Math.hypot(cf.x - mf.x, cf.y - mf.y) < s.D * 0.065) {
      s.clashCool = 0.3; s.clashes++; s.flash = 0.8; s.fx = (cf.x + mf.x) / 2; s.fy = (cf.y + mf.y) / 2;
      const n = api.reduced ? 12 : 70;
      for (let i = 0; i < n; i++) { const a = rnd(0, TAU), sp = s.D * rnd(0.6, 2.4); api.sparkScreen(s.fx, s.fy, Math.cos(a) * sp, Math.sin(a) * sp - s.D * 0.3, { life: rnd(0.12, 0.45), color: Math.random() < 0.5 ? 'white' : 'gold', size: rnd(0.6, 1.3), gravity: s.D * 1.3 }); }
      const p = rayPoint(api, s.fx, s.fy, 5);
      api.light(p, 1.1, [255, 230, 190]);
      api.Sfx.crack({ vol: 0.3, pieces: 3, pan: api.panOf(p) });
      api.Sfx.strike('steel', { vol: 0.08, pan: api.panOf(p), detune: rnd(0.9, 1.1) });
      api.shake(1.5);
      if (s.clashes === 1) api.say('Dhishoom!', 1300);
      else if (s.clashes % 5 === 0) api.say('Dhishoom dhishoom!', 1300);
    }
  }

  // #86 — five kids in a row; each unlit sparkler leans into the burning one beside it
  function kidPose(s, api, k) {
    const W = api.W, H = api.H, h = k.h;
    h.D = s.D * k.scale; h.ang = k.base + k.lean;
    h.gx = k.xf * W; h.gy = 0; fitGrip(h, W, H); h.gy += k.yo * H;
    h.gx += k.off[0]; h.gy += k.off[1];
    for (const st of k.sticks) for (const f of st.fronts) [f.x, f.y] = toS(h, ...at(st.p, f.pos));
  }
  function chainUpdate(s, api, dt, e) {
    const kids = s.kids, mf = mainFront(s.me);
    if (s.step < 5) s.chainT = e;
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i], kf = mainFront(k);
      k.lean = Math.sin(s.clock * (0.9 + i * 0.13) + i) * 0.05;
      if (i === s.step && e > 0.4) {
        // lean in: move this hand so its unlit tip reaches the burning one
        const src = s.step === 0 ? mf : mainFront(kids[s.step - 1]);
        k.dip = Math.min(1, k.dip + dt * 1.6);
        const baseX = kf.x - k.off[0], baseY = kf.y - k.off[1];
        const want = [(src.x - baseX) * 0.98, (src.y - baseY) * 0.98];
        k.off[0] = lerp(k.off[0], want[0] * k.dip, 1 - Math.exp(-dt * 5)); k.off[1] = lerp(k.off[1], want[1] * k.dip, 1 - Math.exp(-dt * 5));
        if (src.lit && Math.hypot(src.x - kf.x, src.y - kf.y) < s.D * 0.055) s.touch += dt;
        if (s.touch > 0.45) {
          kf.lit = true; k.tLit = e; s.touch = 0; s.step++; s.lit5++;
          const p = rayPoint(api, kf.x, kf.y, 5);
          for (let j = 0; j < (api.reduced ? 8 : 50); j++) { const a = rnd(0, TAU), sp = s.D * rnd(0.3, 1.4); api.sparkScreen(kf.x, kf.y, Math.cos(a) * sp, Math.sin(a) * sp, { life: rnd(0.1, 0.35), color: 'white', size: rnd(0.5, 1), gravity: s.D }); }
          api.Sfx.crack({ vol: 0.22, pieces: 2, pan: api.panOf(p) });
          api.light(p, 0.9, [255, 220, 170]);
        }
      } else {
        k.dip = Math.max(0, k.dip - dt * 2);
        const r = 1 - Math.exp(-dt * 4); k.off[0] = lerp(k.off[0], 0, r); k.off[1] = lerp(k.off[1], 0, r);
      }
      kidPose(s, api, k);
      burn(s, api, k, dt, s.K.trail);
    }
  }

  // #91 — a steel-blue bucket of water on the floor, already bristling with black wires
  function bucketWorld(s, api) {
    const g = api.unproject(api.W * 0.27, api.H * 0.93) || [-1, 0, 3];
    return [g[0], 0, g[2]];
  }
  const BUCKET_R = 0.72, BUCKET_H = 1.35, WATER = 1.08;
  let bucketMesh = null;
  function bucketFaces(front) {
    bucketMesh ??= {
      all: Mesh.cylinder(BUCKET_R, BUCKET_H, { segs: 22, bands: 2, top: false, bottom: false, inner: [44, 64, 92], colourAt: (sg, b) => b === 1 ? [70, 104, 150] : [60, 92, 138] }).faces,
      front: Mesh.cylinder(BUCKET_R, BUCKET_H, { segs: 22, bands: 2, top: false, bottom: false, colourAt: (sg, b) => b === 1 ? [70, 104, 150] : [60, 92, 138] }).faces,
    };
    return front ? bucketMesh.front : bucketMesh.all;
  }
  function drawBucket(s, api, layer) {
    const ctx = api.ctx, B = s.bucketAt || bucketWorld(s, api), I = Phys.M3.I(), c = [B[0], BUCKET_H / 2, B[2]];
    if (layer === 'back') {
      api.shadow(B, BUCKET_R * 1.15, 0);
      api.drawFaces(Mesh.place(bucketFaces(false), I, c));
      // water surface
      const w = api.project([B[0], WATER, B[2]]), wx = api.project([B[0] + BUCKET_R * 0.97, WATER, B[2]]), wz = api.project([B[0], WATER, B[2] + BUCKET_R * 0.97]);
      const rx = Math.abs(wx.x - w.x), ry = Math.max(2, Math.abs(wz.y - w.y));
      ctx.save(); ctx.fillStyle = '#1d2a36'; ctx.beginPath(); ctx.ellipse(w.x, w.y, rx, ry, 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      const lt = s.me && mainFront(s.me); if (lt && (lt.lit || lt.cool > 0)) glow(ctx, w.x - rx * 0.2, w.y - ry * 0.2, rx * 0.5, '255,180,90', 0.25);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(190,210,230,.35)'; ctx.lineWidth = 1;
      for (const r of s.ripples) { ctx.globalAlpha = Math.max(0, 1 - r.t / 1.4); ctx.beginPath(); ctx.ellipse(w.x + r.dx * rx, w.y + r.dy * ry, rx * r.t * 0.6, ry * r.t * 0.6, 0, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1;
      // yesterday's wires
      ctx.strokeStyle = '#2a2420'; ctx.lineWidth = Math.max(1, s.D * 0.004);
      for (const [dx, dz, lean, len] of s.oldWires) {
        const a = api.project([B[0] + dx * BUCKET_R * 0.7, WATER, B[2] + dz * BUCKET_R * 0.7]), b = api.project([B[0] + dx * BUCKET_R * 0.7 + lean * 0.5, WATER + len * 2.6, B[2] + dz * BUCKET_R * 0.7]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.restore();
      s.waterAt = [w.x, w.y + ry * 0.2]; s.waterR = [rx, ry];
    } else {
      api.drawFaces(Mesh.place(bucketFaces(true), I, c));
      // rim highlight
      const r0 = api.project([B[0], BUCKET_H, B[2]]), r1 = api.project([B[0] + BUCKET_R, BUCKET_H, B[2]]), r2 = api.project([B[0], BUCKET_H, B[2] + BUCKET_R]);
      ctx.strokeStyle = 'rgba(150,180,215,.8)'; ctx.lineWidth = Math.max(1.5, s.D * 0.006);
      ctx.beginPath(); ctx.ellipse(r0.x, r0.y, Math.abs(r1.x - r0.x), Math.max(2, Math.abs(r2.y - r0.y)), 0, 0, Math.PI); ctx.stroke();
    }
  }
  function bucketUpdate(s, api, dt, e, live) {
    const f = mainFront(s.me);
    for (const r of s.ripples) r.t += dt;
    if (s.steam) { s.steamT -= dt; if (s.steamT <= 0) { s.steam.stop(); s.steam = null; } }
    if (!s.dunking && f.out) {     // re-anchor on the wire's end so the hand doesn't jump
      const [ex, ey] = toS(s.me.h, ...at(f.st.p, f.st.p.len));
      s.dunking = true; s.me.ctrl = 'end'; s.dunkT = 0; s.me.tx = ex; s.me.ty = ey;
    }
    if (s.dunking && !s.dunked) {
      s.dunkT += dt;
      if (!live || s.dunkT > 4) s.autoDunk = true;
      const [x, y] = toS(s.me.h, ...at(f.st.p, f.st.p.len)), [wx, wy] = s.waterAt || [0, 0], [rx, ry] = s.waterR || [1, 1];
      if (s.dunkT > 0.6 && Math.abs(x - wx) < rx * 0.8 && y > wy - ry * 0.6) {
        s.dunked = e; s.wires++; s.bucketAt = bucketWorld(s, api); f.cool = 0;
        const p = [s.bucketAt[0], WATER, s.bucketAt[2]];
        api.smoke(p, api.reduced ? 4 : 16, { size: 1.1 });
        s.steam = api.Sfx.fuse({ vol: 0.16, pan: api.panOf(p) }); s.steamT = 0.9;
        api.Sfx.whoosh({ vol: 0.06, dur: 0.8, pan: api.panOf(p) });
        for (let i = 0; i < 3; i++) s.ripples.push({ t: -i * 0.18, dx: (x - wx) / rx * 0.6, dy: 0 });
        s.oldWires.push([(x - wx) / rx * 0.8, 0, -0.3, 0.75]);
      }
    }
    if (s.dunked != null) return e - s.dunked > 1.8;
    return e > 40;
  }

  // Memories (compendium numbers) for the phuljhadi trick.
  DiwaliTricks.bind(83, 'phuljhadi', { kind: 'name' }, 'doorstep');
  DiwaliTricks.bind(84, 'phuljhadi', { kind: 'circles' }, 'doorstep');
  DiwaliTricks.bind(85, 'phuljhadi', { kind: 'sword' }, 'doorstep');
  DiwaliTricks.bind(86, 'phuljhadi', { kind: 'chain' }, 'doorstep');
  DiwaliTricks.bind(87, 'phuljhadi', { kind: 'heart' }, 'doorstep');
  DiwaliTricks.bind(88, 'phuljhadi', { kind: 'mega' }, 'doorstep');
  DiwaliTricks.bind(91, 'phuljhadi', { kind: 'bucket' }, 'doorstep');
  DiwaliTricks.bind(93, 'phuljhadi', { kind: 'pencil' }, 'doorstep');
  DiwaliTricks.bind(94, 'phuljhadi', { kind: 'tail' }, 'doorstep');

  // ======================================================================================
  // Colour matchbox: a generic rainbow-label box on the floor; your hand holds a matchstick.
  // Tap to strike on the box (#95 one by one, #96 the whole box at once); drag the head along
  // the wall to strike it there (#97), leaving coloured streaks.
  // ======================================================================================
  const COLOURS = [
    { col: 'red', rgb: '255,70,60', core: '255,225,215', head: '#d4302a' },
    { col: 'green', rgb: '90,255,110', core: '230,255,225', head: '#2f9d44' },
    { col: 'blue', rgb: '110,150,255', core: '225,235,255', head: '#2f5fc4' },
    { col: 'gold', rgb: '255,220,60', core: '255,250,215', head: '#e0b52a' },
    { col: 'rose', rgb: '255,120,210', core: '255,230,245', head: '#d0489a' },
  ];
  const MKINDS = {
    one:  { count: 10, line: 'Sabse chhota maachis jalayega, yahi rule tha' },
    all:  { count: 1, line: 'Poori dibbi, ek hi whoosh' },
    wall: { count: 8, line: 'Deewar pe rang-birangi lakeerein' },
  };
  const STICK_L = 0.2;

  function newMatch(s) {
    const C = COLOURS[s.struck % COLOURS.length];
    return { C, state: 'held', t: 0, burn: 0, heads: s.kind === 'all' ? Array.from({ length: 30 }, (_, i) => ({ C: COLOURS[i % COLOURS.length], a: rnd(0, TAU), r: Math.sqrt(Math.random()) })) : null };
  }
  function boxRect(api, D) { const W = api.W, H = api.H; return { x: Math.max(W * 0.27, D * 0.2), y: H * 0.86, w: D * 0.3, h: D * 0.17 }; }
  // the near wall on the left for #97: lime-washed plaster in perspective
  function inWall(api, x, y) { return y > api.H * 0.1 && y < api.H * 0.85 && x < api.W * 0.3; }

  DiwaliTricks.register({
    id: 'colour-matches',
    name: 'Colour matchbox',
    compendium: [95, 96, 97],
    mode: 'hand',
    views: ['doorstep', 'courtyard'],
    fuse: 0.5,
    interactive: true,
    options: [{ key: 'kind', label: 'Strike', choices: [['one', 'One by one'], ['all', 'Whole box'], ['wall', 'On the wall']], default: 'one' }],
    spentLine: MKINDS.one.line,

    create(api, opts) {
      const kind = MKINDS[opts.kind] ? opts.kind : 'one';
      this.spentLine = MKINDS[kind].line;
      const s = { kind, D: handSize(api), clock: 0, left: MKINDS[kind].count, struck: 0, dropped: [], streaks: [], forks: [], virt: { x: 0, y: 0, down: false, justDown: false, justUp: false, active: false },
        me: actor({ ang: -2.2, sticks: [], ctrl: [STICK_L, 0], extra: { fp: true, region: kind === 'wall' ? [0.12, 0.92, 0.5, 0.95] : [0.28, 0.92, 0.55, 0.97] } }), idle: 0, lastStrike: -9, flareT: 0, drag: 0, plaster: Array.from({ length: 70 }, () => [Math.random(), Math.random(), rnd(0.6, 2.4), Math.random()]) };
      s.cur = newMatch(s);
      return s;
    },

    autoplay(s, api, t) { if (t > 0.6 && !s.gesturing && s.cur.state === 'held') autoGesture(s, api); },

    update(s, api, dt, e) {
      const W = api.W, H = api.H, D = s.D = handSize(api), me = s.me;
      let m = s.cur;
      s.clock += dt;
      const can = e >= 0 || armedNow();
      // input: the real pointer, or the autoplay hand
      runVirt(s, dt);
      const real = pointerLive(api), P = s.virt.active ? s.virt : api.pointer;
      if (e >= 0 && autoOn() && !s.gesturing && !s.virt.active && s.left > 0 && (m.state === 'held' || (m.state === 'burn' && m.t > 1.4) || m.state === 'gone')) autoGesture(s, api);
      // gestures
      if (can && s.kind !== 'wall' && P.justDown && m.state !== 'striking' && (s.left > 0 || m.state === 'held')) startStrike(s);
      let [tx, ty] = [W * 0.6 + Math.sin(s.clock * 1.1) * 0.02 * W, H * 0.64 + Math.sin(s.clock * 0.8) * 0.015 * H];
      if (s.kind === 'wall') { tx = W * 0.42 + Math.sin(s.clock * 1.1) * 0.02 * W; ty = H * 0.6; }
      if (s.virt.active || real) [tx, ty] = [P.x, P.y];
      if (s.kind === 'wall' && can && P.justDown && inWall(api, P.x, P.y) && m.state !== 'held' && s.left > 0) {
        // a fresh match for a fresh stroke; the burning one is dropped on the step
        if (m.state !== 'out' && m.state !== 'gone') s.dropped.push({ x: s.hx, y: s.hy, vx: rnd(-40, 40), vy: -60, r: me.h.ang, w: rnd(-6, 6), t: 0, C: m.C, fire: m.lit ? 1 : 0 });
        m = s.cur = newMatch(s);
      }
      if (s.kind === 'wall' && can && P.down && inWall(api, P.x, P.y)) {
        const speed = Math.hypot(P.vx || 0, P.vy || 0);
        s.drag += speed * dt;
        if (m.state === 'held' || m.state === 'scrape') {
          if (m.state === 'held') { m.state = 'scrape'; m.t = 0; s.streaks.push({ C: m.C, pts: [] }); if (s.streaks.length > 14) s.streaks.shift(); }
          const sk = s.streaks[s.streaks.length - 1]; sk.pts.push([P.x, P.y]);
          if (Math.random() < 0.5) api.sparkScreen(P.x, P.y, rnd(-1, 1) * D * 0.3, -rnd(0, 0.4) * D, { life: rnd(0.05, 0.15), color: 'gold', size: 0.6, gravity: D });
          if (s.drag > Math.min(W, H) * 0.07 && m.t > 0.08) flare(s, api, P.x, P.y);
        }
      } else { s.drag = 0; if (m.state === 'scrape') m.state = 'held'; }
      if (m.state === 'striking') {     // hand swipes the head along the box's striker, then flicks up
        const B = boxRect(api, D), k = m.t;
        if (k < 0.16) [tx, ty] = [B.x + B.w * 0.55, B.y + B.h * 0.55];
        else if (k < 0.28) [tx, ty] = [B.x + B.w * lerp(0.55, -0.1, (k - 0.16) / 0.12), B.y + B.h * 0.6];
        else[tx, ty] = [B.x + B.w * 0.2, B.y - D * 0.5 * Math.min(1, (k - 0.28) / 0.2)];
        if (k >= 0.26 && !m.lit) flare(s, api, me.h.gx, me.h.gy);
        if (k > 0.5) m.state = m.lit ? (s.kind === 'all' ? 'whoosh' : 'flare') : 'held';
      }
      follow(me, tx, ty, dt, m.state === 'striking' ? 26 : 16);
      pose(me, W, H, D, me.tx, me.ty);
      const [hx, hy] = toS(me.h, STICK_L, 0); s.hx = hx; s.hy = hy;
      matchBurn(s, api, dt, e);
      for (const d of s.dropped) { d.t += dt; d.vy += D * 3 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.r += d.w * dt; if (d.y > H * 0.9) { d.y = H * 0.9; d.vy *= -0.2; d.vx *= 0.5; d.w *= 0.5; } }
      while (s.dropped.length && s.dropped[0].t > 2.5) s.dropped.shift();
      runForks(s, api, dt);
      if (e >= 0) {
        s.idle = (P.justDown || P.down) ? 0 : s.idle + dt;
        const done = s.left <= 0 && (m.state === 'gone');
        if (done) s.after = (s.after || 0) + dt;
        if (s.after > 0.6) return true;
        if (!autoOn() && s.idle > 6 && (m.state === 'held' || m.state === 'gone')) return true;
        return e > 40;
      }
      return false;
    },

    draw(s, api) {
      const ctx = api.ctx, D = s.D, me = s.me, m = s.cur;
      if (me.tx == null) { pose(me, api.W, api.H, D, api.W * 0.6, api.H * 0.64); const [hx, hy] = toS(me.h, STICK_L, 0); s.hx = hx; s.hy = hy; }
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (s.kind === 'wall') drawWall(s, api); else drawBox(s, api);
      for (const d of s.dropped) drawDropped(ctx, s, d);
      if (m.state !== 'gone') drawMatch(ctx, s, me.h, m);
      drawHand(ctx, api, me.h);
      ctx.globalCompositeOperation = 'lighter';
      drawMatchFire(ctx, s, m);
      ctx.restore();
    },

    stat(s) {
      if (!s.struck) return '';
      if (s.kind === 'all') return `30 matches, one whoosh · ${s.flareT.toFixed(1)} s of rainbow`;
      if (s.kind === 'wall') return `${s.struck} match${s.struck === 1 ? '' : 'es'} struck on the wall · ${s.streaks.length} streaks`;
      return `${s.struck} match${s.struck === 1 ? '' : 'es'} struck`;
    },
  });

  function runVirt(s, dt) {
    const v = s.virt; v.justDown = v.justUp = false;
    if (!v.active) return;
    v.t += dt;
    const k = clamp(v.t / v.dur, 0, 1), px = v.x, py = v.y;
    v.x = lerp(v.from[0], v.to[0], k); v.y = lerp(v.from[1], v.to[1], k);
    v.vx = (v.x - px) / Math.max(dt, 1e-3); v.vy = (v.y - py) / Math.max(dt, 1e-3);
    if (!v.down && v.t >= 0) { v.down = true; v.justDown = true; }
    if (k >= 1) { v.down = false; v.justUp = true; v.active = false; s.gesturing = false; }
  }
  function autoGesture(s, api) {
    const v = s.virt, W = api.W, H = api.H;
    s.gesturing = true;
    if (s.kind === 'wall') {
      const y = H * rnd(0.3, 0.6), x0 = W * rnd(0.04, 0.08);
      Object.assign(v, { active: true, down: false, t: -0.25, dur: 0.32, from: [x0, y], to: [W * rnd(0.2, 0.25), y + H * rnd(-0.08, 0.06)], x: x0, y });
    } else Object.assign(v, { active: true, down: false, t: 0, dur: 0.06, from: [W * 0.6, H * 0.45], to: [W * 0.6, H * 0.45], x: W * 0.6, y: H * 0.45 });
  }
  function startStrike(s) {
    const m = s.cur;
    if (m.state !== 'held' && m.state !== 'gone') {   // impatient: drop the burning one, take the next
      if (m.state !== 'out') s.dropped.push({ x: s.hx, y: s.hy, vx: rnd(-40, 40), vy: -60, r: s.me.h.ang, w: rnd(-6, 6), t: 0, C: m.C, fire: m.state === 'burn' || m.state === 'flare' ? 1 : 0 });
      if (s.left <= 0) return;
      s.cur = newMatch(s);
    }
    if (s.left <= 0 && s.cur.state !== 'held') return;
    s.cur.state = 'striking'; s.cur.t = 0;
  }
  function flare(s, api, x, y) {
    const m = s.cur;
    if (m.lit) return;
    m.lit = true; m.state = s.kind === 'all' ? 'whoosh' : 'flare'; m.t = 0;
    if (s.kind === 'wall') m.state = 'flare';
    s.left--; s.struck++; s.lastStrike = s.clock;
    const D = s.D, p = rayPoint(api, s.hx, s.hy, 5), pan = api.panOf(p);
    api.Sfx.crack({ vol: 0.3, pieces: 2, pan });
    if (s.kind === 'all') { api.Sfx.whoosh({ vol: 0.3, dur: 1.1, pan }); api.Sfx.crack({ vol: 0.35, pieces: 6, pan }); api.shake(1.2); }
    else api.Sfx.whoosh({ vol: 0.09, dur: 0.35, pan });
    api.ignite();
  }
  function matchBurn(s, api, dt, e) {
    const m = s.cur, D = s.D, x = s.hx, y = s.hy;
    m.t += dt;
    if (m.state === 'striking' && !m.lit) return;
    const C = m.C;
    if (m.state === 'flare') {
      const n = api.reduced ? 1 : 6;
      for (let i = 0; i < n; i++) { const a = rnd(0, TAU), sp = D * rnd(0.3, 1.1); api.sparkScreen(x, y, Math.cos(a) * sp, Math.sin(a) * sp - D * 0.3, { life: rnd(0.08, 0.3), color: C.col, size: rnd(0.6, 1.2), gravity: D * 1.2 }); }
      api.light(rayPoint(api, x, y, 7), 0.95, C.rgb.split(',').map(Number));
      if (m.t > 0.35) { m.state = 'burn'; m.t = 0; }
    } else if (m.state === 'whoosh') {
      s.flareT += dt;
      const n = api.reduced ? 3 : 22;
      for (let i = 0; i < n; i++) { const a = rnd(0, TAU), sp = D * rnd(0.4, 2.0), K = COLOURS[(Math.random() * COLOURS.length) | 0]; api.sparkScreen(x, y, Math.cos(a) * sp, Math.sin(a) * sp - D * 0.6, { life: rnd(0.1, 0.45), color: K.col, size: rnd(0.7, 1.5), gravity: D * 1.1 }); }
      const K = COLOURS[Math.floor(m.t * 7) % COLOURS.length];
      api.light(rayPoint(api, x, y, 7), 1.3, K.rgb.split(',').map(Number));
      if (Math.random() < dt * 12) api.smoke(rayPoint(api, x, y - D * 0.1, 5), 2, { size: 1 });
      if (m.t > 1.3) { m.state = 'burn'; m.t = 0; }
    } else if (m.state === 'burn') {
      const dur = s.kind === 'all' ? 2.4 : 1.9;
      if (s.kind === 'all') s.flareT += dt * 0.5;
      if (Math.random() < dt * (s.kind === 'all' ? 60 : 30)) { const K = s.kind === 'all' ? COLOURS[(Math.random() * 5) | 0] : C; const a = rnd(-2.4, -0.7), sp = D * rnd(0.1, 0.4); api.sparkScreen(x, y - D * 0.03, Math.cos(a) * sp, Math.sin(a) * sp, { life: rnd(0.15, 0.4), color: K.col, size: rnd(0.5, 0.9), gravity: -D * 0.2 }); }
      if (Math.random() < dt * 6) api.smoke(rayPoint(api, x, y - D * 0.08, 5), 1, { size: 0.5 });
      const K = s.kind === 'all' ? COLOURS[Math.floor(m.t * 3) % COLOURS.length] : C;
      api.light(rayPoint(api, x, y, 7), s.kind === 'all' ? 0.8 : 0.55, K.rgb.split(',').map(Number));
      if (m.t > dur) { m.state = 'wood'; m.t = 0; }
    } else if (m.state === 'wood') {
      m.burn = Math.min(0.55, m.burn + dt * 0.5);
      api.light(rayPoint(api, x, y, 7), 0.3, [255, 190, 110]);
      if (m.t > 0.9) { m.state = 'out'; m.t = 0; api.smoke(rayPoint(api, x, y, 5), 2, { size: 0.4 }); }
    } else if (m.state === 'out') {
      if (m.t > 0.5) { if (s.left > 0) s.cur = newMatch(s); else m.state = 'gone'; }
    }
  }
  function drawMatch(ctx, s, h, m) {
    const D = h.D, p = poly([[0, 0], [STICK_L, 0]]), lit = m.lit;
    const w = Math.max(2, D * (m.heads ? 0.03 : 0.0085));
    const b = clamp(m.burn, 0, 0.6) * STICK_L;
    strokeRange(ctx, h, p, 0, STICK_L - b, m.heads ? '#cfa86a' : '#d8b578', w);
    if (b > 0 || (lit && m.state !== 'flare' && m.state !== 'whoosh')) strokeRange(ctx, h, p, STICK_L - b - 0.012, STICK_L, '#2a1d14', w * 0.8);
    const [x, y] = toS(h, STICK_L, 0);
    if (m.heads) {
      for (const k of m.heads) { ctx.fillStyle = lit ? '#2a2420' : k.C.head; ctx.beginPath(); ctx.arc(x + Math.cos(k.a) * k.r * D * 0.03, y + Math.sin(k.a) * k.r * D * 0.03, D * 0.011, 0, TAU); ctx.fill(); }
    } else {
      ctx.fillStyle = lit ? '#2b2420' : m.C.head; ctx.beginPath(); ctx.ellipse(x, y, D * 0.014, D * 0.01, h.ang, 0, TAU); ctx.fill();
      if (!lit) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(x - D * 0.004, y - D * 0.004, D * 0.004, 0, TAU); ctx.fill(); }
    }
  }
  function drawMatchFire(ctx, s, m) {
    const D = s.D, x = s.hx, y = s.hy, t = s.clock, fl = 0.85 + 0.3 * Math.sin(t * 41) * Math.sin(t * 23);
    if (!m.lit || m.state === 'out' || m.state === 'gone') { if (m.state === 'out') glow(ctx, x, y, D * 0.02, '255,90,30', 0.5 * (1 - m.t / 0.5)); return; }
    const C = m.C;
    if (m.state === 'flare') { const k = 1 - m.t / 0.35; glow(ctx, x, y, D * (0.18 + 0.15 * k), C.rgb, 0.7); glow(ctx, x, y, D * 0.05, C.core, 1); }
    else if (m.state === 'whoosh') {
      const k = Math.min(1, m.t / 0.15) * (1 - Math.max(0, m.t - 0.9) / 0.5);
      for (let i = 0; i < 5; i++) { const K = COLOURS[i], a = t * 3 + i * TAU / 5; flame(ctx, x + Math.cos(a) * D * 0.035, y + Math.sin(a) * D * 0.015, D * 0.06 * k, D * (0.3 + 0.08 * Math.sin(t * 9 + i)) * k, K.core, K.rgb); }
      glow(ctx, x, y, D * 0.55 * k, COLOURS[Math.floor(t * 7) % 5].rgb, 0.35); glow(ctx, x, y, D * 0.08, '255,255,240', 0.9 * k);
    } else if (m.state === 'burn') {
      const dur = s.kind === 'all' ? 2.4 : 1.9, k = 1 - 0.4 * (m.t / dur);
      if (s.kind === 'all') { for (let i = 0; i < 5; i++) { const K = COLOURS[i]; flame(ctx, x + (i - 2) * D * 0.012, y, D * 0.03 * k, D * 0.15 * k * fl, K.core, K.rgb); } glow(ctx, x, y, D * 0.3, COLOURS[Math.floor(t * 3) % 5].rgb, 0.25); }
      else { flame(ctx, x, y, D * 0.022 * k, D * 0.085 * k * fl, C.core, C.rgb); glow(ctx, x, y, D * 0.2, C.rgb, 0.22 * fl); }
    } else if (m.state === 'wood') { const k = 1 - m.t / 0.9; flame(ctx, x, y, D * 0.012 * k, D * 0.04 * k * fl, '255,240,200', '255,160,60'); }
  }
  function drawDropped(ctx, s, d) {
    const D = s.D, L = STICK_L * D;
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.r);
    ctx.strokeStyle = '#c9a36c'; ctx.lineWidth = Math.max(2, D * 0.008); ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(0, 0); ctx.stroke();
    ctx.fillStyle = '#2b2420'; ctx.beginPath(); ctx.arc(0, 0, D * 0.012, 0, TAU); ctx.fill();
    ctx.restore();
    if (d.fire > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const k = Math.max(0, 1 - d.t / 1.2); flame(ctx, d.x, d.y, D * 0.018 * k, D * 0.06 * k, d.C.core, d.C.rgb); ctx.restore(); }
  }
  // a generic colour-match box lying on the step: rainbow label, brown striker along the front
  function drawBox(s, api) {
    const ctx = api.ctx, B = boxRect(api, s.D), sk = B.h * 0.32;
    ctx.save(); ctx.translate(B.x, B.y); ctx.rotate(-0.08);
    const g = ctx.createRadialGradient(0, B.h * 0.6, 0, 0, B.h * 0.6, B.w * 0.75); g.addColorStop(0, 'rgba(10,6,4,.5)'); g.addColorStop(1, 'rgba(10,6,4,0)');
    ctx.fillStyle = g; ctx.fillRect(-B.w, -B.h * 0.2, B.w * 2, B.h * 1.6);
    // top face (label)
    ctx.beginPath(); ctx.moveTo(-B.w / 2 + sk, -B.h / 2); ctx.lineTo(B.w / 2 + sk, -B.h / 2); ctx.lineTo(B.w / 2, B.h / 2); ctx.lineTo(-B.w / 2, B.h / 2); ctx.closePath();
    ctx.fillStyle = '#efe2c2'; ctx.fill(); ctx.save(); ctx.clip();
    const bands = ['#d63a2f', '#f08a1c', '#f2cc2a', '#3aa04a', '#2f6fc8', '#8a46b8'];
    bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(-B.w / 2 + i * B.w / 6 + sk * 0.5, -B.h / 2, B.w / 6 + 1, B.h * 0.42); });
    ctx.fillStyle = '#2a1c14'; ctx.font = `700 ${Math.max(7, B.h * 0.2)}px system-ui, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText('COLOUR MATCHES', sk * 0.2, B.h * 0.3);
    ctx.fillStyle = '#e5b82e'; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? B.h * 0.06 : B.h * 0.14; ctx.lineTo(B.w * 0.36 + Math.cos(a) * r, -B.h * 0.12 + Math.sin(a) * r); }
    ctx.fill(); ctx.restore();
    // front side with the striker
    ctx.fillStyle = '#5a3a24'; ctx.beginPath(); ctx.moveTo(-B.w / 2, B.h / 2); ctx.lineTo(B.w / 2, B.h / 2); ctx.lineTo(B.w / 2, B.h / 2 + B.h * 0.28); ctx.lineTo(-B.w / 2, B.h / 2 + B.h * 0.28); ctx.fill();
    ctx.fillStyle = 'rgba(30,18,10,.6)';
    for (let i = 0; i < 26; i++) ctx.fillRect(-B.w / 2 + (i * 37 % 100) / 100 * B.w, B.h / 2 + ((i * 53) % 100) / 100 * B.h * 0.26, 1.5, 1.5);
    if (s.struck) { ctx.strokeStyle = 'rgba(20,12,8,.7)'; ctx.lineWidth = 1; for (let i = 0; i < Math.min(8, s.struck); i++) { ctx.beginPath(); ctx.moveTo(-B.w * 0.3 + i * 3, B.h * 0.56 + i % 3); ctx.lineTo(B.w * 0.35 - i * 2, B.h * 0.62 + (i * 2) % 4); ctx.stroke(); } }
    ctx.restore();
  }
  function drawWall(s, api) {
    const ctx = api.ctx, W = api.W, H = api.H, xr = W * 0.3;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(xr, H * 0.1); ctx.lineTo(xr, H * 0.82); ctx.lineTo(0, H + 2); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, xr, 0); g.addColorStop(0, '#c9b089'); g.addColorStop(1, '#8d7457');
    ctx.fillStyle = g; ctx.fill(); ctx.save(); ctx.clip();
    for (const [u, v, r, k] of s.plaster) { ctx.fillStyle = k < 0.5 ? 'rgba(70,52,36,.25)' : 'rgba(240,226,196,.22)'; ctx.beginPath(); ctx.arc(u * xr, H * (0.05 + v * 0.85), r * 2, 0, TAU); ctx.fill(); }
    // red-oxide skirting where the wall meets the floor
    ctx.fillStyle = '#6a2a1e'; ctx.beginPath(); ctx.moveTo(0, H * 0.92); ctx.lineTo(xr, H * 0.76); ctx.lineTo(xr, H * 0.82); ctx.lineTo(0, H + 2); ctx.fill();
    // coloured streaks from every match struck here
    ctx.lineCap = 'round';
    for (const sk of s.streaks) {
      if (sk.pts.length < 2) continue;
      ctx.strokeStyle = sk.C.head; ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(2, s.D * 0.012);
      ctx.beginPath(); sk.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      ctx.strokeStyle = '#1e1612'; ctx.globalAlpha = 0.35; ctx.lineWidth = Math.max(1, s.D * 0.004); ctx.stroke();
    }
    // warm light from the flame on the plaster (still clipped to the wall)
    const m = s.cur;
    if (m.lit && m.state !== 'out' && m.state !== 'gone') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1; glow(ctx, s.hx, s.hy, s.D * 0.5, m.C.rgb, 0.18); }
    ctx.restore();
    ctx.restore();
  }

  DiwaliTricks.bind(95, 'colour-matches', { kind: 'one' }, 'doorstep');
  DiwaliTricks.bind(96, 'colour-matches', { kind: 'all' }, 'doorstep');
  DiwaliTricks.bind(97, 'colour-matches', { kind: 'wall' }, 'doorstep');
})();

// blast.js — Compendium section B, "Bomb under things", plus the loud pranks (#118, #122, #140).
// One engine, five tricks. Each THING (bucket, matka, postbox, well, sutli ceremony…) is built from
// projected meshes, rigid bodies and its own debris ("bits": paper, leaves, beads, blobs, water drops),
// then reacts to the bang in its own way and is measured. spentLine and fuse follow the playing thing.
(function () {
  'use strict';
  const { Body, v3, M3, G, UNIT_M, shatter } = Phys;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = (i, j) => { const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); };
  const TAU = Math.PI * 2;
  const f1 = v => v.toFixed(1);

  const BOMBS = { bijli: 0.35, lakshmi: 0.7, atom: 1.0, sutli: 1.5 };
  const BOMB_CHOICES = [['bijli', 'Bijli'], ['lakshmi', 'Lakshmi'], ['atom', 'Atom bomb'], ['sutli', 'Sutli']];

  // Extra struck-object voices for this family, added (prefixed, additive) to the shared synth's mode table.
  if (Sfx.MODES) Object.assign(Sfx.MODES, {
    'blast-bell':  [[659, 1.3, 1], [1318, 0.7, 0.32], [1977, 0.4, 0.16], [2637, 0.25, 0.08]],
    'blast-drum':  [[88, 2.6, 1], [134, 2.1, 0.75], [219, 1.5, 0.5], [362, 1.0, 0.32], [585, 0.6, 0.18]],
    'blast-siren': [[1000, 0.07, 1], [2010, 0.05, 0.18]],
    'blast-gate':  [[236, 0.3, 1], [598, 0.22, 0.6], [1342, 0.14, 0.45], [2390, 0.09, 0.3]],
    'blast-plop':  [[190, 0.1, 1], [430, 0.06, 0.4]],
  });

  // ---------- projection + 2D helpers (one camera per frame, not one per point) ----------
  function proj(c, p) {
    const r0 = p[0] - c.C[0], r1 = p[1] - c.C[1], r2 = p[2] - c.C[2];
    const z = Math.max(0.3, r0 * c.fwd[0] + r1 * c.fwd[1] + r2 * c.fwd[2]);
    return { x: c.cx + c.F * (r0 * c.right[0] + r1 * c.right[1] + r2 * c.right[2]) / z, y: c.cy - c.F * (r0 * c.up[0] + r1 * c.up[1] + r2 * c.up[2]) / z, d: z, f: c.z0 / z };
  }
  function path(ctx, c, pts) { ctx.beginPath(); pts.forEach((p, i) => { const q = proj(c, p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.closePath(); }
  function circle(x, y, z, r, n = 24) { const out = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; out.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]); } return out; }
  function glow(ctx, x, y, r, rgb, a, sy = 1) {
    if (!(r > 1) || a <= 0.005) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.scale(1, sy);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
  }
  function line(ctx, c, a, b, colour, w) { const p = proj(c, a), q = proj(c, b); ctx.strokeStyle = colour; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
  // a soft ground mark, squashed to the camera's real ground aspect
  function groundMark(ctx, c, at, r, rgba, a) {
    const q = proj(c, [at[0], 0.002, at[2]]), q2 = proj(c, [at[0], 0.002, at[2] + r]), R = c.scale * r * q.f;
    if (R < 1) return;
    const sy = clamp(Math.abs(q2.y - q.y) / R, 0.2, 1);
    ctx.save(); ctx.translate(q.x, q.y); ctx.scale(1, sy);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, `rgba(${rgba},${a})`); g.addColorStop(1, `rgba(${rgba},0)`);
    ctx.fillStyle = g; ctx.fillRect(-R, -R, R * 2, R * 2); ctx.restore();
  }
  const scorch = (api, at, r) => api.remain((ctx, A) => groundMark(ctx, A.cam, at, r, '18,12,9', 0.6));
  function heightTag(api, c, pos, m) {
    const q = proj(c, pos);
    if (q.y > 8) return;
    const ctx = api.ctx; ctx.save(); ctx.fillStyle = 'rgba(255,240,210,.92)'; ctx.font = '600 13px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(`↑ ${f1(m)} m`, clamp(q.x, 40, api.W - 40), 22); ctx.restore();
  }
  function wickLine(api, c, a, b) { line(api.ctx, c, a, b, '#b9a988', 1.6); }

  // ---------- mesh builders (local space; faces share vertex arrays so they can be deformed) ----------
  // Surface of revolution about y. profile: [[y, r], ...] bottom → top.
  function latheY(profile, o = {}) {
    const segs = o.segs || 16, y0 = o.y0 || 0, flip = o.inward ? -1 : 1;
    const rings = profile.map(([y, r]) => { const ring = []; for (let k = 0; k < segs; k++) { const a = k / segs * TAU; ring.push([Math.cos(a) * r, y + y0, Math.sin(a) * r]); } return ring; });
    const faces = [];
    for (let i = 0; i < rings.length - 1; i++) {
      const dy = profile[i + 1][0] - profile[i][0], dr = profile[i + 1][1] - profile[i][1];
      for (let k = 0; k < segs; k++) {
        const k2 = (k + 1) % segs, a = (k + 0.5) / segs * TAU;
        const n = v3.scale(v3.norm([Math.cos(a) * dy, -dr, Math.sin(a) * dy]), flip);
        faces.push({ pts: [rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]], n, rgb: o.colourAt ? o.colourAt(i, k, segs) : (o.rgb || [180, 180, 180]), back: o.back, band: i, seg: k });
      }
    }
    if (o.cap) faces.push({ pts: rings[rings.length - 1].slice().reverse(), n: [0, 1, 0], rgb: o.cap, band: rings.length - 1, seg: -1 });
    return { faces, rings, hull: [...rings[0], ...rings[rings.length - 1]] };
  }
  function sphere(r, o = {}) {
    const lat = o.lat || 6, lon = o.lon || 12, grid = [], faces = [];
    for (let i = 0; i <= lat; i++) {
      const ph = -Math.PI / 2 + Math.PI * i / lat, row = [];
      for (let j = 0; j < lon; j++) {
        const th = j / lon * TAU, rr = r * (o.jitter && i > 0 && i < lat ? 1 + o.jitter * (hash(i + (o.seed || 0), j) - 0.5) : 1);
        row.push([Math.cos(th) * Math.cos(ph) * rr, Math.sin(ph) * rr * (o.squash || 1), Math.sin(th) * Math.cos(ph) * rr]);
      }
      grid.push(row);
    }
    for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) {
      const j2 = (j + 1) % lon, ph = -Math.PI / 2 + Math.PI * (i + 0.5) / lat, th = (j + 0.5) / lon * TAU;
      faces.push({ pts: [grid[i][j], grid[i][j2], grid[i + 1][j2], grid[i + 1][j]], n: [Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph)], rgb: o.colourAt ? o.colourAt(i, j, lat, lon) : (o.rgb || [160, 160, 160]) });
    }
    const hull = [grid[0][0], grid[lat][0]];
    for (let i = 1; i < lat; i++) for (let j = 0; j < lon; j += 2) hull.push(grid[i][j]);
    return { faces, grid, hull };
  }
  const SIDES = [
    ['top', [0, 1, 0], [1, 0, 0], [0, 0, 1], [0, 0.5, 0]], ['bottom', [0, -1, 0], [1, 0, 0], [0, 0, 1], [0, -0.5, 0]],
    ['front', [0, 0, 1], [1, 0, 0], [0, 1, 0], [0, 0, 0.5]], ['back', [0, 0, -1], [1, 0, 0], [0, 1, 0], [0, 0, -0.5]],
    ['right', [1, 0, 0], [0, 0, 1], [0, 1, 0], [0.5, 0, 0]], ['left', [-1, 0, 0], [0, 0, 1], [0, 1, 0], [-0.5, 0, 0]],
  ];
  function box(w, h, d, o = {}) {
    const div = o.div || 1, faces = [], S = [w, h, d], sc = v => [v[0] * w, v[1] * h, v[2] * d];
    for (const [name, n, u, v, c] of SIDES) {
      if (o.skip && o.skip.includes(name)) continue;
      const U = sc(u), V = sc(v), C = sc(c);
      for (let a = 0; a < div; a++) for (let b = 0; b < div; b++) {
        const P = (x, y) => [C[0] + U[0] * (x - 0.5) + V[0] * (y - 0.5), C[1] + U[1] * (x - 0.5) + V[1] * (y - 0.5), C[2] + U[2] * (x - 0.5) + V[2] * (y - 0.5)];
        faces.push({ pts: [P(a / div, b / div), P((a + 1) / div, b / div), P((a + 1) / div, (b + 1) / div), P(a / div, (b + 1) / div)], n, rgb: o.colourAt ? o.colourAt(name, a, b, div) : (o.rgb || [180, 180, 180]), back: o.back, side: name });
      }
    }
    const hull = [];
    for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) hull.push([x * S[0], y * S[1], z * S[2]]);
    return { faces, hull };
  }
  const moved = (faces, at) => Mesh.place(faces, M3.I(), at);

  // The bombs themselves, for the tricks where you can see them sitting there.
  function bombMesh(kind) {
    if (kind === 'sutli') return { h: 0.2, faces: sphere(0.2, { lat: 6, lon: 12, colourAt: (i, j) => (i + j) % 2 ? [188, 152, 96] : [150, 118, 70] }).faces };
    if (kind === 'lakshmi') return { h: 0.15, faces: Mesh.cylinder(0.09, 0.3, { segs: 10, bands: 3, colourAt: (s, b) => b === 1 ? [228, 186, 64] : [190, 36, 30], top: [170, 34, 28], bottom: false }).faces };
    if (kind === 'bijli') return { h: 0.1, faces: Mesh.cylinder(0.04, 0.2, { segs: 8, bands: 2, colourAt: (s, b) => b ? [196, 40, 34] : [60, 120, 70], top: [180, 36, 30], bottom: false }).faces };
    return { h: 0.125, faces: sphere(0.125, { lat: 5, lon: 10, colourAt: i => i === 2 ? [186, 40, 34] : [46, 112, 62] }).faces };
  }
  function drawBomb(api, s, at = [0, 0, 0]) {
    const b = s.bombMesh || (s.bombMesh = bombMesh(s.bombKind));
    api.shadow(at, 0.16, 0);
    api.drawFaces(moved(b.faces, [at[0], at[1] + b.h, at[2]]));
  }

  // ---------- rigid bodies ----------
  function mkBody(s, api, o) {
    const b = new Body({
      pos: o.pos, R: o.R, mass: o.mass, inertia: o.inertia, restitution: o.e ?? 0.3, friction: o.mu ?? 0.5,
      linDrag: o.linDrag ?? 0.05, angDrag: o.angDrag ?? 0.15, contactAngDrag: o.cad, contactLinDrag: o.cld, hull: o.hull,
      onImpact: (sp, at) => {
        if (o.material) api.Sfx.strike(o.material, { vol: clamp(sp / (o.loud || 30), 0.03, o.vmax || 0.9), pan: api.panOf(at), detune: (o.detune || 1) * rnd(0.97, 1.03) });
        if (o.hit) o.hit(sp, at);
      },
    });
    b.rest0 = o.pos[1];
    s.bodies.push(b);
    return b;
  }
  // Small pieces rock on their sparse hulls forever; once they're low and slow, let them rest.
  function tame(b, after = 3.5) { if (b.awake && b.age > after && b.pos[1] < 0.8 && Math.hypot(b.vel[0], b.vel[1], b.vel[2]) < 3) { b.awake = false; b.vel = [0, 0, 0]; b.w = [0, 0, 0]; } }
  const peakOf = b => Math.max(0, (b.maxY - b.rest0) * UNIT_M);
  const distOf = (b, from = [0, 0, 0]) => Math.hypot(b.pos[0] - from[0], b.pos[2] - from[2]) * UNIT_M;
  function drawBody(api, b, faces, r) { api.shadow(b.pos, r, Math.max(0, b.pos[1] - b.rest0)); api.drawFaces(Mesh.place(faces, b.R, b.pos)); }
  // Dent a ring (the rim it sat on) and return where.
  function warp(rings, idx, k) {
    const ring = rings[idx], at = Math.floor(Math.random() * ring.length);
    for (let i = -3; i <= 3; i++) {
      const p = ring[(at + i + ring.length) % ring.length], w = (1 - Math.abs(i) / 4) * k;
      p[0] *= 1 - w; p[2] *= 1 - w; p[1] += w * 0.15;
    }
    return at;
  }
  function shards(api, faces, seeds, o) {
    return shatter(faces, seeds).map(sh => {
      const out = v3.norm(v3.sub(sh.centroid, o.from || [0, 0, 0]));
      const sp = rnd(o.v[0], o.v[1]) * Math.min(1.6, 9 / (sh.count + 3)), mass = (o.mass || 0.01) * sh.count;
      const body = new Body({
        pos: sh.centroid, mass, inertia: mass * 0.025, restitution: o.e ?? 0.25, friction: 0.7, linDrag: o.linDrag ?? 0.05, angDrag: 0.3, contactAngDrag: 9, contactLinDrag: 2.2,
        hull: sh.hull.filter((_, i) => i % 3 === 0),
        onImpact: (v, at) => { if (v > 4 && o.material) api.Sfx.strike(o.material, { vol: Math.min(0.35, v / 60), pan: api.panOf(at), detune: o.detune || 1 }); },
      });
      body.rest0 = sh.centroid[1];
      body.kick([out[0] * sp, Math.max(0.3, out[1]) * sp + rnd(o.up[0], o.up[1]), out[2] * sp], [rnd(-20, 20), rnd(-20, 20), rnd(-20, 20)]);
      return { faces: sh.faces, body };
    });
  }
  function drawShards(api, list, r = 0.1) {
    const all = [];
    for (const sh of list) { api.shadow(sh.body.pos, r, sh.body.pos[1]); for (const f of Mesh.place(sh.faces, sh.body.R, sh.body.pos)) all.push(f); }
    api.drawFaces(all);
  }

  // ---------- bits: our own debris, so it can be measured and can stay on the ground ----------
  function bit(p, v, o) {
    const c = o.rgb;
    return {
      p: p.slice(), v: v.slice(), size: o.size, shape: o.shape || 'rect', up: o.up ?? 2, down: o.down ?? 5, flutter: o.flutter ?? 0, g: o.g ?? 1,
      rest: !!o.rest, dead: false, top: p[1], phase: rnd(0, TAU), spin: rnd(6, 18), yaw: rnd(0, TAU),
      lit: `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`, dim: `rgb(${c[0] * 0.6 | 0},${c[1] * 0.6 | 0},${c[2] * 0.6 | 0})`,
    };
  }
  function stepBits(s, dt) {
    let fly = 0;
    for (const b of s.bits) {
      if (b.rest || b.dead) continue;
      fly++;
      b.phase += b.spin * dt;
      b.v[1] -= G * b.g * dt;
      const k = Math.exp(-(b.v[1] > 0 ? b.up : b.down) * dt);
      b.v[0] *= k; b.v[1] *= k; b.v[2] *= k;
      if (b.flutter) { b.v[0] += Math.sin(b.phase) * b.flutter * dt; b.v[2] += Math.cos(b.phase * 0.7) * b.flutter * dt; }
      b.p[0] += b.v[0] * dt; b.p[1] += b.v[1] * dt; b.p[2] += b.v[2] * dt;
      if (b.p[1] > b.top) b.top = b.p[1];
      if (b.p[1] <= 0.004 && b.v[1] < 0) {
        b.p[1] = 0.004;
        if (b.shape === 'drop') b.dead = true; else { b.rest = true; b.yaw = rnd(0, TAU); }
        if (s.T.land) s.T.land(s, b);
      }
    }
    s.flying = fly;
  }
  // mode 0 = all, 1 = flying only, 2 = resting only
  function drawBits(ctx, c, list, mode) {
    for (const b of list) {
      if (b.dead || (mode === 1 && b.rest) || (mode === 2 && !b.rest)) continue;
      const q = proj(c, b.p), sz = Math.max(1.2, b.size * c.scale * q.f);
      if (b.shape === 'drop') {
        const t = proj(c, [b.p[0] - b.v[0] * 0.02, b.p[1] - b.v[1] * 0.02, b.p[2] - b.v[2] * 0.02]);
        ctx.strokeStyle = b.lit; ctx.lineWidth = sz; ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        continue;
      }
      const flip = b.rest ? 1 : Math.abs(Math.cos(b.phase));
      ctx.fillStyle = flip > 0.45 ? b.lit : b.dim;
      ctx.beginPath();
      if (b.shape === 'bead') ctx.arc(q.x, q.y, sz * 0.5, 0, TAU);
      else if (b.shape === 'blob') { if (b.rest) ctx.ellipse(q.x, q.y, sz * 1.25, sz * 0.5, b.yaw * 0.15, 0, TAU); else ctx.arc(q.x, q.y, sz * 0.55, 0, TAU); }
      else if (b.shape === 'leaf') ctx.ellipse(q.x, q.y, sz * 0.6, sz * 0.26 * (b.rest ? 0.75 : Math.max(0.2, flip)), b.rest ? b.yaw : b.phase * 0.5, 0, TAU);
      else {
        const ang = b.rest ? b.yaw : b.phase * 0.5, ca = Math.cos(ang), sa = Math.sin(ang), hx = sz * 0.5, hy = sz * (b.rest ? 0.2 : 0.3 * Math.max(0.15, flip));
        ctx.moveTo(q.x + ca * hx - sa * hy, q.y + sa * hx + ca * hy); ctx.lineTo(q.x - ca * hx - sa * hy, q.y - sa * hx + ca * hy);
        ctx.lineTo(q.x - ca * hx + sa * hy, q.y - sa * hx - ca * hy); ctx.lineTo(q.x + ca * hx + sa * hy, q.y + sa * hx - ca * hy);
      }
      ctx.fill();
    }
  }
  // whatever lands stays on the ground of this place after the moment ends
  function keepBits(s, api) {
    if (s.kept) return;
    s.kept = true;
    const list = s.bits;
    api.remain((ctx, A) => drawBits(ctx, A.cam, list, 2));
  }
  const nBits = (api, n) => Math.max(4, Math.round(api.reduced ? n * 0.35 : n));
  // A heap: bits resting on a mound of radius R, height H.
  function heap(s, api, n, R, H, colours, o) {
    for (let i = 0; i < nBits(api, n); i++) {
      const r = R * Math.sqrt(Math.random()), a = rnd(0, TAU), y = H * (1 - (r / R) ** 2) + 0.01;
      s.bits.push(bit([Math.cos(a) * r, y, Math.sin(a) * r], [0, 0, 0], { ...o, rest: true, rgb: colours[i % colours.length], size: rnd(o.size[0], o.size[1]) }));
    }
  }
  function erupt(s, R, size, o) {
    for (const b of s.bits) {
      if (!b.rest) continue;
      const r = Math.hypot(b.p[0], b.p[2]) || 0.01, k = 1 - (r / R) * 0.45, out = rnd(o.out[0], o.out[1]) * size;
      b.v = [b.p[0] / r * out + rnd(-1, 1) * o.jit, rnd(o.up[0], o.up[1]) * Math.sqrt(size) * k, b.p[2] / r * out + rnd(-1, 1) * o.jit];
      b.rest = false; b.top = b.p[1];
    }
  }
  function spray(s, api, n, from, o) {
    for (let i = 0; i < nBits(api, n); i++) {
      const a = rnd(0, TAU), h = rnd(o.out[0], o.out[1]);
      const p = [from[0] + rnd(-1, 1) * (o.spread || 0.1), from[1], from[2] + rnd(-1, 1) * (o.spread || 0.1) * (o.zs ?? 1)];
      s.bits.push(bit(p, [Math.cos(a) * h * (o.xs ?? 1), rnd(o.up[0], o.up[1]), Math.sin(a) * h * (o.zs ?? 1)], { shape: o.shape, flutter: o.flutter, g: o.g, up: o.du ?? 2, down: o.dd ?? 5, rgb: o.colours[i % o.colours.length], size: rnd(o.size[0], o.size[1]) }));
    }
  }
  const bitsTop = s => s.bits.reduce((m, b) => Math.max(m, b.top), 0) * UNIT_M;
  const bitsFar = (s, at = [0, 0, 0]) => s.bits.reduce((m, b) => (b.rest || b.dead) ? Math.max(m, Math.hypot(b.p[0] - at[0], b.p[2] - at[2])) : m, 0) * UNIT_M;
  function mound(R, H, colourAt) { return Mesh.dome(R, { lat: 4, lon: 18, squash: H / R, colourAt }).faces; }

  // ---------- the bang, the timeline, echoes, car alarms, applause ----------
  function bang(s, api, at, size, o = {}) {
    const pan = api.panOf(at);
    if (o.fire !== 0) api.burst(at, Math.round(150 * size * (o.fire ?? 1)), 10 * size, { flat: o.flat ?? true });
    if (o.paper !== 0) api.paper(at, Math.round((o.paper ?? 24) * size), 4.5 * size, o.paperRgb);
    if (o.smoke !== 0) api.smoke(at, Math.round((o.smoke ?? 14) * size), { size: o.smokeSize ?? 1 });
    api.light([at[0], at[1] + 0.2, at[2]], (o.light ?? 1) * (0.7 + 0.5 * size), o.lightRgb);
    api.shake((o.shake ?? 1) * (4 + 5 * size));
    api.Sfx.boom({ vol: o.vol ?? 0.85, size: o.boomSize ?? size, muffle: o.muffle ?? 0.2, pan });
    if (o.scorch !== false) scorch(api, at, (o.scorch ?? 0.45) * Math.sqrt(size));
  }
  const at = (s, t, fn) => s.q.push({ t, fn });
  const after = (s, dt, fn) => s.q.push({ t: s.e + dt, fn });
  // Repeating, quieter, duller booms: the space answering back. Returns when the last one lands.
  function echoes(s, api, t0, n, gap, size, vol, muffle, pan = 0, fall = 0.66) {
    let t = t0;
    for (let k = 1; k <= n; k++) {
      t += gap * (1 + k * 0.05);
      const kk = k;
      at(s, t, () => api.Sfx.boom({ vol: vol * Math.pow(fall, kk), size: size * 0.8, muffle: Math.min(0.95, muffle + kk * 0.06), pan: pan + (kk % 2 ? -0.35 : 0.35) }));
    }
    return t;
  }
  const ALARMS = ['warble', 'whoop', 'beep', 'yelp'];
  function alarm(s, api, t0, dur, kind, pos, pitch = 1, vol = 1) { s.alarms.push({ t0, t1: t0 + dur, kind, pos, pitch, vol, pan: pos ? api.panOf(pos) : 0, next: 0 }); }
  function tickAlarms(s, api, e) {
    for (const a of s.alarms) {
      if (e < a.t0 || e > a.t1 || e < a.next) continue;
      const u = e - a.t0; a.next = e + 0.045;
      let d;
      if (a.kind === 'warble') d = 1 + 0.28 * Math.sin(u * TAU * 3);
      else if (a.kind === 'whoop') d = 0.6 + 0.8 * ((u % 0.7) / 0.7);
      else if (a.kind === 'beep') { if (Math.floor(u / 0.2) % 2) continue; d = 1.1; }
      else d = 1 + 0.35 * Math.sin(u * TAU * 7);
      api.Sfx.strike('blast-siren', { vol: 0.07 * a.vol, pan: a.pan, detune: d * a.pitch });
    }
  }
  // parked cars down the lane blinking their hazards
  function drawAlarms(ctx, c, s) {
    for (const a of s.alarms) {
      if (!a.pos || s.e < a.t0 || s.e > a.t1 || Math.floor((s.e - a.t0) * 2.4) % 2) continue;
      for (const dx of [-0.75, 0.75]) { const q = proj(c, [a.pos[0] + dx, a.pos[1], a.pos[2]]); glow(ctx, q.x, q.y, Math.max(4, c.scale * 0.6 * q.f), '255,160,40', 0.95); }
    }
  }
  const alarmsSoFar = s => s.alarms.filter(a => s.e >= a.t0).length;
  function tickClap(s, api, dt) {
    if (!s.clap || s.e < s.clap[0] || s.e > s.clap[1]) return;
    const fadeOut = clamp((s.clap[1] - s.e) / 0.8, 0, 1);
    for (let i = 0; i < 2; i++) if (Math.random() < dt * 24) api.Sfx.crack({ vol: rnd(0.04, 0.12) * fadeOut, pieces: 1, pan: rnd(-0.8, 0.8) });
  }
  function hud(api, text) {
    const ctx = api.ctx; ctx.save(); ctx.font = '700 16px system-ui'; ctx.fillStyle = 'rgba(20,12,8,.55)';
    const w = ctx.measureText(text).width + 22; ctx.fillRect(12, 12, w, 30);
    ctx.fillStyle = 'rgba(255,226,170,.95)'; ctx.fillText(text, 23, 33); ctx.restore();
  }

  // ======================================================================================
  // THINGS. Each: label, line (spentLine), build, wick, fire, step?, paint, overlay?, stat, land?
  // ======================================================================================
  const THINGS = {};

  // ---- #23 plastic bucket: launch, and the rim never sits flat again ----
  THINGS.bucket = {
    label: 'Plastic bucket', line: 'Balti udi, aur phir kabhi seedhi nahi baithi.',
    build(s, api) {
      const blue = [36, 102, 184], deep = [28, 82, 154];
      s.mesh = latheY([[0, 0.8], [0.1, 0.8], [0.1, 0.75], [0.8, 0.67], [1.45, 0.6]], { segs: 18, y0: -0.72, cap: deep, colourAt: i => i < 2 ? deep : blue });
      s.body = mkBody(s, api, { pos: [0, 0.72, 0], mass: 0.5, inertia: 0.5 * (3 * 0.49 + 2.1) / 12, e: 0.38, mu: 0.45, hull: s.mesh.hull, material: 'shell', detune: 0.42, loud: 24 });
    },
    wick: () => [1.0, 0.03, 0.3],
    fire(s, api) {
      const z = s.size;
      bang(s, api, [0, 0.05, 0], z, { muffle: 0.3, paper: 18 });
      api.Sfx.strike('shell', { vol: 0.8, detune: 0.4, pan: api.panOf([0, 0, 0]) });
      s.body.kick([rnd(-2, 2) * z, rnd(20, 27) * Math.pow(z, 0.55), rnd(-2, 2) * z], [rnd(-9, 9) * z, rnd(-3, 3), rnd(-9, 9) * z]);
      const k = 0.22 * Math.min(1.3, z), w = warp(s.mesh.rings, 0, k); warp(s.mesh.rings, 1, k * 0.8);
      for (const f of s.mesh.faces) { const d = Math.min(Math.abs(f.seg - w), 18 - Math.abs(f.seg - w)); if (f.band <= 2 && d <= 3) f.rgb = f.rgb.map(v => v * (0.35 + d * 0.12)); }
    },
    paint(s, api, c) { if (!s.fired) wickLine(api, c, [0.78, 0.02, 0.12], this.wick()); drawBody(api, s.body, s.mesh.faces, 0.8); },
    stat: s => `Peak ${f1(peakOf(s.body))} m · rim warped for life`,
  };

  // ---- #25 paper / ice-cream cup: the little kids' mini-launch ----
  THINGS.cup = {
    label: 'Ice-cream cup', line: 'Chhoton ka rocket. Sabne taali bajayi.',
    build(s, api) {
      s.mesh = latheY([[0, 0.2], [0.04, 0.2], [0.32, 0.16]], { segs: 14, y0: -0.16, cap: [236, 226, 210], colourAt: (i, k) => i === 0 ? [214, 72, 96] : (k % 2 ? [244, 236, 222] : [236, 200, 120]) });
      s.body = mkBody(s, api, { pos: [0, 0.16, 0], mass: 0.006, inertia: 0.006 * 0.02, e: 0.3, mu: 0.5, linDrag: 1.2, angDrag: 0.6, hull: s.mesh.hull, material: 'shell', detune: 1.7, loud: 60, vmax: 0.2 });
    },
    wick: () => [0.36, 0.03, 0.14],
    fire(s, api) {
      const z = s.size;
      bang(s, api, [0, 0.03, 0], z, { muffle: 0.12, paper: 16, shake: 0.7 });
      s.body.kick([rnd(-1.5, 1.5), rnd(26, 34) * Math.sqrt(z), rnd(-1.5, 1.5)], [rnd(-14, 14), rnd(-4, 4), rnd(-14, 14)]);
    },
    paint(s, api, c) { if (!s.fired) wickLine(api, c, [0.18, 0.01, 0.06], this.wick()); drawBody(api, s.body, s.mesh.faces, 0.22); },
    stat: s => `Peak ${f1(peakOf(s.body))} m · safe-ish`,
  };

  // ---- #26 coin launcher: a 25-paise coin balanced on the bomb ----
  THINGS.coin = {
    label: '25-paise coin', line: 'Sikka mila? Aadha ghanta dhoondha, phir mila.', maxT: 16,
    build(s, api) {
      s.mesh = Mesh.cylinder(0.0475, 0.008, { segs: 12, bands: 1, rgb: [186, 182, 170], top: [214, 210, 198], bottom: [196, 192, 180] });
      const h = 0.25 + 0.004;
      s.body = mkBody(s, api, { pos: [0, h, 0], mass: 0.003, inertia: 0.003 * 0.0475 * 0.0475 / 4, e: 0.5, mu: 0.3, linDrag: 0.12, angDrag: 0.05, cad: 2.5, hull: s.mesh.hull,
        material: 'coin', loud: 18, hit: () => { s.clinks++; } });
      s.body.rest0 = 0.004; s.clinks = 0;
    },
    wick: () => [0.3, 0.03, 0.1],
    fire(s, api) {
      const z = s.size;
      bang(s, api, [0, 0.1, 0], z, { muffle: 0.05 });
      s.body.kick([rnd(-2, 2), rnd(48, 62) * Math.sqrt(z), rnd(-2, 2)], [rnd(-40, 40), rnd(-5, 5), rnd(-40, 40)]);
      api.Sfx.strike('coin', { vol: 0.35, pan: api.panOf([0, 0, 0]) });
    },
    paint(s, api, c) {
      if (!s.fired) { drawBomb(api, s); wickLine(api, c, [0.1, 0.12, 0.04], this.wick()); }
      const b = s.body;
      drawBody(api, b, s.mesh.faces, 0.06);
      if (s.fired && b.awake) { const q = proj(c, b.pos); glow(api.ctx, q.x, q.y, 6 + 6 * Math.abs(b.R[4]), '255,250,230', 0.5 + 0.5 * Math.abs(b.R[4])); }
      if (s.fired) heightTag(api, c, b.pos, (b.pos[1] - b.rest0) * UNIT_M);
    },
    stat: s => `Coin went ${f1(peakOf(s.body))} m up · ${s.clinks} clinks`,
  };

  // ---- #27 tennis ball: the bomb splits it — rubbery chunks and fuzz all over the gali ----
  THINGS.ball = {
    label: 'Tennis ball', line: 'Ball ke tukde poore mohalle mein. Aaj ka match cancel.', maxT: 12,
    build(s, api) {
      s.mesh = sphere(0.165, { lat: 7, lon: 14, colourAt: (i, j, lat, lon) => { const y = i / lat - 0.5, seam = 0.28 * Math.sin(j / lon * TAU * 2); return Math.abs(y - seam) < 0.09 ? [236, 236, 220] : [206, 222, 70]; } });
      for (const f of s.mesh.faces) f.back = [70, 64, 48];       // the dark rubber inside
      s.pos = [0, 0.25 + 0.165, 0];
    },
    wick: () => [0.32, 0.03, 0.12],
    fire(s, api) {
      const z = s.size;
      bang(s, api, [0, 0.1, 0], z, { muffle: 0.1 });
      const world = Mesh.place(s.mesh.faces, M3.I(), s.pos);
      s.shards = shards(api, world, Math.round(4 + 2 * z), { from: [0, 0.12, 0], v: [9, 20].map(v => v * z), up: [12, 28].map(v => v * Math.sqrt(z)), mass: 0.004, material: 'shell', detune: 1.7, e: 0.5, linDrag: 0.35 });
      api.paper(s.pos, Math.round(26 * z), 5 * z, [[206, 222, 70], [236, 236, 220], [180, 200, 60]]);
      api.say('Ball phat gayi!!');
    },
    step(s) { return s.shards && !s.shards.some(sh => sh.body.awake); },
    update(s, dt) { if (!s.shards) return; for (const sh of s.shards) { for (let i = 0; i < 3; i++) sh.body.step(dt / 3); tame(sh.body); } },
    paint(s, api, c) {
      if (!s.fired) { wickLine(api, c, [0.12, 0.02, 0.05], this.wick()); api.shadow(s.pos, 0.18, s.pos[1] - 0.165); api.drawFaces(Mesh.place(s.mesh.faces, M3.I(), s.pos)); return; }
      if (s.shards) drawShards(api, s.shards, 0.06);
    },
    stat: s => s.shards ? `${s.shards.length} tukde · farthest ${f1(Math.max(...s.shards.map(sh => distOf(sh.body))))} m` : '',
  };

  // ---- #28 brick: how far did it go? (with the chalk-and-tape measurement left on the road) ----
  THINGS.brick = {
    label: 'Brick', line: 'Inch-tape nikla. Phir jhagda shuru.',
    build(s, api) {
      s.heading = api.aim([0, 0, 0]) + rnd(-0.4, 0.4);
      s.dir = [Math.cos(s.heading), 0, Math.sin(s.heading)];
      s.mesh = box(1.15, 0.375, 0.55, { div: 2, colourAt: (n, a, b) => { const k = 0.85 + 0.3 * hash(a + n.length, b); return [158 * k, 74 * k, 52 * k]; } });
      s.body = mkBody(s, api, { pos: [0, 0.19, 0], R: M3.rotY(-s.heading), mass: 2.5, inertia: 0.3, e: 0.12, mu: 0.6, cld: 2.6, hull: s.mesh.hull, material: 'clay', detune: 0.5, loud: 18,
        hit: (sp, p) => { if (sp > 6) api.smoke(p, 2, { size: 0.5 }); } });
      s.bombAt = [-s.dir[0] * 0.72, 0, -s.dir[2] * 0.72];
    },
    wick(s) { return [s.bombAt[0] - s.dir[0] * 0.3 + 0.12, 0.03, s.bombAt[2] - s.dir[2] * 0.3 + 0.12]; },
    fire(s, api) {
      const z = s.size, k = Math.pow(z, 0.6), d = s.dir, perp = [-d[2], 0, d[0]];
      bang(s, api, [s.bombAt[0], 0.05, s.bombAt[2]], z, { muffle: 0.15 });
      s.body.kick([d[0] * rnd(9, 13) * k, rnd(6, 10) * k, d[2] * rnd(9, 13) * k], v3.scale(perp, rnd(5, 9) * (Math.random() < 0.5 ? -1 : 1)));
    },
    step(s, api) {
      if (!s.taped && !s.body.awake && s.body.age > 0.6) {
        s.taped = true;
        const from = [0, 0, 0], to = [s.body.pos[0], 0, s.body.pos[2]], m = distOf(s.body);
        api.remain((ctx, A) => {
          const c = A.cam, len = Math.hypot(to[0], to[2]); if (len < 0.1) return;
          const ux = to[0] / len, uz = to[2] / len;
          ctx.save(); ctx.setLineDash([6, 5]); line(ctx, c, from, to, 'rgba(240,236,220,.75)', 1.6); ctx.setLineDash([]);
          for (let t = 0; t <= len + 0.01; t += 2.5) line(ctx, c, [ux * t - uz * 0.18, 0, uz * t + ux * 0.18], [ux * t + uz * 0.18, 0, uz * t - ux * 0.18], 'rgba(240,236,220,.8)', 1.4);
          const q = proj(c, [to[0] + ux * 0.9, 0, to[2] + uz * 0.9]);
          ctx.font = '600 12px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(245,240,225,.9)'; ctx.fillText(`${f1(m)} m`, q.x, q.y); ctx.restore();
        });
      }
      return s.taped;
    },
    paint(s, api, c) {
      if (!s.fired) { drawBomb(api, s, s.bombAt); wickLine(api, c, [s.bombAt[0], 0.12, s.bombAt[2]], this.wick(s)); }
      drawBody(api, s.body, s.mesh.faces, 0.6);
    },
    stat: s => `Brick moved ${f1(distOf(s.body))} m`,
  };

  // ---- #36 hole with a stone on top: the homemade volcano ----
  THINGS.stone = {
    label: 'Stone on a hole', line: 'Mohalle ka pehla jwalamukhi.',
    build(s, api) {
      s.mesh = sphere(0.3, { lat: 5, lon: 9, jitter: 0.35, squash: 0.8, seed: 3, colourAt: (i, j) => { const k = 0.75 + 0.4 * hash(i, j); return [128 * k, 122 * k, 112 * k]; } });
      s.body = mkBody(s, api, { pos: [0, 0.24, 0], mass: 0.7, inertia: 0.7 * 0.04, e: 0.2, mu: 0.7, cld: 1.5, hull: s.mesh.hull, material: 'clay', detune: 0.9, loud: 22 });
    },
    wick: () => [0.55, 0.03, 0.2],
    fire(s, api) {
      const z = s.size, k = Math.pow(z, 0.6);
      bang(s, api, [0, 0.02, 0], z, { muffle: 0.45, fire: 0.4, paper: 8 });
      s.body.kick([rnd(-2, 2), rnd(22, 30) * k, rnd(-2, 2)], [rnd(-12, 12), rnd(-12, 12), rnd(-12, 12)]);
      for (let i = 0; i < Math.round(90 * z); i++) api.spark([rnd(-0.1, 0.1), 0.1, rnd(-0.1, 0.1)], [rnd(-2.5, 2.5), rnd(10, 24) * z, rnd(-2.5, 2.5)], { life: rnd(0.4, 1.0) });
      spray(s, api, 110 * z, [0, 0.1, 0], { shape: 'bead', out: [0, 4], up: [12, 30], colours: [[96, 72, 46], [120, 92, 60], [80, 60, 40]], size: [0.03, 0.07] });
      for (const b of s.bits) { b.up = 0.8; b.down = 1; }
      for (let i = 0; i < 6; i++) at(s, i * 0.22, () => api.smoke([0, 0.3 + i * 0.5, 0], 3, { size: 0.9 }));
      keepBits(s, api);
      api.remain((ctx, A) => { const c = A.cam; ctx.fillStyle = 'rgba(10,8,6,.85)'; path(ctx, c, circle(0, 0.002, 0, 0.32, 16)); ctx.fill(); });
    },
    paint(s, api, c) {
      if (!s.fired) { api.ctx.fillStyle = 'rgba(10,8,6,.85)'; path(api.ctx, c, circle(0, 0.002, 0, 0.32, 16)); api.ctx.fill(); wickLine(api, c, [0.28, 0.01, 0.08], this.wick()); }
      drawBody(api, s.body, s.mesh.faces, 0.32);
      if (s.fired) heightTag(api, c, s.body.pos, (s.body.pos[1] - s.body.rest0) * UNIT_M);
    },
    stat: s => `Stone jumped ${f1(peakOf(s.body))} m · dirt to ${f1(bitsTop(s))} m`,
  };

  // ---- #41 manhole lid: the heavy iron disc hops, clangs, and the kids scatter ----
  THINGS.manhole = {
    label: 'Manhole lid', line: 'Dhakkan uchhla. Bachche gaayab.',
    build(s, api) {
      const iron = [74, 72, 70];
      s.mesh = Mesh.cylinder(1.5, 0.3, { segs: 22, bands: 1, rgb: [62, 60, 58], top: iron, bottom: [40, 38, 36] });
      const top = 0.152;
      for (let i = -2; i <= 2; i++) {
        const z = i * 0.5, half = Math.sqrt(Math.max(0, 1.42 * 1.42 - z * z));
        s.mesh.faces.push({ pts: [[-half, top, z - 0.07], [half, top, z - 0.07], [half, top, z + 0.07], [-half, top, z + 0.07]], n: [0, 1, 0], rgb: [96, 92, 86] });
      }
      s.mesh.faces.push({ pts: circle(0, top + 0.002, 0, 0.4, 12).reverse(), n: [0, 1, 0], rgb: [90, 86, 80] });
      s.body = mkBody(s, api, { pos: [0, 0.15, 0], mass: 40, inertia: 40 * (3 * 2.25 + 0.09) / 12, e: 0.25, mu: 0.6, cld: 3, hull: s.mesh.hull, material: 'tin', detune: 0.42, loud: 10,
        hit: (sp, p) => { s.clangs++; api.Sfx.strike('postbox', { vol: clamp(sp / 12, 0.1, 0.8), detune: 0.6, pan: api.panOf(p) }); api.smoke(p, 2, { size: 0.6 }); } });
      s.clangs = 0;
    },
    wick: () => [1.62, 0.03, 0.45],
    fire(s, api) {
      const z = s.size, k = Math.pow(z, 0.7) / Math.pow(1.5, 0.7);
      bang(s, api, [0, 0.05, 0], z, { muffle: 0.7, fire: 0.35, paper: 6, flat: true, vol: 0.95 });
      api.Sfx.strike('tin', { vol: 0.9, detune: 0.42, pan: api.panOf([0, 0, 0]) });
      // CHAOS: the 40 kg lid rockets up, tumbling, and a fire jet roars out of the hole
      const side = Math.random() < 0.5 ? -1 : 1;
      s.body.kick([side * rnd(2, 4) * k, rnd(24, 30) * k, rnd(-2, 1)], [rnd(5, 9) * side, rnd(-2, 2), rnd(-6, 6)]);
      api.shake(16); api.light([0, 0.4, 0], 1.3, [255, 160, 70]);
      for (let i = 0; i < 26; i++) at(s, i * 0.05, () => { api.burst([rnd(-0.6, 0.6), 0.15, rnd(-0.6, 0.6)], 26, 16, { lift: 2.6, life: 0.9 }); if (i % 4 === 0) api.Sfx.boom({ vol: 0.18, size: 0.3, muffle: 0.6, pan: api.panOf([0, 0, 0]) }); });
      api.paper([0, 0.2, 0], 70, 9, [[96, 84, 70], [70, 62, 54], [176, 48, 38], [120, 110, 96]]);
      for (let i = 0; i < 12; i++) at(s, 0.15 + i * 0.25, () => api.smoke([rnd(-1.4, 1.4), 0.1, rnd(-0.6, 1.4)], 3, { size: 1 }));
      at(s, 0.25, () => api.say('BHAAGO!!'));
    },
    paint(s, api, c) {
      const ctx = api.ctx;
      ctx.fillStyle = 'rgba(44,42,40,.95)'; path(ctx, c, circle(0, 0.002, 0, 1.68, 28)); ctx.fill();
      ctx.fillStyle = '#060504'; path(ctx, c, circle(0, 0.003, 0, 1.46, 28)); ctx.fill();
      if (!s.fired) wickLine(api, c, [1.4, 0.03, 0.4], this.wick());
      drawBody(api, s.body, s.mesh.faces, 1.5);
    },
    stat: s => `40 kilo ka dhakkan ${f1(peakOf(s.body))} m upar · ${s.clangs} clangs`,
  };

  // ---- #43 the bundle: three atom bombs, wicks twisted into one ----
  const TRIO = [[0.135, 0, 0], [-0.068, 0, 0.117], [-0.068, 0, -0.117]];
  THINGS.bundle = {
    label: 'The bundle', line: 'Teen atom, ek hydrogen. Kaan ab bhi baj rahe hain.', size: 1.4,
    build(s) { s.bombKind = 'atom'; },
    wick: () => [0.55, 0.05, 0.3],
    fire(s, api) {
      const z = s.size;
      for (let i = 0; i < 3; i++) at(s, i * 0.025, () => api.light([TRIO[i][0], 0.3, TRIO[i][2]], 1.4));
      bang(s, api, [0, 0.08, 0], z, { muffle: 0.05, paper: 20, smoke: 18, scorch: 0.55, shake: 1.15 });
      api.Sfx.crack({ vol: 0.8, pieces: 3, pan: api.panOf([0, 0, 0]) });
      spray(s, api, 160, [0, 0.1, 0], { shape: 'rect', out: [10, 30], up: [12, 32], colours: [[180, 44, 36], [204, 168, 70], [150, 38, 30], [60, 120, 70]], size: [0.05, 0.09], flutter: 10 });
      for (const b of s.bits) { b.up = 1.0; b.down = 4; }
      keepBits(s, api);
    },
    paint(s, api, c) {
      if (s.fired) return;
      for (const p of TRIO) drawBomb(api, s, p);
      const ctx = api.ctx;
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = k ? '#a89878' : '#c4b48e'; ctx.lineWidth = 1.4; ctx.beginPath();
        for (let i = 0; i <= 12; i++) { const u = i / 12, tw = Math.sin(u * 10 + k * 2.1) * 0.03, q = proj(c, [u * 0.55 + tw, 0.26 - u * 0.21, u * 0.3 + tw]); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
        ctx.stroke();
      }
    },
    stat: s => `3 atoms, 1 bang · paper flew ${f1(bitsFar(s))} m`,
  };

  // ---- #24 matka: clay shrapnel everywhere ----
  THINGS.matka = {
    label: 'Matka', line: 'Matka phoota. Paani nahi, bas thikre hi thikre.',
    build(s) {
      s.mesh = latheY([[0, 0.34], [0.15, 0.6], [0.5, 0.82], [0.9, 0.85], [1.25, 0.7], [1.5, 0.42], [1.62, 0.33], [1.72, 0.38], [1.78, 0.37]], {
        segs: 16, back: [96, 50, 32], colourAt: (i, k) => { if (i === 3 && k % 2) return [44, 30, 24]; const h = 0.88 + 0.2 * hash(i, k); return [176 * h, 92 * h, 58 * h]; } });
    },
    wick: () => [0.48, 1.86, 0.06],
    fire(s, api) {
      const z = s.size;
      s.shards = shards(api, s.mesh.faces, Math.round(8 + 8 * z), { from: [0, 0.6, 0], v: [7, 15].map(v => v * z), up: [3, 9].map(v => v * z), mass: 0.012, material: 'clay', e: 0.22 });
      api.Sfx.crack({ vol: 0.85, pieces: 9, pan: api.panOf([0, 0, 0]) });
      api.Sfx.strike('clay', { vol: 0.8, pan: api.panOf([0, 0, 0]) });
      bang(s, api, [0, 0.6, 0], z, { muffle: 0.35, fire: 0.6, paper: 10, smoke: 18 });
      spray(s, api, 70 * z, [0, 0.7, 0], { shape: 'bead', out: [5, 16].map(v => v * z), up: [4, 14], colours: [[178, 94, 58], [150, 78, 48], [196, 112, 70]], size: [0.02, 0.05] });
      for (const b of s.bits) b.up = 0.4;
      keepBits(s, api);
    },
    step(s) { return !s.shards.some(sh => sh.body.awake); },
    update(s, dt) { for (const sh of s.shards) { for (let i = 0; i < 3; i++) sh.body.step(dt / 3); tame(sh.body); } },
    paint(s, api, c) {
      if (!s.fired) { api.shadow([0, 0, 0], 0.9, 0); api.drawFaces(s.mesh.faces); wickLine(api, c, [0.1, 1.72, 0.02], this.wick()); return; }
      drawShards(api, s.shards, 0.12);
    },
    stat: s => `${s.shards.length} thikre · farthest ${f1(Math.max(bitsFar(s), ...s.shards.map(sh => distOf(sh.body))))} m`,
  };

  // ---- #32 empty cardboard cracker box: lid off, sides ripped open in one go ----
  const PRINT = [[214, 44, 40], [240, 192, 44], [40, 122, 72], [44, 74, 164], [236, 120, 40]];
  THINGS.box = {
    label: 'Cracker box', line: 'Khaali dabba, aakhri baar kaam aaya.',
    build(s, api) {
      const print = (n, a, b) => n === 'bottom' ? [150, 120, 80] : PRINT[Math.floor(hash(a + n.length * 3, b) * PRINT.length)];
      s.tray = box(1.5, 0.45, 1.0, { div: 3, skip: ['top'], back: [160, 128, 86], colourAt: print }).faces.map(f => ({ ...f, pts: f.pts.map(p => [p[0], p[1] + 0.225, p[2]]) }));
      s.lid = box(1.56, 0.12, 1.06, { div: 2, colourAt: (n, a, b) => n === 'top' ? PRINT[(a * 2 + b + 1) % PRINT.length] : n === 'bottom' ? [160, 128, 86] : [214, 44, 40] });
      s.body = mkBody(s, api, { pos: [0, 0.51, 0], mass: 0.08, inertia: 0.08 * (1.56 * 1.56 + 1.06 * 1.06) / 12, e: 0.2, mu: 0.6, linDrag: 0.3, angDrag: 0.4, hull: s.lid.hull, material: 'shell', detune: 0.35, loud: 40, vmax: 0.3 });
    },
    wick: () => [0.98, 0.04, 0.42],
    fire(s, api) {
      const z = s.size;
      s.shards = shards(api, s.tray, 6, { from: [0, 0.1, 0], v: [6, 12].map(v => v * z), up: [2, 6], mass: 0.008, material: 'shell', detune: 0.4, linDrag: 0.6 });
      const la = rnd(0, TAU), ls = rnd(5, 9) * z; s.body.kick([Math.cos(la) * ls, rnd(14, 20) * Math.pow(z, 0.6), Math.sin(la) * ls], [rnd(-14, 14), rnd(-8, 8), rnd(-14, 14)]);
      bang(s, api, [0, 0.2, 0], z, { muffle: 0.3, paper: 34, paperRgb: [...PRINT, [176, 48, 38]] });
      api.Sfx.crack({ vol: 0.6, pieces: 4, pan: api.panOf([0, 0, 0]) });
    },
    step(s) { return !s.shards.some(sh => sh.body.awake); },
    update(s, dt) { for (const sh of s.shards) { for (let i = 0; i < 3; i++) sh.body.step(dt / 3); tame(sh.body); } },
    paint(s, api, c) {
      if (!s.fired) { api.shadow([0, 0, 0], 0.9, 0); api.drawFaces(s.tray); wickLine(api, c, [0.75, 0.03, 0.3], this.wick()); }
      else drawShards(api, s.shards, 0.12);
      drawBody(api, s.body, s.lid.faces, 0.8);
    },
    stat: s => `Lid flew ${f1(distOf(s.body))} m · box in ${s.shards.length} pieces`,
  };

  // ---- #31 thermocol box: white "snow" all over the aangan ----
  THINGS.thermocol = {
    label: 'Thermocol box', line: 'Aangan mein December aa gaya.',
    build(s) {
      s.mesh = box(1.6, 1.0, 1.1, { div: 3, colourAt: (n, a, b) => { const k = 0.93 + 0.07 * hash(a + n.length, b); return [238 * k, 238 * k, 232 * k]; } }).faces.map(f => ({ ...f, pts: f.pts.map(p => [p[0], p[1] + 0.5, p[2]]), back: [220, 220, 214] }));
    },
    wick: () => [1.0, 0.04, 0.45],
    fire(s, api) {
      const z = s.size;
      s.shards = shards(api, s.mesh, Math.round(5 + 3 * z), { from: [0, 0.3, 0], v: [6, 12].map(v => v * z), up: [4, 9], mass: 0.002, material: 'shell', detune: 2.2, linDrag: 1.2, e: 0.3 });
      bang(s, api, [0, 0.4, 0], z, { muffle: 0.3, paper: 10, fire: 0.7 });
      api.Sfx.crack({ vol: 0.5, pieces: 6, pan: api.panOf([0, 0, 0]) });
      spray(s, api, 340, [0, 0.6, 0], { shape: 'bead', out: [4, 22].map(v => v * Math.sqrt(z)), up: [14, 36].map(v => v * Math.sqrt(z)), colours: [[248, 248, 244], [234, 236, 232], [255, 255, 250]], size: [0.02, 0.045], spread: 0.7, flutter: 9 });
      for (const b of s.bits) { b.up = 0.9; b.down = 6; }
      keepBits(s, api);
    },
    step(s) { return !s.shards.some(sh => sh.body.awake); },
    update(s, dt) { for (const sh of s.shards) { for (let i = 0; i < 3; i++) sh.body.step(dt / 3); tame(sh.body); } },
    paint(s, api, c) {
      if (!s.fired) { api.shadow([0, 0, 0], 1.0, 0); api.drawFaces(s.mesh); wickLine(api, c, [0.8, 0.03, 0.4], this.wick()); return; }
      drawShards(api, s.shards, 0.15);
    },
    stat: s => `Snow over ${f1(bitsFar(s))} m · ${s.bits.length} flakes`,
  };

  // ---- #20 the red pillar box: dhup from inside, light in the slot, smoke curling out ----
  const PB = [0, 0, -1.5];
  THINGS.postbox = {
    label: 'Pillar postbox', line: 'Dhup. Poore mohalle ne suna, kisi ne dekha nahi.', minT: 3,
    build(s) {
      const red = [176, 28, 24];
      s.mesh = latheY([[0, 1.25], [0.35, 1.25], [0.35, 1.1], [4.9, 1.1], [4.9, 1.22], [5.25, 1.22], [5.25, 1.08], [5.7, 0.82], [6.0, 0.42], [6.12, 0]], {
        segs: 20, colourAt: i => i <= 1 ? [58, 52, 48] : i === 3 ? [118, 20, 16] : i === 2 ? red : [184, 32, 26] });
      s.slot = { pts: [[-0.36, 4.45, 1.11], [0.36, 4.45, 1.11], [0.36, 4.58, 1.11], [-0.36, 4.58, 1.11]], n: [0, 0, 1], rgb: [16, 10, 8] };
      s.decals = [
        { pts: [[-0.42, 4.62, 1.1], [0.42, 4.62, 1.1], [0.42, 4.7, 1.24], [-0.42, 4.7, 1.24]], n: [0, 0.85, 0.53], rgb: [160, 24, 20] },
        { pts: [[-0.4, 2.9, 1.11], [0.4, 2.9, 1.11], [0.4, 3.6, 1.11], [-0.4, 3.6, 1.11]], n: [0, 0, 1], rgb: [222, 214, 190] },
        s.slot,
      ];
      s.slotAt = [PB[0], 4.5, PB[2] + 1.15];
      s.glow = 0; s.boomT = 0.5; s.smokeUntil = 0.5 + rnd(3.2, 4.6);
    },
    wick(s) { return [s.slotAt[0] + 0.2, s.slotAt[1] + 0.05, s.slotAt[2] + 0.25]; },
    fire(s, api) {
      const z = s.size, pan = api.panOf(PB);
      api.Sfx.rustle({ vol: 0.12, pan });
      api.Sfx.strike('postbox', { vol: 0.12, detune: 1.4, pan });
      at(s, s.boomT, () => {
        api.Sfx.boom({ vol: 0.9, size: z, muffle: 0.85, pan });
        api.Sfx.strike('postbox', { vol: 0.75, pan });
        api.shake(3 * z); api.light(s.slotAt, 0.6, [255, 150, 60]); s.glow = 1;
      });
      for (const [t, v] of [[0.62, 0.35], [0.76, 0.2], [0.93, 0.1]]) at(s, t, () => api.Sfx.strike('postbox', { vol: v * z, detune: 1.08, pan }));
    },
    step(s, api, dt, e) {
      s.glow *= Math.exp(-dt * 2.2);
      if (e > s.boomT + 0.1 && e < s.smokeUntil && (s.puff = (s.puff || 0) - dt) <= 0) { s.puff = 0.16; api.smoke([s.slotAt[0] + rnd(-0.3, 0.3), s.slotAt[1], s.slotAt[2]], 1, { size: 0.55 }); }
      return e > s.smokeUntil;
    },
    paint(s, api, c) {
      const k = s.fired && s.e > s.boomT ? 0.06 * s.size * Math.exp(-(s.e - s.boomT) * 5) : 0;
      const off = [PB[0] + Math.sin(s.e * 61) * k, PB[1], PB[2] + Math.cos(s.e * 47) * k * 0.5], R = M3.rotZ(Math.sin(s.e * 53) * k * 0.05);
      api.shadow(PB, 1.4, 0);
      s.slot.rgb = [16 + 239 * s.glow, 10 + 150 * s.glow, 8 + 52 * s.glow];
      api.drawFaces(Mesh.place(s.mesh.faces, R, off));
      api.drawFaces(Mesh.place(s.decals, R, off));
      if (s.glow > 0.02) { const q = proj(c, s.slotAt); glow(api.ctx, q.x, q.y, c.scale * 1.2 * q.f, '255,150,60', s.glow * 0.8, 0.35); }
      if (!s.fired) { const w = proj(c, this.wick(s)); glow(api.ctx, w.x, w.y, 8, '255,190,90', 0.3); }
    },
    stat: s => `Smoke from the slot ${f1(s.smokeUntil - s.boomT)} s · 0 witnesses`,
  };

  // ---- #117 the house letterbox on its post: thud, the flap bangs open, letters flutter out ----
  const LB = [0, 0, -1];
  THINGS.letterbox = {
    label: 'House letterbox', line: 'Daakiya uncle kal poochhenge. Hum kahenge, pata nahi.', minT: 2.5,
    build(s) {
      const red = [170, 32, 28];
      s.mesh = [
        ...box(0.9, 1.1, 0.5, { rgb: red, colourAt: n => n === 'top' ? [150, 28, 24] : red }).faces.map(f => ({ ...f, pts: f.pts.map(p => [p[0], p[1] + 5.5, p[2]]) })),
        ...box(0.14, 4.95, 0.14, { rgb: [52, 50, 48], skip: ['top', 'bottom'] }).faces.map(f => ({ ...f, pts: f.pts.map(p => [p[0], p[1] + 2.475, p[2]]) })),
      ];
      s.slotFace = { pts: [[-0.32, 5.66, 0.252], [0.32, 5.66, 0.252], [0.32, 5.86, 0.252], [-0.32, 5.86, 0.252]], n: [0, 0, 1], rgb: [14, 10, 8] };
      s.hinge = [0, 5.9, 0.256];
      s.flapLocal = [[-0.36, 0, 0], [0.36, 0, 0], [0.36, -0.26, 0], [-0.36, -0.26, 0]];
      s.theta = 0; s.omega = 0; s.maxTheta = 0; s.letters = 0;
      s.boomT = 0.4;
    },
    wick: () => [LB[0] + 0.25, 5.95, LB[2] + 0.55],
    fire(s, api) {
      const z = s.size, pan = api.panOf(LB);
      api.Sfx.rustle({ vol: 0.1, pan });
      at(s, s.boomT, () => {
        api.Sfx.boom({ vol: 0.85, size: z, muffle: 0.8, pan });
        api.Sfx.strike('tin', { vol: 0.7, detune: 0.8, pan });
        api.shake(2.5 * z); api.light([LB[0], 5.7, LB[2] + 0.4], 0.5, [255, 150, 60]);
        s.omega = rnd(15, 20) * Math.sqrt(z); s.glow = 1;
        const n = Math.round(rnd(2, 4)); s.letters = n;
        const base = [LB[0], 5.75, LB[2] + 0.35];
        const colours = [[152, 184, 216], [244, 240, 228], [236, 226, 200]];
        for (let i = 0; i < n; i++) s.bits.push(bit(base, [rnd(-2, 2), rnd(3, 7), rnd(4, 9)], { shape: 'rect', rgb: colours[i % 3], size: rnd(0.28, 0.4), up: 2.5, down: 6, flutter: 8 }));
        keepBits(s, api);
      });
      for (let i = 0; i < 8; i++) at(s, s.boomT + 0.1 + i * 0.22, () => api.smoke([LB[0] + rnd(-0.2, 0.2), 5.75, LB[2] + 0.35], 1, { size: 0.5 }));
    },
    step(s, api, dt, e) {
      s.glow = (s.glow || 0) * Math.exp(-dt * 3);
      const sub = 4, h = dt / sub;
      for (let i = 0; i < sub; i++) {
        s.omega += (-16 * Math.sin(s.theta) - 1.6 * s.omega) * h;
        s.theta += s.omega * h;
        if (s.theta < 0) { if (s.omega < -2) api.Sfx.strike('tin', { vol: clamp(-s.omega / 30, 0.05, 0.4), detune: 1.3, pan: api.panOf(LB) }); s.theta = 0; s.omega = -s.omega * 0.3; }
        if (s.theta > 2.6) { s.theta = 2.6; s.omega = -Math.abs(s.omega) * 0.4; }
        s.maxTheta = Math.max(s.maxTheta, s.theta);
      }
      return e > s.boomT + 1.5 && Math.abs(s.omega) < 0.2 && s.theta < 0.05;
    },
    paint(s, api, c) {
      const k = s.fired && s.e > s.boomT ? 0.05 * s.size * Math.exp(-(s.e - s.boomT) * 6) : 0;
      const off = [LB[0] + Math.sin(s.e * 63) * k, 0, LB[2]];
      api.shadow(LB, 0.4, 0);
      api.drawFaces(moved(s.mesh, off));
      const g = s.glow || 0;
      s.slotFace.rgb = [14 + 240 * g, 10 + 150 * g, 8 + 50 * g];
      const R = M3.rotX(-s.theta), hinge = v3.add(s.hinge, off);
      const flap = { pts: s.flapLocal.map(p => v3.add(M3.mulV(R, p), hinge)), n: M3.mulV(R, [0, 0, 1]), rgb: [184, 36, 30], back: [120, 24, 20] };
      api.drawFaces([{ ...s.slotFace, pts: s.slotFace.pts.map(p => v3.add(p, [off[0], 0, LB[2]])) }]);
      api.drawFaces([flap]);
      if (!s.fired) { const w = proj(c, this.wick()); glow(api.ctx, w.x, w.y, 8, '255,190,90', 0.3); }
    },
    stat: s => `Flap swung ${Math.round(s.maxTheta * 180 / Math.PI)}° · ${s.letters} letters out`,
  };

  // ---- #39 empty oil drum: the sutli becomes a war drum ----
  const DR = [0, 0, -5];
  THINGS.drum = {
    label: 'Oil drum', line: 'Sutli + khaali drum = jung ka nagada.', minT: 3,
    build(s, api) {
      s.mesh = Mesh.cylinder(1.43, 4.4, { segs: 20, bands: 5, top: false, bottom: false, inner: [36, 34, 32],
        colourAt: (k, b) => (b === 1 || b === 3) ? [28, 56, 98] : hash(k, b) > 0.82 ? [124, 72, 42] : [42, 84, 146] });
      s.body = mkBody(s, api, { pos: [DR[0], 2.2, DR[2]], mass: 18, inertia: 18 * (3 * 2.04 + 19.4) / 12, e: 0.2, mu: 0.6, cld: 3, hull: s.mesh.hull, material: 'blast-drum', loud: 8,
        hit: () => { s.beats++; } });
      s.beats = 0; s.boomT = 0.3;
    },
    wick: () => [DR[0] + 0.3, 4.95, DR[2] + 0.2],
    fire(s, api) {
      const z = s.size, pan = api.panOf(DR), top = [DR[0], 4.45, DR[2]];
      at(s, 0.08, () => api.Sfx.strike('blast-drum', { vol: 0.2, detune: 1.5, pan }));
      at(s, s.boomT, () => {
        api.Sfx.boom({ vol: 0.95, size: z, muffle: 0.45, pan });
        api.Sfx.strike('blast-drum', { vol: 1, pan }); api.Sfx.strike('tin', { vol: 0.45, detune: 0.5, pan });
        s.beats++;
        for (const r of [2, 3]) for (const p of s.mesh.rings[r]) { p[0] *= 1.055; p[2] *= 1.055; }
        s.body.kick([rnd(-0.5, 0.5), rnd(5, 8) * Math.pow(z, 0.6), rnd(-0.5, 0.5)], [rnd(-0.6, 0.6), 0, rnd(-0.6, 0.6)]);
        for (let i = 0; i < Math.round(130 * z); i++) api.spark([top[0] + rnd(-0.8, 0.8), top[1], top[2] + rnd(-0.8, 0.8)], [rnd(-3, 3), rnd(14, 30) * Math.sqrt(z), rnd(-3, 3)], { life: rnd(0.4, 1.1) });
        api.smoke(top, Math.round(24 * z), { size: 1.3 });
        api.light(top, 1.2, [255, 160, 70]); api.shake(6 * z);
      });
      echoes(s, api, s.boomT, 2, 0.22, z, 0.45, 0.6, pan, 0.55);
      for (let i = 0; i < 6; i++) at(s, s.boomT + 0.4 + i * 0.3, () => api.smoke([DR[0], 4.6, DR[2]], 2, { size: 1 }));
    },
    paint(s, api) { drawBody(api, s.body, s.mesh.faces, 1.5); },
    stat: s => `Hopped ${Math.round(peakOf(s.body) * 100)} cm · ${s.beats} drum beats`,
  };

  // ---- #33 naali: muffled boom, splash, a wet stain and the smell ----
  THINGS.naali = {
    label: 'Naali', line: 'Dhup, chhapaak, aur woh badbu. Teen din tak.', minT: 3.5,
    build(s) {
      s.kerbs = [
        ...box(18, 0.2, 0.35, { rgb: [150, 146, 136], skip: ['bottom'] }).faces.map(f => ({ ...f, pts: f.pts.map(p => [p[0], p[1] + 0.1, p[2] - 0.975]) })),
        ...box(18, 0.2, 0.35, { rgb: [160, 156, 146], skip: ['bottom'] }).faces.map(f => ({ ...f, pts: f.pts.map(p => [p[0], p[1] + 0.1, p[2] + 0.975]) })),
      ];
      s.stains = []; s.boomT = 0.35;
    },
    wick: () => [0.35, 0.3, 1.0],
    fire(s, api) {
      const z = s.size, pan = api.panOf([0, 0, 0]);
      at(s, 0.12, () => api.Sfx.strike('blast-plop', { vol: 0.3, pan }));
      at(s, s.boomT, () => {
        api.Sfx.boom({ vol: 0.85, size: z, muffle: 0.6, pan });
        api.Sfx.strike('blast-plop', { vol: 0.7, detune: 0.6, pan });
        api.shake(3 * z); api.light([0, 0.2, 0], 0.5);
        spray(s, api, 220 * z, [0, -0.1, 0], { shape: 'drop', out: [2, 10].map(v => v * z), up: [14, 30].map(v => v * Math.sqrt(z)), xs: 1.3, zs: 0.6, spread: 1.4, colours: [[150, 172, 160], [112, 130, 98], [220, 232, 236], [96, 108, 80]], size: [0.025, 0.05] });
        for (const b of s.bits) { b.up = 0.5; b.down = 0.5; }
        api.smoke([0, 0.1, 0], Math.round(6 * z), { size: 0.8 });
        const stains = s.stains;
        api.remain((ctx, A) => { for (const p of stains) groundMark(ctx, A.cam, p, p[3], '8,12,8', 0.42); });
        s.stinkFrom = s.e;
      });
    },
    land(s, b) { if (s.stains.length < 140 && Math.abs(b.p[2]) > 1.1) s.stains.push([b.p[0], 0, b.p[2], rnd(0.15, 0.35)]); },
    paint(s, api, c) {
      const ctx = api.ctx, open = [[-9, 0, -0.8], [9, 0, -0.8], [9, 0, 0.8], [-9, 0, 0.8]];
      ctx.save(); path(ctx, c, open); ctx.fillStyle = '#0b0d0b'; ctx.fill(); ctx.clip();
      path(ctx, c, [[-9, 0, -0.8], [9, 0, -0.8], [9, -0.35, -0.8], [-9, -0.35, -0.8]]); ctx.fillStyle = '#2a2c26'; ctx.fill();
      path(ctx, c, [[-9, -0.35, -0.8], [9, -0.35, -0.8], [9, -0.35, 0.8], [-9, -0.35, 0.8]]); ctx.fillStyle = 'rgba(38,48,32,.95)'; ctx.fill();
      for (let i = -4; i <= 4; i++) { const z = -0.5 + 0.8 * hash(i, 2); line(ctx, c, [i * 2 - 0.4, -0.35, z], [i * 2 + 0.4, -0.35, z + 0.1], 'rgba(150,160,130,.14)', 1); }
      ctx.restore();
      api.drawFaces(s.kerbs);
      if (!s.fired) { const w = proj(c, this.wick()); glow(ctx, w.x, w.y, 8, '255,190,90', 0.3); }
    },
    overlay(s, api, c) {
      if (s.stinkFrom == null) return;
      const u = s.e - s.stinkFrom; if (u > 4.5) return;
      const ctx = api.ctx, a = Math.min(1, u * 2) * Math.max(0, 1 - u / 4.5);
      ctx.save(); ctx.strokeStyle = `rgba(150,190,90,${0.55 * a})`; ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) {
        const x0 = (k - 2) * 1.3; ctx.beginPath();
        for (let i = 0; i <= 10; i++) { const y = 0.3 + i * 0.25 + u * 0.6, q = proj(c, [x0 + Math.sin(i * 0.9 + u * 3 + k) * 0.25, y, 0]); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
        ctx.stroke();
      }
      ctx.restore();
    },
    stat: s => `Splash ${f1(bitsTop(s))} m high · wet patch ${f1(bitsFar(s))} m out`,
  };

  // ---- #37 the well: drop it, count, wait for the echo to come back up ----
  // Real size: 1.1 m across, parapet 0.75 m, a low pulley frame ~1.25 m. Set back and to one side.
  const WL = [0.8, 0, -8], RO = 2.75, RI = 2.3, WH = 3.75, FT = WH + 2.4, BY = WH + 0.75;
  const atWell = (faces, y = 0) => faces.map(f => ({ ...f, pts: f.pts.map(p => [p[0] + WL[0], p[1] + y, p[2] + WL[2]]) }));
  THINGS.well = {
    label: 'Well', line: 'Kuein ne jawab diya. Der se, par diya.', minT: 3,
    build(s) {
      // whitewashed lime plaster in three soft horizontal bands: grimy foot, clean middle, worn coping
      const BANDS = [[168, 160, 146], [214, 208, 194], [198, 192, 178]];
      s.wall = atWell(Mesh.cylinder(RO, WH, { segs: 24, bands: 3, top: false, bottom: false, colourAt: (k, b) => { const v = 0.97 + 0.05 * hash(k, b); return BANDS[b].map(x => x * v); } }).faces, WH / 2);
      const o = circle(WL[0], WH, WL[2], RO + 0.1, 24), i = circle(WL[0], WH, WL[2], RI, 24);
      s.rim = o.map((p, k) => ({ pts: [o[k], o[(k + 1) % 24], i[(k + 1) % 24], i[k]], n: [0, 1, 0], rgb: [156 + 10 * hash(k, 1), 152, 144] }));
      s.inner = atWell(latheY([[-6, RI], [-2, RI], [0.5, RI], [2.4, RI], [WH, RI]], { segs: 18, inward: true, colourAt: b => [[8, 7, 6], [16, 14, 12], [34, 30, 26], [66, 60, 52]][b] }).faces);
      const px = RO - 0.2, post = x => atWell(box(0.16, FT - WH, 0.16, { rgb: [92, 70, 48], skip: ['bottom'] }).faces.map(f => ({ ...f, pts: f.pts.map(p => [p[0] + x, p[1], p[2]]) })), (WH + FT) / 2);
      s.frame = [...post(-px), ...post(px), ...atWell(box(2 * px + 0.3, 0.14, 0.14, { rgb: [100, 76, 52] }).faces, FT),
        ...Mesh.place(Mesh.cylinder(0.24, 0.09, { segs: 10, bands: 1, rgb: [70, 66, 60], top: [90, 86, 80], bottom: [90, 86, 80] }).faces, M3.rotZ(Math.PI / 2), [WL[0], FT - 0.3, WL[2]])];
      s.depthM = rnd(6, 11);
      s.bomb = { y: BY, vy: 0, inWater: false };
      s.glow = 0;
    },
    wick: () => [WL[0] + 0.12, BY + 0.12, WL[2] + 0.1],
    fire(s, api) { s.bomb.vy = 0; s.dropped = true; },
    step(s, api, dt, e) {
      const b = s.bomb, pan = api.panOf(WL);
      s.glow *= Math.exp(-dt * 2.5);
      if (!b.inWater) {
        b.vy -= G * dt; b.y += b.vy * dt;
        if (b.y > WH + 0.1) api.spark([WL[0], b.y, WL[2]], [rnd(-1, 1), rnd(0, 2), rnd(-1, 1)], { life: 0.25, size: 0.7 });
        if (b.y <= -s.depthM / UNIT_M) {
          b.inWater = true; s.fallT = e;
          api.Sfx.strike('blast-plop', { vol: 0.25, detune: 0.7, pan });
          const z = s.size, tb = e + 0.35;
          at(s, tb, () => {
            api.Sfx.boom({ vol: 0.9, size: z, muffle: 0.75, pan });
            api.Sfx.strike('blast-drum', { vol: 0.35, detune: 0.55, pan });
            api.shake(2.5 * z); s.glow = 1; api.light([WL[0], WH + 0.1, WL[2]], 0.7, [255, 150, 70]);
          });
          s.echoN = Math.round(rnd(4, 7));
          s.lastEcho = echoes(s, api, tb, s.echoN, 0.26, z, 0.6, 0.78, pan, 0.66);
          for (let i = 0; i < 8; i++) at(s, tb + 0.5 + i * 0.28, () => api.smoke([WL[0] + rnd(-0.8, 0.8), WH + 0.2, WL[2] + rnd(-0.8, 0.8)], 2, { size: 0.9 }));
          at(s, tb + 0.45, () => spray(s, api, 30 * z, [WL[0], WH, WL[2]], { shape: 'drop', out: [0, 2], up: [8, 16], colours: [[190, 210, 220], [230, 238, 240]], size: [0.025, 0.04], spread: 0.8, du: 0.5, dd: 0.5 }));
        }
      }
      return b.inWater && e > (s.lastEcho || 0) + 0.3;
    },
    paint(s, api, c) {
      const ctx = api.ctx;
      api.shadow(WL, RO * 1.15, 0);
      api.drawFaces(s.wall);
      ctx.save(); path(ctx, c, circle(WL[0], WH, WL[2], RI, 24)); ctx.fillStyle = '#050403'; ctx.fill(); ctx.clip();
      api.drawFaces(s.inner);
      line(ctx, c, [WL[0], WH, WL[2]], [WL[0], -2, WL[2]], 'rgba(150,130,100,.6)', 1.2);
      if (s.dropped && !s.bomb.inWater && s.bomb.y < WH) { const q = proj(c, [WL[0], s.bomb.y, WL[2]]); glow(ctx, q.x, q.y, 6, '255,190,90', clamp(1 + s.bomb.y / 20, 0.1, 0.8)); }
      if (s.glow > 0.02) { const q = proj(c, [WL[0], 0, WL[2]]); glow(ctx, q.x, q.y, c.scale * RI * 1.6 * q.f, '255,150,60', s.glow * 0.9); }
      ctx.restore();
      api.drawFaces(s.rim);
      api.drawFaces(s.frame);
      line(ctx, c, [WL[0], FT - 0.54, WL[2]], [WL[0], WH, WL[2]], 'rgba(170,150,110,.8)', 1.2);
      if (!s.dropped || s.bomb.y >= WH) { const y = s.dropped ? s.bomb.y : BY, q = proj(c, [WL[0], y, WL[2]]); ctx.fillStyle = '#2e6e3e'; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(2, c.scale * 0.125 * q.f), 0, TAU); ctx.fill(); }
    },
    stat: s => {
      const m = 0.5 * 9.8 * (s.fallT || 0) ** 2 - BY * UNIT_M;   // fall time → drop height, minus the hold above the ground
      return `Fell ${f1(s.fallT || 0)} s · about ${f1(Math.max(0, m))} m deep · ${s.echoN || 0} echoes`;
    },
  };

  // ---- #38 pond / tank: plop, underwater thump, a fountain ----
  const PD = [0, 0, -5];
  THINGS.pond = {
    label: 'Pond', line: 'Tank ka paani ek second ke liye khada ho gaya.', minT: 3,
    build(s) { s.ripples = []; s.throwT = 0.8; s.boomT = 0.8 + 0.55; s.from = [1.2, 1.6, 2.5]; s.to = [PD[0] + rnd(-0.6, 0.6), 0, PD[2] + rnd(-0.6, 0.6)]; },
    wick(s) { return s.from; },
    fire(s, api) {
      const z = s.size, pan = api.panOf(PD), T = s.throwT;
      s.v0 = [(s.to[0] - s.from[0]) / T, (s.to[1] - s.from[1]) / T + 0.5 * G * T, (s.to[2] - s.from[2]) / T];
      api.Sfx.whoosh({ vol: 0.08, pan, dur: 0.5 });
      at(s, T, () => {
        api.Sfx.strike('blast-plop', { vol: 0.4, pan }); s.ripples.push([s.to, s.e, 1]);
        spray(s, api, 16, s.to, { shape: 'drop', out: [0, 2], up: [5, 9], colours: [[200, 220, 230]], size: [0.02, 0.035], du: 0.5, dd: 0.6 });
      });
      at(s, s.boomT, () => {
        api.Sfx.boom({ vol: 0.9, size: z, muffle: 0.9, pan });
        api.Sfx.strike('blast-drum', { vol: 0.45, detune: 0.4, pan });
        api.shake(2.5 * z); s.dome = s.e;
        for (let i = 0; i < 3; i++) s.ripples.push([s.to, s.e + i * 0.18, 1.6]);
        spray(s, api, 260 * z, s.to, { shape: 'drop', out: [0, 3.5].map(v => v * z), up: [18, 32].map(v => v * Math.sqrt(z)), colours: [[200, 222, 236], [236, 244, 248], [150, 190, 210]], size: [0.025, 0.05], spread: 0.35 });
        for (const b of s.bits) { b.up = 0.35; b.down = 0.6; }
      });
    },
    land(s, b) { if (s.ripples.length < 24 && Math.random() < 0.06) s.ripples.push([b.p.slice(), s.e, 0.5]); },
    step(s, api) {
      if (s.e < s.throwT) { const t = s.e, p = [s.from[0] + s.v0[0] * t, s.from[1] + s.v0[1] * t - 0.5 * G * t * t, s.from[2] + s.v0[2] * t]; s.bombAt = p; api.spark(p, [rnd(-1, 1), rnd(0, 2), rnd(-1, 1)], { life: 0.3, size: 0.7 }); }
      else s.bombAt = null;
      return true;
    },
    paint(s, api, c) {
      const ctx = api.ctx;
      ctx.fillStyle = '#8c877c'; path(ctx, c, circle(PD[0], 0.002, PD[2], 4.8, 36)); ctx.fill();
      const top = proj(c, [0, 0, PD[2] - 4.2]), bot = proj(c, [0, 0, PD[2] + 4.2]);
      const g = ctx.createLinearGradient(0, top.y, 0, bot.y); g.addColorStop(0, '#3c5560'); g.addColorStop(1, '#13242a');
      ctx.fillStyle = g; path(ctx, c, circle(PD[0], 0.003, PD[2], 4.2, 36)); ctx.fill();
      for (const [p, t0, amp] of s.ripples) {
        const u = s.e - t0; if (u < 0 || u > 2.6) continue;
        ctx.strokeStyle = `rgba(210,230,240,${0.5 * amp * (1 - u / 2.6)})`; ctx.lineWidth = 1.3;
        path(ctx, c, circle(p[0], 0.004, p[2], Math.min(4, 0.2 + u * 1.8 * amp), 22)); ctx.stroke();
      }
      if (s.dome != null && s.e - s.dome < 0.5) {
        const u = (s.e - s.dome) / 0.5, q = proj(c, s.to), r = c.scale * (0.6 + u * 1.2) * q.f;
        ctx.fillStyle = `rgba(230,240,245,${0.7 * (1 - u)})`; ctx.beginPath(); ctx.ellipse(q.x, q.y, r, r * 0.6 * (1 - u * 0.3), 0, Math.PI, TAU); ctx.fill();
      }
      const b = !s.fired ? s.from : s.bombAt;
      if (b) { const q = proj(c, b); ctx.fillStyle = '#2e6e3e'; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(2, c.scale * 0.125 * q.f), 0, TAU); ctx.fill(); }
    },
    stat: s => `Fountain ${f1(bitsTop(s))} m high`,
  };

  // ---- piles: #29 dry leaves, #30 the night's red cracker paper, #34 gobar, #35 sand landmine ----
  THINGS.leaves = {
    label: 'Dry leaves', line: 'Patjhad, ek second mein.', maxT: 18,
    build(s, api) {
      s.mound = mound(1.6, 0.5, (i, j) => { const k = 0.8 + 0.3 * hash(i, j); return [104 * k, 74 * k, 40 * k]; });
      heap(s, api, 260, 1.6, 0.5, [[122, 80, 40], [152, 102, 46], [196, 160, 62], [178, 112, 42], [100, 70, 40]], { shape: 'leaf', size: [0.14, 0.24], up: 1.6, down: 6.5, flutter: 12 });
    },
    wick: () => [1.75, 0.03, 0.4],
    fire(s, api) {
      const z = s.size;
      bang(s, api, [0, 0.2, 0], z, { muffle: 0.4, fire: 0.6, paper: 0, smoke: 14 });
      erupt(s, 1.6, z, { out: [4, 14], up: [20, 40], jit: 3 });
      for (let i = 0; i < 6; i++) at(s, 0.1 + i * 0.2, () => api.Sfx.rustle({ vol: 0.2 - i * 0.025, pan: rnd(-0.4, 0.4) }));
      for (let i = 0; i < 6; i++) at(s, 0.6 + i * 0.4, () => api.smoke([rnd(-0.6, 0.6), 0.1, rnd(-0.6, 0.6)], 1, { size: 0.7 }));
      for (let i = 0; i < 24 * z; i++) api.spark([rnd(-0.5, 0.5), 0.3, rnd(-0.5, 0.5)], [rnd(-4, 4), rnd(6, 16), rnd(-4, 4)], { life: rnd(1.2, 2.2), size: 0.6, gravity: 40 });
      keepBits(s, api);
    },
    paint(s, api, c) { if (!s.fired) { api.drawFaces(s.mound); wickLine(api, c, [1.4, 0.05, 0.3], this.wick()); } },
    stat: s => `Leaves up to ${f1(bitsTop(s))} m · spread ${f1(bitsFar(s) * 2)} m wide`,
  };
  THINGS.paper = {
    label: 'Cracker-paper pile', line: 'Raat bhar ka kachra, ek baar phir aasmaan mein.', maxT: 18,
    build(s, api) {
      s.mound = mound(1.3, 0.45, (i, j) => { const k = 0.75 + 0.3 * hash(i, j); return [150 * k, 40 * k, 32 * k]; });
      heap(s, api, 380, 1.3, 0.45, [[188, 44, 36], [168, 36, 30], [214, 70, 52], [204, 166, 72], [230, 214, 190], [150, 30, 26]], { shape: 'rect', size: [0.05, 0.1], up: 1.1, down: 5, flutter: 10 });
    },
    wick: () => [1.45, 0.03, 0.35],
    fire(s, api) {
      const z = s.size;
      bang(s, api, [0, 0.2, 0], z, { muffle: 0.15, paper: 60, smoke: 16 });
      erupt(s, 1.3, z, { out: [3, 12], up: [30, 56], jit: 2.5 });
      for (let i = 0; i < 4; i++) at(s, 0.15 + i * 0.25, () => api.Sfx.rustle({ vol: 0.16, pan: rnd(-0.5, 0.5) }));
      keepBits(s, api);
    },
    paint(s, api, c) { if (!s.fired) { api.drawFaces(s.mound); wickLine(api, c, [1.1, 0.05, 0.25], this.wick()); } },
    stat: s => `Peak ${f1(bitsTop(s))} m · ${s.bits.filter(b => b.top * UNIT_M > 1).length} scraps over 1 m`,
  };
  THINGS.gobar = {
    label: 'Gobar pile', line: 'Paanch metre tak sab shaamil. Nahaana padega. Do baar.',
    build(s) {
      s.mound = mound(0.9, 0.42, (i, j) => { const k = 0.7 + 0.35 * hash(i, j); return [86 * k, 70 * k, 38 * k]; });
      s.lens = [];
    },
    wick: () => [1.05, 0.03, 0.3],
    fire(s, api) {
      const z = s.size, pan = api.panOf([0, 0, 0]);
      bang(s, api, [0, 0.2, 0], z, { muffle: 0.55, fire: 0.25, paper: 4, smoke: 6 });
      api.Sfx.strike('clay', { vol: 0.9, detune: 0.3, pan }); api.Sfx.crack({ vol: 0.35, pieces: 3, pan });
      spray(s, api, 150, [0, 0.25, 0], { shape: 'blob', out: [6, 22].map(v => v * Math.sqrt(z)), up: [8, 26].map(v => v * Math.sqrt(z)), colours: [[96, 74, 42], [80, 62, 34], [110, 88, 52], [70, 60, 30]], size: [0.07, 0.16], spread: 0.4 });
      for (const b of s.bits) { b.up = 0.4; b.down = 0.6; }
      for (let i = 0; i < 7; i++) at(s, 0.35 + i * 0.13, () => api.Sfx.strike('clay', { vol: 0.14, detune: rnd(0.45, 0.8), pan: rnd(-0.7, 0.7) }));
      at(s, 0.12, () => { const n = Math.round(rnd(2, 4) + z); for (let i = 0; i < n; i++) s.lens.push({ x: rnd(0.1, 0.9), y: rnd(0.1, 0.75), r: rnd(24, 64), t0: s.e, seed: i * 7 + 1 }); });
      keepBits(s, api);
      api.remain((ctx, A) => groundMark(ctx, A.cam, [0, 0, 0], 1.0, '60,46,24', 0.7));
    },
    paint(s, api, c) { if (!s.fired) { api.shadow([0, 0, 0], 1.0, 0); api.drawFaces(s.mound); wickLine(api, c, [0.75, 0.04, 0.22], this.wick()); } },
    overlay(s, api) {
      const ctx = api.ctx;
      for (const L of s.lens) {
        const u = s.e - L.t0, a = 0.85 * clamp(1 - (u - 4) / 3, 0, 1); if (a <= 0) continue;
        const x = L.x * api.W, y = L.y * api.H + u * 7;
        ctx.fillStyle = `rgba(78,58,30,${a})`;
        ctx.beginPath(); ctx.arc(x, y, L.r, 0, TAU); ctx.fill();
        for (let k = 0; k < 6; k++) { const an = hash(L.seed, k) * TAU, d = L.r * (0.9 + 0.6 * hash(k, L.seed)); ctx.beginPath(); ctx.arc(x + Math.cos(an) * d, y + Math.sin(an) * d, L.r * (0.15 + 0.2 * hash(L.seed + k, 3)), 0, TAU); ctx.fill(); }
        ctx.fillRect(x - L.r * 0.15, y, L.r * 0.3, L.r * 0.6 + u * 10);
      }
    },
    stat: s => `Splat radius ${f1(bitsFar(s))} m · ${s.lens.length} on the lens`,
  };
  THINGS.sand = {
    label: 'Sand pile', line: 'Chhota sa gaddha. Sabne jhuk ke dekha.',
    build(s) {
      s.mound = mound(1.1, 0.5, (i, j) => { const k = 0.85 + 0.2 * hash(i, j); return [200 * k, 172 * k, 124 * k]; });
      s.crater = 0;
    },
    wick: () => [0.25, 0.48, 0.15],
    fire(s, api) {
      const z = s.size, r = (0.35 + 0.28 * z) * rnd(0.9, 1.15);
      s.crater = r;
      bang(s, api, [0, 0.2, 0], z, { muffle: 0.4, fire: 0.3, paper: 6, smoke: 22, smokeSize: 1.3, scorch: false });
      spray(s, api, 240 * z, [0, 0.35, 0], { shape: 'bead', out: [4, 14].map(v => v * Math.sqrt(z)), up: [10, 30].map(v => v * Math.sqrt(z)), colours: [[204, 176, 128], [186, 158, 110], [214, 190, 142]], size: [0.025, 0.05], spread: 0.6 });
      for (const b of s.bits) { b.up = 0.9; b.down = 1.2; }
      keepBits(s, api);
      api.remain((ctx, A) => {
        const c = A.cam;
        ctx.fillStyle = 'rgba(200,174,128,.9)'; path(ctx, c, circle(0, 0.004, 0, r * 1.7, 20)); ctx.fill();
        ctx.fillStyle = 'rgba(120,96,64,.95)'; path(ctx, c, circle(0, 0.005, 0, r, 20)); ctx.fill();
        ctx.fillStyle = 'rgba(40,30,22,.7)'; path(ctx, c, circle(0, 0.006, r * 0.15, r * 0.55, 16)); ctx.fill();
      });
    },
    paint(s, api, c) { if (!s.fired) { api.shadow([0, 0, 0], 1.2, 0); api.drawFaces(s.mound); const w = proj(c, this.wick()); glow(api.ctx, w.x, w.y, 6, '255,190,90', 0.25); } },
    stat: s => `Crater ${Math.round(s.crater * 2 * UNIT_M * 100)} cm across`,
  };

  // ---- #44 the sutli ceremony: evacuate, one kid lights, silence, BOOM, applause ----
  THINGS.ceremony = {
    label: 'Sutli ceremony', line: 'Poori gali khaali. Phir poori gali taaliyaan.', size: 1.6, fuse: 1.0, maxT: 20,
    build(s) {
      s.bombKind = 'sutli';
      s.fusePts = [];
      for (let i = 0; i <= 14; i++) { const u = i / 14; s.fusePts.push([0.2 + u * 3.4 + Math.sin(u * 7) * 0.25, 0.02, 0.05 + u * 2.3 + Math.cos(u * 5) * 0.2]); }
      s.burnT = rnd(3.0, 3.8); s.silence = rnd(1.0, 1.6); s.boomT = s.burnT + s.silence;
    },
    wick(s) { return s.fusePts[s.fusePts.length - 1]; },
    fire(s, api) {
      const z = s.size, pan = api.panOf([0, 0, 0]);
      api.say('BHAAGO! Sab peeche!');
      s.fuseH = api.Sfx.fuse({ vol: 0.07, pan: api.panOf(this.wick(s)) });
      at(s, s.burnT, () => { s.fuseH?.stop(); s.fuseH = null; });
      at(s, s.boomT, () => {
        bang(s, api, [0, 0.15, 0], z, { muffle: 0, vol: 1, paper: 40, smoke: 30, smokeSize: 1.6, shake: 1.6, scorch: 0.7, light: 1.3 });
        api.Sfx.boom({ vol: 0.8, size: 1.2, muffle: 0.3, pan: -pan });
        api.burst([0, 0.3, 0], 120, 16, { flat: false });
        for (let i = 0; i < 6; i++) after(s, 0.3 + i * 0.3, () => api.smoke([rnd(-1.5, 1.5), 0.6 + i * 0.3, rnd(-1, 1)], 6, { size: 1.8 }));
        const n = Math.round(rnd(1.5, 3.4));
        for (let i = 0; i < n; i++) alarm(s, api, s.boomT + 0.4 + i * rnd(0.4, 0.8), rnd(3.5, 5), ALARMS[i % 4], [i % 2 ? 4.5 : -4.8, 0.6, -rnd(14, 36)], rnd(0.85, 1.15), 0.6);
        s.clap = [s.boomT + 1.8, s.boomT + 4.5];
        after(s, 2.0, () => api.say('Taaliyaan! Sutli zindabad!'));
      });
    },
    step(s, api, dt, e) {
      if (e < s.burnT) {
        const p = this.burnPoint(s, e / s.burnT);
        api.burst(p, 3, 2.4, { life: 0.3, size: 0.8, gravity: 120 }); api.light(p, 0.25);
      } else if (e < s.boomT) {
        if (Math.random() < dt * 6) api.spark([0.2, 0.12, 0.05], [rnd(-0.5, 0.5), rnd(0.5, 1.5), 0], { life: 0.2, size: 0.5 });
      }
      return e > s.boomT + 6;
    },
    burnPoint(s, u) {
      const P = s.fusePts, x = (1 - clamp(u, 0, 1)) * (P.length - 1), i = Math.min(P.length - 2, Math.floor(x)), f = x - i;
      return v3.add(P[i], v3.scale(v3.sub(P[i + 1], P[i]), f));
    },
    paint(s, api, c) {
      const ctx = api.ctx, P = s.fusePts, u = s.fired ? clamp(s.e / s.burnT, 0, 1) : 0;
      if (s.fired && s.e >= s.boomT) return;
      drawBomb(api, s);
      const cut = (1 - u) * (P.length - 1), bp = this.burnPoint(s, u);
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#c8b486'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= Math.floor(cut); i++) { const q = proj(c, P[i]); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
      const qb = proj(c, bp); ctx.lineTo(qb.x, qb.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(60,56,52,.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(qb.x, qb.y);
      for (let i = Math.ceil(cut); i < P.length; i++) { const q = proj(c, P[i]); ctx.lineTo(q.x, q.y); }
      ctx.stroke();
    },
    overlay(s, api, c) {
      drawAlarms(api.ctx, c, s);
      if (!s.fired || s.e < s.burnT * 0.5 || s.e > s.boomT) return;
      const a = 0.4 * clamp((s.e - s.burnT * 0.5) / (s.boomT - s.burnT * 0.5), 0, 1), ctx = api.ctx;
      const g = ctx.createRadialGradient(api.W / 2, api.H * 0.6, api.H * 0.2, api.W / 2, api.H * 0.6, api.H * 0.9);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, api.W, api.H);
    },
    stop(s) { s.fuseH?.stop(); s.fuseH = null; },
    stat: s => `Fuse ${f1(s.burnT)} s · silence ${f1(s.silence)} s · ${s.alarms.length} car alarms`,
  };

  // ---- #40 stairwell: the echo goes on and on, and the secretary comes out ----
  THINGS.stairwell = {
    label: 'Stairwell', line: 'Seedhiyon ne dhamaka das baar dohraaya. Secretary uncle ne bhi.', minT: 4,
    build() {},
    wick: () => [0.3, 0.03, 0.12],
    fire(s, api) {
      const z = s.size, pan = api.panOf([0, 0, 0]);
      bang(s, api, [0, 0.08, 0], z, { muffle: 0.05, smoke: 26, smokeSize: 1.4, shake: 1.2 });
      s.echoN = Math.round(rnd(8, 11));
      s.ringT = echoes(s, api, 0, s.echoN, 0.14, z, 0.75, 0.15, pan, 0.78);
      for (let i = 0; i < 8; i++) at(s, 0.3 + i * 0.35, () => api.smoke([rnd(-2, 2), rnd(0.5, 3), rnd(-1.5, 1)], 3, { size: 1.6 }));
      at(s, 0.25, () => {
        for (let i = 0; i < nBits(api, 130); i++) s.bits.push(bit([rnd(-5, 5), rnd(8, 13), rnd(-3, 2)], [0, 0, 0], { shape: 'bead', rgb: [[176, 170, 160], [196, 190, 180], [150, 146, 138]][i % 3], size: rnd(0.02, 0.05), up: 1, down: 2.6, flutter: 2 }));
        keepBits(s, api);
      });
      at(s, 2.0, () => api.say("Secretary uncle: 'KAUN HAI?! Meeting mein naam aayega!'", 3200));
    },
    paint(s, api, c) { if (!s.fired) { drawBomb(api, s); wickLine(api, c, [0.1, 0.12, 0.04], this.wick()); } },
    stat: s => `${s.echoN} echoes · ringing ${f1(s.ringT)} s`,
  };

  // ---- #140 decibel test: loudness measured in car alarms ----
  THINGS.decibel = {
    label: 'Decibel test', line: 'Jiske bomb pe zyada gaadiyan cheekhin, wahi jeeta.', minT: 2.5, maxT: 14,
    build() {},
    wick: () => [0.3, 0.03, 0.12],
    fire(s, api) {
      const z = s.size;
      bang(s, api, [0, 0.08, 0], z, { muffle: 0.05, vol: 0.95 });
      s.alarmN = clamp(Math.round(z * 3 + rnd(-0.6, 1.4)), 0, 7);
      let t = 0.25;
      for (let i = 0; i < s.alarmN; i++) {
        t += rnd(0.3, 0.7);
        alarm(s, api, t, rnd(3, 5), ALARMS[i % 4], [(i % 2 ? 1 : -1) * rnd(3.5, 6), 0.6, -rnd(6, 40)], rnd(0.8, 1.2), 0.9 - i * 0.06);
      }
    },
    step(s) { return s.alarms.every(a => s.e > a.t1); },
    paint(s, api, c) { if (!s.fired) { drawBomb(api, s); wickLine(api, c, [0.1, 0.12, 0.04], this.wick()); } },
    overlay(s, api, c) { drawAlarms(api.ctx, c, s); if (s.fired) hud(api, `Car alarms: ${alarmsSoFar(s)}`); },
    stat: s => `Car alarms set off: ${s.alarmN}`,
  };

  // ---- #118 outside the strict uncle's gate: bang, rattle, porch light, ABE KAUN HAI?! ----
  const GT = [0, 0, -3];
  THINGS.uncle = {
    label: "Uncle's gate", line: 'Ball wapas nahi mili, par hisaab barabar.', minT: 3,
    build(s, api) {
      // at a real door (the doorstep painting) we don't draw our own gate — the door is right there
      s.atDoor = api.place === 'doorstep';
      const brick = (n, a, b) => { const k = 0.85 + 0.25 * hash(a + n.length, b); return [152 * k, 74 * k, 54 * k]; };
      const put = (m, x, y) => m.faces.map(f => ({ ...f, pts: f.pts.map(p => [p[0] + x, p[1] + y, p[2] + GT[2]]) }));
      s.pillars = [];
      for (const x of [-3.4, 3.4]) s.pillars.push(...put(box(0.9, 6.2, 0.9, { div: 2, skip: ['bottom', 'back'], colourAt: brick }), x, 3.1), ...put(box(1.1, 0.25, 1.1, { rgb: [196, 190, 178], skip: ['bottom', 'back'] }), x, 6.32));
      const iron = { rgb: [40, 70, 52], skip: ['bottom', 'back', 'top'] };
      s.gate = [];
      for (let i = 0; i < 10; i++) s.gate.push(...put(box(0.09, 4.6, 0.09, iron), -2.7 + i * 0.6, 2.4));
      for (const y of [0.35, 2.4, 4.6]) s.gate.push(...put(box(5.9, 0.14, 0.1, { ...iron, skip: ['bottom', 'back'] }), 0, y));
      s.bulb = sphere(0.18, { lat: 4, lon: 8, rgb: [96, 94, 86] });
      s.bulbAt = s.atDoor ? [-7, 11, -3] : [-3.4, 6.62, GT[2]];
      s.reactT = rnd(1.2, 2.0); s.on = 0; s.kicks = [];
    },
    wick: () => [0.3, 0.03, 0.12],
    fire(s, api) {
      const z = s.size, pan = api.panOf(GT);
      bang(s, api, [0, 0.08, 0], z, { muffle: 0.1 });
      s.kicks.push([0, 0.09 * z]);
      for (const [t, v] of [[0.03, 0.6], [0.16, 0.35], [0.32, 0.2]]) at(s, t, () => api.Sfx.strike('blast-gate', { vol: v * z, pan }));
      at(s, s.reactT, () => { s.on = 1; api.Sfx.strike('blast-gate', { vol: 0.2, detune: 1.6, pan: api.panOf(s.bulbAt) }); });
      at(s, s.reactT + 0.35, () => api.say('ABE KAUN HAI?!', 2800));
      at(s, s.reactT + 0.9, () => { s.kicks.push([s.e, 0.07]); for (let i = 0; i < 4; i++) after(s, i * 0.14, () => api.Sfx.strike('blast-gate', { vol: 0.45 - i * 0.08, detune: rnd(0.95, 1.05), pan })); });
    },
    step(s, api, dt, e) { if (s.on) api.light([s.bulbAt[0], 5, s.bulbAt[2]], 0.35, [255, 226, 170]); return e > s.reactT + 2.4; },
    paint(s, api, c) {
      let x = 0;
      for (const [t0, a] of s.kicks) { const u = s.e - t0; if (u >= 0) x += a * Math.exp(-u * 4) * Math.sin(u * 70); }
      if (!s.atDoor) {
        api.drawFaces(s.pillars);
        api.drawFaces(moved(s.gate, [x, 0, 0]));
        s.bulb.faces.forEach(f => { f.rgb = s.on ? [255, 240, 196] : [96, 94, 86]; });
        api.drawFaces(moved(s.bulb.faces, s.bulbAt));
      } else if (x) { api.shake(Math.abs(x) * 30); }
      if (s.on) { const q = proj(c, s.bulbAt); glow(api.ctx, q.x, q.y, c.scale * 2.5 * q.f, '255,226,170', 0.55); }
      if (!s.fired) { drawBomb(api, s); wickLine(api, c, [0.1, 0.12, 0.04], this.wick()); }
    },
    stat: s => `Uncle out in ${f1(s.reactT)} s`,
  };

  // ---- #122 ding-dong-ditch: ring the bell, light, run ----
  THINGS.doorbell = {
    label: 'Ding-dong-ditch', line: 'Ghanti bajao, jalao, bhaago. Kisi ne nahi dekha. Shayad.', minT: 3,
    build(s) { s.fuse = rnd(2.0, 2.6); s.openT = rnd(1.0, 1.6); },
    wick: () => [0.3, 0.03, 0.12],
    ring(s, api, t) {
      if (!s.ding && t >= 0) { s.ding = true; api.Sfx.strike('blast-bell', { vol: 0.7, pan: 0.2 }); }
      if (!s.dong && t >= 0.55) { s.dong = true; api.Sfx.strike('blast-bell', { vol: 0.7, detune: 0.8, pan: 0.2 }); }
      for (let i = 0; i < 5; i++) if (!s['run' + i] && t >= 0.9 + i * 0.16) { s['run' + i] = true; api.Sfx.rustle({ vol: 0.14 - i * 0.022, pan: -0.2 - i * 0.12 }); }
    },
    fire(s, api) {
      const z = s.size;
      if (!s.ding) { s.ding = s.dong = true; api.Sfx.strike('blast-bell', { vol: 0.7 }); at(s, 0.5, () => api.Sfx.strike('blast-bell', { vol: 0.7, detune: 0.8 })); }
      bang(s, api, [0, 0.08, 0], z, { muffle: 0.08 });
      at(s, s.openT, () => { s.open = s.e; api.Sfx.strike('blast-gate', { vol: 0.25, detune: 1.7 }); });
      at(s, s.openT + 0.3, () => api.say('Kaun hai?! Ghanti bajaake bhaagte ho?!', 3000));
    },
    step(s, api, dt, e) { if (s.open != null) api.light([0, 1.5, -4], 0.4 * clamp((e - s.open) * 3, 0, 1), [255, 220, 160]); return e > s.openT + 2.2; },
    paint(s, api, c) {
      if (!s.fired) {
        const st = typeof Stage !== 'undefined' ? Stage : null;
        if (st && st.phase === 'fuse' && st.run) this.ring(s, api, st.run.t);
        drawBomb(api, s); wickLine(api, c, [0.1, 0.1, 0.04], this.wick());
      }
    },
    overlay(s, api) {
      if (s.open == null) return;
      const a = 0.32 * clamp((s.e - s.open) * 2.5, 0, 1), ctx = api.ctx, W = api.W, H = api.H;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.9); g.addColorStop(0, `rgba(255,214,150,${a})`); g.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(W * 0.38, 0); ctx.lineTo(W * 0.62, 0); ctx.lineTo(W * 0.85, H * 0.9); ctx.lineTo(W * 0.15, H * 0.9); ctx.closePath(); ctx.fill(); ctx.restore();
    },
    stat: s => `Ding-dong to bang ${f1(s.fuse)} s · door opened ${f1(s.openT)} s later`,
  };

  // ======================================================================================
  // The tricks. All share one engine; each lists the things it can be.
  // ======================================================================================
  const current = {};
  function makeTrick(id, name, keys, views, compendium) {
    const def = keys[0];
    const t = DiwaliTricks.register({
      id, name, compendium, mode: 'ground', views, fuse: 1.3,
      options: [
        { key: 'thing', label: 'Thing', choices: keys.map(k => [k, THINGS[k].label]), default: def },
        { key: 'bomb', label: 'Bomb', choices: BOMB_CHOICES, default: 'atom' },
      ],
      spentLine: '',
      create(api, opts) {
        const key = keys.includes(opts.thing) ? opts.thing : def, T = THINGS[key];
        const bombKind = BOMBS[opts.bomb] ? opts.bomb : 'atom';
        const s = { T, key, opts, bombKind, size: T.size || BOMBS[bombKind], q: [], bits: [], bodies: [], alarms: [], e: 0, fired: false, flying: 0 };
        T.build(s, api);
        current[id] = s;
        return s;
      },
      wick(s, api) { return s.T.wick(s, api); },
      ignite(s, api) { s.fired = true; s.T.fire(s, api); },
      update(s, api, dt, e) {
        s.e = e;
        if (s.q.length) {
          const due = s.q.filter(ev => e >= ev.t);
          if (due.length) { s.q = s.q.filter(ev => e < ev.t); due.sort((a, b) => a.t - b.t).forEach(ev => ev.fn()); }
        }
        if (s.bits.length) stepBits(s, dt);
        for (const b of s.bodies) { for (let i = 0; i < 4; i++) b.step(dt / 4); tame(b, 5); }
        if (s.T.update) s.T.update(s, dt);
        if (s.alarms.length) tickAlarms(s, api, e);
        tickClap(s, api, dt);
        const settled = s.T.step ? s.T.step.call(s.T, s, api, dt, e) : true;
        const still = s.bodies.every(b => !b.awake) && s.flying === 0 && !s.q.length;
        return (settled && still && e > (s.T.minT ?? 1.5)) || e > (s.T.maxT ?? 18);
      },
      draw(s, api) {
        const c = api.cam;
        s.T.paint.call(s.T, s, api, c);
        if (s.bits.length) drawBits(api.ctx, c, s.bits, s.kept ? 1 : 0);
        if (s.T.overlay) s.T.overlay.call(s.T, s, api, c);
      },
      stat(s) { return s.fired ? s.T.stat(s) : ''; },
      stop(s, api) { if (s.T.stop) s.T.stop(s, api); },
    });
    // The host reads these off the trick; they follow whichever thing is playing.
    Object.defineProperty(t, 'spentLine', { get: () => current[id] ? current[id].T.line : '', enumerable: true, configurable: true });
    Object.defineProperty(t, 'fuse', { get: () => { const s = current[id]; return s ? (s.fuse || s.T.fuse || 1.3) : 1.3; }, enumerable: true, configurable: true });
  }

  makeTrick('blast', 'Bomb under things', ['bucket', 'cup', 'coin', 'ball', 'brick', 'stone', 'manhole', 'bundle'], ['lane', 'courtyard'], [23, 25, 26, 27, 28, 36, 41, 43]);
  makeTrick('blast-break', 'Bomb inside things', ['matka', 'box', 'thermocol', 'postbox', 'letterbox', 'drum'], ['lane', 'courtyard'], [20, 24, 31, 32, 39, 117]);
  makeTrick('blast-pile', 'Bomb in a pile', ['paper', 'leaves', 'gobar', 'sand'], ['lane', 'park'], [29, 30, 34, 35]);
  makeTrick('blast-water', 'Bomb into water', ['naali', 'well', 'pond'], ['lane', 'courtyard', 'park'], [33, 37, 38]);
  makeTrick('blast-loud', 'The loud ones', ['ceremony', 'stairwell', 'decibel', 'uncle', 'doorbell'], ['lane', 'stairs', 'doorstep'], [40, 44, 118, 122, 140]);
})();

// Memories this family plays (compendium numbers).
DiwaliTricks.bind(20, 'blast-break', { thing: 'postbox', bomb: 'atom' }, 'lane');
DiwaliTricks.bind(117, 'blast-break', { thing: 'letterbox', bomb: 'lakshmi' }, 'lane');
DiwaliTricks.bind(23, 'blast', { thing: 'bucket', bomb: 'atom' }, 'lane');
DiwaliTricks.bind(24, 'blast-break', { thing: 'matka', bomb: 'atom' }, 'lane');
DiwaliTricks.bind(25, 'blast', { thing: 'cup', bomb: 'bijli' }, 'lane');
DiwaliTricks.bind(26, 'blast', { thing: 'coin', bomb: 'atom' }, 'lane');
DiwaliTricks.bind(27, 'blast', { thing: 'ball', bomb: 'atom' }, 'courtyard');
DiwaliTricks.bind(28, 'blast', { thing: 'brick', bomb: 'atom' }, 'lane');
DiwaliTricks.bind(29, 'blast-pile', { thing: 'leaves', bomb: 'atom' }, 'park');
DiwaliTricks.bind(30, 'blast-pile', { thing: 'paper', bomb: 'atom' }, 'lane');
DiwaliTricks.bind(31, 'blast-break', { thing: 'thermocol', bomb: 'lakshmi' }, 'courtyard');
DiwaliTricks.bind(32, 'blast-break', { thing: 'box', bomb: 'atom' }, 'lane');
DiwaliTricks.bind(33, 'blast-water', { thing: 'naali', bomb: 'atom' }, 'lane');
DiwaliTricks.bind(34, 'blast-pile', { thing: 'gobar', bomb: 'lakshmi' }, 'lane');
DiwaliTricks.bind(35, 'blast-pile', { thing: 'sand', bomb: 'atom' }, 'lane');
DiwaliTricks.bind(36, 'blast', { thing: 'stone', bomb: 'atom' }, 'lane');
// The courtyard camera looks steeply down at ~1–3 m of paving: a real 0.75 m well can't fit in it whole,
// so the mohalla well stands at the side of the lane instead.
DiwaliTricks.bind(37, 'blast-water', { thing: 'well', bomb: 'atom' }, 'lane');
DiwaliTricks.bind(38, 'blast-water', { thing: 'pond', bomb: 'atom' }, 'park');
DiwaliTricks.bind(39, 'blast-break', { thing: 'drum', bomb: 'sutli' }, 'courtyard');
DiwaliTricks.bind(40, 'blast-loud', { thing: 'stairwell', bomb: 'atom' }, 'stairs');
DiwaliTricks.bind(41, 'blast', { thing: 'manhole', bomb: 'sutli' }, 'lane');
DiwaliTricks.bind(43, 'blast', { thing: 'bundle', bomb: 'atom' }, 'lane');
DiwaliTricks.bind(44, 'blast-loud', { thing: 'ceremony', bomb: 'sutli' }, 'lane');
DiwaliTricks.bind(118, 'blast-loud', { thing: 'uncle', bomb: 'atom' }, 'doorstep');
DiwaliTricks.bind(122, 'blast-loud', { thing: 'doorbell', bomb: 'lakshmi' }, 'doorstep');
DiwaliTricks.bind(140, 'blast-loud', { thing: 'decibel', bomb: 'atom' }, 'lane');

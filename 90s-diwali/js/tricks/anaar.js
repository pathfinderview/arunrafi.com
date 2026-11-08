// Compendium #76–#79 — the anaar (flowerpot): a ~10 cm clay cone that throws a fountain of
// sparks. It catches, roars up to a 2–3 m shower with crackle, holds, and fades, lighting a warm
// pool on the ground. The fountain is simulated in world units here (gravity + air drag), so the
// peak height in the stat is measured from the sparks themselves.
// Variants: the one that burst, an avenue lit one after another, a race, and one tilted over the gate.
(function () {
  'use strict';
  const { M3, v3, UNIT_M, G, Body, shatter } = Phys;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;
  const KIDS = ['Bunty', 'Pinky', 'Golu', 'Chintu', 'Babli', 'Monu'];
  const POOL = 1200, DRAG = 1.6, V0 = 50, CONE = 0.22, H = 0.5;

  const P = { x: 0, y: 0, f: 1 };
  function proj(c, x, y, z) {
    const rx = x - c.C[0], ry = y - c.C[1], rz = z - c.C[2];
    const d = Math.max(0.3, rx * c.fwd[0] + ry * c.fwd[1] + rz * c.fwd[2]);
    P.x = c.cx + c.F * (rx * c.right[0] + ry * c.right[1] + rz * c.right[2]) / d;
    P.y = c.cy - c.F * (rx * c.up[0] + ry * c.up[1] + rz * c.up[2]) / d;
    P.f = c.z0 / d;
    return P;
  }
  function alignY(a) {
    const y = v3.norm(a);
    let x = Math.abs(y[1]) > 0.95 ? [1, 0, 0] : v3.norm(v3.cross(y, [0, 1, 0]));
    const z = v3.cross(x, y);
    x = v3.cross(y, z);
    return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
  }

  // Clay cone in its paper wrap, standing on y = 0 (lathe runs along x, turned to y).
  const UP = M3.rotZ(Math.PI / 2);
  function coneFaces(segs = 10, charred = false) {
    const prof = [[0, 0.172], [0.05, 0.176], [0.38, 0.09], [0.45, 0.066], [H, 0.04], [H, 0.004]];
    const L = Mesh.lathe(prof, {
      segs, colourAt: (i, s) => {
        let c;
        if (i === 0) c = [168, 96, 58];                                         // clay foot
        else if (i === 1) c = (s % 4 < 2) ? [46, 118, 72] : [218, 176, 62];     // printed paper wrap
        else if (i === 2) c = [184, 46, 40];                                    // red shoulder band
        else if (i === 3) c = [176, 104, 64];                                   // clay lip
        else c = [72, 62, 54];                                                  // paper cap over the mouth
        if (charred && i >= 2) c = c.map(v => v * 0.28 + 12);
        return c;
      },
    });
    return L.faces.map(f => ({ ...f, pts: f.pts.map(p => M3.mulV(UP, p)), n: M3.mulV(UP, f.n), base: f.rgb, rgb: f.rgb.slice() }));
  }

  const MODES = {
    single: { line: 'Anaar ki roshni mein poora aangan sunehra.', rate: 650 },
    burst: { line: 'Anaar phat gaya! Sab uchhle, koi nahi jala, aur yeh kissa har Diwali sunaya jaata hai.', rate: 650 },
    avenue: { line: 'Ek ke baad ek, poori gali mein anaar ki qataar.', rate: 250 },
    race: { line: 'Sabka anaar sabse ooncha tha. Bas jeeta ek hi.', rate: 270 },
    tilt: { line: 'Gate ke us paar, seedha sadak pe. Uncle ji ne dekh liya.', rate: 650 },
  };

  let current = null;
  const trick = DiwaliTricks.register({
    id: 'anaar',
    name: 'Anaar',
    compendium: [76, 77, 78, 79],
    mode: 'ground',
    views: ['courtyard', 'lane'],
    fuse: 1.5,
    options: [
      { key: 'how', label: 'How', choices: [['single', 'One anaar'], ['burst', 'The one that burst'], ['avenue', 'Anaar avenue (6)'], ['race', 'Anaar race (4)'], ['tilt', 'Tilted over the gate']], default: 'single' },
    ],

    create(api, opts) {
      const how = MODES[opts.how] ? opts.how : 'single';
      const s = {
        how, line: MODES[how].line, rate: MODES[how].rate, pots: [], lit: false, snd: null, endT: 0, t: 0,
        px: new Float32Array(POOL), py: new Float32Array(POOL), pz: new Float32Array(POOL),
        vx: new Float32Array(POOL), vy: new Float32Array(POOL), vz: new Float32Array(POOL),
        life: new Float32Array(POOL), max: new Float32Array(POOL), own: new Uint8Array(POOL), free: 0, alive: 0,
        crackT: 0, reach: 0, shards: null, bangT: 0, fizzT: 0, far: 0,
      };
      const pot = (pos, axis = [0, 1, 0], o = {}) => {
        const R = alignY(axis);
        s.pots.push({ pos, axis: v3.norm(axis), R, faces: coneFaces(10), strength: o.strength || rnd(0.94, 1.02), delay: o.delay || 0, burn: o.burn || rnd(6.8, 7.6),
          lit: false, t: 0, I: 0, done: false, peak: 0, char: 0, name: o.name || '', nozzle: v3.add(pos, M3.mulV(R, [0, H, 0])) });
      };
      if (how === 'avenue') {
        const h = api.aim([0, 0, 0]), d = [Math.cos(h), 0, Math.sin(h)], pp = [-d[2], 0, d[0]];
        for (let i = 0; i < 6; i++) { const k = i * 3 - 1.5, w = rnd(-0.2, 0.2); pot([d[0] * k + pp[0] * w, 0, d[2] * k + pp[2] * w], [0, 1, 0], { delay: i * 0.8 }); }
        s.spacing = 3;
      } else if (how === 'race') {
        const xs = [-4.5, -1.5, 1.5, 4.5];
        xs.forEach((x, i) => pot([x, 0, -6], [0, 1, 0], { strength: rnd(0.84, 1.1), delay: rnd(0, 0.15), name: KIDS[i] }));
      } else if (how === 'tilt') {
        // propped on a half-brick, aimed at the gate
        const h = api.aim([0, 0, 0], [0.9, 0.33]), tilt = 0.95;
        s.heading = [Math.cos(h), 0, Math.sin(h)];
        pot([0, 0.06, 0], [Math.cos(h) * Math.sin(tilt), Math.cos(tilt), Math.sin(h) * Math.sin(tilt)], { strength: 1.0 });
        s.brick = Mesh.place(boxFaces(1.1, 0.38, 0.55, [150, 64, 44]), M3.rotY(-h + Math.PI / 2), [-Math.cos(h) * 0.4, 0, -Math.sin(h) * 0.4]);
      } else {
        pot([0, 0, 0], [0, 1, 0], { strength: how === 'burst' ? 0.75 : rnd(0.95, 1.03), burn: how === 'burst' ? 99 : undefined });
        if (how === 'burst') s.bangAt = rnd(3.9, 4.7);
      }
      current = s;
      return s;
    },

    wick(s) { const p = s.pots[0]; return p.nozzle; },

    ignite(s, api) {
      s.lit = true;
      s.snd = api.Sfx.skid({ pan: api.panOf(s.pots[0].pos) });
    },

    update(s, api, dt, e) {
      s.t = e;
      let sumI = 0, maxI = 0, best = null, pan = 0, nLit = 0;
      for (const p of s.pots) {
        if (!p.lit && e >= p.delay) { p.lit = true; if (p.delay > 0.05) api.Sfx.crack({ vol: 0.12, pan: api.panOf(p.pos), pieces: 1 }); }
        if (!p.lit || p.done) continue;
        p.t += dt;
        p.I = s.how === 'burst' ? burstProfile(s, p, api) : profile(p);
        if (p.t >= p.burn) { p.done = true; p.I = 0; leaveSpent(api, p); }
        p.char = Math.min(1, p.t / p.burn);
        sumI += p.I; nLit++; pan += api.panOf(p.pos);
        if (!best || p.I > best.I) best = p;
        maxI = Math.max(maxI, p.I);
        emit(s, p, api, dt);
        // embers dribbling off the lip
        if (p.I > 0.2 && Math.random() < dt * 8) api.spark(p.nozzle, [rnd(-1, 1), rnd(0, 1), rnd(-1, 1)], { life: 0.4, size: 0.7, gravity: 200 });
      }
      if (best && best.I > 0.02) api.light(v3.add(best.nozzle, [0, 0.8, 0]), 0.25 + 0.85 * best.I * (s.how === 'race' || s.how === 'avenue' ? 1.1 : 1), [255, 194, 112]);
      stepSparks(s, api, dt);
      // crackle at the top of the shower
      s.crackT -= dt;
      if (sumI > 0.4 && s.crackT <= 0 && s.alive) {
        s.crackT = rnd(0.05, 0.16) / Math.min(2, sumI);
        for (let k = 0; k < 8; k++) {
          const i = Math.floor(Math.random() * POOL);
          if (s.life[i] > 0 && s.py[i] > 4 && s.life[i] < s.max[i] * 0.6) {
            api.burst([s.px[i], s.py[i], s.pz[i]], 6, 3, { color: 'white', life: rnd(0.12, 0.3), size: 0.7, gravity: 60 });
            api.Sfx.crack({ vol: 0.06, pan: api.panOf([s.px[i], s.py[i], s.pz[i]]), pieces: 2 });
            break;
          }
        }
      }
      s.snd?.set(nLit ? clamp(0.12 + 0.42 * sumI / (s.pots.length > 1 ? 1.8 : 1), 0, 0.85) : 0, 0.05 + 0.1 * maxI, nLit ? clamp(pan / nLit, -1, 1) : 0);
      // the burst: shards
      if (s.shards) {
        let awake = false;
        for (const sh of s.shards) { for (let i = 0; i < 3; i++) sh.body.step(dt / 3); awake ||= sh.body.awake; s.far = Math.max(s.far, Math.hypot(sh.body.pos[0], sh.body.pos[2]) * UNIT_M); }
        if (!awake && !s.shardsLeft) { s.shardsLeft = true; const faces = []; for (const sh of s.shards) for (const f of Mesh.place(sh.faces, sh.body.R, sh.body.pos)) faces.push(f); api.remain((ctx, a) => a.drawFaces(faces)); }
        if (!awake && e > s.bangT + 2.5 && !s.endT) s.endT = e;
      } else if (!s.endT && s.pots.every(p => p.done) && s.alive === 0) s.endT = e;
      if (s.endT && s.snd) { s.snd.stop(); s.snd = null; }
      return (s.endT && e > s.endT + 0.6) || e > 40;
    },

    stop(s) { s.snd?.stop(); s.snd = null; },

    draw(s, api) {
      const c = api.cam, ctx = api.ctx;
      // labels for the race
      if (s.how === 'race') {
        ctx.save(); ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,240,215,.85)';
        for (const p of s.pots) { const q = proj(c, p.pos[0], 0, p.pos[2] + 0.9); ctx.fillText(p.name, q.x, q.y + 10); }
        ctx.restore();
      }
      if (s.brick) api.drawFaces(s.brick);
      const faces = [];
      for (const p of s.pots) {
        if (p.burst) continue;
        api.shadow(p.pos, 0.3, 0);
        tint(p);
        for (const f of Mesh.place(p.faces, p.R, p.pos)) faces.push(f);
        if (!p.lit) {
          // the paper wick poking out of the cap
          const a = proj(c, p.nozzle[0], p.nozzle[1], p.nozzle[2]), ax = a.x, ay = a.y, b = proj(c, p.nozzle[0] + 0.03, p.nozzle[1] + 0.16, p.nozzle[2]);
          ctx.save(); ctx.strokeStyle = '#d8c79f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
          // the next one in the row: the phuljhadi is on its way
          if (s.lit && p.delay - s.t < 0.3) api.burst(p.nozzle, 2, 2, { life: 0.2, size: 0.7, gravity: 120 });
        }
      }
      if (faces.length) api.drawFaces(faces);
      // the mouth glows while it burns
      for (const p of s.pots) {
        if (!p.lit || p.done || p.I < 0.03 || p.burst) continue;
        const q = proj(c, p.nozzle[0], p.nozzle[1], p.nozzle[2]), r = Math.max(4, 0.35 * c.scale * q.f) * (0.6 + 0.6 * p.I);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r); g.addColorStop(0, `rgba(255,246,220,${0.9 * p.I})`); g.addColorStop(0.35, `rgba(255,190,90,${0.45 * p.I})`); g.addColorStop(1, 'rgba(255,140,40,0)');
        ctx.fillStyle = g; ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2); ctx.restore();
      }
      drawSparks(s, api);
      if (s.shards) {
        const all = [];
        for (const sh of s.shards) { api.shadow(sh.body.pos, 0.08, sh.body.pos[1]); for (const f of Mesh.place(sh.faces, sh.body.R, sh.body.pos)) all.push(f); }
        api.drawFaces(all);
      }
      // a peak marker when the fountain goes out of frame
      if (s.how !== 'burst' && s.how !== 'tilt') {
        ctx.save(); ctx.fillStyle = 'rgba(255,240,210,.85)'; ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center';
        for (const p of s.pots) {
          if (!p.lit || p.peak < 1) continue;
          const q = proj(c, p.pos[0], p.peak, p.pos[2]);
          if (q.y < 4 && p.I > 0.3) ctx.fillText(`↑ ${(p.peak * UNIT_M).toFixed(1)} m`, clamp(q.x, 30, api.W - 30), 18);
        }
        ctx.restore();
      }
    },

    stat(s) {
      if (!s.lit) return '';
      const m = v => (v * UNIT_M).toFixed(1);
      switch (s.how) {
        case 'burst': return s.bangT ? `Fizzled ${(s.bangT - s.fizzT).toFixed(1)} s, then BANG · clay flew ${s.far.toFixed(1)} m` : 'Fizzling…';
        case 'avenue': { const top = Math.max(...s.pots.map(p => p.peak)); return `${s.pots.length} anaars · ${((s.pots.length - 1) * s.spacing * UNIT_M).toFixed(1)} m avenue · tallest ${m(top)} m`; }
        case 'race': {
          const order = s.pots.slice().sort((a, b) => b.peak - a.peak);
          return `${order[0].name}'s anaar wins · ${m(order[0].peak)} m · others ${order.slice(1).map(p => m(p.peak)).join(', ')} m`;
        }
        case 'tilt': return `Sprayed ${(s.reach * UNIT_M).toFixed(1)} m sideways, over the gate`;
      }
      const p = s.pots[0];
      return `Peak ${m(p.peak)} m · ${p.t.toFixed(1)} s of fountain`;
    },
  });
  Object.defineProperty(trick, 'spentLine', { get: () => current?.line || MODES.single.line, configurable: true });

  // catch, roar up, hold, fade
  function profile(p) {
    const t = p.t, T = p.burn;
    if (t < 0.3) return 0.12 + Math.random() * 0.08;
    if (t < 1.7) { const k = (t - 0.3) / 1.4; return 0.15 + 0.85 * k * k * (3 - 2 * k); }
    if (t < T - 2) return rnd(0.88, 1);
    const k = Math.max(0, (T - t) / 2);
    return Math.pow(k, 1.3) * (Math.random() < 0.1 ? 0.4 : 1);
  }
  // 76: a weak start, sputter, silence… then BANG
  function burstProfile(s, p, api) {
    const t = p.t;
    if (t < 0.3) return 0.12;
    if (t < 1.2) return 0.15 + 0.4 * (t - 0.3) / 0.9;
    if (t < 2.4) { if (!s.fizzT) s.fizzT = t; return Math.random() < 0.35 ? rnd(0.3, 0.5) : 0.06; }
    if (t < s.bangAt) { if (Math.random() < 0.08) api.smoke(p.nozzle, 1, { size: 0.4 }); return Math.random() < 0.03 ? 0.08 : 0; }
    if (!p.burst) bang(s, p, api);
    p.done = true;
    return 0;
  }
  function bang(s, p, api) {
    p.burst = true; s.bangT = p.t;
    const pan = api.panOf(p.pos), placed = Mesh.place(p.faces.map(f => ({ ...f, rgb: f.rgb.slice() })), p.R, p.pos);
    s.shards = shatter(placed, 8).map(sh => {
      const out = v3.norm(v3.sub(sh.centroid, [p.pos[0], p.pos[1] + 0.1, p.pos[2]]));
      const speed = rnd(6, 13), mass = 0.02 * sh.count;
      const body = new Body({ pos: sh.centroid, mass, inertia: mass * 0.02, restitution: 0.25, friction: 0.7, angDrag: 0.3, contactAngDrag: 9, contactLinDrag: 2.4, hull: sh.hull.filter((_, i) => i % 2 === 0),
        onImpact: (sp, at) => { if (sp > 4) api.Sfx.strike('clay', { vol: Math.min(0.3, sp / 50), pan: api.panOf(at) }); } });
      body.kick([out[0] * speed, Math.max(0.4, out[1]) * speed + rnd(3, 8), out[2] * speed], [rnd(-20, 20), rnd(-20, 20), rnd(-20, 20)]);
      return { faces: sh.faces, body };
    });
    api.Sfx.boom({ vol: 0.9, size: 0.95, muffle: 0.08, pan });
    api.Sfx.crack({ vol: 0.6, pan, pieces: 4 });
    api.burst(p.nozzle, 220, 12, {});
    api.burst(p.pos, 80, 8, { flat: true });
    api.paper(p.nozzle, 26, 4.5, [[168, 96, 58], [46, 118, 72], [218, 176, 62], [184, 46, 40]]);
    api.smoke(p.nozzle, 18, { size: 1.2 });
    api.light(p.nozzle, 1.3, [255, 210, 150]);
    api.shake(9);
    api.say('Anaar phat gaya!', 1600);
    api.remain((ctx, a) => {
      const c = a.cam, q = proj(c, p.pos[0], 0.002, p.pos[2]), r = c.scale * 0.8 * q.f;
      ctx.save(); ctx.translate(q.x, q.y); ctx.scale(1, 0.45);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(14,10,8,.65)'); g.addColorStop(1, 'rgba(14,10,8,0)');
      ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
    });
  }
  function tint(p) {
    const k = p.char * 0.6;
    for (let i = 0; i < p.faces.length; i++) {
      const f = p.faces[i]; if (i < 20) continue;      // only the shoulder, lip and cap blacken
      for (let j = 0; j < 3; j++) f.rgb[j] = f.base[j] + (20 - f.base[j]) * k;
    }
  }

  function emit(s, p, api, dt) {
    if (p.I < 0.02) return;
    const n = Math.round(s.rate * p.I * dt * (api.reduced ? 0.25 : 1) * rnd(0.7, 1.3));
    const a = p.axis, e1 = v3.norm(v3.cross(a, Math.abs(a[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), e2 = v3.cross(a, e1);
    const cone = CONE * (s.how === 'tilt' ? 1.25 : 1);
    for (let k = 0; k < n; k++) {
      let i = -1;
      for (let tries = 0; tries < POOL; tries++) { const j = (s.free + tries) % POOL; if (s.life[j] <= 0) { i = j; break; } }
      if (i < 0) return;
      s.free = (i + 1) % POOL;
      const th = cone * Math.sqrt(Math.random()), ph = rnd(0, TAU), st = Math.sin(th), ct = Math.cos(th);
      const d0 = a[0] * ct + (e1[0] * Math.cos(ph) + e2[0] * Math.sin(ph)) * st;
      const d1 = a[1] * ct + (e1[1] * Math.cos(ph) + e2[1] * Math.sin(ph)) * st;
      const d2 = a[2] * ct + (e1[2] * Math.cos(ph) + e2[2] * Math.sin(ph)) * st;
      const sp = V0 * p.strength * (0.6 + 0.4 * p.I) * rnd(0.78, 1.04);
      s.px[i] = p.nozzle[0]; s.py[i] = p.nozzle[1]; s.pz[i] = p.nozzle[2];
      s.vx[i] = d0 * sp; s.vy[i] = d1 * sp; s.vz[i] = d2 * sp;
      s.life[i] = s.max[i] = rnd(0.6, 1.5); s.own[i] = s.pots.indexOf(p);
      s.alive++;
    }
  }
  function stepSparks(s, api, dt) {
    const k = Math.exp(-DRAG * dt);
    let alive = 0;
    for (let i = 0; i < POOL; i++) {
      if (s.life[i] <= 0) continue;
      s.life[i] -= dt;
      if (s.life[i] <= 0) continue;
      alive++;
      s.vy[i] -= G * dt;
      s.vx[i] *= k; s.vy[i] *= k; s.vz[i] *= k;
      s.px[i] += s.vx[i] * dt; s.py[i] += s.vy[i] * dt; s.pz[i] += s.vz[i] * dt;
      const p = s.pots[s.own[i]];
      if (s.py[i] > p.peak) p.peak = s.py[i];
      if (s.py[i] <= 0.01) {
        s.py[i] = 0.01; s.vy[i] *= -0.2; s.vx[i] *= 0.5; s.vz[i] *= 0.5; s.life[i] = Math.min(s.life[i], 0.18);
        if (s.heading) s.reach = Math.max(s.reach, s.px[i] * s.heading[0] + s.pz[i] * s.heading[2]);
      }
    }
    s.alive = alive;
  }
  const HEAT = ['#d8561a', '#f0922e', '#ffc35e', '#ffe2a0'], HALO = ['rgba(255,110,30,.12)', 'rgba(255,150,50,.12)', 'rgba(255,180,90,.13)', 'rgba(255,210,140,.14)'];
  function drawSparks(s, api) {
    if (!s.alive) return;
    const c = api.cam, ctx = api.ctx, W = api.W, H_ = api.H;
    const base = clamp(0.03 * c.scale, 0.8, 2.4);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let b = 0; b < 4; b++) {
      for (let pass = 0; pass < 2; pass++) {
        ctx.beginPath();
        let any = false;
        for (let i = 0; i < POOL; i++) {
          if (s.life[i] <= 0) continue;
          const heat = s.life[i] / s.max[i], bucket = Math.min(3, Math.floor(heat * 4.4));
          if (bucket !== b) continue;
          const a = proj(c, s.px[i], s.py[i], s.pz[i]), ax = a.x, ay = a.y;
          if (ax < -20 || ax > W + 20 || ay < -40 || ay > H_ + 20) continue;
          const t = proj(c, s.px[i] - s.vx[i] * 0.018, s.py[i] - s.vy[i] * 0.018, s.pz[i] - s.vz[i] * 0.018);
          ctx.moveTo(ax, ay); ctx.lineTo(t.x, t.y); any = true;
        }
        if (!any) break;
        if (pass === 0) { ctx.strokeStyle = HALO[b]; ctx.lineWidth = base * 3.2; } else { ctx.strokeStyle = HEAT[b]; ctx.lineWidth = base * (0.6 + b * 0.15); }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function leaveSpent(api, p) {
    const faces = Mesh.place(coneFaces(8, true), p.R, p.pos);
    api.remain((ctx, a) => {
      const c = a.cam, q = proj(c, p.pos[0], 0.002, p.pos[2]), r = c.scale * 0.55 * q.f;
      ctx.save(); ctx.translate(q.x, q.y); ctx.scale(1, 0.45);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(16,11,8,.5)'); g.addColorStop(1, 'rgba(16,11,8,0)');
      ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
      a.drawFaces(faces);
    });
  }
  function boxFaces(w, h, d, rgb) {
    const x = w / 2, z = d / 2;
    const q = [[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z], [-x, h, -z], [x, h, -z], [x, h, z], [-x, h, z]];
    const sh = k => rgb.map(v => v * k);
    return [
      { pts: [q[4], q[5], q[6], q[7]], n: [0, 1, 0], rgb: sh(1.08) },
      { pts: [q[3], q[2], q[6], q[7]], n: [0, 0, 1], rgb: rgb },
      { pts: [q[0], q[1], q[5], q[4]], n: [0, 0, -1], rgb: rgb },
      { pts: [q[1], q[2], q[6], q[5]], n: [1, 0, 0], rgb: sh(0.9) },
      { pts: [q[0], q[3], q[7], q[4]], n: [-1, 0, 0], rgb: sh(0.9) },
    ];
  }
})();

DiwaliTricks.bind(76, 'anaar', { how: 'burst' }, 'courtyard');
DiwaliTricks.bind(77, 'anaar', { how: 'avenue' }, 'lane');
DiwaliTricks.bind(78, 'anaar', { how: 'race' }, 'lane');
DiwaliTricks.bind(79, 'anaar', { how: 'tilt' }, 'courtyard');

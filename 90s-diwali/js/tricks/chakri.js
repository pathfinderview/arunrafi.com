// Compendium #67–#74, #82 — the chakri (ground spinner) and everything we did with it.
// A 6 cm coil of paper that spins up to ~35 turns a second, spraying sparks off its rim
// tangentially (a spiral of fire), whining higher as it spins faster, wandering on the floor,
// and dying with a sputter. Variants: in the hand on an agarbatti, held up on a wire,
// thrown in the air, rattling in a steel thali, bouncing down the stairs, two on one stick,
// under a cardboard box (the UFO), and jumped over (interactive).
(function () {
  'use strict';
  const { M3, v3, UNIT_M, G } = Phys;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;
  const OMEGA = 220;                       // rad/s at full burn ≈ 35 turns a second
  const SIZES = { small: { r: 0.15, burn: 7.5 }, big: { r: 0.21, burn: 9.5 } };   // 6 cm / 8.5 cm across
  const hash = (i, j) => { const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); };

  // ---------- shared bits ----------
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
  const imgReady = i => i && i.complete && i.naturalWidth > 0;
  const isArmed = () => typeof Stage !== 'undefined' && Stage.phase === 'armed';

  // A chakri: a short fat paper coil. Top is a fan so the spiral wrap shows when it turns slowly.
  const WRAP = [[196, 46, 40], [232, 186, 62], [52, 128, 70]];
  function diskMesh(r, h) {
    const segs = 16, faces = [], top = [], bot = [];
    for (let k = 0; k < segs; k++) { const a = k / segs * TAU; top.push([Math.cos(a) * r, h / 2, Math.sin(a) * r]); bot.push([Math.cos(a) * r, -h / 2, Math.sin(a) * r]); }
    const hole = r * 0.18;
    for (let k = 0; k < segs; k++) {
      const k2 = (k + 1) % segs, a = (k + 0.5) / segs * TAU, base = WRAP[k % 3];
      const hole1 = [Math.cos(k / segs * TAU) * hole, h / 2, Math.sin(k / segs * TAU) * hole], hole2 = [Math.cos(k2 / segs * TAU) * hole, h / 2, Math.sin(k2 / segs * TAU) * hole];
      faces.push({ pts: [hole1, top[k], top[k2], hole2], n: [0, 1, 0], rgb: base.slice(), base });
      const sb = k % 2 ? [176, 40, 36] : [222, 196, 120];
      faces.push({ pts: [bot[k], bot[k2], top[k2], top[k]], n: [Math.cos(a), 0, Math.sin(a)], rgb: sb.slice(), base: sb });
    }
    faces.push({ pts: bot.slice(), n: [0, -1, 0], rgb: [120, 90, 60], base: [120, 90, 60] });
    return faces;
  }
  const MEAN = [160, 120, 60], CHAR = [38, 32, 28];
  function tintDisk(sp) {
    const blur = clamp(sp.omega / 45, 0, 1) * 0.85, ch = sp.char;
    for (const f of sp.faces) for (let i = 0; i < 3; i++) {
      const v = f.base[i] + (MEAN[i] - f.base[i]) * blur;
      f.rgb[i] = v + (CHAR[i] - v) * ch;
    }
  }

  function spinner(size, o = {}) {
    const S = SIZES[size] || SIZES.small;
    return {
      r: S.r, h: S.r * 0.32, burn: S.burn * (o.burnK || 1) * rnd(0.94, 1.06), lit: false, t: 0, angle: rnd(0, TAU), omega: 0, I: 0,
      dirSign: o.dirSign || 1, done: false, turns: 0, char: 0, colour: o.colour || 'gold', faces: diskMesh(S.r, S.r * 0.32),
      pos: (o.pos || [0, 0, 0]).slice(), vel: [0, 0, 0], wob: [0, 0], phut: false, swap: o.swap || null, colours: 1,
    };
  }
  // Burn profile: fizz, roar up, steady, sputter, die.
  function spinStep(sp, api, dt) {
    if (!sp.lit || sp.done) { sp.omega *= Math.exp(-dt * 3); sp.angle += sp.omega * dt * sp.dirSign; return; }
    sp.t += dt;
    const t = sp.t, T = sp.burn;
    if (t < 0.25) { sp.omega = OMEGA * 0.05 * t / 0.25; sp.I = 0.25; }
    else if (t < 0.9) { const k = (t - 0.25) / 0.65; sp.omega = OMEGA * Math.pow(k, 1.4); sp.I = 0.3 + 0.7 * k; }
    else if (t < T - 1.6) { sp.omega = OMEGA * (0.93 + 0.07 * Math.sin(t * 6.3)); sp.I = rnd(0.85, 1); }
    else if (t < T) {
      const k = (T - t) / 1.6;
      sp.omega = OMEGA * Math.pow(k, 0.7);
      sp.I = (Math.random() < 0.3 + 0.55 * k ? 1 : 0.12) * (0.25 + 0.75 * k);
      sp.char = Math.max(sp.char, 1 - k);
    } else {
      sp.done = true; sp.I = 0; sp.char = 1;
      if (!sp.phut) { sp.phut = true; api.Sfx.crack({ vol: 0.3, pan: 0, pieces: 2 }); }
    }
    if (sp.swap && t > T * sp.swap.at && sp.colour !== sp.swap.to) { sp.colour = sp.swap.to; sp.colours++; }
    sp.angle += sp.omega * dt * sp.dirSign;
    sp.turns += sp.omega * dt / TAU;
  }

  // Sparks off the rim, jetting backwards along the tangent (3D). R: disk frame, c: centre.
  function emit3D(sp, api, R, c, dt, o = {}) {
    if (!sp.lit || sp.I < 0.05) return;
    let n = Math.round(sp.I * (o.rate || 24) * dt * 60 * (api.reduced ? 0.25 : 1));
    for (let k = 0; k < n; k++) {
      const ph = sp.angle - sp.dirSign * sp.omega * dt * (k / n), cs = Math.cos(ph), sn = Math.sin(ph);
      const rim = M3.mulV(R, [cs * sp.r, 0, sn * sp.r]);
      const sp_ = rnd(5, 11) * (0.5 + 0.5 * sp.omega / OMEGA);
      const jet = M3.mulV(R, [sp.dirSign * sn * sp_ + cs * rnd(0, 1.5), rnd(0, 1.2), -sp.dirSign * cs * sp_ + sn * rnd(0, 1.5)]);
      const v = o.vel ? v3.add(jet, o.vel) : jet;
      api.spark(v3.add(c, rim), v, { life: rnd(0.22, 0.6), size: rnd(0.7, 1.3), color: Math.random() < 0.15 ? 'white' : sp.colour, gravity: o.gravity ?? 60, floor: o.floor ?? Infinity });
    }
  }
  // The blur ring: a hot loop of light around the rim when it's spinning.
  function ring3D(api, sp, R, c) {
    if (!sp.lit || sp.I < 0.05) return;
    const cam = api.cam, ctx = api.ctx, k = clamp(sp.omega / OMEGA, 0, 1) * sp.I;
    if (k < 0.04) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
    const pts = [];
    for (let i = 0; i <= 20; i++) { const a = i / 20 * TAU, w = v3.add(c, M3.mulV(R, [Math.cos(a) * sp.r, 0, Math.sin(a) * sp.r])); const q = proj(cam, w[0], w[1], w[2]); pts.push(q.x, q.y); }
    const q0 = proj(cam, c[0], c[1], c[2]), px = sp.r * cam.scale * q0.f;
    const col = sp.colour === 'green' ? '160,255,150' : '255,196,110';
    for (const [w, a] of [[0.55, 0.25], [0.22, 0.75]]) {
      ctx.lineWidth = Math.max(1, px * w); ctx.strokeStyle = `rgba(${col},${a * k})`;
      ctx.beginPath(); for (let i = 0; i < pts.length; i += 2) i ? ctx.lineTo(pts[i], pts[i + 1]) : ctx.moveTo(pts[i], pts[i + 1]); ctx.stroke();
    }
    const g = ctx.createRadialGradient(q0.x, q0.y, 0, q0.x, q0.y, px * 2.4);
    g.addColorStop(0, `rgba(255,236,190,${0.5 * k})`); g.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = g; ctx.fillRect(q0.x - px * 2.4, q0.y - px * 2.4, px * 4.8, px * 4.8);
    ctx.restore();
  }
  function diskFaces(sp, R, c) { tintDisk(sp); return Mesh.place(sp.faces, M3.mul(R, M3.rotY(-sp.angle)), c); }
  function flatR(sp) { return M3.mul(M3.rotX(sp.wob[0]), M3.rotZ(sp.wob[1])); }

  function scorch(api, at, r, y = 0.002) {
    api.remain((ctx, a) => {
      const c = a.cam, q = proj(c, at[0], y, at[2]), R = c.scale * r * q.f;
      ctx.save(); ctx.translate(q.x, q.y); ctx.scale(1, 0.5);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, 'rgba(14,10,8,.55)'); g.addColorStop(0.5, 'rgba(24,16,10,.3)'); g.addColorStop(1, 'rgba(24,16,10,0)');
      ctx.fillStyle = g; ctx.fillRect(-R, -R, R * 2, R * 2); ctx.restore();
    });
  }
  function leaveSpent(api, sp, at) {
    const faces = Mesh.place(sp.faces.map(f => ({ ...f, rgb: [...CHAR].map((v, i) => v + f.base[i] * 0.12) })), M3.rotY(rnd(0, TAU)), [at[0], at[1] + sp.h / 2, at[2]]);
    api.remain((ctx, a) => a.drawFaces(faces));
  }
  function groundWander(sp, dt, lim = 1.6, k = 1) {
    const I = sp.lit && !sp.done ? sp.I : 0;
    sp.vel[0] += rnd(-1, 1) * 7 * k * dt * I; sp.vel[2] += rnd(-1, 1) * 7 * k * dt * I;
    const d = Math.hypot(sp.pos[0], sp.pos[2]);
    if (d > lim) { sp.vel[0] -= sp.pos[0] / d * 2 * dt; sp.vel[2] -= sp.pos[2] / d * 2 * dt; }
    const damp = Math.exp(-dt * (sp.done ? 4 : 1.4));
    sp.vel[0] *= damp; sp.vel[2] *= damp;
    sp.pos[0] += sp.vel[0] * dt; sp.pos[2] += sp.vel[2] * dt;
    sp.wob[0] = Math.sin(sp.t * 13) * 0.05 * I; sp.wob[1] = Math.cos(sp.t * 11) * 0.05 * I;
    return Math.hypot(sp.vel[0], sp.vel[2]) * dt;
  }

  // POV hand holding an agarbatti (pov-hand.webp: stick tip at 31% / 37% of the image).
  const HAND_TIP = [0.313, 0.37], STICK = v3.norm([-0.97, -0.25, 0]);
  function drawHand(api, anchor, S, rot = 0) {
    const im = api.img('pov-hand'), ctx = api.ctx;
    if (!imgReady(im)) return;
    ctx.save(); ctx.translate(anchor[0], anchor[1]); ctx.rotate(rot);
    ctx.drawImage(im, -HAND_TIP[0] * S, -HAND_TIP[1] * S, S, S); ctx.restore();
  }

  // ---------- the chakri trick ----------
  const HOW = {
    ground: { size: 'big', line: 'Bhoomi chakra, sangu chakra, chakri: naam alag, chakkar wahi.', place: 'courtyard' },
    hand: { line: 'Agarbatti pe chakri, aur sab uske chaaron taraf naach rahe the.' },
    wire: { line: 'Sudarshan chakra! Taar pe ghoomta hua, bilkul TV wale Vishnu ji jaisa.' },
    throw: { line: 'Ek second ke liye UFO. Phir wapas zameen pe.' },
    thali: { line: 'Mummy ki steel ki thali: ab tak kaali hai, mat batana.' },
    stairs: { line: 'Seedhi-seedhi neeche aayi, ek ek step pe uchhalti hui.' },
    double: { line: 'Ek dandi, do chakri: double ka maza.' },
    box: { line: 'UFO utar gaya. Dabba ka kya hua, mat poochho.' },
  };
  let current = null;
  const chakri = DiwaliTricks.register({
    id: 'chakri',
    name: 'Chakri',
    compendium: [68, 69, 70, 71, 72, 73, 74, 82],
    mode: 'ground',
    views: ['courtyard', 'stairs', 'lane'],
    fuse: 1.0,
    options: [
      { key: 'how', label: 'How', choices: [['ground', 'On the floor'], ['hand', 'On an agarbatti'], ['wire', 'Sudarshan (wire)'], ['throw', 'Thrown up'], ['thali', 'In a steel thali'], ['stairs', 'Down the stairs'], ['double', 'Two on one stick'], ['box', 'Under a box (UFO)']], default: 'ground' },
      { key: 'size', label: 'Size', choices: [['small', 'Chakri'], ['big', 'Bhoomi chakra (big)']], default: 'small' },
    ],

    create(api, opts) {
      const how = HOW[opts.how] ? opts.how : 'ground';
      const s = { how, line: HOW[how].line, t: 0, wander: 0, sps: [], lit: false, snd: null, endT: 0, done: false };
      const size = opts.size || 'small';
      if (how === 'ground') s.sps.push(spinner(size, { swap: size === 'big' ? { at: 0.5, to: 'green' } : null, pos: [0, 0, 0] }));
      else if (how === 'hand') s.sps.push(spinner(size));
      else if (how === 'double') { s.sps.push(spinner(size)); s.sps.push(spinner(size, { dirSign: -1, colour: 'green', burnK: 0.92 })); }
      else if (how === 'wire') { s.sps.push(spinner(size, { burnK: 1.05 })); s.base = [0.3, 3.3, 1.6]; }
      else if (how === 'throw') { s.sps.push(spinner(size, { pos: [-2.3, 0, 0.6] })); s.air = 0; s.peak = 0; s.state = 'ground'; s.airT = 0; }
      else if (how === 'thali') { s.sps.push(spinner(size, { pos: [0.2, 0, 0.1] })); s.thali = mkThali(); s.hits = 0; s.rattleT = 0; s.tilt = [0, 0]; }
      else if (how === 'stairs') { s.sps.push(spinner(size, { pos: [rnd(-0.6, 0.6), 0, 0.1 - 6.5 * STEP.run] })); s.steps = 0; s.vy = 0; s.lastStep = 6; s.sps[0].pos[1] = stepY(s.sps[0].pos[2]); }
      else if (how === 'box') { s.sps.push(spinner(size)); s.box = mkBox(); s.hops = 0; s.hopT = 0.8; }
      current = s;
      return s;
    },

    wick(s, api) {
      const sp = s.sps[0];
      if (s.how === 'hand' || s.how === 'double') { const L = handLayout(s, api), p = api.unproject(L.tips[0][0] + 6, L.tips[0][1] + 4); return p ? [p[0], 0.05, p[2]] : [0, 0.05, 0]; }
      if (s.how === 'wire') return [s.base[0] + sp.r, s.base[1], s.base[2]];
      if (s.how === 'box') return [s.box.w / 2 + 0.15, 0.03, 0.2];
      return [sp.pos[0] + sp.r + 0.04, sp.pos[1] + 0.03, sp.pos[2]];
    },

    ignite(s, api) {
      s.lit = true;
      for (const sp of s.sps) sp.lit = true;
      s.snd = api.Sfx.skid({ pan: api.panOf(s.sps[0].pos) });
    },

    update(s, api, dt, e) {
      s.t = e;
      const sps = s.sps, sp = sps[0];
      for (const q of sps) spinStep(q, api, dt);
      let I = 0, om = 0; for (const q of sps) { I = Math.max(I, q.I); om = Math.max(om, q.omega); }
      const how = s.how;
      if (how === 'ground') s.wander += groundWander(sp, dt);
      else if (how === 'throw') updateThrow(s, api, dt);
      else if (how === 'thali') updateThali(s, api, dt);
      else if (how === 'stairs') updateStairs(s, api, dt);
      else if (how === 'box') updateBox(s, api, dt);
      else if (how === 'hand' || how === 'double') updateHand(s, api, dt);
      else if (how === 'wire') { sp.pos = [s.base[0] + Math.sin(e * 1.1) * 0.5, s.base[1] + Math.sin(e * 1.7) * 0.25, s.base[2] + Math.cos(e * 0.9) * 0.2]; }
      s.snd?.set(sps.every(q => q.done) ? 0 : 0.18 + 0.4 * I * (how === 'box' ? 0.6 : 1), om / OMEGA * 0.95, api.panOf(sp.pos));
      if (!s.endT && sps.every(q => q.done)) {
        s.endT = e; s.snd?.stop(); s.snd = null;
        for (const q of sps) api.smoke(q.pos[1] > 0.5 ? [q.pos[0], q.pos[1], q.pos[2]] : q.pos, 3, { size: 0.6 });
        leaveRemains(s, api);
      }
      return (s.endT && e > s.endT + 1.2 && (how !== 'box' || s.box.y <= 0)) || e > 30;
    },

    stop(s) { s.snd?.stop(); s.snd = null; },

    draw(s, api) {
      const how = s.how;
      if (how === 'hand' || how === 'double') return drawHandChakri(s, api);
      if (how === 'thali') return drawThali(s, api);
      if (how === 'box') return drawBox(s, api);
      const sp = s.sps[0], c = api.cam;
      let R = flatR(sp), centre = [sp.pos[0], sp.pos[1] + sp.h / 2, sp.pos[2]];
      if (how === 'wire') {
        R = alignY(v3.sub(c.C, sp.pos)); centre = sp.pos;
        // a light pool on the floor under it, and the wire down to the hand
        const L = wireHand(s, api);
        drawHand(api, L.anchor, L.S, L.rot);
        const q = proj(c, centre[0], centre[1], centre[2]), ctx = api.ctx;
        ctx.save(); ctx.strokeStyle = 'rgba(70,70,74,.95)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(L.anchor[0], L.anchor[1]); ctx.quadraticCurveTo((L.anchor[0] + q.x) / 2, (L.anchor[1] + q.y) / 2 + 12, q.x, q.y); ctx.stroke(); ctx.restore();
      } else if (how === 'stairs') {
        shadowAt(api, sp.pos[0], stepY(sp.pos[2]), sp.pos[2], sp.r * 1.4, sp.pos[1] - stepY(sp.pos[2]));
      } else api.shadow(sp.pos, sp.r * 1.3, sp.pos[1]);
      if (how !== 'wire' && !s.lit) fuseTail(api, sp, centre);
      api.drawFaces(diskFaces(sp, R, centre));
      ring3D(api, sp, R, centre);
      // sparks are emitted from draw so they leave from exactly where the disk is drawn
      if (s.lit) {
        const air = how === 'wire' || (how === 'throw' && sp.pos[1] > 0.05);
        let floor = Infinity;
        if (air) floor = proj(c, centre[0], how === 'stairs' ? stepY(centre[2]) : 0, centre[2]).y;
        if (how === 'stairs') floor = proj(c, centre[0], stepY(centre[2]), centre[2]).y + 2;
        emit3D(sp, api, R, centre, 1 / 60, { gravity: air ? 520 : how === 'stairs' ? 300 : 60, floor, vel: how === 'throw' ? sp.vel : null });
        lightAt(s, api, centre, sp.I);
      }
    },

    stat(s) {
      const sp = s.sps[0];
      if (!s.lit) return '';
      const turns = Math.round(s.sps.reduce((a, q) => a + q.turns, 0)).toLocaleString('en-IN'), secs = sp.t.toFixed(1);
      switch (s.how) {
        case 'ground': return `${turns} turns in ${secs} s · wandered ${(s.wander * UNIT_M).toFixed(1)} m${sp.colours > 1 ? ' · gold, then green' : ''}`;
        case 'hand': return `${turns} turns on the agarbatti · ${secs} s`;
        case 'double': return `Two chakris · ${turns} turns between them`;
        case 'wire': return `${turns} turns on the wire · ${secs} s`;
        case 'throw': return s.airT > 0 ? `Airborne ${s.airT.toFixed(1)} s · peak ${(s.peak * UNIT_M).toFixed(1)} m` : `${turns} turns`;
        case 'thali': return `Hit the rim ${s.hits} times · ${turns} turns`;
        case 'stairs': return `Bounced down ${s.steps} step${s.steps === 1 ? '' : 's'}`;
        case 'box': return `Box hopped ${s.hops} times · highest ${Math.round(s.box.maxY * UNIT_M * 100)} cm`;
      }
      return `${turns} turns`;
    },
  });
  Object.defineProperty(chakri, 'spentLine', { get: () => current?.line || HOW.ground.line, configurable: true });

  function fuseTail(api, sp, centre) {
    const a = api.project([centre[0] + sp.r * 0.9, centre[1], centre[2]]), b = api.project([sp.pos[0] + sp.r + 0.04, sp.pos[1] + 0.03, sp.pos[2]]), ctx = api.ctx;
    ctx.save(); ctx.strokeStyle = '#c9b68c'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
  }
  function lightAt(s, api, at, I) {
    if (I < 0.03) return;
    if (s.how === 'stairs') {
      // the host draws light pools at y = 0: find the y = 0 point that sits under it on screen
      const c = api.cam, q = proj(c, at[0], stepY(at[2]), at[2]), g = api.unproject(q.x, q.y);
      api.light(g ? [g[0], 0.1, g[2]] : at, 0.25 + 0.5 * I); return;
    }
    api.light(at, 0.25 + 0.55 * I, s.sps[0].colour === 'green' ? [170, 255, 150] : [255, 190, 100]);
  }
  function shadowAt(api, x, y, z, r, h) {
    const c = api.cam, q = proj(c, x, y + 0.002, z), R = Math.max(2, r * c.scale * q.f * (1 + h * 0.15)), fade = Math.max(0, 1 - h / 6), ctx = api.ctx;
    ctx.save(); ctx.translate(q.x, q.y); ctx.scale(1, 0.4);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, `rgba(10,6,4,${0.5 * fade})`); g.addColorStop(1, 'rgba(10,6,4,0)');
    ctx.fillStyle = g; ctx.fillRect(-R, -R, 2 * R, 2 * R); ctx.restore();
  }
  function leaveRemains(s, api) {
    const sp = s.sps[0];
    if (s.how === 'hand' || s.how === 'double' || s.how === 'wire') return;
    if (s.how === 'box') { const faces = boxFaces(s, true); api.remain((ctx, a) => a.drawFaces(faces)); scorch(api, [s.box.x, 0, s.box.z], 1.2); return; }
    if (s.how === 'thali') return;
    const y = s.how === 'stairs' ? stepY(sp.pos[2]) : 0;
    scorch(api, [sp.pos[0], 0, sp.pos[2]], 0.6, y + 0.002);
    leaveSpent(api, sp, [sp.pos[0], y, sp.pos[2]]);
  }

  // ---------- thrown up: a flying saucer, briefly ----------
  function updateThrow(s, api, dt) {
    const sp = s.sps[0];
    if (s.state === 'ground' && sp.t > 1.3 && !sp.done) {
      s.state = 'air'; sp.vel = [rnd(3.6, 4.6), rnd(16, 18.5), rnd(-1, 0.2)];
      api.Sfx.whoosh({ vol: 0.16, pan: api.panOf(sp.pos), dur: 0.5 });
    }
    if (s.state === 'air') {
      const lift = sp.omega / OMEGA * 0.3;          // a spinning disc glides a little
      sp.vel[1] -= G * (1 - lift) * dt;
      for (let i = 0; i < 3; i++) sp.pos[i] += sp.vel[i] * dt;
      s.airT += dt; s.peak = Math.max(s.peak, sp.pos[1]);
      sp.wob[0] = Math.sin(sp.t * 5) * 0.35; sp.wob[1] = Math.cos(sp.t * 4) * 0.3;
      if (sp.pos[1] <= 0 && sp.vel[1] < 0) {
        sp.pos[1] = 0; sp.vel[1] = 0; s.state = 'landed'; sp.vel[0] *= 0.35; sp.vel[2] *= 0.35;
        api.Sfx.strike('clay', { vol: 0.3, pan: api.panOf(sp.pos) });
        api.burst(sp.pos, 40, 6, { flat: true, life: 0.4 });
      }
    } else {
      groundWander(sp, dt, 3, 0.6);
    }
  }

  // ---------- steel thali ----------
  function mkThali() {
    const steel = (sg, b) => { const k = 0.82 + 0.25 * Math.max(0, Math.cos(sg / 22 * TAU * 2 + 0.7)); return [196 * k, 200 * k, 208 * k]; };
    const base = Mesh.cylinder(0.75, 0.03, { segs: 22, bands: 1, colourAt: steel, top: [206, 210, 218], bottom: [120, 122, 128] });
    const rim = Mesh.cylinder(0.79, 0.11, { segs: 22, bands: 1, colourAt: steel, top: false, bottom: false, inner: [176, 180, 188] });
    return { faces: [...base.faces, ...rim.faces.map(f => ({ ...f, pts: f.pts.map(p => [p[0], p[1] + 0.04, p[2]]) }))], y: 0, vy: 0, R: 0.75 };
  }
  function updateThali(s, api, dt) {
    const sp = s.sps[0], T = s.thali, I = sp.lit && !sp.done ? sp.I : 0;
    sp.vel[0] += rnd(-1, 1) * 14 * dt * I; sp.vel[2] += rnd(-1, 1) * 14 * dt * I;
    // the spin throws it outward against the rim
    const d = Math.hypot(sp.pos[0], sp.pos[2]) || 1e-3;
    sp.vel[0] += sp.pos[0] / d * 1.2 * dt * I; sp.vel[2] += sp.pos[2] / d * 1.2 * dt * I;
    const damp = Math.exp(-dt * (sp.done ? 5 : 0.6)); sp.vel[0] *= damp; sp.vel[2] *= damp;
    sp.pos[0] += sp.vel[0] * dt; sp.pos[2] += sp.vel[2] * dt;
    const lim = T.R - sp.r - 0.02, dd = Math.hypot(sp.pos[0], sp.pos[2]);
    if (dd > lim) {
      const nx = sp.pos[0] / dd, nz = sp.pos[2] / dd, vn = sp.vel[0] * nx + sp.vel[2] * nz;
      sp.pos[0] = nx * lim; sp.pos[2] = nz * lim;
      if (vn > 0) {
        sp.vel[0] -= 1.85 * vn * nx; sp.vel[2] -= 1.85 * vn * nz;
        // spin against the rim kicks it sideways too
        sp.vel[0] += -nz * sp.dirSign * 1.2 * I; sp.vel[2] += nx * sp.dirSign * 1.2 * I;
        if (vn > 0.6 && s.t - (s.lastHit || 0) > 0.12) {
          s.hits++; s.lastHit = s.t;
          api.Sfx.strike('steel', { vol: clamp(vn / 4, 0.08, 0.4), pan: api.panOf(sp.pos), detune: rnd(0.96, 1.04) });
          api.burst([sp.pos[0] + nx * sp.r, 0.12, sp.pos[2] + nz * sp.r], 10, 5, { life: 0.3, flat: true });
          s.tilt[0] += rnd(-0.04, 0.04); s.tilt[1] += rnd(-0.04, 0.04);
        }
      }
    }
    // the plate itself rattles on the floor
    s.rattleT -= dt;
    if (I > 0.2 && s.rattleT <= 0) {
      s.rattleT = rnd(0.045, 0.1);
      api.Sfx.strike('steel', { vol: 0.03 + 0.05 * I, pan: api.panOf([0, 0, 0]), detune: rnd(0.9, 1.12) });
      T.vy = rnd(0.1, 0.5) * I;
    }
    T.vy -= G * dt; T.y = Math.max(0, T.y + T.vy * dt); if (T.y <= 0) T.vy = 0;
    s.tilt[0] = s.tilt[0] * Math.exp(-dt * 8) + rnd(-0.008, 0.008) * I; s.tilt[1] = s.tilt[1] * Math.exp(-dt * 8) + rnd(-0.008, 0.008) * I;
    sp.wob[0] = s.tilt[0]; sp.wob[1] = s.tilt[1];
  }
  function drawThali(s, api) {
    const sp = s.sps[0], T = s.thali, c = api.cam, ctx = api.ctx;
    const R = M3.mul(M3.rotX(s.tilt[0]), M3.rotZ(s.tilt[1]));
    api.shadow([0, 0, 0], 0.95, T.y);
    const centre = v3.add(M3.mulV(R, [sp.pos[0], 0.03 + sp.h / 2, sp.pos[2]]), [0, T.y, 0]);
    if (!s.lit) fuseTail(api, sp, centre);
    const faces = Mesh.place(T.faces, R, [0, T.y + 0.015, 0]);
    for (const f of diskFaces(sp, R, centre)) faces.push(f);
    api.drawFaces(faces);
    ring3D(api, sp, R, centre);
    if (!s.lit) return;
    // steel shimmer: glints and the fire's reflection in the plate
    const I = sp.I;
    if (I > 0.05) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const q0 = proj(c, centre[0], 0.04 + T.y, centre[2]), rx = 0.5 * c.scale * q0.f;
      ctx.translate(q0.x, q0.y); ctx.scale(1, 0.45);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(255,214,150,${0.35 * I})`); g.addColorStop(1, 'rgba(255,170,90,0)');
      ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
      ctx.restore(); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,248,230,${0.8 * I})`; ctx.lineWidth = 1;
      for (let k = 0; k < (api.reduced ? 2 : 7); k++) {
        const a = rnd(0, TAU), r = rnd(0.2, 0.78), q = proj(c, Math.cos(a) * r, 0.05 + T.y, Math.sin(a) * r), L = rnd(2, 6);
        ctx.beginPath(); ctx.moveTo(q.x - L, q.y); ctx.lineTo(q.x + L, q.y); ctx.moveTo(q.x, q.y - L * 0.6); ctx.lineTo(q.x, q.y + L * 0.6); ctx.stroke();
      }
      ctx.restore();
    }
    emit3D(sp, api, R, centre, 1 / 60, { gravity: 80, rate: 22 });
    api.light(centre, 0.3 + 0.6 * I, [255, 214, 160]);
  }

  // ---------- stairs (fitted to the walk-stairs plate: 20 cm risers, 27 cm treads) ----------
  const STEP = { rise: 1.02, run: 1.34, z0: 0.1, top: 7 };
  function stepIndex(z) { return clamp(Math.floor((STEP.z0 - z) / STEP.run), -1, STEP.top); }
  function stepY(z) { return stepIndex(z) * STEP.rise; }
  function updateStairs(s, api, dt) {
    const sp = s.sps[0], I = sp.lit && !sp.done ? sp.I : 0;
    // it wanders, but the spray pushes it off each step toward us
    sp.vel[0] += rnd(-1, 1) * 6 * dt * I - sp.pos[0] * 0.8 * dt;
    sp.vel[2] += (1.7 * (sp.lit && !sp.done ? 1 : 0) - sp.vel[2]) * dt * 1.5 + rnd(-1, 1) * 3 * dt * I;
    if (sp.done) { sp.vel[0] *= Math.exp(-dt * 5); sp.vel[2] *= Math.exp(-dt * 5); }
    sp.pos[0] += sp.vel[0] * dt; sp.pos[2] = Math.min(1.25, sp.pos[2] + sp.vel[2] * dt);
    const floor = stepY(sp.pos[2]);
    s.vy -= G * dt; sp.pos[1] += s.vy * dt;
    if (sp.pos[1] <= floor) {
      if (s.vy < -2.5) {
        const k = stepIndex(sp.pos[2]);
        if (k < s.lastStep) { s.steps += s.lastStep - k; s.lastStep = k; }
        api.Sfx.strike('clay', { vol: clamp(-s.vy / 18, 0.08, 0.4), pan: api.panOf(sp.pos), detune: rnd(0.8, 1.1) });
        api.burst([sp.pos[0], floor + 0.05, sp.pos[2]], 24, 6, { flat: true, life: 0.35, floor: proj(api.cam, sp.pos[0], floor, sp.pos[2]).y + 2 });
        s.vy = -s.vy * 0.32;
      } else s.vy = 0;
      sp.pos[1] = floor;
      if (I > 0.5 && Math.random() < dt * 2) s.vy = rnd(1.5, 3);   // little hops while it spins
    }
    sp.wob[0] = Math.sin(sp.t * 13) * 0.06 * I + (sp.pos[1] > floor + 0.05 ? 0.25 : 0); sp.wob[1] = Math.cos(sp.t * 11) * 0.06 * I;
  }

  // ---------- cardboard box UFO ----------
  function mkBox() { return { w: 1.6, d: 1.1, h: 0.7, x: 0, z: 0, y: 0, vy: 0, rx: 0, rz: 0, wx: 0, wz: 0, vx: 0, vz: 0, maxY: 0, glow: 0 }; }
  function boxFaces(s, charred) {
    const B = s.box, w = B.w / 2, d = B.d / 2, h = B.h;
    const P8 = [[-w, 0, -d], [w, 0, -d], [w, 0, d], [-w, 0, d], [-w, h, -d], [w, h, -d], [w, h, d], [-w, h, d]];
    const card = [176, 132, 82], top = [190, 146, 92], inner = [150, 110, 66], g = charred ? 0 : B.glow;
    const hot = (c, k) => c.map((v, i) => v + ([255, 170, 80][i] - v) * k);
    const col = c => charred ? c.map(v => v * 0.55) : hot(c, g * 0.55);
    const F = [
      { pts: [P8[4], P8[5], P8[6], P8[7]].reverse(), n: [0, 1, 0], rgb: col(top), back: inner },
      { pts: [P8[3], P8[2], P8[6], P8[7]].reverse(), n: [0, 0, 1], rgb: col(card), back: inner },
      { pts: [P8[0], P8[1], P8[5], P8[4]], n: [0, 0, -1], rgb: col(card), back: inner },
      { pts: [P8[1], P8[2], P8[6], P8[5]], n: [1, 0, 0], rgb: col(card.map(v => v * 0.92)), back: inner },
      { pts: [P8[0], P8[3], P8[7], P8[4]], n: [-1, 0, 0], rgb: col(card.map(v => v * 0.92)), back: inner },
      // a printed band on the front: an old mithai box
      { pts: [[-w * 0.8, h * 0.35, d + 0.004], [w * 0.8, h * 0.35, d + 0.004], [w * 0.8, h * 0.7, d + 0.004], [-w * 0.8, h * 0.7, d + 0.004]], n: [0, 0, 1], rgb: col([168, 44, 50]) },
    ];
    return Mesh.place(F, M3.mul(M3.rotY(0.25), M3.mul(M3.rotX(B.rx), M3.rotZ(B.rz))), [B.x, B.y, B.z]);
  }
  function updateBox(s, api, dt) {
    const sp = s.sps[0], B = s.box, I = sp.lit && !sp.done ? sp.I : 0;
    B.glow += ((I > 0.05 ? 0.4 + 0.6 * I * rnd(0.7, 1) : 0) - B.glow) * Math.min(1, dt * 12);
    s.hopT -= dt;
    if (I > 0.5 && s.hopT <= 0 && B.y <= 0) {
      s.hopT = rnd(0.35, 1.0); B.vy = rnd(3.5, 8.5) * I; B.wx += rnd(-3, 3); B.wz += rnd(-3, 3); B.vx += rnd(-1.2, 1.2); B.vz += rnd(-1.2, 1.2); s.hops++;
      api.Sfx.boom({ size: 0.12, muffle: 0.9, vol: 0.3, pan: api.panOf([B.x, 0, B.z]) });
    }
    B.vy -= G * dt; B.y += B.vy * dt;
    if (B.y <= 0) {
      if (B.vy < -2) { api.Sfx.boom({ size: 0.1, muffle: 0.95, vol: clamp(-B.vy / 25, 0.06, 0.25), pan: api.panOf([B.x, 0, B.z]) }); api.Sfx.rustle({ vol: 0.1 }); api.smoke([B.x, 0.1, B.z], 1, { size: 0.8 }); }
      B.y = 0; B.vy = 0; B.vx *= Math.exp(-dt * 6); B.vz *= Math.exp(-dt * 6);
    }
    B.maxY = Math.max(B.maxY, B.y);
    B.wx += (-60 * B.rx - 5 * B.wx) * dt; B.wz += (-60 * B.rz - 5 * B.wz) * dt; B.rx += B.wx * dt; B.rz += B.wz * dt;
    B.x += B.vx * dt; B.z += B.vz * dt;
    const d = Math.hypot(B.x, B.z); if (d > 1.5) { B.vx -= B.x / d * dt * 4; B.vz -= B.z / d * dt * 4; }
    sp.pos = [B.x, 0, B.z];
  }
  function drawBox(s, api) {
    const sp = s.sps[0], B = s.box, c = api.cam, ctx = api.ctx;
    api.shadow([B.x, 0, B.z], 1.1, B.y);
    if (!s.lit) { const a = api.project([B.x + B.w / 2 - 0.05, 0.02, B.z + 0.2]), b = api.project(chakri.wick(s, api)); ctx.save(); ctx.strokeStyle = '#c9b68c'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore(); }
    const I = sp.lit && !sp.done ? sp.I : 0;
    // light leaking out under the edges, brighter when it jumps
    if (B.glow > 0.03) {
      const q = proj(c, B.x, 0.01, B.z), r = (1.3 + B.y * 0.6) * c.scale * q.f;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(q.x, q.y); ctx.scale(1, 0.42);
      const g = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r); g.addColorStop(0, `rgba(255,190,100,${0.55 * B.glow})`); g.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
    }
    api.drawFaces(boxFaces(s, false));
    if (I > 0.05) {
      // sparks escaping through the gap at the bottom
      const n = Math.round(I * (6 + B.y * 30) * (api.reduced ? 0.3 : 1));
      for (let k = 0; k < n; k++) {
        const a = rnd(0, TAU), ca = Math.cos(a), sa = Math.sin(a), m = Math.max(Math.abs(ca) / (B.w / 2), Math.abs(sa) / (B.d / 2));
        const p = [B.x + ca / m, 0.03 + Math.random() * B.y * 0.5, B.z + sa / m], s_ = rnd(4, 9);
        api.spark(p, [ca * s_, rnd(0, 1.5), sa * s_], { life: rnd(0.2, 0.5), size: rnd(0.7, 1.2), gravity: 60, floor: Infinity });
      }
      api.light([B.x, 0.3, B.z], 0.35 + 0.6 * I * B.glow);
    }
  }

  // ---------- in the hand: agarbatti (68) and two on one stick (73) ----------
  function handLayout(s, api) {
    const W = api.W, H = api.H, S = Math.min(H * 0.95, W * 1.05), t = s.clock || 0;
    let ax = W * 0.66 + Math.sin(t * 1.3) * W * 0.012 + Math.sin(t * 0.47) * W * 0.01, ay = H * 0.6 + Math.cos(t * 0.9) * H * 0.012;
    if (s.follow) { ax = s.follow[0]; ay = s.follow[1]; }
    const L = S * 0.34, tip = [ax + STICK[0] * L, ay + STICK[1] * L];
    const tips = [tip];
    if (s.how === 'double') tips.push([ax + STICK[0] * L * 0.6, ay + STICK[1] * L * 0.6]);
    return { anchor: [ax, ay], S, L, tips, R: S * 0.055 };
  }
  function updateHand(s, api, dt) {
    const p = api.pointer;
    if (p.down) {
      const L = handLayout({ ...s, follow: null }, api), want = [p.x - STICK[0] * L.L, p.y - STICK[1] * L.L];
      s.follow = s.follow || L.anchor.slice();
      s.follow[0] += (want[0] - s.follow[0]) * Math.min(1, dt * 8); s.follow[1] += (want[1] - s.follow[1]) * Math.min(1, dt * 8);
    } else if (s.follow) {
      const L = handLayout({ ...s, follow: null }, api);
      s.follow[0] += (L.anchor[0] - s.follow[0]) * Math.min(1, dt * 2); s.follow[1] += (L.anchor[1] - s.follow[1]) * Math.min(1, dt * 2);
      if (Math.hypot(L.anchor[0] - s.follow[0], L.anchor[1] - s.follow[1]) < 1) s.follow = null;
    }
  }
  function drawHandChakri(s, api) {
    s.clock = (s.clock || 0) + 1 / 60;
    const L = handLayout(s, api), ctx = api.ctx, ang = Math.atan2(STICK[1], STICK[0]);
    // agarbatti: dark incense coat on a thin bamboo stick
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = '#3b2a20'; ctx.lineWidth = Math.max(2, L.S * 0.007);
    ctx.beginPath(); ctx.moveTo(L.anchor[0] - STICK[0] * L.S * 0.04, L.anchor[1] - STICK[1] * L.S * 0.04); ctx.lineTo(L.tips[0][0] + STICK[0] * L.R * 0.5, L.tips[0][1] + STICK[1] * L.R * 0.5); ctx.stroke();
    ctx.restore();
    drawHand(api, L.anchor, L.S, 0);
    const gnd = Math.min(api.H - 4, L.tips[0][1] + api.H * 0.38);
    s.sps.forEach((sp, idx) => {
      const tip = L.tips[idx], R = L.R;
      // the disc spins in the plane across the stick: seen nearly edge-on along the stick
      const u = [STICK[0], STICK[1]], w = [-STICK[1], STICK[0]], sq = 0.42;
      const rimAt = a => [tip[0] + u[0] * Math.cos(a) * R * sq + w[0] * Math.sin(a) * R, tip[1] + u[1] * Math.cos(a) * R * sq + w[1] * Math.sin(a) * R];
      tintDisk(sp);
      ctx.save(); ctx.translate(tip[0], tip[1]); ctx.rotate(ang);
      const col = sp.faces[1].rgb, top = sp.faces[0].rgb;
      ctx.fillStyle = `rgb(${col.map(v => v | 0).join(',')})`; ctx.beginPath(); ctx.ellipse(0, 0, R * sq + R * 0.1, R, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgb(${top.map(v => v | 0).join(',')})`; ctx.beginPath(); ctx.ellipse(R * 0.1, 0, R * sq, R * 0.96, 0, 0, TAU); ctx.fill();
      if (sp.omega < 40) {
        // spiral wrap visible when slow
        ctx.strokeStyle = 'rgba(40,20,10,.5)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let a = 0; a < TAU * 3; a += 0.3) { const r = a / (TAU * 3); const x = R * 0.1 + Math.cos(a + sp.angle) * R * sq * r, y = Math.sin(a + sp.angle) * R * 0.96 * r; a ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      }
      ctx.restore();
      if (!s.lit || sp.I < 0.05) return;
      const k = clamp(sp.omega / OMEGA, 0, 1) * sp.I, gcol = sp.colour === 'green' ? '160,255,150' : '255,196,110';
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(tip[0], tip[1]); ctx.rotate(ang);
      for (const [lw, a] of [[0.5, 0.25], [0.18, 0.8]]) { ctx.lineWidth = R * lw; ctx.strokeStyle = `rgba(${gcol},${a * k})`; ctx.beginPath(); ctx.ellipse(0, 0, R * sq, R, 0, 0, TAU); ctx.stroke(); }
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 2.6); g.addColorStop(0, `rgba(255,236,190,${0.45 * k})`); g.addColorStop(1, 'rgba(255,160,60,0)');
      ctx.fillStyle = g; ctx.fillRect(-R * 2.6, -R * 2.6, R * 5.2, R * 5.2); ctx.restore();
      const n = Math.round(sp.I * 22 * (api.reduced ? 0.25 : 1));
      for (let j = 0; j < n; j++) {
        const a = sp.angle - sp.dirSign * sp.omega / 60 * (j / n), p = rimAt(a), p2 = rimAt(a + 0.01 * sp.dirSign);
        let tx = p2[0] - p[0], ty = p2[1] - p[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const spd = R * rnd(6, 13) * (0.5 + 0.5 * sp.omega / OMEGA);
        api.sparkScreen(p[0], p[1], -tx * spd + rnd(-20, 20), -ty * spd + rnd(-20, 20), { life: rnd(0.25, 0.7), size: rnd(0.8, 1.5), color: Math.random() < 0.15 ? 'white' : sp.colour, gravity: 520, floor: gnd });
      }
    });
    if (s.lit) {
      const I = Math.max(...s.sps.map(q => q.I)), g = api.unproject(L.tips[0][0], gnd);
      if (I > 0.03) api.light(g ? [g[0], 0.4, g[2]] : [0, 0.4, 0], 0.3 + 0.5 * I, [255, 196, 110]);
    }
  }
  function wireHand(s, api) {
    const c = api.cam, sp = s.sps[0], q = proj(c, sp.pos[0], sp.pos[1], sp.pos[2]), S = Math.min(api.H * 0.9, api.W);
    const anchor = [api.W * 0.74 + Math.sin((s.t || 0) * 1.1) * 6, api.H * 0.86];
    const rot = Math.atan2(q.y - anchor[1], q.x - anchor[0]) - Math.atan2(STICK[1], STICK[0]);
    return { anchor, S, rot: clamp(rot, -0.9, 0.9) };
  }

  // ---------- jump over the chakri (interactive) ----------
  const JUMP = { dur: 0.6, line: 1.7, feetZ: 2.0 };
  const jump = DiwaliTricks.register({
    id: 'chakri-jump',
    name: 'Jump over the chakri',
    compendium: [67],
    mode: 'ground',
    views: ['courtyard'],
    interactive: true,
    hint: 'Tap karke chakri jalao. Jab paas aaye, tap karke koodo!',
    spentLine: 'Jab tak bujhi nahi, kood-kood ke pair thak gaye.',
    options: [{ key: 'size', label: 'Size', choices: [['small', 'Chakri'], ['big', 'Bhoomi chakra']], default: 'small' }],

    create(api, opts) {
      const sp = spinner(opts.size || 'small', { pos: [-2.6, 0, JUMP.line - 0.3], burnK: 1.25 });
      return { sp, sps: [sp], lit: false, auto: false, jumpT: -1, clean: 0, passes: 0, lastX: sp.pos[0], wp: 0, t: 0, snd: null, endT: 0, said: false, how: 'jump' };
    },
    wick(s) { return [s.sp.pos[0] + s.sp.r + 0.04, 0.03, s.sp.pos[2]]; },
    autoplay(s, api, t) { s.auto = true; if (t > 0.5) api.ignite(); },
    ignite(s, api) { s.lit = true; s.sp.lit = true; s.snd = api.Sfx.skid({ pan: api.panOf(s.sp.pos) }); api.Sfx.crack({ vol: 0.2, pan: api.panOf(s.sp.pos), pieces: 2 }); },

    update(s, api, dt, e) {
      const sp = s.sp, p = api.pointer;
      if (e < 0) {
        if (!s.said && isArmed()) { s.said = true; api.say('Tap to light it, then tap to jump!', 2200); }
        if (p.justDown && isArmed()) api.ignite();
        return false;
      }
      s.t = e;
      spinStep(sp, api, dt);
      // it zig-zags across in front of your feet
      if (sp.lit && !sp.done) {
        const side = s.wp % 2 ? -1 : 1, target = [side * rnd(2.5, 2.7), JUMP.line + (s.wp % 3 - 1) * 0.25];
        const dx = target[0] - sp.pos[0], dz = target[1] - sp.pos[2], d = Math.hypot(dx, dz);
        const speed = 2.5 * clamp(sp.I * 1.3, 0.3, 1);
        sp.vel[0] += (dx / d * speed - sp.vel[0]) * dt * 3; sp.vel[2] += (dz / d * speed - sp.vel[2]) * dt * 3;
        if (Math.abs(dx) < 0.4) s.wp++;
      } else { sp.vel[0] *= Math.exp(-dt * 3); sp.vel[2] *= Math.exp(-dt * 3); }
      sp.pos[0] += sp.vel[0] * dt; sp.pos[2] += sp.vel[2] * dt;
      sp.wob[0] = Math.sin(sp.t * 13) * 0.05 * sp.I; sp.wob[1] = Math.cos(sp.t * 11) * 0.05 * sp.I;
      // jumping
      if (s.jumpT >= 0) { s.jumpT += dt; if (s.jumpT > JUMP.dur) s.jumpT = -1; }
      const canJump = s.jumpT < 0;
      if (canJump && sp.lit && !sp.done) {
        if (p.justDown) startJump(s, api);
        else if (s.auto && Math.abs(sp.vel[0]) > 0.3 && Math.sign(-sp.pos[0]) === Math.sign(sp.vel[0])) {
          const tc = -sp.pos[0] / sp.vel[0];
          if (tc > 0.2 && tc < 0.3) startJump(s, api);
        }
      }
      // judging: the moment it passes under you
      if (sp.lit && sp.I > 0.15 && Math.sign(sp.pos[0]) !== Math.sign(s.lastX) && Math.abs(sp.pos[2] - JUMP.line) < 0.9) {
        s.passes++;
        const air = s.jumpT > 0.05 && s.jumpT < JUMP.dur - 0.06;
        if (air) { s.clean++; api.say('Clean jump!', 900); } else api.say(s.jumpT >= 0 ? 'Arre, jaldi kood gaye!' : 'Kood! Kood!', 900);
      }
      s.lastX = sp.pos[0];
      s.snd?.set(sp.done ? 0 : 0.18 + 0.4 * sp.I, sp.omega / OMEGA * 0.95, api.panOf(sp.pos));
      if (!s.endT && sp.done) {
        s.endT = e; s.snd?.stop(); s.snd = null; api.smoke(sp.pos, 3, { size: 0.6 });
        scorch(api, [sp.pos[0], 0, sp.pos[2]], 0.6); leaveSpent(api, sp, [sp.pos[0], 0, sp.pos[2]]);
      }
      return (s.endT && e > s.endT + 1.2 && s.jumpT < 0) || e > 30;
    },
    stop(s) { s.snd?.stop(); s.snd = null; },

    draw(s, api) {
      const sp = s.sp, ctx = api.ctx, c = api.cam;
      // the view bounces: the courtyard drops away under you while you're in the air
      const dy = s.jumpT >= 0 ? Math.sin(Math.PI * s.jumpT / JUMP.dur) * api.H * 0.05 : 0;
      if (dy > 0.5 && ctx.canvas && ctx.canvas.width) {
        ctx.drawImage(ctx.canvas, 0, 0, ctx.canvas.width, ctx.canvas.height, 0, dy, api.W, api.H);
      }
      ctx.save(); ctx.translate(0, dy);
      const R = flatR(sp), centre = [sp.pos[0], sp.h / 2, sp.pos[2]];
      api.shadow(sp.pos, sp.r * 1.3, 0);
      if (!s.lit) fuseTail(api, sp, centre);
      api.drawFaces(diskFaces(sp, R, centre));
      ring3D(api, sp, R, centre);
      ctx.restore();
      if (s.lit) {
        // sparks leave from where you see it (shifted with the view while you're up)
        const q = proj(c, centre[0], centre[1], centre[2]), g = api.unproject(q.x, q.y + dy);
        const at = g ? [g[0], centre[1], g[2]] : centre;
        emit3D(sp, api, R, at, 1 / 60, { gravity: 60, floor: Infinity });
        if (sp.I > 0.03) api.light(at, 0.25 + 0.55 * sp.I);
      }
      drawFeet(api, s.jumpT >= 0 ? Math.sin(Math.PI * s.jumpT / JUMP.dur) : 0);
    },

    stat(s) { return s.lit && s.passes ? `${s.clean} clean jump${s.clean === 1 ? '' : 's'}! · ${s.clean} of ${s.passes} passes` : ''; },
  });
  void jump;
  function startJump(s, api) { s.jumpT = 0; api.Sfx.rustle({ vol: 0.14 }); }

  // Your own feet in hawai chappals at the bottom of the view.
  function drawFeet(api, lift) {
    const c = api.cam, ctx = api.ctx;
    for (const side of [-1, 1]) {
      const cx = side * 0.42, cz = JUMP.feetZ + 0.62;
      const outline = (wd, ln, y) => {
        ctx.beginPath();
        for (let i = 0; i <= 16; i++) {
          const a = i / 16 * TAU, v = Math.sin(a), u = Math.cos(a) * wd * (v < 0 ? 1.08 : 0.86);
          const q = proj(c, cx + u + side * 0.04 * v, y, cz + v * ln);
          i ? ctx.lineTo(q.x, q.y - lift * api.H * 0.03) : ctx.moveTo(q.x, q.y - lift * api.H * 0.03);
        }
        ctx.closePath();
      };
      ctx.save();
      if (lift < 0.05) { outline(0.3, 0.75, 0.002); ctx.fillStyle = 'rgba(10,6,4,.35)'; ctx.fill(); }
      outline(0.25, 0.68, 0.03); ctx.fillStyle = '#2f5d9a'; ctx.fill();
      outline(0.22, 0.64, 0.06); ctx.fillStyle = '#ece8dc'; ctx.fill();
      outline(0.17, 0.56, 0.16); ctx.fillStyle = '#b97e5a'; ctx.fill();
      // the blue V strap
      const toe = proj(c, cx + side * 0.05, 0.2, cz - 0.42), tx = toe.x, ty = toe.y - lift * api.H * 0.03;
      const l = proj(c, cx - 0.2, 0.12, cz - 0.05), lx = l.x, ly = l.y - lift * api.H * 0.03;
      const r = proj(c, cx + 0.2, 0.12, cz - 0.05);
      ctx.strokeStyle = '#2f5d9a'; ctx.lineWidth = Math.max(2, 0.06 * c.scale); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(tx, ty); ctx.lineTo(r.x, r.y - lift * api.H * 0.03); ctx.stroke();
      ctx.restore();
    }
  }
})();

DiwaliTricks.bind(67, 'chakri-jump', { size: 'small' }, 'courtyard');
DiwaliTricks.bind(68, 'chakri', { how: 'hand', size: 'small' }, 'courtyard');
DiwaliTricks.bind(69, 'chakri', { how: 'wire', size: 'small' }, 'courtyard');
DiwaliTricks.bind(70, 'chakri', { how: 'throw', size: 'small' }, 'courtyard');
DiwaliTricks.bind(71, 'chakri', { how: 'thali', size: 'small' }, 'courtyard');
DiwaliTricks.bind(72, 'chakri', { how: 'stairs', size: 'small' }, 'stairs');
DiwaliTricks.bind(73, 'chakri', { how: 'double', size: 'small' }, 'courtyard');
DiwaliTricks.bind(74, 'chakri', { how: 'box', size: 'small' }, 'courtyard');
DiwaliTricks.bind(82, 'chakri', { how: 'ground', size: 'big' }, 'courtyard');

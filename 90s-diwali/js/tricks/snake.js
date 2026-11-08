// Compendium #99–#102 — the snake tablet (saanp ki goli). A small black tablet that, once lit,
// pushes out a long curling ash snake: a porous grey-black tube that rears its head while it
// grows, wanders, curls and lies down. Slight smoke, a soft sizzle, no bang. It leaves the snake
// and a black stain on the floor (on Mummy's rangoli, in #101).
(function () {
  'use strict';
  const { UNIT_M } = Phys;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;
  const KIDS = ['Bunty', 'Pinky', 'Golu'];
  const RANGOLI_R = 1.5;           // a 60 cm rangoli

  const P = { x: 0, y: 0, f: 1, d: 1 };
  function proj(c, x, y, z) {
    const rx = x - c.C[0], ry = y - c.C[1], rz = z - c.C[2];
    const d = Math.max(0.3, rx * c.fwd[0] + ry * c.fwd[1] + rz * c.fwd[2]);
    P.x = c.cx + c.F * (rx * c.right[0] + ry * c.right[1] + rz * c.right[2]) / d;
    P.y = c.cy - c.F * (rx * c.up[0] + ry * c.up[1] + rz * c.up[2]) / d;
    P.f = c.z0 / d; P.d = d;
    return P;
  }

  const MODES = {
    classic: { line: 'Chhoti si kaali goli, aur itna lamba saanp!' },
    pile: { line: 'Saari goliyan ek saath: saanp nahi, ajgar. Aur Mummy ki daant bonus mein.' },
    rangoli: { line: 'Rangoli pe kaala daag. Mummy gussa, hum khush.' },
    race: { line: 'Mera saanp sabse lamba tha. Haan, naap ke dekha tha.' },
  };

  function mkSnake(o) {
    const r = o.r, ds = r * 0.55, cap = Math.ceil(o.Lmax / ds) + 4;
    return {
      base: o.base, baseY: o.baseY || 0.03, r, ds, Lmax: o.Lmax, tau: o.tau, heading: o.heading, curv: rnd(-1, 1), bias: rnd(0.2, 0.8) * (Math.random() < 0.5 ? -1 : 1),
      box: o.box, name: o.name || '', len: 0, n: 0, cap, xs: new Float32Array(cap), zs: new Float32Array(cap), seed: new Float32Array(cap * 4),
      sx: new Float32Array(cap), sy: new Float32Array(cap), sr: new Float32Array(cap), sd: new Float32Array(cap), order: new Uint16Array(cap),
      rear: 0, growing: true, t: 0, done: false,
    };
  }
  function addPoint(sn) {
    const i = sn.n;
    if (i >= sn.cap) return false;
    if (i === 0) { sn.xs[0] = sn.base[0]; sn.zs[0] = sn.base[2]; }
    else {
      // wander + a habit of curling one way
      sn.curv += rnd(-1, 1) * 14 * sn.ds + sn.bias * sn.ds * 4;
      sn.curv = clamp(sn.curv, -4, 4);
      sn.heading += sn.curv * sn.ds;
      const x = sn.xs[i - 1], z = sn.zs[i - 1], b = sn.box;
      if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) {
        const cx = (b[0] + b[1]) / 2, cz = (b[2] + b[3]) / 2, want = Math.atan2(cz - z, cx - x);
        sn.heading += Math.atan2(Math.sin(want - sn.heading), Math.cos(want - sn.heading)) * 0.25; sn.curv *= 0.6;
      }
      sn.xs[i] = x + Math.cos(sn.heading) * sn.ds; sn.zs[i] = z + Math.sin(sn.heading) * sn.ds;
    }
    for (let k = 0; k < 4; k++) sn.seed[i * 4 + k] = Math.random();
    sn.n++;
    return true;
  }
  function growStep(sn, dt) {
    if (!sn.growing) { sn.rear = Math.max(0, sn.rear - dt * 1.6); return; }
    sn.t += dt;
    sn.len = sn.Lmax * (1 - Math.exp(-sn.t / sn.tau));
    while ((sn.n - 1) * sn.ds < sn.len && addPoint(sn)) { /* extend */ }
    sn.rear = Math.min(1, sn.rear + dt * 2);
    if (sn.len >= sn.Lmax * 0.96) { sn.growing = false; sn.done = true; }
  }
  const lengthM = sn => Math.max(0, (sn.n - 1) * sn.ds) * UNIT_M;

  // The tube: overlapping rings drawn far-to-near, each with a lit crust and dark pores.
  const ASH = ['rgb(46,43,41)', 'rgb(58,55,52)', 'rgb(40,38,37)'];
  function drawSnake(ctx, c, sn, W, H) {
    const n = sn.n; if (n < 1) return;
    const L = (n - 1) * sn.ds;
    for (let i = 0; i < n; i++) {
      const s = i * sn.ds, toHead = L - s;
      const taper = toHead < sn.r * 2 ? 0.65 + 0.35 * toHead / (sn.r * 2) : 1;
      const r = sn.r * taper * (0.86 + 0.24 * sn.seed[i * 4]);
      const rise = sn.baseY * Math.max(0, 1 - s / 0.15);
      const rear = sn.rear * 0.16 * Math.max(0, 1 - toHead / 0.45) ** 2;
      const q = proj(c, sn.xs[i], r * 0.9 + rise + rear, sn.zs[i]);
      sn.sx[i] = q.x; sn.sy[i] = q.y; sn.sr[i] = Math.max(0.8, r * c.scale * q.f); sn.sd[i] = P.d; sn.order[i] = i;
    }
    // contact shadow
    ctx.save(); ctx.fillStyle = 'rgba(8,6,5,.22)'; ctx.beginPath();
    for (let i = 0; i < n; i += 2) { const g = proj(c, sn.xs[i], 0.002, sn.zs[i]), rr = sn.sr[i] * 1.25; ctx.moveTo(g.x + rr, g.y + 1); ctx.ellipse(g.x, g.y + 1, rr, rr * 0.5, 0, 0, TAU); }
    ctx.fill();
    const ord = sn.order.subarray(0, n).sort((a, b) => sn.sd[b] - sn.sd[a]);
    for (const i of ord) {
      const x = sn.sx[i], y = sn.sy[i], r = sn.sr[i], sd = sn.seed;
      if (x < -r || x > W + r || y < -r || y > H + r) continue;
      ctx.fillStyle = ASH[i % 3]; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(118,112,104,.55)'; ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 0.32, r * 0.5, 0, TAU); ctx.fill();
      if (r > 2.5) {
        ctx.fillStyle = 'rgba(14,12,11,.85)';
        ctx.beginPath(); ctx.arc(x + (sd[i * 4 + 1] - 0.5) * r, y + (sd[i * 4 + 2] - 0.5) * r * 0.9, r * 0.13, 0, TAU); ctx.arc(x + (sd[i * 4 + 3] - 0.5) * r * 1.2, y + (sd[i * 4] - 0.3) * r * 0.6, r * 0.1, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(170,164,156,.55)'; ctx.beginPath(); ctx.arc(x + (sd[i * 4 + 2] - 0.6) * r * 0.9, y - (sd[i * 4 + 1]) * r * 0.5, r * 0.08, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  function drawStain(ctx, c, sn, k) {
    if (sn.n < 2) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, a] of [[3.6, 0.22 * k], [2.2, 0.35 * k]]) {
      ctx.strokeStyle = `rgba(18,13,10,${a})`; ctx.beginPath();
      let lw = 1;
      for (let i = 0; i < sn.n; i += 2) { const q = proj(c, sn.xs[i], 0.002, sn.zs[i]); lw = Math.max(lw, sn.r * w * c.scale * q.f); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
      ctx.lineWidth = lw; ctx.stroke();
    }
    const q = proj(c, sn.base[0], 0.002, sn.base[2]), R = sn.r * 6 * c.scale * q.f;
    ctx.translate(q.x, q.y); ctx.scale(1, 0.6);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, `rgba(10,8,6,${0.7 * k})`); g.addColorStop(1, 'rgba(10,8,6,0)');
    ctx.fillStyle = g; ctx.fillRect(-R, -R, R * 2, R * 2);
    ctx.restore();
  }

  // Mummy's rangoli: coloured powder rings and petals on the doorstep floor.
  function drawRangoli(ctx, c) {
    const ring = (r0, r1, col, n = 36) => {
      ctx.fillStyle = col; ctx.beginPath();
      for (let i = 0; i <= n; i++) { const a = i / n * TAU, q = proj(c, Math.cos(a) * r1, 0.003, Math.sin(a) * r1); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
      if (r0 > 0) for (let i = n; i >= 0; i--) { const a = i / n * TAU, q = proj(c, Math.cos(a) * r0, 0.003, Math.sin(a) * r0); ctx.lineTo(q.x, q.y); }
      ctx.closePath(); ctx.fill();
    };
    const petals = (count, r0, r1, wd, col, rot = 0) => {
      ctx.fillStyle = col; ctx.beginPath();
      for (let k = 0; k < count; k++) {
        const a = rot + k / count * TAU, ca = Math.cos(a), sa = Math.sin(a), pa = -sa, pb = ca;
        for (let i = 0; i <= 12; i++) {
          const u = i <= 6 ? i / 6 : (12 - i) / 6, rr = r0 + (r1 - r0) * u, side = (i <= 6 ? 1 : -1) * Math.sin(u * Math.PI) * wd;
          const q = proj(c, ca * rr + pa * side, 0.004, sa * rr + pb * side);
          i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
        }
        ctx.closePath();
      }
      ctx.fill();
    };
    const dots = (count, r, size, col) => {
      ctx.fillStyle = col; ctx.beginPath();
      for (let k = 0; k < count; k++) { const a = k / count * TAU, q = proj(c, Math.cos(a) * r, 0.004, Math.sin(a) * r), rr = size * c.scale * q.f; ctx.moveTo(q.x + rr, q.y); ctx.ellipse(q.x, q.y, rr, rr * 0.75, 0, 0, TAU); }
      ctx.fill();
    };
    ctx.save();
    petals(8, 1.0, RANGOLI_R, 0.28, 'rgba(206,40,112,.92)');
    petals(8, 1.05, 1.38, 0.12, 'rgba(250,236,214,.85)');
    ring(0.86, 1.02, 'rgba(244,190,36,.95)');
    ring(0.62, 0.86, 'rgba(36,142,84,.92)');
    dots(14, 0.74, 0.035, 'rgba(250,244,230,.95)');
    ring(0, 0.6, 'rgba(232,110,30,.92)');
    petals(6, 0.08, 0.5, 0.12, 'rgba(250,238,210,.9)', 0.3);
    ring(0, 0.1, 'rgba(206,40,112,.95)', 16);
    ctx.restore();
  }

  let current = null;
  const trick = DiwaliTricks.register({
    id: 'snake',
    name: 'Snake tablet',
    compendium: [99, 100, 101, 102],
    mode: 'ground',
    views: ['doorstep'],
    fuse: 1.6,
    options: [{ key: 'how', label: 'How', choices: [['classic', 'One tablet'], ['pile', 'A pile of tablets'], ['rangoli', "On Mummy's rangoli"], ['race', 'Snake race (3)']], default: 'classic' }],

    create(api, opts) {
      const how = MODES[opts.how] ? opts.how : 'classic';
      const s = { how, line: MODES[how].line, snakes: [], tablets: [], lit: false, hiss: null, endT: 0, smokeT: 0, left: false, inRemain: false };
      const tab = Mesh.cylinder(0.06, 0.03, { segs: 10, bands: 1, rgb: [44, 40, 38], top: [58, 54, 50], bottom: [30, 28, 26] });
      const addTab = (x, y, z, tilt = 0) => s.tablets.push({ pos: [x, y + 0.015, z], R: Phys.M3.mul(Phys.M3.rotY(rnd(0, TAU)), Phys.M3.rotX(tilt)) });
      const box = [-2.6, 2.6, -3.0, 1.7];
      if (how === 'race') {
        [-1.7, 0, 1.7].forEach((x, i) => {
          addTab(x, 0, -1.2);
          s.snakes.push(mkSnake({ base: [x, 0, -1.2], r: 0.045, Lmax: rnd(1.4, 2.5), tau: rnd(3.0, 4.0), heading: Math.PI / 2 + rnd(-0.5, 0.5), box: [x - 0.75, x + 0.75, -2.6, 1.8], name: KIDS[i] }));
        });
      } else if (how === 'pile') {
        const spots = [[-0.07, 0, -0.05], [0.08, 0, -0.04], [0.0, 0, 0.08], [-0.1, 0, 0.09], [0.11, 0, 0.07], [0.0, 0.03, 0.0], [0.05, 0.03, 0.04]];
        for (const [x, y, z] of spots) addTab(x, y, z, rnd(-0.25, 0.25));
        s.snakes.push(mkSnake({ base: [0, 0, 0], baseY: 0.07, r: 0.09, Lmax: 4.6, tau: 4.2, heading: rnd(0, TAU), box }));
        s.count = spots.length;
      } else {
        addTab(0, 0, 0);
        s.snakes.push(mkSnake({ base: [0, 0, 0], r: 0.045, Lmax: rnd(1.7, 2.2), tau: rnd(3.4, 3.8), heading: rnd(0, TAU), box: how === 'rangoli' ? [-2.2, 2.2, -2.4, 1.6] : box }));
      }
      s.tab = tab;
      current = s;
      return s;
    },

    wick(s) { const t = s.tablets[s.tablets.length - 1]; return [t.pos[0], t.pos[1] + 0.03, t.pos[2]]; },

    ignite(s, api) {
      s.lit = true;
      s.hiss = api.Sfx.fuse({ vol: s.how === 'pile' ? 0.05 : 0.025, pan: api.panOf(s.snakes[0].base) });
      if (s.how === 'rangoli') { s.inRemain = true; api.remain((ctx, a) => drawRangoli(ctx, a.cam)); }
    },

    update(s, api, dt, e) {
      let growing = false;
      for (const sn of s.snakes) { growStep(sn, dt); growing ||= sn.growing; }
      s.smokeT -= dt;
      if (growing && s.smokeT <= 0) {
        s.smokeT = s.how === 'pile' ? rnd(0.12, 0.25) : rnd(0.25, 0.5);
        for (const sn of s.snakes) if (sn.growing) api.smoke([sn.base[0], 0.1, sn.base[2]], 1, { size: s.how === 'pile' ? 0.8 : 0.45 });
        if (Math.random() < 0.3) api.Sfx.crack({ vol: 0.03, pan: api.panOf(s.snakes[0].base), pieces: 1 });
      }
      for (const sn of s.snakes) if (sn.growing && Math.random() < dt * 6) api.spark([sn.base[0], sn.baseY + 0.04, sn.base[2]], [rnd(-0.4, 0.4), rnd(0.3, 1.2), rnd(-0.4, 0.4)], { life: rnd(0.15, 0.35), size: 0.6, gravity: 40, color: 'red' });
      if (growing) {
        let I = 0; for (const sn of s.snakes) if (sn.growing) I = Math.max(I, Math.exp(-sn.t / sn.tau));
        api.light([s.snakes[0].base[0], 0.15, s.snakes[0].base[2]], 0.08 + 0.12 * I, [255, 120, 60]);
      }
      if (!growing && s.hiss) { s.hiss.stop(); s.hiss = null; }
      // once every snake has stopped and lain down, it stays on the floor
      if (!growing && !s.endT && s.snakes.every(sn => sn.rear <= 0)) { s.endT = e; leaveRemains(s, api); }
      return (s.endT && e > s.endT + 1.2) || e > 40;
    },

    stop(s) { s.hiss?.stop(); s.hiss = null; },

    draw(s, api) {
      const c = api.cam, ctx = api.ctx;
      if (s.how === 'rangoli' && !s.inRemain) drawRangoli(ctx, c);
      if (s.how === 'race') {
        ctx.save(); ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,244,225,.85)';
        for (const sn of s.snakes) { const q = proj(c, sn.base[0], 0, sn.base[2] - 0.45); ctx.fillText(sn.name, q.x, q.y); }
        ctx.restore();
      }
      if (s.left) return;   // the remains draw the finished snakes
      // the tablets (burnt ones go ashy grey)
      const faces = [];
      for (const t of s.tablets) { api.shadow(t.pos, 0.09, 0); for (const f of Mesh.place(s.tab.faces, t.R, t.pos)) faces.push(s.lit ? { ...f, rgb: f.rgb.map(v => v * 0.8 + 18) } : f); }
      api.drawFaces(faces);
      for (const sn of s.snakes) {
        // dull ember glow where it's still coming out
        if (sn.growing && s.lit) {
          const q = proj(c, sn.base[0], sn.baseY + 0.02, sn.base[2]), r = Math.max(4, sn.r * 3.5 * c.scale * q.f), k = 0.35 + 0.4 * Math.exp(-sn.t / sn.tau);
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r); g.addColorStop(0, `rgba(255,120,50,${k})`); g.addColorStop(1, 'rgba(200,50,20,0)');
          ctx.fillStyle = g; ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2); ctx.restore();
        }
        drawSnake(ctx, c, sn, api.W, api.H);
      }
    },

    stat(s) {
      if (!s.lit) return '';
      const cm = sn => Math.round(lengthM(sn) * 100);
      if (s.how === 'race') {
        const o = s.snakes.slice().sort((a, b) => lengthM(b) - lengthM(a));
        return `${o[0].name}'s snake wins · ${cm(o[0])} cm (vs ${o.slice(1).map(cm).join(', ')} cm)`;
      }
      const sn = s.snakes[0];
      if (s.how === 'pile') return `One snake from ${s.count} tablets · ${cm(sn)} cm long, ${(sn.r * 2 * UNIT_M * 100).toFixed(1)} cm thick`;
      if (s.how === 'rangoli') {
        let inside = 0; for (let i = 0; i < sn.n; i++) if (Math.hypot(sn.xs[i], sn.zs[i]) < RANGOLI_R) inside++;
        return `${cm(sn)} cm of snake · ${Math.round(100 * inside / Math.max(1, sn.n))}% of it on the rangoli`;
      }
      return `Grew ${cm(sn)} cm in ${sn.t.toFixed(0)} s`;
    },
  });
  Object.defineProperty(trick, 'spentLine', { get: () => current?.line || MODES.classic.line, configurable: true });

  function leaveRemains(s, api) {
    s.left = true;
    const stain = s.how === 'rangoli' ? 1 : s.how === 'pile' ? 0.8 : 0.5;
    const snakes = s.snakes, tabs = s.tablets.map(t => Mesh.place(s.tab.faces.map(f => ({ ...f, rgb: [78, 74, 70] })), t.R, t.pos)).flat();
    api.remain((ctx, a) => {
      const c = a.cam;
      for (const sn of snakes) drawStain(ctx, c, sn, stain);
      a.drawFaces(tabs);
      for (const sn of snakes) drawSnake(ctx, c, sn, a.W, a.H);
    });
  }
})();

DiwaliTricks.bind(99, 'snake', { how: 'classic' }, 'doorstep');
DiwaliTricks.bind(100, 'snake', { how: 'pile' }, 'doorstep');
DiwaliTricks.bind(101, 'snake', { how: 'rangoli' }, 'doorstep');
DiwaliTricks.bind(102, 'snake', { how: 'race' }, 'doorstep');

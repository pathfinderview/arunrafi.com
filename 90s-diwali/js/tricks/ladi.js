// Compendium #58, #59, #62, #63, #64, #216 — the ladi (cracker garland).
// A braided fuse with small paper crackers plaited on alternate sides. The pop-front runs
// down the chain at ~15–25 cracks a second: each one a sharp crack, a spark puff, red paper
// and the cracker hopping off the braid. The red litter stays on the road afterwards.
(function () {
  'use strict';
  const { M3, v3, UNIT_M, G } = Phys;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;
  const CR = 0.035, CL = 0.2;           // cracker radius / length (≈ 7 mm × 4 cm)

  // A 5000-wala can't crack one-by-one inside a moment, so every visible cracker ("slot")
  // stands for `crackers / slots` real ones; the count in the stat is the real count.
  const LENGTHS = {
    100:  { crackers: 100,  metres: 0.9, slots: 100, rate: [16, 20] },
    1000: { crackers: 1000, metres: 4.2, slots: 250, rate: [19, 23] },
    5000: { crackers: 5000, metres: 15,  slots: 400, rate: [22, 25] },
  };
  const PAPERS = {
    red: { body: [182, 34, 30], hi: 'rgba(236,112,92,.75)', stroke: 'rgb(150,28,26)', end: [214, 186, 128], segs: 6,
      litter: [[176, 48, 38], [150, 38, 30], [196, 60, 44], [196, 160, 70]] },
    // Kerala ola padakkam: gunpowder folded into dried palm-leaf strips — pale straw, triangular.
    ola: { body: [208, 182, 122], hi: 'rgba(246,230,180,.8)', stroke: 'rgb(176,148,92)', end: [168, 138, 84], segs: 3,
      litter: [[214, 190, 130], [188, 160, 96], [232, 212, 166], [160, 132, 80]] },
  };
  const LINES = {
    'lane-1000': 'Humari ladi sabse lambi thi. Sach mein, naap ke dekha tha.',
    'lane-5000': '"5000-wala, Bhaiya ne laya." Poori gali ne suna.',
    'lane-100': 'Sau-wala bhi kam nahi hota.',
    both: 'Beech mein mili. Sabne kaha, "maine pehle hi bola tha!"',
    drum: 'Dhan-dhan-dhan-dhan: drum machine-gun ban gaya.',
    hang: 'Neem ke ped se latki ladi. Pattiyon mein laal kaagaz ki baarish.',
    ola: 'Raavile thanne ola padakkam: muttam mein palm-leaf ka kachra.',
  };

  // Allocation-free projection with a camera from api.cam.
  const P = { x: 0, y: 0, f: 1 };
  function proj(c, x, y, z) {
    const rx = x - c.C[0], ry = y - c.C[1], rz = z - c.C[2];
    const d = Math.max(0.3, rx * c.fwd[0] + ry * c.fwd[1] + rz * c.fwd[2]);
    P.x = c.cx + c.F * (rx * c.right[0] + ry * c.right[1] + rz * c.right[2]) / d;
    P.y = c.cy - c.F * (rx * c.up[0] + ry * c.up[1] + rz * c.up[2]) / d;
    P.f = c.z0 / d;
    return P;
  }
  // Rotation taking local +y onto axis a.
  function alignY(a) {
    const y = v3.norm(a);
    let x = Math.abs(y[1]) > 0.95 ? [1, 0, 0] : v3.norm(v3.cross(y, [0, 1, 0]));
    const z = v3.cross(x, y);
    x = v3.cross(y, z);
    return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
  }

  // Walk a centre-line function and drop n slots at equal arc length; returns the tangents too.
  function sampleArc(centre, n, spacing) {
    const out = [];
    let prev = centre(0), acc = 0, u = 0, need = 0;
    out.push({ p: prev, t: v3.norm(v3.sub(centre(0.01), prev)) });
    while (out.length < n && u < 5000) {
      u += 0.01;
      const q = centre(u), d = v3.len(v3.sub(q, prev));
      acc += d; need = spacing * out.length;
      if (acc >= need) out.push({ p: q, t: v3.norm(v3.sub(centre(u + 0.01), q)) });
      prev = q;
    }
    return out;
  }

  const DRUM = { r: 1.3, h: 3.2 };   // a 26 cm × 64 cm tin drum

  let current = null;
  const trick = DiwaliTricks.register({
    id: 'ladi',
    name: 'Ladi',
    compendium: [58, 59, 62, 63, 64, 216],
    mode: 'ground',
    views: ['lane', 'courtyard'],
    fuse: 1.4,
    options: [
      { key: 'length', label: 'Ladi', choices: [['100', '100-wala'], ['1000', '1000-wala'], ['5000', '5000-wala']], default: '1000' },
      { key: 'lay', label: 'How', choices: [['lane', 'Laid on the road'], ['both', 'Lit from both ends'], ['drum', 'In a tin drum'], ['hang', 'From the neem tree']], default: 'lane' },
      { key: 'paper', label: 'Paper', choices: [['red', 'Red paper'], ['ola', 'Palm leaf (ola)']], default: 'red' },
    ],

    create(api, opts) {
      const L = LENGTHS[opts.length] || LENGTHS[1000], kind = PAPERS[opts.paper] || PAPERS.red, lay = opts.lay || 'lane';
      const n = L.slots, per = L.crackers / n, Lu = L.metres / UNIT_M, spacing = Lu / (n - 1);
      const s = {
        L, kind, lay, n, per, Lu, spacing, line: kind === PAPERS.ola ? LINES.ola : (LINES[lay] || LINES[`lane-${opts.length}`] || LINES['lane-1000']),
        fx: new Float32Array(n), fy: new Float32Array(n), fz: new Float32Array(n),        // fuse point
        ax: new Float32Array(n), ay: new Float32Array(n), az: new Float32Array(n),        // cracker axis
        jx: new Float32Array(n), jy: new Float32Array(n), jz: new Float32Array(n),        // jerk from neighbours
        ox: new Float32Array(n), oy: new Float32Array(n), oz: new Float32Array(n),        // flight offset
        vx: new Float32Array(n), vy: new Float32Array(n), vz: new Float32Array(n), ft: new Float32Array(n),
        st: new Uint8Array(n), vert: new Uint8Array(n), R: new Array(n),
        e0: new Float32Array(n * 4), wb: new Uint8Array(n), isMesh: new Uint8Array(n), used: new Uint8Array(32),
        fronts: [], pops: 0, lit: false, lastPop: 0, firstPop: -1, endT: 0, clock: 0, meet: null, climb: 0,
        maxLit: n * 2 + 60, lit_: null, nl: 0, cyl: Mesh.cylinder(CR, CL, { segs: kind.segs, bands: 1, rgb: kind.body, top: kind.end, bottom: kind.end }),
        faces: [], drum: null, hangTop: 0,
      };
      s.lit_ = new Float32Array(s.maxLit * 5);
      const setSlot = (i, p, t, vertical) => {
        s.fx[i] = p[0]; s.fy[i] = p[1]; s.fz[i] = p[2];
        let a;
        if (vertical) { const psi = i * 2.4; a = v3.norm([Math.cos(psi) * 0.8, -0.6, Math.sin(psi) * 0.8]); s.vert[i] = 1; }
        else {
          const side = i % 2 ? 1 : -1, ang = side * (1.15 + rnd(-0.2, 0.2)), c = Math.cos(ang), sn = Math.sin(ang);
          a = [t[0] * c - t[2] * sn, 0, t[0] * sn + t[2] * c];
        }
        s.ax[i] = a[0]; s.ay[i] = a[1]; s.az[i] = a[2];
        s.R[i] = alignY(a);
      };

      if (lay === 'drum') {
        s.drum = { y: 0, vy: 0, tx: 0, tz: 0, wx: 0, wz: 0, maxY: 0, mesh: Mesh.cylinder(DRUM.r, DRUM.h, {
          segs: 18, bands: 4, top: false, bottom: false, inner: [70, 64, 58],
          colourAt: (sg, b) => { const rust = ((sg * 7 + b * 3) % 5 === 0) ? 0.72 : 1, rib = (b === 1 || b === 3) ? 0.82 : 1; return [64 * rust * rib + (rust < 1 ? 50 : 0), 98 * rust * rib, 142 * rust * rib - (rust < 1 ? 30 : 0)]; },
        }) };
      } else if (lay === 'hang') {
        // Hung from the balcony grill (off the top of the frame); the extra length coils on the road.
        const H = 11, base = [-1.4, 0, -1.5], Hv = H - 0.35, Lg = Math.max(0, Lu - Hv);
        s.hangTop = H;
        const coil = [];
        // spiral coil, lit at its centre
        if (Lg > 0) {
          let th = 0, ss = 0;
          while (ss < Lg) { const rho = 0.25 + 1.0 * (ss / Lg); coil.push([base[0] + Math.cos(th) * rho, CR, base[2] + Math.sin(th) * rho * 0.8]); th += 0.01 / rho; ss += 0.01; }
        }
        const E = coil.length ? coil[coil.length - 1] : [base[0], CR, base[2]];
        const centre = u => {
          const k = Math.floor(u / 0.01);
          if (k < coil.length) return coil[k];
          const up = u - coil.length * 0.01;
          return [E[0], 0.35 + up, E[2]];
        };
        const pts = sampleArc(centre, n, spacing);
        for (let i = 0; i < n; i++) { const q = pts[Math.min(i, pts.length - 1)]; setSlot(i, q.p, q.t, q.p[1] > 0.3); }
      } else {
        // An S-curve laid down the road, pointing at the far end of the place.
        const h = api.aim([0, 0, 0]), dir = [Math.cos(h), 0, Math.sin(h)], perp = [-dir[2], 0, dir[0]];
        const lam = clamp(Lu * 0.9, 4, 18), A = clamp(Lu * 0.06, 0.35, 1.3), s0 = -Math.min(Lu * 0.35, 2.5), ph = rnd(0, TAU);
        const centre = u => { const w = A * Math.sin(TAU * u / lam + ph) - A * Math.sin(ph); return [dir[0] * (s0 + u) + perp[0] * w, CR, dir[2] * (s0 + u) + perp[2] * w]; };
        const pts = sampleArc(centre, n, spacing);
        for (let i = 0; i < n; i++) { const q = pts[Math.min(i, pts.length - 1)]; setSlot(i, q.p, q.t, false); }
        s.dir = dir;
      }
      current = s;
      return s;
    },

    wick(s) {
      if (s.lay === 'drum') return [DRUM.r * 0.85, DRUM.h * 0.72, DRUM.r * 0.6];
      // the fuse lead sticking out before the first cracker
      const i = 0, j = 1, tx = s.fx[i] - s.fx[j], tz = s.fz[i] - s.fz[j], l = Math.hypot(tx, tz) || 1;
      return [s.fx[i] + tx / l * 0.25, 0.03, s.fz[i] + tz / l * 0.25];
    },

    ignite(s, api) {
      s.lit = true;
      const r = () => rnd(s.L.rate[0], s.L.rate[1]);
      s.fronts.push({ i: 0, dir: 1, rate: r(), acc: 0.6, on: true });
      if (s.lay === 'both') s.fronts.push({ i: s.n - 1, dir: -1, rate: rnd(s.L.rate[0] * 0.8, s.L.rate[1] * 1.1), acc: 0.3, on: true });
      // The red litter stays where it fell.
      const lit = s.lit_, kind = s.kind;
      const cols = kind.litter.map(c => `rgb(${c.join(',')})`);
      api.remain((ctx, a) => {
        const c = a.cam, sc = c.scale, sq = Math.max(0.25, Math.sin(c.pitch + 0.35));
        for (let k = 0; k < cols.length; k++) {
          ctx.fillStyle = cols[k]; ctx.beginPath();
          for (let i = 0; i < s.nl; i++) {
            const o = i * 5;
            if (lit[o + 4] !== k) continue;
            const q = proj(c, lit[o], 0.004, lit[o + 1]), w = lit[o + 3] * sc * q.f, cw = Math.cos(lit[o + 2]) * w, sw = Math.sin(lit[o + 2]) * w;
            if (w < 0.4 || q.x < -10 || q.x > a.W + 10 || q.y < -10 || q.y > a.H + 10) continue;
            ctx.moveTo(q.x - cw, q.y - sw * sq); ctx.lineTo(q.x + sw * 0.6, q.y - cw * 0.6 * sq); ctx.lineTo(q.x + cw, q.y + sw * sq); ctx.lineTo(q.x - sw * 0.6, q.y + cw * 0.6 * sq); ctx.closePath();
          }
          ctx.fill();
        }
      });
    },

    update(s, api, dt, e) {
      const n = s.n;
      // the fire running down the braid
      for (const f of s.fronts) {
        if (!f.on) continue;
        f.acc += dt * f.rate * rnd(0.45, 1.55);
        while (f.acc >= 1 && f.on) {
          f.acc -= 1;
          if (f.i < 0 || f.i >= n) { f.on = false; break; }
          if (s.st[f.i] === 0) pop(s, api, f.i, e);
          f.i += f.dir;
          if (s.fronts.length === 2) {
            const [A, B] = s.fronts;
            if (A.i > B.i) { A.on = B.on = false; s.meet = ((A.i + B.i) / 2) * s.spacing * UNIT_M; api.say(`Mil gaye! ${s.meet.toFixed(1)} m pe`, 1800); }
          }
        }
        if (f.on && f.i >= 0 && f.i < n && s.lay !== 'drum') {
          const i = f.i, p = [s.fx[i] + s.jx[i], s.fy[i] + s.jy[i], s.fz[i] + s.jz[i]];
          api.spark(p, [rnd(-1.5, 1.5), rnd(0.5, 3), rnd(-1.5, 1.5)], { life: rnd(0.08, 0.2), size: 0.7, gravity: 120 });
        }
      }
      // crackers hopping off the braid, neighbours jerking
      const k = Math.exp(-dt * 7);
      for (let i = 0; i < n; i++) {
        if (s.st[i] === 1) {
          s.ft[i] += dt; s.vy[i] -= G * dt;
          s.ox[i] += s.vx[i] * dt; s.oy[i] += s.vy[i] * dt; s.oz[i] += s.vz[i] * dt;
          if (s.ft[i] > 0.2) s.st[i] = 2;
        }
        s.jx[i] *= k; s.jy[i] *= k; s.jz[i] *= k;
      }
      // the drum hops and rings
      const d = s.drum;
      if (d) {
        d.vy -= G * dt; d.y += d.vy * dt;
        if (d.y < 0) { if (d.vy < -2) api.Sfx.strike('tin', { vol: clamp(-d.vy / 20, 0.05, 0.3), pan: api.panOf([0, 0, 0]), detune: rnd(0.5, 0.56) }); d.y = 0; d.vy = d.vy < -1.5 ? -d.vy * 0.25 : 0; }
        d.wx += (-90 * d.tx - 6 * d.wx) * dt; d.wz += (-90 * d.tz - 6 * d.wz) * dt;
        d.tx += d.wx * dt; d.tz += d.wz * dt;
        d.maxY = Math.max(d.maxY, d.y);
      }
      const left = s.fronts.some(f => f.on);
      if (!left && !s.endT) s.endT = e;
      return (s.endT && e > s.endT + 1.8) || e > 40;
    },

    stop() {},

    draw(s, api) {
      const ctx = api.ctx, c = api.cam, kind = s.kind;
      s.clock += 1 / 60;
      if (kind === PAPERS.ola) {
        // early-morning light over the courtyard
        ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(255,236,204,.42)'; ctx.fillRect(-20, -20, api.W + 40, api.H + 40);
        ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(150,140,128,.12)'; ctx.fillRect(-20, -20, api.W + 40, api.H + 40); ctx.restore();
      }
      if (s.drum) { drawDrum(s, api); return; }
      const n = s.n, sway = s.lay === 'hang';
      // positions (the hung chain sways; its top is fixed at the grill)
      const X = i => s.fx[i] + s.jx[i] + (sway && s.vert[i] ? Math.sin(s.clock * 1.3 + s.fy[i] * 0.3) * 0.14 * (1 - s.fy[i] / s.hangTop) : 0);
      // braided fuse between the live ends
      let lo = 0, hi = n - 1;
      if (s.fronts.length) { lo = s.fronts[0].i; if (s.fronts[1]) hi = s.fronts[1].i; }
      if (s.fronts.length && !s.fronts.some(f => f.on)) lo = n;
      if (lo <= hi) {
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const q0 = proj(c, X(lo), s.fy[lo] + s.jy[lo], s.fz[lo] + s.jz[lo]);
        ctx.lineWidth = Math.max(1, 0.03 * c.scale * q0.f); ctx.strokeStyle = 'rgba(214,196,150,.95)';
        ctx.beginPath(); ctx.moveTo(q0.x, q0.y);
        const step = Math.max(1, Math.floor((hi - lo) / 160));
        for (let i = lo; i <= hi; i += step) { const q = proj(c, X(i), s.fy[i] + s.jy[i], s.fz[i] + s.jz[i]); ctx.lineTo(q.x, q.y); }
        if (sway && s.vert[hi]) { const q = proj(c, s.fx[hi], s.hangTop + 1, s.fz[hi]); ctx.lineTo(q.x, q.y); }
        ctx.stroke();
        if (ctx.setLineDash) { ctx.setLineDash([2, 3]); ctx.strokeStyle = 'rgba(120,96,60,.8)'; ctx.lineWidth = Math.max(0.7, ctx.lineWidth * 0.5); ctx.stroke(); ctx.setLineDash([]); }
        ctx.restore();
      }
      // which crackers get a real mesh: the ones the fire is about to reach
      s.isMesh.fill(0);
      const fronts = s.fronts.length ? s.fronts : [{ i: 0, dir: 1, on: true }];
      for (const f of fronts) { if (!f.on) continue; for (let k = 0, i = f.i; k < 22 && i >= 0 && i < n; i += f.dir) if (s.st[i] === 0) { s.isMesh[i] = 1; k++; } }
      // everything else: projected paper tubes, batched by width
      const e0 = s.e0, wb = s.wb, used = s.used; used.fill(0);
      for (let i = 0; i < n; i++) {
        wb[i] = 0;
        if (s.st[i] !== 0 || s.isMesh[i]) continue;
        const x = X(i), y = s.fy[i] + s.jy[i], z = s.fz[i] + s.jz[i];
        const a = proj(c, x + s.ax[i] * 0.01, y + s.ay[i] * 0.01, z + s.az[i] * 0.01); e0[i * 4] = a.x; e0[i * 4 + 1] = a.y;
        const b = proj(c, x + s.ax[i] * CL, y + s.ay[i] * CL, z + s.az[i] * CL); e0[i * 4 + 2] = b.x; e0[i * 4 + 3] = b.y;
        if (b.x < -20 || b.x > api.W + 20 || b.y < -20 || b.y > api.H + 20) continue;
        const w = clamp(Math.round(2 * CR * 2 * c.scale * b.f), 2, 31); wb[i] = w; used[w] = 1;
      }
      ctx.save(); ctx.lineCap = 'butt';
      for (let w = 2; w < 32; w++) {
        if (!used[w]) continue;
        ctx.lineWidth = w / 2; ctx.strokeStyle = kind.stroke; ctx.beginPath();
        for (let i = 0; i < n; i++) if (wb[i] === w) { ctx.moveTo(e0[i * 4], e0[i * 4 + 1]); ctx.lineTo(e0[i * 4 + 2], e0[i * 4 + 3]); }
        ctx.stroke();
        if (w >= 4) {
          ctx.lineWidth = w / 5; ctx.strokeStyle = kind.hi; ctx.beginPath();
          const off = w * 0.12;
          for (let i = 0; i < n; i++) if (wb[i] === w) { ctx.moveTo(e0[i * 4], e0[i * 4 + 1] - off); ctx.lineTo(e0[i * 4 + 2], e0[i * 4 + 3] - off); }
          ctx.stroke();
        }
      }
      // crackers in the air for a blink after they go
      ctx.strokeStyle = kind.stroke;
      for (let i = 0; i < n; i++) {
        if (s.st[i] !== 1) continue;
        const x = X(i) + s.ox[i], y = Math.max(0.02, s.fy[i] + s.oy[i]), z = s.fz[i] + s.oz[i], sp = s.ft[i] * 30;
        const a = proj(c, x, y, z), ax = a.x, ay = a.y, w = Math.max(1, 2 * CR * c.scale * a.f * 0.8);
        const b = proj(c, x + Math.cos(sp) * CL * 0.7, y + Math.sin(sp) * CL * 0.5, z + s.az[i] * CL * 0.5);
        ctx.globalAlpha = 1 - s.ft[i] / 0.2; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.restore();
      // meshes near the fire
      const faces = s.faces; faces.length = 0;
      for (let i = 0; i < n; i++) {
        if (!s.isMesh[i]) continue;
        const pos = [X(i) + s.ax[i] * CL / 2, s.fy[i] + s.jy[i] + s.ay[i] * CL / 2, s.fz[i] + s.jz[i] + s.az[i] * CL / 2];
        for (const f of Mesh.place(s.cyl.faces, s.R[i], pos)) faces.push(f);
      }
      if (faces.length) api.drawFaces(faces);
    },

    stat(s) {
      if (!s.lit || !s.pops) return '';
      const count = Math.round(Math.min(s.L.crackers, s.pops * s.per)).toLocaleString('en-IN');
      const secs = (s.lastPop - s.firstPop).toFixed(1);
      if (s.lay === 'both') return s.meet != null ? `Met ${s.meet.toFixed(1)} m from our end · ${count} pops` : `${count} pops`;
      if (s.lay === 'drum') return `${count} pops in ${secs} s · drum jumped ${Math.round(s.drum.maxY * UNIT_M * 100)} cm`;
      if (s.lay === 'hang') return `${count} pops · climbed ${(s.climb * UNIT_M).toFixed(1)} m up the neem`;
      const m = (s.Lu * UNIT_M).toFixed(1);
      if (s.kind === PAPERS.ola) return `${count} ola pops · ${m} m · ${secs} s`;
      if (s.L.crackers >= 5000) return `${count} pops · ${m} m of gali · ${secs} s`;
      return `${count} pops · ${m} m long`;
    },
  });
  Object.defineProperty(trick, 'spentLine', { get: () => current?.line || LINES['lane-1000'], configurable: true });

  function pop(s, api, i, e) {
    let p;
    if (s.drum) {
      const d = s.drum;
      p = [rnd(-0.8, 0.8) + d.tz * 2, DRUM.h + d.y, rnd(-0.6, 0.6) - d.tx * 2];
    } else {
      p = [s.fx[i] + s.jx[i] + s.ax[i] * CL / 2, s.fy[i] + s.jy[i] + s.ay[i] * CL / 2, s.fz[i] + s.jz[i] + s.az[i] * CL / 2];
    }
    s.st[i] = 1; s.ft[i] = 0; s.ox[i] = s.oy[i] = s.oz[i] = 0;
    s.vx[i] = rnd(-2.5, 2.5); s.vy[i] = rnd(4, 9); s.vz[i] = rnd(-2.5, 2.5);
    s.pops++; s.lastPop = e; if (s.firstPop < 0) s.firstPop = e;
    if (s.vert[i]) s.climb = Math.max(s.climb, s.fy[i]);
    const ola = s.kind === PAPERS.ola, pan = clamp(api.panOf(p) + rnd(-0.25, 0.25), -1, 1);
    // flash + crack
    if (s.drum) {
      api.burst(p, 14, 8, { life: rnd(0.15, 0.35), size: 0.9, gravity: 200, lift: 1.8 });
      api.Sfx.boom({ size: rnd(0.18, 0.26), vol: rnd(0.35, 0.5), muffle: 0.42, pan });
      api.Sfx.strike('tin', { vol: rnd(0.1, 0.2), pan, detune: rnd(0.55, 0.68) });
      if (Math.random() < 0.45) api.smoke(p, 1, { size: 0.9 });
      api.paper(p, 2, 4.5, s.kind.litter);
      api.light([p[0], DRUM.h * 0.6, p[2]], 0.6);
      api.shake(1.6);
      const d = s.drum;
      d.vy = Math.min(d.vy + rnd(1.2, 2.6), 3.8); d.wx += rnd(-1.2, 1.2); d.wz += rnd(-1.2, 1.2);
    } else {
      api.burst(p, ola ? 9 : 12, ola ? 5 : 7, { life: rnd(0.1, 0.28), size: 0.8, gravity: 200 });
      api.Sfx.boom({ size: ola ? rnd(0.14, 0.2) : rnd(0.16, 0.26), vol: rnd(0.3, 0.5), pan });
      if (Math.random() < (s.per > 2 ? 0.25 : 0.15)) api.Sfx.crack({ vol: 0.25, pan, pieces: 2 });
      if (Math.random() < 0.3) api.smoke(p, 1, { size: 0.55 });
      api.paper(p, s.vert[i] ? 3 : 2, s.vert[i] ? 2.5 : 3.5, s.kind.litter);
      api.light(p, 0.45, ola ? [255, 226, 170] : [255, 196, 120]);
      // the chain jerks: the next few crackers jump about
      const dir = s.fronts.find(f => f.i === i)?.dir || 1;
      for (let k = 1; k <= 6; k++) {
        const j = i + dir * k; if (j < 0 || j >= s.n) break;
        const amp = (1 - k / 7) * 0.09;
        s.jx[j] += rnd(-amp, amp); s.jz[j] += rnd(-amp, amp); if (!s.vert[j]) s.jy[j] += rnd(0, amp * 0.8);
      }
    }
    // litter on the ground
    const drops = s.per > 2 ? 2 : 1;
    for (let k = 0; k < drops && s.nl < s.maxLit; k++) {
      const a = rnd(0, TAU), r = s.drum ? rnd(DRUM.r * 1.05, DRUM.r * 2.6) : s.vert[i] ? rnd(0.2, 1.6) : rnd(0.1, 0.9);
      const o = s.nl * 5;
      s.lit_[o] = p[0] + Math.cos(a) * r; s.lit_[o + 1] = p[2] + Math.sin(a) * r; s.lit_[o + 2] = rnd(0, TAU);
      s.lit_[o + 3] = rnd(0.025, 0.05); s.lit_[o + 4] = Math.floor(Math.random() * s.kind.litter.length);
      s.nl++;
    }
  }

  function drawDrum(s, api) {
    const d = s.drum, ctx = api.ctx;
    const R = M3.mul(M3.rotX(d.tx), M3.rotZ(d.tz)), pos = [0, DRUM.h / 2 + d.y, 0];
    api.shadow([0, 0, 0], DRUM.r * 1.15, d.y);
    if (!s.lit) {
      // the ladi's fuse tail hanging over the rim
      const a = api.project([DRUM.r * 0.6, DRUM.h + 0.02, DRUM.r * 0.3]), b = api.project(trick.wick(s));
      ctx.save(); ctx.strokeStyle = '#c9b68c'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(b.x + 6, a.y - 4, b.x, b.y); ctx.stroke(); ctx.restore();
    }
    api.drawFaces(Mesh.place(d.mesh.faces, R, pos));
  }
})();

DiwaliTricks.bind(58, 'ladi', { length: '1000', lay: 'lane', paper: 'red' }, 'lane');
DiwaliTricks.bind(59, 'ladi', { length: '5000', lay: 'lane', paper: 'red' }, 'lane');
DiwaliTricks.bind(62, 'ladi', { length: '1000', lay: 'both', paper: 'red' }, 'lane');
DiwaliTricks.bind(63, 'ladi', { length: '1000', lay: 'drum', paper: 'red' }, 'lane');
DiwaliTricks.bind(64, 'ladi', { length: '1000', lay: 'hang', paper: 'red' }, 'park');
DiwaliTricks.bind(216, 'ladi', { length: '100', lay: 'lane', paper: 'ola' }, 'courtyard');

// physics.js — small rigid-body + paper physics for cracker tricks.
// Shared by the lab and (later) the live site. No DOM, no site globals.
// World units match the site's depth.js: 1 unit ≈ 0.2 m, y is up, ground is y = 0.
(function (root) {
  'use strict';
  const UNIT_M = 0.2;              // metres per world unit
  const G = 9.8 / UNIT_M;          // 49 units/s²

  const v3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]),
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  };

  // 3×3 row-major rotation matrices.
  const M3 = {
    I: () => [1, 0, 0, 0, 1, 0, 0, 0, 1],
    mulV: (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]],
    mul: (a, b) => {
      const r = new Array(9);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
      return r;
    },
    rotY: a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; },
    rotX: a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; },
    rotZ: a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; },
  };

  // R' = R + dt·[w]× R, then Gram–Schmidt so the matrix stays a rotation.
  function integrateRotation(R, w, dt) {
    const S = [0, -w[2], w[1], w[2], 0, -w[0], -w[1], w[0], 0];
    const dR = M3.mul(S, R);
    const n = R.map((v, i) => v + dR[i] * dt);
    let a = [n[0], n[3], n[6]], b = [n[1], n[4], n[7]];
    a = v3.norm(a);
    b = v3.norm(v3.sub(b, v3.scale(a, v3.dot(a, b))));
    const c = v3.cross(a, b);
    return [a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]];
  }

  // A rigid body whose collision hull is a set of local points (rims, corners).
  // Contacts are against the ground plane only — enough for tins, shells, cups, coins.
  class Body {
    constructor(o) {
      this.pos = o.pos.slice();
      this.vel = (o.vel || [0, 0, 0]).slice();
      this.R = o.R ? o.R.slice() : M3.I();
      this.w = (o.w || [0, 0, 0]).slice();
      this.m = o.mass || 1;
      this.I = o.inertia || this.m * 0.05;   // scalar inertia: good enough for toys
      this.e = o.restitution ?? 0.32;
      this.mu = o.friction ?? 0.5;
      this.linDrag = o.linDrag ?? 0.04;
      this.angDrag = o.angDrag ?? 0.25;
      this.contactAngDrag = o.contactAngDrag ?? 1.6;  // rolling/spinning resistance while touching
      this.contactLinDrag = o.contactLinDrag ?? 0;    // extra scrub for small rough pieces
      this.hull = o.hull;
      this.onImpact = o.onImpact || null;
      this.awake = true;
      this.still = 0;
      this.maxY = this.pos[1];
      this.travel = 0;
      this.lastImpact = -1;
      this.age = 0;
    }
    toWorld(p) { return v3.add(M3.mulV(this.R, p), this.pos); }
    dir(p) { return M3.mulV(this.R, p); }
    // CHAOS: everything a bomb kicks flies a bit harder and spins a bit wilder than strictly real
    kick(v, w) { const c = root.Phys.chaos; this.vel = v3.add(this.vel, v3.scale(v, c)); if (w) this.w = v3.add(this.w, v3.scale(w, c * 1.1)); this.awake = true; this.still = 0; }
    lowest() { let m = Infinity; for (const p of this.hull) m = Math.min(m, this.toWorld(p)[1]); return m; }
    step(dt) {
      if (!this.awake) return;
      this.age += dt;
      this.vel[1] -= G * dt;
      this.vel = v3.scale(this.vel, Math.exp(-this.linDrag * dt));
      this.w = v3.scale(this.w, Math.exp(-this.angDrag * dt));
      const before = this.pos;
      this.pos = v3.add(this.pos, v3.scale(this.vel, dt));
      this.travel += Math.hypot(this.pos[0] - before[0], this.pos[2] - before[2]);
      this.R = integrateRotation(this.R, this.w, dt);
      this.maxY = Math.max(this.maxY, this.pos[1]);
      const touching = this.collide();
      if (touching) {
        this.w = v3.scale(this.w, Math.exp(-this.contactAngDrag * dt));
        if (this.contactLinDrag) { const k = Math.exp(-this.contactLinDrag * dt); this.vel[0] *= k; this.vel[2] *= k; }
      }
      const energy = v3.dot(this.vel, this.vel) + v3.dot(this.w, this.w) * 0.04;
      if (touching && energy < 0.5) {
        this.still += dt;
        if (this.still > 0.35) { this.awake = false; this.vel = [0, 0, 0]; this.w = [0, 0, 0]; }
      } else this.still = 0;
    }
    collide() {
      const contacts = [];
      for (const p of this.hull) { const q = this.toWorld(p); if (q[1] < 0) contacts.push(q); }
      if (!contacts.length) return false;
      let deep = 0;
      for (const q of contacts) deep = Math.min(deep, q[1]);
      this.pos[1] -= deep;
      const c = [0, 0, 0];
      for (const q of contacts) { c[0] += q[0]; c[2] += q[2]; }
      c[0] /= contacts.length; c[2] /= contacts.length;
      const r = v3.sub(c, this.pos);
      const vc = v3.add(this.vel, v3.cross(this.w, r));
      const vn = vc[1];
      if (vn >= 0) return true;
      const n = [0, 1, 0];
      const rxn = v3.cross(r, n);
      const k = 1 / this.m + v3.dot(rxn, rxn) / this.I;
      const e = -vn < 2 ? 0 : this.e;             // no jitter-bouncing when nearly at rest
      const j = -(1 + e) * vn / k;
      this.vel[1] += j / this.m;
      this.w = v3.add(this.w, v3.scale(rxn, j / this.I));
      const vtl = Math.hypot(vc[0], vc[2]);
      if (vtl > 1e-4) {
        const t = [vc[0] / vtl, 0, vc[2] / vtl];
        const rxt = v3.cross(r, t);
        const kt = 1 / this.m + v3.dot(rxt, rxt) / this.I;
        const jt = Math.min(this.mu * j, vtl / kt);
        this.vel = v3.sub(this.vel, v3.scale(t, jt / this.m));
        this.w = v3.sub(this.w, v3.scale(rxt, jt / this.I));
      }
      if (this.onImpact && -vn > 1.5 && this.age - this.lastImpact > 0.06) {
        this.lastImpact = this.age;
        this.onImpact(-vn, c);
      }
      return true;
    }
  }

  // Paper scraps: heavy drag, flutter and flip, then lie flat and stay.
  class Paper {
    constructor(pos, vel, o = {}) {
      this.pos = pos.slice();
      this.vel = vel.slice();
      this.size = o.size || 0.06;
      this.color = o.color || [176, 48, 38];
      this.phase = Math.random() * 6.28;
      this.spin = 6 + Math.random() * 14;
      this.yaw = Math.random() * 6.28;
      this.rest = false;
      this.drag = o.drag ?? 4.5;
    }
    step(dt) {
      if (this.rest) return;
      this.phase += this.spin * dt;
      this.vel[1] -= G * dt;
      const d = Math.exp(-this.drag * dt);
      this.vel = v3.scale(this.vel, d);
      // a falling sheet side-slips as it tilts
      this.vel[0] += Math.sin(this.phase) * 9 * dt;
      this.vel[2] += Math.cos(this.phase * 0.7) * 9 * dt;
      this.pos = v3.add(this.pos, v3.scale(this.vel, dt));
      if (this.pos[1] <= 0.004) { this.pos[1] = 0.004; this.rest = true; this.phase = 0; }
    }
  }

  // Split a list of faces into shards by nearest seed (Voronoi on face centroids).
  // Each face: {pts:[[x,y,z],...], n:[x,y,z], rgb, back}. Returns [{faces (local to centroid), centroid, count}].
  function shatter(faces, seedCount, rng = Math.random) {
    const centroid = f => { const c = [0, 0, 0]; for (const p of f.pts) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; } return v3.scale(c, 1 / f.pts.length); };
    const cents = faces.map(centroid);
    const seeds = [];
    for (let i = 0; i < seedCount; i++) seeds.push(cents[Math.floor(rng() * cents.length)]);
    const groups = seeds.map(() => []);
    faces.forEach((f, i) => {
      let best = 0, bd = Infinity;
      seeds.forEach((s, j) => { const d = v3.len(v3.sub(s, cents[i])); if (d < bd) { bd = d; best = j; } });
      groups[best].push(f);
    });
    return groups.filter(g => g.length).map(g => {
      const c = v3.scale(g.map(centroid).reduce((a, b) => v3.add(a, b), [0, 0, 0]), 1 / g.length);
      const local = g.map(f => ({ ...f, pts: f.pts.map(p => v3.sub(p, c)) }));
      const hull = [];
      for (const f of local) for (const p of f.pts) hull.push(p);
      return { faces: local, centroid: c, hull, count: g.length };
    });
  }

  root.Phys = { UNIT_M, G, v3, M3, Body, Paper, shatter, integrateRotation, chaos: 1.3 };
})(typeof window !== 'undefined' ? window : globalThis);

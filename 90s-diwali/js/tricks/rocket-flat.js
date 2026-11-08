// Compendium #2, #12 — the rocket laid flat on the road: a screaming ground missile.
// Thrust along the body, sliding friction, a stick that drags like a trailer (the zig-zag),
// small hops, a pop at the end, and a scorch line left on the road.
(function () {
  'use strict';
  const { G, M3 } = Phys;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  DiwaliTricks.register({
    id: 'rocket-flat',
    name: 'Rocket flat on the road',
    compendium: [2, 12],
    mode: 'ground',
    views: ['lane', 'courtyard'],
    fuse: 1.1,
    options: [{ key: 'stick', label: 'Stick', choices: [['on', 'With stick'], ['off', 'Stick snapped off']], default: 'on' }],
    spentLine: 'Everybody scattered',

    create(api, opts) {
      // Point it down the lane (toward the view's vanishing point), with a careless kid's aim.
      const heading = api.aim([0, 0, 0]) + rnd(-0.3, 0.3);
      const body = Mesh.lathe([[-0.26, 0.055], [0.22, 0.055], [0.24, 0.05], [0.4, 0.004]], {
        segs: 12, colourAt: (i, s) => i === 0 ? (s % 4 < 2 ? [196, 40, 36] : [232, 190, 64]) : [206, 46, 40],
      });
      return {
        opts, body, pos: [0, 0.06, 0], vy: 0, heading, omega: 0, stickDir: heading, vel: [0, 0],
        roll: 0, popped: false, done: false, path: [[0, 0]], pathT: 0, dist: 0, hasStick: opts.stick !== 'off', thrust: 2.3,
      };
    },

    wick(s) { const d = [Math.cos(s.heading), 0, Math.sin(s.heading)]; return [-d[0] * 0.3, 0.07, -d[2] * 0.3]; },

    ignite(s, api) {
      s.skid = api.Sfx.skid({ pan: api.panOf(s.pos) });
      api.Sfx.whoosh({ vol: 0.12, pan: api.panOf(s.pos), dur: 0.35 });
      // the scorch line it leaves behind stays on the road
      const path = s.path;
      api.remain((ctx, a) => {
        if (path.length < 2) return;
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(16,11,8,.32)';
        ctx.beginPath(); path.forEach(([x, z], i) => { const p = a.project([x, 0.002, z]); ctx.lineWidth = Math.max(1, a.cam.scale * 0.05 * p.f); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
        ctx.stroke(); ctx.restore();
      });
    },

    update(s, api, dt, e) {
      const thrusting = e < s.thrust, dir = [Math.cos(s.heading), Math.sin(s.heading)];
      // Steering: random wander, sudden snags, and the stick dragging the tail around.
      s.omega += rnd(-1, 1) * 30 * dt;
      if (thrusting && Math.random() < dt * (s.hasStick ? 1.6 : 3.2)) s.omega += rnd(-1, 1) * (s.hasStick ? 7 : 13);
      if (s.hasStick) { s.omega += wrap(s.stickDir - s.heading) * 2.5 * dt * 10; s.stickDir += wrap(s.heading - s.stickDir) * Math.min(1, dt * 2.6); }
      s.omega *= Math.exp(-dt * (s.hasStick ? 2.2 : 0.9));
      s.heading += s.omega * dt;
      // Forces on the ground plane.
      const thrust = thrusting ? 52 * Math.min(1, e / 0.15) : 0;
      const grounded = s.pos[1] <= 0.061;
      s.vel[0] += dir[0] * thrust * dt; s.vel[1] += dir[1] * thrust * dt;
      const sp = Math.hypot(s.vel[0], s.vel[1]);
      if (sp > 0.01) {
        // grip turns the velocity toward where the nose points (slides when it can't)
        const grip = Math.min(1, dt * (grounded ? 5 : 1));
        s.vel[0] += (dir[0] * sp - s.vel[0]) * grip; s.vel[1] += (dir[1] * sp - s.vel[1]) * grip;
        const fr = (grounded ? 0.5 * G : 0) + sp * 0.45;
        const k = Math.max(0, sp - fr * dt) / sp; s.vel[0] *= k; s.vel[1] *= k;
      }
      // hops when it catches a pebble
      if (grounded && thrusting && Math.random() < dt * 1.4) s.vy = rnd(3, 8);
      s.vy -= G * dt; s.pos[1] = Math.max(0.06, s.pos[1] + s.vy * dt); if (s.pos[1] <= 0.06 && s.vy < 0) s.vy = 0;
      s.pos[0] += s.vel[0] * dt; s.pos[2] += s.vel[1] * dt; s.dist += Math.hypot(s.vel[0], s.vel[1]) * dt * Phys.UNIT_M;
      s.roll += sp * dt * 3;
      // exhaust, glow, smoke, sound
      const tail = [s.pos[0] - dir[0] * 0.28, s.pos[1], s.pos[2] - dir[1] * 0.28];
      if (thrusting) {
        const n = api.reduced ? 2 : Math.round(rnd(9, 14));
        for (let i = 0; i < n; i++) api.spark(tail, [-dir[0] * rnd(6, 16) + rnd(-2.5, 2.5), rnd(0, 4), -dir[1] * rnd(6, 16) + rnd(-2.5, 2.5)], { life: rnd(0.15, 0.55), size: rnd(0.8, 1.6), gravity: 160 });
        api.light(tail, 0.45);
        if (Math.random() < dt * 14) api.smoke(tail, 1, { size: 0.7 });
      }
      s.skid?.set(thrusting ? 0.55 + Math.min(0.4, sp / 60) : Math.min(0.3, sp / 40), Math.min(1, sp / 30), api.panOf(s.pos));
      // the pop at the end of the burn
      if (!s.popped && e > s.thrust + 0.15) {
        s.popped = true; s.skid?.stop(); s.skid = null;
        api.burst(s.pos, 90, 7, { color: 'rose', flat: true, life: 0.9 });
        api.light(s.pos, 0.9, [255, 140, 180]);
        api.Sfx.boom({ vol: 0.55, size: 0.4, pan: api.panOf(s.pos) });
        api.smoke(s.pos, 6);
      }
      s.pathT += dt;
      if (s.pathT > 0.03) { s.pathT = 0; s.path.push([s.pos[0], s.pos[2]]); }
      const far = Math.hypot(s.pos[0], s.pos[2]) > 60;
      return (s.popped && sp < 0.3 && e > s.thrust + 0.6) || far || e > 9;
    },

    stop(s) { s.skid?.stop(); },

    draw(s, api) {
      const R = M3.mul(M3.rotY(-s.heading), M3.rotX(s.roll));
      api.shadow(s.pos, 0.2, s.pos[1]);
      if (s.hasStick) {
        const tail = [s.pos[0] - Math.cos(s.heading) * 0.2, s.pos[1] - 0.03, s.pos[2] - Math.sin(s.heading) * 0.2];
        const end = [tail[0] - Math.cos(s.stickDir) * 2.4, 0.01, tail[2] - Math.sin(s.stickDir) * 2.4];
        const a = api.project(tail), b = api.project(end), c = api.ctx;
        c.save(); c.lineCap = 'round'; c.strokeStyle = '#9c7a4a'; c.lineWidth = Math.max(1.2, api.cam.scale * 0.022 * a.f);
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.restore();
      }
      api.drawFaces(Mesh.place(s.body.faces, R, s.pos));
    },

    stat(s) { return s.dist > 0.05 ? `Skidded ${s.dist.toFixed(1)} m` : ''; },
  });
})();

DiwaliTricks.bind(2, 'rocket-flat', { stick: 'on' }, 'lane');
DiwaliTricks.bind(12, 'rocket-flat', { stick: 'off' }, 'lane');

// Compendium #21, #22, #26 — bomb under the ghee tin / Mummy's steel tumbler.
// Real impulse, tumble, bounce and roll; the rim dents in the blast; height is measured.
(function () {
  'use strict';
  const { Body, v3 } = Phys;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // Launch speed ranges in world units/s (1 unit = 0.2 m). Atom bomb ≈ 7–9 m/s ≈ 3–4 m peak.
  const BOMBS = {
    bijli:   { v: [11, 16], size: 0.35 },
    lakshmi: { v: [22, 29], size: 0.7 },
    atom:    { v: [33, 42], size: 1.0 },
    sutli:   { v: [45, 56], size: 1.5 },
  };
  const THINGS = {
    // Fictional vanaspati tin (no real brand): yellow body, green bands, red label window.
    tin: { r: 0.37, h: 0.88, mass: 0.3, e: 0.38, material: 'tin', bands: 4,
      colourAt: (s, b, segs, bands) => (b === 0 || b === bands - 1) ? [46, 112, 60] : (b >= 1 && b <= 2 && s / segs > 0.55 && s / segs < 0.8) ? [178, 40, 34] : [222, 184, 58],
      top: [186, 186, 178], inner: [168, 166, 158] },
    tumbler: { r: 0.21, h: 0.5, mass: 0.22, e: 0.48, material: 'steel', bands: 3,
      colourAt: (s, b) => { const k = 0.82 + 0.3 * Math.max(0, Math.cos(s / 20 * 6.28 * 2)); return [200 * k, 204 * k, 212 * k]; },
      top: [214, 218, 224], inner: [130, 134, 142] },
  };
  function heightLabel(m) {
    if (m < 0.6) return 'knee high';
    if (m < 1.8) return 'over our heads';
    if (m < 3.4) return 'first-floor balcony';
    if (m < 6.4) return 'second floor';
    return 'over the roof!';
  }

  DiwaliTricks.register({
    id: 'tin-launch',
    name: 'Bomb under the tin',
    compendium: [21, 22, 26],
    mode: 'ground',
    views: ['lane', 'courtyard', 'doorstep'],
    fuse: 1.3,
    options: [
      { key: 'thing', label: 'Under', choices: [['tin', 'Ghee tin'], ['tumbler', 'Steel tumbler']], default: 'tin' },
      { key: 'bomb', label: 'Bomb', choices: [['bijli', 'Bijli'], ['lakshmi', 'Lakshmi'], ['atom', 'Atom bomb'], ['sutli', 'Sutli']], default: 'atom' },
    ],
    spentLine: s => s.opts.thing === 'tumbler' ? 'Mummy ka tumbler kabhi seedha nahi hua.' : s.peak > 3.4 ? 'Doosri manzil tak! Kiska dabba tha ye?' : 'Kiska dabba tha ye?',

    create(api, opts) {
      const T = THINGS[opts.thing] || THINGS.tin;
      // Upside down over the bomb: closed end up, open end on the ground.
      const mesh = Mesh.cylinder(T.r, T.h, { segs: 20, bands: T.bands, colourAt: T.colourAt, top: T.top, bottom: false, inner: T.inner });
      const s = { T, opts, mesh, bomb: BOMBS[opts.bomb] || BOMBS.atom, fired: false, peak: 0 };
      s.body = new Body({
        pos: [0, T.h / 2, 0], mass: T.mass, inertia: T.mass * (3 * T.r * T.r + T.h * T.h) / 12,
        restitution: T.e, friction: 0.45, linDrag: 0.05, angDrag: 0.12, hull: mesh.hull,
        onImpact: (speed, at) => {
          api.Sfx.strike(T.material, { vol: api.clamp(speed / 32, 0.04, 0.9), pan: api.panOf(at), detune: rnd(0.97, 1.03) });
          if (speed > 9) api.smoke(at, 2, { size: 0.6 });
        },
      });
      return s;
    },

    wick(s) { return [s.T.r + 0.16, 0.03, 0.1]; },

    ignite(s, api) {
      const b = s.bomb, T = s.T, pan = api.panOf([0, 0, 0]);
      s.fired = true;
      const up = rnd(b.v[0], b.v[1]) * (T.mass === 0.22 ? 1.12 : 1);
      s.body.kick([rnd(-2.5, 2.5) * b.size, up, rnd(-2.5, 2.5) * b.size], [rnd(-10, 10) * b.size, rnd(-4, 4), rnd(-10, 10) * b.size]);
      // The blast dents the rim it was sitting on.
      const rim = s.mesh.rings[0], at = Math.floor(Math.random() * rim.length);
      for (let i = -3; i <= 3; i++) { const p = rim[(at + i + rim.length) % rim.length], k = (1 - Math.abs(i) / 4) * 0.22 * Math.min(1.2, b.size); p[0] *= 1 - k; p[2] *= 1 - k; p[1] += k * 0.12; }
      api.burst([0, 0.04, 0], 160 * b.size, 10 * b.size, { flat: true });
      api.paper([0, 0.05, 0], Math.round(26 * b.size), 4.5 * b.size);
      api.smoke([0, 0.1, 0], Math.round(16 * b.size));
      api.light([0, 0.2, 0], 0.7 + b.size * 0.5);
      api.shake(4 + 5 * b.size);
      api.Sfx.boom({ vol: 0.85, size: b.size, muffle: 0.28, pan });
      api.Sfx.strike(T.material, { vol: 0.9, pan });
      if (up > 30) setTimeout(() => api.Sfx.whoosh({ vol: 0.12, pan }), 40);
      api.remain((ctx, a) => {
        const c = a.project([0, 0.002, 0]), r = a.cam.scale * 0.45 * c.f;
        ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, 0.45);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(18,12,9,.55)'); g.addColorStop(1, 'rgba(18,12,9,0)');
        ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
      });
    },

    update(s, api, dt, e) {
      for (let i = 0; i < 4; i++) s.body.step(dt / 4);
      s.peak = Math.max(s.peak, (s.body.maxY - s.T.h / 2) * Phys.UNIT_M);
      return (!s.body.awake && e > 1) || e > 14;
    },

    draw(s, api) {
      const b = s.body, T = s.T;
      api.shadow(b.pos, T.r * 1.1, b.pos[1] - T.h / 2);
      if (!s.fired) {
        const a = api.project([T.r * 0.8, 0.02, 0.05]), w = api.project(this.wick(s));
        api.ctx.strokeStyle = '#b9a988'; api.ctx.lineWidth = 1.6; api.ctx.beginPath(); api.ctx.moveTo(a.x, a.y); api.ctx.lineTo(w.x, w.y); api.ctx.stroke();
      }
      api.drawFaces(Mesh.place(s.mesh.faces, b.R, b.pos));
      // Off the top of the screen: show where it went.
      const top = api.project(b.pos);
      if (top.y < 8) {
        const c = api.ctx; c.save(); c.fillStyle = 'rgba(255,240,210,.9)'; c.font = '600 13px system-ui';
        c.textAlign = 'center'; c.fillText(`↑ ${((b.pos[1] - T.h / 2) * Phys.UNIT_M).toFixed(1)} m`, Math.max(40, Math.min(api.W - 40, top.x)), 22); c.restore();
      }
    },

    stat(s) { return s.fired ? `Peak ${s.peak.toFixed(1)} m · ${heightLabel(s.peak)}` : ''; },
  });
})();

// Memories this trick plays (compendium numbers).
DiwaliTricks.bind(21, 'tin-launch', { thing: 'tin', bomb: 'atom' }, 'lane');
DiwaliTricks.bind(22, 'tin-launch', { thing: 'tumbler', bomb: 'atom' }, 'doorstep');

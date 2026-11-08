// Compendium #19 — the kobbari chippa: bomb under half a coconut shell, only the wick peeking out.
// The joy is the splinter: the dome is pre-fractured (Voronoi on its faces) into rigid shards.
(function () {
  'use strict';
  const { Body, v3, shatter } = Phys;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const hash = (i, j) => { const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); };
  const BOMBS = { lakshmi: { size: 0.75, seeds: 6 }, atom: { size: 1.0, seeds: 9 }, hydrogen: { size: 1.35, seeds: 13 } };

  DiwaliTricks.register({
    id: 'coconut-shell',
    name: 'Bomb under the coconut shell',
    compendium: [19, 213],
    mode: 'ground',
    views: ['courtyard', 'lane', 'doorstep'],
    fuse: 1.4,
    options: [{ key: 'bomb', label: 'Bomb', choices: [['lakshmi', 'Lakshmi'], ['atom', 'Atom bomb'], ['hydrogen', 'Hydrogen bomb']], default: 'atom' }],
    spentLine: 'Kobbari chippa, in pieces',

    create(api, opts) {
      // Dried half shell: dark fibrous outside, slightly paler inside, a little flattened.
      const dome = Mesh.dome(0.33, {
        lat: 6, lon: 22, squash: 0.82,
        colourAt: (i, j) => { const k = 0.7 + 0.55 * hash(i, j); return [128 * k, 76 * k, 38 * k]; },
        inner: [226, 204, 160], // dried copra lining: the pale side is what you spot on the floor
      });
      return { dome, bomb: BOMBS[opts.bomb] || BOMBS.atom, shards: null, far: 0 };
    },

    wick() { return [0.44, 0.03, -0.06]; },

    ignite(s, api) {
      const b = s.bomb, pan = api.panOf([0, 0, 0]);
      s.shards = shatter(s.dome.faces, b.seeds).map(sh => {
        const out = v3.norm(v3.sub(sh.centroid, [0, -0.05, 0]));
        // Bigger chunks are slower; slivers fly. Most land within a metre or two.
        const speed = rnd(5, 13) * b.size * Math.min(1.6, 9 / (sh.count + 3)), mass = 0.01 * sh.count;
        const hull = sh.hull.filter((_, i) => i % 3 === 0);
        const body = new Body({
          pos: sh.centroid, mass, inertia: mass * 0.025, restitution: 0.28, friction: 0.7, angDrag: 0.3, contactAngDrag: 9, contactLinDrag: 2.2, hull,
          onImpact: (sp, at) => { if (sp > 4) api.Sfx.strike('shell', { vol: Math.min(0.35, sp / 60), pan: api.panOf(at) }); },
        });
        body.kick([out[0] * speed, Math.max(0.3, out[1]) * speed + rnd(4, 11) * b.size, out[2] * speed], [rnd(-22, 22), rnd(-22, 22), rnd(-22, 22)]);
        return { faces: sh.faces, body };
      });
      api.Sfx.crack({ vol: 0.7, pan, pieces: 5 });
      api.Sfx.boom({ vol: 0.85, size: b.size, muffle: 0.18, pan });
      api.burst([0, 0.05, 0], 150 * b.size, 11 * b.size, { flat: true });
      api.paper([0, 0.06, 0], Math.round(30 * b.size), 4 * b.size, [[120, 82, 48], [150, 110, 70], [176, 48, 38]]); // coir fibres + cracker paper
      api.smoke([0, 0.1, 0], Math.round(14 * b.size));
      api.light([0, 0.15, 0], 0.8 + b.size * 0.4);
      api.shake(5 + 4 * b.size);
      api.remain((ctx, a) => {
        const c = a.project([0, 0.002, 0]), r = a.cam.scale * 0.38 * c.f;
        ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, 0.45);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(18,12,9,.6)'); g.addColorStop(1, 'rgba(18,12,9,0)');
        ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
      });
    },

    update(s, api, dt, e) {
      let awake = false;
      for (const sh of s.shards) {
        for (let i = 0; i < 3; i++) sh.body.step(dt / 3);
        awake ||= sh.body.awake;
        s.far = Math.max(s.far, Math.hypot(sh.body.pos[0], sh.body.pos[2]) * Phys.UNIT_M);
      }
      return (!awake && e > 1) || e > 10;
    },

    draw(s, api) {
      if (!s.shards) {
        api.shadow([0, 0, 0], 0.4, 0);
        const w = api.project(this.wick()), a = api.project([0.3, 0.015, -0.04]);
        api.ctx.strokeStyle = '#b9a988'; api.ctx.lineWidth = 1.5; api.ctx.beginPath(); api.ctx.moveTo(a.x, a.y); api.ctx.lineTo(w.x, w.y); api.ctx.stroke();
        api.drawFaces(Mesh.place(s.dome.faces, Phys.M3.I(), [0, 0, 0]));
        return;
      }
      const all = [];
      for (const sh of s.shards) {
        api.shadow(sh.body.pos, 0.09, sh.body.pos[1]);
        for (const f of Mesh.place(sh.faces, sh.body.R, sh.body.pos)) all.push(f);
      }
      api.drawFaces(all);
    },

    stat(s) { return s.shards ? `${s.shards.length} pieces · farthest ${s.far.toFixed(1)} m` : ''; },
  });
})();

DiwaliTricks.bind([19, 213], 'coconut-shell', { bomb: 'atom' }, 'courtyard');

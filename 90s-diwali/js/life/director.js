// director.js — the painted diyas burn: a fixed wick, a swaying teardrop flame, a warm pool.
// (No voices, no background events: the street stays quiet until you light something.)
(function () {
  'use strict';
  const DIYAS = {
    lane: [[.04, .73], [.1, .71], [.19, .69], [.27, .59], [.31, .57], [.36, .555]],
    courtyard: [[.02, .57], [.15, .51], [.34, .48], [.47, .48]],
    doorstep: [[.28, .33], [.47, .32], [.69, .36]],
    roof: [[.96, .66], [.93, .70]],
    room: [[.33, .7]],
    park: [[.69, .4], [.85, .4]],
  };
  let t = 0;
  function frame(ctx, dt, view) {
    t += dt;
    const list = DIYAS[view.place]; if (!list) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    list.forEach(([u, v], i) => {
      const p = view.toScreen(u, v), r = Math.min(60, 14 * p.s * 1.6), a = 0.09 + 0.04 * Math.sin(t * 7.3 + i * 1.7) + 0.03 * Math.sin(t * 13.1 + i);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); g.addColorStop(0, `rgba(255,170,70,${a})`); g.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = g; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    });
    ctx.restore();
    list.forEach(([u, v], i) => {
      const p = view.toScreen(u, v), h = Math.max(3, Math.min(22, 9 * p.s * 1.4)), w = h * 0.3;
      const sway = Math.sin(t * 2.1 + i) * 0.18 + Math.sin(t * 9.7 + i * 2) * 0.06, stretch = 1 + Math.sin(t * 11 + i * 3) * 0.08;
      const tipX = p.x + sway * h, tipY = p.y - h * stretch;
      const body = ctx.createLinearGradient(p.x, p.y, p.x, tipY);
      body.addColorStop(0, 'rgba(90,120,255,.55)'); body.addColorStop(.18, 'rgba(255,245,210,.95)'); body.addColorStop(.55, 'rgba(255,190,70,.9)'); body.addColorStop(1, 'rgba(255,110,30,0)');
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.moveTo(p.x - w, p.y);
      ctx.quadraticCurveTo(p.x - w * 1.1, p.y - h * .45, tipX, tipY);
      ctx.quadraticCurveTo(p.x + w * 1.1, p.y - h * .45, p.x + w, p.y);
      ctx.quadraticCurveTo(p.x, p.y + w * .6, p.x - w, p.y); ctx.fill();
      Stage.glow?.(p.x, p.y - h * .45, h * 1.8, '#ff9a30', 0.22 + 0.08 * Math.sin(t * 7 + i));
    });
  }
  window.Life = { init() { Stage.on('frame', frame); } };
})();

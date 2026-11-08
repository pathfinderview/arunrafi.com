// mesh.js — tiny projected-mesh builders and a painter's-algorithm renderer.
// Faces are {pts:[[x,y,z]...], n:[x,y,z], rgb:[r,g,b], back?:[r,g,b]} in local space.
// Builders keep shared vertex arrays so tricks can deform them (e.g. a dented tin).
(function (root) {
  'use strict';
  const { v3, M3 } = root.Phys;
  const LIGHT = v3.norm([-0.45, 0.85, -0.35]); // warm key light from upper-left, like the plates

  // Cylinder on the y axis, centred at the origin. colourAt(segment, band, segs, bands) → rgb.
  function cylinder(r, h, o = {}) {
    const segs = o.segs || 18, bands = o.bands || 4;
    const rings = [];
    for (let b = 0; b <= bands; b++) {
      const y = -h / 2 + h * b / bands, ring = [];
      for (let s = 0; s < segs; s++) { const a = s / segs * Math.PI * 2; ring.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
      rings.push(ring);
    }
    const faces = [];
    for (let b = 0; b < bands; b++) for (let s = 0; s < segs; s++) {
      const s2 = (s + 1) % segs, a = (s + 0.5) / segs * Math.PI * 2;
      faces.push({ pts: [rings[b][s], rings[b][s2], rings[b + 1][s2], rings[b + 1][s]], n: [Math.cos(a), 0, Math.sin(a)], rgb: o.colourAt ? o.colourAt(s, b, segs, bands) : (o.rgb || [180, 180, 180]), back: o.inner });
    }
    if (o.top !== false) faces.push({ pts: rings[bands].slice().reverse(), n: [0, 1, 0], rgb: o.top || o.rgb || [200, 200, 200] });
    if (o.bottom !== false) faces.push({ pts: rings[0].slice(), n: [0, -1, 0], rgb: o.bottom || o.rgb || [120, 120, 120] });
    const hull = [...rings[0], ...rings[bands]];
    return { faces, rings, hull };
  }

  // Hemispherical dome opening downwards, base on y = 0 (a half coconut shell, a bowl, a cup).
  function dome(r, o = {}) {
    const lat = o.lat || 6, lon = o.lon || 20, faces = [], grid = [];
    for (let i = 0; i <= lat; i++) {
      const phi = (i / lat) * Math.PI / 2, row = [];
      for (let j = 0; j < lon; j++) { const th = j / lon * Math.PI * 2; row.push([Math.cos(th) * Math.cos(phi) * r, Math.sin(phi) * r * (o.squash || 1), Math.sin(th) * Math.cos(phi) * r]); }
      grid.push(row);
    }
    for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) {
      const j2 = (j + 1) % lon, phi = (i + 0.5) / lat * Math.PI / 2, th = (j + 0.5) / lon * Math.PI * 2;
      const n = [Math.cos(th) * Math.cos(phi), Math.sin(phi), Math.sin(th) * Math.cos(phi)];
      const rgb = o.colourAt ? o.colourAt(i, j, lat, lon) : (o.rgb || [110, 70, 40]);
      faces.push({ pts: [grid[i][j], grid[i][j2], grid[i + 1][j2], grid[i + 1][j]], n, rgb, back: o.inner || rgb.map(c => c * 0.55) });
    }
    return { faces, grid, hull: [...grid[0], grid[lat][0]] };
  }

  // Cone along +x (rocket nose) or any small solid: generic lathe helper.
  function lathe(profile, o = {}) {
    // profile: [[x, radius], ...] along the x axis.
    const segs = o.segs || 12, faces = [];
    const rings = profile.map(([x, r]) => { const ring = []; for (let s = 0; s < segs; s++) { const a = s / segs * Math.PI * 2; ring.push([x, Math.cos(a) * r, Math.sin(a) * r]); } return ring; });
    for (let i = 0; i < rings.length - 1; i++) for (let s = 0; s < segs; s++) {
      const s2 = (s + 1) % segs, a = (s + 0.5) / segs * Math.PI * 2;
      faces.push({ pts: [rings[i][s], rings[i][s2], rings[i + 1][s2], rings[i + 1][s]], n: [0, Math.cos(a), Math.sin(a)], rgb: o.colourAt ? o.colourAt(i, s) : (o.rgb || [190, 50, 40]) });
    }
    return { faces, rings, hull: rings.flat() };
  }

  // Transform local faces into world space with a body (R, pos) or a plain matrix + offset.
  function place(faces, R, pos) {
    return faces.map(f => ({ ...f, pts: f.pts.map(p => v3.add(M3.mulV(R, p), pos)), n: M3.mulV(R, f.n) }));
  }

  // Direction from the ground toward the camera, derived from the site's project3 camera.
  function toCamera(cam) {
    if (cam.eye) return cam.eye;                   // calibrated pinhole camera supplies its own
    const a = cam.yaw, p = cam.pitch;
    return [-Math.sin(a) * Math.cos(p), Math.sin(p), Math.cos(a) * Math.cos(p)];
  }

  // Painter's algorithm. project(p) → {x,y,d}. glow: {power, rgb, at:[x,y,z]} — firework light on nearby faces.
  function draw(ctx, worldFaces, project, cam, glow) {
    const eye = toCamera(cam);
    const list = [];
    for (const f of worldFaces) {
      const q = f.pts.map(project);
      let d = 0; for (const p of q) d += p.d; d /= q.length;
      const facing = v3.dot(f.n, eye) > 0;
      if (!facing && !f.back) continue;           // closed meshes: cull, open shells: show inside
      const n = facing ? f.n : v3.scale(f.n, -1);
      let l = 0.42 + 0.62 * Math.max(0, v3.dot(n, LIGHT));
      let rgb = facing ? f.rgb : f.back;
      if (glow && glow.power > 0.01) {
        const c = f.pts[0], dist = v3.len(v3.sub(c, glow.at));
        const k = glow.power * Math.max(0, 1 - dist / 3) * (0.5 + 0.5 * Math.max(0, -v3.dot(n, v3.norm(v3.sub(c, glow.at)))));
        rgb = rgb.map((v, i) => v + (glow.rgb[i] - v) * Math.min(0.85, k));
        l += k * 0.6;
      }
      list.push({ q, d, colour: `rgb(${rgb.map(v => Math.max(0, Math.min(255, Math.round(v * l)))).join(',')})` });
    }
    list.sort((a, b) => b.d - a.d);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.6;
    for (const f of list) {
      ctx.fillStyle = f.colour; ctx.strokeStyle = f.colour;
      ctx.beginPath();
      f.q.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  // Soft contact shadow under an object; fades and widens as it rises.
  function shadow(ctx, project, at, radius, height = 0) {
    const fade = Math.max(0, 1 - height / 6);
    if (fade <= 0) return;
    const c = project([at[0], 0.002, at[2]]), e = project([at[0] + radius * (1 + height * 0.15), 0.002, at[2]]), f = project([at[0], 0.002, at[2] + radius * (1 + height * 0.15)]);
    const rx = Math.max(2, Math.hypot(e.x - c.x, e.y - c.y)), ry = Math.max(1, Math.hypot(f.x - c.x, f.y - c.y));
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(10,6,4,${0.55 * fade})`);
    g.addColorStop(1, 'rgba(10,6,4,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }

  root.Mesh = { cylinder, dome, lathe, place, draw, shadow, toCamera, LIGHT };
})(typeof window !== 'undefined' ? window : globalThis);

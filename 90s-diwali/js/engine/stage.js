// stage.js — one full-screen canvas: a painted place, a camera solved from that painting,
// and the shared effects every trick uses (sparks, smoke, light, paper, remains).
//
// Camera model: each plate is treated as a photo from a standing adult (eye 1.55 m, 60° lens).
// Its pitch comes from the painting (vanishing line or a known tilt). Moments "push in" by
// cropping the plate around the stage — a longer lens from the same spot — so objects grow
// without breaking perspective.
(function () {
  'use strict';
  const { v3, Paper, UNIT_M } = Phys;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EYE = 1.55 / UNIT_M, HFOV = 60 * Math.PI / 180;

  // Places. vp = horizon height as a fraction of the plate; pitchDeg overrides for steep plates.
  // stage = plate point (fractions) where a cracker sits; zoom = push-in for moments; focus = crop centre.
  const PLACES = {
    lane:      { name: 'Gali',         plate: 'memory-lane',      vp: 0.45, stage: [0.5, 0.86], zoom: 2.0, focus: [0.5, 0.80], space: 'lane' },
    doorstep:  { name: 'Darwaza',      plate: 'memory-doorstep',  pitchDeg: 50, stage: [0.5, 0.66], zoom: 1.3, focus: [0.5, 0.62], space: 'doorstep' },
    courtyard: { name: 'Aangan',       plate: 'memory-courtyard', pitchDeg: 36, stage: [0.5, 0.70], zoom: 1.35, focus: [0.5, 0.62], space: 'courtyard' },
    roof:      { name: 'Chhat',        plate: 'memory-roof',      vp: 0.50, stage: [0.5, 0.80], zoom: 1.35, focus: [0.52, 0.63], space: 'roof' },   // close enough to see the bottle go over
    terrace:   { name: 'Chhat ka farsh', plate: 'terrace-floor',  pitchDeg: 55, stage: [0.5, 0.62], zoom: 1.0, focus: [0.5, 0.58], space: 'roof' },
    room:      { name: 'Ghar',         plate: 'walk-room',        vp: 0.44, stage: [0.5, 0.86], zoom: 1.3, focus: [0.5, 0.65], space: 'room' },
    stairs:    { name: 'Seedhiyan',    plate: 'walk-stairs',      vp: 0.42, stage: [0.5, 0.86], zoom: 1.2, focus: [0.5, 0.62], space: 'stairs' },
    landing:   { name: 'Upar',         plate: 'walk-landing',     vp: 0.45, stage: [0.5, 0.86], zoom: 1.2, focus: [0.5, 0.62], space: 'stairs' },
    park:      { name: 'Park',         plate: 'walk-park',        vp: 0.50, stage: [0.5, 0.84], zoom: 1.5, focus: [0.5, 0.66], space: 'park' },
  };
  // Places named in the content map that don't have their own painting yet.
  const ALIAS = { bazaar: 'lane', 'south-street': 'lane', 'kerala-yard': 'courtyard', 'bengal-para': 'lane', 'goa-street': 'lane' };
  const placeOf = name => PLACES[name] ? name : (ALIAS[name] || 'lane');
  let shot = null;   // per-moment framing: { stage:[u,v], focus:[u,v], zoom }
  const PL = p => (shot && p === place) ? { ...PLACES[p], ...shot } : PLACES[p];

  const imgs = {};
  function img(name) {
    if (!imgs[name]) { const i = new Image(); i.decoding = 'async'; i.src = `assets/img/${name}.webp`; imgs[name] = i; }
    return imgs[name];
  }
  const ready = i => i && i.complete && i.naturalWidth > 0;

  let canvas, ctx, W = 0, H = 0, DPR = 1;
  let place = 'lane', prevPlace = null, fade = 1, zoomNow = 1, zoomTarget = 1, zoomFrom = 1, zoomT = 1, zoomDur = 1.1;
  let fNow = null, fFrom = null, fTarget = null, prevView = null;   // focus [u,v] of the current place
  let run = null;                // active moment: {trick, opts, s, phase, t, api, memory}
  const listeners = { frame: [], end: [], phase: [] };
  const sparks = [], smoke = [], papers = [], remains = {};
  let light = { at: [0, 0, 0], power: 0, rgb: [255, 170, 70] }, shake = 0, wash = 0, slow = 1;
  const pointer = { x: 0, y: 0, down: false, justDown: false, justUp: false, vx: 0, vy: 0, t: 0, path: [] };
  let micLevel = null;

  // ---------- geometry ----------
  function plateRect(p = place, zoom) {
    const P = PL(p), im = img(P.plate), pw = im.naturalWidth || 1600, ph = im.naturalHeight || 1067;
    const cur = p === place, f = cur ? (fNow || P.focus) : (prevView?.f || P.focus);
    if (zoom == null) zoom = cur ? zoomNow : (prevView?.z || 1);
    const S = Math.max(W / pw, H / ph) * zoom;
    let ox = W / 2 - f[0] * pw * S, oy = H / 2 - f[1] * ph * S;
    ox = clamp(ox, W - pw * S, 0); oy = clamp(oy, H - ph * S, 0);
    return { pw, ph, S, ox, oy };
  }
  // plate fraction → screen
  function toScreen(u, v, p = place) { const r = plateRect(p); return { x: u * r.pw * r.S + r.ox, y: v * r.ph * r.S + r.oy, s: r.S }; }

  function camera(p = place) {
    const P = PL(p), r = plateRect(p);
    const Fp = r.pw / 2 / Math.tan(HFOV / 2);
    const pitch = P.pitchDeg != null ? P.pitchDeg * Math.PI / 180 : Math.atan2(r.ph / 2 - P.vp * r.ph, Fp);
    const below = pitch + Math.atan2(P.stage[1] * r.ph - r.ph / 2, Fp);
    const dist = EYE / Math.tan(Math.max(0.05, below));
    const C = [0, EYE, dist];
    const fwd = [0, -Math.sin(pitch), -Math.cos(pitch)], right = [1, 0, 0], up = [0, Math.cos(pitch), -Math.sin(pitch)];
    const z0 = -v3.dot(C, fwd), F = Fp * r.S;
    // principal point = plate centre on screen; stage column offset handled as a sideways shift
    const cx = r.pw / 2 * r.S + r.ox + (P.stage[0] - 0.5) * r.pw * r.S, cy = r.ph / 2 * r.S + r.oy;
    return { place: p, C, fwd, right, up, F, cx, cy, z0, scale: F / z0, eye: v3.norm(C), metres: dist * UNIT_M, pitch, yaw: 0 };
  }
  function project3(p, c) {
    const r = [p[0] - c.C[0], p[1] - c.C[1], p[2] - c.C[2]], z = Math.max(0.3, v3.dot(r, c.fwd));
    return { x: c.cx + c.F * v3.dot(r, c.right) / z, y: c.cy - c.F * v3.dot(r, c.up) / z, d: z, f: c.z0 / z };
  }
  // screen → ground (y = 0)
  function unproject(x, y, c) {
    const dx = (x - c.cx) / c.F, dy = -(y - c.cy) / c.F;
    const dir = v3.norm(v3.add(v3.add(c.fwd, v3.scale(c.right, dx)), v3.scale(c.up, dy)));
    if (dir[1] >= -1e-4) return null;
    const t = -c.C[1] / dir[1];
    return v3.add(c.C, v3.scale(dir, t));
  }

  // ---------- the api handed to tricks ----------
  function makeApi() {
    const api = {
      get W() { return W; }, get H() { return H; }, get ctx() { return ctx; },
      get cam() { return camera(); }, get place() { return place; },
      project: p => project3(p, camera()),
      unproject: (x, y) => unproject(x, y, camera()),
      rand, clamp, reduced, Sfx, Phys, Mesh,
      pointer,
      img,
      panOf(p) { return clamp((project3(p, camera()).x / W - 0.5) * 1.6, -1, 1); },
      // heading (radians in world x/z) toward a screen point, default the far end of the place
      aim(from = [0, 0, 0], screen = [0.55, 0.42]) {
        const c = camera(); let best = 0, bd = Infinity;
        for (let i = 0; i < 360; i++) { const th = i / 360 * Math.PI * 2, q = project3([from[0] + Math.cos(th) * 8, 0, from[2] + Math.sin(th) * 8], c); const d = Math.hypot(q.x - screen[0] * W, q.y - screen[1] * H); if (d < bd) { bd = d; best = th; } }
        return best;
      },
      spark(p, v, o = {}) {
        if (sparks.length > (reduced ? 600 : 3500)) return;
        const c = camera(), a = project3(p, c), b = project3(v3.add(p, v3.scale(v, 0.04)), c), g = project3([p[0], 0, p[2]], c);
        const life = o.life ?? rand(0.25, 1.1);
        sparks.push({ x: a.x, y: a.y, vx: (b.x - a.x) / 0.04, vy: (b.y - a.y) / 0.04, life, max: life, size: (o.size ?? rand(0.7, 1.5)) * Math.min(1.6, Math.max(0.7, c.scale / 60)), color: o.color || 'gold', g: o.gravity ?? 260, floor: o.floor ?? g.y, tail: [] });
      },
      // screen-space spark (for sky effects not tied to the ground)
      sparkScreen(x, y, vx, vy, o = {}) {
        if (sparks.length > 3500) return;
        const life = o.life ?? rand(0.4, 1.4);
        sparks.push({ x, y, vx, vy, life, max: life, size: o.size ?? rand(0.8, 1.6), color: o.color || 'gold', g: o.gravity ?? 60, floor: o.floor ?? Infinity, tail: [] });
      },
      burst(p, n, speed, o = {}) {
        n = reduced ? Math.ceil(n / 6) : Math.round(n * 1.3);
        for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), up = o.flat ? rand(0.02, 0.35) : rand(-0.2, 1), s = rand(speed * 0.25, speed); api.spark(p, [Math.cos(a) * s, up * s * (o.lift ?? 1), Math.sin(a) * s], o); }
      },
      smoke(p, n = 6, o = {}) {
        const c = camera();
        for (let i = 0; i < n; i++) { const a = project3(v3.add(p, [rand(-0.15, 0.15), rand(0, 0.15), rand(-0.15, 0.15)]), c); smoke.push({ x: a.x, y: a.y, r: rand(6, 16) * (o.size || 1) * c.scale / 90, life: rand(1.6, 3.4), max: 3.4, vx: rand(4, 22), vy: -rand(12, 30) }); }
      },
      light(p, power, rgb = [255, 170, 70]) { if (power >= light.power * 0.7) light = { at: p.slice(), power: Math.min(1.4, power), rgb }; wash = Math.max(wash, power * 0.22); },
      shake(a) { a *= 1.4; if (!reduced) shake = Math.max(shake, a); if (a > 5 && navigator.vibrate) try { navigator.vibrate(Math.min(160, a * 10)); } catch {} },
      paper(p, n, speed, colours = [[176, 48, 38], [196, 160, 70], [150, 38, 30]]) {
        n = reduced ? Math.ceil(n / 3) : Math.round(n * 1.6);
        for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), s = rand(speed * 0.3, speed * 1.25); papers.push(new Paper(p, [Math.cos(a) * s, rand(0.6, 1.4) * speed, Math.sin(a) * s], { color: colours[i % colours.length], size: rand(0.04, 0.09) })); }
        while (papers.length > 700) papers.shift();
      },
      remain(fn) { (remains[place] ??= []).push(fn); if (remains[place].length > 30) remains[place].shift(); },
      drawFaces(faces) { Mesh.draw(ctx, faces, p => project3(p, camera()), camera(), light); },
      shadow(at, r, h) { Mesh.shadow(ctx, p => project3(p, camera()), at, r, h); },
      // hand / gesture tricks call this when the player completes the gesture
      ignite() { if (run && run.phase !== 'live' && run.phase !== 'spent') goLive(); },
      // paint extra light into the bloom buffer (fountain cores, flames, glowing wicks): screen px
      glow(x, y, r, colour = '#ffb040', a = 0.6) { bloomDot(x, y, r, colour, a); },
      say(text, ms = 2600) { emit('say', { text, ms }); },
      async mic() {
        if (micLevel) return micLevel;
        try {
          const ac = Sfx.unlock(), stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(stream).connect(an);
          const buf = new Uint8Array(an.fftSize);
          micLevel = () => { an.getByteTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128)); return m / 128; };
          return micLevel;
        } catch { return null; }
      },
    };
    return api;
  }

  // ---------- moment lifecycle ----------
  function emit(type, data) { for (const f of listeners[type] || []) f(data); }
  function setPhase(ph) { if (!run) return; run.phase = ph; document.body.dataset.phase = ph; emit('phase', ph); }

  function playMemory(memory, overrides = {}, framing = null) {
    const b = DiwaliTricks.binding(memory.id);
    if (!b) return false;
    return play(b.trick, { ...b.opts, ...overrides }, b.view || memory.place, memory, framing);
  }
  function play(trickId, opts, where, memory = null, framing = null) {
    stop();
    const trick = DiwaliTricks.get(trickId);
    if (!trick) return false;
    const target = placeOf(where || trick.views[0]);
    if (target !== place) goPlace(target);
    shot = framing;
    goPlace(target, true);
    Sfx.setSpace(PLACES[place].space);
    const api = makeApi();
    run = { trick, opts: { ...DiwaliTricks.defaults(trick), ...opts }, api, memory, phase: 'ready', t: 0 };
    run.s = trick.create(api, run.opts);
    setPhase('ready');
    return true;
  }
  function light_() {
    if (!run || run.phase !== 'ready') return;
    Sfx.unlock();
    if (run.trick.interactive) { setPhase('armed'); return; }
    run.t = 0; setPhase('fuse');
    run.fuseSound = Sfx.fuse({ pan: run.api.panOf(run.trick.wick(run.s, run.api)) });
  }
  function goLive() {
    run.fuseSound?.stop(); run.fuseSound = null;
    run.t = 0; setPhase('live');
    run.trick.ignite(run.s, run.api);
  }
  function stop() {
    if (!run) { shot = null; return; }
    run.fuseSound?.stop(); run.trick.stop?.(run.s, run.api);
    run = null; shot = null; document.body.dataset.phase = '';
  }
  function leave() { stop(); zoomTo(1); }
  function goPlace(p, pushIn = false) {
    p = placeOf(p);
    if (p !== place) { prevView = { z: zoomNow, f: fNow || PL(place).focus }; prevPlace = place; place = p; shot = null; fade = 0; sparks.length = 0; smoke.length = 0; papers.length = 0; zoomNow = 1; fNow = PLACES[p].focus.slice(); }
    img(PLACES[p].plate);
    // portrait phones crop the sides already; wide screens push in less so the street stays in view
    const z = PL(p).zoom, wide = W > H * 1.1;
    zoomTo(pushIn ? (wide ? 1 + (z - 1) * 0.7 : z) : 1, PL(p).focus);
    Sfx.setSpace(PLACES[p].space);
    emit('place', p);
  }
  function zoomTo(z, focus, dur = 1.1) { zoomFrom = zoomNow; zoomTarget = z; zoomT = 0; zoomDur = dur; fFrom = (fNow || PLACES[place].focus).slice(); fTarget = (focus || fFrom).slice(); }
  // free framing: glide the camera to any zoom/focus on the current painting
  function view(p, { zoom = 1, focus, dur = 1.1 } = {}) { p = placeOf(p); if (p !== place) goPlace(p); zoomTo(zoom, focus || PLACES[p].focus, dur); }
  // drag-to-pan in plate pixels → focus shift (clamped later by plateRect)
  function panBy(dx, dy) {
    const r = plateRect(), f = fNow || PLACES[place].focus, hx = Math.min(.5, W / 2 / (r.pw * r.S)), hy = Math.min(.5, H / 2 / (r.ph * r.S));
    fNow = [clamp(f[0] - dx / (r.pw * r.S), hx, 1 - hx), clamp(f[1] - dy / (r.ph * r.S), hy, 1 - hy)];
    fTarget = fNow.slice(); fFrom = fNow.slice();
  }

  // ---------- drawing ----------
  const HOT = ['#e8541a', '#ff7f24', '#ffa337', '#ffc45c', '#ffd98a', '#ffe7b0', '#fff0cc'];
  // Bloom: sparks and light sources also paint into a small buffer; upscaling it twice gives a soft
  // two-scale halo that works in every browser (no canvas filter needed).
  const BLOOM = 6, bloomC = document.createElement('canvas'), bx = bloomC.getContext('2d');
  const bloomC2 = document.createElement('canvas'), bx2 = bloomC2.getContext('2d');
  function sizeBloom() { bloomC.width = Math.max(1, Math.ceil(W / BLOOM)); bloomC.height = Math.max(1, Math.ceil(H / BLOOM)); bloomC2.width = Math.max(1, Math.ceil(bloomC.width / 3)); bloomC2.height = Math.max(1, Math.ceil(bloomC.height / 3)); }
  function bloomDot(x, y, r, col, a) { bx.globalAlpha = a; bx.fillStyle = col; bx.beginPath(); bx.arc(x / BLOOM, y / BLOOM, Math.max(.6, r / BLOOM), 0, 6.283); bx.fill(); }
  function drawBloom() {
    // the light source's own halo: ~0.5 m across in the world, never a screen-filling sun
    if (light.power > 0.02) { const c = camera(), p = project3(light.at, c), r = Math.min(W * .12, c.scale * p.f * 2.5 * Math.min(1, light.power)); bloomDot(p.x, p.y, r, `rgb(${light.rgb.map(v => v * .55 | 0).join(',')})`, Math.min(.5, light.power * .45)); }
    bx2.clearRect(0, 0, bloomC2.width, bloomC2.height); bx2.drawImage(bloomC, 0, 0, bloomC2.width, bloomC2.height);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = 0.75; ctx.drawImage(bloomC, 0, 0, W, H);
    ctx.globalAlpha = 0.6; ctx.drawImage(bloomC2, 0, 0, W, H);
    ctx.restore();
    bx.globalAlpha = 1; bx.clearRect(0, 0, bloomC.width, bloomC.height);
  }
  function drawPlate(p, alpha) {
    const P = PLACES[p], im = img(P.plate);
    if (!ready(im)) { ctx.fillStyle = '#120f18'; ctx.fillRect(0, 0, W, H); return; }
    const r = plateRect(p);
    ctx.globalAlpha = alpha; ctx.drawImage(im, r.ox, r.oy, r.pw * r.S, r.ph * r.S); ctx.globalAlpha = 1;
  }
  function drawSparks(dt) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]; p.life -= dt;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      p.tail.unshift(p.x, p.y); if (p.tail.length > 6) p.tail.length = 6;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= Math.exp(-dt * 1.2); p.vy *= Math.exp(-dt * 0.6);
      if (p.y > p.floor && p.vy > 0) { p.y = p.floor; p.vy *= -0.25; p.vx *= 0.6; p.life = Math.min(p.life, 0.25); }
      const heat = clamp(p.life / p.max, 0, 1);
      const col = p.color === 'rose' ? '#ffb4cb' : p.color === 'white' ? '#f3f6ff' : p.color === 'green' ? '#c9ffb0' : p.color === 'blue' ? '#b9d4ff' : p.color === 'red' ? '#ff8a7a' : HOT[Math.min(6, Math.floor(heat * 7))];
      const tx = p.tail[p.tail.length - 2], ty = p.tail[p.tail.length - 1], fadeIn = Math.min(1, p.life / 0.3);
      ctx.globalAlpha = fadeIn * 0.16; ctx.strokeStyle = p.color === 'gold' ? '#ff9a30' : col; ctx.lineWidth = p.size * 3;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.globalAlpha = fadeIn; ctx.strokeStyle = col; ctx.lineWidth = p.size * (0.7 + heat * 0.5);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tx, ty); ctx.stroke();
      // dim warm colour so hundreds of overlapping sparks add up to amber, not clipped white
      if (i % 3 === 0) bloomDot(p.x, p.y, p.size * 6 * (0.5 + heat), p.color === 'gold' ? '#7a3a0c' : '#55405a', fadeIn * (0.18 + heat * 0.22));
    }
    ctx.restore();
  }
  function drawSmoke(dt) {
    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i]; s.life -= dt; if (s.life <= 0) { smoke.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.r += 9 * dt;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      g.addColorStop(0, `rgba(176,166,152,${0.16 * s.life / s.max})`); g.addColorStop(1, 'rgba(176,166,152,0)');
      ctx.fillStyle = g; ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }
  }
  function drawPapers(dt) {
    const c = camera();
    for (const p of papers) {
      p.step(dt);
      const q = project3(p.pos, c), sz = Math.max(1.5, p.size * c.scale * q.f);
      ctx.save(); ctx.translate(q.x, q.y);
      if (p.rest) { ctx.scale(1, 0.55); ctx.rotate(p.yaw); } else ctx.rotate(p.phase * 0.5);
      const flip = p.rest ? 1 : Math.abs(Math.cos(p.phase));
      ctx.fillStyle = `rgb(${p.color.map(v => Math.round(v * (0.55 + 0.45 * flip))).join(',')})`;
      ctx.fillRect(-sz / 2, -sz * 0.3 * Math.max(0.15, flip), sz, sz * 0.6 * Math.max(0.15, flip));
      ctx.restore();
    }
  }
  function drawLight() {
    if (light.power < 0.01) return;
    const c = camera(), g0 = project3([light.at[0], 0, light.at[2]], c), r = c.scale * 4 * light.power;
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.translate(g0.x, g0.y); ctx.scale(1, 0.42);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(${light.rgb.join(',')},${0.38 * Math.min(1, light.power)})`); g.addColorStop(1, `rgba(${light.rgb.join(',')},0)`);
    ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
  }

  function tick(dt) {
    dt *= slow;
    // camera push-in
    if (zoomT < 1) { zoomT = Math.min(1, zoomT + dt / zoomDur); const e = ease(zoomT); zoomNow = zoomFrom + (zoomTarget - zoomFrom) * e; if (fFrom && fTarget) fNow = [fFrom[0] + (fTarget[0] - fFrom[0]) * e, fFrom[1] + (fTarget[1] - fFrom[1]) * e]; }
    fade = Math.min(1, fade + dt / 0.6);
    ctx.save();
    if (shake > 0.2) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    shake *= Math.exp(-dt * 12);
    if (prevPlace && fade < 1) drawPlate(prevPlace, 1);
    drawPlate(place, prevPlace ? fade : 1);
    ctx.fillStyle = 'rgba(8,6,14,.12)'; ctx.fillRect(-20, -20, W + 40, H + 40);
    for (const f of listeners.frame) f(ctx, dt, { W, H, toScreen, place, camera });
    const api = run?.api || null;
    for (const r of remains[place] || []) r(ctx, api || makeApi());
    drawLight();
    if (run) {
      const { trick, s } = run;
      if (run.phase === 'fuse') {
        run.t += dt;
        const w = trick.wick(s, run.api);
        run.api.burst(w, 2, 2.2, { life: 0.25, size: 0.8, gravity: 120 });
        run.api.light(w, 0.18);
        if (run.t >= trick.fuse) goLive();
      } else if (run.phase === 'live') {
        run.t += dt;
        if (trick.update(s, run.api, dt, run.t)) { setPhase('spent'); emit('end', { memory: run.memory, stat: trick.stat?.(s) || '', line: (typeof trick.spentLine === 'function' ? trick.spentLine(s, run.opts) : trick.spentLine) || '' }); }
      } else if (trick.interactive && (run.phase === 'armed' || run.phase === 'ready')) {
        trick.update(s, run.api, dt, -1);   // interactive tricks animate while waiting for the gesture
        if (run.phase === 'armed' && Stage.autoplay && trick.autoplay) trick.autoplay(s, run.api, run.t += dt);
      }
      trick.draw(s, run.api);
    }
    drawPapers(dt);
    drawSmoke(dt);
    drawSparks(dt);
    drawBloom();
    light.power *= Math.exp(-dt * 7);
    if (wash > 0.005) { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(255,190,110,${wash})`; ctx.fillRect(-20, -20, W + 40, H + 40); ctx.globalCompositeOperation = 'source-over'; }
    wash *= Math.exp(-dt * 6);
    ctx.restore();
    pointer.justDown = pointer.justUp = false;
  }

  let last = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    if (document.hidden || Stage.paused) { last = t; return; }
    const dt = Math.min(0.035, (t - (last || t)) / 1000); last = t;
    tick(dt);
  }

  function resize() {
    DPR = Math.min(2, devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    sizeBloom();
  }

  function init(el) {
    canvas = el; ctx = canvas.getContext('2d');
    resize(); addEventListener('resize', resize);
    const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener('pointerdown', e => { const [x, y] = pos(e); Object.assign(pointer, { x, y, down: true, justDown: true, vx: 0, vy: 0, t: performance.now(), path: [[x, y, performance.now()]] }); canvas.setPointerCapture?.(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      const [x, y] = pos(e), now = performance.now(), dtm = Math.max(1, now - pointer.t) / 1000;
      pointer.vx = pointer.vx * 0.6 + (x - pointer.x) / dtm * 0.4; pointer.vy = pointer.vy * 0.6 + (y - pointer.y) / dtm * 0.4;
      Object.assign(pointer, { x, y, t: now });
      if (pointer.down) { pointer.path.push([x, y, now]); if (pointer.path.length > 400) pointer.path.shift(); }
    });
    const up = () => { if (pointer.down) { pointer.down = false; pointer.justUp = true; } };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    for (const p of Object.values(PLACES)) img(p.plate);
    requestAnimationFrame(frame);
  }

  window.Stage = {
    PLACES, init, goPlace, view, panBy, play, playMemory, light: light_, stop, leave, toScreen, camera, project3, unproject,
    get place() { return place; }, get run() { return run; }, get phase() { return run?.phase || ''; },
    get focus() { return (fNow || PLACES[place].focus).slice(); },
    on(type, fn) { (listeners[type] ??= []).push(fn); },
    set slow(v) { slow = v; }, get slow() { return slow; },
    clearRemains() { for (const k in remains) delete remains[k]; papers.length = 0; },
    advance(seconds, fps = 60) { const n = Math.round(seconds * fps); for (let i = 0; i < n; i++) tick(1 / fps); return run?.phase; },
    snapshot() { return canvas.toDataURL('image/jpeg', 0.85); },
    heroShot() { return canvas.toDataURL('image/jpeg', 0.85); },   // on demand only: encoding every bang hitched phones
    glow(x, y, r, colour, a) { bloomDot(x, y, r, colour, a); },
    get canvas() { return canvas; },
    img,
  };
})();

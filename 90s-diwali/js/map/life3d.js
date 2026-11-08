// life3d.js — the mohalla is busy: kids running with phuljhadis, aunties at the gates, uncles on
// plastic chairs, a scooter putt-putting through, a Maruti crawling past, a cyclist ringing his bell,
// the street dog, and everyone else's rockets and anaars going off over the rooftops.
import * as THREE from 'three';

const rnd = (a = 0, b = 1) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
const TAU = Math.PI * 2;
const SKIN = ['#8d5a3b', '#9b6a48', '#7a4a30', '#a87552', '#6e4429'];
const KURTA = ['#e8d9b8', '#f2efe6', '#c8323a', '#2f6aa8', '#e2a23a', '#3a7a4a', '#7a2a5a', '#d97a2a', '#5a4a8a', '#f4c430'];
const PANTS = ['#2a2a30', '#efe8d8', '#3a3a4a', '#6a5a4a', '#f2efe6'];
const SAREE = ['#c8102e', '#e25822', '#7b1fa2', '#00897b', '#d4a017', '#ad1457', '#1565c0'];
const HAIR = ['#141010', '#1c1410', '#2a1e16'];

const matCache = {};
const mat = c => (matCache[c] ??= new THREE.MeshLambertMaterial({ color: c }));
const G = {
  leg: new THREE.BoxGeometry(.12, .5, .12).translate(0, -.25, 0),
  arm: new THREE.BoxGeometry(.09, .46, .09).translate(0, -.23, 0),
  torso: new THREE.BoxGeometry(.38, .55, .22),
  kurta: new THREE.CylinderGeometry(.19, .26, .5, 8),
  saree: new THREE.CylinderGeometry(.18, .3, .95, 10),
  head: new THREE.SphereGeometry(.12, 10, 8),
  hair: new THREE.SphereGeometry(.125, 10, 6, 0, TAU, 0, 1.6),
  bun: new THREE.SphereGeometry(.07, 8, 6),
};

// a person, ~life size. kind: man | woman | kid | girl
function person(kind) {
  const g = new THREE.Group(), kid = kind === 'kid' || kind === 'girl', s = kid ? rnd(.62, .76) : rnd(.95, 1.05);
  const skin = mat(pick(SKIN)), top = mat(kind === 'woman' ? pick(SAREE) : pick(KURTA)), low = mat(pick(PANTS)), hair = mat(pick(HAIR));
  const hip = new THREE.Group(); hip.position.y = .95; g.add(hip);
  const legL = new THREE.Mesh(G.leg, kind === 'woman' ? top : low), legR = new THREE.Mesh(G.leg, kind === 'woman' ? top : low);
  legL.position.set(-.09, 0, 0); legR.position.set(.09, 0, 0); legL.scale.y = legR.scale.y = 1.85; hip.add(legL, legR);
  if (kind === 'woman') { const sr = new THREE.Mesh(G.saree, top); sr.position.y = -.35; hip.add(sr); }
  const torso = new THREE.Mesh(G.torso, top); torso.position.y = .3; hip.add(torso);
  if (kind !== 'woman') { const k = new THREE.Mesh(G.kurta, top); k.position.y = -.05; hip.add(k); }
  const sh = new THREE.Group(); sh.position.y = .55; hip.add(sh);
  const armL = new THREE.Mesh(G.arm, top), armR = new THREE.Mesh(G.arm, top); armL.position.set(-.24, 0, 0); armR.position.set(.24, 0, 0); sh.add(armL, armR);
  const head = new THREE.Mesh(G.head, skin); head.position.y = .2; sh.add(head);
  const hr = new THREE.Mesh(G.hair, hair); hr.position.y = .215; sh.add(hr);
  if (kind === 'woman' || kind === 'girl') { const b = new THREE.Mesh(G.bun, hair); b.position.set(0, .2, -.12); sh.add(b); }
  g.scale.setScalar(s);
  g.userData = { legL, legR, armL, armR, hip, phase: rnd(0, TAU), kid };
  return g;
}
function animateWalk(p, speed, dt) {
  const u = p.userData; u.phase += dt * speed * (u.kid ? 9 : 6);
  const a = Math.sin(u.phase) * (speed > .1 ? .55 : .04);
  u.legL.rotation.x = a; u.legR.rotation.x = -a; u.armL.rotation.x = -a * .8; u.armR.rotation.x = a * .8;
  u.hip.position.y = .95 + Math.abs(Math.cos(u.phase)) * (speed > .1 ? .04 : 0);
}

function scooterRider() {
  const g = new THREE.Group(), col = pick(['#8fb4c8', '#c8c0a8', '#b03a2e', '#5a7a8a', '#e8e0c8']);
  const body = new THREE.Mesh(new THREE.BoxGeometry(.6, .5, 1.1), mat(col)); body.position.set(0, .45, .15); g.add(body);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(.56, .7, .1), mat(col)); shield.position.set(0, .62, -.45); g.add(shield);
  for (const z of [-.5, .55]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .12, 12), mat('#141414')); w.rotation.z = Math.PI / 2; w.position.set(0, .2, z); g.add(w); }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff2c0').multiplyScalar(3), toneMapped: false })); lamp.position.set(0, .95, -.52); g.add(lamp);
  const rider = person('man'); rider.position.set(0, .15, .2); rider.userData.legL.rotation.x = rider.userData.legR.rotation.x = -1.3; rider.userData.armL.rotation.x = rider.userData.armR.rotation.x = -1.1; g.add(rider);
  if (Math.random() < .6) { const back = person(Math.random() < .5 ? 'woman' : 'kid'); back.position.set(0, .2, .65); back.userData.legL.rotation.x = back.userData.legR.rotation.x = -1.3; g.add(back); }
  return g;
}
function maruti() {
  const g = new THREE.Group(), col = pick(['#f2f2ee', '#b8262a', '#2a4a8a', '#c9c2b0']);
  const lo = new THREE.Mesh(new THREE.BoxGeometry(1.4, .55, 3.3), mat(col)); lo.position.y = .55; g.add(lo);
  const hi = new THREE.Mesh(new THREE.BoxGeometry(1.28, .5, 1.75), mat(col)); hi.position.set(0, 1.07, .15); g.add(hi);
  const gl = new THREE.Mesh(new THREE.BoxGeometry(1.3, .38, 1.6), mat('#1a2430')); gl.position.set(0, 1.07, .15); g.add(gl);
  for (const [x, z] of [[-.68, -1.05], [.68, -1.05], [-.68, 1.05], [.68, 1.05]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .18, 12), mat('#141414')); w.rotation.z = Math.PI / 2; w.position.set(x, .28, z); g.add(w); }
  const hl = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4d0').multiplyScalar(3), toneMapped: false });
  for (const x of [-.48, .48]) { const l = new THREE.Mesh(new THREE.CircleGeometry(.1, 10), hl); l.position.set(x, .62, -1.66); l.rotation.y = Math.PI; g.add(l); }
  const tl = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a1a').multiplyScalar(2), toneMapped: false });
  for (const x of [-.55, .55]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(.18, .1), tl); l.position.set(x, .62, 1.66); g.add(l); }
  return g;
}
function cyclist() {
  const g = new THREE.Group();
  for (const z of [-.52, .52]) { const w = new THREE.Mesh(new THREE.TorusGeometry(.32, .025, 5, 16), mat('#1a1a1a')); w.rotation.y = Math.PI / 2; w.position.set(0, .34, z); g.add(w); }
  const f = new THREE.Mesh(new THREE.BoxGeometry(.04, .04, 1.0), mat('#1a1a1a')); f.position.y = .6; g.add(f);
  const r = person(Math.random() < .5 ? 'man' : 'kid'); r.position.set(0, .05, .1); r.userData.armL.rotation.x = r.userData.armR.rotation.x = -1.0; g.add(r);
  g.userData.rider = r; return g;
}
function dog() {
  const g = new THREE.Group(), c = mat('#b08a5a');
  const b = new THREE.Mesh(new THREE.BoxGeometry(.32, .2, .7), c); b.position.y = .14; g.add(b);
  const h = new THREE.Mesh(new THREE.BoxGeometry(.2, .18, .22), c); h.position.set(0, .2, -.42); g.add(h);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(.05, .1, 4), mat('#8a6a42')); e.position.set(s * .07, .32, -.42); g.add(e); }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .25, 4), c); tail.position.set(0, .2, .45); tail.rotation.x = .9; g.add(tail);
  g.userData.tail = tail; return g;
}

// sparkler held by a running kid: a bright tip
function phuljhadi(kid) {
  const tip = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff6d8').multiplyScalar(4), toneMapped: false }));
  tip.position.set(0, -.5, -.18); kid.userData.armR.add(tip); kid.userData.armR.rotation.x = -2.2; kid.userData.tip = tip; return tip;
}

export function createLife(scene, { sfx, houses }) {
  const actors = [], W = new THREE.Vector3();
  // ---- particles: everyone's rockets, anaars and sparklers share one pool ----
  const N = 3600, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N), drag = new Float32Array(N), grav = new Float32Array(N), base = new Float32Array(N * 3);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: .22, vertexColors: true, toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false; scene.add(pts);
  let head = 0;
  function emit(x, y, z, vx, vy, vz, c, l, g = 9.8, d = .6) { const i = head = (head + 1) % N; pos.set([x, y, z], i * 3); vel.set([vx, vy, vz], i * 3); base.set([c.r, c.g, c.b], i * 3); life[i] = l; grav[i] = g; drag[i] = d; }
  const PAL = [['#ffd27a', '#ffb347'], ['#ff6a8a', '#ffd0dc'], ['#7dff9a', '#d8ffe0'], ['#7ab8ff', '#e0f0ff'], ['#ffe066', '#ffffff'], ['#c08aff', '#ffd27a']];
  const rockets = [];
  function launchRocket() {
    const h = pick(houses), x = h.side * rnd(9, 14), z = h.z + rnd(-3, 3);
    rockets.push({ p: new THREE.Vector3(x, h.H + .5, z), v: new THREE.Vector3(rnd(-1.5, 1.5) - h.side * 1.2, rnd(20, 26), rnd(-1.5, 1.5)), t: 0, fuse: rnd(1.3, 1.9), pal: pick(PAL).map(c => new THREE.Color(c)) });
  }
  const anaars = [];
  function lightAnaar() { const h = pick(houses); anaars.push({ x: h.side * 4.2, z: h.z + rnd(-3, 3), t: 0, dur: rnd(6, 9) }); }

  // ---- the cast ----
  // kids running with phuljhadis, back and forth along the gali
  for (let i = 0; i < 6; i++) { const k = person(Math.random() < .5 ? 'kid' : 'girl'); phuljhadi(k); k.position.set(rnd(-2.6, 2.6), 0, rnd(-50, 50)); k.userData.walk = { dir: Math.random() < .5 ? 1 : -1, speed: rnd(1.6, 2.6), x: k.position.x, turnAt: rnd(15, 40) }; scene.add(k); actors.push(k); }
  // grown-ups strolling
  for (let i = 0; i < 6; i++) { const p = person(Math.random() < .5 ? 'man' : 'woman'); p.position.set(pick([-1, 1]) * rnd(2.4, 3.1), 0, rnd(-60, 60)); p.userData.walk = { dir: Math.random() < .5 ? 1 : -1, speed: rnd(.7, 1.1), x: p.position.x, turnAt: 999 }; scene.add(p); actors.push(p); }
  // people at gates, chatting; aunties on balconies; uncles on chairs
  for (const h of houses) {
    if (Math.random() < .55) for (let k = 0; k < (Math.random() < .5 ? 2 : 3); k++) { const p = person(pick(['man', 'woman', 'woman', 'kid'])); p.position.set(h.side * rnd(4.0, 5.2), 0, h.z + rnd(-3.6, -1.8) + k * .6); p.rotation.y = h.side > 0 ? -Math.PI / 2 + rnd(-.8, .8) : Math.PI / 2 + rnd(-.8, .8); p.userData.idle = rnd(0, TAU); scene.add(p); actors.push(p); }
    if (Math.random() < .45) { const p = person(Math.random() < .6 ? 'woman' : 'man'); p.position.set(h.side * (h.fx - 1.05), 3.15, h.z + rnd(-2.4, 1.6)); p.rotation.y = h.side > 0 ? -Math.PI / 2 : Math.PI / 2; p.userData.idle = rnd(0, TAU); scene.add(p); actors.push(p); }
  }
  // the street dog, sleeping by the postbox
  const sleepy = dog(); sleepy.position.set(3.6, 0, -62.6); sleepy.rotation.y = .5; scene.add(sleepy);
  // traffic
  const traffic = [];
  function spawn(kind) {
    const g = kind === 'car' ? maruti() : kind === 'cycle' ? cyclist() : scooterRider(), dir = Math.random() < .5 ? 1 : -1;
    g.position.set(dir > 0 ? -1.4 : 1.4, 0, dir > 0 ? -78 : 78); g.rotation.y = dir > 0 ? Math.PI : 0;
    scene.add(g); traffic.push({ g, dir, speed: kind === 'car' ? rnd(3, 4.5) : kind === 'cycle' ? rnd(2.5, 3.5) : rnd(4.5, 6.5), kind, rang: false });
  }
  let nextTraffic = 2, nextRocket = 1, nextAnaar = 4;

  // ---- sounds that come from places ----
  let cam = null;
  const near = p => cam ? Math.max(0, 1 - cam.position.distanceTo(p) / 60) : .3;
  const panOf = p => cam ? THREE.MathUtils.clamp((p.x - cam.position.x) / 25, -1, 1) : 0;
  function putt(tr) {   // scooter engine, rising and falling with distance
    if (!sfx?.bus || tr.kind !== 'scooter') return;
    const b = sfx.bus(); if (!b || !b.ready || tr.osc) return;
    const o = b.ac.createOscillator(), f = b.ac.createBiquadFilter(), g = b.ac.createGain(), lfo = b.ac.createOscillator(), lg = b.ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = 52; f.type = 'lowpass'; f.frequency.value = 420; g.gain.value = 0;
    lfo.frequency.value = 18; lg.gain.value = 14; lfo.connect(lg).connect(o.frequency);
    o.connect(f).connect(g); const pan = b.out(g, { wet: .3 }); o.start(); lfo.start();
    tr.osc = { o, g, lfo, pan };
  }

  function update(dt, camera, t) {
    cam = camera;
    // walkers
    for (const a of actors) {
      const w = a.userData.walk;
      if (w) {
        a.position.z += w.dir * w.speed * dt; a.rotation.y = w.dir > 0 ? Math.PI : 0;
        if (Math.abs(a.position.z) > 68 || (w.turnAt -= dt * w.speed) < 0) { w.dir *= -1; w.turnAt = rnd(15, 45); }
        animateWalk(a, w.speed, dt);
        if (a.userData.tip) { a.userData.tip.getWorldPosition(W); for (let k = 0; k < 3; k++) emit(W.x, W.y, W.z, rnd(-1.5, 1.5), rnd(-.5, 2), rnd(-1.5, 1.5), new THREE.Color(Math.random() < .5 ? '#fff4d0' : '#ffc860').multiplyScalar(2.2), rnd(.15, .4), 6, 3); }
      } else if (a.userData.idle != null) { a.userData.idle += dt; a.rotation.y += Math.sin(a.userData.idle * .7) * .002; a.userData.armL.rotation.x = Math.sin(a.userData.idle * 1.3) * .25; a.userData.armR.rotation.x = -.2 + Math.sin(a.userData.idle * .9 + 1) * .3; }
    }
    sleepy.userData.tail.rotation.z = Math.sin(t * 3) * .4;
    // traffic
    if ((nextTraffic -= dt) < 0) { spawn(Math.random() < .55 ? 'scooter' : Math.random() < .5 ? 'car' : 'cycle'); nextTraffic = rnd(9, 18); }
    for (let i = traffic.length - 1; i >= 0; i--) {
      const tr = traffic[i]; tr.g.position.z += tr.dir * tr.speed * dt;
      if (tr.kind === 'cycle') { animateWalk(tr.g.userData.rider, 1.2, dt); if (!tr.rang && near(tr.g.position) > .7) { tr.rang = true; if (sfx?.strike) sfx.strike('coin', { vol: .12, detune: .9, pan: panOf(tr.g.position) }); setTimeout(() => sfx?.strike?.('coin', { vol: .1, detune: .9 }), 140); } }
      putt(tr); if (tr.osc) { const k = near(tr.g.position); tr.osc.g.gain.value = k * k * .05; tr.osc.pan.pan.value = panOf(tr.g.position); }
      if (Math.abs(tr.g.position.z) > 80) { scene.remove(tr.g); if (tr.osc) { tr.osc.o.stop(); tr.osc.lfo.stop(); } traffic.splice(i, 1); }
    }
    // everyone else's rockets
    if ((nextRocket -= dt) < 0) { launchRocket(); nextRocket = rnd(1.8, 5); }
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i]; r.t += dt; r.v.y -= 6 * dt; r.p.addScaledVector(r.v, dt);
      emit(r.p.x, r.p.y, r.p.z, rnd(-.4, .4), rnd(-2, -.5), rnd(-.4, .4), new THREE.Color('#ffb347').multiplyScalar(2), rnd(.3, .6), 2, 2);
      if (r.t > r.fuse) {
        const kind = Math.random(), n = kind < .12 ? 12 : rnd(110, 180) | 0;
        for (let k = 0; k < n; k++) {
          const a = rnd(0, TAU), e = Math.acos(rnd(-1, 1)), sp = kind < .12 ? rnd(1, 3) : kind < .4 ? rnd(5, 7) : rnd(3, 9);
          const c = r.pal[k % 2].clone().multiplyScalar(kind < .4 ? 2.6 : 2.2);
          emit(r.p.x, r.p.y, r.p.z, Math.sin(e) * Math.cos(a) * sp, Math.cos(e) * sp, Math.sin(e) * Math.sin(a) * sp, c, kind < .4 ? rnd(1.8, 2.8) : rnd(1, 1.8), kind < .4 ? 3 : 4.5, kind < .4 ? 1.2 : .9);
        }
        const d = cam ? cam.position.distanceTo(r.p) : 60;
        setTimeout(() => sfx?.boom?.({ vol: Math.max(.05, .45 - d / 220), size: kind < .12 ? .2 : .7, muffle: .55, pan: panOf(r.p) }), Math.min(900, d * 3));
        rockets.splice(i, 1);
      }
    }
    // anaars at the gates
    if ((nextAnaar -= dt) < 0) { lightAnaar(); nextAnaar = rnd(7, 15); }
    for (let i = anaars.length - 1; i >= 0; i--) {
      const a = anaars[i]; a.t += dt; const k = Math.sin(Math.min(1, a.t / a.dur) * Math.PI);
      for (let j = 0; j < 14 * k; j++) { const ang = rnd(-.35, .35), sp = rnd(4, 7.5); emit(a.x, .25, a.z, Math.sin(ang) * sp * rnd(-1, 1), Math.cos(ang) * sp, Math.sin(ang) * sp * rnd(-1, 1), new THREE.Color(Math.random() < .3 ? '#ffffff' : '#ffc860').multiplyScalar(2.4), rnd(.6, 1.2), 9.8, .4); }
      if (a.t > a.dur) anaars.splice(i, 1);
    }
    // particle physics + fade
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) { if (col[i * 3] !== 0) col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
      life[i] -= dt; const k = Math.exp(-drag[i] * dt), j = i * 3;
      vel[j] *= k; vel[j + 1] = vel[j + 1] * k - grav[i] * dt; vel[j + 2] *= k;
      pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
      if (pos[j + 1] < .02) { pos[j + 1] = .02; vel[j + 1] *= -.3; }
      const f = Math.min(1, life[i] * 1.6) * (0.75 + Math.random() * .25);
      col[j] = base[j] * f; col[j + 1] = base[j + 1] * f; col[j + 2] = base[j + 2] * f;
    }
    pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true;
  }
  return { update, mute() { for (const tr of traffic) if (tr.osc) tr.osc.g.gain.value = 0; } };
}

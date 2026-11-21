// The small and hidden things: each built from a few primitives, each with a reaction of its own.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { coralMat } from './reef.js';
import { oceanify } from './ocean.js';
import { terrainY } from './terrain.js';
import { srand, rnd, rr, clamp } from './noise.js';
import { registerThumb } from './thumbs.js';
import * as audio from './audio.js';

const TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0), _c = new THREE.Color(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();
// paint a geometry: colour may be a hex or fn(v) -> hex/Color; sw likewise a number or fn(v)
function P(g, col, sw = 0) {
  if (g.index) g = g.toNonIndexed(); g.deleteAttribute('uv'); if (!g.attributes.normal) g.computeVertexNormals();
  const p = g.attributes.position, n = p.count, c = new Float32Array(n * 3), s = new Float32Array(n);
  for (let i = 0; i < n; i++) { _v.fromBufferAttribute(p, i); const k = typeof col === 'function' ? col(_v) : col; _c.set(k); c[i * 3] = _c.r; c[i * 3 + 1] = _c.g; c[i * 3 + 2] = _c.b; s[i] = typeof sw === 'function' ? sw(_v) : sw; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('sw', new THREE.BufferAttribute(s, 1)); return g;
}
const M = (gs) => mergeGeometries(gs, false);
const ball = (r, x, y, z, col, sx = 1, sy = 1, sz = 1, sw = 0) => { const g = new THREE.SphereGeometry(r, 8, 6); g.scale(sx, sy, sz); g.translate(x, y, z); return P(g, col, sw); };
function rod(r0, r1, len, from, dir, col, sw = 0, seg = 5) { const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1); g.translate(0, len / 2, 0); g.applyQuaternion(_q.setFromUnitVectors(UP, _v.set(dir[0], dir[1], dir[2]).normalize())); g.translate(from[0], from[1], from[2]); return P(g, col, sw); }

// ---- builders
function eelGeo() {
  const g = new THREE.CylinderGeometry(0.008, 0.011, 0.5, 6, 10); g.translate(0, 0.25, 0);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.11 * Math.pow(Math.max(0, y) / 0.5, 2.4)); }
  g.computeVertexNormals();
  const body = P(g, (v) => (Math.sin(v.y * 95 + Math.atan2(v.z, v.x - 0.11 * Math.pow(Math.max(0, v.y) / 0.5, 2.4)) * 2) > 0.62 ? '#2a2620' : '#ece5d2'), (v) => 0.6 * Math.max(0, v.y) / 0.5);
  return M([body, ball(0.012, 0.118, 0.5, 0, '#ece5d2', 1.6, 1, 1, 0.6), ball(0.004, 0.126, 0.506, 0.009, '#111', 1, 1, 1, 0.6), ball(0.004, 0.126, 0.506, -0.009, '#111', 1, 1, 1, 0.6)]);
}
function jellyGeo() {
  const bell = new THREE.SphereGeometry(0.16, 20, 8, 0, TAU, 0, Math.PI * 0.5); bell.scale(1, 0.62, 1);
  const gs = [P(bell, '#eef4ff')];
  for (let i = 0; i < 4; i++) { const t = new THREE.TorusGeometry(0.032, 0.008, 5, 12); t.rotateX(Math.PI / 2); const a = i / 4 * TAU + 0.78; t.translate(Math.cos(a) * 0.05, 0.035, Math.sin(a) * 0.05); gs.push(P(t, '#e59ad6')); }
  for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; gs.push(rod(0.003, 0.001, 0.1 + 0.05 * Math.sin(i * 2.3), [Math.cos(a) * 0.155, 0, Math.sin(a) * 0.155], [Math.cos(a) * 0.2, -1, Math.sin(a) * 0.2], '#f4f8ff', 0, 3)); }
  return M(gs);
}
function featherGeo(seed) {
  srand(seed); const gs = [ball(0.02, 0, 0.02, 0, '#f2f2f2')];
  for (let i = 0; i < 14; i++) {
    const L = rr(0.18, 0.26), g = new THREE.PlaneGeometry(0.05, L, 2, 8); g.translate(0, L / 2, 0);
    const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k), f = y / L; p.setZ(k, 0.1 * f * f - 0.03 * Math.sin(f * 3.1)); p.setX(k, p.getX(k) * (1 - 0.75 * f)); }
    g.rotateX(rr(0.45, 0.95)); g.rotateY(i / 14 * TAU + rr(-0.15, 0.15)); g.computeVertexNormals();
    gs.push(P(g, (v) => (Math.sin(Math.hypot(v.x, v.y, v.z) * 190) > 0.1 ? '#ffffff' : '#5a5a5a'), (v) => clamp(Math.hypot(v.x, v.y, v.z) / 0.25, 0, 1)));
  }
  return M(gs);
}
function squirtGeo(seed) {
  srand(seed); const gs = [];
  for (let i = 0; i < 6; i++) {
    const x = rr(-0.035, 0.035), z = rr(-0.035, 0.035), h = rr(0.04, 0.065), dir = [rr(-0.3, 0.3), 1, rr(-0.3, 0.3)];
    const g = new THREE.CylinderGeometry(0.013, 0.019, h, 8, 1, true); g.translate(0, h / 2, 0); g.applyQuaternion(_q.setFromUnitVectors(UP, _v.set(dir[0], dir[1], dir[2]).normalize())); g.translate(x, 0, z); gs.push(P(g, (v) => (v.y > h * 0.75 ? '#ffffff' : '#c9c9c9')));
    gs.push(ball(0.017, x, 0.004, z, '#9a9a9a', 1, 0.6, 1));
  }
  return M(gs);
}
function mantisGeo() {
  const gs = [];
  for (let i = 0; i < 9; i++) { const t = i / 8, x = -0.075 + t * 0.13; gs.push(ball(0.017 - 0.004 * Math.abs(t - 0.6), x, 0.02, 0, i % 2 ? '#3fae6a' : '#2f8f5a', 1.1, 0.85, 1.25)); }
  gs.push(ball(0.02, 0.07, 0.024, 0, '#58c684', 1.2, 0.9, 1.1));
  for (const s of [-1, 1]) { gs.push(ball(0.014, -0.092, 0.018, s * 0.016, '#d8402a', 1.6, 0.3, 1), ball(0.012, -0.1, 0.018, s * 0.03, '#2d6fd8', 1.4, 0.3, 0.9));
    gs.push(rod(0.003, 0.003, 0.02, [0.085, 0.03, s * 0.01], [0.6, 1, s * 0.5], '#8c6fd0'), ball(0.007, 0.097, 0.05, s * 0.02, '#c98cff', 1, 1.3, 1));
    gs.push(ball(0.012, 0.075, 0.008, s * 0.014, '#ff5a2a', 1.5, 0.9, 0.8), ball(0.012, 0.09, 0.022, s * 0.034, '#f3c53a', 1.6, 0.25, 1));
    for (let k = 0; k < 3; k++) gs.push(rod(0.003, 0.002, 0.022, [0.03 - k * 0.03, 0.012, s * 0.014], [0, -1, s * 0.9], '#e2452c'));
    gs.push(rod(0.0015, 0.0008, 0.06, [0.09, 0.03, s * 0.006], [1, 0.5, s * 0.6], '#e86a3a')); }
  return M(gs);
}
function hermitParts() {
  const sh = []; let r = 0.03, a = 0, y = 0.03;
  for (let i = 0; i < 6; i++) { sh.push(ball(r, -0.012 - Math.cos(a) * r * 0.5, y, Math.sin(a) * r * 0.5, i % 2 ? '#d9c3a0' : '#a9805a', 1, 0.95, 1)); a += 1.4; y += r * 0.55; r *= 0.74; }
  const bd = [ball(0.012, 0.028, 0.014, 0, '#d8452a', 1.2, 0.8, 1)];
  for (const s of [-1, 1]) { bd.push(ball(0.011, 0.042, 0.012, s * 0.016, '#e25a34', 1.5, 0.8, 0.9), rod(0.002, 0.002, 0.016, [0.034, 0.02, s * 0.006], [0.6, 1, s * 0.4], '#e9c9b0'), ball(0.0035, 0.044, 0.035, s * 0.012, '#111'));
    for (let k = 0; k < 2; k++) bd.push(rod(0.004, 0.002, 0.035, [0.025 - k * 0.012, 0.012, s * 0.012], [0.5 - k * 0.5, -0.25, s], '#d8452a')); }
  return { shell: M(sh), body: M(bd) };
}
function seahorseGeo() {
  const gs = [], pts = [];
  for (let i = 0; i <= 26; i++) { const t = i / 26; let x, y, r;
    if (t < 0.3) { const a = t / 0.3 * 4.2; const rad = 0.006 + 0.016 * (t / 0.3); x = -0.012 + Math.cos(a + 1.2) * rad; y = 0.022 + Math.sin(a + 1.2) * rad; r = 0.004 + 0.006 * (t / 0.3); }
    else { const u = (t - 0.3) / 0.7; x = 0.012 * Math.sin(u * 3.0) - 0.006; y = 0.03 + u * 0.095; r = 0.011 + 0.008 * Math.sin(Math.min(1, u * 1.5) * Math.PI) - 0.004 * u; }
    pts.push([x, y, r]); }
  pts.forEach(([x, y, r], i) => gs.push(ball(r, x, y, 0, i % 3 ? '#f0bf2e' : '#d79f1e', 1, 1, 0.8, 0.5 * clamp(y / 0.14, 0, 1))));
  gs.push(ball(0.012, 0.004, 0.135, 0, '#f0bf2e', 1.2, 1, 0.8, 0.5), rod(0.005, 0.0035, 0.03, [0.012, 0.132, 0], [1, -0.35, 0], '#e9b528', 0.5), ball(0.003, 0.008, 0.139, 0.008, '#111', 1, 1, 1, 0.5), ball(0.003, 0.008, 0.139, -0.008, '#111', 1, 1, 1, 0.5), ball(0.006, -0.002, 0.15, 0, '#d79f1e', 0.8, 1.2, 0.6, 0.5));
  const f = new THREE.PlaneGeometry(0.02, 0.03); f.translate(-0.022, 0.09, 0); gs.push(P(f, '#f7dc7a', 0.5));
  return M(gs);
}
function flounderGeo() {
  const b = new THREE.SphereGeometry(1, 22, 12); b.scale(0.13, 0.013, 0.085);
  const fr = new THREE.SphereGeometry(1, 22, 6); fr.scale(0.15, 0.004, 0.11);
  const tl = new THREE.SphereGeometry(1, 8, 4); tl.scale(0.035, 0.003, 0.04); tl.translate(-0.15, 0, 0);
  const sand = (v) => { const sp = Math.sin(v.x * 75) * Math.sin(v.z * 75); return sp > 0.8 ? '#5f8fb0' : sp > 0.62 ? '#8a7a55' : Math.sin(v.x * 300 + v.z * 170) > 0.6 ? '#d6c9a8' : '#e9dec2'; };
  return M([P(b, sand), P(fr, (v) => (Math.sin(Math.atan2(v.z, v.x) * 60) > 0 ? '#d9cdae' : '#c4b690')), P(tl, '#d9cdae'), ball(0.008, 0.085, 0.014, 0.014, '#4a4230', 1, 1.1, 1), ball(0.008, 0.07, 0.014, -0.012, '#4a4230', 1, 1.1, 1), ball(0.0035, 0.087, 0.021, 0.014, '#0c0c0c'), ball(0.0035, 0.072, 0.021, -0.012, '#0c0c0c')]);
}
function cleanerGeo() {
  const gs = [];
  for (let i = 0; i < 7; i++) { const t = i / 6, x = -0.02 + t * 0.04, y = 0.012 + 0.004 * Math.sin(t * 3); gs.push(ball(0.006 - 0.002 * t * (1 - t) * 0 - (i === 0 ? 0.002 : 0), x, y, 0, '#d8232a', 1.2, 1, 1), ball(0.003, x, y + 0.0045, 0, '#ffffff', 1.4, 0.6, 0.7)); }
  for (const s of [-1, 1]) { gs.push(rod(0.0009, 0.0004, 0.075, [0.02, 0.016, s * 0.003], [1, 0.45, s * 0.55], '#ffffff', 1, 3), rod(0.0009, 0.0004, 0.06, [0.02, 0.016, s * 0.003], [0.6, 0.9, s * 0.9], '#ffffff', 1, 3));
    for (let k = 0; k < 3; k++) gs.push(rod(0.0012, 0.0008, 0.016, [0.008 - k * 0.01, 0.01, s * 0.004], [0.2, -1, s * 0.8], '#f2b0a8', 0, 3)); }
  gs.push(ball(0.006, -0.027, 0.012, 0, '#d8232a', 1.4, 0.4, 1.6));
  return M(gs);
}

export function buildSmalls(scene, env, pickables, isMobile) {
  srand(777);
  const pick = [], acts = [];
  const add = (key, p, r, extra) => { const o = Object.assign({ key, p, r }, extra); pick.push(o); return o; };
  const mat = coralMat({ absorb: 0.12, rough: 0.6 }), sway = coralMat({ absorb: 0.12, sway: 0.03, rough: 0.6 }), sway2 = coralMat({ absorb: 0.12, sway: 0.035, side: THREE.DoubleSide });
  const HUES = [0.95, 0.85, 0.75, 0.62, 0.52, 0.15, 0.08, 0.02];
  const vivid = (k = 1.5) => new THREE.Color().setHSL(HUES[(rnd() * HUES.length) | 0], rr(0.75, 0.95), rr(0.5, 0.6)).multiplyScalar(k);
  const inst = (geo, m, items) => { const im = new THREE.InstancedMesh(geo, m, items.length); items.forEach((it, i) => { _m.compose(it.p, it.q, _s.setScalar(it.s)); im.setMatrixAt(i, _m); if (it.c) im.setColorAt(i, it.c); }); im.receiveShadow = true; scene.add(im); return im; };
  const onRock = (n, a, b, d) => env.rockSpots(env.big, n, a, b, d);
  const qUp = (nrm, blend) => new THREE.Quaternion().setFromUnitVectors(UP, nrm.clone().lerp(UP, blend).normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(UP, rnd() * TAU));

  // ---- garden eels: a colony on open sand behind the boat that sinks as you come near
  { const geo = eelGeo(); registerThumb('gardenEel', geo); const C = { x: -9, z: 37 }, n = isMobile ? 22 : 40, eels = [];
    for (let i = 0; i < n; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * 4.2, x = C.x + Math.cos(a) * d, z = C.z + Math.sin(a) * d; eels.push({ p: new THREE.Vector3(x, terrainY(x, z) - 0.02, z), yaw: 2.6 + rr(-0.5, 0.5), s: rr(0.75, 1.2), out: 1 }); }
    const im = new THREE.InstancedMesh(geo, sway, n); scene.add(im);
    for (let i = 0; i < 5; i++) { const e = eels[i * 4]; add('gardenEel', e.p.clone().add(new THREE.Vector3(0, 0.25, 0)), 0.9); }
    const put = () => { eels.forEach((e, i) => { _q.setFromAxisAngle(UP, e.yaw); _m.compose(e.p, _q, _s.set(e.s, e.s * Math.max(0.02, e.out), e.s)); im.setMatrixAt(i, _m); }); im.instanceMatrix.needsUpdate = true; }; put();
    acts.push((dt, cam) => { if (!dt) return; let ch = false; for (const e of eels) { const d = Math.hypot(cam.position.x - e.p.x, cam.position.z - e.p.z) + Math.abs(cam.position.y - e.p.y) * 0.5; const want = clamp((d - 2.4) / 2.2, 0, 1); if (Math.abs(want - e.out) > 0.003) { e.out += (want - e.out) * (1 - Math.exp(-dt * (want < e.out ? 7 : 1.2))); ch = true; } } if (ch) put(); }); }

  // ---- moon jellies drifting under the surface
  { const geo = jellyGeo(); registerThumb('moonJelly', geo);
    const jm = oceanify(new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.5, roughness: 0.3, emissive: '#7fb2ff', emissiveIntensity: 0.35, depthWrite: false, side: THREE.DoubleSide }), { caustic: 0.4, absorb: 0.2, key: 'jelly' });
    const n = isMobile ? 12 : 30, C = { x: 18, z: 44 };
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, jm); m.renderOrder = 11; const s = rr(0.8, 1.9); m.position.set(C.x + rr(-16, 16), rr(-4.5, -1.6), C.z + rr(-14, 14)); m.rotation.set(rr(-0.4, 0.4), rnd() * 6, rr(-0.4, 0.4)); scene.add(m);
      const ph = rnd() * 6, base = m.position.clone(); add('moonJelly', m.position, 0.2 * s);
      acts.push((dt, cam, t) => { const k = Math.sin(t * 1.5 + ph), sq = 0.5 + 0.5 * k; m.scale.set(s * (1 + 0.14 * k), s * (1 - 0.2 * k), s * (1 + 0.14 * k)); m.position.y = base.y + 0.25 * Math.sin(t * 0.21 + ph) + 0.03 * sq; m.position.x = base.x + 1.2 * Math.sin(t * 0.05 + ph); m.position.z = base.z + 1.2 * Math.cos(t * 0.043 + ph * 2); }); } }

  // ---- feather stars and sea squirts scattered over the reef
  { const geos = [featherGeo(1), featherGeo(2), featherGeo(3)]; registerThumb('featherStar', geos[0]);
    const spots = onRock(isMobile ? 24 : 60, 0.6, 1, 1.4), per = [[], [], []];
    spots.forEach((sp, i) => { const s = rr(0.9, 1.6), p = sp.p.clone().addScaledVector(sp.n, 0.06); per[i % 3].push({ p, q: qUp(sp.n, 0.6), s, c: vivid(1.4) }); add('featherStar', p, 0.24 * s, { base: true }); });
    per.forEach((items, i) => items.length && inst(geos[i], sway2, items)); }
  { const geos = [squirtGeo(1), squirtGeo(2)]; registerThumb('seaSquirt', geos[0]);
    const spots = onRock(isMobile ? 40 : 110, 0.1, 1, 0.5), per = [[], []];
    spots.forEach((sp, i) => { const s = rr(1.0, 1.9), p = sp.p.clone(); per[i % 2].push({ p, q: qUp(sp.n, 0.3), s, c: vivid(1.7) }); if (i % 3 === 0) add('seaSquirt', p, 0.09 * s, { base: true }); });
    per.forEach((items, i) => items.length && inst(geos[i], sway2, items)); }

  // ---- peacock mantis shrimp at burrows in the rubble: punches when tapped
  { const geo = mantisGeo(); registerThumb('mantisShrimp', geo);
    for (const sp of env.sandSpots(env.rubble.x + 3, env.rubble.z + 2, 9, 2, 3)) {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.07, 14), new THREE.MeshBasicMaterial({ color: '#0a0806' })); hole.rotation.x = -Math.PI / 2; hole.position.copy(sp.p).add(new THREE.Vector3(0, 0.012, 0)); scene.add(hole);
      const m = new THREE.Mesh(geo, mat); const yaw = rnd() * 6; m.position.copy(sp.p).add(new THREE.Vector3(Math.cos(yaw) * 0.05, 0.01, -Math.sin(yaw) * 0.05)); m.rotation.y = yaw; m.rotation.z = 0.35; m.scale.setScalar(1.25); m.castShadow = true; scene.add(m);
      const base = m.position.clone(), pk = add('mantisShrimp', m.position, 0.16); pk.punch = 0;
      acts.push(() => { const k = clamp(1 - (performance.now() - pk.punch) / 220, 0, 1); m.position.set(base.x + Math.cos(yaw) * 0.06 * k, base.y, base.z - Math.sin(yaw) * 0.06 * k); });
    } }

  // ---- hermit crabs on the sand: pull into the shell when you come close
  { const { shell, body } = hermitParts(); const g = new THREE.Group(); g.add(new THREE.Mesh(shell, mat), new THREE.Mesh(body, mat)); registerThumb('hermitCrab', g);
    for (const sp of env.sandSpots(0, 6, 22, isMobile ? 5 : 9, 2.5)) {
      const grp = new THREE.Group(), sh = new THREE.Mesh(shell, mat), bd = new THREE.Mesh(body, mat); sh.castShadow = true; grp.add(sh, bd); grp.position.copy(sp.p); grp.rotation.y = rnd() * 6; grp.scale.setScalar(rr(0.9, 1.4)); scene.add(grp); add('hermitCrab', grp.position, 0.1);
      let out = 1; const dir = rnd() * 6;
      acts.push((dt, cam, t) => { if (!dt) return; const d = cam.position.distanceTo(grp.position); const want = d < 0.9 ? 0 : 1; out += (want - out) * (1 - Math.exp(-dt * (want ? 1.5 : 12))); bd.scale.setScalar(Math.max(0.01, out)); bd.position.x = -0.02 * (1 - out);
        if (out > 0.9) { grp.position.x += Math.cos(dir + Math.sin(t * 0.1) * 2) * 0.012 * dt; grp.position.z += Math.sin(dir + Math.sin(t * 0.1) * 2) * 0.012 * dt; grp.position.y = terrainY(grp.position.x, grp.position.z); grp.rotation.y = -(dir + Math.sin(t * 0.1) * 2); } });
    } }

  // ---- seahorses holding seagrass in the meadow
  { const geo = seahorseGeo(); registerThumb('seahorse', geo);
    for (let i = 0; i < (isMobile ? 3 : 6); i++) { const a = rnd() * TAU, d = rr(3, 15), x = env.meadow.x + Math.cos(a) * d, z = env.meadow.z + Math.sin(a) * d; const m = new THREE.Mesh(geo, sway); m.position.set(x, terrainY(x, z) + 0.1, z); m.rotation.y = rnd() * 6; m.scale.setScalar(rr(1.0, 1.4)); scene.add(m); add('seahorse', m.position, 0.13, { base: true }); } }

  // ---- leopard flounders flat on the sand near the anchor: bolt when you get too close
  { const geo = flounderGeo(); registerThumb('flounder', geo);
    for (const [x, z] of [[2.5, 15], [-4, 26], [6, 30], [-2, -8]]) { const m = new THREE.Mesh(geo, mat); m.position.set(x, terrainY(x, z) + 0.012, z); m.rotation.y = rnd() * 6; m.scale.setScalar(rr(1.3, 1.8)); scene.add(m); add('flounder', m.position, 0.2);
      const v = new THREE.Vector3();
      acts.push((dt, cam) => { if (!dt) return; const dx = m.position.x - cam.position.x, dz = m.position.z - cam.position.z, d = Math.hypot(dx, dz, m.position.y - cam.position.y); if (d < 0.85 && v.lengthSq() < 0.01) { const l = Math.hypot(dx, dz) || 1; v.set(dx / l * 3.2, 0, dz / l * 3.2); m.rotation.y = Math.atan2(-dz, dx); }
        if (v.lengthSq() > 1e-4) { m.position.addScaledVector(v, dt); v.multiplyScalar(Math.exp(-dt * 2.2)); m.position.y = terrainY(m.position.x, m.position.z) + 0.012 + 0.06 * Math.min(1, v.length()); } }); } }

  // ---- cleaner shrimp beside the moray
  { const geo = cleanerGeo(); registerThumb('cleanerShrimp', geo); const mor = pickables.find((p) => p.key === 'giantMoray');
    const at = mor ? mor.p : new THREE.Vector3(-16, -9.3, -1);
    for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(geo, sway); const off = new THREE.Vector3(rr(-0.18, 0.18), rr(-0.02, 0.14), rr(-0.18, 0.18)); m.position.copy(at).add(off); m.rotation.set(rr(-0.5, 0.5), rnd() * 6, rr(-0.5, 0.5)); m.scale.setScalar(1.5); scene.add(m); add('cleanerShrimp', m.position, 0.08);
      acts.push((dt, cam, t) => { m.position.copy(at).add(off); m.position.y += 0.01 * Math.sin(t * 2 + i); }); } }

  const onTap = (key, pk) => { if (key === 'mantisShrimp' && pk) { pk.punch = performance.now(); setTimeout(audio.snap, 60); } };
  return { pick, onTap, update: (dt, cam, t) => { for (const a of acts) a(dt, cam, t); } };
}

// Places every sessile species on rock and sand by zone, instanced, and registers pickables.
import * as THREE from 'three';
import * as C from './corals.js';
import { oceanify, U } from './ocean.js';
import { terrainY, makeRock } from './terrain.js';
import { srand, rnd, rr, clamp, noise2, fbm2, smoothstep } from './noise.js';
import { registerThumb } from './thumbs.js';

const UP = new THREE.Vector3(0, 1, 0), TAU = Math.PI * 2;

// vertex sway for anemones, fans, seagrass: `sw` attribute weights the motion, uSway sets amplitude
const swayPatch = (amp) => (sh) => {
  sh.uniforms.uSway = { value: amp };
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float sw; uniform float uSway; uniform float uTime;')
    .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
#ifdef USE_INSTANCING
  vec2 iw = instanceMatrix[3].xz;
#else
  vec2 iw = modelMatrix[3].xz;
#endif
{ float swT = uTime * 1.3 + iw.x * 0.7 + iw.y * 0.5;
  transformed.x += (sin(swT) * 0.6 + sin(swT * 2.3 + position.y * 4.0) * 0.4) * uSway * sw;
  transformed.z += (cos(swT * 0.8) * 0.6 + sin(swT * 1.7 + position.x * 4.0) * 0.4) * uSway * sw; }`);
};
export function coralMat(o = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.rough ?? 0.85, metalness: 0, side: o.side || THREE.FrontSide, emissive: o.emissive || 0x000000, emissiveIntensity: o.emissiveI ?? 0 });
  const sway = o.sway ? swayPatch(o.sway) : null;
  return oceanify(m, { caustic: o.caustic ?? 0.9, absorb: o.absorb ?? 1, key: 'coral' + (o.sway || 0) + (o.side || 0), patch: (sh) => { if (sway) sway(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
{ vec3 vdir = normalize(cameraPosition - vOW); float fr = pow(1.0 - clamp(dot(vdir, normalize(vON)), 0.0, 1.0), 2.5); gl_FragColor.rgb += uNight * fr * vec3(0.10, 0.14, 0.16); }`); } });
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _n = new THREE.Vector3();
function instanced(geo, mat, items, shadow = true) {
  const im = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, i) => { _m.compose(it.p, it.q, _s.setScalar(it.s)); im.setMatrixAt(i, _m); if (it.c) im.setColorAt(i, it.c); });
  im.castShadow = shadow; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  return im;
}
// orientation: local +y toward a blend of the surface normal and world up, random yaw
function orientQ(n, upBlend = 0.5) { _n.copy(n).lerp(UP, upBlend).normalize(); _q.setFromUnitVectors(UP, _n); _q2.setFromAxisAngle(UP, rnd() * TAU); return _q.clone().multiply(_q2); }

export function buildReef(scene, isMobile) {
  srand(7);
  const pick = [];
  const used = [];
  const add = (key, p, r) => pick.push({ key, p, r });

  // ---- rock: bommies in a crescent around a sand channel, plus boulders
  const ROCKS = [[1, -12, 8, 5, 3, 4.5], [2, 12, 10, 4.5, 2.8, 4], [3, -14, -6, 6, 3.5, 5], [4, 13, -4, 6, 3.5, 5.5], [5, -13, -20, 7, 4, 6], [6, 15, -18, 7, 4, 6], [7, -16, -36, 6, 3.5, 5], [8, 13, -32, 5.5, 3.2, 5], [9, -12, -50, 7, 4.5, 6], [10, 16, -46, 7, 4.5, 6], [11, 0, -66, 12, 5.5, 9], [12, -28, -14, 5, 3, 4], [13, 30, -26, 6, 3.5, 5], [14, -30, -40, 6, 3.5, 5], [15, 34, -48, 7, 4, 6], [16, -44, -24, 5, 3, 4], [17, 26, 0, 4, 2.5, 3.5], [18, -30, 22, 6, 3.5, 5], [19, 30, 26, 6, 3.5, 5], [20, -34, -62, 8, 4.5, 6], [21, 30, -70, 8, 4.5, 7], [22, -52, -52, 6, 3.5, 5], [23, 54, -10, 6, 3.5, 5], [24, 52, -62, 7, 4, 6], [25, -22, 28, 5, 3, 4], [26, 20, 34, 5, 3, 4], [27, 0, -92, 10, 5, 8], [28, -48, 30, 5, 3, 4], [29, 62, 22, 5, 3, 4], [30, -6, -44, 5, 3, 4], [31, 6, -30, 4, 2.5, 3.5]];
  const rocks = ROCKS.map((r) => { const m = makeRock(...r); scene.add(m); m.updateMatrixWorld(true); return m; });
  for (let i = 0; i < (isMobile ? 30 : 60); i++) { const a = rnd() * TAU, d = rr(6, 84), x = Math.cos(a) * d, z = -20 + Math.sin(a) * d * 0.8; if (Math.abs(x) < 5 && z > -55) continue; const m = makeRock(100 + i, x, z, rr(0.8, 2.4), rr(0.5, 1.3), rr(0.8, 2.2)); scene.add(m); m.updateMatrixWorld(true); rocks.push(m); }
  const big = rocks.slice(0, ROCKS.length);

  // random points on rock surfaces (world space), filtered by normal.y and spacing
  function rockSpots(list, n, nyMin, nyMax, minDist, near) {
    const out = []; let tries = 0;
    while (out.length < n && tries++ < n * 80) {
      const rock = list[(rnd() * list.length) | 0], g = rock.geometry, i = (rnd() * g.attributes.position.count) | 0;
      _p.fromBufferAttribute(g.attributes.position, i).applyMatrix4(rock.matrixWorld);
      _n.fromBufferAttribute(g.attributes.normal, i).transformDirection(rock.matrixWorld);
      if (_n.y < nyMin || _n.y > nyMax) continue;
      if (_p.y < terrainY(_p.x, _p.z) + 0.25) continue;
      if (near && _p.distanceTo(near) > near.w) continue;
      let ok = true; for (const u of used) if (u.distanceToSquared(_p) < minDist * minDist) { ok = false; break; } if (!ok) continue;
      const pt = _p.clone(); used.push(pt); out.push({ p: pt, n: _n.clone() });
    }
    return out;
  }
  function sandSpots(cx, cz, rad, n, minDist, avoidRocks = true) {
    const out = []; let tries = 0;
    while (out.length < n && tries++ < n * 60) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * rad; _p.set(cx + Math.cos(a) * d, 0, cz + Math.sin(a) * d); _p.y = terrainY(_p.x, _p.z);
      if (avoidRocks && rocks.some((r) => { const e = r.userData.ell; return Math.hypot((_p.x - e.x) / e.sx, (_p.z - e.z) / e.sz) < 1.15; })) continue;
      let ok = true; for (const u of used) if (u.distanceToSquared(_p) < minDist * minDist) { ok = false; break; } if (!ok) continue;
      const pt = _p.clone(); used.push(pt); out.push({ p: pt, n: UP.clone() });
    }
    return out;
  }
  const start = new THREE.Vector4(0, -8, 8, 30);
  const HUES = [0.95, 0.88, 0.8, 0.72, 0.6, 0.5, 0.36, 0.16, 0.1, 0.04, 0.0];
  const vivid = (k = 1.5, sat = 0.85, lit = 0.58) => () => new THREE.Color().setHSL(HUES[(rnd() * HUES.length) | 0] + rr(-0.02, 0.02), sat * rr(0.85, 1), lit * rr(0.9, 1.1)).multiplyScalar(k);
  const M = isMobile ? 0.5 : 1; // spots near the start path get the hero pieces

  const mat = coralMat({ absorb: 0.12 }), matSway = coralMat({ sway: 0.05, absorb: 0.12 }), matFan = coralMat({ sway: 0.04, side: THREE.DoubleSide, absorb: 0.12 }), matGrass = coralMat({ sway: 0.07, side: THREE.DoubleSide, caustic: 0.6 });
  const group = new THREE.Group(); scene.add(group);
  const place = (key, geos, spots, sMin, sMax, upBlend, rBase, tintFn, m = mat, shadow = true, register = true) => {
    const perVariant = geos.map(() => []); if (register) registerThumb(key, geos[0]);
    spots.forEach((sp, i) => { const s = rr(sMin, sMax); const it = { p: sp.p, q: orientQ(sp.n, upBlend), s, c: tintFn ? tintFn(i) : null }; perVariant[i % geos.length].push(it); if (register) add(key, sp.p, rBase * s); });
    perVariant.forEach((items, vi) => { if (items.length) group.add(instanced(geos[vi], m, items, shadow)); });
  };

  // ---- hero pieces near the start: anemones, clams, worms, coralline, a brain coral with worms
  const hero = rockSpots(big.slice(0, 4), 6, 0.55, 1, 2.0, start);
  place('anemone', [C.anemone(1), C.anemone(2), C.anemone(3)], hero, 0.95, 1.2, 0.8, 0.5, null, matSway);
  const clamSpots = rockSpots(big.slice(0, 4), 4, 0.75, 1, 1.4, start);
  const clams = [], matMantle = coralMat({ rough: 0.5, emissive: 0x0c6a8a, emissiveI: 0.35 });
  clamSpots.forEach((sp, i) => {
    const { valve, mantle } = C.giantClam(i + 1); const g = new THREE.Group(); g.position.copy(sp.p); g.quaternion.copy(orientQ(sp.n, 0.7)); g.scale.setScalar(0.7);
    const l = new THREE.Mesh(valve, mat); l.rotation.y = Math.PI; l.rotation.x = -0.3; const r = new THREE.Mesh(valve, mat); r.rotation.x = 0.3; const mm = new THREE.Mesh(mantle, matMantle);
    l.castShadow = r.castShadow = true; g.add(l, r, mm); g.userData = { l, r, mm, t: 0 }; group.add(g); clams.push(g); add('giantClam', sp.p, 0.45); if (i === 0) registerThumb('giantClam', g);
  });
  const corSpots = rockSpots(big.slice(0, 4), 10, 0.3, 1, 0.9, start);
  place('coralline', [C.corallinePatch(1), C.corallinePatch(2)], corSpots, 0.9, 1.6, 0.1, 0.3, null, mat, false);
  // brain coral with Christmas tree worms, on the sand by the start
  const heroBrain = new THREE.Mesh(C.brainCoral(42), mat); heroBrain.position.set(-4.5, terrainY(-4.5, 12) + 0.05, 12); heroBrain.scale.setScalar(0.9); heroBrain.castShadow = true; heroBrain.receiveShadow = true; group.add(heroBrain); add('brainCoral', heroBrain.position, 0.95); registerThumb('brainCoral', heroBrain.geometry);
  const worms = [];
  for (let i = 0; i < 6; i++) {
    const a = rr(0, TAU), r = rr(0.15, 0.6); const dir = new THREE.Vector3(Math.cos(a) * r, 0.72, Math.sin(a) * r * 0.9).normalize();
    const w = new THREE.Mesh(C.christmasTreeWorm(i), mat); const pos = dir.clone().multiplyScalar(0.9 * 1.0).add(heroBrain.position); pos.y -= 0.02;
    w.position.copy(pos); w.quaternion.setFromUnitVectors(UP, dir); w.scale.setScalar(1.6); w.userData.out = 1; w.userData.t = 0; group.add(w); worms.push(w); add('christmasTreeWorm', pos, 0.12); if (i === 0) registerThumb('christmasTreeWorm', w.geometry);
  }

  // ---- spots for the fauna
  const anemones = hero.map((h) => h.p.clone().addScaledVector(h.n, 0.32));
  const stSp = rockSpots(big.slice(2, 6), 1, 0.3, 0.9, 1.0)[0], station = stSp ? stSp.p.clone().addScaledVector(stSp.n, 0.6) : new THREE.Vector3(10, -8, -6);
  const juSp = rockSpots(big.slice(0, 4), 1, -0.1, 0.5, 1.0, start)[0], juvenile = juSp ? juSp.p.clone().addScaledVector(juSp.n, 0.3) : new THREE.Vector3(-8, -9, 6);
  const liSp = rockSpots(big.slice(0, 6), 1, -0.3, 0.4, 1.0, start)[0], lion = liSp ? liSp.p.clone().addScaledVector(liSp.n, 0.55) : new THREE.Vector3(9, -8, 2);
  const hideSpots = rockSpots(big, 48, 0.0, 1, 0.3).map((s) => s.p.clone().addScaledVector(s.n, 0.3));
  const spots = { anemones, station, juvenile, lion, hideSpots, garden: { x: 0, y: -8, z: -22 }, rubble: { x: 38, y: terrainY(38, 14) + 1.5, z: 14 }, meadow: { x: -56, y: terrainY(-56, -4) + 1.2, z: -4 }, rocks: rocks.map((r) => r.userData.ell), start, rockSpots, sandSpots, big };

  // ---- coral garden on and around the bommies
  const thickets = []; for (let i = 0; i < (isMobile ? 10 : 30); i++) { const base = sandSpots(0, -26, 66, 1, 2.5)[0]; if (!base) continue; const n = 6 + (rnd() * 8 | 0); for (let j = 0; j < n; j++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * 2.0; const x = base.p.x + Math.cos(a) * d, z = base.p.z + Math.sin(a) * d; thickets.push({ p: new THREE.Vector3(x, terrainY(x, z) - 0.03, z), n: UP.clone() }); } }
  place('staghorn', [C.staghorn(1, 0), C.staghorn(2, 0, false, 0.8), C.staghorn(3, 0, false, 0.94), C.staghorn(4, 0, false, 0.6), C.staghorn(5, 0, false, 0.15), C.staghorn(6, 0, false, 0.4), C.staghorn(7, 0, false, 0.06), C.staghorn(8, 0.1), C.staghorn(9, 0, false, 0.5)], rockSpots(big, Math.round(260 * M), 0.35, 1, 0.8).concat(thickets), 0.8, 1.7, 0.75, 0.55, null, mat, false);
  place('tableCoral', [C.tableCoral(1), C.tableCoral(2), C.tableCoral(3)], rockSpots(big, Math.round(60 * M), 0.65, 1, 2.2).concat(sandSpots(0, -30, 60, Math.round(16 * M), 2.6)), 0.6, 1.5, 0.85, 1.0, vivid(1.35, 0.55, 0.62));
  place('brainCoral', [C.brainCoral(1, 40, true), C.brainCoral(2, 40, true), C.brainCoral(3, 40, true)], rockSpots(big, Math.round(110 * M), 0.4, 1, 1.2).concat(sandSpots(0, -28, 60, Math.round(20 * M), 1.6)), 0.4, 1.0, 0.6, 1.0, vivid(1.25, 0.8, 0.55));
  // encrusting fill: small boulder corals and knobs so the rock reads as living reef
  place('brainCoral', [C.brainCoral(4, 14, true), C.brainCoral(5, 14, true), C.brainCoral(6, 14, true)], rockSpots(rocks, isMobile ? 600 : 2600, 0.05, 1, 0.22), 0.1, 0.34, 0.25, 1.0, vivid(1.5, 0.9, 0.56), mat, false, false);
  place('fireCoral', [C.fireCoral(1), C.fireCoral(2), C.fireCoral(3)], rockSpots(big, Math.round(70 * M), 0.4, 1, 1.1), 0.8, 1.5, 0.6, 0.45, null, mat, false);
  place('leatherCoral', [C.leatherCoral(1), C.leatherCoral(2), C.leatherCoral(3)], rockSpots(big, Math.round(80 * M), 0.45, 1, 1.2).concat(sandSpots(0, -24, 56, Math.round(16 * M), 1.6)), 0.7, 1.6, 0.7, 0.65, vivid(1.3, 0.6, 0.62), matSway, false);
  place('seaFan', [C.seaFan(1, 0.0), C.seaFan(2, 0.8), C.seaFan(3, 0.05), C.seaFan(4, 0.9), C.seaFan(5, 0.13), C.seaFan(6, 0.95)], rockSpots(big, Math.round(70 * M), -0.3, 0.5, 1.3), 1.0, 2.3, 1.0, 0.8, null, matFan, false);
  place('barrelSponge', [C.barrelSponge(1), C.barrelSponge(2)], rockSpots(big, Math.round(22 * M), 0.55, 1, 1.8).concat(sandSpots(0, -26, 56, Math.round(10 * M), 2.2)), 0.6, 1.4, 0.8, 0.75, vivid(2.2, 0.85, 0.55));

  // ---- rubble patch, east: mushroom corals, Halimeda, dead coral stones
  const RUB = { x: 38, z: 14, r: 14 };
  place('mushroomCoral', [C.mushroomCoral(1), C.mushroomCoral(2), C.mushroomCoral(3)], sandSpots(RUB.x, RUB.z, RUB.r, 14, 1.0).concat(sandSpots(0, -20, 34, 10, 1.1)), 0.5, 0.8, 1, 0.45);
  place('halimeda', [C.halimeda(1), C.halimeda(2), C.halimeda(3)], sandSpots(RUB.x, RUB.z, RUB.r, 24, 0.7).concat(sandSpots(0, -20, 36, 24, 0.7), sandSpots(-56, -4, 20, 8, 0.8)), 1.0, 1.8, 1, 0.3, null, mat, false);
  { const items = []; for (let i = 0; i < (isMobile ? 120 : 220); i++) { const inRub = i < 150; const a = rnd() * TAU, d = Math.sqrt(rnd()) * (inRub ? RUB.r + 4 : 60); const x = (inRub ? RUB.x : 0) + Math.cos(a) * d, z = (inRub ? RUB.z : -20) + Math.sin(a) * d; items.push({ p: new THREE.Vector3(x, terrainY(x, z) + 0.02, z), q: orientQ(UP, 1), s: rr(0.12, 0.55) }); }
    group.add(instanced(C.rubble(1), mat, items.slice(0, items.length >> 1), false)); group.add(instanced(C.rubble(2), mat, items.slice(items.length >> 1), false)); }

  // ---- seagrass meadow, west
  const MEAD = { x: -56, z: -4, r: 22 };
  { const items = []; const n = isMobile ? 3500 : 7000; for (let i = 0; i < n; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * MEAD.r; const x = MEAD.x + Math.cos(a) * d, z = MEAD.z + Math.sin(a) * d; const dens = fbm2(x * 0.08, z * 0.08); if (rnd() > dens * 1.6) continue; items.push({ p: new THREE.Vector3(x, terrainY(x, z) - 0.02, z), q: orientQ(UP, 1), s: rr(0.7, 1.5) }); }
    group.add(instanced(C.seagrassBlade(), matGrass, items, false)); registerThumb('seagrass', C.halimeda(9)); }
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, d = i ? MEAD.r * 0.55 : 0; const x = MEAD.x + Math.cos(a) * d, z = MEAD.z + Math.sin(a) * d; add('seagrass', new THREE.Vector3(x, terrainY(x, z) + 0.2, z), 6); }

  // ---- behaviours: worms retract when something comes close or taps; clams close when tapped
  const tmp = new THREE.Vector3();
  function update(t, dt, cam) {
    for (const w of worms) {
      const d = w.position.distanceTo(cam.position);
      const want = (d < 1.3 || w.userData.t > 0) ? 0 : 1; if (w.userData.t > 0) w.userData.t -= dt;
      w.userData.out += (want - w.userData.out) * (want ? 1 - Math.exp(-dt * 1.2) : 1 - Math.exp(-dt * 18));
      w.scale.set(1.6, 1.6 * Math.max(0.02, w.userData.out), 1.6);
    }
    for (const c of clams) { const u = c.userData; if (u.t > 0) u.t -= dt; const want = u.t > 0 ? 0.06 : 0.3; const k = 1 - Math.exp(-dt * (u.t > 0 ? 14 : 2)); u.r.rotation.x += (want - u.r.rotation.x) * k; u.l.rotation.x = -u.r.rotation.x; u.mm.scale.y = Math.max(0.05, (u.r.rotation.x - 0.04) / 0.26); u.mm.position.y = -0.12 * (1 - u.mm.scale.y); }
  }
  function onTap(key, p) {
    if (key === 'christmasTreeWorm') for (const w of worms) if (w.position.distanceTo(p) < 1.5) w.userData.t = 4;
    if (key === 'giantClam') for (const c of clams) if (c.position.distanceTo(p) < 1) c.userData.t = 3;
  }
  return { pick, rocks, update, onTap, group, spots };
}

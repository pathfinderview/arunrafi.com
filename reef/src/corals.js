// Procedural builders for every sessile species. Each returns a BufferGeometry in local space,
// base at the origin, growing along +y, with a `color` attribute and (where it sways) a `sw` attribute.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { srand, rnd, rr, noise3, fbm3, clamp, lerp, smoothstep } from './noise.js';

const UP = new THREE.Vector3(0, 1, 0), TAU = Math.PI * 2;
const _c = new THREE.Color(), _v = new THREE.Vector3(), _n = new THREE.Vector3();

// vertex colours from a function of (position, normal, uv)
export function colorize(geo, fn) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv, out = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    _v.fromBufferAttribute(p, i); if (n) _n.fromBufferAttribute(n, i);
    const c = fn(_v, _n, uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0, i);
    out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(out, 3)); return geo;
}
function swayAttr(geo, fn) {
  const p = geo.attributes.position, uv = geo.attributes.uv, out = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); out[i] = fn(_v, uv ? uv.getY(i) : 0); }
  geo.setAttribute('sw', new THREE.BufferAttribute(out, 1)); return geo;
}
// ensure every piece has the same attributes before merging
function unify(geos) {
  for (const g of geos) { if (!g.attributes.sw) g.setAttribute('sw', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1)); if (!g.attributes.color) colorize(g, () => _c.set('#ffffff')); if (g.index) { const ng = g.toNonIndexed(); g.copy(ng); } }
  return mergeGeometries(geos, false);
}
function tube(r0, r1, len, seg = 6) { const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1); g.translate(0, len / 2, 0); return g; }
function orient(g, p, dir) { const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()); g.applyQuaternion(q); g.translate(p.x, p.y, p.z); return g; }
const disp = (geo, fn) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); fn(_v, i); p.setXYZ(i, _v.x, _v.y, _v.z); } geo.computeVertexNormals(); return geo; };

// ---------------------------------------------------------------- staghorn (Acropora): dense thicket of branches
export function staghorn(seed, tint = 0, blue = false, hue = null) {
  srand(seed); const geos = [];
  const base = blue ? new THREE.Color().setHSL(0.64, 0.38, 0.5) : new THREE.Color().setHSL(0.09 + tint * 0.3, 0.55, 0.42);
  const tip = blue ? new THREE.Color().setHSL(0.6, 0.5, 0.9) : new THREE.Color().setHSL(0.58 + tint, 0.5, 0.84);
  if (hue !== null) { base.setHSL(hue, 0.78, 0.5); tip.setHSL(hue + 0.02, 0.65, 0.84); }
  function branch(p, dir, len, r, depth) {
    const g = tube(r, r * 0.62, len, 5);
    orient(g, p, dir); const dd = depth;
    colorize(g, (v, n, u, vv) => { const k = smoothstep(2.7, 3.7, dd + vv); return _c.copy(base).lerp(tip, k).offsetHSL(0, 0, (noise3(v.x * 30, v.y * 30, v.z * 30) - 0.5) * 0.1); });
    geos.push(g);
    const end = p.clone().addScaledVector(dir, len);
    if (depth >= 2) { const nub = new THREE.SphereGeometry(r * 0.66, 4, 3); nub.translate(end.x, end.y, end.z); colorize(nub, () => _c.copy(tip)); geos.push(nub); }
    if (depth < 3) {
      const n = depth === 0 ? 3 : (rnd() < 0.7 ? 2 : 1);
      for (let i = 0; i < n; i++) {
        const d2 = dir.clone(); d2.x += rr(-0.7, 0.7); d2.z += rr(-0.7, 0.7); d2.y += rr(0.15, 0.8); d2.normalize();
        branch(end, d2, len * rr(0.6, 0.85), r * 0.74, depth + 1);
      }
      if (depth >= 1) for (let i = 0; i < 2; i++) { const t = rr(0.3, 0.8), d2 = dir.clone(); d2.x += rr(-1.2, 1.2); d2.z += rr(-1.2, 1.2); d2.normalize(); branch(p.clone().addScaledVector(dir, len * t), d2, len * 0.28, r * 0.45, 3); }
    }
  }
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + rr(-0.4, 0.4), rad = rr(0.04, 0.24); const d = new THREE.Vector3(Math.cos(a) * rr(0.1, 0.5), 1, Math.sin(a) * rr(0.1, 0.5)).normalize(); branch(new THREE.Vector3(Math.cos(a) * rad, 0, Math.sin(a) * rad), d, rr(0.3, 0.45), 0.085, 0); }
  return unify(geos);
}

// ---------------------------------------------------------------- table coral (Acropora hyacinthus)
export function tableCoral(seed) {
  srand(seed);
  const stem = tube(0.22, 0.16, 0.38, 10); colorize(stem, () => _c.set('#6b5a3e'));
  const R = 1; const plate = new THREE.CylinderGeometry(R, R * 0.95, 0.06, 64, 3);
  disp(plate, (v) => { const a = Math.atan2(v.z, v.x), rad = Math.hypot(v.x, v.z) / R; const irr = 1 + 0.2 * (noise3(Math.cos(a) * 2 + seed, Math.sin(a) * 2, 0) - 0.5) * 2 + 0.06 * Math.sin(a * 9 + seed); v.x *= irr; v.z *= irr; v.y *= 0.6 + 0.4 * (1 - rad); if (v.y > 0.01) v.y += 0.025 * noise3(v.x * 8, v.z * 8, seed) + 0.015 * Math.abs(Math.sin(a * 48)) * rad + 0.05 * rad * rad; v.y += 0.03 * Math.sin(a * 3 + seed) * rad; });
  plate.translate(0, 0.38 + 0.03, 0);
  const top = new THREE.Color('#d6cfa6'), rim = new THREE.Color('#ffffff'), under = new THREE.Color('#5c4c36');
  colorize(plate, (v, n) => { const rad = Math.hypot(v.x, v.z) / R; return n.y > 0.2 ? _c.copy(top).lerp(rim, smoothstep(0.55, 1, rad)).offsetHSL(0, 0, (noise3(v.x * 14, v.z * 14, 3) - 0.5) * 0.12) : _c.copy(under); });
  return unify([stem, plate]);
}

// ---------------------------------------------------------------- brain coral (Platygyra): meandering ridges
export function brainCoral(seed, res = 40, neutral = false) {
  srand(seed);
  const g = mergeVertices(new THREE.SphereGeometry(1, res, (res * 0.6) | 0)); g.scale(1, 0.72, 1);
  const ridgeOf = (v) => Math.sin(TAU * 7.0 * fbm3(v.x * 1.1 + seed, v.y * 1.1, v.z * 1.1 - seed, 3));
  disp(g, (v) => { const r = ridgeOf(v); const k = 1 + 0.035 * r + 0.008 * (noise3(v.x * 9, v.y * 9, v.z * 9) - 0.5); v.multiplyScalar(k); });
  const hi = new THREE.Color(neutral ? '#f6f6f6' : '#d4bd66'), lo = new THREE.Color(neutral ? '#707070' : '#3e4418');
  colorize(g, (v) => { const r = ridgeOf(v.clone().divideScalar(1.02)); return _c.copy(lo).lerp(hi, smoothstep(-0.2, 0.45, r)); });
  return g;
}

// ---------------------------------------------------------------- mushroom coral (Fungia), free-living on sand
export function mushroomCoral(seed) {
  srand(seed);
  const g = new THREE.CylinderGeometry(0.5, 0.44, 0.07, 56, 1);
  disp(g, (v) => { const a = Math.atan2(v.z, v.x), rad = Math.hypot(v.x, v.z) / 0.5; v.x *= 1.3; if (v.y > 0) v.y += 0.08 * (1 - rad * rad) + 0.014 * Math.abs(Math.sin(a * 40)) * Math.pow(rad, 0.7) + 0.02 * noise3(v.x * 10, v.z * 10, seed); });
  const base = new THREE.Color().setHSL(0.07 + rr(-0.03, 0.04), 0.4, 0.5), light = new THREE.Color('#e3d2b0');
  colorize(g, (v, n) => { const a = Math.atan2(v.z, v.x / 1.3); const sep = Math.abs(Math.sin(a * 40)); return n.y > 0.3 ? _c.copy(base).lerp(light, sep * 0.6) : _c.copy(base).multiplyScalar(0.6); });
  return g;
}

// ---------------------------------------------------------------- fire coral (Millepora): upright blunt plates
export function fireCoral(seed) {
  srand(seed); const geos = []; const n = 5 + (rnd() * 4 | 0);
  const base = new THREE.Color('#c9a22a'), tip = new THREE.Color('#f3efd9');
  for (let i = 0; i < n; i++) {
    const h = rr(0.35, 0.75), g = mergeVertices(new THREE.SphereGeometry(1, 18, 14)); g.scale(rr(0.07, 0.12), h, rr(0.18, 0.32));
    disp(g, (v) => { v.x += 0.02 * Math.sin(v.y * 9 + i); v.z += 0.03 * noise3(v.y * 4, i, 0); });
    g.rotateY(rr(0, TAU)); g.rotateZ(rr(-0.25, 0.25)); g.translate(rr(-0.2, 0.2), h * 0.6, rr(-0.2, 0.2));
    colorize(g, (v) => _c.copy(base).lerp(tip, smoothstep(h * 0.9, h * 1.5, v.y)));
    geos.push(g);
  }
  return unify(geos);
}

// ---------------------------------------------------------------- sea fan (gorgonian): branching lattice in a plane
export function seaFan(seed, hue = 0.0) {
  srand(seed); const geos = []; const col = new THREE.Color().setHSL(hue, 0.7, 0.42);
  function br(p, ang, len, r, depth) {
    const dir = new THREE.Vector3(Math.sin(ang), Math.cos(ang), 0);
    const g = tube(r, r * 0.8, len, 4); orient(g, p, dir); colorize(g, () => _c.copy(col)); geos.push(g);
    const end = p.clone().addScaledVector(dir, len);
    if (depth < 6) { const k = depth < 2 ? 3 : 2; for (let i = 0; i < k; i++) br(end, ang + rr(-0.55, 0.55) + (i - (k - 1) / 2) * 0.5, len * rr(0.62, 0.8), r * 0.78, depth + 1); }
  }
  br(new THREE.Vector3(0, 0, 0), 0, 0.3, 0.028, 0);
  const g = unify(geos); swayAttr(g, (v) => clamp(v.y / 1.2, 0, 1)); return g;
}

// ---------------------------------------------------------------- leather coral (Sarcophyton): stalk and a folded, drooping cap
export function leatherCoral(seed) {
  srand(seed);
  const stalk = tube(0.22, 0.18, 0.32, 14); colorize(stalk, () => _c.set('#b9a67c'));
  const cap = mergeVertices(new THREE.SphereGeometry(1, 40, 20)); cap.scale(0.7, 0.3, 0.7);
  disp(cap, (v) => {
    const a = Math.atan2(v.z, v.x), rad = Math.hypot(v.x, v.z) / 0.7;
    const fold = 1 + rad * (0.22 * (noise3(Math.cos(a) * 2.2 + seed, Math.sin(a) * 2.2, seed) - 0.5) * 2 + 0.14 * (noise3(Math.cos(a) * 5 + 3, Math.sin(a) * 5, seed) - 0.5) * 2);
    v.x *= fold; v.z *= fold;
    if (v.y > 0) v.y += 0.035 * noise3(v.x * 9, v.z * 9, 1) + 0.012 * noise3(v.x * 40, v.z * 40, 2); else v.y *= 0.5;
    v.y -= 0.1 * rad * rad + 0.06 * Math.pow(rad, 6);
  });
  cap.translate(0, 0.44, 0);
  const c0 = new THREE.Color('#d9c89c'), c1 = new THREE.Color('#a3ad74');
  colorize(cap, (v, n) => _c.copy(c0).lerp(c1, noise3(v.x * 3 + seed, v.z * 3, 0) * 0.7).multiplyScalar(n.y > 0 ? 1 : 0.7).offsetHSL(0, 0, (noise3(v.x * 45, v.y * 45, v.z * 45) - 0.5) * 0.1));
  const g = unify([stalk, cap]); swayAttr(g, (v) => clamp((v.y - 0.3) / 0.3, 0, 0.35)); return g;
}

// ---------------------------------------------------------------- magnificent sea anemone (Heteractis magnifica)
export function anemone(seed) {
  srand(seed); const geos = [];
  const column = new THREE.CylinderGeometry(0.42, 0.36, 0.28, 24, 1); column.translate(0, 0.14, 0); colorize(column, (v) => _c.set('#b03a7a').offsetHSL(0, 0, (noise3(v.x * 10, v.y * 10, v.z * 10) - 0.5) * 0.15)); geos.push(column);
  const disc = new THREE.CircleGeometry(0.44, 32); disc.rotateX(-Math.PI / 2); disc.translate(0, 0.285, 0); colorize(disc, () => _c.set('#c9b48e')); geos.push(disc);
  const body = new THREE.Color('#d8c6a2'), tipC = new THREE.Color('#c8488a');
  for (let i = 0; i < 150; i++) {
    const a = rnd() * TAU, rad = Math.sqrt(rnd()) * 0.4, len = rr(0.24, 0.4);
    const p = new THREE.Vector3(Math.cos(a) * rad, 0.28, Math.sin(a) * rad);
    const dir = new THREE.Vector3(Math.cos(a) * rad * 1.3 + rr(-0.25, 0.25), 0.7 + rr(-0.2, 0.3), Math.sin(a) * rad * 1.3 + rr(-0.25, 0.25)).normalize();
    const g = tube(0.028, 0.02, len, 5); orient(g, p, dir);
    const cap = new THREE.SphereGeometry(0.026, 6, 5); const e = p.clone().addScaledVector(dir, len); cap.translate(e.x, e.y, e.z); colorize(cap, () => _c.copy(tipC));
    colorize(g, (v, n, u, vv) => _c.copy(body).lerp(tipC, smoothstep(0.6, 1, vv)));
    swayAttr(g, (v, vv) => vv * vv); swayAttr(cap, () => 1);
    geos.push(g, cap);
  }
  return unify(geos);
}

// ---------------------------------------------------------------- barrel sponge (Xestospongia): ridged, hollow barrel
export function barrelSponge(seed) {
  srand(seed);
  const pts = [[0.28, 0], [0.44, 0.1], [0.56, 0.4], [0.64, 0.85], [0.7, 1.3], [0.68, 1.4], [0.54, 1.4], [0.5, 1.1], [0.44, 0.7], [0.3, 0.4], [0, 0.35]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 40);
  disp(g, (v) => { const a = Math.atan2(v.z, v.x), r = Math.hypot(v.x, v.z); if (r > 0.3 && v.y < 1.36) { const k = 1 + 0.13 * Math.sin(a * 12 + v.y * 2.5 + seed) + 0.07 * (noise3(Math.cos(a) * 3, v.y * 3, Math.sin(a) * 3 + seed) - 0.5) * 2; v.x *= k; v.z *= k; } if (v.y > 1.3) v.y += 0.08 * (noise3(Math.cos(a) * 2, 0, Math.sin(a) * 2 + seed) - 0.5); });
  const out = new THREE.Color().setHSL(0.02 + rr(-0.02, 0.05), 0.55, 0.3), inn = new THREE.Color('#3a2520'), rim = new THREE.Color('#c8907a');
  colorize(g, (v) => { const r = Math.hypot(v.x, v.z); const inside = v.y > 0.35 && r < 0.56 ? 1 : 0; return _c.copy(out).lerp(rim, smoothstep(1.1, 1.4, v.y) * 0.5).lerp(inn, inside * 0.8).offsetHSL(0, 0, (noise3(v.x * 12, v.y * 12, v.z * 12) - 0.5) * 0.14); });
  return mergeVertices(g);
}

// ---------------------------------------------------------------- giant clam (Tridacna maxima): valves hinged at the base, blue mantle in the gape
// returns { valve, mantle } geometries; the valve is built un-tilted with the hinge at the origin, tilt it with rotation.x = +-0.3
export function giantClam(seed) {
  srand(seed);
  const valve = mergeVertices(new THREE.SphereGeometry(0.5, 36, 18, 0, Math.PI)); valve.scale(1, 0.7, 0.42);
  disp(valve, (v) => { if (v.z < 0.03) { const a = Math.atan2(v.y, v.x); const sc = 1 + 0.07 * Math.sin(a * 7 + seed) + 0.03 * Math.sin(a * 15); v.x *= sc; v.y *= sc; } else { const a = Math.atan2(v.y, v.x); v.z *= 1 + 0.08 * Math.sin(a * 7 + seed); } });
  valve.translate(0, 0.35, 0);
  const shellC = new THREE.Color('#ddd6c4'), shellD = new THREE.Color('#9a9080');
  colorize(valve, (v) => _c.copy(shellC).lerp(shellD, noise3(v.x * 6, v.y * 6, v.z * 6 + seed) * 0.8).offsetHSL(0, 0, (noise3(v.x * 30, v.y * 30, v.z * 30) - 0.5) * 0.1));
  const mantle = new THREE.PlaneGeometry(1.0, 0.44, 56, 8); mantle.rotateX(-Math.PI / 2);
  disp(mantle, (v) => { const t = v.x / 0.5; const w = Math.sqrt(Math.max(0.02, 1 - t * t)); v.z *= w * (1 + 0.12 * Math.sin(v.x * 23 + seed)); v.y = 0.66 - 0.5 * v.z * v.z + 0.03 * Math.sin(v.x * 17 + seed) * w; });
  const blue = new THREE.Color('#12b8d2'), dark = new THREE.Color('#0a3860'), green = new THREE.Color('#4fd090'), gold = new THREE.Color('#c7b35a');
  colorize(mantle, (v) => { const n = noise3(v.x * 28 + seed, v.z * 28, 0), m = noise3(v.x * 5, 0, seed); return _c.copy(blue).lerp(green, m * 0.6).lerp(gold, Math.max(0, noise3(v.x * 9, 0, seed + 3) - 0.6) * 1.5).lerp(dark, n > 0.6 ? 0.9 : 0); });
  return { valve, mantle };
}

// ---------------------------------------------------------------- Christmas tree worm (Spirobranchus): two spiral crowns, 4 cm tall
export function christmasTreeWorm(seed) {
  srand(seed); const geos = [];
  const hue = [0.58, 0.08, 0.14, 0.0, 0.75][seed % 5], col = new THREE.Color().setHSL(hue, 0.8, 0.5), pale = new THREE.Color().setHSL(hue, 0.5, 0.85);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 70; i++) {
      const t = i / 70, a = t * TAU * 4.5, r = 0.028 * (1 - t) + 0.003, y = t * 0.045;
      const p = new THREE.Vector3(s * 0.02 + Math.cos(a) * r * 0.3, y, Math.sin(a) * r * 0.3);
      const dir = new THREE.Vector3(Math.cos(a), 0.25, Math.sin(a)).normalize();
      const g = tube(0.0022, 0.0008, r, 3); orient(g, p, dir); colorize(g, (v, n, u, vv) => _c.copy(col).lerp(pale, vv * 0.5)); geos.push(g);
    }
    const stalk = tube(0.006, 0.005, 0.05, 6); stalk.translate(s * 0.02, 0, 0); colorize(stalk, () => _c.copy(col).multiplyScalar(0.7)); geos.push(stalk);
  }
  return unify(geos);
}

// ---------------------------------------------------------------- seagrass (Thalassia) blade, instanced by the thousand
export function seagrassBlade() {
  const g = new THREE.PlaneGeometry(0.035, 0.4, 1, 4); g.translate(0, 0.2, 0);
  disp(g, (v) => { v.x *= 1 - 0.5 * Math.pow(v.y / 0.4, 3); });
  const lo = new THREE.Color('#2f6b2c'), hi = new THREE.Color('#7fbf4e');
  colorize(g, (v) => _c.copy(lo).lerp(hi, v.y / 0.4)); swayAttr(g, (v) => Math.pow(v.y / 0.4, 1.8));
  return g;
}

// ---------------------------------------------------------------- Halimeda: chains of flat green segments
export function halimeda(seed) {
  srand(seed); const geos = []; const col = new THREE.Color('#8fbb66'), col2 = new THREE.Color('#5f9a4a');
  const nCh = 4 + (rnd() * 3 | 0);
  for (let c = 0; c < nCh; c++) {
    let p = new THREE.Vector3(rr(-0.03, 0.03), 0, rr(-0.03, 0.03)), dir = new THREE.Vector3(rr(-0.6, 0.6), 1, rr(-0.6, 0.6)).normalize();
    for (let i = 0; i < 6 + (rnd() * 4 | 0); i++) {
      const seg = new THREE.CylinderGeometry(0.022, 0.018, 0.005, 10, 1); seg.scale(1, 1, 0.6);
      const q = new THREE.Quaternion().setFromUnitVectors(UP, dir); seg.applyQuaternion(q); seg.rotateY(rnd() * 3);
      seg.translate(p.x, p.y + 0.012, p.z); colorize(seg, () => _c.copy(col).lerp(col2, rnd() * 0.6)); geos.push(seg);
      p.addScaledVector(dir, 0.04); dir.x += rr(-0.4, 0.4); dir.z += rr(-0.4, 0.4); dir.y += rr(-0.1, 0.3); dir.normalize();
    }
  }
  return unify(geos);
}

// ---------------------------------------------------------------- coralline algae: pink knobby crust
export function corallinePatch(seed) {
  srand(seed);
  const g = mergeVertices(new THREE.SphereGeometry(1, 36, 18)); g.scale(0.3, 0.06, 0.26);
  disp(g, (v) => { const a = Math.atan2(v.z, v.x); const k = 1 + 0.25 * (noise3(Math.cos(a) * 2, Math.sin(a) * 2, seed) - 0.5) * 2; v.x *= k; v.z *= k; if (v.y > 0) v.y += 0.02 * noise3(v.x * 25, v.z * 25, seed) + 0.012 * Math.max(0, noise3(v.x * 60, v.z * 60, 2) - 0.6) * 5; });
  const pink = new THREE.Color('#c98aa8'), pale = new THREE.Color('#e9c6d5');
  colorize(g, (v) => _c.copy(pink).lerp(pale, noise3(v.x * 30, v.z * 30, seed)));
  return g;
}

// ---------------------------------------------------------------- rubble stone (dead coral)
export function rubble(seed) {
  srand(seed);
  const g = mergeVertices(new THREE.IcosahedronGeometry(0.5, 1));
  disp(g, (v) => v.multiplyScalar(1 + (noise3(v.x * 3 + seed, v.y * 3, v.z * 3) - 0.5) * 0.6).multiply(_n.set(1, rr(0.5, 0.8), rr(0.7, 1.2))));
  colorize(g, (v) => _c.set('#cfc6b1').offsetHSL(0, 0, (noise3(v.x * 10, v.y * 10, v.z * 10) - 0.5) * 0.2));
  return g;
}

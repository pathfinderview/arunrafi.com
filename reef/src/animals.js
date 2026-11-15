// Procedural builders for the non-fish animals of the reef. Every builder returns a BufferGeometry (or an object of named
// geometries) in local space with a `color` attribute and a `sw` sway-weight attribute (0..1). Swimmers face +x, +y is up,
// centred at the origin; bottom dwellers have their base at the origin. Units are metres. No textures: everything is maths.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { srand, rnd, rr, noise3, fbm3, clamp, lerp, smoothstep, hash2, hash3 } from './noise.js';
import { colorize } from './corals.js';

const UP = new THREE.Vector3(0, 1, 0), TAU = Math.PI * 2, PI = Math.PI;
const _c = new THREE.Color(), _v = new THREE.Vector3(), _n = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const C = (h) => new THREE.Color(h);
const sat = (x) => clamp(x, 0, 1);

// ---------------------------------------------------------------- helpers (private equivalents of the corals.js ones)
// sway weight from a function of position
function sway(geo, fn) { const p = geo.attributes.position, out = new Float32Array(p.count); for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); out[i] = sat(fn(_v, i)); } geo.setAttribute('sw', new THREE.BufferAttribute(out, 1)); return geo; }
// give every piece the same attribute set, then merge into one non-indexed geometry
function unify(geos) {
  for (const g of geos) {
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.color) colorize(g, () => _c.set('#ffffff'));
    if (!g.attributes.sw) g.setAttribute('sw', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
    if (g.index) { const ng = g.toNonIndexed(); g.copy(ng); }
  }
  return mergeGeometries(geos, false);
}
function tube(r0, r1, len, seg = 6) { const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1); g.translate(0, len / 2, 0); return g; }
function orient(g, p, dir) { const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()); g.applyQuaternion(q); g.translate(p.x, p.y, p.z); return g; }
const disp = (geo, fn) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); fn(_v, i); p.setXYZ(i, _v.x, _v.y, _v.z); } geo.computeVertexNormals(); return geo; };

// smooth profile through [[u, value], ...] (cubic Hermite with Catmull-Rom tangents, clamped outside)
function prof(pts) {
  const n = pts.length;
  return (u) => {
    if (u <= pts[0][0]) return pts[0][1]; if (u >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0; while (i < n - 2 && u > pts[i + 1][0]) i++;
    const [u0, v0] = pts[i], [u1, v1] = pts[i + 1], d = u1 - u0, t = (u - u0) / d;
    const m0 = i > 0 ? (v1 - pts[i - 1][1]) / (u1 - pts[i - 1][0]) * d : (v1 - v0), m1 = i < n - 2 ? (pts[i + 2][1] - v0) / (pts[i + 2][0] - u0) * d : (v1 - v0);
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * v0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * v1 + (t3 - t2) * m1;
  };
}
// ascending station list between x0 and x1; cosine spacing packs stations toward both ends (rounded noses), extras are inserted
function stations(n, x0, x1, extra = [], cos = false) {
  const s = [];
  for (let i = 0; i <= n; i++) { const t = i / n; s.push(x0 + (x1 - x0) * (cos ? 0.5 - 0.5 * Math.cos(PI * t) : t)); }
  for (const e of extra) s.push(e);
  s.sort((a, b) => a - b); return s;
}
// flip the winding so normals point outward (closed shapes: signed volume about the centroid; open shapes: pass a reference direction)
function orientGeo(g, out) {
  const p = g.attributes.position, idx = g.index.array, c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) c.add(_v.fromBufferAttribute(p, i)); c.divideScalar(p.count);
  let s = 0;
  for (let i = 0; i < idx.length; i += 3) {
    _a.fromBufferAttribute(p, idx[i]).sub(c); _b.fromBufferAttribute(p, idx[i + 1]).sub(c); _n.fromBufferAttribute(p, idx[i + 2]).sub(c);
    _v.crossVectors(_b.sub(_a), _n.sub(_a)); s += out ? _v.dot(out) : _v.dot(_a);
  }
  if (s < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
}
// parametric surface closed around v: fn(u, v, out) for u in [0,1] (along, uv.x) and v in [0,1) (around, uv.y); 2*nu*nv triangles
function surface(nu, nv, fn, out) {
  const N = (nu + 1) * nv, pos = new Float32Array(N * 3), uv = new Float32Array(N * 2), idx = [], p = new THREE.Vector3();
  for (let i = 0; i <= nu; i++) for (let j = 0; j < nv; j++) { const k = i * nv + j; fn(i / nu, j / nv, p); pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; uv[k * 2] = i / nu; uv[k * 2 + 1] = j / nv; }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * nv + j, b = a + nv, a1 = i * nv + (j + 1) % nv, b1 = a1 + nv; idx.push(a, b, a1, a1, b, b1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  orientGeo(g, out); g.computeVertexNormals(); return g;
}
// body along +x through the x stations st: w(x) half-width (z), h(x) half-height (y), cy(x) centreline height, shape(x, a, sin, cos) radial multiplier
function loft(st, nv, w, h, cy, shape) {
  const nu = st.length - 1;
  return surface(nu, nv, (u, v, p) => { const x = st[Math.round(u * nu)], a = v * TAU, s = Math.sin(a), c = Math.cos(a), k = shape ? shape(x, a, s, c) : 1; p.set(x, (cy ? cy(x) : 0) + Math.max(0, h(x)) * s * k, Math.max(0, w(x)) * c * k); });
}
// tube along a Catmull-Rom path with parallel-transport frames; rw(u)/rh(u) side/dorsal radii, opt.up = dorsal reference, opt.shape(u, a)
function pathLoft(pts, nu, nv, rw, rh, opt = {}) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5), P = [], T = [], N = [], B = [];
  for (let i = 0; i <= nu; i++) { const u = i / nu; P.push(curve.getPointAt(u)); T.push(curve.getTangentAt(u).normalize()); }
  let n0 = (opt.up || UP).clone(); n0.addScaledVector(T[0], -n0.dot(T[0])); if (n0.lengthSq() < 1e-6) n0.set(1, 0, 0).cross(T[0]); n0.normalize();
  for (let i = 0; i <= nu; i++) { if (i > 0) n0 = n0.clone().addScaledVector(T[i], -n0.dot(T[i])).normalize(); N.push(n0); B.push(new THREE.Vector3().crossVectors(T[i], n0).normalize()); }
  const g = surface(nu, nv, (u, v, p) => { const i = Math.round(u * nu), a = v * TAU, s = Math.sin(a), c = Math.cos(a), k = opt.shape ? opt.shape(u, a, s, c) : 1; p.copy(P[i]).addScaledVector(N[i], Math.max(0, rh(u)) * s * k).addScaledVector(B[i], Math.max(0, rw(u)) * c * k); });
  g.userData.frames = { P, T, N, B }; return g;
}
// thin fin as a closed surface: root p0, span along dir (length L), chord along cd (unit, leading -> trailing), le(u)/te(u) chord offsets,
// th(u) half-thickness; col(u, q, p, n) colour with q = chord fraction 0 (leading edge) .. 1 (trailing edge)
function fin(o) {
  const d = o.dir.clone().normalize(), c = o.cd.clone().normalize(), n = new THREE.Vector3().crossVectors(d, c).normalize(), nu = o.nu || 8, nv = o.nv || 8;
  const g = surface(nu, nv, (u, v, p) => {
    const a = v * TAU, q = 0.5 - 0.5 * Math.cos(a), l = o.le(u), ch = l + (o.te(u) - l) * q, tk = o.th(u) * Math.sin(a) * (0.55 + 0.9 * (1 - q));
    p.copy(o.p0).addScaledVector(d, u * o.L).addScaledVector(c, ch).addScaledVector(n, tk);
  });
  if (o.col) colorize(g, (p, nn, u, v) => o.col(u, 0.5 - 0.5 * Math.cos(v * TAU), p, nn));
  return g;
}
// small coloured sphere (eyes, nubs)
function ball(p, r, col, ws = 7, hs = 5) { const g = new THREE.SphereGeometry(r, ws, hs); g.translate(p.x, p.y, p.z); colorize(g, () => _c.copy(col)); return g; }
const EYE = C('#0c0a08');
// lighten/tint the vertices of geo within rad of each centre (eye rings, mouth corners)
function ringAround(geo, centres, rad, col, k = 0.8) {
  const p = geo.attributes.position, c = geo.attributes.color;
  for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); for (const e of centres) { const d = _v.distanceTo(e); if (d < rad) { _c.setRGB(c.getX(i), c.getY(i), c.getZ(i)).lerp(col, k * smoothstep(rad, rad * 0.3, d)); c.setXYZ(i, _c.r, _c.g, _c.b); } } }
  return geo;
}
// many 3-sided spikes in one geometry: list of { p, dir, r, len, c0, c1 }
function spikes(list) {
  const pos = [], col = [], q = new THREE.Quaternion(), base = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], tip = new THREE.Vector3();
  for (const s of list) {
    q.setFromUnitVectors(UP, _v.copy(s.dir).normalize()); tip.set(0, s.len, 0).applyQuaternion(q).add(s.p);
    for (let k = 0; k < 3; k++) { const a = k / 3 * TAU; base[k].set(Math.cos(a) * s.r, 0, Math.sin(a) * s.r).applyQuaternion(q).add(s.p); }
    for (let k = 0; k < 3; k++) { const b0 = base[k], b1 = base[(k + 1) % 3]; pos.push(b1.x, b1.y, b1.z, b0.x, b0.y, b0.z, tip.x, tip.y, tip.z); col.push(s.c0.r, s.c0.g, s.c0.b, s.c0.r, s.c0.g, s.c0.b, s.c1.r, s.c1.g, s.c1.b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
// hash-grid spot coverage 0..1 (1 inside a spot) for dotted patterns
function dots(x, z, cell, rad, off = 0) {
  const ix = Math.floor(x / cell), iz = Math.floor(z / cell);
  const cx = (ix + 0.25 + 0.5 * hash2(ix + off, iz)) * cell, cz = (iz + 0.25 + 0.5 * hash2(ix + 3, iz + off + 7)) * cell;
  return smoothstep(rad, rad * 0.45, Math.hypot(x - cx, z - cz));
}
// contour lines of a noise field: 1 on the lines (plate / scale seams)
const seams = (x, y, z, k, w = 0.035) => smoothstep(w, w * 0.4, Math.abs(noise3(x * k, y * k, z * k) - 0.5));
const grain = (p, k, amt) => (noise3(p.x * k, p.y * k, p.z * k) - 0.5) * amt;
// body sway along x: 0 at xHead, 1 at xTail
const swX = (xHead, xTail, pow = 1.6) => (p) => Math.pow(sat((p.x - xHead) / (xTail - xHead)), pow);

// ---------------------------------------------------------------- sea turtles (hawksbill and green share one builder)
// returns { body, flipperFront, flipperRear }; flippers have their root at the origin and point along +z (right side)
function turtle(seed, P) {
  srand(seed);
  const L = P.L, A = L / 2, W = P.W * L, H = P.H * L, D = 0.055 * L, hs = P.heart, nv = P.nv;
  const outline = (phi) => { const cs = Math.cos(phi), sn = Math.sin(phi); return (1 + hs * cs) / Math.sqrt((cs * cs) / (A * A) + (sn * sn) / (W * W)); };
  const hwAt = (x) => Math.max(0.01, W * Math.sqrt(Math.max(0, 1 - Math.pow(x / (A * (1 + hs * Math.sign(x))), 2))));
  const NT = 10, NU = 15;
  const shell = surface(NU, nv, (u, v, p) => {
    const i = Math.round(u * NU), phi = v * TAU, cs = Math.cos(phi), top = i <= NT;
    const rf = top ? Math.pow(i / NT, 0.8) : 1 - (i - NT) / (NU - NT);
    let r = outline(phi) * rf, y;
    const notch = P.serr * smoothstep(-0.15, -0.6, cs) * Math.abs(((phi * 12 / TAU) % 1) - 0.5) * 2 * Math.pow(rf, 10);
    r *= 1 - notch;
    if (top) { y = H * Math.pow(1 - Math.pow(rf, P.domeK), P.domeP) - 0.012 * L * rf; y += 0.01 * L * Math.exp(-Math.pow(Math.sin(phi) * r / (0.05 * L), 2)) * (1 - rf * rf) * P.keel; }
    else y = -D * (1 - rf * rf) * (0.4 + 0.6 * (1 - Math.abs(cs) * 0.5)) - 0.012 * L * rf;
    p.set(r * cs, y, r * Math.sin(phi));
  });
  disp(shell, (v) => { v.y += grain(v, 25 / L, 0.004 * L); });
  // scute cells: row 0 vertebral (5), row 1 costal (4 per side), row 2 marginal (around the rim)
  const scute = (x, z) => {
    const zz = Math.abs(z) / hwAt(x), side = z < 0 ? 37 : 0, xn = (x / A + 1) / 2;
    if (zz < 0.22) { const c = xn * 5; return [0, Math.floor(c), c % 1, zz / 0.22, side]; }
    if (zz < 0.76) { const c = xn * 4 + 0.5; return [1, Math.floor(c), c % 1, (zz - 0.22) / 0.54, side]; }
    const c = (Math.atan2(Math.abs(z), x) / PI) * 11; return [2, Math.floor(c), c % 1, (zz - 0.76) / 0.24, side];
  };
  const top0 = C(P.col.top0), top1 = C(P.col.top1), top2 = C(P.col.top2), pale = C(P.col.pale), seam = C(P.col.seam), plast = C(P.col.plastron), rim = C(P.col.rim);
  colorize(shell, (p, n) => {
    const [row, cell, lx, ly, side] = scute(p.x, p.z), h = hash2(row * 13 + cell + side, seed % 97);
    const ang = Math.atan2(ly + 0.08, lx + 0.08), dist = Math.hypot(lx, ly);
    let k;
    if (P.streakStyle === 'tortoise') { const s = noise3(ang * 5.5 + h * 40, dist * 2.4 + h * 9, cell * 1.7 + row); _c.copy(top0).lerp(top1, smoothstep(0.42, 0.6, s)).lerp(top2, smoothstep(0.62, 0.75, s)).lerp(pale, smoothstep(0.34, 0.2, s) * 0.8); }
    else { const s = 0.5 + 0.5 * Math.sin(ang * 15 + h * 30 + dist * 2) * (0.6 + 0.4 * noise3(lx * 6, ly * 6, h * 10)); _c.copy(top0).lerp(top1, noise3(p.x * 9, p.z * 9, h * 5) * 0.7).lerp(top2, smoothstep(0.62, 0.9, s) * (0.3 + 0.7 * dist)); }
    const edge = Math.min(lx, 1 - lx, ly * 1.5, (1 - ly) * 1.5); _c.lerp(seam, smoothstep(0.1, 0.03, edge) * P.seamK);
    _c.offsetHSL(0, 0, grain(p, 60 / L, 0.08));
    k = smoothstep(-0.02 * L, 0.012 * L, p.y); // plastron below, rim between
    const rimK = (1 - k) * smoothstep(-0.05 * L, -0.02 * L, p.y);
    return _c.lerp(plast, (1 - k)).lerp(rim, rimK * 0.5);
  });
  // head and neck: one loft from inside the shell front to the beak tip
  const hd = P.head, x0 = A * 0.72, xt = A + hd.len;
  const st = stations(13, x0, xt, [], true);
  const w = prof([[x0, hd.neck], [A * 0.95, hd.neck], [A + hd.len * 0.45, hd.w], [A + hd.len * 0.8, hd.w * 0.62], [xt - hd.len * 0.07, hd.w * 0.22], [xt, 0]]);
  const h = prof([[x0, hd.neck * 0.9], [A * 0.95, hd.neck * 0.9], [A + hd.len * 0.4, hd.w * 0.95], [A + hd.len * 0.8, hd.w * 0.55], [xt - hd.len * 0.07, hd.w * 0.2], [xt, 0]]);
  const cy = (x) => hd.y0 - hd.droop * smoothstep(A + hd.len * 0.4, xt, x) + hd.rise * smoothstep(A * 0.8, A + hd.len * 0.3, x);
  const head = loft(st, 12, w, h, cy, (x, a, s) => 1 - 0.12 * Math.max(0, -s) * smoothstep(A, A + hd.len * 0.5, x));
  const skin = C(P.col.skin), skinD = C(P.col.skinDark), skinS = C(P.col.skinSeam), beak = C(P.col.beak);
  colorize(head, (p, n) => {
    const headK = smoothstep(A * 0.95, A + hd.len * 0.2, p.x);
    _c.copy(skinD).lerp(skin, 0.35 + 0.65 * headK * sat(0.5 + n.y)).lerp(skinS, seams(p.x, p.y, p.z, 55 / L) * headK * 0.8);
    _c.lerp(beak, smoothstep(xt - hd.len * 0.35, xt - hd.len * 0.15, p.x));
    return _c.offsetHSL(0, 0, grain(p, 90 / L, 0.1));
  });
  const ex = A + hd.len * 0.42, ey = cy(ex) + h(ex) * 0.45, ez = w(ex) * 0.92;
  const eyes = [new THREE.Vector3(ex, ey, ez), new THREE.Vector3(ex, ey, -ez)];
  ringAround(head, eyes, hd.w * 0.5, C(P.col.eyeRing), 0.7);
  const tail = tube(0.03 * L, 0.004 * L, 0.11 * L, 7); orient(tail, new THREE.Vector3(-A * (1 - hs) + 0.02 * L, -0.03 * L, 0), new THREE.Vector3(-1, -0.25, 0)); colorize(tail, () => _c.copy(skinD));
  const body = unify([shell, head, tail, ball(eyes[0], hd.w * 0.2, EYE), ball(eyes[1], hd.w * 0.2, EYE)]);
  // flippers: root at the origin, span along +z, chord along -x (leading edge forward)
  const fl = (len, c0, sweep, broad, tip, nu, nv2) => {
    const chord = (u) => c0 * (1 + broad * Math.sin(PI * u)) * Math.sqrt(Math.max(0, 1 - Math.pow(u, tip))), sw = (u) => sweep * Math.pow(u, 1.3);
    const g = fin({ p0: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(0, 0, 1), cd: new THREE.Vector3(-1, 0, 0), L: len, le: (u) => sw(u) - chord(u) / 2, te: (u) => sw(u) + chord(u) / 2, th: (u) => 0.028 * L * Math.pow(1 - u, 0.6) + 0.003 * L, nu, nv: nv2,
      col: (u, q, p, n) => {
        if (n.y < -0.1) return _c.copy(plast).lerp(skinD, 0.15 * smoothstep(0.1, 0.9, u) + grain(p, 40 / L, 0.3) + 0.15).offsetHSL(0, 0, grain(p, 50 / L, 0.06));
        const cell = hash2(Math.floor(u * 9), Math.floor(q * 4 + u * 2)), sm = seams(p.x, p.y, p.z, 70 / L, 0.05);
        return _c.copy(skinD).lerp(top0, cell * 0.8 * P.flipperAmber).lerp(top1, smoothstep(0.6, 0.8, hash2(Math.floor(u * 9) + 5, Math.floor(q * 4))) * 0.6).lerp(skinS, sm * 0.7).offsetHSL(0, 0, grain(p, 90 / L, 0.1)).lerp(skin, (1 - n.y) * 0.1);
      } });
    return sway(unify([g]), (p) => Math.pow(sat(p.z / len), 1.5));
  };
  const flipperFront = fl(P.fl.len * L, P.fl.c0 * L, P.fl.sweep * L, 0.4, 2.6, 14, 12);
  const flipperRear = fl(P.rl.len * L, P.rl.c0 * L, P.rl.sweep * L, 0.5, 3.2, 10, 12);
  return { body, flipperFront, flipperRear };
}

export function hawksbillTurtle(seed) {
  return turtle(seed, { L: 0.8, W: 0.37, H: 0.2, heart: 0.08, nv: 64, serr: 0.06, domeK: 2.3, domeP: 0.55, keel: 1, streakStyle: 'tortoise', seamK: 0.6, flipperAmber: 1,
    col: { top0: '#b4702a', top1: '#4a2a14', top2: '#160d08', pale: '#e8d08c', seam: '#d9bf7e', plastron: '#eadcb4', rim: '#c69a4c', skin: '#9a7a44', skinDark: '#5a4426', skinSeam: '#e6d6a4', beak: '#d8c28a', eyeRing: '#e9d9a8' },
    head: { len: 0.19, neck: 0.042, w: 0.05, y0: 0.0, droop: 0.045, rise: 0.02 }, fl: { len: 0.5, c0: 0.14, sweep: 0.26 }, rl: { len: 0.27, c0: 0.16, sweep: 0.09 } });
}
export function greenTurtle(seed) {
  return turtle(seed, { L: 1.0, W: 0.41, H: 0.21, heart: 0.04, nv: 48, serr: 0.0, domeK: 2.0, domeP: 0.62, keel: 0, streakStyle: 'rays', seamK: 0.45, flipperAmber: 0.3,
    col: { top0: '#5e5a38', top1: '#3e4a2c', top2: '#a89a62', pale: '#b8b088', seam: '#2e2c1c', plastron: '#e6dfc4', rim: '#8c8858', skin: '#6f6a48', skinDark: '#4a4830', skinSeam: '#d9d2a6', beak: '#b8b08a', eyeRing: '#d6cfa6' },
    head: { len: 0.17, neck: 0.055, w: 0.062, y0: 0.01, droop: 0.02, rise: 0.02 }, fl: { len: 0.48, c0: 0.15, sweep: 0.22 }, rl: { len: 0.26, c0: 0.17, sweep: 0.07 } });
}

// ---------------------------------------------------------------- blacktip reef shark (Carcharhinus melanopterus), 1.4 m
export function blacktipReefShark(seed) {
  srand(seed);
  const xs = 0.7, xp = -0.42, gx = [0.32, 0.348, 0.376, 0.404, 0.432], extra = [];
  for (const g of gx) extra.push(g - 0.0045, g + 0.0045);
  const st = stations(30, xp, xs, extra, true);
  const w = prof([[xp, 0.024], [-0.25, 0.055], [0.0, 0.09], [0.2, 0.1], [0.4, 0.086], [0.55, 0.06], [0.65, 0.032], [0.69, 0.012], [xs, 0]]);
  const h = prof([[xp, 0.04], [-0.25, 0.075], [0.0, 0.12], [0.2, 0.125], [0.4, 0.1], [0.55, 0.062], [0.65, 0.028], [0.69, 0.01], [xs, 0]]);
  const cy = (x) => -0.012 * smoothstep(0.4, xs, x);
  const body = loft(st, 16, w, h, cy, (x, a, s) => 1 - 0.1 * Math.pow(Math.max(0, -s), 2));
  const top = C('#6b6a5f'), belly = C('#efeee6'), dark = C('#45443d'), black = C('#101010'), gill = C('#2b2a27');
  colorize(body, (p, n) => {
    const yy = (p.y - cy(p.x)) / Math.max(0.005, h(p.x)), ax = Math.abs(p.z) / Math.max(0.005, w(p.x));
    _c.copy(belly).lerp(top, smoothstep(-0.45, 0.1, yy));
    const band = smoothstep(-0.55, -0.4, yy) * smoothstep(0.02, -0.12, yy) * smoothstep(-0.42, -0.3, p.x) * smoothstep(0.52, 0.42, p.x);
    _c.lerp(belly, band * 0.9).lerp(dark, smoothstep(-0.12, 0.0, yy) * smoothstep(0.25, 0.05, yy) * smoothstep(-0.42, -0.3, p.x) * smoothstep(0.52, 0.42, p.x) * 0.6);
    for (const g of gx) if (Math.abs(p.x - g) < 0.004 && yy > -0.55 && yy < 0.4 && ax > 0.35) _c.lerp(gill, 0.85);
    const mouth = Math.abs(p.x - (0.6 - 0.09 * ax * ax)) < 0.012 && yy < -0.55 && p.x > 0.45; if (mouth) _c.lerp(black, 0.7);
    return _c.offsetHSL(0, 0, grain(p, 18, 0.05));
  });
  const ex = 0.5, eyes = [new THREE.Vector3(ex, cy(ex) + h(ex) * 0.3, w(ex) * 0.92), new THREE.Vector3(ex, cy(ex) + h(ex) * 0.3, -w(ex) * 0.92)];
  ringAround(body, eyes, 0.03, C('#d9d6c8'), 0.6);
  const finCol = (tipAt, bandK) => (u, q, p, n) => { _c.copy(top).lerp(belly, smoothstep(0.3, -0.3, n.y) * 0.5); _c.lerp(belly, smoothstep(tipAt - 0.16, tipAt - 0.05, u) * smoothstep(tipAt + 0.02, tipAt - 0.02, u) * bandK); return _c.lerp(black, smoothstep(tipAt - 0.02, tipAt + 0.04, u)); };
  const yT = (x) => cy(x) + h(x), yB = (x) => cy(x) - h(x), geos = [body];
  geos.push(fin({ p0: new THREE.Vector3(0.14, yT(0.14) - 0.012, 0), dir: new THREE.Vector3(-0.55, 1, 0), cd: new THREE.Vector3(-1, 0, 0), L: 0.19, le: (u) => 0.01 * u, te: (u) => 0.21 * Math.pow(1 - u, 1.4) + 0.014, th: (u) => 0.013 * (1 - u) + 0.002, col: finCol(0.72, 0.9) }));
  geos.push(fin({ p0: new THREE.Vector3(-0.3, yT(-0.3) - 0.006, 0), dir: new THREE.Vector3(-0.6, 1, 0), cd: new THREE.Vector3(-1, 0, 0), L: 0.07, le: () => 0, te: (u) => 0.075 * Math.pow(1 - u, 1.2) + 0.006, th: (u) => 0.006 * (1 - u) + 0.0015, nu: 6, nv: 6, col: finCol(0.72, 0.5) }));
  geos.push(fin({ p0: new THREE.Vector3(-0.3, yB(-0.3) + 0.006, 0), dir: new THREE.Vector3(-0.6, -1, 0), cd: new THREE.Vector3(-1, 0, 0), L: 0.06, le: () => 0, te: (u) => 0.07 * Math.pow(1 - u, 1.2) + 0.006, th: (u) => 0.006 * (1 - u) + 0.0015, nu: 6, nv: 6, col: finCol(0.72, 0.4) }));
  for (const s of [1, -1]) {
    geos.push(fin({ p0: new THREE.Vector3(0.3, cy(0.3) - h(0.3) * 0.55, s * w(0.3) * 0.7), dir: new THREE.Vector3(-0.55, -0.35, s), cd: new THREE.Vector3(-1, 0, 0), L: 0.27, le: (u) => 0.05 * u * u, te: (u) => 0.05 * u * u + 0.16 * Math.pow(1 - u, 1.2) + 0.01, th: (u) => 0.012 * (1 - u) + 0.002, col: finCol(0.76, 0.6) }));
    geos.push(fin({ p0: new THREE.Vector3(-0.1, yB(-0.1) + 0.012, s * w(-0.1) * 0.55), dir: new THREE.Vector3(-0.6, -0.25, s), cd: new THREE.Vector3(-1, 0, 0), L: 0.1, le: (u) => 0.02 * u, te: (u) => 0.02 * u + 0.085 * Math.pow(1 - u, 1.1) + 0.008, th: (u) => 0.007 * (1 - u) + 0.0015, nu: 6, nv: 6, col: finCol(0.78, 0.3) }));
  }
  // heterocercal tail: long upper lobe, short black-tipped lower lobe
  geos.push(fin({ p0: new THREE.Vector3(xp + 0.01, cy(xp), 0), dir: new THREE.Vector3(-0.86, 0.5, 0), cd: new THREE.Vector3(-0.5, -0.86, 0), L: 0.37, le: (u) => -0.02 + 0.01 * u, te: (u) => 0.11 * Math.pow(1 - u, 0.7) + 0.012 + 0.025 * smoothstep(0.72, 0.84, u) * smoothstep(1, 0.9, u), th: (u) => 0.014 * (1 - u) + 0.002, nu: 10, nv: 8, col: finCol(0.9, 0.0) }));
  geos.push(fin({ p0: new THREE.Vector3(xp + 0.01, cy(xp), 0), dir: new THREE.Vector3(-0.68, -0.73, 0), cd: new THREE.Vector3(-0.73, 0.68, 0), L: 0.17, le: (u) => -0.015 + 0.01 * u, te: (u) => 0.1 * Math.pow(1 - u, 0.8) + 0.01, th: (u) => 0.012 * (1 - u) + 0.002, nu: 7, nv: 8, col: finCol(0.66, 0.0) }));
  geos.push(ball(eyes[0], 0.013, EYE), ball(eyes[1], 0.013, EYE));
  const g = unify(geos); return sway(g, swX(0.45, -0.75, 1.6));
}

// ---------------------------------------------------------------- reef manta (Mobula alfredi), 3.5 m span
export function reefManta(seed) {
  srand(seed);
  const S = 1.75, xLE = (z) => 0.78 - 0.96 * Math.pow(Math.max(0, (Math.abs(z) - 0.25) / (S - 0.25)), 1.3), xTE = (z) => -0.7 + 0.52 * Math.pow(Math.abs(z) / S, 0.85);
  const T = (z) => 0.13 * Math.pow(1 - Math.abs(z) / S, 1.3) + 0.004 + 0.07 * Math.exp(-Math.pow(z / 0.3, 2));
  const NU = 56;
  const disc = surface(NU, 20, (u, v, p) => {
    const z = -S + 2 * S * u, a = v * TAU, q = 0.5 - 0.5 * Math.cos(a), l = xLE(z), x = l + (xTE(z) - l) * q;
    const tk = T(z) * Math.sin(a) * (a < PI ? 1 : 0.55) * (0.7 + 0.3 * Math.sin(PI * q));
    p.set(x, tk, z);
  });
  const top = C('#1d2024'), topPale = C('#d4d8d6'), belly = C('#eef0ee'), spot = C('#2a2e33'), mouth = C('#141416');
  const spotCell = 0.14 + rr(-0.03, 0.03), spotR = 0.035 + rr(-0.01, 0.012), off = (seed % 13) * 3;
  colorize(disc, (p, n) => {
    const az = Math.abs(p.z), q = sat((p.x - xLE(p.z)) / (xTE(p.z) - xLE(p.z) || 1));
    if (n.y > -0.05) {
      _c.copy(top);
      const sh = smoothstep(0.28, 0.4, az) * smoothstep(1.0, 0.8, az) * smoothstep(0.02, 0.1, q) * smoothstep(0.42 - 0.2 * (az - 0.3), 0.3 - 0.2 * (az - 0.3), q) * smoothstep(0.35, 0.55, noise3(p.x * 3 + seed, p.z * 3, 0) + 0.3);
      _c.lerp(topPale, sh * 0.9);
      if (q < 0.05 && az < 0.27) _c.lerp(mouth, 0.9);
    } else {
      _c.copy(belly);
      const gl = az > 0.12 && az < 0.4 && q > 0.1 && q < 0.42 && ((q * 12 + az * 2) % 1) < 0.22; if (gl) _c.lerp(spot, 0.8);
      _c.lerp(spot, dots(p.x + off, p.z, spotCell, spotR, off) * smoothstep(0.1, 0.25, q) * (az < 1.3 ? 0.9 : 0.3));
      if (q < 0.05 && az < 0.27) _c.lerp(mouth, 0.9);
    }
    return _c.offsetHSL(0, 0, grain(p, 4, 0.04));
  });
  const geos = [disc], lobeD = C('#202326'), lobeW = C('#e8eae6');
  for (const s of [1, -1]) {
    const lobe = pathLoft([new THREE.Vector3(0.72, 0.0, s * 0.33), new THREE.Vector3(0.9, -0.01, s * 0.31), new THREE.Vector3(1.06, -0.03, s * 0.25)], 6, 8, (u) => 0.022 * (1 - 0.5 * u), (u) => 0.075 * (1 - 0.55 * u));
    colorize(lobe, (p, n) => _c.copy(n.z * s > 0.2 ? lobeD : lobeW)); geos.push(lobe);
    const e = new THREE.Vector3(0.66, 0.05, s * 0.37); geos.push(ball(e, 0.03, EYE)); ringAround(disc, [e], 0.09, topPale, 0.5);
  }
  geos.push(fin({ p0: new THREE.Vector3(-0.5, 0.1, 0), dir: new THREE.Vector3(-0.7, 1, 0), cd: new THREE.Vector3(-1, 0, 0), L: 0.11, le: () => 0, te: (u) => 0.12 * Math.pow(1 - u, 1.2) + 0.01, th: (u) => 0.01 * (1 - u) + 0.002, nu: 6, nv: 6, col: () => _c.copy(top) }));
  const tail = tube(0.026, 0.004, 0.62, 6); orient(tail, new THREE.Vector3(-0.68, 0, 0), new THREE.Vector3(-1, 0.02, 0)); colorize(tail, () => _c.copy(top)); geos.push(tail);
  const g = unify(geos); return sway(g, (p) => Math.pow(sat((Math.abs(p.z) - 0.2) / (S - 0.2)), 1.3));
}

// ---------------------------------------------------------------- spotted eagle ray (Aetobatus ocellatus), 1.8 m span, whip tail
export function eagleRay(seed) {
  srand(seed);
  const S = 0.9, xLE = (z) => 0.4 - 0.6 * Math.pow(Math.abs(z) / S, 1.05), xTE = (z) => -0.5 + 0.3 * Math.pow(Math.abs(z) / S, 0.9);
  const T = (z) => 0.05 * Math.pow(1 - Math.abs(z) / S, 1.4) + 0.003 + 0.05 * Math.exp(-Math.pow(z / 0.16, 2));
  const disc = surface(48, 16, (u, v, p) => {
    const z = -S + 2 * S * u, a = v * TAU, q = 0.5 - 0.5 * Math.cos(a), l = xLE(z), x = l + (xTE(z) - l) * q;
    p.set(x, T(z) * Math.sin(a) * (a < PI ? 1 : 0.6) * (0.75 + 0.25 * Math.sin(PI * q)), z);
  });
  const top = C('#1c2436'), topO = C('#2a3a34'), spot = C('#e6ecee'), belly = C('#eceeee');
  const topCol = (p, n) => { _c.copy(top).lerp(topO, noise3(p.x * 2 + seed, p.z * 2, 1) * 0.6); return _c.lerp(spot, dots(p.x, p.z + seed * 0.37, 0.085, 0.021, seed % 11) * smoothstep(-0.1, 0.1, n.y)); };
  colorize(disc, (p, n) => (n.y > -0.05 ? topCol(p, n) : _c.copy(belly)).offsetHSL(0, 0, grain(p, 6, 0.04)));
  // raised head with the duck-bill snout
  const st = stations(10, 0.16, 0.64, [], true);
  const w = prof([[0.16, 0.14], [0.3, 0.12], [0.42, 0.1], [0.52, 0.075], [0.6, 0.055], [0.64, 0]]), h = prof([[0.16, 0.05], [0.3, 0.06], [0.42, 0.055], [0.52, 0.03], [0.6, 0.016], [0.64, 0]]);
  const cy = (x) => 0.02 + 0.01 * smoothstep(0.2, 0.45, x) - 0.02 * smoothstep(0.5, 0.64, x);
  const head = loft(st, 12, w, h, cy, (x, a, s) => 1 - 0.15 * Math.max(0, -s));
  colorize(head, (p, n) => (n.y > 0.05 ? topCol(p, n) : _c.copy(belly)));
  const eyes = [new THREE.Vector3(0.42, cy(0.42) + 0.02, 0.1), new THREE.Vector3(0.42, cy(0.42) + 0.02, -0.1)];
  ringAround(head, eyes, 0.04, C('#9aa4b0'), 0.5);
  const tail = tube(0.018, 0.0025, 1.8, 6); orient(tail, new THREE.Vector3(-0.48, 0, 0), new THREE.Vector3(-1, 0.01, 0)); colorize(tail, (p) => _c.copy(top).lerp(belly, smoothstep(0.3, -0.3, p.y) * 0.5));
  const dorsal = fin({ p0: new THREE.Vector3(-0.5, 0.012, 0), dir: new THREE.Vector3(-0.8, 1, 0), cd: new THREE.Vector3(-1, 0, 0), L: 0.05, le: () => 0, te: (u) => 0.05 * (1 - u) + 0.006, th: (u) => 0.005 * (1 - u) + 0.001, nu: 4, nv: 6, col: () => _c.copy(top) });
  const g = unify([disc, head, tail, dorsal, ball(eyes[0], 0.018, EYE), ball(eyes[1], 0.018, EYE)]);
  return sway(g, (p) => Math.pow(sat((Math.abs(p.z) - 0.12) / (S - 0.12)), 1.3));
}

// ---------------------------------------------------------------- spinner dolphin (Stenella longirostris), 1.9 m
export function spinnerDolphin(seed) {
  srand(seed);
  const xf = -0.78, xs = 0.95, st = stations(38, xf, xs, [0.69, 0.715], true);
  const w = prof([[xf, 0.035], [-0.55, 0.06], [-0.3, 0.11], [0.0, 0.14], [0.3, 0.13], [0.55, 0.1], [0.67, 0.072], [0.7, 0.05], [0.73, 0.036], [0.82, 0.028], [0.92, 0.013], [xs, 0]]);
  const h = prof([[xf, 0.055], [-0.55, 0.08], [-0.3, 0.13], [0.0, 0.16], [0.3, 0.15], [0.55, 0.12], [0.67, 0.088], [0.7, 0.05], [0.73, 0.034], [0.82, 0.026], [0.92, 0.012], [xs, 0]]);
  const cy = (x) => -0.025 * smoothstep(0.62, 0.8, x);
  const body = loft(st, 16, w, h, cy, (x, a, s) => 1 - 0.06 * Math.pow(Math.max(0, -s), 2));
  const cape = C('#3b434d'), flank = C('#8e959b'), belly = C('#eef0f0'), lip = C('#2a3038');
  const eyeP = [new THREE.Vector3(0.6, cy(0.6) + 0.012, 0.075), new THREE.Vector3(0.6, cy(0.6) + 0.012, -0.075)];
  const flipRoot = [new THREE.Vector3(0.42, -0.09, 0.07), new THREE.Vector3(0.42, -0.09, -0.07)];
  const segDist = (p, a, b) => { _a.subVectors(b, a); const t = sat(_b.subVectors(p, a).dot(_a) / _a.lengthSq()); return _b.subVectors(p, _a.multiplyScalar(t).add(a)).length(); };
  const bodyCol = (p, n) => {
    const yy = (p.y - cy(p.x)) / Math.max(0.004, h(p.x)), capeLine = 0.2 - 0.5 * Math.exp(-Math.pow((p.x - 0.05) / 0.35, 2)) - 0.15 * smoothstep(0.5, 0.8, p.x);
    _c.copy(belly).lerp(flank, smoothstep(-0.5, -0.2, yy)).lerp(cape, smoothstep(capeLine - 0.12, capeLine + 0.08, yy));
    if (p.x > 0.7 && Math.abs(yy) < 0.18) _c.lerp(lip, 0.6);
    for (let i = 0; i < 2; i++) if (Math.sign(p.z) === (i ? -1 : 1) && segDist(p, eyeP[i], flipRoot[i]) < 0.014) _c.lerp(lip, 0.55);
    return _c.offsetHSL(0, 0, grain(p, 10, 0.03));
  };
  colorize(body, bodyCol); ringAround(body, eyeP, 0.025, C('#d7dadb'), 0.4);
  const finC = (u, q, p, n) => _c.copy(cape).lerp(flank, smoothstep(0.2, -0.4, n.y) * 0.4);
  const yT = (x) => cy(x) + h(x), geos = [body];
  geos.push(fin({ p0: new THREE.Vector3(0.03, yT(0.03) - 0.012, 0), dir: new THREE.Vector3(-0.4, 1, 0), cd: new THREE.Vector3(-1, 0, 0), L: 0.2, le: (u) => 0.03 * u * u, te: (u) => 0.03 * u * u + 0.17 * Math.pow(1 - u, 1.35) + 0.012, th: (u) => 0.012 * (1 - u) + 0.002, col: finC }));
  for (const s of [1, -1]) {
    geos.push(fin({ p0: flipRoot[s > 0 ? 0 : 1], dir: new THREE.Vector3(-0.5, -0.45, s), cd: new THREE.Vector3(-1, 0, 0), L: 0.24, le: (u) => 0.03 * u * u, te: (u) => 0.03 * u * u + 0.1 * Math.pow(1 - u, 1.2) + 0.008, th: (u) => 0.01 * (1 - u) + 0.002, col: (u, q, p, n) => _c.copy(cape).lerp(flank, smoothstep(0.2, -0.4, n.y) * 0.5) }));
    geos.push(fin({ p0: new THREE.Vector3(xf + 0.02, 0, 0), dir: new THREE.Vector3(-0.42, 0, s), cd: new THREE.Vector3(-1, 0, 0), L: 0.25, le: (u) => 0.0 + 0.02 * u, te: (u) => 0.12 * (1 - Math.pow(u, 1.7)) + 0.015, th: (u) => 0.012 * (1 - u) + 0.002, col: finC }));
  }
  geos.push(ball(eyeP[0], 0.014, EYE), ball(eyeP[1], 0.014, EYE));
  const g = unify(geos); return sway(g, swX(0.5, -1.0, 2));
}

// ---------------------------------------------------------------- dugong (Dugong dugon), 2.8 m
export function dugong(seed) {
  srand(seed);
  const xf = -1.1, xs = 1.4, st = stations(34, xf, xs, [], true);
  const w = prof([[xf, 0.07], [-0.8, 0.16], [-0.4, 0.32], [0.1, 0.4], [0.6, 0.36], [0.95, 0.25], [1.15, 0.19], [1.3, 0.17], [1.38, 0.1], [xs, 0]]);
  const h = prof([[xf, 0.09], [-0.8, 0.18], [-0.4, 0.34], [0.1, 0.42], [0.6, 0.38], [0.95, 0.27], [1.15, 0.2], [1.3, 0.12], [1.38, 0.06], [xs, 0]]);
  const cy = (x) => -0.11 * smoothstep(1.0, xs, x);
  const body = loft(st, 16, w, h, cy, (x, a, s) => 1 - 0.08 * Math.pow(Math.max(0, -s), 2));
  const top = C('#6a665d'), belly = C('#aaa59a'), scar = C('#c4bcae'), bristle = C('#3f3a33');
  colorize(body, (p, n) => {
    const yy = (p.y - cy(p.x)) / Math.max(0.004, h(p.x));
    _c.copy(belly).lerp(top, smoothstep(-0.6, 0.1, yy));
    const sc = seams(p.x, p.y, p.z, 2.2, 0.014) * smoothstep(0.0, 0.4, n.y) * smoothstep(0.52, 0.6, noise3(p.x * 1.3 + seed, p.z * 1.3, seed * 0.1));
    _c.lerp(scar, sc * 0.8);
    if (p.x > 1.22 && yy < 0.3) _c.lerp(bristle, smoothstep(0.55, 0.8, hash3(Math.floor(p.x * 90), Math.floor(p.y * 90), Math.floor(p.z * 90))) * 0.6);
    return _c.offsetHSL(0, 0, grain(p, 5, 0.06));
  });
  const eyes = [new THREE.Vector3(1.12, cy(1.12) + 0.1, 0.19), new THREE.Vector3(1.12, cy(1.12) + 0.1, -0.19)];
  ringAround(body, eyes, 0.04, C('#8d877c'), 0.5);
  const geos = [body], fc = (u, q, p, n) => _c.copy(top).lerp(belly, smoothstep(0.2, -0.4, n.y) * 0.6);
  for (const s of [1, -1]) {
    geos.push(fin({ p0: new THREE.Vector3(0.62, -0.24, s * 0.27), dir: new THREE.Vector3(-0.45, -0.4, s), cd: new THREE.Vector3(-1, 0, 0), L: 0.4, le: (u) => 0.02 * u * u - 0.1 * (1 + 0.2 * Math.sin(PI * u)) * Math.sqrt(Math.max(0, 1 - u * u * u)), te: (u) => 0.02 * u * u + 0.1 * (1 + 0.2 * Math.sin(PI * u)) * Math.sqrt(Math.max(0, 1 - u * u * u)), th: (u) => 0.03 * (1 - u) + 0.004, col: fc }));
    geos.push(fin({ p0: new THREE.Vector3(xf + 0.03, 0, 0), dir: new THREE.Vector3(-0.45, 0, s), cd: new THREE.Vector3(-1, 0, 0), L: 0.45, le: (u) => 0.02 * u, te: (u) => 0.2 * (1 - Math.pow(u, 1.5)) + 0.03, th: (u) => 0.02 * (1 - u) + 0.003, col: fc }));
  }
  geos.push(ball(eyes[0], 0.016, EYE), ball(eyes[1], 0.016, EYE));
  const g = unify(geos); return sway(g, swX(0.9, -1.4, 2.2));
}

// sway weight from the surface parameter (uv.x = along, uv.y = around) of a single surface
function swayUV(geo, fn) { const uv = geo.attributes.uv, out = new Float32Array(uv.count); for (let i = 0; i < uv.count; i++) out[i] = sat(fn(uv.getX(i), uv.getY(i))); geo.setAttribute('sw', new THREE.BufferAttribute(out, 1)); return geo; }
const spineTube = (r0, r1, len, seg = 3) => { const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true); g.translate(0, len / 2, 0); return g; };

// ---------------------------------------------------------------- giant moray (Gymnothorax javanicus), 2.4 m, head at x = +0.9, tail curled down into a hole
// returns { body, jaw }; place the jaw at MORAY_JAW_PIVOT (relative to the body) and rotate it about z to gape
export const MORAY_JAW_PIVOT = new THREE.Vector3(0.66, -0.04, 0);
export function giantMoray(seed) {
  srand(seed);
  const pts = [[0.9, 0, 0], [0.6, 0, 0], [0.3, 0, 0], [0, 0, 0], [-0.35, -0.06, 0.12], [-0.65, -0.28, 0.08], [-0.72, -0.5, -0.1], [-0.5, -0.6, -0.12], [-0.4, -0.5, 0]].map((p) => new THREE.Vector3(...p));
  const rw = prof([[0, 0.014], [0.03, 0.04], [0.08, 0.055], [0.14, 0.058], [0.3, 0.055], [0.6, 0.045], [0.85, 0.028], [1, 0.004]]);
  const rh = prof([[0, 0.012], [0.03, 0.045], [0.08, 0.07], [0.14, 0.078], [0.3, 0.085], [0.6, 0.075], [0.85, 0.045], [1, 0.006]]);
  const body = pathLoft(pts, 56, 16, rw, rh, { shape: (u, a, s) => 1 + 0.35 * Math.exp(-Math.pow((a - PI / 2) / 0.3, 2)) * smoothstep(0.1, 0.25, u) + 0.25 * Math.exp(-Math.pow((a - 1.5 * PI) / 0.3, 2)) * smoothstep(0.5, 0.62, u) - 0.1 * Math.max(0, -s) * smoothstep(0.3, 0.1, u) });
  disp(body, (v) => { if (v.x > 0.64 && v.y < -0.015) v.y = -0.015 + (v.y + 0.015) * 0.08; v.x += grain(v, 30, 0.004); });
  const tan = C('#9b8a5a'), dark = C('#45321e'), darker = C('#2b1d10'), mouthC = C('#d8bfb0'), iris = C('#c9b27a');
  colorize(body, (p, n, u, v) => {
    const f = lerp(11, 5.5, u), m = noise3(u * 2.3 * f, v * 0.45 * f, seed * 0.37), m2 = noise3(u * 2.3 * f * 2.1 + 7, v * 0.45 * f * 2.1, seed * 0.11);
    _c.copy(tan).lerp(dark, smoothstep(0.5, 0.6, m) * 0.9).lerp(darker, smoothstep(0.62, 0.72, m2) * 0.7 + smoothstep(0.6, 1, u) * 0.3);
    if (Math.abs(n.y) > 0.75 && u > 0.12 && u < 0.5) _c.lerp(dark, 0.25);
    if (p.x > 0.64 && p.y < -0.0135) _c.copy(mouthC);
    return _c.offsetHSL(0, 0, grain(p, 25, 0.06));
  });
  const eyes = [new THREE.Vector3(0.775, 0.036, 0.046), new THREE.Vector3(0.775, 0.036, -0.046)];
  ringAround(body, eyes, 0.03, iris, 0.6); ringAround(body, [new THREE.Vector3(0.6, -0.015, 0.058), new THREE.Vector3(0.6, -0.015, -0.058)], 0.02, darker, 0.9);
  swayUV(body, (u) => Math.pow(smoothstep(0.1, 1, u), 1.2));
  const teeth = [], tooth = C('#efe9dc');
  for (let i = 0; i < 4; i++) for (const s of [1, -1]) teeth.push({ p: new THREE.Vector3(0.7 + i * 0.045, -0.014, s * (0.028 - i * 0.004)), dir: new THREE.Vector3(0.15, -1, 0), r: 0.0035, len: 0.016, c0: tooth, c1: tooth });
  const geos = [body, spikes(teeth), ball(eyes[0], 0.016, EYE), ball(eyes[1], 0.016, EYE)];
  for (const s of [1, -1]) { const nz = tube(0.004, 0.003, 0.014, 4); orient(nz, new THREE.Vector3(0.87, 0.018, s * 0.012), new THREE.Vector3(0.5, 1, 0)); colorize(nz, () => _c.copy(tan)); geos.push(nz); }
  const bodyG = unify(geos);
  // lower jaw: hinge at the origin, pointing +x
  const jw = prof([[0, 0.046], [0.08, 0.046], [0.16, 0.032], [0.21, 0.012], [0.22, 0]]), jh = prof([[0, 0.02], [0.1, 0.02], [0.18, 0.014], [0.22, 0]]);
  const jaw = loft(stations(8, 0, 0.22, [], true), 10, jw, jh, () => 0, (x, a, s) => 1 - 0.35 * Math.max(0, s));
  colorize(jaw, (p, n) => { const m = noise3(p.x * 40 + seed, p.z * 40, 3); return (n.y > 0.5 ? _c.copy(mouthC) : _c.copy(tan).lerp(dark, smoothstep(0.5, 0.6, m) * 0.9)).offsetHSL(0, 0, grain(p, 30, 0.06)); });
  const jt = [];
  for (let i = 0; i < 5; i++) for (const s of [1, -1]) jt.push({ p: new THREE.Vector3(0.03 + i * 0.038, 0.012, s * (0.036 - i * 0.006)), dir: new THREE.Vector3(-0.1, 1, 0), r: 0.0032, len: 0.014, c0: tooth, c1: tooth });
  const jawG = unify([jaw, spikes(jt)]);
  return { body: bodyG, jaw: jawG };
}

// ---------------------------------------------------------------- day octopus (Octopus cyanea), resting, arms curled on the ground
export function dayOctopus(seed) {
  srand(seed);
  const base = C('#8c4a2c'), dark = C('#56301c'), pale = C('#dcb48e'), sucker = C('#e9dccb');
  const skin = (p, n, extra = 0) => { const m = fbm3(p.x * 14 + seed, p.y * 14, p.z * 14, 3); return _c.copy(base).lerp(dark, smoothstep(0.42, 0.6, m) * 0.8).lerp(pale, smoothstep(0.75, 0.9, noise3(p.x * 40, p.y * 40, p.z * 40 + seed)) * 0.9 + extra).offsetHSL(0, 0, grain(p, 60, 0.08)); };
  const mantle = new THREE.SphereGeometry(1, 16, 12); mantle.scale(0.165, 0.115, 0.125); mantle.rotateZ(-0.55); mantle.translate(-0.07, 0.15, 0);
  disp(mantle, (v) => { v.y += grain(v, 35, 0.012) * sat(v.y * 5); v.x += grain(v, 28, 0.008); });
  colorize(mantle, (p, n) => skin(p, n));
  const head = new THREE.SphereGeometry(1, 12, 9); head.scale(0.08, 0.07, 0.095); head.translate(0.05, 0.1, 0); colorize(head, (p, n) => skin(p, n));
  const geos = [mantle, head];
  const eyes = [new THREE.Vector3(0.07, 0.165, 0.05), new THREE.Vector3(0.07, 0.165, -0.05)];
  for (const e of eyes) { const bump = new THREE.SphereGeometry(0.03, 9, 7); bump.translate(e.x, e.y - 0.012, e.z); colorize(bump, (p, n) => skin(p, n, 0.1)); geos.push(bump); geos.push(ball(e, 0.017, EYE)); }
  const angs = [20, 62, 108, 152, -20, -62, -108, -152];
  for (let i = 0; i < 8; i++) {
    const th = angs[i] / 180 * PI, len = rr(0.4, 0.55), curl = rr(0.9, 2.4) * (rnd() < 0.5 ? 1 : -1), lift = rnd() < 0.3 ? rr(0.03, 0.08) : 0, pts = [];
    let x = 0.085 * Math.cos(th), z = 0.085 * Math.sin(th), phi = th + rr(-0.2, 0.2);
    for (let k = 0; k <= 5; k++) {
      const t = k / 5, r = 0.032 * Math.pow(1 - t, 1.1) + 0.004;
      pts.push(new THREE.Vector3(x, lerp(0.055, r * 0.9, smoothstep(0, 0.45, t)) + lift * Math.pow(t, 3), z));
      phi += curl * (0.1 + 0.3 * t); x += Math.cos(phi) * len / 5; z += Math.sin(phi) * len / 5;
    }
    const arm = pathLoft(pts, 22, 8, (u) => 0.032 * Math.pow(1 - u, 1.1) + 0.003, (u) => 0.03 * Math.pow(1 - u, 1.1) + 0.003, { shape: (u, a, s) => 1 + 0.14 * smoothstep(-0.4, -0.9, s) * (0.5 + 0.5 * Math.cos(u * len * TAU / 0.03)) });
    colorize(arm, (p, n, u, v) => { const s = Math.sin(v * TAU); skin(p, n); const sk = smoothstep(-0.35, -0.8, s) * (0.4 + 0.6 * (0.5 + 0.5 * Math.cos(u * len * TAU / 0.03)) * (0.5 + 0.5 * Math.cos(v * TAU * 2))); return _c.lerp(sucker, sk * 0.9); });
    swayUV(arm, (u) => Math.pow(u, 1.6)); geos.push(arm);
  }
  return unify(geos);
}

// ---------------------------------------------------------------- pharaoh cuttlefish (Sepia pharaonis), 0.35 m
export function cuttlefish(seed) {
  srand(seed);
  const w = prof([[-0.13, 0], [-0.1, 0.036], [-0.04, 0.058], [0.03, 0.062], [0.08, 0.055], [0.1, 0.046]]), h = prof([[-0.13, 0], [-0.1, 0.022], [-0.04, 0.036], [0.03, 0.04], [0.08, 0.036], [0.1, 0.03]]);
  const mantle = loft(stations(20, -0.13, 0.1, [], true), 16, w, h, () => 0, (x, a, s) => 1 - 0.25 * Math.pow(Math.max(0, -s), 1.5));
  const tan = C('#b99a6a'), band = C('#5a4230'), under = C('#e4d7bd'), paleS = C('#efe6d2'), blueL = C('#bfe3ee'), edge = C('#eadfc6');
  const bodyCol = (p, n) => {
    _c.copy(under).lerp(tan, smoothstep(-0.6, -0.1, n.y));
    const b = smoothstep(0.35, 0.6, 0.5 + 0.5 * Math.sin(p.x * 85 + 2.5 * noise3(p.z * 30, p.x * 12, seed)));
    _c.lerp(band, b * smoothstep(-0.3, 0.3, n.y) * 0.85).lerp(paleS, dots(p.x, p.z, 0.02, 0.004, seed) * 0.5);
    return _c.offsetHSL(0, 0, grain(p, 70, 0.08));
  };
  colorize(mantle, bodyCol);
  const geos = [mantle];
  for (const s of [1, -1]) {
    const x0 = -0.115, L = 0.205;
    geos.push(fin({ p0: new THREE.Vector3(x0, 0.004, s * 0.03), dir: new THREE.Vector3(1, 0, 0), cd: new THREE.Vector3(0, 0, s), L, le: (u) => w(x0 + u * L) * 0.9 - 0.03, te: (u) => w(x0 + u * L) * 0.9 - 0.03 + 0.028 * Math.pow(Math.sin(PI * u), 0.6), th: () => 0.0022, nu: 22, nv: 6,
      col: (u, q, p) => _c.copy(tan).lerp(band, smoothstep(0.35, 0.6, 0.5 + 0.5 * Math.sin(p.x * 85)) * 0.4).lerp(blueL, smoothstep(0.3, 0.1, q) * 0.8).lerp(edge, smoothstep(0.7, 0.95, q)) }));
  }
  const hw = prof([[0.08, 0.05], [0.12, 0.046], [0.16, 0.036], [0.17, 0.03]]), hh = prof([[0.08, 0.034], [0.12, 0.034], [0.16, 0.028], [0.17, 0.024]]);
  const head = loft(stations(6, 0.08, 0.17), 12, hw, hh, () => 0.002); colorize(head, bodyCol); geos.push(head);
  for (const s of [1, -1]) {
    const e = new THREE.Vector3(0.125, 0.012, s * 0.047), eye = new THREE.SphereGeometry(0.015, 10, 8); eye.translate(e.x, e.y, e.z);
    colorize(eye, (p) => { const yl = (p.y - e.y) / 0.015, xl = (p.x - e.x) / 0.015; return Math.abs(yl - 0.25 * Math.abs(Math.sin(xl * 4.5))) < 0.2 ? _c.copy(EYE) : _c.set('#b8a26a'); });
    geos.push(eye);
  }
  for (let k = 0; k < 8; k++) {
    const ang = (k + 0.5) / 8 * TAU, y0 = 0.02 * Math.sin(ang), z0 = 0.03 * Math.cos(ang), fl = rr(0.07, 0.09);
    const arm = pathLoft([new THREE.Vector3(0.165, y0 * 0.8, z0), new THREE.Vector3(0.165 + fl * 0.5, y0 * 0.7, z0 * 1.15), new THREE.Vector3(0.165 + fl, y0 * 0.3 - 0.005, z0 * 0.85)], 6, 6, (u) => 0.009 * (1 - u) + 0.0012, (u) => 0.009 * (1 - u) + 0.0012);
    colorize(arm, (p, n) => _c.copy(tan).lerp(band, smoothstep(0.4, 0.6, 0.5 + 0.5 * Math.sin(p.x * 150)) * 0.6).lerp(under, smoothstep(0.2, -0.5, n.y) * 0.5)); geos.push(arm);
  }
  for (const s of [1, -1]) {
    const t = pathLoft([new THREE.Vector3(0.165, -0.004, s * 0.012), new THREE.Vector3(0.24, -0.008, s * 0.02), new THREE.Vector3(0.3, -0.01, s * 0.022)], 4, 5, () => 0.0035, () => 0.0035);
    colorize(t, () => _c.copy(under)); geos.push(t, ball(new THREE.Vector3(0.305, -0.01, s * 0.022), 0.006, tan));
  }
  const g = unify(geos);
  return sway(g, (p) => (p.x < 0.09 ? sat((Math.abs(p.z) - w(p.x) * 0.97) / 0.028) : 0));
}

// ---------------------------------------------------------------- banded sea krait (Laticauda colubrina), 1.2 m, straight along x
export function seaKrait(seed) {
  srand(seed);
  const bw = 0.022, xN = 0.5, extra = [];
  for (let k = 0; k <= 45; k++) { const e = xN - k * bw; if (e > -0.5) extra.push(e - 0.0015, e + 0.0015); }
  const st = stations(12, -0.6, 0.6, extra, true);
  const w = prof([[-0.6, 0], [-0.58, 0.004], [-0.5, 0.006], [-0.42, 0.013], [-0.3, 0.015], [0.45, 0.015], [0.52, 0.014], [0.56, 0.015], [0.59, 0.009], [0.6, 0]]);
  const h = prof([[-0.6, 0], [-0.58, 0.02], [-0.5, 0.028], [-0.42, 0.02], [-0.3, 0.015], [0.45, 0.015], [0.52, 0.013], [0.56, 0.014], [0.59, 0.008], [0.6, 0]]);
  const body = loft(st, 6, w, h, () => 0);
  const blue = C('#aebdc6'), black = C('#17191c'), yellow = C('#e6c23a'), cream = C('#d9d3b4');
  colorize(body, (p, n) => {
    if (p.x > 0.555) return _c.copy(yellow).lerp(black, smoothstep(0.3, 0.8, n.y) * smoothstep(0.59, 0.57, p.x) * 0.9);
    if (p.x > xN) return _c.copy(black);
    const k = Math.floor((xN - p.x) / bw);
    return k % 2 === 1 ? _c.copy(black) : _c.copy(blue).lerp(cream, smoothstep(-0.2, -0.8, n.y) * 0.6);
  });
  const eyes = [new THREE.Vector3(0.566, 0.006, 0.0135), new THREE.Vector3(0.566, 0.006, -0.0135)];
  const g = unify([body, ball(eyes[0], 0.004, EYE, 5, 4), ball(eyes[1], 0.004, EYE, 5, 4)]);
  return sway(g, swX(0.5, -0.6, 1.4));
}

// ---------------------------------------------------------------- long-spined urchin (Diadema setosum), 8 cm test, spines to 25 cm
export function diademaUrchin(seed) {
  srand(seed);
  const cen = new THREE.Vector3(0, 0.034, 0), black = C('#0b0b0d'), blue = C('#2f5fd0'), orange = C('#e8781e');
  const test = new THREE.SphereGeometry(0.04, 12, 9); test.scale(1, 0.85, 1); test.translate(cen.x, cen.y, cen.z);
  colorize(test, (p) => _c.copy(black).lerp(blue, smoothstep(0.85, 0.95, hash3(Math.floor(p.x * 300), Math.floor(p.y * 300), Math.floor(p.z * 300))) * 0.8));
  const ring = new THREE.TorusGeometry(0.009, 0.0025, 4, 10); ring.rotateX(PI / 2); ring.translate(0, 0.069, 0); colorize(ring, () => _c.copy(orange));
  const geos = [test, ring];
  for (let i = 0; i < 95; i++) {
    const long = i < 68, d = new THREE.Vector3(rr(-1, 1), long ? rr(-0.12, 1) : rr(-0.4, 1), rr(-1, 1)).normalize();
    const len = long ? rr(0.15, 0.25) * (0.65 + 0.35 * Math.max(0, d.y)) : rr(0.03, 0.08);
    const sp = spineTube(long ? 0.0026 : 0.0018, 0.0004, len, 3); orient(sp, cen.clone().addScaledVector(d, 0.034), d);
    colorize(sp, (p, n, u, v) => _c.copy(black).offsetHSL(0, 0, 0.05 * v)); geos.push(sp);
  }
  const g = unify(geos); return sway(g, (p) => Math.pow(sat((p.distanceTo(cen) - 0.04) / 0.2), 1.2));
}

// ---------------------------------------------------------------- blue sea star (Linckia laevigata), 0.3 m across
export function blueSeaStar(seed) {
  srand(seed);
  const blue = C('#1f4fd6'), hi = C('#4a78ea'), lo = C('#163a9c'), col = (p) => _c.copy(blue).lerp(hi, smoothstep(0.5, 0.75, noise3(p.x * 90, p.y * 90, p.z * 90 + seed)) * 0.6).lerp(lo, smoothstep(0.5, 0.3, noise3(p.x * 40 + 3, p.y * 40, p.z * 40)) * 0.4);
  const disc = new THREE.SphereGeometry(0.03, 9, 6); disc.scale(1, 0.5, 1); disc.translate(0, 0.014, 0); colorize(disc, col);
  const geos = [disc];
  for (let i = 0; i < 5; i++) {
    const ang = i / 5 * TAU + rr(-0.1, 0.1), dl = rr(-0.25, 0.25), lift = rnd() < 0.4 ? rr(0.005, 0.03) : rr(-0.003, 0.003), pts = [];
    for (let k = 0; k <= 3; k++) { const t = k / 3, a = ang + dl * t * t, r = 0.015 + 0.15 * t; pts.push(new THREE.Vector3(Math.cos(a) * r, 0.014 - 0.004 * t + lift * t * t * t, Math.sin(a) * r)); }
    const arm = pathLoft(pts, 12, 8, (u) => 0.0145 * Math.pow(1 - u, 0.55) + 0.003, (u) => 0.012 * Math.pow(1 - u, 0.55) + 0.003);
    disp(arm, (v) => { v.multiplyScalar(1 + grain(v, 120, 0.06) * 0.2); }); colorize(arm, col); geos.push(arm);
  }
  return unify(geos);
}

// ---------------------------------------------------------------- black sea cucumber (Holothuria atra), 0.35 m, lying on the sand
export function seaCucumber(seed) {
  srand(seed);
  const w = prof([[-0.175, 0], [-0.15, 0.035], [-0.05, 0.046], [0.05, 0.046], [0.15, 0.036], [0.175, 0]]);
  const g = loft(stations(20, -0.175, 0.175, [], true), 10, w, (x) => w(x) * 0.8, () => 0.036, (x, a, s) => 1 - 0.3 * Math.pow(Math.max(0, -s), 1.5));
  disp(g, (v) => { v.multiplyScalar(1 + grain(v, 22, 0.14) * 0.5); v.y = Math.max(v.y, 0.001); });
  const black = C('#141210'), sand = C('#d6c59b');
  colorize(g, (p, n) => _c.copy(black).offsetHSL(0, 0, grain(p, 40, 0.06)).lerp(sand, dots(p.x, p.z, 0.045, 0.012, seed) * smoothstep(0.15, 0.5, n.y) * 0.9));
  return unify([g]);
}

// ---------------------------------------------------------------- crown-of-thorns (Acanthaster planci), 0.35 m, 14 spiny arms
export function crownOfThorns(seed) {
  srand(seed);
  const gr = C('#6e7a5c'), pu = C('#7c4a66'), mix = rnd(), tip = C('#e0512a'), base = new THREE.Color().copy(gr).lerp(pu, mix);
  const col = (p) => _c.copy(base).lerp(pu, smoothstep(0.4, 0.7, noise3(p.x * 25 + seed, p.y * 25, p.z * 25)) * 0.5).offsetHSL(0, 0, grain(p, 60, 0.1));
  const disc = new THREE.SphereGeometry(0.075, 14, 8); disc.scale(1, 0.42, 1); disc.translate(0, 0.03, 0); colorize(disc, col);
  const geos = [disc], sp = [];
  for (let i = 0; i < 70; i++) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * 0.07, y = 0.03 + 0.031 * Math.sqrt(Math.max(0, 1 - Math.pow(r / 0.075, 2))); const p = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r); sp.push({ p, dir: new THREE.Vector3(p.x * 0.5, 1, p.z * 0.5), r: 0.0035, len: rr(0.02, 0.035), c0: base, c1: tip }); }
  for (let i = 0; i < 14; i++) {
    const ang = i / 14 * TAU + rr(-0.06, 0.06), dl = rr(-0.15, 0.15), pts = [];
    for (let k = 0; k <= 3; k++) { const t = k / 3, a = ang + dl * t * t, r = 0.05 + 0.125 * t; pts.push(new THREE.Vector3(Math.cos(a) * r, 0.028 - 0.012 * t + rr(0, 0.004), Math.sin(a) * r)); }
    const arm = pathLoft(pts, 6, 8, (u) => 0.03 * Math.pow(1 - u, 0.8) + 0.006, (u) => 0.02 * Math.pow(1 - u, 0.9) + 0.005);
    colorize(arm, col); geos.push(arm);
    const F = arm.userData.frames;
    for (let k = 0; k < 12; k++) { const u = rnd() * 0.95, j = Math.round(u * 6), a = rr(0.15 * PI, 0.85 * PI), s = Math.sin(a), c = Math.cos(a); const p = F.P[j].clone().addScaledVector(F.N[j], (0.02 * Math.pow(1 - u, 0.9) + 0.005) * s).addScaledVector(F.B[j], (0.03 * Math.pow(1 - u, 0.8) + 0.006) * c); sp.push({ p, dir: new THREE.Vector3().addScaledVector(F.N[j], s).addScaledVector(F.B[j], c), r: 0.003, len: rr(0.018, 0.03), c0: base, c1: tip }); }
  }
  geos.push(spikes(sp));
  return unify(geos);
}

// ---------------------------------------------------------------- nudibranch (Chromodoris-type sea slug), 6 cm
export function nudibranch(seed) {
  srand(seed);
  const w = prof([[-0.03, 0], [-0.025, 0.008], [-0.01, 0.013], [0.01, 0.013], [0.025, 0.009], [0.03, 0]]), h = prof([[-0.03, 0], [-0.025, 0.004], [-0.01, 0.0065], [0.01, 0.0065], [0.025, 0.005], [0.03, 0]]);
  const body = loft(stations(18, -0.03, 0.03, [], true), 14, w, h, () => 0.0055, (x, a, s) => (1 - 0.45 * Math.pow(Math.max(0, -s), 1.2)) * (1 + 0.25 * Math.exp(-Math.pow(s / 0.25, 2))));
  const white = C('#f6f4f0'), line = C('#1b1e4a'), orange = C('#f28a1c'), foot = C('#d9d4cc');
  colorize(body, (p, n) => {
    const az = Math.abs(p.z), ww = w(p.x);
    if (n.y < -0.3) return _c.copy(foot);
    _c.copy(white);
    if (az > 0.0028 && az < 0.005 && n.y > 0.3 && Math.abs(p.x) < 0.024) _c.copy(line);
    if (Math.abs(n.y) < 0.55 && az > ww * 0.8) _c.copy(orange);
    return _c;
  });
  const geos = [body], rhC = C('#d4601a');
  for (const s of [1, -1]) { const r = tube(0.0018, 0.0011, 0.008, 5); orient(r, new THREE.Vector3(0.02, 0.011, s * 0.005), new THREE.Vector3(0.3, 1, s * 0.2)); colorize(r, () => _c.copy(rhC)); geos.push(r, ball(new THREE.Vector3(0.0225, 0.0185, s * 0.0065), 0.0023, rhC, 6, 4)); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, gl = tube(0.0014, 0.0004, 0.009, 4); orient(gl, new THREE.Vector3(-0.017 + Math.cos(a) * 0.004, 0.0115, Math.sin(a) * 0.004), new THREE.Vector3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5)); colorize(gl, (p, n, u, v) => _c.copy(white).lerp(orange, smoothstep(0.6, 1, v))); geos.push(gl); }
  return unify(geos);
}

// ---------------------------------------------------------------- snapping shrimp (Alpheus), 4.5 cm, one huge snapping claw
export function snappingShrimp(seed) {
  srand(seed);
  const red = C('#d4532a'), cream = C('#f0e2c4'), dark = C('#8a2e18');
  const cw = prof([[0.004, 0.0055], [0.012, 0.0065], [0.02, 0.005], [0.022, 0.002]]);
  const cara = loft(stations(7, 0.004, 0.022), 8, cw, (x) => cw(x) * 1.1, () => 0.009);
  colorize(cara, (p) => _c.copy(red).lerp(cream, smoothstep(0.6, 0.8, 0.5 + 0.5 * Math.sin(p.x * 500 + seed)) * 0.7).offsetHSL(0, 0, grain(p, 400, 0.08)));
  const geos = [cara];
  for (let i = 0; i < 5; i++) {
    const x1 = 0.004 - i * 0.0042, wk = 0.0055 * (1 - i * 0.12), yk = 0.009 - i * 0.0012;
    const seg = loft(stations(3, x1 - 0.0004, x1 + 0.0046), 8, () => wk, () => wk * 1.05, (x) => yk - (x - x1) * 0.2);
    colorize(seg, (p) => _c.copy(((x1 + 0.0046 - p.x) / 0.005) < 0.4 ? cream : red).lerp(dark, smoothstep(0.2, -0.5, p.y - yk) * 0.3)); geos.push(seg);
  }
  const fc = () => _c.copy(red).lerp(cream, 0.4);
  for (const s of [-1, 0, 1]) geos.push(fin({ p0: new THREE.Vector3(-0.017, 0.0025, s * 0.002), dir: new THREE.Vector3(-1, -0.15, s * 0.6), cd: new THREE.Vector3(0, 0, s === 0 ? 1 : s), L: 0.008, le: () => -0.0018, te: (u) => 0.0018 * (1 - u * u) + 0.0005, th: () => 0.0005, nu: 4, nv: 6, col: fc }));
  // big snapping claw on the right, small pincer on the left
  const pw = prof([[0, 0.003], [0.005, 0.0045], [0.012, 0.0045], [0.017, 0.003], [0.019, 0]]);
  const claw = loft(stations(8, 0, 0.019), 8, pw, (x) => pw(x) * 1.3, () => 0); claw.translate(0.013, 0.006, 0.0095);
  colorize(claw, (p) => _c.copy(red).lerp(cream, smoothstep(0.019, 0.024, p.x) * 0.5).offsetHSL(0, 0, grain(p, 400, 0.08)));
  const dac = loft(stations(4, 0, 0.009), 6, (x) => 0.0025 * (1 - x / 0.009) + 0.0004, (x) => 0.002 * (1 - x / 0.009) + 0.0004, () => 0); dac.translate(0.024, 0.0105, 0.0095); colorize(dac, () => _c.copy(dark));
  const arm = tube(0.0018, 0.0016, 0.009, 5); orient(arm, new THREE.Vector3(0.014, 0.006, 0.004), new THREE.Vector3(0.1, 0, 1)); colorize(arm, () => _c.copy(red));
  const small = loft(stations(5, 0, 0.009), 6, (x) => 0.0018 * (1 - x / 0.011) + 0.0003, (x) => 0.002 * (1 - x / 0.011) + 0.0003, () => 0); small.translate(0.016, 0.005, -0.0075); colorize(small, () => _c.copy(red));
  geos.push(claw, dac, arm, small);
  for (const s of [1, -1]) {
    const an = tube(0.0006, 0.0002, 0.05, 3); orient(an, new THREE.Vector3(0.022, 0.011, s * 0.002), new THREE.Vector3(1, 0.15, s * 0.3)); colorize(an, () => _c.copy(cream)); geos.push(an);
    const an2 = tube(0.0005, 0.0002, 0.025, 3); orient(an2, new THREE.Vector3(0.022, 0.0125, s * 0.0015), new THREE.Vector3(1, 0.4, s * 0.15)); colorize(an2, () => _c.copy(cream)); geos.push(an2);
    for (let i = 0; i < 3; i++) { const lg = tube(0.0008, 0.0004, 0.012, 3); orient(lg, new THREE.Vector3(0.006 + i * 0.004, 0.005, s * 0.004), new THREE.Vector3(0.2, -0.5, s * 0.8)); colorize(lg, () => _c.copy(red)); geos.push(lg); }
    geos.push(ball(new THREE.Vector3(0.021, 0.0115, s * 0.0032), 0.0013, EYE, 5, 4));
  }
  return unify(geos);
}

// approximate bounding radius (m) of each builder's output, for picking
export const SIZES = { hawksbillTurtle: 0.9, greenTurtle: 1.1, blacktipReefShark: 0.75, reefManta: 1.8, eagleRay: 1.3, giantMoray: 1.0, dayOctopus: 0.5, cuttlefish: 0.22, spinnerDolphin: 1.0, dugong: 1.5, seaKrait: 0.65, diademaUrchin: 0.3, blueSeaStar: 0.17, seaCucumber: 0.2, crownOfThorns: 0.2, nudibranch: 0.04, snappingShrimp: 0.04 };

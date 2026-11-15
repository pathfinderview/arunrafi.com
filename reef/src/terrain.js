// Sand floor and reef rock (bommies). All procedural, vertex coloured.
import * as THREE from 'three';
import { fbm2, fbm3, noise3, smoothstep, clamp, lerp, srand, rnd, rr } from './noise.js';
import { oceanify } from './ocean.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export let LOW = false; export const setLow = (v) => { LOW = v; };
export function terrainY(x, z) {
  let y = -11.5;
  y += (fbm2(x * 0.02 + 7.3, z * 0.02 + 2.1) - 0.5) * 5.0;
  y += 0.16 * Math.sin(x * 0.9 + 2.0 * fbm2(x * 0.06, z * 0.06));
  y += smoothstep(-20, -90, z) * 5.0;
  y -= smoothstep(45, 110, z) * 24.0;
  return y;
}

export function makeSand(isMobile) {
  const S = 340, N = isMobile ? 110 : 170;
  const geo = new THREE.PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  const c0 = new THREE.Color('#efe4cb'), c1 = new THREE.Color('#d9c9a6'), c2 = new THREE.Color('#b9ad90'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = terrainY(x, z); p.setY(i, y);
    const n = fbm2(x * 0.09 + 3, z * 0.09 + 9), rip = 0.5 + 0.5 * Math.sin(x * 0.9 + 2.0 * fbm2(x * 0.06, z * 0.06));
    c.copy(c0).lerp(c1, n).lerp(c2, (1 - rip) * 0.35 + smoothstep(50, 110, z) * 0.6);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const mat = oceanify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }), { caustic: 1.4, grain: 0.07, bump: 3, key: 'sand' });
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; return m;
}

// A lumpy rock: displaced icosphere, flattened base, coloured with coralline pink and turf patches.
export function makeRockGeometry(seed, sx, sy, sz, detail = 4) {
  const geo = mergeVertices(new THREE.IcosahedronGeometry(1, detail));
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), v = new THREE.Vector3();
  const base = new THREE.Color('#8c8372'), dark = new THREE.Color('#3b3730'), pink = new THREE.Color('#a9818e'), turf = new THREE.Color('#6e7438'), rust = new THREE.Color('#8a5a3c'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d1 = fbm3(v.x * 1.3 + seed, v.y * 1.3, v.z * 1.3 - seed, 4), d2 = noise3(v.x * 6 + seed * 3, v.y * 6, v.z * 6), d3 = noise3(v.x * 14 - seed, v.y * 14, v.z * 14 + seed), d4 = detail > 4 ? noise3(v.x * 32 + seed, v.y * 32 - seed, v.z * 32) : 0.5;
    const disp = 1 + (d1 - 0.5) * 0.9 + (d2 - 0.5) * 0.34 + (d3 - 0.5) * 0.2 + (d4 - 0.5) * 0.07;
    v.multiplyScalar(disp); v.x *= sx; v.y *= sy; v.z *= sz;
    if (v.y < -0.3 * sy) v.y = -0.3 * sy - (v.y + 0.3 * sy) * 0.15;
    if (v.y > 0.55 * sy) v.y = 0.55 * sy + (v.y - 0.55 * sy) * 0.45;
    p.setXYZ(i, v.x, v.y, v.z);
    const crev = clamp((disp - 0.75) / 0.5, 0, 1);
    c.copy(dark).lerp(base, crev);
    const pk = noise3(v.x * 0.9 + 11, v.y * 0.9, v.z * 0.9 + seed), tf = noise3(v.x * 0.7 - 5, v.y * 0.7 + seed, v.z * 0.7);
    if (pk > 0.66) c.lerp(pink, clamp((pk - 0.66) / 0.1, 0, 1) * 0.45);
    if (tf > 0.56 && v.y > -0.1 * sy) c.lerp(turf, clamp((tf - 0.56) / 0.1, 0, 1) * 0.75);
    const rs = noise3(v.x * 1.3 + 40, v.y * 1.3 - seed, v.z * 1.3); if (rs > 0.66) c.lerp(rust, clamp((rs - 0.66) / 0.1, 0, 1) * 0.6);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.computeVertexNormals(); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
export const rockMaterial = oceanify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }), { caustic: 0.8, grain: 0.22, bump: 9, key: 'rock' });

// lat-long table of the rock's surface radius in unit (unscaled) space, from its real vertices
const RA = 32, RB = 16;
function radialTable(geo, sx, sy, sz) {
  const t = new Float32Array(RA * RB).fill(0.6), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / sx, y = p.getY(i) / sy, z = p.getZ(i) / sz, r = Math.hypot(x, y, z);
    const a = ((Math.atan2(z, x) / (Math.PI * 2) + 1) % 1) * RA | 0, b = Math.min(RB - 1, (Math.acos(clamp(y / r, -1, 1)) / Math.PI) * RB | 0);
    const k = b * RA + a; if (r > t[k]) t[k] = r;
  }
  // fill holes from neighbours
  for (let pass = 0; pass < 2; pass++) for (let k = 0; k < t.length; k++) if (t[k] <= 0.6) { const a = k % RA, b = (k / RA) | 0; let s = 0, n = 0; for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const aa = (a + da + RA) % RA, bb = b + db; if (bb < 0 || bb >= RB) continue; const v = t[bb * RA + aa]; if (v > 0.6) { s += v; n++; } } if (n) t[k] = s / n; }
  return t;
}
export function rockRadius(e, ux, uy, uz) {
  const r = Math.hypot(ux, uy, uz) || 1e-6;
  const a = ((Math.atan2(uz, ux) / (Math.PI * 2) + 1) % 1) * RA, b = Math.min(RB - 1, (Math.acos(clamp(uy / r, -1, 1)) / Math.PI) * RB);
  const a0 = a | 0, b0 = b | 0, fa = a - a0, fb = b - b0, a1 = (a0 + 1) % RA, b1 = Math.min(RB - 1, b0 + 1), T = e.rad;
  return lerp(lerp(T[b0 * RA + a0], T[b0 * RA + a1], fa), lerp(T[b1 * RA + a0], T[b1 * RA + a1], fa), fb);
}
// push p out of rock e so it stays `margin` metres off the surface; returns true if it pushed
const _u = new THREE.Vector3();
export function rockPush(e, p, margin, vel) {
  _u.set((p.x - e.x) / e.sx, (p.y - e.y) / e.sy, (p.z - e.z) / e.sz); const l = _u.length(); if (l > 1.8) return false;
  const rs = rockRadius(e, _u.x, _u.y, _u.z), m = margin / Math.min(e.sx, e.sy, e.sz);
  if (l >= rs + m || l < 1e-5) return false;
  _u.multiplyScalar((rs + m) / l); p.set(e.x + _u.x * e.sx, e.y + _u.y * e.sy, e.z + _u.z * e.sz);
  if (vel) { _u.normalize(); const d = vel.dot(_u); if (d < 0) vel.addScaledVector(_u, -d); }
  return true;
}
export function makeRock(seed, x, z, sx, sy, sz) {
  const geo = makeRockGeometry(seed, sx, sy, sz, LOW ? (sx > 3.5 ? 4 : 3) : (sx > 3.5 ? 5 : 4));
  const m = new THREE.Mesh(geo, rockMaterial);
  m.position.set(x, terrainY(x, z) + sy * 0.2, z); m.castShadow = true; m.receiveShadow = true;
  m.userData.ell = { x, y: m.position.y, z, sx, sy, sz, rad: radialTable(geo, sx, sy, sz) };
  return m;
}

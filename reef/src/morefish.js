// Fifteen more fish species through the same generator: clouds, streams, herds, loners and one giant.
import * as THREE from 'three';
import { School, SPECIES } from './fish.js';
import { srand } from './noise.js';

const _c = new THREE.Color();
const band = (x, c, w) => Math.abs(x - c) < w;
const stripe = (v, n, w) => Math.abs((((v + 0.5) * n) % 1 + 1) % 1 - 0.5) < w;
const spot = (x, y, k, th) => Math.sin(x * k * 6.283) * Math.sin(y * k * 3.9) > th;
const fin = (p) => p !== 'body';

Object.assign(SPECIES, {
  chromis: { len: 0.08, h: 0.5, w: 0.16, nx: 14, nr: 8, beat: 9, amp: 0.07, n: 25, behaviour: 'cloud', dive: 3.2, speed: 0.3, flee: 0, round: 0.6, pelvic: false, night: 'hide',
    dorsal: { t0: 0.25, t1: 0.8, h: () => 0.12, lean: 0.4 }, anal: { t0: 0.2, t1: 0.5, h: () => 0.1 }, caudal: { len: 0.24, hb: 0.3, hc: 0.55, fork: 0.6 },
    color: (x, y, z, p) => fin(p) ? _c.set('#c9f7ea') : _c.set(y < -0.15 ? '#eafff6' : '#6fdcc6') },
  anthias: { len: 0.1, h: 0.4, w: 0.15, nx: 14, nr: 8, beat: 9, amp: 0.07, n: 24, behaviour: 'cloud', dive: 3.2, speed: 0.3, flee: 0, round: 0.6, pelvic: false, night: 'hide',
    dorsal: { t0: 0.25, t1: 0.82, h: (s) => 0.1 + 0.12 * Math.max(0, 1 - Math.abs(s - 0.85) * 5), lean: 0.5 }, anal: { t0: 0.2, t1: 0.5, h: () => 0.1 }, caudal: { len: 0.3, hb: 0.3, hc: 0.6, fork: 0.75 },
    color: (x, y, z, p) => { if (p === 'caudal') return _c.set('#ff6f3a'); if (fin(p)) return _c.set('#ff9a52'); if (x > 0.18 && Math.abs(y + 0.02 + (x - 0.35) * 0.5) < 0.05) return _c.set('#c45ad6'); return _c.set(y < -0.2 ? '#ffc070' : '#ff8526'); } },
  fusilier: { len: 0.25, h: 0.27, w: 0.13, nx: 18, nr: 8, beat: 8, amp: 0.05, n: 70, behaviour: 'school', speed: 1.6, flee: 3, round: 0.7, pelvic: false, night: 'hide',
    dorsal: { t0: 0.3, t1: 0.8, h: () => 0.06, lean: 0.4 }, anal: { t0: 0.22, t1: 0.5, h: () => 0.05 }, caudal: { len: 0.24, hb: 0.25, hc: 0.5, fork: 0.8 },
    color: (x, y, z, p) => { if (p === 'caudal') return _c.set('#f6d423'); if (fin(p)) return _c.set('#6fb6ee'); if (y > 0.1) return _c.set('#f4d21f'); return _c.set(y < -0.25 ? '#e3effa' : '#3f9fec'); } },
  bluestripeSnapper: { len: 0.25, h: 0.36, w: 0.14, nx: 22, nr: 10, beat: 4, amp: 0.03, n: 50, behaviour: 'school', speed: 0.22, flee: 1.6, round: 0.6,
    dorsal: { t0: 0.22, t1: 0.82, h: () => 0.1, lean: 0.4 }, anal: { t0: 0.2, t1: 0.48, h: () => 0.08 }, caudal: { len: 0.2, hb: 0.3, hc: 0.5, fork: 0.35 },
    color: (x, y, z, p) => { if (fin(p)) return _c.set('#f7d51e'); if (y < -0.22) return _c.set('#f6f1dc'); if (y > -0.12 && stripe(y, 8, 0.13)) return _c.set('#3f9cf5'); return _c.set('#f6d21c'); } },
  sweetlips: { len: 0.5, h: 0.34, w: 0.15, beat: 3, amp: 0.03, n: 3, behaviour: 'hover', speed: 0.15, flee: 1.2, round: 0.55, taper: 0.95, eyeT: 0.84,
    dorsal: { t0: 0.2, t1: 0.84, h: () => 0.1, lean: 0.4 }, anal: { t0: 0.2, t1: 0.46, h: () => 0.08 }, caudal: { len: 0.2, hb: 0.3, hc: 0.5, fork: 0.1 },
    color: (x, y, z, p) => { if (fin(p)) return _c.set(spot(x, y, 7, 0.45) ? '#151515' : '#f3cf2a'); if (x > 0.44) return _c.set('#f1c92a'); return _c.set(stripe(y, 7, 0.24) ? '#17140f' : '#f3f0e6'); } },
  napoleonWrasse: { len: 1.5, h: 0.44, w: 0.2, nx: 56, beat: 1.6, amp: 0.03, pec: 0.4, n: 1, behaviour: 'wander', speed: 0.5, flee: 0, round: 0.5, taper: 0.95, topK: 1.18, eyeT: 0.84, eyeY: 0.22, eye: 0.03,
    dorsal: { t0: 0.18, t1: 0.8, h: () => 0.09, lean: 0.3 }, anal: { t0: 0.15, t1: 0.48, h: () => 0.08 }, caudal: { len: 0.17, hb: 0.3, hc: 0.5, fork: -1 }, pectoral: { t: 0.64, len: 0.18, y: -0.02, rays: 5, a0: -0.3, a1: 1.2, droop: 0.4 },
    color: (x, y, z, p) => { if (p === 'caudal') return _c.set(x < -0.63 ? '#d9c45a' : '#2f8188'); if (fin(p)) return _c.set('#2f8188'); if (x > 0.24) return _c.set(Math.sin(x * 95 + Math.sin(y * 34) * 2.2) > 0.55 ? '#e6c56c' : '#4a9fa6'); return _c.set(stripe(x, 22, 0.17) ? '#2b6f7a' : '#45a093'); } },
  bluefinTrevally: { len: 0.6, h: 0.34, w: 0.12, nx: 28, nr: 10, beat: 7, amp: 0.045, n: 6, behaviour: 'school', speed: 2.3, flee: 0, round: 0.6, taper: 0.95, ped: 0.05, pelvic: false,
    dorsal: { t0: 0.2, t1: 0.6, h: (s) => 0.03 + 0.12 * Math.max(0, 1 - Math.abs(s - 0.85) * 4), lean: 0.8 }, anal: { t0: 0.2, t1: 0.5, h: (s) => 0.03 + 0.1 * Math.max(0, 1 - Math.abs(s - 0.85) * 4), lean: 0.8 }, caudal: { len: 0.26, hb: 0.12, hc: 0.6, fork: 0.85 }, pectoral: { t: 0.62, len: 0.2, y: -0.05, rays: 4, a0: 0.1, a1: 0.9, droop: 1.6 },
    color: (x, y, z, p) => { if (fin(p)) return _c.set('#1f6de0'); if (y > 0.15) return _c.set('#5f93b8'); return _c.set(spot(x, y, 9, 0.8) ? '#3f6a8a' : '#aebfca'); } },
  barracuda: { len: 1.3, h: 0.13, w: 0.1, nx: 40, nr: 10, beat: 2, amp: 0.012, n: 2, behaviour: 'hover', speed: 0.2, flee: 2.5, round: 0.85, taper: 1.0, eyeT: 0.88, eye: 0.014, pelvic: false,
    dorsal: { t0: 0.25, t1: 0.36, h: () => 0.05, lean: 0.7 }, dorsal2: { t0: 0.55, t1: 0.63, h: () => 0.05, lean: 0.5 }, anal: { t0: 0.24, t1: 0.34, h: () => 0.05, lean: 0.7 }, caudal: { len: 0.12, hb: 0.05, hc: 0.24, fork: 0.6 }, pectoral: { t: 0.72, len: 0.06, y: -0.1, rays: 3, a0: 0, a1: 0.8 },
    color: (x, y, z, p) => { if (fin(p)) return _c.set('#2c353a'); if (y > 0.12) return _c.set(stripe(x, 16, 0.15) ? '#39474d' : '#73858d'); return _c.set(spot(x, y, 5, 0.9) && y < 0 ? '#2c353a' : '#cdd6d9'); } },
  bannerfish: { len: 0.18, h: 0.7, w: 0.11, nx: 22, nr: 10, beat: 5, amp: 0.04, n: 14, behaviour: 'school', speed: 0.45, flee: 2, round: 0.45, taper: 1.0, ped: 0.14, eyeT: 0.82, eyeY: 0.2, night: 'hide',
    dorsal: { t0: 0.3, t1: 0.78, h: (s) => 0.16 + 0.6 * Math.pow(Math.max(0, 1 - Math.abs(s - 0.86) * 3.2), 2), lean: 1.1 }, anal: { t0: 0.2, t1: 0.52, h: () => 0.15 }, caudal: { len: 0.18, hb: 0.3, hc: 0.5, fork: 0.15 },
    color: (x, y, z, p) => { if (p === 'caudal') return _c.set('#f4cf23'); if (p === 'dorsal') return _c.set(y > 0.5 ? '#f6f5ee' : x < 0 ? '#f4cf23' : '#f6f5ee'); if (band(x, 0.13, 0.075) || band(x - y * 0.25, -0.2, 0.085)) return _c.set('#101010'); if (x < -0.32) return _c.set('#f4cf23'); return _c.set('#f6f5ee'); } },
  pufferfish: { len: 0.28, h: 0.5, w: 0.42, nx: 26, beat: 3, amp: 0.02, finWave: 1, n: 2, behaviour: 'wander', speed: 0.2, flee: 0, round: 0.42, taper: 1.0, ped: 0.16, eyeT: 0.8, eyeY: 0.3, eye: 0.018, pelvic: false,
    dorsal: { t0: 0.18, t1: 0.3, h: () => 0.12, lean: 0.6, soft: true }, anal: { t0: 0.18, t1: 0.3, h: () => 0.1, lean: 0.6, soft: true }, caudal: { len: 0.2, hb: 0.2, hc: 0.34, fork: -1 }, pectoral: { t: 0.6, len: 0.16, y: 0.05, rays: 4, a0: 0.2, a1: 1.3 },
    color: (x, y, z, p) => { if (fin(p)) return _c.set('#b9ae98'); if (x > 0.43) return _c.set('#3b3835'); if (spot(x + z * 0.3, y, 5.5, 0.5)) return _c.set('#151413'); return _c.set(y < -0.1 ? '#ece5d2' : '#958b79'); } },
  boxfish: { len: 0.07, h: 0.8, w: 0.74, nx: 14, nr: 10, beat: 9, amp: 0.015, finWave: 1, n: 1, behaviour: 'hover', speed: 0.08, flee: 0.5, round: 0.28, taper: 1.0, ped: 0.2, eyeT: 0.8, eyeY: 0.25, eye: 0.006, pelvic: false,
    dorsal: { t0: 0.2, t1: 0.3, h: () => 0.14, lean: 0.5, soft: true }, anal: { t0: 0.2, t1: 0.3, h: () => 0.12, lean: 0.5, soft: true }, caudal: { len: 0.3, hb: 0.2, hc: 0.3, fork: -1 },
    color: (x, y, z, p) => { if (fin(p)) return _c.set('#f1e7a8'); return _c.set(spot(x + z * 0.4, y, 4.2, 0.55) ? '#141414' : '#f7d426'); } },
  trumpetfish: { len: 0.6, h: 0.075, w: 0.06, nx: 30, nr: 8, beat: 2, amp: 0.008, finWave: 1, n: 2, behaviour: 'hover', speed: 0.12, flee: 1.2, round: 0.9, taper: 1.0, ped: 0.4, eyeT: 0.72, eye: 0.007, pelvic: false,
    dorsal: { t0: 0.1, t1: 0.2, h: () => 0.04, lean: 0.5, soft: true }, anal: { t0: 0.1, t1: 0.2, h: () => 0.04, lean: 0.5, soft: true }, caudal: { len: 0.07, hb: 0.03, hc: 0.07, fork: -1 }, pectoral: { t: 0.66, len: 0.03, y: 0, rays: 3, a0: 0, a1: 1 },
    color: (x, y, z, p) => { if (p === 'caudal') return _c.set('#f1d24a'); return _c.set(stripe(x, 26, 0.06) ? '#b8922a' : '#e2bb3a'); } },
  bumpheadParrotfish: { len: 1.1, h: 0.46, w: 0.2, nx: 44, beat: 2, amp: 0.012, pec: 0.5, n: 6, behaviour: 'graze', speed: 0.5, flee: 0, round: 0.42, taper: 1.05, topK: 1.22, eyeT: 0.8, eyeY: 0.12, eye: 0.022, night: 'hide',
    dorsal: { t0: 0.18, t1: 0.8, h: () => 0.08, lean: 0.2 }, anal: { t0: 0.15, t1: 0.48, h: () => 0.07 }, caudal: { len: 0.18, hb: 0.3, hc: 0.5, fork: 0.2 }, pectoral: { t: 0.64, len: 0.2, y: 0, rays: 5, a0: -0.3, a1: 1.2, droop: 0.4 },
    color: (x, y, z, p) => { if (fin(p)) return _c.set('#4f8378'); if (x > 0.33) return _c.set(y > 0.0 ? '#dfb3a8' : '#e9cfc4'); return _c.set(stripe(x, 26, 0.12) ? '#56897c' : '#739f91'); } },
  whaleShark: { len: 7, h: 0.16, w: 0.2, nx: 70, nr: 16, beat: 0.9, amp: 0.05, waveK: 3.5, n: 1, behaviour: 'wander', speed: 0.8, flee: 0, round: 0.6, taper: 1.2, botK: 0.8, eyeT: 0.93, eyeY: 0.0, eye: 0.03, pelvic: false,
    dorsal: { t0: 0.34, t1: 0.46, h: (s) => 0.09 * Math.sin(Math.min(1, s * 1.6) * 1.57), lean: 0.9 }, dorsal2: { t0: 0.2, t1: 0.25, h: () => 0.03, lean: 0.8 }, anal: { t0: 0.18, t1: 0.23, h: () => 0.03, lean: 0.8 }, caudal: { len: 0.2, hb: 0.03, hc: 0.5, fork: 0.75 }, pectoral: { t: 0.78, len: 0.17, y: -0.2, rays: 5, a0: 0.2, a1: 1.0, droop: 1.2 },
    color: (x, y, z, p) => { if (fin(p)) return _c.set(spot(x, y, 14, 0.75) ? '#dfeaf0' : '#3a5d78'); if (y < -0.2) return _c.set('#eef2f1'); if (stripe(x, 44, 0.17) && stripe(y + z * 0.5, 7, 0.16)) return _c.set('#e6f0f5'); if (stripe(x, 22, 0.035)) return _c.set('#7f9fb5'); return _c.set('#3a5d78'); } },
  needlefish: { len: 0.5, h: 0.055, w: 0.05, nx: 22, nr: 6, beat: 7, amp: 0.04, waveK: 7, n: 14, behaviour: 'school', speed: 1.0, flee: 2.5, round: 0.9, taper: 1.0, ped: 0.3, eyeT: 0.8, eye: 0.006, pelvic: false,
    dorsal: { t0: 0.12, t1: 0.24, h: () => 0.03, lean: 0.6 }, anal: { t0: 0.12, t1: 0.24, h: () => 0.03, lean: 0.6 }, caudal: { len: 0.1, hb: 0.03, hc: 0.1, fork: 0.5 }, pectoral: { t: 0.7, len: 0.03, y: 0, rays: 3, a0: 0, a1: 1 },
    color: (x, y, z, p) => _c.set(y > 0.15 ? '#3f93b8' : '#cfe4ee') },
});

export function buildMoreFish(scene, env, isMobile) {
  srand(4242);
  const schools = [], pick = [], M = isMobile ? 0.45 : 1, N = (n) => Math.max(1, Math.round(n * M));
  const add = (key, home, n) => { const s = new School(key, SPECIES[key], home, env, { n }); scene.add(s.mesh); schools.push(s); pick.push(...s.pick); return s; };
  const g = env.garden, hs = env.hideSpots;
  for (let k = 0; k < 7; k++) { const p = hs[(k * 5 + 1) % hs.length]; add('chromis', { x: p.x, y: p.y + 0.5, z: p.z, r: 1.3, ry: 0.9 }, N(26)); }
  for (let k = 0; k < 6; k++) { const p = hs[(k * 5 + 3) % hs.length]; add('anthias', { x: p.x, y: p.y + 0.5, z: p.z, r: 1.5, ry: 1.1 }, N(24)); }
  add('fusilier', { x: g.x, y: g.y + 3.2, z: g.z + 8, r: 42, ry: 1.6 }, N(70));
  add('fusilier', { x: g.x + 10, y: g.y + 4, z: g.z - 30, r: 40, ry: 1.6 }, N(50));
  add('bluestripeSnapper', { x: -8, y: -9.2, z: -27, r: 2.6, ry: 0.9 }, N(50));
  add('bluestripeSnapper', { x: 9, y: -9.0, z: 3, r: 2.2, ry: 0.8 }, N(30));
  add('sweetlips', { x: 9, y: -9.3, z: -22, r: 3, ry: 0.6 }, 3);
  add('napoleonWrasse', { x: g.x, y: g.y + 0.5, z: g.z - 4, r: 30, ry: 2 }, 1);
  add('bluefinTrevally', { x: g.x, y: g.y + 2.5, z: g.z, r: 50, ry: 2.5 }, N(7));
  add('barracuda', { x: -16, y: -2.6, z: 30, r: 5, ry: 0.4 }, 2);
  add('bannerfish', { x: 8, y: g.y + 2, z: -42, r: 9, ry: 1.8 }, N(16));
  add('bannerfish', { x: -18, y: g.y + 2, z: -8, r: 8, ry: 1.8 }, N(10));
  add('pufferfish', { x: 4, y: -9.6, z: 6, r: 8, ry: 0.8 }, 2);
  for (const k of [2, 14, 27]) { const p = hs[k % hs.length]; add('boxfish', { x: p.x, y: p.y + 0.25, z: p.z, r: 0.5, ry: 0.4 }, 1); }
  add('trumpetfish', { x: -10, y: -8.6, z: -12, r: 3, ry: 0.8 }, 2);
  add('bumpheadParrotfish', { x: g.x, y: g.y + 0.3, z: g.z - 24, r: 38, ry: 1.8 }, N(7));
  add('whaleShark', { x: 0, y: -9, z: 74, r: 46, ry: 3 }, 1);
  add('needlefish', { x: 0, y: -0.95, z: 12, r: 26, ry: 0.12 }, N(16));
  const onTap = (key, pk) => { if (key === 'pufferfish' && pk && pk.fish) { pk.fish.puff0 = performance.now(); pk.fish.puffT = pk.fish.puff0 + 5000; } };
  return { schools, pick, onTap, update: (dt, cam, night) => { for (const s of schools) s.update(dt, cam, night); } };
}

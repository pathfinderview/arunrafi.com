// Fish: a parametric body + fin generator coloured by a per-species pattern, a swim shader, and schooling.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { oceanify } from './ocean.js';
import { srand, rnd, rr, clamp, lerp, smoothstep } from './noise.js';
import { terrainY, rockPush } from './terrain.js';
import { registerThumb } from './thumbs.js';

const TAU = Math.PI * 2, _c = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- geometry
// A plate between rows of points (each row = array of Vector3). part/fin tags drive colour and animation.
function plate(rows, S, part, fin, swFn) {
  const pos = [], col = [], sw = [], af = [];
  const push = (p) => { pos.push(p.x, p.y, p.z); const c = S.color(p.x / S.len, p.y / (S.h * S.len), p.z / (S.w * S.len), part); col.push(c.r, c.g, c.b); sw.push(swFn(p)); af.push(fin); };
  for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < rows[r].length - 1; i++) {
    const a = rows[r][i], b = rows[r][i + 1], c = rows[r + 1][i], d = rows[r + 1][i + 1];
    push(a); push(b); push(c); push(b); push(d); push(c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('sw', new THREE.Float32BufferAttribute(sw, 1)); g.setAttribute('aFin', new THREE.Float32BufferAttribute(af, 1));
  g.computeVertexNormals(); return g;
}
const tailW = (S) => (p) => { const xn = p.x / S.len; return 0.05 + 0.95 * Math.pow(smoothstep(0.25, -0.5, xn), 1.6); };

export function fishGeometry(S) {
  const L = S.len, H = S.h * L, W = S.w * L, NX = S.nx || 48, NR = S.nr || 14;
  const hp = S.hProfile || ((t) => Math.max(S.ped ?? 0.1, Math.pow(Math.sin(Math.PI * Math.pow(t, S.taper ?? 0.85)), S.round ?? 0.7)));
  const wp = S.wProfile || ((t) => Math.max(0.08, Math.pow(Math.sin(Math.PI * Math.pow(t, 0.9)), 0.9)));
  const yOff = S.yOff || (() => 0);
  const xOf = (t) => (t - 0.5) * L;
  const topR = (t) => H / 2 * hp(t) * (S.topK ?? 1), botR = (t) => H / 2 * hp(t) * (S.botK ?? 1), sideR = (t) => W / 2 * wp(t);
  // body as a grid
  const rows = [];
  for (let i = 0; i <= NX; i++) {
    const t = i / NX, row = [];
    for (let j = 0; j <= NR; j++) {
      const a = j / NR * TAU, sy = Math.sin(a), cz = Math.cos(a);
      const ry = sy >= 0 ? topR(t) : botR(t);
      row.push(new THREE.Vector3(xOf(t), yOff(t) * H + ry * Math.sign(sy) * Math.pow(Math.abs(sy), 0.9), sideR(t) * cz));
    }
    rows.push(row);
  }
  // snout cap: collapse last row to a point
  const snout = new THREE.Vector3(L / 2 + 0.01 * L, yOff(1) * H, 0); rows.push(rows[NX].map(() => snout.clone()));
  const geos = [plate(rows, S, 'body', 0, tailW(S))];
  const yTop = (t) => yOff(t) * H + topR(t), yBot = (t) => yOff(t) * H - botR(t);
  // dorsal / anal
  const ridge = (f, part, sign, fin) => {
    const N = 18, base = [], tip = [];
    for (let i = 0; i <= N; i++) {
      const s = i / N, t = lerp(f.t0, f.t1, s), x = xOf(t), y = sign > 0 ? yTop(t) : yBot(t), h = f.h(s) * L * sign;
      base.push(new THREE.Vector3(x, y - sign * 0.01 * L, 0)); tip.push(new THREE.Vector3(x - (f.lean ?? 0.35) * Math.abs(h), y + h, 0));
    }
    return plate(sign > 0 ? [tip, base] : [base, tip], S, part, fin, tailW(S));
  };
  if (S.dorsal) geos.push(ridge(S.dorsal, 'dorsal', 1, S.dorsal.soft ? 2 : 0));
  if (S.dorsal2) geos.push(ridge(S.dorsal2, 'dorsal', 1, S.dorsal2.soft ? 2 : 0));
  if (S.anal) geos.push(ridge(S.anal, 'anal', -1, S.anal.soft ? 2 : 0));
  // caudal
  { const c = S.caudal || { len: 0.22, hb: 0.2, hc: 0.42, fork: 0.5 }, N = 8, base = [], trail = [];
    const xt = xOf(0), cl = c.len * L;
    for (let i = 0; i <= N; i++) { const s = i / N * 2 - 1; const tr = c.fork >= 0 ? 1 - c.fork * (1 - Math.abs(s)) : Math.sqrt(1 - s * s * 0.9); base.push(new THREE.Vector3(xt + 0.02 * L, s * c.hb * L * 0.5 + yOff(0) * H, 0)); trail.push(new THREE.Vector3(xt - cl * tr, s * c.hc * L * 0.5 + yOff(0) * H, 0)); }
    geos.push(plate([trail, base], S, 'caudal', 0, () => 1)); }
  // pectorals: fans from a root on each flank
  { const pc = S.pectoral || { t: 0.62, len: 0.16, y: -0.05, rays: 5, a0: -0.2, a1: 1.1 };
    for (const sgn of [-1, 1]) {
      const t = pc.t, root = new THREE.Vector3(xOf(t), yOff(t) * H + pc.y * H, sgn * sideR(t) * 0.9), N = pc.rays, base = [], tip = [];
      for (let i = 0; i <= N; i++) { const a = lerp(pc.a0, pc.a1, i / N); base.push(root.clone()); tip.push(new THREE.Vector3(root.x - Math.cos(a) * pc.len * L, root.y - Math.sin(a) * 0.35 * pc.len * L * (pc.droop ?? 1), root.z + sgn * Math.sin(a) * pc.len * L)); }
      geos.push(plate(sgn > 0 ? [base, tip] : [tip, base], S, 'pectoral', 1, () => 0.05));
    } }
  // pelvic
  if (S.pelvic !== false) { const t = 0.6, root = new THREE.Vector3(xOf(t), yBot(t), 0), N = 2, base = [], tip = []; for (let i = 0; i <= N; i++) { const a = i / N; base.push(root.clone()); tip.push(new THREE.Vector3(root.x - 0.1 * L * (0.4 + a), root.y - 0.1 * L * (1 - a * 0.7), 0)); } geos.push(plate([base, tip], S, 'anal', 0, () => 0.2)); }
  // eyes
  for (const sgn of [-1, 1]) { const t = S.eyeT ?? 0.86, e = new THREE.SphereGeometry(S.eye ?? 0.035 * L, 8, 6); e.translate(xOf(t), yOff(t) * H + (S.eyeY ?? 0.12) * H, sgn * sideR(t) * 0.92); const n = e.attributes.position.count; const col = new Float32Array(n * 3), sw = new Float32Array(n).fill(0.05), af = new Float32Array(n); for (let i = 0; i < n; i++) { col[i * 3] = 0.03; col[i * 3 + 1] = 0.03; col[i * 3 + 2] = 0.04; } e.setAttribute('color', new THREE.BufferAttribute(col, 3)); e.setAttribute('sw', new THREE.BufferAttribute(sw, 1)); e.setAttribute('aFin', new THREE.BufferAttribute(af, 1)); e.deleteAttribute('uv'); geos.push(e.toNonIndexed()); }
  const g = mergeGeometries(geos, false); g.computeBoundingSphere(); return g;
}

// ---------------------------------------------------------------- swim shader
// instance attributes: aPhase, aAmp, aSpd. uAxis 0: lateral sway (fish), 1: vertical (rays, dolphins).
export function swimMaterial(S) {
  const u = { uLen: { value: S.len }, uBeat: { value: S.beat ?? 7 }, uAmp: { value: S.amp ?? 0.06 }, uAxis: { value: S.axis ?? 0 }, uWaveK: { value: S.waveK ?? 5 }, uWaveX: { value: S.waveX ?? 0 }, uPec: { value: S.pec ?? 0.2 }, uFinWave: { value: S.finWave ?? 0 }, uDull: { value: 0 } };
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: S.rough ?? 0.5, metalness: 0.08, side: THREE.DoubleSide });
  oceanify(m, { caustic: 0.7, absorb: 0.15, key: 'swim', patch: (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float sw; attribute float aFin; attribute float aPhase; attribute float aAmp; attribute float aSpd; uniform float uTime, uLen, uBeat, uAmp, uAxis, uWaveK, uWaveX, uPec, uFinWave;')
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
{ float t = uTime * uBeat * aSpd + aPhase;
  float wave = sin(t - sw * uWaveK - position.x * uWaveX / uLen) * uAmp * aAmp * uLen * sw;
  if (uAxis < 0.5) transformed.z += wave; else transformed.y += wave;
  if (aFin > 0.5 && aFin < 1.5) { float f = sin(t * 0.7 + 1.3); float d = abs(position.z); transformed.x += f * uPec * d; transformed.y += f * uPec * 0.4 * d; }
  if (aFin > 1.5) transformed.z += sin(t * 1.6 + position.x * 30.0 / uLen) * 0.03 * uLen * uFinWave; }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uDull;').replace('#include <map_fragment>', '#include <map_fragment>\n{ float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l) * 0.7, uDull); }');
  } });
  m.userData.u = u; return m;
}

// ---------------------------------------------------------------- species
const C = (h) => new THREE.Color(h);
const band = (x, c, w) => Math.abs(x - c) < w;
export const SPECIES = {
  clownfish: { len: 0.12, h: 0.42, w: 0.16, beat: 9, amp: 0.08, n: 2, behaviour: 'anemone', speed: 0.35, flee: 0,
    dorsal: { t0: 0.3, t1: 0.75, h: () => 0.14, lean: 0.3 }, anal: { t0: 0.2, t1: 0.42, h: () => 0.1 }, caudal: { len: 0.2, hb: 0.3, hc: 0.5, fork: -1 }, pectoral: { t: 0.6, len: 0.2, y: -0.05, rays: 4, a0: -0.1, a1: 1.0 },
    color: (x, y, z, part) => { if (part === 'caudal' || part === 'pectoral' || part === 'anal') return _c.set('#f2b23a'); if (band(x, 0.2, 0.045) || band(x, -0.14, 0.045)) return _c.set('#f4f0e6'); if (x > 0.3 || y < -0.25) return _c.set('#f08a2a'); if (part === 'dorsal') return _c.set('#e9a84a'); return _c.set('#2a1f1a'); } },
  parrotfish: { len: 0.55, h: 0.36, w: 0.17, beat: 2.2, amp: 0.012, pec: 0.5, n: 4, behaviour: 'graze', speed: 0.5, flee: 2.5, topK: 1.1, round: 0.55, taper: 0.8, eyeT: 0.82, eyeY: 0.2, night: 'cocoon',
    dorsal: { t0: 0.18, t1: 0.82, h: () => 0.1, lean: 0.2 }, anal: { t0: 0.15, t1: 0.5, h: () => 0.08 }, caudal: { len: 0.2, hb: 0.3, hc: 0.5, fork: 0.15 }, pectoral: { t: 0.66, len: 0.22, y: 0, rays: 5, a0: -0.3, a1: 1.2, droop: 0.4 },
    color: (x, y, z, part) => { if (part === 'caudal' || part === 'dorsal' || part === 'anal') return _c.set('#3fb8b0').lerp(C('#f0a06a'), 0.5 + 0.5 * Math.sin(y * 20)); if (part === 'pectoral') return _c.set('#5cc0c8'); const bar = Math.abs(Math.sin((x + 0.5) * Math.PI * 5.5)) > 0.85 && y > -0.2 ? 1 : 0; if (x > 0.42) return _c.set('#4fb3c4'); _c.set('#e9a070').lerp(C('#7fc7c4'), bar * 0.75); if (y < -0.28) _c.lerp(C('#f3d6b0'), 0.6); return _c; } },
  butterflyfish: { len: 0.2, h: 0.62, w: 0.12, beat: 6, amp: 0.05, n: 2, behaviour: 'pair', speed: 0.3, flee: 2, night: 'hide', round: 0.5, taper: 0.9, eyeT: 0.84, eyeY: 0.18,
    dorsal: { t0: 0.25, t1: 0.8, h: (s) => 0.12 + 0.1 * Math.sin(s * Math.PI), lean: 0.5 }, anal: { t0: 0.22, t1: 0.5, h: () => 0.12 }, caudal: { len: 0.18, hb: 0.3, hc: 0.5, fork: -1 }, pelvic: true,
    color: (x, y, z, part) => { if (part === 'caudal') return _c.set('#f5c21a'); if (band(x, 0.36, 0.035) && part === 'body') return _c.set('#141414'); if (part === 'dorsal' && x < -0.05 && y > 0.4) return _c.set('#101010'); if (x < -0.08 || part === 'dorsal' || part === 'anal') return _c.set('#f2c026'); const d1 = Math.abs(((x - y) * 11) % 1 - 0.5) < 0.1 && x < 0.3 && y > -0.1, d2 = Math.abs(((x + y) * 11) % 1 - 0.5) < 0.1 && y < -0.05 && x < 0.3; return _c.set(d1 || d2 ? '#6a6a6a' : '#f4f3ee'); } },
  moorishIdol: { len: 0.2, h: 0.72, w: 0.1, beat: 5, amp: 0.04, n: 3, behaviour: 'pair', speed: 0.3, flee: 2, night: 'hide', round: 0.45, taper: 1.05, ped: 0.14, eyeT: 0.8, eyeY: 0.22, pelvic: true,
    dorsal: { t0: 0.3, t1: 0.78, h: (s) => 0.2 + 0.55 * Math.pow(Math.max(0, 1 - Math.abs(s - 0.82) * 3), 2), lean: 1.2 }, anal: { t0: 0.2, t1: 0.52, h: () => 0.16 }, caudal: { len: 0.18, hb: 0.3, hc: 0.5, fork: 0.3 },
    color: (x, y, z, part) => { if (part === 'caudal') return _c.set('#111111'); if (part === 'dorsal' && y > 0.55) return _c.set('#f5f3ea'); if (x > 0.36) return _c.set(y > 0.05 ? '#f0b53c' : '#111111'); if (x > 0.08) return _c.set(y > 0.32 ? '#f0b53c' : '#f5f3ea'); if (x > -0.26) return _c.set('#111111'); if (x > -0.4) return _c.set('#f5f3ea'); return _c.set('#111111'); } },
  emperorAngelfish: { len: 0.35, h: 0.6, w: 0.14, beat: 4.5, amp: 0.035, n: 1, behaviour: 'wander', speed: 0.3, flee: 2.2, night: 'hide', round: 0.5, taper: 0.9, eyeT: 0.84, eyeY: 0.15, pelvic: true,
    dorsal: { t0: 0.2, t1: 0.82, h: (s) => 0.1 + 0.08 * Math.sin(s * Math.PI), lean: 0.6, soft: true }, anal: { t0: 0.15, t1: 0.5, h: () => 0.14, soft: true }, caudal: { len: 0.18, hb: 0.3, hc: 0.5, fork: -1 },
    color: (x, y, z, part) => { if (part === 'caudal') return _c.set('#f1c232'); if (x > 0.3) { if (band(x, 0.36, 0.08) && y > -0.2) return _c.set('#1d2d6a'); return _c.set('#e8e3c8'); } const s = Math.abs(((x * 0.7 + y * 0.9) * 10) % 1) < 0.42; return _c.set(s ? '#f3c21e' : '#2a44a8'); } },
  juvenileEmperor: { len: 0.1, h: 0.62, w: 0.14, beat: 7, amp: 0.05, n: 1, behaviour: 'hover', speed: 0.15, flee: 1.2, round: 0.5, taper: 0.9, eyeT: 0.84, eyeY: 0.15, pelvic: true, label: 'emperorAngelfish',
    dorsal: { t0: 0.2, t1: 0.82, h: () => 0.14, lean: 0.5 }, anal: { t0: 0.15, t1: 0.5, h: () => 0.12 }, caudal: { len: 0.18, hb: 0.3, hc: 0.5, fork: -1 },
    color: (x, y) => { const d = Math.hypot((x + 0.25) * 1.3, y * 0.85); const ring = Math.abs((d * 9) % 1 - 0.5) < 0.18; return _c.set(ring ? '#f3f4f8' : '#101c5a'); } },
  powderBlueTang: { len: 0.22, h: 0.46, w: 0.13, beat: 6.5, amp: 0.05, n: 26, behaviour: 'school', speed: 0.9, flee: 2.5, round: 0.6, taper: 0.9, eyeT: 0.84, eyeY: 0.16, night: 'hide',
    dorsal: { t0: 0.2, t1: 0.84, h: () => 0.13, lean: 0.4 }, anal: { t0: 0.18, t1: 0.55, h: () => 0.12 }, caudal: { len: 0.2, hb: 0.3, hc: 0.5, fork: 0.25 }, pectoral: { t: 0.64, len: 0.2, y: 0, rays: 4, a0: -0.2, a1: 1.1 },
    color: (x, y, z, part) => { if (part === 'dorsal') return _c.set('#f6cf2a'); if (part === 'anal') return _c.set('#f4f3ee'); if (part === 'caudal') return _c.set(Math.abs(y) > 0.4 || x < -0.66 ? '#111111' : '#f4f3ee'); if (part === 'pectoral') return _c.set('#f6cf2a'); if (x > 0.26) return _c.set(y < -0.22 ? '#f4f3ee' : '#141414'); if (band(x, -0.44, 0.03)) return _c.set('#f6cf2a'); return _c.set('#4f9fe0'); } },
  picassoTriggerfish: { len: 0.25, h: 0.5, w: 0.15, beat: 1.5, amp: 0.006, finWave: 1, n: 1, behaviour: 'wander', speed: 0.3, flee: 1.8, night: 'hide', round: 0.45, taper: 1.0, eyeT: 0.78, eyeY: 0.3, pectoral: { t: 0.6, len: 0.14, y: 0.05, rays: 4, a0: -0.2, a1: 1.0 },
    dorsal: { t0: 0.18, t1: 0.52, h: () => 0.14, lean: 0.3, soft: true }, dorsal2: { t0: 0.6, t1: 0.68, h: () => 0.16, lean: 0.6 }, anal: { t0: 0.18, t1: 0.5, h: () => 0.14, soft: true }, caudal: { len: 0.16, hb: 0.3, hc: 0.5, fork: 0.1 },
    color: (x, y, z, part) => { if (part === 'caudal') return _c.set('#e3ded0'); if (part === 'dorsal' || part === 'anal') return _c.set('#f1efe6'); if (part === 'pectoral') return _c.set('#e8e2cc'); if (x < -0.28 && Math.abs(((x + 0.5) * 24) % 1 - 0.5) < 0.22 && y > -0.3) return _c.set('#111111'); if (Math.abs((x - 0.3) + (y - 0.08) * 0.8) < 0.045 && y > -0.3 && x > -0.1) return _c.set('#2a5fd0'); if (Math.abs((x - 0.2) + (y + 0.14) * 0.8) < 0.022 && x > -0.1 && y < 0.1) return _c.set('#f2c21e'); if (Math.abs((x + 0.02) - (y + 0.08) * 1.1) < 0.075 && y < 0.2 && x > -0.4 && x < 0.3) return _c.set('#101010'); if (y < -0.3) return _c.set('#151515'); if (y > 0.22 && x > -0.05) return _c.set('#8d8848'); return _c.set('#ddd3b0'); } },
  cleanerWrasse: { len: 0.1, h: 0.2, w: 0.1, beat: 8, amp: 0.07, n: 2, behaviour: 'station', speed: 0.25, flee: 0, night: 'hide', round: 0.7, taper: 0.9, eyeT: 0.86, eyeY: 0.1, pelvic: false,
    dorsal: { t0: 0.2, t1: 0.85, h: () => 0.06, lean: 0.3 }, anal: { t0: 0.2, t1: 0.55, h: () => 0.05 }, caudal: { len: 0.18, hb: 0.3, hc: 0.45, fork: 0.2 },
    color: (x, y, z, part) => { if (part !== 'body') return _c.set('#8ec6ff'); const w = 0.1 + 0.4 * (0.5 - x); if (Math.abs(y) < w) return _c.set('#121212'); return _c.set(x < -0.1 ? '#3f7fe8' : '#dfe9f2'); } },
  sergeantMajor: { len: 0.18, h: 0.5, w: 0.14, beat: 6, amp: 0.05, n: 18, behaviour: 'school', speed: 0.6, flee: 2, round: 0.55, taper: 0.9, eyeT: 0.84, eyeY: 0.15, night: 'hide',
    dorsal: { t0: 0.2, t1: 0.82, h: () => 0.12, lean: 0.4 }, anal: { t0: 0.18, t1: 0.5, h: () => 0.1 }, caudal: { len: 0.2, hb: 0.3, hc: 0.5, fork: 0.45 },
    color: (x, y, z, part) => { if (part !== 'body') return _c.set('#d9dfc8'); const bars = Math.abs(((x + 0.5) * 5.2) % 1 - 0.5) < 0.16 && x < 0.35 && y > -0.35; if (bars) return _c.set('#1b1b1b'); return _c.set(y > 0.15 ? '#e7cf3a' : '#e8ecec'); } },
  lionfish: { len: 0.32, h: 0.38, w: 0.16, beat: 2, amp: 0.012, n: 1, behaviour: 'hover', speed: 0.12, flee: 0.8, round: 0.5, taper: 0.85, eyeT: 0.82, eyeY: 0.2, night: 'active',
    dorsal: { t0: 0.25, t1: 0.86, h: (s) => 0.12 + 0.32 * Math.abs(Math.sin(s * Math.PI * 12)) * (0.5 + 0.5 * Math.sin(s * Math.PI)), lean: 0.5 }, anal: { t0: 0.2, t1: 0.5, h: () => 0.16 }, caudal: { len: 0.24, hb: 0.3, hc: 0.55, fork: -1 },
    pectoral: { t: 0.62, len: 0.6, y: 0.0, rays: 11, a0: -0.5, a1: 1.6, droop: 0.9 },
    color: (x, y, z, part) => { if (part === 'pectoral') { const a = Math.atan2(y, x); return _c.set(Math.abs((a * 9) % 1 - 0.5) < 0.25 ? '#8c2f2a' : '#f0e6d8'); } if (part === 'caudal' || part === 'dorsal' || part === 'anal') return _c.set(Math.abs((y * 12) % 1 - 0.5) < 0.25 ? '#8c2f2a' : '#f1e8dc'); const b = Math.abs(((x + 0.5) * 13) % 1 - 0.5) < 0.24; return _c.set(b ? '#8c2f2a' : '#f0dfcc'); } },
};

// ---------------------------------------------------------------- schools and behaviour
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _m = new THREE.Matrix4(), _t = new THREE.Vector3(), _d = new THREE.Vector3();
export class School {
  constructor(key, S, home, env, extra = {}) {
    this.key = key; this.S = S; this.home = home; this.env = env; this.extra = extra; this.n = extra.n ?? S.n;
    this.geo = fishGeometry(S); this.mat = swimMaterial(S); registerThumb(S.label || key, this.geo);
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, this.n); this.mesh.frustumCulled = false; this.mesh.castShadow = extra.shadow ?? S.len > 0.3;
    const ph = new Float32Array(this.n), am = new Float32Array(this.n), sp = new Float32Array(this.n);
    this.fish = [];
    for (let i = 0; i < this.n; i++) {
      ph[i] = rnd() * TAU; am[i] = rr(0.8, 1.2); sp[i] = rr(0.85, 1.15);
      const p = new THREE.Vector3(home.x + rr(-1, 1) * home.r * 0.6, home.y + rr(-1, 1) * home.ry, home.z + rr(-1, 1) * home.r * 0.6);
      this.fish.push({ p, v: new THREE.Vector3(rr(-1, 1), 0, rr(-1, 1)).normalize().multiplyScalar(S.speed * 0.5), f: new THREE.Vector3(1, 0, 0), target: p.clone(), timer: rnd() * 3, pause: 0, bank: 0, s: rr(0.85, 1.15), hide: null, sleep: 0 });
    }
    this.geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1)); this.geo.setAttribute('aAmp', new THREE.InstancedBufferAttribute(am, 1)); this.geo.setAttribute('aSpd', new THREE.InstancedBufferAttribute(sp, 1));
    this.pick = this.fish.map((f) => ({ key: S.label || key, p: f.p, r: Math.max(0.25, S.len * 0.7), fish: f, school: this }));
    this.night = 0;
  }
  newTarget(f) {
    const h = this.home, b = this.S.behaviour;
    if (b === 'anemone') { const a = rnd() * TAU, d = rr(0.25, 0.55); f.target.set(h.x + Math.cos(a) * d, h.y + rr(0.2, 0.55), h.z + Math.sin(a) * d); f.timer = rr(0.4, 1.4); return; }
    if (b === 'station') { f.target.set(h.x + rr(-0.25, 0.25), h.y + rr(-0.2, 0.3), h.z + rr(-0.25, 0.25)); f.timer = rr(0.5, 1.2); return; }
    if (b === 'cloud') { f.target.set(h.x + rr(-1, 1) * h.r, h.y + rr(0, 1) * h.ry, h.z + rr(-1, 1) * h.r); f.timer = rr(0.8, 2.5); return; }
    if (b === 'hover') { f.target.set(h.x + rr(-0.4, 0.4) * h.r, h.y + rr(-0.3, 0.3) * h.ry, h.z + rr(-0.4, 0.4) * h.r); f.timer = rr(2, 5); return; }
    const a = rnd() * TAU, d = Math.sqrt(rnd()) * h.r;
    f.target.set(h.x + Math.cos(a) * d, h.y + rr(-1, 1) * h.ry, h.z + Math.sin(a) * d);
    const fl = terrainY(f.target.x, f.target.z); if (f.target.y < fl + 0.6) f.target.y = fl + 0.6;
    f.timer = rr(2, 6);
    if (b === 'graze' && rnd() < 0.5) f.pause = rr(1.5, 3);
  }
  update(dt, cam, night) {
    const S = this.S, fish = this.fish, b = S.behaviour, spd = S.speed;
    this.night += ((S.night === 'hide' || S.night === 'cocoon') && night ? 1 : 0 - this.night) * (1 - Math.exp(-dt * 0.5));
    if (this.mat.userData.u) this.mat.userData.u.uDull.value = (S.night === 'hide' || S.night === 'cocoon') ? this.night * 0.8 : 0;
    const act = S.night === 'active' ? (night ? 1.6 : 0.6) : 1;
    const dive = S.dive && Math.hypot(cam.position.x - this.home.x, cam.position.y - this.home.y, cam.position.z - this.home.z) < S.dive;
    for (let i = 0; i < fish.length; i++) {
      const f = fish[i]; let sp = spd * f.s * act;
      // hiding at night: go to a hide spot and stay still
      if ((S.night === 'hide' || S.night === 'cocoon') && night) {
        if (!f.hide) { const hs = this.env.hideSpots; f.hide = hs[(i * 7 + 3) % hs.length]; }
        _d.subVectors(f.hide, f.p); const dd = _d.length(); if (dd < 0.15) { f.v.multiplyScalar(Math.exp(-dt * 3)); f.sleep = Math.min(1, f.sleep + dt * 0.5); this.place(i, f, dt); continue; }
        f.sleep = 0; _d.multiplyScalar(sp * 1.4 / dd); f.v.lerp(_d, 1 - Math.exp(-dt * 2)); this.integrate(f, dt, cam); this.place(i, f, dt); continue;
      } else if (f.hide) { f.hide = null; f.sleep = 0; }
      if (dive) { if (!f.dove) { f.dove = 1; f.target.set(this.home.x + rr(-0.25, 0.25), this.home.y - 0.55, this.home.z + rr(-0.25, 0.25)); } f.timer = 0.4; sp *= 4; } else f.dove = 0;
      f.timer -= dt; if (f.timer <= 0) this.newTarget(f);
      if (f.pause > 0) { f.pause -= dt; f.v.multiplyScalar(Math.exp(-dt * 4)); this.integrate(f, dt, cam); this.place(i, f, dt); continue; }
      _d.subVectors(f.target, f.p); const dist = _d.length(); if (dist < 0.3 && !dive) f.timer = 0; if (dive && dist < 0.12) sp = 0; _d.multiplyScalar(1 / Math.max(dist, 0.01));
      _t.copy(_d).multiplyScalar(sp);
      if (b === 'school' || b === 'pair') { // cohesion + alignment + separation
        _u.set(0, 0, 0); _r.set(0, 0, 0); let c = 0;
        for (let j = 0; j < fish.length; j++) { if (j === i) continue; const g = fish[j]; const d2 = g.p.distanceToSquared(f.p); if (d2 < 9) { _u.add(g.v); _r.add(g.p); c++; if (d2 < (S.len * 1.6) ** 2) { _f.subVectors(f.p, g.p).multiplyScalar(0.9 / (d2 + 0.01)); _t.add(_f); } } }
        if (c) { _u.multiplyScalar(1 / c); _r.multiplyScalar(1 / c).sub(f.p); _t.addScaledVector(_u, 0.9).addScaledVector(_r, 0.5); if (b === 'pair' && i > 0) _t.addScaledVector(_r, 1.5); }
        if (b === 'school') { const tl = _t.length(); if (tl > 0) _t.multiplyScalar(sp / tl); }
      }
      // flee the swimmer
      if (S.flee > 0 && !dive) { _f.subVectors(f.p, cam.position); const d = _f.length(); if (d < S.flee) { _f.multiplyScalar((S.flee - d) * 4 / d); _t.add(_f); } }
      const k = 1 - Math.exp(-dt * (b === 'anemone' || b === 'station' || dive ? 6 : b === 'cloud' ? 3.5 : 2.2));
      f.v.lerp(_t, k);
      this.integrate(f, dt, cam); this.place(i, f, dt);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  integrate(f, dt, cam) {
    const S = this.S; const vl = f.v.length(), max = S.speed * (f.dove ? 6 : 2.6); if (vl > max) f.v.multiplyScalar(max / vl);
    f.p.addScaledVector(f.v, dt);
    const fl = terrainY(f.p.x, f.p.z) + (S.behaviour === 'anemone' ? 0.1 : 0.45); if (f.p.y < fl) { f.p.y = fl; if (f.v.y < 0) f.v.y *= -0.3; }
    if (f.p.y > -0.6) { f.p.y = -0.6; if (f.v.y > 0) f.v.y = 0; }
    if (S.behaviour !== 'anemone' && S.behaviour !== 'station') for (const e of this.env.rocks) rockPush(e, f.p, S.len * 0.5, f.v);
  }
  place(i, f, dt) {
    if (f.v.lengthSq() > 1e-4) { _f.copy(f.v).normalize(); const turn = _f.clone().cross(f.f).y; f.bank += (clamp(-turn * 6, -0.6, 0.6) - f.bank) * (1 - Math.exp(-dt * 3)); f.f.lerp(_f, 1 - Math.exp(-dt * 5)).normalize(); }
    _f.copy(f.f); if (Math.abs(_f.y) > 0.95) _f.y = 0.95 * Math.sign(_f.y);
    _r.crossVectors(_f, UP).normalize(); _u.crossVectors(_r, _f).normalize();
    if (f.bank) { _u.applyAxisAngle(_f, f.bank); _r.applyAxisAngle(_f, f.bank); }
    let sc = f.s; if (f.puffT) { const k = clamp((f.puffT - performance.now()) / 1000, 0, 1) * clamp((performance.now() - f.puff0) / 350, 0, 1); sc *= 1 + 0.9 * k; if (performance.now() > f.puffT) f.puffT = 0; }
    _m.makeBasis(_f, _u, _r); _m.setPosition(f.p); _m.scale(_t.setScalar(sc)); this.mesh.setMatrixAt(i, _m);
  }
}

// ---------------------------------------------------------------- build all fish
export function buildFish(scene, env, isMobile) {
  srand(99);
  const schools = [], pick = [];
  const add = (key, home, extra) => { const s = new School(key, SPECIES[key], home, env, extra); scene.add(s.mesh); schools.push(s); pick.push(...s.pick); return s; };
  const g = env.garden; // centre of the coral garden
  for (const a of env.anemones) add('clownfish', { x: a.x, y: a.y, z: a.z, r: 0.4, ry: 0.2 }, { n: 2 });
  const parrots = add('parrotfish', { x: g.x, y: g.y, z: g.z, r: 26, ry: 2.5 }, { n: isMobile ? 4 : 8 });
  // mucus cocoons for sleeping parrotfish
  const cocoonMat = new THREE.MeshStandardMaterial({ color: '#cfe9f3', transparent: true, opacity: 0.22, roughness: 0.25, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
  const cocoons = parrots.fish.map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), cocoonMat); m.visible = false; scene.add(m); return m; });
  add('butterflyfish', { x: g.x - 8, y: g.y, z: g.z - 4, r: 10, ry: 2 }, { n: 2 });
  add('butterflyfish', { x: g.x + 9, y: g.y, z: g.z + 10, r: 10, ry: 2 }, { n: 2 });
  add('moorishIdol', { x: g.x + 4, y: g.y + 1, z: g.z - 12, r: 12, ry: 2 }, { n: 3 });
  add('emperorAngelfish', { x: env.station.x, y: env.station.y, z: env.station.z, r: 5, ry: 1.2 }, { n: 1 });
  add('juvenileEmperor', { x: env.juvenile.x, y: env.juvenile.y, z: env.juvenile.z, r: 0.5, ry: 0.3 }, { n: 1 });
  add('powderBlueTang', { x: g.x, y: g.y + 1.0, z: g.z + 14, r: 18, ry: 2.5 }, { n: isMobile ? 22 : 55 });
  add('powderBlueTang', { x: g.x + 14, y: g.y + 1.5, z: g.z - 24, r: 18, ry: 2.5 }, { n: isMobile ? 10 : 40 });
  for (const [bx, bz] of [[-14, -22], [16, -30], [-6, 8], [12, 14]]) add('butterflyfish', { x: bx, y: g.y + 0.5, z: bz, r: 8, ry: 2 }, { n: 2 });
  add('moorishIdol', { x: g.x - 10, y: g.y + 1, z: g.z + 16, r: 12, ry: 2 }, { n: isMobile ? 3 : 5 });
  add('emperorAngelfish', { x: g.x - 12, y: g.y, z: g.z - 14, r: 8, ry: 1.5 }, { n: 1 });
  add('picassoTriggerfish', { x: env.rubble.x - 6, y: env.rubble.y, z: env.rubble.z, r: 10, ry: 1.5 }, { n: 1 });
  add('cleanerWrasse', { x: env.station.x, y: env.station.y, z: env.station.z, r: 0.3, ry: 0.3 }, { n: 2 });
  add('sergeantMajor', { x: g.x, y: g.y + 3.5, z: g.z + 30, r: 11, ry: 2 }, { n: isMobile ? 18 : 45 });
  add('sergeantMajor', { x: g.x - 10, y: g.y + 3, z: g.z - 10, r: 14, ry: 2 }, { n: isMobile ? 10 : 40 });
  add('lionfish', { x: env.lion.x, y: env.lion.y, z: env.lion.z, r: 1.2, ry: 0.5 }, { n: 1 });
  return { schools, pick, update: (dt, cam, night) => { for (const s of schools) s.update(dt, cam, night); cocoons.forEach((m, i) => { const f = parrots.fish[i]; m.visible = f.sleep > 0.03; if (m.visible) { m.position.copy(f.p); m.scale.set(0.45 * f.sleep, 0.3 * f.sleep, 0.3 * f.sleep); m.quaternion.setFromRotationMatrix(parrots.mesh.matrixWorld); } }); } };
}

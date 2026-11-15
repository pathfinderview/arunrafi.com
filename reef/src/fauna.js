// The non-fish animals: builders from animals.js, placed with behaviours, registered as pickables.
import * as THREE from 'three';
import * as A from './animals.js';
import { swimMaterial } from './fish.js';
import { coralMat } from './reef.js';
import { terrainY, rockPush } from './terrain.js';
import { srand, rnd, rr, clamp, lerp } from './noise.js';
import { registerThumb } from './thumbs.js';
import * as audio from './audio.js';

const TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0);
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();

// give a plain geometry the per-vertex attributes the swim shader expects from instances
function swimAttrs(geo) {
  const n = geo.attributes.position.count;
  if (!geo.attributes.aFin) geo.setAttribute('aFin', new THREE.BufferAttribute(new Float32Array(n), 1));
  if (!geo.attributes.sw) geo.setAttribute('sw', new THREE.BufferAttribute(new Float32Array(n), 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(n).fill(rnd() * TAU), 1));
  geo.setAttribute('aAmp', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
  geo.setAttribute('aSpd', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
  return geo;
}
const safe = (fn, label) => { try { return fn(); } catch (e) { console.warn('fauna: ' + label + ' failed', e); return null; } };

// A swimmer that follows a loop of waypoints, with floor and rock avoidance and smooth banking.
class Patrol {
  constructor(mesh, path, speed, o = {}) {
    this.mesh = mesh; this.path = path; this.speed = speed; this.o = o; this.i = 0; this.p = path[0].clone(); this.v = new THREE.Vector3(1, 0, 0); this.f = new THREE.Vector3(1, 0, 0); this.bank = 0; this.roll = 0; this.rollT = 0; this.surfaceT = rr(20, 60); this.surf = 0; this.s = o.scale ?? 1;
  }
  update(dt, cam, env) {
    const tgt = this.path[this.i]; _d.subVectors(tgt, this.p); const dist = _d.length();
    if (dist < (this.o.reach ?? 2)) this.i = (this.i + 1) % this.path.length;
    _d.multiplyScalar(this.speed / Math.max(dist, 0.01));
    // breathe: turtles, dugong, krait, dolphins rise to the surface now and then
    if (this.o.breathes) { this.surfaceT -= dt; if (this.surfaceT < 0) { this.surf = 1; this.surfaceT = rr(40, 110); } if (this.surf) { _d.y += this.speed * 0.8; if (this.p.y > -0.9) this.surf = 0; } }
    if (this.o.flee) { _f.subVectors(this.p, cam.position); const d = _f.length(); if (d < this.o.flee) _d.addScaledVector(_f, (this.o.flee - d) * 2 / d); }
    this.v.lerp(_d, 1 - Math.exp(-dt * (this.o.turn ?? 0.8)));
    this.p.addScaledVector(this.v, dt);
    const fl = terrainY(this.p.x, this.p.z) + (this.o.floor ?? 1.2); if (this.p.y < fl) { this.p.y = fl; if (this.v.y < 0) this.v.y *= -0.2; }
    if (this.p.y > -0.5) { this.p.y = -0.5; if (this.v.y > 0) this.v.y = 0; }
    for (const e of env.rocks) rockPush(e, this.p, this.o.margin ?? 1.0, this.v);
    // barrel roll for the manta
    if (this.o.rolls) { this.rollT -= dt; if (this.rollT < 0 && this.roll === 0) { this.roll = 0.001; this.rollT = rr(25, 60); } if (this.roll > 0) { this.roll += dt * 1.4; if (this.roll >= TAU) this.roll = 0; } }
    if (this.v.lengthSq() > 1e-4) { _f.copy(this.v).normalize(); const turn = _f.clone().cross(this.f).y; this.bank += (clamp(-turn * (this.o.bankK ?? 4), -0.7, 0.7) - this.bank) * (1 - Math.exp(-dt * 2)); this.f.lerp(_f, 1 - Math.exp(-dt * 3)).normalize(); }
    _f.copy(this.f); if (Math.abs(_f.y) > 0.9) _f.y = 0.9 * Math.sign(_f.y);
    _r.crossVectors(_f, UP).normalize(); _u.crossVectors(_r, _f).normalize();
    const rollA = this.bank + this.roll; if (rollA) { _u.applyAxisAngle(_f, rollA); _r.applyAxisAngle(_f, rollA); }
    _m.makeBasis(_f, _u, _r); _m.setPosition(this.p); _m.scale(_u.setScalar(this.s)); this.mesh.matrix.copy(_m); this.mesh.matrixAutoUpdate = false; this.mesh.matrixWorldNeedsUpdate = true;
  }
}
const loop = (pts) => pts.map(([x, y, z]) => new THREE.Vector3(x, y, z));

export function buildFauna(scene, env, isMobile) {
  srand(2024);
  const pick = [], actors = [], statics = [];
  const add = (key, p, r) => pick.push({ key, p, r });
  const g = (fn, label) => safe(() => fn(1), label);
  const plain = coralMat({ rough: 0.6 }), swayMat = coralMat({ sway: 0.03, rough: 0.6 });
  const surf = (x, z) => terrainY(x, z);

  // ---- turtles: body + four flippers, flippers flap
  function turtle(key, build, path, speed, scale) {
    const parts = safe(() => build(1), key); if (!parts) return;
    const grp = new THREE.Group(); const body = new THREE.Mesh(parts.body, plain); body.castShadow = true; grp.add(body);
    parts.body.computeBoundingBox(); const bb = parts.body.boundingBox, L = bb.max.x - bb.min.x, W = bb.max.z - bb.min.z;
    const fl = [];
    for (const [fx, geo, side] of [[0.22, parts.flipperFront, 1], [0.22, parts.flipperFront, -1], [-0.3, parts.flipperRear, 1], [-0.3, parts.flipperRear, -1]]) {
      const m = new THREE.Mesh(geo, plain); m.position.set(bb.min.x + L * (0.5 + fx), bb.min.y + (bb.max.y - bb.min.y) * 0.3, side * W * 0.42); m.scale.z = side; m.castShadow = true; grp.add(m); fl.push({ m, side, front: fx > 0 });
    }
    registerThumb(key, grp); scene.add(grp);
    const pat = new Patrol(grp, path, speed, { breathes: true, floor: 0.8, flee: 2.5, scale, margin: 0.9 });
    actors.push({ update: (dt, cam, t) => { pat.update(dt, cam, env); for (const f of fl) { const ph = t * (f.front ? 1.6 : 1.2) + (f.side > 0 ? 0 : 0.4); f.m.rotation.x = f.side * (f.front ? 0.5 : 0.25) * Math.sin(ph); f.m.rotation.y = f.front ? 0.25 * Math.sin(ph + 1) : 0; } } });
    add(key, pat.p, 0.9 * scale);
  }
  turtle('hawksbillTurtle', A.hawksbillTurtle, loop([[-20, -6, 0], [-8, -4, -28], [12, -5, -44], [22, -7, -14], [8, -4, 4]]), 0.45, 1);
  turtle('greenTurtle', A.greenTurtle, loop([[-50, -8, -14], [-62, -7, 2], [-48, -6, 12], [-40, -8, -2]]), 0.4, 1);

  // ---- single-mesh swimmers on loops
  function swimmer(key, build, S, path, speed, o = {}) {
    const geo = safe(() => build(1), key); if (!geo) return null;
    swimAttrs(geo); const mat = swimMaterial(S); const m = new THREE.Mesh(geo, mat); m.castShadow = o.shadow ?? true; m.frustumCulled = false; scene.add(m); registerThumb(key, geo);
    const pat = new Patrol(m, path, speed, o); actors.push({ update: (dt, cam) => pat.update(dt, cam, env) }); add(key, pat.p, o.r ?? 1); return pat;
  }
  // blacktip reef shark: lagoon shallows, sometimes through the channel
  swimmer('blacktipReefShark', A.blacktipReefShark, { len: 1.4, beat: 3.2, amp: 0.05, waveK: 4, rough: 0.6 }, loop([[-30, -4, -80], [10, -3.5, -92], [40, -4, -78], [30, -5, -58], [0, -6, -40], [-6, -6, -5], [8, -5.5, 24], [34, -5, 40], [40, -4.5, -20], [10, -4, -66]]), 1.3, { turn: 0.9, floor: 1.0, r: 1.0 });
  swimmer('blacktipReefShark', A.blacktipReefShark, { len: 1.4, beat: 3.2, amp: 0.05, waveK: 4, rough: 0.6 }, loop([[20, -4, -84], [-20, -3.5, -96], [-44, -5, -70], [-30, -5, -60], [-10, -4, -82]]), 1.2, { turn: 0.9, floor: 1.0, r: 1.0 });
  // reef manta: soaring along the drop-off, rolls now and then
  swimmer('reefManta', A.reefManta, { len: 2.2, beat: 1.1, amp: 0.22, axis: 1, waveK: 1.6, rough: 0.55 }, loop([[-40, -10, 60], [-10, -14, 78], [25, -9, 70], [48, -12, 48], [20, -8, 36], [-20, -11, 46]]), 1.6, { turn: 0.6, floor: 3, r: 1.9, rolls: true, bankK: 2 });
  // spotted eagle ray: low over the sand of the channel and lagoon
  swimmer('eagleRay', A.eagleRay, { len: 1.1, beat: 1.6, amp: 0.2, axis: 1, waveK: 1.6, rough: 0.55 }, loop([[0, -9, 30], [6, -9, 0], [-4, -8, -26], [4, -7, -44], [30, -7, -60], [46, -6, -30], [40, -8, 8], [20, -9, 34]]), 1.1, { turn: 0.7, floor: 1.0, r: 1.0, bankK: 3 });
  // spinner dolphins: a pod near the surface out in the blue
  for (let i = 0; i < (isMobile ? 3 : 4); i++) swimmer('spinnerDolphin', A.spinnerDolphin, { len: 1.9, beat: 2.4, amp: 0.1, axis: 1, waveK: 3.5, rough: 0.45 }, loop([[-70 + i * 3, -2.5 - i * 0.6, 40 + i * 2], [-30, -3, 80 + i], [30, -2.5, 86 - i * 2], [70, -4, 50 + i], [60, -3, -10], [20, -2.5, 30 - i * 2], [-30, -3.5, 20 + i]]), 2.6, { turn: 1.0, floor: 2, r: 1.2, breathes: true, bankK: 2 });
  // dugong: grazing the meadow, rising to breathe
  swimmer('dugong', A.dugong, { len: 2.8, beat: 0.9, amp: 0.07, axis: 1, waveK: 2.5, rough: 0.7 }, loop([[-60, -9.5, -12], [-50, -9.5, 0], [-58, -9.5, 10], [-68, -9.5, 0], [-64, -9.5, -14]]), 0.35, { turn: 0.5, floor: 0.9, r: 1.6, breathes: true, flee: 3 });
  // banded sea krait: winding along the rocks at the meadow edge
  swimmer('seaKrait', A.seaKrait, { len: 1.2, beat: 3.5, amp: 0.1, waveK: 9, rough: 0.5 }, loop([[-40, -9, -2], [-36, -8, -14], [-30, -9, -22], [-26, -8.5, -10], [-32, -9, 2], [-44, -8.5, 8]]), 0.45, { turn: 1.2, floor: 0.35, r: 0.5, breathes: true, margin: 0.3, shadow: false });

  // ---- giant moray in a hole in the rock wall, jaw pumping; comes further out at night
  const mor = safe(() => A.giantMoray(1), 'giantMoray');
  if (mor) {
    const sp = env.rockSpots(env.big.slice(2, 8), 1, -0.2, 0.45, 1.0)[0];
    if (sp) {
      const grp = new THREE.Group(); const body = new THREE.Mesh(swimAttrs(mor.body), swimMaterial({ len: 2.4, beat: 0.8, amp: 0.015, waveK: 4 })); const jaw = new THREE.Mesh(mor.jaw, plain); if (A.MORAY_JAW_PIVOT) jaw.position.copy(A.MORAY_JAW_PIVOT); grp.add(body, jaw);
      grp.position.copy(sp.p).addScaledVector(sp.n, -0.55); _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), sp.n.clone().setY(Math.max(0, sp.n.y)).normalize()); grp.quaternion.copy(_q); grp.userData.base = grp.position.clone(); grp.userData.n = sp.n.clone();
      scene.add(grp); registerThumb('giantMoray', mor.body);
      const head = sp.p.clone().addScaledVector(sp.n, 0.3); add('giantMoray', head, 0.6);
      actors.push({ update: (dt, cam, t, night) => { jaw.rotation.z = -0.22 + 0.2 * Math.sin(t * 2.2); const out = night ? 0.5 : 0; grp.position.copy(grp.userData.base).addScaledVector(grp.userData.n, out); head.copy(sp.p).addScaledVector(sp.n, 0.3 + out); } });
    }
  }
  // ---- static or near-static invertebrates
  function sit(key, build, spots, scale, o = {}) {
    const geo = safe(() => build(o.seed ?? 1), key); if (!geo) return; registerThumb(key, geo); const mat = o.sway ? swayMat : plain;
    spots.forEach((sp, i) => { const m = new THREE.Mesh(geo, mat); m.position.copy(sp.p).addScaledVector(sp.n, o.lift ?? 0.01); _q.setFromUnitVectors(UP, sp.n.clone().lerp(UP, o.upBlend ?? 0.3).normalize()); m.quaternion.copy(_q); m.rotateY(rnd() * TAU); const s = scale * rr(0.85, 1.15); m.scale.setScalar(s); m.castShadow = o.shadow ?? true; scene.add(m); statics.push(m); add(key, m.position, (o.r ?? 0.3) * s); if (o.each) o.each(m, i); });
  }
  const near = env.start;
  sit('dayOctopus', A.dayOctopus, env.rockSpots(env.big.slice(0, 6), 1, 0.5, 1, 1.2, near), 1, { sway: true, r: 0.5, each: (m) => { actors.push({ update: (dt, cam, t) => { const k = 0.5 + 0.5 * Math.sin(t * 0.35); m.material = swayMat; } }); } });
  sit('cuttlefish', A.cuttlefish, [{ p: new THREE.Vector3(-34, surf(-34, 6) + 0.5, 6), n: UP }], 1, { r: 0.35, shadow: true, each: (m) => {
    const geo = m.geometry; swimAttrs(geo); m.material = swimMaterial({ len: 0.35, beat: 9, amp: 0.05, axis: 1, waveK: 0, waveX: 10 }); const base = m.position.clone();
    actors.push({ update: (dt, cam, t) => { m.position.set(base.x + Math.sin(t * 0.13) * 2.5, base.y + 0.15 * Math.sin(t * 0.5), base.z + Math.cos(t * 0.11) * 2.0); m.rotation.y = Math.atan2(-(Math.cos(t * 0.11) * 0.22), Math.cos(t * 0.13) * 0.325) ; } }); } });
  sit('diademaUrchin', A.diademaUrchin, env.rockSpots(env.big, 8, -0.3, 0.6, 1.0), 1, { sway: true, r: 0.3, lift: 0.04, upBlend: 0.5, shadow: false });
  sit('blueSeaStar', A.blueSeaStar, env.rockSpots(env.big.slice(0, 6), 2, 0.6, 1, 1.0, near).concat(env.sandSpots(env.rubble.x, env.rubble.z, 10, 1, 1)), 1, { r: 0.2, shadow: false, upBlend: 0 });
  sit('seaCucumber', A.seaCucumber, env.sandSpots(env.rubble.x, env.rubble.z, 12, 3, 1.5).concat(env.sandSpots(0, -20, 30, 2, 1.5)), 1, { r: 0.25, shadow: false, lift: 0.03 });
  sit('crownOfThorns', A.crownOfThorns, env.sandSpots(0, -30, 30, 1, 2), 1, { r: 0.3, shadow: false, lift: 0.08 });
  sit('nudibranch', A.nudibranch, env.rockSpots(env.big.slice(0, 4), 2, 0.2, 1, 0.5, near), 1.4, { r: 0.1, shadow: false, lift: 0.01, upBlend: 0 });
  // snapping shrimp at a burrow in the rubble: a dark hole with the shrimp half out
  { const sp = env.sandSpots(env.rubble.x - 4, env.rubble.z - 2, 5, 1, 1)[0]; const geo = safe(() => A.snappingShrimp(1), 'snappingShrimp');
    if (sp && geo) { const hole = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), new THREE.MeshBasicMaterial({ color: '#0a0806' })); hole.rotation.x = -Math.PI / 2; hole.position.copy(sp.p).add(new THREE.Vector3(0, 0.015, 0)); scene.add(hole);
      const m = new THREE.Mesh(geo, plain); m.position.copy(sp.p).add(new THREE.Vector3(0.03, 0.012, 0)); m.scale.setScalar(1.3); scene.add(m); registerThumb('snappingShrimp', geo); add('snappingShrimp', m.position, 0.5);
      let tS = 3; actors.push({ update: (dt, cam) => { tS -= dt; if (tS < 0) { tS = rr(2, 7); if (cam.position.distanceTo(m.position) < 6) audio.snap(); } m.position.x = sp.p.x + 0.03 + 0.02 * Math.sin(performance.now() * 0.002); } }); } }

  return { pick, update: (dt, cam, t, night) => { for (const a of actors) a.update(dt, cam, t, night); } };
}

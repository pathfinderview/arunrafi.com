import * as THREE from 'three';
import { U, makeSurface, makeSnow, makePost, makeDayNight } from './ocean.js';
import { terrainY, makeSand, rockPush, setLow } from './terrain.js';
import { buildReef } from './reef.js';
import { buildFish } from './fish.js';
import { buildMoreFish } from './morefish.js';
import { buildTopside } from './topside.js';
import { makeBubbles } from './bubbles.js';
import { createLearn } from './learn.js';
import * as audio from './audio.js';
import { createControls } from './controls.js';

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches, isMobile = isTouch || innerWidth < 800;
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene(); scene.background = new THREE.Color('#1a7fa8');
const camera = new THREE.PerspectiveCamera(isMobile ? 72 : 62, innerWidth / innerHeight, 0.1, 500);
const BOAT = { x: 0, z: 21.2 }, SEAT = new THREE.Vector3(0.62, 1.12, BOAT.z);
camera.position.copy(SEAT);

if (/[?&]mute/.test(location.search)) audio.setMuted(true); // silent testing: add ?mute to the address
// ---- light
const sun = new THREE.DirectionalLight('#fff4dc', 2.6); sun.position.copy(U.uSunDir.value).multiplyScalar(80); sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 220 });
sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048); sun.shadow.radius = 4; sun.shadow.normalBias = 0.08; sun.shadow.bias = -0.0005;
const sunTarget = new THREE.Object3D(); scene.add(sunTarget); sun.target = sunTarget; scene.add(sun);
const hemi = new THREE.HemisphereLight('#8fdcee', '#0b3c5c', 1.3); scene.add(hemi);

// ---- world
setLow(isMobile);
const surface = makeSurface(); scene.add(surface); scene.add(makeSand(isMobile));
const snow = makeSnow(isMobile ? 900 : 1500); snow.material.uniforms.uPx.value = renderer.getPixelRatio(); scene.add(snow);
const bubbles = makeBubbles(isMobile ? 500 : 900, renderer.getPixelRatio()); scene.add(bubbles.pts);
const topside = buildTopside(scene, BOAT);
const reef = buildReef(scene, isMobile); const rocks = reef.rocks;
const fish = buildFish(scene, reef.spots, isMobile);
const more = buildMoreFish(scene, reef.spots, isMobile);
let night = false;
const pickables = reef.pick.concat(fish.pick, more.pick);
let fauna = null, smalls = null;
import('./fauna.js').then(async (m) => {
  fauna = m.buildFauna(scene, reef.spots, isMobile); pickables.push(...fauna.pick); window.__reef.fauna = fauna;
  const s = await import('./smalls.js'); smalls = s.buildSmalls(scene, reef.spots, pickables, isMobile); pickables.push(...smalls.pick); window.__reef.smalls = smalls;
}).catch((e) => console.warn('fauna not loaded', e));

// ---- post + time of day
const post = makePost(renderer, scene, camera, isMobile);
const dayNight = makeDayNight({ sun, hemi, scene, renderer, post, surface });
const SUN_SVG = $('sun').innerHTML, MOON_SVG = '<svg viewBox="0 0 24 24"><path d="M15.5 3.5a8.5 8.5 0 1 0 5 15.3A9 9 0 0 1 15.5 3.5z"/></svg>';
let dayT = 0; const DAY = [330, 80, 170, 80]; // a slow day of its own: noon, dusk, night, dawn in seconds
const setPhase = (p) => { dayT = 0; dayNight.set(p); $('sun').innerHTML = dayNight.phase === 2 ? MOON_SVG : SUN_SVG; $('sun').style.transform = `rotate(${dayNight.phase * 90}deg)`; };
$('sun').addEventListener('click', () => setPhase(dayNight.phase + 1));
addEventListener('keydown', (e) => { if (e.code === 'KeyN') setPhase(dayNight.phase + 1); if (e.code === 'KeyM') audio.toggleMute(); });

// ---- controls + learning
const clampPos = (p) => {
  const r = Math.hypot(p.x, p.z); if (r > 140) { p.x *= 140 / r; p.z *= 140 / r; }
  const floor = terrainY(p.x, p.z) + 0.55; if (p.y < floor) p.y = floor; if (p.y > -0.7) p.y = -0.7;
  for (const m of rocks) rockPush(m.userData.ell, p, 0.5);
};
const controls = createControls(camera, canvas, { yaw: Math.PI / 2, pitch: -0.06, pointerLock: true, isTouch, clamp: clampPos, speed: 5.5 });
controls.st.suspend = true;
let paused = false;
const taps = { onTap(key, p, pk) { reef.onTap(key, p); more.onTap(key, pk); if (smalls) smalls.onTap(key, pk); } };
const learn = createLearn({ camera, controls, pickables, reef: taps, isTouch, getNight: () => night, clamp: clampPos, onPause: (p) => { paused = p; } });
controls.st.onTap = (nx, ny) => learn.tap(nx, ny);

function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); post.resize(); }
addEventListener('resize', resize); resize();

// ---- the dive: sit on the gunwale, roll backwards, sink through your own bubbles
const intro = { phase: 'boat', t: 0, splashed: false, trail: 0 };
const ease = (a, b, t) => { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t); }, mix = (a, b, t) => a + (b - a) * t;
const _p = new THREE.Vector3(), _fw = new THREE.Vector3();
$('dive').onclick = () => { audio.unlock(); $('start').classList.add('gone'); intro.phase = 'roll'; intro.t = 0; };
function runIntro(dt, time) {
  if (intro.phase === 'boat') { camera.position.set(SEAT.x, SEAT.y + Math.sin(time * 1.1) * 0.03, SEAT.z); controls.setLook(Math.PI / 2 + Math.sin(time * 0.23) * 0.07, -0.06 + Math.sin(time * 0.31) * 0.025); return; }
  const T = (intro.t += dt), a = ease(0, 0.95, T), s = ease(0.9, 2.5, T), f = ease(2.6, 6.4, T);
  let x = SEAT.x + 0.8 * a + 0.35 * s, y = SEAT.y - 0.92 * a * a - 3.0 * s, z = SEAT.z, yaw = Math.PI / 2, pitch = -0.06 + 1.33 * a - 0.12 * s;
  x = mix(x, 0, f); y = mix(y, -6.5, f); z = mix(z, 19.2, f); yaw = mix(yaw, 0, f); pitch = mix(pitch, -0.04, f);
  camera.position.set(x, y, z); controls.setLook(yaw, pitch);
  if (!intro.splashed && y < 0.02) { intro.splashed = true; audio.splash(); bubbles.emit(_p.set(x - 0.2, -0.35, z), isMobile ? 160 : 320, 0.75, 2.2); }
  if (intro.splashed && T < 4.2) { intro.trail -= dt; if (intro.trail < 0) { intro.trail = 0.07; bubbles.emit(_p.set(x - 0.3, y - 0.2, z), 7, 0.35, 1.2); } }
  if (T >= 6.4) { intro.phase = 'done'; controls.st.suspend = false; controls.st.enabled = true; $('dots').style.opacity = 1;
    const h = $('hint'); h.textContent = isTouch ? 'Drag to look · hold to swim · tap anything alive' : 'Drag or click to look · W A S D to swim · click anything alive'; h.style.opacity = 0.6; setTimeout(() => { h.style.opacity = 0; }, 9000); }
}

// ---- a soft ring that points out something you have not met yet, when you have been idle a while
const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffe6a8', transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
ring.renderOrder = 20; ring.visible = false; scene.add(ring);
const hintS = { next: 14, until: 0, pk: null };
function hintRing(time, dt) {
  const ls = learn.st;
  if (ls.focus || intro.phase !== 'done') { ring.visible = false; hintS.pk = null; hintS.next = time + 12; return; }
  if (!hintS.pk && time > hintS.next) {
    camera.getWorldDirection(_fw); let best = null, bd = 1e9;
    for (const pk of pickables) { if (learn.found.has(pk.key)) continue; _p.subVectors(pk.p, camera.position); const d = _p.length(); if (d < 1.5 || d > 22) continue; if (_p.dot(_fw) / d < 0.55) continue; if (d < bd) { bd = d; best = pk; } }
    if (best) { hintS.pk = best; hintS.until = time + 7; } else hintS.next = time + 5;
  }
  if (hintS.pk) { const pk = hintS.pk, k = (hintS.until - time) / 7; if (k <= 0 || learn.found.has(pk.key)) { hintS.pk = null; hintS.next = time + 16; ring.visible = false; return; }
    ring.visible = true; ring.position.copy(pk.p); ring.quaternion.copy(camera.quaternion); const pulse = 0.5 + 0.5 * Math.sin(time * 4); ring.scale.setScalar(Math.max(0.18, pk.r * 1.5) * (1 + 0.12 * pulse)); ring.material.opacity = 0.55 * Math.sin(Math.PI * Math.min(1, Math.max(0, k))) * (0.6 + 0.4 * pulse); }
}

let last = performance.now(), breathT = 4;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; step(dt);
}
function step(dt) {
  const time = (U.uTime.value += dt);
  if (intro.phase !== 'done') runIntro(dt, time);
  else { dayT += dt; if (dayT > DAY[dayNight.phase]) setPhase(dayNight.phase + 1); }
  dayNight.update(dt); night = dayNight.night;
  controls.update(dt);
  const above = topside.update(time, camera); snow.visible = !above; post.state.mul = above ? 0 : 1;
  snow.material.uniforms.uSpark.value += (Math.min(1, controls.st.speed / 4) - snow.material.uniforms.uSpark.value) * (1 - Math.exp(-dt * 2));
  reef.update(time, dt, camera);
  const wdt = paused ? 0 : dt; // while you hold a creature the world waits, but tap reactions still play
  fish.update(wdt, camera, night); more.update(wdt, camera, night);
  if (fauna && !paused) fauna.update(dt, camera, time, night);
  if (smalls) smalls.update(wdt, camera, time);
  learn.update(dt); hintRing(time, dt);
  // the diver breathes: a slow inhale, then bubbles past the mask
  if (intro.phase === 'done' && !paused) { breathT -= dt; if (breathT < 0) { breathT = 6.5; audio.breathe(); setTimeout(() => { camera.getWorldDirection(_fw); bubbles.emit(_p.copy(camera.position).addScaledVector(_fw, 0.35).add(new THREE.Vector3(0, -0.28, 0)), 16, 0.12, 0.8); }, 1900); } }
  bubbles.update(dt, time);
  audio.update(controls.st.speed, camera.position.y, night);
  sunTarget.position.copy(camera.position); sun.position.copy(U.uSunDir.value).multiplyScalar(90).add(camera.position);
  post.render();
}
requestAnimationFrame(frame);
window.__reef = { step, scene, camera, renderer, U, post, controls, reef, fish, more, learn, pickables, dayNight, setPhase, intro, bubbles, topside };

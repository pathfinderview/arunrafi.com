import * as THREE from 'three';
import { U, oceanify, makeSurface, makeSnow, makePost, makeDayNight } from './ocean.js';
import { terrainY, makeSand, rockPush, setLow } from './terrain.js';
import { buildReef } from './reef.js';
import { buildFish } from './fish.js';
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
camera.position.set(0, -6.5, 20);

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
const reef = buildReef(scene, isMobile); const rocks = reef.rocks;
const fish = buildFish(scene, reef.spots, isMobile);
let night = false;
const pickables = reef.pick.concat(fish.pick);
let fauna = null;
import('./fauna.js').then((m) => { fauna = m.buildFauna(scene, reef.spots, isMobile); pickables.push(...fauna.pick); window.__reef.fauna = fauna; }).catch((e) => console.warn('fauna not loaded', e));

// ---- post + controls
const post = makePost(renderer, scene, camera, isMobile);
const dayNight = makeDayNight({ sun, hemi, scene, renderer, post, surface });
const SUN_SVG = $('sun').innerHTML, MOON_SVG = '<svg viewBox="0 0 24 24"><path d="M15.5 3.5a8.5 8.5 0 1 0 5 15.3A9 9 0 0 1 15.5 3.5z"/></svg>';
const setPhase = (p) => { dayNight.set(p); $('sun').innerHTML = dayNight.phase === 2 ? MOON_SVG : SUN_SVG; $('sun').style.transform = `rotate(${dayNight.phase * 90}deg)`; };
$('sun').addEventListener('click', () => setPhase(dayNight.phase + 1));
addEventListener('keydown', (e) => { if (e.code === 'KeyN') setPhase(dayNight.phase + 1); });
const tmp = new THREE.Vector3();
const clampPos = (p) => {
  const r = Math.hypot(p.x, p.z); if (r > 140) { p.x *= 140 / r; p.z *= 140 / r; }
  const floor = terrainY(p.x, p.z) + 0.55; if (p.y < floor) p.y = floor; if (p.y > -0.7) p.y = -0.7;
  for (const m of rocks) rockPush(m.userData.ell, p, 0.5);
};
const controls = createControls(camera, canvas, { yaw: 0, pitch: 0.05, pointerLock: true, isTouch, clamp: clampPos, speed: 5.5 });
let paused = false;
const learn = createLearn({ camera, controls, pickables, reef, isTouch, getNight: () => night, clamp: clampPos, onPause: (p) => { paused = p; } });
controls.st.onTap = (nx, ny) => learn.tap(nx, ny);
addEventListener('keydown', (e) => { if (e.code === 'KeyM') audio.toggleMute(); });

function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); post.resize();
}
addEventListener('resize', resize); resize();

$('dive').onclick = () => { audio.unlock(); $('start').classList.add('gone'); controls.st.enabled = true; $('dots').style.opacity = 1; $('hint').textContent = isTouch ? 'Drag to look · hold to swim · tap a creature' : 'Drag or click to look · W A S D to swim · click a creature'; setTimeout(() => { $('hint').style.opacity = 0; }, 9000); };

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  U.uTime.value += dt;
  dayNight.update(dt); night = dayNight.night;
  snow.material.uniforms.uSpark.value += (Math.min(1, controls.st.speed / 4) - snow.material.uniforms.uSpark.value) * (1 - Math.exp(-dt * 2));
  controls.update(dt);
  reef.update(U.uTime.value, dt, camera);
  if (!paused) { fish.update(dt, camera, night); if (fauna) fauna.update(dt, camera, U.uTime.value, night); }
  learn.update(dt);
  audio.update(controls.st.speed, camera.position.y, night);
  sunTarget.position.copy(camera.position); sun.position.copy(U.uSunDir.value).multiplyScalar(90).add(camera.position);
  post.render();
}
requestAnimationFrame(frame);
window.__reef = { scene, camera, renderer, U, post, controls, reef, fish, learn, pickables, dayNight, setPhase };

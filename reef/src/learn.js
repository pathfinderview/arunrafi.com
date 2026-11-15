// Tap-to-learn: picking, the camera glide, name and caption, found dots, and the field guide.
import * as THREE from 'three';
import { FACTS } from './facts.js';
import * as audio from './audio.js';
import { THUMBS } from './thumbs.js';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _o = new THREE.Vector3(), _w = new THREE.Vector3();

export function createLearn({ camera, controls, pickables, reef, isTouch, getNight, clamp, onPause }) {
  const keys = Object.keys(FACTS);
  let found; try { found = new Set(JSON.parse(localStorage.getItem('reef.found') || '[]')); } catch (e) { found = new Set(); }
  const save = () => { try { localStorage.setItem('reef.found', JSON.stringify([...found])); } catch (e) { /* private mode */ } };
  const st = { focus: null, off: new THREE.Vector3(), until: 0, time: 0, captionUntil: 0, hover: null, hinted: false };
  const orb = { theta: 0, phi: 0.35, dist: 2, min: 0.5, max: 8 };
  const hintEl = $('hint');
  const dots = $('dots'), nameEl = $('name'), capEl = $('caption'), lookEl = $('look'), aimEl = $('aim'), guide = $('guide'), grid = $('grid');
  keys.forEach((k) => { const i = document.createElement('i'); i.dataset.k = k; dots.appendChild(i); });
  const refreshDots = () => { for (const i of dots.children) i.classList.toggle('on', found.has(i.dataset.k)); $('guideCount').textContent = `${found.size} of ${keys.length} found`; };
  refreshDots();
  dots.style.pointerEvents = 'auto'; dots.style.cursor = 'pointer'; dots.style.minHeight = '28px'; dots.style.alignItems = 'center';
  dots.addEventListener('click', () => openGuide(true));
  $('close').addEventListener('click', () => openGuide(false));

  // ---- picking: closest pickable to the tap ray, with a tolerance that grows with distance
  const ray = new THREE.Raycaster();
  function pickAt(nx, ny, maxD = 45) {
    ray.setFromCamera(_v.set(nx * 2 - 1, ny * 2 - 1), camera);
    const o = ray.ray.origin, dir = ray.ray.direction; let best = null, bs = 1e9;
    for (const pk of pickables) {
      _d.subVectors(pk.p, o); const t = _d.dot(dir); if (t < 0.12 || t > maxD) continue;
      _w.copy(dir).multiplyScalar(t); const d = _d.sub(_w).length(); const tol = pk.r + 0.03 * t; if (d > tol) continue;
      const score = d / tol + t * 0.035; if (score < bs) { bs = score; best = pk; }
    }
    return best;
  }
  function tap(nx, ny) {
    if (guide.classList.contains('open')) return;
    const pk = pickAt(nx, ny);
    if (pk) focus(pk); else release(true);
  }
  function focus(pk) {
    const f = FACTS[pk.key]; if (!f) return;
    st.focus = pk; st.until = Infinity;
    // orbit start: keep the current bearing, pull back so the whole creature fits, a little above it
    _d.subVectors(camera.position, pk.p); const len = _d.length() || 1; if (len < 1e-3) _d.set(0, 0.3, 1);
    orb.theta = Math.atan2(_d.x, _d.z); orb.phi = THREE.MathUtils.clamp(Math.asin(_d.y / len), 0.15, 0.9);
    orb.dist = Math.max(1.3, pk.r * 4.2); orb.min = Math.max(0.45, pk.r * 1.5); orb.max = Math.max(7, pk.r * 11);
    controls.st.suspend = true; controls.st.inspect = true; if (onPause) onPause(true);
    if (!st.hinted) { st.hinted = true; hintEl.textContent = isTouch ? 'Drag to look around it · pinch to zoom · tap the water to let it go' : 'Drag to look around it · scroll to zoom · click the water to let it go'; hintEl.classList.add('top'); hintEl.style.opacity = 0.6; setTimeout(() => { hintEl.style.opacity = 0; }, 7000); }
    const night = getNight() && f.night; const variant = night ? 'night' : null;
    nameEl.textContent = f.name; capEl.innerHTML = `${f.hook}<small>${f.sci} · ${f.size}</small>`; nameEl.style.opacity = 1; capEl.style.opacity = 1;
    if (!found.has(pk.key)) { found.add(pk.key); save(); refreshDots(); }
    audio.ping();
    if (pk.key === 'snappingShrimp') setTimeout(audio.snap, 300); if (pk.key === 'spinnerDolphin') setTimeout(audio.whistle, 300); if (pk.key === 'parrotfish') setTimeout(audio.crunch, 300);
    audio.say(pk.key, `${f.name}. ${variant ? f.night : f.fact}`, variant).then((dur) => { if (st.focus === pk) { st.until = st.time + Math.max(4, dur) + 1.0; st.captionUntil = st.until + 1.5; } });
    reef.onTap(pk.key, pk.p);
  }
  function release(stopVoice) {
    if (st.focus) { st.focus = null; controls.st.suspend = false; controls.st.inspect = false; if (onPause) onPause(false); }
    if (stopVoice) { audio.stop(); nameEl.style.opacity = 0; capEl.style.opacity = 0; }
  }
  controls.st.onInput = () => { if (st.focus) { st.focus = null; controls.st.suspend = false; controls.st.inspect = false; if (onPause) onPause(false); st.captionUntil = st.time + 3; } };
  controls.st.onOrbit = (dx, dy) => { orb.theta -= dx * 0.006; orb.phi = THREE.MathUtils.clamp(orb.phi + dy * 0.006, -0.3, 1.35); };
  controls.st.onZoom = (f) => { orb.dist = THREE.MathUtils.clamp(orb.dist * f, orb.min, orb.max); };

  // ---- field guide
  let thumbR = null;
  function thumb(key) {
    const obj = THUMBS.get(key); const c = document.createElement('canvas'); c.width = c.height = 144; if (!obj) return c;
    if (!thumbR) { thumbR = new THREE.WebGLRenderer({ alpha: true, antialias: true }); thumbR.setSize(144, 144, false); thumbR.setClearColor(0, 0); thumbR.outputColorSpace = THREE.SRGBColorSpace; thumbR.toneMapping = THREE.ACESFilmicToneMapping; }
    const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight('#cfe9f5', '#2a4a66', 1.6)); const l = new THREE.DirectionalLight('#fff4dc', 2.4); l.position.set(2, 3, 2); scene.add(l);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide });
    const m = obj.isBufferGeometry ? new THREE.Mesh(obj, mat) : obj.clone(); if (!obj.isBufferGeometry) m.traverse((n) => { if (n.isMesh) n.material = mat; });
    const box = new THREE.Box3().setFromObject(m), s = new THREE.Sphere(); box.getBoundingSphere(s); m.position.sub(s.center); scene.add(m);
    const cam = new THREE.PerspectiveCamera(32, 1, 0.01, 100); const d = s.radius * 3.3; cam.position.set(d * 0.8, d * 0.45, d * 0.75); cam.lookAt(0, 0, 0);
    thumbR.render(scene, cam); c.getContext('2d').drawImage(thumbR.domElement, 0, 0, 144, 144); return c;
  }
  let built = false;
  function openGuide(on) {
    guide.classList.toggle('open', on); controls.st.enabled = !on;
    if (on && !built) { built = true; for (const k of keys) { const cell = document.createElement('div'); cell.className = 'sp'; cell.dataset.k = k; cell.appendChild(thumb(k)); const n = document.createElement('div'); n.textContent = FACTS[k].name; cell.appendChild(n); cell.addEventListener('click', () => { openGuide(false); fromGuide(k); }); grid.appendChild(cell); } }
    if (on) for (const cell of grid.children) cell.classList.toggle('on', found.has(cell.dataset.k));
  }
  function fromGuide(k) {
    const f = FACTS[k]; const pk = pickables.find((p) => p.key === k);
    if (found.has(k) && pk) { focus(pk); return; }
    nameEl.textContent = f.name; capEl.innerHTML = `Not found yet. Look for it ${f.where}.`; nameEl.style.opacity = 1; capEl.style.opacity = 1; st.captionUntil = st.time + 6;
  }

  // ---- per frame: camera glide, hover name, timeouts
  function update(dt) {
    st.time += dt;
    if (st.focus) {
      const pk = st.focus; const cp = Math.cos(orb.phi);
      _o.set(Math.sin(orb.theta) * cp, Math.sin(orb.phi), Math.cos(orb.theta) * cp).multiplyScalar(orb.dist).add(pk.p);
      camera.position.lerp(_o, 1 - Math.exp(-dt * 5)); if (clamp) clamp(camera.position);
      _d.subVectors(pk.p, camera.position); const yaw = Math.atan2(-_d.x, -_d.z), pitch = Math.atan2(_d.y, Math.hypot(_d.x, _d.z));
      const k = 1 - Math.exp(-dt * 7); let dy = yaw - controls.st.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      controls.setLook(controls.st.yaw + dy * k, controls.st.pitch + (pitch - controls.st.pitch) * k);
    }
    if (!st.focus && st.time > st.captionUntil && nameEl.style.opacity !== '0') { nameEl.style.opacity = 0; capEl.style.opacity = 0; }
    if (!isTouch && !st.focus && controls.st.enabled) {
      const pk = pickAt(0.5, 0.5, 30); const nm = pk ? FACTS[pk.key]?.name : '';
      if (nm !== st.hover) { st.hover = nm; lookEl.textContent = nm || ''; lookEl.style.opacity = nm ? 0.85 : 0; aimEl.style.opacity = nm ? 0.9 : 0; }
    } else if (st.hover) { st.hover = ''; lookEl.style.opacity = 0; aimEl.style.opacity = 0; }
  }
  addEventListener('keydown', (e) => { if (e.code === 'KeyG') openGuide(!guide.classList.contains('open')); if (e.code === 'Escape') { openGuide(false); release(true); } });
  return { tap, update, openGuide, found, focus, release };
}

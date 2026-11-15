// Swim controls. Desktop: pointer lock look (drag fallback), WASD, Q/E, Shift. Phone: drag to look, hold to swim,
// second finger to go faster. Short taps are reported for picking.
import * as THREE from 'three';

export function createControls(camera, canvas, o = {}) {
  const st = { yaw: o.yaw || 0, pitch: o.pitch || 0, locked: false, speed: 0, onTap: null, onLook: null, onInput: null, onOrbit: null, onZoom: null, enabled: false, suspend: false, inspect: false };
  const vel = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), want = new THREE.Vector3();
  const k = { w: 0, s: 0, a: 0, d: 0, q: 0, e: 0, sh: 0 };
  let drag = null, touchHold = 0, touchFast = 0, moved = 0, lookSens = 0.0022;
  const PITCH = 1.45;
  const look = (dx, dy) => { if (st.inspect) { if ((dx || dy) && st.onOrbit) st.onOrbit(dx, dy); return; } if ((dx || dy) && st.onInput) st.onInput(); st.yaw -= dx * lookSens; st.pitch = Math.max(-PITCH, Math.min(PITCH, st.pitch - dy * lookSens)); if (st.onLook) st.onLook(); };

  // mouse
  canvas.addEventListener('mousedown', (e) => { if (!st.enabled) return; drag = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0; });
  window.addEventListener('mousemove', (e) => {
    if (!st.enabled) return;
    if (st.locked) { look(e.movementX, e.movementY); return; }
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy); look(dx, dy); drag.x = e.clientX; drag.y = e.clientY; }
  });
  window.addEventListener('mouseup', (e) => {
    if (!st.enabled || !drag) return;
    const quick = performance.now() - drag.t < 350 && moved < 8; drag = null;
    if (quick) {
      if (st.locked) { st.onTap && st.onTap(0.5, 0.5, true); }
      else if (o.pointerLock && canvas.requestPointerLock && !o.isTouch) { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => 0); st.onTap && st.onTap(e.clientX / innerWidth, 1 - e.clientY / innerHeight, false); }
      else st.onTap && st.onTap(e.clientX / innerWidth, 1 - e.clientY / innerHeight, false);
    }
  });
  document.addEventListener('pointerlockchange', () => { st.locked = document.pointerLockElement === canvas; if (!st.locked) release(); });
  const release = () => { k.w = k.s = k.a = k.d = k.q = k.e = k.sh = 0; };
  const key = (e, v) => {
    if (!st.enabled) return;
    const c = e.code;
    if (c === 'KeyW' || c === 'ArrowUp') k.w = v; else if (c === 'KeyS' || c === 'ArrowDown') k.s = v; else if (c === 'KeyA' || c === 'ArrowLeft') k.a = v; else if (c === 'KeyD' || c === 'ArrowRight') k.d = v;
    else if (c === 'KeyQ') k.q = v; else if (c === 'KeyE' || c === 'Space') k.e = v; else if (c === 'ShiftLeft' || c === 'ShiftRight') k.sh = v; else return;
    if (v && st.onInput) st.onInput();
    if (e.target === document.body) e.preventDefault();
  };
  window.addEventListener('keydown', (e) => key(e, 1)); window.addEventListener('keyup', (e) => key(e, 0));
  window.addEventListener('blur', release);
  canvas.addEventListener('wheel', (e) => { if (st.enabled && st.inspect && st.onZoom) { e.preventDefault(); st.onZoom(Math.exp(e.deltaY * 0.0012)); } }, { passive: false });

  // touch
  let t0 = null, tStart = 0, tMoved = 0, pinch0 = 0;
  const tDist = (e) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  canvas.addEventListener('touchstart', (e) => {
    if (!st.enabled) return; e.preventDefault();
    if (e.touches.length === 1) { const t = e.touches[0]; t0 = { x: t.clientX, y: t.clientY }; tStart = performance.now(); tMoved = 0; touchHold = 1; }
    touchFast = e.touches.length > 1 ? 1 : 0; pinch0 = e.touches.length > 1 ? tDist(e) : 0;
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    if (!st.enabled || !t0) return; e.preventDefault();
    if (e.touches.length > 1) { const d = tDist(e); if (pinch0 && st.inspect && st.onZoom && d > 1) st.onZoom(pinch0 / d); pinch0 = d; tMoved += 20; return; }
    const t = e.touches[0], dx = t.clientX - t0.x, dy = t.clientY - t0.y; tMoved += Math.abs(dx) + Math.abs(dy);
    look(dx * 1.6, dy * 1.6); t0.x = t.clientX; t0.y = t.clientY;
  }, { passive: false });
  const tEnd = (e) => {
    if (!st.enabled) return; e.preventDefault();
    if (e.touches.length === 0) {
      const quick = performance.now() - tStart < 280 && tMoved < 12;
      if (quick && t0 && st.onTap) st.onTap(t0.x / innerWidth, 1 - t0.y / innerHeight, false);
      t0 = null; touchHold = 0; touchFast = 0;
    } else touchFast = e.touches.length > 1 ? 1 : 0;
  };
  canvas.addEventListener('touchend', tEnd, { passive: false }); canvas.addEventListener('touchcancel', tEnd, { passive: false });

  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  function update(dt) {
    euler.set(st.pitch, st.yaw, 0); camera.quaternion.setFromEuler(euler);
    fwd.set(0, 0, -1).applyQuaternion(camera.quaternion); right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    want.set(0, 0, 0);
    const hold = touchHold && (performance.now() - tStart > 220 || tMoved > 12) ? 1 : 0;
    if (hold && st.onInput && !st.inspect) st.onInput();
    if (st.suspend) { vel.set(0, 0, 0); st.speed = 0; return; }
    want.addScaledVector(fwd, k.w - k.s + hold).addScaledVector(right, k.d - k.a).addScaledVector(up, k.e - k.q);
    const fast = k.sh || touchFast;
    const maxV = (o.speed || 5.5) * (fast ? 2.4 : 1);
    if (want.lengthSq() > 0) { want.normalize().multiplyScalar(maxV); vel.lerp(want, 1 - Math.exp(-dt * 3.2)); }
    else vel.multiplyScalar(Math.exp(-dt * 1.6));
    camera.position.addScaledVector(vel, dt);
    if (o.clamp) o.clamp(camera.position);
    st.speed = vel.length();
  }
  return { st, update, k, setLook: (yaw, pitch) => { st.yaw = yaw; st.pitch = pitch; } };
}

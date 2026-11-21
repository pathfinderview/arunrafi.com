// A pool of rising bubbles: the splash, the diver's breath, anything that fizzes.
import * as THREE from 'three';
import { U } from './ocean.js';

export function makeBubbles(n, px) {
  const pos = new Float32Array(n * 3).fill(999), size = new Float32Array(n), vel = new Float32Array(n * 3), life = new Float32Array(n);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({ uniforms: { uPx: { value: px }, uNight: U.uNight }, transparent: true, depthWrite: false,
    vertexShader: `attribute float aSize; uniform float uPx; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z; gl_PointSize = clamp(aSize * 520.0 * uPx / max(d, 0.15), 1.5, 90.0 * uPx); vA = smoothstep(0.05, 0.4, d) * (1.0 - smoothstep(18.0, 30.0, d)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; uniform float uNight; void main(){ vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0; if (r > 1.0) discard; float rim = smoothstep(0.62, 0.95, r) * (1.0 - smoothstep(0.95, 1.0, r)); float hi = smoothstep(0.32, 0.0, length(q - vec2(-0.16, -0.18)) * 2.0); float a = (rim * 0.75 + hi * 0.8 + 0.08) * vA; gl_FragColor = vec4(vec3(0.86, 0.96, 1.0) * (1.0 - 0.5 * uNight), a); }` });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 12; let head = 0;
  function emit(p, count, spread = 0.2, speed = 1) {
    for (let k = 0; k < count; k++) { const i = head; head = (head + 1) % n; pos[i * 3] = p.x + (Math.random() - 0.5) * spread * 2; pos[i * 3 + 1] = p.y + (Math.random() - 0.5) * spread * 2; pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * spread * 2;
      size[i] = 0.006 + Math.random() * Math.random() * 0.035; vel[i * 3] = (Math.random() - 0.5) * 0.6 * speed; vel[i * 3 + 1] = (Math.random() - 0.3) * 1.2 * speed; vel[i * 3 + 2] = (Math.random() - 0.5) * 0.6 * speed; life[i] = 1; }
    g.attributes.aSize.needsUpdate = true;
  }
  function update(dt, t) {
    for (let i = 0; i < n; i++) { if (!life[i]) continue; const j = i * 3, rise = 0.35 + size[i] * 22;
      vel[j] *= Math.exp(-dt * 2.5); vel[j + 2] *= Math.exp(-dt * 2.5); vel[j + 1] += (rise - vel[j + 1]) * (1 - Math.exp(-dt * 3));
      pos[j] += (vel[j] + Math.sin(t * 6 + i) * 0.08) * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += (vel[j + 2] + Math.cos(t * 5 + i * 1.7) * 0.08) * dt;
      if (pos[j + 1] > -0.03) { life[i] = 0; pos[j + 1] = 999; } }
    g.attributes.position.needsUpdate = true;
  }
  return { pts, emit, update };
}

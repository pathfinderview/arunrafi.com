// Above the water: sky, the dive boat with its anchor line, and a palm island on the horizon.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { U, oceanify } from './ocean.js';
import { terrainY } from './terrain.js';

const UP = new THREE.Vector3(0, 1, 0);
function tint(g, hex) { if (g.index) g = g.toNonIndexed(); g.deleteAttribute('uv'); const n = g.attributes.position.count, c = new Float32Array(n * 3), k = new THREE.Color(hex); for (let i = 0; i < n; i++) { c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; }

export function buildTopside(scene, BOAT) {
  // ---- sky dome, shown only when the camera is above the surface
  const sky = new THREE.Mesh(new THREE.SphereGeometry(440, 24, 14), new THREE.ShaderMaterial({
    uniforms: { uSunDir: U.uSunDir, uNight: U.uNight }, side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vD; uniform vec3 uSunDir; uniform float uNight;
      void main(){ vec3 d = normalize(vD); float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(vec3(0.56, 0.8, 0.96), vec3(0.07, 0.3, 0.74), pow(h, 0.5));
        float s = max(dot(d, uSunDir), 0.0); col += vec3(1.0, 0.95, 0.8) * (pow(s, 700.0) * 12.0 + pow(s, 12.0) * 0.25);
        float az = atan(d.z, d.x); float cl = smoothstep(0.62, 0.95, 0.5 + 0.3 * sin(az * 3.0 + 1.0) + 0.2 * sin(az * 7.0 + d.y * 9.0) + 0.12 * sin(az * 17.0)) * smoothstep(0.04, 0.1, d.y) * (1.0 - smoothstep(0.14, 0.3, d.y));
        col = mix(col, vec3(0.95, 0.97, 1.0), cl * 0.7);
        col = mix(col, vec3(0.02, 0.05, 0.12), uNight * 0.92);
        gl_FragColor = vec4(col, 1.0); }`,
  })); sky.renderOrder = -5; sky.frustumCulled = false; scene.add(sky);

  // ---- boat: a painted dinghy, open, with thwarts and a deck
  const L = 2.5, B = 0.82, nt = 26, na = 12, pos = [], col = [], idx = [];
  const white = new THREE.Color('#f6f2e6'), blue = new THREE.Color('#3aa0e8'), c = new THREE.Color();
  for (let i = 0; i <= nt; i++) { const t = i / nt * 2 - 1, b = B * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 2.6)), 0.55) + 0.02, sheer = 0.5 + 0.2 * t * t;
    for (let j = 0; j <= na; j++) { const a = j / na * Math.PI, x = Math.cos(a) * b, y = sheer - (sheer + 0.34) * Math.pow(Math.sin(a), 0.75);
      pos.push(x, y, t * L); c.copy(y > sheer - 0.07 ? blue : white); col.push(c.r, c.g, c.b); } }
  for (let i = 0; i < nt; i++) for (let j = 0; j < na; j++) { const a = i * (na + 1) + j, b2 = a + 1, d = a + na + 1, e = d + 1; idx.push(a, d, b2, b2, d, e); }
  const hull = new THREE.BufferGeometry(); hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hull.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); hull.setIndex(idx); hull.computeVertexNormals();
  const wood = '#b98a52', parts = [];
  const box = (w, h, d, x, y, z, hex) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); parts.push(tint(g, hex)); };
  box(1.5, 0.04, 0.3, 0, 0.36, -0.9, wood); box(1.5, 0.04, 0.3, 0, 0.36, 0.95, wood); box(1.2, 0.03, 4.2, 0, 0.03, 0, '#caa46c');
  { const g = new THREE.CylinderGeometry(0.09, 0.09, 0.62, 12); g.rotateX(Math.PI / 2); g.translate(-0.3, 0.14, 0.1); parts.push(tint(g, '#f2c21c')); const v = new THREE.CylinderGeometry(0.03, 0.04, 0.1, 8); v.rotateX(Math.PI / 2); v.translate(-0.3, 0.14, 0.46); parts.push(tint(v, '#333')); }
  { const g = new THREE.BoxGeometry(0.2, 0.03, 0.5); g.translate(0.25, 0.07, -0.25); parts.push(tint(g, '#111')); const g2 = g.clone(); g2.translate(-0.02, 0.03, 0.12); parts.push(tint(g2, '#18a0c8')); }
  const mat = oceanify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide, emissive: '#8f8a7c', emissiveIntensity: 0.42 }), { caustic: 0, absorb: 0, key: 'boat' });
  const boat = new THREE.Group(); const hm = new THREE.Mesh(hull, mat), pm = new THREE.Mesh(mergeGeometries(parts, false), mat); hm.castShadow = pm.castShadow = true; boat.add(hm, pm);
  boat.position.set(BOAT.x, 0, BOAT.z); scene.add(boat);
  // anchor line from the bow to the sand
  { const a = new THREE.Vector3(BOAT.x, 0.5, BOAT.z - L), b = new THREE.Vector3(BOAT.x + 6.5, terrainY(BOAT.x + 6.5, BOAT.z - 7) + 0.1, BOAT.z - 7), d = b.clone().sub(a), len = d.length();
    const g = new THREE.CylinderGeometry(0.012, 0.012, len, 5); g.translate(0, len / 2, 0); const rope = new THREE.Mesh(tint(g, '#d8cfb8'), mat); rope.position.copy(a); rope.quaternion.setFromUnitVectors(UP, d.normalize()); scene.add(rope);
    const an = []; const s1 = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6); an.push(tint(s1, '#4a4a4a')); for (const s of [-1, 1]) { const f = new THREE.ConeGeometry(0.05, 0.28, 6); f.rotateZ(s * 2.2); f.translate(s * 0.13, -0.16, 0); an.push(tint(f, '#4a4a4a')); }
    const anchor = new THREE.Mesh(mergeGeometries(an, false), mat); anchor.position.copy(b); anchor.rotation.z = 1.1; anchor.castShadow = true; scene.add(anchor); }

  // ---- island with palms, west of the boat
  const isl = new THREE.Group(), lm = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: '#2c4a26', emissiveIntensity: 0.7 }), ig = [];
  { const s = new THREE.SphereGeometry(1, 28, 10); s.scale(46, 2.6, 26); ig.push(tint(s, '#f3e3b6')); const v = new THREE.SphereGeometry(1, 20, 8); v.scale(30, 3.6, 15); v.translate(0, 1.2, 0); ig.push(tint(v, '#4f9a4a')); }
  let sd = 5; const R = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  for (let i = 0; i < 14; i++) { const px = (R() - 0.5) * 60, pz = (R() - 0.5) * 22, h = 7 + R() * 5, lean = (R() - 0.5) * 0.5;
    const tr = new THREE.CylinderGeometry(0.16, 0.26, h, 6, 6); tr.translate(0, h / 2, 0); const p = tr.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k) / h; p.setX(k, p.getX(k) + lean * h * y * y); } tr.translate(px, 2.2, pz); ig.push(tint(tr, '#8a6a48'));
    for (let l = 0; l < 8; l++) { const lf = new THREE.PlaneGeometry(0.9, 4.2, 1, 5); lf.translate(0, 2.1, 0); const q = lf.attributes.position; for (let k = 0; k < q.count; k++) { const y = q.getY(k) / 4.2; q.setZ(k, -1.8 * y * y); q.setX(k, q.getX(k) * (1 - 0.8 * y)); } lf.rotateX(0.95); lf.rotateY(l / 8 * 6.283 + R()); lf.translate(px + lean * h, 2.2 + h, pz); ig.push(tint(lf, l % 2 ? '#3f8f3a' : '#57a84a')); } }
  const im = new THREE.Mesh(mergeGeometries(ig.map((g) => { g.computeVertexNormals(); return g; }), false), lm); isl.add(im); isl.position.set(-120, -0.6, BOAT.z + 4); isl.scale.setScalar(1.15); scene.add(isl);

  return { boat, update(t, cam) { const above = cam.position.y > -0.02; sky.visible = above; isl.visible = above; sky.position.copy(cam.position); boat.position.y = Math.sin(t * 1.1) * 0.03; boat.rotation.z = Math.sin(t * 0.8) * 0.025; boat.rotation.x = Math.sin(t * 0.63) * 0.012; return above; } };
}

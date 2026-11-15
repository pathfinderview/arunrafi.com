// Water: shared ocean uniforms, material patch (caustics, absorption, directional fog), the surface seen
// from below, marine snow, and the post chain (god rays, vignette, tone mapping).
import * as THREE from 'three';

export const U = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(-0.22, 0.86, -0.46).normalize() },
  uFogDeep: { value: new THREE.Color('#0a4d7d') },
  uFogShallow: { value: new THREE.Color('#35b5d8') },
  uFogSun: { value: new THREE.Color('#e6f8ff') },
  uFogDensity: { value: 0.024 },
  uCaustic: { value: 1.0 },
  uNight: { value: 0 },
};

export const GLSL_OCEAN = /* glsl */`
uniform float uTime; uniform vec3 uSunDir; uniform vec3 uFogDeep; uniform vec3 uFogShallow; uniform vec3 uFogSun;
uniform float uFogDensity; uniform float uCaustic; uniform float uNight;
float hash31(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float caustic(vec2 uv, float t) {
  vec2 p = mod(uv * 0.9, 6.28318) - 250.0; vec2 i = p; float c = 0.0; const float k = 0.005;
  for (int n = 0; n < 3; n++) {
    float tt = t * 0.5 + float(n) * 2.3;
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / k), p.y / (cos(i.y + tt) / k)));
  }
  c = 1.17 - pow(c / 3.0, 1.4);
  return min(pow(abs(c), 7.0), 2.5) * 0.45;
}
vec3 oceanFogColor(vec3 vd) {
  float up = clamp(vd.y * 0.6 + 0.5, 0.0, 1.0);
  vec3 fc = mix(uFogDeep, uFogShallow, up * up);
  float s = max(dot(vd, uSunDir), 0.0);
  fc += uFogSun * (pow(s, 14.0) * 0.55 + pow(s, 3.0) * 0.07) * (1.0 - 0.85 * uNight);
  return fc;
}
vec3 oceanFog(vec3 col, vec3 wp) {
  vec3 vd = wp - cameraPosition; float dist = length(vd); vd /= max(dist, 1e-4);
  float f = 1.0 - exp(-uFogDensity * dist);
  return mix(col, oceanFogColor(vd), f);
}
`;

// Patch a built-in material so it lives underwater: caustics on up-facing surfaces, blue absorption with
// depth, and view-dependent fog. `patch(shader)` lets a caller inject more (e.g. swim animation).
export function oceanify(mat, o = {}) {
  const ck = o.caustic ?? 1, ab = o.absorb ?? 1, gr = o.grain ?? 0, bp = o.bump ?? 0;
  mat.fog = false;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, renderer) => {
    Object.assign(sh.uniforms, U);
    const basic = !!mat.isMeshBasicMaterial;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOW; varying vec3 vON;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
{ vec4 wp4 = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  wp4 = instanceMatrix * wp4;
#endif
  vOW = (modelMatrix * wp4).xyz; }
${basic ? 'vON = vec3(0.0, 1.0, 0.0);' : 'vON = inverseTransformDirection(transformedNormal, viewMatrix);'}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOW; varying vec3 vON;\n' + GLSL_OCEAN)
      .replace('#include <map_fragment>', `#include <map_fragment>
{ float upN = clamp(vON.y, 0.0, 1.0);
  float dCam = length(vOW - cameraPosition);
  float ca = caustic(vOW.xz, uTime) * exp(-dCam * 0.03);
  float depthF = clamp(-vOW.y / 30.0, 0.0, 1.0);
  diffuseColor.rgb *= 1.0 + ${ck.toFixed(2)} * uCaustic * ca * (0.2 + 0.8 * upN) * (1.0 - 0.6 * depthF) * (1.0 - 0.85 * uNight);
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.62, 0.84, 0.96), depthF * ${ab.toFixed(2)}); }
${gr ? `float oGrain = vnoise(vOW * 4.0) * 0.5 + vnoise(vOW * 11.0) * 0.35 + vnoise(vOW * 29.0) * 0.15; float oGk = exp(-length(vOW - cameraPosition) * 0.08); diffuseColor.rgb *= 1.0 - ${gr.toFixed(2)} * oGk + ${(2 * gr).toFixed(2)} * oGk * oGrain;` : ''}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
${bp ? `normal = normalize(normal + vec3(dFdx(oGrain), dFdy(oGrain), 0.0) * ${bp.toFixed(2)} * oGk);` : ''}`)
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = oceanFog(gl_FragColor.rgb, vOW);');
    if (o.patch) o.patch(sh);
    if (prev) prev(sh, renderer);
  };
  mat.customProgramCacheKey = () => `ocean|${ck}|${ab}|${gr}|${bp}|${o.key || ''}`;
  return mat;
}

// ---------------------------------------------------------------- surface seen from below
export function makeSurface() {
  const geo = new THREE.PlaneGeometry(700, 700, 1, 1); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uSky: { value: new THREE.Color('#dff7ff') }, uSunCol: { value: new THREE.Color('#fff6dc') } },
    side: THREE.DoubleSide, depthWrite: false,
    vertexShader: /* glsl */`varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec3 vW; uniform vec3 uSky; uniform vec3 uSunCol;
      ${GLSL_OCEAN}
      void main() {
        vec3 vd = vW - cameraPosition; float dist = length(vd); vd /= dist;
        vec2 p = vW.xz; float t = uTime;
        // wave slope field (sum of sines, analytic derivatives)
        float nx = 0.0, nz = 0.0;
        nx += 0.30 * 0.35 * cos(p.x * 0.35 + t * 0.9);                nz += 0.0;
        nz += 0.30 * 0.27 * cos(p.y * 0.27 - t * 0.7);
        float c3 = cos((p.x + p.y) * 0.18 + t * 0.5); nx += 0.45 * 0.18 * c3; nz += 0.45 * 0.18 * c3;
        float c4 = cos(p.x * 0.9 - p.y * 0.6 + t * 1.3); nx += 0.12 * 0.9 * c4; nz -= 0.12 * 0.6 * c4;
        float c5 = cos(p.x * 1.7 + p.y * 1.1 - t * 1.9); nx += 0.05 * 1.7 * c5; nz += 0.05 * 1.1 * c5;
        vec3 N = normalize(vec3(-nx * 2.4, 1.0, -nz * 2.4));
        float cosA = dot(vd, N);
        float window = smoothstep(0.42, 0.8, cosA);
        vec3 refl = uFogDeep * 1.15;
        vec3 col = mix(refl, uSky, window);
        float sd = max(dot(vd, uSunDir), 0.0);
        float sun = pow(sd, 90.0) * 2.5 + pow(sd, 10.0) * 0.5;
        vec3 h = normalize(uSunDir - vd);
        float gl = pow(max(dot(N, h), 0.0), 160.0) * 1.6;
        col += uSunCol * (sun + gl * window) * (1.0 - 0.9 * uNight);
        float rip = 0.6 * caustic(p * 0.9, t) + 0.4 * caustic(p * 2.6 + 17.0, t * 1.3);
        col *= 0.78 + 0.5 * rip * (1.0 - 0.7 * uNight);
        col *= 1.0 - 0.82 * uNight;
        col = oceanFog(col, vW);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat); m.position.y = 0; m.frustumCulled = false; m.renderOrder = -1;
  return m;
}

// ---------------------------------------------------------------- marine snow
export function makeSnow(n = 1400) {
  const pos = new Float32Array(n * 3), sz = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = Math.random() * 70; pos[i * 3 + 1] = Math.random() * 36; pos[i * 3 + 2] = Math.random() * 70; sz[i] = 0.4 + Math.random() * Math.random() * 1.6; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uBox: { value: new THREE.Vector3(70, 36, 70) }, uPx: { value: 1 }, uSpark: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float sz; varying float vA; varying float vS; uniform vec3 uBox; uniform float uTime; uniform float uPx; uniform float uSpark; uniform float uNight;
      void main() {
        vS = uNight * uSpark * step(0.9, fract(sin(position.x * 12.9898 + position.z * 78.233) * 43758.5453 + uTime * 0.7));
        vec3 p = position + vec3(sin(uTime * 0.21 + position.y * 0.7) * 0.6, -uTime * 0.12 * sz, cos(uTime * 0.17 + position.x * 0.5) * 0.6);
        p = cameraPosition + mod(p - cameraPosition + uBox * 0.5, uBox) - uBox * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        gl_PointSize = clamp(sz * 40.0 * uPx / max(d, 1.0), 1.0, 4.5 * uPx);
        vA = (1.0 - smoothstep(14.0, 34.0, d)) * smoothstep(0.4, 2.5, d);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vA; varying float vS; uniform float uNight;
      void main() { vec2 q = gl_PointCoord - 0.5; float r = dot(q, q) * 4.0; float a = (1.0 - smoothstep(0.1, 1.0, r)) * vA * (0.32 * (1.0 - 0.7 * uNight) + vS * 1.5); gl_FragColor = vec4(mix(vec3(0.75, 0.9, 1.0), vec3(0.4, 1.0, 0.85), vS), a); }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; return pts;
}

// ---------------------------------------------------------------- post: god rays, vignette, tone map
export function makePost(renderer, scene, camera, isMobile) {
  const w = () => renderer.domElement.width, h = () => renderer.domElement.height;
  const samples = isMobile ? 0 : 4;
  const rtScene = new THREE.WebGLRenderTarget(w(), h(), { type: THREE.HalfFloatType, samples, depthBuffer: true });
  const q = isMobile ? 4 : 3;
  const rtA = new THREE.WebGLRenderTarget((w() / q) | 0, (h() / q) | 0, { type: THREE.HalfFloatType });
  const rtB = new THREE.WebGLRenderTarget((w() / q) | 0, (h() / q) | 0, { type: THREE.HalfFloatType });
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const mk = (fs, uniforms) => new THREE.Mesh(quadGeo, new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: fs, depthTest: false, depthWrite: false }));
  const bright = mk(`uniform sampler2D tD; uniform float uThr; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tD, vUv).rgb; float l = dot(c, vec3(0.3, 0.59, 0.11)); gl_FragColor = vec4(c * smoothstep(uThr, uThr + 0.6, l), 1.0); }`,
    { tD: { value: null }, uThr: { value: 0.9 } });
  const blur = mk(`uniform sampler2D tD; uniform vec2 uSun; uniform float uDen; varying vec2 vUv;
    void main(){ vec2 d = (vUv - uSun) * uDen / 20.0; vec2 uv = vUv; float wgt = 1.0; vec3 acc = vec3(0.0);
      for (int i = 0; i < 20; i++) { uv -= d; acc += texture2D(tD, uv).rgb * wgt; wgt *= 0.93; }
      gl_FragColor = vec4(acc / 12.0, 1.0); }`,
    { tD: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uDen: { value: 0.5 } });
  const comp = new THREE.Mesh(quadGeo, new THREE.ShaderMaterial({
    uniforms: { tS: { value: rtScene.texture }, tR: { value: null }, uRays: { value: 0.0 }, uVig: { value: 0.35 }, uSat: { value: 1.36 } },
    vertexShader: VS, depthTest: false, depthWrite: false, toneMapped: true,
    fragmentShader: `uniform sampler2D tS; uniform sampler2D tR; uniform float uRays; uniform float uVig; uniform float uSat; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tS, vUv).rgb + texture2D(tR, vUv).rgb * uRays;
        vec2 v = vUv - 0.5; c *= 1.0 - uVig * dot(v, v) * 1.6;
        float l = dot(c, vec3(0.3, 0.59, 0.11)); c = mix(vec3(l), c, uSat);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const sunW = new THREE.Vector3(), sunNdc = new THREE.Vector3();
  const state = { rays: 0.55, thr: 0.9 };
  function render() {
    renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
    // sun screen position
    sunW.copy(U.uSunDir.value).multiplyScalar(500).add(camera.position); sunNdc.copy(sunW).project(camera);
    const behind = sunNdc.z > 1 || sunNdc.z < -1;
    const sx = sunNdc.x * 0.5 + 0.5, sy = sunNdc.y * 0.5 + 0.5;
    const off = Math.max(Math.abs(sunNdc.x), Math.abs(sunNdc.y));
    const strength = behind ? 0 : state.rays * (1 - THREE.MathUtils.smoothstep(off, 1.0, 2.4));
    comp.material.uniforms.uRays.value = strength;
    if (strength > 0.01) {
      blur.material.uniforms.uSun.value.set(sx, sy);
      bright.material.uniforms.tD.value = rtScene.texture; bright.material.uniforms.uThr.value = state.thr;
      renderer.setRenderTarget(rtA); renderer.render(bright, ortho);
      blur.material.uniforms.tD.value = rtA.texture; blur.material.uniforms.uDen.value = 0.6; renderer.setRenderTarget(rtB); renderer.render(blur, ortho);
      blur.material.uniforms.tD.value = rtB.texture; blur.material.uniforms.uDen.value = 0.35; renderer.setRenderTarget(rtA); renderer.render(blur, ortho);
      comp.material.uniforms.tR.value = rtA.texture;
    } else comp.material.uniforms.tR.value = rtB.texture;
    renderer.setRenderTarget(null); renderer.render(comp, ortho);
  }
  function resize() { rtScene.setSize(w(), h()); rtA.setSize((w() / q) | 0, (h() / q) | 0); rtB.setSize((w() / q) | 0, (h() / q) | 0); }
  return { render, resize, state };
}

// ---------------------------------------------------------------- time of day
// phases: 0 noon, 1 dusk, 2 night, 3 dawn. Everything lerps toward the phase's targets.
const PHASES = [
  { sun: [-0.22, 0.86, -0.46], sunCol: '#fff4dc', sunI: 2.6, hemiSky: '#8fdcee', hemiGround: '#0b3c5c', hemiI: 1.3, deep: '#0a4d7d', shallow: '#35b5d8', fogSun: '#e6f8ff', sky: '#dff7ff', night: 0, expo: 1.12, rays: 0.55, thr: 0.9, bg: '#1a7fa8' },
  { sun: [-0.75, 0.22, -0.6], sunCol: '#ffb070', sunI: 1.6, hemiSky: '#5f8ea8', hemiGround: '#0a2a44', hemiI: 0.9, deep: '#073a60', shallow: '#2a7f9e', fogSun: '#ffc48a', sky: '#f2b98a', night: 0.25, expo: 1.0, rays: 0.5, thr: 0.8, bg: '#135f82' },
  { sun: [0.3, 0.8, 0.5], sunCol: '#a9c0ee', sunI: 0.9, hemiSky: '#2a4a68', hemiGround: '#071a2a', hemiI: 0.75, deep: '#051a30', shallow: '#0f3a5e', fogSun: '#8aa6d0', sky: '#2f4a6c', night: 1, expo: 1.0, rays: 0.3, thr: 0.55, bg: '#082236' },
  { sun: [0.7, 0.26, -0.6], sunCol: '#ffd0b0', sunI: 1.5, hemiSky: '#7fb0c8', hemiGround: '#0a3050', hemiI: 0.9, deep: '#083f68', shallow: '#2f93b5', fogSun: '#ffd8c0', sky: '#f4d2c0', night: 0.2, expo: 1.0, rays: 0.5, thr: 0.8, bg: '#166b8f' },
];
const _ca = new THREE.Color(), _cb = new THREE.Color();
export function makeDayNight({ sun, hemi, scene, renderer, post, surface }) {
  let phase = 0, k = 1; const to = Object.assign({}, PHASES[0]); let cur = Object.assign({}, PHASES[0]);
  const lerpC = (a, b, t) => _ca.set(a).lerp(_cb.set(b), t);
  const apply = (t) => {
    const a = cur, b = to;
    U.uSunDir.value.set(a.sun[0] + (b.sun[0] - a.sun[0]) * t, a.sun[1] + (b.sun[1] - a.sun[1]) * t, a.sun[2] + (b.sun[2] - a.sun[2]) * t).normalize();
    sun.color.copy(lerpC(a.sunCol, b.sunCol, t)); sun.intensity = a.sunI + (b.sunI - a.sunI) * t;
    hemi.color.copy(lerpC(a.hemiSky, b.hemiSky, t)); hemi.groundColor.copy(lerpC(a.hemiGround, b.hemiGround, t)); hemi.intensity = a.hemiI + (b.hemiI - a.hemiI) * t;
    U.uFogDeep.value.copy(lerpC(a.deep, b.deep, t)); U.uFogShallow.value.copy(lerpC(a.shallow, b.shallow, t)); U.uFogSun.value.copy(lerpC(a.fogSun, b.fogSun, t));
    surface.material.uniforms.uSky.value.copy(lerpC(a.sky, b.sky, t)); scene.background.copy(lerpC(a.bg, b.bg, t));
    U.uNight.value = a.night + (b.night - a.night) * t; renderer.toneMappingExposure = a.expo + (b.expo - a.expo) * t;
    post.state.rays = a.rays + (b.rays - a.rays) * t; post.state.thr = a.thr + (b.thr - a.thr) * t;
  };
  function snapshot() { const o = {}; for (const key in to) o[key] = Array.isArray(to[key]) ? to[key].slice() : to[key]; if (k < 1) { // mid-transition: capture current values
      const a = cur, b = to; const L = (x, y) => x + (y - x) * k; o.sun = a.sun.map((v, i) => L(v, b.sun[i])); for (const key of ['sunI', 'hemiI', 'night', 'expo', 'rays', 'thr']) o[key] = L(a[key], b[key]);
      for (const key of ['sunCol', 'hemiSky', 'hemiGround', 'deep', 'shallow', 'fogSun', 'sky', 'bg']) o[key] = '#' + lerpC(a[key], b[key], k).getHexString(); }
    return o; }
  return {
    get phase() { return phase; }, get night() { return U.uNight.value > 0.5; },
    set(p) { cur = snapshot(); phase = ((p % 4) + 4) % 4; Object.assign(to, PHASES[phase]); k = 0; },
    next() { this.set(phase + 1); },
    update(dt) { if (k < 1) { k = Math.min(1, k + dt / 3.5); apply(k * k * (3 - 2 * k)); } },
  };
}

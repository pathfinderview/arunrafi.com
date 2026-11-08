// map3d.js — Sector 8, Faridabad on Diwali night, as a lit 3D diorama you can travel and zoom.
// Built procedurally (no model files): attached North Indian plots on a straight gali, the park
// opposite our brown house, wires, poles, sodium lamps, Marutis, scooters, plastic chairs, torans,
// rangoli, diyas and fairy lights. Static geometry is merged per material, so it stays phone-friendly.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createLife } from './life3d.js';

const TAU = Math.PI * 2;
let seed = 8;
const rnd = (a = 0, b = 1) => { seed = (seed * 16807) % 2147483647; return a + (b - a) * (seed / 2147483647); };
const pick = a => a[Math.floor(rnd(0, a.length))];
const C = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);

// ---------------------------------------------------------------- procedural textures
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const noise = (g, w, h, n, a, cols) => { for (let i = 0; i < n; i++) { g.fillStyle = pick(cols); g.globalAlpha = rnd(0, a); g.fillRect(rnd(0, w), rnd(0, h), rnd(1, 4), rnd(1, 4)); } g.globalAlpha = 1; };
const TEX = {
  grime: () => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e8e2d6'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 4000, .18, ['#000', '#3a2a1a', '#fff']);
    for (let i = 0; i < 14; i++) { const x = rnd(0, w); const gr = g.createLinearGradient(x, 0, x, h); gr.addColorStop(0, 'rgba(60,40,20,0)'); gr.addColorStop(1, 'rgba(60,40,20,.22)'); g.fillStyle = gr; g.fillRect(x, rnd(0, h / 2), rnd(4, 18), h); }
  }),
  brick: () => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c9c0b4'; g.fillRect(0, 0, w, h);
    const bh = 16, bw = 42;
    for (let r = 0; r < h / bh; r++) for (let c = -1; c < w / bw + 1; c++) {
      const x = c * bw + (r % 2) * bw / 2; const k = rnd(.78, 1.08);
      g.fillStyle = `rgb(${168 * k | 0},${82 * k | 0},${58 * k | 0})`; g.fillRect(x + 1.5, r * bh + 1.5, bw - 3, bh - 3);
    }
    noise(g, w, h, 3000, .2, ['#000', '#ffd7b0']);
  }),
  road: () => canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#4a4744'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 30000, .35, ['#222', '#6a6560', '#80786e']);
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(30,28,26,${rnd(.15, .35)})`; g.beginPath(); g.ellipse(rnd(0, w), rnd(0, h), rnd(20, 80), rnd(10, 40), rnd(0, 3), 0, TAU); g.fill(); }
  }, [1, 12]),
  dust: () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#7a6a58'; g.fillRect(0, 0, w, h); noise(g, w, h, 12000, .35, ['#4a3f33', '#9a8a74', '#5d5245']); }, [6, 6]),
  grass: () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#2f4a22'; g.fillRect(0, 0, w, h); noise(g, w, h, 16000, .5, ['#1d3214', '#41622c', '#4f7034', '#6b5a3a']); }, [8, 8]),
  tiles: () => canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#9a4a34'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(40,20,14,.6)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); } noise(g, w, h, 2000, .25, ['#000', '#d08060']); }, [2, 2]),
  sky: () => { const c = document.createElement('canvas'); c.width = 4; c.height = 512; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#05060f'); gr.addColorStop(.55, '#111737'); gr.addColorStop(.8, '#2a2340'); gr.addColorStop(1, '#4a2e2a'); g.fillStyle = gr; g.fillRect(0, 0, 4, 512); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; },
  sign: () => canvasTex(512, 160, (g, w, h) => { g.fillStyle = '#1f4e9c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f4ecdc'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16); g.fillStyle = '#fff'; g.font = '800 64px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('SECTOR 8', w / 2, 82); g.font = '600 30px system-ui, sans-serif'; g.fillText('FARIDABAD  ·  H.No. 801–860', w / 2, 128); }),
};

// ---------------------------------------------------------------- geometry buckets (merged per material)
const buckets = {};
function put(key, geo, color, m) {
  geo = geo.toNonIndexed();
  if (m) geo.applyMatrix4(m);
  const n = geo.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  (buckets[key] ??= []).push(geo);
}
const M = (x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
// a box with UVs scaled to its size so textures tile in metres
function boxGeo(w, h, d, tile = 3) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const su = nx > .5 ? d : w, sv = ny > .5 ? d : h;
    uv.setXY(i, uv.getX(i) * su / tile, uv.getY(i) * sv / tile);
  }
  return g;
}
const box = (key, w, h, d, x, y, z, col, ry = 0, tile) => put(key, boxGeo(w, h, d, tile), col, M(x, y + h / 2, z, ry));
const cyl = (key, rt, rb, h, x, y, z, col, seg = 10, ry = 0, rx = 0, rz = 0) => put(key, new THREE.CylinderGeometry(rt, rb, h, seg), col, M(x, y, z, ry, rx, rz));
const ball = (key, r, x, y, z, col, seg = 6) => put(key, new THREE.IcosahedronGeometry(r, seg > 6 ? 1 : 0), col, M(x, y, z));

// ---------------------------------------------------------------- palette
const PLASTER = ['#d8c49a', '#e6d7b2', '#d7a98c', '#e8c0b8', '#c9d3b0', '#d9cfc0', '#cdb38a', '#e3c79a', '#b9c4cf'];
const OURS = '#8a5a3c';
const GATE = ['#6a1a1a', '#2a2a2a', '#3a2a18', '#1d3a2a', '#5a1414'];
const BULB = ['#ffd9a0', '#ffb070', '#ff7a6a', '#8affb0', '#8ac4ff', '#ffe080'];

// ---------------------------------------------------------------- the street
const LANE = { half: 3.5, z0: -72, z1: 72 };
const HEIGHTS = [];
const wires = [];        // catenary polylines (drawn as thin lines)
const lamps = [];        // point-light positions
const fairy = [[], [], []];

function fairyRun(a, b, sag = 0.3, n) {
  const len = a.distanceTo(b); n = n || Math.max(4, Math.round(len / 0.35));
  const grp = Math.floor(rnd(0, 3)), col = C(pick(BULB), 2.4);
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * sag;
    fairy[grp].push([p, Math.random() < .25 ? C(pick(BULB), 2.4) : col]);
  }
}
function torans(x, y, z, w, facing) {
  for (let i = 0; i < 18; i++) { const t = i / 17, dz = (t - .5) * w, sag = Math.sin(t * Math.PI) * .18; ball('solid', .055, x + facing * .05, y - sag, z + dz, C(i % 2 ? '#ff9f1c' : '#ffc93c')); }
  for (let i = 0; i < 6; i++) { const dz = ((i + .5) / 6 - .5) * w; put('solid', new THREE.ConeGeometry(.05, .22, 4), C('#2f7a35'), M(x + facing * .05, y - .2 - Math.sin((i + .5) / 6 * Math.PI) * .18, dz + z, 0, Math.PI)); }
}
function rangoli(x, z, r) {
  const cols = ['#ff9f1c', '#e8301c', '#ffd23a', '#2f9e44', '#d6336c', '#f8f0e3', '#1c7ed6'];
  put('solid', new THREE.CircleGeometry(r, 24), C('#f4ecdc'), M(x, .012, z, 0, -Math.PI / 2));
  for (let k = 0; k < 3; k++) for (let i = 0; i < 10 - k * 2; i++) { const a = i / (10 - k * 2) * TAU + k; put('solid', new THREE.CircleGeometry(r * (.22 - k * .04), 8), C(cols[(i + k) % cols.length]), M(x + Math.cos(a) * r * (.68 - k * .22), .014 + k * .001, z + Math.sin(a) * r * (.68 - k * .22), 0, -Math.PI / 2)); }
}
function diya(x, y, z) { cyl('solid', .05, .035, .035, x, y + .018, z, C('#a0522d'), 8); ball('glow', .022, x, y + .06, z, C('#ffb347', 3)); }
function chair(x, z, ry, col) {
  const m = M(x, 0, z, ry); const parts = [[.42, .04, .4, 0, .42, 0], [.42, .4, .04, 0, .62, -.2], [.04, .42, .04, -.18, 0, -.18], [.04, .42, .04, .18, 0, -.18], [.04, .42, .04, -.18, 0, .18], [.04, .42, .04, .18, 0, .18]];
  for (const [w, h, d, px, py, pz] of parts) { const g = boxGeo(w, h, d); g.translate(px, py + h / 2, pz); put('solid', g, C(col), m); }
}
function maruti(x, z, ry, col) {
  const m = M(x, 0, z, ry);
  const add = (g, c) => put('solid', g, C(c), m);
  let g = boxGeo(1.4, .55, 3.3); g.translate(0, .55, 0); add(g, col);
  g = boxGeo(1.28, .5, 1.75); g.translate(0, 1.07, -.15); add(g, col);
  g = boxGeo(1.3, .38, 1.6); g.translate(0, 1.07, -.15); add(g, '#1a2430');
  for (const [wx, wz] of [[-.68, -1.05], [.68, -1.05], [-.68, 1.05], [.68, 1.05]]) { g = new THREE.CylinderGeometry(.28, .28, .18, 12); g.rotateZ(Math.PI / 2); g.translate(wx, .28, wz); add(g, '#141414'); }
  for (const lx of [-.48, .48]) { g = new THREE.CircleGeometry(.1, 10); g.translate(lx, .62, -1.66); g.rotateY(Math.PI); put('solid', g, C('#d8d0b0'), m); }
}
function scooter(x, z, ry, col) {
  const m = M(x, 0, z, ry), add = (g, c) => put('solid', g, C(c), m);
  let g = boxGeo(.62, .5, 1.1); g.translate(0, .45, .15); add(g, col);
  g = boxGeo(.58, .7, .1); g.translate(0, .62, -.45); add(g, col);
  g = boxGeo(.36, .12, .6); g.translate(0, .76, .2); add(g, '#2a1a10');
  g = new THREE.CylinderGeometry(.03, .03, .7, 6); g.rotateZ(Math.PI / 2); g.translate(0, 1.0, -.48); add(g, '#888');
  for (const wz of [-.5, .55]) { g = new THREE.CylinderGeometry(.2, .2, .12, 12); g.rotateZ(Math.PI / 2); g.translate(0, .2, wz); add(g, '#141414'); }
}
function cycle(x, z, ry) {
  const m = M(x, 0, z, ry);
  for (const wz of [-.52, .52]) { const g = new THREE.TorusGeometry(.32, .025, 5, 16); g.rotateY(Math.PI / 2); g.translate(0, .34, wz); put('solid', g, C('#1a1a1a'), m); }
  const g = boxGeo(.04, .04, 1.0); g.rotateX(-.25); g.translate(0, .6, 0); put('solid', g, C('#7a1a1a'), m);
  const s = boxGeo(.04, .45, .04); s.translate(0, .5, .2); put('solid', s, C('#7a1a1a'), m);
}
function tree(x, z, h = 7, r = 3) {
  cyl('solid', .22, .35, h * .55, x, h * .275, z, C('#3a2a1e'), 7);
  for (let i = 0; i < 6; i++) { const a = rnd(0, TAU), d = rnd(0, r * .55); ball('leaf', rnd(r * .45, r * .7), x + Math.cos(a) * d, h * .62 + rnd(-.6, 1.4), z + Math.sin(a) * d, C(pick(['#1f3a1a', '#24421c', '#1a3216', '#2c4a20']))); }
}
function pole(x, z) {
  cyl('solid', .09, .14, 8.5, x, 4.25, z, C('#8a8478'), 6);
  for (const y of [7.6, 8.1]) box('solid', 1.4, .08, .1, x, y, z, C('#5a5650'));
  return [new THREE.Vector3(x - .6, 8.1, z), new THREE.Vector3(x + .6, 8.1, z), new THREE.Vector3(x, 7.6, z)];
}
function catenary(a, b, sag) { const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16, p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * sag; pts.push(p); } wires.push(pts); }
function lamp(x, z, side) {
  cyl('solid', .06, .09, 6.5, x, 3.25, z, C('#6a665e'), 6);
  box('solid', .08, .08, 1.4, x, 6.4, z - side * .7, C('#6a665e'), Math.PI / 2);
  const hx = x - side * 1.3; box('solid', .5, .15, .25, hx, 6.25, z, C('#3a3834'));
  ball('glow', .14, hx, 6.2, z, C('#ffb060', 4));
  lamps.push(new THREE.Vector3(hx, 6, z));
}

// One North Indian plot: boundary wall + gate + aangan, 2–3 floors, balcony, roof parapet, tank, antenna.
function house(side, z, opt = {}) {
  const sx = side;                       // +1 east row (faces −x), −1 west row (faces +x)
  const front = sx * 4.6, fw = 9.6;     // plot frontage along z
  const setback = 3.4, depth = 11;
  const fx = front + sx * setback;      // building front face x
  const floors = opt.floors || pick([2, 2, 3]);
  const H = floors * 3.2;
  const brick = opt.brick ?? rnd() < .3;
  const col = C(opt.colour || (brick ? '#ffffff' : pick(PLASTER)));
  const key = brick ? 'brick' : 'solid';
  const cx = fx + sx * depth / 2;
  // body
  box(key, depth, H, fw - .2, cx, 0, z, col);
  box('solid', depth + .05, .06, fw - .15, cx, H - .03, z, C('#6e655c'));
  // floor bands
  for (let f = 1; f <= floors; f++) box('solid', .35, .18, fw, fx + sx * .05, f * 3.2 - .2, z, C('#cbbfa8', .95));
  // parapet with little pillars
  box('solid', depth, .9, .18, cx, H, z - fw / 2 + .2, C('#d8cdb8')); box('solid', depth, .9, .18, cx, H, z + fw / 2 - .2, C('#d8cdb8'));
  box('solid', .18, .9, fw, fx + sx * .1, H, z, C('#d8cdb8'));
  // stair mumty, water tank, TV antenna
  box('solid', 3, 2.6, 3, fx + sx * 7.5, H, z + fw / 2 - 2, col);
  cyl('solid', .62, .62, 1.3, fx + sx * 7.5, H + 2.6 + .65, z + fw / 2 - 2, C('#151515'), 12);
  cyl('solid', .66, .66, .06, fx + sx * 7.5, H + 2.6 + 1.0, z + fw / 2 - 2, C('#232323'), 12);
  if (rnd() < .8) { const ax = fx + sx * rnd(3, 6), az = z + rnd(-3, 2); cyl('solid', .025, .025, 3.6, ax, H + 1.8, az, C('#9a9a9a'), 4); for (let k = 0; k < 5; k++) box('solid', .03, .03, 1.2 - k * .15, ax, H + 2.4 + k * .28, az, C('#b0b0b0'), rnd(0, 1)); }
  // ground floor: door, windows with grills, lit or dark
  const win = (y, dz, lit) => {
    box('solid', .1, 1.25, 1.05, fx - sx * .02, y, z + dz, C('#2a1e14'));
    box('solid', .5, .07, 1.35, fx - sx * .25, y + 1.33, z + dz, C('#c8bca6'));                  // chhajja over the window
    if (y > 2 && rnd() < .3) { box('solid', .75, .85, .95, fx - sx * .42, y + .12, z + dz, C(pick(['#b8b0a0', '#9aa4a8', '#c8c0b0']))); for (let k = 0; k < 6; k++) box('solid', .02, .75, .02, fx - sx * .8, y + .17, z + dz - .4 + k * .16, C('#5a5650')); }   // desert cooler
    box(lit ? 'glow' : 'solid', .06, 1.1, .9, fx - sx * .06, y + .07, z + dz, lit ? C(pick(['#ffb868', '#ffc47a', '#ffd08f', '#ff9f58']), rnd(.85, 1.25)) : C('#1a1c22'));
    for (let k = 0; k < 4; k++) box('solid', .04, 1.1, .03, fx - sx * .1, y + .07, z + dz - .36 + k * .24, C('#141414'));
  };
  box('solid', .1, 2.2, 1.1, fx - sx * .02, 0, z + 1.6, C('#4a2a18'));             // door
  win(.9, -2.2, rnd() < .7); win(.9, 3.6, rnd() < .5);
  for (let f = 1; f < floors; f++) { win(f * 3.2 + .9, -2.4, rnd() < .6); win(f * 3.2 + .9, 1.2, rnd() < .55); win(f * 3.2 + .9, 3.6, rnd() < .4); }
  // first floor balcony: slab + iron railing + fairy lights
  const by = 3.2, bx = fx - sx * 1.2;
  box('solid', 1.3, .16, 5.4, fx - sx * .6, by - .1, z - .4, C('#cbbfa8'));
  for (let k = 0; k <= 26; k++) box('solid', .03, .9, .03, bx, by, z - 3.1 + k * .21, C('#1a1a1a'));
  box('solid', .05, .05, 5.4, bx, by + .9, z - .4, C('#1a1a1a'));
  fairyRun(new THREE.Vector3(bx, by + .95, z - 3.1), new THREE.Vector3(bx, by + .95, z + 2.3), .25);
  fairyRun(new THREE.Vector3(fx - sx * .05, H + .95, z - fw / 2 + .3), new THREE.Vector3(fx - sx * .05, H + .95, z + fw / 2 - .3), .2);
  for (let k = 0; k < 5; k++) { const dz = -fw / 2 + .6 + k * 2.1; fairyRun(new THREE.Vector3(fx - sx * .05, H + .9, z + dz), new THREE.Vector3(fx - sx * .05, rnd(.6, 2.4), z + dz), 0, 18); }
  // meter box and the cable-TV wire, clothesline and tulsi on the terrace
  box('solid', .12, .4, .3, fx - sx * .07, 1.5, z - 4.1, C('#d6d6cc')); box('solid', .02, .02, .02, fx - sx * .14, 1.75, z - 4.1, C('#e03020'));
  if (rnd() < .6) { const cy = H + 1.7, x1 = fx + sx * 2, x2 = fx + sx * 6.5, cz = z + rnd(-3, 1); cyl('solid', .02, .02, 1.7, x1, H + .85, cz, C('#555'), 4); cyl('solid', .02, .02, 1.7, x2, H + .85, cz, C('#555'), 4);
    catenary(new THREE.Vector3(x1, cy, cz), new THREE.Vector3(x2, cy, cz), .12);
    for (let k = 0; k < 5; k++) { const t = (k + .7) / 6, xx = x1 + (x2 - x1) * t; box('solid', .55, .7, .02, xx, cy - .78 - Math.sin(t * Math.PI) * .12, cz, C(pick(['#c8102e', '#f2efe6', '#1565c0', '#e2a23a', '#7b1fa2', '#2f9e44'])), 0); } }
  if (rnd() < .5) { cyl('solid', .2, .15, .35, fx + sx * 1.2, H + .17, z + 3.6, C('#a0522d'), 8); ball('leaf', .28, fx + sx * 1.2, H + .55, z + 3.6, C('#2f6a2a')); }
  // boundary wall, pillars, gate, diyas, toran, rangoli
  const wx = front;
  box('solid', .22, 1.15, fw / 2 - 1.6, wx, 0, z - fw / 4 - .8, C('#c8b89c')); box('solid', .22, 1.15, fw / 2 - 1.6, wx, 0, z + fw / 4 + .8, C('#c8b89c'));
  box('solid', .4, 1.7, .4, wx, 0, z - 1.6, C('#b8a688')); box('solid', .4, 1.7, .4, wx, 0, z + 1.6, C('#b8a688'));
  const gc = C(opt.gate || pick(GATE));
  for (let k = 0; k <= 14; k++) box('solid', .04, 1.35, .04, wx, 0, z - 1.4 + k * .2, gc);
  box('solid', .06, .06, 2.9, wx, 1.35, z, gc); box('solid', .06, .06, 2.9, wx, .5, z, gc);
  for (let k = 0; k < 6; k++) diya(wx, 1.15, z - fw / 2 + .5 + k * (fw / 2 - 2) / 5);
  for (let k = 0; k < 6; k++) diya(wx, 1.15, z + 2 + k * (fw / 2 - 2.4) / 5);
  torans(fx, 2.25, z + 1.6, 1.3, -sx);
  rangoli(front + sx * 1.6, z, .55);
  box('tiles', setback, .02, fw - .4, front + sx * setback / 2, 0, z, C('#ffffff'), 0, 1);
  // a few lived-in things in the aangan / outside
  if (opt.maruti) maruti(front + sx * 1.8, z - 2.6, 0, opt.maruti);
  else if (rnd() < .5) scooter(front + sx * 1.4, z - 3, .3, pick(['#8fb4c8', '#c8c0a8', '#b03a2e', '#5a7a8a']));
  if (rnd() < .45) { chair(front - sx * .7, z + rnd(-3, 3), rnd(0, TAU), pick(['#c0392b', '#f4f1ea', '#c0392b'])); chair(front - sx * .9, z + rnd(-3, 3), rnd(0, TAU), '#c0392b'); }
  if (rnd() < .4) { const g = new THREE.CylinderGeometry(.25, .18, .4, 8); put('solid', g, C('#a0522d'), M(front + sx * .5, .2, z + 3.4)); ball('leaf', .45, front + sx * .5, .7, z + 3.4, C('#2f5a24')); }
  HEIGHTS.push({ side: sx, z, H, fx: Math.abs(fx) });
  return { fx, H, front };
}

// The rest of Sector 8 around our gali: simpler homes with parapet lights, tanks and lit windows.
function farHouse(x, z, facing, w = 9.6) {
  const floors = pick([2, 2, 3, 3]), H = floors * 3.2, d = 10, brick = rnd() < .25;
  const col = C(brick ? '#ffffff' : pick(PLASTER));
  box(brick ? 'brick' : 'solid', d, H, w - .3, x, 0, z, col);
  box('solid', d + .05, .06, w - .25, x, H - .03, z, C('#6a6158'));
  box('solid', d, .8, .16, x, H, z - w / 2 + .2, C('#d0c4ae')); box('solid', d, .8, .16, x, H, z + w / 2 - .2, C('#d0c4ae'));
  const fx = x - facing * d / 2;
  box('solid', .16, .8, w, fx, H, z, C('#d0c4ae'));
  if (rnd() < .8) { cyl('solid', .55, .55, 1.1, x + facing * 2.5, H + .55, z + rnd(-2, 2), C('#141414'), 10); }
  for (let f = 0; f < floors; f++) for (const dz of [-2.6, .2, 2.8]) if (rnd() < .75) box(rnd() < .55 ? 'glow' : 'solid', .06, 1.0, .85, fx - facing * .04, f * 3.2 + .95, z + dz, rnd() < .55 ? C(pick(['#ffbf70', '#ffcf8a', '#ffd9a0', '#ffb060']), rnd(.9, 1.4)) : C('#181a20'));
  if (rnd() < .85) fairyRun(new THREE.Vector3(fx - facing * .05, H + .85, z - w / 2 + .3), new THREE.Vector3(fx - facing * .05, H + .85, z + w / 2 - .3), .2, 22);
  if (rnd() < .5) for (let k = 0; k < 3; k++) { const dz = -w / 2 + 1 + k * 3.6; fairyRun(new THREE.Vector3(fx - facing * .05, H + .8, z + dz), new THREE.Vector3(fx - facing * .05, rnd(.8, 2.6), z + dz), 0, 14); }
  box('solid', .2, 1.1, w - .4, x - facing * (d / 2 + 3), 0, z, C('#c4b498'));
  for (let k = 0; k < 4; k++) diya(x - facing * (d / 2 + 3), 1.1, z - 3.6 + k * 2.4);
}
function sectorAround(scene) {
  // back-to-back rows behind both sides of our gali, facing the next lanes
  for (let z = -60; z <= 60; z += 10) { farHouse(25, z, -1); if (z < -15 || z > 25) farHouse(-25, z, 1); }
  // the next lanes over, with homes on their far side too
  for (const lx of [-41, 41]) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(7, 150), new THREE.MeshLambertMaterial({ map: TEX.road(), color: 0x9a9a9a })); road.rotation.x = -Math.PI / 2; road.position.set(lx, 0, 0); scene.add(road);
    for (let z = -60; z <= 60; z += 10) farHouse(lx + Math.sign(lx) * 13, z, -Math.sign(lx));
    for (const z of [-40, -10, 20, 50]) lamp(lx + 4.1 * Math.sign(lx), z, Math.sign(lx));
  }
  // cross street at each end of our gali
  for (const cz of [-78, 78]) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(110, 8), new THREE.MeshLambertMaterial({ map: TEX.road(), color: 0x9a9a9a })); road.rotation.x = -Math.PI / 2; road.position.set(0, .001, cz); scene.add(road);
    for (let x = -50; x <= 50; x += 10) farHouse(x, cz + Math.sign(cz) * 12, 0, 9.6);
  }
}

// ---------------------------------------------------------------- the whole mohalla
function buildWorld(scene) {
  seed = 8;
  // ground: road, kerbs/dust, plots, park
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshLambertMaterial({ map: TEX.dust(), color: 0x8a7a68 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.02; scene.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(LANE.half * 2, LANE.z1 - LANE.z0), new THREE.MeshLambertMaterial({ map: TEX.road(), color: 0xaaaaaa }));
  road.rotation.x = -Math.PI / 2; scene.add(road);
  // naali along our side, with slabs here and there
  box('solid', .45, .02, LANE.z1 - LANE.z0, LANE.half + .35, -.05, 0, C('#1c2420'));
  for (let z = LANE.z0 + 4; z < LANE.z1; z += rnd(6, 11)) box('solid', .6, .08, 1.2, LANE.half + .35, 0, z, C('#8a8478'));
  // manholes
  for (const z of [-15, 12, 44]) put('solid', new THREE.CircleGeometry(.32, 16), C('#2a2a28'), M(0, .01, z, 0, -Math.PI / 2));

  // east row: our house at z = 0 (brown), neighbours named in the game
  const east = [[-60], [-50], [-40], [-30], [-20, { maruti: '#f2f2ee' }], [-10, { gate: '#2a2a2a' }], [0, { colour: OURS, brick: false, floors: 2, gate: '#5a1414', maruti: '#b8262a' }], [10, {}], [20, { floors: 3 }], [30], [40], [50], [60]];
  const ourHouse = {};
  for (const [z, o] of east) Object.assign(z === 0 ? ourHouse : {}, house(1, z, o));
  // west row with the park opposite our house and a construction plot
  for (const z of [-60, -50, -40, -30, -20, 40, 50, 60]) house(-1, z, z === -20 ? { floors: 3 } : {});
  // construction plot (z 30): sand, bricks, stones, a bamboo ladder
  put('solid', new THREE.ConeGeometry(2.2, 1.3, 14), C('#c9a66b'), M(-9, .62, 34));
  for (let i = 0; i < 4; i++) box('brick', 2.2, .55, 1.0, -7.4 + (i % 2) * .1, i * .55, 31 + (i % 2) * .08, C('#ffffff'), 0, 1);
  for (let i = 0; i < 9; i++) ball('solid', rnd(.15, .3), -11 + rnd(-1, 1), .15, 30 + rnd(-1, 1), C('#8a8478'));
  box('solid', .1, 3.2, .1, -12, 0, 28, C('#a08050')); box('solid', .1, 3.2, .1, -12, 0, 28.6, C('#a08050'));
  // the park: grass, railing, trees, benches, a swing, the fountain tank, a walking path
  const park = new THREE.Mesh(new THREE.PlaneGeometry(22, 42), new THREE.MeshLambertMaterial({ map: TEX.grass(), color: 0x9aa890 }));
  park.rotation.x = -Math.PI / 2; park.position.set(-15.5, .015, 5); scene.add(park);
  put('solid', new THREE.RingGeometry(7.5, 8.6, 40), C('#8a7a62'), M(-15.5, .02, 5, 0, -Math.PI / 2));
  for (let z = -15.6; z <= 25.6; z += .25) box('solid', .03, .9, .03, -4.6, 0, z, C('#1f5a2a'));
  box('solid', .05, .05, 41.2, -4.6, .9, 5, C('#1f5a2a')); box('solid', .05, .05, 41.2, -4.6, .35, 5, C('#1f5a2a'));
  box('solid', .4, 1.3, .4, -4.6, 0, 3.2, C('#9a9080')); box('solid', .4, 1.3, .4, -4.6, 0, 6.8, C('#9a9080'));
  for (const [x, z, h, r] of [[-12, -11, 8, 3.2], [-21, -10, 9, 3.8], [-12.5, 21, 7.5, 3], [-22, 18, 8.5, 3.6], [-11.6, 1.6, 7.5, 3.0], [-23, 3, 10, 4.2], [-17, -14, 6.5, 2.6], [-17, 23, 7, 2.8]]) tree(x, z, h, r);
  for (const [x, z, ry] of [[-11, -1, 0], [-20, 9, Math.PI], [-12, 13, Math.PI / 2]]) { box('solid', 1.6, .08, .45, x, .45, z, C('#6a4a30'), ry); box('solid', .08, .45, .45, x - .7, 0, z, C('#3a3a3a'), ry); box('solid', .08, .45, .45, x + .7, 0, z, C('#3a3a3a'), ry); }
  box('solid', .08, 2.4, .08, -19, 0, -4, C('#7a2a2a')); box('solid', .08, 2.4, .08, -19, 0, -2, C('#7a2a2a')); box('solid', .1, .1, 2.2, -19, 2.4, -3, C('#7a2a2a'));
  box('solid', .7, .05, .3, -19, .55, -3, C('#c08040'));
  cyl('solid', 2.2, 2.3, .5, -15, .25, 6, C('#a8a092'), 24); put('solid', new THREE.CircleGeometry(2.0, 24), C('#123040'), M(-15, .48, 6, 0, -Math.PI / 2));
  // the cow, sitting at the park corner (cute, chewing)
  { const m = M(-6.4, 0, -14.2, .6); const add = (g, c) => put('solid', g, C(c), m);
    let g = boxGeo(.8, .65, 1.5); g.translate(0, .38, 0); add(g, '#e9e2d4');
    g = boxGeo(.42, .42, .55); g.translate(0, .72, -.95); add(g, '#e9e2d4');
    g = boxGeo(.3, .16, .2); g.translate(0, .6, -1.25); add(g, '#c9a090');
    for (const s of [-1, 1]) { g = new THREE.ConeGeometry(.04, .22, 5); g.rotateZ(s * .6); g.translate(s * .16, 1.0, -.95); add(g, '#d8c8a8'); g = boxGeo(.12, .06, .18); g.translate(s * .27, .82, -.9); add(g, '#e0d6c4'); }
    g = boxGeo(.5, .2, .42); g.translate(-.2, .14, .55); add(g, '#d9d0c0'); }
  // the red pillar postbox at the corner
  cyl('solid', .3, .3, 1.1, 4.4, .55, -64, C('#b3161b'), 16); put('solid', new THREE.SphereGeometry(.32, 16, 8, 0, TAU, 0, Math.PI / 2), C('#b3161b'), M(4.4, 1.1, -64));
  box('solid', .03, .05, .3, 4.1, .9, -64, C('#111'));
  // Sector 8 signboard at the gali mouth
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .75), new THREE.MeshBasicMaterial({ map: TEX.sign(), toneMapped: false })); sign.position.set(-4.6, 2.4, -68); sign.rotation.y = Math.PI / 2; scene.add(sign);
  cyl('solid', .04, .04, 2.4, -4.6, 1.2, -69, C('#666'), 5); cyl('solid', .04, .04, 2.4, -4.6, 1.2, -67, C('#666'), 5);
  // charpai under the neem with a transistor
  box('solid', 1.9, .08, .9, -6.8, .45, -9, C('#7a5a3a')); for (const [dx, dz] of [[-.85, -.4], [.85, -.4], [-.85, .4], [.85, .4]]) box('solid', .08, .45, .08, -6.8 + dx, 0, -9 + dz, C('#4a3220'));
  // bicycles and scooters along the lane
  cycle(3.0, -27, .1); cycle(-3.2, 15, -.2); cycle(3.1, 37, 0); scooter(-3.0, -34, .2, '#8fb4c8'); scooter(3.0, 24, -.1, '#c8c0a8'); maruti(-2.6, 47, 0, '#2a4a8a');
  // poles, wires (sagging and tangled), sodium lamps
  const poleZ = [-62, -38, -14, 10, 34, 58];
  const tops = poleZ.map((z, i) => pole(i % 2 ? -4.2 : 4.2, z));
  for (let i = 0; i < tops.length - 1; i++) for (let k = 0; k < 3; k++) catenary(tops[i][k], tops[i + 1][k], rnd(.5, .9));
  for (const [i, z] of poleZ.entries()) for (const fz of [-6, -2, 2, 6]) catenary(tops[i][2], new THREE.Vector3(i % 2 ? -5 : 5, rnd(5.5, 6.5), z + fz), .3);   // drops to houses
  for (const z of [-50, -26, -2, 22, 46]) lamp(z % 4 === 0 ? 4.1 : -4.1, z, z % 4 === 0 ? 1 : -1);
  for (let z = -62; z < 62; z += rnd(7, 13)) catenary(new THREE.Vector3(8, rnd(4.2, 5.4), z), new THREE.Vector3(-8, rnd(4.2, 5.4), z + rnd(-4, 4)), rnd(.4, .9));
  // the patakhe ki dukaan at the corner: a table piled with boxes, a striped tarp and one bare bulb
  box('solid', 2.6, .8, 1.0, -5.6, 0, -66, C('#6a4a30'));
  for (let i = 0; i < 26; i++) box('solid', rnd(.18, .34), rnd(.06, .2), rnd(.14, .26), -5.6 + rnd(-1.15, 1.15), .8 + (i > 13 ? .16 : 0), -66 + rnd(-.38, .38), C(pick(['#d6336c', '#ffc93c', '#2f9e44', '#1c7ed6', '#e8301c', '#7b1fa2', '#ff9f1c'])), rnd(0, 1));
  for (const [x, z] of [[-6.9, -66.6], [-4.3, -66.6], [-6.9, -65.2], [-4.3, -65.2]]) box('solid', .05, 2.4, .05, x, 0, z, C('#7a6a50'));
  for (let i = 0; i < 6; i++) put('solid', new THREE.PlaneGeometry(.45, 1.7), C(i % 2 ? '#2a5aa8' : '#e8e0c8'), M(-6.7 + i * .45, 2.5, -65.9, 0, -Math.PI / 2 + .12));
  ball('glow', .09, -5.6, 2.15, -65.9, C('#fff0c0', 4)); lamps.push(new THREE.Vector3(-5.6, 2.1, -65.9));
  // fairy lights strung across the gali at a few spots
  for (const z of [-5, 5, 15]) fairyRun(new THREE.Vector3(4.6, 5.6, z), new THREE.Vector3(-4.6, 5.6, z + 1), .7, 30);
  sectorAround(scene);
  return ourHouse;
}

// ---------------------------------------------------------------- mess left behind
const MESS = {
  scorch: [{ decal: 1 }, { paper: 40 }], 'scorch-long': [{ decal: 1, long: 1 }, { paper: 20 }], paper: [{ decal: 1 }, { paper: 160 }], ladi: [{ paper: 260, spread: 3.5 }],
  tin: [{ decal: 1 }, { paper: 40 }, { obj: 'tin' }], tumbler: [{ paper: 20 }, { obj: 'tumbler' }], bucket: [{ decal: 1 }, { obj: 'bucket' }], coconut: [{ decal: 1 }, { obj: 'coconut' }],
  shards: [{ decal: 1 }, { obj: 'shards' }], ball: [{ obj: 'fuzz' }], snow: [{ obj: 'snow' }], drum: [{ decal: 1 }, { obj: 'drum' }], disc: [{ decal: 1 }, { obj: 'disc' }], box: [{ obj: 'box' }],
  anaar: [{ decal: 1 }, { obj: 'cone' }], killa: [{ decal: 1 }, { paper: 30 }], soldiers: [{ obj: 'soldiers' }], ash: [{ obj: 'ash' }], wire: [{ obj: 'wires' }], matches: [{ obj: 'matches' }],
  caps: [{ paper: 30, colours: ['#d82020', '#f4ecdc'] }], stick: [{ obj: 'stick' }], lid: [{ decal: 1 }, { obj: 'lid' }], wet: [{ decal: 1, wet: 1 }], car: [{ decal: 1, long: 1 }, { obj: 'toycar' }],
  wall: [{ decal: 1 }, { paper: 30 }], crater: [{ obj: 'crater' }], brick: [{ obj: 'brick' }], splat: [{ decal: 1, splat: 1 }], leaves: [{ obj: 'leaves' }], postbox: [{ paper: 30 }, { smoke: 1 }],
  narakasur: [{ decal: 1, big: 1 }, { paper: 120 }, { obj: 'ashpile' }], none: [],
};
function decalTex(kind) {
  return canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62);
    const c = kind === 'wet' ? '20,30,40' : kind === 'splat' ? '70,50,24' : '16,10,6';
    gr.addColorStop(0, `rgba(${c},.85)`); gr.addColorStop(.55, `rgba(${c},.5)`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.beginPath(); for (let i = 0; i <= 20; i++) { const a = i / 20 * TAU, r = 40 + Math.random() * 22; g[i ? 'lineTo' : 'moveTo'](64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.fill();
  });
}

// ---------------------------------------------------------------- the public map
const S = { ready: false };
export function init(canvas, { points, onPick, markerLayer }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.6 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = TEX.sky();
  scene.fog = new THREE.FogExp2(0x1a1830, 0.0042);
  const camera = new THREE.PerspectiveCamera(48, 1, .1, 600);

  // light: amavasya night (no moon), sky glow, warm sodium lamps
  scene.add(new THREE.HemisphereLight(0x8090d0, 0x6a4a30, 1.9));
  const key = new THREE.DirectionalLight(0x9aa8e0, .7); key.position.set(-30, 60, -20); scene.add(key);

  // materials
  const mats = {
    solid: new THREE.MeshLambertMaterial({ vertexColors: true, map: TEX.grime() }),
    brick: new THREE.MeshLambertMaterial({ vertexColors: true, map: TEX.brick() }),
    tiles: new THREE.MeshLambertMaterial({ vertexColors: true, map: TEX.tiles() }),
    leaf: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  };
  buildWorld(scene);
  for (const pt of points) if (pt.roof) { const h = HEIGHTS.find(q => q.side === pt.roof.side && Math.abs(q.z - pt.roof.z) < 1); if (h) pt.pos[1] = h.H + .3; }
  for (const [k, list] of Object.entries(buckets)) { const mesh = new THREE.Mesh(mergeGeometries(list), mats[k]); scene.add(mesh); }
  for (const p of lamps) { const l = new THREE.PointLight(0xffa850, 26, 22, 1.6); l.position.copy(p); scene.add(l); }
  // warm spill in front of our house
  { const l = new THREE.PointLight(0xffb060, 14, 14, 1.6); l.position.set(6, 2.6, 0); scene.add(l); }
  // wires
  const wmat = new THREE.LineBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: .85 });
  for (const pts of wires) scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wmat));
  // fairy lights: three twinkle groups
  const bulbMats = [];
  for (const grp of fairy) {
    const geos = grp.map(([p, c]) => { const g = new THREE.IcosahedronGeometry(.045, 0).toNonIndexed(); g.translate(p.x, p.y, p.z); const n = g.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; });
    if (!geos.length) continue;
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true }); bulbMats.push(m);
    scene.add(new THREE.Mesh(mergeGeometries(geos), m));
    // the same bulbs as screen-size glow points, so the whole sector sparkles when you zoom out
    const pos = new Float32Array(grp.length * 3), col = new Float32Array(grp.length * 3);
    grp.forEach(([p, c], i) => { pos.set([p.x, p.y, p.z], i * 3); col.set([c.r * .6, c.g * .6, c.b * .6], i * 3); });
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pm = new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, toneMapped: false, transparent: true, depthWrite: false }); bulbMats.push(pm);
    scene.add(new THREE.Points(pg, pm));
  }
  // stars (amavasya: lots of them, a little hazy)
  { const g = new THREE.BufferGeometry(), n = 900, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, e = Math.random() * .5 + .08, r = 400; pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; } g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfd6ff, size: 1.2, sizeAttenuation: false, fog: false, transparent: true, opacity: .7 }))); }

  // Diwali smoke haze hanging in the gali, catching the light
  const hazeTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,230,200,.55)'); gr.addColorStop(1, 'rgba(255,230,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const haze = [];
  for (let i = 0; i < 26; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: hazeTex, color: 0xd8b898, transparent: true, opacity: .07, depthWrite: false, fog: true })); sp.position.set(rnd(-12, 12), rnd(1.5, 6), rnd(-66, 66)); sp.scale.setScalar(rnd(8, 16)); scene.add(sp); haze.push(sp); }
  const life = createLife(scene, { sfx: window.Sfx, houses: HEIGHTS });

  // post: bloom on the bright stuff
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .85, .55, .82); composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------------- camera: travel the street, zoom from rooftop-close to the whole sector
  const cam = { tx: 0, ty: 1.2, tz: 0, dist: 150, yaw: -.55, cur: null, anim: null };
  const pitchFor = d => THREE.MathUtils.lerp(.5, .95, THREE.MathUtils.clamp((d - 6) / 120, 0, 1));
  function applyCam() {
    const c = cam.cur || cam, p = pitchFor(c.dist);
    const ty = c.ty ?? 1.2;
    camera.position.set(c.tx + Math.sin(c.yaw) * Math.cos(p) * c.dist, Math.sin(p) * c.dist + ty, c.tz + Math.cos(c.yaw) * Math.cos(p) * c.dist);
    camera.lookAt(c.tx, ty, c.tz);
  }
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  // stop a flight where it is, but always resolve its promise (so nothing waiting on it hangs)
  function stopAnim() { const a = cam.anim; if (!a) return; Object.assign(cam, cam.cur || {}); cam.cur = null; cam.anim = null; a.done?.(); }
  function flyTo(to, dur = 1.4) {
    stopAnim(); const c0 = cam.cur || cam, from = { tx: c0.tx, ty: c0.ty ?? 1.2, tz: c0.tz, dist: c0.dist, yaw: c0.yaw }; cam.anim = { from, to: { ...from, ...to }, t: 0, dur }; return new Promise(r => cam.anim.done = r); }
  const clampCam = () => { cam.tz = THREE.MathUtils.clamp(cam.tz, -70, 70); cam.tx = THREE.MathUtils.clamp(cam.tx, -26, 20); cam.dist = THREE.MathUtils.clamp(cam.dist, 5, 160); };

  // gestures: drag = travel, wheel/pinch = zoom, right-drag/two-finger twist = turn
  const ptrs = new Map(); let pinch0 = null, moved = 0, locked = false;
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button }); moved = 0; if (!locked) stopAnim(); });
  canvas.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p || locked) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(a.y - b.y, a.x - b.x);
      if (pinch0) { cam.dist *= pinch0.d / d; cam.yaw -= ang - pinch0.ang; } pinch0 = { d, ang }; clampCam(); return;
    }
    // drag sideways = look around; drag up/down = walk along the gali
    cam.yaw -= dx * .005;
    walk(-dy * (cam.dist * .004 + .04));
  });
  const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault(); if (locked) return; stopAnim();
    if (e.ctrlKey) { cam.dist *= Math.exp(e.deltaY * .01); clampCam(); return; }      // trackpad pinch
    walk(e.deltaY * (cam.dist * .0016 + .02)); cam.yaw -= e.deltaX * .003;
  }, { passive: false });
  addEventListener('keydown', e => { if (!visible) return; if (e.key === 'ArrowUp' || e.key === 'w') walk(-2.5); if (e.key === 'ArrowDown' || e.key === 's') walk(2.5); if (e.key === 'ArrowLeft') cam.yaw += .12; if (e.key === 'ArrowRight') cam.yaw -= .12; if (e.key === '+' || e.key === '=') zoomBy(.8); if (e.key === '-') zoomBy(1.25); });
  // walking moves you along the street in the direction you're facing, and drifts you back to the middle
  function walk(d) { const f = -Math.cos(cam.yaw) >= 0 ? 1 : -1; cam.tz += d * f; cam.tx += (1 - cam.tx) * .08; cam.ty += (1.2 - cam.ty) * .1; clampCam(); }
  function zoomBy(k) { flyTo({ dist: THREE.MathUtils.clamp((cam.cur || cam).dist * k, 5, 160) }, .5); }

  // ---------------- markers (HTML, projected)
  const markers = points.map(pt => {
    const b = document.createElement('button'); b.className = 'mk'; b.dataset.id = pt.id;
    b.innerHTML = `<span class="em">${pt.icon}</span><span class="tag"></span><i class="tick">✋</i>`;
    b.querySelector('.tag').textContent = pt.title; b.setAttribute('aria-label', pt.title);
    b.addEventListener('click', () => { if (moved < 10) onPick(pt); });
    markerLayer.appendChild(b);
    return { pt, el: b, v: new THREE.Vector3(pt.pos[0], pt.pos[1] + .9, pt.pos[2]) };
  });
  const tmp = new THREE.Vector3();
  function placeMarkers() {
    const W = innerWidth, H = innerHeight, c = cam.cur || cam;
    const near = markers.map(m => [m, camera.position.distanceTo(m.v)]).filter(([, d]) => d < 22).sort((a, b) => a[1] - b[1]).slice(0, 4).map(([m]) => m);
    for (const m of markers) m.el.classList.toggle('near', near.includes(m));
    for (const m of markers) {
      tmp.copy(m.v).project(camera);
      const on = tmp.z < 1 && Math.abs(tmp.x) < 1.15 && Math.abs(tmp.y) < 1.15;
      if (!on) { m.el.style.visibility = 'hidden'; continue; }
      const d = camera.position.distanceTo(m.v), s = THREE.MathUtils.clamp(16 / d, .55, 1.15);
      m.el.style.visibility = 'visible';
      m.el.style.transform = `translate(${((tmp.x + 1) / 2 * W) | 0}px, ${((1 - tmp.y) / 2 * H) | 0}px) translate(-50%, -50%) scale(${s.toFixed(2)})`;
      m.el.classList.toggle('dot', d > 45);
    }
    youEl.style.top = `${((c.tz + 70) / 140 * 100).toFixed(1)}%`;
  }

  // ---------------- the street rail: where you are, where the shararatein are, tap to go
  const rail = document.createElement('nav'); rail.id = 'rail'; rail.setAttribute('aria-label', 'Gali');
  rail.innerHTML = '<i class="you"></i>' + [['Dukaan', -66], ['Postbox', -62], ['Park', 5], ['Hamara ghar', 0], ['Narakasur', 64]].map(([n, z]) => `<b style="top:${(z + 70) / 140 * 100}%">${n}</b>`).join('');
  for (const m of markers) { const d = document.createElement('span'); d.style.top = `${(m.pt.pos[2] + 70) / 140 * 100}%`; d.dataset.id = m.pt.id; m.rail = d; rail.appendChild(d); }
  document.body.appendChild(rail);
  rail.addEventListener('click', e => { const r = rail.getBoundingClientRect(), z = (e.clientY - r.top) / r.height * 140 - 70; flyTo({ tz: THREE.MathUtils.clamp(z, -68, 68), tx: 1, dist: Math.min((cam.cur || cam).dist, 24) }, 1.2); });
  const youEl = rail.querySelector('.you');

  // ---------------- mess that stays
  const messGroup = new THREE.Group(); scene.add(messGroup);
  const decals = { scorch: decalTex('scorch'), wet: decalTex('wet'), splat: decalTex('splat') };
  const lam = c => new THREE.MeshLambertMaterial({ color: c });
  function addMess(pt, burst = false) {
    const [x, y, z] = pt.pos, g = new THREE.Group(); g.position.set(x, y + .01, z); messGroup.add(g);
    for (const part of MESS[pt.mess] || MESS.scorch) {
      if (part.decal) { const s = part.big ? 4 : part.long ? 1 : 1.3; const d = new THREE.Mesh(new THREE.PlaneGeometry(s * (part.long ? 3.5 : 1), s), new THREE.MeshBasicMaterial({ map: decals[part.wet ? 'wet' : part.splat ? 'splat' : 'scorch'], transparent: true, depthWrite: false })); d.rotation.x = -Math.PI / 2; d.rotation.z = Math.random() * TAU; d.position.y = .005; g.add(d); }
      if (part.paper) {
        const n = part.paper, cols = (part.colours || ['#c0261e', '#d8322a', '#e6c06a', '#f4ecdc', '#9a1a14']).map(c => new THREE.Color(c));
        const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(.07, .045), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), n);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sp = part.spread || 1.6;
        for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = Math.pow(Math.random(), .6) * sp; q.setFromEuler(new THREE.Euler(-Math.PI / 2 + (Math.random() - .5) * .4, 0, Math.random() * TAU)); m4.compose(new THREE.Vector3(Math.cos(a) * r * (part.spread ? 1 : 1), .01 + Math.random() * .01, Math.sin(a) * r * (part.spread ? 2.4 : 1)), q, new THREE.Vector3(1, 1, 1)); inst.setMatrixAt(i, m4); inst.setColorAt(i, cols[i % cols.length]); }
        inst.userData.fall = burst; g.add(inst);
      }
      if (part.obj) g.add(messObject(part.obj));
    }
    if (burst) { g.userData.born = performance.now(); g.scale.setScalar(.01); }
    return g;
  }
  function messObject(kind) {
    const o = new THREE.Group(), add = (geo, col, x = 0, yy = 0, zz = 0, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, lam(col)); m.position.set(x, yy, zz); m.rotation.set(rx, ry, rz); o.add(m); return m; };
    const R = () => Math.random();
    switch (kind) {
      case 'tin': add(new THREE.CylinderGeometry(.09, .1, .2, 12), '#e6b83a', .8, .09, .3, Math.PI / 2, 0, .4); break;
      case 'tumbler': add(new THREE.CylinderGeometry(.045, .038, .11, 12), '#c8ccd2', .5, .045, -.4, Math.PI / 2 - .2, .6, 0); break;
      case 'bucket': add(new THREE.CylinderGeometry(.15, .12, .26, 14, 1, true), '#3a6ab8', -.8, .12, .5, Math.PI / 2, .3, 0); break;
      case 'coconut': for (let i = 0; i < 6; i++) add(new THREE.SphereGeometry(.07, 6, 4, 0, 1.4, 0, 1.2), '#6a4428', (R() - .5) * 1.6, .02, (R() - .5) * 1.6, R() * 3, R() * 3, R()); break;
      case 'shards': for (let i = 0; i < 12; i++) add(new THREE.BoxGeometry(.12, .02, .09), '#a8552e', (R() - .5) * 2.4, .01, (R() - .5) * 2.4, 0, R() * 3, 0); break;
      case 'fuzz': for (let i = 0; i < 7; i++) add(new THREE.SphereGeometry(.03, 6, 4, 0, 2, 0, 1.4), '#c8de46', (R() - .5) * 1.8, .01, (R() - .5) * 1.8, R() * 3, R() * 3, 0); break;
      case 'snow': { const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(.012, 4, 3), lam('#f6f6f2'), 220), m4 = new THREE.Matrix4(); for (let i = 0; i < 220; i++) { m4.makeTranslation((R() - .5) * 2.4, .01, (R() - .5) * 2.4); inst.setMatrixAt(i, m4); } o.add(inst); add(new THREE.BoxGeometry(.3, .1, .2), '#f2f2ee', .3, .05, .2, 0, .5, .2); break; }
      case 'drum': add(new THREE.CylinderGeometry(.28, .28, .85, 16, 1, true), '#2a4a8a', 0, .42, 0); break;
      case 'disc': add(new THREE.CylinderGeometry(.04, .04, .015, 12), '#2a2420', .3, .01, .2); break;
      case 'box': for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(.25, .005, .18), pick(['#d6336c', '#ffc93c', '#7a5030']), (R() - .5) * 1.4, .01, (R() - .5) * 1.4, 0, R() * 3, 0); break;
      case 'cone': add(new THREE.ConeGeometry(.05, .1, 10), '#2a2420', 0, .05, 0); break;
      case 'soldiers': for (let i = 0; i < 8; i++) add(new THREE.BoxGeometry(.02, .02, .06), i % 2 ? '#3a6a2a' : '#c8a46a', (R() - .5) * .8, .01, (R() - .5) * .8, 0, R() * 3, 0); break;
      case 'ash': { const pts = []; let a = R() * 3, px = 0, pz = 0; for (let i = 0; i < 14; i++) { a += (R() - .5) * 1.2; px += Math.cos(a) * .04; pz += Math.sin(a) * .04; pts.push(new THREE.Vector3(px, .02, pz)); } add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .018, 6), '#3a3634'); break; }
      case 'wires': for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(.003, .003, .3, 3), '#1a1a1a', (R() - .5) * .8, .01, (R() - .5) * .8, Math.PI / 2, R() * 3, 0); break;
      case 'matches': for (let i = 0; i < 20; i++) add(new THREE.BoxGeometry(.004, .004, .05), '#2a1a12', (R() - .5) * .6, .01, (R() - .5) * .6, 0, R() * 3, 0); break;
      case 'stick': for (let i = 0; i < 2; i++) add(new THREE.CylinderGeometry(.006, .006, .55, 4), '#b08a50', (R() - .5) * 2, .02, (R() - .5) * 2, Math.PI / 2, R() * 3, 0); break;
      case 'lid': add(new THREE.CylinderGeometry(.32, .32, .04, 16), '#3a3836', .8, .05, .4, .25, 0, .1); break;
      case 'toycar': add(new THREE.BoxGeometry(.12, .05, .2), '#d02a2a', 1.5, .03, 2.5, 0, .6, 3.0); break;
      case 'crater': add(new THREE.TorusGeometry(.12, .05, 6, 14), '#c9a66b', 0, .02, 0, -Math.PI / 2); break;
      case 'brick': add(new THREE.BoxGeometry(.23, .075, .11), '#a8452e', 1.2, .04, .4, 0, .7, 0); break;
      case 'leaves': { const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(.05, .03), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), 200), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); for (let i = 0; i < 200; i++) { q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, R() * 6)); m4.compose(new THREE.Vector3((R() - .5) * 3, .01, (R() - .5) * 3), q, new THREE.Vector3(1, 1, 1)); inst.setMatrixAt(i, m4); inst.setColorAt(i, new THREE.Color(pick(['#8a5a20', '#b08030', '#6a4a20']))); } o.add(inst); break; }
      case 'ashpile': add(new THREE.ConeGeometry(.6, .25, 12), '#2a2622', 0, .12, 0); break;
    }
    return o;
  }

  // ---------------- loop
  let visible = true, last = 0, t0 = performance.now();
  function size() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  addEventListener('resize', size); size();
  function loop(t) {
    requestAnimationFrame(loop);
    if (!visible || document.hidden) { last = t; return; }
    step(t);
  }
  function step(t) {
    const dt = Math.max(0, Math.min(.05, (t - (last || t)) / 1000)); last = Math.max(last || 0, t);
    if (cam.anim) { const a = cam.anim; a.t = Math.min(1, a.t + dt / a.dur); const e = ease(a.t); cam.cur = {}; for (const k of ['tx', 'ty', 'tz', 'dist', 'yaw']) cam.cur[k] = a.from[k] + (a.to[k] - a.from[k]) * e; if (a.t >= 1) { Object.assign(cam, a.to); cam.cur = null; cam.anim = null; a.done?.(); } }
    applyCam();
    const tt = (t - t0) / 1000;
    life.update(dt, camera, tt);
    for (const h of haze) { h.position.x += Math.sin(tt * .05 + h.position.z) * dt * .2; }
    bulbMats.forEach((m, i) => { m.opacity = .55 + .45 * (0.5 + 0.5 * Math.sin(tt * (1.3 + i * .55) + i * 2)); });
    for (const g of messGroup.children) if (g.userData.born) { const k = Math.min(1, (t - g.userData.born) / 600); g.scale.setScalar(.01 + .99 * (1 - Math.pow(1 - k, 3))); if (k >= 1) delete g.userData.born; }
    composer.render();
    placeMarkers();
  }
  requestAnimationFrame(loop);
  let simT = 0;
  S.ready = true;

  return {
    show() { visible = true; canvas.style.visibility = 'visible'; markerLayer.classList.add('on'); rail.classList.add('on'); size(); },
    hide() { visible = false; canvas.style.visibility = 'hidden'; markerLayer.classList.remove('on'); rail.classList.remove('on'); life.mute(); },
    zoomBy,
    lock(v) { locked = v; },
    flyTo, cam,
    overview() { return flyTo({ tx: -2, ty: 1.2, tz: (cam.cur || cam).tz * .4, dist: 150, yaw: -.55 }, 1.6); },
    street(z = 0) { return flyTo({ tx: 1, ty: 1.2, tz: z, dist: 22, yaw: -1.0 }, 1.6); },
    // back out to the gali after a moment: always a clean, open street view at that spot
    returnTo(pt) { return flyTo({ tx: 1, ty: 1.2, tz: THREE.MathUtils.clamp(pt.pos[2], -66, 66), dist: 20, yaw: pt.pos[0] < -4.5 ? -.75 : -1.05 }, 1.3); },
    focus(pt, close = 7) { const x = pt.pos[0]; return flyTo({ tx: x, ty: Math.max(1.2, pt.pos[1] + .4), tz: pt.pos[2], dist: close, yaw: x > 4.5 ? -1.35 : x < -4.5 ? 1.35 : (cam.cur || cam).yaw }, 1.1); },
    addMess, setDone(id, done) { const m = markers.find(x => x.pt.id === id); m?.el.classList.toggle('done', done); m?.rail?.classList.toggle('done', done); },
    pop(id) { const m = markers.find(x => x.pt.id === id); if (!m) return; m.el.classList.remove('pop'); void m.el.offsetWidth; m.el.classList.add('pop'); },
    get zoomedOut() { return (cam.cur || cam).dist > 60; },
    // fixed-step frames for tests and stills (works when the tab isn't animating)
    advance(sec, fps = 30) { simT = Math.max(simT, last || 0, performance.now() - 1); for (let i = 0; i < sec * fps; i++) { simT += 1000 / fps; step(simT); } },
  };
}

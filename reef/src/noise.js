// small deterministic noise helpers (CPU side)
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
let seed = 1;
export const srand = (s) => { seed = s >>> 0 || 1; };
export const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
export const rr = (a, b) => a + (b - a) * rnd();
export const pick = (arr) => arr[(rnd() * arr.length) | 0];
const fract = (x) => x - Math.floor(x);
export const hash2 = (x, z) => fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453);
export const hash3 = (x, y, z) => fract(Math.sin(x * 127.1 + y * 269.5 + z * 311.7) * 43758.5453);
const fade = (t) => t * t * (3 - 2 * t);
export function noise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), u = fade(x - xi), v = fade(z - zi);
  return lerp(lerp(hash2(xi, zi), hash2(xi + 1, zi), u), lerp(hash2(xi, zi + 1), hash2(xi + 1, zi + 1), u), v);
}
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
  const a = lerp(lerp(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), lerp(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v);
  const b = lerp(lerp(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), lerp(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v);
  return lerp(a, b, w);
}
export function fbm2(x, z, oct = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * noise2(x * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }
export function fbm3(x, y, z, oct = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }

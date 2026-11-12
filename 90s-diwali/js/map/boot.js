// boot.js — load the 3D mohalla (three.js from the CDN). If anything fails, the app falls back to the flat gali.
try {
  const mod = await import('./map3d.js' + new URL(import.meta.url).search);
  window.Map3D = mod;
  dispatchEvent(new Event('map3d-ready'));
} catch (e) {
  console.warn('3D map unavailable, using the flat gali', e);
  window.Map3D = null;
  dispatchEvent(new Event('map3d-failed'));
}

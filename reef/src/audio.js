// Sound: synthesized reef ambience (rumble, surface wash, bubbles, snapping-shrimp crackle), a sonar ping,
// and narration playback from narration/<key>.m4a with a speech-synthesis fallback. iPhone-safe unlock.
let AC, out, duckG, lim, rushG, rushF, washG, crackG, rumG, padG, nightK = 0, aboveK = 1, muted = false, started = false;
const VOL = 0.8;
const rnd = Math.random, rr = (a, b) => a + (b - a) * rnd();
export const isReady = () => !!AC;

export function unlock() {
  if (!AC) {
    AC = new AudioContext({ latencyHint: 'playback' });
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not iOS */ }
    build();
  }
  if (AC.state === 'suspended') AC.resume();
}
function build() {
  const ac = AC, sr = ac.sampleRate;
  const N = (C, o, ...to) => { const n = new C(ac, o); for (const d of to) n.connect(d); if (n.start) n.start(); return n; };
  const G = (gain, ...to) => N(GainNode, { gain }, ...to);
  const BQ = (type, frequency, Q, ...to) => N(BiquadFilterNode, { type, frequency, Q }, ...to);
  const lfo = (frequency, depth, to) => N(OscillatorNode, { frequency }, G(depth, to));
  const noise = (secs, f) => { const n = sr * secs | 0, b = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: sr }); f(b.getChannelData(0), n); f(b.getChannelData(1), n); return b; };
  const brown = noise(11, (d, n) => { let b = 0; for (let i = 0; i < n + 4096; i++) { b = (b + 0.02 * (rnd() * 2 - 1)) / 1.02; if (i < n) d[i] = b * 3.5; else { const k = (i - n) / 4096; d[i - n] = d[i - n] * k + b * 3.5 * (1 - k); } } });
  // snapping shrimp: sparse clicks with a sharp attack and fast decay, two loops at different rates so it never repeats
  const crackle = noise(7, (d, n) => { d.fill(0); let i = 0; while (i < n) { i += (rr(0.004, 0.09) * sr) | 0; const a = rr(0.1, 1) ** 2; for (let k = 0; k < 160 && i + k < n; k++) d[i + k] += (rnd() * 2 - 1) * a * Math.exp(-k / 25); } });
  lim = N(DynamicsCompressorNode, { threshold: -8, knee: 8, ratio: 16, attack: 0.003, release: 0.25 }, ac.destination);
  out = G(0, lim); duckG = G(1, out);
  const src = (buffer, playbackRate, ...to) => N(AudioBufferSourceNode, { buffer, loop: true, playbackRate }, ...to);
  const rum = rumG = G(0.3, duckG); src(brown, 1, BQ('lowpass', 140, 0.7, rum)); lfo(0.07, 0.1, rum.gain); lfo(0.113, 0.07, rum.gain);
  washG = G(0.22, duckG); const wave = G(1, washG); rushG = G(0, duckG); rushF = BQ('bandpass', 300, 0.9, rushG);
  src(brown, 0.63, BQ('bandpass', 420, 0.5, wave), rushF); lfo(0.09, 0.3, wave.gain); lfo(0.151, 0.25, wave.gain);
  crackG = G(0.16, duckG); src(crackle, 1, BQ('highpass', 1800, 0.7, crackG)); src(crackle, 0.83, BQ('highpass', 2400, 0.7, crackG));
  // a very soft drone (fifths on D) for depth, quieter than the original
  const pad = padG = G(0.55, duckG);
  [73.42, 110, 164.81, 246.94].forEach((f, i) => { const g = G(0.02 - i * 0.004, pad); N(OscillatorNode, { frequency: f }, g); N(OscillatorNode, { frequency: f + rr(0.03, 0.11) }, g); });
  // bubbles
  const bub = Array.from({ length: 4 }, () => { const p = N(StereoPannerNode, {}, duckG), g = G(0, p); return { p, g, o: N(OscillatorNode, { type: 'sine' }, g) }; });
  let tB = ac.currentTime + 2;
  setInterval(() => {
    const t = ac.currentTime + 0.05; if (t < tB) return;
    let tt = t; for (let n = 1 + rnd() * rnd() * 5 | 0; n--;) { const v = bub.shift(); bub.push(v); const f = rr(380, 1300); v.p.pan.setValueAtTime(rr(-0.7, 0.7), tt); v.o.frequency.setValueAtTime(f, tt); v.o.frequency.exponentialRampToValueAtTime(f * rr(1.4, 2.2), tt + 0.05 + 40 / f); v.g.gain.setValueAtTime(0, tt); v.g.gain.linearRampToValueAtTime(rr(0.02, 0.06), tt + 0.006); v.g.gain.setTargetAtTime(0, tt + 0.006, (0.05 + 40 / f) / 5); tt += rr(0.07, 0.2); }
    tB = tt + rr(0.8, 6);
  }, 150);
  out.gain.setTargetAtTime(muted ? 0 : VOL, ac.currentTime, 1.2); started = true;
}
// ambience follows the swimmer: water rush with speed, more wash near the surface, quieter crackle at night
export function update(speed, y, night) {
  if (!AC) return; const t = AC.currentTime + 0.05;
  rushG.gain.setTargetAtTime(0.45 * Math.pow(Math.min(speed / 14, 1), 1.2), t, 0.3); rushF.frequency.setTargetAtTime(220 + speed * 18, t, 0.3);
  aboveK = y > -0.05 ? 1 : 0; const u = 1 - aboveK;
  const s = Math.max(0, Math.min(1, 1 + y / 14)); washG.gain.setTargetAtTime(aboveK ? 0.5 : 0.18 + 0.4 * s * s, t, 0.25);
  nightK += ((night ? 1 : 0) - nightK) * 0.02; crackG.gain.setTargetAtTime(0.16 * (1 - 0.5 * nightK) * u, t, 0.2);
  rumG.gain.setTargetAtTime(0.3 * u + 0.02, t, 0.2); padG.gain.setTargetAtTime(0.55 * u, t, 0.6);
}
export function ping() {
  if (!AC) return; const ac = AC, t = ac.currentTime;
  const g = new GainNode(ac, { gain: 0 }); g.connect(out); const o = new OscillatorNode(ac, { type: 'sine', frequency: 880 }); o.connect(g);
  o.frequency.exponentialRampToValueAtTime(1320, t + 0.12); g.gain.linearRampToValueAtTime(0.12, t + 0.01); g.gain.setTargetAtTime(0, t + 0.05, 0.25); o.start(t); o.stop(t + 1.2);
}
export function crunch() { // parrotfish bite
  if (!AC) return; const ac = AC, t = ac.currentTime; const n = ac.sampleRate * 0.12 | 0, b = new AudioBuffer({ length: n, numberOfChannels: 1, sampleRate: ac.sampleRate }), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (rnd() * 2 - 1) * Math.exp(-i / (n * 0.25)) * (i % 700 < 40 ? 1 : 0.35);
  const s = new AudioBufferSourceNode(ac, { buffer: b }), f = new BiquadFilterNode(ac, { type: 'lowpass', frequency: 1800 }), g = new GainNode(ac, { gain: 0.5 }); s.connect(f).connect(g).connect(out); s.start(t);
}
export function whistle() { // dolphin
  if (!AC) return; const ac = AC, t = ac.currentTime;
  for (let k = 0; k < 2; k++) { const g = new GainNode(ac, { gain: 0 }); g.connect(out); const o = new OscillatorNode(ac, { type: 'sine', frequency: 4000 }); o.connect(g); const t0 = t + k * 0.5; o.frequency.setValueAtTime(3500, t0); o.frequency.exponentialRampToValueAtTime(9000, t0 + 0.25); o.frequency.exponentialRampToValueAtTime(5000, t0 + 0.45); g.gain.linearRampToValueAtTime(0.05, t0 + 0.03); g.gain.setTargetAtTime(0, t0 + 0.3, 0.08); o.start(t0); o.stop(t0 + 0.6); }
}
export function snap() { // one loud shrimp snap
  if (!AC) return; const ac = AC, t = ac.currentTime; const n = ac.sampleRate * 0.05 | 0, b = new AudioBuffer({ length: n, numberOfChannels: 1, sampleRate: ac.sampleRate }), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (rnd() * 2 - 1) * Math.exp(-i / 60);
  const s = new AudioBufferSourceNode(ac, { buffer: b }), g = new GainNode(ac, { gain: 0.7 }); s.connect(g).connect(out); s.start(t);
}
function burst(dur, f0, f1, gain, type = 'lowpass', q = 0.7, attack = 0.01) {
  if (!AC) return; const ac = AC, t = ac.currentTime, n = ac.sampleRate * dur | 0, b = new AudioBuffer({ length: n, numberOfChannels: 1, sampleRate: ac.sampleRate }), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1;
  const s = new AudioBufferSourceNode(ac, { buffer: b }), f = new BiquadFilterNode(ac, { type, frequency: f0, Q: q }), g = new GainNode(ac, { gain: 0 }); s.connect(f).connect(g).connect(out);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.setTargetAtTime(0, t + attack, dur / 4); s.start(t);
}
const blips = (count, f0, f1, vol, gap) => { if (!AC) return; const ac = AC; let t = ac.currentTime; for (let k = 0; k < count; k++) { const g = new GainNode(ac, { gain: 0 }); g.connect(out); const f = rr(f0, f1), o = new OscillatorNode(ac, { frequency: f }); o.connect(g); o.frequency.exponentialRampToValueAtTime(f * rr(1.5, 2.4), t + 0.09); g.gain.linearRampToValueAtTime(vol * rr(0.4, 1), t + 0.008); g.gain.setTargetAtTime(0, t + 0.01, 0.03); o.start(t); o.stop(t + 0.25); t += rr(gap * 0.3, gap); } };
export function splash() { burst(1.4, 4500, 220, 0.75); setTimeout(() => blips(26, 180, 900, 0.07, 0.06), 150); }
export function breathe() { burst(1.5, 700, 1100, 0.045, 'bandpass', 1.6, 0.6); setTimeout(() => { blips(16, 140, 520, 0.05, 0.07); burst(1.2, 500, 180, 0.06); }, 1900); }
export function chime() { if (!AC) return; const ac = AC, t = ac.currentTime; [1174.7, 1760, 2349.3].forEach((f, i) => { const g = new GainNode(ac, { gain: 0 }); g.connect(out); const o = new OscillatorNode(ac, { type: 'sine', frequency: f }); o.connect(g); const t0 = t + i * 0.09; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.06, t0 + 0.01); g.gain.setTargetAtTime(0, t0 + 0.02, 0.35); o.start(t0); o.stop(t0 + 2); }); }
export function setMuted(v) { muted = v; if (AC) out.gain.setTargetAtTime(muted ? 0 : VOL, AC.currentTime, 0.1); }
export function toggleMute() { muted = !muted; if (AC) out.gain.setTargetAtTime(muted ? 0 : VOL, AC.currentTime, 0.1); return muted; }
const duck = (on) => { if (AC) duckG.gain.setTargetAtTime(on ? 0.3 : 1, AC.currentTime, 0.4); };

// ---- narration
let current = null; const cache = new Map();
async function loadBuffer(url) { if (cache.has(url)) return cache.get(url); const r = await fetch(url); if (!r.ok) throw new Error('no clip'); const buf = await AC.decodeAudioData(await r.arrayBuffer()); cache.set(url, buf); return buf; }
export function stop() { if (current) { if (current.src) { try { current.src.stop(); } catch (e) { /* already stopped */ } } if (current.utter) speechSynthesis.cancel(); current = null; duck(false); } }
export async function say(key, text, variant) {
  stop(); if (!AC) return 0; const me = {}; current = me;
  try {
    const buf = await loadBuffer(`narration/${key}${variant ? '-' + variant : ''}.m4a`);
    if (current !== me) return 0;
    const src = new AudioBufferSourceNode(AC, { buffer: buf }); src.connect(out); src.start(); me.src = src; duck(true);
    src.onended = () => { if (current === me) { current = null; duck(false); } };
    return buf.duration;
  } catch (e) {
    if (current !== me) return 0;
    if ('speechSynthesis' in window && !muted) { const u = new SpeechSynthesisUtterance(text); u.rate = 0.95; u.lang = 'en-IN'; me.utter = u; speechSynthesis.cancel(); speechSynthesis.speak(u); duck(true); u.onend = () => { if (current === me) { current = null; duck(false); } }; return text.length / 14; }
    return 0;
  }
}
export const speaking = () => !!current;
document.addEventListener('visibilitychange', () => { if (AC) { if (document.hidden) AC.suspend(); else AC.resume(); } });

// sfx.js — synthesized cracker foley with per-place acoustics.
// Everything is generated (no sample rights needed). Recorded CC0 layers can be added later
// through Sfx.sample(); the synth stays as the fallback and as the "body" under recordings.
(function (root) {
  'use strict';
  let ac = null, master, verb, verbSend, noiseBuf, muted = false, space = 'lane';
  const buffers = {};

  // Seconds of tail, decay curve, wet level, and early reflections (ms) per place.
  const SPACES = {
    lane:      { tail: 2.2, curve: 3.0, wet: 0.36, early: [38, 61, 97, 140] },   // two facades + far houses
    doorstep:  { tail: 1.1, curve: 4.0, wet: 0.24, early: [12, 29] },
    courtyard: { tail: 1.5, curve: 3.4, wet: 0.30, early: [21, 44, 70] },
    roof:      { tail: 3.0, curve: 2.4, wet: 0.30, early: [90, 180] },          // open sky, distant slap-back
    park:      { tail: 2.6, curve: 2.6, wet: 0.26, early: [120] },
    stairs:    { tail: 2.8, curve: 1.8, wet: 0.55, early: [9, 17, 26, 34, 43] },  // concrete stairwell flutter
    room:      { tail: 0.6, curve: 5.0, wet: 0.16, early: [7, 15] },
  };

  const rnd = (a, b) => a + Math.random() * (b - a);

  // Host bridge: reuse the site's AudioContext and master bus so its Sound button and compressor apply.
  let hostMuted = () => false;
  function attach(context, destination, isMuted) {
    ac = context; master = ac.createGain(); master.gain.value = 1; master.connect(destination);
    verb = ac.createConvolver(); verbSend = ac.createGain(); verb.connect(verbSend).connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (isMuted) hostMuted = isMuted;
    setSpace(space);
  }
  function unlock() {
    if (!ac) {
      ac = new (root.AudioContext || root.webkitAudioContext)();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.2;
      master = ac.createGain(); master.gain.value = 0.85;
      master.connect(comp).connect(ac.destination);
      verb = ac.createConvolver();
      verbSend = ac.createGain();
      verb.connect(verbSend).connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      setSpace(space);
    }
    if (ac.state !== 'running') ac.resume();
    return ac;
  }

  function setSpace(name) {
    space = SPACES[name] ? name : 'lane';
    if (!ac) return;
    const s = SPACES[space], len = Math.ceil(ac.sampleRate * s.tail), b = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, s.curve) * 0.5;
      for (const ms of s.early) { const i = Math.floor((ms + (ch ? 3 : 0)) * ac.sampleRate / 1000); if (i < len) d[i] += rnd(0.5, 0.9) * (ch ? -1 : 1); }
    }
    verb.buffer = b;
    verbSend.gain.value = s.wet;
  }

  function out(node, { pan = 0, wet = 1 } = {}) {
    const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p); p.connect(master);
    const send = ac.createGain(); send.gain.value = wet; p.connect(send).connect(verb);
    return p;
  }
  const ready = () => ac && !muted && !hostMuted() && ac.state === 'running';
  function noise(t, dur) { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.loopStart = Math.random(); s.start(t, Math.random()); s.stop(t + dur); return s; }
  function env(g, t, peak, attack, decay) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay); }

  // Explosion. size: 0.3 bijli … 1 atom bomb … 1.6 sutli. muffle: 0 open air … 1 inside a postbox/drain.
  function boom({ vol = 0.8, size = 1, muffle = 0, pan = 0 } = {}) {
    if (!ready()) return;
    const t = ac.currentTime, decay = 0.18 + size * 0.35 + muffle * 0.35;
    const n = noise(t, decay + 0.1), lp = ac.createBiquadFilter(), g = ac.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 7500 * (1 - muffle) * (0.6 + 0.4 / size) + 280; lp.Q.value = 0.7;
    env(g, t, vol * 0.9, 0.003, decay);
    n.connect(lp).connect(g); out(g, { pan, wet: 0.9 + muffle * 0.3 });
    // chest thump
    const o = ac.createOscillator(), og = ac.createGain();
    o.frequency.setValueAtTime(130 / Math.sqrt(size), t); o.frequency.exponentialRampToValueAtTime(36, t + 0.35);
    env(og, t, vol * (0.7 + muffle * 0.5) * Math.min(1.5, size), 0.004, 0.5 + size * 0.25);
    o.connect(og); out(og, { pan, wet: 0.4 }); o.start(t); o.stop(t + 1.2);
    // the gali answers: a slap-back off the facades for outdoor bangs
    if ((space === 'lane' || space === 'roof' || space === 'park') && size > 0.25) {
      const e = noise(t + 0.13, 0.4), elp = ac.createBiquadFilter(), eg = ac.createGain();
      elp.type = 'bandpass'; elp.frequency.value = 900; elp.Q.value = 0.6;
      eg.gain.setValueAtTime(0.0001, t + 0.13); eg.gain.exponentialRampToValueAtTime(vol * 0.28 * Math.min(1.4, size), t + 0.135); eg.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      e.connect(elp).connect(eg); out(eg, { pan: -pan * 0.6, wet: 1 });
    }
    // and the debris comes down: a patter of bits landing all around
    if (size >= 0.45 && muffle < 0.8) {
      const n = Math.round(3 + size * 6);
      for (let i = 0; i < n; i++) setTimeout(() => strike(['clay', 'shell', 'tin', 'coin'][Math.floor(Math.random() * 4)], { vol: rnd(0.03, 0.09), pan: Math.max(-1, Math.min(1, pan + rnd(-0.7, 0.7))), detune: rnd(0.6, 1.6) }), rnd(350, 1500 + size * 600));
    }
    // the paper crack you hear before the body (gone when it's muffled)
    if (muffle < 0.6) {
      const c = noise(t, 0.03), hp = ac.createBiquadFilter(), cg = ac.createGain();
      hp.type = 'highpass'; hp.frequency.value = 2500;
      env(cg, t, vol * (1 - muffle) * 0.8, 0.001, 0.02);
      c.connect(hp).connect(cg); out(cg, { pan, wet: 1 });
    }
  }

  // Modal synthesis for struck objects. modes: [[freq, decaySeconds, amplitude], ...]
  const MODES = {
    tin:     [[430, 0.35, 1], [1012, 0.25, 0.6], [1740, 0.18, 0.45], [2610, 0.12, 0.3], [3480, 0.08, 0.2]],
    steel:   [[1320, 1.6, 1], [3560, 1.1, 0.5], [6720, 0.7, 0.3], [9100, 0.4, 0.15]],
    shell:   [[760, 0.05, 1], [1650, 0.035, 0.45], [2900, 0.02, 0.25]],
    clay:    [[310, 0.06, 1], [890, 0.04, 0.5], [2100, 0.02, 0.3]],
    coin:    [[2900, 0.9, 1], [6800, 0.6, 0.6], [11200, 0.3, 0.3]],
    postbox: [[180, 0.5, 1], [420, 0.35, 0.6], [905, 0.2, 0.4], [1720, 0.12, 0.2]],
  };
  function strike(material, { vol = 0.4, pan = 0, detune = 1 } = {}) {
    if (!ready()) return;
    const t = ac.currentTime, modes = MODES[material] || MODES.tin, bus = ac.createGain();
    bus.gain.value = vol; out(bus, { pan, wet: 0.7 });
    for (const [f, d, a] of modes) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f * detune * rnd(0.985, 1.015);
      env(g, t, a * 0.3, 0.001, d);
      o.connect(g).connect(bus); o.start(t); o.stop(t + d + 0.05);
    }
    const c = noise(t, 0.012), bp = ac.createBiquadFilter(), cg = ac.createGain();
    bp.type = 'bandpass'; bp.frequency.value = modes[0][0] * 4; bp.Q.value = 1.2;
    env(cg, t, 0.25, 0.0005, 0.01); c.connect(bp).connect(cg).connect(bus);
  }

  // Splintering shell / snapping clay: a few rapid woody cracks.
  function crack({ vol = 0.6, pan = 0, pieces = 3 } = {}) {
    if (!ready()) return;
    let t = ac.currentTime;
    for (let i = 0; i < pieces; i++) {
      const n = noise(t, 0.03), bp = ac.createBiquadFilter(), g = ac.createGain();
      bp.type = 'bandpass'; bp.frequency.value = rnd(900, 2600); bp.Q.value = 3;
      env(g, t, vol * rnd(0.5, 1), 0.0007, rnd(0.008, 0.025));
      n.connect(bp).connect(g); out(g, { pan, wet: 0.6 });
      t += rnd(0.008, 0.03);
    }
  }

  // Burning fuse: hiss with random crackle. Returns a handle with stop().
  function fuse({ vol = 0.06, pan = 0 } = {}) {
    if (!ready()) return { stop() {} };
    const t = ac.currentTime, n = noise(t, 30), bp = ac.createBiquadFilter(), g = ac.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 4800; bp.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.08);
    n.connect(bp).connect(g); out(g, { pan, wet: 0.3 });
    const timer = setInterval(() => { if (Math.random() < 0.6) crack({ vol: 0.05, pan, pieces: 1 }); }, 70);
    return { stop() { clearInterval(timer); const s = ac.currentTime; g.gain.cancelScheduledValues(s); g.gain.setTargetAtTime(0.0001, s, 0.03); n.stop(s + 0.2); } };
  }

  // Skidding rocket: hiss + scream, steerable. set(intensity 0..1, pitch 0..1).
  function skid({ pan = 0 } = {}) {
    if (!ready()) return { set() {}, stop() {} };
    const t = ac.currentTime, n = noise(t, 30), bp = ac.createBiquadFilter(), g = ac.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 1.4;
    const o = ac.createOscillator(), ob = ac.createBiquadFilter(), og = ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = 700; ob.type = 'bandpass'; ob.frequency.value = 1400; ob.Q.value = 4;
    g.gain.value = 0.0001; og.gain.value = 0.0001;
    n.connect(bp).connect(g); o.connect(ob).connect(og); o.start(t);
    const p = out(g, { pan, wet: 0.5 }); og.connect(p);
    return {
      set(i, pitch = 0.5, panNow = pan) {
        const s = ac.currentTime;
        g.gain.setTargetAtTime(0.0001 + i * 0.22, s, 0.03);
        og.gain.setTargetAtTime(0.0001 + i * 0.05, s, 0.03);
        o.frequency.setTargetAtTime(500 + pitch * 1300, s, 0.05);
        bp.frequency.setTargetAtTime(1800 + pitch * 2200, s, 0.05);
        p.pan.setTargetAtTime(Math.max(-1, Math.min(1, panNow)), s, 0.05);
      },
      stop() { const s = ac.currentTime; g.gain.setTargetAtTime(0.0001, s, 0.05); og.gain.setTargetAtTime(0.0001, s, 0.05); n.stop(s + 0.4); o.stop(s + 0.4); },
    };
  }

  // Glass: a sharbat bottle going over on a concrete chhat. One bright splintering crunch, then the
  // pieces ring and skitter for half a second. small: a single shard landing.
  function glass({ vol = 0.6, pan = 0, small = false } = {}) {
    if (!ready()) return;
    const t = ac.currentTime, bus = ac.createGain(); bus.gain.value = vol; out(bus, { pan, wet: 0.8 });
    if (!small) {
      const n = noise(t, 0.14), hp = ac.createBiquadFilter(), g = ac.createGain();
      hp.type = 'highpass'; hp.frequency.value = 3000; env(g, t, 0.75, 0.001, 0.1);
      n.connect(hp).connect(g).connect(bus);
      const n2 = noise(t, 0.06), bp = ac.createBiquadFilter(), g2 = ac.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.8; env(g2, t, 0.5, 0.001, 0.04);
      n2.connect(bp).connect(g2).connect(bus);
    }
    const count = small ? Math.round(rnd(2, 4)) : Math.round(rnd(11, 17));
    for (let i = 0; i < count; i++) {
      const at = t + (small ? rnd(0, 0.05) : Math.pow(rnd(0, 1), 1.6) * 0.48);
      const f = rnd(2600, 9500), o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f; env(g, at, rnd(0.07, 0.2) * (small ? 0.7 : 1), 0.0008, rnd(0.04, 0.18));
      o.connect(g).connect(bus); o.start(at); o.stop(at + 0.3);
      const o2 = ac.createOscillator(), g2 = ac.createGain();
      o2.frequency.value = f * rnd(1.4, 1.9); env(g2, at, 0.05, 0.0008, rnd(0.03, 0.08));
      o2.connect(g2).connect(bus); o2.start(at); o2.stop(at + 0.2);
    }
  }

  // Rubber stamp on paper on a wooden table: a soft thwack with a little wood under it.
  function thwack({ vol = 0.5, pan = 0 } = {}) {
    if (!ready()) return;
    const t = ac.currentTime;
    const n = noise(t, 0.1), lp = ac.createBiquadFilter(), g = ac.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 1600; env(g, t, vol, 0.002, 0.07);
    n.connect(lp).connect(g); out(g, { pan, wet: 0.5 });
    const o = ac.createOscillator(), og = ac.createGain();
    o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
    env(og, t, vol * 0.9, 0.002, 0.16); o.connect(og); out(og, { pan, wet: 0.3 }); o.start(t); o.stop(t + 0.3);
  }

  function rustle({ vol = 0.12, pan = 0 } = {}) {
    if (!ready()) return;
    const t = ac.currentTime, n = noise(t, 0.2), hp = ac.createBiquadFilter(), g = ac.createGain();
    hp.type = 'highpass'; hp.frequency.value = 3200; env(g, t, vol, 0.01, rnd(0.06, 0.14));
    n.connect(hp).connect(g); out(g, { pan, wet: 0.4 });
  }

  function whoosh({ vol = 0.18, pan = 0, dur = 0.5 } = {}) {
    if (!ready()) return;
    const t = ac.currentTime, n = noise(t, dur + 0.1), bp = ac.createBiquadFilter(), g = ac.createGain();
    bp.type = 'bandpass'; bp.Q.value = 1.1; bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(2600, t + dur * 0.6); bp.frequency.exponentialRampToValueAtTime(700, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(g); out(g, { pan, wet: 0.5 });
  }

  // Optional recorded layers (CC0) — decoded once, played on top of the synth.
  async function load(name, url) { unlock(); const r = await fetch(url); buffers[name] = await ac.decodeAudioData(await r.arrayBuffer()); }
  function sample(name, { vol = 0.6, pan = 0, rate = 1 } = {}) {
    if (!ready() || !buffers[name]) return;
    const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = buffers[name]; s.playbackRate.value = rate; g.gain.value = vol;
    s.connect(g); out(g, { pan, wet: 0.6 }); s.start();
  }

  // For other sound modules (life layer): the context, a routed output, and the shared noise buffer.
  function bus() { if (!ac) return null; return { ac, out, noise: (t, d) => noise(t, d), env, ready: ready() }; }

  root.Sfx = {
    bus, unlock, attach, setSpace, boom, strike, crack, fuse, skid, rustle, whoosh, glass, thwack, load, sample, MODES, SPACES,
    get muted() { return muted; }, set muted(v) { muted = v; if (master) master.gain.value = v ? 0 : 0.85; },
    get running() { return !!ac && ac.state === 'running'; },
  };
})(typeof window !== 'undefined' ? window : globalThis);

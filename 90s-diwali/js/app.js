// app.js — the whole mohalla from above → down into the gali → tap a point anywhere on the street
// (terrace, stairs, aangan, park, corner postbox) → it happens there, in its own place → one stamp →
// back out to the street, which keeps the mess. 🔭 zooms out to see the whole street any time.
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const M = Object.fromEntries(MOMENTS.map(m => [m.id, m]));
  let map = null, current = null, hints = [], flat = false;
  const PTS = window.POINTS.filter(p => M[p.id] && DiwaliTricks.binding(p.id))
    .map(p => ({ ...p, title: M[p.id].title, line: M[p.id].line, icon: Hub.iconFor(M[p.id]) }));
  const byId = Object.fromEntries(PTS.map(p => [p.id, p]));
  const doneCount = () => PTS.filter(p => Store.get().stamps[p.id]).length;
  function updateCount() {}
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // ---------- start: the map if it loads, the flat painted gali if it doesn't ----------
  function boot() {
    Stage.init($('#stage')); Life.init(); Bubbles.init($('#side')); Menace.init($('#meter'));
    wire(); updateCount();
    const useMap = () => {
      if (flat) return;
      try {
        map = Map3D.init($('#map'), { points: PTS, markerLayer: $('#markers'), onPick: open });
        for (const id of Store.get().mess || []) if (byId[id]) { map.addMess(byId[id]); byId[id].messed = true; }
        for (const p of PTS) map.setDone(p.id, !!Store.get().stamps[p.id]);
        map.cam.dist = 150; map.cam.tz = 0; map.cam.tx = -2;
        document.body.classList.add('has-map'); Stage.paused = true; $('#title').classList.add('ready');
      } catch (e) { console.warn(e); useFlat(); }
    };
    const useFlat = () => {
      if (flat || map) return;
      flat = true; document.body.classList.add('flat');
      Stage.goPlace('roof'); Stage.view('roof', { zoom: 1.08, focus: [0.5, 0.5], dur: 0.01 });
      Hub.init($('#markers'), m => open(byId[m.id] || { id: m.id, title: m.title, line: m.line, pos: [0, 0, 0], mess: 'scorch' }));
      $('#title').classList.add('ready');
    };
    if (window.Map3D) useMap();
    else if (window.Map3D === null) useFlat();
    else { addEventListener('map3d-ready', useMap, { once: true }); addEventListener('map3d-failed', useFlat, { once: true }); setTimeout(() => { if (!map && !flat) useFlat(); }, 14000); }
    $('#go').onclick = enter;
  }

  async function enter() {
    Sfx.unlock(); Sfx.crack({ vol: .4, pieces: 2 }); startBed();
    $('#title').classList.add('gone'); setTimeout(() => { $('#title').hidden = true; }, 1000);
    if (map) {
      map.show();
      await map.flyTo({ tx: 1.5, tz: 4, dist: 26, yaw: -0.95 }, 2.4);
    } else {
      Stage.view('roof', { zoom: 2.6, focus: [0.27, 0.72], dur: 1.2 }); await wait(1050);
      Stage.goPlace('lane'); Stage.view('lane', { zoom: 1, focus: [0.42, 0.6], dur: 1.2 }); Hub.show();
    }
    document.body.classList.add('in-hub'); updateCount();
    hints.push(setTimeout(() => Bubbles.say('Scroll ya upar-neeche swipe karo: gali mein chalo 🚶', { side: 'right', kind: 'hint', ttl: 4800 }), 600));
    hints.push(setTimeout(() => Bubbles.say('Side mein drag karo: idhar-udhar dekho. Chamakti cheez pe tap karo ✨', { side: 'left', kind: 'hint', ttl: 5200 }), 2600));
    const m = location.hash.match(/#m\/(\d+)/); if (m && byId[+m[1]]) setTimeout(() => open(byId[+m[1]]), 800);
  }
  async function startBed() {
    const b = Sfx.bus(); if (!b) return;
    try { const r = await fetch('assets/audio/distant.mp3'), buf = await b.ac.decodeAudioData(await r.arrayBuffer()); const s = b.ac.createBufferSource(), g = b.ac.createGain(); s.buffer = buf; s.loop = true; g.gain.value = .08; s.connect(g); b.out(g, { wet: .3 }); s.start(); } catch {}
  }

  // ---------- a moment, in its own place ----------
  const dipEl = () => $('#dip') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'dip' }));
  const dip = async on => { dipEl().classList.toggle('on', on); await wait(on ? 280 : 10); };
  async function open(pt) {
    if (current) return;
    current = pt;
    hints.forEach(clearTimeout); hints = [];
    history.replaceState(null, '', `#m/${pt.id}`);
    Bubbles.clear(); document.body.classList.remove('in-hub'); document.body.classList.add('going');
    if (map) { map.lock(true); Sfx.whoosh({ vol: .1, dur: .9 }); await map.focus(pt, 6); await dip(true); map.hide(); map.lock(false); Stage.paused = false; }
    else { Hub.hide(); await dip(true); }
    document.body.classList.remove('going'); document.body.classList.add('in-moment');
    start(pt);
    setTimeout(() => dip(false), 60);
  }
  // Each memory gets its own spot on its painting: road memories follow their place across the gali,
  // floor memories spread across the aangan/darwaza; always framed near the middle so you see it.
  const hh = (n, k = 1) => { const x = Math.sin(n * 12.9898 * k + 78.233) * 43758.5453; return x - Math.floor(x); };
  const SPOTS = {
    lane: { u: [.36, .64], v: [.76, .84], lift: .1, zoom: 2.3 }, doorstep: { u: [.38, .62], v: [.58, .68], lift: .05, zoom: 1.55 },
    courtyard: { u: [.38, .62], v: [.6, .72], lift: .07, zoom: 1.65 }, park: { u: [.42, .58], v: [.78, .86], lift: .08, zoom: 1.9 },
  };
  const FIXED = { 118: { place: 'doorstep', stage: [.32, .62], focus: [.36, .5], zoom: 1.5 } };     // uncle's own door, not the open road
  function framingFor(pt) {
    const b = DiwaliTricks.binding(pt.id), place = b?.view || M[pt.id].place, f = FIXED[pt.id];
    if (f) return f;
    const S = SPOTS[place]; if (!S) return null;
    const lateral = place === 'lane' ? (pt.pos[0] + 3) / 6 : hh(pt.id);
    const u = S.u[0] + (S.u[1] - S.u[0]) * Math.max(0, Math.min(1, lateral)), v = S.v[0] + (S.v[1] - S.v[0]) * hh(pt.id, 2);
    return { stage: [u, v], focus: [u, v - S.lift], zoom: S.zoom };
  }
  // the moment itself (also used by ↻ to replay without leaving)
  function start(pt) {
    const m = M[pt.id];
    Bubbles.say(m.title, { side: 'left', kind: 'title' });
    setTimeout(() => Bubbles.say(m.line, { side: 'right', kind: 'line', ttl: 4200 }), 350);
    $('#done').hidden = true; $('#light').hidden = true;
    Stage.playMemory(m, {}, framingFor(pt));
    const t = Stage.run?.trick;
    if (t?.interactive) setTimeout(() => { if (current !== pt) return; Stage.light(); Bubbles.say(t.hint || 'Ab tumhari baari! 👆', { side: 'right', kind: 'hint', ttl: 3500 }); }, 900);
    else setTimeout(() => { if (current === pt && Stage.phase === 'ready') $('#light').hidden = false; }, 700);
  }
  function lightIt() {
    $('#light').hidden = true; Stage.light(); const at = current;
    setTimeout(() => at === current && Bubbles.say(pick(['Bhaago!!', 'Peeche hato!', 'Kaan band!', 'Abhi phatega!']), { side: 'right', kind: 'say' }), 400);
  }
  const pick = a => a[Math.floor(Math.random() * a.length)];
  Stage.on('say', ({ text }) => Bubbles.say(text, { kind: 'say' }));
  Stage.on('end', ({ stat, line }) => {
    if (!current) return;
    const mess = Store.get().mess || []; if (!mess.includes(current.id)) Store.set({ mess: [...mess, current.id] });
    current.played = true;
    setTimeout(() => result(stat, line), 600);
  });
  function result(stat, line) {
    if (!current) return;
    if (stat) Bubbles.say(stat, { side: 'left', kind: 'stat', ttl: 6000 });
    if (line) setTimeout(() => Bubbles.say(line, { side: 'right', kind: 'line', ttl: 6000 }), 300);
    const did = !!Store.get().stamps[current.id];
    $('#stamp').classList.toggle('on', did); $('#stamp').textContent = did ? '✋ Haan, maine kiya tha!' : '✋ Maine bhi kiya hai!';
    $('#done').hidden = false;
  }
  function stamp() {
    const pt = current; if (!pt) return;
    const m = M[pt.id];
    if (Store.get().stamps[pt.id]) { Store.unstamp(pt.id); Menace.onUnstamp(m); $('#stamp').classList.remove('on'); $('#stamp').textContent = '✋ Maine bhi kiya hai!'; updateCount(); return; }
    Store.stamp(pt.id, 'did'); Menace.onStamp(m); lastStamped = pt;
    $('#stamp').classList.add('on'); $('#stamp').textContent = '✋ Haan, maine kiya tha!';
    const ink = document.createElement('div'); ink.className = 'thump'; ink.textContent = 'MAINE BHI KIYA!'; document.body.appendChild(ink);
    Sfx.boom({ vol: .3, size: .25, muffle: .85 }); if (navigator.vibrate) try { navigator.vibrate(40); } catch {}
    setTimeout(() => ink.remove(), 1300); updateCount();
    setTimeout(close, 1500);
  }
  function again() { const pt = current; if (!pt) return; Stage.stop(); Bubbles.clear(); start(pt); }
  async function close() {
    const pt = current; if (!pt) return; current = null;
    history.replaceState(null, '', location.pathname);
    await dip(true);
    Stage.stop(); Bubbles.clear(); $('#done').hidden = true; $('#light').hidden = true;
    document.body.classList.remove('in-moment'); document.body.classList.add('in-hub');
    setTimeout(() => dip(false), 60);
    if (map) {
      Stage.paused = true; map.show();
      if (pt.played && !pt.messed) { map.addMess(pt, true); pt.messed = true; }
      map.setDone(pt.id, !!Store.get().stamps[pt.id]); map.pop(pt.id);
      await map.returnTo(pt);
    } else { Stage.goPlace('lane'); Stage.view('lane', { zoom: 1, focus: [0.42, 0.6], dur: 0.9 }); Hub.show(); Hub.refresh(); setTimeout(() => Hub.pop(pt.id), 500); }
    updateCount();
  }

  // ---------- zoom out / share ----------
  async function zoomToggle() {
    if (!map || current) return;
    if (map.zoomedOut) { await map.street(map.cam.tz); return; }
    const n = (Store.get().mess || []).length;
    map.overview();
    setTimeout(() => Bubbles.say(n ? `Gali ka haal dekho: ${n} dhamake, poora mohalla laal! 😈` : 'Poora Sector 8. Kahan se shuru karein?', { side: 'left', kind: 'hint', ttl: 4000 }), 900);
  }
  let lastStamped = null;
  async function share() {
    const pt = current || lastStamped, base = CONFIG.url;
    const text = pt ? `Yaad hai? "${pt.title}" 😂 Maine bhi kiya tha. Tumne? Sector 8 wali Diwali 🧨` : 'Bachpan wali Diwali, Sector 8. Kaun kaun si shararat tumne ki thi? 🧨😈';
    const url = pt ? `${base}#m/${pt.id}` : base;
    try { if (navigator.share) { await navigator.share({ title: '90s Diwali', text, url }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(`${text} ${url}`); Bubbles.say('Link copy ho gaya! WhatsApp pe chipka do 📲', { side: 'right', kind: 'hint' }); } catch { Bubbles.say(url, { side: 'right', kind: 'hint', ttl: 6000 }); }
  }

  function wire() {
    $('#light').onclick = lightIt; $('#stamp').onclick = stamp; $('#again').onclick = again; $('#back').onclick = close;
    $('#zoom').onclick = zoomToggle; $('#share').onclick = share;
    $('#sound').onclick = () => { Sfx.unlock(); Sfx.muted = !Sfx.muted; $('#sound').textContent = Sfx.muted ? '🔇' : '🔊'; };
    addEventListener('keydown', e => { if (e.key === 'Escape' && current) close(); if ((e.key === ' ' || e.key === 'Enter') && !$('#light').hidden && current) { e.preventDefault(); lightIt(); } });
  }

  boot();
  window.App = { open, close, enter, zoomToggle, get map() { return map; }, PTS };
})();

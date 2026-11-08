// hub.js — the gali at night, covered in little glowing markers: every one a shararat you can do.
// Markers sit where the thing happens in the painting (rockets in the sky, house tricks by the gate,
// park tricks by the railing, ground blasts down the road). Drag to look along the street; tap to dive in.
(function () {
  'use strict';
  // the hands-on (non-explosive) memories that made the cut: all real interactions
  const RITUALS = [174, 176, 61, 182, 181, 162, 204, 187, 185, 16];
  // plate-fraction regions on the lane painting: [u0, u1, v0, v1]
  const REGION = { road: [.16, .86, .54, .97], house: [.01, .46, .1, .66], park: [.72, .99, .36, .78], sky: [.26, .82, .03, .32] };
  const HOUSE = new Set(['doorstep', 'courtyard', 'room', 'stairs', 'landing', 'bazaar', 'south-street', 'kerala-yard', 'bengal-para', 'goa-street']);
  const ICONS = [
    [/tumbler/i, '🥛'], [/tin\b|dalda/i, '🥫'], [/coconut/i, '🥥'], [/postbox|letterbox/i, '📮'], [/matka|mud pot/i, '🏺'], [/bucket/i, '🪣'], [/cup/i, '🥤'], [/coin/i, '🪙'],
    [/tennis|ball\b/i, '🎾'], [/brick/i, '🧱'], [/leaves/i, '🍂'], [/thermocol/i, '❄️'], [/cardboard|cracker box/i, '📦'], [/naali|drain/i, '🌊'], [/gobar|dung/i, '🐄'],
    [/sand|landmine/i, '⏳'], [/stone|hole/i, '🪨'], [/well/i, '🕳️'], [/pond|tank|water/i, '💧'], [/drum/i, '🛢️'], [/stair/i, '🪜'], [/manhole/i, '⚙️'], [/bundle/i, '💣'],
    [/sutli/i, '🧨'], [/uncle|gate/i, '🚪'], [/ding|doorbell/i, '🔔'], [/decibel|alarm/i, '🚨'], [/red cracker paper|paper pile/i, '📜'],
    [/parachute/i, '🪂'], [/rocket car|toy car/i, '🚗'], [/pipe|bazooka/i, '🎯'], [/dogfight/i, '✈️'], [/train|wire|string/i, '🧵'], [/rocket|hawai/i, '🚀'],
    [/ladi|saram|garland|ola/i, '🧨'], [/chakri|chakra|spinner/i, '🌀'], [/anaar|flower ?pot/i, '⛲'], [/snake|saanp/i, '🐍'],
    [/name|circles|sword|heart|mega|bucket|pencil|hanuman|sparkler|phuljhadi/i, '🎇'], [/match/i, '🔥'],
    [/chor|revolver|cap-gun|cap gun|pistol|duel|dialogue/i, '🔫'], [/cap|tikli|popping strip|chatpati|bolt/i, '💥'],
    [/killa|fort|village|soldier/i, '🏰'], [/narakasur/i, '👹'], [/dud|fuski|sleeper/i, '🔍'], [/4:30|first cracker/i, '⏰'], [/deepavali/i, '🌅'],
    [/agarbatti|broom|candle|diya|gas|newspaper|touch-and-run|eyes|finger|long sparkler/i, '🪔'],
    [/toss|thup|potka|phoonk|flick|bowling|balcony|chocolate|gust|throw/i, '💣'],
    [/dhoop|dry/i, '☀️'], [/divid|bantwara/i, '⚖️'], [/wholesale|bazaar/i, '🛍️'], [/gift/i, '🎁'], [/count/i, '🔢'], [/stick/i, '🥢'], [/unthread|apart/i, '🧵'], [/help's|domestic/i, '💝'], [/barter/i, '🤝'], [/mountain/i, '📜'],
  ];
  const iconFor = m => (ICONS.find(([re]) => re.test(m.title)) || [0, '💥'])[1];

  let layer, markers = [], visible = false, onPick = null;
  const rng = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(97);

  function regionOf(m) {
    const b = DiwaliTricks.binding(m.id), where = b?.view || m.place || 'lane';
    if (where === 'roof' || where === 'terrace') return 'sky';
    if (where === 'park') return 'park';
    if (HOUSE.has(where) || m.tier === 'RITUAL') return 'house';
    return 'road';
  }
  function place(list) {
    // blue-noise placement inside each region (plate pixels ~1600×1067), larger spacing up close
    const taken = [];
    for (const mk of list) {
      const r = REGION[mk.region]; let best = null, bestD = -1;
      for (let k = 0; k < 40; k++) {
        const u = r[0] + rng() * (r[1] - r[0]), v = r[2] + rng() * (r[3] - r[2]);
        let d = Infinity; for (const t of taken) d = Math.min(d, Math.hypot((t.u - u) * 1.5, t.v - v));
        if (d > bestD) { bestD = d; best = { u, v }; }
      }
      mk.u = best.u; mk.v = best.v; taken.push(best);
    }
  }
  function build() {
    const allowed = new Set((window.POINTS || []).map(p => p.id));
    const list = MOMENTS.filter(m => allowed.has(m.id) && DiwaliTricks.binding(m.id))
      .map(m => ({ m, region: regionOf(m), icon: iconFor(m) }));
    place(list);
    layer.innerHTML = '';
    for (const mk of list) {
      const b = document.createElement('button');
      b.className = 'mk'; b.dataset.id = mk.m.id; b.setAttribute('aria-label', mk.m.title);
      b.innerHTML = `<span class="em">${mk.icon}</span><span class="tag"></span><i class="tick">✋</i>`;
      b.querySelector('.tag').textContent = mk.m.title;
      b.style.animationDelay = `${(mk.m.id % 17) * -0.23}s`;
      mk.el = b; layer.appendChild(b);
    }
    markers = list; refresh();
  }
  function refresh() { const st = Store.get().stamps; for (const mk of markers) mk.el.classList.toggle('done', !!st[mk.m.id]); }
  function frame() {
    if (!visible) return;
    const W = innerWidth, H = innerHeight;
    for (const mk of markers) {
      const p = Stage.toScreen(mk.u, mk.v), s = 0.62 + mk.v * 0.62;
      const on = p.x > -40 && p.x < W + 40 && p.y > 40 && p.y < H + 40;
      mk.el.style.transform = `translate(${p.x | 0}px, ${p.y | 0}px) translate(-50%, -50%) scale(${s.toFixed(2)})`;
      mk.el.style.visibility = on ? 'visible' : 'hidden';
    }
  }

  // drag to look along the street; a tap on a marker opens it
  function wirePan() {
    let down = null, moved = false;
    layer.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY }; moved = false; });
    addEventListener('pointermove', e => {
      if (!down || !visible) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) moved = true;
      if (moved) { Stage.panBy(e.clientX - down.lx, (e.clientY - down.ly) * 0.5); down.lx = e.clientX; down.ly = e.clientY; layer.classList.add('panning'); }
    });
    addEventListener('pointerup', () => { setTimeout(() => layer.classList.remove('panning'), 0); down = null; });
    layer.addEventListener('click', e => {
      const b = e.target.closest('.mk'); if (!b || moved) return;
      const mk = markers.find(x => x.m.id === +b.dataset.id); if (mk) onPick?.(mk.m, b);
    });
    // wheel / trackpad scroll pans too
    layer.addEventListener('wheel', e => { if (!visible) return; e.preventDefault(); Stage.panBy(-e.deltaX - e.deltaY * 0.6, 0); }, { passive: false });
  }

  window.Hub = {
    iconFor,
    init(el, pick) { layer = el; onPick = pick; build(); wirePan(); Stage.on('frame', frame); },
    show() { visible = true; refresh(); layer.classList.add('on'); },
    hide() { visible = false; layer.classList.remove('on'); },
    refresh,
    pop(id) { const mk = markers.find(x => x.m.id === id); if (!mk) return; mk.el.classList.remove('pop'); void mk.el.offsetWidth; mk.el.classList.add('pop'); },
    get count() { return markers.length; },
    ids: () => markers.map(x => x.m.id),
    RITUALS,
  };
})();

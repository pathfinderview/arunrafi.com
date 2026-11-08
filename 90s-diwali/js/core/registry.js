// registry.js — tricks (things you light) and their bindings to compendium memories.
//
// A trick implements:
//   id, name, mode ('ground' | 'hand' | 'sky'), views: [place...], fuse: seconds,
//   options: [{key, label, choices:[[value,label]], default}],
//   create(api, opts) → state          build; nothing moving yet
//   wick(state, api) → [x,y,z]         where the fuse burns (ground/sky tricks)
//   ignite(state, api)                 the moment it goes off
//   update(state, api, dt, e) → bool   e = seconds since ignite; true when finished
//   draw(state, api)                   meshes, sprites, glows (host draws particles)
//   stat(state) → string               optional readout ("Peak 3.3 m")
//   spentLine: string                  shown when it ends
//   interactive: true                  optional: the trick reads api.pointer itself and calls
//                                      api.ignite() when the player does the gesture
//
// A memory binding maps a compendium memory to a trick + options + place:
//   DiwaliTricks.bind(21, 'blast', { thing: 'tin', bomb: 'atom' }, 'lane')
//
// The api a trick receives is documented in js/engine/stage.js (makeApi).
(function (root) {
  'use strict';
  const tricks = {}, bindings = {};
  root.DiwaliTricks = {
    register(t) {
      for (const k of ['id', 'name', 'create', 'update', 'draw']) if (!t[k]) throw new Error(`trick ${t.id} missing ${k}`);
      tricks[t.id] = { mode: 'ground', views: ['lane'], fuse: 1.2, options: [], ignite() {}, wick: () => [0, 0.05, 0], ...t };
      return tricks[t.id];
    },
    bind(memoryId, trickId, opts = {}, view = null) {
      for (const id of [].concat(memoryId)) bindings[id] = { trick: trickId, opts, view };
    },
    get(id) { return tricks[id]; },
    has(id) { return !!tricks[id]; },
    all() { return Object.values(tricks); },
    binding(memoryId) { const b = bindings[memoryId]; return b && tricks[b.trick] ? b : null; },
    bindings() { return { ...bindings }; },
    defaults(t) { return Object.fromEntries((t.options || []).map(o => [o.key, o.default])); },
  };
})(typeof window !== 'undefined' ? window : globalThis);

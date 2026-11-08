// store.js — what a visitor did, kept on their own device (localStorage).
// Shared counts plug in later via CONFIG.api: then stamps are also sent there and totals shown.
(function () {
  'use strict';
  const KEY = 'patakha97-v1';
  let state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { state = {}; }
  state.stamps ??= {}; state.played ??= {}; state.photos ??= []; state.submissions ??= [];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

  const api = () => window.CONFIG?.api || null;
  async function send(path, body) {
    if (!api()) return null;
    try { const r = await fetch(api() + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return r.ok ? r.json() : null; } catch { return null; }
  }
  async function totals(id) {
    if (!api()) return null;
    try { const r = await fetch(`${api()}/m/${id}`); return r.ok ? r.json() : null; } catch { return null; }
  }

  window.Store = {
    get: () => state,
    set(patch) { Object.assign(state, patch); save(); },
    stamp(id, choice) { const prev = state.stamps[id]; state.stamps[id] = choice; save(); return send('/stamp', { id, choice, prev: prev || null, region: state.region || null }); },
    unstamp(id) { delete state.stamps[id]; save(); },
    played(id) { state.played[id] = 1; save(); },
    count(choice) { return Object.values(state.stamps).filter(c => !choice || c === choice).length; },
    totals,
    addPhoto(dataUrl) {
      // shrink before keeping: phones have small storage quotas
      const img = new Image(); img.onload = () => { const c = document.createElement('canvas'), s = 420 / Math.max(img.width, img.height); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); state.photos.push(c.toDataURL('image/jpeg', 0.6)); if (state.photos.length > 12) state.photos.shift(); save(); }; img.src = dataUrl;
    },
    // the album print becomes your own photo of the bang (small JPEG, kept on the phone)
    thumb(id, dataUrl) {
      if (!dataUrl) return;
      const img = new Image(); img.onload = () => { const c = document.createElement('canvas'), s = 260 / img.width; c.width = 260; c.height = Math.round(img.height * s); const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height); (state.thumbs ??= {})[id] = c.toDataURL('image/jpeg', 0.62); save(); }; img.src = dataUrl;
    },
    submit(text) { const s = { text: text.slice(0, 280), at: Date.now(), region: state.region || null }; state.submissions.push(s); save(); return send('/submit', s); },
    reset() { state = { stamps: {}, played: {}, photos: [], submissions: [] }; save(); },
  };
})();

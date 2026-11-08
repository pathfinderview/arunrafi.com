// bubbles.js — words slide in from the sides of the screen, around you. No voices.
(function () {
  'use strict';
  let box, flip = false;
  function say(text, { side, kind = 'say', ttl } = {}) {
    if (!box || !text) return null;
    side = side || (flip = !flip, flip ? 'left' : 'right');
    const el = document.createElement('div');
    el.className = `sb ${side} ${kind}`;
    el.textContent = text;
    box.appendChild(el);
    // keep it light: at most 4 on screen, and the memory's title stays pinned
    const extra = [...box.children].filter(c => !c.classList.contains('title'));
    while (extra.length > 3) extra.shift().remove();
    requestAnimationFrame(() => el.classList.add('on'));
    const life = ttl ?? (kind === 'title' ? 0 : 2600 + text.length * 40);
    if (life) setTimeout(() => dismiss(el), life);
    return el;
  }
  function dismiss(el) { if (!el?.isConnected) return; el.classList.remove('on'); setTimeout(() => el.remove(), 450); }
  window.Bubbles = {
    init(el) { box = el; },
    say,
    dismiss,
    clear() { if (box) for (const el of [...box.children]) dismiss(el); },
  };
})();

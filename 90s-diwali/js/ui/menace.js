// menace.js — cute, naughty kids terrorising Sector 8. Every naughty thing you stamp raises the
// Shararat-o-meter; neighbours complain; at the top a chappal flies. All as side bubbles, no voices.
(function () {
  'use strict';
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const SPICE = { H: 18, B: 12, C: 12, A: 10, I: 9, D: 6, G: 5, J: 4, E: 4, K: 3, M: 3, F: 2, L: 2, N: 2, O: 0 };
  const LEVELS = [[0, '😇', 'Masoom'], [25, '😏', 'Natkhat'], [50, '😈', 'Shaitaan'], [80, '🔥', 'Mohalla ka Menace']];
  const SHIKAYAT = {
    3: ['Unfriendly uncle', 'Har saal rocket meri hi taraf kyun?!'], 4: ['Gupta ji', 'Rocket seedha mere balcony mein!'], 11: ['Plot wale uncle', 'Khaali plot mein aag lag jaati!'],
    14: ['Pappu', 'Meri toy car jala di!'], 20: ['Postman uncle', 'Letterbox se phir dhuan!'], 117: ['Postman uncle', 'Letterbox se phir dhuan!'],
    21: ['Mummy', 'Ghee ka dabba kahan gaya?!'], 22: ['Mummy', 'MERA STEEL KA TUMBLER!!'], 23: ['Mummy', 'Balti tedhi kisne ki?'], 24: ['Dadi', 'Mera paani ka matka!'],
    27: ['Bunty', 'Meri tennis ball!!'], 31: ['Papa', 'TV ka thermocol kahan hai?'], 33: ['Safai wale bhaiya', 'Naali mein bomb mat daalo!'], 34: ['Gwala bhaiya', 'Gobar mein bomb?! Sachchi?!'],
    40: ['Secretary sahab', 'Seedhiyon mein dhamaka allowed nahi!'], 41: ['Nagar Nigam', 'Manhole ka dhakkan kisne udaya?'], 44: ['Sharma aunty', 'Baby abhi abhi soya tha!'],
    52: ['Bunty ki mummy', 'Bijli se bowling kaun karta hai?!'], 101: ['Mummy', 'Meri rangoli! Subah 4 baje se bana rahi thi!'],
    118: ['Verma uncle', 'Gate ke saamne bomb kisne phoda?!'], 122: ['Malhotra aunty', 'Ghanti bajake bhaag gaye! Teesri baar!'],
    140: ['Kapoor sahab', 'Meri Maruti ka alarm!'], 150: ['Mummy', 'GAS BAND KARO!'], 143: ['Pinky', 'Meri matchbox village!'], 8: ['Gupta ji', 'Pipe se rocket? Ye kya army hai?'],
  };
  const GENERIC = [['Padosi', 'Itna shor kyun?!'], ['Gupta aunty', 'Inke bachche bade shaitaan hain.'], ['Chowkidar', 'Bachcho, dhyaan se!']];
  const MUM = { 25: 'Mummy: Dhyaan se, Bunty!', 50: 'Mummy: Kitni baar bola hai!', 80: 'Aunty: Inke bachche poore mohalle ke liye khatra hain!' };

  let el;
  const st = () => Store.get();
  function level(v) { let L = LEVELS[0]; for (const l of LEVELS) if (v >= l[0]) L = l; return L; }
  function render() {
    if (!el) return;
    const v = Math.max(0, Math.min(100, st().shararat || 0)), [, face, name] = level(v);
    el.querySelector('i').style.width = v + '%'; el.querySelector('b').textContent = face; el.querySelector('span').textContent = name;
    el.classList.toggle('hot', v >= 80);
  }
  function bump(points) {
    const before = st().shararat || 0, v = Math.max(0, Math.min(100, before + points));
    Store.set({ shararat: v }); render();
    for (const t of [25, 50, 80]) if (before < t && v >= t) setTimeout(() => Bubbles.say(MUM[t], { side: 'left', kind: 'mum' }), 900);
    if (v >= 100) setTimeout(chappal, 1100);
    el?.classList.add('bump'); setTimeout(() => el?.classList.remove('bump'), 500);
  }
  function chappal() {
    Bubbles.say('CHHOTUUUU!! 🩴', { side: 'left', kind: 'mum' });
    const c = document.createElement('div'); c.className = 'chappal'; c.textContent = '🩴'; document.body.appendChild(c);
    setTimeout(() => Sfx.whoosh({ vol: .2, dur: .6 }), 150);
    setTimeout(() => { Sfx.strike('shell', { vol: .4, detune: .6 }); Bubbles.say('Aaauch! Sorry Mummy!', { side: 'right' }); }, 900);
    setTimeout(() => c.remove(), 1800);
    Store.set({ shararat: 60, chappals: (st().chappals || 0) + 1 }); setTimeout(render, 1000);
  }
  window.Menace = {
    init(node) { el = node; render(); },
    onStamp(m) {
      bump(SPICE[m.section] || 0);
      let s = SHIKAYAT[m.id]; if (!s && ['B', 'H', 'C'].includes(m.section) && Math.random() < .4) s = pick(GENERIC);
      if (s) setTimeout(() => Bubbles.say(`📋 ${s[0]}: "${s[1]}"`, { side: 'left', kind: 'shikayat' }), 700);
    },
    onUnstamp(m) { bump(-(SPICE[m.section] || 0)); },
  };
})();

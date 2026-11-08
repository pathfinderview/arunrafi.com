// points.js — the 76 shararatein that made the cut, spread along the whole gali so you travel it.
// Map coordinates are metres: the gali runs along z (north = −z); x > 0 is our row, x < 0 the park side.
// Our house is the brown one at z = 0 (east row); the park is opposite (west, z −15..25).
// Each house's aangan, doorstep and terrace hosts its own shararat. mess = what stays on the map.
(function () {
  'use strict';
  // house slots: aangan centre, door, and roof (y is fixed up by the map from the house height)
  const aangan = (side, hz, dz = 0) => [side * (6.2 + (dz > 0 ? .5 : -.3)), 0, hz + dz];
  const door = (side, hz) => [side * 7.7, 0.02, hz + 2.6];
  const roof = (side, hz, dz = 0) => [side * 10.5, 0, hz + dz];
  const P = (id, pos, mess = 'scorch', extra = {}) => ({ id, pos, mess, ...extra });
  const R = (id, side, hz, dz) => P(id, roof(side, hz, dz), 'stick', { roof: { side, z: hz } });
  window.POINTS = [
    // ---- terraces: rockets from our chhat and the neighbours' ----
    R(1, 1, 0, -2.5), R(3, 1, 0, 1), R(4, 1, 0, 3.6),           // ours (3 aims at Gupta ji's balcony across)
    R(6, 1, -20, 0), R(8, 1, 20, 0), R(13, -1, -40, 0), R(15, 1, 40, 0),
    // ---- our house (brown, z 0): the classics at home ----
    P(19, aangan(1, 0, -2.6), 'coconut'), P(76, aangan(1, 0, 2.2), 'anaar'), P(22, door(1, 0), 'tumbler'),
    P(101, [7.4, .02, -1.2], 'ash'), P(150, [8.3, 1.4, 3.6], 'none'), P(53, [7.6, 3.7, -1.6], 'scorch'),
    P(40, [13.6, 2.4, -4.2], 'none'), P(72, [13.6, 3.6, -3.2], 'none'), P(18, [6.0, 1.6, 4.3], 'stick'),
    // ---- the neighbours' aangans along our row ----
    P(71, aangan(1, 10, 0), 'disc'),          // Malhotra aunty's steel thali
    P(142, aangan(1, 20, 0), 'killa'),        // the Sharmas' mud fort
    P(144, aangan(1, 30, 0), 'soldiers'),
    P(31, aangan(1, -20, 0), 'snow'),         // Kapoor sahab's TV-box thermocol
    P(39, aangan(1, -30, 0), 'drum'),
    P(74, aangan(1, -40, 0), 'box'),
    P(119, aangan(1, -50, 0), 'scorch'),
    P(67, aangan(1, 50, 0), 'disc'),
    P(70, aangan(1, 60, 0), 'disc'),
    // ---- and across, on the park side ----
    P(27, aangan(-1, -20, 0), 'ball'),        // Gupta ji's aangan
    P(79, aangan(-1, -30, 0), 'anaar'),
    P(100, door(-1, -40), 'ash'),
    P(113, door(-1, -50), 'caps'),
    // ---- doorsteps along the gali ----
    P(83, door(1, 10), 'wire'), P(85, door(1, 20), 'wire'), P(88, door(1, -10), 'wire'), P(96, door(1, -30), 'matches'),
    P(147, door(1, 30), 'scorch'), P(154, door(1, 40), 'scorch'),
    // ---- the gali itself, north to south ----
    P(20, [4.4, 0, -64], 'postbox'),          // red postbox at the corner
    P(140, [2.6, 0, -21], 'scorch'),          // Kapoor sahab's Maruti
    P(118, [3.9, 0, -10.5], 'scorch'),        // Verma uncle's gate
    P(122, [3.9, 0, 10.5], 'scorch'),         // Malhotra aunty's doorbell
    P(41, [0, 0, 12], 'lid'), P(33, [3.3, 0, -30], 'wet'), P(21, [-1.4, 0, 6], 'tin'), P(23, [1.6, 0, -6], 'bucket'), P(24, [-1.8, 0, -3], 'shards'),
    P(26, [.8, 0, 16], 'scorch'), P(30, [-.6, 0, 19], 'paper'), P(32, [1.4, 0, 23], 'box'), P(43, [-1.2, 0, -24], 'paper'), P(44, [.4, 0, -36], 'paper'),
    P(2, [-2.2, 0, -44], 'scorch-long'), P(12, [2.0, 0, -50], 'scorch-long'), P(14, [-.8, 0, 28], 'car'),
    P(45, [1.8, 0, -27], 'paper'), P(46, [-1.6, 0, -32], 'scorch'), P(47, [3.3, 0, -40], 'wall'), P(52, [.2, 0, 36], 'scorch'),
    P(59, [.6, 0, 46], 'ladi'), P(62, [-1.8, 0, 52], 'ladi'), P(63, [2.4, 0, -56], 'drum'), P(77, [-2.6, 0, 40], 'anaar'),
    P(106, [1.2, 0, -17], 'caps'), P(109, [-.4, 0, 60], 'caps'), P(111, [2.4, 0, 32], 'scorch'), P(114, [-2.4, 0, -60], 'caps'),
    P(123, [1.0, 0, 3], 'scorch'), P(159, [-1.0, 0, -12], 'none'), P(194, [.8, 0, -1], 'scorch'), P(223, [-1.6, 0, 64], 'narakasur'),
    P(48, [-2.6, 0, 25], 'scorch'),
    // ---- the construction plot (park side, z 30): sand and bricks ----
    P(35, [-9, .6, 34], 'crater'), P(28, [-7.4, 0, 31], 'brick'),
    // ---- the park, opposite our house ----
    P(29, [-12, 0, -6], 'leaves'), P(38, [-15, 0, 6], 'wet'), P(49, [-13, 0, 9.4], 'wet'), P(64, [-11.2, 0, 1.6], 'ladi'),
    P(34, [-6.4, 0, -13], 'splat'),           // where the cow sits, park corner
  ];
})();

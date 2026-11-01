# A second, taken apart

A 3D watch lesson for children and grown-ups to explore together. Live at https://arunrafi.com/mechanical-watch.html and listed under Tools.

## Learning experience

Six steps, in plain English: power spring, turning wheels, stop-and-go part, swinging wheel, watch face, and the whole story. Each step has an action, a question to discuss, an optional answer, and Back/Next controls. The lesson never advances on its own. The numbers and technical notes are optional. On small screens, “See this part” goes to the model; “Back to lesson” returns to the current step.

The picture-speed slider changes playback only. It does not teach that winding a watch makes it run faster. Separated parts keep moving to help explain the mechanism; a visible note explains that real parts must fit together to work.

## Rebuild

Requires Node.js 20+. The open-source Teardown toolkit is kept outside this repository. From the repository root:

```sh
git clone https://github.com/elvarofficial/teardown.git ../experiments/teardown
npm ci --prefix ../experiments/teardown --ignore-scripts
node interactive/watch/build.mjs
cp teardown-out/dist/mechanical-watch.html mechanical-watch.html
python3 scripts/enrich_site.py
```

If Teardown is already elsewhere, set `TEARDOWN_DIR` to its path when running build.mjs. Rebuilds go to the ignored teardown-out folder. The final page embeds its scripts, styles, fonts, geometry and third-party licence notices, and works offline. Only the explicit web links need a connection.

## Model and limits

One model-time coordinate drives poses and readouts. The chosen balance frequency is 4 Hz: 8 half-swings per second, 28,800 beats per hour. A 15-tooth escape wheel advances half a tooth per beat, giving 16 rpm. Ratios of 16:1 and 60:1 give a fourth-wheel turn per minute and a centre-wheel turn per hour. The barrel-to-centre ratio is 8:1. Tooth counts, dimensions, 270° balance amplitude, and 40-hour maximum reserve describe this teaching model, not a commercial movement.

This is an educational kinematic model. Tooth profiles, pallet contact, spring deformation and release timing are simplified. It does not solve forces, friction, lubrication, accuracy or real power-reserve behaviour. Source mechanism reference: https://www.grand-seiko.com/us-en/collections/movement/mechanical. Toolkit: https://github.com/elvarofficial/teardown (MIT). Three.js and font licences are embedded in the distributed HTML.

Run `node --test interactive/watch/model.test.mjs` to check frequency, train periods, pitch distances and reserve exhaustion. Browser verification covers all six lesson actions, answers, Back/Next, restart, and mobile navigation. Updated 2 November 2026.

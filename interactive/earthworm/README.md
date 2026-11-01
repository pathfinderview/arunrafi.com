# A life beneath our feet

Source for `/earthworm.html`. Shares the diagram-and-reading format documented in `../README.md`.

Build from the site root:

    node interactive/earthworm/build.mjs
    cp teardown-out/dist/earthworm.html earthworm.html
    python3 scripts/enrich_site.py

Uses the existing Teardown checkout in the outer workspace; `TEARDOWN_DIR` can override it. Three.js is bundled: no network requests are needed for the study itself.

The model is illustrative, not species-specific. `model.js` keeps approximate segment volume constant as a travelling wave changes segment length. No soil-contact physics or real digestion/diffusion rates are claimed. Teaching references are linked inside the page. The organ view shows the digestive route, not a complete anatomical dissection. Reduced-motion preferences start the model paused.

Review all three views, seven lessons, pause/speed/reset, hidden lesson, and a phone width after edits. Keep text and controls outside the canvas.

## Discovery experiments

`discoveries.js` adds four hands-on explanations below the whole-animal study. `discovery-model.js` owns dimensionless chamber volume and the ideal two-anchor step. The latter makes the grip comparison explicit; it is not a friction solver. Breathing and food diagrams are explanatory routes. Labels, controls and prose stay outside the art. Oxygen animation respects reduced motion and pauses offscreen.

Run the mathematical checks with:

    node --test interactive/earthworm/discovery-model.test.mjs

Check both muscle types at slider endpoints, all five food stops, moist/dry skin, step playback and scrubbing, and 390px phone layout.

# A life beneath our feet

Source for `/earthworm.html`. Shares the diagram-and-reading format documented in `../README.md`.

Build from the site root:

    node interactive/earthworm/build.mjs
    cp teardown-out/dist/earthworm.html earthworm.html
    python3 scripts/enrich_site.py

Uses the existing Teardown checkout in the outer workspace; `TEARDOWN_DIR` can override it. Three.js is bundled: no network requests are needed for the study itself.

The model is illustrative, not species-specific. `model.js` keeps approximate segment volume constant as a travelling wave changes segment length. No soil-contact physics or real digestion/diffusion rates are claimed. Teaching references are linked inside the page. The organ view shows the digestive route, not a complete anatomical dissection. Reduced-motion preferences start the model paused.

Review all three views, six lessons, pause/speed/reset, hidden lesson, and a phone width after edits. Keep text and controls outside the canvas.

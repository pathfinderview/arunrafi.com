# Format for interactive studies

Use the writing site's quiet layout: a short heading, generous space, restrained type and clear rules between sections.

- The diagram gets its own uninterrupted surface. No prose, captions, buttons or questions over the canvas.
- On desktop, all explanations sit in one reading panel beside the diagram. The panel scrolls independently, so expanded answers and long notes cannot squeeze or cover the model.
- On phones, the complete diagram and its controls come first; the reading follows at a comfortable width.
- Camera options sit above the figure. Usage hints and playback controls sit below it. Less common controls go under More controls, in the normal page flow.
- Hide lesson gives a diagram-only view. Show lesson and Learn together restore the current lesson, not a new one.
- Use one idea per lesson, one thing to try, one question and an optional answer. Keep the numbers, references and extra part controls in disclosures.
- Resizing either area must resize and reframe the model. Test long answers, open disclosures, desktop, phone and diagram-only mode.

The mechanical watch in `watch/` is the first implementation of this format.

The solar eclipse in `eclipse/` adds linked space and ground perspectives. Its Explore and Story tabs share a side panel, keeping controls beside the scene on desktop. Night colours suit the astronomical subject. Always state which views compress distances, and keep physical calculations separate from display scaling.

`sun-moon-earth.html` (Light, spin and shadow) follows the hand-written format of the current watch page. It is one self-contained file with 2D SVG figures, edited directly; there is no build step. It covers light, day and night, size and distance, orbits, seasons, Moon phases, both kinds of eclipse and eclipse seasons. It supersedes the 3D eclipse page in Tools, but `solar-eclipse.html` stays live and is linked from chapter 7.

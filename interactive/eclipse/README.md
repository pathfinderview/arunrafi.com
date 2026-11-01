# The day the Sun disappears

Canonical source for `/solar-eclipse.html`.

A linked 3D eclipse model and calculated observer view. Main controls alter lunar alignment, lunar distance, observer position and orbital inclination. Presets demonstrate total, annular, partial and missed eclipses. Explore and story share a side panel; the diagram remains unobstructed.

## Build

From the site root:

    node interactive/eclipse/build.mjs
    cp teardown-out/dist/solar-eclipse.html solar-eclipse.html
    python3 scripts/enrich_site.py

Uses the existing outer `experiments/teardown` toolkit. Set `TEARDOWN_DIR` to override it. Three.js and fonts are bundled. Planet maps are separate local assets at `/assets/eclipse/earth.jpg` and `/assets/eclipse/moon.jpg`, downloaded from the Three.js example texture collection. The page itself makes no third-party requests.

## Geometry

`model.js` uses kilometres. Orbital positions are calculated by rotating a circular orbit plane. Observer parallax uses a point on a spherical Earth. Apparent radii are `asin(radius / observer distance)`; angular separation and circular-disc intersection determine coverage and eclipse type.

The close 3D view includes a deliberately reduced, procedurally shaded Sun and shortens the gaps. Earth and Moon preserve their relative radii and transverse shadow displacement. The illustrative cone is stretched accordingly. The globe shader computes local occultation using physical positions for each surface point. True distance uses one physical scale for sizes and orbit. Earth-sized rings help convey the empty space. The Sun is offscreen only in True distance; the close view shows all three bodies.

The ground view uses the same model as the numerical readouts and Earth shader. The corona and sky brightness are illustrative. This is not an ephemeris, real location map, or eclipse predictor. The orbit is circular at the user-selected distance; atmosphere, terrain, solar limb darkening and Earth obliquity are omitted. Animation duration is illustrative, and nothing autoplays.

## Verify

    node --test interactive/eclipse/model.test.mjs

Check all presets and views, flattening the missed orbit, both slider ends, observer parallax, play/pause, Explore/Story, five story chapters, hide/show panel, rotation, and phone layout. Inspect the actual rendered globe and sky, not only the DOM. Read the sources and model limits linked on the page.

# Flag Garden

A quiet flag-learning game for young children. Published under Tools at `/flag-garden/`.

## Experience

One flag at a time. Reveal speaks the country name and steps through two or three visual details. Previous and Next always work. The child can tap each clue to highlight and hear it again. There are no timers, scores, or penalties.

Today's adventure introduces at most two countries and includes up to six due reviews. Two new countries a day introduces all 195 in 98 days, leaving about twelve weeks for review. Missed days do not create a backlog of new flags. Explore gives access to every country without changing the daily selection.

When no new countries remain, the daily visit holds up to eight reviews. The child can also tap the flag itself to cycle through its details without scrolling on a phone.

After revealing, an adult can record whether the child knew the answer **before** reveal. Successful recall schedules reviews after 1, 3, 7, 14 and 30 days. Only a successful recall after all five intervals marks a flag remembered. Another rating on the same day cannot advance it. Still learning brings it back tomorrow. Simply viewing a flag never counts as recall.

Progress is browser-local; parent controls export/import a JSON backup. No sign-in, analytics, microphone, or personal data collection. The public page does not contain a child's name.

## Files

- `index.html`, `style.css`, `app.js`: no build step or runtime dependencies.
- `data.json`: 195 countries, flag proportions and individually authored visual clues.
- `assets/flags/`: locally hosted SVGs from FlagCDN/Flagpedia.
- `assets/audio/`: locally generated spoken names and clue narration.
- `tests.mjs`: data and spaced-review checks.

Serve the repository root with `python3 -m http.server 8765` and open `/flag-garden/`.

## Coverage and sources

193 UN members plus Palestine and Vatican City. Country metadata: https://github.com/mledoze/countries (ODbL; names/codes adapted, https://opendatacommons.org/licenses/odbl/1-0/). Flag artwork: https://flagpedia.net/download/api and https://flagcdn.com (flag images offered for free use). Retrieved 15 November 2026. SVGs retain their native proportions, including Nepal, Switzerland and Vatican City. Afghanistan is shown with the tricolour variant supplied by Flagpedia; other variants are in use. Paraguay's front face is shown.

The six-month schedule is a practice plan, not a guaranteed learning outcome. New flags are deliberately spread across shapes and continents; similar flags can be revisited in Explore. Parent controls explain this and show learning progress separately from viewed flags.

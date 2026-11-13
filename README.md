# Mark 1:41 — Angry or Compassionate?

A small static site supporting a talk on the textual variant in Mark 1:41:
was Jesus "moved with compassion" (σπλαγχνισθείς) or "angry" (ὀργισθείς)?

It presents the two readings, the passage and the Nestle–Aland 28 apparatus,
the manuscript witnesses, three transmission models, the arguments (with a
model selector that shows how each argument bears on a chosen model), who
holds which position, claims to retire, a provisional assessment and a
bibliography.

Live site: <https://dimaip.github.io/mark-1-41/> (GitHub Pages, served from the
`main` branch; pushing to `main` publishes).

## Editing the content

All content lives in **`content/data.json`**. Fix a date, add a reference or
change wording there; the page is rendered from that file at load time, so no
layout code needs to change. Bibliography entries are linked automatically
wherever a reference (e.g. `Lorenz 2016, p. 209`) contains an entry's `key`.

## Running locally

No build step. Serve the folder with any static server, for example:

    python3 -m http.server 8000

then open http://localhost:8000. (Opening `index.html` directly from disk
will not work, because the page fetches `content/data.json`.)

## Files

- `index.html`, `styles.css`, `app.js` — page shell, styles and rendering
- `content/data.json` — all content
- `assets/` — crops from NA28 (© Deutsche Bibelgesellschaft; short excerpts for scholarly comment)
- `fonts/` — a tiny subset of Noto Sans for the text-critical signs ⸀ ⸁ (SIL Open Font License, see `fonts/OFL.txt`)

Web fonts (Gentium Book Plus, Noto Sans Syriac, Noto Sans Math) load from Google Fonts.

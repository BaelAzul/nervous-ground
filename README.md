# Ebbly

A quiet web app for neurodivergent people dealing with overstimulation, overwhelm and burnout:
breathing guides, calming sounds made in the browser, a calm space with slow visuals,
and a library you can add your own recordings to.

- No accounts, no tracking. Settings are saved on the person's own device only.
- Works offline once opened, and can be added to a phone's home screen.
- Plain HTML, CSS and JavaScript. No build step, so Vercel just serves the files.

## Adding a recording to the library

1. Put the audio file in the `audio` folder (MP3 or M4A works everywhere; keep files under about 20 MB).
2. Add an entry to `library.json` under `"items"`, for example:

```json
{
  "id": "body-scan-10",
  "kind": "audio",
  "title": "Ten-minute body scan",
  "description": "A slow, guided check-in from head to toe.",
  "src": "audio/body-scan-10.mp3",
  "minutes": 10,
  "needs": ["settle", "drained"]
}
```

Use `"kind": "meditation"` for guided meditations. You can add `"background": "rain-room"` to suggest
a sound underneath (`rain-room`, `low-tide`, `quiet-room`, `warm-hum` or `none`); listeners can change it
in the player, and the background dips automatically while you're speaking.

`needs` decides which filters it shows under: `overwhelm`, `noise`, `drained`, `settle`, `sleep`.

3. Save to GitHub. Vercel updates the live app within a minute or two.

## Other kinds of library entry

- `"kind": "breath"` with `"pattern"` (`longer-out`, `sigh`, `box`, `even`, `4-7-8`) and `"minutes"`.
- `"kind": "soundscape"` with `"mix"` (`quiet-room`, `rain-room`, `low-tide`, `soft-focus`) and optional `"minutes"`.

## Thought loops and hard moments

All the wording for the Loops section lives in `loops.json`, so it can be changed without touching code.

Each moment also has its own circles, set by `"rings"`: `ripple`, `outward`, `tide`, `loosen`, `warm`, `open`, `still` or `fade`. Change the word to change how that moment's circles move.
Each moment has `recognise` (signs + naming line), `drills` (the interrupt options) and `complete`
(the real-world finishing actions). Drill types: `lines`, `notice`, `worryTree`, `listen`, `brainDump`,
`link`, `changeWords`. The `help` block holds the crisis contacts and practice details shown on Get help now.

Nothing typed in this section is ever saved. "Park it" keeps only the chosen time.

## Files

- `index.html` – the page
- `css/app.css` – colours and layout (three themes: Dusk, Very dim, Daylight)
- `js/app.js` – screens and navigation
- `js/breath.js` – breathing patterns
- `js/sound.js` – generated sounds and mixes
- `js/rings.js` – the breathing shape
- `js/loops.js` – the thought loops section (wording in `loops.json`)
- `sw.js` – offline support. Change `VERSION` when you change app files.

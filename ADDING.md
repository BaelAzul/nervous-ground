# Adding new things to Ebbly

## The easy way: the Ebbly editor (Pages CMS)

1. Go to **app.pagescms.org** and sign in with GitHub (the BaelAzul account).
2. The first time, it asks to be allowed into your repositories. Choose
   **Only select repositories**, pick **nervous-ground**, and approve.
3. Open **nervous-ground**. On the left you'll see:
   - **Library (sounds, meditations, breathing)**: open **Library items**, click **Add an entry**
     at the bottom, fill in the form, upload the recording with the **Recording file** box, and
     click **Save**.
   - **Recordings**: every audio file you've uploaded.
   - **Thought loops and Get help now (wording)**: the wording, as text. Change only the words
     between the quote marks.
4. Ebbly updates by itself a minute or two after you save.

Leave the **Date added** as today so the new thing shows as **New** on the home screen and in
the library for two weeks.

Keep recordings under about 20 MB. A 10-minute MP3 is usually around 10 MB.

## The other way: straight on github.com

You can also do it all on github.com in your browser. Nothing to install.
Every change you save goes live on its own within a minute or two.

## Add a recording (meditation, sea sounds, found sounds)

1. **Get the file ready.** MP3 works on every phone. Name it simply, with no spaces,
   for example `sea-at-bull-island.mp3` or `body-scan-5.mp3`.
   (Or send it to Claude, who can trim, level and convert it for you.)
2. **Upload it.** On github.com, open the `nervous-ground` repository, then the `audio` folder.
   Click **Add file**, then **Upload files**, drop the file in, and click **Commit changes**.
3. **Put it in the library.** Open `library.json`, click the pencil to edit, and copy one of
   the items. Change it like this:

```json
{
  "id": "sea-bull-island",
  "kind": "audio",
  "title": "Sea at Bull Island",
  "description": "Waves on the sand, early morning.",
  "src": "audio/sea-at-bull-island.mp3",
  "minutes": 12,
  "needs": ["noise", "settle"],
  "added": "2026-10-09"
}
```

- `kind` is `audio` for sounds or `meditation` for a guided meditation.
- For a meditation, you can add `"background": "low-tide"` so a soft sound plays underneath.
  The choices are `quiet-room`, `low-tide`, `rain-room`, `soft-focus` and `warm-hum`.
- `needs` decides which filters it shows under: `overwhelm`, `noise`, `drained`, `settle`, `sleep`.
- `added` is today's date (year-month-day). It then shows as **New** in the library, and in a
  **New in Ebbly** box on the home screen, for two weeks. To change how long, edit `newDays`
  at the top of `library.json`.

Watch the commas: every item is separated by a comma, and the last one has none.
If the library stops loading after an edit, a missing or extra comma is almost always why.

4. Click **Commit changes**. Done.

## Change wording

- Thought loops and Get help now: `loops.json`.
- Library titles and descriptions: `library.json`.
- Home screen wording: `index.html` (search for the line you want to change).

## Change a moment's circles

In `loops.json`, each moment has `"rings"`. The choices are
`ripple`, `outward`, `tide`, `loosen`, `warm`, `open`, `still` and `fade`.

## A whole new section

A new section needs some building. Write down what it's for and roughly what should happen,
and send it to Claude.

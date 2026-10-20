# Trippin

**Every decision reveals a different version of the world.**

Trippin is a map-first way to discover where to go next. Instead of a search form, you start with a world map and seven simple choices — dates, where you start, budget, how you like to travel, how different you want it to feel, comfort level and how far you're willing to go. Each choice recolours the map, so you can see possibilities you might never have considered.

It's built mobile-first (one-handed on a phone) and also works on tablets and desktop.

---

## Put it online with GitHub Pages (no coding needed)

1. **Create a repository.** On github.com, click **New** (green button) → name it `trippin` → choose **Public** → **Create repository**.
2. **Upload the files.** On the new repository page, click **uploading an existing file**. Open the `trippin` folder on your computer, select **everything inside it** (`index.html`, `css`, `js`, `assets`, `manifest.webmanifest`, `README.md`, `.nojekyll`) and drag it all into the browser window. Then click **Commit changes**.
   - Upload the *contents* of the folder, not the zip file itself.
   - `.nojekyll` is a hidden file. On a Mac, press **Cmd + Shift + .** in Finder to show hidden files. If you miss it, the site still works.
3. **Turn on Pages.** In the repository, go to **Settings → Pages**. Under *Build and deployment*, set **Source** to **Deploy from a branch**, pick **main** and **/ (root)**, then click **Save**.
4. **Open your site.** After a minute or two, refresh the Pages settings page — your link appears at the top, something like `https://your-username.github.io/trippin/`. Open it on your phone and use **Add to Home Screen** to get an app-like icon.

To update the site later, upload the changed files again in the same way — GitHub republishes automatically.

### Trying it on your own computer (optional)

Opening `index.html` by double-clicking won't work, because browsers block this kind of app when it's opened as a plain file. To preview locally, open a terminal in the `trippin` folder and run:

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

---

## How it works

- **Seven parameters, any order.** Tap a chip in the bottom dock to make it the active one: the map switches to that view and an editor opens. Values you set stay set when you switch to another parameter, and every editor has a **Clear** button.
- **The active parameter colours the map; the others act as filters.** Places ruled out by your other choices are hatched, and the caption says which choices are ruling them out — tap one to adjust it.
- **Tap a country or a dot** to zoom in and open the destination panel: why it's worth a look in your dates, recurring festivals and seasonal moments, typical weather, an estimated cost with its assumptions, journey options, cultural difference, and how it fits each of your choices.
- **Shortlist, compare and brief.** Star places, compare up to three side by side, and turn everything into a trip-discovery brief you can copy or print as a PDF.

## What's real and what's estimated

Trippin is honest about its data. Everything is labelled in the app.

| Information | What it is |
|---|---|
| Typical weather and best seasons | Rounded long-term climate averages — **historical patterns** |
| Festivals and events | **Recurring** events. Dates move from year to year — always confirm |
| Costs | **Illustrative estimates** from typical daily costs × nights × comfort level, plus a rough fare model. Not live prices |
| Journey times & routes | A **simplified network model** (which rail networks connect, which places are linked by road or ferry). Not timetables |
| Cultural difference | An **exploratory proxy** comparing language, writing system, food and everyday customs. Not a ranking of cultures |
| "Last year's actual weather" button | **Real observed data**, fetched live from [Open-Meteo](https://open-meteo.com/)'s free historical archive |

Not connected in this version: live fares, hotel rates and confirmed event calendars. The destination panel gives search links so people can check these themselves. Nothing in Trippin is a booking.

The prototype covers **50 curated places across six continents** and **57 departure cities** — not the whole world.

## Adding or editing places

All destination data lives in **`js/data/destinations.js`** — one block per place, with comments explaining each field. Copy an existing block, change the values and upload the file again. Departure cities live in **`js/data/origins.js`**.

## Project structure

```
index.html               the single page
css/styles.css           design system (palette, type, layout)
js/app.js                wires everything together
js/store.js              app state + saving your choices in the browser
js/data/                 destinations, departure cities, world map loader
js/engine/               seasons, costs, transport, culture, filtering, research providers
js/ui/                   map, parameter dock & editors, caption, destination panel, brief
js/vendor/d3.min.js      D3 (maps, zoom, transitions)
assets/                  app icons
```

No build step and no installation: it's plain HTML, CSS and JavaScript, so it runs directly on GitHub Pages.

## Credits

- Map drawing and zoom: [D3](https://d3js.org) (ISC licence, included in `js/vendor`).
- Country outlines: [Natural Earth](https://www.naturalearthdata.com/) via the [world-atlas](https://github.com/topojson/world-atlas) package, loaded from the jsDelivr CDN when the page opens. If that can't load, places still appear as points.
- Historical weather check: [Open-Meteo](https://open-meteo.com/) (free, no key).

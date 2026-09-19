# Meal Plan Tracker

The Team:
- Zhala Ismayilzada (ismayilzadazhala@gmail.com)
- Ethan Liu (ethanyliu@cmu.edu)
- Andrew Wang (andiewyf@hotmail.com)
- John Park (yohanpark2833@gmail.com)

SteelHacks 2026. Track meal blocks, FLEX, Dining Dollars — whatever your school's plan is made of. Log what you use, see where it goes, and find out whether you'll run out before the semester ends or leave it on the table.

**Live:** https://ethanliu2026.github.io/dining-dollars/

## What it does
- Pick your school and your **actual meal plan** → allotments and semester dates are filled in. Catalogs (all 2026–27, each linked to its official source): **CMU, Pitt, Penn State, Temple, Penn, Drexel, Duquesne, Villanova, Lehigh, Rutgers–NB**
- Searchable school picker (type "pitt", "psu", "nova"…). School not listed? **Other** lets you name it, define what your plan is made of (swipes / blocks / dollars, per-semester / weekly / unlimited), list your places to eat, and enter your breaks
- **Eating days, not calendar days**: choose whether you use the plan on weekends and on breaks/holidays. Every school's Fall 2026 breaks (Labor Day, fall break, Thanksgiving…) come from its official academic calendar, so "safe pace" is per day you'll actually be on campus
- Every plan is a set of **buckets**: meal blocks/swipes (count) and FLEX/Dining Dollars (money), each per-semester, weekly (Pitt Weekly 14), or unlimited (Pitt Full-Access)
- Two modes: **Track purchases** (log each meal and which bucket paid for it — including split payments like a block + $3.50 FLEX) or **Quick estimate** (just start + current per bucket)
- Per-bucket verdict: run out / on pace / wasting, safe daily pace, projected end
- Chart per bucket: actual vs. projected vs. ideal pace
- "Where it goes": spend by restaurant, plus insights — *"a block costs you $14.58 on this plan; 5 of your FLEX purchases cost more than that"*, *"cut Ciao Bella by 40% to get back on budget"*
- CMU's restaurant list is pulled live from the [ScottyLabs Dining API](https://dining.apis.scottylabs.org/v2/locations); Pitt's is a fixed list
- Export / import JSON, sample data for demos. Everything stays in localStorage.

## Meal plan data
`plans.json` is the catalog (source of truth); `plans.js` is generated from it so the page works from `file://`. Each school's entry records its `source` URL and a `verified` date. Semester dates and breaks in `schools.js` were taken from each school's official Fall 2026 academic calendar (Lehigh's pacing-break dates are approximate); users can still edit dates under "Semester dates".

```bash
python3 scripts/update_plans.py        # re-fetch CMU's official PDF and regenerate
python3 scripts/update_plans.py --no-fetch   # just regenerate plans.js after editing plans.json
```
CMU publishes plans as a [PDF agreement](https://www.cmu.edu/dining/your-dining-plan/26-27-uc-meal-plan-agreementfinal.pdf) which the script parses (needs `brew install poppler`). Pitt's [Dine On Campus page](https://dineoncampus.com/pitt/20262027-meal-memberships) blocks scripts, so its entry is hand-maintained — paste the page text into `scripts/pitt.txt` and re-run to parse it. The other eight schools were transcribed by hand from their dining sites (linked in `plans.json`).

### Adding a school
1. `schools.js` — add an entry: name, `aliases`, `buckets` (what the plan is made of), Fall dates, `breaks`, `locations`
2. `plans.json` — add its plans (`buckets` values are per-semester numbers, or `{amount, period}` for weekly/unlimited)
3. `python3 scripts/update_plans.py --no-fetch`

## Receipt scanning
"Scan a receipt" → take a photo (or drop / paste an image on desktop). The purchase is logged immediately — location matched to the dropdown, items listed, and **each tender line mapped to a bucket** (a CMU receipt's `MEAL BLOCK` + `FLEX` lines become `1 block + $2.75 FLEX`). A card shows what was read with **Undo** / **Edit**.

Two engines; the best available is used automatically:

| | On-device OCR (default) | Claude vision (optional) |
|---|---|---|
| Setup | none — works for every user out of the box | an API key in Settings, or a deployed proxy |
| Privacy | photo never leaves the phone | photo sent to the API |
| Cost | free | ~1–2¢ per scan |
| Accuracy | good on flat, well-lit receipts; misreads happen, so results are always marked "check this" | much better on crumpled / dim photos and odd formats |

**On-device** ([`ocr.js`](ocr.js)): Tesseract.js (loaded from a CDN on first scan, ~10 MB cached), image is upscaled + Otsu-binarized, with a plain-grayscale second pass if the first finds nothing. Parsing: tender keywords per bucket (`MEAL BLOCK`, `FLEX`, `DINING DOLLARS`, `Points`…) with one-letter fuzzy matching and OCR digit/letter fixes (`BL0CK`), balance/remaining lines ignored, dates in common formats, location matched against the school's list by word overlap. Falls back to the `TOTAL` line (flagged) if no tender line is found. Add keywords in `TENDER_WORDS`.

**Claude** ([`receipt.js`](receipt.js)): `claude-opus-5` with structured outputs whose `bucket` enum is the current plan's buckets. Enable per-browser via Settings (key stored in localStorage) or for everyone by deploying [`server/worker.js`](server/worker.js) to Cloudflare Workers and setting `DEFAULT_PROXY` in `receipt.js`:

```bash
cd server && npm i -g wrangler && wrangler login
wrangler secret put ANTHROPIC_API_KEY
wrangler deploy
```

## Roadmap
1. ~~Manual entry + analytics~~ ✅
2. ~~Receipt photos~~ ✅
3. **Import** — pull transactions from Grubhub / the campus dining portal
4. More schools

## Run locally
No build step. Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8765
```

## Layout
| File | What |
|---|---|
| `index.html` | markup |
| `style.css` | styles (light/dark via CSS vars) |
| `app.js` | state, math, charts, insights |
| `receipt.js` | receipt scanning UI, engine choice, Claude vision path, Settings dialog |
| `ocr.js` | on-device OCR path (Tesseract.js + receipt parser) |
| `server/worker.js` | optional Cloudflare Worker proxy that holds the API key |
| `schools.js` | per-school config: dates, **bucket definitions**, locations. **Add a school here.** |
| `plans.json` / `plans.js` | meal plan catalog (see above) |
| `scripts/update_plans.py` | refreshes the catalog from official sources |

### Data model
```js
state = {
  school: 'cmu', planId: 'red',        // or 'custom'
  start:   { blocks: 205, flex: 880 }, // per-bucket starting allotment
  current: { blocks: 150, flex: 420 }, // quick-estimate mode only
  semStart: '2026-08-31', semEnd: '2026-12-13',
  txns: [{ id, date: 'YYYY-MM-DD', location, item, parts: [{ bucket: 'blocks', amount: 1 }, { bucket: 'flex', amount: 3.5 }] }],
}
```
A purchase is one or more `parts`, each `amount` units of a `bucket` (dollars for money buckets, a count for block buckets). Older single-bucket records are migrated on load.
Receipt OCR and Grubhub import should both just produce `txns` entries.

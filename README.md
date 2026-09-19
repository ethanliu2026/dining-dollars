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
- School not listed? **Other** lets you name it, define what your plan is made of (swipes / blocks / dollars, per-semester / weekly / unlimited), and list your places to eat
- Every plan is a set of **buckets**: meal blocks/swipes (count) and FLEX/Dining Dollars (money), each per-semester, weekly (Pitt Weekly 14), or unlimited (Pitt Full-Access)
- Two modes: **Track purchases** (log each meal and which bucket paid for it) or **Quick estimate** (just start + current per bucket)
- Per-bucket verdict: run out / on pace / wasting, safe daily pace, projected end
- Chart per bucket: actual vs. projected vs. ideal pace
- "Where it goes": spend by restaurant, plus insights — *"a block costs you $14.58 on this plan; 5 of your FLEX purchases cost more than that"*, *"cut Ciao Bella by 40% to get back on budget"*
- CMU's restaurant list is pulled live from the [ScottyLabs Dining API](https://dining.apis.scottylabs.org/v2/locations); Pitt's is a fixed list
- Export / import JSON, sample data for demos. Everything stays in localStorage.

## Meal plan data
`plans.json` is the catalog (source of truth); `plans.js` is generated from it so the page works from `file://`. Each school's entry records its `source` URL and a `verified` date. Semester dates in `schools.js` are Fall 2026 defaults — most are marked approximate; users can edit them under "Semester dates".

```bash
python3 scripts/update_plans.py        # re-fetch CMU's official PDF and regenerate
python3 scripts/update_plans.py --no-fetch   # just regenerate plans.js after editing plans.json
```
CMU publishes plans as a [PDF agreement](https://www.cmu.edu/dining/your-dining-plan/26-27-uc-meal-plan-agreementfinal.pdf) which the script parses (needs `brew install poppler`). Pitt's [Dine On Campus page](https://dineoncampus.com/pitt/20262027-meal-memberships) blocks scripts, so its entry is hand-maintained — paste the page text into `scripts/pitt.txt` and re-run to parse it. The other eight schools were transcribed by hand from their dining sites (linked in `plans.json`).

### Adding a school
1. `schools.js` — add an entry: name, `buckets` (what the plan is made of), Fall dates, `locations`
2. `plans.json` — add its plans (`buckets` values are per-semester numbers, or `{amount, period}` for weekly/unlimited)
3. `python3 scripts/update_plans.py --no-fetch`

## Roadmap
1. ~~Manual entry + analytics~~ ✅
2. **Receipt photos** — snap a receipt, auto-fill a purchase
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
  txns: [{ id, date: 'YYYY-MM-DD', location, item, bucket: 'flex', amount: 12.5 }],
}
```
A purchase is `amount` units of one `bucket` (dollars for money buckets, a count for block buckets).
Receipt OCR and Grubhub import should both just produce `txns` entries.

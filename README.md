# Dining Dollars Tracker

SteelHacks 2026. Log every meal, see where your Dining Dollars go, and find out whether you'll run out before the semester ends — or leave money on the table.

**Live:** https://ethanliu2026.github.io/dining-dollars/

## What it does
- Pick your school (CMU / Pitt) → semester dates and dining locations are pre-filled
- Log purchases (amount, where, what, when) — location autocompletes; CMU's list is pulled live from the [ScottyLabs Dining API](https://dining.apis.scottylabs.org/v2/locations)
- Verdict: run out / on pace / wasting money, plus your **safe daily spend**
- Balance chart: actual vs. projected vs. ideal pace
- "Where it goes": spend by location, and insights like *"Ciao Bella is 27% of your spending — cutting it 40% gets you back on budget"*
- Export / import JSON, sample data for demos. Everything stays in localStorage.

## Roadmap
1. ~~Manual entry + analytics~~ ✅
2. **Receipt photos** — snap a receipt, auto-fill a purchase
3. **Import** — pull transactions from Grubhub / the campus dining portal
4. More schools

## Run locally
No build step. Open `index.html`, or serve the folder (ES modules need http for the CMU API fetch):

```bash
python3 -m http.server 8765
```

## Layout
| File | What |
|---|---|
| `index.html` | markup |
| `style.css` | styles (light/dark via CSS vars) |
| `app.js` | state, math, charts, insights |
| `schools.js` | per-school config: dates, currency name, locations. **Add a school here.** |

### Data model
```js
state = {
  school: 'cmu',
  start: '1800',             // starting balance
  semStart: '2026-08-31', semEnd: '2026-12-13',
  txns: [{ id, date: 'YYYY-MM-DD', location, item, amount }],
}
```
Receipt OCR and Grubhub import should both just produce `txns` entries.

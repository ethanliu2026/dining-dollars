# Meal Plan Tracker

The Team:
- Zhala Ismayilzada (ismayilzadazhala@gmail.com)
- Ethan Liu (ethanyliu@cmu.edu)
- Andrew Wang (andiewyf@hotmail.com)
- John Park (yohanpark2833@gmail.com)

SteelHacks 2026. Track meal blocks, FLEX, Dining Dollars — whatever your school's plan is made of. Log what you use, see where it goes, and find out whether you'll run out before the semester ends or leave it on the table.

**Live:** https://ethanliu2026.github.io/dining-dollars/

## What it does
Five sections (tabs on desktop, bottom nav on phones): **Home** (verdict, balances, chart, scan & log), **Setup** (school, plan, dates), **Insights** (where it goes, purchases, block values), **Eat** (where-to-eat decider, tips), **Advisor**.

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
`plans.json` is the catalog (source of truth); `plans.js` is generated from it so the page works from `file://`. Each school's entry records its `source` URL and a `verified` date. `schools.js` carries every school's **terms** (Fall 2026 and Spring 2027 — Winter + Spring quarters for Drexel) with start/end and no-class days from the official academic calendars; the app picks the term containing today (or the next one) when you choose a school, offers "Start next term" once a term ends, and dates remain editable. Approximate: Lehigh's breaks (inferred from part-of-term gaps), Villanova's Easter recess, Drexel's spring start.

```bash
python3 scripts/update_plans.py        # re-fetch CMU's official PDF and regenerate
python3 scripts/update_plans.py --no-fetch   # just regenerate plans.js after editing plans.json
```
CMU publishes plans as a [PDF agreement](https://www.cmu.edu/dining/your-dining-plan/26-27-uc-meal-plan-agreementfinal.pdf) which the script parses (needs `brew install poppler`). Pitt's [Dine On Campus page](https://dineoncampus.com/pitt/20262027-meal-memberships) blocks scripts, so its entry is hand-maintained — paste the page text into `scripts/pitt.txt` and re-run to parse it. The other eight schools were transcribed by hand from their dining sites (linked in `plans.json`).

### Adding a school
1. `schools.js` — add an entry: name, `aliases`, `buckets` (what the plan is made of), `terms` (dates + breaks), `locations`
2. `plans.json` — add its plans (`buckets` values are per-semester numbers, or `{amount, period}` for weekly/unlimited)
3. `python3 scripts/update_plans.py --no-fetch`

## Receipt scanning
"Scan a receipt" → take a photo (or drop / paste an image on desktop). The purchase is logged immediately — location matched to the dropdown, items listed, and **each tender line mapped to a bucket** (a CMU receipt's `MEAL BLOCK` + `FLEX` lines become `1 block + $2.75 FLEX`). A card shows what was read with **Undo** / **Edit**.

Two engines; the best available is used automatically. (`CLAUDE_ENABLED` at the top of `receipt.js` turns the Claude path off entirely for a no-LLM build.)

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

## Plan advisor
Bottom of the page. Two modes:
- **From my usage** — projects your tracked (or quick-estimate) usage over the full semester's eating days, then scores every plan you're eligible for. Tells you to stay or switch, and by how much.
- **I'm new — help me pick** — two sliders (dining-hall meals/week, retail $/week) for students with no history, e.g. incoming first-years.

Pick your group (first-year / returning resident / on-campus apartment / off-campus) and only the plans that group may choose are shown — eligibility rules per school are in `plans.json` (`eligible` on each plan, `eligibility` note per school, from the official dining pages). Apartment/off-campus groups also get a "No meal plan" row.

Scoring: **true cost** = plan price + what you'd pay out of pocket for anything it doesn't cover (dining-hall meals at ~$14, money 1:1). Lowest true cost wins; ties within 1% are called out; if the winner involves out-of-pocket spending, the cheapest plan that fully covers you is offered too. Unused swipes are valued at what the plan charges per swipe (`(price − dollars) ÷ swipes`) and shown as waste. Money-only schools (Penn State) convert meals to dollars via `hallMealCost` in `schools.js`.

## Today
On Home: how many blocks and how many dollars to use for the rest of today, split across the meal periods left (breakfast / lunch / dinner / late night), minus what's already logged today. Spare blocks round up ("use 3 today"), short ones round down; money follows the safe daily rate (nudged up when you're under pace). Blocks are pointed at the best-value place known. Respects per-day caps (CMU 4 blocks, Pitt 5 meals).

## Starting mid-semester
Setup → "I'm starting mid-semester": pick the first day you're logging from and enter what you had left that day (from the GET / dining app). Everything used before that counts as spent, pacing and projections use the whole semester, and the chart draws a straight line from the semester start to that point, then follows your log.

## Share my semester
Insights → **Share my semester** draws a card (school, plan, blocks/dollars used, status, most-visited place, the advisor's verdict) on a canvas — nothing uploaded — and hands it to the phone's share sheet, or downloads it with the caption copied.

## Block values by place
A block doesn't buy the same amount everywhere — at CMU one block might cover $15.50 at a dining hall and $9.75 at a café. Schools don't publish these, so the app **learns them**: a scanned receipt's tender line (`MEAL BLOCK −12.49`) records what the block covered there; the manual form has an optional "worth $" field; and Insights → "What a block is worth by place" lets you set or fix a value. With two or more places known it tells you where blocks go furthest and how much you've left on the table by using blocks where dollars would've been smarter. Where a value is known, "Where it goes" uses it instead of the plan's average cost per block.

## Eat: where-to-eat decider and tips
**Decide for me** scores every place on: open right now (CMU has live hours, ratings and today's specials via ScottyLabs; other schools skip this), how you're paying (Auto picks blocks when you have spare blocks or dollars are running low), where a block buys the most (from the learned block values), variety (places you haven't logged lately), ratings, specials — plus some randomness so "Not feeling it" rotates. "I'm going — log it" prefills the purchase form.

**Tips & hidden menu** (`tips.js`): per-school knowledge grouped as *what your block includes* (e.g. CMU: Tartan Express, Revolution Noodle and Stack'd blocks include a drink), *best value*, *hidden menu*, and *plan rules* (sourced from the dining agreements). Users can add their own (synced with the account) and "Suggest for everyone" opens a prefilled GitHub issue.

## Importing orders
No, you can't pull orders from Grubhub — there's no consumer API, and scraping a logged-in session breaks their terms and breaks constantly. What works: **paste the order-confirmation email** (or a GET-app receipt) into "Or paste an order confirmation" under Scan a receipt; it runs through the same parser as the OCR path.

## Roadmap
1. ~~Manual entry + analytics~~ ✅
2. ~~Receipt photos~~ ✅
3. ~~Plan advisor + first-year picker~~ ✅
4. More schools

## Accounts (optional)
Guests keep everything in the browser. Signing in (email + password via Supabase, `auth.js` / `account-store.js`) saves the same state to one row per user (`supabase/schema.sql`, row-level security so users only see their own row) with version checks so two devices can't silently overwrite each other. The publishable key in `auth-config.js` is meant to be public; never put a service-role key there.

Supabase setup checklist: run `supabase/schema.sql`; under Authentication → URL Configuration add every URL the app is served from (GitHub Pages, AFS, `http://localhost:8765`) as redirect URLs, or confirmation/reset links will bounce to the wrong place.

## Deploying (GitHub Pages, CMU AFS, anywhere static)
Copy the folder as-is. Asset URLs in `index.html` carry a `?v=<git hash>` stamp so browsers never reuse a stale `app.js` after an upload — a pre-commit hook keeps it current (`sh scripts/install-hooks.sh` once per clone, or run `python3 scripts/stamp.py` by hand before uploading). `.htaccess` additionally asks Apache to revalidate; AFS needs `fs setacl -dir ~/www/<folder> -acl system:anyuser rl` on any new directory.

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
| `ocr.js` | on-device OCR path (Tesseract.js + receipt parser, also used for pasted orders) |
| `advisor.js` | plan advisor: needs projection, eligibility, scoring, recommendation |
| `eat.js` / `tips.js` | where-to-eat decider (live hours for CMU) and per-school tips |
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

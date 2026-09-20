# Meal Blocks — Devpost submission

**Tagline (60 chars max):** Know if your meal plan will last — and what to eat today.

**Try it:** https://meal-blocks.tech · **Code:** https://github.com/ethanliu2026/dining-dollars

---

## Inspiration

It's November. You open the dining app and it says *183 blocks, $41.20 FLEX*. Is that good? Nobody knows. One friend is rationing cereal; another will hand $300 back to the university in December. A CMU meal plan costs almost $4,000 a semester, it's made of two different currencies with different rules, and the only thing the school gives you is a balance.

We wanted the number the app *should* show: **will this last, and what should I do today?**

## What it does

Pick your school and plan, log what you buy, and it tells you where you stand — *"You'll run out of FLEX around Nov 17! Drop to $11.05/day to make it"* — plus a plan for the rest of today (*"Dinner: 2 blocks at Schatz, up to $6 for a drink"*).

- **Log in seconds:** photo of a receipt, a pasted Grubhub email, or a two-field form. Split payments (a block + $2.75 FLEX) just work.
- **Real forecasts, not a straight line:** 2,000 simulated semesters from your own daily spending give a probability of running out and a likely range, drawn as a band on the chart.
- **Where it goes:** spend by place, and what a block actually buys at each one
- — learned from your receipts — so you know where blocks go furthest and where to pay with dollars instead.
- **Where to eat:** a one-tap pick using live hours, ratings and specials (CMU), how you're paying, and where you haven't been lately.
- **Which plan next semester:** projects your habits over the plans you're eligible for and scores each by true cost — including "skip the plan" when that's cheaper.
- **10 schools** — CMU, Pitt, Penn State, Temple, Penn, Drexel, Duquesne, Villanova, Lehigh, Rutgers — every plan, price, eligibility rule, semester date and break taken from the school's official pages. Any other school can be set up by hand.
- Optional account to sync between phone and laptop; installs to the home screen and works offline.

## How we built it

Plain HTML/CSS/JavaScript, no framework, hosted as static files. The core idea is that every meal plan — blocks, swipes, FLEX, Dining Dollars, Points; per-semester, weekly, or unlimited — is a set of **buckets**, and a purchase is a list of amounts drawn from buckets. One set of math then covers all ten schools.

Receipts are read **on the device** with Tesseract.js: we binarize the photo, recognize text, then parse tender lines (`MEAL BLOCK −12.49`, `FLEX −2.75`) into buckets with one-letter fuzzy matching for OCR errors. Nothing is uploaded and there is no language model in the product. The forecast is a Monte Carlo resampling of your own per-weekday spending; the plan advisor computes each plan's true cost as price plus what you'd pay out of pocket for anything it doesn't cover. Accounts use Supabase with row-level security and version checks so two devices can't silently overwrite each other.

## Challenges we ran into

- **Ten schools, ten systems.** CMU sells blocks + FLEX; Pitt has unlimited, weekly and block plans; Penn State is dollars only with a 65% discount; Drexel runs on quarters. Getting to one model that fits all of them took several rewrites.
- **Data provenance.** We transcribed every plan from official dining pages and agreements and kept the source URL and verification date next to each one — and still found and fixed several wrong dates along the way.
- **Thermal receipts are ugly.** OCR misreads a letter here and a digit there, so every scanned result is flagged "check this" with one-tap undo and edit rather than trusted blindly.
- **Sync conflicts.** When the same account edits on two devices, the second save is refused with a clear message instead of overwriting.
- **Too much on one screen.** The app grew fast; the last stretch was spent cutting, stacking and hiding until the home screen answered one question.

## Accomplishments that we're proud of

- It gives an **answer**, not a balance.
- A student at any of ten schools can pick their real plan and get correct dates, breaks and rules on day one.
- Receipt scanning that works on a phone with no account, no key and no server.
- The advisor is honest: it will tell an apartment resident to skip the plan when the numbers say so.

## What we learned

- Modeling the domain well (buckets, eating days, terms) mattered more than any single feature.
- People trust numbers they can trace — every plan links to its source, every forecast says how it was computed.
- One clear sentence at the top beats a dashboard of everything.

## What's next

- Crowd-sourced block values and tips per campus (the "block includes a drink at Tartan Express" knowledge every senior has).
- Receipt deskew before OCR, and an optional cloud reader for hard photos.
- Reminders ("you have 2 blocks to use before Sunday").
- More schools — adding one is a JSON entry plus its calendar.

---

### Track notes (delete before posting)
- **Compound:** the "what could go wrong" answers are in Challenges (OCR flagged + undo; sync conflicts refused; dates from registrars but editable; synthetic sample data for demos).
- **No Wrapper:** the shipped build has `CLAUDE_ENABLED = false`; do not mention Claude/LLMs in the story or tags.
- **Seed Round:** lead with "10 schools, one model, adding a school is a JSON entry" and the crowd-sourced tips loop.

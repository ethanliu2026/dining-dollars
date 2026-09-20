## Inspiration

It's November. You open the dining app and it says *183 blocks, $41.20 FLEX*. Is that good? Nobody knows. One friend is rationing cereal; another will hand $300 back to the university in December. A CMU meal plan costs almost $4,000 a semester, it's made of two different currencies with different rules, and the only thing the school gives you is a balance.

We wanted the number the app *should* show: **will this last, and what should I do today?**

## What it does

Pick your school and plan, log what you buy, and it tells you where you stand — *"You'll run out of FLEX around Nov 17! Drop to $11.05/day to make it"* — plus a plan for the rest of today (*"Dinner: 2 blocks at Schatz, up to $6 for a drink"*).

- **Log in seconds:** photo of a receipt, a pasted Grubhub email, or a two-field form. Split payments (a block + $2.75 FLEX) just work.
- **Real forecasts, not a straight line:** 2,000 simulated semesters from your own daily spending give a probability of running out and a likely range, drawn as a band on the chart.
- **Where it goes:** spend by place, and what a block actually buys at each one. The system learns from your receipt, so you know where blocks go furthest and where to pay with dollars instead.
- **Where to eat:** a one-tap pick using live hours, ratings and specials (CMU), how you're paying, and where you haven't been lately.
- **Which plan next semester:** projects your habits over the plans you're eligible for and scores each by true cost — including "skip the plan" when that's cheaper.
- **10 schools** — CMU, Pitt, Penn State, Temple, Penn, Drexel, Duquesne, Villanova, Lehigh, Rutgers. Every plan, price, eligibility rule, semester date and break taken from the school's official pages. Any other school can be set up by hand.
- Optional account to sync between phone and laptop; installs to the home screen and works offline.

## How we built it

We used plain HTML + CSS + JavaScript without a framework and hosted as static files. We included very meal plan, not limited to blocks, swipes, FLEX, Dining Dollars, points, or whether it’s per-semester, weekly, or unlimited. The core idea is that those parameters are a set of **buckets**, and a purchase is a list of amounts drawn from buckets. One set of math then covers all ten schools.

Receipts are read **on the device** with Tesseract.js: we binarize the photo, recognize text, then parse tender lines into buckets with one-letter fuzzy matching for OCR errors. Nothing is uploaded and there is no language model in the product. The forecast is a Monte Carlo resampling of your own per-weekday spending; the plan advisor computes each plan’s true cost as price plus what you’d pay out of pocket for anything it doesn’t cover. Accounts use Supabase via Github with row-level security and version checks so two devices can’t silently overwrite each other.

## Challenges we ran into

- **Ten schools, ten systems.** CMU sells blocks + FLEX; Pitt has unlimited, weekly and block plans; Penn State is dollars only with a 65% discount; Drexel runs on quarters. Getting to one model that fits all of them took several rewrites.
- **Data provenance.** We transcribed every plan from official dining pages and agreements and kept the source URL and verification date next to each one, and we still found and fixed several wrong dates along the way.
- **Thermal receipts are ugly.** OCR misreads a letter here and a digit there, so every scanned result is flagged "check this" with one-tap undo and edit rather than trusted blindly.
- **Sync conflicts.** When the same account edits on two devices, the second save is refused with a clear message instead of overwriting.
- **Too much on one screen.** The app grew fast; to avoid an overwhelming amount of information, the last stretch was spent cutting, stacking and hiding until the home screen answered one question.

## Accomplishments that we're proud of

- It gives an **answer**. It helps students with a real pain and gives them an actionable, customized solution.
- A student at any of ten schools can pick their real plan and get correct dates, breaks and rules on day one.
- Receipt scanning that works on a phone with no account, no key and no server.
- The advisor is honest: it will tell an apartment resident to skip the plan when the numbers say so.

## What we learned

**About the problem**

- *The balance isn't the product; the decision is.* Every dining app already shows a number. What nobody shows is whether it's enough — and once we framed the app around one sentence ("you'll run out around Nov 17, drop to $11/day"), every other feature either served that sentence or got cut.
- *"Days left" is a lie.* A straight-line projection over calendar days was wrong for everyone: students go home for Thanksgiving, skip weekends, and Drexel is on quarters. Counting only the days you'll actually eat on campus, which was pulled from each school's real academic calendar, changed the answer by 10–20%.
- *The straight line was overconfident.* Resampling a student's own daily spending 2,000 times gave a range instead of a date, and a probability instead of a verdict. When the linear model said "Nov 23" and the simulation said "58% chance, Dec 2–11 if so," the simulation was the honest one.
- *Value is per place, not per plan.* A block "costs" $14.58 on the Red Plan, but it buys $15.50 at one dining hall and $9.75 at a café. Schools don't publish that anywhere — it only exists on the receipt itself, which is why the receipt scanner captures it.

**About building it**

- *Get the model right before the features.* We rewrote the core three times (single balance → blocks + dollars → arbitrary "buckets" with semester/weekly/unlimited periods). Only the last one let ten very different schools share one code path. After that, adding a school was a data entry, not an engineering task.
- *Verify sources, then verify again.* We transcribed every plan and calendar from official pages and still got dates wrong — a PDF whose labels sat below their week row cost us a week on CMU's start date until a teammate caught it. Keeping a source URL and a "verified" date next to every number made mistakes findable.
- *Client-only has real limits.* No public API exists for Grubhub or campus-card history, so "import your transactions" became "paste the confirmation email." Receipts are read on-device because that's the only option that needs no key, no account and no server — and because privacy is a feature when the data is what you ate.
- *The boring bugs are the ones users hit.* Windows line endings turned a 150-line change into an 1,800-line diff; a cached `index.html` made a deploy look broken; a browser API we relied on only exists on https; an iOS tap on a dropdown blurred the input before the tap landed. None of these were "interesting," and every one of them was reported by a teammate on a real phone.

**About users**

- *Watching people use it beat every assumption.* Testers typed over the plan's fixed allotments and broke their own numbers; the fix was to lock what the plan defines and leave editable only what's theirs. A "Not feeling it" button that returned the same restaurant read as "broken," not "confident."
- *Trust comes from traceability.* Every plan links to its official page, every insight says how many receipts it's based on, every OCR result is flagged "check this" with one-tap undo. People forgive an app that's wrong and says so; they abandon one that's wrong and confident.
- *Clutter is a feature failure.* The app became overwhelming the moment it did everything on one screen. The last hours went to cutting — tabs, stacked panels, collapsed tips, a settings page, only until a first-time user could answer "am I okay?" without scrolling.

## What's next

- Receipt deskew before OCR, and an optional cloud reader for hard photos.
- Reminders ("you have 2 blocks to use before Sunday").
- More schools since adding one is a JSON entry plus its calendar.
- Turning the website into an app that customers can use offline.

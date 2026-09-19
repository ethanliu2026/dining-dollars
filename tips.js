// Tips, best values and "hidden menu" knowledge per school. Community-maintained: add a
// line here (with a source if it's a rule) or use "Add a tip" in the app.
//   tag: 'block' (what a block/swipe includes) · 'value' (best value) · 'rule' (plan rules) · 'hidden' (off-menu)
//   place: optional location name, matched to the dropdown when possible
window.TIPS = {
  cmu: [
    { tag: 'block', place: 'Tartan Express Food Truck', tip: 'Your meal block includes a drink — don\'t pay FLEX for it.' },
    { tag: 'block', place: 'Revolution Noodle', tip: 'A block meal comes with a drink.' },
    { tag: 'block', place: "Stack'd Underground", tip: 'The block includes a fountain drink; ask if they don\'t offer it.' },
    { tag: 'rule', tip: 'Up to 2 blocks per meal period and 4 per day. Meal periods: breakfast 3:30–10:29 AM, lunch 10:30 AM–4:29 PM, dinner 4:30–8:59 PM, late night 9 PM–3:29 AM.', source: 'Dining plan agreement' },
    { tag: 'rule', tip: 'FLEX expires at the end of each semester; DineXtra carries over to spring and expires then. Spend FLEX first.', source: 'Dining plan agreement' },
    { tag: 'rule', tip: 'Blocks can only buy designated "block meals" — FLEX and DineXtra can be spent in any amount at any location.', source: 'Dining plan agreement' },
    { tag: 'rule', tip: 'Traditional plans include 2 guest meals per semester — use them on a visiting friend or parent.', source: 'Dining plan agreement' },
    { tag: 'value', tip: 'A block costs you about $14–15 on any plan. If a place\'s block meal covers less than that, pay with FLEX there and save the block for a dining hall.' },
    { tag: 'rule', tip: 'Your plan stays active over fall break and Thanksgiving — if you\'re staying on campus, keep using it.', source: 'Dining plan agreement' },
  ],
  pitt: [
    { tag: 'value', tip: 'Dining Dollars get 10% off at every on-campus restaurant that isn\'t a national brand.', source: 'Dine On Campus' },
    { tag: 'rule', tip: 'Dining Dollars roll over from fall to spring as long as you keep the same or a bigger plan; they expire at the end of spring.', source: 'Dine On Campus' },
    { tag: 'hidden', tip: '25% of your plan\'s Dining Dollars can be spent at select off-campus partners.', source: 'Dine On Campus' },
    { tag: 'block', tip: 'A meal swipe works as a Meal Exchange at retail spots: entrée + side + drink for one swipe. Ask for the exchange combo.', source: 'Dine On Campus' },
    { tag: 'rule', tip: 'Flex Meals are for guests (or you) at The Eatery / The Perch and expire each semester. Unused ones can be donated at the end of term.', source: 'Dine On Campus' },
  ],
  psu: [
    { tag: 'value', tip: 'The Campus Meal Plan takes 65% off dining-commons meals ($3.20 breakfast / $4.90 lunch / $6.05 dinner) — by far the best use of dining dollars.', source: 'LiveOn' },
    { tag: 'rule', tip: 'No discount on packaged/branded items or national-brand spots in the HUB — those burn dining dollars at full price.', source: 'LiveOn' },
    { tag: 'rule', tip: 'If your dining dollars hit $0, purchases pull from LionCash with the same discount ("overdraft protection"). LionCash never expires; dining dollars die at the end of spring.', source: 'LiveOn' },
  ],
  temple: [
    { tag: 'block', tip: 'Meals can be used at select retail locations, not just the dining halls (coffee & convenience excluded).', source: 'Temple Dining' },
    { tag: 'rule', tip: 'Weekly plans reset each week — unused meals don\'t carry over, so use them or lose them by Sunday.', source: 'Temple Dining' },
  ],
  penn: [
    { tag: 'rule', tip: 'Dining Dollars roll from fall to spring and expire on Commencement Day; swipes expire at the end of each semester\'s finals.', source: 'Penn Dining' },
    { tag: 'block', tip: 'Up to 2 swipes per meal period; swipes also work as Meal Exchange at retail cafés.', source: 'Penn Dining' },
    { tag: 'rule', tip: 'First- and second-year plans include 10 guest swipes per semester.', source: 'Penn Dining' },
  ],
  drexel: [
    { tag: 'rule', tip: 'Dining Dollars roll to the next term only if you buy another plan by the rollover deadline.', source: 'Drexel Dining' },
    { tag: 'block', tip: 'Meal exchange is available at the Perelman Center for Jewish Life.', source: 'Drexel Dining' },
  ],
  duq: [
    { tag: 'block', tip: 'Meal Swipe Equivalency: a swipe is worth $5.35 at breakfast, $7.50 at lunch, $8.75 at dinner at Chick-fil-A, Cinco Cantina and The Incline.', source: 'Duquesne Dining' },
    { tag: 'rule', tip: 'Flex Dollars carry over fall → spring but expire at the end of the year; unused swipes expire each semester.', source: 'Duquesne Dining' },
    { tag: 'value', tip: 'PLUS dollars bought separately get a 10% bonus when loaded.', source: 'Duquesne Dining' },
  ],
  villanova: [
    { tag: 'hidden', tip: 'Points (and Nova Bucks) work at the on-campus Wawa; meals and Meal Plan Express don\'t.', source: 'Villanova Dining' },
    { tag: 'block', tip: 'Meal Plan Express lets you use a meal at retail locations — up to 2 per meal period, and up to 14/week on Any Time 7.', source: 'Villanova Dining' },
    { tag: 'rule', tip: 'Weekly meal balances reset every Monday.', source: 'Villanova Dining' },
  ],
  lehigh: [
    { tag: 'block', tip: 'Block plans allow Meal Exchanges at retail spots (5/week on 240 Block, 7/week on 220, any on 180 and below).', source: 'Lehigh Dining' },
  ],
  rutgers: [
    { tag: 'rule', tip: 'Up to 3 meals per day can be used for retail or dining-hall takeout instead of sitting down.', source: 'Rutgers Dining' },
    { tag: 'rule', tip: 'Up to 10 meals per semester can be used for guests.', source: 'Rutgers Dining' },
  ],
};

// School-specific config. Add a school here and it shows up in the picker.
// Each entry: semester dates, the "buckets" its meal plans are made of, and a list
// of dining locations for the dropdown. Plans themselves live in plans.js.
//
// A bucket is one thing you can pay with:
//   kind:   'count' (blocks / swipes) or 'money' ($)
//   period: 'semester' (expires at end), 'week' (resets weekly), 'unlimited'
//   unit:   singular noun for count buckets
window.SCHOOLS = {
  cmu: {
    name: 'Carnegie Mellon',
    buckets: {
      blocks: { label: 'Meal blocks', kind: 'count', unit: 'block', period: 'semester',
                hint: 'Max 4 per day, 2 per meal period' },
      flex:   { label: 'FLEX', kind: 'money', period: 'semester' },
      dinex:  { label: 'DineXtra', kind: 'money', period: 'semester', optional: true,
                hint: 'Bought separately; not part of a plan' },
    },
    // Fall 2026 from the 26–27 academic calendar: first day of classes → last day of finals
    semStart: '2026-08-31',
    semEnd: '2026-12-13',
    aliases: ['CMU', 'Carnegie Mellon University', 'Tartans'],
    // Days with no classes (Fall 2026). Users choose whether they still eat on campus then.
    breaks: [
      { name: 'Labor Day', start: '2026-09-07', end: '2026-09-07' },
      { name: 'Fall Break', start: '2026-10-12', end: '2026-10-16' },
      { name: 'Democracy Day', start: '2026-11-03', end: '2026-11-03' },
      { name: 'Thanksgiving', start: '2026-11-25', end: '2026-11-29' },
    ],
    locations: [
      'Au Bon Pain at Skibo Café', 'Baroque Toast', 'Capital Grains', 'Ciao Bella',
      'Crisp and Crust', 'De Fer Coffee & Tea @ Resnik', 'E.A.T. (Evenings at Tepper)',
      'El Gallo de Oro', 'Entropy+', 'Fire and Stone', 'Forbes Avenue Subs', 'Hunan Express',
      'La Prima Espresso', 'La Prima - Rohr Café', 'Maggie Murph Cafe', 'Mercato a Mano',
      "Millie's Coffee 'n' Creamery", 'Nourish', 'Ola Ola', 'Parrilla del Sol', 'Redhawk Coffee',
      'Revolution Noodle', "Salem's Hot Bar", 'Schatz Dining Room', "Scotty's Market",
      'Shake Smart', "Stack'd Underground", "Stack'd Dessert Bar", 'Sweet Plantain', 'Tahini',
      'Tartan Express Food Truck', 'Taste of India', 'Tepper Eatery', 'Tepper Taqueria',
      'The Edge Cafe & Market', 'The Exchange', "The Grill at Scotty's", 'Wild Blue Sushi',
      "Yella's", 'Zebra Lounge',
    ],
    // Live list from ScottyLabs (https://dining.apis.scottylabs.org). Falls back to the
    // hardcoded list above if the request fails.
    async fetchLocations() {
      const res = await fetch('https://dining.apis.scottylabs.org/v2/locations');
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      return data.map(l => titleCase(l.name));
    },
  },
  pitt: {
    name: 'University of Pittsburgh',
    buckets: {
      meals:     { label: 'Meals', kind: 'count', unit: 'meal', period: 'semester',
                   hint: 'Dining hall swipe or a Meal Exchange combo' },
      flexMeals: { label: 'Flex meals', kind: 'count', unit: 'meal', period: 'semester',
                   hint: 'Guest swipes; expire each semester' },
      dd:        { label: 'Dining Dollars', kind: 'money', period: 'semester',
                   hint: '10% off at non-national-brand spots' },
    },
    // Fall 2026 per the Registrar's 26–27 calendar: classes Aug 24, term ends Dec 12
    semStart: '2026-08-24',
    semEnd: '2026-12-12',
    aliases: ['Pitt', 'UPitt', 'University of Pittsburgh', 'Panthers'],
    // Days with no classes (Fall 2026). Users choose whether they still eat on campus then.
    breaks: [
      { name: 'Labor Day', start: '2026-09-07', end: '2026-09-07' },
      { name: 'Fall Break', start: '2026-10-09', end: '2026-10-11' },
      { name: 'Thanksgiving', start: '2026-11-22', end: '2026-11-29' },
    ],
    locations: [
      'The Eatery (Towers)', 'The Perch (Sutherland)', 'Forbes Street Market', 'Cathedral Café',
      'Einstein Bros. Bagels (Posvar)', 'Einstein Bros. Bagels (Benedum)', 'Starbucks (Cathedral)',
      'Starbucks (Hillman)', 'Chick-fil-A', 'Steel City Salads', 'Panther Pizza', 'True Burger',
      'Wicked Pie', 'Pom & Honey', 'Burrito Bowl', 'Sushi Do', 'Common Grounds', 'Bunsen Bites',
      'Bottom Line Bistro', 'Saxbys', 'The Pete Grab & Go', 'Nordy\'s Place',
    ],
  },

  psu: {
    name: 'Penn State (University Park)',
    // No swipes here: dining-commons meals are paid from Dining Dollars at set prices
    // ($3.20 breakfast / $4.90 lunch / $6.05 dinner on the Campus Meal Plan).
    hallMealCost: 5,
    buckets: {
      dd:       { label: 'Dining Dollars', kind: 'money', period: 'semester',
                  hint: '65% off at dining commons; roll fall → spring' },
      lioncash: { label: 'LionCash', kind: 'money', period: 'semester', optional: true,
                  hint: 'Separate prepaid account; never expires' },
    },
    // Fall 2026 per the Registrar: classes Aug 24, finals end Dec 18
    semStart: '2026-08-24',
    semEnd: '2026-12-18',
    aliases: ['PSU', 'Penn State', 'Nittany Lions', 'State College'],
    // Days with no classes (Fall 2026). Users choose whether they still eat on campus then.
    breaks: [
      { name: 'Labor Day', start: '2026-09-07', end: '2026-09-07' },
      { name: 'Thanksgiving', start: '2026-11-22', end: '2026-11-28' },
    ],
    locations: [
      'Pollock Commons', 'Redifer Commons (South)', 'Findlay Commons (East)', 'Waring Commons (West)',
      'North Food District (Warnock)', 'HUB – Burger King', 'HUB – Slim Chickens', "HUB – McAlister's Deli",
      'HUB – Jamba', 'HUB – Starbucks', 'HUB – Hibachi-San', 'HUB – Panda Express', 'HUB – Sbarro',
      'HUB – Soup & Garden', 'HUB – Grate Chee', 'HUB – Blue Burrito', 'HUB – Cow & Cookie',
      'Berkey Creamery', 'Cafe Laura', 'Panera Bread', 'Saxbys', 'Shake Smart (IM Building)', 'Freshens',
    ],
  },
  temple: {
    name: 'Temple University',
    buckets: {
      meals:   { label: 'Meals', kind: 'count', unit: 'meal', period: 'week',
                 hint: 'Dining hall swipe or select retail; weekly plans reset each week' },
      guest:   { label: 'Guest meals', kind: 'count', unit: 'meal', period: 'semester', optional: true, passive: true },
      diamond: { label: 'Diamond Dollars', kind: 'money', period: 'semester', optional: true,
                 hint: 'Separate declining balance; not part of a meal plan' },
    },
    // Fall 2026 per the Registrar: classes Aug 24, finals end Dec 15
    semStart: '2026-08-24',
    semEnd: '2026-12-15',
    aliases: ['TU', 'Temple', 'Owls'],
    // Days with no classes (Fall 2026). Users choose whether they still eat on campus then.
    breaks: [
      { name: 'Labor Day', start: '2026-09-07', end: '2026-09-07' },
      { name: 'Fall Wellness Day', start: '2026-10-02', end: '2026-10-02' },
      { name: 'Fall Break + Thanksgiving', start: '2026-11-23', end: '2026-11-29' },
    ],
    locations: [
      'Johnson & Hardwick Dining Hall', 'Esposito Dining Court (Morgan Hall)', 'Student Center Food Court',
      'Chick-fil-A (Student Center)', 'Starbucks (Student Center)', 'Saxbys (Charles Library)',
      "Richie's", 'Morgan Hall Market', 'The Wall (food trucks)', 'Fresh Grocer',
    ],
  },
  penn: {
    name: 'University of Pennsylvania',
    buckets: {
      swipes: { label: 'Swipes', kind: 'count', unit: 'swipe', period: 'semester',
                hint: 'Up to 2 per meal period; also good for Meal Exchange' },
      dd:     { label: 'Dining Dollars', kind: 'money', period: 'semester',
                hint: 'Roll fall → spring; expire Commencement Day' },
      guest:  { label: 'Guest swipes', kind: 'count', unit: 'swipe', period: 'semester', optional: true, passive: true },
    },
    // Fall 2026 per the Almanac three-year calendar: classes Aug 25, term ends Dec 17
    semStart: '2026-08-25',
    semEnd: '2026-12-17',
    aliases: ['UPenn', 'Penn', 'Quakers'],
    // Days with no classes (Fall 2026). Users choose whether they still eat on campus then.
    breaks: [
      { name: 'Labor Day', start: '2026-09-07', end: '2026-09-07' },
      { name: 'Fall Term Break', start: '2026-10-01', end: '2026-10-04' },
      { name: 'Thanksgiving', start: '2026-11-26', end: '2026-11-29' },
    ],
    locations: [
      '1920 Commons', 'Hill House Dining', 'Lauder College House Dining', 'Falk Dining Commons (Hillel)',
      'Quaker Kitchen', 'Houston Market', 'Accenture Café', "Joe's Café (Wharton)", 'Gourmet Grocer',
      "Mark's Café (Van Pelt)", 'Starbucks (1920 Commons)', 'McClelland Express', 'Pret A Manger',
    ],
  },
  drexel: {
    name: 'Drexel University',
    buckets: {
      meals: { label: 'Meals', kind: 'count', unit: 'meal', period: 'semester',
               hint: 'Dining hall swipe or Meal Exchange; weekly plans reset each week' },
      dd:    { label: 'Dining Dollars', kind: 'money', period: 'semester',
               hint: 'Roll to next term only if you buy another plan' },
      guest: { label: 'Guest meals', kind: 'count', unit: 'meal', period: 'semester', optional: true, passive: true },
    },
    // Drexel is on quarters. Fall 2026 per the Provost's calendar: classes Sep 22, exams end Dec 12
    semStart: '2026-09-22',
    semEnd: '2026-12-12',
    aliases: ['Drexel', 'Dragons'],
    // Days with no classes (Fall 2026). Users choose whether they still eat on campus then.
    breaks: [
      { name: "Indigenous Peoples' Day", start: '2026-10-12', end: '2026-10-12' },
      { name: 'Election Day', start: '2026-11-03', end: '2026-11-03' },
      { name: 'Thanksgiving', start: '2026-11-25', end: '2026-11-29' },
    ],
    locations: [
      'Urban Eatery', 'Handschumacher Dining Center', 'Northside Dining Terrace', 'Chick-fil-A (Northside)',
      'Currito', 'Subway', 'Starbucks (LeBow)', 'Saxbys', 'Perelman Center for Jewish Life', "Sabrina's Café",
      'Market 16', 'Dragon Fly Café',
    ],
  },
  duq: {
    name: 'Duquesne University',
    buckets: {
      meals: { label: 'Meals', kind: 'count', unit: 'meal', period: 'semester',
               hint: 'Hogan swipe, or Meal Swipe Equivalency at Chick-fil-A / Cinco / The Incline' },
      flex:  { label: 'Flex Dollars', kind: 'money', period: 'semester', hint: 'Carry over within the year' },
      plus:  { label: 'PLUS Dollars', kind: 'money', period: 'semester', optional: true,
               hint: 'Bought separately; 10% bonus on load' },
    },
    // Fall 2026 per the academic calendar: classes Aug 24, finals end Dec 17
    semStart: '2026-08-24',
    semEnd: '2026-12-17',
    aliases: ['DU', 'Duquesne', 'Dukes'],
    // Days with no classes (Fall 2026). Users choose whether they still eat on campus then.
    breaks: [
      { name: 'Labor Day', start: '2026-09-07', end: '2026-09-07' },
      { name: 'Fall Class Break', start: '2026-10-19', end: '2026-10-20' },
      { name: 'Thanksgiving', start: '2026-11-23', end: '2026-11-29' },
    ],
    locations: [
      'Hogan Dining Center', 'Chick-fil-A', 'Cinco Cantina', 'The Incline', 'Campus Market (Towers)',
      'Campus Market Express (Fisher)', 'Coffee Tree Roasters (Law School)', 'Business Leader Bistro (Rockwell)',
      'Connections (Student Union)', 'Freshens', 'Moonlit', 'Starbucks',
    ],
  },
  villanova: {
    name: 'Villanova University',
    buckets: {
      meals:  { label: 'Meals', kind: 'count', unit: 'meal', period: 'week',
                hint: 'Dining hall or Meal Plan Express; weekly plans reset Monday' },
      points: { label: 'Points', kind: 'money', period: 'semester', hint: 'Any dining location plus Wawa' },
      guest:  { label: 'Guest meals', kind: 'count', unit: 'meal', period: 'semester', optional: true, passive: true },
      nova:   { label: 'Nova Bucks', kind: 'money', period: 'semester', optional: true,
                hint: 'Separate declining balance' },
    },
    // Fall 2026 per the 26–27 catalog: classes Aug 24, finals end Dec 18
    semStart: '2026-08-24',
    semEnd: '2026-12-18',
    aliases: ['Nova', 'Villanova', 'Wildcats'],
    // Days with no classes (Fall 2026). Users choose whether they still eat on campus then.
    breaks: [
      { name: 'Labor Day', start: '2026-09-07', end: '2026-09-07' },
      { name: 'Semester Recess', start: '2026-10-12', end: '2026-10-18' },
      { name: 'Thanksgiving', start: '2026-11-25', end: '2026-11-29' },
    ],
    locations: [
      'Dougherty Dining Hall', 'Donahue Dining Hall', "St. Mary's Dining Hall", 'The Pit (Dougherty)',
      'Belle Air Terrace (Connelly)', 'Second Storey Market', 'Café Nova', 'Holy Grounds', 'The Exchange (Commons)',
      'Cova', 'Wawa',
    ],
  },
  lehigh: {
    name: 'Lehigh University',
    buckets: {
      swipes: { label: 'Swipes', kind: 'count', unit: 'swipe', period: 'semester',
                hint: 'Rathbone / Brodhead, or Meal Exchange' },
      dd:     { label: 'Dining Dollars', kind: 'money', period: 'semester' },
      guest:  { label: 'Guest meals', kind: 'count', unit: 'meal', period: 'semester', optional: true, passive: true },
    },
    // Fall 2026 per the 26–27 catalog: classes Aug 24, finals end Dec 16. Pacing break dates are approximate
    semStart: '2026-08-24',
    semEnd: '2026-12-16',
    aliases: ['Lehigh', 'Mountain Hawks'],
    // Days with no classes (Fall 2026). Users choose whether they still eat on campus then.
    breaks: [
      { name: 'Labor Day', start: '2026-09-07', end: '2026-09-07' },
      { name: 'Pacing Break (approx)', start: '2026-10-12', end: '2026-10-13' },
      { name: 'Thanksgiving', start: '2026-11-25', end: '2026-11-29' },
    ],
    locations: [
      'Rathbone Dining Hall', 'Brodhead House Dining', 'Clayton University Center Food Court', "The Hawk's Nest",
      "Lucy's Café (Linderman)", 'Global Café (Williams)', 'The Grind at FML', 'Iacocca Café',
      'Lehigh University Pub', 'Food Trucks',
    ],
  },
  rutgers: {
    name: 'Rutgers–New Brunswick',
    buckets: {
      meals:     { label: 'Meals', kind: 'count', unit: 'meal', period: 'semester',
                   hint: 'Dining hall, takeout or retail (up to 3 retail/day); 10 usable for guests' },
      ruexpress: { label: 'RU Express', kind: 'money', period: 'semester', optional: true,
                   hint: 'Separate prepaid account' },
    },
    // Fall 2026 per the University calendar: classes Sep 1, exams end Dec 22
    semStart: '2026-09-01',
    semEnd: '2026-12-22',
    aliases: ['RU', 'Rutgers', 'Scarlet Knights', 'New Brunswick'],
    // Days with no classes (Fall 2026). Users choose whether they still eat on campus then.
    breaks: [
      { name: 'Labor Day', start: '2026-09-07', end: '2026-09-07' },
      { name: 'Thanksgiving', start: '2026-11-26', end: '2026-11-29' },
    ],
    locations: [
      'Busch Dining Hall', 'Livingston Dining Commons', 'Neilson Dining Hall', 'The Atrium (College Ave)',
      "Kilmer's Market", "Henry's Diner (Livingston)", "Woody's Café (Busch)", 'Sbarro (Busch Student Center)',
      'Starbucks (Livingston)', 'Harvest Café', 'Cook Café', 'Rock Café (Livingston)', 'Douglass Café',
    ],
  },
};

const SMALL = new Set(['a', 'an', 'and', 'at', 'by', 'de', 'del', 'di', 'n', 'of', 'the']);
function titleCase(s) {
  return s.split(' ').map((w, i) => {
    if (/^[A-Z]\.([A-Z]\.)+$/.test(w)) return w;                    // E.A.T.
    const lw = w.toLowerCase();
    if (i > 0 && SMALL.has(lw.replace(/[^a-z]/g, ''))) return lw;
    return lw.replace(/(^|[\-(])([a-z])/g, (m, p, c) => p + c.toUpperCase());
  }).join(' ');
}

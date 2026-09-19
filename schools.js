// School-specific config. Add a school here and it shows up in the picker.
// Each entry: semester dates, the name of the currency, and a list of dining
// locations for autocomplete. `fetchLocations` (optional) pulls a live list.
export const SCHOOLS = {
  cmu: {
    name: 'Carnegie Mellon',
    currency: 'Dining Dollars',
    // Fall 2026: first day of classes → last day of finals (26–27 academic calendar)
    semStart: '2026-08-31',
    semEnd: '2026-12-13',
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
    currency: 'Dining Dollars',
    // Fall 2026 (approximate — verify against Pitt's academic calendar)
    semStart: '2026-08-24',
    semEnd: '2026-12-12',
    locations: [
      'The Eatery (Towers)', 'The Perch (Sutherland)', 'Forbes Street Market', 'Cathedral Café',
      'Einstein Bros. Bagels (Posvar)', 'Einstein Bros. Bagels (Benedum)', 'Starbucks (Cathedral)',
      'Starbucks (Hillman)', 'Chick-fil-A', 'Steel City Salads', 'Panther Pizza', 'True Burger',
      'Wicked Pie', 'Pom & Honey', 'Burrito Bowl', 'Sushi Do', 'Common Grounds', 'Bunsen Bites',
      'Bottom Line Bistro', 'Saxbys', 'The Pete Grab & Go', 'Nordy\'s Place',
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

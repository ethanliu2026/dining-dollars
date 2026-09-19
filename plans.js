// GENERATED from plans.json by scripts/update_plans.py — do not edit by hand.
window.PLANS = {
  "cmu": {
    "source": "https://www.cmu.edu/dining/your-dining-plan/26-27-uc-meal-plan-agreementfinal.pdf",
    "verified": "2026-09-19",
    "note": "Upperclass pricing; first-year plans have the same blocks/FLEX at slightly higher cost.",
    "plans": [
      {
        "id": "green",
        "name": "Green Plan",
        "cost": 4314,
        "buckets": {
          "blocks": 292,
          "flex": 280
        },
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "blue",
        "name": "Blue Plan",
        "cost": 4084,
        "buckets": {
          "blocks": 252,
          "flex": 540
        },
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "red",
        "name": "Red Plan",
        "cost": 3868,
        "buckets": {
          "blocks": 205,
          "flex": 880
        },
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "yellow",
        "name": "Yellow Plan",
        "cost": 1884,
        "buckets": {
          "blocks": 125,
          "flex": 195
        },
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "tartan",
        "name": "Tartan Flex",
        "cost": 3373,
        "buckets": {
          "blocks": 170,
          "flex": 915
        },
        "who": "Community plan",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "scottys",
        "name": "Scotty's Choice",
        "cost": 1929,
        "buckets": {
          "blocks": 85,
          "flex": 655
        },
        "who": "Community plan",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "whitfields",
        "name": "Whitfield's Favor",
        "cost": 1317,
        "buckets": {
          "blocks": 54,
          "flex": 500
        },
        "who": "Community plan",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "piper",
        "name": "Piper Select",
        "cost": 854,
        "buckets": {
          "blocks": 32,
          "flex": 350
        },
        "who": "Community plan",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      }
    ],
    "eligibility": "First-years: Green, Blue (default) or Red; Yellow only for The Residence on Fifth / Clyde House. Community plans are for upperclass students."
  },
  "pitt": {
    "source": "https://dineoncampus.com/pitt/20262027-meal-memberships",
    "verified": "2026-09-19",
    "plans": [
      {
        "id": "fa500",
        "name": "Full-Access 500",
        "cost": 3515,
        "buckets": {
          "meals": {
            "amount": 0,
            "period": "unlimited"
          },
          "flexMeals": 10,
          "dd": 500
        },
        "who": "First-year / upperclass resident",
        "note": "Plus one Meal Exchange per day",
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "fa300",
        "name": "Full-Access 300",
        "cost": 3315,
        "buckets": {
          "meals": {
            "amount": 0,
            "period": "unlimited"
          },
          "flexMeals": 10,
          "dd": 300
        },
        "who": "First-year / upperclass resident",
        "note": "Plus one Meal Exchange per day",
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "fa150",
        "name": "Full-Access 150",
        "cost": 3165,
        "buckets": {
          "meals": {
            "amount": 0,
            "period": "unlimited"
          },
          "flexMeals": 10,
          "dd": 150
        },
        "who": "First-year / upperclass resident",
        "note": "Plus one Meal Exchange per day",
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "weekly14",
        "name": "Weekly 14",
        "cost": 3110,
        "buckets": {
          "meals": {
            "amount": 14,
            "period": "week"
          },
          "flexMeals": 10,
          "dd": 500
        },
        "who": "Resident",
        "note": "Meals reset Sunday 11:59 pm",
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "block145",
        "name": "Block 145",
        "cost": 2375,
        "buckets": {
          "meals": 145,
          "flexMeals": 5,
          "dd": 400
        },
        "who": "Upperclass resident / commuter",
        "note": "Up to 5 meals per day",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "block90",
        "name": "Block 90",
        "cost": 1650,
        "buckets": {
          "meals": 90,
          "dd": 325
        },
        "who": "Upperclass resident / commuter",
        "note": "Up to 5 meals per day",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "block50",
        "name": "Block 50",
        "cost": 1000,
        "buckets": {
          "meals": 50,
          "dd": 200
        },
        "who": "Commuter / grad",
        "note": "Up to 5 meals per day",
        "eligible": [
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "allday75",
        "name": "75 All-Day Access",
        "cost": 2855,
        "buckets": {
          "meals": 75,
          "dd": 150
        },
        "who": "Commuter / grad",
        "note": "Each meal = one all-day dining hall pass",
        "eligible": [
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "allday40",
        "name": "40 All-Day Access",
        "cost": 1690,
        "buckets": {
          "meals": 40,
          "dd": 150
        },
        "who": "Commuter / grad",
        "note": "Each meal = one all-day dining hall pass",
        "eligible": [
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "dd500",
        "name": "$500 Plan",
        "cost": 500,
        "buckets": {
          "dd": 500
        },
        "who": "Commuter / grad",
        "eligible": [
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "dd350",
        "name": "$350 Plan",
        "cost": 350,
        "buckets": {
          "dd": 350
        },
        "who": "Commuter / grad",
        "eligible": [
          "apartment",
          "commuter"
        ]
      }
    ],
    "eligibility": "Residence-hall first-years take a Full-Access or Weekly 14 plan; apartment residents are assigned Block 100-style plans but can pick any; commuters can choose any."
  },
  "psu": {
    "source": "https://liveon.psu.edu/university-park/meal-plans",
    "verified": "2026-09-19",
    "note": "University Park. Campus Meal Plan price includes a $1,750 base cost; only the dining dollars are spendable.",
    "plans": [
      {
        "id": "campus1",
        "name": "Campus Meal Plan – Level 1",
        "cost": 2737,
        "buckets": {
          "dd": 987
        },
        "who": "On-campus resident",
        "note": "$987 spendable + $1,750 base cost",
        "eligible": [
          "firstYear",
          "resident",
          "apartment"
        ]
      },
      {
        "id": "campus2",
        "name": "Campus Meal Plan – Level 2",
        "cost": 2988,
        "buckets": {
          "dd": 1238
        },
        "who": "On-campus resident",
        "note": "$1,238 spendable + $1,750 base cost",
        "eligible": [
          "firstYear",
          "resident",
          "apartment"
        ]
      },
      {
        "id": "campus3",
        "name": "Campus Meal Plan – Level 3",
        "cost": 3218,
        "buckets": {
          "dd": 1468
        },
        "who": "On-campus resident",
        "note": "$1,468 spendable + $1,750 base cost",
        "eligible": [
          "firstYear",
          "resident",
          "apartment"
        ]
      },
      {
        "id": "commuter1",
        "name": "Commuter Meal Plan – Level 1",
        "cost": 250,
        "buckets": {
          "dd": 250
        },
        "who": "Off-campus",
        "note": "10% off prepared food",
        "eligible": [
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "commuter2",
        "name": "Commuter Meal Plan – Level 2",
        "cost": 500,
        "buckets": {
          "dd": 500
        },
        "who": "Off-campus",
        "eligible": [
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "commuter3",
        "name": "Commuter Meal Plan – Level 3",
        "cost": 1000,
        "buckets": {
          "dd": 1000
        },
        "who": "Off-campus",
        "eligible": [
          "apartment",
          "commuter"
        ]
      }
    ],
    "eligibility": "Campus Meal Plan is required with an on-campus housing contract (apartments with kitchens may opt out). Commuter plans are for off-campus students."
  },
  "temple": {
    "source": "https://temple.mydininghub.com/en/meal-plans/meal-plan-options",
    "verified": "2026-09-19",
    "plans": [
      {
        "id": "unlimited",
        "name": "Unlimited",
        "cost": 2784,
        "buckets": {
          "meals": {
            "amount": 0,
            "period": "unlimited"
          },
          "guest": 5
        },
        "note": "Up to 21 retail meals/week",
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "weekly15",
        "name": "Weekly 15",
        "cost": 2621,
        "buckets": {
          "meals": {
            "amount": 15,
            "period": "week"
          },
          "guest": 5
        },
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "weekly12",
        "name": "Weekly 12",
        "cost": 2389,
        "buckets": {
          "meals": {
            "amount": 12,
            "period": "week"
          },
          "guest": 5
        },
        "who": "First-year default",
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "weekly10",
        "name": "Weekly 10",
        "cost": 2042,
        "buckets": {
          "meals": {
            "amount": 10,
            "period": "week"
          },
          "guest": 3
        },
        "who": "Returning / off-campus",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "weekly5",
        "name": "Weekly 5",
        "cost": 1057,
        "buckets": {
          "meals": {
            "amount": 5,
            "period": "week"
          }
        },
        "who": "Returning / off-campus",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "block100",
        "name": "Block 100",
        "cost": 1266,
        "buckets": {
          "meals": 100
        },
        "who": "Returning / off-campus",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "block50",
        "name": "Block 50",
        "cost": 668,
        "buckets": {
          "meals": 50
        },
        "who": "Returning / off-campus",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      }
    ],
    "eligibility": "First-year and transfer residents need at least Weekly 12. Everyone else can choose any plan."
  },
  "penn": {
    "source": "https://dining.business-services.upenn.edu/dining-plans/transfer-exchange-upperclass",
    "verified": "2026-09-19",
    "note": "Priced annually; shown per semester (half).",
    "plans": [
      {
        "id": "fy296",
        "name": "First-Year 296",
        "cost": 3480,
        "buckets": {
          "swipes": 296,
          "dd": 125,
          "guest": 10
        },
        "who": "First / second-year",
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "fy187",
        "name": "First-Year 187",
        "cost": 3480,
        "buckets": {
          "swipes": 187,
          "dd": 400,
          "guest": 10
        },
        "who": "First / second-year",
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "sy156",
        "name": "Second-Year 156",
        "cost": 2357,
        "buckets": {
          "swipes": 156,
          "dd": 300,
          "guest": 10
        },
        "who": "Second-year",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "uc108",
        "name": "Upperclass 108",
        "cost": 2570,
        "buckets": {
          "swipes": 108,
          "dd": 600
        },
        "who": "Upperclass",
        "eligible": [
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "uc78",
        "name": "Upperclass 78",
        "cost": 1595,
        "buckets": {
          "swipes": 78,
          "dd": 175
        },
        "who": "Upperclass",
        "eligible": [
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "uc47",
        "name": "Upperclass 47",
        "cost": 1404,
        "buckets": {
          "swipes": 47,
          "dd": 525
        },
        "who": "Upperclass",
        "eligible": [
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "ddonly",
        "name": "Dining Dollars Only",
        "cost": 1600,
        "buckets": {
          "dd": 1600
        },
        "who": "Upperclass / grad",
        "eligible": [
          "apartment",
          "commuter"
        ]
      }
    ],
    "eligibility": "First-years choose 296 or 187; second-years may also take 156; juniors and seniors can choose anything or opt out."
  },
  "drexel": {
    "source": "https://drexel.mydininghub.com/en/dining-plans/dining-plan-options",
    "verified": "2026-09-19",
    "note": "Per term (Drexel is on quarters).",
    "plans": [
      {
        "id": "weekly14",
        "name": "Weekly 14 + 250",
        "cost": 2275,
        "buckets": {
          "meals": {
            "amount": 14,
            "period": "week"
          },
          "dd": 250,
          "guest": 2
        },
        "who": "First-year / upperclass",
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "aa225",
        "name": "All Access + 225",
        "cost": 2450,
        "buckets": {
          "meals": {
            "amount": 0,
            "period": "unlimited"
          },
          "dd": 225,
          "guest": 2
        },
        "who": "First-year / upperclass",
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "aa400",
        "name": "All Access + 400",
        "cost": 2640,
        "buckets": {
          "meals": {
            "amount": 0,
            "period": "unlimited"
          },
          "dd": 400,
          "guest": 2
        },
        "who": "First-year / upperclass",
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "block25",
        "name": "Block 25 + 200",
        "cost": 570,
        "buckets": {
          "meals": 25,
          "dd": 200
        },
        "who": "Upperclass / grad",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "block50",
        "name": "Block 50 + 350",
        "cost": 1020,
        "buckets": {
          "meals": 50,
          "dd": 350
        },
        "who": "Upperclass / grad",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "block80",
        "name": "Block 80 + 500",
        "cost": 1470,
        "buckets": {
          "meals": 80,
          "dd": 500
        },
        "who": "Upperclass / grad",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "dd150",
        "name": "150 Dining Dollars",
        "cost": 150,
        "buckets": {
          "dd": 150
        },
        "who": "Upperclass / grad",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "dd250",
        "name": "250 Dining Dollars",
        "cost": 250,
        "buckets": {
          "dd": 250
        },
        "who": "Upperclass / grad",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "dd500",
        "name": "500 Dining Dollars",
        "cost": 500,
        "buckets": {
          "dd": 500
        },
        "who": "Upperclass / grad",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "dd800",
        "name": "800 Dining Dollars",
        "cost": 800,
        "buckets": {
          "dd": 800
        },
        "who": "Upperclass / grad",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      }
    ],
    "eligibility": "First-years choose Weekly 14 or an All Access plan; upperclass and grad students can choose any."
  },
  "duq": {
    "source": "https://duquesnedining.nutrislice.com/meal-plans",
    "verified": "2026-09-19",
    "note": "Prices from the 2026–27 catalog (Room and Board).",
    "plans": [
      {
        "id": "platinum",
        "name": "Platinum",
        "cost": 3944,
        "buckets": {
          "meals": 275,
          "flex": 200
        },
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "gold",
        "name": "Gold",
        "cost": 3944,
        "buckets": {
          "meals": 225,
          "flex": 275
        },
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "silver",
        "name": "Silver",
        "cost": 3944,
        "buckets": {
          "meals": 200,
          "flex": 375
        },
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "bronze",
        "name": "Bronze",
        "cost": 3944,
        "buckets": {
          "meals": 175,
          "flex": 400
        },
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "super",
        "name": "Super",
        "cost": 4169,
        "buckets": {
          "meals": 175,
          "flex": 700
        },
        "note": "+$225/semester",
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      }
    ],
    "eligibility": "All residence-hall students choose one of the four plans (or Super); no first-year restriction."
  },
  "villanova": {
    "source": "https://www.villanova.edu/university/dining/meal-plans.html",
    "verified": "2026-09-19",
    "plans": [
      {
        "id": "anytime7",
        "name": "Any Time 7 Day",
        "cost": 4860,
        "buckets": {
          "meals": {
            "amount": 0,
            "period": "unlimited"
          },
          "points": 150,
          "guest": 10
        },
        "who": "First-year",
        "note": "14 Meal Plan Express/week",
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "meal21",
        "name": "21 Meal Plan",
        "cost": 4520,
        "buckets": {
          "meals": {
            "amount": 21,
            "period": "week"
          },
          "points": 135,
          "guest": 10
        },
        "who": "First-year / resident",
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "meal14",
        "name": "14 Meal Plan",
        "cost": 4075,
        "buckets": {
          "meals": {
            "amount": 14,
            "period": "week"
          },
          "points": 150,
          "guest": 10
        },
        "who": "Second-year+",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "meal10",
        "name": "10 Meal Plan",
        "cost": 3660,
        "buckets": {
          "meals": {
            "amount": 10,
            "period": "week"
          },
          "points": 420,
          "guest": 25
        },
        "who": "Second-year+",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "block100",
        "name": "100 Block Plan",
        "cost": 2755,
        "buckets": {
          "meals": 100,
          "points": 500,
          "guest": 25
        },
        "who": "Apartments / suites",
        "eligible": [
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "commuter",
        "name": "Commuter Plan",
        "cost": 1450,
        "buckets": {
          "meals": {
            "amount": 5,
            "period": "week"
          },
          "points": 170,
          "guest": 12
        },
        "who": "Commuter",
        "note": "Breakfast or lunch only",
        "eligible": [
          "commuter"
        ]
      }
    ],
    "eligibility": "First-years: Any Time 7 or 21 Meal Plan. Second-years add 14 and 10. Apartments/suites (third year+) may take the 100 Block or opt out. Commuter Plan is for off-campus students."
  },
  "lehigh": {
    "source": "https://lehigh.sodexomyway.com/en-us/meal-plan/meal-plan-options",
    "verified": "2026-09-19",
    "plans": [
      {
        "id": "aa7",
        "name": "All Access 7",
        "cost": 4675,
        "buckets": {
          "swipes": {
            "amount": 0,
            "period": "unlimited"
          },
          "dd": 375,
          "guest": 5
        },
        "who": "First-year",
        "note": "10 Meal Exchanges/week",
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "block240",
        "name": "240 Block",
        "cost": 3880,
        "buckets": {
          "swipes": 240,
          "dd": 525,
          "guest": 3
        },
        "who": "First-year",
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "block220",
        "name": "220 Block",
        "cost": 3880,
        "buckets": {
          "swipes": 220,
          "dd": 650
        },
        "who": "First-year",
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "block180",
        "name": "180 Block",
        "cost": 3520,
        "buckets": {
          "swipes": 180,
          "dd": 900
        },
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "block160",
        "name": "160 Block",
        "cost": 3520,
        "buckets": {
          "swipes": 160,
          "dd": 1185
        },
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "block80",
        "name": "80 Block",
        "cost": 1845,
        "buckets": {
          "swipes": 80,
          "dd": 650
        },
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "block40",
        "name": "40 Block",
        "cost": 1370,
        "buckets": {
          "swipes": 40,
          "dd": 750
        },
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "ddplan",
        "name": "Dining Dollar Plan",
        "cost": 1000,
        "buckets": {
          "dd": 1050
        },
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      }
    ],
    "eligibility": "First-years choose All Access 7, 240 Block or 220 Block. Others can choose any plan."
  },
  "rutgers": {
    "source": "https://food.rutgers.edu/meal-plans",
    "verified": "2026-09-19",
    "note": "New Brunswick, Fall 2026 – Spring 2027 rates.",
    "plans": [
      {
        "id": "unlimited",
        "name": "Scarlet Unlimited",
        "cost": 3918,
        "buckets": {
          "meals": {
            "amount": 0,
            "period": "unlimited"
          }
        },
        "note": "Plus up to 3 retail/takeout meals per day",
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "plan255",
        "name": "255 Plan",
        "cost": 3779,
        "buckets": {
          "meals": 255
        },
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "plan210",
        "name": "210 Plan",
        "cost": 3532,
        "buckets": {
          "meals": 210
        },
        "who": "First-year minimum",
        "eligible": [
          "firstYear",
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "plan150",
        "name": "150 Plan",
        "cost": 3337,
        "buckets": {
          "meals": 150
        },
        "who": "Upperclass minimum",
        "eligible": [
          "resident",
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "plan100",
        "name": "100 Plan",
        "cost": 2114,
        "buckets": {
          "meals": 100
        },
        "who": "Apartments / commuter",
        "eligible": [
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "plan75",
        "name": "75 Plan",
        "cost": 1642,
        "buckets": {
          "meals": 75
        },
        "who": "Apartments / commuter",
        "eligible": [
          "apartment",
          "commuter"
        ]
      },
      {
        "id": "plan50",
        "name": "50 Plan",
        "cost": 1220,
        "buckets": {
          "meals": 50
        },
        "who": "Apartments / commuter",
        "eligible": [
          "apartment",
          "commuter"
        ]
      }
    ],
    "eligibility": "Residence-hall first-years need at least the 210 Plan; upperclass residents at least 150. Apartments and commuters can choose any, including 100/75/50."
  }
};

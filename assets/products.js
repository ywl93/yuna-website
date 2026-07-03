/* =============================================================================
   Yúna Tea — Product catalog (DISPLAY data only)
   -----------------------------------------------------------------------------
   Single source of truth for what customers SEE (names, copy, images, and the
   indicative prices shown on the pages).

   IMPORTANT: money is authoritative in STRIPE, not here. Each variant's `price`
   is only for display. The real amount charged comes from the Stripe Price whose
   ID is wired up (by variant key) in netlify/functions/create-checkout.js via
   Netlify environment variables (see SETUP.md).

   Each tea is sold in two sizes ("variants"): Single (1 box) and Set of 3.
   ========================================================================== */

window.YUNA = window.YUNA || {};

window.YUNA.currency = 'HKD';
window.YUNA.currencySymbol = 'HK$';

// Health benefits are the same for both teas (per the pu'erh benefits list).
var PUERH_BENEFITS = [
  'In traditional Chinese medicine, pu’erh is valued for clearing “dampness” and “heat”, leading to internal balance and harmony.',
  'Enjoyed during and after meals, pu’erh helps refresh the body after eating.',
  'Taken in the morning or between meals, pu’erh is a gentle option leading to smooth and sustained awareness, with half the caffeine content of coffee.',
];

window.YUNA.products = [
  {
    id: 'imperial-puerh',
    name: "Imperial Pu'erh Tea",
    category: "Pu'erh Tea",
    url: 'product-imperial-puerh.html',

    images: [
      'assets/products/imperial-puerh-1.jpg',  // packaging: box + sachet
      'assets/products/imperial-puerh-2.jpg',  // brewed cup
    ],

    pitch: 'Warming and balancing, our earthy Pu’erh tea is perfect for morning vitality or relieving afternoon fatigue.',
    netWeight: '40g (2g × 20 tea bags)',
    healthBenefits: PUERH_BENEFITS,

    variants: [
      { key: 'single', label: 'Single',   sub: '1 box',   price: 55  },
      { key: 'pack3',  label: 'Set of 3', sub: '3 boxes', price: 150 },
    ],
  },

  {
    id: 'imperial-puerh-goji',
    name: "Imperial Pu'erh Tea with Goji",
    category: "Pu'erh Tea",
    url: 'product-imperial-puerh-goji.html',

    images: [
      'assets/products/imperial-puerh-goji-1.jpg', // packaging: box + sachet
      'assets/products/imperial-puerh-goji-2.jpg', // brewed cup
    ],

    pitch: 'Warming and balancing, our blend of earthy Pu’erh tea with dried goji is perfect for morning vitality or relieving afternoon fatigue.',
    netWeight: '50g (2.5g × 20 tea bags)',
    healthBenefits: PUERH_BENEFITS,

    variants: [
      { key: 'single', label: 'Single',   sub: '1 box',   price: 55  },
      { key: 'pack3',  label: 'Set of 3', sub: '3 boxes', price: 150 },
    ],
  },
];

window.YUNA.productById = window.YUNA.products.reduce(function (map, p) {
  map[p.id] = p;
  return map;
}, {});

window.YUNA.getVariant = function (id, variantKey) {
  var p = window.YUNA.productById[id];
  if (!p) return null;
  var v = (p.variants || []).filter(function (x) { return x.key === variantKey; })[0];
  return v || (p.variants && p.variants[0]) || null;
};

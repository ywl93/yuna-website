/* =============================================================================
   Yúna Tea — Product catalog (DISPLAY data only)
   -----------------------------------------------------------------------------
   Single source of truth for what customers SEE (names, copy, images, and the
   indicative prices shown on the pages).

   IMPORTANT: money is authoritative in STRIPE, not here. Each variant's `price`
   below is only for display. The real amount charged comes from the Stripe Price
   whose ID is wired up (by variant key) in netlify/functions/create-checkout.js
   via Netlify environment variables (see SETUP.md). Editing a number here never
   changes what a customer is charged.

   Each tea is sold in two sizes ("variants"): Single and Set of 3.

   >>> Fill in the remaining "TODO" copy/photos once ready. <<<
   ========================================================================== */

window.YUNA = window.YUNA || {};

window.YUNA.currency = 'HKD';
window.YUNA.currencySymbol = 'HK$';

window.YUNA.products = [
  {
    id: 'imperial-puerh',                      // canonical key — used by the cart + checkout function
    name: "Imperial Pu'erh Tea",
    category: "Pu'erh Tea",
    url: 'product-imperial-puerh.html',

    images: [
      'assets/products/imperial-puerh-1.jpg',  // TODO: add real photo (missing files fall back to a placeholder)
    ],

    shortDesc: 'TODO: one or two lines that sit next to the price — the quick pitch.',
    longDesc:  'TODO: the full description for the "Description" tab.',
    details: [
      ['Form',    'TODO'],   // e.g. loose leaf / cake / tuo cha
      ['Origin',  'TODO'],
      ['Harvest', 'TODO'],
    ],
    brewing: 'TODO: brewing guidance — water temperature, leaf amount, steep times, infusions.',

    // Sizes. `key` must match the checkout function's price map + Netlify env vars.
    variants: [
      { key: 'single', label: 'Single',   sub: '1 box',    price: 55  },
      { key: 'pack3',  label: 'Set of 3', sub: '3 boxes',  price: 150 },
    ],
  },

  {
    id: 'imperial-puerh-goji',
    name: "Imperial Pu'erh Tea with Goji",
    category: "Pu'erh Tea",
    url: 'product-imperial-puerh-goji.html',

    images: [
      'assets/products/imperial-puerh-goji-1.jpg', // TODO: add real photo
    ],

    shortDesc: 'TODO: quick pitch for the goji blend.',
    longDesc:  'TODO: full description — how the goji berries round out the pu\'erh.',
    details: [
      ['Form',   'TODO'],
      ['Blend',  'TODO'],   // e.g. pu'erh + goji berry
      ['Origin', 'TODO'],
    ],
    brewing: 'TODO: brewing guidance for the goji blend.',

    variants: [
      { key: 'single', label: 'Single',   sub: '1 box',   price: 55  },
      { key: 'pack3',  label: 'Set of 3', sub: '3 boxes', price: 150 },
    ],
  },
];

// Convenience lookups.
window.YUNA.productById = window.YUNA.products.reduce(function (map, p) {
  map[p.id] = p;
  return map;
}, {});

// Resolve a variant object for a product id + variant key (falls back to first variant).
window.YUNA.getVariant = function (id, variantKey) {
  var p = window.YUNA.productById[id];
  if (!p) return null;
  var v = (p.variants || []).filter(function (x) { return x.key === variantKey; })[0];
  return v || (p.variants && p.variants[0]) || null;
};

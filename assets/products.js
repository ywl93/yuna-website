/* =============================================================================
   Yúna Tea — Product catalog (DISPLAY data only)
   -----------------------------------------------------------------------------
   This is the single source of truth for what customers SEE (names, copy,
   images, and an indicative price shown on the pages).

   IMPORTANT: money is authoritative in STRIPE, not here. The price below is
   only for display. The real amount charged comes from the Stripe Price you
   create in the Stripe Dashboard and wire up in netlify/functions/create-checkout.js
   (see SETUP.md). Editing a number here never changes what a customer is charged.

   >>> Fill in every "TODO" once product specifics are ready. <<<
   ========================================================================== */

window.YUNA = window.YUNA || {};

// Currency shown on the pages. Keep in sync with the currency of your Stripe Prices.
window.YUNA.currency = 'HKD';
window.YUNA.currencySymbol = 'HK$';

window.YUNA.products = [
  {
    id: 'imperial-puerh',                      // canonical key — used by the cart + the checkout function. Do not change lightly.
    sku: 'YUNA-PUERH-01',                      // TODO: confirm your real SKU (display/reference only)
    name: "Imperial Pu'erh Tea",
    category: "Pu'erh Tea",
    url: 'product-imperial-puerh.html',

    // Indicative display price in MAJOR units (e.g. 388 = HK$388). Use null to show "Price on request".
    price: null,                               // TODO: set price (display only — Stripe is authoritative)

    // 1–3 photos. Files go in assets/products/. Missing files fall back to a placeholder automatically.
    images: [
      'assets/products/imperial-puerh-1.jpg',  // TODO: add real photo
    ],

    shortDesc: 'TODO: one or two lines that sit next to the price — the quick pitch.',
    longDesc:  'TODO: the full description for the "Description" tab. A few sentences on the tea, its character, aroma, and story.',

    // Rows for the "Details" tab — [label, value] pairs. Add/remove freely.
    details: [
      ['Weight',   'TODO'],
      ['Form',     'TODO'],   // e.g. loose leaf / cake / tuo cha
      ['Origin',   'TODO'],
      ['Harvest',  'TODO'],
    ],

    // "Brewing" tab.
    brewing: 'TODO: brewing guidance — water temperature, leaf amount, steep times, number of infusions.',
  },

  {
    id: 'imperial-puerh-goji',
    sku: 'YUNA-PUERH-GOJI-01',                 // TODO: confirm real SKU
    name: "Imperial Pu'erh Tea with Goji",
    category: "Pu'erh Tea",
    url: 'product-imperial-puerh-goji.html',

    price: null,                               // TODO: set price (display only)

    images: [
      'assets/products/imperial-puerh-goji-1.jpg', // TODO: add real photo
    ],

    shortDesc: 'TODO: quick pitch for the goji blend.',
    longDesc:  'TODO: full description — how the goji berries round out the pu\'erh, flavour notes, etc.',

    details: [
      ['Weight',   'TODO'],
      ['Form',     'TODO'],
      ['Blend',    'TODO'],   // e.g. pu'erh + goji berry
      ['Origin',   'TODO'],
    ],

    brewing: 'TODO: brewing guidance for the goji blend.',
  },
];

// Convenience lookup by id.
window.YUNA.productById = window.YUNA.products.reduce(function (map, p) {
  map[p.id] = p;
  return map;
}, {});

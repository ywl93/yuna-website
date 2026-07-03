/* =============================================================================
   Yúna Tea — Stripe Checkout session creator (Netlify Function)
   -----------------------------------------------------------------------------
   The browser cart POSTs { items: [{ id, qty }] } here. This function is the
   ONLY place that decides what a customer pays: it maps each product id to a
   Stripe Price ID (configured in the Stripe Dashboard) and never trusts a
   price from the browser.

   Required environment variables (set these in Netlify → Site settings →
   Environment variables — see SETUP.md):
     STRIPE_SECRET_KEY                  your Stripe secret key (sk_test_… / sk_live_…)
     STRIPE_PRICE_IMPERIAL_PUERH        Price ID for "Imperial Pu'erh Tea"
     STRIPE_PRICE_IMPERIAL_PUERH_GOJI   Price ID for "Imperial Pu'erh Tea with Goji"
   ========================================================================== */

const Stripe = require('stripe');

// product id (from assets/products.js)  ->  Stripe Price ID (from env)
const PRICE_IDS = {
  'imperial-puerh': process.env.STRIPE_PRICE_IMPERIAL_PUERH,
  'imperial-puerh-goji': process.env.STRIPE_PRICE_IMPERIAL_PUERH_GOJI,
};

// TODO (shipping): countries you ship to. Trim/expand as needed.
const SHIP_TO = ['HK', 'CN', 'TW', 'MO', 'SG', 'GB', 'US', 'CA', 'AU'];

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return json(500, { error: 'Store is not fully configured yet (missing STRIPE_SECRET_KEY).' });
  }
  const stripe = Stripe(secret);

  // Parse the cart
  let items;
  try {
    items = JSON.parse(event.body || '{}').items;
  } catch (e) {
    return json(400, { error: 'Could not read the cart.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return json(400, { error: 'Your cart is empty.' });
  }

  // Build line items from trusted server-side Price IDs
  const line_items = [];
  for (const it of items) {
    const priceId = PRICE_IDS[it && it.id];
    let qty = parseInt(it && it.qty, 10);
    if (isNaN(qty) || qty < 1) qty = 1;
    if (qty > 99) qty = 99;

    if (!priceId) {
      return json(400, {
        error: 'One of the items is not available for purchase yet. Please contact sales@yuna-tea.com.',
      });
    }
    line_items.push({ price: priceId, quantity: qty });
  }

  // Where to send the customer back to
  const origin =
    event.headers.origin ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    (event.headers.host ? 'https://' + event.headers.host : '');

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: origin + '/order-confirmed.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: origin + '/checkout-cancelled.html',
      // Collect a shipping address for physical goods
      shipping_address_collection: { allowed_countries: SHIP_TO },
      phone_number_collection: { enabled: true },
      billing_address_collection: 'auto',
      allow_promotion_codes: true,

      // TODO (shipping rates): to charge shipping, create a Shipping Rate in the
      // Stripe Dashboard and reference it here, e.g.:
      // shipping_options: [{ shipping_rate: 'shr_xxx' }],

      // Payment methods (card, Apple/Google Pay, Alipay, WeChat Pay) are taken
      // from what you enable in the Stripe Dashboard — no need to list them here.
    });

    return json(200, { url: session.url });
  } catch (err) {
    return json(500, { error: err && err.message ? err.message : 'Could not start checkout.' });
  }
};

/* =============================================================================
   Yúna Tea — Stripe Checkout session creator (Netlify Function)
   -----------------------------------------------------------------------------
   The browser cart POSTs { items: [{ id, variant, qty }] } here. This function
   is the ONLY place that decides what a customer pays: it maps each
   product+variant to a Stripe Price ID (configured in the Stripe Dashboard) and
   never trusts a price from the browser.

   Required environment variables (set in Netlify → Site configuration →
   Environment variables — see SETUP.md):
     STRIPE_SECRET_KEY                 your Stripe secret key (sk_test_… / sk_live_…)
     STRIPE_PRICE_PUERH_SINGLE        Price ID — Imperial Pu'erh Tea, Single
     STRIPE_PRICE_PUERH_PACK3         Price ID — Imperial Pu'erh Tea, Set of 3
     STRIPE_PRICE_PUERH_GOJI_SINGLE   Price ID — Imperial Pu'erh Tea with Goji, Single
     STRIPE_PRICE_PUERH_GOJI_PACK3    Price ID — Imperial Pu'erh Tea with Goji, Set of 3
   ========================================================================== */

const Stripe = require('stripe');

// "<product id>:<variant key>"  ->  Stripe Price ID (from env)
const PRICE_IDS = {
  'imperial-puerh:single':      process.env.STRIPE_PRICE_PUERH_SINGLE,
  'imperial-puerh:pack3':       process.env.STRIPE_PRICE_PUERH_PACK3,
  'imperial-puerh-goji:single': process.env.STRIPE_PRICE_PUERH_GOJI_SINGLE,
  'imperial-puerh-goji:pack3':  process.env.STRIPE_PRICE_PUERH_GOJI_PACK3,
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
    const key = (it && it.id) + ':' + (it && it.variant);
    const priceId = PRICE_IDS[key];
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
      shipping_address_collection: { allowed_countries: SHIP_TO },
      phone_number_collection: { enabled: true },
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
      // TODO (shipping rates): shipping_options: [{ shipping_rate: 'shr_xxx' }],
    });

    return json(200, { url: session.url });
  } catch (err) {
    return json(500, { error: err && err.message ? err.message : 'Could not start checkout.' });
  }
};

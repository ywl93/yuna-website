/* =============================================================================
   Yúna Tea — Order alert email (Netlify Function, Stripe webhook)
   -----------------------------------------------------------------------------
   Stripe calls this endpoint on every completed checkout. It verifies the
   webhook signature, then emails a formatted order summary to the Yúna inbox
   via Resend.

   WHY THIS EXISTS: Stripe's built-in "successful payment" notifications go to a
   team member's *login email*, and one person (one login) can't route to two
   different inboxes across the Gaia + Yúna accounts. This webhook is the Yúna
   account's OWN alert, so it always — and only — notifies ORDER_ALERT_TO. No
   dependence on Stripe logins.

   Required environment variables (Netlify → Site configuration → Environment
   variables — see SETUP.md):
     STRIPE_SECRET_KEY      already set — used to fetch the order's line items
     STRIPE_WEBHOOK_SECRET  whsec_…  — the signing secret of the Stripe webhook
                                       endpoint you create (see SETUP.md)
     RESEND_API_KEY         re_…     — from resend.com
     ORDER_ALERT_FROM       verified sender, e.g. "Yuna Tea Orders
                                       <orders@send.yuna-tea.com>" (must match a
                                       domain you verified in Resend)
     ORDER_ALERT_TO         where alerts go (default: sales@yuna-tea.com)
   ========================================================================== */

const Stripe = require('stripe');

const ALERT_TO   = process.env.ORDER_ALERT_TO   || 'sales@yuna-tea.com';
const ALERT_FROM = process.env.ORDER_ALERT_FROM || 'Yuna Tea Orders <orders@send.yuna-tea.com>';

// Format a Stripe minor-unit amount (e.g. 18000) as "HKD 180.00".
function money(amount, currency) {
  const v = (amount || 0) / 100;
  return (currency || 'hkd').toUpperCase() + ' ' + v.toFixed(2);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const resendKey = process.env.RESEND_API_KEY;
  if (!secret || !webhookSecret || !resendKey) {
    // Loud on purpose: you'll see this in the Stripe webhook logs while wiring up.
    return { statusCode: 500, body: 'Order alerts not fully configured (missing STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, or RESEND_API_KEY).' };
  }
  const stripe = Stripe(secret);

  // Stripe verifies against the EXACT raw body — decode base64 if Netlify encoded it.
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    return { statusCode: 400, body: 'Webhook signature verification failed: ' + (err && err.message) };
  }

  // We only alert on completed checkouts; acknowledge everything else so Stripe
  // doesn't retry.
  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: 'ignored: ' + stripeEvent.type };
  }

  const session = stripeEvent.data.object;

  // Line items (product names + quantities) aren't in the event payload — fetch them.
  let lineItems = [];
  try {
    const res = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
    lineItems = res.data || [];
  } catch (e) {
    // Non-fatal — still send the alert with the totals we already have.
  }

  const cust = session.customer_details || {};
  const ship = session.shipping_details
    || (session.collected_information && session.collected_information.shipping_details)
    || null;
  const addr = (ship && ship.address) || cust.address || null;

  const test = stripeEvent.livemode ? '' : '/test';
  const pi = typeof session.payment_intent === 'string' ? session.payment_intent : null;
  const dashUrl = pi ? 'https://dashboard.stripe.com' + test + '/payments/' + pi : null;

  const td = session.total_details || {};

  // ---- Plain-text body (deliverability + fallback) -------------------------
  const itemLinesText = lineItems.length
    ? lineItems.map((li) => '  • ' + li.description + ' × ' + li.quantity + '  —  ' + money(li.amount_total, session.currency)).join('\n')
    : '  (line items unavailable — see Stripe dashboard)';

  const addrText = addr
    ? [ (ship && ship.name) || cust.name, addr.line1, addr.line2,
        [addr.postal_code, addr.city].filter(Boolean).join(' '), addr.state, addr.country ]
        .filter(Boolean).join('\n    ')
    : '  (no shipping address collected)';

  const text = [
    'New Yúna Tea order' + (stripeEvent.livemode ? '' : '  [TEST MODE]'),
    '',
    'Total paid:  ' + money(session.amount_total, session.currency),
    (td.amount_shipping != null ? 'Shipping:    ' + money(td.amount_shipping, session.currency) : null),
    '',
    'Customer:',
    '    ' + (cust.name || '(no name)'),
    '    ' + (cust.email || '(no email)'),
    '    ' + (cust.phone || '(no phone)'),
    '',
    'Items:',
    itemLinesText,
    '',
    'Ship to:',
    '    ' + addrText,
    '',
    (dashUrl ? 'View in Stripe: ' + dashUrl : null),
    'Order ref: ' + session.id,
  ].filter((l) => l !== null).join('\n');

  // ---- HTML body -----------------------------------------------------------
  const itemRows = (lineItems.length ? lineItems : []).map((li) =>
    '<tr>'
    + '<td style="padding:6px 0;border-bottom:1px solid #eee;">' + esc(li.description) + ' <span style="color:#888;">× ' + esc(li.quantity) + '</span></td>'
    + '<td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">' + esc(money(li.amount_total, session.currency)) + '</td>'
    + '</tr>').join('');

  const html = [
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;">',
    (stripeEvent.livemode ? '' : '<p style="background:#fff4d6;border-radius:6px;padding:8px 12px;font-size:13px;">⚠︎ TEST MODE order</p>'),
    '<h2 style="margin:0 0 4px;">New Yúna Tea order</h2>',
    '<p style="font-size:22px;font-weight:700;margin:0 0 16px;">' + esc(money(session.amount_total, session.currency)) + '</p>',
    '<table style="width:100%;border-collapse:collapse;font-size:14px;">' + itemRows,
    (td.amount_shipping != null
      ? '<tr><td style="padding:6px 0;color:#666;">Shipping</td><td style="padding:6px 0;text-align:right;color:#666;">' + esc(money(td.amount_shipping, session.currency)) + '</td></tr>'
      : ''),
    '<tr><td style="padding:8px 0;font-weight:700;">Total paid</td><td style="padding:8px 0;text-align:right;font-weight:700;">' + esc(money(session.amount_total, session.currency)) + '</td></tr>',
    '</table>',
    '<h3 style="margin:20px 0 6px;font-size:15px;">Customer</h3>',
    '<p style="margin:0;font-size:14px;line-height:1.5;">',
    esc(cust.name || '(no name)') + '<br>',
    (cust.email ? '<a href="mailto:' + esc(cust.email) + '">' + esc(cust.email) + '</a><br>' : ''),
    esc(cust.phone || '') ,
    '</p>',
    '<h3 style="margin:20px 0 6px;font-size:15px;">Ship to</h3>',
    '<p style="margin:0;font-size:14px;line-height:1.5;white-space:pre-line;">' + esc(addrText.replace(/\n\s+/g, '\n')) + '</p>',
    (dashUrl ? '<p style="margin:22px 0 4px;"><a href="' + dashUrl + '" style="background:#3a5a40;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;">View in Stripe →</a></p>' : ''),
    '<p style="color:#aaa;font-size:12px;margin-top:16px;">Order ref: ' + esc(session.id) + '</p>',
    '</div>',
  ].join('');

  const subject = 'New Yúna order — ' + money(session.amount_total, session.currency)
    + (cust.name ? ' · ' + cust.name : '')
    + (stripeEvent.livemode ? '' : ' [TEST]');

  // ---- Send via Resend -----------------------------------------------------
  const payload = {
    from: ALERT_FROM,
    to: [ALERT_TO],
    subject: subject,
    html: html,
    text: text,
  };
  if (cust.email) payload.reply_to = cust.email; // reply straight to the customer

  let resp;
  try {
    resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + resendKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // Network error → 500 so Stripe retries later.
    return { statusCode: 500, body: 'Email send error: ' + (e && e.message) };
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    // Non-2xx from Resend → 500 so Stripe retries.
    return { statusCode: 500, body: 'Resend rejected the email (' + resp.status + '): ' + body };
  }

  return { statusCode: 200, body: 'order alert sent' };
};

# Yúna Tea — Store Setup Guide

This is your storefront: a shop homepage, two product pages, a cart, and a
secure Stripe checkout — all running on your existing static Netlify site.
Nothing charges a customer until **you** finish the Stripe steps below.

## What's in the box

| File | What it is |
|------|------------|
| `index.html` | Homepage — brand hero **+ the shop** (both teas as cards). Replaces the old "Coming Soon" page. |
| `index.coming-soon.bak.html` | Backup of the old Coming Soon page (in case you ever want it back). |
| `product-imperial-puerh.html` | Product page — Imperial Pu'erh Tea |
| `product-imperial-puerh-goji.html` | Product page — Imperial Pu'erh Tea with Goji |
| `cart.html` | Full cart page |
| `order-confirmed.html` / `checkout-cancelled.html` | Return pages after Stripe checkout |
| `assets/products.js` | **← You edit this:** names, prices, descriptions, photos |
| `assets/store.css`, `assets/cart.js` | Shared styling + cart engine (no need to touch) |
| `assets/products/` | Drop product photos here |
| `netlify/functions/create-checkout.js` | The serverless function that talks to Stripe |
| `netlify.toml`, `package.json` | Netlify + dependency config |

The design reuses your existing colors, fonts, mountains, and animations, so it
matches the rest of the site.

---

## Step 1 — Fill in the product details

Open **`assets/products.js`** and replace every `TODO`. For each tea:

- `price` — the number shown on the page (e.g. `388`). **Display only** — the real
  charge comes from Stripe (Step 3). Keep the two in sync.
- `shortDesc` — the one/two-line pitch next to the price
- `longDesc` — the full "Description" tab text
- `details` — the `[label, value]` rows in the "Details" tab (weight, form, origin…)
- `brewing` — the "Brewing" tab text
- `sku` — your own reference code (optional)

Currency is set once at the top of the file (`currency` + `currencySymbol`,
default **HKD / HK$**).

## Step 2 — Add product photos

Put 1–3 photos per tea in **`assets/products/`** and list their filenames in the
`images: [ ... ]` array for each product in `products.js`. Square images look best.
Until you add real photos, a tasteful "Photo coming soon" placeholder shows
automatically — nothing breaks.

---

## Step 3 — Set up Stripe (this is what actually takes payment)

1. Create/log in to a **Stripe account** at https://dashboard.stripe.com (a Hong
   Kong business works fine and unlocks Alipay/WeChat Pay).
2. Make sure you're in **Test mode** (toggle, top-right) while setting up.
3. Go to **Product catalog → Add product** and create **two** products:
   - *Imperial Pu'erh Tea* — set its price in **HKD** (or your chosen currency).
   - *Imperial Pu'erh Tea with Goji* — same.
4. Open each product and copy its **Price ID** (looks like `price_1AbC...`). You'll
   need both.
5. Get your **Secret key**: Developers → API keys → *Secret key* (`sk_test_...`).

> The Price IDs are the source of truth for what customers pay. The numbers in
> `products.js` are only for display.

## Step 4 — Give Netlify the keys

In **Netlify → your site → Site configuration → Environment variables**, add:

| Key | Value |
|-----|-------|
| `STRIPE_SECRET_KEY` | your `sk_test_...` (later `sk_live_...`) |
| `STRIPE_PRICE_PUERH_SINGLE` | Price ID — Imperial Pu'erh Tea, **Single** |
| `STRIPE_PRICE_PUERH_PACK3` | Price ID — Imperial Pu'erh Tea, **Set of 3** |
| `STRIPE_PRICE_PUERH_GOJI_SINGLE` | Price ID — Imperial Pu'erh Tea with Goji, **Single** |
| `STRIPE_PRICE_PUERH_GOJI_PACK3` | Price ID — Imperial Pu'erh Tea with Goji, **Set of 3** |

> Each tea is sold in two sizes, so there are **four** products/prices (2 teas × Single/Set of 3).

(Never put the secret key in the HTML/JS — it belongs only in these env vars,
which is why checkout runs through the serverless function.)

## Step 5 — Turn on order emails

There are **two** separate emails: the receipt the customer gets, and the alert
**you** get. They work differently.

### 5a — Customer receipt (built-in Stripe, no code)

Dashboard → **Settings → Customer emails** → turn on *"Successful payments"*.
Stripe emails the buyer a receipt from its own verified servers — no DNS setup
needed.

> **This receipt carries your Stripe account's branding, not the website's.**
> The logo, sender name, and the *"contact us at … / call us at …"* footer come
> from your **Stripe account settings**, *not* from anything in this repo. To fix
> what a buyer sees:
>
> - **Logo & colours:** Settings → **Business → Branding** — upload the Yúna Tea
>   **icon** (used at the top of the receipt) and **logo**, and set the brand
>   colour.
> - **Contact footer + sender name:** Settings → **Business → Business details**
>   (public business information; direct link `dashboard.stripe.com/settings/public`)
>   — set **Support email** to `sales@yuna-tea.com`, **Support phone** to
>   `+852 6228 1196`, and the public **business name** to *Yúna Tea*. These render
>   as the receipt's *"If you have any questions, contact us at … or call us at …"*
>   line and the "Receipt from …" sender.

### 5b — Your order alert → `sales@yuna-tea.com` (webhook, built in this repo)

**Why not Stripe's built-in "notify me" toggle?** Those alerts go to your Stripe
**login** email, and your single login owns **both** the Gaia Harvest and Yúna
accounts — so it can't send Gaia orders to one inbox and Yúna orders to another.
Instead, this repo ships a webhook function
(`netlify/functions/order-notify.js`) that the **Yúna account** calls on every
completed order and emails a formatted summary to whatever address you choose.
(Gaia's site does the same to *its* address — that's the per-brand routing.)

Set it up once:

1. **Create a Resend account** at https://resend.com (free tier is plenty) and
   **verify a sending domain — use a subdomain** so it never touches your existing
   Microsoft 365 mail on `yuna-tea.com`:
   - Resend → **Domains → Add** `send.yuna-tea.com`.
   - Resend shows a handful of DNS records (a DKIM record on `resend._domainkey.send…`
     plus an SPF/MX for the subdomain). Add them in **Netlify → Domains →
     `yuna-tea.com` DNS**. They all live on the `send.` subdomain, so your
     root-domain **SPF/DKIM/DMARC for M365 stays untouched**.
   - Wait until Resend marks the domain **Verified**.
2. **Create an API key** (Resend → API Keys) — it starts `re_…`.
3. **Add env vars** in Netlify → Site configuration → Environment variables:

   | Key | Value |
   |-----|-------|
   | `RESEND_API_KEY` | your `re_…` key |
   | `ORDER_ALERT_FROM` | `Yuna Tea Orders <orders@send.yuna-tea.com>` (any name @ your verified domain) |
   | `ORDER_ALERT_TO` | `sales@yuna-tea.com` (this is also the default if omitted) |
   | `STRIPE_WEBHOOK_SECRET` | filled in step 5 below |

4. **Deploy** (Git push, or `netlify deploy --prod`) so the function is live.
5. **Create the Stripe webhook** on the **Yúna** account: Dashboard → **Developers
   → Webhooks → Add endpoint**:
   - **Endpoint URL:** `https://yuna-tea.com/.netlify/functions/order-notify`
   - **Events:** select **`checkout.session.completed`** (just that one).
   - Save, copy the endpoint's **Signing secret** (`whsec_…`) into the
     `STRIPE_WEBHOOK_SECRET` env var in Netlify, and **redeploy**.
6. **Test:** place a test order (test-mode keys + card `4242 4242 4242 4242`). A
   formatted alert should land in `sales@yuna-tea.com` within seconds. If not,
   check **Developers → Webhooks → your endpoint → recent deliveries** — the
   function returns a plain-English reason (missing env var, Resend rejection, …).

> **For Gaia:** repeat 5b on the Gaia Harvest account with its own webhook and
> `ORDER_ALERT_TO=sales@gaiaharvest.org`. Each account then alerts its own inbox,
> independent of your shared login.

## Step 6 — (Optional) Enable Alipay / WeChat Pay & more

Dashboard → **Settings → Payment methods** → enable Cards, Apple Pay, Google Pay,
**Alipay**, **WeChat Pay**, etc. Whatever you enable shows up automatically at
checkout — no code change.

## Step 7 — (Optional) Charge for shipping

Right now checkout **collects a shipping address** but doesn't add a shipping fee.
To charge shipping: Dashboard → create a **Shipping rate**, copy its `shr_...` id,
and paste it into the `shipping_options` line in
`netlify/functions/create-checkout.js` (a commented example is already there).
Also trim `SHIP_TO` in that file to the countries you actually ship to.

---

## Step 8 — Deploy

⚠️ **Important:** the checkout function can **not** be shipped by drag-and-drop
(that only handles static files). Use one of these instead:

**Option A — Connect to Git (recommended, auto-deploys):**
1. Put this folder in a Git repo (GitHub/GitLab/Bitbucket).
2. Netlify → *Add new site → Import an existing project* → pick the repo.
3. Build command: none. Publish directory: `.`  (already set in `netlify.toml`).
4. Every push now deploys the site **and** the function, installing `stripe`
   automatically.

**Option B — Netlify CLI (no Git):**
```bash
npm install            # installs the stripe dependency locally
npm install -g netlify-cli
netlify login
netlify link           # link to your existing yuna-tea.com site
netlify deploy --prod  # deploys static files + function
```

## Local testing before you go live

```bash
npm install
netlify dev            # serves the site + function locally with your env vars
```
Open the local URL, add both teas to the cart, hit **Checkout**. With test keys
you'll land on a real Stripe **test** checkout. Pay with test card
`4242 4242 4242 4242`, any future expiry, any CVC → you should return to
`order-confirmed.html` and the cart should empty. The order appears in your
Stripe Dashboard (test mode).

## Going live

1. Recreate the two products/prices in **Live mode** (or use live Price IDs).
2. In Netlify, swap the env vars to your **live** values (`sk_live_...` + live
   Price IDs).
3. Redeploy. Do one real small purchase to confirm end-to-end.

## Where you'll see orders

**Stripe Dashboard → Payments** (and the Stripe mobile app). Each order includes
the customer's shipping address and contact details for fulfilment.

---

## Later upgrades (not built yet)

- **Order alert email — ✅ built** (`netlify/functions/order-notify.js`). See
  **Step 5b** to switch it on (Resend + a Stripe webhook). Routes each account's
  orders to its own inbox, independent of your shared Stripe login.
- **Branded *customer* confirmation email** (a Yúna-designed email to the buyer,
  replacing/augmenting Stripe's plain receipt): the webhook plumbing now exists —
  extend `order-notify.js` to also send a second email to `session.customer_details.email`.
  Worth doing once volume grows.
- Discount codes are already allowed at checkout (`allow_promotion_codes`); create
  them in the Stripe Dashboard.
- Inventory tracking, customer accounts, reviews.

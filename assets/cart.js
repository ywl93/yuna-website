/* =============================================================================
   Yúna Tea — cart engine (classic script, no build step)
   Depends on assets/products.js (loaded first). Exposes window.YUNA.cart.

   Responsibilities:
     - cart state in localStorage  (items: [{ id, qty }])
     - header cart-count badge
     - slide-in cart drawer (injected into every page automatically)
     - add-to-cart + quantity-stepper wiring via data-attributes
     - render the home product grid, the product pages, and the cart page
     - checkout() -> POST to the Netlify function -> redirect to Stripe
   ========================================================================== */
(function () {
  'use strict';

  var YUNA = window.YUNA = window.YUNA || {};
  var STORAGE_KEY = 'yuna_cart_v1';
  var PLACEHOLDER = 'assets/products/placeholder.svg';
  var CHECKOUT_ENDPOINT = '/.netlify/functions/create-checkout';

  /* ---------- helpers ------------------------------------------------------ */

  function productById(id) { return YUNA.productById ? YUNA.productById[id] : null; }

  function firstImage(p) {
    return (p && p.images && p.images[0]) ? p.images[0] : PLACEHOLDER;
  }

  // <img> with graceful fallback to the placeholder if the file is missing.
  function imgTag(src, alt, cls) {
    var c = cls ? ' class="' + cls + '"' : '';
    return '<img' + c + ' src="' + (src || PLACEHOLDER) + '" alt="' + escapeAttr(alt || '') +
      '" loading="lazy" onerror="this.onerror=null;this.src=\'' + PLACEHOLDER + '\'">';
  }

  function money(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return null;
    try {
      return new Intl.NumberFormat('en-HK', {
        style: 'currency', currency: YUNA.currency || 'HKD', minimumFractionDigits: 0
      }).format(amount);
    } catch (e) {
      return (YUNA.currencySymbol || '') + amount;
    }
  }

  function priceLabel(p) {
    var m = p ? money(p.price) : null;
    return m || 'Price on request';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

  /* ---------- cart state --------------------------------------------------- */

  function read() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(function (i) { return i && productById(i.id); }) : [];
    } catch (e) { return []; }
  }
  function write(items) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) {}
    refresh();
  }

  function clampQty(n) {
    n = parseInt(n, 10);
    if (isNaN(n) || n < 1) n = 1;
    if (n > 99) n = 99;
    return n;
  }

  var cart = {
    items: function () { return read(); },
    count: function () {
      return read().reduce(function (n, i) { return n + clampQty(i.qty); }, 0);
    },
    add: function (id, qty) {
      if (!productById(id)) return;
      var items = read();
      var found = items.filter(function (i) { return i.id === id; })[0];
      if (found) found.qty = clampQty(found.qty + (qty || 1));
      else items.push({ id: id, qty: clampQty(qty || 1) });
      write(items);
    },
    setQty: function (id, qty) {
      var items = read().map(function (i) {
        return i.id === id ? { id: id, qty: clampQty(qty) } : i;
      });
      write(items);
    },
    remove: function (id) {
      write(read().filter(function (i) { return i.id !== id; }));
    },
    clear: function () { write([]); },
    subtotal: function () {
      // Returns { amount, hasUnpriced }. amount is null if nothing is priced.
      var amount = 0, hasUnpriced = false, any = false;
      read().forEach(function (i) {
        var p = productById(i.id);
        if (p && typeof p.price === 'number') { amount += p.price * clampQty(i.qty); any = true; }
        else hasUnpriced = true;
      });
      return { amount: any ? amount : null, hasUnpriced: hasUnpriced };
    }
  };
  YUNA.cart = cart;

  /* ---------- badge -------------------------------------------------------- */

  function renderBadge() {
    var n = cart.count();
    document.querySelectorAll('.cart-count').forEach(function (el) {
      el.textContent = n;
      if (n > 0) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
    });
  }

  /* ---------- drawer ------------------------------------------------------- */

  function ensureDrawer() {
    if (document.querySelector('.cart-drawer')) return;
    var overlay = document.createElement('div');
    overlay.className = 'cart-overlay';
    overlay.setAttribute('data-close-cart', '');

    var drawer = document.createElement('aside');
    drawer.className = 'cart-drawer';
    drawer.setAttribute('aria-label', 'Shopping cart');
    drawer.innerHTML =
      '<div class="drawer-head">' +
        '<h3>Your cart</h3>' +
        '<button class="drawer-close" data-close-cart aria-label="Close cart">&times;</button>' +
      '</div>' +
      '<div class="cart-lines" data-cart-lines></div>' +
      '<div class="cart-foot">' +
        '<div class="cart-subtotal"><span class="lbl">Subtotal</span><span class="amt" data-cart-subtotal>—</span></div>' +
        '<p class="cart-note">Shipping &amp; taxes calculated at checkout.</p>' +
        '<button class="btn solid block" data-checkout>Checkout</button>' +
        '<a class="btn block" href="cart.html" style="margin-top:10px;">View cart</a>' +
        '<p class="checkout-error" data-checkout-error></p>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
  }

  function lineHtml(item, opts) {
    var p = productById(item.id);
    if (!p) return '';
    var qty = clampQty(item.qty);
    var line = (typeof p.price === 'number') ? money(p.price * qty) : priceLabel(p);
    return '' +
      '<div class="cart-line" data-line="' + escapeAttr(p.id) + '">' +
        '<a href="' + escapeAttr(p.url) + '">' + imgTag(firstImage(p), p.name) + '</a>' +
        '<div>' +
          '<a class="cl-name" href="' + escapeAttr(p.url) + '">' + escapeHtml(p.name) + '</a>' +
          '<div class="cl-price">' + escapeHtml(priceLabel(p)) + '</div>' +
          '<div class="cl-controls">' +
            '<span class="cl-qty">' +
              '<button data-line-dec="' + escapeAttr(p.id) + '" aria-label="Decrease quantity">&minus;</button>' +
              '<span>' + qty + '</span>' +
              '<button data-line-inc="' + escapeAttr(p.id) + '" aria-label="Increase quantity">+</button>' +
            '</span>' +
            '<button class="cl-remove" data-line-remove="' + escapeAttr(p.id) + '">Remove</button>' +
          '</div>' +
        '</div>' +
        '<div class="cl-linetotal">' + escapeHtml(line) + '</div>' +
      '</div>';
  }

  function renderLinesInto(container) {
    if (!container) return;
    var items = cart.items();
    if (!items.length) {
      container.innerHTML = '<div class="cart-empty">Your cart is empty.<br>Browse our teas to get started.</div>';
      return;
    }
    container.innerHTML = items.map(function (i) { return lineHtml(i); }).join('');
  }

  function renderSubtotalInto(el) {
    if (!el) return;
    var s = cart.subtotal();
    if (s.amount === null) { el.textContent = '—'; return; }
    el.textContent = money(s.amount) + (s.hasUnpriced ? ' +' : '');
  }

  function refreshDrawer() {
    renderLinesInto(document.querySelector('.cart-drawer [data-cart-lines]'));
    renderSubtotalInto(document.querySelector('.cart-drawer [data-cart-subtotal]'));
  }

  function openCart() {
    ensureDrawer();
    refreshDrawer();
    var d = document.querySelector('.cart-drawer');
    var o = document.querySelector('.cart-overlay');
    if (o) o.classList.add('open');
    if (d) d.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeCart() {
    var d = document.querySelector('.cart-drawer');
    var o = document.querySelector('.cart-overlay');
    if (o) o.classList.remove('open');
    if (d) d.classList.remove('open');
    document.body.style.overflow = '';
  }
  YUNA.openCart = openCart;
  YUNA.closeCart = closeCart;

  /* ---------- checkout ----------------------------------------------------- */

  function setCheckoutError(msg) {
    document.querySelectorAll('[data-checkout-error]').forEach(function (el) {
      el.textContent = msg || '';
      if (msg) el.classList.add('visible'); else el.classList.remove('visible');
    });
  }

  function checkout(btn) {
    var items = cart.items().map(function (i) { return { id: i.id, qty: clampQty(i.qty) }; });
    if (!items.length) { setCheckoutError('Your cart is empty.'); return; }
    setCheckoutError('');
    var buttons = document.querySelectorAll('[data-checkout]');
    buttons.forEach(function (b) { b.disabled = true; });
    if (btn) btn.textContent = 'Redirecting…';

    fetch(CHECKOUT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items })
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok || !data.url) throw new Error(data.error || ('Checkout failed (' + res.status + ')'));
          return data.url;
        });
      })
      .then(function (url) { window.location.href = url; })
      .catch(function (err) {
        buttons.forEach(function (b) { b.disabled = false; });
        if (btn) btn.textContent = 'Checkout';
        setCheckoutError(
          (err && err.message ? err.message : 'Something went wrong.') +
          ' You can also reach us at sales@yuna-tea.com.'
        );
      });
  }
  YUNA.checkout = checkout;

  /* ---------- renderers: home grid ---------------------------------------- */

  function renderProductGrid(container) {
    if (!container) return;
    container.innerHTML = YUNA.products.map(function (p) {
      return '' +
        '<div class="product-card">' +
          '<a href="' + escapeAttr(p.url) + '">' + imgTag(firstImage(p), p.name, 'thumb') + '</a>' +
          '<div class="card-body">' +
            '<span class="card-cat">' + escapeHtml(p.category) + '</span>' +
            '<a class="card-name" href="' + escapeAttr(p.url) + '">' + escapeHtml(p.name) + '</a>' +
            '<span class="card-price">' + escapeHtml(priceLabel(p)) + '</span>' +
            '<div class="card-actions">' +
              '<a class="btn" href="' + escapeAttr(p.url) + '">View</a>' +
              '<button class="btn solid" data-add="' + escapeAttr(p.id) + '">Add</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  /* ---------- renderers: product page ------------------------------------- */

  function renderProductPage() {
    var id = document.body.getAttribute('data-product');
    if (!id) return;
    var p = productById(id);
    if (!p) return;

    document.title = p.name + ' — Yúna Tea';
    setText('#pdp-breadcrumb-name', p.name);
    setText('#pdp-cat', p.category);
    setText('#pdp-title', p.name);
    setText('#pdp-price', priceLabel(p));
    setText('#pdp-short', p.shortDesc);
    setText('#pdp-sku', p.sku);
    setText('#pdp-category', p.category);

    // gallery
    var imgs = (p.images && p.images.length) ? p.images : [PLACEHOLDER];
    var main = document.querySelector('#pdp-gallery-main');
    if (main) {
      main.src = imgs[0];
      main.alt = p.name;
      main.onerror = function () { this.onerror = null; this.src = PLACEHOLDER; };
    }
    var thumbs = document.querySelector('#pdp-thumbs');
    if (thumbs) {
      if (imgs.length > 1) {
        thumbs.innerHTML = imgs.map(function (src, i) {
          return '<img src="' + escapeAttr(src) + '" alt="' + escapeAttr(p.name) + ' view ' + (i + 1) +
            '"' + (i === 0 ? ' class="active"' : '') +
            ' onerror="this.onerror=null;this.src=\'' + PLACEHOLDER + '\'">';
        }).join('');
        thumbs.addEventListener('click', function (e) {
          var t = e.target.closest('img'); if (!t || !main) return;
          main.src = t.src;
          thumbs.querySelectorAll('img').forEach(function (im) { im.classList.remove('active'); });
          t.classList.add('active');
        });
      } else {
        thumbs.style.display = 'none';
      }
    }

    // tabs content
    setText('#tab-description', p.longDesc);
    var detailsEl = document.querySelector('#tab-details');
    if (detailsEl) {
      detailsEl.innerHTML = '<table><tbody>' + (p.details || []).map(function (row) {
        return '<tr><td>' + escapeHtml(row[0]) + '</td><td>' + escapeHtml(row[1]) + '</td></tr>';
      }).join('') + '</tbody></table>';
    }
    setText('#tab-brewing', p.brewing);

    // add-to-cart button id
    var addBtn = document.querySelector('#pdp-add');
    if (addBtn) addBtn.setAttribute('data-add', p.id);

    // related (the other product)
    var related = document.querySelector('#pdp-related');
    if (related) {
      var other = YUNA.products.filter(function (x) { return x.id !== p.id; })[0];
      if (other) {
        related.innerHTML =
          '<div class="section-head"><span class="eyebrow">You may also like</span></div>' +
          '<div class="product-grid" style="max-width:380px;">' +
            '<div class="product-card">' +
              '<a href="' + escapeAttr(other.url) + '">' + imgTag(firstImage(other), other.name, 'thumb') + '</a>' +
              '<div class="card-body">' +
                '<span class="card-cat">' + escapeHtml(other.category) + '</span>' +
                '<a class="card-name" href="' + escapeAttr(other.url) + '">' + escapeHtml(other.name) + '</a>' +
                '<span class="card-price">' + escapeHtml(priceLabel(other)) + '</span>' +
                '<div class="card-actions"><a class="btn" href="' + escapeAttr(other.url) + '">View</a></div>' +
              '</div>' +
            '</div>' +
          '</div>';
      }
    }
  }

  /* ---------- renderers: cart page ---------------------------------------- */

  function renderCartPage() {
    var page = document.querySelector('#cart-page');
    if (!page) return;
    renderLinesInto(page.querySelector('[data-cart-lines]'));
    renderSubtotalInto(page.querySelector('[data-cart-subtotal]'));
  }

  /* ---------- small DOM utils --------------------------------------------- */

  function setText(sel, text) {
    var el = document.querySelector(sel);
    if (el) el.textContent = (text == null ? '' : text);
  }

  /* ---------- global refresh ---------------------------------------------- */

  function refresh() {
    renderBadge();
    refreshDrawer();
    renderCartPage();
  }
  YUNA.refresh = refresh;

  /* ---------- event wiring (delegated) ------------------------------------ */

  function qtyFromScope(el) {
    var scope = el.closest('.buybox, .product-card, .cart-add-group');
    var input = scope ? scope.querySelector('[data-qty-input]') : null;
    return input ? clampQty(input.value) : 1;
  }

  document.addEventListener('click', function (e) {
    var t = e.target;

    var tab = t.closest('[data-tab]');
    if (tab) {
      var name = tab.getAttribute('data-tab');
      var tabs = tab.closest('.tabs');
      if (tabs) {
        tabs.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('active', b === tab); });
        tabs.querySelectorAll('[data-panel]').forEach(function (pnl) { pnl.classList.toggle('active', pnl.getAttribute('data-panel') === name); });
      }
      return;
    }

    var add = t.closest('[data-add]');
    if (add) { cart.add(add.getAttribute('data-add'), qtyFromScope(add)); openCart(); return; }

    if (t.closest('[data-open-cart]')) { e.preventDefault(); openCart(); return; }
    if (t.closest('[data-close-cart]')) { closeCart(); return; }
    if (t.closest('[data-checkout]')) { checkout(t.closest('[data-checkout]')); return; }

    var dec = t.closest('[data-qty-dec]');
    if (dec) { var s1 = dec.closest('.qty'); var i1 = s1 && s1.querySelector('[data-qty-input]'); if (i1) i1.value = clampQty(i1.value) - 1 < 1 ? 1 : clampQty(i1.value) - 1; return; }
    var inc = t.closest('[data-qty-inc]');
    if (inc) { var s2 = inc.closest('.qty'); var i2 = s2 && s2.querySelector('[data-qty-input]'); if (i2) i2.value = clampQty(i2.value) + 1; return; }

    var ldec = t.closest('[data-line-dec]');
    if (ldec) { var idd = ldec.getAttribute('data-line-dec'); var cur = cartQty(idd); cart.setQty(idd, cur - 1 < 1 ? 1 : cur - 1); return; }
    var linc = t.closest('[data-line-inc]');
    if (linc) { var idi = linc.getAttribute('data-line-inc'); cart.setQty(idi, cartQty(idi) + 1); return; }
    var lrem = t.closest('[data-line-remove]');
    if (lrem) { cart.remove(lrem.getAttribute('data-line-remove')); return; }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeCart();
  });

  function cartQty(id) {
    var it = cart.items().filter(function (i) { return i.id === id; })[0];
    return it ? clampQty(it.qty) : 1;
  }

  /* ---------- init --------------------------------------------------------- */

  function init() {
    ensureDrawer();
    renderProductGrid(document.querySelector('#product-grid'));
    renderProductPage();
    refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
